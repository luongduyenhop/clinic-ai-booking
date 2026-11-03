import logging

import uuid

from datetime import date, datetime, time, timezone, timedelta

from typing import List, Optional, Union, Any

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
    DanhSachCho,
    TrangThaiWaitlistEnum,

)

from app.models.user import BacSi, BenhNhan, ChuyenKhoa, NguoiDung, TaiKhoan, VaiTroEnum, PhongKham

from app.services.appointment_service import clinic_now

from app.models.specialized import DangKyGoiKham, GoiDichVu
from app.models.medical import KhoaSoCaTruc

from app.schemas.queue import (
    ReceptionWaitlistItem,
    ReceptionWaitlistResponse,

    CheckInRequest,

    WalkInCheckInRequest,

    WalkInQuickRequest,

    QueueTicketResponse,

    CloseTicketRequest,

    TransferTicketRequest,

    CloseTicketResponse,

    CallNextResponse,

    DoctorQueueBoardResponse,

    PatientFlowBoardItem,

    PatientFlowBoardResponse,

    AppointmentReceptionSearchResult,

    HourlyCheckInDensityItem,
    UpcomingAppointmentSummaryItem,
    LongWaitingTicketItem,
    ReceptionActivityItem,
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
    ReceptionReportKpiItem,
    DepartmentDistributionItem,
    ReceptionReportSummaryResponse,
    ReceptionAuditLogItem,
    ReceptionAuditLogPagination,
    ReceptionAuditLogResponse,
    PreCloseAuditWarningSummary,
    PreCloseExaminingDetailItem,
    PreCloseWaitingDetailItem,
    PreCloseDeferredDetailItem,
    PreCloseNoShowDetailItem,
    PreCloseWaitlistDetailItem,
    PreCloseCashierAuditDetail,
    PreCloseAuditDetailGroup,
    PreCloseActionRecommendation,
    PreCloseShiftAuditResponse,
    CloseReceptionShiftRequest,
    CloseReceptionShiftResponse,

)



logger = logging.getLogger(__name__)





