export const APPOINTMENT_STATUS = {
    BOOKED: 'BOOKED',
    CONFIRMED: 'CONFIRMED',
    CHECKED_IN: 'CHECKED_IN',
    RESCHEDULED: 'RESCHEDULED',
    CANCELLED: 'CANCELLED',
    NO_SHOW: 'NO_SHOW',
}

export const APPOINTMENT_STATUS_LABELS = {
    [APPOINTMENT_STATUS.BOOKED]: { label: 'Đã đặt', color: 'blue' },
    [APPOINTMENT_STATUS.CONFIRMED]: { label: 'Đã xác nhận', color: 'cyan' },
    [APPOINTMENT_STATUS.CHECKED_IN]: { label: 'Đã tiếp nhận', color: 'green' },
    [APPOINTMENT_STATUS.RESCHEDULED]: { label: 'Đã đổi lịch', color: 'orange' },
    [APPOINTMENT_STATUS.CANCELLED]: { label: 'Đã hủy', color: 'red' },
    [APPOINTMENT_STATUS.NO_SHOW]: { label: 'Vắng mặt', color: 'default' },
}

export const QUEUE_STATUS = {
    WAITING: 'WAITING',
    CALLED: 'CALLED',
    DEFERRED: 'DEFERRED',
    IN_CONSULTATION: 'IN_CONSULTATION',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    CHO_KHAM: 'CHO_KHAM',
    cho_kham: 'cho_kham',
    dang_kham: 'dang_kham',
    tam_hoan: 'tam_hoan',
    da_kham: 'da_kham',
    bo_kham: 'bo_kham',
    da_dong_ve: 'da_dong_ve',
}

export const QUEUE_STATUS_LABELS = {
    [QUEUE_STATUS.WAITING]: { label: 'Chờ khám', color: 'gold' },
    [QUEUE_STATUS.CALLED]: { label: 'Đã gọi', color: 'processing' },
    [QUEUE_STATUS.DEFERRED]: { label: 'Tạm hoãn', color: 'warning' },
    [QUEUE_STATUS.IN_CONSULTATION]: { label: 'Đang khám', color: 'purple' },
    [QUEUE_STATUS.COMPLETED]: { label: 'Hoàn tất', color: 'success' },
    [QUEUE_STATUS.CANCELLED]: { label: 'Đã hủy', color: 'error' },
    CHO_KHAM: { label: 'Chờ khám', color: 'gold' },
    cho_kham: { label: 'Chờ khám', color: 'gold' },
    dang_kham: { label: 'Đang khám', color: 'purple' },
    tam_hoan: { label: 'Tạm hoãn', color: 'warning' },
    da_kham: { label: 'Đã hoàn tất', color: 'success' },
    bo_kham: { label: 'Bỏ khám', color: 'error' },
    da_dong_ve: { label: 'Đã đóng vé', color: 'default' },
}

export const PAYMENT_STATUS = {
    UNPAID: 'UNPAID',
    PARTIALLY_PAID: 'PARTIALLY_PAID',
    PAID: 'PAID',
    REFUND_PENDING: 'REFUND_PENDING',
}

export const PAYMENT_STATUS_LABELS = {
    [PAYMENT_STATUS.UNPAID]: { label: 'Chưa thanh toán', color: 'error' },
    [PAYMENT_STATUS.PARTIALLY_PAID]: { label: 'Thanh toán một phần', color: 'warning' },
    [PAYMENT_STATUS.PAID]: { label: 'Đã thanh toán', color: 'success' },
    [PAYMENT_STATUS.REFUND_PENDING]: { label: 'Chờ hoàn tiền', color: 'processing' },
}

export const TASK_SEVERITY = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL',
}

export const TASK_SEVERITY_LABELS = {
    [TASK_SEVERITY.LOW]: { label: 'Thấp', color: 'default' },
    [TASK_SEVERITY.MEDIUM]: { label: 'Trung bình', color: 'blue' },
    [TASK_SEVERITY.HIGH]: { label: 'Cao', color: 'warning' },
    [TASK_SEVERITY.CRITICAL]: { label: 'Khẩn cấp', color: 'error' },
}

export const RECEPTION_ROLES_OPTIONS = [
    { value: 'RECEPTIONIST', label: 'Lễ tân (Receptionist)' },
    { value: 'RECEPTION_SUPERVISOR', label: 'Giám sát lễ tân (Reception Supervisor)' },
]

export const MISSING_DOC_LABELS = {
    CCCD_CHUA_CONG_CHUNG: 'Bản sao CCCD chưa công chứng / Thiếu CCCD gắn chip',
    SO_KHAM_BENH: 'Sổ theo dõi khám bệnh cũ',
    GIAY_HEN_TAI_KHAM: 'Giấy hẹn tái khám',
}

export const CLINIC_TIME_SLOTS = [
    '07:30 - 08:00', '08:00 - 08:30', '08:30 - 09:00', '09:00 - 09:30',
    '09:30 - 10:00', '10:00 - 10:30', '10:30 - 11:00', '11:00 - 11:30',
    '13:30 - 14:00', '14:00 - 14:30', '14:30 - 15:00', '15:00 - 15:30',
    '15:30 - 16:00', '16:00 - 16:30'
]
export const initialTimeSlots = CLINIC_TIME_SLOTS
