/**
 * Tiện ích nghiệp vụ: Xuất file CSV (hỗ trợ Tiếng Việt có dấu UTF-8 BOM) và Kích hoạt Hộp thoại In ấn
 */

export function exportToCsv(filename, headers, rows) {
    if (!rows || rows.length === 0) {
        return false
    }

    // Ký tự BOM để Excel nhận diện chuẩn tiếng Việt UTF-8 không bị lỗi font
    const BOM = '\uFEFF'

    const escapeField = (field) => {
        if (field === null || field === undefined) return '""'
        const str = String(field)
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`
        }
        return `"${str}"`
    }

    const headerLine = headers.map(escapeField).join(',')
    const dataLines = rows.map((row) => row.map(escapeField).join(','))
    const csvContent = [headerLine, ...dataLines].join('\r\n')

    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return true
}

export function printDocument() {
    window.print()
}
