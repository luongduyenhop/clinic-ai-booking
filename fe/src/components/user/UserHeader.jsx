import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { List } from '@phosphor-icons/react'
import { logoutUserAsync } from '../../redux/actions/user/authAction'
import { Hospital, LockKey, SignOut, UserCheck, X } from '../common/ClinicIcon'
import { getRoleDefaultPath } from '../../utils/constants/System'

export default function UserHeader() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { isAuthenticated, user, role, isLoggingOut } = useSelector((state) => state.app.auth)
    const [mobileOpen, setMobileOpen] = useState(false)

    const handleLogout = async () => {
        const result = await dispatch(logoutUserAsync())
        if (result.payload?.sessionChanged || result.meta.condition) return
        navigate('/login')
    }

    const portalUrl = getRoleDefaultPath(role)
    const roleName = user?.role || role || ''
    const isStaff = !['BENH_NHAN', 'PATIENT', 'CUSTOMER', 'USER'].includes(String(roleName).toUpperCase())

    return (
        <header className="sticky top-0 z-40 bg-clinic-surface border-b border-clinic-border">
            <div className="public-container h-[72px] flex items-center justify-between gap-4">
                <Link to="/" className="flex items-center gap-2.5 font-display font-extrabold text-xl tracking-tight hover:opacity-90 transition-opacity shrink-0">
                    <span className="w-10 h-10 rounded-[8px] bg-clinic-navy text-clinic-surface flex items-center justify-center">
                        <Hospital size={20} weight="fill" />
                    </span>
                    <span className="text-clinic-navy">CLINIC<span className="text-clinic-cta">-AI</span></span>
                </Link>

                <nav className="hidden lg:flex items-center gap-6 text-sm font-bold text-clinic-navy">
                    <Link to="/" className="hover:text-clinic-cta transition-colors">Trang chủ</Link>
                    <a href="/#chuyen-khoa" className="hover:text-clinic-cta transition-colors">Chuyên khoa</a>
                    <a href="/#bac-si" className="hover:text-clinic-cta transition-colors">Bác sĩ</a>
                    <Link to="/khao-sat-trieu-chung" className="hover:text-clinic-cta transition-colors">Trợ lý AI</Link>
                </nav>

                <div className="flex items-center gap-2.5 shrink-0">
                    {isAuthenticated ? (
                        <div className="hidden sm:flex items-center gap-2">
                            <Link
                                to={portalUrl}
                                title={isStaff ? 'Đến không gian làm việc chuyên môn' : 'Đến Cổng Bệnh Nhân'}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-clinic-navy max-w-[200px] truncate bg-clinic-surface-alt px-3 py-1.5 rounded-[8px] border border-clinic-info-border hover:border-clinic-cta transition-colors"
                            >
                                <UserCheck size={15} weight="duotone" className="text-clinic-cta" />
                                <span className="truncate">{user?.shortName || user?.fullName || (isStaff ? 'Nhân viên Y tế' : 'Bệnh nhân')}</span>
                            </Link>
                            <button
                                type="button"
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-[8px] border border-clinic-border text-clinic-text-secondary hover:bg-clinic-danger-bg hover:text-clinic-danger hover:border-clinic-danger-border transition-colors cursor-pointer"
                            >
                                <SignOut size={14} weight="bold" />
                                <span>Đăng xuất</span>
                            </button>
                        </div>
                    ) : (
                        <>
                            <Link to="/login" className="hidden sm:inline-flex text-sm font-bold text-clinic-navy px-3 py-2 hover:text-clinic-cta transition-colors">
                                Đăng nhập
                            </Link>
                            <Link to="/register" className="inline-flex items-center justify-center rounded-[8px] bg-clinic-navy hover:bg-clinic-navy-dark text-clinic-surface text-sm font-semibold px-4 min-h-10 transition-colors">
                                Đăng ký
                            </Link>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={() => setMobileOpen((value) => !value)}
                        className="lg:hidden w-10 h-10 rounded-[8px] border border-clinic-border text-clinic-navy flex items-center justify-center cursor-pointer hover:border-clinic-cta transition-colors"
                        aria-label="Mở menu"
                    >
                        {mobileOpen ? <X size={20} /> : <List size={20} />}
                    </button>
                </div>
            </div>

            {mobileOpen && (
                <nav className="lg:hidden public-container pb-4 grid gap-1 text-sm font-bold text-clinic-navy bg-clinic-surface border-t border-clinic-border">
                    <Link onClick={() => setMobileOpen(false)} className="p-3 rounded-[8px] hover:bg-clinic-surface-alt" to="/">
                        Trang chủ
                    </Link>
                    {isAuthenticated && (
                        <Link onClick={() => setMobileOpen(false)} className="p-3 rounded-[8px] bg-clinic-surface-alt text-clinic-cta" to={portalUrl}>
                            {isStaff ? 'Không gian làm việc HIS' : 'Cổng bệnh nhân'}
                        </Link>
                    )}
                    <a href="/#chuyen-khoa" onClick={() => setMobileOpen(false)} className="p-3 rounded-[8px] hover:bg-clinic-surface-alt">
                        Chuyên khoa
                    </a>
                    <a href="/#bac-si" onClick={() => setMobileOpen(false)} className="p-3 rounded-[8px] hover:bg-clinic-surface-alt">
                        Bác sĩ
                    </a>
                    <Link onClick={() => setMobileOpen(false)} className="p-3 rounded-[8px] hover:bg-clinic-surface-alt" to="/khao-sat-trieu-chung">
                        Trợ lý AI
                    </Link>
                    <Link onClick={() => setMobileOpen(false)} className="p-3 rounded-[8px] text-clinic-text-secondary hover:text-clinic-navy inline-flex items-center gap-1.5" to="/staff/login">
                        <LockKey size={15} weight="bold" />
                        <span>Đăng nhập Cổng Nhân Viên</span>
                    </Link>
                </nav>
            )}
        </header>
    )
}
