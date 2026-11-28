import { useEffect, useState } from 'react'
import {
    QrCode,
    Copy,
    Check,
    X,
    Bank,
    Lightning,
    Printer,
} from '@phosphor-icons/react'
import { AppToast } from './AppNotification'
import { cashierService } from '../../services/cashierService'
import { resolveInvoicePayableAmount } from '../../utils/helpers/cashierInvoiceHelpers'

const DEFAULT_BANK_BIN = import.meta.env.VITE_SEPAY_BANK_BIN || '970422'
const DEFAULT_BANK_NAME = import.meta.env.VITE_SEPAY_BANK_NAME || 'MBBank (Ngân hàng TMCP Quân Đội)'
const DEFAULT_ACCOUNT_NUMBER = import.meta.env.VITE_SEPAY_ACCOUNT_NUMBER || '0901234567'
const DEFAULT_ACCOUNT_NAME = import.meta.env.VITE_SEPAY_ACCOUNT_NAME || 'PHONG KHAM CLINIC AI'

function resolveSepayBankCode(bankName) {
    const normalized = String(bankName || '').toLowerCase()
    if (normalized.includes('vietcombank') || normalized.includes('vcb')) return 'Vietcombank'
    if (normalized.includes('techcombank') || normalized.includes('tcb')) return 'Techcombank'
    if (normalized.includes('vietinbank') || normalized.includes('ctg')) return 'VietinBank'
    if (normalized.includes('bidv')) return 'BIDV'
    if (normalized.includes('acb')) return 'ACB'
    if (normalized.includes('tpbank')) return 'TPBank'
    if (normalized.includes('vpbank')) return 'VPBank'
    return 'MBBank'
}

