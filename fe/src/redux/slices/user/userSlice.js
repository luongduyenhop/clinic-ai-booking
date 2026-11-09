import { createSlice } from '@reduxjs/toolkit'
import { createPatientBookingAsync, fetchAvailableSlotsAsync } from '../../actions/user/bookingAction'
import { analyzeSymptomsAsync } from '../../actions/user/aiTriageAction'
import { fetchPatientPortalAsync, fetchPrescriptionsAsync, fetchLabResultsAsync, fetchMedicalRecordsAsync, findPatientCodeAsync, addFamilyMemberAsync, submitPatientFeedbackAsync } from '../../actions/user/patientPortalAction'

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
    prescriptionsPage: { items: [], meta: null, loading: false, error: '', requestId: null },
    labResultsPage: { items: [], meta: null, loading: false, error: '', requestId: null },
    medicalRecords: { items: [], loading: false, error: '', requestId: null },
    patientLookup: { items: null, loading: false, error: '', requestId: null },
    familyMutation: { loading: false, error: '' },
    feedbackMutation: { loading: false, error: '' },
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
            .addCase(createPatientBookingAsync.rejected, (state, action) => { state.loading = false; state.bookingError = action.payload?.message || action.payload || 'Đặt lịch không thành công' })
            .addCase(analyzeSymptomsAsync.pending, (state) => { state.triageLoading = true; state.triageError = null; state.triageResult = null })
            .addCase(analyzeSymptomsAsync.fulfilled, (state, action) => { state.triageLoading = false; state.triageResult = action.payload })
            .addCase(analyzeSymptomsAsync.rejected, (state, action) => { state.triageLoading = false; state.triageError = action.payload || 'Không thể phân tích triệu chứng' })
            .addCase(fetchPatientPortalAsync.pending, (state) => { state.portalLoading = true; state.portalError = null })
            .addCase(fetchPatientPortalAsync.fulfilled, (state, action) => { state.portalLoading = false; state.portalData = action.payload })
            .addCase(fetchPatientPortalAsync.rejected, (state, action) => { state.portalLoading = false; state.portalError = action.payload || 'Không thể tải dữ liệu bệnh nhân' })
        for (const [thunk, key] of [[fetchMedicalRecordsAsync, 'medicalRecords'], [findPatientCodeAsync, 'patientLookup']]) {
            builder.addCase(thunk.pending, (state, action) => {
                state[key].loading = true; state[key].error = ''; state[key].requestId = action.meta.requestId
            }).addCase(thunk.fulfilled, (state, action) => {
                if (state[key].requestId !== action.meta.requestId) return
                state[key] = { items: action.payload, loading: false, error: '', requestId: null }
            }).addCase(thunk.rejected, (state, action) => {
                if (state[key].requestId !== action.meta.requestId) return
                state[key].loading = false; state[key].error = action.payload || 'Không thể tải dữ liệu'
            })
        }
        builder
            .addCase(addFamilyMemberAsync.pending, (state) => { state.familyMutation = { loading: true, error: '' } })
            .addCase(addFamilyMemberAsync.fulfilled, (state, action) => {
                state.familyMutation = { loading: false, error: '' }
                state.portalData.familyMembers = [...(state.portalData.familyMembers || []), action.payload]
            })
            .addCase(addFamilyMemberAsync.rejected, (state, action) => { state.familyMutation = { loading: false, error: action.payload } })
            .addCase(submitPatientFeedbackAsync.pending, (state) => { state.feedbackMutation = { loading: true, error: '' } })
            .addCase(submitPatientFeedbackAsync.fulfilled, (state, action) => {
                state.feedbackMutation = { loading: false, error: '' }
                const record = state.medicalRecords.items.find((item) => item.id === String(action.payload.luot_kham_id))
                if (record) record.danhGia = { diemSo: action.payload.so_sao_bac_si, nhanXet: action.payload.nhan_xet, ngayDanhGia: action.payload.created_at?.slice(0, 10) }
            })
            .addCase(submitPatientFeedbackAsync.rejected, (state, action) => { state.feedbackMutation = { loading: false, error: action.payload } })
        for (const [thunk, key] of [[fetchPrescriptionsAsync, 'prescriptionsPage'], [fetchLabResultsAsync, 'labResultsPage']]) {
            builder
                .addCase(thunk.pending, (state, action) => {
                    state[key].loading = true; state[key].error = ''; state[key].requestId = action.meta.requestId
                })
                .addCase(thunk.fulfilled, (state, action) => {
                    if (state[key].requestId !== action.meta.requestId) return
                    state[key] = { ...action.payload, loading: false, error: '', requestId: null }
                })
                .addCase(thunk.rejected, (state, action) => {
                    if (state[key].requestId !== action.meta.requestId) return
                    state[key].loading = false; state[key].requestId = null
                    state[key].error = action.meta.aborted ? '' : action.payload || 'Không thể tải dữ liệu'
                })
        }
    },
})

export const { setProfile, setAppointments, clearLatestBooking, clearTriageResult } = userSlice.actions
export default userSlice.reducer
