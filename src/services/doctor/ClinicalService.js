import { BaseServices } from '../BaseService'
import {
    MOCK_SERVICES,
    MOCK_ICD10,
    MOCK_DRUGS,
    MOCK_ENCOUNTERS,
    MOCK_QUEUE,
    MOCK_EXTRA_ORDERS,
} from './clinicalMockData'

// Giai đoạn dựng giao diện: mặc định dùng dữ liệu giả. Đặt VITE_USE_MOCK=false khi backend sẵn sàng.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

// Kho dữ liệu giả trong bộ nhớ (mất khi tải lại trang)
const db = {
    encounters: structuredClone(MOCK_ENCOUNTERS),
    queue: structuredClone(MOCK_QUEUE),
    extraOrders: structuredClone(MOCK_EXTRA_ORDERS),
    nextId: 9500,
}

const delay = (value, ms = 300) =>
    new Promise((resolve) => setTimeout(() => resolve({ data: structuredClone(value) }), ms))

const reject = (message, ms = 300) =>
    new Promise((_, rejectFn) => setTimeout(() => rejectFn({ message }), ms))

const getEncounterOrThrow = (id) => {
    const enc = db.encounters[id]
    if (!enc) throw { message: 'Không tìm thấy lượt khám' }
    return enc
}

const ticketToQueueItem = (t) => {
    const enc = t.encounter_id ? db.encounters[t.encounter_id] : null
    const bn = enc ? enc.benh_nhan : t.benh_nhan
    return {
        ...t,
        ten_benh_nhan: bn?.ho_ten,
        gioi_tinh: bn?.gioi_tinh,
        tuoi: bn?.tuoi,
        ly_do: enc?.ai_triage?.trieu_chung_nhap || '',
    }
}

// Danh sách chỉ định CLS của mọi bệnh nhân trong ngày
const allOrders = () => {
    const fromEncounters = Object.values(db.encounters).flatMap((enc) =>
        enc.danh_sach_chi_dinh.map((o) => ({
            ...o,
            benh_nhan: enc.benh_nhan,
            ly_do: enc.ly_do_vao_kham || enc.ai_triage?.trieu_chung_nhap,
            bac_si_chi_dinh: 'BS. Dung',
        }))
    )
    return [...fromEncounters, ...db.extraOrders]
}

const findOrder = (orderId) => {
    for (const enc of Object.values(db.encounters)) {
        const o = enc.danh_sach_chi_dinh.find((x) => x.id === orderId)
        if (o) return o
    }
    return db.extraOrders.find((x) => x.id === orderId)
}

