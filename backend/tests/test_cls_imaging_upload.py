import pytest
from datetime import datetime, timezone
from sqlalchemy import select
from app.core.config import settings
from app.models.medical import ChiDinh, DichVu, KetQuaCLS, PhieuKetQuaCLS
from app.models.user import VaiTroEnum
from app.services import cls_file_service as cls_file_module

JPG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"\x11" * 200
PNG = b"\x89PNG\r\n\x1a\n" + b"\x22" * 200
EXE = b"MZ\x90\x00\x03\x00\x00\x00" + b"\x00" * 200


@pytest.fixture
def upload_dir(tmp_path, monkeypatch):
    """Ảnh test ghi vào thư mục tạm, không đụng backend/uploads"""
    root = tmp_path / "cls"
    monkeypatch.setattr(settings, "CLS_UPLOAD_DIR", str(root))
    return root.resolve()


async def _tao_ca_cdha(api_client, booking, db_session, bat_dau=True):
    """Bác sĩ chỉ định siêu âm + xét nghiệm, KTV tiếp nhận; trả về (id ca siêu âm, id ca xét nghiệm)"""
    if "ktv" not in booking.tokens:
        await booking.tao_tai_khoan("ktv", VaiTroEnum.KY_THUAT_VIEN.value)
    sa = DichVu(ma_dich_vu=f"SA-T142-{booking.suffix}", ten_dich_vu="Siêu âm ổ bụng T142", don_gia=200000, ma_nhom_byt="CDHA")
    xn = DichVu(ma_dich_vu=f"XN-T142-{booking.suffix}", ten_dich_vu="Công thức máu T142", don_gia=120000, ma_nhom_byt="XN")
    db_session.add_all([sa, xn])
    await db_session.flush()

    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, datetime.now(timezone.utc))
    res_enc = await api_client.post(
        "/api/v1/clinical/encounters", json={"lich_kham_id": lich.id}, headers=booking.tokens["bs_x"]
    )
    enc_id = res_enc.json()["data"]["id"]
    ids = []
    for dv in (sa, xn):
        res = await api_client.post(
            f"/api/v1/clinical/encounters/{enc_id}/orders", json={"dich_vu_id": dv.id}, headers=booking.tokens["bs_x"]
        )
        assert res.status_code == 201, res.text
        ids.append(res.json()["data"]["id"])
        if bat_dau:
            res_start = await api_client.post(f"/api/v1/subclinical/orders/{ids[-1]}/start", headers=booking.tokens["ktv"])
            assert res_start.status_code == 200, res_start.text
    return ids[0], ids[1]


async def _upload(api_client, order_id, headers, name="anh.jpg", data=JPG, content_type="image/jpeg"):
    return await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/files",
        files={"file": (name, data, content_type)},
        headers=headers,
    )


