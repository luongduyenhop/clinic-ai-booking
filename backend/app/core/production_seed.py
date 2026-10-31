import logging
from sqlalchemy import select
from app.models.medical import Thuoc, KhaiNiem, DichVu
from app.models.user import ChuyenKhoa

logger = logging.getLogger("clinic_production_seed")

MASTER_ICD10 = [
    # Tiêu hóa & Gan mật
    ("A09", "Tiêu chảy và viêm dạ dày ruột nhiễm trùng", "benh_icd10"),
    ("A04.8", "Nhiễm khuẩn đường ruột do vi khuẩn khác", "benh_icd10"),
    ("K21.0", "Bệnh trào ngược dạ dày - thực quản có viêm", "benh_icd10"),
    ("K21.9", "Bệnh trào ngược dạ dày - thực quản (GERD)", "benh_icd10"),
    ("K25.9", "Loét dạ dày, không đặc hiệu", "benh_icd10"),
    ("K26.9", "Loét tá tràng, không đặc hiệu", "benh_icd10"),
    ("K29.0", "Viêm dạ dày xuất huyết cấp", "benh_icd10"),
    ("K29.5", "Viêm dạ dày mạn tính, không đặc hiệu", "benh_icd10"),
    ("K29.7", "Viêm dạ dày, không đặc hiệu", "benh_icd10"),
    ("K30", "Khó tiêu chức năng (Dyspepsia)", "benh_icd10"),
    ("K58.0", "Hội chứng ruột kích thích có tiêu chảy (IBS-D)", "benh_icd10"),
    ("K58.9", "Hội chứng ruột kích thích không đặc hiệu", "benh_icd10"),
    ("K59.0", "Táo bón chức năng", "benh_icd10"),
    ("K76.0", "Thoái hóa mỡ gan (gan nhiễm mỡ)", "benh_icd10"),
    # Tim mạch & Huyết áp
    ("I10", "Bệnh tăng huyết áp vô căn (nguyên phát)", "benh_icd10"),
    ("I11.9", "Bệnh tim do tăng huyết áp không suy tim", "benh_icd10"),
    ("I20.9", "Cơn đau thắt ngực, không đặc hiệu", "benh_icd10"),
    ("I25.1", "Bệnh tim do xơ vữa động mạch", "benh_icd10"),
    ("I48", "Rung nhĩ và cuồng nhĩ", "benh_icd10"),
    ("I50.9", "Suy tim, không đặc hiệu", "benh_icd10"),
    ("I83.9", "Giãn tĩnh mạch chi dưới", "benh_icd10"),
    ("E78.0", "Tăng cholesterol máu nguyên phát", "benh_icd10"),
    ("E78.5", "Tăng lipid máu, không đặc hiệu", "benh_icd10"),
    # Hô hấp & Tai Mũi Họng
    ("J00", "Viêm mũi họng cấp (cảm thường)", "benh_icd10"),
    ("J01.9", "Viêm xoang cấp, không đặc hiệu", "benh_icd10"),
    ("J02.9", "Viêm họng cấp, không đặc hiệu", "benh_icd10"),
    ("J03.9", "Viêm amidan cấp, không đặc hiệu", "benh_icd10"),
    ("J04.0", "Viêm thanh quản cấp", "benh_icd10"),
    ("J06.9", "Nhiễm trùng đường hô hấp trên cấp", "benh_icd10"),
    ("J18.9", "Viêm phổi, không đặc hiệu", "benh_icd10"),
    ("J20.9", "Viêm phế quản cấp, không đặc hiệu", "benh_icd10"),
    ("J44.9", "Bệnh phổi tắc nghẽn mạn tính (COPD)", "benh_icd10"),
    ("J45.9", "Hen phế quản, không đặc hiệu", "benh_icd10"),
    ("J30.4", "Viêm mũi dị ứng, không đặc hiệu", "benh_icd10"),
    ("H65.0", "Viêm tai giữa thanh dịch cấp", "benh_icd10"),
    ("H65.9", "Viêm tai giữa không nung mủ", "benh_icd10"),
    ("H66.9", "Viêm tai giữa mủ, không đặc hiệu", "benh_icd10"),
    ("H81.0", "Bệnh Meniere", "benh_icd10"),
    ("H81.1", "Chóng mặt kịch phát lành tính", "benh_icd10"),
    # Cơ xương khớp & Thần kinh
    ("M10.9", "Bệnh Gút (Gout), không đặc hiệu", "benh_icd10"),
    ("M17.0", "Thoái hóa khớp gối nguyên phát hai bên", "benh_icd10"),
    ("M17.9", "Thoái hóa khớp gối, không đặc hiệu", "benh_icd10"),
    ("M19.9", "Thoái hóa khớp, không đặc hiệu", "benh_icd10"),
    ("M47.8", "Thoái hóa cột sống khác", "benh_icd10"),
    ("M54.2", "Đau vùng cổ (Cervicalgia)", "benh_icd10"),
    ("M54.5", "Đau thắt lưng dưới (Lumbago)", "benh_icd10"),
    ("M79.1", "Đau cơ (Myalgia)", "benh_icd10"),
    ("G43.9", "Đau nửa đầu (Migraine)", "benh_icd10"),
    ("G44.2", "Đau đầu do căng thẳng", "benh_icd10"),
    ("G47.0", "Mất ngủ, rối loạn giấc ngủ", "benh_icd10"),
    ("F41.1", "Rối loạn lo âu lan tỏa", "benh_icd10"),
    # Nội tiết & Tiết niệu & Khác
    ("E11.9", "Đái tháo đường typ 2 không có biến chứng", "benh_icd10"),
    ("E03.9", "Suy giáp, không đặc hiệu", "benh_icd10"),
    ("E05.9", "Cường giáp (nhiễm độc giáp)", "benh_icd10"),
    ("E86", "Giảm thể tích dịch (mất nước)", "benh_icd10"),
    ("N30.0", "Viêm bàng quang cấp", "benh_icd10"),
    ("N39.0", "Nhiễm khuẩn đường tiết niệu", "benh_icd10"),
    ("L20.9", "Viêm da cơ địa dị ứng", "benh_icd10"),
    ("L50.9", "Mày đay, không đặc hiệu", "benh_icd10"),
    ("B01.9", "Thủy đậu không biến chứng", "benh_icd10"),
    ("B02.9", "Zona (Herpes Zoster) không biến chứng", "benh_icd10"),
    ("K02.9", "Sâu răng, không đặc hiệu", "benh_icd10"),
    ("K04.0", "Viêm tủy răng", "benh_icd10"),
    ("K05.1", "Viêm lợi mạn tính", "benh_icd10"),
    ("R05", "Ho kéo dài", "trieu_chung"),
    ("R07.4", "Đau ngực không đặc hiệu", "trieu_chung"),
    ("R10.4", "Đau quặn bụng không đặc hiệu", "trieu_chung"),
    ("R42", "Chóng mặt, choáng váng", "trieu_chung"),
    ("R50.9", "Sốt cao không rõ nguyên nhân", "trieu_chung"),
    ("R51", "Đau đầu cấp tính", "trieu_chung"),
    ("R53", "Suy nhược và mệt mỏi", "trieu_chung"),
]

