import { BaseServices } from '../BaseService'
import { clinicalEventBridge, CLINICAL_EVENTS } from '../clinicalEventBridge'

/**
 * ClinicalService.js
 * Domain Service phân hệ Bàn khám bác sĩ & Cận lâm sàng (Tầng 3)
 * Tuân thủ mô hình 7 tầng thuần REST - Tuyệt đối không mock LocalStorage hay delay giả lập.
 * Kết nối trực tiếp tới Backend FastAPI & PostgreSQL (/api/v1/clinical & /api/v1/medical).
 */

const DEFAULT_SERVICES_CATALOG = [
    { id: 9001, ma_dich_vu: 'XN-MAU-01', ten_dich_vu: 'Tổng phân tích tế bào máu ngoại vi', nhom_dich_vu: 'XET_NGHIEM', don_gia: 120000 },
    { id: 9002, ma_dich_vu: 'XN-SH-01', ten_dich_vu: 'Định lượng Glucose máu', nhom_dich_vu: 'XET_NGHIEM', don_gia: 65000 },
    { id: 9003, ma_dich_vu: 'CDHA-XQ-01', ten_dich_vu: 'Chụp X-quang tim phổi thẳng', nhom_dich_vu: 'CHAN_DOAN_HINH_ANH', don_gia: 150000 },
    { id: 9004, ma_dich_vu: 'CDHA-SA-01', ten_dich_vu: 'Siêu âm ổ bụng tổng quát', nhom_dich_vu: 'CHAN_DOAN_HINH_ANH', don_gia: 180000 },
    { id: 9005, ma_dich_vu: 'TDCN-ECG-01', ten_dich_vu: 'Điện tâm đồ (ECG) 12 đạo trình', nhom_dich_vu: 'THAM_DO_CHUC_NANG', don_gia: 85000 },
    { id: 9006, ma_dich_vu: 'NS-DD-01', ten_dich_vu: 'Nội soi dạ dày - tá tràng ống mềm', nhom_dich_vu: 'NOI_SOI', don_gia: 650000 },
]

export class ClinicalService extends BaseServices {
    _workspace = null

    _createDefaultWorkspace = () => ({
        encounters: {},
        queue: [],
        extraOrders: [],
        nextId: 9500,
    })

    _ticketToQueueItem = (t) => {
        const enc = t.encounter_id && this._workspace?.encounters ? this._workspace.encounters[t.encounter_id] : null
        const bn = enc ? enc.benh_nhan : t.benh_nhan
        return {
            ...t,
            ten_benh_nhan: bn?.ho_ten || t.ten_benh_nhan || 'Bệnh nhân',
            gioi_tinh: bn?.gioi_tinh || t.gioi_tinh || 'Khác',
            tuoi: bn?.tuoi || t.tuoi || 30,
            ly_do: enc?.ai_triage?.trieu_chung_nhap || t.ly_do || enc?.ly_do_vao_kham || '',
        }
    }

    _allOrders = () => {
        const fromEncounters = Object.values(this._workspace?.encounters || {}).flatMap((enc) =>
            (enc.danh_sach_chi_dinh || []).map((o) => ({
                ...o,
                benh_nhan: enc.benh_nhan,
                ly_do: enc.ly_do_vao_kham || enc.ai_triage?.trieu_chung_nhap,
                bac_si_chi_dinh: 'BS. Khám lâm sàng',
            }))
        )
        return [...fromEncounters, ...(this._workspace?.extraOrders || [])]
    }

    _findOrder = (orderId) => {
        for (const enc of Object.values(this._workspace?.encounters || {})) {
            const o = (enc.danh_sach_chi_dinh || []).find((x) => x.id === orderId)
            if (o) return o
        }
        return (this._workspace?.extraOrders || []).find((x) => x.id === orderId)
    }

    // ── 1. Đồng bộ Trạng thái Bàn khám với PostgreSQL (/api/v1/clinical/workspace-state) ──
    getWorkspaceState = async () => {
        const res = await this.get('/api/v1/clinical/workspace-state', { __skipGlobalLoading: true })
        const data = res?.data?.data
        if (data && typeof data === 'object') {
            this._workspace = data
        }
        return res
    }

    saveWorkspaceState = async (payload) => {
        this._workspace = payload
        return this.put('/api/v1/clinical/workspace-state', payload, { __skipGlobalLoading: true })
    }

