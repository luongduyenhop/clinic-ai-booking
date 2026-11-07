import { BaseServices } from '../BaseService'

export class ReceptionService extends BaseServices {
    getSpecialties = (config = {}) =>
        this.get('/api/v1/medical/specialties', { __skipGlobalLoading: true, ...config })

    getRooms = (chuyenKhoaId, config = {}) =>
        this.get('/api/v1/reception/resources/rooms', {
            params: { chuyen_khoa_id: chuyenKhoaId || undefined },
            __skipGlobalLoading: true,
            ...config,
        })

    getDoctors = (params = {}, config = {}) => {
        const queryParams = { ...params }
        if (queryParams.chuyen_khoa_id && !queryParams.specialty_id) {
            queryParams.specialty_id = queryParams.chuyen_khoa_id
        }
        if (queryParams.specialty_id) {
            queryParams.specialty_id = Number(queryParams.specialty_id)
        }
        return this.get('/api/v1/medical/doctors', {
            params: { page_size: 100, ...queryParams },
            __skipGlobalLoading: true,
            ...config,
        })
    }

    getServices = (config = {}) =>
        this.get('/api/v1/medical/services', { __skipGlobalLoading: true, ...config })

    getFlowBoard = (params = {}, config = {}) =>
        this.get('/api/v1/reception/flow-board', { params, __skipGlobalLoading: true, ...config })

    getShiftDashboard = (params = {}, config = {}) =>
        this.get('/api/v1/reception/dashboard/shift-summary', { params, __skipGlobalLoading: true, ...config })

    getRoomStatusDashboard = (params = {}, config = {}) =>
        this.get('/api/v1/reception/dashboard/room-status', { params, __skipGlobalLoading: true, ...config })

    checkIn = (payload, config = {}) =>
        this.post('/api/v1/reception/check-in', payload, config)

    walkIn = (payload, config = {}) =>
        this.post('/api/v1/reception/walk-in', payload, { __skipGlobalError: true, ...config })

    restoreTicket = (ticketId, config = {}) =>
        this.post(`/api/v1/reception/queue/${ticketId}/restore`, {}, config)

    postponeTicket = (ticketId, payload = {}, config = {}) =>
        this.post(`/api/v1/reception/queue/${ticketId}/postpone`, payload, config)

    transferRoom = (ticketId, payload = {}, config = {}) =>
        this.post(`/api/v1/reception/queue/${ticketId}/transfer`, payload, config)

    closeTicket = (ticketId, payload = {}, config = {}) =>
        this.patch(`/api/v1/reception/queue/${ticketId}/close`, payload, config)

    leaveQueue = (ticketId, payload = {}, config = {}) =>
        this.patch(`/api/v1/reception/queue/${ticketId}/leave`, payload, config)

    getDoctorQueue = (doctorId, params = {}, config = {}) =>
        this.get(`/api/v1/reception/queue/${doctorId}`, { params, __skipGlobalLoading: true, ...config })

    searchAppointments = (params = {}, config = {}) =>
        this.get('/api/v1/reception/search-appointments', { params, __skipGlobalLoading: true, ...config })

    getAppointments = (params = {}, config = {}) =>
        this.get('/api/v1/reception/appointments', { params, __skipGlobalLoading: true, ...config })

    searchPatients = (params = {}, config = {}) => {
        const queryParams = { ...params }
        if (queryParams.q && !queryParams.search) {
            queryParams.search = queryParams.q
        }
        return this.get('/api/v1/reception/patients', { params: queryParams, __skipGlobalLoading: true, ...config })
    }

    getPatientDetail = (patientId, config = {}) =>
        this.get(`/api/v1/reception/patients/${patientId}`, { __skipGlobalLoading: true, ...config })

    createPatient = (payload, config = {}) =>
        this.post('/api/v1/reception/patients', payload, config)

    updatePatient = (patientId, payload, config = {}) =>
        this.put(`/api/v1/reception/patients/${patientId}`, payload, config)

