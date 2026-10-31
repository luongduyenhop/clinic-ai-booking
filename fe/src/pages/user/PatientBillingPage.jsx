import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
    Receipt,
    QrCode,
    CheckCircle,
    WarningCircle,
    Printer,
    DownloadSimple,
    Copy,
    ArrowRight,
    CaretRight,
    Hospital,
    ShieldCheck,
    Clock,
    CurrencyCircleDollar
} from '../../components/common/ClinicIcon'

const MOCK_INVOICES = [
    {
        id: 'HD-2026-0042',
        maKcb: 'KCB-2026-0819-01',
        ngayLap: '2026-04-10 10:30',
        bacSi: 'BS.CKII Nguyễn Minh Hoàng',
        khoa: 'Khoa Nội Tổng Quát',
        trangThai: 'chua_thu', // 'chua_thu' | 'da_thu'
        hinhThuc: 'Chuyển khoản VietQR',
        chiTiet: [
            { ten: 'Khám chuyên khoa Nội tổng quát', loai: 'Công khám', soLuong: 1, donGia: 200000, thanhTien: 200000 },
            { ten: 'Tổng phân tích tế bào máu ngoại vi (24 thông số)', loai: 'Xét nghiệm', soLuong: 1, donGia: 120000, thanhTien: 120000 },
            { ten: 'Sinh hóa máu (Glucose, Cholesterol, Triglyceride, Creatinine)', loai: 'Xét nghiệm', soLuong: 1, donGia: 240000, thanhTien: 240000 },
            { ten: 'Điện tâm đồ (ECG 12 cần)', loai: 'Thăm dò chức năng', soLuong: 1, donGia: 90000, thanhTien: 90000 },
            { ten: 'Amlodipine 5mg (Hộp 30 viên)', loai: 'Thuốc', soLuong: 1, donGia: 85000, thanhTien: 85000 },
            { ten: 'Atorvastatin 10mg (Hộp 30 viên)', loai: 'Thuốc', soLuong: 1, donGia: 160000, thanhTien: 160000 },
            { ten: 'Ginkgo Biloba 80mg (Hộp 60 viên)', loai: 'Thuốc', soLuong: 1, donGia: 155000, thanhTien: 155000 }
        ],
        tongTien: 1050000,
        mienGiam: 50000, // Chiết khấu khách hàng thân thiết
        thucThu: 1000000
    },
    {
        id: 'HD-2026-0018',
        maKcb: 'KCB-2026-0819-00',
        ngayLap: '2026-02-15 15:10',
        bacSi: 'BS.CKI Lê Hoàng Nam',
        khoa: 'Khoa Tai Mũi Họng',
        trangThai: 'da_thu',
        hinhThuc: 'VietQR Napas 247',
        chiTiet: [
            { ten: 'Khám chuyên khoa Tai Mũi Họng', loai: 'Công khám', soLuong: 1, donGia: 180000, thanhTien: 180000 },
            { ten: 'Nội soi Tai Mũi Họng ống mềm có ghi hình', loai: 'Nội soi', soLuong: 1, donGia: 250000, thanhTien: 250000 },
            { ten: 'Cefuroxime 500mg (10 viên)', loai: 'Thuốc', soLuong: 1, donGia: 120000, thanhTien: 120000 },
            { ten: 'Paracetamol 500mg (10 viên)', loai: 'Thuốc', soLuong: 1, donGia: 25000, thanhTien: 25000 },
            { ten: 'Xịt mũi họng thảo dược (1 lọ)', loai: 'Thuốc', soLuong: 1, donGia: 75000, thanhTien: 75000 }
        ],
        tongTien: 650000,
        mienGiam: 0,
        thucThu: 650000
    }
]

