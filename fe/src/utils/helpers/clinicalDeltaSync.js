export const IMMUTABLE_RX_STATES = new Set([
    'SIGNED',
    'ISSUED',
    'SUBMISSION_PENDING',
    'SUBMITTED',
    'ACCEPTED',
    'SUPERSEDED',
])

export const sanitizeDeltaEncounterPatch = (patch, fullEnc) => {
    if (!patch || typeof patch !== 'object') return null
    const cleaned = { ...patch }
    const rxState = String(fullEnc?.don_thuoc?.trang_thai || fullEnc?.trang_thai_don_thuoc || '').toUpperCase()
    if (IMMUTABLE_RX_STATES.has(rxState)) {
        delete cleaned.danh_sach_thuoc
        delete cleaned.don_thuoc
    }
    return Object.keys(cleaned).length > 0 ? cleaned : null
}

export const filterSyncableEncounters = (encountersMap = {}, queueList = [], fullEncountersMap = {}) => {
    const queueStatusByEncId = new Map((queueList || []).map((t) => [String(t.encounter_id), t.trang_thai]))
    const result = {}
    Object.entries(encountersMap || {}).forEach(([k, patchOrEnc]) => {
        const enc = fullEncountersMap?.[k] || fullEncountersMap?.[String(k)] || patchOrEnc
        if (!enc || enc.is_locked) return false
        const isStarted =
            Boolean(enc.luot_kham_server_id || enc.thoi_gian_bat_dau) ||
            (enc.danh_sach_chi_dinh || []).length > 0 ||
            (!String(k).startsWith('ticket-') && /^\d+$/.test(String(k)))
        const qStatus = queueStatusByEncId.get(String(k))
        const canSync = isStarted || Boolean(qStatus && qStatus !== 'cho_kham' && qStatus !== 'da_kham')
        if (!canSync) return false
        const sanitized = sanitizeDeltaEncounterPatch(patchOrEnc, enc)
        if (sanitized) {
            result[k] = sanitized
        }
        return true
    })
    return result
}
