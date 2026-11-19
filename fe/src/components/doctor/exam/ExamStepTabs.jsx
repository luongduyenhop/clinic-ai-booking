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
                        className={`flex items-center justify-between min-h-[46px] rounded-[6px] px-3.5 py-2 text-left transition-colors cursor-pointer select-none ${
                            active
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'bg-clinic-surface text-clinic-navy border border-clinic-border hover:bg-clinic-surface-alt'
                        }`}
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-xs font-bold tabular-nums ${
                                    active
                                        ? 'bg-clinic-cta text-clinic-surface'
                                        : done
                                          ? 'bg-clinic-success-bg text-clinic-success border border-clinic-success-border'
                                          : 'bg-clinic-surface-alt text-clinic-navy'
                                }`}
                            >
                                {done && !active ? <ClinicIcon name="Check" size={13} weight="bold" /> : n}
                            </span>
                            <span className="text-[13px] font-bold truncate">{label}</span>
                        </div>

                        {badge && (
                            <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-[6px] shrink-0 ml-1.5 tabular-nums ${
                                    active
                                        ? 'bg-clinic-cta text-clinic-surface'
                                        : 'bg-clinic-surface-alt text-clinic-cta'
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
