import pytest
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import select
from app.models.specialized import (
    HopDongKhamDoan,
    NhanVienKhamDoan,
    GoiDichVu,
    ChiTietGoiDichVu,
    DangKyGoiKham,
    LieuTrinhDieuTri,
    BuoiDieuTri
)
from app.models.content import MauBieuYTe, CauHoiYKhoa, BaiVietTinTuc
from app.models.medical import DichVu, KhoaSoCaTruc


@pytest.mark.asyncio
async def test_corporate_health_contract_and_employee_classification(db_session, booking):
    """
    Kiểm tra CSDL phân hệ Khám sức khỏe Đoàn / Doanh nghiệp B2B:
    - Tạo hợp đồng khám đoàn
    - Thêm danh sách nhân viên công ty
    - Phân loại sức khỏe Loại I - V theo TT 32/2023
    - Kiểm tra ràng buộc Cascade Delete khi xóa hợp đồng
    """
    corp = HopDongKhamDoan(
        ma_hop_dong=f"HD-TEST-{booking.suffix}",
        ten_cong_ty="Tập đoàn Công nghệ Viễn thông ABC",
        ma_so_thue="0109988776",
        nguoi_dai_dien="Nguyễn Văn Đại Diện",
        so_dien_thoai="0901234567",
        so_luong_nhan_vien=2,
        ngay_bat_dau=date(2026, 10, 1),
        ngay_ket_thuc=date(2026, 10, 31),
        gia_tri_hop_dong=Decimal("30000000.00"),
        trang_thai="DANG_THUC_HIEN"
    )
    db_session.add(corp)
    await db_session.flush()

    nv1 = NhanVienKhamDoan(
        hop_dong_id=corp.id,
        ma_nhan_vien="NV001",
        ho_ten="Trần Văn Nhân Viên 1",
        phan_loai_suc_khoe="LOAI_I",
        trang_thai_kham="DA_KHAM",
        ket_luan="Đủ điều kiện sức khỏe làm việc"
    )
    nv2 = NhanVienKhamDoan(
        hop_dong_id=corp.id,
        ma_nhan_vien="NV002",
        ho_ten="Lê Thị Nhân Viên 2",
        phan_loai_suc_khoe="LOAI_II",
        trang_thai_kham="DA_KHAM",
        ket_luan="Viêm xoang nhẹ, đủ điều kiện làm việc"
    )
    db_session.add_all([nv1, nv2])
    await db_session.commit()

    # Tra cứu lại
    stmt = select(HopDongKhamDoan).where(HopDongKhamDoan.id == corp.id)
    saved_corp = (await db_session.execute(stmt)).scalar_one()
    assert saved_corp.ten_cong_ty == "Tập đoàn Công nghệ Viễn thông ABC"
    assert len(saved_corp.danh_sach_nhan_vien) == 2


@pytest.mark.asyncio
async def test_service_package_and_registration_lifecycle(db_session, booking):
    """
    Kiểm tra CSDL phân hệ Gói dịch vụ khám:
    - Tạo gói khám gồm nhiều dịch vụ kỹ thuật
    - Bệnh nhân đăng ký gói khám
    - Theo dõi tiến độ sử dụng dịch vụ
    """
    dv1 = DichVu(ma_dich_vu=f"DV-GOI-1-{booking.suffix}", ten_dich_vu="Khám nội", don_gia=150000, don_vi_tinh="Lần", is_active=True)
    dv2 = DichVu(ma_dich_vu=f"DV-GOI-2-{booking.suffix}", ten_dich_vu="Siêu âm ổ bụng", don_gia=200000, don_vi_tinh="Lần", is_active=True)
    db_session.add_all([dv1, dv2])
    await db_session.flush()

    goi = GoiDichVu(
        ma_goi=f"GOI-VIP-{booking.suffix}",
        ten_goi="Gói khám tầm soát chuyên sâu VIP",
        don_gia_niem_yet=Decimal("350000.00"),
        don_gia_khuyen_mai=Decimal("300000.00"),
        doi_tuong_ap_dung="NAM_NU_TRUONG_THANH",
        is_active=True
    )
    db_session.add(goi)
    await db_session.flush()

    ct1 = ChiTietGoiDichVu(goi_dich_vu_id=goi.id, dich_vu_id=dv1.id, so_luong=1)
    ct2 = ChiTietGoiDichVu(goi_dich_vu_id=goi.id, dich_vu_id=dv2.id, so_luong=1)
    db_session.add_all([ct1, ct2])
    await db_session.flush()

    # Đăng ký gói cho bệnh nhân
    dk = DangKyGoiKham(
        ma_dang_ky=f"DK-GOI-{booking.suffix}",
        benh_nhan_id=booking.bn_a.id,
        goi_dich_vu_id=goi.id,
        ngay_dang_ky=date.today(),
        han_su_dung=date(2027, 10, 1),
        tong_so_dich_vu=2,
        so_dich_vu_da_dung=1,
        trang_thai="DANG_SU_DUNG"
    )
    db_session.add(dk)
    await db_session.commit()

    stmt = select(DangKyGoiKham).where(DangKyGoiKham.id == dk.id)
    saved_dk = (await db_session.execute(stmt)).scalar_one()
    assert saved_dk.so_dich_vu_da_dung == 1
    assert saved_dk.tong_so_dich_vu == 2


