import { Link } from 'react-router-dom'
import { useMedicalCatalog } from '../../../services/user/MedicalCatalogService'
import { buildQuickBookingPath, formatConsultFee } from '../../../utils/helpers/quickBookingHelpers'

function SpecialtyBookLink({ specialtyId }) {
    return (
        <Link
            to={buildQuickBookingPath({ specialtyId })}
            className="text-[13px] font-semibold text-clinic-cta hover:underline"
        >
            Chọn lịch khám
        </Link>
    )
}

function SpecialtyRoomBadge({ room }) {
    return (
        <span className="inline-block rounded-[6px] bg-clinic-bg-muted px-2.5 py-1 text-xs font-semibold text-clinic-text tabular-nums">
            {room}
        </span>
    )
}

function SpecialtyFeeCell({ fee, inline = false }) {
    return (
        <div className={inline ? 'flex items-baseline gap-2' : ''}>
            <span className="font-bold text-clinic-navy tabular-nums">
                {formatConsultFee(fee)}
            </span>
            <span className={inline ? 'text-[11px] text-clinic-text-muted' : 'block text-[11px] text-clinic-text-muted mt-0.5'}>
                Lượt khám 30 phút
            </span>
        </div>
    )
}

function SpecialtyScopeCell({ services, description }) {
    return (
        <div>
            <p className="text-[13px] font-medium text-clinic-navy leading-5">
                {services}
            </p>
            {description && (
                <p className="mt-1 text-xs leading-5 text-clinic-text-secondary">
                    {description}
                </p>
            )}
        </div>
    )
}

export default function SpecialtySection() {
    const { specialties, loading, error } = useMedicalCatalog()

    return (
        <section id="chuyen-khoa" className="bg-clinic-surface py-12 sm:py-14 scroll-mt-20 border-b border-clinic-border">
            <div className="public-container">
                <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-clinic-border">
                    <div>
                        <h2 className="font-display text-[22px] sm:text-[26px] font-extrabold tracking-tight text-clinic-navy">
                            Các chuyên khoa khám ngoại trú &amp; Bảng giá niêm yết
                        </h2>
                        <p className="mt-1 text-[13px] text-clinic-text-secondary">
                            Chi phí dưới đây là giá khám bác sĩ trực tiếp theo từng chuyên khoa; xét nghiệm hoặc thủ thuật phát sinh được báo giá rõ trước khi thực hiện.
                        </p>
                    </div>
                    <span className="text-xs text-clinic-text-secondary tabular-nums">
                        Giờ tiếp nhận: Thứ 2 – Thứ 7 (07:30 – 11:30 · 13:30 – 17:30)
                    </span>
                </div>

                {loading && (
                    <p className="mt-6 text-sm text-clinic-text-secondary">Đang tải danh sách chuyên khoa...</p>
                )}
                {error && (
                    <p role="alert" className="mt-6 text-sm font-medium text-clinic-danger">
                        {error}
                    </p>
                )}

                {!loading && !error && specialties.length > 0 && (
                    <>
                        <div className="hidden md:block mt-5 border border-clinic-border rounded-[8px] overflow-hidden bg-clinic-surface">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-clinic-bg-muted border-b border-clinic-border text-[11.5px] font-bold uppercase tracking-[0.04em] text-clinic-navy">
                                        <th className="py-3 px-4">Chuyên khoa</th>
                                        <th className="py-3 px-4">Bệnh lý tiếp nhận &amp; Kỹ thuật thực hiện</th>
                                        <th className="py-3 px-4">Vị trí buồng khám</th>
                                        <th className="py-3 px-4">Giá khám niêm yết</th>
                                        <th className="py-3 px-4 text-right">Đặt hẹn</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {specialties.map((item) => (
                                        <tr key={item.id} className="border-b border-clinic-border last:border-b-0 hover:bg-clinic-bg transition-colors align-top">
                                            <td className="py-3.5 px-4 font-bold text-clinic-navy whitespace-nowrap">
                                                {item.name}
                                            </td>
                                            <td className="py-3.5 px-4 max-w-md">
                                                <SpecialtyScopeCell
                                                    services={item.services}
                                                    description={item.description}
                                                />
                                            </td>
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <SpecialtyRoomBadge room={item.room} />
                                            </td>
                                            <td className="py-3.5 px-4 whitespace-nowrap text-[13px]">
                                                <SpecialtyFeeCell fee={item.fee} />
                                            </td>
                                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                <SpecialtyBookLink specialtyId={item.id} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="md:hidden mt-4 divide-y divide-clinic-border border-t border-b border-clinic-border">
                            {specialties.map((item) => (
                                <div key={item.id} className="py-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="font-display text-sm font-bold text-clinic-navy">{item.name}</h3>
                                        <SpecialtyRoomBadge room={item.room} />
                                    </div>
                                    <div className="mt-1.5">
                                        <SpecialtyScopeCell
                                            services={item.services}
                                            description={item.description}
                                        />
                                    </div>
                                    <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
                                        <SpecialtyFeeCell fee={item.fee} inline />
                                        <SpecialtyBookLink specialtyId={item.id} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </section>
    )
}
