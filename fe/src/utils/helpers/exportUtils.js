import ExcelJS from 'exceljs'

function getResolvedClinicInfo() {
    try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('CLINIC_AI_MANAGEMENT_DB_V3_CLINICAL') : null
        if (raw) {
            const parsed = JSON.parse(raw)
            const s = parsed.clinicSettings
            if (s && (s.tenPhongKham || s.tenCoSo)) {
                const name = String(s.tenPhongKham || s.tenCoSo).toUpperCase()
                const parts = [
                    s.diaChi || 'Số 18 Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội',
                    s.dienThoai ? `Hotline: ${s.dienThoai}` : 'Hotline: 1900 2115',
                    s.giayPhepHoatDong ? `GPHĐ: ${s.giayPhepHoatDong}` : 'GPHĐ: Số 1428/HNO-GPHĐ',
                ].filter(Boolean)
                return {
                    name,
                    address: parts.join(' | '),
                }
            }
        }
    } catch {
        return {
            name: 'PHÒNG KHÁM ĐA KHOA QUỐC TẾ CLINIC-AI',
            address: 'Số 18 Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội | Hotline: 1900 2115 | GPHĐ: Số 1428/HNO-GPHĐ',
        }
    }
    return {
        name: 'PHÒNG KHÁM ĐA KHOA QUỐC TẾ CLINIC-AI',
        address: 'Số 18 Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội | Hotline: 1900 2115 | GPHĐ: Số 1428/HNO-GPHĐ',
    }
}

function inferColumnType(headerText, sampleValues = []) {
    const headerLower = String(headerText || '').toLowerCase()

    if (
        headerLower.includes('giá') ||
        headerLower.includes('tiền') ||
        headerLower.includes('chi phí') ||
        headerLower.includes('doanh thu') ||
        headerLower.includes('viện phí') ||
        headerLower.includes('đơn giá') ||
        headerLower.includes('lương') ||
        headerLower.includes('vnđ') ||
        headerLower.includes('vnd')
    ) {
        return 'currency'
    }

    if (
        headerLower.includes('số lượng') ||
        headerLower.includes('tuổi') ||
        headerLower.includes('thứ tự')
    ) {
        return 'number'
    }

    if (
        headerLower.includes('ngày') ||
        headerLower.includes('thời gian')
    ) {
        return 'date'
    }

    if (
        headerLower.includes('mã') ||
        headerLower.includes('stt') ||
        headerLower.includes('icd') ||
        headerLower.includes('ip') ||
        headerLower.includes('trạng thái')
    ) {
        return 'code'
    }

    const hasOnlyNumbers = sampleValues.length > 0 && sampleValues.every((v) => {
        if (v === null || v === undefined || v === '') return true
        return typeof v === 'number' || (!isNaN(Number(v)) && !String(v).startsWith('0'))
    })

    if (hasOnlyNumbers && sampleValues.some((v) => typeof v === 'number')) {
        return 'number'
    }

    return 'text'
}

function inferColumnWidth(headerText, type) {
    const text = String(headerText || '').toLowerCase()
    if (text.includes('tên') || text.includes('nội dung') || text.includes('mô tả') || text.includes('bệnh nhân')) {
        return 34
    }
    if (text.includes('nhóm') || text.includes('chuyên khoa') || text.includes('chẩn đoán') || text.includes('chương') || text.includes('hoạt chất') || text.includes('lý do')) {
        return 26
    }
    if (type === 'currency') {
        return 20
    }
    if (type === 'date' || text.includes('thời gian') || text.includes('ngày')) {
        return 22
    }
    if (text.includes('trạng thái') || text.includes('kết quả') || text.includes('xếp loại') || text.includes('truyền nhiễm')) {
        return 18
    }
    if (text.includes('mã') || text.includes('stt') || text.includes('đơn vị')) {
        return 14
    }
    return 20
}

