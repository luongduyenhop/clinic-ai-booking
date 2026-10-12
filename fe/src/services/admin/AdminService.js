import { BaseServices } from '../BaseService'
import { INITIAL_CLINIC_DATA, getFormDefaults } from './clinicSeedData'

const STORAGE_KEY = 'CLINIC_AI_MANAGEMENT_DB_V2_PROMAX'

function loadClinicStore() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CLINIC_DATA))
            return structuredClone(INITIAL_CLINIC_DATA)
        }
        const parsed = JSON.parse(raw)
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
            inventoryBatches: parsed.inventoryBatches || INITIAL_CLINIC_DATA.inventoryBatches,
            cashierClosings: parsed.cashierClosings || INITIAL_CLINIC_DATA.cashierClosings,
            nationalDrugSync: parsed.nationalDrugSync || INITIAL_CLINIC_DATA.nationalDrugSync,
            nationalEhrSync: parsed.nationalEhrSync || INITIAL_CLINIC_DATA.nationalEhrSync,
            clinicSettings: parsed.clinicSettings || INITIAL_CLINIC_DATA.clinicSettings,
            catalogs: {
                ...structuredClone(INITIAL_CLINIC_DATA.catalogs),
                ...(parsed.catalogs || {}),
            },
        }
    } catch {
        return structuredClone(INITIAL_CLINIC_DATA)
    }
}

function saveClinicStore(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
        // ignore storage quota errors
    }
    return data
}

export class AdminService extends BaseServices {
    // ── Kết nối Backend FastAPI (/api/v1) kèm đồng bộ Store Quản lý từ Seed ───
    getDashboardStats = async () => {
        const storeData = loadClinicStore()
        try {
            const res = await this.get('/api/v1/compliance/dashboard', { __skipGlobalLoading: true, __skipRefresh: true })
            return { data: { storeData, backendCompliance: res?.data?.data || res?.data || null } }
        } catch {
            return { data: { storeData, backendCompliance: null } }
        }
    }

    getAllClinicData = async () => {
        // TODO (Backend Integration): Thay loadClinicStore() bằng await this.get('/api/v1/admin/bootstrap')
        const data = loadClinicStore()
        return { data }
    }

    resetClinicDemoData = async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CLINIC_DATA))
        return { data: structuredClone(INITIAL_CLINIC_DATA) }
    }

    // ── AI Gợi ý Chuyên khoa (Phân luồng từ danh mục Khoa phòng trong Seed) ───
    suggestSpecialtyByAI = async (symptomsText) => {
        try {
            const res = await this.post(
                '/api/v1/ai-triage/analyze',
                { symptoms: symptomsText },
                { __skipGlobalLoading: true }
            )
            if (res?.data?.data?.recommended_specialty) {
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

    // ── Thao tác CRUD đồng bộ toàn bộ 10 phân hệ ──────────────────────────────
    updateCollection = async ({ collectionKey, items, auditEntry }) => {
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
}

export const adminService = new AdminService()
export default adminService
