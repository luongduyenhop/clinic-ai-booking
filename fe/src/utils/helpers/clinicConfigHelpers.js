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

export const DEFAULT_NAVIGATION_CONFIG = {
    headerWorkflowTabs: [
        {
            label: 'Tổng quan BI',
            path: '/admin',
            icon: 'ChartBar',
            hasDropdown: true,
            dropdownTitle: 'ĐIỀU HÀNH & BÁO CÁO QUẢN TRỊ',
            submenu: [
                {
                    label: 'Trung tâm Điều hành & BI',
                    path: '/admin',
                    icon: 'HouseLine',
                    desc: 'Công suất khoa phòng, hiệu suất bác sĩ & chỉ số vận hành',
                },
                {
                    label: 'Báo cáo Thống kê Tổng hợp',
                    path: '/admin/bao-cao',
                    icon: 'ChartBar',
                    desc: 'Phân tích doanh thu, dịch vụ kỹ thuật & cơ cấu bệnh tật',
                },
            ],
        },
        {
            label: 'Danh mục Y tế',
            path: '/admin/danh-muc/khoa-phong',
            icon: 'Folders',
            hasDropdown: true,
            dropdownTitle: 'QUẢN TRỊ DANH MỤC NỀN TẢNG (MASTER DATA)',
            submenu: [
                {
                    label: 'Danh mục Chuyên khoa',
                    path: '/admin/danh-muc/chuyen-khoa',
                    icon: 'FirstAid',
                    desc: 'Cấu hình danh sách chuyên khoa lâm sàng & vị trí khu vực',
                },
                {
                    label: 'Khoa phòng & Buồng khám',
                    path: '/admin/danh-muc/khoa-phong',
                    icon: 'Buildings',
                    desc: 'Cấu hình chuyên khoa, buồng khám & trạng thái hoạt động',
                },
                {
                    label: 'Dịch vụ Kỹ thuật & Giá niêm yết',
                    path: '/admin/danh-muc/dich-vu',
                    icon: 'Stethoscope',
                    desc: 'Quản lý bảng giá dịch vụ khám, xét nghiệm & CĐHA',
                },
                {
                    label: 'Danh mục Thuốc kê đơn (BYT)',
                    path: '/admin/danh-muc/thuoc-vat-tu',
                    icon: 'Pill',
                    desc: 'Danh mục hoạt chất, hàm lượng, đường dùng phục vụ kê đơn',
                },
                {
                    label: 'Danh mục Bệnh lý Quốc tế (ICD-10)',
                    path: '/admin/danh-muc/benh',
                    icon: 'Heartbeat',
                    desc: 'Chuẩn hóa mã bệnh ICD-10 theo quy định Bộ Y tế',
                },
                {
                    label: 'Danh mục chung & Đơn vị tính',
                    path: '/admin/danh-muc/chung',
                    icon: 'SlidersHorizontal',
                    desc: 'Đơn vị tính, khoản thu viện phí, gõ tắt & địa chỉ',
                },
                {
                    label: 'Biểu mẫu & Mẫu in Y tế',
                    path: '/admin/quan-ly-mau/mau-in',
                    icon: 'Printer',
                    desc: 'Mẫu phiếu khám, đơn thuốc quốc gia, biên lai & báo cáo',
                },
            ],
        },
        {
            label: 'Nhân sự & RBAC',
            path: '/admin/nhan-vien',
            icon: 'ShieldCheck',
            hasDropdown: true,
            dropdownTitle: 'QUẢN TRỊ NHÂN SỰ, CCHN & PHÂN QUYỀN',
            submenu: [
                {
                    label: 'Hồ sơ Nhân sự & Chứng chỉ CCHN',
                    path: '/admin/nhan-vien',
                    icon: 'Users',
                    desc: 'Quản lý bác sĩ, nhân viên y tế, lịch trực & kiểm soát hạn CCHN',
                },
                {
                    label: 'Ma trận Phân quyền Vai trò (RBAC)',
                    path: '/admin/phan-quyen',
                    icon: 'ShieldCheck',
                    desc: 'Thiết lập quyền truy cập chi tiết cho từng vai trò',
                },
                {
                    label: 'Phân lịch trực & Ma trận Ca khám',
                    path: '/admin/nhan-vien?tab=phan-lich',
                    icon: 'CalendarPlus',
                    desc: 'Phân ca làm việc, điều phối buồng khám và quản lý slot khám thời gian thực',
                },
                {
                    label: 'Duyệt đơn nghỉ phép Bác sĩ',
                    path: '/admin/nhan-vien?tab=nghi-phep',
                    icon: 'CalendarCheck',
                    desc: 'Phê duyệt nghỉ phép & tự động điều phối ca trực',
                },
                {
                    label: 'Tra cứu Hồ sơ Bệnh nhân (Master)',
                    path: '/admin/benh-nhan',
                    icon: 'IdentificationCard',
                    desc: 'Tra cứu danh mục hồ sơ hành chính người bệnh toàn viện',
                },
            ],
        },
        {
            label: 'Tuân thủ & Cấu hình',
            path: '/admin/tuan-thu',
            icon: 'Gear',
            hasDropdown: true,
            dropdownTitle: 'TUÂN THỦ PHÁP LÝ, AUDIT LOG & CẤU HÌNH',
            submenu: [
                {
                    label: 'Giám sát Liên thông Quốc gia (TT26/TT32)',
                    path: '/admin/tuan-thu',
                    icon: 'Scales',
                    desc: 'Trạng thái đồng bộ Đơn thuốc Quốc gia & Hồ sơ sức khỏe',
                },
                {
                    label: 'Nhật ký Kiểm toán Truy cập EMR (Audit)',
                    path: '/admin/lich-su-hoat-dong',
                    icon: 'ClipboardText',
                    desc: 'Ghi vết bảo mật và kiểm toán thao tác dữ liệu y tế',
                },
                {
                    label: 'Cấu hình Hệ thống Phòng khám',
                    path: '/admin/cai-dat',
                    icon: 'Gear',
                    desc: 'Thông tin pháp lý cơ sở KCB, thông số ca làm việc & cổng kết nối',
                },
            ],
        },
    ],
    sidebarSections: [
        {
            id: 'pillar-executive',
            title: '1. ĐIỀU HÀNH & THỐNG KÊ BI',
            menus: [
                {
                    id: 'dashboard',
                    title: 'Trung tâm Điều hành BI',
                    icon: 'HouseLine',
                    path: '/admin',
                },
                {
                    id: 'reports',
                    title: 'Báo cáo Thống kê',
                    icon: 'ChartBar',
                    path: '/admin/bao-cao',
                },
            ],
        },
        {
            id: 'pillar-catalogs',
            title: '2. QUẢN TRỊ DANH MỤC Y TẾ',
            menus: [
                {
                    id: 'catalogs',
                    title: 'Danh mục Nền tảng',
                    icon: 'Folders',
                    children: [
                        { label: 'Danh mục Chuyên khoa', path: '/admin/danh-muc/chuyen-khoa' },
                        { label: 'Khoa phòng & Buồng khám', path: '/admin/danh-muc/khoa-phong' },
                        { label: 'Dịch vụ & Giá niêm yết', path: '/admin/danh-muc/dich-vu' },
                        { label: 'Thuốc kê đơn (BYT)', path: '/admin/danh-muc/thuoc-vat-tu' },
                        { label: 'Danh mục Bệnh (ICD-10)', path: '/admin/danh-muc/benh' },
                        { label: 'Danh mục chung & ĐVT', path: '/admin/danh-muc/chung' },
                        { label: 'Địa chỉ hành chính', path: '/admin/danh-muc/dia-chi' },
                    ],
                },
                {
                    id: 'templates',
                    title: 'Biểu mẫu & Mẫu in',
                    icon: 'FileText',
                    children: [
                        { label: 'Mẫu in Phiếu & Biên lai', path: '/admin/quan-ly-mau/mau-in' },
                        { label: 'Mẫu báo cáo Sở Y tế', path: '/admin/quan-ly-mau/mau-bao-cao' },
                        { label: 'Đơn thuốc mẫu chuyên khoa', path: '/admin/quan-ly-mau/don-thuoc-mau' },
                        { label: 'Mẫu kết quả Cận lâm sàng', path: '/admin/quan-ly-mau/mau-ket-qua-cls' },
                    ],
                },
            ],
        },
        {
            id: 'pillar-iam-hr',
            title: '3. NHÂN SỰ & PHÂN QUYỀN (IAM)',
            menus: [
                {
                    id: 'users',
                    title: 'Nhân sự & Phân quyền',
                    icon: 'ShieldCheck',
                    children: [
                        { label: 'Nhân sự, Bác sĩ & CCHN', path: '/admin/nhan-vien' },
                        { label: 'Phân lịch trực & Ma trận Ca', path: '/admin/nhan-vien?tab=phan-lich' },
                        { label: 'Ma trận Phân quyền RBAC', path: '/admin/phan-quyen' },
                        { label: 'Duyệt nghỉ phép Bác sĩ', path: '/admin/nhan-vien?tab=nghi-phep' },
                    ],
                },
                {
                    id: 'patients',
                    title: 'Hồ sơ Bệnh nhân (Master)',
                    icon: 'IdentificationCard',
                    path: '/admin/benh-nhan',
                },
            ],
        },
        {
            id: 'pillar-compliance-settings',
            title: '4. TUÂN THỦ & CẤU HÌNH HỆ THỐNG',
            menus: [
                {
                    id: 'compliance',
                    title: 'Tuân thủ & Liên thông QG',
                    icon: 'Scales',
                    children: [
                        { label: 'Tổng quan Tuân thủ Pháp lý', path: '/admin/tuan-thu' },
                        { label: 'Đồng bộ Đơn thuốc QG (TT26)', path: '/admin/don-thuoc-quoc-gia' },
                        { label: 'Đồng bộ Sổ sức khỏe (TT32)', path: '/admin/tuan-thu?tab=HSSK' },
                    ],
                },
                {
                    id: 'audit-logs',
                    title: 'Nhật ký Kiểm toán (Audit)',
                    icon: 'ClipboardText',
                    path: '/admin/lich-su-hoat-dong',
                },
                {
                    id: 'settings',
                    title: 'Cấu hình Phòng khám',
                    icon: 'Gear',
                    path: '/admin/cai-dat',
                },
            ],
        },
    ],
    dashboardQuickModules: [
        {
            step: 'Trụ cột 01',
            title: 'Khoa phòng & Buồng khám',
            desc: 'Quản lý danh mục chuyên khoa, buồng khám lâm sàng/CLS và trạng thái vận hành',
            path: '/admin/danh-muc/khoa-phong',
            icon: 'Buildings',
            badge: 'Master Data',
        },
        {
            step: 'Trụ cột 02',
            title: 'Dịch vụ & Giá niêm yết',
            desc: 'Cấu hình danh mục dịch vụ khám, xét nghiệm, CĐHA và niêm yết giá thu ngân',
            path: '/admin/danh-muc/dich-vu',
            icon: 'Stethoscope',
            badge: 'Bảng giá DV',
        },
        {
            step: 'Trụ cột 03',
            title: 'Thuốc BYT & Bệnh ICD-10',
            desc: 'Danh mục thuốc kê đơn ngoại trú (không quản lý kho) & từ điển bệnh lý ICD-10',
            path: '/admin/danh-muc/thuoc-vat-tu',
            icon: 'Pill',
            badge: 'Dược & ICD-10',
        },
        {
            step: 'Trụ cột 04',
            title: 'Nhân sự, Lịch trực & CCHN',
            desc: 'Quản lý hồ sơ bác sĩ, kiểm soát hạn Chứng chỉ hành nghề & duyệt nghỉ phép',
            path: '/admin/nhan-vien',
            icon: 'Users',
            badge: 'HR & CCHN',
        },
        {
            step: 'Trụ cột 05',
            title: 'Ma trận Phân quyền (RBAC)',
            desc: 'Thiết lập ma trận phân quyền truy cập theo vai trò chuẩn Least Privilege',
            path: '/admin/phan-quyen',
            icon: 'ShieldCheck',
            badge: 'IAM & RBAC',
        },
        {
            step: 'Trụ cột 06',
            title: 'Tuân thủ, Audit & Cấu hình',
            desc: 'Giám sát liên thông Đơn thuốc QG (TT26), Nhật ký Audit EMR & Cài đặt phòng khám',
            path: '/admin/tuan-thu',
            icon: 'Scales',
            badge: 'Governance',
        },
    ],
}

