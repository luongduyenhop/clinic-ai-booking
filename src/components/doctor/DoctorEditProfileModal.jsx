import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AppToast } from '../common/AppNotification'

export default function DoctorEditProfileModal({ isOpen, onClose, currentInfo, onSave }) {
    const [formData, setFormData] = useState({
        name: currentInfo?.name || '',
        specialty: currentInfo?.specialty || '',
        code: currentInfo?.code || '',
        room: currentInfo?.room || '',
        phone: currentInfo?.phone || '',
        email: currentInfo?.email || '',
        degree: currentInfo?.degree || '',
        experience: currentInfo?.experience || '',
    })

    if (!isOpen) return null

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!formData.name.trim()) {
            AppToast.warning('Họ và tên bác sĩ không được để trống!')
            return
        }
        onSave(formData)
        AppToast.success('Cập nhật thông tin hồ sơ bác sĩ thành công!')
        onClose()
    }

    return createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex justify-center items-center py-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto relative">
                {/* Header Modal */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-[#E8F4FD] text-[#00B5F1] flex items-center justify-center text-lg font-bold">
                            ✏️
                        </span>
                        <div>
                            <h3 className="text-base font-extrabold text-[#003553]">
                                Chỉnh Sửa Hồ Sơ Bác Sĩ
                            </h3>
                            <p className="text-xs text-slate-400">
                                Cập nhật thông tin định danh và phòng làm việc
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

                {/* Form cập nhật */}
                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    <div>
                        <label className="block font-bold text-slate-700 mb-1">
                            Họ và tên Bác sĩ <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white focus:ring-2 focus:ring-[#00B5F1]/10 transition font-medium"
                            placeholder="Ví dụ: BS. CKI Nguyễn Văn An"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">
                                Học vị / Học hàm
                            </label>
                            <input
                                type="text"
                                name="degree"
                                value={formData.degree}
                                onChange={handleChange}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                                placeholder="BS. CKI, ThS. BS..."
                            />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">
                                Mã Bác sĩ
                            </label>
                            <input
                                type="text"
                                name="code"
                                value={formData.code}
                                onChange={handleChange}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                                placeholder="DOC-2026-08"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">
                                Chuyên khoa
                            </label>
                            <input
                                type="text"
                                name="specialty"
                                value={formData.specialty}
                                onChange={handleChange}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                                placeholder="Nội Tim Mạch & Đa Khoa"
                            />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">
                                Phòng khám trực
                            </label>
                            <input
                                type="text"
                                name="room"
                                value={formData.room}
                                onChange={handleChange}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                                placeholder="Phòng 204 - Tầng 2"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">
                                Số điện thoại liên hệ
                            </label>
                            <input
                                type="text"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                                placeholder="0903 888 999"
                            />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">
                                Email công tác
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                                placeholder="doctor@clinic.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block font-bold text-slate-700 mb-1">
                            Giới thiệu kinh nghiệm & chuyên môn
                        </label>
                        <textarea
                            rows="3"
                            name="experience"
                            value={formData.experience}
                            onChange={handleChange}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                            placeholder="Mô tả quá trình công tác, bệnh viện từng làm việc..."
                        />
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 rounded-xl bg-[#00B5F1] hover:bg-sky-500 text-white font-bold text-xs shadow-sm transition cursor-pointer active:scale-95 flex items-center gap-1.5"
                        >
                            <span>💾</span>
                            <span>Lưu thay đổi</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    )
}
