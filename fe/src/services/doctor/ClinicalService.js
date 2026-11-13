import { BaseServices } from '../BaseService'
import { clinicalEventBridge, CLINICAL_EVENTS } from '../clinicalEventBridge'
import { AppToast } from '../../components/common/AppNotification'
import { pickErrorMessage } from '../../utils/helpers/apiHelper'


export const USE_MOCK = false
const loadInitialDb = () => {
    return {
        encounters: {},
        queue: [],
        extraOrders: [],
        nextId: 9500,
    }
}

const db = loadInitialDb()

const delay = (value, ms = 180) =>
    new Promise((resolve) => setTimeout(() => resolve({ data: structuredClone(value) }), ms))

const reject = (message, ms = 180) =>
    new Promise((_, rejectFn) => setTimeout(() => rejectFn({ message }), ms))

const getEncounterOrThrow = (id) => {
    const enc = db.encounters[id] || db.encounters[String(id)]
    if (!enc) throw { message: 'Không tìm thấy lượt khám' }
    return enc
}

const ticketToQueueItem = (t) => {
    const enc = t.encounter_id ? (db.encounters[t.encounter_id] || db.encounters[String(t.encounter_id)]) : null
    const bn = enc ? enc.benh_nhan : t.benh_nhan
    let trangThai = t.trang_thai
    let ghiChu = t.ghi_chu

    if (enc) {
        if (enc.is_locked) {
            trangThai = 'da_kham'
            ghiChu = 'Đã khám xong'
        } else {
            const activeOrders = (enc.danh_sach_chi_dinh || []).filter((o) => o.trang_thai !== 'da_huy')
            const pendingOrders = activeOrders.filter((o) => !['da_co_ket_qua', 'da_duyet'].includes(o.trang_thai))
            if (activeOrders.length > 0 && pendingOrders.length === 0) {
                trangThai = 'co_ket_qua_cls'
                if (!ghiChu || !ghiChu.includes('CÓ KQ CLS')) {
                    ghiChu = '⭐ CÓ KQ CLS: Đã có kết quả'
                }
            } else if (pendingOrders.length > 0 || trangThai === 'tam_hoan') {
                trangThai = 'tam_hoan'
                ghiChu = ghiChu || 'Chờ kết quả Cận lâm sàng'
            }
        }
    }

    return {
        ...t,
        trang_thai: trangThai,
        ghi_chu: ghiChu,
        ten_benh_nhan: bn?.ho_ten || t.ten_benh_nhan,
        gioi_tinh: bn?.gioi_tinh || t.gioi_tinh,
        tuoi: bn?.tuoi || t.tuoi,
        ly_do: enc?.ai_triage?.trieu_chung_nhap || t.ly_do || '',
    }
}



const findMirrorOrder = (serverOrderId, luotKhamServerId, dichVuId) => {
    if (serverOrderId === null || serverOrderId === undefined) {
        if (!luotKhamServerId || !dichVuId) return null
    }
    for (const enc of Object.values(db.encounters || {})) {
        const o = (enc.danh_sach_chi_dinh || []).find(
            (x) =>
                (serverOrderId !== null &&
                    serverOrderId !== undefined &&
                    (String(x.server_order_id) === String(serverOrderId) || Number(x.server_order_id) === Number(serverOrderId))) ||
                (luotKhamServerId &&
                    dichVuId &&
                    String(enc.luot_kham_server_id) === String(luotKhamServerId) &&
                    String(x.dich_vu_id) === String(dichVuId))
        )
        if (o) {
            if (serverOrderId && !o.server_order_id) {
                o.server_order_id = Number(serverOrderId)
            }
            return { enc, order: o }
        }
    }
    return null
}

const diagnosisText = (enc) => {
    const list = enc.danh_sach_chan_doan || []
    const ordered = [...list.filter((d) => d.loai_chan_doan === 'chinh'), ...list.filter((d) => d.loai_chan_doan !== 'chinh')]
    const text = ordered.map((d) => [d.ma_icd10, d.ten_benh_chan_doan].filter(Boolean).join(' - ')).join('; ')
    return text ? text.slice(0, 255) : null
}

const parseResultDetail = (item) => {
    if (item.tri_so_chi_tiet && Object.keys(item.tri_so_chi_tiet).length > 0) return item.tri_so_chi_tiet
    try {
        const parsed = JSON.parse(item.ket_qua_chi_tiet)
        return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
        return null
    }
}

