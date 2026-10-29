import { BaseServices } from '../BaseService'
import { clinicalEventBridge, CLINICAL_EVENTS } from '../clinicalEventBridge'
// Connected to Backend PostgreSQL / SQLite API (/api/v1/clinical & /api/v1/medical)

export const USE_MOCK = false
const WORKSPACE_STORAGE_KEY = 'clinic_doctor_workspace_v1'

const loadInitialDb = () => {
    try {
        const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY)
        if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed && parsed.encounters && Array.isArray(parsed.queue)) {
                return {
                    encounters: parsed.encounters,
                    queue: parsed.queue,
                    extraOrders: Array.isArray(parsed.extraOrders) ? parsed.extraOrders : structuredClone(MOCK_EXTRA_ORDERS),
                    nextId: Number(parsed.nextId) || 9500,
                }
            }
        }
    } catch {
        // Ignore parse error and fallback to seed
    }
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
        (enc.danh_sach_chi_dinh || []).map((o) => ({
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
        const o = (enc.danh_sach_chi_dinh || []).find((x) => x.id === orderId)
        if (o) return o
    }
    return db.extraOrders.find((x) => x.id === orderId)
}

export class ClinicalService extends BaseServices {
    _hydratedFromPg = false

    constructor() {
        super()
        this.hydrateFromPostgres()
    }

    // ── Đồng bộ 2 chiều với PostgreSQL (/api/v1/clinical/workspace-state) ──
    hydrateFromPostgres = async () => {
        if (this._hydratedFromPg) return
        this._hydratedFromPg = true
        try {
            const res = await this.get('/api/v1/clinical/workspace-state', { __skipGlobalLoading: true })
            const remote = res?.data?.data
            if (remote && remote.encounters && Array.isArray(remote.queue)) {
                db.encounters = remote.encounters
                db.queue = remote.queue
                db.extraOrders = Array.isArray(remote.extraOrders) ? remote.extraOrders : db.extraOrders
                db.nextId = Number(remote.nextId) || db.nextId
                localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(db))
            } else {
                await this.persistToPostgres()
            }
        } catch {
            // Backend chưa sẵn sàng hoặc đang khởi động -> dùng bản lưu localStorage
        }
    }

    persistToPostgres = async () => {
        try {
            localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(db))
        } catch {
            // Ignore storage quota errors
        }
        try {
            await this.put('/api/v1/clinical/workspace-state', db, { __skipGlobalLoading: true })
        } catch {
            // Giữ dữ liệu ở localStorage nếu mất kết nối tạm thời
        }
    }

    syncWithReceptionQueue = () => {
        try {
            const rawQueue = localStorage.getItem('clinic_reception_queue_v1')
            const rawPatients = localStorage.getItem('clinic_reception_patients_v1')
            if (!rawQueue || !rawPatients) return

            const receptionQueue = JSON.parse(rawQueue)
            const receptionPatients = JSON.parse(rawPatients)
            if (!Array.isArray(receptionQueue) || !Array.isArray(receptionPatients)) return

            let addedAny = false
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
                    addedAny = true
                }
            })
            if (addedAny) {
                this.persistToPostgres()
            }
        } catch (e) {
            console.warn('Sync reception queue error:', e)
        }
    }

    // ── Hàng đợi ──────────────────────────────────────────────────────────
    getMyQueue = async () => {
        await this.hydrateFromPostgres()
        this.syncWithReceptionQueue()
        return delay(db.queue.map(ticketToQueueItem))
    }

    callNext = async () => {
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
        await this.persistToPostgres()
        return delay(ticketToQueueItem(next))
    }

    recall = async (ticketId) => {
        const t = db.queue.find((x) => x.ticket_id === ticketId)
        if (!t) return reject('Không tìm thấy số thứ tự')
        t.so_lan_goi += 1
        await this.persistToPostgres()
        return delay(ticketToQueueItem(t))
    }

    postponeTicket = async (ticketId, reason = 'Chờ kết quả Cận lâm sàng') => {
        const t = db.queue.find((x) => x.ticket_id === ticketId || x.encounter_id === ticketId)
        if (!t) return reject('Không tìm thấy lượt khám')
        t.trang_thai = 'tam_hoan'
        t.ghi_chu = reason
        await this.persistToPostgres()
        return delay(ticketToQueueItem(t))
    }

    // ── Lượt khám ─────────────────────────────────────────────────────────
    getEncounter = async (encounterId) => {
        await this.hydrateFromPostgres()
        try {
            return delay(getEncounterOrThrow(encounterId))
        } catch (e) {
            return reject(e.message)
        }
    }

    saveEncounterDraft = async (encounterId, patch) => {
        const enc = db.encounters[encounterId]
        if (!enc) return reject('Không tìm thấy lượt khám')
        if (enc.is_locked) return reject('Bệnh án đã khóa, không thể sửa.')
        Object.assign(enc, patch)
        await this.persistToPostgres()
        return delay({ saved_at: new Date().toISOString() }, 120)
    }

    createOrders = async (encounterId, dichVuIds) => {
        const enc = db.encounters[encounterId]
        if (!enc) return reject('Không tìm thấy lượt khám')
        const existing = new Set((enc.danh_sach_chi_dinh || []).filter((o) => o.trang_thai !== 'da_huy').map((o) => o.dich_vu_id))
        const allServices = (await this.getServicesCatalog()) || []
        dichVuIds
            .filter((id) => !existing.has(id))
            .forEach((id) => {
                const s = allServices.find((x) => x.id === id)
                if (!s) return
                enc.danh_sach_chi_dinh.push({
                    id: db.nextId++,
                    luot_kham_id: encounterId,
                    dich_vu_id: s.id,
                    ma_dich_vu: s.ma_dich_vu,
                    ten_dich_vu: s.ten_dich_vu,
                    nhom_dich_vu: s.nhom_dich_vu,
                    trang_thai: 'CHO_THUC_HIEN',
                    ket_qua_phan_loai: null,
                    ket_qua_chi_tiet: null,
                    tep_dinh_kem_url: null,
                    thoi_gian_chi_dinh: new Date().toISOString(),
                })
            })
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
        const enc = db.encounters[encounterId]
        const o = enc?.danh_sach_chi_dinh?.find((x) => x.id === orderId)
        if (!o) return reject('Không tìm thấy chỉ định')
        if (o.trang_thai !== 'CHO_THUC_HIEN' && o.trang_thai !== 'da_chi_dinh') return reject('Chỉ hủy được chỉ định chưa thực hiện.')
        const oldList = enc.danh_sach_chi_dinh
        enc.danh_sach_chi_dinh = enc.danh_sach_chi_dinh.filter((x) => x.id !== orderId)
        try {
            await this.persistToPostgres()
            return delay(enc.danh_sach_chi_dinh)
        } catch (err) {
            enc.danh_sach_chi_dinh = oldList
            throw err
        }
    }

    completeEncounter = async (encounterId, payload) => {
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
        await this.persistToPostgres()

        // ── Tự động tạo Phiếu thu Viện phí sang Quầy Thu ngân (Cashier) ──
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

            // Tiền dịch vụ CLS
            const servicesCatalog = (await this.getServicesCatalog()) || []
            ;(enc.danh_sach_chi_dinh || []).forEach((cls) => {
                const s = servicesCatalog.find((x) => x.id === cls.dich_vu_id || x.ma_dich_vu === cls.ma_dich_vu)
                const price = s?.don_gia || 180000
                invoiceItems.push({
                    ten: cls.ten_dich_vu,
                    soLuong: 1,
                    donGia: price,
                    soTien: price,
                    loai: 'CLS',
                })
            })

            // Tiền thuốc
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
                daThu: false, // Trạng thái Chờ thu (Pending)
                ghiChu: `Khoa: ${enc.ai_triage?.ten_chuyen_khoa || 'Nội tổng quát'} · Bác sĩ: ${enc.bac_si_kham || 'BS. CKI Trần Quốc Huy'} · Đơn: ${payload.don_thuoc?.ma_don_thuoc_quoc_gia || 'DTQG-2026'}`,
                items: invoiceItems,
                tongTien: totalAmount,
                encounterId: enc.id,
                tienKham: examFee,
                tienCls: invoiceItems.filter((i) => i.loai === 'CLS').reduce((s, i) => s + i.soTien, 0),
                tienThuoc: totalDrugFee,
                thuocTaiPhongKham: true,
            }

            // Ghi vào store Admin DB
            const ADMIN_STORE_KEY = 'CLINIC_AI_MANAGEMENT_DB_V2_PROMAX'
            const rawAdminStore = localStorage.getItem(ADMIN_STORE_KEY)
            if (rawAdminStore) {
                const adminStore = JSON.parse(rawAdminStore)
                if (adminStore && Array.isArray(adminStore.vouchers)) {
                    adminStore.vouchers.unshift(newVoucher)
                    localStorage.setItem(ADMIN_STORE_KEY, JSON.stringify(adminStore))
                }
            }

            // Lưu ca khám hoàn tất vào Cổng bệnh nhân
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
        if (enc) enc.danh_gia_ai = payload
        await this.persistToPostgres()
        return delay(payload, 150)
    }

    // ── Danh mục Thực tế từ PostgreSQL ──────────────────────────────────
    getServices = async () => {
        try {
            const res = await this.get('/api/v1/medical/services')
            if (res?.data?.data && res.data.data.length > 0) return res.data.data
        } catch {
            // Dự phòng offline
        }
        return delay(MOCK_SERVICES, 100)
    }

    searchIcd10 = async (keyword) => {
        try {
            const q = String(keyword || '').trim()
            const res = await this.get(`/api/v1/medical/icd10?keyword=${encodeURIComponent(q)}&limit=25`)
            if (res?.data?.data && res.data.data.length > 0) return res.data.data
        } catch {
            // Dự phòng offline
        }
        const q = String(keyword || '').trim().toLowerCase()
        const result = MOCK_ICD10.filter((x) => x.ma.toLowerCase().includes(q) || x.ten.toLowerCase().includes(q)).slice(0, 15)
        return delay(result, 100)
    }

    searchDrugs = async (keyword) => {
        try {
            const q = String(keyword || '').trim()
            const res = await this.get(`/api/v1/medical/drugs?keyword=${encodeURIComponent(q)}&limit=25`)
            if (res?.data?.data && res.data.data.length > 0) return res.data.data
        } catch {
            // Dự phòng offline
        }
        const q = String(keyword || '').trim().toLowerCase()
        const result = MOCK_DRUGS.filter((x) => x.ten_thuoc.toLowerCase().includes(q) || x.hoat_chat.toLowerCase().includes(q)).slice(0, 15)
        return delay(result, 100)
    }

    // ── Cận lâm sàng ──────────────────────────────────────────────────────
    getClsWorklist = async (nhomDichVu) => {
        await this.hydrateFromPostgres()
        const list = allOrders()
            .filter((o) => o.nhom_dich_vu === nhomDichVu && o.trang_thai !== 'da_huy')
            .sort((a, b) => a.thoi_gian_chi_dinh.localeCompare(b.thoi_gian_chi_dinh))
        return delay(list)
    }

    startOrder = async (orderId) => {
        const o = findOrder(orderId)
        if (!o) return reject('Không tìm thấy chỉ định')
        const oldStatus = o.trang_thai
        if (o.trang_thai === 'CHO_THUC_HIEN' || o.trang_thai === 'da_chi_dinh') o.trang_thai = 'dang_thuc_hien'
        try {
            await this.persistToPostgres()
            return delay(o, 150)
        } catch (err) {
            o.trang_thai = oldStatus
            throw err
        }
    }

    submitOrderResult = async (orderId, payload) => {
        const o = findOrder(orderId)
        if (!o) return reject('Không tìm thấy chỉ định')
        Object.assign(o, payload, { thoi_gian_tra_ket_qua: new Date().toISOString() })

        // Tìm encounter chứa chỉ định này và cập nhật hàng đợi
        let targetEncounter = null
        for (const enc of Object.values(db.encounters)) {
            if ((enc.danh_sach_chi_dinh || []).some((x) => x.id === orderId)) {
                targetEncounter = enc
                break
            }
        }

        if (targetEncounter) {
            const ticket = db.queue.find((t) => t.encounter_id === targetEncounter.id)
            if (ticket) {
                ticket.trang_thai = 'co_ket_qua_cls'
                ticket.muc_do_uu_tien = 0 // Ưu tiên cao nhất để lên đầu danh sách
                ticket.ghi_chu = `⭐ CÓ KQ CLS: ${o.ten_dich_vu}`
            }
        }

        await this.persistToPostgres()

        try {
            clinicalEventBridge.emit(CLINICAL_EVENTS.CLS_RESULT_RETURNED, {
                orderId,
                order: o,
                encounterId: targetEncounter?.id,
            })
        } catch (e) {
            console.warn('Bridge emit CLS_RESULT_RETURNED error:', e)
        }

        return delay(o)
    }

    uploadFile = (file) => {
        return delay({ url: URL.createObjectURL(file), ten_tep: file.name }, 300)
    }

    // ── Khám Chuyên Khoa 2 Tầng (5 Bảng Chuyên Khoa Độc Lập) ──────────────
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

    // ── Sao chép đơn thuốc cũ 1-chạm (Kế thừa từ TheDuckHospital OldPrescription) ──
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
}

export const clinicalService = new ClinicalService()
export default clinicalService
