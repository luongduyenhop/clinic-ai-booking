import { useEffect, useState } from 'react'
import {
    CurrencyCircleDollar,
    QrCode,
    ArrowsClockwise,
    Receipt,
} from '@phosphor-icons/react'
import apiClient from '../../services/api'
import VietQrModal from '../../components/common/VietQrModal'
import { AppToast } from '../../components/common/AppNotification'

export default function CashierBillingAuditDashboard() {
    const [pendingBills, setPendingBills] = useState([])
    const [loading, setLoading] = useState(false)
    const [selectedInvoice, setSelectedInvoice] = useState(null)
    const [showQrModal, setShowQrModal] = useState(false)
    const [filterText, setFilterText] = useState('')

    const fetchPendingBills = async () => {
        setLoading(true)
        try {
            const res = await apiClient.get('/cashier/pending-bills')
            const list = res?.data?.data?.items || res?.data?.items || []
            setPendingBills(list)
        } catch {
            AppToast.error('Không thể tải danh sách hóa đơn viện phí')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPendingBills()
    }, [])

    const handleOpenVietQr = (invoice) => {
        setSelectedInvoice(invoice)
        setShowQrModal(true)
    }

    const handleConfirmPayment = async (inv) => {
        const invId = inv.id || inv.ma_hoa_don
        try {
            await apiClient.post(`/cashier/invoices/${invId}/pay`, {
                phuong_thuc_thanh_toan: 'chuyen_khoan',
                so_tien_khach_tra: inv.thuc_thu || inv.final_amount || inv.tong_tien,
                ghi_chu: 'Thanh toan VietQR Napas 247'
            })
            AppToast.success(`Hóa đơn #${invId} đã được thanh toán thành công`)
            fetchPendingBills()
        } catch (err) {
            AppToast.error(err?.response?.data?.message || 'Lỗi khi ghi nhận thanh toán')
        }
    }

    const filteredBills = pendingBills.filter((bill) => {
        if (!filterText) return true
        const text = filterText.toLowerCase()
        const code = (bill.ma_hoa_don || bill.invoice_code || '').toLowerCase()
        const name = (bill.benh_nhan?.ho_ten || '').toLowerCase()
        return code.includes(text) || name.includes(text)
    })

    const totalNetReceivable = pendingBills.reduce(
        (sum, bill) => sum + Number(bill.thuc_thu ?? bill.final_amount ?? bill.tong_tien ?? bill.total_service_amount ?? 0),
        0
    )
    const totalDiscountAmount = pendingBills.reduce(
        (sum, bill) => sum + Number(bill.mien_giam ?? bill.discount_amount ?? 0),
        0
    )

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-clinic-surface border border-clinic-border rounded-[6px] px-4 py-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-[6px] bg-clinic-surface-alt text-clinic-cta border border-clinic-info-border flex items-center justify-center shrink-0">
                        <CurrencyCircleDollar size={20} weight="bold" />
                    </div>
                    <div>
                        <h1 className="text-base font-extrabold text-clinic-navy">Thu Ngân &amp; Đối Soát Viện Phí VietQR</h1>
                        <p className="text-xs text-clinic-text-secondary">Giám sát bảng kê viện phí chờ thu và đối soát thanh toán QR</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <input
                        type="text"
                        aria-label="Tìm theo mã hóa đơn hoặc tên bệnh nhân"
                        placeholder="Tìm mã hóa đơn hoặc tên BN..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="medpro-input w-64 text-xs h-9"
                    />
                    <button
                        type="button"
                        onClick={fetchPendingBills}
                        disabled={loading}
                        className="medpro-btn-outline flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[6px] h-9 cursor-pointer"
                    >
                        <ArrowsClockwise size={15} className={loading ? 'animate-spin' : ''} />
                        <span>Làm mới</span>
                    </button>
                </div>
            </div>

            <div className="medpro-card grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-clinic-border tabular-nums overflow-hidden">
                <div className="p-4 bg-clinic-surface">
                    <div className="text-xs font-semibold text-clinic-text-secondary">Số hóa đơn chờ thu</div>
                    <div className="text-2xl font-display font-extrabold text-clinic-navy mt-1">
                        {pendingBills.length} phiếu
                    </div>
                </div>
                <div className="p-4 bg-clinic-surface">
                    <div className="text-xs font-semibold text-clinic-text-secondary">Tổng viện phí chờ thanh toán</div>
                    <div className="text-2xl font-display font-extrabold text-clinic-cta mt-1">
                        {totalNetReceivable.toLocaleString('vi-VN')} đ
                    </div>
                </div>
                <div className="p-4 bg-clinic-surface">
                    <div className="text-xs font-semibold text-clinic-text-secondary">Tổng miễn giảm / BHYT</div>
                    <div className="text-2xl font-display font-extrabold text-clinic-navy mt-1">
                        {totalDiscountAmount.toLocaleString('vi-VN')} đ
                    </div>
                </div>
            </div>

            <div className="medpro-card bg-clinic-surface overflow-hidden">
                <div className="px-4 py-3 border-b border-clinic-border flex items-center justify-between gap-4">
                    <div className="text-sm font-bold text-clinic-navy flex items-center gap-2">
                        <Receipt size={18} />
                        <span>Danh sách phiếu thu chờ thanh toán ({filteredBills.length})</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-clinic-text-secondary">
                        <thead className="bg-clinic-bg text-xs font-semibold text-clinic-navy border-b border-clinic-border">
                            <tr>
                                <th className="px-5 py-3">Mã Hóa Đơn</th>
                                <th className="px-5 py-3">Bệnh Nhân</th>
                                <th className="px-5 py-3">Tổng Viện Phí</th>
                                <th className="px-5 py-3">Miễn Giảm</th>
                                <th className="px-5 py-3">Thực Thu</th>
                                <th className="px-5 py-3">Trạng Thái</th>
                                <th className="px-5 py-3 text-right">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-clinic-border tabular-nums">
                            {filteredBills.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-8 text-center text-clinic-text-muted">
                                        Không có hóa đơn nào đang chờ thu
                                    </td>
                                </tr>
                            ) : (
                                filteredBills.map((bill) => (
                                    <tr key={bill.id} className="hover:bg-clinic-surface-tint transition">
                                        <td className="px-5 py-3 font-semibold text-clinic-navy">
                                            {bill.ma_hoa_don || bill.invoice_code || `#${bill.id}`}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="font-medium text-clinic-navy">
                                                {bill.benh_nhan?.ho_ten || 'N/A'}
                                            </div>
                                            <div className="text-xs text-clinic-text-muted">
                                                {bill.benh_nhan?.mabn || ''}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 font-medium text-clinic-text">
                                            {Number(bill.tong_tien || bill.total_service_amount || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="px-5 py-3 text-clinic-warning font-medium">
                                            {Number(bill.mien_giam || bill.discount_amount || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="px-5 py-3 font-bold text-clinic-cta">
                                            {Number(bill.thuc_thu || bill.final_amount || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="medpro-badge-warning px-2.5 py-1 text-xs font-semibold">
                                                {bill.trang_thai || bill.status || 'Chờ thu'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenVietQr(bill)}
                                                className="medpro-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[6px] cursor-pointer"
                                            >
                                                <QrCode size={16} />
                                                <span>VietQR</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedInvoice && (
                <VietQrModal
                    isOpen={showQrModal}
                    onClose={() => {
                        setShowQrModal(false)
                        setSelectedInvoice(null)
                    }}
                    onConfirmPayment={handleConfirmPayment}
                    invoice={selectedInvoice}
                />
            )}
        </div>
    )
}
