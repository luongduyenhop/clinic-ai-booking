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
from app.services.appointment.appointment_service import clinic_now
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

async def search_appointments(

    self, query_str: str, query_date: Optional[date], db: AsyncSession

) -> List[AppointmentReceptionSearchResult]:

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

    count_stmt = select(func.count()).select_from(stmt.subquery())

    total = (await db.execute(count_stmt)).scalar() or 0

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

                ly_do_kham=a.ly_do_kham,

                trieu_chung_ban_dau=a.trieu_chung_ban_dau,

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

    stmt_counts = (

        select(HangDoiKham.bac_si_id, HangDoiKham.ca_kham, func.count(HangDoiKham.id))

        .where(
            HangDoiKham.ngay_kham == target_date,
            HangDoiKham.trang_thai.notin_([
                TrangThaiHangDoiEnum.BO_KHAM.value,
                TrangThaiHangDoiEnum.DA_DONG_VE.value,
            ]),
        )

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
    db: AsyncSession,
    query_date: Optional[date] = None,
    ca_kham: Optional[str] = None,
    chuyen_khoa_id: Optional[int] = None,
    tu_ngay: Optional[date] = None,
    den_ngay: Optional[date] = None,
) -> List[RosterTemplateItem]:
    stmt = (
        select(LichLamViec)
        .options(
            selectinload(LichLamViec.bac_si).selectinload(BacSi.nguoi_dung),
            selectinload(LichLamViec.bac_si).selectinload(BacSi.chuyen_khoa),
            selectinload(LichLamViec.bac_si).selectinload(BacSi.phong_kham),
            selectinload(LichLamViec.phong_kham),
        )
        .order_by(
            LichLamViec.ngay_lam_viec.asc(),
            LichLamViec.ca_lam_viec.asc(),
            LichLamViec.id.asc(),
        )
    )

    if query_date:
        stmt = stmt.where(LichLamViec.ngay_lam_viec == query_date)
    else:
        if tu_ngay:
            stmt = stmt.where(LichLamViec.ngay_lam_viec >= tu_ngay)
        if den_ngay:
            stmt = stmt.where(LichLamViec.ngay_lam_viec <= den_ngay)

    if ca_kham:
        stmt = stmt.where(LichLamViec.ca_lam_viec == ca_kham)

    if chuyen_khoa_id:
        stmt = stmt.where(LichLamViec.bac_si.has(BacSi.chuyen_khoa_id == chuyen_khoa_id))

    shifts = (await db.execute(stmt)).scalars().all()

    results: List[RosterTemplateItem] = []
    for s in shifts:
        day_of_week = s.ngay_lam_viec.isoweekday() + 1 if s.ngay_lam_viec else 2
        if thu_trong_tuan and day_of_week != thu_trong_tuan:
            continue

        phong_obj = s.phong_kham or (s.bac_si.phong_kham if s.bac_si else None)
        phong_display = (
            f"{phong_obj.ten_phong} ({phong_obj.ma_phong})"
            if phong_obj and phong_obj.ma_phong
            else (phong_obj.ten_phong if phong_obj else None)
        )
        ck_obj = s.bac_si.chuyen_khoa if s.bac_si else None

        results.append(
            RosterTemplateItem(
                id=s.id,
                bac_si_id=s.bac_si_id,
                ten_bac_si=s.bac_si.nguoi_dung.ho_ten if s.bac_si and s.bac_si.nguoi_dung else "N/A",
                chuyen_khoa_id=s.bac_si.chuyen_khoa_id if s.bac_si else None,
                ten_chuyen_khoa=ck_obj.ten_chuyen_khoa if ck_obj else None,
                ngay_lam_viec=s.ngay_lam_viec,
                thu_trong_tuan=day_of_week,
                ca_lam_viec=s.ca_lam_viec,
                gio_bat_dau=s.gio_bat_dau.strftime("%H:%M") if s.gio_bat_dau else "",
                gio_ket_thuc=s.gio_ket_thuc.strftime("%H:%M") if s.gio_ket_thuc else "",
                phong_kham_id=phong_obj.id if phong_obj else None,
                ma_phong=phong_obj.ma_phong if phong_obj else None,
                phong_kham=phong_display,
                gioi_han_ca_kham=s.gioi_han_ca_kham,
                han_muc_dat_truoc=s.han_muc_dat_truoc,
                han_muc_vang_lai=s.han_muc_vang_lai,
                ghi_chu_nghi=s.ghi_chu_nghi,
                is_active=s.is_active,
            )
        )
    return results

async def get_patient_packages(self, benh_nhan_id: int, db: AsyncSession) -> List[PatientPackageItem]:

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

    stmt_bn = (

        select(BenhNhan)

        .options(selectinload(BenhNhan.nguoi_dung))

        .where(BenhNhan.id == benh_nhan_id)

    )

    bn = (await db.execute(stmt_bn)).scalar_one_or_none()

    if not bn:

        raise NotFoundException(f"Không tìm thấy bệnh nhân ID {benh_nhan_id}!")

    packages = await self.get_patient_packages(benh_nhan_id, db)

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