    getPatientPackages = (patientId, config = {}) =>
        this.get(`/api/v1/reception/patients/${patientId}/packages`, { __skipGlobalLoading: true, ...config })

    getPatientHistorySummary = (patientId, config = {}) =>
        this.get(`/api/v1/reception/patients/${patientId}/history-summary`, { __skipGlobalLoading: true, ...config })

    getRoster = (params = {}, config = {}) =>
        this.get('/api/v1/reception/resources/roster', { params, __skipGlobalLoading: true, ...config })

    getRosterTemplate = (params = {}, config = {}) =>
        this.get('/api/v1/reception/resources/roster-template', { params, __skipGlobalLoading: true, ...config })

    getDoctorAbsences = (params = {}, config = {}) =>
        this.get('/api/v1/reception/incidents/doctor-absences', { params, __skipGlobalLoading: true, ...config })

    getIncidentAffectedPatients = (incidentId, config = {}) =>
        this.get(`/api/v1/reception/incidents/${incidentId}/affected-patients`, { __skipGlobalLoading: true, ...config })

    rebalanceQueue = (payload, config = {}) =>
        this.post('/api/v1/reception/incidents/rebalance-queue', payload, config)

    cancelIncidentTickets = (payload, config = {}) =>
        this.post('/api/v1/reception/incidents/cancel-tickets', payload, config)

    processNoShows = (params = {}, config = {}) =>
        this.post('/api/v1/reception/process-no-shows', null, { params, ...config })

    getDoctorSlots = (doctorId, queryDate, config = {}) =>
        this.get(`/api/v1/appointments/doctors/${doctorId}/slots`, {
            params: { query_date: queryDate },
            __skipGlobalLoading: true,
            ...config,
        })

    createAppointment = (payload, config = {}) =>
        this.post('/api/v1/appointments', payload, config)

    rescheduleAppointment = (appointmentId, payload, config = {}) =>
        this.post(`/api/v1/appointments/${appointmentId}/reschedule`, payload, config)

    updateAppointment = (appointmentId, payload, config = {}) =>
        this.rescheduleAppointment(appointmentId, payload, config)

    confirmAppointment = (appointmentId, config = {}) =>
        this.post(`/api/v1/appointments/${appointmentId}/confirm`, {}, config)

    cancelAppointment = (appointmentId, payload, config = {}) =>
        this.post(`/api/v1/appointments/${appointmentId}/cancel`, payload, config)

    markNoShow = (appointmentId, payload = {}, config = {}) =>
        this.post(`/api/v1/appointments/${appointmentId}/no-show`, payload, config)

    processUnconfirmedAppointments = (params = {}, config = {}) =>
        this.post('/api/v1/appointments/process-unconfirmed', null, { params, ...config })

    getWaitlist = (params = {}, config = {}) =>
        this.get('/api/v1/reception/waitlist', { params, __skipGlobalLoading: true, ...config })

    checkInWaitlist = (waitlistId, config = {}) =>
        this.post(`/api/v1/reception/waitlist/${waitlistId}/check-in`, {}, config)

    cancelWaitlist = (waitlistId, config = {}) =>
        this.delete(`/api/v1/reception/waitlist/${waitlistId}`, config)

    payInvoice = (invoiceId, payload, config = {}) =>
        this.post(`/api/v1/cashier/invoices/${invoiceId}/pay`, payload, config)

    getReportSummary = (params = {}, config = {}) =>
        this.get('/api/v1/reception/reports/summary', { params, __skipGlobalLoading: true, ...config })

    getAuditLogs = (params = {}, config = {}) =>
        this.get('/api/v1/reception/reports/audit-logs', { params, __skipGlobalLoading: true, ...config })

    getShiftPreCloseAudit = (params = {}, config = {}) =>
        this.get('/api/v1/reception/shift/pre-close-audit', { params, __skipGlobalLoading: true, ...config })

    closeShift = (payload, config = {}) =>
        this.post('/api/v1/reception/shift/close', payload, config)
}

export const receptionService = new ReceptionService()
