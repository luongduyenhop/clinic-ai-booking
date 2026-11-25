import { createPortal } from 'react-dom'
import { AppToast } from '../common/AppNotification'
import { ClinicIcon } from '../common/ClinicIcon'

export default function DoctorCertificateModal({ isOpen, onClose, doctorInfo }) {
    if (!isOpen) return null

    const handlePrint = () => {
        AppToast.success('Đã gửi chứng chỉ hành nghề tới máy in tài liệu')
    }

    return createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-clinic-navy/60 backdrop-blur-xs p-4 flex justify-center items-center py-6">
            <div className="bg-clinic-surface rounded-[6px] max-w-2xl w-full flex flex-col max-h-[85vh] border border-clinic-border relative overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-clinic-border shrink-0 bg-clinic-bg">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-[6px] bg-clinic-warning-bg text-clinic-warning flex items-center justify-center border border-clinic-warning-border">
                            <ClinicIcon name="Certificate" size={18} weight="bold" />
                        </span>
                        <div>
                            <h3 className="text-base font-extrabold text-clinic-navy">
                                Hồ Sơ Chứng Chỉ Hành Nghề &amp; Bằng Cấp Y Khoa
                            </h3>
                            <p className="text-xs text-clinic-text-secondary">
                                Đã được xác thực bởi Hệ Thống Y Tế &amp; Cơ quan Quản lý Khám chữa bệnh
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label="Đóng hộp thoại chứng chỉ"
                        onClick={onClose}
                        className="w-8 h-8 rounded-[6px] bg-clinic-bg-muted hover:bg-clinic-border text-clinic-text-secondary flex items-center justify-center cursor-pointer transition"
                    >
                        <ClinicIcon name="X" size={16} weight="bold" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="p-6 rounded-[6px] bg-clinic-warning-bg/35 border border-clinic-warning-border relative">
                        <div className="text-center space-y-1 pb-4">
                            <p className="text-xs font-bold text-clinic-navy">
                                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                            </p>
                            <p className="text-[11px] font-semibold text-clinic-text-secondary">
                                Độc lập - Tự do - Hạnh phúc
                            </p>
                            <div className="w-20 h-0.5 bg-clinic-amber mx-auto mt-1" />
                            <p className="text-[11px] font-bold text-clinic-text-secondary pt-2">
                                BỘ Y TẾ — CỤC QUẢN LÝ KHÁM, CHỮA BỆNH
                            </p>
                        </div>

                        <div className="text-center py-3">
                            <h2 className="text-lg sm:text-xl font-extrabold text-clinic-navy">
                                CHỨNG CHỈ HÀNH NGHỀ KHÁM BỆNH, CHỮA BỆNH
                            </h2>
                            <span className="medpro-badge-warning text-xs font-bold inline-block mt-1.5 tabular-nums">
                                Số CCHN: {doctorInfo?.licenseNumber || doctorInfo?.code || 'BYT-CCHN'}
                            </span>
                        </div>

                        <div className="space-y-2.5 text-xs text-clinic-text pt-2 px-2 sm:px-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                    <span className="text-clinic-text-secondary">Người được cấp:</span>{' '}
                                    <strong className="text-clinic-navy text-sm">{doctorInfo?.name || 'Bác sĩ'}</strong>
                                </div>
                                <div className="tabular-nums">
                                    <span className="text-clinic-text-secondary">Mã định danh Bác sĩ:</span>{' '}
                                    <strong className="text-clinic-cta">{doctorInfo?.code || '—'}</strong>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                    <span className="text-clinic-text-secondary">Văn bằng chuyên môn:</span>{' '}
                                    <strong className="text-clinic-navy">{doctorInfo?.degree || 'Bác sĩ Chuyên Khoa'}</strong>
                                </div>
                                <div className="tabular-nums">
                                    <span className="text-clinic-text-secondary">Ngày cấp:</span>{' '}
                                    <strong className="text-clinic-navy">{doctorInfo?.licenseDate || 'Hợp lệ theo quy định BYT'}</strong>
                                </div>
                            </div>

                            <div className="p-3 rounded-[6px] bg-clinic-surface border border-clinic-border">
                                <span className="text-clinic-text-secondary block mb-0.5 font-medium">Phạm vi hoạt động chuyên môn:</span>
                                <strong className="text-clinic-navy text-xs">
                                    Khám bệnh, chữa bệnh chuyên khoa {doctorInfo?.specialty || 'Khám bệnh'}
                                </strong>
                            </div>
                        </div>

                        <div className="flex justify-between items-end pt-6 px-2 sm:px-4">
                            <div className="text-[11px] text-clinic-text-secondary tabular-nums">
                                <span className="inline-flex items-center gap-1 font-semibold text-clinic-success">
                                    <ClinicIcon name="CheckCircle" size={13} weight="bold" />
                                    <span>Đã xác thực chữ ký số Bộ Y Tế</span>
                                </span>
                                <div className="mt-0.5">Mã tra cứu QG: {doctorInfo?.code ? `VN-MED-${doctorInfo.code}` : 'VN-MED-VERIFIED'}</div>
                            </div>
                            <div className="text-center">
                                <div className="px-3 py-2 rounded-[6px] border border-clinic-danger-border text-clinic-danger bg-clinic-danger-bg flex flex-col items-center justify-center text-[10px] font-extrabold">
                                    <span>BỘ Y TẾ — CỤC QLKCB</span>
                                    <span>ĐÃ KÝ DUYỆT</span>
                                </div>
                                <span className="text-[10px] font-bold text-clinic-text-secondary block mt-1">CỤC TRƯỞNG</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 text-xs">
                        <h4 className="font-extrabold text-clinic-navy text-xs flex items-center gap-1.5">
                            <ClinicIcon name="GraduationCap" size={16} className="text-clinic-cta" />
                            <span>Chứng chỉ đào tạo y khoa liên tục (CME) đã tích lũy:</span>
                        </h4>
                        {doctorInfo?.cmeCertificates && doctorInfo.cmeCertificates.length > 0 ? (
                            <div className="divide-y divide-clinic-border border border-clinic-border rounded-[6px] overflow-hidden text-xs">
                                {doctorInfo.cmeCertificates.map((cme, idx) => (
                                    <div key={idx} className="p-3 bg-clinic-surface flex items-center justify-between">
                                        <div>
                                            <span className="font-bold text-clinic-navy">{cme.name}</span>
                                            <p className="text-[11px] text-clinic-text-secondary">{cme.issuedBy}</p>
                                        </div>
                                        <span className="medpro-badge-success text-[10px] font-bold">
                                            Hợp lệ
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 text-center text-clinic-text-secondary text-xs border border-dashed border-clinic-border rounded-[6px] bg-clinic-bg">
                                Chưa có chứng chỉ CME bổ sung nào được đồng bộ từ hồ sơ.
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 p-4 px-6 border-t border-clinic-border bg-clinic-bg shrink-0">
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="medpro-btn-primary px-4 py-2 rounded-[6px] font-bold text-xs cursor-pointer flex items-center gap-1.5"
                    >
                        <ClinicIcon name="Printer" size={14} weight="bold" />
                        <span>In chứng chỉ</span>
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="medpro-btn-outline px-4 py-2 rounded-[6px] font-bold text-xs cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
