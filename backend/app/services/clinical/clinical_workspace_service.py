import json
import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import (
    ConflictException,
    ForbiddenException,
    NotFoundException,
    UnprocessableEntityException,
)
from app.models.appointment import (
    CANCELLED_STATUSES,
    HangDoiKham,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
)
from app.models.medical import (
    ChanDoan,
    ChiDinh,
    ChiTietDonThuoc,
    DichVu,
    DonThuoc,
    KhaiNiem,
    LuotKham,
    LuotKhamTheLuc,
    PhieuKhamChuyenKhoa,
)
from app.models.specialty_exam import (
    KhamMat,
    KhamNgoaiKhoa,
    KhamNoiKhoa,
    KhamRangHamMat,
    KhamTaiMuiHong,
)
from app.models.user import BacSi, BenhNhan, ChuyenKhoa, TaiKhoan, VaiTroEnum
from app.schemas.compliance import TrangThaiDonThuoc
from app.services.compliance.prescription_fsm_service import PrescriptionFSMService

logger = logging.getLogger(__name__)

SPECIALTY_TEMPLATES = {
    "noi-khoa": [
        "Tuần hoàn (Tim mạch)",
        "Hô hấp",
        "Tiêu hóa",
        "Thận – Tiết niệu",
        "Thần kinh",
        "Cơ xương khớp",
    ],
    "ngoai-khoa": [
        "Khám ngoại tổng quát",
        "Vết thương / Vết mổ",
        "Khối u / Thoát vị",
        "Dị tật / Tầm vận động",
    ],
    "mat": [
        "Thị lực mắt phải (Snellen)",
        "Thị lực mắt trái (Snellen)",
        "Nhãn áp mắt phải (mmHg)",
        "Nhãn áp mắt trái (mmHg)",
        "Bán phần trước",
        "Đáy mắt",
    ],
    "tai-mui-hong": [
        "Tai phải",
        "Tai trái",
        "Mũi – xoang",
        "Họng – thanh quản",
        "Hạch cổ",
        "Thính lực 2 tai",
    ],
    "rang-ham-mat": [
        "Cung hàm trên",
        "Cung hàm dưới",
        "Nha chu & nướu lợi",
        "Khớp thái dương hàm",
        "Niêm mạc miệng",
    ],
}


def _to_int(val) -> Optional[int]:
    try:
        return int(val) if val is not None and str(val).strip() != "" else None
    except (ValueError, TypeError):
        return None


def _to_dec(val, precision: int = 1) -> Optional[Decimal]:
    try:
        return Decimal(str(round(float(val), precision))) if val is not None and str(val).strip() != "" else None
    except (ValueError, TypeError):
        return None


def _build_hang_doi_query(today: date, doc_id: Optional[int] = None):
    stmt = (
        select(HangDoiKham)
        .options(
            selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
            selectinload(HangDoiKham.bac_si).selectinload(BacSi.nguoi_dung),
            selectinload(HangDoiKham.bac_si).selectinload(BacSi.chuyen_khoa),
            selectinload(HangDoiKham.lich_kham),
        )
        .where(
            or_(
                HangDoiKham.ngay_kham == today,
                HangDoiKham.trang_thai.in_(["cho_kham", "dang_kham", "tam_hoan"]),
            )
        )
    )
    if doc_id:
        stmt = stmt.where(HangDoiKham.bac_si_id == doc_id)
    return stmt.order_by(HangDoiKham.muc_do_uu_tien.asc(), HangDoiKham.so_thu_tu_kham.asc())


def _is_order_done(order: ChiDinh) -> bool:
    if order.trang_thai in ("da_co_ket_qua", "da_duyet"):
        return True
    if order.phieu_ket_qua is not None and order.phieu_ket_qua.trang_thai in ("DA_DUYET", "DA_CO_KET_QUA"):
        return True
    kq = getattr(order, "ket_qua", None)
    if order.phieu_ket_qua is None and kq is not None and kq.thoi_gian_duyet is not None:
        return True
    return False


def _resolve_specialty_slug(ma_chuyen_khoa: Optional[str], ten_chuyen_khoa: Optional[str]) -> str:
    raw = f"{ma_chuyen_khoa or ''} {ten_chuyen_khoa or ''}".lower()
    if "ngoai" in raw or "ngoại" in raw:
        return "ngoai-khoa"
    if "mat" in raw or "mắt" in raw or "nhãn" in raw:
        return "mat"
    if "tmh" in raw or "tai" in raw or "họng" in raw or "hong" in raw:
        return "tai-mui-hong"
    if "rhm" in raw or "rang" in raw or "răng" in raw:
        return "rang-ham-mat"
    return "noi-khoa"


def _serialize_workspace_orders(service, order_rows: List[ChiDinh], encounter_data: dict) -> List[dict]:
    serialized = []
    for order, order_data in zip(order_rows, encounter_data.get("danh_sach_chi_dinh", [])):
        is_done = service._is_order_done(order)
        kq = getattr(order, "ket_qua", None)
        phieu = getattr(order, "phieu_ket_qua", None)
        tri_so_obj = order.tri_so_chi_tiet or (kq.tri_so_chi_tiet if kq else None)
        ket_qua_text = (
            order.ket_qua_chi_tiet
            or (kq.ket_qua_chi_tiet if kq else None)
            or (phieu.ket_luan if phieu else None)
            or (phieu.mo_ta_hinh_anh if phieu else None)
        )
        attachments = service._extract_order_attachments(order)
        returned_at = (
            order.thoi_gian_tra_ket_qua
            or (kq.thoi_gian_duyet if kq else None)
            or (phieu.thoi_gian_duyet if phieu else None)
            or (phieu.thoi_gian_tra_ket_qua if phieu else None)
        )
        phan_loai = (
            order.ket_qua_phan_loai
            or (kq.ket_qua_phan_loai if kq else None)
            or ("BINH_THUONG" if is_done else None)
        )
        serialized.append(
            {
                **order_data,
                "server_order_id": order.id,
                "ma_dich_vu": order.dich_vu.ma_dich_vu if order.dich_vu else None,
                "nhom_dich_vu": order.dich_vu.ma_nhom_byt if order.dich_vu else None,
                "trang_thai": "da_co_ket_qua" if is_done else order.trang_thai,
                "ket_qua_chi_tiet": tri_so_obj or ket_qua_text,
                "tri_so_chi_tiet": tri_so_obj,
                "ket_qua_phan_loai": phan_loai,
                "tep_dinh_kem_url": attachments[0] if attachments else None,
                "tep_dinh_kem_urls": attachments,
                "thoi_gian_tra_ket_qua": (
                    returned_at.isoformat() if returned_at else order_data.get("thoi_gian_tra_ket_qua")
                ),
            }
        )
    return serialized


