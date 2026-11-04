import { useState, useRef, useEffect } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import {
    Clock,
    LockKey,
    Bell,
    ArrowsOut,
    ArrowsIn,
    Globe,
    CaretDown,
    SignOut,
    MagnifyingGlass,
    Check,
    Hospital,
    ShieldCheck,
} from '../common/ClinicIcon'
import { readAuthFromStorage } from '../../utils/auth/authStorage'
import { logoutUserAsync } from '../../redux/actions/user/authAction'
import CloseShiftModal from './CloseShiftModal'

const ROUTE_NAMES = {
    '/reception/dashboard': 'Tổng quan & Bàn làm việc Lễ tân',
    '/reception/check-in': 'Tiếp nhận bệnh nhân & Check-in',
    '/reception/queue': 'Quản lý hàng đợi phòng khám',
    '/reception/appointments': 'Quản lý lịch hẹn khám',
    '/reception/patients': 'Quản lý hồ sơ bệnh nhân',
    '/reception/schedule': 'Lịch trực bác sĩ & Sức chứa',
    '/reception/administration': 'Thủ tục hành chính & Viện phí',
    '/reception/tasks': 'Sự cố nghiệp vụ cần xử lý',
    '/reception/reports': 'Lịch sử thao tác & Báo cáo',
}

