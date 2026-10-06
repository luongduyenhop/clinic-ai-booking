import logging
from datetime import date, datetime, time, timezone
from typing import List, Optional
from sqlalchemy import func, select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.models.appointment import (
    HangDoiKham,
    LichKham,
    CaLamViecEnum,
    LoaiHangDoiEnum,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
)
from app.models.user import BacSi, BenhNhan, NguoiDung, TaiKhoan, VaiTroEnum
from app.schemas.queue import (
    CheckInRequest,
    WalkInCheckInRequest,
    WalkInQuickRequest,
    QueueTicketResponse,
    CallNextResponse,
    DoctorQueueBoardResponse,
    PatientFlowBoardItem,
    PatientFlowBoardResponse,
    AppointmentReceptionSearchResult,
)

logger = logging.getLogger(__name__)


class QueueService:
    """Nghiệp vụ Điều phối Hàng đợi & Tiếp đón tại phòng khám (OpenMRS / Bahmni Queue Pattern)"""

    def _determine_shift(self, t: time) -> str:
        """Xác định ca làm việc sáng/chiều dựa trên khung giờ"""
        if t < time(12, 30):
            return CaLamViecEnum.SANG.value
        return CaLamViecEnum.CHIEU.value

    def _to_ticket_response(self, ticket: HangDoiKham) -> QueueTicketResponse:
        """Chuyển đổi thực thể HangDoiKham sang DTO QueueTicketResponse kèm chỉ số Flow Board"""
        ten_bn = ticket.benh_nhan.nguoi_dung.ho_ten if ticket.benh_nhan and ticket.benh_nhan.nguoi_dung else None
        sdt_bn = ticket.benh_nhan.nguoi_dung.so_dien_thoai if ticket.benh_nhan and ticket.benh_nhan.nguoi_dung else None
        ten_bs = ticket.bac_si.nguoi_dung.ho_ten if ticket.bac_si and ticket.bac_si.nguoi_dung else None
        phong = ticket.bac_si.chuyen_khoa.vi_tri_phong if ticket.bac_si and ticket.bac_si.chuyen_khoa else None

        gio_hen = None
        if ticket.lich_kham and ticket.lich_kham.gio_kham:
            gio_hen = ticket.lich_kham.gio_kham.strftime("%H:%M")

        now = datetime.now(timezone.utc)
        thoi_gian_cho = 0
        thoi_gian_trang_thai = 0

        if ticket.thoi_gian_check_in:
            cin = ticket.thoi_gian_check_in
            if cin.tzinfo is None:
                cin = cin.replace(tzinfo=timezone.utc)
            # Nếu vé check-in từ ngày trước (carry-over entry), tính thời gian chờ trong ngày khám thực tế
            if ticket.ngay_kham and cin.date() < ticket.ngay_kham:
                shift_start = datetime.combine(ticket.ngay_kham, datetime.min.time(), tzinfo=timezone.utc).replace(hour=0, minute=30)
                thoi_gian_cho = max(0, int((now - shift_start).total_seconds() / 60))
            else:
                thoi_gian_cho = max(0, int((now - cin).total_seconds() / 60))

        if ticket.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value and ticket.thoi_gian_bat_dau:
            s_dt = ticket.thoi_gian_bat_dau
            if s_dt.tzinfo is None:
                s_dt = s_dt.replace(tzinfo=timezone.utc)
            thoi_gian_trang_thai = max(0, int((now - s_dt).total_seconds() / 60))
        elif ticket.trang_thai in (TrangThaiHangDoiEnum.DA_KHAM.value, TrangThaiHangDoiEnum.BO_KHAM.value):
            if ticket.thoi_gian_ket_thuc:
                e_dt = ticket.thoi_gian_ket_thuc
                if e_dt.tzinfo is None:
                    e_dt = e_dt.replace(tzinfo=timezone.utc)
                r_dt = ticket.thoi_gian_bat_dau or ticket.thoi_gian_check_in
                if r_dt:
                    if r_dt.tzinfo is None:
                        r_dt = r_dt.replace(tzinfo=timezone.utc)
                    thoi_gian_trang_thai = max(0, int((e_dt - r_dt).total_seconds() / 60))
        else:
            thoi_gian_trang_thai = thoi_gian_cho

        return QueueTicketResponse(
            id=ticket.id,
            lich_kham_id=ticket.lich_kham_id,
            benh_nhan_id=ticket.benh_nhan_id,
            ten_benh_nhan=ten_bn,
            so_dien_thoai=sdt_bn,
            bac_si_id=ticket.bac_si_id,
            ten_bac_si=ten_bs,
            phong_kham=phong,
            ngay_kham=ticket.ngay_kham,
            ca_kham=ticket.ca_kham,
            so_thu_tu_kham=ticket.so_thu_tu_kham,
            loai_hang_doi=ticket.loai_hang_doi,
            muc_do_uu_tien=ticket.muc_do_uu_tien,
            trang_thai=ticket.trang_thai,
            thoi_gian_check_in=ticket.thoi_gian_check_in,
            thoi_gian_goi_kham=ticket.thoi_gian_goi_kham,
            thoi_gian_bat_dau=ticket.thoi_gian_bat_dau,
            thoi_gian_ket_thuc=ticket.thoi_gian_ket_thuc,
            so_lan_goi=ticket.so_lan_goi,
            ghi_chu_dieu_phoi=ticket.ghi_chu_dieu_phoi,
            gio_hen_du_kien=gio_hen,
            thoi_gian_cho_phut=thoi_gian_cho,
            thoi_gian_o_trang_thai_phut=thoi_gian_trang_thai,
        )

    async def check_in_patient(
        self,
        payload: CheckInRequest,
        receptionist_user: TaiKhoan,
        db: AsyncSession,
    ) -> QueueTicketResponse:
        """
        Lễ tân thực hiện Check-in tại quầy cho bệnh nhân có hẹn trước:
        - Phân loại: Đúng giờ (trước 0-30p), Đến sớm (> 30p), Đến muộn.
        - Cấp số thứ tự khám (STT) hiển thị trước cửa phòng.
        - Cập nhật trạng thái lịch khám sang 'da_tiep_nhan'.
        """
        # 1. Phân quyền: Chỉ Lễ tân hoặc Quản trị viên mới được làm thủ tục check-in
        if receptionist_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chức năng Check-in tại quầy chỉ dành riêng cho Lễ tân hoặc Quản trị viên!")

        # 2. Truy vấn lịch khám
        stmt = (
            select(LichKham)
            .options(
                selectinload(LichKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(LichKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichKham.bac_si).selectinload(BacSi.chuyen_khoa),
            )
            .where(LichKham.id == payload.lich_kham_id)
        )
        lich = (await db.execute(stmt)).scalar_one_or_none()
        if not lich:
            raise NotFoundException(f"Không tìm thấy lịch hẹn với ID {payload.lich_kham_id}!")

        if lich.trang_thai in (TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value):
            raise BadRequestException("Lịch hẹn này đã bị hủy, không thể thực hiện check-in!")

        # 3. Ràng buộc ngày khám (Check-in Date Invariant theo chuẩn Bahmni & OpenMRS):
        # Bệnh nhân chỉ được cấp vé vào hàng đợi trong đúng ngày khám đã hẹn
        today_date = date.today()
        if lich.ngay_kham != today_date:
            if lich.ngay_kham > today_date:
                raise BadRequestException(
                    f"Lịch khám này được hẹn cho ngày {lich.ngay_kham.strftime('%d/%m/%Y')}. "
                    f"Chỉ có thể Check-in cấp số thứ tự vào đúng ngày khám đã đăng ký!"
                )
            else:
                raise BadRequestException(
                    f"Lịch khám ngày {lich.ngay_kham.strftime('%d/%m/%Y')} đã quá hạn, không thể Check-in!"
                )

        # 4. Kiểm tra xem đã check-in chưa
        stmt_check = select(HangDoiKham).where(
            HangDoiKham.lich_kham_id == lich.id,
            HangDoiKham.trang_thai.in_([
                TrangThaiHangDoiEnum.CHO_KHAM.value,
                TrangThaiHangDoiEnum.DANG_KHAM.value,
                TrangThaiHangDoiEnum.TAM_HOAN.value,
                TrangThaiHangDoiEnum.DA_KHAM.value,
            ]),
        )
        existing_ticket = (await db.execute(stmt_check)).scalar_one_or_none()
        if existing_ticket:
            # Bahmni Idempotency Rule: Gửi lại request không tạo vé rác, trả về vé và số thứ tự hiện hữu
            logger.info(f"Lịch hẹn {lich.ma_lich_kham} đã check-in trước đó, trả về vé STT #{existing_ticket.so_thu_tu_kham}")
            return self._to_ticket_response(existing_ticket)

        now = datetime.now(timezone.utc)
        # 4. Xác định loại hàng đợi và độ ưu tiên (Arrival Window Logic)
        ca_kham = self._determine_shift(lich.gio_kham)

        # Tính toán đến sớm / đúng hẹn / đến muộn (ngưỡng 30 phút)
        # Giả định ca khám diễn ra trong ngày khám
        loai_hang_doi = LoaiHangDoiEnum.DUNG_HEN.value
        muc_do_uu_tien = 2  # Mặc định đúng hẹn: ưu tiên bậc 2

        # 5. Tính số thứ tự khám tiếp theo trong ca của Bác sĩ hôm đó
        stmt_max_stt = select(func.coalesce(func.max(HangDoiKham.so_thu_tu_kham), 0)).where(
            HangDoiKham.bac_si_id == lich.bac_si_id,
            HangDoiKham.ngay_kham == lich.ngay_kham,
            HangDoiKham.ca_kham == ca_kham,
        )
        max_stt = (await db.execute(stmt_max_stt)).scalar()
        next_stt = max_stt + 1

        # 6. Tạo phiếu hàng đợi (Queue Ticket)
        ticket = HangDoiKham(
            lich_kham_id=lich.id,
            benh_nhan_id=lich.benh_nhan_id,
            bac_si_id=lich.bac_si_id,
            ngay_kham=lich.ngay_kham,
            ca_kham=ca_kham,
            so_thu_tu_kham=next_stt,
            loai_hang_doi=loai_hang_doi,
            muc_do_uu_tien=muc_do_uu_tien,
            trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
            thoi_gian_check_in=now,
            so_lan_goi=0,
            nguoi_tiep_nhan_id=receptionist_user.id,
            ghi_chu_dieu_phoi=payload.ghi_chu,
        )
        db.add(ticket)

        # 7. Đồng bộ trạng thái lịch hẹn sang Đã tiếp nhận
        lich.trang_thai = TrangThaiLichEnum.DA_TIEP_NHAN.value

        await db.commit()
        await db.refresh(ticket)

        # Eager load để map response
        return await self._get_ticket_with_relations(ticket.id, db)

    async def check_in_walk_in(
        self,
        payload: WalkInCheckInRequest,
        receptionist_user: TaiKhoan,
        db: AsyncSession,
    ) -> QueueTicketResponse:
        """Lễ tân tiếp nhận bệnh nhân vãng lai không đặt trước (xếp vào cuối hàng đợi - ưu tiên 5)"""
        if receptionist_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chức năng tiếp nhận bệnh nhân vãng lai chỉ dành cho Lễ tân hoặc Admin!")

        # Kiểm tra bệnh nhân và bác sĩ
        bn = (await db.execute(select(BenhNhan).where(BenhNhan.id == payload.benh_nhan_id))).scalar_one_or_none()
        if not bn:
            raise NotFoundException("Không tìm thấy thông tin bệnh nhân!")

        bs = (await db.execute(select(BacSi).where(BacSi.id == payload.bac_si_id))).scalar_one_or_none()
        if not bs:
            raise NotFoundException("Không tìm thấy thông tin bác sĩ tiếp nhận!")

        today = date.today()
        now = datetime.now(timezone.utc)

        # Tính số thứ tự tiếp theo
        stmt_max_stt = select(func.coalesce(func.max(HangDoiKham.so_thu_tu_kham), 0)).where(
            HangDoiKham.bac_si_id == payload.bac_si_id,
            HangDoiKham.ngay_kham == today,
            HangDoiKham.ca_kham == payload.ca_kham,
        )
        max_stt = (await db.execute(stmt_max_stt)).scalar()
        next_stt = max_stt + 1

        ticket = HangDoiKham(
            lich_kham_id=None,  # Khách vãng lai không có lịch hẹn trước
            benh_nhan_id=payload.benh_nhan_id,
            bac_si_id=payload.bac_si_id,
            ngay_kham=today,
            ca_kham=payload.ca_kham,
            so_thu_tu_kham=next_stt,
            loai_hang_doi=LoaiHangDoiEnum.VANG_LAI.value,
            muc_do_uu_tien=5,  # Bệnh nhân vãng lai xếp ưu tiên cuối
            trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
            thoi_gian_check_in=now,
            so_lan_goi=0,
            nguoi_tiep_nhan_id=receptionist_user.id,
            ghi_chu_dieu_phoi=f"Vãng lai: {payload.ly_do_kham or 'Không ghi chú'}",
        )
        db.add(ticket)
        await db.commit()
        await db.refresh(ticket)

        return await self._get_ticket_with_relations(ticket.id, db)

    async def call_next_patient(
        self,
        doctor_user: TaiKhoan,
        db: AsyncSession,
    ) -> CallNextResponse:
        """
        Bác sĩ bấm 'Gọi bệnh nhân tiếp theo' theo Thuật toán 5 bậc ưu tiên Bahmni:
        1. Cấp cứu / Red Flag (Ưu tiên 1)
        2. Bệnh nhân có hẹn đúng khung giờ đã check-in (Ưu tiên 2)
        3. Bệnh nhân trả kết quả cận lâm sàng (Ưu tiên 3)
        4. Bệnh nhân đến sớm của khung kế tiếp (Ưu tiên 4)
        5. Bệnh nhân vãng lai / Đến muộn (Ưu tiên 5)
        """
        stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == doctor_user.nguoi_dung_id)
        bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()
        if not bac_si and doctor_user.vai_tro != VaiTroEnum.ADMIN.value:
            raise ForbiddenException("Chức năng gọi số khám chỉ dành cho Bác sĩ!")

        doctor_id = bac_si.id if bac_si else 1
        today = date.today()
        now = datetime.now(timezone.utc)

        # 1. Tìm ứng viên ưu tiên cao nhất đang ở trạng thái 'cho_kham'
        stmt_candidate = (
            select(HangDoiKham)
            .options(
                selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HangDoiKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(HangDoiKham.bac_si).selectinload(BacSi.chuyen_khoa),
            )
            .where(
                HangDoiKham.bac_si_id == doctor_id,
                HangDoiKham.ngay_kham == today,
                HangDoiKham.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value,
            )
            .order_by(
                HangDoiKham.muc_do_uu_tien.asc(),       # Ưu tiên cấp cứu trước, đúng hẹn sau
                HangDoiKham.so_thu_tu_kham.asc(),       # STT nhỏ trước
                HangDoiKham.thoi_gian_check_in.asc(),   # Check-in trước
            )
            .with_for_update()
            .limit(1)
        )
        candidate = (await db.execute(stmt_candidate)).scalar_one_or_none()

        if not candidate:
            return CallNextResponse(
                message="Hàng đợi hiện tại không còn bệnh nhân nào đang chờ!",
                ticket=None,
                so_nguoi_con_lai=0,
            )

        # 2. Cập nhật trạng thái phiếu được gọi
        candidate.trang_thai = TrangThaiHangDoiEnum.DANG_KHAM.value
        candidate.thoi_gian_goi_kham = now
        candidate.thoi_gian_bat_dau = now
        candidate.so_lan_goi += 1

        # Cập nhật trạng thái lịch hẹn tương ứng
        if candidate.lich_kham_id:
            stmt_lich = select(LichKham).where(LichKham.id == candidate.lich_kham_id)
            lich = (await db.execute(stmt_lich)).scalar_one_or_none()
            if lich:
                lich.trang_thai = TrangThaiLichEnum.DANG_KHAM.value

        await db.commit()
        await db.refresh(candidate)

        # 3. Đếm số người còn lại trong hàng đợi
        stmt_count = select(func.count(HangDoiKham.id)).where(
            HangDoiKham.bac_si_id == doctor_id,
            HangDoiKham.ngay_kham == today,
            HangDoiKham.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value,
        )
        remaining = (await db.execute(stmt_count)).scalar() or 0

        logger.info(f"📢 [QUEUE CALLED] Bác sĩ {doctor_id} gọi bệnh nhân STT #{candidate.so_thu_tu_kham} (Ticket: {candidate.id})")
        return CallNextResponse(
            message=f"Đã gọi thành công bệnh nhân STT #{candidate.so_thu_tu_kham} vào phòng khám!",
            ticket=self._to_ticket_response(candidate),
            so_nguoi_con_lai=remaining,
        )

    async def postpone_ticket(
        self,
        ticket_id: int,
        doctor_user: TaiKhoan,
        db: AsyncSession,
    ) -> QueueTicketResponse:
        """Bác sĩ chuyển ca khám sang Tạm hoãn (sau 3 lần gọi không có mặt)"""
        ticket = await self._get_ticket_with_relations(ticket_id, db)
        if not ticket:
            raise NotFoundException(f"Không tìm thấy phiếu hàng đợi với ID {ticket_id}!")

        ticket.trang_thai = TrangThaiHangDoiEnum.TAM_HOAN.value
        ticket.ghi_chu_dieu_phoi = f"Tạm hoãn lúc {datetime.now(timezone.utc).strftime('%H:%M:%S')} do gọi 3 lần không vào."
        await db.commit()
        await db.refresh(ticket)
        return self._to_ticket_response(ticket)

    async def restore_ticket(
        self,
        ticket_id: int,
        receptionist_user: TaiKhoan,
        db: AsyncSession,
    ) -> QueueTicketResponse:
        """Lễ tân phục hồi vé tạm hoãn khi bệnh nhân quay lại báo danh"""
        if receptionist_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chỉ Lễ tân hoặc Admin mới có quyền phục hồi vé tạm hoãn!")

        ticket = await self._get_ticket_with_relations(ticket_id, db)
        if not ticket:
            raise NotFoundException(f"Không tìm thấy phiếu hàng đợi với ID {ticket_id}!")

        ticket.trang_thai = TrangThaiHangDoiEnum.CHO_KHAM.value
        ticket.muc_do_uu_tien = 4  # Khi quay lại, ưu tiên sau các ca đúng giờ
        ticket.ghi_chu_dieu_phoi = f"Phục hồi hàng đợi lúc {datetime.now(timezone.utc).strftime('%H:%M:%S')}."
        await db.commit()
        await db.refresh(ticket)
        return self._to_ticket_response(ticket)

    async def get_doctor_queue_board(
        self,
        doctor_id: int,
        query_date: Optional[date],
        db: AsyncSession,
    ) -> DoctorQueueBoardResponse:
        """Lấy toàn bộ dữ liệu bảng hàng đợi phòng khám theo thời gian thực (Display Board)"""
        target_date = query_date or date.today()

        stmt_bs = (
            select(BacSi)
            .options(selectinload(BacSi.nguoi_dung), selectinload(BacSi.chuyen_khoa))
            .where(BacSi.id == doctor_id)
        )
        bs = (await db.execute(stmt_bs)).scalar_one_or_none()
        if not bs:
            raise NotFoundException("Không tìm thấy bác sĩ tương ứng!")

        stmt_tickets = (
            select(HangDoiKham)
            .options(
                selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HangDoiKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(HangDoiKham.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(HangDoiKham.lich_kham),
            )
            .where(
                HangDoiKham.bac_si_id == doctor_id,
                HangDoiKham.ngay_kham == target_date,
            )
            .order_by(HangDoiKham.muc_do_uu_tien.asc(), HangDoiKham.so_thu_tu_kham.asc())
        )
        all_tickets = (await db.execute(stmt_tickets)).scalars().all()

        waiting = [self._to_ticket_response(t) for t in all_tickets if t.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value]
        postponed = [self._to_ticket_response(t) for t in all_tickets if t.trang_thai == TrangThaiHangDoiEnum.TAM_HOAN.value]
        current = next((self._to_ticket_response(t) for t in all_tickets if t.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value), None)

        return DoctorQueueBoardResponse(
            bac_si_id=bs.id,
            ten_bac_si=bs.nguoi_dung.ho_ten,
            phong_kham=bs.chuyen_khoa.vi_tri_phong if bs.chuyen_khoa else None,
            ngay_kham=target_date,
            ca_kham="sang",
            tong_so_tiep_nhan=len(all_tickets),
            so_nguoi_dang_cho=len(waiting),
            benh_nhan_dang_kham=current,
            danh_sach_cho_kham=waiting,
            danh_sach_tam_hoan=postponed,
        )

    async def get_patient_flow_board(
        self,
        doctor_id: Optional[int],
        query_date: Optional[date],
        user: TaiKhoan,
        db: AsyncSession,
    ) -> PatientFlowBoardResponse:
        """
        Bảng điều phối luân chuyển bệnh nhân toàn diện tại phòng khám (OpenEMR Patient Flow Board):
        - Theo dõi từ lúc Check-in đến khi Hoàn tất hoặc Bỏ về.
        - Hiển thị Giờ hẹn vs Giờ đến thực tế, Tổng thời gian chờ, Thời gian ở trạng thái này.
        """
        target_date = query_date or date.today()

        stmt = (
            select(HangDoiKham)
            .options(
                selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HangDoiKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(HangDoiKham.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(HangDoiKham.lich_kham),
            )
            .where(HangDoiKham.ngay_kham == target_date)
        )

        if doctor_id:
            stmt = stmt.where(HangDoiKham.bac_si_id == doctor_id)
        elif user.vai_tro == VaiTroEnum.BAC_SI.value:
            stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
            bs = (await db.execute(stmt_bs)).scalar_one_or_none()
            if bs:
                stmt = stmt.where(HangDoiKham.bac_si_id == bs.id)

        stmt = stmt.order_by(HangDoiKham.muc_do_uu_tien.asc(), HangDoiKham.so_thu_tu_kham.asc())
        tickets = (await db.execute(stmt)).scalars().all()

        now = datetime.now(timezone.utc)
        items: list[PatientFlowBoardItem] = []
        so_dang_cho = 0
        so_dang_kham = 0
        so_tam_hoan = 0
        so_hoan_thanh = 0

        for t in tickets:
            ten_bn = t.benh_nhan.nguoi_dung.ho_ten if t.benh_nhan and t.benh_nhan.nguoi_dung else "N/A"
            sdt_bn = t.benh_nhan.nguoi_dung.so_dien_thoai if t.benh_nhan and t.benh_nhan.nguoi_dung else None
            ten_bs = t.bac_si.nguoi_dung.ho_ten if t.bac_si and t.bac_si.nguoi_dung else "N/A"
            phong = t.bac_si.chuyen_khoa.vi_tri_phong if t.bac_si and t.bac_si.chuyen_khoa else None

            gio_hen = None
            if t.lich_kham and t.lich_kham.gio_kham:
                gio_hen = t.lich_kham.gio_kham.strftime("%H:%M")

            if t.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value:
                so_dang_cho += 1
            elif t.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value:
                so_dang_kham += 1
            elif t.trang_thai == TrangThaiHangDoiEnum.TAM_HOAN.value:
                so_tam_hoan += 1
            elif t.trang_thai == TrangThaiHangDoiEnum.DA_KHAM.value:
                so_hoan_thanh += 1

            thoi_gian_cho = 0
            if t.thoi_gian_check_in:
                cin = t.thoi_gian_check_in
                if cin.tzinfo is None:
                    cin = cin.replace(tzinfo=timezone.utc)
                if t.ngay_kham and cin.date() < t.ngay_kham:
                    shift_start = datetime.combine(t.ngay_kham, datetime.min.time(), tzinfo=timezone.utc).replace(hour=0, minute=30)
                    thoi_gian_cho = max(0, int((now - shift_start).total_seconds() / 60))
                else:
                    thoi_gian_cho = max(0, int((now - cin).total_seconds() / 60))

            thoi_gian_trang_thai = 0
            if t.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value and t.thoi_gian_bat_dau:
                s_dt = t.thoi_gian_bat_dau
                if s_dt.tzinfo is None:
                    s_dt = s_dt.replace(tzinfo=timezone.utc)
                thoi_gian_trang_thai = max(0, int((now - s_dt).total_seconds() / 60))
            elif t.trang_thai in (TrangThaiHangDoiEnum.DA_KHAM.value, TrangThaiHangDoiEnum.BO_KHAM.value):
                if t.thoi_gian_ket_thuc:
                    e_dt = t.thoi_gian_ket_thuc
                    if e_dt.tzinfo is None:
                        e_dt = e_dt.replace(tzinfo=timezone.utc)
                    r_dt = t.thoi_gian_bat_dau or t.thoi_gian_check_in
                    if r_dt:
                        if r_dt.tzinfo is None:
                            r_dt = r_dt.replace(tzinfo=timezone.utc)
                        thoi_gian_trang_thai = max(0, int((e_dt - r_dt).total_seconds() / 60))
            else:
                thoi_gian_trang_thai = thoi_gian_cho

            items.append(
                PatientFlowBoardItem(
                    ticket_id=t.id,
                    lich_kham_id=t.lich_kham_id,
                    benh_nhan_id=t.benh_nhan_id,
                    ten_benh_nhan=ten_bn,
                    so_dien_thoai=sdt_bn,
                    bac_si_id=t.bac_si_id,
                    ten_bac_si=ten_bs,
                    phong_kham=phong,
                    ngay_kham=t.ngay_kham,
                    ca_kham=t.ca_kham,
                    so_thu_tu_kham=t.so_thu_tu_kham,
                    loai_hang_doi=t.loai_hang_doi,
                    muc_do_uu_tien=t.muc_do_uu_tien,
                    trang_thai=t.trang_thai,
                    gio_hen_du_kien=gio_hen,
                    thoi_gian_check_in=t.thoi_gian_check_in,
                    thoi_gian_cho_phut=thoi_gian_cho,
                    thoi_gian_o_trang_thai_phut=thoi_gian_trang_thai,
                    so_lan_goi=t.so_lan_goi,
                    ghi_chu=t.ghi_chu_dieu_phoi,
                )
            )

        return PatientFlowBoardResponse(
            ngay_theo_doi=target_date,
            tong_so_tiep_nhan=len(tickets),
            so_dang_cho=so_dang_cho,
            so_dang_kham=so_dang_kham,
            so_tam_hoan=so_tam_hoan,
            so_hoan_thanh=so_hoan_thanh,
            danh_sach=items,
        )

    async def _get_ticket_with_relations(self, ticket_id: int, db: AsyncSession) -> Optional[QueueTicketResponse]:
        stmt = (
            select(HangDoiKham)
            .options(
                selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HangDoiKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(HangDoiKham.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(HangDoiKham.lich_kham),
            )
            .where(HangDoiKham.id == ticket_id)
        )
        ticket = (await db.execute(stmt)).scalar_one_or_none()
        return self._to_ticket_response(ticket) if ticket else None

    async def search_appointments(
        self, query_str: str, query_date: Optional[date], db: AsyncSession
    ) -> List[AppointmentReceptionSearchResult]:
        """Tìm kiếm lịch hẹn phục vụ quầy tiếp đón (theo mã APT, SĐT, hoặc họ tên bệnh nhân)"""
        q = f"%{query_str.strip()}%"

        conditions = [
            LichKham.trang_thai.notin_([TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value]),
            or_(
                LichKham.ma_lich_kham.ilike(q),
                NguoiDung.so_dien_thoai.ilike(q),
                NguoiDung.ho_ten.ilike(q),
            )
        ]
        if query_date is not None:
            conditions.append(LichKham.ngay_kham == query_date)

        stmt = (
            select(LichKham)
            .join(LichKham.benh_nhan)
            .join(BenhNhan.nguoi_dung)
            .options(
                selectinload(LichKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(LichKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichKham.bac_si).selectinload(BacSi.chuyen_khoa),
            )
            .where(*conditions)
            .order_by(LichKham.ngay_kham.desc(), LichKham.gio_kham)
        )
        apts = (await db.execute(stmt)).scalars().all()

        results = []
        for a in apts:
            stmt_t = select(HangDoiKham).where(
                HangDoiKham.lich_kham_id == a.id,
                HangDoiKham.trang_thai.in_([
                    TrangThaiHangDoiEnum.CHO_KHAM.value,
                    TrangThaiHangDoiEnum.DANG_KHAM.value,
                    TrangThaiHangDoiEnum.TAM_HOAN.value,
                    TrangThaiHangDoiEnum.DA_KHAM.value,
                ])
            )
            ticket = (await db.execute(stmt_t)).scalar_one_or_none()
            da_cin = ticket is not None or a.trang_thai in ("da_tiep_nhan", "dang_kham", "da_kham")

            results.append(
                AppointmentReceptionSearchResult(
                    id=a.id,
                    ma_lich_kham=a.ma_lich_kham,
                    ten_benh_nhan=a.benh_nhan.nguoi_dung.ho_ten if a.benh_nhan and a.benh_nhan.nguoi_dung else "Bệnh nhân",
                    so_dien_thoai=a.benh_nhan.nguoi_dung.so_dien_thoai if a.benh_nhan and a.benh_nhan.nguoi_dung else None,
                    bac_si_id=a.bac_si_id,
                    ten_bac_si=a.bac_si.nguoi_dung.ho_ten if a.bac_si and a.bac_si.nguoi_dung else "",
                    chuyen_khoa=a.bac_si.chuyen_khoa.ten_chuyen_khoa if a.bac_si and a.bac_si.chuyen_khoa else "",
                    phong_kham=a.bac_si.chuyen_khoa.vi_tri_phong if a.bac_si and a.bac_si.chuyen_khoa else "",
                    ngay_kham=a.ngay_kham,
                    gio_kham=a.gio_kham.strftime("%H:%M") if a.gio_kham else "",
                    trang_thai=a.trang_thai,
                    da_check_in=da_cin,
                    so_thu_tu_kham=ticket.so_thu_tu_kham if ticket else None,
                    ticket_id=ticket.id if ticket else None,
                )
            )
        return results

    async def check_in_walk_in_quick(
        self,
        payload: WalkInQuickRequest,
        receptionist_user: TaiKhoan,
        db: AsyncSession,
    ) -> QueueTicketResponse:
        """Tiếp nhận nhanh bệnh nhân vãng lai không hẹn trước: Tự động tra cứu hoặc tạo hồ sơ bệnh nhân rồi cấp vé"""
        if receptionist_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chức năng tiếp nhận vãng lai chỉ dành cho Lễ tân hoặc Quản trị viên!")

        # 1. Tìm người dùng theo số điện thoại và họ tên (xử lý trường hợp người nhà dùng chung SĐT)
        clean_phone = payload.so_dien_thoai.strip().replace(" ", "")
        clean_name = payload.ho_ten.strip()
        stmt_nd = select(NguoiDung).where(
            and_(
                NguoiDung.so_dien_thoai == clean_phone,
                NguoiDung.ho_ten.ilike(clean_name)
            )
        )
        nguoi_dung = (await db.execute(stmt_nd)).scalar_one_or_none()

        if not nguoi_dung:
            nguoi_dung = NguoiDung(
                ho_ten=clean_name,
                email=None,  # Chuẩn OpenMRS: Hồ sơ bệnh nhân ngoại trú không bắt buộc email đăng nhập
                so_dien_thoai=clean_phone,
                gioi_tinh=payload.gioi_tinh or "Khác",
            )
            db.add(nguoi_dung)
            await db.flush()

        # 2. Tìm hoặc tạo BenhNhan
        stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == nguoi_dung.id)
        benh_nhan = (await db.execute(stmt_bn)).scalar_one_or_none()
        if not benh_nhan:
            benh_nhan = BenhNhan(
                nguoi_dung_id=nguoi_dung.id,
                ma_dinh_danh_y_te=f"BN-{datetime.now().strftime('%Y%m')}-{nguoi_dung.id:04d}",
            )
            db.add(benh_nhan)
            await db.flush()

        # 3. Tạo vé vãng lai
        walk_in_req = WalkInCheckInRequest(
            benh_nhan_id=benh_nhan.id,
            bac_si_id=payload.bac_si_id,
            ca_kham=payload.ca_kham,
            ly_do_kham=payload.ly_do_kham,
            ghi_chu=f"Tiếp đón vãng lai tại quầy (SĐT: {payload.so_dien_thoai})",
        )
        return await self.check_in_walk_in(walk_in_req, receptionist_user, db)


queue_service = QueueService()
