import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canAccessPortalPath } from '../src/utils/route/portalAccess.js'

const API_ROLES = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'CASHIER', 'TECHNICIAN', 'PATIENT']

test('administration is blocked for every non-admin role, including direct nested URLs', () => {
    for (const role of API_ROLES) {
        for (const path of ['/admin/phan-quyen', '/admin/cai-dat', '/staff/permissions', '/staff/settings/', '/staff/catalogs/chung']) {
            assert.equal(canAccessPortalPath(role, path), role === 'ADMIN', `${role}: ${path}`)
        }
    }
})

test('clinical and cashier pages reject roles from the wrong department', () => {
    for (const role of API_ROLES) {
        assert.equal(canAccessPortalPath(role, '/staff/exam-workstation'), ['ADMIN', 'DOCTOR'].includes(role))
        assert.equal(canAccessPortalPath(role, '/staff/specialty-exam/noi-khoa'), ['ADMIN', 'DOCTOR'].includes(role))
        assert.equal(canAccessPortalPath(role, '/staff/cashier'), ['ADMIN', 'CASHIER', 'RECEPTIONIST'].includes(role))
        assert.equal(canAccessPortalPath(role, '/staff/paraclinical-work'), ['ADMIN', 'DOCTOR', 'TECHNICIAN'].includes(role))
    }
})

test('each role can access its own portal and employee roles cannot enter personal patient pages', () => {
    for (const [role, path] of [
        ['ADMIN', '/admin'], ['DOCTOR', '/doctor'], ['RECEPTIONIST', '/reception/dashboard'],
        ['CASHIER', '/staff/cashier'], ['TECHNICIAN', '/staff/paraclinical-work'], ['PATIENT', '/benh-nhan/benh-an'],
    ]) assert.equal(canAccessPortalPath(role, path), true)
    for (const role of API_ROLES) assert.equal(canAccessPortalPath(role, '/benh-nhan/ho-so'), role === 'PATIENT')
})

test('aliases follow the same policy and missing roles or unknown staff pages fail closed', () => {
    assert.equal(canAccessPortalPath('thu_ngan', '/staff/cashier'), true)
    assert.equal(canAccessPortalPath('ky_thuat_vien', '/staff/cashier'), false)
    for (const role of [null, '', 'UNRECOGNIZED']) assert.equal(canAccessPortalPath(role, '/staff/permissions'), false)
    assert.equal(canAccessPortalPath('ADMIN', '/staff/not-configured'), false)
    assert.equal(canAccessPortalPath('KTV_XET_NGHIEM', '/staff/paraclinical-work'), true)
})
