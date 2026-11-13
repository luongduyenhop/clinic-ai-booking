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
                    label: 'Tổng quan (Dashboard)',
                    icon: HouseLine,
                },
                {
                    to: '/reception/check-in',
                    label: 'Tiếp nhận bệnh nhân',
                    icon: ClipboardText,
                },
                {
                    to: '/reception/queue',
                    label: 'Quản lý hàng đợi',
                    icon: UserList,
                },
                {
                    to: '/reception/cashier',
                    label: 'Thu viện phí & VietQR',
                    icon: Receipt,
                    badge: 'VietQR',
                    badgeColor: 'bg-emerald-400 text-[#003553]',
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
                    badgeColor: 'bg-rose-500 text-white',
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
            className={`h-screen sticky top-0 bg-[#003553] text-white flex flex-col shrink-0 shadow-md select-none border-r border-white/10 transition-[width] duration-200 z-40 overflow-hidden ${
                isCollapsed ? 'w-[64px]' : 'w-[252px]'
            }`}
        >
            <div className="h-14 px-3 flex items-center justify-between border-b border-white/10 bg-[#002840]">
                <Link to="/reception/dashboard" className="flex items-center gap-2.5 overflow-hidden">
                    <span className="w-8 h-8 rounded-xl bg-[#0A5878] text-white flex items-center justify-center shrink-0">
                        <Hospital size={18} weight="fill" />
                    </span>
                    {!isCollapsed && (
                        <div className="leading-tight truncate">
                            <div className="font-display font-extrabold text-sm tracking-wide text-white">
                                CLINIC<span className="text-[#00B5F1]">-AI</span> HIS
                            </div>
                            <div className="text-[10px] text-sky-200/80 font-medium truncate">
                                Lễ Tân · Tiếp Đón & Thu Ngân
                            </div>
                        </div>
                    )}
                </Link>
            </div>

            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 text-[12px] no-scrollbar">
                {sections.map((section) => (
                    <div key={section.id} className="space-y-1">
                        {!isCollapsed && section.title && (
                            <div className="px-2.5 pt-1.5 pb-1 text-[9.5px] font-extrabold tracking-wider uppercase text-sky-300/60 flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-sky-300/70" />
                                <span className="truncate">{section.title}</span>
                            </div>
                        )}
                        {isCollapsed && section.title && (
                            <div className="border-t border-white/10 my-1 mx-2" />
                        )}

                        {section.items.map((item) => {
                            const IconComponent = item.icon
                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    title={isCollapsed ? item.label : undefined}
                                    className={({ isActive }) =>
                                        `flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg font-medium transition-colors group ${
                                            isActive
                                                ? 'bg-[#0A5878] text-white font-bold'
                                                : 'text-sky-100/85 hover:bg-white/10 hover:text-white'
                                        }`
                                    }
                                >
                                    {({ isActive }) => (
                                        <>
                                            <IconComponent
                                                size={17}
                                                weight={isActive ? 'fill' : 'duotone'}
                                                className={`shrink-0 ${isActive ? 'text-white' : 'text-sky-200/80'}`}
                                            />
                                            {!isCollapsed && (
                                                <div className="flex-1 flex items-center justify-between min-w-0">
                                                    <span className="truncate">{item.label}</span>
                                                    {item.badge && (
                                                        <span
                                                            className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full shrink-0 shadow-2xs ${
                                                                item.badgeColor || 'bg-sky-500 text-white'
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

            <div className="p-2.5 border-t border-white/10 bg-[#002840] text-[11px] text-sky-200/80 space-y-1.5">
                <button
                    type="button"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold text-center transition cursor-pointer"
                    title={isCollapsed ? 'Mở rộng thanh menu' : 'Thu gọn thanh menu'}
                >
                    {isCollapsed ? (
                        <CaretRight size={15} weight="bold" className="text-[#00B5F1]" />
                    ) : (
                        <>
                            <CaretLeft size={14} weight="bold" className="text-[#00B5F1]" />
                            <span>Thu gọn menu</span>
                        </>
                    )}
                </button>

                {!isCollapsed && (
                    <>
                        <div className="flex items-center justify-between pt-1 text-[10px]">
                            <span>Cổng ĐTQG (TT 26):</span>
                            <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-slate-200 font-semibold">
                                Chưa xác minh
                            </span>
                        </div>
                        <Link
                            to="/"
                            className="flex items-center justify-center gap-1.5 w-full py-1 text-[10.5px] rounded-lg text-sky-200/80 hover:text-white hover:bg-white/5 transition"
                        >
                            <GlobeHemisphereWest size={13} weight="duotone" className="text-[#00B5F1]" />
                            <span>Cổng Đặt Lịch Bệnh Nhân</span>
                        </Link>
                    </>
                )}
            </div>
        </aside>
    )
}