export class ClinicalService extends BaseServices {
    syncWithReceptionQueue = () => {
        try {
            const rawQueue = localStorage.getItem('clinic_reception_queue_v1')
            const rawPatients = localStorage.getItem('clinic_reception_patients_v1')
            if (!rawQueue || !rawPatients) return

            const receptionQueue = JSON.parse(rawQueue)
            const receptionPatients = JSON.parse(rawPatients)
            if (!Array.isArray(receptionQueue) || !Array.isArray(receptionPatients)) return

            // Tìm những bệnh nhân lễ tân vừa check-in chưa có trong queue của bác sĩ
            receptionQueue.forEach((entry) => {
                const ticketKey = entry.ticketNumber || entry.id
                const exists = db.queue.some(
                    (q) => q.ticket_code === ticketKey || q.so_thu_tu_kham === ticketKey || (entry.patientId && q.patient_id === entry.patientId)
                )
                if (!exists && entry.status === 'WAITING') {
                    const pat = receptionPatients.find((p) => p.id === entry.patientId) || {}
                    const birthYear = pat.dateOfBirth ? parseInt(pat.dateOfBirth.slice(0, 4), 10) : 1990
                    const currentYear = new Date().getFullYear()
                    const age = !isNaN(birthYear) ? currentYear - birthYear : 35

                    const newEncounterId = 6000 + (db.queue.length + 1)
                    const newTicketId = 400 + (db.queue.length + 1)

                    const patientObj = {
                        id: pat.id || entry.patientId,
                        ma: pat.patientCode || `BN-2026-${String(newTicketId).padStart(4, '0')}`,
                        ho_ten: pat.fullName || 'Bệnh nhân Tiếp đón',
                        gioi_tinh: pat.gender === 'MALE' ? 'Nam' : 'Nữ',
                        tuoi: age,
                        di_ung_thuoc: pat.allergies || '',
                        so_lan_kham: pat.visitCount || 1,
                    }

                    db.encounters[newEncounterId] = {
                        id: newEncounterId,
                        lich_kham_id: entry.appointmentId || newTicketId,
                        ma_lich_kham: `LK-${ticketKey}`,
                        benh_nhan: patientObj,
                        ai_triage: {
                            trieu_chung_nhap: entry.notes || 'Khám tổng quát và sàng lọc theo chỉ định',
                            ten_chuyen_khoa: 'Nội tổng quát',
                            ma_chuyen_khoa: 'NOI_CHUNG',
                            do_tin_cay: 0.85,
                            co_dau_hieu_cap_cuu: entry.priority === 'EMERGENCY',
                        },
                        chuyen_khoa_kham: 'NOI_CHUNG',
                        kham_chuyen_khoa: null,
                        thoi_gian_bat_dau: null,
                        ly_do_vao_kham: entry.notes || 'Khám theo lịch hẹn hoặc đăng ký tiếp đón tại Lễ tân',
                        benh_su: '',
                        kham_lam_sang_bo_phan: '',
                        nhiet_do_c: '36.8',
                        mach_lan_phut: '76',
                        huyet_ap_tam_thu: '120',
                        huyet_ap_tam_truong: '80',
                        nhip_tho_lan_phut: '18',
                        can_nang_kg: '',
                        chieu_cao_cm: '',
                        ket_luan_dieu_tri: '',
                        loi_dan_bac_si: '',
                        ngay_hen_tai_kham: '',
                        danh_sach_chan_doan: [],
                        danh_sach_chi_dinh: [],
                        don_thuoc: { loi_dan_uong_thuoc: '', danh_sach_thuoc: [] },
                        danh_gia_ai: null,
                        is_locked: false,
                        thoi_gian_khoa: null,
                        lich_su: [],
                    }

                    db.queue.push({
                        ticket_id: newTicketId,
                        encounter_id: newEncounterId,
                        ticket_code: ticketKey,
                        patient_id: entry.patientId,
                        so_thu_tu_kham: ticketKey,
                        muc_do_uu_tien: entry.priority === 'EMERGENCY' ? 1 : entry.priority === 'PRIORITY' ? 2 : 4,
                        trang_thai: 'cho_kham',
                        so_lan_goi: 0,
                        ghi_chu: `Check-in Lễ tân lúc ${entry.checkInTime || 'hôm nay'} · ${ticketKey}`,
                        benh_nhan: patientObj,
                    })
                }
            })
        } catch (e) {
            console.warn('Sync reception queue error:', e)
        }
    }

    // ── Hàng đợi ──────────────────────────────────────────────────────────
    getMyQueue = () => {
        // TODO (Backend Integration): this.get('/api/v1/clinical/queue/my-today')
        if (!USE_MOCK) return this.get('/api/v1/reception/flow-board')
        this.syncWithReceptionQueue()
        return delay(db.queue.map(ticketToQueueItem))
    }

