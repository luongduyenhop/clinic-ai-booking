import { createSlice } from '@reduxjs/toolkit'
import {
    fetchReceptionDataAsync,
    resetReceptionDataAsync,
    switchReceptionRoleAsync,
    fetchFlowBoardAsync,
    resumeQueueEntryAsync,
    callQueueEntryAsync,
    markAbsentAsync,
    deferQueueEntryAsync,
    fetchDoctorQueueAsync,
    fetchAppointmentsAsync,
    checkInAppointmentAsync,
    confirmAppointmentAsync,
    markAppointmentNoShowAsync,
    createAppointmentAsync,
    updateAppointmentAsync,
    cancelAppointmentAsync,
    registerWalkInQuickAsync,
    registerWalkInAsync,
    searchPatientsAsync,
    fetchShiftDashboardAsync,
    fetchRosterAsync,
    fetchRosterTemplateAsync,
    fetchRoomsAsync,
    fetchDoctorAbsencesAsync,
    fetchPatientPackagesAsync,
    fetchPatientHistorySummaryAsync,
    createPatientAsync,
    updatePatientAsync,
    getPatientDetailAsync,
    fetchReceptionWaitlistAsync,
    checkInWaitlistAsync,
    cancelWaitlistAsync,
    fetchReportSummaryAsync,
    fetchAuditLogsAsync,
    fetchShiftPreCloseAuditAsync,
    closeReceptionShiftAsync,
} from '../../actions/reception/receptionAction'

export * from '../../actions/reception/receptionAction'

const initialState = {
    departments: [],
    doctors: [],
    rooms: [],
    services: [],
    patients: [],
    patientPagination: {
        page: 1,
        pageSize: 15,
        totalItems: 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
    },
    appointments: [],
    appointmentsPagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
    },
    queueEntries: [],
    waitlist: [],
    waitlistLoading: false,
    shiftSummary: null,
    roomStatus: [],
    roster: [],
    rosterTemplate: [],
    doctorAbsences: [],
    patientPackages: [],
    patientHistorySummary: null,
    flowBoardSummary: null,
    selectedPatientDetail: null,
    patientDetailLoading: false,
    tasks: [],
    auditLogs: [],
    auditPagination: {
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
    },
    auditLoading: false,
    reportSummary: null,
    reportLoading: false,
    shiftAuditData: null,
    shiftAuditLoading: false,
    closeShiftSubmitting: false,
    invoices: [],
    activeRole: 'RECEPTIONIST',
    loading: false,
    queueLoading: false,
    error: null,
    isInitialized: false,
}

