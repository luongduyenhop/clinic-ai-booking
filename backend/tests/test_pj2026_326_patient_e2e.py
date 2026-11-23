from datetime import date, datetime, time, timedelta, timezone

import pytest

from app.core.security import create_access_token, hash_password
from app.models.appointment import CaLamViecEnum, LichLamViec
from app.models.medical import ChiDinh, DichVu, HoaDon
from app.models.user import NguoiDung, TaiKhoan, VaiTroEnum


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "symptom_text",
    [
        "đau ngực dữ dội khó thở",
        "dau nguc du doi kho tho",
    ],
)
async def test_step1_red_flag_115_with_and_without_diacritics_and_blocks_booking(
    api_client, booking, symptom_text
):
    res = await api_client.post(
        "/api/v1/ai/analyze-symptoms",
        json={"trieu_chung": symptom_text},
        headers=booking.tokens["bn_a"],
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["has_emergency"] is True
    assert "115" in (data.get("emergency_alert") or "")
    assert data["suggested_specialties"] == []

    fe_res = await api_client.post(
        "/api/v1/ai-triage/analyze",
        json={"symptoms": symptom_text},
        headers=booking.tokens["bn_a"],
    )
    assert fe_res.status_code == 200
    fe_data = fe_res.json()["data"]
    assert fe_data["has_emergency"] is True
    assert fe_data["chuyenKhoa"] is None

    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    block_res = await api_client.post(
        "/api/v1/appointments",
        json={
            "bac_si_id": booking.bs_x.id,
            "ngay_kham": tomorrow,
            "gio_kham": "08:00:00",
            "ly_do_kham": symptom_text,
            "phan_tich_ai_id": data["phan_tich_ai_id"],
        },
        headers=booking.tokens["bn_a"],
    )
    assert block_res.status_code == 422


@pytest.mark.asyncio
async def test_step2_ai_triage_to_30min_slot_booking_and_slot_exclusion(
    api_client, booking, db_session
):
    target_date = date.today() + timedelta(days=2)
    shift = LichLamViec(
        bac_si_id=booking.bs_x.id,
        ngay_lam_viec=target_date,
        ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(7, 30),
        gio_ket_thuc=time(11, 30),
        gioi_han_ca_kham=8,
        han_muc_dat_truoc=6,
        han_muc_vang_lai=2,
        is_active=True,
    )
    db_session.add(shift)
    await db_session.commit()

    triage_res = await api_client.post(
        "/api/v1/ai/analyze-symptoms",
        json={"trieu_chung": "đau họng sốt nhẹ ho khan 2 ngày"},
        headers=booking.tokens["bn_a"],
    )
    assert triage_res.status_code == 200
    triage_data = triage_res.json()["data"]
    assert triage_data["has_emergency"] is False
    assert len(triage_data["suggested_specialties"]) >= 1

    slots_res = await api_client.get(
        f"/api/v1/appointments/doctors/{booking.bs_x.id}/slots",
        params={"query_date": target_date.isoformat()},
    )
    assert slots_res.status_code == 200
    slots = slots_res.json()["data"]["slots"]
    available_slots = [s for s in slots if s["status"] == "available"]
    assert len(available_slots) > 0
    chosen_time = available_slots[0]["time_val"]

    book_res = await api_client.post(
        "/api/v1/appointments",
        json={
            "bac_si_id": booking.bs_x.id,
            "ngay_kham": target_date.isoformat(),
            "gio_kham": chosen_time,
            "ly_do_kham": "đau họng sốt nhẹ ho khan 2 ngày",
            "phan_tich_ai_id": triage_data["phan_tich_ai_id"],
        },
        headers=booking.tokens["bn_a"],
    )
    assert book_res.status_code == 201
    appt = book_res.json()["data"]
    assert appt["ma_lich_kham"].startswith("LK")

    slots_after = await api_client.get(
        f"/api/v1/appointments/doctors/{booking.bs_x.id}/slots",
        params={"query_date": target_date.isoformat()},
    )
    assert slots_after.status_code == 200
    booked_slot_entry = next(
        s for s in slots_after.json()["data"]["slots"] if s["time_val"] == chosen_time
    )
    assert booked_slot_entry["status"] == "booked"


@pytest.mark.asyncio
async def test_step3_closed_loop_patient_portal_history_lab_prescription_invoice(
    api_client, booking, db_session
):
    now = datetime.now(timezone.utc)
    appointment = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    enc_res = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": appointment.id, "ly_do_vao_kham": "Đau họng, ho khan"},
        headers=booking.tokens["bs_x"],
    )
    assert enc_res.status_code == 201
    encounter_id = enc_res.json()["data"]["id"]

    diag_res = await api_client.post(
        f"/api/v1/clinical/encounters/{encounter_id}/diagnoses",
        json={
            "ma_icd10": "J02.9",
            "ten_benh_chan_doan": "Viêm họng cấp",
            "loai_chan_doan": "chinh",
        },
        headers=booking.tokens["bs_x"],
    )
    assert diag_res.status_code in (200, 201)

    rx_res = await api_client.post(
        f"/api/v1/clinical/encounters/{encounter_id}/prescriptions",
        json={
            "loi_dan_uong_thuoc": "Uống nhiều nước ấm, tái khám sau 5 ngày",
            "danh_sach_thuoc": [
                {
                    "ten_thuoc": "Amoxicillin 500mg",
                    "ham_luong": "500mg",
                    "don_vi_tinh": "Viên",
                    "so_luong": 15,
                    "lieu_sang": "1 viên",
                    "lieu_trua": "1 viên",
                    "lieu_chieu": "1 viên",
                    "lieu_toi": "0 viên",
                    "cach_dung": "Uống sau ăn",
                    "so_ngay_dung": 5,
                }
            ],
        },
        headers=booking.tokens["bs_x"],
    )
    assert rx_res.status_code == 201

    service = DichVu(
        ma_dich_vu=f"XQ-E2E-{booking.suffix}",
        ten_dich_vu="Chụp X-quang ngực thẳng",
        ma_nhom_byt="CDHA",
        don_gia=120000,
    )
    db_session.add(service)
    await db_session.flush()
    cls_order = ChiDinh(
        luot_kham_id=encounter_id,
        dich_vu_id=service.id,
        don_gia_tai_thoi_diem=120000,
        trang_thai="da_duyet",
        ket_qua_chi_tiet="Hình tim phổi bình thường, không tràn dịch màng phổi",
        ket_qua_phan_loai="BINH_THUONG",
        thoi_gian_tra_ket_qua=now,
        tri_so_chi_tiet={"Chỉ số tim ngực": {"gia_tri": "0.46", "khoang_tham_chieu": "< 0.50"}},
        file_dinh_kem_urls=["https://cdn.clinic.test/cls/xray-chest-e2e.png"],
    )
    db_session.add(cls_order)

    invoice = HoaDon(
        ma_hoa_don=f"HD-E2E-{booking.suffix}",
        luot_kham_id=encounter_id,
        benh_nhan_id=booking.bn_a.id,
        tong_tien=270000,
        mien_giam=0,
        so_tien_phai_thu=270000,
        thuc_thu=270000,
        trang_thai="da_thu",
        ngay_thanh_toan=now,
    )
    db_session.add(invoice)
    await db_session.commit()

    records_res = await api_client.get(
        "/api/v1/patient/medical-records", headers=booking.tokens["bn_a"]
    )
    assert records_res.status_code == 200
    records = records_res.json()["data"]
    assert any(
        r["luot_kham_id"] == encounter_id and r["chan_doan_chinh"] == "Viêm họng cấp"
        for r in records
    )

    labs_res = await api_client.get(
        "/api/v1/patient/lab-results", headers=booking.tokens["bn_a"]
    )
    assert labs_res.status_code == 200
    labs = labs_res.json()["data"]
    lab = next(item for item in labs if item["luot_kham_id"] == encounter_id)
    assert lab["chi_tiet"][0]["ten_chi_so"] == "Chỉ số tim ngực"
    assert lab["tep_dinh_kem"][0]["loai_tep"] == "HINH_ANH"
    assert lab["tep_dinh_kem"][0]["url"].endswith("xray-chest-e2e.png")

    rxs_res = await api_client.get(
        "/api/v1/patient/prescriptions", headers=booking.tokens["bn_a"]
    )
    assert rxs_res.status_code == 200
    rxs = rxs_res.json()["data"]
    rx = next(item for item in rxs if item["luot_kham_id"] == encounter_id)
    med = rx["danh_sach_thuoc"][0]
    assert med["ten_thuoc"] == "Amoxicillin 500mg"
    assert [med[k] for k in ("lieu_sang", "lieu_trua", "lieu_chieu", "lieu_toi")] == [
        "1 viên",
        "1 viên",
        "1 viên",
        "0 viên",
    ]

    inv_res = await api_client.get(
        "/api/v1/patient/invoices", headers=booking.tokens["bn_a"]
    )
    assert inv_res.status_code == 200
    invoices = inv_res.json()["data"]
    paid = next(item for item in invoices if item["luot_kham_id"] == encounter_id)
    assert paid["trang_thai"] == "da_thu"
    assert paid["so_tien_phai_thu"] == 270000.0
    assert paid["thuc_thu"] == 270000.0


