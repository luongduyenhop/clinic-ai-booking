import { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Table, Input, Select, Progress, Button, DatePicker, Spin, Empty } from 'antd'
import {
    SearchOutlined,
    SyncOutlined,
    CalendarOutlined,
    ClockCircleOutlined,
    FieldTimeOutlined,
    UserOutlined,
} from '../../components/common/ClinicIcon'
import dayjs from 'dayjs'
import {
    fetchReportSummaryAsync,
    fetchAuditLogsAsync,
} from '../../redux/actions/reception/receptionAction'

const ACTION_TYPE_META = {
    CHECK_IN: { label: 'Tiếp nhận đặt trước', badge: 'medpro-badge-info' },
    WALK_IN_CREATE: { label: 'Tiếp nhận vãng lai', badge: 'medpro-badge-warning' },
    APPOINTMENT_RESCHEDULE: { label: 'Đổi lịch khám', badge: 'medpro-badge-info' },
    APPOINTMENT_CANCEL: { label: 'Hủy lịch hẹn', badge: 'medpro-badge-danger' },
    QUEUE_TRANSFER_ROOM: { label: 'Chuyển buồng khám', badge: 'medpro-badge-info' },
    QUEUE_CALL: { label: 'Gọi số vào khám', badge: 'medpro-badge-success' },
    QUEUE_DEFER: { label: 'Tạm hoãn lượt', badge: 'medpro-badge-warning' },
    LEAVE_QUEUE: { label: 'Rời hàng đợi', badge: 'medpro-badge-danger' },
    CLOSE_TICKET: { label: 'Hoàn tất lượt', badge: 'medpro-badge-neutral' },
}

const ACTION_TYPE_OPTIONS = [
    { value: '', label: 'Tất cả loại thao tác' },
    { value: 'CHECK_IN', label: 'Tiếp nhận đặt trước' },
    { value: 'WALK_IN_CREATE', label: 'Tiếp nhận vãng lai' },
    { value: 'APPOINTMENT_RESCHEDULE', label: 'Đổi lịch khám' },
    { value: 'APPOINTMENT_CANCEL', label: 'Hủy lịch hẹn' },
    { value: 'QUEUE_TRANSFER_ROOM', label: 'Chuyển buồng khám' },
    { value: 'QUEUE_CALL', label: 'Gọi số vào khám' },
    { value: 'QUEUE_DEFER', label: 'Tạm hoãn lượt' },
    { value: 'LEAVE_QUEUE', label: 'Rời hàng đợi' },
    { value: 'CLOSE_TICKET', label: 'Hoàn tất lượt' },
]