def _compute_workspace_ticket_status(
    ticket: HangDoiKham,
    encounter: Optional[LuotKham],
    active_orders: List[ChiDinh],
    orders_returned: bool,
) -> str:
    status = ticket.trang_thai
    if status in (TrangThaiHangDoiEnum.CHO_GOI.value, TrangThaiHangDoiEnum.DANG_GOI.value):
        status = TrangThaiHangDoiEnum.CHO_KHAM.value
    if encounter and encounter.is_locked:
        return TrangThaiHangDoiEnum.DA_KHAM.value
    if orders_returned and status in (TrangThaiHangDoiEnum.TAM_HOAN.value, TrangThaiHangDoiEnum.CHO_KHAM.value):
        return "co_ket_qua_cls"
    if active_orders and not orders_returned and status == TrangThaiHangDoiEnum.CHO_KHAM.value:
        return TrangThaiHangDoiEnum.TAM_HOAN.value
    if (
        encounter
        and encounter.thoi_gian_bat_dau
        and status == TrangThaiHangDoiEnum.CHO_KHAM.value
        and not active_orders
    ):
        return TrangThaiHangDoiEnum.DANG_KHAM.value
    return status


async def get_or_sync_workspace_state(
    self,
    db: AsyncSession,
    current_user: Optional[TaiKhoan] = None,
    doctor_id: Optional[int] = None,
) -> dict:
    doctor = None
    if current_user and current_user.vai_tro == VaiTroEnum.BAC_SI.value:
        doctor = await self._get_doctor_from_user(current_user, db)
        if doctor_id is not None and doctor_id != doctor.id:
            raise ForbiddenException("Bạn chỉ có quyền xem bàn khám mình phụ trách.")
        doctor_id = doctor.id

    clinic_tz = timezone(timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS))
    today = datetime.now(clinic_tz).date()
    tickets = (await db.execute(self._build_hang_doi_query(today, doctor_id))).scalars().all()
    queue = []
    encounters = {}
    merged_any = False

    for ticket in tickets:
        patient = ticket.benh_nhan
        person = patient.nguoi_dung
        birth_date = person.ngay_sinh
        age = (
            today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            if birth_date
            else None
        )
        patient_data = {
            "id": patient.id,
            "ma": patient.ma_dinh_danh_y_te,
            "ho_ten": person.ho_ten,
            "gioi_tinh": person.gioi_tinh,
            "tuoi": age,
            "so_dien_thoai": person.so_dien_thoai,
            "di_ung_thuoc": patient.di_ung_thuoc,
        }
        encounter, did_merge = await self._resolve_and_heal_ticket_encounter(ticket, db)
        merged_any = merged_any or did_merge
        if doctor and encounter and doctor.id not in (encounter.bac_si_id, encounter.tiep_quan_boi_id):
            continue

        appointment = ticket.lich_kham
        department = ticket.bac_si.chuyen_khoa
        workspace_id = f"ticket-{ticket.id}"
        order_rows = encounter.danh_sach_chi_dinh if encounter else []
        active_orders = [order for order in order_rows if order.trang_thai != "da_huy"]
        orders_returned = bool(active_orders) and all(self._is_order_done(order) for order in active_orders)
        status = _compute_workspace_ticket_status(ticket, encounter, active_orders, orders_returned)

        queue.append(
            {
                "ticket_id": ticket.id,
                "encounter_id": workspace_id,
                "ticket_code": f"TICKET-{ticket.so_thu_tu_kham:02d}",
                "patient_id": patient.id,
                "so_thu_tu_kham": f"{ticket.so_thu_tu_kham:02d}",
                "muc_do_uu_tien": ticket.muc_do_uu_tien,
                "trang_thai": status,
                "so_lan_goi": ticket.so_lan_goi,
                "ghi_chu": ticket.ghi_chu_dieu_phoi,
                "chuyen_khoa_id": department.id if department else None,
                "ma_chuyen_khoa": department.ma_chuyen_khoa if department else None,
                "ten_chuyen_khoa": department.ten_chuyen_khoa if department else None,
                "benh_nhan": patient_data,
                "ten_benh_nhan": person.ho_ten,
                "gioi_tinh": person.gioi_tinh,
                "tuoi": age,
                "ly_do": appointment.ly_do_kham if appointment else None,
            }
        )
        encounter_data = (
            self._to_encounter_response(encounter).model_dump(mode="json")
            if encounter
            else {
                "ly_do_vao_kham": appointment.ly_do_kham if appointment else None,
                "benh_su": appointment.trieu_chung_ban_dau if appointment else None,
                "is_locked": False,
                "danh_sach_chan_doan": [],
            }
        )
        dept_slug = self._resolve_specialty_slug(
            department.ma_chuyen_khoa if department else None,
            department.ten_chuyen_khoa if department else None,
        )
        encounter_data.update(
            {
                "id": workspace_id,
                "ticket_id": ticket.id,
                "lich_kham_id": ticket.lich_kham_id,
                "luot_kham_server_id": encounter.id if encounter else None,
                "ma_lich_kham": appointment.ma_lich_kham if appointment else None,
                "benh_nhan": patient_data,
                "chuyen_khoa_kham": department.ma_chuyen_khoa if department else None,
                "ten_chuyen_khoa": department.ten_chuyen_khoa if department else None,
                "danh_sach_chi_dinh": _serialize_workspace_orders(self, order_rows, encounter_data),
                "kham_chuyen_khoa": self._reconstruct_specialty_exam(encounter, dept_slug, active_orders),
            }
        )
        if encounter and encounter.don_thuoc:
            prescription = encounter_data["don_thuoc"]
            prescription["danh_sach_thuoc"] = prescription["danh_sach_chi_tiet"]
            encounter_data["danh_sach_thuoc"] = prescription["danh_sach_chi_tiet"]
        encounters[workspace_id] = encounter_data

    if merged_any:
        await db.commit()

    return await self.enrich_workspace_ai({"queue": queue, "encounters": encounters}, db)


