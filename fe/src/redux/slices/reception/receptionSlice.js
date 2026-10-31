import { createSlice } from '@reduxjs/toolkit'
import {
    fetchReceptionDataAsync,
    resetReceptionDataAsync,
    switchReceptionRoleAsync,
    fetchFlowBoardAsync,
    registerWalkInQuickAsync,
    registerWalkInAsync,
    checkInAppointmentAsync,
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
                    const existingIndex = state.queueEntries.findIndex((q) => q.id === action.payload.id || (q.backendId && q.backendId === action.payload.backendId))
                    if (existingIndex >= 0) {
                        state.queueEntries[existingIndex] = action.payload
                    } else {
                        state.queueEntries.unshift(action.payload)
                    }
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

            // ── Check-in có lịch hẹn ───────────────────────────────────
            .addCase(checkInAppointmentAsync.fulfilled, (state, action) => {
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
