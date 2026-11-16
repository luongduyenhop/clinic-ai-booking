import {
    StatusBadge,
    DownloadSimple,
} from '../../common/ClinicIcon'

export default function ExportServiceModal({
    isOpen,
    onClose,
    loading,
    exportedServices,
    handleDownloadServicesCsv,
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-[#F8FAFC]">
                    <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-xl bg-[#003553] text-[#00B5F1] flex items-center justify-center">
                            <DownloadSimple size={20} weight="bold" />
                        </span>
                        <div>
                            <h3 className="font-display font-extrabold text-sm text-[#003553]">
                                BẢNG GIÁ DỊCH VỤ KỸ THUẬT & CẬN LÂM SÀNG CHUẨN HÓA
                            </h3>
                            <p className="text-xs text-slate-500">
                                Dữ liệu xuất tự động từ API Backend /api/v1/admin/services/export chuẩn hóa theo Thông tư Bộ Y Tế
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleDownloadServicesCsv}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                            <DownloadSimple size={14} weight="bold" />
                            <span>Tải file Excel danh mục</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer font-bold"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="p-4 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="py-12 text-center text-slate-500 text-xs">
                            Đang tổng hợp danh mục kỹ thuật và doanh thu tích lũy...
                        </div>
                    ) : (
                        <table className="medpro-table text-xs">
                            <thead>
                                <tr>
                                    <th>Mã DV</th>
                                    <th>Tên dịch vụ kỹ thuật</th>
                                    <th>Nhóm</th>
                                    <th>Đơn vị tính</th>
                                    <th className="text-right">Đơn giá niêm yết</th>
                                    <th className="text-center">Thuế VAT</th>
                                    <th className="text-right">Giá sau VAT</th>
                                    <th className="text-center">Thời gian (phút)</th>
                                    <th className="text-center">Số lượt làm</th>
                                    <th className="text-right">Doanh thu</th>
                                    <th className="text-center">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {exportedServices.map((s, idx) => (
                                    <tr key={s.id || idx}>
                                        <td className="font-mono font-bold text-[#003553]">{s.ma_dich_vu}</td>
                                        <td className="font-bold text-[#12263F]">{s.ten_dich_vu}</td>
                                        <td className="text-slate-500">{s.nhom_dich_vu || 'Khám bệnh'}</td>
                                        <td>
                                            <span className="px-2 py-0.5 rounded-md bg-sky-50 text-[#00B5F1] font-bold border border-sky-100">
                                                {s.don_vi_tinh || 'Lần'}
                                            </span>
                                        </td>
                                        <td className="text-right font-mono font-bold text-slate-700">
                                            {Number(s.don_gia).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="text-center font-bold text-slate-600">
                                            {s.vat_percent || 0}%
                                        </td>
                                        <td className="text-right font-mono font-extrabold text-[#003553]">
                                            {Number(s.don_gia_sau_vat || s.don_gia).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="text-center font-semibold text-slate-600">
                                            {s.thoi_gian_thuc_hien || 15}p
                                        </td>
                                        <td className="text-center font-bold text-indigo-600">
                                            {s.so_luong_da_lam || 0}
                                        </td>
                                        <td className="text-right font-mono font-extrabold text-emerald-600">
                                            {Number(s.doanh_thu_tich_luy || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="text-center">
                                            <StatusBadge status={s.trang_thai ? 'Áp dụng' : 'Tạm ngưng'} compact />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50 text-xs">
                    <span className="text-slate-500">
                        Tổng số dịch vụ: <strong>{exportedServices.length}</strong> &bull; Tổng doanh thu tích lũy: <strong className="text-emerald-600">{exportedServices.reduce((acc, cur) => acc + (Number(cur.doanh_thu_tich_luy) || 0), 0).toLocaleString('vi-VN')} đ</strong>
                    </span>
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
