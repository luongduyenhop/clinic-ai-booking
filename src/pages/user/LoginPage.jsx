import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { AppToast } from '../../components/common/AppNotification'
import { loginUserAsync } from '../../redux/actions/user/authAction'
import { setAuth } from '../../redux/slices/authSlice'
import { Hospital, LockKey, PhoneCall, ShieldCheck } from '../../components/common/ClinicIcon'
import { DEMO_PATIENT_ACCOUNT } from '../../data/user/demoPatientAccount'

export default function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const dispatch = useDispatch()
    const { authError } = useSelector((state) => state.app.auth)

    const handleRoleDemoLogin = (targetRole = 'ADMIN') => {
        let userProfile = {
            id: 'USER_ADMIN_01',
            fullName: 'Quản trị viên Hệ thống',
            shortName: 'Admin',
            role: 'QUAN_TRI',
            email: 'admin@clinic-ai.vn',
        }
        let redirectPath = '/admin'

        if (targetRole === 'RECEPTIONIST') {
            userProfile = {
                id: 'USER_RECEPTION_01',
                fullName: 'Nguyễn Thị Thu Cúc',
                shortName: 'Lễ tân Cúc',
                role: 'LE_TAN',
                email: 'letan@clinic-ai.vn',
            }
            redirectPath = '/reception/dashboard'
        } else if (targetRole === 'DOCTOR') {
            userProfile = {
                id: 'USER_DOC_01',
                fullName: 'BS. CKII Trần Quốc Huy',
                shortName: 'BS. Huy',
                role: 'BAC_SI',
                room: 'Phòng 102',
                specialty: 'Răng Hàm Mặt',
                email: 'bshuy@clinic-ai.vn',
            }
            redirectPath = '/doctor'
        } else if (targetRole === 'PATIENT') {
            userProfile = {
                id: 'USER_PATIENT_01',
                fullName: DEMO_PATIENT_ACCOUNT.fullName || 'Nguyễn Văn Minh',
                shortName: 'Văn Minh',
                role: 'BENH_NHAN',
                phone: DEMO_PATIENT_ACCOUNT.phone,
                email: DEMO_PATIENT_ACCOUNT.email || 'benhnhan@clinic-ai.vn',
            }
            redirectPath = '/benh-nhan'
        }

        dispatch(
            setAuth({
                accessToken: 'demo-access-token-' + targetRole.toLowerCase(),
                refreshToken: 'demo-refresh-token-' + targetRole.toLowerCase(),
                role: userProfile.role,
                user: userProfile,
            })
        )
        AppToast.success(`Đã đăng nhập vai trò: ${userProfile.shortName}!`)
        navigate(redirectPath, { replace: true })
    }

    const formik = useFormik({
        initialValues: { phone: '', password: '' },
        validationSchema: Yup.object({
            phone: Yup.string().matches(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0').required('Vui lòng nhập số điện thoại'),
            password: Yup.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').required('Vui lòng nhập mật khẩu'),
        }),
        onSubmit: async (values) => {
            const result = await dispatch(loginUserAsync({ usernameOrEmail: values.phone, password: values.password }))
            if (loginUserAsync.fulfilled.match(result)) {
                AppToast.success('Đăng nhập thành công')
                navigate(location.state?.from?.pathname || '/benh-nhan', { replace: true })
            }
        },
    })

    return (
        <AuthShell title="Chào mừng bạn trở lại" description="Đăng nhập để quản lý lịch khám và hồ sơ sức khỏe.">
            <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
                <Field label="Số điện thoại" name="phone" type="tel" placeholder="0901 234 567" formik={formik} icon={<PhoneCall size={18} />} />
                <Field label="Mật khẩu" name="password" type="password" placeholder="Nhập mật khẩu" formik={formik} icon={<LockKey size={18} />} />
                
                <div className="rounded-xl border border-[#B8E5FA] bg-[#E8F4FD] p-3 text-xs leading-5 text-[#36566B]">
                    <p className="font-bold text-[#003553]">Tài khoản bệnh nhân demo</p>
                    <p>Số điện thoại: <strong>{DEMO_PATIENT_ACCOUNT.phone}</strong></p>
                    <p>Mật khẩu: <strong>{DEMO_PATIENT_ACCOUNT.password}</strong></p>
                </div>

                <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-slate-600">
                        <input type="checkbox" className="rounded text-[#00B5F1]" /> Ghi nhớ đăng nhập
                    </label>
                    <button type="button" className="font-bold text-[#008EC2] hover:underline">
                        Quên mật khẩu?
                    </button>
                </div>

                {authError && (
                    <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                        {authError}
                    </p>
                )}

                <button type="submit" disabled={formik.isSubmitting} className="medpro-btn-primary w-full min-h-12 !text-sm font-bold">
                    {formik.isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </button>

                <div className="pt-3 border-t border-slate-100">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
                        Đăng nhập nhanh theo từng phân hệ (Role-Based Demo)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                            type="button"
                            onClick={() => handleRoleDemoLogin('ADMIN')}
                            className="px-2 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-[#003553] text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer"
                        >
                            <span>🏛️ Quản lý</span>
                            <span className="text-[10px] text-amber-700 font-semibold">Admin</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleRoleDemoLogin('RECEPTIONIST')}
                            className="px-2 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-900 text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer"
                        >
                            <span>👩‍💼 Lễ tân</span>
                            <span className="text-[10px] text-teal-700 font-semibold">Lễ tân</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleRoleDemoLogin('DOCTOR')}
                            className="px-2 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-900 text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer"
                        >
                            <span>👨‍⚕️ Bác sĩ</span>
                            <span className="text-[10px] text-sky-700 font-semibold">Bác sĩ</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleRoleDemoLogin('PATIENT')}
                            className="px-2 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer"
                        >
                            <span>🏠 Bệnh nhân</span>
                            <span className="text-[10px] text-indigo-700 font-semibold">Bệnh nhân</span>
                        </button>
                    </div>
                </div>

                <p className="text-center text-sm text-slate-500 pt-2">
                    Chưa có tài khoản?{' '}
                    <Link to="/register" className="font-bold text-[#008EC2] hover:underline">
                        Đăng ký ngay
                    </Link>
                </p>
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
                            Chủ động lịch khám.<br />An tâm chăm sóc.
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {icon}
                </span>
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
