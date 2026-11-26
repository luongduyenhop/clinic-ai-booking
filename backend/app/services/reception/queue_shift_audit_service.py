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

async def get_reception_report_summary(
    self,
    query_date: Optional[date],
    ca_kham: Optional[str],
    db: AsyncSession
) -> ReceptionReportSummaryResponse:
    now = clinic_now()
    target_date = query_date or now.date()
    vn_tz = timezone(timedelta(hours=7))

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

    wait_times: List[float] = []
    specialty_stats: dict = {}

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
    now = clinic_now()
    target_date = payload.ngay or now.date()
    target_ca = payload.ca_kham.lower().strip()

    if target_date > now.date():
        raise BadRequestException("Không thể đóng ca trực cho ngày trong tương lai!")

    if target_date == now.date() and current_user.vai_tro != VaiTroEnum.ADMIN.value:
        if target_ca == "sang" and now.time() < time(11, 0):
            raise BadRequestException("Chưa đến thời điểm đóng ca sáng! Ca sáng chỉ được đóng từ sau 11:00.")
        if target_ca == "chieu" and now.time() < time(16, 30):
            raise BadRequestException("Chưa đến thời điểm đóng ca chiều! Ca chiều chỉ được đóng từ sau 16:30.")

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
            t.muc_do_uu_tien = 7
            t.thoi_gian_ket_thuc = now
            t.ghi_chu_dieu_phoi = (
                f"Đóng vé kết thúc ca trực {target_ca}. "
                f"Lý do: {payload.ghi_chu_ban_giao or 'Hết ca trực/Hết giờ làm việc phòng khám'}"
            )
            so_dong += 1

    stmt_waitlist = (
        select(DanhSachCho)
        .where(
            DanhSachCho.ngay_mong_muon == target_date,
            DanhSachCho.ca_mong_muon == target_ca,
            DanhSachCho.trang_thai.in_([
                TrangThaiWaitlistEnum.DANG_CHO.value,
                TrangThaiWaitlistEnum.DA_THONG_BAO.value,
            ])
        )
        .with_for_update()
    )
    pending_waitlists = (await db.execute(stmt_waitlist)).scalars().all()
    if payload.xu_ly_cho_kham == "CHUYEN_CA_TIEP_THEO":
        for wl in pending_waitlists:
            wl.ca_mong_muon = "chieu"
            note_wl = f"Bàn giao chuyển tiếp sang ca chiều: {payload.ghi_chu_ban_giao or 'Chờ tiếp ca chiều'}"
            wl.trieu_chung = f"{wl.trieu_chung or ''} | {note_wl}".strip(" | ")
    else:
        for wl in pending_waitlists:
            wl.trang_thai = TrangThaiWaitlistEnum.DA_HUY.value
            note_wl = f"Đóng ca trực kết thúc ngày: {payload.ghi_chu_ban_giao or 'Hết ca trực'}"
            wl.trieu_chung = f"{wl.trieu_chung or ''} | {note_wl}".strip(" | ")

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
