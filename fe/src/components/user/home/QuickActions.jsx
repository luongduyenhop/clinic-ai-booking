import { Link } from 'react-router-dom'
import { ClinicIcon, ArrowRight } from '../../common/ClinicIcon'
import { quickActions } from '../../../data/user/publicPortalData'

export default function QuickActions() {
    return (
        <section className="public-container -mt-3 relative z-10 pb-16">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {quickActions.map((item) => {
                    const Tag = item.href.startsWith('/') ? Link : 'a'
                    return <Tag key={item.title} to={item.href.startsWith('/') ? item.href : undefined} href={!item.href.startsWith('/') ? item.href : undefined} className="medpro-card p-5 group hover:-translate-y-1 hover:border-[#8DDBF7] transition-all duration-200">
                        <span className="w-12 h-12 rounded-2xl bg-[#E8F4FD] text-[#00A9E3] flex items-center justify-center"><ClinicIcon name={item.icon} size={24} weight="duotone" /></span>
                        <h2 className="mt-4 font-display text-base font-bold text-[#003553]">{item.title}</h2>
                        <p className="mt-1.5 min-h-10 text-sm leading-5 text-slate-500">{item.description}</p>
                        <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#00A9E3]">Khám phá <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" /></span>
                    </Tag>
                })}
            </div>
        </section>
    )
}
