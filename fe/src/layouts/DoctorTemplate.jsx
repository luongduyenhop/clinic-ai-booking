import { useState, useEffect, useMemo } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import DoctorHeaderProfile from '../components/doctor/DoctorHeaderProfile'
import { clinicalService } from '../services/doctor/ClinicalService'
import {
    CalendarCheck,
    CaretLeft,
    CaretRight,
    ClipboardText,
    Clock,
    Microscope,
    Stethoscope,
} from '../components/common/ClinicIcon'

export default function DoctorTemplate() {
    const location = useLocation()
    const { user } = useSelector((state) => state.app.auth)
    const { queue = [] } = useSelector((state) => state.doctor?.clinical || {})
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [currentTime, setCurrentTime] = useState(() => new Date())

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const searchParams = new URLSearchParams(location.search)
    const activeTabParam = (searchParams.get('tab') || '').toLowerCase()
    const isClsPage = location.pathname.startsWith('/doctor/can-lam-sang')
    const isScheduleTab = !isClsPage && activeTabParam === 'schedule'
    const isHistoryTab = !isClsPage && activeTabParam === 'history'
    const isExamTab = !isClsPage && !isScheduleTab && !isHistoryTab

    const pageTitle = isClsPage
        ? 'Bàn làm việc Cận lâm sàng'
        : isScheduleTab
          ? 'Lịch trực & Ca làm việc'
          : isHistoryTab
            ? 'Hồ sơ bệnh nhân đã khám'
            : 'Bàn khám lâm sàng'

    const activeQueueCount = useMemo(() => {
        const allEncounters = clinicalService.getAllEncountersSync()
        return queue.filter((t) => {
            if (t.trang_thai === 'da_kham') return false
            const enc = allEncounters[t.encounter_id] || allEncounters[String(t.encounter_id)]
            return !enc?.is_locked
        }).length
    }, [queue])

    const formattedTime = new Intl.DateTimeFormat('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(currentTime)

    const menuSections = [
        {
            id: 'doctor_clinical',
            title: 'Lâm sàng & Ca trực',
            items: [
                {
                    to: '/doctor',
                    label: 'Bàn khám lâm sàng',
                    icon: Stethoscope,
                    active: isExamTab,
                    badge: activeQueueCount > 0 ? String(activeQueueCount) : null,
                },
                {
                    to: '/doctor?tab=schedule',
                    label: 'Lịch trực & Ca làm việc',
                    icon: CalendarCheck,
                    active: isScheduleTab,
                },
                {
                    to: '/doctor?tab=history',
                    label: 'Hồ sơ bệnh nhân đã khám',
                    icon: ClipboardText,
                    active: isHistoryTab,
                },
            ],
        },
        {
            id: 'doctor_cls',
            title: 'Cận lâm sàng',
            items: [
                {
                    to: '/doctor/can-lam-sang',
                    label: 'Bàn làm việc Cận lâm sàng',
                    icon: Microscope,
                    active: isClsPage,
                },
            ],
        },
    ]

    const roomDisplay = user?.room || 'Phòng Khám Nội Tổng Quát 1'

    return (
        <div className="h-screen h-[100dvh] flex bg-clinic-bg text-clinic-text overflow-hidden antialiased">
            <aside
                className={`h-screen sticky top-0 bg-clinic-navy text-clinic-surface flex flex-col shrink-0 select-none border-r border-clinic-navy-dark transition-all duration-200 z-40 overflow-hidden ${
                    isCollapsed ? 'w-[64px]' : 'w-[244px]'
                }`}
            >
                <div className="h-14 px-3 flex items-center justify-between border-b border-clinic-on-navy-subtle/20 bg-clinic-navy-dark shrink-0">
                    <Link to="/doctor" className="flex items-center gap-2.5 overflow-hidden">
                        <span className="w-8 h-8 rounded-[6px] bg-clinic-cta text-clinic-surface flex items-center justify-center shrink-0">
                            <Stethoscope size={18} weight="bold" />
                        </span>
                        {!isCollapsed && (
                            <div className="leading-tight truncate">
                                <div className="font-display font-extrabold text-sm tracking-wide text-clinic-surface">
                                    CLINIC<span className="text-clinic-cyan">-AI</span> HIS
                                </div>
                                <div className="text-[10px] text-clinic-on-navy-muted font-medium truncate">
                                    Bác Sĩ · Bàn Khám Lâm Sàng
                                </div>
                            </div>
                        )}
                    </Link>
                </div>

                <nav className="flex-1 overflow-y-auto py-2.5 px-2 space-y-3 text-[12px] no-scrollbar">
                    {menuSections.map((section) => (
                        <div key={section.id} className="space-y-1">
                            {!isCollapsed && section.title && (
                                <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold text-clinic-on-navy-subtle flex items-center gap-1.5">
                                    <span className="w-1 h-1 rounded-full bg-clinic-cyan" />
                                    <span className="truncate">{section.title}</span>
                                </div>
                            )}
                            {isCollapsed && section.title && (
                                <div className="border-t border-clinic-on-navy-subtle/20 my-1 mx-2" />
                            )}

                            {section.items.map((item) => {
                                const IconComponent = item.icon
                                return (
                                    <Link
                                        key={item.to}
                                        to={item.to}
                                        title={isCollapsed ? item.label : undefined}
                                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[6px] font-medium transition-colors duration-75 group ${
                                            item.active
                                                ? 'bg-clinic-cta text-clinic-surface font-bold'
                                                : 'text-clinic-on-navy-muted hover:bg-clinic-navy-dark hover:text-clinic-surface'
                                        }`}
                                    >
                                        <IconComponent
                                            size={17}
                                            weight={item.active ? 'fill' : 'duotone'}
                                            className={`shrink-0 ${item.active ? 'text-clinic-surface' : 'text-clinic-cyan'}`}
                                        />
                                        {!isCollapsed && (
                                            <div className="flex-1 flex items-center justify-between min-w-0">
                                                <span className="truncate">{item.label}</span>
                                                {item.badge && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] shrink-0 tabular-nums bg-clinic-navy-dark text-clinic-surface border border-clinic-on-navy-subtle/30">
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
                        <div className="flex items-center justify-between pt-1 text-[10px]">
                            <span>Bệnh án TT 32/2023:</span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-clinic-success text-clinic-surface font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-clinic-surface" />
                                ONLINE
                            </span>
                        </div>
                    )}
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-14 bg-clinic-surface border-b border-clinic-border px-3.5 lg:px-5 flex items-center justify-between gap-4 shrink-0 sticky top-0 z-30 select-none">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-clinic-cta shrink-0" />
                        <h1 className="text-sm lg:text-base font-extrabold text-clinic-navy tracking-tight truncate font-display">
                            {pageTitle}
                        </h1>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                        <span className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-clinic-surface-alt border border-clinic-info-border text-clinic-navy text-[11.5px] font-bold whitespace-nowrap shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-clinic-success shrink-0" />
                            {roomDisplay}
                        </span>

                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-clinic-bg border border-clinic-border text-clinic-text-secondary text-[11.5px] font-semibold shrink-0 whitespace-nowrap tabular-nums">
                            <Clock size={13} weight="bold" className="text-clinic-cta" />
                            <span className="font-mono">{formattedTime}</span>
                        </div>

                        <DoctorHeaderProfile />
                    </div>
                </header>

                <main className="flex-1 p-3 sm:p-4 overflow-y-auto bg-clinic-bg">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
