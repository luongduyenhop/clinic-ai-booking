import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../../redux/slices/authSlice'
import { resetClinicDemoDataAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../common/AppNotification'
import { getNavigationConfig, getAuthSeed } from '../../services/admin/clinicSeedData'
import QuickPortalSwitcher from '../common/QuickPortalSwitcher'
import {
    ClinicIcon,
    ArrowsClockwise,
    SignOut,
    ShieldCheck,
    MagnifyingGlass,
    CaretDown,
    X,
    Bell,
    ArrowsOut,
    ArrowsIn,
    Globe,
    Check,
} from '../common/ClinicIcon'

export default function AdminHeader() {
    const location = useLocation()
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { user } = useSelector((state) => state.app.auth)
    const { clinicData } = useSelector((state) => state.app.admin)

    const { headerWorkflowTabs = [] } = getNavigationConfig(clinicData)
    const defaultUser = getAuthSeed()?.user || {}
    const patients = clinicData?.patients || []
    const systemNotifications = clinicData?.systemNotifications || []

    const [activeDropdown, setActiveDropdown] = useState(null)
    const [isNotifOpen, setIsNotifOpen] = useState(false)
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [currentLang, setCurrentLang] = useState('VIE')
    const [notifications, setNotifications] = useState(systemNotifications)

    const headerRef = useRef(null)
    const searchRef = useRef(null)

    // Sync notifications from seed data if updated
    useEffect(() => {
        if (systemNotifications.length > 0) {
            setNotifications(systemNotifications)
        }
    }, [systemNotifications])

    const unreadCount = notifications.filter((n) => n.unread).length

    // Filter patients by query
    const filteredPatients = searchQuery.trim()
        ? patients
              .filter(
                  (p) =>
                      p.hoTen?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.maBN?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.dienThoai?.includes(searchQuery)
              )
              .slice(0, 5)
        : []

    // Close all popups on click outside
    useEffect(() => {
        function handleClickOutside(e) {
            if (headerRef.current && !headerRef.current.contains(e.target)) {
                setActiveDropdown(null)
                setIsNotifOpen(false)
                setIsUserMenuOpen(false)
            }
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setIsSearchOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Track fullscreen change
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
        AppToast.success('Đã khôi phục dữ liệu gốc từ file Seed (clinicSeed.json) thành công!')
    }

    const handleLogout = () => {
        dispatch(logout())
        navigate('/login')
    }

    const handleSelectPatient = (patient) => {
        setSearchQuery('')
        setIsSearchOpen(false)
        navigate(`/admin/dang-ky-kham?patientId=${patient.id || patient.maBN}`)
        AppToast.info(`Đã chuyển tới Tiếp đón BN: ${patient.hoTen} (${patient.maBN})`)
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

    const toggleLanguage = () => {
        const nextLang = currentLang === 'VIE' ? 'ENG' : 'VIE'
        setCurrentLang(nextLang)
        AppToast.info(`Đã chuyển ngôn ngữ sang: ${nextLang === 'VIE' ? 'Tiếng Việt' : 'English'}`)
    }

    // Check if a header tab or any of its submenus is active
    const isTabActive = (tab) => {
        const currentFull = location.pathname + (location.search || '')
        if (location.pathname === tab.path) return true
        if (tab.submenu && tab.submenu.length > 0) {
            return tab.submenu.some((sub) => {
                const [subBase] = sub.path.split('?')
                return currentFull === sub.path || location.pathname === subBase
            })
        }
        return location.pathname.startsWith(`${tab.path}/`)
    }

    return (
        <header
            ref={headerRef}
            className="h-14 bg-white border-b border-[#E2EDF5] px-3 lg:px-4 flex items-center justify-between gap-3 shrink-0 shadow-2xs z-30 select-none"
        >
            {/* ========================================================= */}
            {/* 7 TOP OPERATIONAL WORKFLOW TABS (DETAILED TCLINIC ARCHITECTURE) */}
            {/* ========================================================= */}
            <div className="flex items-center gap-1 overflow-visible py-1">
                {headerWorkflowTabs.map((tab) => {
                    const active = isTabActive(tab)
                    const isDropdownOpen = activeDropdown === tab.path

                    if (tab.hasDropdown && tab.submenu && tab.submenu.length > 0) {
                        return (
                            <div key={tab.path} className="relative">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsNotifOpen(false)
                                        setIsUserMenuOpen(false)
                                        setActiveDropdown(isDropdownOpen ? null : tab.path)
                                    }}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11.5px] font-bold whitespace-nowrap transition-all cursor-pointer ${
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
                                    {tab.badge && (
                                        <span
                                            className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full text-white shrink-0 ${
                                                tab.badgeColor || 'bg-sky-500'
                                            }`}
                                        >
                                            {tab.badge}
                                        </span>
                                    )}
                                    <CaretDown
                                        size={11}
                                        weight="bold"
                                        className={`transition-transform duration-150 ${
                                            isDropdownOpen ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>

                                {/* FLOATING DETAILED SUBMENU POPOVER */}
                                {isDropdownOpen && (
                                    <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-[#D5E6F2] py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                        <div className="px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1 flex items-center justify-between">
                                            <span>{tab.dropdownTitle || tab.label}</span>
                                            <span className="text-[9px] font-semibold text-[#00B5F1] lowercase">
                                                {tab.submenu.length} mục
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
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11.5px] font-bold whitespace-nowrap transition-all ${
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
                            {tab.badge && (
                                <span
                                    className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full text-white shrink-0 ${
                                        tab.badgeColor || 'bg-sky-500'
                                    }`}
                                >
                                    {tab.badge}
                                </span>
                            )}
                        </Link>
                    )
                })}
            </div>

            {/* ========================================================= */}
            {/* QUICK PATIENT SEARCH BAR (TCLINIC SHORTCUT) */}
            {/* ========================================================= */}
            <div className="hidden 2xl:flex items-center relative flex-1 max-w-[210px]" ref={searchRef}>
                <MagnifyingGlass
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setIsSearchOpen(true)
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    placeholder="Tìm nhanh BN: Tên, SĐT, Mã KCB..."
                    className="w-full text-xs pl-8 pr-7 py-1.5 rounded-full border border-[#D5E6F2] bg-[#F8FBFE] hover:border-[#00B5F1] focus:border-[#00B5F1] focus:bg-white focus:outline-none transition placeholder:text-slate-400 text-[#003553]"
                />
                {searchQuery && (
                    <button
                        type="button"
                        onClick={() => {
                            setSearchQuery('')
                            setIsSearchOpen(false)
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        <X size={13} weight="bold" />
                    </button>
                )}

                {/* Dropdown Live Results */}
                {isSearchOpen && filteredPatients.length > 0 && (
                    <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-[#D5E6F2] py-2 z-50">
                        <div className="px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                            KẾT QUẢ TÌM KIẾM BỆNH NHÂN ({filteredPatients.length})
                        </div>
                        {filteredPatients.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelectPatient(p)}
                                className="w-full text-left px-3.5 py-2 hover:bg-[#F0F7FC] transition flex items-center justify-between cursor-pointer"
                            >
                                <div>
                                    <div className="text-xs font-bold text-[#003553]">{p.hoTen}</div>
                                    <div className="text-[11px] text-slate-500 font-mono">
                                        Mã: {p.maBN} • ĐT: {p.dienThoai}
                                    </div>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E8F4FD] text-[#00B5F1] font-bold">
                                    Tiếp đón →
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ========================================================= */}
            {/* RIGHT UTILITY SUITE (TCLINIC PROMAX UTILITIES) */}
            {/* ========================================================= */}
            <div className="flex items-center gap-1.5 shrink-0">
                {/* 1. Nút Làm Mới Dữ Liệu (Seed Reset) */}
                <button
                    type="button"
                    onClick={handleResetDemo}
                    className="p-1.5 rounded-full text-slate-500 hover:text-[#00B5F1] hover:bg-[#E8F4FD] transition cursor-pointer"
                    title="Nạp lại dữ liệu mẫu gốc từ file clinicSeed.json"
                >
                    <ArrowsClockwise size={16} weight="bold" />
                </button>

                {/* 2. Chuông Thông Báo Y Tế Lâm Sàng */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => {
                            setActiveDropdown(null)
                            setIsUserMenuOpen(false)
                            setIsNotifOpen(!isNotifOpen)
                        }}
                        className={`relative p-1.5 rounded-full transition cursor-pointer ${
                            isNotifOpen
                                ? 'bg-[#E8F4FD] text-[#00B5F1]'
                                : 'text-slate-500 hover:text-[#00B5F1] hover:bg-[#E8F4FD]'
                        }`}
                        title="Thông báo y tế lâm sàng"
                    >
                        <Bell size={17} weight={unreadCount > 0 ? 'fill' : 'bold'} />
                        {unreadCount > 0 && (
                            <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9.5px] font-black flex items-center justify-center ring-2 ring-white">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Popover Thông báo */}
                    {isNotifOpen && (
                        <div className="absolute right-0 top-full mt-2 w-80 sm:w-88 bg-white rounded-2xl shadow-xl border border-[#D5E6F2] py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
                                <span className="text-xs font-black text-[#003553] uppercase tracking-wide">
                                    THÔNG BÁO Y TẾ ({unreadCount} MỚI)
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

                {/* 3. Chế độ Toàn Màn Hình (Fullscreen) */}
                <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="p-1.5 rounded-full text-slate-500 hover:text-[#00B5F1] hover:bg-[#E8F4FD] transition cursor-pointer hidden sm:flex"
                    title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình (Fullscreen)'}
                >
                    {isFullscreen ? <ArrowsIn size={16} weight="bold" /> : <ArrowsOut size={16} weight="bold" />}
                </button>

                {/* 4. Huy Hiệu Chuyển Đổi Ngôn Ngữ (VIE / ENG) */}
                <button
                    type="button"
                    onClick={toggleLanguage}
                    className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full border border-slate-200 hover:border-[#00B5F1] text-[11px] font-black text-[#003553] hover:text-[#00B5F1] transition cursor-pointer"
                    title="Chuyển đổi ngôn ngữ giao diện"
                >
                    <Globe size={13} weight="bold" className="text-[#00B5F1]" />
                    <span>{currentLang}</span>
                </button>

                {/* Chuyển nhanh sang các Cổng vai trò */}
                <div className="hidden xl:flex items-center pl-1.5 border-l border-slate-200">
                    <QuickPortalSwitcher size="xs" />
                </div>

                {/* 5. Dropdown Bác Sĩ & Phòng Khám (User Menu) */}
                <div className="relative pl-1.5 border-l border-slate-200 shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            setActiveDropdown(null)
                            setIsNotifOpen(false)
                            setIsUserMenuOpen(!isUserMenuOpen)
                        }}
                        className="flex items-center gap-2 p-1 rounded-xl hover:bg-[#F0F7FC] transition cursor-pointer shrink-0 whitespace-nowrap"
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00B5F1] to-[#0088BA] text-white flex items-center justify-center font-black text-xs shadow-2xs ring-2 ring-[#00B5F1]/20 shrink-0">
                            BS
                        </div>
                        <div className="text-left hidden lg:block leading-tight shrink-0 whitespace-nowrap">
                            <div className="text-[11.5px] font-bold text-[#003553] max-w-[130px] truncate">
                                {user?.shortName || user?.fullName || defaultUser.shortName}
                            </div>
                            <div className="text-[10px] text-[#00B5F1] font-semibold">
                                CCHN: {user?.licenseNo || defaultUser.licenseNo}
                            </div>
                        </div>
                        <CaretDown
                            size={11}
                            weight="bold"
                            className={`text-slate-400 transition-transform shrink-0 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {/* Popover Hồ sơ Bác sĩ */}
                    {isUserMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#D5E6F2] py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="px-3.5 py-2 border-b border-slate-100">
                                <div className="text-xs font-bold text-[#003553]">
                                    {user?.fullName || defaultUser.fullName}
                                </div>
                                <div className="text-[10.5px] text-slate-500 font-medium mt-0.5">
                                    PK Đa Khoa Medpro &bull; CCHN {user?.licenseNo || defaultUser.licenseNo}
                                </div>
                                <div className="text-[10px] text-emerald-600 font-bold mt-1 inline-flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>Hành nghề hợp lệ đến 2028</span>
                                </div>
                            </div>
                            <div className="py-1">
                                <Link
                                    to="/admin/tuan-thu?tab=SETTING"
                                    onClick={() => setIsUserMenuOpen(false)}
                                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#003553] hover:bg-[#F0F7FC] hover:text-[#00B5F1] transition"
                                >
                                    <ClinicIcon name="SlidersHorizontal" size={14} weight="bold" />
                                    <span>Cài đặt phòng khám (/setting)</span>
                                </Link>
                                <Link
                                    to="/admin/nhan-vien"
                                    onClick={() => setIsUserMenuOpen(false)}
                                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#003553] hover:bg-[#F0F7FC] hover:text-[#00B5F1] transition"
                                >
                                    <ShieldCheck size={14} weight="bold" />
                                    <span>Quản lý Chứng chỉ hành nghề</span>
                                </Link>
                            </div>
                            <div className="border-t border-slate-100 pt-1">
                                <button
                                    type="button"
                                    onClick={handleLogout}
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
