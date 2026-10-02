import pytest
from datetime import date
from app.schemas.auth import UpdateUserProfileRequest, UserProfileResponse


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
