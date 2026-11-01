export function unwrapApi(response) {
    const envelope = response?.data
    if (!envelope || envelope.success === false || !('data' in envelope)) throw new Error(envelope?.message || 'Phản hồi máy chủ không hợp lệ')
    return envelope.data
}
export function unwrapPagedApi(response) {
    const items = unwrapApi(response)
    if (!Array.isArray(items) || !response.data.meta) throw new Error('Thiếu dữ liệu phân trang')
    return { items, meta: response.data.meta }
}
export function pickErrorMessage(error) {
    const data = error?.response?.data
    if (typeof data?.message === 'string') return data.message
    if (typeof data?.detail === 'string') return data.detail
    if (Array.isArray(data?.detail)) return data.detail.map((item) => item.msg).filter(Boolean).join('; ')
    return error?.message || 'Không thể tải dữ liệu. Vui lòng thử lại.'
}
