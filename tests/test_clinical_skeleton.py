import pytest
from datetime import datetime, timezone
from app.models.medical import DichVu
from app.models.appointment import TrangThaiLichEnum
from app.models.user import TaiKhoan, VaiTroEnum
from app.core.exceptions import ForbiddenException
from app.services.clinical_service import clinical_service


def test_clinical_service_non_doctor_forbidden():
    """Kiểm tra service ném ForbiddenException nếu tài khoản không mang vai trò Bác sĩ"""
    user_patient = TaiKhoan(id=10, nguoi_dung_id=10, vai_tro=VaiTroEnum.BENH_NHAN.value, is_active=True)
    with pytest.raises(ForbiddenException) as exc:
        import asyncio
        asyncio.run(clinical_service._get_doctor_from_user(user_patient, db=None))
    assert "chỉ dành riêng cho Bác sĩ" in str(exc.value.message)


@pytest.mark.asyncio
async def test_clinical_endpoints_require_auth(api_client):
    """Kiểm tra toàn bộ endpoint lâm sàng Package D bắt buộc phải có Authorization Bearer Token"""
    res1 = await api_client.post("/api/v1/clinical/encounters", json={"lich_kham_id": 1})
    assert res1.status_code == 401
    assert "Authorization Bearer Token" in res1.json()["message"]

    res2 = await api_client.get("/api/v1/clinical/encounters/1")
    assert res2.status_code == 401

    res3 = await api_client.post("/api/v1/clinical/encounters/1/diagnoses", json={"ma_icd10": "I10", "ten_benh_chan_doan": "Tăng HA"})
    assert res3.status_code == 401

    res4 = await api_client.post("/api/v1/clinical/encounters/1/orders", json={"dich_vu_id": 1})
    assert res4.status_code == 401

    res5 = await api_client.post("/api/v1/clinical/encounters/1/complete", json={"ket_luan_dieu_tri": "Khỏi bệnh"})
    assert res5.status_code == 401


@pytest.mark.asyncio
async def test_patient_role_forbidden_on_clinical_actions(api_client, booking):
    """Bệnh nhân không được phép tự tạo lượt khám lâm sàng (403 Forbidden)"""
    token_patient = booking.tokens["bn_a"]
    payload = {"lich_kham_id": 1, "ly_do_vao_kham": "Tự mở ca khám"}
    response = await api_client.post("/api/v1/clinical/encounters", json=payload, headers=token_patient)
    assert response.status_code == 403
    body = response.json()
    assert body["success"] is False
    assert "chỉ dành riêng cho Bác sĩ" in body["message"]


