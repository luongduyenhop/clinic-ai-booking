import { useState, useRef, useEffect } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import {
    LockKey,
    Bell,
    ArrowsOut,
    ArrowsIn,
    CaretDown,
    SignOut,
    MagnifyingGlass,
    ArrowRight,
    ShieldCheck,
} from '../common/ClinicIcon'
import { readAuthFromStorage } from '../../utils/auth/authStorage'
import { logoutUserAsync } from '../../redux/actions/user/authAction'
import { isIncidentResolved } from '../../redux/slices/reception/receptionSlice'
import { getAvatarInitials, stripDemoTag } from '../../utils/helpers/doctorNameHelper'
import CloseShiftModal from './CloseShiftModal'

const ROUTE_NAMES = {
    '/reception/dashboard': 'Tổng quan & Bàn làm việc Lễ tân',
    '/reception/check-in': 'Tiếp nhận bệnh nhân & Check-in',
    '/reception/queue': 'Quản lý hàng đợi phòng khám',
    '/reception/cashier': 'Thu viện phí & Hóa đơn VietQR',
    '/reception/billing-audit': 'Đối soát viện phí & Biên lai',
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

    const {
        tasks = [],
        doctorAbsences = [],
        resolvedIncidentKeys = [],
        patients = [],
    } = useSelector((state) => state.reception || {})
    const { user: authUser, role: authRole } = useSelector((state) => state.app?.auth || {})
    const storedAuth = !authUser ? readAuthFromStorage() : null
    const currentUser = authUser || storedAuth?.user
    const role = authRole || storedAuth?.role

    const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false)
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearchOpen, setIsSearchOpen] = useState(false)

    const headerRef = useRef(null)
    const searchRef = useRef(null)

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
    const pendingIncidentsCount = doctorAbsences.filter((inc) => !isIncidentResolved(inc, resolvedIncidentKeys)).length
    const pendingTasksCount = tasks.filter((t) => t.status === 'PENDING').length + pendingIncidentsCount

    const staffName = stripDemoTag(
        currentUser?.fullName ||
            currentUser?.ho_ten ||
            currentUser?.name ||
            currentUser?.username ||
            'Nhân viên Tiếp đón'
    )

    const roleNameMap = {
        LE_TAN: 'Lễ tân tiếp đón',
        THU_NGAN: 'Thu ngân viện phí',
        DIEU_DUONG: 'Điều dưỡng',
        ADMIN: 'Quản trị viên',
        BAC_SI: 'Bác sĩ',
    }

    const normalizedRoleKey = String(role || currentUser?.vai_tro || '').trim().toUpperCase()
    const staffRole =
        roleNameMap[normalizedRoleKey] ||
        (currentUser?.vai_tro && !['Lễ tân chính', 'Lễ tân kiêm thu ngân'].includes(currentUser.vai_tro)
            ? currentUser.vai_tro
            : 'Lễ tân tiếp đón')

    const staffInitials = getAvatarInitials(staffName, 'LT')

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
            className="h-[52px] bg-clinic-surface border-b border-clinic-border px-4 flex items-center justify-between shrink-0 sticky top-0 z-30 select-none"
        >
            <div className="flex items-center gap-3 shrink-0">
                <h1 className="text-sm font-semibold text-clinic-navy tracking-tight whitespace-nowrap">
                    {pageTitle}
                </h1>
            </div>

            <div className="hidden md:flex flex-1 max-w-sm mx-4 relative" ref={searchRef}>
                <div className="relative w-full">
                    <MagnifyingGlass
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none"
                    />
                    <input
                        type="text"
                        aria-label="Tìm nhanh bệnh nhân theo tên, số điện thoại hoặc mã"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value)
                            setIsSearchOpen(true)
                        }}
                        onFocus={() => setIsSearchOpen(true)}
                        placeholder="Tra nhanh bệnh nhân (SĐT, tên, mã BN)..."
                        className="w-full h-8 bg-clinic-bg hover:bg-clinic-surface focus:bg-clinic-surface border border-clinic-border focus:border-clinic-cta rounded-[6px] pl-8 pr-3 text-xs text-clinic-text outline-none transition placeholder:text-clinic-text-muted"
                    />
                </div>

                {isSearchOpen && searchQuery.trim() && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-clinic-surface rounded-[6px] border border-clinic-border py-2 z-50 max-h-72 overflow-y-auto">
                        <div className="px-3 py-1 text-[11px] font-medium text-clinic-text-secondary tabular-nums">
                            Kết quả bệnh nhân ({filteredPatients.length})
                        </div>
                        {filteredPatients.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-clinic-text-secondary text-center">
                                Không tìm thấy hồ sơ khớp từ khóa
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
                                    className="flex items-center justify-between px-3 py-1.5 hover:bg-clinic-surface-tint transition text-xs"
                                >
                                    <div>
                                        <span className="font-semibold text-clinic-navy">{p.fullName}</span>
                                        <span className="text-clinic-text-muted ml-2 text-[11px] tabular-nums">{p.patientCode}</span>
                                    </div>
                                    <span className="text-[11px] text-clinic-cta font-medium tabular-nums">{p.phone}</span>
                                </Link>
                            ))
                        )}
                        <div className="border-t border-clinic-border mt-1 pt-1.5 px-3">
                            <Link
                                to={`/reception/check-in?search=${encodeURIComponent(searchQuery)}`}
                                onClick={() => {
                                    setIsSearchOpen(false)
                                    setSearchQuery('')
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-clinic-cta hover:underline"
                            >
                                <span>Mở tiếp nhận với từ khóa này</span>
                                <ArrowRight size={12} weight="bold" />
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <button
                    type="button"
                    onClick={() => setIsCloseShiftOpen(true)}
                    className="h-8 px-3 rounded-[6px] border border-clinic-border-strong bg-clinic-surface hover:border-clinic-danger-border hover:bg-clinic-danger-bg hover:text-clinic-danger text-clinic-navy text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                    <LockKey size={14} />
                    <span className="hidden sm:inline">Đóng ca</span>
                </button>

                <Link
                    to="/reception/tasks"
                    className="relative w-8 h-8 rounded-[6px] border border-clinic-border bg-clinic-surface hover:border-clinic-cta hover:bg-clinic-surface-alt flex items-center justify-center text-clinic-navy hover:text-clinic-cta transition shrink-0"
                    title={`${pendingTasksCount} sự cố cần xử lý`}
                >
                    <Bell size={16} weight="bold" />
                    {pendingIncidentsCount > 0 ? (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-[4px] bg-clinic-danger-solid text-clinic-surface text-[10px] font-extrabold flex items-center justify-center tabular-nums">
                            {pendingIncidentsCount}
                        </span>
                    ) : pendingTasksCount > 0 ? (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-[4px] bg-clinic-amber text-clinic-navy text-[10px] font-extrabold flex items-center justify-center tabular-nums">
                            {pendingTasksCount}
                        </span>
                    ) : null}
                </Link>

                <button
                    type="button"
                    aria-label={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'}
                    onClick={toggleFullscreen}
                    className="w-8 h-8 rounded-[6px] border border-clinic-border hover:border-clinic-cta hover:bg-clinic-surface-alt text-clinic-navy hover:text-clinic-cta flex items-center justify-center transition cursor-pointer shrink-0"
                    title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình (F11)'}
                >
                    {isFullscreen ? <ArrowsIn size={15} weight="bold" /> : <ArrowsOut size={15} weight="bold" />}
                </button>

                <div className="relative pl-1 border-l border-clinic-border shrink-0">
                    <button
                        type="button"
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className="flex items-center gap-2 p-1 rounded-[6px] hover:bg-clinic-surface-tint transition cursor-pointer shrink-0 whitespace-nowrap"
                    >
                        <div className="w-8 h-8 rounded-[6px] bg-clinic-navy text-clinic-surface flex items-center justify-center font-black text-xs shrink-0">
                            {staffInitials}
                        </div>
                        <div className="text-left hidden lg:block leading-tight shrink-0 whitespace-nowrap">
                            <div className="text-[11.5px] font-bold text-clinic-navy max-w-[130px] truncate">
                                {staffName}
                            </div>
                            <div className="text-[10px] text-clinic-cta font-semibold">
                                {staffRole}
                            </div>
                        </div>
                        <CaretDown
                            size={11}
                            weight="bold"
                            className={`text-clinic-text-muted transition-transform shrink-0 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {isUserMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-clinic-surface rounded-[6px] border border-clinic-border py-2 z-50">
                            <div className="px-3.5 py-2 border-b border-clinic-border">
                                <div className="text-xs font-bold text-clinic-navy">
                                    {staffName}
                                </div>
                                <div className="text-[10.5px] text-clinic-text-secondary font-medium mt-0.5">
                                    Bàn Tiếp Đón &amp; Lễ Tân · {staffRole}
                                </div>
                                <div className="text-[10px] text-clinic-success font-bold mt-1 inline-flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-clinic-success" />
                                    <span>Ca trực đang hoạt động</span>
                                </div>
                            </div>
                            <div className="py-1">
                                <Link
                                    to="/reception/tasks"
                                    onClick={() => setIsUserMenuOpen(false)}
                                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-clinic-navy hover:bg-clinic-surface-tint hover:text-clinic-cta transition tabular-nums"
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
                                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-clinic-danger hover:bg-clinic-danger-bg transition text-left cursor-pointer"
                                >
                                    <LockKey size={14} weight="bold" />
                                    <span>Đóng ca trực &amp; Bàn giao</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-clinic-text-secondary hover:bg-clinic-bg transition text-left border-t border-clinic-border cursor-pointer"
                                >
                                    <SignOut size={14} weight="bold" className="text-clinic-text-muted" />
                                    <span>Đăng xuất tài khoản</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <CloseShiftModal
                open={isCloseShiftOpen}
                onCancel={() => setIsCloseShiftOpen(false)}
            />
        </header>
    )
}
