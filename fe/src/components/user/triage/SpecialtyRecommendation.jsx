import { Link } from 'react-router-dom'
import { Info, Stethoscope } from '../../common/ClinicIcon'
import DoctorAvatar from '../../common/DoctorAvatar'
import { useMedicalCatalog } from '../../../services/user/MedicalCatalogService'
import { formatDoctorHeading } from '../../../utils/helpers/quickBookingHelpers'

const normalize = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .toLowerCase()
        .replace(/\bkhoa\b/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()

const displayReason = (reason) =>
    String(reason || '')
        .replace(/\[(?:Định tuyến theo từ khóa|Độ tin cậy cao):\s*\d+%\]\s*/gi, '')
        .replace(
            /Độ tin cậy chuyên khoa cao nhất là \d+% hoặc mô tả chưa có đủ 2 dấu hiệu đặc hiệu\.\s*/gi,
            'Mô tả triệu chứng chưa có đủ dấu hiệu đặc hiệu. '
        )

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
        <section className="max-w-3xl mx-auto medpro-card overflow-hidden">
            <div className="h-1 bg-clinic-navy" aria-hidden="true" />
            <div className="p-6 sm:p-8">
                <div className="flex items-start gap-3 pb-4 border-b border-clinic-border">
                    <span className="w-10 h-10 rounded-[8px] bg-clinic-surface-alt text-clinic-cta flex items-center justify-center shrink-0">
                        <Stethoscope size={20} weight="bold" />
                    </span>
                    <div>
                        <p className="text-xs font-semibold text-clinic-text-secondary">
                            Kết quả phân luồng triệu chứng trước khám
                        </p>
                        <h1 className="mt-1 font-display text-2xl font-extrabold text-clinic-navy">
                            Phiếu Gợi ý Chuyên khoa Tiếp nhận
                        </h1>
                    </div>
                </div>

                {result.needsHumanSupport && (
                    <div className="mt-5 rounded-[8px] bg-clinic-warning-bg p-4 text-sm text-clinic-warning flex items-center gap-2.5">
                        <Info size={18} className="shrink-0" />
                        <span>
                            Triệu chứng chưa đủ rõ; nên trao đổi trực tiếp với nhân viên y tế tại quầy tiếp nhận.
                        </span>
                    </div>
                )}

                <div className="mt-6 grid gap-4">
                    {result.recommendations.map((recommendation, index) => {
                        const name = normalize(recommendation.specialtyName)
                        const match =
                            specialties.find((item) => item.id === String(recommendation.specialtyId)) ||
                            specialties.find((item) => {
                                const value = normalize(item.name)
                                return value === name || value.includes(name) || name.includes(value)
                            })
                        const target = match ? `/dat-lich?specialty=${match.id}` : '/dat-lich'
                        const suggestedDoctors = (recommendation.doctors || [])
                            .map((suggestion) => {
                                const doctor = doctors.find(
                                    (item) =>
                                        item.id === String(suggestion.id) &&
                                        item.specialtyId === match?.id
                                )
                                return doctor ? { ...doctor, ...suggestion } : null
                            })
                            .filter(Boolean)

                        return (
                            <article
                                key={`${recommendation.specialtyId}-${index}`}
                                className="rounded-[8px] bg-clinic-surface-tint p-5"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-clinic-cta tabular-nums">
                                            Đề xuất {index + 1}
                                        </p>
                                        <h2 className="mt-0.5 font-display text-base font-extrabold text-clinic-navy">
                                            {recommendation.specialtyName}
                                        </h2>
                                        <p className="mt-1 text-xs leading-5 text-clinic-text-secondary">
                                            {displayReason(recommendation.reason)}
                                        </p>
                                    </div>
                                    <Link
                                        to={target}
                                        state={getRecommendationState(recommendation)}
                                        className="medpro-btn-primary min-h-10 shrink-0"
                                    >
                                        Đặt lịch theo khoa
                                    </Link>
                                </div>

                                <div className="mt-5 border-t border-clinic-info-border pt-4">
                                    <h3 className="text-sm font-bold text-clinic-navy">
                                        Bác sĩ có giờ trống sớm nhất
                                    </h3>
                                    {catalogLoading ? (
                                        <p role="status" className="mt-3 text-xs text-clinic-text-secondary">
                                            Đang tải danh sách bác sĩ...
                                        </p>
                                    ) : catalogError ? (
                                        <p role="alert" className="mt-3 text-xs text-clinic-danger">
                                            Không tải được danh sách bác sĩ: {catalogError}
                                        </p>
                                    ) : suggestedDoctors.length ? (
                                        <ul className="mt-3 grid max-w-2xl gap-2.5">
                                            {suggestedDoctors.map((doctor) => (
                                                <li
                                                    key={doctor.id}
                                                    className="flex items-center gap-3.5 rounded-[8px] bg-clinic-surface p-3.5"
                                                >
                                                    <DoctorAvatar
                                                        name={doctor.name}
                                                        initials={doctor.initials}
                                                        specialty={doctor.specialty || recommendation.specialtyName}
                                                        specialtyCode={doctor.specialtyCode}
                                                        size="sm"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-bold text-clinic-navy">
                                                            {formatDoctorHeading(doctor)}
                                                        </p>
                                                        <p className="text-xs text-clinic-text-secondary">
                                                            {doctor.degree ||
                                                                doctor.experience ||
                                                                recommendation.specialtyName}
                                                        </p>
                                                        <p className="mt-1 text-xs font-semibold text-clinic-success tabular-nums">
                                                            Trống gần nhất:{' '}
                                                            {doctor.nextAvailableDate
                                                                ? new Date(
                                                                      `${doctor.nextAvailableDate}T00:00:00`
                                                                  ).toLocaleDateString('vi-VN')
                                                                : 'Chưa có ngày'}{' '}
                                                            lúc {doctor.nextAvailableTime || '--:--'}
                                                        </p>
                                                    </div>
                                                    <Link
                                                        to={`/dat-lich?${new URLSearchParams({
                                                            specialty: match.id,
                                                            doctor: doctor.id,
                                                            date: doctor.nextAvailableDate,
                                                            slot: doctor.nextAvailableTime,
                                                        })}`}
                                                        state={getRecommendationState(recommendation)}
                                                        className="shrink-0 text-xs font-bold text-clinic-cta hover:underline"
                                                    >
                                                        Chọn giờ này
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="mt-3 text-xs text-clinic-text-secondary">
                                            Hiện chưa tìm thấy bác sĩ có khung giờ trống trong 30 ngày tới.
                                        </p>
                                    )}
                                </div>
                            </article>
                        )
                    })}
                </div>

                <p className="mt-6 rounded-[8px] bg-clinic-bg p-4 text-xs leading-5 text-clinic-text-secondary">
                    <strong>Lưu ý:</strong> Đề xuất trên hỗ trợ định hướng chuyên khoa tiếp nhận, không thay thế kết luận thăm khám trực tiếp của bác sĩ.
                </p>

                <button
                    type="button"
                    onClick={onRestart}
                    className="mt-5 text-sm font-semibold text-clinic-cta underline hover:text-clinic-navy cursor-pointer"
                >
                    Chỉnh sửa triệu chứng và phân tích lại
                </button>
            </div>
        </section>
    )
}
