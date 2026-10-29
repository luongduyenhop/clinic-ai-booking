import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import EmergencyAlert from '../../components/user/triage/EmergencyAlert'
import SpecialtyRecommendation from '../../components/user/triage/SpecialtyRecommendation'
import SymptomToggle from '../../components/user/triage/SymptomToggle'
import { symptomChips } from '../../data/user/triageQuestionData'
import { analyzeSymptomsAsync } from '../../redux/actions/user/aiTriageAction'
import { clearTriageResult } from '../../redux/slices/user/userSlice'
import { getEmergencyReasons } from '../../services/user/AiTriageService'

const contextFields = [
    ['age', 'Nhóm tuổi', [['age_newborn', 'Sơ sinh'], ['age_infant', 'Nhũ nhi'], ['age_child', 'Trẻ em'], ['age_adolescent', 'Vị thành niên'], ['age_adult', 'Người lớn'], ['age_older_adult', 'Cao tuổi']]],
    ['sex', 'Giới tính', [['sex_female', 'Nữ'], ['sex_male', 'Nam']]],
    ['duration', 'Thời gian', [['duration_hours', 'Vài giờ'], ['duration_1_3_days', '1–3 ngày'], ['duration_4_7_days', '4–7 ngày'], ['duration_1_4_weeks', '1–4 tuần'], ['duration_over_4_weeks', 'Trên 4 tuần']]],
    ['onset', 'Khởi phát', [['onset_sudden', 'Đột ngột'], ['onset_gradual', 'Từ từ'], ['onset_after_meal', 'Sau ăn'], ['onset_after_trauma', 'Sau chấn thương'], ['onset_after_infection', 'Sau nhiễm bệnh']]],
    ['severity', 'Mức độ', [['severity_mild', 'Nhẹ'], ['severity_moderate', 'Vừa'], ['severity_severe', 'Nặng']]],
]

export default function SymptomSurveyPage() {
    const dispatch = useDispatch()
    const { triageLoading, triageError, triageResult } = useSelector((state) => state.user.user)
    const [mainSymptom, setMainSymptom] = useState('')
    const [quickSymptoms, setQuickSymptoms] = useState([])
    const [structured, setStructured] = useState({})
    const [inputError, setInputError] = useState('')
    useEffect(() => () => { dispatch(clearTriageResult()) }, [dispatch])

    const payload = { mainSymptom, quickSymptoms, structured }
    const emergencyReasons = getEmergencyReasons(payload)
    const review = () => dispatch(clearTriageResult())
    const restart = () => { review(); setMainSymptom(''); setQuickSymptoms([]); setStructured({}); setInputError('') }
    const submit = (event) => {
        event.preventDefault()
        if (triageLoading) return
        const text = [mainSymptom.trim(), ...quickSymptoms].filter(Boolean).join(', ')
        if (text.length < 5) { setInputError('Mô tả thêm triệu chứng hoặc chọn gợi ý để AI có thông tin phân tích.'); return }
        setInputError('')
        dispatch(analyzeSymptomsAsync(payload))
    }

    if (triageResult?.isEmergency) return <section className="min-h-[calc(100vh-72px)] bg-rose-50/50 px-4 py-10"><EmergencyAlert reasons={triageResult.emergencyReasons} onReview={review}/></section>
    if (triageResult) return <section className="min-h-[calc(100vh-72px)] bg-[#F7FBFE] px-4 py-10"><SpecialtyRecommendation result={triageResult} onRestart={review}/><button type="button" onClick={restart} className="mx-auto mt-4 block text-sm text-slate-500 underline">Xóa thông tin và bắt đầu lại</button></section>

    return <section className="min-h-[calc(100vh-72px)] bg-[#F7FBFE] px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-3xl">
            <header className="mb-7 text-center"><p className="text-xs font-bold uppercase tracking-widest text-[#008EC2]">Trợ lý phân luồng AI</p><h1 className="mt-2 font-display text-2xl font-extrabold text-[#003553] sm:text-3xl">Bạn đang cảm thấy thế nào?</h1><p className="mt-3 text-sm leading-6 text-slate-500">Mô tả bằng lời của bạn và phân tích ngay. Bổ sung thông tin khi bạn thấy cần.</p></header>
            <form onSubmit={submit} noValidate className="medpro-card p-5 sm:p-8" aria-busy={triageLoading}>
                <fieldset disabled={triageLoading}>
                    <label htmlFor="symptom-description" className="auth-label">Mô tả triệu chứng</label>
                    <textarea id="symptom-description" value={mainSymptom} maxLength={1500} rows={5} onChange={(event) => { setMainSymptom(event.target.value); setInputError('') }} aria-invalid={Boolean(inputError)} aria-describedby="symptom-help" className="medpro-input mt-2 resize-y" placeholder="Ví dụ: Tôi bị đau họng, nghẹt mũi và ù tai từ hai ngày trước..."/>
                    <div id="symptom-help" className="mt-2 flex justify-between gap-3 text-xs text-slate-500"><span>Có thể nhập có dấu hoặc không dấu. Nếu biết, hãy mô tả vị trí và dấu hiệu đi kèm.</span><span className="shrink-0">{mainSymptom.length}/1500</span></div>
                    <div className="mt-5"><p className="mb-2 text-xs font-semibold text-slate-500">Thêm nhanh triệu chứng · tùy chọn</p><div className="flex flex-wrap gap-2">{symptomChips.map((item) => <SymptomToggle key={item} label={item} selected={quickSymptoms.includes(item)} onClick={() => setQuickSymptoms((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])}/>)}</div></div>
                    {emergencyReasons.length > 0 && <div role="alert" className="mt-5 rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-900"><h2 className="font-bold">Dấu hiệu cần cấp cứu: {emergencyReasons.join(', ')}</h2><p className="mt-2 text-sm">Gọi 115 hoặc đến cơ sở cấp cứu gần nhất. Không chờ hoàn tất phân tích AI.</p><a href="tel:115" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-rose-700 px-5 font-bold text-white">Gọi 115 ngay</a></div>}
                    <details className="mt-6 rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-bold text-[#003553]">Bổ sung thông tin <span className="font-normal text-slate-500">(không bắt buộc)</span></summary><p className="mt-3 text-xs leading-5 text-slate-500">Để trống nếu chưa rõ. AI sẽ nhận diện từ mô tả; các lựa chọn ở đây giúp làm rõ thêm.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{contextFields.map(([name, label, options]) => <div key={name}><label htmlFor={`context-${name}`} className="auth-label">{label}</label><select id={`context-${name}`} value={structured[name] || ''} onChange={(event) => setStructured((current) => ({ ...current, [name]: event.target.value }))} className="medpro-input min-h-12"><option value="">{name === 'sex' ? 'Không khai báo' : 'Tự nhận diện từ mô tả'}</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></div>)}</div></details>
                </fieldset>
                {(inputError || triageError) && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{inputError || triageError}</p>}
                <button type="submit" disabled={triageLoading} className="medpro-btn-primary mt-6 min-h-12 w-full disabled:opacity-60">{triageLoading ? 'Đang phân tích triệu chứng…' : emergencyReasons.length ? 'Xem hướng dẫn cấp cứu' : 'Phân tích và gợi ý chuyên khoa'}</button>
                <p className="mt-4 text-center text-xs leading-5 text-slate-500">Kết quả hỗ trợ chọn khoa, không thay thế chẩn đoán của bác sĩ.</p>
            </form>
        </div>
    </section>
}
