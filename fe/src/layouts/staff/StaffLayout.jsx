import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import StaffSidebar from './StaffSidebar'
import { getStaffRoleConfig, normalizeStaffRole } from '../../utils/constants/staffRoles'
import { loadClinicDataAsync } from '../../redux/actions/admin/adminAction'
import { logoutUserAsync } from '../../redux/actions/user/authAction'
import { SignOut } from '../../components/common/ClinicIcon'

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

    const { user, role: authRole, isLoggingOut } = useSelector((state) => state.app.auth)

    const [isCollapsed, setIsCollapsed] = useState(false)
    const [currentTime, setCurrentTime] = useState(() => new Date())

    useEffect(() => {
        dispatch(loadClinicDataAsync())
    }, [dispatch, authRole, user?.id])

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const realRole = authRole || user?.role
    const effectiveRole = normalizeStaffRole(realRole)
    const currentRoleConfig = getStaffRoleConfig(effectiveRole)

    const currentTitle =
        effectiveRole === 'KTV_XET_NGHIEM' && location.pathname === '/staff/paraclinical-work'
            ? 'Bàn làm việc Xét nghiệm LIS · Huyết học - Sinh hóa'
            : ROUTE_TITLES[location.pathname] || 'Cổng Nhân Viên Phòng Khám'

    const handleLogout = async () => {
        const result = await dispatch(logoutUserAsync())
        if (result.payload?.sessionChanged || result.meta.condition) return
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
        <div className="min-h-screen min-h-[100dvh] flex bg-clinic-bg font-sans text-clinic-text antialiased">
            <StaffSidebar
                activeRole={effectiveRole}
                realRole={realRole}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
            />

            <div className="flex-1 flex flex-col min-w-0 h-screen h-[100dvh] overflow-hidden">
                <header className="h-14 bg-clinic-surface border-b border-clinic-border px-4 md:px-6 flex items-center justify-between gap-4 shrink-0 z-10">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[11px] text-clinic-text-muted font-medium">
                                <Link to="/staff/dashboard" className="hover:text-clinic-cta transition-colors">
                                    Cổng nhân viên
                                </Link>
                                <span>/</span>
                                <span className="text-clinic-text-secondary font-semibold truncate">{currentTitle}</span>
                            </div>
                            <h1 className="font-display text-sm md:text-base font-extrabold text-clinic-navy tracking-tight truncate">
                                {currentTitle}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-clinic-text-secondary bg-clinic-bg-muted px-2.5 py-1.5 rounded-[6px] border border-clinic-border">
                            <span className="w-2 h-2 rounded-full bg-clinic-success shrink-0" />
                            <span className="font-mono tabular-nums">{formattedTime}</span>
                        </div>

                        <div
                            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${currentRoleConfig.color}`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${currentRoleConfig.dotColor}`} />
                            <span>{currentRoleConfig.label}</span>
                        </div>

                        <div className="flex items-center gap-2.5 pl-2 border-l border-clinic-border">
                            <div className="w-8 h-8 rounded-[6px] bg-clinic-navy text-clinic-surface font-extrabold text-xs flex items-center justify-center shrink-0">
                                {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'NV'}
                            </div>
                            <div className="hidden md:block text-left min-w-0">
                                <span className="block text-xs font-bold text-clinic-text leading-tight truncate max-w-[130px]">
                                    {user?.fullName || user?.username || 'Nhân viên'}
                                </span>
                                <span className="block text-[10px] text-clinic-text-muted font-medium leading-tight truncate">
                                    {user?.email || realRole}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                title="Đăng xuất khỏi hệ thống"
                                className="p-2 rounded-[6px] text-clinic-text-muted hover:text-clinic-danger hover:bg-clinic-danger-bg transition-colors cursor-pointer ml-1"
                            >
                                <SignOut size={18} />
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-4 md:p-6 overflow-y-auto no-scrollbar bg-clinic-bg">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}
