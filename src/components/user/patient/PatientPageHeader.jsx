export default function PatientPageHeader({ eyebrow = 'Cổng bệnh nhân', title, description, action }) {
    return <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><span className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[#008EC2]">{eyebrow}</span><h1 className="mt-1 font-display text-2xl font-extrabold text-[#003553] sm:text-3xl">{title}</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p></div>{action}</header>
}
