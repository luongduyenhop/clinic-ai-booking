import { useState } from 'react'
import {
    QrCode,
    Copy,
    Check,
    X,
    ShieldCheck,
    Bank,
    CurrencyCircleDollar,
} from '@phosphor-icons/react'
import { AppToast } from './AppNotification'

/**
 * Modal hiển thị mã VietQR thanh toán viện phí
 * - Thông tin tài khoản đồng bộ từ cấu hình hệ thống ngân hàng phòng khám.
 * - Số tiền và mã nội dung chuyển khoản gắn chặt với Hóa đơn viện phí (CLINIC HD {id} {ma_bn}).
 * - Hỗ trợ Thu ngân kiểm tra sao kê và Xác nhận Đã thu tiền (Gạch nợ hóa đơn) trực tiếp.
 */
export default function VietQrModal({
    isOpen,
    onClose,
    onConfirmPayment,
    invoice = {},
    bankBin = '970422', // MBBank
    bankName = 'MBBank (Ngân hàng TMCP Quân Đội)',
    accountNumber = '0901234567',
    accountName = 'PHONG KHAM CLINIC AI',
}) {
    const [copiedContent, setCopiedContent] = useState(false)
    const [copiedAccount, setCopiedAccount] = useState(false)
    const [isConfirming, setIsConfirming] = useState(false)

    if (!isOpen) return null

    const invoiceId = invoice.id || invoice.ma_hoa_don || invoice.maPhieu || '001'
    const patientCode = invoice.ma_benh_nhan || invoice.maBN || 'BN'
    const patientName = invoice.ten_benh_nhan || invoice.hoTenBN || invoice.benh_nhan?.ho_ten || 'Người bệnh'
    const amount = Number(invoice.thuc_thu || invoice.tong_tien || invoice.tongTien || 0)

    // Nội dung chuyển khoản chuẩn theo mã hóa đơn lưu trữ tại backend
    const transferContent = `CLINIC HD ${invoiceId} ${patientCode}`.toUpperCase().replace(/[^A-Z0-9 ]/g, '')

    // URL ảnh VietQR chuẩn NAPAS 247 QuickLink
    const qrImageUrl = `https://img.vietqr.io/image/${bankBin}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(
        transferContent
    )}&accountName=${encodeURIComponent(accountName)}`

    const handleCopy = async (text, type) => {
        try {
            await navigator.clipboard.writeText(text)
            if (type === 'content') {
                setCopiedContent(true)
                setTimeout(() => setCopiedContent(false), 2000)
                AppToast.success('Đã sao chép nội dung chuyển khoản!')
            } else {
                setCopiedAccount(true)
                setTimeout(() => setCopiedAccount(false), 2000)
                AppToast.success('Đã sao chép số tài khoản!')
            }
        } catch {
            AppToast.error('Không thể tự động sao chép. Vui lòng copy thủ công.')
        }
    }

    const handleConfirm = async () => {
        if (!onConfirmPayment) {
            AppToast.success('Đã đối soát thông tin chuyển khoản thành công!')
            onClose()
            return
        }
        setIsConfirming(true)
        try {
            await onConfirmPayment(invoice)
            AppToast.success(`Hóa đơn #${invoiceId} đã được xác nhận thanh toán thành công!`)
            onClose()
        } catch (err) {
            AppToast.error(err?.message || 'Không thể xác nhận thanh toán. Vui lòng thử lại.')
        } finally {
            setIsConfirming(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#003553] via-[#004A73] to-[#00B5F1] p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-teal-300">
                            <QrCode size={24} weight="bold" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-extrabold tracking-tight">CỔNG THANH TOÁN VIETQR</h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-400 text-slate-950">
                                    NAPAS 247
                                </span>
                            </div>
                            <p className="text-xs text-sky-100">Chuyển khoản liên ngân hàng 24/7 an toàn &amp; tức thì</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
                    >
                        <X size={18} weight="bold" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto space-y-4">
                    {/* Hướng dẫn đối soát viện phí */}
                    <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200/90 text-sky-950 text-xs flex items-start gap-3">
                        <ShieldCheck size={22} weight="fill" className="text-[#00B5F1] shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <div className="font-bold text-[#003553]">
                                QUY TRÌNH THANH TOÁN &amp; ĐỐI SOÁT VIỆN PHÍ
                            </div>
                            <p className="leading-relaxed text-slate-600">
                                Quét mã bằng ứng dụng ngân hàng bất kỳ. Thu ngân đối soát giao dịch thực nhận trên biến động số dư hoặc sao kê trước khi xác nhận biên lai thu viện phí.
                            </p>
                        </div>
                    </div>

                    {/* QR Code Container */}
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                            <img
                                src={qrImageUrl}
                                alt={`VietQR thanh toán hóa đơn #${invoiceId}`}
                                className="w-56 h-56 object-contain rounded-lg"
                                loading="lazy"
                            />
                        </div>
                        <div className="mt-3 text-center">
                            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Số tiền cần thanh toán</div>
                            <div className="text-2xl font-black text-rose-600 font-mono mt-0.5">
                                {amount.toLocaleString('vi-VN')} đ
                            </div>
                        </div>
                    </div>

                    {/* Transaction Details */}
                    <div className="space-y-2.5 text-xs">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                            <span className="text-slate-500 flex items-center gap-1.5">
                                <Bank size={15} className="text-[#00B5F1]" />
                                Ngân hàng thụ hưởng:
                            </span>
                            <span className="font-bold text-slate-800">{bankName}</span>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                            <span className="text-slate-500">Chủ tài khoản:</span>
                            <span className="font-bold text-slate-900 font-mono">{accountName}</span>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                            <span className="text-slate-500">Số tài khoản:</span>
                            <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-[#003553] text-sm">{accountNumber}</span>
                                <button
                                    type="button"
                                    onClick={() => handleCopy(accountNumber, 'account')}
                                    className="p-1 rounded-md hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                                    title="Sao chép số tài khoản"
                                >
                                    {copiedAccount ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-sky-50 border border-sky-200/80">
                            <div>
                                <span className="text-sky-800 font-semibold block">Nội dung chuyển khoản (bắt buộc):</span>
                                <span className="font-mono font-black text-sky-950 text-sm">{transferContent}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleCopy(transferContent, 'content')}
                                className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                            >
                                {copiedContent ? <Check size={14} /> : <Copy size={14} />}
                                <span>{copiedContent ? 'Đã chép' : 'Sao chép'}</span>
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                            <span className="text-slate-500">Hóa đơn / Người bệnh:</span>
                            <span className="font-semibold text-slate-700">
                                #{invoiceId} &bull; {patientName} ({patientCode})
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-200/60 text-slate-700 font-semibold text-xs transition cursor-pointer"
                    >
                        Đóng cửa sổ
                    </button>
                    <button
                        type="button"
                        disabled={isConfirming}
                        onClick={handleConfirm}
                        className="px-4.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50"
                    >
                        <Check size={16} weight="bold" />
                        <span>{isConfirming ? 'Đang xác nhận...' : 'Xác nhận Đã nhận tiền (Gạch nợ)'}</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