@pytest.mark.asyncio
async def test_upload_anh_xem_lai_va_tra_ket_qua_cdha(api_client, booking, db_session, upload_dir):
    order_id, _ = await _tao_ca_cdha(api_client, booking, db_session)
    ktv = booking.tokens["ktv"]

    res_jpg = await _upload(api_client, order_id, ktv, name="Sieu am gan.JPEG")
    res_png = await _upload(api_client, order_id, ktv, name="than-phai.png", data=PNG, content_type="image/png")
    assert res_jpg.status_code == 201, res_jpg.text
    assert res_png.status_code == 201, res_png.text
    jpg, png = res_jpg.json()["data"], res_png.json()["data"]
    assert jpg["file_id"].endswith(".jpg") and png["file_id"].endswith(".png")
    assert jpg["ten_goc"] == "Sieu am gan.JPEG" and jpg["kich_thuoc"] == len(JPG)
    assert jpg["url"] == f"/api/v1/subclinical/orders/{order_id}/files/{jpg['file_id']}"

    # Tệp nằm đúng thư mục của ca, tên do máy chủ sinh; đường dẫn lưu trong chi_dinh
    assert (upload_dir / str(order_id) / jpg["file_id"]).read_bytes() == JPG
    order = await db_session.get(ChiDinh, order_id)
    await db_session.refresh(order)
    assert order.file_dinh_kem_urls == [jpg["url"], png["url"]]

    res_view = await api_client.get(jpg["url"], headers=ktv)
    assert res_view.status_code == 200
    assert res_view.content == JPG
    assert res_view.headers["content-type"] == "image/jpeg"
    assert "no-store" in res_view.headers["cache-control"]
    # Bác sĩ (người chỉ định) cũng xem được ảnh
    assert (await api_client.get(png["url"], headers=booking.tokens["bs_x"])).status_code == 200

    res_list = await api_client.get(f"/api/v1/subclinical/orders/{order_id}/files", headers=ktv)
    assert [f["file_id"] for f in res_list.json()["data"]["items"]] == [jpg["file_id"], png["file_id"]]

    url_kq = f"/api/v1/subclinical/orders/{order_id}/imaging-result"
    body = {
        "mo_ta_hinh_anh": "Gan không to, nhu mô tăng âm nhẹ lan tỏa.",
        "ket_luan": "Gan nhiễm mỡ độ I.",
        "de_nghi": "Đối chiếu lâm sàng",
        "ket_qua_phan_loai": "BAT_THUONG",
    }
    res_nhap = await api_client.post(url_kq, json={**body, "hoan_tat": False}, headers=ktv)
    assert res_nhap.status_code == 200, res_nhap.text
    assert res_nhap.json()["data"]["trang_thai"] == "dang_thuc_hien"
    assert res_nhap.json()["data"]["trang_thai_phieu"] == "NHAP"

    res_tra = await api_client.post(url_kq, json=body, headers=ktv)
    assert res_tra.status_code == 200, res_tra.text
    data = res_tra.json()["data"]
    # Hoàn tất: phiếu chờ duyệt, chỉ định giữ dang_thuc_hien cho tới khi KTV duyệt & trả
    assert data["trang_thai"] == "dang_thuc_hien"
    assert data["trang_thai_phieu"] == "DA_CO_KET_QUA"
    assert data["ket_qua_phan_loai"] == "BAT_THUONG"
    assert data["tep_dinh_kem_urls"] == [jpg["url"], png["url"]]

    phieu = (await db_session.execute(select(PhieuKetQuaCLS).where(PhieuKetQuaCLS.chi_dinh_id == order_id))).scalar_one()
    assert phieu.loai_ket_qua == "CDHA"
    assert phieu.mo_ta_hinh_anh == body["mo_ta_hinh_anh"] and phieu.ket_luan == body["ket_luan"]
    assert phieu.tep_dinh_kem_urls == [jpg["url"], png["url"]]
    ket_qua = (await db_session.execute(select(KetQuaCLS).where(KetQuaCLS.chi_dinh_id == order_id))).scalar_one()
    assert ket_qua.file_dinh_kem_urls == [jpg["url"], png["url"]]
    assert "Gan nhiễm mỡ độ I." in ket_qua.ket_qua_chi_tiet
    await db_session.refresh(order)
    assert order.trang_thai == "dang_thuc_hien"

    res_duyet = await api_client.post(f"/api/v1/subclinical/orders/{order_id}/approve", headers=ktv)
    assert res_duyet.status_code == 200, res_duyet.text
    await db_session.refresh(order)
    assert order.trang_thai == "da_co_ket_qua"
    assert order.ket_qua_phan_loai == "BAT_THUONG"
    assert "Gan nhiễm mỡ độ I." in order.ket_qua_chi_tiet
    assert order.tep_dinh_kem_url == jpg["url"]

    # Tải lại trang: đọc lại phiếu + ảnh từ máy chủ
    res_get = await api_client.get(url_kq, headers=ktv)
    assert res_get.json()["data"]["ket_luan"] == "Gan nhiễm mỡ độ I."
    assert res_get.json()["data"]["tep_dinh_kem_urls"] == [jpg["url"], png["url"]]


@pytest.mark.asyncio
async def test_chan_tep_gia_mao_anh(api_client, booking, db_session, upload_dir):
    order_id, _ = await _tao_ca_cdha(api_client, booking, db_session)
    ktv = booking.tokens["ktv"]

    cases = [
        ("virus.jpg", EXE, "image/jpeg"),  # .exe đổi đuôi thành .jpg
        ("anh.png", JPG, "image/png"),  # đuôi/content-type không khớp nội dung
        ("anh.jpg", JPG, "application/octet-stream"),
        ("anh.gif", b"GIF89a" + b"\x00" * 50, "image/gif"),
        ("ca.dcm", b"\x00" * 128 + b"DICM", "application/dicom"),
    ]
    for name, data, ctype in cases:
        res = await _upload(api_client, order_id, ktv, name=name, data=data, content_type=ctype)
        assert res.status_code == 415, (name, res.text)

    res_rong = await _upload(api_client, order_id, ktv, data=b"")
    assert res_rong.status_code == 400
    assert not (upload_dir / str(order_id)).exists()