export default function ReportsPage() {
    const dispatch = useDispatch()
    const {
        reportSummary,
        reportLoading = false,
        auditLogs = [],
        auditPagination = { page: 1, pageSize: 10, totalItems: 0 },
        auditLoading = false,
    } = useSelector((state) => state.reception)

    const [selectedDate, setSelectedDate] = useState(() => dayjs())
    const [selectedShift, setSelectedShift] = useState('')

    const [searchKeyword, setSearchKeyword] = useState('')
    const [actionFilter, setActionFilter] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    const queryDateStr = selectedDate ? selectedDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')

    const loadReportSummary = useCallback(() => {
        dispatch(
            fetchReportSummaryAsync({
                queryDate: queryDateStr,
                caKham: selectedShift || undefined,
            })
        )
    }, [dispatch, queryDateStr, selectedShift])

    const loadAuditLogs = useCallback(
        (pageToLoad = currentPage, sizeToLoad = pageSize) => {
            dispatch(
                fetchAuditLogsAsync({
                    queryDate: queryDateStr,
                    actionType: actionFilter || undefined,
                    search: searchKeyword.trim() || undefined,
                    page: pageToLoad,
                    pageSize: sizeToLoad,
                })
            )
        },
        [dispatch, queryDateStr, actionFilter, searchKeyword, currentPage, pageSize]
    )

    useEffect(() => {
        loadReportSummary()
    }, [loadReportSummary])

    useEffect(() => {
        const timer = setTimeout(() => {
            loadAuditLogs(1, pageSize)
            setCurrentPage(1)
        }, 350)
        return () => clearTimeout(timer)
    }, [queryDateStr, actionFilter, searchKeyword, pageSize, dispatch])

    const handleTableChange = (pagination) => {
        setCurrentPage(pagination.current)
        setPageSize(pagination.pageSize)
        loadAuditLogs(pagination.current, pagination.pageSize)
    }

    const handleRefreshAll = () => {
        loadReportSummary()
        loadAuditLogs(currentPage, pageSize)
    }

    const kpi = reportSummary?.kpi || {
        tong_luot_tiep_nhan: 0,
        so_lich_hen: 0,
        so_vang_lai: 0,
        thoi_gian_cho_trung_binh_phut: 0,
        so_lich_huy: 0,
        so_no_show: 0,
    }

    const rawSpecialtyBreakdown = reportSummary?.phan_bo_chuyen_khoa || []
    const realSpecialties = rawSpecialtyBreakdown.filter(
        (item) => !String(item.ten_chuyen_khoa || '').toLowerCase().includes('(demo)')
    )
    const specialtyBreakdown = realSpecialties.length > 0 ? realSpecialties : rawSpecialtyBreakdown

    const columns = [
        {
            title: 'Thời gian',
            dataIndex: 'timestamp',
            key: 'timestamp',
            width: 160,
            render: (time) => (
                <span className="font-mono text-clinic-text-secondary text-xs flex items-center gap-1 tabular-nums">
                    <ClockCircleOutlined className="text-clinic-text-muted text-[11px]" />
                    {time || 'N/A'}
                </span>
            ),
        },
        {
            title: 'Người thực hiện',
            dataIndex: 'actor',
            key: 'actor',
            width: 170,
            render: (actor) => (
                <span className="font-semibold text-clinic-navy text-xs flex items-center gap-1.5">
                    <UserOutlined className="text-clinic-cta text-xs" />
                    {actor || 'Lễ tân tiếp đón'}
                </span>
            ),
        },
        {
            title: 'Hành động',
            dataIndex: 'action_type',
            key: 'action_type',
            width: 185,
            render: (act) => {
                const meta = ACTION_TYPE_META[act] || { label: act || 'Thao tác khác', badge: 'medpro-badge-neutral' }
                return (
                    <span className={`${meta.badge} text-[11px] font-bold`}>
                        {meta.label}
                    </span>
                )
            },
        },
        {
            title: 'Đối tượng & Buồng khám',
            key: 'target',
            width: 220,
            render: (_, record) => (
                <div className="text-xs space-y-0.5 tabular-nums">
                    <div className="font-bold text-clinic-navy flex items-center gap-1.5">
                        {record.ticket_number && (
                            <span className="font-mono text-clinic-cta bg-clinic-surface-alt px-1.5 py-0.5 rounded-[4px] border border-clinic-info-border">
                                {record.ticket_number}
                            </span>
                        )}
                        <span>{record.patient_name || 'Khách vãng lai'}</span>
                    </div>
                    {record.phone && (
                        <div className="text-[11px] text-clinic-text-secondary">SĐT: {record.phone}</div>
                    )}
                    {record.room_name && (
                        <div className="text-[11px] text-clinic-text-secondary font-medium">{record.room_name}</div>
                    )}
                </div>
            ),
        },
        {
            title: 'Chi tiết nội dung điều phối',
            dataIndex: 'description',
            key: 'description',
            render: (desc) => (
                <div className="text-xs text-clinic-text leading-relaxed font-normal">
                    {desc || 'Không có mô tả chi tiết'}
                </div>
            ),
        },
    ]

    return (
        <div className="space-y-4">
            <div className="medpro-card p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-sm lg:text-base font-extrabold text-clinic-navy font-display flex items-center gap-2">
                        <FieldTimeOutlined className="text-clinic-cta" />
                        Báo cáo Đối soát &amp; Nhật ký Thao tác Ca trực
                    </h2>
                    <p className="text-xs text-clinic-text-secondary mt-0.5">
                        Đối soát chất lượng phục vụ tiếp đón (SLA), tỷ lệ phân bổ chuyên khoa và truy vết thao tác điều phối
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    <DatePicker
                        value={selectedDate}
                        onChange={(d) => setSelectedDate(d || dayjs())}
                        format="DD/MM/YYYY"
                        allowClear={false}
                        className="w-36 rounded-[6px] font-medium"
                        prefix={<CalendarOutlined className="text-clinic-text-muted mr-1" />}
                    />

                    <Select
                        value={selectedShift}
                        onChange={(val) => setSelectedShift(val)}
                        className="w-48 rounded-[6px]"
                        options={[
                            { value: '', label: 'Cả ngày (Tất cả ca)' },
                            { value: 'sang', label: 'Ca sáng (07:30 - 11:30)' },
                            { value: 'chieu', label: 'Ca chiều (13:30 - 17:30)' },
                        ]}
                    />

                    <Button
                        icon={<SyncOutlined spin={reportLoading || auditLoading} />}
                        onClick={handleRefreshAll}
                        loading={reportLoading || auditLoading}
                        className="medpro-btn-outline !h-8 !px-3 font-semibold text-xs"
                    >
                        Làm mới
                    </Button>
                </div>
            </div>

            <div className="bg-clinic-surface rounded-[6px] border border-clinic-border grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-clinic-border">
                <div className="p-4">
                    <span className="text-xs font-semibold text-clinic-text-secondary block">
                        Tổng lượt tiếp nhận
                    </span>
                    <div className="text-xl font-extrabold text-clinic-navy mt-1 tabular-nums">
                        {reportLoading ? <Spin size="small" /> : `${kpi.tong_luot_tiep_nhan} lượt`}
                    </div>
                    <span className="text-[11px] text-clinic-text-secondary font-medium mt-0.5 inline-block tabular-nums">
                        <strong>{kpi.so_lich_hen}</strong> Lịch hẹn · <strong>{kpi.so_vang_lai}</strong> Vãng lai
                    </span>
                </div>

                <div className="p-4">
                    <span className="text-xs font-semibold text-clinic-text-secondary block">
                        Thời gian chờ TB (SLA)
                    </span>
                    <div className="text-xl font-extrabold text-clinic-navy mt-1 tabular-nums">
                        {reportLoading ? <Spin size="small" /> : `${kpi.thoi_gian_cho_trung_binh_phut} phút`}
                    </div>
                    <span className="text-[11px] text-clinic-text-muted font-medium mt-0.5 inline-block">
                        Từ check-in đến lúc bác sĩ gọi số
                    </span>
                </div>

                <div className="p-4">
                    <span className="text-xs font-semibold text-clinic-text-secondary block">
                        Hủy lịch trong ca
                    </span>
                    <div className="text-xl font-extrabold text-clinic-navy mt-1 tabular-nums">
                        {reportLoading ? <Spin size="small" /> : `${kpi.so_lich_huy} ca`}
                    </div>
                    <span className="text-[11px] text-clinic-text-muted font-medium mt-0.5 inline-block">
                        Có lý do hành chính hợp lệ
                    </span>
                </div>

                <div className="p-4">
                    <span className="text-xs font-semibold text-clinic-text-secondary block">
                        Vắng mặt (No-show)
                    </span>
                    <div className="text-xl font-extrabold text-clinic-navy mt-1 tabular-nums">
                        {reportLoading ? <Spin size="small" /> : `${kpi.so_no_show} ca`}
                    </div>
                    <span className="text-[11px] text-clinic-text-muted font-medium mt-0.5 inline-block">
                        Quá khung giờ không đến quầy
                    </span>
                </div>
            </div>

            <div className="medpro-card p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-clinic-border pb-3">
                    <h3 className="text-sm font-bold text-clinic-navy">
                        Phân bổ lượt tiếp nhận theo Chuyên khoa &amp; Thời gian chờ TB (SLA)
                    </h3>
                    <span className="text-xs text-clinic-text-secondary font-medium tabular-nums">
                        Ngày {selectedDate.format('DD/MM/YYYY')} {selectedShift ? `(${selectedShift === 'sang' ? 'Ca sáng' : 'Ca chiều'})` : '(Toàn ngày)'}
                    </span>
                </div>

                {reportLoading ? (
                    <div className="py-8 text-center"><Spin /></div>
                ) : specialtyBreakdown.length === 0 ? (
                    <Empty description="Chưa có dữ liệu phân bổ chuyên khoa trong ngày/ca này" />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                        {specialtyBreakdown.map((item) => (
                            <div
                                key={item.chuyen_khoa_id || item.ma_chuyen_khoa}
                                className="p-3.5 rounded-[6px] bg-clinic-bg border border-clinic-border space-y-2 text-xs tabular-nums"
                            >
                                <span className="font-bold text-clinic-navy block truncate" title={item.ten_chuyen_khoa}>
                                    {item.ten_chuyen_khoa}
                                </span>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-lg font-extrabold text-clinic-cta">{item.so_luot} lượt</span>
                                    <span className="text-clinic-text-secondary font-semibold">{item.ti_le_phan_tram}%</span>
                                </div>
                                <Progress
                                    percent={item.ti_le_phan_tram}
                                    showInfo={false}
                                    size="small"
                                    strokeColor="var(--color-clinic-cta)"
                                />
                                <div className="text-[11px] text-clinic-text-secondary font-medium pt-1 border-t border-clinic-border flex items-center justify-between">
                                    <span>Chờ trung bình:</span>
                                    <strong className="font-mono text-clinic-navy">{item.thoi_gian_cho_tb_phut || 0} phút</strong>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="medpro-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm lg:text-base font-bold text-clinic-navy">
                            Nhật ký kiểm toán thao tác tiếp đón
                        </h3>
                        <span className="text-xs text-clinic-text-secondary">
                            Truy vết đầy đủ người thực hiện, thời điểm, loại thao tác, số thứ tự và nội dung điều phối
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-clinic-border text-xs">
                    <Input
                        prefix={<SearchOutlined className="text-clinic-text-muted" />}
                        placeholder="Tìm kiếm theo Tên BN, SĐT, Số vé, Lễ tân..."
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        className="w-72 rounded-[6px]"
                        allowClear
                    />

                    <Select
                        className="w-60 rounded-[6px]"
                        placeholder="Lọc theo loại nghiệp vụ"
                        value={actionFilter || undefined}
                        onChange={(val) => setActionFilter(val || '')}
                        allowClear
                        options={ACTION_TYPE_OPTIONS}
                    />

                    <span className="text-xs text-clinic-text-secondary ml-auto font-mono tabular-nums">
                        Tổng cộng: <strong className="text-clinic-navy">{auditPagination?.total_items ?? auditPagination?.totalItems ?? auditLogs.length}</strong> bản ghi
                    </span>
                </div>

                <Table
                    columns={columns}
                    dataSource={auditLogs}
                    rowKey={(record) =>
                        record.id ||
                        `${record.timestamp || ''}-${record.action_type || ''}-${record.ticket_number || ''}-${record.patient_name || ''}`
                    }
                    loading={auditLoading}
                    pagination={{
                        current: currentPage,
                        pageSize: pageSize,
                        total: auditPagination?.total_items ?? auditPagination?.totalItems ?? auditLogs.length,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} thao tác`,
                    }}
                    onChange={handleTableChange}
                    size="middle"
                    locale={{
                        emptyText: (
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description="Không tìm thấy nhật ký kiểm toán nào phù hợp với bộ lọc"
                            />
                        ),
                    }}
                />
            </div>
        </div>
    )
}
