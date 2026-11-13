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
    LockKey,
} from '../../components/common/ClinicIcon'

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
                                placeholder="bacsi@clinic-ai.vn hoặc canboyte@clinic-ai.vn"
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
                            Hệ thống Phân quyền HIS
                        </span>
                        <h2 className="text-xl font-display font-extrabold text-white mt-1">
                            Tiêu Chuẩn Xác Thực Nghiệp Vụ Y Tế
                        </h2>
                        <p className="text-xs text-sky-200/70 mt-1">
                            Truy cập phân hệ dựa trên định danh cá nhân và chứng chỉ hành nghề đã được kiểm duyệt:
                        </p>
                    </div>

                    <div className="grid gap-3">
                        <div className="p-4 rounded-2xl bg-[#00263C] border border-white/10 flex items-start gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-[#00B5F1] flex items-center justify-center shrink-0">
                                <Stethoscope size={20} weight="bold" />
                            </div>
                            <div className="text-xs">
                                <h3 className="font-bold text-white text-sm">Phân hệ Lâm sàng & Bác sĩ</h3>
                                <p className="text-sky-200/70 mt-0.5 leading-relaxed">
                                    Thực hiện chẩn đoán, kê đơn thuốc điện tử liên thông Cổng Quốc gia và chỉ định cận lâm sàng.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#00263C] border border-white/10 flex items-start gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                                <IdentificationCard size={20} weight="bold" />
                            </div>
                            <div className="text-xs">
                                <h3 className="font-bold text-white text-sm">Tiếp đón, Điều phối & Viện phí</h3>
                                <p className="text-sky-200/70 mt-0.5 leading-relaxed">
                                    Tiếp nhận người bệnh, điều phối hàng đợi thông minh và xử lý thanh toán viện phí VietQR Napas 247.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#00263C] border border-white/10 flex items-start gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                                <LockKey size={20} weight="bold" />
                            </div>
                            <div className="text-xs">
                                <h3 className="font-bold text-white text-sm">Bảo vệ Dữ liệu Bệnh án Điện tử</h3>
                                <p className="text-sky-200/70 mt-0.5 leading-relaxed">
                                    Mọi hành động truy xuất và chỉnh sửa hồ sơ bệnh án được kiểm toán tự động theo tiêu chuẩn an ninh y tế.
                                </p>
                            </div>
                        </div>
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
