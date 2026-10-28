import { createSlice } from '@reduxjs/toolkit'
import {
    fetchDoctorQueueAsync,
    callNextPatientAsync,
    recallPatientAsync,
    fetchEncounterAsync,
    createOrdersAsync,
    cancelOrderAsync,
    completeEncounterAsync,
    fetchServicesAsync,
    fetchClsWorklistAsync,
    startOrderAsync,
    submitOrderResultAsync,
    submitLabResultAsync,
} from '../../actions/doctor/clinicalAction'

const initialState = {
    queue: [],
    queueLoading: false,
    queueError: null,

    encounter: null,
    encounterLoading: false,
    encounterError: null,

    services: [],

    worklist: [],
    worklistLoading: false,
    worklistError: null,
}

const replaceOrder = (list, order) => list.map((o) => (o.id === order.id ? { ...o, ...order } : o))

const clinicalSlice = createSlice({
    name: 'clinical',
    initialState,
    reducers: {
        clearEncounter: (state) => {
            state.encounter = null
            state.encounterError = null
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchDoctorQueueAsync.pending, (state) => {
                state.queueLoading = true
                state.queueError = null
            })
            .addCase(fetchDoctorQueueAsync.fulfilled, (state, { payload }) => {
                state.queueLoading = false
                state.queue = payload || []
            })
            .addCase(fetchDoctorQueueAsync.rejected, (state, { payload }) => {
                state.queueLoading = false
                state.queueError = payload
            })
            .addCase(callNextPatientAsync.fulfilled, (state, { payload }) => {
                state.queue = state.queue.map((t) => (t.ticket_id === payload.ticket_id ? payload : t))
            })
            .addCase(recallPatientAsync.fulfilled, (state, { payload }) => {
                state.queue = state.queue.map((t) => (t.ticket_id === payload.ticket_id ? payload : t))
            })

            .addCase(fetchEncounterAsync.pending, (state) => {
                state.encounterLoading = true
                state.encounterError = null
            })
            .addCase(fetchEncounterAsync.fulfilled, (state, { payload }) => {
                state.encounterLoading = false
                state.encounter = payload
            })
            .addCase(fetchEncounterAsync.rejected, (state, { payload }) => {
                state.encounterLoading = false
                state.encounterError = payload
            })
            .addCase(createOrdersAsync.fulfilled, (state, { payload }) => {
                if (state.encounter) state.encounter.danh_sach_chi_dinh = payload
            })
            .addCase(cancelOrderAsync.fulfilled, (state, { payload }) => {
                if (state.encounter) state.encounter.danh_sach_chi_dinh = payload
            })
            .addCase(completeEncounterAsync.fulfilled, (state, { payload }) => {
                state.encounter = payload
                state.queue = state.queue.map((t) =>
                    t.encounter_id === payload.id ? { ...t, trang_thai: 'da_kham', ghi_chu: 'Đã khám xong' } : t
                )
            })

            .addCase(fetchServicesAsync.fulfilled, (state, { payload }) => {
                state.services = payload || []
            })

            .addCase(fetchClsWorklistAsync.pending, (state, { meta }) => {
                if (!meta.arg?.silent) state.worklistLoading = true
                state.worklistError = null
            })
            .addCase(fetchClsWorklistAsync.fulfilled, (state, { payload }) => {
                state.worklistLoading = false
                state.worklist = payload || []
            })
            .addCase(fetchClsWorklistAsync.rejected, (state, { payload }) => {
                state.worklistLoading = false
                state.worklistError = payload
            })
            .addCase(startOrderAsync.fulfilled, (state, { payload }) => {
                state.worklist = replaceOrder(state.worklist, payload)
            })
            .addCase(submitOrderResultAsync.fulfilled, (state, { payload }) => {
                state.worklist = replaceOrder(state.worklist, payload)
            })
            .addCase(submitLabResultAsync.fulfilled, (state, { payload }) => {
                state.worklist = replaceOrder(state.worklist, payload)
            })
    },
})

export const { clearEncounter } = clinicalSlice.actions
export default clinicalSlice.reducer
