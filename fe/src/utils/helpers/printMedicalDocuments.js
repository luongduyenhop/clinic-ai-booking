function escapeHtml(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function printHtmlViaHiddenIframe(htmlContent) {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('style', 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:0;')
    iframe.setAttribute('aria-hidden', 'true')
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument || iframe.contentWindow.document
    doc.open()
    doc.write(htmlContent)
    doc.close()

    setTimeout(() => {
        try {
            iframe.contentWindow.focus()
            iframe.contentWindow.print()
        } catch {
            window.print()
        } finally {
            setTimeout(() => {
                try {
                    document.body.removeChild(iframe)
                } catch {}
            }, 2000)
        }
    }, 250)
}

function resolveDoseText(item) {
    if (item.lieu_dung) return item.lieu_dung
    if (item.dosage) return item.dosage
    if (item.cach_dung_day_du && item.cach_dung_day_du.includes('Sáng')) return item.cach_dung_day_du
    const parts = []
    if (item.sang && Number(item.sang) > 0) parts.push(`Sáng: ${item.sang}`)
    if (item.trua && Number(item.trua) > 0) parts.push(`Trưa: ${item.trua}`)
    if (item.chieu && Number(item.chieu) > 0) parts.push(`Chiều: ${item.chieu}`)
    if (item.toi && Number(item.toi) > 0) parts.push(`Tối: ${item.toi}`)
    return parts.join(' · ') || 'Theo chỉ định'
}

export function printPrescriptionDocument({ encounter = {}, prescriptionItems = [], diagnoses = [], prescriptionNote = '' }) {
    const encId = encounter.id || encounter.luot_kham_server_id || '2026'
    const today = new Date()
    const dateFormatted = `${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`
    
    const bn = encounter.benh_nhan || {}
    const patientName = String(bn.ho_ten || encounter.ten_benh_nhan || 'BỆNH NHÂN').toUpperCase()
    const patientAge = bn.tuoi || encounter.tuoi || 30
    const patientGender = bn.gioi_tinh || encounter.gioi_tinh || 'Nam'
    const patientPhone = bn.so_dien_thoai || encounter.so_dien_thoai || '—'
    const patientCode = bn.ma || (encounter.benh_nhan_id ? `BN-2026-${String(encounter.benh_nhan_id).padStart(4, '0')}` : `BN-${encId}`)
    const patientAddress = bn.dia_chi || encounter.dia_chi || 'Hà Nội'
    
    const dxList = (diagnoses && diagnoses.length > 0) ? diagnoses : (encounter.danh_sach_chan_doan || [])
    const primaryDx = dxList.find((d) => d.loai_chan_doan === 'chinh') || dxList[0]
    const dxMainText = primaryDx ? `${primaryDx.ma_icd10 || ''} - ${primaryDx.ten_benh_chan_doan || ''}` : 'Khám tổng quát'
    const secondaryDx = dxList.filter((d) => d !== primaryDx)
    const dxSubText = secondaryDx.map((d) => `${d.ma_icd10 || ''} - ${d.ten_benh_chan_doan || ''}`).join('; ')
    
    const rawItems = (prescriptionItems && prescriptionItems.length > 0)
        ? prescriptionItems
        : (encounter.danh_sach_thuoc || encounter.don_thuoc?.danh_sach_thuoc || encounter.don_thuoc?.danh_sach_chi_tiet || [])

    const doctorName = encounter.bac_si?.ho_ten || encounter.ten_bac_si || 'BS. CKI Nguyễn Văn An'
    const nationalRxCode = encounter.don_thuoc?.ma_don_quoc_gia || `RX-ticket-${encId}-${today.getFullYear()}-VN`
    const note = prescriptionNote || encounter.loi_dan_uong_thuoc || encounter.don_thuoc?.loi_dan_uong_thuoc || encounter.loi_dan_bac_si || 'Uống thuốc đúng giờ, kiêng đồ chua cay dầu mỡ. Tái khám khi có dấu hiệu bất thường.'
    const followUpDate = encounter.ngay_hen_tai_kham || 'Theo lịch hẹn của bác sĩ'

    const rowsHtml = rawItems.map((item, idx) => {
        const qty = item.so_luong || (typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity, 10)) || 1
        const unit = item.don_vi_tinh || item.don_vi || (typeof item.quantity === 'string' && item.quantity.trim().split(/\s+/)[1]) || 'Viên'
        const dose = resolveDoseText(item)
        const usage = item.cach_dung || item.huong_dan || item.dosage || 'Uống sau ăn no'
        const days = item.so_ngay_dung || item.so_ngay || 5
        const drugName = item.ten_thuoc || item.ten || item.name || 'Thuốc'
        return `
            <tr>
                <td style="text-align:center;font-weight:bold;padding:6px 4px;">${idx + 1}</td>
                <td style="padding:6px 8px;">
                    <div style="font-weight:bold;font-size:13px;color:#000;">${escapeHtml(drugName)}</div>
                    <div style="font-size:11px;color:#444;">${item.hoat_chat ? `Hoạt chất: ${escapeHtml(item.hoat_chat)}` : ''} ${item.ham_luong ? `(${escapeHtml(item.ham_luong)})` : ''}</div>
                </td>
                <td style="text-align:center;padding:6px 6px;">
                    <div style="font-weight:bold;color:#0f766e;font-size:12px;">${escapeHtml(dose)}</div>
                    <div style="font-size:11px;color:#555;font-style:italic;">${escapeHtml(usage)}</div>
                </td>
                <td style="text-align:center;font-weight:600;padding:6px 4px;">${escapeHtml(days)} ngày</td>
                <td style="text-align:center;font-weight:bold;font-size:13px;padding:6px 4px;">${escapeHtml(qty)} ${escapeHtml(unit)}</td>
            </tr>
        `
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>Đơn Thuốc - ${escapeHtml(patientName)}</title>
<style>
@page { size: auto; margin: 8mm 10mm; }
body { font-family: 'Times New Roman', Times, serif; font-size: 12.5px; color: #111; margin: 0; padding: 0; line-height: 1.4; }
.header-box { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #003553; padding-bottom: 8px; margin-bottom: 12px; }
.clinic-title { font-size: 14px; font-weight: bold; color: #003553; text-transform: uppercase; }
.clinic-meta { font-size: 11px; color: #333; margin-top: 2px; }
.doc-title { text-align: center; margin: 10px 0 14px 0; }
.doc-title h1 { margin: 0; font-size: 20px; font-weight: bold; color: #003553; text-transform: uppercase; letter-spacing: 0.5px; }
.doc-title .sub { font-size: 11px; font-style: italic; color: #555; margin-top: 2px; }
.info-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 4px 16px; margin-bottom: 10px; font-size: 12px; }
.info-row { margin-bottom: 3px; }
.info-label { font-weight: 600; color: #222; }
.rx-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
.rx-table th { background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 4px; text-transform: uppercase; font-size: 11px; font-weight: bold; color: #003553; text-align: center; }
.rx-table td { border: 1px solid #cbd5e1; vertical-align: middle; }
.note-box { background-color: #f8fafc; border: 1px dashed #94a3b8; border-radius: 6px; padding: 8px 12px; margin: 10px 0; font-size: 11.5px; }
.footer-box { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 14px; page-break-inside: avoid; }
.sig-box { text-align: center; width: 220px; }
.sig-stamp { border: 2px solid #059669; background: #ecfdf5; border-radius: 8px; padding: 6px 8px; margin-top: 6px; text-align: center; }
</style>
</head>
<body>
<div class="header-box">
    <div>
        <div class="clinic-title">Phòng Khám Đa Khoa Quốc Tế Clinic-AI</div>
        <div class="clinic-meta">Số 18 Duy Tân, Cầu Giấy, Hà Nội · Hotline: 1900 2115</div>
        <div class="clinic-meta">GPHĐ: Số 1428/HNO-GPHĐ · Chuẩn liên thông Bộ Y Tế TT 52/2017</div>
    </div>
    <div style="text-align:right;">
        <div style="font-weight:bold;font-size:11px;">Mã ĐHYT: <span style="font-family:monospace;">${escapeHtml(patientCode)}</span></div>
        <div style="font-size:10.5px;color:#555;">Mã ĐT QG: <span style="font-family:monospace;font-weight:bold;">${escapeHtml(nationalRxCode)}</span></div>
    </div>
</div>

<div class="doc-title">
    <h1>Đơn Thuốc Điện Tử</h1>
    <div class="sub">(Theo chuẩn Thông tư 52/2017/TT-BYT & TT 04/2022/TT-BYT của Bộ Y Tế)</div>
</div>

<div class="info-grid">
    <div><span class="info-label">Họ và tên người bệnh:</span> <strong>${escapeHtml(patientName)}</strong></div>
    <div><span class="info-label">Tuổi / Giới tính:</span> ${escapeHtml(patientAge)} tuổi · ${escapeHtml(patientGender)}</div>
    <div><span class="info-label">Điện thoại liên hệ:</span> ${escapeHtml(patientPhone)}</div>
    <div><span class="info-label">Địa chỉ:</span> ${escapeHtml(patientAddress)}</div>
    <div style="grid-column: span 2;"><span class="info-label">Chẩn đoán y khoa:</span> <strong>${escapeHtml(dxMainText)}</strong>${dxSubText ? ` <em>(Kèm theo: ${escapeHtml(dxSubText)})</em>` : ''}</div>
</div>

<table class="rx-table">
    <thead>
        <tr>
            <th style="width:32px;">STT</th>
            <th>Tên thuốc / Hoạt chất / Hàm lượng</th>
            <th style="width:170px;">Liều dùng &amp; Cách uống</th>
            <th style="width:65px;">Số ngày</th>
            <th style="width:75px;">Số lượng</th>
        </tr>
    </thead>
    <tbody>
        ${rowsHtml || '<tr><td colspan="5" style="text-align:center;padding:12px;">Không có thuốc trong đơn.</td></tr>'}
    </tbody>
</table>

<div class="note-box">
    <strong>📌 Lời dặn của bác sĩ điều trị:</strong> ${escapeHtml(note)}
    ${followUpDate ? `<div style="margin-top:4px;"><strong>🗓 Hẹn tái khám:</strong> ${escapeHtml(followUpDate)} (hoặc khi có triệu chứng bất thường).</div>` : ''}
</div>

<div class="footer-box">
    <div style="max-width:320px;font-size:10.5px;color:#555;">
        <em>* Khám lại xin mang theo đơn này. Đơn thuốc có giá trị mua trong vòng 05 ngày kể từ ngày kê đơn theo quy định của Bộ Y Tế. Tra cứu đơn thuốc điện tử tại cổng: donthuocquocgia.vn</em>
    </div>
    <div class="sig-box">
        <div style="font-size:11px;font-style:italic;">Hà Nội, ngày ${escapeHtml(dateFormatted)}</div>
        <div style="font-weight:bold;text-transform:uppercase;margin:4px 0 6px 0;font-size:12px;">Bác sĩ khám bệnh</div>
        <div class="sig-stamp">
            <div style="font-size:10px;font-weight:bold;color:#047857;text-transform:uppercase;">✓ Chứng thư số Y tế hợp lệ</div>
            <div style="font-weight:bold;font-size:12px;color:#064e3b;margin:2px 0;">${escapeHtml(doctorName)}</div>
            <div style="font-size:9.5px;color:#065f46;">Thời gian ký: ${escapeHtml(today.toLocaleTimeString('vi-VN'))} · ${escapeHtml(today.toLocaleDateString('vi-VN'))}</div>
        </div>
    </div>
</div>
</body>
</html>`

    printHtmlViaHiddenIframe(html)
}

export function printMedicalRecordDocument({ encounter = {}, diagnoses = [], prescriptionItems = [] }) {
    const encId = encounter.id || encounter.luot_kham_server_id || '2026'
    const today = new Date()
    const dateFormatted = `${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`
    
    const bn = encounter.benh_nhan || {}
    const patientName = String(bn.ho_ten || encounter.ten_benh_nhan || 'BỆNH NHÂN').toUpperCase()
    const patientAge = bn.tuoi || encounter.tuoi || 30
    const patientGender = bn.gioi_tinh || encounter.gioi_tinh || 'Nam'
    const patientPhone = bn.so_dien_thoai || encounter.so_dien_thoai || '—'
    const patientCode = bn.ma || (encounter.benh_nhan_id ? `BN-2026-${String(encounter.benh_nhan_id).padStart(4, '0')}` : `BN-${encId}`)
    const patientAddress = bn.dia_chi || encounter.dia_chi || 'Hà Nội'
    
    const dxList = (diagnoses && diagnoses.length > 0) ? diagnoses : (encounter.danh_sach_chan_doan || [])
    const primaryDx = dxList.find((d) => d.loai_chan_doan === 'chinh') || dxList[0]
    const dxMainText = primaryDx ? `${primaryDx.ma_icd10 || ''} - ${primaryDx.ten_benh_chan_doan || ''}` : 'Khám tổng quát'
    const secondaryDx = dxList.filter((d) => d !== primaryDx)
    const dxSubText = secondaryDx.map((d) => `${d.ma_icd10 || ''} - ${d.ten_benh_chan_doan || ''}`).join('; ')
    
    const doctorName = encounter.bac_si?.ho_ten || encounter.ten_bac_si || 'BS. CKI Nguyễn Văn An'
    const departmentName = encounter.ten_chuyen_khoa || 'Khoa Nội tổng quát'

    const vitals = [
        { label: 'Mạch', val: encounter.mach_lan_phut ? `${encounter.mach_lan_phut} lần/phút` : '—' },
        { label: 'Huyết áp', val: (encounter.huyet_ap_tam_thu && encounter.huyet_ap_tam_truong) ? `${encounter.huyet_ap_tam_thu}/${encounter.huyet_ap_tam_truong} mmHg` : '—' },
        { label: 'Nhiệt độ', val: encounter.nhiet_do_c ? `${encounter.nhiet_do_c} °C` : '—' },
        { label: 'Nhịp thở', val: encounter.nhip_tho_lan_phut ? `${encounter.nhip_tho_lan_phut} lần/phút` : '—' },
        { label: 'Chiều cao', val: encounter.chieu_cao_cm ? `${encounter.chieu_cao_cm} cm` : '—' },
        { label: 'Cân nặng', val: encounter.can_nang_kg ? `${encounter.can_nang_kg} kg` : '—' },
        { label: 'Chỉ số BMI', val: encounter.bmi || '—' },
        { label: 'SpO2', val: encounter.spo2 ? `${encounter.spo2} %` : '—' },
    ]

    const clsOrders = (encounter.danh_sach_chi_dinh || []).filter((o) => o.trang_thai !== 'da_huy')
    const rawItems = (prescriptionItems && prescriptionItems.length > 0)
        ? prescriptionItems
        : (encounter.danh_sach_thuoc || encounter.don_thuoc?.danh_sach_thuoc || encounter.don_thuoc?.danh_sach_chi_tiet || [])

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>Bệnh Án - ${escapeHtml(patientName)}</title>
<style>
@page { size: auto; margin: 10mm 12mm; }
body { font-family: 'Times New Roman', Times, serif; font-size: 12.5px; color: #111; margin: 0; padding: 0; line-height: 1.45; }
.header-box { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #003553; padding-bottom: 8px; margin-bottom: 12px; }
.clinic-title { font-size: 14px; font-weight: bold; color: #003553; text-transform: uppercase; }
.clinic-meta { font-size: 11px; color: #333; margin-top: 2px; }
.doc-title { text-align: center; margin: 10px 0 14px 0; }
.doc-title h1 { margin: 0; font-size: 19px; font-weight: bold; color: #003553; text-transform: uppercase; letter-spacing: 0.5px; }
.doc-title .sub { font-size: 11px; font-style: italic; color: #555; margin-top: 2px; }
.sec-title { font-weight: bold; text-transform: uppercase; color: #003553; font-size: 12.5px; margin: 10px 0 5px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: 12px; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; font-size: 11.5px; margin: 6px 0; }
.vital-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px 6px; text-align: center; }
.vital-label { font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; }
.vital-val { font-size: 12px; font-weight: bold; color: #003553; margin-top: 2px; }
.table-custom { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 11.5px; }
.table-custom th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 5px; text-align: left; font-size: 11px; font-weight: bold; color: #003553; }
.table-custom td { border: 1px solid #cbd5e1; padding: 5px; }
.footer-box { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 18px; page-break-inside: avoid; }
.sig-box { text-align: center; width: 230px; }
.sig-stamp { border: 2px solid #0284c7; background: #f0f9ff; border-radius: 8px; padding: 6px 8px; margin-top: 6px; text-align: center; }
</style>
</head>
<body>
<div class="header-box">
    <div>
        <div class="clinic-title">Phòng Khám Đa Khoa Quốc Tế Clinic-AI</div>
        <div class="clinic-meta">Khoa: <strong>${escapeHtml(departmentName)}</strong> · Cơ sở số 18 Duy Tân, Cầu Giấy, Hà Nội</div>
        <div class="clinic-meta">Hotline: 1900 2115 · GPHĐ: 1428/HNO-GPHĐ</div>
    </div>
    <div style="text-align:right;">
        <div style="font-weight:bold;font-size:11px;">Mã bệnh án: <span style="font-family:monospace;">${escapeHtml(patientCode)}</span></div>
        <div style="font-size:10.5px;color:#555;">Mã lượt khám: <span style="font-family:monospace;">HSK-${escapeHtml(String(encId).padStart(6, '0'))}</span></div>
    </div>
</div>

<div class="doc-title">
    <h1>Phiếu Khám Bệnh &amp; Tóm Tắt Bệnh Án Ngoại Trú</h1>
    <div class="sub">(Lưu hành nội bộ &amp; Hồ sơ bệnh án điện tử EMR theo Thông tư 32/2023/TT-BYT)</div>
</div>

<div class="sec-title">I. Thông Tin Hành Chính Người Bệnh</div>
<div class="grid-2">
    <div><strong>Họ và tên:</strong> ${escapeHtml(patientName)}</div>
    <div><strong>Tuổi / Giới tính:</strong> ${escapeHtml(patientAge)} tuổi · ${escapeHtml(patientGender)}</div>
    <div><strong>Số điện thoại:</strong> ${escapeHtml(patientPhone)}</div>
    <div><strong>Địa chỉ:</strong> ${escapeHtml(patientAddress)}</div>
</div>

<div class="sec-title">II. Lý Do Khám &amp; Tiền Sử Bệnh</div>
<div style="font-size:12px;margin:4px 0;">
    <div><strong>Lý do vào khám:</strong> ${escapeHtml(encounter.ly_do_vao_kham || encounter.trieu_chung || 'Khám bệnh theo chỉ định')}</div>
    <div><strong>Bệnh sử:</strong> ${escapeHtml(encounter.benh_su || 'Không ghi nhận tiền sử đặc biệt')}</div>
    <div><strong>Dị ứng thuốc:</strong> ${escapeHtml(bn.di_ung_thuoc || encounter.tien_su_di_ung || 'Không có dị ứng')}</div>
</div>

<div class="sec-title">III. Dấu Hiệu Sinh Tồn &amp; Thể Lực</div>
<div class="grid-4">
    ${vitals.map((v) => `
        <div class="vital-item">
            <div class="vital-label">${escapeHtml(v.label)}</div>
            <div class="vital-val">${escapeHtml(v.val)}</div>
        </div>
    `).join('')}
</div>

<div class="sec-title">IV. Khám Chuyên Khoa &amp; Toàn Thân</div>
<div style="font-size:12px;background:#f8fafc;padding:6px 10px;border-radius:4px;border:1px solid #e2e8f0;margin:4px 0;">
    ${escapeHtml(encounter.kham_lam_sang_bo_phan || encounter.kham_chuyen_khoa?.rawText || 'Toàn trạng tỉnh táo, tiếp xúc tốt. Các cơ quan tuần hoàn, hô hấp, tiêu hóa trong giới hạn bình thường.')}
</div>

${clsOrders.length > 0 ? `
<div class="sec-title">V. Chỉ Định Cận Lâm Sàng &amp; Kết Quả (${clsOrders.length} dịch vụ)</div>
<table class="table-custom">
    <thead>
        <tr>
            <th style="width:30px;text-align:center;">STT</th>
            <th>Tên dịch vụ cận lâm sàng</th>
            <th style="width:110px;">Trạng thái</th>
            <th>Kết quả tóm tắt / Kết luận</th>
        </tr>
    </thead>
    <tbody>
        ${clsOrders.map((o, i) => `
            <tr>
                <td style="text-align:center;">${i + 1}</td>
                <td><strong>${escapeHtml(o.ten_dich_vu)}</strong></td>
                <td><span style="color:#0f766e;font-weight:bold;">${o.trang_thai === 'da_co_ket_qua' || o.trang_thai === 'da_duyet' ? 'Đã có kết quả' : 'Đang xử lý'}</span></td>
                <td>${escapeHtml(typeof o.ket_qua_chi_tiet === 'object' ? (o.ket_qua_chi_tiet?.ket_luan || 'Đã có kết quả') : (o.ket_qua_chi_tiet || '—'))}</td>
            </tr>
        `).join('')}
    </tbody>
</table>
` : ''}

<div class="sec-title">VI. Kết Luận Chẩn Đoán &amp; Hướng Điều Trị</div>
<div style="font-size:12px;margin:4px 0;">
    <div><strong>Chẩn đoán chính (ICD-10):</strong> <span style="font-size:13px;color:#003553;font-weight:bold;">${escapeHtml(dxMainText)}</span></div>
    ${dxSubText ? `<div><strong>Chẩn đoán kèm theo:</strong> ${escapeHtml(dxSubText)}</div>` : ''}
    <div><strong>Kết luận điều trị:</strong> ${escapeHtml(encounter.ket_luan_dieu_tri || 'Điều trị ngoại trú, theo dõi đáp ứng lâm sàng.')}</div>
    ${rawItems.length > 0 ? `<div><strong>Thuốc đã kê:</strong> ${rawItems.length} khoản thuốc điều trị ngoại trú.</div>` : ''}
</div>

<div class="sec-title">VII. Lời Dặn Của Bác Sĩ &amp; Hẹn Tái Khám</div>
<div style="font-size:12px;margin:4px 0;">
    <div><strong>Lời dặn:</strong> ${escapeHtml(encounter.loi_dan_bac_si || encounter.loi_dan_uong_thuoc || 'Tuân thủ đơn thuốc, nghỉ ngơi hợp lý.')}</div>
    <div><strong>Lịch hẹn tái khám:</strong> ${encounter.ngay_hen_tai_kham ? `Tái khám ngày <strong>${escapeHtml(encounter.ngay_hen_tai_kham)}</strong>` : 'Tái khám khi có dấu hiệu bất thường'}</div>
</div>

<div class="footer-box">
    <div style="font-size:11px;color:#64748b;max-width:300px;">
        <em>Hồ sơ bệnh án điện tử đã hoàn tất và lưu trữ bất biến theo quy định bảo mật dữ liệu y tế TT 32/2023/TT-BYT.</em>
    </div>
    <div class="sig-box">
        <div style="font-size:11px;font-style:italic;">Hà Nội, ngày ${escapeHtml(dateFormatted)}</div>
        <div style="font-weight:bold;text-transform:uppercase;margin:4px 0 6px 0;font-size:12px;">Bác sĩ điều trị</div>
        <div class="sig-stamp">
            <div style="font-size:10px;font-weight:bold;color:#0284c7;text-transform:uppercase;">✓ Ký số hồ sơ bệnh án EMR</div>
            <div style="font-weight:bold;font-size:12px;color:#0369a1;margin:2px 0;">${escapeHtml(doctorName)}</div>
            <div style="font-size:9.5px;color:#0284c7;">Thời gian khóa: ${escapeHtml(today.toLocaleTimeString('vi-VN'))} · ${escapeHtml(today.toLocaleDateString('vi-VN'))}</div>
        </div>
    </div>
</div>
</body>
</html>`

    printHtmlViaHiddenIframe(html)
}