def _reconstruct_specialty_exam(
    cls,
    encounter: Optional[LuotKham],
    dept_slug: str,
    active_orders: List[ChiDinh],
) -> dict:
    labels = SPECIALTY_TEMPLATES.get(dept_slug, SPECIALTY_TEMPLATES["noi-khoa"])
    items_map = {}
    extras_map = {}
    if encounter is not None:
        phieu_list = getattr(encounter, "danh_sach_phieu_chuyen_khoa", None) or []
        phieu = sorted(phieu_list, key=lambda p: p.id or 0)[-1] if phieu_list else None
        if phieu and phieu.noi_dung_kham:
            extra_keys = {
                "chi_dinh_phau_thuat_thu_thuat",
                "chi_dinh_tieu_phau",
                "vi_tri_rang",
                "tinh_trang_rang",
            }
            for raw_line in phieu.noi_dung_kham.splitlines():
                if ":" not in raw_line:
                    continue
                label, _, rest = raw_line.partition(":")
                label = label.strip()
                rest = rest.strip()
                if label in extra_keys and rest:
                    extras_map[label] = rest
                elif label in labels:
                    if rest.startswith("Bất thường"):
                        note = rest[rest.index("(") + 1 : -1].strip() if ("(" in rest and rest.endswith(")")) else ""
                        items_map[label] = {"status": "BAT", "note": note}
                    elif rest:
                        items_map[label] = {"status": "BT", "note": ""}
        if not items_map and (
            bool(encounter.kham_lam_sang_bo_phan)
            or bool(active_orders)
            or bool(encounter.danh_sach_chan_doan)
            or bool(encounter.is_locked)
        ):
            items_map = {lbl: {"status": "BT", "note": ""} for lbl in labels}
    return {"khoa": dept_slug, "items": items_map, "extras": extras_map}


async def _resolve_and_heal_ticket_encounter(
    self, ticket: HangDoiKham, db: AsyncSession, for_update: bool = False
) -> tuple[Optional[LuotKham], bool]:
    conditions = [
        LuotKham.hang_doi_kham_id == ticket.id,
        LuotKham.ma_kcb.like(f"WS-ticket-{ticket.id}-%"),
    ]
    if ticket.lich_kham_id is not None:
        conditions.append(LuotKham.lich_kham_id == ticket.lich_kham_id)
    stmt = (
        select(LuotKham)
        .options(
            selectinload(LuotKham.danh_sach_chan_doan),
            selectinload(LuotKham.danh_sach_chi_dinh).selectinload(ChiDinh.dich_vu),
            selectinload(LuotKham.danh_sach_chi_dinh).selectinload(ChiDinh.phieu_ket_qua),
            selectinload(LuotKham.danh_sach_chi_dinh).selectinload(ChiDinh.ket_qua),
            selectinload(LuotKham.don_thuoc).selectinload(DonThuoc.danh_sach_chi_tiet),
            selectinload(LuotKham.danh_sach_phieu_chuyen_khoa),
        )
        .where(or_(*conditions) & (LuotKham.benh_nhan_id == ticket.benh_nhan_id))
        .order_by(LuotKham.hang_doi_kham_id.is_(None).asc(), LuotKham.id.asc())
    )
    if for_update:
        stmt = stmt.with_for_update()
    rows = (await db.execute(stmt)).scalars().all()
    if not rows:
        return None, False

    primary = rows[0]
    did_merge = False
    if primary.hang_doi_kham_id is None:
        primary.hang_doi_kham_id = ticket.id
        did_merge = True
    if primary.lich_kham_id is None and ticket.lich_kham_id is not None:
        primary.lich_kham_id = ticket.lich_kham_id
        did_merge = True

    if len(rows) > 1:
        clinical_attrs = (
            "ly_do_vao_kham",
            "benh_su",
            "kham_lam_sang_bo_phan",
            "chan_doan_so_bo",
            "ket_luan_dieu_tri",
            "mach_lan_phut",
            "nhiet_do_c",
            "huyet_ap_tam_thu",
            "huyet_ap_tam_truong",
            "nhip_tho_lan_phut",
            "can_nang_kg",
            "chieu_cao_cm",
            "spo2",
        )
        existing_order_ids = {o.id for o in (primary.danh_sach_chi_dinh or [])}
        for dup in rows[1:]:
            for attr in clinical_attrs:
                if getattr(primary, attr, None) is None and getattr(dup, attr, None) is not None:
                    setattr(primary, attr, getattr(dup, attr))
                    did_merge = True
            for dup_order in list(dup.danh_sach_chi_dinh or []):
                if dup_order.id not in existing_order_ids:
                    dup_order.luot_kham = primary
                    existing_order_ids.add(dup_order.id)
                    did_merge = True
        if did_merge:
            await db.flush()

    return primary, did_merge


async def _get_ticket_encounter(
    self, ticket: HangDoiKham, db: AsyncSession, for_update: bool = False
) -> Optional[LuotKham]:
    encounter, _ = await self._resolve_and_heal_ticket_encounter(ticket, db, for_update=for_update)
    return encounter


