import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const source = await readFile(new URL('../src/services/user/AiTriageService.js', import.meta.url), 'utf8')
let calls = 0
let response
globalThis.__triageTestHttp = { post: async () => { calls++; if (response instanceof Error) throw response; return response } }
const code = source.replace("import { http } from '../BaseService'", 'const http = globalThis.__triageTestHttp')
const { aiTriageService, getEmergencyReasons } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('nôn ra máu có dấu/không dấu chuyển cấp cứu ngay cả khi API offline', async () => {
    response = new Error('offline')
    for (const text of ['nôn ra máu', 'NON RA MAU']) {
        const result = await aiTriageService.analyze({ mainSymptom: text })
        assert.equal(result.isEmergency, true)
        assert.deepEqual(result.recommendations, [])
    }
    assert.equal(calls, 0)
})

test('phủ định không báo nhầm nôn ra máu', () => {
    assert.deepEqual(getEmergencyReasons({ mainSymptom: 'Tôi không nôn ra máu' }), [])
})

test('checkbox nôn ra máu luôn cảnh báo', async () => {
    assert.equal((await aiTriageService.analyze({ redFlags: ['vomiting_blood'] })).isEmergency, true)
})

test('đọc đúng has_emergency và emergency_alert từ backend', async () => {
    response = { data: { data: { has_emergency: true, emergency_alert: 'Gọi 115 ngay' } } }
    const result = await aiTriageService.analyze({ mainSymptom: 'Triệu chứng khác' })
    assert.equal(result.isEmergency, true)
    assert.deepEqual(result.emergencyReasons, ['Gọi 115 ngay'])
})

test('đọc đúng gợi ý và confidence thật, không tự điền 78%', async () => {
    response = { data: { data: { has_emergency: false, suggested_specialties: [{ ten_chuyen_khoa: 'Răng Hàm Mặt', do_tin_cay: 0.65, ly_do_de_xuat: 'Lý do từ model' }] } } }
    const result = await aiTriageService.analyze({ mainSymptom: 'Đau răng và sưng nướu' })
    assert.equal(result.confidence, 65)
    assert.equal(result.recommendations[0].specialtyId, 'rhm')
    assert.equal(result.recommendations[0].reason, 'Lý do từ model')
})

test('API lỗi không sinh gợi ý khám thường giả', async () => {
    response = new Error('offline')
    await assert.rejects(aiTriageService.analyze({ mainSymptom: 'Đau đầu nhẹ' }), /offline/)
})
