import { Stethoscope, CheckCircle } from '../../common/ClinicIcon'

export default function SpecialtyDoctorStep({ values = {}, onChange = () => {}, specialties = [], doctors = [], loading = false, error = '' }) {
  const filteredDoctors = doctors.filter(doctor => doctor.specialtyId === values.specialtyId)
  return <div>
    <div className="mb-6"><h2 className="booking-title">Chọn chuyên khoa</h2><p className="booking-description">Danh sách được cập nhật từ hệ thống phòng khám.</p></div>
    {loading && <p role="status" className="mb-4 text-sm text-slate-500">Đang tải danh sách chuyên khoa và bác sĩ...</p>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{specialties.map(item => <button type="button" key={item.id} onClick={() => onChange({ specialtyId: item.id, doctorId: '' })} className={`relative text-left rounded-2xl border p-4 transition ${values.specialtyId === item.id ? 'border-[#00B5F1] bg-[#E8F4FD]' : 'border-slate-200 hover:border-[#8DDBF7]'}`}>
      <strong className="block text-sm text-[#003553]">{item.name}</strong><span className="text-xs text-slate-500">{item.doctorCount} bác sĩ</span>{values.specialtyId === item.id && <CheckCircle size={19} className="absolute right-3 top-3 text-[#00B5F1]"/>}
    </button>)}</div>
    {values.specialtyId && <div className="mt-8"><h2 className="booking-title">Chọn bác sĩ</h2><div className="mt-4 grid md:grid-cols-2 gap-3">
      {filteredDoctors.length ? filteredDoctors.map(doctor => <button type="button" key={doctor.id} onClick={() => onChange({ doctorId: doctor.id })} className={`flex items-center gap-4 rounded-2xl border p-4 text-left ${values.doctorId === doctor.id ? 'border-[#00B5F1] bg-[#E8F4FD]' : 'border-slate-200'}`}>
        <span className="w-12 h-12 shrink-0 rounded-full bg-[#003553] text-white flex items-center justify-center font-bold">{doctor.initials}</span><span className="flex-1"><strong className="block text-sm text-[#003553]">{doctor.name}</strong><small className="text-slate-500">{doctor.experience}</small></span><Stethoscope size={20}/>
      </button>) : <p className="text-sm text-slate-500">Chưa có bác sĩ đang nhận lịch trong chuyên khoa này.</p>}
    </div></div>}
  </div>
}
