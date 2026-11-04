import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { Progress, Alert } from 'antd'
import AppointmentFormModal from '../../components/reception/AppointmentFormModal'
import AppointmentDetailModal from '../../components/reception/AppointmentDetailModal'
import CloseShiftModal from '../../components/reception/CloseShiftModal'
import { APPOINTMENT_STATUS, QUEUE_STATUS } from '../../utils/constants/receptionConstants'
import { formatDoctorName } from '../../utils/doctorHelper'
import {
    fetchShiftDashboardAsync,
    fetchDoctorAbsencesAsync,
} from '../../redux/actions/reception/receptionAction'
import {
    ClipboardText,
    CalendarCheck,
    CalendarPlus,
    UserList,
    Stethoscope,
    LockKey,
    ShieldCheck,
    WarningCircle,
    ArrowRight,
    Clock,
    UserCheck,
    ChartBar,
    Pulse,
    CheckCircle,
} from '../../components/common/ClinicIcon'

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
        <div className="space-y-4">
            {/* Top Welcome Banner — Aligned with Admin Dashboard */}
            <div className="rounded-2xl bg-gradient-to-r from-[#003553] via-[#004A73] to-[#00B5F1] p-5 text-white shadow-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-wider border border-white/20">
                        <ShieldCheck size={14} weight="fill" className="text-[#FFB54A]" />
                        <span>TRUNG TÂM ĐIỀU HÀNH BÀN TIẾP ĐÓN & LỄ TÂN CLINIC-AI</span>
                    </div>
                    <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
                        BÀN LÀM VIỆC TIẾP ĐÓN, CHECK-IN & ĐIỀU PHỐI HÀNG ĐỢI
                    </h1>
                    <p className="text-xs text-sky-100 max-w-3xl">
                        Theo dõi công suất tiếp nhận, cấp số thứ tự, cảnh báo bệnh nhân chờ lâu và điều chuyển bệnh nhân khi bác sĩ vắng mặt theo thời gian thực.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    <Link
                        to="/reception/check-in"
                        className="medpro-btn-amber shadow-sm inline-flex items-center gap-1.5"
                    >
                        <ClipboardText size={16} weight="bold" />
                        <span>Tiếp nhận (F2)</span>
                    </Link>
                    <Link
                        to="/reception/queue"
                        className="px-4 py-2 rounded-full bg-white text-[#003553] hover:bg-[#E8F4FD] font-extrabold text-xs shadow-sm transition inline-flex items-center gap-1.5"
                    >
                        <UserList size={16} weight="bold" className="text-[#00B5F1]" />
                        <span>Hàng đợi (F4)</span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => setIsCreateAppOpen(true)}
                        className="medpro-btn-outline !bg-white/15 !text-white !border-white/30 hover:!bg-white/25 text-xs inline-flex items-center gap-1.5"
                    >
                        <CalendarPlus size={15} weight="bold" />
                        <span>Đặt lịch</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsCloseShiftOpen(true)}
                        className="medpro-btn-danger text-xs inline-flex items-center gap-1.5"
                    >
                        <LockKey size={14} weight="bold" />
                        <span>Đóng ca trực</span>
                    </button>
                </div>
            </div>

            {/* Critical Alert if any doctor is absent */}
            {activeIncidents.length > 0 && (
                <div className="rounded-xl border border-rose-300 bg-rose-50/90 p-4 shadow-xs flex items-center justify-between gap-3 text-rose-900">
                    <div className="flex items-center gap-3">
                        <WarningCircle size={24} weight="fill" className="text-rose-600 shrink-0" />
                        <div>
                            <div className="text-sm font-bold text-rose-900">Cảnh báo sự cố ca trực: Bác sĩ vắng mặt đột xuất</div>
                            <div className="text-xs text-rose-700">Đang có {activeIncidents.length} bác sĩ nghỉ đột xuất cần điều chuyển bệnh nhân sang buồng khám khác.</div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/reception/tasks')}
                        className="medpro-btn-danger shrink-0 font-bold text-xs"
                    >
                        Xử lý sự cố ngay &rarr;
                    </button>
                </div>
            )}

            {/* 6 Metric KPI Cards — Exact Admin HIS Dashboard Style */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                {/* 1. Tổng lịch hôm nay */}
                <div className="medpro-card p-4 flex items-center justify-between border-l-4 border-l-[#00B5F1]">
                    <div>
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">TLH — Tổng hẹn</div>
                        <div className="font-display text-2xl font-extrabold text-[#003553] mt-1">
                            {todayAppointmentsCount}
                        </div>
                        <Link to="/reception/appointments" className="text-[11px] font-bold text-[#00B5F1] hover:underline mt-1 inline-block">
                            Chi tiết &rarr;
                        </Link>
                    </div>
                    <div className="w-11 h-11 rounded-full bg-[#E8F4FD] text-[#00B5F1] font-black flex items-center justify-center text-xs border border-[#CBE9FA] shrink-0">
                        TLH
                    </div>
                </div>

                {/* 2. Đã Check-in */}
                <div className="medpro-card p-4 flex items-center justify-between border-l-4 border-l-teal-500">
                    <div>
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">ĐCI — Đã Check-in</div>
                        <div className="font-display text-2xl font-extrabold text-teal-700 mt-1">
                            {checkedInCount}
                        </div>
                        <Link to="/reception/queue" className="text-[11px] font-bold text-teal-700 hover:underline mt-1 inline-block">
                            Chi tiết &rarr;
                        </Link>
                    </div>
                    <div className="w-11 h-11 rounded-full bg-teal-50 text-teal-700 font-black flex items-center justify-center text-xs border border-teal-200 shrink-0">
                        ĐCI
                    </div>
                </div>

                {/* 3. Đang chờ khám */}
                <div className="medpro-card p-4 flex items-center justify-between border-l-4 border-l-amber-500">
                    <div>
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">CK — Chờ khám</div>
                        <div className="font-display text-2xl font-extrabold text-amber-600 mt-1">
                            {waitingCount}
                        </div>
                        <Link to="/reception/queue" className="text-[11px] font-bold text-amber-600 hover:underline mt-1 inline-block">
                            Chi tiết &rarr;
                        </Link>
                    </div>
                    <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-600 font-black flex items-center justify-center text-xs border border-amber-200 shrink-0">
                        CK
                    </div>
                </div>

                {/* 4. Đang trong phòng khám */}
                <div className="medpro-card p-4 flex items-center justify-between border-l-4 border-l-sky-500">
                    <div>
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">ĐK — Đang khám</div>
                        <div className="font-display text-2xl font-extrabold text-sky-600 mt-1">
                            {inConsultationCount}
                        </div>
                        <Link to="/reception/queue" className="text-[11px] font-bold text-sky-600 hover:underline mt-1 inline-block">
                            Chi tiết &rarr;
                        </Link>
                    </div>
                    <div className="w-11 h-11 rounded-full bg-sky-50 text-sky-600 font-black flex items-center justify-center text-xs border border-sky-200 shrink-0">
                        ĐK
                    </div>
                </div>

                {/* 5. Đã hoàn tất */}
                <div className="medpro-card p-4 flex items-center justify-between border-l-4 border-l-emerald-500">
                    <div>
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">KTK — Kết thúc</div>
                        <div className="font-display text-2xl font-extrabold text-emerald-600 mt-1">
                            {completedCount}
                        </div>
                        <Link to="/reception/queue" className="text-[11px] font-bold text-emerald-600 hover:underline mt-1 inline-block">
                            Chi tiết &rarr;
                        </Link>
                    </div>
                    <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 font-black flex items-center justify-center text-xs border border-emerald-200 shrink-0">
                        KTK
                    </div>
                </div>

                {/* 6. Vắng mặt / Hủy / Muộn */}
                <div className="medpro-card p-4 flex items-center justify-between border-l-4 border-l-rose-500">
                    <div>
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">VM — Vắng / Muộn</div>
                        <div className="font-display text-2xl font-extrabold text-rose-600 mt-1">
                            {lateOrNoShowCount}
                        </div>
                        <Link to="/reception/tasks" className="text-[11px] font-bold text-rose-600 hover:underline mt-1 inline-block">
                            Chi tiết &rarr;
                        </Link>
                    </div>
                    <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 font-black flex items-center justify-center text-xs border border-rose-200 shrink-0">
                        VM
                    </div>
                </div>
            </div>

            {/* Room Status / Buồng khám vật lý thời gian thực */}
            {roomStatus.length > 0 && (
                <div className="medpro-card p-4 space-y-3">
                    <div className="medpro-section-title">
                        <span className="inline-flex items-center gap-1.5">
                            <Stethoscope size={16} weight="duotone" className="text-[#00B5F1]" />
                            <span>GIÁM SÁT TẢI TRỌNG CÔNG SUẤT BUỒNG KHÁM VẬT LÝ</span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">Cảnh báo tải theo từng cửa buồng</span>
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
                                            ? 'bg-amber-50/70 border-amber-300 shadow-2xs'
                                            : 'bg-[#F8FCFF] border-[#E2EDF5] hover:border-[#00B5F1]'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-[#003553]">{rm.ten_phong}</span>
                                        {isOverloaded && <WarningCircle size={15} weight="fill" className="text-amber-500" />}
                                    </div>
                                    <div className="text-slate-500 text-[11px] truncate">
                                        BS: {formattedDoc}
                                    </div>
                                    <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60 font-semibold">
                                        <span className="text-slate-500 text-[11px]">Đang chờ:</span>
                                        <span className={isOverloaded ? 'text-amber-700 font-bold' : 'text-[#00B5F1] font-bold'}>
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Hourly Chart */}
                <div className="lg:col-span-2 medpro-card p-4 space-y-3">
                    <div className="medpro-section-title">
                        <span className="inline-flex items-center gap-1.5">
                            <ChartBar size={16} weight="duotone" className="text-[#00B5F1]" />
                            <span>MẬT ĐỘ BỆNH NHÂN CHECK-IN THEO KHUNG GIỜ</span>
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E8F4FD] text-[#003553]">
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
                                        className="w-full max-w-[36px] bg-[#00B5F1] hover:bg-[#009ED4] rounded-t-lg transition-all duration-300 shadow-2xs"
                                    />
                                    <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">{d.hour}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Queue Status Distribution */}
                <div className="medpro-card p-4 space-y-3">
                    <div className="medpro-section-title">
                        <span className="inline-flex items-center gap-1.5">
                            <Pulse size={16} weight="duotone" className="text-[#00B5F1]" />
                            <span>PHÂN BỔ TRẠNG THÁI LƯỢT</span>
                        </span>
                    </div>
                    <div className="space-y-3 text-xs pt-1">
                        <div>
                            <div className="flex justify-between font-semibold mb-1 text-slate-700">
                                <span>Đang chờ ({waitingCount})</span>
                                <span className="font-bold text-amber-600">{Math.round((waitingCount / (checkedInCount || 1)) * 100)}%</span>
                            </div>
                            <Progress percent={Math.round((waitingCount / (checkedInCount || 1)) * 100)} strokeColor="#f59e0b" showInfo={false} size="small" />
                        </div>
                        <div>
                            <div className="flex justify-between font-semibold mb-1 text-slate-700">
                                <span>Đang khám ({inConsultationCount})</span>
                                <span className="font-bold text-sky-600">{Math.round((inConsultationCount / (checkedInCount || 1)) * 100)}%</span>
                            </div>
                            <Progress percent={Math.round((inConsultationCount / (checkedInCount || 1)) * 100)} strokeColor="#00B5F1" showInfo={false} size="small" />
                        </div>
                        <div>
                            <div className="flex justify-between font-semibold mb-1 text-slate-700">
                                <span>Đã hoàn tất ({completedCount})</span>
                                <span className="font-bold text-emerald-600">{Math.round((completedCount / (checkedInCount || 1)) * 100)}%</span>
                            </div>
                            <Progress percent={Math.round((completedCount / (checkedInCount || 1)) * 100)} strokeColor="#10b981" showInfo={false} size="small" />
                        </div>
                        <div>
                            <div className="flex justify-between font-semibold mb-1 text-slate-700">
                                <span>Vãng lai trực tiếp</span>
                                <span className="font-bold text-[#003553]">{shiftSummary?.vang_lai ?? queueEntries.filter((q) => q.isWalkIn).length} ca</span>
                            </div>
                            <Progress
                                percent={Math.round(((shiftSummary?.vang_lai ?? queueEntries.filter((q) => q.isWalkIn).length) / (checkedInCount || 1)) * 100)}
                                strokeColor="#003553"
                                showInfo={false}
                                size="small"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 3 Columns: Upcoming Appointments, Long Waiting, Active Incidents */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 1. Upcoming Appointments */}
                <div className="medpro-card p-4 space-y-3">
                    <div className="medpro-section-title">
                        <span className="inline-flex items-center gap-1.5">
                            <CalendarCheck size={16} weight="duotone" className="text-[#00B5F1]" />
                            <span>BỆNH NHÂN SẮP ĐẾN</span>
                        </span>
                        <Link to="/reception/appointments" className="text-[11px] font-bold text-[#00B5F1] hover:underline">
                            Xem tất cả ({appointments.length})
                        </Link>
                    </div>

                    <div className="space-y-2">
                        {upcomingAppointments.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-xs">Không có lịch hẹn sắp tới</div>
                        ) : (
                            upcomingAppointments.map((app) => {
                                const pat = patients.find((p) => p.id === (app.patientId || app.benh_nhan_id))
                                return (
                                    <div
                                        key={app.id}
                                        onClick={() => setSelectedApp(app)}
                                        className="p-2.5 rounded-xl bg-[#F8FCFF] hover:bg-[#E8F4FD] border border-[#E2EDF5] cursor-pointer transition text-xs space-y-1"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-[#003553]">{app.ten_benh_nhan || pat?.fullName}</span>
                                            <span className="font-bold text-[#00B5F1] bg-[#E8F4FD] border border-[#CBE9FA] px-2 py-0.5 rounded-full text-[10.5px]">
                                                {app.gio_kham || app.timeSlot}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-500 text-[11px]">
                                            <span>Mã: {app.ma_lich_kham || app.appointmentCode || `APT-${app.id}`}</span>
                                            <span className="font-mono">{app.so_dien_thoai || pat?.phone}</span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* 2. Long Waiting Patients */}
                <div className="medpro-card p-4 space-y-3">
                    <div className="medpro-section-title">
                        <div className="flex items-center gap-1.5">
                            <Clock size={16} weight="duotone" className="text-amber-500" />
                            <span>BỆNH NHÂN CHỜ LÂU (&gt;30P)</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
                                {longWaitingList.length} ca
                            </span>
                        </div>
                        <Link to="/reception/queue" className="text-[11px] font-bold text-[#00B5F1] hover:underline">
                            Hàng đợi &rarr;
                        </Link>
                    </div>

                    <div className="space-y-2">
                        {longWaitingList.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-xs">Không có bệnh nhân chờ quá 30 phút</div>
                        ) : (
                            longWaitingList.map((q) => {
                                const pat = patients.find((p) => p.id === q.patientId)
                                const room = rooms.find((r) => r.id === q.roomId)
                                return (
                                    <div
                                        key={q.id}
                                        className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-1"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-[#003553]">
                                                #{q.ticketNumber} - {q.patientName || pat?.fullName}
                                            </span>
                                            <span className="font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full text-[10.5px]">
                                                Chờ {q.waitTimeMinutes}p
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-500 text-[11px]">
                                            <span>{q.roomName || room?.name}</span>
                                            <span className="font-mono">Check-in: {q.checkInTime}</span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* 3. Incidents / Active Tasks */}
                <div className="medpro-card p-4 space-y-3">
                    <div className="medpro-section-title">
                        <div className="flex items-center gap-1.5">
                            <WarningCircle size={16} weight="duotone" className="text-rose-500" />
                            <span>SỰ CỐ CẦN XỬ LÝ</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800">
                                {activeIncidents.length} sự cố
                            </span>
                        </div>
                        <Link to="/reception/tasks" className="text-[11px] font-bold text-rose-600 hover:underline inline-flex items-center gap-0.5">
                            <span>Xử lý</span>
                            <ArrowRight size={11} weight="bold" />
                        </Link>
                    </div>

                    <div className="space-y-2">
                        {activeIncidents.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-xs">Không có sự cố tồn đọng trong ca</div>
                        ) : (
                            activeIncidents.map((inc) => (
                                <div
                                    key={inc.bac_si_id}
                                    className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs space-y-1 hover:border-rose-300 transition"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-900 truncate max-w-[200px]">
                                            BS {inc.ten_bac_si} nghỉ đột xuất
                                        </span>
                                        <span className="medpro-badge-danger text-[10px]">
                                            Khẩn cấp
                                        </span>
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
            <div className="medpro-card p-4 space-y-3">
                <div className="medpro-section-title">
                    <div>
                        <span>HOẠT ĐỘNG GẦN ĐÂY CỦA LỄ TÂN (AUDIT LOGS)</span>
                        <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                            Ghi nhận minh bạch mọi thao tác tiếp nhận, đổi lịch, gọi số và điều phối
                        </div>
                    </div>
                    <Link to="/reception/reports" className="text-[11px] font-bold text-[#00B5F1] hover:underline">
                        Toàn bộ nhật ký &rarr;
                    </Link>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                    {recentLogs.map((log) => (
                        <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2.5">
                                <span className="medpro-badge-info font-mono text-[10.5px]">
                                    {log.actionType}
                                </span>
                                <span className="font-medium text-[#003553]">{log.description}</span>
                            </div>
                            <div className="text-right text-slate-400 text-[11px] shrink-0 font-mono">
                                <span>{log.timestamp}</span>
                                <span className="block font-semibold text-slate-600">{log.actor}</span>
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
                onCheckInClick={(app, patFromModal) => {
                    const matchedPat = patFromModal || patients.find((p) => p.id === (app.patientId || app.benh_nhan_id)) || app.benh_nhan
                    navigate('/reception/check-in', {
                        state: {
                            preselectAppointmentId: app.id || app.ma_lich_kham,
                            appointment: app,
                            patient: matchedPat,
                        },
                    })
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
