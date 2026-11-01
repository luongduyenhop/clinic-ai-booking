/**
 * API Helper chuẩn hóa giao tiếp mạng và bóc tách ResponseEnvelope của FastAPI Backend
 * Tuân thủ Mô hình Kiến trúc 7 Tầng (Tầng 5: API Helper)
 */

/**
 * Mở gói ResponseEnvelope[T] chuẩn từ Backend FastAPI
 * Cấu trúc trả về chuẩn: { code: 200, message: "...", data: T }
 */
export const unwrapApi = (response) => {
    if (!response) return null
    return response.data?.data !== undefined ? response.data.data : response.data
}

/**
 * Mở gói danh sách phân trang chuẩn từ Backend FastAPI
 * Cấu trúc trả về chuẩn: { items: [...], total: 100, page: 1, page_size: 20 }
 */
export const unwrapPagedApi = (response) => {
    const data = unwrapApi(response)
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.items)) return data.items
    return []
}

/**
 * Mở gói API giữ lại metadata (total, page, page_size...)
 */
export const unwrapApiWithMeta = (response) => {
    if (!response) return { data: null, meta: {} }
    const root = response.data || {}
    const inner = root.data !== undefined ? root.data : root
    const meta = {
        total: root.total ?? inner?.total ?? 0,
        page: root.page ?? inner?.page ?? 1,
        page_size: root.page_size ?? inner?.page_size ?? 20,
        message: root.message || '',
    }
    return { data: inner, meta }
}

/**
 * Bóc tách và chuẩn hóa thông báo lỗi từ Axios Error Response
 */
export const pickErrorMessage = (error) => {
    if (!error) return 'Đã có lỗi xảy ra'
    if (typeof error === 'string') return error

    return (
        error.response?.data?.message ||
        error.response?.data?.detail ||
        error.response?.data?.error ||
        error.message ||
        'Đã có lỗi xảy ra trong quá trình xử lý'
    )
}

export default {
    unwrapApi,
    unwrapPagedApi,
    unwrapApiWithMeta,
    pickErrorMessage,
}
