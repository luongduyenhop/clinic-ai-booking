import { AppToast } from '../../components/common/AppNotification'
import {
    DownloadSimple,
    QrCode,
    CheckCircle,
    Stethoscope,
    Users,
} from '../../components/common/ClinicIcon'

export default function DownloadAppPage() {
    return (
        <div className="space-y-4">
            <div className="medpro-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-[6px] bg-clinic-surface-alt border border-clinic-info-border text-clinic-cta flex items-center justify-center shrink-0">
                        <DownloadSimple size={22} weight="duotone" />
                    </span>
                    <div>
                        <h1 className="font-display text-base font-extrabold text-clinic-navy tracking-tight">
                            Ứng dụng Di động Hệ sinh thái Clinic-AI
                        </h1>
                        <p className="text-xs text-clinic-text-secondary mt-0.5">
                            Ứng dụng đặt khám dành cho người bệnh &amp; ứng dụng ký số bệnh án dành cho Bác sĩ nội bộ
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span className="medpro-badge-success tabular-nums">
                        iOS &amp; Android v2.6
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="medpro-card p-5 flex flex-col justify-between space-y-5">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <span className="medpro-badge-info inline-flex items-center gap-1">
                                <Users size={13} weight="bold" />
                                <span>Dành cho Bệnh nhân</span>
                            </span>
                            <span className="text-xs text-clinic-text-muted font-medium">Miễn phí phát hành</span>
                        </div>

                        <div>
                            <h2 className="font-display text-lg font-extrabold text-clinic-navy">Clinic-AI Booking</h2>
                            <p className="text-xs text-clinic-text-secondary mt-1">
                                Đặt lịch khám theo khung giờ, tra cứu hồ sơ sức khỏe và nhận kết quả cận lâm sàng trực tuyến
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-[6px] bg-clinic-surface-tint border border-clinic-info-border">
                            <div className="w-32 h-32 bg-clinic-surface p-2 rounded-[6px] border border-clinic-border flex items-center justify-center shrink-0">
                                <QrCode size={104} className="text-clinic-navy" />
                            </div>
                            <div className="space-y-2 text-xs">
                                <div className="font-bold text-clinic-navy">Quét mã QR để tải ứng dụng:</div>
                                <div className="text-clinic-text-secondary text-[11px]">
                                    Hỗ trợ thiết bị iPhone (iOS 14.0+) và điện thoại Android phổ biến.
                                </div>
                                <div className="pt-1.5 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => AppToast.info('Đang mở liên kết Apple App Store...')}
                                        className="px-3 py-1.5 rounded-[6px] bg-clinic-navy hover:bg-clinic-navy-dark text-clinic-surface text-xs font-semibold cursor-pointer transition-colors"
                                    >
                                        App Store
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => AppToast.info('Đang mở liên kết Google Play Store...')}
                                        className="medpro-btn-primary !py-1.5 !px-3 text-xs"
                                    >
                                        Google Play
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 text-xs">
                            <div className="font-bold text-clinic-navy uppercase text-[11px]">Tính năng nổi bật cho Người bệnh:</div>
                            <ul className="space-y-1.5 text-clinic-text-secondary">
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={14} weight="fill" className="text-clinic-success shrink-0" />
                                    <span>Đặt lịch hẹn khám theo giờ chính xác, chủ động tiếp đón tại quầy</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={14} weight="fill" className="text-clinic-success shrink-0" />
                                    <span>Xem kết quả xét nghiệm, siêu âm và hình ảnh X-Quang độ phân giải cao</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={14} weight="fill" className="text-clinic-success shrink-0" />
                                    <span>Nhận đơn thuốc điện tử đồng bộ trực tiếp từ Cổng Đơn thuốc Quốc gia BYT</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={14} weight="fill" className="text-clinic-success shrink-0" />
                                    <span>Thanh toán viện phí không tiền mặt qua chuẩn VietQR</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-3.5 border-t border-clinic-border flex items-center justify-between text-xs text-clinic-text-muted tabular-nums">
                        <span>Kênh phát hành công khai cho người bệnh</span>
                        <span className="font-mono font-semibold text-clinic-navy">Phiên bản: 2.6.4</span>
                    </div>
                </div>

                <div className="medpro-card p-5 flex flex-col justify-between space-y-5">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <span className="medpro-badge-success inline-flex items-center gap-1">
                                <Stethoscope size={13} weight="bold" />
                                <span>Dành cho Bác sĩ &amp; KTV</span>
                            </span>
                            <span className="medpro-badge-warning">
                                Ký số HSM SmartCA
                            </span>
                        </div>

                        <div>
                            <h2 className="font-display text-lg font-extrabold text-clinic-navy">Clinic-AI Doctor</h2>
                            <p className="text-xs text-clinic-text-secondary mt-1">
                                Ứng dụng nghiệp vụ di động cho phép Bác sĩ xem bệnh án, ký số đơn thuốc từ xa và quản lý ca trực
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-[6px] bg-clinic-success-bg border border-clinic-success-border">
                            <div className="w-32 h-32 bg-clinic-surface p-2 rounded-[6px] border border-clinic-border flex items-center justify-center shrink-0">
                                <QrCode size={104} className="text-clinic-success" />
                            </div>
                            <div className="space-y-2 text-xs">
                                <div className="font-bold text-clinic-navy">Quét mã tải ứng dụng Bác sĩ:</div>
                                <div className="text-clinic-text-secondary text-[11px]">
                                    Cài đặt nội bộ bảo mật cho nhân sự y tế có Chứng chỉ Hành nghề (CCHN) được cấp quyền.
                                </div>
                                <div className="pt-1.5 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => AppToast.success('Đang tạo liên kết tải file APK bảo mật nội bộ...')}
                                        className="px-3 py-1.5 rounded-[6px] bg-clinic-navy hover:bg-clinic-navy-dark text-clinic-surface text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                        <DownloadSimple size={13} weight="bold" />
                                        <span>Tải file APK nội bộ</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => AppToast.info('Đang mở cổng chứng thực Mobile MDM...')}
                                        className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                                    >
                                        TestFlight iOS
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 text-xs">
                            <div className="font-bold text-clinic-navy uppercase text-[11px]">Tính năng chuyên môn cho Bác sĩ:</div>
                            <ul className="space-y-1.5 text-clinic-text-secondary">
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={14} weight="fill" className="text-clinic-success shrink-0" />
                                    <span>Ký số từ xa hồ sơ bệnh án &amp; đơn thuốc qua VNPT SmartCA HSM (Nghị định 130)</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={14} weight="fill" className="text-clinic-success shrink-0" />
                                    <span>Tra cứu tiền sử bệnh án, dị ứng thuốc và tương tác thuốc thời gian thực</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={14} weight="fill" className="text-clinic-success shrink-0" />
                                    <span>Xem danh sách bệnh nhân chờ khám theo từng phòng chức năng và số thứ tự</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={14} weight="fill" className="text-clinic-success shrink-0" />
                                    <span>Nhận cảnh báo kết quả Cận lâm sàng khẩn (Panic Alert) tức thì qua thông báo đẩy</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-3.5 border-t border-clinic-border flex items-center justify-between text-xs text-clinic-text-muted tabular-nums">
                        <span>Bảo mật truy cập nội bộ y tế</span>
                        <span className="font-mono font-semibold text-clinic-navy">Phiên bản: 1.8.2</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
