import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMedicalCatalog } from '../../../services/user/MedicalCatalogService'
import {
    buildQuickBookingPath,
    formatDoctorHeading,
    getDefaultScheduleDate,
    getTodayIsoDate,
} from '../../../utils/helpers/quickBookingHelpers'

export default function HomeHero({
    selectedSpecialtyId,
    onSpecialtySelect,
    selectedDate,
    onDateSelect,
}) {
    const navigate = useNavigate()
    const { specialties, doctors, loading, error } = useMedicalCatalog()
    const [todayDate] = useState(() => getTodayIsoDate())
    const [localSpecialtyId, setLocalSpecialtyId] = useState('')
    const [doctorId, setDoctorId] = useState('')
    const [localDate, setLocalDate] = useState(() => getDefaultScheduleDate())

    const specialtyId = selectedSpecialtyId !== undefined ? selectedSpecialtyId : localSpecialtyId
    const appointmentDate = selectedDate !== undefined ? selectedDate : localDate

    const updateSpecialty = (nextId) => {
        if (onSpecialtySelect) onSpecialtySelect(nextId)
        else setLocalSpecialtyId(nextId)
    }

    const updateDate = (nextDate) => {
        if (onDateSelect) onDateSelect(nextDate)
        else setLocalDate(nextDate)
    }

    const filteredDoctors = useMemo(() => {
        if (!specialtyId) return doctors
        return doctors.filter((doc) => doc.specialtyId === specialtyId)
    }, [doctors, specialtyId])

    const handleSpecialtyChange = (event) => {
        const nextSpecialtyId = event.target.value
        updateSpecialty(nextSpecialtyId)
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
                updateSpecialty(selectedDoctor.specialtyId)
            }
        }
    }

    const handleQuickBookSubmit = (event) => {
        event.preventDefault()
        navigate(
            buildQuickBookingPath({
                specialtyId,
                doctorId,
                appointmentDate,
                doctors,
            })
        )
    }

    return (
        <section className="bg-clinic-bg">
            <div className="relative bg-clinic-navy overflow-hidden">
                <picture className="absolute inset-0 w-full h-full">
                    <source srcSet="/images/hospital-corridor.webp" type="image/webp" />
                    <img
                        src="/images/hospital-corridor.jpg"
                        width={1376}
                        height={768}
                        fetchPriority="high"
                        alt="Hành lang phòng khám ngoại trú tiêu chuẩn quốc tế Clinic-AI"
                        className="w-full h-full hero-photo-position"
                    />
                </picture>
                <div className="hero-clinic-scrim absolute inset-0" aria-hidden="true" />

                <div className="public-container relative z-10">
                    <div className="max-w-[610px] pt-14 pb-20 sm:pt-16 sm:pb-24 lg:pt-[76px] lg:pb-28 text-clinic-surface">
                        <h1 className="font-display text-[30px] sm:text-[38px] lg:text-[42px] leading-[1.18] font-extrabold tracking-[-0.02em] text-clinic-surface">
                            Đặt lịch khám chuyên khoa, kiểm tra triệu chứng trước khi đến
                        </h1>

                        <p className="mt-4 max-w-[540px] text-[15px] leading-[1.65] text-clinic-on-navy-muted">
                            Sàng lọc triệu chứng AI để định hướng đúng chuyên khoa, giữ trước khung giờ bác sĩ 30 phút thực tế và lưu trữ kết quả xét nghiệm, đơn thuốc điện tử cho bản thân cùng gia đình.
                        </p>

                        <div className="mt-6">
                            <Link
                                to="/khao-sat-trieu-chung"
                                className="hero-clinic-secondary inline-flex items-center px-4 py-2 text-[13px] font-semibold"
                            >
                                Kiểm tra triệu chứng để chọn đúng khoa
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="public-container relative z-10 -mt-10 sm:-mt-12 pb-6">
                <form
                    onSubmit={handleQuickBookSubmit}
                    aria-label="Thanh đặt lịch nhanh"
                    className="medpro-card p-4 sm:p-5"
                >
                    {error && (
                        <p
                            role="alert"
                            className="mb-3 rounded-[8px] border border-clinic-danger-border bg-clinic-danger-bg px-3 py-2 text-xs font-medium text-clinic-danger"
                        >
                            {error}
                        </p>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.15fr_1.25fr_0.9fr_auto] items-end">
                        <div>
                            <label htmlFor="hero-specialty" className="medpro-label">
                                Chuyên khoa
                            </label>
                            <select
                                id="hero-specialty"
                                value={specialtyId}
                                onChange={handleSpecialtyChange}
                                disabled={loading}
                                className="medpro-input min-h-[42px] py-0"
                            >
                                <option value="">
                                    {loading ? 'Đang tải chuyên khoa...' : 'Tất cả chuyên khoa'}
                                </option>
                                {specialties.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}{item.room ? ` (${item.room})` : ''}
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
                                className="medpro-input min-h-[42px] py-0"
                            >
                                <option value="">
                                    {loading ? 'Đang tải danh sách bác sĩ...' : 'Bác sĩ có lịch trống phù hợp'}
                                </option>
                                {filteredDoctors.map((doc) => (
                                    <option key={doc.id} value={doc.id}>
                                        {formatDoctorHeading(doc)}
                                        {!specialtyId && doc.specialty ? ` — ${doc.specialty}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="hero-date" className="medpro-label">
                                Ngày khám
                            </label>
                            <input
                                id="hero-date"
                                type="date"
                                min={todayDate}
                                value={appointmentDate}
                                onChange={(event) => updateDate(event.target.value)}
                                className="medpro-input min-h-[42px] py-0 tabular-nums"
                            />
                        </div>

                        <button type="submit" className="medpro-btn-primary min-h-[42px] px-5 text-sm sm:col-span-2 lg:col-span-1">
                            Tìm giờ khám
                        </button>
                    </div>
                </form>
            </div>
        </section>
    )
}
