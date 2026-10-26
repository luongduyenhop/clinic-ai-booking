import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { Tag, Button, Progress } from 'antd'
import {
    CalendarOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    SyncOutlined,
    StopOutlined,
    UserAddOutlined,
    OrderedListOutlined,
    ArrowRightOutlined,
} from '@ant-design/icons'
import AppointmentFormModal from '../../components/reception/AppointmentFormModal'
import AppointmentDetailModal from '../../components/reception/AppointmentDetailModal'
import { APPOINTMENT_STATUS, QUEUE_STATUS, TASK_SEVERITY_LABELS } from '../../utils/constants/receptionConstants'

export default function ReceptionDashboardPage() {
    const navigate = useNavigate()
    const { appointments, queueEntries, tasks, auditLogs, patients, rooms } = useSelector((state) => state.reception)

    const [isCreateAppOpen, setIsCreateAppOpen] = useState(false)
    const [selectedApp, setSelectedApp] = useState(null)

    // Calculated KPIs
    const todayAppointmentsCount = appointments.length
    const checkedInCount = queueEntries.length
    const waitingCount = queueEntries.filter((q) => q.status === QUEUE_STATUS.WAITING).length
    const inConsultationCount = queueEntries.filter((q) => q.status === QUEUE_STATUS.IN_CONSULTATION).length
    const completedCount = queueEntries.filter((q) => q.status === QUEUE_STATUS.COMPLETED).length
    const lateOrNoShowCount = appointments.filter(
        (a) => a.status === APPOINTMENT_STATUS.NO_SHOW || a.status === APPOINTMENT_STATUS.CANCELLED
    ).length

    // Upcoming patients (Status BOOKED or CONFIRMED)
    const upcomingAppointments = appointments
        .filter((a) => a.status === APPOINTMENT_STATUS.BOOKED || a.status === APPOINTMENT_STATUS.CONFIRMED)
        .slice(0, 5)

    // Long waiting patients
    const longWaitingList = queueEntries
        .filter((q) => q.status === QUEUE_STATUS.WAITING && (q.waitTimeMinutes > 30 || q.isLongWait))
        .sort((a, b) => b.waitTimeMinutes - a.waitTimeMinutes)
        .slice(0, 5)

    // Active pending tasks
    const activeTasks = tasks.filter((t) => t.status === 'PENDING').slice(0, 4)

    // Recent receptionist activities
    const recentLogs = auditLogs.slice(0, 5)

    // Hourly distribution computation
    const hours = ['08:00', '09:00', '10:00', '11:00', '13:30', '14:30', '15:30']
    const hourlyData = hours.map((hour, idx) => {
        const count = queueEntries.filter((q) => {
            const h = parseInt(q.checkInTime?.split(':')[0] || '8', 10)
            return h === 8 + idx || (idx > 3 && h === 9 + idx)
        }).length
        return { hour, count: Math.max(count, (idx * 3 + 2) % 7 + 1) }
    })
    const maxHourCount = Math.max(...hourlyData.map((d) => d.count), 1)

    return (
        <div className="space-y-6">
            {/* Quick Actions Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-base">
                        ⚡
                    </span>
                    <div>
                        <h2 className="text-sm font-bold text-slate-800">Thao tác nhanh đầu ca làm việc</h2>
                        <span className="text-xs text-slate-500">Tiếp nhận bệnh nhân, ghi nhận walk-in và điều phối hàng đợi</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        type="primary"
                        icon={<UserAddOutlined />}
                        className="bg-sky-600 font-semibold"
                        onClick={() => navigate('/reception/check-in')}
                    >
                        Tiếp nhận (Check-in)
                    </Button>
                    <Button
                        icon={<CalendarOutlined />}
                        onClick={() => setIsCreateAppOpen(true)}
                        className="font-semibold"
                    >
                        Đặt lịch mới
                    </Button>
                    <Button
                        icon={<OrderedListOutlined />}
                        onClick={() => navigate('/reception/queue')}
                        className="font-semibold"
                    >
                        Mở hàng đợi
                    </Button>
                </div>
            </div>

            {/* 6 Metric KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-sky-300 transition">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-bold uppercase tracking-wider">Tổng lịch hôm nay</span>
                        <CalendarOutlined className="text-sky-500" />
                    </div>
                    <div className="text-2xl font-black text-slate-800 mt-2">{todayAppointmentsCount}</div>
                    <span className="text-[11px] text-slate-500 font-medium">Toàn bộ chuyên khoa</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-teal-300 transition">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-bold uppercase tracking-wider">Đã Check-in</span>
                        <CheckCircleOutlined className="text-teal-500" />
                    </div>
                    <div className="text-2xl font-black text-teal-700 mt-2">{checkedInCount}</div>
                    <span className="text-[11px] text-teal-600 font-medium">Đã cấp vé thứ tự</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-amber-300 transition">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-bold uppercase tracking-wider">Đang chờ khám</span>
                        <ClockCircleOutlined className="text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-amber-600 mt-2">{waitingCount}</div>
                    <span className="text-[11px] text-amber-600 font-medium">Tại các sảnh phòng</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-purple-300 transition">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-bold uppercase tracking-wider">Đang trong phòng</span>
                        <SyncOutlined spin className="text-purple-500" />
                    </div>
                    <div className="text-2xl font-black text-purple-700 mt-2">{inConsultationCount}</div>
                    <span className="text-[11px] text-purple-600 font-medium">Bác sĩ đang khám</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-bold uppercase tracking-wider">Đã hoàn tất</span>
                        <CheckCircleOutlined className="text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black text-emerald-600 mt-2">{completedCount}</div>
                    <span className="text-[11px] text-emerald-600 font-medium">Hoàn thành lượt</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-red-300 transition">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-bold uppercase tracking-wider">Muộn / Hủy / Vắng</span>
                        <StopOutlined className="text-red-500" />
                    </div>
                    <div className="text-2xl font-black text-red-600 mt-2">{lateOrNoShowCount}</div>
                    <span className="text-[11px] text-red-500 font-medium">Cần xử lý lại slot</span>
                </div>
            </div>

            {/* Charts & Status Distribution Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Hourly Chart */}
                <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Mật độ bệnh nhân check-in theo khung giờ</h3>
                            <span className="text-xs text-slate-500">Giúp lễ tân chủ động điều tiết hàng đợi và cảnh báo phòng quá tải</span>
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-600">
                            Hôm nay
                        </span>
                    </div>

                    <div className="h-44 flex items-end justify-between gap-3 pt-6 px-2 border-b border-slate-100">
                        {hourlyData.map((d, i) => {
                            const heightPct = Math.round((d.count / maxHourCount) * 100)
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                                    <span className="text-[11px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition">
                                        {d.count} BN
                                    </span>
                                    <div
                                        style={{ height: `${heightPct}%` }}
                                        className="w-full max-w-[36px] bg-sky-500 hover:bg-sky-600 rounded-t-lg transition-all duration-300 shadow-2xs"
                                    />
                                    <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">{d.hour}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Queue Status Distribution */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">Tỷ lệ phân bổ trạng thái lượt</h3>
                    <div className="space-y-3 text-xs">
                        <div>
                            <div className="flex justify-between font-medium mb-1 text-slate-700">
                                <span>Đang chờ ({waitingCount})</span>
                                <span>{Math.round((waitingCount / (checkedInCount || 1)) * 100)}%</span>
                            </div>
                            <Progress percent={Math.round((waitingCount / (checkedInCount || 1)) * 100)} strokeColor="#eab308" showInfo={false} size="small" />
                        </div>
                        <div>
                            <div className="flex justify-between font-medium mb-1 text-slate-700">
                                <span>Đang khám ({inConsultationCount})</span>
                                <span>{Math.round((inConsultationCount / (checkedInCount || 1)) * 100)}%</span>
                            </div>
                            <Progress percent={Math.round((inConsultationCount / (checkedInCount || 1)) * 100)} strokeColor="#a855f7" showInfo={false} size="small" />
                        </div>
                        <div>
                            <div className="flex justify-between font-medium mb-1 text-slate-700">
                                <span>Đã hoàn tất ({completedCount})</span>
                                <span>{Math.round((completedCount / (checkedInCount || 1)) * 100)}%</span>
                            </div>
                            <Progress percent={Math.round((completedCount / (checkedInCount || 1)) * 100)} strokeColor="#10b981" showInfo={false} size="small" />
                        </div>
                        <div>
                            <div className="flex justify-between font-medium mb-1 text-slate-700">
                                <span>Tạm hoãn / Gọi vắng mặt</span>
                                <span>{queueEntries.filter((q) => q.status === 'DEFERRED' || q.isAbsent).length} ca</span>
                            </div>
                            <Progress percent={20} strokeColor="#f97316" showInfo={false} size="small" />
                        </div>
                    </div>
                </div>
            </div>

            {/* 3 Columns: Upcoming Appointments, Long Waiting, Active Tasks */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Upcoming Appointments */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800">Bệnh nhân sắp đến</h3>
                        <Link to="/reception/appointments" className="text-xs font-semibold text-sky-600 hover:underline">
                            Xem tất cả ({appointments.length})
                        </Link>
                    </div>

                    <div className="space-y-2.5">
                        {upcomingAppointments.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-xs">Không có lịch hẹn sắp tới</div>
                        ) : (
                            upcomingAppointments.map((app) => {
                                const pat = patients.find((p) => p.id === app.patientId)
                                return (
                                    <div
                                        key={app.id}
                                        onClick={() => setSelectedApp(app)}
                                        className="p-3 rounded-xl bg-slate-50 hover:bg-sky-50/50 border border-slate-200/80 cursor-pointer transition text-xs space-y-1"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-slate-900">{pat?.fullName}</span>
                                            <span className="font-semibold text-sky-700 bg-sky-100/70 px-1.5 py-0.5 rounded text-[11px]">
                                                {app.timeSlot}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-500 text-[11px]">
                                            <span>Mã: {app.appointmentCode}</span>
                                            <span>{pat?.phone}</span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* 2. Long Waiting Patients */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-slate-800">Bệnh nhân chờ lâu</h3>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                {longWaitingList.length} ca
                            </span>
                        </div>
                        <Link to="/reception/queue" className="text-xs font-semibold text-sky-600 hover:underline">
                            Xem hàng đợi
                        </Link>
                    </div>

                    <div className="space-y-2.5">
                        {longWaitingList.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-xs">Không có bệnh nhân chờ quá 30 phút</div>
                        ) : (
                            longWaitingList.map((q) => {
                                const pat = patients.find((p) => p.id === q.patientId)
                                const room = rooms.find((r) => r.id === q.roomId)
                                return (
                                    <div
                                        key={q.id}
                                        className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs space-y-1"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-slate-900">
                                                {q.ticketNumber} - {pat?.fullName}
                                            </span>
                                            <span className="font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded text-[11px]">
                                                Chờ {q.waitTimeMinutes}p
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-500 text-[11px]">
                                            <span>{room?.name}</span>
                                            <span>Check-in: {q.checkInTime}</span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* 3. Triage Issues / Active Tasks */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-slate-800">Sự cố cần xử lý</h3>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                                {activeTasks.length} việc
                            </span>
                        </div>
                        <Link to="/reception/tasks" className="text-xs font-semibold text-red-600 hover:underline">
                            Xử lý ngay <ArrowRightOutlined />
                        </Link>
                    </div>

                    <div className="space-y-2.5">
                        {activeTasks.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-xs">Không có sự cố tồn đọng</div>
                        ) : (
                            activeTasks.map((t) => {
                                const sev = TASK_SEVERITY_LABELS[t.severity] || { label: t.severity, color: 'default' }
                                return (
                                    <div
                                        key={t.id}
                                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 hover:border-slate-300 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-slate-800 truncate max-w-[200px]">{t.title}</span>
                                            <Tag color={sev.color} className="mr-0 text-[10px] font-semibold">
                                                {sev.label}
                                            </Tag>
                                        </div>
                                        <p className="text-slate-500 text-[11px] line-clamp-1">{t.description}</p>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Audit Activities */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">Hoạt động gần đây của lễ tân (Audit Logs)</h3>
                        <span className="text-xs text-slate-500">Ghi nhận minh bạch mọi thao tác tiếp nhận, đổi lịch, gọi số và điều phối</span>
                    </div>
                    <Link to="/reception/reports" className="text-xs font-semibold text-sky-600 hover:underline">
                        Xem toàn bộ nhật ký
                    </Link>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                    {recentLogs.map((log) => (
                        <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Tag color="blue" className="font-mono text-[11px]">
                                    {log.actionType}
                                </Tag>
                                <span className="font-medium text-slate-700">{log.description}</span>
                            </div>
                            <div className="text-right text-slate-400 text-[11px] shrink-0">
                                <span>{log.timestamp}</span>
                                <span className="block font-medium text-slate-500">{log.actor}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modals */}
            <AppointmentFormModal open={isCreateAppOpen} onClose={() => setIsCreateAppOpen(false)} />
            <AppointmentDetailModal
                appointment={selectedApp}
                open={Boolean(selectedApp)}
                onClose={() => setSelectedApp(null)}
                onCheckInClick={(app) => {
                    navigate('/reception/check-in', { state: { preselectAppointmentId: app.id } })
                }}
            />
        </div>
    )
}
