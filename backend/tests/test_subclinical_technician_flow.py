import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, select
from app.models.medical import ChiDinh, DichVu, LuotKham
from app.models.user import VaiTroEnum
from app.services.cls_service_group import CLINIC_TZ, nhom_dich_vu_of


@pytest.mark.asyncio
async def test_subclinical_queue_start_and_submit_result_flow(api_client, booking, db_session):
    """
    Kiểm tra luồng kỹ thuật viên cận lâm sàng:
    1. Bác sĩ kê chỉ định
    2. Kỹ thuật viên xem hàng đợi CLS
    3. Tiếp nhận thực hiện (chuyển dang_thuc_hien)
    4. Nhập kết quả kèm trị số chi tiết và phân loại (chuyển da_co_ket_qua)
    """
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    # 1. Bác sĩ mở ca khám
    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Sốt kéo dài"},
        headers=token_bs
    )
    enc_id = res_start.json()["data"]["id"]

    # 2. Tạo dịch vụ xét nghiệm máu
    dv = DichVu(
        ma_dich_vu=f"XN-CTM-{booking.suffix}",
        ten_dich_vu="Tổng phân tích tế bào máu ngoại vi",
        don_gia=120000.00,
        don_vi_tinh="Lần",
        is_active=True
    )
    db_session.add(dv)
    await db_session.flush()

    res_order = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/orders",
        json={"dich_vu_id": dv.id, "so_luong": 1},
        headers=token_bs
    )
    assert res_order.status_code == 201
    order_id = res_order.json()["data"]["id"]

    # 3. Kỹ thuật viên xem hàng đợi CLS
    res_q = await api_client.get(
        "/api/v1/subclinical/queue",
        headers=token_admin
    )
    assert res_q.status_code == 200
    q_items = res_q.json()["data"]["items"]
    assert any(it["id"] == order_id for it in q_items)

    # 4. Kỹ thuật viên tiếp nhận mẫu
    res_take = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/start",
        headers=token_admin
    )
    assert res_take.status_code == 200
    assert res_take.json()["data"]["trang_thai"] == "dang_thuc_hien"

    # 5. Kỹ thuật viên nhập kết quả
    tri_so = {
        "WBC": {"value": 11.5, "unit": "G/L", "ref": "4.0 - 10.0", "flag": "HIGH"},
        "RBC": {"value": 4.8, "unit": "T/L", "ref": "3.8 - 5.5", "flag": "NORMAL"},
        "PLT": {"value": 250, "unit": "G/L", "ref": "150 - 450", "flag": "NORMAL"},
    }
    res_result = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/results",
        json={
            "ket_qua_chi_tiet": "Bạch cầu tăng nhẹ, hướng nhiễm khuẩn cấp",
            "ket_qua_phan_loai": "BAT_THUONG",
            "tri_so_chi_tiet": tri_so,
            "file_dinh_kem_urls": ["https://cdn.clinic-ai.local/lab/ctm-001.pdf"]
        },
        headers=token_admin
    )
    assert res_result.status_code == 200
    res_data = res_result.json()["data"]
    assert res_data["trang_thai"] == "da_co_ket_qua"
    assert res_data["ket_qua_phan_loai"] == "BAT_THUONG"
    assert res_data["tri_so_chi_tiet"]["WBC"]["flag"] == "HIGH"
    assert res_data["thoi_gian_tra_ket_qua"] is not None


@pytest.mark.asyncio
async def test_subclinical_cancel_and_reject_modifying_cancelled(api_client, booking, db_session):
    """
    Kiểm tra hủy chỉ định CLS và chặn ghi kết quả lên chỉ định đã hủy
    """
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_b, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Đau khớp gối"},
        headers=token_bs
    )
    enc_id = res_start.json()["data"]["id"]

    dv = DichVu(
        ma_dich_vu=f"CDHA-XQ-{booking.suffix}",
        ten_dich_vu="X-Quang khớp gối thẳng nghiêng",
        don_gia=180000.00,
        don_vi_tinh="Lần",
        is_active=True
    )
    db_session.add(dv)
    await db_session.flush()

    res_order = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/orders",
        json={"dich_vu_id": dv.id, "so_luong": 1},
        headers=token_bs
    )
    order_id = res_order.json()["data"]["id"]

    # Hủy chỉ định
    res_cancel = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/cancel?ly_do=Bệnh_nhân_từ_chối_chụp",
        headers=token_admin
    )
    assert res_cancel.status_code == 200
    assert res_cancel.json()["data"]["trang_thai"] == "da_huy"

    # Thử nhập kết quả vào chỉ định đã hủy -> 409 Conflict
    res_fail = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/results",
        json={"ket_qua_chi_tiet": "Hình ảnh bình thường"},
        headers=token_admin
    )
    assert res_fail.status_code == 409


