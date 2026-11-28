import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
    Printer,
    Copy,
    X,
    Pill,
    QrCode,
    Barcode,
    CheckCircle,
    ClockCounterClockwise,
    Stethoscope,
    ChatText,
    BookmarkSimple,
    WarningCircle,
    CurrencyCircleDollar,
    FileText,
} from '@phosphor-icons/react'
import { AppToast } from '../common/AppNotification'
import { SAMPLE_PRESCRIPTION_TEMPLATES } from '../../utils/constants/clinicalTemplates'
import { clinicalService } from '../../services/doctor/ClinicalService'

const PAPER_CONFIGS = {
    a4: {
        key: 'a4',
        name: 'Khổ A4 (Laser)',
        label: 'Khổ A4 (210 × 297 mm)',
        previewWidth: '210mm',
        minHeight: '297mm',
        pageSize: 'A4 portrait',
        pageMargin: '12mm 14mm',
        sheetClass: 'sheet-a4',
    },
    a5: {
        key: 'a5',
        name: 'Khổ A5 (Laser)',
        label: 'Khổ A5 (148 × 210 mm)',
        previewWidth: '148mm',
        minHeight: '210mm',
        pageSize: 'A5 portrait',
        pageMargin: '8mm 10mm',
        sheetClass: 'sheet-a5',
    },
    k80: {
        key: 'k80',
        name: 'In nhiệt K80',
        label: 'Khổ K80 (80 mm)',
        previewWidth: '80mm',
        minHeight: '160mm',
        pageSize: '80mm auto',
        pageMargin: '4mm',
        sheetClass: 'sheet-k80',
    },
}

const PRINT_BASE_CSS = `
.sheet-container {
    box-sizing: border-box;
    background: #ffffff;
    color: #111827;
    font-family: 'Times New Roman', Times, serif;
    line-height: 1.35;
    margin: 0 auto;
}
.sheet-a4 {
    font-size: 13px;
    padding: 14mm 16mm;
}
.sheet-a5 {
    font-size: 11px;
    padding: 8mm 10mm;
}
.sheet-k80 {
    font-size: 10px;
    padding: 4mm 5mm;
}
.sheet-hdr {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 8px;
    margin-bottom: 12px;
}
.sheet-title {
    text-align: center;
    margin: 10px 0 14px;
}
.sheet-title h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.sheet-a5 .sheet-title h2 {
    font-size: 15px;
}
.sheet-title p {
    margin: 3px 0 0;
    font-size: 0.85em;
    color: #475569;
}
.sheet-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 14px;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 12px;
    font-size: 0.92em;
}
.sheet-info-full {
    grid-column: 1 / -1;
    border-top: 1px solid #e2e8f0;
    padding-top: 4px;
    margin-top: 2px;
}
.sheet-table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 12px;
}
.sheet-table th, .sheet-table td {
    border: 1px solid #475569;
    padding: 6px 8px;
    text-align: left;
    vertical-align: middle;
}
.sheet-a5 .sheet-table th, .sheet-a5 .sheet-table td {
    padding: 4px 5px;
}
.sheet-table th {
    background: #f1f5f9;
    font-weight: 700;
    text-align: center;
}
.sheet-remarks-grid {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 16px;
    padding-top: 10px;
    border-top: 1px solid #cbd5e1;
    margin-top: 8px;
    page-break-inside: avoid;
    break-inside: avoid;
}
.sheet-signature-box {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
}
.sheet-cert-badge {
    margin-top: 8px;
    border: 1.5px dashed #059669;
    background: #ecfdf5;
    color: #065f46;
    border-radius: 6px;
    padding: 4px 8px;
    text-align: left;
    font-size: 0.82em;
    display: flex;
    align-items: center;
    gap: 6px;
}
.sheet-footer-notice {
    margin-top: 14px;
    border-top: 1px dashed #94a3b8;
    padding-top: 6px;
    font-size: 0.78em;
    color: #64748b;
    font-style: italic;
    display: flex;
    justify-content: space-between;
    page-break-inside: avoid;
    break-inside: avoid;
}
`

