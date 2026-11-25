import { useEffect, useState } from 'react'
import { patientPortalService } from '../../services/user/PatientPortalService'
import PatientPageHeader from '../../components/user/patient/PatientPageHeader'
import {
    PatientEmpty,
    PatientError,
    PatientLoading,
} from '../../components/user/patient/PatientPageState'
import { StatusBadge } from '../../components/common/ClinicIcon'
import { formatConsultFee } from '../../utils/helpers/quickBookingHelpers'

export default function PatientBillingPage() {
    const [invoices, setInvoices] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const load = async () => {
        setLoading(true)
        setError('')
        try {
            const response = await patientPortalService.getInvoices()
            setInvoices(response?.data?.data || [])
        } catch (e) {
            setError(e.response?.data?.message || 'Không thể truy vấn hóa đơn của bạn')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    if (loading) return <PatientLoading />
    if (error) return <PatientError message={error} onRetry={load} />

    return (
        <div className="space-y-5">
            <PatientPageHeader
                title="Hóa đơn và viện phí"
                description="Tra cứu chi tiết bảng kê viện phí, phí khám lâm sàng và dịch vụ cận lâm sàng theo từng đợt khám."
            />

            {invoices.length === 0 ? (
                <PatientEmpty
                    icon="Receipt"
                    title="Chưa có hóa đơn"
                    description="Bạn chưa có hóa đơn viện phí nào được phát hành."
                />
            ) : (
                <div className="space-y-4">
                    {invoices.map((invoice) => (
                        <article key={invoice.id} className="medpro-card p-5 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <strong className="font-mono text-sm text-clinic-navy tabular-nums">
                                    {invoice.ma_hoa_don}
                                </strong>
                                <StatusBadge status={invoice.trang_thai} />
                            </div>
                            <p className="text-sm text-clinic-text-secondary">
                                Số tiền phải thu:{' '}
                                <strong className="text-clinic-navy tabular-nums">
                                    {formatConsultFee(invoice.so_tien_phai_thu)}
                                </strong>
                            </p>
                            <p className="text-sm text-clinic-text-secondary tabular-nums">
                                Đã thu: {formatConsultFee(invoice.thuc_thu)} · Ngày thanh toán:{' '}
                                {invoice.ngay_thanh_toan?.slice(0, 10) || 'Chưa thanh toán'}
                            </p>
                        </article>
                    ))}
                </div>
            )}

            <p className="medpro-card bg-clinic-surface-tint border-clinic-border p-4 text-xs leading-5 text-clinic-text-secondary">
                Hóa đơn điện tử được cập nhật ngay sau khi hoàn tất thủ tục tại Quầy Thu ngân Tầng 1 (hỗ trợ tiền mặt, thẻ ngân hàng và chuyển khoản VietQR).
            </p>
        </div>
    )
}
