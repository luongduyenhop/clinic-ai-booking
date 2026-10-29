import logging
from datetime import date, datetime, time, timezone, timedelta
from typing import List, Optional
from sqlalchemy import func, select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    ConflictException,
)
from app.models.appointment import (
    HangDoiKham,
    LichKham,
    LichLamViec,
    LichDinhKyBacSi,
    CaLamViecEnum,
    LoaiHangDoiEnum,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
)
from app.models.user import BacSi, BenhNhan, NguoiDung, TaiKhoan, VaiTroEnum, PhongKham, ChuyenKhoa
from app.models.specialized import DangKyGoiKham, GoiDichVu
from app.schemas.queue import (
    CheckInRequest,
    WalkInCheckInRequest,
    WalkInQuickRequest,
    QueueTicketResponse,
    CloseTicketRequest,
    CloseTicketResponse,
    CallNextResponse,
    DoctorQueueBoardResponse,
    PatientFlowBoardItem,
    PatientFlowBoardResponse,
    AppointmentReceptionSearchResult,
    ShiftDashboardResponse,
    RoomStatusItem,
    RoomStatusDashboardResponse,
    ReceptionAppointmentItem,
    ReceptionAppointmentsResponse,
    RosterItem,
    RoomResourceItem,
    RosterTemplateItem,
    PatientPackageItem,
    PatientPastVisitItem,
    PatientHistorySummaryResponse,
    ProcessNoShowResponse,
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
            thoi_gian_xep_hang_lai=ticket.thoi_gian_xep_hang_lai,
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

        # FC-06: Check-in lịch hẹn nhánh B (Lịch chưa chọn bác sĩ -> Load Balancing theo chuyên khoa)
        if lich.bac_si_id is None:
            ca_kham = lich.ca_kham or self._determine_shift(now.time())
            if not lich.chuyen_khoa_id:
                raise BadRequestException("Lịch hẹn chưa chọn bác sĩ thiếu thông tin chuyên khoa để phân bổ!")
            from app.services.load_balancing_service import load_balancing_service
            assigned_doc_id = await load_balancing_service.assign_optimal_doctor(
                chuyen_khoa_id=lich.chuyen_khoa_id,
                ca_kham=ca_kham,
                ngay_kham=lich.ngay_kham,
                db=db
            )
            lich.bac_si_id = assigned_doc_id
            if lich.gio_kham is None:
                lich.gio_kham = now.time()
            stmt_bs = (
                select(BacSi)
                .options(selectinload(BacSi.nguoi_dung), selectinload(BacSi.chuyen_khoa))
                .where(BacSi.id == assigned_doc_id)
            )
            lich.bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()
        else:
            ca_kham = self._determine_shift(lich.gio_kham) if lich.gio_kham else (lich.ca_kham or self._determine_shift(now.time()))

        # 4. Xác định loại hàng đợi và độ ưu tiên (Arrival Window Logic & FC-08 LyDoUuTien)
        if payload.ly_do_uu_tien:
            muc_do_uu_tien = 1
            loai_hang_doi = LoaiHangDoiEnum.DUNG_HEN.value
            ghi_chu_priority = f"Ưu tiên ({payload.ly_do_uu_tien.value})"
            ghi_chu = f"{ghi_chu_priority} | {payload.ghi_chu}".strip(" | ") if payload.ghi_chu else ghi_chu_priority
        else:
            clinic_tz = timezone(timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS))
            now_clinic = datetime.now(clinic_tz).replace(tzinfo=None)
            gio_hen = lich.gio_kham or now.time()
            appointment_dt = datetime.combine(lich.ngay_kham, gio_hen)
            diff_minutes = (appointment_dt - now_clinic).total_seconds() / 60

            if diff_minutes > 30:
                # Đến sớm hơn 30 phút so với giờ hẹn -> xếp ưu tiên 4
                loai_hang_doi = LoaiHangDoiEnum.DEN_SOM.value
                muc_do_uu_tien = 4
            elif diff_minutes < -30:
                # Đến muộn hơn 30 phút sau giờ hẹn -> xếp ưu tiên 5 (ngang vãng lai)
                loai_hang_doi = LoaiHangDoiEnum.DEN_MUON.value
                muc_do_uu_tien = 5
            else:
                # Đúng khung giờ hẹn (từ trước 30p đến trễ tối đa 30p) -> ưu tiên 2 tiêu chuẩn
                loai_hang_doi = LoaiHangDoiEnum.DUNG_HEN.value
                muc_do_uu_tien = 2
            ghi_chu = payload.ghi_chu

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
            ghi_chu_dieu_phoi=ghi_chu,
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
        """Lễ tân tiếp nhận bệnh nhân vãng lai (lễ tân chọn bác sĩ hoặc hệ thống auto-assign theo khoa)"""
        if receptionist_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chức năng tiếp nhận bệnh nhân vãng lai chỉ dành cho Lễ tân hoặc Admin!")

        # Kiểm tra bệnh nhân
        bn = (await db.execute(select(BenhNhan).where(BenhNhan.id == payload.benh_nhan_id))).scalar_one_or_none()
        if not bn:
            raise NotFoundException("Không tìm thấy thông tin bệnh nhân!")

        today = date.today()
        now = datetime.now(timezone.utc)

        # FC-07: Auto-assign nếu bac_si_id is None
        if payload.bac_si_id is None:
            if not payload.chuyen_khoa_id:
                raise BadRequestException("Vui lòng chọn bác sĩ tiếp nhận hoặc chuyên khoa để phân bổ tự động!")
            from app.services.load_balancing_service import load_balancing_service
            effective_doctor_id = await load_balancing_service.assign_optimal_doctor(
                chuyen_khoa_id=payload.chuyen_khoa_id,
                ca_kham=payload.ca_kham,
                ngay_kham=today,
                db=db
            )
        else:
            effective_doctor_id = payload.bac_si_id

        bs = (await db.execute(select(BacSi).where(BacSi.id == effective_doctor_id))).scalar_one_or_none()
        if not bs:
            raise NotFoundException("Không tìm thấy thông tin bác sĩ tiếp nhận!")

        # Kiểm tra ca làm việc và giới hạn công suất ca (gioi_han_ca_kham)
        stmt_shift = (
            select(LichLamViec)
            .where(
                LichLamViec.bac_si_id == effective_doctor_id,
                LichLamViec.ngay_lam_viec == today,
                LichLamViec.ca_lam_viec == payload.ca_kham,
                LichLamViec.is_active.is_(True),
            )
            .with_for_update()
        )
        shift = (await db.execute(stmt_shift)).scalar_one_or_none()
        if shift:
            # GAP-17: Kiểm tra hạn mức tiếp nhận vãng lai riêng biệt
            if shift.han_muc_vang_lai:
                stmt_count_walkin = select(func.count(HangDoiKham.id)).where(
                    HangDoiKham.bac_si_id == effective_doctor_id,
                    HangDoiKham.ngay_kham == today,
                    HangDoiKham.ca_kham == payload.ca_kham,
                    HangDoiKham.loai_hang_doi == LoaiHangDoiEnum.VANG_LAI.value,
                    HangDoiKham.trang_thai != TrangThaiHangDoiEnum.DA_DONG_VE.value,
                )
                count_walkin = (await db.execute(stmt_count_walkin)).scalar() or 0
                if count_walkin >= shift.han_muc_vang_lai:
                    raise ConflictException(
                        f"Bác sĩ đã tiếp nhận đủ chỉ tiêu vãng lai ca này ({count_walkin}/{shift.han_muc_vang_lai})!"
                    )

            if shift.gioi_han_ca_kham:
                stmt_count_shift = select(func.count(HangDoiKham.id)).where(
                    HangDoiKham.bac_si_id == effective_doctor_id,
                    HangDoiKham.ngay_kham == today,
                    HangDoiKham.ca_kham == payload.ca_kham,
                    HangDoiKham.trang_thai.notin_([
                        TrangThaiHangDoiEnum.BO_KHAM.value,
                        TrangThaiHangDoiEnum.DA_DONG_VE.value,
                    ]),
                )
                count_shift = (await db.execute(stmt_count_shift)).scalar() or 0
                if count_shift >= shift.gioi_han_ca_kham:
                    raise ConflictException(
                        f"Ca khám này của Bác sĩ đã đạt giới hạn tiếp nhận tối đa ({shift.gioi_han_ca_kham} người bệnh). "
                        "Không thể tiếp nhận thêm bệnh nhân vãng lai!"
                    )

        # Tính số thứ tự tiếp theo
        stmt_max_stt = select(func.coalesce(func.max(HangDoiKham.so_thu_tu_kham), 0)).where(
            HangDoiKham.bac_si_id == effective_doctor_id,
            HangDoiKham.ngay_kham == today,
            HangDoiKham.ca_kham == payload.ca_kham,
        )
        max_stt = (await db.execute(stmt_max_stt)).scalar()
        next_stt = max_stt + 1

        base_time = now.time()
        gio_kham_tai_cho = time(
            base_time.hour,
            base_time.minute,
            (next_stt * 7) % 60,
            microsecond=min(999999, next_stt * 1000)
        )
        ma_lich = f"LK-{today.strftime('%Y%m%d')}-WLK{effective_doctor_id:02d}{next_stt:03d}"
        lich_tai_cho = LichKham(
            ma_lich_kham=ma_lich,
            benh_nhan_id=payload.benh_nhan_id,
            bac_si_id=effective_doctor_id,
            chuyen_khoa_id=bs.chuyen_khoa_id,
            ca_kham=payload.ca_kham,
            ngay_kham=today,
            gio_kham=gio_kham_tai_cho,
            thoi_luong_phut=settings.SLOT_DURATION_MINUTES,
            so_thu_tu=next_stt,
            ly_do_kham=payload.ly_do_kham or "Tiếp đón vãng lai tại phòng khám",
            trieu_chung_ban_dau=payload.ly_do_kham,
            trang_thai=TrangThaiLichEnum.DA_TIEP_NHAN.value,
        )
        db.add(lich_tai_cho)
        await db.flush()

        # FC-08: Độ ưu tiên
        if payload.ly_do_uu_tien:
            muc_do_uu_tien = 1
            ghi_chu = f"Ưu tiên ({payload.ly_do_uu_tien.value}): {payload.ly_do_kham or 'Vãng lai ưu tiên'}"
        else:
            muc_do_uu_tien = 5
            ghi_chu = f"Vãng lai: {payload.ly_do_kham or 'Không ghi chú'}"

        if payload.ghi_chu:
            ghi_chu = f"{ghi_chu} | {payload.ghi_chu}"

        ticket = HangDoiKham(
            lich_kham_id=lich_tai_cho.id,
            benh_nhan_id=payload.benh_nhan_id,
            bac_si_id=effective_doctor_id,
            ngay_kham=today,
            ca_kham=payload.ca_kham,
            so_thu_tu_kham=next_stt,
            loai_hang_doi=LoaiHangDoiEnum.VANG_LAI.value,
            muc_do_uu_tien=muc_do_uu_tien,
            trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
            thoi_gian_check_in=now,
            so_lan_goi=0,
            nguoi_tiep_nhan_id=receptionist_user.id,
            ghi_chu_dieu_phoi=ghi_chu,
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

        # 0. Guard A4 (Concurrency & Khám đè):
        # Bác sĩ chỉ được phép khám đúng 1 bệnh nhân tại 1 thời điểm.
        # Nếu đang có ca 'dang_kham', bác sĩ phải hoàn tất hoặc tạm hoãn ca này trước khi gọi tiếp.
        stmt_current_active = (
            select(HangDoiKham)
            .where(
                HangDoiKham.bac_si_id == doctor_id,
                HangDoiKham.ngay_kham == today,
                HangDoiKham.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value,
            )
            .with_for_update()
        )
        current_active = (await db.execute(stmt_current_active)).scalars().first()
        if current_active:
            raise ConflictException(
                f"Bác sĩ hiện đang có một ca khám chưa hoàn tất (STT #{current_active.so_thu_tu_kham}). "
                f"Vui lòng hoàn tất hoặc tạm hoãn ca hiện tại trước khi gọi bệnh nhân tiếp theo!"
            )

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
                func.coalesce(HangDoiKham.thoi_gian_xep_hang_lai, HangDoiKham.thoi_gian_check_in).asc(),
                HangDoiKham.so_thu_tu_kham.asc(),       # STT nhỏ trước
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

    async def _get_ticket_entity(
        self, ticket_id: int, db: AsyncSession, for_update: bool = False
    ) -> Optional[HangDoiKham]:
        """Lấy thực thể ORM HangDoiKham kèm eager loading quan hệ đầy đủ"""
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
        if for_update:
            stmt = stmt.with_for_update()
        return (await db.execute(stmt)).scalar_one_or_none()

    async def postpone_ticket(
        self,
        ticket_id: int,
        doctor_user: TaiKhoan,
        db: AsyncSession,
    ) -> QueueTicketResponse:
        """Bác sĩ chuyển ca khám sang Tạm hoãn (sau 3 lần gọi không có mặt)"""
        ticket = await self._get_ticket_entity(ticket_id, db, for_update=True)
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

        ticket = await self._get_ticket_entity(ticket_id, db, for_update=True)
        if not ticket:
            raise NotFoundException(f"Không tìm thấy phiếu hàng đợi với ID {ticket_id}!")

        now = datetime.now(timezone.utc)
        ticket.trang_thai = TrangThaiHangDoiEnum.CHO_KHAM.value
        ticket.thoi_gian_xep_hang_lai = now
        ticket.muc_do_uu_tien = 4  # Khi quay lại, ưu tiên sau các ca đúng giờ
        ticket.ghi_chu_dieu_phoi = f"{ticket.ghi_chu_dieu_phoi or ''} | Phục hồi hàng đợi lúc {now.strftime('%H:%M:%S')}.".strip(" | ")
        await db.commit()
        await db.refresh(ticket)
        return self._to_ticket_response(ticket)

    async def close_ticket(
        self,
        ticket_id: int,
        ly_do: Optional[str],
        current_user: TaiKhoan,
        db: AsyncSession,
    ) -> CloseTicketResponse:
        """Lễ tân đóng vé hàng đợi vì lý do hành chính (DA_DONG_VE)"""
        if current_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chỉ Lễ tân hoặc Admin mới có quyền đóng vé hàng đợi!")

        ticket = await self._get_ticket_entity(ticket_id, db, for_update=True)
        if not ticket:
            raise NotFoundException(f"Không tìm thấy phiếu hàng đợi với ID {ticket_id}!")

        if ticket.trang_thai not in (TrangThaiHangDoiEnum.CHO_KHAM.value, TrangThaiHangDoiEnum.TAM_HOAN.value):
            raise ConflictException(f"Không thể đóng vé ở trạng thái '{ticket.trang_thai}'! Chỉ áp dụng cho vé đang chờ khám hoặc tạm hoãn.")

        now = datetime.now(timezone.utc)
        ticket.trang_thai = TrangThaiHangDoiEnum.DA_DONG_VE.value
        note = f"Đóng vé hành chính lúc {now.strftime('%H:%M:%S')}"
        if ly_do:
            note += f": {ly_do}"
        ticket.ghi_chu_dieu_phoi = f"{ticket.ghi_chu_dieu_phoi or ''} | {note}".strip(" | ")

        await db.commit()
        await db.refresh(ticket)
        return CloseTicketResponse(
            ticket_id=ticket.id,
            trang_thai=ticket.trang_thai,
            ghi_chu_dieu_phoi=ticket.ghi_chu_dieu_phoi,
            thoi_gian_dong=now,
        )

    async def patient_leave_queue(
        self,
        ticket_id: int,
        ly_do: Optional[str],
        current_user: TaiKhoan,
        db: AsyncSession,
    ) -> CloseTicketResponse:
        """Bệnh nhân xin bỏ về không khám (BO_KHAM)"""
        if current_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chỉ Lễ tân hoặc Admin mới có quyền cập nhật trạng thái bỏ khám!")

        ticket = await self._get_ticket_entity(ticket_id, db, for_update=True)
        if not ticket:
            raise NotFoundException(f"Không tìm thấy phiếu hàng đợi với ID {ticket_id}!")

        if ticket.trang_thai not in (TrangThaiHangDoiEnum.CHO_KHAM.value, TrangThaiHangDoiEnum.TAM_HOAN.value):
            raise ConflictException(f"Không thể đổi trạng thái vé ở '{ticket.trang_thai}'! Chỉ áp dụng cho vé đang chờ khám hoặc tạm hoãn.")

        now = datetime.now(timezone.utc)
        ticket.trang_thai = TrangThaiHangDoiEnum.BO_KHAM.value
        note = f"Bệnh nhân xin bỏ về lúc {now.strftime('%H:%M:%S')}"
        if ly_do:
            note += f": {ly_do}"
        ticket.ghi_chu_dieu_phoi = f"{ticket.ghi_chu_dieu_phoi or ''} | {note}".strip(" | ")

        await db.commit()
        await db.refresh(ticket)
        return CloseTicketResponse(
            ticket_id=ticket.id,
            trang_thai=ticket.trang_thai,
            ghi_chu_dieu_phoi=ticket.ghi_chu_dieu_phoi,
            thoi_gian_dong=now,
        )

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
            .order_by(
                HangDoiKham.muc_do_uu_tien.asc(),
                func.coalesce(HangDoiKham.thoi_gian_xep_hang_lai, HangDoiKham.thoi_gian_check_in).asc(),
                HangDoiKham.so_thu_tu_kham.asc()
            )
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
            chuyen_khoa_id=payload.chuyen_khoa_id,
            ca_kham=payload.ca_kham,
            ly_do_kham=payload.ly_do_kham,
            ghi_chu=f"Tiếp đón vãng lai tại quầy (SĐT: {payload.so_dien_thoai})",
            ly_do_uu_tien=payload.ly_do_uu_tien,
        )
        return await self.check_in_walk_in(walk_in_req, receptionist_user, db)

    async def get_shift_dashboard(
        self,
        query_date: Optional[date],
        ca_kham: Optional[str],
        db: AsyncSession
    ) -> ShiftDashboardResponse:
        """Báo cáo chỉ số vận hành ca trực theo thời gian thực (FC-10)"""
        now_dt = datetime.now()
        target_date = query_date or now_dt.date()
        target_ca = ca_kham or self._determine_shift(now_dt.time())

        # 1. Tổng hẹn trước (LichKham): ngay_kham = target_date, ca_kham = target_ca, trang_thai != DA_HUY
        stmt_apt = select(LichKham).where(
            and_(
                LichKham.ngay_kham == target_date,
                LichKham.trang_thai != TrangThaiLichEnum.DA_HUY.value,
            )
        )
        all_apts = (await db.execute(stmt_apt)).scalars().all()
        tong_hen_truoc = 0
        for apt in all_apts:
            apt_ca = apt.ca_kham
            if not apt_ca and apt.gio_kham:
                apt_ca = self._determine_shift(apt.gio_kham)
            if apt_ca == target_ca or not target_ca:
                tong_hen_truoc += 1

        # 2. Hàng đợi (HangDoiKham)
        stmt_q = select(HangDoiKham).where(
            and_(
                HangDoiKham.ngay_kham == target_date,
                HangDoiKham.ca_kham == target_ca,
            )
        )
        tickets = (await db.execute(stmt_q)).scalars().all()

        so_da_check_in = len(tickets)
        so_dang_cho = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value)
        so_dang_kham = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value)
        so_da_kham = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.DA_KHAM.value)
        so_tam_hoan = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.TAM_HOAN.value)
        so_vang_mat_chua_xu_ly = 0
        so_vang_lai = sum(1 for t in tickets if t.loai_hang_doi == LoaiHangDoiEnum.VANG_LAI.value)
        so_bo_kham = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.BO_KHAM.value)
        so_da_dong_ve = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.DA_DONG_VE.value)

        return ShiftDashboardResponse(
            ngay=target_date,
            ca_kham=target_ca,
            tong_hen_truoc=tong_hen_truoc,
            so_da_check_in=so_da_check_in,
            so_dang_cho=so_dang_cho,
            so_dang_kham=so_dang_kham,
            so_da_kham=so_da_kham,
            so_tam_hoan=so_tam_hoan,
            so_vang_mat_chua_xu_ly=so_vang_mat_chua_xu_ly,
            so_vang_lai=so_vang_lai,
            so_bo_kham=so_bo_kham,
            so_da_dong_ve=so_da_dong_ve,
        )

    async def get_room_status_dashboard(
        self,
        query_date: Optional[date],
        ca_kham: Optional[str],
        db: AsyncSession
    ) -> RoomStatusDashboardResponse:
        """Giám sát tình trạng buồng khám vật lý theo thời gian thực (FC-11)"""
        now_dt = datetime.now()
        target_date = query_date or now_dt.date()
        target_ca = ca_kham or self._determine_shift(now_dt.time())

        # Lấy tất cả buồng khám
        stmt_rooms = select(PhongKham).options(selectinload(PhongKham.chuyen_khoa)).order_by(PhongKham.ma_phong)
        rooms = (await db.execute(stmt_rooms)).scalars().all()

        # Lấy lịch làm việc trong ca đó để biết bác sĩ nào ngồi buồng nào
        stmt_llv = (
            select(LichLamViec)
            .options(
                selectinload(LichLamViec.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichLamViec.bac_si).selectinload(BacSi.chuyen_khoa),
            )
            .where(
                and_(
                    LichLamViec.ngay_lam_viec == target_date,
                    LichLamViec.ca_lam_viec == target_ca,
                    LichLamViec.is_active.is_(True),
                )
            )
        )
        rosters = (await db.execute(stmt_llv)).scalars().all()
        room_roster_map = {r.phong_kham_id: r for r in rosters if r.phong_kham_id}

        # Lấy các vé trong hàng đợi của ca
        stmt_q = (
            select(HangDoiKham)
            .options(selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung))
            .where(
                and_(
                    HangDoiKham.ngay_kham == target_date,
                    HangDoiKham.ca_kham == target_ca,
                )
            )
        )
        tickets = (await db.execute(stmt_q)).scalars().all()

        # Gom nhóm ticket theo bac_si_id
        doc_tickets = {}
        for t in tickets:
            doc_tickets.setdefault(t.bac_si_id, []).append(t)

        items: List[RoomStatusItem] = []
        for r in rooms:
            roster = room_roster_map.get(r.id)
            bac_si_id = roster.bac_si_id if roster else None
            ten_bac_si = roster.bac_si.nguoi_dung.ho_ten if (roster and roster.bac_si and roster.bac_si.nguoi_dung) else None
            chuyen_khoa_ten = (
                roster.bac_si.chuyen_khoa.ten_chuyen_khoa
                if (roster and roster.bac_si and roster.bac_si.chuyen_khoa)
                else (r.chuyen_khoa.ten_chuyen_khoa if r.chuyen_khoa else None)
            )

            so_benh_nhan_cho = 0
            benh_nhan_dang_kham = None
            if bac_si_id and bac_si_id in doc_tickets:
                b_tickets = doc_tickets[bac_si_id]
                so_benh_nhan_cho = sum(1 for t in b_tickets if t.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value)
                dang_kham_ticket = next((t for t in b_tickets if t.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value), None)
                if dang_kham_ticket and dang_kham_ticket.benh_nhan and dang_kham_ticket.benh_nhan.nguoi_dung:
                    benh_nhan_dang_kham = dang_kham_ticket.benh_nhan.nguoi_dung.ho_ten

            items.append(
                RoomStatusItem(
                    phong_kham_id=r.id,
                    ma_phong=r.ma_phong,
                    ten_phong=r.ten_phong,
                    tang=r.tang,
                    bac_si_id=bac_si_id,
                    ten_bac_si=ten_bac_si,
                    chuyen_khoa=chuyen_khoa_ten,
                    so_benh_nhan_cho=so_benh_nhan_cho,
                    benh_nhan_dang_kham=benh_nhan_dang_kham,
                    canh_bao_qua_tai=(so_benh_nhan_cho >= 5),
                )
            )

        return RoomStatusDashboardResponse(
            ngay=target_date,
            ca_kham=target_ca,
            tong_so_phong=len(items),
            danh_sach=items,
        )

    async def get_reception_appointments(
        self,
        query_date: Optional[date],
        ca_kham: Optional[str],
        bac_si_id: Optional[int],
        chuyen_khoa_id: Optional[int],
        trang_thai: Optional[str],
        search: Optional[str],
        page: int,
        page_size: int,
        db: AsyncSession
    ) -> ReceptionAppointmentsResponse:
        """Tra cứu lịch hẹn đa chiều góc nhìn Lễ tân (FC-12)"""
        conditions = []
        if query_date:
            conditions.append(LichKham.ngay_kham == query_date)
        if ca_kham:
            conditions.append(LichKham.ca_kham == ca_kham)
        if bac_si_id:
            conditions.append(LichKham.bac_si_id == bac_si_id)
        if chuyen_khoa_id:
            conditions.append(LichKham.chuyen_khoa_id == chuyen_khoa_id)
        if trang_thai:
            conditions.append(LichKham.trang_thai == trang_thai)

        stmt = (
            select(LichKham)
            .options(
                selectinload(LichKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(LichKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichKham.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(LichKham.chuyen_khoa),
            )
        )
        if conditions:
            stmt = stmt.where(and_(*conditions))

        if search:
            search_pattern = f"%{search.strip()}%"
            stmt = stmt.join(LichKham.benh_nhan).join(BenhNhan.nguoi_dung).where(
                or_(
                    LichKham.ma_lich_kham.ilike(search_pattern),
                    NguoiDung.ho_ten.ilike(search_pattern),
                    NguoiDung.so_dien_thoai.ilike(search_pattern),
                )
            )

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await db.execute(count_stmt)).scalar() or 0

        # Pagination & Ordering
        offset = (page - 1) * page_size
        stmt = stmt.order_by(LichKham.ngay_kham.desc(), LichKham.gio_kham.asc().nulls_last()).offset(offset).limit(page_size)
        apts = (await db.execute(stmt)).scalars().all()

        apt_ids = [a.id for a in apts]
        tickets_map = {}
        if apt_ids:
            q_stmt = select(HangDoiKham).where(HangDoiKham.lich_kham_id.in_(apt_ids))
            q_res = (await db.execute(q_stmt)).scalars().all()
            for t in q_res:
                tickets_map[t.lich_kham_id] = t

        items: List[ReceptionAppointmentItem] = []
        for a in apts:
            t = tickets_map.get(a.id)
            ck_name = (
                a.chuyen_khoa.ten_chuyen_khoa
                if a.chuyen_khoa
                else (a.bac_si.chuyen_khoa.ten_chuyen_khoa if a.bac_si and a.bac_si.chuyen_khoa else None)
            )
            phong = a.bac_si.chuyen_khoa.vi_tri_phong if a.bac_si and a.bac_si.chuyen_khoa else None
            items.append(
                ReceptionAppointmentItem(
                    id=a.id,
                    ma_lich_kham=a.ma_lich_kham,
                    benh_nhan_id=a.benh_nhan_id,
                    ten_benh_nhan=a.benh_nhan.nguoi_dung.ho_ten if a.benh_nhan and a.benh_nhan.nguoi_dung else "N/A",
                    so_dien_thoai=a.benh_nhan.nguoi_dung.so_dien_thoai if a.benh_nhan and a.benh_nhan.nguoi_dung else None,
                    bac_si_id=a.bac_si_id,
                    ten_bac_si=a.bac_si.nguoi_dung.ho_ten if a.bac_si and a.bac_si.nguoi_dung else None,
                    chuyen_khoa_id=a.chuyen_khoa_id,
                    ten_chuyen_khoa=ck_name,
                    phong_kham=phong,
                    ngay_kham=a.ngay_kham,
                    gio_kham=a.gio_kham.strftime("%H:%M") if a.gio_kham else None,
                    ca_kham=a.ca_kham,
                    trang_thai_lich=a.trang_thai,
                    trang_thai_hang_doi=t.trang_thai if t else None,
                    so_thu_tu_kham=t.so_thu_tu_kham if t else None,
                    ticket_id=t.id if t else None,
                )
            )

        return ReceptionAppointmentsResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=items,
        )

    async def get_roster_resources(
        self,
        query_date: Optional[date],
        ca_kham: Optional[str],
        db: AsyncSession
    ) -> List[RosterItem]:
        """Tra cứu lịch phân ca trực thực tế trong ngày (FC-15)"""
        target_date = query_date or datetime.now().date()
        stmt = (
            select(LichLamViec)
            .options(
                selectinload(LichLamViec.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichLamViec.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(LichLamViec.phong_kham),
            )
            .where(LichLamViec.ngay_lam_viec == target_date)
        )
        if ca_kham:
            stmt = stmt.where(LichLamViec.ca_lam_viec == ca_kham)

        rosters = (await db.execute(stmt)).scalars().all()
        return [
            RosterItem(
                lich_lam_viec_id=r.id,
                bac_si_id=r.bac_si_id,
                ten_bac_si=r.bac_si.nguoi_dung.ho_ten if r.bac_si and r.bac_si.nguoi_dung else "N/A",
                chuyen_khoa=r.bac_si.chuyen_khoa.ten_chuyen_khoa if r.bac_si and r.bac_si.chuyen_khoa else "N/A",
                phong_kham_id=r.phong_kham_id,
                ten_phong=r.phong_kham.ten_phong if r.phong_kham else None,
                ngay_lam_viec=r.ngay_lam_viec,
                ca_lam_viec=r.ca_lam_viec,
                gio_bat_dau=r.gio_bat_dau.strftime("%H:%M") if r.gio_bat_dau else "",
                gio_ket_thuc=r.gio_ket_thuc.strftime("%H:%M") if r.gio_ket_thuc else "",
                is_active=r.is_active,
            )
            for r in rosters
        ]

    async def get_rooms_resources(
        self,
        chuyen_khoa_id: Optional[int],
        db: AsyncSession
    ) -> List[RoomResourceItem]:
        """Tra cứu danh sách buồng khám vật lý và phân khoa (FC-15)"""
        stmt = select(PhongKham).options(selectinload(PhongKham.chuyen_khoa)).order_by(PhongKham.ma_phong)
        if chuyen_khoa_id:
            stmt = stmt.where(PhongKham.chuyen_khoa_id == chuyen_khoa_id)
        rooms = (await db.execute(stmt)).scalars().all()
        return [
            RoomResourceItem(
                id=rm.id,
                ma_phong=rm.ma_phong,
                ten_phong=rm.ten_phong,
                chuyen_khoa_id=rm.chuyen_khoa_id,
                ten_chuyen_khoa=rm.chuyen_khoa.ten_chuyen_khoa if rm.chuyen_khoa else None,
                tang=rm.tang,
                loai_phong=rm.loai_phong,
                is_active=rm.is_active,
            )
            for rm in rooms
        ]

    async def get_roster_template_resources(
        self,
        thu_trong_tuan: Optional[int],
        db: AsyncSession
    ) -> List[RosterTemplateItem]:
        """Tra cứu khung phân ca trực định kỳ theo tuần (FC-15)"""
        stmt = (
            select(LichDinhKyBacSi)
            .options(
                selectinload(LichDinhKyBacSi.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichDinhKyBacSi.phong_kham),
            )
            .order_by(LichDinhKyBacSi.thu_trong_tuan, LichDinhKyBacSi.ca_lam_viec)
        )
        if thu_trong_tuan:
            stmt = stmt.where(LichDinhKyBacSi.thu_trong_tuan == thu_trong_tuan)
        templates = (await db.execute(stmt)).scalars().all()
        return [
            RosterTemplateItem(
                id=tmpl.id,
                bac_si_id=tmpl.bac_si_id,
                ten_bac_si=tmpl.bac_si.nguoi_dung.ho_ten if tmpl.bac_si and tmpl.bac_si.nguoi_dung else "N/A",
                thu_trong_tuan=tmpl.thu_trong_tuan,
                ca_lam_viec=tmpl.ca_lam_viec,
                gio_bat_dau=tmpl.gio_bat_dau.strftime("%H:%M") if tmpl.gio_bat_dau else "",
                gio_ket_thuc=tmpl.gio_ket_thuc.strftime("%H:%M") if tmpl.gio_ket_thuc else "",
                phong_kham=tmpl.phong_kham.ten_phong if tmpl.phong_kham else None,
                is_active=tmpl.is_active,
            )
            for tmpl in templates
        ]

    async def get_patient_packages(self, benh_nhan_id: int, db: AsyncSession) -> List[PatientPackageItem]:
        """Tra cứu danh sách gói khám bệnh nhân đã mua và hạn mức sử dụng (FC-17)"""
        stmt_bn = select(BenhNhan).where(BenhNhan.id == benh_nhan_id)
        bn = (await db.execute(stmt_bn)).scalar_one_or_none()
        if not bn:
            raise NotFoundException(f"Không tìm thấy bệnh nhân ID {benh_nhan_id}!")

        stmt = (
            select(DangKyGoiKham)
            .options(selectinload(DangKyGoiKham.goi_dich_vu))
            .where(DangKyGoiKham.benh_nhan_id == benh_nhan_id)
            .order_by(DangKyGoiKham.created_at.desc())
        )
        packages = (await db.execute(stmt)).scalars().all()
        today = date.today()

        results = []
        for pkg in packages:
            is_con_han = (pkg.han_su_dung >= today) and (pkg.trang_thai == "DANG_SU_DUNG")
            so_con_lai = max(0, pkg.tong_so_dich_vu - pkg.so_dich_vu_da_dung)
            results.append(
                PatientPackageItem(
                    id=pkg.id,
                    ma_dang_ky=pkg.ma_dang_ky,
                    ten_goi=pkg.goi_dich_vu.ten_goi if pkg.goi_dich_vu else "N/A",
                    ma_goi=pkg.goi_dich_vu.ma_goi if pkg.goi_dich_vu else "N/A",
                    ngay_dang_ky=pkg.ngay_dang_ky,
                    han_su_dung=pkg.han_su_dung,
                    tong_so_dich_vu=pkg.tong_so_dich_vu,
                    so_dich_vu_da_dung=pkg.so_dich_vu_da_dung,
                    so_dich_vu_con_lai=so_con_lai,
                    trang_thai=pkg.trang_thai,
                    is_con_han=is_con_han,
                )
            )
        return results

    async def get_patient_history_summary(self, benh_nhan_id: int, db: AsyncSession) -> PatientHistorySummaryResponse:
        """Tóm tắt lịch sử khám và thông tin phục vụ tiếp đón tại quầy (FC-17)"""
        stmt_bn = (
            select(BenhNhan)
            .options(selectinload(BenhNhan.nguoi_dung))
            .where(BenhNhan.id == benh_nhan_id)
        )
        bn = (await db.execute(stmt_bn)).scalar_one_or_none()
        if not bn:
            raise NotFoundException(f"Không tìm thấy bệnh nhân ID {benh_nhan_id}!")

        # 1. Lấy gói khám
        packages = await self.get_patient_packages(benh_nhan_id, db)

        # 2. Lấy các lượt khám gần đây
        stmt_apts = (
            select(LichKham)
            .options(
                selectinload(LichKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichKham.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(LichKham.chuyen_khoa),
            )
            .where(LichKham.benh_nhan_id == benh_nhan_id)
            .order_by(LichKham.ngay_kham.desc())
            .limit(10)
        )
        apts = (await db.execute(stmt_apts)).scalars().all()

        visits = []
        for a in apts:
            bs_name = a.bac_si.nguoi_dung.ho_ten if (a.bac_si and a.bac_si.nguoi_dung) else None
            ck_name = (
                a.chuyen_khoa.ten_chuyen_khoa
                if a.chuyen_khoa
                else (a.bac_si.chuyen_khoa.ten_chuyen_khoa if a.bac_si and a.bac_si.chuyen_khoa else None)
            )
            visits.append(
                PatientPastVisitItem(
                    ngay_kham=a.ngay_kham,
                    bac_si=bs_name,
                    chuyen_khoa=ck_name,
                    chan_doan=a.ly_do_kham,
                    trang_thai=a.trang_thai,
                )
            )

        count_stmt = select(func.count(LichKham.id)).where(
            LichKham.benh_nhan_id == benh_nhan_id,
            LichKham.trang_thai.in_([TrangThaiLichEnum.DA_KHAM.value, TrangThaiLichEnum.DA_TIEP_NHAN.value]),
        )
        so_lan_kham = (await db.execute(count_stmt)).scalar() or 0

        return PatientHistorySummaryResponse(
            benh_nhan_id=bn.id,
            ma_dinh_danh_y_te=bn.ma_dinh_danh_y_te,
            ho_ten=bn.nguoi_dung.ho_ten if bn.nguoi_dung else "N/A",
            so_dien_thoai=bn.nguoi_dung.so_dien_thoai if bn.nguoi_dung else None,
            so_lan_no_show=bn.so_lan_no_show,
            is_blocked_booking=bn.is_blocked_booking,
            so_lan_kham=so_lan_kham,
            lich_su_kham_gan_day=visits,
            goi_kham_hien_co=packages,
        )

    async def process_no_shows_end_of_shift(
        self,
        query_date: Optional[date],
        ca_kham: Optional[str],
        current_user: TaiKhoan,
        db: AsyncSession,
    ) -> ProcessNoShowResponse:
        """Quét và xử lý bệnh nhân vắng mặt no-show cuối ca (FC-18)"""
        if current_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chức năng chỉ dành cho Lễ tân hoặc Quản trị viên!")

        target_date = query_date or datetime.now().date()

        stmt = (
            select(LichKham)
            .options(selectinload(LichKham.benh_nhan))
            .where(
                and_(
                    LichKham.ngay_kham == target_date,
                    LichKham.trang_thai.in_([
                        TrangThaiLichEnum.DA_XAC_NHAN.value,
                        TrangThaiLichEnum.CHO_XAC_NHAN.value,
                    ]),
                )
            )
            .with_for_update()
        )
        if ca_kham:
            stmt = stmt.where(LichKham.ca_kham == ca_kham)

        apts = (await db.execute(stmt)).scalars().all()
        no_show_codes = []
        blocked_count = 0
        now = datetime.now(timezone.utc)

        for apt in apts:
            apt.trang_thai = TrangThaiLichEnum.NO_SHOW.value
            apt.thoi_gian_huy = now
            apt.ly_do_huy = "Không đến khám đúng hẹn (No-show cuối ca)"
            apt.nguoi_huy_vai_tro = current_user.vai_tro
            no_show_codes.append(apt.ma_lich_kham)

            if apt.benh_nhan:
                apt.benh_nhan.so_lan_no_show += 1
                if apt.benh_nhan.so_lan_no_show >= 3 and not apt.benh_nhan.is_blocked_booking:
                    apt.benh_nhan.is_blocked_booking = True
                    blocked_count += 1

        await db.commit()

        return ProcessNoShowResponse(
            ngay=target_date,
            ca_kham=ca_kham,
            tong_so_no_show=len(no_show_codes),
            danh_sach_ma_lich=no_show_codes,
            so_benh_nhan_bi_khoa_moi=blocked_count,
        )


queue_service = QueueService()
