import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PatientPageHeader from '../../../components/user/patient/PatientPageHeader'
import { useMedicalCatalog } from '../../../services/user/MedicalCatalogService'
import { bookingService } from '../../../services/user/BookingService'
import { CalendarCheck, Clock, Stethoscope, CaretRight, Sparkle } from '../../../components/common/ClinicIcon'

const WEEKDAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

export default function DoctorSchedulesPage() {
    const { doctors, specialties, loading: catalogLoading, error: catalogError } = useMedicalCatalog()
    const [minDate] = useState(() => new Date().toLocaleDateString('en-CA'))
    const [date, setDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        return d.toLocaleDateString('en-CA')
    })
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const quickDates = Array.from({ length: 4 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() + i)
        const val = d.toLocaleDateString('en-CA')
        const label = i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : i === 2 ? 'Ngày kia' : WEEKDAY_NAMES[d.getDay()]
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
                if (active) setError(err.message)
            })
            .finally(() => {
                if (active) setLoading(false)
            })
        return () => {
            active = false
        }
    }, [doctors, date, catalogLoading, catalogError])

    const dateObj = new Date(date + 'T00:00:00')
    const formattedDisplayDate = isNaN(dateObj)
        ? date
        : `${WEEKDAY_NAMES[dateObj.getDay()]}, ngày ${String(dateObj.getDate()).padStart(2, '0')}/${String(
              dateObj.getMonth() + 1
          ).padStart(2, '0')}/${dateObj.getFullYear()}`

    return (
        <main className="space-y-6">
            <PatientPageHeader
                title="Lịch làm việc bác sĩ"
                description="Khung giờ khám còn trống được cập nhật trực tiếp theo thời gian thực từ phòng khám."
            />

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#008EC2]">
                            <CalendarCheck size={16} />
                            Chọn ngày xem ca trực
                        </div>
                        <h3 className="text-base font-extrabold text-[#003553] mt-1">
                            {formattedDisplayDate}
                        </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/80 border border-slate-200/60">
                            {quickDates.map((q) => (
                                <button
                                    key={q.val}
                                    type="button"
                                    onClick={() => setDate(q.val)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        date === q.val
                                            ? 'bg-white text-[#008EC2] shadow-xs'
                                            : 'text-slate-600 hover:text-[#003553]'
                                    }`}
                                >
                                    {q.label} ({q.day}/{q.month})
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                            <input
                                type="date"
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs focus:border-[#00B5F1] focus:outline-none"
                                min={minDate}
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {(catalogLoading || loading) && (
                <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-xs">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-solid border-[#00B5F1] border-r-transparent align-[-0.125em]" />
                    <p className="mt-3 text-sm font-semibold text-slate-600">
                        Đang đồng bộ ca trực và khung giờ trống từ phòng khám...
                    </p>
                </div>
            )}

            {(catalogError || error) && (
                <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
                    {catalogError || error}
                </div>
            )}

            {!catalogLoading && !loading && (
                <div className="grid gap-5 md:grid-cols-2">
                    {rows.map(({ doctor, slots, error: slotError }) => {
                        const specialtyName =
                            specialties.find((s) => s.id === doctor.specialtyId)?.name || doctor.specialty || 'Đa khoa'
                        const availableCount = slots.length

                        return (
                            <article
                                key={doctor.id}
                                className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs hover:border-[#8DDBF7] hover:shadow-md transition-all duration-200"
                            >
                                <div>
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#003553] to-[#005580] text-white font-extrabold text-base shadow-xs">
                                            {doctor.initials || doctor.name?.slice(0, 2)?.toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 border border-sky-100">
                                                    <Stethoscope size={13} />
                                                    {specialtyName}
                                                </span>
                                            </div>
                                            <h2 className="mt-1 text-base font-extrabold text-[#003553] truncate">
                                                {doctor.name}
                                            </h2>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {doctor.experience || 'Bác sĩ chuyên khoa tại Clinic-AI'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-5 border-t border-slate-100 pt-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                                <Clock size={15} className="text-[#00B5F1]" />
                                                Khung giờ khám còn trống
                                            </span>
                                            {availableCount > 0 && (
                                                <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                    {availableCount} ca trống
                                                </span>
                                            )}
                                        </div>

                                        {slotError ? (
                                            <p className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600 font-medium">
                                                {slotError}
                                            </p>
                                        ) : availableCount > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {slots.map((s) => (
                                                    <Link
                                                        key={s.value}
                                                        to={`/dat-lich?specialty=${doctor.specialtyId}&doctor=${doctor.id}&date=${date}&slot=${s.value}`}
                                                        className="group inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#003553] hover:border-[#00B5F1] hover:bg-[#00B5F1] hover:text-white transition-all shadow-2xs cursor-pointer"
                                                        title={`Đặt lịch lúc ${s.value}`}
                                                    >
                                                        <span>{s.value}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center">
                                                <p className="text-xs font-bold text-slate-500">
                                                    Hết khung giờ trống trong ngày này
                                                </p>
                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                    Vui lòng chọn ngày khám khác phía trên
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <div className="text-xs text-slate-500">
                                        <span>Phí khám dự kiến: </span>
                                        <strong className="text-sm font-extrabold text-[#003553]">
                                            {Number(doctor.price || 150000).toLocaleString('vi-VN')} đ
                                        </strong>
                                    </div>

                                    <Link
                                        to={`/dat-lich?specialty=${doctor.specialtyId}&doctor=${doctor.id}&date=${date}`}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#008EC2] to-[#00B5F1] px-4 py-2 text-xs font-extrabold text-white shadow-xs hover:shadow-md hover:brightness-105 transition-all"
                                    >
                                        <Sparkle size={14} weight="fill" />
                                        Đặt lịch khám
                                        <CaretRight size={14} />
                                    </Link>
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}
        </main>
    )
}
