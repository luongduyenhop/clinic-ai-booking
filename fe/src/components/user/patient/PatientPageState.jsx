import { EmptyState } from '../../common/ClinicIcon'

export function PatientLoading() {
    return (
        <div className="medpro-card p-8 text-center text-sm text-clinic-text-secondary">
            Đang tải dữ liệu...
        </div>
    )
}

export function PatientError({ message, onRetry }) {
    return (
        <div className="medpro-card border-clinic-danger-border bg-clinic-danger-bg p-8 text-center">
            <p className="text-sm font-bold text-clinic-danger">{message}</p>
            <button type="button" onClick={onRetry} className="medpro-btn-outline mt-4">
                Thử lại
            </button>
        </div>
    )
}

export function PatientEmpty({ icon, title, description }) {
    return (
        <div className="medpro-card">
            <EmptyState icon={icon} title={title} description={description} />
        </div>
    )
}
