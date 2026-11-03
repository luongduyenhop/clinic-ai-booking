import { normalizeStaffRole } from '../constants/staffRoles.js'

const ADMIN = 'ADMIN'
const DOCTOR = 'BAC_SI'
const RECEPTION = 'LE_TAN'
const CASHIER = 'THU_NGAN'
const TECHNICIAN = 'KTV_CLS'
const LAB = 'KTV_XET_NGHIEM'
const STAFF = [ADMIN, DOCTOR, RECEPTION, CASHIER, TECHNICIAN, LAB]

// Each staff route needs its own boundary, even when its menu item is hidden.
const STAFF_PAGE_ROLES = {
    dashboard: [ADMIN],
    'reception-dashboard': [ADMIN, RECEPTION],
    'doctor-dashboard': [ADMIN, DOCTOR],
    reception: [ADMIN, RECEPTION],
    'check-in': [ADMIN, RECEPTION],
    queue: STAFF,
    appointments: [ADMIN, DOCTOR, RECEPTION, CASHIER],
    patients: [ADMIN, DOCTOR, RECEPTION, LAB],
    'exam-workstation': [ADMIN, DOCTOR],
    'specialty-exam': [ADMIN, DOCTOR],
    'paraclinical-work': [ADMIN, DOCTOR, TECHNICIAN, LAB],
    paraclinical: [ADMIN, DOCTOR, TECHNICIAN, LAB],
    // The cashier API also permits reception staff to collect fees.
    cashier: [ADMIN, CASHIER, RECEPTION],
    schedule: [ADMIN, DOCTOR, RECEPTION],
    reports: [ADMIN, RECEPTION, CASHIER, LAB],
    catalogs: [ADMIN],
    permissions: [ADMIN],
    templates: [ADMIN],
    compliance: [ADMIN],
    'service-packages': [ADMIN],
    'treatment-courses': [ADMIN],
    settings: [ADMIN],
}

const isWithin = (path, root) => path === root || path.startsWith(`${root}/`)

export function canAccessPortalPath(role, pathname) {
    const key = normalizeStaffRole(role)
    if (!key) return false
    const path = pathname.replace(/\/+$/, '') || '/'

    if (isWithin(path, '/admin')) return key === ADMIN
    if (isWithin(path, '/benh-nhan')) return key === 'BENH_NHAN'
    if (isWithin(path, '/doctor')) return [ADMIN, DOCTOR].includes(key)
    if (isWithin(path, '/reception')) return [ADMIN, RECEPTION].includes(key)
    if (isWithin(path, '/staff')) {
        if (path === '/staff') return STAFF.includes(key)
        const page = path.slice('/staff/'.length).split('/')[0]
        return STAFF_PAGE_ROLES[page]?.includes(key) || false
    }
    return true
}