# ==============================================================================
# PJ2026-140 — Bàn làm việc tiếp nhận ca chỉ định CLS (nhóm dịch vụ, lọc, phân quyền, cầu nối bàn khám)
# ==============================================================================

def test_nhom_dich_vu_suy_ra_tu_ma_nhom_byt():
    assert nhom_dich_vu_of("XN") == "XET_NGHIEM"
    assert nhom_dich_vu_of("xet_nghiem") == "XET_NGHIEM"
    assert nhom_dich_vu_of("CDHA") == "CDHA"
    assert nhom_dich_vu_of("SA") == "CDHA"
    assert nhom_dich_vu_of("TDCN") == "TDCN"
    assert nhom_dich_vu_of("NS") == "NOI_SOI"
    # Seed cũ xếp nội soi chung nhóm thủ thuật TT
    assert nhom_dich_vu_of("TT", "DV_NS_TMH") == "NOI_SOI"
    assert nhom_dich_vu_of("TT", "DV_CAO_RANG") is None
    assert nhom_dich_vu_of("KHAM", "DV_KHAM_NOI") is None
    assert nhom_dich_vu_of(None) is None


async def _tao_dich_vu_cls(db_session, suffix):
    xn = DichVu(ma_dich_vu=f"XN-T140-{suffix}", ten_dich_vu="Công thức máu T140", don_gia=120000, ma_nhom_byt="XN")
    sa = DichVu(ma_dich_vu=f"SA-T140-{suffix}", ten_dich_vu="Siêu âm ổ bụng T140", don_gia=200000, ma_nhom_byt="CDHA")
    ns = DichVu(ma_dich_vu=f"DV_NS_T140_{suffix}", ten_dich_vu="Nội soi TMH T140", don_gia=250000, ma_nhom_byt="TT")
    db_session.add_all([xn, sa, ns])
    await db_session.flush()
    return xn, sa, ns


def _queue_ids(res):
    assert res.status_code == 200, res.text
    return [it["id"] for it in res.json()["data"]["items"]]


@pytest.mark.asyncio
async def test_queue_loc_theo_nhom_ngay_tu_khoa_va_ktv_bat_dau(api_client, booking, db_session):
    await booking.tao_tai_khoan("ktv", VaiTroEnum.KY_THUAT_VIEN.value)
    token_ktv = booking.tokens["ktv"]
    token_bs = booking.tokens["bs_x"]
    xn, sa, ns = await _tao_dich_vu_cls(db_session, booking.suffix)

    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, datetime.now(timezone.utc))
    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Đau bụng", "chan_doan_so_bo": "Theo dõi viêm dạ dày"},
        headers=token_bs,
    )
    enc_id = res_enc.json()["data"]["id"]
    order_ids = {}
    for dv in (xn, sa, ns):
        res = await api_client.post(
            f"/api/v1/clinical/encounters/{enc_id}/orders", json={"dich_vu_id": dv.id, "so_luong": 1}, headers=token_bs
        )
        assert res.status_code == 201
        order_ids[dv.id] = res.json()["data"]["id"]

    ma_bn = booking.bn_a.ma_dinh_danh_y_te
    queue = "/api/v1/subclinical/queue"

    # Lọc theo nhóm: mỗi ca nằm đúng 1 tab
    ids_xn = _queue_ids(await api_client.get(queue, params={"nhom_dich_vu": "XET_NGHIEM", "tu_khoa": ma_bn}, headers=token_ktv))
    ids_cdha = _queue_ids(await api_client.get(queue, params={"nhom_dich_vu": "CDHA", "tu_khoa": ma_bn}, headers=token_ktv))
    ids_ns = _queue_ids(await api_client.get(queue, params={"nhom_dich_vu": "NOI_SOI", "tu_khoa": ma_bn}, headers=token_ktv))
    assert ids_xn == [order_ids[xn.id]]
    assert ids_cdha == [order_ids[sa.id]]
    assert ids_ns == [order_ids[ns.id]]

    # Tìm theo tên bệnh nhân, ca chỉ định sớm nhất lên trước, có bác sĩ chỉ định & chẩn đoán sơ bộ
    res_name = await api_client.get(queue, params={"tu_khoa": f"bn_a {booking.suffix}"}, headers=token_ktv)
    items = res_name.json()["data"]["items"]
    assert [it["id"] for it in items] == [order_ids[xn.id], order_ids[sa.id], order_ids[ns.id]]
    first = items[0]
    assert first["nhom_dich_vu"] == "XET_NGHIEM"
    assert first["ten_dich_vu"] == "Công thức máu T140"
    assert first["bac_si_chi_dinh"] == f"Test bs_x {booking.suffix}"
    assert first["chan_doan_so_bo"] == "Theo dõi viêm dạ dày"
    assert first["ly_do_vao_kham"] == "Đau bụng"
    assert first["benh_nhan"]["mabn"] == ma_bn
    assert first["thoi_gian_cho_phut"] >= 0

    # Từ khóa không khớp hoặc ngày khác hôm nay -> không có ca nào của bệnh nhân này
    assert _queue_ids(await api_client.get(queue, params={"tu_khoa": f"khong-co-{booking.suffix}"}, headers=token_ktv)) == []
    hom_qua = (datetime.now(CLINIC_TZ).date() - timedelta(days=1)).isoformat()
    assert _queue_ids(await api_client.get(queue, params={"ngay": hom_qua, "tu_khoa": ma_bn}, headers=token_ktv)) == []

    # KTV bắt đầu ca xét nghiệm -> dang_thuc_hien được lưu, vẫn nằm trong hàng đợi mặc định
    res_start = await api_client.post(f"/api/v1/subclinical/orders/{order_ids[xn.id]}/start", headers=token_ktv)
    assert res_start.status_code == 200
    assert res_start.json()["data"]["trang_thai"] == "dang_thuc_hien"
    res_dang = await api_client.get(queue, params={"trang_thai": "dang_thuc_hien", "tu_khoa": ma_bn}, headers=token_ktv)
    assert _queue_ids(res_dang) == [order_ids[xn.id]]
    assert len(_queue_ids(await api_client.get(queue, params={"tu_khoa": ma_bn}, headers=token_ktv))) == 3