export default function VietQrModal({
    isOpen,
    onClose,
    onConfirmPayment,
    invoice = {},
    bankBin = DEFAULT_BANK_BIN,
    bankName = DEFAULT_BANK_NAME,
    accountNumber = DEFAULT_ACCOUNT_NUMBER,
    accountName = DEFAULT_ACCOUNT_NAME,
}) {
    const [copiedContent, setCopiedContent] = useState(false)
    const [copiedAccount, setCopiedAccount] = useState(false)
    const [isConfirming, setIsConfirming] = useState(false)
    const [qrProvider, setQrProvider] = useState('SEPAY')

    const invoiceId = invoice.id || invoice.ma_hoa_don || invoice.maPhieu || '001'
    const patientCode = invoice.ma_benh_nhan || invoice.maBN || 'BN'
    const patientName = invoice.ten_benh_nhan || invoice.hoTenBN || invoice.benh_nhan?.ho_ten || 'Người bệnh'
    const amount = resolveInvoicePayableAmount(invoice)

    const transferContent = `CLINIC HD ${invoiceId} ${patientCode}`.toUpperCase().replace(/[^A-Z0-9 ]/g, '')

    const sepayBank = resolveSepayBankCode(bankName)
    const vietQrUrl = `https://img.vietqr.io/image/${bankBin}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(
        transferContent
    )}&accountName=${encodeURIComponent(accountName)}`
    const sepayQrUrl = `https://qr.sepay.vn/img?acc=${accountNumber}&bank=${sepayBank}&amount=${amount}&des=${encodeURIComponent(
        transferContent
    )}&template=compact`
    const activeQrUrl = qrProvider === 'SEPAY' ? sepayQrUrl : vietQrUrl

    useEffect(() => {
        if (!isOpen || !invoiceId || invoiceId === '001') return undefined
        let active = true
        const timer = setInterval(async () => {
            try {
                const detail = await cashierService.getInvoiceDetail(invoiceId)
                if (active && (detail?.trang_thai === 'da_thu' || detail?.status === 'PAID')) {
                    clearInterval(timer)
                    AppToast.success('Đã nhận thanh toán chuyển khoản trực tuyến')
                    if (onConfirmPayment) {
                        await onConfirmPayment(detail)
                    }
                    onClose()
                }
            } catch {}
        }, 3000)
        return () => {
            active = false
            clearInterval(timer)
        }
    }, [isOpen, invoiceId, onConfirmPayment, onClose])

    if (!isOpen) return null

    const handleCopy = async (text, type) => {
        try {
            await navigator.clipboard.writeText(text)
            if (type === 'content') {
                setCopiedContent(true)
                setTimeout(() => setCopiedContent(false), 2000)
                AppToast.success('Đã sao chép nội dung chuyển khoản')
            } else {
                setCopiedAccount(true)
                setTimeout(() => setCopiedAccount(false), 2000)
                AppToast.success('Đã sao chép số tài khoản')
            }
        } catch {
            AppToast.error('Không thể tự động sao chép, vui lòng chép thủ công')
        }
    }

    const handleConfirm = async () => {
        if (!onConfirmPayment) {
            AppToast.success('Đã đối soát thông tin chuyển khoản')
            onClose()
            return
        }
        setIsConfirming(true)
        try {
            await onConfirmPayment(invoice)
            AppToast.success(`Đã xác nhận thanh toán hóa đơn #${invoiceId}`)
            onClose()
        } catch (err) {
            if (!err?.response) {
                AppToast.error(err?.message || 'Không thể xác nhận thanh toán')
            }
        } finally {
            setIsConfirming(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-clinic-navy/50">
            <style>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    .vietqr-print-card, .vietqr-print-card * {
                        visibility: visible !important;
                    }
                    .vietqr-print-card {
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 32px !important;
                        background: #ffffff !important;
                        border: none !important;
                        box-shadow: none !important;
                        z-index: 999999 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
            <div className="relative w-full max-w-lg bg-clinic-surface rounded-[8px] border border-clinic-border overflow-hidden flex flex-col max-h-[92vh]">
                <div className="bg-clinic-navy px-5 py-3.5 text-clinic-surface flex items-center justify-between no-print">
                    <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-[6px] bg-clinic-surface/10 flex items-center justify-center text-clinic-surface">
                            <QrCode size={18} weight="bold" />
                        </span>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold">Thanh toán chuyển khoản QR</h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-clinic-surface/15 text-clinic-surface">
                                    NAPAS 247
                                </span>
                            </div>
                            <p className="text-xs text-clinic-on-navy-muted tabular-nums">
                                #{invoiceId} · {patientName}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng cửa sổ QR"
                        className="w-8 h-8 rounded-[6px] hover:bg-clinic-surface/15 flex items-center justify-center text-clinic-surface transition-colors cursor-pointer"
                    >
                        <X size={18} weight="bold" />
                    </button>
                </div>

                <div id="vietqr-print-card" className="vietqr-print-card p-5 overflow-y-auto space-y-4">
                    {amount <= 0 ? (
                        <div className="flex flex-col items-center justify-center p-6 bg-clinic-success-bg rounded-[6px] border border-clinic-success-border text-center">
                            <Check size={32} weight="bold" className="text-clinic-success mb-2" />
                            <div className="text-sm font-semibold text-clinic-navy">Hóa đơn miễn giảm 100% (0 đ)</div>
                            <p className="text-xs text-clinic-text-secondary mt-1 max-w-xs">
                                Không phát sinh số tiền cần chuyển khoản. Thu ngân có thể xác nhận hoàn tất ngay.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-4 bg-clinic-bg rounded-[6px] border border-clinic-border">
                            <div className="inline-flex items-center gap-1 p-1 rounded-[6px] bg-clinic-bg-muted border border-clinic-border mb-3 no-print">
                                <button
                                    type="button"
                                    onClick={() => setQrProvider('SEPAY')}
                                    className={`px-3 py-1 rounded-[4px] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                                        qrProvider === 'SEPAY'
                                            ? 'bg-clinic-navy text-clinic-surface'
                                            : 'text-clinic-text-secondary hover:text-clinic-navy'
                                    }`}
                                >
                                    <Lightning size={13} weight="fill" />
                                    <span>SePay tự động</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setQrProvider('VIETQR')}
                                    className={`px-3 py-1 rounded-[4px] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                                        qrProvider === 'VIETQR'
                                            ? 'bg-clinic-navy text-clinic-surface'
                                            : 'text-clinic-text-secondary hover:text-clinic-navy'
                                    }`}
                                >
                                    <QrCode size={13} weight="bold" />
                                    <span>VietQR chuẩn</span>
                                </button>
                            </div>
                            <div className="bg-clinic-surface p-3 rounded-[6px] border border-clinic-border">
                                <img
                                    src={activeQrUrl}
                                    alt={`Mã QR thanh toán hóa đơn #${invoiceId}`}
                                    className="w-52 h-52 object-contain"
                                    loading="lazy"
                                />
                            </div>
                            <div className="mt-3 text-center tabular-nums">
                                <div className="text-xs text-clinic-text-secondary">Số tiền cần chuyển</div>
                                <div className="text-xl font-bold text-clinic-navy mt-0.5">
                                    {amount.toLocaleString('vi-VN')} đ
                                </div>
                            </div>
                        </div>
                    )}

                    <dl className="divide-y divide-clinic-border border-y border-clinic-border text-xs tabular-nums">
                        <div className="py-2.5 flex items-center justify-between gap-3">
                            <dt className="text-clinic-text-secondary flex items-center gap-1.5">
                                <Bank size={14} className="text-clinic-cta" />
                                <span>Ngân hàng</span>
                            </dt>
                            <dd className="font-semibold text-clinic-text text-right">{bankName}</dd>
                        </div>
                        <div className="py-2.5 flex items-center justify-between gap-3">
                            <dt className="text-clinic-text-secondary">Chủ tài khoản</dt>
                            <dd className="font-semibold text-clinic-text text-right">{accountName}</dd>
                        </div>
                        <div className="py-2.5 flex items-center justify-between gap-3">
                            <dt className="text-clinic-text-secondary">Số tài khoản</dt>
                            <dd className="flex items-center gap-2">
                                <span className="font-bold text-clinic-navy text-sm">{accountNumber}</span>
                                <button
                                    type="button"
                                    onClick={() => handleCopy(accountNumber, 'account')}
                                    className="p-1 rounded-[4px] hover:bg-clinic-bg-muted text-clinic-text-secondary transition-colors cursor-pointer no-print"
                                    title="Sao chép số tài khoản"
                                >
                                    {copiedAccount ? <Check size={14} className="text-clinic-success" /> : <Copy size={14} />}
                                </button>
                            </dd>
                        </div>
                        <div className="py-2.5 flex items-center justify-between gap-3">
                            <div>
                                <dt className="text-clinic-text-secondary">Nội dung chuyển khoản</dt>
                                <dd className="font-bold text-clinic-navy text-sm mt-0.5">{transferContent}</dd>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleCopy(transferContent, 'content')}
                                className="medpro-btn-outline h-7 px-2.5 text-xs no-print"
                            >
                                {copiedContent ? <Check size={13} className="text-clinic-success" /> : <Copy size={13} />}
                                <span>{copiedContent ? 'Đã chép' : 'Sao chép'}</span>
                            </button>
                        </div>
                    </dl>
                </div>

                <div className="px-5 py-3 bg-clinic-bg border-t border-clinic-border flex items-center justify-between gap-3 no-print">
                    <button
                        type="button"
                        onClick={onClose}
                        className="medpro-btn-outline h-8 px-3.5 text-xs"
                    >
                        Đóng
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="medpro-btn-outline h-8 px-3 text-xs"
                        >
                            <Printer size={14} weight="bold" />
                            <span>In mã QR</span>
                        </button>
                        <button
                            type="button"
                            disabled={isConfirming}
                            onClick={handleConfirm}
                            className="medpro-btn-primary h-8 px-4 text-xs"
                        >
                            <Check size={15} weight="bold" />
                            <span>{isConfirming ? 'Đang xử lý...' : 'Xác nhận đã thu'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