async def _sync_queue_tickets(self, queue_items: list, doctor: Optional[BacSi], db: AsyncSession) -> None:
    from app.services.auth.credential_service import credential_service

    for item in sorted(queue_items, key=lambda entry: entry["ticket_id"]):
        ticket = (
            await db.execute(
                select(HangDoiKham)
                .options(selectinload(HangDoiKham.lich_kham))
                .where(HangDoiKham.id == item["ticket_id"])
                .with_for_update()
            )
        ).scalar_one_or_none()
        if not ticket:
            raise NotFoundException("Không tìm thấy vé hàng đợi.")
        if doctor and ticket.bac_si_id != doctor.id:
            raise ForbiddenException("Bạn chỉ có quyền cập nhật vé khám được phân công.")
        if ticket.trang_thai in (
            TrangThaiHangDoiEnum.DA_KHAM.value,
            TrangThaiHangDoiEnum.BO_KHAM.value,
            TrangThaiHangDoiEnum.DA_DONG_VE.value,
        ):
            continue

        new_status = item["trang_thai"]
        if new_status == TrangThaiHangDoiEnum.DANG_KHAM.value:
            encounter = await self._get_ticket_encounter(ticket, db, for_update=True)
            if encounter and encounter.is_locked:
                raise ConflictException("Hồ sơ bệnh án đã hoàn tất và bị khóa.")
            if not encounter:
                await credential_service.check_doctor_license_valid(db, ticket.bac_si_id)
                if ticket.lich_kham and ticket.lich_kham.trang_thai in CANCELLED_STATUSES:
                    raise ConflictException("Không thể bắt đầu lượt khám có lịch hẹn đã hủy.")
                db.add(
                    LuotKham(
                        lich_kham_id=ticket.lich_kham_id,
                        hang_doi_kham_id=ticket.id,
                        bac_si_id=ticket.bac_si_id,
                        benh_nhan_id=ticket.benh_nhan_id,
                        thoi_gian_bat_dau=datetime.now(timezone.utc),
                        ly_do_vao_kham=ticket.lich_kham.ly_do_kham if ticket.lich_kham else None,
                    )
                )
                if ticket.lich_kham:
                    ticket.lich_kham.trang_thai = TrangThaiLichEnum.DANG_KHAM.value
                await db.flush()
            ticket.trang_thai = new_status
            ticket.thoi_gian_bat_dau = ticket.thoi_gian_bat_dau or datetime.now(timezone.utc)
            if item.get("so_lan_goi") is not None:
                ticket.so_lan_goi = max(ticket.so_lan_goi, item["so_lan_goi"])
        elif new_status == TrangThaiHangDoiEnum.TAM_HOAN.value:
            ticket.trang_thai = new_status
        elif new_status != ticket.trang_thai:
            continue

        if item.get("ghi_chu") is not None:
            ticket.ghi_chu_dieu_phoi = item["ghi_chu"]


async def _resolve_target_encounter_for_sync(
    self,
    enc_key: str,
    doctor: Optional[BacSi],
    db: AsyncSession,
) -> LuotKham:
    if enc_key.startswith("ticket-") and enc_key[7:].isdigit():
        ticket = await db.get(HangDoiKham, int(enc_key[7:]))
        if not ticket:
            raise NotFoundException("Không tìm thấy vé hàng đợi.")
        if doctor and ticket.bac_si_id != doctor.id:
            raise ForbiddenException("Bạn chỉ có quyền cập nhật vé khám được phân công.")
        target_lk = await self._get_ticket_encounter(ticket, db, for_update=True)
        if not target_lk:
            raise ConflictException("Cần bắt đầu lượt khám trước khi lưu bệnh án.")
    elif enc_key.isdigit():
        target_lk = await self._get_encounter_with_relations(int(enc_key), db, for_update=True)
        if not target_lk:
            raise NotFoundException("Không tìm thấy thông tin lượt khám.")
    else:
        raise UnprocessableEntityException("Mã lượt khám không hợp lệ.")

    if doctor and doctor.id not in (target_lk.bac_si_id, target_lk.tiep_quan_boi_id):
        raise ForbiddenException("Bạn chỉ có quyền cập nhật lượt khám được phân công.")
    if target_lk.is_locked:
        raise ConflictException("Hồ sơ bệnh án đã hoàn tất và bị khóa.")
    return target_lk


async def _sync_vitals_and_clinical_notes(
    target_lk: LuotKham,
    enc_data: dict,
    bs_id: Optional[int],
    db: AsyncSession,
) -> None:
    int_vital_fields = (
        "mach_lan_phut",
        "huyet_ap_tam_thu",
        "huyet_ap_tam_truong",
        "nhip_tho_lan_phut",
    )
    for field_name in int_vital_fields:
        if field_name in enc_data:
            parsed_int = _to_int(enc_data.get(field_name))
            if parsed_int is not None:
                setattr(target_lk, field_name, parsed_int)

    dec_vital_fields = (
        ("nhiet_do_c", 1),
        ("can_nang_kg", 2),
        ("chieu_cao_cm", 2),
    )
    for field_name, prec in dec_vital_fields:
        if field_name in enc_data:
            parsed_dec = _to_dec(enc_data.get(field_name), prec)
            if parsed_dec is not None:
                setattr(target_lk, field_name, parsed_dec)

    if target_lk.can_nang_kg and target_lk.chieu_cao_cm and target_lk.chieu_cao_cm > 0:
        h_m = float(target_lk.chieu_cao_cm) / 100.0
        target_lk.bmi = Decimal(str(round(float(target_lk.can_nang_kg) / (h_m * h_m), 1)))

    if enc_data.get("ly_do_vao_kham"):
        target_lk.ly_do_vao_kham = enc_data.get("ly_do_vao_kham")
        if not target_lk.trieu_chung:
            target_lk.trieu_chung = target_lk.ly_do_vao_kham

    if enc_data.get("benh_su"):
        target_lk.benh_su = enc_data.get("benh_su")
    if enc_data.get("kham_lam_sang_bo_phan"):
        target_lk.kham_lam_sang_bo_phan = enc_data.get("kham_lam_sang_bo_phan")
    if "ket_luan_dieu_tri" in enc_data and enc_data.get("ket_luan_dieu_tri") is not None:
        target_lk.ket_luan_dieu_tri = str(enc_data.get("ket_luan_dieu_tri"))
    if "loi_dan_bac_si" in enc_data and enc_data.get("loi_dan_bac_si") is not None:
        target_lk.loi_dan_bac_si = str(enc_data.get("loi_dan_bac_si"))

    if "ngay_hen_tai_kham" in enc_data:
        raw_follow_up = enc_data.get("ngay_hen_tai_kham")
        if raw_follow_up:
            try:
                target_lk.ngay_hen_tai_kham = date.fromisoformat(str(raw_follow_up)[:10])
            except ValueError:
                pass
        else:
            target_lk.ngay_hen_tai_kham = None

    pe_rec = (
        await db.execute(select(LuotKhamTheLuc).where(LuotKhamTheLuc.luot_kham_id == target_lk.id))
    ).scalar_one_or_none()
    if pe_rec:
        pe_rec.mach = target_lk.mach_lan_phut
        pe_rec.huyet_ap_tam_thu = target_lk.huyet_ap_tam_thu
        pe_rec.huyet_ap_tam_truong = target_lk.huyet_ap_tam_truong
        pe_rec.nhiet_do = target_lk.nhiet_do_c
        pe_rec.nhip_tho = target_lk.nhip_tho_lan_phut
        pe_rec.chieu_cao = target_lk.chieu_cao_cm
        pe_rec.can_nang = target_lk.can_nang_kg
        pe_rec.bmi = target_lk.bmi
    elif bs_id:
        db.add(
            LuotKhamTheLuc(
                luot_kham_id=target_lk.id,
                mach=target_lk.mach_lan_phut,
                huyet_ap_tam_thu=target_lk.huyet_ap_tam_thu,
                huyet_ap_tam_truong=target_lk.huyet_ap_tam_truong,
                nhiet_do=target_lk.nhiet_do_c,
                nhip_tho=target_lk.nhip_tho_lan_phut,
                chieu_cao=target_lk.chieu_cao_cm,
                can_nang=target_lk.can_nang_kg,
                bmi=target_lk.bmi,
                bac_si_ket_luan_id=bs_id,
            )
        )


