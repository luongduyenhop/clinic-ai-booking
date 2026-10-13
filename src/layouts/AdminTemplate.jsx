import { useEffect, useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import AdminHeader from '../components/admin/AdminHeader'
import { loadClinicDataAsync } from '../redux/actions/admin/adminAction'
import { getNavigationConfig } from '../services/admin/clinicSeedData'
import {
    ClinicIcon,
    CaretDown,
    CaretLeft,
    CaretRight,
    Hospital,
    GlobeHemisphereWest,
    HouseLine,
} from '../components/common/ClinicIcon'

export default function AdminTemplate() {
    const location = useLocation()
    const dispatch = useDispatch()
    const { clinicData } = useSelector((state) => state.app.admin)
    const { sidebarSections = [], sidebarMenus = [] } = getNavigationConfig(clinicData)

    const [isCollapsed, setIsCollapsed] = useState(false)
    const [openGroups, setOpenGroups] = useState({
        patients: true,
        catalogs: true,
        templates: false,
        users: false,
    })

    useEffect(() => {
        dispatch(loadClinicDataAsync())
    }, [dispatch])

    const toggleGroup = (id) => {
        setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
    }

    const isPathActive = (path) => {
        if (!path) return false
        if (path === '/admin') return location.pathname === '/admin'

        const [itemBase, itemQuery] = path.split('?')
        const currentParams = new URLSearchParams(location.search)

        // Nếu menu có query string (ví dụ ?tab=GOI_DICH_VU, ?tab=KHOA_SO)
        if (itemQuery) {
            const itemParams = new URLSearchParams(itemQuery)
            const itemTab = itemParams.get('tab')
            const currentTab = currentParams.get('tab')
            if (itemTab) {
                return location.pathname === itemBase && currentTab === itemTab
            }
            return (
                location.pathname === itemBase &&
                (location.pathname + location.search) === path
            )
        }

        // Nếu menu KHÔNG có query string (ví dụ /admin/lich-hen)
        // Khi trang hiện tại đang mở 1 sub-tab cụ thể (?tab=...), menu gốc không được active
        const currentTab = currentParams.get('tab')
        if (currentTab && location.pathname === itemBase) {
            return false
        }

        return location.pathname === itemBase || (itemBase !== '/admin' && location.pathname.startsWith(`${itemBase}/`))
    }

    const isGroupActive = (group) => {
        if (group.path) return isPathActive(group.path)
        return (group.children || []).some((child) => isPathActive(child.path))
    }

    // Friendly breadcrumb resolution
    const getBreadcrumbTitle = () => {
        const p = location.pathname
        if (p === '/admin') return 'Trung tâm Điều hành & Bàn làm việc'
        if (p.includes('/dang-ky-kham')) return 'Tiếp đón & Đăng ký Khám bệnh'
        if (p.includes('/benh-nhan')) return 'Quản lý Hồ sơ Bệnh nhân'
        if (p.includes('/kham-chuyen-khoa')) return 'Khám bệnh chuyên khoa sâu (Nội, Ngoại, Mắt, TMH, RHM)'
        if (p.includes('/kham-benh') || p.includes('/khambenh')) return 'Khám bệnh ngoại trú & Kê đơn thuốc'
        if (p.includes('/can-lam-sang')) return 'Chỉ định & Trả kết quả Cận lâm sàng (CLS)'
        if (p.includes('/pt-tt')) return 'Phẫu thuật & Thủ thuật (PT-TT)'
        if (p.includes('/lich-hen')) return 'Quản lý Lịch hẹn & Gói dịch vụ'
        if (p.includes('/thu-chi')) return 'Quản lý Thu chi Viện phí & Khóa sổ ca trực'
        if (p.includes('/danh-muc')) return 'Quản lý Danh mục Y tế'
        if (p.includes('/tuan-thu')) return 'Tuân thủ Pháp lý & Liên thông Cổng Quốc gia'
        if (p.includes('/bao-cao')) return 'Báo cáo Doanh thu & Thống kê Y tế'
        if (p.includes('/goi-dich-vu') || p.includes('/goidichvu')) return 'Quản lý Gói dịch vụ khám sức khỏe'
        if (p.includes('/lieu-trinh') || p.includes('/lieutrinh')) return 'Liệu trình điều trị & Bài tập phục hồi chức năng'
        if (p.includes('/cai-dat') || p.includes('/setting')) return 'Cài đặt hệ thống phòng khám & Cổng liên thông BYT'
        if (p.includes('/tai-ung-dung')) return 'Tải ứng dụng di động Clinic-AI Mobile'
        return 'Quản lý Phòng khám'
    }

    return (
        <div className="h-screen flex bg-[#F4F8FB] text-[#0F172A] overflow-hidden">
            {/* Left Sidebar — Deep Medical Navy (#003553) with Smooth Collapse */}
            <aside
                className={`h-screen sticky top-0 bg-[#003553] text-white flex flex-col shrink-0 shadow-xl select-none border-r border-white/10 transition-all duration-200 z-40 overflow-hidden ${
                    isCollapsed ? 'w-[64px]' : 'w-[244px]'
                }`}
            >
                {/* Brand Logo */}
                <div className="h-14 px-3 flex items-center justify-between border-b border-white/10 bg-[#002840]">
                    <Link to="/admin" className="flex items-center gap-2.5 group overflow-hidden">
                        <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00B5F1] to-[#0088BA] text-white flex items-center justify-center shadow-md ring-2 ring-white/15 shrink-0 group-hover:scale-105 transition-transform">
                            <Hospital size={18} weight="fill" />
                        </span>
                        {!isCollapsed && (
                            <div className="leading-tight truncate">
                                <div className="font-display font-extrabold text-sm tracking-wide text-white">
                                    CLINIC<span className="text-[#00B5F1]">-AI</span> HIS
                                </div>
                                <div className="text-[10px] text-sky-200/80 font-medium truncate">
                                    PK Đa Khoa Medpro
                                </div>
                            </div>
                        )}
                    </Link>
                </div>

                {/* Navigation Sections from Seed */}
                <nav className="flex-1 overflow-y-auto py-2.5 px-2 space-y-3 text-[12px] no-scrollbar">
                    {(sidebarSections.length > 0 ? sidebarSections : [{ id: 'default', menus: sidebarMenus }]).map((section) => (
                        <div key={section.id} className="space-y-1">
                            {/* Section Header */}
                            {!isCollapsed && section.title && (
                                <div className="px-2.5 pt-1.5 pb-1 text-[9.5px] font-extrabold tracking-wider uppercase text-sky-300/60 flex items-center gap-1.5">
                                    <span className="w-1 h-1 rounded-full bg-[#00B5F1]" />
                                    <span className="truncate">{section.title}</span>
                                </div>
                            )}
                            {isCollapsed && section.title && (
                                <div className="border-t border-white/10 my-1 mx-2" />
                            )}

                            {/* Section Menu Items */}
                            {section.menus.map((item) => {
                                const active = isGroupActive(item)
                                if (!item.children) {
                                    return (
                                        <Link
                                            key={item.id}
                                            to={item.path}
                                            title={isCollapsed ? item.title : undefined}
                                            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl font-medium transition-all group ${
                                                active
                                                    ? 'bg-[#00B5F1] text-white font-bold shadow-xs'
                                                    : 'text-sky-100/85 hover:bg-white/10 hover:text-white'
                                            }`}
                                        >
                                            <ClinicIcon
                                                name={item.icon}
                                                size={17}
                                                weight={active ? 'fill' : 'duotone'}
                                                className={`shrink-0 ${active ? 'text-white' : 'text-[#00B5F1]'}`}
                                            />
                                            {!isCollapsed && (
                                                <div className="flex-1 flex items-center justify-between min-w-0">
                                                    <span className="truncate">{item.title}</span>
                                                    {item.badge && (
                                                        <span
                                                            className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full text-white shrink-0 ${
                                                                item.badgeColor || 'bg-sky-500'
                                                            }`}
                                                        >
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </Link>
                                    )
                                }

                                const isOpen = openGroups[item.id] !== undefined ? Boolean(openGroups[item.id]) : active
                                return (
                                    <div key={item.id} className="space-y-0.5">
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(item.id)}
                                            title={isCollapsed ? item.title : undefined}
                                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl font-semibold transition cursor-pointer ${
                                                active
                                                    ? 'bg-white/12 text-[#00B5F1]'
                                                    : 'text-sky-100/85 hover:bg-white/8 hover:text-white'
                                            }`}
                                        >
                                            <span className="flex items-center gap-2.5 truncate">
                                                <ClinicIcon
                                                    name={item.icon}
                                                    size={17}
                                                    weight={active ? 'fill' : 'duotone'}
                                                    className="text-[#00B5F1] shrink-0"
                                                />
                                                {!isCollapsed && <span className="truncate">{item.title}</span>}
                                            </span>
                                            {!isCollapsed && (
                                                <CaretDown
                                                    size={12}
                                                    weight="bold"
                                                    className={`text-sky-200/70 transition-transform duration-200 shrink-0 ${
                                                        isOpen ? 'rotate-180 text-[#00B5F1]' : ''
                                                    }`}
                                                />
                                            )}
                                        </button>

                                        {!isCollapsed && isOpen && (
                                            <div className="pl-3 pr-1 py-0.5 space-y-0.5 border-l border-white/15 ml-3.5">
                                                {item.children.map((sub) => {
                                                    const subActive = isPathActive(sub.path)
                                                    return (
                                                        <Link
                                                            key={sub.path}
                                                            to={sub.path}
                                                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11.5px] transition ${
                                                                subActive
                                                                    ? 'bg-[#00B5F1] text-white font-bold shadow-2xs'
                                                                    : 'text-sky-100/75 hover:bg-white/8 hover:text-white'
                                                            }`}
                                                        >
                                                            <span
                                                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                                    subActive ? 'bg-white ring-2 ring-white/40' : 'bg-sky-300/50'
                                                                }`}
                                                            />
                                                            <span className="truncate">{sub.label}</span>
                                                        </Link>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </nav>

                {/* Bottom Bar: Toggle Collapse & Gateway Status */}
                <div className="p-2.5 border-t border-white/10 bg-[#002840] text-[11px] text-sky-200/80 space-y-1.5">
                    {/* Collapse Button (TCLINIC STYLE) */}
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
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/25">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    ONLINE
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

            {/* Right Main Area with Friendly Breadcrumbs */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <AdminHeader />

                {/* Friendly Operational Breadcrumb & Context Header */}
                <div className="h-8 bg-white/70 border-b border-[#E2EDF5] px-3.5 lg:px-4 flex items-center justify-between text-xs text-slate-500 shrink-0">
                    <div className="flex items-center gap-1.5 font-medium">
                        <Link to="/admin" className="inline-flex items-center gap-1 hover:text-[#00B5F1] transition">
                            <HouseLine size={13} weight="duotone" className="text-[#00B5F1]" />
                            <span>Trang chủ</span>
                        </Link>
                        <span>/</span>
                        <span className="font-bold text-[#003553]">{getBreadcrumbTitle()}</span>
                    </div>

                    <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="font-medium text-slate-600">Ca sáng (07:30 - 12:00)</span>
                        </span>
                        <span>•</span>
                        <span className="font-mono text-slate-500 font-semibold">
                            Phím tắt: F2 Tiếp đón | F5 Lưu | F7 Kê DV | F8 Lịch sử | F9 In
                        </span>
                    </div>
                </div>

                {/* Page Content Body */}
                <main className="flex-1 p-3 sm:p-4 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}

