import { useEffect, useState } from 'react'
import { patientPortalService } from '../../services/user/PatientPortalService'

const money = amount => Number(amount || 0).toLocaleString('vi-VN') + ' đ'
export default function PatientBillingPage() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = async () => {
    setLoading(true); setError('')
    try {
      const response = await patientPortalService.getInvoices()
      setInvoices(response?.data?.data || [])
    } catch (e) { setError(e.response?.data?.message || 'Không thể truy vấn hóa đơn của bạn') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  return <main className="public-container py-8 space-y-5">
    <h1 className="font-display text-2xl font-extrabold text-[#003553]">Hóa đơn và viện phí</h1>
    <p className="text-sm text-slate-600">Dữ liệu được lấy từ hệ thống. Trạng thái thanh toán chỉ được xác nhận bởi Backend và bộ phận thu ngân.</p>
    {loading && <p>Đang tải hóa đơn...</p>}
    {error && <p role="alert" className="text-rose-600">{error} <button type="button" onClick={load} className="underline">Thử lại</button></p>}
    {!loading && !error && invoices.length === 0 && <p className="medpro-card p-6 text-slate-600">Bạn chưa có hóa đơn nào.</p>}
    {invoices.map(invoice => <article key={invoice.id} className="medpro-card p-6 space-y-2">
      <div className="flex flex-wrap justify-between gap-2"><strong>{invoice.ma_hoa_don}</strong><span>{invoice.trang_thai === 'da_thu' ? 'Đã thanh toán' : invoice.trang_thai === 'chua_thu' ? 'Chưa thanh toán' : invoice.trang_thai}</span></div>
      <p className="text-sm">Số tiền phải thu: <strong>{money(invoice.so_tien_phai_thu)}</strong></p>
      <p className="text-sm text-slate-600">Đã thu: {money(invoice.thuc_thu)} · Ngày thanh toán: {invoice.ngay_thanh_toan?.slice(0, 10) || 'Chưa thanh toán'}</p>
    </article>)}
    <p className="rounded-xl bg-amber-50 p-4 text-xs text-amber-800">Thanh toán trực tuyến chưa được kích hoạt cho tài khoản bệnh nhân. Vui lòng thanh toán qua kênh chính thức của phòng khám; không xác nhận đã trả tiền chỉ bằng thao tác trên giao diện.</p>
  </main>
}
