// Helper functions and empty initial state for clinic data
// Fetched dynamically from Backend API (/api/v1/admin/bootstrap) and stored in Database

export const PERMISSION_MODULES_23 = [
    { stt: 1, maPhanHe: 'SYS_ADMIN', tenPhanHe: 'Quản trị hệ thống & Cấu hình phòng khám' },
    { stt: 2, maPhanHe: 'PATIENT_MGT', tenPhanHe: 'Hồ sơ bệnh nhân & Thẻ định danh y tế' },
    { stt: 3, maPhanHe: 'APPOINTMENT', tenPhanHe: 'Quản lý lịch hẹn & Đặt khám trực tuyến' },
    { stt: 4, maPhanHe: 'RECEPTION', tenPhanHe: 'Tiếp đón - Đăng ký khám & Cấp số tự động' },
    { stt: 5, maPhanHe: 'CLINICAL_EXAM', tenPhanHe: 'Khám bệnh lâm sàng (Nội, Ngoại, TMH, Răng, Mắt)' },
    { stt: 6, maPhanHe: 'PHYSICAL_ROOM', tenPhanHe: 'Quản lý Buồng khám vật lý & Lưu lượng phòng' },
    { stt: 7, maPhanHe: 'PRESCRIPTION', tenPhanHe: 'Kê đơn thuốc điện tử & Liên thông Cổng Dược QG' },
    { stt: 8, maPhanHe: 'CASHIER_BILLING', tenPhanHe: 'Thu ngân - Viện phí & Quyết toán VietQR NAPAS 247' },
    { stt: 9, maPhanHe: 'PARACLINICAL_ORDER', tenPhanHe: 'Chỉ định Cận lâm sàng & Phiếu phẫu thủ thuật' },
    { stt: 10, maPhanHe: 'LAB_TESTING', tenPhanHe: 'Xét nghiệm Huyết học - Sinh hóa - Nước tiểu (LIS)' },
    { stt: 11, maPhanHe: 'DIAGNOSTIC_IMAGING', tenPhanHe: 'Chẩn đoán hình ảnh (X-quang, Siêu âm, Nội soi PACS)' },
    { stt: 12, maPhanHe: 'FUNCTIONAL_TESTING', tenPhanHe: 'Thăm dò chức năng (Điện tim ECG, Hô hấp ký)' },
    { stt: 13, maPhanHe: 'SHIFT_SCHEDULING', tenPhanHe: 'Lịch trực Phòng khám & Điều phối bác sĩ' },
    { stt: 14, maPhanHe: 'CATALOG_MANAGEMENT', tenPhanHe: 'Quản lý Danh mục Y tế (Khoa, Dịch vụ, Thuốc, ICD-10)' },
    { stt: 15, maPhanHe: 'ROLE_RBAC', tenPhanHe: 'Phân quyền Vai trò & Quản trị Nhân sự phòng khám' },
    { stt: 16, maPhanHe: 'SERVICE_PACKAGES', tenPhanHe: 'Gói Dịch vụ & Chương trình sức khỏe doanh nghiệp' },
    { stt: 17, maPhanHe: 'TREATMENT_COURSES', tenPhanHe: 'Liệu trình Điều trị Y học cổ truyền & Phục hồi chức năng' },
    { stt: 18, maPhanHe: 'CORPORATE_HEALTH', tenPhanHe: 'Khám sức khỏe Định kỳ Doanh nghiệp theo Thông tư 32' },
    { stt: 19, maPhanHe: 'PRINT_TEMPLATES', tenPhanHe: 'Quản lý Mẫu in & Biểu mẫu Y tế chuẩn Bộ Y Tế' },
    { stt: 20, maPhanHe: 'COMPLIANCE_AUDIT', tenPhanHe: 'Tuân thủ Pháp lý TT32/2023 & Nhật ký kiểm toán EMR' },
    { stt: 21, maPhanHe: 'AI_TRIAGE_CONFIG', tenPhanHe: 'Phân luồng Triệu chứng AI & Cảnh báo Cấp cứu Red Flags' },
    { stt: 22, maPhanHe: 'PORTAL_CONTENT', tenPhanHe: 'Cổng thông tin Bệnh nhân, Tin tức & Cẩm nang Y khoa' },
    { stt: 23, maPhanHe: 'ANALYTICS_REPORTS', tenPhanHe: 'Báo cáo Quản trị Doanh thu & Thống kê Mặt bệnh ICD-10' },
]

export const INITIAL_CLINIC_DATA = {
    schemaVersion: '2.0.0-database',
    patients: [],
    appointments: [],
    registrations: [],
    paraclinicalTasks: [],
    vouchers: [],
    catalogs: { khoaPhong: [], dichVu: [], thuoc: [], benhICD: [], diaChi: [] },
    staffList: [],
    roles: [],
    permissionModules: PERMISSION_MODULES_23,
    templates: [],
    complianceObligations: [],
    auditLogs: [],
    clinicSettings: {},
    masterOptions: {},
    formDefaults: {},
    navigationConfig: {},
}

export function getNavigationConfig(clinicData) {
    return clinicData?.navigationConfig || {}
}

export function getMasterOptions(clinicData) {
    return clinicData?.masterOptions || {}
}

export function getFormDefaults(clinicData) {
    return clinicData?.formDefaults || {}
}

export function getProvincesFromCatalog(clinicData) {
    const diaChiList = clinicData?.catalogs?.diaChi || []
    const unique = Array.from(new Set(diaChiList.map((d) => d.tenTinh).filter(Boolean)))
    return unique.length > 0 ? unique : ['Thành phố Hà Nội']
}

export function getDistrictsByProvince(provinceName, clinicData) {
    const diaChiList = clinicData?.catalogs?.diaChi || []
    const filtered = diaChiList.filter((d) => !provinceName || d.tenTinh === provinceName)
    const unique = Array.from(new Set(filtered.map((d) => d.tenHuyen).filter(Boolean)))
    return unique.length > 0 ? unique : ['Quận Ba Đình', 'Quận Cầu Giấy', 'Quận Đống Đa']
}

export function getWardsByDistrict(provinceName, districtName, clinicData) {
    const diaChiList = clinicData?.catalogs?.diaChi || []
    const filtered = diaChiList.filter(
        (d) => (!provinceName || d.tenTinh === provinceName) && (!districtName || d.tenHuyen === districtName)
    )
    const unique = Array.from(new Set(filtered.map((d) => d.tenXa).filter(Boolean)))
    return unique.length > 0 ? unique : ['Phường Cống Vị', 'Phường Dịch Vọng', 'Phường Láng Hạ']
}

export function getAuthSeed(clinicData) {
    return clinicData?.authSeed || { user: { fullName: 'Quản trị viên', role: 'ADMIN' } }
}
