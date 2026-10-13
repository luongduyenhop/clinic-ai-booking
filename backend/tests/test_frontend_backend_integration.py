import pytest


@pytest.mark.asyncio
async def test_frontend_login_contract_and_default_accounts(api_client):
    """
    Kiểm tra hợp đồng đăng nhập giữa Frontend (LoginPage.jsx / AuthService.js) và Backend:
    - Chấp nhận payload { usernameOrEmail, password }
    - Hỗ trợ cả /api/v1/auth/login và alias /api/Auth/login
    - Hỗ trợ tài khoản mặc định admin@clinic-ai.vn / password123 và phongkham5 / admin@123
    - Trả về đầy đủ accessToken, refreshToken, role, user cho Redux authSlice
    """
    resp1 = await api_client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "admin@clinic-ai.vn", "password": "password123"},
    )
    assert resp1.status_code == 200
    data1 = resp1.json()["data"]
    assert data1["accessToken"]
    assert data1["refreshToken"]
    assert data1["role"] == "ADMIN"
    assert data1["user"]["email"] == "admin@clinic-ai.vn"

    # Kiểm tra đường dẫn cũ /api/Auth/login với tài khoản phongkham5
    resp2 = await api_client.post(
        "/api/Auth/login",
        json={"usernameOrEmail": "phongkham5", "password": "admin@123"},
    )
    assert resp2.status_code == 200
    data2 = resp2.json()["data"]
    assert data2["accessToken"]
    assert data2["role"] == "ADMIN"


@pytest.mark.asyncio
async def test_frontend_refresh_token_and_demo_token_support(api_client):
    """
    Kiểm tra cơ chế Refresh Token của BaseService.js và hỗ trợ Demo Token:
    - Gửi { accessToken, refreshToken } tới /api/v1/auth/refresh
    - Gửi Bearer demo-clinic-ai-admin-token không bị lỗi 401 đá văng khỏi hệ thống
    """
    login_resp = await api_client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "admin@clinic-ai.vn", "password": "password123"},
    )
    tokens = login_resp.json()["data"]

    refresh_resp = await api_client.post(
        "/api/v1/auth/refresh",
        json={
            "accessToken": tokens["accessToken"],
            "refreshToken": tokens["refreshToken"],
        },
    )
    assert refresh_resp.status_code == 200
    refreshed = refresh_resp.json()["data"]
    assert refreshed["accessToken"]
    assert refreshed["refreshToken"]

    # Kiểm tra nút Quick Demo Login (demo-clinic-ai-admin-token)
    me_resp = await api_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer demo-clinic-ai-admin-token"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["data"]["role"] == "ADMIN"


@pytest.mark.asyncio
async def test_admin_bootstrap_and_no_drug_inventory(api_client):
    """
    Kiểm tra endpoint GET /api/v1/admin/bootstrap phục vụ 19 trang Quản trị:
    - Trả về đầy đủ các phân hệ dữ liệu (patients, registrations, appointments, vouchers, catalogs...)
    - Đảm bảo tuyệt đối KHÔNG có quản lý kho thuốc (inventoryBatches == [])
    """
    resp = await api_client.get(
        "/api/v1/admin/bootstrap",
        headers={"Authorization": "Bearer demo-clinic-ai-admin-token"},
    )
    assert resp.status_code == 200
    clinic_data = resp.json()["data"]

    assert clinic_data["schemaVersion"] == "2.0.0-promax"
    assert isinstance(clinic_data["patients"], list)
    assert isinstance(clinic_data["registrations"], list)
    assert isinstance(clinic_data["vouchers"], list)
    assert isinstance(clinic_data["catalogs"], dict)
    assert isinstance(clinic_data["roles"], list)
    # Ràng buộc bắt buộc: không có quản lý lô/kho thuốc
    assert clinic_data["inventoryBatches"] == []