export default function ReceptionHeader() {
    const location = useLocation()
    const navigate = useNavigate()
    const dispatch = useDispatch()

    const { tasks = [], doctorAbsences = [], patients = [] } = useSelector((state) => state.reception || {})
    const { user: authUser, role: authRole } = useSelector((state) => state.app?.auth || {})
    const storedAuth = !authUser ? readAuthFromStorage() : null
    const currentUser = authUser || storedAuth?.user
    const role = authRole || storedAuth?.role

    const [currentTime, setCurrentTime] = useState(new Date())
    const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false)
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [currentLang, setCurrentLang] = useState('VIE')
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearchOpen, setIsSearchOpen] = useState(false)

    const headerRef = useRef(null)
    const searchRef = useRef(null)

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        function handleClickOutside(e) {
            if (headerRef.current && !headerRef.current.contains(e.target)) {
                setIsUserMenuOpen(false)
            }
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setIsSearchOpen(false)
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

    const handleLogout = async () => {
        setIsUserMenuOpen(false)
        await dispatch(logoutUserAsync())
        navigate('/staff/login')
    }

    const pageTitle = ROUTE_NAMES[location.pathname] || 'Cổng Lễ Tân Y Tế'
    const pendingIncidentsCount = doctorAbsences.length
    const pendingTasksCount = tasks.filter((t) => t.status === 'PENDING').length + pendingIncidentsCount

    const formattedTime = new Intl.DateTimeFormat('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(currentTime)

    const staffName =
        currentUser?.fullName ||
        currentUser?.ho_ten ||
        currentUser?.name ||
        currentUser?.username ||
        'Nhân viên Tiếp đón'

    const roleNameMap = {
        LE_TAN: 'Lễ tân chính',
        THU_NGAN: 'Lễ tân thu ngân',
        ADMIN: 'Quản trị viên',
        BAC_SI: 'Bác sĩ tiếp đón',
    }

    const staffRole =
        (role && roleNameMap[role]) ||
        (currentUser?.vai_tro && !['Lễ tân chính', 'Lễ tân kiêm thu ngân'].includes(currentUser.vai_tro)
            ? currentUser.vai_tro
            : 'Lễ tân ca trực')

    // Quick search filter for patients
    const filteredPatients = searchQuery.trim()
        ? patients
              .filter(
                  (p) =>
                      p.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.patientCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.phone?.includes(searchQuery)
              )
              .slice(0, 5)
        : []

    return (
        <header
            ref={headerRef}
            className="h-14 bg-white border-b border-[#E2EDF5] px-3.5 lg:px-5 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-xs select-none"
        >
            {/* Left: Section Title & Fast Jump */}
            <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#00B5F1] animate-pulse" />
                    <h1 className="text-sm lg:text-base font-extrabold text-[#003553] tracking-tight whitespace-nowrap font-display">
                        {pageTitle}
                    </h1>
                </div>
            </div>

            {/* Center: Live Quick Search Bar */}
            <div className="hidden md:flex flex-1 max-w-md mx-4 relative" ref={searchRef}>
                <div className="relative w-full">
                    <MagnifyingGlass
                        size={15}
                        weight="bold"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value)
                            setIsSearchOpen(true)
                        }}
                        onFocus={() => setIsSearchOpen(true)}
                        placeholder="Tìm nhanh BN, Tên, SĐT, Mã..."
                        className="w-full bg-[#F4F8FB] hover:bg-white focus:bg-white border border-[#CBD5E1] focus:border-[#00B5F1] rounded-full py-1.5 pl-9 pr-3 text-xs text-[#003553] outline-none transition shadow-2xs placeholder:text-slate-400"
                    />
                </div>

                {/* Dropdown Quick Results */}
                {isSearchOpen && searchQuery.trim() && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-[#D5E6F2] py-2 z-50 animate-in fade-in duration-150 max-h-72 overflow-y-auto">
                        <div className="px-3 py-1 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                            Kết quả tìm kiếm bệnh nhân ({filteredPatients.length})
                        </div>
                        {filteredPatients.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-500 text-center">
                                Không tìm thấy bệnh nhân nào
                            </div>
                        ) : (
                            filteredPatients.map((p) => (
                                <Link
                                    key={p.id}
                                    to={`/reception/check-in?search=${encodeURIComponent(p.phone || p.fullName)}`}
                                    onClick={() => {
                                        setIsSearchOpen(false)
                                        setSearchQuery('')
                                    }}
                                    className="flex items-center justify-between px-3 py-1.5 hover:bg-[#F0F7FC] transition text-xs"
                                >
                                    <div>
                                        <span className="font-bold text-[#003553]">{p.fullName}</span>
                                        <span className="text-slate-400 ml-2 font-mono text-[11px]">{p.patientCode}</span>
                                    </div>
                                    <span className="text-[11px] text-[#00B5F1] font-semibold">{p.phone}</span>
                                </Link>
                            ))
                        )}
                        <div className="border-t border-slate-100 mt-1 pt-1 px-3">
                            <Link
                                to={`/reception/check-in?search=${encodeURIComponent(searchQuery)}`}
                                onClick={() => {
                                    setIsSearchOpen(false)
                                    setSearchQuery('')
                                }}
                                className="text-[11px] font-bold text-[#00B5F1] hover:underline"
                            >
                                Mở màn hình tiếp nhận với từ khóa này &rarr;
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {/* Right: Working Clock, Shift Action, Notifications, User Profile */}
            <div className="flex items-center gap-2.5 shrink-0">
                {/* Working Clock */}
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F4FD] border border-[#CBE9FA] text-[#003553] text-[11.5px] font-bold shadow-2xs shrink-0 whitespace-nowrap">
                    <Clock size={13} weight="bold" className="text-[#00B5F1]" />
                    <span className="tabular-nums font-mono">{formattedTime}</span>
                </div>

                {/* Nút Đóng ca trực */}
                <button
                    type="button"
                    onClick={() => setIsCloseShiftOpen(true)}
                    className="medpro-btn-danger text-xs !py-1 !px-3 font-bold cursor-pointer shrink-0"
                >
                    <LockKey size={13} weight="bold" />
                    <span className="hidden xs:inline">Đóng ca trực</span>
                </button>

                {/* Notifications badge for tasks/incidents */}
                <Link
                    to="/reception/tasks"
                    className="relative w-8 h-8 rounded-full border border-slate-200 bg-white hover:border-[#00B5F1] hover:bg-[#E8F4FD] flex items-center justify-center text-[#003553] hover:text-[#00B5F1] transition shadow-2xs shrink-0"
                    title={`${pendingTasksCount} sự cố cần xử lý`}
                >
                    <Bell size={16} weight="bold" />
                    {pendingIncidentsCount > 0 ? (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9.5px] font-extrabold flex items-center justify-center animate-pulse">
                            {pendingIncidentsCount}
                        </span>
                    ) : pendingTasksCount > 0 ? (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[9.5px] font-extrabold flex items-center justify-center">
                            {pendingTasksCount}
                        </span>
                    ) : null}
                </Link>

                {/* Fullscreen Button */}
                <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="w-8 h-8 rounded-full border border-slate-200 hover:border-[#00B5F1] hover:bg-[#E8F4FD] text-[#003553] hover:text-[#00B5F1] flex items-center justify-center transition shadow-2xs cursor-pointer shrink-0"
                    title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình (F11)'}
                >
                    {isFullscreen ? <ArrowsIn size={15} weight="bold" /> : <ArrowsOut size={15} weight="bold" />}
                </button>

                {/* Language Switcher Badge */}
                <button
                    type="button"
                    onClick={() => setCurrentLang((prev) => (prev === 'VIE' ? 'ENG' : 'VIE'))}
                    className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 hover:border-[#00B5F1] text-[11px] font-black text-[#003553] hover:text-[#00B5F1] transition cursor-pointer"
                    title="Chuyển đổi ngôn ngữ"
                >
                    <Globe size={13} weight="bold" className="text-[#00B5F1]" />
                    <span>{currentLang}</span>
                </button>

                {/* Current Staff Profile Chip - Aligned with Admin */}
                <div className="relative pl-1 border-l border-slate-200 shrink-0">
                    <button
                        type="button"
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className="flex items-center gap-2 p-1 rounded-xl hover:bg-[#F0F7FC] transition cursor-pointer shrink-0 whitespace-nowrap"
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#003553] to-[#00B5F1] text-white flex items-center justify-center font-black text-xs shadow-2xs ring-2 ring-[#00B5F1]/30 shrink-0">
                            LT
                        </div>
                        <div className="text-left hidden lg:block leading-tight shrink-0 whitespace-nowrap">
                            <div className="text-[11.5px] font-bold text-[#003553] max-w-[130px] truncate">
                                {staffName}
                            </div>
                            <div className="text-[10px] text-[#00B5F1] font-semibold">
                                {staffRole}
                            </div>
                        </div>
                        <CaretDown
                            size={11}
                            weight="bold"
                            className={`text-slate-400 transition-transform shrink-0 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {/* Popover Hồ sơ Lễ tân */}
                    {isUserMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#D5E6F2] py-2 z-50 animate-in fade-in duration-150">
                            <div className="px-3.5 py-2 border-b border-slate-100">
                                <div className="text-xs font-bold text-[#003553]">
                                    {staffName}
                                </div>
                                <div className="text-[10.5px] text-slate-500 font-medium mt-0.5">
                                    Bàn Tiếp Đón & Lễ Tân &bull; {staffRole}
                                </div>
                                <div className="text-[10px] text-emerald-600 font-bold mt-1 inline-flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>Ca trực đang hoạt động</span>
                                </div>
                            </div>
                            <div className="py-1">
                                <Link
                                    to="/reception/tasks"
                                    onClick={() => setIsUserMenuOpen(false)}
                                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#003553] hover:bg-[#F0F7FC] hover:text-[#00B5F1] transition"
                                >
                                    <ShieldCheck size={14} weight="bold" />
                                    <span>Sự cố cần giải quyết ({pendingTasksCount})</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsUserMenuOpen(false)
                                        setIsCloseShiftOpen(true)
                                    }}
                                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition text-left"
                                >
                                    <LockKey size={14} weight="bold" />
                                    <span>Đóng ca trực & Bàn giao</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition text-left border-t border-slate-100"
                                >
                                    <SignOut size={14} weight="bold" className="text-slate-400" />
                                    <span>Đăng xuất tài khoản</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Đóng ca trực & Bàn giao */}
            <CloseShiftModal
                open={isCloseShiftOpen}
                onCancel={() => setIsCloseShiftOpen(false)}
            />
        </header>
    )
}
