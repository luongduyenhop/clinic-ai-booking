import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import StaffSidebar, { ROLE_CONFIGS } from './StaffSidebar'
import { loadClinicDataAsync } from '../../redux/actions/admin/adminAction'
import { logout } from '../../redux/slices/authSlice'
import QuickPortalSwitcher from '../../components/common/QuickPortalSwitcher'
import {
    SignOut,
    Eye,
    ArrowsClockwise,
    Bell,
    HouseLine,
    Stethoscope,
    IdentificationCard,
    Receipt,
    Microscope,
    ShieldCheck,
} from '../../components/common/ClinicIcon'

// Ánh xạ tiêu đề trang theo URL
const ROUTE_TITLES = {
    '/staff': 'Tổng quan Cổng Nhân Viên',
    '/staff/dashboard': 'Tổng quan HIS Phòng Khám',
    '/staff/reception-dashboard': 'Tổng quan Tiếp Đón',
    '/staff/doctor-dashboard': 'Tổng quan Bàn Khám Bác Sĩ',
    '/staff/reception': 'Đăng ký Khám & Tiếp đón',
    '/staff/check-in': 'Tiếp nhận bệnh nhân & Check-in',
    '/staff/queue': 'Điều phối Hàng chờ thông minh',
    '/staff/appointments': 'Quản lý Lịch hẹn khám',
    '/staff/patients': 'Hồ sơ Bệnh nhân',
    '/staff/exam-workstation': 'Bàn khám lâm sàng TT32 & Kê đơn',
    '/staff/specialty-exam': 'Khám Chuyên khoa Lâm sàng',
    '/staff/paraclinical-work': 'Bàn làm việc Cận lâm sàng & Kết quả',
    '/staff/paraclinical': 'Chỉ định CLS & PT-TT',
    '/staff/cashier': 'Thu ngân - Viện phí & Quyết toán VietQR',
    '/staff/schedule': 'Lịch trực Phòng khám & Sức chứa',
    '/staff/catalogs': 'Quản lý Danh mục Y tế',
    '/staff/permissions': 'Phân quyền Vai trò & Nhân sự',
    '/staff/templates': 'Quản lý Mẫu in & Biểu mẫu',
    '/staff/compliance': 'Tuân thủ Pháp lý & Nhật ký EMR',
    '/staff/service-packages': 'Gói Dịch vụ & Liệu trình',
    '/staff/settings': 'Cấu hình & Cài đặt Phòng khám',
    '/staff/reports': 'Báo cáo & Thống kê Nghiệp vụ',
}

