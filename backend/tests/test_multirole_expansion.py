from datetime import datetime, timezone
import uuid
import pytest
from sqlalchemy import select

from app.models.medical import LuotKham
from app.models.user import BacSi, BenhNhan, NguoiDung
from app.models.appointment import LichKham, TrangThaiLichEnum


@pytest.mark.asyncio
async def test_patient_registration_and_auth_flow(api_client):
    """
    Kiểm tra luồng đăng ký tài khoản Bệnh nhân nhanh (UC-PAT-01):
    - Đăng ký bằng số điện thoại, mật khẩu, ngày sinh
    - Tự động kích hoạt tài khoản và cấp JWT Tokens
    - Kiểm tra đăng nhập lại bằng số điện thoại vừa đăng ký
    """
    payload = {
        "ho_ten": "Nguyễn Văn An",
        "so_dien_thoai": "0988776655",
        "mat_khau": "SecurePass@123",
        "email": "nguyenvanan@gmail.com",
        "ngay_sinh": "1995-05-15",
        "gioi_tinh": "Nam",
        "dia_chi": "123 Đường Cầu Giấy, Hà Nội",
        "nhom_mau": "O+",
        "tien_su_benh": "Đau dạ dày nhẹ",
        "di_ung_thuoc": "Dị ứng Penicillin"
    }

    # 1. Đăng ký tài khoản Bệnh nhân
    reg_resp = await api_client.post("/api/v1/auth/register-patient", json=payload)
    assert reg_resp.status_code == 201, reg_resp.text
    res_data = reg_resp.json()["data"]
    assert "accessToken" in res_data
    assert "refreshToken" in res_data
    assert res_data["role"] == "PATIENT"

    # 2. Đăng nhập lại với email vừa đăng ký
    login_resp = await api_client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "nguyenvanan@gmail.com", "password": "SecurePass@123"}
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()["data"]
    assert login_data["role"] == "PATIENT"
    assert login_data["user"]["email"] == "nguyenvanan@gmail.com"


