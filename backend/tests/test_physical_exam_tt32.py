import pytest
from datetime import datetime, timezone
from decimal import Decimal
from tests.test_clinical_skeleton import _dam_bao_ma_icd10


@pytest.mark.asyncio
async def test_physical_exam_save_auto_bmi_and_get(api_client, booking, db_session):
    """
    Kiểm tra ghi nhận khám thể lực chuyên khoa theo TT 32/2023:
    - Tự động tính toán BMI từ chiều cao và cân nặng (BMI = weight / (height_m^2))
    - Ghi nhận đầy đủ các cơ quan tuần hoàn, hô hấp, mắt, TMH, RHM
    - Tra cứu lại khám thể lực khớp dữ liệu
    """
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Khám sức khỏe tổng quát định kỳ"},
        headers=token_bs
    )
    assert res_start.status_code == 201
    enc_id = res_start.json()["data"]["id"]

    # Nhập khám thể lực: Cao 170cm, nặng 68kg -> BMI = 68 / (1.7^2) = 23.5
    res_pe = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/physical-exam",
        json={
            "chieu_cao": 170.0,
            "can_nang": 68.0,
            "mach": 75,
            "huyet_ap_tam_thu": 120,
            "huyet_ap_tam_truong": 80,
            "thi_luc_mat_phai": "10/10",
            "thi_luc_mat_trai": "10/10",
            "tai_mui_hong": "Niêm mạc họng hồng, màng nhĩ hai bên sáng",
            "rang_ham_mat": "Không sâu răng, khớp cắn chuẩn",
            "tuan_hoan": "T1, T2 đều rõ, không tiếng thổi",
            "ho_hap": "Rì rào phế nang êm dịu hai phế trường",
            "phan_loai_the_luc": "LOAI_I"
        },
        headers=token_bs
    )
    assert res_pe.status_code == 200
    pe_data = res_pe.json()["data"]
    assert float(pe_data["bmi"]) == 23.5
    assert pe_data["phan_loai_the_luc"] == "LOAI_I"
    assert pe_data["thi_luc_mat_phai"] == "10/10"

    # Lấy thông tin khám thể lực qua GET
    res_get = await api_client.get(
        f"/api/v1/clinical/encounters/{enc_id}/physical-exam",
        headers=token_bs
    )
    assert res_get.status_code == 200
    assert res_get.json()["data"]["tai_mui_hong"] == "Niêm mạc họng hồng, màng nhĩ hai bên sáng"


@pytest.mark.asyncio
async def test_physical_exam_reject_write_on_locked_encounter(api_client, booking, db_session):
    """
    Kiểm tra bất biến: Không cho phép sửa đổi khám thể lực sau khi hồ sơ bệnh án đã khóa (TT 32/2023)
    """
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_b, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Khám sức khỏe"},
        headers=token_bs
    )
    enc_id = res_start.json()["data"]["id"]

    await _dam_bao_ma_icd10(db_session, "Z00.0", "Khám sức khỏe tổng quát")
    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "Z00.0", "ten_benh_chan_doan": "Khám sức khỏe tổng quát", "loai_chan_doan": "chinh"},
        headers=token_bs
    )

    # Hoàn tất ca khám -> Khóa hồ sơ
    res_complete = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Sức khỏe tốt", "loi_dan_bac_si": "Duy trì tập luyện"},
        headers=token_bs
    )
    assert res_complete.status_code == 200
    assert res_complete.json()["data"]["is_locked"] is True

    # Thử sửa khám thể lực sau khi khóa -> 409 Conflict
    res_fail = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/physical-exam",
        json={"chieu_cao": 165.0, "can_nang": 55.0},
        headers=token_bs
    )
    assert res_fail.status_code == 409
    assert "bị khóa" in res_fail.json()["message"]
