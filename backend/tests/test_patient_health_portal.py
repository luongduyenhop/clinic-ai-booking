from datetime import datetime, timezone

import pytest

from app.models.appointment import TrangThaiLichEnum
from app.models.medical import ChanDoan, ChiDinh, ChiTietDonThuoc, DichVu, DonThuoc, LuotKham


@pytest.mark.asyncio
async def test_patient_can_view_owned_record_lab_results_and_prescriptions(api_client, booking, db_session):
    now = datetime.now(timezone.utc)
    appointment = await booking.tao_lich(
        booking.bn_a,
        booking.bs_x,
        now,
        trang_thai=TrangThaiLichEnum.DA_KHAM.value,
    )
    encounter = LuotKham(
        lich_kham_id=appointment.id,
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        thoi_gian_bat_dau=now,
        thoi_gian_ket_thuc=now,
        trieu_chung="Đau đầu và mệt mỏi",
        ket_luan_dieu_tri="Theo dõi ngoại trú",
        loi_dan_bac_si="Uống đủ nước",
        is_locked=True,
    )
    db_session.add(encounter)
    await db_session.flush()

    diagnosis = ChanDoan(
        luot_kham_id=encounter.id,
        ma_icd10="R51",
        ten_benh_chan_doan="Đau đầu",
        loai_chan_doan="chinh",
    )
    service = DichVu(ma_dich_vu="XN-PORTAL", ten_dich_vu="Công thức máu", don_gia=120000)
    db_session.add_all([diagnosis, service])
    await db_session.flush()
    order = ChiDinh(
        luot_kham_id=encounter.id,
        dich_vu_id=service.id,
        trang_thai="da_co_ket_qua",
        ket_qua_chi_tiet="Các chỉ số trong giới hạn tham chiếu",
        ket_qua_phan_loai="BINH_THUONG",
        tri_so_chi_tiet={"WBC": {"value": 7.2, "unit": "G/L"}},
        file_dinh_kem_urls=["https://example.test/results/cbc.pdf"],
    )
    prescription = DonThuoc(
        luot_kham_id=encounter.id,
        bac_si_ke_don_id=booking.bs_x.id,
        ngay_ke_don=now,
        so_ngay_dung=5,
        loi_dan_uong_thuoc="Uống sau ăn",
        trang_thai="ISSUED",
    )
    db_session.add_all([order, prescription])
    await db_session.flush()
    db_session.add(ChiTietDonThuoc(
        don_thuoc_id=prescription.id,
        ten_thuoc="Paracetamol",
        ham_luong="500mg",
        don_vi_tinh="Viên",
        so_luong=10,
        cach_dung="Uống 1 viên khi đau",
        so_ngay_dung=5,
    ))
    await db_session.commit()

    detail_response = await api_client.get(
        f"/api/v1/patient/medical-records/{encounter.id}", headers=booking.tokens["bn_a"]
    )
    assert detail_response.status_code == 200, detail_response.text
    detail = detail_response.json()["data"]
    assert detail["chan_doan_chinh"] == "Đau đầu"
    assert detail["ket_qua_can_lam_sang"][0]["ten_dich_vu"] == "Công thức máu"
    assert detail["don_thuoc"][0]["danh_sach_thuoc"][0]["ten_thuoc"] == "Paracetamol"

    lab_response = await api_client.get("/api/v1/patient/lab-results", headers=booking.tokens["bn_a"])
    assert lab_response.status_code == 200
    assert lab_response.json()["data"][0]["tri_so_chi_tiet"]["WBC"]["value"] == 7.2

    prescription_response = await api_client.get(
        "/api/v1/patient/prescriptions", headers=booking.tokens["bn_a"]
    )
    assert prescription_response.status_code == 200
    assert prescription_response.json()["data"][0]["trang_thai"] == "ISSUED"


@pytest.mark.asyncio
async def test_patient_cannot_view_another_patients_record(api_client, booking, db_session):
    now = datetime.now(timezone.utc)
    appointment = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    encounter = LuotKham(
        lich_kham_id=appointment.id,
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        thoi_gian_bat_dau=now,
    )
    db_session.add(encounter)
    await db_session.commit()

    response = await api_client.get(
        f"/api/v1/patient/medical-records/{encounter.id}", headers=booking.tokens["bn_b"]
    )
    assert response.status_code == 404
