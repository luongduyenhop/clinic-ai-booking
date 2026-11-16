import { QrCode } from '@phosphor-icons/react'
import { StatusBadge, EmptyState } from '../common/ClinicIcon'

export default function AllVouchersTable({
    filteredVouchers,
    form,
    onSelectVoucher,
    onOpenQr,
}) {
    return (
        <table className="medpro-table">
            <thead>
                <tr>
                    <th>STT</th>
                    <th>Mã phiếu</th>
                    <th>Bệnh nhân / Người nộp</th>
                    <th>Số tiền</th>
                    <th className="text-center">TT</th>
                </tr>
            </thead>
            <tbody>
                {filteredVouchers.map((voucher, idx) => (
                    <tr
                        key={
                            voucher.invoiceId
                                ? `${voucher.invoiceId}-${voucher.maPhieu}`
                                : voucher.id || voucher.maPhieu
                        }
                        onClick={() => onSelectVoucher(voucher)}
                        className={`cursor-pointer ${
                            form.id === voucher.id
                                ? '!bg-[#E8F4FD] font-semibold border-l-4 border-l-[#00B5F1]'
                                : ''
                        }`}
                    >
                        <td className="tabular-nums text-center font-bold">{idx + 1}</td>
                        <td className="font-mono text-[11px] font-bold text-[#00B5F1]">
                            {voucher.maPhieu}
                        </td>
                        <td className="font-semibold text-[#12263F]">{voucher.hoTenBN}</td>
                        <td className="tabular-nums font-bold text-[#003553]">
                            {Number(voucher.tongTien).toLocaleString('vi-VN')} đ
                        </td>
                        <td className="text-center">
                            <div className="flex items-center justify-center gap-1">
                                <StatusBadge
                                    status={voucher.daThu ? 'Đã thu' : 'Chờ thu'}
                                    showText={false}
                                />
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onOpenQr(voucher)
                                    }}
                                    className="p-1 text-teal-600 hover:text-teal-900 transition cursor-pointer"
                                    title="Mã QR (SePay / VietQR)"
                                >
                                    <QrCode size={13} weight="bold" />
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
                {filteredVouchers.length === 0 && (
                    <tr>
                        <td colSpan={5}>
                            <EmptyState
                                icon="Receipt"
                                title="Không tìm thấy phiếu thu nào"
                            />
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    )
}
