import { createAsyncThunk } from '@reduxjs/toolkit'
import { patientPortalService } from '../../../services/user/PatientPortalService'

export const fetchPatientPortalAsync = createAsyncThunk('user/fetchPatientPortal', async (_, { rejectWithValue }) => {
    try { return await patientPortalService.getPortalData() } catch (error) { return rejectWithValue(error.message || 'Không thể tải dữ liệu bệnh nhân') }
})
