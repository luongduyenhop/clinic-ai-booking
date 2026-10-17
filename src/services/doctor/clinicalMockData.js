// Dữ liệu giả cho phân hệ Bác sĩ (Bàn khám & Cận lâm sàng).
// Tên trường bám theo schema backend (luot_kham, chi_dinh, hang_doi_kham...) để khi nối API chỉ cần tắt mock.

export const MOCK_SERVICES = [
    { id: 1, ma_dich_vu: 'DV_XN_MAU', ten_dich_vu: 'Tổng phân tích tế bào máu (18 chỉ số)', nhom_dich_vu: 'XET_NGHIEM', don_gia: 120000 },
    { id: 6, ma_dich_vu: 'DV_XN_NUOC_TIEU', ten_dich_vu: 'Tổng phân tích nước tiểu', nhom_dich_vu: 'XET_NGHIEM', don_gia: 60000 },
    { id: 7, ma_dich_vu: 'DV_XN_SOI_PHAN', ten_dich_vu: 'Soi phân', nhom_dich_vu: 'XET_NGHIEM', don_gia: 50000 },
    { id: 8, ma_dich_vu: 'DV_XN_CRP', ten_dich_vu: 'CRP định lượng', nhom_dich_vu: 'XET_NGHIEM', don_gia: 90000 },
    { id: 9, ma_dich_vu: 'DV_XN_MO_MAU', ten_dich_vu: 'Mỡ máu (4 chỉ số)', nhom_dich_vu: 'XET_NGHIEM', don_gia: 140000 },
    { id: 10, ma_dich_vu: 'DV_XN_GLUCOSE', ten_dich_vu: 'Glucose máu lúc đói', nhom_dich_vu: 'XET_NGHIEM', don_gia: 40000 },
    { id: 3, ma_dich_vu: 'DV_SA_BUNG', ten_dich_vu: 'Siêu âm ổ bụng tổng quát', nhom_dich_vu: 'CDHA', don_gia: 200000 },
    { id: 2, ma_dich_vu: 'DV_XQ_NGUC', ten_dich_vu: 'X-quang tim phổi thẳng', nhom_dich_vu: 'CDHA', don_gia: 180000 },
    { id: 11, ma_dich_vu: 'DV_SA_TIM', ten_dich_vu: 'Siêu âm tim', nhom_dich_vu: 'CDHA', don_gia: 350000 },
    { id: 4, ma_dich_vu: 'DV_ECG', ten_dich_vu: 'Điện tâm đồ 12 chuyển đạo', nhom_dich_vu: 'TDCN', don_gia: 100000 },
    { id: 12, ma_dich_vu: 'DV_HO_HAP_KY', ten_dich_vu: 'Đo chức năng hô hấp', nhom_dich_vu: 'TDCN', don_gia: 150000 },
    { id: 13, ma_dich_vu: 'DV_EEG', ten_dich_vu: 'Điện não đồ', nhom_dich_vu: 'TDCN', don_gia: 200000 },
    { id: 14, ma_dich_vu: 'DV_DO_THINH_LUC', ten_dich_vu: 'Đo thính lực', nhom_dich_vu: 'TDCN', don_gia: 120000 },
    { id: 5, ma_dich_vu: 'DV_NS_TMH', ten_dich_vu: 'Nội soi Tai – Mũi – Họng', nhom_dich_vu: 'NOI_SOI', don_gia: 250000 },
    { id: 15, ma_dich_vu: 'DV_NS_DA_DAY', ten_dich_vu: 'Nội soi dạ dày', nhom_dich_vu: 'NOI_SOI', don_gia: 600000 },
]

