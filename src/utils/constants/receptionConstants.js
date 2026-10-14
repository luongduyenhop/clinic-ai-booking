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
}

export const QUEUE_STATUS_LABELS = {
    [QUEUE_STATUS.WAITING]: { label: 'Đang chờ', color: 'gold' },
    [QUEUE_STATUS.CALLED]: { label: 'Đã gọi', color: 'processing' },
    [QUEUE_STATUS.DEFERRED]: { label: 'Tạm hoãn', color: 'warning' },
    [QUEUE_STATUS.IN_CONSULTATION]: { label: 'Đang khám', color: 'purple' },
    [QUEUE_STATUS.COMPLETED]: { label: 'Hoàn tất', color: 'success' },
    [QUEUE_STATUS.CANCELLED]: { label: 'Đã hủy', color: 'error' },
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
