import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getStaffRoleConfig, normalizeStaffRole } from '../src/utils/constants/staffRoles.js'

test('all six API roles display their own label rather than falling back to admin', () => {
    for (const [apiRole, databaseRole, label] of [
        ['ADMIN', 'admin', 'Quản trị viên'],
        ['DOCTOR', 'bac_si', 'Bác sĩ'],
        ['RECEPTIONIST', 'le_tan', 'Lễ tân – Thu ngân'],
        ['CASHIER', 'thu_ngan', 'Lễ tân – Thu ngân'],
        ['TECHNICIAN', 'ky_thuat_vien', 'Kỹ thuật viên CLS'],
        ['PATIENT', 'benh_nhan', 'Bệnh nhân'],
    ]) {
        assert.equal(getStaffRoleConfig(apiRole).label, label)
        assert.equal(getStaffRoleConfig(databaseRole).label, label)
        assert.equal(normalizeStaffRole(apiRole), normalizeStaffRole(databaseRole))
    }
})

test('a missing or unsupported role never displays as administrator', () => {
    for (const role of [undefined, null, '', 'UNRECOGNIZED_ROLE']) {
        assert.equal(normalizeStaffRole(role), null)
        assert.equal(getStaffRoleConfig(role).label, 'Chưa xác định vai trò')
    }
})
