import { createSlice } from '@reduxjs/toolkit'
import { createPatientBookingAsync, fetchAvailableSlotsAsync } from '../../actions/user/bookingAction'
import { analyzeSymptomsAsync } from '../../actions/user/aiTriageAction'
import { fetchPatientPortalAsync } from '../../actions/user/patientPortalAction'

const initialState = {
    appointments: [],
    profile: null,
    loading: false,
    availableSlots: [],
    slotsLoading: false,
    bookingError: null,
    latestBooking: null,
    triageLoading: false,
    triageError: null,
    triageResult: null,
    portalData: { appointments: [], medicalHistory: [], prescriptions: [], labResults: [], doctorSchedules: [] },
    portalLoading: false,
    portalError: null,
}

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        setProfile: (state, action) => {
            state.profile = action.payload
        },
        setAppointments: (state, action) => {
            state.appointments = action.payload
        },
        clearLatestBooking: (state) => {
            state.latestBooking = null
            state.bookingError = null
        },
        clearTriageResult: (state) => {
            state.triageResult = null
            state.triageError = null
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAvailableSlotsAsync.pending, (state) => { state.slotsLoading = true; state.availableSlots = []; state.bookingError = null })
            .addCase(fetchAvailableSlotsAsync.fulfilled, (state, action) => { state.slotsLoading = false; state.availableSlots = action.payload })
            .addCase(fetchAvailableSlotsAsync.rejected, (state, action) => { state.slotsLoading = false; state.bookingError = action.payload || 'Không thể tải khung giờ' })
            .addCase(createPatientBookingAsync.pending, (state) => { state.loading = true; state.bookingError = null })
            .addCase(createPatientBookingAsync.fulfilled, (state, action) => { state.loading = false; state.latestBooking = action.payload; state.appointments.unshift(action.payload) })
            .addCase(createPatientBookingAsync.rejected, (state, action) => { state.loading = false; state.bookingError = action.payload || 'Đặt lịch không thành công' })
            .addCase(analyzeSymptomsAsync.pending, (state) => { state.triageLoading = true; state.triageError = null; state.triageResult = null })
            .addCase(analyzeSymptomsAsync.fulfilled, (state, action) => { state.triageLoading = false; state.triageResult = action.payload })
            .addCase(analyzeSymptomsAsync.rejected, (state, action) => { state.triageLoading = false; state.triageError = action.payload || 'Không thể phân tích triệu chứng' })
            .addCase(fetchPatientPortalAsync.pending, (state) => { state.portalLoading = true; state.portalError = null })
            .addCase(fetchPatientPortalAsync.fulfilled, (state, action) => { state.portalLoading = false; state.portalData = action.payload })
            .addCase(fetchPatientPortalAsync.rejected, (state, action) => { state.portalLoading = false; state.portalError = action.payload || 'Không thể tải dữ liệu bệnh nhân' })
    },
})

export const { setProfile, setAppointments, clearLatestBooking, clearTriageResult } = userSlice.actions
export default userSlice.reducer
