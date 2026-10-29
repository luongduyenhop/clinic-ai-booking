from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models.medical import ChiDinh, DichVu, KetQuaCLS
from app.models.user import NguoiDung, VaiTroEnum
from app.services.cls_lab_result_service import danh_gia_chi_so, phan_loai_tong_hop
from app.services.cls_lab_templates import NAM, NU, find_lab_template, normalize_gioi_tinh

# ==============================================================================
# PJ2026-141 — Nhập kết quả xét nghiệm máu & cảnh báo chỉ số vượt ngưỡng
# ==============================================================================

D = Decimal


@pytest.mark.parametrize(
    "gia_tri, expected",
    [
        ("4.0", ("BINH_THUONG", None)),  # bằng ngưỡng dưới
        ("10.0", ("BINH_THUONG", None)),  # bằng ngưỡng trên
        ("3.99", ("THAP", "THAP")),
        ("10.01", ("CAO", "CAO")),
        ("2.0", ("THAP", "THAP")),  # bằng ngưỡng nguy kịch dưới: chưa nguy hiểm
        ("1.99", ("NGUY_HIEM", "THAP")),
        ("30.0", ("CAO", "CAO")),  # bằng ngưỡng nguy kịch trên: chưa nguy hiểm
        ("30.1", ("NGUY_HIEM", "CAO")),
    ],
)
def test_danh_gia_chi_so_bien_nguong(gia_tri, expected):
    assert danh_gia_chi_so(D(gia_tri), D("4.0"), D("10.0"), D("2.0"), D("30.0")) == expected


def test_danh_gia_chi_so_chi_co_mot_dau_nguong():
    assert danh_gia_chi_so(D("5.2"), None, D("5.2")) == ("BINH_THUONG", None)
    assert danh_gia_chi_so(D("5.3"), None, D("5.2")) == ("CAO", "CAO")
    assert danh_gia_chi_so(D("0"), None, D("5.2")) == ("BINH_THUONG", None)
    assert danh_gia_chi_so(D("0.8"), D("0.9"), None) == ("THAP", "THAP")


def test_phan_loai_tong_hop_lay_muc_nang_nhat():
    assert phan_loai_tong_hop(["BINH_THUONG", "BINH_THUONG"]) == "BINH_THUONG"
    assert phan_loai_tong_hop(["BINH_THUONG", "THAP"]) == "BAT_THUONG"
    assert phan_loai_tong_hop(["CAO", "THAP"]) == "BAT_THUONG"
    assert phan_loai_tong_hop(["CAO", "NGUY_HIEM", "BINH_THUONG"]) == "NGUY_KICH"


def test_khoang_tham_chieu_theo_gioi_tinh_va_ghep_mau():
    ctm = find_lab_template("DV_XN_MAU", None)
    hgb = next(i for i in ctm.chi_so if i.ma == "HGB")
    assert hgb.khoang(NAM) == (D("130"), D("170"))
    assert hgb.khoang(NU) == (D("120"), D("150"))
    assert hgb.khoang(None) == (D("120"), D("170"))  # chưa rõ giới tính: khoảng gộp

    assert normalize_gioi_tinh("Nam") == NAM
    assert normalize_gioi_tinh("Nữ") == NU
    assert normalize_gioi_tinh("khác") is None

    # Ghép theo tên khi mã dịch vụ không có trong cấu hình
    assert find_lab_template("XN-ABC", "Công thức máu 18 chỉ số").ma_mau == "CTM"
    assert find_lab_template("XN-ABC", "Sinh hóa máu (Glucose, Ure)").ma_mau == "SINH_HOA"
    assert find_lab_template("XN-ABC", "Đường huyết mao mạch").ma_mau == "GLUCOSE"
    assert find_lab_template("XN-ABC", "Tổng phân tích nước tiểu") is None


