// Hằng số & hàm tính toán dùng chung cho các bước khám (tách khỏi file component để giữ Fast Refresh)

export const EXAM_STEPS = ['Khám lâm sàng', 'Chỉ định CLS', 'Chẩn đoán', 'Đơn thuốc & hẹn']

export const VITAL_FIELDS = [
    { name: 'nhiet_do_c', label: 'Nhiệt độ', unit: '°C', min: 34, max: 42, alert: (v) => v >= 37.5 && 'Sốt' },
    { name: 'mach_lan_phut', label: 'Mạch', unit: 'lần/phút', min: 30, max: 220, alert: (v) => (v > 100 ? 'Nhanh' : v < 60 ? 'Chậm' : null) },
    { name: 'huyet_ap_tam_thu', label: 'HA tâm thu', unit: 'mmHg', min: 60, max: 260, alert: (v) => v >= 140 && 'Cao' },
    { name: 'huyet_ap_tam_truong', label: 'HA tâm trương', unit: 'mmHg', min: 30, max: 160, alert: (v) => v >= 90 && 'Cao' },
    { name: 'nhip_tho_lan_phut', label: 'Nhịp thở', unit: 'lần/phút', min: 5, max: 60, alert: (v) => v > 24 && 'Nhanh' },
    { name: 'can_nang_kg', label: 'Cân nặng', unit: 'kg', min: 1, max: 300 },
    { name: 'chieu_cao_cm', label: 'Chiều cao', unit: 'cm', min: 30, max: 250 },
]

export const computeBmi = (kg, cm) => {
    const w = Number(kg)
    const h = Number(cm) / 100
    if (!w || !h || h <= 0) return ''
    return (w / (h * h)).toFixed(1)
}

// Phân loại thể trạng BMI theo chuẩn IDI & WPRO / Bộ Y Tế dành cho người Châu Á
export const getBmiClassification = (bmiVal) => {
    const val = Number(bmiVal)
    if (!val || Number.isNaN(val) || val <= 0) return null
    if (val < 18.5) {
        return { label: 'Gầy / Thiếu cân', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300', alert: true }
    }
    if (val <= 22.9) {
        return { label: 'Thể trạng chuẩn', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300', alert: false }
    }
    if (val <= 24.9) {
        return { label: 'Tiền béo phì', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300', alert: true }
    }
    if (val <= 29.9) {
        return { label: 'Béo phì độ I', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300', alert: true }
    }
    return { label: 'Béo phì độ II', badgeClass: 'bg-red-200 text-red-900 border-red-400 font-extrabold', alert: true }
}

export const DOSE_SLOTS = [
    { key: 'sang', label: 'Sáng' },
    { key: 'trua', label: 'Trưa' },
    { key: 'chieu', label: 'Chiều' },
    { key: 'toi', label: 'Tối' },
]

// Số lượng = tổng liều trong ngày × số ngày dùng
export const computeQuantity = (row) => {
    const perDay = DOSE_SLOTS.reduce((sum, s) => sum + (Number(row[s.key]) || 0), 0)
    return perDay * (Number(row.so_ngay_dung) || 0)
}

// Ghép liều S/T/C/T thành chuỗi "Sáng 1, Chiều 1" cho trường cach_dung của backend
export const doseText = (row) =>
    DOSE_SLOTS.filter((s) => Number(row[s.key]) > 0)
        .map((s) => `${s.label} ${row[s.key]}`)
        .join(', ')
