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
                    {isAuthenticated
                        ? 'Lịch được tạo cho bệnh nhân đang đăng nhập. Thông tin định danh được đồng bộ từ hồ sơ tài khoản trên hệ thống.'
                        : 'Nhập nhanh họ tên và số điện thoại để nhận mã hẹn ngay không cần tài khoản.'}
                </p>
            </div>

            {isAuthenticated ? (
                <p className="rounded-[8px] border border-clinic-info-border bg-clinic-surface-alt p-4 text-sm text-clinic-navy">
                    Tài khoản: <strong>{user?.fullName || user?.ho_ten || user?.email || 'Bệnh nhân'}</strong>.{' '}
                    <Link to="/benh-nhan/ho-so" className="underline font-semibold text-clinic-cta">
                        Kiểm tra hồ sơ cá nhân
                    </Link>
                </p>
            ) : (
                <div className="space-y-4 rounded-[8px] border border-clinic-border bg-clinic-surface-alt p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-clinic-text-secondary">
                        <span className="font-semibold text-clinic-navy">Thông tin người khám (Khách đặt nhanh)</span>
                        <span>
                            Đã có tài khoản?{' '}
                            <Link to="/login" className="font-bold text-clinic-cta underline">
                                Đăng nhập tự động điền
                            </Link>
                        </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-semibold text-clinic-navy">
                            Họ và tên người khám <span className="text-clinic-danger">*</span>
                            <input
                                type="text"
                                name="guestFullName"
                                className="medpro-input mt-1.5"
                                value={formik.values.guestFullName || ''}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                placeholder="Nguyễn Văn A"
                            />
                            {formik.touched.guestFullName && formik.errors.guestFullName && (
                                <span className="mt-1 block text-xs font-normal text-clinic-danger">{formik.errors.guestFullName}</span>
                            )}
                        </label>

                        <label className="block text-sm font-semibold text-clinic-navy">
                            Số điện thoại liên hệ <span className="text-clinic-danger">*</span>
                            <input
                                type="tel"
                                name="guestPhone"
                                maxLength={10}
                                className="medpro-input mt-1.5 tabular-nums"
                                value={formik.values.guestPhone || ''}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                placeholder="0912345678"
                            />
                            {formik.touched.guestPhone && formik.errors.guestPhone && (
                                <span className="mt-1 block text-xs font-normal text-clinic-danger">{formik.errors.guestPhone}</span>
                            )}
                        </label>

                        <label className="block text-sm font-semibold text-clinic-navy">
                            Ngày sinh <span className="font-normal text-clinic-text-muted">(không bắt buộc)</span>
                            <input
                                type="date"
                                name="guestDob"
                                className="medpro-input mt-1.5 tabular-nums"
                                value={formik.values.guestDob || ''}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                            />
                            {formik.touched.guestDob && formik.errors.guestDob && (
                                <span className="mt-1 block text-xs font-normal text-clinic-danger">{formik.errors.guestDob}</span>
                            )}
                        </label>

                        <label className="block text-sm font-semibold text-clinic-navy">
                            Giới tính
                            <select
                                name="guestGender"
                                className="medpro-input mt-1.5"
                                value={formik.values.guestGender || 'Khác'}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                            >
                                <option value="Nam">Nam</option>
                                <option value="Nữ">Nữ</option>
                                <option value="Khác">Khác</option>
                            </select>
                        </label>
                    </div>
                </div>
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
                    {isAuthenticated
                        ? 'Tôi xác nhận lịch khám dành cho chính tài khoản bệnh nhân đang đăng nhập và đồng ý với chính sách bảo mật hồ sơ y tế.'
                        : 'Tôi xác nhận thông tin số điện thoại người khám là chính xác và đồng ý với chính sách bảo mật hồ sơ y tế.'}
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

            <div className="flex flex-col-reverse gap-3 border-t border-clinic-border pt-5 sm:flex-row sm:justify-between">
                <button type="button" className="medpro-btn-outline min-h-11 w-full sm:min-h-0 sm:w-auto" onClick={onBack}>
                    <ArrowLeft size={15} weight="bold" />
                    <span>Quay lại</span>
                </button>
                <button type="submit" className="medpro-btn-primary min-h-11 w-full sm:min-h-0 sm:w-auto" disabled={loading}>
                    {loading ? 'Đang tạo lịch...' : 'Xác nhận đặt lịch'}
                </button>
            </div>
        </form>
    )
}
