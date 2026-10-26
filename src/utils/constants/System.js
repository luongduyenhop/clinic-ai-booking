export const DOMAIN = import.meta.env.VITE_API_URL || 'http://localhost:8000'
export const SIGNALR_HUB = import.meta.env.VITE_SIGNALR_HUB_URL || ''

export const TOKEN = 'accessToken'
export const REFRESH_TOKEN = 'refreshToken'
export const USER_ROLE = 'userRole'
export const USER_INFO = 'userInfo'

// Danh sách Role chuẩn
export const ROLE_CUSTOMER = 'CUSTOMER'
export const ROLE_USER = 'USER'
export const ROLE_ADMIN = 'ADMIN'
export const ROLE_ADMINISTRATOR = 'ADMINISTRATOR'
export const ROLE_DOCTOR = 'BAC_SI'
export const ROLE_RECEPTIONIST = 'LE_TAN'
export const ROLE_RECEPTION_SUPERVISOR = 'RECEPTION_SUPERVISOR'
export const ROLE_CASHIER = 'THU_NGAN'
export const ROLE_TECHNICIAN = 'KTV_CLS'
export const ROLE_LAB_TECH = 'KTV_XET_NGHIEM'

export const ADMIN_ROLES = [
    ROLE_ADMIN,
    ROLE_ADMINISTRATOR,
    'QUAN_TRI',
    'QUAN_LY',
    ROLE_DOCTOR,
    'DOCTOR',
    ROLE_RECEPTIONIST,
    'RECEPTIONIST',
    ROLE_CASHIER,
    'CASHIER',
    ROLE_TECHNICIAN,
    'TECHNICIAN',
    'KTV_CLS',
    ROLE_LAB_TECH,
    'KTV_XET_NGHIEM',
    'LAB_TECH',
    'ROLE-LAB-TECH',
]

export const STAFF_ROLES = [
    ROLE_ADMIN,
    ROLE_ADMINISTRATOR,
    'QUAN_TRI',
    'QUAN_LY',
    ROLE_DOCTOR,
    'DOCTOR',
    ROLE_RECEPTIONIST,
    'RECEPTIONIST',
    ROLE_RECEPTION_SUPERVISOR,
    ROLE_CASHIER,
    'CASHIER',
    ROLE_TECHNICIAN,
    'TECHNICIAN',
    'KTV_CLS',
    ROLE_LAB_TECH,
    'KTV_XET_NGHIEM',
    'LAB_TECH',
    'ROLE-LAB-TECH',
]

export const RECEPTIONIST_ROLES = [
    ROLE_RECEPTIONIST,
    'RECEPTIONIST',
    ROLE_RECEPTION_SUPERVISOR,
    ROLE_ADMIN,
    ROLE_ADMINISTRATOR,
    'QUAN_TRI',
]

export const DOCTOR_ROLES = [
    ROLE_DOCTOR,
    'DOCTOR',
    ROLE_ADMIN,
    ROLE_ADMINISTRATOR,
    'QUAN_TRI',
]

export const CUSTOMER_ROLES = [
    ROLE_CUSTOMER,
    ROLE_USER,
    'PATIENT',
    'BENH_NHAN',
    ...ADMIN_ROLES,
]

/**
 * Điều hướng thông minh theo vai trò người dùng
 */
export const getRoleDefaultPath = (role) => {
    const r = String(role || '').toUpperCase()
    if (r === 'ADMIN' || r === 'ADMINISTRATOR' || r === 'QUAN_TRI' || r === 'QUAN_LY') return '/admin'
    if (r === 'BAC_SI' || r === 'DOCTOR' || r === 'BS') return '/doctor'
    if (r === 'LE_TAN' || r === 'RECEPTIONIST' || r === 'RECEPTION_SUPERVISOR') return '/reception/dashboard'
    if (r === 'THU_NGAN' || r === 'CASHIER') return '/admin/thu-chi'
    if (r === 'KTV_XET_NGHIEM' || r === 'LAB_TECH' || r === 'ROLE-LAB-TECH') return '/staff/paraclinical-work?nhom=XET_NGHIEM'
    if (r === 'KTV_CLS' || r === 'TECHNICIAN') return '/staff/paraclinical-work'
    return '/benh-nhan'
}

/**
 * Kiểm tra xem vai trò có phải là nhân viên nội bộ phòng khám hay không
 */
export const isStaffRole = (role) => {
    const r = String(role || '').toUpperCase()
    return STAFF_ROLES.includes(r)
}
