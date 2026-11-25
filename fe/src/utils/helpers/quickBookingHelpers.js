import { formatUnifiedDoctorName, stripDemoTag } from './doctorNameHelper.js'

export function getTodayIsoDate(now = new Date()) {
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function getOffsetIsoDate(offsetDays = 0, now = new Date()) {
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays)
    return getTodayIsoDate(target)
}

export function getDefaultScheduleDate(now = new Date()) {
    return now.getHours() >= 16 ? getOffsetIsoDate(1, now) : getTodayIsoDate(now)
}

export function isValidFutureOrTodayIsoDate(value, todayIso = getTodayIsoDate()) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false
    }
    const [year, month, day] = value.split('-').map(Number)
    const parsed = new Date(year, month - 1, day)
    if (
        parsed.getFullYear() !== year ||
        parsed.getMonth() !== month - 1 ||
        parsed.getDate() !== day
    ) {
        return false
    }
    return value >= todayIso
}

export function formatConsultFee(amount) {
    const numeric = Number(amount)
    if (!Number.isFinite(numeric) || numeric <= 0) return 'Theo niêm yết'
    return `${new Intl.NumberFormat('vi-VN').format(numeric)}đ`
}

export function formatSpecialtyFeeRange(doctorsForSpecialty = [], fallbackFee = 0) {
    const fees = (Array.isArray(doctorsForSpecialty) ? doctorsForSpecialty : [])
        .map((item) => Number(item?.fee ?? item?.gia_kham_mac_dinh ?? 0))
        .filter((value) => Number.isFinite(value) && value > 0)
    if (!fees.length) {
        return formatConsultFee(fallbackFee)
    }
    const minFee = Math.min(...fees)
    const maxFee = Math.max(...fees)
    if (minFee === maxFee) {
        return formatConsultFee(minFee)
    }
    return `${formatConsultFee(minFee)} – ${formatConsultFee(maxFee)}`
}

export function formatVietnameseDateLabel(isoDate) {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return ''
    const [year, month, day] = isoDate.split('-').map(Number)
    const parsed = new Date(year, month - 1, day)
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
        return ''
    }
    const weekdays = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
    return `${weekdays[parsed.getDay()]}, ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
}

export function isAutomatedTestDoctorRecord(item = {}) {
    const rawName = String(item.ho_ten || item.name || '').trim()
    const hasSpecialty = Boolean(item.chuyen_khoa_id || item.specialtyId)
    if (/^test\s+bs_[a-z0-9_]+/i.test(rawName) && !hasSpecialty) return true
    return /^bs\.?\s+demo\b/i.test(rawName)
}

export function isAutomatedTestSpecialtyRecord(item = {}) {
    const code = String(item.ma_chuyen_khoa || item.code || '').trim()
    const name = String(item.ten_chuyen_khoa || item.name || '').trim()
    return /^DEMO_/i.test(code) || /\(demo\)/i.test(name)
}

export function formatPublicDoctorName(rawName = '') {
    const cleaned = stripDemoTag(rawName)
    if (!cleaned) return 'Bác sĩ Chuyên khoa'
    return cleaned
}

export function formatDoctorHeading(doctor = {}) {
    return formatUnifiedDoctorName(doctor.name, doctor.degree)
}

const SPECIALTY_CLINICAL_TABLE = [
    {
        keys: ['khoa_noi', 'nội tổng quát', 'nội khoa', 'nội'],
        fee: 150000,
        services: 'Khám nội tổng quát, đo điện tim ECG, siêu âm ổ bụng và theo dõi bệnh mạn tính',
        floor: 'Phòng 101 – Tầng 1',
    },
    {
        keys: ['khoa_ngoai', 'ngoại tổng quát', 'ngoại khoa', 'ngoại'],
        fee: 200000,
        services: 'Khám ngoại tổng quát, xử trí vết thương, cắt chỉ và tiểu phẫu vô trùng',
        floor: 'Phòng 201 – Tầng 2',
    },
    {
        keys: ['khoa_tmh', 'tai mũi họng', 'tai mui hong', 'tmh'],
        fee: 220000,
        services: 'Nội soi Tai Mũi Họng ống mềm, lấy dị vật, hút rửa mũi xoang và khí dung',
        floor: 'Phòng 205 – Tầng 2',
    },
    {
        keys: ['khoa_rang', 'răng hàm mặt', 'rang ham mat', 'nha khoa', 'răng'],
        fee: 180000,
        services: 'Khám nha tổng quát, cạo vôi siêu âm, hàn răng thẩm mỹ và nhổ răng khôn',
        floor: 'Phòng 301 – Tầng 3',
    },
    {
        keys: ['khoa_mat', 'nhãn khoa', 'nhan khoa', 'mắt'],
        fee: 160000,
        services: 'Đo thị lực – khúc xạ tự động, soi đáy mắt và tầm soát đục thủy tinh thể',
        floor: 'Phòng 305 – Tầng 3',
    },
]

export function getSpecialtyClinicalMetadata(codeOrName = '') {
    const normalized = String(codeOrName || '').trim().toLowerCase()
    if (normalized) {
        const matched = SPECIALTY_CLINICAL_TABLE.find((entry) =>
            entry.keys.some((key) => normalized === key || normalized.includes(key))
        )
        if (matched) {
            return {
                fee: matched.fee,
                services: matched.services,
                floor: matched.floor,
            }
        }
    }
    return {
        fee: 150000,
        services: 'Khám và tư vấn chuyên khoa ngoại trú',
        floor: 'Khu Khám Ngoại Trú',
    }
}

export function buildQuickBookingPath({
    specialtyId = '',
    doctorId = '',
    appointmentDate = '',
    timeSlot = '',
    doctors = [],
} = {}) {
    const selectedDoctor = doctorId ? doctors.find((doc) => doc.id === doctorId) : null
    const resolvedSpecialtyId = specialtyId || selectedDoctor?.specialtyId || ''
    const params = new URLSearchParams()
    if (resolvedSpecialtyId) params.set('specialty', resolvedSpecialtyId)
    if (doctorId) params.set('doctor', doctorId)
    if (appointmentDate) params.set('date', appointmentDate)
    if (timeSlot) params.set('slot', timeSlot)
    const query = params.toString()
    return query ? `/dat-lich?${query}` : '/dat-lich'
}

export function resolveBookingPrefill({
    specialties = [],
    doctors = [],
    requestedSpecialty = '',
    requestedDoctor = '',
    requestedDate = '',
    requestedSlot = '',
    todayIso = getTodayIsoDate(),
} = {}) {
    const specialty = specialties.find((item) => item.id === requestedSpecialty) || null
    const doctor =
        doctors.find(
            (item) =>
                item.id === requestedDoctor &&
                (!specialty || item.specialtyId === specialty.id)
        ) || null
    const resolvedSpecialtyId = specialty?.id || doctor?.specialtyId || ''
    const validDate = isValidFutureOrTodayIsoDate(requestedDate, todayIso) ? requestedDate : ''
    const hasDoctorAndDate = Boolean(doctor && validDate)
    const hasSuggestedSlot = Boolean(hasDoctorAndDate && requestedSlot)

    return {
        booking: {
            specialtyId: resolvedSpecialtyId,
            doctorId: doctor?.id || '',
            appointmentDate: validDate,
            timeSlot: hasSuggestedSlot ? requestedSlot : '',
        },
        initialStep: hasDoctorAndDate ? 2 : 1,
    }
}
