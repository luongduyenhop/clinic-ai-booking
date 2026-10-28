import pytest
from datetime import datetime, timezone, timedelta


@pytest.mark.asyncio
async def test_full_prescription_lifecycle_and_rules(api_client, booking):
    """
    Kiểm tra toàn bộ luồng nghiệp vụ Kê đơn thuốc ngoại trú (OpenMRS Drug Order):
    1. Bệnh nhân không được phép kê đơn (403 Forbidden).
    2. Bác sĩ phụ trách ca khám kê đơn thuốc thành công (201 Created).
    3. Không thể kê trùng 2 đơn thuốc cho cùng một ca khám (409 Conflict).
    4. Đơn thuốc xuất hiện đầy đủ trong chi tiết lượt khám GET /clinical/encounters/{id}.
    5. Bệnh nhân sở hữu ca khám xem được đơn thuốc của mình qua GET /clinical/encounters/{id}/prescriptions.
    6. Bệnh nhân khác bị từ chối xem đơn thuốc (403 Forbidden).
    7. Sau khi ca khám bị khóa bệnh án (is_locked=True), từ chối kê đơn mới (409 Conflict).
    """
    token_bs = booking.tokens["bs_x"]
    token_bn_a = booking.tokens["bn_a"]
    token_bn_b = booking.tokens["bn_b"]
    now = datetime.now(timezone.utc)

    # 1. Khởi tạo lịch khám và mở ca khám lâm sàng
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Tăng huyết áp và đau đầu"},
        headers=token_bs
    )
    assert res_start.status_code == 201
    encounter_id = res_start.json()["data"]["id"]

    prescription_payload = {
        "loi_dan_uong_thuoc": "Uống sau ăn no, uống nhiều nước và kiêng ăn mặn",
        "ghi_chu_duoc_lam_sang": "Kiểm tra huyết áp mỗi sáng trước khi uống Amlodipine",
        "danh_sach_thuoc": [
            {
                "ten_thuoc": "Amlodipine",
                "hoat_chat": "Amlodipine besylate",
                "ham_luong": "5mg",
                "don_vi_tinh": "Viên",
                "so_luong": 30,
                "cach_dung": "Sáng 1 viên sau ăn",
                "so_ngay_dung": 30,
                "ghi_chu": "Uống đúng giờ"
            },
            {
                "ten_thuoc": "Paracetamol",
                "hoat_chat": "Paracetamol",
                "ham_luong": "500mg",
                "don_vi_tinh": "Viên",
                "so_luong": 10,
                "cach_dung": "Khi đau đầu uống 1 viên, cách tối thiểu 4-6 tiếng",
                "so_ngay_dung": 5,
                "ghi_chu": "Không uống quá 4 viên/ngày"
            }
        ]
    }

    # RULE 1: Bệnh nhân không được phép tự kê đơn
    res_patient_create = await api_client.post(
        f"/api/v1/clinical/encounters/{encounter_id}/prescriptions",
        json=prescription_payload,
        headers=token_bn_a
    )
    assert res_patient_create.status_code == 403
    assert "chỉ dành riêng cho Bác sĩ" in res_patient_create.json()["message"]

    # RULE 2: Bác sĩ phụ trách kê đơn thành công
    res_create = await api_client.post(
        f"/api/v1/clinical/encounters/{encounter_id}/prescriptions",
        json=prescription_payload,
        headers=token_bs
    )
    assert res_create.status_code == 201
    body_create = res_create.json()
    assert body_create["success"] is True
    data_presc = body_create["data"]
    assert data_presc["luot_kham_id"] == encounter_id
    assert len(data_presc["danh_sach_chi_tiet"]) == 2
    assert data_presc["danh_sach_chi_tiet"][0]["ten_thuoc"] == "Amlodipine"
    assert data_presc["danh_sach_chi_tiet"][0]["so_luong"] == 30
    assert data_presc["danh_sach_chi_tiet"][1]["ten_thuoc"] == "Paracetamol"

    # RULE 3: Chống kê trùng 2 đơn thuốc cho 1 ca khám (409 Conflict)
    res_dup = await api_client.post(
        f"/api/v1/clinical/encounters/{encounter_id}/prescriptions",
        json=prescription_payload,
        headers=token_bs
    )
    assert res_dup.status_code == 409
    assert "đã được kê đơn thuốc trước đó" in res_dup.json()["message"]

    # RULE 4: Đơn thuốc xuất hiện trong GET chi tiết lượt khám
    res_enc = await api_client.get(
        f"/api/v1/clinical/encounters/{encounter_id}",
        headers=token_bs
    )
    assert res_enc.status_code == 200
    enc_data = res_enc.json()["data"]
    assert enc_data["don_thuoc"] is not None
    assert len(enc_data["don_thuoc"]["danh_sach_chi_tiet"]) == 2

    # RULE 5: Bệnh nhân sở hữu ca khám tra cứu được đơn thuốc của mình
    res_get_patient = await api_client.get(
        f"/api/v1/clinical/encounters/{encounter_id}/prescriptions",
        headers=token_bn_a
    )
    assert res_get_patient.status_code == 200
    assert res_get_patient.json()["data"]["id"] == data_presc["id"]

    # RULE 6: Bệnh nhân khác bị từ chối xem đơn thuốc (403 Forbidden)
    res_other_patient = await api_client.get(
        f"/api/v1/clinical/encounters/{encounter_id}/prescriptions",
        headers=token_bn_b
    )
    assert res_other_patient.status_code == 403
    assert "không có quyền xem đơn thuốc" in res_other_patient.json()["message"]

    # RULE 7: Khóa bệnh án
    await api_client.post(
        f"/api/v1/clinical/encounters/{encounter_id}/diagnoses",
        json={"ma_icd10": "I10", "ten_benh_chan_doan": "Tăng huyết áp vô căn", "loai_chan_doan": "chinh"},
        headers=token_bs
    )
    res_lock = await api_client.post(
        f"/api/v1/clinical/encounters/{encounter_id}/complete",
        json={"ket_luan_dieu_tri": "Huyết áp ổn định, tiếp tục theo dõi ngoại trú"},
        headers=token_bs
    )
    assert res_lock.status_code == 200
    assert res_lock.json()["data"]["is_locked"] is True

    # Khởi tạo ca khám thứ 2 và khóa ngay trước khi kê đơn để test điều kiện chặn
    lich_2 = await booking.tao_lich(booking.bn_a, booking.bs_x, now + timedelta(minutes=30))
    res_start_2 = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich_2.id},
        headers=token_bs
    )
    enc_id_2 = res_start_2.json()["data"]["id"]
    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id_2}/diagnoses",
        json={"ma_icd10": "Z00.0", "ten_benh_chan_doan": "Khám sức khỏe tổng quát", "loai_chan_doan": "chinh"},
        headers=token_bs
    )
    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id_2}/complete",
        json={"ket_luan_dieu_tri": "Khám sàng lọc bình thường"},
        headers=token_bs
    )

    # Thử kê đơn sau khi đã khóa ca khám thứ 2 -> Bị chặn 409 Conflict
    res_presc_locked = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id_2}/prescriptions",
        json=prescription_payload,
        headers=token_bs
    )
    assert res_presc_locked.status_code == 409
    assert "bị khóa" in res_presc_locked.json()["message"]


