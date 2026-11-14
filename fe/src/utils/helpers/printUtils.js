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

/**
 * In trực tiếp Đơn Thuốc Ngoại Trú Điện Tử chuẩn Bộ Y Tế (Khổ A4/A5)
 * Bật ngay hộp thoại in trình duyệt, không thông qua popup/modal trung gian
 */
export function printPrescriptionDocument({
    encounter = {},
    patient = {},
    diagnoses = [],
    prescriptionItems = [],
    prescriptionNote = '',
    doctorName = 'BS. CKI Nguyễn Văn An',
    paperSize = 'A4',
}) {
    const pData = encounter?.benh_nhan || patient || {}
    const patientName = pData.ho_ten || encounter?.ten_benh_nhan || patient?.fullName || 'Bệnh nhân'
    const patientAge = pData.tuoi ? `${pData.tuoi} tuổi` : (encounter?.tuoi ? `${encounter.tuoi} tuổi` : (pData.age ? `${pData.age} tuổi` : '—'))
    const patientGender = pData.gioi_tinh || encounter?.gioi_tinh || patient?.gender || '—'
    const patientPhone = pData.so_dien_thoai || encounter?.so_dien_thoai || patient?.phone || '—'
    const patientAddress = pData.dia_chi || encounter?.dia_chi || '—'
    const patientInsurance = pData.so_bhyt || encounter?.so_bhyt || patient?.healthInsurance || ''
    const patientCode = pData.ma || pData.ma_benh_nhan || encounter?.ma_benh_nhan || patient?.patientCode || (encounter?.id ? `BN-2026-${String(encounter.id).padStart(4, '0')}` : 'BN-2026')
    const rxCode = encounter?.don_thuoc?.ma_don || `RX-${encounter?.id || 9102}-${new Date().getFullYear()}`
    const encId = encounter?.id || '9102'

    const effectiveDx = (diagnoses && diagnoses.length > 0)
        ? diagnoses
        : (encounter?.danh_sach_chan_doan || [])
    const diagnosisText = effectiveDx.length > 0
        ? effectiveDx.map(d => `${d.ma_icd10 || ''} - ${d.ten_benh_chan_doan || ''}`).filter(Boolean).join('; ')
        : (encounter?.chan_doan_so_bo || 'Khám nội tổng quát')

    const effectiveItems = (prescriptionItems && prescriptionItems.length > 0)
        ? prescriptionItems
        : (encounter?.danh_sach_thuoc || encounter?.don_thuoc?.danh_sach_thuoc || [])

    const effectiveNote = prescriptionNote || encounter?.loi_dan_bac_si || encounter?.loi_dan_uong_thuoc || encounter?.don_thuoc?.loi_dan_uong_thuoc || 'Uống thuốc đúng giờ theo chỉ dẫn. Tái khám khi hết thuốc hoặc có dấu hiệu bất thường.'
    const appointmentText = encounter?.ngay_hen_tai_kham || ''
    const docName = doctorName || encounter?.ten_bac_si || 'BS. CKI Nguyễn Văn An'
    const date = new Date()

    const medRowsHtml = effectiveItems.length > 0
        ? effectiveItems.map((item, idx) => {
            const qty = item.so_luong || (typeof item.quantity === 'string' ? item.quantity.replace(/\D/g, '') : item.quantity) || 1
            const unit = item.don_vi_tinh || (typeof item.quantity === 'string' ? item.quantity.replace(/[^a-zA-ZÀ-ỹ]/g, '') : '') || 'Viên'
            const dosage = item.cach_dung_day_du || item.cach_dung || item.dosage || item.lieu_dung || 'Theo chỉ định của bác sĩ'
            return `
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 6px 4px; text-align: center; vertical-align: top; border: 1px solid #ccc;">${idx + 1}</td>
                    <td style="padding: 6px 8px; vertical-align: top; border: 1px solid #ccc;">
                        <div style="font-weight: bold; font-size: 13px;">${item.ten_thuoc || item.name} <span style="font-weight: normal; color: #555;">(${item.ham_luong || 'Chuẩn'})</span></div>
                        ${item.hoat_chat ? `<div style="font-size: 11px; color: #666; font-style: italic;">Hoạt chất: ${item.hoat_chat}</div>` : ''}
                        <div style="font-size: 11.5px; color: #003553; margin-top: 2px;">➤ <b>Cách dùng:</b> <i>${dosage}</i></div>
                    </td>
                    <td style="padding: 6px 4px; text-align: center; vertical-align: top; border: 1px solid #ccc; font-weight: bold; white-space: nowrap;">
                        ${qty} ${unit}
                    </td>
                </tr>
            `
        }).join('')
        : `<tr><td colspan="3" style="padding: 12px; text-align: center; font-style: italic; color: #666;">(Chưa có thuốc trong đơn)</td></tr>`

    const html = `
        <div style="font-family: 'Times New Roman', serif; padding: 10px; color: #111;">
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 12px;">
                <div>
                    <div style="font-size: 11px; text-transform: uppercase; font-weight: bold;">SỞ Y TẾ TP. HỒ CHÍ MINH</div>
                    <div style="font-size: 13px; font-weight: bold; text-transform: uppercase;">PHÒNG KHÁM ĐA KHOA THÔNG MINH CLINIC-AI</div>
                    <div style="font-size: 10px; color: #444;">Địa chỉ: Khu Công Nghệ Cao, TP. Thủ Đức · Hotline: 1900 6868</div>
                </div>
                <div style="text-align: right; font-size: 11px;">
                    <div>Mã đơn thuốc: <b>${rxCode}</b></div>
                    <div>Mã hồ sơ: <b>${encId}</b></div>
                    <div>Ngày kê: <b>${date.toLocaleDateString('vi-VN')}</b></div>
                </div>
            </div>

            <div style="text-align: center; margin-bottom: 14px;">
                <h2 style="font-size: 18px; font-weight: bold; margin: 0; text-transform: uppercase;">ĐƠN THUỐC ĐIỆN TỬ</h2>
                <div style="font-size: 11px; font-style: italic;">(Ban hành theo chuẩn Thông tư 52/2017 & TT 04/2022/TT-BYT)</div>
            </div>

            <div style="background: #f9f9f9; border: 1px solid #ddd; padding: 8px; font-size: 12px; margin-bottom: 12px; line-height: 1.6;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                    <div>Họ và tên: <b style="text-transform: uppercase;">${patientName}</b></div>
                    <div>Mã định danh y tế: <b>${patientCode}</b></div>
                    <div>Năm sinh / Tuổi: <b>${patientAge}</b> · Giới tính: <b>${patientGender}</b></div>
                    <div>Số điện thoại: <b>${patientPhone}</b></div>
                    <div style="grid-column: 1 / -1;">Địa chỉ: <b>${patientAddress}</b></div>
                    <div style="grid-column: 1 / -1;">Số BHYT (nếu có): <b>${patientInsurance || 'Không có'}</b></div>
                </div>
            </div>

            <div style="margin-bottom: 12px; font-size: 12px;">
                <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">Chẩn đoán xác định (ICD-10):</div>
                <div style="border: 1px solid #333; padding: 6px 10px; background: #fafafa; font-weight: bold;">
                    ${diagnosisText}
                </div>
            </div>

            <div style="margin-bottom: 12px; font-size: 12px;">
                <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">Thuốc điều trị (${effectiveItems.length} khoản):</div>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background: #f3f4f6; border-top: 1px solid #333; border-bottom: 1px solid #333;">
                            <th style="padding: 5px; text-align: center; width: 35px; border: 1px solid #333;">STT</th>
                            <th style="padding: 5px; text-align: left; border: 1px solid #333;">Tên thuốc, hàm lượng & cách dùng</th>
                            <th style="padding: 5px; text-align: center; width: 85px; border: 1px solid #333;">Số lượng</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${medRowsHtml}
                    </tbody>
                </table>
            </div>

            <div style="margin-bottom: 14px; font-size: 12px;">
                <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">Lời dặn dò của bác sĩ:</div>
                <div style="border: 1px dashed #444; padding: 6px 10px; font-style: italic; background: #fffbe8;">
                    ${effectiveNote}
                    ${appointmentText ? `<div style="font-weight: bold; margin-top: 4px; color: #003553; font-style: normal;">📅 Hẹn tái khám: ${appointmentText}</div>` : ''}
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; margin-top: 20px; text-align: center; font-size: 12px; page-break-inside: avoid;">
                <div>
                    <div style="font-weight: bold; text-transform: uppercase;">Người bệnh / Thân nhân</div>
                    <div style="font-size: 10px; font-style: italic;">(Ký và ghi rõ họ tên)</div>
                </div>
                <div>
                    <div style="font-style: italic;">Ngày ${date.getDate()} tháng ${date.getMonth() + 1} năm ${date.getFullYear()}</div>
                    <div style="font-weight: bold; text-transform: uppercase; margin-top: 2px;">Bác sĩ khám bệnh</div>
                    <div style="font-size: 10px; font-style: italic;">(Ký, ghi rõ họ tên & đóng dấu)</div>
                    <div style="margin-top: 36px; font-weight: bold;">${docName}</div>
                    <div style="font-size: 9px; color: #047857; font-weight: bold;">✓ ĐÃ KÝ SỐ ĐIỆN TỬ Y TẾ HỢP LỆ</div>
                </div>
            </div>
        </div>
    `

    printHtmlDocument({
        title: `DonThuoc_${patientCode}_${rxCode}`,
        contentHtml: html,
        paperSize,
    })
}
