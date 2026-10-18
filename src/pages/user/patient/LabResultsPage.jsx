import { useDispatch, useSelector } from 'react-redux'
import PatientPageHeader from '../../../components/user/patient/PatientPageHeader'
import { PatientEmpty, PatientError, PatientLoading } from '../../../components/user/patient/PatientPageState'
import { StatusBadge } from '../../../components/common/ClinicIcon'
import { fetchPatientPortalAsync } from '../../../redux/actions/user/patientPortalAction'

export default function LabResultsPage() {
    const dispatch = useDispatch()
    const { portalData, portalLoading, portalError } = useSelector((state) => state.user.user)
    if (portalLoading) return <PatientLoading/>
    if (portalError) return <PatientError message={portalError} onRetry={() => dispatch(fetchPatientPortalAsync())}/>
    return <><PatientPageHeader title="Kết quả cận lâm sàng" description="Tra cứu kết quả xét nghiệm và chẩn đoán hình ảnh của bạn."/>{portalData.labResults.length ? <div className="grid gap-4">{portalData.labResults.map((item) => <article key={item.id} className="medpro-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[11px] font-bold text-[#008EC2]">{item.code} · {item.type}</p><h2 className="mt-1 font-display text-lg font-bold text-[#003553]">{item.name}</h2><p className="mt-1 text-xs text-slate-500">{item.department} · {formatDate(item.date)}</p></div><StatusBadge status={item.status}/></div><p className="mt-4 rounded-xl bg-[#E8F4FD] p-4 text-sm leading-6 text-[#36566B]">{item.summary}</p>{item.details.length > 0 && <div className="mt-4 overflow-x-auto"><table className="medpro-table"><thead><tr><th>Chỉ số</th><th>Kết quả</th><th>Khoảng tham chiếu</th></tr></thead><tbody>{item.details.map((detail) => <tr key={detail.label}><td>{detail.label}</td><td className="font-bold text-[#003553]">{detail.value}</td><td>{detail.reference}</td></tr>)}</tbody></table></div>}<p className="mt-3 text-[11px] text-slate-400">Kết quả cần được bác sĩ diễn giải trong bối cảnh lâm sàng; không tự chẩn đoán hoặc dùng thuốc.</p></article>)}</div> : <PatientEmpty icon="Microscope" title="Chưa có kết quả" description="Kết quả đã xác nhận sẽ được cập nhật tại đây."/>}</>
}
const formatDate = (value) => new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`))
