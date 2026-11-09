


export const PRIORITY_TIERS = {
    1: { label: 'B1 · Cờ đỏ', badge: 'medpro-badge-danger' },
    2: { label: 'B2 · Đúng hẹn', badge: 'medpro-badge-info' },
    3: { label: 'B3 · Có KQ CLS', badge: 'medpro-badge-success' },
    4: { label: 'B4 · Đến sớm', badge: 'medpro-badge-warning' },
    5: { label: 'B5 · Vãng lai', badge: 'medpro-badge' },
}


export const SERVICE_GROUPS = [
    { key: 'XET_NGHIEM', label: 'Xét nghiệm', icon: 'Flask' },
    { key: 'CDHA', label: 'Chẩn đoán hình ảnh', icon: 'Scan' },
    { key: 'TDCN', label: 'Thăm dò chức năng', icon: 'Waveform' },
    { key: 'NOI_SOI', label: 'Nội soi', icon: 'Eye' },
]


export const ORDER_STATUS = {
    CHO_THUC_HIEN: { label: 'Chờ thực hiện', badge: 'medpro-badge' },
    da_chi_dinh: { label: 'Chờ thực hiện', badge: 'medpro-badge' },
    dang_thuc_hien: { label: 'Đang làm', badge: 'medpro-badge-info' },
    DANG_THUC_HIEN: { label: 'Đang làm', badge: 'medpro-badge-info' },
    da_co_ket_qua: { label: 'Có kết quả', badge: 'medpro-badge-success' },
    DA_CO_KET_QUA: { label: 'Có kết quả', badge: 'medpro-badge-success' },
    da_duyet: { label: 'Đã duyệt', badge: 'medpro-badge-success' },
    DA_DUYET: { label: 'Đã duyệt', badge: 'medpro-badge-success' },
    hoan_thanh: { label: 'Hoàn thành', badge: 'medpro-badge-success' },
    HOAN_THANH: { label: 'Hoàn thành', badge: 'medpro-badge-success' },
    da_huy: { label: 'Đã hủy', badge: 'medpro-badge-danger' },
    DA_HUY: { label: 'Đã hủy', badge: 'medpro-badge-danger' },
    cho_duyet: { label: 'Chờ duyệt', badge: 'medpro-badge-warning' },
    CHO_DUYET: { label: 'Chờ duyệt', badge: 'medpro-badge-warning' },
}


export const isOrderNotStarted = (order) => {
    const s = String(order?.trang_thai || '').toUpperCase()
    return s === 'CHO_THUC_HIEN' || s === 'DA_THIET_LAP' || s === 'DA_CHI_DINH' || s === 'DA_THANH_TOAN'
}

export const clsDisplayStatus = (order) => {
    if (!order) return 'da_chi_dinh'
    if (order.trang_thai === 'dang_thuc_hien' && order.trang_thai_ket_qua === 'DA_CO_KET_QUA') {
        return 'cho_duyet'
    }
    const raw = String(order.trang_thai || '').toLowerCase()
    if (raw === 'cho_thuc_hien' || raw === 'da_thanh_toan' || raw === 'da_chi_dinh') {
        return 'da_chi_dinh'
    }
    return raw || 'da_chi_dinh'
}

export const RESULT_CLASS = {
    BINH_THUONG: { label: 'Bình thường', badge: 'medpro-badge-success' },
    BAT_THUONG: { label: 'Bất thường', badge: 'medpro-badge-danger' },
    NGUY_KICH: { label: 'Nguy kịch', badge: 'medpro-badge-danger' },
}


export const SPECIALTY_PACKS = [
    { key: 'TIM_MACH', label: 'Tim mạch', services: ['DV_ECG', 'DV_SA_TIM', 'DV_XN_MO_MAU'] },
    { key: 'HO_HAP', label: 'Hô hấp', services: ['DV_XQ_NGUC', 'DV_HO_HAP_KY', 'DV_XN_MAU'] },
    { key: 'TIEU_HOA', label: 'Tiêu hóa', services: ['DV_XN_MAU', 'DV_XN_NUOC_TIEU', 'DV_XN_SOI_PHAN', 'DV_SA_BUNG'] },
    { key: 'THAN_KINH', label: 'Thần kinh', services: ['DV_EEG', 'DV_XN_GLUCOSE'] },
    { key: 'TMH', label: 'Tai – Mũi – Họng', services: ['DV_NS_TMH', 'DV_DO_THINH_LUC'] },
]