async def _tao_ca_xet_nghiem(api_client, booking, db_session, benh_nhan, ten="Công thức máu T141", ma_nhom="XN", start=True):
    if "ktv" not in booking.tokens:
        await booking.tao_tai_khoan("ktv", VaiTroEnum.KY_THUAT_VIEN.value)
    dv = DichVu(
        ma_dich_vu=f"XN-T141-{booking.suffix}-{benh_nhan.id}", ten_dich_vu=ten, don_gia=120000, ma_nhom_byt=ma_nhom
    )
    db_session.add(dv)
    await db_session.flush()
    # Mỗi bệnh nhân một giờ hẹn riêng (bác sĩ không được trùng khung giờ)
    lech = timedelta(minutes=0 if benh_nhan is booking.bn_a else 1)
    lich = await booking.tao_lich(benh_nhan, booking.bs_x, datetime.now(timezone.utc) + lech)
    res_enc = await api_client.post(
        "/api/v1/clinical/encounters", json={"lich_kham_id": lich.id}, headers=booking.tokens["bs_x"]
    )
    enc_id = res_enc.json()["data"]["id"]
    res_order = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/orders", json={"dich_vu_id": dv.id}, headers=booking.tokens["bs_x"]
    )
    assert res_order.status_code == 201, res_order.text
    order_id = res_order.json()["data"]["id"]
    if start:
        res_start = await api_client.post(f"/api/v1/subclinical/orders/{order_id}/start", headers=booking.tokens["ktv"])
        assert res_start.status_code == 200
    return order_id


async def _dat_gioi_tinh(db_session, benh_nhan, gioi_tinh):
    nguoi_dung = await db_session.get(NguoiDung, benh_nhan.nguoi_dung_id)
    nguoi_dung.gioi_tinh = gioi_tinh
    await db_session.flush()


@pytest.mark.asyncio
async def test_template_theo_gioi_tinh_benh_nhan(api_client, booking, db_session):
    await _dat_gioi_tinh(db_session, booking.bn_a, "Nữ")
    order_id = await _tao_ca_xet_nghiem(api_client, booking, db_session, booking.bn_a)

    res = await api_client.get(f"/api/v1/subclinical/orders/{order_id}/lab-template", headers=booking.tokens["ktv"])
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["ma_mau"] == "CTM"
    assert data["gioi_tinh_ap_dung"] == "NU"
    assert data["ket_qua"] is None
    chi_so = {c["ma"]: c for c in data["chi_so"]}
    assert chi_so["HGB"]["thap"] == 120 and chi_so["HGB"]["cao"] == 150
    assert chi_so["HGB"]["khoang_tham_chieu"] == "120 - 150"
    assert chi_so["HGB"]["nguy_kich_thap"] == 70
    assert chi_so["WBC"]["don_vi"] == "G/L"
    assert [c["thu_tu"] for c in data["chi_so"]] == list(range(len(data["chi_so"])))


