import { BaseServices } from '../BaseService'
import { INITIAL_CLINIC_DATA, getFormDefaults } from '../../utils/helpers/clinicConfigHelpers'

const STORAGE_KEY = 'CLINIC_AI_MANAGEMENT_DB_V3_CLINICAL'

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
        // Tự động dọn dẹp các cache cũ nếu có
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
        // ignore storage quota errors
    }
    return data
}

export class AdminService extends BaseServices {
    // ── Kết nối Backend FastAPI (/api/v1) kèm đồng bộ Store Quản lý từ PostgreSQL ───
    getDashboardStats = async () => {
        let storeData = loadClinicStore()
        try {
            const bootRes = await this.get('/api/v1/admin/bootstrap', { __skipGlobalLoading: true, __skipRefresh: true })
            const remoteStore = bootRes?.data?.data || bootRes?.data
            if (remoteStore && remoteStore.schemaVersion) {
                storeData = saveClinicStore(remoteStore)
            }
        } catch {
            // Giữ storeData từ cache nếu chưa kết nối
        }

        try {
            const res = await this.get('/api/v1/compliance/dashboard', { __skipGlobalLoading: true, __skipRefresh: true })
            return { data: { storeData, backendCompliance: res?.data?.data || res?.data || null } }
        } catch {
            return { data: { storeData, backendCompliance: null } }
        }
    }

    getAllClinicData = async () => {
        try {
            const res = await this.get('/api/v1/admin/bootstrap', { __skipGlobalLoading: true, __skipRefresh: true })
            const remoteData = res?.data?.data || res?.data
            if (remoteData && remoteData.schemaVersion) {
                saveClinicStore(remoteData)
                return { data: remoteData }
            }
        } catch {
            // Fallback sang localStorage nếu đang chạy độc lập
        }
        const data = loadClinicStore()
        return { data }
    }

    resetClinicDemoData = async () => {
        try {
            const res = await this.post('/api/v1/admin/reset-demo', {}, { __skipRefresh: true })
            const remoteData = res?.data?.data || res?.data
            if (remoteData && remoteData.schemaVersion) {
                saveClinicStore(remoteData)
                return { data: remoteData }
            }
        } catch {
            // Fallback local reset
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CLINIC_DATA))
        return { data: structuredClone(INITIAL_CLINIC_DATA) }
    }

    // ── AI Gợi ý Chuyên khoa (Phân luồng từ Backend AI Triage + danh mục Khoa phòng) ───
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
            // Fallback phân tích từ khóa triệu chứng tiếng Việt kết hợp danh mục Khoa phòng trong Seed
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

    // ── Thao tác CRUD đồng bộ toàn bộ 19 phân hệ xuống PostgreSQL ─────────────
    updateCollection = async ({ collectionKey, items, auditEntry }) => {
        try {
            const res = await this.put(
                `/api/v1/admin/collections/${encodeURIComponent(collectionKey)}`,
                { collectionKey, items, auditEntry },
                { __skipGlobalLoading: true, __skipRefresh: true }
            )
            const remoteData = res?.data?.data || res?.data
            if (remoteData && remoteData.schemaVersion) {
                saveClinicStore(remoteData)
                return { data: remoteData }
            }
        } catch {
            // Fallback sang lưu localStorage nếu chưa kết nối Backend
        }

        const current = loadClinicStore()
        const defaults = getFormDefaults(current)
        current[collectionKey] = items
        if (auditEntry) {
            const newAudit = {
                id: `AUD-${Date.now().toString().slice(-5)}`,
                thoiGian: new Date().toISOString().replace('T', ' ').slice(0, 19),
                nguoiDung: auditEntry.nguoiDung || defaults.defaultDoctor,
                vaiTro: auditEntry.vaiTro || 'ADMIN',
                hanhDong: auditEntry.hanhDong || 'UPDATE_DATA',
                doiTuong: auditEntry.doiTuong || collectionKey,
                mucDich: auditEntry.mucDich || 'Thao tác nghiệp vụ quản lý phòng khám',
                ip: '192.168.1.15',
                ketQua: auditEntry.ketQua || 'THÀNH CÔNG',
            }
            current.auditLogs = [newAudit, ...(current.auditLogs || [])]
        }
        saveClinicStore(current)
        return { data: current }
    }

    updateCatalogSubCollection = async ({ subKey, items, auditEntry }) => {
        try {
            const res = await this.put(
                `/api/v1/admin/catalogs/${encodeURIComponent(subKey)}`,
                { subKey, items, auditEntry },
                { __skipGlobalLoading: true, __skipRefresh: true }
            )
            const remoteData = res?.data?.data || res?.data
            if (remoteData && remoteData.schemaVersion) {
                saveClinicStore(remoteData)
                return { data: remoteData }
            }
        } catch {
            // Fallback sang lưu localStorage nếu chưa kết nối Backend
        }

        const current = loadClinicStore()
        const defaults = getFormDefaults(current)
        current.catalogs = {
            ...current.catalogs,
            [subKey]: items,
        }
        if (auditEntry) {
            const newAudit = {
                id: `AUD-${Date.now().toString().slice(-5)}`,
                thoiGian: new Date().toISOString().replace('T', ' ').slice(0, 19),
                nguoiDung: auditEntry.nguoiDung || defaults.defaultDoctor,
                vaiTro: 'ADMIN',
                hanhDong: auditEntry.hanhDong || 'UPDATE_CATALOG',
                doiTuong: `Danh mục: ${subKey}`,
                mucDich: auditEntry.mucDich || 'Cập nhật danh mục hệ thống',
                ip: '192.168.1.15',
                ketQua: 'THÀNH CÔNG',
            }
            current.auditLogs = [newAudit, ...(current.auditLogs || [])]
        }
        saveClinicStore(current)
        return { data: current }
    }

    // ── 1. Ma trận Lịch trực Bác sĩ & Slot Trống (tClinic standard) ───
    getDoctorScheduleMatrix = async ({ tuNgay, denNgay, bacSiId, chuyenKhoaId } = {}) => {
        try {
            const params = new URLSearchParams()
            if (tuNgay) params.append('tu_ngay', tuNgay)
            if (denNgay) params.append('den_ngay', denNgay)
            if (bacSiId) params.append('bac_si_id', bacSiId)
            if (chuyenKhoaId) params.append('chuyen_khoa_id', chuyenKhoaId)
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


    // ── 3. Xuất Danh mục Dịch vụ Kỹ thuật Chuẩn Y tế (Catalog Export) ───
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

    // ── 4. Phân tích Mô hình Bệnh tật ICD-10 (Top 10 Diseases) ───
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

    // ── 5. Doanh thu Top Dịch vụ Kỹ thuật (Top Services) ───
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

    // ── 5b. Top Thuốc Kê Nhiều Nhất (ClinicManager statistic_medicine_frequency) ───
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

    // ── 6. Đánh giá Hiệu suất & Năng suất Bác sĩ (Doctor KPI) ───
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

    // ── 7. Đo lường Tải trọng Buồng khám (Room Workload) ───
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
}

export const adminService = new AdminService()
export default adminService
