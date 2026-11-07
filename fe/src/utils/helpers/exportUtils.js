function escapeXml(value) {
    if (value === null || value === undefined) return ''
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function detectCellType(val, headerText = '') {
    if (val === null || val === undefined || val === '') return 'text'
    const str = String(val).trim()
    const headerLower = String(headerText).toLowerCase()

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
        const num = Number(String(val).replace(/[^\d.-]/g, ''))
        if (!isNaN(num) && str !== '') return 'currency'
    }

    if (
        headerLower.includes('số lượng') ||
        headerLower.includes('tuổi') ||
        headerLower.includes('lượt')
    ) {
        const num = Number(str)
        if (!isNaN(num)) return 'number'
    }

    if (
        str.startsWith('0') &&
        str.length > 1 &&
        /^\d+$/.test(str)
    ) {
        return 'text-preserve-zero'
    }

    if (
        /^\d{4}-\d{2}-\d{2}/.test(str) ||
        /^\d{2}\/\d{2}\/\d{4}/.test(str)
    ) {
        return 'center'
    }

    if (
        headerLower.includes('mã') ||
        headerLower.includes('stt') ||
        headerLower.includes('ip') ||
        headerLower.includes('giới tính') ||
        headerLower.includes('trạng thái')
    ) {
        return 'center'
    }

    return 'text'
}

function getColumnWidth(type, headerText = '') {
    const text = String(headerText).toLowerCase()
    if (text.includes('tên') || text.includes('nội dung') || text.includes('mô tả') || text.includes('bệnh nhân')) {
        return { px: 260, pt: 195 }
    }
    if (text.includes('nhóm') || text.includes('chuyên khoa') || text.includes('chẩn đoán') || text.includes('hành động') || text.includes('lý do')) {
        return { px: 180, pt: 135 }
    }
    if (text.includes('mã') || text.includes('stt') || text.includes('ip') || text.includes('đơn vị')) {
        return { px: 100, pt: 75 }
    }
    if (type === 'currency') {
        return { px: 140, pt: 105 }
    }
    if (type === 'date' || text.includes('thời gian') || text.includes('ngày')) {
        return { px: 150, pt: 112 }
    }
    if (text.includes('trạng thái') || text.includes('kết quả') || text.includes('xếp loại')) {
        return { px: 120, pt: 90 }
    }
    return { px: 140, pt: 105 }
}

function formatCellValue(val, type) {
    if (val === null || val === undefined) return ''
    if (type === 'currency') {
        const num = Number(String(val).replace(/[^\d.-]/g, ''))
        if (!isNaN(num)) {
            return num.toLocaleString('vi-VN') + ' ₫'
        }
    }
    return String(val)
}

function getCellStyle(type) {
    switch (type) {
        case 'currency':
            return 'cell-currency'
        case 'number':
            return 'cell-number'
        case 'center':
        case 'text-preserve-zero':
            return 'cell-center'
        default:
            return 'cell-text'
    }
}

