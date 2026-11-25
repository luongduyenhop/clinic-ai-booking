import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PatientPageHeader from '../../../components/user/patient/PatientPageHeader'
import { useMedicalCatalog } from '../../../services/user/MedicalCatalogService'
import { bookingService } from '../../../services/user/BookingService'
import { CalendarCheck, Clock, Stethoscope } from '../../../components/common/ClinicIcon'
import DoctorAvatar from '../../../components/common/DoctorAvatar'
import { toFriendlyErrorMessage } from '../../../utils/helpers/clientErrorHelper'
import {
    buildQuickBookingPath,
    formatConsultFee,
    formatDoctorHeading,
    getDefaultScheduleDate,
    getOffsetIsoDate,
    getSpecialtyClinicalMetadata,
    getTodayIsoDate,
} from '../../../utils/helpers/quickBookingHelpers'

const WEEKDAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

export default function DoctorSchedulesPage() {
    const { doctors, specialties, loading: catalogLoading, error: catalogError } = useMedicalCatalog()
    const [minDate] = useState(() => getTodayIsoDate())
    const [date, setDate] = useState(() => getDefaultScheduleDate())
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const quickDates = Array.from({ length: 4 }, (_, i) => {
        const val = getOffsetIsoDate(i)
        const d = new Date(`${val}T00:00:00`)
        const label =
            i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : i === 2 ? 'Ngày kia' : WEEKDAY_NAMES[d.getDay()]
        return { val, label, day: d.getDate(), month: d.getMonth() + 1 }
    })

    useEffect(() => {
        let active = true
        if (catalogLoading || catalogError) return
        setLoading(true)
        setError('')
        Promise.all(
            doctors.map(async (doctor) => {
                try {
                    const slots = await bookingService.getAvailableSlots({
                        doctorId: doctor.id,
                        appointmentDate: date,
                    })
                    return { doctor, slots }
                } catch (err) {
                    return {
                        doctor,
                        slots: [],
                        error: err.response?.data?.message || 'Không thể tải lịch bác sĩ',
                    }
                }
            })
        )
            .then((data) => {
                if (active) setRows(data)
            })
            .catch((err) => {
                if (active) {
                    setError(
                        toFriendlyErrorMessage(
                            err,
                            'Chưa tải được lịch khám. Bạn thử lại sau ít phút hoặc gọi 1900 6868.'
                        )
                    )
                }
            })
            .finally(() => {
                if (active) setLoading(false)
            })
        return () => {
            active = false
        }
    }, [doctors, date, catalogLoading, catalogError])

    const dateObj = new Date(`${date}T00:00:00`)
    const formattedDisplayDate = Number.isNaN(dateObj.getTime())
        ? date
        : `${WEEKDAY_NAMES[dateObj.getDay()]}, ngày ${String(dateObj.getDate()).padStart(2, '0')}/${String(
              dateObj.getMonth() + 1
          ).padStart(2, '0')}/${dateObj.getFullYear()}`

    return (
        <div className="space-y-6">
            <PatientPageHeader
                title="Lịch làm việc bác sĩ"
                description="Khung giờ khám còn trống được cập nhật trực tiếp từ phòng khám."
            />

            <div className="medpro-card p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold text-clinic-cta flex items-center gap-1.5">
                            <CalendarCheck size={16} />
                            <span>Chọn ngày xem ca trực</span>
                        </p>
                        <h2 className="font-display text-base font-extrabold text-clinic-navy mt-1 tabular-nums">
                            {formattedDisplayDate}
                        </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {quickDates.map((q) => (
                                <button
                                    key={q.val}
                                    type="button"
                                    onClick={() => setDate(q.val)}
                                    className={`px-3 py-1.5 rounded-[6px] text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                                        date === q.val
                                            ? 'bg-clinic-navy text-clinic-surface'
                                            : 'bg-clinic-bg-muted text-clinic-text-secondary hover:text-clinic-navy'
                                    }`}
                                >
                                    {q.label} ({q.day}/{q.month})
                                </button>
                            ))}
                        </div>

                        <input
                            type="date"
                            aria-label="Chọn ngày xem lịch bác sĩ"
                            className="medpro-input min-h-[36px] w-auto py-1 px-3 text-xs font-semibold tabular-nums"
                            min={minDate}
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {(catalogLoading || loading) && (
                <div className="medpro-card p-8 text-center text-sm text-clinic-text-secondary">
                    Đang đồng bộ ca trực và khung giờ trống từ phòng khám...
                </div>
            )}

            {(catalogError || error) && (
                <div
                    role="alert"
                    className="medpro-card border-clinic-danger-border bg-clinic-danger-bg p-4 text-sm font-medium text-clinic-danger"
                >
                    {catalogError || error}
                </div>
            )}

            {!catalogLoading && !loading && (
                <div className="grid gap-5 md:grid-cols-2">
                    {rows.map(({ doctor, slots, error: slotError }) => {
                        const specialtyName =
                            specialties.find((s) => s.id === doctor.specialtyId)?.name ||
                            doctor.specialty ||
                            'Đa khoa'
                        const specialtyMeta = getSpecialtyClinicalMetadata(
                            doctor.specialtyCode || specialtyName
                        )
                        const availableCount = slots.length

                        return (
                            <article
                                key={doctor.id}
                                className="medpro-card p-5 sm:p-6 flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start gap-4">
                                        <DoctorAvatar
                                            name={doctor.name}
                                            initials={doctor.initials}
                                            specialty={doctor.specialty || specialtyName}
                                            specialtyCode={doctor.specialtyCode}
                                            size="md"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <span className="inline-flex items-center gap-1 rounded-[6px] bg-clinic-surface-alt px-2 py-0.5 text-[11px] font-bold text-clinic-cta">
                                                <Stethoscope size={13} />
                                                <span>{specialtyName}</span>
                                            </span>
                                            <h3 className="mt-1 font-display text-base font-extrabold text-clinic-navy truncate">
                                                {formatDoctorHeading(doctor)}
                                            </h3>
                                            <p className="text-xs leading-5 text-clinic-text-secondary mt-0.5">
                                                {specialtyMeta.services}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-5 border-t border-clinic-border pt-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-bold text-clinic-navy flex items-center gap-1.5">
                                                <Clock size={15} className="text-clinic-cta" />
                                                <span>Khung giờ khám còn trống</span>
                                            </span>
                                            {availableCount > 0 && (
                                                <span className="medpro-badge-success tabular-nums">
                                                    {availableCount} ca trống
                                                </span>
                                            )}
                                        </div>

                                        {slotError ? (
                                            <p className="rounded-[6px] bg-clinic-danger-bg p-3 text-xs text-clinic-danger font-medium">
                                                {slotError}
                                            </p>
                                        ) : availableCount > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {slots.map((s) => (
                                                    <Link
                                                        key={s.value}
                                                        to={buildQuickBookingPath({
                                                            specialtyId: doctor.specialtyId,
                                                            doctorId: doctor.id,
                                                            appointmentDate: date,
                                                            timeSlot: s.value,
                                                            doctors,
                                                        })}
                                                        className="clinical-slot-btn text-xs tabular-nums"
                                                        title={`Đặt lịch lúc ${s.value}`}
                                                    >
                                                        {s.value}
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="rounded-[6px] bg-clinic-bg p-3.5 text-xs text-clinic-text-secondary">
                                                Hết khung giờ trống trong ngày này. Vui lòng chọn ngày khám khác phía trên.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-5 pt-4 border-t border-clinic-border flex items-center justify-between">
                                    <div className="text-xs text-clinic-text-secondary">
                                        <span>Phí khám: </span>
                                        <strong className="text-sm font-extrabold text-clinic-navy tabular-nums">
                                            {formatConsultFee(
                                                doctor.fee || doctor.price || specialtyMeta.fee
                                            )}
                                        </strong>
                                    </div>

                                    <Link
                                        to={buildQuickBookingPath({
                                            specialtyId: doctor.specialtyId,
                                            doctorId: doctor.id,
                                            appointmentDate: date,
                                            doctors,
                                        })}
                                        className="medpro-btn-primary text-xs px-4 py-2"
                                    >
                                        Đặt lịch khám
                                    </Link>
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
