import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
    UnprocessableEntityException,
)
from app.models.appointment import LichKham
from app.models.medical import (
    ChiDinh,
    ChiTietHoaDon,
    DonThuoc,
    GiaoDichThanhToan,
    HoaDon,
    LuotKham,
    PhieuThuChi,
)
from app.models.user import BacSi, BenhNhan
from app.schemas.cashier import (
    CloseShiftResponse,
    InvoiceCreateRequest,
    InvoicePayRequest,
    InvoicePreviewLine,
    InvoicePreviewResponse,
    PendingBillsListResponse,
    RefundInvoiceRequest,
    RefundInvoiceResponse,
    SepayWebhookPayload,
    SepayWebhookResponse,
    ShiftSummaryResponse,
    UnbilledEncounterItem,
    UnbilledEncountersListResponse,
)
from app.services.billing_calculator import (
    ZERO,
    ExamServiceResolver,
    estimate_encounter,
    sum_cls_fee,
)
from app.services.cashier_modules.cashier_helpers import (
    doctor_name,
    find_invoice_by_ref,
    is_lock_not_available,
    patient_brief,
)
from app.services.cashier_modules.cashier_query_service import (
    get_pending_bills as cashier_get_pending_bills,
    list_invoices as cashier_list_invoices,
)
from app.services.cashier_modules.cashier_shift_service import (
    close_shift as cashier_shift_close_shift,
    get_shift_summary as cashier_shift_get_summary,
    refund_invoice as cashier_shift_refund,
)
from app.services.cashier_modules.cashier_webhook_service import (
    process_sepay_webhook as cashier_webhook_process,
)

logger = logging.getLogger(__name__)

THONG_BAO_DANG_XU_LY = "Lượt khám đang được thu ngân khác xử lý. Vui lòng tải lại dữ liệu."
THONG_BAO_DA_CO_HOA_DON = "Lượt khám này đã có hóa đơn hiệu lực. Vui lòng tải lại dữ liệu."

_is_lock_not_available = is_lock_not_available
_patient_brief = patient_brief
_doctor_name = doctor_name

