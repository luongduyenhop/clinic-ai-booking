export default function StatusBadge({ status, text }) {
    const configMap = {
        active: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
        pending: { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
        cancelled: { bg: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
        completed: { bg: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
    }

    const current = configMap[status] || {
        bg: 'bg-slate-100 text-slate-700 border-slate-200',
        dot: 'bg-slate-400',
    }

    return (
        <span className={`status-badge ${current.bg}`}>
            <span className={`status-dot ${current.dot}`} />
            <span>{text}</span>
        </span>
    )
}
