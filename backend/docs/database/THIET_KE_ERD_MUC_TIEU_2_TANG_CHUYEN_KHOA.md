# BẢN THIẾT KẾ ERD MỤC TIÊU: KIẾN TRÚC KHÁM LÂM SÀNG 2 TẦNG (TWO-TIER CLINICAL ARCHITECTURE)
**Dự án:** Clinic-AI — Hệ thống Quản trị Phòng khám Đa khoa Thông minh  
**Phiên bản:** Draft v2.0 (Dành cho thành viên nhóm phản biện & thống nhất trước khi code)  
**Tài liệu tham chiếu:** [erd_muc_tieu.dbml](file:///d:/dowload/tailieu/clinic-ai-backend/backend/docs/database/erd_muc_tieu.dbml) | [erd_muc_tieu_mermaid.md](file:///d:/dowload/tailieu/clinic-ai-backend/backend/docs/database/erd_muc_tieu_mermaid.md)

---

## 1. TỔNG QUAN KIẾN TRÚC KHÁM LÂM SÀNG 2 TẦNG

Nhóm Clinic-AI thống nhất mô hình **Kiến trúc 2 tầng (Two-Tier Clinical Architecture)**:
> Không tạo 5 hệ thống khám riêng biệt làm phân mảnh cơ sở dữ liệu. Toàn bộ 5 chuyên khoa đều vận hành trên một quy trình thống nhất, dùng chung hạ tầng tiếp đón, viện phí, dược phẩm và liên kết về cùng một thực thể `luot_kham`.

```
               [ LỄ TÂN TIẾP ĐÓN ]
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
[Có lịch hẹn trước]        [Khám trực tiếp (Walk-in)]
(lich_kham_id = 123)       (lich_kham_id = NULL)
        │                           │
        └─────────────┬─────────────┘
                      ▼
             ┌─────────────────┐
             │  hang_doi_kham  │  (lich_kham_id nullable)
             └────────┬────────┘
                      ▼
        ═════════════════════════════════════════════════════════════
        TẦNG 1: LỚP KHÁM CHUNG (General Clinical Tier)
        ═════════════════════════════════════════════════════════════
                      │
             ┌─────────────────┐
             │    luot_kham    │  (lich_kham_id nullable, UNIQUE)
             └──┬───┬───┬───┬──┘
                │   │   │   │
        ┌───────┘   │   │   └───────────────────────┐
        ▼           ▼   ▼                           ▼
  [chan_doan]  [chi_dinh] [don_thuoc]     [luot_kham_the_luc]
   (ICD-10)       (CLS)     (Dược)          (Sinh hiệu & thể lực)
        │
        ═════════════════════════════════════════════════════════════
        TẦNG 2: LỚP KHÁM CHUYÊN KHOA (Specialty Clinical Tier)
        (Mỗi luot_kham liên kết 1 - 0..1 với đúng 1 hồ sơ chuyên khoa)
        ═════════════════════════════════════════════════════════════
        ├── kham_noi_khoa        (Tim mạch, hô hấp, tiêu hóa, tiết niệu, cơ xương khớp)
        ├── kham_ngoai_khoa      (Vết thương, vị trí tổn thương, khám thực thể, thủ thuật)
        ├── kham_mat             (Thị lực 2 mắt, nhãn áp, đáy mắt, kết quả khám mắt)
        ├── kham_tai_mui_hong    (Nội soi tai, mũi, họng, triệu chứng liên quan)
        └── kham_rang_ham_mat    (Vị trí răng tổn thương, tình trạng răng/lợi, hướng điều trị)
```

---

## 2. MA TRẬN ĐỐI SOÁT CÁC BẢNG DỮ LIỆU CỐT LÕI

| Tên bảng | Phân loại | Khóa ngoại cốt lõi | Ràng buộc nghiệp vụ quan trọng |
| :--- | :--- | :--- | :--- |
| `chuyen_khoa` | **Hiện có — Giữ** | PK `id` | Danh mục 5 khoa: *Nội, Ngoại, Răng hàm mặt, Tai mũi họng, Mắt*. |
| `bac_si` | **Hiện có — Sửa** | FK `chuyen_khoa_id` $\rightarrow$ `chuyen_khoa.id` | **`chuyen_khoa_id` chuyển thành `NOT NULL`**: Mỗi bác sĩ thuộc đúng một chuyên khoa xác định. |
| `benh_nhan` | **Hiện có — Giữ** | PK `id`, FK `nguoi_dung_id` (1-1) | Lưu mã hồ sơ bệnh nhân, tiền sử dị ứng, BHYT. |
| `lich_kham` | **Hiện có — Giữ** | FK `benh_nhan_id`, FK `bac_si_id` | Phiếu hẹn trước. Bổ sung `idempotency_key` chống double-click. **Không bắt buộc cho khách khám trực tiếp**. |
| `hang_doi_kham` | **Hiện có — Sửa** | FK `lich_kham_id` (NULLABLE), FK `nguoi_tiep_nhan_id` | Hỗ trợ cả 2 luồng: bệnh nhân có lịch hẹn và bệnh nhân vãng lai (`lich_kham_id = NULL`). |
| `luot_kham` | **Hiện có — Sửa** | FK `lich_kham_id` (**NULLABLE**, **UNIQUE**) | Lớp khám chung. Cho phép `lich_kham_id = NULL` khi khám trực tiếp. Vẫn giữ `UNIQUE` để 1 lịch hẹn chỉ gắn 1 lượt khám. |
| `luot_kham_the_luc` | **Hiện có — Giữ** | FK `luot_kham_id` (1-1) | Lưu chỉ số sinh tồn và thể lực chuyên sâu. |
| `chan_doan` | **Hiện có — Giữ** | FK `luot_kham_id` (1-N) | Danh mục chẩn đoán bệnh theo mã ICD-10 (chính và phụ). |
| `chi_dinh` | **Hiện có — Giữ** | FK `luot_kham_id` (1-N) | Chỉ định cận lâm sàng (bổ sung `tep_dinh_kem_url`). |
| `don_thuoc` | **Hiện có — Giữ** | FK `luot_kham_id` (1-N) | Kê đơn thuốc ngoại trú chia 4 cữ (Sáng-Trưa-Chiều-Tối). |
| **5 bảng chuyên khoa** | **ĐỀ XUẤT MỚI** | FK `luot_kham_id` (**NOT NULL**, **UNIQUE**) | Lưu kết quả khám chuyên biệt theo từng khoa (quan hệ 1 - 0..1 với `luot_kham`). |

---

## 3. CHI TIẾT CẤU TRÚC 5 BẢNG KHÁM CHUYÊN KHOA ĐỀ XUẤT

> [!IMPORTANT]
> **Nguyên tắc Chuẩn hóa Dữ liệu (3NF):**  
> Tuyệt đối **không lưu lại `benh_nhan_id` và `bac_si_id`** trong 5 bảng chuyên khoa. Mọi thông tin bệnh nhân, bác sĩ phụ trách, ngày giờ khám, trạng thái khóa bệnh án đều được truy vết duy nhất thông qua `luot_kham_id`. Điều này tránh dư thừa dữ liệu và loại trừ triệt để nguy cơ bất nhất thông tin (bác sĩ trên hồ sơ chuyên khoa khác bác sĩ chủ trì lượt khám).

### 3.1. Bảng `kham_noi_khoa`
*Mô tả:* Lưu kết quả khám các hệ cơ quan nội tạng.
* `id`: `int` [PK, increment]
* `luot_kham_id`: `int` [NOT NULL, UNIQUE, FK -> `luot_kham.id`]
* `ket_qua_kham_tim_mach`: `text` (tiếng tim T1, T2, âm thổi, nhịp tim)
* `ket_qua_kham_ho_hap`: `text` (rì rào phế nang, rale ẩm, rale nổ, thở khò khè)
* `ket_qua_kham_tieu_hoa`: `text` (bụng mềm/chướng, điểm đau khu trú, gan lách)
* `ket_qua_kham_tiet_nieu`: `text` (chạm thận, bập bềnh thận, tiểu buốt/rắt)
* `ket_qua_kham_co_xuong_khop`: `text` (tầm vận động, sưng nóng đỏ đau khớp)
* `ket_qua_kham_than_kinh`: `text` (phản xạ gân xương, dấu hiệu màng não)
* `ghi_chu`: `text`
* `created_at`: `datetime` [NOT NULL]
* `updated_at`: `datetime` [NOT NULL]

### 3.2. Bảng `kham_ngoai_khoa`
*Mô tả:* Lưu tình trạng ngoại khoa, chấn thương và vết thương thực thể.
* `id`: `int` [PK, increment]
* `luot_kham_id`: `int` [NOT NULL, UNIQUE, FK -> `luot_kham.id`]
* `vi_tri_ton_thuong`: `text` (vị trí giải phẫu: đầu, ngực, chi trên/dưới)
* `loai_ton_thuong`: `varchar(100)` (vết rách, bầm dập, gãy xương kín/hở, bỏng)
* `tinh_trang_vet_thuong`: `text` (kích thước, độ sâu, chảy máu, nhiễm trùng)
* `ket_qua_kham_thuc_the`: `text` (biến dạng xương, mạch ngoại vi, cảm giác)
* `chi_dinh_phau_thuat_thu_thuat`: `text` (khâu vết thương, bó bột, phẫu thuật cấp)
* `ghi_chu`: `text`
* `created_at`: `datetime` [NOT NULL]
* `updated_at`: `datetime` [NOT NULL]

### 3.3. Bảng `kham_mat`
*Mô tả:* Khám thị lực và bệnh lý nhãn khoa.
* `id`: `int` [PK, increment]
* `luot_kham_id`: `int` [NOT NULL, UNIQUE, FK -> `luot_kham.id`]
* `thi_luc_mat_phai`: `varchar(20)` (ví dụ: 10/10, 5/10, đếm ngón tay)
* `thi_luc_mat_trai`: `varchar(20)`
* `nhan_ap_mat_phai`: `varchar(20)` (mmHg)
* `nhan_ap_mat_trai`: `varchar(20)` (mmHg)
* `ket_qua_kham_mat`: `text` (kết mạc, giác mạc, tiền phòng, thể thủy tinh, đáy mắt)
* `ghi_chu`: `text`
* `created_at`: `datetime` [NOT NULL]
* `updated_at`: `datetime` [NOT NULL]

### 3.4. Bảng `kham_tai_mui_hong`
*Mô tả:* Khám nội soi và bệnh lý vùng tai mũi họng.
* `id`: `int` [PK, increment]
* `luot_kham_id`: `int` [NOT NULL, UNIQUE, FK -> `luot_kham.id`]
* `ket_qua_kham_tai`: `text` (màng nhĩ sáng/thủng, ống tai ngoài, dịch tai)
* `ket_qua_kham_mui`: `text` (niêm mạc cuốn mũi, khe giữa, vẹo vách ngăn, polyp)
* `ket_qua_kham_hong`: `text` (amidan quá phát/mủ, thành sau họng hạt, dây thanh)
* `trieu_chung_lien_quan`: `text` (ù tai, chóng mặt, khàn tiếng, nuốt vướng)
* `ghi_chu`: `text`
* `created_at`: `datetime` [NOT NULL]
* `updated_at`: `datetime` [NOT NULL]

### 3.5. Bảng `kham_rang_ham_mat`
*Mô tả:* Khám răng, nướu lợi và cấu trúc xương hàm.
* `id`: `int` [PK, increment]
* `luot_kham_id`: `int` [NOT NULL, UNIQUE, FK -> `luot_kham.id`]
* `vi_tri_rang`: `varchar(50)` (theo sơ đồ răng số chuẩn quốc tế, ví dụ: R18, R26, R48)
* `tinh_trang_rang`: `text` (sâu men/ngà/tủy, mẻ vỡ, lung lay độ 1-3, mất răng)
* `tinh_trang_loi`: `text` (viêm nướu, tụt lợi, vôi răng dưới nướu, túi nha chu)
* `ket_qua_kham_khoang_mieng`: `text` (niêm mạc miệng, khớp cắn, khớp thái dương hàm)
* `huong_dieu_tri`: `text` (hàn răng, điều trị tủy, nhổ răng khôn, cạo vôi răng)
* `ghi_chu`: `text`
* `created_at`: `datetime` [NOT NULL]
* `updated_at`: `datetime` [NOT NULL]

---

## 4. QUY TRÌNH NGHIỆP VỤ BỆNH NHÂN KHÁM TRỰC TIẾP (WALK-IN)

Khi bệnh nhân đến trực tiếp tại phòng khám mà không đặt hẹn trước trên Web/App:

```
[Bệnh nhân tới quầy]
       │
       ▼
1. Lễ tân tra cứu SĐT hoặc CCCD:
   - Nếu đã có: Lấy benh_nhan_id
   - Nếu chưa có: Tạo bản ghi mới trong nguoi_dung và benh_nhan
       │
       ▼
2. Lễ tân bấm "Tiếp đón khám trực tiếp":
   - KHÔNG tạo bản ghi giả trong lich_kham!
   - Tạo trực tiếp bản ghi trong hang_doi_kham:
     * lich_kham_id = NULL
     * benh_nhan_id = <ID bệnh nhân>
     * bac_si_id = <ID bác sĩ trực ca>
     * loai_hang_doi = 'TRUC_TIEP'
     * muc_do_uu_tien = 5 (P5_VANG_LAI)
     * nguoi_tiep_nhan_id = <ID tài khoản lễ tân>
     * so_thu_tu_kham = max(stt_trong_ca) + 1  [Khóa giao dịch SELECT FOR UPDATE]
       │
       ▼
3. Bác sĩ trong phòng khám gọi số thứ tự tiếp theo:
   - Hệ thống chuyển trạng thái hang_doi_kham sang 'DANG_KHAM'
   - Tự động sinh bản ghi luot_kham:
     * lich_kham_id = NULL
     * benh_nhan_id = <ID bệnh nhân>
     * bac_si_id = <ID bác sĩ>
     * thoi_gian_bat_dau = NOW()
       │
       ▼
4. Bác sĩ thăm khám và nhập liệu:
   - Nhập thông tin khám chung: lý do khám, bệnh sử, chỉ số sinh tồn (vitals) trên luot_kham
   - Nhập thông tin chuyên khoa tương ứng: hệ thống mở form của khoa mà bác sĩ đó phụ trách 
     (ví dụ: Bác sĩ Mắt -> form kham_mat; Bác sĩ Nội -> form kham_noi_khoa)
   - Lưu bản ghi vào bảng chuyên khoa tương ứng với luot_kham_id
   - Thêm chẩn đoán ICD-10 (bảng chan_doan), chỉ định CLS (chi_dinh) hoặc kê đơn (don_thuoc)
       │
       ▼
5. Kết thúc khám & Chuyển Thu ngân:
   - Cập nhật luot_kham: thoi_gian_ket_thuc = NOW(), is_locked = True (khóa bệnh án TT32)
   - Sinh hoa_don viện phí tự động từ tiền khám + CLS + thuốc
```

---

## 5. MÃ DBML SẴN SÀNG CHO DBDÍAGRAM.IO

Nhóm có thể copy đoạn DBML dưới đây để kiểm tra trên [dbdiagram.io](https://dbdiagram.io):

```dbml
// =======================================================
// LỚP KHÁM CHUNG & 5 BẢNG KHÁM CHUYÊN KHOA CLINIC-AI
// =======================================================

Table chuyen_khoa {
  id int [pk, increment]
  ten_chuyen_khoa varchar(100) [not null, unique]
  ma_chuyen_khoa varchar(50) [not null, unique]
  Note: '5 chuyên khoa: Nội, Ngoại, Răng hàm mặt, Tai mũi họng, Mắt'
}

Table bac_si {
  id int [pk, increment]
  nguoi_dung_id int [not null, unique]
  chuyen_khoa_id int [not null] // Mỗi bác sĩ thuộc đúng 1 khoa
  chung_chi_hanh_nghe varchar(100) [not null, unique]
  hoc_vi varchar(50) [not null]
}

Table lich_kham {
  id int [pk, increment]
  benh_nhan_id int [not null]
  bac_si_id int [not null]
  ngay_kham date [not null]
  idempotency_key varchar(64) [unique]
  Note: 'Phiếu hẹn khám (không bắt buộc với khách khám trực tiếp)'
}

Table hang_doi_kham {
  id int [pk, increment]
  lich_kham_id int // NULLABLE: Hỗ trợ cả khách hẹn trước và khám trực tiếp
  benh_nhan_id int [not null]
  bac_si_id int [not null]
  loai_hang_doi varchar(30) [not null] // 'DAT_TRUOC' hoặc 'TRUC_TIEP'
  muc_do_uu_tien int [not null] // 1: Cấp cứu -> 5: Vãng lai
  so_thu_tu_kham int [not null]
  nguoi_tiep_nhan_id int // FK -> tai_khoan.id
}

Table luot_kham {
  id int [pk, increment]
  lich_kham_id int [unique] // NULLABLE: NULL khi khám trực tiếp, UNIQUE khi có lịch
  benh_nhan_id int [not null]
  bac_si_id int [not null]
  thoi_gian_bat_dau datetime [not null]
  thoi_gian_ket_thuc datetime
  ly_do_vao_kham text
  benh_su text
  mach_lan_phut int
  nhiet_do_c numeric(4,1)
  huyet_ap_tam_thu int
  huyet_ap_tam_truong int
  is_locked boolean [not null, default: false]
  Note: 'Hồ sơ khám chung EMR - trung tâm liên kết'
}

// 5 BẢNG CHUYÊN KHOA MỚI (QUAN HỆ 1 - 0..1 VỚI luot_kham)

Table kham_noi_khoa {
  id int [pk, increment]
  luot_kham_id int [not null, unique]
  ket_qua_kham_tim_mach text
  ket_qua_kham_ho_hap text
  ket_qua_kham_tieu_hoa text
  ket_qua_kham_tiet_nieu text
  ket_qua_kham_co_xuong_khop text
  ket_qua_kham_than_kinh text
  ghi_chu text
  created_at datetime [not null]
  updated_at datetime [not null]
}

Table kham_ngoai_khoa {
  id int [pk, increment]
  luot_kham_id int [not null, unique]
  vi_tri_ton_thuong text
  loai_ton_thuong varchar(100)
  tinh_trang_vet_thuong text
  ket_qua_kham_thuc_the text
  chi_dinh_phau_thuat_thu_thuat text
  ghi_chu text
  created_at datetime [not null]
  updated_at datetime [not null]
}

Table kham_mat {
  id int [pk, increment]
  luot_kham_id int [not null, unique]
  thi_luc_mat_phai varchar(20)
  thi_luc_mat_trai varchar(20)
  nhan_ap_mat_phai varchar(20)
  nhan_ap_mat_trai varchar(20)
  ket_qua_kham_mat text
  ghi_chu text
  created_at datetime [not null]
  updated_at datetime [not null]
}

Table kham_tai_mui_hong {
  id int [pk, increment]
  luot_kham_id int [not null, unique]
  ket_qua_kham_tai text
  ket_qua_kham_mui text
  ket_qua_kham_hong text
  trieu_chung_lien_quan text
  ghi_chu text
  created_at datetime [not null]
  updated_at datetime [not null]
}

Table kham_rang_ham_mat {
  id int [pk, increment]
  luot_kham_id int [not null, unique]
  vi_tri_rang varchar(50)
  tinh_trang_rang text
  tinh_trang_loi text
  ket_qua_kham_khoang_mieng text
  huong_dieu_tri text
  ghi_chu text
  created_at datetime [not null]
  updated_at datetime [not null]
}

// LIÊN KẾT KHÓA NGOẠI
Ref: bac_si.chuyen_khoa_id > chuyen_khoa.id
Ref: lich_kham.benh_nhan_id > benh_nhan.id
Ref: lich_kham.bac_si_id > bac_si.id
Ref: hang_doi_kham.lich_kham_id > lich_kham.id
Ref: hang_doi_kham.benh_nhan_id > benh_nhan.id
Ref: hang_doi_kham.bac_si_id > bac_si.id
Ref: luot_kham.lich_kham_id - lich_kham.id
Ref: luot_kham.benh_nhan_id > benh_nhan.id
Ref: luot_kham.bac_si_id > bac_si.id

// 5 quan hệ 1 - 0..1 với luot_kham
Ref: kham_noi_khoa.luot_kham_id - luot_kham.id
Ref: kham_ngoai_khoa.luot_kham_id - luot_kham.id
Ref: kham_mat.luot_kham_id - luot_kham.id
Ref: kham_tai_mui_hong.luot_kham_id - luot_kham.id
Ref: kham_rang_ham_mat.luot_kham_id - luot_kham.id
```

---

## 6. PHIẾU ĐỐI SOÁT DÀNH CHO CẢ NHÓM (REVIEW CHECKLIST CHO 4 THÀNH VIÊN)

Trước khi tổ chức biểu quyết chốt Biên bản duyệt ERD Mục tiêu, từng thành viên cần trả lời các câu hỏi phản biện dưới đây:

### Thành viên 2 (Tùng — Tài khoản & Bác sĩ):
- [ ] Bác sĩ hiện tại trong hệ thống có trường hợp nào kiêm nhiệm 2 chuyên khoa cùng lúc không? Nếu chuyển `bac_si.chuyen_khoa_id` thành `NOT NULL`, dữ liệu hiện tại có bác sĩ nào bị `NULL` không? *(Kiểm tra database seed data)*.

### Thành viên 3 (Trọng — Tiếp đón & Hàng đợi):
- [ ] Khi bệnh nhân khám trực tiếp tại quầy, việc cấp số thứ tự `so_thu_tu_kham` cho hàng đợi `P5_VANG_LAI` cần triển khai cơ chế khóa bản ghi (`SELECT FOR UPDATE`) trong backend như thế nào để tránh 2 lễ tân cùng cấp một số thứ tự?
- [ ] Bảng `danh_sach_cho` (Waitlist) có cần giữ lại không? *(Kết luận: Giữ lại để lưu bệnh nhân chờ slot khi một ca khám của bác sĩ đã đầy 100%)*.

### Thành viên 4 (Hoàng — Khám bệnh & EMR):
- [ ] Danh sách các trường khám thực thể của 5 bảng chuyên khoa ở trên đã đủ để dựng form nhập liệu cho Bác sĩ trên giao diện Frontend chưa? Có cần thêm trường nào (như `nhan_ap`, `so_do_rang`) nữa không?
- [ ] Bảng `luot_kham_the_luc` có bị thừa khi đã có 5 bảng chuyên khoa không? *(Kết luận: Không thừa, `luot_kham_the_luc` dùng lưu các chỉ số thể lực định kỳ và sức khỏe tổng quát, 5 bảng chuyên khoa dùng ghi nhận bệnh lý chuyên sâu)*.

### Thành viên 5 (An — CLS & Viện phí):
- [ ] Khi bệnh nhân được chỉ định Cận lâm sàng từ một lượt khám chuyên khoa (ví dụ: Bác sĩ Răng Hàm Mặt chỉ định Chụp X-quang Panorama hàm), khóa ngoại `chi_dinh.luot_kham_id` trỏ về `luot_kham` có hoàn toàn đáp ứng xuất hóa đơn tài chính `hoa_don` không? *(Kết luận: Hoàn toàn đáp ứng vì hóa đơn liên kết theo `luot_kham_id`)*.
