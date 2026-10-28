import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import PatientPageHeader from '../../../components/user/patient/PatientPageHeader'
import AppointmentCard from '../../../components/user/patient/AppointmentCard'
import { PatientEmpty, PatientError, PatientLoading } from '../../../components/user/patient/PatientPageState'
import { CalendarPlus } from '../../../components/common/ClinicIcon'
import { fetchPatientPortalAsync } from '../../../redux/actions/user/patientPortalAction'

const filters = [{ id: 'ALL', label: 'Tất cả' }, { id: 'UPCOMING', label: 'Sắp tới' }, { id: 'COMPLETED', label: 'Đã khám' }, { id: 'CANCELLED', label: 'Đã hủy' }]

export default function PatientAppointmentsPage() {
    const dispatch = useDispatch()
    const [filter, setFilter] = useState('ALL')
    const { portalData, portalLoading, portalError } = useSelector((state) => state.user.user)
    if (portalLoading) return <PatientLoading/>
    if (portalError) return <PatientError message={portalError} onRetry={() => dispatch(fetchPatientPortalAsync())}/>
    const items = portalData.appointments.filter((item) => filter === 'ALL' || (filter === 'UPCOMING' ? ['PENDING', 'CONFIRMED'].includes(item.status) : item.status === filter))
    return <><PatientPageHeader title="Lịch hẹn của tôi" description="Theo dõi trạng thái các lịch khám đã đăng ký." action={<Link to="/dat-lich" className="medpro-btn-primary min-h-11"><CalendarPlus size={18}/>Tạo lịch hẹn</Link>}/><div className="mb-5 flex flex-wrap gap-2">{filters.map((item) => <button type="button" key={item.id} onClick={() => setFilter(item.id)} className={`rounded-full border px-4 py-2 text-xs font-bold ${filter === item.id ? 'border-[#00B5F1] bg-[#00B5F1] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{item.label}</button>)}</div>{items.length ? <div className="grid gap-4">{items.map((item) => <AppointmentCard key={item.id} appointment={item}/>)}</div> : <PatientEmpty icon="CalendarCheck" title="Không có lịch hẹn" description="Chưa có lịch hẹn phù hợp với bộ lọc đang chọn."/>}</>
}
