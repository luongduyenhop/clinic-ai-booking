import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Button } from 'antd'
import {
    BellOutlined,
    UserOutlined,
    ClockCircleOutlined,
    LockOutlined,
} from '@ant-design/icons'
import { readAuthFromStorage } from '../../utils/auth/authStorage'
import CloseShiftModal from './CloseShiftModal'

const ROUTE_NAMES = {
    '/reception/dashboard': 'Tổng quan Dashboard',
    '/reception/check-in': 'Tiếp nhận bệnh nhân & Check-in',
    '/reception/queue': 'Quản lý hàng đợi phòng khám',
    '/reception/appointments': 'Quản lý lịch hẹn khám',
    '/reception/patients': 'Quản lý hồ sơ bệnh nhân',
    '/reception/schedule': 'Lịch trực bác sĩ & Sức chứa',
    '/reception/administration': 'Thủ tục hành chính & Thanh toán',
    '/reception/tasks': 'Sự cố nghiệp vụ cần xử lý',
    '/reception/reports': 'Lịch sử thao tác & Báo cáo',
}

export default function ReceptionHeader() {
    const location = useLocation()
    const { tasks = [], doctorAbsences = [] } = useSelector((state) => state.reception)
    const { user: authUser, role: authRole } = useSelector((state) => state.app?.auth || {})
    const storedAuth = !authUser ? readAuthFromStorage() : null
    const currentUser = authUser || storedAuth?.user
    const role = authRole || storedAuth?.role

    const [currentTime, setCurrentTime] = useState(new Date())
    const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false)

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const pageTitle = ROUTE_NAMES[location.pathname] || 'Cổng Lễ Tân'
    const pendingIncidentsCount = doctorAbsences.length
    const pendingTasksCount = tasks.filter((t) => t.status === 'PENDING').length + pendingIncidentsCount

    const formattedTime = new Intl.DateTimeFormat('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(currentTime)

    const staffName =
        currentUser?.fullName ||
        currentUser?.ho_ten ||
        currentUser?.name ||
        currentUser?.username ||
        'Nhân viên Tiếp đón'

    const roleNameMap = {
        LE_TAN: 'Lễ tân',
        THU_NGAN: 'Lễ tân',
        ADMIN: 'Quản trị viên',
        BAC_SI: 'Bác sĩ tiếp đón',
        DUOC_SI: 'Dược sĩ',
        Y_TA: 'Điều dưỡng',
        KY_THUAT_VIEN: 'Kỹ thuật viên',
    }

    const staffRole =
        (role && roleNameMap[role]) ||
        (currentUser?.vai_tro && !['Lễ tân chính', 'Lễ tân kiêm thu ngân'].includes(currentUser.vai_tro)
            ? currentUser.vai_tro
            : 'Lễ tân')

    return (
        <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-xs">
            {/* Left: Breadcrumb & Title */}
            <div className="flex items-center gap-3 shrink-0">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-medium whitespace-nowrap">
                        <Link to="/reception/dashboard" className="hover:text-sky-600 transition">
                            Lễ tân
                        </Link>
                        <span>/</span>
                        <span className="text-slate-600 font-semibold">{pageTitle}</span>
                    </div>
                    <h1 className="text-base font-bold text-slate-800 leading-tight mt-0.5 whitespace-nowrap">{pageTitle}</h1>
                </div>
            </div>

            {/* Right: Working Clock, Notifications, User Profile */}
            <div className="flex items-center gap-3 shrink-0">
                {/* Working Clock */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-600 shrink-0 whitespace-nowrap">
                    <ClockCircleOutlined className="text-sky-500" />
                    <span className="tabular-nums">{formattedTime}</span>
                </div>

                {/* Nút Đóng ca trực */}
                <Button
                    icon={<LockOutlined className="text-rose-600" />}
                    onClick={() => setIsCloseShiftOpen(true)}
                    className="text-xs font-semibold text-rose-700 bg-rose-50/80 border-rose-200 hover:bg-rose-100 hover:border-rose-300 transition shrink-0"
                >
                    Đóng ca trực
                </Button>

                {/* Notifications badge for tasks/incidents */}
                <Link
                    to="/reception/tasks"
                    className="relative w-9 h-9 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-900 transition shrink-0"
                    title={`${pendingTasksCount} sự cố cần xử lý`}
                >
                    <BellOutlined className="text-base" />
                    {pendingIncidentsCount > 0 ? (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                            {pendingIncidentsCount}
                        </span>
                    ) : pendingTasksCount > 0 ? (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {pendingTasksCount}
                        </span>
                    ) : null}
                </Link>

                {/* Current Staff Profile */}
                <div className="flex items-center gap-2 pl-3 border-l border-slate-200 shrink-0">
                    <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs border border-sky-200 shrink-0">
                        <UserOutlined />
                    </div>
                    <div className="hidden sm:block text-left text-xs shrink-0 whitespace-nowrap">
                        <div className="font-bold text-slate-800 leading-tight whitespace-nowrap">
                            {staffName}
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                            {staffRole}
                        </span>
                    </div>
                </div>
            </div>

            {/* Modal Đóng ca trực & Bàn giao */}
            <CloseShiftModal
                open={isCloseShiftOpen}
                onCancel={() => setIsCloseShiftOpen(false)}
            />
        </header>
    )
}
