import { Printer, X, CheckCircle, Receipt, QrCode } from './ClinicIcon'
import { resolveInvoicePayableAmount } from '../../utils/helpers/cashierInvoiceHelpers'

export default function ReceiptModal({
    isOpen,
    onClose,
    voucher = {},
    clinicInfo = {},
}) {
    if (!isOpen) return null

    const clinicName = clinicInfo.tenPhongKham || 'PHÒNG KHÁM ĐA KHOA CLINIC-AI'
    const clinicAddress = clinicInfo.diaChi || 'Khu Công Nghệ Cao, TP. Thủ Đức, TP. Hồ Chí Minh'
    const clinicPhone = clinicInfo.dienThoai || '1900 6868'
    const clinicCode = clinicInfo.maCoSoKCB || '79-08924'

    const voucherCode = voucher.maPhieu || voucher.id || 'PT-DEFAULT'
    const receiptDate = voucher.ngayThu || voucher.ngayLap || new Date().toLocaleString('vi-VN')
    const patientName = voucher.hoTenBN || voucher.ten_benh_nhan || voucher.benh_nhan?.ho_ten || 'Khách vãng lai'
    const patientCode = voucher.maBN || voucher.ma_benh_nhan || voucher.benh_nhan?.mabn || 'N/A'
    const encounterCode = voucher.maKCB || voucher.luot_kham_id || 'N/A'
    const cashierName = voucher.nguoiThu || 'Phạm Thu Trang'
    const paymentMethod = voucher.hinhThuc || voucher.phuong_thuc_thanh_toan || 'Tiền mặt'

    const lineItems = Array.isArray(voucher.items) && voucher.items.length > 0
        ? voucher.items
        : Array.isArray(voucher.chi_tiet_hoa_don) && voucher.chi_tiet_hoa_don.length > 0
          ? voucher.chi_tiet_hoa_don.map((it, idx) => ({
                id: it.id || idx,
                tenKhoan: it.ten_khoan_thu,
                soTien: Number(it.thanh_tien || 0),
                soLuong: it.so_luong || 1,
                donGia: Number(it.don_gia || 0),
                ghiChu: it.ghi_chu,
            }))
          : [
                {
                    id: 1,
                    tenKhoan: voucher.tenPhieu || 'Công khám & Dịch vụ y tế',
                    soTien: resolveInvoicePayableAmount(voucher),
                    soLuong: 1,
                    donGia: resolveInvoicePayableAmount(voucher),
                },
            ]

    const itemsTotal = lineItems.reduce((sum, item) => sum + (Number(item.soTien) || 0), 0)
    const totalAmount = Number(voucher.tongTien || voucher.tong_tien || 0) || itemsTotal
    const discountAmount = Number(voucher.mienGiam || voucher.mien_giam || 0)
    const finalAmount = resolveInvoicePayableAmount(voucher) || Math.max(0, totalAmount - discountAmount)

    const isPaid = Boolean(voucher.daThu || voucher.trang_thai === 'da_thu')
    const invoiceRef = voucher.invoiceId || voucher.id || voucher.maPhieu || '001'
    const transferContent = `CLINIC HD ${invoiceRef} ${patientCode !== 'N/A' ? patientCode : ''}`
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, '')
    const bankAccount = clinicInfo.bankInfo?.accountNumber || '0901234567'
    const bankName = clinicInfo.bankInfo?.bankName || 'MBBank (Ngân hàng TMCP Quân Đội)'
    const bankAccountName = clinicInfo.bankInfo?.accountName || clinicName
    const qrUrl = `https://qr.sepay.vn/img?acc=${bankAccount}&bank=MBBank&amount=${finalAmount}&des=${encodeURIComponent(transferContent)}&template=compact`

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-clinic-navy/50 overflow-y-auto">
            <style>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #receipt-print-area, #receipt-print-area * {
                        visibility: visible !important;
                    }
                    #receipt-print-area {
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

            <div className="relative w-full max-w-2xl bg-clinic-surface rounded-[8px] border border-clinic-border overflow-hidden flex flex-col my-8">
                <div className="bg-clinic-navy px-5 py-3.5 text-clinic-surface flex items-center justify-between no-print">
                    <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-[6px] bg-clinic-surface/10 flex items-center justify-center text-clinic-surface">
                            <Receipt size={18} weight="bold" />
                        </span>
                        <div>
                            <h3 className="text-sm font-semibold">Biên lai viện phí</h3>
                            <p className="text-xs text-clinic-on-navy-muted">Xem trước chứng từ trước khi in</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng biên lai"
                        className="w-8 h-8 rounded-[6px] hover:bg-clinic-surface/15 flex items-center justify-center text-clinic-surface transition-colors cursor-pointer"
                    >
                        <X size={18} weight="bold" />
                    </button>
                </div>

                <div id="receipt-print-area" className="p-6 sm:p-8 text-clinic-text bg-clinic-surface">
                    <div className="flex items-start justify-between border-b border-clinic-border pb-4 mb-5 gap-4">
                        <div className="space-y-0.5">
                            <h2 className="text-sm font-bold text-clinic-navy uppercase">{clinicName}</h2>
                            <p className="text-xs text-clinic-text-secondary">{clinicAddress}</p>
                            <p className="text-xs text-clinic-text-secondary tabular-nums">
                                Tổng đài: <span className="font-semibold text-clinic-text">{clinicPhone}</span> · Mã KCB: <span className="font-semibold text-clinic-text">{clinicCode}</span>
                            </p>
                        </div>
                        <div className="text-right space-y-0.5 shrink-0 tabular-nums">
                            <span className="text-[11px] font-medium text-clinic-text-muted block">Số chứng từ</span>
                            <span className="text-sm font-bold text-clinic-navy block">{voucherCode}</span>
                            <span className="text-[11px] text-clinic-text-muted block">{receiptDate}</span>
                        </div>
                    </div>

                    <div className="text-center my-4">
                        <h1 className="text-lg font-bold text-clinic-navy uppercase">Biên lai thu viện phí</h1>
                        <p className="text-xs text-clinic-text-muted mt-0.5">Liên giao người bệnh &amp; lưu đối soát nội bộ</p>
                    </div>

                    <dl className="bg-clinic-bg rounded-[6px] p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-5">
                        <div>
                            <dt className="text-clinic-text-muted">Người bệnh</dt>
                            <dd className="font-semibold text-clinic-text text-sm mt-0.5">{patientName}</dd>
                        </div>
                        <div className="tabular-nums">
                            <dt className="text-clinic-text-muted">Mã bệnh nhân</dt>
                            <dd className="font-semibold text-clinic-text mt-0.5">{patientCode}</dd>
                        </div>
                        <div className="tabular-nums">
                            <dt className="text-clinic-text-muted">Mã lượt khám</dt>
                            <dd className="font-semibold text-clinic-navy mt-0.5">{encounterCode}</dd>
                        </div>
                        <div>
                            <dt className="text-clinic-text-muted">Phương thức thanh toán</dt>
                            <dd className="font-semibold text-clinic-text mt-0.5">{paymentMethod}</dd>
                        </div>
                    </dl>

                    <table className="w-full text-left border-collapse text-xs mb-5">
                        <thead>
                            <tr className="bg-clinic-bg-muted border-y border-clinic-border text-clinic-navy">
                                <th className="py-2.5 px-3 font-semibold w-12 text-center">STT</th>
                                <th className="py-2.5 px-3 font-semibold">Khoản thu</th>
                                <th className="py-2.5 px-3 font-semibold w-14 text-center">SL</th>
                                <th className="py-2.5 px-3 font-semibold w-28 text-right">Đơn giá</th>
                                <th className="py-2.5 px-3 font-semibold w-28 text-right">Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-clinic-border">
                            {lineItems.map((item, index) => {
                                const qty = item.soLuong || 1
                                const unitPrice = item.donGia || (item.soTien ? item.soTien / qty : 0)
                                const itemTotal = item.soTien || qty * unitPrice
                                return (
                                    <tr key={item.id || index}>
                                        <td className="py-2.5 px-3 text-center text-clinic-text-muted tabular-nums">{index + 1}</td>
                                        <td className="py-2.5 px-3 font-medium text-clinic-text">
                                            {item.tenKhoan}
                                            {item.ghiChu && (
                                                <span className="block text-[11px] text-clinic-text-muted font-normal">{item.ghiChu}</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 text-center tabular-nums">{qty}</td>
                                        <td className="py-2.5 px-3 text-right text-clinic-text-secondary tabular-nums">
                                            {Number(unitPrice).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-semibold text-clinic-text tabular-nums">
                                            {Number(itemTotal).toLocaleString('vi-VN')} đ
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>

                    <div className="flex flex-wrap items-start justify-between gap-6 mb-6">
                        {!isPaid && finalAmount > 0 ? (
                            <div className="flex items-center gap-3 p-3 rounded-[6px] bg-clinic-surface-tint max-w-sm">
                                <img
                                    src={qrUrl}
                                    alt="Mã QR thanh toán viện phí"
                                    className="w-24 h-24 object-contain rounded-[6px] border border-clinic-border bg-clinic-surface p-1 shrink-0"
                                    crossOrigin="anonymous"
                                />
                                <div className="space-y-1 text-[11px] text-clinic-text-secondary tabular-nums">
                                    <div className="font-semibold text-clinic-navy flex items-center gap-1 text-xs">
                                        <QrCode size={14} weight="bold" className="text-clinic-cta" />
                                        <span>Quét QR thanh toán</span>
                                    </div>
                                    <div>Ngân hàng: <span className="font-semibold text-clinic-text">{bankName}</span></div>
                                    <div>Số TK: <span className="font-semibold text-clinic-text">{bankAccount}</span></div>
                                    <div>Chủ TK: <span className="font-semibold text-clinic-text">{bankAccountName}</span></div>
                                    <div>Nội dung: <span className="font-bold text-clinic-navy">{transferContent}</span></div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-clinic-text-muted pt-2">
                                {isPaid ? 'Chứng từ đã ghi nhận thanh toán trong sổ quỹ phòng khám.' : ''}
                            </div>
                        )}

                        <div className="w-64 space-y-1.5 text-xs shrink-0 tabular-nums ml-auto">
                            <div className="flex justify-between text-clinic-text-secondary">
                                <span>Tổng chi phí:</span>
                                <span className="font-semibold text-clinic-text">{totalAmount.toLocaleString('vi-VN')} đ</span>
                            </div>
                            {discountAmount > 0 && (
                                <div className="flex justify-between text-clinic-success">
                                    <span>Miễn giảm:</span>
                                    <span className="font-semibold">-{discountAmount.toLocaleString('vi-VN')} đ</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm font-bold text-clinic-navy border-t border-clinic-border pt-2">
                                <span>{isPaid ? 'Đã thu:' : 'Cần thanh toán:'}</span>
                                <span>{finalAmount.toLocaleString('vi-VN')} đ</span>
                            </div>
                            <div className="flex justify-end pt-1">
                                {isPaid ? (
                                    <span className="medpro-badge-success">
                                        <CheckCircle size={13} weight="fill" />
                                        <span>Đã thanh toán</span>
                                    </span>
                                ) : (
                                    <span className="medpro-badge-warning">Chờ thu tiền</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 text-center text-xs pt-4 border-t border-clinic-border">
                        <div className="space-y-1">
                            <div className="font-semibold text-clinic-text">Người nộp tiền</div>
                            <div className="text-[11px] text-clinic-text-muted">(Ký, ghi rõ họ tên)</div>
                            <div className="h-14" />
                            <div className="font-medium text-clinic-text">{patientName}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="font-semibold text-clinic-text">Thu ngân</div>
                            <div className="text-[11px] text-clinic-text-muted">(Ký, ghi rõ họ tên)</div>
                            <div className="h-14" />
                            <div className="font-medium text-clinic-text">{cashierName}</div>
                        </div>
                    </div>
                </div>

                <div className="px-5 py-3 bg-clinic-bg border-t border-clinic-border flex items-center justify-between no-print">
                    <button
                        type="button"
                        onClick={onClose}
                        className="medpro-btn-outline h-8 px-3.5 text-xs"
                    >
                        Đóng
                    </button>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="medpro-btn-primary h-8 px-4 text-xs"
                    >
                        <Printer size={15} weight="bold" />
                        <span>In biên lai</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
