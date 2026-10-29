from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.models.medical import ChanDoan, LuotKham


@pytest.mark.asyncio
async def test_patient_emr_timeline_contains_only_own_records_with_vitals_and_diagnoses(
    api_client,
    db_session,
    booking,
):
    """PJ2026-146: timeline đầy đủ và không lộ hồ sơ của bệnh nhân khác (IDOR)."""
    now = datetime.now(timezone.utc)
    older = LuotKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        thoi_gian_bat_dau=now - timedelta(days=30),
        thoi_gian_ket_thuc=now - timedelta(days=30, hours=-1),
        ly_do_vao_kham="Đau đầu",
        is_locked=True,
    )
    latest = LuotKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_y.id,
        thoi_gian_bat_dau=now - timedelta(days=1),
        thoi_gian_ket_thuc=now - timedelta(days=1, hours=-1),
        ly_do_vao_kham="Khám tim mạch",
        trieu_chung="Hồi hộp",
        benh_su="Triệu chứng xuất hiện hai ngày",
        mach_lan_phut=82,
        nhiet_do_c=Decimal("36.8"),
        huyet_ap_tam_thu=125,
        huyet_ap_tam_truong=80,
        nhip_tho_lan_phut=18,
        can_nang_kg=Decimal("58.50"),
        chieu_cao_cm=Decimal("162.00"),
        spo2=Decimal("98.0"),
        bmi=Decimal("22.3"),
        ket_luan_dieu_tri="Theo dõi ngoại trú",
        loi_dan_bac_si="Hạn chế cà phê",
        is_locked=True,
    )
    foreign_record = LuotKham(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        thoi_gian_bat_dau=now,
        ly_do_vao_kham="Hồ sơ mật của bệnh nhân B",
        is_locked=True,
    )
    db_session.add_all([older, latest, foreign_record])
    await db_session.flush()
    db_session.add_all([
        ChanDoan(
            luot_kham_id=latest.id,
            ma_icd10="I10",
            ten_benh_chan_doan="Tăng huyết áp vô căn",
            loai_chan_doan="chinh",
            ghi_chu_chuyen_mon="Tiếp tục theo dõi huyết áp tại nhà",
        ),
        ChanDoan(
            luot_kham_id=latest.id,
            ma_icd10="R00.2",
            ten_benh_chan_doan="Đánh trống ngực",
            loai_chan_doan="phu",
        ),
        ChanDoan(
            luot_kham_id=foreign_record.id,
            ma_icd10="Z99",
            ten_benh_chan_doan="Không được phép lộ",
            loai_chan_doan="chinh",
        ),
    ])
    await db_session.flush()

    response = await api_client.get(
        "/api/v1/patient/medical-records",
        headers=booking.tokens["bn_a"],
    )

    assert response.status_code == 200, response.text
    records = response.json()["data"]
    assert [record["luot_kham_id"] for record in records] == [latest.id, older.id]
    assert foreign_record.id not in {record["luot_kham_id"] for record in records}

    item = records[0]
    assert item["bac_si_id"] == booking.bs_y.id
    assert item["bac_si_ho_ten"].startswith("Test bs_y")
    assert item["sinh_hieu"] == {
        "mach_lan_phut": 82,
        "nhiet_do_c": 36.8,
        "huyet_ap_tam_thu": 125,
        "huyet_ap_tam_truong": 80,
        "nhip_tho_lan_phut": 18,
        "can_nang_kg": 58.5,
        "chieu_cao_cm": 162.0,
        "spo2": 98.0,
        "bmi": 22.3,
    }
    assert [diagnosis["ma_icd10"] for diagnosis in item["danh_sach_chan_doan"]] == ["I10", "R00.2"]
    assert item["ket_luan_dieu_tri"] == "Theo dõi ngoại trú"


@pytest.mark.asyncio
async def test_doctor_cannot_use_patient_self_service_emr_endpoint(api_client, booking):
    """Endpoint self-service không nhận patient_id và chỉ chấp nhận vai trò bệnh nhân."""
    response = await api_client.get(
        "/api/v1/patient/medical-records",
        headers=booking.tokens["bs_x"],
    )

    assert response.status_code == 403

