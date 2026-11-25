import { QrCode } from '@phosphor-icons/react'
import {
    Plus,
    FloppyDisk,
    Printer,
    Trash,
    EmptyState,
} from '../common/ClinicIcon'

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
    return (
        <div className="lg:col-span-8 medpro-card p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-clinic-border">
                <div>
                    <h2 className="font-display text-base font-extrabold text-clinic-navy">
                        Quản lý Thu viện phí &amp; Biên lai phòng khám
                    </h2>
                    <p className="text-xs text-clinic-text-secondary">
                        Lập phiếu thu viện phí tự động từ chỉ định dịch vụ và in biên lai thu tiền
                    </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <button
                        type="button"
                        onClick={onResetForm}
                        className="medpro-btn-outline rounded-[6px] !px-2.5 !py-1.5 text-xs"
                    >
                        <Plus size={14} weight="bold" className="text-clinic-cta" />
                        <span>Lập phiếu thu mới</span>
                    </button>
                    <button
                        type="button"
                        onClick={onSaveVoucher}
                        className="medpro-btn-primary rounded-[6px] !px-2.5 !py-1.5 text-xs"
                    >
                        <FloppyDisk size={15} weight="bold" />
                        <span>Lưu phiếu</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onOpenQr(form)}
                        className="medpro-btn-outline rounded-[6px] !px-2.5 !py-1.5 text-xs font-bold border-clinic-cta text-clinic-cta hover:bg-clinic-surface-alt flex items-center gap-1.5 cursor-pointer"
                        title="Tạo mã QR thanh toán viện phí (SePay / VietQR)"
                    >
                        <QrCode size={15} weight="bold" />
                        <span>Mã QR SePay / VietQR</span>
                    </button>
                    <button
                        type="button"
                        onClick={onOpenReceiptModal}
                        className="medpro-btn-amber rounded-[6px] !px-2.5 !py-1.5 text-xs font-bold"
                    >
                        <Printer size={15} weight="bold" />
                        <span>In biên lai thu tiền</span>
                    </button>
                    {form.id && (
                        <button
                            type="button"
                            onClick={onDeleteVoucher}
                            className="medpro-btn-danger rounded-[6px] !px-2.5 !py-1.5 text-xs"
                        >
                            <Trash size={14} weight="bold" />
                            <span>Xóa</span>
                        </button>
                    )}
                </div>
            </div>

            {form.isCombined && (
                <div className="p-3 bg-clinic-surface-alt border border-clinic-info-border rounded-[6px] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-clinic-navy font-semibold tabular-nums">
                        <span className="w-2 h-2 rounded-full bg-clinic-cta shrink-0" />
                        <span>
                            Đang thu gộp toàn bộ {form.items?.length || 0} dịch vụ của BN {form.hoTenBN}. Bấm &quot;Lưu phiếu&quot; hoặc &quot;Mã VietQR&quot; để thanh toán tất cả cùng lúc.
                        </span>
                    </div>
                    <div className="font-extrabold tabular-nums text-clinic-navy text-sm bg-clinic-surface px-2.5 py-1 rounded-[6px] border border-clinic-border">
                        Tổng thu gộp: {Number(form.tongTien || 0).toLocaleString('vi-VN')} đ
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                <div className="lg:col-span-3">
                    <label className="medpro-label mb-1">Loại chứng từ</label>
                    <div className="h-9 flex items-center px-2.5 rounded-[6px] border border-clinic-info-border bg-clinic-surface-alt text-clinic-navy font-bold text-xs select-none whitespace-nowrap">
                        Phiếu thu viện phí
                    </div>
                </div>
                <div className="lg:col-span-3">
                    <div className="flex items-center justify-between gap-1 mb-1">
                        <label className="medpro-label !mb-0 whitespace-nowrap">Mã phiếu thu</label>
                        <span className="text-[10px] font-semibold text-clinic-cta whitespace-nowrap">
                            Tự sinh
                        </span>
                    </div>
                    <input
                        type="text"
                        value={form.maPhieu || ''}
                        readOnly
                        disabled
                        className="medpro-input !py-0 !px-2.5 h-9 text-xs font-mono font-bold bg-clinic-bg text-clinic-text-secondary cursor-not-allowed select-none tabular-nums"
                        title="Mã phiếu thu do hệ thống tự sinh, không thể chỉnh sửa"
                    />
                </div>
                <div className="lg:col-span-3">
                    <label className="medpro-label mb-1">Hồ sơ bệnh nhân</label>
                    <select
                        value={form.maBN || ''}
                        onChange={(e) => onSelectPatientAutoFill(e.target.value)}
                        className="medpro-input !py-1.5 !px-2.5 h-9 text-xs font-semibold truncate"
                    >
                        <option value="">-- Chọn BN hoặc nhập tay --</option>
                        {patients.map((patient) => (
                            <option key={patient.id} value={patient.maBN}>
                                {patient.maBN} — {patient.hoTen}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="lg:col-span-3">
                    <label className="medpro-label mb-1">Họ tên người nộp</label>
                    <input
                        type="text"
                        value={form.hoTenBN || ''}
                        onChange={(e) => setForm({ ...form, hoTenBN: e.target.value })}
                        className="medpro-input !py-0 !px-2.5 h-9 text-xs font-semibold"
                    />
                </div>

                <div className="sm:col-span-2 lg:col-span-6">
                    <label className="medpro-label mb-1">Diễn giải nội dung *</label>
                    <input
                        type="text"
                        value={form.tenPhieu || ''}
                        onChange={(e) => setForm({ ...form, tenPhieu: e.target.value })}
                        placeholder="VD: Khám chuyên khoa và dịch vụ cận lâm sàng..."
                        className="medpro-input !py-0 h-9 text-xs font-semibold"
                    />
                </div>
                <div className="lg:col-span-3">
                    <div className="flex items-center justify-between mb-1">
                        <label className="medpro-label !mb-0">Hình thức thanh toán</label>
                        {(form.hinhThuc === 'Chuyển khoản' ||
                            form.hinhThuc === 'Chuyển khoản QR (SePay / VietQR)') && (
                            <button
                                type="button"
                                onClick={() => onOpenQr(form)}
                                className="text-xs font-bold text-clinic-cta hover:text-clinic-navy flex items-center gap-1 cursor-pointer"
                            >
                                <QrCode size={14} weight="bold" />
                                <span>Mở mã QR</span>
                            </button>
                        )}
                    </div>
                    <select
                        value={form.hinhThuc || paymentMethods[0]?.value}
                        onChange={(e) => {
                            const val = e.target.value
                            setForm({ ...form, hinhThuc: val })
                            if (val === 'Chuyển khoản') {
                                onOpenQr({ ...form, hinhThuc: val })
                            }
                        }}
                        className="medpro-input !py-1.5 !px-2.5 h-9 text-xs font-semibold truncate"
                    >
                        {paymentMethods.map((method) => (
                            <option key={method.value} value={method.value}>
                                {method.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="lg:col-span-3">
                    <label className="medpro-label mb-1">Trạng thái thanh toán</label>
                    <div className="h-9 flex items-center gap-2 px-3 rounded-[6px] border border-clinic-border-strong bg-clinic-bg">
                        <input
                            id="chk-dathu"
                            type="checkbox"
                            checked={Boolean(form.daThu)}
                            onChange={(e) => setForm({ ...form, daThu: e.target.checked })}
                            className="w-4 h-4 accent-clinic-cta"
                        />
                        <label
                            htmlFor="chk-dathu"
                            className="text-xs font-bold text-clinic-navy cursor-pointer whitespace-nowrap truncate"
                        >
                            {form.daThu ? 'Đã thu tiền' : 'Chưa thu tiền'}
                        </label>
                    </div>
                </div>
            </div>

            <div>
                <div className="medpro-section-title">
                    <span>CHI TIẾT CÁC KHOẢN VIỆN PHÍ TRONG PHIẾU ({form.items?.length || 0} KHOẢN)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end mb-3 p-3 rounded-[6px] bg-clinic-bg border border-clinic-border">
                    <div className="sm:col-span-5">
                        <label className="medpro-label mb-1">Chọn hoặc nhập tên khoản thu</label>
                        <input
                            type="text"
                            list="khoan-muc-datalist"
                            value={newItemName}
                            onChange={(e) => {
                                setNewItemName(e.target.value)
                                const matched = khoanThuCatalog.find((k) => k.ten === e.target.value)
                                if (matched) setNewItemAmount(matched.donGiaMacDinh)
                            }}
                            className="medpro-input !py-0 h-9 text-xs"
                        />
                        <datalist id="khoan-muc-datalist">
                            {khoanThuCatalog.map((k) => (
                                <option key={k.id} value={k.ten} />
                            ))}
                        </datalist>
                    </div>
                    <div className="sm:col-span-3">
                        <label className="medpro-label mb-1">Số tiền (VNĐ)</label>
                        <input
                            type="number"
                            value={newItemAmount}
                            onChange={(e) => setNewItemAmount(e.target.value)}
                            className="medpro-input !py-0 h-9 text-xs tabular-nums font-bold"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="medpro-label mb-1">Ghi chú</label>
                        <input
                            type="text"
                            value={newItemNote}
                            onChange={(e) => setNewItemNote(e.target.value)}
                            className="medpro-input !py-0 h-9 text-xs"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <button
                            type="button"
                            onClick={onAddLineItem}
                            className="medpro-btn-primary h-9 w-full rounded-[6px] text-xs whitespace-nowrap"
                        >
                            <Plus size={14} weight="bold" />
                            <span>Thêm khoản</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                    <table className="medpro-table">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Nội dung khoản thu</th>
                                <th>Số tiền (VNĐ)</th>
                                <th>Ghi chú</th>
                                <th>Xóa</th>
                            </tr>
                        </thead>
                        <tbody className="tabular-nums">
                            {(form.items || []).map((lineItem, idx) => (
                                <tr key={lineItem.id}>
                                    <td className="font-bold">{idx + 1}</td>
                                    <td className="font-semibold text-clinic-navy">{lineItem.tenKhoan}</td>
                                    <td className="font-bold text-clinic-navy">
                                        {Number(lineItem.soTien).toLocaleString('vi-VN')} đ
                                    </td>
                                    <td>{lineItem.ghiChu}</td>
                                    <td>
                                        <button
                                            type="button"
                                            onClick={() => onRemoveLineItem(lineItem.id)}
                                            className="inline-flex items-center gap-1 text-clinic-danger text-xs font-bold hover:underline cursor-pointer"
                                        >
                                            <Trash size={13} weight="bold" />
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
                                            description="Chọn bệnh nhân để tự động lấy dịch vụ hoặc thêm khoản thu ở trên."
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-3 p-3.5 rounded-[6px] bg-clinic-navy text-clinic-surface flex items-center justify-between tabular-nums">
                    <span className="font-bold text-xs">
                        TỔNG THANH TOÁN:
                    </span>
                    <span className="font-display text-xl font-extrabold text-clinic-amber">
                        {Number(form.tongTien || 0).toLocaleString('vi-VN')} VNĐ
                    </span>
                </div>
            </div>
        </div>
    )
}
