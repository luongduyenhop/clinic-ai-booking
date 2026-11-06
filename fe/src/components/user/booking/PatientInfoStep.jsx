import { Link } from 'react-router-dom'

export default function PatientInfoStep({ formik, user, isAuthenticated }) {
  return <form onSubmit={formik.handleSubmit} className="space-y-5" noValidate>
    <div><h2 className="booking-title">Xác nhận lịch khám</h2><p className="booking-description">Lịch được tạo cho bệnh nhân đang đăng nhập. Thông tin định danh lấy từ hồ sơ tài khoản trên Backend.</p></div>
    {!isAuthenticated && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Bạn cần đăng nhập tài khoản bệnh nhân trước khi đặt lịch. <Link to="/login" className="underline font-bold">Đăng nhập</Link></p>}
    {isAuthenticated && <p className="rounded-xl bg-sky-50 p-4 text-sm">Tài khoản: <strong>{user?.fullName || user?.ho_ten || user?.email || 'Bệnh nhân'}</strong>. <Link to="/benh-nhan/ho-so" className="underline text-[#008EC2]">Kiểm tra hồ sơ cá nhân</Link></p>}
    <label className="block text-sm font-semibold">Triệu chứng hoặc lý do khám
      <textarea name="reason" rows={4} className="medpro-input mt-1" value={formik.values.reason} onChange={formik.handleChange} onBlur={formik.handleBlur} placeholder="Mô tả ngắn triệu chứng hoặc lý do khám"/>
    </label>
    {formik.touched.reason && formik.errors.reason && <p className="text-xs text-rose-600">{formik.errors.reason}</p>}
    <label className="flex items-start gap-2 text-xs"><input type="checkbox" name="accepted" checked={formik.values.accepted} onChange={formik.handleChange}/><span>Tôi xác nhận lịch khám dành cho chính tài khoản bệnh nhân đang đăng nhập và đồng ý với chính sách bảo mật.</span></label>
    {formik.touched.accepted && formik.errors.accepted && <p className="text-xs text-rose-600">{formik.errors.accepted}</p>}
  </form>
}
