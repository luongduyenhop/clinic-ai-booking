import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { List } from '@phosphor-icons/react'
import { useSelector, useDispatch } from 'react-redux'
import { logoutUserAsync } from '../../redux/actions/user/authAction'
import { Hospital, LockKey, SignOut, UserCheck, X } from '../common/ClinicIcon'
import { getRoleDefaultPath } from '../../utils/constants/System'
import { stripDemoTag } from '../../utils/helpers/doctorNameHelper'

const PUBLIC_NAV_LINKS = [
    { label: 'Giới thiệu', to: '/#gioi-thieu', isAnchor: true },
    { label: 'Lịch bác sĩ', to: '/#bac-si', isAnchor: true },
    { label: 'Chuyên khoa', to: '/#chuyen-khoa', isAnchor: true },
    { label: 'Hướng dẫn khám', to: '/#huong-dan-kham', isAnchor: true },
    { label: 'Phân luồng triệu chứng', to: '/khao-sat-trieu-chung', isAnchor: false },
    { label: 'Đặt lịch khám', to: '/dat-lich', isAnchor: false },
]

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

    const renderNavLink = (item, className, onClick) => {
        if (item.isAnchor) {
            return (
                <a key={item.to} href={item.to} onClick={onClick} className={className}>
                    {item.label}
                </a>
            )
        }
        return (
            <Link key={item.to} to={item.to} onClick={onClick} className={className}>
                {item.label}
            </Link>
        )
    }

    return (
        <>
            <div className="bg-clinic-navy-dark text-clinic-on-navy-muted text-xs border-b border-[color:var(--clinic-nav-divider)]">
                <div className="public-container min-h-[34px] py-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-clinic-surface">Phòng khám Đa khoa Clinic-AI</span>
                        <span className="hidden md:inline text-clinic-on-navy-subtle">·</span>
                        <span className="hidden md:inline">Khu Công Nghệ Cao, TP. Thủ Đức</span>
                        <span className="text-clinic-on-navy-subtle">·</span>
                        <span className="tabular-nums">Tiếp nhận: 07:30 – 17:30</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <a href="tel:19006868" className="hover:text-clinic-surface transition-colors">
                            Tổng đài: <strong className="text-clinic-surface tabular-nums font-bold">1900 6868</strong>
                        </a>
                        <span className="hidden sm:inline text-clinic-on-navy-subtle">|</span>
                        <Link to="/staff/login" className="hidden sm:inline-flex items-center gap-1 text-clinic-surface font-semibold hover:underline">
                            <LockKey size={13} weight="bold" />
                            <span>Cổng Nhân viên</span>
                        </Link>
                    </div>
                </div>
            </div>

            <header className="sticky top-0 z-40 bg-clinic-surface border-b border-clinic-border">
                <div className="public-container h-[68px] flex items-center justify-between gap-4">
                    <Link to="/" className="flex items-center gap-2.5 font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity shrink-0">
                        <span className="w-9 h-9 rounded-[8px] bg-clinic-navy text-clinic-surface flex items-center justify-center">
                            <Hospital size={19} weight="fill" />
                        </span>
                        <span className="text-clinic-navy">Clinic<span className="text-clinic-cta">-AI</span></span>
                    </Link>

                    <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-clinic-navy">
                        {PUBLIC_NAV_LINKS.map((item) =>
                            renderNavLink(item, 'hover:text-clinic-cta transition-colors')
                        )}
                    </nav>

                    <div className="flex items-center gap-2.5 shrink-0">
                        {isAuthenticated ? (
                            <div className="hidden sm:flex items-center gap-2">
                                <Link
                                    to={portalUrl}
                                    title={isStaff ? 'Đến không gian làm việc chuyên môn' : 'Đến Cổng Bệnh Nhân'}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-clinic-navy max-w-[200px] truncate bg-clinic-surface-alt px-3 py-1.5 rounded-[8px] border border-clinic-info-border hover:border-clinic-cta transition-colors"
                                >
                                    <UserCheck size={15} weight="duotone" className="text-clinic-cta" />
                                    <span className="truncate">{stripDemoTag(user?.shortName || user?.fullName) || (isStaff ? 'Nhân viên Y tế' : 'Bệnh nhân')}</span>
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
                                <Link to="/login" className="hidden sm:inline-flex text-sm font-semibold text-clinic-navy px-3 py-2 hover:text-clinic-cta transition-colors">
                                    Đăng nhập
                                </Link>
                                <Link to="/register" className="inline-flex items-center justify-center rounded-[8px] bg-clinic-navy hover:bg-clinic-navy-dark text-clinic-surface text-sm font-semibold px-4 min-h-10 transition-colors">
                                    Hồ sơ bệnh nhân
                                </Link>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={() => setMobileOpen((value) => !value)}
                            className="lg:hidden w-10 h-10 rounded-[8px] border border-clinic-border text-clinic-navy flex items-center justify-center cursor-pointer hover:border-clinic-cta transition-colors"
                            aria-expanded={mobileOpen}
                            aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
                        >
                            {mobileOpen ? <X size={20} /> : <List size={20} />}
                        </button>
                    </div>
                </div>

                {mobileOpen && (
                    <nav className="lg:hidden public-container pb-4 grid gap-1 text-sm font-semibold text-clinic-navy bg-clinic-surface border-t border-clinic-border">
                        {isAuthenticated && (
                            <Link onClick={() => setMobileOpen(false)} className="p-3 rounded-[8px] bg-clinic-surface-alt text-clinic-cta" to={portalUrl}>
                                {isStaff ? 'Không gian làm việc HIS' : 'Cổng bệnh nhân'}
                            </Link>
                        )}
                        {PUBLIC_NAV_LINKS.map((item) =>
                            renderNavLink(item, 'p-3 rounded-[8px] hover:bg-clinic-surface-alt', () => setMobileOpen(false))
                        )}
                        {!isAuthenticated && (
                            <Link onClick={() => setMobileOpen(false)} className="p-3 rounded-[8px] hover:bg-clinic-surface-alt" to="/login">
                                Đăng nhập bệnh nhân
                            </Link>
                        )}
                        <Link onClick={() => setMobileOpen(false)} className="p-3 rounded-[8px] text-clinic-text-secondary hover:text-clinic-navy inline-flex items-center gap-1.5" to="/staff/login">
                            <LockKey size={15} weight="bold" />
                            <span>Truy cập nhân sự nội bộ</span>
                        </Link>
                    </nav>
                )}
            </header>
        </>
    )
}
