import logging
import uuid
from datetime import date, datetime, time, timezone, timedelta
from typing import List, Optional, Union, Any, Tuple
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
    LyDoUuTienEnum,
)
from app.models.user import BacSi, BenhNhan, ChuyenKhoa, NguoiDung, TaiKhoan, VaiTroEnum, PhongKham
import app.services.queue_service as queue_service_module
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

def _determine_shift(self, t: time) -> str:
    if t < time(12, 30):
        return CaLamViecEnum.SANG.value
    return CaLamViecEnum.CHIEU.value

async def _resolve_doctor_shift_room(
    self,
    doctor_id: Optional[int],
    target_date: date,
    ca_kham: str,
    fallback_room_id: Optional[int],
    db: AsyncSession,
) -> Tuple[Optional[int], Optional[int]]:
    if not doctor_id:
        return None, fallback_room_id
    stmt = (
        select(LichLamViec)
        .where(
            LichLamViec.bac_si_id == doctor_id,
            LichLamViec.ngay_lam_viec == target_date,
            LichLamViec.ca_lam_viec == ca_kham,
            LichLamViec.is_active.is_(True),
        )
        .order_by(LichLamViec.id.desc())
    )
    shift = (await db.execute(stmt)).scalars().first()
    if shift:
        return shift.id, shift.phong_kham_id or fallback_room_id
    return None, fallback_room_id

def _generate_queue_code(self, ticket: HangDoiKham) -> str:

    stt = ticket.so_thu_tu_kham or 1

    prefix = "PK"

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

        start_wait = cin
        if ticket.thoi_gian_xep_hang_lai:
            xhl = ticket.thoi_gian_xep_hang_lai
            if xhl.tzinfo is None:
                xhl = xhl.replace(tzinfo=timezone.utc)
            start_wait = xhl
        elif ticket.ngay_kham and cin.date() < ticket.ngay_kham:
            start_wait = datetime.combine(ticket.ngay_kham, datetime.min.time(), tzinfo=timezone.utc).replace(hour=0, minute=30)

        if ticket.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value:
            end_wait = ticket.thoi_gian_bat_dau or ticket.thoi_gian_goi_kham or now
            if end_wait.tzinfo is None:
                end_wait = end_wait.replace(tzinfo=timezone.utc)
            thoi_gian_cho = max(0, int((end_wait - start_wait).total_seconds() / 60))
        elif ticket.trang_thai == TrangThaiHangDoiEnum.DA_KHAM.value:
            end_wait = ticket.thoi_gian_bat_dau or ticket.thoi_gian_goi_kham or ticket.thoi_gian_ket_thuc or ticket.updated_at or start_wait
            if end_wait.tzinfo is None:
                end_wait = end_wait.replace(tzinfo=timezone.utc)
            thoi_gian_cho = max(0, int((end_wait - start_wait).total_seconds() / 60))
        elif ticket.trang_thai in (TrangThaiHangDoiEnum.BO_KHAM.value, TrangThaiHangDoiEnum.DA_DONG_VE.value):
            end_wait = ticket.updated_at or start_wait
            if end_wait.tzinfo is None:
                end_wait = end_wait.replace(tzinfo=timezone.utc)
            thoi_gian_cho = max(0, int((end_wait - start_wait).total_seconds() / 60))
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