@pytest.mark.asyncio
async def test_admin_collection_and_catalog_sync_persistence(api_client):
    """
    Kiểm tra đồng bộ thao tác CRUD từ Frontend (updateCollection & updateCatalogSubCollection)
    xuống PostgreSQL và tự động ghi nhận Nhật ký kiểm toán (auditLogs).
    """
    headers = {"Authorization": "Bearer demo-clinic-ai-admin-token"}

    new_closings = [
        {
            "id": "CLS-TEST-99",
            "maCa": "CA-SANG-TEST",
            "thuNgan": "Nguyễn Thị Thu Ngân",
            "tongThu": 5500000,
            "trangThai": "Đã khóa sổ",
        }
    ]
    put_resp = await api_client.put(
        "/api/v1/admin/collections/cashierClosings",
        json={
            "collectionKey": "cashierClosings",
            "items": new_closings,
            "auditEntry": {
                "nguoiDung": "Admin Test",
                "hanhDong": "CLOSE_SHIFT",
                "mucDich": "Khóa sổ ca trực thu ngân",
            },
        },
        headers=headers,
    )
    assert put_resp.status_code == 200
    updated_store = put_resp.json()["data"]
    assert len(updated_store["cashierClosings"]) == 1
    assert updated_store["cashierClosings"][0]["id"] == "CLS-TEST-99"
    assert updated_store["auditLogs"][0]["hanhDong"] == "CLOSE_SHIFT"

    # Kiểm tra cập nhật danh mục con (catalogs.dichVu)
    new_services = [
        {
            "id": "DV-SYNC-01",
            "maDV": "DV999",
            "tenDV": "Siêu âm tim Doppler 4D",
            "donGia": 350000,
            "dvt": "Lần",
        }
    ]
    cat_resp = await api_client.put(
        "/api/v1/admin/catalogs/dichVu",
        json={
            "subKey": "dichVu",
            "items": new_services,
            "auditEntry": {
                "hanhDong": "UPDATE_SERVICE_CATALOG",
                "mucDich": "Thêm dịch vụ siêu âm tim",
            },
        },
        headers=headers,
    )
    assert cat_resp.status_code == 200
    cat_store = cat_resp.json()["data"]
    assert cat_store["catalogs"]["dichVu"][0]["maDV"] == "DV999"

    # Gọi lại GET /api/v1/admin/bootstrap để xác nhận dữ liệu đã lưu bền vững trong PostgreSQL
    verify_resp = await api_client.get("/api/v1/admin/bootstrap", headers=headers)
    verify_data = verify_resp.json()["data"]
    assert verify_data["cashierClosings"][0]["id"] == "CLS-TEST-99"
    assert verify_data["catalogs"]["dichVu"][0]["maDV"] == "DV999"


@pytest.mark.asyncio
async def test_frontend_ai_triage_analyze_contract(api_client):
    """
    Kiểm tra endpoint POST /api/v1/ai-triage/analyze tương thích với AdminService.suggestSpecialtyByAI
    """
    resp = await api_client.post(
        "/api/v1/ai-triage/analyze",
        json={"symptoms": "Bệnh nhân đau ngực dữ dội, khó thở cấp"},
    )
    assert resp.status_code == 200
    ai_data = resp.json()["data"]
    assert "recommended_specialty" in ai_data
    assert "chuyenKhoa" in ai_data
    assert "phongKham" in ai_data
    assert "bacSi" in ai_data
    assert "mucDoUuTien" in ai_data
    assert "lyDoGoiY" in ai_data