export const SPECIALTY_EXAMS = [
    {
        key: 'noi-khoa',
        aliases: ['noi', 'NOI_TONG_QUAT', 'NOI_KHOA', 'KHOA_NOI', 'TIM_MACH', 'HO_HAP', 'TIEU_HOA', 'THAN_KINH', 'CO_XUONG_KHOP', 'Khoa Nội tổng quát', 'Nội tổng quát', 'Tim mạch', 'Tiêu hóa', 'Hô hấp', 'Thần kinh'],
        deptCode: 'NOI',
        label: 'Khoa Nội tổng quát',
        items: [
            'Tuần hoàn (Tim mạch)',
            'Hô hấp',
            'Tiêu hóa',
            'Thận – Tiết niệu',
            'Thần kinh',
            'Cơ xương khớp',
        ],
        extras: [],
    },
    {
        key: 'ngoai-khoa',
        aliases: ['ngoai', 'NGOAI_KHOA', 'KHOA_NGOAI', 'Khoa Ngoại', 'Ngoại tổng hợp', 'Ngoại khoa'],
        deptCode: 'NGOAI',
        label: 'Khoa Ngoại',
        items: [
            'Khám ngoại tổng quát',
            'Vết thương / Vết mổ',
            'Khối u / Thoát vị',
            'Dị tật / Tầm vận động',
        ],
        extras: [
            { key: 'chi_dinh_phau_thuat_thu_thuat', label: 'Chỉ định phẫu thuật / thủ thuật', type: 'text' },
            { key: 'chi_dinh_tieu_phau', label: 'Chỉ định tiểu phẫu', type: 'text' },
        ],
    },
    {
        key: 'mat',
        aliases: ['MAT', 'KHOA_MAT', 'nhan-khoa', 'nhan_khoa', 'Khoa Mắt', 'Nhãn khoa', 'Mắt'],
        deptCode: 'MAT',
        label: 'Khoa Mắt',
        items: [
            'Thị lực mắt phải (Snellen)',
            'Thị lực mắt trái (Snellen)',
            'Nhãn áp mắt phải (mmHg)',
            'Nhãn áp mắt trái (mmHg)',
            'Bán phần trước',
            'Đáy mắt',
        ],
        extras: [],
    },
    {
        key: 'tai-mui-hong',
        aliases: ['tmh', 'TMH', 'KHOA_TMH', 'Khoa Tai Mũi Họng', 'Tai Mũi Họng', 'Tai - Mũi - Họng'],
        deptCode: 'TMH',
        label: 'Khoa Tai Mũi Họng',
        items: [
            'Tai phải',
            'Tai trái',
            'Mũi – xoang',
            'Họng – thanh quản',
            'Hạch cổ',
            'Thính lực 2 tai',
        ],
        extras: [],
    },
    {
        key: 'rang-ham-mat',
        aliases: ['rhm', 'RHM', 'KHOA_RANG', 'RANG_HAM_MAT', 'Khoa Răng Hàm Mặt', 'Khoa Răng', 'Răng Hàm Mặt', 'Răng - Hàm - Mặt'],
        deptCode: 'RHM',
        label: 'Khoa Răng Hàm Mặt',
        items: [
            'Cung hàm trên',
            'Cung hàm dưới',
            'Nha chu & nướu lợi',
            'Khớp thái dương hàm',
            'Niêm mạc miệng',
        ],
        extras: [
            { key: 'vi_tri_rang', label: 'Vị trí răng tổn thương', type: 'text' },
            { key: 'tinh_trang_rang', label: 'Tình trạng răng', type: 'text' },
        ],
    },
]

