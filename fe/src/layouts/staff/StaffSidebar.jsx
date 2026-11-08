import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getStaffRoleConfig, normalizeStaffRole } from '../../utils/constants/staffRoles'
import {
    HouseLine,
    Users,
    IdentificationCard,
    CalendarCheck,
    CalendarPlus,
    ClipboardText,
    Stethoscope,
    Microscope,
    FirstAidKit,
    Receipt,
    ChartBar,
    Folders,
    ShieldCheck,
    LockKey,
    Buildings,
    Clock,
    CaretLeft,
    CaretRight,
} from '../../components/common/ClinicIcon'

export const getStaffMenuForRole = (role) => {
    const normalizedRole = normalizeStaffRole(role)

    if (normalizedRole === 'BAC_SI' || normalizedRole === 'DOCTOR') {
        return [
            {
                group: 'Lâm sàng & Bàn khám',
                items: [
                    { to: '/staff/doctor-dashboard', label: 'Tổng quan ca trực', icon: HouseLine },
                    { to: '/staff/exam-workstation', label: 'Bàn khám lâm sàng TT32', icon: Stethoscope, badge: 'Ưu tiên' },
                    { to: '/staff/specialty-exam', label: 'Khám chuyên khoa', icon: FirstAidKit },
                ],
            },
            {
                group: 'Cận lâm sàng & Kết quả',
                items: [
                    { to: '/staff/paraclinical-work', label: 'Kết quả CLS & CĐHA', icon: Microscope },
                ],
            },
            {
                group: 'Lịch hẹn & Bệnh nhân',
                items: [
                    { to: '/staff/appointments', label: 'Danh sách bệnh nhân hẹn', icon: CalendarCheck },
                    { to: '/staff/patients', label: 'Hồ sơ bệnh nhân', icon: Users },
                ],
            },
        ]
    }

    if (normalizedRole === 'LE_TAN' || normalizedRole === 'RECEPTIONIST' || normalizedRole === 'RECEPTION_SUPERVISOR' || normalizedRole === 'THU_NGAN' || normalizedRole === 'CASHIER') {
        return [
            {
                group: 'Tiếp đón, Hàng chờ & Thu ngân',
                items: [
                    { to: '/reception/dashboard', label: 'Tổng quan tiếp đón', icon: HouseLine },
                    { to: '/reception/check-in', label: 'Tiếp đón & Check-in', icon: IdentificationCard, badge: 'Cốt lõi' },
                    { to: '/reception/queue', label: 'Điều phối hàng chờ', icon: Clock },
                    { to: '/reception/cashier', label: 'Thu viện phí & Quyết toán', icon: Receipt, badge: 'VietQR' },
                    { to: '/reception/appointments', label: 'Quản lý lịch hẹn', icon: CalendarCheck },
                ],
            },
            {
                group: 'Dữ liệu & Lịch trực',
                items: [
                    { to: '/reception/patients', label: 'Hồ sơ bệnh nhân', icon: Users },
                    { to: '/reception/schedule', label: 'Lịch trực phòng khám', icon: CalendarPlus },
                    { to: '/reception/reports', label: 'Báo cáo ca trực & Doanh thu', icon: ChartBar },
                ],
            },
        ]
    }

    if (normalizedRole === 'KTV_XET_NGHIEM' || normalizedRole === 'LAB_TECH' || normalizedRole === 'ROLE-LAB-TECH') {
        return [
            {
                group: 'Phòng Xét Nghiệm (LIS)',
                items: [
                    { to: '/staff/paraclinical-work?nhom=XET_NGHIEM', label: 'Bàn xét nghiệm LIS', icon: Microscope, badge: 'Chính' },
                    { to: '/staff/queue', label: 'Hàng chờ lấy mẫu bệnh phẩm', icon: Clock },
                    { to: '/staff/paraclinical', label: 'Chỉ số tham chiếu & Kỹ thuật', icon: ClipboardText },
                ],
            },
            {
                group: 'Báo cáo & Đối soát mẫu',
                items: [
                    { to: '/staff/reports', label: 'Thống kê xét nghiệm ca trực', icon: ChartBar },
                    { to: '/staff/patients', label: 'Đối soát thông tin bệnh nhân', icon: Users },
                ],
            },
        ]
    }

    if (normalizedRole === 'KTV_CLS' || normalizedRole === 'TECHNICIAN') {
        return [
            {
                group: 'Nghiệp vụ cận lâm sàng',
                items: [
                    { to: '/staff/paraclinical-work', label: 'Bàn làm việc CLS & Kết quả', icon: Microscope, badge: 'Chính' },
                    { to: '/staff/paraclinical', label: 'Danh mục chỉ định & Dịch vụ', icon: ClipboardText },
                    { to: '/staff/queue', label: 'Hàng chờ thực hiện CLS', icon: Clock },
                ],
            },
        ]
    }

    if (normalizedRole === 'BENH_NHAN' || normalizedRole === 'CUSTOMER' || normalizedRole === 'PATIENT' || normalizedRole === 'USER') {
        return [
            {
                group: 'Cổng bệnh nhân',
                items: [
                    { to: '/', label: 'Trang chủ đặt lịch', icon: HouseLine },
                    { to: '/login', label: 'Đăng nhập / Tài khoản', icon: Users },
                ],
            },
        ]
    }

    if (normalizedRole !== 'ADMIN') return []

    return [
        {
            group: '1. Điều hành & Thống kê BI',
            items: [
                { to: '/staff/dashboard', label: 'Trung tâm Điều hành BI', icon: HouseLine },
                { to: '/staff/reports', label: 'Báo cáo & Thống kê', icon: ChartBar },
            ],
        },
        {
            group: '2. Danh mục Y tế (Master Data)',
            items: [
                { to: '/staff/catalogs/khoa-phong', label: 'Khoa phòng & Buồng khám', icon: Buildings },
                { to: '/staff/catalogs/dich-vu', label: 'Dịch vụ & Giá niêm yết', icon: Stethoscope },
                { to: '/staff/catalogs/thuoc-vat-tu', label: 'Danh mục Thuốc BYT', icon: Folders },
                { to: '/staff/catalogs/benh', label: 'Danh mục Bệnh ICD-10', icon: ClipboardText },
                { to: '/staff/templates/mau-in', label: 'Biểu mẫu & Mẫu in', icon: ClipboardText },
            ],
        },
        {
            group: '3. Nhân sự & Phân quyền (IAM)',
            items: [
                { to: '/staff/permissions', label: 'Nhân sự, CCHN & Phân quyền', icon: ShieldCheck, badge: 'RBAC' },
                { to: '/staff/patients', label: 'Hồ sơ Bệnh nhân (Master)', icon: Users },
            ],
        },
        {
            group: '4. Tuân thủ & Cấu hình Hệ thống',
            items: [
                { to: '/staff/compliance', label: 'Tuân thủ Pháp lý & Audit', icon: LockKey },
                { to: '/staff/settings', label: 'Cấu hình Phòng khám', icon: Buildings },
            ],
        },
    ]
}

