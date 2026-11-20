import { Link } from 'react-router-dom'

const PLATFORM_STRENGTHS = [
    {
        title: 'Phân luồng bằng AI, cảnh báo dấu hiệu cấp cứu',
        detail: 'Phát hiện sớm dấu hiệu cấp cứu để khuyến nghị gọi 115 kịp thời, đồng thời gợi ý đúng chuyên khoa phù hợp.',
    },
    {
        title: 'Giữ chỗ ngay khi xác nhận lịch',
        detail: 'Hệ thống đối chiếu phạm vi hành nghề bác sĩ và giữ chỗ ngay khi người bệnh xác nhận lịch.',
    },
    {
        title: 'Xét nghiệm và đơn thuốc ký số',
        detail: 'Kết nối chỉ định sinh hóa máu, siêu âm, nội soi và phát hành đơn thuốc điện tử chuẩn Bộ Y tế.',
    },
    {
        title: 'Sổ sức khỏe cho cả gia đình',
        detail: 'Tra cứu tập trung chỉ số sinh tồn, kết quả chẩn đoán, hóa đơn và nhắc lịch tái khám định kỳ.',
    },
]

export default function ClinicIntroSection() {
    return (
        <section id="gioi-thieu" className="bg-clinic-surface py-10 sm:py-12 scroll-mt-20 border-b border-clinic-border">
            <div className="public-container grid lg:grid-cols-[0.95fr_1.1fr] gap-8 lg:gap-12 items-start">
                <div>
                    <picture className="block rounded-[8px] overflow-hidden border border-clinic-border bg-clinic-bg">
                        <source srcSet="/images/clinic-consultation.webp" type="image/webp" />
                        <img
                            src="/images/clinic-consultation.jpg"
                            width={1376}
                            height={768}
                            alt="Bác sĩ tư vấn trực tiếp cho người bệnh tại phòng khám Clinic-AI"
                            className="w-full h-[260px] sm:h-[320px] object-cover"
                        />
                    </picture>
                    <p className="mt-2.5 text-xs text-clinic-text-muted">
                        Không gian tư vấn ngoại trú kết nối trực tiếp với khu xét nghiệm và chẩn đoán hình ảnh tại chỗ.
                    </p>
                </div>

                <div>
                    <h2 className="font-display text-[24px] sm:text-[28px] font-extrabold tracking-tight text-clinic-navy leading-[1.25]">
                        Về Phòng khám Đa khoa Clinic-AI
                    </h2>
                    <p className="mt-4 text-[15px] leading-7 text-clinic-text-secondary">
                        Đặt tại TP. Thủ Đức, Phòng khám Đa khoa Clinic-AI phục vụ nhu cầu khám chữa bệnh ngoại trú, tầm soát sức khỏe định kỳ và theo dõi bệnh mạn tính cho người trưởng thành cùng gia đình trên một hệ thống y tế thống nhất.
                    </p>
                    <p className="mt-3.5 text-[15px] leading-7 text-clinic-text-secondary">
                        Phần mềm điều phối lâm sàng giúp rút ngắn thủ tục tại Tầng 1: bác sĩ xem trước tóm tắt triệu chứng trước khi người bệnh vào phòng, dành trọn thời lượng giải thích kết quả xét nghiệm và hướng điều trị rõ ràng.
                    </p>

                    <dl className="mt-6 pt-5 border-t border-clinic-border grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                        {PLATFORM_STRENGTHS.map((item) => (
                            <div key={item.title}>
                                <dt className="font-display text-sm font-extrabold text-clinic-navy">
                                    {item.title}
                                </dt>
                                <dd className="mt-1 text-[13px] leading-6 text-clinic-text-secondary">
                                    {item.detail}
                                </dd>
                            </div>
                        ))}
                    </dl>

                    <div className="mt-6 pt-4 border-t border-clinic-border">
                        <Link
                            to="/khao-sat-trieu-chung"
                            className="inline-flex items-center text-[13.5px] font-semibold text-clinic-cta hover:underline"
                        >
                            Trải nghiệm công cụ Sàng lọc triệu chứng AI trước khi đặt lịch
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    )
}
