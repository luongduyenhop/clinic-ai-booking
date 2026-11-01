// Hằng số nghiệp vụ dùng chung cho Bàn khám & Cận lâm sàng (phân hệ Bác sĩ)

// 5 bậc ưu tiên hàng đợi (HangDoiKham.muc_do_uu_tien)
export const PRIORITY_TIERS = {
    1: { label: 'B1 · Cờ đỏ', badge: 'medpro-badge-danger' },
    2: { label: 'B2 · Đúng hẹn', badge: 'medpro-badge-info' },
    3: { label: 'B3 · Có KQ CLS', badge: 'medpro-badge-success' },
    4: { label: 'B4 · Đến sớm', badge: 'medpro-badge-warning' },
    5: { label: 'B5 · Vãng lai', badge: 'medpro-badge' },
}

// Nhóm dịch vụ CLS (đề xuất cột DichVu.nhom_dich_vu)
export const SERVICE_GROUPS = [
    { key: 'XET_NGHIEM', label: 'Xét nghiệm', icon: 'Flask' },
    { key: 'CDHA', label: 'Chẩn đoán hình ảnh', icon: 'Scan' },
    { key: 'TDCN', label: 'Thăm dò chức năng', icon: 'Waveform' },
    { key: 'NOI_SOI', label: 'Nội soi', icon: 'Eye' },
]

// Trạng thái chỉ định (ChiDinh.trang_thai)
export const ORDER_STATUS = {
    CHO_THUC_HIEN: { label: 'Chờ thực hiện', badge: 'medpro-badge' },
    da_chi_dinh: { label: 'Chờ thực hiện', badge: 'medpro-badge' },
    dang_thuc_hien: { label: 'Đang làm', badge: 'medpro-badge-info' },
    da_co_ket_qua: { label: 'Có kết quả', badge: 'medpro-badge-success' },
    da_huy: { label: 'Đã hủy', badge: 'medpro-badge-danger' },
}

export const RESULT_CLASS = {
    BINH_THUONG: { label: 'Bình thường', badge: 'medpro-badge-success' },
    BAT_THUONG: { label: 'Bất thường', badge: 'medpro-badge-danger' },
    NGUY_KICH: { label: 'Nguy kịch', badge: 'medpro-badge-danger' },
}

// Gói chỉ định nhanh theo 5 chuyên khoa của AI Triage
export const SPECIALTY_PACKS = [
    { key: 'TIM_MACH', label: 'Tim mạch', services: ['DV_ECG', 'DV_SA_TIM', 'DV_XN_MO_MAU'] },
    { key: 'HO_HAP', label: 'Hô hấp', services: ['DV_XQ_NGUC', 'DV_HO_HAP_KY', 'DV_XN_MAU'] },
    { key: 'TIEU_HOA', label: 'Tiêu hóa', services: ['DV_XN_MAU', 'DV_XN_NUOC_TIEU', 'DV_XN_SOI_PHAN', 'DV_SA_BUNG'] },
    { key: 'THAN_KINH', label: 'Thần kinh', services: ['DV_EEG', 'DV_XN_GLUCOSE'] },
    { key: 'TMH', label: 'Tai – Mũi – Họng', services: ['DV_NS_TMH', 'DV_DO_THINH_LUC'] },
]

// Khám lâm sàng theo chuyên khoa (8 khoa trong danh mục ChuyenKhoa của backend).
// items: mục khám chọn Bình thường / Bất thường kèm mô tả; extras: chỉ số riêng của khoa.
export const SPECIALTY_EXAMS = [
    {
        key: 'NOI_TONG_QUAT',
        label: 'Nội tổng quát',
        items: ['Toàn trạng', 'Tim mạch', 'Hô hấp', 'Tiêu hóa', 'Thận – tiết niệu', 'Thần kinh', 'Cơ xương khớp'],
        extras: [],
    },
    {
        key: 'TIM_MACH',
        label: 'Tim mạch',
        items: ['Nhịp tim', 'Tiếng tim T1, T2', 'Tiếng thổi', 'Mạch ngoại biên', 'Phù chi', 'Tĩnh mạch cổ'],
        extras: [{ key: 'nyha', label: 'Phân độ suy tim NYHA', type: 'select', options: ['Không suy tim', 'I', 'II', 'III', 'IV'] }],
    },
    {
        key: 'HO_HAP',
        label: 'Hô hấp',
        items: ['Lồng ngực', 'Co kéo cơ hô hấp', 'Rì rào phế nang', 'Ran phổi', 'Gõ phổi'],
        extras: [],
    },
    {
        key: 'TIEU_HOA',
        label: 'Tiêu hóa',
        items: ['Bụng', 'Điểm đau khu trú', 'Phản ứng thành bụng', 'Gan', 'Lách', 'Nhu động ruột'],
        extras: [],
    },
    {
        key: 'THAN_KINH',
        label: 'Thần kinh',
        items: ['Tri giác', 'Dấu thần kinh khu trú', 'Sức cơ', 'Phản xạ gân xương', 'Dấu màng não', 'Dây thần kinh sọ'],
        extras: [{ key: 'gcs', label: 'Điểm Glasgow (GCS)', type: 'number', min: 3, max: 15, normal: 15 }],
    },
    {
        key: 'TMH',
        label: 'Tai – Mũi – Họng',
        items: ['Tai phải', 'Tai trái', 'Mũi – xoang', 'Họng', 'Thanh quản', 'Hạch cổ'],
        extras: [],
    },
    {
        key: 'DA_LIEU',
        label: 'Da liễu',
        items: ['Vị trí tổn thương', 'Hình thái tổn thương', 'Phân bố – kích thước', 'Ngứa', 'Niêm mạc, móng, tóc'],
        extras: [],
    },
    {
        key: 'CO_XUONG_KHOP',
        label: 'Cơ xương khớp',
        items: ['Khớp đau', 'Sưng, nóng, đỏ', 'Tầm vận động', 'Biến dạng khớp', 'Cột sống'],
        extras: [{ key: 'vas', label: 'Mức đau VAS (0–10)', type: 'number', min: 0, max: 10 }],
    },
]

