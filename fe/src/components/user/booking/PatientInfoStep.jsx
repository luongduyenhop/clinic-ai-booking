import { Link } from 'react-router-dom'

export default function PatientInfoStep({ formik, user, isAuthenticated, loading = false, error = '', onBack = () => {} }) {
    return (
        <form onSubmit={formik.handleSubmit} className="space-y-5" noValidate>
            <div>
                <h2 className="booking-title">Xác nhận lịch khám</h2>
                <p className="booking-description">
                    {isAuthenticated
                        ? 'Lịch được tạo cho bệnh nhân đang đăng nhập. Thông tin định danh lấy từ hồ sơ tài khoản trên hệ thống.'
                        : 'Nhập nhanh họ tên và số điện thoại để nhận mã hẹn ngay không cần tài khoản.'}
                </p>
            </div>

            {isAuthenticated ? (
                <p className="rounded-xl bg-sky-50 p-4 text-sm">
                    Tài khoản: <strong>{user?.fullName || user?.ho_ten || user?.email || 'Bệnh nhân'}</strong>.{' '}
                    <Link to="/benh-nhan/ho-so" className="underline text-[#008EC2]">
                        Kiểm tra hồ sơ cá nhân
                    </Link>
                </p>
            ) : (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                        <span className="font-semibold text-[#003553]">Thông tin người khám (Khách đặt nhanh)</span>
                        <span>
                            Đã có tài khoản?{' '}
                            <Link to="/login" className="font-bold text-[#008EC2] underline">
                                Đăng nhập tự động điền
                            </Link>
                        </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-semibold text-slate-700">
                            Họ và tên người khám <span className="text-rose-500">*</span>
                            <input
                                type="text"
                                name="guestFullName"
                                className="medpro-input mt-1"
                                value={formik.values.guestFullName || ''}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                placeholder="Nguyễn Văn A"
                            />
                            {formik.touched.guestFullName && formik.errors.guestFullName && (
                                <span className="mt-1 block text-xs font-normal text-rose-600">{formik.errors.guestFullName}</span>
                            )}
                        </label>

                        <label className="block text-sm font-semibold text-slate-700">
                            Số điện thoại liên hệ <span className="text-rose-500">*</span>
                            <input
                                type="tel"
                                name="guestPhone"
                                maxLength={10}
                                className="medpro-input mt-1"
                                value={formik.values.guestPhone || ''}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                placeholder="0912345678"
                            />
                            {formik.touched.guestPhone && formik.errors.guestPhone && (
                                <span className="mt-1 block text-xs font-normal text-rose-600">{formik.errors.guestPhone}</span>
                            )}
                        </label>

                        <label className="block text-sm font-semibold text-slate-700">
                            Ngày sinh <span className="font-normal text-slate-500">(không bắt buộc)</span>
                            <input
                                type="date"
                                name="guestDob"
                                className="medpro-input mt-1"
                                value={formik.values.guestDob || ''}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                            />
                            {formik.touched.guestDob && formik.errors.guestDob && (
                                <span className="mt-1 block text-xs font-normal text-rose-600">{formik.errors.guestDob}</span>
                            )}
                        </label>

                        <label className="block text-sm font-semibold text-slate-700">
                            Giới tính
                            <select
                                name="guestGender"
                                className="medpro-input mt-1"
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

            <label className="block text-sm font-semibold">
                Triệu chứng hoặc lý do khám <span className="font-normal text-slate-500">(không bắt buộc)</span>
                <textarea
                    name="reason"
                    rows={4}
                    className="medpro-input mt-1"
                    value={formik.values.reason}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="Bạn có thể ghi ngắn triệu chứng hoặc để trống"
                />
            </label>
            {formik.touched.reason && formik.errors.reason && <p className="text-xs text-rose-600">{formik.errors.reason}</p>}

            <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" name="accepted" checked={formik.values.accepted} onChange={formik.handleChange} />
                <span>
                    {isAuthenticated
                        ? 'Tôi xác nhận lịch khám dành cho chính tài khoản bệnh nhân đang đăng nhập và đồng ý với chính sách bảo mật.'
                        : 'Tôi xác nhận thông tin số điện thoại người khám là chính xác và đồng ý với chính sách bảo mật.'}
                </span>
            </label>
            {formik.touched.accepted && formik.errors.accepted && <p className="text-xs text-rose-600">{formik.errors.accepted}</p>}

            {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
                <button type="button" className="medpro-btn-outline min-h-11 w-full sm:min-h-0 sm:w-auto" onClick={onBack}>
                    ← Quay lại
                </button>
                <button type="submit" className="medpro-btn-primary min-h-11 w-full sm:min-h-0 sm:w-auto" disabled={loading}>
                    {loading ? 'Đang tạo lịch...' : 'Xác nhận đặt lịch'}
                </button>
            </div>
        </form>
    )
}
