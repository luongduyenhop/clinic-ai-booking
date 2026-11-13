import { useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { ConfigProvider } from 'antd'
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

const medproTheme = {
    token: {
        colorPrimary: '#00B5F1',
        colorPrimaryHover: '#009ED4',
        colorPrimaryActive: '#0088B8',
        colorTextHeading: '#003553',
        colorText: '#1E293B',
        colorLink: '#00B5F1',
        colorLinkHover: '#009ED4',
        colorSuccess: '#047857',
        colorWarning: '#FFB54A',
        colorError: '#E11D48',
        colorInfo: '#00B5F1',
        borderRadius: 8,
        fontFamily: '"Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    components: {
        Button: {
            borderRadius: 9999,
            controlHeight: 34,
            fontWeight: 600,
            primaryShadow: '0 3px 10px rgba(0, 181, 241, 0.24)',
        },
        Table: {
            headerBg: '#F0F7FC',
            headerColor: '#003553',
            headerSplitColor: '#E2EDF5',
            borderColor: '#E2EDF5',
            rowHoverBg: '#F8FCFF',
            borderRadius: 12,
        },
        Descriptions: {
            labelBg: '#F0F7FC',
            colorTextLabel: '#003553',
            colorSplit: '#E2EDF5',
        },
        Modal: {
            borderRadiusLG: 16,
            headerBg: '#FFFFFF',
            titleColor: '#003553',
        },
        Card: {
            borderRadiusLG: 14,
            colorBorderSecondary: '#E2EDF5',
        },
        Segmented: {
            itemSelectedBg: '#FFFFFF',
            itemSelectedColor: '#003553',
            trackBg: '#E8F4FD',
            borderRadius: 9999,
        },
        Tag: {
            borderRadiusSM: 9999,
        },
        Select: {
            borderRadius: 8,
            colorPrimary: '#00B5F1',
            colorPrimaryHover: '#009ED4',
            controlOutline: 'rgba(0, 181, 241, 0.14)',
        },
        Input: {
            borderRadius: 8,
            colorPrimary: '#00B5F1',
            colorPrimaryHover: '#009ED4',
            controlOutline: 'rgba(0, 181, 241, 0.14)',
        },
    },
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
        <ConfigProvider theme={medproTheme}>
            <div className="h-screen flex bg-[#F4F8FB] text-[#0F172A] overflow-hidden antialiased">
                <ReceptionSidebar />

                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <ReceptionHeader />

                    <div className="h-8 bg-white/70 border-b border-[#E2EDF5] px-3.5 lg:px-4 flex items-center justify-between text-xs text-slate-500 shrink-0 select-none">
                        <div className="flex items-center gap-1.5 font-medium">
                            <Link to="/reception/dashboard" className="inline-flex items-center gap-1 hover:text-[#00B5F1] transition">
                                <HouseLine size={13} weight="duotone" className="text-[#00B5F1]" />
                                <span>Trang chủ</span>
                            </Link>
                            <span>/</span>
                            <span className="font-bold text-[#003553]">{currentBreadcrumb}</span>
                        </div>

                        <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                <span className="font-medium text-slate-600">{shiftLabel}</span>
                            </span>
                        </div>
                    </div>

                    <main className="flex-1 p-3 sm:p-4 overflow-y-auto">
                        <Outlet />
                    </main>
                </div>
            </div>
        </ConfigProvider>
    )
}
