import { createSlice } from '@reduxjs/toolkit'
import {
    fetchReceptionDataAsync,
    resetReceptionDataAsync,
    switchReceptionRoleAsync,
    fetchFlowBoardAsync,
    fetchAppointmentsAsync,
    checkInAppointmentAsync,
    registerWalkInQuickAsync,
    registerWalkInAsync,
    searchPatientsAsync,
} from '../../actions/reception/receptionAction'

// Re-export all actions for seamless backward compatibility
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
    tasks: [],
    auditLogs: [],
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
    },
    extraReducers: (builder) => {
        builder
            // ── Khởi tạo toàn bộ dữ liệu ──────────────────────────────
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
                    if (action.payload.queueEntries) state.queueEntries = action.payload.queueEntries
                }
            })
            .addCase(fetchReceptionDataAsync.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload || 'Lỗi tải dữ liệu lễ tân'
            })

            // ── Tải danh sách lịch hẹn đặt trước ──────────────────────
            .addCase(fetchAppointmentsAsync.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchAppointmentsAsync.fulfilled, (state, action) => {
                state.loading = false
                if (action.payload?.items) {
                    state.appointments = action.payload.items
                    state.appointmentsPagination = action.payload.meta || state.appointmentsPagination
                }
            })
            .addCase(fetchAppointmentsAsync.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

            // ── Check-in ca đặt trước (1 Chạm) ────────────────────────
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

                // Chuyển trạng thái lịch hẹn tương ứng sang DA_DEN
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

            // ── Tải bảng hàng đợi Flow Board ──────────────────────────
            .addCase(fetchFlowBoardAsync.pending, (state) => {
                state.queueLoading = true
            })
            .addCase(fetchFlowBoardAsync.fulfilled, (state, action) => {
                state.queueLoading = false
                if (Array.isArray(action.payload)) {
                    state.queueEntries = action.payload
                }
            })
            .addCase(fetchFlowBoardAsync.rejected, (state, action) => {
                state.queueLoading = false
                state.error = action.payload
            })

            // ── Tiếp nhận nhanh 30 giây (Walk-in Quick) ───────────────
            .addCase(registerWalkInQuickAsync.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(registerWalkInQuickAsync.fulfilled, (state, action) => {
                state.loading = false
                if (action.payload) {
                    state.queueEntries.unshift(action.payload)
                }
            })
            .addCase(registerWalkInQuickAsync.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

            // ── Tiếp nhận vãng lai chi tiết ───────────────────────────
            .addCase(registerWalkInAsync.fulfilled, (state, action) => {
                if (action.payload) {
                    state.queueEntries.unshift(action.payload)
                }
            })

            // ── Tìm kiếm bệnh nhân theo SĐT có phân trang ─────────────
            .addCase(searchPatientsAsync.fulfilled, (state, action) => {
                if (action.payload?.items) {
                    state.patients = action.payload.items
                    state.patientPagination = action.payload.meta || state.patientPagination
                }
            })

            // ── Reset & chuyển vai trò ─────────────────────────────────
            .addCase(resetReceptionDataAsync.fulfilled, (state, action) => {
                Object.assign(state, action.payload)
            })
            .addCase(switchReceptionRoleAsync.fulfilled, (state, action) => {
                state.activeRole = action.payload
            })
    },
})

export const { setActiveRoleLocally, clearReceptionError } = receptionSlice.actions
export default receptionSlice.reducer
