import { BaseServices } from '../BaseService'

export class AuthService extends BaseServices {
    login = (body) => this.post('/api/v1/auth/login', body)

    register = (body) => this.post('/api/v1/auth/register', body)

    refreshTokens = (body) => this.post('/api/v1/auth/refresh', body)

    getCurrentUser = () => this.get('/api/v1/auth/me')
}

export const authService = new AuthService()
export default authService
