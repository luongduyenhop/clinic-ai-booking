import { CalendarCheck, Clock, Stethoscope, UserCheck } from '../../common/ClinicIcon'
import { formatConsultFee, formatVietnameseDateLabel } from '../../../utils/helpers/quickBookingHelpers'

export default function BookingSummary({ booking, specialties = [], doctors = [] }) {
    const specialty = specialties.find((item) => item.id === booking.specialtyId)
    const doctor = doctors.find((item) => item.id === booking.doctorId)
    const formattedDate = booking.appointmentDate
        ? formatVietnameseDateLabel(booking.appointmentDate) || booking.appointmentDate
        : 'Chưa chọn'

    return (
        <aside className="medpro-card p-5 lg:sticky lg:top-24">
            <h2 className="font-display text-base font-bold text-clinic-navy pb-3 border-b border-clinic-border">
                Thông tin lịch khám
            </h2>
            <div className="mt-4 space-y-3.5 text-sm">
                <Summary icon={Stethoscope} label="Chuyên khoa" value={specialty?.name || 'Chưa chọn'} />
                <Summary icon={UserCheck} label="Bác sĩ" value={doctor?.name || 'Chưa chọn'} />
                <Summary icon={CalendarCheck} label="Ngày khám" value={formattedDate} />
                <Summary icon={Clock} label="Giờ khám" value={booking.timeSlot || 'Chưa chọn'} />
            </div>
            {specialty && (
                <div className="mt-5 pt-4 border-t border-clinic-border flex items-center justify-between">
                    <span className="text-xs text-clinic-text-secondary">Phí khám niêm yết</span>
                    <strong className="text-clinic-navy tabular-nums">{formatConsultFee(doctor?.fee)}</strong>
                </div>
            )}
            <p className="mt-4 rounded-[8px] border border-clinic-info-border bg-clinic-surface-alt p-3 text-[11.5px] leading-5 text-clinic-navy">
                Phòng khám sẽ giữ khung giờ và kích hoạt tiếp nhận ưu tiên. Vui lòng có mặt trước giờ hẹn 15 phút.
            </p>
        </aside>
    )
}

function Summary({ icon: Icon, label, value }) {
    return (
        <div className="flex gap-3 items-start">
            <span className="w-9 h-9 rounded-[8px] bg-clinic-surface-alt border border-clinic-info-border text-clinic-cta flex items-center justify-center shrink-0">
                <Icon size={17} weight="duotone" />
            </span>
            <span className="min-w-0">
                <small className="block text-xs text-clinic-text-muted">{label}</small>
                <strong className="block mt-0.5 text-xs font-bold text-clinic-navy tabular-nums">{value}</strong>
            </span>
        </div>
    )
}
