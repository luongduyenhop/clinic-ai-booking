import { http } from '../BaseService'

const RED_FLAG_TERMS = [
    'khó thở nặng',
    'tím tái',
    'đau ngực dữ dội',
    'bóp nghẹt',
    'bất tỉnh',
    'co giật',
    'liệt',
    'méo miệng',
    'nói khó',
    'chảy máu không cầm',
    'chấn thương nghiêm trọng',
    'sốc phản vệ',
]

const SPECIALTY_RULES = [
    {
        id: 'tmh',
        terms: ['tai', 'mũi', 'họng', 'xoang', 'ù tai', 'ho', 'khàn tiếng'],
        reason: 'Triệu chứng tập trung ở vùng tai, mũi, họng hoặc đường hô hấp trên.',
    },
    {
        id: 'mat',
        terms: ['mắt', 'thị lực', 'nhìn mờ', 'đỏ mắt', 'chảy nước mắt'],
        reason: 'Triệu chứng liên quan trực tiếp đến mắt hoặc thị lực.',
    },
    {
        id: 'rhm',
        terms: ['răng', 'hàm', 'nướu', 'lợi', 'đau răng'],
        reason: 'Triệu chứng tập trung ở răng, nướu hoặc vùng hàm mặt.',
    },
    {
        id: 'ngoai',
        terms: ['vết thương', 'sưng', 'khối u', 'thoát vị', 'chấn thương', 'đau bụng khu trú'],
        reason: 'Triệu chứng có thể cần được đánh giá ngoại khoa ban đầu.',
    },
    {
        id: 'noi',
        terms: ['đau đầu', 'sốt', 'mệt', 'chóng mặt', 'buồn nôn', 'đau bụng', 'huyết áp', 'đau ngực', 'khó thở'],
        reason: 'Triệu chứng thuộc nhóm nội khoa hoặc cần sàng lọc tổng quát ban đầu.',
    },
]

function normalize(value) {
    return String(value || '').trim().toLowerCase()
}

function mapDeptToSpecialtyId(nameOrCode) {
    const t = normalize(nameOrCode)
    if (t.includes('tai') || t.includes('mũi') || t.includes('tmh')) return 'tmh'
    if (t.includes('mắt') || t.includes('nhãn') || t.includes('mat')) return 'mat'
    if (t.includes('răng') || t.includes('rhm') || t.includes('nha')) return 'rhm'
    if (t.includes('ngoại') || t.includes('ngoai')) return 'ngoai'
    return 'noi'
}

class AiTriageService {
    async analyze(payload) {
        const combinedText = [
            payload.mainSymptom,
            payload.location,
            ...(payload.quickSymptoms || []),
            ...(payload.natures || []),
            ...(payload.associated || []),
            payload.medicalContext,
            ...(payload.redFlags || []),
        ]
            .filter(Boolean)
            .join(', ')

        // 1. Ưu tiên gọi Backend API thật (Cơ chế an toàn 3 cổng trên FastAPI)
        try {
            const response = await http.post('/api/v1/ai/analyze-symptoms', {
                trieu_chung: combinedText.length >= 5 ? combinedText : `${combinedText} khám sàng lọc`.trim(),
            })
            const data = response?.data?.data
            if (data) {
                const selectedRedFlags = payload.redFlags || []
                const isEmergency = Boolean(data.is_cap_cuu || selectedRedFlags.length > 0)
                if (isEmergency) {
                    const reasons = [...selectedRedFlags]
                    if (data.canh_bao_red_flag) reasons.push(data.canh_bao_red_flag)
                    return {
                        isEmergency: true,
                        emergencyReasons: reasons.length ? reasons : ['Phát hiện triệu chứng cờ đỏ nguy kịch (Red Flag)'],
                        confidence: 100,
                        recommendations: [],
                        source: 'BACKEND_API',
                    }
                }

                const recs = (data.danh_sach_goi_y || []).map((item) => ({
                    specialtyId: mapDeptToSpecialtyId(item.ten_chuyen_khoa || item.chuyen_khoa_id),
                    reason: item.ly_do || data.loi_khuyen_y_te || 'Được hệ thống AI Triage gợi ý từ triệu chứng lâm sàng.',
                }))
                const topConfidence = recs.length && data.danh_sach_goi_y?.[0]?.do_tin_cay
                    ? Math.round(Number(data.danh_sach_goi_y[0].do_tin_cay) * (Number(data.danh_sach_goi_y[0].do_tin_cay) <= 1 ? 100 : 1))
                    : 78

                return {
                    isEmergency: false,
                    confidence: topConfidence,
                    needsHumanSupport: topConfidence < 60,
                    recommendations: recs.length
                        ? recs
                        : [{ specialtyId: 'noi', reason: data.loi_khuyen_y_te || 'Khám Nội tổng quát để sàng lọc ban đầu.' }],
                    source: 'BACKEND_API',
                }
            }
        } catch {
            // Fallback sang bộ quy tắc 3 cổng tại Client khi chạy chế độ Demo độc lập
        }

        // 2. Fallback: Bộ quy tắc an toàn 3 cổng (Gate 1: Red Flags -> Gate 2: Confidence -> Gate 3: Routing)
        const combined = normalize(combinedText)
        const keywordRedFlags = RED_FLAG_TERMS.filter((term) => combined.includes(term))
        const selectedRedFlags = payload.redFlags || []
        if (keywordRedFlags.length || selectedRedFlags.length) {
            return {
                isEmergency: true,
                emergencyReasons: [...selectedRedFlags, ...keywordRedFlags],
                confidence: 100,
                recommendations: [],
                source: 'CLIENT_RULE_ENGINE',
            }
        }

        const scored = SPECIALTY_RULES.map((rule) => ({
            ...rule,
            score: rule.terms.filter((term) => combined.includes(term)).length,
        }))
            .filter((rule) => rule.score > 0)
            .sort((a, b) => b.score - a.score)

        const inputSignals = [
            payload.mainSymptom,
            payload.location,
            payload.onset,
            payload.severity,
            ...(payload.quickSymptoms || []),
            ...(payload.natures || []),
            ...(payload.associated || []),
        ].filter(Boolean).length

        const confidence = scored.length
            ? Math.min(92, 48 + scored[0].score * 13 + Math.min(inputSignals, 5) * 3)
            : Math.min(58, 30 + inputSignals * 4)

        if (!scored.length || confidence < 60) {
            return {
                isEmergency: false,
                confidence,
                needsHumanSupport: true,
                recommendations: [
                    {
                        specialtyId: 'noi',
                        reason: 'Thông tin hiện tại chưa đủ rõ. Nội tổng quát phù hợp để sàng lọc ban đầu và điều phối tiếp nếu cần.',
                    },
                ],
                source: 'CLIENT_RULE_ENGINE',
            }
        }

        return {
            isEmergency: false,
            confidence,
            needsHumanSupport: false,
            recommendations: scored.slice(0, 2).map(({ id, reason }) => ({ specialtyId: id, reason })),
            source: 'CLIENT_RULE_ENGINE',
        }
    }
}

export const aiTriageService = new AiTriageService()
