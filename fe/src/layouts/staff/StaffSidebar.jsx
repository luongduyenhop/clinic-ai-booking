import { useState, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
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
    Package,
    Clock,
    CaretLeft,
    CaretRight,
    CaretDown,
    Eye,
    ArrowsClockwise,
} from '../../components/common/ClinicIcon'

// ── CẤU HÌNH VAI TRÒ CHUẨN ──────────────────────────────────────────────────
export const ROLE_CONFIGS = {
    ADMIN: {
        label: 'Quản trị viên',
        badge: 'Quản trị HIS',
        color: 'bg-rose-50 text-rose-700 border-rose-200',
        dotColor: 'bg-rose-500',
    },
    BAC_SI: {
        label: 'Bác sĩ',
        badge: 'Lâm sàng TT32',
        color: 'bg-sky-50 text-sky-700 border-sky-200',
        dotColor: 'bg-sky-500',
    },
    LE_TAN: {
        label: 'Lễ tân',
        badge: 'Tiếp đón & Hàng chờ',
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        dotColor: 'bg-amber-500',
    },
    THU_NGAN: {
        label: 'Thu ngân',
        badge: 'Viện phí & VietQR',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotColor: 'bg-emerald-500',
    },
    KTV_CLS: {
        label: 'Kỹ thuật viên CLS',
        badge: 'Xét nghiệm & CĐHA',
        color: 'bg-purple-50 text-purple-700 border-purple-200',
        dotColor: 'bg-purple-500',
    },
    KTV_XET_NGHIEM: {
        label: 'KTV Xét nghiệm',
        badge: 'Huyết học - Sinh hóa (LIS)',
        color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        dotColor: 'bg-indigo-500',
    },
    BENH_NHAN: {
        label: 'Bệnh nhân',
        badge: 'Cổng Bệnh nhân',
        color: 'bg-teal-50 text-teal-700 border-teal-200',
        dotColor: 'bg-teal-500',
    },
}

