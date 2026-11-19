import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import EmergencyAlert from '../../components/user/triage/EmergencyAlert'
import SpecialtyRecommendation from '../../components/user/triage/SpecialtyRecommendation'
import SymptomToggle from '../../components/user/triage/SymptomToggle'
import { symptomChips } from '../../data/user/triageQuestionData'
import { analyzeSymptomsAsync } from '../../redux/actions/user/aiTriageAction'
import { clearTriageResult } from '../../redux/slices/user/userSlice'
import { getEmergencyReasons } from '../../services/user/AiTriageService'
import { PhoneCall } from '../../components/common/ClinicIcon'

const contextFields = [
    [
        'age',
        'Nhóm tuổi',
        [
            ['age_newborn', 'Sơ sinh'],
            ['age_infant', 'Nhũ nhi'],
            ['age_child', 'Trẻ em'],
            ['age_adolescent', 'Vị thành niên'],
            ['age_adult', 'Người lớn'],
            ['age_older_adult', 'Cao tuổi'],
        ],
    ],
    [
        'sex',
        'Giới tính',
        [
            ['sex_female', 'Nữ'],
            ['sex_male', 'Nam'],
        ],
    ],
    [
        'duration',
        'Thời gian',
        [
            ['duration_hours', 'Vài giờ'],
            ['duration_1_3_days', '1–3 ngày'],
            ['duration_4_7_days', '4–7 ngày'],
            ['duration_1_4_weeks', '1–4 tuần'],
            ['duration_over_4_weeks', 'Trên 4 tuần'],
        ],
    ],
    [
        'onset',
        'Khởi phát',
        [
            ['onset_sudden', 'Đột ngột'],
            ['onset_gradual', 'Từ từ'],
            ['onset_after_meal', 'Sau ăn'],
            ['onset_after_trauma', 'Sau chấn thương'],
            ['onset_after_infection', 'Sau nhiễm bệnh'],
        ],
    ],
    [
        'severity',
        'Mức độ',
        [
            ['severity_mild', 'Nhẹ'],
            ['severity_moderate', 'Vừa'],
            ['severity_severe', 'Nặng'],
        ],
    ],
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
    const restart = () => {
        review()
        setMainSymptom('')
        setQuickSymptoms([])
        setStructured({})
        setInputError('')
    }

    const submit = (event) => {
        event.preventDefault()
        if (triageLoading) return
        const text = [mainSymptom.trim(), ...quickSymptoms].filter(Boolean).join(', ')
        if (text.length < 5) {
            setInputError('Mô tả thêm triệu chứng hoặc chọn gợi ý để hệ thống có cơ sở định hướng chuyên khoa.')
            return
        }
        setInputError('')
        dispatch(analyzeSymptomsAsync(payload))
    }

    if (triageResult?.isEmergency) {
        return (
            <section className="min-h-[calc(100vh-102px)] bg-clinic-danger-bg px-4 py-10">
                <EmergencyAlert reasons={triageResult.emergencyReasons} onReview={review} />
            </section>
        )
    }

    if (triageResult) {
        return (
            <section className="min-h-[calc(100vh-102px)] bg-clinic-bg px-4 py-10">
                <SpecialtyRecommendation
                    result={triageResult}
                    symptoms={[mainSymptom.trim(), ...quickSymptoms].filter(Boolean).join(', ')}
                    onRestart={review}
                />
                <button
                    type="button"
                    onClick={restart}
                    className="mx-auto mt-4 block text-sm font-semibold text-clinic-text-secondary underline hover:text-clinic-navy cursor-pointer"
                >
                    Xóa thông tin và khai báo lại
                </button>
            </section>
        )
    }

    return (
        <section className="min-h-[calc(100vh-102px)] bg-clinic-bg px-4 py-8 sm:py-12">
            <div className="mx-auto max-w-3xl">
                <div className="mb-7">
                    <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-clinic-navy">
                        Kiểm tra triệu chứng & gợi ý chuyên khoa khám
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-clinic-text-secondary">
                        Mô tả triệu chứng hiện tại để hệ thống đối chiếu danh mục lâm sàng và gợi ý chuyên khoa tiếp nhận phù hợp.
                    </p>
                </div>

                <form onSubmit={submit} noValidate className="medpro-card p-5 sm:p-8" aria-busy={triageLoading}>
                    <fieldset disabled={triageLoading}>
                        <legend className="sr-only">Biểu mẫu đánh giá sức khỏe</legend>
                        <label htmlFor="symptom-description" className="auth-label">
                            Mô tả triệu chứng hiện tại
                        </label>
                        <textarea
                            id="symptom-description"
                            value={mainSymptom}
                            maxLength={1500}
                            rows={5}
                            onChange={(event) => {
                                setMainSymptom(event.target.value)
                                setInputError('')
                            }}
                            aria-invalid={Boolean(inputError)}
                            aria-describedby="symptom-help"
                            className="medpro-input mt-1.5 resize-y"
                            placeholder="Ví dụ: Tôi bị đau họng, nghẹt mũi và ù tai từ hai ngày trước..."
                        />
                        <div id="symptom-help" className="mt-2 flex justify-between gap-3 text-xs text-clinic-text-muted">
                            <span>Có thể nhập tiếng Việt có dấu hoặc không dấu; nêu rõ vị trí đau và dấu hiệu đi kèm.</span>
                            <span className="shrink-0 tabular-nums">{mainSymptom.length}/1500</span>
                        </div>

                        <div className="mt-5">
                            <p className="mb-2 text-xs font-bold text-clinic-navy">
                                Triệu chứng thường gặp (tùy chọn)
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {symptomChips.map((item) => (
                                    <SymptomToggle
                                        key={item}
                                        label={item}
                                        selected={quickSymptoms.includes(item)}
                                        onClick={() =>
                                            setQuickSymptoms((current) =>
                                                current.includes(item)
                                                    ? current.filter((value) => value !== item)
                                                    : [...current, item]
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        </div>

                        {emergencyReasons.length > 0 && (
                            <div role="alert" className="mt-5 rounded-[8px] border border-clinic-danger-border bg-clinic-danger-bg p-4 text-clinic-danger">
                                <h2 className="font-bold">Dấu hiệu cần cấp cứu: {emergencyReasons.join(', ')}</h2>
                                <p className="mt-2 text-sm text-clinic-text">
                                    Gọi 115 hoặc đến cơ sở cấp cứu gần nhất. Không chờ hoàn tất phân tích hệ thống.
                                </p>
                                <a
                                    href="tel:115"
                                    className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-clinic-danger px-5 font-bold text-clinic-surface hover:opacity-90 tabular-nums"
                                >
                                    <PhoneCall size={18} weight="fill" />
                                    <span>Gọi 115 ngay</span>
                                </a>
                            </div>
                        )}

                        <details className="mt-6 rounded-[8px] border border-clinic-border bg-clinic-bg p-4">
                            <summary className="cursor-pointer text-sm font-bold text-clinic-navy">
                                Bổ sung thông tin lâm sàng{' '}
                                <span className="font-normal text-clinic-text-muted">(không bắt buộc)</span>
                            </summary>
                            <p className="mt-2.5 text-xs leading-5 text-clinic-text-secondary">
                                Có thể bỏ qua nếu chưa xác định; các lựa chọn dưới đây giúp thu hẹp chuyên khoa chính xác hơn.
                            </p>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                {contextFields.map(([name, label, options]) => (
                                    <div key={name}>
                                        <label htmlFor={`context-${name}`} className="auth-label">
                                            {label}
                                        </label>
                                        <select
                                            id={`context-${name}`}
                                            value={structured[name] || ''}
                                            onChange={(event) =>
                                                setStructured((current) => ({ ...current, [name]: event.target.value }))
                                            }
                                            className="medpro-input min-h-11"
                                        >
                                            <option value="">{name === 'sex' ? 'Không khai báo' : 'Tự nhận diện từ mô tả'}</option>
                                            {options.map(([value, text]) => (
                                                <option key={value} value={value}>
                                                    {text}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </details>
                    </fieldset>

                    {(inputError || triageError) && (
                        <p role="alert" className="mt-4 rounded-[8px] border border-clinic-danger-border bg-clinic-danger-bg p-3.5 text-sm text-clinic-danger">
                            {inputError || triageError}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={triageLoading}
                        className="medpro-btn-primary mt-6 min-h-11 w-full"
                    >
                        {triageLoading
                            ? 'Đang đối chiếu dữ liệu triệu chứng...'
                            : emergencyReasons.length
                              ? 'Xem hướng dẫn cấp cứu'
                              : 'Phân tích & gợi ý chuyên khoa'}
                    </button>

                    <p className="mt-4 text-center text-xs leading-5 text-clinic-text-muted">
                        Kết quả chỉ hỗ trợ định hướng chọn chuyên khoa, không thay thế chẩn đoán lâm sàng của bác sĩ.
                    </p>
                </form>
            </div>
        </section>
    )
}
