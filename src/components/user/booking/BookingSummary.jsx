import { CalendarCheck, Clock, Stethoscope, UserCheck } from '../../common/ClinicIcon'
import { doctors, specialties } from '../../../data/user/publicPortalData'

export default function BookingSummary({ booking }) {
    const specialty = specialties.find((item) => item.id === booking.specialtyId)
    const doctor = doctors.find((item) => item.id === booking.doctorId)
    return <aside className="medpro-card p-5 lg:sticky lg:top-24"><h2 className="font-display text-base font-bold text-[#003553]">Thông tin lịch khám</h2><div className="mt-5 space-y-4 text-sm"><Summary icon={Stethoscope} label="Chuyên khoa" value={specialty?.name || 'Chưa chọn'}/><Summary icon={UserCheck} label="Bác sĩ" value={doctor?.name || 'Chưa chọn'}/><Summary icon={CalendarCheck} label="Ngày khám" value={booking.appointmentDate ? formatDate(booking.appointmentDate) : 'Chưa chọn'}/><Summary icon={Clock} label="Giờ khám" value={booking.timeSlot || 'Chưa chọn'}/></div>{specialty && <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between"><span className="text-xs text-slate-500">Phí khám dự kiến</span><strong className="text-[#003553]">{specialty.fee.toLocaleString('vi-VN')}đ</strong></div>}<p className="mt-4 rounded-lg bg-[#E8F4FD] p-3 text-[11px] leading-5 text-[#36566B]">Phòng khám sẽ liên hệ xác nhận. Vui lòng đến trước giờ hẹn 15 phút.</p></aside>
}

function Summary({ icon: Icon, label, value }) { return <div className="flex gap-3"><span className="w-9 h-9 rounded-lg bg-[#E8F4FD] text-[#00A9E3] flex items-center justify-center shrink-0"><Icon size={18} weight="duotone"/></span><span><small className="block text-slate-400">{label}</small><strong className="block mt-0.5 text-xs text-[#003553]">{value}</strong></span></div> }
function formatDate(value) { return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) }
