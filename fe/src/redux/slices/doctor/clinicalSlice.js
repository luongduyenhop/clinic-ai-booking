import { createSlice } from '@reduxjs/toolkit'
import {
    fetchDoctorQueueAsync,
    callNextPatientAsync,
    startPatientAsync,
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
    approveOrderAsync,
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

const replaceOrder = (list, order) => { const item = order?.data || order; return list.map((o) => (o.id === item?.id ? { ...o, ...item } : o)) }

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
                const item = payload?.data || payload
                if (item) {
                    state.queue = state.queue.map((t) => {
                        const isMatch = String(t.ticket_id) === String(item.ticket_id) || String(t.encounter_id) === String(item.encounter_id)
                        if (isMatch) {
                            return { ...t, ...item, trang_thai: 'dang_kham', ghi_chu: 'Đang khám' }
                        }
                        if (t.trang_thai === 'dang_kham') {
                            return { ...t, trang_thai: 'cho_kham', ghi_chu: 'Chờ khám' }
                        }
                        return t
                    })
                    if (state.encounter && (String(state.encounter.id) === String(item.encounter_id) || (state.encounter.ticket_id && String(state.encounter.ticket_id) === String(item.ticket_id)))) {
                        state.encounter.thoi_gian_bat_dau = state.encounter.thoi_gian_bat_dau || new Date().toISOString()
                    }
                }
            })
            .addCase(startPatientAsync.fulfilled, (state, { payload }) => {
                const item = payload?.data || payload
                if (item) {
                    state.queue = state.queue.map((t) => {
                        const isMatch = String(t.ticket_id) === String(item.ticket_id) || String(t.encounter_id) === String(item.encounter_id)
                        if (isMatch) {
                            return { ...t, ...item, trang_thai: 'dang_kham', ghi_chu: 'Đang khám' }
                        }
                        if (t.trang_thai === 'dang_kham') {
                            return { ...t, trang_thai: 'cho_kham', ghi_chu: 'Chờ khám' }
                        }
                        return t
                    })
                    if (state.encounter && (String(state.encounter.id) === String(item.encounter_id) || (state.encounter.ticket_id && String(state.encounter.ticket_id) === String(item.ticket_id)))) {
                        state.encounter.thoi_gian_bat_dau = state.encounter.thoi_gian_bat_dau || new Date().toISOString()
                    }
                }
            })
            .addCase(recallPatientAsync.fulfilled, (state, { payload }) => {
                state.queue = state.queue.map((t) => (String(t.ticket_id) === String(payload?.ticket_id) ? payload : t))
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
                const encId = state.encounter?.id
                if (encId) {
                    state.queue = state.queue.map((t) =>
                        String(t.encounter_id) === String(encId) || String(t.ticket_id) === String(state.encounter?.ticket_id)
                            ? { ...t, trang_thai: 'tam_hoan', ghi_chu: 'Chờ kết quả Cận lâm sàng' }
                            : t
                    )
                }
            })
            .addCase(cancelOrderAsync.fulfilled, (state, { payload }) => {
                if (state.encounter) state.encounter.danh_sach_chi_dinh = payload
            })
            .addCase(completeEncounterAsync.fulfilled, (state, { payload }) => {
                state.encounter = payload
                state.queue = state.queue.map((t) =>
                    String(t.encounter_id) === String(payload?.id) ||
                    (payload?.lich_kham_id && String(t.ticket_id) === String(payload.lich_kham_id)) ||
                    (payload?.ticket_id && String(t.ticket_id) === String(payload.ticket_id))
                        ? { ...t, trang_thai: 'da_kham', ghi_chu: 'Đã khám xong' }
                        : t
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
            .addCase(approveOrderAsync.fulfilled, (state, { payload }) => {
                state.worklist = replaceOrder(state.worklist, payload)
            })
    },
})

export const { clearEncounter } = clinicalSlice.actions
export default clinicalSlice.reducer
