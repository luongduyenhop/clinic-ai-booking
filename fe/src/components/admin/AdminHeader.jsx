import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logoutUserAsync } from '../../redux/actions/user/authAction'
import { resetClinicDemoDataAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../common/AppNotification'
import { getNavigationConfig, getAuthSeed } from '../../utils/helpers/clinicConfigHelpers'
import {
    ClinicIcon,
    ArrowsClockwise,
    SignOut,
    ShieldCheck,
    CaretDown,
    Bell,
    ArrowsOut,
    ArrowsIn,
} from '../common/ClinicIcon'

const SPECIALIZED_PORTALS = [
    {
        label: 'Cổng Lễ Tân & Tiếp Đón',
        path: '/reception/dashboard',
        icon: 'ClipboardText',
        badge: 'Lễ tân',
        desc: 'Tiếp đón SĐT/CCCD, hàng chờ realtime & lịch hẹn',
    },
    {
        label: 'Cổng Bác Sĩ Lâm Sàng',
        path: '/doctor',
        icon: 'Stethoscope',
        badge: 'Bác sĩ',
        desc: 'Bàn khám chuyên khoa, chẩn đoán ICD-10 & kê đơn',
    },
    {
        label: 'Cổng Kỹ Thuật Viên CLS',
        path: '/staff/paraclinical-work',
        icon: 'Microscope',
        badge: 'KTV CLS',
        desc: 'Xét nghiệm, siêu âm, X-quang & trả kết quả',
    },
    {
        label: 'Cổng Thu Ngân & Viện Phí',
        path: '/staff/cashier',
        icon: 'Receipt',
        badge: 'Thu ngân',
        desc: 'Thu tiền VietQR/Tiền mặt, hóa đơn & đối soát ca',
    },
]

export default function AdminHeader() {
    const location = useLocation()
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { user, isLoggingOut } = useSelector((state) => state.app.auth)
    const { clinicData } = useSelector((state) => state.app.admin)

    const { headerWorkflowTabs = [] } = getNavigationConfig(clinicData)
    const defaultUser = getAuthSeed()?.user || {}
    const systemNotifications = clinicData?.systemNotifications || []

    const [activeDropdown, setActiveDropdown] = useState(null)
    const [isPortalMenuOpen, setIsPortalMenuOpen] = useState(false)
    const [isNotifOpen, setIsNotifOpen] = useState(false)
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [notifications, setNotifications] = useState(systemNotifications)

    const headerRef = useRef(null)

    useEffect(() => {
        if (systemNotifications.length > 0) {
            setNotifications(systemNotifications)
        }
    }, [systemNotifications])

    const unreadCount = notifications.filter((n) => n.unread).length

    useEffect(() => {
        function handleClickOutside(e) {
            if (headerRef.current && !headerRef.current.contains(e.target)) {
                setActiveDropdown(null)
                setIsPortalMenuOpen(false)
                setIsNotifOpen(false)
                setIsUserMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        function handleFullscreenChange() {
            setIsFullscreen(Boolean(document.fullscreenElement))
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {})
        } else {
            document.exitFullscreen().catch(() => {})
        }
    }

    const handleResetDemo = async () => {
        await dispatch(resetClinicDemoDataAsync())
        AppToast.success('Đã đồng bộ lại dữ liệu cấu hình chuẩn từ máy chủ!')
    }

    const handleLogout = async () => {
        const result = await dispatch(logoutUserAsync())
        if (result.payload?.sessionChanged || result.meta.condition) return
        navigate('/login')
    }

    const handleMarkAllNotifsRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
        AppToast.success('Đã đánh dấu tất cả thông báo là đã đọc')
    }

    const handleNotificationClick = (notif) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === notif.id ? { ...n, unread: false } : n))
        )
        setIsNotifOpen(false)
        if (notif.link) {
            navigate(notif.link)
        }
    }

    const isTabActive = (tab) => {
        const currentFull = location.pathname + (location.search || '')
        if (location.pathname === tab.path) return true
        if (tab.submenu && tab.submenu.length > 0) {
            return tab.submenu.some((sub) => {
                const [subBase] = sub.path.split('?')
                return currentFull === sub.path || location.pathname === subBase
            })
        }
        return tab.path !== '/admin' && location.pathname.startsWith(`${tab.path}/`)
    }

    return (
        <header
            ref={headerRef}
            className="h-14 bg-white border-b border-[#E2EDF5] px-3 lg:px-4 flex items-center justify-between gap-3 shrink-0 shadow-2xs z-30 select-none"
        >
            <div className="flex items-center gap-1.5 overflow-visible py-1">
                {headerWorkflowTabs.map((tab) => {
                    const active = isTabActive(tab)
                    const isDropdownOpen = activeDropdown === tab.path

                    if (tab.hasDropdown && tab.submenu && tab.submenu.length > 0) {
                        return (
                            <div key={tab.path} className="relative">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsPortalMenuOpen(false)
                                        setIsNotifOpen(false)
                                        setIsUserMenuOpen(false)
                                        setActiveDropdown(isDropdownOpen ? null : tab.path)
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                                        active || isDropdownOpen
                                            ? 'bg-[#00B5F1] text-white shadow-xs ring-2 ring-[#00B5F1]/20'
                                            : 'bg-[#F0F7FC] text-[#003553] hover:bg-[#00B5F1]/12 hover:text-[#00B5F1]'
                                    }`}
                                >
                                    <ClinicIcon
                                        name={tab.icon}
                                        size={15}
                                        weight={active || isDropdownOpen ? 'fill' : 'duotone'}
                                        className={active || isDropdownOpen ? 'text-white' : 'text-[#00B5F1]'}
                                    />
                                    <span>{tab.label}</span>
                                    <CaretDown
                                        size={11}
                                        weight="bold"
                                        className={`transition-transform duration-150 ${
                                            isDropdownOpen ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>

                                {isDropdownOpen && (
                                    <div className="absolute left-0 top-full mt-2 w-76 bg-white rounded-2xl shadow-xl border border-[#D5E6F2] py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                        <div className="px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1 flex items-center justify-between">
                                            <span>{tab.dropdownTitle || tab.label}</span>
                                            <span className="text-[9px] font-semibold text-[#00B5F1] lowercase">
                                                {tab.submenu.length} phân mục
                                            </span>
                                        </div>
                                        <div className="max-h-80 overflow-y-auto py-0.5 space-y-0.5">
                                            {tab.submenu.map((sub) => {
                                                const currentFull = location.pathname + (location.search || '')
                                                const isSubActive = currentFull === sub.path

                                                return (
                                                    <Link
                                                        key={sub.path}
                                                        to={sub.path}
                                                        onClick={() => setActiveDropdown(null)}
                                                        className={`flex items-start gap-2.5 px-3 py-2 text-xs transition rounded-lg mx-1 ${
                                                            isSubActive
                                                                ? 'bg-[#E8F4FD] text-[#00B5F1] font-bold'
                                                                : 'text-[#003553] hover:bg-[#F0F7FC] hover:text-[#00B5F1]'
                                                        }`}
                                                    >
                                                        <div
                                                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                                                isSubActive
                                                                    ? 'bg-[#00B5F1] text-white'
                                                                    : 'bg-[#F0F7FC] text-[#00B5F1]'
                                                            }`}
                                                        >
                                                            <ClinicIcon
                                                                name={sub.icon || tab.icon}
                                                                size={13}
                                                                weight={isSubActive ? 'fill' : 'bold'}
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold text-[12px] truncate">
                                                                {sub.label}
                                                            </div>
                                                            {sub.desc && (
                                                                <div className="text-[10px] text-slate-400 truncate font-normal leading-tight">
                                                                    {sub.desc}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    }

                    return (
                        <Link
                            key={tab.path}
                            to={tab.path}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-bold whitespace-nowrap transition-all ${
                                active
                                    ? 'bg-[#00B5F1] text-white shadow-xs ring-2 ring-[#00B5F1]/20'
                                    : 'bg-[#F0F7FC] text-[#003553] hover:bg-[#00B5F1]/12 hover:text-[#00B5F1]'
                            }`}
                        >
                            <ClinicIcon
                                name={tab.icon}
                                size={15}
                                weight={active ? 'fill' : 'duotone'}
                                className={active ? 'text-white' : 'text-[#00B5F1]'}
                            />
                            <span>{tab.label}</span>
                        </Link>
                    )
                })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <div className="relative hidden md:block">
                    <button
                        type="button"
                        onClick={() => {
                            setActiveDropdown(null)
                            setIsNotifOpen(false)
                            setIsUserMenuOpen(false)
                            setIsPortalMenuOpen(!isPortalMenuOpen)
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                            isPortalMenuOpen
                                ? 'bg-[#003553] text-white border-[#003553]'
                                : 'bg-slate-50 text-[#003553] border-slate-200 hover:border-[#00B5F1] hover:text-[#00B5F1]'
                        }`}
                    >
                        <ClinicIcon name="Buildings" size={14} weight="duotone" />
                        <span>Giám sát Cổng Nghiệp Vụ</span>
                        <CaretDown
                            size={11}
                            weight="bold"
                            className={`transition-transform ${isPortalMenuOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {isPortalMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-[#D5E6F2] py-2 z-50">
                            <div className="px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1 flex items-center justify-between">
                                <span>CHUYỂN CỔNG TÁC NGHIỆP CHUYÊN BIỆT</span>
                                <span className="text-[9px] font-bold text-emerald-600">4 Phân hệ</span>
                            </div>
                            <div className="py-0.5 space-y-0.5">
                                {SPECIALIZED_PORTALS.map((portal) => (
                                    <Link
                                        key={portal.path}
                                        to={portal.path}
                                        onClick={() => setIsPortalMenuOpen(false)}
                                        className="flex items-start gap-2.5 px-3 py-2 text-xs text-[#003553] hover:bg-[#F0F7FC] hover:text-[#00B5F1] transition rounded-lg mx-1"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-[#F0F7FC] text-[#00B5F1] flex items-center justify-center shrink-0 mt-0.5">
                                            <ClinicIcon name={portal.icon} size={14} weight="bold" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="font-bold text-[12px] truncate">{portal.label}</span>
                                                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-[#00B5F1] shrink-0">
                                                    {portal.badge}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 truncate font-normal leading-tight mt-0.5">
                                                {portal.desc}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    onClick={handleResetDemo}
                    className="p-1.5 rounded-full text-slate-500 hover:text-[#00B5F1] hover:bg-[#E8F4FD] transition cursor-pointer"
                    title="Đồng bộ lại dữ liệu chuẩn từ máy chủ"
                >
                    <ArrowsClockwise size={16} weight="bold" />
                </button>

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => {
                            setActiveDropdown(null)
                            setIsPortalMenuOpen(false)
                            setIsUserMenuOpen(false)
                            setIsNotifOpen(!isNotifOpen)
                        }}
                        className={`relative p-1.5 rounded-full transition cursor-pointer ${
                            isNotifOpen
                                ? 'bg-[#E8F4FD] text-[#00B5F1]'
                                : 'text-slate-500 hover:text-[#00B5F1] hover:bg-[#E8F4FD]'
                        }`}
                        title="Thông báo hệ thống quản trị"
                    >
                        <Bell size={17} weight={unreadCount > 0 ? 'fill' : 'bold'} />
                        {unreadCount > 0 && (
                            <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9.5px] font-black flex items-center justify-center ring-2 ring-white">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {isNotifOpen && (
                        <div className="absolute right-0 top-full mt-2 w-80 sm:w-88 bg-white rounded-2xl shadow-xl border border-[#D5E6F2] py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
                                <span className="text-xs font-black text-[#003553] uppercase tracking-wide">
                                    THÔNG BÁO HỆ THỐNG ({unreadCount} MỚI)
                                </span>
                                {unreadCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleMarkAllNotifsRead}
                                        className="text-[10px] font-bold text-[#00B5F1] hover:underline cursor-pointer"
                                    >
                                        Đã đọc tất cả
                                    </button>
                                )}
                            </div>
                            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 py-1">
                                {notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`px-3.5 py-2.5 transition flex items-start gap-2.5 cursor-pointer hover:bg-[#F8FCFF] ${
                                            notif.unread ? 'bg-[#F0F8FE]/60' : ''
                                        }`}
                                    >
                                        <span
                                            className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                                notif.unread ? 'bg-[#00B5F1]' : 'bg-transparent'
                                            }`}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[11.5px] font-bold text-[#003553] flex items-center justify-between">
                                                <span className="truncate">{notif.title}</span>
                                                <span className="text-[9.5px] text-slate-400 font-normal shrink-0 ml-1">
                                                    {notif.time}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                                                {notif.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="p-1.5 rounded-full text-slate-500 hover:text-[#00B5F1] hover:bg-[#E8F4FD] transition cursor-pointer hidden sm:flex"
                    title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình (Fullscreen)'}
                >
                    {isFullscreen ? <ArrowsIn size={16} weight="bold" /> : <ArrowsOut size={16} weight="bold" />}
                </button>

                <div className="relative pl-1.5 border-l border-slate-200 shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            setActiveDropdown(null)
                            setIsPortalMenuOpen(false)
                            setIsNotifOpen(false)
                            setIsUserMenuOpen(!isUserMenuOpen)
                        }}
                        className="flex items-center gap-2 p-1 rounded-xl hover:bg-[#F0F7FC] transition cursor-pointer shrink-0 whitespace-nowrap"
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#003553] to-[#00B5F1] text-white flex items-center justify-center font-black text-xs shadow-2xs ring-2 ring-[#00B5F1]/20 shrink-0">
                            QT
                        </div>
                        <div className="text-left hidden lg:block leading-tight shrink-0 whitespace-nowrap">
                            <div className="text-[11.5px] font-bold text-[#003553] max-w-[140px] truncate">
                                {user?.shortName || user?.fullName || defaultUser.shortName || 'Quản trị viên HIS'}
                            </div>
                            <div className="text-[10px] text-[#00B5F1] font-semibold">
                                Quản trị Hệ thống (Admin)
                            </div>
                        </div>
                        <CaretDown
                            size={11}
                            weight="bold"
                            className={`text-slate-400 transition-transform shrink-0 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {isUserMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#D5E6F2] py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="px-3.5 py-2 border-b border-slate-100">
                                <div className="text-xs font-bold text-[#003553]">
                                    {user?.fullName || defaultUser.fullName || 'Quản trị viên Hệ thống'}
                                </div>
                                <div className="text-[10.5px] text-slate-500 font-medium mt-0.5">
                                    Phòng Khám Đa Khoa Clinic-AI &bull; Vai trò: ADMIN
                                </div>
                                <div className="text-[10px] text-emerald-600 font-bold mt-1 inline-flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>Quyền Quản trị Toàn hệ thống</span>
                                </div>
                            </div>
                            <div className="py-1">
                                <Link
                                    to="/admin/cai-dat"
                                    onClick={() => setIsUserMenuOpen(false)}
                                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#003553] hover:bg-[#F0F7FC] hover:text-[#00B5F1] transition"
                                >
                                    <ClinicIcon name="SlidersHorizontal" size={14} weight="bold" />
                                    <span>Cấu hình phòng khám (/cai-dat)</span>
                                </Link>
                                <Link
                                    to="/admin/phan-quyen"
                                    onClick={() => setIsUserMenuOpen(false)}
                                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#003553] hover:bg-[#F0F7FC] hover:text-[#00B5F1] transition"
                                >
                                    <ShieldCheck size={14} weight="bold" />
                                    <span>Phân quyền Vai trò (RBAC)</span>
                                </Link>
                                <Link
                                    to="/admin/nhan-vien"
                                    onClick={() => setIsUserMenuOpen(false)}
                                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#003553] hover:bg-[#F0F7FC] hover:text-[#00B5F1] transition"
                                >
                                    <ClinicIcon name="Users" size={14} weight="bold" />
                                    <span>Quản lý Nhân sự & CCHN</span>
                                </Link>
                            </div>
                            <div className="border-t border-slate-100 pt-1">
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                >
                                    <SignOut size={14} weight="bold" />
                                    <span>Đăng xuất khỏi hệ thống</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}
