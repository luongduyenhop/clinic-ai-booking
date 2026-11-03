/**
 * Chuẩn hóa tên Bác sĩ, loại bỏ việc lặp prefix danh xưng (BS., ThS., TS., PGS., GS., CKI, CKII...)
 * @param {string} name - Tên bác sĩ hoặc họ tên đầy đủ
 * @param {string} [title] - Học vị / học hàm bổ trợ (nếu có)
 * @returns {string} Tên bác sĩ đã chuẩn hóa
 */
export const formatDoctorName = (name, title = '') => {
    if (!name) return ''
    let cleanName = String(name).trim()
    if (!cleanName) return ''

    // Loại bỏ các tiền tố trùng lặp liên tiếp (ví dụ: "BS. BS.CKII", "BS. PGS.TS", "BS. BS.")
    cleanName = cleanName.replace(/^(BS\.?\s*)+(?=BS\.?|ThS\.?|TS\.?|PGS\.?|GS\.?)/i, '')
    // Loại bỏ các cụm học hàm/học vị lặp lại chính nó (ví dụ: "PGS.TS PGS.TS", "BS.CKII BS.CKII", "BS. CKII BS. CKII")
    cleanName = cleanName.replace(/^(PGS\.TS|ThS\.BS|BS\.CKII|BS\.CKI|BS\.\s*CKII|BS\.\s*CKI|BS|ThS|TS|PGS|GS)\s+\1\b/i, '$1')

    // Kiểm tra xem tên đã có sẵn tiền tố học vị / chức danh y tế chưa
    const hasMedicalPrefix = /^(BS\.?|ThS\.?|TS\.?|PGS\.?|GS\.?|CKI|CKII|Bác sĩ)\b/i.test(cleanName)
    if (hasMedicalPrefix) {
        return cleanName
    }

    const cleanTitle = String(title || '').trim()
    if (cleanTitle) {
        return `${cleanTitle} ${cleanName}`
    }

    return `BS. ${cleanName}`
}

