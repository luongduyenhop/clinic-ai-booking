import { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Table, Tag, Input, Select, Progress, Button, DatePicker, Spin, Empty } from 'antd'
import {
    SearchOutlined,
    SyncOutlined,
    CalendarOutlined,
    ClockCircleOutlined,
    FieldTimeOutlined,
    UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
    fetchReportSummaryAsync,
    fetchAuditLogsAsync,
} from '../../redux/actions/reception/receptionAction'

// Bảng màu chuẩn 9 loại hành động kiểm toán (theo đặc tả API 9.2)
const ACTION_TYPE_COLOR_MAP = {
    CHECK_IN: 'blue',
    WALK_IN_CREATE: 'orange',
    APPOINTMENT_RESCHEDULE: 'cyan',
    APPOINTMENT_CANCEL: 'red',
    QUEUE_TRANSFER_ROOM: 'geekblue',
    QUEUE_CALL: 'purple',
    QUEUE_DEFER: 'warning',
    LEAVE_QUEUE: 'volcano',
    CLOSE_TICKET: 'magenta',
}

const ACTION_TYPE_OPTIONS = [
    { value: '', label: 'Tất cả loại hành động' },
    { value: 'CHECK_IN', label: 'CHECK_IN (Tiếp nhận đặt trước)' },
    { value: 'WALK_IN_CREATE', label: 'WALK_IN_CREATE (Tiếp nhận vãng lai)' },
    { value: 'APPOINTMENT_RESCHEDULE', label: 'APPOINTMENT_RESCHEDULE (Đổi lịch khám)' },
    { value: 'APPOINTMENT_CANCEL', label: 'APPOINTMENT_CANCEL (Hủy lịch hẹn)' },
    { value: 'QUEUE_TRANSFER_ROOM', label: 'QUEUE_TRANSFER_ROOM (Chuyển buồng khám)' },
    { value: 'QUEUE_CALL', label: 'QUEUE_CALL (Bác sĩ gọi số)' },
    { value: 'QUEUE_DEFER', label: 'QUEUE_DEFER (Tạm hoãn lượt)' },
    { value: 'LEAVE_QUEUE', label: 'LEAVE_QUEUE (Bỏ khám)' },
    { value: 'CLOSE_TICKET', label: 'CLOSE_TICKET (Đóng vé)' },
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

    // Bộ lọc ngày & ca khám cho toàn bộ trang đối soát
    const [selectedDate, setSelectedDate] = useState(() => dayjs())
    const [selectedShift, setSelectedShift] = useState('') // '' (cả ngày) | 'sang' | 'chieu'

    // Bộ lọc cho bảng Audit Logs
    const [searchKeyword, setSearchKeyword] = useState('')
    const [actionFilter, setActionFilter] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    // Chuỗi ngày YYYY-MM-DD
    const queryDateStr = selectedDate ? selectedDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')

    // Tải báo cáo chỉ số vận hành & đối soát tiếp đón (API 9.1)
    const loadReportSummary = useCallback(() => {
        dispatch(
            fetchReportSummaryAsync({
                queryDate: queryDateStr,
                caKham: selectedShift || undefined,
            })
        )
    }, [dispatch, queryDateStr, selectedShift])

    // Tải nhật ký kiểm toán (API 9.2)
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

    // Kích hoạt nạp dữ liệu khi đổi ngày hoặc ca khám
    useEffect(() => {
        loadReportSummary()
    }, [loadReportSummary])

    // Kích hoạt nạp nhật ký kiểm toán với debounce khi người dùng gõ tìm kiếm hoặc đổi filter
    useEffect(() => {
        const timer = setTimeout(() => {
            loadAuditLogs(1, pageSize)
            setCurrentPage(1)
        }, 350)
        return () => clearTimeout(timer)
    }, [queryDateStr, actionFilter, searchKeyword, pageSize, dispatch])

    // Xử lý chuyển trang trên Table Audit Logs
    const handleTableChange = (pagination) => {
        setCurrentPage(pagination.current)
        setPageSize(pagination.pageSize)
        loadAuditLogs(pagination.current, pagination.pageSize)
    }

    // Nút làm mới toàn bộ trang
    const handleRefreshAll = () => {
        loadReportSummary()
        loadAuditLogs(currentPage, pageSize)
    }

    // Trích xuất số liệu KPI an toàn từ Response API 9.1
    const kpi = reportSummary?.kpi || {
        tong_luot_tiep_nhan: 0,
        so_lich_hen: 0,
        so_vang_lai: 0,
        thoi_gian_cho_trung_binh_phut: 0,
        so_lich_huy: 0,
        so_no_show: 0,
    }

    const specialtyBreakdown = reportSummary?.phan_bo_chuyen_khoa || []

    // Cấu hình bảng Audit Logs
    const columns = [
        {
            title: 'Thời gian',
            dataIndex: 'timestamp',
            key: 'timestamp',
            width: 160,
            render: (time) => (
                <span className="font-mono text-slate-600 text-xs flex items-center gap-1">
                    <ClockCircleOutlined className="text-slate-400 text-[11px]" />
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
                <span className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                    <UserOutlined className="text-sky-600 text-xs" />
                    {actor || 'Lễ tân tiếp đón'}
                </span>
            ),
        },
        {
            title: 'Hành động',
            dataIndex: 'action_type',
            key: 'action_type',
            width: 180,
            render: (act) => {
                const color = ACTION_TYPE_COLOR_MAP[act] || 'default'
                return (
                    <Tag color={color} className="font-mono text-[11px] font-bold m-0">
                        {act}
                    </Tag>
                )
            },
        },
        {
            title: 'Đối tượng & Buồng khám',
            key: 'target',
            width: 220,
            render: (_, record) => (
                <div className="text-xs space-y-0.5">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        {record.ticket_number && (
                            <span className="font-mono text-sky-700 bg-sky-50 px-1 py-0.5 rounded border border-sky-200">
                                {record.ticket_number}
                            </span>
                        )}
                        <span>{record.patient_name || 'Khách vãng lai'}</span>
                    </div>
                    {record.phone && (
                        <div className="text-[11px] text-slate-500">SĐT: {record.phone}</div>
                    )}
                    {record.room_name && (
                        <div className="text-[11px] text-slate-600 font-medium">{record.room_name}</div>
                    )}
                </div>
            ),
        },
        {
            title: 'Chi tiết nội dung điều phối',
            dataIndex: 'description',
            key: 'description',
            render: (desc) => (
                <div className="text-xs text-slate-700 leading-relaxed font-normal">
                    {desc || 'Không có mô tả chi tiết'}
                </div>
            ),
        },
    ]

    return (
        <div className="space-y-6">
            {/* Header Toolbar: Tiêu đề + Bộ lọc Ngày xem & Ca trực */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <FieldTimeOutlined className="text-sky-600" />
                        Báo cáo Đối soát & Nhật ký Kiểm toán
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Phân hệ đối soát chất lượng phục vụ tiếp đón (SLA), tỷ lệ phân bổ và truy vết thao tác điều phối
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    {/* Bộ lọc Ngày đối soát */}
                    <DatePicker
                        value={selectedDate}
                        onChange={(d) => setSelectedDate(d || dayjs())}
                        format="DD/MM/YYYY"
                        allowClear={false}
                        className="w-36 rounded-xl font-medium"
                        prefix={<CalendarOutlined className="text-slate-400 mr-1" />}
                    />

                    {/* Bộ lọc Ca làm việc */}
                    <Select
                        value={selectedShift}
                        onChange={(val) => setSelectedShift(val)}
                        className="w-44 rounded-xl"
                        options={[
                            { value: '', label: 'Cả ngày (Tất cả ca)' },
                            { value: 'sang', label: 'Ca sáng (07:30 - 11:30)' },
                            { value: 'chieu', label: 'Ca chiều (13:30 - 17:30)' },
                        ]}
                    />

                    {/* Nút Làm mới */}
                    <Button
                        icon={<SyncOutlined spin={reportLoading || auditLoading} />}
                        onClick={handleRefreshAll}
                        loading={reportLoading || auditLoading}
                        className="rounded-xl font-semibold text-xs"
                    >
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* 4 Thẻ KPI Đầu trang (API 9.1 ReceptionReportSummaryResponse) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 1. Tổng lượt tiếp nhận */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                        Tổng lượt tiếp nhận
                    </span>
                    <div className="text-3xl font-black text-sky-700 mt-2">
                        {reportLoading ? <Spin size="small" /> : `${kpi.tong_luot_tiep_nhan} lượt`}
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">
                        <strong>{kpi.so_lich_hen}</strong> Lịch hẹn • <strong>{kpi.so_vang_lai}</strong> Vãng lai
                    </span>
                </div>

                {/* 2. Thời gian chờ trung bình (SLA) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                        Thời gian chờ TB (SLA)
                    </span>
                    <div className="text-3xl font-black text-amber-600 mt-2">
                        {reportLoading ? <Spin size="small" /> : `${kpi.thoi_gian_cho_trung_binh_phut} phút`}
                    </div>
                    <span className="text-[11px] text-amber-700 font-medium mt-1 inline-block">
                        Tính từ check-in đến lúc bác sĩ gọi số
                    </span>
                </div>

                {/* 3. Lịch hẹn bị hủy */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                        Hủy lịch trong ca
                    </span>
                    <div className="text-3xl font-black text-red-600 mt-2">
                        {reportLoading ? <Spin size="small" /> : `${kpi.so_lich_huy} ca`}
                    </div>
                    <span className="text-[11px] text-red-500 font-medium mt-1 inline-block">
                        Có lý do hành chính hợp lệ
                    </span>
                </div>

                {/* 4. Không đến (No-show) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                        Bùng hẹn (No-show)
                    </span>
                    <div className="text-3xl font-black text-slate-700 mt-2">
                        {reportLoading ? <Spin size="small" /> : `${kpi.so_no_show} ca`}
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">
                        Quá khung giờ không đến quầy
                    </span>
                </div>
            </div>

            {/* Khối Phân bổ lượt tiếp nhận theo Chuyên khoa (API 9.1) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-800">
                        Phân bổ lượt tiếp nhận theo Chuyên khoa & Thời gian chờ TB (SLA)
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">
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
                                className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2 text-xs"
                            >
                                <span className="font-bold text-slate-800 block truncate" title={item.ten_chuyen_khoa}>
                                    {item.ten_chuyen_khoa}
                                </span>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-xl font-black text-sky-700">{item.so_luot} lượt</span>
                                    <span className="text-slate-500 font-semibold">{item.ti_le_phan_tram}%</span>
                                </div>
                                <Progress
                                    percent={item.ti_le_phan_tram}
                                    showInfo={false}
                                    size="small"
                                    strokeColor="#0284c7"
                                />
                                <div className="text-[11px] text-amber-700 font-medium pt-1 border-t border-slate-200/60 flex items-center justify-between">
                                    <span>Chờ trung bình:</span>
                                    <strong className="font-mono">{item.thoi_gian_cho_tb_phut || 0} phút</strong>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Khối Nhật ký Kiểm toán Thao tác Tiếp đón (Audit Logs - API 9.2) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">
                            Nhật ký kiểm toán thao tác tiếp đón (Audit Trail)
                        </h2>
                        <span className="text-xs text-slate-500">
                            Truy vết đầy đủ người thực hiện, thời điểm, loại hành động, số vé và lý do điều phối từ cơ sở dữ liệu
                        </span>
                    </div>
                </div>

                {/* Thanh bộ lọc bảng Audit Logs */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
                    <Input
                        prefix={<SearchOutlined className="text-slate-400" />}
                        placeholder="Tìm kiếm theo Tên BN, SĐT, Số vé, Lễ tân..."
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        className="w-72 rounded-xl"
                        allowClear
                    />

                    <Select
                        className="w-64 rounded-xl"
                        placeholder="Loại hành động kiểm toán"
                        value={actionFilter || undefined}
                        onChange={(val) => setActionFilter(val || '')}
                        allowClear
                        options={ACTION_TYPE_OPTIONS}
                    />

                    <span className="text-xs text-slate-400 ml-auto font-mono">
                        Tổng cộng: <strong>{auditPagination?.total_items ?? auditPagination?.totalItems ?? auditLogs.length}</strong> bản ghi
                    </span>
                </div>

                {/* Bảng dữ liệu Audit Logs */}
                <Table
                    columns={columns}
                    dataSource={auditLogs}
                    rowKey={(record) => record.id || `${record.timestamp}-${record.action_type}-${Math.random()}`}
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
