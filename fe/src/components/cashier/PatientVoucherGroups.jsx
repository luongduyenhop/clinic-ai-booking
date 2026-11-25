import { QrCode } from '@phosphor-icons/react'
import {
    EmptyState,
    CaretDown,
    CaretRight,
} from '../common/ClinicIcon'
import { resolveInvoicePayableAmount } from '../../utils/helpers/cashierInvoiceHelpers'

export default function PatientVoucherGroups({
    groupedPatients,
    expandedPatients,
    togglePatient,
    form,
    onSelectPatientCombined,
    onSelectVoucher,
    onOpenQr,
    onPayAllForPatient,
}) {
    if (groupedPatients.length === 0) {
        return (
            <div className="py-8">
                <EmptyState
                    icon="Receipt"
                    title="Không tìm thấy hóa đơn phù hợp"
                />
            </div>
        )
    }

    return (
        <div className="divide-y divide-clinic-border">
            {groupedPatients.map((group) => {
                const isExpanded = expandedPatients.has(group.key)
                const isSelectedGroup =
                    form?.maBN === group.maBN || form?.hoTenBN === group.hoTenBN

                return (
                    <div key={group.key} className="bg-clinic-surface">
                        <div
                            onClick={() => onSelectPatientCombined(group)}
                            className={`px-3 py-2.5 flex items-start justify-between gap-2 cursor-pointer transition-colors ${
                                isSelectedGroup
                                    ? 'bg-clinic-surface-alt/80'
                                    : 'hover:bg-clinic-bg'
                            }`}
                        >
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                                <button
                                    type="button"
                                    aria-label={isExpanded ? 'Thu gọn nhóm phiếu' : 'Mở rộng nhóm phiếu'}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        togglePatient(group.key)
                                    }}
                                    className="mt-0.5 p-0.5 text-clinic-text-muted hover:text-clinic-navy rounded-[4px] transition cursor-pointer shrink-0"
                                >
                                    {isExpanded ? (
                                        <CaretDown size={13} weight="bold" />
                                    ) : (
                                        <CaretRight size={13} weight="bold" />
                                    )}
                                </button>
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-xs text-clinic-navy truncate">
                                        {group.hoTenBN}
                                    </div>
                                    <div className="text-[11px] text-clinic-text-muted truncate tabular-nums mt-0.5">
                                        {group.maBN || 'Vãng lai'}
                                        {group.soDienThoai ? ` · ${group.soDienThoai}` : ''}
                                    </div>
                                    {group.unpaidCount > 0 && (
                                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onPayAllForPatient(group)
                                                }}
                                                className="h-6 px-2 rounded-[4px] bg-clinic-cta hover:bg-clinic-cta-hover text-clinic-surface text-[11px] font-semibold cursor-pointer transition whitespace-nowrap"
                                            >
                                                Thu gộp ({group.unpaidCount})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    const unpaid = group.vouchers.filter((voucher) => !voucher.daThu)
                                                    const combinedInvoice = {
                                                        id: `GOP-${group.key}`,
                                                        isCombined: true,
                                                        combinedVoucherIds: unpaid.map((voucher) => voucher.id),
                                                        combinedInvoiceIds: unpaid
                                                            .map((voucher) => voucher.invoiceId || voucher.id)
                                                            .filter(Boolean),
                                                        maPhieu: `GOP-${group.maBN || 'BN'}-${unpaid.length}HD`,
                                                        maBN: group.maBN,
                                                        hoTenBN: group.hoTenBN,
                                                        tenPhieu: `Thu gộp toàn bộ dịch vụ BN ${group.hoTenBN}`,
                                                        tongTien: unpaid.reduce(
                                                            (sum, voucher) => sum + resolveInvoicePayableAmount(voucher),
                                                            0
                                                        ),
                                                    }
                                                    onOpenQr(combinedInvoice)
                                                }}
                                                className="h-6 px-2 rounded-[4px] border border-clinic-border-strong bg-clinic-surface hover:border-clinic-cta text-clinic-navy text-[11px] font-medium cursor-pointer transition inline-flex items-center gap-1 whitespace-nowrap"
                                            >
                                                <QrCode size={11} weight="bold" />
                                                <span>QR</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="text-right shrink-0 tabular-nums">
                                <div className="text-xs font-semibold text-clinic-navy whitespace-nowrap">
                                    {group.totalAmount.toLocaleString('vi-VN')} đ
                                </div>
                                <div className="mt-0.5 inline-flex items-center gap-1 text-[11px]">
                                    <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                            group.unpaidCount > 0 ? 'bg-clinic-amber' : 'bg-clinic-success'
                                        }`}
                                    />
                                    <span className={group.unpaidCount > 0 ? 'text-clinic-warning font-medium' : 'text-clinic-text-muted'}>
                                        {group.unpaidCount > 0 ? `${group.unpaidCount} chờ thu` : 'Đã thu đủ'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="bg-clinic-bg/70 divide-y divide-clinic-border/70 border-t border-clinic-border">
                                {group.vouchers.map((voucher) => {
                                    const isSelected =
                                        form.id === voucher.id ||
                                        (form.maPhieu && form.maPhieu === voucher.maPhieu)
                                    const displayAmount = resolveInvoicePayableAmount(voucher)
                                    return (
                                        <div
                                            key={
                                                voucher.invoiceId
                                                    ? `${voucher.invoiceId}-${voucher.maPhieu}`
                                                    : voucher.id || voucher.maPhieu
                                            }
                                            onClick={() => onSelectVoucher(voucher)}
                                            className={`pl-8 pr-3 py-2 cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                                                isSelected
                                                    ? 'bg-clinic-surface-alt text-clinic-navy'
                                                    : 'hover:bg-clinic-surface-tint/60'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-medium text-clinic-navy truncate tabular-nums">
                                                    {voucher.maPhieu}
                                                </div>
                                                {voucher.ngayThu && (
                                                    <div className="text-[10.5px] text-clinic-text-muted truncate tabular-nums">
                                                        {voucher.ngayThu}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0 flex items-center gap-2 tabular-nums">
                                                <div>
                                                    <div className="text-xs font-semibold text-clinic-navy whitespace-nowrap">
                                                        {displayAmount.toLocaleString('vi-VN')} đ
                                                    </div>
                                                    <div className="text-[10.5px] text-right">
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
                                                        title="Mở mã QR thanh toán"
                                                    >
                                                        <QrCode size={14} weight="bold" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