@pytest.mark.asyncio
async def test_step4_idor_protection_blocks_other_patient_access_and_mutations(
    api_client, booking, db_session
):
    future_dt = datetime.now(timezone.utc) + timedelta(days=3)
    appt_a = await booking.tao_lich(booking.bn_a, booking.bs_x, future_dt)

    enc_res = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": appt_a.id, "ly_do_vao_kham": "Khám định kỳ"},
        headers=booking.tokens["bs_x"],
    )
    assert enc_res.status_code == 201
    encounter_a_id = enc_res.json()["data"]["id"]

    fam_res = await api_client.post(
        "/api/v1/patient/family-members",
        json={"ho_ten": "Bé An", "quan_he": "CON", "ngay_sinh": "2018-06-01", "gioi_tinh": "Nam"},
        headers=booking.tokens["bn_a"],
    )
    assert fam_res.status_code == 201
    member_a_id = fam_res.json()["data"]["id"]

    cancel_idor = await api_client.post(
        f"/api/v1/appointments/{appt_a.id}/cancel",
        json={"ly_do_huy": "IDOR attempt"},
        headers=booking.tokens["bn_b"],
    )
    assert cancel_idor.status_code in (403, 404)

    reschedule_idor = await api_client.post(
        f"/api/v1/appointments/{appt_a.id}/reschedule",
        json={
            "ngay_kham_moi": (date.today() + timedelta(days=4)).isoformat(),
            "gio_kham_moi": "09:00:00",
        },
        headers=booking.tokens["bn_b"],
    )
    assert reschedule_idor.status_code in (403, 404)

    feedback_idor = await api_client.post(
        "/api/v1/patient/feedback",
        json={
            "luot_kham_id": encounter_a_id,
            "so_sao_bac_si": 1,
            "so_sao_phong_kham": 1,
            "nhan_xet": "IDOR feedback",
        },
        headers=booking.tokens["bn_b"],
    )
    assert feedback_idor.status_code in (403, 404)

    fam_put_idor = await api_client.put(
        f"/api/v1/patient/family-members/{member_a_id}",
        json={"ho_ten": "Hacked"},
        headers=booking.tokens["bn_b"],
    )
    assert fam_put_idor.status_code in (403, 404)

    fam_del_idor = await api_client.delete(
        f"/api/v1/patient/family-members/{member_a_id}",
        headers=booking.tokens["bn_b"],
    )
    assert fam_del_idor.status_code in (403, 404)

    for ep in (
        "/api/v1/appointments/my-appointments",
        "/api/v1/patient/medical-records",
        "/api/v1/patient/prescriptions",
        "/api/v1/patient/lab-results",
        "/api/v1/patient/invoices",
        "/api/v1/patient/family-members",
    ):
        res = await api_client.get(ep, headers=booking.tokens["bn_b"])
        assert res.status_code == 200
        assert res.json()["data"] == []


@pytest.mark.asyncio
async def test_patient_portal_auto_links_missing_benh_nhan_record(
    api_client, booking, db_session
):
    orphan_nd = NguoiDung(
        ho_ten="Bệnh nhân chưa có BenhNhan",
        email=f"orphan.{booking.suffix}@clinic-ai.test",
        so_dien_thoai=f"097{booking.suffix[:7]}",
    )
    db_session.add(orphan_nd)
    await db_session.flush()
    orphan_tk = TaiKhoan(
        nguoi_dung_id=orphan_nd.id,
        email=orphan_nd.email,
        mat_khau_hash=hash_password("Demo@12345678"),
        vai_tro=VaiTroEnum.BENH_NHAN.value,
        is_active=True,
    )
    db_session.add(orphan_tk)
    await db_session.commit()

    token = {
        "Authorization": f"Bearer {create_access_token(subject=orphan_tk.id, role=VaiTroEnum.BENH_NHAN.value)}"
    }
    res = await api_client.get("/api/v1/patient/profile", headers=token)
    assert res.status_code == 200
    assert res.json()["data"]["ma_dinh_danh_y_te"] == f"BN-{orphan_nd.id:06d}"
