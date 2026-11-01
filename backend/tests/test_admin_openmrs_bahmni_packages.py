import pytest
from datetime import date, timedelta
from httpx import AsyncClient
from sqlalchemy import select
from app.models.user import ChuyenKhoa


@pytest.mark.asyncio
async def test_package_1_department_management(api_client: AsyncClient, booking, db_session):
    """
    GÓI 1: QUẢN LÝ DANH MỤC CHUYÊN KHOA KHÁM BỆNH (OpenMRS Department Catalog)
    - Xem danh sách chuyên khoa kèm số lượng bác sĩ và buồng khám
    - Tạo mới chuyên khoa
    - Cập nhật thông tin chuyên khoa
    """
    admin_hdr = booking.tokens["admin"]

    # 1. Đảm bảo có ít nhất 1 chuyên khoa trong CSDL test
    existing = (await db_session.execute(select(ChuyenKhoa))).scalars().first()
    if not existing:
        db_session.add(ChuyenKhoa(
            ma_chuyen_khoa="KHOA_NOI",
            ten_chuyen_khoa="Nội tổng quát",
            mo_ta="Khám và điều trị nội khoa",
            vi_tri_phong="Phòng 101 - Tầng 1"
        ))
        await db_session.flush()

    # Lấy danh sách chuyên khoa
    res = await api_client.get("/api/v1/admin/departments", headers=admin_hdr)
    assert res.status_code == 200
    depts = res.json()["data"]
    assert isinstance(depts, list)
    assert len(depts) >= 1
    assert "so_luong_bac_si" in depts[0]
    assert "so_luong_phong_kham" in depts[0]

    # 2. Tạo mới chuyên khoa
    unique_code = f"CK_TEST_{date.today().strftime('%m%d%H%M%S')}"
    create_payload = {
        "ma_chuyen_khoa": unique_code,
        "ten_chuyen_khoa": f"Khoa Kiểm Thử {unique_code}",
        "mo_ta": "Chuyên khoa phục vụ kiểm thử tự động",
        "vi_tri_phong": "Khu C - Tầng 3",
        "is_active": True
    }
    res_create = await api_client.post("/api/v1/admin/departments", json=create_payload, headers=admin_hdr)
    assert res_create.status_code == 201
    created_dept = res_create.json()["data"]
    assert created_dept["ma_chuyen_khoa"] == unique_code
    assert created_dept["ten_chuyen_khoa"] == f"Khoa Kiểm Thử {unique_code}"
    dept_id = created_dept["id"]

    # 3. Cập nhật chuyên khoa
    update_payload = {
        "ten_chuyen_khoa": f"Khoa Kiểm Thử Đã Sửa {unique_code}",
        "mo_ta": "Mô tả mới đã cập nhật",
        "vi_tri_phong": "Khu D - Tầng 4",
        "is_active": True
    }
    res_update = await api_client.put(f"/api/v1/admin/departments/{dept_id}", json=update_payload, headers=admin_hdr)
    assert res_update.status_code == 200
    updated_dept = res_update.json()["data"]
    assert updated_dept["ten_chuyen_khoa"] == f"Khoa Kiểm Thử Đã Sửa {unique_code}"
    assert updated_dept["vi_tri_phong"] == "Khu D - Tầng 4"


