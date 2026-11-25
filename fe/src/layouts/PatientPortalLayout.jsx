import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
    CalendarCheck,
    CalendarPlus,
    ClipboardText,
    HouseLine,
    IdentificationCard,
    Microscope,
    Pill,
    Receipt,
    Stethoscope,
} from '../components/common/ClinicIcon'
import { fetchPatientPortalAsync } from '../redux/actions/user/patientPortalAction'

const links = [
    { to: '/benh-nhan', end: true, label: 'Tổng quan', icon: HouseLine },
    { to: '/benh-nhan/lich-hen', label: 'Lịch hẹn của tôi', icon: CalendarCheck },
    { to: '/benh-nhan/benh-an', label: 'Bệnh án điện tử', icon: ClipboardText },
    { to: '/benh-nhan/don-thuoc', label: 'Đơn thuốc', icon: Pill },
    { to: '/benh-nhan/ket-qua-can-lam-sang', label: 'Kết quả cận lâm sàng', icon: Microscope },
    { to: '/benh-nhan/hoa-don', label: 'Hóa đơn & viện phí', icon: Receipt },
    { to: '/benh-nhan/ho-so', label: 'Hồ sơ & gia đình', icon: IdentificationCard },
    { to: '/benh-nhan/lich-bac-si', label: 'Lịch làm việc bác sĩ', icon: Stethoscope },
]

export default function PatientPortalLayout() {
    const dispatch = useDispatch()
    const user = useSelector((state) => state.app.auth.user)
    useEffect(() => {
        dispatch(fetchPatientPortalAsync())
    }, [dispatch])

    return (
        <section className="min-h-[calc(100vh-72px)] bg-clinic-bg py-6 sm:py-8">
            <div className="public-container grid gap-5 lg:grid-cols-[245px_1fr]">
                <aside className="medpro-card h-fit overflow-hidden lg:sticky lg:top-24">
                    <div className="border-b border-clinic-border bg-clinic-surface-tint p-3.5 lg:p-5 flex items-center justify-between gap-3 lg:block">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-clinic-text-secondary">
                                Cổng thông tin bệnh nhân
                            </p>
                            <p className="mt-1 truncate font-display font-bold text-clinic-navy">
                                {user?.fullName || user?.shortName || 'Bệnh nhân'}
                            </p>
                        </div>
                        <NavLink
                            to="/dat-lich"
                            className="lg:hidden medpro-btn-primary min-h-9 px-3 py-1.5 text-xs shrink-0"
                        >
                            <CalendarPlus size={15} />
                            <span>Đặt lịch</span>
                        </NavLink>
                    </div>
                    <nav className="flex lg:grid gap-1.5 lg:gap-1 p-2 overflow-x-auto">
                        {links.map(({ to, end, label, icon: Icon }) => (
                            <NavLink
                                key={to}
                                end={end}
                                to={to}
                                className={({ isActive }) =>
                                    `shrink-0 flex min-h-9 lg:min-h-11 items-center gap-2 lg:gap-3 rounded-[8px] px-3 text-xs font-bold transition-colors whitespace-nowrap ${
                                        isActive
                                            ? 'bg-clinic-navy text-clinic-surface'
                                            : 'text-clinic-text-secondary hover:bg-clinic-surface-alt hover:text-clinic-navy'
                                    }`
                                }
                            >
                                <Icon size={17} />
                                {label}
                            </NavLink>
                        ))}
                    </nav>
                </aside>
                <main className="min-w-0">
                    <Outlet />
                </main>
            </div>
        </section>
    )
}
