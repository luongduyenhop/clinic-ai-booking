import { createSlice } from '@reduxjs/toolkit'
import { createPatientBookingAsync, fetchAvailableSlotsAsync } from '../../actions/user/bookingAction'

const initialState = {
    appointments: [],
    profile: null,
    loading: false,
    availableSlots: [],
    slotsLoading: false,
    bookingError: null,
    latestBooking: null,
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
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAvailableSlotsAsync.pending, (state) => { state.slotsLoading = true; state.bookingError = null })
            .addCase(fetchAvailableSlotsAsync.fulfilled, (state, action) => { state.slotsLoading = false; state.availableSlots = action.payload })
            .addCase(fetchAvailableSlotsAsync.rejected, (state, action) => { state.slotsLoading = false; state.bookingError = action.payload || 'Không thể tải khung giờ' })
            .addCase(createPatientBookingAsync.pending, (state) => { state.loading = true; state.bookingError = null })
            .addCase(createPatientBookingAsync.fulfilled, (state, action) => { state.loading = false; state.latestBooking = action.payload; state.appointments.unshift(action.payload) })
            .addCase(createPatientBookingAsync.rejected, (state, action) => { state.loading = false; state.bookingError = action.payload || 'Đặt lịch không thành công' })
    },
})

export const { setProfile, setAppointments, clearLatestBooking } = userSlice.actions
export default userSlice.reducer