@pytest.mark.asyncio
async def test_package_2_weekly_roster_and_batch_generation(api_client: AsyncClient, booking):
    """
    GÓI 2: QUẢN LÝ LỊCH ĐỊNH KỲ TUẦN CỦA BÁC SĨ (Bahmni Weekly Roster Template & Batch Generator)
    - Lấy danh sách mẫu lịch tuần
    - Tạo mẫu lịch định kỳ tuần cho bác sĩ
    - Phát sinh ca trực tự động theo chu kỳ (Batch Generation) chống trùng phòng
    """
    admin_hdr = booking.tokens["admin"]
    doctor_id = booking.bs_x.id

    # 1. Lấy danh sách mẫu lịch
    res = await api_client.get(f"/api/v1/admin/rosters?doctor_id={doctor_id}", headers=admin_hdr)
    assert res.status_code == 200
    assert isinstance(res.json()["data"], list)

    # 2. Tạo mẫu ca trực tuần (ví dụ: Thứ 6 ca sáng)
    roster_payload = {
        "bac_si_id": doctor_id,
        "thu_trong_tuan": 6,  # Thứ 6
        "ca_lam_viec": "sang",
        "thoi_luong_slot_phut": 20,
        "gioi_han_ca_kham": 12,
        "han_muc_dat_truoc": 10,
        "han_muc_vang_lai": 2
    }
    res_create = await api_client.post("/api/v1/admin/rosters", json=roster_payload, headers=admin_hdr)
    # Có thể là 201 hoặc 409 nếu đã có từ trước
    if res_create.status_code == 201:
        created_roster = res_create.json()["data"]
        assert created_roster["thu_trong_tuan"] == 6
        assert created_roster["ca_lam_viec"] == "sang"
        assert created_roster["ten_thu_tieng_viet"] == "Thứ 6"

    # 3. Phát sinh ca trực tự động hàng loạt cho 7 ngày tới (Batch Generation)
    d_start = date.today() + timedelta(days=60)  # Chọn khoảng ngày xa để tránh trùng lịch có sẵn
    d_end = d_start + timedelta(days=14)
    batch_payload = {
        "tu_ngay": d_start.isoformat(),
        "den_ngay": d_end.isoformat(),
        "bac_si_ids": [doctor_id]
    }
    res_gen = await api_client.post("/api/v1/admin/rosters/generate-shifts", json=batch_payload, headers=admin_hdr)
    assert res_gen.status_code == 200
    gen_result = res_gen.json()["data"]
    assert "so_ca_tao_thanh_cong" in gen_result
    assert "so_ca_bo_qua_da_ton_tai" in gen_result
    assert "so_ca_xung_dot_phong" in gen_result
    assert gen_result["tong_so_ngay"] == 15


@pytest.mark.asyncio
async def test_package_3_doctor_leave_management(api_client: AsyncClient, booking):
    """
    GÓI 3: QUẢN LÝ NGÀY NGHỈ & LỊCH NGHỈ ĐỘT XUẤT CỦA BÁC SĨ (Absence Management)
    - Đăng ký nghỉ phép có kế hoạch (Planned Leave)
    - Xem danh sách đơn nghỉ phép
    - Phê duyệt nghỉ phép và kiểm tra ca trực bị khóa an toàn
    - Xem danh sách lịch hẹn bị ảnh hưởng để hỗ trợ dời lịch
    """
    admin_hdr = booking.tokens["admin"]
    doctor_id = booking.bs_x.id

    # 1. Đăng ký nghỉ phép từ ngày D đến D+2
    d_start = date.today() + timedelta(days=90)
    d_end = d_start + timedelta(days=2)
    leave_payload = {
        "bac_si_id": doctor_id,
        "loai_nghi": "NGHI_PHEP",
        "tu_ngay": d_start.isoformat(),
        "den_ngay": d_end.isoformat(),
        "ly_do": "Tham gia hội thảo Tim Mạch toàn quốc tại Đà Nẵng"
    }
    res_create = await api_client.post("/api/v1/admin/leaves", json=leave_payload, headers=admin_hdr)
    assert res_create.status_code == 201
    leave_data = res_create.json()["data"]
    leave_id = leave_data["id"]
    assert leave_data["trang_thai"] == "CHO_DUYET"
    assert leave_data["loai_nghi"] == "NGHI_PHEP"

    # 2. Xem danh sách đơn nghỉ phép
    res_list = await api_client.get(f"/api/v1/admin/leaves?doctor_id={doctor_id}", headers=admin_hdr)
    assert res_list.status_code == 200
    assert any(leave_item["id"] == leave_id for leave_item in res_list.json()["data"])

    # 3. Phê duyệt đơn nghỉ phép
    approve_payload = {
        "hanh_dong": "DA_DUYET",
        "ghi_chu": "Trưởng khoa chuyên môn đồng ý cho phép đi hội thảo."
    }
    res_app = await api_client.post(f"/api/v1/admin/leaves/{leave_id}/approve", json=approve_payload, headers=admin_hdr)
    assert res_app.status_code == 200
    assert res_app.json()["data"]["trang_thai"] == "DA_DUYET"

    # 4. Xem danh sách lịch hẹn bị ảnh hưởng
    res_affected = await api_client.get(f"/api/v1/admin/leaves/{leave_id}/affected-bookings", headers=admin_hdr)
    assert res_affected.status_code == 200
    assert isinstance(res_affected.json()["data"], list)


