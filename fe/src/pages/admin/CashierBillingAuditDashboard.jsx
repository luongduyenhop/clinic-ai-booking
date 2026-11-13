import { useEffect, useState } from 'react'
import {
    CurrencyCircleDollar,
    QrCode,
    CheckCircle,
    Clock,
    ArrowsClockwise,
    Receipt,
    CreditCard,
    ShieldCheck,
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
                phuong_thuc_thanh_toan: 'VIETQR',
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

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                        <CurrencyCircleDollar size={28} weight="bold" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Thu Ngân & Đối Soát Viện Phí VietQR</h1>
                        <p className="text-sm text-slate-500">Giám sát bảng kê viện phí và xác nhận giao dịch thanh toán Napas 247</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchPendingBills}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                    >
                        <ArrowsClockwise size={18} className={loading ? 'animate-spin' : ''} />
                        Làm mới
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Clock size={22} weight="bold" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase">Hóa đơn chờ thu</div>
                        <div className="text-2xl font-bold text-slate-800">{pendingBills.length}</div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                        <QrCode size={22} weight="bold" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase">Cổng thanh toán</div>
                        <div className="text-sm font-bold text-teal-700">VietQR Napas 247 Động</div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <ShieldCheck size={22} weight="bold" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase">Bảo mật giao dịch</div>
                        <div className="text-sm font-bold text-emerald-700">HMAC-SHA256 Webhook</div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Receipt size={20} />
                        Danh sách phiếu thu chờ thanh toán
                    </div>
                    <input
                        type="text"
                        placeholder="Tìm theo mã hóa đơn hoặc tên bệnh nhân..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="w-full md:w-80 px-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:border-sky-500"
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
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
                        <tbody className="divide-y divide-slate-100">
                            {filteredBills.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                                        Không có hóa đơn nào đang chờ thu
                                    </td>
                                </tr>
                            ) : (
                                filteredBills.map((bill) => (
                                    <tr key={bill.id} className="hover:bg-slate-50/80 transition">
                                        <td className="px-5 py-3 font-semibold text-slate-800">
                                            {bill.ma_hoa_don || bill.invoice_code || `#${bill.id}`}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="font-medium text-slate-800">
                                                {bill.benh_nhan?.ho_ten || 'N/A'}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {bill.benh_nhan?.mabn || ''}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 font-medium text-slate-700">
                                            {Number(bill.tong_tien || bill.total_service_amount || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="px-5 py-3 text-amber-600 font-medium">
                                            {Number(bill.mien_giam || bill.discount_amount || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="px-5 py-3 font-bold text-teal-600">
                                            {Number(bill.thuc_thu || bill.final_amount || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                                {bill.trang_thai || bill.status || 'Chờ thu'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <button
                                                onClick={() => handleOpenVietQr(bill)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs transition"
                                            >
                                                <QrCode size={16} />
                                                VietQR
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
