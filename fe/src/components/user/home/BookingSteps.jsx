import { CalendarCheck, CheckCircle, Stethoscope } from '../../common/ClinicIcon'

const steps = [
    { icon: Stethoscope, number: '01', title: 'Chọn chuyên khoa hoặc bác sĩ', text: 'Tìm theo nhu cầu sức khỏe và thông tin chuyên môn.' },
    { icon: CalendarCheck, number: '02', title: 'Chọn ngày giờ phù hợp', text: 'Xem chính xác các khung giờ khám còn trống.' },
    { icon: CheckCircle, number: '03', title: 'Xác nhận lịch hẹn', text: 'Nhận thông báo và chủ động theo dõi trạng thái lịch khám.' },
]

export default function BookingSteps() {
    return <section className="bg-[#003553] py-16 md:py-20 text-white"><div className="public-container"><div className="public-section-heading public-section-heading-dark"><span>Quy trình đơn giản</span><h2>Đặt lịch khám trong 3 bước</h2><p>Thông tin rõ ràng, thao tác nhanh chóng và chủ động.</p></div><div className="mt-10 grid md:grid-cols-3 gap-5">{steps.map(({ icon: Icon, ...step }) => <div key={step.number} className="relative rounded-2xl border border-white/15 bg-white/[.07] p-6"><span className="absolute right-5 top-4 font-display text-4xl font-extrabold text-white/10">{step.number}</span><span className="w-12 h-12 rounded-2xl bg-[#00B5F1] flex items-center justify-center"><Icon size={24} weight="duotone" /></span><h3 className="mt-5 font-display text-lg font-bold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-sky-100/80">{step.text}</p></div>)}</div></div></section>
}