MASTER_DRUGS = [
    # Kháng sinh & Kháng khuẩn
    ("TH001", "Augmentin 1g", "Amoxicillin + Acid Clavulanic", "1000mg", "Viên", "Uống sau ăn", 18500),
    ("TH002", "Augmentin 625mg", "Amoxicillin + Acid Clavulanic", "625mg", "Viên", "Uống sau ăn", 14000),
    ("TH003", "Amoxicillin 500mg", "Amoxicillin", "500mg", "Viên", "Uống sau ăn", 2500),
    ("TH004", "Zinnat 500mg", "Cefuroxime axetil", "500mg", "Viên", "Uống ngay sau ăn", 24000),
    ("TH005", "Cefuroxime 500mg", "Cefuroxime", "500mg", "Viên", "Uống sau ăn", 8000),
    ("TH006", "Ciprofloxacin 500mg", "Ciprofloxacin", "500mg", "Viên", "Uống nhiều nước sau ăn", 4500),
    ("TH007", "Levofloxacin 500mg", "Levofloxacin", "500mg", "Viên", "Uống 1 lần/ngày", 15000),
    ("TH008", "Azithromycin 500mg", "Azithromycin", "500mg", "Viên", "Uống trước ăn 1 giờ", 16000),
    ("TH009", "Klacid 500mg", "Clarithromycin", "500mg", "Viên", "Uống sau ăn", 28000),
    ("TH010", "Metronidazol 250mg", "Metronidazol", "250mg", "Viên", "Uống trong hoặc sau ăn", 1200),
    # Giảm đau, Hạ sốt, Kháng viêm
    ("TH011", "Paracetamol 500mg", "Paracetamol", "500mg", "Viên", "Uống khi sốt >38.5C cách 4-6h", 1000),
    ("TH012", "Panadol Extra", "Paracetamol + Caffeine", "500mg/65mg", "Viên", "Uống sau ăn cách 4-6h", 2200),
    ("TH013", "Hapacol 650mg", "Paracetamol", "650mg", "Viên", "Uống khi đau sốt cách 4-6h", 1800),
    ("TH014", "Efferalgan 500mg", "Paracetamol sủi", "500mg", "Viên sủi", "Hòa tan với 150ml nước", 4500),
    ("TH015", "Ibuprofen 400mg", "Ibuprofen", "400mg", "Viên", "Uống sau ăn no", 2000),
    ("TH016", "Meloxicam 7.5mg", "Meloxicam", "7.5mg", "Viên", "Uống sau ăn trưa", 3500),
    ("TH017", "Celecoxib 200mg", "Celecoxib", "200mg", "Viên", "Uống sau ăn", 6000),
    ("TH018", "Voltaren 50mg", "Diclofenac", "50mg", "Viên", "Uống sau ăn no", 5500),
    ("TH019", "Alpha Chymotrypsin", "Chymotrypsin", "4.2mg", "Viên", "Ngậm dưới lưỡi hoặc uống", 2800),
    ("TH020", "Medrol 16mg", "Methylprednisolone", "16mg", "Viên", "Uống vào 8h sáng sau ăn no", 6500),
    ("TH021", "Medrol 4mg", "Methylprednisolone", "4mg", "Viên", "Uống vào 8h sáng sau ăn no", 2500),
    # Tiêu hóa, Dạ dày, Đại tràng
    ("TH022", "Nexium 40mg", "Esomeprazole", "40mg", "Viên", "Uống trước ăn sáng 30-60 phút", 25000),
    ("TH023", "Nexium 20mg", "Esomeprazole", "20mg", "Viên", "Uống trước ăn sáng 30 phút", 18000),
    ("TH024", "Omeprazol 20mg", "Omeprazol", "20mg", "Viên", "Uống trước ăn sáng 30 phút", 2000),
    ("TH025", "Pantoprazol 40mg", "Pantoprazol", "40mg", "Viên", "Uống trước ăn sáng 30 phút", 5000),
    ("TH026", "Gaviscon Dual Action", "Natri alginate + Antacid", "10ml", "Gói", "Uống sau bữa ăn và trước khi ngủ", 12000),
    ("TH027", "Yumangel (Thuốc dạ dày chữ Y)", "Almagat", "15ml", "Gói", "Uống giữa các bữa ăn", 6500),
    ("TH028", "Motilium-M 10mg", "Domperidone", "10mg", "Viên", "Uống trước ăn 15-30 phút", 3800),
    ("TH029", "Duspatalin 200mg", "Mebeverine", "200mg", "Viên", "Uống trước bữa ăn 20 phút", 9500),
    ("TH030", "Debridat 100mg", "Trimebutine", "100mg", "Viên", "Uống trước bữa ăn", 4200),
    ("TH031", "Smecta 3g", "Diosmectite", "3g", "Gói", "Hòa nước uống xa bữa ăn", 5000),
    ("TH032", "Hidrasec 100mg", "Racecadotril", "100mg", "Viên", "Uống đầu bữa ăn", 8500),
    ("TH033", "Oresol 245", "Glucose & Điện giải", "4.22g", "Gói", "Pha đúng 200ml nước đun sôi để nguội", 4000),
    ("TH034", "Enterogermina 2 tỷ", "Bacillus clausii", "5ml", "Ống", "Uống trực tiếp trong hoặc sau ăn", 9000),
    ("TH035", "Bioflora 250mg", "Saccharomyces boulardii", "250mg", "Gói", "Uống cùng nước hoặc sữa", 8500),
    # Tim mạch & Huyết áp & Mỡ máu
    ("TH036", "Amlodipine 5mg", "Amlodipine besylate", "5mg", "Viên", "Uống buổi sáng cố định giờ", 2000),
    ("TH037", "Concor 5mg", "Bisoprolol", "5mg", "Viên", "Uống buổi sáng", 6500),
    ("TH038", "Concor 2.5mg", "Bisoprolol", "2.5mg", "Viên", "Uống buổi sáng", 4500),
    ("TH039", "Micardis 40mg", "Telmisartan", "40mg", "Viên", "Uống vào buổi sáng", 11000),
    ("TH040", "Losartan 50mg", "Losartan potassium", "50mg", "Viên", "Uống vào buổi sáng", 4000),
    ("TH041", "Coveram 5/5mg", "Perindopril + Amlodipine", "5mg/5mg", "Viên", "Uống 1 viên vào buổi sáng", 12500),
    ("TH042", "Lipitor 20mg", "Atorvastatin", "20mg", "Viên", "Uống vào buổi tối trước khi ngủ", 21000),
    ("TH043", "Atorvastatin 10mg", "Atorvastatin", "10mg", "Viên", "Uống vào buổi tối", 4500),
    ("TH044", "Crestor 10mg", "Rosuvastatin", "10mg", "Viên", "Uống buổi tối trước khi ngủ", 16000),
    # Tiểu đường & Chuyển hóa
    ("TH045", "Glucophage 850mg", "Metformin", "850mg", "Viên", "Uống trong hoặc ngay sau bữa ăn", 4500),
    ("TH046", "Diamicron MR 60mg", "Gliclazide", "60mg", "Viên", "Uống 1 liều duy nhất vào bữa sáng", 5500),
    ("TH047", "Jardiance 10mg", "Empagliflozin", "10mg", "Viên", "Uống vào buổi sáng", 26000),
    # Dị ứng & Hô hấp
    ("TH048", "Telfast 180mg", "Fexofenadine", "180mg", "Viên", "Uống 1 viên/ngày với nước", 10500),
    ("TH049", "Loratadin 10mg", "Loratadin", "10mg", "Viên", "Uống buổi tối trước ngủ", 1500),
    ("TH050", "Cetirizin 10mg", "Cetirizin", "10mg", "Viên", "Uống buổi tối trước ngủ", 1500),
    ("TH051", "Aerius 5mg", "Desloratadine", "5mg", "Viên", "Uống 1 lần/ngày", 11500),
    ("TH052", "Singulair 10mg", "Montelukast", "10mg", "Viên", "Uống buổi tối trước ngủ", 19000),
    ("TH053", "Ventolin Inhaler 100mcg", "Salbutamol", "100mcg/liều", "Bình xịt", "Xịt hít 2 nhát khi khó thở", 95000),
    ("TH054", "Acemuc 200mg", "Acetylcysteine", "200mg", "Gói", "Hòa nước uống sau ăn", 3500),
    ("TH055", "Prospan 100ml", "Cao lá thường xuân", "100ml", "Chai", "Uống 5ml x 3 lần/ngày", 85000),
    # Thần kinh & Tiền đình & Khác
    ("TH056", "Betaserc 16mg", "Betahistine", "16mg", "Viên", "Uống sau ăn 2 lần/ngày", 6000),
    ("TH057", "Sibelium 5mg", "Flunarizine", "5mg", "Viên", "Uống buổi tối trước ngủ", 7000),
    ("TH058", "Tanakan 40mg", "Ginkgo Biloba", "40mg", "Viên", "Uống trong bữa ăn", 5500),
    ("TH059", "Canxi Corbiere 10ml", "Calci + Vitamin C, PP", "10ml", "Ống", "Uống vào buổi sáng sau ăn", 8500),
    ("TH060", "Vitamin C 500mg", "Acid Ascorbic", "500mg", "Viên", "Uống sau ăn sáng", 1500),
    ("TH061", "Vitamin 3B", "Vitamin B1, B6, B12", "Hỗn hợp B", "Viên", "Uống sau ăn", 2000),
    ("TH062", "Kẽm Gluconate 10mg", "Kẽm nguyên tố", "10mg", "Viên", "Uống sau bữa ăn", 2500),
]

