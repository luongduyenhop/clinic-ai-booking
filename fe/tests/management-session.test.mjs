import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
after(() => server.close())
const storage = new Map()
globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
}
const { AdminService } = await server.ssrLoadModule('/src/services/admin/AdminService.js')
const { default: reducer } = await server.ssrLoadModule('/src/redux/slices/admin/adminSlice.js')
const authStorage = await server.ssrLoadModule('/src/utils/auth/authStorage.js')
const cacheKey = 'CLINIC_AI_MANAGEMENT_DB_V3_CLINICAL'

test('management data uses the employee API for every non-admin role', async () => {
    const service = new AdminService()
    for (const role of ['ADMIN', 'CASHIER', 'RECEPTIONIST', 'DOCTOR', 'TECHNICIAN']) {
        storage.clear()
        storage.set('userRole', role)
        service.get = async (path) => {
            assert.equal(path, `/api/v1/${role === 'ADMIN' ? 'admin' : 'staff'}/bootstrap`)
            return { data: { data: { schemaVersion: 'test' } } }
        }
        await service.getAllClinicData()
    }
})

test('a server rejection never becomes a successful local write', async () => {
    storage.clear()
    storage.set(cacheKey, JSON.stringify({ schemaVersion: 'test', roles: ['old'] }))
    const original = storage.get(cacheKey)
    const service = new AdminService()
    service.put = async () => { throw Object.assign(new Error('Forbidden'), { response: { status: 403 } }) }
    await assert.rejects(service.updateCollection({ collectionKey: 'roles', items: ['forged'] }), /Forbidden/)
    assert.equal(storage.get(cacheKey), original)
    service.get = async () => { throw new Error('Unauthorized') }
    await assert.rejects(service.getAllClinicData(), /Unauthorized/)
})

test('an old session response cannot save admin data after switching accounts', async () => {
    storage.clear()
    storage.set('accessToken', 'old-admin')
    const service = new AdminService()
    service.get = async () => {
        storage.set('accessToken', 'new-cashier')
        return { data: { schemaVersion: 'test', roles: ['secret'] } }
    }
    await assert.rejects(service.getAllClinicData(), /Phiên đăng nhập/)
    assert.equal(storage.get(cacheKey), undefined)
})

test('logout resets Redux and ignores an old in-flight bootstrap completion', () => {
    let state = reducer(undefined, { type: 'init' })
    state = reducer(state, { type: 'admin/loadClinicData/pending', meta: { requestId: 'admin-request' } })
    state = reducer(state, { type: 'auth/logout' })
    state = reducer(state, { type: 'admin/loadClinicData/fulfilled', meta: { requestId: 'admin-request' }, payload: { roles: ['secret'] } })
    assert.deepEqual(state.clinicData.roles, [])
    storage.set(cacheKey, 'old-admin-data')
    authStorage.clearAuthStorage()
    assert.equal(storage.get(cacheKey), undefined)
})