@pytest.mark.asyncio
async def test_chan_anh_qua_dung_luong_va_qua_so_luong(api_client, booking, db_session, upload_dir):
    order_id, _ = await _tao_ca_cdha(api_client, booking, db_session)
    ktv = booking.tokens["ktv"]

    qua_lon = JPG + b"\x00" * (cls_file_module.MAX_FILE_BYTES - len(JPG) + 1)
    res_lon = await _upload(api_client, order_id, ktv, data=qua_lon)
    assert res_lon.status_code == 413

    vua_du = JPG + b"\x00" * (cls_file_module.MAX_FILE_BYTES - len(JPG))
    assert (await _upload(api_client, order_id, ktv, data=vua_du)).status_code == 201
    for _ in range(cls_file_module.MAX_FILES_PER_ORDER - 1):
        assert (await _upload(api_client, order_id, ktv)).status_code == 201
    res_qua = await _upload(api_client, order_id, ktv)
    assert res_qua.status_code == 409
    assert len(list((upload_dir / str(order_id)).iterdir())) == cls_file_module.MAX_FILES_PER_ORDER


@pytest.mark.asyncio
async def test_phan_quyen_va_bat_buoc_dang_nhap(api_client, booking, db_session, upload_dir):
    order_id, _ = await _tao_ca_cdha(api_client, booking, db_session)
    url = (await _upload(api_client, order_id, booking.tokens["ktv"])).json()["data"]["url"]
    await booking.tao_tai_khoan("le_tan", VaiTroEnum.LE_TAN.value)
    await booking.tao_tai_khoan("bn", VaiTroEnum.BENH_NHAN.value)

    # Không gửi token: không xem, không tải lên được
    assert (await api_client.get(url)).status_code == 401
    assert (await api_client.get(url, headers={"Authorization": "Bearer token-gia"})).status_code == 401
    assert (await _upload(api_client, order_id, {})).status_code == 401

    for key in ("le_tan", "bn"):
        headers = booking.tokens[key]
        assert (await api_client.get(url, headers=headers)).status_code == 403
        assert (await _upload(api_client, order_id, headers)).status_code == 403
        assert (await api_client.delete(url, headers=headers)).status_code == 403
        res_kq = await api_client.post(
            f"/api/v1/subclinical/orders/{order_id}/imaging-result",
            json={"mo_ta_hinh_anh": "x", "ket_luan": "y"},
            headers=headers,
        )
        assert res_kq.status_code == 403


@pytest.mark.asyncio
async def test_chan_path_traversal(api_client, booking, db_session, upload_dir):
    order_id, xn_id = await _tao_ca_cdha(api_client, booking, db_session)
    ktv = booking.tokens["ktv"]

    # Tên tệp độc hại không ảnh hưởng nơi lưu: máy chủ đặt tên UUID trong thư mục của ca
    res = await _upload(api_client, order_id, ktv, name="../../../../app/main.jpg")
    assert res.status_code == 201
    file_id = res.json()["data"]["file_id"]
    assert [p.name for p in (upload_dir / str(order_id)).iterdir()] == [file_id]
    assert [p.name for p in upload_dir.iterdir()] == [str(order_id)]
    res_win = await _upload(api_client, order_id, ktv, name="..\\..\\evil.jpg")
    assert res_win.status_code == 201
    assert len(list((upload_dir / str(order_id)).iterdir())) == 2

    # Tệp nằm ngoài thư mục upload không đọc được qua bất kỳ biến thể đường dẫn nào
    (upload_dir.parent / "bi_mat.jpg").write_bytes(JPG)
    base = f"/api/v1/subclinical/orders/{order_id}/files"
    for bad in ("..%2Fbi_mat.jpg", "..%2F..%2Fbi_mat.jpg", "%2e%2e%5cbi_mat.jpg", "....%2F%2Fbi_mat.jpg", file_id.upper()):
        res_bad = await api_client.get(f"{base}/{bad}", headers=ktv)
        assert res_bad.status_code == 404, (bad, res_bad.status_code)
        assert res_bad.content != JPG

    # Ảnh của ca khác không xem/xóa được bằng id ca này
    other = f"/api/v1/subclinical/orders/{xn_id}/files/{file_id}"
    assert (await api_client.get(other, headers=ktv)).status_code == 404
    assert (await api_client.delete(other, headers=ktv)).status_code == 404
    assert (upload_dir / str(order_id) / file_id).is_file()