export const findSpecialtyExam = (key) => SPECIALTY_EXAMS.find((s) => s.key === key) || SPECIALTY_EXAMS[0]

// Ghép kết quả khám chuyên khoa thành văn bản cho trường luot_kham.kham_lam_sang_bo_phan
export function composeSpecialtyText(exam) {
    if (!exam?.khoa) return ''
    const spec = findSpecialtyExam(exam.khoa)
    const parts = spec.items
        .map((label) => {
            const it = exam.items?.[label]
            if (!it?.status) return null
            return it.status === 'BT' ? `${label}: bình thường` : `${label}: ${it.note || 'bất thường'}`
        })
        .filter(Boolean)
    spec.extras.forEach((x) => {
        const v = exam.extras?.[x.key]
        if (v !== undefined && v !== '') parts.push(`${x.label}: ${v}`)
    })
    return parts.length ? `[Khám ${spec.label}] ${parts.join('; ')}.` : ''
}

// Mẫu chỉ số xét nghiệm theo mã dịch vụ. Chỉ số định tính dùng `normal`, định lượng dùng `low/high`
export const LAB_TEMPLATES = {
    DV_XN_MAU: [
        { code: 'WBC', name: 'Bạch cầu', unit: 'G/L', low: 4, high: 10 },
        { code: 'NEU%', name: 'Bạch cầu trung tính', unit: '%', low: 40, high: 75 },
        { code: 'RBC', name: 'Hồng cầu', unit: 'T/L', low: 3.8, high: 5 },
        { code: 'HGB', name: 'Huyết sắc tố', unit: 'g/L', low: 120, high: 150 },
        { code: 'HCT', name: 'Hematocrit', unit: 'L/L', low: 0.36, high: 0.46 },
        { code: 'PLT', name: 'Tiểu cầu', unit: 'G/L', low: 150, high: 400 },
    ],
    DV_XN_NUOC_TIEU: [
        { code: 'pH', name: 'pH', unit: '', low: 5, high: 6.5 },
        { code: 'SG', name: 'Tỷ trọng', unit: '', low: 1.005, high: 1.03 },
        { code: 'GLU', name: 'Glucose', unit: '', normal: 'Âm tính' },
        { code: 'PRO', name: 'Protein', unit: '', normal: 'Âm tính' },
        { code: 'LEU', name: 'Bạch cầu', unit: '', normal: 'Âm tính' },
        { code: 'NIT', name: 'Nitrit', unit: '', normal: 'Âm tính' },
    ],
    DV_XN_SOI_PHAN: [
        { code: 'HC', name: 'Hồng cầu trong phân', unit: '', normal: 'Âm tính' },
        { code: 'BC', name: 'Bạch cầu trong phân', unit: '', normal: 'Âm tính' },
        { code: 'KST', name: 'Ký sinh trùng', unit: '', normal: 'Âm tính' },
    ],
    DV_XN_MO_MAU: [
        { code: 'CHOL', name: 'Cholesterol toàn phần', unit: 'mmol/L', low: 0, high: 5.2 },
        { code: 'TG', name: 'Triglycerid', unit: 'mmol/L', low: 0, high: 1.7 },
        { code: 'HDL', name: 'HDL-C', unit: 'mmol/L', low: 1.0, high: 99 },
        { code: 'LDL', name: 'LDL-C', unit: 'mmol/L', low: 0, high: 3.4 },
    ],
    DV_XN_GLUCOSE: [{ code: 'GLU', name: 'Glucose máu lúc đói', unit: 'mmol/L', low: 3.9, high: 6.4 }],
    DV_XN_CRP: [{ code: 'CRP', name: 'CRP định lượng', unit: 'mg/L', low: 0, high: 5 }],
}

