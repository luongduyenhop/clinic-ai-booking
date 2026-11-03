import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { Tag, Button, Progress, Alert } from 'antd'
import {
    CalendarOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    SyncOutlined,
    StopOutlined,
    UserAddOutlined,
    OrderedListOutlined,
    ArrowRightOutlined,
    WarningOutlined,
    LockOutlined,
} from '@ant-design/icons'
import AppointmentFormModal from '../../components/reception/AppointmentFormModal'
import AppointmentDetailModal from '../../components/reception/AppointmentDetailModal'
import CloseShiftModal from '../../components/reception/CloseShiftModal'
import { APPOINTMENT_STATUS, QUEUE_STATUS } from '../../utils/constants/receptionConstants'
import { formatDoctorName } from '../../utils/doctorHelper'
import {
    fetchShiftDashboardAsync,
    fetchFlowBoardAsync,
    fetchDoctorAbsencesAsync,
} from '../../redux/actions/reception/receptionAction'

export default function ReceptionDashboardPage() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const {
        appointments = [],
        queueEntries = [],
        shiftSummary,
        roomStatus = [],
        doctorAbsences = [],
        auditLogs = [],
        patients = [],
        rooms = [],
    } = useSelector((state) => state.reception)

    const [isCreateAppOpen, setIsCreateAppOpen] = useState(false)
    const [selectedApp, setSelectedApp] = useState(null)
    const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false)

    useEffect(() => {
        dispatch(fetchShiftDashboardAsync())
        dispatch(fetchDoctorAbsencesAsync())
    }, [dispatch])

    // KPIs derived from Real Backend Shift Summary with Fallbacks
    const todayAppointmentsCount = shiftSummary?.tong_hen_truoc ?? appointments.length
    const checkedInCount = shiftSummary?.da_check_in ?? queueEntries.length
    const waitingCount =
        shiftSummary?.dang_cho_kham ??
        queueEntries.filter((q) => q.status === QUEUE_STATUS.WAITING || q.status === 'cho_kham').length
    const inConsultationCount =
        shiftSummary?.dang_kham ??
        queueEntries.filter((q) => q.status === QUEUE_STATUS.IN_CONSULTATION || q.status === 'dang_kham').length
    const completedCount =
        shiftSummary?.da_kham ??
        queueEntries.filter((q) => q.status === QUEUE_STATUS.COMPLETED || q.status === 'da_kham').length
    const lateOrNoShowCount =
        shiftSummary?.vang_mat !== undefined
            ? (shiftSummary.vang_mat || 0) + (shiftSummary.bo_kham || 0)
            : appointments.filter(
                  (a) => a.status === APPOINTMENT_STATUS.NO_SHOW || a.status === APPOINTMENT_STATUS.CANCELLED
              ).length

    // Upcoming patients
    const upcomingAppointments = shiftSummary?.lich_hen_sap_toi?.length > 0
        ? shiftSummary.lich_hen_sap_toi
        : appointments
            .filter((a) => a.status === APPOINTMENT_STATUS.BOOKED || a.status === APPOINTMENT_STATUS.CONFIRMED || a.status === 'da_xac_nhan')
            .slice(0, 5)

    // Long waiting patients (> 30 mins)
    const longWaitingList = shiftSummary?.benh_nhan_cho_lau?.length > 0
        ? shiftSummary.benh_nhan_cho_lau.map((item) => ({
            id: item.ticket_id,
            ticketNumber: item.ma_so_thu_tu,
            patientName: item.ten_benh_nhan,
            waitTimeMinutes: item.thoi_gian_cho_phut,
            roomName: item.ten_phong || item.ma_phong || 'Phòng khám',
            checkInTime: item.thoi_gian_check_in,
        }))
        : queueEntries
            .filter((q) => (q.status === QUEUE_STATUS.WAITING || q.status === 'cho_kham') && (q.waitTimeMinutes > 30 || q.isLongWait))
            .sort((a, b) => b.waitTimeMinutes - a.waitTimeMinutes)
            .slice(0, 5)

    // Active incidents from Backend
    const activeIncidents = doctorAbsences.slice(0, 4)

    // Recent receptionist activities from Backend or Queue history fallback
    const recentLogs = shiftSummary?.hoat_dong_gan_day?.length > 0
        ? shiftSummary.hoat_dong_gan_day.map((item) => ({
            id: item.id,
            actionType: item.loai_thao_tac,
            description: item.noi_dung,
            timestamp: item.thoi_gian,
            actor: item.nguoi_thuc_hien,
        }))
        : (auditLogs.length > 0
            ? auditLogs.slice(0, 5)
            : queueEntries.slice(0, 5).map((q) => ({
                id: q.id,
                actionType: q.isWalkIn ? 'WALK_IN_CREATE' : 'CHECK_IN',
                description: `Bệnh nhân ${q.patientName} (${q.ticketNumber}) tại ${q.roomName || 'Phòng khám'}`,
                timestamp: q.checkInTime || 'Vừa xong',
                actor: 'Lễ tân ca trực',
            })))

    // Hourly distribution from actual check-in data
    const hours = ['07:30', '08:30', '09:30', '10:30', '13:30', '14:30', '15:30']
    const hourlyData = shiftSummary?.mat_do_theo_gio?.length > 0
        ? shiftSummary.mat_do_theo_gio.map((d) => ({
            hour: d.khung_gio,
            count: d.so_luong,
        }))
        : hours.map((hour, idx) => {
            const count = queueEntries.filter((q) => {
                const h = parseInt(q.checkInTime?.split(':')[0] || '7', 10)
                return h === 7 + idx || (idx > 3 && h === 8 + idx)
            }).length
            return { hour, count }
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
                    <Button
                        icon={<LockOutlined className="text-rose-600" />}
                        onClick={() => setIsCloseShiftOpen(true)}
                        className="font-semibold text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100"
                    >
                        Đóng ca trực
                    </Button>
                </div>
            </div>

            {/* Critical Alert if any doctor is absent */}
            {activeIncidents.length > 0 && (
                <Alert
                    message="Cảnh báo sự cố ca trực: Bác sĩ vắng mặt đột xuất"
                    description={`Đang có ${activeIncidents.length} bác sĩ nghỉ đột xuất cần điều chuyển bệnh nhân sang bác sĩ khác.`}
                    type="error"
                    showIcon
                    action={
                        <Button size="small" danger onClick={() => navigate('/reception/tasks')}>
                            Xử lý sự cố ngay
                        </Button>
                    }
                />
            )}

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

            {/* Room Status / Buồng khám realtime */}
            {roomStatus.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800">Giám sát buồng khám vật lý thời gian thực</h3>
                        <span className="text-xs text-slate-500">Cảnh báo tải theo từng cửa buồng</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {roomStatus.map((rm) => {
                            const waiting = rm.so_benh_nhan_cho ?? rm.so_nguoi_cho ?? 0
                            const isOverloaded = waiting > 5
                            const formattedDoc = rm.ten_bac_si ? formatDoctorName(rm.ten_bac_si) : 'Chưa gán'
                            return (
                                <div
                                    key={rm.phong_kham_id || rm.ten_phong}
                                    className={`p-3 rounded-xl border text-xs space-y-1.5 transition ${
                                        isOverloaded
                                            ? 'bg-amber-50/70 border-amber-300'
                                            : 'bg-slate-50/70 border-slate-200/80'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-slate-800">{rm.ten_phong}</span>
                                        {isOverloaded && <WarningOutlined className="text-amber-600" />}
                                    </div>
                                    <div className="text-slate-500 text-[11px] truncate">
                                        BS: {formattedDoc}
                                    </div>
                                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 font-semibold">
                                        <span className="text-slate-500 text-[11px]">Đang chờ:</span>
                                        <span className={isOverloaded ? 'text-amber-700 font-bold' : 'text-sky-700'}>
                                            {waiting} BN
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Charts & Status Distribution Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Hourly Chart */}
                <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Mật độ bệnh nhân check-in theo khung giờ</h3>
                            <span className="text-xs text-slate-500">Thống kê lưu lượng check-in thực tế</span>
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
                                        style={{ height: `${Math.max(heightPct, 6)}%` }}
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
                                <span>Vãng lai trực tiếp</span>
                                <span>{shiftSummary?.vang_lai ?? queueEntries.filter((q) => q.isWalkIn).length} ca</span>
                            </div>
                            <Progress
                                percent={Math.round(((shiftSummary?.vang_lai ?? queueEntries.filter((q) => q.isWalkIn).length) / (checkedInCount || 1)) * 100)}
                                strokeColor="#0284c7"
                                showInfo={false}
                                size="small"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 3 Columns: Upcoming Appointments, Long Waiting, Active Incidents */}
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
                                const pat = patients.find((p) => p.id === (app.patientId || app.benh_nhan_id))
                                return (
                                    <div
                                        key={app.id}
                                        onClick={() => setSelectedApp(app)}
                                        className="p-3 rounded-xl bg-slate-50 hover:bg-sky-50/50 border border-slate-200/80 cursor-pointer transition text-xs space-y-1"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-slate-900">{app.ten_benh_nhan || pat?.fullName}</span>
                                            <span className="font-semibold text-sky-700 bg-sky-100/70 px-1.5 py-0.5 rounded text-[11px]">
                                                {app.gio_kham || app.timeSlot}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-500 text-[11px]">
                                            <span>Mã: {app.ma_lich_kham || app.appointmentCode || `APT-${app.id}`}</span>
                                            <span>{app.so_dien_thoai || pat?.phone}</span>
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
                                                {q.ticketNumber} - {q.patientName || pat?.fullName}
                                            </span>
                                            <span className="font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded text-[11px]">
                                                Chờ {q.waitTimeMinutes}p
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-500 text-[11px]">
                                            <span>{q.roomName || room?.name}</span>
                                            <span>Check-in: {q.checkInTime}</span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* 3. Incidents / Active Tasks */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-slate-800">Sự cố cần xử lý</h3>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                                {activeIncidents.length} sự cố
                            </span>
                        </div>
                        <Link to="/reception/tasks" className="text-xs font-semibold text-red-600 hover:underline">
                            Xử lý ngay <ArrowRightOutlined />
                        </Link>
                    </div>

                    <div className="space-y-2.5">
                        {activeIncidents.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-xs">Không có sự cố tồn đọng trong ca</div>
                        ) : (
                            activeIncidents.map((inc) => (
                                <div
                                    key={inc.bac_si_id}
                                    className="p-3 rounded-xl bg-red-50/60 border border-red-200 text-xs space-y-1 hover:border-red-300 transition"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-800 truncate max-w-[200px]">
                                            BS {inc.ten_bac_si} nghỉ đột xuất
                                        </span>
                                        <Tag color="error" className="mr-0 text-[10px] font-semibold">
                                            Khẩn cấp
                                        </Tag>
                                    </div>
                                    <p className="text-slate-600 text-[11px]">
                                        Khoa: {inc.ten_chuyen_khoa} • {inc.so_benh_nhan_bi_anh_huong || 0} bệnh nhân cần chuyển
                                    </p>
                                </div>
                            ))
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
            <CloseShiftModal
                open={isCloseShiftOpen}
                onCancel={() => setIsCloseShiftOpen(false)}
                onSuccess={() => {
                    dispatch(fetchShiftDashboardAsync())
                }}
            />
        </div>
    )
}