export function getPermissionModuleLabel(module, index = 0) {
    if (typeof module === 'string' && module.trim()) return module
    if (module && typeof module === 'object') {
        for (const value of [module.tenPhanHe, module.maPhanHe]) {
            if (typeof value === 'string' && value.trim()) return value
        }
    }
    return `Phân hệ ${index + 1}`
}

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
    navigationConfig: DEFAULT_NAVIGATION_CONFIG,
}

export function getNavigationConfig(clinicData) {
    const rawNav = clinicData?.navigationConfig
    const nav =
        rawNav && Array.isArray(rawNav.sidebarSections) && rawNav.sidebarSections.length >= 4
            ? rawNav
            : DEFAULT_NAVIGATION_CONFIG

    // Đảm bảo "Danh mục Chuyên khoa" luôn luôn có mặt trong sidebarSections (Danh mục Nền tảng)
    const enrichedSections = (nav.sidebarSections || []).map((section) => {
        if (section.id === 'pillar-catalogs' || (section.title && section.title.includes('DANH MỤC Y TẾ'))) {
            const enrichedMenus = (section.menus || []).map((menu) => {
                if (menu.id === 'catalogs' || (menu.title && menu.title.includes('Danh mục Nền tảng'))) {
                    const children = menu.children || []
                    const hasChuyenKhoa = children.some((c) => c.path === '/admin/danh-muc/chuyen-khoa')
                    if (!hasChuyenKhoa) {
                        return {
                            ...menu,
                            children: [
                                { label: 'Danh mục Chuyên khoa', path: '/admin/danh-muc/chuyen-khoa' },
                                ...children,
                            ],
                        }
                    }
                }
                return menu
            })
            return { ...section, menus: enrichedMenus }
        }
        return section
    })

    return {
        ...nav,
        sidebarSections: enrichedSections,
    }
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
    return clinicData?.authSeed || { user: { fullName: 'Quản trị viên Hệ thống', role: 'ADMIN' } }
}