export default function StaffSidebar({
    activeRole,
    realRole,
    isCollapsed,
    onToggleCollapse,
}) {
    const location = useLocation()

    const effectiveRole = normalizeStaffRole(realRole || activeRole)
    const roleConfig = getStaffRoleConfig(effectiveRole)

    const menuSections = useMemo(() => getStaffMenuForRole(effectiveRole), [effectiveRole])

    const isPathActive = (to) => {
        if (!to) return false
        if (to === '/staff/dashboard') {
            return location.pathname === '/staff' || location.pathname === '/staff/' || location.pathname === '/staff/dashboard'
        }
        return location.pathname.startsWith(to)
    }

    return (
        <aside
            className={`h-screen sticky top-0 flex flex-col shrink-0 bg-white border-r border-slate-200/80 shadow-xs z-30 transition-all duration-300 ease-in-out ${
                isCollapsed ? 'w-20' : 'w-72'
            }`}
        >
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 shrink-0">
                <Link
                    to="/staff/dashboard"
                    className={`flex items-center gap-3 transition-opacity ${isCollapsed ? 'justify-center w-full' : ''}`}
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#003553] via-[#005a8b] to-[#00B5F1] text-white flex items-center justify-center font-extrabold text-lg shadow-sm shrink-0">
                        ✚
                    </div>
                    {!isCollapsed && (
                        <div className="min-w-0">
                            <span className="font-extrabold text-base tracking-tight text-[#003553] block truncate">
                                ClinicAI <span className="text-[#00B5F1]">Staff</span>
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                                Cổng Nhân Viên Phòng Khám
                            </span>
                        </div>
                    )}
                </Link>

                {!isCollapsed && (
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        title="Thu gọn sidebar"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                        <CaretLeft size={16} />
                    </button>
                )}
            </div>

            {isCollapsed && (
                <div className="p-2 flex justify-center border-b border-slate-100">
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        title="Mở rộng sidebar"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                        <CaretRight size={16} />
                    </button>
                </div>
            )}

            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 no-scrollbar">
                {menuSections.map((section, sIdx) => (
                    <div key={sIdx} className="space-y-1">
                        {!isCollapsed && (
                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {section.group}
                            </div>
                        )}
                        {section.items.map((item, iIdx) => {
                            const IconComponent = item.icon || HouseLine
                            const active = isPathActive(item.to)

                            return (
                                <Link
                                    key={iIdx}
                                    to={item.to}
                                    title={isCollapsed ? item.label : undefined}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                                        active
                                            ? 'bg-[#00B5F1]/15 text-[#003553] font-bold shadow-2xs border border-sky-200/60'
                                            : 'text-slate-600 hover:text-[#003553] hover:bg-slate-100/80'
                                    } ${isCollapsed ? 'justify-center px-2' : ''}`}
                                >
                                    <span
                                        className={`transition-colors shrink-0 ${
                                            active ? 'text-[#00B5F1]' : 'text-slate-400 group-hover:text-[#003553]'
                                        }`}
                                    >
                                        <IconComponent size={18} />
                                    </span>

                                    {!isCollapsed && (
                                        <div className="flex-1 flex items-center justify-between min-w-0">
                                            <span className="truncate">{item.label}</span>
                                            {item.badge && (
                                                <span
                                                    className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                                        active
                                                            ? 'bg-[#00B5F1] text-white'
                                                            : 'bg-slate-100 text-slate-500'
                                                    }`}
                                                >
                                                    {item.badge}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </Link>
                            )
                        })}
                    </div>
                ))}
            </nav>

            <div className="p-3 border-t border-slate-100 bg-slate-50/50 shrink-0">
                {!isCollapsed ? (
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                Vai trò hoạt động
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`w-2 h-2 rounded-full ${roleConfig.dotColor}`} />
                                <span className="text-xs font-bold text-slate-700 truncate">
                                    {roleConfig.label}
                                </span>
                            </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                            v1.0-staff
                        </span>
                    </div>
                ) : (
                    <div className="flex justify-center">
                        <span className={`w-2.5 h-2.5 rounded-full ${roleConfig.dotColor}`} title={roleConfig.label} />
                    </div>
                )}
            </div>
        </aside>
    )
}
