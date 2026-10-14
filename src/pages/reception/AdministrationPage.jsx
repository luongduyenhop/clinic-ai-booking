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

export default function AdministrationPage() {
    const { invoices, patients, activeRole } = useSelector((state) => state.reception)

    const [searchQuery, setSearchQuery] = useState('')
    const [selectedStatus, setSelectedStatus] = useState('')
    const [selectedInvoice, setSelectedInvoice] = useState(null)

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
                    {record.insuranceDiscount > 0 && (
                        <span className="text-[11px] text-emerald-600 block">
                            BHYT giảm: {formatCurrency(record.insuranceDiscount)}
                        </span>
                    )}
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
            width: 160,
            align: 'right',
            render: (_, record) => (
                <Space size="small">
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

            {/* Print Receipt Modal */}
            <PrintReceiptModal
                open={Boolean(selectedInvoice)}
                onClose={() => setSelectedInvoice(null)}
                invoice={selectedInvoice}
            />
        </div>
    )
}
