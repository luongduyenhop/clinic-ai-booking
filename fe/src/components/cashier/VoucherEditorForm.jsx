import { QrCode } from '@phosphor-icons/react'
import {
    Plus,
    Check,
    FloppyDisk,
    Printer,
    Trash,
    EmptyState,
} from '../common/ClinicIcon'
import { resolveInvoicePayableAmount } from '../../utils/helpers/cashierInvoiceHelpers'

export default function VoucherEditorForm({
    form,
    setForm,
    patients,
    paymentMethods,
    khoanThuCatalog,
    newItemName,
    setNewItemName,
    newItemAmount,
    setNewItemAmount,
    newItemNote,
    setNewItemNote,
    onSelectPatientAutoFill,
    onAddLineItem,
    onRemoveLineItem,
    onSaveVoucher,
    onDeleteVoucher,
    onOpenQr,
    onOpenReceiptModal,
    onResetForm,
}) {
    const computedTotal = resolveInvoicePayableAmount(form)

    return (
        <div className="lg:col-span-7 xl:col-span-8 medpro-card p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-clinic-border">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-clinic-navy">
                            Chi tiết phiếu thu viện phí
                        </h2>
                        <span className={form.daThu ? 'medpro-badge-success' : 'medpro-badge-warning'}>
                            {form.daThu ? 'Đã thu tiền' : 'Chờ thanh toán'}
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onResetForm}
                        className="medpro-btn-outline h-8 !px-3 text-xs"
                    >
                        <Plus size={13} weight="bold" />
                        <span>Phiếu mới</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onOpenQr({ ...form, tongTien: computedTotal })}
                        className="medpro-btn-outline h-8 !px-3 text-xs"
                        title="Tạo mã QR thanh toán viện phí (SePay / VietQR)"
                    >
                        <QrCode size={14} weight="bold" />
                        <span>Mã QR</span>
                    </button>
                    <button
                        type="button"
                        onClick={onOpenReceiptModal}
                        className="medpro-btn-outline h-8 !px-3 text-xs"
                    >
                        <Printer size={14} />
                        <span>In biên lai</span>
                    </button>
                    <button
                        type="button"
                        onClick={onSaveVoucher}
                        className="medpro-btn-primary h-8 !px-3.5 text-xs tabular-nums"
                    >
                        {form.daThu ? <FloppyDisk size={14} weight="bold" /> : <Check size={14} weight="bold" />}
                        <span>
                            {form.daThu
                                ? 'Lưu cập nhật'
                                : computedTotal > 0
                                  ? `Xác nhận thu ${computedTotal.toLocaleString('vi-VN')} đ`
                                  : 'Lưu phiếu thu'}
                        </span>
                    </button>
                    {form.id && (
                        <button
                            type="button"
                            onClick={onDeleteVoucher}
                            title="Xóa phiếu thu"
                            aria-label="Xóa phiếu thu"
                            className="h-8 w-8 rounded-[6px] border border-transparent hover:border-clinic-danger-border hover:bg-clinic-danger-bg text-clinic-text-muted hover:text-clinic-danger flex items-center justify-center transition-colors cursor-pointer"
                        >
                            <Trash size={14} />
                        </button>
                    )}
                </div>
            </div>

            {form.isCombined && (
                <div className="px-3.5 py-2.5 bg-clinic-surface-tint border border-clinic-info-border rounded-[6px] flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                    <span className="text-clinic-navy font-medium">
                        Đang gộp {form.items?.length || 0} khoản dịch vụ của bệnh nhân <strong>{form.hoTenBN}</strong>
                    </span>
                    <span className="font-semibold text-clinic-navy">
                        Tổng gộp: {computedTotal.toLocaleString('vi-VN')} đ
                    </span>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3 items-end">
                <div className="xl:col-span-4">
                    <label className="medpro-label">Hồ sơ bệnh nhân</label>
                    <select
                        value={form.maBN || ''}
                        onChange={(e) => onSelectPatientAutoFill(e.target.value)}
                        className="medpro-input !py-0 !px-2.5 h-8 text-xs font-medium"
                    >
                        <option value="">Chọn hồ sơ hoặc nhập trực tiếp</option>
                        {patients.map((patient) => (
                            <option key={patient.id} value={patient.maBN}>
                                {patient.maBN} — {patient.hoTen}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="xl:col-span-4">
                    <label className="medpro-label">Người nộp tiền</label>
                    <input
                        type="text"
                        value={form.hoTenBN || ''}
                        onChange={(e) => setForm({ ...form, hoTenBN: e.target.value })}
                        className="medpro-input !py-0 !px-2.5 h-8 text-xs font-medium"
                    />
                </div>
                <div className="xl:col-span-4">
                    <label className="medpro-label">Mã chứng từ</label>
                    <input
                        type="text"
                        value={form.maPhieu || ''}
                        readOnly
                        disabled
                        className="medpro-input !py-0 !px-2.5 h-8 text-xs font-medium tabular-nums"
                    />
                </div>

                <div className="sm:col-span-2 xl:col-span-5">
                    <label className="medpro-label">Nội dung chứng từ</label>
                    <input
                        type="text"
                        value={form.tenPhieu || ''}
                        onChange={(e) => setForm({ ...form, tenPhieu: e.target.value })}
                        placeholder="Khám chuyên khoa và cận lâm sàng..."
                        className="medpro-input !py-0 !px-2.5 h-8 text-xs"
                    />
                </div>
                <div className="xl:col-span-4">
                    <label className="medpro-label">Phương thức thanh toán</label>
                    <select
                        value={form.hinhThuc || paymentMethods[0]?.value}
                        onChange={(e) => {
                            const val = e.target.value
                            setForm({ ...form, hinhThuc: val })
                            if (val === 'Chuyển khoản') {
                                onOpenQr({ ...form, hinhThuc: val, tongTien: computedTotal })
                            }
                        }}
                        className="medpro-input !py-0 !px-2.5 h-8 text-xs font-medium"
                    >
                        {paymentMethods.map((method) => (
                            <option key={method.value} value={method.value}>
                                {method.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="xl:col-span-3">
                    <label className="medpro-label">Ghi nhận thu tiền</label>
                    <label
                        htmlFor="chk-dathu"
                        className="h-8 flex items-center gap-2 px-2.5 rounded-[6px] border border-clinic-border-strong bg-clinic-surface cursor-pointer select-none"
                    >
                        <input
                            id="chk-dathu"
                            type="checkbox"
                            checked={Boolean(form.daThu)}
                            onChange={(e) => setForm({ ...form, daThu: e.target.checked })}
                            className="w-4 h-4 accent-clinic-cta"
                        />
                        <span className="text-xs font-medium text-clinic-navy truncate">
                            {form.daThu ? 'Đã thu đủ' : 'Chưa thu'}
                        </span>
                    </label>
                </div>
            </div>

            <div className="pt-2 border-t border-clinic-border space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-clinic-navy tabular-nums">
                        Khoản thu chi tiết ({form.items?.length || 0})
                    </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                    <div className="sm:col-span-5">
                        <label className="medpro-label">Tên dịch vụ / khoản thu</label>
                        <input
                            type="text"
                            list="khoan-muc-datalist"
                            value={newItemName}
                            onChange={(e) => {
                                setNewItemName(e.target.value)
                                const matched = khoanThuCatalog.find((k) => k.ten === e.target.value)
                                if (matched) setNewItemAmount(matched.donGiaMacDinh)
                            }}
                            className="medpro-input !py-0 h-8 text-xs"
                        />
                        <datalist id="khoan-muc-datalist">
                            {khoanThuCatalog.map((k) => (
                                <option key={k.id} value={k.ten} />
                            ))}
                        </datalist>
                    </div>
                    <div className="sm:col-span-3">
                        <label className="medpro-label">Đơn giá (VNĐ)</label>
                        <input
                            type="number"
                            value={newItemAmount}
                            onChange={(e) => setNewItemAmount(e.target.value)}
                            className="medpro-input !py-0 h-8 text-xs tabular-nums font-medium"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="medpro-label">Ghi chú</label>
                        <input
                            type="text"
                            value={newItemNote}
                            onChange={(e) => setNewItemNote(e.target.value)}
                            placeholder="Tùy chọn"
                            className="medpro-input !py-0 h-8 text-xs"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <button
                            type="button"
                            onClick={onAddLineItem}
                            className="medpro-btn-outline h-8 w-full text-xs"
                        >
                            <Plus size={13} weight="bold" />
                            <span>Thêm dòng</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                    <table className="medpro-table">
                        <thead>
                            <tr>
                                <th className="w-12">STT</th>
                                <th>Nội dung khoản thu</th>
                                <th className="text-right">Thành tiền</th>
                                <th>Phân nhóm</th>
                                <th className="w-16 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="tabular-nums">
                            {(form.items || []).map((lineItem, idx) => (
                                <tr key={lineItem.id}>
                                    <td className="text-clinic-text-muted">{idx + 1}</td>
                                    <td className="font-medium text-clinic-navy">{lineItem.tenKhoan}</td>
                                    <td className="text-right font-semibold text-clinic-navy whitespace-nowrap">
                                        {Number(lineItem.soTien).toLocaleString('vi-VN')} đ
                                    </td>
                                    <td className="text-clinic-text-secondary">{lineItem.ghiChu || '—'}</td>
                                    <td className="text-right">
                                        <button
                                            type="button"
                                            onClick={() => onRemoveLineItem(lineItem.id)}
                                            className="inline-flex items-center gap-1 text-clinic-text-muted hover:text-clinic-danger text-xs font-medium cursor-pointer transition-colors"
                                        >
                                            <Trash size={13} />
                                            <span>Xóa</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {(!form.items || form.items.length === 0) && (
                                <tr>
                                    <td colSpan={5}>
                                        <EmptyState
                                            icon="Receipt"
                                            title="Chưa có khoản thu nào"
                                            description="Chọn ca khám bên trái để nạp dịch vụ hoặc thêm khoản thu thủ công."
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-4 py-3 rounded-[6px] bg-clinic-bg-muted/80 border border-clinic-border flex items-center justify-between tabular-nums">
                    <span className="text-xs font-medium text-clinic-text-secondary">
                        {form.daThu ? 'Tổng tiền đã thu' : 'Tổng tiền cần thanh toán'}
                    </span>
                    <span className="text-lg font-bold text-clinic-navy">
                        {computedTotal.toLocaleString('vi-VN')} đ
                    </span>
                </div>
            </div>
        </div>
    )
}
