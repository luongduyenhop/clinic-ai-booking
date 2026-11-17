import { Outlet, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import DoctorHeaderProfile from '../components/doctor/DoctorHeaderProfile'
import { CalendarCheck, Stethoscope } from '../components/common/ClinicIcon'

export default function DoctorTemplate() {
    const { user } = useSelector((state) => state.app.auth)
    const todayFormatted = new Intl.DateTimeFormat('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(new Date())

    return (
        <div className="min-h-screen min-h-[100dvh] flex flex-col bg-clinic-bg text-clinic-text antialiased">
            <header className="sticky top-0 z-40 bg-clinic-surface border-b border-clinic-border">
                <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="h-16 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 shrink-0">
                            <Link to="/doctor" className="flex items-center gap-2.5 shrink-0">
                                <div className="w-9 h-9 rounded-[6px] bg-clinic-navy text-clinic-surface flex items-center justify-center shrink-0">
                                    <Stethoscope size={18} weight="bold" />
                                </div>
                                <div className="shrink-0 whitespace-nowrap">
                                    <span className="font-display font-extrabold text-base tracking-tight text-clinic-navy block leading-tight">
                                        ClinicAI <span className="text-clinic-cta">Doctor</span>
                                    </span>
                                    <span className="text-[10px] font-bold text-clinic-text-muted uppercase tracking-wider block">
                                        Cổng Bác Sĩ Chuyên Khoa
                                    </span>
                                </div>
                            </Link>

                            <div className="hidden lg:block h-6 w-px bg-clinic-border mx-2 shrink-0" />

                            <div className="hidden md:flex items-center gap-2.5 text-xs shrink-0 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-clinic-surface-alt text-clinic-navy font-bold border border-clinic-info-border whitespace-nowrap shrink-0">
                                    <span className="w-2 h-2 rounded-full bg-clinic-success shrink-0" />
                                    {user?.room || 'Phòng Khám Nội Tổng Quát 1'} • {user?.specialty || 'Khoa Nội Tổng Quát'}
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-clinic-text-secondary font-medium whitespace-nowrap shrink-0">
                                    <CalendarCheck size={14} weight="regular" className="text-clinic-cta" />
                                    <span>{todayFormatted}</span>
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                            <DoctorHeaderProfile />
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
                <Outlet />
            </main>

            <footer className="bg-clinic-surface border-t border-clinic-border py-3 text-center text-xs text-clinic-text-muted">
                <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <p className="font-medium">
                        Hệ Thống ClinicAI Booking &copy; {new Date().getFullYear()} - Cổng làm việc chuyên biệt dành cho Bác sĩ.
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-clinic-text-secondary">
                        <span>Hỗ trợ y tế: <strong className="tabular-nums">1900-6868</strong></span>
                        <span>•</span>
                        <span>Chuẩn hóa Thông tư 32/2023/TT-BYT &amp; EMR Quốc gia</span>
                    </div>
                </div>
            </footer>
        </div>
    )
}
