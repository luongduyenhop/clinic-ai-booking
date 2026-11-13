import { BaseServices, http } from '../BaseService'
import { INITIAL_CLINIC_DATA, getFormDefaults } from '../../utils/helpers/clinicConfigHelpers'
import { clinicalEventBridge, CLINICAL_EVENTS } from '../clinicalEventBridge'

import { TOKEN, USER_ROLE, CLINIC_DATA_STORAGE_KEY } from '../../utils/constants/System'
import { normalizeStaffRole } from '../../utils/constants/staffRoles'

const STORAGE_KEY = CLINIC_DATA_STORAGE_KEY

function managementPrefix() {
    return normalizeStaffRole(localStorage.getItem(USER_ROLE)) === 'ADMIN' ? '/api/v1/admin' : '/api/v1/staff'
}

function sanitizeThuocVatTu(list) {
    if (!Array.isArray(list)) return []
    return list.map((item) => {
        const clean = { ...item }
        delete clean.donGia
        delete clean.giaNhap
        delete clean.tonKho
        delete clean.soLo
        delete clean.hanSuDung
        return clean
    })
}

function loadClinicStore() {
    try {
        localStorage.removeItem('CLINIC_AI_MANAGEMENT_DB_V2_PROMAX')
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CLINIC_DATA))
            return structuredClone(INITIAL_CLINIC_DATA)
        }
        const parsed = JSON.parse(raw)
        const loadedCatalogs = {
            ...structuredClone(INITIAL_CLINIC_DATA.catalogs),
            ...(parsed.catalogs || {}),
        }
        if (loadedCatalogs.thuocVatTu) {
            loadedCatalogs.thuocVatTu = sanitizeThuocVatTu(loadedCatalogs.thuocVatTu)
        }
        return {
            ...structuredClone(INITIAL_CLINIC_DATA),
            ...parsed,
            navigationConfig: INITIAL_CLINIC_DATA.navigationConfig,
            masterOptions: INITIAL_CLINIC_DATA.masterOptions,
            formDefaults: INITIAL_CLINIC_DATA.formDefaults,
            permissionModules: INITIAL_CLINIC_DATA.permissionModules,
            roleWorkbenches: parsed.roleWorkbenches || INITIAL_CLINIC_DATA.roleWorkbenches,
            addressShortcuts: parsed.addressShortcuts || INITIAL_CLINIC_DATA.addressShortcuts,
            referrers: parsed.referrers || INITIAL_CLINIC_DATA.referrers,
            servicePackageRegistrations: parsed.servicePackageRegistrations || INITIAL_CLINIC_DATA.servicePackageRegistrations,
            treatmentCourses: parsed.treatmentCourses || INITIAL_CLINIC_DATA.treatmentCourses,
            corporateCheckups: parsed.corporateCheckups || INITIAL_CLINIC_DATA.corporateCheckups,
            healthCheckupClassifications: parsed.healthCheckupClassifications || INITIAL_CLINIC_DATA.healthCheckupClassifications,
            inventoryBatches: [],
            cashierClosings: parsed.cashierClosings || INITIAL_CLINIC_DATA.cashierClosings,
            nationalDrugSync: parsed.nationalDrugSync || INITIAL_CLINIC_DATA.nationalDrugSync,
            nationalEhrSync: parsed.nationalEhrSync || INITIAL_CLINIC_DATA.nationalEhrSync,
            clinicSettings: parsed.clinicSettings || INITIAL_CLINIC_DATA.clinicSettings,
            catalogs: loadedCatalogs,
        }
    } catch {
        return structuredClone(INITIAL_CLINIC_DATA)
    }
}