export const MOCK_ICD10 = [
    { ma: 'A04.8', ten: 'Nhiễm trùng đường ruột do vi khuẩn xác định khác' },
    { ma: 'A09', ten: 'Tiêu chảy và viêm dạ dày ruột nhiễm trùng' },
    { ma: 'K29.7', ten: 'Viêm dạ dày, không đặc hiệu' },
    { ma: 'K21.9', ten: 'Bệnh trào ngược dạ dày – thực quản' },
    { ma: 'K58.9', ten: 'Hội chứng ruột kích thích' },
    { ma: 'E86', ten: 'Giảm thể tích dịch (mất nước)' },
    { ma: 'I10', ten: 'Tăng huyết áp vô căn (nguyên phát)' },
    { ma: 'I20.9', ten: 'Cơn đau thắt ngực, không đặc hiệu' },
    { ma: 'I48', ten: 'Rung nhĩ và cuồng nhĩ' },
    { ma: 'E78.5', ten: 'Tăng lipid máu, không đặc hiệu' },
    { ma: 'J00', ten: 'Viêm mũi họng cấp (cảm thường)' },
    { ma: 'J02.9', ten: 'Viêm họng cấp, không đặc hiệu' },
    { ma: 'J18.9', ten: 'Viêm phổi, không đặc hiệu' },
    { ma: 'J45.9', ten: 'Hen phế quản, không đặc hiệu' },
    { ma: 'J44.9', ten: 'Bệnh phổi tắc nghẽn mạn tính' },
    { ma: 'J01.9', ten: 'Viêm xoang cấp, không đặc hiệu' },
    { ma: 'H65.9', ten: 'Viêm tai giữa không nung mủ' },
    { ma: 'H81.1', ten: 'Chóng mặt kịch phát lành tính' },
    { ma: 'G43.9', ten: 'Đau nửa đầu (Migraine)' },
    { ma: 'G44.2', ten: 'Đau đầu do căng thẳng' },
    { ma: 'G47.0', ten: 'Mất ngủ' },
    { ma: 'R51', ten: 'Đau đầu' },
]

export const MOCK_DRUGS = [
    { ten_thuoc: 'Ciprofloxacin 500mg', hoat_chat: 'Ciprofloxacin', ham_luong: '500mg', don_vi_tinh: 'Viên', cach_dung: 'Uống sau ăn' },
    { ten_thuoc: 'Oresol 245', hoat_chat: 'Điện giải', ham_luong: '4,22g', don_vi_tinh: 'Gói', cach_dung: 'Pha 1 gói với 200ml nước' },
    { ten_thuoc: 'Smecta 3g', hoat_chat: 'Diosmectit', ham_luong: '3g', don_vi_tinh: 'Gói', cach_dung: 'Uống xa bữa ăn' },
    { ten_thuoc: 'Paracetamol 500mg', hoat_chat: 'Paracetamol', ham_luong: '500mg', don_vi_tinh: 'Viên', cach_dung: 'Uống khi sốt trên 38.5 °C, cách nhau ít nhất 4 giờ' },
    { ten_thuoc: 'Ibuprofen 400mg', hoat_chat: 'Ibuprofen', ham_luong: '400mg', don_vi_tinh: 'Viên', cach_dung: 'Uống sau ăn' },
    { ten_thuoc: 'Amoxicillin 500mg', hoat_chat: 'Amoxicillin', ham_luong: '500mg', don_vi_tinh: 'Viên', cach_dung: 'Uống sau ăn' },
    { ten_thuoc: 'Omeprazol 20mg', hoat_chat: 'Omeprazol', ham_luong: '20mg', don_vi_tinh: 'Viên', cach_dung: 'Uống trước ăn sáng 30 phút' },
    { ten_thuoc: 'Amlodipin 5mg', hoat_chat: 'Amlodipin', ham_luong: '5mg', don_vi_tinh: 'Viên', cach_dung: 'Uống buổi sáng' },
    { ten_thuoc: 'Loratadin 10mg', hoat_chat: 'Loratadin', ham_luong: '10mg', don_vi_tinh: 'Viên', cach_dung: 'Uống buổi tối' },
    { ten_thuoc: 'Salbutamol xịt 100mcg', hoat_chat: 'Salbutamol', ham_luong: '100mcg/liều', don_vi_tinh: 'Bình', cach_dung: 'Xịt 2 nhát khi khó thở' },
    { ten_thuoc: 'Betahistin 16mg', hoat_chat: 'Betahistin', ham_luong: '16mg', don_vi_tinh: 'Viên', cach_dung: 'Uống sau ăn' },
    { ten_thuoc: 'Diclofenac 50mg', hoat_chat: 'Diclofenac', ham_luong: '50mg', don_vi_tinh: 'Viên', cach_dung: 'Uống sau ăn no' },
]

const svc = (ma) => MOCK_SERVICES.find((s) => s.ma_dich_vu === ma)

const order = (id, encounterId, ma, trang_thai, extra = {}) => ({
    id,
    luot_kham_id: encounterId,
    dich_vu_id: svc(ma).id,
    ma_dich_vu: ma,
    ten_dich_vu: svc(ma).ten_dich_vu,
    nhom_dich_vu: svc(ma).nhom_dich_vu,
    trang_thai,
    ket_qua_phan_loai: null,
    ket_qua_chi_tiet: null,
    tep_dinh_kem_url: null,
    thoi_gian_chi_dinh: '2026-10-13T10:52:00',
    ...extra,
})

