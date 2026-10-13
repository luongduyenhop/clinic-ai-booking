import pytest
from sqlalchemy import select
from app.models.medical import DichVu
from app.models.user import PhongKham


@pytest.mark.asyncio
async def test_get_services_admin_includes_tt22_and_rooms(api_client, booking, db_session):
    """Kiểm tra API lấy danh mục dịch vụ trả về đầy đủ phân nhóm Thông tư 22 và buồng thực hiện kỹ thuật"""
    headers = booking.tokens["admin"]

    # Đảm bảo có phòng LAB01, CDHA01 và danh mục dịch vụ nếu CSDL test chưa có
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

    # Kiểm tra dịch vụ xét nghiệm máu đã map đúng buồng LAB01
    xn_svc = next((s for s in data if s["ma_dich_vu"] == "DV_XN_MAU"), None)
    assert xn_svc is not None
    assert xn_svc["ma_nhom_byt"] == "XN"
    assert xn_svc["ma_tu_dong_bhyt"] == "01.0001.0001"
    assert xn_svc["ma_phong_thuc_hien"] == "LAB01"
    assert "Xét Nghiệm" in xn_svc["ten_phong_thuc_hien"]

    # Kiểm tra dịch vụ X-quang đã map đúng buồng CDHA01
    xq_svc = next((s for s in data if s["ma_dich_vu"] == "DV_XQ_NGUC"), None)
    assert xq_svc is not None
    assert xq_svc["ma_nhom_byt"] == "CDHA"
    assert xq_svc["ma_phong_thuc_hien"] == "CDHA01"


@pytest.mark.asyncio
async def test_create_service_with_room_mapping(api_client, booking, db_session):
    """Kiểm tra tạo mới dịch vụ kỹ thuật cận lâm sàng liên kết buồng kỹ thuật hợp lệ"""
    headers = booking.tokens["admin"]
    
    # Tạo phòng kỹ thuật riêng
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
    """Kiểm tra từ chối tạo dịch vụ nếu buồng thực hiện không tồn tại (404)"""
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
    """Kiểm tra cập nhật dịch vụ y tế: TAT, hướng dẫn chuẩn bị bệnh nhân và đơn giá"""
    headers = booking.tokens["admin"]

    # Tạo dịch vụ ban đầu
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

    # Cập nhật thông tin dịch vụ
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

