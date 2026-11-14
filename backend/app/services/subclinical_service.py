import json
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import case, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
    UnprocessableEntityException,
)
from app.models.appointment import HangDoiKham, TrangThaiHangDoiEnum
from app.models.medical import ChiDinh, DichVu, KetQuaCLS, LuotKham, PhieuKetQuaCLS
from app.models.user import BacSi, BenhNhan, NguoiDung, TaiKhoan, VaiTroEnum
from app.models.production_models import (
    ParaclinicalOrderProduction,
    ParaclinicalResultProduction,
    ServiceProduction,
    UserProduction,
    EncounterProduction,
)
from app.schemas.subclinical import (
    PatientBrief,
    SubclinicalQueueItem,
    SubclinicalQueueResponse,
    SubclinicalResultSubmitRequest,
    SubclinicalServiceBrief,
    BarcodeGenerateResponse,
    ParaclinicalResultInput,
    ParaclinicalResultSubmitRequest as ProdResultSubmitRequest,
    ParaclinicalOrderResultResponse,
    ParaclinicalVerifyResponse,
    WorkspaceOrdersRequest,
    WorkspaceOrdersResponse,
    WorkspaceOrderItem,
    WorkspacePatientIn,
)
from app.services.cls_result_state import PHIEU_DA_DUYET, is_phieu_approved, latest_phieu
from app.services.cls_service_group import clinic_day_range, nhom_dich_vu_condition, nhom_dich_vu_of
from app.services.clinical_service import clinical_service
from app.services.credential_service import credential_service

logger = logging.getLogger(__name__)


def _normalize_name(name: str) -> str:
    return " ".join((name or "").split()).casefold()


