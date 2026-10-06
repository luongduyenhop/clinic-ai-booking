import pytest
from datetime import date
import unicodedata
from pydantic import ValidationError
from app.schemas.auth import RegisterRequest, UpdateUserProfileRequest


def test_update_profile_schema_validation():
    """Kiểm tra schema UpdateUserProfileRequest chấp nhận dữ liệu hợp lệ"""
    payload = UpdateUserProfileRequest(
        ho_ten="Nguyễn Văn A",
        so_dien_thoai="0987654321",
        ngay_sinh=date(1995, 5, 20),
        gioi_tinh="Nam",
        dia_chi="Hà Nội",
        nhom_mau="O+",
        tien_su_benh="Không có",
        di_ung_thuoc="Penicillin"
    )
    assert payload.ho_ten == "Nguyễn Văn A"
    assert payload.nhom_mau == "O+"
    assert payload.di_ung_thuoc == "Penicillin"


def test_update_profile_schema_partial():
    """Kiểm tra schema cho phép cập nhật từng phần (tất cả các trường đều optional)"""
    payload = UpdateUserProfileRequest(ho_ten="Trần Thị B")
    assert payload.ho_ten == "Trần Thị B"
    assert payload.so_dien_thoai is None
    assert payload.nhom_mau is None


@pytest.mark.asyncio
async def test_update_profile_api(api_client, booking):
    """Kiểm tra endpoint PUT /api/v1/auth/me cập nhật thành công hồ sơ người bệnh"""
    token_header = booking.tokens["bn_a"]
    
    # 1. Gọi PUT /api/v1/auth/me
    update_data = {
        "ho_ten": "Bệnh Nhân A Đã Đổi Tên",
        "so_dien_thoai": "0911223344",
        "dia_chi": "Số 123 Đường Cầu Giấy, Hà Nội",
        "nhom_mau": "AB+",
        "tien_su_benh": "Viêm dạ dày mạn tính",
        "di_ung_thuoc": "Aspirin"
    }
    resp = await api_client.put("/api/v1/auth/me", json=update_data, headers=token_header)
    assert resp.status_code == 200
    res_json = resp.json()["data"]
    assert res_json["ho_ten"] == "Bệnh Nhân A Đã Đổi Tên"
    assert res_json["so_dien_thoai"] == "0911223344"
    assert res_json["dia_chi"] == "Số 123 Đường Cầu Giấy, Hà Nội"
    assert res_json["nhom_mau"] == "AB+"
    assert res_json["tien_su_benh"] == "Viêm dạ dày mạn tính"

    # 2. Gọi GET /api/v1/auth/me để xác nhận dữ liệu đã được lưu bền vững
    get_resp = await api_client.get("/api/v1/auth/me", headers=token_header)
    assert get_resp.status_code == 200
    get_json = get_resp.json()["data"]
    assert get_json["ho_ten"] == "Bệnh Nhân A Đã Đổi Tên"
    assert get_json["so_dien_thoai"] == "0911223344"


@pytest.mark.parametrize("payload", [
    {"gioi_tinh": "XYZ"},                       # ngoài danh mục Nam/Nữ/Khác
    {"gioi_tinh": "Không xác định rõ"},         # dài hơn cột VARCHAR(10) -> trước đây lỗi 500
    {"so_dien_thoai": "abc"},
    {"so_dien_thoai": "09123"},
    {"ho_ten": " A "},                          # cắt khoảng trắng còn 1 ký tự
    {"nhom_mau": "Nhóm máu hiếm Rh-null"},      # dài hơn cột VARCHAR(10)
])
@pytest.mark.asyncio
async def test_update_profile_rejects_invalid_values(api_client, booking, payload):
    """PUT /auth/me phải trả 422 cho dữ liệu sai thay vì lưu giá trị rác hoặc lỗi 500"""
    resp = await api_client.put("/api/v1/auth/me", json=payload, headers=booking.tokens["bn_a"])
    assert resp.status_code == 422


def test_gender_accepts_decomposed_unicode():
    """'Nữ' gõ theo dạng tổ hợp (NFD - thường gặp trên macOS/iOS) vẫn được chấp nhận và lưu dạng NFC"""
    payload = UpdateUserProfileRequest(gioi_tinh=unicodedata.normalize("NFD", "Nữ"), ho_ten="  Trần Thị B  ")
    assert payload.gioi_tinh == "Nữ"
    assert payload.ho_ten == "Trần Thị B"


@pytest.mark.parametrize("gioi_tinh", ["XYZ", "Không xác định rõ"])
def test_register_rejects_invalid_gender(gioi_tinh):
    with pytest.raises(ValidationError):
        RegisterRequest(
            ho_ten="Nguyễn Văn A", email="a@example.com", so_dien_thoai="0987654321",
            mat_khau="MatKhau@123", gioi_tinh=gioi_tinh
        )


def test_register_rejects_email_longer_than_column():
    """Email dài hơn cột VARCHAR(100) bị chặn ở tầng schema"""
    with pytest.raises(ValidationError):
        RegisterRequest(
            ho_ten="Nguyễn Văn A", email=f"{'a' * 60}@{'b' * 40}.com", so_dien_thoai="0987654321",
            mat_khau="MatKhau@123"
        )


@pytest.mark.parametrize("ho_ten", ["     ", " A "])
def test_register_rejects_blank_or_too_short_name(ho_ten):
    """Đăng ký dùng chung ràng buộc họ tên với cập nhật hồ sơ: cắt khoảng trắng rồi mới kiểm tra độ dài"""
    with pytest.raises(ValidationError):
        RegisterRequest(ho_ten=ho_ten, email="a@example.com", so_dien_thoai="0987654321", mat_khau="MatKhau@123")


def test_register_strips_name_whitespace():
    payload = RegisterRequest(ho_ten="  Nguyễn Văn A ", email="a@example.com", so_dien_thoai="0987654321", mat_khau="MatKhau@123")
    assert payload.ho_ten == "Nguyễn Văn A"


@pytest.mark.asyncio
async def test_update_profile_blank_fields_keep_old_values(api_client, booking):
    """Ô để trống trên form ('' / toàn dấu cách) = không đổi trường đó; các trường khác vẫn được lưu"""
    headers = booking.tokens["bn_a"]
    before = (await api_client.get("/api/v1/auth/me", headers=headers)).json()["data"]
    resp = await api_client.put(
        "/api/v1/auth/me",
        json={"ho_ten": "   ", "so_dien_thoai": "", "gioi_tinh": "", "dia_chi": "Hà Nội"},
        headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["dia_chi"] == "Hà Nội"
    assert data["ho_ten"] == before["ho_ten"]
    assert data["so_dien_thoai"] == before["so_dien_thoai"]
    assert data["gioi_tinh"] == before["gioi_tinh"]
