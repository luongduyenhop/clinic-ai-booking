export const normalizeCode = (val) => {
    if (!val) return ''
    let s = String(val).trim().toUpperCase()
    while (s.startsWith('HD-HD-')) {
        s = s.slice(3)
    }
    return s
}

export const canonicalCode = (val) => {
    let s = normalizeCode(val)
    while (s.startsWith('HD-')) {
        s = s.slice(3)
    }
    return s
}

const extractEncounterId = (v) => {
    if (!v) return ''
    if (v.luotKhamId !== undefined && v.luotKhamId !== null && String(v.luotKhamId).trim() !== '') {
        return String(v.luotKhamId).trim()
    }
    const kcb = String(v.maKCB || '').trim()
    const m = /^KCB-(\d+)$/i.exec(kcb)
    return m ? m[1] : ''
}

export const areVouchersMatching = (a, b) => {
    if (!a || !b) return false
    const aId = a.id !== undefined && a.id !== null ? String(a.id).trim() : ''
    const bId = b.id !== undefined && b.id !== null ? String(b.id).trim() : ''
    const aInvId = a.invoiceId !== undefined && a.invoiceId !== null ? String(a.invoiceId).trim() : ''
    const bInvId = b.invoiceId !== undefined && b.invoiceId !== null ? String(b.invoiceId).trim() : ''
    const aCode = normalizeCode(a.maPhieu || a.ma_hoa_don)
    const bCode = normalizeCode(b.maPhieu || b.ma_hoa_don)
    const aCanon = canonicalCode(a.maPhieu || a.ma_hoa_don)
    const bCanon = canonicalCode(b.maPhieu || b.ma_hoa_don)
    const isPlaceholder = (c) => c === 'DỰ KIẾN LẬP HÓA ĐƠN'

    if (aCode && bCode && !isPlaceholder(aCode) && !isPlaceholder(bCode)) {
        if (aCode === bCode || (aCanon && bCanon && aCanon === bCanon)) {
            return true
        }
    }
    if (aInvId && bInvId && aInvId === bInvId) {
        return true
    }
    if (aId && bId && aId === bId) {
        return true
    }
    if (aInvId && bId && aInvId === bId) {
        return true
    }
    if (aId && bInvId && aId === bInvId) {
        return true
    }

    const aLk = extractEncounterId(a)
    const bLk = extractEncounterId(b)
    if (aLk && bLk && aLk === bLk && !a.daThu && !b.daThu) {
        if (!aInvId || !bInvId || aInvId === bInvId || isPlaceholder(aCode) || isPlaceholder(bCode)) {
            return true
        }
    }

    return false
}

export const mergeVoucherData = (existing, incoming) => {
    const hasIncomingItems = Array.isArray(incoming.items) && incoming.items.length > 0
    const hasExistingItems = Array.isArray(existing.items) && existing.items.length > 0
    const preferIncomingItems = hasIncomingItems && (!hasExistingItems || incoming.items.length >= existing.items.length)
    const validCodes = [
        incoming.maPhieu,
        incoming.ma_hoa_don,
        existing.maPhieu,
        existing.ma_hoa_don,
    ].filter((c) => Boolean(c) && c !== 'DỰ KIẾN LẬP HÓA ĐƠN')
    const uppercaseCode = validCodes.find((c) => c === c.toUpperCase() && /[A-Z]/.test(c))
    const resolvedCode = uppercaseCode || validCodes[0] || incoming.maPhieu || existing.maPhieu || ''
    return {
        ...existing,
        ...incoming,
        id: incoming.id || existing.id,
        invoiceId: incoming.invoiceId || existing.invoiceId,
        luotKhamId: incoming.luotKhamId ?? existing.luotKhamId,
        maKCB: incoming.maKCB || existing.maKCB,
        maPhieu: resolvedCode,
        ngayThu: incoming.ngayThu || existing.ngayThu,
        daThu: Boolean(incoming.daThu || existing.daThu),
        tongTien: Number(incoming.tongTien || existing.tongTien || 0),
        items: preferIncomingItems ? incoming.items : (hasExistingItems ? existing.items : (incoming.items || [])),
    }
}

export const deduplicateVouchers = (list) => {
    if (!Array.isArray(list)) return []
    const result = []
    for (const v of list) {
        if (!v) continue
        const idx = result.findIndex((item) => areVouchersMatching(item, v))
        if (idx >= 0) {
            result[idx] = mergeVoucherData(result[idx], v)
        } else {
            result.push({ ...v })
        }
    }
    return result
}

export const groupVouchersByPatient = (vouchersList) => {
    const map = new Map()
    const nameToKey = new Map()
    const cleanList = deduplicateVouchers(vouchersList)
    cleanList.forEach((v) => {
        const normMa = v.maBN ? v.maBN.trim().toUpperCase() : ''
        const normName = v.hoTenBN ? v.hoTenBN.trim().toLowerCase() : ''
        let rawKey = normMa || normName || 'khach_vang_lai'
        if (!map.has(rawKey) && normName && nameToKey.has(normName) && (!normMa || !map.get(nameToKey.get(normName))?.maBN)) {
            rawKey = nameToKey.get(normName)
        }
        if (!map.has(rawKey)) {
            map.set(rawKey, {
                key: rawKey,
                maBN: v.maBN || '',
                hoTenBN: v.hoTenBN || 'Chưa rõ họ tên',
                soDienThoai: v.soDienThoai || '',
                vouchers: [],
                totalAmount: 0,
                unpaidCount: 0,
                paidCount: 0,
            })
            if (normName && !nameToKey.has(normName)) {
                nameToKey.set(normName, rawKey)
            }
        }
        const group = map.get(rawKey)
        if (!group.maBN && v.maBN) group.maBN = v.maBN
        if (!group.soDienThoai && v.soDienThoai) group.soDienThoai = v.soDienThoai
        const existsInGroup = group.vouchers.some((item) => areVouchersMatching(item, v))
        if (!existsInGroup) {
            group.vouchers.push(v)
            group.totalAmount += Number(v.tongTien) || 0
            if (v.daThu) {
                group.paidCount += 1
            } else {
                group.unpaidCount += 1
            }
        }
    })
    return Array.from(map.values())
}
