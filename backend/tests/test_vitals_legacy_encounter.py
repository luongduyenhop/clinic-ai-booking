from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models.medical import LuotKham, LuotKhamTheLuc

VITALS = {
    "systolic_bp": 122.0,
    "diastolic_bp": 80.0,
    "heart_rate": 76.0,
    "body_temperature": 38.2,
    "respiratory_rate": 18.0,
    "spo2_percentage": 98.0,
    "height_cm": 172.0,
    "weight_kg": 68.0,
}


@pytest.mark.asyncio
async def test_ghi_sinh_hieu_cho_luot_kham_cu_luu_vao_luot_kham_va_the_luc(api_client, booking, db_session):
    """POST /vitals trên lượt khám bảng luot_kham phải lưu được và ghi đè khi đo lại (không tạo bản ghi trùng)."""
    headers = booking.tokens["bs_x"]
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, datetime.now(timezone.utc))
    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Sốt, đau họng"},
        headers=headers,
    )
    assert res_enc.status_code == 201
    enc_id = res_enc.json()["data"]["id"]

    res = await api_client.post(f"/api/v1/clinical/encounters/{enc_id}/vitals", json=VITALS, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    assert data["encounter_id"] == enc_id
    assert data["bmi"] == 23.0
    assert data["is_critical"] is False

    res_lai = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/vitals",
        json={**VITALS, "heart_rate": 150.0},
        headers=headers,
    )
    assert res_lai.status_code == 201, res_lai.text
    assert res_lai.json()["data"]["is_critical"] is True

    lk = (await db_session.execute(select(LuotKham).where(LuotKham.id == enc_id))).scalar_one()
    await db_session.refresh(lk)
    assert lk.mach_lan_phut == 150
    assert lk.huyet_ap_tam_thu == 122
    assert lk.huyet_ap_tam_truong == 80
    assert lk.nhiet_do_c == Decimal("38.2")
    assert lk.spo2 == Decimal("98.0")
    assert lk.bmi == Decimal("23.0")

    the_luc = (
        await db_session.execute(select(LuotKhamTheLuc).where(LuotKhamTheLuc.luot_kham_id == enc_id))
    ).scalars().all()
    assert len(the_luc) == 1
    assert the_luc[0].mach == 150
    assert the_luc[0].chieu_cao == Decimal("172.00")
    assert the_luc[0].can_nang == Decimal("68.00")