export async function exportToExcel(optionsOrFilename, optionalHeaders, optionalRows) {
    let config = {}
    if (typeof optionsOrFilename === 'string') {
        config = {
            filename: optionsOrFilename,
            headers: optionalHeaders || [],
            rows: optionalRows || [],
        }
    } else if (optionsOrFilename && typeof optionsOrFilename === 'object') {
        config = { ...optionsOrFilename }
    }

    const defaultClinic = getResolvedClinicInfo()

    const {
        filename = 'bao-cao-clinic-ai',
        sheetName = 'Báo cáo',
        title = 'BÁO CÁO QUẢN TRỊ PHÒNG KHÁM',
        subtitle = '',
        clinicName = defaultClinic.name,
        clinicAddress = defaultClinic.address,
        headers = [],
        rows = [],
        columnTypes: customColumnTypes = [],
        columnWidths: customColumnWidths = [],
        signOff = true,
    } = config

    if (!rows || rows.length === 0) {
        return false
    }

    const colCount = Math.max(headers.length, rows[0]?.length || 1)
    const exportTime = new Date().toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    })

    const columnTypes = headers.map((h, i) => {
        if (customColumnTypes[i]) return customColumnTypes[i]
        const sampleColValues = rows.slice(0, 20).map((r) => r[i])
        return inferColumnType(h, sampleColValues)
    })

    const columnWidths = headers.map((h, i) => {
        if (customColumnWidths[i]) return customColumnWidths[i]
        return inferColumnWidth(h, columnTypes[i])
    })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Clinic-AI Healthcare HIS'
    workbook.lastModifiedBy = 'Clinic-AI Admin'
    workbook.created = new Date()
    workbook.modified = new Date()

    const worksheet = workbook.addWorksheet(sheetName.slice(0, 31), {
        views: [{ showGridLines: true }],
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    })

    worksheet.columns = columnWidths.map((w) => ({ width: w }))

    worksheet.mergeCells(1, 1, 1, colCount)
    const clinicNameCell = worksheet.getCell(1, 1)
    clinicNameCell.value = String(clinicName).toUpperCase()
    clinicNameCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF003553' } }
    clinicNameCell.alignment = { horizontal: 'left', vertical: 'middle' }
    worksheet.getRow(1).height = 24

    worksheet.mergeCells(2, 1, 2, colCount)
    const clinicAddressCell = worksheet.getCell(2, 1)
    clinicAddressCell.value = clinicAddress
    clinicAddressCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } }
    clinicAddressCell.alignment = { horizontal: 'left', vertical: 'middle' }
    worksheet.getRow(2).height = 18

    worksheet.getRow(3).height = 10

    worksheet.mergeCells(4, 1, 4, colCount)
    const titleCell = worksheet.getCell(4, 1)
    titleCell.value = String(title).toUpperCase()
    titleCell.font = { name: 'Segoe UI', size: 15, bold: true, color: { argb: 'FF007AA8' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getRow(4).height = 30

    worksheet.mergeCells(5, 1, 5, colCount)
    const subtitleCell = worksheet.getCell(5, 1)
    const subParts = [
        subtitle ? subtitle : null,
        `Ngày xuất biểu: ${exportTime}`,
    ].filter(Boolean)
    subtitleCell.value = subParts.join(' • ')
    subtitleCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF475569' } }
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getRow(5).height = 20

    worksheet.getRow(6).height = 10

    const headerRow = worksheet.getRow(7)
    headerRow.values = headers
    headerRow.height = 28

    const headerBorder = {
        top: { style: 'thin', color: { argb: 'FF7DD3FC' } },
        bottom: { style: 'thin', color: { argb: 'FF7DD3FC' } },
        left: { style: 'thin', color: { argb: 'FF7DD3FC' } },
        right: { style: 'thin', color: { argb: 'FF7DD3FC' } },
    }

    for (let c = 1; c <= colCount; c++) {
        const cell = headerRow.getCell(c)
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B5F1' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = headerBorder
    }

    const dataBorder = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    }

    let currentRowIndex = 8
    const currencyTotals = {}

    rows.forEach((row, rIdx) => {
        const dataRow = worksheet.getRow(currentRowIndex)
        dataRow.height = 22
        const isEven = rIdx % 2 === 0
        const rowBgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC'

        for (let c = 1; c <= colCount; c++) {
            const cell = dataRow.getCell(c)
            const val = row[c - 1]
            const type = columnTypes[c - 1] || 'text'

            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } }
            cell.border = dataBorder
            cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } }

            if (type === 'currency') {
                const numericVal = typeof val === 'number' ? val : Number(String(val || '').replace(/[^\d.-]/g, ''))
                const safeNum = isNaN(numericVal) ? 0 : numericVal
                cell.value = safeNum
                cell.numFmt = '#,##0 "₫"'
                cell.alignment = { horizontal: 'right', vertical: 'middle' }
                currencyTotals[c] = (currencyTotals[c] || 0) + safeNum
            } else if (type === 'number') {
                const numericVal = typeof val === 'number' ? val : Number(val)
                const safeNum = isNaN(numericVal) ? 0 : numericVal
                cell.value = safeNum
                cell.numFmt = '#,##0'
                cell.alignment = { horizontal: 'right', vertical: 'middle' }
            } else if (type === 'code' || type === 'date') {
                cell.value = val === null || val === undefined ? '' : String(val)
                cell.alignment = { horizontal: 'center', vertical: 'middle' }
            } else {
                cell.value = val === null || val === undefined ? '' : String(val)
                cell.alignment = { horizontal: 'left', vertical: 'middle' }
            }
        }
        currentRowIndex++
    })

    const hasCurrencyColumns = Object.keys(currencyTotals).length > 0
    const summaryRow = worksheet.getRow(currentRowIndex)
    summaryRow.height = 24

    const summaryBorder = {
        top: { style: 'medium', color: { argb: 'FF00B5F1' } },
        bottom: { style: 'medium', color: { argb: 'FF00B5F1' } },
        left: { style: 'thin', color: { argb: 'FF7DD3FC' } },
        right: { style: 'thin', color: { argb: 'FF7DD3FC' } },
    }

    const firstCurrencyCol = hasCurrencyColumns ? Math.min(...Object.keys(currencyTotals).map(Number)) : colCount

    if (firstCurrencyCol > 1) {
        worksheet.mergeCells(currentRowIndex, 1, currentRowIndex, firstCurrencyCol - 1)
    }

    const summaryTitleCell = summaryRow.getCell(1)
    summaryTitleCell.value = `TỔNG CỘNG: ${rows.length} BẢN GHI`
    summaryTitleCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF003553' } }
    summaryTitleCell.alignment = { horizontal: 'left', vertical: 'middle' }

    for (let c = 1; c <= colCount; c++) {
        const cell = summaryRow.getCell(c)
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }
        cell.border = summaryBorder

        if (currencyTotals[c] !== undefined) {
            cell.value = currencyTotals[c]
            cell.numFmt = '#,##0 "₫"'
            cell.alignment = { horizontal: 'right', vertical: 'middle' }
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF007AA8' } }
        }
    }
    currentRowIndex++

    if (signOff) {
        currentRowIndex += 2
        const signTitleRow = worksheet.getRow(currentRowIndex)
        signTitleRow.height = 20

        const signTitleFont = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF003553' } }
        const signSubFont = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF64748B' } }

        const colLeft = 1
        const colMid = Math.max(2, Math.floor(colCount / 2))
        const colRight = colCount

        const leftCell = signTitleRow.getCell(colLeft)
        leftCell.value = 'NGƯỜI LẬP BIỂU'
        leftCell.font = signTitleFont
        leftCell.alignment = { horizontal: 'center', vertical: 'middle' }

        if (colMid !== colLeft && colMid !== colRight) {
            const midCell = signTitleRow.getCell(colMid)
            midCell.value = 'TRƯỞNG BỘ PHẬN'
            midCell.font = signTitleFont
            midCell.alignment = { horizontal: 'center', vertical: 'middle' }
        }

        const rightCell = signTitleRow.getCell(colRight)
        rightCell.value = 'GIÁM ĐỐC CHUYÊN MÔN'
        rightCell.font = signTitleFont
        rightCell.alignment = { horizontal: 'center', vertical: 'middle' }

        const signSubRow = worksheet.getRow(currentRowIndex + 1)
        signSubRow.height = 18

        const leftSub = signSubRow.getCell(colLeft)
        leftSub.value = '(Ký, ghi rõ họ tên)'
        leftSub.font = signSubFont
        leftSub.alignment = { horizontal: 'center', vertical: 'middle' }

        if (colMid !== colLeft && colMid !== colRight) {
            const midSub = signSubRow.getCell(colMid)
            midSub.value = '(Ký, ghi rõ họ tên)'
            midSub.font = signSubFont
            midSub.alignment = { horizontal: 'center', vertical: 'middle' }
        }

        const rightSub = signSubRow.getCell(colRight)
        rightSub.value = '(Ký, đóng dấu)'
        rightSub.font = signSubFont
        rightSub.alignment = { horizontal: 'center', vertical: 'middle' }
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    let cleanFilename = filename
    if (cleanFilename.toLowerCase().endsWith('.csv')) {
        cleanFilename = cleanFilename.slice(0, -4)
    }
    if (cleanFilename.toLowerCase().endsWith('.xls')) {
        cleanFilename = cleanFilename.slice(0, -4)
    }
    if (!cleanFilename.toLowerCase().endsWith('.xlsx')) {
        cleanFilename = `${cleanFilename}.xlsx`
    }

    if (typeof document !== 'undefined') {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = cleanFilename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    return true
}

export async function exportToCsv(filename, headers, rows) {
    return exportToExcel({
        filename,
        headers,
        rows,
        title: 'BẢNG DỮ LIỆU TRÍCH XUẤT HỆ THỐNG',
    })
}

export function printDocument() {
    window.print()
}