const receptionSlice = createSlice({
    name: 'reception',
    initialState,
    reducers: {
        setActiveRoleLocally: (state, action) => {
            state.activeRole = action.payload
        },
        clearReceptionError: (state) => {
            state.error = null
        },
        setQueueEntries: (state, action) => {
            state.queueEntries = action.payload || []
        },
        clearSelectedPatientDetail: (state) => {
            state.selectedPatientDetail = null
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchReceptionDataAsync.pending, (state) => {
                if (!state.isInitialized) state.loading = true
                state.error = null
            })
            .addCase(fetchReceptionDataAsync.fulfilled, (state, action) => {
                state.loading = false
                state.isInitialized = true
                if (action.payload) {
                    if (action.payload.departments) state.departments = action.payload.departments
                    if (action.payload.rooms) state.rooms = action.payload.rooms
                    if (action.payload.doctors) state.doctors = action.payload.doctors
                    if (action.payload.services) state.services = action.payload.services
                    if (action.payload.queueEntries) state.queueEntries = action.payload.queueEntries
                }
            })
            .addCase(fetchReceptionDataAsync.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload || 'Lỗi tải dữ liệu lễ tân'
            })

            // Shift Dashboard (FC-10, FC-11)
            .addCase(fetchShiftDashboardAsync.fulfilled, (state, action) => {
                if (action.payload) {
                    state.shiftSummary = action.payload.shiftSummary
                    state.roomStatus = action.payload.roomStatus || []
                }
            })

            // Roster (FC-15)
            .addCase(fetchRosterAsync.fulfilled, (state, action) => {
                if (Array.isArray(action.payload)) {
                    state.roster = action.payload
                }
            })

            // Roster Template (FC-15 / API 6.3)
            .addCase(fetchRosterTemplateAsync.fulfilled, (state, action) => {
                if (Array.isArray(action.payload)) {
                    state.rosterTemplate = action.payload
                }
            })

            // Physical Rooms (FC-15 / API 6.2)
            .addCase(fetchRoomsAsync.fulfilled, (state, action) => {
                if (Array.isArray(action.payload)) {
                    state.rooms = action.payload
                }
            })

            // Incidents / Doctor Absences (FC-13)
            .addCase(fetchDoctorAbsencesAsync.fulfilled, (state, action) => {
                if (Array.isArray(action.payload)) {
                    state.doctorAbsences = action.payload
                }
            })

            // Patient Packages & History Summary (FC-17)
            .addCase(fetchPatientPackagesAsync.fulfilled, (state, action) => {
                state.patientPackages = action.payload || []
            })
            .addCase(fetchPatientHistorySummaryAsync.fulfilled, (state, action) => {
                state.patientHistorySummary = action.payload || null
            })

            // Appointments (FC-12)
            .addCase(fetchAppointmentsAsync.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchAppointmentsAsync.fulfilled, (state, action) => {
                state.loading = false
                if (action.payload?.items) {
                    state.appointments = action.payload.items
                    state.appointmentsPagination = action.payload.meta || state.appointmentsPagination
                } else if (Array.isArray(action.payload)) {
                    state.appointments = action.payload
                }
            })
            .addCase(fetchAppointmentsAsync.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

            // Confirm Appointment
            .addCase(confirmAppointmentAsync.fulfilled, (state, action) => {
                const aptId = action.payload?.appointmentId || action.payload?.id
                if (aptId) {
                    const app = state.appointments.find((a) => a.id === aptId || a.id === Number(aptId))
                    if (app) {
                        app.trang_thai_lich = 'da_xac_nhan'
                        app.status = 'CONFIRMED'
                    }
                }
            })

            // Mark No-Show
            .addCase(markAppointmentNoShowAsync.fulfilled, (state, action) => {
                const aptId = action.payload?.appointmentId || action.payload?.id
                if (aptId) {
                    const app = state.appointments.find((a) => a.id === aptId || a.id === Number(aptId))
                    if (app) {
                        app.trang_thai_lich = 'vang_mat'
                        app.status = 'NO_SHOW'
                    }
                }
            })

            // Cancel Appointment
            .addCase(cancelAppointmentAsync.fulfilled, (state, action) => {
                const aptId = action.payload?.id || action.payload?.appointment_id
                if (aptId) {
                    const app = state.appointments.find((a) => a.id === aptId || a.id === Number(aptId))
                    if (app) {
                        app.trang_thai_lich = 'da_huy'
                        app.status = 'CANCELLED'
                        if (action.payload?.ly_do_huy) {
                            app.ly_do_huy = action.payload.ly_do_huy
                        }
                    }
                }
            })

            // Reschedule Appointment
            .addCase(updateAppointmentAsync.fulfilled, (state, action) => {
                const aptId = action.payload?.id || action.payload?.appointment_id
                if (aptId) {
                    const app = state.appointments.find((a) => a.id === aptId || a.id === Number(aptId))
                    if (app && action.payload) {
                        if (action.payload.ngay_kham) app.ngay_kham = action.payload.ngay_kham
                        if (action.payload.gio_kham) app.gio_kham = action.payload.gio_kham
                        if (action.payload.ma_lich_kham) app.ma_lich_kham = action.payload.ma_lich_kham
                        if (action.payload.trang_thai) app.trang_thai_lich = action.payload.trang_thai
                    }
                }
            })

            // Create Appointment
            .addCase(createAppointmentAsync.fulfilled, (state, action) => {
                if (action.payload && action.payload.id) {
                    state.appointments.unshift(action.payload)
                }
            })

            // Check-in (FC-01)
            .addCase(checkInAppointmentAsync.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(checkInAppointmentAsync.fulfilled, (state, action) => {
                state.loading = false
                const ticket = action.payload?.ticket || action.payload
                const aptId = action.payload?.appointmentId

                if (ticket) {
                    const idx = state.queueEntries.findIndex((q) => q.id === ticket.id || (q.backendId && q.backendId === ticket.backendId))
                    if (idx >= 0) {
                        state.queueEntries[idx] = ticket
                    } else {
                        state.queueEntries.unshift(ticket)
                    }
                }

                if (aptId) {
                    const app = state.appointments.find((a) => a.id === aptId || a.id === Number(aptId))
                    if (app) {
                        app.status = 'DA_DEN'
                        app.trang_thai_lich = 'da_tiep_nhan'
                        app.so_thu_tu_kham = ticket?.so_thu_tu_kham || ticket?.ticketNumber
                        app.ticket_id = ticket?.backendId || ticket?.id
                    }
                }
            })
            .addCase(checkInAppointmentAsync.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

            // Flow Board (FC-02 / API 7.7)
            .addCase(fetchFlowBoardAsync.pending, (state) => {
                state.queueLoading = true
            })
            .addCase(fetchFlowBoardAsync.fulfilled, (state, action) => {
                state.queueLoading = false
                if (action.payload?.items) {
                    state.queueEntries = action.payload.items
                    state.flowBoardSummary = action.payload.summary
                } else if (Array.isArray(action.payload)) {
                    state.queueEntries = action.payload
                }
            })
            .addCase(fetchFlowBoardAsync.rejected, (state, action) => {
                state.queueLoading = false
                state.queueEntries = []
                state.error = action.payload
            })

            // Doctor Real-time Queue Board (FC-03)
            .addCase(fetchDoctorQueueAsync.pending, (state) => {
                state.queueLoading = true
            })
            .addCase(fetchDoctorQueueAsync.fulfilled, (state, action) => {
                state.queueLoading = false
                state.queueEntries = Array.isArray(action.payload) ? action.payload : []
            })
            .addCase(fetchDoctorQueueAsync.rejected, (state, action) => {
                state.queueLoading = false
                state.queueEntries = []
                state.error = action.payload
            })

            // Walk-in
            .addCase(registerWalkInAsync.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(registerWalkInAsync.fulfilled, (state, action) => {
                state.loading = false
                if (action.payload) {
                    state.queueEntries.unshift(action.payload)
                }
            })
            .addCase(registerWalkInAsync.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

            // Patient Detail (API 5.2)
            .addCase(getPatientDetailAsync.pending, (state) => {
                state.patientDetailLoading = true
            })
            .addCase(getPatientDetailAsync.fulfilled, (state, action) => {
                state.patientDetailLoading = false
                state.selectedPatientDetail = action.payload
            })
            .addCase(getPatientDetailAsync.rejected, (state) => {
                state.patientDetailLoading = false
            })

            // Patients (FC-17)
            .addCase(searchPatientsAsync.fulfilled, (state, action) => {
                if (action.payload?.items) {
                    state.patients = action.payload.items
                    state.patientPagination = action.payload.meta || state.patientPagination
                }
            })
            .addCase(createPatientAsync.fulfilled, (state, action) => {
                if (action.payload) {
                    const p = action.payload
                    state.patients.unshift({
                        id: p.id,
                        patientCode: p.ma_dinh_danh_y_te || `BN-${p.id}`,
                        fullName: p.ho_ten,
                        phone: p.so_dien_thoai,
                        identityCard: p.cccd_so,
                        dob: p.ngay_sinh,
                        gender: p.gioi_tinh === 'Nam' ? 'MALE' : (p.gioi_tinh === 'Nữ' ? 'FEMALE' : 'OTHER'),
                        bloodType: p.nhom_mau,
                        address: p.dia_chi,
                        allergies: p.di_ung_thuoc || '',
                    })
                }
            })
            .addCase(updatePatientAsync.fulfilled, (state, action) => {
                if (action.payload) {
                    const p = action.payload
                    const idx = state.patients.findIndex((item) => item.id === p.id)
                    if (idx >= 0) {
                        state.patients[idx] = {
                            ...state.patients[idx],
                            patientCode: p.ma_dinh_danh_y_te || state.patients[idx].patientCode,
                            fullName: p.ho_ten || state.patients[idx].fullName,
                            phone: p.so_dien_thoai || state.patients[idx].phone,
                            identityCard: p.cccd_so || state.patients[idx].identityCard,
                            dob: p.ngay_sinh || state.patients[idx].dob,
                            gender: p.gioi_tinh === 'Nam' ? 'MALE' : (p.gioi_tinh === 'Nữ' ? 'FEMALE' : 'OTHER'),
                            bloodType: p.nhom_mau || state.patients[idx].bloodType,
                            address: p.dia_chi || state.patients[idx].address,
                            allergies: p.di_ung_thuoc !== undefined ? p.di_ung_thuoc : state.patients[idx].allergies,
                        }
                    }
                    if (state.selectedPatientDetail && state.selectedPatientDetail.id === p.id) {
                        state.selectedPatientDetail = {
                            ...state.selectedPatientDetail,
                            patientCode: p.ma_dinh_danh_y_te || state.selectedPatientDetail.patientCode,
                            fullName: p.ho_ten || state.selectedPatientDetail.fullName,
                            phone: p.so_dien_thoai || state.selectedPatientDetail.phone,
                            email: p.email !== undefined ? p.email : state.selectedPatientDetail.email,
                            identityCard: p.cccd_so || state.selectedPatientDetail.identityCard,
                            dob: p.ngay_sinh || state.selectedPatientDetail.dob,
                            gender: p.gioi_tinh === 'Nam' ? 'MALE' : (p.gioi_tinh === 'Nữ' ? 'FEMALE' : 'OTHER'),
                            gioiTinh: p.gioi_tinh || state.selectedPatientDetail.gioiTinh,
                            bloodType: p.nhom_mau || state.selectedPatientDetail.bloodType,
                            address: p.dia_chi || state.selectedPatientDetail.address,
                            allergies: p.di_ung_thuoc !== undefined ? p.di_ung_thuoc : state.selectedPatientDetail.allergies,
                            medicalHistory: p.tien_su_benh !== undefined ? p.tien_su_benh : state.selectedPatientDetail.medicalHistory,
                        }
                    }
                }
            })

                        // Waitlist
            .addCase(fetchReceptionWaitlistAsync.pending, (state) => {
                state.waitlistLoading = true
            })
            .addCase(fetchReceptionWaitlistAsync.fulfilled, (state, action) => {
                state.waitlistLoading = false
                state.waitlist = Array.isArray(action.payload) ? action.payload : []
            })
            .addCase(fetchReceptionWaitlistAsync.rejected, (state) => {
                state.waitlistLoading = false
            })
            .addCase(checkInWaitlistAsync.fulfilled, (state, action) => {
                if (action.payload) {
                    state.queueEntries.unshift(action.payload)
                }
            })
            .addCase(cancelWaitlistAsync.fulfilled, (state, action) => {
                state.waitlist = state.waitlist.filter((w) => w.id !== action.payload)
            })
            .addCase(resetReceptionDataAsync.fulfilled, (state, action) => {
                Object.assign(state, action.payload)
            })
            .addCase(switchReceptionRoleAsync.fulfilled, (state, action) => {
                state.activeRole = action.payload
            })

            // Report Summary & Audit Logs (Phân hệ 9)
            .addCase(fetchReportSummaryAsync.pending, (state) => {
                state.reportLoading = true
            })
            .addCase(fetchReportSummaryAsync.fulfilled, (state, action) => {
                state.reportLoading = false
                state.reportSummary = action.payload || null
            })
            .addCase(fetchReportSummaryAsync.rejected, (state) => {
                state.reportLoading = false
            })

            .addCase(fetchAuditLogsAsync.pending, (state) => {
                state.auditLoading = true
            })
            .addCase(fetchAuditLogsAsync.fulfilled, (state, action) => {
                state.auditLoading = false
                state.auditLogs = action.payload?.items || []
                state.auditPagination = action.payload?.pagination || {
                    page: 1,
                    pageSize: 10,
                    totalItems: (action.payload?.items || []).length,
                    totalPages: 1,
                    hasNext: false,
                    hasPrev: false,
                }
            })
            .addCase(fetchAuditLogsAsync.rejected, (state) => {
                state.auditLoading = false
            })

            // Shift Pre-close Audit & Close Shift
            .addCase(fetchShiftPreCloseAuditAsync.pending, (state) => {
                state.shiftAuditLoading = true
            })
            .addCase(fetchShiftPreCloseAuditAsync.fulfilled, (state, action) => {
                state.shiftAuditLoading = false
                state.shiftAuditData = action.payload || null
            })
            .addCase(fetchShiftPreCloseAuditAsync.rejected, (state) => {
                state.shiftAuditLoading = false
            })

            .addCase(closeReceptionShiftAsync.pending, (state) => {
                state.closeShiftSubmitting = true
            })
            .addCase(closeReceptionShiftAsync.fulfilled, (state) => {
                state.closeShiftSubmitting = false
            })
            .addCase(closeReceptionShiftAsync.rejected, (state) => {
                state.closeShiftSubmitting = false
            })
    },
})

export const { setActiveRoleLocally, clearReceptionError, setQueueEntries, clearSelectedPatientDetail } = receptionSlice.actions
export default receptionSlice.reducer
