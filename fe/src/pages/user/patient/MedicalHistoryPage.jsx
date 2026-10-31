import { useDispatch, useSelector } from 'react-redux'
import PatientPageHeader from '../../../components/user/patient/PatientPageHeader'
import { PatientEmpty, PatientError, PatientLoading } from '../../../components/user/patient/PatientPageState'
import { StatusBadge } from '../../../components/common/ClinicIcon'
import { fetchPatientPortalAsync } from '../../../redux/actions/user/patientPortalAction'

export default function MedicalHistoryPage() {
    const dispatch = useDispatch()
    const { portalData, portalLoading, portalError } = useSelector((state) => state.user.user)
    if (portalLoading) return <PatientLoading/>
    if (portalError) return <PatientError message={portalError} onRetry={() => dispatch(fetchPatientPortalAsync())}/>
    return <><PatientPageHeader title="Lịch sử khám" description="Tra cứu chẩn đoán và hướng dẫn chăm sóc từ các lần khám trước."/>{portalData.medicalHistory.length ? <div className="grid gap-4">{portalData.medicalHistory.map((item) => <article key={item.id} className="medpro-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[11px] font-bold text-[#008EC2]">{item.code}</p><h2 className="mt-1 font-display text-lg font-bold text-[#003553]">{item.diagnosis}</h2><p className="mt-1 text-xs text-slate-500">{formatDate(item.date)} · {item.specialty}</p></div><StatusBadge status={item.status}/></div><dl className="mt-5 grid gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2"><Info label="Bác sĩ khám" value={item.doctor}/><Info label="Triệu chứng" value={item.symptoms}/><div className="sm:col-span-2"><Info label="Lời dặn" value={item.advice}/></div></dl></article>)}</div> : <PatientEmpty icon="ClipboardText" title="Chưa có lịch sử khám" description="Hồ sơ sẽ xuất hiện sau khi lần khám được hoàn tất."/>}</>
}
function Info({ label, value }) { return <div><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 text-slate-700">{value}</dd></div> }
const formatDate = (value) => new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`))
