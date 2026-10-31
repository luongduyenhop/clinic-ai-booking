import { useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Table, Tag, Input, Select, DatePicker, Button, Card, Progress } from 'antd'
import {
    BarChartOutlined,
    SearchOutlined,
    FilterOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

export default function ReportsPage() {
    const { auditLogs, queueEntries, appointments, departments } = useSelector((state) => state.reception)

    const [searchQuery, setSearchQuery] = useState('')
    const [actionFilter, setActionFilter] = useState('')
    const [actorFilter, setActorFilter] = useState('')

    // Statistics computed from mock data
    const totalCheckIn = queueEntries.length
    const walkInCount = queueEntries.filter((q) => q.isWalkIn).length
    const bookedCount = totalCheckIn - walkInCount

    const avgWaitTime =
        queueEntries.length > 0
            ? Math.round(queueEntries.reduce((sum, q) => sum + (q.waitTimeMinutes || 0), 0) / queueEntries.length)
            : 0

    const cancelledApps = appointments.filter((a) => a.status === 'CANCELLED').length
    const noShowApps = appointments.filter((a) => a.status === 'NO_SHOW').length

    // Department breakdown
    const departmentStats = departments.map((dep) => {
        const count = queueEntries.filter((q) => q.departmentId === dep.id).length
        const pct = Math.round((count / (totalCheckIn || 1)) * 100)
        return { ...dep, count, pct }
    })

    // Filter audit logs
    const filteredLogs = useMemo(() => {
        return auditLogs.filter((log) => {
            const matchesQuery =
                !searchQuery ||
                log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.actionType.toLowerCase().includes(searchQuery.toLowerCase())

            const matchesAction = !actionFilter || log.actionType === actionFilter
            const matchesActor = !actorFilter || log.actor.includes(actorFilter)

            return matchesQuery && matchesAction && matchesActor
        })
    }, [auditLogs, searchQuery, actionFilter, actorFilter])

    const columns = [
        {
            title: 'Thời gian',
            dataIndex: 'timestamp',
            key: 'timestamp',
            width: 170,
            render: (time) => <span className="font-mono text-slate-500 text-xs">{time}</span>,
        },
        {
            title: 'Người thực hiện',
            dataIndex: 'actor',
            key: 'actor',
            width: 220,
            render: (actor) => (
                <div className="text-xs">
                    <span className="font-bold text-slate-800 block">{actor.split(' (')[0]}</span>
                    <span className="text-slate-400 text-[11px] font-mono">{actor.split(' (')[1]?.replace(')', '')}</span>
                </div>
            ),
        },
        {
            title: 'Hành động',
            dataIndex: 'actionType',
            key: 'actionType',
            width: 170,
            render: (act) => {
                const colorMap = {
                    CHECK_IN: 'blue',
                    WALK_IN_CREATE: 'orange',
                    APPOINTMENT_CANCEL: 'red',
                    APPOINTMENT_RESCHEDULE: 'cyan',
                    QUEUE_CALL: 'purple',
                    QUEUE_DEFER: 'warning',
                    QUEUE_TRANSFER_ROOM: 'geekblue',
                    EMERGENCY_HANDOVER: 'error',
                }
                return <Tag color={colorMap[act] || 'default'} className="font-mono text-[11px] font-bold">{act}</Tag>
            },
        },
        {
            title: 'Nội dung & Đối tượng thao tác',
            dataIndex: 'description',
            key: 'description',
            render: (desc, record) => (
                <div className="text-xs space-y-1">
                    <span className="font-semibold text-slate-800 block">{desc}</span>
                    {record.details && (
                        <div className="text-[11px] text-slate-400 font-mono bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            {JSON.stringify(record.details)}
                        </div>
                    )}
                </div>
            ),
        },
    ]

    return (
        <div className="space-y-6">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                    <span className="text-xs font-bold text-slate-400 uppercase">Tổng lượt tiếp nhận</span>
                    <div className="text-3xl font-black text-sky-700 mt-2">{totalCheckIn} lượt</div>
                    <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">
                        {bookedCount} Lịch hẹn • {walkInCount} Walk-in
                    </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                    <span className="text-xs font-bold text-slate-400 uppercase">Thời gian chờ TB</span>
                    <div className="text-3xl font-black text-amber-600 mt-2">{avgWaitTime} phút</div>
                    <span className="text-[11px] text-amber-700 font-medium mt-1 inline-block">
                        Tính từ lúc check-in đến gọi số
                    </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                    <span className="text-xs font-bold text-slate-400 uppercase">Hủy lịch trong ca</span>
                    <div className="text-3xl font-black text-red-600 mt-2">{cancelledApps} ca</div>
                    <span className="text-[11px] text-red-500 font-medium mt-1 inline-block">
                        Có lý do hủy hợp lệ
                    </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                    <span className="text-xs font-bold text-slate-400 uppercase">Không đến (No-show)</span>
                    <div className="text-3xl font-black text-slate-700 mt-2">{noShowApps} ca</div>
                    <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">
                        Hết slot giờ không liên lạc được
                    </span>
                </div>
            </div>

            {/* Department Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <h3 className="text-sm font-bold text-slate-800">Phân bổ lượt tiếp nhận theo chuyên khoa</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {departmentStats.map((dep) => (
                        <div key={dep.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                            <span className="font-bold text-slate-800 block truncate">{dep.name}</span>
                            <div className="flex justify-between items-baseline">
                                <span className="text-xl font-black text-sky-700">{dep.count}</span>
                                <span className="text-slate-400 font-semibold">{dep.pct}%</span>
                            </div>
                            <Progress percent={dep.pct} showInfo={false} size="small" strokeColor="#0284c7" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Audit Log Table */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">Nhật ký kiểm toán thao tác lễ tân (Audit Logs)</h2>
                        <span className="text-xs text-slate-500">
                            Truy vết đầy đủ người thực hiện, thời gian, hành động, lý do và trạng thái trước/sau
                        </span>
                    </div>
                </div>

                {/* Filter controls */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
                    <Input
                        prefix={<SearchOutlined className="text-slate-400" />}
                        placeholder="Tìm kiếm nội dung audit..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-72"
                        allowClear
                    />
                    <Select
                        className="w-52"
                        placeholder="Loại hành động"
                        value={actionFilter || undefined}
                        onChange={(val) => setActionFilter(val || '')}
                        allowClear
                        options={[
                            { value: 'CHECK_IN', label: 'CHECK_IN (Tiếp nhận)' },
                            { value: 'WALK_IN_CREATE', label: 'WALK_IN_CREATE (Tạo walk-in)' },
                            { value: 'QUEUE_CALL', label: 'QUEUE_CALL (Gọi số)' },
                            { value: 'QUEUE_DEFER', label: 'QUEUE_DEFER (Tạm hoãn)' },
                            { value: 'QUEUE_TRANSFER_ROOM', label: 'QUEUE_TRANSFER_ROOM (Chuyển phòng)' },
                            { value: 'APPOINTMENT_CANCEL', label: 'APPOINTMENT_CANCEL (Hủy lịch)' },
                            { value: 'EMERGENCY_HANDOVER', label: 'EMERGENCY_HANDOVER (Cấp cứu)' },
                        ]}
                    />
                    <Select
                        className="w-48"
                        placeholder="Nhân viên thực hiện"
                        value={actorFilter || undefined}
                        onChange={(val) => setActorFilter(val || '')}
                        allowClear
                        options={[
                            { value: 'Nguyễn Thị Hoa', label: 'Nguyễn Thị Hoa (Lễ tân)' },
                            { value: 'Lê Văn Tuấn', label: 'Lê Văn Tuấn (Lễ tân)' },
                            { value: 'Trần Đình Nam', label: 'Trần Đình Nam (Giám sát)' },
                        ]}
                    />
                </div>

                <Table
                    columns={columns}
                    dataSource={filteredLogs}
                    rowKey="id"
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    size="middle"
                />
            </div>
        </div>
    )
}
