import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { List } from '@phosphor-icons/react'
import { logout } from '../../redux/slices/authSlice'
import { Hospital, ShieldCheck, SignOut, X } from '../common/ClinicIcon'

export default function UserHeader() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { isAuthenticated, user } = useSelector((state) => state.app.auth)
    const [mobileOpen, setMobileOpen] = useState(false)

    const handleLogout = () => {
        dispatch(logout())
        navigate('/login')
    }

    return (
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#E2EDF5]">
            <div className="public-container h-[72px] flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2.5 font-display font-extrabold text-xl tracking-tight hover:opacity-90 transition">
                    <span className="w-10 h-10 rounded-xl bg-[#00B5F1] text-white flex items-center justify-center shadow-sm">
                        <Hospital size={20} weight="fill" />
                    </span>
                    <span className="text-[#00B5F1]">CLINIC<span className="text-[#003553]">-AI</span></span>
                </Link>

                <nav className="hidden lg:flex items-center gap-7 text-sm font-bold text-[#003553]">
                    <Link to="/" className="hover:text-[#00B5F1] transition">Trang chủ</Link>
                    <a href="/#chuyen-khoa" className="hover:text-[#00B5F1] transition">Chuyên khoa</a>
                    <a href="/#bac-si" className="hover:text-[#00B5F1] transition">Bác sĩ</a>
                    <a href="/#tro-ly-ai" className="hover:text-[#00B5F1] transition">Trợ lý AI</a>
                </nav>

                <div className="flex items-center gap-2.5">
                    {isAuthenticated ? (
                        <div className="hidden sm:flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#003553] max-w-[160px] truncate bg-[#E8F4FD] px-2.5 py-1.5 rounded-full border border-[#B8E5FA]">
                                <ShieldCheck size={15} weight="duotone" className="text-[#00B5F1]" />
                                <span className="truncate">{user?.shortName || user?.fullName || 'Bệnh nhân'}</span>
                            </span>
                            <button
                                onClick={handleLogout}
                                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition cursor-pointer"
                            >
                                <SignOut size={14} weight="bold" />
                                <span>Đăng xuất</span>
                            </button>
                        </div>
                    ) : (
                        <><Link to="/login" className="hidden sm:inline-flex text-sm font-bold text-[#003553] px-3 py-2 hover:text-[#00B5F1]">Đăng nhập</Link><Link to="/register" className="medpro-btn-primary min-h-10 !px-5">Đăng ký</Link></>
                    )}
                    <button type="button" onClick={() => setMobileOpen((value) => !value)} className="lg:hidden w-10 h-10 rounded-full border border-slate-200 text-[#003553] flex items-center justify-center" aria-label="Mở menu">{mobileOpen ? <X size={20} /> : <List size={20} />}</button>
                </div>
            </div>
            {mobileOpen && <nav className="lg:hidden public-container pb-4 grid gap-1 text-sm font-bold text-[#003553] bg-white"><Link onClick={()=>setMobileOpen(false)} className="p-3 rounded-lg hover:bg-[#E8F4FD]" to="/">Trang chủ</Link><a onClick={()=>setMobileOpen(false)} className="p-3 rounded-lg hover:bg-[#E8F4FD]" href="/#chuyen-khoa">Chuyên khoa</a><a onClick={()=>setMobileOpen(false)} className="p-3 rounded-lg hover:bg-[#E8F4FD]" href="/#bac-si">Bác sĩ</a><a onClick={()=>setMobileOpen(false)} className="p-3 rounded-lg hover:bg-[#E8F4FD]" href="/#tro-ly-ai">Trợ lý AI</a></nav>}
        </header>
    )
}
