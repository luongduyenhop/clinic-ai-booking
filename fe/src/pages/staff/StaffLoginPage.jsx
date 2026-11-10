import { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { AppToast } from '../../components/common/AppNotification'
import { setAuth } from '../../redux/slices/authSlice'
import { getRoleDefaultPath } from '../../utils/constants/System'
import { authService } from '../../services/user/AuthService'
import {
    Hospital,
    ShieldCheck,
    Stethoscope,
    IdentificationCard,
    Microscope,
    Receipt,
    Pill,
} from '../../components/common/ClinicIcon'

const STAFF_ACCOUNTS = [
    {
        roleKey: 'ADMIN',
        role: 'ADMIN',
        label: 'Quản trị viên (Admin)',
        desc: 'Ban điều hành, phân quyền, danh mục',
        creds: { email: 'admin@clinic.com', mat_khau: 'Admin@123456' },
        profile: {
            id: 'USER_ADMIN_01',
            fullName: 'Quản Trị Viên Hệ Thống',
            shortName: 'Admin',
            role: 'ADMIN',
            email: 'admin@clinic.com',
            department: 'Ban Giám Đốc',
        },
        defaultPath: '/admin',
        color: 'from-amber-500 to-amber-700',
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: ShieldCheck,
    },
    {
        roleKey: 'DOCTOR',
        role: 'BAC_SI',
        label: 'Bác sĩ Khám bệnh (Khoa Nội tổng quát)',
        desc: 'PGS.TS Phạm Đức Minh · Phòng 101 Nội tổng quát',
        creds: { email: 'minh.doctor@clinic.com', mat_khau: 'Doctor@123456' },
        profile: {
            id: 'USER_DOC_01',
            fullName: 'PGS.TS Phạm Đức Minh',
            shortName: 'BS. Minh',
            role: 'BAC_SI',
            email: 'minh.doctor@clinic.com',
            department: 'Khoa Nội tổng quát',
            specialty: 'Khoa Nội tổng quát',
            chuyen_khoa_ma: 'KHOA_NOI',
            room: 'Phòng 101',
            cchn: '001234/BYT-CCHN',
        },
        defaultPath: '/doctor',
        color: 'from-sky-500 to-sky-700',
        badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
        icon: Stethoscope,
    },
    {
        roleKey: 'RECEPTIONIST',
        role: 'LE_TAN',
        label: 'Lễ tân – Thu ngân',
        desc: 'Nguyễn Thị Thu Cúc · Tiếp đón, Điều phối Hàng đợi & Thu viện phí VietQR',
        creds: { email: 'letan@clinic.com', mat_khau: 'LeTan@123456' },
        profile: {
            id: 'USER_RECEPTION_01',
            fullName: 'Nguyễn Thị Thu Cúc',
            shortName: 'Lễ tân – Thu ngân Cúc',
            role: 'LE_TAN',
            email: 'letan@clinic.com',
            department: 'Quầy Tiếp Đón & Thu Ngân Viện Phí',
        },
        defaultPath: '/reception/dashboard',
        color: 'from-teal-500 to-emerald-700',
        badgeBg: 'bg-teal-100 text-teal-800 border-teal-200',
        icon: IdentificationCard,
    },
    {
        roleKey: 'LAB_TECH',
        role: 'KY_THUAT_VIEN',
        label: 'KTV Cận lâm sàng & Xét nghiệm LIS',
        desc: 'CN. Hoàng Thị Yến · Phòng Lab Huyết học & Chẩn đoán hình ảnh',
        creds: { email: 'ktv@clinic.com', mat_khau: 'Ktv@123456' },
        profile: {
            id: 'USER_LAB_01',
            fullName: 'CN. Hoàng Thị Yến',
            shortName: 'KTV. Yến LIS',
            role: 'KY_THUAT_VIEN',
            email: 'ktv@clinic.com',
            department: 'Khoa Xét Nghiệm & Cận Lâm Sàng',
        },
        defaultPath: '/staff/paraclinical-work?nhom=XET_NGHIEM',
        color: 'from-indigo-500 to-indigo-700',
        badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        icon: Microscope,
    },
    {
        roleKey: 'CASHIER',
        role: 'ADMIN',
        label: 'Thu ngân – Viện phí VietQR',
        desc: 'Lê Thị Mai · Bảng kê viện phí, phát hành VietQR Napas 247 & gạch nợ',
        creds: { email: 'thungan@clinic.com', mat_khau: 'Cashier@2026' },
        profile: {
            id: 'USER_CASHIER_01',
            fullName: 'Thu Ngân Lê Thị Mai',
            shortName: 'Thu Ngân Mai',
            role: 'ADMIN',
            email: 'thungan@clinic.com',
            department: 'Quầy Thu Ngân Viện Phí',
        },
        defaultPath: '/admin/thu-ngan-vietqr',
        color: 'from-amber-600 to-yellow-700',
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: Receipt,
    },
    {
        roleKey: 'PHARMACIST',
        role: 'ADMIN',
        label: 'Dược sĩ – Quầy thuốc FEFO',
        desc: 'Trần Văn Tuấn · Quản lý lô hạn dùng & xuất kho FEFO khóa chống đua',
        creds: { email: 'duocsi@clinic.com', mat_khau: 'Pharmacist@2026' },
        profile: {
            id: 'USER_PHARMACIST_01',
            fullName: 'Dược Sĩ Trần Văn Tuấn',
            shortName: 'Dược Sĩ Tuấn',
            role: 'ADMIN',
            email: 'duocsi@clinic.com',
            department: 'Quầy Dược & Kho Ngoại Trú',
        },
        defaultPath: '/admin/kho-duoc-fefo',
        color: 'from-emerald-600 to-green-800',
        badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        icon: Pill,
    },
]

const clearStaleSessionStorage = () => {
    try {
        localStorage.removeItem('CLINIC_AI_DOCTOR_WORKSPACE_V1')
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('role')
        localStorage.removeItem('portal_auth')
    } catch {
    }
}

export default function StaffLoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const dispatch = useDispatch()
    const [submittingRole, setSubmittingRole] = useState(null)

    const handleQuickStaffLogin = async (staffConfig) => {
        setSubmittingRole(staffConfig.roleKey)
        try {
            const res = await authService.login(staffConfig.creds)
            const data = res?.data?.data || res?.data || {}
            const accessToken = data.access_token || data.accessToken
            const refreshToken = data.refresh_token || data.refreshToken
            if (!accessToken) {
                throw new Error('Máy chủ không trả về mã xác thực phiên')
            }
            const userProfile = { ...staffConfig.profile, ...(data.user || {}), role: staffConfig.role }

            clearStaleSessionStorage()

            dispatch(
                setAuth({
                    accessToken,
                    refreshToken,
                    role: staffConfig.role,
                    user: userProfile,
                })
            )

            AppToast.success(`Đăng nhập thành công với vai trò: ${staffConfig.label}!`)
            const targetPath = location.state?.from?.pathname || staffConfig.defaultPath
            navigate(targetPath, { replace: true })
        } catch (err) {
            AppToast.error(err?.response?.data?.message || err?.message || 'Đăng nhập ca trực thất bại')
        } finally {
            setSubmittingRole(null)
        }
    }

    const formik = useFormik({
        initialValues: { email: '', password: '' },
        validationSchema: Yup.object({
            email: Yup.string().required('Vui lòng nhập Email hoặc tên đăng nhập cán bộ y tế'),
            password: Yup.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').required('Vui lòng nhập mật khẩu'),
        }),
        onSubmit: async (values, { setSubmitting, setStatus }) => {
            try {
                const res = await authService.login({ email: values.email, mat_khau: values.password })
                const data = res?.data?.data || res?.data || {}
                const token = data.access_token || data.accessToken
                const rawRole = String(data.role || data.vai_tro || 'ADMIN').toUpperCase()
                const role = rawRole === 'THU_NGAN' || rawRole === 'CASHIER' ? 'LE_TAN' : rawRole
                const user = data.user || { email: values.email, fullName: values.email, role }

                clearStaleSessionStorage()

                dispatch(
                    setAuth({
                        accessToken: token,
                        refreshToken: data.refresh_token || data.refreshToken,
                        role,
                        user,
                    })
                )

                AppToast.success(`Chào mừng ${user.fullName || 'Cán bộ Y tế'} quay trở lại ca trực!`)
                const target = location.state?.from?.pathname || getRoleDefaultPath(role)
                navigate(target, { replace: true })
            } catch (err) {
                const msg = err.response?.data?.message || err.message || 'Tài khoản hoặc mật khẩu không chính xác'
                setStatus(msg)
                AppToast.error(msg)
            } finally {
                setSubmitting(false)
            }
        },
    })

    return (
        <div className="min-h-screen bg-[#001D2D] text-slate-100 flex flex-col justify-between selection:bg-[#00B5F1]/30">
            <header className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-[#00263C]">
                <Link to="/" className="flex items-center gap-2.5 group">
                    <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00B5F1] to-[#007EA7] text-white flex items-center justify-center font-bold text-lg shadow-md">
                        <Hospital size={20} weight="fill" />
                    </span>
                    <div>
                        <span className="font-display font-extrabold text-base tracking-tight text-white block leading-tight">
                            CLINIC<span className="text-[#00B5F1]">-AI</span> HIS
                        </span>
                        <span className="text-[10px] font-bold text-sky-200/70 uppercase tracking-widest block">
                            Cổng Cán Bộ & Nhân Viên Y Tế
                        </span>
                    </div>
                </Link>

                <div className="flex items-center gap-3 text-xs">
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Cổng Nội Bộ Bảo Mật
                    </span>
                    <Link
                        to="/login"
                        className="px-3.5 py-1.5 rounded-lg text-sky-200 hover:text-white hover:bg-white/10 transition font-bold"
                    >
                        🏠 Cổng Bệnh Nhân
                    </Link>
                </div>
            </header>

            <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-12 grid lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 bg-[#002A42] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#00B5F1]/15 text-[#00B5F1] text-[11px] font-bold uppercase tracking-wider mb-2 border border-[#00B5F1]/30">
                            <ShieldCheck size={14} weight="bold" />
                            <span>Xác thực Phân Quyền HIS</span>
                        </div>
                        <h1 className="text-2xl font-display font-extrabold text-white">Đăng Nhập Ca Trực</h1>
                        <p className="text-xs text-sky-200/70 mt-1">
                            Sử dụng tài khoản email nội bộ do phòng khám cấp để truy cập phân hệ làm việc.
                        </p>
                    </div>

                    {formik.status && (
                        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                            {formik.status}
                        </div>
                    )}

                    <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
                        <div>
                            <label className="block text-xs font-bold text-sky-100 mb-1.5">
                                Email / Tên đăng nhập Cán bộ
                            </label>
                            <input
                                type="email"
                                name="email"
                                placeholder="minh.doctor@clinic.com hoặc letan@clinic.com"
                                value={formik.values.email}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                className="w-full h-11 px-3.5 rounded-xl bg-[#001D2D] border border-white/20 text-white placeholder-slate-500 text-xs font-medium focus:border-[#00B5F1] focus:outline-none transition"
                            />
                            {formik.touched.email && formik.errors.email && (
                                <p className="text-rose-400 text-[11px] mt-1">{formik.errors.email}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-sky-100 mb-1.5">Mật khẩu nghiệp vụ</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    name="password"
                                    placeholder="••••••••"
                                    value={formik.values.password}
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    className="w-full h-11 px-3.5 rounded-xl bg-[#001D2D] border border-white/20 text-white placeholder-slate-500 text-xs font-medium focus:border-[#00B5F1] focus:outline-none transition"
                                />
                            </div>
                            {formik.touched.password && formik.errors.password && (
                                <p className="text-rose-400 text-[11px] mt-1">{formik.errors.password}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-sky-200/80">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="rounded border-white/20 text-[#00B5F1]" />
                                <span>Ghi nhớ phiên làm việc</span>
                            </label>
                            <span className="text-[11px] text-slate-400">Quên mật khẩu? Báo Admin</span>
                        </div>

                        <button
                            type="submit"
                            disabled={formik.isSubmitting}
                            className="w-full h-11 rounded-xl bg-[#00B5F1] hover:bg-[#009EDB] text-[#00263C] font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-sky-500/20 cursor-pointer disabled:opacity-50"
                        >
                            {formik.isSubmitting ? 'Đang xác thực...' : 'Vào Ca Trực HIS'}
                        </button>
                    </form>

                    <div className="p-3.5 rounded-2xl bg-[#001D2D]/90 border border-white/10 text-[11px] text-sky-200/80 leading-relaxed space-y-1">
                        <div className="font-bold text-amber-300 flex items-center gap-1.5">
                            <span>🔒 Quy định an ninh dữ liệu y tế</span>
                        </div>
                        <p>
                            Tài khoản nhân viên chỉ do <strong>Quản trị viên phòng khám</strong> cấp và phân quyền.
                            Hệ thống <strong>không hỗ trợ tự đăng ký tự do</strong> nhằm đảm bảo an toàn thông tin bệnh
                            án điện tử và tuân thủ Thông tư 32/2023/TT-BYT.
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-7 space-y-4">
                    <div className="border-b border-white/10 pb-3">
                        <span className="text-xs font-bold text-[#00B5F1] uppercase tracking-wider block">
                            Truy cập nhanh theo phân hệ
                        </span>
                        <h2 className="text-xl font-display font-extrabold text-white mt-1">
                            Chọn Ca Trực Chuyên Môn Để Đăng Nhập Ngay
                        </h2>
                        <p className="text-xs text-sky-200/70 mt-1">
                            Bấm vào vai trò của bạn để tự động nạp thông tin xác thực và chuyển thẳng đến không gian làm
                            việc:
                        </p>
                    </div>

                    <div className="grid gap-2.5">
                        {STAFF_ACCOUNTS.map((staff) => {
                            const IconComponent = staff.icon
                            const isCurrent = submittingRole === staff.roleKey
                            return (
                                <button
                                    key={staff.roleKey}
                                    type="button"
                                    onClick={() => handleQuickStaffLogin(staff)}
                                    disabled={Boolean(submittingRole)}
                                    className="w-full text-left p-3.5 rounded-2xl bg-[#00263C] hover:bg-[#003553] border border-white/10 hover:border-[#00B5F1]/50 transition duration-150 flex items-center justify-between gap-4 group cursor-pointer disabled:opacity-50"
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div
                                            className={`w-11 h-11 rounded-xl bg-gradient-to-br ${staff.color} text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform`}
                                        >
                                            <IconComponent size={22} weight="bold" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-bold text-white group-hover:text-[#00B5F1] transition">
                                                    {staff.label}
                                                </h3>
                                                <span
                                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${staff.badgeBg}`}
                                                >
                                                    {staff.role}
                                                </span>
                                            </div>
                                            <p className="text-xs text-sky-200/60 truncate mt-0.5">{staff.desc}</p>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#00B5F1] group-hover:translate-x-1 transition-transform">
                                            {isCurrent ? 'Đang vào...' : 'Vào ca →'}
                                        </span>
                                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                                            {staff.creds.email}
                                        </span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs text-slate-300">
                        <span>Bạn đang cần tra cứu lịch khám cá nhân của bệnh nhân?</span>
                        <Link
                            to="/login"
                            className="font-bold text-[#00B5F1] hover:underline flex items-center gap-1"
                        >
                            Chuyển sang Cổng Bệnh Nhân ↗
                        </Link>
                    </div>
                </div>
            </main>

            <footer className="h-12 border-t border-white/10 px-6 flex items-center justify-between text-[11px] text-slate-400 bg-[#001824]">
                <span>© {new Date().getFullYear()} Clinic-AI HIS. Nền tảng điều hành phòng khám đa khoa.</span>
                <span>Tiêu chuẩn Thông tư 32/2023/TT-BYT & QCVN Y Tế</span>
            </footer>
        </div>
    )
}