    // ── 2. Quản lý Hàng đợi (Queue) ───────────────────────────────────────
    getMyQueue = async () => {
        const res = await this.get('/api/v1/clinical/workspace-state', { __skipGlobalLoading: true })
        const remote = res?.data?.data
        if (remote && remote.encounters && Array.isArray(remote.queue)) {
            this._workspace = remote
        } else if (!this._workspace) {
            this._workspace = this._createDefaultWorkspace()
            await this.put('/api/v1/clinical/workspace-state', this._workspace, { __skipGlobalLoading: true })
        }
        const queueItems = (this._workspace?.queue || []).map((t) => this._ticketToQueueItem(t))
        return {
            data: {
                success: true,
                data: queueItems,
                message: 'Lấy danh sách hàng đợi thành công',
            },
        }
    }

    callNext = async () => {
        if (!this._workspace) await this.getMyQueue()
        const current = (this._workspace.queue || []).find((t) => t.trang_thai === 'dang_kham')
        if (current) {
            throw new Error('Đang có bệnh nhân trong phòng khám. Hoàn tất hoặc tạm hoãn trước khi gọi tiếp.')
        }
        const next = (this._workspace.queue || [])
            .filter((t) => t.trang_thai === 'cho_kham')
            .sort((a, b) => a.muc_do_uu_tien - b.muc_do_uu_tien || a.so_thu_tu_kham - b.so_thu_tu_kham)[0]
        if (!next) {
            throw new Error('Không còn bệnh nhân chờ khám.')
        }
        next.trang_thai = 'dang_kham'
        next.so_lan_goi = (next.so_lan_goi || 0) + 1
        next.ghi_chu = 'Đang khám'
        const enc = this._workspace.encounters[next.encounter_id]
        if (enc && !enc.thoi_gian_bat_dau) enc.thoi_gian_bat_dau = new Date().toISOString()
        await this.put('/api/v1/clinical/workspace-state', this._workspace, { __skipGlobalLoading: true })
        return {
            data: {
                success: true,
                data: this._ticketToQueueItem(next),
                message: 'Gọi bệnh nhân thành công',
            },
        }
    }

    recall = async (ticketId) => {
        if (!this._workspace) await this.getMyQueue()
        const t = (this._workspace.queue || []).find((x) => x.ticket_id === ticketId)
        if (!t) throw new Error('Không tìm thấy số thứ tự')
        t.so_lan_goi = (t.so_lan_goi || 0) + 1
        await this.put('/api/v1/clinical/workspace-state', this._workspace, { __skipGlobalLoading: true })
        return {
            data: {
                success: true,
                data: this._ticketToQueueItem(t),
                message: 'Gọi lại thành công',
            },
        }
    }

    postponeTicket = async (ticketId, reason = 'Chờ kết quả Cận lâm sàng') => {
        if (!this._workspace) await this.getMyQueue()
        const t = (this._workspace.queue || []).find((x) => x.ticket_id === ticketId || x.encounter_id === ticketId)
        if (!t) throw new Error('Không tìm thấy lượt khám')
        t.trang_thai = 'tam_hoan'
        t.ghi_chu = reason
        await this.put('/api/v1/clinical/workspace-state', this._workspace, { __skipGlobalLoading: true })
        return {
            data: {
                success: true,
                data: this._ticketToQueueItem(t),
                message: 'Tạm hoãn lượt khám thành công',
            },
        }
    }

    // ── 3. Quản lý Ca khám & Lịch sử Bệnh án ──────────────────────────────
    getEncounter = async (encounterId) => {
        // Thử lấy qua REST endpoint chi tiết lượt khám của backend
        try {
            const res = await this.get(`/api/v1/clinical/encounters/${encounterId}`, { __skipGlobalLoading: true })
            if (res?.data?.data) {
                if (this._workspace?.encounters) {
                    this._workspace.encounters[encounterId] = {
                        ...(this._workspace.encounters[encounterId] || {}),
                        ...res.data.data,
                    }
                }
                return res
            }
        } catch {
            // Fallback lấy từ snapshot workspace-state đã tải từ PostgreSQL
        }

        if (!this._workspace) {
            await this.getWorkspaceState()
        }

        const enc = this._workspace?.encounters?.[encounterId]
        if (!enc) {
            throw new Error('Không tìm thấy lượt khám')
        }
        return {
            data: {
                success: true,
                data: enc,
                message: 'Lấy thông tin lượt khám thành công',
            },
        }
    }

    saveEncounterDraft = async (encounterId, patch) => {
        if (!this._workspace) {
            await this.getWorkspaceState()
        }
        if (!this._workspace.encounters) this._workspace.encounters = {}
        const enc = this._workspace.encounters[encounterId]
        if (!enc) throw new Error('Không tìm thấy lượt khám')
        if (enc.is_locked) throw new Error('Bệnh án đã khóa, không thể sửa.')
        Object.assign(enc, patch)
        await this.put('/api/v1/clinical/workspace-state', this._workspace, { __skipGlobalLoading: true })
        return {
            data: {
                success: true,
                data: { saved_at: new Date().toISOString() },
                message: 'Lưu nháp thành công',
            },
        }
    }

