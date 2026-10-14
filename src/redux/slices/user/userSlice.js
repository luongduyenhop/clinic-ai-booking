import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    appointments: [],
    profile: null,
    loading: false,
}

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        setProfile: (state, action) => {
            state.profile = action.payload
        },
        setAppointments: (state, action) => {
            state.appointments = action.payload
        },
    },
})

export const { setProfile, setAppointments } = userSlice.actions
export default userSlice.reducer
