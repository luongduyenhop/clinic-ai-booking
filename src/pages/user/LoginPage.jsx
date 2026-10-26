import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { AppToast } from '../../components/common/AppNotification'
import { loginUserAsync } from '../../redux/actions/user/authAction'
import { setAuth } from '../../redux/slices/authSlice'
import { Hospital, LockKey, PhoneCall, ShieldCheck, UserCheck } from '../../components/common/ClinicIcon'
import { DEMO_PATIENT_ACCOUNT } from '../../data/user/demoPatientAccount'
import { authService } from '../../services/user/AuthService'

export default function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const dispatch = useDispatch()
    const { authError } = useSelector((state) => state.app.auth)

    const handlePatientQuickLogin = async () => {
        let accessToken = 'token-patient'
        let refreshToken = 'refresh-patient'
        const userProfile = {
            id: 'USER_PATIENT_01',
            fullName: DEMO_PATIENT_ACCOUNT.fullName || 'Nguyễn Thị Bệnh Nhân',
            shortName: 'Bệnh nhân',
            role: 'BENH_NHAN',
            phone: DEMO_PATIENT_ACCOUNT.phone,
            email: 'patient@test.com',
        }

        try {
            const res = await authService.login({
                email: 'patient@test.com',
                mat_khau: 'Patient@123456',
            })
            const data = res?.data?.data || res?.data || {}
            if (data.access_token || data.accessToken) {
                accessToken = data.access_token || data.accessToken
                refreshToken = data.refresh_token || data.refreshToken || refreshToken
            }
        } catch {
            // Fallback token dự phòng
        }

        dispatch(
            setAuth({
                accessToken,
                refreshToken,
                role: 'BENH_NHAN',
                user: userProfile,
            })
        )
        AppToast.success('Đăng nhập thành công vào Cổng Bệnh Nhân!')
        const target = location.state?.from?.pathname || '/benh-nhan'
        navigate(target, { replace: true })
    }

    const formik = useFormik({
        initialValues: { phone: '', password: '' },
        validationSchema: Yup.object({
            phone: Yup.string()
                .matches(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0')
                .required('Vui lòng nhập số điện thoại'),
            password: Yup.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').required('Vui lòng nhập mật khẩu'),
        }),
        onSubmit: async (values) => {
            const result = await dispatch(
                loginUserAsync({ usernameOrEmail: values.phone, password: values.password })
            )
            if (loginUserAsync.fulfilled.match(result)) {
                AppToast.success('Đăng nhập Cổng Bệnh Nhân thành công!')
                const target = location.state?.from?.pathname || '/benh-nhan'
                navigate(target, { replace: true })
            }
        },
    })

    return (
        <AuthShell
            title="Cổng Bệnh Nhân — Đăng Nhập"
            description="Đăng nhập để đặt lịch khám, tra cứu đơn thuốc điện tử và theo dõi kết quả cận lâm sàng."
        >
            <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
                <Field
                    label="Số điện thoại đăng ký"
                    name="phone"
                    type="tel"
                    placeholder="0901 234 567"
                    formik={formik}
                    icon={<PhoneCall size={18} />}
                />
                <Field
                    label="Mật khẩu"
                    name="password"
                    type="password"
                    placeholder="Nhập mật khẩu"
                    formik={formik}
                    icon={<LockKey size={18} />}
                />

                <div className="rounded-2xl border border-[#B8E5FA] bg-[#E8F4FD] p-3.5 text-xs leading-5 text-[#36566B] space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-[#003553]">Tài khoản bệnh nhân mẫu</span>
                        <button
                            type="button"
                            onClick={() => {
                                formik.setFieldValue('phone', DEMO_PATIENT_ACCOUNT.phone)
                                formik.setFieldValue('password', DEMO_PATIENT_ACCOUNT.password)
                            }}
                            className="text-[#008EC2] hover:underline font-bold text-[11px] cursor-pointer"
                        >
                            Tự động điền ✎
                        </button>
                    </div>
                    <p>
                        Số điện thoại: <strong>{DEMO_PATIENT_ACCOUNT.phone}</strong>
                    </p>
                    <p>
                        Mật khẩu: <strong>{DEMO_PATIENT_ACCOUNT.password}</strong>
                    </p>
                </div>

                <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                        <input type="checkbox" className="rounded text-[#00B5F1]" /> Ghi nhớ đăng nhập
                    </label>
                    <button type="button" className="font-bold text-[#008EC2] hover:underline cursor-pointer">
                        Quên mật khẩu?
                    </button>
                </div>

                {authError && (
                    <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                        {authError}
                    </p>
                )}

                <div className="space-y-2.5 pt-1">
                    <button
                        type="submit"
                        disabled={formik.isSubmitting}
                        className="medpro-btn-primary w-full min-h-12 !text-sm font-bold cursor-pointer"
                    >
                        {formik.isSubmitting ? 'Đang xác thực...' : 'Đăng Nhập'}
                    </button>

                    <button
                        type="button"
                        onClick={handlePatientQuickLogin}
                        className="w-full min-h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#003553] font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
                    >
                        <UserCheck size={16} weight="bold" className="text-[#00B5F1]" />
                        <span>Đăng nhập nhanh Bệnh nhân (Không cần gõ mật khẩu)</span>
                    </button>
                </div>

                <p className="text-center text-sm text-slate-500 pt-2">
                    Chưa có tài khoản khám bệnh?{' '}
                    <Link to="/register" className="font-bold text-[#008EC2] hover:underline">
                        Đăng ký ngay
                    </Link>
                </p>

                {/* Phân tách cổng nhân viên rõ ràng */}
                <div className="mt-6 pt-4 border-t border-slate-200/80 text-center">
                    <p className="text-xs text-slate-500 mb-1.5">
                        Bạn là Bác sĩ, Lễ tân, Thu ngân, KTV hoặc Ban Quản trị?
                    </p>
                    <Link
                        to="/staff/login"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00263C] hover:bg-[#003553] text-white text-xs font-bold transition shadow-xs"
                    >
                        <span>🔒 Đăng nhập Cổng Nhân Viên Y Tế (HIS)</span>
                        <span>→</span>
                    </Link>
                </div>
            </form>
        </AuthShell>
    )
}