@pytest.mark.asyncio
async def test_full_clinical_encounter_lifecycle_and_emr_lock(api_client, booking, db_session):
    """
    Kiểm tra vòng đời đầy đủ của phân hệ lâm sàng Package D (OpenMRS Encounter Pattern):
    1. Bác sĩ tiếp nhận và bắt đầu ca khám thực tế (kèm chỉ số sinh hiệu).
    2. Bác sĩ gán mã chẩn đoán ICD-10 (chính/phụ).
    3. Bác sĩ kê phiếu chỉ định cận lâm sàng.
    4. Bác sĩ hoàn tất ca khám và khóa hồ sơ bệnh án Read-only (Thông tư 32/2023/TT-BYT).
    5. Không thể bổ sung chẩn đoán sau khi hồ sơ đã bị khóa.
    """
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)

    # Khởi tạo lịch hẹn mẫu cho bs_x và bn_a
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    # Thêm dịch vụ cận lâm sàng mẫu vào database
    dv = DichVu(
        ma_dich_vu=f"DV-XQ-{booking.suffix}",
        ten_dich_vu="Chụp X-quang Tim phổi thẳng",
        don_gia=150000,
        don_vi_tinh="Lần",
        is_active=True
    )
    db_session.add(dv)
    await db_session.flush()

    # 1. Bác sĩ tiếp nhận ca khám
    start_payload = {
        "lich_kham_id": lich.id,
        "ly_do_vao_kham": "Đau tức ngực trái khi gắng sức",
        "benh_su": "Tiền sử tăng huyết áp 2 năm",
        "mach_lan_phut": 82,
        "nhiet_do_c": 36.8,
        "huyet_ap_tam_thu": 135,
        "huyet_ap_tam_truong": 85,
        "nhip_tho_lan_phut": 18,
        "can_nang_kg": 68.5,
        "chieu_cao_cm": 170.0,
        "kham_lam_sang_bo_phan": "Tim đều, phổi không rale"
    }
    res_start = await api_client.post("/api/v1/clinical/encounters", json=start_payload, headers=token_bs)
    assert res_start.status_code == 201
    body_start = res_start.json()
    assert body_start["success"] is True
    encounter_id = body_start["data"]["id"]
    assert body_start["data"]["is_locked"] is False
    assert body_start["data"]["mach_lan_phut"] == 82
    assert body_start["data"]["huyet_ap_tam_thu"] == 135

    # 2. Thêm chẩn đoán bệnh mã WHO ICD-10
    diag_payload = {
        "ma_icd10": "I10",
        "ten_benh_chan_doan": "Bệnh tăng huyết áp vô căn (nguyên phát)",
        "loai_chan_doan": "chinh",
        "ghi_chu_chuyen_mon": "Tăng huyết áp độ 1 theo ESC/ESH"
    }
    res_diag = await api_client.post(
        f"/api/v1/clinical/encounters/{encounter_id}/diagnoses",
        json=diag_payload,
        headers=token_bs
    )
    assert res_diag.status_code == 201
    assert res_diag.json()["data"]["ma_icd10"] == "I10"
    assert res_diag.json()["data"]["loai_chan_doan"] == "chinh"

    # 3. Kê chỉ định cận lâm sàng
    order_payload = {
        "dich_vu_id": dv.id,
        "so_luong": 1
    }
    res_order = await api_client.post(
        f"/api/v1/clinical/encounters/{encounter_id}/orders",
        json=order_payload,
        headers=token_bs
    )
    assert res_order.status_code == 201
    assert res_order.json()["data"]["don_gia_tai_thoi_diem"] == 150000.0
    assert res_order.json()["data"]["trang_thai"] == "da_chi_dinh"

    # 4. Tra cứu chi tiết ca khám
    res_detail = await api_client.get(f"/api/v1/clinical/encounters/{encounter_id}", headers=token_bs)
    assert res_detail.status_code == 200
    data_detail = res_detail.json()["data"]
    assert len(data_detail["danh_sach_chan_doan"]) == 1
    assert len(data_detail["danh_sach_chi_dinh"]) == 1

    # 5. Hoàn tất ca khám & khóa hồ sơ bệnh án
    complete_payload = {
        "ket_luan_dieu_tri": "Kê đơn Amlodipine 5mg, điều chỉnh chế độ ăn giảm muối",
        "loi_dan_bac_si": "Theo dõi huyết áp tại nhà 2 lần/ngày, tái khám sau 14 ngày",
        "ngay_hen_tai_kham": "2026-10-15"
    }
    res_complete = await api_client.post(
        f"/api/v1/clinical/encounters/{encounter_id}/complete",
        json=complete_payload,
        headers=token_bs
    )
    assert res_complete.status_code == 200
    data_complete = res_complete.json()["data"]
    assert data_complete["is_locked"] is True
    assert data_complete["thoi_gian_khoa"] is not None

    # Lịch hẹn phải được cập nhật sang trạng thái 'da_kham'
    await db_session.refresh(lich)
    assert lich.trang_thai == TrangThaiLichEnum.DA_KHAM.value

    # 6. Thử bổ sung chẩn đoán vào hồ sơ đã khóa -> Phải bị chặn 409 Conflict
    res_blocked = await api_client.post(
        f"/api/v1/clinical/encounters/{encounter_id}/diagnoses",
        json={"ma_icd10": "E11", "ten_benh_chan_doan": "Đái tháo đường typ 2"},
        headers=token_bs
    )
    assert res_blocked.status_code == 409
    assert "bị khóa" in res_blocked.json()["message"]
