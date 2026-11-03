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
import { ArrowRight, CaretLeft, ShieldCheck } from '../../components/common/ClinicIcon'

export default function BookingPage() {
    const [searchParams] = useSearchParams()
    const location = useLocation()
    const aiRecommendation = location.state?.aiRecommendation || null
    const { specialties, doctors, loading: catalogLoading, error: catalogError } = useMedicalCatalog()
    const dispatch = useDispatch()
    const { user, isAuthenticated } = useSelector((state) => state.app.auth)
    const { availableSlots, slotsLoading, loading, bookingError, latestBooking } = useSelector((state) => state.user.user)
    const requestedSpecialty = searchParams.get('specialty')
    const requestedDoctor = searchParams.get('doctor')
    const [step, setStep] = useState(1)
    const [booking, setBooking] = useState({ specialtyId: '', doctorId: '', appointmentDate: '', timeSlot: '' })

    useEffect(() => {
        if (catalogLoading || catalogError) return
        const specialty = specialties.find((item) => item.id === requestedSpecialty)
        const doctor = doctors.find((item) => item.id === requestedDoctor && item.specialtyId === specialty?.id)
        setBooking((prev) => ({ ...prev, specialtyId: specialty?.id || '', doctorId: doctor?.id || '' }))
    }, [catalogLoading, catalogError, specialties, doctors, requestedSpecialty, requestedDoctor])

    useEffect(() => () => { dispatch(clearLatestBooking()) }, [dispatch])
    useEffect(() => {
        if (booking.doctorId && booking.appointmentDate) dispatch(fetchAvailableSlotsAsync({ doctorId: booking.doctorId, appointmentDate: booking.appointmentDate }))
    }, [booking.doctorId, booking.appointmentDate, dispatch])

    const formik = useFormik({
        enableReinitialize: true,
        initialValues: { reason: '', accepted: false },
        validationSchema: Yup.object({
            reason: Yup.string().max(500, 'Nội dung tối đa 500 ký tự').required('Vui lòng mô tả ngắn lý do khám'),
            accepted: Yup.boolean().oneOf([true], 'Bạn cần đồng ý với chính sách bảo mật'),
        }),
        onSubmit: async (patient) => {
            if (!isAuthenticated) return
            if (slotsLoading || bookingError || !availableSlots.some((slot) => slot.available && slot.value === booking.timeSlot)) { setStep(2); return }
            const result = await dispatch(createPatientBookingAsync({ ...booking, patient, aiRecommendation }))
            if (createPatientBookingAsync.fulfilled.match(result)) window.scrollTo({ top: 0, behavior: 'smooth' })
        },
    })

    const updateBooking = (patch) => setBooking((current) => ({ ...current, ...patch }))
    const validSlot = !slotsLoading && !bookingError && availableSlots.some((slot) => slot.available && slot.value === booking.timeSlot)

    if (latestBooking) return <BookingSuccess booking={latestBooking} onReset={() => { setBooking({ specialtyId: '', doctorId: '', appointmentDate: '', timeSlot: '' }); setStep(1); formik.resetForm() }} />

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <BookingStepper currentStep={step} />
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    {step === 1 && <SpecialtyDoctorStep booking={booking} updateBooking={updateBooking} onNext={() => setStep(2)} />}
                    {step === 2 && <DateSlotStep booking={booking} updateBooking={updateBooking} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
                    {step === 3 && <PatientInfoStep formik={formik} booking={booking} onBack={() => setStep(2)} loading={loading} />}
                </div>
                <div className="space-y-4">
                    <BookingSummary booking={booking} formik={formik} currentStep={step} />
                </div>
            </div>
        </div>
    )
}