function saveClinicStore(data) {
    try {
        if (data && typeof data === 'object') {
            data.inventoryBatches = []
            if (data.catalogs?.thuocVatTu) {
                data.catalogs.thuocVatTu = sanitizeThuocVatTu(data.catalogs.thuocVatTu)
            }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
    }
    return data
}

export class AdminService extends BaseServices {
    requestClinicData = async (method, path, payload) => {
        const token = localStorage.getItem(TOKEN)
        const options = { __skipGlobalLoading: true, __skipRefresh: true }
        const res = method === 'get'
            ? await this.get(path, options)
            : await this[method](path, payload, options)
        if (token !== localStorage.getItem(TOKEN)) throw new Error('Phiên đăng nhập đã thay đổi')
        const data = res?.data?.data || res?.data
        if (!data?.schemaVersion) throw new Error('Dữ liệu hệ thống không hợp lệ')
        return { data: saveClinicStore(data) }
    }

    getDashboardStats = async () => {
        const { data: storeData } = await this.getAllClinicData()
        const [compRes, kpiRes] = await Promise.allSettled([
            this.get('/api/v1/compliance/dashboard', { __skipGlobalLoading: true, __skipRefresh: true }),
            this.get('/api/v1/admin/dashboard-stats', { __skipGlobalLoading: true, __skipRefresh: true }),
        ])
        const compData = compRes.status === 'fulfilled' ? (compRes.value?.data?.data || compRes.value?.data || {}) : {}
        const kpiData = kpiRes.status === 'fulfilled' ? (kpiRes.value?.data?.data || kpiRes.value?.data || {}) : {}
        return { data: { storeData, backendCompliance: { ...compData, ...kpiData } } }
    }

    getAllClinicData = async () => this.requestClinicData('get', `${managementPrefix()}/bootstrap`)

    resetClinicDemoData = async () => this.requestClinicData('post', '/api/v1/admin/reset-demo', {})

    suggestSpecialtyByAI = async (symptomsText) => {
        try {
            const res = await this.post(
                '/api/v1/ai-triage/analyze',
                { symptoms: symptomsText },
                { __skipGlobalLoading: true, __skipRefresh: true }
            )
            if (res?.data?.data?.recommended_specialty || res?.data?.data?.chuyenKhoa) {
                return { data: res.data.data }
            }
        } catch {
        }

        const store = loadClinicStore()
        const rooms = store.catalogs?.khoaPhong || []
        const defaults = getFormDefaults(store)
        const text = String(symptomsText || '').toLowerCase()

        const findRoomByKeyword = (keyword) =>
            rooms.find((r) => r.chuyenKhoa?.toLowerCase().includes(keyword) || r.tenPhong?.toLowerCase().includes(keyword))

        let matchedRoom = findRoomByKeyword('nội') || rooms[0]
        let chuyenKhoa = matchedRoom?.chuyenKhoa || defaults.defaultSpecialty
        let mucDoUuTien = 'Bình thường'
        let lyDoGoiY = 'Triệu chứng nội khoa tổng quát, phù hợp khám tầm soát ban đầu tại Chuyên khoa Nội.'

        if (text.includes('ngực') || text.includes('khó thở') || text.includes('tim') || text.includes('huyết áp')) {
            matchedRoom = findRoomByKeyword('nội') || rooms[0]
            chuyenKhoa = 'Nội tổng quát - Tim mạch'
            mucDoUuTien = 'Ưu tiên cao (Cần đo Huyết áp & Điện tâm đồ)'
            lyDoGoiY =
                'Từ khóa triệu chứng liên quan hệ tuần hoàn/hô hấp. Gợi ý khám chuyên khoa Nội - Tim mạch (Lưu ý: Đây là gợi ý phân luồng chuyên khoa, không phải chẩn đoán bệnh).'
        } else if (text.includes('họng') || text.includes('ho') || text.includes('mũi') || text.includes('tai') || text.includes('xoang')) {
            matchedRoom = findRoomByKeyword('tai mũi họng') || matchedRoom
            chuyenKhoa = matchedRoom?.chuyenKhoa || 'Tai mũi họng'
            mucDoUuTien = 'Bình thường'
            lyDoGoiY = 'Triệu chứng vùng đường hô hấp trên. Gợi ý phân luồng vào Chuyên khoa Tai Mũi Họng.'
        } else if (text.includes('lưng') || text.includes('khớp') || text.includes('xương') || text.includes('cột sống') || text.includes('vai gáy')) {
            matchedRoom = findRoomByKeyword('cơ xương khớp') || matchedRoom
            chuyenKhoa = matchedRoom?.chuyenKhoa || 'Cơ xương khớp'
            mucDoUuTien = 'Bình thường'
            lyDoGoiY = 'Triệu chứng hệ vận động. Gợi ý phân luồng vào Chuyên khoa Cơ xương khớp & Phục hồi chức năng.'
        }

        return {
            data: {
                chuyenKhoa,
                phongKham: matchedRoom?.tenPhong || defaults.defaultClinicRoom,
                bacSi: matchedRoom?.bacSiPhuTrach || defaults.defaultDoctor,
                mucDoUuTien,
                lyDoGoiY,
            },
        }
    }

    updateCollection = async ({ collectionKey, items, auditEntry }) => {
        const result = await this.requestClinicData(
            'put', `${managementPrefix()}/collections/${encodeURIComponent(collectionKey)}`,
            { collectionKey, items, auditEntry },
        )
        try {
            if (collectionKey === 'appointments') {
                clinicalEventBridge.emit(CLINICAL_EVENTS.APPOINTMENT_UPDATED, { items })
            } else if (collectionKey === 'registrations') {
                clinicalEventBridge.emit(CLINICAL_EVENTS.REGISTRATION_CREATED, { items })
            }
        } catch {
        }
        return result
    }

    updateCatalogSubCollection = async ({ subKey, items, auditEntry, deletedItem, deletedItemKey }) => this.requestClinicData(
        'put', `/api/v1/admin/catalogs/${encodeURIComponent(subKey)}`, { subKey, items, auditEntry, deletedItem, deletedItemKey },
    )

    getDoctorScheduleMatrix = async ({ tuNgay, denNgay, bacSiId, doctorId, chuyenKhoaId, phongKhamId } = {}) => {
        try {
            const params = new URLSearchParams()
            if (tuNgay) params.append('tu_ngay', tuNgay)
            if (denNgay) params.append('den_ngay', denNgay)
            const resolvedDoc = doctorId || bacSiId
            if (resolvedDoc) params.append('doctor_id', resolvedDoc)
            if (chuyenKhoaId) params.append('chuyen_khoa_id', chuyenKhoaId)
            if (phongKhamId) params.append('phong_kham_id', phongKhamId)
            const res = await this.get(`/api/v1/admin/shifts/schedule-matrix?${params.toString()}`, {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data
        } catch (error) {
            console.warn('Fallback schedule-matrix:', error)
            return null
        }
    }

    getDepartmentsAdmin = async () => {
        try {
            const res = await this.get('/api/v1/admin/departments', {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            const list = res.data?.data || res.data
            if (Array.isArray(list) && list.length > 0) return list
        } catch {
        }
        try {
            const res = await this.get('/api/v1/medical/specialties', {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data || []
        } catch {
            return []
        }
    }

    getDoctorsAdmin = async () => {
        const res = await this.get('/api/v1/admin/doctors', {
            __skipGlobalLoading: true,
            __skipRefresh: true,
        })
        return res.data?.data || res.data || []
    }

    createDoctorAdmin = async (payload) => {
        const res = await this.post('/api/v1/admin/doctors', payload)
        return res.data?.data || res.data
    }

    updateDoctorAdmin = async (doctorId, payload) => {
        const res = await this.put(`/api/v1/admin/doctors/${doctorId}`, payload)
        return res.data?.data || res.data
    }

    updateAccountStatusAdmin = async (accountId, is_active) => {
        const res = await this.patch(`/api/v1/admin/accounts/${accountId}/status`, { is_active })
        return res.data?.data || res.data
    }

    resetAccountPasswordAdmin = async (accountId, new_password) => {
        const res = await this.post(`/api/v1/admin/accounts/${accountId}/reset-password`, { new_password })
        return res.data?.data || res.data
    }

    createStaffAccountAdmin = async (staffId, password) => {
        const res = await this.post(`/api/v1/admin/staff/${staffId}/account`, { password })
        return res.data?.data || res.data
    }

    getRBACRolesAdmin = async () => {
        const res = await this.get('/api/v1/admin/rbac/roles', { __skipGlobalLoading: true, __skipRefresh: true })
        return res.data?.data || res.data || []
    }

    updateRBACRolePermissionsAdmin = async (roleCode, permission_codes) => {
        const res = await this.put(`/api/v1/admin/rbac/roles/${encodeURIComponent(roleCode)}/permissions`, { permission_codes })
        return res.data?.data || res.data
    }

    getStaffAdmin = async () => {
        const res = await this.get('/api/v1/admin/staff', { __skipGlobalLoading: true, __skipRefresh: true })
        return res.data?.data || res.data || []
    }

    createStaffAdmin = async (payload) => {
        const res = await this.post('/api/v1/admin/staff', payload)
        return res.data?.data || res.data
    }

    updateStaffAdmin = async (staffId, payload) => {
        const res = await this.patch(`/api/v1/admin/staff/${staffId}`, payload)
        return res.data?.data || res.data
    }

    getRoomsAdmin = async ({ loaiPhong, chuyenKhoaId, isActive } = {}) => {
        try {
            const params = new URLSearchParams()
            if (loaiPhong) params.append('loai_phong', loaiPhong)
            if (chuyenKhoaId) params.append('chuyen_khoa_id', chuyenKhoaId)
            if (isActive !== undefined && isActive !== null) params.append('is_active', isActive)
            const query = params.toString() ? '?' + params.toString() : ''
            const res = await this.get('/api/v1/admin/rooms' + query, {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data || []
        } catch {
            return []
        }
    }

    getShiftsAdmin = async ({ queryDate, doctorId } = {}) => {
        try {
            const params = new URLSearchParams()
            if (queryDate) params.append('query_date', queryDate)
            if (doctorId) params.append('doctor_id', doctorId)
            const query = params.toString() ? '?' + params.toString() : ''
            const res = await this.get('/api/v1/admin/shifts' + query, {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data || []
        } catch {
            return []
        }
    }

    createShiftAdmin = async (payload) => {
        const res = await this.post('/api/v1/admin/shifts', payload)
        return res.data?.data || res.data
    }

    toggleLockShiftAdmin = async (shiftId, payload) => {
        const res = await this.put(`/api/v1/admin/shifts/${shiftId}/lock`, payload)
        return res.data?.data || res.data
    }

    getRosterTemplatesAdmin = async (doctorId) => {
        try {
            const query = doctorId ? `?doctor_id=${doctorId}` : ''
            const res = await this.get('/api/v1/admin/rosters' + query, {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data || []
        } catch {
            return []
        }
    }

    createRosterTemplateAdmin = async (payload) => {
        const res = await this.post('/api/v1/admin/rosters', payload)
        return res.data?.data || res.data
    }

    updateRosterTemplateAdmin = async (rosterId, payload) => {
        const res = await this.put(`/api/v1/admin/rosters/${rosterId}`, payload)
        return res.data?.data || res.data
    }

    deleteRosterTemplateAdmin = async (rosterId) => {
        const res = await this.delete(`/api/v1/admin/rosters/${rosterId}`)
        return res.data?.data || res.data
    }

    generateShiftsFromRosterAdmin = async (payload) => {
        const res = await this.post('/api/v1/admin/rosters/generate-shifts', payload)
        return res.data?.data || res.data
    }

    batchGenerateRosterAdmin = async (payload) => {
        const body = {
            tu_ngay: payload.ap_dung_tu_ngay || payload.tu_ngay,
            den_ngay: payload.ap_dung_den_ngay || payload.den_ngay,
            template_type: payload.template_type || 'WEEKLY_TEMPLATE',
            nguon_tu_ngay: payload.nguon_tu_ngay,
            nguon_den_ngay: payload.nguon_den_ngay,
            ghi_de_lich_cu: payload.ghi_de_lich_cu ?? false,
            bac_si_ids: payload.bac_si_ids,
        }
        return this.generateShiftsFromRosterAdmin(body)
    }

    getDepartmentsAdmin = async () => {
        try {
            const res = await this.get('/api/v1/admin/departments', {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data || []
        } catch {
            return []
        }
    }

    exportShiftReportAdmin = async ({ tuNgay, denNgay, chuyenKhoaId } = {}) => {
        try {
            const params = new URLSearchParams()
            if (tuNgay) params.append('tu_ngay', tuNgay)
            if (denNgay) params.append('den_ngay', denNgay)
            if (chuyenKhoaId && chuyenKhoaId !== 'ALL') params.append('chuyen_khoa_id', chuyenKhoaId)
            const query = params.toString() ? '?' + params.toString() : ''
            const res = await this.get('/api/v1/admin/shifts/export-report' + query, {
                responseType: 'blob',
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data
        } catch (error) {
            console.warn('Lỗi khi xuất báo cáo phân ca từ server:', error)
            throw error
        }
    }

    emergencyLeaveShiftAdmin = async (shiftId, payload) => {
        const res = await this.post(`/api/v1/admin/shifts/${shiftId}/emergency-leave`, payload)
        return res.data?.data || res.data
    }

    reassignShiftAdmin = async (shiftId, payload) => {
        const res = await this.post(`/api/v1/admin/shifts/${shiftId}/reassign`, payload)
        return res.data?.data || res.data
    }

    postponeAndCancelShiftAdmin = async (shiftId, payload = {}) => {
        const res = await this.post(`/api/v1/admin/shifts/${shiftId}/postpone-and-cancel`, payload)
        return res.data?.data || res.data
    }


    exportBiExcel = async () => {
        const res = await http.get('/api/v1/admin/bi/export-excel')
        return res?.data?.data || res?.data
    }

    exportServicesCatalog = async ({ nhomDichVu, trangThai } = {}) => {
        try {
            const params = new URLSearchParams()
            if (nhomDichVu) params.append('nhom_dich_vu', nhomDichVu)
            if (trangThai !== undefined && trangThai !== null) params.append('trang_thai', trangThai)
            const res = await this.get(`/api/v1/admin/services/export?${params.toString()}`, {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data
        } catch (error) {
            console.warn('Fallback services export:', error)
            return null
        }
    }

    getTopIcd10Diseases = async ({ tuNgay, denNgay, limit = 10 } = {}) => {
        try {
            const params = new URLSearchParams()
            if (tuNgay) params.append('tu_ngay', tuNgay)
            if (denNgay) params.append('den_ngay', denNgay)
            if (limit) params.append('limit', limit)
            const res = await this.get(`/api/v1/admin/analytics/top-diseases?${params.toString()}`, {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data
        } catch (error) {
            console.warn('Fallback top-diseases:', error)
            return null
        }
    }

    getTopServicesAnalytics = async ({ tuNgay, denNgay, limit = 10 } = {}) => {
        try {
            const params = new URLSearchParams()
            if (tuNgay) params.append('tu_ngay', tuNgay)
            if (denNgay) params.append('den_ngay', denNgay)
            if (limit) params.append('limit', limit)
            const res = await this.get(`/api/v1/admin/analytics/top-services?${params.toString()}`, {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data
        } catch (error) {
            console.warn('Fallback top-services:', error)
            return null
        }
    }

    getTopMedicinesAnalytics = async ({ tuNgay, denNgay, limit = 10 } = {}) => {
        try {
            const params = new URLSearchParams()
            if (tuNgay) params.append('tu_ngay', tuNgay)
            if (denNgay) params.append('den_ngay', denNgay)
            if (limit) params.append('limit', limit)
            const res = await this.get(`/api/v1/admin/analytics/top-medicines?${params.toString()}`, {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data
        } catch (error) {
            console.warn('Fallback top-medicines:', error)
            return null
        }
    }

    getDoctorPerformanceAnalytics = async ({ tuNgay, denNgay } = {}) => {
        try {
            const params = new URLSearchParams()
            if (tuNgay) params.append('tu_ngay', tuNgay)
            if (denNgay) params.append('den_ngay', denNgay)
            const res = await this.get(`/api/v1/admin/analytics/doctor-performance?${params.toString()}`, {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data
        } catch (error) {
            console.warn('Fallback doctor-performance:', error)
            return null
        }
    }

    getRoomWorkloadAnalytics = async ({ tuNgay, denNgay } = {}) => {
        try {
            const params = new URLSearchParams()
            if (tuNgay) params.append('tu_ngay', tuNgay)
            if (denNgay) params.append('den_ngay', denNgay)
            const res = await this.get(`/api/v1/admin/analytics/room-workload?${params.toString()}`, {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data
        } catch (error) {
            console.warn('Fallback room-workload:', error)
            return null
        }
    }

    getDoctorLeaves = async ({ doctorId, trangThai } = {}) => {
        const params = new URLSearchParams()
        if (doctorId) params.append('doctor_id', doctorId)
        if (trangThai) params.append('trang_thai', trangThai)
        const query = params.toString() ? '?' + params.toString() : ''
        try {
            const res = await this.get('/api/v1/admin/leaves' + query, {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data || []
        } catch {
            const res = await this.get('/api/v1/schedules/leaves' + query, {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data || []
        }
    }

    createDoctorLeave = async (payload) => {
        try {
            const res = await this.post('/api/v1/admin/leaves', payload)
            return res.data?.data || res.data
        } catch {
            const res = await this.post('/api/v1/schedules/leaves', payload)
            return res.data?.data || res.data
        }
    }

    approveDoctorLeave = async (leaveId, payload) => {
        try {
            const res = await this.post('/api/v1/admin/leaves/' + leaveId + '/approve', payload)
            return res.data?.data || res.data
        } catch {
            const res = await this.post('/api/v1/schedules/leaves/' + leaveId + '/approve', payload)
            return res.data?.data || res.data
        }
    }

    getLeaveAffectedBookings = async (leaveId) => {
        try {
            const res = await this.get('/api/v1/admin/leaves/' + leaveId + '/affected-bookings', {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data || []
        } catch {
            try {
                const res = await this.get('/api/v1/schedules/leaves/' + leaveId + '/affected-bookings', {
                    __skipGlobalLoading: true,
                    __skipRefresh: true,
                })
                return res.data?.data || res.data || []
            } catch {
                return []
            }
        }
    }

    cancelDoctorLeave = async (leaveId) => {
        try {
            const res = await this.post('/api/v1/admin/leaves/' + leaveId + '/cancel')
            return res.data?.data || res.data
        } catch {
            const res = await this.post('/api/v1/schedules/leaves/' + leaveId + '/cancel')
            return res.data?.data || res.data
        }
    }

    deleteDoctorLeave = async (leaveId) => {
        try {
            const res = await this.delete('/api/v1/admin/leaves/' + leaveId)
            return res.data?.data || res.data
        } catch {
            const res = await this.delete('/api/v1/schedules/leaves/' + leaveId)
            return res.data?.data || res.data
        }
    }
}

export const adminService = new AdminService()
export default adminService
