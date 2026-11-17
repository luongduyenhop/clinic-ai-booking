import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { CalendarCheck, CalendarPlus, ClipboardText, HouseLine, Microscope, Pill, Stethoscope } from '../components/common/ClinicIcon'
import { fetchPatientPortalAsync } from '../redux/actions/user/patientPortalAction'

const links = [
    { to: '/benh-nhan', end: true, label: 'Tổng quan', icon: HouseLine },
    { to: '/benh-nhan/lich-hen', label: 'Lịch hẹn của tôi', icon: CalendarCheck },
    { to: '/benh-nhan/lich-su-kham', label: 'Lịch sử khám', icon: ClipboardText },
    { to: '/benh-nhan/benh-an', label: 'Bệnh án điện tử', icon: ClipboardText },
    { to: '/benh-nhan/don-thuoc', label: 'Đơn thuốc', icon: Pill },
    { to: '/benh-nhan/ket-qua-can-lam-sang', label: 'Kết quả cận lâm sàng', icon: Microscope },
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
                    <div className="border-b border-clinic-border bg-clinic-surface-tint p-5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-clinic-cta">Hồ sơ bệnh nhân</p>
                        <p className="mt-1 truncate font-display font-bold text-clinic-navy">
                            {user?.fullName || user?.shortName || 'Bệnh nhân'}
                        </p>
                    </div>
                    <nav className="grid gap-1 p-2">
                        {links.map(({ to, end, label, icon: Icon }) => (
                            <NavLink
                                key={to}
                                end={end}
                                to={to}
                                className={({ isActive }) =>
                                    `flex min-h-11 items-center gap-3 rounded-[8px] px-3 text-xs font-bold transition-colors ${
                                        isActive
                                            ? 'bg-clinic-navy text-clinic-surface'
                                            : 'text-clinic-text-secondary hover:bg-clinic-surface-alt hover:text-clinic-navy'
                                    }`
                                }
                            >
                                <Icon size={18} />
                                {label}
                            </NavLink>
                        ))}
                    </nav>
                    <div className="p-3 pt-1">
                        <NavLink to="/dat-lich" className="medpro-btn-primary min-h-11 w-full">
                            <CalendarPlus size={17} />
                            Tạo lịch hẹn
                        </NavLink>
                    </div>
                </aside>
                <main className="min-w-0">
                    <Outlet />
                </main>
            </div>
        </section>
    )
}
