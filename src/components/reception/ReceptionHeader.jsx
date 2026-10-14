import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { Modal, Select, message, Tooltip } from 'antd'
import {
    ReloadOutlined,
    BellOutlined,
    UserOutlined,
    ClockCircleOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons'
import { switchReceptionRoleAsync, resetReceptionDataAsync } from '../../redux/slices/reception/receptionSlice'
import { RECEPTION_ROLES_OPTIONS } from '../../utils/constants/receptionConstants'

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
    const dispatch = useDispatch()
    const { activeRole, tasks } = useSelector((state) => state.reception)

    const [currentTime, setCurrentTime] = useState(new Date())
    const [isResetModalOpen, setIsResetModalOpen] = useState(false)

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const pageTitle = ROUTE_NAMES[location.pathname] || 'Cổng Lễ Tân'
    const pendingTasks = tasks.filter((t) => t.status === 'PENDING')
    const criticalTasks = pendingTasks.filter((t) => t.severity === 'CRITICAL' || t.severity === 'HIGH')

    const handleRoleChange = async (role) => {
        await dispatch(switchReceptionRoleAsync(role))
        message.success(`Đã chuyển quyền vai trò: ${role === 'RECEPTION_SUPERVISOR' ? 'Giám sát lễ tân' : 'Lễ tân'}`)
    }

    const handleConfirmReset = async () => {
        await dispatch(resetReceptionDataAsync())
        setIsResetModalOpen(false)
        message.success('Đã đặt lại dữ liệu mẫu (Reset Demo Data) về trạng thái ban đầu thành công!')
    }

    const formattedTime = new Intl.DateTimeFormat('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(currentTime)

    return (
        <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-xs">
            {/* Left: Breadcrumb & Title */}
            <div className="flex items-center gap-3">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                        <Link to="/reception/dashboard" className="hover:text-sky-600 transition">
                            Lễ tân
                        </Link>
                        <span>/</span>
                        <span className="text-slate-600 font-semibold">{pageTitle}</span>
                    </div>
                    <h1 className="text-base font-bold text-slate-800 leading-tight mt-0.5">{pageTitle}</h1>
                </div>
            </div>

            {/* Right: Actions, Clock, Role switcher, User badge */}
            <div className="flex items-center gap-4">
                {/* Working Clock */}
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-600">
                    <ClockCircleOutlined className="text-sky-500" />
                    <span className="tabular-nums">{formattedTime}</span>
                </div>

                {/* Reset Data Button */}
                <Tooltip title="Đặt lại toàn bộ dữ liệu mẫu (Seed Data) về ban đầu">
                    <button
                        onClick={() => setIsResetModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100/80 text-amber-800 text-xs font-semibold transition cursor-pointer shadow-2xs"
                    >
                        <ReloadOutlined className="text-amber-600" />
                        <span className="hidden sm:inline">Reset Demo</span>
                    </button>
                </Tooltip>

                {/* Quick Portal Switcher */}
                <div className="hidden md:flex items-center gap-1.5">
                    <Link
                        to="/doctor"
                        className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold transition flex items-center gap-1"
                        title="Chuyển sang Cổng Bác Sĩ"
                    >
                        <span>👨‍⚕️</span>
                        <span className="hidden xl:inline">Bác Sĩ</span>
                    </Link>
                    <Link
                        to="/admin"
                        className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition flex items-center gap-1"
                        title="Chuyển sang Cổng Quản Lý"
                    >
                        <span>🏛️</span>
                        <span className="hidden xl:inline">Quản Trị</span>
                    </Link>
                </div>

                {/* Notifications badge for tasks */}
                <Link
                    to="/reception/tasks"
                    className="relative w-9 h-9 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-900 transition"
                    title={`${pendingTasks.length} sự cố hành chính cần xử lý`}
                >
                    <BellOutlined className="text-base" />
                    {criticalTasks.length > 0 ? (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                            {criticalTasks.length}
                        </span>
                    ) : pendingTasks.length > 0 ? (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {pendingTasks.length}
                        </span>
                    ) : null}
                </Link>

                {/* Role Switcher */}
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                    <span className="text-xs text-slate-400 hidden xl:inline font-medium">Vai trò demo:</span>
                    <Select
                        value={activeRole}
                        onChange={handleRoleChange}
                        options={RECEPTION_ROLES_OPTIONS}
                        className="w-44 text-xs font-semibold"
                        size="middle"
                    />
                </div>

                {/* Current Staff Badge */}
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                    <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs border border-sky-200">
                        <UserOutlined />
                    </div>
                    <div className="hidden sm:block text-left text-xs">
                        <div className="font-bold text-slate-800 flex items-center gap-1 leading-tight">
                            {activeRole === 'RECEPTION_SUPERVISOR' ? 'Trần Đình Nam' : 'Nguyễn Thị Hoa'}
                            {activeRole === 'RECEPTION_SUPERVISOR' && (
                                <SafetyCertificateOutlined className="text-teal-600" title="Giám sát ca trực" />
                            )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">
                            {activeRole === 'RECEPTION_SUPERVISOR' ? 'Giám sát lễ tân' : 'Lễ tân chính'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Reset Confirmation Modal */}
            <Modal
                title="Khôi phục dữ liệu mẫu ban đầu?"
                open={isResetModalOpen}
                onOk={handleConfirmReset}
                onCancel={() => setIsResetModalOpen(false)}
                okText="Đồng ý đặt lại"
                cancelText="Hủy bỏ"
                okButtonProps={{ danger: true }}
            >
                <div className="py-2 text-sm text-slate-600 space-y-2">
                    <p>
                        Hành động này sẽ xóa toàn bộ thay đổi tạm thời trên máy bạn (lịch hẹn mới, vé check-in vừa tạo,
                        sửa đổi hồ sơ, nhật ký thao tác) và tải lại bộ <strong>32 bệnh nhân, 42 lịch hẹn và 32 lượt hàng đợi mẫu</strong>.
                    </p>
                    <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                        Thao tác này rất hữu ích khi bạn muốn bắt đầu lại một kịch bản demo hoặc làm mới dữ liệu kiểm thử.
                    </p>
                </div>
            </Modal>
        </header>
    )
}
