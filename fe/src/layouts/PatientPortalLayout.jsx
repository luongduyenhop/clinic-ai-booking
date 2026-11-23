import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { CalendarCheck, CalendarPlus, CaretDown, ClipboardText, HouseLine, Microscope, Pill, Stethoscope, X } from '../components/common/ClinicIcon'
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
    const [navOpen, setNavOpen] = useState(false)
    useEffect(() => { dispatch(fetchPatientPortalAsync()) }, [dispatch])
    return <section className="min-h-[calc(100vh-72px)] bg-[#F4F8FB] py-6 sm:py-8">
        <div className="public-container grid gap-5 lg:grid-cols-[245px_1fr]">
            <aside className="medpro-card h-fit overflow-hidden lg:sticky lg:top-24">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-[#E8F4FD] p-4 sm:p-5 lg:block">
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#008EC2]">Hồ sơ bệnh nhân</p>
                        <p className="mt-1 truncate font-display font-bold text-[#003553]">{user?.fullName || user?.shortName || 'Bệnh nhân'}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setNavOpen((open) => !open)}
                        aria-expanded={navOpen}
                        aria-controls="patient-portal-nav"
                        className="medpro-btn-outline min-h-11 shrink-0 px-3 lg:hidden"
                    >
                        <span>{navOpen ? 'Thu gọn' : 'Danh mục'}</span>
                        {navOpen ? <X size={16}/> : <CaretDown size={16}/>}
                    </button>
                </div>
                <nav id="patient-portal-nav" className={`${navOpen ? 'grid' : 'hidden'} gap-1 p-2 lg:grid`}>
                    {links.map(({ to, end, label, icon: Icon }) => <NavLink key={to} end={end} to={to} onClick={() => setNavOpen(false)} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 text-xs font-bold transition ${isActive ? 'bg-[#00B5F1] text-white shadow-sm' : 'text-slate-600 hover:bg-[#E8F4FD] hover:text-[#003553]'}`}><Icon size={18}/>{label}</NavLink>)}
                </nav>
                <div className={`${navOpen ? 'block' : 'hidden'} p-3 pt-1 lg:block`}>
                    <NavLink to="/dat-lich" onClick={() => setNavOpen(false)} className="medpro-btn-primary min-h-11 w-full"><CalendarPlus size={17}/>Tạo lịch hẹn</NavLink>
                </div>
            </aside>
            <main className="min-w-0"><Outlet/></main>
        </div>
    </section>
}
