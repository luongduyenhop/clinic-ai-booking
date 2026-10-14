const RED_FLAG_TERMS = ['khó thở nặng', 'tím tái', 'đau ngực dữ dội', 'bóp nghẹt', 'bất tỉnh', 'co giật', 'liệt', 'méo miệng', 'nói khó', 'chảy máu không cầm', 'chấn thương nghiêm trọng', 'sốc phản vệ']

const SPECIALTY_RULES = [
    { id: 'tmh', terms: ['tai', 'mũi', 'họng', 'xoang', 'ù tai', 'ho', 'khàn tiếng'], reason: 'Triệu chứng tập trung ở vùng tai, mũi, họng hoặc đường hô hấp trên.' },
    { id: 'mat', terms: ['mắt', 'thị lực', 'nhìn mờ', 'đỏ mắt', 'chảy nước mắt'], reason: 'Triệu chứng liên quan trực tiếp đến mắt hoặc thị lực.' },
    { id: 'rhm', terms: ['răng', 'hàm', 'nướu', 'lợi', 'đau răng'], reason: 'Triệu chứng tập trung ở răng, nướu hoặc vùng hàm mặt.' },
    { id: 'ngoai', terms: ['vết thương', 'sưng', 'khối u', 'thoát vị', 'chấn thương', 'đau bụng khu trú'], reason: 'Triệu chứng có thể cần được đánh giá ngoại khoa ban đầu.' },
    { id: 'noi', terms: ['đau đầu', 'sốt', 'mệt', 'chóng mặt', 'buồn nôn', 'đau bụng', 'huyết áp', 'đau ngực', 'khó thở'], reason: 'Triệu chứng thuộc nhóm nội khoa hoặc cần sàng lọc tổng quát ban đầu.' },
]

function normalize(value) { return String(value || '').trim().toLowerCase() }
function wait(ms = 320) { return new Promise((resolve) => window.setTimeout(resolve, ms)) }

class AiTriageService {
    async analyze(payload) {
        await wait()
        const combined = normalize([payload.mainSymptom, payload.location, ...(payload.quickSymptoms || []), ...(payload.natures || []), ...(payload.associated || []), payload.medicalContext].join(' '))
        const keywordRedFlags = RED_FLAG_TERMS.filter((term) => combined.includes(term))
        const selectedRedFlags = payload.redFlags || []
        if (keywordRedFlags.length || selectedRedFlags.length) {
            return { isEmergency: true, emergencyReasons: [...selectedRedFlags, ...keywordRedFlags], confidence: 100, recommendations: [] }
        }

        const scored = SPECIALTY_RULES.map((rule) => ({ ...rule, score: rule.terms.filter((term) => combined.includes(term)).length })).filter((rule) => rule.score > 0).sort((a, b) => b.score - a.score)
        const inputSignals = [payload.mainSymptom, payload.location, payload.onset, payload.severity, ...(payload.quickSymptoms || []), ...(payload.natures || []), ...(payload.associated || [])].filter(Boolean).length
        const confidence = scored.length ? Math.min(92, 48 + scored[0].score * 13 + Math.min(inputSignals, 5) * 3) : Math.min(58, 30 + inputSignals * 4)

        if (!scored.length || confidence < 60) {
            return { isEmergency: false, confidence, needsHumanSupport: true, recommendations: [{ specialtyId: 'noi', reason: 'Thông tin hiện tại chưa đủ rõ. Nội tổng quát phù hợp để sàng lọc ban đầu và điều phối tiếp nếu cần.' }] }
        }

        return { isEmergency: false, confidence, needsHumanSupport: false, recommendations: scored.slice(0, 2).map(({ id, reason }) => ({ specialtyId: id, reason })) }
    }
}

export const aiTriageService = new AiTriageService()
