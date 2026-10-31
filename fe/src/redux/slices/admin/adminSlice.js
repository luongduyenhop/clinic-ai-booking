import { createSlice } from '@reduxjs/toolkit'
import {
    getDashboardStatsAsync,
    loadClinicDataAsync,
    updateClinicCollectionAsync,
    updateCatalogSubCollectionAsync,
    resetClinicDemoDataAsync,
} from '../../actions/admin/adminAction'
import { INITIAL_CLINIC_DATA } from '../../../utils/helpers/clinicConfigHelpers'

const initialState = {
    stats: null,
    clinicData: INITIAL_CLINIC_DATA,
    loading: false,
    error: null,
}

const adminSlice = createSlice({
    name: 'admin',
    initialState,
    reducers: {
        clearAdminError: (state) => {
            state.error = null
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getDashboardStatsAsync.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(getDashboardStatsAsync.fulfilled, (state, action) => {
                state.loading = false
                state.stats = action.payload?.backendCompliance || null
                if (action.payload?.storeData) {
                    state.clinicData = action.payload.storeData
                }
            })
            .addCase(getDashboardStatsAsync.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })
            .addCase(loadClinicDataAsync.fulfilled, (state, action) => {
                state.clinicData = action.payload
            })
            .addCase(updateClinicCollectionAsync.fulfilled, (state, action) => {
                state.clinicData = action.payload
            })
            .addCase(updateCatalogSubCollectionAsync.fulfilled, (state, action) => {
                state.clinicData = action.payload
            })
            .addCase(resetClinicDemoDataAsync.fulfilled, (state, action) => {
                state.clinicData = action.payload
            })
    },
})

export const { clearAdminError } = adminSlice.actions
export default adminSlice.reducer