@pytest.mark.asyncio
async def test_package_4_ai_concept_mapping_and_accuracy(api_client: AsyncClient, booking, db_session):
    admin_hdr = booking.tokens["admin"]

    existing_ck = (await db_session.execute(select(ChuyenKhoa))).scalars().first()
    if not existing_ck:
        existing_ck = ChuyenKhoa(
            ma_chuyen_khoa=f"CK_AI_{booking.suffix}",
            ten_chuyen_khoa="Khoa Nội Test AI",
            mo_ta="Chuyên khoa test AI concept mapping",
            vi_tri_phong="Phòng 101"
        )
        db_session.add(existing_ck)
        await db_session.flush()

    unique_term = f"TT_TEST_{date.today().strftime('%m%d%H%M%S')}"
    res_concept = await api_client.post(
        "/api/v1/admin/ai/concepts",
        json={
            "ma_khai_niem": unique_term,
            "ten_khai_niem": f"Đau tức ngực kèm khó thở nhẹ {unique_term}",
            "loai_khai_niem": "trieu_chung",
            "chuyen_khoa_id": existing_ck.id,
            "mo_ta": "Triệu chứng thường gặp của bệnh lý cơ tim hoặc trào ngược"
        },
        headers=admin_hdr
    )
    assert res_concept.status_code == 201
    concept_id = res_concept.json()["data"]["id"]

    res_list_concepts = await api_client.get("/api/v1/admin/ai/concepts", headers=admin_hdr)
    assert res_list_concepts.status_code == 200
    assert any(c["id"] == concept_id for c in res_list_concepts.json()["data"])

    # 2. Từ khóa cấp cứu (Red Flags)
    unique_rf = f"cấp cứu thử nghiệm {date.today().strftime('%m%d%H%M%S')}"
    res_rf = await api_client.post(
        "/api/v1/admin/ai/red-flags",
        json={
            "tu_khoa": unique_rf,
            "muc_do_nguy_hiem": "rat_nguy_hiem",
            "huong_dan_xu_tri": "CẢNH BÁO NGUY HIỂM! Gọi 115 ngay lập tức!",
            "van_ban_byt_ref": "QĐ 1857/QĐ-BYT"
        },
        headers=admin_hdr
    )
    assert res_rf.status_code == 201
    rf_id = res_rf.json()["data"]["id"]

    res_list_rf = await api_client.get("/api/v1/admin/ai/red-flags", headers=admin_hdr)
    assert res_list_rf.status_code == 200
    assert any(r["id"] == rf_id for r in res_list_rf.json()["data"])

    # 3. Đo lường tỷ lệ gợi ý đúng của AI
    res_acc = await api_client.get("/api/v1/admin/ai/accuracy", headers=admin_hdr)
    assert res_acc.status_code == 200
    acc_data = res_acc.json()["data"]
    assert "tong_so_ca_phan_tich_ai" in acc_data
    assert "ty_le_chinh_xac_toan_vien_pct" in acc_data
    assert "danh_gia_sao_trung_binh" in acc_data
    assert isinstance(acc_data["chi_tiet_theo_chuyen_khoa"], list)