async def _get_or_create_specialty_record(model_cls, lk_id: int, bs_id: Optional[int], db: AsyncSession):
    rec = (await db.execute(select(model_cls).where(model_cls.luot_kham_id == lk_id))).scalars().first()
    if not rec:
        rec = model_cls(luot_kham_id=lk_id, bac_si_thuc_hien_id=bs_id)
        db.add(rec)
    elif bs_id:
        rec.bac_si_thuc_hien_id = bs_id
    return rec


async def _sync_specialty_exam_sheet(
    target_lk: LuotKham,
    enc_data: dict,
    bs_id: Optional[int],
    db: AsyncSession,
) -> None:
    kham_ck = enc_data.get("kham_chuyen_khoa")
    if kham_ck is None and not enc_data.get("ket_luan_dieu_tri"):
        return

    items = kham_ck.get("items") or {} if isinstance(kham_ck, dict) else {}
    extras = kham_ck.get("extras") or {} if isinstance(kham_ck, dict) else {}

    noi_dung_lines = []
    for label, it in items.items():
        if isinstance(it, dict):
            status_text = (
                "Bình thường"
                if it.get("status") == "BT"
                else ("Bất thường" if it.get("status") == "BAT" else it.get("status", ""))
            )
            note_text = f" ({it.get('note')})" if it.get("note") else ""
            noi_dung_lines.append(f"{label}: {status_text}{note_text}")
    for extra_k, extra_v in extras.items():
        if extra_v:
            noi_dung_lines.append(f"{extra_k}: {extra_v}")

    noi_dung_kham = "\n".join(noi_dung_lines) if noi_dung_lines else enc_data.get("kham_lam_sang_bo_phan")

    chuyen_khoa_id = None
    if bs_id:
        bs_obj = (await db.execute(select(BacSi).where(BacSi.id == bs_id))).scalar_one_or_none()
        if bs_obj and bs_obj.chuyen_khoa_id:
            chuyen_khoa_id = bs_obj.chuyen_khoa_id
    if not chuyen_khoa_id:
        first_ck = (await db.execute(select(ChuyenKhoa).limit(1))).scalars().first()
        if first_ck:
            chuyen_khoa_id = first_ck.id

    phieu_ck = (
        await db.execute(select(PhieuKhamChuyenKhoa).where(PhieuKhamChuyenKhoa.luot_kham_id == target_lk.id))
    ).scalars().first()

    phan_loai = "LOAI_1"
    if target_lk.bmi:
        if target_lk.bmi >= 30 or target_lk.bmi < Decimal("18.5"):
            phan_loai = "LOAI_3"
        elif target_lk.bmi >= 25:
            phan_loai = "LOAI_2"

    if phieu_ck:
        if noi_dung_kham:
            phieu_ck.noi_dung_kham = noi_dung_kham
        phieu_ck.phan_loai_suc_khoe = phan_loai
        if enc_data.get("ket_luan_dieu_tri"):
            phieu_ck.ket_luan_chuyen_khoa = enc_data.get("ket_luan_dieu_tri")
    elif bs_id and chuyen_khoa_id and (noi_dung_kham or enc_data.get("ket_luan_dieu_tri")):
        db.add(
            PhieuKhamChuyenKhoa(
                luot_kham_id=target_lk.id,
                bac_si_id=bs_id,
                chuyen_khoa_id=chuyen_khoa_id,
                noi_dung_kham=noi_dung_kham or "Chưa có bất thường",
                ket_luan_chuyen_khoa=enc_data.get("ket_luan_dieu_tri") or "Theo dõi lâm sàng",
                phan_loai_suc_khoe=phan_loai,
            )
        )

    raw_khoa = (kham_ck.get("khoa") if isinstance(kham_ck, dict) else None) or ""
    if raw_khoa.strip():
        dept_key = _resolve_specialty_slug(raw_khoa, raw_khoa)
    elif chuyen_khoa_id:
        ck_row = (await db.execute(select(ChuyenKhoa).where(ChuyenKhoa.id == chuyen_khoa_id))).scalar_one_or_none()
        dept_key = _resolve_specialty_slug(ck_row.ma_chuyen_khoa if ck_row else None, None)
    else:
        dept_key = "noi-khoa"

    def _extract_item(kw_list: list[str]) -> Optional[str]:
        for label, it in items.items():
            if any(kw in label.lower() for kw in kw_list) and isinstance(it, dict):
                st = (
                    "Bình thường"
                    if it.get("status") == "BT"
                    else ("Bất thường" if it.get("status") == "BAT" else (it.get("status") or ""))
                )
                return f"{st}: {it.get('note')}" if it.get("note") else st
        return None

    ket_luan = enc_data.get("ket_luan_dieu_tri")
    if dept_key == "noi-khoa":
        sp_noi = await _get_or_create_specialty_record(KhamNoiKhoa, target_lk.id, bs_id, db)
        for attr, kws in (
            ("tuan_hoan", ["tuần hoàn", "tim mạch"]),
            ("ho_hap", ["hô hấp", "phổi"]),
            ("tieu_hoa", ["tiêu hóa", "bụng"]),
            ("than_tiet_nieu", ["thận", "tiết niệu"]),
            ("than_kinh", ["thần kinh"]),
            ("co_xuong_khop", ["cơ xương khớp"]),
        ):
            val = _extract_item(kws)
            if val:
                setattr(sp_noi, attr, val)
        if ket_luan:
            sp_noi.ket_luan_chuyen_khoa = ket_luan

    elif dept_key == "ngoai-khoa":
        sp_ngoai = await _get_or_create_specialty_record(KhamNgoaiKhoa, target_lk.id, bs_id, db)
        for attr, kws in (
            ("ket_qua_kham_thuc_the", ["ngoại tổng quát", "thực thể"]),
            ("tinh_trang_vet_thuong", ["vết thương", "vết mổ"]),
            ("mo_ta_ton_thuong", ["khối u", "thoát vị"]),
            ("vi_tri_ton_thuong", ["dị tật", "vận động", "vị trí"]),
        ):
            val = _extract_item(kws)
            if val:
                setattr(sp_ngoai, attr, val)
        pttt = extras.get("chi_dinh_phau_thuat_thu_thuat") or extras.get("loai_phau_thuat_thu_thuat")
        if pttt:
            sp_ngoai.chi_dinh_phau_thuat_thu_thuat = str(pttt)
        if "chi_dinh_tieu_phau" in extras:
            raw_tp = extras.get("chi_dinh_tieu_phau")
            if isinstance(raw_tp, bool):
                sp_ngoai.chi_dinh_tieu_phau = "Có chỉ định tiểu phẫu" if raw_tp else None
            elif isinstance(raw_tp, str):
                sp_ngoai.chi_dinh_tieu_phau = raw_tp.strip() or None
            elif raw_tp is not None:
                sp_ngoai.chi_dinh_tieu_phau = str(raw_tp)
        if ket_luan:
            sp_ngoai.ket_luan_chuyen_khoa = ket_luan

    elif dept_key == "mat":
        sp_mat = await _get_or_create_specialty_record(KhamMat, target_lk.id, bs_id, db)
        for attr, kws in (
            ("thi_luc_mat_phai", ["thị lực mắt phải", "thị lực phải"]),
            ("thi_luc_mat_trai", ["thị lực mắt trái", "thị lực trái"]),
            ("nhan_ap_mat_phai", ["nhãn áp mắt phải", "nhãn áp phải"]),
            ("nhan_ap_mat_trai", ["nhãn áp mắt trái", "nhãn áp trái"]),
        ):
            val = _extract_item(kws)
            if val:
                setattr(sp_mat, attr, val)
        bp_truoc = _extract_item(["bán phần trước"])
        if bp_truoc:
            sp_mat.ban_phan_truoc_phai = bp_truoc
            sp_mat.ban_phan_truoc_trai = bp_truoc
        day_mat = _extract_item(["đáy mắt"])
        if day_mat:
            sp_mat.day_mat_phai = day_mat
            sp_mat.day_mat_trai = day_mat
        if ket_luan:
            sp_mat.ket_qua_kham_mat = ket_luan

    elif dept_key == "tai-mui-hong":
        sp_tmh = await _get_or_create_specialty_record(KhamTaiMuiHong, target_lk.id, bs_id, db)
        for attr, kws in (
            ("tai_phai", ["tai phải"]),
            ("tai_trai", ["tai trái"]),
            ("mui_xoang", ["mũi", "xoang"]),
            ("hong_thanh_quan", ["họng", "thanh quản"]),
            ("trieu_chung_lien_quan", ["hạch cổ"]),
        ):
            val = _extract_item(kws)
            if val:
                setattr(sp_tmh, attr, val)
        thinh = _extract_item(["thính lực"])
        if thinh:
            sp_tmh.thinh_luc_tai_phai = thinh
            sp_tmh.thinh_luc_tai_trai = thinh
        if ket_luan:
            sp_tmh.ket_luan_chuyen_khoa = ket_luan

    elif dept_key == "rang-ham-mat":
        sp_rhm = await _get_or_create_specialty_record(KhamRangHamMat, target_lk.id, bs_id, db)
        for attr, kws in (
            ("ham_tren", ["hàm trên"]),
            ("ham_duoi", ["hàm dưới"]),
            ("nha_chu_nuou", ["nha chu", "nướu"]),
            ("khop_can", ["khớp thái dương", "khớp cắn"]),
        ):
            val = _extract_item(kws)
            if val:
                setattr(sp_rhm, attr, val)
        niem_mac = _extract_item(["niêm mạc", "miệng"])
        if niem_mac:
            sp_rhm.ghi_chu = f"Niêm mạc miệng: {niem_mac}"
        if extras.get("vi_tri_rang"):
            sp_rhm.vi_tri_rang = str(extras.get("vi_tri_rang"))
        if extras.get("tinh_trang_rang"):
            sp_rhm.tinh_trang_rang = str(extras.get("tinh_trang_rang"))
        if ket_luan:
            sp_rhm.huong_dieu_tri = ket_luan


