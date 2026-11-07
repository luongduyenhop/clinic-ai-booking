import { ClinicIcon } from '../../common/ClinicIcon'
import { EXAM_STEPS } from './examHelpers'

export default function ExamStepTabs({ step, locked, onChange, counts = {} }) {
    const stepBadges = [
        null,
        counts.cls > 0 ? `${counts.cls} chỉ định` : null,
        counts.diagnosis > 0 ? `${counts.diagnosis} mã bệnh` : null,
        counts.rx > 0 ? `${counts.rx} thuốc` : null,
    ]

    return (
        <nav aria-label="Các bước khám" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {EXAM_STEPS.map((label, i) => {
                const n = i + 1
                const active = n === step
                const done = locked || n < step
                const badge = stepBadges[i]
                return (
                    <button
                        key={label}
                        type="button"
                        aria-current={active ? 'step' : undefined}
                        onClick={() => onChange(n)}
                        className={`flex items-center justify-between min-h-[50px] rounded-2xl px-3.5 py-2.5 text-left transition cursor-pointer select-none ${
                            active
                                ? 'bg-[#003553] text-white shadow-md shadow-slate-900/15'
                                : 'bg-white text-[#003553] border border-slate-200/80 shadow-2xs hover:bg-[#E8F4FD]'
                        }`}
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold ${
                                    active
                                        ? 'bg-[#00B5F1] text-[#003553]'
                                        : done
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-[#E8F4FD] text-[#003553]'
                                }`}
                            >
                                {done && !active ? <ClinicIcon name="Check" size={13} weight="bold" /> : n}
                            </span>
                            <span className="text-[13px] font-bold truncate">{label}</span>
                        </div>

                        {badge && (
                            <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-1.5 ${
                                    active
                                        ? 'bg-white/20 text-white'
                                        : 'bg-sky-50 text-[#0077B6] border border-sky-200'
                                }`}
                            >
                                {badge}
                            </span>
                        )}
                    </button>
                )
            })}
        </nav>
    )
}