@pytest.mark.asyncio
async def test_package_5_comprehensive_analytics_report(api_client: AsyncClient, booking):
    """
    GÓI 5: XEM BÁO CÁO THỐNG KÊ CHUYÊN SÂU (Analytics & Intelligence)
    - Thống kê lượt đặt theo khoảng thời gian
    - Phân rã tỷ lệ và nguyên nhân hủy (Bệnh nhân hủy, Quá hạn 24h, Bác sĩ nghỉ)
    - Thống kê đặt hẹn theo chuyên khoa và độ chính xác AI
    """
    admin_hdr = booking.tokens["admin"]
    res = await api_client.get("/api/v1/admin/reports/analytics", headers=admin_hdr)
    assert res.status_code == 200
    data = res.json()["data"]
    assert "tong_luot_dat_kham" in data
    assert "so_luot_kham_hoan_tat" in data
    assert "phan_tich_huy" in data
    assert "benh_nhan_tu_huy" in data["phan_tich_huy"]
    assert "tu_dong_huy_qua_han_24h" in data["phan_tich_huy"]
    assert "phong_kham_huy_do_bac_si_nghi" in data["phan_tich_huy"]
    assert "thong_ke_chuyen_khoa" in data
    assert isinstance(data["thong_ke_chuyen_khoa"], list)


@pytest.mark.asyncio
async def test_package_6_patient_directory_and_management(api_client: AsyncClient, booking):
    """
    GÓI 6: QUẢN TRỊ HỒ SƠ BỆNH NHÂN (OpenMRS Master Patient Directory)
    - Danh sách bệnh nhân có tìm kiếm (Tên, SĐT, CCCD, Mã BN)
    - Xem chi tiết hồ sơ bệnh nhân, dị ứng, tiền sử và lịch sử khám
    - Khóa / Mở khóa quyền đặt lịch và điều chỉnh điểm tín nhiệm
    """
    admin_hdr = booking.tokens["admin"]

    # 1. Danh sách bệnh nhân
    res = await api_client.get("/api/v1/admin/patients", headers=admin_hdr)
    assert res.status_code == 200
    patients = res.json()["data"]
    assert isinstance(patients, list)
    assert len(patients) >= 1
    p_first = patients[0]
    assert "ma_dinh_danh_y_te" in p_first
    assert "diem_tin_nhiem" in p_first
    assert "is_blocked_booking" in p_first
    patient_id = p_first["id"]

    # 2. Chi tiết hồ sơ bệnh nhân
    res_detail = await api_client.get(f"/api/v1/admin/patients/{patient_id}", headers=admin_hdr)
    assert res_detail.status_code == 200
    detail = res_detail.json()["data"]
    assert detail["id"] == patient_id
    assert "lich_su_dat_kham" in detail
    assert isinstance(detail["lich_su_dat_kham"], list)

    # 3. Cập nhật quyền đặt lịch & điểm tín nhiệm
    status_payload = {
        "is_blocked_booking": True,
        "diem_tin_nhiem": 85,
        "ghi_chu_quan_tri": "Tạm khóa do cảnh báo no-show thử nghiệm"
    }
    res_update = await api_client.put(f"/api/v1/admin/patients/{patient_id}/status", json=status_payload, headers=admin_hdr)
    assert res_update.status_code == 200
    updated = res_update.json()["data"]
    assert updated["is_blocked_booking"] is True
    assert updated["diem_tin_nhiem"] == 85

    # Khôi phục lại trạng thái mở khóa
    await api_client.put(
        f"/api/v1/admin/patients/{patient_id}/status",
        json={"is_blocked_booking": False, "diem_tin_nhiem": 100},
        headers=admin_hdr
    )
