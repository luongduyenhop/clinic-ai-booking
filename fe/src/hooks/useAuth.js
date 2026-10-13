import { useSelector } from 'react-redux'

export function useAuth() {
    const auth = useSelector((state) => state.app.auth)
    return {
        isAuthenticated: auth.isAuthenticated,
        user: auth.user,
        role: auth.role,
        accessToken: auth.accessToken,
    }
}
