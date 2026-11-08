const ROLE_KEYS = {
    ADMIN: 'ADMIN', ADMINISTRATOR: 'ADMIN', QUAN_TRI: 'ADMIN', QUAN_LY: 'ADMIN',
    BAC_SI: 'BAC_SI', DOCTOR: 'BAC_SI', BS: 'BAC_SI',
    LE_TAN: 'LE_TAN', RECEPTIONIST: 'LE_TAN', RECEPTION_SUPERVISOR: 'LE_TAN',
    THU_NGAN: 'LE_TAN', CASHIER: 'LE_TAN',
    KTV_CLS: 'KTV_CLS', TECHNICIAN: 'KTV_CLS', KY_THUAT_VIEN: 'KTV_CLS',
    KTV_XET_NGHIEM: 'KTV_XET_NGHIEM', LAB_TECH: 'KTV_XET_NGHIEM', 'ROLE-LAB-TECH': 'KTV_XET_NGHIEM',
    BENH_NHAN: 'BENH_NHAN', PATIENT: 'BENH_NHAN', CUSTOMER: 'BENH_NHAN', USER: 'BENH_NHAN',
}

export const normalizeStaffRole = (role) => ROLE_KEYS[String(role || '').trim().toUpperCase()] || null

export const ROLE_CONFIGS = {
    ADMIN: {
        label: 'Quản trị viên', badge: 'Quản trị HIS',
        color: 'bg-rose-50 text-rose-700 border-rose-200', dotColor: 'bg-rose-500',
    },
    BAC_SI: {
        label: 'Bác sĩ', badge: 'Lâm sàng TT32',
        color: 'bg-sky-50 text-sky-700 border-sky-200', dotColor: 'bg-sky-500',
    },
    LE_TAN: {
        label: 'Lễ tân – Thu ngân', badge: 'Tiếp đón & Viện phí VietQR',
        color: 'bg-teal-50 text-teal-700 border-teal-200', dotColor: 'bg-teal-500',
    },
    THU_NGAN: {
        label: 'Lễ tân – Thu ngân', badge: 'Tiếp đón & Viện phí VietQR',
        color: 'bg-teal-50 text-teal-700 border-teal-200', dotColor: 'bg-teal-500',
    },
    KTV_CLS: {
        label: 'Kỹ thuật viên CLS', badge: 'Xét nghiệm & CĐHA',
        color: 'bg-purple-50 text-purple-700 border-purple-200', dotColor: 'bg-purple-500',
    },
    KTV_XET_NGHIEM: {
        label: 'KTV Xét nghiệm', badge: 'Huyết học - Sinh hóa (LIS)',
        color: 'bg-indigo-50 text-indigo-700 border-indigo-200', dotColor: 'bg-indigo-500',
    },
    BENH_NHAN: {
        label: 'Bệnh nhân', badge: 'Cổng Bệnh nhân',
        color: 'bg-teal-50 text-teal-700 border-teal-200', dotColor: 'bg-teal-500',
    },
}

const UNKNOWN_ROLE_CONFIG = {
    label: 'Chưa xác định vai trò', badge: 'Chưa xác định',
    color: 'bg-slate-50 text-slate-700 border-slate-200', dotColor: 'bg-slate-400',
}

export const getStaffRoleConfig = (role) => ROLE_CONFIGS[normalizeStaffRole(role)] || UNKNOWN_ROLE_CONFIG