const toWorklistItem = (item) => {
    const bn = item.benh_nhan || {}
    const hasResult = item.trang_thai === 'da_co_ket_qua'
    return {
        id: item.id,
        luot_kham_id: item.luot_kham_id,
        dich_vu_id: item.dich_vu?.id,
        ma_dich_vu: item.dich_vu?.ma_dich_vu,
        ten_dich_vu: item.ten_dich_vu,
        nhom_dich_vu: item.nhom_dich_vu,
        trang_thai: item.trang_thai,
        thoi_gian_chi_dinh: item.thoi_gian_chi_dinh,
        thoi_gian_cho_phut: item.thoi_gian_cho_phut,
        benh_nhan: {
            ma: bn.mabn,
            ho_ten: bn.ho_ten,
            gioi_tinh: bn.gioi_tinh,
            tuoi: bn.nam_sinh ? new Date().getFullYear() - bn.nam_sinh : null,
            so_dien_thoai: bn.so_dien_thoai,
            di_ung_thuoc: bn.di_ung_thuoc,
        },
        ly_do: item.ly_do_vao_kham,
        chan_doan_so_bo: item.chan_doan_so_bo,
        bac_si_chi_dinh: item.bac_si_chi_dinh || 'Bác sĩ',
        ket_qua_chi_tiet: hasResult ? parseResultDetail(item) : null,
        ket_qua_phan_loai: hasResult ? item.ket_qua_phan_loai : null,
        tep_dinh_kem_url: item.file_dinh_kem_urls?.[0] || null,
        trang_thai_ket_qua: item.trang_thai_ket_qua || null,
        thoi_gian_duyet: item.thoi_gian_duyet || null,
    }
}

const sameInstant = (a, b) => Boolean(a && b) && Date.parse(a) === Date.parse(b)


const toMirrorPatch = (r) => ({
    trang_thai: r.trang_thai,
    ket_qua_phan_loai: r.ket_qua_phan_loai,
    ket_qua_chi_tiet: r.ket_qua_chi_tiet,
    tep_dinh_kem_url: r.tep_dinh_kem_urls?.[0] || null,
    tep_dinh_kem_urls: r.tep_dinh_kem_urls || [],
    thoi_gian_tra_ket_qua: r.thoi_gian_tra_ket_qua,
    thoi_gian_duyet: r.thoi_gian_duyet,
    nguoi_duyet: r.nguoi_duyet,
})



const applyReturnedResult = (mirror, patch) => {
    Object.assign(mirror.order, patch)
    const ticket = db.queue.find((t) => t.encounter_id === mirror.enc.id)
    if (ticket && ticket.trang_thai !== 'dang_kham') {
        ticket.trang_thai = 'co_ket_qua_cls'
        ticket.muc_do_uu_tien = 0
        ticket.ghi_chu = `${patch.ket_qua_phan_loai === 'NGUY_KICH' ? '🚨 KQ CLS NGUY KỊCH' : '⭐ CÓ KQ CLS'}: ${mirror.order.ten_dich_vu}`
    }
}

export class ClinicalService extends BaseServices {
    _hydratedFromPg = false
    _returnedSince = null
    _returnedPollOff = false
    _returnedPolling = null

    constructor() {
        super()
    }

    hydrateFromPostgres = async (force = false) => {
        if (this._hydratedFromPg && !force) return
        try {
            const res = await this.get('/api/v1/clinical/workspace-state', {
                params: { _t: Date.now() },
                __skipGlobalLoading: true,
            })
            const remote = res?.data?.data
            if (res?.data?.success === false || !remote || !remote.encounters || typeof remote.encounters !== 'object' || Array.isArray(remote.encounters) || !Array.isArray(remote.queue)) {
                throw new Error('Máy chủ trả về trạng thái bàn khám không hợp lệ.')
            }
            db.encounters = remote.encounters
            db.queue = remote.queue
            db.extraOrders = Array.isArray(remote.extraOrders) ? remote.extraOrders : []
            db.nextId = Number(remote.nextId) || db.nextId
            this._hydratedFromPg = true
        } catch (e) {
            this._hydratedFromPg = false
            throw new Error(pickErrorMessage(e, 'Không thể tải trạng thái bàn khám từ máy chủ.'))
        }
    }

    persistToPostgres = async () => {
        const res = await this.put('/api/v1/clinical/workspace-state', db, { __skipGlobalLoading: true })
        if (res?.data?.success === false || res?.data?.data?.saved !== true) {
            throw new Error(res?.data?.message || 'Máy chủ chưa xác nhận lưu dữ liệu lâm sàng.')
        }
        return res.data.data
    }

    reloadFromPostgres = async () => {
        this._hydratedFromPg = false
        await this.hydrateFromPostgres()
    }

