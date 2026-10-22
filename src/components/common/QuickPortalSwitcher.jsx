import { Link, useLocation } from 'react-router-dom'

const PORTALS = [
    {
        to: '/',
        label: 'Bệnh Nhân',
        icon: '🏠',
        match: (pathname) => pathname === '/' || pathname === '/login',
        title: 'Chuyển sang Cổng Bệnh Nhân (Trang chủ)',
    },
    {
        to: '/reception/dashboard',
        label: 'Lễ Tân',
        icon: '👩‍💼',
        match: (pathname) => pathname.startsWith('/reception'),
        title: 'Chuyển sang Cổng Tiếp Đón & Lễ Tân',
    },
    {
        to: '/doctor',
        label: 'Bác Sĩ',
        icon: '👨‍⚕️',
        match: (pathname) => pathname.startsWith('/doctor'),
        title: 'Chuyển sang Cổng Bác Sĩ Lâm Sàng & Bàn Khám',
    },
    {
        to: '/staff/dashboard',
        label: 'Cổng Staff',
        icon: '🏥',
        match: (pathname) => pathname.startsWith('/staff'),
        title: 'Chuyển sang Cổng Nhân Viên Hợp Nhất (Staff Portal)',
    },
    {
        to: '/admin',
        label: 'Quản Trị',
        icon: '🏛️',
        match: (pathname) => pathname.startsWith('/admin'),
        title: 'Chuyển sang Cổng Quản Trị & HIS Phòng Khám',
    },
]

export default function QuickPortalSwitcher({ className = '', size = 'sm' }) {
    const location = useLocation()

    const sizeClasses = {
        xs: 'px-2 py-1 text-[11px] gap-1',
        sm: 'px-2.5 py-1.5 text-xs gap-1.5',
        md: 'px-3 py-2 text-sm gap-2',
    }[size] || 'px-2.5 py-1.5 text-xs gap-1.5'

    return (
        <nav
            aria-label="Chuyển đổi cổng vai trò"
            className={`inline-flex items-center gap-1 p-1 rounded-2xl bg-slate-100/90 border border-slate-200/80 shadow-2xs ${className}`}
        >
            {PORTALS.map((portal) => {
                const isActive = portal.match(location.pathname)
                return (
                    <Link
                        key={portal.to}
                        to={portal.to}
                        title={portal.title}
                        className={`inline-flex items-center rounded-xl font-bold transition-all duration-150 cursor-pointer ${sizeClasses} ${
                            isActive
                                ? 'bg-[#00B5F1] text-[#003553] shadow-xs'
                                : 'text-slate-600 hover:text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <span className="text-sm leading-none">{portal.icon}</span>
                        {size !== 'xs' && <span className="hidden xl:inline">{portal.label}</span>}
                    </Link>
                )
            })}
        </nav>
    )
}
