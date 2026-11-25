import { useState, useRef, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logoutUserAsync } from '../../redux/actions/user/authAction'
import { AppToast } from '../common/AppNotification'
import { ClinicIcon } from '../common/ClinicIcon'
import { stripDemoTag } from '../../utils/helpers/doctorNameHelper'
import DoctorEditProfileModal from './DoctorEditProfileModal'
import DoctorCertificateModal from './DoctorCertificateModal'

export default function DoctorHeaderProfile() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { user, isLoggingOut } = useSelector((state) => state.app.auth)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [isOnDuty, setIsOnDuty] = useState(true)
    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
    const [isCertificateOpen, setIsCertificateOpen] = useState(false)
    const menuRef = useRef(null)

    const [doctorInfo, setDoctorInfo] = useState({
        name: stripDemoTag(user?.fullName || 'Bác sĩ'),
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
                name: stripDemoTag(user.fullName || prev.name),
                email: user.email || prev.email,
                specialty: user.specialty || prev.specialty,
                code: user.doctorCode || prev.code,
                room: user.room || prev.room,
                shift: user.shift || prev.shift,
                examinedToday: user.examinedToday ?? prev.examinedToday,
            }))
        }
    }, [user])

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleLogout = async () => {
        const result = await dispatch(logoutUserAsync())
        if (result.payload?.sessionChanged || result.meta.condition) return
        AppToast.info('Đã đăng xuất khỏi phiên làm việc của Bác sĩ')
        navigate('/staff/login')
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
                <button
                    type="button"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="flex items-center gap-2.5 p-1.5 pr-3 rounded-[6px] border border-clinic-border bg-clinic-surface hover:bg-clinic-bg transition cursor-pointer text-left shrink-0 select-none"
                    aria-expanded={isMenuOpen}
                >
                    <div className="relative shrink-0">
                        <div className="w-9 h-9 rounded-[6px] bg-clinic-navy text-clinic-surface flex items-center justify-center">
                            <ClinicIcon name="Stethoscope" size={18} weight="bold" />
                        </div>
                        <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-clinic-surface ${
                                isOnDuty ? 'bg-clinic-success' : 'bg-clinic-amber'
                            }`}
                            title={isOnDuty ? 'Đang trực khám' : 'Tạm nghỉ'}
                        />
                    </div>

                    <div className="hidden sm:block text-left shrink-0">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-xs font-bold text-clinic-navy tracking-tight whitespace-nowrap">
                                {doctorInfo.name}
                            </span>
                            <span className="medpro-badge-info text-[10px] font-bold shrink-0 tabular-nums">
                                {doctorInfo.code}
                            </span>
                        </div>
                        <p className="text-[11px] text-clinic-text-secondary font-medium whitespace-nowrap">
                            {doctorInfo.specialty}
                        </p>
                    </div>

                    <ClinicIcon
                        name="CaretDown"
                        size={14}
                        className={`text-clinic-text-muted shrink-0 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
                    />
                </button>

                {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-clinic-surface rounded-[6px] border border-clinic-border py-2 z-50 text-clinic-text">
                        <button
                            type="button"
                            onClick={() => {
                                setIsMenuOpen(false)
                                setIsEditProfileOpen(true)
                            }}
                            className="w-full text-left px-4 py-3 border-b border-clinic-border hover:bg-clinic-surface-tint transition cursor-pointer group"
                            title="Bấm để chỉnh sửa thông tin hồ sơ"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-[6px] bg-clinic-surface-alt text-clinic-cta flex items-center justify-center border border-clinic-info-border shrink-0">
                                    <ClinicIcon name="UserCircle" size={22} weight="bold" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <h4 className="text-sm font-extrabold text-clinic-navy truncate group-hover:text-clinic-cta transition">
                                            {doctorInfo.name}
                                        </h4>
                                        <span className="inline-flex items-center gap-0.5 text-[11px] text-clinic-cta font-bold shrink-0">
                                            <ClinicIcon name="PencilSimple" size={12} />
                                            <span>Sửa</span>
                                        </span>
                                    </div>
                                    <p className="text-xs text-clinic-text-secondary truncate">{doctorInfo.specialty}</p>
                                    <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-clinic-cta">
                                        <ClinicIcon name="MapPin" size={12} />
                                        <span>{doctorInfo.room}</span>
                                    </span>
                                </div>
                            </div>
                        </button>

                        <div className="p-3 bg-clinic-bg mx-3 my-2 rounded-[6px] border border-clinic-border space-y-2 text-xs">
                            <div className="flex justify-between items-center text-clinic-text-secondary">
                                <span>Ca hiện tại:</span>
                                <span className="font-semibold text-clinic-navy tabular-nums">{doctorInfo.shift}</span>
                            </div>
                            <div className="flex justify-between items-center text-clinic-text-secondary">
                                <span>Đã khám hôm nay:</span>
                                <span className="medpro-badge-success font-bold tabular-nums">
                                    {doctorInfo.examinedToday} bệnh nhân
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-clinic-border">
                                <span className="text-clinic-text-secondary">Trạng thái nhận bệnh:</span>
                                <button
                                    type="button"
                                    onClick={toggleDutyStatus}
                                    className={`text-[11px] font-bold px-2.5 py-1 rounded-[6px] border transition cursor-pointer ${
                                        isOnDuty
                                            ? 'bg-clinic-success-bg text-clinic-success border-clinic-success-border'
                                            : 'bg-clinic-warning-bg text-clinic-warning border-clinic-warning-border'
                                    }`}
                                >
                                    {isOnDuty ? 'Đang nhận bệnh' : 'Tạm nghỉ'}
                                </button>
                            </div>
                        </div>

                        <div className="px-2 py-1 space-y-0.5 text-xs font-semibold">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMenuOpen(false)
                                    setIsEditProfileOpen(true)
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-clinic-text hover:bg-clinic-surface-tint hover:text-clinic-cta transition cursor-pointer"
                            >
                                <ClinicIcon name="PencilSimple" size={15} />
                                <span>Chỉnh sửa hồ sơ cá nhân</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsMenuOpen(false)
                                    setIsCertificateOpen(true)
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-clinic-text hover:bg-clinic-warning-bg hover:text-clinic-warning transition cursor-pointer"
                            >
                                <ClinicIcon name="Certificate" size={15} />
                                <span>Chứng chỉ hành nghề &amp; Bằng cấp</span>
                            </button>
                        </div>

                        <div className="p-2 pt-2 border-t border-clinic-border">
                            <button
                                type="button"
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-[6px] bg-clinic-danger-bg text-clinic-danger hover:bg-clinic-danger-border/40 font-bold text-xs transition cursor-pointer border border-clinic-danger-border"
                            >
                                <ClinicIcon name="SignOut" size={15} weight="bold" />
                                <span>Đăng xuất phiên làm việc</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <DoctorEditProfileModal
                isOpen={isEditProfileOpen}
                onClose={() => setIsEditProfileOpen(false)}
                currentInfo={doctorInfo}
                onSave={handleSaveProfile}
            />

            <DoctorCertificateModal
                isOpen={isCertificateOpen}
                onClose={() => setIsCertificateOpen(false)}
                doctorInfo={doctorInfo}
            />
        </>
    )
}
