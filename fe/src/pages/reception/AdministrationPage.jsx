import { useState, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Table, Input, Select, Button, Tag, Space, Modal, message } from 'antd'
import {
    SearchOutlined,
    PrinterOutlined,
    DollarCircleOutlined,
} from '@ant-design/icons'
import PrintReceiptModal from '../../components/reception/PrintReceiptModal'
import { QrCode } from '../../components/common/ClinicIcon'
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
                <div className="tabular-nums">
                    <span className="font-mono font-bold text-clinic-cta block">{code}</span>
                    <span className="text-[11px] text-clinic-text-muted">{record.createdAt}</span>
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
                        <span className="font-bold text-clinic-navy block">{pat?.fullName}</span>
                        <div className="text-clinic-text-muted text-xs tabular-nums">
                            {pat?.phone} · {pat?.patientCode}
                        </div>
                    </div>
                )
            },
        },
        {
            title: 'Dịch vụ chỉ định',
            key: 'services',
            render: (_, record) => (
                <div className="text-xs space-y-0.5 tabular-nums">
                    {record.services?.map((s, idx) => (
                        <div key={idx} className="text-clinic-text">
                            · {s.name} ({formatCurrency(s.price)})
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
            render: (amount) => (
                <div className="tabular-nums">
                    <span className="font-bold text-clinic-navy text-sm block">{formatCurrency(amount)}</span>
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
                            className="medpro-btn-primary text-xs font-bold"
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
        <div className="space-y-4">
            <div className="bg-clinic-surface rounded-[6px] border border-clinic-border grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-clinic-border">
                <div className="p-4">
                    <span className="text-xs font-semibold text-clinic-text-secondary">Doanh thu thu tại quầy hôm nay</span>
                    <div className="text-xl font-extrabold text-clinic-navy mt-1 tabular-nums">{formatCurrency(totalRevenue)}</div>
                    <span className="text-[11px] text-clinic-success font-medium">Đã thanh toán đầy đủ</span>
                </div>
                <div className="p-4">
                    <span className="text-xs font-semibold text-clinic-text-secondary">Hóa đơn chờ thanh toán</span>
                    <div className="text-xl font-extrabold text-clinic-navy mt-1 tabular-nums">{unpaidCount} ca</div>
                    <span className="text-[11px] text-clinic-warning font-medium">Bệnh nhân chưa nộp phí khám</span>
                </div>
                <div className="p-4">
                    <span className="text-xs font-semibold text-clinic-text-secondary">Yêu cầu hoàn phí</span>
                    <div className="text-xl font-extrabold text-clinic-navy mt-1 tabular-nums">{refundPendingCount} yêu cầu</div>
                    <span className="text-[11px] text-clinic-danger font-medium">Do hủy lịch đã đóng tiền trước</span>
                </div>
            </div>

            <div className="medpro-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm lg:text-base font-extrabold text-clinic-navy font-display">
                            Thủ tục hành chính &amp; Thanh toán viện phí
                        </h2>
                        <span className="text-xs text-clinic-text-secondary">
                            Theo dõi biên nhận, hướng dẫn người bệnh sang thu ngân hoặc xác nhận thu tiền mặt tại quầy
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-clinic-border text-xs">
                    <Input
                        prefix={<SearchOutlined className="text-clinic-text-muted" />}
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

            <Modal
                title={
                    <div className="flex items-center gap-2 text-clinic-navy">
                        <DollarCircleOutlined className="text-clinic-success text-lg" />
                        <span className="font-extrabold text-base">Xác nhận thu viện phí tại quầy</span>
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
                        className="medpro-btn-primary text-xs font-bold"
                    >
                        Xác nhận đã thu {paymentModal.invoice ? formatCurrency(paymentModal.invoice.amountToPay) : ''}
                    </Button>,
                ]}
            >
                {paymentModal.invoice && (
                    <div className="space-y-4 py-2 text-xs">
                        <div className="p-3.5 rounded-[6px] bg-clinic-bg border border-clinic-border space-y-2 tabular-nums">
                            <div className="flex justify-between items-center">
                                <span className="text-clinic-text-secondary">Mã hóa đơn:</span>
                                <span className="font-mono font-bold text-clinic-cta">{paymentModal.invoice.invoiceCode}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-clinic-text-secondary">Bệnh nhân:</span>
                                <span className="font-bold text-clinic-navy">
                                    {patients.find((p) => p.id === paymentModal.invoice.patientId)?.fullName || 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-clinic-text-secondary">Dịch vụ:</span>
                                <span className="text-clinic-text">
                                    {paymentModal.invoice.services?.map((s) => s.name).join(', ')}
                                </span>
                            </div>
                            <div className="pt-2 border-t border-clinic-border flex justify-between items-center">
                                <span className="font-bold text-clinic-navy">Số tiền cần thu:</span>
                                <span className="text-base font-black text-clinic-success">
                                    {formatCurrency(paymentModal.invoice.amountToPay)}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="font-bold text-clinic-navy block mb-1.5">Hình thức thanh toán:</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setPaymentModal((prev) => ({ ...prev, method: 'CASH' }))}
                                    className={`p-3 rounded-[6px] border text-center font-bold transition cursor-pointer ${
                                        paymentModal.method === 'CASH'
                                            ? 'border-clinic-success bg-clinic-success-bg text-clinic-success'
                                            : 'border-clinic-border bg-clinic-surface text-clinic-text hover:bg-clinic-bg'
                                    }`}
                                >
                                    Tiền mặt tại quầy
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentModal((prev) => ({ ...prev, method: 'VIETQR' }))}
                                    className={`p-3 rounded-[6px] border text-center font-bold transition cursor-pointer ${
                                        paymentModal.method === 'VIETQR'
                                            ? 'border-clinic-cta bg-clinic-surface-alt text-clinic-navy'
                                            : 'border-clinic-border bg-clinic-surface text-clinic-text hover:bg-clinic-bg'
                                    }`}
                                >
                                    Chuyển khoản VietQR
                                </button>
                            </div>
                        </div>

                        {paymentModal.method === 'VIETQR' && (
                            <div className="p-3 rounded-[6px] bg-clinic-surface-alt border border-clinic-info-border text-center space-y-1.5">
                                <span className="text-[11px] font-bold text-clinic-navy block">Quét mã VietQR chuẩn NAPAS 247</span>
                                <div className="w-24 h-24 bg-clinic-surface rounded-[6px] border border-clinic-border mx-auto flex flex-col items-center justify-center text-clinic-navy">
                                    <QrCode size={42} weight="regular" />
                                    <span className="text-[10px] font-mono text-clinic-text-muted mt-0.5">NAPAS 247</span>
                                </div>
                                <span className="text-[10.5px] text-clinic-text-secondary block">
                                    Nội dung CK: <strong className="font-mono text-clinic-navy">{paymentModal.invoice.invoiceCode}</strong>
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <PrintReceiptModal
                open={Boolean(selectedInvoice)}
                onClose={() => setSelectedInvoice(null)}
                invoice={selectedInvoice}
            />
        </div>
    )
}
