import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const source = await readFile(new URL('../src/services/user/PatientPortalService.js', import.meta.url), 'utf8')
const calls = []
let failPrescriptions = false
globalThis.__patientResultsHttp = { get: async (url, options) => {
    calls.push({ url, page: options.params.page })
    if (failPrescriptions && url.endsWith('/prescriptions')) throw new Error('prescription error')
    const isRx = url.endsWith('/prescriptions')
    return { data: { data: [], meta: { page: options.params.page, total_pages: isRx ? 3 : 1, total_items: isRx ? 41 : 1 } } }
} }
const code = source.split('\n').filter((line) => !line.startsWith('import ')).join('\n')
const { patientPortalService } = await import('data:text/javascript;base64,' + Buffer.from('const http = globalThis.__patientResultsHttp;\n' + code).toString('base64'))

test('prescription page 2 does not request or change lab page 1', async () => {
    calls.length = 0
    const lab = await patientPortalService.getLabResultsPage(1)
    const rx = await patientPortalService.getPrescriptionsPage(2)
    assert.equal(lab.meta.page, 1)
    assert.equal(lab.meta.total_pages, 1)
    assert.equal(rx.meta.page, 2)
    assert.deepEqual(calls, [
        { url: '/api/v1/patient/lab-results', page: 1 },
        { url: '/api/v1/patient/prescriptions', page: 2 },
    ])
})

test('lab pagination only calls lab endpoint', async () => {
    calls.length = 0
    await patientPortalService.getLabResultsPage(3)
    assert.deepEqual(calls, [{ url: '/api/v1/patient/lab-results', page: 3 }])
})

test('prescription failure does not block lab results or synthesize demo data', async () => {
    failPrescriptions = true
    await assert.rejects(patientPortalService.getPrescriptionsPage(2), /prescription error/)
    const lab = await patientPortalService.getLabResultsPage(1)
    assert.deepEqual(lab.items, [])
    assert.equal(lab.meta.page, 1)
    failPrescriptions = false
})