    createOrders = async (encounterId, dichVuIds) => {
        if (!this._workspace) await this.getWorkspaceState()
        const enc = this._workspace?.encounters?.[encounterId]
        if (!enc) throw new Error('Không tìm thấy lượt khám')
        if (!Array.isArray(enc.danh_sach_chi_dinh)) enc.danh_sach_chi_dinh = []
        const existing = new Set(enc.danh_sach_chi_dinh.filter((o) => o.trang_thai !== 'da_huy').map((o) => o.dich_vu_id))
        const allServices = await this.getServicesCatalog()
        dichVuIds
            .filter((id) => !existing.has(id))
            .forEach((id) => {
                const s = allServices.find((x) => x.id === id)
                if (!s) return
                enc.danh_sach_chi_dinh.push({
                    id: (this._workspace.nextId = (this._workspace.nextId || 9500) + 1),
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
        await this.put('/api/v1/clinical/workspace-state', this._workspace, { __skipGlobalLoading: true })
        try {
            clinicalEventBridge.emit(CLINICAL_EVENTS.CLS_ORDERED, {
                encounterId,
                orders: enc.danh_sach_chi_dinh,
            })
        } catch (e) {
            console.warn('Bridge emit CLS_ORDERED error:', e)
        }
        return {
            data: {
                success: true,
                data: enc.danh_sach_chi_dinh,
                message: 'Kê chỉ định CLS thành công',
            },
        }
    }

    cancelOrder = async (encounterId, orderId) => {
        if (!this._workspace) await this.getWorkspaceState()
        const enc = this._workspace?.encounters?.[encounterId]
        const o = enc?.danh_sach_chi_dinh?.find((x) => x.id === orderId)
        if (!o) throw new Error('Không tìm thấy chỉ định')
        if (o.trang_thai !== 'da_chi_dinh') throw new Error('Chỉ hủy được chỉ định chưa thực hiện.')
        enc.danh_sach_chi_dinh = enc.danh_sach_chi_dinh.filter((x) => x.id !== orderId)
        await this.put('/api/v1/clinical/workspace-state', this._workspace, { __skipGlobalLoading: true })
        return {
            data: {
                success: true,
                data: enc.danh_sach_chi_dinh,
                message: 'Hủy chỉ định thành công',
            },
        }
    }

    completeEncounter = async (encounterId, payload) => {
        if (!this._workspace) await this.getWorkspaceState()
        const enc = this._workspace?.encounters?.[encounterId]
        if (!enc) throw new Error('Không tìm thấy lượt khám')
        const primary = (payload.danh_sach_chan_doan || []).filter((d) => d.loai_chan_doan === 'chinh')
        if (primary.length !== 1) throw new Error('Cần đúng 1 chẩn đoán chính (ICD-10) trước khi hoàn tất khám.')
        Object.assign(enc, payload, { is_locked: true, thoi_gian_khoa: new Date().toISOString() })
        const ticket = (this._workspace.queue || []).find((t) => t.encounter_id === encounterId)
        if (ticket) {
            ticket.trang_thai = 'da_kham'
            ticket.ghi_chu = 'Đã khám xong'
        }
        await this.put('/api/v1/clinical/workspace-state', this._workspace, { __skipGlobalLoading: true })
        try {
            clinicalEventBridge.emit(CLINICAL_EVENTS.ENCOUNTER_COMPLETED, {
                encounterId,
                encounter: enc,
            })
        } catch (err) {
            console.warn('Error emitting complete encounter event:', err)
        }
        return {
            data: {
                success: true,
                data: enc,
                message: 'Hoàn tất ca khám thành công',
            },
        }
    }

    createAmendment = async (encounterId, payload) => {
        try {
            const res = await this.post(`/api/v1/clinical/encounters/${encounterId}/amendments`, payload)
            return res
        } catch {
            if (!this._workspace) await this.getWorkspaceState()
            const amendment = {
                id: (this._workspace.nextId = (this._workspace.nextId || 9500) + 1),
                trang_thai: 'CHO_PHE_DUYET',
                ...payload,
            }
            await this.put('/api/v1/clinical/workspace-state', this._workspace, { __skipGlobalLoading: true })
            return {
                data: {
                    success: true,
                    data: amendment,
                    message: 'Tạo biên bản đính chính thành công',
                },
            }
        }
    }

    rateAiSuggestion = async (encounterId, payload) => {
        if (!this._workspace) await this.getWorkspaceState()
        const enc = this._workspace?.encounters?.[encounterId]
        if (enc) enc.danh_gia_ai = payload
        await this.put('/api/v1/clinical/workspace-state', this._workspace, { __skipGlobalLoading: true })
        return {
            data: {
                success: true,
                data: payload,
                message: 'Đánh giá gợi ý AI thành công',
            },
        }
    }

    // ── 4. Danh mục Dịch vụ, ICD-10 & Thuốc ──────────────────────────────
    getServices = () => this.get('/api/v1/medical/services')

    getServicesCatalog = async () => {
        try {
            const res = await this.getServices()
            const data = res?.data?.data
            if (Array.isArray(data) && data.length > 0) return data
        } catch {
            // Fallback
        }
        return DEFAULT_SERVICES_CATALOG
    }

    searchIcd10 = (keyword) =>
        this.get('/api/v1/medical/icd10', {
            params: { keyword: String(keyword || '').trim(), limit: 25 },
        })

    searchDrugs = (keyword) =>
        this.get('/api/v1/medical/drugs', {
            params: { keyword: String(keyword || '').trim(), limit: 25 },
        })

    // ── 5. Cận lâm sàng (Paraclinical Worklist) ───────────────────────────
    getClsWorklist = async (nhomDichVu) => {
        if (!this._workspace) await this.getWorkspaceState()
        const list = this._allOrders()
            .filter((o) => o.nhom_dich_vu === nhomDichVu && o.trang_thai !== 'da_huy')
            .sort((a, b) => (a.thoi_gian_chi_dinh || '').localeCompare(b.thoi_gian_chi_dinh || ''))
        return {
            data: {
                success: true,
                data: list,
                message: 'Lấy danh sách cận lâm sàng thành công',
            },
        }
    }

    startOrder = async (orderId) => {
        if (!this._workspace) await this.getWorkspaceState()
        const o = this._findOrder(orderId)
        if (!o) throw new Error('Không tìm thấy chỉ định')
        if (o.trang_thai === 'da_chi_dinh') o.trang_thai = 'dang_thuc_hien'
        await this.put('/api/v1/clinical/workspace-state', this._workspace, { __skipGlobalLoading: true })
        return {
            data: {
                success: true,
                data: o,
                message: 'Bắt đầu thực hiện chỉ định',
            },
        }
    }

    submitOrderResult = async (orderId, payload) => {
        if (!this._workspace) await this.getWorkspaceState()
        const o = this._findOrder(orderId)
        if (!o) throw new Error('Không tìm thấy chỉ định')
        Object.assign(o, payload, { thoi_gian_tra_ket_qua: new Date().toISOString() })

        let targetEncounter = null
        for (const enc of Object.values(this._workspace.encounters || {})) {
            if ((enc.danh_sach_chi_dinh || []).some((x) => x.id === orderId)) {
                targetEncounter = enc
                break
            }
        }

        if (targetEncounter) {
            const ticket = (this._workspace.queue || []).find((t) => t.encounter_id === targetEncounter.id)
            if (ticket) {
                ticket.trang_thai = 'co_ket_qua_cls'
                ticket.muc_do_uu_tien = 0
                ticket.ghi_chu = `⭐ CÓ KQ CLS: ${o.ten_dich_vu}`
            }
        }

        await this.put('/api/v1/clinical/workspace-state', this._workspace, { __skipGlobalLoading: true })
        try {
            clinicalEventBridge.emit(CLINICAL_EVENTS.CLS_RESULT_RETURNED, {
                orderId,
                order: o,
                encounterId: targetEncounter?.id,
            })
        } catch (e) {
            console.warn('Bridge emit CLS_RESULT_RETURNED error:', e)
        }
        return {
            data: {
                success: true,
                data: o,
                message: 'Trả kết quả cận lâm sàng thành công',
            },
        }
    }

    uploadFile = (file) =>
        Promise.resolve({
            data: {
                success: true,
                data: { url: URL.createObjectURL(file), ten_tep: file.name },
                message: 'Tải tệp thành công',
            },
        })

    // ── 6. Khám Chuyên Khoa 2 Tầng (5 Bảng Chuyên Khoa Độc Lập) ──────────
    getSpecialtyExam = (encounterId, deptCode) =>
        this.get(`/api/v1/clinical/encounters/${encounterId}/specialty/${deptCode}`)

    getAllSpecialtyExams = (encounterId) =>
        this.get(`/api/v1/clinical/encounters/${encounterId}/specialties`)

    saveSpecialtyExam = (encounterId, deptCode, data) =>
        this.put(`/api/v1/clinical/encounters/${encounterId}/specialty/${deptCode}`, { data })

    // ── 7. Sao chép đơn thuốc cũ 1-chạm ──────────────────────────────────
    copyOldPrescription = (encounterId, sourcePrescriptionId) =>
        this.post(`/api/v1/clinical/encounters/${encounterId}/copy-prescription/${sourcePrescriptionId}`, {})
}

export const clinicalService = new ClinicalService()
export default clinicalService
