import { Link } from 'react-router-dom'
import { ClinicIcon, ArrowRight } from '../../common/ClinicIcon'
import { quickActions } from '../../../data/user/publicPortalData'

export default function QuickActions() {
    return (
        <section className="public-container -mt-3 relative z-10 pb-16">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {quickActions.map((item) => {
                    const Tag = item.href.startsWith('/') ? Link : 'a'
                    return (
                        <Tag
                            key={item.title}
                            to={item.href.startsWith('/') ? item.href : undefined}
                            href={!item.href.startsWith('/') ? item.href : undefined}
                            className="medpro-card p-5 group hover:border-clinic-cta transition-colors duration-150"
                        >
                            <span className="w-11 h-11 rounded-[8px] bg-clinic-surface-alt text-clinic-cta flex items-center justify-center">
                                <ClinicIcon name={item.icon} size={22} weight="duotone" />
                            </span>
                            <h2 className="mt-4 font-display text-base font-bold text-clinic-navy">{item.title}</h2>
                            <p className="mt-1.5 min-h-10 text-sm leading-5 text-clinic-text-secondary">{item.description}</p>
                            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-clinic-cta">
                                <span>Xem chi tiết</span>
                                <ArrowRight size={13} />
                            </span>
                        </Tag>
                    )
                })}
            </div>
        </section>
    )
}