class SubclinicalService:

    async def get_subclinical_queue(
        self,
        phong_thuc_hien_id: Optional[int] = None,
        trang_thai: Optional[str] = None,
        db: AsyncSession = None,
        nhom_dich_vu: Optional[str] = None,
        ngay: Optional[date] = None,
        tat_ca_ngay: bool = False,
        tu_khoa: Optional[str] = None,
    ) -> SubclinicalQueueResponse:
        stmt = (
            select(ChiDinh)
            .options(
                selectinload(ChiDinh.dich_vu),
                selectinload(ChiDinh.luot_kham).selectinload(LuotKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(ChiDinh.luot_kham).selectinload(LuotKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(ChiDinh.phieu_ket_qua),
            )
        )
        if not tat_ca_ngay:
            day_start, day_end = clinic_day_range(ngay)
            stmt = stmt.where(ChiDinh.created_at >= day_start, ChiDinh.created_at < day_end).order_by(
                ChiDinh.created_at.asc(), ChiDinh.id.asc()
            )
        else:
            pending_order = case(
                (ChiDinh.trang_thai.in_(["CHO_THUC_HIEN", "da_thanh_toan", "da_chi_dinh", "dang_thuc_hien"]), 0),
                else_=1,
            )
            stmt = stmt.order_by(pending_order.asc(), ChiDinh.created_at.desc(), ChiDinh.id.desc()).limit(200)

        if phong_thuc_hien_id is not None:
            stmt = stmt.where(
                (ChiDinh.phong_thuc_hien_id == phong_thuc_hien_id)
                | (ChiDinh.dich_vu.has(DichVu.phong_thuc_hien_id == phong_thuc_hien_id))
            )

        if nhom_dich_vu:
            stmt = stmt.where(ChiDinh.dich_vu.has(nhom_dich_vu_condition(nhom_dich_vu)))

        if tu_khoa and tu_khoa.strip():
            pattern = f"%{tu_khoa.strip()}%"
            stmt = stmt.where(
                ChiDinh.luot_kham.has(
                    LuotKham.benh_nhan.has(
                        BenhNhan.ma_dinh_danh_y_te.ilike(pattern)
                        | BenhNhan.nguoi_dung.has(
                            NguoiDung.ho_ten.ilike(pattern) | NguoiDung.so_dien_thoai.ilike(pattern)
                        )
                    )
                )
            )

        if trang_thai == "tat_ca":
            pass
        elif trang_thai:
            stmt = stmt.where(ChiDinh.trang_thai == trang_thai)
        else:
            stmt = stmt.where(ChiDinh.trang_thai.in_(["CHO_THUC_HIEN", "da_thanh_toan", "da_chi_dinh", "dang_thuc_hien"]))

        orders = (await db.execute(stmt)).scalars().all()

        now = datetime.now(timezone.utc)
        items: List[SubclinicalQueueItem] = []
        for o in orders:
            benh_nhan_dto = PatientBrief(ho_ten="Chưa xác định")
            if o.luot_kham and o.luot_kham.benh_nhan:
                bn = o.luot_kham.benh_nhan
                mabn = bn.ma_dinh_danh_y_te
                ho_ten = bn.nguoi_dung.ho_ten if bn.nguoi_dung else "Chưa xác định"
                sdt = bn.nguoi_dung.so_dien_thoai if bn.nguoi_dung else None
                gioi_tinh = bn.nguoi_dung.gioi_tinh if bn.nguoi_dung else None
                nam_sinh = bn.nguoi_dung.ngay_sinh.year if (bn.nguoi_dung and bn.nguoi_dung.ngay_sinh) else None
                benh_nhan_dto = PatientBrief(
                    mabn=mabn,
                    ho_ten=ho_ten,
                    so_dien_thoai=sdt,
                    gioi_tinh=gioi_tinh,
                    nam_sinh=nam_sinh,
                    di_ung_thuoc=bn.di_ung_thuoc,
                )

            bac_si_name = None
            if o.luot_kham and o.luot_kham.bac_si and o.luot_kham.bac_si.nguoi_dung:
                bac_si_name = o.luot_kham.bac_si.nguoi_dung.ho_ten

            dv_brief = SubclinicalServiceBrief(
                id=o.dich_vu_id,
                ma_dich_vu=o.dich_vu.ma_dich_vu if o.dich_vu else f"DV-{o.dich_vu_id}",
                ten_dich_vu=o.dich_vu.ten_dich_vu if o.dich_vu else "Dịch vụ cận lâm sàng",
                don_gia=o.don_gia_tai_thoi_diem or Decimal("0.00"),
            )

            waited_until = o.thoi_gian_thuc_hien or now
            if waited_until and waited_until.tzinfo is None:
                waited_until = waited_until.replace(tzinfo=timezone.utc)
            created_utc = o.created_at.replace(tzinfo=timezone.utc) if (o.created_at and o.created_at.tzinfo is None) else o.created_at
            items.append(
                SubclinicalQueueItem(
                    id=o.id,
                    luot_kham_id=o.luot_kham_id,
                    dich_vu=dv_brief,
                    nhom_dich_vu=nhom_dich_vu_of(o.dich_vu.ma_nhom_byt, o.dich_vu.ma_dich_vu) if o.dich_vu else None,
                    ten_dich_vu=dv_brief.ten_dich_vu,
                    benh_nhan=benh_nhan_dto,
                    bac_si_chi_dinh=bac_si_name,
                    ly_do_vao_kham=o.luot_kham.ly_do_vao_kham if o.luot_kham else None,
                    chan_doan_so_bo=o.luot_kham.chan_doan_so_bo if o.luot_kham else None,
                    trang_thai=o.trang_thai,
                    phong_thuc_hien_id=o.phong_thuc_hien_id or (o.dich_vu.phong_thuc_hien_id if o.dich_vu else None),
                    thoi_gian_chi_dinh=o.created_at,
                    thoi_gian_cho_phut=max(0, int((waited_until - created_utc).total_seconds() // 60)),
                    ket_qua_chi_tiet=o.ket_qua_chi_tiet,
                    ket_qua_phan_loai=o.ket_qua_phan_loai,
                    tri_so_chi_tiet=o.tri_so_chi_tiet,
                    file_dinh_kem_urls=o.file_dinh_kem_urls,
                    trang_thai_ket_qua=o.phieu_ket_qua.trang_thai if o.phieu_ket_qua else None,
                    thoi_gian_duyet=o.phieu_ket_qua.thoi_gian_duyet if o.phieu_ket_qua else None,
                )
            )

        return SubclinicalQueueResponse(items=items, total=len(items))

    async def start_subclinical_order(
        self,
        order_id: int,
        technician_user_id: int,
        db: AsyncSession,
    ) -> ChiDinh:
        stmt = (
            select(ChiDinh)
            .where(ChiDinh.id == order_id)
            .with_for_update()
        )
        order = (await db.execute(stmt)).scalar_one_or_none()
        if not order:
            raise NotFoundException(f"Không tìm thấy chỉ định cận lâm sàng ID {order_id}!")

        if order.trang_thai == "da_co_ket_qua":
            raise ConflictException("Chỉ định này đã có kết quả xét nghiệm hoàn tất!")

        if order.trang_thai == "da_huy":
            raise ConflictException("Chỉ định này đã bị hủy bỏ!")

        now = datetime.now(timezone.utc)
        order.trang_thai = "dang_thuc_hien"
        order.ky_thuat_vien_id = technician_user_id
        order.thoi_gian_thuc_hien = now
        if not order.thoi_gian_lay_mau:
            order.thoi_gian_lay_mau = now

        await db.commit()
        await db.refresh(order)
        return order

    async def submit_subclinical_result(
        self,
        order_id: int,
        payload: SubclinicalResultSubmitRequest,
        technician_user_id: int,
        db: AsyncSession,
    ) -> ChiDinh:
        stmt = (
            select(ChiDinh)
            .options(
                selectinload(ChiDinh.dich_vu),
                selectinload(ChiDinh.ket_qua),
                selectinload(ChiDinh.phieu_ket_qua),
                selectinload(ChiDinh.luot_kham),
            )
            .where(ChiDinh.id == order_id)
            .with_for_update()
        )
        order = (await db.execute(stmt)).scalar_one_or_none()
        if not order:
            raise NotFoundException(f"Không tìm thấy chỉ định cận lâm sàng ID {order_id}!")

        if order.trang_thai == "da_huy":
            raise ConflictException("Không thể nhập kết quả cho chỉ định đã bị hủy!")
        if is_phieu_approved(await latest_phieu(order.id, db)):
            raise ConflictException("Kết quả đã được duyệt, không thể chỉnh sửa!")

        now = datetime.now(timezone.utc)
        tri_so = payload.tri_so_chi_tiet or {}
        if not tri_so and payload.ket_qua_chi_tiet:
            try:
                parsed = json.loads(payload.ket_qua_chi_tiet)
                if isinstance(parsed, dict):
                    tri_so = parsed
            except Exception:
                pass

        files = payload.file_dinh_kem_urls or []
        order.ket_qua_chi_tiet = payload.ket_qua_chi_tiet
        order.ket_qua_phan_loai = payload.ket_qua_phan_loai or "BINH_THUONG"
        order.tri_so_chi_tiet = tri_so
        order.file_dinh_kem_urls = files
        if files and not order.tep_dinh_kem_url:
            order.tep_dinh_kem_url = files[0]
        order.trang_thai = "da_co_ket_qua"
        order.thoi_gian_tra_ket_qua = now
        order.ky_thuat_vien_id = technician_user_id

        kq = order.ket_qua
        if kq is None:
            stmt_kq = select(KetQuaCLS).where(KetQuaCLS.chi_dinh_id == order.id)
            kq = (await db.execute(stmt_kq)).scalar_one_or_none()
        if kq is None:
            kq = KetQuaCLS(chi_dinh_id=order.id)
            db.add(kq)
            order.ket_qua = kq
        kq.nguoi_thuc_hien_id = technician_user_id
        kq.ket_qua_chi_tiet = payload.ket_qua_chi_tiet
        kq.tri_so_chi_tiet = tri_so
        kq.file_dinh_kem_urls = files
        kq.ket_qua_phan_loai = payload.ket_qua_phan_loai or "BINH_THUONG"
        kq.thoi_gian_thuc_hien = order.thoi_gian_thuc_hien or now
        kq.thoi_gian_duyet = now

        phieu = await latest_phieu(order.id, db)
        if phieu is None:
            phieu = PhieuKetQuaCLS(chi_dinh_id=order.id, lan_thuc_hien=1)
            db.add(phieu)
            order.phieu_ket_qua = phieu
        dv = order.dich_vu
        nhom = nhom_dich_vu_of(dv.ma_nhom_byt, dv.ma_dich_vu) if dv else None
        phieu.loai_ket_qua = nhom or "TDCN"
        phieu.trang_thai = PHIEU_DA_DUYET
        phieu.thoi_gian_tra_ket_qua = now
        phieu.thoi_gian_duyet = now
        phieu.ky_thuat_vien_id = technician_user_id
        phieu.tep_dinh_kem_urls = files
        if isinstance(tri_so, dict):
            phieu.mo_ta_hinh_anh = tri_so.get("mo_ta")
            phieu.ket_luan = tri_so.get("ket_luan") or payload.ket_qua_chi_tiet
            phieu.de_nghi = tri_so.get("de_nghi")
            phieu.ghi_chu = tri_so.get("ghi_chu")
            phieu.thiet_bi_thuc_hien = tri_so.get("thiet_bi")

        stmt_pending = select(ChiDinh).where(
            ChiDinh.luot_kham_id == order.luot_kham_id,
            ChiDinh.id != order.id,
            ChiDinh.trang_thai != "da_huy",
            ChiDinh.trang_thai != "da_co_ket_qua",
        )
        pending_order = (await db.execute(stmt_pending)).scalars().first()
        if not pending_order and order.luot_kham_id:
            lk = order.luot_kham or await db.get(LuotKham, order.luot_kham_id)
            if lk:
                ticket = None
                if lk.hang_doi_kham_id:
                    ticket = await db.get(HangDoiKham, lk.hang_doi_kham_id)
                if not ticket and lk.lich_kham_id:
                    stmt_t = (
                        select(HangDoiKham)
                        .where(
                            HangDoiKham.lich_kham_id == lk.lich_kham_id,
                            HangDoiKham.trang_thai.in_([
                                TrangThaiHangDoiEnum.TAM_HOAN.value,
                                TrangThaiHangDoiEnum.CHO_KHAM.value,
                            ]),
                        )
                        .order_by(HangDoiKham.id.desc())
                    )
                    ticket = (await db.execute(stmt_t)).scalars().first()
                if not ticket:
                    stmt_t = (
                        select(HangDoiKham)
                        .where(
                            HangDoiKham.benh_nhan_id == lk.benh_nhan_id,
                            HangDoiKham.trang_thai.in_([
                                TrangThaiHangDoiEnum.TAM_HOAN.value,
                                TrangThaiHangDoiEnum.CHO_KHAM.value,
                            ]),
                        )
                        .order_by(HangDoiKham.id.desc())
                    )
                    ticket = (await db.execute(stmt_t)).scalars().first()
                if ticket and ticket.trang_thai in (
                    TrangThaiHangDoiEnum.TAM_HOAN.value,
                    TrangThaiHangDoiEnum.CHO_KHAM.value,
                ):
                    ticket.trang_thai = TrangThaiHangDoiEnum.CHO_KHAM.value
                    ticket.muc_do_uu_tien = 3
                    ticket.thoi_gian_xep_hang_lai = now
                    ticket.ghi_chu_dieu_phoi = "Đã có KQ Cận lâm sàng"

        await db.commit()
        await db.refresh(order)
        return order

    async def cancel_subclinical_order(
        self,
        order_id: int,
        reason: str,
        user_id: int,
        db: AsyncSession,
    ) -> ChiDinh:
        stmt = select(ChiDinh).where(ChiDinh.id == order_id).with_for_update()
        order = (await db.execute(stmt)).scalar_one_or_none()
        if not order:
            raise NotFoundException(f"Không tìm thấy chỉ định cận lâm sàng ID {order_id}!")

        if order.trang_thai == "da_co_ket_qua":
            raise ConflictException("Không thể hủy chỉ định đã có kết quả!")

        order.trang_thai = "da_huy"
        order.ket_qua_chi_tiet = f"HỦY BỎ: {reason}"
        await db.commit()
        await db.refresh(order)
        return order

    async def create_orders_from_workspace(
        self, payload: WorkspaceOrdersRequest, user: TaiKhoan, db: AsyncSession
    ) -> WorkspaceOrdersResponse:
        bac_si = None
        if user.vai_tro == VaiTroEnum.BAC_SI.value:
            bac_si = await clinical_service._get_doctor_from_user(user, db)
        elif user.vai_tro == VaiTroEnum.ADMIN.value:
            stmt_admin_doc = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
            bac_si = (await db.execute(stmt_admin_doc)).scalar_one_or_none()
            if not bac_si:
                stmt_fallback = select(BacSi).where(BacSi.is_active.is_(True)).order_by(BacSi.id.asc())
                bac_si = (await db.execute(stmt_fallback)).scalars().first()
                if not bac_si:
                    raise NotFoundException("Hệ thống chưa có hồ sơ Bác sĩ nào đang hoạt động!")
        else:
            raise ForbiddenException("Chức năng chỉ định cận lâm sàng chỉ dành cho Bác sĩ hoặc Quản trị viên!")

        dich_vu_ids = list(dict.fromkeys(payload.dich_vu_ids))
        services = (await db.execute(select(DichVu).where(DichVu.id.in_(dich_vu_ids)))).scalars().all()
        services_by_id = {dv.id: dv for dv in services}
        for dv_id in dich_vu_ids:
            dv = services_by_id.get(dv_id)
            if not dv or not dv.is_active:
                raise NotFoundException(f"Dịch vụ cận lâm sàng ID {dv_id} không tồn tại hoặc đã tạm dừng cung cấp!")
            if user.vai_tro == VaiTroEnum.BAC_SI.value:
                await credential_service.check_doctor_scope_of_practice(db, bac_si.id, dv.id)

        ws_id = (payload.workspace_encounter_id or "").strip()
        ticket = None
        if ws_id.startswith("ticket-") and ws_id[7:].isdigit():
            stmt_ticket = (
                select(HangDoiKham)
                .options(selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung))
                .where(HangDoiKham.id == int(ws_id[7:]))
                .with_for_update()
            )
            ticket = (await db.execute(stmt_ticket)).scalar_one_or_none()

        benh_nhan = ticket.benh_nhan if ticket and ticket.benh_nhan is not None else None
        if not benh_nhan:
            ma = (payload.benh_nhan.ma or "").strip() or f"WS-BN-{payload.workspace_encounter_id}"
            stmt_bn = select(BenhNhan).options(selectinload(BenhNhan.nguoi_dung)).where(BenhNhan.ma_dinh_danh_y_te == ma)
            benh_nhan = (await db.execute(stmt_bn)).scalar_one_or_none()
            if benh_nhan:
                existing_name = benh_nhan.nguoi_dung.ho_ten if benh_nhan.nguoi_dung else ""
                if _normalize_name(existing_name) != _normalize_name(payload.benh_nhan.ho_ten):
                    raise ConflictException(f"Mã bệnh nhân {ma} đã thuộc về bệnh nhân khác, không thể gửi chỉ định!")
            if not benh_nhan:
                nguoi_dung = NguoiDung(
                    ho_ten=payload.benh_nhan.ho_ten.strip(),
                    so_dien_thoai=payload.benh_nhan.so_dien_thoai,
                    gioi_tinh=payload.benh_nhan.gioi_tinh or "Khác",
                    ngay_sinh=date(date.today().year - payload.benh_nhan.tuoi, 1, 1) if payload.benh_nhan.tuoi else None,
                )
                db.add(nguoi_dung)
                await db.flush()
                benh_nhan = BenhNhan(
                    nguoi_dung_id=nguoi_dung.id,
                    ma_dinh_danh_y_te=ma,
                    di_ung_thuoc=payload.benh_nhan.di_ung_thuoc or "Không",
                )
                db.add(benh_nhan)
                await db.flush()

        ma_kcb = f"WS-{payload.workspace_encounter_id}-{benh_nhan.id}"
        luot_kham = None
        if ticket is not None:
            lk_conditions = [
                LuotKham.hang_doi_kham_id == ticket.id,
                LuotKham.ma_kcb == ma_kcb,
                LuotKham.ma_kcb.like(f"WS-ticket-{ticket.id}-%"),
            ]
            if ticket.lich_kham_id is not None:
                lk_conditions.append(LuotKham.lich_kham_id == ticket.lich_kham_id)
            stmt_lk = (
                select(LuotKham)
                .where(or_(*lk_conditions), LuotKham.benh_nhan_id == benh_nhan.id)
                .order_by(LuotKham.hang_doi_kham_id.is_(None).asc(), LuotKham.id.asc())
                .with_for_update()
            )
            matched_lks = (await db.execute(stmt_lk)).scalars().all()
            if matched_lks:
                luot_kham = matched_lks[0]
                if len(matched_lks) > 1:
                    dup_ids = [dup.id for dup in matched_lks[1:]]
                    dup_orders = (
                        await db.execute(select(ChiDinh).where(ChiDinh.luot_kham_id.in_(dup_ids)).with_for_update())
                    ).scalars().all()
                    for dup_order in dup_orders:
                        dup_order.luot_kham_id = luot_kham.id
        elif ws_id.isdigit():
            stmt_lk = (
                select(LuotKham)
                .where(or_(LuotKham.id == int(ws_id), LuotKham.ma_kcb == ma_kcb))
                .order_by((LuotKham.id == int(ws_id)).desc(), LuotKham.id.asc())
                .with_for_update()
            )
            luot_kham = (await db.execute(stmt_lk)).scalars().first()
        else:
            stmt_lk = select(LuotKham).where(LuotKham.ma_kcb == ma_kcb).with_for_update()
            luot_kham = (await db.execute(stmt_lk)).scalars().first()

        if luot_kham is None:
            if user.vai_tro == VaiTroEnum.BAC_SI.value:
                await credential_service.check_doctor_license_valid(db, bac_si.id)
            luot_kham = LuotKham(
                ma_kcb=ma_kcb,
                hang_doi_kham_id=ticket.id if ticket else None,
                lich_kham_id=ticket.lich_kham_id if ticket else None,
                bac_si_id=ticket.bac_si_id if (ticket and ticket.bac_si_id) else bac_si.id,
                benh_nhan_id=benh_nhan.id,
                thoi_gian_bat_dau=datetime.now(timezone.utc),
                ly_do_vao_kham=payload.ly_do_vao_kham,
                chan_doan_so_bo=payload.chan_doan_so_bo,
                is_locked=False,
            )
            db.add(luot_kham)
            await db.flush()
        elif luot_kham.is_locked:
            raise ConflictException("Hồ sơ bệnh án đã bị khóa, không thể kê thêm chỉ định dịch vụ!")
        else:
            if ticket is not None:
                if luot_kham.hang_doi_kham_id is None:
                    luot_kham.hang_doi_kham_id = ticket.id
                if ticket.lich_kham_id is not None and luot_kham.lich_kham_id is None:
                    luot_kham.lich_kham_id = ticket.lich_kham_id
            if payload.ly_do_vao_kham and not luot_kham.ly_do_vao_kham:
                luot_kham.ly_do_vao_kham = payload.ly_do_vao_kham
            if payload.chan_doan_so_bo:
                luot_kham.chan_doan_so_bo = payload.chan_doan_so_bo

        stmt_orders = select(ChiDinh).where(
            ChiDinh.luot_kham_id == luot_kham.id,
            ChiDinh.dich_vu_id.in_(dich_vu_ids),
            ChiDinh.trang_thai != "da_huy",
        )
        active_by_service = {o.dich_vu_id: o for o in (await db.execute(stmt_orders)).scalars().all()}

        orders: List[ChiDinh] = []
        for dv_id in dich_vu_ids:
            order = active_by_service.get(dv_id)
            if order is None:
                dv = services_by_id[dv_id]
                order = ChiDinh(
                    luot_kham_id=luot_kham.id,
                    dich_vu_id=dv.id,
                    so_luong=1,
                    don_gia_tai_thoi_diem=dv.don_gia,
                    trang_thai="da_chi_dinh",
                    bac_si_chi_dinh_id=bac_si.id,
                    phong_thuc_hien_id=dv.phong_thuc_hien_id,
                )
                db.add(order)
            orders.append(order)

        if ticket is not None:
            if ticket.trang_thai != TrangThaiHangDoiEnum.DA_KHAM.value:
                ticket.trang_thai = TrangThaiHangDoiEnum.TAM_HOAN.value
                ticket.ghi_chu_dieu_phoi = "Chờ kết quả Cận lâm sàng"
        else:
            stmt_active_t = select(HangDoiKham).where(
                HangDoiKham.benh_nhan_id == benh_nhan.id,
                HangDoiKham.trang_thai.in_([
                    TrangThaiHangDoiEnum.DANG_KHAM.value,
                    TrangThaiHangDoiEnum.CHO_KHAM.value,
                    TrangThaiHangDoiEnum.CHO_GOI.value,
                    TrangThaiHangDoiEnum.DANG_GOI.value,
                ]),
            )
            active_t = (await db.execute(stmt_active_t)).scalars().first()
            if active_t:
                active_t.trang_thai = TrangThaiHangDoiEnum.TAM_HOAN.value
                active_t.ghi_chu_dieu_phoi = "Chờ kết quả Cận lâm sàng"

        await db.commit()
        for order in orders:
            await db.refresh(order)

        return WorkspaceOrdersResponse(
            luot_kham_id=luot_kham.id,
            orders=[
                WorkspaceOrderItem(
                    id=o.id,
                    dich_vu_id=o.dich_vu_id,
                    ma_dich_vu=services_by_id[o.dich_vu_id].ma_dich_vu,
                    nhom_dich_vu=nhom_dich_vu_of(
                        services_by_id[o.dich_vu_id].ma_nhom_byt, services_by_id[o.dich_vu_id].ma_dich_vu
                    ),
                    trang_thai=o.trang_thai,
                )
                for o in orders
            ],
        )

    async def generate_specimen_barcode(
        self, order_id: int, user: TaiKhoan, db: AsyncSession
    ) -> BarcodeGenerateResponse:
        prod_order = await db.get(ParaclinicalOrderProduction, order_id)
        legacy_order = await db.get(ChiDinh, order_id)

        if not prod_order and not legacy_order:
            raise NotFoundException(f"Không tìm thấy chỉ định cận lâm sàng với ID {order_id}")

        current_status = prod_order.status if prod_order else (legacy_order.trang_thai if legacy_order else "")
        if current_status in ("COMPLETED_VERIFIED", "da_duyet", "CANCELLED", "da_huy"):
            raise ConflictException(f"Không thể tạo barcode cho chỉ định ở trạng thái '{current_status}'")

        barcode = f"BC-LAB-{datetime.now().strftime('%Y%m%d')}-{order_id:06d}"

        if prod_order:
            prod_order.barcode_id = barcode
            prod_order.status = "SAMPLE_COLLECTED"

        if legacy_order:
            legacy_order.trang_thai = "dang_thuc_hien"

        await db.commit()

        return BarcodeGenerateResponse(
            order_id=order_id,
            barcode_id=barcode,
            status="SAMPLE_COLLECTED",
        )

    async def submit_paraclinical_results(
        self, order_id: int, payload: ProdResultSubmitRequest, user: TaiKhoan, db: AsyncSession
    ) -> ParaclinicalOrderResultResponse:
        prod_order = await db.get(ParaclinicalOrderProduction, order_id)
        legacy_order = await db.get(ChiDinh, order_id)

        if not prod_order and not legacy_order:
            raise NotFoundException(f"Không tìm thấy chỉ định cận lâm sàng với ID {order_id}")

        current_status = prod_order.status if prod_order else (legacy_order.trang_thai if legacy_order else "")
        if current_status in ("COMPLETED_VERIFIED", "da_duyet"):
            raise ConflictException("Kết quả xét nghiệm đã được duyệt, không thể ghi đè (Invariant CLS-1)")

        has_panic = False
        barcode_id = prod_order.barcode_id if prod_order else f"BC-LAB-{datetime.now().strftime('%Y%m%d')}-{order_id:06d}"

        performed_by_id = user.id
        user_prod_stmt = select(UserProduction.id).where(
            or_(
                UserProduction.id == user.id,
                UserProduction.email == getattr(user, "email", None),
                UserProduction.username == getattr(user, "email", None),
            )
        )
        found_prod_user_id = (await db.execute(user_prod_stmt)).scalar_one_or_none()
        if found_prod_user_id:
            performed_by_id = found_prod_user_id

        for item in payload.results:
            is_abnormal = False
            is_panic = False

            if item.numeric_value is not None:
                val = float(item.numeric_value)
                code_upper = item.parameter_code.upper()
                if "K+" in code_upper or "KALI" in code_upper:
                    if val > 6.5 or val < 2.5:
                        is_panic = True
                        has_panic = True
                elif "GLU" in code_upper:
                    if val < 2.8 or val > 25.0:
                        is_panic = True
                        has_panic = True

                if item.reference_high is not None and val > float(item.reference_high):
                    is_abnormal = True
                elif item.reference_low is not None and val < float(item.reference_low):
                    is_abnormal = True

            res_record = ParaclinicalResultProduction(
                order_id=order_id,
                parameter_code=item.parameter_code,
                parameter_name=item.parameter_name,
                measured_value=item.measured_value,
                numeric_value=Decimal(str(item.numeric_value)) if item.numeric_value is not None else None,
                measurement_unit=item.measurement_unit,
                reference_low=Decimal(str(item.reference_low)) if item.reference_low is not None else None,
                reference_high=Decimal(str(item.reference_high)) if item.reference_high is not None else None,
                is_abnormal=is_abnormal,
                is_panic_value=is_panic,
                conclusion=item.conclusion,
                performed_by=performed_by_id,
            )
            db.add(res_record)

        if prod_order:
            prod_order.status = "RESULT_ENTERED"

        if legacy_order:
            legacy_order.trang_thai = "da_co_ket_qua"
            legacy_order.ket_qua_chi_tiet = f"Kết quả {len(payload.results)} chỉ số. " + (payload.technician_notes or "")

        await db.commit()

        return ParaclinicalOrderResultResponse(
            order_id=order_id,
            status="RESULT_ENTERED",
            barcode_id=barcode_id,
            has_panic_value=has_panic,
            results_count=len(payload.results),
        )

    async def verify_paraclinical_order(
        self, order_id: int, user: TaiKhoan, db: AsyncSession
    ) -> ParaclinicalVerifyResponse:
        prod_order = await db.get(ParaclinicalOrderProduction, order_id)
        legacy_order = await db.get(ChiDinh, order_id)

        if not prod_order and not legacy_order:
            raise NotFoundException(f"Không tìm thấy chỉ định cận lâm sàng với ID {order_id}")

        now = datetime.now(timezone.utc)
        if prod_order:
            if prod_order.status not in ("RESULT_ENTERED", "PROCESSING", "ORDERED", "SAMPLE_COLLECTED"):
                raise ConflictException(f"Chỉ định ở trạng thái '{prod_order.status}' không thể duyệt!")
            prod_order.status = "COMPLETED_VERIFIED"
            prod_order.updated_at = now

        if legacy_order:
            legacy_order.trang_thai = "da_co_ket_qua"

        await db.commit()

        verified_by_id = user.id
        user_prod_stmt = select(UserProduction.id).where(
            or_(
                UserProduction.id == user.id,
                UserProduction.email == getattr(user, "email", None),
                UserProduction.username == getattr(user, "email", None),
            )
        )
        found_prod_user_id = (await db.execute(user_prod_stmt)).scalar_one_or_none()
        if found_prod_user_id:
            verified_by_id = found_prod_user_id

        return ParaclinicalVerifyResponse(
            order_id=order_id,
            status="COMPLETED_VERIFIED",
            verified_by=verified_by_id,
            verified_at=now,
        )



subclinical_service = SubclinicalService()
