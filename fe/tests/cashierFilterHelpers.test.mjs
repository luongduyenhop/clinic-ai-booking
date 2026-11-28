import test from 'node:test'
import assert from 'node:assert/strict'
import {
    toClinicDateParts,
    resolveVoucherShift,
    getDateRangeForPreset,
    matchesVoucherDateAndShift,
} from '../src/utils/helpers/cashierInvoiceHelpers.js'

test('toClinicDateParts converts UTC timestamps around GMT+7 midnight cleanly', () => {
    const morningMidnightVn = toClinicDateParts('2026-11-27T17:30:00Z')
    assert.deepEqual(morningMidnightVn, { dateKey: '2026-11-28', hour: 0 })

    const afternoonStartVn = toClinicDateParts('2026-11-28T05:00:00Z')
    assert.deepEqual(afternoonStartVn, { dateKey: '2026-11-28', hour: 12 })

    assert.equal(toClinicDateParts(null), null)
    assert.equal(toClinicDateParts('not-a-date'), null)
})

test('resolveVoucherShift separates morning (<12:00) and afternoon (>=12:00) GMT+7', () => {
    assert.equal(resolveVoucherShift('2026-11-28T04:59:00Z'), 'sang')
    assert.equal(resolveVoucherShift('2026-11-28T05:00:00Z'), 'chieu')
    assert.equal(resolveVoucherShift(null), '')
})

test('getDateRangeForPreset returns TODAY, THIS_MONTH, and ALL bounds in GMT+7', () => {
    const refNow = new Date('2026-11-27T18:15:00Z')
    assert.deepEqual(getDateRangeForPreset('TODAY', refNow), {
        fromDate: '2026-11-28',
        toDate: '2026-11-28',
    })
    assert.deepEqual(getDateRangeForPreset('THIS_MONTH', refNow), {
        fromDate: '2026-11-01',
        toDate: '2026-11-28',
    })
    assert.deepEqual(getDateRangeForPreset('ALL', refNow), {
        fromDate: '',
        toDate: '',
    })
})

test('matchesVoucherDateAndShift filters paid and unpaid vouchers accurately', () => {
    const paidMorning = {
        trangThai: 'da_thu',
        daThu: true,
        ngayThanhToan: '2026-11-27T17:30:00Z',
        createdAt: '2026-11-27T17:00:00Z',
    }
    const unpaidAfternoon = {
        trangThai: 'chua_thu',
        daThu: false,
        ngayThanhToan: null,
        createdAt: '2026-11-28T07:15:00Z',
    }

    assert.equal(
        matchesVoucherDateAndShift(paidMorning, { fromDate: '2026-11-28', toDate: '2026-11-28', shiftFilter: 'sang' }),
        true
    )
    assert.equal(
        matchesVoucherDateAndShift(paidMorning, { fromDate: '2026-11-28', toDate: '2026-11-28', shiftFilter: 'chieu' }),
        false
    )
    assert.equal(
        matchesVoucherDateAndShift(unpaidAfternoon, { fromDate: '2026-11-28', toDate: '2026-11-28', shiftFilter: 'chieu' }),
        true
    )
    assert.equal(
        matchesVoucherDateAndShift(unpaidAfternoon, { fromDate: '2026-11-01', toDate: '2026-11-27', shiftFilter: 'ALL' }),
        false
    )
    assert.equal(matchesVoucherDateAndShift(paidMorning, { fromDate: '', toDate: '', shiftFilter: 'ALL' }), true)
})
