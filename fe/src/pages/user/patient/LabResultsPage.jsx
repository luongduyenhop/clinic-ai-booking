import { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import ResultAttachments from '../../../components/user/patient/ResultAttachments'
import { fetchLabResultsAsync } from '../../../redux/actions/user/patientPortalAction'
import PatientPageHeader from '../../../components/user/patient/PatientPageHeader'
import { PatientEmpty, PatientError, PatientLoading } from '../../../components/user/patient/PatientPageState'
import { StatusBadge, CalendarCheck } from '../../../components/common/ClinicIcon'

const formatDate = (value) =>
    value ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`)) : 'Chưa cập nhật'

export default function LabResultsPage() {
    const dispatch = useDispatch()
    const { items, meta, loading: portalLoading, error: portalError } = useSelector(
        (state) => state.user.user.labResultsPage
    )
    const page = meta?.page || 1

    useEffect(() => {
        const request = dispatch(fetchLabResultsAsync({ page: 1 }))
        return () => request.abort()
    }, [dispatch])

    const setPage = (value) => dispatch(fetchLabResultsAsync({ page: value }))
    const reload = () => setPage(page)

    const groupedByDate = useMemo(() => {
        const groups = []
        const map = new Map()
        ;(items || []).forEach((item) => {
            const key = item.date || 'unknown'
            if (!map.has(key)) {
                const bucket = { date: item.date, items: [] }
                map.set(key, bucket)
                groups.push(bucket)
            }
            map.get(key).items.push(item)
        })
        return groups
    }, [items])

    if (portalLoading) return <PatientLoading />
    if (portalError) return <PatientError message={portalError} onRetry={reload} />

    return (
        <>
            <PatientPageHeader
                title="Kết quả cận lâm sàng"
                description="Tra cứu kết quả xét nghiệm, thăm dò chức năng và xem ảnh chẩn đoán theo từng ngày khám."
            />

            {groupedByDate.length > 0 ? (
                <div className="space-y-5">
                    {groupedByDate.map((group) => (
                        <section
                            key={group.date || 'unknown'}
                            className="medpro-card overflow-hidden border border-slate-200/90 p-0"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-[#F0F7FC] px-4 py-3 sm:px-5">
                                <div className="flex items-center gap-2">
                                    <CalendarCheck size={18} weight="duotone" className="text-[#008EC2]" />
                                    <span className="font-display text-sm font-extrabold text-[#003553]">
                                        Ngày thực hiện: {formatDate(group.date)}
                                    </span>
                                </div>
                                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-[#007EAD] border border-[#B8E6F7]">
                                    {group.items.length} kết quả trong ngày
                                </span>
                            </div>

                            <div className="divide-y divide-slate-200/80">
                                {group.items.map((item) => (
                                    <article key={item.id} className="p-4 sm:p-5 bg-white">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <span className="inline-block rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-[#008EC2] border border-sky-100">
                                                    {item.type}
                                                </span>
                                                <h2 className="mt-1.5 font-display text-base sm:text-lg font-bold text-[#003553]">
                                                    {item.name}
                                                </h2>
                                            </div>
                                            <StatusBadge status={item.status} />
                                        </div>

                                        <p className="mt-3 rounded-xl bg-[#E8F4FD] px-4 py-3 text-sm leading-6 text-[#36566B]">
                                            {item.summary}
                                        </p>

                                        {item.details.length > 0 && (
                                            <div className="mt-3 overflow-x-auto">
                                                <table className="medpro-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Chỉ số</th>
                                                            <th>Kết quả</th>
                                                            <th>Khoảng tham chiếu</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {item.details.map((detail) => (
                                                            <tr key={detail.label}>
                                                                <td>{detail.label}</td>
                                                                <td className="font-bold text-[#003553]">{detail.value}</td>
                                                                <td>{detail.reference}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        <ResultAttachments files={item.attachments} serviceName={item.name} />
                                    </article>
                                ))}
                            </div>

                            <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[11px] text-slate-400 sm:px-5">
                                Kết quả cần được bác sĩ diễn giải trong bối cảnh lâm sàng; không tự chẩn đoán hoặc dùng thuốc.
                            </div>
                        </section>
                    ))}
                </div>
            ) : (
                <PatientEmpty
                    icon="Microscope"
                    title="Chưa có kết quả"
                    description="Kết quả đã xác nhận sẽ được cập nhật tại đây."
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
                <span className="text-sm">
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
