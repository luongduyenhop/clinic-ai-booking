import { useState, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Table, Tabs, Input, Select, Button, Tag, Space, Modal, Timeline, message, Tooltip, Dropdown } from 'antd'
import {
    SearchOutlined,
    ClockCircleOutlined,
    SwapOutlined,
    PauseCircleOutlined,
    PlayCircleOutlined,
    CloseCircleOutlined,
    AlertOutlined,
    HistoryOutlined,
    SoundOutlined,
    ArrowUpOutlined,
    MoreOutlined,
    UserDeleteOutlined,
} from '@ant-design/icons'
import {
    callQueueEntryAsync,
    markAbsentAsync,
    resumeQueueEntryAsync,
} from '../../redux/slices/reception/receptionSlice'
import QueueActionModal from '../../components/reception/QueueActionModal'
import PatientDetailDrawer from '../../components/reception/PatientDetailDrawer'
import EmergencyHandoverModal from '../../components/reception/EmergencyHandoverModal'
import { QUEUE_STATUS, QUEUE_STATUS_LABELS } from '../../utils/constants/receptionConstants'

export default function QueueManagementPage() {
    const dispatch = useDispatch()
    const { queueEntries, patients, rooms, departments, doctors, services } = useSelector((state) => state.reception)

    const [activeTab, setActiveTab] = useState('ALL') // 'ALL' | 'WAITING' | 'CALLED' | 'DEFERRED' | 'IN_CONSULTATION' | 'COMPLETED'
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedRoom, setSelectedRoom] = useState('')
    const [selectedDepartment, setSelectedDepartment] = useState('')

    // Modal states
    const [actionModal, setActionModal] = useState({ open: false, entry: null, mode: 'DEFER' })
    const [historyModal, setHistoryModal] = useState({ open: false, entry: null })
    const [patientDrawerId, setPatientDrawerId] = useState(null)
    const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false)

    // Filter queue entries
    const filteredQueue = useMemo(() => {
        return queueEntries.filter((q) => {
            const pat = patients.find((p) => p.id === q.patientId)
            const matchesQuery =
                !searchQuery ||
                q.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                (pat && pat.fullName.toLowerCase().includes(searchQuery.toLowerCase().trim())) ||
                (pat && pat.phone.includes(searchQuery.trim()))

            const matchesRoom = !selectedRoom || q.roomId === selectedRoom
            const matchesDep = !selectedDepartment || q.departmentId === selectedDepartment
            const matchesTab = activeTab === 'ALL' || q.status === activeTab

            return matchesQuery && matchesRoom && matchesDep && matchesTab
        })
    }, [queueEntries, patients, searchQuery, selectedRoom, selectedDepartment, activeTab])

    // Operation handlers
    const handleCallNumber = async (entry) => {
        try {
            await dispatch(callQueueEntryAsync({ queueId: entry.id })).unwrap()
            message.success(`Đang phát loa gọi số: ${entry.ticketNumber} (Lần ${(entry.callCount || 0) + 1})`)
        } catch (err) {
            message.error(err.message || 'Lỗi khi gọi số')
        }
    }

    const handleMarkAbsent = async (entry) => {
        try {
            await dispatch(markAbsentAsync({ queueId: entry.id })).unwrap()
            message.warning(`Đã ghi nhận vắng mặt số: ${entry.ticketNumber} (RC-05)`)
        } catch (err) {
            message.error(err.message || 'Lỗi khi ghi nhận vắng mặt')
        }
    }

    const handleResume = async (entry) => {
        try {
            await dispatch(resumeQueueEntryAsync({ queueId: entry.id })).unwrap()
            message.success(`Đã đưa số ${entry.ticketNumber} trở lại hàng đợi đang chờ`)
        } catch (err) {
            message.error(err.message || 'Lỗi khi tiếp tục lượt khám')
        }
    }

    const columns = [
        {
            title: 'STT & Số vé',
            dataIndex: 'ticketNumber',
            key: 'ticketNumber',
            width: 130,
            render: (ticket, record) => (
                <div>
                    <span className="text-base font-black text-sky-700 tracking-tight block">{ticket}</span>
                    <div className="flex gap-1 mt-0.5">
                        <Tag color={record.isWalkIn ? 'orange' : 'blue'} className="mr-0 text-[10px]">
                            {record.isWalkIn ? 'Walk-in' : 'Có lịch'}
                        </Tag>
                        {record.priority === 'PRIORITY' && (
                            <Tag color="purple" className="mr-0 text-[10px]">
                                Ưu tiên
                            </Tag>
                        )}
                    </div>
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
                        <button
                            onClick={() => setPatientDrawerId(record.patientId)}
                            className="font-bold text-slate-900 hover:text-sky-600 hover:underline text-left cursor-pointer"
                        >
                            {pat?.fullName || 'N/A'}
                        </button>
                        <div className="text-slate-400 text-xs flex gap-2">
                            <span>{pat?.phone}</span>
                            <span>•</span>
                            <span className="font-mono">{pat?.patientCode}</span>
                        </div>
                    </div>
                )
            },
        },
        {
            title: 'Thời gian & Chờ',
            key: 'time',
            width: 140,
            render: (_, record) => {
                const isLate = record.waitTimeMinutes > 40 || record.isLongWait
                return (
                    <div className="text-xs">
                        <div className="flex items-center gap-1 text-slate-500">
                            <ClockCircleOutlined /> Check-in: <strong>{record.checkInTime}</strong>
                        </div>
                        <div className="mt-1">
                            <span
                                className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                                    isLate ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-slate-100 text-slate-700'
                                }`}
                            >
                                Đã chờ: {record.waitTimeMinutes} phút
                            </span>
                        </div>
                    </div>
                )
            },
        },
        {
            title: 'Phòng khám & Bác sĩ',
            key: 'room',
            render: (_, record) => {
                const room = rooms.find((r) => r.id === record.roomId)
                const doc = doctors.find((d) => d.id === record.doctorId)
                const srv = services.find((s) => s.id === record.serviceId)
                return (
                    <div className="text-xs">
                        <span className="font-bold text-teal-800 block">{room?.name} ({room?.floor})</span>
                        <span className="text-slate-500">BS: {doc?.name}</span>
                        <span className="text-slate-400 block text-[11px]">{srv?.name}</span>
                    </div>
                )
            },
        },
        {
            title: 'Trạng thái & Lần gọi',
            key: 'status',
            width: 160,
            render: (_, record) => {
                const st = QUEUE_STATUS_LABELS[record.status] || { label: record.status, color: 'default' }
                return (
                    <div className="space-y-1">
                        <Tag color={st.color} className="font-bold text-xs">{st.label}</Tag>
                        {record.callCount > 0 && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                <SoundOutlined /> Đã gọi: <strong>{record.callCount} lần</strong>
                            </div>
                        )}
                        {record.isAbsent && (
                            <span className="text-[10px] font-bold text-red-600 block">Vắng mặt (RC-05)</span>
                        )}
                        {record.deferredReason && (
                            <span className="text-[10px] text-amber-600 italic block line-clamp-1">
                                Lý do: {record.deferredReason}
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            title: 'Thao tác điều phối',
            key: 'actions',
            width: 170,
            align: 'right',
            render: (_, record) => {
                const isFinished = record.status === QUEUE_STATUS.COMPLETED || record.status === QUEUE_STATUS.CANCELLED
                const isInConsult = record.status === QUEUE_STATUS.IN_CONSULTATION

                if (isFinished) {
                    return (
                        <Button size="small" onClick={() => setHistoryModal({ open: true, entry: record })} className="text-xs">
                            Lịch sử
                        </Button>
                    )
                }

                const menuItems = [
                    {
                        key: 'transfer',
                        label: 'Chuyển phòng khám (RC-07)',
                        icon: <SwapOutlined />,
                        disabled: isInConsult,
                        onClick: () => setActionModal({ open: true, entry: record, mode: 'TRANSFER' }),
                    },
                    {
                        key: 'defer',
                        label: 'Tạm hoãn lượt khám',
                        icon: <PauseCircleOutlined />,
                        disabled: isInConsult || record.status === QUEUE_STATUS.DEFERRED,
                        onClick: () => setActionModal({ open: true, entry: record, mode: 'DEFER' }),
                    },
                    {
                        key: 'reorder',
                        label: 'Điều phối ưu tiên (RC-22)',
                        icon: <ArrowUpOutlined />,
                        disabled: isInConsult,
                        onClick: () => setActionModal({ open: true, entry: record, mode: 'REORDER' }),
                    },
                    {
                        key: 'absent',
                        label: 'Ghi nhận vắng mặt (RC-05)',
                        icon: <UserDeleteOutlined />,
                        disabled: record.status !== QUEUE_STATUS.CALLED || record.isAbsent,
                        onClick: () => handleMarkAbsent(record),
                    },
                    {
                        key: 'history',
                        label: 'Xem lịch sử chặng',
                        icon: <HistoryOutlined />,
                        onClick: () => setHistoryModal({ open: true, entry: record }),
                    },
                    {
                        type: 'divider',
                    },
                    {
                        key: 'cancel',
                        label: 'Hủy lượt khám (RC-28)',
                        icon: <CloseCircleOutlined />,
                        danger: true,
                        disabled: isInConsult,
                        onClick: () => setActionModal({ open: true, entry: record, mode: 'CANCEL' }),
                    },
                ]

                return (
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {/* Primary Action Button */}
                        {record.status === QUEUE_STATUS.DEFERRED ? (
                            <Button
                                size="small"
                                type="primary"
                                className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold"
                                icon={<PlayCircleOutlined />}
                                onClick={() => handleResume(record)}
                            >
                                Tiếp tục
                            </Button>
                        ) : (
                            <Button
                                size="small"
                                type="primary"
                                icon={<SoundOutlined />}
                                className="bg-sky-600 text-xs font-bold"
                                onClick={() => handleCallNumber(record)}
                            >
                                {record.callCount > 0 ? `Gọi lại (${record.callCount})` : 'Gọi số'}
                            </Button>
                        )}

                        {/* Quick Transfer Button */}
                        {!isInConsult && (
                            <Button
                                size="small"
                                icon={<SwapOutlined />}
                                className="text-xs"
                                onClick={() => setActionModal({ open: true, entry: record, mode: 'TRANSFER' })}
                                title="Chuyển phòng"
                            >
                                Chuyển
                            </Button>
                        )}

                        {/* More Actions Dropdown */}
                        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                            <Button size="small" icon={<MoreOutlined />} className="text-xs text-slate-500" title="Thao tác khác" />
                        </Dropdown>
                    </div>
                )
            },
        },
    ]

    return (
        <div className="space-y-5">
            {/* Rooms Waiting Summary Cards */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Số lượng bệnh nhân đang chờ theo từng phòng khám
                        </h3>
                        <span className="text-[11px] text-slate-400">
                            Bấm vào từng phòng để lọc nhanh danh sách hàng đợi của phòng đó
                        </span>
                    </div>
                    <Button
                        size="small"
                        danger
                        icon={<AlertOutlined />}
                        onClick={() => setIsEmergencyModalOpen(true)}
                        className="font-semibold text-xs"
                    >
                        Bàn giao y tế khẩn (RC-06)
                    </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-2.5">
                    {rooms.map((room) => {
                        const isSelected = selectedRoom === room.id
                        const isOverloaded = room.currentWaiting >= room.capacity || room.status === 'OVERLOAD'
                        const isMaintenance = room.status === 'MAINTENANCE'

                        return (
                            <button
                                key={room.id}
                                onClick={() => setSelectedRoom(isSelected ? '' : room.id)}
                                title={room.name}
                                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                                    isSelected
                                        ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200'
                                        : isMaintenance
                                        ? 'border-slate-200 bg-slate-50 opacity-60'
                                        : isOverloaded
                                        ? 'border-red-200 bg-red-50/70'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                            >
                                <div className="text-[11px] font-bold text-slate-800 truncate" title={room.name}>{room.name}</div>
                                <div className="flex items-baseline justify-between mt-1">
                                    <span
                                        className={`text-lg font-black ${
                                            isOverloaded ? 'text-red-600' : 'text-slate-800'
                                        }`}
                                    >
                                        {room.currentWaiting}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">/{room.capacity} chờ</span>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Filter Bar & Tabs */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        className="mb-0"
                        items={[
                            { key: 'ALL', label: `Tất cả (${queueEntries.length})` },
                            {
                                key: 'WAITING',
                                label: `Đang chờ (${queueEntries.filter((q) => q.status === 'WAITING').length})`,
                            },
                            {
                                key: 'CALLED',
                                label: `Đã gọi (${queueEntries.filter((q) => q.status === 'CALLED').length})`,
                            },
                            {
                                key: 'DEFERRED',
                                label: `Tạm hoãn (${queueEntries.filter((q) => q.status === 'DEFERRED').length})`,
                            },
                            {
                                key: 'IN_CONSULTATION',
                                label: `Đang khám (${queueEntries.filter((q) => q.status === 'IN_CONSULTATION').length})`,
                            },
                            {
                                key: 'COMPLETED',
                                label: `Hoàn tất (${queueEntries.filter((q) => q.status === 'COMPLETED').length})`,
                            },
                        ]}
                    />

                    <div className="flex items-center gap-2">
                        <Input
                            prefix={<SearchOutlined className="text-slate-400" />}
                            placeholder="Số vé A101, tên BN, SĐT..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-56"
                            allowClear
                        />
                        <Select
                            className="w-40"
                            placeholder="Khoa khám"
                            value={selectedDepartment || undefined}
                            onChange={(val) => setSelectedDepartment(val || '')}
                            allowClear
                            options={departments.map((d) => ({ value: d.id, label: d.name }))}
                        />
                        {selectedRoom && (
                            <Button size="small" onClick={() => setSelectedRoom('')}>
                                Bỏ lọc phòng
                            </Button>
                        )}
                    </div>
                </div>

                {/* Queue Table */}
                <Table
                    columns={columns}
                    dataSource={filteredQueue}
                    rowKey="id"
                    pagination={{ pageSize: 8, showSizeChanger: true }}
                    size="middle"
                    rowClassName={(record) =>
                        record.priority === 'PRIORITY'
                            ? 'bg-purple-50/30'
                            : record.status === 'DEFERRED'
                            ? 'bg-amber-50/20'
                            : ''
                    }
                />
            </div>

            {/* Modal: Actions (Defer, Transfer, Reorder, Cancel) */}
            <QueueActionModal
                open={actionModal.open}
                onClose={() => setActionModal({ open: false, entry: null, mode: 'DEFER' })}
                queueEntry={actionModal.entry}
                mode={actionModal.mode}
            />

            {/* Modal: Timeline History of a Queue Entry */}
            <Modal
                title={
                    <span className="font-bold text-slate-800">
                        Lịch sử chặng & thao tác: Vé {historyModal.entry?.ticketNumber}
                    </span>
                }
                open={historyModal.open}
                onCancel={() => setHistoryModal({ open: false, entry: null })}
                footer={<Button onClick={() => setHistoryModal({ open: false, entry: null })}>Đóng</Button>}
                width={540}
            >
                <div className="py-3 text-xs space-y-4">
                    <h5 className="font-bold text-slate-700 uppercase">Các chặng khám đã qua</h5>
                    <Timeline
                        items={historyModal.entry?.stages?.map((st) => ({
                            color: st.stage === 'CHECK_IN' ? 'blue' : st.stage === 'CALLED' ? 'green' : 'gray',
                            children: (
                                <div>
                                    <span className="font-bold text-slate-800">{st.stage}</span> -{' '}
                                    <span className="text-slate-500">{st.time}</span>
                                    <div className="text-slate-400 text-[11px]">{st.room}</div>
                                </div>
                            ),
                        }))}
                    />

                    <h5 className="font-bold text-slate-700 uppercase pt-2 border-t border-slate-100">
                        Nhật ký thao tác chi tiết
                    </h5>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 font-mono text-[11px] text-slate-600">
                        {historyModal.entry?.logs?.map((l, i) => (
                            <div key={i}>• {l}</div>
                        ))}
                    </div>
                </div>
            </Modal>

            {/* Patient Detail Drawer */}
            <PatientDetailDrawer
                patientId={patientDrawerId}
                open={Boolean(patientDrawerId)}
                onClose={() => setPatientDrawerId(null)}
            />

            {/* Emergency Handover Modal */}
            <EmergencyHandoverModal
                open={isEmergencyModalOpen}
                onClose={() => setIsEmergencyModalOpen(false)}
            />
        </div>
    )
}