export default function PrescriptionPrintAndCopyModal({
    isOpen,
    onClose,
    initialTab = 'print',
    encounter = {},
    patient = {},
    diagnoses = [],
    prescriptionItems = [],
    prescriptionNote = '',
    onApplyOldPrescription,
    onApplySampleTemplate,
}) {
    const [activeTab, setActiveTab] = useState(initialTab)
    const [prevInitialTab, setPrevInitialTab] = useState(initialTab)
    if (initialTab !== prevInitialTab) {
        setPrevInitialTab(initialTab)
        setActiveTab(initialTab)
    }
    const [showPriceOnPrint, setShowPriceOnPrint] = useState(false)
    const [paperSize, setPaperSize] = useState('a4')
    const [oldPrescriptions, setOldPrescriptions] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const sheetRef = useRef(null)

    const [printDate] = useState(() => new Date())
    const currentYear = useMemo(() => printDate.getFullYear(), [printDate])
    const encounterId = encounter?.id || encounter?.luot_kham_server_id || 9102
    const rxCode = useMemo(() => `RX-${encounterId}-${currentYear}`, [encounterId, currentYear])
    const formattedPrintDate = useMemo(() => printDate.toLocaleDateString('vi-VN'), [printDate])
    const printDateDay = useMemo(() => printDate.getDate(), [printDate])
    const printDateMonth = useMemo(() => printDate.getMonth() + 1, [printDate])

    const patientId = patient?.id || encounter?.benh_nhan?.id || encounter?.patient_id || encounter?.benh_nhan_id
    const patientName = patient?.ho_ten || encounter?.benh_nhan?.ho_ten || encounter?.ten_benh_nhan || 'Nguyễn Văn Bệnh Nhân'
    const patientDob = patient?.ngay_sinh || encounter?.benh_nhan?.ngay_sinh || encounter?.ngay_sinh || '15/05/1990'
    const patientGender = patient?.gioi_tinh || encounter?.benh_nhan?.gioi_tinh || encounter?.gioi_tinh || 'Nam'
    const patientPhone = patient?.so_dien_thoai || encounter?.benh_nhan?.so_dien_thoai || encounter?.so_dien_thoai || '0901 234 567'
    const patientCode = patient?.ma || encounter?.benh_nhan?.ma || encounter?.ma_benh_nhan || (patientId ? `BN-2026-${String(patientId).padStart(4, '0')}` : `BN-${encounter?.id || '2026'}`)
    const doctorName = encounter?.ten_bac_si || 'BS.CKI Nguyễn Văn An'

    const paperConfig = PAPER_CONFIGS[paperSize] || PAPER_CONFIGS.a4

    const estimatedTotal = useMemo(() => {
        return prescriptionItems.reduce((sum, item) => {
            const qty = Number(item.so_luong) || 1
            const price = Number(item.don_gia) || 15000
            return sum + qty * price
        }, 0)
    }, [prescriptionItems])

    const fetchPrescriptionHistory = useCallback(async () => {
        if (!isOpen) return
        setLoadingHistory(true)
        try {
            const list = []
            if (patientId) {
                try {
                    const res = await clinicalService.get(`/api/v1/clinical/patients/${patientId}/history`, {
                        __skipGlobalLoading: true,
                        __skipGlobalError: true,
                    })
                    const encounters = Array.isArray(res?.data?.data) ? res.data.data : []
                    encounters.forEach((enc) => {
                        const rx = enc.don_thuoc
                        const rawItems = rx?.danh_sach_chi_tiet || rx?.danh_sach_thuoc || []
                        if (rawItems.length > 0 && String(enc.id) !== String(encounterId)) {
                            const mappedItems = rawItems.map((m) => ({
                                ten_thuoc: m.ten_thuoc,
                                hoat_chat: m.hoat_chat || '',
                                ham_luong: m.ham_luong || 'Chuẩn',
                                don_vi_tinh: m.don_vi_tinh || 'Viên',
                                so_luong: Number(m.so_luong) || 1,
                                sang: m.sang ?? m.lieu_sang ?? '',
                                trua: m.trua ?? m.lieu_trua ?? '',
                                chieu: m.chieu ?? m.lieu_chieu ?? '',
                                toi: m.toi ?? m.lieu_toi ?? '',
                                so_ngay_dung: m.so_ngay_dung ?? m.thoi_gian_dung_ngay ?? 5,
                                cach_dung: m.cach_dung || m.ghi_chu || m.lieu_dung || '',
                                lieu_dung: m.lieu_dung || [
                                    m.sang || m.lieu_sang ? `Sáng: ${m.sang || m.lieu_sang}` : '',
                                    m.trua || m.lieu_trua ? `Trưa: ${m.trua || m.lieu_trua}` : '',
                                    m.chieu || m.lieu_chieu ? `Chiều: ${m.chieu || m.lieu_chieu}` : '',
                                    m.toi || m.lieu_toi ? `Tối: ${m.toi || m.lieu_toi}` : '',
                                ].filter(Boolean).join(' · ') || m.cach_dung || 'Theo chỉ dẫn',
                                don_gia: Number(m.don_gia) || 15000,
                                duong_dung: m.duong_dung || 'Uống',
                                ghi_chu: m.ghi_chu || m.cach_dung || '',
                            }))
                            const dxList = enc.danh_sach_chan_doan || []
                            const dxText = dxList.length > 0
                                ? dxList.map((d) => `${d.ma_icd10} - ${d.ten_benh_chan_doan}`).join('; ')
                                : enc.chan_doan_so_bo || 'Chưa ghi nhận'
                            list.push({
                                id: rx.id || enc.id,
                                ngay_ke: rx.ngay_ke_don
                                    ? new Date(rx.ngay_ke_don).toLocaleDateString('vi-VN')
                                    : enc.thoi_gian_bat_dau
                                        ? new Date(enc.thoi_gian_bat_dau).toLocaleDateString('vi-VN')
                                        : formattedPrintDate,
                                bac_si: enc.ten_bac_si || rx.nguoi_ky || 'Bác sĩ điều trị',
                                chan_doan: dxText,
                                ghi_chu: rx.loi_dan_uong_thuoc || enc.loi_dan_bac_si || '',
                                items: mappedItems,
                            })
                        }
                    })
                } catch {
                }
            }

            if (list.length === 0 && Array.isArray(encounter?.lich_su) && encounter.lich_su.length > 0) {
                encounter.lich_su.forEach((item, idx) => {
                    if (item.items && item.items.length > 0) {
                        const mappedItems = item.items.map((m) => ({
                            ten_thuoc: m.ten_thuoc,
                            hoat_chat: m.hoat_chat || '',
                            ham_luong: m.ham_luong || 'Chuẩn',
                            don_vi_tinh: m.don_vi_tinh || 'Viên',
                            so_luong: Number(m.so_luong) || 1,
                            sang: m.sang ?? m.lieu_sang ?? '',
                            trua: m.trua ?? m.lieu_trua ?? '',
                            chieu: m.chieu ?? m.lieu_chieu ?? '',
                            toi: m.toi ?? m.lieu_toi ?? '',
                            so_ngay_dung: m.so_ngay_dung ?? m.thoi_gian_dung_ngay ?? 5,
                            cach_dung: m.cach_dung || m.ghi_chu || m.lieu_dung || '',
                            lieu_dung: m.lieu_dung || [
                                m.sang || m.lieu_sang ? `Sáng: ${m.sang || m.lieu_sang}` : '',
                                m.trua || m.lieu_trua ? `Trưa: ${m.trua || m.lieu_trua}` : '',
                                m.chieu || m.lieu_chieu ? `Chiều: ${m.chieu || m.lieu_chieu}` : '',
                                m.toi || m.lieu_toi ? `Tối: ${m.toi || m.lieu_toi}` : '',
                            ].filter(Boolean).join(' · ') || m.cach_dung || 'Theo chỉ dẫn',
                            don_gia: Number(m.don_gia) || 15000,
                            duong_dung: m.duong_dung || 'Uống',
                            ghi_chu: m.ghi_chu || m.cach_dung || '',
                        }))
                        list.push({
                            id: item.id || `LS-${idx + 1}`,
                            ngay_ke: item.ngay || formattedPrintDate,
                            bac_si: item.bac_si || doctorName,
                            chan_doan: item.chan_doan || 'Chưa ghi nhận',
                            ghi_chu: item.ghi_chu || '',
                            items: mappedItems,
                        })
                    }
                })
            }

            if (list.length === 0) {
                try {
                    const raw = localStorage.getItem('clinic_patient_completed_encounters_v1')
                    if (raw) {
                        const saved = JSON.parse(raw)
                        if (Array.isArray(saved)) {
                            saved.forEach((s) => {
                                const matchPatient = (patientId && s.benh_nhan?.id === patientId) ||
                                    (patientCode && s.benh_nhan?.ma === patientCode) ||
                                    (patientName && s.benh_nhan?.ho_ten === patientName)
                                const sItems = s.don_thuoc?.danh_sach_chi_tiet || s.don_thuoc?.danh_sach_thuoc || s.danh_sach_thuoc || []
                                if (matchPatient && sItems.length > 0 && String(s.id) !== String(encounterId)) {
                                    const mappedItems = sItems.map((m) => ({
                                        ten_thuoc: m.ten_thuoc,
                                        hoat_chat: m.hoat_chat || '',
                                        ham_luong: m.ham_luong || 'Chuẩn',
                                        don_vi_tinh: m.don_vi_tinh || 'Viên',
                                        so_luong: Number(m.so_luong) || 1,
                                        sang: m.sang ?? m.lieu_sang ?? '',
                                        trua: m.trua ?? m.lieu_trua ?? '',
                                        chieu: m.chieu ?? m.lieu_chieu ?? '',
                                        toi: m.toi ?? m.lieu_toi ?? '',
                                        so_ngay_dung: m.so_ngay_dung ?? m.thoi_gian_dung_ngay ?? 5,
                                        cach_dung: m.cach_dung || m.ghi_chu || m.lieu_dung || '',
                                        lieu_dung: m.lieu_dung || [
                                            m.sang || m.lieu_sang ? `Sáng: ${m.sang || m.lieu_sang}` : '',
                                            m.trua || m.lieu_trua ? `Trưa: ${m.trua || m.lieu_trua}` : '',
                                            m.chieu || m.lieu_chieu ? `Chiều: ${m.chieu || m.lieu_chieu}` : '',
                                            m.toi || m.lieu_toi ? `Tối: ${m.toi || m.lieu_toi}` : '',
                                        ].filter(Boolean).join(' · ') || m.cach_dung || 'Theo chỉ dẫn',
                                        don_gia: Number(m.don_gia) || 15000,
                                        duong_dung: m.duong_dung || 'Uống',
                                        ghi_chu: m.ghi_chu || m.cach_dung || '',
                                    }))
                                    list.push({
                                        id: s.don_thuoc?.id || s.id,
                                        ngay_ke: s.ngay_kham || s.thoi_gian_bat_dau?.slice(0, 10) || formattedPrintDate,
                                        bac_si: s.ten_bac_si || doctorName,
                                        chan_doan: (s.danh_sach_chan_doan || []).map((d) => `${d.ma_icd10} - ${d.ten_benh_chan_doan}`).join('; ') || s.chan_doan_so_bo || 'Chưa ghi nhận',
                                        ghi_chu: s.loi_dan_uong_thuoc || s.loi_dan_bac_si || '',
                                        items: mappedItems,
                                    })
                                }
                            })
                        }
                    }
                } catch {
                }
            }

            setOldPrescriptions(list)
        } finally {
            setLoadingHistory(false)
        }
    }, [isOpen, patientId, encounterId, encounter?.lich_su, formattedPrintDate, doctorName, patientCode, patientName])

    useEffect(() => {
        if (!isOpen) return
        let cancelled = false
        const timer = setTimeout(() => {
            if (!cancelled) {
                fetchPrescriptionHistory()
            }
        }, 0)
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [isOpen, fetchPrescriptionHistory])

    const handlePrint = useCallback(() => {
        const sheet = sheetRef.current
        if (!sheet) {
            window.print()
            return
        }
        const paper = PAPER_CONFIGS[paperSize] || PAPER_CONFIGS.a4
        const iframe = document.createElement('iframe')
        iframe.setAttribute('aria-hidden', 'true')
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
        document.body.appendChild(iframe)
        const doc = iframe.contentDocument
        if (!doc) {
            window.print()
            return
        }
        doc.open()
        doc.write(`<!doctype html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <title>Don-Thuoc-${rxCode}</title>
    <style>
        @page {
            size: ${paper.pageSize};
            margin: ${paper.pageMargin};
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        html, body {
            margin: 0;
            padding: 0;
            background: #ffffff !important;
            color: #0f172a !important;
        }
        ${PRINT_BASE_CSS}
    </style>
</head>
<body class="${paperSize}">
    ${sheet.outerHTML}
</body>
</html>`)
        doc.close()
        const cleanup = () => {
            setTimeout(() => {
                iframe.remove()
            }, 600)
        }
        iframe.contentWindow?.addEventListener('afterprint', cleanup)
        setTimeout(() => {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
        }, 250)
    }, [paperSize, rxCode])

    if (!isOpen) return null

    const handleCopyOld = (oldRx) => {
        if (onApplyOldPrescription) {
            onApplyOldPrescription(oldRx.items, oldRx.ghi_chu, oldRx.id)
        }
        AppToast.success(`Đã sao chép ${oldRx.items.length} thuốc từ đơn cũ #${oldRx.id} (${oldRx.ngay_ke}).`)
        onClose()
    }

    const handleApplyTemplate = (tmpl) => {
        if (onApplySampleTemplate) {
            onApplySampleTemplate(tmpl.items, tmpl.notes, tmpl.id)
        }
        AppToast.warning(`Đã nạp ${tmpl.items.length} thuốc từ toa mẫu "${tmpl.name}" vào đơn nháp. Bác sĩ vui lòng rà soát lại trước khi lưu.`)
        onClose()
    }

    const handleCopySummaryText = async () => {
        const dxText = diagnoses.length > 0
            ? diagnoses.map((d) => `${d.ma_icd10} - ${d.ten_benh_chan_doan}`).join('; ')
            : 'Chưa có mã chẩn đoán'

        const medLines = prescriptionItems.length > 0
            ? prescriptionItems.map((m, idx) => {
                const dosage = m.lieu_dung || `Sáng: ${m.sang || 0}, Trưa: ${m.trua || 0}, Chiều: ${m.chieu || 0}, Tối: ${m.toi || 0}`
                return `${idx + 1}. ${m.ten_thuoc} (${m.ham_luong || 'Chuẩn'}) — SL: ${m.so_luong || 1} ${m.don_vi_tinh || 'Đơn vị'}\n   Cách dùng: ${dosage} ${m.cach_dung ? `(${m.cach_dung})` : ''}`
            }).join('\n')
            : '(Chưa kê thuốc)'

        const summary = [
            `[PHÒNG KHÁM ĐA KHOA CLINIC-AI] — TÓM TẮT ĐƠN THUỐC`,
            `Mã hồ sơ: #${encounterId} | Mã ĐT: ${rxCode}`,
            `Bệnh nhân: ${patientName} (${patientGender}, ${patientDob})`,
            `Mã y tế: ${patientCode}`,
            `Ngày khám: ${formattedPrintDate} | Bác sĩ: ${doctorName}`,
            `----------------------------------------`,
            `CHẨN ĐOÁN: ${dxText}`,
            `----------------------------------------`,
            `DANH SÁCH THUỐC ĐIỀU TRỊ:`,
            medLines,
            `----------------------------------------`,
            `LỜI DẶN BÁC SĨ:`,
            prescriptionNote || encounter?.loi_dan_bac_si || 'Uống thuốc đúng giờ theo chỉ dẫn. Tái khám theo hẹn.',
            encounter?.ngay_hen_tai_kham ? `HẸN TÁI KHÁM: ${encounter.ngay_hen_tai_kham}` : '',
            `----------------------------------------`,
            `Hotline tư vấn sức khỏe: 1900 6868`,
        ].filter(Boolean).join('\n')

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(summary)
            } else {
                const ta = document.createElement('textarea')
                ta.value = summary
                document.body.appendChild(ta)
                ta.select()
                document.execCommand('copy')
                document.body.removeChild(ta)
            }
            AppToast.success('Đã sao chép tóm tắt đơn thuốc vào bộ nhớ tạm. Bạn có thể dán vào Zalo hoặc SMS để gửi.')
        } catch (e) {
            console.error('Clipboard copy error:', e)
            AppToast.error('Không thể truy cập Clipboard trình duyệt. Vui lòng thử lại.')
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <style>{`
                ${PRINT_BASE_CSS}
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #prescription-print-area, #prescription-print-area * {
                        visibility: visible !important;
                    }
                    #prescription-print-area {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: ${paperConfig.pageMargin} !important;
                        background: #ffffff !important;
                        color: #0f172a !important;
                        border: none !important;
                        box-shadow: none !important;
                        z-index: 999999 !important;
                    }
                    @page {
                        size: ${paperConfig.pageSize};
                        margin: ${paperConfig.pageMargin};
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
                <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between no-print">
                    <div className="flex items-center gap-3">
                        <Pill size={24} className="text-teal-400" weight="duotone" />
                        <div>
                            <h3 className="text-base font-extrabold tracking-wide">
                                QUẢN LÝ PHIẾU IN ĐƠN THUỐC, TOA MẪU & SAO CHÉP
                            </h3>
                            <p className="text-xs text-slate-400">
                                Chuẩn TT 52/2017/TT-BYT & TT 32/2023/TT-BYT
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('print')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                activeTab === 'print'
                                    ? 'bg-teal-500 text-slate-950'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                        >
                            <Printer size={16} weight="bold" />
                            Phiếu In ({prescriptionItems.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('templates')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                activeTab === 'templates'
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                        >
                            <BookmarkSimple size={16} weight="bold" />
                            Phác Đồ Mẫu
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('copy')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                activeTab === 'copy'
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                        >
                            <ClockCounterClockwise size={16} weight="bold" />
                            Đơn Cũ ({oldPrescriptions.length})
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer ml-2"
                        >
                            <X size={18} weight="bold" />
                        </button>
                    </div>
                </div>

                <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
                    <div className="flex flex-wrap items-center gap-3">
                        {activeTab === 'print' && (
                            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-300 shadow-2xs">
                                <span className="text-[11px] font-bold text-slate-500 px-2 uppercase tracking-wide">
                                    Khổ in:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPaperSize('a4')}
                                    className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                                        paperSize === 'a4'
                                            ? 'bg-teal-700 text-white shadow-xs'
                                            : 'text-slate-700 hover:text-teal-700 hover:bg-slate-50'
                                    }`}
                                >
                                    Khổ A4 (Laser)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaperSize('a5')}
                                    className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                                        paperSize === 'a5'
                                            ? 'bg-teal-700 text-white shadow-xs'
                                            : 'text-slate-700 hover:text-teal-700 hover:bg-slate-50'
                                    }`}
                                >
                                    Khổ A5 (Laser)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaperSize('k80')}
                                    className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                                        paperSize === 'k80'
                                            ? 'bg-teal-700 text-white shadow-xs'
                                            : 'text-slate-700 hover:text-teal-700 hover:bg-slate-50'
                                    }`}
                                >
                                    In nhiệt K80
                                </button>
                            </div>
                        )}

                        {activeTab === 'print' && (
                            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 select-none ml-2">
                                <input
                                    type="checkbox"
                                    checked={showPriceOnPrint}
                                    onChange={(e) => setShowPriceOnPrint(e.target.checked)}
                                    className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500 cursor-pointer"
                                />
                                <span className="flex items-center gap-1">
                                    <CurrencyCircleDollar size={16} className="text-teal-700" weight="bold" />
                                    In kèm đơn giá &amp; thành tiền
                                </span>
                            </label>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleCopySummaryText}
                        className="px-3.5 py-1.5 rounded-xl bg-teal-800 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        title="Sao chép toàn bộ tóm tắt đơn thuốc sang định dạng văn bản để gửi Zalo / SMS cho người bệnh"
                    >
                        <ChatText size={16} weight="bold" />
                        Sao Chép Text (Zalo / SMS)
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
                    {activeTab === 'print' ? (
                        <div className="max-w-4xl mx-auto space-y-3">
                            <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-teal-950 no-print">
                                <div className="flex items-center gap-2">
                                    <FileText size={18} className="text-teal-700 shrink-0" weight="bold" />
                                    <span>
                                        Tiêu chuẩn <strong>TT 52/2017/TT-BYT &amp; TT 32/2023/TT-BYT</strong> — Đang chọn:{' '}
                                        <strong className="text-teal-800 underline uppercase">{paperConfig.label}</strong>
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    className="px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                                >
                                    <Printer size={15} weight="bold" />
                                    <span>In {paperSize.toUpperCase()} ngay</span>
                                </button>
                            </div>

                            <div className="bg-slate-300/80 p-6 rounded-2xl overflow-x-auto flex justify-center border border-slate-300">
                                <div
                                    ref={sheetRef}
                                    id="prescription-print-area"
                                    className={`sheet-container ${paperConfig.sheetClass} bg-white shadow-xl border border-slate-300 rounded-xs mx-auto`}
                                    style={{
                                        width: paperConfig.previewWidth,
                                        minHeight: paperConfig.minHeight,
                                    }}
                                >
                                    <div className="sheet-hdr">
                                        <div>
                                            <div style={{ fontSize: '0.82em', fontWeight: 700, textTransform: 'uppercase', color: '#0f766e' }}>
                                                SỞ Y TẾ TP. HỒ CHÍ MINH
                                            </div>
                                            <div style={{ fontSize: '1.1em', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a' }}>
                                                PHÒNG KHÁM ĐA KHOA THÔNG MINH CLINIC-AI
                                            </div>
                                            <div style={{ fontSize: '0.82em', color: '#475569', marginTop: '2px' }}>
                                                Địa chỉ: Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM | Hotline: 1900 6868
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 6px', background: '#f8fafc', textAlign: 'center' }}>
                                                <Barcode size={32} style={{ margin: '0 auto', color: '#1e293b' }} />
                                                <div style={{ fontSize: '9px', fontFamily: 'monospace', fontWeight: 700, color: '#334155' }}>
                                                    {rxCode}
                                                </div>
                                            </div>
                                            <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 6px', background: '#f8fafc', textAlign: 'center' }}>
                                                <QrCode size={36} style={{ margin: '0 auto', color: '#0f766e' }} />
                                                <div style={{ fontSize: '8px', fontFamily: 'monospace', color: '#64748b' }}>QR ĐƠN THUỐC</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="sheet-title">
                                        <h2>ĐƠN THUỐC NGOẠI TRÚ ĐIỆN TỬ</h2>
                                        <p>
                                            (Ban hành theo Thông tư số 52/2017/TT-BYT &amp; Thông tư số 32/2023/TT-BYT)
                                        </p>
                                        <p style={{ marginTop: '2px', fontWeight: 600 }}>
                                            Mã hồ sơ: #{encounterId} — Ngày kê: {formattedPrintDate} — Khổ in: {paperSize.toUpperCase()}
                                        </p>
                                    </div>

                                    <div className="sheet-info-grid">
                                        <div>
                                            <span style={{ color: '#64748b' }}>Họ và tên người bệnh:</span>{' '}
                                            <strong style={{ textTransform: 'uppercase', color: '#0f172a' }}>{patientName}</strong>
                                        </div>
                                        <div>
                                            <span style={{ color: '#64748b' }}>Mã định danh y tế:</span>{' '}
                                            <strong style={{ fontFamily: 'monospace', color: '#0f766e' }}>{patientCode}</strong>
                                        </div>
                                        <div>
                                            <span style={{ color: '#64748b' }}>Ngày sinh:</span>{' '}
                                            <strong>{patientDob}</strong> ({patientGender})
                                        </div>
                                        <div>
                                            <span style={{ color: '#64748b' }}>Số điện thoại:</span>{' '}
                                            <strong>{patientPhone}</strong>
                                        </div>
                                        <div className="sheet-info-full">
                                            <span style={{ color: '#64748b' }}>Chẩn đoán y khoa (ICD-10):</span>{' '}
                                            <strong style={{ color: '#0f766e' }}>
                                                {diagnoses.length > 0
                                                    ? diagnoses.map((d) => `${d.ma_icd10} - ${d.ten_benh_chan_doan}`).join('; ')
                                                    : 'J02.9 - Viêm họng cấp không đặc hiệu'}
                                            </strong>
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.88em', color: '#334155', marginBottom: '4px' }}>
                                            Danh mục thuốc chỉ định điều trị ({prescriptionItems.length} khoản)
                                        </div>
                                        <table className="sheet-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '32px' }}>STT</th>
                                                    <th>Tên thuốc / Hoạt chất / Hàm lượng</th>
                                                    <th style={{ textAlign: 'center' }}>Liều dùng &amp; Cách uống</th>
                                                    <th style={{ width: '70px', textAlign: 'center' }}>Số ngày</th>
                                                    <th style={{ width: '80px', textAlign: 'center' }}>Số lượng</th>
                                                    {showPriceOnPrint && (
                                                        <th style={{ width: '85px', textAlign: 'right' }}>Đơn giá</th>
                                                    )}
                                                    {showPriceOnPrint && (
                                                        <th style={{ width: '95px', textAlign: 'right' }}>Thành tiền</th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {prescriptionItems.length > 0 ? (
                                                    prescriptionItems.map((item, idx) => {
                                                        const qty = Number(item.so_luong) || 1
                                                        const price = Number(item.don_gia) || 15000
                                                        const lineTotal = qty * price
                                                        return (
                                                            <tr key={idx}>
                                                                <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>
                                                                    {idx + 1}
                                                                </td>
                                                                <td>
                                                                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                                                                        {item.ten_thuoc}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.85em', color: '#64748b' }}>
                                                                        Hoạt chất: {item.hoat_chat || 'Theo danh mục'} | Hàm lượng: {item.ham_luong || 'Chuẩn'} | Đường dùng: {item.duong_dung || 'Uống'}
                                                                    </div>
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <div style={{ fontWeight: 700, color: '#0f766e' }}>
                                                                        {item.lieu_dung
                                                                            ? item.lieu_dung
                                                                            : [
                                                                                  item.sang && Number(item.sang) > 0 ? `Sáng: ${item.sang}` : '',
                                                                                  item.trua && Number(item.trua) > 0 ? `Trưa: ${item.trua}` : '',
                                                                                  item.chieu && Number(item.chieu) > 0 ? `Chiều: ${item.chieu}` : '',
                                                                                  item.toi && Number(item.toi) > 0 ? `Tối: ${item.toi}` : '',
                                                                              ].filter(Boolean).join(' · ') || 'Theo chỉ dẫn'}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.85em', color: '#475569', fontStyle: 'italic', marginTop: '2px' }}>
                                                                        {item.cach_dung || 'Uống sau ăn no'}
                                                                    </div>
                                                                </td>
                                                                <td style={{ textAlign: 'center', fontWeight: 600 }}>
                                                                    {item.thoi_gian_dung_ngay || item.so_ngay_dung || 5} ngày
                                                                </td>
                                                                <td style={{ textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>
                                                                    {item.so_luong || 10} {item.don_vi_tinh || 'Viên'}
                                                                </td>
                                                                {showPriceOnPrint && (
                                                                    <td style={{ textAlign: 'right', color: '#475569' }}>
                                                                        {price.toLocaleString('vi-VN')} đ
                                                                    </td>
                                                                )}
                                                                {showPriceOnPrint && (
                                                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                                                        {lineTotal.toLocaleString('vi-VN')} đ
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        )
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan={showPriceOnPrint ? 7 : 5} style={{ padding: '18px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                                            Chưa có thuốc trong đơn. Bác sĩ có thể thêm thuốc hoặc bấm tab &ldquo;Phác Đồ Mẫu&rdquo; / &ldquo;Đơn Cũ&rdquo;.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                            {showPriceOnPrint && prescriptionItems.length > 0 && (
                                                <tfoot>
                                                    <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                                                        <td colSpan={showPriceOnPrint ? 6 : 4} style={{ textAlign: 'right', textTransform: 'uppercase', padding: '6px 8px' }}>
                                                            Tổng tiền thuốc ước tính:
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 900, color: '#0f766e', padding: '6px 8px' }}>
                                                            {estimatedTotal.toLocaleString('vi-VN')} VNĐ
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>

                                    <div className="sheet-remarks-grid">
                                        <div>
                                            <div style={{ fontWeight: 800, textTransform: 'uppercase', color: '#1e293b', marginBottom: '4px' }}>
                                                Lời dặn của Bác sĩ điều trị:
                                            </div>
                                            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', padding: '8px 10px', color: '#92400e', lineHeight: 1.4 }}>
                                                {prescriptionNote ||
                                                    encounter?.loi_dan_bac_si ||
                                                    'Uống thuốc đúng giờ theo chỉ dẫn. Nếu có biểu hiện dị ứng (nổi mẩn, khó thở) cần ngưng thuốc và đến cơ sở y tế gần nhất.'}
                                            </div>
                                            {encounter?.ngay_hen_tai_kham && (
                                                <div style={{ fontWeight: 700, color: '#0f766e', marginTop: '6px' }}>
                                                    📅 Hẹn tái khám: {encounter.ngay_hen_tai_kham}
                                                </div>
                                            )}
                                        </div>

                                        <div className="sheet-signature-box">
                                            <div>
                                                <div style={{ fontStyle: 'italic', color: '#64748b' }}>
                                                    Ngày {printDateDay} tháng {printDateMonth} năm {currentYear}
                                                </div>
                                                <div style={{ fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', marginTop: '2px' }}>
                                                    Bác sĩ khám bệnh
                                                </div>
                                            </div>

                                            <div className="sheet-cert-badge">
                                                <CheckCircle size={22} weight="fill" style={{ color: '#059669', flexShrink: 0 }} />
                                                <div>
                                                    <div style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#065f46' }}>
                                                        CHỨNG THƯ SỐ Y TẾ HỢP LỆ (TT 04/2022/TT-BYT)
                                                    </div>
                                                    <div style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>
                                                        {doctorName}
                                                    </div>
                                                    <div style={{ fontSize: '9px', color: '#047857', fontFamily: 'monospace' }}>
                                                        Ký lúc: {encounter?.ngay_ky || encounter?.don_thuoc?.ngay_ky ? new Date(encounter?.ngay_ky || encounter?.don_thuoc?.ngay_ky).toLocaleString('vi-VN') : formattedPrintDate}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="sheet-footer-notice">
                                        <span>Khám lại xin mang theo đơn này. Đơn thuốc có giá trị mua trong vòng 5 ngày kể từ ngày kê đơn theo quy định Bộ Y Tế.</span>
                                        <span>Mã ĐT quốc gia: <strong>{rxCode}-VN</strong></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'templates' ? (
                        <div className="space-y-4 max-w-3xl mx-auto">
                            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3">
                                <WarningCircle size={24} className="text-indigo-700 shrink-0 mt-0.5" weight="fill" />
                                <div className="text-xs text-indigo-900 leading-relaxed">
                                    <p className="font-bold uppercase text-indigo-950">
                                        HƯỚNG DẪN LÂM SÀNG & AN TOÀN SỬ DỤNG THUỐC
                                    </p>
                                    <p className="mt-1">
                                        Các toa thuốc mẫu dưới đây chỉ mang tính chất minh họa cấu trúc kê đơn từ tài liệu thực hành lâm sàng, <strong>chưa được Hội đồng Y khoa phòng khám phê duyệt làm phác đồ áp dụng bắt buộc</strong>. Khi nạp vào đơn thuốc, bác sĩ bắt buộc phải kiểm tra lại thể trạng, tiền sử dị ứng, chức năng gan thận của người bệnh trước khi quyết định ký ban hành.
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-4">
                                {SAMPLE_PRESCRIPTION_TEMPLATES.map((tmpl) => (
                                    <div
                                        key={tmpl.id}
                                        className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden hover:border-indigo-300 transition"
                                    >
                                        <div className="bg-slate-100 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-700 text-white text-xs font-mono font-bold mr-2">
                                                    {tmpl.id}
                                                </span>
                                                <span className="text-sm font-bold text-slate-800">
                                                    {tmpl.name}
                                                </span>
                                                <span className="text-xs text-indigo-700 font-semibold ml-2">
                                                    • {tmpl.category}
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleApplyTemplate(tmpl)}
                                                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                                            >
                                                <BookmarkSimple size={15} weight="bold" />
                                                Nạp vào Đơn Nháp ({tmpl.items.length} thuốc)
                                            </button>
                                        </div>

                                        <div className="p-4 space-y-3 text-xs">
                                            <p className="text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                                                Lời dặn mẫu: {tmpl.notes}
                                            </p>

                                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                                <table className="w-full text-left border-collapse text-xs">
                                                    <thead>
                                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                                                            <th className="py-2 px-3">#</th>
                                                            <th className="py-2 px-3">Tên thuốc & Hoạt chất</th>
                                                            <th className="py-2 px-3">Liều dùng đề xuất</th>
                                                            <th className="py-2 px-3 text-center">Thời gian</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {tmpl.items.map((med, mIdx) => (
                                                            <tr key={mIdx}>
                                                                <td className="py-2 px-3 font-bold text-slate-500">
                                                                    {mIdx + 1}
                                                                </td>
                                                                <td className="py-2 px-3 font-bold text-slate-800">
                                                                    {med.ten_thuoc}
                                                                    <div className="text-[11px] text-slate-500 font-normal">
                                                                        {med.hoat_chat} ({med.ham_luong})
                                                                    </div>
                                                                </td>
                                                                <td className="py-2 px-3 text-indigo-700 font-medium">
                                                                    Sáng {med.sang || 0} - Trưa {med.trua || 0} - Chiều {med.chieu || 0} - Tối {med.toi || 0}
                                                                    <div className="text-[11px] text-slate-500">
                                                                        {med.cach_dung}
                                                                    </div>
                                                                </td>
                                                                <td className="py-2 px-3 text-center font-bold text-slate-700">
                                                                    {med.so_ngay_dung} ngày
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 max-w-3xl mx-auto">
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Stethoscope size={24} className="text-amber-700" weight="duotone" />
                                    <div>
                                        <h4 className="text-sm font-bold text-amber-950">
                                            Lịch sử Đơn thuốc cũ của bệnh nhân: {patientName}
                                        </h4>
                                        <p className="text-xs text-amber-800">
                                            Bác sĩ có thể xem lại các đơn thuốc lần trước và bấm &ldquo;Sao chép vào ca khám hiện tại&rdquo; để kế thừa điều trị dài hạn.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {loadingHistory ? (
                                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-xl mx-auto my-6 shadow-xs">
                                    <div className="inline-block animate-spin text-teal-700 mb-2">
                                        <ClockCounterClockwise size={32} weight="bold" />
                                    </div>
                                    <p className="text-xs font-semibold text-slate-600">
                                        Đang tải lịch sử đơn thuốc của bệnh nhân...
                                    </p>
                                </div>
                            ) : oldPrescriptions.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center max-w-xl mx-auto my-6 shadow-xs">
                                    <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
                                        <ClockCounterClockwise size={28} weight="duotone" />
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-900 mb-1">
                                        Bệnh nhân chưa có đơn thuốc cũ trong hệ thống
                                    </h4>
                                    <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                                        Hệ thống chưa ghi nhận đơn thuốc ngoại trú trước đây của người bệnh. Bác sĩ có thể kê đơn mới trực tiếp hoặc tham khảo các phác đồ điều trị khuyến nghị tại tab &ldquo;Phác Đồ Mẫu&rdquo;.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('templates')}
                                        className="mt-4 px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition"
                                    >
                                        <BookmarkSimple size={15} weight="bold" />
                                        <span>Xem phác đồ mẫu khuyến nghị</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {oldPrescriptions.map((oldRx) => (
                                        <div
                                            key={oldRx.id}
                                            className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                                        >
                                            <div className="bg-slate-100 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <span className="px-2.5 py-0.5 rounded-lg bg-teal-700 text-white text-xs font-mono font-bold mr-2">
                                                        Đơn #{oldRx.id}
                                                    </span>
                                                    <span className="text-sm font-bold text-slate-800">
                                                        Ngày kê: {oldRx.ngay_ke}
                                                    </span>
                                                    <span className="text-xs text-slate-500 ml-2">({oldRx.bac_si})</span>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyOld(oldRx)}
                                                    className="px-3.5 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                                                >
                                                    <Copy size={15} weight="bold" />
                                                    Sao chép đơn thuốc này ({oldRx.items.length} thuốc)
                                                </button>
                                            </div>

                                            <div className="p-4 space-y-3 text-xs">
                                                <div>
                                                    <span className="font-semibold text-slate-500">Chẩn đoán lần trước:</span>{' '}
                                                    <strong className="text-slate-800">{oldRx.chan_doan}</strong>
                                                </div>

                                                {oldRx.ghi_chu && (
                                                    <div className="text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                                                        Lời dặn cũ: {oldRx.ghi_chu}
                                                    </div>
                                                )}

                                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                                                                <th className="py-2 px-3">#</th>
                                                                <th className="py-2 px-3">Tên thuốc & Hàm lượng</th>
                                                                <th className="py-2 px-3">Liều dùng</th>
                                                                <th className="py-2 px-3 text-center">Số lượng</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {oldRx.items.map((med, mIdx) => (
                                                                <tr key={mIdx}>
                                                                    <td className="py-2 px-3 font-bold text-slate-500">
                                                                        {mIdx + 1}
                                                                    </td>
                                                                    <td className="py-2 px-3 font-bold text-slate-800">
                                                                        {med.ten_thuoc} ({med.ham_luong || 'Chuẩn'})
                                                                        {med.hoat_chat && (
                                                                            <div className="text-[11px] text-slate-500 font-normal">
                                                                                Hoạt chất: {med.hoat_chat}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-teal-700 font-medium">
                                                                        {med.lieu_dung}
                                                                        {med.cach_dung && med.cach_dung !== med.lieu_dung && (
                                                                            <div className="text-[11px] text-slate-500 font-normal italic">
                                                                                {med.cach_dung}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-center font-bold">
                                                                        {med.so_luong} {med.don_vi_tinh || 'Viên'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-white border-t border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 no-print">
                    <span className="text-xs text-slate-500">
                        Mã định danh đơn thuốc quốc gia: <strong>{rxCode}-VN</strong>
                    </span>
                    <div className="flex items-center gap-3">
                        {activeTab === 'print' && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">
                                    Đang chọn: <strong className="text-teal-800">{paperConfig.label}</strong>
                                </span>
                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                                >
                                    <Printer size={16} weight="bold" />
                                    <span>In đơn thuốc khổ {paperSize.toUpperCase()}</span>
                                </button>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
