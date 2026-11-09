import { createAsyncThunk } from '@reduxjs/toolkit'
import { bookingService } from '../../../services/user/BookingService'

export const fetchAvailableSlotsAsync = createAsyncThunk('user/fetchAvailableSlots', async (params, { rejectWithValue }) => {
    try { return await bookingService.getAvailableSlots(params) } catch (error) { return rejectWithValue(error.message) }
})

export const createPatientBookingAsync = createAsyncThunk('user/createPatientBooking', async (payload, { rejectWithValue }) => {
    try { return await bookingService.createBooking(payload) } catch (error) {
        return rejectWithValue({
            message: error.response?.data?.message || error.response?.data?.Message || error.message || 'Đặt lịch không thành công',
            status: error.response?.status,
        })
    }
})
