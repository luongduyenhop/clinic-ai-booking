import logging
from datetime import date, datetime, timezone, timedelta
from typing import List, Optional, Union
from sqlalchemy import func, select, or_, and_, Select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    NotFoundException,
)
from app.models.appointment import (
    HangDoiKham,
    LichKham,
    LichLamViec,
    LoaiHangDoiEnum,
    NghiPhepBacSi,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
    TrangThaiNghiPhepEnum,
)
from app.models.user import BacSi, BenhNhan, TaiKhoan, VaiTroEnum, PhongKham
from app.services.appointment.appointment_service import clinic_now
from app.services.reception.timezone_utils import (
    clinic_shift_start_utc,
    ensure_utc,
    to_clinic_aware,
    to_clinic_naive,
    utc_now,
)
from app.schemas.queue import (
    DoctorQueueBoardResponse,
    PatientFlowBoardItem,
    PatientFlowBoardResponse,
    HourlyCheckInDensityItem,
    UpcomingAppointmentSummaryItem,
    LongWaitingTicketItem,
    ReceptionActivityItem,
    ShiftDashboardResponse,
    RoomStatusItem,
    RoomStatusDashboardResponse,
)

logger = logging.getLogger(__name__)


async def get_doctor_queue_board(
    self,
    doctor_id: int,
    query_date: Optional[date] = None,
    ca_kham: Optional[Union[str, AsyncSession]] = None,
    db: Optional[AsyncSession] = None,
) -> DoctorQueueBoardResponse:
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
    )
    if ca_kham:
        stmt_tickets = stmt_tickets.where(HangDoiKham.ca_kham == ca_kham)
    stmt_tickets = stmt_tickets.order_by(
        HangDoiKham.muc_do_uu_tien.asc(),
        func.coalesce(HangDoiKham.thoi_gian_xep_hang_lai, HangDoiKham.thoi_gian_check_in).asc(),
        HangDoiKham.so_thu_tu_kham.asc(),
    )

    all_tickets = (await db.execute(stmt_tickets)).scalars().all()

    waiting = [self._to_ticket_response(t) for t in all_tickets if t.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value]

    postponed = [
        self._to_ticket_response(t) for t in all_tickets if t.trang_thai == TrangThaiHangDoiEnum.TAM_HOAN.value
    ]

    current = next(
        (self._to_ticket_response(t) for t in all_tickets if t.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value), None
    )

    completed = [
        self._to_ticket_response(t)
        for t in all_tickets
        if t.trang_thai
        in (
            TrangThaiHangDoiEnum.DA_KHAM.value,
            TrangThaiHangDoiEnum.BO_KHAM.value,
            TrangThaiHangDoiEnum.DA_DONG_VE.value,
        )
    ]

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
            or_(HangDoiKham.phong_kham_id == room_id, HangDoiKham.bac_si.has(BacSi.phong_kham_id == room_id))
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
        start_wait = t.thoi_gian_xep_hang_lai or t.thoi_gian_check_in
        if start_wait:
            cin = ensure_utc(start_wait)
            if t.ngay_kham and cin.date() < t.ngay_kham:
                shift_start = clinic_shift_start_utc(t.ngay_kham)
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


