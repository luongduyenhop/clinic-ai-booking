/**
 * apiHelper.js
 * Tiện ích bóc tách và chuẩn hóa dữ liệu từ ResponseEnvelope[T] và PaginationMeta của Backend FastAPI.
 * Cấu trúc ResponseEnvelope chuẩn hóa:
 * {
 *   success: boolean,
 *   code: number,
 *   message: string,
 *   data: T,
 *   meta?: {
 *     page: number,
 *     page_size: number,
 *     total_items: number,
 *     total_pages: number,
 *     has_next: boolean,
 *     has_prev: boolean
 *   },
 *   errors?: Array<object>
 * }
 */

/**
 * Bóc tách trường `data` từ ResponseEnvelope[T] của Backend FastAPI
 * @param {any} res - AxiosResponse hoặc ResponseEnvelope object
 * @returns {any} Dữ liệu trong trường `data` (hoặc toàn bộ nếu không bọc envelope)
 */
export function unwrapApi(res) {
    if (!res) return null
    const envelope = res?.data ?? res
    if (envelope && typeof envelope === 'object' && 'data' in envelope && 'success' in envelope) {
        return envelope.data
    }
    return envelope
}

/**
 * Bóc tách API trả về có phân trang (PaginationMeta)
 * @param {any} res - AxiosResponse hoặc ResponseEnvelope object
 * @param {number} fallbackPageSize - Kích thước trang mặc định nếu thiếu
 * @returns {{
 *   items: Array<any>,
 *   meta: object,
 *   page: number,
 *   pageSize: number,
 *   totalItems: number,
 *   totalPages: number,
 *   hasNext: boolean,
 *   hasPrev: boolean
 * }}
 */
export function unwrapPagedApi(res, fallbackPageSize = 20) {
    const envelope = res?.data ?? res
    const rawData = envelope?.data ?? envelope

    // Hỗ trợ trường hợp data là array hoặc object chứa items/danh_sach
    const items = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.items)
          ? rawData.items
          : Array.isArray(rawData?.danh_sach)
            ? rawData.danh_sach
            : []

    const rawMeta = envelope?.meta || rawData?.meta || {}
    const page = Number(rawMeta.page) || 1
    const pageSize = Number(rawMeta.page_size) || fallbackPageSize
    const totalItems = Number(rawMeta.total_items) || items.length
    const totalPages = Number(rawMeta.total_pages) || (pageSize > 0 ? Math.ceil(totalItems / pageSize) : 1)
    const hasNext = Boolean(rawMeta.has_next ?? page < totalPages)
    const hasPrev = Boolean(rawMeta.has_prev ?? page > 1)

    return {
        items,
        meta: {
            page,
            pageSize,
            totalItems,
            totalPages,
            hasNext,
            hasPrev,
        },
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNext,
        hasPrev,
    }
}

/**
 * Bóc tách toàn diện gồm data, meta, message, code và trạng thái thành công
 * @param {any} res
 */
export function unwrapApiWithMeta(res) {
    const envelope = res?.data ?? res
    return {
        data: envelope?.data ?? envelope,
        meta: envelope?.meta ?? null,
        message: envelope?.message ?? '',
        code: envelope?.code ?? 200,
        success: envelope?.success ?? true,
        errors: envelope?.errors ?? null,
    }
}

/**
 * Trích xuất câu thông báo lỗi chính xác từ Backend (ResponseEnvelope hoặc FastAPI HTTPException)
 * @param {any} error
 * @param {string} defaultMessage
 * @returns {string}
 */
export function pickErrorMessage(error, defaultMessage = 'Đã có lỗi xảy ra') {
    if (!error) return defaultMessage
    if (typeof error === 'string') return error

    // FastAPI ResponseEnvelope error hoặc ValidationError
    const data = error.response?.data
    if (data?.message) return data.message
    if (typeof data?.detail === 'string') return data.detail
    if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
        return data.detail.map((d) => d.msg).join(', ')
    }
    if (Array.isArray(data?.errors) && data.errors[0]?.message) {
        return data.errors.map((e) => e.message).join(', ')
    }

    return error.message || defaultMessage
}

