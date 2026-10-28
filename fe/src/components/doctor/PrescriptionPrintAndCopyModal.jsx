import { useState } from 'react'
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
    CalendarCheck,
    ChatText,
    BookmarkSimple,
    WarningCircle,
    CurrencyCircleDollar,
} from '@phosphor-icons/react'
import { AppToast } from '../common/AppNotification'
import { SAMPLE_PRESCRIPTION_TEMPLATES } from '../../utils/constants/clinicalTemplates'

const SAMPLE_OLD_PRESCRIPTIONS = [
    {
        id: 801,
        ngay_ke: '10/09/2026',
        bac_si: 'BS.CKI Nguyễn Văn Hùng',
        chan_doan: 'J02.9 - Viêm họng cấp / J30.4 - Viêm mũi dị ứng',
        ghi_chu: 'Kiêng nước đá, giữ ấm vùng cổ họng, tái khám sau 5 ngày nếu còn sốt.',
        items: [
            {
                ten_thuoc: 'Amoxicillin + Clavulanic Acid (Augmentin)',
                hoat_chat: 'Amoxicillin 875mg + Acid Clavulanic 125mg',
                ham_luong: '1000mg',
                lieu_dung: 'Sáng 1 viên, Tối 1 viên (sau ăn)',
                tan_suat: '2 lần/ngày',
                thoi_gian_dung_ngay: 5,
                so_luong: 10,
                don_vi_tinh: 'Viên',
                don_gia: 18500,
                duong_dung: 'Uống',
                ghi_chu: 'Uống ngay sau bữa ăn no',
            },
            {
                ten_thuoc: 'Paracetamol (Efferalgan)',
                hoat_chat: 'Paracetamol',
                ham_luong: '500mg',
                lieu_dung: 'Uống 1 viên khi sốt >= 38.5°C',
                tan_suat: 'Cách mỗi 6 giờ khi sốt',
                thoi_gian_dung_ngay: 3,
                so_luong: 6,
                don_vi_tinh: 'Viên',
                don_gia: 4500,
                duong_dung: 'Uống',
                ghi_chu: 'Không quá 4 viên/ngày',
            },
            {
                ten_thuoc: 'Desloratadine (Aerius)',
                hoat_chat: 'Desloratadine',
                ham_luong: '5mg',
                lieu_dung: 'Tối 1 viên',
                tan_suat: '1 lần/ngày',
                thoi_gian_dung_ngay: 5,
                so_luong: 5,
                don_vi_tinh: 'Viên',
                don_gia: 12000,
                duong_dung: 'Uống',
                ghi_chu: 'Uống buổi tối trước khi ngủ',
            },
        ],
    },
    {
        id: 765,
        ngay_ke: '18/07/2026',
        bac_si: 'ThS.BS Trần Minh Tuấn',
        chan_doan: 'K29.7 - Viêm dạ dày - tá tràng trào ngược',
        ghi_chu: 'Tránh đồ chua cay, không thức khuya, ăn đúng giờ.',
        items: [
            {
                ten_thuoc: 'Esomeprazole (Nexium Mups)',
                hoat_chat: 'Esomeprazole',
                ham_luong: '40mg',
                lieu_dung: 'Sáng 1 viên trước ăn 30 phút',
                tan_suat: '1 lần/ngày',
                thoi_gian_dung_ngay: 14,
                so_luong: 14,
                don_vi_tinh: 'Viên',
                don_gia: 24000,
                duong_dung: 'Uống',
                ghi_chu: 'Uống trước ăn sáng 30 phút',
            },
            {
                ten_thuoc: 'Phosphalugel (Thuốc chữ P)',
                hoat_chat: 'Colloidal Aluminum Phosphate',
                ham_luong: '20g',
                lieu_dung: 'Sáng 1 gói, Tối 1 gói khi đau rát thượng vị',
                tan_suat: '2 lần/ngày',
                thoi_gian_dung_ngay: 7,
                so_luong: 14,
                don_vi_tinh: 'Gói',
                don_gia: 6500,
                duong_dung: 'Uống',
                ghi_chu: 'Uống sau ăn 1-2 giờ',
            },
        ],
    },
]