    syncOrdersToServer = async (enc, dichVuIds, services) => {
        const bn = enc.benh_nhan || {}
        if (!bn.ho_ten?.trim()) throw new Error('Thiếu tên bệnh nhân từ hồ sơ máy chủ; chưa gửi được chỉ định.')
        const tuoi = Number.parseInt(bn.tuoi, 10)
        try {
            const res = await this.post(
                '/api/v1/subclinical/workspace-orders',
                {
                    workspace_encounter_id: String(enc.id),
                    benh_nhan: {
                        ma: bn.ma || null,
                        ho_ten: bn.ho_ten,
                        gioi_tinh: bn.gioi_tinh || null,
                        tuoi: Number.isNaN(tuoi) ? null : tuoi,
                        di_ung_thuoc: bn.di_ung_thuoc || null,
                    },
                    ly_do_vao_kham: enc.ly_do_vao_kham || enc.ai_triage?.trieu_chung_nhap || null,
                    chan_doan_so_bo: diagnosisText(enc),
                    dich_vu_ids: dichVuIds,
                },
                { __skipGlobalLoading: true }
            )
            const result = res?.data?.data
            const returnedOrders = result?.orders
            if (!result?.luot_kham_id || !Array.isArray(returnedOrders) || dichVuIds.some((id) => !returnedOrders.some((o) => String(o.dich_vu_id) === String(id) && o.id))) {
                throw new Error('Máy chủ chưa xác nhận toàn bộ chỉ định đã gửi.')
            }
            return {
                luot_kham_id: result.luot_kham_id,
                orders: returnedOrders.map((order) => {
                    const service = services.find((s) => String(s.id) === String(order.dich_vu_id))
                    return {
                        id: order.id,
                        server_order_id: order.id,
                        luot_kham_id: enc.id,
                        dich_vu_id: order.dich_vu_id,
                        ma_dich_vu: order.ma_dich_vu,
                        nhom_dich_vu: order.nhom_dich_vu,
                        ten_dich_vu: service?.ten_dich_vu,
                        trang_thai: order.trang_thai,
                    }
                }),
            }
        } catch (e) {
            console.warn('Sync CLS orders to /api/v1/subclinical/workspace-orders error:', e)
            const errorMsg = pickErrorMessage(e, 'Không thể gửi chỉ định cận lâm sàng lên máy chủ')
            AppToast.error(errorMsg)
            throw new Error(errorMsg)
        }
    }

    getMyQueue = async () => {
        await this.hydrateFromPostgres(true)
        return { data: db.queue.map(ticketToQueueItem) }
    }

    getSavedQueueItem = async (ticketId) => {
        await this.reloadFromPostgres()
        const ticket = db.queue.find((t) => String(t.ticket_id) === String(ticketId) || String(t.encounter_id) === String(ticketId))
        if (!ticket) throw new Error('Máy chủ chưa trả về lượt khám đã cập nhật.')
        return { data: ticketToQueueItem(ticket) }
    }

    callNext = async () => {
        await this.hydrateFromPostgres(true)
        const activeTickets = db.queue.filter((t) => t.trang_thai === 'dang_kham')
        if (activeTickets.length > 1) throw new Error('Hàng đợi máy chủ không nhất quán: có nhiều lượt đang khám.')
        const current = activeTickets[0]
        if (current) {
            throw new Error(`Đang có bệnh nhân #${current.so_thu_tu_kham} (${current.ten_benh_nhan || 'Đang khám'}) trong phòng khám. Hoàn tất hoặc tạm hoãn trước khi gọi tiếp.`)
        }
        const eligible = db.queue.filter((t) => t.trang_thai === 'cho_kham' || t.trang_thai === 'co_ket_qua_cls')
        if (eligible.length === 0) throw new Error('Không còn bệnh nhân chờ khám.')

        const next = eligible.sort((a, b) => {
            const aReturned = a.trang_thai === 'co_ket_qua_cls' || (a.ghi_chu && a.ghi_chu.includes('CÓ KQ CLS'))
            const bReturned = b.trang_thai === 'co_ket_qua_cls' || (b.ghi_chu && b.ghi_chu.includes('CÓ KQ CLS'))
            if (aReturned && !bReturned) return -1
            if (!aReturned && bReturned) return 1
            if (a.muc_do_uu_tien !== b.muc_do_uu_tien) return a.muc_do_uu_tien - b.muc_do_uu_tien
            return String(a.so_thu_tu_kham).localeCompare(String(b.so_thu_tu_kham), undefined, { numeric: true })
        })[0]

        next.trang_thai = 'dang_kham'
        next.so_lan_goi = (next.so_lan_goi || 0) + 1
        next.ghi_chu = 'Đang khám'
        const enc = db.encounters[next.encounter_id] || db.encounters[String(next.encounter_id)]
        if (enc && !enc.thoi_gian_bat_dau) enc.thoi_gian_bat_dau = new Date().toISOString()
        await this.persistToPostgres()
        return this.getSavedQueueItem(next.ticket_id)
    }

