import inspect
from datetime import datetime, timezone
from decimal import Decimal
import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.appointment import (
    CaLamViecEnum,
    HangDoiKham,
    TrangThaiHangDoiEnum,
)
from app.models.medical import (
    ChanDoan,
    DonThuoc,
    LuotKham,
    LuotKhamTheLuc,
    PhieuKhamChuyenKhoa,
)
from app.models.specialty_exam import KhamNoiKhoa
from app.models.user import ChuyenKhoa
from app.services.appointment.appointment_service import clinic_now
from app.services.clinical.clinical_service import ClinicalService


async def _ensure_khoa_noi(db_session):
    stmt = select(ChuyenKhoa).where(ChuyenKhoa.ma_chuyen_khoa == "KHOA_NOI")
    ck = (await db_session.execute(stmt)).scalar_one_or_none()
    if not ck:
        ck = ChuyenKhoa(
            ma_chuyen_khoa="KHOA_NOI",
            ten_chuyen_khoa="Khoa Nội Tổng Quát",
            vi_tri_phong="Phòng 102 - Tầng 1",
            is_active=True,
        )
        db_session.add(ck)
        await db_session.flush()
    return ck


async def _seed_queue_ticket(db_session, booking):
    ck = await _ensure_khoa_noi(db_session)
    booking.bs_x.chuyen_khoa_id = ck.id
    booking.bs_x.chuyen_khoa = ck
    now_utc = datetime.now(timezone.utc)
    today = clinic_now().date()
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now_utc)
    ticket = HangDoiKham(
        lich_kham_id=lich.id,
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=1,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc,
    )
    db_session.add(ticket)
    await db_session.commit()
    return ticket


def test_clinical_service_wrapper_accepts_for_update_kwarg():
    resolve_params = inspect.signature(ClinicalService._resolve_and_heal_ticket_encounter).parameters
    get_params = inspect.signature(ClinicalService._get_ticket_encounter).parameters
    assert "for_update" in resolve_params
    assert resolve_params["for_update"].default is False
    assert "for_update" in get_params
    assert get_params["for_update"].default is False


@pytest.mark.asyncio
async def test_workspace_state_put_transitions_ticket_and_persists_vitals_and_specialty_exam(
    api_client, booking, db_session
):
    ticket = await _seed_queue_ticket(db_session, booking)
    token_bs = booking.tokens["bs_x"]
    enc_key = f"ticket-{ticket.id}"

    specialty_items = {
        "Tuần hoàn (Tim mạch)": {"status": "BT", "note": ""},
        "Hô hấp": {"status": "BT", "note": ""},
        "Tiêu hóa": {"status": "BT", "note": ""},
        "Thận – Tiết niệu": {"status": "BT", "note": ""},
        "Thần kinh": {"status": "BT", "note": ""},
        "Cơ xương khớp": {"status": "BT", "note": ""},
    }

    res_put = await api_client.put(
        "/api/v1/clinical/workspace-state",
        json={
            "queue": [
                {
                    "ticket_id": ticket.id,
                    "trang_thai": TrangThaiHangDoiEnum.DANG_KHAM.value,
                    "so_lan_goi": 1,
                    "ghi_chu": "Đang khám",
                }
            ],
            "encounters": {
                enc_key: {
                    "mach_lan_phut": 78,
                    "nhiet_do_c": "36.8",
                    "huyet_ap_tam_thu": 120,
                    "huyet_ap_tam_truong": 80,
                    "chieu_cao_cm": "170.0",
                    "can_nang_kg": "65.0",
                    "ly_do_vao_kham": "Đau đầu nhẹ, chóng mặt",
                    "kham_chuyen_khoa": {
                        "khoa": "noi-khoa",
                        "items": specialty_items,
                        "extras": {},
                    },
                }
            },
        },
        headers=token_bs,
    )
    assert res_put.status_code == 200
    assert res_put.json()["data"]["saved"] is True

    lk = (await db_session.execute(select(LuotKham).where(LuotKham.hang_doi_kham_id == ticket.id))).scalar_one()
    assert lk.mach_lan_phut == 78
    assert lk.nhiet_do_c == Decimal("36.8")
    assert lk.huyet_ap_tam_thu == 120
    assert lk.huyet_ap_tam_truong == 80
    assert lk.bmi == Decimal("22.5")

    pe = (
        await db_session.execute(select(LuotKhamTheLuc).where(LuotKhamTheLuc.luot_kham_id == lk.id))
    ).scalar_one_or_none()
    assert pe is not None
    assert pe.mach == 78
    assert pe.bmi == Decimal("22.5")

    phieu_ck = (
        await db_session.execute(select(PhieuKhamChuyenKhoa).where(PhieuKhamChuyenKhoa.luot_kham_id == lk.id))
    ).scalar_one_or_none()
    assert phieu_ck is not None

    sp_noi = (
        await db_session.execute(select(KhamNoiKhoa).where(KhamNoiKhoa.luot_kham_id == lk.id))
    ).scalar_one_or_none()
    assert sp_noi is not None
    assert sp_noi.tuan_hoan == "Bình thường"

    res_get = await api_client.get("/api/v1/clinical/workspace-state", headers=token_bs)
    assert res_get.status_code == 200
    ws_data = res_get.json()["data"]
    assert any(
        t["ticket_id"] == ticket.id and t["trang_thai"] == TrangThaiHangDoiEnum.DANG_KHAM.value
        for t in ws_data["queue"]
    )
    persisted_enc = ws_data["encounters"][enc_key]
    assert persisted_enc["mach_lan_phut"] == 78
    assert len(persisted_enc["kham_chuyen_khoa"]["items"]) == 6
    assert persisted_enc["kham_chuyen_khoa"]["items"]["Tuần hoàn (Tim mạch)"]["status"] == "BT"


