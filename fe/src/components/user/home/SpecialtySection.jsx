import { Link } from 'react-router-dom'
import { ArrowRight } from '../../common/ClinicIcon'
import { useMedicalCatalog } from '../../../services/user/MedicalCatalogService'

export default function SpecialtySection() {
  const { specialties, loading, error } = useMedicalCatalog()
  return <section id="chuyen-khoa" className="bg-[#F7FBFE] py-16 md:py-20 scroll-mt-20"><div className="public-container">
    <div className="public-section-heading"><span>Chuyên khoa</span><h2>Chọn đúng chuyên khoa cho nhu cầu của bạn</h2><p>Thông tin được cập nhật từ danh mục của phòng khám.</p></div>
    {loading && <p className="mt-8 text-slate-500">Đang tải chuyên khoa...</p>}
    {error && <p role="alert" className="mt-8 text-rose-600">{error}</p>}
    <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">{specialties.map(item =>
      <Link to={`/dat-lich?specialty=${item.id}`} key={item.id} className="medpro-card p-5 text-center group hover:border-[#00B5F1] transition">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#E8F4FD] text-[#00A9E3] font-extrabold">{item.name.slice(0,2).toUpperCase()}</span>
        <h3 className="mt-4 font-display text-base font-bold text-[#003553]">{item.name}</h3>
        <p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#00A9E3]">{item.doctorCount} bác sĩ <ArrowRight size={13} /></span>
      </Link>
    )}</div>
  </div></section>
}
