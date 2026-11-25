import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
    CalendarCheck,
    ClipboardText,
    HouseLine,
    IdentificationCard,
    ListChecks,
    Microscope,
    Pill,
    Receipt,
    SignOut,
    Stethoscope,
    X,
} from '../components/common/ClinicIcon'
import { logoutUserAsync } from '../redux/actions/user/authAction'
import { fetchPatientPortalAsync } from '../redux/actions/user/patientPortalAction'
import { getAvatarInitials, stripDemoTag } from '../utils/helpers/doctorNameHelper'

const links = [
    { to: '/benh-nhan', end: true, label: 'Tổng quan', shortLabel: 'Tổng quan', icon: HouseLine },
    { to: '/benh-nhan/lich-hen', label: 'Lịch hẹn của tôi', shortLabel: 'Lịch hẹn', icon: CalendarCheck },
    { to: '/benh-nhan/benh-an', label: 'Bệnh án điện tử', shortLabel: 'Bệnh án', icon: ClipboardText },
    { to: '/benh-nhan/don-thuoc', label: 'Đơn thuốc', shortLabel: 'Đơn thuốc', icon: Pill },
    { to: '/benh-nhan/ket-qua-can-lam-sang', label: 'Kết quả cận lâm sàng', shortLabel: 'Kết quả CLS', icon: Microscope },
    { to: '/benh-nhan/hoa-don', label: 'Hóa đơn & viện phí', shortLabel: 'Viện phí', icon: Receipt },
    { to: '/benh-nhan/ho-so', label: 'Hồ sơ & gia đình', shortLabel: 'Hồ sơ', icon: IdentificationCard },
    { to: '/benh-nhan/lich-bac-si', label: 'Lịch làm việc bác sĩ', shortLabel: 'Lịch bác sĩ', icon: Stethoscope },
]

const PRIMARY_MOBILE_LINKS = links.slice(0, 4)
const SECONDARY_MOBILE_LINKS = links.slice(4)

