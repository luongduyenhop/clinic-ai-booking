import { Outlet, Link, NavLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import DoctorHeaderProfile from '../components/doctor/DoctorHeaderProfile'

const DOCTOR_NAV = [
    { to: '/doctor', label: 'Tổng quan', end: true },
    { to: '/doctor/kham-benh', label: 'Bàn khám' },
    { to: '/doctor/can-lam-sang', label: 'Cận lâm sàng' },
]

export default function DoctorTemplate() {
    const { user } = useSelector((state) => state.app.auth)
    const todayFormatted = new Intl.DateTimeFormat('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(new Date())

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased selection:bg-[#00B5F1]/20">
            {/* ═══════════════════════════════════════════════════════════════════
                TOP NAVIGATION BAR DÀNH CHO BÁC SĨ (MEDPRO PALETTE)
            ═══════════════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
                <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="h-18 flex items-center justify-between gap-4">
                        {/* Logo & Sub-Brand Bác Sĩ */}
                        <div className="flex items-center gap-3 shrink-0">
                            <Link to="/doctor" className="flex items-center gap-2.5 group shrink-0">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#003553] via-[#00B5F1] to-[#00B5F1] text-white flex items-center justify-center font-extrabold text-lg shadow-md group-hover:scale-105 transition transform shrink-0">
                                    ✚
                                </div>
                                <div className="shrink-0 whitespace-nowrap">
                                    <span className="font-extrabold text-base tracking-tight text-[#003553] block leading-tight">
                                        ClinicAI <span className="text-[#00B5F1]">Doctor</span>
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                        Cổng Bác Sĩ Chuyên Khoa
                                    </span>
                                </div>
                            </Link>

                            <div className="hidden lg:block h-6 w-px bg-slate-200 mx-2 shrink-0" />

                            {/* Thông tin phòng trực & ngày giờ */}
                            <div className="hidden 2xl:flex items-center gap-2.5 text-xs shrink-0 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E8F4FD] text-[#003553] font-bold border border-sky-100 whitespace-nowrap shrink-0">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                    {user?.room ? `${user.room} • ${user?.specialty || ''}` : 'Bàn Khám Bác Sĩ'}
                                </span>
                                <span className="text-slate-500 font-medium whitespace-nowrap shrink-0">
                                    🗓 {todayFormatted}
                                </span>
                            </div>
                        </div>

                        {/* Điều hướng các màn làm việc của bác sĩ */}
                        <nav aria-label="Điều hướng bác sĩ" className="flex items-center justify-center gap-1 shrink-0">
                            {DOCTOR_NAV.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.end}
                                    className={({ isActive }) =>
                                        `rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                                            isActive ? 'bg-[#00B5F1] text-[#003553]' : 'text-slate-600 hover:bg-[#E8F4FD] hover:text-[#003553]'
                                        }`
                                    }
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </nav>

                        {/* Top corner: Chuyển cổng & Hồ sơ Bác Sĩ */}
                        <div className="flex items-center gap-2.5 shrink-0">
                            
                            <DoctorHeaderProfile />
                        </div>
                    </div>
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════════════
                KHÔNG GIAN LÀM VIỆC CHÍNH (MAIN WORKSPACE)
            ═══════════════════════════════════════════════════════════════════ */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <p className="font-medium">
                        Hệ Thống ClinicAI Booking &copy; {new Date().getFullYear()} - Dành riêng cho đội ngũ Y Bác sĩ.
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500">
                        <span>Hỗ trợ kỹ thuật: <strong>1900-6868</strong></span>
                        <span>•</span>
                        <span>Quy trình bảo mật dữ liệu y tế HIPAA/GDPR</span>
                    </div>
                </div>
            </footer>
        </div>
    )
}
