import { Link } from 'react-router-dom'
import { CalendarCheck, SealCheck, Star } from '@phosphor-icons/react'
import { useMedicalCatalog } from '../../../services/user/MedicalCatalogService'

export default function DoctorSection() {
  const { doctors, loading, error } = useMedicalCatalog()
  return <section id="bac-si" className="bg-white py-16 md:py-20 scroll-mt-20">
    <div className="public-container">
      <div className="public-section-heading"><span>Đội ngũ chuyên môn</span><h2>Bác sĩ được bệnh nhân tin tưởng</h2><p>Xem thông tin bác sĩ đang công bố trong hệ thống và chọn lịch khám phù hợp.</p></div>
      {loading && <p className="mt-8 text-slate-500">Đang tải danh sách bác sĩ...</p>}
      {error && <p role="alert" className="mt-8 text-rose-600">{error}</p>}
      {!loading && !error && !doctors.length && <p className="mt-8 text-slate-500">Hiện chưa có bác sĩ đang nhận lịch.</p>}
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {doctors.map(doctor => <article key={doctor.id} className="medpro-card flex h-full flex-col overflow-hidden">
          <div className="h-36 bg-[#E8F4FD] flex items-end justify-center pt-5"><div className="w-28 h-28 rounded-t-[48px] bg-white border-8 border-white text-[#00A9E3] flex items-center justify-center font-display text-2xl font-extrabold">{doctor.initials}</div></div>
          <div className="flex flex-1 flex-col p-5">
            <div className="flex items-start gap-1"><h3 className="font-display text-[15px] font-bold text-[#003553] leading-5">{doctor.name}</h3><SealCheck size={17} weight="fill" className="text-[#00B5F1] shrink-0" /></div>
            <p className="mt-1 text-sm font-semibold text-[#008EC2]">{doctor.specialty}</p>
            {doctor.experience && <p className="mt-2 text-xs text-slate-500 flex items-center gap-1"><Star size={14} weight="fill" className="text-[#FFB54A]" />{doctor.experience}</p>}
            <div className="mt-auto pt-4">
              <div className="border-t border-slate-100 pt-4"><p className="text-[11px] text-slate-400">Khung giờ còn trống được kiểm tra khi đặt lịch</p><p className="mt-1 text-xs font-bold text-[#003553] flex items-center gap-1.5"><CalendarCheck size={15} />Kiểm tra lịch thực tế</p></div>
              <Link to={`/dat-lich?specialty=${doctor.specialtyId}&doctor=${doctor.id}`} className="medpro-btn-primary w-full min-h-10 mt-4">Xem lịch khám</Link>
            </div>
          </div>
        </article>)}
      </div>
    </div>
  </section>
}
