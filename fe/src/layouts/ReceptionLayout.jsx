import { useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import ReceptionSidebar from '../components/reception/ReceptionSidebar'
import ReceptionHeader from '../components/reception/ReceptionHeader'
import { loadClinicDataAsync } from '../redux/actions/admin/adminAction'
import { HouseLine } from '../components/common/ClinicIcon'

const ROUTE_BREADCRUMBS = {
    '/reception/dashboard': 'Tổng quan & Bàn làm việc Lễ tân – Thu ngân',
    '/reception/check-in': 'Tiếp nhận bệnh nhân & Check-in',
    '/reception/queue': 'Quản lý Hàng đợi & Điều phối buồng khám',
    '/reception/cashier': 'Thu ngân – Viện phí & Quyết toán VietQR',
    '/reception/appointments': 'Quản lý Lịch hẹn khám',
    '/reception/patients': 'Quản lý Hồ sơ Bệnh nhân',
    '/reception/schedule': 'Lịch trực Bác sĩ & Sức chứa buồng',
    '/reception/administration': 'Thủ tục Hành chính & Viện phí',
    '/reception/tasks': 'Xử lý Sự cố & Điều chuyển ca trực',
    '/reception/reports': 'Báo cáo Ca trực & Lịch sử tiếp đón',
}

export default function ReceptionLayout() {
    const location = useLocation()
    const dispatch = useDispatch()
    const currentBreadcrumb = ROUTE_BREADCRUMBS[location.pathname] || 'Cổng Lễ Tân – Thu Ngân'

    useEffect(() => {
        dispatch(loadClinicDataAsync())
    }, [dispatch])

    const currentHour = new Date().getHours()
    const shiftLabel = currentHour >= 12 ? 'Ca chiều (13:00 - 17:30)' : 'Ca sáng (07:30 - 12:00)'

    return (
        <div className="h-screen h-[100dvh] flex bg-clinic-bg text-clinic-text overflow-hidden antialiased">
            <ReceptionSidebar />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <ReceptionHeader />

                <div className="h-8 bg-clinic-surface border-b border-clinic-border px-3.5 lg:px-4 flex items-center justify-between text-xs text-clinic-text-secondary shrink-0 select-none">
                    <div className="flex items-center gap-1.5 font-medium">
                        <Link to="/reception/dashboard" className="inline-flex items-center gap-1 hover:text-clinic-cta transition-colors">
                            <HouseLine size={13} weight="duotone" className="text-clinic-cta" />
                            <span>Trang chủ</span>
                        </Link>
                        <span>/</span>
                        <span className="font-bold text-clinic-navy">{currentBreadcrumb}</span>
                    </div>

                    <div className="hidden sm:flex items-center gap-3 text-[11px] text-clinic-text-secondary">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-clinic-success" />
                            <span className="font-medium text-clinic-text-secondary">{shiftLabel}</span>
                        </span>
                    </div>
                </div>

                <main className="flex-1 p-3 sm:p-4 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
