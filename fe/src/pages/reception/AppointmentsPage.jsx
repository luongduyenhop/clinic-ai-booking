import { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
    Table,
    Input,
    Select,
    DatePicker,
    Button,
    Tag,
    Space,
    Segmented,
    message,
    Modal,
    Drawer,
    Card,
    Empty,
    Spin,
} from 'antd'
import {
    SearchOutlined,
    PlusOutlined,
    CalendarOutlined,
    TableOutlined,
    CheckCircleOutlined,
    SyncOutlined,
    ThunderboltOutlined,
    ExclamationCircleOutlined,
    CheckOutlined,
    UserDeleteOutlined,
    QrcodeOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import AppointmentFormModal from '../../components/reception/AppointmentFormModal'
import AppointmentDetailModal from '../../components/reception/AppointmentDetailModal'
import CheckInReceiptModal from '../../components/reception/CheckInReceiptModal'
import { APPOINTMENT_STATUS_LABELS } from '../../utils/constants/receptionConstants'
import { formatDoctorName } from '../../utils/doctorHelper'
import {
    fetchAppointmentsAsync,
    fetchReceptionDataAsync,
    checkInAppointmentAsync,
    confirmAppointmentAsync,
    markAppointmentNoShowAsync,
    processUnconfirmedAppointmentsAsync,
    searchAppointmentsAsync,
} from '../../redux/actions/reception/receptionAction'

export default function AppointmentsPage() {
    const dispatch = useDispatch()
    const {
        appointments = [],
        appointmentsPagination = {},
        patients = [],
        departments = [],
        doctors = [],
        rooms = [],
        loading,
    } = useSelector((state) => state.reception)

    const [viewMode, setViewMode] = useState('TABLE') // 'TABLE' | 'SCHEDULE_SLOTS'
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedDate, setSelectedDate] = useState(() => dayjs().format('YYYY-MM-DD'))
    const [selectedShift, setSelectedShift] = useState('') // '' | 'sang' | 'chieu'
    const [selectedDep, setSelectedDep] = useState('')
    const [selectedDoctor, setSelectedDoctor] = useState('')
    const [selectedStatus, setSelectedStatus] = useState('')

    // Pagination
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(15)

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [selectedAppointment, setSelectedAppointment] = useState(null)

    // Check-in & Receipt
    const [checkingInId, setCheckingInId] = useState(null)
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
    const [selectedTicketForPrint, setSelectedTicketForPrint] = useState(null)

    // Action states
    const [confirmingId, setConfirmingId] = useState(null)
    const [isProcessingUnconfirmed, setIsProcessingUnconfirmed] = useState(false)

    // No-Show Modal state
    const [noShowAppointment, setNoShowAppointment] = useState(null)
    const [noShowNote, setNoShowNote] = useState('')
    const [isNoShowLoading, setIsNoShowLoading] = useState(false)

    // Quick Search at Counter Drawer
    const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false)
    const [quickSearchText, setQuickSearchText] = useState('')
    const [quickSearchResults, setQuickSearchResults] = useState([])
    const [isQuickSearching, setIsQuickSearching] = useState(false)

    const loadAppointments = useCallback(() => {
        dispatch(
            fetchAppointmentsAsync({
                queryDate: selectedDate || undefined,
                caKham: selectedShift || undefined,
                specialtyId: selectedDep || undefined,
                doctorId: selectedDoctor || undefined,
                status: selectedStatus || undefined,
                search: searchQuery.trim() || undefined,
                page,
                pageSize,
            })
        )
    }, [dispatch, selectedDate, selectedShift, selectedDep, selectedDoctor, selectedStatus, searchQuery, page, pageSize])

    useEffect(() => {
        dispatch(fetchReceptionDataAsync())
    }, [dispatch])

    useEffect(() => {
        loadAppointments()
    }, [loadAppointments])

    const handleClearFilters = () => {
        setSearchQuery('')
        setSelectedDate(dayjs().format('YYYY-MM-DD'))
        setSelectedShift('')
        setSelectedDep('')
        setSelectedDoctor('')
        setSelectedStatus('')
        setPage(1)
    }

    // ── Xử lý One-Touch Check-In ──────────────────────────────────────
    const handleOneTouchCheckIn = async (record) => {
        try {
            setCheckingInId(record.id)
            const result = await dispatch(
                checkInAppointmentAsync({ appointmentId: record.id })
            ).unwrap()

            const ticket = result?.ticket || result
            const ticketNum = ticket?.ticketNumber || ticket?.ma_so_thu_tu || ticket?.so_thu_tu_kham || 'STT'
            const roomName = ticket?.roomName || record.phong_kham || 'Buồng khám'
            const patName = record.ten_benh_nhan || record.patientName || ticket?.patientName || 'bệnh nhân'

            message.success({
                content: `Đã check-in thành công cho ${patName}! Cấp số #${ticketNum} vào ${roomName}.`,
                duration: 4,
            })

            setSelectedTicketForPrint(ticket)
            setIsReceiptModalOpen(true)
            loadAppointments()
        } catch {
            // Toast thông báo lỗi bên phải đã được BaseService kích hoạt tự động
        } finally {
            setCheckingInId(null)
        }
    }

    // ── Xử lý Xác nhận lịch hẹn (Confirm) ──────────────────────────────
    const handleConfirmAppointment = async (record) => {
        try {
            setConfirmingId(record.id)
            await dispatch(confirmAppointmentAsync({ appointmentId: record.id })).unwrap()
            message.success(`Đã xác nhận giữ chỗ cho lịch hẹn ${record.appointmentCode || record.ma_lich_kham}!`)
            loadAppointments()
        } catch {
            // Toast thông báo lỗi bên phải đã được BaseService kích hoạt tự động
        } finally {
            setConfirmingId(null)
        }
    }

    // ── Xử lý Ghi nhận Vắng mặt (No-Show) ─────────────────────────────
    const handleConfirmNoShow = async () => {
        if (!noShowAppointment) return
        try {
            setIsNoShowLoading(true)
            const result = await dispatch(
                markAppointmentNoShowAsync({
                    appointmentId: noShowAppointment.id,
                    ghiChu: noShowNote.trim() || 'Người bệnh không đến khám hết ca trực',
                })
            ).unwrap()

            if (result?.da_khoa_tai_khoan) {
                Modal.warning({
                    title: 'Cảnh báo vi phạm No-show!',
                    content: result?.canh_bao || 'Người bệnh đã vi phạm No-show 3 lần. Hệ thống đã tự động khóa quyền tự đặt lịch trực tuyến!',
                })
            } else {
                message.warning('Đã ghi nhận người bệnh vắng mặt (No-show)')
            }

            setNoShowAppointment(null)
            setNoShowNote('')
            loadAppointments()
        } catch {
            // Toast thông báo lỗi bên phải đã được BaseService kích hoạt tự động
        } finally {
            setIsNoShowLoading(false)
        }
    }

    // ── Xử lý Quét tự động hủy & Đôn Waitlist ─────────────────────────
    const handleProcessUnconfirmed = () => {
        Modal.confirm({
            title: 'Quét tự động hủy ca chưa xác nhận & Đôn Waitlist?',
            icon: <ExclamationCircleOutlined className="text-amber-500" />,
            content: (
                <div className="text-xs text-slate-600 space-y-1.5 mt-2">
                    <p>
                        Hệ thống sẽ quét các lịch hẹn ở trạng thái <strong>Chờ xác nhận</strong> cách giờ khám <strong>dưới 02 tiếng</strong> mà người bệnh chưa phản hồi.
                    </p>
                    <p>
                        Các lịch này sẽ chuyển sang trạng thái <strong>Tự động hủy</strong>, đồng thời hệ thống tự động thông báo giữ slot khám 30 phút cho người đứng đầu <strong>Danh sách chờ (Waitlist)</strong>.
                    </p>
                </div>
            ),
            okText: '⚡ Kích hoạt quét tự động',
            cancelText: 'Bỏ qua',
            okButtonProps: { className: 'bg-amber-600 hover:bg-amber-700 font-bold' },
            onOk: async () => {
                setIsProcessingUnconfirmed(true)
                try {
                    const result = await dispatch(processUnconfirmedAppointmentsAsync({ hoursThreshold: 2.0 })).unwrap()
                    message.success(`Hoàn tất: Đã hủy ${result?.so_lich_tu_dong_huy ?? 0} ca chưa xác nhận, đôn ${result?.so_nguoi_don_waitlist ?? 0} người từ Waitlist!`)
                    loadAppointments()
                } catch {
                    // Toast thông báo lỗi bên phải đã được BaseService kích hoạt tự động
                } finally {
                    setIsProcessingUnconfirmed(false)
                }
            },
        })
    }

    // ── Xử lý Tra cứu nhanh tại quầy (Quick Search) ───────────────────
    const handleQuickSearch = async () => {
        if (!quickSearchText.trim()) {
            message.info('Vui lòng nhập Mã hẹn, SĐT hoặc Tên bệnh nhân')
            return
        }
        setIsQuickSearching(true)
        try {
            const results = await dispatch(
                searchAppointmentsAsync({
                    q: quickSearchText.trim(),
                    queryDate: selectedDate || undefined,
                })
            ).unwrap()
            setQuickSearchResults(Array.isArray(results) ? results : [])
        } catch {
            // Toast thông báo lỗi bên phải đã được BaseService kích hoạt tự động
        } finally {
            setIsQuickSearching(false)
        }
    }

    // ── Columns Table ────────────────────────────────────────────────
    const columns = [
        {
            title: 'Mã lịch hẹn',
            dataIndex: 'appointmentCode',
            key: 'appointmentCode',
            width: 175,
            render: (code, record) => {
                const displayCode = code || record.ma_lich_kham || `APT-${record.id}`
                return (
                    <div>
                        <span className="font-mono font-bold text-sky-700 block text-xs">{displayCode}</span>
                    </div>
                )
            },
        },
        {
            title: 'Bệnh nhân',
            key: 'patient',
            width: 210,
            render: (_, record) => {
                const pat = patients.find((p) => p.id === (record.patientId || record.benh_nhan_id))
                const fullName = record.ten_benh_nhan || pat?.fullName || 'N/A'
                const phone = record.so_dien_thoai || pat?.phone || ''
                const code = pat?.patientCode || (record.benh_nhan_id ? `BN-${record.benh_nhan_id}` : '')
                return (
                    <div>
                        <div className="font-bold text-slate-900 text-xs">{fullName}</div>
                        <div className="text-slate-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                            <span>{phone}</span>
                            {code && (
                                <>
                                    <span>•</span>
                                    <span className="font-mono text-slate-500">{code}</span>
                                </>
                            )}
                        </div>
                    </div>
                )
            },
        },
        {
            title: 'Khung giờ khám',
            dataIndex: 'timeSlot',
            key: 'timeSlot',
            width: 145,
            render: (slot, record) => {
                const timeStr = slot || record.gio_kham || 'Theo ca'
                const dateStr = record.appointmentDate || record.ngay_kham || selectedDate
                const shiftLabel = record.ca_kham === 'sang' ? 'Ca sáng' : (record.ca_kham === 'chieu' ? 'Ca chiều' : '')
                return (
                    <div>
                        <span className="font-semibold text-slate-800 block text-xs">{timeStr}</span>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            <span>{dateStr}</span>
                            {shiftLabel && <span className="text-sky-600 font-medium">({shiftLabel})</span>}
                        </div>
                    </div>
                )
            },
        },
        {
            title: 'Chuyên khoa & Bác sĩ',
            key: 'specialty',
            render: (_, record) => {
                const dep = departments.find((d) => d.id === (record.departmentId || record.chuyen_khoa_id))
                const doc = doctors.find((d) => d.id === (record.doctorId || record.bac_si_id))
                const room = rooms.find((r) => r.id === record.roomId)
                const depName = record.ten_chuyen_khoa || dep?.name || 'Khám chuyên khoa'
                const rawDocName = record.ten_bac_si || doc?.name || ''
                const docName = rawDocName ? formatDoctorName(rawDocName) : 'Theo phân bổ'
                const roomName = record.phong_kham || room?.name || ''
                return (
                    <div className="text-xs">
                        <span className="font-semibold text-slate-800 block">{depName}</span>
                        <span className="text-slate-500 text-[11px]">
                            {docName} {roomName && `(${roomName})`}
                        </span>
                    </div>
                )
            },
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 175,
            render: (status, record) => {
                const rawSt = String(status || record.trang_thai_lich || '').toLowerCase()
                let cfg = APPOINTMENT_STATUS_LABELS[rawSt] || APPOINTMENT_STATUS_LABELS[rawSt.toUpperCase()] || { label: status || 'Chờ khám', color: 'default' }

                if (rawSt === 'da_dat' || rawSt === 'booked' || rawSt === 'da_xac_nhan' || rawSt === 'confirmed') {
                    cfg = { label: 'Đã xác nhận', color: 'blue' }
                } else if (rawSt === 'da_tiep_nhan' || rawSt === 'da_den' || rawSt === 'checked_in') {
                    cfg = { label: 'Đã tiếp nhận', color: 'green' }
                } else if (rawSt === 'cho_xac_nhan') {
                    cfg = { label: 'Chờ xác nhận', color: 'gold' }
                } else if (rawSt === 'vang_mat') {
                    cfg = { label: 'Vắng mặt', color: 'default' }
                } else if (rawSt === 'da_huy') {
                    cfg = { label: 'Đã hủy', color: 'red' }
                }

                const queueStatusMap = {
                    cho_kham: { label: 'Chờ khám', color: 'cyan' },
                    dang_kham: { label: 'Đang khám', color: 'processing' },
                    tam_hoan: { label: 'Tạm hoãn', color: 'gold' },
                    da_dong_ve: { label: 'Đã đóng vé', color: 'purple' },
                    hoan_thanh: { label: 'Đã khám', color: 'purple' },
                    da_huy: { label: 'Hủy hàng đợi', color: 'default' },
                }
                const rawQueueSt = String(record.trang_thai_hang_doi || '').toLowerCase()
                const queueCfg = queueStatusMap[rawQueueSt]

                return (
                    <Space direction="vertical" size={2}>
                        <Tag color={cfg.color} className="font-semibold text-xs">
                            {cfg.label}
                        </Tag>
                        {queueCfg && (
                            <Tag color={queueCfg.color} className="text-[11px] font-medium m-0">
                                Hàng đợi: {queueCfg.label}
                            </Tag>
                        )}
                        {record.so_thu_tu_kham && (
                            <span className="text-[11px] font-mono font-bold text-emerald-700">
                                STT: #{record.so_thu_tu_kham}
                            </span>
                        )}
                    </Space>
                )
            },
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 220,
            align: 'right',
            render: (_, record) => {
                const rawSt = String(record.status || record.trang_thai_lich || '').toLowerCase()
                const isPendingConfirm = rawSt === 'cho_xac_nhan'
                const isConfirmed = rawSt === 'da_dat' || rawSt === 'booked' || rawSt === 'confirmed' || rawSt === 'da_xac_nhan'

                return (
                    <Space size="small">
                        {/* Nhánh 1: Chờ xác nhận -> Lễ tân gọi & Xác nhận giữ chỗ */}
                        {isPendingConfirm && (
                            <Button
                                size="small"
                                type="primary"
                                icon={<CheckOutlined />}
                                loading={confirmingId === record.id}
                                className="bg-sky-600 hover:bg-sky-700 text-xs font-semibold"
                                onClick={() => handleConfirmAppointment(record)}
                            >
                                Xác nhận
                            </Button>
                        )}

                        {/* Nhánh 2: Đã xác nhận -> Check-in 1 chạm hoặc Báo No-show */}
                        {isConfirmed && (
                            <>
                                <Button
                                    size="small"
                                    type="primary"
                                    icon={<CheckCircleOutlined />}
                                    loading={checkingInId === record.id}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold shadow-xs"
                                    onClick={() => handleOneTouchCheckIn(record)}
                                >
                                    Check-in
                                </Button>
                                <Button
                                    size="small"
                                    icon={<UserDeleteOutlined />}
                                    className="text-amber-700 border-amber-300 hover:bg-amber-50 text-xs"
                                    onClick={() => setNoShowAppointment(record)}
                                >
                                    No-show
                                </Button>
                            </>
                        )}

                        {/* Nút Xem chi tiết */}
                        <Button
                            size="small"
                            onClick={() => setSelectedAppointment(record)}
                            className="text-xs"
                        >
                            Chi tiết
                        </Button>
                    </Space>
                )
            },
        },
    ]

    return (
        <div className="space-y-5">
            {/* ── HEADER CARD VÀ THANH CÔNG CỤ ────────────────────────────── */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-slate-800">Quản lý Lịch hẹn Tiếp đón</h2>
                            <Tag color="cyan" className="font-semibold">Phân hệ Lễ tân</Tag>
                        </div>
                        <span className="text-xs text-slate-500">
                            Quản lý vòng đời lịch khám → Tra cứu nhanh tại quầy, Xác nhận trước 24h, Check-in cấp STT và Xử lý vắng mặt (No-show).
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            icon={<SearchOutlined className="text-sky-600" />}
                            onClick={() => setIsQuickSearchOpen(true)}
                            className="text-xs font-semibold text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100"
                        >
                            Tra cứu nhanh tại quầy
                        </Button>
                        <Button
                            icon={<ThunderboltOutlined className="text-amber-500" />}
                            onClick={handleProcessUnconfirmed}
                            loading={isProcessingUnconfirmed}
                            className="text-xs font-semibold text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100"
                        >
                            Quét hủy chưa xác nhận & Đôn Waitlist
                        </Button>
                        <Button
                            icon={<SyncOutlined spin={loading} />}
                            onClick={loadAppointments}
                            className="text-xs"
                        >
                            Làm mới
                        </Button>
                        <Segmented
                            value={viewMode}
                            onChange={setViewMode}
                            options={[
                                { label: 'Bảng dữ liệu', value: 'TABLE', icon: <TableOutlined /> },
                                { label: 'Khung giờ khám', value: 'SCHEDULE_SLOTS', icon: <CalendarOutlined /> },
                            ]}
                        />
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-sky-600 font-semibold"
                        >
                            Đặt lịch mới
                        </Button>
                    </div>
                </div>

                {/* ── BỘ LỌC ĐA CHIỀU ────────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100 text-xs">
                    <div>
                        <Input
                            prefix={<SearchOutlined className="text-slate-400" />}
                            placeholder="Mã hẹn, tên BN, SĐT..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onPressEnter={() => {
                                setPage(1)
                                loadAppointments()
                            }}
                            allowClear
                        />
                    </div>
                    <div>
                        <DatePicker
                            className="w-full"
                            format="DD/MM/YYYY"
                            value={selectedDate ? dayjs(selectedDate) : null}
                            onChange={(date) => {
                                setSelectedDate(date ? date.format('YYYY-MM-DD') : '')
                                setPage(1)
                            }}
                            placeholder="Chọn ngày khám"
                        />
                    </div>
                    <div>
                        <Select
                            className="w-full"
                            placeholder="Tất cả ca khám"
                            value={selectedShift || undefined}
                            onChange={(val) => {
                                setSelectedShift(val || '')
                                setPage(1)
                            }}
                            allowClear
                            options={[
                                { value: 'sang', label: 'Ca sáng (07:30 - 11:30)' },
                                { value: 'chieu', label: 'Ca chiều (13:30 - 17:00)' },
                            ]}
                        />
                    </div>
                    <div>
                        <Select
                            className="w-full"
                            placeholder="Tất cả chuyên khoa"
                            value={selectedDep || undefined}
                            onChange={(val) => {
                                setSelectedDep(val || '')
                                setPage(1)
                            }}
                            allowClear
                            options={departments.map((d) => ({ value: d.id, label: d.name }))}
                        />
                    </div>
                    <div>
                        <Select
                            className="w-full"
                            placeholder="Tất cả bác sĩ"
                            value={selectedDoctor || undefined}
                            onChange={(val) => {
                                setSelectedDoctor(val || '')
                                setPage(1)
                            }}
                            allowClear
                            options={doctors.map((d) => ({ value: d.id, label: d.name }))}
                        />
                    </div>
                    <div>
                        <Select
                            className="w-full"
                            placeholder="Trạng thái lịch"
                            value={selectedStatus || undefined}
                            onChange={(val) => {
                                setSelectedStatus(val || '')
                                setPage(1)
                            }}
                            allowClear
                            options={[
                                { value: 'cho_xac_nhan', label: 'Chờ xác nhận' },
                                { value: 'da_xac_nhan', label: 'Đã xác nhận' },
                                { value: 'da_tiep_nhan', label: 'Đã tiếp nhận (Check-in)' },
                                { value: 'da_kham', label: 'Đã khám xong' },
                                { value: 'vang_mat', label: 'Vắng mặt (No-Show)' },
                                { value: 'da_huy', label: 'Đã hủy' },
                            ]}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>
                        Tổng số: <strong>{appointmentsPagination?.totalItems ?? appointments.length}</strong> lịch hẹn
                        {selectedDate && <span className="ml-1 text-slate-400">(Ngày: {dayjs(selectedDate).format('DD/MM/YYYY')})</span>}
                    </span>
                    {(searchQuery || selectedShift || selectedDep || selectedDoctor || selectedStatus || selectedDate !== dayjs().format('YYYY-MM-DD')) && (
                        <button
                            onClick={handleClearFilters}
                            className="text-sky-600 hover:underline font-semibold cursor-pointer"
                        >
                            Đặt lại bộ lọc về hôm nay
                        </button>
                    )}
                </div>
            </div>

            {/* ── VIEW BẢNG DỮ LIỆU HOẶC KHUNG GIỜ KHÁM ───────────────────── */}
            {viewMode === 'TABLE' ? (
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    <Table
                        columns={columns}
                        dataSource={appointments}
                        rowKey={(r) => r.id || r.ma_lich_kham}
                        pagination={{
                            current: appointmentsPagination?.page || page,
                            pageSize: appointmentsPagination?.pageSize || pageSize,
                            total: appointmentsPagination?.totalItems || appointments.length,
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '15', '20', '50'],
                            onChange: (p, s) => {
                                setPage(p)
                                setPageSize(s)
                            },
                        }}
                        size="middle"
                        loading={loading}
                        rowClassName={() => 'hover:bg-sky-50/30 transition-colors'}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {['07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '13:30', '14:00', '14:30', '15:00', '15:30'].map(
                        (slotPrefix) => {
                            const appsInSlot = appointments.filter((a) => {
                                const timeStr = a.timeSlot || a.gio_kham || ''
                                return timeStr.startsWith(slotPrefix)
                            })
                            return (
                                <div key={slotPrefix} className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <span className="font-bold text-sky-800 text-xs flex items-center gap-1.5">
                                            <CalendarOutlined /> Khung giờ: {slotPrefix}
                                        </span>
                                        <Tag color={appsInSlot.length > 2 ? 'red' : 'blue'} className="mr-0 text-[10px]">
                                            {appsInSlot.length} lịch
                                        </Tag>
                                    </div>

                                    <div className="space-y-2">
                                        {appsInSlot.length === 0 ? (
                                            <div className="text-center py-4 text-slate-300 text-xs italic">
                                                Khung giờ còn trống
                                            </div>
                                        ) : (
                                            appsInSlot.map((app) => {
                                                const pat = patients.find((p) => p.id === (app.patientId || app.benh_nhan_id))
                                                const doc = doctors.find((d) => d.id === (app.doctorId || app.bac_si_id))
                                                const rawSt = String(app.status || app.trang_thai_lich || '').toLowerCase()
                                                const isArrived = rawSt === 'da_den' || rawSt === 'da_tiep_nhan' || rawSt === 'checked_in'
                                                const canCheckIn = rawSt === 'da_dat' || rawSt === 'da_xac_nhan' || rawSt === 'booked'
                                                const patName = app.ten_benh_nhan || pat?.fullName || 'Bệnh nhân'

                                                return (
                                                    <div
                                                        key={app.id}
                                                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200/70 text-xs space-y-1.5 transition"
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-bold text-slate-900">{patName}</span>
                                                            <Tag color={isArrived ? 'green' : 'blue'} className="mr-0 text-[10px]">
                                                                {isArrived ? 'Đã đến' : 'Đã xác nhận'}
                                                            </Tag>
                                                        </div>
                                                        <div className="text-[11px] text-slate-500">
                                                            {formatDoctorName(app.ten_bac_si || doc?.name) || 'Theo phân bổ ca'}
                                                        </div>
                                                        {canCheckIn && (
                                                            <Button
                                                                size="small"
                                                                type="primary"
                                                                icon={<CheckCircleOutlined />}
                                                                loading={checkingInId === app.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleOneTouchCheckIn(app)
                                                                }}
                                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-[11px] font-semibold"
                                                            >
                                                                Check-in 1 chạm
                                                            </Button>
                                                        )}
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            )
                        }
                    )}
                </div>
            )}

            {/* ── MODAL GHI NHẬN VẮNG MẶT (NO-SHOW) ────────────────────────── */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-amber-700 font-bold">
                        <UserDeleteOutlined />
                        <span>Ghi nhận người bệnh Vắng mặt (No-Show)</span>
                    </div>
                }
                open={Boolean(noShowAppointment)}
                onCancel={() => {
                    setNoShowAppointment(null)
                    setNoShowNote('')
                }}
                footer={[
                    <Button key="back" onClick={() => setNoShowAppointment(null)}>
                        Bỏ qua
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        className="bg-amber-600 hover:bg-amber-700 font-semibold text-white"
                        loading={isNoShowLoading}
                        onClick={handleConfirmNoShow}
                    >
                        Xác nhận vi phạm No-Show
                    </Button>,
                ]}
            >
                {noShowAppointment && (
                    <div className="space-y-3 py-2 text-xs">
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                            <p>
                                <strong>Lịch khám:</strong> {noShowAppointment.ma_lich_kham || `APT-${noShowAppointment.id}`} - {noShowAppointment.gio_kham} ngày {noShowAppointment.ngay_kham}
                            </p>
                            <p>
                                <strong>Bệnh nhân:</strong> {noShowAppointment.ten_benh_nhan} (SĐT: {noShowAppointment.so_dien_thoai || 'N/A'})
                            </p>
                            <p className="text-[11px] text-amber-700 mt-1">
                                * Lưu ý: Người bệnh vi phạm No-show ≥ 3 lần sẽ bị hệ thống tự động khóa quyền đặt lịch khám trực tuyến.
                            </p>
                        </div>
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1">Ghi chú xác minh từ Lễ tân / Bác sĩ:</label>
                            <Input.TextArea
                                rows={3}
                                placeholder="Ví dụ: Đã gọi điện 3 lần người bệnh không nhấc máy, ca trực đã kết thúc..."
                                value={noShowNote}
                                onChange={(e) => setNoShowNote(e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── DRAWER TRA CỨU NHANH TẠI QUẦY (QUICK SEARCH) ─────────────── */}
            <Drawer
                title={
                    <div className="flex items-center gap-2">
                        <QrcodeOutlined className="text-sky-600" />
                        <span className="font-bold text-slate-800">Tra cứu nhanh Lịch hẹn tại Quầy tiếp đón</span>
                    </div>
                }
                placement="right"
                width={520}
                open={isQuickSearchOpen}
                onClose={() => setIsQuickSearchOpen(false)}
            >
                <div className="space-y-4 text-xs">
                    <p className="text-slate-500">
                        Nhập Mã lịch hẹn (APT-...), Số điện thoại hoặc Họ tên người bệnh để tra cứu tức thì thông tin đăng ký khám trong ngày.
                    </p>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Gõ mã APT, SĐT, hoặc Tên bệnh nhân..."
                            value={quickSearchText}
                            onChange={(e) => setQuickSearchText(e.target.value)}
                            onPressEnter={handleQuickSearch}
                            allowClear
                        />
                        <Button
                            type="primary"
                            icon={<SearchOutlined />}
                            onClick={handleQuickSearch}
                            loading={isQuickSearching}
                            className="bg-sky-600 font-semibold"
                        >
                            Tra cứu
                        </Button>
                    </div>

                    <div className="pt-2">
                        {isQuickSearching ? (
                            <div className="text-center py-8">
                                <Spin />
                                <p className="text-slate-400 mt-2">Đang tìm kiếm lịch hẹn...</p>
                            </div>
                        ) : quickSearchResults.length === 0 ? (
                            <Empty description="Chưa có kết quả tra cứu phù hợp" className="py-8" />
                        ) : (
                            <div className="space-y-3">
                                {quickSearchResults.map((item) => {
                                    const rawStatus = String(item.trang_thai_lich || item.trang_thai || '').toLowerCase()
                                    const isAlreadyQueued =
                                        Boolean(item.ticket_id) ||
                                        Boolean(item.so_thu_tu_kham) ||
                                        item.is_checked_in === true ||
                                        ['da_tiep_nhan', 'checked_in', 'da_den', 'dang_kham', 'da_kham'].includes(rawStatus) ||
                                        Boolean(item.trang_thai_hang_doi)
                                    const canCheckIn = !isAlreadyQueued && rawStatus !== 'da_huy' && rawStatus !== 'vang_mat'

                                    let badgeLabel = item.trang_thai || 'Đã xác nhận'
                                    let badgeColor = 'blue'
                                    if (isAlreadyQueued) {
                                        badgeLabel = 'Đã tiếp nhận'
                                        badgeColor = 'green'
                                    } else if (rawStatus === 'da_huy') {
                                        badgeLabel = 'Đã hủy'
                                        badgeColor = 'red'
                                    } else if (rawStatus === 'vang_mat') {
                                        badgeLabel = 'Vắng mặt'
                                        badgeColor = 'default'
                                    }

                                    return (
                                        <Card key={item.lich_kham_id || item.id} size="small" className="border-sky-100 shadow-2xs hover:border-sky-300 transition">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="font-mono font-bold text-sky-700 text-xs block">
                                                        {item.ma_lich_kham}
                                                    </span>
                                                    <div className="font-bold text-slate-900 mt-0.5">{item.ten_benh_nhan}</div>
                                                    <div className="text-slate-500 text-[11px]">SĐT: {item.so_dien_thoai}</div>
                                                </div>
                                                <Tag color={badgeColor} className="mr-0 font-semibold">
                                                    {badgeLabel}
                                                </Tag>
                                            </div>

                                            <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1 text-slate-600 text-[11px]">
                                                <div><strong>Chuyên khoa:</strong> {item.ten_chuyen_khoa}</div>
                                                <div><strong>Bác sĩ:</strong> {item.ten_bac_si}</div>
                                                <div><strong>Phòng khám:</strong> {item.phong_kham || 'Theo điều phối'}</div>
                                                <div><strong>Giờ khám:</strong> <span className="font-bold text-sky-800">{item.gio_kham}</span> ({item.ngay_kham})</div>
                                            </div>

                                            {isAlreadyQueued ? (
                                                <div className="mt-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] font-semibold flex items-center justify-between">
                                                    <span>✓ Đã tiếp nhận vào hàng đợi</span>
                                                    {item.so_thu_tu_kham && (
                                                        <span className="font-mono bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px]">
                                                            STT: #{item.so_thu_tu_kham}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : canCheckIn ? (
                                                <Button
                                                    type="primary"
                                                    size="small"
                                                    icon={<CheckCircleOutlined />}
                                                    loading={checkingInId === (item.lich_kham_id || item.id)}
                                                    onClick={() => handleOneTouchCheckIn({ ...item, id: item.lich_kham_id || item.id })}
                                                    className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 font-semibold"
                                                >
                                                    Xác nhận Check-in ngay (Cấp STT)
                                                </Button>
                                            ) : null}
                                        </Card>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </Drawer>

            {/* ── MODALS CHI TIẾT & TIẾP ĐÓN ───────────────────────────────── */}
            <AppointmentFormModal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
            <AppointmentDetailModal
                appointment={selectedAppointment}
                open={Boolean(selectedAppointment)}
                onClose={() => {
                    setSelectedAppointment(null)
                    loadAppointments()
                }}
                onCheckInClick={(app) => {
                    handleOneTouchCheckIn(app)
                }}
            />
            <CheckInReceiptModal
                open={isReceiptModalOpen}
                onClose={() => setIsReceiptModalOpen(false)}
                queueEntry={selectedTicketForPrint}
            />
        </div>
    )
}
