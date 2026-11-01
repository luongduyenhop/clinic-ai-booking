import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const source = await readFile(new URL('../src/services/user/BookingService.js', import.meta.url), 'utf8')
globalThis.localStorage = { getItem: () => '[]', setItem: () => {} }
globalThis.window = { setTimeout: (fn) => { fn(); return 1 } }
let response
globalThis.__bookingHttp = { get: async () => response, post: async () => { throw new Error('conflict') } }
const code = source.split('\n').map((line) => line.startsWith('import { http }') ? 'const http = globalThis.__bookingHttp' : line.startsWith('import { doctors }') ? 'const doctors = []' : line).join('\n')
const { bookingService } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))

test('only available slots reach the booking UI', async () => {
    response = { data: { data: { slots: [
        { time_str: '08:00', status: 'past' },
        { time_str: '09:00', status: 'booked' },
        { time_str: '10:00', status: 'available' },
    ] } } }
    assert.deepEqual(await bookingService.getAvailableSlots({ doctorId: 1, appointmentDate: '2026-12-01' }), [{ value: '10:00', available: true }])
})

test('invalid response cannot create demo availability', async () => {
    response = {}
    await assert.rejects(bookingService.getAvailableSlots({ doctorId: 1, appointmentDate: '2026-12-01' }))
})

test('backend refusal cannot become a successful local booking', async () => {
    await assert.rejects(bookingService.createBooking({ doctorId: 1, appointmentDate: '2026-12-01', timeSlot: '10:00' }))
})