export default function PatientPortalLayout() {
    const dispatch = useDispatch()
    const location = useLocation()
    const navigate = useNavigate()
    const user = useSelector((state) => state.app.auth.user)
    const [moreSheetOpen, setMoreSheetOpen] = useState(false)

    useEffect(() => {
        dispatch(fetchPatientPortalAsync())
    }, [dispatch])

    useEffect(() => {
        setMoreSheetOpen(false)
    }, [location.pathname])

    const handleMobileLogout = async () => {
        setMoreSheetOpen(false)
        await dispatch(logoutUserAsync())
        navigate('/login')
    }

    const cleanName = stripDemoTag(user?.fullName || user?.shortName || 'Bệnh nhân')
    const initials = getAvatarInitials(cleanName, 'BN')
    const isSecondaryActive = SECONDARY_MOBILE_LINKS.some((item) => location.pathname.startsWith(item.to))

    return (
        <section className="min-h-[calc(100vh-72px)] bg-clinic-bg pt-5 pb-24 sm:pt-8 lg:pb-10">
            <div className="public-container grid gap-6 lg:grid-cols-[248px_1fr]">
                <aside className="hidden lg:block medpro-card h-fit overflow-hidden lg:sticky lg:top-24">
                    <div className="border-b border-clinic-border bg-clinic-surface p-4 flex items-center gap-3">
                        <span className="w-10 h-10 rounded-[8px] bg-clinic-surface-alt text-clinic-navy border border-clinic-info-border font-semibold text-xs flex items-center justify-center shrink-0">
                            {initials}
                        </span>
                        <div className="min-w-0">
                            <p className="text-[11px] font-medium text-clinic-text-muted">
                                Sổ sức khỏe cá nhân
                            </p>
                            <p className="mt-0.5 truncate font-display font-bold text-sm text-clinic-navy">
                                {cleanName}
                            </p>
                        </div>
                    </div>
                    <nav className="grid gap-1 p-2">
                        {links.map(({ to, end, label, icon: Icon }) => (
                            <NavLink
                                key={to}
                                end={end}
                                to={to}
                                className={({ isActive }) =>
                                    `flex min-h-10 items-center gap-2.5 rounded-[8px] px-3 text-[13px] font-medium transition-colors whitespace-nowrap ${
                                        isActive
                                            ? 'bg-clinic-navy text-clinic-surface font-semibold'
                                            : 'text-clinic-text-secondary hover:bg-clinic-bg-muted hover:text-clinic-navy'
                                    }`
                                }
                            >
                                <Icon size={17} />
                                <span>{label}</span>
                            </NavLink>
                        ))}
                    </nav>
                </aside>

                <main className="min-w-0">
                    <Outlet />
                </main>
            </div>

            {moreSheetOpen && (
                <div
                    className="fixed inset-0 z-50 lg:hidden bg-clinic-navy/40 flex items-end"
                    onClick={() => setMoreSheetOpen(false)}
                >
                    <div
                        className="w-full bg-clinic-surface rounded-t-[16px] border-t border-clinic-border p-4 pb-6 space-y-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-2.5 border-b border-clinic-border">
                            <div>
                                <p className="text-xs font-semibold text-clinic-navy">{cleanName}</p>
                                <p className="text-[11px] text-clinic-text-muted">Tiện ích sổ sức khỏe điện tử</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMoreSheetOpen(false)}
                                aria-label="Đóng danh mục"
                                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-clinic-text-secondary hover:bg-clinic-bg-muted cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-1 pt-1">
                            {SECONDARY_MOBILE_LINKS.map(({ to, label, icon: Icon }) => (
                                <NavLink
                                    key={to}
                                    to={to}
                                    onClick={() => setMoreSheetOpen(false)}
                                    className={({ isActive }) =>
                                        `flex min-h-11 items-center gap-3 rounded-[8px] px-3.5 text-sm font-medium transition-colors ${
                                            isActive
                                                ? 'bg-clinic-surface-alt text-clinic-navy font-semibold'
                                                : 'text-clinic-text hover:bg-clinic-bg-muted'
                                        }`
                                    }
                                >
                                    <Icon size={18} className="text-clinic-cta" />
                                    <span>{label}</span>
                                </NavLink>
                            ))}
                        </div>
                        <div className="pt-2 border-t border-clinic-border">
                            <button
                                type="button"
                                onClick={handleMobileLogout}
                                className="w-full flex min-h-11 items-center gap-3 rounded-[8px] px-3.5 text-sm font-medium text-clinic-danger hover:bg-clinic-danger-bg transition-colors cursor-pointer"
                            >
                                <SignOut size={18} />
                                <span>Đăng xuất tài khoản</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <nav
                aria-label="Điều hướng cổng bệnh nhân di động"
                className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-clinic-surface border-t border-clinic-border px-1.5 py-1 grid grid-cols-5 gap-0.5"
            >
                {PRIMARY_MOBILE_LINKS.map(({ to, end, shortLabel, icon: Icon }) => (
                    <NavLink
                        key={to}
                        end={end}
                        to={to}
                        className={({ isActive }) =>
                            `flex flex-col items-center justify-center min-h-[52px] rounded-[8px] px-1 text-[11px] transition-colors ${
                                isActive
                                    ? 'text-clinic-cta font-semibold'
                                    : 'text-clinic-text-secondary hover:text-clinic-navy font-medium'
                            }`
                        }
                    >
                        <Icon size={19} />
                        <span className="mt-0.5 truncate max-w-full">{shortLabel}</span>
                    </NavLink>
                ))}
                <button
                    type="button"
                    onClick={() => setMoreSheetOpen((prev) => !prev)}
                    aria-expanded={moreSheetOpen}
                    className={`flex flex-col items-center justify-center min-h-[52px] rounded-[8px] px-1 text-[11px] transition-colors cursor-pointer ${
                        isSecondaryActive || moreSheetOpen
                            ? 'text-clinic-cta font-semibold'
                            : 'text-clinic-text-secondary hover:text-clinic-navy font-medium'
                    }`}
                >
                    <ListChecks size={19} />
                    <span className="mt-0.5 truncate max-w-full">Thêm</span>
                </button>
            </nav>
        </section>
    )
}
