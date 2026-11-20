import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMedicalCatalog } from '../../../services/user/MedicalCatalogService'
import { bookingService } from '../../../services/user/BookingService'
import {
    buildQuickBookingPath,
    formatConsultFee,
    formatDoctorHeading,
    formatVietnameseDateLabel,
    getDefaultScheduleDate,
    getOffsetIsoDate,
    getSpecialtyClinicalMetadata,
    getTodayIsoDate,
} from '../../../utils/helpers/quickBookingHelpers'
import { Clock, MagnifyingGlass } from '../../common/ClinicIcon'
import DoctorAvatar from '../../common/DoctorAvatar'

const MAX_INLINE_SLOTS = 8

export default function DoctorSection({
    embedded = false,
    selectedSpecialtyId: controlledSpecialtyId,
    onSpecialtySelect,
    selectedDate: controlledDate,
    onDateSelect,
}) {
    const { specialties, doctors, loading, error } = useMedicalCatalog()
    const [todayDate] = useState(() => getTodayIsoDate())
    const [tomorrowDate] = useState(() => getOffsetIsoDate(1))
    const [localDate, setLocalDate] = useState(() => getDefaultScheduleDate())
    const [localSpecialtyId, setLocalSpecialtyId] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [slotsByDoctor, setSlotsByDoctor] = useState({})
    const [slotsLoading, setSlotsLoading] = useState(false)

    const selectedSpecialtyId = controlledSpecialtyId !== undefined ? controlledSpecialtyId : localSpecialtyId
    const selectedDate = controlledDate !== undefined ? controlledDate : localDate

    const updateSpecialtyId = (nextId) => {
        if (onSpecialtySelect) onSpecialtySelect(nextId)
        else setLocalSpecialtyId(nextId)
    }

    const updateSelectedDate = (nextDate) => {
        const safeDate = nextDate || todayDate
        if (onDateSelect) onDateSelect(safeDate)
        else setLocalDate(safeDate)
    }

    const filteredDoctors = useMemo(() => {
        const keyword = searchTerm.trim().toLowerCase()
        return doctors.filter((doc) => {
            if (selectedSpecialtyId && doc.specialtyId !== selectedSpecialtyId) {
                return false
            }
            if (!keyword) return true
            const haystack = `${doc.name} ${doc.specialty} ${doc.room} ${doc.degree}`.toLowerCase()
            return haystack.includes(keyword)
        })
    }, [doctors, selectedSpecialtyId, searchTerm])

    useEffect(() => {
        if (!filteredDoctors.length || !selectedDate) {
            setSlotsByDoctor({})
            setSlotsLoading(false)
            return
        }

        let alive = true
        setSlotsLoading(true)
        const targets = filteredDoctors.slice(0, 12)

        Promise.allSettled(
            targets.map((doc) =>
                bookingService
                    .getAvailableSlots({ doctorId: doc.id, appointmentDate: selectedDate })
                    .then((slots) => ({ doctorId: doc.id, slots }))
            )
        ).then((results) => {
            if (!alive) return
            const nextMap = {}
            results.forEach((result) => {
                if (result.status === 'fulfilled') {
                    nextMap[result.value.doctorId] = { slots: result.value.slots, failed: false }
                }
            })
            targets.forEach((doc) => {
                if (!nextMap[doc.id]) {
                    nextMap[doc.id] = { slots: [], failed: true }
                }
            })
            setSlotsByDoctor(nextMap)
            setSlotsLoading(false)
        })

        return () => {
            alive = false
        }
    }, [filteredDoctors, selectedDate])

    const dateLabel = formatVietnameseDateLabel(selectedDate) || selectedDate

    return (
        <section id="bac-si" className="bg-clinic-bg py-10 sm:py-12 scroll-mt-20 border-b border-clinic-border">
            <div className="public-container">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-clinic-border">
                    <h2 className="font-display text-[22px] sm:text-[26px] font-extrabold tracking-tight text-clinic-navy">
                        Lịch bác sĩ và khung giờ còn trống
                    </h2>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => updateSelectedDate(todayDate)}
                            className={`min-h-9 px-3 rounded-[6px] border text-xs font-bold transition-colors cursor-pointer ${
                                selectedDate === todayDate
                                    ? 'border-clinic-cta bg-clinic-surface-alt text-clinic-cta'
                                    : 'border-clinic-border-strong bg-clinic-surface text-clinic-navy hover:border-clinic-cta'
                            }`}
                        >
                            Hôm nay
                        </button>
                        <button
                            type="button"
                            onClick={() => updateSelectedDate(tomorrowDate)}
                            className={`min-h-9 px-3 rounded-[6px] border text-xs font-bold transition-colors cursor-pointer ${
                                selectedDate === tomorrowDate
                                    ? 'border-clinic-cta bg-clinic-surface-alt text-clinic-cta'
                                    : 'border-clinic-border-strong bg-clinic-surface text-clinic-navy hover:border-clinic-cta'
                            }`}
                        >
                            Ngày mai
                        </button>
                        {!embedded && (
                            <input
                                type="date"
                                aria-label="Chọn ngày xem khung giờ"
                                min={todayDate}
                                value={selectedDate}
                                onChange={(event) => updateSelectedDate(event.target.value)}
                                className="medpro-input !w-auto min-h-9 py-0 text-xs tabular-nums"
                            />
                        )}
                    </div>
                </div>

                {embedded ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => updateSpecialtyId('')}
                            className={`min-h-8 px-3 rounded-[6px] border text-xs font-semibold transition-colors cursor-pointer ${
                                !selectedSpecialtyId
                                    ? 'border-clinic-navy bg-clinic-navy text-clinic-surface'
                                    : 'border-clinic-border bg-clinic-surface text-clinic-text-secondary hover:border-clinic-cta hover:text-clinic-navy'
                            }`}
                        >
                            Tất cả chuyên khoa
                        </button>
                        {specialties.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() =>
                                    updateSpecialtyId(selectedSpecialtyId === item.id ? '' : item.id)
                                }
                                className={`min-h-8 px-3 rounded-[6px] border text-xs font-semibold transition-colors cursor-pointer ${
                                    selectedSpecialtyId === item.id
                                        ? 'border-clinic-navy bg-clinic-navy text-clinic-surface'
                                        : 'border-clinic-border bg-clinic-surface text-clinic-text-secondary hover:border-clinic-cta hover:text-clinic-navy'
                                }`}
                            >
                                {item.name}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="mt-5 grid gap-2.5 md:grid-cols-[1.5fr_1fr]">
                        <div className="relative">
                            <MagnifyingGlass
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none"
                            />
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Tìm theo tên bác sĩ, chuyên khoa hoặc số buồng khám..."
                                aria-label="Tìm theo tên bác sĩ hoặc chuyên khoa"
                                className="medpro-input min-h-[42px] py-0 pl-9"
                            />
                        </div>
                        <select
                            aria-label="Lọc theo chuyên khoa"
                            value={selectedSpecialtyId}
                            onChange={(event) => updateSpecialtyId(event.target.value)}
                            disabled={loading}
                            className="medpro-input min-h-[42px] py-0"
                        >
                            <option value="">Tất cả {specialties.length || ''} chuyên khoa</option>
                            {specialties.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="mt-5 grid gap-4">
                    {loading && (
                        <div className="medpro-card p-6 text-sm text-clinic-text-secondary">
                            Đang tải lịch làm việc của đội ngũ bác sĩ...
                        </div>
                    )}

                    {error && (
                        <p role="alert" className="medpro-card p-4 border-clinic-danger-border bg-clinic-danger-bg text-sm font-medium text-clinic-danger">
                            {error}
                        </p>
                    )}

                    {!loading && !error && !filteredDoctors.length && (
                        <div className="medpro-card p-6 text-sm text-clinic-text-secondary flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h3 className="font-display text-[15px] font-bold text-clinic-navy">
                                    {selectedSpecialtyId
                                        ? 'Chuyên khoa tiếp nhận khám ca sáng và chiều'
                                        : 'Không tìm thấy bác sĩ phù hợp với từ khóa hiện tại'}
                                </h3>
                                <p className="mt-1 text-[13px] leading-6">
                                    {selectedSpecialtyId
                                        ? 'Bạn có thể chọn chuyên khoa này trong biểu mẫu đặt hẹn đầy đủ để quầy tiếp nhận sắp xếp buồng khám phù hợp.'
                                        : 'Vui lòng thử từ khóa khác hoặc đặt lại bộ lọc để xem toàn bộ lịch làm việc đang mở.'}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                {selectedSpecialtyId && (
                                    <Link
                                        to={buildQuickBookingPath({ specialtyId: selectedSpecialtyId, appointmentDate: selectedDate })}
                                        className="medpro-btn-primary"
                                    >
                                        Đặt khám theo chuyên khoa
                                    </Link>
                                )}
                                {(selectedSpecialtyId || searchTerm) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            updateSpecialtyId('')
                                            setSearchTerm('')
                                        }}
                                        className="medpro-btn-outline"
                                    >
                                        Xem tất cả bác sĩ
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {filteredDoctors.map((doctor) => {
                        const entry = slotsByDoctor[doctor.id]
                        const availableSlots = entry?.slots || []
                        const visibleSlots = availableSlots.slice(0, MAX_INLINE_SLOTS)
                        const specialtyMeta = getSpecialtyClinicalMetadata(doctor.specialtyCode || doctor.specialty)
                        const doctorBookingPath = buildQuickBookingPath({
                            specialtyId: doctor.specialtyId,
                            doctorId: doctor.id,
                            appointmentDate: selectedDate,
                            doctors,
                        })

                        return (
                            <article
                                key={doctor.id}
                                className="medpro-card p-5 sm:p-6 grid lg:grid-cols-[1fr_1.35fr] gap-6 items-center"
                            >
                                <div className="flex items-start gap-4">
                                    <DoctorAvatar
                                        name={doctor.name}
                                        initials={doctor.initials}
                                        specialty={doctor.specialty}
                                        specialtyCode={doctor.specialtyCode}
                                        size="md"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-display text-base font-extrabold text-clinic-navy leading-snug">
                                            {formatDoctorHeading(doctor)}
                                        </h3>
                                        <p className="mt-0.5 text-[13px] font-semibold text-clinic-cta">
                                            {doctor.specialty || 'Đa khoa'}
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-clinic-text-secondary">
                                            {specialtyMeta.services}
                                        </p>
                                        <dl className="mt-2.5 grid gap-1 text-[12.5px] text-clinic-text-secondary">
                                            <div>
                                                <dt className="inline">Phòng khám: </dt>
                                                <dd className="inline font-semibold text-clinic-navy">
                                                    {doctor.room || specialtyMeta.floor}
                                                </dd>
                                            </div>
                                            {doctor.experience && (
                                                <div>
                                                    <dt className="inline">Kinh nghiệm: </dt>
                                                    <dd className="inline font-semibold text-clinic-navy">{doctor.experience}</dd>
                                                </div>
                                            )}
                                            <div>
                                                <dt className="inline">Phí khám: </dt>
                                                <dd className="inline font-bold text-clinic-navy tabular-nums">
                                                    {formatConsultFee(doctor.fee || specialtyMeta.fee)} / ca 30 phút
                                                </dd>
                                            </div>
                                        </dl>
                                    </div>
                                </div>

                                <div className="lg:border-l lg:border-clinic-border lg:pl-6">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-clinic-navy tabular-nums">
                                            <Clock size={14} weight="bold" className="text-clinic-cta" />
                                            <span>Khung giờ nhận khám · {dateLabel}</span>
                                        </span>
                                        <Link
                                            to={doctorBookingPath}
                                            className="text-xs font-semibold text-clinic-cta hover:underline tabular-nums shrink-0"
                                        >
                                            {availableSlots.length > MAX_INLINE_SLOTS
                                                ? `Xem toàn bộ ${availableSlots.length} khung giờ`
                                                : 'Đặt lịch chi tiết'}
                                        </Link>
                                    </div>

                                    {slotsLoading && !entry ? (
                                        <p className="rounded-[6px] bg-clinic-bg p-3 text-xs text-clinic-text-muted">
                                            Đang kiểm tra lịch trống...
                                        </p>
                                    ) : entry?.failed ? (
                                        <p className="rounded-[6px] bg-clinic-bg p-3 text-xs text-clinic-text-secondary">
                                            Mở trang đặt lịch để xem chi tiết khung giờ làm việc.
                                        </p>
                                    ) : availableSlots.length === 0 ? (
                                        <div className="rounded-[6px] bg-clinic-bg p-3 text-xs text-clinic-text-secondary flex flex-wrap items-center justify-between gap-2">
                                            <span>Không còn khung giờ trống trong ngày này.</span>
                                            {selectedDate !== tomorrowDate && (
                                                <button
                                                    type="button"
                                                    onClick={() => updateSelectedDate(tomorrowDate)}
                                                    className="font-bold text-clinic-cta hover:underline cursor-pointer"
                                                >
                                                    Xem ngày mai
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-2">
                                            {visibleSlots.map((slot, index) => (
                                                <Link
                                                    key={slot.value}
                                                    to={buildQuickBookingPath({
                                                        specialtyId: doctor.specialtyId,
                                                        doctorId: doctor.id,
                                                        appointmentDate: selectedDate,
                                                        timeSlot: slot.value,
                                                        doctors,
                                                    })}
                                                    className={`clinical-slot-btn ${index === 0 ? 'clinical-slot-btn-featured' : ''}`}
                                                >
                                                    {slot.value}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </article>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