    callNext = () => {
        // TODO (Backend Integration): this.post('/api/v1/clinical/queue/call-next') rồi POST /clinical/encounters
        if (!USE_MOCK) return this.post('/api/v1/clinical/queue/call-next')
        const current = db.queue.find((t) => t.trang_thai === 'dang_kham')
        if (current) {
            return reject('Đang có bệnh nhân trong phòng khám. Hoàn tất hoặc tạm hoãn trước khi gọi tiếp.')
        }
        const next = db.queue
            .filter((t) => t.trang_thai === 'cho_kham')
            .sort((a, b) => a.muc_do_uu_tien - b.muc_do_uu_tien || a.so_thu_tu_kham - b.so_thu_tu_kham)[0]
        if (!next) return reject('Không còn bệnh nhân chờ khám.')
        next.trang_thai = 'dang_kham'
        next.so_lan_goi += 1
        next.ghi_chu = 'Đang khám'
        const enc = db.encounters[next.encounter_id]
        if (enc && !enc.thoi_gian_bat_dau) enc.thoi_gian_bat_dau = new Date().toISOString()
        return delay(ticketToQueueItem(next))
    }

    recall = (ticketId) => {
        // TODO (Backend Integration): this.post(`/api/v1/clinical/queue/${ticketId}/recall`)
        const t = db.queue.find((x) => x.ticket_id === ticketId)
        if (!t) return reject('Không tìm thấy số thứ tự')
        t.so_lan_goi += 1
        return delay(ticketToQueueItem(t))
    }

    // ── Lượt khám ─────────────────────────────────────────────────────────
    getEncounter = (encounterId) => {
        // TODO (Backend Integration): this.get(`/api/v1/clinical/encounters/${encounterId}/context`)
        if (!USE_MOCK) return this.get(`/api/v1/clinical/encounters/${encounterId}`)
        try {
            return delay(getEncounterOrThrow(encounterId))
        } catch (e) {
            return reject(e.message)
        }
    }

    saveEncounterDraft = (encounterId, patch) => {
        // TODO (Backend Integration): this.patch(`/api/v1/clinical/encounters/${encounterId}`, patch)
        const enc = db.encounters[encounterId]
        if (!enc) return reject('Không tìm thấy lượt khám')
        if (enc.is_locked) return reject('Bệnh án đã khóa, không thể sửa.')
        Object.assign(enc, patch)
        return delay({ saved_at: new Date().toISOString() }, 200)
    }

