import { Link } from 'react-router-dom'
import { CalendarCheck, Clock, Stethoscope } from '../../common/ClinicIcon'

const STATUS = {
    PENDING: ['Chờ xác nhận', 'medpro-badge-warning'],
    CONFIRMED: ['Đã xác nhận', 'medpro-badge-success'],
    COMPLETED: ['Đã khám', 'medpro-badge-info'],
    CANCELLED: ['Đã hủy', 'medpro-badge-danger'],
}

const formatDate = (value) =>
    new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`))

export default function AppointmentCard({ appointment }) {
    const status = STATUS[appointment.status] || [appointment.status, 'medpro-badge-neutral']
    return (
        <article className="medpro-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="font-mono text-[11px] font-bold text-clinic-cta tabular-nums">
                        {appointment.appointmentCode}
                    </p>
                    <h2 className="mt-1 font-display text-base font-bold text-clinic-navy">
                        {appointment.specialtyName}
                    </h2>
                </div>
                <span className={status[1]}>{status[0]}</span>
            </div>
            <div className="mt-4 grid gap-2 text-xs text-clinic-text-secondary sm:grid-cols-2">
                <p className="flex items-center gap-2">
                    <Stethoscope size={17} className="text-clinic-cta shrink-0" />
                    <span>{appointment.doctorName}</span>
                </p>
                <p className="flex items-center gap-2 tabular-nums">
                    <CalendarCheck size={17} className="text-clinic-cta shrink-0" />
                    <span>{formatDate(appointment.appointmentDate)}</span>
                </p>
                <p className="flex items-center gap-2 tabular-nums">
                    <Clock size={17} className="text-clinic-cta shrink-0" />
                    <span>{appointment.timeSlot}</span>
                </p>
                <p className="truncate">
                    Lý do: {appointment.reason || appointment.patient?.reason || 'Khám theo lịch hẹn'}
                </p>
            </div>
            {appointment.status === 'CANCELLED' && (
                <Link
                    to="/dat-lich"
                    className="mt-4 inline-flex text-xs font-bold text-clinic-cta hover:underline"
                >
                    Đặt lại lịch
                </Link>
            )}
        </article>
    )
}