MASTER_SERVICES = [
    # Công khám chuyên khoa
    ("KHAM_LAM_SANG_CO_BAN", "Khám lâm sàng cơ bản", 150000, "Lần", "KHAM"),
    ("DV_KHAM_NOI", "Khám chuyên khoa Nội tổng quát", 150000, "Lần", "KHAM"),
    ("DV_KHAM_TIM", "Khám chuyên khoa Tim Mạch", 200000, "Lần", "KHAM"),
    ("DV_KHAM_TH", "Khám chuyên khoa Tiêu Hóa", 200000, "Lần", "KHAM"),
    ("DV_KHAM_TMH", "Khám chuyên khoa Tai - Mũi - Họng", 180000, "Lần", "KHAM"),
    ("DV_KHAM_RHM", "Khám chuyên khoa Răng - Hàm - Mặt", 180000, "Lần", "KHAM"),
    ("DV_KHAM_NHI", "Khám chuyên khoa Nhi", 180000, "Lần", "KHAM"),
    ("DV_KHAM_CKK", "Khám chuyên khoa Cơ Xương Khớp", 200000, "Lần", "KHAM"),
    ("DV_KHAM_DL", "Khám chuyên khoa Da Liễu", 180000, "Lần", "KHAM"),
    # Xét nghiệm Huyết học & Sinh hóa
    ("DV_XN_MAU", "Tổng phân tích tế bào máu ngoại vi (18 chỉ số)", 120000, "Lần", "XN"),
    ("DV_XN_GLUCOSE", "Định lượng Glucose máu lúc đói", 45000, "Lần", "XN"),
    ("DV_XN_HBA1C", "Định lượng HbA1c (Đường huyết 3 tháng)", 130000, "Lần", "XN"),
    ("DV_XN_MEN_GAN", "Đo hoạt độ Men gan (AST / ALT)", 90000, "Lần", "XN"),
    ("DV_XN_THAN", "Định lượng Ure & Creatinine máu", 80000, "Lần", "XN"),
    ("DV_XN_ACID_URIC", "Định lượng Acid Uric máu (Gút)", 50000, "Lần", "XN"),
    ("DV_XN_MO_MAU", "Bộ Mỡ máu 4 chỉ số (Cholesterol, Triglycerid, HDL, LDL)", 160000, "Lần", "XN"),
    ("DV_XN_CRP", "Định lượng CRP hs (Protein phản ứng C độ nhạy cao)", 110000, "Lần", "XN"),
    ("DV_XN_NUOC_TIEU", "Tổng phân tích nước tiểu 10 thông số", 60000, "Lần", "XN"),
    ("DV_XN_SOI_PHAN", "Soi phân tìm hồng cầu, bạch cầu, ký sinh trùng", 50000, "Lần", "XN"),
    ("DV_TEST_FLU", "Test nhanh virus Cúm A/B", 120000, "Lần", "XN"),
    ("DV_TEST_DENGUE", "Test nhanh kháng nguyên Sốt xuất huyết Dengue NS1", 150000, "Lần", "XN"),
    # Chẩn đoán hình ảnh (X-quang, Siêu âm)
    ("DV_XQ_NGUC", "Chụp X-quang tim phổi thẳng kỹ thuật số (CR/DR)", 180000, "Lần", "CDHA"),
    ("DV_XQ_XOANG", "Chụp X-quang các xoang tư thế Blondeau - Hirtz", 180000, "Lần", "CDHA"),
    ("DV_XQ_COT_SONG", "Chụp X-quang cột sống thắt lưng 2 tư thế", 220000, "Lần", "CDHA"),
    ("DV_XQ_KHOP_GOI", "Chụp X-quang khớp gối thẳng và nghiêng", 180000, "Lần", "CDHA"),
    ("DV_XQ_RANG_PANO", "Chụp X-quang răng Panorama toàn cảnh", 200000, "Lần", "CDHA"),
    ("DV_SA_BUNG", "Siêu âm ổ bụng tổng quát màu Doppler", 200000, "Lần", "CDHA"),
    ("DV_SA_GIAP", "Siêu âm tuyến giáp Doppler màu", 180000, "Lần", "CDHA"),
    ("DV_SA_VU", "Siêu âm tuyến vú hai bên Doppler", 200000, "Lần", "CDHA"),
    ("DV_SA_TIM", "Siêu âm tim Doppler màu qua thành ngực", 350000, "Lần", "CDHA"),
    ("DV_SA_MACH_CHI", "Siêu âm Doppler màu mạch máu chi dưới", 350000, "Lần", "CDHA"),
    # Thăm dò chức năng & Nội soi & Thủ thuật
    ("DV_ECG", "Điện tâm đồ (ECG) 12 chuyển đạo", 100000, "Lần", "TDCN"),
    ("DV_HO_HAP_KY", "Đo chức năng thông khí phổi (Hô hấp ký)", 150000, "Lần", "TDCN"),
    ("DV_EEG", "Điện não đồ vi tính (EEG)", 200000, "Lần", "TDCN"),
    ("DV_DO_THINH_LUC", "Đo sức nghe thính lực đơn âm", 120000, "Lần", "TDCN"),
    ("DV_NS_TMH", "Nội soi Tai - Mũi - Họng ống mềm kỹ thuật số", 250000, "Lần", "TT"),
    ("DV_NS_DA_DAY", "Nội soi thực quản - dạ dày - tá tràng", 60000, "Lần", "TT"),
    ("DV_CAO_RANG", "Lấy cao răng và đánh bóng hai hàm siêu âm", 200000, "Lần", "TT"),
    ("DV_KHI_DUNG", "Khí dung thuốc giãn phế quản cấp", 50000, "Lần", "TT"),
]


