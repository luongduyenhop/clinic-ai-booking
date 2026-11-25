import {
    StatusBadge,
    DownloadSimple,
    X,
} from '../../common/ClinicIcon'

export default function ExportServiceModal({
    isOpen,
    onClose,
    loading,
    exportedServices,
    handleDownloadServicesCsv,
}) {
    if (!isOpen) return null

    const totalAccumulated = exportedServices.reduce(
        (acc, cur) => acc + (Number(cur.doanh_thu_tich_luy) || 0),
        0
    )

    return (
        <div className="fixed inset-0 bg-clinic-navy-dark/50 z-50 flex items-center justify-center p-4">
            <div className="bg-clinic-surface rounded-[6px] shadow-xs max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-clinic-border">
                <div className="px-4 py-3 border-b border-clinic-border flex items-center justify-between bg-clinic-bg">
                    <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-[6px] bg-clinic-navy text-clinic-surface flex items-center justify-center shrink-0">
                            <DownloadSimple size={17} weight="bold" />
                        </span>
                        <div>
                            <h3 className="font-display font-bold text-sm text-clinic-navy">
                                Bảng giá dịch vụ kỹ thuật &amp; Cận lâm sàng chuẩn hóa
                            </h3>
                            <p className="text-xs text-clinic-text-secondary">
                                Dữ liệu tổng hợp trực tiếp từ hệ thống chuẩn hóa theo quy định Bộ Y tế
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleDownloadServicesCsv}
                            className="medpro-btn-primary !py-1.5 !px-3 text-xs"
                        >
                            <DownloadSimple size={14} weight="bold" />
                            <span>Tải file Excel danh mục</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-[6px] border border-clinic-border bg-clinic-surface hover:bg-clinic-bg-muted text-clinic-text-secondary flex items-center justify-center cursor-pointer"
                        >
                            <X size={15} weight="bold" />
                        </button>
                    </div>
                </div>

                <div className="p-4 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="py-12 text-center text-clinic-text-muted text-xs">
                            Đang tổng hợp danh mục kỹ thuật và doanh thu tích lũy...
                        </div>
                    ) : (
                        <table className="medpro-table text-xs tabular-nums">
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
                                        <td className="font-mono font-bold text-clinic-navy">{s.ma_dich_vu}</td>
                                        <td className="font-bold text-clinic-text">{s.ten_dich_vu}</td>
                                        <td className="text-clinic-text-secondary">{s.nhom_dich_vu || 'Khám bệnh'}</td>
                                        <td>
                                            <span className="medpro-badge-info">
                                                {s.don_vi_tinh || 'Lần'}
                                            </span>
                                        </td>
                                        <td className="text-right font-mono font-bold text-clinic-text-secondary">
                                            {Number(s.don_gia).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="text-center font-bold text-clinic-text-secondary">
                                            {s.vat_percent || 0}%
                                        </td>
                                        <td className="text-right font-mono font-bold text-clinic-navy">
                                            {Number(s.don_gia_sau_vat || s.don_gia).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="text-center font-semibold text-clinic-text-secondary">
                                            {s.thoi_gian_thuc_hien || 15}p
                                        </td>
                                        <td className="text-center font-bold text-clinic-cta">
                                            {s.so_luong_da_lam || 0}
                                        </td>
                                        <td className="text-right font-mono font-bold text-clinic-success">
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

                <div className="px-4 py-3 border-t border-clinic-border flex items-center justify-between bg-clinic-bg text-xs tabular-nums">
                    <span className="text-clinic-text-secondary">
                        Tổng số dịch vụ: <strong className="text-clinic-navy">{exportedServices.length}</strong> &bull; Tổng doanh thu tích lũy:{' '}
                        <strong className="text-clinic-success">{totalAccumulated.toLocaleString('vi-VN')} đ</strong>
                    </span>
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
