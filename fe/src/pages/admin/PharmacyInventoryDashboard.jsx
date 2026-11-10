import { useEffect, useState } from 'react'
import {
    Pill,
    Warning,
    PlusCircle,
    ArrowsClockwise,
    Package,
    CalendarCheck,
    CheckCircle,
} from '@phosphor-icons/react'
import apiClient from '../../services/api'
import { AppToast } from '../../components/common/AppNotification'

export default function PharmacyInventoryDashboard() {
    const [batches, setBatches] = useState([])
    const [loading, setLoading] = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)
    const [showDispenseModal, setShowDispenseModal] = useState(false)
    const [dispensePrescriptionId, setDispensePrescriptionId] = useState('')
    const [dispensing, setDispensing] = useState(false)

    const [importForm, setImportForm] = useState({
        drug_id: '',
        batch_number: '',
        expiry_date: '',
        physical_stock: '',
        import_price: '',
    })

    const fetchBatches = async () => {
        setLoading(true)
        try {
            const res = await apiClient.get('/pharmacy/inventory/batches')
            const list = res?.data?.data || []
            setBatches(list)
        } catch {
            AppToast.error('Không thể tải danh sách tồn kho dược FEFO')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchBatches()
    }, [])

    const handleImportSubmit = async (e) => {
        e.preventDefault()
        try {
            await apiClient.post('/pharmacy/inventory/import', {
                drug_id: Number(importForm.drug_id),
                batch_number: importForm.batch_number.trim(),
                expiry_date: importForm.expiry_date,
                physical_stock: Number(importForm.physical_stock),
                import_price: Number(importForm.import_price),
            })
            AppToast.success(`Nhập kho lô ${importForm.batch_number} thành công`)
            setShowImportModal(false)
            setImportForm({
                drug_id: '',
                batch_number: '',
                expiry_date: '',
                physical_stock: '',
                import_price: '',
            })
            fetchBatches()
        } catch (err) {
            AppToast.error(err?.response?.data?.message || 'Lỗi khi nhập kho thuốc')
        }
    }

    const handleDispenseSubmit = async (e) => {
        e.preventDefault()
        if (!dispensePrescriptionId) return
        setDispensing(true)
        try {
            const res = await apiClient.post(`/pharmacy/prescriptions/${dispensePrescriptionId}/dispense`)
            AppToast.success(res?.data?.message || 'Cấp phát thuốc theo chuẩn FEFO thành công')
            setShowDispenseModal(false)
            setDispensePrescriptionId('')
            fetchBatches()
        } catch (err) {
            AppToast.error(err?.response?.data?.message || 'Lỗi khi xuất kho cấp phát đơn thuốc')
        } finally {
            setDispensing(false)
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                        <Pill size={28} weight="bold" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Kho Dược & Quản Lý Lô Thuốc FEFO</h1>
                        <p className="text-sm text-slate-500">Xuất kho theo nguyên tắc Hạn dùng gần nhất xuất trước (First Expired, First Out)</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchBatches}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                    >
                        <ArrowsClockwise size={18} className={loading ? 'animate-spin' : ''} />
                        Làm mới
                    </button>
                    <button
                        onClick={() => setShowDispenseModal(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition"
                    >
                        <CheckCircle size={18} weight="bold" />
                        Xuất Cấp Phát FEFO
                    </button>
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-xs"
                    >
                        <PlusCircle size={18} weight="bold" />
                        Nhập Lô Mới
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                        <Package size={22} weight="bold" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase">Tổng số lô tồn</div>
                        <div className="text-2xl font-bold text-slate-800">{batches.length}</div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CalendarCheck size={22} weight="bold" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase">Quy tắc xuất kho</div>
                        <div className="text-sm font-bold text-emerald-700">FEFO (First Expired First Out)</div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Warning size={22} weight="bold" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase">Khóa chống Race Condition</div>
                        <div className="text-sm font-bold text-amber-700">SELECT FOR UPDATE Active</div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                    <div className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Package size={20} />
                        Danh sách lô thuốc tồn kho (Sắp xếp theo thứ tự ưu tiên FEFO)
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                            <tr>
                                <th className="px-5 py-3">Lô Số</th>
                                <th className="px-5 py-3">ID Thuốc</th>
                                <th className="px-5 py-3">Hạn Sử Dụng</th>
                                <th className="px-5 py-3">Số Ngày Còn Lại</th>
                                <th className="px-5 py-3">Tồn Vật Lý</th>
                                <th className="px-5 py-3">Tồn Giữ Chỗ</th>
                                <th className="px-5 py-3">Giá Nhập</th>
                                <th className="px-5 py-3">Thứ Tự Xuất</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {batches.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                                        Chưa có lô thuốc nào trong kho
                                    </td>
                                </tr>
                            ) : (
                                batches.map((batch, index) => {
                                    const days = batch.days_until_expiry ?? 0
                                    const isUrgent = days <= 90
                                    return (
                                        <tr key={batch.id} className="hover:bg-slate-50/80 transition">
                                            <td className="px-5 py-3 font-semibold text-slate-800">
                                                {batch.batch_number}
                                            </td>
                                            <td className="px-5 py-3 text-slate-600">
                                                Thuốc #{batch.drug_id}
                                            </td>
                                            <td className="px-5 py-3 font-medium text-slate-700">
                                                {batch.expiry_date}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span
                                                    className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                                        isUrgent
                                                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    }`}
                                                >
                                                    {days > 0 ? `Còn ${days} ngày` : 'Đã hết hạn'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 font-bold text-slate-800">
                                                {batch.physical_stock}
                                            </td>
                                            <td className="px-5 py-3 text-slate-500">
                                                {batch.held_stock}
                                            </td>
                                            <td className="px-5 py-3 text-slate-600">
                                                {Number(batch.import_price).toLocaleString('vi-VN')} đ
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-sky-100 text-sky-800">
                                                    Ưu tiên #{index + 1}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 space-y-4">
                        <h2 className="text-lg font-bold text-slate-800">Nhập Lô Thuốc Mới</h2>
                        <form onSubmit={handleImportSubmit} className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">ID Thuốc</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={importForm.drug_id}
                                    onChange={(e) => setImportForm({ ...importForm, drug_id: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Số Lô (Batch Number)</label>
                                <input
                                    type="text"
                                    required
                                    value={importForm.batch_number}
                                    onChange={(e) => setImportForm({ ...importForm, batch_number: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Hạn Sử Dụng</label>
                                <input
                                    type="date"
                                    required
                                    value={importForm.expiry_date}
                                    onChange={(e) => setImportForm({ ...importForm, expiry_date: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Số Lượng Nhập</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={importForm.physical_stock}
                                    onChange={(e) => setImportForm({ ...importForm, physical_stock: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Giá Nhập (VNĐ)</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    value={importForm.import_price}
                                    onChange={(e) => setImportForm({ ...importForm, import_price: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                                />
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowImportModal(false)}
                                    className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-xs"
                                >
                                    Lưu Lô Thuốc
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDispenseModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 space-y-4">
                        <h2 className="text-lg font-bold text-slate-800">Xuất Cấp Phát Thuốc Theo FEFO</h2>
                        <form onSubmit={handleDispenseSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">ID Đơn Thuốc</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    placeholder="Nhập ID đơn thuốc cần cấp phát..."
                                    value={dispensePrescriptionId}
                                    onChange={(e) => setDispensePrescriptionId(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                                />
                            </div>
                            <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs space-y-1">
                                <div>• Tự động chọn các lô có hạn dùng gần nhất để trừ kho.</div>
                                <div>• Ngăn chặn hoàn toàn bán âm tồn kho khả dụng.</div>
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowDispenseModal(false)}
                                    className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                                >
                                    Đóng
                                </button>
                                <button
                                    type="submit"
                                    disabled={dispensing}
                                    className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-xs"
                                >
                                    {dispensing ? 'Đang xuất...' : 'Xác Nhận Xuất Kho'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
