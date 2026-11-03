import { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { setAuth } from '../../redux/slices/authSlice'
import { AuthShell } from './LoginPage'
import { http } from '../../services/BaseService'
import { AppToast } from '../../components/common/AppNotification'

const MAX_BIRTH_DATE = new Date()

export default function RegisterPage() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const formik = useFormik({
    initialValues: { fullName: '', phone: '', email: '', birthDate: '', gender: 'Nam', password: '', confirmPassword: '', accepted: false },
    validationSchema: Yup.object({
      fullName: Yup.string().min(2).required('Nhập họ tên'),
      phone: Yup.string().matches(/^0\d{9}$/, 'Số điện thoại phải có 10 chữ số').required('Nhập số điện thoại'),
      email: Yup.string().email('Email không hợp lệ').required('Nhập email'),
      birthDate: Yup.date().max(MAX_BIRTH_DATE, 'Ngày sinh không hợp lệ').required('Nhập ngày sinh'),
      password: Yup.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').required('Nhập mật khẩu'),
      confirmPassword: Yup.string().oneOf([Yup.ref('password')], 'Mật khẩu không khớp').required('Xác nhận mật khẩu'),
      accepted: Yup.boolean().oneOf([true], 'Cần đồng ý điều khoản'),
    }),
    onSubmit: async values => {
      setLoading(true); setError('')
      try {
        const res = await http.post('/api/v1/auth/register-patient', {
          ho_ten: values.fullName.trim(), email: values.email.trim(),
          so_dien_thoai: values.phone.trim(), ngay_sinh: values.birthDate,
          gioi_tinh: values.gender, mat_khau: values.password,
        })
        const data = res?.data?.data
        const accessToken = data?.access_token || data?.accessToken || data?.token
        if (!accessToken) throw new Error('Máy chủ chưa trả phiên đăng nhập hợp lệ')
        dispatch(setAuth({
          accessToken, refreshToken: data.refresh_token || data.refreshToken || null,
          role: 'BENH_NHAN', user: { fullName: values.fullName, phone: values.phone, email: values.email, role: 'BENH_NHAN' },
        }))
        AppToast.success('Đăng ký tài khoản thành công')
        navigate('/benh-nhan', { replace: true })
      } catch (e) { setError(e.response?.data?.message || e.message || 'Không thể đăng ký tài khoản') }
      finally { setLoading(false) }
    },
  })
  const fields = [
    ['fullName','Họ tên'],['phone','Số điện thoại'],['email','Email','email'],['birthDate','Ngày sinh','date'],
    ['password','Mật khẩu','password'],['confirmPassword','Xác nhận mật khẩu','password'],
  ]
  return <AuthShell title="Đăng ký tài khoản bệnh nhân" description="Thông tin được gửi trực tiếp đến máy chủ; không sử dụng mã OTP hoặc tài khoản demo.">
    <form onSubmit={formik.handleSubmit} className="space-y-3" noValidate>
      {fields.map(([name,label,type])=><label key={name} className="block text-sm font-semibold">{label}<input className="medpro-input mt-1" type={type || 'text'} name={name} value={formik.values[name]} onChange={formik.handleChange} onBlur={formik.handleBlur} autoComplete={name === 'password' ? 'new-password' : undefined}/>{formik.touched[name] && formik.errors[name] && <span className="text-xs text-rose-600">{formik.errors[name]}</span>}</label>)}
      <label className="block text-sm">Giới tính<select className="medpro-input mt-1" name="gender" value={formik.values.gender} onChange={formik.handleChange}><option>Nam</option><option>Nữ</option><option>Khác</option></select></label>
      <label className="flex gap-2 text-xs"><input type="checkbox" name="accepted" checked={formik.values.accepted} onChange={formik.handleChange}/>Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật</label>
      {formik.touched.accepted && formik.errors.accepted && <p className="text-xs text-rose-600">{formik.errors.accepted}</p>}
      {error && <p role="alert" className="text-rose-600 text-sm">{error}</p>}
      <button className="medpro-btn-primary w-full" type="submit" disabled={loading}>{loading ? 'Đang đăng ký...' : 'Tạo tài khoản'}</button>
      <p className="text-sm text-center">Đã có tài khoản? <Link to="/login" className="text-[#008EC2] underline">Đăng nhập</Link></p>
    </form>
  </AuthShell>
}