// ── CẤU HÌNH MENU THEO TỪNG VAI TRÒ ──────────────────────────────────────────
export const getStaffMenuForRole = (role) => {
    const normalizedRole = String(role || '').toUpperCase()

    // 1. Vai trò: BÁC SĨ
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

    // 2. Vai trò: LỄ TÂN
    if (normalizedRole === 'LE_TAN' || normalizedRole === 'RECEPTIONIST' || normalizedRole === 'RECEPTION_SUPERVISOR') {
        return [
            {
                group: 'Tiếp đón & Hàng chờ',
                items: [
                    { to: '/staff/reception-dashboard', label: 'Tổng quan tiếp đón', icon: HouseLine },
                    { to: '/staff/check-in', label: 'Tiếp đón & Check-in', icon: IdentificationCard, badge: 'Cốt lõi' },
                    { to: '/staff/queue', label: 'Điều phối hàng chờ', icon: Clock },
                    { to: '/staff/appointments', label: 'Quản lý lịch hẹn', icon: CalendarCheck },
                ],
            },
            {
                group: 'Dữ liệu & Lịch trực',
                items: [
                    { to: '/staff/patients', label: 'Hồ sơ bệnh nhân', icon: Users },
                    { to: '/staff/schedule', label: 'Lịch trực phòng khám', icon: CalendarPlus },
                    { to: '/staff/reports', label: 'Báo cáo ca trực', icon: ChartBar },
                ],
            },
        ]
    }

    // 3. Vai trò: THU NGÂN
    if (normalizedRole === 'THU_NGAN' || normalizedRole === 'CASHIER') {
        return [
            {
                group: 'Thu ngân & Viện phí',
                items: [
                    { to: '/staff/cashier', label: 'Thu viện phí & Quyết toán', icon: Receipt, badge: 'VietQR' },
                    { to: '/staff/queue', label: 'Hàng chờ thanh toán', icon: Clock },
                ],
            },
            {
                group: 'Báo cáo tài chính',
                items: [
                    { to: '/staff/reports', label: 'Báo cáo doanh thu & Đóng ca', icon: ChartBar },
                    { to: '/staff/appointments', label: 'Tra cứu lịch hẹn', icon: CalendarCheck },
                ],
            },
        ]
    }

    // 4A. Vai trò: KỸ THUẬT VIÊN XÉT NGHIỆM (LIS CHUYÊN SÂU)
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

    // 4. Vai trò: KỸ THUẬT VIÊN CẬN LÂM SÀNG
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

    // 5. Vai trò: BỆNH NHÂN (Chế độ xem trước hoặc lối tắt)
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

    // 6. Mặc định / ADMIN (Quản trị viên toàn quyền)
    return [
        {
            group: 'Tổng quan & Báo cáo',
            items: [
                { to: '/staff/dashboard', label: 'Tổng quan HIS', icon: HouseLine },
                { to: '/staff/reports', label: 'Báo cáo & Thống kê', icon: ChartBar },
            ],
        },
        {
            group: 'Tiếp đón & Bệnh nhân',
            items: [
                { to: '/staff/reception', label: 'Đăng ký tiếp đón', icon: IdentificationCard },
                { to: '/staff/check-in', label: 'Check-in tiếp đón', icon: IdentificationCard },
                { to: '/staff/queue', label: 'Hàng chờ điều phối', icon: Clock },
                { to: '/staff/appointments', label: 'Quản lý lịch hẹn', icon: CalendarCheck },
                { to: '/staff/patients', label: 'Hồ sơ bệnh nhân', icon: Users },
            ],
        },
        {
            group: 'Khám bệnh & Cận lâm sàng',
            items: [
                { to: '/staff/exam-workstation', label: 'Bàn khám lâm sàng TT32', icon: Stethoscope },
                { to: '/staff/specialty-exam', label: 'Khám chuyên khoa', icon: FirstAidKit },
                { to: '/staff/paraclinical-work', label: 'Thực hiện cận lâm sàng', icon: Microscope },
                { to: '/staff/paraclinical', label: 'Chỉ định CLS & PT-TT', icon: ClipboardText },
            ],
        },
        {
            group: 'Tài chính & Dịch vụ',
            items: [
                { to: '/staff/cashier', label: 'Thu chi & Viện phí (VietQR)', icon: Receipt },
                { to: '/staff/service-packages', label: 'Gói dịch vụ & Liệu trình', icon: Package },
            ],
        },
        {
            group: 'Quản trị hệ thống',
            items: [
                { to: '/staff/catalogs', label: 'Quản lý danh mục y tế', icon: Folders },
                { to: '/staff/permissions', label: 'Phân quyền & Nhân sự', icon: ShieldCheck },
                { to: '/staff/templates', label: 'Quản lý mẫu in', icon: ClipboardText },
                { to: '/staff/compliance', label: 'Tuân thủ pháp lý & EMR', icon: LockKey },
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
    // Dropdown removed

    // Xác định vai trò hiển thị menu
    const effectiveRole = activeRole || realRole || 'ADMIN'
    const roleConfig = ROLE_CONFIGS[effectiveRole] || ROLE_CONFIGS.ADMIN

    // Menu động theo vai trò
    const menuSections = useMemo(() => getStaffMenuForRole(effectiveRole), [effectiveRole])

    // Kiểm tra active link
    const isPathActive = (to) => {
        if (!to) return false
        if (to === '/staff/dashboard') {
            return location.pathname === '/staff' || location.pathname === '/staff/' || location.pathname === '/staff/dashboard'
        }
        return location.pathname.startsWith(to)
    }

    // Mode 100% strictly bound to authenticated role

    return (
        <aside
            className={`h-screen sticky top-0 flex flex-col shrink-0 bg-white border-r border-slate-200/80 shadow-xs z-30 transition-all duration-300 ease-in-out ${
                isCollapsed ? 'w-20' : 'w-72'
            }`}
        >
            {/* ── HEADER SIDEBAR: LOGO & TÊN CỔNG ─────────────────────────────── */}
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

            {/* ── NÚT MỞ RỘNG KHI COLLAPSED ───────────────────────────────────── */}
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

            {/* ── DANH SÁCH MENU ĐIỀU HƯỚNG ──────────────────────────────────── */}
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

            {/* ── FOOTER SIDEBAR: THÔNG TIN VAI TRÒ & PHIÊN BẢN ────────────────── */}
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