async def seed_production_catalogs(session):
    """
    Nạp toàn diện các danh mục chuẩn hóa sản xuất (ICD-10, Thuốc, Dịch vụ kỹ thuật)
    vào PostgreSQL. Hàm này hoạt động hoàn toàn Idempotent (không trùng lặp).
    """
    # 1. Seed ICD-10 Concepts
    res_icd = await session.execute(select(KhaiNiem.ma_khai_niem))
    existing_icds = set(res_icd.scalars().all())
    new_icds = []
    for ma, ten, loai in MASTER_ICD10:
        if ma not in existing_icds:
            new_icds.append(KhaiNiem(ma_khai_niem=ma, ten_khai_niem=ten, loai_khai_niem=loai))
            existing_icds.add(ma)
    if new_icds:
        session.add_all(new_icds)
        await session.flush()
        logger.info(f"Đã bổ sung {len(new_icds)} mã chẩn đoán ICD-10 vào PostgreSQL.")

    # 2. Seed Thuốc thiết yếu
    res_thuoc = await session.execute(select(Thuoc.ma_thuoc))
    existing_thuocs = set(res_thuoc.scalars().all())
    new_thuocs = []
    for ma, ten, hc, hl, dvt, hd, gia in MASTER_DRUGS:
        if ma not in existing_thuocs:
            new_thuocs.append(Thuoc(
                ma_thuoc=ma,
                ten_thuoc=ten,
                hoat_chat=hc,
                ham_luong=hl,
                don_vi_tinh=dvt,
                duong_dung=hd,
                don_gia_niem_yet=gia,
                is_active=True
            ))
            existing_thuocs.add(ma)
    if new_thuocs:
        session.add_all(new_thuocs)
        await session.flush()
        logger.info(f"Đã bổ sung {len(new_thuocs)} mặt hàng thuốc điều trị vào PostgreSQL.")

    # 3. Seed Dịch vụ kỹ thuật
    res_dv = await session.execute(select(DichVu.ma_dich_vu))
    existing_dvs = set(res_dv.scalars().all())
    new_dvs = []
    for ma, ten, gia, dvt, nhom in MASTER_SERVICES:
        if ma not in existing_dvs:
            new_dvs.append(DichVu(
                ma_dich_vu=ma,
                ten_dich_vu=ten,
                don_gia=gia,
                don_vi_tinh=dvt,
                ma_nhom_byt=nhom,
                is_active=True
            ))
            existing_dvs.add(ma)
    if new_dvs:
        session.add_all(new_dvs)
        await session.flush()
        logger.info(f"Đã bổ sung {len(new_dvs)} dịch vụ kỹ thuật & cận lâm sàng vào PostgreSQL.")

    await session.commit()
