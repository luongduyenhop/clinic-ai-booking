import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { configureStore, combineReducers } from '@reduxjs/toolkit'
import axios from 'axios'
import { createServer } from 'vite'

const storage = new Map()
globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
}
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
const { default: reducer, setAuth, logout } = await server.ssrLoadModule('/src/redux/slices/authSlice.js')
const { logoutUserAsync } = await server.ssrLoadModule('/src/redux/actions/user/authAction.js')
const { http, injectStore } = await server.ssrLoadModule('/src/services/BaseService.js')
const { AppToast } = await server.ssrLoadModule('/src/components/common/AppNotification.jsx')
const ssrAxiosModule = await server.ssrLoadModule('axios')
const ssrAxios = ssrAxiosModule.default || ssrAxiosModule

const setAxiosAdapter = (adapter) => {
    axios.defaults.adapter = adapter
    if (ssrAxios?.defaults) ssrAxios.defaults.adapter = adapter
}

const defaultAdapter = axios.defaults.adapter
after(async () => { setAxiosAdapter(defaultAdapter); await server.close() })

let store
let warnings
beforeEach(() => {
    storage.clear()
    warnings = []
    AppToast.warning = (message) => warnings.push(message)
    AppToast.error = () => {}
    store = configureStore({ reducer: { app: combineReducers({ auth: reducer }) } })
    injectStore(store)
    store.dispatch(setAuth({ accessToken: 'old-access', refreshToken: 'old-refresh', role: 'PATIENT', user: { id: 1 } }))
})

const response = (config, data = {}, status = 200) => ({ config, data, status, statusText: '', headers: {} })
const unauthorized = (config) => { throw new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, response(config, {}, 401)) }
const deferred = () => {
    let resolve
    const promise = new Promise((done) => { resolve = done })
    return { promise, resolve }
}
const newTokens = { data: { access_token: 'new-access', refresh_token: 'new-refresh', role: 'PATIENT' } }

function assertLocallyLoggedOut() {
    assert.equal(store.getState().app.auth.isAuthenticated, false)
    for (const key of ['accessToken', 'refreshToken', 'userRole', 'userInfo', 'CLINIC_AI_MANAGEMENT_DB_V3_CLINICAL']) {
        assert.equal(localStorage.getItem(key), null)
    }
}

test('explicit logout calls the authenticated server endpoint before clearing local state', async () => {
    storage.set('CLINIC_AI_MANAGEMENT_DB_V3_CLINICAL', 'old-management-cache')
    let calls = 0
    http.defaults.adapter = async (config) => {
        calls += 1
        assert.equal(config.url, '/api/v1/auth/logout')
        assert.equal(config.headers.Authorization, 'Bearer old-access')
        assert.equal(localStorage.getItem('refreshToken'), 'old-refresh')
        return response(config, { success: true })
    }
    const result = await store.dispatch(logoutUserAsync())
    assert.equal(result.payload.remoteRevoked, true)
    assert.equal(calls, 1)
    assertLocallyLoggedOut()
    assert.deepEqual(warnings, [])
})

test('a network failure clears the device session and warns that server revocation is unconfirmed', async () => {
    http.defaults.adapter = async () => { throw new Error('Network unavailable') }
    const result = await store.dispatch(logoutUserAsync())
    assert.equal(result.payload.remoteRevoked, false)
    assertLocallyLoggedOut()
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /chưa xác nhận thu hồi phiên/)
})

test('expired access is refreshed once and logout then revokes using the new access token', async () => {
    let logouts = 0
    let refreshes = 0
    setAxiosAdapter(async (config) => {
        refreshes += 1
        return response(config, newTokens)
    })
    http.defaults.adapter = async (config) => {
        logouts += 1
        if (logouts === 1) return unauthorized(config)
        assert.equal(config.headers.Authorization, 'Bearer new-access')
        assert.equal(localStorage.getItem('refreshToken'), 'new-refresh')
        return response(config, { success: true })
    }
    const result = await store.dispatch(logoutUserAsync())
    assert.equal(result.payload.remoteRevoked, true)
    assert.equal(refreshes, 1)
    assert.equal(logouts, 2)
    assertLocallyLoggedOut()
})

