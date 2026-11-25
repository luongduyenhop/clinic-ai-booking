import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AppToast } from '../common/AppNotification'
import { ClinicIcon } from '../common/ClinicIcon'

export default function DoctorShiftRequestModal({ isOpen, onClose, onRequestSubmitted }) {
    const [activeTab, setActiveTab] = useState('SWAP')
    const [requestHistory, setRequestHistory] = useState([])

    const [swapForm, setSwapForm] = useState({
        currentDate: '',
        currentShift: 'MORNING',
        targetDate: '',
        targetShift: 'MORNING',
        substituteDoctor: '',
        reason: '',
    })

    const [leaveForm, setLeaveForm] = useState({
        leaveType: 'ANNUAL',
        startDate: '',
        endDate: '',
        shiftScope: 'ALL_DAY',
        substituteDoctor: '',
        handoverNotes: '',
        reason: '',
    })

    if (!isOpen) return null

    const handleSwapChange = (e) => {
        const { name, value } = e.target
        setSwapForm((prev) => ({ ...prev, [name]: value }))
    }

    const handleLeaveChange = (e) => {
        const { name, value } = e.target
        setLeaveForm((prev) => ({ ...prev, [name]: value }))
    }

    const handleSwapSubmit = (e) => {
        e.preventDefault()
        if (!swapForm.currentDate || !swapForm.targetDate) {
            AppToast.warning('Vui lòng chọn ngày ca hiện tại và ngày mong muốn đổi sang')
            return
        }
        if (!swapForm.reason.trim()) {
            AppToast.warning('Vui lòng nhập lý do đổi ca trực')
            return
        }

        const newRequest = {
            id: Date.now(),
            type: 'SWAP',
            typeLabel: 'Đổi ca trực',
            createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
            details: `Đổi ca ${swapForm.currentShift === 'MORNING' ? 'Sáng' : 'Chiều'} (${swapForm.currentDate}) sang ${swapForm.targetShift === 'MORNING' ? 'Sáng' : 'Chiều'} (${swapForm.targetDate})`,
            substitute: swapForm.substituteDoctor.trim() || 'Nhờ Khoa điều phối',
            reason: swapForm.reason.trim(),
            status: 'PENDING',
            statusLabel: 'Chờ Trưởng khoa duyệt',
        }

        setRequestHistory((prev) => [newRequest, ...prev])
        if (onRequestSubmitted) onRequestSubmitted(newRequest)

        AppToast.success('Đã gửi phiếu yêu cầu đổi ca trực tới Ban Điều Hành')
        setSwapForm({
            currentDate: '',
            currentShift: 'MORNING',
            targetDate: '',
            targetShift: 'MORNING',
            substituteDoctor: '',
            reason: '',
        })
        setActiveTab('HISTORY')
    }

    const handleLeaveSubmit = (e) => {
        e.preventDefault()
        if (!leaveForm.startDate) {
            AppToast.warning('Vui lòng chọn ngày bắt đầu nghỉ')
            return
        }
        if (!leaveForm.reason.trim()) {
            AppToast.warning('Vui lòng nhập lý do xin nghỉ')
            return
        }

        const leaveTypeNames = {
            ANNUAL: 'Nghỉ phép năm',
            SICK: 'Nghỉ ốm / Khám bệnh',
            CONFERENCE: 'Hội nghị / Công tác',
            PERSONAL: 'Việc cá nhân',
        }

        const newRequest = {
            id: Date.now(),
            type: 'LEAVE',
            typeLabel: 'Xin nghỉ trực / Báo vắng',
            createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
            details: `Xin nghỉ ${leaveTypeNames[leaveForm.leaveType] || 'Nghỉ phép'}: ${leaveForm.startDate} ${leaveForm.endDate ? 'đến ' + leaveForm.endDate : ''} (${leaveForm.shiftScope === 'ALL_DAY' ? 'Cả ngày' : leaveForm.shiftScope === 'MORNING' ? 'Ca sáng' : 'Ca chiều'})`,
            substitute: leaveForm.substituteDoctor.trim() || 'Không có bàn giao',
            reason: leaveForm.reason.trim(),
            status: 'PENDING',
            statusLabel: 'Chờ Trưởng khoa duyệt',
        }

        setRequestHistory((prev) => [newRequest, ...prev])
        if (onRequestSubmitted) onRequestSubmitted(newRequest)

        AppToast.success('Đã nộp đơn xin nghỉ trực thành công')
        setLeaveForm({
            leaveType: 'ANNUAL',
            startDate: '',
            endDate: '',
            shiftScope: 'ALL_DAY',
            substituteDoctor: '',
            handoverNotes: '',
            reason: '',
        })
        setActiveTab('HISTORY')
    }

    return createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-clinic-navy/60 backdrop-blur-xs p-4 flex justify-center items-center py-6">
            <div className="bg-clinic-surface rounded-[6px] max-w-xl w-full p-6 space-y-5 border border-clinic-border max-h-[90vh] overflow-y-auto relative">
                <div className="flex items-center justify-between pb-3 border-b border-clinic-border">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-[6px] bg-clinic-surface-alt border border-clinic-info-border text-clinic-cta flex items-center justify-center">
                            <ClinicIcon name="ArrowsClockwise" size={18} weight="bold" />
                        </span>
                        <div>
                            <h3 className="text-base font-extrabold text-clinic-navy">
                                Điều Chỉnh Ca Trực &amp; Nghỉ Phép
                            </h3>
                            <p className="text-xs text-clinic-text-secondary">
                                Gửi yêu cầu đổi ca trực hoặc làm đơn xin nghỉ phép gửi Ban Điều Hành
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label="Đóng hộp thoại điều chỉnh ca trực"
                        onClick={onClose}
                        className="w-8 h-8 rounded-[6px] bg-clinic-bg-muted hover:bg-clinic-border text-clinic-text-secondary flex items-center justify-center cursor-pointer transition"
                    >
                        <ClinicIcon name="X" size={16} weight="bold" />
                    </button>
                </div>

                <div className="flex items-center gap-1.5 p-1 rounded-[6px] bg-clinic-bg border border-clinic-border text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => setActiveTab('SWAP')}
                        className={`flex-1 py-2 px-3 rounded-[4px] transition cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                            activeTab === 'SWAP'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <ClinicIcon name="ArrowsClockwise" size={14} />
                        <span>Đổi Ca Trực</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('LEAVE')}
                        className={`flex-1 py-2 px-3 rounded-[4px] transition cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                            activeTab === 'LEAVE'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <ClinicIcon name="CalendarX" size={14} />
                        <span>Xin Nghỉ / Báo Vắng</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('HISTORY')}
                        className={`flex-1 py-2 px-3 rounded-[4px] transition cursor-pointer inline-flex items-center justify-center gap-1.5 tabular-nums ${
                            activeTab === 'HISTORY'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <ClinicIcon name="ClipboardText" size={14} />
                        <span>Đơn Đã Gửi</span>
                        {requestHistory.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-[4px] bg-clinic-cta text-clinic-surface text-[10px]">
                                {requestHistory.length}
                            </span>
                        )}
                    </button>
                </div>

                {activeTab === 'SWAP' && (
                    <form onSubmit={handleSwapSubmit} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="swap-current-date" className="medpro-label">
                                    Ngày ca trực cần đổi <span className="text-clinic-danger">*</span>
                                </label>
                                <input
                                    id="swap-current-date"
                                    type="date"
                                    name="currentDate"
                                    value={swapForm.currentDate}
                                    onChange={handleSwapChange}
                                    className="medpro-input tabular-nums"
                                />
                            </div>
                            <div>
                                <label htmlFor="swap-current-shift" className="medpro-label">
                                    Ca trực hiện tại
                                </label>
                                <select
                                    id="swap-current-shift"
                                    name="currentShift"
                                    value={swapForm.currentShift}
                                    onChange={handleSwapChange}
                                    className="medpro-input"
                                >
                                    <option value="MORNING">Ca Sáng (07:30 - 11:30)</option>
                                    <option value="AFTERNOON">Ca Chiều (13:30 - 17:00)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="swap-target-date" className="medpro-label">
                                    Ngày muốn đổi sang <span className="text-clinic-danger">*</span>
                                </label>
                                <input
                                    id="swap-target-date"
                                    type="date"
                                    name="targetDate"
                                    value={swapForm.targetDate}
                                    onChange={handleSwapChange}
                                    className="medpro-input tabular-nums"
                                />
                            </div>
                            <div>
                                <label htmlFor="swap-target-shift" className="medpro-label">
                                    Ca muốn nhận
                                </label>
                                <select
                                    id="swap-target-shift"
                                    name="targetShift"
                                    value={swapForm.targetShift}
                                    onChange={handleSwapChange}
                                    className="medpro-input"
                                >
                                    <option value="MORNING">Ca Sáng (07:30 - 11:30)</option>
                                    <option value="AFTERNOON">Ca Chiều (13:30 - 17:00)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="swap-substitute" className="medpro-label">
                                Bác sĩ đồng ý đổi ca cùng (nếu đã thỏa thuận trước)
                            </label>
                            <input
                                id="swap-substitute"
                                type="text"
                                name="substituteDoctor"
                                value={swapForm.substituteDoctor}
                                onChange={handleSwapChange}
                                placeholder="Để trống nếu nhờ Ban Điều Hành xếp lịch tự động..."
                                className="medpro-input"
                            />
                        </div>

                        <div>
                            <label htmlFor="swap-reason" className="medpro-label">
                                Lý do đề xuất đổi ca <span className="text-clinic-danger">*</span>
                            </label>
                            <textarea
                                id="swap-reason"
                                rows="3"
                                name="reason"
                                value={swapForm.reason}
                                onChange={handleSwapChange}
                                placeholder="Ghi rõ lý do cần đổi ca trực (trùng lịch giảng dạy, việc gia đình...)"
                                className="medpro-input"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-clinic-border">
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
                                <ClinicIcon name="PaperPlaneTilt" size={14} weight="bold" />
                                <span>Gửi yêu cầu đổi ca</span>
                            </button>
                        </div>
                    </form>
                )}

                {activeTab === 'LEAVE' && (
                    <form onSubmit={handleLeaveSubmit} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="leave-type" className="medpro-label">
                                    Loại đơn xin nghỉ
                                </label>
                                <select
                                    id="leave-type"
                                    name="leaveType"
                                    value={leaveForm.leaveType}
                                    onChange={handleLeaveChange}
                                    className="medpro-input"
                                >
                                    <option value="ANNUAL">Nghỉ phép năm</option>
                                    <option value="SICK">Nghỉ ốm / Khám bệnh</option>
                                    <option value="CONFERENCE">Tham dự hội nghị y khoa / Công tác</option>
                                    <option value="PERSONAL">Việc gia đình cá nhân</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="leave-scope" className="medpro-label">
                                    Phạm vi ca nghỉ
                                </label>
                                <select
                                    id="leave-scope"
                                    name="shiftScope"
                                    value={leaveForm.shiftScope}
                                    onChange={handleLeaveChange}
                                    className="medpro-input"
                                >
                                    <option value="ALL_DAY">Toàn bộ ngày nghỉ</option>
                                    <option value="MORNING">Chỉ nghỉ Ca Sáng</option>
                                    <option value="AFTERNOON">Chỉ nghỉ Ca Chiều</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="leave-start" className="medpro-label">
                                    Từ ngày <span className="text-clinic-danger">*</span>
                                </label>
                                <input
                                    id="leave-start"
                                    type="date"
                                    name="startDate"
                                    value={leaveForm.startDate}
                                    onChange={handleLeaveChange}
                                    className="medpro-input tabular-nums"
                                />
                            </div>
                            <div>
                                <label htmlFor="leave-end" className="medpro-label">
                                    Đến ngày (để trống nếu nghỉ 1 ngày)
                                </label>
                                <input
                                    id="leave-end"
                                    type="date"
                                    name="endDate"
                                    value={leaveForm.endDate}
                                    onChange={handleLeaveChange}
                                    className="medpro-input tabular-nums"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="leave-substitute" className="medpro-label">
                                Bác sĩ nhận bàn giao phụ trách (nếu có)
                            </label>
                            <input
                                id="leave-substitute"
                                type="text"
                                name="substituteDoctor"
                                value={leaveForm.substituteDoctor}
                                onChange={handleLeaveChange}
                                placeholder="Tên bác sĩ nhận thay thế hoặc để trống..."
                                className="medpro-input"
                            />
                        </div>

                        <div>
                            <label htmlFor="leave-reason" className="medpro-label">
                                Lý do xin nghỉ phép <span className="text-clinic-danger">*</span>
                            </label>
                            <textarea
                                id="leave-reason"
                                rows="3"
                                name="reason"
                                value={leaveForm.reason}
                                onChange={handleLeaveChange}
                                placeholder="Ghi rõ lý do nghỉ phép gửi Ban Điều Hành phòng khám duyệt..."
                                className="medpro-input"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-clinic-border">
                            <button
                                type="button"
                                onClick={onClose}
                                className="medpro-btn-outline px-4 py-2 rounded-[6px] font-bold text-xs cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 rounded-[6px] bg-clinic-navy hover:bg-clinic-navy-dark text-clinic-surface font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                            >
                                <ClinicIcon name="FileText" size={14} weight="bold" />
                                <span>Nộp đơn xin nghỉ</span>
                            </button>
                        </div>
                    </form>
                )}

                {activeTab === 'HISTORY' && (
                    <div className="space-y-3">
                        {requestHistory.length === 0 ? (
                            <div className="py-12 text-center text-clinic-text-secondary text-xs border border-dashed border-clinic-border rounded-[6px] bg-clinic-bg space-y-1.5">
                                <ClinicIcon name="ClipboardText" size={24} className="mx-auto text-clinic-text-subtle" />
                                <p className="font-bold text-clinic-navy">Chưa có đơn yêu cầu nào</p>
                                <p className="text-[11px] text-clinic-text-secondary">
                                    Các đơn đổi ca hoặc xin nghỉ bạn đã gửi sẽ được lưu và hiển thị tại đây.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-clinic-border border border-clinic-border rounded-[6px] overflow-hidden max-h-60 overflow-y-auto">
                                {requestHistory.map((item) => (
                                    <div key={item.id} className="p-3 bg-clinic-surface space-y-1.5 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="font-extrabold text-clinic-navy">
                                                {item.typeLabel}
                                            </span>
                                            <span className="medpro-badge-warning text-[10px] font-bold">
                                                {item.statusLabel}
                                            </span>
                                        </div>
                                        <p className="text-clinic-text font-medium">{item.details}</p>
                                        <div className="flex items-center justify-between text-[11px] text-clinic-text-secondary pt-0.5 tabular-nums">
                                            <span>Bàn giao: {item.substitute}</span>
                                            <span>Gửi lúc: {item.createdAt}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end pt-2 border-t border-clinic-border">
                            <button
                                type="button"
                                onClick={onClose}
                                className="medpro-btn-outline px-4 py-2 rounded-[6px] font-bold text-xs cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}
