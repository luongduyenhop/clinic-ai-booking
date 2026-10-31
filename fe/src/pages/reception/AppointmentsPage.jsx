import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Table, Input, Select, DatePicker, Button, Tag, Space, Segmented, message } from 'antd'
import {
    SearchOutlined,
    PlusOutlined,
    CalendarOutlined,
    TableOutlined,
    CheckCircleOutlined,
    SyncOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import AppointmentFormModal from '../../components/reception/AppointmentFormModal'
import AppointmentDetailModal from '../../components/reception/AppointmentDetailModal'
import CheckInReceiptModal from '../../components/reception/CheckInReceiptModal'
import { APPOINTMENT_STATUS_LABELS } from '../../utils/constants/receptionConstants'
import { fetchAppointmentsAsync, checkInAppointmentAsync } from '../../redux/actions/reception/receptionAction'

export default function AppointmentsPage() {
    const dispatch = useDispatch()
    const { appointments = [], patients = [], departments = [], doctors = [], rooms = [], loading } = useSelector((state) => state.reception)

    const [viewMode, setViewMode] = useState('TABLE') // 'TABLE' | 'SCHEDULE_SLOTS'
    const [searchQuery, setSearchQuery] = useState('')
    // Mặc định lọc lịch khám của ngày hôm nay theo nghiệp vụ ca trực
    const [selectedDate, setSelectedDate] = useState(() => dayjs().format('YYYY-MM-DD'))
    const [selectedDep, setSelectedDep] = useState('')
    const [selectedDoctor, setSelectedDoctor] = useState('')
    const [selectedStatus, setSelectedStatus] = useState('')

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [selectedAppointment, setSelectedAppointment] = useState(null)

    // State phục vụ 1 chạm Check-in & In phiếu nhiệt mini
    const [checkingInId, setCheckingInId] = useState(null)
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
    const [selectedTicketForPrint, setSelectedTicketForPrint] = useState(null)

    // Gọi API Backend lấy danh sách lịch hẹn
    const loadAppointments = useCallback(() => {
        dispatch(
            fetchAppointmentsAsync({
                queryDate: selectedDate || undefined,
                specialtyId: selectedDep || undefined,
                doctorId: selectedDoctor || undefined,
                status: selectedStatus || undefined,
                search: searchQuery || undefined,
                page: 1,
                pageSize: 50,
            })
        )
    }, [dispatch, selectedDate, selectedDep, selectedDoctor, selectedStatus, searchQuery])

    useEffect(() => {
        loadAppointments()
    }, [loadAppointments])

    // Filter appointments (hỗ trợ cả dữ liệu backend lẫn client-side lookup)
    const filteredAppointments = useMemo(() => {
        return appointments.filter((app) => {
            const pat = patients.find((p) => p.id === (app.patientId || app.benh_nhan_id))
            const aptCode = app.appointmentCode || app.ma_lich_kham || `APT-${app.id}`
            const patName = app.ten_benh_nhan || pat?.fullName || ''
            const patPhone = app.so_dien_thoai || pat?.phone || ''

            const q = searchQuery.toLowerCase().trim()
            const matchesQuery =
                !q ||
                aptCode.toLowerCase().includes(q) ||
                patName.toLowerCase().includes(q) ||
                patPhone.includes(q)

            const appDate = app.appointmentDate || app.ngay_kham
            const matchesDate = !selectedDate || appDate === selectedDate
            const appDep = app.departmentId || app.chuyen_khoa_id
            const matchesDep = !selectedDep || appDep === selectedDep || String(appDep) === String(selectedDep)
            const appDoc = app.doctorId || app.bac_si_id
            const matchesDoctor = !selectedDoctor || appDoc === selectedDoctor || String(appDoc) === String(selectedDoctor)

            const rawSt = String(app.status || app.trang_thai_lich || '').toUpperCase()
            const matchesStatus = !selectedStatus || rawSt === selectedStatus.toUpperCase()

            return matchesQuery && matchesDate && matchesDep && matchesDoctor && matchesStatus
        })
    }, [appointments, patients, searchQuery, selectedDate, selectedDep, selectedDoctor, selectedStatus])

    const handleClearFilters = () => {
        setSearchQuery('')
        setSelectedDate(dayjs().format('YYYY-MM-DD'))
        setSelectedDep('')
        setSelectedDoctor('')
        setSelectedStatus('')
    }

    // ── Xử lý 1 chạm: Xác nhận check-in ngay tại dòng lịch hẹn ───────────────────
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

            // Tự động mở Modal in phiếu nhiệt mini K80 kèm nút bấm in ra
            setSelectedTicketForPrint(ticket)
            setIsReceiptModalOpen(true)
        } catch (err) {
            message.error(typeof err === 'string' ? err : 'Không thể thực hiện check-in ca đặt trước')
        } finally {
            setCheckingInId(null)
        }
    }

    const columns = [
        {
            title: 'Mã lịch hẹn',
            dataIndex: 'appointmentCode',
            key: 'appointmentCode',
            width: 170,
            render: (code, record) => {
                const displayCode = code || record.ma_lich_kham || `APT-${record.id}`
                return (
                    <div>
                        <span className="font-mono font-bold text-sky-700 block">{displayCode}</span>
                        <span className="text-[11px] text-slate-400">Kênh: {record.type || 'Cổng Bệnh nhân (An)'}</span>
                    </div>
                )
            },
        },
        {
            title: 'Bệnh nhân',
            key: 'patient',
            width: 220,
            render: (_, record) => {
                const pat = patients.find((p) => p.id === (record.patientId || record.benh_nhan_id))
                const fullName = record.ten_benh_nhan || pat?.fullName || 'N/A'
                const phone = record.so_dien_thoai || pat?.phone || ''
                const code = pat?.patientCode || (record.benh_nhan_id ? `BN-${record.benh_nhan_id}` : '')
                return (
                    <div>
                        <div className="font-bold text-slate-900">{fullName}</div>
                        <div className="text-slate-400 text-xs flex gap-2">
                            <span>{phone}</span>
                            {code && (
                                <>
                                    <span>•</span>
                                    <span className="font-mono">{code}</span>
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
            width: 150,
            render: (slot, record) => {
                const timeStr = slot || record.gio_kham || 'Theo ca'
                const dateStr = record.appointmentDate || record.ngay_kham || selectedDate
                return (
                    <div>
                        <span className="font-semibold text-slate-800 block text-xs">{timeStr}</span>
                        <span className="text-[11px] text-slate-400">{dateStr}</span>
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
                const docName = record.ten_bac_si || doc?.name || 'Theo phân bổ'
                const roomName = record.phong_kham || room?.name || ''
                return (
                    <div className="text-xs">
                        <span className="font-semibold text-slate-800 block">{depName}</span>
                        <span className="text-slate-500">
                            BS: {docName} {roomName && `(${roomName})`}
                        </span>
                    </div>
                )
            },
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 140,
            render: (status, record) => {
                const rawSt = String(status || record.trang_thai_lich || '').toLowerCase()
                let cfg = APPOINTMENT_STATUS_LABELS[rawSt] || APPOINTMENT_STATUS_LABELS[rawSt.toUpperCase()] || { label: status || 'Chờ khám', color: 'default' }

                if (rawSt === 'da_xac_nhan' || rawSt === 'da_dat' || rawSt === 'booked' || rawSt === 'confirmed') {
                    cfg = { label: 'Đã đặt', color: 'blue' }
                } else if (rawSt === 'da_tiep_nhan' || rawSt === 'da_den' || rawSt === 'checked_in') {
                    cfg = { label: 'Đã đến', color: 'green' }
                }

                return (
                    <Space direction="vertical" size={2}>
                        <Tag color={cfg.color} className="font-semibold text-xs">
                            {cfg.label}
                        </Tag>
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
            width: 240,
            align: 'right',
            render: (_, record) => {
                const rawSt = String(record.status || record.trang_thai_lich || '').toLowerCase()
                const canCheckIn =
                    rawSt === 'da_dat' ||
                    rawSt === 'booked' ||
                    rawSt === 'confirmed' ||
                    rawSt === 'da_xac_nhan' ||
                    rawSt === 'cho_xac_nhan'
                const isCheckedIn = rawSt === 'da_den' || rawSt === 'checked_in' || rawSt === 'da_tiep_nhan'

                return (
                    <Space size="small">
                        {canCheckIn && (
                            <Button
                                size="small"
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                loading={checkingInId === record.id}
                                className="bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold shadow-xs"
                                onClick={() => handleOneTouchCheckIn(record)}
                            >
                                Xác nhận check-in
                            </Button>
                        )}
                        {isCheckedIn && (
                            <Tag color="green" className="text-xs font-medium">
                                Đã vào hàng đợi
                            </Tag>
                        )}
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
            {/* Top Header & Search bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-slate-800">Danh sách lịch hẹn đặt trước</h2>
                            <Tag color="cyan" className="font-semibold">Cổng Bệnh nhân (An)</Tag>
                        </div>
                        <span className="text-xs text-slate-500">
                            Tiếp nhận ca đặt lịch trong ngày $\rightarrow$ Bấm 1 chạm <strong>"Xác nhận check-in"</strong> để cấp STT ưu tiên theo khung giờ và đẩy ngay vào buồng khám
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
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
                            Tạo lịch mới
                        </Button>
                    </div>
                </div>

                {/* Filter Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100 text-xs">
                    <div className="lg:col-span-2">
                        <Input
                            prefix={<SearchOutlined className="text-slate-400" />}
                            placeholder="Mã lịch, tên bệnh nhân, SĐT..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onPressEnter={loadAppointments}
                            allowClear
                        />
                    </div>
                    <div>
                        <DatePicker
                            className="w-full"
                            format="DD/MM/YYYY"
                            value={selectedDate ? dayjs(selectedDate) : null}
                            onChange={(date) => setSelectedDate(date ? date.format('YYYY-MM-DD') : '')}
                            placeholder="Chọn ngày khám"
                        />
                    </div>
                    <div>
                        <Select
                            className="w-full"
                            placeholder="Tất cả khoa"
                            value={selectedDep || undefined}
                            onChange={(val) => setSelectedDep(val || '')}
                            allowClear
                            options={departments.map((d) => ({ value: d.id, label: d.name }))}
                        />
                    </div>
                    <div>
                        <Select
                            className="w-full"
                            placeholder="Tất cả bác sĩ"
                            value={selectedDoctor || undefined}
                            onChange={(val) => setSelectedDoctor(val || '')}
                            allowClear
                            options={doctors.map((d) => ({ value: d.id, label: d.name }))}
                        />
                    </div>
                    <div>
                        <Select
                            className="w-full"
                            placeholder="Trạng thái"
                            value={selectedStatus || undefined}
                            onChange={(val) => setSelectedStatus(val || '')}
                            allowClear
                            options={[
                                { value: 'DA_DAT', label: 'Đã đặt (Chờ đến)' },
                                { value: 'DA_DEN', label: 'Đã đến (Đã check-in)' },
                                { value: 'CANCELLED', label: 'Đã hủy' },
                            ]}
                        />
                    </div>
                </div>

                {/* Filter summary tags */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>
                        Tìm thấy <strong>{filteredAppointments.length}</strong> lịch hẹn phù hợp
                        {selectedDate && <span className="ml-1 text-slate-400">(Ngày: {dayjs(selectedDate).format('DD/MM/YYYY')})</span>}
                    </span>
                    {(searchQuery || selectedDep || selectedDoctor || selectedStatus || selectedDate !== dayjs().format('YYYY-MM-DD')) && (
                        <button
                            onClick={handleClearFilters}
                            className="text-sky-600 hover:underline font-semibold cursor-pointer"
                        >
                            Đặt lại về hôm nay
                        </button>
                    )}
                </div>
            </div>

            {/* View Mode: TABLE */}
            {viewMode === 'TABLE' ? (
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    <Table
                        columns={columns}
                        dataSource={filteredAppointments}
                        rowKey={(r) => r.id || r.ma_lich_kham}
                        pagination={{ pageSize: 10, showSizeChanger: true }}
                        size="middle"
                        loading={loading}
                        rowClassName={() => 'hover:bg-sky-50/30 transition-colors'}
                    />
                </div>
            ) : (
                /* View Mode: SCHEDULE_SLOTS (Timeline / Slots View) */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {['07:30 - 08:00', '08:00 - 08:30', '08:30 - 09:00', '09:00 - 09:30', '09:30 - 10:00', '10:00 - 10:30', '13:30 - 14:00', '14:00 - 14:30'].map(
                        (slot) => {
                            const appsInSlot = filteredAppointments.filter((a) => (a.timeSlot === slot || a.gio_kham === slot))
                            return (
                                <div key={slot} className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <span className="font-bold text-sky-800 text-xs flex items-center gap-1.5">
                                            <CalendarOutlined /> {slot}
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
                                                const stLabel = isArrived ? { label: 'Đã đến', color: 'green' } : { label: 'Đã đặt', color: 'blue' }
                                                const patName = app.ten_benh_nhan || pat?.fullName || 'Bệnh nhân'

                                                return (
                                                    <div
                                                        key={app.id}
                                                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200/70 text-xs space-y-1.5 transition"
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-bold text-slate-900">{patName}</span>
                                                            <Tag color={stLabel.color} className="mr-0 text-[10px]">{stLabel.label}</Tag>
                                                        </div>
                                                        <div className="text-[11px] text-slate-500">BS: {app.ten_bac_si || doc?.name}</div>
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
                                                                Xác nhận check-in
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

            {/* Modals */}
            <AppointmentFormModal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
            <AppointmentDetailModal
                appointment={selectedAppointment}
                open={Boolean(selectedAppointment)}
                onClose={() => setSelectedAppointment(null)}
                onCheckInClick={(app) => {
                    handleOneTouchCheckIn(app)
                }}
            />
            {/* Modal Phiếu STT nhiệt mini K80 mở lên sau khi 1 chạm check-in thành công */}
            <CheckInReceiptModal
                open={isReceiptModalOpen}
                onClose={() => setIsReceiptModalOpen(false)}
                queueEntry={selectedTicketForPrint}
            />
        </div>
    )
}
