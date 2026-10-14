import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    loadingCount: 0,
    apiError: null,
}

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        startGlobalLoading: (state) => {
            state.loadingCount += 1
        },
        stopGlobalLoading: (state) => {
            state.loadingCount = Math.max(0, state.loadingCount - 1)
        },
        setApiError: (state, action) => {
            state.apiError = action.payload
        },
        clearApiError: (state) => {
            state.apiError = null
        },
    },
})

export const { startGlobalLoading, stopGlobalLoading, setApiError, clearApiError } = uiSlice.actions
export default uiSlice.reducer
