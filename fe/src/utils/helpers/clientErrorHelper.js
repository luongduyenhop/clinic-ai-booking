const TECHNICAL_ERROR_PATTERN = /^(network error|request failed with status code \d+|timeout of \d+ms exceeded|canceled|aborted|axioserror|err_[a-z0-9_]+|failed to fetch|load failed|unexpected token.*|json\.parse.*)$/i

const ASCII_ONLY_PATTERN = /^[a-z0-9\s.,:;!?()/_-]+$/i

export function isTechnicalErrorText(text, isAxiosError = false) {
    const trimmed = String(text || '').trim()
    if (!trimmed) return true
    if (TECHNICAL_ERROR_PATTERN.test(trimmed)) return true
    if (isAxiosError && ASCII_ONLY_PATTERN.test(trimmed)) return true
    return false
}

export function toFriendlyErrorMessage(
    error,
    fallbackMessage = 'Có lỗi xảy ra. Bạn vui lòng thử lại sau.'
) {
    if (!error) return fallbackMessage
    if (typeof error === 'string') {
        return isTechnicalErrorText(error) ? fallbackMessage : error.trim()
    }

    const data = error.response?.data
    if (data && typeof data === 'object') {
        const candidates = [data.message, data.Message, data.detail]
        for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim()) {
                return candidate.trim()
            }
        }
        if (Array.isArray(data.detail) && data.detail[0]?.msg) {
            return data.detail.map((item) => item.msg).join(', ')
        }
        if (Array.isArray(data.errors) && data.errors.length > 0) {
            const firstErr = data.errors[0]
            if (typeof firstErr === 'string' && firstErr.trim()) return firstErr.trim()
            if (firstErr?.msg) return firstErr.msg
            if (firstErr?.message && !isTechnicalErrorText(firstErr.message)) {
                return firstErr.message.trim()
            }
        }
    }

    const raw = String(error.message || '').trim()
    const isAxios = Boolean(error.isAxiosError || error.response || error.request || error.code)
    if (isTechnicalErrorText(raw, isAxios)) {
        return fallbackMessage
    }
    return raw
}
