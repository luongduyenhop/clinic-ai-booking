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

export const ADMIN_ROLES = [
    ROLE_ADMIN,
    ROLE_ADMINISTRATOR,
    ROLE_DOCTOR,
    'DOCTOR',
    ROLE_RECEPTIONIST,
    'RECEPTIONIST',
    ROLE_CASHIER,
    'CASHIER',
    ROLE_TECHNICIAN,
    'TECHNICIAN',
    'KTV_CLS',
]

export const STAFF_ROLES = [
    ROLE_ADMIN,
    ROLE_ADMINISTRATOR,
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
]

export const RECEPTIONIST_ROLES = [
    ROLE_RECEPTIONIST,
    'RECEPTIONIST',
    ROLE_RECEPTION_SUPERVISOR,
    ROLE_ADMIN,
    ROLE_ADMINISTRATOR,
]

export const DOCTOR_ROLES = [
    ROLE_DOCTOR,
    'DOCTOR',
    ROLE_ADMIN,
    ROLE_ADMINISTRATOR,
]

export const CUSTOMER_ROLES = [
    ROLE_CUSTOMER,
    ROLE_USER,
    'PATIENT',
    'BENH_NHAN',
    ...ADMIN_ROLES,
]
