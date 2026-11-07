import { createAsyncThunk } from '@reduxjs/toolkit'
import { clinicalService } from '../../../services/doctor/ClinicalService'
import { unwrapApi, pickErrorMessage } from '../../../utils/helpers/apiHelper'

const thunk = (type, call) =>
    createAsyncThunk(type, async (arg, { rejectWithValue }) => {
        try {
            const response = await call(arg)
            return unwrapApi(response)
        } catch (error) {
            return rejectWithValue(pickErrorMessage(error))
        }
    })


export const fetchDoctorQueueAsync = thunk('clinical/fetchQueue', () => clinicalService.getMyQueue())
export const callNextPatientAsync = thunk('clinical/callNext', () => clinicalService.callNext())
export const startPatientAsync = thunk('clinical/startPatient', (encounterIdOrTicketId) =>
    clinicalService.startSpecificPatient(encounterIdOrTicketId)
)
export const recallPatientAsync = thunk('clinical/recall', (ticketId) => clinicalService.recall(ticketId))
export const postponeTicketAsync = thunk('clinical/postpone', (ticketId) => clinicalService.postponeTicket(ticketId))


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


export const fetchServicesAsync = thunk('clinical/fetchServices', () => clinicalService.getServices())
export const searchIcd10Async = thunk('clinical/searchIcd10', (q) => clinicalService.searchIcd10(q))
export const searchDrugsAsync = thunk('clinical/searchDrugs', (q) => clinicalService.searchDrugs(q))
export const uploadFileAsync = thunk('clinical/uploadFile', (file) => clinicalService.uploadFile(file))



export const fetchClsWorklistAsync = thunk('clinical/fetchWorklist', (filters) => clinicalService.getClsWorklist(filters))
export const startOrderAsync = thunk('clinical/startOrder', (orderId) => clinicalService.startOrder(orderId))
export const submitOrderResultAsync = thunk('clinical/submitResult', ({ orderId, payload }) =>
    clinicalService.submitOrderResult(orderId, payload)
)
export const fetchLabTemplateAsync = thunk('clinical/fetchLabTemplate', (orderId) => clinicalService.getLabTemplate(orderId))
export const submitLabResultAsync = thunk('clinical/submitLabResult', ({ orderId, body }) =>
    clinicalService.submitLabResult(orderId, body)
)
export const approveOrderAsync = thunk('clinical/approveOrder', (orderId) => clinicalService.approveOrder(orderId))
export const signPrescriptionAsync = thunk('clinical/signPrescription', ({ encounterId, payload }) =>
    clinicalService.signPrescription(encounterId, payload)
)