class QueueService:

    """Nghiệp vụ Điều phối Hàng đợi & Tiếp đón tại phòng khám (OpenMRS / Bahmni Queue Pattern)"""



    def _determine_shift(self, t: time) -> str:

        """Xác định ca làm việc sáng/chiều dựa trên khung giờ"""

        if t < time(12, 30):

            return CaLamViecEnum.SANG.value

        return CaLamViecEnum.CHIEU.value



    def _generate_queue_code(self, ticket: HangDoiKham) -> str:

        """Sinh mã STT theo tiền tố buồng khám / chuyên khoa (ví dụ: NOI-01, TMH-02, RHM-01)"""

        stt = ticket.so_thu_tu_kham or 1

        prefix = "PK"



        # 1. Ưu tiên tiền tố từ Chuyên khoa của Bác sĩ phụ trách buồng khám

        if ticket.bac_si and ticket.bac_si.chuyen_khoa:

            ck = ticket.bac_si.chuyen_khoa

            ma_ck = (ck.ma_chuyen_khoa or "").upper().strip()

            ten_ck = (ck.ten_chuyen_khoa or "").lower()



            prefix_map = {

                "KHOA_NOI": "NOI",

                "KHOA_TMH": "TMH",

                "KHOA_RHM": "RHM",

                "KHOA_DA_LIEU": "DL",

                "KHOA_TIM_MACH": "TM",

                "KHOA_TIEU_HOA": "TH",

                "KHOA_THAN_KINH": "TK",

                "KHOA_HO_HAP": "HH",

                "KHOA_XUONG_KHOP": "XK",

                "KHOA_MAT": "MAT",

                "KHOA_NGOAI": "NGOAI",

                "KHOA_NHI": "NHI",

                "KHOA_SAN": "SAN",

            }

            if ma_ck in prefix_map:

                prefix = prefix_map[ma_ck]

            elif "tai mũi họng" in ten_ck or "tai - mũi - họng" in ten_ck:

                prefix = "TMH"

            elif "răng hàm mặt" in ten_ck or "răng - hàm - mặt" in ten_ck:

                prefix = "RHM"

            elif "da liễu" in ten_ck:

                prefix = "DL"

            elif "nội" in ten_ck:

                prefix = "NOI"

            elif "ngoại" in ten_ck:

                prefix = "NGOAI"

            elif "mắt" in ten_ck:

                prefix = "MAT"

            elif ma_ck:

                cleaned = ma_ck.replace("KHOA_", "").replace("KHOA-", "").replace("CK_", "").replace("CK-", "")

                prefix = cleaned[:5] if cleaned else "PK"



        return f"{prefix}-{stt:02d}"



    def _to_ticket_response(self, ticket: HangDoiKham) -> QueueTicketResponse:

        """Chuyển đổi thực thể HangDoiKham sang DTO QueueTicketResponse kèm chỉ số Flow Board"""

        ten_bn = ticket.benh_nhan.nguoi_dung.ho_ten if ticket.benh_nhan and ticket.benh_nhan.nguoi_dung else None

        sdt_bn = ticket.benh_nhan.nguoi_dung.so_dien_thoai if ticket.benh_nhan and ticket.benh_nhan.nguoi_dung else None

        ten_bs = ticket.bac_si.nguoi_dung.ho_ten if ticket.bac_si and ticket.bac_si.nguoi_dung else None

        phong = None

        phong_id = None

        if ticket.phong_kham:

            phong_id = ticket.phong_kham.id

            phong = f"{ticket.phong_kham.ten_phong} ({ticket.phong_kham.ma_phong})"

        elif ticket.bac_si and ticket.bac_si.phong_kham:

            phong_id = ticket.bac_si.phong_kham.id

            phong = f"{ticket.bac_si.phong_kham.ten_phong} ({ticket.bac_si.phong_kham.ma_phong})"

        elif ticket.bac_si and ticket.bac_si.chuyen_khoa and ticket.bac_si.chuyen_khoa.vi_tri_phong:

            phong = ticket.bac_si.chuyen_khoa.vi_tri_phong



        ck_id = None

        ck_name = None

        if ticket.bac_si and ticket.bac_si.chuyen_khoa:

            ck_id = ticket.bac_si.chuyen_khoa.id

            ck_name = ticket.bac_si.chuyen_khoa.ten_chuyen_khoa

        elif ticket.lich_kham and ticket.lich_kham.chuyen_khoa:

            ck_id = ticket.lich_kham.chuyen_khoa.id

            ck_name = ticket.lich_kham.chuyen_khoa.ten_chuyen_khoa



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

            # Mốc tính thời gian chờ: Ưu tiên thoi_gian_xep_hang_lai (vé chuyển từ sáng sang chiều)
            start_wait = cin
            if ticket.thoi_gian_xep_hang_lai:
                xhl = ticket.thoi_gian_xep_hang_lai
                if xhl.tzinfo is None:
                    xhl = xhl.replace(tzinfo=timezone.utc)
                start_wait = xhl
            elif ticket.ngay_kham and cin.date() < ticket.ngay_kham:
                start_wait = datetime.combine(ticket.ngay_kham, datetime.min.time(), tzinfo=timezone.utc).replace(hour=0, minute=30)

            # Điểm chốt thời gian chờ:
            # 1. Đang khám: chốt tại thời điểm bác sĩ gọi / bắt đầu khám
            if ticket.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value:
                end_wait = ticket.thoi_gian_bat_dau or ticket.thoi_gian_goi_kham or now
                if end_wait.tzinfo is None:
                    end_wait = end_wait.replace(tzinfo=timezone.utc)
                thoi_gian_cho = max(0, int((end_wait - start_wait).total_seconds() / 60))
            # 2. Đã khám: chốt tại thời điểm vào khám (thoi_gian_bat_dau)
            elif ticket.trang_thai == TrangThaiHangDoiEnum.DA_KHAM.value:
                end_wait = ticket.thoi_gian_bat_dau or ticket.thoi_gian_goi_kham or ticket.thoi_gian_ket_thuc or ticket.updated_at or start_wait
                if end_wait.tzinfo is None:
                    end_wait = end_wait.replace(tzinfo=timezone.utc)
                thoi_gian_cho = max(0, int((end_wait - start_wait).total_seconds() / 60))
            # 3. Bỏ khám hoặc Đã đóng vé: chốt tại thời điểm rời đi (updated_at)
            elif ticket.trang_thai in (TrangThaiHangDoiEnum.BO_KHAM.value, TrangThaiHangDoiEnum.DA_DONG_VE.value):
                end_wait = ticket.updated_at or start_wait
                if end_wait.tzinfo is None:
                    end_wait = end_wait.replace(tzinfo=timezone.utc)
                thoi_gian_cho = max(0, int((end_wait - start_wait).total_seconds() / 60))
            # 4. Đang chờ khám hoặc Tạm hoãn: thời gian chờ tính đến thời điểm hiện tại
            else:
                thoi_gian_cho = max(0, int((now - start_wait).total_seconds() / 60))



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

            phong_kham_id=phong_id,

            chuyen_khoa_id=ck_id,

            ten_chuyen_khoa=ck_name,

            ngay_kham=ticket.ngay_kham,

            ca_kham=ticket.ca_kham,

            so_thu_tu_kham=ticket.so_thu_tu_kham,

            ma_so_thu_tu=self._generate_queue_code(ticket),

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

        today_date = clinic_now().date()

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

            return await self._get_ticket_with_relations(existing_ticket.id, db)



        now = datetime.now(timezone.utc)



        # FC-06: Check-in lịch hẹn nhánh B (Lịch chưa chọn bác sĩ -> Load Balancing theo chuyên khoa)

        if lich.bac_si_id is None:

            ca_kham = lich.ca_kham or self._determine_shift(clinic_now().time())

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

                lich.gio_kham = clinic_now().time()

            stmt_bs = (

                select(BacSi)

                .options(selectinload(BacSi.nguoi_dung), selectinload(BacSi.chuyen_khoa))

                .where(BacSi.id == assigned_doc_id)

            )

            lich.bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()

        else:

            ca_kham = self._determine_shift(lich.gio_kham) if lich.gio_kham else (lich.ca_kham or self._determine_shift(clinic_now().time()))



        # 4. Xác định loại hàng đợi và độ ưu tiên (Arrival Window Logic & FC-08 LyDoUuTien)

        if payload.ly_do_uu_tien:

            muc_do_uu_tien = 1

            loai_hang_doi = LoaiHangDoiEnum.DUNG_HEN.value

            ly_do_str = payload.ly_do_uu_tien.value if hasattr(payload.ly_do_uu_tien, "value") else str(payload.ly_do_uu_tien)

            ghi_chu_priority = f"Ưu tiên ({ly_do_str})"

            ghi_chu = f"{ghi_chu_priority} | {payload.ghi_chu}".strip(" | ") if payload.ghi_chu else ghi_chu_priority

        else:

            clinic_tz = timezone(timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS))

            now_clinic = datetime.now(clinic_tz).replace(tzinfo=None)

            gio_hen = lich.gio_kham or now_clinic.time()

            appointment_dt = datetime.combine(lich.ngay_kham, gio_hen)

            diff_minutes = (appointment_dt - now_clinic).total_seconds() / 60



            # Xử lý trường hợp khung giờ cận nửa đêm (Midnight Wraparound):

            if lich.ngay_kham == now_clinic.date():

                if now_clinic.hour >= 20 and gio_hen.hour < 4:

                    diff_minutes += 1440

                elif now_clinic.hour < 4 and gio_hen.hour >= 20:

                    diff_minutes -= 1440



            if diff_minutes > 30:

                # Đến sớm hơn 30 phút so với giờ hẹn -> xếp ưu tiên 4

                loai_hang_doi = LoaiHangDoiEnum.DEN_SOM.value

                muc_do_uu_tien = 4

            elif diff_minutes < -15:

                # Đến muộn hơn 15 phút sau giờ hẹn -> xếp ưu tiên 5 (ngang vãng lai)

                loai_hang_doi = LoaiHangDoiEnum.DEN_MUON.value

                muc_do_uu_tien = 5

            else:

                # Đúng khung giờ hẹn (từ trước 30p đến trễ tối đa 15p) -> ưu tiên 2 tiêu chuẩn

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

        room_id_cin = lich.bac_si.phong_kham_id if (lich.bac_si and lich.bac_si.phong_kham_id) else None

        ticket = HangDoiKham(

            lich_kham_id=lich.id,

            benh_nhan_id=lich.benh_nhan_id,

            bac_si_id=lich.bac_si_id,

            phong_kham_id=room_id_cin,

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
        """Lễ tân tiếp nhận bệnh nhân vãng lai (hỗ trợ bệnh nhân cũ theo ID hoặc nhập nhanh Họ tên + SĐT, có Waitlist khi quá tải)"""
        if receptionist_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chức năng tiếp nhận bệnh nhân vãng lai chỉ dành cho Lễ tân hoặc Admin!")

        today = clinic_now().date()
        now = datetime.now(timezone.utc)
        effective_ca = payload.ca_kham or self._determine_shift(clinic_now().time())

        # 1. Xác định hoặc tự động tạo hồ sơ bệnh nhân
        bn = None
        if payload.benh_nhan_id:
            stmt_bn = (
                select(BenhNhan)
                .options(selectinload(BenhNhan.nguoi_dung))
                .where(BenhNhan.id == payload.benh_nhan_id)
            )
            bn = (await db.execute(stmt_bn)).scalar_one_or_none()
            if not bn:
                raise NotFoundException("Không tìm thấy thông tin bệnh nhân!")
            effective_benh_nhan_id = bn.id
        else:
            # Nhập nhanh: Tìm hoặc tạo NguoiDung + BenhNhan
            clean_phone = payload.so_dien_thoai.strip().replace(" ", "")
            clean_name = payload.ho_ten.strip()

            stmt_nd = select(NguoiDung).where(NguoiDung.so_dien_thoai == clean_phone)
            nguoi_dung = (await db.execute(stmt_nd)).scalar_one_or_none()
            dob = date(payload.nam_sinh, 1, 1) if payload.nam_sinh else None
            if not nguoi_dung:
                nguoi_dung = NguoiDung(
                    ho_ten=clean_name,
                    email=None,
                    so_dien_thoai=clean_phone,
                    gioi_tinh=payload.gioi_tinh or "Khác",
                    ngay_sinh=dob,
                )
                db.add(nguoi_dung)
                await db.flush()
            else:
                if clean_name and (not nguoi_dung.ho_ten or nguoi_dung.ho_ten == "Bệnh nhân"):
                    nguoi_dung.ho_ten = clean_name
                if dob and not nguoi_dung.ngay_sinh:
                    nguoi_dung.ngay_sinh = dob
                if payload.gioi_tinh and (not nguoi_dung.gioi_tinh or nguoi_dung.gioi_tinh == "Khác"):
                    nguoi_dung.gioi_tinh = payload.gioi_tinh

            stmt_bn = (
                select(BenhNhan)
                .options(selectinload(BenhNhan.nguoi_dung))
                .where(BenhNhan.nguoi_dung_id == nguoi_dung.id)
            )
            bn = (await db.execute(stmt_bn)).scalar_one_or_none()
            if not bn:
                bn = BenhNhan(
                    nguoi_dung_id=nguoi_dung.id,
                    ma_dinh_danh_y_te=f"BN-{datetime.now().strftime('%Y%m')}-{nguoi_dung.id:04d}",
                )
                db.add(bn)
                await db.flush()
                # Reload with relationship
                bn = (await db.execute(stmt_bn)).scalar_one_or_none()

            effective_benh_nhan_id = bn.id

        # 2. Validation Logic Phân bổ Bác sĩ (Critical):
        if payload.bac_si_id is None and not payload.chuyen_khoa_id:
            raise BadRequestException("Vui lòng chọn bác sĩ tiếp nhận hoặc chuyên khoa để phân bổ tự động!")

        if payload.chuyen_khoa_id:
            stmt_ck = select(ChuyenKhoa).where(ChuyenKhoa.id == payload.chuyen_khoa_id)
            ck = (await db.execute(stmt_ck)).scalar_one_or_none()
            if not ck:
                raise NotFoundException(f"Chuyên khoa ID {payload.chuyen_khoa_id} không tồn tại trên hệ thống!")

        # FC-07: Auto-assign nếu bac_si_id is None
        if payload.bac_si_id is None:
            from app.services.load_balancing_service import load_balancing_service
            effective_doctor_id = await load_balancing_service.assign_optimal_doctor(
                chuyen_khoa_id=payload.chuyen_khoa_id,
                ca_kham=effective_ca,
                ngay_kham=today,
                db=db
            )
        else:
            effective_doctor_id = payload.bac_si_id

        # Khóa dòng BacSi bằng SELECT ... FOR UPDATE OF bac_si
        stmt_bs = (
            select(BacSi)
            .options(
                selectinload(BacSi.nguoi_dung),
                selectinload(BacSi.chuyen_khoa),
                selectinload(BacSi.phong_kham)
            )
            .where(BacSi.id == effective_doctor_id)
            .with_for_update(of=BacSi)
        )
        bs = (await db.execute(stmt_bs)).scalar_one_or_none()
        if not bs:
            raise NotFoundException("Không tìm thấy thông tin bác sĩ tiếp nhận!")

        # 3. Kiểm tra ca làm việc và giới hạn công suất ca (gioi_han_ca_kham & han_muc_vang_lai)
        stmt_shift = (
            select(LichLamViec)
            .where(
                LichLamViec.bac_si_id == effective_doctor_id,
                LichLamViec.ngay_lam_viec == today,
                LichLamViec.ca_lam_viec == effective_ca,
                LichLamViec.is_active.is_(True),
            )
            .with_for_update()
        )
        shift = (await db.execute(stmt_shift)).scalar_one_or_none()

        is_overloaded = False
        overload_reason = ""
        if shift:
            # Kiểm tra hạn mức tiếp nhận vãng lai riêng biệt
            if shift.han_muc_vang_lai:
                stmt_count_walkin = select(func.count(HangDoiKham.id)).where(
                    HangDoiKham.bac_si_id == effective_doctor_id,
                    HangDoiKham.ngay_kham == today,
                    HangDoiKham.ca_kham == effective_ca,
                    HangDoiKham.loai_hang_doi == LoaiHangDoiEnum.VANG_LAI.value,
                    HangDoiKham.trang_thai != TrangThaiHangDoiEnum.DA_DONG_VE.value,
                )
                count_walkin = (await db.execute(stmt_count_walkin)).scalar() or 0
                if count_walkin >= shift.han_muc_vang_lai:
                    is_overloaded = True
                    overload_reason = f"Bác sĩ đã tiếp nhận đủ chỉ tiêu vãng lai ca này ({count_walkin}/{shift.han_muc_vang_lai})"

            if shift.gioi_han_ca_kham and not is_overloaded:
                stmt_count_shift = select(func.count(HangDoiKham.id)).where(
                    HangDoiKham.bac_si_id == effective_doctor_id,
                    HangDoiKham.ngay_kham == today,
                    HangDoiKham.ca_kham == effective_ca,
                    HangDoiKham.trang_thai.notin_([
                        TrangThaiHangDoiEnum.BO_KHAM.value,
                        TrangThaiHangDoiEnum.DA_DONG_VE.value,
                    ]),
                )
                count_shift = (await db.execute(stmt_count_shift)).scalar() or 0
                if count_shift >= shift.gioi_han_ca_kham:
                    is_overloaded = True
                    overload_reason = f"Ca khám của Bác sĩ đã đạt giới hạn tiếp nhận tối đa ({shift.gioi_han_ca_kham} người bệnh)"

        # 4. Xử lý khi quá tải (Waitlist flow)
        if is_overloaded:
            if payload.dang_ky_waitlist_neu_het_cho:
                # Kiểm tra trùng Waitlist
                stmt_wl_exist = select(DanhSachCho).where(
                    and_(
                        DanhSachCho.benh_nhan_id == effective_benh_nhan_id,
                        DanhSachCho.bac_si_id == effective_doctor_id,
                        DanhSachCho.ngay_mong_muon == today,
                        DanhSachCho.ca_mong_muon == effective_ca,
                        DanhSachCho.trang_thai == TrangThaiWaitlistEnum.DANG_CHO.value,
                    )
                )
                existing_wl = (await db.execute(stmt_wl_exist)).scalar_one_or_none()
                if existing_wl:
                    raise ConflictException(
                        f"Bệnh nhân đã có trong Danh sách chờ của Bác sĩ ca này ở vị trí #{existing_wl.thu_tu_uu_tien}!"
                    )

                stmt_max_wl = select(func.coalesce(func.max(DanhSachCho.thu_tu_uu_tien), 0)).where(
                    and_(
                        DanhSachCho.bac_si_id == effective_doctor_id,
                        DanhSachCho.ngay_mong_muon == today,
                        DanhSachCho.ca_mong_muon == effective_ca,
                        DanhSachCho.trang_thai == TrangThaiWaitlistEnum.DANG_CHO.value,
                    )
                )
                max_wl = (await db.execute(stmt_max_wl)).scalar() or 0
                next_wl = max_wl + 1

                wl_entry = DanhSachCho(
                    benh_nhan_id=effective_benh_nhan_id,
                    bac_si_id=effective_doctor_id,
                    phong_kham_id=bs.phong_kham_id if bs else None,
                    ngay_mong_muon=today,
                    ca_mong_muon=effective_ca,
                    trieu_chung=payload.ly_do_kham or "Tiếp đón quầy: Đăng ký chờ slot do ca trực quá tải",
                    thu_tu_uu_tien=next_wl,
                    trang_thai=TrangThaiWaitlistEnum.DANG_CHO.value,
                )
                db.add(wl_entry)
                await db.commit()
                await db.refresh(wl_entry)

                ten_bn_display = bn.nguoi_dung.ho_ten if (bn and bn.nguoi_dung) else (payload.ho_ten or "Bệnh nhân")
                sdt_bn_display = bn.nguoi_dung.so_dien_thoai if (bn and bn.nguoi_dung) else payload.so_dien_thoai
                ten_bs_display = bs.nguoi_dung.ho_ten if (bs and bs.nguoi_dung) else "Bác sĩ"
                phong_display = f"{bs.phong_kham.ten_phong} ({bs.phong_kham.ma_phong})" if (bs and bs.phong_kham) else None

                return QueueTicketResponse(
                    id=0,
                    lich_kham_id=None,
                    benh_nhan_id=effective_benh_nhan_id,
                    ten_benh_nhan=ten_bn_display,
                    so_dien_thoai=sdt_bn_display,
                    bac_si_id=effective_doctor_id,
                    ten_bac_si=ten_bs_display,
                    phong_kham=phong_display,
                    phong_kham_id=bs.phong_kham_id if bs else None,
                    chuyen_khoa_id=bs.chuyen_khoa_id if bs else None,
                    ten_chuyen_khoa=bs.chuyen_khoa.ten_chuyen_khoa if (bs and bs.chuyen_khoa) else None,
                    ngay_kham=today,
                    ca_kham=effective_ca,
                    so_thu_tu_kham=next_wl,
                    ma_so_thu_tu=f"WAIT-{next_wl:02d}",
                    loai_hang_doi="WAITLIST",
                    muc_do_uu_tien=5,
                    trang_thai="dang_cho_slot",
                    thoi_gian_check_in=now,
                    so_lan_goi=0,
                    ghi_chu_dieu_phoi=f"Đã ghi danh vào Danh sách chờ vị trí #{next_wl}",
                    is_waitlist=True,
                    waitlist_id=wl_entry.id,
                    thu_tu_waitlist=next_wl,
                    thong_bao_waitlist=f"{overload_reason}. Người bệnh đã được ghi danh vào Danh sách chờ vị trí #{next_wl}.",
                )
            else:
                raise ConflictException(
                    f"{overload_reason}. Không thể tiếp nhận thêm bệnh nhân vãng lai! "
                    f"Bạn có thể chọn 'Đăng ký Danh sách chờ' để xếp hàng dự phòng khi có lượt hủy."
                )

        # 5. Cấp số thứ tự khám tiếp theo chính xác trong ca
        stmt_max_stt = select(func.coalesce(func.max(HangDoiKham.so_thu_tu_kham), 0)).where(
            HangDoiKham.bac_si_id == effective_doctor_id,
            HangDoiKham.ngay_kham == today,
            HangDoiKham.ca_kham == effective_ca,
        )
        max_stt = (await db.execute(stmt_max_stt)).scalar() or 0
        next_stt = max_stt + 1

        # FC-08: Độ ưu tiên
        if payload.ly_do_uu_tien:
            muc_do_uu_tien = 1
            ly_do_str = payload.ly_do_uu_tien.value if hasattr(payload.ly_do_uu_tien, "value") else str(payload.ly_do_uu_tien)
            ghi_chu = f"Ưu tiên ({ly_do_str}): {payload.ly_do_kham or 'Vãng lai ưu tiên'}"
        else:
            muc_do_uu_tien = 5
            ghi_chu = f"Vãng lai: {payload.ly_do_kham or 'Không ghi chú'}"

        if payload.ghi_chu:
            ghi_chu = f"{ghi_chu} | {payload.ghi_chu}"

        base_time = clinic_now().time()
        gio_kham_tai_cho = time(
            base_time.hour,
            base_time.minute,
            (next_stt * 7) % 60,
            microsecond=min(999999, next_stt * 1000)
        )
        short_suffix = uuid.uuid4().hex[:4].upper()
        ma_lich = f"LK-{today.strftime('%Y%m%d')}-WLK{effective_doctor_id:02d}{next_stt:03d}-{short_suffix}"
        lich_tai_cho = LichKham(
            ma_lich_kham=ma_lich,
            benh_nhan_id=effective_benh_nhan_id,
            bac_si_id=effective_doctor_id,
            chuyen_khoa_id=bs.chuyen_khoa_id,
            ca_kham=effective_ca,
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

        room_id_walkin = bs.phong_kham_id if bs else None
        ticket = HangDoiKham(
            lich_kham_id=lich_tai_cho.id,
            benh_nhan_id=effective_benh_nhan_id,
            bac_si_id=effective_doctor_id,
            phong_kham_id=room_id_walkin,
            ngay_kham=today,
            ca_kham=effective_ca,
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

        # Eager load để map response đầy đủ
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
        today = clinic_now().date()
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

        ticket_id_called = candidate.id
        ticket_stt_called = candidate.so_thu_tu_kham
        await db.commit()

        # 3. Đếm số người còn lại trong hàng đợi
        stmt_count = select(func.count(HangDoiKham.id)).where(
            HangDoiKham.bac_si_id == doctor_id,
            HangDoiKham.ngay_kham == today,
            HangDoiKham.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value,
        )
        remaining = (await db.execute(stmt_count)).scalar() or 0

        # Reload với eager-load đầy đủ để tránh MissingGreenlet trong SQLAlchemy 2.0 Async
        ticket_response = await self._get_ticket_with_relations(ticket_id_called, db)
        logger.info(f"📢 [QUEUE CALLED] Bác sĩ {doctor_id} gọi bệnh nhân STT #{ticket_stt_called} (Ticket: {ticket_id_called})")
        return CallNextResponse(
            message=f"Đã gọi thành công bệnh nhân STT #{ticket_stt_called} vào phòng khám!",
            ticket=ticket_response,
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

        ticket_id_postponed = ticket.id
        ticket.trang_thai = TrangThaiHangDoiEnum.TAM_HOAN.value
        ticket.ghi_chu_dieu_phoi = f"Tạm hoãn lúc {clinic_now().strftime('%H:%M:%S')} do gọi 3 lần không vào."
        await db.commit()
        # Reload với eager-load đầy đủ để tránh MissingGreenlet trong SQLAlchemy 2.0 Async
        return await self._get_ticket_with_relations(ticket_id_postponed, db)

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
        ticket_id_restored = ticket.id
        ticket.trang_thai = TrangThaiHangDoiEnum.CHO_KHAM.value
        ticket.thoi_gian_xep_hang_lai = now
        ticket.muc_do_uu_tien = 4  # Khi quay lại, ưu tiên sau các ca đúng giờ
        ticket.ghi_chu_dieu_phoi = f"{ticket.ghi_chu_dieu_phoi or ''} | Phục hồi hàng đợi lúc {clinic_now().strftime('%H:%M:%S')}.".strip(" | ")
        await db.commit()
        # Reload với eager-load đầy đủ để tránh MissingGreenlet trong SQLAlchemy 2.0 Async
        return await self._get_ticket_with_relations(ticket_id_restored, db)

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
        note = f"Đóng vé hành chính lúc {clinic_now().strftime('%H:%M:%S')}"
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

        note = f"Bệnh nhân xin bỏ về lúc {clinic_now().strftime('%H:%M:%S')}"

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





    async def transfer_ticket(

        self,

        ticket_id: int,

        payload: TransferTicketRequest,

        receptionist_user: TaiKhoan,

        db: AsyncSession,

    ) -> QueueTicketResponse:

        """Lễ tân điều chuyển buồng khám / bác sĩ cho một lượt khám trong hàng đợi (FC-14)"""

        if receptionist_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):

            raise ForbiddenException("Chỉ Lễ tân hoặc Quản trị viên mới có quyền điều chuyển buồng khám!")



        ticket = await self._get_ticket_entity(ticket_id, db, for_update=True)

        if not ticket:

            raise NotFoundException(f"Không tìm thấy phiếu hàng đợi với ID {ticket_id}!")



        if ticket.trang_thai in (

            TrangThaiHangDoiEnum.DA_KHAM.value,

            TrangThaiHangDoiEnum.DA_DONG_VE.value,

            TrangThaiHangDoiEnum.BO_KHAM.value

        ):

            raise ConflictException(f"Không thể điều chuyển phiếu khám đã ở trạng thái {ticket.trang_thai}!")



        # 1. Tìm thông tin buồng khám đích

        stmt_room = select(PhongKham).options(selectinload(PhongKham.chuyen_khoa)).where(PhongKham.id == payload.phong_kham_id)

        target_room = (await db.execute(stmt_room)).scalar_one_or_none()

        if not target_room:

            raise NotFoundException(f"Không tìm thấy buồng khám đích với ID {payload.phong_kham_id}!")



        # 2. Xác định bác sĩ tiếp nhận buồng khám đích

        target_doctor_id = payload.bac_si_id

        if not target_doctor_id:

            # Tra cứu bác sĩ trực buồng này trong ca trực hôm nay (LichLamViec)

            stmt_roster = (

                select(LichLamViec)

                .where(

                    LichLamViec.phong_kham_id == target_room.id,

                    LichLamViec.ngay_lam_viec == ticket.ngay_kham,

                    LichLamViec.is_active.is_(True),

                )

            )

            roster = (await db.execute(stmt_roster)).scalars().first()

            if roster:

                target_doctor_id = roster.bac_si_id

            else:

                # Fallback: Tra cứu bác sĩ phụ trách cố định của buồng này

                stmt_doc = select(BacSi).where(BacSi.phong_kham_id == target_room.id, BacSi.is_active.is_(True))

                doc = (await db.execute(stmt_doc)).scalars().first()

                if doc:

                    target_doctor_id = doc.id



        # 3. Cấp số thứ tự khám tiếp theo tại buồng khám đích (tránh trùng STT và mã vé)

        stmt_max_stt = select(func.coalesce(func.max(HangDoiKham.so_thu_tu_kham), 0)).where(

            and_(

                HangDoiKham.ngay_kham == ticket.ngay_kham,

                HangDoiKham.ca_kham == ticket.ca_kham,

                or_(

                    HangDoiKham.phong_kham_id == target_room.id,

                    HangDoiKham.bac_si_id == target_doctor_id,

                )

            )

        )

        next_stt = (await db.execute(stmt_max_stt)).scalar() + 1



        # Cập nhật phiếu khám

        old_room_id = ticket.phong_kham_id

        ticket.phong_kham_id = target_room.id

        if target_doctor_id:

            ticket.bac_si_id = target_doctor_id

        ticket.so_thu_tu_kham = next_stt

        ticket.thoi_gian_xep_hang_lai = clinic_now()

        if target_doctor_id and ticket.lich_kham:
            ticket.lich_kham.bac_si_id = target_doctor_id

        note_transfer = f"Chuyển từ buồng #{old_room_id} sang {target_room.ten_phong} (STT #{next_stt}): {payload.ly_do}"

        ticket.ghi_chu_dieu_phoi = f"{ticket.ghi_chu_dieu_phoi or ''} | {note_transfer}" if ticket.ghi_chu_dieu_phoi else note_transfer



        await db.commit()

        return await self._get_ticket_with_relations(ticket.id, db)



    async def get_doctor_queue_board(
        self,
        doctor_id: int,
        query_date: Optional[date] = None,
        ca_kham: Optional[Union[str, AsyncSession]] = None,
        db: Optional[AsyncSession] = None,
    ) -> DoctorQueueBoardResponse:
        """Lấy toàn bộ dữ liệu bảng hàng đợi phòng khám theo thời gian thực (Display Board)"""
        if isinstance(ca_kham, AsyncSession):
            db = ca_kham
            ca_kham = None

        now_dt = clinic_now()

        target_date = query_date or now_dt.date()

        current_ca = ca_kham or self._determine_shift(now_dt.time())



        stmt_bs = (

            select(BacSi)

            .options(

                selectinload(BacSi.nguoi_dung),

                selectinload(BacSi.chuyen_khoa),

                selectinload(BacSi.phong_kham),

            )

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

                selectinload(HangDoiKham.bac_si).selectinload(BacSi.phong_kham),

                selectinload(HangDoiKham.phong_kham),

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

        completed = [self._to_ticket_response(t) for t in all_tickets if t.trang_thai in (TrangThaiHangDoiEnum.DA_KHAM.value, TrangThaiHangDoiEnum.BO_KHAM.value)]

        all_list = [self._to_ticket_response(t) for t in all_tickets]



        doc_room_name = None

        if bs.phong_kham:

            doc_room_name = f"{bs.phong_kham.ten_phong} ({bs.phong_kham.ma_phong})"

        elif bs.chuyen_khoa and bs.chuyen_khoa.vi_tri_phong:

            doc_room_name = bs.chuyen_khoa.vi_tri_phong



        return DoctorQueueBoardResponse(

            bac_si_id=bs.id,

            ten_bac_si=bs.nguoi_dung.ho_ten,

            phong_kham=doc_room_name,

            phong_kham_id=bs.phong_kham.id if bs.phong_kham else None,

            chuyen_khoa_id=bs.chuyen_khoa.id if bs.chuyen_khoa else None,

            ten_chuyen_khoa=bs.chuyen_khoa.ten_chuyen_khoa if bs.chuyen_khoa else None,

            ngay_kham=target_date,

            ca_kham=current_ca,

            tong_so_tiep_nhan=len(all_tickets),

            so_nguoi_dang_cho=len(waiting),

            benh_nhan_dang_kham=current,

            danh_sach_cho_kham=waiting,

            danh_sach_tam_hoan=postponed,

            danh_sach_da_kham=completed,

            danh_sach_tat_ca=all_list,

        )



    async def get_patient_flow_board(

        self,

        doctor_id: Optional[int],

        query_date: Optional[date],

        user: TaiKhoan,

        db: AsyncSession,

        room_id: Optional[int] = None,

    ) -> PatientFlowBoardResponse:

        """

        Bảng điều phối luân chuyển bệnh nhân toàn diện tại phòng khám (OpenEMR Patient Flow Board):

        - Theo dõi từ lúc Check-in đến khi Hoàn tất hoặc Bỏ về.

        - Hiển thị Giờ hẹn vs Giờ đến thực tế, Tổng thời gian chờ, Thời gian ở trạng thái này.

        """

        target_date = query_date or clinic_now().date()



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



        if room_id:

            stmt = stmt.where(

                or_(

                    HangDoiKham.phong_kham_id == room_id,

                    HangDoiKham.bac_si.has(BacSi.phong_kham_id == room_id)

                )

            )

        elif doctor_id:

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

            phong = None

            flow_phong_id = None

            if t.phong_kham:

                flow_phong_id = t.phong_kham.id

                phong = f"{t.phong_kham.ten_phong} ({t.phong_kham.ma_phong})"

            elif t.bac_si and t.bac_si.phong_kham:

                flow_phong_id = t.bac_si.phong_kham.id

                phong = f"{t.bac_si.phong_kham.ten_phong} ({t.bac_si.phong_kham.ma_phong})"

            elif t.bac_si and t.bac_si.chuyen_khoa and t.bac_si.chuyen_khoa.vi_tri_phong:

                phong = t.bac_si.chuyen_khoa.vi_tri_phong



            flow_ck_id = None

            flow_ck_name = None

            if t.bac_si and t.bac_si.chuyen_khoa:

                flow_ck_id = t.bac_si.chuyen_khoa.id

                flow_ck_name = t.bac_si.chuyen_khoa.ten_chuyen_khoa

            elif t.lich_kham and t.lich_kham.chuyen_khoa:

                flow_ck_id = t.lich_kham.chuyen_khoa.id

                flow_ck_name = t.lich_kham.chuyen_khoa.ten_chuyen_khoa



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

                    phong_kham_id=flow_phong_id or t.phong_kham_id,

                    chuyen_khoa_id=flow_ck_id,

                    ten_chuyen_khoa=flow_ck_name,

                    ngay_kham=t.ngay_kham,

                    ca_kham=t.ca_kham,

                    so_thu_tu_kham=t.so_thu_tu_kham,

                    ma_so_thu_tu=self._generate_queue_code(t),

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

                selectinload(HangDoiKham.bac_si).selectinload(BacSi.phong_kham),

                selectinload(HangDoiKham.phong_kham),

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

                    benh_nhan_id=a.benh_nhan_id,

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
        """Alias tương thích ngược: Chuyển tiếp trực tiếp sang hàm check_in_walk_in đã hợp nhất"""
        walk_in_req = WalkInCheckInRequest(
            benh_nhan_id=None,
            ho_ten=payload.ho_ten,
            so_dien_thoai=payload.so_dien_thoai,
            gioi_tinh=payload.gioi_tinh,
            nam_sinh=payload.nam_sinh,
            bac_si_id=payload.bac_si_id,
            chuyen_khoa_id=payload.chuyen_khoa_id,
            ca_kham=payload.ca_kham,
            ly_do_kham=payload.ly_do_kham,
            ghi_chu="Tiếp đón vãng lai nhanh tại quầy",
            ly_do_uu_tien=payload.ly_do_uu_tien,
            dang_ky_waitlist_neu_het_cho=getattr(payload, "dang_ky_waitlist_neu_het_cho", False),
        )
        return await self.check_in_walk_in(walk_in_req, receptionist_user, db)


    async def get_shift_dashboard(
        self,
        query_date: Optional[date],
        ca_kham: Optional[str],
        db: AsyncSession
    ) -> ShiftDashboardResponse:
        """Báo cáo chỉ số vận hành ca trực theo thời gian thực (FC-10)"""
        now_dt = clinic_now()
        target_date = query_date or now_dt.date()
        target_ca = ca_kham or self._determine_shift(now_dt.time())

        # 1. Tổng hẹn trước (LichKham): ngay_kham = target_date, trang_thai != DA_HUY
        stmt_apt = (
            select(LichKham)
            .options(
                selectinload(LichKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(LichKham.chuyen_khoa),
                selectinload(LichKham.bac_si).selectinload(BacSi.nguoi_dung),
            )
            .where(
                and_(
                    LichKham.ngay_kham == target_date,
                    LichKham.trang_thai != TrangThaiLichEnum.DA_HUY.value,
                )
            )
            .order_by(LichKham.gio_kham.asc())
        )
        all_apts = (await db.execute(stmt_apt)).scalars().all()

        tong_hen_truoc = 0
        for apt in all_apts:
            apt_ca = apt.ca_kham
            if not apt_ca and apt.gio_kham:
                apt_ca = self._determine_shift(apt.gio_kham)
            if apt_ca == target_ca or not target_ca:
                tong_hen_truoc += 1

        # 2. Hàng đợi (HangDoiKham) trong ngày hôm nay
        stmt_q_today = (
            select(HangDoiKham)
            .options(
                selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HangDoiKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(HangDoiKham.phong_kham).selectinload(PhongKham.chuyen_khoa),
                selectinload(HangDoiKham.nguoi_tiep_nhan).selectinload(TaiKhoan.nguoi_dung),
            )
            .where(HangDoiKham.ngay_kham == target_date)
            .order_by(HangDoiKham.thoi_gian_check_in.desc())
        )
        all_today_tickets = (await db.execute(stmt_q_today)).scalars().all()

        # Lọc vé theo ca hiện tại
        tickets = [t for t in all_today_tickets if t.ca_kham == target_ca] if target_ca else all_today_tickets

        so_da_check_in = len(tickets)
        so_dang_cho = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value)
        so_dang_kham = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value)
        so_da_kham = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.DA_KHAM.value)
        so_tam_hoan = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.TAM_HOAN.value)
        so_vang_mat_chua_xu_ly = sum(1 for a in all_apts if a.trang_thai in (TrangThaiLichEnum.NO_SHOW.value, "no_show", "vang_mat"))
        so_vang_lai = sum(1 for t in tickets if t.loai_hang_doi == LoaiHangDoiEnum.VANG_LAI.value)
        so_bo_kham = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.BO_KHAM.value)
        so_da_dong_ve = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.DA_DONG_VE.value)

        # 3. Mật độ check-in theo khung giờ (Hourly Density)
        standard_hours = ["07:30", "08:30", "09:30", "10:30", "13:30", "14:30", "15:30"]
        counts_by_slot = {h: 0 for h in standard_hours}
        vn_tz = timezone(timedelta(hours=7))

        for t in all_today_tickets:
            ci_dt = t.thoi_gian_check_in
            if ci_dt:
                if ci_dt.tzinfo:
                    ci_local = ci_dt.astimezone(vn_tz)
                else:
                    ci_local = ci_dt
                h = ci_local.hour
                if h <= 7:
                    counts_by_slot["07:30"] += 1
                elif h == 8:
                    counts_by_slot["08:30"] += 1
                elif h == 9:
                    counts_by_slot["09:30"] += 1
                elif h in (10, 11):
                    counts_by_slot["10:30"] += 1
                elif h in (12, 13):
                    counts_by_slot["13:30"] += 1
                elif h == 14:
                    counts_by_slot["14:30"] += 1
                else:
                    counts_by_slot["15:30"] += 1

        mat_do_theo_gio = [
            HourlyCheckInDensityItem(khung_gio=h, so_luong=counts_by_slot[h])
            for h in standard_hours
        ]

        # 4. Lịch hẹn sắp đến trong ngày (chưa check-in, trạng thái đã đặt/đã xác nhận)
        checked_in_apt_ids = {t.lich_kham_id for t in all_today_tickets if t.lich_kham_id}
        upcoming_apts = [
            a for a in all_apts
            if a.id not in checked_in_apt_ids
            and a.trang_thai in (TrangThaiLichEnum.CHO_XAC_NHAN.value, TrangThaiLichEnum.DA_XAC_NHAN.value, "da_xac_nhan")
        ]
        # Sắp xếp theo giờ khám
        upcoming_apts.sort(key=lambda x: str(x.gio_kham or ""))
        lich_hen_sap_toi = []
        for apt in upcoming_apts[:5]:
            ten_bn = "Bệnh nhân"
            sdt = None
            if apt.benh_nhan and getattr(apt.benh_nhan, "nguoi_dung", None):
                ten_bn = apt.benh_nhan.nguoi_dung.ho_ten or "Bệnh nhân"
                sdt = apt.benh_nhan.nguoi_dung.so_dien_thoai
            ten_ck = apt.chuyen_khoa.ten_chuyen_khoa if getattr(apt, "chuyen_khoa", None) else None
            ten_bs = None
            if getattr(apt, "bac_si", None) and getattr(apt.bac_si, "nguoi_dung", None):
                ten_bs = apt.bac_si.nguoi_dung.ho_ten
            gio_str = apt.gio_kham.strftime("%H:%M") if apt.gio_kham else ""
            lich_hen_sap_toi.append(
                UpcomingAppointmentSummaryItem(
                    id=apt.id,
                    ma_lich_kham=apt.ma_lich_kham or f"APT-{apt.id}",
                    benh_nhan_id=apt.benh_nhan_id,
                    ten_benh_nhan=ten_bn,
                    so_dien_thoai=sdt,
                    gio_kham=gio_str,
                    ten_chuyen_khoa=ten_ck,
                    ten_bac_si=ten_bs,
                    trang_thai=apt.trang_thai,
                )
            )

        # 5. Bệnh nhân chờ lâu (> 30 phút hoặc xếp theo thời gian chờ giảm dần)
        waiting_tickets = [t for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value]
        waiting_data = []
        for t in waiting_tickets:
            ci_dt = t.thoi_gian_xep_hang_lai or t.thoi_gian_check_in
            wait_mins = 0
            ci_local = None
            if ci_dt:
                ci_local = ci_dt.astimezone(vn_tz).replace(tzinfo=None) if ci_dt.tzinfo else ci_dt
                wait_mins = max(0, int((now_dt - ci_local).total_seconds() / 60))
            waiting_data.append((t, wait_mins, ci_local))

        # Sắp xếp giảm dần theo thời gian chờ
        waiting_data.sort(key=lambda x: x[1], reverse=True)
        benh_nhan_cho_lau = []
        for t, wait_mins, ci_local in waiting_data[:5]:
            ten_bn = "Bệnh nhân"
            sdt = None
            if t.benh_nhan and getattr(t.benh_nhan, "nguoi_dung", None):
                ten_bn = t.benh_nhan.nguoi_dung.ho_ten or "Bệnh nhân"
                sdt = t.benh_nhan.nguoi_dung.so_dien_thoai
            ten_phong = t.phong_kham.ten_phong if t.phong_kham else None
            ma_phong = t.phong_kham.ma_phong if t.phong_kham else None
            ci_str = ci_local.strftime("%H:%M") if ci_local else ""
            ma_stt = self._generate_queue_code(t)
            benh_nhan_cho_lau.append(
                LongWaitingTicketItem(
                    ticket_id=t.id,
                    ma_so_thu_tu=ma_stt,
                    benh_nhan_id=t.benh_nhan_id,
                    ten_benh_nhan=ten_bn,
                    so_dien_thoai=sdt,
                    ten_phong=ten_phong,
                    ma_phong=ma_phong,
                    thoi_gian_check_in=ci_str,
                    thoi_gian_cho_phut=wait_mins,
                    muc_do_uu_tien=t.muc_do_uu_tien,
                )
            )

        # 6. Hoạt động gần đây của Lễ tân (Audit Logs)
        recent_tickets = sorted(
            all_today_tickets,
            key=lambda t: t.thoi_gian_check_in or t.created_at,
            reverse=True
        )[:10]
        hoat_dong_gan_day = []
        for t in recent_tickets:
            action_type = "WALK_IN_CREATE" if t.loai_hang_doi == LoaiHangDoiEnum.VANG_LAI.value else "CHECK_IN"
            if t.trang_thai == TrangThaiHangDoiEnum.BO_KHAM.value:
                action_type = "LEAVE_QUEUE"
            elif t.trang_thai == TrangThaiHangDoiEnum.DA_DONG_VE.value:
                action_type = "CLOSE_TICKET"
            elif t.ghi_chu_dieu_phoi and "chuyển" in t.ghi_chu_dieu_phoi.lower():
                action_type = "TRANSFER_ROOM"

            ten_bn = (t.benh_nhan.nguoi_dung.ho_ten if (t.benh_nhan and getattr(t.benh_nhan, 'nguoi_dung', None) and t.benh_nhan.nguoi_dung.ho_ten) else 'Bệnh nhân')
            phong_str = f" tại {t.phong_kham.ten_phong} ({t.phong_kham.ma_phong})" if t.phong_kham else ""
            stt_str = self._generate_queue_code(t)
            noi_dung = f"Bệnh nhân {ten_bn} ({stt_str}){phong_str}"

            t_dt = t.thoi_gian_check_in or t.created_at
            t_local = t_dt.astimezone(vn_tz) if (t_dt and t_dt.tzinfo) else t_dt
            t_str = t_local.strftime("%H:%M") if t_local else "Vừa xong"

            actor = "Lễ tân ca trực"
            if t.nguoi_tiep_nhan and getattr(t.nguoi_tiep_nhan, "nguoi_dung", None):
                actor = t.nguoi_tiep_nhan.nguoi_dung.ho_ten

            hoat_dong_gan_day.append(
                ReceptionActivityItem(
                    id=f"ACT-{t.id}",
                    loai_thao_tac=action_type,
                    noi_dung=noi_dung,
                    thoi_gian=t_str,
                    nguoi_thuc_hien=actor,
                )
            )

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
            # Alias fields đồng bộ 100% với Frontend React
            da_check_in=so_da_check_in,
            dang_cho_kham=so_dang_cho,
            dang_kham=so_dang_kham,
            da_kham=so_da_kham,
            vang_mat=so_vang_mat_chua_xu_ly,
            bo_kham=so_bo_kham,
            vang_lai=so_vang_lai,
            # Trực quan hóa và danh sách chuyên sâu
            mat_do_theo_gio=mat_do_theo_gio,
            lich_hen_sap_toi=lich_hen_sap_toi,
            benh_nhan_cho_lau=benh_nhan_cho_lau,
            hoat_dong_gan_day=hoat_dong_gan_day,
        )



    async def get_room_status_dashboard(

        self,

        query_date: Optional[date],

        ca_kham: Optional[str],

        db: AsyncSession

    ) -> RoomStatusDashboardResponse:

        """Giám sát tình trạng buồng khám vật lý theo thời gian thực (FC-11)"""

        now_dt = clinic_now()

        target_date = query_date or now_dt.date()

        target_ca = ca_kham or self._determine_shift(now_dt.time())



        # Lấy tất cả buồng khám

        stmt_rooms = select(PhongKham).options(selectinload(PhongKham.chuyen_khoa)).order_by(PhongKham.ma_phong)

        rooms = (await db.execute(stmt_rooms)).scalars().all()



        # Lấy lịch làm việc hôm nay để biết bác sĩ nào ngồi buồng nào

        stmt_llv = (

            select(LichLamViec)

            .options(

                selectinload(LichLamViec.bac_si).selectinload(BacSi.nguoi_dung),

                selectinload(LichLamViec.bac_si).selectinload(BacSi.chuyen_khoa),

            )

            .where(

                and_(

                    LichLamViec.ngay_lam_viec == target_date,

                    LichLamViec.is_active.is_(True),

                )

            )

        )

        if ca_kham:

            stmt_llv = stmt_llv.where(LichLamViec.ca_lam_viec == ca_kham)



        rosters = (await db.execute(stmt_llv)).scalars().all()

        current_shift = self._determine_shift(now_dt.time())

        room_roster_map = {}

        for ros in rosters:

            if not ros.phong_kham_id:

                continue

            if ros.phong_kham_id not in room_roster_map or ros.ca_lam_viec == current_shift:

                room_roster_map[ros.phong_kham_id] = ros



        # Lấy các vé trong hàng đợi của ngày (nếu chọn ca thì lọc theo ca)

        stmt_q = (

            select(HangDoiKham)

            .options(selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung))

            .where(HangDoiKham.ngay_kham == target_date)

        )

        if ca_kham:

            stmt_q = stmt_q.where(HangDoiKham.ca_kham == ca_kham)



        tickets = (await db.execute(stmt_q)).scalars().all()



        # Fallback query: các bác sĩ được gán cố định theo buồng khám (BacSi.phong_kham_id)

        stmt_docs = (

            select(BacSi)

            .options(

                selectinload(BacSi.nguoi_dung),

                selectinload(BacSi.chuyen_khoa),

            )

            .where(BacSi.phong_kham_id.is_not(None), BacSi.is_active.is_(True))

        )

        assigned_docs = (await db.execute(stmt_docs)).scalars().all()

        doc_room_map = {d.phong_kham_id: d for d in assigned_docs}



        # Gom nhóm ticket theo bac_si_id và phong_kham_id

        doc_tickets = {}

        room_tickets = {}

        for t in tickets:

            if t.bac_si_id:

                doc_tickets.setdefault(t.bac_si_id, []).append(t)

            if t.phong_kham_id:

                room_tickets.setdefault(t.phong_kham_id, []).append(t)



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



            # Fallback nếu phòng chưa có lịch phân ca hôm nay nhưng có Bác sĩ phụ trách buồng

            if not bac_si_id and r.id in doc_room_map:

                fallback_doc = doc_room_map[r.id]

                bac_si_id = fallback_doc.id

                ten_bac_si = fallback_doc.nguoi_dung.ho_ten if fallback_doc.nguoi_dung else None

                if not chuyen_khoa_ten and fallback_doc.chuyen_khoa:

                    chuyen_khoa_ten = fallback_doc.chuyen_khoa.ten_chuyen_khoa



            # Lấy tất cả vé thuộc buồng này (theo bác sĩ hoặc theo buồng)

            seen_ticket_ids = set()

            b_tickets = []

            if bac_si_id and bac_si_id in doc_tickets:

                for t in doc_tickets[bac_si_id]:

                    if t.id not in seen_ticket_ids:

                        seen_ticket_ids.add(t.id)

                        b_tickets.append(t)

            if r.id in room_tickets:

                for t in room_tickets[r.id]:

                    if t.id not in seen_ticket_ids:

                        seen_ticket_ids.add(t.id)

                        b_tickets.append(t)



            so_benh_nhan_cho = sum(

                1 for t in b_tickets

                if str(t.trang_thai).lower() in ("cho_kham", "cho_goi", "dang_goi", "waiting", "called", "da_goi")

            )

            dang_kham_ticket = next(

                (t for t in b_tickets if str(t.trang_thai).lower() in ("dang_kham", "in_consultation")),

                None

            )

            benh_nhan_dang_kham = None

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
        query_date: Optional[date] = None,
        ca_kham: Optional[str] = None,
        chuyen_khoa_id: Optional[Union[int, AsyncSession]] = None,
        db: Optional[AsyncSession] = None,
    ) -> List[RosterItem]:
        """Tra cứu lịch phân ca trực thực tế trong ngày (FC-15)"""
        if isinstance(chuyen_khoa_id, AsyncSession):
            db = chuyen_khoa_id
            chuyen_khoa_id = None

        target_date = query_date or clinic_now().date()

        stmt = (

            select(LichLamViec)

            .options(

                selectinload(LichLamViec.bac_si).selectinload(BacSi.nguoi_dung),

                selectinload(LichLamViec.bac_si).selectinload(BacSi.chuyen_khoa),

                selectinload(LichLamViec.bac_si).selectinload(BacSi.phong_kham),

                selectinload(LichLamViec.phong_kham),

            )

            .where(LichLamViec.ngay_lam_viec == target_date)

        )

        if ca_kham:

            stmt = stmt.where(LichLamViec.ca_lam_viec == ca_kham)

        if chuyen_khoa_id:

            stmt = stmt.where(LichLamViec.bac_si.has(BacSi.chuyen_khoa_id == chuyen_khoa_id))



        rosters = (await db.execute(stmt)).scalars().all()



        # Đếm số lượng tiếp nhận thực tế từ HangDoiKham trong ngày

        stmt_counts = (

            select(HangDoiKham.bac_si_id, HangDoiKham.ca_kham, func.count(HangDoiKham.id))

            .where(HangDoiKham.ngay_kham == target_date)

            .group_by(HangDoiKham.bac_si_id, HangDoiKham.ca_kham)

        )

        count_rows = (await db.execute(stmt_counts)).all()

        count_map = {(row[0], row[1]): row[2] for row in count_rows}

        count_by_doc = {}

        for row in count_rows:

            count_by_doc[row[0]] = count_by_doc.get(row[0], 0) + row[2]



        items: List[RosterItem] = []

        for r in rosters:

            phong_obj = r.phong_kham or (r.bac_si.phong_kham if r.bac_si else None)

            ten_phong_display = None

            ma_phong = None

            phong_id = None

            if phong_obj:

                phong_id = phong_obj.id

                ma_phong = phong_obj.ma_phong

                ten_phong_display = f"{phong_obj.ten_phong} ({phong_obj.ma_phong})"



            so_da_nhan = count_map.get((r.bac_si_id, r.ca_lam_viec))

            if so_da_nhan is None:

                so_da_nhan = count_by_doc.get(r.bac_si_id, 0)



            ck_id = r.bac_si.chuyen_khoa_id if r.bac_si else None

            ck_name = r.bac_si.chuyen_khoa.ten_chuyen_khoa if (r.bac_si and r.bac_si.chuyen_khoa) else "N/A"



            items.append(

                RosterItem(

                    lich_lam_viec_id=r.id,

                    bac_si_id=r.bac_si_id,

                    ten_bac_si=r.bac_si.nguoi_dung.ho_ten if r.bac_si and r.bac_si.nguoi_dung else "N/A",

                    chuyen_khoa=ck_name,

                    chuyen_khoa_id=ck_id,

                    phong_kham_id=phong_id,

                    ten_phong=ten_phong_display,

                    ma_phong=ma_phong,

                    ngay_lam_viec=r.ngay_lam_viec,

                    ca_lam_viec=r.ca_lam_viec,

                    gio_bat_dau=r.gio_bat_dau.strftime("%H:%M") if r.gio_bat_dau else "",

                    gio_ket_thuc=r.gio_ket_thuc.strftime("%H:%M") if r.gio_ket_thuc else "",

                    is_active=r.is_active,

                    so_luot_da_nhan=so_da_nhan,

                    gioi_han_ca_kham=r.gioi_han_ca_kham or 30,

                )

            )

        return items



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

        today = clinic_now().date()



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



        target_date = query_date or clinic_now().date()



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

    async def get_reception_waitlist(
        self,
        query_date: Optional[date],
        ca_kham: Optional[str],
        bac_si_id: Optional[int],
        chuyen_khoa_id: Optional[int],
        db: AsyncSession
    ) -> ReceptionWaitlistResponse:
        """Lễ tân tra cứu danh sách người bệnh đang chờ slot trong ngày (Waitlist)"""
        target_date = query_date or clinic_now().date()
        stmt = (
            select(DanhSachCho)
            .options(
                selectinload(DanhSachCho.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(DanhSachCho.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(DanhSachCho.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(DanhSachCho.phong_kham),
            )
            .where(
                and_(
                    DanhSachCho.ngay_mong_muon == target_date,
                    DanhSachCho.trang_thai.in_([
                        TrangThaiWaitlistEnum.DANG_CHO.value,
                        TrangThaiWaitlistEnum.DA_THONG_BAO.value,
                    ])
                )
            )
        )
        if ca_kham:
            stmt = stmt.where(DanhSachCho.ca_mong_muon == ca_kham)
        if bac_si_id:
            stmt = stmt.where(DanhSachCho.bac_si_id == bac_si_id)
        if chuyen_khoa_id:
            stmt = stmt.where(DanhSachCho.bac_si.has(BacSi.chuyen_khoa_id == chuyen_khoa_id))

        stmt = stmt.order_by(DanhSachCho.thu_tu_uu_tien.asc(), DanhSachCho.created_at.asc())
        rows = (await db.execute(stmt)).scalars().all()

        now = datetime.now(timezone.utc)
        items: List[ReceptionWaitlistItem] = []
        for r in rows:
            ten_bn = r.benh_nhan.nguoi_dung.ho_ten if (r.benh_nhan and r.benh_nhan.nguoi_dung) else "Bệnh nhân"
            sdt_bn = r.benh_nhan.nguoi_dung.so_dien_thoai if (r.benh_nhan and r.benh_nhan.nguoi_dung) else None
            gioi_tinh = r.benh_nhan.nguoi_dung.gioi_tinh if (r.benh_nhan and r.benh_nhan.nguoi_dung) else None
            nam_sinh = r.benh_nhan.nguoi_dung.ngay_sinh.year if (r.benh_nhan and r.benh_nhan.nguoi_dung and r.benh_nhan.nguoi_dung.ngay_sinh) else None

            ten_bs = r.bac_si.nguoi_dung.ho_ten if (r.bac_si and r.bac_si.nguoi_dung) else None
            ck_id = r.bac_si.chuyen_khoa_id if r.bac_si else None
            ck_name = r.bac_si.chuyen_khoa.ten_chuyen_khoa if (r.bac_si and r.bac_si.chuyen_khoa) else None

            phong_name = None
            if r.phong_kham:
                phong_name = f"{r.phong_kham.ten_phong} ({r.phong_kham.ma_phong})"
            elif r.bac_si and r.bac_si.phong_kham:
                phong_name = f"{r.bac_si.phong_kham.ten_phong} ({r.bac_si.phong_kham.ma_phong})"

            con_han = False
            if r.trang_thai == TrangThaiWaitlistEnum.DA_THONG_BAO.value and r.thoi_gian_het_han_giu_slot:
                con_han = r.thoi_gian_het_han_giu_slot > now

            items.append(
                ReceptionWaitlistItem(
                    id=r.id,
                    benh_nhan_id=r.benh_nhan_id,
                    ten_benh_nhan=ten_bn,
                    so_dien_thoai=sdt_bn,
                    gioi_tinh=gioi_tinh,
                    nam_sinh=nam_sinh,
                    bac_si_id=r.bac_si_id,
                    ten_bac_si=ten_bs,
                    phong_kham_id=r.phong_kham_id,
                    ten_phong=phong_name,
                    chuyen_khoa_id=ck_id,
                    ten_chuyen_khoa=ck_name,
                    ngay_mong_muon=r.ngay_mong_muon,
                    ca_mong_muon=r.ca_mong_muon,
                    trieu_chung=r.trieu_chung,
                    thu_tu_uu_tien=r.thu_tu_uu_tien,
                    trang_thai=r.trang_thai,
                    thoi_gian_dang_ky=r.created_at,
                    thoi_gian_thong_bao=r.thoi_gian_thong_bao,
                    thoi_gian_het_han_giu_slot=r.thoi_gian_het_han_giu_slot,
                    con_han_giu_slot=con_han,
                    co_bac_si_chi_dinh=(r.bac_si_id is not None),
                )
            )

        return ReceptionWaitlistResponse(total=len(items), items=items)

    async def check_in_from_waitlist(
        self,
        waitlist_id: int,
        receptionist_user: TaiKhoan,
        db: AsyncSession
    ) -> QueueTicketResponse:
        """Lễ tân tiếp nhận chính thức bệnh nhân từ Danh sách chờ vào Hàng đợi khám (áp dụng cơ chế phân bổ tối ưu nếu không có Bác sĩ)"""
        if receptionist_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chỉ Lễ tân hoặc Admin mới có quyền tiếp nhận bệnh nhân từ danh sách chờ!")

        stmt = (
            select(DanhSachCho)
            .options(
                selectinload(DanhSachCho.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(DanhSachCho.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(DanhSachCho.bac_si).selectinload(BacSi.phong_kham),
                selectinload(DanhSachCho.bac_si).selectinload(BacSi.nguoi_dung),
            )
            .where(DanhSachCho.id == waitlist_id)
            .with_for_update()
        )
        entry = (await db.execute(stmt)).scalar_one_or_none()
        if not entry:
            raise NotFoundException(f"Không tìm thấy bản ghi danh sách chờ với ID {waitlist_id}!")

        today = clinic_now().date()
        now = clinic_now()

        if entry.trang_thai in (TrangThaiWaitlistEnum.DA_NHAN_SLOT.value, "da_kham"):
            raise ConflictException("Lượt chờ này đã được tiếp nhận vào hàng đợi trước đó!")

        if entry.trang_thai in (TrangThaiWaitlistEnum.DA_BO_QUA.value, "da_huy", "het_han"):
            raise BadRequestException("Lượt chờ này đã bị hủy, bỏ qua hoặc đã hết hạn, không thể tiếp nhận!")

        if entry.ngay_mong_muon != today:
            raise BadRequestException(
                f"Lượt chờ này đăng ký cho ngày {entry.ngay_mong_muon.strftime('%d/%m/%Y')}. "
                f"Chỉ có thể tiếp nhận vào đúng ngày đăng ký khám!"
            )

        ca_kham = entry.ca_mong_muon or self._determine_shift(clinic_now().time())

        # Kiểm tra chống trùng lặp hàng đợi trong ca hôm nay
        stmt_queue_exist = select(HangDoiKham.id).where(
            HangDoiKham.benh_nhan_id == entry.benh_nhan_id,
            HangDoiKham.ngay_kham == today,
            HangDoiKham.ca_kham == ca_kham,
            HangDoiKham.trang_thai.in_([
                TrangThaiHangDoiEnum.CHO_KHAM.value,
                TrangThaiHangDoiEnum.DANG_KHAM.value,
            ]),
        )
        if (await db.execute(stmt_queue_exist)).scalar_one_or_none():
            raise ConflictException("Người bệnh hiện đã có vé đang chờ hoặc đang khám trong ca hôm nay!")

        # Xác định Bác sĩ tiếp nhận:
        effective_doctor_id = entry.bac_si_id
        if not effective_doctor_id:
            # Nếu người bệnh không chọn bác sĩ -> Kích hoạt load_balancing_service tự động tìm bác sĩ tối ưu ít chờ nhất
            ck_id = entry.bac_si.chuyen_khoa_id if entry.bac_si else None
            from app.services.load_balancing_service import load_balancing_service
            effective_doctor_id = await load_balancing_service.assign_optimal_doctor(
                chuyen_khoa_id=ck_id,
                ca_kham=ca_kham,
                ngay_kham=today,
                db=db
            )

        # Lấy thông tin Bác sĩ
        stmt_bs = select(BacSi).options(selectinload(BacSi.phong_kham), selectinload(BacSi.chuyen_khoa)).where(BacSi.id == effective_doctor_id)
        bs = (await db.execute(stmt_bs)).scalar_one_or_none()
        if not bs:
            raise NotFoundException("Không tìm thấy thông tin Bác sĩ tiếp nhận!")

        # Kiểm tra ca trực của Bác sĩ (LichLamViec) và trần công suất ca khám
        stmt_shift = (
            select(LichLamViec)
            .where(
                LichLamViec.bac_si_id == effective_doctor_id,
                LichLamViec.ngay_lam_viec == today,
                LichLamViec.ca_lam_viec == ca_kham,
                LichLamViec.is_active.is_(True),
            )
            .with_for_update()
        )
        shift = (await db.execute(stmt_shift)).scalar_one_or_none()

        if shift and shift.gioi_han_ca_kham:
            stmt_count_shift = select(func.count(HangDoiKham.id)).where(
                HangDoiKham.bac_si_id == effective_doctor_id,
                HangDoiKham.ngay_kham == today,
                HangDoiKham.ca_kham == ca_kham,
                HangDoiKham.trang_thai.notin_([
                    TrangThaiHangDoiEnum.BO_KHAM.value,
                    TrangThaiHangDoiEnum.DA_DONG_VE.value,
                ]),
            )
            count_shift = (await db.execute(stmt_count_shift)).scalar() or 0
            if count_shift >= shift.gioi_han_ca_kham:
                raise ConflictException(
                    f"Ca khám của Bác sĩ hiện vẫn đang kín chỗ ({count_shift}/{shift.gioi_han_ca_kham} ca). "
                    f"Chưa có lượt hủy để giải phóng slot cho người bệnh trong danh sách chờ!"
                )

        # Cấp số thứ tự khám tiếp theo
        stmt_max_stt = select(func.coalesce(func.max(HangDoiKham.so_thu_tu_kham), 0)).where(
            HangDoiKham.bac_si_id == effective_doctor_id,
            HangDoiKham.ngay_kham == today,
            HangDoiKham.ca_kham == ca_kham,
        )
        max_stt = (await db.execute(stmt_max_stt)).scalar() or 0
        next_stt = max_stt + 1

        base_time = clinic_now().time()
        gio_kham_tai_cho = time(
            base_time.hour,
            base_time.minute,
            (next_stt * 7) % 60,
            microsecond=min(999999, next_stt * 1000)
        )
        short_suffix = uuid.uuid4().hex[:4].upper()
        ma_lich = f"LK-{today.strftime('%Y%m%d')}-WLT{effective_doctor_id:02d}{next_stt:03d}-{short_suffix}"

        lich_kham = LichKham(
            ma_lich_kham=ma_lich,
            benh_nhan_id=entry.benh_nhan_id,
            bac_si_id=effective_doctor_id,
            chuyen_khoa_id=bs.chuyen_khoa_id,
            ca_kham=ca_kham,
            ngay_kham=today,
            gio_kham=gio_kham_tai_cho,
            thoi_luong_phut=settings.SLOT_DURATION_MINUTES,
            so_thu_tu=next_stt,
            ly_do_kham=entry.trieu_chung or "Tiếp nhận từ Danh sách chờ (Waitlist)",
            trieu_chung_ban_dau=entry.trieu_chung,
            trang_thai=TrangThaiLichEnum.DA_TIEP_NHAN.value,
        )
        db.add(lich_kham)
        await db.flush()

        room_id = bs.phong_kham_id if bs else None
        ticket = HangDoiKham(
            lich_kham_id=lich_kham.id,
            benh_nhan_id=entry.benh_nhan_id,
            bac_si_id=effective_doctor_id,
            phong_kham_id=room_id,
            ngay_kham=today,
            ca_kham=ca_kham,
            so_thu_tu_kham=next_stt,
            loai_hang_doi=LoaiHangDoiEnum.VANG_LAI.value,
            muc_do_uu_tien=5,  # Vãng lai / Slot từ Waitlist (tránh nhầm lẫn với tier 3 'Sau CLS')
            trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
            thoi_gian_check_in=now,
            so_lan_goi=0,
            nguoi_tiep_nhan_id=receptionist_user.id,
            ghi_chu_dieu_phoi=f"Tiếp nhận thành công từ Danh sách chờ (vị trí #{entry.thu_tu_uu_tien})",
        )
        db.add(ticket)

        # Cập nhật bản ghi Waitlist
        entry.trang_thai = TrangThaiWaitlistEnum.DA_NHAN_SLOT.value
        entry.slot_duoc_cap_id = lich_kham.id

        await db.commit()
        return await self._get_ticket_with_relations(ticket.id, db)

    async def cancel_waitlist_entry(
        self,
        waitlist_id: int,
        receptionist_user: TaiKhoan,
        db: AsyncSession
    ) -> dict:
        """Lễ tân hủy lượt chờ của người bệnh trong Danh sách chờ"""
        if receptionist_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chỉ Lễ tân hoặc Admin mới có quyền hủy bản ghi danh sách chờ!")

        stmt = select(DanhSachCho).where(DanhSachCho.id == waitlist_id).with_for_update()
        entry = (await db.execute(stmt)).scalar_one_or_none()
        if not entry:
            raise NotFoundException(f"Không tìm thấy bản ghi danh sách chờ với ID {waitlist_id}!")

        entry.trang_thai = "da_huy"
        await db.commit()
        return {"success": True, "message": "Đã hủy lượt chờ khám thành công"}

    async def get_reception_report_summary(
        self,
        query_date: Optional[date],
        ca_kham: Optional[str],
        db: AsyncSession
    ) -> ReceptionReportSummaryResponse:
        """
        Phân hệ 9 (API 9.1): Báo cáo đối soát vận hành tiếp đón
        - Thống kê tổng tiếp nhận, số lịch hẹn, số vãng lai
        - Thời gian chờ trung bình (SLA từ check-in đến lúc bác sĩ gọi/khám)
        - Số lịch bị hủy, số no-show
        - Phân bổ theo từng chuyên khoa
        """
        now = clinic_now()
        target_date = query_date or now.date()
        vn_tz = timezone(timedelta(hours=7))

        # 1. Lấy tất cả lượt trong hàng đợi ngày target_date (và ca_kham nếu có)
        stmt_queue = (
            select(HangDoiKham)
            .options(
                selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HangDoiKham.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(HangDoiKham.phong_kham),
                selectinload(HangDoiKham.lich_kham).selectinload(LichKham.chuyen_khoa),
            )
            .where(HangDoiKham.ngay_kham == target_date)
        )
        if ca_kham:
            stmt_queue = stmt_queue.where(HangDoiKham.ca_kham == ca_kham)

        tickets = (await db.execute(stmt_queue)).scalars().all()

        # 2. Lấy danh sách lịch hẹn trong ngày target_date (và ca_kham nếu có) để tính hủy & no-show
        stmt_lich = select(LichKham).where(LichKham.ngay_kham == target_date)
        if ca_kham:
            stmt_lich = stmt_lich.where(LichKham.ca_kham == ca_kham)
        lich_list = (await db.execute(stmt_lich)).scalars().all()

        tong_luot = len(tickets)
        so_vang_lai = sum(1 for t in tickets if t.loai_hang_doi == LoaiHangDoiEnum.VANG_LAI.value)
        so_lich_hen = tong_luot - so_vang_lai

        so_lich_huy = sum(
            1 for item_lich in lich_list
            if item_lich.trang_thai in (TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value)
        )
        so_no_show = sum(
            1 for item_lich in lich_list
            if item_lich.trang_thai == TrangThaiLichEnum.NO_SHOW.value
        )

        # 3. Tính thời gian chờ trung bình (phút) và phân bổ chuyên khoa
        wait_times: List[float] = []
        specialty_stats: dict = {}

        # Nạp tất cả chuyên khoa từ CSDL để hiển thị
        all_specs_res = await db.execute(select(ChuyenKhoa).where(ChuyenKhoa.is_active.is_(True)))
        all_specs = all_specs_res.scalars().all()
        for sp in all_specs:
            specialty_stats[sp.id] = {
                "chuyen_khoa_id": sp.id,
                "ma_chuyen_khoa": sp.ma_chuyen_khoa,
                "ten_chuyen_khoa": sp.ten_chuyen_khoa,
                "so_luot": 0,
                "total_wait_minutes": 0.0,
                "wait_count": 0,
            }

        for t in tickets:
            ci_dt = t.thoi_gian_xep_hang_lai or t.thoi_gian_check_in or t.created_at
            if ci_dt and ci_dt.tzinfo:
                ci_local = ci_dt.astimezone(vn_tz).replace(tzinfo=None)
            else:
                ci_local = ci_dt

            called_dt = t.thoi_gian_goi_kham or t.thoi_gian_bat_dau
            if called_dt:
                if called_dt.tzinfo:
                    call_local = called_dt.astimezone(vn_tz).replace(tzinfo=None)
                else:
                    call_local = called_dt
                wait_min = max(0.0, (call_local - ci_local).total_seconds() / 60.0)
            elif t.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value:
                now_local = now.replace(tzinfo=None)
                wait_min = max(0.0, (now_local - ci_local).total_seconds() / 60.0)
            else:
                end_dt = t.thoi_gian_ket_thuc or t.updated_at
                if end_dt:
                    if end_dt.tzinfo:
                        end_local = end_dt.astimezone(vn_tz).replace(tzinfo=None)
                    else:
                        end_local = end_dt
                    wait_min = max(0.0, (end_local - ci_local).total_seconds() / 60.0)
                else:
                    wait_min = 0.0

            wait_times.append(wait_min)

            spec_id = None
            spec_name = None
            spec_code = None
            if t.bac_si and t.bac_si.chuyen_khoa:
                spec_id = t.bac_si.chuyen_khoa.id
                spec_name = t.bac_si.chuyen_khoa.ten_chuyen_khoa
                spec_code = t.bac_si.chuyen_khoa.ma_chuyen_khoa
            elif t.lich_kham and t.lich_kham.chuyen_khoa:
                spec_id = t.lich_kham.chuyen_khoa.id
                spec_name = t.lich_kham.chuyen_khoa.ten_chuyen_khoa
                spec_code = t.lich_kham.chuyen_khoa.ma_chuyen_khoa

            if spec_id:
                if spec_id not in specialty_stats:
                    specialty_stats[spec_id] = {
                        "chuyen_khoa_id": spec_id,
                        "ma_chuyen_khoa": spec_code,
                        "ten_chuyen_khoa": spec_name or f"Chuyên khoa #{spec_id}",
                        "so_luot": 0,
                        "total_wait_minutes": 0.0,
                        "wait_count": 0,
                    }
                specialty_stats[spec_id]["so_luot"] += 1
                specialty_stats[spec_id]["total_wait_minutes"] += wait_min
                specialty_stats[spec_id]["wait_count"] += 1

        avg_wait = round(sum(wait_times) / len(wait_times), 1) if wait_times else 0.0

        phan_bo: List[DepartmentDistributionItem] = []
        for s_id, s_data in specialty_stats.items():
            if s_data["so_luot"] > 0 or tong_luot == 0:
                pct = round((s_data["so_luot"] / tong_luot * 100), 1) if tong_luot > 0 else 0.0
                spec_avg_wait = (
                    round(s_data["total_wait_minutes"] / s_data["wait_count"], 1)
                    if s_data["wait_count"] > 0
                    else 0.0
                )
                phan_bo.append(
                    DepartmentDistributionItem(
                        chuyen_khoa_id=s_data["chuyen_khoa_id"],
                        ma_chuyen_khoa=s_data["ma_chuyen_khoa"],
                        ten_chuyen_khoa=s_data["ten_chuyen_khoa"],
                        so_luot=s_data["so_luot"],
                        ti_le_phan_tram=pct,
                        thoi_gian_cho_tb_phut=spec_avg_wait,
                    )
                )

        phan_bo.sort(key=lambda x: x.so_luot, reverse=True)

        return ReceptionReportSummaryResponse(
            ngay=target_date,
            ca_kham=ca_kham,
            kpi=ReceptionReportKpiItem(
                tong_luot_tiep_nhan=tong_luot,
                so_lich_hen=so_lich_hen,
                so_vang_lai=so_vang_lai,
                thoi_gian_cho_trung_binh_phut=avg_wait,
                so_lich_huy=so_lich_huy,
                so_no_show=so_no_show,
            ),
            phan_bo_chuyen_khoa=phan_bo,
        )

    async def get_reception_audit_logs(
        self,
        query_date: Optional[date],
        action_type: Optional[str],
        search: Optional[str],
        page: int,
        page_size: int,
        db: AsyncSession
    ) -> ReceptionAuditLogResponse:
        """
        Phân hệ 9 (API 9.2): Nhật ký kiểm toán thao tác tiếp đón & điều phối
        - Quét từ HangDoiKham và LichKham
        - Hỗ trợ lọc action_type, tìm kiếm họ tên, sđt, số vé, buồng khám, actor
        - Phân trang chuẩn theo yêu cầu Frontend
        """
        now = clinic_now()
        target_date = query_date or now.date()
        vn_tz = timezone(timedelta(hours=7))

        stmt_tickets = (
            select(HangDoiKham)
            .options(
                selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HangDoiKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(HangDoiKham.phong_kham),
                selectinload(HangDoiKham.lich_kham),
                selectinload(HangDoiKham.nguoi_tiep_nhan).selectinload(TaiKhoan.nguoi_dung),
            )
            .where(HangDoiKham.ngay_kham == target_date)
        )
        tickets = (await db.execute(stmt_tickets)).scalars().all()

        stmt_lich = (
            select(LichKham)
            .options(
                selectinload(LichKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(LichKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichKham.chuyen_khoa),
            )
            .where(LichKham.ngay_kham == target_date)
        )
        lich_list = (await db.execute(stmt_lich)).scalars().all()

        raw_logs: List[ReceptionAuditLogItem] = []

        for t in tickets:
            patient_name = t.benh_nhan.nguoi_dung.ho_ten if (t.benh_nhan and getattr(t.benh_nhan, "nguoi_dung", None)) else "Bệnh nhân"
            phone = t.benh_nhan.nguoi_dung.so_dien_thoai if (t.benh_nhan and getattr(t.benh_nhan, "nguoi_dung", None)) else ""
            room_name = t.phong_kham.ten_phong if t.phong_kham else ""
            ticket_num = self._generate_queue_code(t)

            receptionist_name = "Lễ tân tiếp đón"
            if t.nguoi_tiep_nhan and getattr(t.nguoi_tiep_nhan, "nguoi_dung", None):
                receptionist_name = t.nguoi_tiep_nhan.nguoi_dung.ho_ten

            doctor_name = "Bác sĩ phụ trách"
            if t.bac_si and getattr(t.bac_si, "nguoi_dung", None):
                doctor_name = f"BS. {t.bac_si.nguoi_dung.ho_ten}"

            t_dt = t.thoi_gian_check_in or t.created_at
            if t_dt:
                t_local = t_dt.astimezone(vn_tz) if t_dt.tzinfo else t_dt
                ts_str = t_local.strftime("%Y-%m-%d %H:%M:%S")
            else:
                ts_str = now.strftime("%Y-%m-%d %H:%M:%S")

            if t.loai_hang_doi == LoaiHangDoiEnum.VANG_LAI.value:
                act = "WALK_IN_CREATE"
                desc = f"Tiếp nhận bệnh nhân vãng lai, cấp số {ticket_num} vào {room_name}" if room_name else f"Tiếp nhận vãng lai, cấp số {ticket_num}"
            else:
                act = "CHECK_IN"
                ma_lk = t.lich_kham.ma_lich_kham if t.lich_kham else ""
                desc = f"Tiếp nhận check-in lịch hẹn {ma_lk}, cấp số {ticket_num} vào {room_name}" if room_name else f"Tiếp nhận check-in lịch hẹn {ma_lk}, cấp số {ticket_num}"

            raw_logs.append(
                ReceptionAuditLogItem(
                    id=f"AUDIT-CHK-{t.id}",
                    timestamp=ts_str,
                    actor=receptionist_name,
                    action_type=act,
                    ticket_number=ticket_num,
                    patient_name=patient_name,
                    phone=phone,
                    room_name=room_name,
                    description=desc,
                    metadata={"ticket_id": t.id, "muc_do_uu_tien": t.muc_do_uu_tien},
                )
            )

            # Sự kiện Bác sĩ gọi số
            if t.thoi_gian_goi_kham or t.trang_thai in (TrangThaiHangDoiEnum.DANG_KHAM.value, TrangThaiHangDoiEnum.DA_KHAM.value):
                call_dt = t.thoi_gian_goi_kham or t.thoi_gian_bat_dau or t.updated_at
                call_local = call_dt.astimezone(vn_tz) if (call_dt and call_dt.tzinfo) else call_dt
                call_str = call_local.strftime("%Y-%m-%d %H:%M:%S") if call_local else ts_str

                raw_logs.append(
                    ReceptionAuditLogItem(
                        id=f"AUDIT-CALL-{t.id}",
                        timestamp=call_str,
                        actor=doctor_name,
                        action_type="QUEUE_CALL",
                        ticket_number=ticket_num,
                        patient_name=patient_name,
                        phone=phone,
                        room_name=room_name,
                        description=f"{doctor_name} gọi số {ticket_num} vào khám tại {room_name}" if room_name else f"{doctor_name} gọi số {ticket_num}",
                        metadata={"ticket_id": t.id, "so_lan_goi": t.so_lan_goi},
                    )
                )

            # Sự kiện chuyển buồng khám
            if t.ghi_chu_dieu_phoi and any(w in t.ghi_chu_dieu_phoi.lower() for w in ("chuyển", "đổi phòng", "transfer")):
                up_dt = t.updated_at or t.thoi_gian_check_in
                up_local = up_dt.astimezone(vn_tz) if (up_dt and up_dt.tzinfo) else up_dt
                up_str = up_local.strftime("%Y-%m-%d %H:%M:%S") if up_local else ts_str

                raw_logs.append(
                    ReceptionAuditLogItem(
                        id=f"AUDIT-TRF-{t.id}",
                        timestamp=up_str,
                        actor=receptionist_name,
                        action_type="QUEUE_TRANSFER_ROOM",
                        ticket_number=ticket_num,
                        patient_name=patient_name,
                        phone=phone,
                        room_name=room_name,
                        description=f"Điều phối chuyển buồng khám: {t.ghi_chu_dieu_phoi}",
                        metadata={"ticket_id": t.id},
                    )
                )

            # Sự kiện tạm hoãn
            if t.trang_thai == TrangThaiHangDoiEnum.TAM_HOAN.value:
                defer_dt = t.thoi_gian_xep_hang_lai or t.updated_at
                defer_local = defer_dt.astimezone(vn_tz) if (defer_dt and defer_dt.tzinfo) else defer_dt
                defer_str = defer_local.strftime("%Y-%m-%d %H:%M:%S") if defer_local else ts_str

                raw_logs.append(
                    ReceptionAuditLogItem(
                        id=f"AUDIT-DFR-{t.id}",
                        timestamp=defer_str,
                        actor=receptionist_name,
                        action_type="QUEUE_DEFER",
                        ticket_number=ticket_num,
                        patient_name=patient_name,
                        phone=phone,
                        room_name=room_name,
                        description=f"Tạm hoãn lượt khám của bệnh nhân {patient_name} ({ticket_num}), xếp vào hàng đợi chờ gọi lại",
                        metadata={"ticket_id": t.id},
                    )
                )

            # Sự kiện bỏ khám
            if t.trang_thai == TrangThaiHangDoiEnum.BO_KHAM.value:
                leave_dt = t.updated_at or t.thoi_gian_check_in
                leave_local = leave_dt.astimezone(vn_tz) if (leave_dt and leave_dt.tzinfo) else leave_dt
                leave_str = leave_local.strftime("%Y-%m-%d %H:%M:%S") if leave_local else ts_str

                raw_logs.append(
                    ReceptionAuditLogItem(
                        id=f"AUDIT-LV-{t.id}",
                        timestamp=leave_str,
                        actor=receptionist_name,
                        action_type="LEAVE_QUEUE",
                        ticket_number=ticket_num,
                        patient_name=patient_name,
                        phone=phone,
                        room_name=room_name,
                        description=f"Bệnh nhân {patient_name} ({ticket_num}) bỏ khám, rời khỏi phòng khám",
                        metadata={"ticket_id": t.id},
                    )
                )

            # Sự kiện đóng vé
            if t.trang_thai == TrangThaiHangDoiEnum.DA_DONG_VE.value:
                close_dt = t.thoi_gian_ket_thuc or t.updated_at
                close_local = close_dt.astimezone(vn_tz) if (close_dt and close_dt.tzinfo) else close_dt
                close_str = close_local.strftime("%Y-%m-%d %H:%M:%S") if close_local else ts_str

                raw_logs.append(
                    ReceptionAuditLogItem(
                        id=f"AUDIT-CLS-{t.id}",
                        timestamp=close_str,
                        actor=receptionist_name,
                        action_type="CLOSE_TICKET",
                        ticket_number=ticket_num,
                        patient_name=patient_name,
                        phone=phone,
                        room_name=room_name,
                        description=f"Đóng vé hàng đợi {ticket_num}. {t.ghi_chu_dieu_phoi or 'Kết thúc ca khám'}",
                        metadata={"ticket_id": t.id},
                    )
                )

        # Xử lý các sự kiện từ LichKham
        for lk in lich_list:
            patient_name = lk.benh_nhan.nguoi_dung.ho_ten if (lk.benh_nhan and getattr(lk.benh_nhan, "nguoi_dung", None)) else "Bệnh nhân"
            phone = lk.benh_nhan.nguoi_dung.so_dien_thoai if (lk.benh_nhan and getattr(lk.benh_nhan, "nguoi_dung", None)) else ""

            if lk.trang_thai in (TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value):
                c_dt = lk.thoi_gian_huy or lk.updated_at
                c_local = c_dt.astimezone(vn_tz) if (c_dt and c_dt.tzinfo) else c_dt
                c_str = c_local.strftime("%Y-%m-%d %H:%M:%S") if c_local else now.strftime("%Y-%m-%d %H:%M:%S")

                raw_logs.append(
                    ReceptionAuditLogItem(
                        id=f"AUDIT-CNL-{lk.id}",
                        timestamp=c_str,
                        actor="Lễ tân tiếp đón",
                        action_type="APPOINTMENT_CANCEL",
                        ticket_number=None,
                        patient_name=patient_name,
                        phone=phone,
                        room_name=None,
                        description=f"Hủy lịch hẹn {lk.ma_lich_kham}. Lý do: {lk.ly_do_huy or 'Bệnh nhân yêu cầu hủy'}",
                        metadata={"lich_kham_id": lk.id, "ma_lich_kham": lk.ma_lich_kham},
                    )
                )

            if lk.thoi_gian_xac_nhan_lai:
                r_dt = lk.thoi_gian_xac_nhan_lai
                r_local = r_dt.astimezone(vn_tz) if r_dt.tzinfo else r_dt
                r_str = r_local.strftime("%Y-%m-%d %H:%M:%S")

                raw_logs.append(
                    ReceptionAuditLogItem(
                        id=f"AUDIT-RSC-{lk.id}",
                        timestamp=r_str,
                        actor="Lễ tân tiếp đón",
                        action_type="APPOINTMENT_RESCHEDULE",
                        ticket_number=None,
                        patient_name=patient_name,
                        phone=phone,
                        room_name=None,
                        description=f"Dời lịch khám mã {lk.ma_lich_kham} sang khung giờ mới",
                        metadata={"lich_kham_id": lk.id, "ma_lich_kham": lk.ma_lich_kham},
                    )
                )

        filtered_logs = raw_logs
        if action_type:
            filtered_logs = [log for log in filtered_logs if log.action_type == action_type]

        if search:
            s = search.lower().strip()
            filtered_logs = [
                log for log in filtered_logs
                if (s in (log.patient_name or "").lower())
                or (s in (log.phone or "").lower())
                or (s in (log.ticket_number or "").lower())
                or (s in (log.actor or "").lower())
                or (s in (log.room_name or "").lower())
                or (s in (log.description or "").lower())
            ]

        filtered_logs.sort(key=lambda x: x.timestamp, reverse=True)

        total_items = len(filtered_logs)
        safe_page_size = max(1, page_size)
        total_pages = max(1, (total_items + safe_page_size - 1) // safe_page_size)
        safe_page = min(max(1, page), total_pages) if total_items > 0 else 1

        start_idx = (safe_page - 1) * safe_page_size
        end_idx = start_idx + safe_page_size
        items = filtered_logs[start_idx:end_idx]

        has_next = safe_page < total_pages
        has_prev = safe_page > 1

        pagination = ReceptionAuditLogPagination(
            page=safe_page,
            page_size=safe_page_size,
            pageSize=safe_page_size,
            total_items=total_items,
            totalItems=total_items,
            total_pages=total_pages,
            totalPages=total_pages,
            has_next=has_next,
            hasNext=has_next,
            has_prev=has_prev,
            hasPrev=has_prev,
        )

        return ReceptionAuditLogResponse(
            items=items,
            pagination=pagination,
        )

    async def get_shift_pre_close_audit(
        self,
        ca_kham: str,
        query_date: Optional[date],
        db: AsyncSession
    ) -> PreCloseShiftAuditResponse:
        """
        Quét và đối soát trước khi đóng ca trực Lễ tân:
        - Quét các ca đang khám dở (DANG_KHAM)
        - Quét các ca đang chờ khám (CHO_KHAM)
        - Quét các ca tạm hoãn (TAM_HOAN)
        - Quét các lịch hẹn trong ca quá giờ chưa check-in (NO_SHOW)
        - Quét danh sách chờ (Waitlist) của ca
        - Đối chiếu tình trạng chốt tiền quầy thu ngân (KhoaSoCaTruc)
        - Đưa ra đề xuất xử lý tự động phù hợp
        """
        now = clinic_now()
        target_date = query_date or now.date()
        target_ca = ca_kham.lower().strip()
        vn_tz = timezone(timedelta(hours=7))

        stmt_tickets = (
            select(HangDoiKham)
            .options(
                selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HangDoiKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(HangDoiKham.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(HangDoiKham.phong_kham).selectinload(PhongKham.chuyen_khoa),
                selectinload(HangDoiKham.lich_kham).selectinload(LichKham.chuyen_khoa),
            )
            .where(
                HangDoiKham.ngay_kham == target_date,
                HangDoiKham.ca_kham == target_ca,
            )
        )
        tickets = (await db.execute(stmt_tickets)).scalars().all()

        dang_kham_list: List[PreCloseExaminingDetailItem] = []
        cho_kham_list: List[PreCloseWaitingDetailItem] = []
        tam_hoan_list: List[PreCloseDeferredDetailItem] = []

        now_naive = now.replace(tzinfo=None)

        for t in tickets:
            patient_name = t.benh_nhan.nguoi_dung.ho_ten if (t.benh_nhan and getattr(t.benh_nhan, "nguoi_dung", None)) else "Bệnh nhân"
            doctor_name = f"BS. {t.bac_si.nguoi_dung.ho_ten}" if (t.bac_si and getattr(t.bac_si, "nguoi_dung", None)) else "Bác sĩ phụ trách"
            room_name = t.phong_kham.ten_phong if t.phong_kham else "Chưa gán phòng"
            t_code = self._generate_queue_code(t)

            if t.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value:
                start_dt = t.thoi_gian_bat_dau or t.thoi_gian_goi_kham or t.thoi_gian_check_in
                start_local = start_dt.astimezone(vn_tz).replace(tzinfo=None) if (start_dt and start_dt.tzinfo) else start_dt
                start_str = start_local.strftime("%H:%M") if start_local else ""
                dang_kham_list.append(
                    PreCloseExaminingDetailItem(
                        ticket_id=t.id,
                        ticket_code=t_code,
                        ten_benh_nhan=patient_name,
                        bac_si_id=t.bac_si_id,
                        ten_bac_si=doctor_name,
                        phong_kham=room_name,
                        gio_vao_kham=start_str,
                    )
                )
            elif t.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value:
                ci_dt = t.thoi_gian_xep_hang_lai or t.thoi_gian_check_in or t.created_at
                ci_local = ci_dt.astimezone(vn_tz).replace(tzinfo=None) if (ci_dt and ci_dt.tzinfo) else ci_dt
                wait_min = int(max(0, (now_naive - ci_local).total_seconds() // 60)) if ci_local else 0
                cho_kham_list.append(
                    PreCloseWaitingDetailItem(
                        ticket_id=t.id,
                        ticket_code=t_code,
                        ten_benh_nhan=patient_name,
                        loai_hang_doi=t.loai_hang_doi,
                        bac_si_id=t.bac_si_id,
                        ten_bac_si=doctor_name,
                        phong_kham=room_name,
                        thoi_gian_cho_phut=wait_min,
                    )
                )
            elif t.trang_thai == TrangThaiHangDoiEnum.TAM_HOAN.value:
                tam_hoan_list.append(
                    PreCloseDeferredDetailItem(
                        ticket_id=t.id,
                        ticket_code=t_code,
                        ten_benh_nhan=patient_name,
                        so_lan_goi=t.so_lan_goi,
                        ten_bac_si=doctor_name,
                        phong_kham=room_name,
                    )
                )

        stmt_lich = (
            select(LichKham)
            .options(
                selectinload(LichKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(LichKham.bac_si).selectinload(BacSi.nguoi_dung),
            )
            .where(
                LichKham.ngay_kham == target_date,
                LichKham.ca_kham == target_ca,
                LichKham.trang_thai.in_([
                    TrangThaiLichEnum.DA_XAC_NHAN.value,
                    TrangThaiLichEnum.CHO_XAC_NHAN.value,
                ])
            )
        )
        lich_unattended = (await db.execute(stmt_lich)).scalars().all()
        no_show_list: List[PreCloseNoShowDetailItem] = []
        for lk in lich_unattended:
            p_name = lk.benh_nhan.nguoi_dung.ho_ten if (lk.benh_nhan and getattr(lk.benh_nhan, "nguoi_dung", None)) else "Bệnh nhân"
            p_phone = lk.benh_nhan.nguoi_dung.so_dien_thoai if (lk.benh_nhan and getattr(lk.benh_nhan, "nguoi_dung", None)) else ""
            bs_name = f"BS. {lk.bac_si.nguoi_dung.ho_ten}" if (lk.bac_si and getattr(lk.bac_si, "nguoi_dung", None)) else "Bác sĩ"
            g_kham = lk.gio_kham.strftime("%H:%M") if lk.gio_kham else ""
            no_show_list.append(
                PreCloseNoShowDetailItem(
                    lich_kham_id=lk.id,
                    ma_lich_kham=lk.ma_lich_kham,
                    ten_benh_nhan=p_name,
                    so_dien_thoai=p_phone,
                    gio_kham=g_kham,
                    ten_bac_si=bs_name,
                )
            )

        stmt_wl = (
            select(DanhSachCho)
            .options(
                selectinload(DanhSachCho.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(DanhSachCho.bac_si).selectinload(BacSi.nguoi_dung),
            )
            .where(
                DanhSachCho.ngay_mong_muon == target_date,
                DanhSachCho.ca_mong_muon == target_ca,
                DanhSachCho.trang_thai.in_([
                    TrangThaiWaitlistEnum.DANG_CHO.value,
                    TrangThaiWaitlistEnum.DA_THONG_BAO.value,
                ])
            )
            .order_by(DanhSachCho.thu_tu_uu_tien.asc())
        )
        wl_entries = (await db.execute(stmt_wl)).scalars().all()
        waitlist_items: List[PreCloseWaitlistDetailItem] = []
        for w in wl_entries:
            w_name = w.benh_nhan.nguoi_dung.ho_ten if (w.benh_nhan and getattr(w.benh_nhan, "nguoi_dung", None)) else "Bệnh nhân"
            w_phone = w.benh_nhan.nguoi_dung.so_dien_thoai if (w.benh_nhan and getattr(w.benh_nhan, "nguoi_dung", None)) else ""
            w_bs = f"BS. {w.bac_si.nguoi_dung.ho_ten}" if (w.bac_si and getattr(w.bac_si, "nguoi_dung", None)) else "Bác sĩ"
            waitlist_items.append(
                PreCloseWaitlistDetailItem(
                    waitlist_id=w.id,
                    ten_benh_nhan=w_name,
                    so_dien_thoai=w_phone,
                    ten_bac_si_mong_muon=w_bs,
                    thu_tu_uu_tien=w.thu_tu_uu_tien,
                )
            )

        ca_db_str = "SANG" if target_ca == "sang" else "CHIEU"
        stmt_ks = (
            select(KhoaSoCaTruc)
            .options(selectinload(KhoaSoCaTruc.thu_ngan_giao))
            .where(
                KhoaSoCaTruc.ngay_khoa_so == target_date,
                or_(KhoaSoCaTruc.ca_lam_viec == ca_db_str, KhoaSoCaTruc.ca_lam_viec == "CA_NGAY")
            )
            .order_by(KhoaSoCaTruc.created_at.desc())
        )
        ks_rec = (await db.execute(stmt_ks)).scalars().first()
        da_khoa_so = ks_rec is not None
        ma_ks = ks_rec.ma_khoa_so if ks_rec else None
        thu_ngan_name = ks_rec.thu_ngan_giao.ho_ten if (ks_rec and ks_rec.thu_ngan_giao) else None
        tong_tien_mat = float(ks_rec.tong_tien_mat_he_thong or 0.0) if ks_rec else 0.0
        tong_chuyen_khoan = float(ks_rec.tong_chuyen_khoan_he_thong or 0.0) if ks_rec else 0.0

        cashier_detail = PreCloseCashierAuditDetail(
            da_khoa_so=da_khoa_so,
            ma_khoa_so=ma_ks,
            thu_ngan_chot=thu_ngan_name,
            tong_tien_mat=tong_tien_mat,
            tong_chuyen_khoan=tong_chuyen_khoan,
        )

        if target_ca == "sang":
            de_xuat_xu_ly = "CHUYEN_CA_TIEP_THEO"
            warn_msg = f"Đề xuất giữ nguyên số thứ tự và chuyển {len(cho_kham_list) + len(tam_hoan_list)} lượt chờ sang ca chiều để bác sĩ ca chiều gọi tiếp."
            if dang_kham_list:
                warn_msg += f" Lưu ý có {len(dang_kham_list)} ca đang khám, bác sĩ có thể khám nốt mà không bị gián đoạn."
        else:
            de_xuat_xu_ly = "DONG_VE"
            warn_msg = f"Hết ngày làm việc: Đề xuất đóng vé tự động cho {len(cho_kham_list) + len(tam_hoan_list)} lượt chờ còn tồn đọng và chốt No-show cho {len(no_show_list)} lịch hẹn không đến."

        return PreCloseShiftAuditResponse(
            ngay=target_date,
            ca_kham=target_ca,
            canh_bao=PreCloseAuditWarningSummary(
                so_dang_kham=len(dang_kham_list),
                so_cho_kham_chua_kham=len(cho_kham_list),
                so_tam_hoan=len(tam_hoan_list),
                so_lich_hen_no_show=len(no_show_list),
                so_waitlist_ton=len(waitlist_items),
                thu_ngan_da_khoa_so=da_khoa_so,
                tien_mat_da_thu=tong_tien_mat,
            ),
            chi_tiet=PreCloseAuditDetailGroup(
                dang_kham=dang_kham_list,
                cho_kham=cho_kham_list,
                tam_hoan=tam_hoan_list,
                lich_hen_no_show=no_show_list,
                waitlist_ton=waitlist_items,
                doi_chieu_thu_ngan=cashier_detail,
            ),
            de_xuat_hanh_dong=PreCloseActionRecommendation(
                loai_ca=target_ca,
                de_xuat_xu_ly_cho_kham=de_xuat_xu_ly,
                tu_dong_chot_no_show=True,
                ghi_chu_canh_bao=warn_msg,
            ),
        )

    async def close_reception_shift(
        self,
        payload: CloseReceptionShiftRequest,
        current_user: TaiKhoan,
        db: AsyncSession
    ) -> CloseReceptionShiftResponse:
        """
        Thực hiện đóng ca và bàn giao ca trực Lễ tân:
        - Xử lý các vé đang chờ (CHUYEN_CA_TIEP_THEO cho ca sáng, hoặc DONG_VE cho ca chiều)
        - Tự động chốt No-show cho các lịch hẹn quá giờ nếu chọn
        - Ghi vết kiểm toán bàn giao ca
        """
        now = clinic_now()
        target_date = payload.ngay or now.date()
        target_ca = payload.ca_kham.lower().strip()

        stmt_tickets = (
            select(HangDoiKham)
            .where(
                HangDoiKham.ngay_kham == target_date,
                HangDoiKham.ca_kham == target_ca,
                HangDoiKham.trang_thai.in_([
                    TrangThaiHangDoiEnum.CHO_KHAM.value,
                    TrangThaiHangDoiEnum.TAM_HOAN.value,
                ])
            )
            .with_for_update()
        )
        pending_tickets = (await db.execute(stmt_tickets)).scalars().all()

        so_chuyen = 0
        so_dong = 0

        if payload.xu_ly_cho_kham == "CHUYEN_CA_TIEP_THEO":
            # Cập nhật thời gian xếp hàng lại từ đầu ca chiều 13:30 (không tính giờ nghỉ trưa)
            afternoon_start_local = datetime.combine(target_date, time(13, 30))
            vn_tz = timezone(timedelta(hours=7))
            afternoon_start_utc = afternoon_start_local.replace(tzinfo=vn_tz).astimezone(timezone.utc)

            for t in pending_tickets:
                t.ca_kham = "chieu"
                t.thoi_gian_xep_hang_lai = afternoon_start_utc
                t.ghi_chu_dieu_phoi = (
                    f"Chuyển tiếp từ ca sáng sang ca chiều. "
                    f"Nội dung bàn giao: {payload.ghi_chu_ban_giao or 'Chờ khám tiếp theo'}"
                )
                so_chuyen += 1
        else:
            for t in pending_tickets:
                t.trang_thai = TrangThaiHangDoiEnum.DA_DONG_VE.value
                t.thoi_gian_ket_thuc = now
                t.ghi_chu_dieu_phoi = (
                    f"Đóng vé kết thúc ca trực {target_ca}. "
                    f"Lý do: {payload.ghi_chu_ban_giao or 'Hết ca trực/Hết giờ làm việc phòng khám'}"
                )
                so_dong += 1

        so_no_show = 0
        if payload.tu_dong_chot_no_show:
            stmt_lich = (
                select(LichKham)
                .options(selectinload(LichKham.benh_nhan))
                .where(
                    LichKham.ngay_kham == target_date,
                    LichKham.ca_kham == target_ca,
                    LichKham.trang_thai.in_([
                        TrangThaiLichEnum.DA_XAC_NHAN.value,
                        TrangThaiLichEnum.CHO_XAC_NHAN.value,
                    ])
                )
                .with_for_update()
            )
            no_show_appointments = (await db.execute(stmt_lich)).scalars().all()
            for lk in no_show_appointments:
                lk.trang_thai = TrangThaiLichEnum.NO_SHOW.value
                lk.ly_do_huy = f"Không đến khám ca {target_ca} (Chốt khi đóng ca trực)"
                if lk.benh_nhan:
                    lk.benh_nhan.so_lan_no_show = (lk.benh_nhan.so_lan_no_show or 0) + 1
                so_no_show += 1

        user_name = "Lễ tân ca trực"
        if getattr(current_user, "nguoi_dung_id", None):
            u_db = await db.get(NguoiDung, current_user.nguoi_dung_id)
            if u_db and u_db.ho_ten:
                user_name = u_db.ho_ten

        receiver_name = None
        if payload.nguoi_nhan_ban_giao_id:
            recv_user = await db.get(TaiKhoan, payload.nguoi_nhan_ban_giao_id)
            if recv_user:
                recv_nd = await db.get(NguoiDung, recv_user.nguoi_dung_id)
                if recv_nd:
                    receiver_name = recv_nd.ho_ten

        await db.commit()

        return CloseReceptionShiftResponse(
            ca_kham_dong=target_ca,
            ngay=target_date,
            so_ve_chuyen_ca_chieu=so_chuyen,
            so_ve_dong=so_dong,
            so_lich_chot_no_show=so_no_show,
            nguoi_dong_ca=user_name,
            nguoi_nhan_ban_giao=receiver_name,
            thoi_gian_dong_ca=now,
            ghi_chu_ban_giao=payload.ghi_chu_ban_giao,
        )



queue_service = QueueService()