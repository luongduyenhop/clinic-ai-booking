const PATIENT_JOURNEY_STEPS = [
    {
        step: '1',
        title: 'Phân luồng triệu chứng AI hoặc chọn thẳng giờ khám',
        description:
            'Khai báo biểu hiện đang gặp để hệ thống sàng lọc dấu hiệu nguy hiểm và gợi ý đúng chuyên khoa, hoặc chọn trực tiếp bác sĩ còn khung giờ 30 phút.',
    },
    {
        step: '2',
        title: 'Làm thủ tục tiếp nhận tại Quầy Lễ tân Tầng 1',
        description:
            'Có mặt trước giờ hẹn 15 phút để đối chiếu thông tin đặt trước; hồ sơ hẹn trực tuyến được ưu tiên chuyển thẳng vào buồng khám đúng ca.',
    },
    {
        step: '3',
        title: 'Thăm khám lâm sàng, thực hiện cận lâm sàng tại chỗ',
        description:
            'Bác sĩ xem sẵn tóm tắt triệu chứng, thăm khám trực tiếp và chỉ định sinh hóa máu, siêu âm hoặc nội soi ngay trong khuôn viên phòng khám.',
    },
    {
        step: '4',
        title: 'Nhận đơn thuốc ký số, thanh toán và lưu Sổ sức khỏe',
        description:
            'Thanh toán bằng tiền mặt, thẻ ngân hàng hoặc chuyển khoản QR; toa thuốc và kết quả chẩn đoán đồng bộ vào tài khoản để theo dõi tái khám.',
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
            'Nhịn ăn tối thiểu 8 giờ (chỉ uống nước lọc, tránh sữa, cà phê, nước ngọt) khi làm xét nghiệm đường huyết, mỡ máu hoặc siêu âm bụng.',
            'Không sử dụng rượu bia hoặc chất kích thích trong 24 giờ trước thời điểm lấy mẫu.',
            'Thông báo ngay cho điều dưỡng nếu đang mang thai, nghi ngờ có thai hoặc có tiền sử dị ứng thuốc.',
        ],
    },
    {
        title: 'Tiện ích trực tuyến trên Cổng Bệnh nhân',
        items: [
            'Đặt lịch khám hộ cho người thân trong gia đình trên cùng một tài khoản quản lý.',
            'Tra cứu lịch sử đơn thuốc điện tử có chữ ký số, chỉ số sinh tồn và hóa đơn viện phí sau khám.',
            'Chủ động dời lịch hoặc hủy hẹn trực tuyến khi lịch trình cá nhân thay đổi.',
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
        <section id="huong-dan-kham" className="bg-clinic-bg py-12 sm:py-16 scroll-mt-20 border-t border-clinic-border">
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
