from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user,require_roles
from app.core.response import ResponseEnvelope
from app.core.exceptions import ForbiddenException
from app.models.user import TaiKhoan, VaiTroEnum
from app.schemas.cashier import (
    CloseShiftRequest,
    CloseShiftResponse,
    InvoiceCreateRequest,
    InvoiceLineItemResponse,
    InvoicePayRequest,
    InvoiceResponse,
    PendingBillsListResponse,
    ShiftSummaryResponse,
    RefundInvoiceRequest,
    RefundInvoiceResponse,
)
from app.services.cashier_service import cashier_service

router = APIRouter(prefix="/cashier", tags=["7. Thu Ngân & Quản Lý Viện Phí (Cashier & Billing)"])


@router.get(
    "/pending-bills",
    response_model=ResponseEnvelope[PendingBillsListResponse],
    summary="Lấy danh sách các hóa đơn chờ thu viện phí"
)
async def get_pending_bills(
    ma_kcb: Optional[str] = Query(None, description="Lọc theo mã KCB hoặc mã bệnh nhân"),
    page: int = Query(1, ge=1, description="Số trang"),
    page_size: int = Query(50, ge=1, le=100, description="Kích thước trang"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await cashier_service.get_pending_bills(ma_kcb=ma_kcb, page=page, page_size=page_size, db=db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Lấy danh sách {len(result.items)} hóa đơn chờ thu thành công"
    )


@router.post(
    "/invoices",
    response_model=ResponseEnvelope[InvoiceResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Khởi tạo hóa đơn viện phí cho ca khám (tổng hợp công khám, cận lâm sàng, thuốc)"
)
async def create_invoice(
    payload: InvoiceCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    invoice = await cashier_service.create_invoice_for_encounter(
        payload=payload,
        thu_ngan_user_id=current_user.nguoi_dung_id,
        db=db
    )
    items_dto = [
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
        for line in (invoice.chi_tiet_hoa_don or [])
    ]
    resp = InvoiceResponse(
        id=invoice.id,
        ma_hoa_don=invoice.ma_hoa_don,
        luot_kham_id=invoice.luot_kham_id,
        benh_nhan_id=invoice.benh_nhan_id,
        thu_ngan_id=invoice.thu_ngan_id,
        tong_tien=invoice.tong_tien,
        mien_giam=invoice.mien_giam,
        thuc_thu=invoice.thuc_thu,
        phuong_thuc_thanh_toan=invoice.phuong_thuc_thanh_toan,
        trang_thai=invoice.trang_thai,
        so_hoa_don_in=invoice.so_hoa_don_in,
        ghi_chu=invoice.ghi_chu,
        ngay_thanh_toan=invoice.ngay_thanh_toan,
        created_at=invoice.created_at,
        chi_tiet_hoa_don=items_dto,
    )
    return ResponseEnvelope.success_response(
        data=resp,
        message="Khởi tạo hóa đơn viện phí thành công",
        code=status.HTTP_201_CREATED
    )


@router.get(
    "/invoices/{invoice_id}",
    response_model=ResponseEnvelope[InvoiceResponse],
    summary="Xem chi tiết hóa đơn viện phí"
)
async def get_invoice(
    invoice_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    invoice = await cashier_service.get_invoice_detail(invoice_id, db)
    items_dto = [
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
        for line in (invoice.chi_tiet_hoa_don or [])
    ]
    resp = InvoiceResponse(
        id=invoice.id,
        ma_hoa_don=invoice.ma_hoa_don,
        luot_kham_id=invoice.luot_kham_id,
        benh_nhan_id=invoice.benh_nhan_id,
        thu_ngan_id=invoice.thu_ngan_id,
        tong_tien=invoice.tong_tien,
        mien_giam=invoice.mien_giam,
        thuc_thu=invoice.thuc_thu,
        phuong_thuc_thanh_toan=invoice.phuong_thuc_thanh_toan,
        trang_thai=invoice.trang_thai,
        so_hoa_don_in=invoice.so_hoa_don_in,
        ghi_chu=invoice.ghi_chu,
        ngay_thanh_toan=invoice.ngay_thanh_toan,
        created_at=invoice.created_at,
        chi_tiet_hoa_don=items_dto,
    )
    return ResponseEnvelope.success_response(
        data=resp,
        message="Lấy thông tin hóa đơn thành công"
    )


@router.post(
    "/invoices/{invoice_id}/pay",
    response_model=ResponseEnvelope[InvoiceResponse],
    summary="Thu tiền viện phí và xác nhận hoàn tất thanh toán"
)
async def pay_invoice(
    invoice_id: int,
    payload: InvoicePayRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    invoice = await cashier_service.pay_invoice(
        invoice_id=invoice_id,
        payload=payload,
        thu_ngan_user_id=current_user.nguoi_dung_id,
        db=db
    )
    items_dto = [
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
        for line in (invoice.chi_tiet_hoa_don or [])
    ]
    resp = InvoiceResponse(
        id=invoice.id,
        ma_hoa_don=invoice.ma_hoa_don,
        luot_kham_id=invoice.luot_kham_id,
        benh_nhan_id=invoice.benh_nhan_id,
        thu_ngan_id=invoice.thu_ngan_id,
        tong_tien=invoice.tong_tien,
        mien_giam=invoice.mien_giam,
        thuc_thu=invoice.thuc_thu,
        phuong_thuc_thanh_toan=invoice.phuong_thuc_thanh_toan,
        trang_thai=invoice.trang_thai,
        so_hoa_don_in=invoice.so_hoa_don_in,
        ghi_chu=invoice.ghi_chu,
        ngay_thanh_toan=invoice.ngay_thanh_toan,
        created_at=invoice.created_at,
        chi_tiet_hoa_don=items_dto,
    )
    return ResponseEnvelope.success_response(
        data=resp,
        message=f"Thanh toán thành công hóa đơn {invoice.ma_hoa_don}"
    )


@router.post(
    "/invoices/{invoice_id}/cancel",
    response_model=ResponseEnvelope[InvoiceResponse],
    summary="Hủy hóa đơn viện phí chưa thu tiền"
)
async def cancel_invoice(
    invoice_id: int,
    ly_do: str = Query("Lập sai thông tin", description="Lý do hủy hóa đơn"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    invoice = await cashier_service.cancel_invoice(
        invoice_id=invoice_id,
        ly_do=ly_do,
        thu_ngan_user_id=current_user.nguoi_dung_id,
        db=db
    )
    return ResponseEnvelope.success_response(
        data=invoice,
        message=f"Hủy hóa đơn {invoice.ma_hoa_don} thành công"
    )


@router.get(
    "/shift-summary",
    response_model=ResponseEnvelope[ShiftSummaryResponse],
    summary="Báo cáo tổng kết doanh thu và số lượng phiếu thu trong ca trực"
)
async def get_shift_summary(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await cashier_service.get_shift_summary(current_user.nguoi_dung_id, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy báo cáo tổng kết ca trực thành công"
    )


@router.post(
    "/close-shift",
    response_model=ResponseEnvelope[CloseShiftResponse],
    summary="Khóa sổ ca trực thu ngân"
)
async def close_shift(
    payload: CloseShiftRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await cashier_service.close_shift(
        thu_ngan_user_id=current_user.nguoi_dung_id,
        ghi_chu=payload.ghi_chu,
        tien_mat_thuc_te=payload.tien_mat_thuc_te,
        db=db
    )
    return ResponseEnvelope.success_response(
        data=result,
        message="Khóa sổ ca trực thành công"
    )


@router.post(
    "/refund",
    response_model=ResponseEnvelope[RefundInvoiceResponse],
    summary="Hoàn tiền viện phí và lập phiếu chi trả lại bệnh nhân (FC-16)"
)
async def refund_invoice(
    payload: RefundInvoiceRequest,
    current_user: TaiKhoan = Depends(require_roles([
        VaiTroEnum.LE_TAN,
        VaiTroEnum.THU_NGAN,
        VaiTroEnum.ADMIN,
    ])),
    db: AsyncSession = Depends(get_db)
):
    result = await cashier_service.refund_invoice(
        payload=payload,
        thu_ngan_user_id=current_user.nguoi_dung_id,
        db=db
    )
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Hoàn tiền thành công {result.so_tien_hoan:,.0f}đ cho hóa đơn {result.ma_hoa_don}"
    )
