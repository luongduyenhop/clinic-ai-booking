import { useEffect, useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useSearchParams } from 'react-router-dom'
import BookingStepper from '../../components/user/booking/BookingStepper'
import SpecialtyDoctorStep from '../../components/user/booking/SpecialtyDoctorStep'
import DateSlotStep from '../../components/user/booking/DateSlotStep'
import PatientInfoStep from '../../components/user/booking/PatientInfoStep'
import BookingSummary from '../../components/user/booking/BookingSummary'
import BookingSuccess from '../../components/user/booking/BookingSuccess'
import { useMedicalCatalog } from '../../services/user/MedicalCatalogService'
import { createPatientBookingAsync, fetchAvailableSlotsAsync } from '../../redux/actions/user/bookingAction'
import { clearLatestBooking } from '../../redux/slices/user/userSlice'
import { resolveBookingPrefill } from '../../utils/helpers/quickBookingHelpers'
import { ArrowLeft, ArrowRight, ShieldCheck } from '../../components/common/ClinicIcon'

export default function BookingPage() {
    const [searchParams] = useSearchParams()
    const location = useLocation()
    const aiRecommendation = location.state?.aiRecommendation || null
    const { specialties, doctors, loading: catalogLoading, error: catalogError } = useMedicalCatalog()
    const dispatch = useDispatch()
    const { user, isAuthenticated } = useSelector((state) => state.app.auth)
    const { availableSlots, slotsLoading, loading, bookingError, latestBooking } = useSelector((state) => state.user.user)
    const requestedSpecialty = searchParams.get('specialty') || ''
    const requestedDoctor = searchParams.get('doctor') || ''
    const requestedDate = searchParams.get('date') || ''
    const requestedSlot = searchParams.get('slot') || ''
    const [step, setStep] = useState(1)
    const [booking, setBooking] = useState({ specialtyId: '', doctorId: '', appointmentDate: '', timeSlot: '' })
    const [slotConflict, setSlotConflict] = useState(null)

    useEffect(() => {
        if (catalogLoading || catalogError) return
        const resolved = resolveBookingPrefill({
            specialties,
            doctors,
            requestedSpecialty,
            requestedDoctor,
            requestedDate,
            requestedSlot,
        })
        setBooking(resolved.booking)
        setStep(resolved.initialStep)
    }, [catalogLoading, catalogError, specialties, doctors, requestedSpecialty, requestedDoctor, requestedDate, requestedSlot])

    useEffect(() => () => { dispatch(clearLatestBooking()) }, [dispatch])
    useEffect(() => {
        if (booking.doctorId && booking.appointmentDate) dispatch(fetchAvailableSlotsAsync({ doctorId: booking.doctorId, appointmentDate: booking.appointmentDate }))
    }, [booking.doctorId, booking.appointmentDate, dispatch])

    const formik = useFormik({
        enableReinitialize: true,
        initialValues: { reason: '', accepted: false },
        validationSchema: Yup.object({
            reason: Yup.string().max(500, 'Nội dung tối đa 500 ký tự'),
            accepted: Yup.boolean().oneOf([true], 'Bạn cần đồng ý với chính sách bảo mật'),
        }),
        onSubmit: async (patient) => {
            if (!isAuthenticated) return
            if (slotsLoading || bookingError || !availableSlots.some((slot) => slot.available && slot.value === booking.timeSlot)) { setStep(2); return }
            const result = await dispatch(createPatientBookingAsync({ ...booking, patient, aiRecommendation }))
            if (createPatientBookingAsync.fulfilled.match(result)) window.scrollTo({ top: 0, behavior: 'smooth' })
            else if (result.payload?.status === 409) {
                setSlotConflict({ date: booking.appointmentDate, timeSlot: booking.timeSlot })
                updateBooking({ timeSlot: '' })
                setStep(2)
                dispatch(fetchAvailableSlotsAsync({ doctorId: booking.doctorId, appointmentDate: booking.appointmentDate }))
            }
        },
    })

    const updateBooking = (patch) => setBooking((current) => {
        const next = { ...current, ...patch }
        const specialtyChanged = 'specialtyId' in patch && patch.specialtyId !== current.specialtyId
        const doctorChanged = 'doctorId' in patch && patch.doctorId !== current.doctorId
        if (specialtyChanged || doctorChanged) {
            if (current.timeSlot || (doctorChanged && current.doctorId)) {
                next.appointmentDate = ''
            }
            next.timeSlot = ''
        }
        return next
    })
    const validSlot = !slotsLoading && !bookingError && availableSlots.some((slot) => slot.available && slot.value === booking.timeSlot)
    const canContinueToSlots = Boolean(booking.specialtyId && booking.doctorId)
    const canContinueToPatient = Boolean(booking.appointmentDate && booking.timeSlot && validSlot)

    if (latestBooking) return (
        <section className="bg-clinic-bg py-10 sm:py-16 px-4 min-h-[calc(100vh-72px)]">
            <BookingSuccess
                booking={latestBooking}
                specialties={specialties}
                doctors={doctors}
                onBookAnother={() => {
                    setBooking({ specialtyId: '', doctorId: '', appointmentDate: '', timeSlot: '' })
                    setStep(1)
                    formik.resetForm()
                    dispatch(clearLatestBooking())
                }}
            />
        </section>
    )

    if (catalogLoading) return <p className="public-container py-12 text-clinic-text-secondary">Đang tải bác sĩ và chuyên khoa từ phòng khám...</p>
    if (catalogError) return <p role="alert" className="public-container py-12 text-clinic-danger">{catalogError}</p>

    return (
        <section className="bg-clinic-bg py-8 sm:py-12 min-h-[calc(100vh-72px)]">
            <div className="public-container">
                <div className="max-w-2xl">
                    <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-clinic-cta">Đặt lịch trực tuyến</span>
                    <h1 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold text-clinic-navy">Đặt lịch khám trong 3 bước</h1>
                    <p className="mt-2 text-sm text-clinic-text-secondary">Chọn lịch phù hợp và nhận mã hẹn ngay sau khi hoàn tất.</p>
                    {aiRecommendation && (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-[8px] border border-clinic-info-border bg-clinic-surface-alt px-3 py-1.5 text-xs text-clinic-navy">
                            <span>Đã áp dụng kết quả gợi ý AI: <strong>{aiRecommendation.specialtyName}</strong></span>
                        </div>
                    )}
                </div>

                <div className="mt-7 grid lg:grid-cols-[1fr_310px] gap-6 items-start">
                    <main className="medpro-card p-5 sm:p-7">
                        <BookingStepper currentStep={step} />
                        <div className="my-7 border-t border-clinic-border" />

                        {step === 1 && (
                            <>
                                <SpecialtyDoctorStep
                                    values={booking}
                                    onChange={updateBooking}
                                    specialties={specialties}
                                    doctors={doctors}
                                    loading={catalogLoading}
                                    error={catalogError}
                                />
                                <div className="flex justify-end border-t border-clinic-border pt-5">
                                    <button
                                        type="button"
                                        className="medpro-btn-primary"
                                        disabled={!canContinueToSlots || catalogLoading}
                                        onClick={() => setStep(2)}
                                    >
                                        <span>Tiếp tục chọn ngày giờ</span>
                                        <ArrowRight size={15} weight="bold" />
                                    </button>
                                </div>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <DateSlotStep
                                    appointmentDate={booking.appointmentDate}
                                    timeSlot={booking.timeSlot}
                                    slots={availableSlots}
                                    loading={slotsLoading}
                                    error={bookingError}
                                    slotConflict={slotConflict}
                                    onDateChange={(appointmentDate) => {
                                        if (appointmentDate !== slotConflict?.date) setSlotConflict(null)
                                        updateBooking({ appointmentDate, timeSlot: '' })
                                    }}
                                    onSlotChange={(timeSlot) => updateBooking({ timeSlot })}
                                />
                                {bookingError && (
                                    <p role="alert" className="mt-5 rounded-[8px] border border-clinic-danger-border bg-clinic-danger-bg p-3 text-xs text-clinic-danger">
                                        {bookingError}
                                        <button
                                            type="button"
                                            className="ml-3 font-bold underline cursor-pointer"
                                            onClick={() => {
                                                updateBooking({ timeSlot: '' })
                                                dispatch(fetchAvailableSlotsAsync({ doctorId: booking.doctorId, appointmentDate: booking.appointmentDate }))
                                            }}
                                        >
                                            Tải lại khung giờ
                                        </button>
                                    </p>
                                )}
                                <div className="flex justify-between border-t border-clinic-border pt-5">
                                    <button type="button" className="medpro-btn-outline" onClick={() => setStep(1)}>
                                        <ArrowLeft size={15} weight="bold" />
                                        <span>Quay lại</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="medpro-btn-primary"
                                        disabled={!canContinueToPatient}
                                        onClick={() => setStep(3)}
                                    >
                                        <span>Tiếp tục xác nhận</span>
                                        <ArrowRight size={15} weight="bold" />
                                    </button>
                                </div>
                            </>
                        )}

                        {step === 3 && (
                            <PatientInfoStep
                                formik={formik}
                                user={user}
                                isAuthenticated={isAuthenticated}
                                loading={loading}
                                error={bookingError}
                                onBack={() => setStep(2)}
                            />
                        )}
                    </main>

                    <div className="space-y-4">
                        <BookingSummary booking={booking} specialties={specialties} doctors={doctors} />
                        <div className="mt-4 flex gap-2 rounded-[8px] border border-clinic-success-border bg-clinic-success-bg p-3 text-[11px] leading-5 text-clinic-success">
                            <ShieldCheck size={18} weight="fill" className="shrink-0" />
                            Thông tin người khám được dùng để xác nhận và phục vụ lịch hẹn.
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
