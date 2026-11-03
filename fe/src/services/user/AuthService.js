import { BaseServices } from '../BaseService'
import { getAuthSessionRevision } from '../../utils/auth/authStorage'

export class AuthService extends BaseServices {
    login = (body) => this.post('/api/v1/auth/login', body)

    register = (body) => this.post('/api/v1/auth/register', body)

    refreshTokens = (body) => this.post('/api/v1/auth/refresh', body)

    logout = () => this.post('/api/v1/auth/logout', {}, {
        __authRevision: getAuthSessionRevision(),
        __logoutRequest: true, __skipGlobalLoading: true, __skipGlobalError: true, timeout: 10000,
    })

    getCurrentUser = () => this.get('/api/v1/auth/me')
}

export const authService = new AuthService()
export default authService
