import { useEffect, useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { useDispatch, useSelector } from 'react-redux'
import TriageStepper from '../../components/user/triage/TriageStepper'
import MainSymptomStep from '../../components/user/triage/MainSymptomStep'
import SymptomDetailsStep from '../../components/user/triage/SymptomDetailsStep'
import PatientContextStep from '../../components/user/triage/PatientContextStep'
import EmergencyAlert from '../../components/user/triage/EmergencyAlert'
import SpecialtyRecommendation from '../../components/user/triage/SpecialtyRecommendation'
import { analyzeSymptomsAsync } from '../../redux/actions/user/aiTriageAction'
import { clearTriageResult } from '../../redux/slices/user/userSlice'
import { ArrowRight, CaretLeft, Info, ShieldCheck } from '../../components/common/ClinicIcon'

const STEP_FIELDS = { 1: ['mainSymptom', 'location'], 2: ['onset', 'natures'] }

export default function SymptomSurveyPage() {
    const dispatch = useDispatch()
    const { triageLoading, triageError, triageResult } = useSelector((state) => state.user.user)
    const [step, setStep] = useState(1)

    useEffect(() => () => { dispatch(clearTriageResult()) }, [dispatch])

    const formik = useFormik({
        initialValues: { mainSymptom: '', quickSymptoms: [], location: '', onset: '', severity: 5, natures: [], associated: [], redFlags: [], medicalContext: '' },
        validationSchema: Yup.object({
            mainSymptom: Yup.string().trim().min(10, 'Vui lòng mô tả ít nhất 10 ký tự').max(500, 'Nội dung tối đa 500 ký tự').required('Vui lòng mô tả triệu chứng chính'),
            location: Yup.string().required('Vui lòng chọn vị trí khó chịu'),
            onset: Yup.string().required('Vui lòng chọn thời điểm bắt đầu'),
            natures: Yup.array().min(1, 'Vui lòng chọn ít nhất một tính chất triệu chứng'),
        }),
        onSubmit: (values) => dispatch(analyzeSymptomsAsync(values)),
    })

    const nextStep = async () => {
        const errors = await formik.validateForm()
        const fields = STEP_FIELDS[step] || []
        fields.forEach((field) => formik.setFieldTouched(field, true, false))
        if (fields.some((field) => errors[field])) return
        setStep((current) => Math.min(3, current + 1))
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const restart = () => { dispatch(clearTriageResult()); formik.resetForm(); setStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    const reviewAnswers = () => { dispatch(clearTriageResult()); setStep(3); window.scrollTo({ top: 0, behavior: 'smooth' }) }

    if (triageResult?.isEmergency) return <section className="min-h-[calc(100vh-72px)] bg-rose-50/50 py-10 sm:py-16 px-4"><EmergencyAlert reasons={triageResult.emergencyReasons} onReview={reviewAnswers}/></section>
    if (triageResult) return <section className="min-h-[calc(100vh-72px)] bg-[#F7FBFE] py-10 sm:py-16 px-4"><SpecialtyRecommendation result={triageResult} onRestart={restart}/></section>

    return <section className="min-h-[calc(100vh-72px)] bg-[#F7FBFE] py-8 sm:py-12"><div className="public-container"><div className="max-w-2xl mx-auto text-center"><span className="text-xs font-extrabold uppercase tracking-[.14em] text-[#008EC2]">Trợ lý phân luồng AI</span><h1 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold text-[#003553]">Khảo sát triệu chứng ban đầu</h1><p className="mt-2 text-sm leading-6 text-slate-500">Trả lời từng bước để nhận gợi ý chuyên khoa phù hợp. Thời gian khoảng 2 phút.</p></div><div className="mt-7 max-w-3xl mx-auto"><div className="mb-4 flex gap-3 rounded-xl border border-[#B8E5FA] bg-[#E8F4FD] p-4 text-xs leading-5 text-[#36566B]"><Info size={19} weight="fill" className="shrink-0 text-[#00B5F1]"/><p>AI chỉ hỗ trợ phân luồng chuyên khoa, không chẩn đoán và không kê thuốc. Khi có dấu hiệu nguy hiểm, hệ thống sẽ hướng dẫn cấp cứu.</p></div><main className="medpro-card p-5 sm:p-8"><TriageStepper currentStep={step}/><div className="my-7 border-t border-slate-100"/><form onSubmit={formik.handleSubmit} noValidate>{step === 1 && <MainSymptomStep formik={formik}/>} {step === 2 && <SymptomDetailsStep formik={formik}/>} {step === 3 && <PatientContextStep formik={formik}/>}</form>{triageError && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{triageError}</p>}<div className="mt-7 pt-5 border-t border-slate-100 flex items-center justify-between gap-3"><button type="button" disabled={step===1 || triageLoading} onClick={()=>setStep((current)=>Math.max(1,current-1))} className="medpro-btn-outline min-h-11 !px-5"><CaretLeft size={16}/>Quay lại</button>{step < 3 ? <button type="button" onClick={nextStep} className="medpro-btn-primary min-h-11 !px-6">Tiếp tục <ArrowRight size={16}/></button> : <button type="button" disabled={triageLoading} onClick={formik.submitForm} className="medpro-btn-primary min-h-11 !px-6">{triageLoading ? 'Đang phân tích...' : 'Nhận gợi ý chuyên khoa'}</button>}</div></main><div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-500"><ShieldCheck size={16} className="text-emerald-600"/>Câu trả lời khảo sát không được lưu trên trình duyệt.</div></div></div></section>
}
