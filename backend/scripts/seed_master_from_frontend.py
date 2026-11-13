import asyncio
import json
import os
from decimal import Decimal
from sqlalchemy import select
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.specialized import GoiDichVu
from app.models.content import MauBieuYTe, CauHoiYKhoa, BaiVietTinTuc


async def seed_master_from_frontend(confirm_seed_demo: bool = False):
    if settings.ENVIRONMENT.lower() in ("production", "prod"):
        raise RuntimeError("THAO TÁC BỊ CHẶN: Tuyệt đối không nạp dữ liệu demo trên môi trường PRODUCTION!")
    if not confirm_seed_demo:
        raise RuntimeError("THAO TÁC BỊ CHẶN: Cần truyền --confirm-seed-demo để xác nhận nạp dữ liệu mẫu!")
    if not settings.ENABLE_DEMO_SEED:
        raise RuntimeError("THAO TÁC BỊ CHẶN: Cần cấu hình ENABLE_DEMO_SEED=true trong môi trường demo/staging!")

    seed_path = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "../../fe-clinic-ai-booking/src/services/admin/seed/clinicSeed.json",
        )
    )

    if not os.path.exists(seed_path):
        return

    with open(seed_path, "r", encoding="utf-8") as f:
        json.load(f)

    async with AsyncSessionLocal() as session:
        existing_pkg = (await session.execute(select(GoiDichVu))).first()
        if not existing_pkg:
            packages = [
                GoiDichVu(
                    ma_goi="GOI-TONG-QUAT-CB",
                    ten_goi="Gói Khám Sức Khỏe Tổng Quát Cơ Bản [DEMO]",
                    doi_tuong_ap_dung="NAM_NU_TRUONG_THANH",
                    don_gia_niem_yet=Decimal("1500000.00"),
                    don_gia_khuyen_mai=Decimal("1200000.00"),
                    mo_ta="Bao gồm khám tổng quát, xét nghiệm máu, tổng phân tích nước tiểu và chụp X-quang tim phổi.",
                    is_active=True,
                ),
                GoiDichVu(
                    ma_goi="GOI-TIM-MACH-VIP",
                    ten_goi="Gói Tầm Soát Tim Mạch & Huyết Áp Chuyên Sâu [DEMO]",
                    doi_tuong_ap_dung="NGUOI_CAO_TUOI",
                    don_gia_niem_yet=Decimal("2800000.00"),
                    don_gia_khuyen_mai=Decimal("2400000.00"),
                    mo_ta="Khám chuyên gia tim mạch, điện tâm đồ ECG 12 cần, siêu âm tim Doppler màu, xét nghiệm bộ mỡ máu Lipid.",
                    is_active=True,
                ),
                GoiDichVu(
                    ma_goi="GOI-NHI-KHOA-TIEM-CHUNG",
                    ten_goi="Gói Khám & Đánh Giá Phát Triển Thể Chất Nhi [DEMO]",
                    doi_tuong_ap_dung="TRE_EM",
                    don_gia_niem_yet=Decimal("800000.00"),
                    don_gia_khuyen_mai=Decimal("650000.00"),
                    mo_ta="Khám dinh dưỡng, chiều cao, cân nặng, tầm soát vi chất và tư vấn phác đồ tiêm chủng trọn gói.",
                    is_active=True,
                ),
            ]
            session.add_all(packages)
            await session.flush()

        existing_tmpl = (await session.execute(select(MauBieuYTe))).first()
        if not existing_tmpl:
            templates = [
                MauBieuYTe(
                    ma_mau="MAU-CLS-TIM-MACH",
                    ten_mau="Bộ Chỉ Định Cận Lâm Sàng Tầm Soát Tăng Huyết Áp [DEMO]",
                    loai_mau="CHI_DINH_CLS",
                    noi_dung_text="Chỉ định gồm: Điện tâm đồ ECG 12 cần, X-quang tim phổi thẳng, Sinh hóa máu (Glucose, Creatinine, Lipid toàn phần).",
                    is_public=True,
                ),
                MauBieuYTe(
                    ma_mau="MAU-LOI-DAN-DA-DAY",
                    ten_mau="Lời Dặn Chăm Sóc Người Bệnh Viêm Loét Dạ Dày [DEMO]",
                    loai_mau="LOI_DAN",
                    noi_dung_text="Kiêng ăn đồ cay chua, rượu bia, cà phê; ăn đúng giờ; không thức khuya; uống thuốc đủ liều trước bữa ăn 30 phút.",
                    is_public=True,
                ),
            ]
            session.add_all(templates)
            await session.flush()

        existing_qa = (await session.execute(select(CauHoiYKhoa))).first()
        if not existing_qa:
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

        existing_news = (await session.execute(select(BaiVietTinTuc))).first()
        if not existing_news:
            news = [
                BaiVietTinTuc(
                    tieu_de="5 Thói quen buổi sáng giúp bảo vệ hệ tim mạch khỏe mạnh",
                    slug="5-thoi-quen-buoi-sang-bao-ve-tim-mach",
                    chuyen_muc="Y_HOC_THUONG_THUC",
                    anh_dai_dien_url="https://images.unsplash.com/photo-1505751172876-fa1923c5c528",
                    tom_tat="Uống nước ấm ngay sau khi thức dậy, tập thở sâu và hạn chế bật dậy đột ngột giúp giảm nguy cơ tai biến buổi sáng.",
                    noi_dung_html="<p>Buổi sáng từ 6h đến 9h là thời điểm huyết áp có xu hướng tăng sinh lý và độ nhớt của máu cao nhất trong ngày...</p>",
                    tac_gia="BS.CKI Nguyễn Văn An [DEMO]",
                    luot_xem=520,
                    is_published=True,
                ),
            ]
            session.add_all(news)
            await session.flush()

        await session.commit()


if __name__ == "__main__":
    import sys
    confirmed = "--confirm-seed-demo" in sys.argv
    asyncio.run(seed_master_from_frontend(confirm_seed_demo=confirmed))