    startSpecificPatient = async (encounterIdOrTicketId) => {
        await this.hydrateFromPostgres(true)
        const activeTickets = db.queue.filter((t) => t.trang_thai === 'dang_kham')
        if (activeTickets.length > 1) throw new Error('Hàng đợi máy chủ không nhất quán: có nhiều lượt đang khám.')
        const ticket = db.queue.find(
            (t) => String(t.encounter_id) === String(encounterIdOrTicketId) || String(t.ticket_id) === String(encounterIdOrTicketId)
        )
        if (!ticket) throw new Error('Không tìm thấy lượt khám trong hàng đợi')
        if (ticket.trang_thai === 'dang_kham') {
            return { data: ticketToQueueItem(ticket) }
        }
        const current = activeTickets.find((t) => String(t.encounter_id) !== String(ticket.encounter_id) && String(t.ticket_id) !== String(ticket.ticket_id))
        if (current) {
            throw new Error(`Đang có bệnh nhân #${current.so_thu_tu_kham} (${current.ten_benh_nhan || 'Đang khám'}) trong phòng khám. Hoàn tất hoặc tạm hoãn ca hiện tại trước khi bắt đầu ca mới.`)
        }
        ticket.trang_thai = 'dang_kham'
        ticket.so_lan_goi = (ticket.so_lan_goi || 0) + 1
        ticket.ghi_chu = 'Đang khám'
        const enc = db.encounters[ticket.encounter_id] || db.encounters[String(ticket.encounter_id)]
        if (enc && !enc.thoi_gian_bat_dau) {
            enc.thoi_gian_bat_dau = new Date().toISOString()
        }
        await this.persistToPostgres()
        return this.getSavedQueueItem(ticket.ticket_id)
    }

    recall = async (ticketId) => {
        await this.hydrateFromPostgres(true)
        const t = db.queue.find((x) => x.ticket_id === ticketId)
        if (!t) throw new Error('Không tìm thấy số thứ tự')
        t.so_lan_goi += 1
        await this.persistToPostgres()
        return this.getSavedQueueItem(t.ticket_id)
    }

    postponeTicket = async (ticketId, reason = 'Chờ kết quả Cận lâm sàng') => {
        await this.hydrateFromPostgres(true)
        const t = db.queue.find((x) => x.ticket_id === ticketId || x.encounter_id === ticketId)
        if (!t) throw new Error('Không tìm thấy lượt khám')
        t.trang_thai = 'tam_hoan'
        t.ghi_chu = reason
        await this.persistToPostgres()
        return this.getSavedQueueItem(t.ticket_id)
    }

    getEncounterSync = (encounterId) => db?.encounters?.[encounterId] || db?.encounters?.[String(encounterId)] || null
    getAllEncountersSync = () => db?.encounters || {}

    getEncounter = async (encounterId) => {
        await this.hydrateFromPostgres(true)
        try {
            const enc = getEncounterOrThrow(encounterId)
            return delay(enc)
        } catch (e) {
            return reject(e.message)
        }
    }

    saveEncounterDraft = async (encounterId, patch) => {
        await this.hydrateFromPostgres()
        const enc = db.encounters[encounterId] || db.encounters[String(encounterId)]
        if (!enc) throw new Error('Không tìm thấy lượt khám')
        if (enc.is_locked) throw new Error('Bệnh án đã khóa, không thể sửa.')
        Object.assign(enc, patch)
        await this.persistToPostgres()
        return { data: { saved_at: new Date().toISOString() } }
    }

    createOrders = async (encounterId, dichVuIds) => {
        await this.hydrateFromPostgres(true)
        const enc = db.encounters[encounterId] || db.encounters[String(encounterId)]
        if (!enc) throw new Error('Không tìm thấy lượt khám')
        const existing = new Set((enc.danh_sach_chi_dinh || []).filter((o) => o.trang_thai !== 'da_huy').map((o) => String(o.dich_vu_id)))
        const ids = [...new Set((dichVuIds || []).filter((id) => !existing.has(String(id))))]
        if (ids.length === 0) return { data: enc.danh_sach_chi_dinh || [] }
        const allServices = await this.getServicesCatalog()
        const selectedServices = ids.map((id) => allServices.find((s) => String(s.id) === String(id)))
        if (selectedServices.some((service) => !service)) throw new Error('Danh mục dịch vụ không có một hoặc nhiều mục đã chọn. Tải lại danh mục trước khi gửi.')
        if (selectedServices.some((service) => service.don_gia == null || !Number.isFinite(Number(service.don_gia)))) {
            throw new Error('Danh mục máy chủ chưa có giá hợp lệ cho một hoặc nhiều dịch vụ đã chọn.')
        }
        const serverOrders = await this.syncOrdersToServer(enc, ids, selectedServices)
        enc.luot_kham_server_id = serverOrders.luot_kham_id
        enc.danh_sach_chi_dinh = [...(enc.danh_sach_chi_dinh || []), ...serverOrders.orders]
        await this.persistToPostgres()
        await this.reloadFromPostgres()
        const savedEncounter = getEncounterOrThrow(encounterId)
        if (ids.some((id) => !(savedEncounter.danh_sach_chi_dinh || []).some((order) => String(order.dich_vu_id) === String(id) && order.server_order_id))) {
            throw new Error('Chỉ định đã được tạo nhưng bàn khám chưa xác nhận đồng bộ trạng thái. Tải lại hồ sơ trước khi tiếp tục.')
        }
        try {
            clinicalEventBridge.emit(CLINICAL_EVENTS.CLS_ORDERED, {
                encounterId,
                orders: savedEncounter.danh_sach_chi_dinh,
            })
        } catch (e) {
            console.warn('Bridge emit CLS_ORDERED error:', e)
        }
        return { data: savedEncounter.danh_sach_chi_dinh }
    }