export default function StaffLayout() {
    const location = useLocation()
    const navigate = useNavigate()
    const dispatch = useDispatch()

    const { user, role: authRole } = useSelector((state) => state.app.auth)
    const { clinicData } = useSelector((state) => state.app.admin)

    const [isCollapsed, setIsCollapsed] = useState(false)
    const [previewRole, setPreviewRoleState] = useState(() => {
        try {
            return sessionStorage.getItem('staff_preview_role') || null
        } catch {
            return null
        }
    })
    const [currentTime, setCurrentTime] = useState(new Date())

    const setPreviewRole = (role) => {
        try {
            if (role) {
                sessionStorage.setItem('staff_preview_role', role)
            } else {
                sessionStorage.removeItem('staff_preview_role')
            }
        } catch {
            // ignore storage errors
        }
        setPreviewRoleState(role)
    }

    // Khởi tạo clinicData nếu chưa có
    useEffect(() => {
        if (!clinicData) {
            dispatch(loadClinicDataAsync())
        }
    }, [dispatch, clinicData])

    // Đồng hồ thời gian thực
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const realRole = authRole || user?.role || 'ADMIN'
    const effectiveRole = previewRole || realRole
    const currentRoleConfig = ROLE_CONFIGS[effectiveRole] || ROLE_CONFIGS.ADMIN
    const isPreviewing = Boolean(previewRole && previewRole !== realRole)

    // Xác định tiêu đề trang
    const currentTitle = ROUTE_TITLES[location.pathname] || 'Cổng Nhân Viên Phòng Khám'

    const handleLogout = () => {
        dispatch(logout())
        navigate('/login')
    }

    const formattedTime = new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(currentTime)

    return (
        <div className="min-h-screen flex bg-slate-100/80 font-sans text-slate-800 antialiased selection:bg-[#00B5F1]/20">
            {/* ── SIDEBAR ĐIỀU HƯỚNG THEO VAI TRÒ ────────────────────────────── */}
            <StaffSidebar
                activeRole={effectiveRole}
                realRole={realRole}
                previewRole={previewRole}
                onSelectPreviewRole={setPreviewRole}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
            />

            {/* ── KHU VỰC CHÍNH (HEADER + NỘI DUNG) ─────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                {/* ── BANNER CHẾ ĐỘ XEM TRƯỚC (NẾU ĐANG BẬT PREVIEW) ──────────── */}
                {isPreviewing && (
                    <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white px-4 py-2 text-xs flex items-center justify-between shadow-xs shrink-0 z-20">
                        <div className="flex items-center gap-2 font-medium">
                            <Eye size={16} className="text-amber-200 animate-pulse shrink-0" />
                            <span>
                                <strong>Chế độ xem trước giao diện:</strong> Đang hiển thị menu dành cho vai trò{' '}
                                <span className="underline uppercase font-bold">{currentRoleConfig.label}</span>.
                                <span className="hidden md:inline ml-2 opacity-90">
                                    (Quyền hạn API và token thực tế vẫn thuộc về vai trò <strong>{realRole}</strong>)
                                </span>
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setPreviewRole(null)}
                            className="px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 text-white font-bold text-[11px] transition flex items-center gap-1 cursor-pointer shrink-0"
                        >
                            <ArrowsClockwise size={12} />
                            Thoát xem trước
                        </button>
                    </div>
                )}

                {/* ── TOP HEADER CỔNG NHÂN VIÊN ───────────────────────────────── */}
                <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-6 flex items-center justify-between gap-4 shrink-0 shadow-2xs z-10">
                    {/* BREADCRUMB & TIÊU ĐỀ TRANG */}
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                                <Link to="/staff/dashboard" className="hover:text-[#00B5F1] transition">
                                    Cổng nhân viên
                                </Link>
                                <span>/</span>
                                <span className="text-slate-600 font-semibold truncate">{currentTitle}</span>
                            </div>
                            <h1 className="text-sm md:text-base font-extrabold text-[#003553] tracking-tight truncate">
                                {currentTitle}
                            </h1>
                        </div>
                    </div>

                    {/* KHU VỰC ĐIỀU KHIỂN & USER PROFILE */}
                    <div className="flex items-center gap-3 shrink-0">
                        {/* Đồng hồ & Ca trực */}
                        <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            <span className="font-mono">{formattedTime}</span>
                        </div>

                        {/* Quick Portal Switcher (Chuyển nhanh giữa các portal trong thời gian chuyển đổi) */}
                        <div className="hidden xl:block">
                            <QuickPortalSwitcher size="xs" />
                        </div>

                        {/* Badge vai trò hiện tại */}
                        <div
                            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${currentRoleConfig.color}`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${currentRoleConfig.dotColor}`} />
                            <span>{currentRoleConfig.label}</span>
                        </div>

                        {/* Thông tin nhân viên đăng nhập */}
                        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#003553] to-[#00B5F1] text-white font-extrabold text-xs flex items-center justify-center shadow-2xs shrink-0">
                                {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'NV'}
                            </div>
                            <div className="hidden md:block text-left min-w-0">
                                <span className="block text-xs font-bold text-slate-800 leading-tight truncate max-w-[130px]">
                                    {user?.fullName || user?.username || 'Nhân viên'}
                                </span>
                                <span className="block text-[10px] text-slate-400 font-medium leading-tight truncate">
                                    {user?.email || realRole}
                                </span>
                            </div>

                            {/* Nút đăng xuất */}
                            <button
                                type="button"
                                onClick={handleLogout}
                                title="Đăng xuất khỏi hệ thống"
                                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer ml-1"
                            >
                                <SignOut size={18} />
                            </button>
                        </div>
                    </div>
                </header>

                {/* ── KHU VỰC RENDER NỘI DUNG CHÍNH (OUTLET) ─────────────────── */}
                <main className="flex-1 p-4 md:p-6 overflow-y-auto no-scrollbar bg-slate-100/60">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}
