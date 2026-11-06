import { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { setAuth } from '../../redux/slices/authSlice'
import { AppToast } from '../../components/common/AppNotification'
import { AuthShell } from './LoginPage'
import { CheckCircle } from '../../components/common/ClinicIcon'
import { http } from '../../services/BaseService'

const MAX_BIRTH_DATE = new Date()

export default function RegisterPage() {
    const [step, setStep] = useState('details')
    const [submittingOtp, setSubmittingOtp] = useState(false)
    const [error, setError] = useState('')
    const navigate = useNavigate()
    const dispatch = useDispatch()

    const formik = useFormik({
        initialValues: { fullName: '', phone: '', birthDate: '', gender: '', password: '', confirmPassword: '', accepted: false, otp: '' },
        validationSchema: Yup.object({
            fullName: Yup.string().min(2, 'Họ tên chưa hợp lệ').required('Vui lòng nhập họ và tên'),
            phone: Yup.string().matches(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0').required('Vui lòng nhập số điện thoại'),
            birthDate: Yup.date().max(MAX_BIRTH_DATE, 'Ngày sinh không hợp lệ').required('Vui lòng chọn ngày sinh'),
            gender: Yup.string().required('Vui lòng chọn giới tính'),
            password: Yup.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').required('Vui lòng nhập mật khẩu'),
            confirmPassword: Yup.string().oneOf([Yup.ref('password')], 'Mật khẩu xác nhận không khớp').required('Vui lòng xác nhận mật khẩu'),
            accepted: Yup.boolean().oneOf([true], 'Bạn cần đồng ý với điều khoản sử dụng'),
        }),
        onSubmit: async (values) => {
            setSubmittingOtp(true)
            setError('')
            try {
                const genderMap = { male: 'Nam', female: 'Nữ', other: 'Khác' }
                const generatedEmail = values.phone.trim() + '@patient.clinic-ai.vn'
                const response = await http.post('/api/v1/auth/register-patient', {
                    ho_ten: values.fullName.trim(),
                    email: generatedEmail,
                    mat_khau: values.password,
                    so_dien_thoai: values.phone.trim(),
                    ngay_sinh: values.birthDate,
                    gioi_tinh: genderMap[values.gender] || 'Khác',
                })
                const data = response?.data?.data || {}
                const accessToken = data.accessToken || data.access_token || data.token
                if (!accessToken) throw new Error('Backend chưa cấp phiên đăng nhập hợp lệ')
                dispatch(setAuth({
                    accessToken,
                    refreshToken: data.refreshToken || data.refresh_token || null,
                    role: 'BENH_NHAN',
                    user: { fullName: values.fullName, phone: values.phone, email: generatedEmail, role: 'BENH_NHAN' },
                }))
                setStep('success')
                AppToast.success('Đã đăng ký tài khoản bệnh nhân thành công!')
                navigate('/benh-nhan', { replace: true })
            } catch (err) {
                setError(err.response?.data?.message || err.message || 'Đăng ký không thành công')
            } finally {
                setSubmittingOtp(false)
            }
        },
    })

    if (step === 'success') return <AuthShell title="Đăng ký thành công" description="Tài khoản bệnh nhân của bạn đã được lưu vào CSDL và sẵn sàng sử dụng."><div className="text-center py-10"><CheckCircle size={64} weight="fill" className="mx-auto text-emerald-500" /><p className="mt-4 text-sm text-slate-600">Đang đưa bạn vào Cổng Bệnh Nhân...</p></div></AuthShell>

    return <AuthShell title="Tạo tài khoản bệnh nhân" description="Đăng ký để đặt lịch và theo dõi lịch khám thuận tiện hơn.">
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
        <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
            <div><label className="auth-label" htmlFor="fullName">Họ và tên</label><input className="medpro-input min-h-12" id="fullName" name="fullName" value={formik.values.fullName} onChange={formik.handleChange} onBlur={formik.handleBlur} placeholder="Nguyễn Văn An"/><Error formik={formik} name="fullName"/></div>
            <div><label className="auth-label" htmlFor="phone">Số điện thoại</label><input className="medpro-input min-h-12" id="phone" name="phone" type="tel" value={formik.values.phone} onChange={formik.handleChange} onBlur={formik.handleBlur} placeholder="0901 234 567"/><Error formik={formik} name="phone"/></div>
            <div className="grid sm:grid-cols-2 gap-4"><div><label className="auth-label" htmlFor="birthDate">Ngày sinh</label><input className="medpro-input min-h-12" id="birthDate" name="birthDate" type="date" value={formik.values.birthDate} onChange={formik.handleChange} onBlur={formik.handleBlur}/><Error formik={formik} name="birthDate"/></div><div><label className="auth-label" htmlFor="gender">Giới tính</label><select className="medpro-input min-h-12" id="gender" name="gender" value={formik.values.gender} onChange={formik.handleChange} onBlur={formik.handleBlur}><option value="">Chọn giới tính</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select><Error formik={formik} name="gender"/></div></div>
            <div className="grid sm:grid-cols-2 gap-4"><div><label className="auth-label" htmlFor="password">Mật khẩu</label><input className="medpro-input min-h-12" id="password" name="password" type="password" value={formik.values.password} onChange={formik.handleChange} onBlur={formik.handleBlur}/><Error formik={formik} name="password"/></div><div><label className="auth-label" htmlFor="confirmPassword">Xác nhận mật khẩu</label><input className="medpro-input min-h-12" id="confirmPassword" name="confirmPassword" type="password" value={formik.values.confirmPassword} onChange={formik.handleChange} onBlur={formik.handleBlur}/><Error formik={formik} name="confirmPassword"/></div></div>
            <label className="flex items-start gap-2 text-xs leading-5 text-slate-600"><input className="mt-1" type="checkbox" name="accepted" checked={formik.values.accepted} onChange={formik.handleChange}/><span>Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật.</span></label><Error formik={formik} name="accepted"/>
            <button className="medpro-btn-primary w-full min-h-12 !text-sm" type="submit" disabled={submittingOtp}>{submittingOtp ? "Đang tạo tài khoản..." : "Tạo tài khoản"}</button>
            <p className="text-center text-sm text-slate-500">Đã có tài khoản? <Link className="font-bold text-[#008EC2]" to="/login">Đăng nhập</Link></p>
            <div className="pt-3 border-t border-slate-100 text-center text-xs text-slate-400">
                🔒 Trang đăng ký chỉ dành riêng cho Bệnh nhân. Tài khoản nhân viên phòng khám do Quản trị viên cấp trong hệ thống.
            </div>
        </form>
    </AuthShell>
}

function Error({ formik, name }) { return formik.touched[name] && formik.errors[name] ? <p className="mt-1.5 text-xs text-rose-600">{formik.errors[name]}</p> : null }
