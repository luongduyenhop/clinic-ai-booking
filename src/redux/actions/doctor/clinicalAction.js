import { createAsyncThunk } from '@reduxjs/toolkit'
import { clinicalService } from '../../../services/doctor/ClinicalService'

const errorMessage = (error) =>
    error?.response?.data?.message || error?.response?.data?.detail || error?.message || 'Đã có lỗi xảy ra'

const thunk = (type, call) =>
    createAsyncThunk(type, async (arg, { rejectWithValue }) => {
        try {
            const response = await call(arg)
            return response.data?.data ?? response.data
        } catch (error) {
            return rejectWithValue(errorMessage(error))
        }
    })

// Hàng đợi
export const fetchDoctorQueueAsync = thunk('clinical/fetchQueue', () => clinicalService.getMyQueue())
export const callNextPatientAsync = thunk('clinical/callNext', () => clinicalService.callNext())
export const recallPatientAsync = thunk('clinical/recall', (ticketId) => clinicalService.recall(ticketId))

// Lượt khám
export const fetchEncounterAsync = thunk('clinical/fetchEncounter', (id) => clinicalService.getEncounter(id))
export const saveEncounterDraftAsync = thunk('clinical/saveDraft', ({ encounterId, patch }) =>
    clinicalService.saveEncounterDraft(encounterId, patch)
)
export const createOrdersAsync = thunk('clinical/createOrders', ({ encounterId, dichVuIds }) =>
    clinicalService.createOrders(encounterId, dichVuIds)
)
export const cancelOrderAsync = thunk('clinical/cancelOrder', ({ encounterId, orderId }) =>
    clinicalService.cancelOrder(encounterId, orderId)
)
export const completeEncounterAsync = thunk('clinical/complete', ({ encounterId, payload }) =>
    clinicalService.completeEncounter(encounterId, payload)
)
export const createAmendmentAsync = thunk('clinical/createAmendment', ({ encounterId, payload }) =>
    clinicalService.createAmendment(encounterId, payload)
)
export const rateAiSuggestionAsync = thunk('clinical/rateAi', ({ encounterId, payload }) =>
    clinicalService.rateAiSuggestion(encounterId, payload)
)

// Danh mục
export const fetchServicesAsync = thunk('clinical/fetchServices', () => clinicalService.getServices())
export const searchIcd10Async = thunk('clinical/searchIcd10', (q) => clinicalService.searchIcd10(q))
export const searchDrugsAsync = thunk('clinical/searchDrugs', (q) => clinicalService.searchDrugs(q))
export const uploadFileAsync = thunk('clinical/uploadFile', (file) => clinicalService.uploadFile(file))

// Cận lâm sàng
export const fetchClsWorklistAsync = thunk('clinical/fetchWorklist', (nhom) => clinicalService.getClsWorklist(nhom))
export const startOrderAsync = thunk('clinical/startOrder', (orderId) => clinicalService.startOrder(orderId))
export const submitOrderResultAsync = thunk('clinical/submitResult', ({ orderId, payload }) =>
    clinicalService.submitOrderResult(orderId, payload)
)
