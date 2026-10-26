import { useState, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Table, Input, Select, DatePicker, Button, Tag, Space, Card, Segmented, message } from 'antd'
import {
    SearchOutlined,
    PlusOutlined,
    CalendarOutlined,
    TableOutlined,
    CheckCircleOutlined,
    EditOutlined,
    CloseCircleOutlined,
    InfoCircleOutlined,
    FilterOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import AppointmentFormModal from '../../components/reception/AppointmentFormModal'
import AppointmentDetailModal from '../../components/reception/AppointmentDetailModal'
import { APPOINTMENT_STATUS, APPOINTMENT_STATUS_LABELS } from '../../utils/constants/receptionConstants'

export default function AppointmentsPage() {
    const navigate = useNavigate()
    const { appointments, patients, departments, doctors, services, rooms } = useSelector((state) => state.reception)

    const [viewMode, setViewMode] = useState('TABLE') // 'TABLE' | 'SCHEDULE_SLOTS'
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedDate, setSelectedDate] = useState('2026-10-12')
    const [selectedDep, setSelectedDep] = useState('')
    const [selectedDoctor, setSelectedDoctor] = useState('')
    const [selectedStatus, setSelectedStatus] = useState('')

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [selectedAppointment, setSelectedAppointment] = useState(null)

    // Filter appointments
    const filteredAppointments = useMemo(() => {
        return appointments.filter((app) => {
            const pat = patients.find((p) => p.id === app.patientId)
            const matchesQuery =
                !searchQuery ||
                app.appointmentCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (pat && pat.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (pat && pat.phone.includes(searchQuery))

            const matchesDate = !selectedDate || app.appointmentDate === selectedDate
            const matchesDep = !selectedDep || app.departmentId === selectedDep
            const matchesDoctor = !selectedDoctor || app.doctorId === selectedDoctor
            const matchesStatus = !selectedStatus || app.status === selectedStatus

            return matchesQuery && matchesDate && matchesDep && matchesDoctor && matchesStatus
        })
    }, [appointments, patients, searchQuery, selectedDate, selectedDep, selectedDoctor, selectedStatus])

    const handleClearFilters = () => {
        setSearchQuery('')
        setSelectedDate('2026-10-12')
        setSelectedDep('')
        setSelectedDoctor('')
        setSelectedStatus('')
    }

    const columns = [
        {
            title: 'Mã lịch hẹn',
            dataIndex: 'appointmentCode',
            key: 'appointmentCode',
            width: 170,
            render: (code, record) => (
                <div>
                    <span className="font-mono font-bold text-sky-700 block">{code}</span>
                    <span className="text-[11px] text-slate-400">Kênh: {record.type || 'ONLINE'}</span>
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
                        <div className="font-bold text-slate-900">{pat?.fullName || 'N/A'}</div>
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
            title: 'Khung giờ khám',
            dataIndex: 'timeSlot',
            key: 'timeSlot',
            width: 140,
            render: (slot, record) => (
                <div>
                    <span className="font-semibold text-slate-800 block text-xs">{slot}</span>
                    <span className="text-[11px] text-slate-400">{record.appointmentDate}</span>
                </div>
            ),
        },
        {
            title: 'Chuyên khoa & Bác sĩ',
            key: 'specialty',
            render: (_, record) => {
                const dep = departments.find((d) => d.id === record.departmentId)
                const doc = doctors.find((d) => d.id === record.doctorId)
                const room = rooms.find((r) => r.id === record.roomId)
                return (
                    <div className="text-xs">
                        <span className="font-semibold text-slate-800 block">{dep?.name}</span>
                        <span className="text-slate-500">BS: {doc?.name} ({room?.name})</span>
                    </div>
                )
            },
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 130,
            render: (status) => {
                const cfg = APPOINTMENT_STATUS_LABELS[status] || { label: status, color: 'default' }
                return <Tag color={cfg.color} className="font-semibold text-xs">{cfg.label}</Tag>
            },
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 180,
            align: 'right',
            render: (_, record) => {
                const canCheckIn = record.status === APPOINTMENT_STATUS.BOOKED || record.status === APPOINTMENT_STATUS.CONFIRMED
                return (
                    <Space size="small">
                        {canCheckIn && (
                            <Button
                                size="small"
                                type="primary"
                                className="bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold"
                                onClick={() => {
                                    navigate('/reception/check-in', { state: { preselectAppointmentId: record.id } })
                                }}
                            >
                                Tiếp nhận
                            </Button>
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
                        <h2 className="text-base font-bold text-slate-800">Danh sách lịch hẹn khám</h2>
                        <span className="text-xs text-slate-500">
                            Tìm kiếm, lọc danh sách lịch hẹn, thực hiện đổi giờ hoặc hủy lịch kèm lý do
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
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
                            allowClear
                        />
                    </div>
                    <div>
                        <DatePicker
                            className="w-full"
                            format="DD/MM/YYYY"
                            value={selectedDate ? dayjs(selectedDate) : null}
                            onChange={(date) => setSelectedDate(date ? date.format('YYYY-MM-DD') : '')}
                            placeholder="Chọn ngày"
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
                            options={Object.keys(APPOINTMENT_STATUS).map((k) => ({
                                value: k,
                                label: APPOINTMENT_STATUS_LABELS[k]?.label || k,
                            }))}
                        />
                    </div>
                </div>

                {/* Filter summary tags */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>
                        Tìm thấy <strong>{filteredAppointments.length}</strong> lịch hẹn phù hợp
                    </span>
                    {(searchQuery || selectedDep || selectedDoctor || selectedStatus || selectedDate !== '2026-10-12') && (
                        <button
                            onClick={handleClearFilters}
                            className="text-sky-600 hover:underline font-semibold cursor-pointer"
                        >
                            Xóa bộ lọc
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
                        rowKey="id"
                        pagination={{ pageSize: 8, showSizeChanger: true }}
                        size="middle"
                        rowClassName={() => 'hover:bg-sky-50/30 transition-colors'}
                    />
                </div>
            ) : (
                /* View Mode: SCHEDULE_SLOTS (Timeline / Slots View) */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {['07:30 - 08:00', '08:00 - 08:30', '08:30 - 09:00', '09:00 - 09:30', '09:30 - 10:00', '10:00 - 10:30', '13:30 - 14:00', '14:00 - 14:30'].map(
                        (slot) => {
                            const appsInSlot = filteredAppointments.filter((a) => a.timeSlot === slot)
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
                                                const pat = patients.find((p) => p.id === app.patientId)
                                                const doc = doctors.find((d) => d.id === app.doctorId)
                                                const st = APPOINTMENT_STATUS_LABELS[app.status] || { label: app.status, color: 'default' }
                                                return (
                                                    <div
                                                        key={app.id}
                                                        onClick={() => setSelectedAppointment(app)}
                                                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200/70 text-xs space-y-1 cursor-pointer transition"
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-bold text-slate-900">{pat?.fullName}</span>
                                                            <Tag color={st.color} className="mr-0 text-[10px]">{st.label}</Tag>
                                                        </div>
                                                        <div className="text-[11px] text-slate-500">BS: {doc?.name}</div>
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
                    navigate('/reception/check-in', { state: { preselectAppointmentId: app.id } })
                }}
            />
        </div>
    )
}
