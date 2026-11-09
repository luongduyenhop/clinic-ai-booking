export function unwrapApi(res) {
    if (!res) return null
    const envelope = res?.data !== undefined ? res.data : res
    if (envelope && typeof envelope === 'object') {
        if (envelope.success === false) {
            const err = new Error(envelope.message || 'Yêu cầu không thành công')
            err.errors = envelope.errors
            err.code = envelope.code
            throw err
        }
        if ('data' in envelope) {
            return envelope.data
        }
    }
    return envelope
}

export function unwrapPagedApi(res, fallbackPageSize = 20) {
    if (!res) {
        return {
            items: [],
            meta: null,
            total: 0,
            page: 1,
            pageSize: fallbackPageSize,
            totalItems: 0,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
        }
    }
    const envelope = res?.data !== undefined ? res.data : res
    if (envelope && typeof envelope === 'object' && envelope.success === false) {
        throw new Error(envelope.message || 'Yêu cầu không thành công')
    }
    const rawData = envelope?.data !== undefined ? envelope.data : envelope
    const items = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.items)
          ? rawData.items
          : Array.isArray(rawData?.danh_sach)
            ? rawData.danh_sach
            : []

    const rawMeta = envelope?.meta || rawData?.meta || {}
    const page = Number(rawMeta.page ?? rawData?.page) || 1
    const pageSize = Number(rawMeta.page_size ?? rawMeta.pageSize ?? rawData?.page_size ?? rawData?.pageSize) || fallbackPageSize
    const totalItems = Number(rawMeta.total_items ?? rawMeta.totalItems ?? rawMeta.total ?? rawData?.total ?? rawData?.total_items ?? items.length)
    const totalPages = Number(rawMeta.total_pages ?? rawMeta.totalPages ?? rawData?.total_pages ?? rawData?.totalPages) || (pageSize > 0 ? Math.ceil(totalItems / pageSize) : 1)
    const hasNext = Boolean(rawMeta.has_next ?? rawMeta.hasNext ?? rawData?.has_next ?? rawData?.hasNext ?? page < totalPages)
    const hasPrev = Boolean(rawMeta.has_prev ?? rawMeta.hasPrev ?? rawData?.has_prev ?? rawData?.hasPrev ?? page > 1)

    const meta = {
        ...rawMeta,
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNext,
        hasPrev,
        page_size: pageSize,
        total_items: totalItems,
        total_pages: totalPages,
        has_next: hasNext,
        has_prev: hasPrev,
    }

    return {
        items,
        meta,
        total: totalItems,
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNext,
        hasPrev,
    }
}

export function unwrapApiWithMeta(res) {
    const envelope = res?.data !== undefined ? res.data : res
    return {
        data: envelope?.data !== undefined ? envelope.data : envelope,
        meta: envelope?.meta ?? null,
        message: envelope?.message ?? '',
        code: envelope?.code ?? 200,
        success: envelope?.success ?? true,
        errors: envelope?.errors ?? null,
    }
}

export function pickErrorMessage(error, defaultMessage = 'Đã có lỗi xảy ra') {
    if (!error) return defaultMessage
    if (typeof error === 'string') return error

    const data = error.response?.data
    if (data) {
        if (typeof data.message === 'string' && data.message.trim()) return data.message
        if (typeof data.detail === 'string' && data.detail.trim()) return data.detail
        if (Array.isArray(data.detail) && data.detail[0]?.msg) {
            return data.detail.map((d) => d.msg).join(', ')
        }
        if (Array.isArray(data.errors) && data.errors.length > 0) {
            const firstErr = data.errors[0]
            if (typeof firstErr === 'string') return firstErr
            if (firstErr?.msg) return firstErr.msg
            if (firstErr?.message) return firstErr.message
        }
    }

    return error.message || defaultMessage
}

export default {
    unwrapApi,
    unwrapPagedApi,
    unwrapApiWithMeta,
    pickErrorMessage,
}