// Thông số thăm dò chức năng theo mã dịch vụ
export const FUNCTIONAL_TEMPLATES = {
    DV_ECG: {
        params: [
            { code: 'NHIP', name: 'Nhịp', unit: '', normal: 'Xoang' },
            { code: 'TAN_SO', name: 'Tần số', unit: 'lần/phút', low: 60, high: 100 },
            { code: 'TRUC', name: 'Trục điện tim', unit: '', normal: 'Trung gian' },
            { code: 'PR', name: 'Khoảng PR', unit: 'ms', low: 120, high: 200 },
            { code: 'QRS', name: 'Phức bộ QRS', unit: 'ms', low: 0, high: 120 },
            { code: 'QTC', name: 'QTc', unit: 'ms', low: 0, high: 450 },
            { code: 'SOKOLOW', name: 'Sokolow-Lyon', unit: 'mm', low: 0, high: 35 },
        ],
        presets: {
            'Điện tim bình thường': 'Nhịp xoang đều. Trục trung gian. Không thấy bất thường.',
            'Dày thất trái': 'Nhịp xoang đều. Dấu hiệu dày thất trái theo tiêu chuẩn Sokolow-Lyon.',
            'Rung nhĩ': 'Rung nhĩ, tần số thất không đều.',
        },
    },
    DV_HO_HAP_KY: {
        params: [
            { code: 'FVC', name: 'FVC (% dự đoán)', unit: '%', low: 80, high: 200 },
            { code: 'FEV1', name: 'FEV1 (% dự đoán)', unit: '%', low: 80, high: 200 },
            { code: 'FEV1_FVC', name: 'FEV1/FVC', unit: '%', low: 70, high: 100 },
            { code: 'PEF', name: 'PEF (% dự đoán)', unit: '%', low: 80, high: 200 },
        ],
        presets: {
            'Chức năng hô hấp bình thường': 'Các chỉ số trong giới hạn bình thường.',
            'Rối loạn thông khí tắc nghẽn': 'Rối loạn thông khí tắc nghẽn mức độ nhẹ (FEV1/FVC < 70%).',
        },
    },
    DV_EEG: {
        params: [
            { code: 'NHIP_NEN', name: 'Nhịp nền', unit: '', normal: 'Alpha' },
            { code: 'ALPHA', name: 'Tần số alpha', unit: 'Hz', low: 8, high: 13 },
            { code: 'SONG_BT', name: 'Sóng bất thường', unit: '', normal: 'Không' },
        ],
        presets: {
            'Điện não bình thường': 'Điện não đồ trong giới hạn bình thường.',
        },
    },
    DV_DO_THINH_LUC: {
        params: [
            { code: 'TAI_P', name: 'Ngưỡng nghe tai phải', unit: 'dB', low: 0, high: 25 },
            { code: 'TAI_T', name: 'Ngưỡng nghe tai trái', unit: 'dB', low: 0, high: 25 },
        ],
        presets: {
            'Thính lực bình thường': 'Thính lực hai tai trong giới hạn bình thường.',
        },
    },
}

// Mẫu kết quả chẩn đoán hình ảnh
export const IMAGING_PRESETS = {
    DV_SA_BUNG: {
        'Ổ bụng bình thường': {
            mo_ta: 'Gan: không to, bờ đều, nhu mô đồng nhất.\nTúi mật: không căng, thành mỏng, không sỏi.\nTụy, lách: kích thước bình thường.\nThận hai bên: không giãn đài bể thận, không sỏi.\nKhông có dịch ổ bụng.',
            ket_luan: 'Chưa phát hiện bất thường trên siêu âm ổ bụng.',
        },
        'Gan nhiễm mỡ độ I': {
            mo_ta: 'Gan: không to, nhu mô tăng âm nhẹ lan tỏa, bờ đều.\nCác tạng khác chưa thấy bất thường.',
            ket_luan: 'Gan nhiễm mỡ độ I.',
        },
    },
    DV_XQ_NGUC: {
        'Tim phổi bình thường': {
            mo_ta: 'Hai phế trường sáng đều, không thấy tổn thương nhu mô.\nBóng tim không to. Góc sườn hoành hai bên nhọn.',
            ket_luan: 'Hình ảnh tim phổi bình thường.',
        },
        'Viêm phổi thùy': {
            mo_ta: 'Đám mờ thuần nhất thùy dưới phổi phải, có hình ảnh phế quản hơi.',
            ket_luan: 'Hình ảnh viêm phổi thùy dưới phải.',
        },
    },
    DV_SA_TIM: {
        'Siêu âm tim bình thường': {
            mo_ta: 'Các buồng tim không giãn. Vận động thành tim đều.\nCác van tim mở tốt. EF (Simpson) 65%.',
            ket_luan: 'Chưa phát hiện bất thường trên siêu âm tim.',
        },
    },
}

