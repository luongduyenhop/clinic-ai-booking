import ResultAttachments from '../../../components/user/patient/ResultAttachments'
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchLabResultsAsync } from '../../../redux/actions/user/patientPortalAction'
import PatientPageHeader from '../../../components/user/patient/PatientPageHeader'
import { PatientEmpty, PatientError, PatientLoading } from '../../../components/user/patient/PatientPageState'
import { StatusBadge } from '../../../components/common/ClinicIcon'

export default function LabResultsPage() {
    const dispatch = useDispatch()
    const { items, meta, loading: portalLoading, error: portalError } = useSelector((state) => state.user.user.labResultsPage)
    const page = meta?.page || 1
    useEffect(() => { const request = dispatch(fetchLabResultsAsync({ page: 1 })); return () => request.abort() }, [dispatch])
    const setPage = (value) => dispatch(fetchLabResultsAsync({ page: value }))
    const reload = () => setPage(page)
    const portalData = { labResults: items }
    if (portalLoading) return <PatientLoading/>
    if (portalError) return <PatientError message={portalError} onRetry={reload}/>
    return <><PatientPageHeader title="Kết quả cận lâm sàng" description="Tra cứu, xem ảnh chất lượng gốc và tải kết quả xét nghiệm trên điện thoại."/>{portalData.labResults.length ? <div className="grid gap-4">{portalData.labResults.map((item) => <article key={item.id} className="medpro-card p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[11px] font-bold text-[#008EC2]">{item.code} · {item.type}</p><h2 className="mt-1 font-display text-lg font-bold text-[#003553]">{item.name}</h2><p className="mt-1 text-xs text-slate-500">{item.department} · {formatDate(item.date)}</p></div><StatusBadge status={item.status}/></div><p className="mt-4 rounded-xl bg-[#E8F4FD] p-4 text-sm leading-6 text-[#36566B]">{item.summary}</p>{item.details.length > 0 && <div className="mt-4 overflow-x-auto"><table className="medpro-table"><thead><tr><th>Chỉ số</th><th>Kết quả</th><th>Khoảng tham chiếu</th></tr></thead><tbody>{item.details.map((detail) => <tr key={detail.label}><td>{detail.label}</td><td className="font-bold text-[#003553]">{detail.value}</td><td>{detail.reference}</td></tr>)}</tbody></table></div>}<ResultAttachments files={item.attachments}/><p className="mt-3 text-[11px] text-slate-400">Kết quả cần được bác sĩ diễn giải trong bối cảnh lâm sàng; không tự chẩn đoán hoặc dùng thuốc.</p></article>)}</div> : <PatientEmpty icon="Microscope" title="Chưa có kết quả" description="Kết quả đã xác nhận sẽ được cập nhật tại đây."/>}<nav aria-label="Phân trang" className="mt-5 flex items-center justify-between gap-3"><button type="button" disabled={!meta?.has_prev} onClick={() => setPage(meta.page - 1)} className="medpro-btn-outline disabled:opacity-40">Trang trước</button><span className="text-sm">Trang {meta?.page || 1} / {Math.max(1, meta?.total_pages || 1)}</span><button type="button" disabled={!meta?.has_next} onClick={() => setPage(meta.page + 1)} className="medpro-btn-outline disabled:opacity-40">Trang sau</button></nav></>
}
const formatDate = (value) => value ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`)) : 'Chưa cập nhật'