export function AuthShell({ title, description, children }) {
    return (
        <div className="min-h-[calc(100vh-72px)] bg-[#F7FBFE] py-10 px-4 flex items-center justify-center">
            <div className="w-full max-w-[980px] grid lg:grid-cols-[.9fr_1.1fr] medpro-card overflow-hidden shadow-lg border border-[#E2EDF5]">
                <div className="hidden lg:flex bg-[#003553] p-10 text-white flex-col justify-between">
                    <div>
                        <Link to="/" className="inline-flex items-center gap-2 font-display font-extrabold text-xl">
                            <span className="w-10 h-10 rounded-xl bg-[#00B5F1] flex items-center justify-center text-white">
                                <Hospital size={21} weight="fill" />
                            </span>
                            CLINIC-AI
                        </Link>
                        <h2 className="mt-16 font-display text-3xl font-extrabold leading-tight">
                            Chủ động lịch khám.
                            <br />
                            An tâm chăm sóc.
                        </h2>
                        <p className="mt-4 text-sm leading-6 text-sky-100/80">
                            Đặt lịch nhanh chóng, nhận thông báo kịp thời và quản lý thông tin khám bệnh trên một nền tảng.
                        </p>
                    </div>
                    <div className="space-y-3 text-sm text-sky-50">
                        {['Thông tin được bảo mật', 'Đội ngũ bác sĩ xác thực', 'Hỗ trợ đặt lịch 24/7'].map((item) => (
                            <p key={item} className="flex items-center gap-2">
                                <ShieldCheck size={18} weight="fill" className="text-[#00B5F1]" />
                                {item}
                            </p>
                        ))}
                    </div>
                </div>
                <div className="p-6 sm:p-10 lg:p-12">
                    <div className="mb-8">
                        <span className="lg:hidden inline-flex w-11 h-11 rounded-xl bg-[#00B5F1] text-white items-center justify-center mb-5">
                            <Hospital size={22} weight="fill" />
                        </span>
                        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#003553]">{title}</h1>
                        <p className="mt-2 text-sm text-slate-500">{description}</p>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    )
}

function Field({ label, name, type, placeholder, formik, icon }) {
    const error = formik.touched[name] && formik.errors[name]
    return (
        <div>
            <label className="medpro-label !text-sm !mb-2" htmlFor={name}>
                {label}
            </label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
                <input
                    id={name}
                    name={name}
                    type={type}
                    value={formik.values[name]}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder={placeholder}
                    className="medpro-input !pl-10 min-h-12"
                    aria-invalid={Boolean(error)}
                />
            </div>
            {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
        </div>
    )
}
