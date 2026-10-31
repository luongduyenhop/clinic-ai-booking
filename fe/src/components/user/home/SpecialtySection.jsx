import { specialties } from '../../../data/user/publicPortalData'
import { ClinicIcon, ArrowRight } from '../../common/ClinicIcon'

export default function SpecialtySection() {
    return (
        <section id="chuyen-khoa" className="bg-[#F7FBFE] py-16 md:py-20 scroll-mt-20">
            <div className="public-container">
                <div className="public-section-heading"><span>Chuyên khoa nổi bật</span><h2>Chọn đúng chuyên khoa cho nhu cầu của bạn</h2><p>Đội ngũ bác sĩ giàu kinh nghiệm cùng quy trình thăm khám rõ ràng.</p></div>
                <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {specialties.map((item) => <a href={`/dat-lich?specialty=${item.id}`} key={item.id} className="medpro-card p-5 text-center group hover:border-[#00B5F1] transition">
                        <span className="mx-auto w-14 h-14 rounded-2xl bg-[#E8F4FD] text-[#00A9E3] flex items-center justify-center group-hover:bg-[#00B5F1] group-hover:text-white transition"><ClinicIcon name={item.icon} size={28} weight="duotone" /></span>
                        <h3 className="mt-4 font-display text-base font-bold text-[#003553]">{item.name}</h3>
                        <p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>
                        <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#00A9E3]">{item.doctorCount} bác sĩ <ArrowRight size={13} /></span>
                    </a>)}
                </div>
            </div>
        </section>
    )
}
