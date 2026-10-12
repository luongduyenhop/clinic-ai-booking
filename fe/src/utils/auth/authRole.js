import { jwtDecode } from 'jwt-decode'

export const resolveRoleFromAuth = (payload, token) => {
    if (payload?.role) return String(payload.role).toUpperCase()
    if (payload?.user?.role) return String(payload.user.role).toUpperCase()

    if (token) {
        try {
            const decoded = jwtDecode(token)
            const roleClaim =
                decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
                decoded.role ||
                decoded.Role
            if (roleClaim) return String(roleClaim).toUpperCase()
        } catch {
            return null
        }
    }

    return null
}