const PATIENTS = {
    mai: { id: 154, ma: 'BN-2026-0154', ho_ten: 'Trần Thị Mai', gioi_tinh: 'Nữ', tuoi: 48, di_ung_thuoc: 'Dị ứng NSAID', so_lan_kham: 3 },
    tam: { id: 172, ma: 'BN-2026-0172', ho_ten: 'Nguyễn Văn Tâm', gioi_tinh: 'Nam', tuoi: 71, di_ung_thuoc: '', so_lan_kham: 1 },
    trang: { id: 161, ma: 'BN-2026-0161', ho_ten: 'Vũ Thu Trang', gioi_tinh: 'Nữ', tuoi: 29, di_ung_thuoc: '', so_lan_kham: 2 },
    phuc: { id: 147, ma: 'BN-2026-0147', ho_ten: 'Lê Văn Phúc', gioi_tinh: 'Nam', tuoi: 35, di_ung_thuoc: 'Dị ứng Penicillin', so_lan_kham: 4 },
    anh: { id: 170, ma: 'BN-2026-0170', ho_ten: 'Phạm Ngọc Anh', gioi_tinh: 'Nữ', tuoi: 6, di_ung_thuoc: '', so_lan_kham: 1 },
    duc: { id: 139, ma: 'BN-2026-0139', ho_ten: 'Hoàng Minh Đức', gioi_tinh: 'Nam', tuoi: 62, di_ung_thuoc: '', so_lan_kham: 6 },
    huy: { id: 150, ma: 'BN-2026-0150', ho_ten: 'Đỗ Quang Huy', gioi_tinh: 'Nam', tuoi: 40, di_ung_thuoc: '', so_lan_kham: 1 },
    hoa: { id: 163, ma: 'BN-2026-0163', ho_ten: 'Đặng Thị Hoa', gioi_tinh: 'Nữ', tuoi: 41, di_ung_thuoc: '', so_lan_kham: 2 },
    lan: { id: 158, ma: 'BN-2026-0158', ho_ten: 'Phạm Thị Lan', gioi_tinh: 'Nữ', tuoi: 55, di_ung_thuoc: '', so_lan_kham: 3 },
}

const emptyEncounter = (id, lichKhamId, maLichKham, patient, ai, extra = {}) => ({
    id,
    lich_kham_id: lichKhamId,
    ma_lich_kham: maLichKham,
    benh_nhan: patient,
    ai_triage: ai,
    // Khoa của lượt khám (lấy từ lịch hẹn / phòng khám) — quyết định form khám chuyên khoa
    chuyen_khoa_kham: ai.ma_chuyen_khoa,
    kham_chuyen_khoa: null,
    thoi_gian_bat_dau: null,
    ly_do_vao_kham: '',
    benh_su: '',
    kham_lam_sang_bo_phan: '',
    nhiet_do_c: '',
    mach_lan_phut: '',
    huyet_ap_tam_thu: '',
    huyet_ap_tam_truong: '',
    nhip_tho_lan_phut: '',
    can_nang_kg: '',
    chieu_cao_cm: '',
    ket_luan_dieu_tri: '',
    loi_dan_bac_si: '',
    ngay_hen_tai_kham: '',
    danh_sach_chan_doan: [],
    danh_sach_chi_dinh: [],
    don_thuoc: { loi_dan_uong_thuoc: '', danh_sach_thuoc: [] },
    danh_gia_ai: null,
    is_locked: false,
    thoi_gian_khoa: null,
    lich_su: [],
    ...extra,
})

