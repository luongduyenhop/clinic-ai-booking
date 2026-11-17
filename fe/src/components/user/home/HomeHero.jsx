import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMedicalCatalog } from '../../../services/user/MedicalCatalogService'
import { ArrowRight, CalendarCheck, CheckCircle, Stethoscope } from '../../common/ClinicIcon'

function getTodayIsoDate() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export default function HomeHero() {
    const navigate = useNavigate()
    const { specialties, doctors, loading, error } = useMedicalCatalog()
    const [todayDate] = useState(getTodayIsoDate)
    const [specialtyId, setSpecialtyId] = useState('')
    const [doctorId, setDoctorId] = useState('')
    const [appointmentDate, setAppointmentDate] = useState(todayDate)

    const filteredDoctors = useMemo(() => {
        if (!specialtyId) return doctors
        return doctors.filter((doc) => doc.specialtyId === specialtyId)
    }, [doctors, specialtyId])

    const handleSpecialtyChange = (event) => {
        const nextSpecialtyId = event.target.value
        setSpecialtyId(nextSpecialtyId)
        if (doctorId && nextSpecialtyId) {
            const currentDoctor = doctors.find((doc) => doc.id === doctorId)
            if (currentDoctor && currentDoctor.specialtyId !== nextSpecialtyId) {
                setDoctorId('')
            }
        }
    }

    const handleDoctorChange = (event) => {
        const nextDoctorId = event.target.value
        setDoctorId(nextDoctorId)
        if (nextDoctorId && !specialtyId) {
            const selectedDoctor = doctors.find((doc) => doc.id === nextDoctorId)
            if (selectedDoctor?.specialtyId) {
                setSpecialtyId(selectedDoctor.specialtyId)
            }
        }
    }

    const handleQuickBookSubmit = (event) => {
        event.preventDefault()
        const params = new URLSearchParams()
        if (specialtyId) params.set('specialty', specialtyId)
        if (doctorId) params.set('doctor', doctorId)
        if (appointmentDate) params.set('date', appointmentDate)
        const query = params.toString()
        navigate(query ? `/dat-lich?${query}` : '/dat-lich')
    }

    return (
        <section className="bg-clinic-bg border-b border-clinic-border">
            <div className="public-container grid lg:grid-cols-[1.08fr_0.92fr] gap-8 lg:gap-12 items-center py-12 md:py-16 lg:py-20">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-clinic-cta">
                        Hệ thống Phòng khám Đa khoa Tiêu chuẩn Quốc tế
                    </p>

                    <h1 className="mt-3 font-display text-[30px] sm:text-[38px] lg:text-[44px] leading-[1.16] font-extrabold tracking-[-0.025em] text-clinic-navy">
                        Chăm sóc y khoa chuẩn mực, <span className="text-clinic-cta">chủ động thời gian</span>
                    </h1>

                    <p className="mt-4 max-w-xl text-base leading-7 text-clinic-text-secondary">
                        Tra cứu trực tiếp chuyên khoa, bác sĩ phụ trách và lịch khám trống theo thời gian thực. Toàn bộ hồ sơ khám và kết quả cận lâm sàng được đồng bộ bảo mật trên một cổng duy nhất.
                    </p>

                    <div className="mt-7 flex flex-wrap items-center gap-3">
                        <Link to="/khao-sat-trieu-chung" className="medpro-btn-outline min-h-11 !px-5">
                            <Stethoscope size={17} weight="bold" className="text-clinic-cta" />
                            <span>Phân luồng triệu chứng</span>
                        </Link>
                        <a
                            href="#chuyen-khoa"
                            className="inline-flex items-center gap-1.5 px-4 min-h-11 text-sm font-semibold text-clinic-navy hover:text-clinic-cta transition-colors"
                        >
                            <span>Xem danh mục chuyên khoa</span>
                            <ArrowRight size={15} weight="bold" />
                        </a>
                    </div>

                    <div className="mt-8 pt-6 border-t border-clinic-border grid sm:grid-cols-3 gap-4 text-xs font-semibold text-clinic-text-secondary">
                        {['Đúng chuyên khoa & bác sĩ', 'Hiển thị giờ khám thực tế', 'Hồ sơ EMR bảo mật'].map((item) => (
                            <span key={item} className="inline-flex items-center gap-2">
                                <CheckCircle size={16} weight="fill" className="text-clinic-success shrink-0" />
                                <span>{item}</span>
                            </span>
                        ))}
                    </div>
                </div>

                <div className="medpro-card overflow-hidden">
                    <div className="h-1 bg-clinic-cyan" aria-hidden="true" />
                    <div className="p-6 sm:p-7">
                        <div className="pb-4 border-b border-clinic-border">
                            <h2 className="font-display text-lg font-extrabold text-clinic-navy">
                                Đăng ký lịch khám
                            </h2>
                            <p className="mt-1 text-xs text-clinic-text-secondary">
                                Chọn chuyên khoa, bác sĩ phụ trách và ngày khám mong muốn.
                            </p>
                        </div>

                        <form onSubmit={handleQuickBookSubmit} className="mt-5 space-y-4">
                            {error && (
                                <p
                                    role="alert"
                                    className="rounded-[8px] border border-clinic-danger-border bg-clinic-danger-bg px-3 py-2 text-xs font-medium text-clinic-danger"
                                >
                                    {error}
                                </p>
                            )}

                            <div>
                                <label htmlFor="hero-specialty" className="medpro-label">
                                    Chuyên khoa
                                </label>
                                <select
                                    id="hero-specialty"
                                    value={specialtyId}
                                    onChange={handleSpecialtyChange}
                                    disabled={loading}
                                    className="medpro-input"
                                >
                                    <option value="">
                                        {loading ? 'Đang tải chuyên khoa...' : 'Tất cả chuyên khoa'}
                                    </option>
                                    {specialties.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="hero-doctor" className="medpro-label">
                                    Bác sĩ phụ trách
                                </label>
                                <select
                                    id="hero-doctor"
                                    value={doctorId}
                                    onChange={handleDoctorChange}
                                    disabled={loading}
                                    className="medpro-input"
                                >
                                    <option value="">
                                        {loading ? 'Đang tải danh sách bác sĩ...' : 'Chọn bác sĩ (tùy chọn)'}
                                    </option>
                                    {filteredDoctors.map((doc) => (
                                        <option key={doc.id} value={doc.id}>
                                            {doc.degree ? `${doc.degree} ` : ''}
                                            {doc.name}
                                            {!specialtyId && doc.specialty ? ` — ${doc.specialty}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="hero-date" className="medpro-label">
                                    Ngày khám dự kiến
                                </label>
                                <input
                                    id="hero-date"
                                    type="date"
                                    min={todayDate}
                                    value={appointmentDate}
                                    onChange={(event) => setAppointmentDate(event.target.value)}
                                    className="medpro-input tabular-nums"
                                />
                            </div>

                            <button type="submit" className="medpro-btn-primary w-full min-h-11 text-sm">
                                <CalendarCheck size={18} weight="bold" />
                                <span>Tiếp tục đặt lịch</span>
                                <ArrowRight size={16} weight="bold" />
                            </button>

                            <p className="text-[11px] text-clinic-text-muted text-center">
                                Tiếp nhận trực tuyến và xác nhận mã hẹn ngay sau khi hoàn tất.
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    )
}