export const findSpecialtyExam = (key) => {
    if (!key) return SPECIALTY_EXAMS[0]
    const normalized = String(key).trim().toLowerCase()
    return (
        SPECIALTY_EXAMS.find(
            (s) =>
                s.key === key ||
                s.key === normalized ||
                s.label.toLowerCase() === normalized ||
                s.deptCode.toLowerCase() === normalized ||
                s.aliases?.some((a) => a.toLowerCase() === normalized)
        ) || SPECIALTY_EXAMS[0]
    )
}


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
FUNCTIONAL_TEMPLATES.DV010 = FUNCTIONAL_TEMPLATES.DV_ECG

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
    DV_SA_GIAP: {
        'Tuyến giáp bình thường': {
            mo_ta: 'Hai thùy và eo tuyến giáp kích thước trong giới hạn bình thường, nhu mô đều, không thấy khối khu trú, hạch cổ hai bên không sưng.',
            ket_luan: 'TIRADS 1 - Tuyến giáp bình thường.',
        },
        'Nhân tuyến giáp 2 thùy TIRADS 2': {
            mo_ta: 'Nang keo tuyến giáp dạng bọt biển, kích thước nhỏ 3-5mm rải rác hai thùy, bờ rõ, không vi vôi hóa.',
            ket_luan: 'TIRADS 2 - Nhân lành tính tuyến giáp hai thùy.',
        },
    },
    DV_SA_VU: {
        'Tuyến vú bình thường': {
            mo_ta: 'Mô tuyến vú hai bên phân bố đều, không thấy tổn thương khu trú, không giãn ống tuyến, hạch nách hai bên bình thường.',
            ket_luan: 'BI-RADS 1 - Hình ảnh siêu âm tuyến vú hai bên bình thường.',
        },
    },
    DV_SA_MACH_CHI: {
        'Doppler mạch máu bình thường': {
            mo_ta: 'Lòng mạch thông thoáng, thành mạch mềm mại, phổ Doppler màu và phổ xung dòng chảy trong giới hạn bình thường, không có huyết khối.',
            ket_luan: 'Chưa thấy bất thường trên siêu âm Doppler mạch máu chi.',
        },
    },
    DV_XQ_XOANG: {
        'Xoang hàm trán bình thường': {
            mo_ta: 'Các xoang hàm, xoang trán hai bên sáng đều, niêm mạc không dày, không có mức dịch - khí, vách ngăn mũi thẳng.',
            ket_luan: 'Chưa thấy hình ảnh viêm xoang trên phim X-quang Blondeau - Hirtz.',
        },
    },
    DV_XQ_COT_SONG: {
        'Cột sống thắt lưng bình thường': {
            mo_ta: 'Đường cong sinh lý cột sống thắt lưng được bảo tồn. Thân các đốt sống đều, khe gian đốt bình thường, không trượt đốt sống.',
            ket_luan: 'Chưa thấy bất thường cột sống thắt lưng trên X-quang.',
        },
        'Thoái hóa cột sống thắt lưng': {
            mo_ta: 'Gai xương thoái hóa nhẹ bờ trước và bên các thân đốt L3-L5. Hẹp nhẹ khe đĩa đệm L4-L5.',
            ket_luan: 'Thoái hóa cột sống thắt lưng.',
        },
    },
    DV_XQ_KHOP_GOI: {
        'Khớp gối bình thường': {
            mo_ta: 'Khe khớp gối hai bên đều, không hẹp, gai xương không rõ, diện khớp nhẵn, không tràn dịch bao khớp.',
            ket_luan: 'Hình ảnh khớp gối hai bên trong giới hạn bình thường.',
        },
    },
    DV_XQ_RANG_PANO: {
        'Panorama răng bình thường': {
            mo_ta: 'Cung răng trên và dưới đều, không thấy tổn thương sâu ngà tủy lan rộng, xương ổ răng và mào xương bình thường.',
            ket_luan: 'Phim Panorama toàn cảnh hàm răng chưa thấy bất thường.',
        },
    },
}
IMAGING_PRESETS.DV005 = IMAGING_PRESETS.DV_SA_BUNG
IMAGING_PRESETS.DV006 = IMAGING_PRESETS.DV_SA_TIM
IMAGING_PRESETS.DV008 = IMAGING_PRESETS.DV_XQ_NGUC


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
ENDOSCOPY_TEMPLATES.DV009 = ENDOSCOPY_TEMPLATES.DV_NS_TMH


export const DRUG_ALLERGY_GROUPS = [
    { group: 'NSAID', actives: ['ibuprofen', 'diclofenac', 'meloxicam', 'naproxen', 'aspirin', 'celecoxib', 'piroxicam', 'ketoprofen'] },
    { group: 'Penicillin', actives: ['penicillin', 'amoxicillin', 'ampicillin', 'augmentin', 'cloxacillin'] },
    { group: 'Sulfamid', actives: ['sulfamethoxazole', 'cotrimoxazole'] },
]


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


export const LAB_DANH_GIA = {
    THAP: { label: 'Thấp ▼', badge: 'medpro-badge-warning', row: 'bg-amber-50', text: 'text-amber-700', input: '!border-amber-500', icon: 'Warning' },
    CAO: { label: 'Cao ▲', badge: 'medpro-badge-warning', row: 'bg-amber-50', text: 'text-amber-700', input: '!border-amber-500', icon: 'Warning' },
    NGUY_HIEM: { label: 'Nguy hiểm', badge: 'medpro-badge-danger', row: 'bg-rose-50', text: 'text-rose-700', input: '!border-rose-600', icon: 'WarningCircle' },
}



export function evaluateLabValue(chiSo, rawValue) {
    const text = String(rawValue ?? '').trim().replace(',', '.')
    if (!text) return null
    if (!/^\d+(\.\d+)?$/.test(text)) return { invalid: true }
    const v = Number(text)
    const has = (x) => x !== null && x !== undefined
    if (has(chiSo.nguy_kich_thap) && v < chiSo.nguy_kich_thap) return { danh_gia: 'NGUY_HIEM', huong: 'THAP' }
    if (has(chiSo.nguy_kich_cao) && v > chiSo.nguy_kich_cao) return { danh_gia: 'NGUY_HIEM', huong: 'CAO' }
    if (has(chiSo.thap) && v < chiSo.thap) return { danh_gia: 'THAP', huong: 'THAP' }
    if (has(chiSo.cao) && v > chiSo.cao) return { danh_gia: 'CAO', huong: 'CAO' }
    return { danh_gia: 'BINH_THUONG', huong: null }
}

export const LAB_HUONG_ARROW = { THAP: '▼', CAO: '▲' }
