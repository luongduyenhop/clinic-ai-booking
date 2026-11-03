from datetime import datetime, time, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models.appointment import DanhGiaAI, LichKham, PhanTichAI, TrangThaiLichEnum


@pytest.mark.asyncio
async def test_doctor_feedback_is_persisted_for_linked_ai_analysis(api_client, booking, db_session):
    appointment = LichKham(
        ma_lich_kham=f"LK-AI-FEEDBACK-{booking.suffix}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=(datetime.now(timezone.utc) + timedelta(days=2)).date(),
        gio_kham=time(9),
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )
    db_session.add(appointment)
    await db_session.flush()

    analysis = PhanTichAI(
        lich_kham_id=appointment.id,
        benh_nhan_id=booking.bn_a.id,
        trieu_chung_nhap="Đau đầu nhẹ từng cơn, không sốt.",
        do_tin_cay=0.78,
        co_dau_hieu_cap_cuu=False,
    )
    db_session.add(analysis)
    await db_session.flush()
    appointment.phan_tich_ai_id = analysis.id
    await db_session.flush()

    response = await api_client.post(
        "/api/v1/clinical/ai-feedback",
        headers=booking.tokens["bs_x"],
        json={"phan_tich_ai_id": analysis.id, "so_sao": 4, "nhan_xet": "Phù hợp với triệu chứng."},
    )

    assert response.status_code == 200
    assert response.json()["data"]["phan_tich_ai_id"] == analysis.id
    stmt = select(DanhGiaAI).where(DanhGiaAI.phan_tich_ai_id == analysis.id)
    saved = (await db_session.execute(stmt)).scalar_one()
    assert saved.nguoi_danh_gia_id == booking.bs_x.nguoi_dung_id
    assert saved.vai_tro_nguoi_danh_gia == "bac_si"
    assert saved.so_sao == 4
    assert saved.nhan_xet == "Phù hợp với triệu chứng."


@pytest.mark.asyncio
async def test_doctor_cannot_rate_another_doctors_analysis(api_client, booking, db_session):
    appointment = LichKham(
        ma_lich_kham=f"LK-AI-OTHER-{booking.suffix}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_y.id,
        ngay_kham=(datetime.now(timezone.utc) + timedelta(days=2)).date(),
        gio_kham=time(10),
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )
    db_session.add(appointment)
    await db_session.flush()
    analysis = PhanTichAI(
        lich_kham_id=appointment.id,
        benh_nhan_id=booking.bn_a.id,
        trieu_chung_nhap="Đau đầu nhẹ từng cơn, không sốt.",
        do_tin_cay=0.78,
        co_dau_hieu_cap_cuu=False,
    )
    db_session.add(analysis)
    await db_session.flush()
    appointment.phan_tich_ai_id = analysis.id
    await db_session.flush()

    response = await api_client.post(
        "/api/v1/clinical/ai-feedback",
        headers=booking.tokens["bs_x"],
        json={"phan_tich_ai_id": analysis.id, "so_sao": 2},
    )

    assert response.status_code == 403
    stmt = select(DanhGiaAI).where(DanhGiaAI.phan_tich_ai_id == analysis.id)
    assert (await db_session.execute(stmt)).scalar_one_or_none() is None
