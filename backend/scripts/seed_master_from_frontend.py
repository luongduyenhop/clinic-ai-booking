import asyncio
import json
import os
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, engine, Base
from app.models.specialized import GoiDichVu, HopDongKhamDoan, NhanVienKhamDoan
from app.models.content import MauBieuYTe, CauHoiYKhoa, BaiVietTinTuc


async def seed_master_from_frontend():
    print("🌱 [SEED MASTER] Bắt đầu đồng bộ dữ liệu mẫu từ Frontend sang PostgreSQL...")
    seed_path = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "../../fe-clinic-ai-booking/src/services/admin/seed/clinicSeed.json",
        )
    )

    if not os.path.exists(seed_path):
        print(f"❌ [SEED MASTER] Không tìm thấy file seed tại: {seed_path}")
        return

    with open(seed_path, "r", encoding="utf-8") as f:
        json.load(f)

    async with AsyncSessionLocal() as session:
        # 1. Seed Gói Dịch Vụ Khám
        existing_pkg = (await session.execute(select(GoiDichVu))).first()
        if not existing_pkg:
            print("📦 [SEED MASTER] Đang seed Gói dịch vụ khám...")
            packages = [
                GoiDichVu(
                    ma_goi="GOI-TONG-QUAT-CB",
                    ten_goi="Gói Khám Sức Khỏe Tổng Quát Cơ Bản",
                    doi_tuong_ap_dung="NAM_NU_TRUONG_THANH",
                    don_gia_niem_yet=Decimal("1500000.00"),
                    don_gia_khuyen_mai=Decimal("1200000.00"),
                    mo_ta="Bao gồm khám tổng quát, xét nghiệm máu, tổng phân tích nước tiểu và chụp X-quang tim phổi.",
                    is_active=True,
                ),
                GoiDichVu(
                    ma_goi="GOI-TIM-MACH-VIP",
                    ten_goi="Gói Tầm Soát Tim Mạch & Huyết Áp Chuyên Sâu",
                    doi_tuong_ap_dung="NGUOI_CAO_TUOI",
                    don_gia_niem_yet=Decimal("2800000.00"),
                    don_gia_khuyen_mai=Decimal("2400000.00"),
                    mo_ta="Khám chuyên gia tim mạch, điện tâm đồ ECG 12 cần, siêu âm tim Doppler màu, xét nghiệm bộ mỡ máu Lipid.",
                    is_active=True,
                ),
                GoiDichVu(
                    ma_goi="GOI-NHI-KHOA-TIEM-CHUNG",
                    ten_goi="Gói Khám & Đánh Giá Phát Triển Thể Chất Nhi",
                    doi_tuong_ap_dung="TRE_EM",
                    don_gia_niem_yet=Decimal("800000.00"),
                    don_gia_khuyen_mai=Decimal("650000.00"),
                    mo_ta="Khám dinh dưỡng, chiều cao, cân nặng, tầm soát vi chất và tư vấn phác đồ tiêm chủng trọn gói.",
                    is_active=True,
                ),
            ]
            session.add_all(packages)
            await session.flush()

        # 2. Seed Hợp Đồng Khám Đoàn Doanh Nghiệp B2B
        existing_corp = (await session.execute(select(HopDongKhamDoan))).first()
        if not existing_corp:
            print("🏢 [SEED MASTER] Đang seed Hợp đồng khám đoàn công ty...")
            corp = HopDongKhamDoan(
                ma_hop_dong="HD-KD-2026-FPT",
                ten_cong_ty="Công ty Cổ phần Viễn thông FPT",
                ma_so_thue="0101778163",
                nguoi_dai_dien="Trần Minh Tuấn",
                so_dien_thoai="0903456789",
                so_luong_nhan_vien=50,
                ngay_bat_dau=date(2026, 10, 1),
                ngay_ket_thuc=date(2026, 10, 31),
                gia_tri_hop_dong=Decimal("75000000.00"),
                trang_thai="DANG_THUC_HIEN",
                ghi_chu="Khám sức khỏe định kỳ năm 2026 cho khối văn phòng",
            )
            session.add(corp)
            await session.flush()

            nv_list = [
                NhanVienKhamDoan(
                    hop_dong_id=corp.id,
                    ma_nhan_vien="FPT-001",
                    ho_ten="Nguyễn Quốc Huy",
                    ngay_sinh=date(1992, 4, 12),
                    gioi_tinh="Nam",
                    phong_ban="Khối Công nghệ & Hạ tầng",
                    so_dien_thoai="0912334455",
                    cccd_so="001092004512",
                    phan_loai_suc_khoe="LOAI_I",
                    trang_thai_kham="DA_KHAM",
                    ket_luan="Đủ sức khỏe làm việc",
                ),
                NhanVienKhamDoan(
                    hop_dong_id=corp.id,
                    ma_nhan_vien="FPT-002",
                    ho_ten="Lê Thị Mai",
                    ngay_sinh=date(1996, 8, 25),
                    gioi_tinh="Nữ",
                    phong_ban="Ban Nhân sự & Pháp chế",
                    so_dien_thoai="0988776655",
                    cccd_so="001196008899",
                    phan_loai_suc_khoe="LOAI_II",
                    trang_thai_kham="DA_KHAM",
                    ket_luan="Viêm họng nhẹ, đủ sức khỏe",
                ),
            ]
            session.add_all(nv_list)
            await session.flush()

        # 3. Seed Mẫu Biểu Y Tế (Mẫu chỉ định, Mẫu lời dặn)
        existing_tmpl = (await session.execute(select(MauBieuYTe))).first()
        if not existing_tmpl:
            print("📑 [SEED MASTER] Đang seed Mẫu biểu y tế...")
            templates = [
                MauBieuYTe(
                    ma_mau="MAU-CLS-TIM-MACH",
                    ten_mau="Bộ Chỉ Định Cận Lâm Sàng Tầm Soát Tăng Huyết Áp",
                    loai_mau="CHI_DINH_CLS",
                    noi_dung_text="Chỉ định gồm: Điện tâm đồ ECG 12 cần, X-quang tim phổi thẳng, Sinh hóa máu (Glucose, Creatinine, Lipid toàn phần).",
                    is_public=True,
                ),
                MauBieuYTe(
                    ma_mau="MAU-LOI-DAN-DA-DAY",
                    ten_mau="Lời Dặn Chăm Sóc Người Bệnh Viêm Loét Dạ Dày",
                    loai_mau="LOI_DAN",
                    noi_dung_text="Kiêng ăn đồ cay chua, rượu bia, cà phê; ăn đúng giờ; không thức khuya; uống thuốc đủ liều trước bữa ăn 30 phút.",
                    is_public=True,
                ),
            ]
            session.add_all(templates)
            await session.flush()

        # 4. Seed Hỏi Đáp Y Khoa (Q&A)
        existing_qa = (await session.execute(select(CauHoiYKhoa))).first()
        if not existing_qa:
            print("💬 [SEED MASTER] Đang seed Hỏi đáp y khoa...")
            qa_list = [
                CauHoiYKhoa(
                    tieu_de="Huyết áp bao nhiêu được coi là cao huyết áp?",
                    chuyen_muc="TIM_MACH",
                    cau_hoi="Tôi đo huyết áp tại nhà lúc nghỉ ngơi thường xuyên thấy mức 140/90 mmHg thì đã cần dùng thuốc chưa?",
                    cau_tra_loi="Theo hướng dẫn của Hội Tim Mạch Việt Nam, huyết áp từ 140/90 mmHg trở lên khi đo lặp lại nhiều lần được phân loại là Tăng huyết áp độ 1. Bạn cần đến phòng khám tim mạch để được bác sĩ khám chuyên sâu, đánh giá tổn thương cơ quan đích trước khi bắt đầu phác đồ điều trị.",
                    luot_xem=145,
                    is_published=True,
                ),
                CauHoiYKhoa(
                    tieu_de="Trẻ bị sốt co giật phụ huynh cần làm gì đầu tiên?",
                    chuyen_muc="NHI_KHOA",
                    cau_hoi="Bé nhà tôi 2 tuổi sốt cao 39.5 độ bị co giật nhẹ thì xử trí tại nhà như thế nào?",
                    cau_tra_loi="Đặt trẻ nằm nghiêng sang một bên nơi thông thoáng, nới lỏng quần áo, không nhét bất cứ vật cứng nào vào miệng trẻ. Dùng khăn ấm chườm nách và bẹn, sau đó đưa ngay trẻ đến cơ sở y tế gần nhất.",
                    luot_xem=289,
                    is_published=True,
                ),
            ]
            session.add_all(qa_list)
            await session.flush()

        # 5. Seed Tin Tức Y Học Thường Thức
        existing_news = (await session.execute(select(BaiVietTinTuc))).first()
        if not existing_news:
            print("📰 [SEED MASTER] Đang seed Tin tức y học thường thức...")
            news = [
                BaiVietTinTuc(
                    tieu_de="5 Thói quen buổi sáng giúp bảo vệ hệ tim mạch khỏe mạnh",
                    slug="5-thoi-quen-buoi-sang-bao-ve-tim-mach",
                    chuyen_muc="Y_HOC_THUONG_THUC",
                    anh_dai_dien_url="https://images.unsplash.com/photo-1505751172876-fa1923c5c528",
                    tom_tat="Uống nước ấm ngay sau khi thức dậy, tập thở sâu và hạn chế bật dậy đột ngột giúp giảm nguy cơ tai biến buổi sáng.",
                    noi_dung_html="<p>Buổi sáng từ 6h đến 9h là thời điểm huyết áp có xu hướng tăng sinh lý và độ nhớt của máu cao nhất trong ngày...</p>",
                    tac_gia="BS.CKI Nguyễn Văn An",
                    luot_xem=520,
                    is_published=True,
                ),
            ]
            session.add_all(news)
            await session.flush()

        await session.commit()
        print("✅ [SEED MASTER] Đồng bộ Master Data thành công 100%!")


if __name__ == "__main__":
    asyncio.run(seed_master_from_frontend())
