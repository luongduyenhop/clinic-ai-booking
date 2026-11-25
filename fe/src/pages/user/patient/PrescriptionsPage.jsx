import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchPrescriptionsAsync } from '../../../redux/actions/user/patientPortalAction'
import PatientPageHeader from '../../../components/user/patient/PatientPageHeader'
import {
    PatientEmpty,
    PatientError,
    PatientLoading,
} from '../../../components/user/patient/PatientPageState'
import { Pill } from '../../../components/common/ClinicIcon'

export default function PrescriptionsPage() {
    const dispatch = useDispatch()
    const {
        items,
        meta,
        loading: portalLoading,
        error: portalError,
    } = useSelector((state) => state.user.user.prescriptionsPage)
    const page = meta?.page || 1

    useEffect(() => {
        const request = dispatch(fetchPrescriptionsAsync({ page: 1 }))
        return () => request.abort()
    }, [dispatch])

    const setPage = (value) => dispatch(fetchPrescriptionsAsync({ page: value }))
    const reload = () => setPage(page)

    if (portalLoading) return <PatientLoading />
    if (portalError) return <PatientError message={portalError} onRetry={reload} />

    return (
        <>
            <PatientPageHeader
                title="Đơn thuốc"
                description="Xem thuốc, liều dùng theo từng buổi và lời dặn của bác sĩ ngay trên điện thoại."
            />
            {items.length ? (
                <div className="grid gap-4">
                    {items.map((item) => (
                        <article key={item.id} className="medpro-card overflow-hidden">
                            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-clinic-border bg-clinic-surface-tint p-4 sm:p-5">
                                <div>
                                    <p className="font-mono text-[11px] font-bold text-clinic-cta tabular-nums">
                                        {item.code}
                                    </p>
                                    <h2 className="mt-1 font-display font-bold text-clinic-navy">
                                        {item.diagnosis}
                                    </h2>
                                    <p className="mt-1 text-xs text-clinic-text-secondary tabular-nums">
                                        {item.doctor} · {formatDate(item.date)}
                                    </p>
                                </div>
                                <span className="medpro-badge-success">{item.status}</span>
                            </header>

                            <div className="divide-y divide-clinic-border">
                                {item.medicines.map((medicine) => (
                                    <div key={medicine.id || medicine.name} className="p-4 sm:p-5">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <p className="flex items-center gap-2 font-bold text-clinic-navy">
                                                <Pill size={17} className="text-clinic-cta shrink-0" />
                                                <span>{medicine.name}</span>
                                            </p>
                                            <p className="text-xs font-semibold text-clinic-text-secondary tabular-nums">
                                                {medicine.quantity || medicine.duration}
                                            </p>
                                        </div>

                                        {medicine.doses ? (
                                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                {medicine.doses.map((dose) => (
                                                    <div
                                                        key={dose.label}
                                                        className="rounded-[6px] bg-clinic-bg p-2.5 text-center"
                                                    >
                                                        <span className="block text-[11px] font-semibold text-clinic-cta">
                                                            {dose.label}
                                                        </span>
                                                        <span className="mt-0.5 block text-sm font-bold text-clinic-navy tabular-nums">
                                                            {dose.value}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <Field label="Liều dùng" value={medicine.dosage} />
                                        )}

                                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                            <Field
                                                label="Cách dùng"
                                                value={medicine.instruction || medicine.frequency}
                                            />
                                            <Field label="Thời gian" value={medicine.duration} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {item.note && (
                                <p className="border-t border-clinic-border bg-clinic-warning-bg px-4 py-3 text-xs leading-5 text-clinic-warning">
                                    <strong>Lời dặn:</strong> {item.note}
                                </p>
                            )}
                        </article>
                    ))}
                </div>
            ) : (
                <PatientEmpty
                    icon="Pill"
                    title="Chưa có đơn thuốc"
                    description="Đơn thuốc đã được bác sĩ ký sẽ xuất hiện tại đây."
                />
            )}
            <nav aria-label="Phân trang" className="mt-5 flex items-center justify-between gap-3">
                <button
                    type="button"
                    disabled={!meta?.has_prev}
                    onClick={() => setPage(meta.page - 1)}
                    className="medpro-btn-outline disabled:opacity-40"
                >
                    Trang trước
                </button>
                <span className="text-sm text-clinic-text-secondary tabular-nums">
                    Trang {meta?.page || 1} / {Math.max(1, meta?.total_pages || 1)}
                </span>
                <button
                    type="button"
                    disabled={!meta?.has_next}
                    onClick={() => setPage(meta.page + 1)}
                    className="medpro-btn-outline disabled:opacity-40"
                >
                    Trang sau
                </button>
            </nav>
        </>
    )
}

function Field({ label, value }) {
    return (
        <p className="text-xs text-clinic-text-secondary">
            <span className="block text-[11px] font-semibold text-clinic-text-muted">{label}</span>
            {value}
        </p>
    )
}

const formatDate = (value) =>
    value ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`)) : 'Chưa cập nhật'