@pytest.mark.asyncio
async def test_phan_quyen_ban_lam_viec_cls(api_client, booking, db_session):
    await booking.tao_tai_khoan("le_tan", VaiTroEnum.LE_TAN.value)
    await booking.tao_tai_khoan("ktv", VaiTroEnum.KY_THUAT_VIEN.value)
    xn, _, _ = await _tao_dich_vu_cls(db_session, booking.suffix)

    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, datetime.now(timezone.utc))
    res_enc = await api_client.post(
        "/api/v1/clinical/encounters", json={"lich_kham_id": lich.id}, headers=booking.tokens["bs_x"]
    )
    enc_id = res_enc.json()["data"]["id"]
    res_order = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/orders", json={"dich_vu_id": xn.id}, headers=booking.tokens["bs_x"]
    )
    order_id = res_order.json()["data"]["id"]

    for key in ("bn_a", "le_tan"):
        headers = booking.tokens[key]
        assert (await api_client.get("/api/v1/subclinical/queue", headers=headers)).status_code == 403
        assert (await api_client.post(f"/api/v1/subclinical/orders/{order_id}/start", headers=headers)).status_code == 403
        assert (await api_client.post(f"/api/v1/subclinical/orders/{order_id}/cancel", headers=headers)).status_code == 403

    # Chưa đăng nhập -> 401/403, nhóm không hợp lệ -> 422
    assert (await api_client.get("/api/v1/subclinical/queue")).status_code in (401, 403)
    res_bad = await api_client.get(
        "/api/v1/subclinical/queue", params={"nhom_dich_vu": "KHAM"}, headers=booking.tokens["ktv"]
    )
    assert res_bad.status_code == 422

    # Bác sĩ được hủy chỉ định chưa thực hiện
    res_cancel = await api_client.post(f"/api/v1/subclinical/orders/{order_id}/cancel", headers=booking.tokens["bs_x"])
    assert res_cancel.status_code == 200
    assert res_cancel.json()["data"]["trang_thai"] == "da_huy"


