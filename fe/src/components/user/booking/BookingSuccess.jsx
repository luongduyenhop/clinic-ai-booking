import { Link } from 'react-router-dom'
import { CalendarCheck, CheckCircle, Clock, Stethoscope } from '../../common/ClinicIcon'

export default function BookingSuccess({ booking, onBookAnother, specialties = [], doctors = [] }) {
    const specialty = specialties.find((item) => item.id === booking.specialtyId)
    const doctor = doctors.find((item) => item.id === booking.doctorId)
    const formattedDate = booking.appointmentDate
        ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${booking.appointmentDate}T00:00:00`))
        : ''

    return (
        <div className="max-w-2xl mx-auto medpro-card overflow-hidden">
            <div className="h-1 bg-clinic-success" aria-hidden="true" />
            <div className="p-6 sm:p-9 text-center">
                <CheckCircle size={56} weight="fill" className="mx-auto text-clinic-success" />
                <div className="mt-3">
                    <span className="medpro-badge-success">Phiếu tiếp nhận hẹn khám đã ghi nhận</span>
                </div>
                <h1 className="mt-3 font-display text-2xl sm:text-3xl font-extrabold text-clinic-navy">
                    Đặt lịch thành công
                </h1>
                <p className="mt-1.5 text-sm text-clinic-text-secondary">
                    Mã hẹn khám ngoại trú của bạn tại quầy tiếp nhận
                </p>

                <div className="mt-4 rounded-[8px] bg-clinic-surface-alt border border-clinic-info-border p-4 font-display text-2xl sm:text-3xl font-extrabold tracking-wider text-clinic-navy tabular-nums">
                    {booking.appointmentCode}
                </div>

                <div className="mt-6 grid sm:grid-cols-2 gap-3 text-left">
                    <Info
                        icon={Stethoscope}
                        label="Chuyên khoa & Bác sĩ"
                        value={`${specialty?.name || booking.specialtyName || 'Chuyên khoa'} · ${doctor?.name || booking.doctorName || 'Bác sĩ phụ trách'}`}
                    />
                    <Info icon={CalendarCheck} label="Ngày khám" value={formattedDate} />
                    <Info icon={Clock} label="Giờ khám" value={booking.timeSlot} />
                    <Info
                        icon={CheckCircle}
                        label="Người khám"
                        value={`${booking.patientName || 'Bệnh nhân'}${booking.patientPhone ? ` · ${booking.patientPhone}` : ''}`}
                    />
                </div>

                <div className="mt-6 rounded-[8px] bg-clinic-warning-bg border border-clinic-warning-border p-4 text-left text-xs leading-5 text-clinic-warning">
                    <strong>Hướng dẫn tiếp nhận:</strong> Vui lòng mang theo mã hẹn và CCCD/VNeID trước giờ khám 15 phút để lễ tân Tầng 1 kích hoạt lượt khám.
                </div>

                <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                    <Link to="/" className="medpro-btn-outline min-h-11 !px-6">
                        Về trang chủ
                    </Link>
                    <button type="button" onClick={onBookAnother} className="medpro-btn-primary min-h-11 !px-6">
                        Đặt lịch khác
                    </button>
                </div>
            </div>
        </div>
    )
}

function Info({ icon: Icon, label, value }) {
    return (
        <div className="rounded-[8px] border border-clinic-border bg-clinic-bg p-3.5 flex gap-3 items-start">
            <Icon size={19} weight="duotone" className="text-clinic-cta shrink-0 mt-0.5" />
            <span className="min-w-0">
                <small className="block text-xs text-clinic-text-muted">{label}</small>
                <strong className="block mt-1 text-xs font-bold leading-5 text-clinic-navy tabular-nums">{value}</strong>
            </span>
        </div>
    )
}
