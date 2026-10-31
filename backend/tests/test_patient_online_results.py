from datetime import datetime, timezone

import pytest

from app.models.medical import ChiDinh, DichVu


@pytest.mark.asyncio
async def test_patient_reads_own_prescription_and_lab_result_on_portal(api_client, booking, db_session):
    now = datetime.now(timezone.utc)
    appointment = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    encounter_response = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": appointment.id, "ly_do_vao_kham": "Đau đầu"},
        headers=booking.tokens["bs_x"],
    )
    encounter_id = encounter_response.json()["data"]["id"]

    await api_client.post(
        f"/api/v1/clinical/encounters/{encounter_id}/diagnoses",
        json={"ma_icd10": "R51", "ten_benh_chan_doan": "Đau đầu", "loai_chan_doan": "chinh"},
        headers=booking.tokens["bs_x"],
    )
    prescription_response = await api_client.post(
        f"/api/v1/clinical/encounters/{encounter_id}/prescriptions",
        json={
            "loi_dan_uong_thuoc": "Uống sau ăn",
            "danh_sach_thuoc": [{
                "ten_thuoc": "Paracetamol",
                "ham_luong": "500mg",
                "don_vi_tinh": "Viên",
                "so_luong": 8,
                "lieu_sang": "1 viên",
                "lieu_trua": "1 viên",
                "lieu_chieu": "1 viên",
                "lieu_toi": "1 viên",
                "cach_dung": "Uống sau ăn no",
                "so_ngay_dung": 2,
            }],
        },
        headers=booking.tokens["bs_x"],
    )
    assert prescription_response.status_code == 201

    service = DichVu(
        ma_dich_vu=f"XRAY-{booking.suffix}",
        ten_dich_vu="X-quang ngực thẳng",
        don_gia=100000,
    )
    db_session.add(service)
    await db_session.flush()
    order = ChiDinh(
        luot_kham_id=encounter_id,
        dich_vu_id=service.id,
        don_gia_tai_thoi_diem=100000,
        trang_thai="da_co_ket_qua",
        ket_qua_chi_tiet="Không thấy tổn thương phổi",
        ket_qua_phan_loai="BINH_THUONG",
        thoi_gian_tra_ket_qua=now,
        tri_so_chi_tiet={"Nhịp tim": {"gia_tri": "72", "khoang_tham_chieu": "60-100 lần/phút"}},
        file_dinh_kem_urls=["https://cdn.clinic.test/results/xray-original.png"],
    )
    db_session.add(order)
    await db_session.commit()

    prescriptions = await api_client.get(
        "/api/v1/patient/prescriptions", headers=booking.tokens["bn_a"]
    )
    assert prescriptions.status_code == 200
    prescription = prescriptions.json()["data"][0]
    assert prescription["luot_kham_id"] == encounter_id
    medicine = prescription["danh_sach_thuoc"][0]
    assert [medicine[key] for key in ("lieu_sang", "lieu_trua", "lieu_chieu", "lieu_toi")] == [
        "1 viên", "1 viên", "1 viên", "1 viên"
    ]

    lab_results = await api_client.get(
        "/api/v1/patient/lab-results", headers=booking.tokens["bn_a"]
    )
    assert lab_results.status_code == 200
    lab_result = lab_results.json()["data"][0]
    assert lab_result["ket_luan"] == "Không thấy tổn thương phổi"
    assert lab_result["tep_dinh_kem"][0]["url"].endswith("xray-original.png")
    assert lab_result["tep_dinh_kem"][0]["loai_tep"] == "HINH_ANH"

    other_patient = await api_client.get(
        "/api/v1/patient/prescriptions", headers=booking.tokens["bn_b"]
    )
    assert other_patient.status_code == 200
    assert other_patient.json()["data"] == []

    page = await api_client.get(
        "/api/v1/patient/prescriptions?page=1&page_size=1", headers=booking.tokens["bn_a"]
    )
    assert page.status_code == 200
    assert page.json()["meta"]["page_size"] == 1
    assert page.json()["meta"]["total_items"] >= 1
    next_page = await api_client.get(
        "/api/v1/patient/prescriptions?page=999&page_size=1", headers=booking.tokens["bn_a"]
    )
    assert next_page.json()["data"] == []
    invalid_page = await api_client.get(
        "/api/v1/patient/lab-results?page_size=1000", headers=booking.tokens["bn_a"]
    )
    assert invalid_page.status_code == 422
