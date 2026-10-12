import { TOKEN, REFRESH_TOKEN, USER_ROLE, USER_INFO } from '../constants/System'
import { getAuthSeed } from '../../services/admin/clinicSeedData'

const DEFAULT_DEMO_ADMIN = getAuthSeed()

export const readAuthFromStorage = () => {
    try {
        const accessToken = localStorage.getItem(TOKEN)
        const refreshToken = localStorage.getItem(REFRESH_TOKEN)
        const role = localStorage.getItem(USER_ROLE)
        const userRaw = localStorage.getItem(USER_INFO)
        const user = userRaw ? JSON.parse(userRaw) : null

        if (!accessToken) {
            saveFullAuth(DEFAULT_DEMO_ADMIN)
            return DEFAULT_DEMO_ADMIN
        }

        return {
            accessToken,
            refreshToken,
            role: role || DEFAULT_DEMO_ADMIN.role,
            user: user || DEFAULT_DEMO_ADMIN.user,
        }
    } catch {
        return DEFAULT_DEMO_ADMIN
    }
}

export const saveFullAuth = ({ accessToken, refreshToken, role, user }) => {
    if (accessToken) localStorage.setItem(TOKEN, accessToken)
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN, refreshToken)
    if (role) localStorage.setItem(USER_ROLE, role)
    if (user) localStorage.setItem(USER_INFO, JSON.stringify(user))
}

export const clearAuthStorage = () => {
    localStorage.removeItem(TOKEN)
    localStorage.removeItem(REFRESH_TOKEN)
    localStorage.removeItem(USER_ROLE)
    localStorage.removeItem(USER_INFO)
}

export const writeAuthToStorage = (patch = {}) => {
    if (patch.accessToken !== undefined) {
        patch.accessToken ? localStorage.setItem(TOKEN, patch.accessToken) : localStorage.removeItem(TOKEN)
    }
    if (patch.refreshToken !== undefined) {
        patch.refreshToken ? localStorage.setItem(REFRESH_TOKEN, patch.refreshToken) : localStorage.removeItem(REFRESH_TOKEN)
    }
    if (patch.role !== undefined) {
        patch.role ? localStorage.setItem(USER_ROLE, patch.role) : localStorage.removeItem(USER_ROLE)
    }
    if (patch.user !== undefined) {
        patch.user ? localStorage.setItem(USER_INFO, JSON.stringify(patch.user)) : localStorage.removeItem(USER_INFO)
    }
}