    cancelOrder = async (encounterId, orderId) => {
        await this.hydrateFromPostgres(true)
        const enc = db.encounters[encounterId] || db.encounters[String(encounterId)]
        const o = enc?.danh_sach_chi_dinh?.find((x) => x.id === orderId)
        if (!o) throw new Error('Không tìm thấy chỉ định')
        if (o.trang_thai !== 'da_chi_dinh' || !o.server_order_id) throw new Error('Chỉ hủy được chỉ định đã xác nhận và chưa thực hiện.')
        await this.post(`/api/v1/subclinical/orders/${o.server_order_id}/cancel?ly_do=${encodeURIComponent('Bác sĩ hủy chỉ định')}`, {})
        enc.danh_sach_chi_dinh = enc.danh_sach_chi_dinh.filter((x) => x.id !== orderId)
        await this.persistToPostgres()
        await this.reloadFromPostgres()
        return { data: getEncounterOrThrow(encounterId).danh_sach_chi_dinh }
    }

    completeEncounter = async (encounterId, payload) => {
        await this.hydrateFromPostgres(true)
        const enc = db.encounters[encounterId] || db.encounters[String(encounterId)]
        if (!enc) throw new Error('Không tìm thấy lượt khám')
        if (enc.is_locked) throw new Error('Bệnh án đã được máy chủ khóa.')
        const primary = (payload.danh_sach_chan_doan || []).filter((d) => d.loai_chan_doan === 'chinh')
        if (primary.length !== 1) throw new Error('Cần đúng 1 chẩn đoán chính (ICD-10) trước khi hoàn tất khám.')

        const diagnoses = payload.danh_sach_chan_doan || []
        for (const diagnosis of diagnoses) {
            const matches = await this.searchIcd10(diagnosis.ma_icd10, { silent: true })
            if (!matches.some((item) => String(item.ma).toUpperCase() === String(diagnosis.ma_icd10).toUpperCase())) {
                throw new Error(`Mã ICD-10 ${diagnosis.ma_icd10 || ''} không có trong danh mục máy chủ. Chọn lại chẩn đoán từ danh mục.`)
            }
        }

        const activeOrders = (enc.danh_sach_chi_dinh || []).filter((o) => o.trang_thai !== 'da_huy')
        if (activeOrders.length > 0) {
            const services = await this.getServicesCatalog()
            for (const order of activeOrders) {
                if (!order.server_order_id || !services.some((service) => String(service.id) === String(order.dich_vu_id))) {
                    throw new Error('Không thể xác nhận một hoặc nhiều chỉ định với danh mục máy chủ. Tải lại danh mục và hồ sơ trước khi hoàn tất.')
                }
            }
        }

        const drugs = payload.don_thuoc?.danh_sach_thuoc || []
        for (const drug of drugs) {
            const key = drug.ma_thuoc || drug.ten_thuoc
            if (!key) throw new Error('Có thuốc chưa được chọn từ danh mục máy chủ.')
            const matches = await this.searchDrugs(key, { silent: true })
            const found = matches.some((item) => {
                const sameId = drug.id && String(item.id) === String(drug.id)
                const sameCode = drug.ma_thuoc && String(item.ma_thuoc).toLowerCase() === String(drug.ma_thuoc).toLowerCase()
                const sameCatalogItem = String(item.ten_thuoc).trim().toLowerCase() === String(drug.ten_thuoc).trim().toLowerCase() &&
                    (!drug.ham_luong || String(item.ham_luong || '').trim().toLowerCase() === String(drug.ham_luong).trim().toLowerCase())
                return sameId || sameCode || sameCatalogItem
            })
            if (!found) throw new Error(`Thuốc ${drug.ten_thuoc || ''} không có trong danh mục máy chủ. Chọn lại thuốc từ danh mục.`)
        }

        const pendingOrders = activeOrders.filter((o) => !['da_co_ket_qua', 'da_duyet'].includes(o.trang_thai))
        if (pendingOrders.length > 0) {
            throw new Error(`Không thể hoàn tất lượt khám: còn ${pendingOrders.length} chỉ định cận lâm sàng đang thực hiện dở dang chưa có kết quả.`)
        }

        Object.assign(enc, payload, { is_locked: false })
        await this.persistToPostgres()

        const res = await this.post(`/api/v1/clinical/encounters/${encounterId}/complete`, {
            ket_luan_dieu_tri: payload.ket_luan_dieu_tri,
            loi_dan_bac_si: payload.loi_dan_bac_si,
            ngay_hen_tai_kham: payload.ngay_hen_tai_kham,
        })
        const completed = res?.data?.data
        if (!completed?.is_locked || String(completed.id) !== String(encounterId)) {
            throw new Error('Máy chủ chưa xác nhận hoàn tất và khóa bệnh án.')
        }

        const confirmedWorkspace = { ...enc, ...completed, is_locked: true }
        Object.assign(enc, confirmedWorkspace)
        const ticket = db.queue.find((t) => String(t.encounter_id) === String(encounterId))
        if (ticket) Object.assign(ticket, { trang_thai: 'da_kham', ghi_chu: 'Đã khám xong' })
        try {
            clinicalEventBridge.emit(CLINICAL_EVENTS.ENCOUNTER_COMPLETED, { encounterId, encounter: completed })
        } catch (e) {
            console.warn('Bridge emit ENCOUNTER_COMPLETED error:', e)
        }
        return { data: confirmedWorkspace }
    }

