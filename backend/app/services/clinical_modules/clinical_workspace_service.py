import hashlib
import json
import logging
import unicodedata
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, select, func, and_
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import (
    NotFoundException,
    ConflictException,
    ForbiddenException,
    UnprocessableEntityException,
    BadRequestException,
)
from app.models.production_models import (
    EncounterProduction,
    DiagnosisICD10Production,
    EncounterDiagnosisProduction,
    ClinicalVitalProduction,
    PatientAllergyProduction,
    EmrSignedRecordProduction,
    PatientProduction,
    UserProduction,
)
from app.models.appointment import (
    LichKham,
    TrangThaiLichEnum,
    CANCELLED_STATUSES,
    HangDoiKham,
    TrangThaiHangDoiEnum,
    PhanTichAI,
    PhanTichAIGoiY,
    DanhGiaAI,
)
from app.models.medical import (
    LuotKham,
    ChanDoan,
    ChiDinh,
    DichVu,
    KhaiNiem,
    DonThuoc,
    ChiTietDonThuoc,
    BienBanDinhChinh,
    AmendmentStatus,
    LuotKhamTheLuc,
    PhieuKhamChuyenKhoa,
)
from app.models.user import TaiKhoan, BacSi, BenhNhan, VaiTroEnum, ChuyenKhoa
from app.models.specialty_exam import (
    KhamNoiKhoa,
    KhamNgoaiKhoa,
    KhamMat,
    KhamTaiMuiHong,
    KhamRangHamMat,
)
from app.schemas.subclinical import PhysicalExamRequest, PhysicalExamResponse
from app.schemas.compliance import TrangThaiDonThuoc
from app.services.audit_trail_service import audit_trail_service
from app.services.prescription_fsm_service import PrescriptionFSMService
from app.schemas.clinical import (
    EncounterCreateRequest,
    EncounterCompleteRequest,
    EncounterResponse,
    DiagnosisCreateRequest,
    DiagnosisResponse,
    OrderCreateRequest,
    OrderResponse,
    OrderResultUpdateRequest,
    PrescriptionCreateRequest,
    PrescriptionResponse,
    PrescriptionItemResponse,
    AmendmentCreateRequest,
    AmendmentResponse,
    AmendmentApproveRequest,
    Icd10SearchItem,
    VitalsCreateRequest,
    VitalsResponse,
    SealAndSignResponse,
    AllergyCheckRequest,
    AllergyCheckResponse,
)
from app.schemas.ai import AiFeedbackRequest, AiFeedbackResponse

logger = logging.getLogger(__name__)

def _build_hang_doi_query(today, doc_id: Optional[int] = None):
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

