import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import StaffSidebar from './StaffSidebar'
import { getStaffRoleConfig, normalizeStaffRole } from '../../utils/constants/staffRoles'
import { loadClinicDataAsync } from '../../redux/actions/admin/adminAction'
import { logoutUserAsync } from '../../redux/actions/user/authAction'
import { Clock, SignOut } from '../../components/common/ClinicIcon'

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
    '/staff/exam-workstation': 'Bàn khám lâm sàng và kê đơn',
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
        navigate('/staff/login')
    }

    const formattedTime = new Intl.DateTimeFormat('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(currentTime)

    return (
        <div className="h-screen h-[100dvh] flex bg-clinic-bg text-clinic-text overflow-hidden antialiased">
            <StaffSidebar
                activeRole={effectiveRole}
                realRole={realRole}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
            />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-14 bg-clinic-surface border-b border-clinic-border px-3.5 lg:px-5 flex items-center justify-between gap-4 shrink-0 sticky top-0 z-30 select-none">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-clinic-cta shrink-0" />
                        <h1 className="text-sm lg:text-base font-extrabold text-clinic-navy tracking-tight truncate font-display">
                            {currentTitle}
                        </h1>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-clinic-surface-alt border border-clinic-info-border text-clinic-navy text-[11.5px] font-bold shrink-0 whitespace-nowrap">
                            <Clock size={13} weight="bold" className="text-clinic-cta" />
                            <span className="font-mono tabular-nums">{formattedTime}</span>
                        </div>

                        <div
                            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-bold border ${currentRoleConfig.color}`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${currentRoleConfig.dotColor}`} />
                            <span>{currentRoleConfig.label}</span>
                        </div>

                        <div className="flex items-center gap-2 pl-2 border-l border-clinic-border">
                            <div className="w-8 h-8 rounded-[6px] bg-clinic-navy text-clinic-surface font-black text-xs flex items-center justify-center shrink-0">
                                {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'NV'}
                            </div>
                            <div className="hidden md:block text-left min-w-0 leading-tight">
                                <span className="block text-[11.5px] font-bold text-clinic-navy truncate max-w-[220px]">
                                    {user?.fullName || user?.username || 'Nhân viên'}
                                </span>
                                <span className="block text-[10px] text-clinic-cta font-semibold truncate">
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
                                <SignOut size={17} weight="bold" />
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-3 sm:p-4 overflow-y-auto bg-clinic-bg">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
