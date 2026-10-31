import { useState, useMemo, useEffect } from 'react'
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
    PrinterOutlined,
    SyncOutlined,
} from '@ant-design/icons'
import {
    callQueueEntryAsync,
    markAbsentAsync,
    resumeQueueEntryAsync,
    fetchFlowBoardAsync,
} from '../../redux/actions/reception/receptionAction'
import QueueActionModal from '../../components/reception/QueueActionModal'
import PatientDetailDrawer from '../../components/reception/PatientDetailDrawer'
import EmergencyHandoverModal from '../../components/reception/EmergencyHandoverModal'
import TvQueueDisplayModal from '../../components/reception/TvQueueDisplayModal'
import CheckInReceiptModal from '../../components/reception/CheckInReceiptModal'
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
    const [isTvQueueOpen, setIsTvQueueOpen] = useState(false)
    const [receiptEntry, setReceiptEntry] = useState(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Đồng bộ hàng đợi thực tế từ Backend khi vào trang
    useEffect(() => {
        dispatch(fetchFlowBoardAsync())
    }, [dispatch])

    const handleRefreshQueue = async () => {
        setIsRefreshing(true)
        try {
            await dispatch(fetchFlowBoardAsync()).unwrap()
            message.success('Đã cập nhật hàng đợi thời gian thực')
        } catch {
            message.info('Đã tải lại dữ liệu hàng đợi')
        } finally {
            setIsRefreshing(false)
        }
    }

    // Hạn ngạch tiếp đón trong ngày (Clinic-Management pattern - Cảnh báo an toàn, không auto-block)
    const maxDailyQuota = 50
    const todayCheckInCount = queueEntries.length
    const quotaPercent = Math.round((todayCheckInCount / maxDailyQuota) * 100)
    const isNearQuota = quotaPercent >= 80 && quotaPercent < 100
    const isOverQuota = quotaPercent >= 100

    // Phân loại Tier ưu tiên có thứ bậc tường minh (Lát cắt C - Tiered Priority Policy)
    // Tier 1: Cấp cứu (tuyệt đối không bị vượt)
    // Tier 2: Đánh giá lâm sàng khẩn cấp
    // Tier 3: Bệnh nhân quay lại sau cận lâm sàng (RETURN_AFTER_RESULT)
    // Tier 4: Đối tượng ưu tiên chính sách (Người già >= 75, Trẻ em < 6, Bầu, Khuyết tật)
    // Tier 5: Khám thông thường (Có hẹn đúng giờ, Walk-in)
    const getQueueTier = (entry) => {
        if (entry.priority === 'EMERGENCY' || entry.muc_do_uu_tien === 1 || entry.isEmergency) return 1
        if (entry.priority === 'URGENT' || entry.muc_do_uu_tien === 2) return 2
        if (entry.status === 'RETURN_AFTER_RESULT' || entry.trang_thai === 'co_ket_qua_cls' || entry.muc_do_uu_tien === 3) return 3
        if (entry.priority === 'PRIORITY' || entry.isSpecialPriority || entry.muc_do_uu_tien === 4) return 4
        return 5
    }

    // Filter queue entries
    const filteredQueue = useMemo(() => {
        return queueEntries.filter((q) => {
            const pat = patients.find((p) => p.id === q.patientId)
            const ticketStr = String(q.ma_so_thu_tu || q.ticketNumber || '')
            const patName = q.patientName || pat?.fullName || ''
            const patPhone = q.phone || pat?.phone || ''
            const matchesQuery =
                !searchQuery ||
                ticketStr.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                patName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                patPhone.includes(searchQuery.trim())

            const matchesRoom = !selectedRoom || q.roomId === selectedRoom || q.phong_kham === selectedRoom
            const matchesDep = !selectedDepartment || q.departmentId === selectedDepartment
            const matchesTab =
                activeTab === 'ALL' ||
                (activeTab === 'WAITING'
                    ? (q.status === 'WAITING' || q.status === 'CHO_KHAM' || q.status === 'cho_kham')
                    : (q.status === activeTab || q.status?.toLowerCase() === activeTab.toLowerCase()))

            return matchesQuery && matchesRoom && matchesDep && matchesTab
        })
    }, [queueEntries, patients, searchQuery, selectedRoom, selectedDepartment, activeTab])

    // Sắp xếp hàng đợi theo Tiered Priority Comparator & arrival_time tie-breaker
    const sortedQueue = useMemo(() => {
        return [...filteredQueue].sort((a, b) => {
            const tierA = getQueueTier(a)
            const tierB = getQueueTier(b)
            if (tierA !== tierB) {
                return tierA - tierB // Tier 1 trước, Tier 5 sau
            }
            // Tie-breaker ổn định: Thời gian đến/check-in
            const timeA = new Date(a.checkInTime || a.thoi_gian_check_in || 0).getTime()
            const timeB = new Date(b.checkInTime || b.thoi_gian_check_in || 0).getTime()
            if (timeA !== timeB) return timeA - timeB
            return (a.ticketNumber || '').localeCompare(b.ticketNumber || '')
        })
    }, [filteredQueue])

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
            title: 'STT & Mã buồng',
            dataIndex: 'ticketNumber',
            key: 'ticketNumber',
            width: 145,
            render: (ticket, record) => {
                const displayTicket = record.ma_so_thu_tu || record.ticketNumber || ticket
                return (
                    <div>
                        <span className="text-base font-black text-sky-700 tracking-tight block font-mono">{displayTicket}</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                            {record.priority === 'EMERGENCY' || record.muc_do_uu_tien === 1 ? (
                                <Tag color="red" className="mr-0 text-[10px] font-bold animate-pulse">
                                    Tier 1 · Cấp cứu
                                </Tag>
                            ) : record.priority === 'URGENT' || record.muc_do_uu_tien === 2 ? (
                                <Tag color="volcano" className="mr-0 text-[10px] font-bold">
                                    Tier 2 · Khẩn
                                </Tag>
                            ) : record.status === 'RETURN_AFTER_RESULT' || record.trang_thai === 'co_ket_qua_cls' || record.muc_do_uu_tien === 3 ? (
                                <Tag color="cyan" className="mr-0 text-[10px] font-bold">
                                    Tier 3 · Sau CLS
                                </Tag>
                            ) : record.priority === 'PRIORITY' || record.muc_do_uu_tien === 4 ? (
                                <Tag color="purple" className="mr-0 text-[10px]">
                                    Tier 4 · Ưu tiên
                                </Tag>
                            ) : (
                                <Tag color={record.isWalkIn ? 'orange' : 'blue'} className="mr-0 text-[10px]">
                                    {record.isWalkIn ? 'Walk-in' : 'Có lịch'}
                                </Tag>
                            )}
                        </div>
                    </div>
                )
            },
        },
        {
            title: 'Bệnh nhân',
            key: 'patient',
            width: 220,
            render: (_, record) => {
                const pat = patients.find((p) => p.id === record.patientId)
                const pName = record.patientName || pat?.fullName || 'Bệnh nhân'
                const pPhone = record.phone || pat?.phone || ''
                const pCode = pat?.patientCode || (record.patientId ? `BN-${record.patientId}` : '')
                return (
                    <div>
                        <button
                            onClick={() => setPatientDrawerId(record.patientId)}
                            className="font-bold text-slate-900 hover:text-sky-600 hover:underline text-left cursor-pointer"
                        >
                            {pName}
                        </button>
                        <div className="text-slate-400 text-xs flex gap-2">
                            <span>{pPhone}</span>
                            {pCode && (
                                <>
                                    <span>•</span>
                                    <span className="font-mono">{pCode}</span>
                                </>
                            )}
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
                        key: 'print',
                        label: 'Xem & In phiếu nhiệt mini (80mm)',
                        icon: <PrinterOutlined />,
                        onClick: () => setReceiptEntry(record),
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

                        {/* Quick Print Button */}
                        <Tooltip title="Xem & In phiếu STT nhiệt mini (80mm)">
                            <Button
                                size="small"
                                icon={<PrinterOutlined />}
                                className="text-xs text-sky-700"
                                onClick={() => setReceiptEntry(record)}
                            />
                        </Tooltip>

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
            {/* Quota Banner (Lát cắt B.4 - Cảnh báo hạn ngạch tiếp đón) */}
            {(isNearQuota || isOverQuota) && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
                    isOverQuota ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                    <AlertOutlined className={`text-base shrink-0 mt-0.5 ${isOverQuota ? 'text-rose-600' : 'text-amber-600'}`} />
                    <div className="flex-1">
                        <div className="font-bold text-sm">
                            {isOverQuota
                                ? `🛑 HẠN NGẠCH TIẾP ĐÓN TRONG NGÀY ĐÃ ĐẠT NGƯỠNG (${todayCheckInCount}/${maxDailyQuota} lượt - ${quotaPercent}%)`
                                : `⚠️ CẢNH BÁO CÔNG SUẤT TIẾP ĐÓN GẦN ĐẦY (${todayCheckInCount}/${maxDailyQuota} lượt - ${quotaPercent}%)`}
                        </div>
                        <div className="mt-1">
                            {isOverQuota ? (
                                <span>
                                    Phòng khám đã tiếp nhận đạt ngưỡng định mức trong ngày. <strong>Nguyên tắc an toàn y tế:</strong> Không tự ý từ chối người bệnh. Trường hợp cấp cứu, chỉ định quay lại sau cận lâm sàng hoặc ca chuyển tuyến vẫn được tiếp nhận theo quy trình lâm sàng.
                                </span>
                            ) : (
                                <span>
                                    Công suất phòng khám hôm nay đang đạt mức {quotaPercent}%. Vui lòng điều phối bệnh nhân vào các phòng khám có tải trọng thấp hơn.
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="w-24 shrink-0 bg-white/80 p-2 rounded-lg border border-slate-200 text-center font-mono font-bold">
                        <div className="text-[10px] uppercase text-slate-500">Tiếp nhận</div>
                        <div className={`text-base ${isOverQuota ? 'text-rose-600' : 'text-amber-600'}`}>{todayCheckInCount}/{maxDailyQuota}</div>
                    </div>
                </div>
            )}

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
                    <Button
                        size="small"
                        icon={<SyncOutlined spin={isRefreshing} />}
                        onClick={handleRefreshQueue}
                        className="font-semibold text-xs ml-2"
                    >
                        Đồng bộ hàng đợi
                    </Button>
                    <Button
                        size="small"
                        type="primary"
                        icon={<SoundOutlined />}
                        onClick={() => setIsTvQueueOpen(true)}
                        className="font-semibold text-xs bg-teal-700 hover:bg-teal-600 ml-2"
                    >
                        📺 Mở Màn Hình TV Gọi Số Phòng Chờ
                    </Button>
                    <Button className="hidden">
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
                    dataSource={sortedQueue}
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
            <TvQueueDisplayModal
                isOpen={isTvQueueOpen}
                onClose={() => setIsTvQueueOpen(false)}
                queueList={queueEntries.map((q) => {
                    const pat = patients.find((p) => p.id === q.patientId)
                    const rm = rooms.find((r) => r.id === q.roomId)
                    return {
                        ...q,
                        queueNumber: q.ticketNumber,
                        patientName: pat?.fullName || 'Bệnh nhân',
                        room: q.roomId,
                        roomName: rm?.name || q.roomId,
                    }
                })}
                rooms={rooms.map((r) => {
                    const doc = doctors.find((d) => d.id === r.doctorId)
                    return { id: r.id, name: r.name, doctor: doc?.fullName || 'Bác sĩ trực phòng' }
                })}
            /><span className="hidden"
            />

            {/* Check-In / Queue Thermal Receipt Modal */}
            <CheckInReceiptModal
                open={Boolean(receiptEntry)}
                onClose={() => setReceiptEntry(null)}
                queueEntry={receiptEntry}
            />
        </div>
    )
}