async def check_in_patient(

    self,

    payload: CheckInRequest,

    receptionist_user: TaiKhoan,

    db: AsyncSession,

) -> QueueTicketResponse:

    if receptionist_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):

        raise ForbiddenException("Chức năng Check-in tại quầy chỉ dành riêng cho Lễ tân hoặc Quản trị viên!")

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

    today_date = queue_service_module.clinic_now().date()

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

        logger.info(f"Lịch hẹn {lich.ma_lich_kham} đã check-in trước đó, trả về vé STT #{existing_ticket.so_thu_tu_kham}")

        return await self._get_ticket_with_relations(existing_ticket.id, db)

    now = datetime.now(timezone.utc)

    if lich.bac_si_id is None:

        ca_kham = lich.ca_kham or self._determine_shift(queue_service_module.clinic_now().time())

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

            lich.gio_kham = queue_service_module.clinic_now().time()

        stmt_bs = (

            select(BacSi)

            .options(selectinload(BacSi.nguoi_dung), selectinload(BacSi.chuyen_khoa))

            .where(BacSi.id == assigned_doc_id)

        )

        lich.bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()

    else:

        ca_kham = self._determine_shift(lich.gio_kham) if lich.gio_kham else (lich.ca_kham or self._determine_shift(queue_service_module.clinic_now().time()))

    if payload.ly_do_uu_tien:

        muc_do_uu_tien = 1

        loai_hang_doi = LoaiHangDoiEnum.DUNG_HEN.value

        ly_do_str = payload.ly_do_uu_tien.value if hasattr(payload.ly_do_uu_tien, "value") else str(payload.ly_do_uu_tien)

        ghi_chu_priority = f"Ưu tiên ({ly_do_str})"

        ghi_chu = f"{ghi_chu_priority} | {payload.ghi_chu}".strip(" | ") if payload.ghi_chu else ghi_chu_priority

    else:

        clinic_tz = timezone(timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS))

        now_clinic = queue_service_module.datetime.now(clinic_tz).replace(tzinfo=None)

        gio_hen = lich.gio_kham or now_clinic.time()

        appointment_dt = queue_service_module.datetime.combine(lich.ngay_kham, gio_hen)

        diff_minutes = (appointment_dt - now_clinic).total_seconds() / 60

        if lich.ngay_kham == now_clinic.date():

            if now_clinic.hour >= 20 and gio_hen.hour < 4:

                diff_minutes += 1440

            elif now_clinic.hour < 4 and gio_hen.hour >= 20:

                diff_minutes -= 1440

        if diff_minutes > 30:

            loai_hang_doi = LoaiHangDoiEnum.DEN_SOM.value

            muc_do_uu_tien = 4

        elif diff_minutes < -15:

            loai_hang_doi = LoaiHangDoiEnum.DEN_MUON.value

            muc_do_uu_tien = 5

        else:

            loai_hang_doi = LoaiHangDoiEnum.DUNG_HEN.value

            muc_do_uu_tien = 2

        ghi_chu = payload.ghi_chu

    stmt_max_stt = select(func.coalesce(func.max(HangDoiKham.so_thu_tu_kham), 0)).where(

        HangDoiKham.bac_si_id == lich.bac_si_id,

        HangDoiKham.ngay_kham == lich.ngay_kham,

        HangDoiKham.ca_kham == ca_kham,

    )

    max_stt = (await db.execute(stmt_max_stt)).scalar()

    next_stt = max_stt + 1

    fallback_room_cin = lich.bac_si.phong_kham_id if (lich.bac_si and lich.bac_si.phong_kham_id) else None
    shift_id_cin, room_id_cin = await self._resolve_doctor_shift_room(
        lich.bac_si_id,
        lich.ngay_kham,
        ca_kham,
        fallback_room_cin,
        db,
    )

    ticket = HangDoiKham(

        lich_kham_id=lich.id,

        lich_lam_viec_id=shift_id_cin,

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

    lich.trang_thai = TrangThaiLichEnum.DA_TIEP_NHAN.value

    await db.commit()

    await db.refresh(ticket)

    return await self._get_ticket_with_relations(ticket.id, db)

async def check_in_walk_in(
    self,
    payload: WalkInCheckInRequest,
    receptionist_user: TaiKhoan,
    db: AsyncSession,
) -> QueueTicketResponse:
    if receptionist_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
        raise ForbiddenException("Chức năng tiếp nhận bệnh nhân vãng lai chỉ dành cho Lễ tân hoặc Admin!")

    today = queue_service_module.clinic_now().date()
    now = datetime.now(timezone.utc)
    effective_ca = payload.ca_kham or self._determine_shift(queue_service_module.clinic_now().time())

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
            bn = (await db.execute(stmt_bn)).scalar_one_or_none()

        effective_benh_nhan_id = bn.id

    if payload.bac_si_id is None and not payload.chuyen_khoa_id:
        raise BadRequestException("Vui lòng chọn bác sĩ tiếp nhận hoặc chuyên khoa để phân bổ tự động!")

    if payload.chuyen_khoa_id:
        stmt_ck = select(ChuyenKhoa).where(ChuyenKhoa.id == payload.chuyen_khoa_id)
        ck = (await db.execute(stmt_ck)).scalar_one_or_none()
        if not ck:
            raise NotFoundException(f"Chuyên khoa ID {payload.chuyen_khoa_id} không tồn tại trên hệ thống!")

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

    if is_overloaded:
        if payload.dang_ky_waitlist_neu_het_cho:
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

            if payload.ly_do_uu_tien:
                ly_do_val = payload.ly_do_uu_tien.value if hasattr(payload.ly_do_uu_tien, "value") else str(payload.ly_do_uu_tien)
                wl_trieu_chung = f"[Ưu tiên: {ly_do_val}] {payload.ly_do_kham or 'Đăng ký chờ slot ca trực'}"
                wl_muc_do_uu_tien = 1
                wl_ghi_chu = f"Đã ghi danh vào Danh sách chờ vị trí #{next_wl} (Ưu tiên: {ly_do_val})"
            else:
                wl_trieu_chung = payload.ly_do_kham or "Tiếp đón quầy: Đăng ký chờ slot do ca trực quá tải"
                wl_muc_do_uu_tien = 5
                wl_ghi_chu = f"Đã ghi danh vào Danh sách chờ vị trí #{next_wl}"

            wl_entry = DanhSachCho(
                benh_nhan_id=effective_benh_nhan_id,
                bac_si_id=effective_doctor_id,
                phong_kham_id=bs.phong_kham_id if bs else None,
                ngay_mong_muon=today,
                ca_mong_muon=effective_ca,
                trieu_chung=wl_trieu_chung,
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
                muc_do_uu_tien=wl_muc_do_uu_tien,
                trang_thai="dang_cho_slot",
                thoi_gian_check_in=now,
                so_lan_goi=0,
                ghi_chu_dieu_phoi=wl_ghi_chu,
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

    stmt_max_stt = select(func.coalesce(func.max(HangDoiKham.so_thu_tu_kham), 0)).where(
        HangDoiKham.bac_si_id == effective_doctor_id,
        HangDoiKham.ngay_kham == today,
        HangDoiKham.ca_kham == effective_ca,
    )
    max_stt = (await db.execute(stmt_max_stt)).scalar() or 0
    next_stt = max_stt + 1

    if payload.ly_do_uu_tien:
        muc_do_uu_tien = 1
        ly_do_str = payload.ly_do_uu_tien.value if hasattr(payload.ly_do_uu_tien, "value") else str(payload.ly_do_uu_tien)
        ghi_chu = f"Ưu tiên ({ly_do_str}): {payload.ly_do_kham or 'Vãng lai ưu tiên'}"
    else:
        muc_do_uu_tien = 5
        ghi_chu = f"Vãng lai: {payload.ly_do_kham or 'Không ghi chú'}"

    if payload.ghi_chu:
        ghi_chu = f"{ghi_chu} | {payload.ghi_chu}"

    base_time = queue_service_module.clinic_now().time()
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

    fallback_room_walkin = bs.phong_kham_id if bs else None
    shift_id_walkin, room_id_walkin = await self._resolve_doctor_shift_room(
        effective_doctor_id,
        today,
        effective_ca,
        fallback_room_walkin,
        db,
    )
    ticket = HangDoiKham(
        lich_kham_id=lich_tai_cho.id,
        lich_lam_viec_id=shift_id_walkin,
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

    return await self._get_ticket_with_relations(ticket.id, db)

async def check_in_walk_in_quick(
    self,
    payload: WalkInQuickRequest,
    receptionist_user: TaiKhoan,
    db: AsyncSession,
) -> QueueTicketResponse:
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
