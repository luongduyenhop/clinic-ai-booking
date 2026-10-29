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

// ── Cầu nối CLS: chỉ định trên bàn khám (workspace) ↔ bảng chi_dinh thật (/api/v1/subclinical) ──
// Chỉ định đã ghi vào chi_dinh mang server_order_id; KTV thao tác bằng id thật, bàn khám giữ bản sao để hiển thị.
const findMirrorOrder = (serverOrderId) => {
    for (const enc of Object.values(db.encounters)) {
        const o = (enc.danh_sach_chi_dinh || []).find((x) => x.server_order_id === serverOrderId)
        if (o) return { enc, order: o }
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
        // Bản nháp kết quả chưa có cột trong chi_dinh nên lấy từ bản sao trên bàn khám
        ket_qua_chi_tiet: (hasResult && parseResultDetail(item)) || mirror?.ket_qua_chi_tiet || null,
        ket_qua_phan_loai: hasResult ? item.ket_qua_phan_loai : mirror?.ket_qua_phan_loai || null,
        tep_dinh_kem_url: item.file_dinh_kem_urls?.[0] || mirror?.tep_dinh_kem_url || null,
        // Phiếu kết quả: NHAP / DA_CO_KET_QUA (KTV hoàn tất, chờ duyệt) / DA_DUYET
        trang_thai_ket_qua: item.trang_thai_ket_qua || null,
        thoi_gian_duyet: item.thoi_gian_duyet || null,
    }
}

const sameInstant = (a, b) => Boolean(a && b) && Date.parse(a) === Date.parse(b)

// Kết quả đã duyệt từ máy chủ -> các trường của bản sao chỉ định trên bàn khám (cùng cấu trúc ResultView)
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

