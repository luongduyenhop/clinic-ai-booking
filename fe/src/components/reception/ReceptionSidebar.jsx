import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
    Hospital,
    CaretLeft,
    CaretRight,
    GlobeHemisphereWest,
    HouseLine,
    ClipboardText,
    UserList,
    CalendarCheck,
    Users,
    Stethoscope,
    WarningCircle,
    ChartBar,
    Receipt,
} from '../common/ClinicIcon'

export default function ReceptionSidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false)
    const { queueEntries = [], tasks = [] } = useSelector((state) => state.reception || {})

    const waitingCount = queueEntries.filter((q) => q.status === 'WAITING' || q.status === 'cho_kham').length
    const pendingTasksCount = tasks.filter((t) => t.status === 'PENDING').length

    const sections = [
        {
            id: 'reception_core',
            title: 'Tiếp đón & Thu ngân',
            items: [
                {
                    to: '/reception/dashboard',
                    label: 'Tổng quan',
                    icon: HouseLine,
                },
                {
                    to: '/reception/check-in',
                    label: 'Tiếp nhận bệnh nhân',
                    icon: ClipboardText,
                },
                {
                    to: '/reception/queue',
                    label: 'Điều phối hàng đợi',
                    icon: UserList,
                },
                {
                    to: '/reception/cashier',
                    label: 'Thu viện phí & VietQR',
                    icon: Receipt,
                },
                {
                    to: '/reception/appointments',
                    label: 'Quản lý lịch hẹn',
                    icon: CalendarCheck,
                },
            ],
        },
        {
            id: 'reception_operations',
            title: 'Hồ sơ & Vận hành',
            items: [
                {
                    to: '/reception/patients',
                    label: 'Hồ sơ bệnh nhân',
                    icon: Users,
                },
                {
                    to: '/reception/schedule',
                    label: 'Lịch trực & Nguồn lực',
                    icon: Stethoscope,
                },
            ],
        },
        {
            id: 'reception_audit',
            title: 'Giám sát & Báo cáo',
            items: [
                {
                    to: '/reception/tasks',
                    label: 'Sự cố cần xử lý',
                    icon: WarningCircle,
                    badge: pendingTasksCount > 0 ? `${pendingTasksCount} vụ` : null,
                    badgeColor: 'bg-clinic-danger-solid text-clinic-surface',
                },
                {
                    to: '/reception/reports',
                    label: 'Lịch sử & Báo cáo',
                    icon: ChartBar,
                },
            ],
        },
    ]

    return (
        <aside
            className={`h-screen sticky top-0 bg-clinic-navy text-clinic-surface flex flex-col shrink-0 select-none border-r border-clinic-navy-dark transition-all duration-200 z-40 overflow-hidden ${
                isCollapsed ? 'w-[64px]' : 'w-[244px]'
            }`}
        >
            <div className="h-14 px-3 flex items-center justify-between border-b border-clinic-on-navy-subtle/20 bg-clinic-navy-dark">
                <Link to="/reception/dashboard" className="flex items-center gap-2.5 group overflow-hidden">
                    <span className="w-8 h-8 rounded-[6px] bg-clinic-cta text-clinic-surface flex items-center justify-center shrink-0">
                        <Hospital size={18} weight="fill" />
                    </span>
                    {!isCollapsed && (
                        <div className="leading-tight truncate">
                            <div className="font-display font-extrabold text-sm tracking-wide text-clinic-surface">
                                CLINIC<span className="text-clinic-cyan">-AI</span> HIS
                            </div>
                            <div className="text-[10px] text-clinic-on-navy-muted font-medium truncate">
                                Lễ Tân · Tiếp Đón &amp; Thu Ngân
                            </div>
                        </div>
                    )}
                </Link>
            </div>

            <nav className="flex-1 overflow-y-auto py-2.5 px-2 space-y-3 text-[12px] no-scrollbar">
                {sections.map((section) => (
                    <div key={section.id} className="space-y-1">
                        {!isCollapsed && section.title && (
                            <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-clinic-on-navy-subtle truncate">
                                {section.title}
                            </div>
                        )}
                        {isCollapsed && section.title && (
                            <div className="border-t border-clinic-on-navy-subtle/20 my-1 mx-2" />
                        )}

                        {section.items.map((item) => {
                            const IconComponent = item.icon
                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    title={isCollapsed ? item.label : undefined}
                                    className={({ isActive }) =>
                                        `flex items-center gap-2.5 px-2.5 py-2 rounded-[6px] font-medium transition-colors duration-75 group ${
                                            isActive
                                                ? 'bg-clinic-cta text-clinic-surface font-bold'
                                                : 'text-clinic-on-navy-muted hover:bg-clinic-navy-dark hover:text-clinic-surface'
                                        }`
                                    }
                                >
                                    {({ isActive }) => (
                                        <>
                                            <IconComponent
                                                size={17}
                                                weight={isActive ? 'fill' : 'duotone'}
                                                className={`shrink-0 ${isActive ? 'text-clinic-surface' : 'text-clinic-cyan'}`}
                                            />
                                            {!isCollapsed && (
                                                <div className="flex-1 flex items-center justify-between min-w-0">
                                                    <span className="truncate">{item.label}</span>
                                                    {item.badge && (
                                                        <span
                                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] shrink-0 tabular-nums ${
                                                                item.badgeColor || 'bg-clinic-cta text-clinic-surface'
                                                            }`}
                                                        >
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </NavLink>
                            )
                        })}
                    </div>
                ))}
            </nav>

            <div className="p-2.5 border-t border-clinic-on-navy-subtle/20 bg-clinic-navy-dark text-[11px] text-clinic-on-navy-muted space-y-1.5">
                <button
                    type="button"
                    onClick={() => setIsCollapsed(!isCollapsed)}
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
                    <>
                        <div className="flex items-center justify-between pt-1 text-[10px]">
                            <span>Cổng ĐTQG (TT 26):</span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-clinic-navy text-clinic-surface font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-clinic-success" />
                                Trực tuyến
                            </span>
                        </div>
                        <Link
                            to="/"
                            className="flex items-center justify-center gap-1.5 w-full py-1 text-[10.5px] rounded-[6px] text-clinic-on-navy-muted hover:text-clinic-surface hover:bg-clinic-navy transition"
                        >
                            <GlobeHemisphereWest size={13} weight="duotone" className="text-clinic-cyan" />
                            <span>Cổng Đặt Lịch Bệnh Nhân</span>
                        </Link>
                    </>
                )}
            </div>
        </aside>
    )
}
