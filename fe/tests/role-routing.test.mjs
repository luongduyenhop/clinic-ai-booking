import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const source = await readFile(new URL('../src/utils/constants/System.js', import.meta.url), 'utf8')
const code = source.replaceAll('import.meta.env', '({})')
const { getRoleDefaultPath } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('cashier and reception share the unified reception dashboard portal', () => {
    for (const role of ['CASHIER', 'THU_NGAN', 'cashier', 'thu_ngan']) {
        assert.equal(getRoleDefaultPath(role), '/reception/dashboard')
    }
})

test('other roles keep their own default portals', () => {
    for (const [role, path] of [
        ['ADMIN', '/admin'],
        ['DOCTOR', '/doctor'],
        ['RECEPTIONIST', '/reception/dashboard'],
        ['TECHNICIAN', '/staff/paraclinical-work'],
        ['PATIENT', '/benh-nhan'],
    ]) {
        assert.equal(getRoleDefaultPath(role), path)
    }
})
