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
export const ROLE_CASHIER = 'THU_NGAN'

export const ADMIN_ROLES = [
    ROLE_ADMIN,
    ROLE_ADMINISTRATOR,
    ROLE_DOCTOR,
    ROLE_RECEPTIONIST,
    ROLE_CASHIER,
]
export const CUSTOMER_ROLES = [
    ROLE_CUSTOMER,
    ROLE_USER,
    ...ADMIN_ROLES,
]
