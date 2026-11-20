import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { Progress } from 'antd'
import AppointmentFormModal from '../../components/reception/AppointmentFormModal'
import AppointmentDetailModal from '../../components/reception/AppointmentDetailModal'
import CloseShiftModal from '../../components/reception/CloseShiftModal'
import { APPOINTMENT_STATUS, QUEUE_STATUS } from '../../utils/constants/receptionConstants'
import { formatDoctorName } from '../../utils/doctorHelper'
import {
    fetchShiftDashboardAsync,
    fetchDoctorAbsencesAsync,
} from '../../redux/actions/reception/receptionAction'
import { isIncidentResolved } from '../../redux/slices/reception/receptionSlice'
import {
    ClipboardText,
    CalendarCheck,
    CalendarPlus,
    UserList,
    Stethoscope,
    LockKey,
    WarningCircle,
    Clock,
    ChartBar,
    Pulse,
} from '../../components/common/ClinicIcon'

const isDemoRoomRecord = (rm) => {
    const label = `${rm?.ten_phong || ''} ${rm?.ma_phong || ''} ${rm?.ten_bac_si || ''}`
    return /\(demo\)|demo_/i.test(label)
}

const hasAssignedDoctor = (rm) => {
    const doc = String(rm?.ten_bac_si || '').trim()
    return Boolean(doc) && !/chưa gán/i.test(doc)
}