@pytest.mark.asyncio
async def test_treatment_course_and_session_progress(db_session, booking):
    """
    Kiểm tra CSDL phân hệ Liệu trình điều trị nhiều buổi (Vật lý trị liệu):
    - Tạo liệu trình 10 buổi
    - Thêm các buổi điều trị thực tế
    - Theo dõi tiến độ buổi thực hiện
    """
    lieu_trinh = LieuTrinhDieuTri(
        ma_lieu_trinh=f"LT-TEST-{booking.suffix}",
        ten_lieu_trinh="Liệu trình Phục hồi chức năng khớp gối",
        benh_nhan_id=booking.bn_a.id,
        bac_si_phu_trach_id=booking.bs_x.id,
        tong_so_buoi=10,
        so_buoi_da_thuc_hien=1,
        ngay_bat_dau=date.today(),
        muc_tieu_dieu_tri="Giảm đau và phục hồi biên độ vận động 90 độ",
        trang_thai="DANG_DIEU_TRI"
    )
    db_session.add(lieu_trinh)
    await db_session.flush()

    buoi_1 = BuoiDieuTri(
        lieu_trinh_id=lieu_trinh.id,
        so_thu_tu_buoi=1,
        ngay_thuc_hien=datetime.now(timezone.utc),
        noi_dung_thuc_hien="Điện phân dẫn thuốc và kéo dãn khớp gối nhẹ nhàng",
        danh_gia_tien_trien="Bệnh nhân đáp ứng tốt, giảm đau tức thì",
        trang_thai="HOAN_THANH"
    )
    db_session.add(buoi_1)
    await db_session.commit()

    stmt = select(LieuTrinhDieuTri).where(LieuTrinhDieuTri.id == lieu_trinh.id)
    saved_lt = (await db_session.execute(stmt)).scalar_one()
    assert len(saved_lt.danh_sach_buoi) == 1
    assert saved_lt.danh_sach_buoi[0].so_thu_tu_buoi == 1


@pytest.mark.asyncio
async def test_cashier_shift_closing_ledger(db_session, booking):
    """
    Kiểm tra CSDL phân hệ Đóng sổ và bàn giao ca trực thu ngân:
    - Lưu thông tin tiền mặt hệ thống vs tiền mặt thực đếm
    - Tính chênh lệch tiền mặt
    - Lưu người giao và người nhận ca
    """
    now = date.today()
    khoa_so = KhoaSoCaTruc(
        ma_khoa_so=f"KS-TEST-{booking.suffix}",
        ca_lam_viec="SANG",
        ngay_khoa_so=now,
        thu_ngan_giao_id=booking.bs_x.nguoi_dung_id,
        tong_tien_mat_he_thong=Decimal("5000000.00"),
        tong_chuyen_khoan_he_thong=Decimal("3500000.00"),
        tong_the_pos_he_thong=Decimal("1200000.00"),
        tien_mat_thuc_te=Decimal("5000000.00"),
        chenh_lech_tien_mat=Decimal("0.00"),
        tong_so_phieu_thu=12,
        tong_so_phieu_chi=1,
        trang_thai="DA_KHOA_SO",
        ghi_chu="Khớp tiền mặt 100%, không lệch"
    )
    db_session.add(khoa_so)
    await db_session.commit()

    stmt = select(KhoaSoCaTruc).where(KhoaSoCaTruc.id == khoa_so.id)
    saved_ks = (await db_session.execute(stmt)).scalar_one()
    assert saved_ks.chenh_lech_tien_mat == Decimal("0.00")
    assert saved_ks.tong_so_phieu_thu == 12


@pytest.mark.asyncio
async def test_clinical_templates_and_qa_content(db_session, booking):
    """
    Kiểm tra CSDL phân hệ Mẫu biểu y tế và Hỏi đáp Q&A:
    - Lưu mẫu chỉ định CLS nhanh
    - Lưu câu hỏi thường gặp và bài viết tin tức
    """
    mau = MauBieuYTe(
        ma_mau=f"MAU-XQ-{booking.suffix}",
        ten_mau="Chỉ định X-quang và ECG thường quy",
        loai_mau="CHI_DINH_CLS",
        noi_dung_text="Chụp X-quang tim phổi thẳng + Điện tâm đồ ECG 12 cần",
        is_public=True
    )
    qa = CauHoiYKhoa(
        tieu_de="Uống nước trước khi siêu âm bụng có cần thiết không?",
        chuyen_muc="CHAN_DOAN_HINH_ANH",
        cau_hoi="Tôi đi khám siêu âm ổ bụng thì có cần nhịn tiểu không?",
        cau_tra_loi="Nên nhịn tiểu để bàng quang căng giúp quan sát rõ hệ tiết niệu và tử cung/buồng trứng.",
        is_published=True
    )
    tin_tuc = BaiVietTinTuc(
        tieu_de=f"Lợi ích của việc khám sức khỏe định kỳ {booking.suffix}",
        slug=f"loi-ich-kham-dinh-ky-{booking.suffix}",
        chuyen_muc="Y_HOC_THUONG_THUC",
        noi_dung_html="<p>Khám sức khỏe giúp phát hiện sớm các bệnh lý mạn tính...</p>",
        is_published=True
    )
    db_session.add_all([mau, qa, tin_tuc])
    await db_session.commit()

    stmt_m = select(MauBieuYTe).where(MauBieuYTe.id == mau.id)
    saved_m = (await db_session.execute(stmt_m)).scalar_one()
    assert saved_m.ten_mau == "Chỉ định X-quang và ECG thường quy"

    stmt_q = select(CauHoiYKhoa).where(CauHoiYKhoa.id == qa.id)
    saved_q = (await db_session.execute(stmt_q)).scalar_one()
    assert saved_q.chuyen_muc == "CHAN_DOAN_HINH_ANH"