export function exportToExcel(optionsOrFilename, optionalHeaders, optionalRows) {
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

    const {
        filename = 'bao-cao-clinic-ai',
        sheetName = 'Báo cáo',
        title = 'BÁO CÁO QUẢN TRỊ PHÒNG KHÁM',
        subtitle = '',
        clinicName = 'PHÒNG KHÁM ĐA KHOA QUỐC TẾ MEDPRO - CLINIC-AI',
        clinicAddress = 'Số 18 Duy Tân, Cầu Giấy, Hà Nội | Hotline: 1900 2115 | GPHĐ: 1428/HNO-GPHD',
        headers = [],
        rows = [],
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

    const columnTypes = headers.map((h, colIdx) => {
        for (let rowIdx = 0; rowIdx < Math.min(rows.length, 5); rowIdx++) {
            const cellVal = rows[rowIdx]?.[colIdx]
            if (cellVal !== null && cellVal !== undefined && cellVal !== '') {
                return detectCellType(cellVal, h)
            }
        }
        return detectCellType('', h)
    })

    const columnWidths = headers.map((h, colIdx) => {
        const type = columnTypes[colIdx] || 'text'
        return getColumnWidth(type, h)
    })

    let totalAmount = 0
    let hasCurrencyColumn = false
    let currencyColIdx = -1

    columnTypes.forEach((t, idx) => {
        if (t === 'currency') {
            hasCurrencyColumn = true
            currencyColIdx = idx
        }
    })

    if (hasCurrencyColumn && currencyColIdx >= 0) {
        rows.forEach((row) => {
            const rawVal = row[currencyColIdx]
            const num = Number(String(rawVal).replace(/[^\d.-]/g, ''))
            if (!isNaN(num)) totalAmount += num
        })
    }

    const xmlTemplate = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<!--[if gte mso 9]>
<xml>
  <x:ExcelWorkbook>
    <x:ExcelWorksheets>
      <x:ExcelWorksheet>
        <x:Name>${escapeXml(sheetName)}</x:Name>
        <x:WorksheetOptions>
          <x:DisplayGridlines/>
          <x:Print>
            <x:ValidPrinterInfo/>
            <x:PaperSizeIndex>9</x:PaperSizeIndex>
            <x:HorizontalResolution>600</x:HorizontalResolution>
            <x:VerticalResolution>600</x:VerticalResolution>
          </x:Print>
        </x:WorksheetOptions>
      </x:ExcelWorksheet>
    </x:ExcelWorksheets>
  </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
  .clinic-name { font-size: 11pt; font-weight: bold; color: #003553; text-transform: uppercase; }
  .clinic-meta { font-size: 9pt; color: #64748B; font-style: italic; }
  .report-title { font-size: 15pt; font-weight: bold; color: #007AA8; text-align: center; text-transform: uppercase; padding: 12px 0 4px 0; }
  .report-sub { font-size: 9.5pt; color: #475569; text-align: center; padding-bottom: 12px; }
  .table-header { font-size: 10pt; font-weight: bold; background-color: #00B5F1; color: #FFFFFF; text-align: center; vertical-align: middle; height: 32px; border: 1px solid #7DD3FC; }
  .cell-text { font-size: 9.5pt; vertical-align: middle; padding: 6px; border: 1px solid #CBD5E1; text-align: left; mso-number-format: "\\@"; }
  .cell-center { font-size: 9.5pt; vertical-align: middle; padding: 6px; border: 1px solid #CBD5E1; text-align: center; mso-number-format: "\\@"; }
  .cell-number { font-size: 9.5pt; vertical-align: middle; padding: 6px; border: 1px solid #CBD5E1; text-align: right; mso-number-format: "\\#\\,\\#\\#0"; }
  .cell-currency { font-size: 9.5pt; vertical-align: middle; padding: 6px; border: 1px solid #CBD5E1; text-align: right; font-weight: bold; color: #047857; mso-number-format: "\\#\\,\\#\\#0\\ \\"₫\\""; }
  .cell-bg-even { background-color: #F8FBFE; }
  .cell-bg-odd { background-color: #FFFFFF; }
  .cell-summary-title { font-size: 10pt; font-weight: bold; background-color: #E0F2FE; color: #003553; border: 1px solid #7DD3FC; padding: 6px; text-align: left; }
  .cell-summary-value { font-size: 10pt; font-weight: bold; background-color: #E0F2FE; color: #047857; border: 1px solid #7DD3FC; padding: 6px; text-align: right; mso-number-format: "\\#\\,\\#\\#0\\ \\"₫\\""; }
  .cell-summary-empty { background-color: #E0F2FE; border: 1px solid #7DD3FC; }
  .sign-title { font-size: 10pt; font-weight: bold; color: #003553; text-align: center; }
  .sign-sub { font-size: 8.5pt; font-style: italic; color: #64748B; text-align: center; }
</style>
</head>
<body>
<table>
  <colgroup>
    ${columnWidths
        .map((w) => `<col width="${w.px}" style="width: ${w.pt}pt;" />`)
        .join('\n    ')}
  </colgroup>

  <tr>
    <td colspan="${colCount}" class="clinic-name">${escapeXml(clinicName)}</td>
  </tr>
  <tr>
    <td colspan="${colCount}" class="clinic-meta">${escapeXml(clinicAddress)}</td>
  </tr>
  <tr><td colspan="${colCount}"></td></tr>
  <tr>
    <td colspan="${colCount}" class="report-title">${escapeXml(title)}</td>
  </tr>
  <tr>
    <td colspan="${colCount}" class="report-sub">
      ${subtitle ? escapeXml(subtitle) + ' &bull; ' : ''}Ngày xuất biểu: <strong>${escapeXml(exportTime)}</strong>
    </td>
  </tr>
  <tr><td colspan="${colCount}"></td></tr>

  <tr>
    ${headers
        .map((h, i) => `<th class="table-header" style="width: ${columnWidths[i]?.pt || 100}pt;">${escapeXml(h)}</th>`)
        .join('')}
  </tr>

  ${rows
      .map((row, rIdx) => {
          const bgClass = rIdx % 2 === 0 ? 'cell-bg-even' : 'cell-bg-odd'
          const cells = row
              .map((cellVal, cIdx) => {
                  const type = columnTypes[cIdx] || 'text'
                  const styleClass = getCellStyle(type)
                  const display = formatCellValue(cellVal, type)
                  return `<td class="${styleClass} ${bgClass}">${escapeXml(display)}</td>`
              })
              .join('')
          return `<tr>${cells}</tr>`
      })
      .join('')}

  <tr style="height: 30px;">
    <td colspan="${hasCurrencyColumn && currencyColIdx > 0 ? currencyColIdx : 2}" class="cell-summary-title">
      TỔNG CỘNG: ${rows.length} BẢN GHI
    </td>
    ${
        hasCurrencyColumn && currencyColIdx > 0
            ? `<td class="cell-summary-value">${escapeXml(totalAmount.toLocaleString('vi-VN') + ' ₫')}</td>` +
              (colCount - currencyColIdx - 1 > 0
                  ? `<td colspan="${colCount - currencyColIdx - 1}" class="cell-summary-empty"></td>`
                  : '')
            : colCount > 2
            ? `<td colspan="${colCount - 2}" class="cell-summary-empty"></td>`
            : ''
    }
  </tr>

  ${
      signOff
          ? `
  <tr><td colspan="${colCount}"></td></tr>
  <tr><td colspan="${colCount}"></td></tr>
  <tr>
    <td colspan="${Math.max(1, Math.floor(colCount / 3))}" class="sign-title">NGƯỜI LẬP BIỂU</td>
    <td colspan="${Math.max(1, Math.floor(colCount / 3))}" class="sign-title">TRƯỞNG BỘ PHẬN</td>
    <td colspan="${colCount - 2 * Math.max(1, Math.floor(colCount / 3))}" class="sign-title">GIÁM ĐỐC CHUYÊN MÔN</td>
  </tr>
  <tr>
    <td colspan="${Math.max(1, Math.floor(colCount / 3))}" class="sign-sub">(Ký, ghi rõ họ tên)</td>
    <td colspan="${Math.max(1, Math.floor(colCount / 3))}" class="sign-sub">(Ký, ghi rõ họ tên)</td>
    <td colspan="${colCount - 2 * Math.max(1, Math.floor(colCount / 3))}" class="sign-sub">(Ký, đóng dấu)</td>
  </tr>
  <tr><td colspan="${colCount}" style="height: 48px;"></td></tr>
  `
          : ''
  }
</table>
</body>
</html>
`

    const BOM = '\uFEFF'
    const blob = new Blob([BOM + xmlTemplate.trim()], {
        type: 'application/vnd.ms-excel;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    let cleanFilename = filename
    if (cleanFilename.toLowerCase().endsWith('.csv')) {
        cleanFilename = cleanFilename.slice(0, -4)
    }
    if (!cleanFilename.toLowerCase().endsWith('.xls')) {
        cleanFilename = `${cleanFilename}.xls`
    }

    link.download = cleanFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return true
}

export function exportToCsv(filename, headers, rows) {
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
