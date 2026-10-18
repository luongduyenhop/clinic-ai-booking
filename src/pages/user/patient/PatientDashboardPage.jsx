import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import PatientPageHeader from '../../../components/user/patient/PatientPageHeader'
import AppointmentCard from '../../../components/user/patient/AppointmentCard'
import { PatientError, PatientLoading } from '../../../components/user/patient/PatientPageState'
import { CalendarCheck, CalendarPlus, ClipboardText, Microscope, Pill } from '../../../components/common/ClinicIcon'
import { fetchPatientPortalAsync } from '../../../redux/actions/user/patientPortalAction'

export default function PatientDashboardPage() {
    const dispatch = useDispatch()
    const { portalData, portalLoading, portalError } = useSelector((state) => state.user.user)
    if (portalLoading) return <PatientLoading/>
    if (portalError) return <PatientError message={portalError} onRetry={() => dispatch(fetchPatientPortalAsync())}/>
    const upcoming = portalData.appointments
        .filter((item) => ['PENDING', 'CONFIRMED'].includes(item.status))
        .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate))[0]
    const cards = [
        { label: 'Lịch hẹn', value: portalData.appointments.length, icon: CalendarCheck, to: '/benh-nhan/lich-hen' },
        { label: 'Lần khám', value: portalData.medicalHistory.length, icon: ClipboardText, to: '/benh-nhan/lich-su-kham' },
        { label: 'Đơn thuốc', value: portalData.prescriptions.length, icon: Pill, to: '/benh-nhan/don-thuoc' },
        { label: 'Kết quả CLS', value: portalData.labResults.length, icon: Microscope, to: '/benh-nhan/ket-qua-can-lam-sang' },
    ]
    return <><PatientPageHeader title="Tổng quan sức khỏe" description="Theo dõi lịch khám và các hồ sơ y tế gần đây của bạn." action={<Link to="/dat-lich" className="medpro-btn-primary min-h-11"><CalendarPlus size={18}/>Tạo lịch hẹn</Link>}/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon, to }) => <Link key={label} to={to} className="medpro-card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-[#8DDBF7]"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F4FD] text-[#00B5F1]"><Icon size={22} weight="duotone"/></span><span><strong className="block font-display text-2xl text-[#003553]">{value}</strong><span className="text-xs text-slate-500">{label}</span></span></Link>)}</div><section className="mt-6"><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-bold text-[#003553]">Lịch hẹn sắp tới</h2><Link to="/benh-nhan/lich-hen" className="text-xs font-bold text-[#008EC2] hover:underline">Xem tất cả</Link></div>{upcoming ? <AppointmentCard appointment={upcoming}/> : <div className="medpro-card p-6 text-center text-sm text-slate-500">Bạn chưa có lịch hẹn sắp tới.</div>}</section><div className="mt-6 grid gap-4 xl:grid-cols-2"><Recent title="Lần khám gần nhất" empty="Chưa có lịch sử khám" item={portalData.medicalHistory[0]} to="/benh-nhan/lich-su-kham" render={(item) => <><strong>{item.diagnosis}</strong><span>{item.doctor} · {formatDate(item.date)}</span></>}/><Recent title="Kết quả mới nhất" empty="Chưa có kết quả cận lâm sàng" item={portalData.labResults[0]} to="/benh-nhan/ket-qua-can-lam-sang" render={(item) => <><strong>{item.name}</strong><span>{item.summary}</span></>}/></div></>
}

function Recent({ title, empty, item, to, render }) { return <section className="medpro-card p-5"><div className="flex items-center justify-between"><h2 className="font-display font-bold text-[#003553]">{title}</h2><Link to={to} className="text-xs font-bold text-[#008EC2]">Chi tiết</Link></div>{item ? <div className="mt-4 grid gap-1 text-sm text-slate-600">{render(item)}</div> : <p className="mt-4 text-sm text-slate-400">{empty}</p>}</section> }
const formatDate = (value) => new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`))
