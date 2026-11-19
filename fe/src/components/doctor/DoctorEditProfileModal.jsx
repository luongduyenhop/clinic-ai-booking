import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AppToast } from '../common/AppNotification'
import { ClinicIcon } from '../common/ClinicIcon'

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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-clinic-navy/60 backdrop-blur-xs p-4 flex justify-center items-center py-6">
            <div className="bg-clinic-surface rounded-[6px] max-w-lg w-full flex flex-col max-h-[85vh] border border-clinic-border relative overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-clinic-border shrink-0 bg-clinic-bg">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-[6px] bg-clinic-surface-alt text-clinic-cta border border-clinic-info-border flex items-center justify-center">
                            <ClinicIcon name="PencilSimple" size={18} weight="bold" />
                        </span>
                        <div>
                            <h3 className="text-base font-extrabold text-clinic-navy">
                                Chỉnh Sửa Hồ Sơ Bác Sĩ
                            </h3>
                            <p className="text-xs text-clinic-text-secondary">
                                Cập nhật thông tin định danh và phòng làm việc
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label="Đóng hộp thoại"
                        onClick={onClose}
                        className="w-8 h-8 rounded-[6px] bg-clinic-bg-muted hover:bg-clinic-border text-clinic-text-secondary flex items-center justify-center cursor-pointer transition"
                    >
                        <ClinicIcon name="X" size={16} weight="bold" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 text-xs">
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div>
                            <label htmlFor="doc-edit-name" className="medpro-label">
                                Họ và tên Bác sĩ <span className="text-clinic-danger">*</span>
                            </label>
                            <input
                                id="doc-edit-name"
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="medpro-input font-medium"
                                placeholder="Ví dụ: BS. CKI Nguyễn Văn An"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="doc-edit-degree" className="medpro-label">
                                    Học vị / Học hàm
                                </label>
                                <input
                                    id="doc-edit-degree"
                                    type="text"
                                    name="degree"
                                    value={formData.degree}
                                    onChange={handleChange}
                                    className="medpro-input"
                                    placeholder="BS. CKI, ThS. BS..."
                                />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label htmlFor="doc-edit-code" className="medpro-label !mb-0">
                                        Mã Bác sĩ
                                    </label>
                                    <span className="medpro-badge-info text-[10px] font-bold">
                                        Hệ thống tự sinh
                                    </span>
                                </div>
                                <input
                                    id="doc-edit-code"
                                    type="text"
                                    name="code"
                                    value={formData.code}
                                    readOnly
                                    disabled
                                    className="w-full rounded-[6px] border border-clinic-border bg-clinic-bg-muted text-clinic-text-muted font-mono font-bold px-3 py-2 text-xs cursor-not-allowed select-none tabular-nums"
                                    title="Mã Bác sĩ do hệ thống quản lý, không được phép chỉnh sửa"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="doc-edit-specialty" className="medpro-label">
                                    Chuyên khoa
                                </label>
                                <input
                                    id="doc-edit-specialty"
                                    type="text"
                                    name="specialty"
                                    value={formData.specialty}
                                    onChange={handleChange}
                                    className="medpro-input"
                                    placeholder="Nội Tim Mạch & Đa Khoa"
                                />
                            </div>
                            <div>
                                <label htmlFor="doc-edit-room" className="medpro-label">
                                    Phòng khám trực
                                </label>
                                <input
                                    id="doc-edit-room"
                                    type="text"
                                    name="room"
                                    value={formData.room}
                                    onChange={handleChange}
                                    className="medpro-input"
                                    placeholder="Phòng 204 - Tầng 2"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="doc-edit-phone" className="medpro-label">
                                    Số điện thoại liên hệ
                                </label>
                                <input
                                    id="doc-edit-phone"
                                    type="text"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="medpro-input tabular-nums"
                                    placeholder="0903 888 999"
                                />
                            </div>
                            <div>
                                <label htmlFor="doc-edit-email" className="medpro-label">
                                    Email công tác
                                </label>
                                <input
                                    id="doc-edit-email"
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="medpro-input"
                                    placeholder="doctor@clinic.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="doc-edit-experience" className="medpro-label">
                                Giới thiệu kinh nghiệm &amp; chuyên môn
                            </label>
                            <textarea
                                id="doc-edit-experience"
                                rows="3"
                                name="experience"
                                value={formData.experience}
                                onChange={handleChange}
                                className="medpro-input"
                                placeholder="Mô tả quá trình công tác, bệnh viện từng làm việc..."
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 p-4 px-6 border-t border-clinic-border bg-clinic-bg shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="medpro-btn-outline px-4 py-2 rounded-[6px] font-bold text-xs cursor-pointer"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            className="medpro-btn-primary px-5 py-2 rounded-[6px] font-bold text-xs cursor-pointer flex items-center gap-1.5"
                        >
                            <ClinicIcon name="FloppyDisk" size={14} weight="bold" />
                            <span>Lưu thay đổi</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    )
}
