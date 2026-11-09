import { Link } from 'react-router-dom'
import { ArrowRight, Info, Robot, Stethoscope } from '../../common/ClinicIcon'
import { useMedicalCatalog } from '../../../services/user/MedicalCatalogService'

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/\bkhoa\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

export default function SpecialtyRecommendation({ result, symptoms, onRestart }) {
    const { specialties, doctors, loading: catalogLoading, error: catalogError } = useMedicalCatalog()

    const getRecommendationState = (recommendation) => ({
        aiRecommendation: {
            analysisId: result.analysisId,
            symptoms,
            specialtyName: recommendation.specialtyName,
            confidence: result.confidence,
            reason: recommendation.reason,
        },
    })

    return (
        <section className="max-w-3xl mx-auto medpro-card p-6 sm:p-9">
            <div className="text-center">
                <Robot size={34} className="text-[#00A9E3] mx-auto" />
                <h1 className="mt-5 font-display text-2xl font-extrabold text-[#003553]">Gợi ý chuyên khoa phù hợp</h1>
            </div>
            {result.needsHumanSupport && (
                <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 flex items-center gap-2">
                    <Info size={18} /> Triệu chứng chưa đủ rõ; nên gặp nhân viên y tế để được tư vấn.
                </div>
            )}
            <div className="mt-6 grid gap-4">
                {result.recommendations.map((recommendation, index) => {
                    const name = normalize(recommendation.specialtyName)
                    const match = specialties.find((item) => item.id === String(recommendation.specialtyId)) || specialties.find((item) => {
                        const value = normalize(item.name)
                        return value === name || value.includes(name) || name.includes(value)
                    })
                    const target = match ? `/dat-lich?specialty=${match.id}` : '/dat-lich'
                    const suggestedDoctors = (recommendation.doctors || [])
                        .map((suggestion) => {
                            const doctor = doctors.find((item) => item.id === String(suggestion.id) && item.specialtyId === match?.id)
                            return doctor ? { ...doctor, ...suggestion } : null
                        })
                        .filter(Boolean)
                    return (
                        <article key={`${recommendation.specialtyId}-${index}`} className="rounded-2xl border border-[#B8E5FA] bg-[#F7FCFF] p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                <Stethoscope size={25} className="text-[#00A9E3]" />
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-[#008EC2]">Gợi ý {index + 1}</p>
                                    <h2 className="font-bold text-[#003553]">{recommendation.specialtyName}</h2>
                                    <p className="text-xs text-slate-600">{recommendation.reason}</p>
                                </div>
                                <Link to={target} state={getRecommendationState(recommendation)} className="medpro-btn-primary min-h-11">
                                    Đặt lịch theo khoa <ArrowRight size={15} />
                                </Link>
                            </div>

                            <div className="mt-5 border-t border-[#D9EEF8] pt-4">
                                <h3 className="text-sm font-bold text-[#003553]">Bác sĩ có giờ trống sớm nhất</h3>
                                {catalogLoading ? (
                                    <p role="status" className="mt-3 text-xs text-slate-500">Đang tải danh sách bác sĩ...</p>
                                ) : catalogError ? (
                                    <p role="alert" className="mt-3 text-xs text-rose-600">Không tải được danh sách bác sĩ: {catalogError}</p>
                                ) : suggestedDoctors.length ? (
                                    <ul className="mt-3 grid max-w-2xl gap-3">
                                        {suggestedDoctors.map((doctor) => (
                                            <li key={doctor.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F4FD] text-xs font-bold text-[#008EC2]" aria-hidden="true">
                                                    {doctor.initials}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-semibold text-[#003553]">{doctor.name}</p>
                                                    <p className="text-xs text-slate-500">{doctor.degree || doctor.experience || recommendation.specialtyName}</p>
                                                    <p className="mt-1 text-xs font-medium text-emerald-700">
                                                        Trống gần nhất: {doctor.nextAvailableDate ? new Date(`${doctor.nextAvailableDate}T00:00:00`).toLocaleDateString('vi-VN') : 'Chưa có ngày'} lúc {doctor.nextAvailableTime || '--:--'}
                                                    </p>
                                                </div>
                                                <Link
                                                    to={`/dat-lich?${new URLSearchParams({ specialty: match.id, doctor: doctor.id, date: doctor.nextAvailableDate, slot: doctor.nextAvailableTime })}`}
                                                    state={getRecommendationState(recommendation)}
                                                    className="shrink-0 text-xs font-bold text-[#008EC2] hover:underline"
                                                >
                                                    Chọn giờ này
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mt-3 text-xs text-slate-500">Hiện chưa tìm thấy bác sĩ có slot trống trong 30 ngày tới.</p>
                                )}
                            </div>
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
