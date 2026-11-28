import logging
from datetime import date
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.appointment import (
    HangDoiKham,
    LichKham,
    LoaiHangDoiEnum,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
)
from app.models.user import BacSi, BenhNhan, ChuyenKhoa, TaiKhoan
from app.services.appointment.appointment_service import clinic_now
from app.services.reception.timezone_utils import (
    to_clinic_aware,
    to_clinic_naive,
)
from app.schemas.queue import (
    ReceptionReportKpiItem,
    DepartmentDistributionItem,
    ReceptionReportSummaryResponse,
    ReceptionAuditLogItem,
    ReceptionAuditLogPagination,
    ReceptionAuditLogResponse,
)

logger = logging.getLogger(__name__)


async def get_reception_report_summary(
    self, query_date: Optional[date], ca_kham: Optional[str], db: AsyncSession
) -> ReceptionReportSummaryResponse:
    now = clinic_now()
    target_date = query_date or now.date()

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
        1
        for item_lich in lich_list
        if item_lich.trang_thai in (TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value)
    )
    so_no_show = sum(1 for item_lich in lich_list if item_lich.trang_thai == TrangThaiLichEnum.NO_SHOW.value)

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
        ci_local = to_clinic_naive(ci_dt)

        called_dt = t.thoi_gian_goi_kham or t.thoi_gian_bat_dau
        if called_dt and ci_local:
            call_local = to_clinic_naive(called_dt)
            wait_min = max(0.0, (call_local - ci_local).total_seconds() / 60.0)
        elif t.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value and ci_local:
            now_local = now.replace(tzinfo=None)
            wait_min = max(0.0, (now_local - ci_local).total_seconds() / 60.0)
        else:
            end_dt = t.thoi_gian_ket_thuc or t.updated_at
            if end_dt and ci_local:
                end_local = to_clinic_naive(end_dt)
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
                round(s_data["total_wait_minutes"] / s_data["wait_count"], 1) if s_data["wait_count"] > 0 else 0.0
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
    db: AsyncSession,
) -> ReceptionAuditLogResponse:
    now = clinic_now()
    target_date = query_date or now.date()

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
        patient_name = (
            t.benh_nhan.nguoi_dung.ho_ten if (t.benh_nhan and getattr(t.benh_nhan, "nguoi_dung", None)) else "Bệnh nhân"
        )
        phone = (
            t.benh_nhan.nguoi_dung.so_dien_thoai if (t.benh_nhan and getattr(t.benh_nhan, "nguoi_dung", None)) else ""
        )
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
            t_local = to_clinic_aware(t_dt)
            ts_str = t_local.strftime("%Y-%m-%d %H:%M:%S")
        else:
            ts_str = now.strftime("%Y-%m-%d %H:%M:%S")

        if t.loai_hang_doi == LoaiHangDoiEnum.VANG_LAI.value:
            act = "WALK_IN_CREATE"
            desc = (
                f"Tiếp nhận bệnh nhân vãng lai, cấp số {ticket_num} vào {room_name}"
                if room_name
                else f"Tiếp nhận vãng lai, cấp số {ticket_num}"
            )
        else:
            act = "CHECK_IN"
            ma_lk = t.lich_kham.ma_lich_kham if t.lich_kham else ""
            desc = (
                f"Tiếp nhận check-in lịch hẹn {ma_lk}, cấp số {ticket_num} vào {room_name}"
                if room_name
                else f"Tiếp nhận check-in lịch hẹn {ma_lk}, cấp số {ticket_num}"
            )

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

        if t.thoi_gian_goi_kham or t.trang_thai in (
            TrangThaiHangDoiEnum.DANG_KHAM.value,
            TrangThaiHangDoiEnum.DA_KHAM.value,
        ):
            call_dt = t.thoi_gian_goi_kham or t.thoi_gian_bat_dau or t.updated_at
            call_local = to_clinic_aware(call_dt) if call_dt else None
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
                    description=f"{doctor_name} gọi số {ticket_num} vào khám tại {room_name}"
                    if room_name
                    else f"{doctor_name} gọi số {ticket_num}",
                    metadata={"ticket_id": t.id, "so_lan_goi": t.so_lan_goi},
                )
            )

        if t.ghi_chu_dieu_phoi and any(w in t.ghi_chu_dieu_phoi.lower() for w in ("chuyển", "đổi phòng", "transfer")):
            up_dt = t.updated_at or t.thoi_gian_check_in
            up_local = to_clinic_aware(up_dt) if up_dt else None
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
            defer_local = to_clinic_aware(defer_dt) if defer_dt else None
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
            leave_local = to_clinic_aware(leave_dt) if leave_dt else None
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
            close_local = to_clinic_aware(close_dt) if close_dt else None
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
        patient_name = (
            lk.benh_nhan.nguoi_dung.ho_ten
            if (lk.benh_nhan and getattr(lk.benh_nhan, "nguoi_dung", None))
            else "Bệnh nhân"
        )
        phone = (
            lk.benh_nhan.nguoi_dung.so_dien_thoai
            if (lk.benh_nhan and getattr(lk.benh_nhan, "nguoi_dung", None))
            else ""
        )

        if lk.trang_thai in (TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value):
            c_dt = lk.thoi_gian_huy or lk.updated_at
            c_local = to_clinic_aware(c_dt) if c_dt else None
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
            r_local = to_clinic_aware(r_dt)
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
            log
            for log in filtered_logs
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
