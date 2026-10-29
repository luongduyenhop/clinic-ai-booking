import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
    UnprocessableEntityException,
)
from app.models.appointment import LichKham
from app.models.medical import ChiDinh, ChiTietHoaDon, DichVu, DonThuoc, GiaoDichThanhToan, HoaDon, KhoaSoCaTruc, LuotKham, PhieuThuChi
from app.models.user import BacSi, BenhNhan, NguoiDung
from app.schemas.cashier import (
    CloseShiftResponse,
    InvoiceCreateRequest,
    InvoiceLineItemCreate,
    InvoiceLineItemResponse,
    InvoicePayRequest,
    InvoiceResponse,
    PatientBrief,
    PendingBillItem,
    PendingBillsListResponse,
    ShiftSummaryResponse,
    RefundInvoiceRequest,
    RefundInvoiceResponse,
)

logger = logging.getLogger(__name__)


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

    async def create_invoice_for_encounter(
        self,
        payload: InvoiceCreateRequest,
        thu_ngan_user_id: int,
        db: AsyncSession,
    ) -> HoaDon:
        stmt_lk = (
            select(LuotKham)
            .options(
                selectinload(LuotKham.lich_kham).selectinload(LichKham.bac_si),
                selectinload(LuotKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(LuotKham.danh_sach_chi_dinh).selectinload(ChiDinh.dich_vu),
                selectinload(LuotKham.danh_sach_don_thuoc).selectinload(DonThuoc.danh_sach_chi_tiet),
            )
            .where(LuotKham.id == payload.luot_kham_id)
        )
        luot_kham = (await db.execute(stmt_lk)).scalar_one_or_none()
        if not luot_kham:
            raise NotFoundException(f"Không tìm thấy thông tin lượt khám ID {payload.luot_kham_id}!")

        stmt_exist = select(HoaDon).where(
            HoaDon.luot_kham_id == luot_kham.id,
            HoaDon.trang_thai == "chua_thu",
        )
        existing_bill = (await db.execute(stmt_exist)).scalar_one_or_none()
        if existing_bill:
            raise ConflictException(f"Lượt khám này đã có hóa đơn chờ thu mã {existing_bill.ma_hoa_don}!")

        line_items_data: List[dict] = []

        if payload.items and len(payload.items) > 0:
            for it in payload.items:
                line_items_data.append({
                    "loai_muc": it.loai_muc,
                    "muc_tham_chieu_id": it.muc_tham_chieu_id,
                    "ten_khoan_thu": it.ten_khoan_thu,
                    "so_luong": it.so_luong,
                    "don_gia": it.don_gia,
                    "thanh_tien": Decimal(it.so_luong) * it.don_gia,
                    "ghi_chu": it.ghi_chu,
                })
        else:
            gia_kham = Decimal("150000.00")
            if luot_kham.lich_kham and luot_kham.lich_kham.bac_si:
                gia_kham = Decimal(str(luot_kham.lich_kham.bac_si.gia_kham_mac_dinh or 150000.00))
            line_items_data.append({
                "loai_muc": "cong_kham",
                "muc_tham_chieu_id": luot_kham.lich_kham_id,
                "ten_khoan_thu": "Công khám chuyên khoa ngoại trú",
                "so_luong": 1,
                "don_gia": gia_kham,
                "thanh_tien": gia_kham,
                "ghi_chu": None,
            })

            for cd in (luot_kham.danh_sach_chi_dinh or []):
                if cd.trang_thai != "da_huy":
                    don_gia_cls = Decimal(str(cd.don_gia_tai_thoi_diem or 0.00))
                    ten_dv = cd.dich_vu.ten_dich_vu if cd.dich_vu else "Dịch vụ cận lâm sàng"
                    line_items_data.append({
                        "loai_muc": "can_lam_sang",
                        "muc_tham_chieu_id": cd.id,
                        "ten_khoan_thu": ten_dv,
                        "so_luong": cd.so_luong or 1,
                        "don_gia": don_gia_cls,
                        "thanh_tien": Decimal(cd.so_luong or 1) * don_gia_cls,
                        "ghi_chu": None,
                    })

        tong_tien = sum((item["thanh_tien"] for item in line_items_data), Decimal("0.00"))
        mien_giam = Decimal(str(payload.mien_giam or 0.00))
        thuc_thu = max(Decimal("0.00"), tong_tien - mien_giam)

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
        db.add(hoa_don)
        await db.flush()

        for item_data in line_items_data:
            item = ChiTietHoaDon(
                hoa_don_id=hoa_don.id,
                loai_muc=item_data["loai_muc"],
                muc_tham_chieu_id=item_data["muc_tham_chieu_id"],
                ten_khoan_thu=item_data["ten_khoan_thu"],
                so_luong=item_data["so_luong"],
                don_gia=item_data["don_gia"],
                thanh_tien=item_data["thanh_tien"],
                ghi_chu=item_data["ghi_chu"],
            )
            db.add(item)

        await db.commit()
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

        stmt_items = select(ChiTietHoaDon).where(
            ChiTietHoaDon.hoa_don_id == invoice.id,
            ChiTietHoaDon.loai_muc == "can_lam_sang",
        )
        cls_items = (await db.execute(stmt_items)).scalars().all()
        for ci in cls_items:
            if ci.muc_tham_chieu_id:
                stmt_cd = select(ChiDinh).where(ChiDinh.id == ci.muc_tham_chieu_id)
                cd = (await db.execute(stmt_cd)).scalar_one_or_none()
                if cd and cd.trang_thai == "da_chi_dinh":
                    pass

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
        all_invoices = (await db.execute(stmt)).scalars().all()

        items: List[PendingBillItem] = []
        for inv in all_invoices:
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

        total = len(items)
        start = (page - 1) * page_size
        paged_items = items[start : start + page_size]
        return PendingBillsListResponse(items=paged_items, total=total)

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
        ghi_chu: Optional[str] = None,
        tien_mat_thuc_te: Optional[Decimal] = None,
        db: AsyncSession = None,
    ) -> CloseShiftResponse:
        """Khóa sổ ca trực thu ngân, chốt toàn bộ phiếu thu chi trong ca và tạo bản ghi KhoaSoCaTruc"""
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

        actual_cash = tien_mat_thuc_te if tien_mat_thuc_te is not None else summary.tong_tien_mat
        diff_cash = actual_cash - summary.tong_tien_mat

        # Xác định ca làm việc theo giờ Việt Nam (UTC+7)
        hour_vn = (now.hour + 7) % 24
        ca = "SANG" if hour_vn < 13 else "CHIEU"
        ma_ks = f"KS-{now.strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        khoa_so = KhoaSoCaTruc(
            ma_khoa_so=ma_ks,
            ca_lam_viec=ca,
            ngay_khoa_so=now.date(),
            thu_ngan_giao_id=thu_ngan_user_id,
            tong_tien_mat_he_thong=summary.tong_tien_mat,
            tong_chuyen_khoan_he_thong=summary.tong_chuyen_khoan,
            tong_the_pos_he_thong=summary.tong_the_pos,
            tien_mat_thuc_te=actual_cash,
            chenh_lech_tien_mat=diff_cash,
            tong_so_phieu_thu=summary.so_phieu_thu,
            tong_so_phieu_chi=summary.so_phieu_chi,
            trang_thai="DA_KHOA_SO",
            ghi_chu=ghi_chu,
        )
        db.add(khoa_so)
        await db.commit()
        await db.refresh(khoa_so)

        return CloseShiftResponse(
            ok=True,
            ma_khoa_so=khoa_so.ma_khoa_so,
            thoi_gian_dong_so=now,
            tien_mat_thuc_te=actual_cash,
            chenh_lech_tien_mat=diff_cash,
            khoa_so_id=khoa_so.id,
            tong_ket=summary,
        )

    async def refund_invoice(
        self,
        payload: RefundInvoiceRequest,
        thu_ngan_user_id: int,
        db: AsyncSession,
    ) -> RefundInvoiceResponse:
        """Hoàn tiền viện phí và xuất phiếu chi trả lại bệnh nhân (FC-16)"""
        stmt = (
            select(HoaDon)
            .options(
                selectinload(HoaDon.benh_nhan).selectinload(BenhNhan.nguoi_dung),
            )
            .where(HoaDon.id == payload.invoice_id)
            .with_for_update()
        )
        invoice = (await db.execute(stmt)).scalar_one_or_none()
        if not invoice:
            raise NotFoundException(f"Không tìm thấy hóa đơn ID {payload.invoice_id}!")

        if invoice.trang_thai not in ("da_thu", "hoan_tien_mot_phan"):
            raise BadRequestException(f"Chỉ có thể hoàn tiền hóa đơn đã thu (Trạng thái hiện tại: {invoice.trang_thai})!")

        # Tính toán số tiền hoàn
        so_tien_hoan = payload.so_tien_hoan if payload.so_tien_hoan is not None else invoice.thuc_thu
        if so_tien_hoan <= 0:
            raise BadRequestException("Số tiền hoàn phải lớn hơn 0!")
        if so_tien_hoan > invoice.thuc_thu:
            raise BadRequestException(f"Số tiền hoàn ({so_tien_hoan:,.0f}đ) không được vượt quá số thực thu của hóa đơn ({invoice.thuc_thu:,.0f}đ)!")

        now = datetime.now(timezone.utc)
        ma_phieu = f"PC-{now.strftime('%y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
        ten_nguoi_nhan = (
            invoice.benh_nhan.nguoi_dung.ho_ten
            if invoice.benh_nhan and invoice.benh_nhan.nguoi_dung
            else "Bệnh nhân"
        )

        phieu_chi = PhieuThuChi(
            ma_phieu=ma_phieu,
            loai_phieu="CHI",
            hoa_don_id=invoice.id,
            nguoi_giao_dich=ten_nguoi_nhan,
            so_tien=so_tien_hoan,
            phuong_thuc=payload.phuong_thuc,
            ly_do=payload.ly_do,
            nhan_vien_id=thu_ngan_user_id,
            thoi_gian=now,
            trang_thai_khoa_so=False,
        )
        db.add(phieu_chi)

        # Cập nhật trạng thái hóa đơn
        if so_tien_hoan >= invoice.thuc_thu:
            invoice.trang_thai = "da_hoan_tien"
        else:
            invoice.trang_thai = "hoan_tien_mot_phan"

        ghi_chu_hoan = f" | [Hoàn tiền: {so_tien_hoan:,.0f}đ, Phiếu: {ma_phieu}, Lý do: {payload.ly_do}]"
        invoice.ghi_chu = (invoice.ghi_chu or "") + ghi_chu_hoan

        await db.commit()
        await db.refresh(phieu_chi)

        return RefundInvoiceResponse(
            ma_phieu_chi=phieu_chi.ma_phieu,
            phieu_chi_id=phieu_chi.id,
            hoa_don_id=invoice.id,
            ma_hoa_don=invoice.ma_hoa_don,
            so_tien_hoan=so_tien_hoan,
            trang_thai_hoa_don_moi=invoice.trang_thai,
            thoi_gian=now,
            nguoi_thuc_hien_id=thu_ngan_user_id,
            ly_do=payload.ly_do,
        )


cashier_service = CashierService()
