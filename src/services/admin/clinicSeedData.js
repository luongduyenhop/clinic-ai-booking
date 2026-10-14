// Tầng nạp Dữ liệu Seed Tập trung (clinicSeed.json)
// Khi kết nối Backend thực tế, chỉ cần thay đổi nguồn dữ liệu tại AdminService.js mà không cần sửa code giao diện React.

import rawSeed from './seed/clinicSeed.json'

export const PERMISSION_MODULES_23 = rawSeed.permissionModules || []

function buildRolePermissions(roleSeed, totalModules = 23) {
    if (Array.isArray(roleSeed.permissions) && roleSeed.permissions.length === totalModules) {
        return roleSeed.permissions
    }
    return Array.from({ length: totalModules }, (_, idx) => {
        const stt = idx + 1
        if (roleSeed.fullAccess) {
            return { stt, xem: true, them: true, sua: true, xoa: true, inXuat: true }
        }
        const xem = roleSeed.viewUpTo
            ? idx < roleSeed.viewUpTo
            : (roleSeed.viewIndices || []).includes(stt)
        return {
            stt,
            xem,
            them: (roleSeed.addIndices || []).includes(stt),
            sua: (roleSeed.editIndices || []).includes(stt),
            xoa: (roleSeed.deleteIndices || []).includes(stt),
            inXuat: (roleSeed.printIndices || []).includes(stt),
        }
    })
}

export function buildClinicSeedState(seedSource = rawSeed) {
    const totalModules = (seedSource.permissionModules || PERMISSION_MODULES_23).length || 23
    return {
        schemaVersion: seedSource.schemaVersion || '2.0.0-promax',
        authSeed: seedSource.authSeed,
        navigationConfig: seedSource.navigationConfig,
        masterOptions: seedSource.masterOptions,
        formDefaults: seedSource.formDefaults,
        permissionModules: seedSource.permissionModules || PERMISSION_MODULES_23,
        patients: seedSource.patients || [],
        appointments: seedSource.appointments || [],
        registrations: seedSource.registrations || [],
        paraclinicalTasks: seedSource.paraclinicalTasks || [],
        vouchers: seedSource.vouchers || [],
        newsCategories: seedSource.newsCategories || [],
        newsArticles: seedSource.newsArticles || [],
        catalogs: seedSource.catalogs || {},
        guideCategories: seedSource.guideCategories || [],
        guides: seedSource.guides || [],
        qaList: seedSource.qaList || [],
        staffList: seedSource.staffList || [],
        roles: (seedSource.roles || []).map((role) => ({
            id: role.id,
            tenVaiTro: role.tenVaiTro,
            moTa: role.moTa,
            permissions: buildRolePermissions(role, totalModules),
        })),
        templates: seedSource.templates || [],
        complianceObligations: seedSource.complianceObligations || [],
        auditLogs: seedSource.auditLogs || [],
        roleWorkbenches: seedSource.roleWorkbenches || {},
        addressShortcuts: seedSource.addressShortcuts || [],
        referrers: seedSource.referrers || [],
        servicePackageRegistrations: seedSource.servicePackageRegistrations || [],
        treatmentCourses: seedSource.treatmentCourses || [],
        corporateCheckups: seedSource.corporateCheckups || [],
        healthCheckupClassifications: seedSource.healthCheckupClassifications || [],
        inventoryBatches: [],
        cashierClosings: seedSource.cashierClosings || [],
        nationalDrugSync: seedSource.nationalDrugSync || [],
        nationalEhrSync: seedSource.nationalEhrSync || [],
        clinicSettings: seedSource.clinicSettings || {},
        systemNotifications: seedSource.systemNotifications || [],
    }
}

export const INITIAL_CLINIC_DATA = buildClinicSeedState(rawSeed)

export function getAuthSeed() {
    return rawSeed.authSeed
}

export function getNavigationConfig(clinicData = INITIAL_CLINIC_DATA) {
    return clinicData?.navigationConfig || rawSeed.navigationConfig
}

export function getMasterOptions(clinicData = INITIAL_CLINIC_DATA) {
    return clinicData?.masterOptions || rawSeed.masterOptions
}

export function getFormDefaults(clinicData = INITIAL_CLINIC_DATA) {
    return clinicData?.formDefaults || rawSeed.formDefaults
}

export function getProvincesFromCatalog(clinicData = INITIAL_CLINIC_DATA) {
    const diaChiList = clinicData?.catalogs?.diaChi || rawSeed.catalogs?.diaChi || []
    const uniqueProvinces = Array.from(new Set(diaChiList.map((d) => d.tenTinh).filter(Boolean)))
    return uniqueProvinces.length > 0 ? uniqueProvinces : [rawSeed.formDefaults?.defaultProvince || 'Thành phố Hà Nội']
}

export function getDistrictsByProvince(clinicData = INITIAL_CLINIC_DATA, provinceName = '') {
    const diaChiList = clinicData?.catalogs?.diaChi || rawSeed.catalogs?.diaChi || []
    const filtered = provinceName ? diaChiList.filter((d) => d.tenTinh === provinceName) : diaChiList
    const districts = Array.from(new Set(filtered.map((d) => d.quanHuyen).filter(Boolean)))
    return districts.length > 0 ? districts : [rawSeed.formDefaults?.defaultDistrict || 'Quận Cầu Giấy']
}

export function getWardsByDistrict(clinicData = INITIAL_CLINIC_DATA, districtName = '') {
    const diaChiList = clinicData?.catalogs?.diaChi || rawSeed.catalogs?.diaChi || []
    const filtered = districtName ? diaChiList.filter((d) => d.quanHuyen === districtName) : diaChiList
    const wards = Array.from(new Set(filtered.map((d) => d.phuongXa).filter(Boolean)))
    return wards.length > 0 ? wards : [rawSeed.formDefaults?.defaultWard || 'Phường Dịch Vọng']
}