test('logout waits for an in-flight refresh and revokes the resulting session', async () => {
    const started = deferred()
    const refresh = deferred()
    let logouts = 0
    let privateCalls = 0
    setAxiosAdapter(async (config) => { started.resolve(); return response(config, await refresh.promise) })
    http.defaults.adapter = async (config) => {
        if (config.url === '/private') {
            privateCalls += 1
            if (privateCalls === 1) return unauthorized(config)
            return response(config)
        }
        logouts += 1
        assert.equal(config.headers.Authorization, 'Bearer new-access')
        return response(config, { success: true })
    }
    const request = http.get('/private', { __skipGlobalError: true })
    await started.promise
    const ending = store.dispatch(logoutUserAsync())
    assert.equal(logouts, 0)
    refresh.resolve(newTokens)
    await request
    await ending
    assert.equal(logouts, 1)
    assertLocallyLoggedOut()
})

test('a refresh completing after local logout cannot restore tokens', async () => {
    const started = deferred()
    const refresh = deferred()
    setAxiosAdapter(async (config) => { started.resolve(); return response(config, await refresh.promise) })
    http.defaults.adapter = async (config) => unauthorized(config)
    const request = http.get('/private', { __skipGlobalError: true })
    const rejected = assert.rejects(request, /Phiên đăng nhập đã thay đổi/)
    await started.promise
    store.dispatch(logout())
    refresh.resolve(newTokens)
    await rejected
    assertLocallyLoggedOut()
})

test('a stale refresh response cannot log out a newly signed-in user', async () => {
    const started = deferred()
    const refresh = deferred()
    setAxiosAdapter(async (config) => { started.resolve(); return response(config, await refresh.promise) })
    http.defaults.adapter = async (config) => unauthorized(config)
    const request = http.get('/private', { __skipGlobalError: true })
    const rejected = assert.rejects(request, /Phiên đăng nhập đã thay đổi/)
    await started.promise
    store.dispatch(setAuth({ accessToken: 'other-access', refreshToken: 'other-refresh', role: 'DOCTOR', user: { id: 2 } }))
    refresh.resolve(newTokens)
    await rejected
    assert.equal(store.getState().app.auth.user.id, 2)
    assert.equal(localStorage.getItem('accessToken'), 'other-access')
})

test('a stale refresh network error cannot clear a newly signed-in account', async () => {
    const started = deferred()
    const refresh = deferred()
    setAxiosAdapter(async () => { started.resolve(); await refresh.promise; throw new Error('refresh offline') })
    http.defaults.adapter = async (config) => unauthorized(config)
    const request = http.get('/private', { __skipGlobalError: true })
    const rejected = assert.rejects(request, /refresh offline/)
    await started.promise
    store.dispatch(setAuth({ accessToken: 'other-access', refreshToken: 'other-refresh', role: 'DOCTOR', user: { id: 2 } }))
    refresh.resolve()
    await rejected
    assert.equal(store.getState().app.auth.user.id, 2)
    assert.equal(localStorage.getItem('refreshToken'), 'other-refresh')
})

test('an old logout response cannot clear a newly signed-in account', async () => {
    const started = deferred()
    const ending = deferred()
    http.defaults.adapter = async (config) => { started.resolve(); await ending.promise; return response(config, { success: true }) }
    const request = store.dispatch(logoutUserAsync())
    await started.promise
    store.dispatch(setAuth({ accessToken: 'other-access', refreshToken: 'other-refresh', role: 'DOCTOR', user: { id: 2 } }))
    ending.resolve()
    const result = await request
    assert.equal(result.payload.sessionChanged, true)
    assert.equal(store.getState().app.auth.user.id, 2)
    assert.equal(localStorage.getItem('refreshToken'), 'other-refresh')
})

test('repeated logout clicks share a single pending operation', async () => {
    const started = deferred()
    const ending = deferred()
    let calls = 0
    http.defaults.adapter = async (config) => { calls += 1; started.resolve(); await ending.promise; return response(config) }
    const first = store.dispatch(logoutUserAsync())
    await started.promise
    const second = await store.dispatch(logoutUserAsync())
    assert.equal(second.meta.condition, true)
    ending.resolve()
    await first
    assert.equal(calls, 1)
    assertLocallyLoggedOut()
})
