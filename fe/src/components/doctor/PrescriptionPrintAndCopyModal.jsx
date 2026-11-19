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
    const [showPriceOnPrint, setShowPriceOnPrint] = useState(false)
    const [paperSize, setPaperSize] = useState('a4')

    if (!isOpen) return null

    const rxCode = `RX-${encounter?.id || 9102}-${new Date().getFullYear()}`
    const patientName = patient?.ho_ten || encounter?.ten_benh_nhan || 'Nguyễn Văn Bệnh Nhân'
    const patientDob = patient?.ngay_sinh || encounter?.ngay_sinh || '15/05/1990'
    const patientGender = patient?.gioi_tinh || encounter?.gioi_tinh || 'Nam'
    const patientPhone = patient?.so_dien_thoai || encounter?.so_dien_thoai || '0901 234 567'
    const patientCode = patient?.ma || encounter?.ma_benh_nhan || `BN-${encounter?.id || '2026'}`
    const doctorName = encounter?.ten_bac_si || 'BS.CKI Nguyễn Văn An'

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
            `Mã hồ sơ: #${encounter?.id || 9102} | Mã ĐT: ${rxCode}`,
            `Bệnh nhân: ${patientName} (${patientGender}, ${patientDob})`,
            `Mã y tế: ${patientCode}`,
            `Ngày khám: ${new Date().toLocaleDateString('vi-VN')} | Bác sĩ: ${doctorName}`,
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
            AppToast.success('Đã sao chép tóm tắt đơn thuốc vào bộ nhớ tạm! Bạn có thể dán vào Zalo/SMS để gửi.')
        } catch (e) {
            console.error('Clipboard copy error:', e)
            AppToast.error('Không thể truy cập Clipboard trình duyệt. Vui lòng thử lại.')
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-clinic-navy/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-clinic-surface rounded-[6px] border border-clinic-border w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
                <div className="bg-clinic-navy text-clinic-surface px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Pill size={22} className="text-clinic-cyan" weight="duotone" />
                        <div>
                            <h3 className="text-base font-extrabold">
                                Quản lý phiếu in đơn thuốc, toa mẫu &amp; sao chép
                            </h3>
                            <p className="text-xs text-clinic-on-navy-muted">
                                Chuẩn TT 52/2017 &amp; TT 32/2023/TT-BYT
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('print')}
                            className={`px-3 py-1.5 rounded-[6px] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer tabular-nums ${
                                activeTab === 'print'
                                    ? 'bg-clinic-cta text-clinic-surface'
                                    : 'bg-clinic-navy-dark text-clinic-on-navy-muted hover:text-clinic-surface'
                            }`}
                        >
                            <Printer size={15} weight="bold" />
                            <span>Phiếu in ({prescriptionItems.length})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('templates')}
                            className={`px-3 py-1.5 rounded-[6px] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                activeTab === 'templates'
                                    ? 'bg-clinic-cta text-clinic-surface'
                                    : 'bg-clinic-navy-dark text-clinic-on-navy-muted hover:text-clinic-surface'
                            }`}
                        >
                            <BookmarkSimple size={15} weight="bold" />
                            <span>Phác đồ mẫu</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('copy')}
                            className={`px-3 py-1.5 rounded-[6px] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                activeTab === 'copy'
                                    ? 'bg-clinic-amber text-clinic-navy'
                                    : 'bg-clinic-navy-dark text-clinic-on-navy-muted hover:text-clinic-surface'
                            }`}
                        >
                            <ClockCounterClockwise size={15} weight="bold" />
                            <span>Đơn cũ</span>
                        </button>
                        <button
                            type="button"
                            aria-label="Đóng hộp thoại"
                            onClick={onClose}
                            className="p-2 rounded-[6px] bg-clinic-navy-dark hover:bg-clinic-danger-solid text-clinic-on-navy-muted hover:text-clinic-surface transition cursor-pointer ml-1"
                        >
                            <X size={16} weight="bold" />
                        </button>
                    </div>
                </div>

                <div className="bg-clinic-bg border-b border-clinic-border px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-4">
                        {activeTab === 'print' && (
                            <div className="flex items-center gap-1 bg-clinic-surface p-0.5 rounded-[6px] border border-clinic-border">
                                <button
                                    type="button"
                                    onClick={() => setPaperSize('a4')}
                                    className={`px-2.5 py-1 rounded-[4px] text-xs font-bold transition cursor-pointer ${
                                        paperSize === 'a4' ? 'bg-clinic-cta text-clinic-surface' : 'text-clinic-text-secondary hover:text-clinic-navy'
                                    }`}
                                >
                                    Khổ A4 / A5 (Laser)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaperSize('k80')}
                                    className={`px-2.5 py-1 rounded-[4px] text-xs font-bold transition cursor-pointer ${
                                        paperSize === 'k80' ? 'bg-clinic-cta text-clinic-surface' : 'text-clinic-text-secondary hover:text-clinic-navy'
                                    }`}
                                >
                                    In nhiệt K80 (Bill)
                                </button>
                            </div>
                        )}

                        {activeTab === 'print' && (
                            <label className="flex items-center gap-2 cursor-pointer font-semibold text-clinic-navy select-none">
                                <input
                                    type="checkbox"
                                    checked={showPriceOnPrint}
                                    onChange={(e) => setShowPriceOnPrint(e.target.checked)}
                                    className="w-4 h-4 rounded-[4px] border-clinic-border-strong cursor-pointer"
                                />
                                <span className="flex items-center gap-1">
                                    <CurrencyCircleDollar size={16} className="text-clinic-cta" weight="bold" />
                                    In kèm đơn giá &amp; thành tiền
                                </span>
                            </label>
                        )}
                        {activeTab === 'print' && (
                            <span className="text-[11px] text-clinic-text-secondary">
                                ({showPriceOnPrint ? 'Hiển thị giá tiền để thu ngân tính phí' : 'Ẩn giá tiền theo chuẩn đơn ngoại trú mang ngoài'})
                            </span>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleCopySummaryText}
                        className="medpro-btn-primary px-3.5 py-1.5 rounded-[6px] font-bold flex items-center gap-1.5 cursor-pointer"
                        title="Sao chép toàn bộ tóm tắt đơn thuốc sang định dạng văn bản để gửi Zalo / SMS cho người bệnh"
                    >
                        <ChatText size={15} weight="bold" />
                        <span>Sao chép Text (Zalo / SMS)</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-clinic-bg-muted">
                    {activeTab === 'print' ? (
                        <div className={`bg-clinic-surface border border-clinic-border-strong rounded-[6px] p-8 mx-auto text-clinic-text print:border-none print:p-0 ${paperSize === 'k80' ? 'max-w-md' : 'max-w-3xl'}`}>
                            <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-clinic-navy pb-4 mb-5">
                                <div>
                                    <div className="text-xs font-bold uppercase text-clinic-cta">
                                        SỞ Y TẾ TP. HỒ CHÍ MINH
                                    </div>
                                    <div className="text-lg font-black uppercase text-clinic-navy">
                                        PHÒNG KHÁM ĐA KHOA THÔNG MINH CLINIC-AI
                                    </div>
                                    <div className="text-xs text-clinic-text-secondary mt-0.5 tabular-nums">
                                        Địa chỉ: Khu Công Nghệ Cao, TP. Thủ Đức | Hotline: 1900 6868
                                    </div>
                                </div>

                                <div className="text-right flex items-center gap-3">
                                    <div className="border border-clinic-border rounded-[6px] p-2 bg-clinic-bg text-center">
                                        <Barcode size={34} className="mx-auto text-clinic-navy" />
                                        <div className="text-[10px] font-mono font-bold text-clinic-navy mt-0.5 tabular-nums">
                                            {rxCode}
                                        </div>
                                    </div>
                                    <div className="border border-clinic-border rounded-[6px] p-2 bg-clinic-bg text-center">
                                        <QrCode size={40} className="mx-auto text-clinic-cta" />
                                        <div className="text-[9px] font-mono text-clinic-text-secondary">QR Đơn Thuốc</div>
                                    </div>
                                </div>
                            </div>

                            <div className="text-center mb-5">
                                <h2 className="text-xl font-black uppercase text-clinic-navy">
                                    ĐƠN THUỐC NGOẠI TRÚ ĐIỆN TỬ
                                </h2>
                                <p className="text-xs text-clinic-text-secondary font-medium mt-0.5 tabular-nums">
                                    Mã hồ sơ lượt khám: #{encounter?.id || 9102} — Ngày kê:{' '}
                                    {new Date().toLocaleDateString('vi-VN')}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-clinic-bg p-4 rounded-[6px] border border-clinic-border text-xs mb-5 tabular-nums">
                                <div>
                                    <span className="text-clinic-text-secondary">Họ và tên bệnh nhân:</span>{' '}
                                    <strong className="text-sm uppercase text-clinic-navy">{patientName}</strong>
                                </div>
                                <div>
                                    <span className="text-clinic-text-secondary">Mã định danh y tế:</span>{' '}
                                    <strong className="font-mono text-clinic-cta">{patientCode}</strong>
                                </div>
                                <div>
                                    <span className="text-clinic-text-secondary">Ngày sinh / Giới tính:</span>{' '}
                                    <strong className="text-clinic-navy">
                                        {patientDob} ({patientGender})
                                    </strong>
                                </div>
                                <div>
                                    <span className="text-clinic-text-secondary">Số điện thoại:</span>{' '}
                                    <strong className="text-clinic-navy">{patientPhone}</strong>
                                </div>
                                <div className="md:col-span-2 pt-1.5 border-t border-clinic-border">
                                    <span className="text-clinic-text-secondary">Chẩn đoán y khoa (ICD-10):</span>{' '}
                                    <strong className="text-clinic-navy">
                                        {diagnoses.length > 0
                                            ? diagnoses
                                                  .map((d) => `${d.ma_icd10} - ${d.ten_benh_chan_doan}`)
                                                  .join('; ')
                                            : 'J02.9 - Viêm họng cấp không đặc hiệu'}
                                    </strong>
                                </div>
                            </div>

                            <div className="mb-5">
                                <h4 className="text-xs font-extrabold text-clinic-navy mb-2 tabular-nums">
                                    Danh mục thuốc chỉ định điều trị ({prescriptionItems.length} khoản)
                                </h4>
                                <div className="overflow-x-auto border border-clinic-border-strong rounded-[6px]">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-clinic-bg border-b border-clinic-border-strong text-clinic-navy font-bold">
                                                <th className="py-2.5 px-3 w-10 text-center">STT</th>
                                                <th className="py-2.5 px-3">Tên thuốc / Hoạt chất / Hàm lượng</th>
                                                <th className="py-2.5 px-3 text-center">Liều dùng &amp; Cách uống</th>
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
                                        <tbody className="divide-y divide-clinic-border">
                                            {prescriptionItems.length > 0 ? (
                                                prescriptionItems.map((item, idx) => {
                                                    const qty = Number(item.so_luong) || 1
                                                    const price = Number(item.don_gia) || 15000
                                                    const lineTotal = qty * price
                                                    return (
                                                        <tr key={idx} className="hover:bg-clinic-bg">
                                                            <td className="py-3 px-3 text-center font-bold text-clinic-text-secondary tabular-nums">
                                                                {idx + 1}
                                                            </td>
                                                            <td className="py-3 px-3">
                                                                <div className="font-bold text-clinic-navy text-sm">
                                                                    {item.ten_thuoc}
                                                                </div>
                                                                <div className="text-[11px] text-clinic-text-secondary">
                                                                    Hoạt chất: {item.hoat_chat || 'Theo danh mục'} | Hàm
                                                                    lượng: {item.ham_luong || 'Chuẩn'} | Đường dùng:{' '}
                                                                    {item.duong_dung || 'Uống'}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-3 text-center tabular-nums">
                                                                <div className="font-bold text-clinic-navy text-xs">
                                                                    {item.lieu_dung
                                                                        ? item.lieu_dung
                                                                        : [
                                                                              item.sang && Number(item.sang) > 0 ? `Sáng: ${mVal(item.sang)}` : '',
                                                                              item.trua && Number(item.trua) > 0 ? `Trưa: ${mVal(item.trua)}` : '',
                                                                              item.chieu && Number(item.chieu) > 0 ? `Chiều: ${mVal(item.chieu)}` : '',
                                                                              item.toi && Number(item.toi) > 0 ? `Tối: ${mVal(item.toi)}` : '',
                                                                          ]
                                                                              .filter(Boolean)
                                                                              .join(' · ') || 'Theo chỉ dẫn'}
                                                                </div>
                                                                <div className="text-[11px] text-clinic-text-secondary mt-0.5">
                                                                    {item.cach_dung || 'Uống sau ăn no'}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-3 text-center font-semibold tabular-nums">
                                                                {item.thoi_gian_dung_ngay || item.so_ngay_dung || 5} ngày
                                                            </td>
                                                            <td className="py-3 px-3 text-center font-black text-sm text-clinic-navy tabular-nums">
                                                                {item.so_luong || 10} {item.don_vi_tinh || 'Viên'}
                                                            </td>
                                                            {showPriceOnPrint && (
                                                                <td className="py-3 px-3 text-right font-medium text-clinic-text-secondary tabular-nums">
                                                                    {price.toLocaleString('vi-VN')} đ
                                                                </td>
                                                            )}
                                                            {showPriceOnPrint && (
                                                                <td className="py-3 px-3 text-right font-bold text-clinic-navy tabular-nums">
                                                                    {lineTotal.toLocaleString('vi-VN')} đ
                                                                </td>
                                                            )}
                                                        </tr>
                                                    )
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={showPriceOnPrint ? 7 : 5} className="py-6 text-center text-clinic-text-secondary">
                                                        Chưa có thuốc trong đơn. Bạn có thể thêm thuốc hoặc bấm tab
                                                        &ldquo;Phác đồ mẫu&rdquo; / &ldquo;Đơn cũ&rdquo;.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        {showPriceOnPrint && prescriptionItems.length > 0 && (
                                            <tfoot>
                                                <tr className="bg-clinic-bg border-t-2 border-clinic-border-strong font-bold tabular-nums">
                                                    <td colSpan={6} className="py-2.5 px-3 text-right uppercase text-clinic-navy">
                                                        Tổng tiền thuốc ước tính:
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right text-sm font-black text-clinic-cta">
                                                        {estimatedTotal.toLocaleString('vi-VN')} VNĐ
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-clinic-border text-xs">
                                <div className="space-y-1.5">
                                    <div className="font-bold text-clinic-navy">Lời dặn của Bác sĩ:</div>
                                    <p className="text-clinic-warning bg-clinic-warning-bg border border-clinic-warning-border p-3 rounded-[6px] leading-relaxed">
                                        {prescriptionNote ||
                                            encounter?.loi_dan_bac_si ||
                                            'Uống thuốc đúng giờ theo chỉ dẫn. Nếu có biểu hiện dị ứng (nổi mẩn, khó thở) cần ngưng thuốc và đến cơ sở y tế gần nhất.'}
                                    </p>
                                    {encounter?.ngay_hen_tai_kham && (
                                        <div className="flex items-center gap-1.5 font-bold text-clinic-cta pt-1 tabular-nums">
                                            <CalendarCheck size={16} weight="bold" />
                                            <span>Hẹn tái khám: {encounter.ngay_hen_tai_kham}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="text-center md:text-right flex flex-col items-center md:items-end justify-between">
                                    <div className="tabular-nums">
                                        <div className="text-clinic-text-secondary">
                                            Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm{' '}
                                            {new Date().getFullYear()}
                                        </div>
                                        <div className="font-bold text-clinic-navy mt-1">
                                            Bác sĩ khám bệnh
                                        </div>
                                    </div>

                                    <div className="my-2.5 px-3.5 py-2 rounded-[6px] border border-dashed border-clinic-success-border bg-clinic-success-bg text-clinic-success inline-flex items-center gap-2 text-left">
                                        <CheckCircle size={20} weight="fill" className="text-clinic-success shrink-0" />
                                        <div>
                                            <div className="text-[10px] font-extrabold text-clinic-success">
                                                CHỨNG THƯ SỐ Y TẾ HỢP LỆ (TT 04/2022/TT-BYT)
                                            </div>
                                            <div className="text-xs font-black text-clinic-navy">{doctorName}</div>
                                            <div className="text-[10px] text-clinic-success font-mono tabular-nums">
                                                Ký lúc: {encounter?.ngay_ky || encounter?.don_thuoc?.ngay_ky ? new Date(encounter?.ngay_ky || encounter?.don_thuoc?.ngay_ky).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'templates' ? (
                        <div className="space-y-4 max-w-3xl mx-auto">
                            <div className="bg-clinic-surface-alt border border-clinic-info-border rounded-[6px] p-4 flex items-start gap-3">
                                <WarningCircle size={22} className="text-clinic-cta shrink-0 mt-0.5" weight="fill" />
                                <div className="text-xs text-clinic-navy leading-relaxed">
                                    <p className="font-bold">
                                        HƯỚNG DẪN LÂM SÀNG &amp; AN TOÀN SỬ DỤNG THUỐC
                                    </p>
                                    <p className="mt-1 text-clinic-text-secondary">
                                        Các toa thuốc mẫu dưới đây chỉ mang tính chất minh họa cấu trúc kê đơn từ tài liệu thực hành lâm sàng, <strong>chưa được Hội đồng Y khoa phòng khám phê duyệt làm phác đồ áp dụng bắt buộc</strong>. Khi nạp vào đơn thuốc, bác sĩ bắt buộc phải kiểm tra lại thể trạng, tiền sử dị ứng, chức năng gan thận của người bệnh trước khi quyết định ký ban hành.
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-4">
                                {SAMPLE_PRESCRIPTION_TEMPLATES.map((tmpl) => (
                                    <div
                                        key={tmpl.id}
                                        className="bg-clinic-surface rounded-[6px] border border-clinic-border overflow-hidden hover:border-clinic-cta transition"
                                    >
                                        <div className="bg-clinic-bg px-5 py-3 border-b border-clinic-border flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <span className="px-2 py-0.5 rounded-[4px] bg-clinic-navy text-clinic-surface text-xs font-mono font-bold mr-2 tabular-nums">
                                                    {tmpl.id}
                                                </span>
                                                <span className="text-sm font-bold text-clinic-navy">
                                                    {tmpl.name}
                                                </span>
                                                <span className="text-xs text-clinic-cta font-semibold ml-2">
                                                    · {tmpl.category}
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleApplyTemplate(tmpl)}
                                                className="medpro-btn-primary px-3.5 py-1.5 rounded-[6px] text-xs font-bold flex items-center gap-1.5 cursor-pointer tabular-nums"
                                            >
                                                <BookmarkSimple size={14} weight="bold" />
                                                <span>Nạp vào đơn nháp ({tmpl.items.length} thuốc)</span>
                                            </button>
                                        </div>

                                        <div className="p-4 space-y-3 text-xs">
                                            <p className="text-clinic-text-secondary bg-clinic-bg p-2.5 rounded-[6px] border border-clinic-border">
                                                Lời dặn mẫu: {tmpl.notes}
                                            </p>

                                            <div className="border border-clinic-border rounded-[6px] overflow-hidden">
                                                <table className="w-full text-left border-collapse text-xs">
                                                    <thead>
                                                        <tr className="bg-clinic-bg border-b border-clinic-border text-clinic-navy font-semibold">
                                                            <th className="py-2 px-3">#</th>
                                                            <th className="py-2 px-3">Tên thuốc &amp; Hoạt chất</th>
                                                            <th className="py-2 px-3">Liều dùng đề xuất</th>
                                                            <th className="py-2 px-3 text-center">Thời gian</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-clinic-border">
                                                        {tmpl.items.map((med, mIdx) => (
                                                            <tr key={mIdx}>
                                                                <td className="py-2 px-3 font-bold text-clinic-text-secondary tabular-nums">
                                                                    {mIdx + 1}
                                                                </td>
                                                                <td className="py-2 px-3 font-bold text-clinic-navy">
                                                                    {med.ten_thuoc}
                                                                    <div className="text-[11px] text-clinic-text-secondary font-normal">
                                                                        {med.hoat_chat} ({med.ham_luong})
                                                                    </div>
                                                                </td>
                                                                <td className="py-2 px-3 text-clinic-cta font-medium tabular-nums">
                                                                    Sáng {med.sang || 0} - Trưa {med.trua || 0} - Chiều {med.chieu || 0} - Tối {med.toi || 0}
                                                                    <div className="text-[11px] text-clinic-text-secondary">
                                                                        {med.cach_dung}
                                                                    </div>
                                                                </td>
                                                                <td className="py-2 px-3 text-center font-bold text-clinic-navy tabular-nums">
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
                            <div className="bg-clinic-warning-bg border border-clinic-warning-border rounded-[6px] p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Stethoscope size={22} className="text-clinic-warning" weight="duotone" />
                                    <div>
                                        <h4 className="text-sm font-bold text-clinic-navy">
                                            Lịch sử Đơn thuốc cũ của bệnh nhân: {patientName}
                                        </h4>
                                        <p className="text-xs text-clinic-text-secondary">
                                            Bác sĩ có thể xem lại các đơn thuốc lần trước và bấm &ldquo;Sao chép đơn thuốc này&rdquo; để kế thừa điều trị dài hạn.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {SAMPLE_OLD_PRESCRIPTIONS.map((oldRx) => (
                                <div
                                    key={oldRx.id}
                                    className="bg-clinic-surface rounded-[6px] border border-clinic-border overflow-hidden"
                                >
                                    <div className="bg-clinic-bg px-5 py-3 border-b border-clinic-border flex flex-wrap items-center justify-between gap-2">
                                        <div className="tabular-nums">
                                            <span className="px-2 py-0.5 rounded-[4px] bg-clinic-navy text-clinic-surface text-xs font-mono font-bold mr-2">
                                                Đơn #{oldRx.id}
                                            </span>
                                            <span className="text-sm font-bold text-clinic-navy">
                                                Ngày kê: {oldRx.ngay_ke}
                                            </span>
                                            <span className="text-xs text-clinic-text-secondary ml-2">({oldRx.bac_si})</span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleCopyOld(oldRx)}
                                            className="medpro-btn-primary px-3.5 py-1.5 rounded-[6px] text-xs font-bold flex items-center gap-1.5 cursor-pointer tabular-nums"
                                        >
                                            <Copy size={14} weight="bold" />
                                            <span>Sao chép đơn thuốc này ({oldRx.items.length} thuốc)</span>
                                        </button>
                                    </div>

                                    <div className="p-4 space-y-3 text-xs">
                                        <div>
                                            <span className="font-semibold text-clinic-text-secondary">Chẩn đoán lần trước:</span>{' '}
                                            <strong className="text-clinic-navy">{oldRx.chan_doan}</strong>
                                        </div>

                                        <div className="border border-clinic-border rounded-[6px] overflow-hidden">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-clinic-bg border-b border-clinic-border text-clinic-navy font-semibold">
                                                        <th className="py-2 px-3">#</th>
                                                        <th className="py-2 px-3">Tên thuốc &amp; Hàm lượng</th>
                                                        <th className="py-2 px-3">Liều dùng</th>
                                                        <th className="py-2 px-3 text-center">Số lượng</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-clinic-border">
                                                    {oldRx.items.map((med, mIdx) => (
                                                        <tr key={mIdx}>
                                                            <td className="py-2 px-3 font-bold text-clinic-text-secondary tabular-nums">
                                                                {mIdx + 1}
                                                            </td>
                                                            <td className="py-2 px-3 font-bold text-clinic-navy">
                                                                {med.ten_thuoc} ({med.ham_luong})
                                                            </td>
                                                            <td className="py-2 px-3 text-clinic-cta font-medium">
                                                                {med.lieu_dung}
                                                            </td>
                                                            <td className="py-2 px-3 text-center font-bold tabular-nums">
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

                <div className="bg-clinic-surface border-t border-clinic-border px-6 py-3.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-clinic-text-secondary tabular-nums">
                        Mã định danh đơn thuốc quốc gia: <strong className="text-clinic-navy">{rxCode}-VN</strong>
                    </span>
                    <div className="flex items-center gap-2.5">
                        {activeTab === 'print' && (
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="medpro-btn-primary px-5 py-2 rounded-[6px] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                                <Printer size={15} weight="bold" />
                                <span>In đơn thuốc ngay (A4 / A5)</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="medpro-btn-outline px-4 py-2 rounded-[6px] text-xs font-semibold cursor-pointer"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function mVal(value) {
    return value
}
