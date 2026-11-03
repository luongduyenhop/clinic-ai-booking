import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { AppToast } from '../../components/common/AppNotification'
import { loginUserAsync } from '../../redux/actions/user/authAction'

export default function LoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { authError, isSubmitting } = useSelector(state => state.app.auth)
  const formik = useFormik({
    initialValues: { identifier: '', password: '' },
    validationSchema: Yup.object({
      identifier: Yup.string().trim().required('Nhập số điện thoại hoặc email'),
      password: Yup.string().required('Nhập mật khẩu'),
    }),
    onSubmit: async values => {
      const result = await dispatch(loginUserAsync({ usernameOrEmail: values.identifier.trim(), password: values.password }))
      if (loginUserAsync.fulfilled.match(result)) {
        AppToast.success('Đăng nhập thành công')
        navigate(location.state?.from?.pathname || '/benh-nhan', { replace: true })
      }
    },
  })
  return <AuthShell title="Cổng Bệnh Nhân — Đăng nhập" description="Đăng nhập bằng số điện thoại hoặc email đã đăng ký.">
    <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
      <label className="block text-sm font-semibold">Số điện thoại hoặc email<input className="medpro-input mt-1" name="identifier" value={formik.values.identifier} onChange={formik.handleChange} onBlur={formik.handleBlur} autoComplete="username"/></label>
      {formik.touched.identifier && formik.errors.identifier && <p className="text-rose-600 text-xs">{formik.errors.identifier}</p>}
      <label className="block text-sm font-semibold">Mật khẩu<input className="medpro-input mt-1" type="password" name="password" value={formik.values.password} onChange={formik.handleChange} autoComplete="current-password"/></label>
      {formik.touched.password && formik.errors.password && <p className="text-rose-600 text-xs">{formik.errors.password}</p>}
      {authError && <p role="alert" className="text-rose-600 text-sm">{authError}</p>}
      <button type="submit" className="medpro-btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
      <p className="text-center text-sm">Chưa có tài khoản? <Link to="/register" className="text-[#008EC2] underline">Đăng ký</Link></p>
    </form>
  </AuthShell>
}

export function AuthShell({ title, description, children }) {
  return <section className="bg-[#F7FBFE] min-h-[calc(100vh-72px)] py-12 px-4"><div className="medpro-card max-w-lg mx-auto p-7 sm:p-10">
    <h1 className="font-display text-2xl font-extrabold text-[#003553]">{title}</h1>
    <p className="mt-2 mb-7 text-sm text-slate-500">{description}</p>
    {children}
  </div></section>
}
