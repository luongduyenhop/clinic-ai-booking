import { BaseServices } from '../BaseService'
import { clinicalEventBridge, CLINICAL_EVENTS } from '../clinicalEventBridge'
import { AppToast } from '../../components/common/AppNotification'
import { pickErrorMessage } from '../../utils/helpers/apiHelper'


export const USE_MOCK = false
const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'
const WORKSPACE_STORAGE_KEY = 'clinic_doctor_workspace_v1'

const FALLBACK_SERVICES = [
    { id: 1, ma_dich_vu: 'DV_XN_01', ten_dich_vu: 'Tổng phân tích tế bào máu ngoại vi', don_gia: 95000, don_vi_tinh: 'Lần', nhom_dich_vu: 'xet_nghiem' },
    { id: 2, ma_dich_vu: 'DV_XQ_01', ten_dich_vu: 'Chụp X-quang ngực thẳng', don_gia: 120000, don_vi_tinh: 'Lần', nhom_dich_vu: 'cdha' },
    { id: 3, ma_dich_vu: 'DV_SA_01', ten_dich_vu: 'Siêu âm tim Doppler màu', don_gia: 250000, don_vi_tinh: 'Lần', nhom_dich_vu: 'cdha' },
    { id: 4, ma_dich_vu: 'DV_ECG_01', ten_dich_vu: 'Điện tim thường (ECG 12 cần)', don_gia: 65000, don_vi_tinh: 'Lần', nhom_dich_vu: 'tdcn' },
    { id: 5, ma_dich_vu: 'DV_NS_01', ten_dich_vu: 'Nội soi dạ dày - tá tràng', don_gia: 450000, don_vi_tinh: 'Lần', nhom_dich_vu: 'noi_soi' },
]

const FALLBACK_ICD10 = [
    { ma: 'A09', ten: 'Tiêu chảy và viêm dạ dày ruột do nhiễm khuẩn' },
    { ma: 'I10', ten: 'Bệnh tăng huyết áp vô căn (nguyên phát)' },
    { ma: 'E11', ten: 'Đái tháo đường típ 2' },
    { ma: 'K29.7', ten: 'Viêm dạ dày - tá tràng' },
    { ma: 'K21.0', ten: 'Trào ngược dạ dày thực quản (GERD)' },
    { ma: 'J02.9', ten: 'Viêm họng cấp' },
    { ma: 'J30.4', ten: 'Viêm mũi dị ứng' },
    { ma: 'J00', ten: 'Viêm mũi họng cấp (Cảm thường)' },
]

const FALLBACK_DRUGS = [
    { id: 125, ma_thuoc: 'TH001', ten_thuoc: 'Augmentin 1g', hoat_chat: 'Amoxicillin + Acid Clavulanic', ham_luong: '1000mg', don_vi_tinh: 'Viên' },
    { id: 126, ma_thuoc: 'TH002', ten_thuoc: 'Augmentin 625mg', hoat_chat: 'Amoxicillin + Acid Clavulanic', ham_luong: '625mg', don_vi_tinh: 'Viên' },
    { id: 127, ma_thuoc: 'TH003', ten_thuoc: 'Amoxicillin 500mg', hoat_chat: 'Amoxicillin', ham_luong: '500mg', don_vi_tinh: 'Viên' },
    { id: 130, ma_thuoc: 'TH006', ten_thuoc: 'Paracetamol 500mg', hoat_chat: 'Paracetamol', ham_luong: '500mg', don_vi_tinh: 'Viên' },
    { id: 131, ma_thuoc: 'TH007', ten_thuoc: 'Panadol Extra', hoat_chat: 'Paracetamol + Caffeine', ham_luong: '500mg/65mg', don_vi_tinh: 'Viên' },
    { id: 135, ma_thuoc: 'TH011', ten_thuoc: 'Amlodipine 5mg', hoat_chat: 'Amlodipine', ham_luong: '5mg', don_vi_tinh: 'Viên' },
]