@pytest.mark.asyncio
async def test_xoa_anh_truoc_khi_duyet_va_khoa_sau_duyet(api_client, booking, db_session, upload_dir):
    order_id, _ = await _tao_ca_cdha(api_client, booking, db_session)
    ktv = booking.tokens["ktv"]
    a = (await _upload(api_client, order_id, ktv)).json()["data"]
    b = (await _upload(api_client, order_id, ktv, data=PNG, name="b.png", content_type="image/png")).json()["data"]

    url_kq = f"/api/v1/subclinical/orders/{order_id}/imaging-result"
    res_tra = await api_client.post(url_kq, json={"mo_ta_hinh_anh": "Mô tả", "ket_luan": "Kết luận"}, headers=ktv)
    assert res_tra.status_code == 200

    # Đã hoàn tất nhưng chưa duyệt: vẫn xóa được, phiếu kết quả cập nhật theo
    res_del = await api_client.delete(a["url"], headers=ktv)
    assert res_del.status_code == 200, res_del.text
    assert not (upload_dir / str(order_id) / a["file_id"]).exists()
    assert (await api_client.get(a["url"], headers=ktv)).status_code == 404
    phieu = (await db_session.execute(select(PhieuKetQuaCLS).where(PhieuKetQuaCLS.chi_dinh_id == order_id))).scalar_one()
    await db_session.refresh(phieu)
    assert phieu.tep_dinh_kem_urls == [b["url"]]
    order = await db_session.get(ChiDinh, order_id)
    await db_session.refresh(order)
    assert order.file_dinh_kem_urls == [b["url"]]
    ket_qua = (await db_session.execute(select(KetQuaCLS).where(KetQuaCLS.chi_dinh_id == order_id))).scalar_one()
    await db_session.refresh(ket_qua)
    assert ket_qua.file_dinh_kem_urls == [b["url"]]

    # Sau khi duyệt: khóa thêm/xóa ảnh và sửa kết quả
    res_duyet = await api_client.post(f"/api/v1/subclinical/orders/{order_id}/approve", headers=ktv)
    assert res_duyet.status_code == 200, res_duyet.text
    assert (await api_client.delete(b["url"], headers=ktv)).status_code == 409
    assert (await _upload(api_client, order_id, ktv)).status_code == 409
    res_sua = await api_client.post(url_kq, json={"mo_ta_hinh_anh": "Sửa", "ket_luan": "Sửa"}, headers=ktv)
    assert res_sua.status_code == 409
    assert (upload_dir / str(order_id) / b["file_id"]).is_file()


@pytest.mark.asyncio
async def test_rang_buoc_trang_thai_va_nhom_dich_vu(api_client, booking, db_session, upload_dir):
    order_id, xn_id = await _tao_ca_cdha(api_client, booking, db_session, bat_dau=False)
    ktv = booking.tokens["ktv"]
    url_kq = f"/api/v1/subclinical/orders/{order_id}/imaging-result"

    # Chưa tiếp nhận ca thì chưa nhận ảnh / kết quả
    assert (await _upload(api_client, order_id, ktv)).status_code == 409
    assert (await api_client.post(url_kq, json={"mo_ta_hinh_anh": "a", "ket_luan": "b"}, headers=ktv)).status_code == 409

    await api_client.post(f"/api/v1/subclinical/orders/{order_id}/start", headers=ktv)
    await api_client.post(f"/api/v1/subclinical/orders/{xn_id}/start", headers=ktv)
    # Chỉ định xét nghiệm không dùng luồng ảnh CĐHA
    assert (await _upload(api_client, xn_id, ktv)).status_code == 409
    # Trả kết quả bắt buộc có mô tả và kết luận; nháp thì không
    assert (await api_client.post(url_kq, json={"mo_ta_hinh_anh": "  "}, headers=ktv)).status_code == 422
    res_nhap = await api_client.post(url_kq, json={"hoan_tat": False}, headers=ktv)
    assert res_nhap.status_code == 200
    assert (await api_client.post(url_kq, json={"ket_luan": "x", "ket_qua_phan_loai": "LA"}, headers=ktv)).status_code == 422
    assert (await api_client.get("/api/v1/subclinical/orders/999999999/imaging-result", headers=ktv)).status_code == 404
    assert (await _upload(api_client, 999999999, ktv)).status_code == 404
