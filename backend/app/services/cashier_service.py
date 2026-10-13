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
from app.models.medical import ChiDinh, ChiTietHoaDon, DichVu, DonThuoc, HoaDon, LuotKham, PhieuThuChi
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
)

logger = logging.getLogger(__name__)


class CashierService:
    """Nghiệp vụ Phân hệ Thu ngân & Quản lý Viện phí Ngoại trú (Billing & Cashier System)"""

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
        """Tạo hóa đơn viện phí từ lượt khám (tự động tổng hợp tiền khám, cận lâm sàng, thuốc)"""
        # Kiểm tra lượt khám
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

        # Kiểm tra xem đã có hóa đơn chưa thanh toán cho lượt khám này chưa
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
            # Tự động trích xuất từ lượt khám
            # 1. Công khám
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

            # 2. Cận lâm sàng
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

            # 3. Thuốc từ đơn thuốc hợp lệ (không SUPERSEDED)
            active_prescriptions = [dt for dt in (luot_kham.danh_sach_don_thuoc or []) if dt.trang_thai != "SUPERSEDED"]
            for dt in active_prescriptions:
                for ct in (dt.danh_sach_chi_tiet or []):
                    # Giả định đơn giá thuốc chuẩn 5,000 VND / đơn vị tính nếu chưa có bảng giá thuốc
                    don_gia_thuoc = Decimal("5000.00")
                    line_items_data.append({
                        "loai_muc": "thuoc",
                        "muc_tham_chieu_id": ct.id,
                        "ten_khoan_thu": f"{ct.ten_thuoc} ({ct.ham_luong or ''})",
                        "so_luong": ct.so_luong or 1,
                        "don_gia": don_gia_thuoc,
                        "thanh_tien": Decimal(ct.so_luong or 1) * don_gia_thuoc,
                        "ghi_chu": ct.cach_dung,
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
        """Thanh toán viện phí và xuất biên lai thu tiền"""
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

        # Tự động tạo phiếu thu tài chính
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

        # Cập nhật trạng thái chỉ định CLS thuộc hóa đơn sang da_thanh_toan
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
        """Hủy hóa đơn viện phí chưa thu hoặc sai lệch"""
        stmt = select(HoaDon).where(HoaDon.id == invoice_id).with_for_update()
        invoice = (await db.execute(stmt)).scalar_one_or_none()
        if not invoice:
            raise NotFoundException(f"Không tìm thấy hóa đơn ID {invoice_id}!")

        if invoice.trang_thai == "da_huy":
            raise ConflictException(f"Hóa đơn {invoice.ma_hoa_don} đã ở trạng thái hủy!")

        if invoice.trang_thai == "da_thu":
            raise ConflictException("Hóa đơn đã thu tiền không thể hủy trực tiếp, vui lòng lập phiếu chi hoàn tiền!")

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
        """Lấy danh sách các hóa đơn chờ thu viện phí"""
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
        """Báo cáo tổng kết ca trực thu ngân theo các hình thức thu"""
        stmt_user = select(NguoiDung).where(NguoiDung.id == thu_ngan_user_id)
        user = (await db.execute(stmt_user)).scalar_one_or_none()
        ten_thu_ngan = user.ho_ten if user else f"User {thu_ngan_user_id}"

        # Lấy các phiếu thu chưa khóa sổ của thu ngân này
        stmt_slips = select(PhieuThuChi).where(
            PhieuThuChi.nhan_vien_id == thu_ngan_user_id,
            PhieuThuChi.trang_thai_khoa_so == False,
        )
        slips = (await db.execute(stmt_slips)).scalars().all()

        tong_tien_mat = Decimal("0.00")
        tong_chuyen_khoan = Decimal("0.00")
        tong_the_pos = Decimal("0.00")
        so_phieu_thu = 0
        so_phieu_chi = 0

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
            elif s.loai_phieu == "CHI":
                so_phieu_chi += 1
                if s.phuong_thuc == "tien_mat":
                    tong_tien_mat -= amount

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
            so_phieu_chi=so_phieu_chi,
        )

    async def close_shift(
        self,
        thu_ngan_user_id: int,
        ghi_chu: Optional[str],
        db: AsyncSession,
    ) -> CloseShiftResponse:
        """Khóa sổ ca trực thu ngân, chốt toàn bộ phiếu thu chi trong ca"""
        summary = await self.get_shift_summary(thu_ngan_user_id, db)

        stmt_update = (
            select(PhieuThuChi)
            .where(
                PhieuThuChi.nhan_vien_id == thu_ngan_user_id,
                PhieuThuChi.trang_thai_khoa_so == False,
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


cashier_service = CashierService()