export default function PatientBillingPage() {
    const [invoices, setInvoices] = useState(MOCK_INVOICES)
    const [selectedInvoiceId, setSelectedInvoiceId] = useState(MOCK_INVOICES[0].id)
    const [showQrModal, setShowQrModal] = useState(false)

    const currentInvoice = invoices.find((inv) => inv.id === selectedInvoiceId) || invoices[0]

    // Thông tin tài khoản nhận viện phí của Clinic-AI
    const BANK_INFO = {
        bankName: 'MBBank (Ngân hàng Quân Đội)',
        accountNumber: '0912345678999',
        accountName: 'PHONG KHAM CLINIC AI',
        content: `${currentInvoice.id.replace('-', '')} NGUYEN VAN AN`
    }

    const vietQrUrl = `https://img.vietqr.io/image/MB-${BANK_INFO.accountNumber}-compact2.png?amount=${currentInvoice.thucThu}&addInfo=${encodeURIComponent(BANK_INFO.content)}&accountName=${encodeURIComponent(BANK_INFO.accountName)}`

    const handleCopy = (text, label) => {
        navigator.clipboard.writeText(text)
        toast.success(`Đã sao chép ${label}`)
    }

    const handleConfirmPayment = () => {
        setInvoices((prev) =>
            prev.map((inv) => (inv.id === currentInvoice.id ? { ...inv, trangThai: 'da_thu' } : inv))
        )
        setShowQrModal(false)
        toast.success('Hệ thống đã ghi nhận thanh toán thành công qua VietQR!')
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-16">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-[#003553] via-[#004B75] to-[#0088BA] text-white py-8 px-4 sm:px-6 lg:px-8 border-b border-[#002840]">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-xs font-semibold text-[#8FE2FF] mb-2 border border-white/15">
                            <Receipt size={15} weight="duotone" />
                            <span>Viện Phí & Hóa Đơn Điện Tử</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight">
                            Tra Cứu Viện Phí & Thanh Toán VietQR
                        </h1>
                        <p className="text-sm text-cyan-100/90 mt-1">
                            Minh bạch chi phí khám chữa bệnh, hỗ trợ thanh toán tức thì chuẩn Napas 247 không cần tiền mặt.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            to="/benh-nhan/benh-an"
                            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-4 py-2.5 rounded-xl border border-white/20 transition"
                        >
                            <span>Xem sổ bệnh án</span>
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left: Invoice List */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                                <h2 className="font-bold text-[#003553] text-sm flex items-center gap-2">
                                    <Receipt size={16} className="text-[#00B5F1]" />
                                    <span>Danh sách Hóa đơn ({invoices.length})</span>
                                </h2>
                                <span className="text-[11px] font-semibold text-slate-500">Mới nhất</span>
                            </div>

                            <div className="space-y-3">
                                {invoices.map((inv) => {
                                    const isSelected = inv.id === currentInvoice.id
                                    const isPaid = inv.trangThai === 'da_thu'
                                    return (
                                        <div
                                            key={inv.id}
                                            onClick={() => setSelectedInvoiceId(inv.id)}
                                            className={`p-3.5 rounded-xl border transition cursor-pointer text-left ${
                                                isSelected
                                                    ? 'border-[#00B5F1] bg-[#F0F9FF] shadow-xs'
                                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between text-xs mb-1.5">
                                                <span className="font-mono font-bold text-[#003553]">{inv.id}</span>
                                                <span
                                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                                        isPaid
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}
                                                >
                                                    {isPaid ? 'Đã thanh toán' : 'Chờ thanh toán'}
                                                </span>
                                            </div>

                                            <div className="font-bold text-sm text-[#003553]">{inv.khoa}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">{inv.ngayLap}</div>

                                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100">
                                                <span className="text-xs text-slate-500">Thực thu:</span>
                                                <span className="text-sm font-extrabold text-[#0088BA]">
                                                    {inv.thucThu.toLocaleString('vi-VN')} đ
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Security Assurance */}
                        <div className="bg-[#E8F4FD]/60 border border-[#B8E5FA] rounded-2xl p-4 text-xs text-[#003553] space-y-2">
                            <div className="font-bold flex items-center gap-1.5 text-[#0088BA]">
                                <ShieldCheck size={16} weight="fill" />
                                <span>Bảo mật giao dịch VietQR Napas</span>
                            </div>
                            <p className="text-slate-600 leading-relaxed">
                                Mã VietQR được sinh tự động với mã giao dịch duy nhất cho từng hóa đơn. Hệ thống tự động đối soát và phát hành hóa đơn điện tử ngay khi tiền về tài khoản.
                            </p>
                        </div>
                    </div>

                    {/* Right: Invoice Breakdown & VietQR */}
                    <div className="lg:col-span-8 space-y-5">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                            {/* Invoice Header */}
                            <div className="p-6 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono font-bold bg-[#E8F4FD] text-[#007CA8] px-2.5 py-1 rounded-md border border-[#B8E5FA]">
                                            {currentInvoice.id}
                                        </span>
                                        <span className="text-xs text-slate-500">Mã KCB: {currentInvoice.maKcb}</span>
                                    </div>
                                    <h2 className="text-xl font-bold text-[#003553] mt-2">
                                        Bảng Kê Chi Phí Khám Chữa Bệnh
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Ngày lập: {currentInvoice.ngayLap} • {currentInvoice.khoa}
                                    </p>
                                </div>

                                <div className="text-right">
                                    <div className="text-xs text-slate-500">Số tiền cần thanh toán</div>
                                    <div className="text-2xl font-black text-[#0088BA] mt-0.5">
                                        {currentInvoice.thucThu.toLocaleString('vi-VN')} đ
                                    </div>
                                    <div className="mt-1">
                                        {currentInvoice.trangThai === 'da_thu' ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                                <CheckCircle size={14} weight="fill" />
                                                Đã thu viện phí
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                                                <Clock size={14} weight="bold" />
                                                Chưa thanh toán
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Itemized Table */}
                            <div className="p-6 space-y-6">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100 text-[#003553] border-b border-slate-200">
                                                <th className="p-3 font-bold">STT</th>
                                                <th className="p-3 font-bold">Nội dung chi phí / Tên dịch vụ / Thuốc</th>
                                                <th className="p-3 font-bold text-center">Phân loại</th>
                                                <th className="p-3 font-bold text-center">SL</th>
                                                <th className="p-3 font-bold text-right">Đơn giá</th>
                                                <th className="p-3 font-bold text-right">Thành tiền</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {currentInvoice.chiTiet.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/60 transition">
                                                    <td className="p-3 text-slate-500">{idx + 1}</td>
                                                    <td className="p-3 font-semibold text-[#003553]">{item.ten}</td>
                                                    <td className="p-3 text-center">
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                                                            {item.loai}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center text-slate-700">{item.soLuong}</td>
                                                    <td className="p-3 text-right text-slate-600">
                                                        {item.donGia.toLocaleString('vi-VN')} đ
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-[#003553]">
                                                        {item.thanhTien.toLocaleString('vi-VN')} đ
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Summary Calculations */}
                                <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row justify-between gap-4">
                                    <div className="text-xs text-slate-500 max-w-sm">
                                        <p>• Hóa đơn điện tử khởi tạo từ máy tính tiền kết nối cơ quan thuế theo Nghị định 123/2020/NĐ-CP.</p>
                                        <p>• Bệnh nhân có thể xuất hóa đơn VAT theo yêu cầu tại quầy thu ngân.</p>
                                    </div>

                                    <div className="w-full sm:w-72 space-y-2 text-xs">
                                        <div className="flex justify-between text-slate-600">
                                            <span>Tổng chi phí phát sinh:</span>
                                            <span className="font-semibold">{currentInvoice.tongTien.toLocaleString('vi-VN')} đ</span>
                                        </div>
                                        <div className="flex justify-between text-emerald-600">
                                            <span>Miễn giảm / Chiết khấu:</span>
                                            <span className="font-semibold">-{currentInvoice.mienGiam.toLocaleString('vi-VN')} đ</span>
                                        </div>
                                        <div className="flex justify-between text-base font-extrabold text-[#003553] pt-2 border-t border-slate-200">
                                            <span>Thực nộp:</span>
                                            <span className="text-[#0088BA]">{currentInvoice.thucThu.toLocaleString('vi-VN')} đ</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                                    <button
                                        onClick={() => window.print()}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                                    >
                                        <Printer size={16} />
                                        <span>In bảng kê chi phí</span>
                                    </button>

                                    {currentInvoice.trangThai === 'chua_thu' ? (
                                        <button
                                            onClick={() => setShowQrModal(true)}
                                            className="inline-flex items-center gap-2 bg-[#00B5F1] hover:bg-[#009fd4] text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md transition cursor-pointer"
                                        >
                                            <QrCode size={18} weight="bold" />
                                            <span>Thanh toán ngay bằng VietQR</span>
                                        </button>
                                    ) : (
                                        <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200">
                                            <CheckCircle size={16} weight="fill" />
                                            <span>Biên lai điện tử đã hoàn tất</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Thanh toán VietQR Napas 247 */}
            {showQrModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                        <div className="text-center space-y-1 pb-4 border-b border-slate-100">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                                <QrCode size={14} weight="bold" />
                                Chuẩn VietQR • Napas 247
                            </span>
                            <h3 className="text-lg font-extrabold text-[#003553] pt-1">
                                Quét Mã Để Thanh Toán Viện Phí
                            </h3>
                            <p className="text-xs text-slate-500">
                                Mở app Ngân hàng (VCB, MB, Techcombank, VPBank...) hoặc MoMo/VNPay để quét
                            </p>
                        </div>

                        {/* QR Code Container */}
                        <div className="my-5 flex flex-col items-center">
                            <div className="p-3 bg-white rounded-2xl border-2 border-[#00B5F1]/30 shadow-md">
                                <img
                                    src={vietQrUrl}
                                    alt="VietQR Code"
                                    className="w-56 h-56 object-contain rounded-xl"
                                />
                            </div>
                            <div className="mt-3 text-center">
                                <div className="text-xs text-slate-500">Số tiền thanh toán:</div>
                                <div className="text-2xl font-black text-[#0088BA]">
                                    {currentInvoice.thucThu.toLocaleString('vi-VN')} đ
                                </div>
                            </div>
                        </div>

                        {/* Account Details Box */}
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Ngân hàng:</span>
                                <strong className="text-[#003553]">{BANK_INFO.bankName}</strong>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Số tài khoản:</span>
                                <div className="flex items-center gap-1.5">
                                    <strong className="font-mono text-[#0088BA] font-bold">{BANK_INFO.accountNumber}</strong>
                                    <button
                                        onClick={() => handleCopy(BANK_INFO.accountNumber, 'Số tài khoản')}
                                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                        title="Sao chép"
                                    >
                                        <Copy size={13} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Chủ tài khoản:</span>
                                <strong className="text-[#003553]">{BANK_INFO.accountName}</strong>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Nội dung chuyển khoản:</span>
                                <div className="flex items-center gap-1.5">
                                    <strong className="font-mono text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                        {BANK_INFO.content}
                                    </strong>
                                    <button
                                        onClick={() => handleCopy(BANK_INFO.content, 'Nội dung')}
                                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                        title="Sao chép"
                                    >
                                        <Copy size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="mt-5 flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => setShowQrModal(false)}
                                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                                Đóng lại
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmPayment}
                                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition flex items-center gap-1.5 cursor-pointer"
                            >
                                <CheckCircle size={15} weight="bold" />
                                <span>Xác nhận đã chuyển khoản</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
