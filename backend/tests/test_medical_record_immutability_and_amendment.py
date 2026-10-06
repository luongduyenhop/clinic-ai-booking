import pytest
from datetime import datetime, timezone
from sqlalchemy import select
from app.models.medical import DichVu, KhaiNiem, BienBanDinhChinh, LuotKham
from app.models.user import VaiTroEnum
from tests.test_clinical_skeleton import _dam_bao_ma_icd10


@pytest.mark.asyncio
async def test_locked_encounter_rejects_all_direct_writes(api_client, booking, db_session):
    """
    Bất biến 1: Khi ca khám đã khóa (complete_encounter), mọi thao tác ghi trực tiếp:
    - Thêm chẩn đoán (add_diagnosis)
    - Kê chỉ định cận lâm sàng (add_order)
    - Kê đơn thuốc (create_prescription)
    đều phải bị từ chối bằng HTTP 409 Conflict với thông điệp rõ ràng.
    """
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    await _dam_bao_ma_icd10(db_session, "K29.7", "Viêm dạ dày, không đặc hiệu")

    # Bác sĩ tiếp nhận ca khám
    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Đau thượng vị"},
        headers=token_bs
    )
    assert res_start.status_code == 201
    enc_id = res_start.json()["data"]["id"]

    # Thêm 1 chẩn đoán trước khi khóa
    res_diag = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "K29.7", "ten_benh_chan_doan": "Viêm dạ dày, không đặc hiệu", "loai_chan_doan": "chinh"},
        headers=token_bs
    )
    assert res_diag.status_code == 201

    # Hoàn tất ca khám -> KHÓA VĨNH VIỄN
    res_complete = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Điều trị ngoại trú 1 tuần", "loi_dan_bac_si": "Tránh đồ cay nóng"},
        headers=token_bs
    )
    assert res_complete.status_code == 200
    assert res_complete.json()["data"]["is_locked"] is True
    assert res_complete.json()["data"]["nguoi_khoa_id"] == booking.bs_x.nguoi_dung_id

    # 1. Thử thêm chẩn đoán sau khi khóa -> 409
    await _dam_bao_ma_icd10(db_session, "K21.9", "Trào ngược dạ dày")
    res_fail_diag = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "K21.9", "ten_benh_chan_doan": "Trào ngược dạ dày", "loai_chan_doan": "phu"},
        headers=token_bs
    )
    assert res_fail_diag.status_code == 409
    assert "bị khóa" in res_fail_diag.json()["message"]

    # 2. Thử kê chỉ định dịch vụ sau khi khóa -> 409
    dv = DichVu(ma_dich_vu=f"DV-TEST-{booking.suffix}", ten_dich_vu="Nội soi dạ dày", don_gia=600000, don_vi_tinh="Lần", is_active=True)
    db_session.add(dv)
    await db_session.flush()

    res_fail_order = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/orders",
        json={"dich_vu_id": dv.id, "so_luong": 1},
        headers=token_bs
    )
    assert res_fail_order.status_code == 409
    assert "bị khóa" in res_fail_order.json()["message"]

    # 3. Thử kê đơn thuốc sau khi khóa -> 409
    res_fail_rx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        json={
            "danh_sach_thuoc": [{
                "ten_thuoc": "Nexium",
                "hoat_chat": "Esomeprazole",
                "ham_luong": "40mg",
                "don_vi_tinh": "Viên",
                "so_luong": 14,
                "cach_dung": "Uống 1 viên trước ăn sáng",
                "so_ngay_dung": 14
            }]
        },
        headers=token_bs
    )
    assert res_fail_rx.status_code == 409
    assert "bị khóa" in res_fail_rx.json()["message"]


