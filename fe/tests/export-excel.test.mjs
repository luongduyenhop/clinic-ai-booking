import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exportToExcel, exportToCsv } from '../src/utils/helpers/exportUtils.js'

let lastCreatedBlob = null
let lastDownloadName = null

class MockBlob {
    constructor(parts, options) {
        this.parts = parts
        this.options = options
        this.content = parts.join('')
        lastCreatedBlob = this
    }
}

const mockLink = {
    setAttribute: (name, val) => {
        if (name === 'download') lastDownloadName = val
    },
    set href(val) {
        this._href = val
    },
    get href() {
        return this._href
    },
    set download(val) {
        lastDownloadName = val
    },
    get download() {
        return lastDownloadName
    },
    click: () => {},
}

const mockDoc = {
    createElement: (tag) => {
        if (tag === 'a') return mockLink
        return {}
    },
    body: {
        appendChild: () => {},
        removeChild: () => {},
    },
}

const mockUrl = {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: () => {},
}

globalThis.Blob = MockBlob
globalThis.document = mockDoc
globalThis.URL = mockUrl

test('exportToExcel generates valid Excel HTML template with UTF-8 BOM and clinic header', () => {
    lastCreatedBlob = null
    lastDownloadName = null

    const success = exportToExcel({
        filename: 'bang-gia-dich-vu.xls',
        sheetName: 'Dịch Vụ',
        title: 'BẢNG GIÁ DỊCH VỤ KỸ THUẬT',
        subtitle: 'Niêm yết tháng 11/2026',
        headers: ['Mã DV', 'Tên dịch vụ', 'Đơn giá niêm yết (VNĐ)', 'Số điện thoại liên hệ', 'Trạng thái'],
        rows: [
            ['DV001', 'Khám Tim mạch', 250000, '0901234567', 'Đang áp dụng'],
            ['DV002', 'Chụp X-Quang ngực thẳng', 180000, '0988888888', 'Đang áp dụng'],
        ],
        signOff: true,
    })

    assert.equal(success, true)
    assert.equal(lastDownloadName, 'bang-gia-dich-vu.xls')
    assert.ok(lastCreatedBlob)
    assert.equal(lastCreatedBlob.options.type, 'application/vnd.ms-excel;charset=utf-8;')

    const raw = lastCreatedBlob.content
    assert.ok(raw.startsWith('\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office"'))
    assert.ok(raw.includes('PHÒNG KHÁM ĐA KHOA QUỐC TẾ MEDPRO'))
    assert.ok(raw.includes('BẢNG GIÁ DỊCH VỤ KỸ THUẬT'))
    assert.ok(raw.includes('Niêm yết tháng 11/2026'))
    assert.ok(raw.includes('DV001'))
    assert.ok(raw.includes('250.000 ₫'))
    assert.ok(raw.includes('180.000 ₫'))
    assert.ok(raw.includes('mso-number-format:'))
    assert.ok(raw.includes('0901234567'))
    assert.ok(raw.includes('<colgroup>'))
    assert.ok(raw.includes('cell-summary-title'))
    assert.ok(raw.includes('cell-summary-value'))
    assert.ok(raw.includes('TỔNG CỘNG: 2 BẢN GHI'))
    assert.ok(raw.includes('430.000 ₫'))
    assert.ok(raw.includes('NGƯỜI LẬP BIỂU'))
    assert.ok(raw.includes('TRƯỞNG BỘ PHẬN'))
    assert.ok(raw.includes('GIÁM ĐỐC CHUYÊN MÔN'))
})

test('exportToExcel automatically normalizes .csv extension to .xls', () => {
    lastCreatedBlob = null
    lastDownloadName = null

    exportToExcel({
        filename: 'report.csv',
        headers: ['Mã', 'Tên'],
        rows: [['01', 'Test']],
    })

    assert.equal(lastDownloadName, 'report.xls')
})

test('exportToCsv wraps exportToExcel transparently and generates readable spreadsheet', () => {
    lastCreatedBlob = null
    lastDownloadName = null

    const headers = ['Mã NV', 'Họ tên', 'Lương cơ bản (VNĐ)']
    const rows = [
        ['NV01', 'Nguyễn Văn A', 15000000],
        ['NV02', 'Trần Thị B', 18000000],
    ]

    exportToCsv('danh-sach-nhan-vien.csv', headers, rows)

    assert.equal(lastDownloadName, 'danh-sach-nhan-vien.xls')
    assert.ok(lastCreatedBlob.content.includes('BẢNG DỮ LIỆU TRÍCH XUẤT HỆ THỐNG'))
    assert.ok(lastCreatedBlob.content.includes('15.000.000 ₫'))
    assert.ok(lastCreatedBlob.content.includes('18.000.000 ₫'))
    assert.ok(lastCreatedBlob.content.includes('TỔNG CỘNG: 2 BẢN GHI'))
    assert.ok(lastCreatedBlob.content.includes('33.000.000 ₫'))
})

test('exportToExcel returns false safely when rows are empty', () => {
    lastCreatedBlob = null
    lastDownloadName = null

    const success = exportToExcel({
        filename: 'empty-catalog.xls',
        headers: ['Mã', 'Tên'],
        rows: [],
    })

    assert.equal(success, false)
    assert.equal(lastCreatedBlob, null)
})
