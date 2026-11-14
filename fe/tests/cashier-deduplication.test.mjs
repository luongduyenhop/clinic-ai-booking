import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    areVouchersMatching,
    mergeVoucherData,
    deduplicateVouchers,
    groupVouchersByPatient,
} from '../src/utils/helpers/cashierInvoiceHelpers.js'

test('areVouchersMatching correctly matches invoices across formats and sources', () => {
    assert.equal(
        areVouchersMatching(
            { maPhieu: 'HD-241113-ABCDEF', id: 'PT-01' },
            { ma_hoa_don: 'hd-241113-abcdef', id: 10 }
        ),
        true
    )

    assert.equal(
        areVouchersMatching(
            { maPhieu: 'HD-HD-261113-CC9515', id: 3 },
            { maPhieu: 'HD-261113-CC9515', id: 2 }
        ),
        true
    )

    assert.equal(
        areVouchersMatching(
            { id: '15', maPhieu: 'DỰ KIẾN LẬP HÓA ĐƠN' },
            { id: 15, ma_hoa_don: 'DỰ KIẾN LẬP HÓA ĐƠN' }
        ),
        true
    )

    assert.equal(
        areVouchersMatching(
            { id: 'PT-01', maPhieu: 'DỰ KIẾN LẬP HÓA ĐƠN' },
            { id: 'PT-02', maPhieu: 'DỰ KIẾN LẬP HÓA ĐƠN' }
        ),
        false
    )

    assert.equal(
        areVouchersMatching(
            { invoiceId: '100', maPhieu: 'PT00000001' },
            { id: 100, ma_hoa_don: 'HD-100' }
        ),
        true
    )

    assert.equal(
        areVouchersMatching(
            { id: 200, maPhieu: 'PT00000002' },
            { invoiceId: '200', ma_hoa_don: 'HD-200' }
        ),
        true
    )
})

test('mergeVoucherData consolidates fields and prefers confirmed payment and line items', () => {
    const existing = {
        id: 'PT-001',
        maPhieu: 'HD-241113-0001',
        daThu: false,
        tongTien: 150000,
        items: []
    }
    const incoming = {
        id: 1,
        invoiceId: 1,
        maPhieu: 'HD-241113-0001',
        daThu: true,
        tongTien: 150000,
        items: [
            { id: 'LINE-1', tenKhoan: 'Khám Nội', soTien: 150000 }
        ]
    }
    const merged = mergeVoucherData(existing, incoming)
    assert.equal(merged.daThu, true)
    assert.equal(merged.id, 1)
    assert.equal(merged.invoiceId, 1)
    assert.equal(merged.items.length, 1)
    assert.equal(merged.items[0].tenKhoan, 'Khám Nội')
})

test('deduplicateVouchers collapses multi-source duplicates into single canonical voucher', () => {
    const multiSourceCopies = [
        {
            id: 'PT-001',
            invoiceId: 42,
            maPhieu: 'HD-241113-ABC',
            maBN: 'BN001',
            hoTenBN: 'Nguyễn Văn A',
            tongTien: 200000,
            daThu: false,
            items: []
        },
        {
            id: 42,
            invoiceId: 42,
            maPhieu: 'HD-241113-ABC',
            maBN: 'BN001',
            hoTenBN: 'Nguyễn Văn A',
            tongTien: 200000,
            daThu: true,
            items: [{ id: 'L1', tenKhoan: 'Khám Ngoại', soTien: 200000 }]
        },
        {
            id: '42',
            invoiceId: '42',
            maPhieu: 'hd-241113-abc',
            maBN: 'BN001',
            hoTenBN: 'Nguyễn Văn A',
            tongTien: 200000,
            daThu: false,
            items: []
        }
    ]

    const deduplicated = deduplicateVouchers(multiSourceCopies)
    assert.equal(deduplicated.length, 1)
    assert.equal(deduplicated[0].maPhieu, 'HD-241113-ABC')
    assert.equal(deduplicated[0].daThu, true)
    assert.equal(deduplicated[0].items.length, 1)
})

test('groupVouchersByPatient avoids duplicate cards and does not multiply invoice totals', () => {
    const vouchers = [
        {
            id: 1,
            invoiceId: 1,
            maPhieu: 'HD-001',
            maBN: 'BN01',
            hoTenBN: 'Trần Thị B',
            tongTien: 100000,
            daThu: false
        },
        {
            id: '1',
            invoiceId: '1',
            maPhieu: 'HD-001',
            maBN: 'BN01',
            hoTenBN: 'Trần Thị B',
            tongTien: 100000,
            daThu: false
        },
        {
            id: 2,
            invoiceId: 2,
            maPhieu: 'HD-002',
            maBN: 'BN01',
            hoTenBN: 'Trần Thị B',
            tongTien: 300000,
            daThu: true
        }
    ]

    const groups = groupVouchersByPatient(vouchers)
    assert.equal(groups.length, 1)
    const patientGroup = groups[0]
    assert.equal(patientGroup.vouchers.length, 2)
    assert.equal(patientGroup.totalAmount, 400000)
    assert.equal(patientGroup.unpaidCount, 1)
    assert.equal(patientGroup.paidCount, 1)
})

test('deduplicateVouchers strips HD- prefix mismatch, collapses same-encounter drafts, and preserves split bills', () => {
    assert.equal(
        areVouchersMatching(
            { id: 'PT260922003', maPhieu: 'PT260922003', tongTien: 150000, daThu: false },
            { id: 15, invoiceId: 15, maPhieu: 'HD-PT260922003', tongTien: 150000, daThu: false }
        ),
        true
    )

    assert.equal(
        areVouchersMatching(
            { id: null, invoiceId: null, luotKhamId: 42, maPhieu: 'DỰ KIẾN LẬP HÓA ĐƠN', daThu: false },
            { id: 99, invoiceId: 99, luotKhamId: 42, maKCB: 'KCB-42', maPhieu: 'HD-261114-ABC', daThu: false }
        ),
        true
    )

    assert.equal(
        areVouchersMatching(
            { id: 10, invoiceId: 10, luotKhamId: 42, maPhieu: 'HD-10', daThu: true },
            { id: 11, invoiceId: 11, luotKhamId: 42, maPhieu: 'HD-11', daThu: false }
        ),
        false
    )

    const mergedList = deduplicateVouchers([
        { id: 15, invoiceId: 15, luotKhamId: 42, maPhieu: 'HD-PT260922003', maBN: 'BN01', hoTenBN: 'Nguyễn Văn A', tongTien: 270000, daThu: false },
        { id: 'PT260922003', maPhieu: 'PT260922003', maBN: 'BN01', hoTenBN: 'Nguyễn Văn A', tongTien: 270000, daThu: true },
    ])
    assert.equal(mergedList.length, 1)
    assert.equal(mergedList[0].daThu, true)
    assert.equal(mergedList[0].invoiceId, 15)
})
