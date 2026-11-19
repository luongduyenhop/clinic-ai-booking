export default function SymptomToggle({ label, selected, onClick, danger = false }) {
    const stateClass = selected
        ? danger
            ? 'border-clinic-danger bg-clinic-danger-bg text-clinic-danger'
            : 'border-clinic-cta bg-clinic-surface-alt text-clinic-navy'
        : 'border-clinic-border-strong bg-clinic-surface text-clinic-text-secondary hover:border-clinic-cta'

    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            className={`min-h-10 rounded-[6px] border px-3.5 text-xs font-bold transition-colors cursor-pointer ${stateClass}`}
        >
            {label}
        </button>
    )
}
