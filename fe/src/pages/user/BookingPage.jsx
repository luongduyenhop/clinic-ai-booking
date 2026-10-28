import { useEffect, useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import BookingStepper from '../../components/user/booking/BookingStepper'
import SpecialtyDoctorStep from '../../components/user/booking/SpecialtyDoctorStep'
import DateSlotStep from '../../components/user/booking/DateSlotStep'
import PatientInfoStep from '../../components/user/booking/PatientInfoStep'
import BookingSummary from '../../components/user/booking/BookingSummary'
import BookingSuccess from '../../components/user/booking/BookingSuccess'
import { doctors, specialties } from '../../data/user/publicPortalData'
import { createPatientBookingAsync, fetchAvailableSlotsAsync } from '../../redux/actions/user/bookingAction'
import { clearLatestBooking } from '../../redux/slices/user/userSlice'
import { ArrowRight, CaretLeft, ShieldCheck } from '../../components/common/ClinicIcon'

const MAX_BIRTH_DATE = new Date()

export default function BookingPage() {
    const [searchParams] = useSearchParams()
    const dispatch = useDispatch()
    const { user } = useSelector((state) => state.app.auth)
    const { availableSlots, slotsLoading, loading, bookingError, latestBooking } = useSelector((state) => state.user.user)
    const requestedSpecialty = searchParams.get('specialty')
    const requestedDoctor = searchParams.get('doctor')
    const validSpecialty = specialties.some((item) => item.id === requestedSpecialty) ? requestedSpecialty : ''
    const validDoctor = doctors.some((item) => item.id === requestedDoctor && item.specialtyId === validSpecialty) ? requestedDoctor : ''
    const [step, setStep] = useState(1)
    const [booking, setBooking] = useState({ specialtyId: validSpecialty, doctorId: validDoctor, appointmentDate: '', timeSlot: '' })

    useEffect(() => () => { dispatch(clearLatestBooking()) }, [dispatch])
    useEffect(() => {
        if (booking.doctorId && booking.appointmentDate) dispatch(fetchAvailableSlotsAsync({ doctorId: booking.doctorId, appointmentDate: booking.appointmentDate }))
    }, [booking.doctorId, booking.appointmentDate, dispatch])

    const formik = useFormik({
        enableReinitialize: true,
        initialValues: { fullName: user?.fullName || '', phone: user?.phone || '', birthDate: user?.birthDate || '', gender: user?.gender || '', email: user?.email || '', reason: '', accepted: false },
        validationSchema: Yup.object({
            fullName: Yup.string().min(2, 'Họ tên chưa hợp lệ').required('Vui lòng nhập họ và tên'),
            phone: Yup.string().matches(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0').required('Vui lòng nhập số điện thoại'),
            birthDate: Yup.date().max(MAX_BIRTH_DATE, 'Ngày sinh không hợp lệ').required('Vui lòng chọn ngày sinh'),
            gender: Yup.string().required('Vui lòng chọn giới tính'),
            email: Yup.string().email('Email chưa đúng định dạng'),
            reason: Yup.string().max(500, 'Nội dung tối đa 500 ký tự').required('Vui lòng mô tả ngắn lý do khám'),
            accepted: Yup.boolean().oneOf([true], 'Bạn cần đồng ý với chính sách bảo mật'),
        }),
        onSubmit: async (patient) => {
            const result = await dispatch(createPatientBookingAsync({ ...booking, patient }))
            if (createPatientBookingAsync.fulfilled.match(result)) window.scrollTo({ top: 0, behavior: 'smooth' })
        },
    })

    const updateBooking = (patch) => setBooking((current) => ({ ...current, ...patch }))
    const canContinue = step === 1 ? booking.specialtyId && booking.doctorId : booking.appointmentDate && booking.timeSlot
    const resetBooking = () => { dispatch(clearLatestBooking()); setStep(1); setBooking({ specialtyId: '', doctorId: '', appointmentDate: '', timeSlot: '' }); formik.resetForm(); window.scrollTo({ top: 0, behavior: 'smooth' }) }

    if (latestBooking) return <section className="bg-[#F7FBFE] py-10 sm:py-16 px-4 min-h-[calc(100vh-72px)]"><BookingSuccess booking={latestBooking} onBookAnother={resetBooking}/></section>

    return <section className="bg-[#F7FBFE] py-8 sm:py-12 min-h-[calc(100vh-72px)]"><div className="public-container"><div className="max-w-2xl"><span className="text-xs font-extrabold uppercase tracking-[.14em] text-[#008EC2]">Đặt lịch trực tuyến</span><h1 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold text-[#003553]">Đặt lịch khám trong 3 bước</h1><p className="mt-2 text-sm text-slate-500">Chọn lịch phù hợp và nhận mã hẹn ngay sau khi hoàn tất.</p></div><div className="mt-7 grid lg:grid-cols-[1fr_310px] gap-5 items-start"><main className="medpro-card p-5 sm:p-7"><BookingStepper currentStep={step}/><div className="my-7 border-t border-slate-100"/>{step === 1 && <SpecialtyDoctorStep values={booking} onChange={(patch) => updateBooking({ ...patch, appointmentDate: '', timeSlot: '' })}/>} {step === 2 && <DateSlotStep appointmentDate={booking.appointmentDate} timeSlot={booking.timeSlot} slots={availableSlots} loading={slotsLoading} onDateChange={(value) => updateBooking({ appointmentDate: value, timeSlot: '' })} onSlotChange={(value) => updateBooking({ timeSlot: value })}/>} {step === 3 && <PatientInfoStep formik={formik}/>} {bookingError && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{bookingError}</p>}<div className="mt-7 pt-5 border-t border-slate-100 flex items-center justify-between gap-3"><button type="button" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || loading} className="medpro-btn-outline min-h-11 !px-5"><CaretLeft size={16}/>Quay lại</button>{step < 3 ? <button type="button" disabled={!canContinue} onClick={() => setStep((current) => current + 1)} className="medpro-btn-primary min-h-11 !px-6">Tiếp tục <ArrowRight size={16}/></button> : <button type="button" disabled={loading} onClick={formik.submitForm} className="medpro-btn-primary min-h-11 !px-6">{loading ? 'Đang xác nhận...' : 'Xác nhận đặt lịch'}</button>}</div></main><div><BookingSummary booking={booking}/><div className="mt-4 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] leading-5 text-emerald-800"><ShieldCheck size={18} weight="fill" className="shrink-0"/>Thông tin người khám được dùng để xác nhận và phục vụ lịch hẹn.</div></div></div></div></section>
}