    createAmendment = async (encounterId, payload) => {
        await this.hydrateFromPostgres(true)
        if (!this.getEncounterSync(encounterId)?.is_locked) throw new Error('Chỉ tạo biên bản đính chính cho bệnh án đã khóa.')
        const res = await this.post(`/api/v1/clinical/encounters/${encounterId}/amendments`, payload)
        if (res?.data?.success === false || !res?.data?.data?.id) throw new Error(res?.data?.message || 'Máy chủ chưa xác nhận tạo biên bản đính chính.')
        return { data: res.data.data }
    }

    rateAiSuggestion = async (encounterId, payload) => {
        const enc = db.encounters[encounterId]
        const analysisId = enc?.ai_triage?.phan_tich_ai_id
        if (!analysisId) return reject('Lượt khám này chưa được liên kết với kết quả phân tích AI từ lịch hẹn.')
        const response = await this.post('/api/v1/clinical/ai-feedback', {
            phan_tich_ai_id: analysisId,
            so_sao: payload.so_sao,
            nhan_xet: payload.nhan_xet || null,
        })
        if (enc) enc.danh_gia_ai = { ...payload, phan_tich_ai_id: analysisId, id: response?.data?.data?.id }
        await this.persistToPostgres()
        return delay(enc.danh_gia_ai, 150)
    }

    getServices = async () => {
        const res = await this.get('/api/v1/medical/services', { __skipGlobalLoading: true, __skipGlobalError: true })
        if (res?.data?.success === false || !Array.isArray(res?.data?.data)) throw new Error('Máy chủ trả về danh mục dịch vụ không hợp lệ.')
        return res.data.data
    }

    getServicesCatalog = async () => {
        return this.getServices()
    }

    searchIcd10 = async (keyword, { silent = false } = {}) => {
        const q = String(keyword || '').trim()
        try {
            const res = await this.get(`/api/v1/medical/icd10?keyword=${encodeURIComponent(q)}&limit=25`, { __skipGlobalLoading: true, __skipGlobalError: true })
            if (res?.data?.success === false || !Array.isArray(res?.data?.data)) throw new Error('Máy chủ trả về danh mục ICD-10 không hợp lệ.')
            return res.data.data
        } catch (e) {
            const message = pickErrorMessage(e, 'Không thể tải danh mục ICD-10 từ máy chủ.')
            if (!silent) AppToast.error(message)
            throw new Error(message)
        }
    }

    searchDrugs = async (keyword, { silent = false } = {}) => {
        const q = String(keyword || '').trim()
        try {
            const res = await this.get(`/api/v1/medical/drugs?keyword=${encodeURIComponent(q)}&limit=25`, { __skipGlobalLoading: true, __skipGlobalError: true })
            if (res?.data?.success === false || !Array.isArray(res?.data?.data)) throw new Error('Máy chủ trả về danh mục thuốc không hợp lệ.')
            return res.data.data
        } catch (e) {
            const message = pickErrorMessage(e, 'Không thể tải danh mục thuốc từ máy chủ.')
            if (!silent) AppToast.error(message)
            throw new Error(message)
        }
    }

    getClsWorklist = async ({ nhom, tuKhoa, ngay, tatCaNgay } = {}) => {
        await this.hydrateFromPostgres()
        const params = new URLSearchParams({ trang_thai: 'tat_ca' })
        if (nhom && nhom !== 'ALL') {
            params.set('nhom_dich_vu', nhom)
        }
        if (tuKhoa?.trim()) {
            params.set('tu_khoa', tuKhoa.trim())
        }
        if (tatCaNgay) {
            params.set('tat_ca_ngay', 'true')
        } else if (ngay) {
            params.set('ngay', ngay)
        }
        const res = await this.get(`/api/v1/subclinical/queue?${params}`, { __skipGlobalLoading: true })
        const items = res?.data?.data?.items
        if (!Array.isArray(items)) throw new Error('Máy chủ trả về hàng đợi cận lâm sàng không hợp lệ.')
        return { data: items.filter((it) => it.trang_thai !== 'da_huy').map(toWorklistItem) }
    }

    startOrder = async (orderId) => {
        const res = await this.post(`/api/v1/subclinical/orders/${orderId}/start`, {})
        const confirmed = res?.data?.data
        if (!confirmed?.trang_thai) throw new Error('Máy chủ chưa xác nhận bắt đầu chỉ định.')
        return { data: confirmed }
    }

