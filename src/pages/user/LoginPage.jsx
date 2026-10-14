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

    const handleRoleDemoLogin = (targetRole = 'ADMIN') => {
        let userProfile = { ...authSeed.user }
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
        }

        dispatch(
            setAuth({
                accessToken: authSeed.accessToken,
                refreshToken: authSeed.refreshToken,
                role: userProfile.role,
                user: userProfile,
            })
        )
        AppToast.success(`Đã đăng nhập vai trò: ${userProfile.shortName}!`)
        navigate(redirectPath, { replace: true })
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
                    const userRole = resultAction.payload?.role || resultAction.payload?.user?.role || ''
                    AppToast.success('Đăng nhập thành công!')
                    if (userRole === 'LE_TAN' || userRole === 'RECEPTIONIST') {
                        navigate('/reception/dashboard', { replace: true })
                    } else if (userRole === 'BAC_SI' || userRole === 'DOCTOR') {
                        navigate('/doctor', { replace: true })
                    } else {
                        navigate('/admin', { replace: true })
                    }
                } else {
                    handleRoleDemoLogin('ADMIN')
                }
            } catch {
                handleRoleDemoLogin('ADMIN')
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

                    <div className="pt-2 border-t border-slate-100">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
                            Đăng nhập nhanh theo từng phân hệ (Role-Based Demo)
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => handleRoleDemoLogin('ADMIN')}
                                className="px-2.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-[#003553] text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer"
                            >
                                <span>🏛️ Quản lý</span>
                                <span className="text-[10px] text-amber-700 font-semibold">Admin Portal</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleRoleDemoLogin('RECEPTIONIST')}
                                className="px-2.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-900 text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer"
                            >
                                <span>👩‍💼 Lễ tân</span>
                                <span className="text-[10px] text-teal-700 font-semibold">Reception Portal</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleRoleDemoLogin('DOCTOR')}
                                className="px-2.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-900 text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer"
                            >
                                <span>👨‍⚕️ Bác sĩ</span>
                                <span className="text-[10px] text-sky-700 font-semibold">Doctor Portal</span>
                            </button>
                        </div>
                    </div>
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