    createOrders = (encounterId, dichVuIds) => {
        // TODO (Backend Integration): this.post(`/api/v1/clinical/encounters/${encounterId}/orders`, { dich_vu_ids })
        const enc = db.encounters[encounterId]
        if (!enc) return reject('Không tìm thấy lượt khám')
        const existing = new Set(enc.danh_sach_chi_dinh.filter((o) => o.trang_thai !== 'da_huy').map((o) => o.dich_vu_id))
        dichVuIds
            .filter((id) => !existing.has(id))
            .forEach((id) => {
                const s = MOCK_SERVICES.find((x) => x.id === id)
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
        return delay(enc.danh_sach_chi_dinh)
    }

    cancelOrder = (encounterId, orderId) => {
        // TODO (Backend Integration): this.delete(`/api/v1/clinical/orders/${orderId}`)
        const enc = db.encounters[encounterId]
        const o = enc?.danh_sach_chi_dinh.find((x) => x.id === orderId)
        if (!o) return reject('Không tìm thấy chỉ định')
        if (o.trang_thai !== 'da_chi_dinh') return reject('Chỉ hủy được chỉ định chưa thực hiện.')
        enc.danh_sach_chi_dinh = enc.danh_sach_chi_dinh.filter((x) => x.id !== orderId)
        return delay(enc.danh_sach_chi_dinh)
    }

    completeEncounter = (encounterId, payload) => {
        // TODO (Backend Integration): lưu chẩn đoán/đơn thuốc rồi this.post(`/api/v1/clinical/encounters/${encounterId}/complete`, payload)
        const enc = db.encounters[encounterId]
        if (!enc) return reject('Không tìm thấy lượt khám')
        const primary = (payload.danh_sach_chan_doan || []).filter((d) => d.loai_chan_doan === 'chinh')
        if (primary.length !== 1) return reject('Cần đúng 1 chẩn đoán chính (ICD-10) trước khi hoàn tất khám.')
        Object.assign(enc, payload, { is_locked: true, thoi_gian_khoa: new Date().toISOString() })
        const ticket = db.queue.find((t) => t.encounter_id === encounterId)
        if (ticket) {
            ticket.trang_thai = 'da_kham'
            ticket.ghi_chu = 'Đã khám xong'
        }
        return delay(enc)
    }

    createAmendment = (encounterId, payload) => {
        // TODO (Backend Integration): this.post(`/api/v1/clinical/encounters/${encounterId}/amendments`, payload)
        if (!db.encounters[encounterId]?.is_locked) return reject('Chỉ tạo biên bản đính chính cho bệnh án đã khóa.')
        return delay({ id: db.nextId++, trang_thai: 'CHO_PHE_DUYET', ...payload })
    }

    rateAiSuggestion = (encounterId, payload) => {
        // TODO (Backend Integration): this.post(`/api/v1/ai/analyses/{phan_tich_ai_id}/rating`, payload)
        const enc = db.encounters[encounterId]
        if (enc) enc.danh_gia_ai = payload
        return delay(payload, 150)
    }

    // ── Danh mục ──────────────────────────────────────────────────────────
    getServices = () => {
        // TODO (Backend Integration): this.get('/api/v1/medical/services') kèm nhom_dich_vu
        if (!USE_MOCK) return this.get('/api/v1/medical/services')
        return delay(MOCK_SERVICES, 150)
    }

    searchIcd10 = (keyword) => {
        // TODO (Backend Integration): this.get('/api/v1/medical/icd10', { params: { q: keyword } })
        const q = String(keyword || '').trim().toLowerCase()
        const result = MOCK_ICD10.filter((x) => x.ma.toLowerCase().includes(q) || x.ten.toLowerCase().includes(q)).slice(0, 12)
        return delay(result, 150)
    }

    searchDrugs = (keyword) => {
        // TODO (Backend Integration): chưa có danh mục thuốc ở backend
        const q = String(keyword || '').trim().toLowerCase()
        const result = MOCK_DRUGS.filter((x) => x.ten_thuoc.toLowerCase().includes(q) || x.hoat_chat.toLowerCase().includes(q)).slice(0, 10)
        return delay(result, 150)
    }

    // ── Cận lâm sàng ──────────────────────────────────────────────────────
    getClsWorklist = (nhomDichVu) => {
        // TODO (Backend Integration): this.get('/api/v1/clinical/orders/worklist', { params: { nhom: nhomDichVu } })
        const list = allOrders()
            .filter((o) => o.nhom_dich_vu === nhomDichVu && o.trang_thai !== 'da_huy')
            .sort((a, b) => a.thoi_gian_chi_dinh.localeCompare(b.thoi_gian_chi_dinh))
        return delay(list)
    }

    startOrder = (orderId) => {
        // TODO (Backend Integration): this.post(`/api/v1/clinical/orders/${orderId}/start`)
        const o = findOrder(orderId)
        if (!o) return reject('Không tìm thấy chỉ định')
        if (o.trang_thai === 'da_chi_dinh') o.trang_thai = 'dang_thuc_hien'
        return delay(o, 150)
    }

    submitOrderResult = (orderId, payload) => {
        // TODO (Backend Integration): this.put(`/api/v1/clinical/orders/${orderId}/result`, { ...payload, ket_qua_chi_tiet: JSON.stringify(payload.ket_qua_chi_tiet) })
        const o = findOrder(orderId)
        if (!o) return reject('Không tìm thấy chỉ định')
        Object.assign(o, payload, { thoi_gian_tra_ket_qua: new Date().toISOString() })
        return delay(o)
    }

    uploadFile = (file) => {
        // TODO (Backend Integration): this.post('/api/v1/files/upload', formData) — backend chưa có API upload
        return delay({ url: URL.createObjectURL(file), ten_tep: file.name }, 400)
    }
}

export const clinicalService = new ClinicalService()
export default clinicalService