    submitOrderResult = async (orderId, payload) => {
        const final = payload.trang_thai === 'da_co_ket_qua'
        let confirmed = null
        const imaging = payload.ket_qua_chi_tiet?.loai === 'CDHA'
        if (imaging) {
            const res = await this.saveImagingResult(orderId, payload, final)
            confirmed = res?.data?.data
        }
        if (final && !imaging) {
            const detail = payload.ket_qua_chi_tiet
            const res = await this.post(`/api/v1/subclinical/orders/${orderId}/results`, {
                ket_qua_chi_tiet: typeof detail === 'string' ? detail : JSON.stringify(detail ?? {}),
                ket_qua_phan_loai: payload.ket_qua_phan_loai || 'BINH_THUONG',
                tri_so_chi_tiet: detail && typeof detail === 'object' ? detail : {},
                file_dinh_kem_urls: payload.tep_dinh_kem_url ? [payload.tep_dinh_kem_url] : [],
            })
            confirmed = res?.data?.data
        }
        if (final && confirmed?.trang_thai !== 'da_co_ket_qua') {
            throw new Error('Máy chủ chưa xác nhận hoàn tất kết quả cận lâm sàng.')
        }
        const result = { ...payload, ...confirmed, id: orderId }

        if (!final) {
            await this.reloadFromPostgres()
            const mirror = findMirrorOrder(orderId)
            if (mirror) {
                const patch = { ...result }
                delete patch.id
                Object.assign(mirror.order, patch)
                await this.persistToPostgres()
            }
        }

        if (final) {
            try {
                clinicalEventBridge.emit(CLINICAL_EVENTS.CLS_RESULT_RETURNED, {
                    orderId,
                    order: result,
                })
            } catch (e) {
                console.warn('Bridge emit CLS_RESULT_RETURNED error:', e)
            }
        }

        return result
    }

    uploadFile = (file) => {
        return delay({ url: URL.createObjectURL(file), ten_tep: file.name }, 300)
    }

    getImagingResult = (orderId) =>
        this.get(`/api/v1/subclinical/orders/${orderId}/imaging-result`, { __skipGlobalLoading: true })

    saveImagingResult = (orderId, payload, final) => {
        const detail = payload.ket_qua_chi_tiet || {}
        return this.post(`/api/v1/subclinical/orders/${orderId}/imaging-result`, {
            mo_ta_hinh_anh: detail.mo_ta || null,
            ket_luan: detail.ket_luan || null,
            de_nghi: detail.de_nghi || null,
            ket_qua_phan_loai: payload.ket_qua_phan_loai || 'BINH_THUONG',
            hoan_tat: final,
        })
    }

