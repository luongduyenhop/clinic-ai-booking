import { useFormik } from 'formik'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { AppToast } from '../../components/common/AppNotification'
import { loginUserAsync } from '../../redux/actions/user/authAction'
import { Hospital, LockKey, PhoneCall, ShieldCheck } from '../../components/common/ClinicIcon'
import { buildPatientLoginCredentials, patientLoginValidationSchema } from '../../utils/auth/patientLoginValidation'

const PORTAL_HIGHLIGHTS = [
    'Quản lý mã hẹn và lịch sử khám ngoại trú',
    'Tra cứu đơn thuốc điện tử và kết quả xét nghiệm',
    'Hồ sơ bệnh án điện tử bảo mật cho cá nhân và gia đình',
]

export default function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const dispatch = useDispatch()
    const { authError } = useSelector((state) => state.app.auth)

    const formik = useFormik({
        initialValues: { usernameOrEmail: '', password: '' },
        validationSchema: patientLoginValidationSchema,
        onSubmit: async (values) => {
            const result = await dispatch(
                loginUserAsync(buildPatientLoginCredentials(values))
            )
            if (loginUserAsync.fulfilled.match(result)) {
                AppToast.success('Đã đăng nhập')
                const target = location.state?.from?.pathname || '/benh-nhan'
                navigate(target, { replace: true })
            }
        },
    })

    return (
        <AuthShell
            title="Đăng nhập"
            description="Đăng nhập để đặt lịch khám, tra cứu đơn thuốc điện tử và theo dõi kết quả cận lâm sàng."
        >
            <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
                <Field
                    label="Số điện thoại hoặc email"
                    name="usernameOrEmail"
                    type="text"
                    placeholder={import.meta.env.VITE_DEMO_MODE === 'true' ? 'patient01@clinic-ai.test' : 'Số điện thoại hoặc email'}
                    autoComplete="username"
                    formik={formik}
                    icon={<PhoneCall size={18} />}
                />
                <Field
                    label="Mật khẩu"
                    name="password"
                    type="password"
                    placeholder="Nhập mật khẩu"
                    autoComplete="current-password"
                    formik={formik}
                    icon={<LockKey size={18} />}
                />

                <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-clinic-text-secondary cursor-pointer">
                        <input type="checkbox" /> Ghi nhớ đăng nhập
                    </label>
                    <button type="button" className="font-bold text-clinic-cta hover:underline cursor-pointer">
                        Quên mật khẩu?
                    </button>
                </div>

                {authError && (
                    <p role="alert" className="rounded-[8px] border border-clinic-danger-border bg-clinic-danger-bg p-3 text-xs text-clinic-danger">
                        {authError}
                    </p>
                )}

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={formik.isSubmitting}
                        className="medpro-btn-primary w-full min-h-11 !text-sm font-bold cursor-pointer"
                    >
                        {formik.isSubmitting ? 'Đang xác thực...' : 'Đăng nhập'}
                    </button>
                </div>

                {import.meta.env.VITE_DEMO_MODE === 'true' ? (
                    <p className="text-center text-sm text-clinic-text-secondary pt-2">
                        Dùng tài khoản demo do người tổ chức cung cấp.
                    </p>
                ) : (
                    <p className="text-center text-sm text-clinic-text-secondary pt-2">
                        Chưa có tài khoản khám bệnh?{' '}
                        <Link to="/register" className="font-bold text-clinic-cta hover:underline">
                            Đăng ký ngay
                        </Link>
                    </p>
                )}

                <div className="mt-6 pt-4 border-t border-clinic-border text-center">
                    <p className="text-xs text-clinic-text-muted mb-2">
                        Bạn là Bác sĩ, Lễ tân, Thu ngân, KTV hoặc Ban Quản trị?
                    </p>
                    <Link
                        to="/staff/login"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-clinic-navy-dark hover:bg-clinic-navy text-clinic-surface text-xs font-bold transition-colors"
                    >
                        <LockKey size={14} weight="bold" />
                        <span>Truy cập Hệ thống Nhân viên Y tế (HIS)</span>
                    </Link>
                </div>
            </form>
        </AuthShell>
    )
}

export function AuthShell({ title, description, children }) {
    return (
        <div className="min-h-[calc(100vh-102px)] bg-clinic-bg py-10 px-4 flex items-center justify-center">
            <div className="w-full max-w-[980px] grid lg:grid-cols-[.9fr_1.1fr] medpro-card overflow-hidden">
                <div className="hidden lg:flex bg-clinic-navy p-10 text-clinic-surface flex-col justify-between">
                    <div>
                        <Link to="/" className="inline-flex items-center gap-2.5 font-display font-extrabold text-xl text-clinic-surface">
                            <span className="w-10 h-10 rounded-[8px] bg-clinic-navy-dark border border-[color:var(--clinic-nav-divider)] flex items-center justify-center text-clinic-surface">
                                <Hospital size={20} weight="fill" />
                            </span>
                            <span>CLINIC-AI</span>
                        </Link>
                        <h2 className="mt-12 font-display text-2xl font-extrabold leading-snug text-clinic-surface">
                            Lịch hẹn và hồ sơ khám của bạn
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-clinic-on-navy-muted">
                            Theo dõi toàn bộ phiếu hẹn, kết quả xét nghiệm cận lâm sàng và đơn thuốc điện tử trên một tài khoản định danh duy nhất.
                        </p>
                    </div>

                    <div className="space-y-3 text-sm text-clinic-on-navy-muted">
                        {PORTAL_HIGHLIGHTS.map((item) => (
                            <p key={item} className="flex items-center gap-2.5">
                                <ShieldCheck size={17} weight="fill" className="text-clinic-info-border shrink-0" />
                                <span>{item}</span>
                            </p>
                        ))}
                        <div className="pt-4 mt-4 border-t border-[color:var(--clinic-nav-divider)] text-xs text-clinic-on-navy-muted tabular-nums">
                            Giờ tiếp nhận: 07:30 – 17:30 (Thứ 2 – Thứ 7)
                        </div>
                    </div>
                </div>

                <div className="p-6 sm:p-10 lg:p-11">
                    <div className="mb-7">
                        <span className="lg:hidden inline-flex w-10 h-10 rounded-[8px] bg-clinic-navy text-clinic-surface items-center justify-center mb-4">
                            <Hospital size={20} weight="fill" />
                        </span>
                        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-clinic-navy">{title}</h1>
                        <p className="mt-2 text-sm text-clinic-text-secondary">{description}</p>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    )
}

function Field({ label, name, type, placeholder, autoComplete, formik, icon }) {
    const error = formik.touched[name] && formik.errors[name]
    return (
        <div>
            <label className="medpro-label !text-sm !mb-2" htmlFor={name}>
                {label}
            </label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-clinic-text-muted">{icon}</span>
                <input
                    id={name}
                    name={name}
                    type={type}
                    value={formik.values[name]}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    className="medpro-input !pl-10 min-h-11"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${name}-error` : undefined}
                />
            </div>
            {error && <p id={`${name}-error`} className="mt-1.5 text-xs text-clinic-danger">{error}</p>}
        </div>
    )
}