// Nội soi: mô tả theo vị trí giải phẫu
export const ENDOSCOPY_TEMPLATES = {
    DV_NS_TMH: {
        sites: ['Tai phải', 'Tai trái', 'Mũi – xoang', 'Họng – thanh quản'],
        presets: {
            'TMH bình thường': {
                'Tai phải': 'Ống tai sạch. Màng nhĩ bình thường.',
                'Tai trái': 'Ống tai sạch. Màng nhĩ bình thường.',
                'Mũi – xoang': 'Niêm mạc mũi hồng, không phù nề. Khe giữa sạch.',
                'Họng – thanh quản': 'Họng không đỏ. Thanh quản di động tốt.',
                ket_luan: 'Chưa phát hiện bất thường Tai – Mũi – Họng.',
            },
            'Viêm mũi xoang cấp': {
                'Tai phải': 'Ống tai sạch. Màng nhĩ bình thường.',
                'Tai trái': 'Ống tai sạch. Màng nhĩ bình thường.',
                'Mũi – xoang': 'Niêm mạc mũi phù nề, cuốn dưới quá phát hai bên. Dịch nhầy đục ở khe giữa.',
                'Họng – thanh quản': 'Họng đỏ nhẹ, có dịch chảy xuống thành sau họng.',
                ket_luan: 'Viêm mũi xoang cấp.',
            },
        },
    },
    DV_NS_DA_DAY: {
        sites: ['Thực quản', 'Dạ dày', 'Tá tràng'],
        presets: {
            'Dạ dày bình thường': {
                'Thực quản': 'Niêm mạc hồng, đường Z rõ.',
                'Dạ dày': 'Niêm mạc hồng, nếp niêm mạc mềm mại.',
                'Tá tràng': 'Hành tá tràng không loét, không biến dạng.',
                ket_luan: 'Chưa phát hiện tổn thương trên nội soi.',
            },
            'Viêm dạ dày': {
                'Thực quản': 'Niêm mạc hồng, đường Z rõ.',
                'Dạ dày': 'Niêm mạc hang vị phù nề, sung huyết rải rác.',
                'Tá tràng': 'Hành tá tràng không loét.',
                ket_luan: 'Viêm dạ dày hang vị.',
            },
        },
    },
}

// Nhóm hoạt chất dùng để cảnh báo dị ứng thuốc (đối chiếu BenhNhan.di_ung_thuoc)
export const DRUG_ALLERGY_GROUPS = [
    { group: 'NSAID', actives: ['ibuprofen', 'diclofenac', 'meloxicam', 'naproxen', 'aspirin', 'celecoxib', 'piroxicam', 'ketoprofen'] },
    { group: 'Penicillin', actives: ['penicillin', 'amoxicillin', 'ampicillin', 'augmentin', 'cloxacillin'] },
    { group: 'Sulfamid', actives: ['sulfamethoxazole', 'cotrimoxazole'] },
]

// Tra nhóm dị ứng cho một hoạt chất; trả về tên nhóm nếu bệnh nhân có ghi nhận dị ứng tương ứng
export function findAllergyConflict(activeIngredient, patientAllergyText) {
    const allergy = String(patientAllergyText || '').toLowerCase()
    const active = String(activeIngredient || '').toLowerCase()
    if (!allergy || !active) return null
    if (allergy.includes(active)) return active
    const hit = DRUG_ALLERGY_GROUPS.find(
        (g) => g.actives.some((a) => active.includes(a)) && allergy.includes(g.group.toLowerCase())
    )
    return hit ? hit.group : null
}

// Đánh giá một chỉ số: trả về 'HIGH' | 'LOW' | 'ABN' | null
export function evaluateIndicator(param, rawValue) {
    const value = String(rawValue ?? '').trim()
    if (!value) return null
    if (param.normal !== undefined) {
        return value.toLowerCase() === String(param.normal).toLowerCase() ? null : 'ABN'
    }
    const num = Number(value.replace(',', '.'))
    if (Number.isNaN(num)) return null
    if (param.high !== undefined && num > param.high) return 'HIGH'
    if (param.low !== undefined && num < param.low) return 'LOW'
    return null
}

export function formatReference(param) {
    if (param.normal !== undefined) return param.normal
    if (param.low === 0) return `dưới ${param.high}`
    if (param.high >= 99) return `trên ${param.low}`
    return `${param.low} – ${param.high}`
}

export const FLAG_LABEL = { HIGH: 'Cao ▲', LOW: 'Thấp ▼', ABN: 'Bất thường' }
