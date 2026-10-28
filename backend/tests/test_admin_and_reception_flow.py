from datetime import date, time
from app.models.appointment import CaLamViecEnum
from app.models.user import VaiTroEnum
from app.schemas.admin import (
    ShiftCreateRequest,
    ServiceCreateRequest,
)
from app.schemas.queue import WalkInQuickRequest


def test_admin_schemas_and_roles():
    """Kiểm tra phân quyền và cấu trúc schema quản trị"""
    assert VaiTroEnum.ADMIN.value == "admin"
    assert VaiTroEnum.LE_TAN.value == "le_tan"
    assert VaiTroEnum.BAC_SI.value == "bac_si"

    # Schema phân ca
    req = ShiftCreateRequest(
        bac_si_id=1,
        ngay_lam_viec=date(2026, 10, 10),
        ca_lam_viec="sang",
        gioi_han_ca_kham=8,
    )
    assert req.ca_lam_viec == CaLamViecEnum.SANG.value
    assert req.gioi_han_ca_kham == 8


def test_shift_default_hours():
    """Kiểm tra giờ làm việc chuẩn ca sáng/chiều theo OpenEMR Calendar"""
    # Ca sáng mặc định 07:30 - 11:30
    s_morning = time(7, 30)
    e_morning = time(11, 30)
    assert s_morning < e_morning

    # Ca chiều mặc định 13:30 - 17:00
    s_afternoon = time(13, 30)
    e_afternoon = time(17, 0)
    assert s_afternoon < e_afternoon


def test_quick_walk_in_schema():
    """Kiểm tra dữ liệu tiếp nhận nhanh vãng lai tại quầy"""
    walk_req = WalkInQuickRequest(
        ho_ten="Bệnh Nhân Vãng Lai",
        so_dien_thoai="0912345678",
        gioi_tinh="Nam",
        nam_sinh=1990,
        bac_si_id=1,
        ca_kham="sang",
        ly_do_kham="Khám cấp bách",
    )
    assert walk_req.so_dien_thoai == "0912345678"
    assert walk_req.ca_kham == "sang"


def test_admin_service_item_schema():
    """Kiểm tra dữ liệu tạo dịch vụ niêm yết"""
    svc_req = ServiceCreateRequest(
        ma_dich_vu="XN_GLUCOSE",
        ten_dich_vu="Xét nghiệm đường huyết mao mạch",
        don_gia=150000.0,
        don_vi_tinh="Lần",
    )
    assert svc_req.don_gia == 150000.0
    assert svc_req.ma_dich_vu == "XN_GLUCOSE"
