import { ClinicIcon } from '../../common/ClinicIcon'
import { EXAM_STEPS } from './examHelpers'

export default function ExamStepTabs({ step, locked, onChange, counts = {} }) {
    const stepBadges = [
        null,
        counts.cls > 0 ? String(counts.cls) : null,
        counts.diagnosis > 0 ? String(counts.diagnosis) : null,
        counts.rx > 0 ? String(counts.rx) : null,
    ]

    return (
        <nav
            aria-label="Các bước khám"
            className="flex items-center gap-1 border-b border-clinic-border bg-clinic-bg-muted/70 px-3 pt-1.5 overflow-x-auto no-scrollbar"
        >
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
                        className={`relative flex items-center gap-2 h-9 px-3.5 rounded-t-[6px] text-xs font-semibold transition-colors cursor-pointer select-none whitespace-nowrap ${
                            active
                                ? 'bg-clinic-surface text-clinic-navy border-t border-x border-clinic-border -mb-px pb-px'
                                : 'text-clinic-text-secondary hover:text-clinic-navy hover:bg-clinic-surface/50'
                        }`}
                    >
                        <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                                active
                                    ? 'bg-clinic-navy text-clinic-surface'
                                    : done
                                      ? 'bg-clinic-success-bg text-clinic-success'
                                      : 'bg-clinic-border/70 text-clinic-text-secondary'
                            }`}
                        >
                            {done && !active ? <ClinicIcon name="Check" size={11} weight="bold" /> : n}
                        </span>
                        <span>{label}</span>
                        {badge && (
                            <span
                                className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 tabular-nums ${
                                    active
                                        ? 'bg-clinic-surface-alt text-clinic-cta'
                                        : 'bg-clinic-surface text-clinic-text-secondary border border-clinic-border'
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
