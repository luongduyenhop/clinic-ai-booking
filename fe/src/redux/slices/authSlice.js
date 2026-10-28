import { createSlice } from '@reduxjs/toolkit'
import { readAuthFromStorage, saveFullAuth, clearAuthStorage } from '../../utils/auth/authStorage'
import { loginUserAsync } from '../actions/user/authAction'

const storedAuth = readAuthFromStorage()

const initialState = {
    accessToken: storedAuth.accessToken,
    refreshToken: storedAuth.refreshToken,
    role: storedAuth.role,
    user: storedAuth.user,
    isAuthenticated: Boolean(storedAuth.accessToken),
    isSubmitting: false,
    authError: null,
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setAuth: (state, action) => {
            const { accessToken, refreshToken, role, user } = action.payload || {}
            state.accessToken = accessToken || null
            state.refreshToken = refreshToken || null
            state.role = role || null
            state.user = user || null
            state.isAuthenticated = Boolean(accessToken)
            saveFullAuth({ accessToken, refreshToken, role, user })
        },
        hydrateTokens: (state, action) => {
            const { accessToken, refreshToken, role } = action.payload || {}
            if (accessToken) state.accessToken = accessToken
            if (refreshToken) state.refreshToken = refreshToken
            if (role) state.role = role
            state.isAuthenticated = Boolean(state.accessToken)
        },
        logout: (state) => {
            state.accessToken = null
            state.refreshToken = null
            state.role = null
            state.user = null
            state.isAuthenticated = false
            state.authError = null
            clearAuthStorage()
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(loginUserAsync.pending, (state) => {
                state.isSubmitting = true
                state.authError = null
            })
            .addCase(loginUserAsync.fulfilled, (state, action) => {
                state.isSubmitting = false
                const { accessToken, refreshToken, role, user } = action.payload || {}
                state.accessToken = accessToken || null
                state.refreshToken = refreshToken || null
                state.role = role || null
                state.user = user || null
                state.isAuthenticated = Boolean(accessToken)
                state.authError = null
                saveFullAuth({ accessToken, refreshToken, role, user })
            })
            .addCase(loginUserAsync.rejected, (state, action) => {
                state.isSubmitting = false
                state.authError = action.payload || 'Đăng nhập không thành công'
            })
    },
})

export const { setAuth, hydrateTokens, logout } = authSlice.actions
export default authSlice.reducer
