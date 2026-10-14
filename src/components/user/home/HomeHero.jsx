import { ArrowRight, CalendarCheck, CheckCircle, ShieldCheck, Sparkle, Stethoscope } from '../../common/ClinicIcon'

export default function HomeHero() {
    return (
        <section className="bg-white overflow-hidden">
            <div className="public-container grid lg:grid-cols-[1.08fr_.92fr] gap-10 lg:gap-16 items-center py-14 md:py-20 lg:py-24">
                <div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#E8F4FD] px-4 py-2 text-xs font-bold text-[#006F9F]">
                        <Sparkle size={17} weight="fill" /> Đặt lịch chủ động · Thăm khám an tâm
                    </span>
                    <h1 className="mt-5 font-display text-[32px] sm:text-[40px] lg:text-[48px] leading-[1.16] font-extrabold tracking-[-0.03em] text-[#003553]">
                        Chăm sóc sức khỏe<br /><span className="text-[#00A9E3]">dễ dàng hơn mỗi ngày</span>
                    </h1>
                    <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
                        Tìm đúng chuyên khoa, chọn bác sĩ phù hợp và đặt lịch khám chỉ trong vài phút. Clinic-AI đồng hành cùng bạn trước, trong và sau buổi khám.
                    </p>
                    <div className="mt-8 flex flex-col sm:flex-row gap-3">
                        <a href="#chuyen-khoa" className="medpro-btn-primary min-h-12 !px-6 !text-sm">
                            <CalendarCheck size={19} weight="bold" /> Đặt lịch khám <ArrowRight size={17} weight="bold" />
                        </a>
                        <a href="#tro-ly-ai" className="medpro-btn-outline min-h-12 !px-6 !text-sm">
                            <Sparkle size={18} weight="fill" className="text-[#FBA342]" /> Tư vấn chuyên khoa với AI
                        </a>
                    </div>
                    <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                        {['Thông tin minh bạch', 'Chủ động giờ khám', 'Bảo mật dữ liệu'].map((item) => (
                            <span key={item} className="inline-flex items-center gap-1.5"><CheckCircle size={17} weight="fill" className="text-emerald-500" />{item}</span>
                        ))}
                    </div>
                </div>
                <div className="relative min-h-[370px] rounded-[32px] bg-[#E8F4FD] p-6 sm:p-9 overflow-hidden">
                    <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#00B5F1]/10" />
                    <div className="absolute -left-12 -bottom-16 h-44 w-44 rounded-full bg-[#FFB54A]/20" />
                    <div className="relative h-full flex items-center justify-center">
                        <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-white border-[14px] border-white/70 shadow-[4px_8px_30px_rgba(177,196,218,.35)] flex items-center justify-center">
                            <Stethoscope size={112} weight="duotone" className="text-[#00B5F1]" />
                        </div>
                        <div className="absolute left-0 sm:left-2 top-4 medpro-card p-3.5 flex items-center gap-3">
                            <span className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><ShieldCheck size={21} weight="fill" /></span>
                            <span><strong className="block text-[#003553]">Bảo mật</strong><small className="text-slate-500">Thông tin an toàn</small></span>
                        </div>
                        <div className="absolute right-0 sm:right-2 bottom-5 medpro-card p-3.5 flex items-center gap-3">
                            <span className="w-10 h-10 rounded-full bg-amber-50 text-[#FBA342] flex items-center justify-center"><CalendarCheck size={21} weight="fill" /></span>
                            <span><strong className="block text-[#003553]">Đặt lịch 24/7</strong><small className="text-slate-500">Nhanh chóng, tiện lợi</small></span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
