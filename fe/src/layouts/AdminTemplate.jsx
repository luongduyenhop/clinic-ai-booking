import { useEffect, useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import AdminHeader from '../components/admin/AdminHeader'
import { loadClinicDataAsync } from '../redux/actions/admin/adminAction'
import { clinicalEventBridge, CLINICAL_EVENTS } from '../services/clinicalEventBridge'
import { getNavigationConfig } from '../utils/helpers/clinicConfigHelpers'
import {
    ClinicIcon,
    CaretDown,
    CaretLeft,
    CaretRight,
    Hospital,
    GlobeHemisphereWest,
} from '../components/common/ClinicIcon'

export default function AdminTemplate() {
    const location = useLocation()
    const dispatch = useDispatch()
    const { clinicData } = useSelector((state) => state.app.admin)
    const { sidebarSections = [], sidebarMenus = [] } = getNavigationConfig(clinicData)

    const [isCollapsed, setIsCollapsed] = useState(false)
    const [openGroups, setOpenGroups] = useState({
        catalogs: true,
        users: true,
        compliance: false,
        templates: false,
    })

    useEffect(() => {
        const syncClinicData = () => {
            dispatch(loadClinicDataAsync())
        }

        syncClinicData()
        const timer = setInterval(syncClinicData, 3000)

        const unsubCheckIn = clinicalEventBridge.on(CLINICAL_EVENTS.PATIENT_CHECKED_IN, syncClinicData)
        const unsubApptCreated = clinicalEventBridge.on(CLINICAL_EVENTS.APPOINTMENT_CREATED, syncClinicData)
        const unsubApptUpdated = clinicalEventBridge.on(CLINICAL_EVENTS.APPOINTMENT_UPDATED, syncClinicData)
        const unsubRegCreated = clinicalEventBridge.on(CLINICAL_EVENTS.REGISTRATION_CREATED, syncClinicData)
        const unsubEncounterCompleted = clinicalEventBridge.on(CLINICAL_EVENTS.ENCOUNTER_COMPLETED, syncClinicData)
        const unsubBillPaid = clinicalEventBridge.on(CLINICAL_EVENTS.BILL_PAID, syncClinicData)

        const handleFocus = () => syncClinicData()
        window.addEventListener('focus', handleFocus)

        return () => {
            clearInterval(timer)
            unsubCheckIn()
            unsubApptCreated()
            unsubApptUpdated()
            unsubRegCreated()
            unsubEncounterCompleted()
            unsubBillPaid()
            window.removeEventListener('focus', handleFocus)
        }
    }, [dispatch])

    const toggleGroup = (id) => {
        setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
    }

    const isPathActive = (path) => {
        if (!path) return false
        if (path === '/admin') return location.pathname === '/admin'

        const [itemBase, itemQuery] = path.split('?')
        const currentParams = new URLSearchParams(location.search)

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

    const getBreadcrumbTitle = () => {
        const p = location.pathname
        if (p === '/admin') return 'Trung tâm Điều hành & Thống kê BI'
        if (p.includes('/danh-muc/chuyen-khoa')) return 'Quản trị Danh mục Chuyên khoa lâm sàng'
        if (p.includes('/danh-muc/khoa-phong')) return 'Quản trị Danh mục Khoa phòng & Buồng khám'
        if (p.includes('/danh-muc/dich-vu')) return 'Quản trị Danh mục Dịch vụ Kỹ thuật & Giá niêm yết'
        if (p.includes('/danh-muc/thuoc-vat-tu')) return 'Quản trị Danh mục Thuốc kê đơn (BYT)'
        if (p.includes('/danh-muc/benh')) return 'Quản trị Danh mục Bệnh lý Quốc tế (ICD-10)'
        if (p.includes('/danh-muc/dia-chi')) return 'Quản trị Danh mục Địa chỉ Hành chính'
        if (p.includes('/danh-muc')) return 'Quản trị Danh mục Y tế Nền tảng'
        if (p.includes('/quan-ly-mau')) return 'Quản trị Biểu mẫu & Mẫu in Y tế'
        if (p.includes('/nghi-phep') || location.search.includes('tab=nghi-phep')) return 'Phê duyệt Nghỉ phép Bác sĩ & Điều phối Ca trực'
        if (p.includes('/nhan-vien')) return 'Quản trị Hồ sơ Nhân sự, Bác sĩ & Kiểm soát CCHN'
        if (p.includes('/phan-quyen')) return 'Ma trận Phân quyền Vai trò (RBAC)'
        if (p.includes('/benh-nhan')) return 'Tra cứu Danh mục Hồ sơ Bệnh nhân (Master)'
        if (p.includes('/tuan-thu') || p.includes('/don-thuoc-quoc-gia')) return 'Tuân thủ Pháp lý & Liên thông Cổng Quốc gia (TT26/TT32)'
        if (p.includes('/lich-su-hoat-dong')) return 'Nhật ký Kiểm toán Truy cập Dữ liệu Y tế (Audit Log)'
        if (p.includes('/cai-dat') || p.includes('/setting')) return 'Cấu hình Hệ thống Phòng khám & Cổng Liên thông'
        if (p.includes('/bao-cao')) return 'Báo cáo Thống kê Tổng hợp & Phân tích Vận hành'
        return 'Quản trị Hệ thống Phòng khám'
    }

    return (
        <div className="h-screen h-[100dvh] flex bg-clinic-bg text-clinic-text overflow-hidden">
            <aside
                className={`h-screen h-[100dvh] sticky top-0 bg-clinic-navy text-clinic-surface flex flex-col shrink-0 select-none border-r border-clinic-navy-dark transition-[width] duration-200 z-40 overflow-hidden ${
                    isCollapsed ? 'w-[64px]' : 'w-[244px]'
                }`}
            >
                <div className="h-14 px-3 flex items-center justify-between border-b border-[color:var(--clinic-nav-divider)] bg-clinic-navy-dark">
                    <Link to="/admin" className="flex items-center gap-2.5 overflow-hidden">
                        <span className="w-8 h-8 rounded-[6px] bg-clinic-navy border border-[color:var(--clinic-nav-divider)] text-clinic-surface flex items-center justify-center shrink-0">
                            <Hospital size={18} weight="fill" />
                        </span>
                        {!isCollapsed && (
                            <div className="leading-tight truncate">
                                <div className="font-display font-extrabold text-sm tracking-wide text-clinic-surface">
                                    CLINIC-AI HIS
                                </div>
                                <div className="text-[10px] text-clinic-on-navy-muted font-medium truncate">
                                    Quản Trị Hệ Thống
                                </div>
                            </div>
                        )}
                    </Link>
                </div>

                <nav className="flex-1 overflow-y-auto py-2.5 px-2 space-y-3 text-[12px] no-scrollbar">
                    {(sidebarSections.length > 0 ? sidebarSections : [{ id: 'default', menus: sidebarMenus }]).map((section) => (
                        <div key={section.id} className="space-y-1">
                            {!isCollapsed && section.title && (
                                <div className="px-2.5 pt-1.5 pb-1 text-[9.5px] font-extrabold tracking-wider uppercase text-clinic-on-navy-muted flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-clinic-cyan" />
                                    <span className="truncate">{section.title}</span>
                                </div>
                            )}
                            {isCollapsed && section.title && (
                                <div className="border-t border-[color:var(--clinic-nav-divider)] my-1 mx-2" />
                            )}

                            {section.menus.map((item) => {
                                const active = isGroupActive(item)
                                if (!item.children) {
                                    return (
                                        <Link
                                            key={item.id}
                                            to={item.path}
                                            title={isCollapsed ? item.title : undefined}
                                            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[6px] font-medium transition-colors duration-75 group ${
                                                active
                                                    ? 'bg-clinic-cta text-clinic-surface font-bold'
                                                    : 'text-clinic-on-navy-muted hover:bg-[color:var(--clinic-nav-hover)] hover:text-clinic-surface'
                                            }`}
                                        >
                                            <ClinicIcon
                                                name={item.icon}
                                                size={17}
                                                weight={active ? 'fill' : 'duotone'}
                                                className={`shrink-0 ${active ? 'text-clinic-surface' : 'text-clinic-info-border'}`}
                                            />
                                            {!isCollapsed && (
                                                <div className="flex-1 flex items-center justify-between min-w-0">
                                                    <span className="truncate">{item.title}</span>
                                                    {item.badge && (
                                                        <span
                                                            className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-[4px] text-clinic-surface shrink-0 ${
                                                                item.badgeColor || 'bg-clinic-cta'
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
                                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-[6px] font-semibold transition-colors duration-75 cursor-pointer ${
                                                active
                                                    ? 'bg-[color:var(--clinic-nav-hover)] text-clinic-surface'
                                                    : 'text-clinic-on-navy-muted hover:bg-[color:var(--clinic-nav-hover)] hover:text-clinic-surface'
                                            }`}
                                        >
                                            <span className="flex items-center gap-2.5 truncate">
                                                <ClinicIcon
                                                    name={item.icon}
                                                    size={17}
                                                    weight={active ? 'fill' : 'duotone'}
                                                    className="text-clinic-info-border shrink-0"
                                                />
                                                {!isCollapsed && <span className="truncate">{item.title}</span>}
                                            </span>
                                            {!isCollapsed && (
                                                <CaretDown
                                                    size={12}
                                                    weight="bold"
                                                    className={`text-clinic-on-navy-muted transition-transform duration-150 shrink-0 ${
                                                        isOpen ? 'rotate-180 text-clinic-surface' : ''
                                                    }`}
                                                />
                                            )}
                                        </button>

                                        {!isCollapsed && isOpen && (
                                            <div className="pl-3 pr-1 py-0.5 space-y-0.5 border-l border-[color:var(--clinic-nav-divider)] ml-3.5">
                                                {item.children.map((sub) => {
                                                    const subActive = isPathActive(sub.path)
                                                    return (
                                                        <Link
                                                            key={sub.path}
                                                            to={sub.path}
                                                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-[11.5px] transition-colors duration-75 ${
                                                                subActive
                                                                    ? 'bg-clinic-cta text-clinic-surface font-bold'
                                                                    : 'text-clinic-on-navy-muted hover:bg-[color:var(--clinic-nav-hover)] hover:text-clinic-surface'
                                                            }`}
                                                        >
                                                            <span
                                                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                                    subActive ? 'bg-clinic-surface' : 'bg-clinic-info-border'
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

                <div className="p-2.5 border-t border-[color:var(--clinic-nav-divider)] bg-clinic-navy-dark text-[11px] text-clinic-on-navy-muted space-y-1.5">
                    <button
                        type="button"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-[6px] bg-[color:var(--clinic-nav-hover)] hover:bg-clinic-cta text-clinic-surface font-semibold text-center transition-colors duration-75 cursor-pointer"
                        title={isCollapsed ? 'Mở rộng thanh menu' : 'Thu gọn thanh menu'}
                    >
                        {isCollapsed ? (
                            <CaretRight size={15} weight="bold" className="text-clinic-surface" />
                        ) : (
                            <>
                                <CaretLeft size={14} weight="bold" className="text-clinic-surface" />
                                <span>Thu gọn menu</span>
                            </>
                        )}
                    </button>

                    {!isCollapsed && (
                        <>
                            <div className="flex items-center justify-between pt-1 text-[10px]">
                                <span>Cổng ĐTQG (TT 26):</span>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-clinic-success-bg text-clinic-success font-bold border border-clinic-success-border">
                                    <span className="w-1.5 h-1.5 rounded-full bg-clinic-success" />
                                    Trực tuyến
                                </span>
                            </div>
                            <Link
                                to="/"
                                className="flex items-center justify-center gap-1.5 w-full py-1 text-[10.5px] rounded-[6px] text-clinic-on-navy-muted hover:text-clinic-surface hover:bg-[color:var(--clinic-nav-hover)] transition-colors duration-75"
                            >
                                <GlobeHemisphereWest size={13} weight="duotone" className="text-clinic-info-border" />
                                <span>Cổng Đặt Lịch Bệnh Nhân</span>
                            </Link>
                        </>
                    )}
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <AdminHeader pageTitle={getBreadcrumbTitle()} />

                <main className="flex-1 p-3 sm:p-4 overflow-y-auto bg-clinic-bg">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
