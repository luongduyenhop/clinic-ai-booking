import { Link } from 'react-router-dom'
import { ArrowRight, Info, Robot, Stethoscope } from '../../common/ClinicIcon'
import { useMedicalCatalog } from '../../../services/user/MedicalCatalogService'

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/\bkhoa\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

export default function SpecialtyRecommendation({ result, symptoms, onRestart }) {
    const { specialties } = useMedicalCatalog()
    return (
        <section className="max-w-3xl mx-auto medpro-card p-6 sm:p-9">
            <div className="text-center">
                <Robot size={34} className="text-[#00A9E3] mx-auto" />
                <h1 className="mt-5 font-display text-2xl font-extrabold text-[#003553]">Gợi ý chuyên khoa phù hợp</h1>
                <p className="mt-2 text-sm">Độ tin cậy: <strong>{result.confidence}%</strong></p>
            </div>
            {result.needsHumanSupport && (
                <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 flex items-center gap-2">
                    <Info size={18} /> Triệu chứng chưa đủ rõ; nên gặp nhân viên y tế để được tư vấn.
                </div>
            )}
            <div className="mt-6 grid gap-4">
                {result.recommendations.map((recommendation, index) => {
                    const name = normalize(recommendation.specialtyName)
                    const match = specialties.find((item) => {
                        const value = normalize(item.name)
                        return value === name || value.includes(name) || name.includes(value)
                    })
                    const target = match ? `/dat-lich?specialty=${match.id}` : '/dat-lich'
                    return (
                        <article key={index} className="rounded-2xl border border-[#B8E5FA] bg-[#F7FCFF] p-5 sm:flex items-center gap-5">
                            <Stethoscope size={25} className="text-[#00A9E3]" />
                            <div className="flex-1">
                                <p className="text-xs font-semibold text-[#008EC2]">Gợi ý {index + 1}</p>
                                <h2 className="font-bold text-[#003553]">{recommendation.specialtyName}</h2>
                                <p className="text-xs text-slate-600">{recommendation.reason}</p>
                            </div>
                            <Link
                                to={target}
                                state={{
                                    aiRecommendation: {
                                        analysisId: result.analysisId,
                                        symptoms,
                                        specialtyName: recommendation.specialtyName,
                                        confidence: result.confidence,
                                        reason: recommendation.reason,
                                    },
                                }}
                                className="medpro-btn-primary min-h-11"
                            >
                                Đặt lịch <ArrowRight size={15} />
                            </Link>
                        </article>
                    )
                })}
            </div>
            <p className="mt-6 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                <strong>Lưu ý:</strong> Kết quả AI chỉ hỗ trợ phân luồng chuyên khoa, không thay thế chẩn đoán và tư vấn bác sĩ.
            </p>
            <button type="button" onClick={onRestart} className="mt-5 text-sm text-[#008EC2] underline">
                Chỉnh sửa triệu chứng và phân tích lại
            </button>
        </section>
    )
}
