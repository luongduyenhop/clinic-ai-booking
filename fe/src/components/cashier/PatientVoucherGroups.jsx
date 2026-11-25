import { QrCode } from '@phosphor-icons/react'
import {
    StatusBadge,
    EmptyState,
    CaretDown,
    CaretRight,
    User,
} from '../common/ClinicIcon'

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
                    title="Không tìm thấy bệnh nhân hoặc phiếu thu nào"
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
                            className={`p-2.5 flex items-center justify-between cursor-pointer hover:bg-clinic-surface-tint transition border-l-4 ${
                                isSelectedGroup
                                    ? 'bg-clinic-surface-alt border-l-clinic-cta font-semibold'
                                    : 'border-l-transparent hover:border-l-clinic-border-strong'
                            }`}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        togglePatient(group.key)
                                    }}
                                    className="p-1 text-clinic-text-muted hover:text-clinic-navy rounded-[4px] transition cursor-pointer"
                                >
                                    {isExpanded ? (
                                        <CaretDown size={14} weight="bold" />
                                    ) : (
                                        <CaretRight size={14} weight="bold" />
                                    )}
                                </button>
                                <div className="w-7 h-7 rounded-[6px] bg-clinic-surface-alt text-clinic-cta border border-clinic-info-border flex items-center justify-center shrink-0">
                                    <User size={15} weight="bold" />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-xs text-clinic-navy truncate">
                                        {group.hoTenBN}
                                    </div>
                                    <div className="text-[11px] text-clinic-text-secondary truncate tabular-nums">
                                        {group.maBN ? `Mã: ${group.maBN}` : 'Vãng lai'}
                                        {group.soDienThoai ? ` • ${group.soDienThoai}` : ''}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right shrink-0 tabular-nums">
                                <div className="text-xs font-bold text-clinic-navy">
                                    {group.totalAmount.toLocaleString('vi-VN')} đ
                                </div>
                                <div className="flex items-center justify-end gap-1 mt-0.5">
                                    <span className="text-[10px] text-clinic-text-secondary font-semibold">
                                        {group.vouchers.length} phiếu
                                    </span>
                                    {group.unpaidCount > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold bg-clinic-warning-bg text-clinic-warning border border-clinic-warning-border">
                                            {group.unpaidCount} chờ thu
                                        </span>
                                    )}
                                    {group.paidCount > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold bg-clinic-success-bg text-clinic-success border border-clinic-success-border">
                                            {group.paidCount} đã thu
                                        </span>
                                    )}
                                </div>
                                {group.unpaidCount > 0 && (
                                    <div className="mt-1 flex items-center justify-end gap-1.5">
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
                                                        (sum, voucher) => sum + Number(voucher.tongTien || 0),
                                                        0
                                                    ),
                                                }
                                                onOpenQr(combinedInvoice)
                                            }}
                                            className="px-2 py-0.5 rounded-[4px] bg-clinic-navy hover:bg-clinic-navy-dark text-clinic-surface text-[10px] font-bold cursor-pointer transition flex items-center gap-1"
                                            title="Quét mã QR (SePay / VietQR) thu gộp toàn bộ"
                                        >
                                            <QrCode size={11} weight="bold" />
                                            <span>QR gộp</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onPayAllForPatient(group)
                                            }}
                                            className="px-2 py-0.5 rounded-[4px] bg-clinic-cta hover:bg-clinic-cta-hover text-clinic-surface text-[10px] font-bold cursor-pointer transition"
                                            title="Thu tiền toàn bộ các dịch vụ của bệnh nhân này cùng lúc"
                                        >
                                            Thu tất cả ({group.unpaidCount})
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="bg-clinic-bg pl-8 pr-2.5 py-1.5 space-y-1.5 border-t border-clinic-border">
                                {group.vouchers.map((voucher) => {
                                    const isSelected =
                                        form.id === voucher.id ||
                                        (form.maPhieu && form.maPhieu === voucher.maPhieu)
                                    return (
                                        <div
                                            key={
                                                voucher.invoiceId
                                                    ? `${voucher.invoiceId}-${voucher.maPhieu}`
                                                    : voucher.id || voucher.maPhieu
                                            }
                                            onClick={() => onSelectVoucher(voucher)}
                                            className={`p-2 rounded-[6px] cursor-pointer transition flex items-center justify-between border ${
                                                isSelected
                                                    ? 'bg-clinic-surface-alt border-clinic-cta'
                                                    : 'bg-clinic-surface border-clinic-border hover:border-clinic-cta'
                                            }`}
                                        >
                                            <div className="min-w-0 pr-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-[11px] font-bold text-clinic-cta">
                                                        {voucher.maPhieu}
                                                    </span>
                                                    <span className="text-xs font-medium text-clinic-navy truncate max-w-[140px]">
                                                        {voucher.tenPhieu || 'Hóa đơn dịch vụ'}
                                                    </span>
                                                </div>
                                                {voucher.ngayThu && (
                                                    <div className="text-[10px] text-clinic-text-muted mt-0.5 tabular-nums">
                                                        {voucher.ngayThu}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0 flex items-center gap-1.5 tabular-nums">
                                                <div>
                                                    <div className="text-xs font-bold text-clinic-navy">
                                                        {Number(voucher.tongTien).toLocaleString('vi-VN')} đ
                                                    </div>
                                                    <div className="mt-0.5 flex justify-end">
                                                        <StatusBadge
                                                            status={voucher.daThu ? 'Đã thu' : 'Chờ thu'}
                                                            showText={true}
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onOpenQr(voucher)
                                                    }}
                                                    className="p-1 text-clinic-cta hover:text-clinic-navy transition cursor-pointer"
                                                    title="Mã QR (SePay / VietQR)"
                                                >
                                                    <QrCode size={14} weight="bold" />
                                                </button>
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
