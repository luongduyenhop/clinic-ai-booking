import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import func, or_, select
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
    UnprocessableEntityException,
)
from app.models.appointment import LichKham
from app.models.medical import ChiDinh, ChiTietHoaDon, DonThuoc, GiaoDichThanhToan, HoaDon, LuotKham, PhieuThuChi
from app.models.user import BacSi, BenhNhan, NguoiDung
from app.schemas.cashier import (
    CloseShiftResponse,
    InvoiceCreateRequest,
    InvoiceLineItemResponse,
    InvoicePayRequest,
    InvoicePreviewLine,
    InvoicePreviewResponse,
    PatientBrief,
    PendingBillItem,
    PendingBillsListResponse,
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

logger = logging.getLogger(__name__)

THONG_BAO_DANG_XU_LY = "Lượt khám đang được thu ngân khác xử lý. Vui lòng tải lại dữ liệu."
THONG_BAO_DA_CO_HOA_DON = "Lượt khám này đã có hóa đơn hiệu lực. Vui lòng tải lại dữ liệu."


def _is_lock_not_available(exc: DBAPIError) -> bool:
    orig = getattr(exc, "orig", None)
    candidates = (orig, getattr(orig, "__cause__", None))
    return any(
        getattr(candidate, "sqlstate", None) == "55P03" or getattr(candidate, "pgcode", None) == "55P03"
        for candidate in candidates
        if candidate is not None
    )


def _patient_brief(luot_kham: LuotKham) -> PatientBrief:
    benh_nhan = luot_kham.benh_nhan
    nguoi_dung = benh_nhan.nguoi_dung if benh_nhan else None
    return PatientBrief(
        mabn=benh_nhan.ma_dinh_danh_y_te if benh_nhan else None,
        ho_ten=nguoi_dung.ho_ten if nguoi_dung else "Chưa rõ",
        so_dien_thoai=nguoi_dung.so_dien_thoai if nguoi_dung else None,
    )


def _doctor_name(luot_kham: LuotKham) -> Optional[str]:
    lich_kham = luot_kham.lich_kham
    if lich_kham and lich_kham.bac_si and lich_kham.bac_si.nguoi_dung:
        return lich_kham.bac_si.nguoi_dung.ho_ten
    return None


class CashierService:

    async def get_invoice_detail(self, invoice_id: int, db: AsyncSession) -> HoaDon:
        stmt = (
            select(HoaDon)
            .options(
                selectinload(HoaDon.chi_tiet_hoa_don),
                selectinload(HoaDon.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HoaDon.luot_kham),
            )
            .where(HoaDon.id == invoice_id)
        )
        invoice = (await db.execute(stmt)).scalar_one_or_none()
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
            if _is_lock_not_available(exc):
                raise ConflictException(THONG_BAO_DANG_XU_LY) from exc
            raise
        if not luot_kham:
            raise NotFoundException(f"Không tìm thấy thông tin lượt khám ID {luot_kham_id}!")
        return luot_kham

    async def _ensure_not_billed(self, luot_kham_id: int, db: AsyncSession) -> None:
        stmt_exist = select(HoaDon).where(
            HoaDon.luot_kham_id == luot_kham_id,
            HoaDon.trang_thai.in_(["chua_thu", "da_thu"]),
        )
        existing_bill = (await db.execute(stmt_exist)).scalars().first()
        if existing_bill:
            if existing_bill.trang_thai == "da_thu":
                raise ConflictException("Lượt khám này đã được lập hóa đơn và thanh toán viện phí hoàn tất!")
            raise ConflictException(f"Lượt khám này đã có hóa đơn chờ thu mã {existing_bill.ma_hoa_don}!")

    async def preview_invoice_for_encounter(
        self,
        luot_kham_id: int,
        db: AsyncSession,
    ) -> InvoicePreviewResponse:
        luot_kham = await self._load_encounter_for_billing(luot_kham_id, db, lock=False)
        await self._ensure_not_billed(luot_kham.id, db)
        estimate = await estimate_encounter(luot_kham, db)
        return InvoicePreviewResponse(
            luot_kham_id=luot_kham.id,
            ma_kcb=luot_kham.ma_kcb or f"KCB-{luot_kham.id:06d}",
            benh_nhan=_patient_brief(luot_kham),
            bac_si_kham=_doctor_name(luot_kham),
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
            await self._ensure_not_billed(luot_kham.id, db)
            estimate = await estimate_encounter(luot_kham, db)
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

    async def pay_invoice(
        self,
        invoice_id: int,
        payload: InvoicePayRequest,
        thu_ngan_user_id: int,
        db: AsyncSession,
    ) -> HoaDon:
        stmt = (
            select(HoaDon)
            .where(HoaDon.id == invoice_id)
            .with_for_update()
        )
        invoice = (await db.execute(stmt)).scalar_one_or_none()
        if not invoice:
            raise NotFoundException(f"Không tìm thấy hóa đơn ID {invoice_id}!")

        if invoice.trang_thai == "da_thu":
            raise ConflictException(f"Hóa đơn {invoice.ma_hoa_don} đã được thanh toán trước đó!")

        if invoice.trang_thai == "da_huy":
            raise ConflictException(f"Không thể thanh toán hóa đơn {invoice.ma_hoa_don} đã bị hủy!")

        so_tien_tra = Decimal(str(payload.so_tien_khach_tra))
        if so_tien_tra < invoice.thuc_thu:
            raise UnprocessableEntityException(
                f"Số tiền thanh toán ({so_tien_tra}) không đủ số tiền thực thu ({invoice.thuc_thu})!"
            )

        now = datetime.now(timezone.utc)
        invoice.trang_thai = "da_thu"
        invoice.phuong_thuc_thanh_toan = payload.phuong_thuc_thanh_toan
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
            phuong_thuc=payload.phuong_thuc_thanh_toan,
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
            phuong_thuc=payload.phuong_thuc_thanh_toan,
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
                ChiDinh.trang_thai == "da_chi_dinh",
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

    async def get_pending_bills(
        self,
        ma_kcb: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        db: AsyncSession = None,
    ) -> PendingBillsListResponse:
        stmt = (
            select(HoaDon)
            .options(
                selectinload(HoaDon.chi_tiet_hoa_don),
                selectinload(HoaDon.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HoaDon.luot_kham),
            )
            .where(HoaDon.trang_thai == "chua_thu")
            .order_by(HoaDon.id.desc())
        )
        total = (
            await db.execute(select(func.count(HoaDon.id)).where(HoaDon.trang_thai == "chua_thu"))
        ).scalar_one()
        page_invoices = (
            await db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
        ).scalars().all()

        items: List[PendingBillItem] = []
        for inv in page_invoices:
            ho_ten = "Chưa rõ"
            sdt = None
            mabn = None
            if inv.benh_nhan:
                mabn = inv.benh_nhan.ma_dinh_danh_y_te
                if inv.benh_nhan.nguoi_dung:
                    ho_ten = inv.benh_nhan.nguoi_dung.ho_ten
                    sdt = inv.benh_nhan.nguoi_dung.so_dien_thoai

            line_dtos = [
                InvoiceLineItemResponse(
                    id=line.id,
                    hoa_don_id=line.hoa_don_id,
                    loai_muc=line.loai_muc,
                    muc_tham_chieu_id=line.muc_tham_chieu_id,
                    ten_khoan_thu=line.ten_khoan_thu,
                    so_luong=line.so_luong,
                    don_gia=line.don_gia,
                    thanh_tien=line.thanh_tien,
                    ghi_chu=line.ghi_chu,
                )
                for line in (inv.chi_tiet_hoa_don or [])
            ]

            items.append(
                PendingBillItem(
                    id=inv.id,
                    ma_hoa_don=inv.ma_hoa_don,
                    luot_kham_id=inv.luot_kham_id,
                    benh_nhan=PatientBrief(mabn=mabn, ho_ten=ho_ten, so_dien_thoai=sdt),
                    tong_tien=inv.tong_tien,
                    mien_giam=inv.mien_giam,
                    thuc_thu=inv.thuc_thu,
                    trang_thai=inv.trang_thai,
                    created_at=inv.created_at,
                    cac_khoan_thu=line_dtos,
                )
            )

        return PendingBillsListResponse(items=items, total=total)

    async def get_shift_summary(
        self,
        thu_ngan_user_id: int,
        db: AsyncSession,
    ) -> ShiftSummaryResponse:
        stmt_user = select(NguoiDung).where(NguoiDung.id == thu_ngan_user_id)
        user = (await db.execute(stmt_user)).scalar_one_or_none()
        ten_thu_ngan = user.ho_ten if user else f"User {thu_ngan_user_id}"

        stmt_slips = select(PhieuThuChi).where(
            PhieuThuChi.nhan_vien_id == thu_ngan_user_id,
            PhieuThuChi.trang_thai_khoa_so.is_(False),
        )
        slips = (await db.execute(stmt_slips)).scalars().all()

        tong_tien_mat = Decimal("0.00")
        tong_chuyen_khoan = Decimal("0.00")
        tong_the_pos = Decimal("0.00")
        so_phieu_thu = 0

        for s in slips:
            amount = s.so_tien or Decimal("0.00")
            if s.loai_phieu == "THU":
                so_phieu_thu += 1
                if s.phuong_thuc == "tien_mat":
                    tong_tien_mat += amount
                elif s.phuong_thuc == "chuyen_khoan":
                    tong_chuyen_khoan += amount
                elif s.phuong_thuc == "the_pos":
                    tong_the_pos += amount

        tong_doanh_thu = tong_tien_mat + tong_chuyen_khoan + tong_the_pos

        return ShiftSummaryResponse(
            thu_ngan_id=thu_ngan_user_id,
            ten_thu_ngan=ten_thu_ngan,
            tong_hoa_don=so_phieu_thu,
            tong_tien_mat=tong_tien_mat,
            tong_chuyen_khoan=tong_chuyen_khoan,
            tong_the_pos=tong_the_pos,
            tong_doanh_thu=tong_doanh_thu,
            so_phieu_thu=so_phieu_thu,
            so_phieu_chi=0,
        )

    async def close_shift(
        self,
        thu_ngan_user_id: int,
        ghi_chu: Optional[str],
        db: AsyncSession,
    ) -> CloseShiftResponse:
        summary = await self.get_shift_summary(thu_ngan_user_id, db)

        stmt_update = (
            select(PhieuThuChi)
            .where(
                PhieuThuChi.nhan_vien_id == thu_ngan_user_id,
                PhieuThuChi.trang_thai_khoa_so.is_(False),
            )
            .with_for_update()
        )
        slips = (await db.execute(stmt_update)).scalars().all()
        now = datetime.now(timezone.utc)
        for s in slips:
            s.trang_thai_khoa_so = True

        await db.commit()
        return CloseShiftResponse(
            ok=True,
            thoi_gian_dong_so=now,
            tong_ket=summary,
        )


    async def get_unbilled_encounters(
        self,
        page: int = 1,
        page_size: int = 50,
        db: AsyncSession = None,
    ) -> UnbilledEncountersListResponse:
        billed_exists = (
            select(HoaDon.id)
            .where(HoaDon.luot_kham_id == LuotKham.id, HoaDon.trang_thai != "da_huy")
            .exists()
        )
        filters = [
            or_(
                LuotKham.lich_kham_id.is_(None),
                LichKham.trang_thai.not_in(["da_huy", "tu_dong_huy", "no_show"]),
            ),
            ~billed_exists,
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
            so_cd = len([cd for cd in (lk.danh_sach_chi_dinh or []) if cd.trang_thai != "da_huy"])
            active_rx = [rx for rx in (lk.danh_sach_don_thuoc or []) if rx.trang_thai != "SUPERSEDED"]
            so_thuoc = sum(len(rx.danh_sach_chi_tiet or []) for rx in active_rx)

            canh_bao_gia = None
            try:
                tam_tinh = (await estimate_encounter(lk, db, resolver)).tong_tien
            except UnprocessableEntityException as exc:
                tam_tinh = sum_cls_fee(lk.danh_sach_chi_dinh)
                canh_bao_gia = exc.message

            items.append(
                UnbilledEncounterItem(
                    luot_kham_id=lk.id,
                    ma_kcb=lk.ma_kcb or f"KCB-{lk.id:06d}",
                    benh_nhan=_patient_brief(lk),
                    bac_si_kham=_doctor_name(lk),
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


cashier_service = CashierService()
