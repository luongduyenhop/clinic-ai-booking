import { Modal, Button, Tag, message } from 'antd'
import { PrinterOutlined } from '../common/ClinicIcon'
import { useDispatch, useSelector } from 'react-redux'
import { updateInvoiceStatusAsync } from '../../redux/actions/reception/receptionAction'
import { formatCurrency } from '../../utils/helpers/formatCurrency'
import { PAYMENT_STATUS_LABELS } from '../../utils/constants/receptionConstants'

export default function PrintReceiptModal({ open, onClose, invoice }) {
    const dispatch = useDispatch()
    const { patients } = useSelector((state) => state.reception)

    if (!invoice) return null
    const patient = patients.find((p) => p.id === invoice.patientId)

    const statusConfig = PAYMENT_STATUS_LABELS[invoice.status] || { label: invoice.status, color: 'default' }

    const handleMarkPaid = async (method) => {
        await dispatch(
            updateInvoiceStatusAsync({
                invoiceId: invoice.id,
                payload: {
                    status: 'PAID',
                    paymentMethod: method,
                    transactionRef: `THU-TAI-QUAY-${Date.now().toString().slice(-4)}`,
                },
            })
        )
        message.success('Đã xác nhận thanh toán thành công!')
    }

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={520}
            footer={
                <div className="flex items-center justify-between">
                    <div>
                        {invoice.status === 'UNPAID' && (
                            <Button
                                type="primary"
                                className="!bg-clinic-success hover:!bg-clinic-navy !border-clinic-success font-bold"
                                onClick={() => handleMarkPaid('CASH')}
                            >
                                Thu tiền mặt &amp; Xác nhận
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={onClose}>Đóng</Button>
                        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()} className="medpro-btn-primary">
                            In biên nhận
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="py-2 text-clinic-text space-y-4">
                <div className="text-center border-b border-dashed border-clinic-border-strong pb-3">
                    <div className="text-xs font-bold uppercase text-clinic-cta">Phòng Khám Đa Khoa Quốc Tế</div>
                    <div className="text-base font-extrabold text-clinic-navy mt-0.5">BIÊN LAI THU TIỀN TẠM THỜI</div>
                    <div className="text-[11px] text-clinic-text-secondary tabular-nums">Mã hóa đơn: {invoice.invoiceCode} · Ngày: {invoice.createdAt}</div>
                </div>

                <div className="flex items-center justify-between bg-clinic-bg p-3 rounded-[6px] border border-clinic-border text-xs">
                    <div>
                        <span className="text-clinic-text-secondary block">Bệnh nhân:</span>
                        <span className="font-bold text-clinic-navy text-sm">{patient?.fullName}</span>
                        <span className="text-[11px] text-clinic-text-secondary block tabular-nums">{patient?.patientCode} · {patient?.phone}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-clinic-text-secondary block">Trạng thái:</span>
                        <Tag color={statusConfig.color} className="font-semibold mt-0.5">
                            {statusConfig.label}
                        </Tag>
                    </div>
                </div>

                <div className="space-y-2 text-xs">
                    <div className="font-bold text-clinic-navy">Chi tiết danh mục dịch vụ</div>
                    <div className="border rounded-[6px] overflow-hidden border-clinic-border">
                        <table className="w-full text-left">
                            <thead className="bg-clinic-bg text-[11px] text-clinic-text-secondary border-b border-clinic-border">
                                <tr>
                                    <th className="p-2">Dịch vụ</th>
                                    <th className="p-2 text-right">Đơn giá</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-clinic-border tabular-nums">
                                {invoice.services?.map((s, idx) => (
                                    <tr key={idx}>
                                        <td className="p-2 font-medium text-clinic-text">{s.name}</td>
                                        <td className="p-2 text-right font-semibold text-clinic-navy">{formatCurrency(s.price)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-1.5 text-xs border-t border-clinic-border pt-3 tabular-nums">
                    <div className="flex justify-between text-clinic-text-secondary">
                        <span>Tổng tiền dịch vụ:</span>
                        <span>{formatCurrency(invoice.subTotal)}</span>
                    </div>

                    <div className="flex justify-between text-sm font-extrabold text-clinic-navy border-t border-dashed border-clinic-border pt-2">
                        <span>Số tiền thực thu:</span>
                        <span className="text-clinic-cta text-base">{formatCurrency(invoice.amountToPay)}</span>
                    </div>
                    {invoice.transactionRef && (
                        <div className="flex justify-between text-[11px] text-clinic-text-secondary pt-1">
                            <span>Mã giao dịch / PT:</span>
                            <span className="font-mono">{invoice.transactionRef} ({invoice.paymentMethod})</span>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    )
}
