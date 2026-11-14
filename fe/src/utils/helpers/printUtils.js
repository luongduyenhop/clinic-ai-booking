/**
 * Utility in ấn cô lập qua hidden iframe (Isolated Print Utility)
 * Đảm bảo:
 * - Không bị in lẫn giao diện web, modal, backdrop hay thanh cuộn.
 * - Hỗ trợ chuẩn xác các khổ giấy: A4, A5 (Laser/In phun) và K80 (In nhiệt 80mm).
 * - Tự động chờ ảnh, barcode, QR code tải xong rồi mới kích hoạt hộp thoại in.
 * - Tự động dọn dẹp iframe sau khi in xong.
 */

export function printHtmlDocument({
    title = 'In tài liệu y tế',
    contentHtml = '',
    customStyles = '',
    paperSize = 'A4', // 'A4' | 'A5' | 'K80'
}) {
    if (typeof window === 'undefined' || !document) return

    // Tạo iframe ẩn
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    document.body.appendChild(iframe)

    const normalizedSize = String(paperSize).toUpperCase()

    let pageRule = '@page { size: A4; margin: 10mm 12mm; }'
    let baseFontSize = '12.5px'
    let containerWidth = '100%'

    if (normalizedSize === 'A5') {
        pageRule = '@page { size: A5; margin: 8mm 9mm; }'
        baseFontSize = '11px'
    } else if (normalizedSize === 'K80' || normalizedSize === 'BILL') {
        pageRule = '@page { size: 80mm auto; margin: 3mm 4mm; }'
        baseFontSize = '11px'
        containerWidth = '74mm'
    }

    const defaultCss = `
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        ${pageRule}
        html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111827;
            font-family: 'Times New Roman', Times, serif;
            font-size: ${baseFontSize};
            line-height: 1.4;
        }
        .print-container {
            width: ${containerWidth};
            margin: 0 auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            vertical-align: top;
        }
        .no-break {
            page-break-inside: avoid;
            break-inside: avoid;
        }
    `

    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) {
        iframe.remove()
        return
    }

    doc.open()
    doc.write(`
        <!doctype html>
        <html lang="vi">
        <head>
            <meta charset="utf-8" />
            <title>${title}</title>
            <style>
                ${defaultCss}
                ${customStyles}
            </style>
        </head>
        <body>
            <div class="print-container">
                ${contentHtml}
            </div>
        </body>
        </html>
    `)
    doc.close()

    const cleanup = () => {
        setTimeout(() => {
            if (iframe && iframe.parentNode) {
                iframe.parentNode.removeChild(iframe)
            }
        }, 500)
    }

    iframe.contentWindow?.addEventListener('afterprint', cleanup)

    // Đợi tải toàn bộ ảnh (QR code, barcode, logo...)
    const pendingImages = Array.from(doc.images || []).filter((img) => !img.complete)
    const imageLoadPromises = pendingImages.map(
        (img) =>
            new Promise((resolve) => {
                img.onload = resolve
                img.onerror = resolve
            })
    )

    Promise.all(imageLoadPromises).then(() => {
        setTimeout(() => {
            try {
                iframe.contentWindow?.focus()
                iframe.contentWindow?.print()
            } catch (err) {
                console.error('Lỗi khi kích hoạt in:', err)
                cleanup()
            }
        }, 150)
    })
}