// Ghi kết quả vào bản sao và đẩy lượt khám lên đầu hàng đợi để bác sĩ gọi lại kết luận
// (bệnh nhân đang ở trong phòng khám thì giữ nguyên trạng thái, không đẩy ra khỏi bàn khám)
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

    // Tải lại bản mới nhất trước khi sửa bản sao, tránh ghi đè thay đổi của máy khác bằng dữ liệu cũ
    reloadFromPostgres = async () => {
        this._hydratedFromPg = false
        await this.hydrateFromPostgres()
    }

    // Ghi các chỉ định chưa có trên server vào bảng chi_dinh; lỗi mạng thì giữ nguyên, lần chỉ định sau gửi lại
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
                    dich_vu_ids: pending.map((o) => o.dich_vu_id),
                },
                { __skipGlobalLoading: true }
            )
            const result = res?.data?.data
            enc.luot_kham_server_id = result?.luot_kham_id
            ;(result?.orders || []).forEach((so) => {
                const o = pending.find((x) => x.dich_vu_id === so.dich_vu_id)
                if (o) {
                    o.server_order_id = so.id
                    o.trang_thai = so.trang_thai
                }
            })
        } catch (e) {
            console.warn('Sync CLS orders to /api/v1/subclinical/workspace-orders error:', e)
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
                    trang_thai: 'da_chi_dinh',
                    ket_qua_phan_loai: null,
                    ket_qua_chi_tiet: null,
                    tep_dinh_kem_url: null,
                    thoi_gian_chi_dinh: new Date().toISOString(),
                })
            })
        await this.syncOrdersToServer(enc)
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
        if (o.trang_thai !== 'da_chi_dinh') return reject('Chỉ hủy được chỉ định chưa thực hiện.')
        if (o.server_order_id) {
            // Hủy cả bản ghi chi_dinh để chỉ định không còn nằm trong hàng đợi KTV (409 nếu KTV đã bắt đầu)
            await this.post(`/api/v1/subclinical/orders/${o.server_order_id}/cancel?ly_do=${encodeURIComponent('Bác sĩ hủy chỉ định')}`, {})
        }
        enc.danh_sach_chi_dinh = enc.danh_sach_chi_dinh.filter((x) => x.id !== orderId)
        await this.persistToPostgres()
        return delay(enc.danh_sach_chi_dinh)
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
            if (res?.data?.data && res.data.data.length > 0) return { data: res.data.data }
        } catch {
            // Dự phòng offline
        }
        return delay(MOCK_SERVICES, 100)
    }

    getServicesCatalog = async () => (await this.getServices())?.data || []

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
    // Hàng đợi KTV đọc từ bảng chi_dinh (GET /api/v1/subclinical/queue); orderId bên dưới là chi_dinh.id thật
    getClsWorklist = async ({ nhom, tuKhoa, ngay } = {}) => {
        await this.hydrateFromPostgres()
        const params = new URLSearchParams({ nhom_dich_vu: nhom, trang_thai: 'tat_ca' })
        if (tuKhoa?.trim()) params.set('tu_khoa', tuKhoa.trim())
        if (ngay) params.set('ngay', ngay)
        const res = await this.get(`/api/v1/subclinical/queue?${params}`, { __skipGlobalLoading: true })
        const items = res?.data?.data?.items || []
        return { data: items.filter((it) => it.trang_thai !== 'da_huy').map(toWorklistItem) }
    }

    startOrder = async (orderId) => {
        const res = await this.post(`/api/v1/subclinical/orders/${orderId}/start`, {})
        const trangThai = res?.data?.data?.trang_thai || 'dang_thuc_hien'
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
        // CĐHA ghi phiếu kết quả riêng (kể cả bản nháp); ảnh đã nằm sẵn trên máy chủ nên không đi qua /results
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
        if (imaging) {
            // CĐHA hoàn tất chỉ là chờ duyệt: bàn khám nhận kết quả khi KTV bấm "Duyệt & Trả kết quả" (approveOrder)
            return { data: { id: orderId, trang_thai: trangThai, trang_thai_ket_qua: final ? 'DA_CO_KET_QUA' : 'NHAP' } }
        }
        const result = { ...payload, id: orderId, trang_thai: trangThai }
        if (final) result.thoi_gian_tra_ket_qua = new Date().toISOString()

        // Cập nhật bản sao trên bàn khám để bác sĩ thấy kết quả và lượt khám được ưu tiên gọi lại
        await this.reloadFromPostgres()
        const mirror = findMirrorOrder(orderId)
        if (mirror) {
            const patch = { ...result }
            delete patch.id
            Object.assign(mirror.order, patch)
            const ticket = final ? db.queue.find((t) => t.encounter_id === mirror.enc.id) : null
            if (ticket) {
                ticket.trang_thai = 'co_ket_qua_cls'
                ticket.muc_do_uu_tien = 0 // Ưu tiên cao nhất để lên đầu danh sách
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

        return { data: result }
    }

    uploadFile = (file) => {
        return delay({ url: URL.createObjectURL(file), ten_tep: file.name }, 300)
    }

    // ── Ảnh kết quả CLS & phiếu Chẩn đoán hình ảnh (lưu trên máy chủ, xem qua API có xác thực) ──
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
            // Bỏ Content-Type JSON mặc định để trình duyệt tự gắn boundary multipart
            headers: { 'Content-Type': 'multipart/form-data' },
            __skipGlobalLoading: true,
            onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded * 100) / e.total) : 0),
        })
    }

    deleteClsImage = (url) => this.delete(url)

    // <img src> không gửi được Bearer token nên tải ảnh thành blob rồi hiển thị bằng object URL
    fetchClsImageBlob = async (url) => {
        const res = await this.get(url, { responseType: 'blob', __skipGlobalLoading: true })
        return res.data
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

    // ── Kết quả xét nghiệm: bộ chỉ số mẫu + đánh giá vượt ngưỡng do backend tính, lưu ở bảng ket_qua_cls ──
    getLabTemplate = async (orderId) => {
        const res = await this.get(`/api/v1/subclinical/orders/${orderId}/lab-template`, { __skipGlobalLoading: true })
        return { data: res?.data?.data }
    }

    // body: { chi_so: { WBC: 11.5, ... }, ket_luan, ghi_chu, luu_nhap }
    submitLabResult = async (orderId, body) => {
        const res = await this.post(`/api/v1/subclinical/orders/${orderId}/lab-results`, body)
        const { trang_thai, ket_qua: kq } = res.data.data
        // Hoàn tất xét nghiệm chỉ là chờ duyệt; bàn khám nhận kết quả khi KTV duyệt (approveOrder)
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
        return { data: result }
    }

    // ── Ký duyệt & trả kết quả, phiếu in, kết quả mới cho bàn khám ──
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

    // Bàn khám hỏi định kỳ các kết quả vừa duyệt (khác máy/khác người dùng vẫn nhận được, không cần tải lại trang).
    // Trả về những chỉ định mà bàn khám này chưa biết là đã có kết quả: [{ encounterId, patientName, order }]
    pollReturnedResults = async () => {
        // Hẹn giờ và sự kiện cầu nối có thể gọi chồng nhau: dùng chung một lượt hỏi để không báo trùng
        if (this._returnedPollOff) return []
        if (this._returnedPolling) return []
        this._returnedPolling = this._pollReturnedResultsOnce()
        try {
            return await this._returnedPolling
        } finally {
            this._returnedPolling = null
        }
    }

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
            // Không phải tài khoản bác sĩ/admin thì dừng hỏi; lỗi mạng thì lần sau hỏi lại
            if (e?.response?.status === 403) this._returnedPollOff = true
            return []
        }
        if (payload.server_time) this._returnedSince = payload.server_time
        const isNew = (it) => {
            const mirror = findMirrorOrder(it.chi_dinh_id)
            return mirror && !sameInstant(mirror.order.thoi_gian_duyet, it.thoi_gian_duyet)
        }
        const fresh = (payload.items || []).filter(isNew)
        if (fresh.length === 0) return []

        // Tải bản mới nhất trước khi ghi để không đè thay đổi của máy khác
        await this.reloadFromPostgres()
        const changed = []
        let dirty = false
        fresh.forEach((it) => {
            const mirror = findMirrorOrder(it.chi_dinh_id)
            if (!mirror) return
            if (isNew(it)) {
                applyReturnedResult(mirror, toMirrorPatch(it))
                dirty = true
            }
            changed.push({ encounterId: mirror.enc.id, patientName: mirror.enc.benh_nhan?.ho_ten, order: structuredClone(mirror.order) })
        })
        if (dirty) await this.persistToPostgres()
        return changed
    }

    // Đưa kết quả đã trả về bản sao trên bàn khám để bác sĩ thấy (kèm cờ cảnh báo) và lượt khám được ưu tiên gọi lại
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
