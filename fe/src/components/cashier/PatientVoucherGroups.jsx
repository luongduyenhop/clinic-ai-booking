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
        <div className="divide-y divide-slate-100">
            {groupedPatients.map((group) => {
                const isExpanded = expandedPatients.has(group.key)
                const isSelectedGroup =
                    form?.maBN === group.maBN || form?.hoTenBN === group.hoTenBN

                return (
                    <div key={group.key} className="bg-white">
                        <div
                            onClick={() => onSelectPatientCombined(group)}
                            className={`p-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition border-l-4 ${
                                isSelectedGroup
                                    ? 'bg-[#F0F9FF] border-l-[#00B5F1] font-semibold'
                                    : 'border-l-transparent hover:border-l-slate-300'
                            }`}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        togglePatient(group.key)
                                    }}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
                                >
                                    {isExpanded ? (
                                        <CaretDown size={14} weight="bold" />
                                    ) : (
                                        <CaretRight size={14} weight="bold" />
                                    )}
                                </button>
                                <div className="w-7 h-7 rounded-full bg-sky-100 text-[#00B5F1] flex items-center justify-center shrink-0">
                                    <User size={15} weight="bold" />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-xs text-[#003553] truncate">
                                        {group.hoTenBN}
                                    </div>
                                    <div className="text-[11px] text-slate-400 truncate">
                                        {group.maBN ? `Mã: ${group.maBN}` : 'Vãng lai'}
                                        {group.soDienThoai ? ` • ${group.soDienThoai}` : ''}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-xs font-bold tabular-nums text-[#003553]">
                                    {group.totalAmount.toLocaleString('vi-VN')} đ
                                </div>
                                <div className="flex items-center justify-end gap-1 mt-0.5">
                                    <span className="text-[10px] text-slate-400 font-semibold">
                                        {group.vouchers.length} phiếu
                                    </span>
                                    {group.unpaidCount > 0 && (
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                            {group.unpaidCount} chờ thu
                                        </span>
                                    )}
                                    {group.paidCount > 0 && (
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
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
                                            className="px-2 py-0.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold cursor-pointer transition shadow-xs flex items-center gap-1"
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
                                            className="px-2 py-0.5 rounded-md bg-[#00B5F1] hover:bg-[#0095c8] text-white text-[10px] font-bold cursor-pointer transition shadow-xs"
                                            title="Thu tiền toàn bộ các dịch vụ của bệnh nhân này cùng lúc"
                                        >
                                            Thu tất cả ({group.unpaidCount})
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="bg-slate-50/70 pl-8 pr-2.5 py-1.5 space-y-1.5 border-t border-slate-100">
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
                                            className={`p-2 rounded-lg cursor-pointer transition flex items-center justify-between border ${
                                                isSelected
                                                    ? 'bg-[#E8F4FD] border-[#00B5F1] shadow-xs'
                                                    : 'bg-white border-slate-200 hover:border-sky-300'
                                            }`}
                                        >
                                            <div className="min-w-0 pr-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-[11px] font-bold text-[#00B5F1]">
                                                        {voucher.maPhieu}
                                                    </span>
                                                    <span className="text-xs font-medium text-slate-700 truncate max-w-[140px]">
                                                        {voucher.tenPhieu || 'Hóa đơn dịch vụ'}
                                                    </span>
                                                </div>
                                                {voucher.ngayThu && (
                                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                                        {voucher.ngayThu}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0 flex items-center gap-1.5">
                                                <div>
                                                    <div className="text-xs font-bold tabular-nums text-[#003553]">
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
                                                    className="p-1 text-teal-600 hover:text-teal-900 transition cursor-pointer"
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
