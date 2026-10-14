import { doctors } from '../../../data/user/publicPortalData'
import { CalendarCheck, SealCheck, Star } from '@phosphor-icons/react'

export default function DoctorSection() {
    return (
        <section id="bac-si" className="bg-white py-16 md:py-20 scroll-mt-20">
            <div className="public-container">
                <div className="public-section-heading"><span>Đội ngũ chuyên môn</span><h2>Bác sĩ được bệnh nhân tin tưởng</h2><p>Xem thông tin chuyên môn và chọn lịch khám phù hợp với bạn.</p></div>
                <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {doctors.map((doctor) => <article key={doctor.id} className="medpro-card overflow-hidden">
                        <div className="h-36 bg-[#E8F4FD] flex items-end justify-center pt-5"><div className="w-28 h-28 rounded-t-[48px] bg-white border-8 border-white text-[#00A9E3] flex items-center justify-center font-display text-2xl font-extrabold shadow-sm">{doctor.initials}</div></div>
                        <div className="p-5">
                            <div className="flex items-start gap-1"><h3 className="font-display text-[15px] font-bold text-[#003553] leading-5">{doctor.name}</h3><SealCheck size={17} weight="fill" className="text-[#00B5F1] shrink-0" /></div>
                            <p className="mt-1 text-sm font-semibold text-[#008EC2]">{doctor.specialty}</p>
                            <p className="mt-2 text-xs text-slate-500 flex items-center gap-1"><Star size={14} weight="fill" className="text-[#FFB54A]" />{doctor.experience}</p>
                            <div className="mt-4 pt-4 border-t border-slate-100"><p className="text-[11px] text-slate-400">Lịch gần nhất</p><p className="mt-1 text-xs font-bold text-[#003553] flex items-center gap-1.5"><CalendarCheck size={15} className="text-[#00B5F1]" />{doctor.nextSlot}</p></div>
                            <button className="medpro-btn-primary w-full min-h-10 mt-4">Xem lịch khám</button>
                        </div>
                    </article>)}
                </div>
            </div>
        </section>
    )
}
