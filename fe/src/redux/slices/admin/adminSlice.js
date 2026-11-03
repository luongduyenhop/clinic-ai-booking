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
    requests: {},
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
        for (const action of [getDashboardStatsAsync, loadClinicDataAsync, updateClinicCollectionAsync, updateCatalogSubCollectionAsync, resetClinicDemoDataAsync]) {
            builder.addCase(action.pending, (state, event) => {
                state.requests[action.typePrefix] = event.meta.requestId
                state.loading = true
                state.error = null
            })
            builder.addCase(action.fulfilled, (state, event) => {
                if (state.requests[action.typePrefix] !== event.meta.requestId) return
                delete state.requests[action.typePrefix]
                state.loading = Object.keys(state.requests).length > 0
                if (action === getDashboardStatsAsync) {
                    state.stats = event.payload?.backendCompliance || null
                    state.clinicData = event.payload?.storeData || INITIAL_CLINIC_DATA
                } else {
                    state.clinicData = event.payload
                }
            })
            builder.addCase(action.rejected, (state, event) => {
                if (state.requests[action.typePrefix] !== event.meta.requestId) return
                delete state.requests[action.typePrefix]
                state.loading = Object.keys(state.requests).length > 0
                state.error = event.payload || event.error?.message
            })
        }
        // An old session's in-flight request must not refill another user's store.
        for (const type of ['auth/setAuth', 'auth/logout', 'auth/loginUser/fulfilled']) {
            builder.addCase(type, () => initialState)
        }
    },
})

export const { clearAdminError } = adminSlice.actions
export default adminSlice.reducer
