-- ================================================================================
-- HỆ QUẢN TRỊ CƠ SỞ DỮ LIỆU: POSTGRESQL 15+
-- DỰ ÁN: WEBSITE QUẢN LÝ VÀ ĐẶT LỊCH PHÒNG KHÁM TÍCH HỢP AI
-- HỌC PHẦN: PROJECT 1 (IT1.241.3) - GVHD: TS. NGUYỄN ĐỨC DƯ - NHÓM 2
-- MÔ HÌNH THIẾT KẾ: KẾ THỪA CHUẨN OPENMRS 3.0 (PERSON, ENCOUNTER, CONCEPT DICTIONARY)
-- ================================================================================

-- Kích hoạt extension hỗ trợ tính toán UUID và Text Search (nếu cần)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- --------------------------------------------------------------------------------
-- 0. TẠO CÁC KIỂU DỮ LIỆU ENUM (ĐẢM BẢO TOÀN VẸN NGHIỆP VỤ)
-- --------------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE vai_tro_enum AS ENUM ('benh_nhan', 'bac_si', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ca_lam_viec_enum AS ENUM ('sang', 'chieu');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE trang_thai_lich_enum AS ENUM (
        'cho_xac_nhan',   -- Mới đặt trực tuyến, chờ xác nhận 24h
        'da_xac_nhan',    -- Bệnh nhân đã bấm xác nhận trước 24h
        'da_tiep_nhan',   -- Bệnh nhân đã đến phòng khám, lễ tân tiếp đón
        'dang_kham',      -- Đang trong phòng khám cùng bác sĩ
        'da_kham',        -- Đã hoàn thành ca khám, khóa bệnh án
        'da_huy',         -- Bệnh nhân hoặc phòng khám chủ động hủy hợp lệ
        'tu_dong_huy',    -- Hệ thống tự động giải phóng slot do quá hạn 2h không xác nhận
        'no_show'         -- Đến giờ khám nhưng không đến và không báo trước
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE trang_thai_waitlist_enum AS ENUM (
        'dang_cho',       -- Đang nằm trong hàng chờ
        'da_thong_bao',   -- Đã có slot trống, hệ thống gửi thông báo giữ chỗ (hạn 15p)
        'da_nhan_slot',   -- Đã bấm nhận slot và chuyển thành lịch chính thức
        'da_bo_qua',      -- Quá 15p không phản hồi, nhường lượt cho người sau
        'da_huy'          -- Bệnh nhân tự hủy khỏi hàng chờ
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE loai_chan_doan_enum AS ENUM ('chinh', 'phu');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE trang_thai_chi_dinh_enum AS ENUM (
        'da_chi_dinh',    -- Bác sĩ vừa ra y lệnh
        'dang_thuc_hien', -- Bệnh nhân đang làm xét nghiệm / chẩn đoán hình ảnh
        'da_co_ket_qua',  -- Đã có kết quả trả về cho bác sĩ
        'da_huy'          -- Hủy chỉ định
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- --------------------------------------------------------------------------------
-- 1. HÀM & TRIGGER TỰ ĐỘNG CẬP NHẬT DẤU THỜI GIAN (UPDATED_AT)
-- --------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ================================================================================
-- PHẦN 1: MÔ HÌNH CON NGƯỜI & ĐỊNH DANH (OPENMRS PERSON & USER PATTERN)
-- ================================================================================

-- Bảng 1: Chuyên khoa phòng khám (Department / Service Location)
CREATE TABLE IF NOT EXISTS chuyen_khoa (
    id SERIAL PRIMARY KEY,
    ma_chuyen_khoa VARCHAR(50) UNIQUE NOT NULL,
    ten_chuyen_khoa VARCHAR(100) UNIQUE NOT NULL,
    mo_ta TEXT,
    vi_tri_phong VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Bảng 2: Thông tin nhân khẩu học dùng chung (OpenMRS Person Pattern)
CREATE TABLE IF NOT EXISTS nguoi_dung (
    id SERIAL PRIMARY KEY,
    ho_ten VARCHAR(150) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    so_dien_thoai VARCHAR(20) UNIQUE,
    ngay_sinh DATE,
    gioi_tinh VARCHAR(10) CHECK (gioi_tinh IN ('Nam', 'Nữ', 'Khác')),
    dia_chi VARCHAR(255),
    cccd_so VARCHAR(20) UNIQUE,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nguoi_dung_ho_ten ON nguoi_dung (ho_ten);
CREATE INDEX IF NOT EXISTS idx_nguoi_dung_email ON nguoi_dung (email);
CREATE INDEX IF NOT EXISTS idx_nguoi_dung_sdt ON nguoi_dung (so_dien_thoai);

-- Bảng 3: Tài khoản xác thực & Bảo mật (OpenMRS Users & Privileges)
CREATE TABLE IF NOT EXISTS tai_khoan (
    id SERIAL PRIMARY KEY,
    nguoi_dung_id INTEGER UNIQUE NOT NULL REFERENCES nguoi_dung(id) ON DELETE CASCADE,
    email VARCHAR(100) UNIQUE NOT NULL,
    mat_khau_hash VARCHAR(255) NOT NULL,
    vai_tro vai_tro_enum DEFAULT 'benh_nhan' NOT NULL,
    is_active BOOLEAN DEFAULT FALSE NOT NULL, -- True sau khi kích hoạt OTP
    otp_code VARCHAR(10),
    otp_expired_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Bảng 4: Hồ sơ Bệnh nhân (OpenMRS Patient Pattern)
CREATE TABLE IF NOT EXISTS benh_nhan (
    id SERIAL PRIMARY KEY,
    nguoi_dung_id INTEGER UNIQUE NOT NULL REFERENCES nguoi_dung(id) ON DELETE CASCADE,
    ma_dinh_danh_y_te VARCHAR(50) UNIQUE NOT NULL, -- VD: BN-2026-0001
    nhom_mau VARCHAR(10),
    tien_su_benh TEXT,
    di_ung_thuoc TEXT,
    diem_tin_nhiem INTEGER DEFAULT 100 NOT NULL CHECK (diem_tin_nhiem >= 0),
    so_lan_no_show INTEGER DEFAULT 0 NOT NULL,
    is_blocked_booking BOOLEAN DEFAULT FALSE NOT NULL, -- Khóa đặt online nếu no-show >= 2 lần
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_benh_nhan_ma_y_te ON benh_nhan (ma_dinh_danh_y_te);

-- Bảng 5: Hồ sơ chuyên môn Bác sĩ (OpenMRS Provider Pattern)
CREATE TABLE IF NOT EXISTS bac_si (
    id SERIAL PRIMARY KEY,
    nguoi_dung_id INTEGER UNIQUE NOT NULL REFERENCES nguoi_dung(id) ON DELETE CASCADE,
    chuyen_khoa_id INTEGER REFERENCES chuyen_khoa(id) ON DELETE SET NULL,
    hoc_vi VARCHAR(50) NOT NULL, -- BSCKI, BSCKII, ThS.BS, PGS.TS
    chung_chi_hanh_nghe VARCHAR(100) UNIQUE NOT NULL,
    nam_kinh_nghiem INTEGER DEFAULT 0,
    mo_ta_chuyen_sau TEXT,
    gia_kham_mac_dinh NUMERIC(12, 2) DEFAULT 200000.00 NOT NULL CHECK (gia_kham_mac_dinh >= 0),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bac_si_chuyen_khoa ON bac_si (chuyen_khoa_id);

-- ================================================================================
-- PHẦN 2: LỊCH TRỰC, ĐẶT KHÁM & CHỐNG OVERBOOKING (APPOINTMENT & SCHEDULING)
-- ================================================================================

-- Bảng 6: Ca làm việc định kỳ của Bác sĩ (OpenMRS Appointment Block)
CREATE TABLE IF NOT EXISTS lich_lam_viec (
    id SERIAL PRIMARY KEY,
    bac_si_id INTEGER NOT NULL REFERENCES bac_si(id) ON DELETE CASCADE,
    ngay_lam_viec DATE NOT NULL,
    ca_lam_viec ca_lam_viec_enum NOT NULL,
    gio_bat_dau TIME NOT NULL,
    gio_ket_thuc TIME NOT NULL,
    gioi_han_ca_kham INTEGER DEFAULT 8 NOT NULL CHECK (gioi_han_ca_kham > 0),
    is_active BOOLEAN DEFAULT TRUE NOT NULL, -- False nếu nghỉ phép / đột xuất
    ghi_chu_nghi TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_doctor_shift UNIQUE (bac_si_id, ngay_lam_viec, ca_lam_viec)
);
CREATE INDEX IF NOT EXISTS idx_lich_lam_viec_date ON lich_lam_viec (bac_si_id, ngay_lam_viec);

-- Bảng 7: Lịch hẹn khám bệnh trực tuyến (OpenMRS Appointment / TimeSlot)
CREATE TABLE IF NOT EXISTS lich_kham (
    id SERIAL PRIMARY KEY,
    ma_lich_kham VARCHAR(50) UNIQUE NOT NULL, -- VD: LK-20261001-01001
    benh_nhan_id INTEGER NOT NULL REFERENCES benh_nhan(id) ON DELETE RESTRICT,
    bac_si_id INTEGER NOT NULL REFERENCES bac_si(id) ON DELETE RESTRICT,
    ngay_kham DATE NOT NULL,
    gio_kham TIME NOT NULL,
    thoi_luong_phut INTEGER DEFAULT 30 NOT NULL CHECK (thoi_luong_phut IN (15, 30, 45, 60)),
    so_thu_tu INTEGER NOT NULL CHECK (so_thu_tu > 0),
    ly_do_kham VARCHAR(255),
    trieu_chung_ban_dau TEXT,
    trang_thai trang_thai_lich_enum DEFAULT 'cho_xac_nhan' NOT NULL,
    is_reconfirmed_24h BOOLEAN DEFAULT FALSE NOT NULL, -- Đã bấm xác nhận trước 24h
    thoi_gian_xac_nhan TIMESTAMPTZ,
    thoi_gian_huy TIMESTAMPTZ,
    ly_do_huy TEXT,
    nguoi_huy_vai_tro VARCHAR(20), -- 'benh_nhan', 'bac_si', 'he_thong_auto'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- CHỐT CHẶN BẢO VỆ CONCURRENCY CẤP DATABASE (UNIQUE PARTIAL INDEX)
-- Chống triệt để Race Condition: Không bao giờ có 2 lịch hẹn cùng 1 bác sĩ, cùng 1 ngày, cùng 1 giờ
-- trừ khi ca đó đã bị hủy hoặc tự động giải phóng
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_doctor_slot 
ON lich_kham (bac_si_id, ngay_kham, gio_kham) 
WHERE trang_thai NOT IN ('da_huy', 'tu_dong_huy');

-- Bệnh nhân không được tự đặt 2 lịch hẹn trùng giờ nhau
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_patient_slot 
ON lich_kham (benh_nhan_id, ngay_kham, gio_kham) 
WHERE trang_thai NOT IN ('da_huy', 'tu_dong_huy');

CREATE INDEX IF NOT EXISTS idx_lich_kham_lookup ON lich_kham (bac_si_id, ngay_kham, trang_thai);
CREATE INDEX IF NOT EXISTS idx_lich_kham_benh_nhan ON lich_kham (benh_nhan_id, ngay_kham);

-- Bảng 8: Danh sách chờ thông minh khi hết slot (OpenMRS Appointment Waitlist)
CREATE TABLE IF NOT EXISTS danh_sach_cho (
    id SERIAL PRIMARY KEY,
    benh_nhan_id INTEGER NOT NULL REFERENCES benh_nhan(id) ON DELETE CASCADE,
    bac_si_id INTEGER NOT NULL REFERENCES bac_si(id) ON DELETE CASCADE,
    ngay_mong_muon DATE NOT NULL,
    ca_mong_muon ca_lam_viec_enum DEFAULT 'sang' NOT NULL,
    trieu_chung TEXT,
    thu_tu_uu_tien INTEGER DEFAULT 1 NOT NULL,
    trang_thai trang_thai_waitlist_enum DEFAULT 'dang_cho' NOT NULL,
    thoi_gian_thong_bao TIMESTAMPTZ,
    thoi_gian_het_han_giu_slot TIMESTAMPTZ, -- Có 15 phút để xác nhận
    slot_duoc_cap_id INTEGER REFERENCES lich_kham(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_waitlist_lookup ON danh_sach_cho (bac_si_id, ngay_mong_muon, trang_thai);

-- ================================================================================
-- PHẦN 3: TỪ ĐIỂN KHÁI NIỆM & TRÍ TUỆ NHÂN TẠO (CONCEPT DICTIONARY & AI MODULE)
-- ================================================================================

-- Bảng 9: Từ điển khái niệm y tế chuẩn hóa (OpenMRS Concept Dictionary)
CREATE TABLE IF NOT EXISTS khai_niem (
    id SERIAL PRIMARY KEY,
    ma_khai_niem VARCHAR(50) UNIQUE NOT NULL, -- Mã WHO ICD-10 (I10, K29...) hoặc SNOMED CT
    ten_khai_niem VARCHAR(255) NOT NULL,
    loai_khai_niem VARCHAR(50) DEFAULT 'benh_icd10' NOT NULL, -- 'benh_icd10', 'trieu_chung', 'dich_vu'
    chuyen_khoa_id INTEGER REFERENCES chuyen_khoa(id) ON DELETE SET NULL,
    mo_ta TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_khai_niem_icd ON khai_niem (ma_khai_niem);
CREATE INDEX IF NOT EXISTS idx_khai_niem_ten ON khai_niem (ten_khai_niem);

-- Bảng 10: Quy tắc từ khóa cấp cứu nguy hiểm tính mạng (Red Flags Safety Guard)
CREATE TABLE IF NOT EXISTS tu_khoa_cap_cuu (
    id SERIAL PRIMARY KEY,
    tu_khoa VARCHAR(100) UNIQUE NOT NULL, -- 'đau ngực dữ dội', 'khó thở cấp', 'ngất xỉu'...
    muc_do_nguy_hiem VARCHAR(30) DEFAULT 'rat_nguy_hiem' NOT NULL,
    huong_dan_xu_tri VARCHAR(255) DEFAULT 'CẢNH BÁO NGUY HIỂM! Gọi cấp cứu 115 hoặc đến cơ sở y tế gần nhất' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Bảng 11: Nhật ký suy luận AI Triage phân tích triệu chứng (AI Inference Logging)
CREATE TABLE IF NOT EXISTS phan_tich_ai (
    id SERIAL PRIMARY KEY,
    lich_kham_id INTEGER UNIQUE REFERENCES lich_kham(id) ON DELETE SET NULL,
    benh_nhan_id INTEGER REFERENCES benh_nhan(id) ON DELETE SET NULL,
    trieu_chung_nhap TEXT NOT NULL,
    chuyen_khoa_goi_y_id INTEGER REFERENCES chuyen_khoa(id) ON DELETE SET NULL,
    do_tin_cay NUMERIC(5, 4) DEFAULT 0.0000 NOT NULL CHECK (do_tin_cay >= 0.0 AND do_tin_cay <= 1.0),
    co_dau_hieu_cap_cuu BOOLEAN DEFAULT FALSE NOT NULL,
    tu_khoa_cap_cuu_phat_hien VARCHAR(100),
    mo_hinh_ap_dung VARCHAR(50) DEFAULT 'TFIDF_LOGISTIC_V1' NOT NULL, -- Tên version model
    thoi_gian_suy_luan_ms NUMERIC(8, 2),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Bảng 12: Đánh giá độ chính xác AI từ người dùng / bác sĩ (AI Feedback Loop)
CREATE TABLE IF NOT EXISTS danh_gia_ai (
    id SERIAL PRIMARY KEY,
    phan_tich_ai_id INTEGER NOT NULL REFERENCES phan_tich_ai(id) ON DELETE CASCADE,
    nguoi_danh_gia_id INTEGER REFERENCES nguoi_dung(id) ON DELETE SET NULL,
    vai_tro_nguoi_danh_gia vai_tro_enum NOT NULL,
    so_sao INTEGER CHECK (so_sao >= 1 AND so_sao <= 5), -- 1 đến 5 sao
    chuyen_khoa_thuc_te_id INTEGER REFERENCES chuyen_khoa(id) ON DELETE SET NULL,
    nhan_xet TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ================================================================================
-- PHẦN 4: THĂM KHÁM LÂM SÀNG & BỆNH ÁN ĐIỆN TỬ (OPENMRS ENCOUNTER & ORDERS)
-- ================================================================================

-- Bảng 13: Danh mục dịch vụ kỹ thuật & cận lâm sàng (OpenMRS Medical Service)
CREATE TABLE IF NOT EXISTS dich_vu (
    id SERIAL PRIMARY KEY,
    ma_dich_vu VARCHAR(50) UNIQUE NOT NULL, -- DV_XN_MAU, DV_XQ_NGUC, DV_SA_BUNG
    ten_dich_vu VARCHAR(150) NOT NULL,
    chuyen_khoa_id INTEGER REFERENCES chuyen_khoa(id) ON DELETE SET NULL,
    don_gia NUMERIC(12, 2) NOT NULL CHECK (don_gia >= 0),
    don_vi_tinh VARCHAR(30) DEFAULT 'Lần' NOT NULL,
    quy_trinh_thuc_hien TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Bảng 14: Phiên khám bệnh lâm sàng thực tế (OpenMRS Encounter Pattern)
CREATE TABLE IF NOT EXISTS luot_kham (
    id SERIAL PRIMARY KEY,
    lich_kham_id INTEGER UNIQUE NOT NULL REFERENCES lich_kham(id) ON DELETE RESTRICT,
    bac_si_id INTEGER NOT NULL REFERENCES bac_si(id) ON DELETE RESTRICT,
    benh_nhan_id INTEGER NOT NULL REFERENCES benh_nhan(id) ON DELETE RESTRICT,
    thoi_gian_bat_dau TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    thoi_gian_ket_thuc TIMESTAMPTZ,
    ly_do_vao_kham TEXT,
    benh_su TEXT,
    mach_lan_phut INTEGER,
    nhiet_do_c NUMERIC(4, 1),
    huyet_ap_tam_thu INTEGER,
    huyet_ap_tam_truong INTEGER,
    nhip_tho_lan_phut INTEGER,
    can_nang_kg NUMERIC(5, 2),
    chieu_cao_cm NUMERIC(5, 2),
    kham_lam_sang_bo_phan TEXT,
    ket_luan_dieu_tri TEXT,
    loi_dan_bac_si TEXT,
    ngay_hen_tai_kham DATE,
    is_locked BOOLEAN DEFAULT FALSE NOT NULL, -- Khóa bệnh án Read-only theo TT 32/2023/TT-BYT
    thoi_gian_khoa TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_luot_kham_history ON luot_kham (benh_nhan_id, thoi_gian_bat_dau);

-- Bảng 15: Kết luận Chẩn đoán bệnh theo mã ICD-10 (OpenMRS Encounter Diagnosis)
CREATE TABLE IF NOT EXISTS chan_doan (
    id SERIAL PRIMARY KEY,
    luot_kham_id INTEGER NOT NULL REFERENCES luot_kham(id) ON DELETE CASCADE,
    khai_niem_id INTEGER REFERENCES khai_niem(id) ON DELETE RESTRICT,
    ma_icd10 VARCHAR(50) NOT NULL,
    ten_benh_chan_doan VARCHAR(255) NOT NULL,
    loai_chan_doan loai_chan_doan_enum DEFAULT 'chinh' NOT NULL, -- 'chinh' hoặc 'phu'
    ghi_chu_chuyen_mon TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chan_doan_luot_kham ON chan_doan (luot_kham_id);

-- Bảng 16: Y lệnh chỉ định dịch vụ cận lâm sàng (OpenMRS Test Order)
CREATE TABLE IF NOT EXISTS chi_dinh (
    id SERIAL PRIMARY KEY,
    luot_kham_id INTEGER NOT NULL REFERENCES luot_kham(id) ON DELETE CASCADE,
    dich_vu_id INTEGER NOT NULL REFERENCES dich_vu(id) ON DELETE RESTRICT,
    so_luong INTEGER DEFAULT 1 NOT NULL CHECK (so_luong > 0),
    don_gia_tai_thoi_diem NUMERIC(12, 2) NOT NULL CHECK (don_gia_tai_thoi_diem >= 0),
    trang_thai trang_thai_chi_dinh_enum DEFAULT 'da_chi_dinh' NOT NULL,
    bac_si_chi_dinh_id INTEGER REFERENCES bac_si(id),
    ket_qua_chi_tiet TEXT,
    tep_dinh_kem_url VARCHAR(255), -- Đường dẫn file PDF / ảnh kết quả
    thoi_gian_tra_ket_qua TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chi_dinh_luot_kham ON chi_dinh (luot_kham_id);

-- Bảng 17: Đơn thuốc điều trị ngoại trú (OpenMRS Drug Order Header)
CREATE TABLE IF NOT EXISTS don_thuoc (
    id SERIAL PRIMARY KEY,
    luot_kham_id INTEGER UNIQUE NOT NULL REFERENCES luot_kham(id) ON DELETE CASCADE,
    bac_si_ke_don_id INTEGER NOT NULL REFERENCES bac_si(id) ON DELETE RESTRICT,
    ngay_ke_don TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    loi_dan_uong_thuoc TEXT,
    ghi_chu_duoc_lam_sang TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Bảng 18: Chi tiết từng dòng thuốc trong đơn (OpenMRS Drug Order Item)
CREATE TABLE IF NOT EXISTS chi_tiet_don_thuoc (
    id SERIAL PRIMARY KEY,
    don_thuoc_id INTEGER NOT NULL REFERENCES don_thuoc(id) ON DELETE CASCADE,
    ten_thuoc VARCHAR(150) NOT NULL,
    hoat_chat VARCHAR(150),
    ham_luong VARCHAR(50), -- 500mg, 10ml
    don_vi_tinh VARCHAR(30) NOT NULL, -- Viên, Gói, Chai
    so_luong INTEGER NOT NULL CHECK (so_luong > 0),
    cach_dung TEXT NOT NULL, -- Sáng 1 viên, Tối 1 viên sau ăn no
    so_ngay_dung INTEGER DEFAULT 5 NOT NULL CHECK (so_ngay_dung > 0),
    ghi_chu TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chi_tiet_don_thuoc_fk ON chi_tiet_don_thuoc (don_thuoc_id);

-- --------------------------------------------------------------------------------
-- 5. ÁP DỤNG TRIGGER CẬP NHẬT UPDATED_AT CHO TẤT CẢ BẢNG
-- --------------------------------------------------------------------------------

CREATE TRIGGER trigger_update_chuyen_khoa BEFORE UPDATE ON chuyen_khoa FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trigger_update_nguoi_dung BEFORE UPDATE ON nguoi_dung FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trigger_update_tai_khoan BEFORE UPDATE ON tai_khoan FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trigger_update_benh_nhan BEFORE UPDATE ON benh_nhan FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trigger_update_bac_si BEFORE UPDATE ON bac_si FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trigger_update_lich_lam_viec BEFORE UPDATE ON lich_lam_viec FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trigger_update_lich_kham BEFORE UPDATE ON lich_kham FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trigger_update_danh_sach_cho BEFORE UPDATE ON danh_sach_cho FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trigger_update_khai_niem BEFORE UPDATE ON khai_niem FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trigger_update_dich_vu BEFORE UPDATE ON dich_vu FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trigger_update_luot_kham BEFORE UPDATE ON luot_kham FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trigger_update_chi_dinh BEFORE UPDATE ON chi_dinh FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trigger_update_don_thuoc BEFORE UPDATE ON don_thuoc FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