@pytest.mark.asyncio
async def test_nop_ket_qua_tu_danh_gia_va_luu_ket_qua_cls(api_client, booking, db_session):
    await _dat_gioi_tinh(db_session, booking.bn_a, "Nam")
    order_id = await _tao_ca_xet_nghiem(api_client, booking, db_session, booking.bn_a)
    url = f"/api/v1/subclinical/orders/{order_id}/lab-results"

    # HGB 125 g/L: bình thường với nữ nhưng THẤP với nam; PLT 40 dưới ngưỡng nguy kịch 50
    body = {"chi_so": {"WBC": 10, "HGB": 125, "PLT": 40}, "ket_luan": "Giảm tiểu cầu nặng", "ghi_chu": "Mẫu đạt"}
    res = await api_client.post(url, json=body, headers=booking.tokens["ktv"])
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    # Hoàn tất kết quả chưa phải trả: chỉ định giữ dang_thuc_hien cho tới khi KTV duyệt
    assert data["trang_thai"] == "dang_thuc_hien"
    kq = data["ket_qua"]
    assert kq["da_tra_ket_qua"] is False
    assert kq["trang_thai_ket_qua"] == "DA_CO_KET_QUA"
    assert kq["ket_qua_phan_loai"] == "NGUY_KICH"
    assert kq["so_bat_thuong"] == 2 and kq["so_nguy_hiem"] == 1
    danh_gia = {c["ma"]: (c["danh_gia"], c["huong"]) for c in kq["chi_tiet"]}
    assert danh_gia == {"WBC": ("BINH_THUONG", None), "HGB": ("THAP", "THAP"), "PLT": ("NGUY_HIEM", "THAP")}
    assert [c["ma"] for c in kq["chi_tiet"]] == ["WBC", "HGB", "PLT"]  # theo thứ tự của mẫu
    assert "nguy hiểm" in res.json()["message"]

    # Lưu trong ket_qua_cls
    ket_qua = (await db_session.execute(select(KetQuaCLS).where(KetQuaCLS.chi_dinh_id == order_id))).scalar_one()
    assert ket_qua.ket_qua_phan_loai == "NGUY_KICH"
    assert ket_qua.tri_so_chi_tiet["chi_so"] == {"WBC": "10", "HGB": "125", "PLT": "40"}
    assert ket_qua.tri_so_chi_tiet["gioi_tinh_ap_dung"] == "NAM"
    assert ket_qua.nguoi_thuc_hien_id is not None
    assert "Tiểu cầu (PLT): 40 G/L ▼ NGUY_HIEM" in ket_qua.ket_qua_chi_tiet

    # Chưa duyệt thì chưa ghi các cột kết quả trên chi_dinh (bàn khám chưa thấy kết quả)
    chi_dinh = await db_session.get(ChiDinh, order_id)
    await db_session.refresh(chi_dinh)
    assert chi_dinh.trang_thai == "dang_thuc_hien"
    assert not (chi_dinh.tri_so_chi_tiet or {}).get("loai")
    assert chi_dinh.thoi_gian_tra_ket_qua is None

    # Mở lại (tải lại trang) vẫn thấy kết quả
    res_tpl = await api_client.get(f"/api/v1/subclinical/orders/{order_id}/lab-template", headers=booking.tokens["ktv"])
    saved = res_tpl.json()["data"]["ket_qua"]
    assert saved["chi_so"] == {"WBC": "10", "HGB": "125", "PLT": "40"}
    assert saved["ket_luan"] == "Giảm tiểu cầu nặng"
    assert saved["trang_thai_ket_qua"] == "DA_CO_KET_QUA"

    # Cập nhật kết quả: ghi đè đúng 1 bản ghi ket_qua_cls
    res_update = await api_client.post(url, json={"chi_so": {"PLT": 200}}, headers=booking.tokens["ktv"])
    assert res_update.status_code == 200
    assert res_update.json()["data"]["ket_qua"]["ket_qua_phan_loai"] == "BINH_THUONG"
    rows = (await db_session.execute(select(KetQuaCLS).where(KetQuaCLS.chi_dinh_id == order_id))).scalars().all()
    assert len(rows) == 1

    # Đã hoàn tất (chờ duyệt) thì không quay về nháp được nữa
    res_draft = await api_client.post(url, json={"chi_so": {"PLT": 200}, "luu_nhap": True}, headers=booking.tokens["ktv"])
    assert res_draft.status_code == 409


@pytest.mark.asyncio
async def test_bo_qua_co_danh_gia_client_gui_len(api_client, booking, db_session):
    order_id = await _tao_ca_xet_nghiem(api_client, booking, db_session, booking.bn_a)
    # Trường lạ (cờ đánh giá của client) bị bỏ qua, backend tự tính
    body = {"chi_so": {"WBC": 50}, "ket_qua_phan_loai": "BINH_THUONG", "danh_gia": {"WBC": "BINH_THUONG"}}
    res = await api_client.post(f"/api/v1/subclinical/orders/{order_id}/lab-results", json=body, headers=booking.tokens["ktv"])
    assert res.status_code == 200
    assert res.json()["data"]["ket_qua"]["ket_qua_phan_loai"] == "NGUY_KICH"


@pytest.mark.asyncio
async def test_luu_nhap_chua_tra_ket_qua(api_client, booking, db_session):
    order_id = await _tao_ca_xet_nghiem(api_client, booking, db_session, booking.bn_a)
    res = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/lab-results",
        json={"chi_so": {"WBC": "11.5"}, "luu_nhap": True},
        headers=booking.tokens["ktv"],
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["trang_thai"] == "dang_thuc_hien"
    assert data["ket_qua"]["da_tra_ket_qua"] is False
    assert data["ket_qua"]["ket_qua_phan_loai"] == "BAT_THUONG"

    chi_dinh = await db_session.get(ChiDinh, order_id)
    await db_session.refresh(chi_dinh)
    assert chi_dinh.trang_thai == "dang_thuc_hien"
    assert chi_dinh.thoi_gian_tra_ket_qua is None

    res_tpl = await api_client.get(f"/api/v1/subclinical/orders/{order_id}/lab-template", headers=booking.tokens["ktv"])
    assert res_tpl.json()["data"]["ket_qua"]["chi_so"] == {"WBC": "11.5"}


