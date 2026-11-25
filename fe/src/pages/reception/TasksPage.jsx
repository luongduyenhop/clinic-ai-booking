import { useState, useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
    Table,
    Button,
    Modal,
    Select,
    message,
    Alert,
    DatePicker,
} from 'antd'
import {
    SwapOutlined,
    SyncOutlined,
    WarningOutlined,
    UnorderedListOutlined,
    CheckCircleOutlined,
    RollbackOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import IncidentDetailDrawer from '../../components/reception/IncidentDetailDrawer'
import {
    fetchDoctorAbsencesAsync,
    rebalanceQueueAsync,
    fetchReceptionDataAsync,
} from '../../redux/actions/reception/receptionAction'
import {
    getIncidentKey,
    getStrandedPatientCount,
    isIncidentResolved,
    markIncidentResolved,
    unmarkIncidentResolved,
} from '../../redux/slices/reception/receptionSlice'

export default function TasksPage() {
    const dispatch = useDispatch()
    const {
        doctorAbsences = [],
        resolvedIncidentKeys = [],
        loading = false,
    } = useSelector((state) => state.reception)

    const [incidentDate, setIncidentDate] = useState(() => dayjs().format('YYYY-MM-DD'))
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [selectedIncident, setSelectedIncident] = useState(null)
    const [drawerIncident, setDrawerIncident] = useState(null)
    const [selectedTargetDoctor, setSelectedTargetDoctor] = useState(null)
    const [isRebalancing, setIsRebalancing] = useState(false)

    const pendingAbsences = useMemo(
        () => doctorAbsences.filter((inc) => !isIncidentResolved(inc, resolvedIncidentKeys)),
        [doctorAbsences, resolvedIncidentKeys]
    )

    const resolvedAbsencesCount = doctorAbsences.length - pendingAbsences.length

    const filteredAbsences = useMemo(() => {
        if (statusFilter === 'PENDING') return pendingAbsences
        if (statusFilter === 'RESOLVED') {
            return doctorAbsences.filter((inc) => isIncidentResolved(inc, resolvedIncidentKeys))
        }
        return doctorAbsences
    }, [doctorAbsences, pendingAbsences, resolvedIncidentKeys, statusFilter])

    useEffect(() => {
        dispatch(fetchReceptionDataAsync())
    }, [dispatch])

    useEffect(() => {
        dispatch(fetchDoctorAbsencesAsync({ queryDate: incidentDate }))
    }, [dispatch, incidentDate])

    const handleRefresh = () => {
        dispatch(fetchDoctorAbsencesAsync({ queryDate: incidentDate }))
    }

    const handleConfirmRebalance = async () => {
        if (!selectedIncident) return
        setIsRebalancing(true)
        try {
            const res = await dispatch(
                rebalanceQueueAsync({
                    payload: {
                        nghi_phep_bac_si_id: selectedIncident.nghi_phep_id,
                        ticket_ids: null,
                        bac_si_nhan_id: selectedTargetDoctor ? Number(selectedTargetDoctor) : null,
                    },
                })
            ).unwrap()

            const count = res?.so_ve_chuyen || res?.so_luong_chuyen_thanh_cong || selectedIncident.so_benh_nhan_cho || 0
            message.success(`Đã điều chuyển thành công ${count} bệnh nhân sang bác sĩ thay thế!`)
            setSelectedIncident(null)
            setSelectedTargetDoctor(null)
            dispatch(fetchDoctorAbsencesAsync({ queryDate: incidentDate }))
        } catch {
        } finally {
            setIsRebalancing(false)
        }
    }

    const handleMarkResolved = (record) => {
        const key = getIncidentKey(record)
        dispatch(markIncidentResolved(key))
        message.success(`Đã đánh dấu hoàn thành xử lý sự cố của BS ${record.ten_bac_si}.`)
    }

    const handleReopenIncident = (record) => {
        const key = getIncidentKey(record)
        dispatch(unmarkIncidentResolved(key))
        message.info(`Đã mở lại theo dõi sự cố của BS ${record.ten_bac_si}.`)
    }

    const incidentColumns = [
        {
            title: 'Mức độ',
            key: 'severity',
            width: 130,
            render: (_, record) => {
                const resolved = isIncidentResolved(record, resolvedIncidentKeys)
                return resolved ? (
                    <span className="medpro-badge-success inline-flex items-center gap-1 font-bold text-xs">
                        <CheckCircleOutlined /> Đã giải quyết
                    </span>
                ) : (
                    <span className="medpro-badge-danger font-bold text-xs">
                        Khẩn cấp
                    </span>
                )
            },
        },
        {
            title: 'Bác sĩ & Nội dung sự cố',
            key: 'title',
            render: (_, record) => (
                <div className="space-y-1">
                    <span className="font-bold text-clinic-navy text-sm block">
                        Bác sĩ {record.ten_bac_si} ({record.ten_chuyen_khoa || 'Chuyên khoa'})
                    </span>
                    <p className="text-clinic-text-secondary text-xs tabular-nums">
                        Lý do: <strong className="text-clinic-navy">{record.ly_do}</strong> · Thời gian: {record.tu_ngay} {record.ca_lam_viec ? `(${record.ca_lam_viec === 'sang' ? 'Ca sáng' : 'Ca chiều'})` : ''}
                    </p>
                    {record.danh_sach_bac_si_thay_the && record.danh_sach_bac_si_thay_the.length > 0 && (
                        <div className="text-[11px] text-clinic-text-secondary flex flex-wrap items-center gap-1.5 pt-0.5 tabular-nums">
                            <span>BS thay thế gợi ý:</span>
                            {record.danh_sach_bac_si_thay_the.map((alt) => (
                                <span
                                    key={alt.bac_si_id}
                                    className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-clinic-surface-alt border border-clinic-info-border text-clinic-navy font-semibold"
                                >
                                    {alt.ten_bac_si} ({alt.phong_kham || 'Buồng'} - Chờ: {alt.so_benh_nhan_cho})
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Bệnh nhân bị kẹt',
            dataIndex: 'so_benh_nhan_cho',
            key: 'so_benh_nhan_cho',
            width: 160,
            render: (count, record) => {
                const total = count ?? record?.so_benh_nhan_bi_anh_huong ?? 0
                return (
                    <div className="tabular-nums">
                        <span className="font-bold text-clinic-danger text-base font-mono block">
                            {total} bệnh nhân
                        </span>
                        <span className="text-[10.5px] text-clinic-text-muted">Đang chờ khám</span>
                    </div>
                )
            },
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 340,
            align: 'right',
            render: (_, record) => {
                const strandedCount = getStrandedPatientCount(record)
                const resolved = isIncidentResolved(record, resolvedIncidentKeys)

                return (
                    <div className="flex items-center justify-end gap-2">
                        <Button
                            size="small"
                            icon={<UnorderedListOutlined />}
                            onClick={() => setDrawerIncident(record)}
                            className="medpro-btn-outline text-xs font-semibold"
                        >
                            Chi tiết &amp; Xử lý lẻ
                        </Button>
                        {resolved ? (
                            <Button
                                size="small"
                                icon={<RollbackOutlined />}
                                onClick={() => handleReopenIncident(record)}
                                className="text-xs font-semibold"
                            >
                                Mở lại
                            </Button>
                        ) : strandedCount === 0 ? (
                            <Button
                                size="small"
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                onClick={() => handleMarkResolved(record)}
                                className="!bg-clinic-success hover:!bg-clinic-navy !border-clinic-success text-xs font-bold"
                            >
                                Hoàn thành
                            </Button>
                        ) : (
                            <Button
                                size="small"
                                type="primary"
                                icon={<SwapOutlined />}
                                className="medpro-btn-primary text-xs font-bold"
                                onClick={() => {
                                    setSelectedIncident(record)
                                    setSelectedTargetDoctor(null)
                                }}
                            >
                                Chuyển nhanh
                            </Button>
                        )}
                    </div>
                )
            },
        },
    ]

    return (
        <div className="space-y-4">
            <div className="medpro-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm lg:text-base font-extrabold text-clinic-navy font-display flex items-center gap-2">
                            <WarningOutlined className="text-clinic-warning" />
                            Xử lý sự cố ca trực &amp; Cân bằng hàng đợi
                        </h2>
                        <span className="text-xs text-clinic-text-secondary">
                            Rà soát sự cố bác sĩ khai báo nghỉ đột xuất, giải phóng bệnh nhân bị kẹt và tái cân bằng tải sang bác sĩ cùng chuyên khoa
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            icon={<SyncOutlined />}
                            onClick={handleRefresh}
                            className="medpro-btn-outline !h-8 !px-3 text-xs font-semibold"
                        >
                            Làm mới
                        </Button>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="medpro-card p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                        <span className="text-clinic-text-secondary font-medium">Ngày rà soát sự cố:</span>
                        <DatePicker
                            format="DD/MM/YYYY"
                            value={dayjs(incidentDate)}
                            onChange={(d) => setIncidentDate(d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
                        />
                    </div>
                    <div className="flex items-center gap-1 bg-clinic-bg-muted border border-clinic-border p-1 rounded-[6px]">
                        {[
                            { key: 'ALL', label: `Tất cả (${doctorAbsences.length})` },
                            { key: 'PENDING', label: `Cần xử lý (${pendingAbsences.length})` },
                            { key: 'RESOLVED', label: `Đã giải quyết (${resolvedAbsencesCount})` },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setStatusFilter(tab.key)}
                                className={`px-3 py-1 rounded-[4px] text-xs font-bold transition cursor-pointer tabular-nums ${
                                    statusFilter === tab.key
                                        ? 'bg-clinic-navy text-clinic-surface'
                                        : 'text-clinic-text-secondary hover:text-clinic-navy'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {pendingAbsences.length === 0 ? (
                    <Alert
                        message="Không có sự cố tồn đọng cần xử lý"
                        description={
                            resolvedAbsencesCount > 0
                                ? `Tất cả ${resolvedAbsencesCount} sự cố trong ngày đã được giải quyết. Thông báo cảnh báo ở Dashboard và Lịch trực đã được ẩn.`
                                : 'Tất cả bác sĩ trong các chuyên khoa đang hoạt động đúng ca trực. Không có bệnh nhân nào bị gián đoạn hàng đợi.'
                        }
                        type="success"
                        showIcon
                    />
                ) : (
                    <Alert
                        message={`Phát hiện ${pendingAbsences.length} bác sĩ nghỉ đột xuất cần điều chuyển`}
                        description="Vui lòng thực hiện điều chuyển bệnh nhân sang các bác sĩ thay thế trong cùng chuyên khoa hoặc bấm Hoàn thành khi không còn bệnh nhân bị kẹt."
                        type="warning"
                        showIcon
                    />
                )}

                <div className="medpro-card overflow-hidden">
                    <Table
                        columns={incidentColumns}
                        dataSource={filteredAbsences}
                        rowKey={(r) => r.nghi_phep_id || r.id || r.bac_si_id}
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                        size="middle"
                        scroll={filteredAbsences.length > 0 ? { x: 700 } : undefined}
                        locale={{ emptyText: 'Không có sự cố nào phù hợp bộ lọc' }}
                    />
                </div>
            </div>

            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <SwapOutlined className="text-clinic-cta" />
                        <span>Điều chuyển hàng loạt: BS {selectedIncident?.ten_bac_si}</span>
                    </div>
                }
                open={Boolean(selectedIncident)}
                onCancel={() => setSelectedIncident(null)}
                footer={[
                    <Button key="back" onClick={() => setSelectedIncident(null)}>
                        Hủy bỏ
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        loading={isRebalancing}
                        onClick={handleConfirmRebalance}
                        className="medpro-btn-primary text-xs font-bold"
                    >
                        Xác nhận điều chuyển hàng loạt
                    </Button>,
                ]}
            >
                {selectedIncident && (
                    <div className="space-y-4 py-2 text-xs">
                        <div className="p-3 rounded-[6px] bg-clinic-bg border border-clinic-border space-y-1">
                            <div><strong>Bác sĩ xin nghỉ:</strong> {selectedIncident.ten_bac_si}</div>
                            <div><strong>Chuyên khoa:</strong> {selectedIncident.ten_chuyen_khoa}</div>
                            <div className="tabular-nums"><strong>Số bệnh nhân đang kẹt:</strong> <span className="font-bold text-clinic-danger">{selectedIncident.so_benh_nhan_cho || 0} người</span></div>
                        </div>

                        <div className="space-y-1">
                            <label className="font-bold text-clinic-navy block">Chọn bác sĩ tiếp nhận thay thế:</label>
                            <Select
                                className="w-full"
                                placeholder="-- Chọn bác sĩ hoặc để hệ thống Tự động cân bằng tải --"
                                value={selectedTargetDoctor}
                                onChange={(val) => setSelectedTargetDoctor(val)}
                                allowClear
                                options={[
                                    { value: null, label: 'Tự động cân bằng tải đều (Phân phối xoay vòng cho BS ít người chờ nhất)' },
                                    ...(selectedIncident.danh_sach_bac_si_thay_the || []).map((alt) => ({
                                        value: alt.bac_si_id,
                                        label: `BS ${alt.ten_bac_si} (${alt.phong_kham || 'Buồng khám'} - Đang chờ: ${alt.so_benh_nhan_cho} BN)`,
                                    })),
                                ]}
                            />
                        </div>
                    </div>
                )}
            </Modal>

            <IncidentDetailDrawer
                incident={drawerIncident}
                open={Boolean(drawerIncident)}
                onClose={() => setDrawerIncident(null)}
                onSuccess={handleRefresh}
            />
        </div>
    )
}
