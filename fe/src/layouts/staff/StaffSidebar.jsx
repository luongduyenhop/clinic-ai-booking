import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getStaffRoleConfig, normalizeStaffRole } from '../../utils/constants/staffRoles'
import { getRoleDefaultPath } from '../../utils/constants/System'
import {
    Hospital,
    HouseLine,
    Users,
    IdentificationCard,
    CalendarCheck,
    CalendarPlus,
    ClipboardText,
    Stethoscope,
    Microscope,
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
                    { to: '/staff/exam-workstation', label: 'Bàn khám lâm sàng', icon: Stethoscope },
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
                    { to: '/reception/check-in', label: 'Tiếp đón & Check-in', icon: IdentificationCard },
                    { to: '/reception/queue', label: 'Điều phối hàng chờ', icon: Clock },
                    { to: '/reception/cashier', label: 'Thu viện phí & Quyết toán', icon: Receipt },
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

    if (
        normalizedRole === 'KTV_XET_NGHIEM' ||
        normalizedRole === 'LAB_TECH' ||
        normalizedRole === 'ROLE-LAB-TECH' ||
        normalizedRole === 'KTV_CLS' ||
        normalizedRole === 'TECHNICIAN'
    ) {
        return [
            {
                group: 'Phân hệ Kỹ thuật viên (LIS & PACS)',
                items: [
                    { to: '/staff/paraclinical-work', label: 'Bàn làm việc CLS & Ký duyệt', icon: Microscope },
                    { to: '/staff/paraclinical', label: 'Khoảng tham chiếu & Danh mục kỹ thuật', icon: ClipboardText },
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
            group: 'Điều hành và thống kê',
            items: [
                { to: '/staff/dashboard', label: 'Tổng quan', icon: HouseLine },
                { to: '/staff/reports', label: 'Báo cáo và thống kê', icon: ChartBar },
            ],
        },
        {
            group: 'Danh mục y tế',
            items: [
                { to: '/staff/catalogs/khoa-phong', label: 'Khoa phòng và buồng khám', icon: Buildings },
                { to: '/staff/catalogs/dich-vu', label: 'Dịch vụ và giá niêm yết', icon: Stethoscope },
                { to: '/staff/catalogs/thuoc-vat-tu', label: 'Danh mục thuốc BYT', icon: Folders },
                { to: '/staff/catalogs/benh', label: 'Danh mục bệnh ICD-10', icon: ClipboardText },
                { to: '/staff/templates/mau-in', label: 'Biểu mẫu và mẫu in', icon: ClipboardText },
            ],
        },
        {
            group: 'Nhân sự và phân quyền',
            items: [
                { to: '/staff/permissions', label: 'Nhân sự, CCHN và phân quyền', icon: ShieldCheck },
                { to: '/admin/phan-lich', label: 'Phân lịch trực và ca làm việc', icon: CalendarPlus },
                { to: '/admin/nghi-phep', label: 'Duyệt nghỉ phép bác sĩ', icon: CalendarCheck },
                { to: '/staff/patients', label: 'Hồ sơ bệnh nhân', icon: Users },
            ],
        },
        {
            group: 'Tuân thủ và cấu hình',
            items: [
                { to: '/staff/compliance', label: 'Tuân thủ pháp lý và kiểm toán', icon: LockKey },
                { to: '/staff/compliance?tab=DINH_CHINH', label: 'Duyệt đính chính EMR', icon: ShieldCheck },
                { to: '/staff/settings', label: 'Cấu hình phòng khám', icon: Buildings },
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
    const homePath = getRoleDefaultPath(realRole || activeRole)

    const menuSections = useMemo(() => getStaffMenuForRole(effectiveRole), [effectiveRole])

    const isPathActive = (to) => {
        if (!to) return false
        const cleanTo = to.split('?')[0]
        if (cleanTo === '/staff/dashboard') {
            return location.pathname === '/staff' || location.pathname === '/staff/' || location.pathname === '/staff/dashboard'
        }
        return location.pathname === cleanTo || location.pathname.startsWith(`${cleanTo}/`)
    }

    return (
        <aside
            className={`h-screen sticky top-0 bg-clinic-navy text-clinic-surface flex flex-col shrink-0 select-none border-r border-clinic-navy-dark transition-all duration-200 z-40 overflow-hidden ${
                isCollapsed ? 'w-[64px]' : 'w-[244px]'
            }`}
        >
            <div className="h-14 px-3 flex items-center justify-between border-b border-clinic-on-navy-subtle/20 bg-clinic-navy-dark shrink-0">
                <Link to={homePath} className="flex items-center gap-2.5 overflow-hidden">
                    <span className="w-8 h-8 rounded-[6px] bg-clinic-cta text-clinic-surface flex items-center justify-center shrink-0">
                        <Hospital size={18} weight="fill" />
                    </span>
                    {!isCollapsed && (
                        <div className="leading-tight truncate">
                            <div className="font-display font-extrabold text-sm tracking-wide text-clinic-surface">
                                CLINIC<span className="text-clinic-cyan">-AI</span> HIS
                            </div>
                            <div className="text-[10px] text-clinic-on-navy-muted font-medium truncate">
                                {roleConfig.label} · Cổng Nghiệp Vụ
                            </div>
                        </div>
                    )}
                </Link>
            </div>

            <nav className="flex-1 overflow-y-auto py-2.5 px-2 space-y-3 text-[12px] no-scrollbar">
                {menuSections.map((section, sIdx) => (
                    <div key={sIdx} className="space-y-1">
                        {!isCollapsed && section.group && (
                            <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-clinic-on-navy-subtle truncate">
                                {section.group}
                            </div>
                        )}
                        {isCollapsed && section.group && (
                            <div className="border-t border-clinic-on-navy-subtle/20 my-1 mx-2" />
                        )}
                        {section.items.map((item, iIdx) => {
                            const IconComponent = item.icon || HouseLine
                            const active = isPathActive(item.to)

                            return (
                                <Link
                                    key={iIdx}
                                    to={item.to}
                                    title={isCollapsed ? item.label : undefined}
                                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[6px] font-medium transition-colors duration-75 group ${
                                        active
                                            ? 'bg-clinic-cta text-clinic-surface font-bold'
                                            : 'text-clinic-on-navy-muted hover:bg-clinic-navy-dark hover:text-clinic-surface'
                                    }`}
                                >
                                    <IconComponent
                                        size={17}
                                        weight={active ? 'fill' : 'duotone'}
                                        className={`shrink-0 ${active ? 'text-clinic-surface' : 'text-clinic-cyan'}`}
                                    />

                                    {!isCollapsed && (
                                        <div className="flex-1 flex items-center justify-between min-w-0">
                                            <span className="truncate">{item.label}</span>
                                            {item.badge && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] shrink-0 bg-clinic-navy-dark text-clinic-surface border border-clinic-on-navy-subtle/30">
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

            <div className="p-2.5 border-t border-clinic-on-navy-subtle/20 bg-clinic-navy-dark text-[11px] text-clinic-on-navy-muted space-y-1.5 shrink-0">
                <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-[6px] bg-clinic-navy hover:bg-clinic-cta text-clinic-surface font-semibold text-center transition cursor-pointer"
                    title={isCollapsed ? 'Mở rộng thanh menu' : 'Thu gọn thanh menu'}
                >
                    {isCollapsed ? (
                        <CaretRight size={15} weight="bold" className="text-clinic-cyan" />
                    ) : (
                        <>
                            <CaretLeft size={14} weight="bold" className="text-clinic-cyan" />
                            <span>Thu gọn menu</span>
                        </>
                    )}
                </button>

                {!isCollapsed && (
                    <div className="flex items-center justify-between pt-1 text-[10px]">
                        <span>Vai trò:</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-clinic-navy text-clinic-surface font-bold truncate max-w-[140px]">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${roleConfig.dotColor}`} />
                            <span className="truncate">{roleConfig.label}</span>
                        </span>
                    </div>
                )}
            </div>
        </aside>
    )
}