    uploadClsImage = (orderId, file, onProgress) => {
        const form = new FormData()
        form.append('file', file)
        return this.post(`/api/v1/subclinical/orders/${orderId}/files`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            __skipGlobalLoading: true,
            onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded * 100) / e.total) : 0),
        })
    }

    deleteClsImage = (url) => this.delete(url)

    fetchClsImageBlob = async (url) => {
        const res = await this.get(url, { responseType: 'blob', __skipGlobalLoading: true })
        return res.data
    }

    getSpecialtyExam = async (encounterId, deptCode) => {
        const res = await this.get(`/api/v1/clinical/encounters/${encounterId}/specialty/${deptCode}`)
        return res?.data?.data ?? null
    }

    getAllSpecialtyExams = async (encounterId) => {
        const res = await this.get(`/api/v1/clinical/encounters/${encounterId}/specialties`)
        return res?.data?.data ?? {}
    }

    saveSpecialtyExam = async (encounterId, deptCode, data) => {
        const res = await this.put(`/api/v1/clinical/encounters/${encounterId}/specialty/${deptCode}`, { data })
        if (res?.data?.success === false || res?.data?.data == null) throw new Error(res?.data?.message || 'Máy chủ chưa xác nhận lưu phiếu khám chuyên khoa.')
        if (db.encounters[encounterId]) {
            db.encounters[encounterId].specialtyExams = {
                ...(db.encounters[encounterId].specialtyExams || {}),
                [deptCode]: res.data.data,
            }
        }
        return res.data.data
    }

    copyOldPrescription = async (encounterId, sourcePrescriptionId) => {
        const res = await this.post(
            `/api/v1/clinical/encounters/${encounterId}/copy-prescription/${sourcePrescriptionId}`,
            {}
        )
        if (res?.data?.success === false || !res?.data?.data) throw new Error(res?.data?.message || 'Máy chủ chưa xác nhận sao chép đơn thuốc.')
        return res.data.data
    }

    getLabTemplate = async (orderId) => {
        const res = await this.get(`/api/v1/subclinical/orders/${orderId}/lab-template`, { __skipGlobalLoading: true })
        return { data: res?.data?.data }
    }

    submitLabResult = async (orderId, body) => {
        const res = await this.post(`/api/v1/subclinical/orders/${orderId}/lab-results`, body)
        const { trang_thai, ket_qua: kq } = res.data.data
        const result = {
            id: orderId,
            trang_thai,
            trang_thai_ket_qua: kq.trang_thai_ket_qua,
            ket_qua_phan_loai: kq.ket_qua_phan_loai,
            ket_qua_chi_tiet: {
                loai: 'XET_NGHIEM',
                chi_so: kq.chi_so,
                chi_tiet: kq.chi_tiet,
                ket_luan: kq.ket_luan,
                ghi_chu: kq.ghi_chu,
            },
        }
        if (!body.luu_nhap) {
            await this.syncReturnedResultToWorkspace(orderId, {
                trang_thai,
                trang_thai_ket_qua: kq.trang_thai_ket_qua,
                ket_qua_phan_loai: kq.ket_qua_phan_loai,
                ket_qua_chi_tiet: result.ket_qua_chi_tiet,
                thoi_gian_tra_ket_qua: new Date().toISOString(),
            })
        }
        try {
            clinicalEventBridge.emit(CLINICAL_EVENTS.CLS_RESULT_RETURNED, {
                orderId,
                order: result,
            })
        } catch (e) {
            console.warn('Bridge emit CLS_RESULT_RETURNED error:', e)
        }
        return { data: result }
    }

    approveOrder = async (orderId) => {
        const res = await this.post(`/api/v1/subclinical/orders/${orderId}/approve`, {})
        const data = res.data.data
        const patch = toMirrorPatch(data.ket_qua)
        await this.syncReturnedResultToWorkspace(orderId, patch)
        return { data: { id: orderId, ...patch, trang_thai_ket_qua: data.trang_thai_ket_qua, nguoi_duyet: data.nguoi_duyet.ho_ten } }
    }

    getClsReport = async (orderId) => {
        const res = await this.get(`/api/v1/subclinical/orders/${orderId}/report`, { __skipGlobalLoading: true })
        return res?.data?.data
    }

    pollReturnedResults = async () => {
        if (this._returnedPollOff) return []
        if (this._returnedPolling) return []
        this._returnedPolling = this._pollReturnedResultsOnce()
        try {
            return await this._returnedPolling
        } finally {
            this._returnedPolling = null
        }
    }

    _pendingReturnedItems = []

    _pollReturnedResultsOnce = async () => {
        let payload
        try {
            const query = this._returnedSince ? `?since=${encodeURIComponent(this._returnedSince)}` : ''
            const res = await this.get(`/api/v1/subclinical/returned-results${query}`, {
                __skipGlobalLoading: true,
                __skipGlobalError: true,
            })
            payload = res?.data?.data || {}
        } catch (e) {
            if (e?.response?.status === 403) this._returnedPollOff = true
            return []
        }

        const incomingItems = payload.items || []
        if (incomingItems.length === 0 && (!this._pendingReturnedItems || this._pendingReturnedItems.length === 0)) {
            if (payload.server_time) this._returnedSince = payload.server_time
            return []
        }

        await this.reloadFromPostgres()

        this._pendingReturnedItems = this._pendingReturnedItems || []
        const pool = [...this._pendingReturnedItems]
        incomingItems.forEach((it) => {
            if (!pool.some((p) => String(p.chi_dinh_id) === String(it.chi_dinh_id))) {
                pool.push(it)
            }
        })

        const changed = []
        let dirty = false
        const remaining = []

        pool.forEach((it) => {
            const mirror = findMirrorOrder(it.chi_dinh_id, it.luot_kham_id, it.dich_vu_id)
            if (!mirror) {
                remaining.push(it)
                return
            }
            if (!sameInstant(mirror.order.thoi_gian_duyet, it.thoi_gian_duyet)) {
                applyReturnedResult(mirror, toMirrorPatch(it))
                dirty = true
                changed.push({
                    encounterId: mirror.enc.id,
                    patientName: mirror.enc.benh_nhan?.ho_ten,
                    order: structuredClone(mirror.order),
                })
            }
        })

        this._pendingReturnedItems = remaining.slice(-50)
        if (payload.server_time && remaining.length === 0) {
            this._returnedSince = payload.server_time
        } else if (payload.server_time && !this._returnedSince) {
            this._returnedSince = payload.server_time
        }

        if (dirty) await this.persistToPostgres()
        return changed
    }

    syncReturnedResultToWorkspace = async (orderId, result) => {
        await this.reloadFromPostgres()
        const mirror = findMirrorOrder(orderId)
        if (mirror) {
            const patch = { ...result }
            delete patch.id
            applyReturnedResult(mirror, patch)
            await this.persistToPostgres()
        }
        try {
            clinicalEventBridge.emit(CLINICAL_EVENTS.CLS_RESULT_RETURNED, {
                orderId,
                order: mirror?.order || result,
                encounterId: mirror?.enc.id,
            })
        } catch (e) {
            console.warn('Bridge emit CLS_RESULT_RETURNED error:', e)
        }
    }
}

export const clinicalService = new ClinicalService()
export default clinicalService
