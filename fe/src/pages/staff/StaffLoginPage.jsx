import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { AppToast } from '../../components/common/AppNotification'
import { setAuth } from '../../redux/slices/authSlice'
import { getRoleDefaultPath, isStaffRole } from '../../utils/constants/System'
import { authService } from '../../services/user/AuthService'
import { toFriendlyErrorMessage } from '../../utils/helpers/clientErrorHelper'
import {
    Hospital,
    LockKey,
    ShieldCheck,
} from '../../components/common/ClinicIcon'

const CURRENT_YEAR = new Date().getFullYear()

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
                const role = String(data.role || data.vai_tro || '').toUpperCase()
                if (!token || !isStaffRole(role)) {
                    throw new Error('Tài khoản này không có quyền truy cập cổng nhân viên.')
                }
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

                AppToast.success('Đã đăng nhập')
                const target = location.state?.from?.pathname || getRoleDefaultPath(role)
                navigate(target, { replace: true })
            } catch (err) {
                const msg = toFriendlyErrorMessage(err, 'Tài khoản hoặc mật khẩu không chính xác')
                setStatus(msg)
                AppToast.error(msg)
            } finally {
                setSubmitting(false)
            }
        },
    })

    return (
        <div className="min-h-screen bg-clinic-bg text-clinic-text flex flex-col justify-between">
            <header className="h-14 px-4 sm:px-6 border-b border-clinic-border bg-clinic-navy text-clinic-surface flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-[6px] bg-clinic-cta text-clinic-surface flex items-center justify-center shrink-0">
                        <Hospital size={18} weight="fill" />
                    </span>
                    <div>
                        <span className="font-display font-extrabold text-sm sm:text-base tracking-tight text-clinic-surface block leading-tight">
                            CLINIC-AI HIS
                        </span>
                        <span className="text-[11px] font-medium text-clinic-on-navy-muted block">
                            Cổng cán bộ và nhân viên y tế
                        </span>
                    </div>
                </Link>

                <div className="flex items-center gap-3 text-xs">
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-clinic-navy-dark text-clinic-on-navy-muted font-semibold">
                        <ShieldCheck size={14} weight="bold" />
                        <span>Cổng nội bộ bảo mật</span>
                    </span>
                    <Link
                        to="/login"
                        className="px-3 py-1.5 rounded-[6px] text-clinic-surface hover:bg-clinic-navy-dark font-bold transition-colors"
                    >
                        Cổng bệnh nhân
                    </Link>
                </div>
            </header>

            <main className="flex-1 w-full px-4 py-10 flex items-center justify-center">
                <div className="max-w-[440px] w-full mx-auto space-y-4">
                    <div className="text-center space-y-1">
                        <p className="text-xs font-semibold text-clinic-cta">
                            Phòng khám Đa khoa Clinic-AI — Hệ thống thông tin phòng khám
                        </p>
                        <h1 className="text-2xl font-display font-extrabold text-clinic-navy">
                            Đăng nhập nhân viên
                        </h1>
                        <p className="text-xs text-clinic-text-secondary">
                            Sử dụng tài khoản nội bộ được cấp để truy cập hệ thống làm việc.
                        </p>
                    </div>

                    <div className="medpro-card bg-clinic-surface p-6 rounded-[6px] border border-clinic-border space-y-4">
                        {formik.status && (
                            <div
                                role="alert"
                                className="p-3 rounded-[6px] bg-clinic-danger-bg border border-clinic-danger-border text-clinic-danger text-xs font-medium"
                            >
                                {formik.status}
                            </div>
                        )}

                        <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
                            <div>
                                <label
                                    htmlFor="staff-email"
                                    className="block text-xs font-bold text-clinic-navy mb-1.5"
                                >
                                    Email
                                </label>
                                <input
                                    id="staff-email"
                                    type="email"
                                    name="email"
                                    placeholder={
                                        import.meta.env.VITE_DEMO_MODE === 'true'
                                            ? 'doctor.demo@clinic-ai.test'
                                            : 'Nhập email nhân viên'
                                    }
                                    value={formik.values.email}
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    className="medpro-input rounded-[6px] text-xs"
                                />
                                {formik.touched.email && formik.errors.email && (
                                    <p className="text-clinic-danger text-[11px] mt-1">{formik.errors.email}</p>
                                )}
                            </div>

                            <div>
                                <label
                                    htmlFor="staff-password"
                                    className="block text-xs font-bold text-clinic-navy mb-1.5"
                                >
                                    Mật khẩu
                                </label>
                                <input
                                    id="staff-password"
                                    type="password"
                                    name="password"
                                    placeholder="Nhập mật khẩu"
                                    value={formik.values.password}
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    className="medpro-input rounded-[6px] text-xs"
                                />
                                {formik.touched.password && formik.errors.password && (
                                    <p className="text-clinic-danger text-[11px] mt-1">
                                        {formik.errors.password}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center justify-between text-xs text-clinic-text-secondary">
                                <label htmlFor="staff-remember" className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        id="staff-remember"
                                        type="checkbox"
                                        className="rounded border-clinic-border-strong accent-clinic-cta"
                                    />
                                    <span>Ghi nhớ phiên làm việc</span>
                                </label>
                                <span className="text-[11px] text-clinic-text-muted">
                                    Quên mật khẩu? Báo Admin
                                </span>
                            </div>

                            <button
                                type="submit"
                                disabled={formik.isSubmitting}
                                className="medpro-btn-primary w-full min-h-11 rounded-[6px] text-xs font-bold cursor-pointer disabled:opacity-50"
                            >
                                {formik.isSubmitting ? 'Đang xác thực...' : 'Đăng nhập'}
                            </button>
                        </form>

                        <div className="pt-3 border-t border-clinic-border flex items-start gap-2 text-[11px] text-clinic-text-secondary leading-5">
                            <LockKey size={14} weight="bold" className="text-clinic-navy shrink-0 mt-0.5" />
                            <span>
                                Tài khoản nhân viên do quản trị viên phòng khám cấp phát theo vai trò chuyên môn.
                            </span>
                        </div>
                    </div>

                    <p className="text-center text-xs text-clinic-text-secondary tabular-nums">
                        Hỗ trợ cấp phát tài khoản và phân quyền: Tổ CNTT nội bộ · Tổng đài 1900 6868
                    </p>
                </div>
            </main>

            <footer className="h-12 border-t border-clinic-border px-4 sm:px-6 flex items-center justify-between text-[11px] text-clinic-text-muted bg-clinic-surface tabular-nums">
                <span>&copy; {CURRENT_YEAR} Clinic-AI HIS. Nền tảng điều hành phòng khám đa khoa.</span>
                <span>Phòng khám Đa khoa Clinic-AI</span>
            </footer>
        </div>
    )
}