async def get_or_sync_workspace_state(
    self,
    db: AsyncSession,
    current_user: TaiKhoan,
    doctor_id: Optional[int] = None,
) -> dict:
    doctor = None
    if current_user.vai_tro == VaiTroEnum.BAC_SI.value:
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
            if birth_date else None
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
        status = ticket.trang_thai
        if status in (TrangThaiHangDoiEnum.CHO_GOI.value, TrangThaiHangDoiEnum.DANG_GOI.value):
            status = TrangThaiHangDoiEnum.CHO_KHAM.value
        order_rows = encounter.danh_sach_chi_dinh if encounter else []
        active_orders = [order for order in order_rows if order.trang_thai != "da_huy"]
        orders_returned = bool(active_orders) and all(
            self._is_order_done(order) for order in active_orders
        )
        if encounter and encounter.is_locked:
            status = TrangThaiHangDoiEnum.DA_KHAM.value
        elif orders_returned and status in (
            TrangThaiHangDoiEnum.TAM_HOAN.value,
            TrangThaiHangDoiEnum.CHO_KHAM.value,
        ):
            status = "co_ket_qua_cls"
        elif active_orders and not orders_returned and status == TrangThaiHangDoiEnum.CHO_KHAM.value:
            status = TrangThaiHangDoiEnum.TAM_HOAN.value
        elif (
            encounter
            and encounter.thoi_gian_bat_dau
            and status == TrangThaiHangDoiEnum.CHO_KHAM.value
            and not active_orders
        ):
            status = TrangThaiHangDoiEnum.DANG_KHAM.value

        queue.append({
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
        })
        encounter_data = (
            self._to_encounter_response(encounter).model_dump(mode="json")
            if encounter else {
                "ly_do_vao_kham": appointment.ly_do_kham if appointment else None,
                "benh_su": appointment.trieu_chung_ban_dau if appointment else None,
                "is_locked": False,
                "danh_sach_chan_doan": [],
            }
        )
        serialized_orders = []
        for order, order_data in zip(order_rows, encounter_data.get("danh_sach_chi_dinh", [])):
            is_done = self._is_order_done(order)
            kq = getattr(order, "ket_qua", None)
            phieu = getattr(order, "phieu_ket_qua", None)
            tri_so_obj = order.tri_so_chi_tiet or (kq.tri_so_chi_tiet if kq else None)
            ket_qua_text = (
                order.ket_qua_chi_tiet
                or (kq.ket_qua_chi_tiet if kq else None)
                or (phieu.ket_luan if phieu else None)
                or (phieu.mo_ta_hinh_anh if phieu else None)
            )
            attachments = self._extract_order_attachments(order)
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
            serialized_orders.append({
                **order_data,
                "server_order_id": order.id,
                "ma_dich_vu": order.dich_vu.ma_dich_vu if order.dich_vu else None,
                "nhom_dich_vu": order.dich_vu.ma_nhom_byt if order.dich_vu else None,
                "trang_thai": "da_co_ket_qua" if is_done else order.trang_thai,
                "ket_qua_chi_tiet": tri_so_obj or ket_qua_text,
                "tri_so_chi_tiet": tri_so_obj,
                "ket_qua_phan_loai": phan_loai,
                "tep_dinh_kem_url": order.tep_dinh_kem_url or (attachments[0] if attachments else None),
                "tep_dinh_kem_urls": attachments,
                "thoi_gian_tra_ket_qua": returned_at.isoformat() if returned_at else order_data.get("thoi_gian_tra_ket_qua"),
            })

        dept_slug = self._resolve_specialty_slug(
            department.ma_chuyen_khoa if department else None,
            department.ten_chuyen_khoa if department else None,
        )
        encounter_data.update({
            "id": workspace_id,
            "ticket_id": ticket.id,
            "lich_kham_id": ticket.lich_kham_id,
            "luot_kham_server_id": encounter.id if encounter else None,
            "ma_lich_kham": appointment.ma_lich_kham if appointment else None,
            "benh_nhan": patient_data,
            "chuyen_khoa_kham": department.ma_chuyen_khoa if department else None,
            "ten_chuyen_khoa": department.ten_chuyen_khoa if department else None,
            "danh_sach_chi_dinh": serialized_orders,
            "kham_chuyen_khoa": self._reconstruct_specialty_exam(encounter, dept_slug, active_orders),
        })
        if encounter and encounter.don_thuoc:
            prescription = encounter_data["don_thuoc"]
            prescription["danh_sach_thuoc"] = prescription["danh_sach_chi_tiet"]
            encounter_data["danh_sach_thuoc"] = prescription["danh_sach_chi_tiet"]
        encounters[workspace_id] = encounter_data

    if merged_any:
        await db.commit()

    return await self.enrich_workspace_ai({"queue": queue, "encounters": encounters}, db)

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
    if "tmh" in raw or "tai" in raw or "họng" in raw:
        return "tai-mui-hong"
    if "rhm" in raw or "rang" in raw or "răng" in raw:
        return "rang-ham-mat"
    return "noi-khoa"

