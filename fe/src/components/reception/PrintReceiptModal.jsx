import { Modal, Button, Tag, Select, message } from 'antd'
import { PrinterOutlined, CheckCircleOutlined } from '@ant-design/icons'
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
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => handleMarkPaid('CASH')}
                            >
                                Thu tiền mặt & Xác nhận
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={onClose}>Đóng</Button>
                        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()} className="bg-sky-600">
                            In biên nhận
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="py-2 text-slate-800 space-y-4">
                <div className="text-center border-b border-dashed border-slate-300 pb-3">
                    <div className="text-xs font-bold uppercase text-teal-700">Phòng Khám Đa Khoa Quốc Tế</div>
                    <div className="text-base font-extrabold text-slate-900 mt-0.5">BIÊN LAI THU TIỀN TẠM THỜI</div>
                    <div className="text-[11px] text-slate-500">Mã hóa đơn: {invoice.invoiceCode} - Ngày: {invoice.createdAt}</div>
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <div>
                        <span className="text-slate-500 block">Bệnh nhân:</span>
                        <span className="font-bold text-slate-900 text-sm">{patient?.fullName}</span>
                        <span className="text-[11px] text-slate-400 block">{patient?.patientCode} - {patient?.phone}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-slate-500 block">Trạng thái:</span>
                        <Tag color={statusConfig.color} className="font-semibold mt-0.5">
                            {statusConfig.label}
                        </Tag>
                    </div>
                </div>

                {/* Services table */}
                <div className="space-y-2 text-xs">
                    <div className="font-bold text-slate-700 uppercase">Chi tiết danh mục dịch vụ</div>
                    <div className="border rounded-xl overflow-hidden border-slate-200">
                        <table className="w-full text-left">
                            <thead className="bg-slate-100 text-[11px] text-slate-500">
                                <tr>
                                    <th className="p-2">Dịch vụ</th>
                                    <th className="p-2 text-right">Đơn giá</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {invoice.services?.map((s, idx) => (
                                    <tr key={idx}>
                                        <td className="p-2 font-medium">{s.name}</td>
                                        <td className="p-2 text-right font-semibold">{formatCurrency(s.price)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Summary calculation */}
                <div className="space-y-1.5 text-xs border-t border-slate-200 pt-3">
                    <div className="flex justify-between text-slate-600">
                        <span>Tổng tiền dịch vụ:</span>
                        <span>{formatCurrency(invoice.subTotal)}</span>
                    </div>

                    <div className="flex justify-between text-sm font-extrabold text-slate-900 border-t border-dashed border-slate-200 pt-2">
                        <span>Số tiền thực thu:</span>
                        <span className="text-sky-700 text-base">{formatCurrency(invoice.amountToPay)}</span>
                    </div>
                    {invoice.transactionRef && (
                        <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                            <span>Mã giao dịch / PT:</span>
                            <span className="font-mono">{invoice.transactionRef} ({invoice.paymentMethod})</span>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    )
}
