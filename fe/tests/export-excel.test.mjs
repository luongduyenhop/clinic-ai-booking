import assert from 'node:assert/strict'
import { test } from 'node:test'
import ExcelJS from 'exceljs'
import { exportToExcel, exportToCsv } from '../src/utils/helpers/exportUtils.js'

let lastCreatedBlob = null
let lastDownloadName = null

class MockBlob {
    constructor(parts, options) {
        this.parts = parts
        this.options = options
        this.buffer = parts[0]
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

test('exportToExcel generates valid Excel OpenXML .xlsx workbook with clinic branding and styles', async () => {
    lastCreatedBlob = null
    lastDownloadName = null

    const success = await exportToExcel({
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
    assert.equal(lastDownloadName, 'bang-gia-dich-vu.xlsx')
    assert.ok(lastCreatedBlob)
    assert.equal(lastCreatedBlob.options.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    const readWorkbook = new ExcelJS.Workbook()
    await readWorkbook.xlsx.load(lastCreatedBlob.buffer)
    const worksheet = readWorkbook.getWorksheet('Dịch Vụ')
    assert.ok(worksheet)

    assert.ok(String(worksheet.getCell(1, 1).value).includes('PHÒNG KHÁM ĐA KHOA QUỐC TẾ CLINIC-AI'))
    assert.equal(worksheet.getCell(4, 1).value, 'BẢNG GIÁ DỊCH VỤ KỸ THUẬT')
    assert.ok(String(worksheet.getCell(5, 1).value).includes('Niêm yết tháng 11/2026'))

    const headerRow = worksheet.getRow(7)
    assert.equal(headerRow.getCell(1).value, 'Mã DV')
    assert.equal(headerRow.getCell(2).value, 'Tên dịch vụ')
    assert.equal(headerRow.getCell(3).value, 'Đơn giá niêm yết (VNĐ)')

    const dataRow1 = worksheet.getRow(8)
    assert.equal(dataRow1.getCell(1).value, 'DV001')
    assert.equal(dataRow1.getCell(2).value, 'Khám Tim mạch')
    assert.equal(dataRow1.getCell(3).value, 250000)
    assert.equal(dataRow1.getCell(3).numFmt, '#,##0 "₫"')

    const dataRow2 = worksheet.getRow(9)
    assert.equal(dataRow2.getCell(1).value, 'DV002')
    assert.equal(dataRow2.getCell(3).value, 180000)

    const summaryRow = worksheet.getRow(10)
    assert.equal(summaryRow.getCell(1).value, 'TỔNG CỘNG: 2 BẢN GHI')
    assert.equal(summaryRow.getCell(3).value, 430000)
    assert.equal(summaryRow.getCell(3).numFmt, '#,##0 "₫"')

    const signRow = worksheet.getRow(13)
    assert.equal(signRow.getCell(1).value, 'NGƯỜI LẬP BIỂU')
    assert.equal(signRow.getCell(5).value, 'GIÁM ĐỐC CHUYÊN MÔN')
})

test('exportToExcel automatically normalizes .csv and .xls extension to .xlsx', async () => {
    lastCreatedBlob = null
    lastDownloadName = null

    await exportToExcel({
        filename: 'report.csv',
        headers: ['Mã', 'Tên'],
        rows: [['01', 'Test']],
    })

    assert.equal(lastDownloadName, 'report.xlsx')
})

test('exportToCsv wraps exportToExcel transparently and generates readable .xlsx workbook', async () => {
    lastCreatedBlob = null
    lastDownloadName = null

    const headers = ['Mã NV', 'Họ tên', 'Lương cơ bản (VNĐ)']
    const rows = [
        ['NV01', 'Nguyễn Văn A', 15000000],
        ['NV02', 'Trần Thị B', 18000000],
    ]

    await exportToCsv('danh-sach-nhan-vien.csv', headers, rows)

    assert.equal(lastDownloadName, 'danh-sach-nhan-vien.xlsx')
    assert.ok(lastCreatedBlob)

    const readWorkbook = new ExcelJS.Workbook()
    await readWorkbook.xlsx.load(lastCreatedBlob.buffer)
    const worksheet = readWorkbook.worksheets[0]
    assert.ok(worksheet)
    assert.equal(worksheet.getCell(4, 1).value, 'BẢNG DỮ LIỆU TRÍCH XUẤT HỆ THỐNG')

    const summaryRow = worksheet.getRow(10)
    assert.equal(summaryRow.getCell(1).value, 'TỔNG CỘNG: 2 BẢN GHI')
    assert.equal(summaryRow.getCell(3).value, 33000000)
    assert.equal(summaryRow.getCell(3).numFmt, '#,##0 "₫"')
})

test('exportToExcel returns false safely when rows are empty', async () => {
    lastCreatedBlob = null
    lastDownloadName = null

    const success = await exportToExcel({
        filename: 'empty-catalog.xlsx',
        headers: ['Mã', 'Tên'],
        rows: [],
    })

    assert.equal(success, false)
    assert.equal(lastCreatedBlob, null)
})
