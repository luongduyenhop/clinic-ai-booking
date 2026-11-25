import { Check } from '../../common/ClinicIcon'

const steps = ['Triệu chứng chính', 'Đặc điểm', 'Thông tin bổ sung']

export default function TriageStepper({ currentStep }) {
    return (
        <ol className="grid grid-cols-3 gap-2" aria-label="Tiến trình khảo sát">
            {steps.map((label, index) => {
                const number = index + 1
                const done = number < currentStep
                const active = number === currentStep
                const badgeClass = active
                    ? 'bg-clinic-navy text-clinic-surface border border-clinic-navy'
                    : done
                      ? 'bg-clinic-surface-alt text-clinic-cta border border-clinic-info-border'
                      : 'bg-clinic-bg-muted text-clinic-text-muted border border-clinic-border'
                const labelClass = active
                    ? 'text-clinic-navy'
                    : done
                      ? 'text-clinic-cta'
                      : 'text-clinic-text-muted'

                return (
                    <li key={label} className="flex flex-col items-center text-center">
                        <span
                            className={`w-8 h-8 rounded-[6px] flex items-center justify-center font-bold tabular-nums ${badgeClass}`}
                        >
                            {done ? <Check size={16} weight="bold" /> : number}
                        </span>
                        <span className={`mt-2 text-[11px] sm:text-xs font-bold ${labelClass}`}>{label}</span>
                    </li>
                )
            })}
        </ol>
    )
}
