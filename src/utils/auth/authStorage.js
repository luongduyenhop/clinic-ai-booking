import { TOKEN, REFRESH_TOKEN, USER_ROLE, USER_INFO } from '../constants/System'
export const readAuthFromStorage = () => {
    try {
        const accessToken = localStorage.getItem(TOKEN)
        const refreshToken = localStorage.getItem(REFRESH_TOKEN)
        const role = localStorage.getItem(USER_ROLE)
        const userRaw = localStorage.getItem(USER_INFO)
        const user = userRaw ? JSON.parse(userRaw) : null

        return {
            accessToken,
            refreshToken,
            role,
            user,
        }
    } catch {
        return { accessToken: null, refreshToken: null, role: null, user: null }
    }
}

export const saveFullAuth = ({ accessToken, refreshToken, role, user }) => {
    if (accessToken !== undefined) {
        if (accessToken) localStorage.setItem(TOKEN, accessToken)
        else localStorage.removeItem(TOKEN)
    }
    if (refreshToken !== undefined) {
        if (refreshToken) localStorage.setItem(REFRESH_TOKEN, refreshToken)
        else localStorage.removeItem(REFRESH_TOKEN)
    }
    if (role !== undefined) {
        if (role) localStorage.setItem(USER_ROLE, role)
        else localStorage.removeItem(USER_ROLE)
    }
    if (user !== undefined) {
        if (user) localStorage.setItem(USER_INFO, JSON.stringify(user))
        else localStorage.removeItem(USER_INFO)
    }
}

export const clearAuthStorage = () => {
    localStorage.removeItem(TOKEN)
    localStorage.removeItem(REFRESH_TOKEN)
    localStorage.removeItem(USER_ROLE)
    localStorage.removeItem(USER_INFO)
}

export const writeAuthToStorage = (patch = {}) => {
    if (patch.accessToken !== undefined) {
        if (patch.accessToken) localStorage.setItem(TOKEN, patch.accessToken)
        else localStorage.removeItem(TOKEN)
    }
    if (patch.refreshToken !== undefined) {
        if (patch.refreshToken) localStorage.setItem(REFRESH_TOKEN, patch.refreshToken)
        else localStorage.removeItem(REFRESH_TOKEN)
    }
    if (patch.role !== undefined) {
        if (patch.role) localStorage.setItem(USER_ROLE, patch.role)
        else localStorage.removeItem(USER_ROLE)
    }
    if (patch.user !== undefined) {
        if (patch.user) localStorage.setItem(USER_INFO, JSON.stringify(patch.user))
        else localStorage.removeItem(USER_INFO)
    }
}