def _reconstruct_specialty_exam(
    cls,
    encounter: Optional[LuotKham],
    dept_slug: str,
    active_orders: List[ChiDinh],
) -> dict:
    templates = {
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
    labels = templates.get(dept_slug, templates["noi-khoa"])
    items_map = {}
    extras_map = {}
    if encounter is not None:
        phieu_list = getattr(encounter, "danh_sach_phieu_chuyen_khoa", None) or []
        phieu = sorted(phieu_list, key=lambda p: p.id or 0)[-1] if phieu_list else None
        if phieu and phieu.noi_dung_kham:
            extra_label_map = {
                "chi_dinh_phau_thuat_thu_thuat": "chi_dinh_phau_thuat_thu_thuat",
                "chi_dinh_tieu_phau": "chi_dinh_tieu_phau",
                "vi_tri_rang": "vi_tri_rang",
                "tinh_trang_rang": "tinh_trang_rang",
            }
            for raw_line in phieu.noi_dung_kham.splitlines():
                if ":" not in raw_line:
                    continue
                label, _, rest = raw_line.partition(":")
                label = label.strip()
                rest = rest.strip()
                if label in extra_label_map and rest:
                    extras_map[extra_label_map[label]] = rest
                    continue
                if label in labels:
                    if rest.startswith("Bất thường"):
                        note = ""
                        if "(" in rest and rest.endswith(")"):
                            note = rest[rest.index("(") + 1:-1].strip()
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
    self, ticket: HangDoiKham, db: AsyncSession, *, for_update: bool = False
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
    self, ticket: HangDoiKham, db: AsyncSession, *, for_update: bool = False
) -> Optional[LuotKham]:
    encounter, _ = await self._resolve_and_heal_ticket_encounter(ticket, db, for_update=for_update)
    return encounter

