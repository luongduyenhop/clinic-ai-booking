const PATIENT_JOURNEY_STEPS = [
    {
        step: '1',
        title: 'Kiểm tra triệu chứng hoặc chọn giờ khám',
        description:
            'Khai báo triệu chứng để hệ thống gợi ý đúng chuyên khoa, hoặc chọn bác sĩ và khung giờ còn trống.',
    },
    {
        step: '2',
        title: 'Xác nhận tại Quầy Lễ tân Tầng 1',
        description:
            'Có mặt trước giờ hẹn 15 phút để đối chiếu thông tin và vào đúng buồng khám.',
    },
    {
        step: '3',
        title: 'Thăm khám lâm sàng, cận lâm sàng tại chỗ',
        description:
            'Bác sĩ thăm khám trực tiếp và chỉ định xét nghiệm máu, siêu âm hoặc nội soi ngay tại phòng khám.',
    },
    {
        step: '4',
        title: 'Nhận đơn thuốc ký số và thanh toán',
        description:
            'Thanh toán tiền mặt, thẻ hoặc chuyển khoản QR; đơn thuốc và kết quả được lưu trong Sổ sức khỏe.',
    },
]

const GUIDE_SECTIONS = [
    {
        title: 'Giấy tờ và hồ sơ y tế cần mang theo',
        items: [
            'Căn cước công dân gắn chip hoặc ứng dụng VNeID đã định danh mức 2.',
            'Toa thuốc đang sử dụng và kết quả xét nghiệm, siêu âm, phim chụp trong 6 tháng gần nhất.',
        ],
    },
    {
        title: 'Lưu ý nhịn ăn trước khi lấy máu xét nghiệm, nội soi',
        items: [
            'Nhịn ăn tối thiểu 8 giờ (chỉ uống nước lọc, tránh sữa, cà phê, nước ngọt) khi xét nghiệm đường huyết, mỡ máu hoặc siêu âm bụng.',
            'Không sử dụng rượu bia hoặc chất kích thích trong 24 giờ trước thời điểm lấy mẫu.',
            'Thông báo cho điều dưỡng nếu đang mang thai, nghi ngờ có thai hoặc có tiền sử dị ứng thuốc.',
        ],
    },
]

function GuideChecklistBlock({ title, items, hasBottomBorder }) {
    return (
        <div className={hasBottomBorder ? 'pb-5 border-b border-clinic-border' : ''}>
            <h3 className="font-display text-base font-bold text-clinic-navy">{title}</h3>
            <ul className="mt-2.5 space-y-2 text-[13.5px] leading-6 text-clinic-text-secondary">
                {items.map((text) => (
                    <li key={text} className="flex items-start gap-2.5">
                        <span
                            className="mt-2.5 w-1.5 h-1.5 rounded-[2px] bg-clinic-cta shrink-0"
                            aria-hidden="true"
                        />
                        <span>{text}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default function OutpatientCareGuideSection() {
    return (
        <section id="huong-dan-kham" className="bg-clinic-bg py-10 sm:py-12 scroll-mt-20 border-t border-clinic-border">
            <div className="public-container">
                <h2 className="font-display text-[22px] sm:text-[26px] font-extrabold tracking-tight text-clinic-navy">
                    Quy trình khám và chuẩn bị trước khi đến
                </h2>

                <div className="mt-6 grid lg:grid-cols-[0.95fr_1.05fr] gap-8 items-start">
                    <div className="medpro-card p-5 sm:p-6 bg-clinic-surface">
                        <h3 className="font-display text-base font-bold text-clinic-navy pb-3 border-b border-clinic-border">
                            Khám tại Clinic-AI gồm 4 bước
                        </h3>

                        <ol className="divide-y divide-clinic-border">
                            {PATIENT_JOURNEY_STEPS.map((item) => (
                                <li key={item.step} className="py-3.5 flex items-start gap-3.5">
                                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-clinic-bg-muted font-display text-xs font-extrabold text-clinic-navy tabular-nums">
                                        {item.step}
                                    </span>
                                    <div>
                                        <p className="text-[14px] font-bold text-clinic-navy leading-snug">
                                            {item.title}
                                        </p>
                                        <p className="mt-1 text-[13px] leading-5 text-clinic-text-secondary">
                                            {item.description}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>

                        <dl className="mt-4 pt-3.5 border-t border-clinic-border space-y-1.5 text-[12.5px]">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <dt className="text-clinic-text-secondary">Giờ làm việc (Thứ 2 – Thứ 7)</dt>
                                <dd className="font-semibold text-clinic-navy tabular-nums">
                                    07:30 – 11:30 · 13:30 – 17:30
                                </dd>
                            </div>
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <dt className="text-clinic-text-secondary">Lấy mẫu máu sáng và Tổng đài</dt>
                                <dd className="font-semibold text-clinic-navy tabular-nums">
                                    Từ 07:30 · 1900 6868
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <div className="space-y-6">
                        {GUIDE_SECTIONS.map((section, index) => (
                            <GuideChecklistBlock
                                key={section.title}
                                title={section.title}
                                items={section.items}
                                hasBottomBorder={index < GUIDE_SECTIONS.length - 1}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
