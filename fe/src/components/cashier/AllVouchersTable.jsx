import { QrCode } from '@phosphor-icons/react'
import { EmptyState } from '../common/ClinicIcon'
import { resolveInvoicePayableAmount } from '../../utils/helpers/cashierInvoiceHelpers'

export default function AllVouchersTable({
    filteredVouchers,
    form,
    onSelectVoucher,
    onOpenQr,
}) {
    if (filteredVouchers.length === 0) {
        return (
            <div className="py-8">
                <EmptyState
                    icon="Receipt"
                    title="Không tìm thấy phiếu thu nào"
                />
            </div>
        )
    }

    return (
        <div className="divide-y divide-clinic-border">
            {filteredVouchers.map((voucher) => {
                const isSelected = form.id === voucher.id
                const displayAmount = resolveInvoicePayableAmount(voucher)
                return (
                    <div
                        key={
                            voucher.invoiceId
                                ? `${voucher.invoiceId}-${voucher.maPhieu}`
                                : voucher.id || voucher.maPhieu
                        }
                        onClick={() => onSelectVoucher(voucher)}
                        className={`px-3.5 py-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            isSelected ? 'bg-clinic-surface-alt' : 'hover:bg-clinic-bg'
                        }`}
                    >
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-clinic-navy truncate">
                                {voucher.hoTenBN}
                            </div>
                            <div className="text-[11px] text-clinic-text-muted truncate tabular-nums mt-0.5">
                                {voucher.maPhieu}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 tabular-nums">
                            <div className="text-right">
                                <div className="text-xs font-semibold text-clinic-navy whitespace-nowrap">
                                    {displayAmount.toLocaleString('vi-VN')} đ
                                </div>
                                <div className="text-[10.5px]">
                                    <span className={voucher.daThu ? 'text-clinic-success' : 'text-clinic-warning font-medium'}>
                                        {voucher.daThu ? 'Đã thu' : 'Chờ thu'}
                                    </span>
                                </div>
                            </div>
                            {!voucher.daThu && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onOpenQr(voucher)
                                    }}
                                    className="p-1 rounded-[4px] hover:bg-clinic-surface text-clinic-cta transition cursor-pointer"
                                    title="Mã QR thanh toán"
                                >
                                    <QrCode size={14} weight="bold" />
                                </button>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