@pytest.mark.asyncio
async def test_patient_profile_and_family_members(api_client):
    """
    Kiểm tra quản lý hồ sơ cá nhân và hồ sơ người thân (UC-PAT-02):
    - Lấy thông tin hồ sơ bệnh nhân
    - Cập nhật thông tin hồ sơ
    - Thêm hồ sơ người thân (con cái, bố mẹ)
    - Xem danh sách người thân
    """
    # 1. Đăng ký một bệnh nhân mới
    payload = {
        "ho_ten": "Trần Thị Mai",
        "so_dien_thoai": "0912345678",
        "mat_khau": "MaiPass@2026",
        "email": "maitt@example.com",
        "ngay_sinh": "1990-10-20",
        "gioi_tinh": "Nữ",
        "dia_chi": "Quận Ba Đình, Hà Nội"
    }
    reg_resp = await api_client.post("/api/v1/auth/register-patient", json=payload)
    assert reg_resp.status_code == 201
    access_token = reg_resp.json()["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # 2. Xem hồ sơ cá nhân
    profile_resp = await api_client.get("/api/v1/patient/profile", headers=headers)
    assert profile_resp.status_code == 200
    profile = profile_resp.json()["data"]
    assert profile["ho_ten"] == "Trần Thị Mai"
    assert profile["gioi_tinh"] == "Nữ"

    # 3. Cập nhật hồ sơ cá nhân
    update_resp = await api_client.put(
        "/api/v1/patient/profile",
        json={"dia_chi": "Phường Điện Biên, Ba Đình, Hà Nội", "nhom_mau": "AB+"},
        headers=headers
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["data"]["dia_chi"] == "Phường Điện Biên, Ba Đình, Hà Nội"

    # 4. Thêm hồ sơ người thân (con cái)
    family_payload = {
        "ho_ten": "Trần Quốc Huy",
        "quan_he": "CON",
        "ngay_sinh": "2020-03-12",
        "gioi_tinh": "Nam",
        "tien_su_benh": "Không",
        "di_ung_thuoc": "Không"
    }
    add_fam_resp = await api_client.post("/api/v1/patient/family-members", json=family_payload, headers=headers)
    assert add_fam_resp.status_code == 201
    fam_member = add_fam_resp.json()["data"]
    assert fam_member["ho_ten"] == "Trần Quốc Huy"
    assert fam_member["quan_he"] == "CON"
    fam_id = fam_member["id"]

    # 5. Lấy danh sách người thân
    fam_list_resp = await api_client.get("/api/v1/patient/family-members", headers=headers)
    assert fam_list_resp.status_code == 200
    fam_list = fam_list_resp.json()["data"]
    assert len(fam_list) >= 1
    assert any(m["id"] == fam_id for m in fam_list)


@pytest.mark.asyncio
async def test_notifications_lifecycle(api_client):
    """
    Kiểm tra vòng đời thông báo (UC-NOTIF-01):
    - Đăng nhập bệnh nhân
    - Xem danh sách thông báo & số lượng chưa đọc
    - Đánh dấu đã đọc
    """
    # 1. Đăng ký một bệnh nhân
    payload = {
        "ho_ten": "Lê Hoàng Long",
        "email": "longlh@example.com",
        "so_dien_thoai": "0977112233",
        "mat_khau": "LongPass@2026",
        "ngay_sinh": "1988-08-08",
        "gioi_tinh": "Nam"
    }
    reg_resp = await api_client.post("/api/v1/auth/register-patient", json=payload)
    assert reg_resp.status_code == 201
    access_token = reg_resp.json()["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # 2. Lấy thông báo (ban đầu rỗng)
    notif_resp = await api_client.get("/api/v1/notifications", headers=headers)
    assert notif_resp.status_code == 200
    assert "data" in notif_resp.json()

    # 3. Lấy số lượng chưa đọc
    unread_resp = await api_client.get("/api/v1/notifications/unread-count", headers=headers)
    assert unread_resp.status_code == 200
    assert "unread_count" in unread_resp.json()["data"]

    # 4. Đánh dấu tất cả đã đọc
    read_all_resp = await api_client.put("/api/v1/notifications/read-all", headers=headers)
    assert read_all_resp.status_code == 200


@pytest.mark.asyncio
async def test_patient_medical_records_and_feedback(api_client, db_session):
    """
    Kiểm tra tra cứu lịch sử khám bệnh và gửi đánh giá dịch vụ (UC-PAT-03, UC-PAT-04):
    - Tra cứu lịch sử khám bệnh cá nhân (EMR timeline)
    - Gửi đánh giá dịch vụ sau khám (1-5 sao, nhận xét)
    """
    # 1. Đăng ký một bệnh nhân
    payload = {
        "ho_ten": "Phạm Thị Hương",
        "email": "huongpt@example.com",
        "so_dien_thoai": "0966554433",
        "mat_khau": "HuongPass@2026",
        "ngay_sinh": "1992-12-01",
        "gioi_tinh": "Nữ"
    }
    reg_resp = await api_client.post("/api/v1/auth/register-patient", json=payload)
    assert reg_resp.status_code == 201
    access_token = reg_resp.json()["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # 2. Tạo một lượt khám trong CSDL cho bệnh nhân vừa tạo
    stmt_bn = select(BenhNhan).join(NguoiDung).where(NguoiDung.so_dien_thoai == "0966554433")
    bn = (await db_session.execute(stmt_bn)).scalar_one()

    bs_user = NguoiDung(ho_ten="BS. Thử Nghiệm", so_dien_thoai="0911000999", email="bstest@clinic.vn")
    db_session.add(bs_user)
    await db_session.flush()
    bs = BacSi(nguoi_dung_id=bs_user.id, hoc_vi="BSCKI", chung_chi_hanh_nghe="CCHN-TEST-001")
    db_session.add(bs)
    await db_session.flush()

    now = datetime.now(timezone.utc)
    lich = LichKham(
        ma_lich_kham=f"LK-{uuid.uuid4().hex[:8].upper()}",
        benh_nhan_id=bn.id,
        bac_si_id=bs.id,
        ngay_kham=now.date(),
        gio_kham=now.time(),
        thoi_luong_phut=30,
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_KHAM.value,
    )
    db_session.add(lich)
    await db_session.flush()

    enc = LuotKham(
        lich_kham_id=lich.id,
        benh_nhan_id=bn.id,
        bac_si_id=bs.id,
        thoi_gian_bat_dau=now,
        thoi_gian_ket_thuc=now,
        is_locked=True,
        ket_luan_dieu_tri="Theo dõi và tái khám sau 1 tuần",
    )
    db_session.add(enc)
    await db_session.flush()

    # 3. Tra cứu lịch sử khám (EMR)
    records_resp = await api_client.get("/api/v1/patient/medical-records", headers=headers)
    assert records_resp.status_code == 200
    records = records_resp.json()["data"]
    assert isinstance(records, list)
    assert len(records) >= 1
    assert records[0]["luot_kham_id"] == enc.id

    # 4. Gửi đánh giá dịch vụ phòng khám
    feedback_payload = {
        "luot_kham_id": enc.id,
        "so_sao_bac_si": 5,
        "so_sao_phong_kham": 5,
        "tieu_chi_hai_long": {"thai_do": 5, "chuyen_mon": 5},
        "nhan_xet": "Bác sĩ và lễ tân phục vụ rất ân cần, nhiệt tình!",
        "an_danh": False
    }
    fb_resp = await api_client.post("/api/v1/patient/feedback", json=feedback_payload, headers=headers)
    assert fb_resp.status_code == 201, fb_resp.text
    fb_data = fb_resp.json()["data"]
    assert fb_data["so_sao_bac_si"] == 5
    assert fb_data["so_sao_phong_kham"] == 5
