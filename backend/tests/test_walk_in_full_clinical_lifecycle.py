import pytest
from sqlalchemy import select
from app.models.appointment import HangDoiKham, TrangThaiHangDoiEnum, TrangThaiLichEnum, LichKham
from app.schemas.queue import WalkInQuickRequest
from tests.test_clinical_skeleton import _dam_bao_ma_icd10


@pytest.mark.asyncio
async def test_walk_in_patient_full_clinical_lifecycle(api_client, booking, db_session):
    """
    Gói 2: Bệnh nhân vãng lai bốc số tại quầy -> có lịch tại chỗ -> Bác sĩ gọi số
    -> Mở bệnh án EMR -> Chẩn đoán ICD-10 -> Kê đơn -> Hoàn tất & Khóa bệnh án thành công.
    """
    token_letan = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]

    # 1. Lễ tân tiếp nhận nhanh bệnh nhân vãng lai
    req = WalkInQuickRequest(
        ho_ten="Võ Văn Vãng Lai",
        so_dien_thoai="0911223344",
        gioi_tinh="Nam",
        bac_si_id=booking.bs_x.id,
        ca_lam_viec="sang",
        ly_do_kham="Đau họng sốt cao",
    )
    res_walkin = await api_client.post("/api/v1/reception/walk-in-quick", json=req.model_dump(), headers=token_letan)
    assert res_walkin.status_code == 201
    ticket_data = res_walkin.json()["data"]
    ticket_id = ticket_data["id"]
    lich_id = ticket_data["lich_kham_id"]

    # Ràng buộc Gói 2: Phải sinh LichKham tại chỗ, không được để None
    assert lich_id is not None
    assert ticket_data["loai_hang_doi"] == "vang_lai"
    assert ticket_data["muc_do_uu_tien"] == 5

    # Kiểm tra LichKham tại chỗ trong DB
    lich_db = (await db_session.execute(select(LichKham).where(LichKham.id == lich_id))).scalar_one()
    assert lich_db.trang_thai == TrangThaiLichEnum.DA_TIEP_NHAN.value
    assert "WLK" in lich_db.ma_lich_kham

    # 2. Bác sĩ gọi số vào phòng khám
    res_call = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res_call.status_code == 200
    assert res_call.json()["data"]["ticket"]["id"] == ticket_id
    assert res_call.json()["data"]["ticket"]["trang_thai"] == TrangThaiHangDoiEnum.DANG_KHAM.value

    # 3. Bác sĩ mở ca khám thực tế (Encounter)
    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={
            "lich_kham_id": lich_id,
            "ly_do_vao_kham": "Sốt cao 38.5 độ",
            "nhiet_do_c": 38.5,
            "mach_lan_phut": 90,
        },
        headers=token_bs,
    )
    assert res_enc.status_code == 201
    enc_id = res_enc.json()["data"]["id"]

    # 4. Bác sĩ thêm chẩn đoán ICD-10
    await _dam_bao_ma_icd10(db_session, "J02.9", "Viêm họng cấp không đặc hiệu")
    res_dx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "J02.9", "ten_benh_chan_doan": "Viêm họng cấp", "loai_chan_doan": "chinh"},
        headers=token_bs,
    )
    assert res_dx.status_code in (200, 201)

    # 5. Bác sĩ kê đơn thuốc
    res_rx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        json={
            "chan_doan_kem_theo": "Theo dõi viêm amidan",
            "loi_dan": "Uống nhiều nước ấm",
            "danh_sach_thuoc": [
                {
                    "ten_thuoc": "Paracetamol 500mg",
                    "don_vi_tinh": "Viên",
                    "so_luong": 10,
                    "cach_dung": "Uống 1 viên khi sốt > 38.5C",
                }
            ],
        },
        headers=token_bs,
    )
    assert res_rx.status_code == 201

    # 6. Bác sĩ hoàn tất ca khám và khóa bệnh án vĩnh viễn (TT 32/2023)
    res_comp = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Điều trị ngoại trú, theo dõi nhiệt độ"},
        headers=token_bs,
    )
    assert res_comp.status_code == 200
    assert res_comp.json()["data"]["is_locked"] is True

    # 7. Xác minh: Vé hàng đợi đã được đồng bộ DA_KHAM kèm thoi_gian_ket_thuc (Commit 7.1b)
    db_session.expire_all()
    ticket_final = (await db_session.execute(select(HangDoiKham).where(HangDoiKham.id == ticket_id))).scalar_one()
    assert ticket_final.trang_thai == TrangThaiHangDoiEnum.DA_KHAM.value
    assert ticket_final.thoi_gian_ket_thuc is not None
