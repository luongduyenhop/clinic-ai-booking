export default function CashierClosingTab({ cashierClosings }) {
    return (
        <div className="medpro-card p-4 space-y-4">
            <div className="medpro-section-title">
                <span>NHẬT KÝ KHÓA SỔ &amp; ĐỐI SOÁT DOANH THU CA TRỰC</span>
            </div>
            <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                <table className="medpro-table">
                    <thead>
                        <tr>
                            <th>Mã kỳ khóa sổ</th>
                            <th>Thời điểm khóa sổ</th>
                            <th>Thu ngân phụ trách</th>
                            <th>Thu dịch vụ kỹ thuật</th>
                            <th>Tổng doanh thu ca</th>
                            <th>Cơ chế</th>
                            <th>Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody className="tabular-nums">
                        {cashierClosings.map((closing) => (
                            <tr key={closing.id}>
                                <td className="font-mono font-bold text-clinic-cta">{closing.maKyKhoaSo}</td>
                                <td className="text-xs font-semibold text-clinic-text">{closing.ngayKhoaSo}</td>
                                <td className="font-bold text-clinic-navy">{closing.nguoiKhoaSo}</td>
                                <td className="font-medium text-clinic-text">
                                    {(closing.tongThuDichVu || 0).toLocaleString('vi-VN')} đ
                                </td>
                                <td className="font-extrabold text-clinic-navy">
                                    {(closing.tonQuyCuoiNgay ?? closing.tongThuDichVu ?? 0).toLocaleString('vi-VN')} đ
                                </td>
                                <td className="text-xs text-clinic-text-secondary">{closing.cheDo}</td>
                                <td>
                                    <span
                                        className={
                                            closing.trangThai?.includes('Đã khóa')
                                                ? 'medpro-badge-success'
                                                : 'medpro-badge-warning'
                                        }
                                    >
                                        {closing.trangThai}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