export default function ReceptionDashboardPage() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const {
        appointments = [],
        queueEntries = [],
        shiftSummary,
        roomStatus = [],
        doctorAbsences = [],
        resolvedIncidentKeys = [],
        auditLogs = [],
        patients = [],
        rooms = [],
    } = useSelector((state) => state.reception)

    const [isCreateAppOpen, setIsCreateAppOpen] = useState(false)
    const [selectedApp, setSelectedApp] = useState(null)
    const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false)
    const [showAllRooms, setShowAllRooms] = useState(false)
    const [scopeMode, setScopeMode] = useState('all')
    const [currentHour] = useState(() => new Date().getHours())
    const currentShiftCode = currentHour >= 12 ? 'chieu' : 'sang'
    const currentShiftLabel = currentHour >= 12 ? 'Ca chiều (13:00 - 17:30)' : 'Ca sáng (07:30 - 12:00)'
    const activeCaKham = scopeMode === 'all' ? 'all' : currentShiftCode
    const headerScopeLabel = scopeMode === 'all' ? 'Cả ngày (07:30 – 17:30)' : currentShiftLabel

    useEffect(() => {
        dispatch(fetchShiftDashboardAsync({ caKham: activeCaKham }))
        dispatch(fetchDoctorAbsencesAsync())
    }, [dispatch, activeCaKham])

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

    const upcomingAppointments = shiftSummary?.lich_hen_sap_toi?.length > 0
        ? shiftSummary.lich_hen_sap_toi
        : appointments
            .filter((a) => a.status === APPOINTMENT_STATUS.BOOKED || a.status === APPOINTMENT_STATUS.CONFIRMED || a.status === 'da_xac_nhan')
            .slice(0, 5)

    const apiLongWaiting = (shiftSummary?.benh_nhan_cho_lau || [])
        .map((item) => ({
            id: item.ticket_id,
            ticketNumber: item.ma_so_thu_tu,
            patientName: item.ten_benh_nhan,
            waitTimeMinutes: Number(item.thoi_gian_cho_phut) || 0,
            roomName: item.ten_phong || item.ma_phong || 'Phòng khám',
            checkInTime: item.thoi_gian_check_in,
        }))
        .filter((q) => q.waitTimeMinutes > 30)

    const fallbackLongWaiting = queueEntries
        .filter((q) => (q.status === QUEUE_STATUS.WAITING || q.status === 'cho_kham') && Number(q.waitTimeMinutes || 0) > 30)
        .map((q) => ({
            id: q.id,
            ticketNumber: q.ticketNumber || q.ma_so_thu_tu,
            patientName: q.patientName || q.ten_benh_nhan,
            waitTimeMinutes: Number(q.waitTimeMinutes || 0),
            roomName: q.roomName || q.phong_kham || 'Phòng khám',
            checkInTime: q.checkInTime || q.thoi_gian_check_in,
        }))

    const longWaitingList = (apiLongWaiting.length > 0 ? apiLongWaiting : fallbackLongWaiting)
        .sort((a, b) => b.waitTimeMinutes - a.waitTimeMinutes)
        .slice(0, 5)

    const unresolvedIncidents = doctorAbsences.filter((inc) => !isIncidentResolved(inc, resolvedIncidentKeys))
    const activeIncidents = unresolvedIncidents.slice(0, 4)

    const realRoomStatus = roomStatus.filter((rm) => !isDemoRoomRecord(rm))
    const sanitizedRoomStatus = realRoomStatus.length > 0 ? realRoomStatus : roomStatus
    const assignedRooms = sanitizedRoomStatus.filter((rm) => hasAssignedDoctor(rm))
    const unassignedRooms = sanitizedRoomStatus.filter((rm) => !hasAssignedDoctor(rm))
    const visibleRoomCards =
        showAllRooms || assignedRooms.length === 0
            ? [...assignedRooms, ...unassignedRooms]
            : assignedRooms

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

    const ledgerColumns = [
        {
            label: 'Lịch hẹn hôm nay',
            value: todayAppointmentsCount,
            tone: 'text-clinic-navy',
            to: '/reception/appointments',
            linkText: 'Xem lịch hẹn',
        },
        {
            label: 'Đã check-in',
            value: checkedInCount,
            tone: 'text-clinic-navy',
            to: '/reception/queue',
            linkText: 'Vào hàng đợi',
        },
        {
            label: 'Đang chờ khám',
            value: waitingCount,
            tone: waitingCount > 0 ? 'text-clinic-warning' : 'text-clinic-navy',
            to: '/reception/queue',
            linkText: 'Vào hàng đợi',
        },
        {
            label: 'Đang khám',
            value: inConsultationCount,
            tone: 'text-clinic-cta',
        },
        {
            label: 'Đã hoàn tất',
            value: completedCount,
            tone: 'text-clinic-success',
        },
        {
            label: 'Vắng / Trễ hẹn',
            value: lateOrNoShowCount,
            tone: lateOrNoShowCount > 0 ? 'text-clinic-danger' : 'text-clinic-navy',
        },
    ]

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-clinic-surface border border-clinic-border rounded-[6px] px-4 py-3">
                <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <h1 className="font-display text-base sm:text-lg font-extrabold text-clinic-navy tracking-tight">
                        Điều phối tiếp đón và luồng khám
                    </h1>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-clinic-bg border border-clinic-border text-[11px] font-semibold text-clinic-text-secondary tabular-nums">
                        <span className="w-1.5 h-1.5 rounded-full bg-clinic-success" />
                        <span>{headerScopeLabel}</span>
                    </span>
                    <div className="inline-flex items-center rounded-[6px] border border-clinic-border bg-clinic-bg p-0.5 text-xs">
                        <button
                            type="button"
                            onClick={() => setScopeMode('all')}
                            className={`px-2.5 py-1 rounded-[4px] font-semibold transition-colors cursor-pointer ${
                                scopeMode === 'all'
                                    ? 'bg-clinic-navy text-clinic-surface'
                                    : 'text-clinic-text-secondary hover:text-clinic-navy'
                            }`}
                        >
                            Cả ngày
                        </button>
                        <button
                            type="button"
                            onClick={() => setScopeMode('current')}
                            className={`px-2.5 py-1 rounded-[4px] font-semibold transition-colors cursor-pointer ${
                                scopeMode === 'current'
                                    ? 'bg-clinic-navy text-clinic-surface'
                                    : 'text-clinic-text-secondary hover:text-clinic-navy'
                            }`}
                        >
                            Ca này
                        </button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link
                        to="/reception/check-in"
                        className="medpro-btn-primary rounded-[6px] text-xs inline-flex items-center gap-1.5"
                    >
                        <ClipboardText size={15} weight="bold" />
                        <span>Tiếp nhận (F2)</span>
                    </Link>
                    <Link
                        to="/reception/queue"
                        className="medpro-btn-outline rounded-[6px] text-xs inline-flex items-center gap-1.5"
                    >
                        <UserList size={15} weight="bold" className="text-clinic-cta" />
                        <span>Hàng đợi (F4)</span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => setIsCreateAppOpen(true)}
                        className="medpro-btn-outline rounded-[6px] text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                        <CalendarPlus size={15} weight="bold" className="text-clinic-navy" />
                        <span>Đặt lịch</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsCloseShiftOpen(true)}
                        className="medpro-btn-danger rounded-[6px] text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                        <LockKey size={14} weight="bold" />
                        <span>Đóng ca trực</span>
                    </button>
                </div>
            </div>

            <div className="medpro-card grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-clinic-border tabular-nums overflow-hidden">
                {ledgerColumns.map((col) => (
                    <div key={col.label} className="p-3.5 flex flex-col justify-between bg-clinic-surface">
                        <div className="text-xs font-semibold text-clinic-text-secondary">{col.label}</div>
                        <div className="flex items-baseline justify-between gap-2 mt-1.5">
                            <span className={`font-display text-2xl font-extrabold ${col.tone}`}>
                                {col.value}
                            </span>
                            {col.to && (
                                <Link to={col.to} className="text-[11px] font-semibold text-clinic-cta hover:underline shrink-0">
                                    {col.linkText}
                                </Link>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {activeIncidents.length > 0 && (
                <div className="rounded-[6px] border border-clinic-danger-border bg-clinic-danger-bg p-3.5 flex items-center justify-between gap-3 text-clinic-danger">
                    <div className="flex items-center gap-3">
                        <WarningCircle size={20} weight="fill" className="text-clinic-danger shrink-0" />
                        <div>
                            <div className="text-sm font-bold text-clinic-danger">Cảnh báo sự cố ca trực: Bác sĩ vắng mặt đột xuất</div>
                            <div className="text-xs text-clinic-danger tabular-nums">Đang có {unresolvedIncidents.length} bác sĩ nghỉ đột xuất cần điều chuyển bệnh nhân sang buồng khám khác.</div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/reception/tasks')}
                        className="medpro-btn-danger rounded-[6px] shrink-0 font-bold text-xs cursor-pointer"
                    >
                        Xử lý sự cố ngay
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <div className="lg:col-span-7 medpro-card p-4 space-y-3">
                    <div className="medpro-section-title">
                        <span className="inline-flex items-center gap-1.5">
                            <Stethoscope size={16} weight="duotone" className="text-clinic-cta" />
                            <span>Trực ban Buồng khám Lâm sàng ({visibleRoomCards.length})</span>
                        </span>
                        {unassignedRooms.length > 0 && assignedRooms.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowAllRooms((prev) => !prev)}
                                className="text-[11px] font-bold text-clinic-cta hover:underline cursor-pointer"
                            >
                                {showAllRooms
                                    ? 'Thu gọn buồng trống'
                                    : `Hiện thêm ${unassignedRooms.length} buồng kỹ thuật / chưa gán BS`}
                            </button>
                        )}
                    </div>

                    {visibleRoomCards.length === 0 ? (
                        <div className="text-center py-8 text-xs text-clinic-text-muted border border-clinic-border rounded-[6px] bg-clinic-bg">
                            Chưa có dữ liệu phân công buồng khám trong ca.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                            {visibleRoomCards.map((rm) => {
                                const waiting = rm.so_benh_nhan_cho ?? rm.so_nguoi_cho ?? 0
                                const isOverloaded = waiting > 5
                                const formattedDoc = rm.ten_bac_si ? formatDoctorName(rm.ten_bac_si) : 'Chưa gán'
                                return (
                                    <div
                                        key={rm.phong_kham_id || rm.ten_phong}
                                        className={`p-3 rounded-[6px] border text-xs flex flex-col justify-between gap-2 transition-colors ${
                                            isOverloaded
                                                ? 'bg-clinic-warning-bg border-clinic-warning-border'
                                                : 'bg-clinic-surface-tint border-clinic-border hover:border-clinic-cta'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex justify-between items-start gap-1.5">
                                                <span className="font-bold text-clinic-navy leading-snug">{rm.ten_phong}</span>
                                                {isOverloaded && <WarningCircle size={15} weight="fill" className="text-clinic-warning shrink-0" />}
                                            </div>
                                            <div className="text-clinic-text-secondary text-[11px] truncate mt-0.5">
                                                {formattedDoc}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-1.5 border-t border-clinic-border font-semibold tabular-nums">
                                            <span className="text-clinic-text-secondary text-[11px]">Đang chờ</span>
                                            <span className={isOverloaded ? 'text-clinic-warning font-bold' : 'text-clinic-navy font-bold'}>
                                                {waiting} BN
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="lg:col-span-5 space-y-4">
                    <div className="medpro-card p-4 space-y-3">
                        <div className="medpro-section-title">
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarCheck size={16} weight="duotone" className="text-clinic-cta" />
                                <span>Bệnh nhân sắp đến</span>
                            </span>
                            <Link to="/reception/appointments" className="text-[11px] font-bold text-clinic-cta hover:underline tabular-nums">
                                Xem tất cả ({appointments.length})
                            </Link>
                        </div>

                        <div className="divide-y divide-clinic-border border border-clinic-border rounded-[6px] bg-clinic-surface overflow-hidden">
                            {upcomingAppointments.length === 0 ? (
                                <div className="text-center py-5 text-clinic-text-muted text-xs">Không có lịch hẹn sắp tới</div>
                            ) : (
                                upcomingAppointments.map((app) => {
                                    const pat = patients.find((p) => p.id === (app.patientId || app.benh_nhan_id))
                                    return (
                                        <button
                                            key={app.id}
                                            type="button"
                                            onClick={() => setSelectedApp(app)}
                                            className="w-full text-left p-2.5 bg-clinic-surface hover:bg-clinic-surface-tint cursor-pointer transition text-xs space-y-1 block"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-clinic-navy">{app.ten_benh_nhan || pat?.fullName}</span>
                                                <span className="medpro-badge-info text-[10.5px] font-bold tabular-nums">
                                                    {app.gio_kham || app.timeSlot}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-clinic-text-secondary text-[11px] tabular-nums">
                                                <span>Mã: {app.ma_lich_kham || app.appointmentCode || `APT-${app.id}`}</span>
                                                <span className="font-mono">{app.so_dien_thoai || pat?.phone}</span>
                                            </div>
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    <div className="medpro-card p-4 space-y-3">
                        <div className="medpro-section-title">
                            <div className="flex items-center gap-1.5">
                                <Clock size={16} weight="duotone" className="text-clinic-warning" />
                                <span>Chờ lâu (&gt;30p) và sự cố ca trực</span>
                            </div>
                            <Link to="/reception/queue" className="text-[11px] font-bold text-clinic-cta hover:underline">
                                Vào hàng đợi
                            </Link>
                        </div>

                        {activeIncidents.length > 0 && (
                            <div className="space-y-2">
                                {activeIncidents.map((inc) => (
                                    <div
                                        key={inc.bac_si_id}
                                        className="p-2.5 rounded-[6px] bg-clinic-danger-bg border border-clinic-danger-border text-xs space-y-1"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-clinic-navy truncate">
                                                BS {inc.ten_bac_si} nghỉ đột xuất
                                            </span>
                                            <Link to="/reception/tasks" className="text-[11px] font-bold text-clinic-danger hover:underline shrink-0">
                                                Điều chuyển
                                            </Link>
                                        </div>
                                        <p className="text-clinic-danger text-[11px] tabular-nums">
                                            Khoa: {inc.ten_chuyen_khoa} · {inc.so_benh_nhan_bi_anh_huong || 0} bệnh nhân cần chuyển
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {longWaitingList.length === 0 && activeIncidents.length === 0 ? (
                            <div className="text-center py-5 text-clinic-text-muted text-xs">
                                Không có bệnh nhân chờ quá 30 phút hoặc sự cố tồn đọng
                            </div>
                        ) : (
                            longWaitingList.length > 0 && (
                                <div className="space-y-2">
                                    {longWaitingList.map((q) => {
                                        const pat = patients.find((p) => p.id === q.patientId)
                                        const room = rooms.find((r) => r.id === q.roomId)
                                        return (
                                            <div
                                                key={q.id}
                                                className="p-2.5 rounded-[6px] bg-clinic-warning-bg border border-clinic-warning-border text-xs space-y-1 tabular-nums"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-clinic-navy">
                                                        #{q.ticketNumber} - {q.patientName || pat?.fullName}
                                                    </span>
                                                    <span className="medpro-badge-warning font-bold text-[10.5px]">
                                                        Chờ {q.waitTimeMinutes}p
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-clinic-text-secondary text-[11px]">
                                                    <span>{q.roomName || room?.name}</span>
                                                    <span className="font-mono">Check-in: {q.checkInTime}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-5 medpro-card p-4 space-y-3">
                    <div className="medpro-section-title">
                        <span className="inline-flex items-center gap-1.5">
                            <ChartBar size={16} weight="duotone" className="text-clinic-cta" />
                            <span>Mật độ check-in theo khung giờ</span>
                        </span>
                        <span className="medpro-badge-info text-[11px] font-bold">
                            Hôm nay
                        </span>
                    </div>

                    <div className="h-44 flex items-end justify-between gap-2 pt-6 px-2 border-b border-clinic-border tabular-nums">
                        {hourlyData.map((d, i) => {
                            const heightPct = Math.round((d.count / maxHourCount) * 100)
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                                    <span className="text-[11px] font-bold text-clinic-navy opacity-0 group-hover:opacity-100 transition-opacity">
                                        {d.count} BN
                                    </span>
                                    <div
                                        style={{ height: `${Math.max(heightPct, 6)}%` }}
                                        className="w-full max-w-[32px] bg-clinic-cta hover:bg-clinic-cta-hover rounded-t-[4px] transition-colors"
                                    />
                                    <span className="text-[11px] font-medium text-clinic-text-secondary whitespace-nowrap">{d.hour}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="lg:col-span-3 medpro-card p-4 space-y-3">
                    <div className="medpro-section-title">
                        <span className="inline-flex items-center gap-1.5">
                            <Pulse size={16} weight="duotone" className="text-clinic-cta" />
                            <span>Phân bổ trạng thái</span>
                        </span>
                    </div>
                    <div className="space-y-3 text-xs pt-1 tabular-nums">
                        <div>
                            <div className="flex justify-between font-semibold mb-1 text-clinic-text">
                                <span>Đang chờ ({waitingCount})</span>
                                <span className="font-bold text-clinic-warning">{Math.round((waitingCount / (checkedInCount || 1)) * 100)}%</span>
                            </div>
                            <Progress percent={Math.round((waitingCount / (checkedInCount || 1)) * 100)} strokeColor="var(--color-clinic-warning)" showInfo={false} size="small" />
                        </div>
                        <div>
                            <div className="flex justify-between font-semibold mb-1 text-clinic-text">
                                <span>Đang khám ({inConsultationCount})</span>
                                <span className="font-bold text-clinic-cta">{Math.round((inConsultationCount / (checkedInCount || 1)) * 100)}%</span>
                            </div>
                            <Progress percent={Math.round((inConsultationCount / (checkedInCount || 1)) * 100)} strokeColor="var(--color-clinic-cta)" showInfo={false} size="small" />
                        </div>
                        <div>
                            <div className="flex justify-between font-semibold mb-1 text-clinic-text">
                                <span>Đã hoàn tất ({completedCount})</span>
                                <span className="font-bold text-clinic-success">{Math.round((completedCount / (checkedInCount || 1)) * 100)}%</span>
                            </div>
                            <Progress percent={Math.round((completedCount / (checkedInCount || 1)) * 100)} strokeColor="var(--color-clinic-success)" showInfo={false} size="small" />
                        </div>
                        <div>
                            <div className="flex justify-between font-semibold mb-1 text-clinic-text">
                                <span>Vãng lai trực tiếp</span>
                                <span className="font-bold text-clinic-navy">{shiftSummary?.vang_lai ?? queueEntries.filter((q) => q.isWalkIn).length} ca</span>
                            </div>
                            <Progress
                                percent={Math.round(((shiftSummary?.vang_lai ?? queueEntries.filter((q) => q.isWalkIn).length) / (checkedInCount || 1)) * 100)}
                                strokeColor="var(--color-clinic-navy)"
                                showInfo={false}
                                size="small"
                            />
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 medpro-card p-4 space-y-3">
                    <div className="medpro-section-title">
                        <span>Nhật ký thao tác lễ tân</span>
                        <Link to="/reception/reports" className="text-[11px] font-bold text-clinic-cta hover:underline">
                            Toàn bộ nhật ký
                        </Link>
                    </div>

                    {recentLogs.length === 0 ? (
                        <div className="text-center py-8 text-xs text-clinic-text-muted">
                            Chưa có thao tác nào được ghi nhận trong ca.
                        </div>
                    ) : (
                        <div className="divide-y divide-clinic-border text-xs">
                            {recentLogs.map((log) => (
                                <div key={log.id} className="py-2 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <span className="medpro-badge-info font-mono text-[10px]">
                                            {log.actionType}
                                        </span>
                                        <p className="font-medium text-clinic-navy mt-1 leading-snug">{log.description}</p>
                                    </div>
                                    <div className="text-right text-clinic-text-secondary text-[10.5px] shrink-0 font-mono tabular-nums">
                                        <span>{log.timestamp}</span>
                                        <span className="block font-semibold text-clinic-text">{log.actor}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

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
                    dispatch(fetchShiftDashboardAsync({ caKham: activeCaKham }))
                }}
            />
        </div>
    )
}
