import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { getNavigationConfig } from '../../services/admin/clinicSeedData'
import { ClinicIcon, Hospital, ClipboardText, ArrowRight } from '../../components/common/ClinicIcon'

export default function HomePage() {
    const { clinicData } = useSelector((state) => state.app.admin)
    const { publicPortalModules = [] } = getNavigationConfig(clinicData)

    return (
        <div className="space-y-12 py-8">
            {/* Hero Banner in Medpro Cyan/Navy Style */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="rounded-[24px] bg-gradient-to-r from-[#003553] via-[#004E7A] to-[#00B5F1] p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
                    <div className="max-w-3xl relative z-10 space-y-5">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 text-xs font-bold uppercase tracking-wider border border-white/25">
                            <Hospital size={16} weight="duotone" className="text-[#FFB54A]" />
                            <span>Nền tảng Quản lý Phòng khám Thông minh — Phong cách Medpro.vn</span>
                        </span>
                        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                            HỆ THỐNG NGHIỆP VỤ QUẢN LÝ PHÒNG KHÁM & TUÂN THỦ PHÁP LÝ CLINIC-AI
                        </h1>
                        <p className="text-sm sm:text-base text-sky-100 leading-relaxed">
                            Tích hợp đầy đủ 10 phân hệ vận hành phòng khám chuyên nghiệp cùng Trợ lý AI Gợi ý Chuyên khoa, Kiểm soát Chứng chỉ hành nghề Bác sĩ (INT-05), Bệnh án điện tử bất biến (INT-03) và Liên thông Đơn thuốc Quốc gia (INT-04).
                        </p>
                        <div className="flex flex-wrap gap-3 pt-2">
                            <Link
                                to="/dat-lich"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#FFB54A] hover:bg-[#FBA342] text-[#003553] font-extrabold text-sm shadow-lg transition"
                            >
                                <Hospital size={18} weight="bold" />
                                <span>Đặt lịch khám bệnh trực tuyến</span>
                            </Link>
                            <Link
                                to="/benh-nhan/benh-an"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/15 hover:bg-white/25 text-white font-bold text-sm border border-white/30 backdrop-blur-xs transition"
                            >
                                <ClipboardText size={18} weight="duotone" className="text-[#8FE2FF]" />
                                <span>Tra cứu sổ bệnh án & Đơn thuốc</span>
                            </Link>
                            <Link
                                to="/admin"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#003553] hover:bg-[#E8F4FD] font-bold text-sm shadow-md transition"
                            >
                                <Hospital size={18} weight="duotone" className="text-[#00B5F1]" />
                                <span>Vào Quản lý Phòng khám (HIS)</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4 Core Patient Portal Quick Access Cards */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Link
                        to="/dat-lich"
                        className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#00B5F1] shadow-2xs hover:shadow-md transition group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-[#E8F4FD] text-[#00B5F1] flex items-center justify-center text-xl font-bold mb-3 group-hover:bg-[#00B5F1] group-hover:text-white transition">
                            🩺
                        </div>
                        <h3 className="font-bold text-sm text-[#003553] group-hover:text-[#00B5F1] transition">
                            Đặt khám Chuyên khoa
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Chọn bác sĩ, chọn giờ hẹn trong ngày và phân luồng AI triệu chứng thông minh.
                        </p>
                    </Link>

                    <Link
                        to="/benh-nhan/ho-so"
                        className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#00B5F1] shadow-2xs hover:shadow-md transition group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl font-bold mb-3 group-hover:bg-purple-600 group-hover:text-white transition">
                            👨‍👩‍👧‍👦
                        </div>
                        <h3 className="font-bold text-sm text-[#003553] group-hover:text-[#00B5F1] transition">
                            Hồ sơ Sức khỏe Gia đình
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Lưu thông tin cá nhân, dị ứng, nhóm máu và hồ sơ người thân (con cái, bố mẹ).
                        </p>
                    </Link>

                    <Link
                        to="/benh-nhan/benh-an"
                        className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#00B5F1] shadow-2xs hover:shadow-md transition group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold mb-3 group-hover:bg-emerald-600 group-hover:text-white transition">
                            📋
                        </div>
                        <h3 className="font-bold text-sm text-[#003553] group-hover:text-[#00B5F1] transition">
                            Bệnh án & Đơn thuốc 4 Cữ
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Xem chẩn đoán ICD-10, kết quả xét nghiệm cận lâm sàng và hướng dẫn uống thuốc.
                        </p>
                    </Link>

                    <Link
                        to="/benh-nhan/hoa-don"
                        className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#00B5F1] shadow-2xs hover:shadow-md transition group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold mb-3 group-hover:bg-amber-600 group-hover:text-white transition">
                            💳
                        </div>
                        <h3 className="font-bold text-sm text-[#003553] group-hover:text-[#00B5F1] transition">
                            Viện phí & VietQR
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Bảng kê chi tiết tiền khám, thuốc, xét nghiệm kèm mã VietQR Napas 247 thanh toán tức thì.
                        </p>
                    </Link>
                </div>
            </section>

            {/* Quick Modules Section from Seed */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-2xl mx-auto mb-8">
                    <h2 className="font-display text-2xl font-extrabold text-[#003553] uppercase">
                        CÁC PHÂN HỆ NGHIỆP VỤ QUẢN LÝ TRỌNG TÂM
                    </h2>
                    <p className="text-sm text-slate-600 mt-1">
                        Chọn trực tiếp một phân hệ bên dưới để kiểm tra giao diện và luồng nghiệp vụ tương ứng với 10 video mẫu
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {publicPortalModules.map((item, idx) => (
                        <Link
                            key={idx}
                            to={item.path}
                            className="medpro-card p-6 hover:border-[#00B5F1] transition group flex flex-col justify-between"
                        >
                            <div>
                                <div className="w-12 h-12 rounded-2xl bg-[#E8F4FD] text-[#00B5F1] border border-[#CBE9FA] flex items-center justify-center mb-4 group-hover:bg-[#00B5F1] group-hover:text-white transition">
                                    <ClinicIcon name={item.icon} size={24} weight="duotone" />
                                </div>
                                <h3 className="font-display font-bold text-base text-[#003553] group-hover:text-[#00B5F1] mb-1.5">
                                    {item.title}
                                </h3>
                                <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#00B5F1]">
                                <span>Truy cập chức năng</span>
                                <ArrowRight size={15} weight="bold" className="group-hover:translate-x-1 transition-transform" />
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    )
}
