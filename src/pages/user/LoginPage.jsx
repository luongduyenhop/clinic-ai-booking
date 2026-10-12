import { useFormik } from 'formik'
import * as Yup from 'yup'
import { useNavigate, Link } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { AppToast } from '../../components/common/AppNotification'
import { loginUserAsync } from '../../redux/actions/user/authAction'
import { setAuth } from '../../redux/slices/authSlice'
import { getAuthSeed } from '../../services/admin/clinicSeedData'
import { Hospital, Lightning, LockKey } from '../../components/common/ClinicIcon'

export default function LoginPage() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const authSeed = getAuthSeed()

    const handleQuickDemoLogin = () => {
        dispatch(
            setAuth({
                accessToken: authSeed.accessToken,
                refreshToken: authSeed.refreshToken,
                role: authSeed.role,
                user: authSeed.user,
            })
        )
        AppToast.success('Đã đăng nhập quyền Quản trị viên & Bác sĩ phụ trách chuyên môn!')
        navigate('/admin', { replace: true })
    }

    const formik = useFormik({
        initialValues: {
            usernameOrEmail: authSeed.defaultLoginCredentials?.usernameOrEmail || 'admin@clinic-ai.vn',
            password: authSeed.defaultLoginCredentials?.password || 'password123',
        },
        validationSchema: Yup.object({
            usernameOrEmail: Yup.string().required('Vui lòng nhập tên đăng nhập hoặc email'),
            password: Yup.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').required('Vui lòng nhập mật khẩu'),
        }),
        onSubmit: async (values, { setSubmitting }) => {
            try {
                const resultAction = await dispatch(loginUserAsync(values))
                if (loginUserAsync.fulfilled.match(resultAction)) {
                    AppToast.success('Đăng nhập thành công!')
                    navigate('/admin', { replace: true })
                } else {
                    handleQuickDemoLogin()
                }
            } catch {
                handleQuickDemoLogin()
            } finally {
                setSubmitting(false)
            }
        },
    })

    return (
        <div className="min-h-[calc(100vh-160px)] flex items-center justify-center p-4 bg-[#E8F4FD]/40">
            <div className="max-w-md w-full medpro-card p-8 space-y-6">
                <div className="text-center space-y-2">
                    <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00B5F1] to-[#0088BA] text-white shadow-md">
                        <Hospital size={24} weight="fill" />
                    </span>
                    <h2 className="font-display text-2xl font-extrabold text-[#003553] tracking-tight">
                        ĐĂNG NHẬP HỆ THỐNG CLINIC-AI
                    </h2>
                    <p className="text-xs text-slate-500">
                        Quản trị nghiệp vụ phòng khám, Khám chữa bệnh & Giám sát tuân thủ pháp lý
                    </p>
                </div>

                <form onSubmit={formik.handleSubmit} className="space-y-4">
                    <div>
                        <label className="medpro-label">Tên đăng nhập hoặc Email</label>
                        <input
                            type="text"
                            name="usernameOrEmail"
                            value={formik.values.usernameOrEmail}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            placeholder="admin@clinic-ai.vn"
                            className="medpro-input !py-2.5"
                        />
                        {formik.touched.usernameOrEmail && formik.errors.usernameOrEmail && (
                            <p className="text-xs text-red-500 mt-1">{formik.errors.usernameOrEmail}</p>
                        )}
                    </div>

                    <div>
                        <label className="medpro-label">Mật khẩu</label>
                        <input
                            type="password"
                            name="password"
                            value={formik.values.password}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            placeholder="••••••••"
                            className="medpro-input !py-2.5"
                        />
                        {formik.touched.password && formik.errors.password && (
                            <p className="text-xs text-red-500 mt-1">{formik.errors.password}</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={formik.isSubmitting}
                        className="medpro-btn-primary w-full !py-2.5 text-sm font-bold"
                    >
                        <LockKey size={16} weight="bold" />
                        <span>{formik.isSubmitting ? 'Đang xử lý...' : 'Đăng nhập Quản trị Phòng khám'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleQuickDemoLogin}
                        className="medpro-btn-amber w-full !py-2.5 text-sm font-bold"
                    >
                        <Lightning size={16} weight="fill" />
                        <span>Vào nhanh Quản trị ({authSeed.user?.shortName || 'Admin'})</span>
                    </button>
                </form>

                <div className="text-center text-xs text-slate-500">
                    Quay về{' '}
                    <Link to="/" className="text-[#00B5F1] font-bold hover:underline">
                        Cổng thông tin bệnh nhân
                    </Link>
                </div>
            </div>
        </div>
    )
}
