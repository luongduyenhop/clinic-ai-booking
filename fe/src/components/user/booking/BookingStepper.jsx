import { Check } from '../../common/ClinicIcon'

const BOOKING_STEP_LABELS = ['Chuyên khoa & Bác sĩ', 'Ngày & Giờ khám', 'Thông tin người khám']

export default function BookingStepper({ currentStep }) {
    return (
        <ol className="grid grid-cols-3 gap-3" aria-label="Tiến trình đặt lịch">
            {BOOKING_STEP_LABELS.map((label, index) => {
                const step = index + 1
                const done = step < currentStep
                const active = step === currentStep
                const badgeClass = active
                    ? 'bg-clinic-navy text-clinic-surface border-clinic-navy'
                    : done
                      ? 'bg-clinic-surface-alt text-clinic-cta border-clinic-info-border'
                      : 'bg-clinic-bg-muted text-clinic-text-muted border-clinic-border'
                const labelClass = active
                    ? 'text-clinic-navy'
                    : done
                      ? 'text-clinic-cta'
                      : 'text-clinic-text-muted'

                return (
                    <li key={label} className="relative">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-2.5">
                            <span
                                className={`w-8 h-8 shrink-0 rounded-[6px] border flex items-center justify-center text-xs font-extrabold tabular-nums ${badgeClass}`}
                            >
                                {done ? <Check size={15} weight="bold" /> : step}
                            </span>
                            <span className={`text-[11px] sm:text-[13px] font-bold text-center sm:text-left leading-4 sm:pt-1 ${labelClass}`}>
                                {label}
                            </span>
                        </div>
                        {index < BOOKING_STEP_LABELS.length - 1 && (
                            <span
                                aria-hidden="true"
                                className={`hidden sm:block absolute h-[2px] top-4 left-[40px] right-[-6px] -z-10 ${
                                    done ? 'bg-clinic-cta' : 'bg-clinic-border'
                                }`}
                            />
                        )}
                    </li>
                )
            })}
        </ol>
    )
}