async def _sync_subclinical_orders(
    target_lk: LuotKham,
    enc_data: dict,
    bs_id: Optional[int],
    db: AsyncSession,
) -> None:
    orders = [o for o in (enc_data.get("danh_sach_chi_dinh") or []) if isinstance(o, dict)]
    if not orders or settings.is_hosted:
        return

    service_codes = [str(o.get("ma_dich_vu") or f"DV-{o.get('dich_vu_id', 1)}")[:50] for o in orders]
    existing_dvs = (await db.execute(select(DichVu).where(DichVu.ma_dich_vu.in_(service_codes)))).scalars().all()
    dv_map = {dv.ma_dich_vu: dv for dv in existing_dvs}

    existing_orders = (await db.execute(select(ChiDinh).where(ChiDinh.luot_kham_id == target_lk.id))).scalars().all()
    order_map = {ord_row.dich_vu_id: ord_row for ord_row in existing_orders}

    for ord_item in orders:
        if ord_item.get("server_order_id"):
            continue
        ma_dv = str(ord_item.get("ma_dich_vu") or f"DV-{ord_item.get('dich_vu_id', 1)}")[:50]
        ten_dv = str(ord_item.get("ten_dich_vu") or "Dịch vụ cận lâm sàng")[:150]
        dv = dv_map.get(ma_dv)
        if not dv:
            dv = DichVu(
                ma_dich_vu=ma_dv,
                ten_dich_vu=ten_dv,
                don_gia=Decimal("150000"),
                don_vi_tinh="Lần",
                ma_nhom_byt=str(ord_item.get("nhom_dich_vu") or "xet_nghiem")[:50],
                is_active=True,
            )
            db.add(dv)
            await db.flush()
            dv_map[ma_dv] = dv

        existing_order = order_map.get(dv.id)
        ket_qua_raw = ord_item.get("ket_qua_chi_tiet")
        ket_qua_str = (
            json.dumps(ket_qua_raw, ensure_ascii=False)
            if isinstance(ket_qua_raw, (dict, list))
            else (str(ket_qua_raw) if ket_qua_raw else None)
        )
        raw_status = str(ord_item.get("trang_thai") or "").strip()
        status_to_save = "CHO_THUC_HIEN" if (not raw_status or raw_status == "da_chi_dinh") else raw_status

        if existing_order:
            existing_order.trang_thai = status_to_save
            existing_order.ket_qua_phan_loai = ord_item.get("ket_qua_phan_loai")
            existing_order.ket_qua_chi_tiet = ket_qua_str
            existing_order.tep_dinh_kem_url = ord_item.get("tep_dinh_kem_url")
        else:
            new_order = ChiDinh(
                luot_kham_id=target_lk.id,
                dich_vu_id=dv.id,
                so_luong=1,
                don_gia_tai_thoi_diem=dv.don_gia or Decimal("150000"),
                trang_thai=status_to_save,
                bac_si_chi_dinh_id=bs_id,
                ket_qua_phan_loai=ord_item.get("ket_qua_phan_loai"),
                ket_qua_chi_tiet=ket_qua_str,
                tep_dinh_kem_url=ord_item.get("tep_dinh_kem_url"),
            )
            db.add(new_order)
            order_map[dv.id] = new_order


