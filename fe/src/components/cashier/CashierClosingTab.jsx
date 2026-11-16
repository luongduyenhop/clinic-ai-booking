export default function CashierClosingTab({ cashierClosings }) {
    return (
        <div className="medpro-card p-4 space-y-4">
            <div className="medpro-section-title">
                <span>NHẬT KÝ KHÓA SỔ TỰ ĐỘNG & DOANH THU VIỆN PHÍ (/khoaso)</span>
            </div>
            <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
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
                    <tbody>
                        {cashierClosings.map((closing) => (
                            <tr key={closing.id}>
                                <td className="font-mono font-bold text-[#00B5F1]">{closing.maKyKhoaSo}</td>
                                <td className="tabular-nums text-xs font-semibold">{closing.ngayKhoaSo}</td>
                                <td className="font-bold text-[#003553]">{closing.nguoiKhoaSo}</td>
                                <td className="tabular-nums font-mono">
                                    {(closing.tongThuDichVu || 0).toLocaleString('vi-VN')} đ
                                </td>
                                <td className="tabular-nums font-mono font-black text-[#003553]">
                                    {(closing.tonQuyCuoiNgay ?? closing.tongThuDichVu ?? 0).toLocaleString('vi-VN')} đ
                                </td>
                                <td className="text-xs text-slate-500">{closing.cheDo}</td>
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
