import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
    DashboardOutlined,
    CalendarOutlined,
    UserAddOutlined,
    OrderedListOutlined,
    TeamOutlined,
    ScheduleOutlined,
    AuditOutlined,
    AlertOutlined,
    BarChartOutlined,
    LeftOutlined,
    RightOutlined,
    HomeOutlined,
} from '@ant-design/icons'

export default function ReceptionSidebar() {
    const [collapsed, setCollapsed] = useState(false)
    const { queueEntries, tasks } = useSelector((state) => state.reception)

    const waitingCount = queueEntries.filter((q) => q.status === 'WAITING').length
    const pendingTasksCount = tasks.filter((t) => t.status === 'PENDING').length

    const navItems = [
        {
            to: '/reception/dashboard',
            label: 'Tổng quan (Dashboard)',
            icon: <DashboardOutlined className="text-base" />,
        },
        {
            to: '/reception/check-in',
            label: 'Tiếp nhận bệnh nhân',
            icon: <UserAddOutlined className="text-base" />,
            badge: null,
        },
        {
            to: '/reception/queue',
            label: 'Quản lý hàng đợi',
            icon: <OrderedListOutlined className="text-base" />,
            badge: waitingCount > 0 ? `${waitingCount} chờ` : null,
            badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
        },
        {
            to: '/reception/appointments',
            label: 'Quản lý lịch hẹn',
            icon: <CalendarOutlined className="text-base" />,
        },
        {
            to: '/reception/patients',
            label: 'Hồ sơ bệnh nhân',
            icon: <TeamOutlined className="text-base" />,
        },
        {
            to: '/reception/schedule',
            label: 'Lịch trực & Nguồn lực',
            icon: <ScheduleOutlined className="text-base" />,
        },
        {
            to: '/reception/administration',
            label: 'Thủ tục & Thanh toán',
            icon: <AuditOutlined className="text-base" />,
        },
        {
            to: '/reception/tasks',
            label: 'Sự cố cần xử lý',
            icon: <AlertOutlined className="text-base" />,
            badge: pendingTasksCount > 0 ? `${pendingTasksCount} vụ` : null,
            badgeColor: 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse',
        },
        {
            to: '/reception/reports',
            label: 'Lịch sử & Báo cáo',
            icon: <BarChartOutlined className="text-base" />,
        },
    ]

    return (
        <aside
            className={`transition-all duration-300 ease-in-out bg-[#002B42] text-slate-200 flex flex-col shrink-0 border-r border-[#003E5E]/40 select-none z-20 ${
                collapsed ? 'w-20' : 'w-64'
            }`}
        >
            {/* Header Clinic Logo */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-[#003E5E]/40">
                <Link to="/reception/dashboard" className="flex items-center gap-3 overflow-hidden">
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00B5F1] to-[#0088BA] text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                        ✚
                    </span>
                    {!collapsed && (
                        <div className="truncate">
                            <span className="font-bold text-white text-base block leading-tight tracking-tight">Lễ Tân Y Tế</span>
                            <span className="text-[11px] text-[#00B5F1] font-semibold">Clinic Reception Portal</span>
                        </div>
                    )}
                </Link>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer text-xs"
                    title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
                >
                    {collapsed ? <RightOutlined /> : <LeftOutlined />}
                </button>
            </div>

            {/* Navigation items */}
            <nav className="p-3 space-y-1 flex-1 overflow-y-auto no-scrollbar text-sm font-medium">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-xl transition duration-150 group relative ${
                                isActive
                                    ? 'bg-[#00B5F1] text-white font-bold shadow-md'
                                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                            } ${collapsed ? 'justify-center' : ''}`
                        }
                        title={collapsed ? item.label : undefined}
                    >
                        <span className="shrink-0">{item.icon}</span>
                        {!collapsed && (
                            <div className="flex-1 flex items-center justify-between truncate">
                                <span className="truncate">{item.label}</span>
                                {item.badge && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1.5 shrink-0 ${item.badgeColor}`}>
                                        {item.badge}
                                    </span>
                                )}
                            </div>
                        )}
                        {/* Dot indicator when collapsed and has badge */}
                        {collapsed && item.badge && (
                            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-400" />
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Bottom links */}
            <div className="p-3 border-t border-[#003E5E]/40 space-y-2">
                <Link
                    to="/"
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition text-xs font-semibold ${
                        collapsed ? 'justify-center' : ''
                    }`}
                    title="Về Trang Chủ"
                >
                    <HomeOutlined />
                    {!collapsed && <span>Về Trang Chủ Khám</span>}
                </Link>
            </div>
        </aside>
    )
}
