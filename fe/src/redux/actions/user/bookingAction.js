import { createAsyncThunk } from '@reduxjs/toolkit'
import { bookingService } from '../../../services/user/BookingService'
import { toFriendlyErrorMessage } from '../../../utils/helpers/clientErrorHelper.js'

export const fetchAvailableSlotsAsync = createAsyncThunk('user/fetchAvailableSlots', async (params, { rejectWithValue }) => {
    try { return await bookingService.getAvailableSlots(params) } catch (error) { return rejectWithValue(toFriendlyErrorMessage(error, 'Chưa tải được khung giờ khám. Vui lòng thử lại sau.')) }
})

export const createPatientBookingAsync = createAsyncThunk('user/createPatientBooking', async (payload, { rejectWithValue }) => {
    try { return await bookingService.createBooking(payload) } catch (error) {
        return rejectWithValue({
            message: toFriendlyErrorMessage(error, 'Đặt lịch chưa thành công. Vui lòng thử lại sau ít phút.'),
            status: error.response?.status,
        })
    }
})
