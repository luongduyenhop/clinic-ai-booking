import { ClinicIcon } from '../../common/ClinicIcon'
import { EXAM_STEPS } from './examHelpers'

export default function ExamStepTabs({ step, locked, onChange }) {
    return (
        <nav aria-label="Các bước khám" className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {EXAM_STEPS.map((label, i) => {
                const n = i + 1
                const active = n === step
                const done = locked || n < step
                return (
                    <button
                        key={label}
                        type="button"
                        aria-current={active ? 'step' : undefined}
                        onClick={() => onChange(n)}
                        className={`flex min-h-12 items-center gap-2.5 rounded-full px-3 py-1.5 text-left text-[13px] font-semibold leading-tight transition cursor-pointer ${
                            active ? 'bg-[#003553] text-white' : 'bg-white text-[#003553] shadow-xs hover:bg-[#E8F4FD]'
                        }`}
                    >
                        <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                                active ? 'bg-[#00B5F1] text-[#003553]' : done ? 'bg-emerald-50 text-emerald-700' : 'bg-[#E8F4FD] text-[#003553]'
                            }`}
                        >
                            {done && !active ? <ClinicIcon name="Check" size={14} weight="bold" /> : n}
                        </span>
                        <span>{label}</span>
                    </button>
                )
            })}
        </nav>
    )
}
