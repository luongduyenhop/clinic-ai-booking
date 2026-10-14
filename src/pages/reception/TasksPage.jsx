import { useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Table, Tag, Input, Select, Button, Space, Card, Segmented } from 'antd'
import {
    AlertOutlined,
    SearchOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    ThunderboltOutlined,
} from '@ant-design/icons'
import TaskActionModal from '../../components/reception/TaskActionModal'
import { TASK_SEVERITY_LABELS } from '../../utils/constants/receptionConstants'

export default function TasksPage() {
    const { tasks } = useSelector((state) => state.reception)

    const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'PENDING' | 'RESOLVED'
    const [severityFilter, setSeverityFilter] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedTask, setSelectedTask] = useState(null)

    const filteredTasks = useMemo(() => {
        return tasks.filter((t) => {
            const matchesQuery =
                !searchQuery ||
                t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.description.toLowerCase().includes(searchQuery.toLowerCase())

            const matchesStatus =
                statusFilter === 'ALL' ||
                (statusFilter === 'PENDING' && t.status !== 'RESOLVED') ||
                (statusFilter === 'RESOLVED' && t.status === 'RESOLVED')

            const matchesSeverity = !severityFilter || t.severity === severityFilter

            return matchesQuery && matchesStatus && matchesSeverity
        })
    }, [tasks, searchQuery, statusFilter, severityFilter])

    const pendingCount = tasks.filter((t) => t.status === 'PENDING').length
    const criticalCount = tasks.filter((t) => t.severity === 'CRITICAL' && t.status === 'PENDING').length

    const columns = [
        {
            title: 'Mức độ',
            dataIndex: 'severity',
            key: 'severity',
            width: 120,
            render: (sev) => {
                const cfg = TASK_SEVERITY_LABELS[sev] || { label: sev, color: 'default' }
                return <Tag color={cfg.color} className="font-bold text-xs">{cfg.label}</Tag>
            },
        },
        {
            title: 'Sự cố & Nội dung',
            key: 'title',
            render: (_, record) => (
                <div className="space-y-1">
                    <span className="font-bold text-slate-800 text-sm block">{record.title}</span>
                    <p className="text-slate-600 text-xs">{record.description}</p>
                    {record.recommendedAction && (
                        <div className="text-[11px] text-sky-700 bg-sky-50 px-2 py-1 rounded-md border border-sky-100 font-medium">
                            💡 Khuyến nghị: {record.recommendedAction}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Thời điểm',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 150,
            render: (time) => <span className="text-slate-400 text-xs font-mono">{time}</span>,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 130,
            render: (st, record) => {
                if (st === 'RESOLVED') {
                    return (
                        <div>
                            <Tag color="success" className="font-semibold text-xs">
                                Đã xử lý
                            </Tag>
                            {record.resolutionNote && (
                                <span className="text-[10px] text-slate-400 block mt-0.5 line-clamp-1">
                                    {record.resolutionNote}
                                </span>
                            )}
                        </div>
                    )
                }
                return (
                    <Tag color="warning" className="font-semibold text-xs">
                        Đang chờ xử lý
                    </Tag>
                )
            },
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 130,
            align: 'right',
            render: (_, record) => {
                if (record.status === 'RESOLVED') {
                    return <span className="text-emerald-600 text-xs font-medium">✓ Hoàn tất</span>
                }
                return (
                    <Button
                        size="small"
                        type="primary"
                        className="bg-sky-600 hover:bg-sky-700 text-xs font-semibold"
                        onClick={() => setSelectedTask(record)}
                    >
                        Xử lý ngay
                    </Button>
                )
            },
        },
    ]

    return (
        <div className="space-y-5">
            {/* Header info bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">Sự cố hành chính cần xử lý (Triage Tasks)</h2>
                        <span className="text-xs text-slate-500">
                            Tổng hợp các ca ngoại lệ: bệnh nhân đến muộn, bác sĩ nghỉ, hồ sơ trùng, quá tải phòng khám
                        </span>
                    </div>
                    <div className="flex gap-2">
                        {criticalCount > 0 && (
                            <Tag color="error" className="px-3 py-1 text-xs font-bold animate-pulse">
                                {criticalCount} sự cố khẩn cấp
                            </Tag>
                        )}
                        <Tag color="warning" className="px-3 py-1 text-xs font-bold">
                            {pendingCount} vụ việc tồn đọng
                        </Tag>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-3">
                        <Segmented
                            value={statusFilter}
                            onChange={setStatusFilter}
                            options={[
                                { label: 'Tất cả', value: 'ALL' },
                                { label: 'Chờ xử lý', value: 'PENDING' },
                                { label: 'Đã hoàn tất', value: 'RESOLVED' },
                            ]}
                        />
                        <Select
                            className="w-36"
                            placeholder="Mức độ"
                            value={severityFilter || undefined}
                            onChange={(val) => setSeverityFilter(val || '')}
                            allowClear
                            options={[
                                { value: 'CRITICAL', label: 'Khẩn cấp' },
                                { value: 'HIGH', label: 'Cao' },
                                { value: 'MEDIUM', label: 'Trung bình' },
                                { value: 'LOW', label: 'Thấp' },
                            ]}
                        />
                    </div>
                    <Input
                        prefix={<SearchOutlined className="text-slate-400" />}
                        placeholder="Tìm tiêu đề sự cố..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-64"
                        allowClear
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <Table
                    columns={columns}
                    dataSource={filteredTasks}
                    rowKey="id"
                    pagination={{ pageSize: 8, showSizeChanger: true }}
                    size="middle"
                />
            </div>

            {/* Task Action Modal */}
            <TaskActionModal
                open={Boolean(selectedTask)}
                onClose={() => setSelectedTask(null)}
                task={selectedTask}
            />
        </div>
    )
}
