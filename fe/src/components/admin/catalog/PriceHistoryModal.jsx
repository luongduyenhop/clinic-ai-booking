import { ClinicIcon } from '../../common/ClinicIcon'

export default function PriceHistoryModal({
    isOpen,
    onClose,
    loading,
    history,
    form,
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-100">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-[#F8FAFC]">
                    <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-xl bg-[#003553] text-[#00B5F1] flex items-center justify-center">
                            <ClinicIcon name="ClockCounterClockwise" size={20} weight="bold" />
                        </span>
                        <div>
                            <h3 className="font-display font-extrabold text-sm text-[#003553]">
                                LỊCH SỬ ĐIỀU CHỈNH GIÁ DỊCH VỤ BẤT BIẾN
                            </h3>
                            <p className="text-xs text-slate-500">
                                Vết kiểm toán độc lập bảo toàn giá lịch sử cho dịch vụ {form.maDV} - {form.tenDV}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold"
                    >
                        ✕
                    </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="py-8 text-center text-slate-500 text-xs">Đang tải lịch sử kiểm toán...</div>
                    ) : history.length === 0 ? (
                        <div className="py-8 text-center text-slate-500 text-xs">Chưa có lịch sử điều chỉnh giá nào cho dịch vụ này</div>
                    ) : (
                        <table className="medpro-table text-xs">
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
                                        <td className="font-mono text-slate-600">
                                            {h.timestamp ? new Date(h.timestamp).toLocaleString('vi-VN') : ''}
                                        </td>
                                        <td className="font-semibold text-slate-700">{h.user_role} (ID: {h.user_id})</td>
                                        <td className="text-right font-mono font-bold text-slate-500">
                                            {h.noi_dung_cu?.don_gia ? Number(h.noi_dung_cu.don_gia).toLocaleString('vi-VN') + ' đ' : '-'}
                                        </td>
                                        <td className="text-right font-mono font-bold text-emerald-600">
                                            {h.noi_dung_moi?.don_gia ? Number(h.noi_dung_moi.don_gia).toLocaleString('vi-VN') + ' đ' : '-'}
                                        </td>
                                        <td className="text-slate-600">{h.purpose}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="px-5 py-3 border-t border-slate-100 flex justify-end bg-slate-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="medpro-btn-outline text-xs !py-1"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    )
}
