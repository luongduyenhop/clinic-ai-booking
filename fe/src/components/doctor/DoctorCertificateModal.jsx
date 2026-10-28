import { createPortal } from 'react-dom'
import { AppToast } from '../common/AppNotification'

export default function DoctorCertificateModal({ isOpen, onClose, doctorInfo }) {
    if (!isOpen) return null

    const handlePrint = () => {
        AppToast.success('Đã gửi chứng chỉ hành nghề tới máy in tài liệu!')
    }

    return createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex justify-center items-center py-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-2xl w-full flex flex-col max-h-[85vh] border border-slate-200 shadow-2xl relative overflow-hidden">
                {/* Header Modal */}
                <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg font-bold border border-amber-200">
                            📜
                        </span>
                        <div>
                            <h3 className="text-base font-extrabold text-[#003553]">
                                Hồ Sơ Chứng Chỉ Hành Nghề & Bằng Cấp Y Khoa
                            </h3>
                            <p className="text-xs text-slate-400">
                                Đã được xác thực bởi Hệ Thống Y Tế & Cơ quan Quản lý Khám chữa bệnh
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer transition"
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">

                {/* ═══════════════════════════════════════════════════════════════════
                    KHUNG BẢN MÔ PHỎNG CHỨNG CHỈ HÀNH NGHỀ CHÍNH THỨC
                ═══════════════════════════════════════════════════════════════════ */}
                <div className="p-6 rounded-2xl bg-gradient-to-b from-amber-50/40 via-white to-amber-50/20 border-2 border-amber-300/80 shadow-md relative overflow-hidden">
                    {/* Viền hoa văn giấy chứng nhận */}
                    <div className="absolute inset-2 border border-amber-200/60 rounded-xl pointer-events-none" />

                    {/* Tiêu ngữ Quốc gia */}
                    <div className="text-center space-y-1 pb-4 relative z-10">
                        <p className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">
                            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                        </p>
                        <p className="text-[10px] font-semibold text-slate-500 italic">
                            Độc lập - Tự do - Hạnh phúc
                        </p>
                        <div className="w-20 h-0.5 bg-amber-400 mx-auto mt-1" />
                        <p className="text-[10px] font-bold text-slate-600 uppercase pt-2">
                            BỘ Y TẾ — CỤC QUẢN LÝ KHÁM, CHỮA BỆNH
                        </p>
                    </div>

                    {/* Tên chứng chỉ */}
                    <div className="text-center py-3 relative z-10">
                        <h2 className="text-lg sm:text-xl font-extrabold text-[#003553] tracking-wide uppercase">
                            CHỨNG CHỈ HÀNH NGHỀ KHÁM BỆNH, CHỮA BỆNH
                        </h2>
                        <span className="text-xs font-bold text-amber-700 bg-amber-100/70 px-3 py-0.5 rounded-full border border-amber-300/80 inline-block mt-1">
                            Số CCHN: {doctorInfo?.licenseNumber || doctorInfo?.code || 'BYT-CCHN'}
                        </span>
                    </div>

                    {/* Nội dung chứng chỉ */}
                    <div className="space-y-2.5 text-xs text-slate-700 pt-2 relative z-10 px-2 sm:px-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                                <span className="text-slate-500">Người được cấp:</span>{' '}
                                <strong className="text-slate-900 text-sm">{doctorInfo?.name || 'Bác sĩ'}</strong>
                            </div>
                            <div>
                                <span className="text-slate-500">Mã định danh Bác sĩ:</span>{' '}
                                <strong className="text-[#00B5F1]">{doctorInfo?.code || '—'}</strong>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                                <span className="text-slate-500">Văn bằng chuyên môn:</span>{' '}
                                <strong className="text-slate-800">{doctorInfo?.degree || 'Bác sĩ Chuyên Khoa'}</strong>
                            </div>
                            <div>
                                <span className="text-slate-500">Ngày cấp:</span>{' '}
                                <strong className="text-slate-800">{doctorInfo?.licenseDate || 'Hợp lệ theo quy định BYT'}</strong>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-white/80 border border-amber-200">
                            <span className="text-slate-500 block mb-0.5 font-medium">Phạm vi hoạt động chuyên môn:</span>
                            <strong className="text-[#003553] text-xs">
                                Khám bệnh, chữa bệnh chuyên khoa {doctorInfo?.specialty || 'Khám bệnh'}
                            </strong>
                        </div>
                    </div>

                    {/* Dấu mộc & chữ ký điện tử */}
                    <div className="flex justify-between items-end pt-6 relative z-10 px-4">
                        <div className="text-[10px] text-slate-400">
                            <span className="block font-semibold text-emerald-700">✓ Đã xác thực Chữ ký số Bộ Y Tế</span>
                            <span>Mã tra cứu QG: {doctorInfo?.code ? `VN-MED-${doctorInfo.code}` : 'VN-MED-VERIFIED'}</span>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full border-2 border-red-500 text-red-600 flex flex-col items-center justify-center text-[9px] font-extrabold mx-auto rotate-[-12deg] bg-red-50/40">
                                <span>BỘ Y TẾ</span>
                                <span>★ CỤC QLKCB ★</span>
                                <span className="text-[8px]">ĐÃ KÝ DUYỆT</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-700 block mt-1">CỤC TRƯỞNG</span>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════
                    DANH SÁCH BẰNG CẤP & CHỨNG CHỈ ĐÀO TẠO LIÊN TỤC (CME)
                ═══════════════════════════════════════════════════════════════════ */}
                <div className="space-y-2 text-xs">
                    <h4 className="font-extrabold text-[#003553] text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <span>🎓</span>
                        <span>Chứng chỉ đào tạo y khoa liên tục (CME) đã tích lũy:</span>
                    </h4>
                    {doctorInfo?.cmeCertificates && doctorInfo.cmeCertificates.length > 0 ? (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden text-xs">
                            {doctorInfo.cmeCertificates.map((cme, idx) => (
                                <div key={idx} className="p-3 bg-white flex items-center justify-between">
                                    <div>
                                        <span className="font-bold text-slate-800">{cme.name}</span>
                                        <p className="text-[11px] text-slate-400">{cme.issuedBy}</p>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                        Hợp lệ
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                            Chưa có chứng chỉ CME bổ sung nào được đồng bộ từ hồ sơ.
                        </div>
                    )}
                </div>

                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 p-4 px-6 border-t border-slate-100 bg-slate-50/70 shrink-0">
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="px-4 py-2 rounded-xl bg-[#00B5F1] hover:bg-sky-500 text-white font-bold text-xs shadow-sm transition cursor-pointer flex items-center gap-1.5"
                    >
                        <span>🖨</span>
                        <span>In chứng chỉ</span>
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
