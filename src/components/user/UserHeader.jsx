import { Link, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { logout } from '../../redux/slices/authSlice'
import { Hospital, ShieldCheck, SignOut } from '../common/ClinicIcon'
import QuickPortalSwitcher from '../common/QuickPortalSwitcher'

export default function UserHeader() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { isAuthenticated, user } = useSelector((state) => state.app.auth)

    const handleLogout = () => {
        dispatch(logout())
        navigate('/login')
    }

    return (
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#E2EDF5] shadow-2xs">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2.5 font-display font-extrabold text-xl tracking-tight hover:opacity-90 transition">
                    <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00B5F1] to-[#0088BA] text-white flex items-center justify-center shadow-md">
                        <Hospital size={20} weight="fill" />
                    </span>
                    <span className="text-[#00B5F1]">CLINIC<span className="text-[#003553]">-AI</span></span>
                </Link>

                <div className="hidden md:flex items-center">
                    <QuickPortalSwitcher size="sm" />
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                    <Link
                        to="/admin"
                        className="medpro-btn-primary !py-2 !px-4 font-bold shrink-0 whitespace-nowrap"
                    >
                        <Hospital size={16} weight="duotone" />
                        <span>Hệ thống Quản lý Phòng khám</span>
                    </Link>

                    {isAuthenticated ? (
                        <div className="hidden sm:flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#003553] max-w-[160px] truncate bg-[#E8F4FD] px-2.5 py-1.5 rounded-full border border-[#B8E5FA] shrink-0 whitespace-nowrap">
                                <ShieldCheck size={15} weight="duotone" className="text-[#00B5F1]" />
                                <span className="truncate">{user?.shortName || user?.fullName || 'Admin'}</span>
                            </span>
                            <button
                                onClick={handleLogout}
                                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition cursor-pointer shrink-0 whitespace-nowrap"
                            >
                                <SignOut size={14} weight="bold" />
                                <span>Đăng xuất</span>
                            </button>
                        </div>
                    ) : (
                        <Link
                            to="/login"
                            className="medpro-btn-amber !py-2 !px-4 font-bold"
                        >
                            Đăng nhập
                        </Link>
                    )}
                </div>
            </div>
        </header>
    )
}
