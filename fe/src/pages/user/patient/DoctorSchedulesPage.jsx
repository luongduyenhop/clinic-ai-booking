import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PatientPageHeader from '../../../components/user/patient/PatientPageHeader'
import { useMedicalCatalog } from '../../../services/user/MedicalCatalogService'
import { bookingService } from '../../../services/user/BookingService'

export default function DoctorSchedulesPage() {
  const { doctors, specialties, loading: catalogLoading, error: catalogError } = useMedicalCatalog()
  const [minDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [date, setDate] = useState(() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toLocaleDateString('en-CA') })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    if (catalogLoading || catalogError) return
    setLoading(true); setError('')
    Promise.all(doctors.map(async doctor => {
      try { return { doctor, slots: await bookingService.getAvailableSlots({ doctorId: doctor.id, appointmentDate: date }) } }
      catch (err) { return { doctor, slots: [], error: err.response?.data?.message || 'Không thể tải lịch bác sĩ' } }
    })).then(data => { if (active) setRows(data) }).catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [doctors, date, catalogLoading, catalogError])
  return <main>
    <PatientPageHeader title="Lịch làm việc bác sĩ" description="Giờ còn trống được cập nhật từ Backend theo ngày đã chọn."/>
    <label className="block medpro-card p-4 text-sm">Ngày khám <input type="date" className="medpro-input mt-2 max-w-xs" min={minDate} value={date} onChange={e => setDate(e.target.value)}/></label>
    {(catalogLoading || loading) && <p className="p-4 text-slate-500">Đang kiểm tra ca trực và khung giờ...</p>}
    {(catalogError || error) && <p className="p-4 text-rose-600" role="alert">{catalogError || error}</p>}
    <div className="mt-5 grid gap-4 md:grid-cols-2">{rows.map(({doctor, slots, error: slotError}) => <article key={doctor.id} className="medpro-card p-5 space-y-3">
      <h2 className="font-bold">{doctor.name}</h2><p className="text-xs text-slate-500">{specialties.find(s=>s.id===doctor.specialtyId)?.name || doctor.specialty}</p>
      {slotError ? <p className="text-xs text-rose-600">{slotError}</p> : <p className="text-xs">{slots.length ? slots.map(s=>s.value).join(' · ') : 'Không có khung giờ trống ngày này'}</p>}
      {slots.length > 0 && <Link className="medpro-btn-outline" to={`/dat-lich?specialty=${doctor.specialtyId}&doctor=${doctor.id}`}>Đặt lịch với bác sĩ</Link>}
    </article>)}</div>
  </main>
}