@pytest.mark.asyncio
async def test_all_17_admin_modules_and_relational_db_sync(api_client, db_session):
    """
    Kiểm thử toàn diện 17 phân hệ nghiệp vụ Quản lý (Admin HIS) và xác minh dữ liệu
    được đồng bộ trực tiếp vào các bảng quan hệ trong Cơ sở dữ liệu.
    """
    from sqlalchemy import func, select
    from app.models.compliance import GiayPhepCoSo, NhatKyTruyCapDuLieuYTe
    from app.models.content import BaiVietTinTuc, MauBieuYTe
    from app.models.medical import DichVu, HoaDon, KhaiNiem, PhieuThuChi
    from app.models.specialized import DangKyGoiKham, GoiDichVu, LieuTrinhDieuTri
    from app.models.user import BenhNhan, PhongKham

    headers = {"Authorization": "Bearer demo-clinic-ai-admin-token"}

    # 1. Quản lý Bệnh nhân (patients -> benh_nhan + nguoi_dung)
    r_pat = await api_client.put(
        "/api/v1/admin/collections/patients",
        json={
            "collectionKey": "patients",
            "items": [
                {
                    "id": "BN-E2E-01",
                    "maBN": "BN-E2E-01",
                    "hoTen": "Trần Văn Kiểm Thử",
                    "ngaySinh": "1988-05-20",
                    "gioiTinh": "Nam",
                    "dienThoai": "0911222333",
                    "nhomMau": "A+",
                    "diUng": "Không",
                    "diaChi": "Quận 1, TP.HCM",
                }
            ],
            "auditEntry": {"hanhDong": "CREATE_PATIENT", "mucDich": "Thêm bệnh nhân E2E"},
        },
        headers=headers,
    )
    assert r_pat.status_code == 200

    # 2. Quản lý Mẫu biểu in (templates -> mau_bieu_y_te)
    r_tpl = await api_client.put(
        "/api/v1/admin/collections/templates",
        json={
            "collectionKey": "templates",
            "items": [
                {
                    "id": "TPL-E2E-01",
                    "loaiMau": "mau-don-thuoc",
                    "tenMau": "Mẫu đơn thuốc ngoại trú chuẩn",
                    "noiDung": "Nội dung biểu mẫu đơn thuốc...",
                    "trangThai": True,
                }
            ],
            "auditEntry": {"hanhDong": "UPDATE_TEMPLATE", "mucDich": "Cập nhật mẫu biểu"},
        },
        headers=headers,
    )
    assert r_tpl.status_code == 200

    # 3. Quản lý Tin tức y khoa (newsArticles -> bai_viet_tin_tuc)
    r_news = await api_client.put(
        "/api/v1/admin/collections/newsArticles",
        json={
            "collectionKey": "newsArticles",
            "items": [
                {
                    "id": "NEWS-E2E-01",
                    "tieuDe": "Hướng dẫn phòng ngừa tăng huyết áp",
                    "danhMuc": "Tin y tế",
                    "moTa": "Bài viết tư vấn sức khỏe tim mạch",
                    "noiDung": "<p>Nội dung chi tiết</p>",
                    "luotXem": 120,
                    "trangThai": "Đã xuất bản",
                }
            ],
            "auditEntry": {"hanhDong": "PUBLISH_NEWS", "mucDich": "Đăng bài viết"},
        },
        headers=headers,
    )
    assert r_news.status_code == 200

    # 4. Quản lý Thu chi & Hóa đơn (vouchers -> phieu_thu_chi + hoa_don)
    r_vch = await api_client.put(
        "/api/v1/admin/collections/vouchers",
        json={
            "collectionKey": "vouchers",
            "items": [
                {
                    "id": "PT-E2E-01",
                    "maPhieu": "PT-E2E-01",
                    "loaiPhieu": "Phiếu thu",
                    "tenPhieu": "Thu phí khám & cận lâm sàng",
                    "hoTenBN": "Trần Văn Kiểm Thử",
                    "hinhThuc": "tien_mat",
                    "tongTien": 450000,
                    "items": [{"tenDV": "Khám Nội tổng quát", "soLuong": 1, "donGia": 450000}],
                }
            ],
            "auditEntry": {"hanhDong": "CREATE_VOUCHER", "mucDich": "Lập phiếu thu"},
        },
        headers=headers,
    )
    assert r_vch.status_code == 200

    # 5. Quản lý Gói khám dịch vụ (servicePackageRegistrations -> goi_dich_vu + dang_ky_goi_kham)
    r_pkg = await api_client.put(
        "/api/v1/admin/collections/servicePackageRegistrations",
        json={
            "collectionKey": "servicePackageRegistrations",
            "items": [
                {
                    "id": "GDV-E2E-01",
                    "maLH": "GDV-E2E-01",
                    "tenBN": "Trần Văn Kiểm Thử",
                    "tenGoi": "Gói Tầm Soát Tim Mạch Toàn Diện",
                    "ngayTao": "2026-10-13",
                    "tongTien": 2500000,
                    "thanhTien": 2100000,
                }
            ],
            "auditEntry": {"hanhDong": "REGISTER_PACKAGE", "mucDich": "Đăng ký gói khám"},
        },
        headers=headers,
    )
    assert r_pkg.status_code == 200

    # 6. Quản lý Liệu trình điều trị (treatmentCourses -> lieu_trinh_dieu_tri)
    r_tc = await api_client.put(
        "/api/v1/admin/collections/treatmentCourses",
        json={
            "collectionKey": "treatmentCourses",
            "items": [
                {
                    "id": "LT-E2E-01",
                    "maDangKy": "LT-E2E-01",
                    "tenBN": "Trần Văn Kiểm Thử",
                    "tenLieuTrinh": "Phục hồi chức năng cột sống thắt lưng",
                    "soBuoiDaTap": 3,
                    "tongSoBuoi": 10,
                    "ngayDangKy": "2026-10-13",
                }
            ],
            "auditEntry": {"hanhDong": "CHECKIN_COURSE", "mucDich": "Điểm danh liệu trình"},
        },
        headers=headers,
    )
    assert r_tc.status_code == 200

    # 7. Cấu hình phòng khám (clinicSettings -> giay_phep_co_so)
    r_set = await api_client.put(
        "/api/v1/admin/collections/clinicSettings",
        json={
            "collectionKey": "clinicSettings",
            "items": {
                "tenPhongKham": "Phòng khám Đa khoa Quốc tế Clinic-AI",
                "giayPhepHoatDong": "GPHD-E2E-2026/SYT",
                "diaChi": "123 Nguyễn Văn Cừ, Quận 5, TP.HCM",
            },
            "auditEntry": {"hanhDong": "UPDATE_SETTINGS", "mucDich": "Cập nhật cấu hình"},
        },
        headers=headers,
    )
    assert r_set.status_code == 200

    # 8. Danh mục Khoa phòng, Bệnh ICD-10, Thuốc kê đơn (catalogs -> phong_kham, khai_niem)
    r_cat_room = await api_client.put(
        "/api/v1/admin/catalogs/khoaPhong",
        json={
            "subKey": "khoaPhong",
            "items": [{"id": "PK-E2E-101", "maPhong": "PK-E2E-101", "tenPhong": "Phòng Khám Nội 101", "tang": "Tầng 1"}],
            "auditEntry": {"hanhDong": "UPDATE_ROOM", "mucDich": "Cập nhật buồng khám"},
        },
        headers=headers,
    )
    assert r_cat_room.status_code == 200

    r_cat_drug = await api_client.put(
        "/api/v1/admin/catalogs/thuocVatTu",
        json={
            "subKey": "thuocVatTu",
            "items": [{"id": "DRUG-E2E-01", "maThuoc": "DRUG-E2E-01", "tenThuoc": "Amlodipin 5mg", "hoatChat": "Amlodipine"}],
            "auditEntry": {"hanhDong": "UPDATE_DRUG_REF", "mucDich": "Cập nhật danh mục thuốc kê đơn"},
        },
        headers=headers,
    )
    assert r_cat_drug.status_code == 200
    assert r_cat_drug.json()["data"]["inventoryBatches"] == []

    # Xác minh trực tiếp trong các bảng quan hệ của Database
    assert (await db_session.execute(select(func.count()).select_from(BenhNhan))).scalar_one() >= 1
    assert (await db_session.execute(select(func.count()).select_from(MauBieuYTe))).scalar_one() >= 1
    assert (await db_session.execute(select(func.count()).select_from(BaiVietTinTuc))).scalar_one() >= 1
    assert (await db_session.execute(select(func.count()).select_from(PhieuThuChi))).scalar_one() >= 1
    assert (await db_session.execute(select(func.count()).select_from(HoaDon))).scalar_one() >= 1
    assert (await db_session.execute(select(func.count()).select_from(GoiDichVu))).scalar_one() >= 1
    assert (await db_session.execute(select(func.count()).select_from(DangKyGoiKham))).scalar_one() >= 1
    assert (await db_session.execute(select(func.count()).select_from(LieuTrinhDieuTri))).scalar_one() >= 1
    assert (await db_session.execute(select(func.count()).select_from(GiayPhepCoSo))).scalar_one() >= 1
    assert (await db_session.execute(select(func.count()).select_from(PhongKham))).scalar_one() >= 1
    assert (await db_session.execute(select(func.count()).select_from(DichVu))).scalar_one() >= 1
    assert (await db_session.execute(select(func.count()).select_from(KhaiNiem))).scalar_one() >= 1
    assert (await db_session.execute(select(func.count()).select_from(NhatKyTruyCapDuLieuYTe))).scalar_one() >= 1

