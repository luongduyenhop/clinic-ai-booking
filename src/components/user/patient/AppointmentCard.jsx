import { Link } from 'react-router-dom'
import { CalendarCheck, Clock, Stethoscope } from '../../common/ClinicIcon'

const STATUS = { PENDING: ['Chờ xác nhận', 'bg-amber-50 text-amber-700 border-amber-200'], CONFIRMED: ['Đã xác nhận', 'bg-emerald-50 text-emerald-700 border-emerald-200'], COMPLETED: ['Đã khám', 'bg-sky-50 text-sky-700 border-sky-200'], CANCELLED: ['Đã hủy', 'bg-rose-50 text-rose-700 border-rose-200'] }
const formatDate = (value) => new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`))

export default function AppointmentCard({ appointment }) {
    const status = STATUS[appointment.status] || [appointment.status, 'bg-slate-50 text-slate-600 border-slate-200']
    return <article className="medpro-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[11px] font-bold text-[#008EC2]">{appointment.appointmentCode}</p><h2 className="mt-1 font-display text-base font-bold text-[#003553]">{appointment.specialtyName}</h2></div><span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${status[1]}`}>{status[0]}</span></div><div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2"><p className="flex items-center gap-2"><Stethoscope size={17} className="text-[#00B5F1]"/>{appointment.doctorName}</p><p className="flex items-center gap-2"><CalendarCheck size={17} className="text-[#00B5F1]"/>{formatDate(appointment.appointmentDate)}</p><p className="flex items-center gap-2"><Clock size={17} className="text-[#00B5F1]"/>{appointment.timeSlot}</p><p className="truncate">Lý do: {appointment.reason || appointment.patient?.reason || 'Khám theo lịch hẹn'}</p></div>{appointment.status === 'CANCELLED' && <Link to={`/dat-lich?specialty=${appointment.specialtyId}&doctor=${appointment.doctorId}`} className="mt-4 inline-flex text-xs font-bold text-[#008EC2] hover:underline">Đặt lại lịch</Link>}</article>
}
