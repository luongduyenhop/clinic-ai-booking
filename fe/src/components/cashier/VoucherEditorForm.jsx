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
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E8F4FD]">
                <div>
                    <h2 className="font-display text-base font-extrabold text-[#003553] uppercase">
                        QUẢN LÝ THU VIỆN PHÍ & BIÊN LAI PHÒNG KHÁM
                    </h2>
                    <p className="text-xs text-slate-500">
                        Lập phiếu thu viện phí tự động từ chỉ định dịch vụ & in biên lai thu tiền
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={onResetForm}
                        className="medpro-btn-outline text-xs"
                    >
                        <Plus size={14} weight="bold" className="text-[#00B5F1]" />
                        <span>Lập phiếu thu mới</span>
                    </button>
                    <button
                        type="button"
                        onClick={onSaveVoucher}
                        className="medpro-btn-primary text-xs"
                    >
                        <FloppyDisk size={15} weight="bold" />
                        <span>Lưu phiếu</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onOpenQr(form)}
                        className="medpro-btn-outline text-xs font-bold border-teal-500 text-teal-700 hover:bg-teal-50 flex items-center gap-1.5 cursor-pointer"
                        title="Tạo mã QR thanh toán viện phí (SePay / VietQR)"
                    >
                        <QrCode size={15} weight="bold" />
                        <span>Mã QR SePay / VietQR</span>
                    </button>
                    <button
                        type="button"
                        onClick={onOpenReceiptModal}
                        className="medpro-btn-amber text-xs font-bold"
                    >
                        <Printer size={15} weight="bold" />
                        <span>In biên lai thu tiền</span>
                    </button>
                    {form.id && (
                        <button
                            type="button"
                            onClick={onDeleteVoucher}
                            className="medpro-btn-danger text-xs"
                        >
                            <Trash size={14} weight="bold" />
                            <span>Xóa</span>
                        </button>
                    )}
                </div>
            </div>

            {form.isCombined && (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-sky-800 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#00B5F1] animate-pulse"></span>
                        <span>
                            Đang thu gộp toàn bộ {form.items?.length || 0} dịch vụ của BN {form.hoTenBN}. Bấm &quot;Lưu phiếu&quot; hoặc &quot;Mã VietQR&quot; để thanh toán tất cả cùng lúc!
                        </span>
                    </div>
                    <div className="font-extrabold tabular-nums text-[#003553] text-sm bg-white px-2.5 py-1 rounded-lg border border-sky-100 shadow-xs">
                        Tổng thu gộp: {Number(form.tongTien || 0).toLocaleString('vi-VN')} đ
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                    <label className="medpro-label">Loại chứng từ</label>
                    <div className="h-[34px] flex items-center px-3 rounded-lg border border-sky-200 bg-sky-50 text-[#003553] font-bold text-xs select-none">
                        Phiếu thu viện phí
                    </div>
                </div>
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="medpro-label mb-0">Mã phiếu thu</label>
                        <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                            Hệ thống tự sinh
                        </span>
                    </div>
                    <input
                        type="text"
                        value={form.maPhieu || ''}
                        readOnly
                        disabled
                        className="medpro-input font-mono font-bold bg-slate-100 text-slate-500 cursor-not-allowed select-none"
                        title="Mã phiếu thu do hệ thống tự sinh, không thể chỉnh sửa"
                    />
                </div>
                <div>
                    <label className="medpro-label">Chọn Bệnh nhân (Tự động lấy dịch vụ)</label>
                    <select
                        value={form.maBN || ''}
                        onChange={(e) => onSelectPatientAutoFill(e.target.value)}
                        className="medpro-input font-semibold"
                    >
                        <option value="">-- Chọn BN hoặc nhập tay --</option>
                        {patients.map((patient) => (
                            <option key={patient.id} value={patient.maBN}>
                                {patient.maBN} — {patient.hoTen}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="medpro-label">Họ tên người nộp / Bệnh nhân</label>
                    <input
                        type="text"
                        value={form.hoTenBN || ''}
                        onChange={(e) => setForm({ ...form, hoTenBN: e.target.value })}
                        className="medpro-input font-semibold"
                    />
                </div>

                <div className="sm:col-span-2">
                    <label className="medpro-label">Tên phiếu / Nội dung thu viện phí *</label>
                    <input
                        type="text"
                        value={form.tenPhieu || ''}
                        onChange={(e) => setForm({ ...form, tenPhieu: e.target.value })}
                        placeholder="VD: Thu viện phí BN Nguyễn Thị B..."
                        className="medpro-input font-semibold"
                    />
                </div>
                <div>
                    <div className="flex items-center justify-between">
                        <label className="medpro-label">Hình thức thanh toán</label>
                        {(form.hinhThuc === 'Chuyển khoản' ||
                            form.hinhThuc === 'Chuyển khoản QR (SePay / VietQR)') && (
                            <button
                                type="button"
                                onClick={() => onOpenQr(form)}
                                className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
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
                        className="medpro-input"
                    >
                        {paymentMethods.map((method) => (
                            <option key={method.value} value={method.value}>
                                {method.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="medpro-label">Trạng thái thanh toán</label>
                    <div className="h-[34px] flex items-center gap-2 px-3 rounded border border-[#CBD5E1] bg-[#F8FBFE]">
                        <input
                            id="chk-dathu"
                            type="checkbox"
                            checked={Boolean(form.daThu)}
                            onChange={(e) => setForm({ ...form, daThu: e.target.checked })}
                            className="w-4 h-4 accent-[#00B5F1]"
                        />
                        <label
                            htmlFor="chk-dathu"
                            className="text-xs font-bold text-[#003553] cursor-pointer"
                        >
                            {form.daThu ? 'Đã thu tiền (Hợp lệ)' : 'Chưa thu (Chờ thanh toán)'}
                        </label>
                    </div>
                </div>
            </div>

            <div>
                <div className="medpro-section-title">
                    <span>CHI TIẾT CÁC KHOẢN VIỆN PHÍ TRONG PHIẾU ({form.items?.length || 0} KHOẢN)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end mb-3 p-3 rounded-xl bg-[#F8FBFE] border border-[#CBE9FA]">
                    <div className="sm:col-span-5">
                        <label className="medpro-label">Chọn hoặc nhập tên khoản thu</label>
                        <input
                            type="text"
                            list="khoan-muc-datalist"
                            value={newItemName}
                            onChange={(e) => {
                                setNewItemName(e.target.value)
                                const matched = khoanThuCatalog.find((k) => k.ten === e.target.value)
                                if (matched) setNewItemAmount(matched.donGiaMacDinh)
                            }}
                            className="medpro-input"
                        />
                        <datalist id="khoan-muc-datalist">
                            {khoanThuCatalog.map((k) => (
                                <option key={k.id} value={k.ten} />
                            ))}
                        </datalist>
                    </div>
                    <div className="sm:col-span-3">
                        <label className="medpro-label">Số tiền (VNĐ)</label>
                        <input
                            type="number"
                            value={newItemAmount}
                            onChange={(e) => setNewItemAmount(e.target.value)}
                            className="medpro-input tabular-nums font-bold"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="medpro-label">Ghi chú</label>
                        <input
                            type="text"
                            value={newItemNote}
                            onChange={(e) => setNewItemNote(e.target.value)}
                            className="medpro-input"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <button
                            type="button"
                            onClick={onAddLineItem}
                            className="medpro-btn-primary w-full text-xs"
                        >
                            <Plus size={14} weight="bold" />
                            <span>Thêm khoản</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
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
                        <tbody>
                            {(form.items || []).map((lineItem, idx) => (
                                <tr key={lineItem.id}>
                                    <td className="tabular-nums font-bold">{idx + 1}</td>
                                    <td className="font-semibold text-[#12263F]">{lineItem.tenKhoan}</td>
                                    <td className="tabular-nums font-bold text-[#003553]">
                                        {Number(lineItem.soTien).toLocaleString('vi-VN')} đ
                                    </td>
                                    <td>{lineItem.ghiChu}</td>
                                    <td>
                                        <button
                                            type="button"
                                            onClick={() => onRemoveLineItem(lineItem.id)}
                                            className="inline-flex items-center gap-1 text-rose-600 text-xs font-bold hover:underline cursor-pointer"
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

                <div className="mt-3 p-3.5 rounded-xl bg-[#003553] text-white flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider">
                        TỔNG CỘNG TIỀN VIỆN PHÍ (PHIẾU THU):
                    </span>
                    <span className="font-display text-xl font-extrabold text-[#FFB54A] tabular-nums">
                        {Number(form.tongTien || 0).toLocaleString('vi-VN')} VNĐ
                    </span>
                </div>
            </div>
        </div>
    )
}
