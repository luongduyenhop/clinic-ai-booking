import axios from 'axios'
import { DOMAIN, REFRESH_TOKEN, TOKEN } from '../utils/constants/System'
import { resolveRoleFromAuth } from '../utils/auth/authRole'
import { AppToast } from '../components/common/AppNotification'

export const http = axios.create({
    baseURL: DOMAIN,
    headers: {
        'Content-Type': 'application/json',
    },
})

function isPublicAuthPath(url) {
    const u = String(url || '').toLowerCase()
    return (
        u.includes('auth/login') ||
        u.includes('auth/register') ||
        u.includes('auth/refresh-token')
    )
}

// ── Store Injection để tránh Circular Dependency & Dynamic Import overhead ───
let appStore = null

export const injectStore = (store) => {
    appStore = store
}

function dispatchStartLoading() {
    if (appStore) {
        appStore.dispatch({ type: 'ui/startGlobalLoading' })
    }
}

function dispatchStopLoading() {
    if (appStore) {
        appStore.dispatch({ type: 'ui/stopGlobalLoading' })
    }
}

function dispatchLogout() {
    if (appStore) {
        appStore.dispatch({ type: 'auth/logout' })
    }
}

function dispatchHydrateTokens(payload) {
    if (appStore) {
        appStore.dispatch({ type: 'auth/hydrateTokens', payload })
    }
}

// ── Request Interceptor (Hoàn toàn đồng bộ, không block luồng bằng await) ────
http.interceptors.request.use((config) => {
    if (!config.__skipGlobalLoading) {
        config.__globalLoadingCountered = true
        dispatchStartLoading()
    }

    if (!isPublicAuthPath(config.url)) {
        const token = localStorage.getItem(TOKEN)
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
    }
    return config
})

// ── Queue & Mutex cho Refresh Token ──────────────────────────────────────────
let isRefreshing = false
let failedQueue = []

function processQueue(error, token) {
    failedQueue.forEach((p) => {
        if (error) p.reject(error)
        else p.resolve(token)
    })
    failedQueue = []
}

// ── Response Interceptor ─────────────────────────────────────────────────────
http.interceptors.response.use(
    (response) => {
        if (response?.config?.__globalLoadingCountered) {
            dispatchStopLoading()
        }
        return response
    },
    async (error) => {
        const originalRequest = error.config
        const status = error.response?.status
        const shouldStopLoading = Boolean(originalRequest?.__globalLoadingCountered)
        
        // // ── Xử lý Global Api Error ──
        if (status && status >= 400 && status !== 401) {
            const body = error.response?.data
            const msg = body?.Message || body?.message || error.message || 'Lỗi không xác định từ máy chủ'
            
            // Thay vì show popup to đùng, ta hiển thị dạng Toast
            AppToast.error(msg)
        }

        if (status !== 401 || !originalRequest) {
            if (shouldStopLoading) dispatchStopLoading()
            return Promise.reject(error)
        }

        if (isPublicAuthPath(originalRequest.url) || originalRequest.__skipRefresh) {
            if (shouldStopLoading) dispatchStopLoading()
            return Promise.reject(error)
        }

        if (originalRequest._retry) {
            dispatchLogout()
            if (shouldStopLoading) dispatchStopLoading()
            return Promise.reject(error)
        }

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject })
            })
                .then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`
                    originalRequest.__skipGlobalLoading = true
                    originalRequest.__globalLoadingCountered = false
                    originalRequest._retry = true
                    return http(originalRequest).finally(() => {
                        if (shouldStopLoading) dispatchStopLoading()
                    })
                })
                .catch((err) => {
                    if (shouldStopLoading) dispatchStopLoading()
                    return Promise.reject(err)
                })
        }

        const accessToken = localStorage.getItem(TOKEN)
        const refreshToken = localStorage.getItem(REFRESH_TOKEN)

        if (!accessToken || !refreshToken) {
            dispatchLogout()
            if (shouldStopLoading) dispatchStopLoading()
            return Promise.reject(error)
        }

        originalRequest._retry = true
        isRefreshing = true

        try {
            const { data: body } = await axios.post(
                `${DOMAIN}/api/auth/refresh-token`,
                { accessToken, refreshToken },
                { headers: { 'Content-Type': 'application/json' } }
            )

            const payload = body?.data ?? body
            const newAccess = payload?.token ?? payload?.accessToken
            if (body?.success === false || !newAccess) {
                throw new Error(body?.message || 'Làm mới phiên đăng nhập thất bại')
            }

            const newRefresh = payload?.refreshToken ?? refreshToken
            const newRole = resolveRoleFromAuth(payload, newAccess)

            dispatchHydrateTokens({
                accessToken: newAccess,
                refreshToken: newRefresh,
                ...(newRole != null ? { role: newRole } : {}),
            })

            processQueue(null, newAccess)
            isRefreshing = false

            originalRequest.headers.Authorization = `Bearer ${newAccess}`
            originalRequest.__skipGlobalLoading = true
            originalRequest.__globalLoadingCountered = false
            originalRequest._retry = true

            return http(originalRequest).finally(() => {
                if (shouldStopLoading) dispatchStopLoading()
            })
        } catch (refreshErr) {
            processQueue(refreshErr, null)
            isRefreshing = false
            dispatchLogout()
            if (shouldStopLoading) dispatchStopLoading()
            return Promise.reject(refreshErr)
        }
    }
)

export class BaseServices {
    get = (url, config = {}) => http.get(url, config)

    post = (url, model, config = {}) => http.post(url, model, config)

    put = (url, model, config = {}) => http.put(url, model, config)

    patch = (url, model, config = {}) => http.patch(url, model, config)

    delete = (url, config = {}) => http.delete(url, config)
}

export const baseServices = new BaseServices()