async def _sync_icd10_diagnoses(
    target_lk: LuotKham,
    enc_data: dict,
    bs_id: Optional[int],
    db: AsyncSession,
) -> None:
    diagnoses = enc_data.get("danh_sach_chan_doan")
    if not isinstance(diagnoses, list):
        return

    cur_diags = (await db.execute(select(ChanDoan).where(ChanDoan.luot_kham_id == target_lk.id))).scalars().all()
    for cd in cur_diags:
        await db.delete(cd)
    await db.flush()

    icd_codes = [
        str(d.get("ma_icd10") or "").strip()
        for d in diagnoses
        if isinstance(d, dict) and str(d.get("ma_icd10") or "").strip()
    ]
    kn_map = {}
    if icd_codes:
        kn_rows = (
            await db.execute(
                select(KhaiNiem).where(
                    KhaiNiem.ma_khai_niem.in_(icd_codes),
                    KhaiNiem.loai_khai_niem == "benh_icd10",
                )
            )
        ).scalars().all()
        kn_map = {kn.ma_khai_niem: kn for kn in kn_rows}

    primary_diag_str = None
    for d_item in diagnoses:
        if not isinstance(d_item, dict):
            continue
        ma = str(d_item.get("ma_icd10") or "").strip()
        if not ma:
            continue
        ten = str(d_item.get("ten_benh_chan_doan") or "").strip()
        loai = str(d_item.get("loai_chan_doan") or "chinh").strip().lower()
        kn = kn_map.get(ma)
        resolved_name = ten or (kn.ten_khai_niem if kn else ma)
        db.add(
            ChanDoan(
                luot_kham_id=target_lk.id,
                khai_niem_id=kn.id if kn else None,
                ma_icd10=ma,
                ten_benh_chan_doan=resolved_name,
                loai_chan_doan=loai if loai in ("chinh", "phu") else "chinh",
                ghi_chu_chuyen_mon=d_item.get("ghi_chu_chuyen_mon"),
                bac_si_ghi_nhan_id=bs_id,
            )
        )
        if loai == "chinh" and not primary_diag_str:
            primary_diag_str = f"{ma} - {resolved_name}"

    target_lk.chan_doan_so_bo = primary_diag_str[:255] if primary_diag_str else None


def _compute_medication_item_qty(m: dict, dose_slots: tuple[str, ...], days: int) -> int:
    raw_qty = m.get("so_luong")
    try:
        if raw_qty is not None and int(raw_qty) > 0:
            return int(raw_qty)
        tot_day = 0.0
        for slot in dose_slots:
            try:
                tot_day += float(slot)
            except (ValueError, TypeError):
                pass
        return max(1, int(tot_day * days) if tot_day > 0 else 1)
    except (ValueError, TypeError):
        return 1