@pytest.mark.asyncio
async def test_prescription_validation_rules(api_client, booking):
    """Kiểm tra validation Pydantic cho dữ liệu kê đơn thuốc"""
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id},
        headers=token_bs
    )
    enc_id = res_start.json()["data"]["id"]

    # 1. Đơn thuốc không có thuốc nào (danh sách rỗng) -> 422
    res1 = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        json={"danh_sach_thuoc": []},
        headers=token_bs
    )
    assert res1.status_code == 422

    # 2. Số lượng thuốc <= 0 -> 422
    res2 = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        json={
            "danh_sach_thuoc": [
                {
                    "ten_thuoc": "Thuốc A",
                    "don_vi_tinh": "Viên",
                    "so_luong": 0,
                    "cach_dung": "Uống 1 viên"
                }
            ]
        },
        headers=token_bs
    )
    assert res2.status_code == 422

    # 3. Tên thuốc rỗng hoặc toàn khoảng trắng -> 422
    res3 = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        json={
            "danh_sach_thuoc": [
                {
                    "ten_thuoc": "   ",
                    "don_vi_tinh": "Viên",
                    "so_luong": 10,
                    "cach_dung": "Uống 1 viên"
                }
            ]
        },
        headers=token_bs
    )
    assert res3.status_code == 422