const loadInitialDb = () => {
    try {
        localStorage.removeItem(WORKSPACE_STORAGE_KEY)
        localStorage.removeItem('clinic_doctor_clinical_workspace_v2')
    } catch {}
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
            const pendingOrders = activeOrders.filter((o) => o.trang_thai !== 'da_co_ket_qua')
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
    const mirror = findMirrorOrder(item.id)?.order
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
        ket_qua_chi_tiet: (hasResult && parseResultDetail(item)) || mirror?.ket_qua_chi_tiet || null,
        ket_qua_phan_loai: hasResult ? item.ket_qua_phan_loai : mirror?.ket_qua_phan_loai || null,
        tep_dinh_kem_url: item.file_dinh_kem_urls?.[0] || mirror?.tep_dinh_kem_url || null,
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
        this._hydratedFromPg = true
        try {
            const res = await this.get('/api/v1/clinical/workspace-state', {
                params: { _t: Date.now() },
                __skipGlobalLoading: true,
            })
            const remote = res?.data?.data
            if (demoMode) {
                if (!remote?.encounters || !Array.isArray(remote.queue)) {
                    throw new Error('Máy chủ trả về dữ liệu bàn khám không hợp lệ.')
                }
                db.encounters = remote.encounters
                db.queue = remote.queue
                db.extraOrders = []
                return
            }
            if (remote && remote.encounters && Array.isArray(remote.queue)) {
                const activeDangKham = db.queue.filter((t) => t.trang_thai === 'dang_kham')
                const localEncounters = db.encounters || {}

                const mergedEncounters = { ...remote.encounters }
                Object.entries(localEncounters).forEach(([k, lEnc]) => {
                    if (remote.encounters?.[k] && lEnc?.is_locked) {
                        mergedEncounters[k] = { ...mergedEncounters[k], ...lEnc }
                    }
                })
                activeDangKham.forEach((act) => {
                    const lEnc = localEncounters[act.encounter_id] || localEncounters[String(act.encounter_id)]
                    const rEnc = mergedEncounters[act.encounter_id] || mergedEncounters[String(act.encounter_id)]
                    if (rEnc && lEnc && !lEnc.is_locked) {
                        const updatedEnc = {
                            ...rEnc,
                            ...lEnc,
                            thoi_gian_bat_dau: lEnc.thoi_gian_bat_dau || rEnc?.thoi_gian_bat_dau || new Date().toISOString(),
                        }
                        mergedEncounters[act.encounter_id] = updatedEnc
                        mergedEncounters[String(act.encounter_id)] = updatedEnc
                    }
                })
                db.encounters = mergedEncounters

                db.queue = remote.queue.map((rem) => {
                    const enc = mergedEncounters?.[rem.encounter_id] || mergedEncounters?.[String(rem.encounter_id)]
                    if (enc?.is_locked || rem.trang_thai === 'da_kham') {
                        return { ...rem, trang_thai: 'da_kham', ghi_chu: 'Đã khám xong' }
                    }
                    const activeOrders = (enc?.danh_sach_chi_dinh || []).filter((o) => o.trang_thai !== 'da_huy')
                    const pendingOrders = activeOrders.filter((o) => o.trang_thai !== 'da_co_ket_qua')
                    const hasReadyOrders = activeOrders.length > 0 && pendingOrders.length === 0

                    if (hasReadyOrders) {
                        return { ...rem, trang_thai: 'co_ket_qua_cls', ghi_chu: rem.ghi_chu || '⭐ CÓ KQ CLS: Đã có kết quả' }
                    }
                    if (pendingOrders.length > 0 || rem.trang_thai === 'tam_hoan') {
                        return { ...rem, trang_thai: 'tam_hoan', ghi_chu: rem.ghi_chu || 'Chờ kết quả Cận lâm sàng' }
                    }
                    if ((rem.trang_thai === 'dang_kham' || (enc?.thoi_gian_bat_dau && !enc?.is_locked)) && !enc?.is_locked) {
                        return { ...rem, trang_thai: 'dang_kham', ghi_chu: 'Đang khám' }
                    }
                    return rem
                })
                db.extraOrders = Array.isArray(remote.extraOrders) ? remote.extraOrders : db.extraOrders
                db.nextId = Number(remote.nextId) || db.nextId
                try {
                    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(db))
                } catch {
                }
            }
        } catch (error) {
            this._hydratedFromPg = false
            if (demoMode) throw error
        }
    }

    persistToPostgres = async (changes = {}) => {
        if (demoMode) {
            if (!changes.queue?.length && !Object.keys(changes.encounters || {}).length) return
            await this.put('/api/v1/clinical/workspace-state', changes, { __skipGlobalLoading: true })
            return
        }
        try {
            localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(db))
        } catch {
        }
        try {
            await this.put('/api/v1/clinical/workspace-state', db, { __skipGlobalLoading: true })
        } catch {
        }
    }

    reloadFromPostgres = async () => {
        this._hydratedFromPg = false
        await this.hydrateFromPostgres()
    }

    syncOrdersToServer = async (enc) => {
        const pending = (enc.danh_sach_chi_dinh || []).filter((o) => !o.server_order_id && o.trang_thai !== 'da_huy')
        if (pending.length === 0) return
        const bn = enc.benh_nhan || {}
        const tuoi = Number.parseInt(bn.tuoi, 10)
        try {
            const res = await this.post(
                '/api/v1/subclinical/workspace-orders',
                {
                    workspace_encounter_id: String(enc.id),
                    benh_nhan: {
                        ma: bn.ma || null,
                        ho_ten: bn.ho_ten || 'Bệnh nhân',
                        gioi_tinh: bn.gioi_tinh || null,
                        tuoi: Number.isNaN(tuoi) ? null : tuoi,
                        di_ung_thuoc: bn.di_ung_thuoc || null,
                    },
                    ly_do_vao_kham: enc.ly_do_vao_kham || enc.ai_triage?.trieu_chung_nhap || null,
                    chan_doan_so_bo: diagnosisText(enc),
                    dich_vu_ids: [...new Set(pending.map((o) => o.dich_vu_id).filter(Boolean))],
                },
                { __skipGlobalLoading: true }
            )
            const result = res?.data?.data
            enc.luot_kham_server_id = result?.luot_kham_id
            const returnedOrders = result?.orders || []
            returnedOrders.forEach((so) => {
                const o = pending.find(
                    (x) =>
                        !x.server_order_id &&
                        (String(x.dich_vu_id) === String(so.dich_vu_id) || Number(x.dich_vu_id) === Number(so.dich_vu_id))
                )
                if (o) {
                    o.server_order_id = Number(so.id)
                    o.trang_thai = so.trang_thai
                }
                const inList = (enc.danh_sach_chi_dinh || []).find(
                    (x) =>
                        !x.server_order_id &&
                        (String(x.dich_vu_id) === String(so.dich_vu_id) || Number(x.dich_vu_id) === Number(so.dich_vu_id))
                )
                if (inList) {
                    inList.server_order_id = Number(so.id)
                    inList.trang_thai = so.trang_thai
                }
            })
        } catch (e) {
            console.warn('Sync CLS orders to /api/v1/subclinical/workspace-orders error:', e)
            const errorMsg = pickErrorMessage(e, 'Không thể gửi chỉ định cận lâm sàng lên máy chủ')
            AppToast.error(errorMsg)
            throw new Error(errorMsg)
        }
    }


    reconcileQueueState = () => {
        for (const t of db.queue) {
            const enc = db.encounters[t.encounter_id] || db.encounters[String(t.encounter_id)]
            if (enc) {
                if (enc.is_locked) {
                    t.trang_thai = 'da_kham'
                    t.ghi_chu = 'Đã khám xong'
                } else {
                    const activeOrders = (enc.danh_sach_chi_dinh || []).filter((o) => o.trang_thai !== 'da_huy')
                    const pendingOrders = activeOrders.filter((o) => o.trang_thai !== 'da_co_ket_qua')
                    if (activeOrders.length > 0 && pendingOrders.length === 0) {
                        t.trang_thai = 'co_ket_qua_cls'
                        if (!t.ghi_chu || !t.ghi_chu.includes('CÓ KQ CLS')) {
                            t.ghi_chu = '⭐ CÓ KQ CLS: Đã có kết quả'
                        }
                    } else if (pendingOrders.length > 0 || t.trang_thai === 'tam_hoan') {
                        t.trang_thai = 'tam_hoan'
                        t.ghi_chu = t.ghi_chu || 'Chờ kết quả Cận lâm sàng'
                    } else if (t.trang_thai === 'dang_kham') {
                        t.so_lan_goi = Math.max(t.so_lan_goi || 0, 1)
                        t.ghi_chu = 'Đang khám'
                    }
                }
            }
        }
        const activeDangKham = db.queue.filter((t) => t.trang_thai === 'dang_kham')
        if (activeDangKham.length > 1) {
            const keepTicket = activeDangKham[activeDangKham.length - 1]
            activeDangKham.forEach((t) => {
                if (t !== keepTicket) {
                    t.trang_thai = 'cho_kham'
                    t.ghi_chu = 'Chờ khám'
                }
            })
        }
    }

    getMyQueue = async () => {
        await this.hydrateFromPostgres(true)
        this.reconcileQueueState()
        return delay(db.queue.map(ticketToQueueItem))
    }

    callNext = async () => {
        this.reconcileQueueState()
        const current = db.queue.find((t) => t.trang_thai === 'dang_kham')
        if (current) {
            return reject(
                `Đang có bệnh nhân #${current.so_thu_tu_kham} (${current.ten_benh_nhan || 'Đang khám'}) trong phòng khám. Hoàn tất hoặc tạm hoãn trước khi gọi tiếp.`
            )
        }
        const eligible = db.queue.filter((t) => t.trang_thai === 'cho_kham' || t.trang_thai === 'co_ket_qua_cls')
        if (eligible.length === 0) return reject('Không còn bệnh nhân chờ khám.')

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
        await this.persistToPostgres({ queue: [next] })
        return delay(ticketToQueueItem(next))
    }

    startSpecificPatient = async (encounterIdOrTicketId) => {
        this.reconcileQueueState()
        const ticket = db.queue.find(
            (t) => String(t.encounter_id) === String(encounterIdOrTicketId) || String(t.ticket_id) === String(encounterIdOrTicketId)
        )
        if (!ticket) return reject('Không tìm thấy lượt khám trong hàng đợi')
        if (ticket.trang_thai === 'dang_kham') {
            return delay(ticketToQueueItem(ticket))
        }
        const current = db.queue.find(
            (t) => t.trang_thai === 'dang_kham' && String(t.encounter_id) !== String(ticket.encounter_id) && String(t.ticket_id) !== String(ticket.ticket_id)
        )
        if (current) {
            return reject(
                `Đang có bệnh nhân #${current.so_thu_tu_kham} (${current.ten_benh_nhan || 'Đang khám'}) trong phòng khám. Hoàn tất hoặc tạm hoãn ca hiện tại trước khi bắt đầu ca mới.`
            )
        }
        ticket.trang_thai = 'dang_kham'
        ticket.so_lan_goi = (ticket.so_lan_goi || 0) + 1
        ticket.ghi_chu = 'Đang khám'
        const enc = db.encounters[ticket.encounter_id] || db.encounters[String(ticket.encounter_id)]
        if (enc && !enc.thoi_gian_bat_dau) {
            enc.thoi_gian_bat_dau = new Date().toISOString()
        }
        await this.persistToPostgres({ queue: [ticket] })
        return delay(ticketToQueueItem(ticket))
    }

    recall = async (ticketId) => {
        const t = db.queue.find((x) => x.ticket_id === ticketId)
        if (!t) return reject('Không tìm thấy số thứ tự')
        t.so_lan_goi += 1
        await this.persistToPostgres({ queue: [t] })
        return delay(ticketToQueueItem(t))
    }

    postponeTicket = async (ticketId, reason = 'Chờ kết quả Cận lâm sàng') => {
        const t = db.queue.find((x) => x.ticket_id === ticketId || x.encounter_id === ticketId)
        if (!t) return reject('Không tìm thấy lượt khám')
        t.trang_thai = 'tam_hoan'
        t.ghi_chu = reason
        await this.persistToPostgres({ queue: [t] })
        return delay(ticketToQueueItem(t))
    }

    getEncounterSync = (encounterId) => db?.encounters?.[encounterId] || db?.encounters?.[String(encounterId)] || null
    getAllEncountersSync = () => db?.encounters || {}

    getEncounter = async (encounterId) => {
        await this.hydrateFromPostgres(true)
        this.reconcileQueueState()
        try {
            const enc = getEncounterOrThrow(encounterId)
            return delay(enc)
        } catch (e) {
            return reject(e.message)
        }
    }

    saveEncounterDraft = async (encounterId, patch) => {
        const enc = db.encounters[encounterId] || db.encounters[String(encounterId)]
        if (!enc) return reject('Không tìm thấy lượt khám')
        if (enc.is_locked) return reject('Bệnh án đã khóa, không thể sửa.')
        if (demoMode) {
            await this.persistToPostgres({ encounters: { [encounterId]: patch } })
            Object.assign(enc, patch)
            return { data: { saved_at: new Date().toISOString() } }
        }
        if (!enc.thoi_gian_bat_dau) {
            enc.thoi_gian_bat_dau = new Date().toISOString()
        }
        Object.assign(enc, patch)
        await this.persistToPostgres()
        return delay({ saved_at: new Date().toISOString() }, 120)
    }

    createOrders = async (encounterId, dichVuIds) => {
        const enc = db.encounters[encounterId] || db.encounters[String(encounterId)]
        if (!enc) return reject('Không tìm thấy lượt khám')
        const existing = new Set((enc.danh_sach_chi_dinh || []).filter((o) => o.trang_thai !== 'da_huy').map((o) => String(o.dich_vu_id)))
        if (demoMode) {
            if (!enc.luot_kham_server_id) return reject('Cần bắt đầu khám trước khi gửi chỉ định.')
            for (const id of new Set(dichVuIds.map(Number))) {
                if (!existing.has(String(id))) {
                    await this.post(`/api/v1/clinical/encounters/${enc.luot_kham_server_id}/orders`, { dich_vu_id: id })
                }
            }
            const ticket = db.queue.find((item) => item.encounter_id === encounterId)
            if (ticket) {
                await this.persistToPostgres({
                    queue: [{ ...ticket, trang_thai: 'tam_hoan', ghi_chu: 'Chờ kết quả Cận lâm sàng' }],
                })
            }
            await this.reloadFromPostgres()
            return delay(db.encounters[encounterId]?.danh_sach_chi_dinh || [])
        }
        const allServices = (await this.getServicesCatalog()) || []
        dichVuIds
            .filter((id) => !existing.has(String(id)))
            .forEach((id) => {
                const s = allServices.find((x) => String(x.id) === String(id))
                if (!s) return
                enc.danh_sach_chi_dinh.push({
                    id: db.nextId++,
                    luot_kham_id: encounterId,
                    dich_vu_id: s.id,
                    ma_dich_vu: s.ma_dich_vu,
                    ten_dich_vu: s.ten_dich_vu,
                    nhom_dich_vu: s.nhom_dich_vu,
                    trang_thai: 'da_chi_dinh',
                    ket_qua_phan_loai: null,
                    ket_qua_chi_tiet: null,
                    tep_dinh_kem_url: null,
                    thoi_gian_chi_dinh: new Date().toISOString(),
                })
            })
        const ticket = db.queue.find(
            (t) =>
                String(t.encounter_id) === String(encounterId) ||
                (enc?.lich_kham_id && String(t.ticket_id) === String(enc.lich_kham_id)) ||
                (enc?.ticket_id && String(t.ticket_id) === String(enc.ticket_id)) ||
                (enc?.benh_nhan?.id && String(t.patient_id) === String(enc.benh_nhan.id))
        )
        if (ticket) {
            ticket.trang_thai = 'tam_hoan'
            ticket.ghi_chu = 'Chờ kết quả Cận lâm sàng'
        }

        try {
            await this.syncOrdersToServer(enc)
        } catch (e) {
            enc.danh_sach_chi_dinh = (enc.danh_sach_chi_dinh || []).filter((o) => Boolean(o.server_order_id))
            throw e
        }
        await this.persistToPostgres()
        try {
            clinicalEventBridge.emit(CLINICAL_EVENTS.CLS_ORDERED, {
                encounterId,
                orders: enc.danh_sach_chi_dinh,
            })
        } catch (e) {
            console.warn('Bridge emit CLS_ORDERED error:', e)
        }
        return delay(enc.danh_sach_chi_dinh)
    }

    cancelOrder = async (encounterId, orderId) => {
        const enc = db.encounters[encounterId] || db.encounters[String(encounterId)]
        const o = enc?.danh_sach_chi_dinh?.find((x) => x.id === orderId)
        if (!o) return reject('Không tìm thấy chỉ định')
        if (o.trang_thai !== 'da_chi_dinh') return reject('Chỉ hủy được chỉ định chưa thực hiện.')
        if (o.server_order_id) {
            await this.post(`/api/v1/subclinical/orders/${o.server_order_id}/cancel?ly_do=${encodeURIComponent('Bác sĩ hủy chỉ định')}`, {})
        }
        enc.danh_sach_chi_dinh = enc.danh_sach_chi_dinh.filter((x) => x.id !== orderId)
        await this.persistToPostgres()
        return delay(enc.danh_sach_chi_dinh)
    }

    completeEncounter = async (encounterId, payload) => {
        const enc = db.encounters[encounterId] || db.encounters[String(encounterId)]
        if (!enc) return reject('Không tìm thấy lượt khám')
        const primary = (payload.danh_sach_chan_doan || []).filter((d) => d.loai_chan_doan === 'chinh')
        if (primary.length !== 1) return reject('Cần đúng 1 chẩn đoán chính (ICD-10) trước khi hoàn tất khám.')
        const pendingOrders = (enc.danh_sach_chi_dinh || []).filter(
            (o) => o.trang_thai !== 'da_huy' && o.trang_thai !== 'da_co_ket_qua'
        )
        const ticket = db.queue.find(
            (t) =>
                String(t.encounter_id) === String(encounterId) ||
                (enc?.lich_kham_id && String(t.ticket_id) === String(enc.lich_kham_id)) ||
                (enc?.ticket_id && String(t.ticket_id) === String(enc.ticket_id)) ||
                (enc?.benh_nhan?.id && String(t.patient_id) === String(enc.benh_nhan.id))
        )
        if (ticket?.trang_thai === 'tam_hoan' || pendingOrders.length > 0) {
            return reject(
                `Không thể hoàn tất lượt khám: còn ${pendingOrders.length} chỉ định cận lâm sàng đang thực hiện dở dang chưa có kết quả.`
            )
        }
        if (demoMode) {
            if (!enc.luot_kham_server_id) return reject('Cần bắt đầu khám trước khi hoàn tất.')
            await this.persistToPostgres({ encounters: { [encounterId]: payload } })
            await this.post(`/api/v1/clinical/encounters/${enc.luot_kham_server_id}/complete`, {
                ket_luan_dieu_tri: payload.ket_luan_dieu_tri,
                loi_dan_bac_si: payload.loi_dan_bac_si,
                ngay_hen_tai_kham: payload.ngay_hen_tai_kham,
            })
            await this.reloadFromPostgres()
            clinicalEventBridge.emit(CLINICAL_EVENTS.ENCOUNTER_COMPLETED, { encounterId })
            return delay(db.encounters[encounterId])
        }
        Object.assign(enc, payload, { is_locked: true, thoi_gian_khoa: new Date().toISOString() })
        if (ticket) {
            ticket.trang_thai = 'da_kham'
            ticket.ghi_chu = 'Đã khám xong'
        }
        await this.persistToPostgres()

        let newVoucher = null
        try {
            const examFee = 150000
            const invoiceItems = [
                {
                    ten: 'Công khám chuyên khoa ' + (enc.ai_triage?.ten_chuyen_khoa || 'Nội tổng quát'),
                    soLuong: 1,
                    donGia: examFee,
                    soTien: examFee,
                    loai: 'KHAM',
                },
            ]

            const servicesCatalog = (await this.getServicesCatalog()) || []
            ;(enc.danh_sach_chi_dinh || []).forEach((cls) => {
                const s = servicesCatalog.find((x) => String(x.id) === String(cls.dich_vu_id) || x.ma_dich_vu === cls.ma_dich_vu)
                const price = s?.don_gia || 180000
                invoiceItems.push({
                    ten: cls.ten_dich_vu,
                    soLuong: 1,
                    donGia: price,
                    soTien: price,
                    loai: 'CLS',
                })
            })

            const drugsList = payload.don_thuoc?.danh_sach_thuoc || []
            let totalDrugFee = 0
            drugsList.forEach((d) => {
                const qty = Number(d.so_luong) || 10
                const price = Number(d.don_gia) || 8500
                const itemTotal = qty * price
                totalDrugFee += itemTotal
                invoiceItems.push({
                    ten: `${d.ten_thuoc} (${d.ham_luong || ''})`,
                    soLuong: qty,
                    donGia: price,
                    soTien: itemTotal,
                    loai: 'THUOC',
                })
            })

            const totalAmount = invoiceItems.reduce((sum, item) => sum + item.soTien, 0)
            const voucherCode = `PT26102600${Math.floor(100 + Math.random() * 900)}`

            newVoucher = {
                id: `PT-${Date.now().toString().slice(-6)}`,
                maPhieu: voucherCode,
                loaiPhieu: 'Phiếu thu',
                tenPhieu: `Thu viện phí & tiền thuốc - BN ${enc.benh_nhan?.ho_ten || 'Vãng lai'}`,
                maBN: enc.benh_nhan?.ma || 'BN-2026',
                hoTenBN: enc.benh_nhan?.ho_ten || 'Bệnh nhân',
                ngayThu: new Date().toISOString().replace('T', ' ').slice(0, 16),
                nguoiThu: 'Phạm Thu Nga (Thu ngân)',
                hinhThuc: 'Chuyển khoản',
                daThu: false, 
                ghiChu: `Khoa: ${enc.ai_triage?.ten_chuyen_khoa || 'Nội tổng quát'} · Bác sĩ: ${enc.bac_si_kham || 'BS. CKI Trần Quốc Huy'} · Đơn: ${payload.don_thuoc?.ma_don_thuoc_quoc_gia || 'DTQG-2026'}`,
                items: invoiceItems,
                tongTien: totalAmount,
                encounterId: enc.id,
                tienKham: examFee,
                tienCls: invoiceItems.filter((i) => i.loai === 'CLS').reduce((s, i) => s + i.soTien, 0),
                tienThuoc: totalDrugFee,
                thuocTaiPhongKham: true,
            }

            const ADMIN_STORE_KEY = 'CLINIC_AI_MANAGEMENT_DB_V2_PROMAX'
            const rawAdminStore = localStorage.getItem(ADMIN_STORE_KEY)
            if (rawAdminStore) {
                const adminStore = JSON.parse(rawAdminStore)
                if (adminStore && Array.isArray(adminStore.vouchers)) {
                    adminStore.vouchers.unshift(newVoucher)
                    localStorage.setItem(ADMIN_STORE_KEY, JSON.stringify(adminStore))
                }
            }

            const PATIENT_HISTORY_KEY = 'clinic_patient_completed_encounters_v1'
            const rawPatientHist = localStorage.getItem(PATIENT_HISTORY_KEY)
            const historyList = rawPatientHist ? JSON.parse(rawPatientHist) : []
            historyList.unshift({
                ...enc,
                voucherCode,
                ngay_kham: new Date().toISOString().slice(0, 10),
            })
            localStorage.setItem(PATIENT_HISTORY_KEY, JSON.stringify(historyList.slice(0, 50)))

            clinicalEventBridge.emit(CLINICAL_EVENTS.ENCOUNTER_COMPLETED, {
                encounterId,
                voucher: newVoucher,
                encounter: enc,
            })
        } catch (err) {
            console.warn('Error syncing completed encounter to cashier & portal:', err)
        }

        return delay(enc)
    }

    createAmendment = async (encounterId, payload) => {
        if (!db.encounters[encounterId]?.is_locked) return reject('Chỉ tạo biên bản đính chính cho bệnh án đã khóa.')
        const amendment = { id: db.nextId++, trang_thai: 'CHO_PHE_DUYET', ...payload }
        await this.persistToPostgres()
        return delay(amendment)
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
        if (demoMode) {
            const res = await this.get('/api/v1/medical/services', { __skipGlobalLoading: true })
            return res?.data?.data || []
        }
        try {
            const res = await this.get('/api/v1/medical/services', { __skipGlobalLoading: true })
            if (res?.data?.data && res.data.data.length > 0) return res.data.data
        } catch {
        }
        return delay(FALLBACK_SERVICES, 100)
    }

    getServicesCatalog = async () => {
        const res = await this.getServices()
        return Array.isArray(res) ? res : res?.data || []
    }

    searchIcd10 = async (keyword) => {
        try {
            const q = String(keyword || '').trim()
            const res = await this.get(`/api/v1/medical/icd10?keyword=${encodeURIComponent(q)}&limit=25`, { __skipGlobalLoading: true })
            if (Array.isArray(res?.data?.data)) return res.data.data
        } catch {
        }
        const q = String(keyword || '').trim().toLowerCase()
        const result = FALLBACK_ICD10.filter((x) => x.ma.toLowerCase().includes(q) || x.ten.toLowerCase().includes(q)).slice(0, 15)
        return delay(result, 50)
    }

    searchDrugs = async (keyword) => {
        try {
            const q = String(keyword || '').trim()
            const res = await this.get(`/api/v1/medical/drugs?keyword=${encodeURIComponent(q)}&limit=25`, { __skipGlobalLoading: true })
            if (Array.isArray(res?.data?.data)) return res.data.data
        } catch {
        }
        const q = String(keyword || '').trim().toLowerCase()
        const result = FALLBACK_DRUGS.filter((x) => x.ten_thuoc.toLowerCase().includes(q) || x.hoat_chat.toLowerCase().includes(q)).slice(0, 15)
        return delay(result, 100)
    }

    getClsWorklist = async ({ nhom, tuKhoa, ngay, tatCaNgay } = {}) => {
        if (!demoMode) await this.hydrateFromPostgres()
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
        const items = res?.data?.data?.items || []
        return { data: items.filter((it) => it.trang_thai !== 'da_huy').map(toWorklistItem) }
    }

    startOrder = async (orderId) => {
        const res = await this.post(`/api/v1/subclinical/orders/${orderId}/start`, {})
        const trangThai = res?.data?.data?.trang_thai || 'dang_thuc_hien'
        if (demoMode) return { data: { id: orderId, trang_thai: trangThai } }
        await this.reloadFromPostgres()
        const mirror = findMirrorOrder(orderId)
        if (mirror && mirror.order.trang_thai === 'da_chi_dinh') {
            mirror.order.trang_thai = trangThai
            await this.persistToPostgres()
        }
        return { data: { id: orderId, trang_thai: trangThai } }
    }

    submitOrderResult = async (orderId, payload) => {
        const final = payload.trang_thai === 'da_co_ket_qua'
        let trangThai = payload.trang_thai
        const imaging = payload.ket_qua_chi_tiet?.loai === 'CDHA'
        if (imaging) {
            const res = await this.saveImagingResult(orderId, payload, final)
            trangThai = res?.data?.data?.trang_thai || trangThai
        }
        if (final && !imaging) {
            const detail = payload.ket_qua_chi_tiet
            const res = await this.post(`/api/v1/subclinical/orders/${orderId}/results`, {
                ket_qua_chi_tiet: typeof detail === 'string' ? detail : JSON.stringify(detail ?? {}),
                ket_qua_phan_loai: payload.ket_qua_phan_loai || 'BINH_THUONG',
                tri_so_chi_tiet: detail && typeof detail === 'object' ? detail : {},
                file_dinh_kem_urls: payload.tep_dinh_kem_url ? [payload.tep_dinh_kem_url] : [],
            })
            trangThai = res?.data?.data?.trang_thai || trangThai
        }
        const result = { ...payload, id: orderId, trang_thai: trangThai }
        if (final) result.thoi_gian_tra_ket_qua = new Date().toISOString()

        if (!demoMode) await this.reloadFromPostgres()
        const mirror = demoMode ? null : findMirrorOrder(orderId)
        if (mirror) {
            const patch = { ...result }
            delete patch.id
            Object.assign(mirror.order, patch)
            const ticket = final ? db.queue.find((t) => t.encounter_id === mirror.enc.id) : null
            if (ticket) {
                ticket.trang_thai = 'co_ket_qua_cls'
                ticket.muc_do_uu_tien = 0 
                ticket.ghi_chu = `⭐ CÓ KQ CLS: ${mirror.order.ten_dich_vu}`
            }
            await this.persistToPostgres()
        }

        if (final) {
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
        try {
            const res = await this.get(`/api/v1/clinical/encounters/${encounterId}/specialty/${deptCode}`)
            return res?.data?.data ?? null
        } catch {
            return db.encounters[encounterId]?.specialtyExams?.[deptCode] || null
        }
    }

    getAllSpecialtyExams = async (encounterId) => {
        try {
            const res = await this.get(`/api/v1/clinical/encounters/${encounterId}/specialties`)
            return res?.data?.data ?? {}
        } catch {
            return db.encounters[encounterId]?.specialtyExams || {}
        }
    }

    saveSpecialtyExam = async (encounterId, deptCode, data) => {
        try {
            const res = await this.put(`/api/v1/clinical/encounters/${encounterId}/specialty/${deptCode}`, { data })
            if (db.encounters[encounterId]) {
                db.encounters[encounterId].specialtyExams = {
                    ...(db.encounters[encounterId].specialtyExams || {}),
                    [deptCode]: res?.data?.data ?? data,
                }
                await this.persistToPostgres()
            }
            return res?.data?.data ?? data
        } catch {
            if (db.encounters[encounterId]) {
                db.encounters[encounterId].specialtyExams = {
                    ...(db.encounters[encounterId].specialtyExams || {}),
                    [deptCode]: data,
                }
                await this.persistToPostgres()
            }
            return data
        }
    }

    copyOldPrescription = async (encounterId, sourcePrescriptionId, fallbackItems = []) => {
        try {
            const res = await this.post(
                `/api/v1/clinical/encounters/${encounterId}/copy-prescription/${sourcePrescriptionId}`,
                {}
            )
            return res?.data?.data
        } catch {
            const enc = db.encounters[encounterId]
            if (enc && fallbackItems.length) {
                enc.don_thuoc = {
                    id: db.nextId++,
                    trang_thai: 'NHAP',
                    ghi_chu_don_thuoc: `[Sao chép từ đơn thuốc cũ #${sourcePrescriptionId}]`,
                    danh_sach_chi_tiet: structuredClone(fallbackItems),
                }
                await this.persistToPostgres()
                return enc.don_thuoc
            }
            return null
        }
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
