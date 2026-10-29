from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models.compliance import NhatKyTruyCapDuLieuYTe
from app.models.medical import ChiDinh, KetQuaCLS, PhieuKetQuaCLS
from app.models.user import NguoiDung
from app.services.auth_service import map_vai_tro_to_role
from tests.test_cls_imaging_upload import JPG, _tao_ca_cdha, _upload
from tests.test_cls_lab_result import _tao_ca_xet_nghiem

# ==============================================================================
# PJ2026-143 — KTV ký duyệt & trả kết quả CLS, phiếu kết quả in A4/A5, bàn khám nhận kết quả mới
# ==============================================================================


@pytest.fixture
def upload_dir(tmp_path, monkeypatch):
    root = tmp_path / "cls"
    monkeypatch.setattr(settings, "CLS_UPLOAD_DIR", str(root))
    return root.resolve()


def _approve_url(order_id):
    return f"/api/v1/subclinical/orders/{order_id}/approve"


async def _hoan_tat_xet_nghiem(api_client, booking, db_session):
    nguoi_dung = await db_session.get(NguoiDung, booking.bn_a.nguoi_dung_id)
    nguoi_dung.gioi_tinh = "Nam"
    nguoi_dung.ngay_sinh = date(1990, 5, 20)
    await db_session.flush()
    order_id = await _tao_ca_xet_nghiem(api_client, booking, db_session, booking.bn_a)
    res = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/lab-results",
        json={"chi_so": {"WBC": 10, "HGB": 125, "PLT": 40}, "ket_luan": "Giảm tiểu cầu nặng"},
        headers=booking.tokens["ktv"],
    )
    assert res.status_code == 200, res.text
    return order_id


@pytest.mark.asyncio
async def test_duyet_sai_vai_tro_bi_chan(api_client, booking, db_session):
    order_id = await _hoan_tat_xet_nghiem(api_client, booking, db_session)
    await booking.tao_tai_khoan("le_tan", "le_tan")

    # Bác sĩ chỉ định, lễ tân, bệnh nhân không được duyệt (Jira: người duyệt là kỹ thuật viên)
    for key in ("bs_x", "le_tan", "bn_a"):
        res = await api_client.post(_approve_url(order_id), headers=booking.tokens[key])
        assert res.status_code == 403, (key, res.text)
    assert (await api_client.post(_approve_url(order_id))).status_code == 401

    order = await db_session.get(ChiDinh, order_id)
    await db_session.refresh(order)
    assert order.trang_thai == "dang_thuc_hien"

    # Admin giám sát được phép duyệt
    res_admin = await api_client.post(_approve_url(order_id), headers=booking.tokens["admin"])
    assert res_admin.status_code == 200, res_admin.text


@pytest.mark.asyncio
async def test_duyet_khi_chua_co_ket_qua_hoan_tat_bi_409(api_client, booking, db_session):
    order_id = await _tao_ca_xet_nghiem(api_client, booking, db_session, booking.bn_a, start=False)
    ktv = booking.tokens["ktv"]

    # Chưa tiếp nhận / chưa nhập gì
    assert (await api_client.post(_approve_url(order_id), headers=ktv)).status_code == 409
    await api_client.post(f"/api/v1/subclinical/orders/{order_id}/start", headers=ktv)
    assert (await api_client.post(_approve_url(order_id), headers=ktv)).status_code == 409

    # Mới lưu nháp: chưa duyệt được
    res_nhap = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/lab-results", json={"chi_so": {"WBC": 6}, "luu_nhap": True}, headers=ktv
    )
    assert res_nhap.status_code == 200
    res = await api_client.post(_approve_url(order_id), headers=ktv)
    assert res.status_code == 409
    assert "Hoàn tất" in res.json()["message"]

    # Ca đã hủy, ca không tồn tại
    other_id = await _tao_ca_xet_nghiem(api_client, booking, db_session, booking.bn_b, start=False)
    res_huy = await api_client.post(f"/api/v1/subclinical/orders/{other_id}/cancel", headers=ktv)
    assert res_huy.json()["data"]["trang_thai"] == "da_huy"
    assert (await api_client.post(_approve_url(other_id), headers=ktv)).status_code == 409
    assert (await api_client.post(_approve_url(999999999), headers=ktv)).status_code == 404


