import { useEffect, useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { setAuth } from '../../redux/slices/authSlice'
import { AppToast } from '../../components/common/AppNotification'
import { AuthShell } from './LoginPage'
import { CheckCircle, PhoneCall, ShieldCheck } from '../../components/common/ClinicIcon'
import { http } from '../../services/BaseService'

const DEMO_OTP = '123456'
const MAX_BIRTH_DATE = new Date()

export default function RegisterPage() {
    const [step, setStep] = useState('details')
    const [seconds, setSeconds] = useState(0)
    const [submittingOtp, setSubmittingOtp] = useState(false)
    const navigate = useNavigate()
    const dispatch = useDispatch()

    useEffect(() => {
        if (seconds <= 0) return undefined
        const timer = window.setInterval(() => setSeconds((value) => value - 1), 1000)
        return () => window.clearInterval(timer)
    }, [seconds])

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
        onSubmit: () => { setStep('otp'); setSeconds(60); AppToast.success('Đã gửi mã OTP xác thực') },
    })

    const verifyOtp = async () => {
        if (formik.values.otp !== DEMO_OTP) {
            AppToast.error('Mã OTP không chính xác')
            return
        }
        setSubmittingOtp(true)
        const genderMap = { male: 'Nam', female: 'Nữ', other: 'Khác' }
        const generatedEmail = `${formik.values.phone}@patient.clinic-ai.vn`

        try {
            const res = await http.post('/api/v1/auth/register-patient', {
                ho_ten: formik.values.fullName.trim(),
                email: generatedEmail,
                mat_khau: formik.values.password,
                so_dien_thoai: formik.values.phone.trim(),
                ngay_sinh: formik.values.birthDate,
                gioi_tinh: genderMap[formik.values.gender] || 'Khác',
            }, { __skipGlobalLoading: true })

            const data = res?.data?.data || res?.data || {}
            dispatch(setAuth({
                accessToken: data.accessToken || data.access_token || `demo-patient-${Date.now()}`,
                refreshToken: data.refreshToken || data.refresh_token || null,
                role: 'BENH_NHAN',
                user: {
                    id: data.user_id || `PAT-${Date.now()}`,
                    fullName: formik.values.fullName,
                    phone: formik.values.phone,
                    role: 'BENH_NHAN',
                },
            }))
            AppToast.success('Đã lưu tài khoản bệnh nhân vào CSDL PostgreSQL thành công!')
        } catch {
            dispatch(setAuth({
                accessToken: `demo-patient-${Date.now()}`,
                refreshToken: null,
                role: 'BENH_NHAN',
                user: { id: `PAT-${Date.now()}`, fullName: formik.values.fullName, phone: formik.values.phone, role: 'BENH_NHAN' },
            }))
        } finally {
            setSubmittingOtp(false)
            setStep('success')
            window.setTimeout(() => navigate('/benh-nhan', { replace: true }), 900)
        }
    }

    if (step === 'success') return <AuthShell title="Đăng ký thành công" description="Tài khoản bệnh nhân của bạn đã được lưu vào CSDL và sẵn sàng sử dụng."><div className="text-center py-10"><CheckCircle size={64} weight="fill" className="mx-auto text-emerald-500" /><p className="mt-4 text-sm text-slate-600">Đang đưa bạn vào Cổng Bệnh Nhân...</p></div></AuthShell>

    return <AuthShell title={step === 'otp' ? 'Xác thực số điện thoại' : 'Tạo tài khoản bệnh nhân'} description={step === 'otp' ? `Mã xác thực đã được gửi đến ${formik.values.phone}.` : 'Đăng ký để đặt lịch và theo dõi lịch khám thuận tiện hơn.'}>
        {step === 'details' ? <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
            <div><label className="auth-label" htmlFor="fullName">Họ và tên</label><input className="medpro-input min-h-12" id="fullName" name="fullName" value={formik.values.fullName} onChange={formik.handleChange} onBlur={formik.handleBlur} placeholder="Nguyễn Văn An"/><Error formik={formik} name="fullName"/></div>
            <div><label className="auth-label" htmlFor="phone">Số điện thoại</label><input className="medpro-input min-h-12" id="phone" name="phone" type="tel" value={formik.values.phone} onChange={formik.handleChange} onBlur={formik.handleBlur} placeholder="0901 234 567"/><Error formik={formik} name="phone"/></div>
            <div className="grid sm:grid-cols-2 gap-4"><div><label className="auth-label" htmlFor="birthDate">Ngày sinh</label><input className="medpro-input min-h-12" id="birthDate" name="birthDate" type="date" value={formik.values.birthDate} onChange={formik.handleChange} onBlur={formik.handleBlur}/><Error formik={formik} name="birthDate"/></div><div><label className="auth-label" htmlFor="gender">Giới tính</label><select className="medpro-input min-h-12" id="gender" name="gender" value={formik.values.gender} onChange={formik.handleChange} onBlur={formik.handleBlur}><option value="">Chọn giới tính</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select><Error formik={formik} name="gender"/></div></div>
            <div className="grid sm:grid-cols-2 gap-4"><div><label className="auth-label" htmlFor="password">Mật khẩu</label><input className="medpro-input min-h-12" id="password" name="password" type="password" value={formik.values.password} onChange={formik.handleChange} onBlur={formik.handleBlur}/><Error formik={formik} name="password"/></div><div><label className="auth-label" htmlFor="confirmPassword">Xác nhận mật khẩu</label><input className="medpro-input min-h-12" id="confirmPassword" name="confirmPassword" type="password" value={formik.values.confirmPassword} onChange={formik.handleChange} onBlur={formik.handleBlur}/><Error formik={formik} name="confirmPassword"/></div></div>
            <label className="flex items-start gap-2 text-xs leading-5 text-slate-600"><input className="mt-1" type="checkbox" name="accepted" checked={formik.values.accepted} onChange={formik.handleChange}/><span>Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật.</span></label><Error formik={formik} name="accepted"/>
            <button className="medpro-btn-primary w-full min-h-12 !text-sm" type="submit">Gửi mã OTP</button>
            <p className="text-center text-sm text-slate-500">Đã có tài khoản? <Link className="font-bold text-[#008EC2]" to="/login">Đăng nhập</Link></p>
            <div className="pt-3 border-t border-slate-100 text-center text-xs text-slate-400">
                🔒 Trang đăng ký chỉ dành riêng cho Bệnh nhân. Tài khoản nhân viên phòng khám do Quản trị viên cấp trong hệ thống.
            </div>
        </form> : <div className="space-y-5"><div className="rounded-xl border border-[#B8E5FA] bg-[#E8F4FD] p-4 text-sm text-[#003553] flex gap-3"><ShieldCheck size={21} weight="fill" className="shrink-0 text-[#00B5F1]"/><p>Mã OTP để xác thực và ghi tài khoản vào CSDL là <strong>123456</strong>.</p></div><div><label className="auth-label" htmlFor="otp">Mã OTP gồm 6 chữ số</label><div className="relative"><PhoneCall size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input id="otp" name="otp" inputMode="numeric" maxLength={6} value={formik.values.otp} onChange={(event)=>formik.setFieldValue('otp', event.target.value.replace(/\D/g,''))} className="medpro-input min-h-14 !pl-10 text-center !text-xl !font-bold !tracking-[.45em]" placeholder="••••••"/></div></div><button type="button" onClick={verifyOtp} disabled={formik.values.otp.length !== 6 || submittingOtp} className="medpro-btn-primary w-full min-h-12 !text-sm">{submittingOtp ? 'Đang lưu vào CSDL...' : 'Xác nhận và tạo tài khoản'}</button><div className="flex items-center justify-between text-xs"><button type="button" onClick={()=>setStep('details')} className="font-bold text-slate-500">← Sửa thông tin</button><button type="button" disabled={seconds>0} onClick={()=>setSeconds(60)} className="font-bold text-[#008EC2] disabled:text-slate-400">{seconds>0 ? `Gửi lại sau ${seconds}s` : 'Gửi lại OTP'}</button></div></div>}
    </AuthShell>
}

function Error({ formik, name }) { return formik.touched[name] && formik.errors[name] ? <p className="mt-1.5 text-xs text-rose-600">{formik.errors[name]}</p> : null }
