import { BaseServices } from '../BaseService'

export const FIVE_SPECIALTIES = [
    { id: 1, code: 'KHOA_NOI', name: 'Khoa Nội tổng quát', prefix: 'NOI', defaultRoom: 'Phòng 101 - Tầng 1' },
    { id: 2, code: 'KHOA_MAT', name: 'Khoa Mắt', prefix: 'MAT', defaultRoom: 'Phòng 102 - Tầng 1' },
    { id: 3, code: 'KHOA_TMH', name: 'Khoa Tai - Mũi - Họng', prefix: 'TMH', defaultRoom: 'Phòng 203 - Tầng 2' },
    { id: 4, code: 'KHOA_RHM', name: 'Khoa Răng - Hàm - Mặt', prefix: 'RHM', defaultRoom: 'Phòng 204 - Tầng 2' },
    { id: 5, code: 'KHOA_DA_LIEU', name: 'Khoa Da liễu', prefix: 'DL', defaultRoom: 'Phòng 302 - Tầng 3' },
]

export class ReceptionService extends BaseServices {
    // ── 1. Danh mục & Tài nguyên ──────────────────────────────────────
    getSpecialties = (config = {}) =>
        this.get('/api/v1/medical/specialties', config)

    getRooms = (chuyenKhoaId, config = {}) =>
        this.get('/api/v1/reception/resources/rooms', {
            params: { chuyen_khoa_id: chuyenKhoaId || undefined },
            ...config,
        })

    getDoctors = (params = {}, config = {}) =>
        this.get('/api/v1/medical/doctors', {
            params: { page_size: 100, ...params },
            ...config,
        })

    getServices = (config = {}) =>
        this.get('/api/v1/medical/services', config)

    // ── 2. Hàng đợi & Điều phối (Flow Board) ──────────────────────────
    getFlowBoard = (params = {}, config = {}) =>
        this.get('/api/v1/reception/flow-board', { params, ...config })

    getShiftDashboard = (params = {}, config = {}) =>
        this.get('/api/v1/reception/dashboard/shift-summary', { params, ...config })

    getRoomStatusDashboard = (params = {}, config = {}) =>
        this.get('/api/v1/reception/dashboard/room-status', { params, ...config })

    // ── 3. Check-in & Cấp số thứ tự (STT theo buồng khám) ────────────
    checkIn = (payload, config = {}) =>
        this.post('/api/v1/reception/check-in', payload, config)

    walkIn = (payload, config = {}) =>
        this.post('/api/v1/reception/walk-in', payload, config)

    walkInQuick = (payload, config = {}) =>
        this.post('/api/v1/reception/walk-in-quick', payload, config)

    // ── 4. Thao tác vé khám hàng đợi ───────────────────────────────────
    restoreTicket = (ticketId, config = {}) =>
        this.post(`/api/v1/reception/queue/${ticketId}/restore`, {}, config)

    closeTicket = (ticketId, payload = {}, config = {}) =>
        this.patch(`/api/v1/reception/queue/${ticketId}/close`, payload, config)

    leaveQueue = (ticketId, payload = {}, config = {}) =>
        this.patch(`/api/v1/reception/queue/${ticketId}/leave`, payload, config)

    // ── 5. Tra cứu Lịch hẹn & Bệnh nhân ───────────────────────────────
    searchAppointments = (params = {}, config = {}) =>
        this.get('/api/v1/reception/search-appointments', { params, ...config })

    getAppointments = (params = {}, config = {}) =>
        this.get('/api/v1/reception/appointments', { params, ...config })

    searchPatients = (params = {}, config = {}) =>
        this.get('/api/v1/admin/patients', { params, ...config })

    getPatientDetail = (patientId, config = {}) =>
        this.get(`/api/v1/admin/patients/${patientId}`, config)

    createPatient = (payload, config = {}) =>
        this.post('/api/v1/admin/patients', payload, config)

    updatePatient = (patientId, payload, config = {}) =>
        this.put(`/api/v1/admin/patients/${patientId}`, payload, config)

    // ── 6. Lịch hẹn & Viện phí ─────────────────────────────────────────
    createAppointment = (payload, config = {}) =>
        this.post('/api/v1/appointments', payload, config)

    updateAppointment = (appointmentId, payload, config = {}) =>
        this.put(`/api/v1/appointments/${appointmentId}`, payload, config)

    cancelAppointment = (appointmentId, payload, config = {}) =>
        this.patch(`/api/v1/appointments/${appointmentId}/cancel`, payload, config)

    payInvoice = (invoiceId, payload, config = {}) =>
        this.post(`/api/v1/cashier/invoices/${invoiceId}/pay`, payload, config)
}

export const receptionService = new ReceptionService()
