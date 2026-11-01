import { http } from '../BaseService'

const emergencyTerms = ['nôn ra máu', 'khó thở nặng', 'tím tái', 'đau ngực dữ dội', 'bất tỉnh', 'co giật', 'liệt nửa người', 'méo miệng', 'chảy máu không cầm', 'sốc phản vệ']
const plain = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')

export function getEmergencyReasons(payload) {
    const text = plain([payload.mainSymptom, ...(payload.quickSymptoms || [])].filter(Boolean).join(', '))
    const matched = emergencyTerms.filter((term) => {
        return [...text.matchAll(new RegExp(`(^|[^a-z])${plain(term)}(?=$|[^a-z])`, 'g'))].some((match) => {
            const prefix = text.slice(0, match.index).split(/[,.;!?]|\bnhung\b/).pop().trim()
            return !/(?:khong|chua|chang)(?:\s+\w+){0,3}$/.test(prefix)
        })
    })
    return [...new Set([...(payload.redFlags || []), ...matched])]
}

function specialtyId(name) {
    const value = plain(name)
    if (value.includes('tai') || value.includes('mui') || value.includes('tmh')) return 'tmh'
    if (value.includes('rang') || value.includes('rhm') || value.includes('nha')) return 'rhm'
    if (value.includes('mat')) return 'mat'
    if (value.includes('ngoai')) return 'ngoai'
    return 'noi'
}

class AiTriageService {
    async analyze(payload) {
        const emergencyReasons = getEmergencyReasons(payload)
        if (emergencyReasons.length) return { isEmergency: true, emergencyReasons, recommendations: [], source: 'SAFETY_CHECK' }
        const combinedText = [payload.mainSymptom, payload.location, ...(payload.quickSymptoms || []), ...(payload.natures || []), ...(payload.associated || []), payload.medicalContext].filter(Boolean).join(', ')
        const response = await http.post('/api/v1/ai/analyze-symptoms', { trieu_chung: combinedText, structured: payload.structured || {} })
        const data = response?.data?.data
        if (!data || typeof data.has_emergency !== 'boolean') throw new Error('Phản hồi AI không hợp lệ. Vui lòng thử lại.')
        if (data.has_emergency) return { isEmergency: true, emergencyReasons: [data.emergency_alert || 'Gọi 115 hoặc đến cơ sở cấp cứu gần nhất.'], recommendations: [], source: 'BACKEND_API' }
        const suggestions = data.suggested_specialties || []
        if (!suggestions.length) throw new Error('Chưa nhận được gợi ý chuyên khoa. Vui lòng thử lại.')
        const confidence = Math.round(Number(suggestions[0].do_tin_cay) * 100)
        return {
            isEmergency: false,
            confidence,
            needsHumanSupport: Boolean(data.default_assigned || data.needs_more_information || confidence < 60),
            recommendations: suggestions.map((item) => ({ specialtyId: specialtyId(item.ten_chuyen_khoa), specialtyName: item.ten_chuyen_khoa, reason: item.ly_do_de_xuat })),
            source: 'BACKEND_API',
        }
    }
}

export const aiTriageService = new AiTriageService()