export const MOCK_ENCOUNTERS = {
    5001: emptyEncounter(5001, 701, 'LK-20261013-007', PATIENTS.mai,
        { trieu_chung_nhap: 'Sốt từ tối hôm kia, đi ngoài phân lỏng 5–6 lần một ngày, đau quặn quanh rốn, ăn uống kém.', ten_chuyen_khoa: 'Tiêu hóa', ma_chuyen_khoa: 'TIEU_HOA', do_tin_cay: 0.82, co_dau_hieu_cap_cuu: false },
        {
            thoi_gian_bat_dau: '2026-10-13T10:49:00',
            ly_do_vao_kham: 'Sốt 2 ngày, tiêu chảy 5–6 lần/ngày, phân lỏng không máu, đau quặn bụng quanh rốn.',
            benh_su: 'Tăng huyết áp 3 năm, đang dùng Amlodipin 5mg. Chưa dùng thuốc gì cho đợt này.',
            kham_lam_sang_bo_phan: 'Bụng mềm, ấn đau nhẹ quanh rốn, không phản ứng thành bụng. Môi hơi khô.',
            nhiet_do_c: '38.4', mach_lan_phut: '94', huyet_ap_tam_thu: '135', huyet_ap_tam_truong: '85',
            nhip_tho_lan_phut: '20', can_nang_kg: '56', chieu_cao_cm: '158',
            danh_sach_chi_dinh: [
                order(9001, 5001, 'DV_XN_MAU', 'da_co_ket_qua', {
                    ket_qua_phan_loai: 'BAT_THUONG',
                    ket_qua_chi_tiet: { loai: 'XET_NGHIEM', chi_so: { WBC: '13.2', 'NEU%': '82', RBC: '4.3', HGB: '128', HCT: '0.39', PLT: '245' }, ghi_chu: '' },
                }),
                order(9002, 5001, 'DV_XN_NUOC_TIEU', 'da_co_ket_qua', {
                    ket_qua_phan_loai: 'BINH_THUONG',
                    ket_qua_chi_tiet: { loai: 'XET_NGHIEM', chi_so: { pH: '6', SG: '1.02', GLU: 'Âm tính', PRO: 'Âm tính', LEU: 'Âm tính', NIT: 'Âm tính' }, ghi_chu: '' },
                }),
                order(9003, 5001, 'DV_SA_BUNG', 'dang_thuc_hien'),
                order(9004, 5001, 'DV_XN_SOI_PHAN', 'da_chi_dinh'),
            ],
            lich_su: [
                { id: 4801, ngay: '2026-09-02', bac_si: 'BS. Dung', chan_doan: 'Viêm họng cấp (J02.9)' },
                { id: 4502, ngay: '2026-07-15', bac_si: 'BS. Tuấn', chan_doan: 'Tăng huyết áp vô căn (I10)' },
            ],
        }),
    5002: emptyEncounter(5002, 702, 'LK-20261013-011', PATIENTS.tam,
        { trieu_chung_nhap: 'Khó thở tăng dần 2 ngày nay, đau ngực khi gắng sức.', ten_chuyen_khoa: 'Tim mạch', ma_chuyen_khoa: 'TIM_MACH', do_tin_cay: 0.77, co_dau_hieu_cap_cuu: true }),
    5003: emptyEncounter(5003, 703, 'LK-20261013-005', PATIENTS.trang,
        { trieu_chung_nhap: 'Đau đầu vùng thái dương, chóng mặt khi thay đổi tư thế.', ten_chuyen_khoa: 'Thần kinh', ma_chuyen_khoa: 'THAN_KINH', do_tin_cay: 0.64, co_dau_hieu_cap_cuu: false },
        {
            thoi_gian_bat_dau: '2026-10-13T09:30:00',
            ly_do_vao_kham: 'Đau đầu, chóng mặt 1 tuần.',
            nhiet_do_c: '36.8', mach_lan_phut: '78', huyet_ap_tam_thu: '110', huyet_ap_tam_truong: '70',
            danh_sach_chi_dinh: [
                order(9010, 5003, 'DV_XN_GLUCOSE', 'da_co_ket_qua', {
                    ket_qua_phan_loai: 'BINH_THUONG',
                    ket_qua_chi_tiet: { loai: 'XET_NGHIEM', chi_so: { GLU: '5.1' }, ghi_chu: '' },
                }),
            ],
        }),
    5004: emptyEncounter(5004, 704, 'LK-20261013-003', PATIENTS.phuc,
        { trieu_chung_nhap: 'Đau thượng vị âm ỉ, ợ chua sau ăn.', ten_chuyen_khoa: 'Tiêu hóa', ma_chuyen_khoa: 'TIEU_HOA', do_tin_cay: 0.88, co_dau_hieu_cap_cuu: false }),
    5005: emptyEncounter(5005, 705, 'LK-20261013-009', PATIENTS.anh,
        { trieu_chung_nhap: 'Ho, sổ mũi 3 ngày, sốt nhẹ về chiều.', ten_chuyen_khoa: 'Hô hấp', ma_chuyen_khoa: 'HO_HAP', do_tin_cay: 0.71, co_dau_hieu_cap_cuu: false }),
    5006: emptyEncounter(5006, 706, 'LK-20261013-012', PATIENTS.duc,
        { trieu_chung_nhap: 'Đo lại huyết áp, thỉnh thoảng hồi hộp.', ten_chuyen_khoa: 'Tim mạch', ma_chuyen_khoa: 'TIM_MACH', do_tin_cay: 0.69, co_dau_hieu_cap_cuu: false }),
}

