import { Link } from 'react-router-dom'
import { ArrowLeft } from '../../common/ClinicIcon'

export default function PatientInfoStep({
    formik,
    user,
    isAuthenticated,
    loading = false,
    error = '',
    onBack = () => {},
}) {
    return (
        <form onSubmit={formik.handleSubmit} className="space-y-5" noValidate>
            <div>
                <h2 className="booking-title">Xác nhận lịch khám</h2>
                <p className="booking-description">
                    Lịch được tạo cho bệnh nhân đang đăng nhập. Thông tin định danh được đồng bộ từ hồ sơ tài khoản trên hệ thống.
                </p>
            </div>

            {!isAuthenticated && (
                <p
                    role="alert"
                    className="rounded-[8px] border border-clinic-warning-border bg-clinic-warning-bg p-4 text-sm text-clinic-warning"
                >
                    Bạn cần đăng nhập tài khoản bệnh nhân trước khi đặt lịch.{' '}
                    <Link to="/login" className="underline font-bold">
                        Đăng nhập
                    </Link>
                </p>
            )}

            {isAuthenticated && (
                <p className="rounded-[8px] border border-clinic-info-border bg-clinic-surface-alt p-4 text-sm text-clinic-navy">
                    Tài khoản: <strong>{user?.fullName || user?.ho_ten || user?.email || 'Bệnh nhân'}</strong>.{' '}
                    <Link to="/benh-nhan/ho-so" className="underline font-semibold text-clinic-cta">
                        Kiểm tra hồ sơ cá nhân
                    </Link>
                </p>
            )}

            <div>
                <label htmlFor="booking-reason" className="block text-sm font-semibold text-clinic-navy">
                    Triệu chứng hoặc lý do khám <span className="font-normal text-clinic-text-muted">(không bắt buộc)</span>
                </label>
                <textarea
                    id="booking-reason"
                    name="reason"
                    rows={4}
                    className="medpro-input mt-1.5"
                    value={formik.values.reason}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="Bạn có thể ghi ngắn triệu chứng hoặc để trống"
                />
                {formik.touched.reason && formik.errors.reason && (
                    <p className="mt-1 text-xs text-clinic-danger">{formik.errors.reason}</p>
                )}
            </div>

            <label className="flex items-start gap-2.5 text-xs text-clinic-text-secondary leading-5 cursor-pointer">
                <input
                    type="checkbox"
                    name="accepted"
                    checked={formik.values.accepted}
                    onChange={formik.handleChange}
                    className="mt-0.5"
                />
                <span>
                    Tôi xác nhận lịch khám dành cho chính tài khoản bệnh nhân đang đăng nhập và đồng ý với chính sách bảo mật hồ sơ y tế.
                </span>
            </label>
            {formik.touched.accepted && formik.errors.accepted && (
                <p className="text-xs text-clinic-danger">{formik.errors.accepted}</p>
            )}

            {error && (
                <p
                    role="alert"
                    className="rounded-[8px] border border-clinic-danger-border bg-clinic-danger-bg p-3.5 text-sm text-clinic-danger"
                >
                    {error}
                </p>
            )}

            <div className="flex justify-between border-t border-clinic-border pt-5">
                <button type="button" className="medpro-btn-outline" onClick={onBack}>
                    <ArrowLeft size={15} weight="bold" />
                    <span>Quay lại</span>
                </button>
                <button type="submit" className="medpro-btn-primary" disabled={!isAuthenticated || loading}>
                    {loading ? 'Đang tạo lịch...' : 'Xác nhận đặt lịch'}
                </button>
            </div>
        </form>
    )
}
