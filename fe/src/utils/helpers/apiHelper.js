/**
 * apiHelper.js
 * Tiện ích bóc tách và chuẩn hóa dữ liệu từ ResponseEnvelope[T] và PaginationMeta của Backend FastAPI.
 */

/**
 * Trích xuất message lỗi từ error object (Axios error, Backend response hoặc Error thông thường)
 * @param {any} error
 * @param {string} fallbackMessage
 * @returns {string}
 */
export function pickErrorMessage(error, fallbackMessage = 'Đã có lỗi xảy ra') {
    if (!error) return fallbackMessage

    // Chuỗi lỗi trực tiếp
    if (typeof error === 'string') return error

    // Lỗi từ Axios Response Envelope
    const responseData = error.response?.data
    if (responseData) {
        if (typeof responseData.message === 'string' && responseData.message.trim()) {
            return responseData.message
        }
        if (typeof responseData.detail === 'string' && responseData.detail.trim()) {
            return responseData.detail
        }
        if (Array.isArray(responseData.detail) && responseData.detail[0]?.msg) {
            return responseData.detail.map((d) => d.msg).join(', ')
        }
        if (Array.isArray(responseData.errors) && responseData.errors.length > 0) {
            const firstErr = responseData.errors[0]
            if (typeof firstErr === 'string') return firstErr
            if (firstErr?.msg) return firstErr.msg
            if (firstErr?.message) return firstErr.message
        }
    }

    // Message từ Error object
    if (error.message && typeof error.message === 'string') {
        return error.message
    }

    return fallbackMessage
}

/**
 * Bóc tách payload data từ API response envelope
 * @param {any} res
 * @returns {any}
 */
export function unwrapApi(res) {
    if (!res) return null

    // Nếu res là Axios response (res.data chứa envelope)
    const body = res.data !== undefined ? res.data : res

    if (body && typeof body === 'object') {
        // Kiểm tra envelope chuẩn
        if (body.success === false) {
            const errorMsg = body.message || 'Yêu cầu không thành công'
            const err = new Error(errorMsg)
            err.errors = body.errors
            err.code = body.code
            throw err
        }

        if (body.success === true && body.data !== undefined) {
            return body.data
        }

        if (body.data !== undefined) {
            return body.data
        }
    }

    return body
}

/**
 * Bóc tách API response có phân trang (items & meta)
 * @param {any} res
 * @param {number} defaultPageSize
 * @returns {{ items: Array<any>, meta: any, total: number }}
 */
export function unwrapPagedApi(res, defaultPageSize = 20) {
    if (!res) {
        return { items: [], meta: null, total: 0 }
    }

    const body = res.data !== undefined ? res.data : res

    if (body && typeof body === 'object') {
        if (body.success === false) {
            throw new Error(body.message || 'Yêu cầu không thành công')
        }

        const items = Array.isArray(body.data)
            ? body.data
            : Array.isArray(body.data?.items)
              ? body.data.items
              : Array.isArray(body.data?.danh_sach)
                ? body.data.danh_sach
                : []

        const rawMeta = body.meta || body.data?.meta || {}
        const meta = {
            page: Number(rawMeta.page || 1),
            page_size: Number(rawMeta.page_size || defaultPageSize),
            total_items: Number(rawMeta.total_items || items.length),
            total_pages: Number(rawMeta.total_pages || (defaultPageSize > 0 ? Math.ceil(items.length / defaultPageSize) : 1)),
            has_next: Boolean(rawMeta.has_next ?? false),
            has_prev: Boolean(rawMeta.has_prev ?? false),
        }

        return {
            items,
            meta,
            total: meta.total_items ?? items.length,
        }
    }

    if (Array.isArray(body)) {
        return {
            items: body,
            meta: null,
            total: body.length,
        }
    }

    return { items: [], meta: null, total: 0 }
}

/**
 * Bóc tách toàn diện gồm data, meta, message, code và trạng thái thành công
 * @param {any} res
 */
export function unwrapApiWithMeta(res) {
    const envelope = res?.data !== undefined ? res.data : res
    return {
        data: envelope?.data !== undefined ? envelope.data : envelope,
        meta: envelope?.meta || null,
        message: envelope?.message || '',
        code: envelope?.code || 200,
        success: envelope?.success ?? true,
        errors: envelope?.errors || null,
    }
}