export default function PrescriptionPrintAndCopyModal({
    isOpen,
    onClose,
    initialTab = 'print', // 'print' | 'copy' | 'templates'
    encounter = {},
    patient = {},
    diagnoses = [],
    prescriptionItems = [],
    prescriptionNote = '',
    onApplyOldPrescription,
    onApplySampleTemplate,
}) {
    const [activeTab, setActiveTab] = useState(initialTab)
    const [showPriceOnPrint, setShowPriceOnPrint] = useState(false)
    const [paperSize, setPaperSize] = useState('a4') // 'a4' | 'k80'

    if (!isOpen) return null

    const rxCode = `RX-${encounter?.id || 9102}-${new Date().getFullYear()}`
    const patientName = patient?.ho_ten || encounter?.ten_benh_nhan || 'Nguyễn Văn Bệnh Nhân'
    const patientDob = patient?.ngay_sinh || encounter?.ngay_sinh || '15/05/1990'
    const patientGender = patient?.gioi_tinh || encounter?.gioi_tinh || 'Nam'
    const patientPhone = patient?.so_dien_thoai || encounter?.so_dien_thoai || '0901 234 567'
    const patientCode = patient?.ma || encounter?.ma_benh_nhan || `BN-${encounter?.id || '2026'}`
    const doctorName = encounter?.ten_bac_si || 'BS.CKI Nguyễn Văn An'

    // Tính tổng tiền ước tính chỉ dùng cho bản in khi bật hiển thị giá
    const estimatedTotal = prescriptionItems.reduce((sum, item) => {
        const qty = Number(item.so_luong) || 1
        const price = Number(item.don_gia) || 15000
        return sum + qty * price
    }, 0)

    const handleCopyOld = (oldRx) => {
        if (onApplyOldPrescription) {
            onApplyOldPrescription(oldRx.items, oldRx.ghi_chu, oldRx.id)
        }
        AppToast.success(`Đã sao chép ${oldRx.items.length} thuốc từ đơn cũ #${oldRx.id} (${oldRx.ngay_ke})!`)
        onClose()
    }

    const handleApplyTemplate = (tmpl) => {
        if (onApplySampleTemplate) {
            onApplySampleTemplate(tmpl.items, tmpl.notes, tmpl.id)
        }
        AppToast.warning(`Đã nạp ${tmpl.items.length} thuốc từ mẫu "${tmpl.name}" vào đơn nháp. Bác sĩ vui lòng rà soát lại trước khi lưu!`)
        onClose()
    }

    // 1-Click Copy Tóm tắt đơn thuốc dạng Text chuẩn gửi Zalo/SMS (Ý tưởng SimpleClinic)
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
            `🏥 [PHÒNG KHÁM ĐA KHOA CLINIC-AI] — TÓM TẮT ĐƠN THUỐC`,
            `Mã hồ sơ: #${encounter?.id || 9102} | Mã ĐT: ${rxCode}`,
            `Bệnh nhân: ${patientName} (${patientGender}, ${patientDob})`,
            `Mã y tế: ${patientCode}`,
            `Ngày khám: ${new Date().toLocaleDateString('vi-VN')} | Bác sĩ: ${doctorName}`,
            `----------------------------------------`,
            `📋 CHẨN ĐOÁN: ${dxText}`,
            `----------------------------------------`,
            `💊 DANH SÁCH THUỐC ĐIỀU TRỊ:`,
            medLines,
            `----------------------------------------`,
            `📝 LỜI DẶN BÁC SĨ:`,
            prescriptionNote || encounter?.loi_dan_bac_si || 'Uống thuốc đúng giờ theo chỉ dẫn. Tái khám theo hẹn.',
            encounter?.ngay_hen_tai_kham ? `📅 HẸN TÁI KHÁM: ${encounter.ngay_hen_tai_kham}` : '',
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
            AppToast.success('Đã sao chép tóm tắt đơn thuốc vào bộ nhớ tạm! Bạn có thể dán vào Zalo/SMS để gửi.')
        } catch (e) {
            console.error('Clipboard copy error:', e)
            AppToast.error('Không thể truy cập Clipboard trình duyệt. Vui lòng thử lại.')
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Top Modal Bar */}
                <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Pill size={24} className="text-teal-400" weight="duotone" />
                        <div>
                            <h3 className="text-base font-extrabold tracking-wide">
                                QUẢN LÝ PHIẾU IN ĐƠN THUỐC, TOA MẪU & SAO CHÉP
                            </h3>
                            <p className="text-xs text-slate-400">
                                Kế thừa thiết kế từ SimpleClinic & TheDuckHospital · Chuẩn TT 52/2017 & TT 32/2023/TT-BYT
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
                            Đơn Cũ
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

                {/* Sub-bar for Controls & Quick Actions */}
                <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-4">

                        {activeTab === 'print' && (
                            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-300">
                                <button
                                    type="button"
                                    onClick={() => setPaperSize('a4')}
                                    className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                                        paperSize === 'a4' ? 'bg-[#0077B6] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Khổ A4 / A5 (Laser)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaperSize('k80')}
                                    className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                                        paperSize === 'k80' ? 'bg-[#0077B6] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    In nhiệt K80 (Bill)
                                </button>
                            </div>
                        )}

                        {activeTab === 'print' && (
                            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 select-none">
                                <input
                                    type="checkbox"
                                    checked={showPriceOnPrint}
                                    onChange={(e) => setShowPriceOnPrint(e.target.checked)}
                                    className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500 cursor-pointer"
                                />
                                <span className="flex items-center gap-1">
                                    <CurrencyCircleDollar size={16} className="text-teal-700" weight="bold" />
                                    In kèm đơn giá & thành tiền
                                </span>
                            </label>
                        )}
                        {activeTab === 'print' && (
                            <span className="text-[11px] text-slate-500 italic">
                                ({showPriceOnPrint ? 'Hiển thị giá tiền để thu ngân tính phí' : 'Ẩn giá tiền theo chuẩn đơn ngoại trú mang ngoài'})
                            </span>
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

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    {activeTab === 'print' ? (
                        <div className="bg-white border-2 border-slate-300 rounded-2xl p-8 shadow-sm max-w-3xl mx-auto text-slate-900 print:border-none print:shadow-none print:p-0">
                            {/* Header Quốc hiệu & Mã vạch */}
                            <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-800 pb-4 mb-5">
                                <div>
                                    <div className="text-xs font-bold uppercase text-teal-800">
                                        SỞ Y TẾ TP. HỒ CHÍ MINH
                                    </div>
                                    <div className="text-lg font-black uppercase tracking-tight text-slate-900">
                                        PHÒNG KHÁM ĐA KHOA THÔNG MINH CLINIC-AI
                                    </div>
                                    <div className="text-xs text-slate-600 mt-0.5">
                                        Địa chỉ: Khu Công Nghệ Cao, TP. Thủ Đức | Hotline: 1900 6868
                                    </div>
                                </div>

                                <div className="text-right flex items-center gap-4">
                                    <div className="border border-slate-300 rounded-xl p-2 bg-slate-50 text-center">
                                        <Barcode size={36} className="mx-auto text-slate-800" />
                                        <div className="text-[10px] font-mono font-bold text-slate-700 mt-0.5">
                                            {rxCode}
                                        </div>
                                    </div>
                                    <div className="border border-slate-300 rounded-xl p-2 bg-slate-50 text-center">
                                        <QrCode size={42} className="mx-auto text-teal-800" />
                                        <div className="text-[9px] font-mono text-slate-500">QR Đơn Thuốc</div>
                                    </div>
                                </div>
                            </div>

                            {/* Title */}
                            <div className="text-center mb-5">
                                <h2 className="text-2xl font-black uppercase tracking-wide text-slate-900">
                                    ĐƠN THUỐC NGOẠI TRÚ ĐIỆN TỬ
                                </h2>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    Mã hồ sơ lượt khám: #{encounter?.id || 9102} — Ngày kê:{' '}
                                    {new Date().toLocaleDateString('vi-VN')}
                                </p>
                            </div>

                            {/* Thông tin hành chính & Chẩn đoán */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs mb-5">
                                <div>
                                    <span className="text-slate-500">Họ và tên bệnh nhân:</span>{' '}
                                    <strong className="text-sm uppercase text-slate-900">{patientName}</strong>
                                </div>
                                <div>
                                    <span className="text-slate-500">Mã định danh y tế:</span>{' '}
                                    <strong className="font-mono text-teal-800">{patientCode}</strong>
                                </div>
                                <div>
                                    <span className="text-slate-500">Ngày sinh / Giới tính:</span>{' '}
                                    <strong>
                                        {patientDob} ({patientGender})
                                    </strong>
                                </div>
                                <div>
                                    <span className="text-slate-500">Số điện thoại:</span>{' '}
                                    <strong>{patientPhone}</strong>
                                </div>
                                <div className="md:col-span-2 pt-1 border-t border-slate-200/80">
                                    <span className="text-slate-500">Chẩn đoán y khoa (ICD-10):</span>{' '}
                                    <strong className="text-teal-800">
                                        {diagnoses.length > 0
                                            ? diagnoses
                                                  .map((d) => `${d.ma_icd10} - ${d.ten_benh_chan_doan}`)
                                                  .join('; ')
                                            : 'J02.9 - Viêm họng cấp không đặc hiệu'}
                                    </strong>
                                </div>
                            </div>

                            {/* Bảng danh mục thuốc đã kê */}
                            <div className="mb-5">
                                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                                    Danh mục thuốc chỉ định điều trị ({prescriptionItems.length} khoản)
                                </h4>
                                <div className="overflow-x-auto border border-slate-300 rounded-xl">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                                                <th className="py-2.5 px-3 w-10 text-center">STT</th>
                                                <th className="py-2.5 px-3">Tên thuốc / Hoạt chất / Hàm lượng</th>
                                                <th className="py-2.5 px-3 text-center">Liều dùng & Cách uống</th>
                                                <th className="py-2.5 px-3 text-center w-20">Số ngày</th>
                                                <th className="py-2.5 px-3 text-center w-24">Số lượng</th>
                                                {showPriceOnPrint && (
                                                    <th className="py-2.5 px-3 text-right w-24">Đơn giá</th>
                                                )}
                                                {showPriceOnPrint && (
                                                    <th className="py-2.5 px-3 text-right w-28">Thành tiền</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {prescriptionItems.length > 0 ? (
                                                prescriptionItems.map((item, idx) => {
                                                    const qty = Number(item.so_luong) || 1
                                                    const price = Number(item.don_gia) || 15000
                                                    const lineTotal = qty * price
                                                    return (
                                                        <tr key={idx} className="hover:bg-slate-50/80">
                                                            <td className="py-3 px-3 text-center font-bold text-slate-600">
                                                                {idx + 1}
                                                            </td>
                                                            <td className="py-3 px-3">
                                                                <div className="font-bold text-slate-900 text-sm">
                                                                    {item.ten_thuoc}
                                                                </div>
                                                                <div className="text-[11px] text-slate-500">
                                                                    Hoạt chất: {item.hoat_chat || 'Theo danh mục'} | Hàm
                                                                    lượng: {item.ham_luong || 'Chuẩn'} | Đường dùng:{' '}
                                                                    {item.duong_dung || 'Uống'}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-3 text-center">
                                                                <div className="font-semibold text-teal-800">
                                                                    {item.lieu_dung || `Sáng ${item.sang || 1} - Chiều ${item.chieu || 1}`}
                                                                </div>
                                                                <div className="text-[11px] text-slate-500">
                                                                    {item.cach_dung || 'Uống sau ăn no'}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-3 text-center font-semibold">
                                                                {item.thoi_gian_dung_ngay || item.so_ngay_dung || 5} ngày
                                                            </td>
                                                            <td className="py-3 px-3 text-center font-black text-sm text-slate-900">
                                                                {item.so_luong || 10} {item.don_vi_tinh || 'Viên'}
                                                            </td>
                                                            {showPriceOnPrint && (
                                                                <td className="py-3 px-3 text-right font-medium text-slate-600">
                                                                    {price.toLocaleString('vi-VN')} đ
                                                                </td>
                                                            )}
                                                            {showPriceOnPrint && (
                                                                <td className="py-3 px-3 text-right font-bold text-slate-900">
                                                                    {lineTotal.toLocaleString('vi-VN')} đ
                                                                </td>
                                                            )}
                                                        </tr>
                                                    )
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={showPriceOnPrint ? 7 : 5} className="py-6 text-center text-slate-400 italic">
                                                        Chưa có thuốc trong đơn. Bạn có thể thêm thuốc hoặc bấm tab
                                                        &ldquo;Toa Mẫu&rdquo; / &ldquo;Đơn Cũ&rdquo;.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        {showPriceOnPrint && prescriptionItems.length > 0 && (
                                            <tfoot>
                                                <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                                                    <td colSpan={6} className="py-2.5 px-3 text-right uppercase text-slate-700">
                                                        Tổng tiền thuốc ước tính:
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right text-sm font-black text-teal-800">
                                                        {estimatedTotal.toLocaleString('vi-VN')} VNĐ
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </div>

                            {/* Lời dặn & Chữ ký số Bác sĩ */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-slate-200 text-xs">
                                <div className="space-y-1.5">
                                    <div className="font-bold text-slate-800 uppercase">Lời dặn của Bác sĩ:</div>
                                    <p className="text-slate-600 bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl leading-relaxed">
                                        {prescriptionNote ||
                                            encounter?.loi_dan_bac_si ||
                                            'Uống thuốc đúng giờ theo chỉ dẫn. Nếu có biểu hiện dị ứng (nổi mẩn, khó thở) cần ngưng thuốc và đến cơ sở y tế gần nhất.'}
                                    </p>
                                    {encounter?.ngay_hen_tai_kham && (
                                        <div className="flex items-center gap-1.5 font-bold text-teal-700 pt-1">
                                            <CalendarCheck size={16} weight="bold" />
                                            <span>Hẹn tái khám: {encounter.ngay_hen_tai_kham}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="text-center md:text-right flex flex-col items-center md:items-end justify-between">
                                    <div>
                                        <div className="italic text-slate-500">
                                            Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm{' '}
                                            {new Date().getFullYear()}
                                        </div>
                                        <div className="font-bold uppercase text-slate-800 mt-1">
                                            Bác sĩ khám bệnh
                                        </div>
                                    </div>

                                    <div className="my-3 px-4 py-2 rounded-xl border-2 border-dashed border-emerald-600 bg-emerald-50/70 text-emerald-800 inline-flex items-center gap-2">
                                        <CheckCircle size={20} weight="fill" className="text-emerald-600" />
                                        <div className="text-left">
                                            <div className="text-[10px] font-bold uppercase">
                                                ĐÃ XÁC THỰC CHỮ KÝ SỐ Y TẾ
                                            </div>
                                            <div className="text-xs font-extrabold">{doctorName}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'templates' ? (
                        /* Tab: Danh mục Toa Mẫu có Kiểm Soát (Lát cắt E) */
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
                                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
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
                                                                <td className="py-2 px-3 text-teal-700 font-medium">
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
                        /* Tab: Sao chép đơn thuốc cũ */
                        <div className="space-y-4 max-w-3xl mx-auto">
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Stethoscope size={24} className="text-amber-700" weight="duotone" />
                                    <div>
                                        <h4 className="text-sm font-bold text-amber-950">
                                            Lịch sử Đơn thuốc cũ của bệnh nhân: {patientName}
                                        </h4>
                                        <p className="text-xs text-amber-800">
                                            Bác sĩ có thể xem lại các đơn thuốc lần trước và bấm &ldquo;Sao chép vào ca
                                             khám hiện tại&rdquo; để kế thừa điều trị dài hạn.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {SAMPLE_OLD_PRESCRIPTIONS.map((oldRx) => (
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
                                                                {med.ten_thuoc} ({med.ham_luong})
                                                            </td>
                                                            <td className="py-2 px-3 text-teal-700 font-medium">
                                                                {med.lieu_dung}
                                                            </td>
                                                            <td className="py-2 px-3 text-center font-bold">
                                                                {med.so_luong} {med.don_vi_tinh}
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

                {/* Footer Actions */}
                <div className="bg-white border-t border-slate-200 px-6 py-3.5 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                        Mã định danh đơn thuốc quốc gia: <strong>{rxCode}-VN</strong>
                    </span>
                    <div className="flex items-center gap-2.5">
                        {activeTab === 'print' && (
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                            >
                                <Printer size={16} weight="bold" />
                                In Đơn Thuốc Ngay (A4 / A5)
                            </button>
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