@pytest.mark.asyncio
async def test_amendment_request_lifecycle_and_four_eyes_principle(api_client, booking, db_session):
    """
    Bất biến 2 & 3: 
    - Chỉ được tạo đính chính khi hồ sơ đã khóa.
    - Four-Eyes Principle: Bác sĩ điều trị không được tự phê duyệt đính chính do mình tạo ra (409 Conflict).
    - Người khác (Admin / Trưởng khoa) duyệt thành công -> DA_PHE_DUYET.
    """
    token_bs = booking.tokens["bs_x"]
    token_admin = booking.tokens["admin"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    await _dam_bao_ma_icd10(db_session, "K29.7", "Viêm dạ dày, không đặc hiệu")

    # Mở ca khám
    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Đau dạ dày"},
        headers=token_bs
    )
    enc_id = res_start.json()["data"]["id"]

    # Thêm chẩn đoán
    res_diag = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "K29.7", "ten_benh_chan_doan": "Viêm dạ dày, không đặc hiệu"},
        headers=token_bs
    )
    diag_id = res_diag.json()["data"]["id"]

    # 1. Thử tạo đính chính khi ca khám CHƯA KHÓA -> 409 Conflict
    res_fail_early = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/amendments",
        json={
            "thuc_the_loai": "CHAN_DOAN",
            "thuc_the_id": diag_id,
            "ly_do_ma": "SAI_CHAN_DOAN",
            "ly_do_text": "Bổ sung chẩn đoán trào ngược",
            "noi_dung_moi_json": {"ma_icd10": "K21.9", "ten_benh": "Trào ngược dạ dày"}
        },
        headers=token_bs
    )
    assert res_fail_early.status_code == 409
    assert "đã hoàn tất và khóa" in res_fail_early.json()["message"]

    # Khóa ca khám
    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Khám xong"},
        headers=token_bs
    )

    # 2. Tạo đính chính sau khi đã khóa -> 201 Thành công
    res_create_amend = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/amendments",
        json={
            "thuc_the_loai": "CHAN_DOAN",
            "thuc_the_id": diag_id,
            "ly_do_ma": "THIEU_CHAN_DOAN_PHU",
            "ly_do_text": "Phát hiện triệu chứng trào ngược dạ dày sau khi hỏi kỹ bệnh sử",
            "noi_dung_moi_json": {"ma_icd10": "K21.9", "ten_benh": "Trào ngược dạ dày thực quản", "loai": "phu"}
        },
        headers=token_bs
    )
    assert res_create_amend.status_code == 201
    amend_data = res_create_amend.json()["data"]
    amend_id = amend_data["id"]
    assert amend_data["trang_thai"] == "CHO_PHE_DUYET"
    assert amend_data["requested_by_id"] == booking.bs_x.nguoi_dung_id

    # 3. Four-Eyes Principle: Chính bác sĩ tạo yêu cầu tự bấm Duyệt -> 409 Conflict
    res_self_approve = await api_client.post(
        f"/api/v1/clinical/amendments/{amend_id}/approve",
        json={"ghi_chu": "Tôi tự duyệt cho mình"},
        headers=token_bs
    )
    assert res_self_approve.status_code == 409
    assert "Four-Eyes Principle" in res_self_approve.json()["message"]

    # 4. Người thứ hai (Admin / Trưởng khoa) phê duyệt -> 200 Thành công
    res_approved = await api_client.post(
        f"/api/v1/clinical/amendments/{amend_id}/approve",
        json={"ghi_chu": "Đồng ý bổ sung chẩn đoán phụ theo đề xuất bác sĩ"},
        headers=token_admin
    )
    assert res_approved.status_code == 200
    approved_data = res_approved.json()["data"]
    assert approved_data["trang_thai"] == "DA_PHE_DUYET"
    assert approved_data["approved_by_id"] is not None
    assert approved_data["approved_by_id"] != booking.bs_x.nguoi_dung_id
    assert approved_data["approved_at"] is not None

    # 5. Tra cứu danh sách đính chính của ca khám
    res_list = await api_client.get(
        f"/api/v1/clinical/encounters/{enc_id}/amendments",
        headers=token_bs
    )
    assert res_list.status_code == 200
    items = res_list.json()["data"]
    assert len(items) == 1
    assert items[0]["id"] == amend_id
    assert items[0]["trang_thai"] == "DA_PHE_DUYET"


@pytest.mark.asyncio
async def test_database_check_constraint_prevents_self_approval(db_session, booking):
    """
    Bảo vệ chiều sâu (Defense-in-depth):
    Kiểm tra ràng buộc CSDL 'ck_bien_ban_dinh_chinh_no_self_approval'
    từ chối bản ghi nếu approved_by_id == requested_by_id ngay cả khi gọi trực tiếp ở tầng SQL/ORM.
    """
    from sqlalchemy.exc import IntegrityError

    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, datetime.now(timezone.utc))
    luot_kham = LuotKham(
        lich_kham_id=lich.id,
        bac_si_id=booking.bs_x.id,
        benh_nhan_id=booking.bn_a.id,
        thoi_gian_bat_dau=datetime.now(timezone.utc),
        is_locked=True
    )
    db_session.add(luot_kham)
    await db_session.flush()

    illegal_amendment = BienBanDinhChinh(
        luot_kham_id=luot_kham.id,
        thuc_the_loai="CHAN_DOAN",
        thuc_the_id=1,
        ly_do_text="Tự duyệt lậu qua SQL",
        noi_dung_moi_json={"test": 123},
        requested_by_id=booking.bs_x.nguoi_dung_id,
        approved_by_id=booking.bs_x.nguoi_dung_id,  # Vi phạm: approved_by == requested_by
        trang_thai="DA_PHE_DUYET"
    )
    db_session.add(illegal_amendment)
    with pytest.raises(IntegrityError) as exc_info:
        await db_session.flush()
    assert "ck_bien_ban_dinh_chinh_no_self_approval" in str(exc_info.value)
    await db_session.rollback()


@pytest.mark.asyncio
async def test_amendment_rejection_flow(api_client, booking, db_session):
    """
    Kiểm tra luồng từ chối đính chính (TU_CHOI) khi trưởng khoa/admin không đồng thuận.
    """
    token_bs = booking.tokens["bs_x"]
    token_admin = booking.tokens["admin"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Đau bụng"},
        headers=token_bs
    )
    enc_id = res_start.json()["data"]["id"]

    await _dam_bao_ma_icd10(db_session, "R10.4", "Đau bụng không đặc hiệu")
    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "R10.4", "ten_benh_chan_doan": "Đau bụng không đặc hiệu", "loai_chan_doan": "chinh"},
        headers=token_bs
    )

    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Xong ca"},
        headers=token_bs
    )

    res_create = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/amendments",
        json={
            "thuc_the_loai": "KET_LUAN",
            "thuc_the_id": enc_id,
            "ly_do_text": "Yêu cầu thay đổi kết luận điều trị",
            "noi_dung_moi_json": {"ket_luan_moi": "Cần nhập viện khẩn"}
        },
        headers=token_bs
    )
    amend_id = res_create.json()["data"]["id"]

    # Admin từ chối
    res_reject = await api_client.post(
        f"/api/v1/clinical/amendments/{amend_id}/reject",
        json={"ghi_chu": "Chưa đủ cơ sở cận lâm sàng để kết luận nhập viện"},
        headers=token_admin
    )
    assert res_reject.status_code == 200
    reject_data = res_reject.json()["data"]
    assert reject_data["trang_thai"] == "TU_CHOI"
    assert "Chưa đủ cơ sở" in reject_data["ghi_chu"]