async def get_shift_dashboard(
    self, query_date: Optional[date], ca_kham: Optional[str], db: AsyncSession
) -> ShiftDashboardResponse:
    now_dt = clinic_now()
    target_date = query_date or now_dt.date()
    is_all_day = bool(ca_kham and ca_kham.strip().lower() == "all")
    target_ca = None if is_all_day else (ca_kham or self._determine_shift(now_dt.time()))
    response_ca = "all" if is_all_day else target_ca

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

    tickets = [t for t in all_today_tickets if t.ca_kham == target_ca] if target_ca else all_today_tickets

    so_da_check_in = len(tickets)
    so_dang_cho = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value)
    so_dang_kham = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value)
    so_da_kham = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.DA_KHAM.value)
    so_tam_hoan = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.TAM_HOAN.value)
    so_vang_mat_chua_xu_ly = sum(
        1 for a in all_apts if a.trang_thai in (TrangThaiLichEnum.NO_SHOW.value, "no_show", "vang_mat")
    )
    so_vang_lai = sum(1 for t in tickets if t.loai_hang_doi == LoaiHangDoiEnum.VANG_LAI.value)
    so_bo_kham = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.BO_KHAM.value)
    so_da_dong_ve = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.DA_DONG_VE.value)

    standard_hours = ["07:30", "08:30", "09:30", "10:30", "13:30", "14:30", "15:30"]
    counts_by_slot = {h: 0 for h in standard_hours}

    for t in all_today_tickets:
        ci_dt = t.thoi_gian_check_in
        if ci_dt:
            ci_local = to_clinic_aware(ci_dt)
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

    mat_do_theo_gio = [HourlyCheckInDensityItem(khung_gio=h, so_luong=counts_by_slot[h]) for h in standard_hours]

    checked_in_apt_ids = {t.lich_kham_id for t in all_today_tickets if t.lich_kham_id}
    upcoming_apts = [
        a
        for a in all_apts
        if a.id not in checked_in_apt_ids
        and a.trang_thai in (TrangThaiLichEnum.CHO_XAC_NHAN.value, TrangThaiLichEnum.DA_XAC_NHAN.value, "da_xac_nhan")
    ]
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

    waiting_tickets = [t for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value]
    waiting_data = []
    for t in waiting_tickets:
        ci_dt = t.thoi_gian_xep_hang_lai or t.thoi_gian_check_in
        wait_mins = 0
        ci_local = None
        if ci_dt:
            ci_local = to_clinic_naive(ci_dt)
            wait_mins = max(0, int((now_dt - ci_local).total_seconds() / 60))
        waiting_data.append((t, wait_mins, ci_local))

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

    recent_tickets = sorted(all_today_tickets, key=lambda t: t.thoi_gian_check_in or t.created_at, reverse=True)[:10]
    hoat_dong_gan_day = []
    for t in recent_tickets:
        action_type = "WALK_IN_CREATE" if t.loai_hang_doi == LoaiHangDoiEnum.VANG_LAI.value else "CHECK_IN"
        if t.trang_thai == TrangThaiHangDoiEnum.BO_KHAM.value:
            action_type = "LEAVE_QUEUE"
        elif t.trang_thai == TrangThaiHangDoiEnum.DA_DONG_VE.value:
            action_type = "CLOSE_TICKET"
        elif t.ghi_chu_dieu_phoi and "chuyển" in t.ghi_chu_dieu_phoi.lower():
            action_type = "TRANSFER_ROOM"

        ten_bn = (
            t.benh_nhan.nguoi_dung.ho_ten
            if (t.benh_nhan and getattr(t.benh_nhan, "nguoi_dung", None) and t.benh_nhan.nguoi_dung.ho_ten)
            else "Bệnh nhân"
        )
        phong_str = f" tại {t.phong_kham.ten_phong} ({t.phong_kham.ma_phong})" if t.phong_kham else ""
        stt_str = self._generate_queue_code(t)
        noi_dung = f"Bệnh nhân {ten_bn} ({stt_str}){phong_str}"

        t_dt = t.thoi_gian_check_in or t.created_at
        t_local = to_clinic_aware(t_dt) if t_dt else None
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
        ca_kham=response_ca,
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
        da_check_in=so_da_check_in,
        dang_cho_kham=so_dang_cho,
        dang_kham=so_dang_kham,
        da_kham=so_da_kham,
        vang_mat=so_vang_mat_chua_xu_ly,
        bo_kham=so_bo_kham,
        vang_lai=so_vang_lai,
        mat_do_theo_gio=mat_do_theo_gio,
        lich_hen_sap_toi=lich_hen_sap_toi,
        benh_nhan_cho_lau=benh_nhan_cho_lau,
        hoat_dong_gan_day=hoat_dong_gan_day,
    )


