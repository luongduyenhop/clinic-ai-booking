import pytest
from sqlalchemy import select
from app.models.medical import DichVu
from app.models.user import PhongKham
from app.models.compliance import NhatKyTruyCapDuLieuYTe


@pytest.mark.asyncio
async def test_get_services_admin_includes_tt22_and_rooms(api_client, booking, db_session):
    headers = booking.tokens["admin"]

    lab01 = (await db_session.execute(select(PhongKham).where(PhongKham.ma_phong == "LAB01"))).scalar_one_or_none()
    cdha01 = (await db_session.execute(select(PhongKham).where(PhongKham.ma_phong == "CDHA01"))).scalar_one_or_none()
    if not lab01:
        lab01 = PhongKham(
            ma_phong="LAB01",
            ten_phong="Phòng Xét Nghiệm Trung Tâm",
            loai_phong="xet_nghiem",
            tang="Tầng 1",
            is_active=True
        )
        db_session.add(lab01)
    if not cdha01:
        cdha01 = PhongKham(
            ma_phong="CDHA01",
            ten_phong="Phòng Chẩn Đoán Hình Ảnh (X-Quang/Siêu Âm)",
            loai_phong="chan_doan_hinh_anh",
            tang="Tầng 1",
            is_active=True
        )
        db_session.add(cdha01)
    await db_session.flush()

    services = (await db_session.execute(select(DichVu))).scalars().all()
    if len(services) < 5:
        existing_codes = {s.ma_dich_vu for s in services}
        sample_services = [
            DichVu(ma_dich_vu="DV_XN_MAU", ten_dich_vu="Tổng phân tích tế bào máu ngoại vi", don_gia=120000.0, don_vi_tinh="Lần", ma_nhom_byt="XN", ma_tu_dong_bhyt="01.0001.0001", phong_thuc_hien_id=lab01.id),
            DichVu(ma_dich_vu="DV_XQ_NGUC", ten_dich_vu="Chụp X-quang tim phổi thẳng", don_gia=180000.0, don_vi_tinh="Lần", ma_nhom_byt="CDHA", phong_thuc_hien_id=cdha01.id),
            DichVu(ma_dich_vu="DV_SA_BUNG", ten_dich_vu="Siêu âm ổ bụng tổng quát", don_gia=200000.0, don_vi_tinh="Lần", ma_nhom_byt="CDHA", phong_thuc_hien_id=cdha01.id),
            DichVu(ma_dich_vu="DV_ECG", ten_dich_vu="Điện tâm đồ (ECG) 12 chuyển đạo", don_gia=100000.0, don_vi_tinh="Lần", ma_nhom_byt="TDCN"),
            DichVu(ma_dich_vu="DV_NS_TMH", ten_dich_vu="Nội soi Tai - Mũi - Họng", don_gia=250000.0, don_vi_tinh="Lần", ma_nhom_byt="TT"),
        ]
        for svc in sample_services:
            if svc.ma_dich_vu not in existing_codes:
                db_session.add(svc)
        await db_session.flush()

    res = await api_client.get("/api/v1/admin/services", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) >= 5

    xn_svc = next((s for s in data if s["ma_dich_vu"] == "DV_XN_MAU"), None)
    assert xn_svc is not None
    assert xn_svc["ma_nhom_byt"] == "XN"
    assert xn_svc["ma_tu_dong_bhyt"] == "01.0001.0001"
    assert xn_svc["ma_phong_thuc_hien"] == "LAB01"
    assert "Xét Nghiệm" in xn_svc["ten_phong_thuc_hien"]

    xq_svc = next((s for s in data if s["ma_dich_vu"] == "DV_XQ_NGUC"), None)
    assert xq_svc is not None
    assert xq_svc["ma_nhom_byt"] == "CDHA"
    assert xq_svc["ma_phong_thuc_hien"] == "CDHA01"


