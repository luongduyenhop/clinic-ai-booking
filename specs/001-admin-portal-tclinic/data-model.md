# Phase 1 Data Model: Phân hệ Quản trị viên (Admin Portal)

**Feature**: `001-admin-portal-tclinic` | **Date**: 2026-11-10

---

## 1. Domain Entities & Database Mapping

### 1.1 Cơ cấu Tổ chức & Nhân sự Y tế (Organization & Staff)

```mermaid
erDiagram
    CHUYEN_KHOA ||--o{ PHONG_KHAM : "chứa"
    CHUYEN_KHOA ||--o{ BAC_SI : "chuyên môn"
    PHONG_KHAM ||--o{ CA_TRUC : "được phân"
    BAC_SI ||--o{ CA_TRUC : "trực"
    NGUOI_DUNG ||--|| BAC_SI : "tài khoản"
    BAC_SI ||--o{ LICH_SU_GIAY_PHEP : "lịch sử CCHN"
    NGUOI_DUNG ||--o{ VAI_TRO_NGUOI_DUNG : "gán role"
    VAI_TRO ||--o{ VAI_TRO_NGUOI_DUNG : "thuộc"

    CHUYEN_KHOA {
        int id PK
        string ma_khoa UK
        string ten_khoa
        string mo_ta
        boolean trang_thai
    }
    PHONG_KHAM {
        int id PK
        string ma_phong UK
        string ten_phong
        int chuyen_khoa_id FK
        string loai_phong
        int tang
        boolean dang_hoat_dong
    }
    BAC_SI {
        int id PK
        int nguoi_dung_id FK
        string ma_bac_si UK
        string so_cchn UK
        date ngay_het_han_cchn
        string trang_thai_cchn
        int chuyen_khoa_id FK
        string hoc_vi
    }
    CA_TRUC {
        int id PK
        int bac_si_id FK
        int phong_kham_id FK
        date ngay_truc
        string ca_truc
        time gio_bat_dau
        time gio_ket_thuc
        string trang_thai
    }
```

### 1.2 Danh mục Y tế & Bảng giá Dịch vụ (Catalog & Pricing)

```mermaid
erDiagram
    NHOM_DICH_VU ||--o{ DICH_VU_KHAM : "phân loại"
    DICH_VU_KHAM ||--o{ BANG_GIA_DICH_VU : "lịch sử giá"
    DANH_MUC_THUOC ||--o{ CHI_TIET_DON_THUOC : "kê trong"
    BENH_ICD10 ||--o{ LUOT_KHAM : "chẩn đoán chính"

    DICH_VU_KHAM {
        int id PK
        string ma_dich_vu UK
        string ten_dich_vu
        int nhom_dich_vu_id FK
        string don_vi_tinh
        decimal don_gia_hien_tai
        boolean dang_kinh_doanh
    }
    BANG_GIA_DICH_VU {
        int id PK
        int dich_vu_id FK
        decimal don_gia
        date ngay_hieu_luc
        date ngay_het_hieu_luc
        string ghi_chu
    }
    DANH_MUC_THUOC {
        int id PK
        string ma_thuoc UK
        string ten_thuoc
        string hoat_chat
        string ham_luong
        string duong_dung
        string don_vi_tinh
        decimal gia_nhap
        decimal gia_ban
        boolean hoat_dong
    }
    BENH_ICD10 {
        int id PK
        string ma_icd UK
        string ten_tieng_viet
        string ten_tieng_anh
        string chuong_benh
    }
```

### 1.3 Kiểm toán Dữ liệu Y tế & Cấu hình (Audit & Compliance)

```mermaid
erDiagram
    NGUOI_DUNG ||--o{ NHAT_KY_TRUY_CAP_Y_TE : "thực hiện"

    NHAT_KY_TRUY_CAP_Y_TE {
        int id PK
        int nguoi_dung_id FK
        string vai_tro
        int benh_nhan_id
        string hanh_dong
        string loai_tai_nguyen
        int tai_nguyen_id
        string ly_do_truy_cap
        string client_ip
        timestamp thoi_gian_tao
    }
    HE_THONG_TRANG_THAI_BFF {
        int id PK
        string key_name UK
        jsonb json_data
        timestamp cap_nhat_luc
    }
```

---

## 2. Business Invariants & State Transitions

### 2.1 Trạng thái Chứng chỉ Hành nghề Bác sĩ (`trang_thai_cchn`)
- **Trạng thái hợp lệ**: `ACTIVE` (Hiệu lực), `EXPIRING_SOON` (Sắp hết hạn trong ≤30 ngày), `EXPIRED` (Hết hạn), `SUSPENDED` (Đình chỉ), `REVOKED` (Thu hồi).
- **Invariants**:
  - Khi `trang_thai_cchn in ['EXPIRED', 'SUSPENDED', 'REVOKED']`, hệ thống MUST từ chối lưu ca trực mới cho bác sĩ đó.
  - Phân ca trực phát hiện trùng phòng khám hoặc trùng bác sĩ trong cùng khung giờ sẽ trả về mã lỗi HTTP 409 Conflict.

### 2.2 Bảng giá Dịch vụ & Tính Bất biến
- **Invariants**:
  - Không bao giờ cập nhật ghi đè (in-place update) đơn giá của bản ghi `bang_gia_dich_vu` đã có hiệu lực trong quá khứ.
  - Khi điều chỉnh giá dịch vụ, hệ thống cập nhật `ngay_het_hieu_luc` của bản ghi giá hiện tại và chèn một bản ghi mới với `ngay_hieu_luc = CURDATE()`.
  - Hóa đơn đã phát hành giữ nguyên đơn giá lịch sử tại thời điểm tạo hóa đơn.

---

## 3. Schema Migrations & Data Seed Plan

1. **Alembic Migration**:
   - Kiểm tra các chỉ mục (indexes) trên `dich_vu_kham(ma_dich_vu)`, `bac_si(so_cchn)`, `ca_truc(ngay_truc, phong_kham_id)`.
   - Bổ sung bảng quản trị cấu hình biểu mẫu nếu cần tách khỏi JSON blob.
2. **Kế hoạch Data Seed**:
   - `scripts/seed_admin_demo.py` tạo dữ liệu theo thứ tự:
     - 5 Chuyên khoa: Nội tổng quát, Ngoại, Sản phụ khoa, Mắt, Tai mũi họng.
     - 5 Buồng khám: Phòng 101, Phòng 102, Phòng 201, Phòng 202, Phòng Xét nghiệm 301.
     - 5 Bác sĩ mẫu với CCHN đầy đủ, gắn kèm chuyên khoa và ca trực tuần.
     - 30 Dịch vụ y tế (khám tổng quát, cận lâm sàng, siêu âm, xét nghiệm huyết học, X-quang) kèm đơn giá niêm yết.
     - 20 Mã bệnh ICD-10 phổ biến.
