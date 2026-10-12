import { BaseServices } from '../BaseService'

export class AuthService extends BaseServices {
    login = (body) => this.post('/api/Auth/login', body)

    register = (body) => this.post('/api/Auth/register', body)

    refreshTokens = (body) => this.post('/api/Auth/refresh-token', body)

    getCurrentUser = () => this.get('/api/Auth/me')
}

export const authService = new AuthService()
export default authService