@pytest.mark.asyncio
async def test_workspace_state_put_persists_diagnosis_and_prescription(api_client, booking, db_session):
    ticket = await _seed_queue_ticket(db_session, booking)
    token_bs = booking.tokens["bs_x"]
    enc_key = f"ticket-{ticket.id}"

    res_start = await api_client.put(
        "/api/v1/clinical/workspace-state",
        json={
            "queue": [
                {
                    "ticket_id": ticket.id,
                    "trang_thai": TrangThaiHangDoiEnum.DANG_KHAM.value,
                    "so_lan_goi": 1,
                }
            ],
            "encounters": {},
        },
        headers=token_bs,
    )
    assert res_start.status_code == 200

    res_save = await api_client.put(
        "/api/v1/clinical/workspace-state",
        json={
            "queue": [],
            "encounters": {
                enc_key: {
                    "danh_sach_chan_doan": [
                        {
                            "ma_icd10": "J02.9",
                            "ten_benh_chan_doan": "Viêm họng cấp",
                            "loai_chan_doan": "chinh",
                        }
                    ],
                    "danh_sach_thuoc": [
                        {
                            "ten_thuoc": "Paracetamol 500mg",
                            "hoat_chat": "Paracetamol",
                            "ham_luong": "500mg",
                            "don_vi_tinh": "Viên",
                            "sang": 1,
                            "toi": 1,
                            "so_ngay_dung": 5,
                            "so_luong": 10,
                        }
                    ],
                    "loi_dan_uong_thuoc": "Uống sau ăn no",
                    "ket_luan_dieu_tri": "Theo dõi huyết áp",
                    "loi_dan_bac_si": "Hạn chế muối",
                    "ngay_hen_tai_kham": "2026-12-01",
                }
            },
        },
        headers=token_bs,
    )
    assert res_save.status_code == 200
    assert res_save.json()["data"]["saved"] is True

    lk = (await db_session.execute(select(LuotKham).where(LuotKham.hang_doi_kham_id == ticket.id))).scalar_one()
    assert lk.ket_luan_dieu_tri == "Theo dõi huyết áp"
    assert lk.loi_dan_bac_si == "Hạn chế muối"
    assert str(lk.ngay_hen_tai_kham) == "2026-12-01"
    diags = (await db_session.execute(select(ChanDoan).where(ChanDoan.luot_kham_id == lk.id))).scalars().all()
    assert len(diags) == 1
    assert diags[0].ma_icd10 == "J02.9"
    assert diags[0].loai_chan_doan == "chinh"

    rx = (
        await db_session.execute(
            select(DonThuoc)
            .options(selectinload(DonThuoc.danh_sach_chi_tiet))
            .where(DonThuoc.luot_kham_id == lk.id)
        )
    ).scalar_one_or_none()
    assert rx is not None
    assert rx.loi_dan_uong_thuoc == "Uống sau ăn no"
    assert len(rx.danh_sach_chi_tiet) == 1
    assert rx.danh_sach_chi_tiet[0].ten_thuoc == "Paracetamol 500mg"
    assert rx.danh_sach_chi_tiet[0].so_luong == 10

    res_get = await api_client.get("/api/v1/clinical/workspace-state", headers=token_bs)
    assert res_get.status_code == 200
    persisted_enc = res_get.json()["data"]["encounters"][enc_key]
    assert persisted_enc["danh_sach_chan_doan"][0]["ma_icd10"] == "J02.9"
    assert persisted_enc["danh_sach_thuoc"][0]["ten_thuoc"] == "Paracetamol 500mg"
    assert persisted_enc["ket_luan_dieu_tri"] == "Theo dõi huyết áp"
    assert persisted_enc["loi_dan_bac_si"] == "Hạn chế muối"
    assert persisted_enc["ngay_hen_tai_kham"] == "2026-12-01"
