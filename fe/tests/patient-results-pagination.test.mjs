import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { configureStore, createSlice, createAsyncThunk } from '@reduxjs/toolkit'

const loadModule = (source) => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const helper = await loadModule(await readFile(new URL('../src/utils/helpers/apiHelper.js', import.meta.url), 'utf8'))
const mapping = await loadModule(await readFile(new URL('../src/utils/helpers/patientResultMapping.js', import.meta.url), 'utf8'))
const medicalMapping = await loadModule(await readFile(new URL('../src/utils/helpers/patientMedicalMapping.js', import.meta.url), 'utf8'))
let rejectRx = false
const calls = []
const service = {
    getMedicalRecords: async () => ({ data: { success: true, data: [] } }),
    findLostPatientCode: async () => ({ data: { success: true, data: [{ id: 7 }] } }),
    addFamilyMember: async (member) => ({ data: { success: true, data: { id: 8, ...member } } }),
    submitFeedback: async (payload) => ({ data: { success: true, data: payload } }),
    getPrescriptionsPage: async (page) => {
        calls.push(['rx', page])
        if (rejectRx) throw new Error('rx failed')
        return { data: { success: true, data: [], meta: { page, total_pages: 3 } } }
    },
    getLabResultsPage: async (page) => {
        calls.push(['lab', page])
        return { data: { success: true, data: [], meta: { page, total_pages: 1 } } }
    },
}
globalThis.__patientTests = { createSlice, createAsyncThunk, patientPortalService: service, ...helper, ...mapping, ...medicalMapping }
const actionSource = (await readFile(new URL('../src/redux/actions/user/patientPortalAction.js', import.meta.url), 'utf8')).split('\n').filter((line) => !line.startsWith('import ')).join('\n')
const actions = await loadModule('const { createAsyncThunk, patientPortalService, unwrapApi, unwrapPagedApi, pickErrorMessage, mapPrescriptions, mapLabResults, mapMedicalRecords } = globalThis.__patientTests;\n' + actionSource)
Object.assign(globalThis.__patientTests, actions, {
    createPatientBookingAsync: createAsyncThunk('test/booking', async () => ({})),
    fetchAvailableSlotsAsync: createAsyncThunk('test/slots', async () => []),
    analyzeSymptomsAsync: createAsyncThunk('test/triage', async () => ({})),
})
const sliceSource = (await readFile(new URL('../src/redux/slices/user/userSlice.js', import.meta.url), 'utf8')).split('\n').filter((line) => !line.startsWith('import ')).join('\n')
const { default: reducer } = await loadModule('const { createSlice, createPatientBookingAsync, fetchAvailableSlotsAsync, analyzeSymptomsAsync, fetchPatientPortalAsync, fetchPrescriptionsAsync, fetchLabResultsAsync, fetchMedicalRecordsAsync, findPatientCodeAsync, addFamilyMemberAsync, submitPatientFeedbackAsync } = globalThis.__patientTests;\n' + sliceSource)

test('Redux keeps prescription page 2 and lab page 1 independent', async () => {
    const store = configureStore({ reducer })
    await store.dispatch(actions.fetchLabResultsAsync({ page: 1 }))
    await store.dispatch(actions.fetchPrescriptionsAsync({ page: 2 }))
    assert.equal(store.getState().prescriptionsPage.meta.page, 2)
    assert.equal(store.getState().labResultsPage.meta.page, 1)
    assert.deepEqual(calls, [['lab', 1], ['rx', 2]])
})
test('one resource error does not affect the other resource', async () => {
    const store = configureStore({ reducer })
    await store.dispatch(actions.fetchLabResultsAsync({ page: 1 }))
    rejectRx = true
    await store.dispatch(actions.fetchPrescriptionsAsync({ page: 2 }))
    assert.equal(store.getState().prescriptionsPage.error, 'rx failed')
    assert.equal(store.getState().labResultsPage.error, '')
    assert.equal(store.getState().labResultsPage.meta.page, 1)
    rejectRx = false
})
test('stale responses cannot overwrite a newer page', () => {
    let state = reducer(undefined, actions.fetchPrescriptionsAsync.pending('old', { page: 1 }))
    state = reducer(state, actions.fetchPrescriptionsAsync.pending('new', { page: 2 }))
    state = reducer(state, actions.fetchPrescriptionsAsync.fulfilled({ items: [], meta: { page: 1 } }, 'old', { page: 1 }))
    assert.equal(state.prescriptionsPage.requestId, 'new')
    state = reducer(state, actions.fetchPrescriptionsAsync.fulfilled({ items: [], meta: { page: 2 } }, 'new', { page: 2 }))
    assert.equal(state.prescriptionsPage.meta.page, 2)
})
test('unknown CLS types are not labeled as blood tests', () => {
    const items = mapping.mapLabResults([{ id: 1, loai_ket_qua: 'CHUA_PHAN_LOAI', chi_tiet: [], tep_dinh_kem: [] }])
    assert.equal(items[0].type, 'Chưa phân loại')
})
test('API helper preserves backend validation details', () => {
    assert.equal(helper.pickErrorMessage({ response: { data: { detail: [{ msg: 'Invalid page' }] } } }), 'Invalid page')
})
test('medical records and patient lookup update their own Redux state', async () => {
    const store = configureStore({ reducer })
    await store.dispatch(actions.fetchMedicalRecordsAsync())
    await store.dispatch(actions.findPatientCodeAsync('0900000000'))
    assert.deepEqual(store.getState().medicalRecords.items, [])
    assert.equal(store.getState().medicalRecords.loading, false)
    assert.deepEqual(store.getState().patientLookup.items, [{ id: 7 }])
    assert.equal(store.getState().prescriptionsPage.meta, null)
})
test('family creation updates Redux only after server confirmation', async () => {
    const store = configureStore({ reducer })
    await store.dispatch(actions.addFamilyMemberAsync({ ho_ten: 'Test', moi_quan_he: 'CON' }))
    assert.equal(store.getState().portalData.familyMembers[0].quan_he, 'CON')
    assert.equal(store.getState().familyMutation.loading, false)
})
test('clinical mapping retains missing values without inventing diagnosis', () => {
    const [record] = medicalMapping.mapMedicalRecords([{ luot_kham_id: 5 }])
    assert.equal(record.gioKham, 'Chưa ghi nhận')
    assert.equal(record.chanDoan.icd10Chinh, 'Chưa có chẩn đoán')
    assert.deepEqual(record.donThuoc.danhSachThuoc, [])
})