async def sync_workspace_to_postgres(
    self,
    db: AsyncSession,
    payload: dict,
    current_user: TaiKhoan,
) -> dict:
    doctor = None
    if current_user.vai_tro != VaiTroEnum.ADMIN.value:
        doctor = await self._get_doctor_from_user(current_user, db)

    try:
        from app.services.credential_service import credential_service

        for item in sorted(payload["queue"], key=lambda entry: entry["ticket_id"]):
            ticket = (await db.execute(
                select(HangDoiKham).options(selectinload(HangDoiKham.lich_kham))
                .where(HangDoiKham.id == item["ticket_id"]).with_for_update()
            )).scalar_one_or_none()
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
                    db.add(LuotKham(
                        lich_kham_id=ticket.lich_kham_id,
                        hang_doi_kham_id=ticket.id,
                        bac_si_id=ticket.bac_si_id,
                        benh_nhan_id=ticket.benh_nhan_id,
                        thoi_gian_bat_dau=datetime.now(timezone.utc),
                        ly_do_vao_kham=ticket.lich_kham.ly_do_kham if ticket.lich_kham else None,
                    ))
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

        def _to_int(val):
            try:
                return int(val) if val is not None and str(val).strip() != "" else None
            except (ValueError, TypeError):
                return None

        def _to_dec(val, precision=1):
            try:
                return Decimal(str(round(float(val), precision))) if val is not None and str(val).strip() != "" else None
            except (ValueError, TypeError):
                return None

        async def _get_or_create_specialty(model_cls, lk_id, b_id):
            rec = (await db.execute(select(model_cls).where(model_cls.luot_kham_id == lk_id))).scalars().first()
            if not rec:
                rec = model_cls(luot_kham_id=lk_id, bac_si_thuc_hien_id=b_id)
                db.add(rec)
            elif b_id:
                rec.bac_si_thuc_hien_id = b_id
            return rec

        encounters = payload["encounters"]

        if isinstance(encounters, dict):
            for enc_key, enc_data in encounters.items():
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

                if "mach_lan_phut" in enc_data:
                    m = _to_int(enc_data.get("mach_lan_phut"))
                    if m is not None:
                        target_lk.mach_lan_phut = m

                if "huyet_ap_tam_thu" in enc_data:
                    ha1 = _to_int(enc_data.get("huyet_ap_tam_thu"))
                    if ha1 is not None:
                        target_lk.huyet_ap_tam_thu = ha1

                if "huyet_ap_tam_truong" in enc_data:
                    ha2 = _to_int(enc_data.get("huyet_ap_tam_truong"))
                    if ha2 is not None:
                        target_lk.huyet_ap_tam_truong = ha2

                if "nhip_tho_lan_phut" in enc_data:
                    nt = _to_int(enc_data.get("nhip_tho_lan_phut"))
                    if nt is not None:
                        target_lk.nhip_tho_lan_phut = nt

                if "nhiet_do_c" in enc_data:
                    temp = _to_dec(enc_data.get("nhiet_do_c"), 1)
                    if temp is not None:
                        target_lk.nhiet_do_c = temp

                if "can_nang_kg" in enc_data:
                    cn = _to_dec(enc_data.get("can_nang_kg"), 2)
                    if cn is not None:
                        target_lk.can_nang_kg = cn

                if "chieu_cao_cm" in enc_data:
                    cc = _to_dec(enc_data.get("chieu_cao_cm"), 2)
                    if cc is not None:
                        target_lk.chieu_cao_cm = cc

                if target_lk.can_nang_kg and target_lk.chieu_cao_cm and target_lk.chieu_cao_cm > 0:
                    h_m = float(target_lk.chieu_cao_cm) / 100.0
                    bmi_calc = float(target_lk.can_nang_kg) / (h_m * h_m)
                    target_lk.bmi = Decimal(str(round(bmi_calc, 1)))

                if enc_data.get("ly_do_vao_kham"):
                    target_lk.ly_do_vao_kham = enc_data.get("ly_do_vao_kham")
                    if not target_lk.trieu_chung:
                        target_lk.trieu_chung = target_lk.ly_do_vao_kham

                if enc_data.get("benh_su"):
                    target_lk.benh_su = enc_data.get("benh_su")

                if enc_data.get("kham_lam_sang_bo_phan"):
                    target_lk.kham_lam_sang_bo_phan = enc_data.get("kham_lam_sang_bo_phan")

                bs_id = doctor.id if doctor else (target_lk.tiep_quan_boi_id or target_lk.bac_si_id)

                kham_ck = enc_data.get("kham_chuyen_khoa")
                if kham_ck is not None or enc_data.get("ket_luan_dieu_tri"):
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
                        await db.execute(
                            select(PhieuKhamChuyenKhoa).where(
                                PhieuKhamChuyenKhoa.luot_kham_id == target_lk.id
                            )
                        )
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
                    dept_key = None
                    if "ngoai" in raw_khoa.lower():
                        dept_key = "ngoai-khoa"
                    elif "mat" in raw_khoa.lower():
                        dept_key = "mat"
                    elif "tai" in raw_khoa.lower() or "tmh" in raw_khoa.lower() or "hong" in raw_khoa.lower():
                        dept_key = "tai-mui-hong"
                    elif "rang" in raw_khoa.lower() or "rhm" in raw_khoa.lower():
                        dept_key = "rang-ham-mat"
                    elif "noi" in raw_khoa.lower():
                        dept_key = "noi-khoa"
                    elif chuyen_khoa_id:
                        ck_row = (await db.execute(select(ChuyenKhoa).where(ChuyenKhoa.id == chuyen_khoa_id))).scalar_one_or_none()
                        if ck_row:
                            m_code = (ck_row.ma_chuyen_khoa or "").upper()
                            if "NGOAI" in m_code:
                                dept_key = "ngoai-khoa"
                            elif "MAT" in m_code:
                                dept_key = "mat"
                            elif "TMH" in m_code or "TAI" in m_code:
                                dept_key = "tai-mui-hong"
                            elif "RANG" in m_code or "RHM" in m_code:
                                dept_key = "rang-ham-mat"
                            else:
                                dept_key = "noi-khoa"
                    else:
                        dept_key = "noi-khoa"

                    def _extract_item_value(kw_list):
                        for label, it in items.items():
                            if any(kw in label.lower() for kw in kw_list) and isinstance(it, dict):
                                st = "Bình thường" if it.get("status") == "BT" else ("Bất thường" if it.get("status") == "BAT" else (it.get("status") or ""))
                                return f"{st}: {it.get('note')}" if it.get("note") else st
                        return None

                    if dept_key == "noi-khoa":
                        sp_noi = await _get_or_create_specialty(KhamNoiKhoa, target_lk.id, bs_id)
                        th = _extract_item_value(["tuần hoàn", "tim mạch"])
                        if th:
                            sp_noi.tuan_hoan = th
                        hh = _extract_item_value(["hô hấp", "phổi"])
                        if hh:
                            sp_noi.ho_hap = hh
                        thoa = _extract_item_value(["tiêu hóa", "bụng"])
                        if thoa:
                            sp_noi.tieu_hoa = thoa
                        tn = _extract_item_value(["thận", "tiết niệu"])
                        if tn:
                            sp_noi.than_tiet_nieu = tn
                        tk = _extract_item_value(["thần kinh"])
                        if tk:
                            sp_noi.than_kinh = tk
                        cxk = _extract_item_value(["cơ xương khớp"])
                        if cxk:
                            sp_noi.co_xuong_khop = cxk
                        if enc_data.get("ket_luan_dieu_tri"):
                            sp_noi.ket_luan_chuyen_khoa = enc_data.get("ket_luan_dieu_tri")

                    elif dept_key == "ngoai-khoa":
                        sp_ngoai = await _get_or_create_specialty(KhamNgoaiKhoa, target_lk.id, bs_id)
                        kham_tt = _extract_item_value(["ngoại tổng quát", "thực thể"])
                        if kham_tt:
                            sp_ngoai.ket_qua_kham_thuc_the = kham_tt
                        vet_thuong = _extract_item_value(["vết thương", "vết mổ"])
                        if vet_thuong:
                            sp_ngoai.tinh_trang_vet_thuong = vet_thuong
                        khoi_u = _extract_item_value(["khối u", "thoát vị"])
                        if khoi_u:
                            sp_ngoai.mo_ta_ton_thuong = khoi_u
                        di_tat = _extract_item_value(["dị tật", "vận động", "vị trí"])
                        if di_tat:
                            sp_ngoai.vi_tri_ton_thuong = di_tat
                        if extras.get("chi_dinh_phau_thuat_thu_thuat") or extras.get("loai_phau_thuat_thu_thuat"):
                            sp_ngoai.chi_dinh_phau_thuat_thu_thuat = str(extras.get("chi_dinh_phau_thuat_thu_thuat") or extras.get("loai_phau_thuat_thu_thuat"))
                        if "chi_dinh_tieu_phau" in extras:
                            raw_tp = extras.get("chi_dinh_tieu_phau")
                            if isinstance(raw_tp, bool):
                                sp_ngoai.chi_dinh_tieu_phau = "Có chỉ định tiểu phẫu" if raw_tp else None
                            elif isinstance(raw_tp, str):
                                sp_ngoai.chi_dinh_tieu_phau = raw_tp.strip() or None
                            elif raw_tp is not None:
                                sp_ngoai.chi_dinh_tieu_phau = str(raw_tp)
                        if enc_data.get("ket_luan_dieu_tri"):
                            sp_ngoai.ket_luan_chuyen_khoa = enc_data.get("ket_luan_dieu_tri")

                    elif dept_key == "mat":
                        sp_mat = await _get_or_create_specialty(KhamMat, target_lk.id, bs_id)
                        tl_phai = _extract_item_value(["thị lực mắt phải", "thị lực phải"])
                        if tl_phai:
                            sp_mat.thi_luc_mat_phai = tl_phai
                        tl_trai = _extract_item_value(["thị lực mắt trái", "thị lực trái"])
                        if tl_trai:
                            sp_mat.thi_luc_mat_trai = tl_trai
                        na_phai = _extract_item_value(["nhãn áp mắt phải", "nhãn áp phải"])
                        if na_phai:
                            sp_mat.nhan_ap_mat_phai = na_phai
                        na_trai = _extract_item_value(["nhãn áp mắt trái", "nhãn áp trái"])
                        if na_trai:
                            sp_mat.nhan_ap_mat_trai = na_trai
                        bp_truoc = _extract_item_value(["bán phần trước"])
                        if bp_truoc:
                            sp_mat.ban_phan_truoc_phai = bp_truoc
                            sp_mat.ban_phan_truoc_trai = bp_truoc
                        day_mat = _extract_item_value(["đáy mắt"])
                        if day_mat:
                            sp_mat.day_mat_phai = day_mat
                            sp_mat.day_mat_trai = day_mat
                        if enc_data.get("ket_luan_dieu_tri"):
                            sp_mat.ket_qua_kham_mat = enc_data.get("ket_luan_dieu_tri")

                    elif dept_key == "tai-mui-hong":
                        sp_tmh = await _get_or_create_specialty(KhamTaiMuiHong, target_lk.id, bs_id)
                        tai_p = _extract_item_value(["tai phải"])
                        if tai_p:
                            sp_tmh.tai_phai = tai_p
                        tai_t = _extract_item_value(["tai trái"])
                        if tai_t:
                            sp_tmh.tai_trai = tai_t
                        mui = _extract_item_value(["mũi", "xoang"])
                        if mui:
                            sp_tmh.mui_xoang = mui
                        hong = _extract_item_value(["họng", "thanh quản"])
                        if hong:
                            sp_tmh.hong_thanh_quan = hong
                        hach = _extract_item_value(["hạch cổ"])
                        if hach:
                            sp_tmh.trieu_chung_lien_quan = hach
                        thinh = _extract_item_value(["thính lực"])
                        if thinh:
                            sp_tmh.thinh_luc_tai_phai = thinh
                            sp_tmh.thinh_luc_tai_trai = thinh
                        if enc_data.get("ket_luan_dieu_tri"):
                            sp_tmh.ket_luan_chuyen_khoa = enc_data.get("ket_luan_dieu_tri")

                    elif dept_key == "rang-ham-mat":
                        sp_rhm = await _get_or_create_specialty(KhamRangHamMat, target_lk.id, bs_id)
                        ham_tren = _extract_item_value(["hàm trên"])
                        if ham_tren:
                            sp_rhm.ham_tren = ham_tren
                        ham_duoi = _extract_item_value(["hàm dưới"])
                        if ham_duoi:
                            sp_rhm.ham_duoi = ham_duoi
                        nha_chu = _extract_item_value(["nha chu", "nướu"])
                        if nha_chu:
                            sp_rhm.nha_chu_nuou = nha_chu
                        khop = _extract_item_value(["khớp thái dương", "khớp cắn"])
                        if khop:
                            sp_rhm.khop_can = khop
                        niem_mac = _extract_item_value(["niêm mạc", "miệng"])
                        if niem_mac:
                            sp_rhm.ghi_chu = f"Niêm mạc miệng: {niem_mac}"
                        if extras.get("vi_tri_rang"):
                            sp_rhm.vi_tri_rang = str(extras.get("vi_tri_rang"))
                        if extras.get("tinh_trang_rang"):
                            sp_rhm.tinh_trang_rang = str(extras.get("tinh_trang_rang"))
                        if enc_data.get("ket_luan_dieu_tri"):
                            sp_rhm.huong_dieu_tri = enc_data.get("ket_luan_dieu_tri")

                pe_rec = (
                    await db.execute(
                        select(LuotKhamTheLuc).where(LuotKhamTheLuc.luot_kham_id == target_lk.id)
                    )
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

                orders = [o for o in (enc_data.get("danh_sach_chi_dinh") or []) if isinstance(o, dict)]
                if orders and not settings.is_hosted:
                    service_codes = [str(o.get("ma_dich_vu") or f"DV-{o.get('dich_vu_id', 1)}")[:50] for o in orders]
                    existing_dvs = (
                        await db.execute(select(DichVu).where(DichVu.ma_dich_vu.in_(service_codes)))
                    ).scalars().all()
                    dv_map = {dv.ma_dich_vu: dv for dv in existing_dvs}

                    existing_orders = (
                        await db.execute(
                            select(ChiDinh).where(ChiDinh.luot_kham_id == target_lk.id)
                        )
                    ).scalars().all()
                    order_map = {ord.dich_vu_id: ord for ord in existing_orders}

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
                        if not raw_status or raw_status == "da_chi_dinh":
                            status_to_save = "CHO_THUC_HIEN"
                        else:
                            status_to_save = raw_status

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

                diagnoses = enc_data.get("danh_sach_chan_doan")
                if isinstance(diagnoses, list):
                    cur_diags = (
                        await db.execute(
                            select(ChanDoan).where(ChanDoan.luot_kham_id == target_lk.id)
                        )
                    ).scalars().all()
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
                        ten = str(d_item.get("ten_benh_chan_doan") or "").strip()
                        loai = str(d_item.get("loai_chan_doan") or "chinh").strip().lower()
                        if not ma:
                            continue

                        kn = kn_map.get(ma)

                        db.add(
                            ChanDoan(
                                luot_kham_id=target_lk.id,
                                khai_niem_id=kn.id if kn else None,
                                ma_icd10=ma,
                                ten_benh_chan_doan=ten or (kn.ten_khai_niem if kn else ma),
                                loai_chan_doan=loai if loai in ("chinh", "phu") else "chinh",
                                ghi_chu_chuyen_mon=d_item.get("ghi_chu_chuyen_mon"),
                                bac_si_ghi_nhan_id=bs_id,
                            )
                        )
                        if loai == "chinh" and not primary_diag_str:
                            primary_diag_str = f"{ma} - {ten or (kn.ten_khai_niem if kn else ma)}"

                    target_lk.chan_doan_so_bo = primary_diag_str[:255] if primary_diag_str else None

                med_items = enc_data.get("danh_sach_thuoc")
                if med_items is None and isinstance(enc_data.get("don_thuoc"), dict):
                    med_items = enc_data.get("don_thuoc", {}).get("danh_sach_thuoc")

                if med_items is not None and isinstance(med_items, list):
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

                    if existing_rx and existing_rx.trang_thai in (
                        TrangThaiDonThuoc.SIGNED.value,
                        TrangThaiDonThuoc.ISSUED.value,
                        TrangThaiDonThuoc.ACCEPTED.value,
                        TrangThaiDonThuoc.SUPERSEDED.value,
                    ):
                        logger.info(
                            f"🔒 [FSM IMMUTABILITY] DonThuoc #{existing_rx.id} đang ở trạng thái {existing_rx.trang_thai}, dữ liệu đã khóa bất biến!"
                        )
                    else:
                        rx_so_ngay = 5
                        try:
                            rx_so_ngay = int(enc_data.get("so_ngay_dung") or 5)
                        except (ValueError, TypeError):
                            pass

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

                        if existing_rx:
                            cur_items = (
                                await db.execute(
                                    select(ChiTietDonThuoc).where(ChiTietDonThuoc.don_thuoc_id == existing_rx.id)
                                )
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

                                m_days = rx_so_ngay
                                try:
                                    m_days = int(m.get("so_ngay_dung") or rx_so_ngay)
                                except (ValueError, TypeError):
                                    pass

                                raw_qty = m.get("so_luong")
                                calc_qty = 1
                                try:
                                    if raw_qty is not None and int(raw_qty) > 0:
                                        calc_qty = int(raw_qty)
                                    else:
                                        tot_day = 0.0
                                        for slot in (l_sang, l_trua, l_chieu, l_toi):
                                            try:
                                                tot_day += float(slot)
                                            except (ValueError, TypeError):
                                                pass
                                        calc_qty = max(1, int(tot_day * m_days) if tot_day > 0 else 1)
                                except (ValueError, TypeError):
                                    calc_qty = 1

                                c_dung = str(m.get("cach_dung") or "").strip()
                                if not c_dung:
                                    dparts = []
                                    if l_sang and l_sang != "0":
                                        dparts.append(f"sáng {l_sang}")
                                    if l_trua and l_trua != "0":
                                        dparts.append(f"trưa {l_trua}")
                                    if l_chieu and l_chieu != "0":
                                        dparts.append(f"chiều {l_chieu}")
                                    if l_toi and l_toi != "0":
                                        dparts.append(f"tối {l_toi}")
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
                                items_for_hash.append({
                                    "ten_thuoc": t_name,
                                    "ham_luong": m.get("ham_luong"),
                                    "so_luong": calc_qty,
                                    "don_vi_tinh": m.get("don_vi_tinh") or "Viên",
                                    "cach_dung": c_dung,
                                })

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

        await db.commit()
        return {"saved": True}
    except Exception:
        await db.rollback()
        raise
