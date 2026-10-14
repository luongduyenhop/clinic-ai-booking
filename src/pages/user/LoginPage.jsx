import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { AppToast } from '../../components/common/AppNotification'
import { loginUserAsync } from '../../redux/actions/user/authAction'
import { Hospital, LockKey, PhoneCall, ShieldCheck } from '../../components/common/ClinicIcon'

export default function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const dispatch = useDispatch()
    const { authError } = useSelector((state) => state.app.auth)
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
                navigate(location.state?.from?.pathname || '/', { replace: true })
            }
        },
    })

    return <AuthShell title="Chào mừng bạn trở lại" description="Đăng nhập để quản lý lịch khám và hồ sơ sức khỏe.">
        <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
            <Field label="Số điện thoại" name="phone" type="tel" placeholder="0901 234 567" formik={formik} icon={<PhoneCall size={18} />} />
            <Field label="Mật khẩu" name="password" type="password" placeholder="Nhập mật khẩu" formik={formik} icon={<LockKey size={18} />} />
            <div className="flex items-center justify-between text-xs"><label className="flex items-center gap-2 text-slate-600"><input type="checkbox" /> Ghi nhớ đăng nhập</label><button type="button" className="font-bold text-[#008EC2]">Quên mật khẩu?</button></div>
            {authError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{authError}</p>}
            <button type="submit" disabled={formik.isSubmitting} className="medpro-btn-primary w-full min-h-12 !text-sm">{formik.isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
            <p className="text-center text-sm text-slate-500">Chưa có tài khoản? <Link to="/register" className="font-bold text-[#008EC2] hover:underline">Đăng ký ngay</Link></p>
        </form>
    </AuthShell>
}

export function AuthShell({ title, description, children }) {
    return <div className="min-h-[calc(100vh-72px)] bg-[#F7FBFE] py-10 px-4 flex items-center justify-center"><div className="w-full max-w-[980px] grid lg:grid-cols-[.9fr_1.1fr] medpro-card overflow-hidden"><div className="hidden lg:flex bg-[#003553] p-10 text-white flex-col justify-between"><div><Link to="/" className="inline-flex items-center gap-2 font-display font-extrabold text-xl"><span className="w-10 h-10 rounded-xl bg-[#00B5F1] flex items-center justify-center"><Hospital size={21} weight="fill" /></span>CLINIC-AI</Link><h2 className="mt-16 font-display text-3xl font-extrabold leading-tight">Chủ động lịch khám.<br />An tâm chăm sóc.</h2><p className="mt-4 text-sm leading-6 text-sky-100/80">Đặt lịch nhanh chóng, nhận thông báo kịp thời và quản lý thông tin khám bệnh trên một nền tảng.</p></div><div className="space-y-3 text-sm text-sky-50">{['Thông tin được bảo mật','Đội ngũ bác sĩ xác thực','Hỗ trợ đặt lịch 24/7'].map(item=><p key={item} className="flex items-center gap-2"><ShieldCheck size={18} weight="fill" className="text-[#00B5F1]" />{item}</p>)}</div></div><div className="p-6 sm:p-10 lg:p-12"><div className="mb-8"><span className="lg:hidden inline-flex w-11 h-11 rounded-xl bg-[#00B5F1] text-white items-center justify-center mb-5"><Hospital size={22} weight="fill" /></span><h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#003553]">{title}</h1><p className="mt-2 text-sm text-slate-500">{description}</p></div>{children}</div></div></div>
}

function Field({ label, name, type, placeholder, formik, icon }) {
    const error = formik.touched[name] && formik.errors[name]
    return <div><label className="medpro-label !text-sm !mb-2" htmlFor={name}>{label}</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span><input id={name} name={name} type={type} value={formik.values[name]} onChange={formik.handleChange} onBlur={formik.handleBlur} placeholder={placeholder} className="medpro-input !pl-10 min-h-12" aria-invalid={Boolean(error)} /></div>{error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}</div>
}
