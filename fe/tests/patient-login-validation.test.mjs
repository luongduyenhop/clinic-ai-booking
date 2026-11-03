import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPatientLoginCredentials, patientLoginValidationSchema } from '../src/utils/auth/patientLoginValidation.js'

test('patient login accepts valid emails and existing 10-digit phone numbers', async () => {
    for (const usernameOrEmail of ['patient@test.com', 'patient.name+test@example.com.vn', '0901234567', '0912345678', '  patient@test.com  ', ' 0912345678 ']) {
        const values = await patientLoginValidationSchema.validate({ usernameOrEmail, password: 'Patient@123456' })
        assert.equal(values.usernameOrEmail, usernameOrEmail.trim())
    }
})

test('blank and malformed identifiers remain invalid', async () => {
    for (const usernameOrEmail of ['', '   ', 'patient@', '@test.com', 'patient test@test.com', 'patient', '912345678', '1912345678', '09123456789', '0901 234 567']) {
        await assert.rejects(patientLoginValidationSchema.validate({ usernameOrEmail, password: 'Patient@123456' }), { name: 'ValidationError', path: 'usernameOrEmail' })
    }
    await assert.rejects(patientLoginValidationSchema.validate({ usernameOrEmail: '', password: 'Patient@123456' }), /Vui lòng nhập số điện thoại hoặc email/)
})

test('password validation still requires the existing minimum length', async () => {
    for (const password of ['', '12345']) {
        await assert.rejects(patientLoginValidationSchema.validate({ usernameOrEmail: 'patient@test.com', password }), { name: 'ValidationError', path: 'password' })
    }
})

test('submitted credentials trim the identifier and preserve the password exactly', () => {
    for (const usernameOrEmail of ['  patient@test.com  ', ' 0912345678 ']) {
        assert.deepEqual(buildPatientLoginCredentials({ usernameOrEmail, password: ' Pass word@123 ' }), {
            usernameOrEmail: usernameOrEmail.trim(), password: ' Pass word@123 ',
        })
    }
})
