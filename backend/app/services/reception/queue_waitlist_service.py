import logging
import uuid
from datetime import date, datetime, time, timezone
from typing import List, Optional
from sqlalchemy import func, select, and_
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
    LoaiHangDoiEnum,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
    DanhSachCho,
    TrangThaiWaitlistEnum,
    LyDoUuTienEnum,
)
from app.models.user import BacSi, BenhNhan, TaiKhoan, VaiTroEnum
from app.services.appointment.appointment_service import clinic_now
from app.services.reception.doctor_schedule_guard import validate_doctor_shift_available
from app.schemas.queue import (
    ReceptionWaitlistItem,
    ReceptionWaitlistResponse,
    QueueTicketResponse,
    ProcessNoShowResponse,
)

logger = logging.getLogger(__name__)


async def process_no_shows_end_of_shift(
    self,
    query_date: Optional[date],
    ca_kham: Optional[str],
    current_user: TaiKhoan,
    db: AsyncSession,
) -> ProcessNoShowResponse:

    if current_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
        raise ForbiddenException("Chức năng chỉ dành cho Lễ tân hoặc Quản trị viên!")

    target_date = query_date or clinic_now().date()

    stmt = (
        select(LichKham)
        .options(selectinload(LichKham.benh_nhan))
        .where(
            and_(
                LichKham.ngay_kham == target_date,
                LichKham.trang_thai.in_(
                    [
                        TrangThaiLichEnum.DA_XAC_NHAN.value,
                        TrangThaiLichEnum.CHO_XAC_NHAN.value,
                    ]
                ),
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
    db: AsyncSession,
) -> ReceptionWaitlistResponse:
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
                DanhSachCho.trang_thai.in_(
                    [
                        TrangThaiWaitlistEnum.DANG_CHO.value,
                        TrangThaiWaitlistEnum.DA_THONG_BAO.value,
                    ]
                ),
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
        nam_sinh = (
            r.benh_nhan.nguoi_dung.ngay_sinh.year
            if (r.benh_nhan and r.benh_nhan.nguoi_dung and r.benh_nhan.nguoi_dung.ngay_sinh)
            else None
        )

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
    self, waitlist_id: int, receptionist_user: TaiKhoan, db: AsyncSession
) -> QueueTicketResponse:
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
    now = datetime.now(timezone.utc)

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

    stmt_queue_exist = select(HangDoiKham.id).where(
        HangDoiKham.benh_nhan_id == entry.benh_nhan_id,
        HangDoiKham.ngay_kham == today,
        HangDoiKham.ca_kham == ca_kham,
        HangDoiKham.trang_thai.in_(
            [
                TrangThaiHangDoiEnum.CHO_KHAM.value,
                TrangThaiHangDoiEnum.DANG_KHAM.value,
            ]
        ),
    )
    if (await db.execute(stmt_queue_exist)).scalar_one_or_none():
        raise ConflictException("Người bệnh hiện đã có vé đang chờ hoặc đang khám trong ca hôm nay!")

    effective_doctor_id = entry.bac_si_id
    if not effective_doctor_id:
        ck_id = entry.phong_kham.chuyen_khoa_id if getattr(entry, "phong_kham", None) else None
        from app.services.appointment.load_balancing_service import load_balancing_service

        effective_doctor_id = await load_balancing_service.assign_optimal_doctor(
            chuyen_khoa_id=ck_id, ca_kham=ca_kham, ngay_kham=today, db=db
        )
    else:
        await validate_doctor_shift_available(effective_doctor_id, today, ca_kham, db)

    stmt_bs = (
        select(BacSi)
        .options(selectinload(BacSi.phong_kham), selectinload(BacSi.chuyen_khoa))
        .where(BacSi.id == effective_doctor_id)
    )
    bs = (await db.execute(stmt_bs)).scalar_one_or_none()
    if not bs:
        raise NotFoundException("Không tìm thấy thông tin Bác sĩ tiếp nhận!")

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
            HangDoiKham.trang_thai.notin_(
                [
                    TrangThaiHangDoiEnum.BO_KHAM.value,
                    TrangThaiHangDoiEnum.DA_DONG_VE.value,
                ]
            ),
        )
        count_shift = (await db.execute(stmt_count_shift)).scalar() or 0
        if count_shift >= shift.gioi_han_ca_kham:
            raise ConflictException(
                f"Ca khám của Bác sĩ hiện vẫn đang kín chỗ ({count_shift}/{shift.gioi_han_ca_kham} ca). "
                f"Chưa có lượt hủy để giải phóng slot cho người bệnh trong danh sách chờ!"
            )

    stmt_max_stt = select(func.coalesce(func.max(HangDoiKham.so_thu_tu_kham), 0)).where(
        HangDoiKham.bac_si_id == effective_doctor_id,
        HangDoiKham.ngay_kham == today,
        HangDoiKham.ca_kham == ca_kham,
    )
    max_stt = (await db.execute(stmt_max_stt)).scalar() or 0
    next_stt = max_stt + 1

    base_time = clinic_now().time()
    gio_kham_tai_cho = time(
        base_time.hour, base_time.minute, (next_stt * 7) % 60, microsecond=min(999999, next_stt * 1000)
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

    is_priority = False
    priority_label = ""
    tc_raw = entry.trieu_chung or ""
    if "[Ưu tiên:" in tc_raw:
        is_priority = True
        try:
            priority_label = tc_raw.split("[Ưu tiên:")[1].split("]")[0].strip()
        except Exception:
            priority_label = "Đặc biệt"
    else:
        for item in LyDoUuTienEnum:
            if item.value in tc_raw.lower():
                is_priority = True
                priority_label = item.value
                break

    ticket_priority = 1 if is_priority else 5
    ticket_note = f"Tiếp nhận thành công từ Danh sách chờ (vị trí #{entry.thu_tu_uu_tien})"
    if is_priority:
        ticket_note = f"Ưu tiên ({priority_label}): {ticket_note}"

    fallback_room_wl = bs.phong_kham_id if bs else None
    shift_id_wl, room_id = await self._resolve_doctor_shift_room(
        effective_doctor_id,
        today,
        ca_kham,
        fallback_room_wl,
        db,
    )

    entry_time = entry.created_at
    if entry_time:
        if entry_time.tzinfo is None:
            entry_time = entry_time.replace(tzinfo=timezone.utc)
        original_check_in = entry_time
    else:
        original_check_in = now

    ticket = HangDoiKham(
        lich_kham_id=lich_kham.id,
        lich_lam_viec_id=shift_id_wl,
        benh_nhan_id=entry.benh_nhan_id,
        bac_si_id=effective_doctor_id,
        phong_kham_id=room_id,
        ngay_kham=today,
        ca_kham=ca_kham,
        so_thu_tu_kham=next_stt,
        loai_hang_doi=LoaiHangDoiEnum.VANG_LAI.value,
        muc_do_uu_tien=ticket_priority,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=original_check_in,
        thoi_gian_xep_hang_lai=now,
        so_lan_goi=0,
        nguoi_tiep_nhan_id=receptionist_user.id,
        ghi_chu_dieu_phoi=ticket_note,
    )
    db.add(ticket)

    entry.trang_thai = TrangThaiWaitlistEnum.DA_NHAN_SLOT.value
    entry.slot_duoc_cap_id = lich_kham.id

    await db.commit()
    return await self._get_ticket_with_relations(ticket.id, db)


async def cancel_waitlist_entry(self, waitlist_id: int, receptionist_user: TaiKhoan, db: AsyncSession) -> dict:
    if receptionist_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
        raise ForbiddenException("Chỉ Lễ tân hoặc Admin mới có quyền hủy bản ghi danh sách chờ!")

    stmt = select(DanhSachCho).where(DanhSachCho.id == waitlist_id).with_for_update()
    entry = (await db.execute(stmt)).scalar_one_or_none()
    if not entry:
        raise NotFoundException(f"Không tìm thấy bản ghi danh sách chờ với ID {waitlist_id}!")

    entry.trang_thai = "da_huy"
    await db.commit()
    return {"success": True, "message": "Đã hủy lượt chờ khám thành công"}