class CashierService:
    async def _find_invoice_by_ref(
        self,
        invoice_ref: int | str,
        db: AsyncSession,
        lock: bool = False,
    ) -> Optional[HoaDon]:
        return await find_invoice_by_ref(invoice_ref, db, lock=lock)

    async def get_invoice_detail(self, invoice_id: int | str, db: AsyncSession) -> HoaDon:
        invoice = await self._find_invoice_by_ref(invoice_id, db, lock=False)
        if not invoice:
            raise NotFoundException(f"Không tìm thấy hóa đơn ID {invoice_id}!")
        return invoice

    async def _load_encounter_for_billing(
        self,
        luot_kham_id: int,
        db: AsyncSession,
        lock: bool,
    ) -> LuotKham:
        stmt = (
            select(LuotKham)
            .options(
                selectinload(LuotKham.lich_kham).selectinload(LichKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LuotKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LuotKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(LuotKham.danh_sach_chi_dinh).selectinload(ChiDinh.dich_vu),
                selectinload(LuotKham.danh_sach_don_thuoc).selectinload(DonThuoc.danh_sach_chi_tiet),
            )
            .where(LuotKham.id == luot_kham_id)
        )
        if lock:
            stmt = stmt.with_for_update(nowait=True)

        try:
            luot_kham = (await db.execute(stmt)).scalar_one_or_none()
        except DBAPIError as exc:
            await db.rollback()
            if is_lock_not_available(exc):
                raise ConflictException(THONG_BAO_DANG_XU_LY) from exc
            raise

        if not luot_kham:
            raise NotFoundException(f"Không tìm thấy thông tin lượt khám ID {luot_kham_id}!")
        return luot_kham

    async def _inspect_billing_state(self, luot_kham_id: int, db: AsyncSession):
        stmt_exist = (
            select(HoaDon)
            .options(selectinload(HoaDon.chi_tiet_hoa_don))
            .where(
                HoaDon.luot_kham_id == luot_kham_id,
                HoaDon.trang_thai.in_(["chua_thu", "da_thu"]),
            )
        )
        existing_invoices = (await db.execute(stmt_exist)).scalars().all()
        pending_bill = next((inv for inv in existing_invoices if inv.trang_thai == "chua_thu"), None)
        has_cong_kham = any(
            any(item.loai_muc == "cong_kham" for item in (inv.chi_tiet_hoa_don or []))
            for inv in existing_invoices
        )
        billed_cd_ids = {
            item.muc_tham_chieu_id
            for inv in existing_invoices
            for item in (inv.chi_tiet_hoa_don or [])
            if item.loai_muc == "can_lam_sang" and item.muc_tham_chieu_id is not None
        }
        return pending_bill, has_cong_kham, billed_cd_ids

    async def _ensure_not_billed(self, luot_kham: LuotKham, db: AsyncSession):
        pending_bill, has_cong_kham, billed_cd_ids = await self._inspect_billing_state(luot_kham.id, db)
        if pending_bill:
            raise ConflictException(f"Lượt khám này đã có hóa đơn chờ thu mã {pending_bill.ma_hoa_don}!")
        unbilled_cd = [
            cd for cd in (luot_kham.danh_sach_chi_dinh or [])
            if cd.trang_thai != "da_huy" and cd.id not in billed_cd_ids
        ]
        if has_cong_kham and not unbilled_cd:
            raise ConflictException("Lượt khám này đã được lập hóa đơn và thanh toán viện phí hoàn tất!")
        return has_cong_kham, billed_cd_ids, unbilled_cd

    async def preview_invoice_for_encounter(
        self,
        luot_kham_id: int,
        db: AsyncSession,
    ) -> InvoicePreviewResponse:
        luot_kham = await self._load_encounter_for_billing(luot_kham_id, db, lock=False)
        has_cong_kham, billed_cd_ids, unbilled_cd = await self._ensure_not_billed(luot_kham, db)

        estimate = await estimate_encounter(
            luot_kham,
            db,
            excluded_chidinh_ids=billed_cd_ids,
            include_cong_kham=(not has_cong_kham),
        )

        return InvoicePreviewResponse(
            luot_kham_id=luot_kham.id,
            ma_kcb=luot_kham.ma_kcb or f"KCB-{luot_kham.id:06d}",
            benh_nhan=patient_brief(luot_kham),
            bac_si_kham=doctor_name(luot_kham),
            ngay_kham=luot_kham.thoi_gian_bat_dau.strftime("%d/%m/%Y") if luot_kham.thoi_gian_bat_dau else None,
            cac_khoan_thu=[
                InvoicePreviewLine(
                    loai_muc=line.loai_muc,
                    muc_tham_chieu_id=line.muc_tham_chieu_id,
                    ten_khoan_thu=line.ten_khoan_thu,
                    so_luong=line.so_luong,
                    don_gia=line.don_gia,
                    thanh_tien=line.thanh_tien,
                    ghi_chu=line.ghi_chu,
                )
                for line in estimate.lines
            ],
            tong_tien=estimate.tong_tien,
            mien_giam=ZERO,
            thuc_thu_du_kien=estimate.tong_tien,
        )

    async def create_invoice_for_encounter(
        self,
        payload: InvoiceCreateRequest,
        thu_ngan_user_id: int,
        db: AsyncSession,
    ) -> HoaDon:
        luot_kham = await self._load_encounter_for_billing(payload.luot_kham_id, db, lock=True)
        try:
            has_cong_kham, billed_cd_ids, unbilled_cd = await self._ensure_not_billed(luot_kham, db)
            should_include_cong_kham = (
                (not has_cong_kham)
                if payload.include_cong_kham is None
                else (payload.include_cong_kham and not has_cong_kham)
            )
            included_cd_ids = set(payload.chi_dinh_ids) if payload.chi_dinh_ids is not None else None
            estimate = await estimate_encounter(
                luot_kham,
                db,
                excluded_chidinh_ids=billed_cd_ids,
                included_chidinh_ids=included_cd_ids,
                include_cong_kham=should_include_cong_kham,
            )
            if not estimate.lines:
                raise UnprocessableEntityException("Không có khoản thu hợp lệ nào được chọn để lập hóa đơn!")
        except Exception:
            await db.rollback()
            raise

        tong_tien = estimate.tong_tien
        mien_giam = Decimal(str(payload.mien_giam or 0))
        thuc_thu = max(ZERO, tong_tien - mien_giam)

        now = datetime.now(timezone.utc)
        ma_hd = f"HD-{now.strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        hoa_don = HoaDon(
            ma_hoa_don=ma_hd,
            luot_kham_id=luot_kham.id,
            benh_nhan_id=luot_kham.benh_nhan_id,
            thu_ngan_id=thu_ngan_user_id,
            tong_tien=tong_tien,
            mien_giam=mien_giam,
            thuc_thu=thuc_thu,
            phuong_thuc_thanh_toan="tien_mat",
            trang_thai="chua_thu",
            ghi_chu=payload.ghi_chu,
        )
        try:
            db.add(hoa_don)
            await db.flush()
            for line in estimate.lines:
                db.add(
                    ChiTietHoaDon(
                        hoa_don_id=hoa_don.id,
                        loai_muc=line.loai_muc,
                        muc_tham_chieu_id=line.muc_tham_chieu_id,
                        chi_dinh_id=line.muc_tham_chieu_id if line.loai_muc == "can_lam_sang" else None,
                        ten_khoan_thu=line.ten_khoan_thu,
                        so_luong=line.so_luong,
                        don_gia=line.don_gia,
                        thanh_tien=line.thanh_tien,
                        ghi_chu=line.ghi_chu,
                    )
                )
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise ConflictException(THONG_BAO_DA_CO_HOA_DON) from exc

        return await self.get_invoice_detail(hoa_don.id, db)

    async def ensure_invoice_for_completed_encounter(
        self,
        luot_kham_id: int,
        nguoi_lap_id: Optional[int],
        db: AsyncSession,
    ) -> Optional[HoaDon]:
        try:
            async with db.begin_nested():
                luot_kham = await self._load_encounter_for_billing(luot_kham_id, db, lock=False)
                pending_bill, has_cong_kham, billed_cd_ids = await self._inspect_billing_state(luot_kham.id, db)
                estimate = await estimate_encounter(
                    luot_kham,
                    db,
                    excluded_chidinh_ids=billed_cd_ids,
                    include_cong_kham=(not has_cong_kham),
                )
                if not estimate.lines:
                    return pending_bill

                if pending_bill is not None:
                    for line in estimate.lines:
                        db.add(
                            ChiTietHoaDon(
                                hoa_don_id=pending_bill.id,
                                loai_muc=line.loai_muc,
                                muc_tham_chieu_id=line.muc_tham_chieu_id,
                                chi_dinh_id=line.muc_tham_chieu_id if line.loai_muc == "can_lam_sang" else None,
                                ten_khoan_thu=line.ten_khoan_thu,
                                so_luong=line.so_luong,
                                don_gia=line.don_gia,
                                thanh_tien=line.thanh_tien,
                                ghi_chu=line.ghi_chu,
                            )
                        )
                    new_total = Decimal(str(pending_bill.tong_tien or ZERO)) + estimate.tong_tien
                    current_discount = Decimal(str(pending_bill.mien_giam or ZERO))
                    net_due = max(ZERO, new_total - current_discount)
                    pending_bill.tong_tien = new_total
                    pending_bill.so_tien_phai_thu = net_due
                    pending_bill.thuc_thu = net_due
                    await db.flush()
                    return pending_bill

                now = datetime.now(timezone.utc)
                ma_hd = f"HD-{now.strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                hoa_don = HoaDon(
                    ma_hoa_don=ma_hd,
                    luot_kham_id=luot_kham.id,
                    benh_nhan_id=luot_kham.benh_nhan_id,
                    nguoi_lap_id=nguoi_lap_id,
                    thu_ngan_id=None,
                    tong_tien=estimate.tong_tien,
                    mien_giam=ZERO,
                    so_tien_phai_thu=estimate.tong_tien,
                    thuc_thu=estimate.tong_tien,
                    phuong_thuc_thanh_toan="tien_mat",
                    trang_thai="chua_thu",
                    ghi_chu="Tự động khởi tạo khi hoàn tất lượt khám",
                )
                db.add(hoa_don)
                await db.flush()
                for line in estimate.lines:
                    db.add(
                        ChiTietHoaDon(
                            hoa_don_id=hoa_don.id,
                            loai_muc=line.loai_muc,
                            muc_tham_chieu_id=line.muc_tham_chieu_id,
                            chi_dinh_id=line.muc_tham_chieu_id if line.loai_muc == "can_lam_sang" else None,
                            ten_khoan_thu=line.ten_khoan_thu,
                            so_luong=line.so_luong,
                            don_gia=line.don_gia,
                            thanh_tien=line.thanh_tien,
                            ghi_chu=line.ghi_chu,
                        )
                    )
                await db.flush()
                return hoa_don
        except Exception as exc:
            logger.warning(f"[AUTO_INVOICE_SKIPPED] encounter_id={luot_kham_id} reason={exc}")
            return None

    async def pay_invoice(
        self,
        invoice_id: int | str,
        payload: InvoicePayRequest,
        thu_ngan_user_id: int,
        db: AsyncSession,
    ) -> HoaDon:
        ref_str = str(invoice_id).strip()
        is_numeric_id = ref_str.isdigit()
        invoice = await self._find_invoice_by_ref(invoice_id, db, lock=True)
        if not invoice:
            raise NotFoundException(f"Không tìm thấy hóa đơn ID {invoice_id}!")

        if invoice.trang_thai == "da_thu":
            if is_numeric_id:
                raise ConflictException(f"Hóa đơn {invoice.ma_hoa_don} đã được thanh toán trước đó!")
            return await self.get_invoice_detail(invoice.id, db)

        if invoice.trang_thai == "da_huy":
            raise ConflictException(f"Không thể thanh toán hóa đơn {invoice.ma_hoa_don} đã bị hủy!")

        if (invoice.thuc_thu is None or invoice.thuc_thu <= ZERO) and invoice.so_tien_phai_thu and invoice.so_tien_phai_thu > ZERO:
            invoice.thuc_thu = invoice.so_tien_phai_thu

        so_tien_tra = Decimal(str(payload.so_tien_khach_tra))
        if so_tien_tra < invoice.thuc_thu:
            raise UnprocessableEntityException(
                f"Số tiền thanh toán ({so_tien_tra}) không đủ số tiền thực thu ({invoice.thuc_thu})!"
            )

        raw_method = (payload.phuong_thuc_thanh_toan or "tien_mat").strip().lower()
        normalized_method = "chuyen_khoan" if raw_method in ("vietqr", "chuyen_khoan", "qr") else raw_method

        now = datetime.now(timezone.utc)
        invoice.trang_thai = "da_thu"
        invoice.phuong_thuc_thanh_toan = normalized_method
        invoice.ngay_thanh_toan = now
        invoice.thu_ngan_id = thu_ngan_user_id
        invoice.so_hoa_don_in = f"BL-{now.strftime('%Y')}-{invoice.id:06d}"
        if payload.ghi_chu:
            invoice.ghi_chu = f"{invoice.ghi_chu or ''} | {payload.ghi_chu}".strip(" | ")

        ma_phieu = f"PT-{now.strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        phieu_thu = PhieuThuChi(
            ma_phieu=ma_phieu,
            loai_phieu="THU",
            hoa_don_id=invoice.id,
            nguoi_giao_dich=f"Bệnh nhân ID {invoice.benh_nhan_id}",
            so_tien=invoice.thuc_thu,
            phuong_thuc=normalized_method,
            ly_do=f"Thu tiền viện phí hóa đơn {invoice.ma_hoa_don}",
            nhan_vien_id=thu_ngan_user_id,
            thoi_gian=now,
            trang_thai_khoa_so=False,
        )
        db.add(phieu_thu)

        ma_gd = f"GD-{now.strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        giao_dich = GiaoDichThanhToan(
            ma_giao_dich=ma_gd,
            hoa_don_id=invoice.id,
            loai_giao_dich="THU_VIEN_PHI",
            so_tien=invoice.thuc_thu,
            phuong_thuc=normalized_method,
            nguon_tao_giao_dich="TAI_QUAY",
            nguoi_thu_id=thu_ngan_user_id,
            thoi_gian_giao_dich=now,
            thoi_gian_xac_nhan=now,
            trang_thai="THANH_CONG",
            ghi_chu=payload.ghi_chu,
        )
        db.add(giao_dich)

        stmt_cd = (
            select(ChiDinh)
            .join(ChiTietHoaDon, ChiTietHoaDon.muc_tham_chieu_id == ChiDinh.id)
            .where(
                ChiTietHoaDon.hoa_don_id == invoice.id,
                ChiTietHoaDon.loai_muc == "can_lam_sang",
                ChiDinh.trang_thai.in_(["da_chi_dinh", "CHO_THUC_HIEN"]),
            )
        )
        if invoice.luot_kham_id is not None:
            stmt_cd = stmt_cd.where(ChiDinh.luot_kham_id == invoice.luot_kham_id)
        for cd in (await db.execute(stmt_cd)).scalars().all():
            cd.trang_thai = "da_thanh_toan"

        await db.commit()
        return await self.get_invoice_detail(invoice.id, db)

    async def cancel_invoice(
        self,
        invoice_id: int,
        ly_do: str,
        thu_ngan_user_id: int,
        db: AsyncSession,
    ) -> HoaDon:
        stmt = select(HoaDon).where(HoaDon.id == invoice_id).with_for_update()
        invoice = (await db.execute(stmt)).scalar_one_or_none()
        if not invoice:
            raise NotFoundException(f"Không tìm thấy hóa đơn ID {invoice_id}!")

        if invoice.trang_thai == "da_huy":
            raise ConflictException(f"Hóa đơn {invoice.ma_hoa_don} đã ở trạng thái hủy!")

        if invoice.trang_thai == "da_thu":
            raise ConflictException("Hóa đơn đã thu tiền không thể hủy trực tiếp, vui lòng liên hệ quản trị phòng khám!")

        invoice.trang_thai = "da_huy"
        invoice.ghi_chu = f"{invoice.ghi_chu or ''} | HỦY: {ly_do}".strip(" | ")
        await db.commit()
        return await self.get_invoice_detail(invoice.id, db)

    async def list_invoices(
        self,
        trang_thai: Optional[str] = None,
        ma_kcb: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        db: AsyncSession = None,
    ) -> PendingBillsListResponse:
        return await cashier_list_invoices(
            trang_thai=trang_thai,
            ma_kcb=ma_kcb,
            page=page,
            page_size=page_size,
            db=db,
        )

    async def get_pending_bills(
        self,
        ma_kcb: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        db: AsyncSession = None,
    ) -> PendingBillsListResponse:
        return await cashier_get_pending_bills(ma_kcb=ma_kcb, page=page, page_size=page_size, db=db)

    async def get_shift_summary(
        self,
        thu_ngan_user_id: int,
        db: AsyncSession,
    ) -> ShiftSummaryResponse:
        return await cashier_shift_get_summary(thu_ngan_user_id, db)

    async def close_shift(
        self,
        thu_ngan_user_id: int,
        ghi_chu: Optional[str] = None,
        tien_mat_thuc_te: Optional[Decimal] = None,
        db: AsyncSession = None,
    ) -> CloseShiftResponse:
        return await cashier_shift_close_shift(
            thu_ngan_user_id=thu_ngan_user_id,
            ghi_chu=ghi_chu,
            tien_mat_thuc_te=tien_mat_thuc_te,
            db=db,
        )

    async def refund_invoice(
        self,
        payload: RefundInvoiceRequest,
        thu_ngan_user_id: int,
        db: AsyncSession,
    ) -> RefundInvoiceResponse:
        return await cashier_shift_refund(payload, thu_ngan_user_id, db)

    async def get_unbilled_encounters(
        self,
        page: int = 1,
        page_size: int = 50,
        db: AsyncSession = None,
    ) -> UnbilledEncountersListResponse:
        pending_exists = (
            select(HoaDon.id)
            .where(HoaDon.luot_kham_id == LuotKham.id, HoaDon.trang_thai == "chua_thu")
            .exists()
        )
        billed_cd_exists = (
            select(ChiTietHoaDon.id)
            .join(HoaDon, ChiTietHoaDon.hoa_don_id == HoaDon.id)
            .where(
                ChiTietHoaDon.muc_tham_chieu_id == ChiDinh.id,
                ChiTietHoaDon.loai_muc == "can_lam_sang",
                HoaDon.trang_thai.in_(["chua_thu", "da_thu"]),
            )
            .exists()
        )
        unbilled_cd_exists = (
            select(ChiDinh.id)
            .where(
                ChiDinh.luot_kham_id == LuotKham.id,
                ChiDinh.trang_thai != "da_huy",
                ~billed_cd_exists,
            )
            .exists()
        )
        no_active_invoice = ~select(HoaDon.id).where(
            HoaDon.luot_kham_id == LuotKham.id,
            HoaDon.trang_thai.in_(["chua_thu", "da_thu"]),
        ).exists()

        is_unbilled = and_(
            ~pending_exists,
            or_(
                no_active_invoice,
                unbilled_cd_exists,
            ),
        )

        filters = [
            or_(
                LuotKham.lich_kham_id.is_(None),
                LichKham.trang_thai.not_in(["da_huy", "tu_dong_huy", "no_show"]),
            ),
            is_unbilled,
        ]
        total = (
            await db.execute(
                select(func.count(LuotKham.id))
                .select_from(LuotKham)
                .outerjoin(LuotKham.lich_kham)
                .where(*filters)
            )
        ).scalar_one()

        stmt = (
            select(LuotKham)
            .outerjoin(LuotKham.lich_kham)
            .options(
                selectinload(LuotKham.lich_kham).selectinload(LichKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LuotKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LuotKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(LuotKham.danh_sach_chi_dinh).selectinload(ChiDinh.dich_vu),
                selectinload(LuotKham.danh_sach_don_thuoc).selectinload(DonThuoc.danh_sach_chi_tiet),
            )
            .where(*filters)
            .order_by(LuotKham.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        encounters = (await db.execute(stmt)).scalars().all()

        resolver = ExamServiceResolver()
        items: List[UnbilledEncounterItem] = []
        for lk in encounters:
            pending_bill, has_cong_kham, billed_cd_ids = await self._inspect_billing_state(lk.id, db)
            unbilled_cds = [
                cd for cd in (lk.danh_sach_chi_dinh or [])
                if cd.trang_thai != "da_huy" and cd.id not in billed_cd_ids
            ]
            so_cd = len(unbilled_cds)
            active_rx = [rx for rx in (lk.danh_sach_don_thuoc or []) if rx.trang_thai != "SUPERSEDED"]
            so_thuoc = sum(len(rx.danh_sach_chi_tiet or []) for rx in active_rx)

            canh_bao_gia = None
            try:
                estimate = await estimate_encounter(
                    lk,
                    db,
                    resolver,
                    excluded_chidinh_ids=billed_cd_ids,
                    include_cong_kham=(not has_cong_kham),
                )
                tam_tinh = estimate.tong_tien
            except UnprocessableEntityException as exc:
                tam_tinh = sum_cls_fee(lk.danh_sach_chi_dinh, excluded_ids=billed_cd_ids)
                canh_bao_gia = exc.message

            items.append(
                UnbilledEncounterItem(
                    luot_kham_id=lk.id,
                    ma_kcb=lk.ma_kcb or f"KCB-{lk.id:06d}",
                    benh_nhan=patient_brief(lk),
                    bac_si_kham=doctor_name(lk),
                    ngay_kham=lk.thoi_gian_bat_dau.strftime("%d/%m/%Y") if lk.thoi_gian_bat_dau else None,
                    so_chi_dinh=so_cd,
                    so_thuoc=so_thuoc,
                    tam_tinh=tam_tinh,
                    thoi_gian_bat_dau=lk.thoi_gian_bat_dau,
                    is_locked=lk.is_locked,
                    canh_bao_gia=canh_bao_gia,
                )
            )

        return UnbilledEncountersListResponse(items=items, total=total)

    async def process_sepay_webhook(
        self,
        payload: SepayWebhookPayload,
        authorization_header: Optional[str],
        db: AsyncSession,
    ) -> SepayWebhookResponse:
        return await cashier_webhook_process(
            payload=payload,
            authorization_header=authorization_header,
            db=db,
            find_invoice_by_ref_fn=self._find_invoice_by_ref,
            pay_invoice_fn=self.pay_invoice,
        )

cashier_service = CashierService()
