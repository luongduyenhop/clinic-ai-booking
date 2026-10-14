import { useState, useRef, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout } from '../../redux/slices/authSlice'
import { AppToast } from '../common/AppNotification'
import DoctorEditProfileModal from './DoctorEditProfileModal'
import DoctorCertificateModal from './DoctorCertificateModal'

export default function DoctorHeaderProfile() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { user } = useSelector((state) => state.app.auth)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [isOnDuty, setIsOnDuty] = useState(true)
    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
    const [isCertificateOpen, setIsCertificateOpen] = useState(false)
    const menuRef = useRef(null)

    // Dữ liệu bác sĩ hiển thị (đồng bộ từ thông tin tài khoản đăng nhập)
    const [doctorInfo, setDoctorInfo] = useState({
        name: user?.fullName || 'Bác sĩ',
        specialty: user?.specialty || 'Khoa Khám Bệnh',
        code: user?.doctorCode || 'DOC',
        room: user?.room || 'Bàn khám',
        shift: user?.shift || 'Chưa phân ca',
        examinedToday: user?.examinedToday || 0,
        phone: user?.phone || '',
        email: user?.email || '',
        degree: user?.degree || '',
        experience: user?.experience || '',
    })

    useEffect(() => {
        if (user) {
            setDoctorInfo((prev) => ({
                ...prev,
                name: user.fullName || prev.name,
                email: user.email || prev.email,
                specialty: user.specialty || prev.specialty,
                code: user.doctorCode || prev.code,
                room: user.room || prev.room,
                shift: user.shift || prev.shift,
                examinedToday: user.examinedToday ?? prev.examinedToday,
            }))
        }
    }, [user])

    // Đóng dropdown khi click ra ngoài
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleLogout = () => {
        dispatch(logout())
        AppToast.info('Đã đăng xuất khỏi phiên làm việc của Bác sĩ')
        navigate('/login')
    }

    const toggleDutyStatus = () => {
        setIsOnDuty(!isOnDuty)
        AppToast.info(
            !isOnDuty
                ? 'Đã chuyển sang trạng thái: Đang trực khám'
                : 'Đã tạm dừng tiếp nhận bệnh nhân mới'
        )
    }

    const handleSaveProfile = (updatedData) => {
        setDoctorInfo((prev) => ({
            ...prev,
            ...updatedData,
        }))
    }

    return (
        <>
            <div className="relative" ref={menuRef}>
                {/* Header Profile Trigger Button */}
                <button
                    type="button"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="flex items-center gap-3.5 p-1.5 pr-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/90 transition shadow-2xs cursor-pointer text-left"
                    aria-expanded={isMenuOpen}
                >
                    {/* Doctor Avatar */}
                    <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00B5F1] to-[#003553] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                            🩺
                        </div>
                        {/* Status dot */}
                        <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                isOnDuty ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                            }`}
                            title={isOnDuty ? 'Đang trực khám' : 'Tạm nghỉ'}
                        />
                    </div>

                    {/* Name & Specialty Info */}
                    <div className="hidden sm:block">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[#003553] tracking-tight">
                                {doctorInfo.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#E8F4FD] text-[#00B5F1] font-semibold border border-sky-100">
                                {doctorInfo.code}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                            {doctorInfo.specialty}
                        </p>
                    </div>

                    {/* Dropdown chevron */}
                    <svg
                        className={`w-4 h-4 text-slate-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {/* Dropdown Menu Modal / Popover */}
                {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-3xl border border-slate-200/90 shadow-xl py-3 z-50 text-slate-700 animate-in fade-in slide-in-from-top-2 duration-150">
                        {/* Header in dropdown (Có thể click để sửa hồ sơ) */}
                        <div
                            onClick={() => {
                                setIsMenuOpen(false)
                                setIsEditProfileOpen(true)
                            }}
                            className="px-5 py-3 border-b border-slate-100 hover:bg-[#E8F4FD]/40 transition cursor-pointer group"
                            title="Bấm để chỉnh sửa thông tin hồ sơ"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-[#E8F4FD] text-[#00B5F1] flex items-center justify-center text-xl font-bold border border-sky-100 group-hover:scale-105 transition">
                                    👨‍⚕️
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-extrabold text-[#003553] truncate group-hover:text-[#00B5F1] transition">
                                            {doctorInfo.name}
                                        </h4>
                                        <span className="text-[10px] text-[#00B5F1] font-bold opacity-0 group-hover:opacity-100 transition">
                                            Sửa ✎
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 truncate">{doctorInfo.specialty}</p>
                                    <span className="inline-block mt-1 text-[11px] font-semibold text-[#00B5F1]">
                                        📍 {doctorInfo.room}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Ca làm việc & Thống kê nhanh */}
                        <div className="p-4 bg-slate-50/80 mx-3 my-2 rounded-2xl border border-slate-100 space-y-2 text-xs">
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="text-slate-500">Ca hiện tại:</span>
                                <span className="font-semibold text-slate-800">{doctorInfo.shift}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="text-slate-500">Đã khám hôm nay:</span>
                                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    {doctorInfo.examinedToday} bệnh nhân
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-200/60">
                                <span className="text-slate-500">Trạng thái nhận bệnh:</span>
                                <button
                                    type="button"
                                    onClick={toggleDutyStatus}
                                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition cursor-pointer ${
                                        isOnDuty
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                            : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                                    }`}
                                >
                                    {isOnDuty ? '● Đang nhận bệnh' : '○ Tạm nghỉ'}
                                </button>
                            </div>
                        </div>

                        {/* Quick navigation links */}
                        <div className="px-2 py-1 space-y-0.5 text-xs font-semibold">
                            {/* 1. Chỉnh sửa thông tin hồ sơ */}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMenuOpen(false)
                                    setIsEditProfileOpen(true)
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-[#E8F4FD] hover:text-[#00B5F1] transition cursor-pointer"
                            >
                                <span>✏️</span>
                                <span>Chỉnh sửa hồ sơ cá nhân</span>
                            </button>

                            {/* 2. Chứng chỉ hành nghề & Bằng cấp */}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMenuOpen(false)
                                    setIsCertificateOpen(true)
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition cursor-pointer"
                            >
                                <span>📜</span>
                                <span>Chứng chỉ hành nghề & Bằng cấp</span>
                            </button>
                        </div>

                        {/* Logout Button */}
                        <div className="p-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs transition cursor-pointer border border-red-100"
                            >
                                <span>🚪</span>
                                <span>Đăng xuất phiên làm việc</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Chỉnh Sửa Thông Tin Bác Sĩ */}
            <DoctorEditProfileModal
                isOpen={isEditProfileOpen}
                onClose={() => setIsEditProfileOpen(false)}
                currentInfo={doctorInfo}
                onSave={handleSaveProfile}
            />

            {/* Modal Chứng Chỉ Hành Nghề */}
            <DoctorCertificateModal
                isOpen={isCertificateOpen}
                onClose={() => setIsCertificateOpen(false)}
                doctorInfo={doctorInfo}
            />
        </>
    )
}