async def get_room_status_dashboard(
    self, query_date: Optional[date], ca_kham: Optional[str], db: AsyncSession
) -> RoomStatusDashboardResponse:

    now_dt = clinic_now()

    target_date = query_date or now_dt.date()

    is_all_day = bool(ca_kham and ca_kham.strip().lower() == "all")

    target_ca = "all" if is_all_day else (ca_kham or self._determine_shift(now_dt.time()))

    stmt_rooms = select(PhongKham).options(selectinload(PhongKham.chuyen_khoa)).order_by(PhongKham.ma_phong)

    rooms = (await db.execute(stmt_rooms)).scalars().all()

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

    if ca_kham and not is_all_day:
        stmt_llv = stmt_llv.where(LichLamViec.ca_lam_viec == ca_kham)

    rosters = (await db.execute(stmt_llv)).scalars().all()

    stmt_leaves = select(NghiPhepBacSi.bac_si_id, NghiPhepBacSi.ca_lam_viec).where(
        NghiPhepBacSi.trang_thai == TrangThaiNghiPhepEnum.DA_DUYET.value,
        NghiPhepBacSi.tu_ngay <= target_date,
        NghiPhepBacSi.den_ngay >= target_date,
    )
    leaves_by_doc: dict[int, set[Optional[str]]] = {}
    for doc_id, leave_ca in (await db.execute(stmt_leaves)).all():
        leaves_by_doc.setdefault(doc_id, set()).add(leave_ca)

    current_shift = self._determine_shift(now_dt.time())

    room_roster_map = {}

    for ros in rosters:
        if not ros.phong_kham_id:
            continue
        if ros.bac_si and not ros.bac_si.is_active:
            continue
        doc_leaves = leaves_by_doc.get(ros.bac_si_id, set())
        if None in doc_leaves or ros.ca_lam_viec in doc_leaves:
            continue

        if ros.phong_kham_id not in room_roster_map or ros.ca_lam_viec == current_shift:
            room_roster_map[ros.phong_kham_id] = ros

    stmt_q = (
        select(HangDoiKham)
        .options(selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung))
        .where(HangDoiKham.ngay_kham == target_date)
    )

    if ca_kham and not is_all_day:
        stmt_q = stmt_q.where(HangDoiKham.ca_kham == ca_kham)

    tickets = (await db.execute(stmt_q)).scalars().all()

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

        ten_bac_si = (
            roster.bac_si.nguoi_dung.ho_ten if (roster and roster.bac_si and roster.bac_si.nguoi_dung) else None
        )

        chuyen_khoa_ten = (
            roster.bac_si.chuyen_khoa.ten_chuyen_khoa
            if (roster and roster.bac_si and roster.bac_si.chuyen_khoa)
            else (r.chuyen_khoa.ten_chuyen_khoa if r.chuyen_khoa else None)
        )

        if not bac_si_id and not rosters and r.id in doc_room_map:
            fallback_doc = doc_room_map[r.id]
            doc_leaves = leaves_by_doc.get(fallback_doc.id, set())
            fallback_shift = None if is_all_day else target_ca
            if None not in doc_leaves and (fallback_shift is None or fallback_shift not in doc_leaves):
                bac_si_id = fallback_doc.id
                ten_bac_si = fallback_doc.nguoi_dung.ho_ten if fallback_doc.nguoi_dung else None
                if not chuyen_khoa_ten and fallback_doc.chuyen_khoa:
                    chuyen_khoa_ten = fallback_doc.chuyen_khoa.ten_chuyen_khoa

        seen_ticket_ids = set()
        b_tickets = []
        if bac_si_id and bac_si_id in doc_tickets:
            for t in doc_tickets[bac_si_id]:
                if t.id not in seen_ticket_ids:
                    seen_ticket_ids.add(t.id)
                    b_tickets.append(t)
        if r.id in room_tickets:
            for t in room_tickets[r.id]:
                if t.bac_si_id and bac_si_id and t.bac_si_id != bac_si_id:
                    continue
                if t.bac_si_id and any(
                    other_rm_id != r.id and other_ros.bac_si_id == t.bac_si_id
                    for other_rm_id, other_ros in room_roster_map.items()
                ):
                    continue
                if t.id not in seen_ticket_ids:
                    seen_ticket_ids.add(t.id)
                    b_tickets.append(t)

        so_benh_nhan_cho = sum(
            1
            for t in b_tickets
            if str(t.trang_thai).lower() in ("cho_kham", "cho_goi", "dang_goi", "waiting", "called", "da_goi")
        )

        dang_kham_ticket = next(
            (t for t in b_tickets if str(t.trang_thai).lower() in ("dang_kham", "in_consultation")), None
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