@pytest.mark.asyncio
async def test_chi_dinh_tu_ban_kham_workspace_ghi_vao_chi_dinh_va_ktv_thay(api_client, booking, db_session):
    await booking.tao_tai_khoan("ktv", VaiTroEnum.KY_THUAT_VIEN.value)
    token_ktv = booking.tokens["ktv"]
    token_bs = booking.tokens["bs_x"]
    xn, sa, _ = await _tao_dich_vu_cls(db_session, booking.suffix)

    ma_bn = f"WS-TEST-{booking.suffix}"
    body = {
        "workspace_encounter_id": f"6001-{booking.suffix}",
        "benh_nhan": {"ma": ma_bn, "ho_ten": "Nguyễn Văn Bàn Khám", "gioi_tinh": "Nam", "tuoi": 40, "di_ung_thuoc": "Penicillin"},
        "ly_do_vao_kham": "Sốt 3 ngày",
        "chan_doan_so_bo": "J06 - Nhiễm trùng hô hấp trên",
        "dich_vu_ids": [xn.id, sa.id],
    }

    # Danh mục dịch vụ trả về nhóm CLS để bàn khám xếp đúng mục
    res_catalog = await api_client.get("/api/v1/medical/services")
    catalog = {s["id"]: s for s in res_catalog.json()["data"]}
    assert catalog[xn.id]["nhom_dich_vu"] == "XET_NGHIEM"
    assert catalog[sa.id]["nhom_dich_vu"] == "CDHA"

    res = await api_client.post("/api/v1/subclinical/workspace-orders", json=body, headers=token_bs)
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    assert [o["dich_vu_id"] for o in data["orders"]] == [xn.id, sa.id]
    assert [o["nhom_dich_vu"] for o in data["orders"]] == ["XET_NGHIEM", "CDHA"]
    assert all(o["trang_thai"] == "da_chi_dinh" for o in data["orders"])

    # Gửi lại (bàn khám đồng bộ lại) không tạo trùng lượt khám hay chỉ định
    res_again = await api_client.post("/api/v1/subclinical/workspace-orders", json=body, headers=token_bs)
    assert res_again.status_code == 201
    assert res_again.json()["data"] == data

    luot_kham = await db_session.get(LuotKham, data["luot_kham_id"])
    assert luot_kham.bac_si_id == booking.bs_x.id
    assert luot_kham.chan_doan_so_bo == "J06 - Nhiễm trùng hô hấp trên"
    so_chi_dinh = (
        await db_session.execute(select(func.count()).select_from(ChiDinh).where(ChiDinh.luot_kham_id == luot_kham.id))
    ).scalar_one()
    assert so_chi_dinh == 2

    # KTV thấy đúng 1 ca ở tab Xét nghiệm và 1 ca ở tab CĐHA
    queue = "/api/v1/subclinical/queue"
    res_xn = await api_client.get(queue, params={"nhom_dich_vu": "XET_NGHIEM", "tu_khoa": ma_bn}, headers=token_ktv)
    res_cdha = await api_client.get(queue, params={"nhom_dich_vu": "CDHA", "tu_khoa": ma_bn}, headers=token_ktv)
    items_xn = res_xn.json()["data"]["items"]
    assert [it["id"] for it in items_xn] == [data["orders"][0]["id"]]
    assert _queue_ids(res_cdha) == [data["orders"][1]["id"]]
    assert items_xn[0]["benh_nhan"]["ho_ten"] == "Nguyễn Văn Bàn Khám"
    assert items_xn[0]["benh_nhan"]["di_ung_thuoc"] == "Penicillin"
    assert items_xn[0]["bac_si_chi_dinh"] == f"Test bs_x {booking.suffix}"

    # KTV bắt đầu -> trạng thái lưu trong chi_dinh
    order_xn = data["orders"][0]["id"]
    res_start = await api_client.post(f"/api/v1/subclinical/orders/{order_xn}/start", headers=token_ktv)
    assert res_start.status_code == 200
    chi_dinh = await db_session.get(ChiDinh, order_xn)
    await db_session.refresh(chi_dinh)
    assert chi_dinh.trang_thai == "dang_thuc_hien"
    assert chi_dinh.ky_thuat_vien_id is not None

    # Mã bệnh nhân đã thuộc người khác -> 409; KTV/bệnh nhân không được tạo chỉ định -> 403
    body_conflict = {**body, "benh_nhan": {**body["benh_nhan"], "ho_ten": "Người Khác"}}
    res_conflict = await api_client.post("/api/v1/subclinical/workspace-orders", json=body_conflict, headers=token_bs)
    assert res_conflict.status_code == 409
    for key in ("ktv", "bn_a"):
        res_forbidden = await api_client.post("/api/v1/subclinical/workspace-orders", json=body, headers=booking.tokens[key])
        assert res_forbidden.status_code == 403

    # Dịch vụ không tồn tại -> 404
    res_missing = await api_client.post(
        "/api/v1/subclinical/workspace-orders", json={**body, "dich_vu_ids": [999999999]}, headers=token_bs
    )
    assert res_missing.status_code == 404


@pytest.mark.asyncio
async def test_workspace_state_khong_ghi_lai_chi_dinh_da_co_tren_server(api_client, booking, db_session):
    xn, _, _ = await _tao_dich_vu_cls(db_session, booking.suffix)
    payload = {
        "encounters": {
            "6001": {
                "id": 6001,
                "danh_sach_chi_dinh": [
                    {"id": 9501, "dich_vu_id": xn.id, "ma_dich_vu": xn.ma_dich_vu, "trang_thai": "da_chi_dinh", "server_order_id": 123}
                ],
            }
        },
        "queue": [],
    }
    res = await api_client.put("/api/v1/clinical/workspace-state", json=payload, headers=booking.tokens["bs_x"])
    assert res.status_code == 200
    so_chi_dinh = (
        await db_session.execute(select(func.count()).select_from(ChiDinh).where(ChiDinh.dich_vu_id == xn.id))
    ).scalar_one()
    assert so_chi_dinh == 0
