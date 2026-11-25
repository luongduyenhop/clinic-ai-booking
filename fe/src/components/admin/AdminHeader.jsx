import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logoutUserAsync } from '../../redux/actions/user/authAction'
import { resetClinicDemoDataAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../common/AppNotification'
import { getAuthSeed } from '../../utils/helpers/clinicConfigHelpers'
import {
    ClinicIcon,
    ArrowsClockwise,
    SignOut,
    ShieldCheck,
    CaretDown,
    Bell,
    ArrowsOut,
    ArrowsIn,
    Globe,
} from '../common/ClinicIcon'

const SPECIALIZED_PORTALS = [
    {
        label: 'Cổng Lễ Tân & Tiếp Đón',
        path: '/reception/dashboard',
        icon: 'ClipboardText',
        badge: 'Lễ tân',
        desc: 'Tiếp đón SĐT/CCCD, hàng chờ & lịch hẹn',
    },
    {
        label: 'Cổng Bác Sĩ Lâm Sàng',
        path: '/doctor',
        icon: 'Stethoscope',
        badge: 'Bác sĩ',
        desc: 'Bàn khám chuyên khoa, ICD-10 & kê đơn',
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
        desc: 'Thu tiền VietQR/Tiền mặt, hóa đơn & khóa sổ',
    },
]

export default function AdminHeader({ pageTitle = 'Tổng quan' }) {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { user, isLoggingOut } = useSelector((state) => state.app.auth)
    const { clinicData } = useSelector((state) => state.app.admin)

    const defaultUser = getAuthSeed()?.user || {}
    const systemNotifications = clinicData?.systemNotifications || []

    const [isPortalMenuOpen, setIsPortalMenuOpen] = useState(false)
    const [isNotifOpen, setIsNotifOpen] = useState(false)
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [currentLang, setCurrentLang] = useState('VIE')
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

    const toggleLanguage = () => {
        const nextLang = currentLang === 'VIE' ? 'ENG' : 'VIE'
        setCurrentLang(nextLang)
        AppToast.info(`Đã chuyển ngôn ngữ sang: ${nextLang === 'VIE' ? 'Tiếng Việt' : 'English'}`)
    }

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {})
        } else {
            document.exitFullscreen().catch(() => {})
        }
    }

    const handleResetDemo = async () => {
        await dispatch(resetClinicDemoDataAsync())
        AppToast.success('Đã đồng bộ lại dữ liệu cấu hình chuẩn từ máy chủ')
    }

    const handleLogout = async () => {
        const result = await dispatch(logoutUserAsync())
        if (result.payload?.sessionChanged || result.meta.condition) return
        navigate('/staff/login')
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

    const displayName = user?.shortName || user?.fullName || defaultUser.shortName || 'Quản trị viên HIS'
    const fullName = user?.fullName || defaultUser.fullName || 'Quản trị viên Hệ thống'

    return (
        <header
            ref={headerRef}
            className="h-14 bg-clinic-surface border-b border-clinic-border px-3 lg:px-4 flex items-center justify-between gap-3 shrink-0 z-30 select-none"
        >
            <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-clinic-cta shrink-0" />
                <h1 className="font-display text-sm font-extrabold text-clinic-navy truncate">
                    {pageTitle}
                </h1>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
                <div className="relative hidden md:block">
                    <button
                        type="button"
                        onClick={() => {
                            setIsNotifOpen(false)
                            setIsUserMenuOpen(false)
                            setIsPortalMenuOpen(!isPortalMenuOpen)
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                            isPortalMenuOpen
                                ? 'bg-clinic-navy text-clinic-surface border-clinic-navy'
                                : 'bg-clinic-bg text-clinic-navy border-clinic-border hover:border-clinic-cta hover:text-clinic-cta'
                        }`}
                    >
                        <ClinicIcon name="Buildings" size={14} weight="duotone" />
                        <span>Cổng nghiệp vụ</span>
                        <CaretDown
                            size={11}
                            weight="bold"
                            className={`transition-transform ${isPortalMenuOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {isPortalMenuOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-80 bg-clinic-surface rounded-[6px] border border-clinic-border shadow-xs py-1.5 z-50">
                            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-clinic-text-muted border-b border-clinic-border flex items-center justify-between">
                                <span>Chuyển phân hệ tác nghiệp</span>
                                <span className="text-[10px] font-bold text-clinic-success">4 Cổng</span>
                            </div>
                            <div className="py-1 space-y-0.5">
                                {SPECIALIZED_PORTALS.map((portal) => (
                                    <Link
                                        key={portal.path}
                                        to={portal.path}
                                        onClick={() => setIsPortalMenuOpen(false)}
                                        className="flex items-start gap-2.5 px-3 py-2 text-xs text-clinic-navy hover:bg-clinic-surface-tint hover:text-clinic-cta transition-colors"
                                    >
                                        <div className="w-7 h-7 rounded-[6px] bg-clinic-surface-alt text-clinic-cta flex items-center justify-center shrink-0 mt-0.5">
                                            <ClinicIcon name={portal.icon} size={14} weight="bold" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="font-bold text-xs truncate">{portal.label}</span>
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] bg-clinic-surface-alt text-clinic-cta border border-clinic-info-border shrink-0">
                                                    {portal.badge}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-clinic-text-secondary truncate leading-tight mt-0.5">
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
                    className="w-8 h-8 rounded-[6px] border border-clinic-border bg-clinic-surface text-clinic-text-secondary hover:text-clinic-cta hover:border-clinic-cta flex items-center justify-center transition-colors cursor-pointer"
                    title="Đồng bộ lại dữ liệu cấu hình chuẩn"
                >
                    <ArrowsClockwise size={15} weight="bold" />
                </button>

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => {
                            setIsPortalMenuOpen(false)
                            setIsUserMenuOpen(false)
                            setIsNotifOpen(!isNotifOpen)
                        }}
                        className={`relative w-8 h-8 rounded-[6px] border flex items-center justify-center transition-colors cursor-pointer ${
                            isNotifOpen
                                ? 'bg-clinic-surface-alt border-clinic-cta text-clinic-cta'
                                : 'bg-clinic-surface border-clinic-border text-clinic-text-secondary hover:text-clinic-cta hover:border-clinic-cta'
                        }`}
                        title="Cảnh báo vận hành"
                    >
                        <Bell size={16} weight={unreadCount > 0 ? 'fill' : 'bold'} />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-[4px] bg-clinic-danger-solid text-clinic-surface text-[10px] font-bold flex items-center justify-center tabular-nums">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {isNotifOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-80 bg-clinic-surface rounded-[6px] border border-clinic-border shadow-xs py-1.5 z-50">
                            <div className="px-3 py-1.5 border-b border-clinic-border flex items-center justify-between">
                                <span className="text-[11px] font-bold text-clinic-navy uppercase tracking-wide">
                                    Thông báo hệ thống ({unreadCount})
                                </span>
                                {unreadCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleMarkAllNotifsRead}
                                        className="text-[11px] font-semibold text-clinic-cta hover:underline cursor-pointer"
                                    >
                                        Đã đọc tất cả
                                    </button>
                                )}
                            </div>
                            <div className="max-h-72 overflow-y-auto divide-y divide-clinic-border py-0.5">
                                {notifications.length === 0 ? (
                                    <div className="px-3 py-6 text-center text-xs text-clinic-text-muted">
                                        Không có thông báo mới
                                    </div>
                                ) : (
                                    notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            onClick={() => handleNotificationClick(notif)}
                                            className={`px-3 py-2.5 transition-colors flex items-start gap-2 cursor-pointer hover:bg-clinic-bg ${
                                                notif.unread ? 'bg-clinic-surface-tint' : ''
                                            }`}
                                        >
                                            <span
                                                className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                                                    notif.unread ? 'bg-clinic-cta' : 'bg-transparent'
                                                }`}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[11.5px] font-bold text-clinic-navy flex items-center justify-between gap-2">
                                                    <span className="truncate">{notif.title}</span>
                                                    <span className="text-[10px] text-clinic-text-muted font-normal shrink-0 tabular-nums">
                                                        {notif.time}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-clinic-text-secondary line-clamp-2 mt-0.5 leading-snug">
                                                    {notif.content}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="w-8 h-8 rounded-[6px] border border-clinic-border bg-clinic-surface text-clinic-text-secondary hover:text-clinic-cta hover:border-clinic-cta items-center justify-center transition-colors cursor-pointer hidden sm:flex"
                    title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'}
                >
                    {isFullscreen ? <ArrowsIn size={15} weight="bold" /> : <ArrowsOut size={15} weight="bold" />}
                </button>

                <button
                    type="button"
                    onClick={toggleLanguage}
                    className="hidden sm:inline-flex items-center gap-1 h-8 px-2 rounded-[6px] border border-clinic-border bg-clinic-surface hover:border-clinic-cta text-[11px] font-bold text-clinic-navy hover:text-clinic-cta transition-colors cursor-pointer"
                    title="Ngôn ngữ giao diện"
                >
                    <Globe size={13} weight="bold" className="text-clinic-cta" />
                    <span>{currentLang}</span>
                </button>

                <div className="relative pl-1.5 border-l border-clinic-border shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            setIsPortalMenuOpen(false)
                            setIsNotifOpen(false)
                            setIsUserMenuOpen(!isUserMenuOpen)
                        }}
                        className="flex items-center gap-2 px-1.5 py-1 rounded-[6px] hover:bg-clinic-bg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                    >
                        <div className="w-8 h-8 rounded-[6px] bg-clinic-navy text-clinic-surface flex items-center justify-center font-bold text-xs shrink-0">
                            QT
                        </div>
                        <div className="text-left hidden lg:block leading-tight shrink-0 whitespace-nowrap">
                            <div className="text-xs font-bold text-clinic-navy max-w-[180px] truncate">
                                {displayName}
                            </div>
                            <div className="text-[10px] text-clinic-cta font-semibold">
                                Quản trị viên
                            </div>
                        </div>
                        <CaretDown
                            size={11}
                            weight="bold"
                            className={`text-clinic-text-muted transition-transform shrink-0 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {isUserMenuOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-64 bg-clinic-surface rounded-[6px] border border-clinic-border shadow-xs py-1.5 z-50">
                            <div className="px-3 py-2 border-b border-clinic-border">
                                <div className="text-xs font-bold text-clinic-navy truncate">
                                    {fullName}
                                </div>
                                <div className="text-[11px] text-clinic-text-secondary mt-0.5">
                                    Phòng Khám Clinic-AI &bull; Vai trò ADMIN
                                </div>
                                <div className="text-[10.5px] text-clinic-success font-bold mt-1 inline-flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-clinic-success" />
                                    <span>Toàn quyền điều hành hệ thống</span>
                                </div>
                            </div>
                            <div className="py-1">
                                <Link
                                    to="/admin/cai-dat"
                                    onClick={() => setIsUserMenuOpen(false)}
                                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-clinic-navy hover:bg-clinic-surface-tint hover:text-clinic-cta transition-colors"
                                >
                                    <ClinicIcon name="SlidersHorizontal" size={14} weight="bold" />
                                    <span>Cấu hình phòng khám</span>
                                </Link>
                                <Link
                                    to="/admin/phan-quyen"
                                    onClick={() => setIsUserMenuOpen(false)}
                                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-clinic-navy hover:bg-clinic-surface-tint hover:text-clinic-cta transition-colors"
                                >
                                    <ShieldCheck size={14} weight="bold" />
                                    <span>Phân quyền Vai trò (RBAC)</span>
                                </Link>
                                <Link
                                    to="/admin/nhan-vien"
                                    onClick={() => setIsUserMenuOpen(false)}
                                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-clinic-navy hover:bg-clinic-surface-tint hover:text-clinic-cta transition-colors"
                                >
                                    <ClinicIcon name="Users" size={14} weight="bold" />
                                    <span>Nhân sự &amp; Chứng chỉ CCHN</span>
                                </Link>
                            </div>
                            <div className="border-t border-clinic-border pt-1">
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-clinic-danger hover:bg-clinic-danger-bg transition-colors cursor-pointer"
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