@pytest.mark.asyncio
async def test_chan_nop_sai_trang_thai_va_du_lieu_khong_hop_le(api_client, booking, db_session):
    order_id = await _tao_ca_xet_nghiem(api_client, booking, db_session, booking.bn_a, start=False)
    url = f"/api/v1/subclinical/orders/{order_id}/lab-results"
    headers = booking.tokens["ktv"]

    # Chưa bắt đầu -> 409
    assert (await api_client.post(url, json={"chi_so": {"WBC": 5}}, headers=headers)).status_code == 409

    await api_client.post(f"/api/v1/subclinical/orders/{order_id}/start", headers=headers)
    # Giá trị không phải số, âm, rỗng, mã lạ -> 422
    for chi_so in ({"WBC": "abc"}, {"WBC": -1}, {"WBC": "NaN"}, {}, {"XYZ": 1}):
        res = await api_client.post(url, json={"chi_so": chi_so}, headers=headers)
        assert res.status_code == 422, (chi_so, res.text)

    # Đã hủy -> 409
    order_huy = await _tao_ca_xet_nghiem(api_client, booking, db_session, booking.bn_b, start=False)
    await api_client.post(f"/api/v1/subclinical/orders/{order_huy}/cancel", headers=headers)
    res_huy = await api_client.post(
        f"/api/v1/subclinical/orders/{order_huy}/lab-results", json={"chi_so": {"WBC": 5}}, headers=headers
    )
    assert res_huy.status_code == 409

    # Không tồn tại -> 404
    res_404 = await api_client.get("/api/v1/subclinical/orders/999999999/lab-template", headers=headers)
    assert res_404.status_code == 404


@pytest.mark.asyncio
async def test_chi_dinh_khong_phai_xet_nghiem_hoac_chua_co_mau(api_client, booking, db_session):
    order_sa = await _tao_ca_xet_nghiem(
        api_client, booking, db_session, booking.bn_a, ten="Siêu âm ổ bụng T141", ma_nhom="CDHA"
    )
    res = await api_client.get(f"/api/v1/subclinical/orders/{order_sa}/lab-template", headers=booking.tokens["ktv"])
    assert res.status_code == 422

    order_nt = await _tao_ca_xet_nghiem(api_client, booking, db_session, booking.bn_b, ten="Tổng phân tích nước tiểu T141")
    res_nt = await api_client.get(f"/api/v1/subclinical/orders/{order_nt}/lab-template", headers=booking.tokens["ktv"])
    assert res_nt.status_code == 422
    assert "Chưa có bộ chỉ số mẫu" in res_nt.json()["message"]


@pytest.mark.asyncio
async def test_phan_quyen_nhap_ket_qua_xet_nghiem(api_client, booking, db_session):
    await booking.tao_tai_khoan("le_tan", VaiTroEnum.LE_TAN.value)
    order_id = await _tao_ca_xet_nghiem(api_client, booking, db_session, booking.bn_a)
    tpl = f"/api/v1/subclinical/orders/{order_id}/lab-template"
    url = f"/api/v1/subclinical/orders/{order_id}/lab-results"
    body = {"chi_so": {"WBC": 5}}

    for key in ("bn_a", "le_tan"):
        assert (await api_client.get(tpl, headers=booking.tokens[key])).status_code == 403
        assert (await api_client.post(url, json=body, headers=booking.tokens[key])).status_code == 403
    assert (await api_client.post(url, json=body)).status_code in (401, 403)

    # KTV và bác sĩ được nhập
    assert (await api_client.get(tpl, headers=booking.tokens["bs_x"])).status_code == 200
    assert (await api_client.post(url, json=body, headers=booking.tokens["ktv"])).status_code == 200