export const MOCK_QUEUE = [
    { ticket_id: 301, encounter_id: 5001, so_thu_tu_kham: 1, muc_do_uu_tien: 2, trang_thai: 'dang_kham', so_lan_goi: 1, ghi_chu: 'Đang khám' },
    { ticket_id: 311, encounter_id: 5002, so_thu_tu_kham: 11, muc_do_uu_tien: 1, trang_thai: 'cho_kham', so_lan_goi: 0, ghi_chu: 'Vừa đến · ưu tiên tuyệt đối' },
    { ticket_id: 305, encounter_id: 5003, so_thu_tu_kham: 5, muc_do_uu_tien: 3, trang_thai: 'cho_kham', so_lan_goi: 0, ghi_chu: 'Quay lại kết luận' },
    { ticket_id: 303, encounter_id: 5004, so_thu_tu_kham: 3, muc_do_uu_tien: 2, trang_thai: 'cho_kham', so_lan_goi: 0, ghi_chu: 'Hẹn 11:00 · đã check-in' },
    { ticket_id: 309, encounter_id: 5005, so_thu_tu_kham: 9, muc_do_uu_tien: 4, trang_thai: 'cho_kham', so_lan_goi: 0, ghi_chu: 'Hẹn 11:30' },
    { ticket_id: 312, encounter_id: 5006, so_thu_tu_kham: 12, muc_do_uu_tien: 5, trang_thai: 'cho_kham', so_lan_goi: 0, ghi_chu: 'Chờ 25 phút' },
    { ticket_id: 304, encounter_id: null, so_thu_tu_kham: 4, muc_do_uu_tien: 2, trang_thai: 'tam_hoan', so_lan_goi: 3, ghi_chu: 'Gọi 3 lần không vào', benh_nhan: PATIENTS.huy },
]

// Chỉ định của các lượt khám khác (để danh sách CLS có nhiều bệnh nhân)
export const MOCK_EXTRA_ORDERS = [
    { ...order(9020, 5006, 'DV_ECG', 'dang_thuc_hien'), benh_nhan: PATIENTS.duc, ly_do: 'Tăng huyết áp, hồi hộp', bac_si_chi_dinh: 'BS. Tuấn', thoi_gian_chi_dinh: '2026-10-13T10:15:00' },
    { ...order(9021, 5100, 'DV_HO_HAP_KY', 'da_chi_dinh'), benh_nhan: PATIENTS.lan, ly_do: 'Ho kéo dài, khò khè', bac_si_chi_dinh: 'BS. Hà', thoi_gian_chi_dinh: '2026-10-13T10:40:00' },
    { ...order(9022, 5101, 'DV_EEG', 'da_chi_dinh'), benh_nhan: PATIENTS.trang, ly_do: 'Đau đầu, chóng mặt', bac_si_chi_dinh: 'BS. Dung', thoi_gian_chi_dinh: '2026-10-13T10:55:00' },
    { ...order(9023, 5102, 'DV_NS_TMH', 'dang_thuc_hien'), benh_nhan: PATIENTS.hoa, ly_do: 'Nghẹt mũi, ù tai phải 1 tuần', bac_si_chi_dinh: 'BS. Minh', thoi_gian_chi_dinh: '2026-10-13T10:35:00' },
    { ...order(9024, 5004, 'DV_NS_DA_DAY', 'da_chi_dinh'), benh_nhan: PATIENTS.phuc, ly_do: 'Đau thượng vị', bac_si_chi_dinh: 'BS. Dung', thoi_gian_chi_dinh: '2026-10-13T10:08:00' },
    { ...order(9025, 5002, 'DV_XQ_NGUC', 'da_chi_dinh'), benh_nhan: PATIENTS.tam, ly_do: 'Khó thở tăng dần', bac_si_chi_dinh: 'BS. Hà', thoi_gian_chi_dinh: '2026-10-13T11:05:00' },
    { ...order(9026, 5104, 'DV_XN_MO_MAU', 'da_chi_dinh'), benh_nhan: PATIENTS.duc, ly_do: 'Tăng huyết áp', bac_si_chi_dinh: 'BS. Tuấn', thoi_gian_chi_dinh: '2026-10-13T10:16:00' },
]