@pytest.mark.asyncio
async def test_duyet_xet_nghiem_ghi_nguoi_duyet_va_khoa_sua(api_client, booking, db_session):
    order_id = await _hoan_tat_xet_nghiem(api_client, booking, db_session)
    ktv = booking.tokens["ktv"]

    res = await api_client.post(_approve_url(order_id), headers=ktv)
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["trang_thai"] == "da_co_ket_qua"
    assert data["trang_thai_ket_qua"] == "DA_DUYET"
    assert data["nguoi_duyet"]["vai_tro"] == "ky_thuat_vien"
    assert data["nguoi_duyet"]["ho_ten"].startswith("Test ktv")

    # Người duyệt + thời gian duyệt nằm ở bảng kết quả hiện có (không migration)
    ket_qua = (await db_session.execute(select(KetQuaCLS).where(KetQuaCLS.chi_dinh_id == order_id))).scalar_one()
    await db_session.refresh(ket_qua)
    assert ket_qua.thoi_gian_duyet is not None
    assert ket_qua.tri_so_chi_tiet["duyet"]["nguoi_dung_id"] == data["nguoi_duyet"]["nguoi_dung_id"]
    phieu = (await db_session.execute(select(PhieuKetQuaCLS).where(PhieuKetQuaCLS.chi_dinh_id == order_id))).scalar_one()
    await db_session.refresh(phieu)
    assert phieu.trang_thai == "DA_DUYET" and phieu.thoi_gian_duyet is not None
    assert phieu.loai_ket_qua == "XET_NGHIEM"

    # Các cột kết quả trên chi_dinh được ghi khi duyệt
    order = await db_session.get(ChiDinh, order_id)
    await db_session.refresh(order)
    assert order.trang_thai == "da_co_ket_qua"
    assert order.ket_qua_phan_loai == "NGUY_KICH"
    assert order.tri_so_chi_tiet["chi_so"]["PLT"] == "40"
    assert order.thoi_gian_tra_ket_qua is not None

    # Ghi nhật ký kiểm toán
    log = (
        await db_session.execute(
            select(NhatKyTruyCapDuLieuYTe).where(
                NhatKyTruyCapDuLieuYTe.resource_type == "KET_QUA_CLS", NhatKyTruyCapDuLieuYTe.resource_id == order_id
            )
        )
    ).scalar_one()
    assert log.patient_id == booking.bn_a.id

    # Sau duyệt: khóa nộp lại, lưu nháp, duyệt lại, endpoint kết quả cũ, hủy chỉ định
    url_lab = f"/api/v1/subclinical/orders/{order_id}/lab-results"
    assert (await api_client.post(url_lab, json={"chi_so": {"PLT": 200}}, headers=ktv)).status_code == 409
    assert (await api_client.post(url_lab, json={"chi_so": {"PLT": 200}, "luu_nhap": True}, headers=ktv)).status_code == 409
    assert (await api_client.post(_approve_url(order_id), headers=ktv)).status_code == 409
    res_cu = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/results", json={"ket_qua_chi_tiet": "ghi đè"}, headers=ktv
    )
    assert res_cu.status_code == 409
    assert (await api_client.post(f"/api/v1/subclinical/orders/{order_id}/start", headers=ktv)).status_code == 409
    await db_session.refresh(order)
    assert order.tri_so_chi_tiet["chi_so"]["PLT"] == "40"

    # Mở lại form vẫn thấy trạng thái đã duyệt
    res_tpl = await api_client.get(f"/api/v1/subclinical/orders/{order_id}/lab-template", headers=ktv)
    saved = res_tpl.json()["data"]["ket_qua"]
    assert saved["da_tra_ket_qua"] is True and saved["trang_thai_ket_qua"] == "DA_DUYET"
    assert saved["thoi_gian_duyet"] is not None


@pytest.mark.asyncio
async def test_duyet_cdha_khoa_upload_xoa_anh_va_sua_ket_qua(api_client, booking, db_session, upload_dir):
    order_id, _ = await _tao_ca_cdha(api_client, booking, db_session)
    ktv = booking.tokens["ktv"]
    anh = (await _upload(api_client, order_id, ktv)).json()["data"]
    url_kq = f"/api/v1/subclinical/orders/{order_id}/imaging-result"
    body = {"mo_ta_hinh_anh": "Gan tăng âm lan tỏa.", "ket_luan": "Gan nhiễm mỡ độ I.", "ket_qua_phan_loai": "BAT_THUONG"}

    # Lưu nháp chưa duyệt được; hoàn tất rồi mới duyệt
    await api_client.post(url_kq, json={**body, "hoan_tat": False}, headers=ktv)
    assert (await api_client.post(_approve_url(order_id), headers=ktv)).status_code == 409
    assert (await api_client.post(url_kq, json=body, headers=ktv)).status_code == 200
    res = await api_client.post(_approve_url(order_id), headers=ktv)
    assert res.status_code == 200, res.text

    order = await db_session.get(ChiDinh, order_id)
    await db_session.refresh(order)
    assert order.trang_thai == "da_co_ket_qua"
    assert order.tri_so_chi_tiet["loai"] == "CDHA"
    assert order.tri_so_chi_tiet["ket_luan"] == "Gan nhiễm mỡ độ I."
    assert order.tep_dinh_kem_url == anh["url"]

    assert (await _upload(api_client, order_id, ktv)).status_code == 409
    assert (await api_client.delete(anh["url"], headers=ktv)).status_code == 409
    assert (await api_client.post(url_kq, json={**body, "ket_luan": "Sửa"}, headers=ktv)).status_code == 409
    assert (await api_client.post(url_kq, json={**body, "hoan_tat": False}, headers=ktv)).status_code == 409
    res_get = await api_client.get(url_kq, headers=ktv)
    assert res_get.json()["data"]["da_duyet"] is True
    assert res_get.json()["data"]["thoi_gian_duyet"] is not None
    assert (upload_dir / str(order_id) / anh["file_id"]).is_file()


