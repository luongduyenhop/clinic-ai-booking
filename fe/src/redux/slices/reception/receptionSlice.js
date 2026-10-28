import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { receptionService } from '../../../services/reception/receptionService'

export const fetchReceptionDataAsync = createAsyncThunk('reception/fetchAll', async () => {
    return await receptionService.fetchAllData()
})

export const resetReceptionDataAsync = createAsyncThunk('reception/resetAll', async () => {
    return await receptionService.resetAllData()
})

export const switchReceptionRoleAsync = createAsyncThunk('reception/switchRole', async (role) => {
    return await receptionService.switchRole(role)
})

export const createAppointmentAsync = createAsyncThunk('reception/createAppointment', async ({ payload, actor }, { dispatch }) => {
    const res = await receptionService.createAppointment(payload, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

export const updateAppointmentAsync = createAsyncThunk('reception/updateAppointment', async ({ id, updates, actor }, { dispatch }) => {
    const res = await receptionService.updateAppointment(id, updates, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

export const cancelAppointmentAsync = createAsyncThunk('reception/cancelAppointment', async ({ id, reason, actor }, { dispatch }) => {
    const res = await receptionService.cancelAppointment(id, reason, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

export const checkInAppointmentAsync = createAsyncThunk('reception/checkInAppointment', async ({ payload, actor }, { dispatch }) => {
    const res = await receptionService.checkInAppointment(payload, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

export const registerWalkInAsync = createAsyncThunk('reception/registerWalkIn', async ({ payload, actor }, { dispatch }) => {
    const res = await receptionService.registerWalkIn(payload, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

export const callQueueEntryAsync = createAsyncThunk('reception/callQueue', async ({ queueId, actor }, { dispatch }) => {
    const res = await receptionService.callQueueEntry(queueId, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

export const markAbsentAsync = createAsyncThunk('reception/markAbsent', async ({ queueId, actor }, { dispatch }) => {
    const res = await receptionService.markAbsent(queueId, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

export const deferQueueEntryAsync = createAsyncThunk('reception/deferQueue', async ({ queueId, reason, actor }, { dispatch }) => {
    const res = await receptionService.deferQueueEntry(queueId, reason, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

export const resumeQueueEntryAsync = createAsyncThunk('reception/resumeQueue', async ({ queueId, actor }, { dispatch }) => {
    const res = await receptionService.resumeQueueEntry(queueId, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

export const transferRoomAsync = createAsyncThunk('reception/transferRoom', async ({ queueId, updates, actor }, { dispatch }) => {
    const res = await receptionService.transferRoom(queueId, updates, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

export const reorderQueueAsync = createAsyncThunk('reception/reorderQueue', async ({ queueId, payload, actor }, { dispatch }) => {
    const res = await receptionService.reorderQueue(queueId, payload, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

export const cancelQueueEntryAsync = createAsyncThunk('reception/cancelQueue', async ({ queueId, reason, actor }, { dispatch }) => {
    const res = await receptionService.cancelQueueEntry(queueId, reason, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

export const emergencyHandoverAsync = createAsyncThunk('reception/emergencyHandover', async ({ payload, actor }, { dispatch }) => {
    const res = await receptionService.emergencyHandover(payload, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

export const createPatientAsync = createAsyncThunk('reception/createPatient', async ({ payload, actor }, { dispatch }) => {
    const res = await receptionService.createPatient(payload, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

export const updatePatientAsync = createAsyncThunk('reception/updatePatient', async ({ id, updates, actor }, { dispatch }) => {
    const res = await receptionService.updatePatient(id, updates, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

export const resolveTaskAsync = createAsyncThunk('reception/resolveTask', async ({ taskId, resolutionNote, actor }, { dispatch }) => {
    const res = await receptionService.resolveTask(taskId, resolutionNote, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

export const updateInvoiceStatusAsync = createAsyncThunk('reception/updateInvoice', async ({ invoiceId, payload, actor }, { dispatch }) => {
    const res = await receptionService.updateInvoiceStatus(invoiceId, payload, actor)
    dispatch(fetchReceptionDataAsync())
    return res
})

const initialState = {
    departments: [],
    doctors: [],
    rooms: [],
    services: [],
    patients: [],
    appointments: [],
    queueEntries: [],
    tasks: [],
    auditLogs: [],
    invoices: [],
    activeRole: 'RECEPTIONIST',
    loading: false,
    error: null,
    isInitialized: false,
}

const receptionSlice = createSlice({
    name: 'reception',
    initialState,
    reducers: {
        setActiveRoleLocally: (state, action) => {
            state.activeRole = action.payload
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchReceptionDataAsync.pending, (state) => {
                if (!state.isInitialized) state.loading = true
            })
            .addCase(fetchReceptionDataAsync.fulfilled, (state, action) => {
                state.loading = false
                state.isInitialized = true
                Object.assign(state, action.payload)
            })
            .addCase(fetchReceptionDataAsync.rejected, (state, action) => {
                state.loading = false
                state.error = action.error?.message || 'Lỗi tải dữ liệu lễ tân'
            })
            .addCase(resetReceptionDataAsync.fulfilled, (state, action) => {
                Object.assign(state, action.payload)
            })
            .addCase(switchReceptionRoleAsync.fulfilled, (state, action) => {
                state.activeRole = action.payload
            })
    },
})

export const { setActiveRoleLocally } = receptionSlice.actions
export default receptionSlice.reducer
