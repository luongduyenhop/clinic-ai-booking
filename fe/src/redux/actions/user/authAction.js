import { createAsyncThunk } from '@reduxjs/toolkit'
import { authService } from '../../../services/user/AuthService'
import { resolveRoleFromAuth } from '../../../utils/auth/authRole'
import { jwtDecode } from 'jwt-decode'

export const loginUserAsync = createAsyncThunk(
    'auth/loginUser',
    async (credentials, { rejectWithValue }) => {
        try {
            const response = await authService.login(credentials)
            const body = response.data || {}
            const data = body.data ?? body

            const accessToken = data.accessToken || data.token || data.access_token
            const refreshToken = data.refreshToken || data.refresh_token
            if (!accessToken) throw new Error('Backend không cung cấp access token')
            const role = resolveRoleFromAuth(data, accessToken) || 'BENH_NHAN'
            
            let user = data.user || null
            if (!user && accessToken) {
                try {
                    const decoded = jwtDecode(accessToken)
                    user = {
                        id: decoded.nameid || decoded.sub || decoded.id,
                        email: decoded.email || credentials.usernameOrEmail,
                        fullName: decoded.unique_name || decoded.name || credentials.usernameOrEmail,
                    }
                } catch {
                    user = { fullName: credentials.usernameOrEmail, email: credentials.usernameOrEmail }
                }
            }

            return {
                accessToken,
                refreshToken,
                role,
                user: user ? { ...user, fullName: user.ho_ten || user.fullName || credentials.usernameOrEmail } : { fullName: credentials.usernameOrEmail, email: credentials.usernameOrEmail },
            }
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || error.response?.data?.Message || error.message)
        }
    }
)
