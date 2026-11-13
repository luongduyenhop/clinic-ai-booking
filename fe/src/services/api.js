import { http } from './BaseService'

function normalizeUrl(url) {
    if (typeof url !== 'string') return url
    if (url.startsWith('/api/v1') || url.startsWith('http:') || url.startsWith('https:') || url.startsWith('//')) {
        return url
    }
    return `/api/v1${url.startsWith('/') ? url : `/${url}`}`
}

const apiClient = {
    get: (url, config) => http.get(normalizeUrl(url), config),
    post: (url, data, config) => http.post(normalizeUrl(url), data, config),
    put: (url, data, config) => http.put(normalizeUrl(url), data, config),
    patch: (url, data, config) => http.patch(normalizeUrl(url), data, config),
    delete: (url, config) => http.delete(normalizeUrl(url), config),
    interceptors: http.interceptors,
    defaults: http.defaults,
}

export default apiClient