@pytest.mark.asyncio
async def test_create_service_with_room_mapping(api_client, booking, db_session):
    headers = booking.tokens["admin"]
    
    lab_room = PhongKham(
        ma_phong=f"LAB_TEST_{booking.suffix}",
        ten_phong="Phòng Xét Nghiệm Test",
        loai_phong="xet_nghiem",
        tang="Tầng 1",
        is_active=True
    )
    db_session.add(lab_room)
    await db_session.flush()

    payload = {
        "ma_dich_vu": f"DV_HBA1C_{booking.suffix}",
        "ten_dich_vu": "Định lượng HbA1c bằng phương pháp HPLC",
        "don_gia": 150000.0,
        "don_vi_tinh": "Lần",
        "ma_nhom_byt": "XN",
        "ma_tu_dong_bhyt": "01.0001.0005",
        "phong_thuc_hien_id": lab_room.id,
        "quy_trinh_thuc_hien": "Lấy mẫu máu tĩnh mạch chống đông EDTA, chạy máy tự động"
    }
    res = await api_client.post("/api/v1/admin/services", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["ma_dich_vu"] == f"DV_HBA1C_{booking.suffix}"
    assert data["ma_nhom_byt"] == "XN"
    assert data["phong_thuc_hien_id"] == lab_room.id
    assert data["ma_phong_thuc_hien"] == lab_room.ma_phong
    assert data["ten_phong_thuc_hien"] == "Phòng Xét Nghiệm Test"


@pytest.mark.asyncio
async def test_create_service_rejects_nonexistent_room(api_client, booking):
    headers = booking.tokens["admin"]
    payload = {
        "ma_dich_vu": f"DV_INVALID_{booking.suffix}",
        "ten_dich_vu": "Dịch vụ phòng ma",
        "don_gia": 100000.0,
        "don_vi_tinh": "Lần",
        "phong_thuc_hien_id": 99999
    }
    res = await api_client.post("/api/v1/admin/services", json=payload, headers=headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_update_service_tat_and_guidelines(api_client, booking, db_session):
    headers = booking.tokens["admin"]

    payload_create = {
        "ma_dich_vu": f"DV_US_{booking.suffix}",
        "ten_dich_vu": "Siêu âm Doppler Tim màu",
        "don_gia": 300000.0,
        "don_vi_tinh": "Lần",
        "thoi_gian_tra_ket_qua_phut": 20,
        "huong_dan_chuan_bi": "Nghỉ ngơi trước siêu âm 15 phút",
    }
    create_res = await api_client.post("/api/v1/admin/services", json=payload_create, headers=headers)
    assert create_res.status_code == 201
    created_svc = create_res.json()["data"]
    svc_id = created_svc["id"]

    payload_update = {
        "don_gia": 350000.0,
        "thoi_gian_tra_ket_qua_phut": 25,
        "huong_dan_chuan_bi": "Nghỉ ngơi 15 phút, mang theo hồ sơ điện tâm đồ trước đó nếu có",
    }
    update_res = await api_client.put(f"/api/v1/admin/services/{svc_id}", json=payload_update, headers=headers)
    assert update_res.status_code == 200
    updated_data = update_res.json()["data"]
    assert updated_data["don_gia"] == 350000.0
    assert updated_data["thoi_gian_tra_ket_qua_phut"] == 25
    assert "mang theo hồ sơ điện tâm đồ" in updated_data["huong_dan_chuan_bi"]


@pytest.mark.asyncio
async def test_catalog_router_departments_crud(api_client, booking):
    headers = booking.tokens["admin"]
    create_payload = {
        "ma_chuyen_khoa": f"CK_TEST_{booking.suffix}".upper(),
        "ten_chuyen_khoa": f"Chuyên khoa Thử nghiệm {booking.suffix}",
        "mo_ta": "Mô tả chuyên khoa thử nghiệm",
        "vi_tri_phong": "Tầng 2",
        "is_active": True
    }
    create_res = await api_client.post("/api/v1/admin/catalog/departments", json=create_payload, headers=headers)
    assert create_res.status_code == 201
    dept_data = create_res.json()["data"]
    dept_id = dept_data["id"]
    assert dept_data["ma_chuyen_khoa"] == create_payload["ma_chuyen_khoa"]

    get_res = await api_client.get("/api/v1/admin/catalog/departments", headers=headers)
    assert get_res.status_code == 200
    depts = get_res.json()["data"]
    assert any(d["id"] == dept_id for d in depts)

    update_payload = {
        "ten_chuyen_khoa": f"Chuyên khoa Đã sửa {booking.suffix}",
        "mo_ta": "Mô tả mới",
        "vi_tri_phong": "Tầng 3",
        "is_active": True
    }
    update_res = await api_client.put(f"/api/v1/admin/catalog/departments/{dept_id}", json=update_payload, headers=headers)
    assert update_res.status_code == 200
    assert update_res.json()["data"]["ten_chuyen_khoa"] == update_payload["ten_chuyen_khoa"]

    del_res = await api_client.delete(f"/api/v1/admin/catalog/departments/{dept_id}", headers=headers)
    assert del_res.status_code == 200


@pytest.mark.asyncio
async def test_catalog_router_rooms_crud(api_client, booking):
    headers = booking.tokens["admin"]
    room_payload = {
        "ma_phong": f"PK_CAT_{booking.suffix}",
        "ten_phong": f"Phòng Khám Catalog {booking.suffix}",
        "tang": "Tầng 2",
        "loai_phong": "kham_benh",
        "thiet_bi_chinh": "Máy đo huyết áp, ống nghe"
    }
    create_res = await api_client.post("/api/v1/admin/catalog/rooms", json=room_payload, headers=headers)
    assert create_res.status_code == 201
    room_data = create_res.json()["data"]
    room_id = room_data["id"]

    get_res = await api_client.get("/api/v1/admin/catalog/rooms", headers=headers)
    assert get_res.status_code == 200
    rooms = get_res.json()["data"]
    assert any(r["id"] == room_id for r in rooms)

    update_res = await api_client.put(
        f"/api/v1/admin/catalog/rooms/{room_id}",
        json={"ten_phong": f"Phòng Khám Đã Sửa {booking.suffix}", "tang": "Tầng 3"},
        headers=headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["data"]["tang"] == "Tầng 3"

    del_res = await api_client.delete(f"/api/v1/admin/catalog/rooms/{room_id}", headers=headers)
    assert del_res.status_code == 200


@pytest.mark.asyncio
async def test_catalog_router_services_crud_and_prices(api_client, booking, db_session):
    headers = booking.tokens["admin"]
    svc_payload = {
        "ma_dich_vu": f"DV_CRU_{booking.suffix}",
        "ten_dich_vu": f"Dịch vụ Kỹ thuật Test {booking.suffix}",
        "don_gia": 220000.0,
        "don_vi_tinh": "Lần",
        "ma_nhom_byt": "TDCN",
        "thoi_gian_tra_ket_qua_phut": 15
    }
    create_res = await api_client.post("/api/v1/admin/catalog/services", json=svc_payload, headers=headers)
    assert create_res.status_code == 201
    svc_data = create_res.json()["data"]
    svc_id = svc_data["id"]

    get_res = await api_client.get("/api/v1/admin/catalog/services", headers=headers)
    assert get_res.status_code == 200
    services = get_res.json()["data"]
    assert any(s["id"] == svc_id for s in services)

    price_update_payload = {
        "service_id": svc_id,
        "don_gia": 260000.0,
        "ly_do": "Điều chỉnh theo biến động chi phí vật tư y tế"
    }
    price_res = await api_client.post("/api/v1/admin/catalog/prices", json=price_update_payload, headers=headers)
    assert price_res.status_code == 200
    price_data = price_res.json()["data"]
    assert price_data["don_gia_cu"] == 220000.0
    assert price_data["don_gia_moi"] == 260000.0

    history_res = await api_client.get(f"/api/v1/admin/catalog/prices/history?service_id={svc_id}", headers=headers)
    assert history_res.status_code == 200
    hist = history_res.json()["data"]
    assert len(hist) >= 1
    assert hist[0]["resource_id"] == svc_id
    assert hist[0]["noi_dung_cu"]["don_gia"] == 220000.0
    assert hist[0]["noi_dung_moi"]["don_gia"] == 260000.0

    audit_entry = (await db_session.execute(
        select(NhatKyTruyCapDuLieuYTe).where(
            NhatKyTruyCapDuLieuYTe.resource_type == "SERVICE_PRICE",
            NhatKyTruyCapDuLieuYTe.resource_id == svc_id
        )
    )).scalar_one_or_none()
    assert audit_entry is not None

    del_res = await api_client.delete(f"/api/v1/admin/catalog/services/{svc_id}", headers=headers)
    assert del_res.status_code == 200


@pytest.mark.asyncio
async def test_catalog_router_import_genuine_persistence(api_client, booking, db_session):
    headers = booking.tokens["admin"]
    import_payload = {
        "catalog_type": "services",
        "items": [
            {
                "ma_dich_vu": f"DV_IMP_1_{booking.suffix}",
                "ten_dich_vu": "Nội soi dạ dày gây mê",
                "don_gia": 900000.0,
                "don_vi_tinh": "Lần",
                "ma_nhom_byt": "TT"
            },
            {
                "ma_dich_vu": f"DV_IMP_2_{booking.suffix}",
                "ten_dich_vu": "Nội soi đại tràng toàn bộ",
                "don_gia": 1100000.0,
                "don_vi_tinh": "Lần",
                "ma_nhom_byt": "TT"
            }
        ]
    }
    res = await api_client.post("/api/v1/admin/catalog/import", json=import_payload, headers=headers)
    assert res.status_code == 200
    res_data = res.json()["data"]
    assert res_data["success"] is True
    assert res_data["imported_count"] == 2

    s1 = (await db_session.execute(select(DichVu).where(DichVu.ma_dich_vu == f"DV_IMP_1_{booking.suffix}"))).scalar_one_or_none()
    assert s1 is not None
    assert float(s1.don_gia) == 900000.0