@pytest.mark.asyncio
async def test_hang_doi_ktv_hien_trang_thai_phieu(api_client, booking, db_session):
    order_id = await _hoan_tat_xet_nghiem(api_client, booking, db_session)
    ktv = booking.tokens["ktv"]

    def _item(res):
        return next(i for i in res.json()["data"]["items"] if i["id"] == order_id)

    queue_url = "/api/v1/subclinical/queue?trang_thai=tat_ca"
    item = _item(await api_client.get(queue_url, headers=ktv))
    assert item["trang_thai"] == "dang_thuc_hien" and item["trang_thai_ket_qua"] == "DA_CO_KET_QUA"

    await api_client.post(_approve_url(order_id), headers=ktv)
    item = _item(await api_client.get(queue_url, headers=ktv))
    assert item["trang_thai"] == "da_co_ket_qua" and item["trang_thai_ket_qua"] == "DA_DUYET"
    assert item["thoi_gian_duyet"] is not None


@pytest.mark.asyncio
async def test_ban_kham_chi_nhan_ket_qua_da_duyet_cua_minh(api_client, booking, db_session):
    order_id = await _hoan_tat_xet_nghiem(api_client, booking, db_session)
    feed = "/api/v1/subclinical/returned-results"

    # Hoàn tất nhưng chưa duyệt: bàn khám chưa thấy
    res = await api_client.get(feed, headers=booking.tokens["bs_x"])
    assert res.status_code == 200, res.text
    assert order_id not in [i["chi_dinh_id"] for i in res.json()["data"]["items"]]
    server_time = res.json()["data"]["server_time"]

    await api_client.post(_approve_url(order_id), headers=booking.tokens["ktv"])

    res = await api_client.get(feed, params={"since": server_time}, headers=booking.tokens["bs_x"])
    items = {i["chi_dinh_id"]: i for i in res.json()["data"]["items"]}
    assert order_id in items
    item = items[order_id]
    assert item["trang_thai"] == "da_co_ket_qua"
    assert item["ket_qua_phan_loai"] == "NGUY_KICH"
    assert item["ket_qua_chi_tiet"]["loai"] == "XET_NGHIEM"
    assert item["ket_qua_chi_tiet"]["chi_so"]["PLT"] == "40"
    assert item["nguoi_duyet"].startswith("Test ktv")

    # Bác sĩ khác không thấy ca của bác sĩ x; mốc `since` sau thời điểm duyệt thì không trả lại
    res_y = await api_client.get(feed, headers=booking.tokens["bs_y"])
    assert order_id not in [i["chi_dinh_id"] for i in res_y.json()["data"]["items"]]
    later = (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat()
    res_later = await api_client.get(feed, params={"since": later}, headers=booking.tokens["bs_x"])
    assert res_later.json()["data"]["items"] == []

    # Bệnh nhân và KTV không gọi được luồng của bàn khám
    assert (await api_client.get(feed, headers=booking.tokens["bn_a"])).status_code == 403
    assert (await api_client.get(feed, headers=booking.tokens["ktv"])).status_code == 403


@pytest.mark.asyncio
async def test_phieu_in_xet_nghiem_day_du_va_chi_khi_da_duyet(api_client, booking, db_session):
    order_id = await _hoan_tat_xet_nghiem(api_client, booking, db_session)
    report_url = f"/api/v1/subclinical/orders/{order_id}/report"

    # Chưa duyệt thì chưa in
    assert (await api_client.get(report_url, headers=booking.tokens["ktv"])).status_code == 409
    await api_client.post(_approve_url(order_id), headers=booking.tokens["ktv"])

    res = await api_client.get(report_url, headers=booking.tokens["bs_x"])
    assert res.status_code == 200, res.text
    r = res.json()["data"]
    assert r["ma_phieu"] == f"KQ-CLS-{order_id:06d}"
    assert r["loai_phieu"] == "XET_NGHIEM" and r["nhom_dich_vu"] == "XET_NGHIEM"
    assert r["phong_kham"]["ten"]
    assert r["benh_nhan"]["ho_ten"].startswith("Test bn_a")
    assert r["benh_nhan"]["ma_benh_nhan"] == booking.bn_a.ma_dinh_danh_y_te
    assert r["benh_nhan"]["gioi_tinh"] == "Nam" and r["benh_nhan"]["ngay_sinh"] == "1990-05-20"
    assert r["benh_nhan"]["tuoi"] >= 36
    assert r["bac_si_chi_dinh"].startswith("Test bs_x")
    assert r["ky_thuat_vien_thuc_hien"].startswith("Test ktv")
    assert r["nguoi_duyet"]["ho_ten"].startswith("Test ktv") and r["thoi_gian_duyet"]
    assert r["ket_qua_phan_loai"] == "NGUY_KICH"
    assert r["ket_luan"] == "Giảm tiểu cầu nặng"
    rows = {row["ma"]: row for row in r["chi_tiet"]}
    assert list(rows) == ["WBC", "HGB", "PLT"]
    assert rows["PLT"] == {
        "ma": "PLT", "ten": rows["PLT"]["ten"], "gia_tri": "40", "don_vi": "G/L",
        "khoang_tham_chieu": "150 - 400", "danh_gia": "NGUY_HIEM", "huong": "THAP", "bat_thuong": True,
    }
    assert rows["HGB"]["khoang_tham_chieu"] == "130 - 170" and rows["HGB"]["bat_thuong"] is True  # theo giới nam
    assert rows["WBC"]["bat_thuong"] is False
    assert r["so_bat_thuong"] == 2

    # In phiếu được ghi nhật ký EXPORT; bệnh nhân không lấy được phiếu qua API của phòng CLS
    log = (
        await db_session.execute(
            select(NhatKyTruyCapDuLieuYTe).where(
                NhatKyTruyCapDuLieuYTe.resource_type == "PHIEU_KET_QUA_CLS", NhatKyTruyCapDuLieuYTe.resource_id == order_id
            )
        )
    ).scalar_one()
    assert log.action == "EXPORT"
    assert (await api_client.get(report_url, headers=booking.tokens["bn_a"])).status_code == 403


@pytest.mark.asyncio
async def test_phieu_in_cdha_co_anh_mo_ta_ket_luan(api_client, booking, db_session, upload_dir):
    order_id, _ = await _tao_ca_cdha(api_client, booking, db_session)
    ktv = booking.tokens["ktv"]
    anh = (await _upload(api_client, order_id, ktv)).json()["data"]
    await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/imaging-result",
        json={
            "mo_ta_hinh_anh": "Gan tăng âm lan tỏa.",
            "ket_luan": "Gan nhiễm mỡ độ I.",
            "de_nghi": "Đối chiếu lâm sàng",
            "thiet_bi_thuc_hien": "Siêu âm GE Logiq P9",
            "ket_qua_phan_loai": "BAT_THUONG",
        },
        headers=ktv,
    )
    await api_client.post(_approve_url(order_id), headers=ktv)

    res = await api_client.get(f"/api/v1/subclinical/orders/{order_id}/report", headers=ktv)
    assert res.status_code == 200, res.text
    r = res.json()["data"]
    assert r["loai_phieu"] == "HINH_ANH" and r["nhom_dich_vu"] == "CDHA"
    assert r["mo_ta_hinh_anh"] == "Gan tăng âm lan tỏa."
    assert r["ket_luan"] == "Gan nhiễm mỡ độ I." and r["de_nghi"] == "Đối chiếu lâm sàng"
    assert r["thiet_bi_thuc_hien"] == "Siêu âm GE Logiq P9"
    assert r["tep_dinh_kem_urls"] == [anh["url"]]
    assert r["chi_tiet"] == []
    # Ảnh trong phiếu vẫn xem được (có xác thực) sau khi duyệt
    assert (await api_client.get(anh["url"], headers=ktv)).content == JPG


def test_dang_nhap_ktv_tra_vai_tro_ky_thuat_vien_cho_fe():
    # FE điều hướng KTV sang bàn CLS theo role; trước đây ky_thuat_vien rơi về PATIENT
    assert map_vai_tro_to_role("ky_thuat_vien") == "TECHNICIAN"
