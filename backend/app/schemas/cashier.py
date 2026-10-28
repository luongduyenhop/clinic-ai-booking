from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class InvoiceLineItemCreate(BaseModel):
    loai_muc: str = Field(..., description="loai_muc: cong_kham, can_lam_sang, thuoc, vat_tu, khac")
    muc_tham_chieu_id: Optional[int] = Field(None, description="ID tham chiếu của dịch vụ hoặc đơn thuốc")
    ten_khoan_thu: str = Field(..., description="Tên khoản thu")
    so_luong: int = Field(1, ge=1, description="Số lượng")
    don_gia: Decimal = Field(..., ge=0, description="Đơn giá")
    ghi_chu: Optional[str] = None


class InvoiceLineItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    hoa_don_id: int
    loai_muc: str
    muc_tham_chieu_id: Optional[int] = None
    ten_khoan_thu: str
    so_luong: int
    don_gia: Decimal
    thanh_tien: Decimal
    ghi_chu: Optional[str] = None


class InvoiceCreateRequest(BaseModel):
    luot_kham_id: int = Field(..., description="ID lượt khám cần xuất viện phí")
    mien_giam: Decimal = Field(Decimal("0.00"), ge=0, description="Số tiền miễn giảm nếu có")
    ghi_chu: Optional[str] = None
    items: Optional[List[InvoiceLineItemCreate]] = Field(None, description="Danh sách mục tùy chỉnh nếu không auto-generate")


class InvoicePayRequest(BaseModel):
    phuong_thuc_thanh_toan: str = Field("tien_mat", description="tien_mat, chuyen_khoan, the_pos, vi_dien_tu")
    so_tien_khach_tra: Decimal = Field(..., ge=0, description="Số tiền người bệnh thanh toán")
    ghi_chu: Optional[str] = None


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ma_hoa_don: str
    luot_kham_id: int
    benh_nhan_id: int
    thu_ngan_id: int
    tong_tien: Decimal
    mien_giam: Decimal
    thuc_thu: Decimal
    phuong_thuc_thanh_toan: str
    trang_thai: str
    so_hoa_don_in: Optional[str] = None
    ghi_chu: Optional[str] = None
    ngay_thanh_toan: Optional[datetime] = None
    created_at: datetime
    chi_tiet_hoa_don: List[InvoiceLineItemResponse] = []


class PatientBrief(BaseModel):
    mabn: Optional[str] = None
    ho_ten: str
    so_dien_thoai: Optional[str] = None


class PendingBillItem(BaseModel):
    id: int
    ma_hoa_don: str
    luot_kham_id: int
    benh_nhan: PatientBrief
    tong_tien: Decimal
    mien_giam: Decimal
    thuc_thu: Decimal
    trang_thai: str
    created_at: datetime
    cac_khoan_thu: List[InvoiceLineItemResponse] = []


class PendingBillsListResponse(BaseModel):
    items: List[PendingBillItem]
    total: int


class ShiftSummaryResponse(BaseModel):
    thu_ngan_id: int
    ten_thu_ngan: str
    tong_hoa_don: int
    tong_tien_mat: Decimal
    tong_chuyen_khoan: Decimal
    tong_the_pos: Decimal
    tong_doanh_thu: Decimal
    so_phieu_thu: int
    so_phieu_chi: int


class CloseShiftRequest(BaseModel):
    tien_mat_thuc_te: Optional[Decimal] = Field(None, description="Số tiền mặt thực tế kiểm đếm trong két. Mặc định bằng tổng tiền mặt hệ thống.")
    ghi_chu: Optional[str] = None


class CloseShiftResponse(BaseModel):
    ok: bool
    ma_khoa_so: Optional[str] = None
    thoi_gian_dong_so: datetime
    tien_mat_thuc_te: Optional[Decimal] = None
    chenh_lech_tien_mat: Optional[Decimal] = None
    khoa_so_id: Optional[int] = None
    tong_ket: ShiftSummaryResponse


class RefundInvoiceRequest(BaseModel):
    """Yêu cầu hoàn tiền viện phí / xuất phiếu chi trả lại bệnh nhân (FC-16)"""
    invoice_id: int = Field(..., description="ID hóa đơn cần hoàn tiền")
    so_tien_hoan: Optional[Decimal] = Field(None, gt=0, description="Số tiền hoàn lại (None nếu hoàn 100% thực thu)")
    ly_do: str = Field(..., min_length=5, max_length=500, description="Lý do hoàn tiền (bệnh nhân bỏ về, hủy dịch vụ CLS, v.v.)")
    phuong_thuc: str = Field("tien_mat", description="tien_mat hoặc chuyen_khoan")


class RefundInvoiceResponse(BaseModel):
    """Kết quả hoàn tiền viện phí"""
    ma_phieu_chi: str
    phieu_chi_id: int
    hoa_don_id: int
    ma_hoa_don: str
    so_tien_hoan: Decimal
    trang_thai_hoa_don_moi: str
    thoi_gian: datetime
    nguoi_thuc_hien_id: int
    ly_do: str
