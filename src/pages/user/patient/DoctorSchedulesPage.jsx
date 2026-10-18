import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import PatientPageHeader from '../../../components/user/patient/PatientPageHeader'
import { PatientEmpty, PatientError, PatientLoading } from '../../../components/user/patient/PatientPageState'
import { CalendarPlus, Clock, Stethoscope } from '../../../components/common/ClinicIcon'
import { specialties } from '../../../data/user/publicPortalData'
import { fetchPatientPortalAsync } from '../../../redux/actions/user/patientPortalAction'

export default function DoctorSchedulesPage() {
    const dispatch = useDispatch()
    const [specialty, setSpecialty] = useState('ALL')
    const { portalData, portalLoading, portalError } = useSelector((state) => state.user.user)
    if (portalLoading) return <PatientLoading/>
    if (portalError) return <PatientError message={portalError} onRetry={() => dispatch(fetchPatientPortalAsync())}/>
    const items = portalData.doctorSchedules.filter((item) => specialty === 'ALL' || item.specialtyId === specialty)
    return <><PatientPageHeader title="Lịch làm việc của bác sĩ" description="Xem ca làm việc dự kiến trong 7 ngày tới và chọn bác sĩ phù hợp."/><div className="medpro-card mb-5 p-4"><label className="auth-label" htmlFor="doctor-specialty">Chuyên khoa</label><select id="doctor-specialty" value={specialty} onChange={(event) => setSpecialty(event.target.value)} className="medpro-input max-w-sm"><option value="ALL">Tất cả chuyên khoa</option>{specialties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>{items.length ? <div className="grid gap-4 md:grid-cols-2">{items.map((item) => <article key={item.id} className="medpro-card p-5"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F4FD] text-[#00B5F1]"><Stethoscope size={22}/></span><div><h2 className="font-display font-bold text-[#003553]">{item.doctorName}</h2><p className="text-xs text-slate-500">{item.specialty}</p></div></div><p className="mt-4 font-bold text-sm text-[#003553]">{formatDate(item.date)}</p><div className="mt-2 flex flex-wrap gap-2">{item.shifts.map((shift) => <span key={shift} className="inline-flex items-center gap-1.5 rounded-full border border-[#B8E5FA] bg-[#E8F4FD] px-3 py-1.5 text-[11px] font-bold text-[#006F9F]"><Clock size={14}/>{shift}</span>)}</div><Link to={`/dat-lich?specialty=${item.specialtyId}&doctor=${item.doctorId}`} className="medpro-btn-outline mt-5 min-h-10"><CalendarPlus size={16}/>Chọn bác sĩ này</Link></article>)}</div> : <PatientEmpty icon="Stethoscope" title="Không có lịch phù hợp" description="Thử chọn chuyên khoa khác để xem lịch bác sĩ."/>}<p className="mt-4 text-[11px] text-slate-400">Lịch hiển thị mang tính dự kiến. Các khung giờ còn trống sẽ được kiểm tra lại trong bước đặt lịch.</p></>
}
const formatDate = (value) => new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
