import { ClinicIcon, X } from '../../common/ClinicIcon'

export default function PriceHistoryModal({
    isOpen,
    onClose,
    loading,
    history,
    form,
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-clinic-navy-dark/50 z-50 flex items-center justify-center p-4">
            <div className="bg-clinic-surface rounded-[6px] shadow-xs max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-clinic-border">
                <div className="px-4 py-3 border-b border-clinic-border flex items-center justify-between bg-clinic-bg">
                    <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-[6px] bg-clinic-navy text-clinic-surface flex items-center justify-center shrink-0">
                            <ClinicIcon name="ClockCounterClockwise" size={17} weight="bold" />
                        </span>
                        <div>
                            <h3 className="font-display font-bold text-sm text-clinic-navy">
                                Lịch sử điều chỉnh giá dịch vụ
                            </h3>
                            <p className="text-xs text-clinic-text-secondary">
                                Vết kiểm toán giá cho dịch vụ {form.maDV} - {form.tenDV}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-[6px] border border-clinic-border bg-clinic-surface hover:bg-clinic-bg-muted text-clinic-text-secondary flex items-center justify-center cursor-pointer"
                    >
                        <X size={15} weight="bold" />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="py-8 text-center text-clinic-text-muted text-xs">Đang tải lịch sử kiểm toán...</div>
                    ) : history.length === 0 ? (
                        <div className="py-8 text-center text-clinic-text-muted text-xs">Chưa ghi nhận thay đổi giá nào</div>
                    ) : (
                        <table className="medpro-table text-xs tabular-nums">
                            <thead>
                                <tr>
                                    <th>Thời gian</th>
                                    <th>Người điều chỉnh</th>
                                    <th className="text-right">Giá cũ</th>
                                    <th className="text-right">Giá mới</th>
                                    <th>Lý do điều chỉnh</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h) => (
                                    <tr key={h.id}>
                                        <td className="font-mono text-clinic-text-secondary">
                                            {h.timestamp ? new Date(h.timestamp).toLocaleString('vi-VN') : ''}
                                        </td>
                                        <td className="font-semibold text-clinic-navy">{h.user_role} (ID: {h.user_id})</td>
                                        <td className="text-right font-mono font-bold text-clinic-text-secondary">
                                            {h.noi_dung_cu?.don_gia ? Number(h.noi_dung_cu.don_gia).toLocaleString('vi-VN') + ' đ' : '-'}
                                        </td>
                                        <td className="text-right font-mono font-bold text-clinic-success">
                                            {h.noi_dung_moi?.don_gia ? Number(h.noi_dung_moi.don_gia).toLocaleString('vi-VN') + ' đ' : '-'}
                                        </td>
                                        <td className="text-clinic-text-secondary">{h.purpose}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="px-4 py-3 border-t border-clinic-border flex justify-end bg-clinic-bg">
                    <button
                        type="button"
                        onClick={onClose}
                        className="medpro-btn-outline text-xs !py-1.5 !px-3"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    )
}
