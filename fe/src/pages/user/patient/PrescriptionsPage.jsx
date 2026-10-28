import { useDispatch, useSelector } from 'react-redux'
import PatientPageHeader from '../../../components/user/patient/PatientPageHeader'
import { PatientEmpty, PatientError, PatientLoading } from '../../../components/user/patient/PatientPageState'
import { Pill } from '../../../components/common/ClinicIcon'
import { fetchPatientPortalAsync } from '../../../redux/actions/user/patientPortalAction'

export default function PrescriptionsPage() {
    const dispatch = useDispatch()
    const { portalData, portalLoading, portalError } = useSelector((state) => state.user.user)
    if (portalLoading) return <PatientLoading/>
    if (portalError) return <PatientError message={portalError} onRetry={() => dispatch(fetchPatientPortalAsync())}/>
    return <><PatientPageHeader title="Đơn thuốc" description="Xem thuốc, liều dùng và lời dặn được bác sĩ kê sau mỗi lần khám."/>{portalData.prescriptions.length ? <div className="grid gap-4">{portalData.prescriptions.map((item) => <article key={item.id} className="medpro-card overflow-hidden"><header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-[#F8FCFE] p-5"><div><p className="font-mono text-[11px] font-bold text-[#008EC2]">{item.code}</p><h2 className="mt-1 font-display font-bold text-[#003553]">{item.diagnosis}</h2><p className="mt-1 text-xs text-slate-500">{item.doctor} · {formatDate(item.date)}</p></div><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">{item.status}</span></header><div className="p-5"><div className="grid gap-3">{item.medicines.map((medicine) => <div key={medicine.name} className="grid gap-2 rounded-xl border border-slate-100 p-4 sm:grid-cols-[1.4fr_1fr_1fr_1fr]"><p className="flex items-center gap-2 font-bold text-[#003553]"><Pill size={17} className="text-[#00B5F1]"/>{medicine.name}</p><Field label="Liều dùng" value={medicine.dosage}/><Field label="Tần suất" value={medicine.frequency}/><Field label="Thời gian" value={medicine.duration}/></div>)}</div><p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>Lời dặn:</strong> {item.note}</p></div></article>)}</div> : <PatientEmpty icon="Pill" title="Chưa có đơn thuốc" description="Đơn thuốc đã được bác sĩ ký sẽ xuất hiện tại đây."/>}</>
}
function Field({ label, value }) { return <p className="text-xs text-slate-600"><span className="block text-[10px] font-bold uppercase text-slate-400">{label}</span>{value}</p> }
const formatDate = (value) => new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`))