async def _sync_prescription_and_signature(
    target_lk: LuotKham,
    enc_data: dict,
    bs_id: Optional[int],
    db: AsyncSession,
) -> None:
    from app.services.auth.credential_service import credential_service

    med_items = enc_data.get("danh_sach_thuoc")
    if med_items is None and isinstance(enc_data.get("don_thuoc"), dict):
        med_items = enc_data.get("don_thuoc", {}).get("danh_sach_thuoc")
    if not isinstance(med_items, list):
        return

    stmt_rx = (
        select(DonThuoc)
        .options(selectinload(DonThuoc.danh_sach_chi_tiet))
        .where(DonThuoc.luot_kham_id == target_lk.id)
        .order_by(DonThuoc.id.desc())
    )
    existing_rx = (await db.execute(stmt_rx)).scalars().first()

    requested_status = str(enc_data.get("trang_thai_don_thuoc") or "").strip()
    if not requested_status and isinstance(enc_data.get("don_thuoc"), dict):
        requested_status = str(enc_data.get("don_thuoc", {}).get("trang_thai") or "").strip()

    immutable_statuses = (
        TrangThaiDonThuoc.SIGNED.value,
        TrangThaiDonThuoc.ISSUED.value,
        TrangThaiDonThuoc.ACCEPTED.value,
        TrangThaiDonThuoc.SUPERSEDED.value,
    )
    if existing_rx and existing_rx.trang_thai in immutable_statuses:
        logger.info(
            f"🔒 [FSM IMMUTABILITY] DonThuoc #{existing_rx.id} đang ở trạng thái {existing_rx.trang_thai}, dữ liệu đã khóa bất biến!"
        )
        return

    rx_so_ngay = _to_int(enc_data.get("so_ngay_dung")) or 5
    rx_loi_dan = enc_data.get("loi_dan_uong_thuoc") or (
        enc_data.get("don_thuoc", {}).get("loi_dan_uong_thuoc") if isinstance(enc_data.get("don_thuoc"), dict) else ""
    )

    if not existing_rx and len(med_items) > 0:
        existing_rx = DonThuoc(
            luot_kham_id=target_lk.id,
            bac_si_ke_don_id=bs_id or 1,
            ngay_ke_don=datetime.now(timezone.utc),
            so_ngay_dung=rx_so_ngay,
            loi_dan_uong_thuoc=rx_loi_dan or "",
            trang_thai=TrangThaiDonThuoc.DRAFT.value,
        )
        db.add(existing_rx)
        await db.flush()
    elif existing_rx:
        existing_rx.loi_dan_uong_thuoc = rx_loi_dan or existing_rx.loi_dan_uong_thuoc
        existing_rx.so_ngay_dung = rx_so_ngay
        if not existing_rx.trang_thai:
            existing_rx.trang_thai = TrangThaiDonThuoc.DRAFT.value

    if not existing_rx:
        return

    cur_items = (
        await db.execute(select(ChiTietDonThuoc).where(ChiTietDonThuoc.don_thuoc_id == existing_rx.id))
    ).scalars().all()
    for old_item in cur_items:
        await db.delete(old_item)
    if cur_items:
        await db.flush()

    items_for_hash = []
    for m in med_items:
        if not isinstance(m, dict):
            continue
        t_name = str(m.get("ten_thuoc") or "").strip()
        if not t_name:
            continue
        l_sang = str(m.get("sang") or m.get("lieu_sang") or "")
        l_trua = str(m.get("trua") or m.get("lieu_trua") or "")
        l_chieu = str(m.get("chieu") or m.get("lieu_chieu") or "")
        l_toi = str(m.get("toi") or m.get("lieu_toi") or "")
        m_days = _to_int(m.get("so_ngay_dung")) or rx_so_ngay
        calc_qty = _compute_medication_item_qty(m, (l_sang, l_trua, l_chieu, l_toi), m_days)

        c_dung = str(m.get("cach_dung") or "").strip()
        if not c_dung:
            dparts = [
                f"{label} {val}"
                for label, val in (("sáng", l_sang), ("trưa", l_trua), ("chiều", l_chieu), ("tối", l_toi))
                if val and val != "0"
            ]
            c_dung = f"Uống {', '.join(dparts)} sau ăn" if dparts else "Uống theo chỉ dẫn"

        db.add(
            ChiTietDonThuoc(
                don_thuoc_id=existing_rx.id,
                ten_thuoc=t_name,
                hoat_chat=m.get("hoat_chat"),
                ham_luong=m.get("ham_luong"),
                don_vi_tinh=m.get("don_vi_tinh") or "Viên",
                so_luong=calc_qty,
                lieu_sang=l_sang,
                lieu_trua=l_trua,
                lieu_chieu=l_chieu,
                lieu_toi=l_toi,
                cach_dung=c_dung,
                so_ngay_dung=m_days,
                ghi_chu=m.get("ghi_chu"),
            )
        )
        items_for_hash.append(
            {
                "ten_thuoc": t_name,
                "ham_luong": m.get("ham_luong"),
                "so_luong": calc_qty,
                "don_vi_tinh": m.get("don_vi_tinh") or "Viên",
                "cach_dung": c_dung,
            }
        )

    if requested_status == TrangThaiDonThuoc.SIGNED.value and not settings.is_hosted:
        await credential_service.check_doctor_license_valid(db, bs_id)
        existing_rx.trang_thai = TrangThaiDonThuoc.SIGNED.value
        existing_rx.ngay_ky = datetime.now(timezone.utc)
        existing_rx.nguoi_ky_id = bs_id
        existing_rx.chu_ky_so = enc_data.get("chu_ky_so") or "BS-DIGITAL-SIGNATURE-SHA256"
        existing_rx.du_lieu_don_thuoc_hash = PrescriptionFSMService.compute_prescription_hash(
            existing_rx.id, items_for_hash
        )
        logger.info(
            f"✍️ [FSM SIGNED IN WORKSPACE] DonThuoc #{existing_rx.id} | Hash: {existing_rx.du_lieu_don_thuoc_hash}"
        )


async def sync_workspace_to_postgres(
    self,
    db: AsyncSession,
    payload: dict,
    current_user: Optional[TaiKhoan] = None,
) -> dict:
    doctor = None
    if current_user and current_user.vai_tro != VaiTroEnum.ADMIN.value:
        doctor = await self._get_doctor_from_user(current_user, db)

    try:
        await _sync_queue_tickets(self, payload["queue"], doctor, db)

        encounters = payload["encounters"]
        if isinstance(encounters, dict):
            for enc_key, enc_data in encounters.items():
                target_lk = await _resolve_target_encounter_for_sync(self, enc_key, doctor, db)
                bs_id = doctor.id if doctor else (target_lk.tiep_quan_boi_id or target_lk.bac_si_id)

                await _sync_vitals_and_clinical_notes(target_lk, enc_data, bs_id, db)
                await _sync_specialty_exam_sheet(target_lk, enc_data, bs_id, db)
                await _sync_subclinical_orders(target_lk, enc_data, bs_id, db)
                await _sync_icd10_diagnoses(target_lk, enc_data, bs_id, db)
                await _sync_prescription_and_signature(target_lk, enc_data, bs_id, db)

        await db.commit()
        return {"saved": True}
    except Exception:
        await db.rollback()
        raise
