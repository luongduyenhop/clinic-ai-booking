import { useState, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Table, Input, Select, Button, Tag, Space, Card, Modal, message, Alert } from 'antd'
import {
    SearchOutlined,
    PrinterOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    DollarCircleOutlined,
    WarningOutlined,
} from '@ant-design/icons'
import PrintReceiptModal from '../../components/reception/PrintReceiptModal'
import { PAYMENT_STATUS, PAYMENT_STATUS_LABELS } from '../../utils/constants/receptionConstants'
import { formatCurrency } from '../../utils/helpers/formatCurrency'
import { updateInvoiceStatusAsync } from '../../redux/actions/reception/receptionAction'

export default function AdministrationPage() {
    const dispatch = useDispatch()
    const { invoices, patients, activeRole } = useSelector((state) => state.reception)

    const [searchQuery, setSearchQuery] = useState('')
    const [selectedStatus, setSelectedStatus] = useState('')
    const [selectedInvoice, setSelectedInvoice] = useState(null)
    const [paymentModal, setPaymentModal] = useState({ open: false, invoice: null, method: 'CASH', processing: false })

    const filteredInvoices = useMemo(() => {
        return invoices.filter((inv) => {
            const pat = patients.find((p) => p.id === inv.patientId)
            const matchesQuery =
                !searchQuery ||
                inv.invoiceCode.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                (pat && pat.fullName.toLowerCase().includes(searchQuery.toLowerCase().trim())) ||
                (pat && pat.phone.includes(searchQuery.trim()))

            const matchesStatus = !selectedStatus || inv.status === selectedStatus

            return matchesQuery && matchesStatus
        })
    }, [invoices, patients, searchQuery, selectedStatus])

    // KPI Summary
    const totalRevenue = invoices
        .filter((i) => i.status === PAYMENT_STATUS.PAID)
        .reduce((sum, i) => sum + i.amountToPay, 0)
    const unpaidCount = invoices.filter((i) => i.status === PAYMENT_STATUS.UNPAID).length
    const refundPendingCount = invoices.filter((i) => i.status === PAYMENT_STATUS.REFUND_PENDING).length

    const handleConfirmPayment = async () => {
        if (!paymentModal.invoice) return
        setPaymentModal((prev) => ({ ...prev, processing: true }))
        try {
            await dispatch(
                updateInvoiceStatusAsync({
                    invoiceId: paymentModal.invoice.id,
                    payload: {
                        status: PAYMENT_STATUS.PAID,
                        paymentMethod: paymentModal.method,
                        paidAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                    },
                    actor: activeRole,
                })
            ).unwrap()
            message.success(`Đã thu ${formatCurrency(paymentModal.invoice.amountToPay)} và hoàn tất hóa đơn ${paymentModal.invoice.invoiceCode}!`)
            setPaymentModal({ open: false, invoice: null, method: 'CASH', processing: false })
        } catch (err) {
            message.error(err.message || 'Lỗi khi xác nhận thanh toán')
            setPaymentModal((prev) => ({ ...prev, processing: false }))
        }
    }

    const handleApproveRefund = (record) => {
        Modal.confirm({
            title: 'Xác nhận hoàn viện phí?',
            content: `Duyệt hoàn trả số tiền ${formatCurrency(record.amountToPay)} cho hóa đơn ${record.invoiceCode} của người bệnh?`,
            okText: 'Xác nhận hoàn tiền',
            okType: 'danger',
            cancelText: 'Hủy bỏ',
            onOk: async () => {
                try {
                    await dispatch(
                        updateInvoiceStatusAsync({
                            invoiceId: record.id,
                            payload: { status: 'REFUNDED' },
                            actor: activeRole,
                        })
                    ).unwrap()
                    message.success(`Đã hoàn tất hoàn phí cho hóa đơn ${record.invoiceCode}!`)
                } catch (err) {
                    message.error(err.message || 'Lỗi khi hoàn phí')
                }
            },
        })
    }

    const columns = [
        {
            title: 'Mã hóa đơn / Thu tiền',
            dataIndex: 'invoiceCode',
            key: 'invoiceCode',
            width: 170,
            render: (code, record) => (
                <div>
                    <span className="font-mono font-bold text-sky-700 block">{code}</span>
                    <span className="text-[11px] text-slate-400">{record.createdAt}</span>
                </div>
            ),
        },
        {
            title: 'Bệnh nhân',
            key: 'patient',
            width: 220,
            render: (_, record) => {
                const pat = patients.find((p) => p.id === record.patientId)
                return (
                    <div>
                        <span className="font-bold text-slate-900 block">{pat?.fullName}</span>
                        <div className="text-slate-400 text-xs">
                            {pat?.phone} • {pat?.patientCode}
                        </div>
                    </div>
                )
            },
        },
        {
            title: 'Dịch vụ chỉ định',
            key: 'services',
            render: (_, record) => (
                <div className="text-xs space-y-0.5">
                    {record.services?.map((s, idx) => (
                        <div key={idx} className="text-slate-700">
                            • {s.name} ({formatCurrency(s.price)})
                        </div>
                    ))}
                </div>
            ),
        },
        {
            title: 'Số tiền thực thu',
            dataIndex: 'amountToPay',
            key: 'amountToPay',
            width: 150,
            render: (amount, record) => (
                <div>
                    <span className="font-bold text-slate-900 text-sm block">{formatCurrency(amount)}</span>

                </div>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 150,
            render: (status) => {
                const cfg = PAYMENT_STATUS_LABELS[status] || { label: status, color: 'default' }
                return <Tag color={cfg.color} className="font-bold text-xs">{cfg.label}</Tag>
            },
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 190,
            align: 'right',
            render: (_, record) => (
                <Space size="small">
                    {record.status === PAYMENT_STATUS.UNPAID && (
                        <Button
                            size="small"
                            type="primary"
                            icon={<DollarCircleOutlined />}
                            onClick={() => setPaymentModal({ open: true, invoice: record, method: 'CASH', processing: false })}
                            className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold"
                        >
                            Thu tiền
                        </Button>
                    )}
                    {record.status === PAYMENT_STATUS.REFUND_PENDING && (
                        <Button
                            size="small"
                            danger
                            onClick={() => handleApproveRefund(record)}
                            className="text-xs font-bold"
                        >
                            Hoàn phí
                        </Button>
                    )}
                    <Button
                        size="small"
                        icon={<PrinterOutlined />}
                        onClick={() => setSelectedInvoice(record)}
                        className="text-xs"
                    >
                        Biên nhận
                    </Button>
                </Space>
            ),
        },
    ]

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                    <span className="text-xs font-bold text-slate-400 uppercase">Doanh thu thu tại quầy hôm nay</span>
                    <div className="text-2xl font-black text-emerald-600 mt-2">{formatCurrency(totalRevenue)}</div>
                    <span className="text-[11px] text-emerald-700 font-medium">Đã thanh toán đầy đủ</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                    <span className="text-xs font-bold text-slate-400 uppercase">Hóa đơn chờ thanh toán</span>
                    <div className="text-2xl font-black text-amber-600 mt-2">{unpaidCount} ca</div>
                    <span className="text-[11px] text-amber-700 font-medium">Bệnh nhân chưa nộp phí khám</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                    <span className="text-xs font-bold text-slate-400 uppercase">Yêu cầu hoàn phí</span>
                    <div className="text-2xl font-black text-red-600 mt-2">{refundPendingCount} yêu cầu</div>
                    <span className="text-[11px] text-red-700 font-medium">Do hủy lịch đã đóng tiền trước</span>
                </div>
            </div>

            {/* Invoices Table & Search */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">Thủ tục hành chính & Thanh toán viện phí</h2>
                        <span className="text-xs text-slate-500">
                            Theo dõi biên nhận, hướng dẫn người bệnh sang thu ngân hoặc xác nhận thu tiền mặt
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
                    <Input
                        prefix={<SearchOutlined className="text-slate-400" />}
                        placeholder="Tìm theo mã hóa đơn, tên bệnh nhân, SĐT..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-80"
                        allowClear
                    />
                    <Select
                        className="w-48"
                        placeholder="Trạng thái thanh toán"
                        value={selectedStatus || undefined}
                        onChange={(val) => setSelectedStatus(val || '')}
                        allowClear
                        options={Object.keys(PAYMENT_STATUS).map((k) => ({
                            value: k,
                            label: PAYMENT_STATUS_LABELS[k]?.label || k,
                        }))}
                    />
                </div>

                <Table
                    columns={columns}
                    dataSource={filteredInvoices}
                    rowKey="id"
                    pagination={{ pageSize: 8, showSizeChanger: true }}
                    size="middle"
                />
            </div>

            {/* Modal Thu Tiền Tại Quầy / VietQR */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-[#003553]">
                        <DollarCircleOutlined className="text-emerald-600 text-lg" />
                        <span className="font-extrabold text-base">Xác Nhận Thu Viện Phí Tại Quầy</span>
                    </div>
                }
                open={paymentModal.open}
                onCancel={() => setPaymentModal({ open: false, invoice: null, method: 'CASH', processing: false })}
                footer={[
                    <Button
                        key="cancel"
                        onClick={() => setPaymentModal({ open: false, invoice: null, method: 'CASH', processing: false })}
                    >
                        Hủy bỏ
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        loading={paymentModal.processing}
                        onClick={handleConfirmPayment}
                        className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                    >
                        Xác nhận đã thu {paymentModal.invoice ? formatCurrency(paymentModal.invoice.amountToPay) : ''}
                    </Button>,
                ]}
            >
                {paymentModal.invoice && (
                    <div className="space-y-4 py-2 text-xs">
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Mã hóa đơn:</span>
                                <span className="font-mono font-bold text-sky-700">{paymentModal.invoice.invoiceCode}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Bệnh nhân:</span>
                                <span className="font-bold text-slate-800">
                                    {patients.find((p) => p.id === paymentModal.invoice.patientId)?.fullName || 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Dịch vụ:</span>
                                <span className="text-slate-700">
                                    {paymentModal.invoice.services?.map((s) => s.name).join(', ')}
                                </span>
                            </div>
                            <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                                <span className="font-bold text-slate-700">Số tiền cần thu:</span>
                                <span className="text-base font-black text-emerald-600">
                                    {formatCurrency(paymentModal.invoice.amountToPay)}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="font-bold text-slate-700 block mb-1.5">Hình thức thanh toán:</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setPaymentModal((prev) => ({ ...prev, method: 'CASH' }))}
                                    className={`p-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                                        paymentModal.method === 'CASH'
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    💵 Tiền mặt tại quầy
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentModal((prev) => ({ ...prev, method: 'VIETQR' }))}
                                    className={`p-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                                        paymentModal.method === 'VIETQR'
                                            ? 'border-sky-500 bg-sky-50 text-sky-800 ring-2 ring-sky-500/20'
                                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    📱 Chuyển khoản VietQR
                                </button>
                            </div>
                        </div>

                        {paymentModal.method === 'VIETQR' && (
                            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-center space-y-1">
                                <span className="text-[11px] font-bold text-sky-800 block">Quét mã VietQR chuẩn NAPAS 247</span>
                                <div className="w-24 h-24 bg-white rounded-lg border border-slate-200 mx-auto flex items-center justify-center font-bold text-slate-400 text-xs shadow-inner">
                                    [QR Code]
                                </div>
                                <span className="text-[10px] text-slate-500 block">
                                    Nội dung CK: <strong className="font-mono text-sky-900">{paymentModal.invoice.invoiceCode}</strong>
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Print Receipt Modal */}
            <PrintReceiptModal
                open={Boolean(selectedInvoice)}
                onClose={() => setSelectedInvoice(null)}
                invoice={selectedInvoice}
            />
        </div>
    )
}
