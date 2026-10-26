import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AppToast } from '../common/AppNotification'

export default function DoctorShiftRequestModal({ isOpen, onClose, onRequestSubmitted }) {
    // 3 Tab: 'SWAP' (Đổi ca) | 'LEAVE' (Xin nghỉ) | 'HISTORY' (Lịch sử đơn)
    const [activeTab, setActiveTab] = useState('SWAP')

    // Danh sách các đơn yêu cầu đã gửi (sẵn sàng đón nhận từ Backend qua API GET /api/Doctor/shift-requests)
    const [requestHistory, setRequestHistory] = useState([])

    // State Form Đổi ca trực
    const [swapForm, setSwapForm] = useState({
        currentDate: '',
        currentShift: 'MORNING', // MORNING | AFTERNOON
        targetDate: '',
        targetShift: 'MORNING',
        substituteDoctor: '',
        reason: '',
    })

    // State Form Xin nghỉ trực
    const [leaveForm, setLeaveForm] = useState({
        leaveType: 'ANNUAL', // ANNUAL | SICK | CONFERENCE | PERSONAL
        startDate: '',
        endDate: '',
        shiftScope: 'ALL_DAY', // ALL_DAY | MORNING | AFTERNOON
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

    // Submit Đơn Đổi ca trực
    const handleSwapSubmit = (e) => {
        e.preventDefault()
        if (!swapForm.currentDate || !swapForm.targetDate) {
            AppToast.warning('Vui lòng chọn ngày ca hiện tại và ngày mong muốn đổi sang!')
            return
        }
        if (!swapForm.reason.trim()) {
            AppToast.warning('Vui lòng nhập lý do đổi ca trực!')
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
            status: 'PENDING', // PENDING | APPROVED | REJECTED
            statusLabel: 'Chờ Trưởng khoa duyệt',
        }

        setRequestHistory((prev) => [newRequest, ...prev])
        if (onRequestSubmitted) onRequestSubmitted(newRequest)

        AppToast.success('Đã gửi phiếu yêu cầu đổi ca trực tới Ban Điều Hành!')
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

    // Submit Đơn Xin nghỉ trực
    const handleLeaveSubmit = (e) => {
        e.preventDefault()
        if (!leaveForm.startDate) {
            AppToast.warning('Vui lòng chọn ngày bắt đầu nghỉ!')
            return
        }
        if (!leaveForm.reason.trim()) {
            AppToast.warning('Vui lòng nhập lý do xin nghỉ!')
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

        AppToast.success('Đã nộp đơn xin nghỉ trực thành công!')
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex justify-center items-center py-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto relative">
                {/* Header Modal */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-[#E8F4FD] text-[#00B5F1] flex items-center justify-center text-lg font-bold">
                            🔄
                        </span>
                        <div>
                            <h3 className="text-base font-extrabold text-[#003553]">
                                Điều Chỉnh Ca Trực & Nghỉ Phép
                            </h3>
                            <p className="text-xs text-slate-400">
                                Gửi yêu cầu đổi ca trực hoặc làm đơn xin nghỉ phép gửi Ban Điều Hành
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

                {/* Tab Switcher */}
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100/80 text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => setActiveTab('SWAP')}
                        className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer text-center ${
                            activeTab === 'SWAP'
                                ? 'bg-white text-[#003553] shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        🔄 Đổi Ca Trực
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('LEAVE')}
                        className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer text-center ${
                            activeTab === 'LEAVE'
                                ? 'bg-white text-[#003553] shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        📝 Xin Nghỉ / Báo Vắng
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('HISTORY')}
                        className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                            activeTab === 'HISTORY'
                                ? 'bg-white text-[#003553] shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <span>📋 Đơn Đã Gửi</span>
                        {requestHistory.length > 0 && (
                            <span className="w-4 h-4 rounded-full bg-[#00B5F1] text-white text-[10px] flex items-center justify-center">
                                {requestHistory.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════
                    TAB 1: FORM YÊU CẦU ĐỔI CA TRỰC
                ═══════════════════════════════════════════════════════════════════ */}
                {activeTab === 'SWAP' && (
                    <form onSubmit={handleSwapSubmit} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Ngày ca trực cần đổi <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    name="currentDate"
                                    value={swapForm.currentDate}
                                    onChange={handleSwapChange}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                                />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Ca trực hiện tại
                                </label>
                                <select
                                    name="currentShift"
                                    value={swapForm.currentShift}
                                    onChange={handleSwapChange}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                                >
                                    <option value="MORNING">Ca Sáng (07:30 - 11:30)</option>
                                    <option value="AFTERNOON">Ca Chiều (13:30 - 17:00)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Ngày muốn đổi sang <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    name="targetDate"
                                    value={swapForm.targetDate}
                                    onChange={handleSwapChange}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                                />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Ca muốn nhận
                                </label>
                                <select
                                    name="targetShift"
                                    value={swapForm.targetShift}
                                    onChange={handleSwapChange}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                                >
                                    <option value="MORNING">Ca Sáng (07:30 - 11:30)</option>
                                    <option value="AFTERNOON">Ca Chiều (13:30 - 17:00)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block font-bold text-slate-700 mb-1">
                                Bác sĩ đồng ý đổi ca cùng (nếu đã thỏa thuận trước)
                            </label>
                            <input
                                type="text"
                                name="substituteDoctor"
                                value={swapForm.substituteDoctor}
                                onChange={handleSwapChange}
                                placeholder="Để trống nếu nhờ Ban Điều Hành xếp lịch tự động..."
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                            />
                        </div>

                        <div>
                            <label className="block font-bold text-slate-700 mb-1">
                                Lý do đề xuất đổi ca <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                rows="3"
                                name="reason"
                                value={swapForm.reason}
                                onChange={handleSwapChange}
                                placeholder="Ghi rõ lý do cần đổi ca trực (trùng lịch giảng dạy, việc gia đình...)"
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
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
                                <span>📤</span>
                                <span>Gửi yêu cầu đổi ca</span>
                            </button>
                        </div>
                    </form>
                )}

                {/* ═══════════════════════════════════════════════════════════════════
                    TAB 2: FORM ĐƠN XIN NGHỈ TRỰC / BÁO VẮNG
                ═══════════════════════════════════════════════════════════════════ */}
                {activeTab === 'LEAVE' && (
                    <form onSubmit={handleLeaveSubmit} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Loại đơn xin nghỉ
                                </label>
                                <select
                                    name="leaveType"
                                    value={leaveForm.leaveType}
                                    onChange={handleLeaveChange}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                                >
                                    <option value="ANNUAL">Nghỉ phép năm</option>
                                    <option value="SICK">Nghỉ ốm / Khám bệnh</option>
                                    <option value="CONFERENCE">Tham dự hội nghị y khoa / Công tác</option>
                                    <option value="PERSONAL">Việc gia đình cá nhân</option>
                                </select>
                            </div>
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Phạm vi ca nghỉ
                                </label>
                                <select
                                    name="shiftScope"
                                    value={leaveForm.shiftScope}
                                    onChange={handleLeaveChange}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                                >
                                    <option value="ALL_DAY">Toàn bộ ngày nghỉ</option>
                                    <option value="MORNING">Chỉ nghỉ Ca Sáng</option>
                                    <option value="AFTERNOON">Chỉ nghỉ Ca Chiều</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Từ ngày <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    name="startDate"
                                    value={leaveForm.startDate}
                                    onChange={handleLeaveChange}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                                />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Đến ngày (để trống nếu nghỉ 1 ngày)
                                </label>
                                <input
                                    type="date"
                                    name="endDate"
                                    value={leaveForm.endDate}
                                    onChange={handleLeaveChange}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block font-bold text-slate-700 mb-1">
                                Bác sĩ nhận bàn giao phụ trách (nếu có)
                            </label>
                            <input
                                type="text"
                                name="substituteDoctor"
                                value={leaveForm.substituteDoctor}
                                onChange={handleLeaveChange}
                                placeholder="Tên bác sĩ nhận thay thế hoặc để trống..."
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                            />
                        </div>

                        <div>
                            <label className="block font-bold text-slate-700 mb-1">
                                Lý do xin nghỉ phép <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                rows="3"
                                name="reason"
                                value={leaveForm.reason}
                                onChange={handleLeaveChange}
                                placeholder="Ghi rõ lý do nghỉ phép gửi Ban Điều Hành phòng khám duyệt..."
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white transition"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 rounded-xl bg-[#003553] hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition cursor-pointer active:scale-95 flex items-center gap-1.5"
                            >
                                <span>📝</span>
                                <span>Nộp đơn xin nghỉ</span>
                            </button>
                        </div>
                    </form>
                )}

                {/* ═══════════════════════════════════════════════════════════════════
                    TAB 3: LỊCH SỬ CÁC ĐƠN YÊU CẦU ĐÃ NỘP
                ═══════════════════════════════════════════════════════════════════ */}
                {activeTab === 'HISTORY' && (
                    <div className="space-y-3">
                        {requestHistory.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-1">
                                <span className="text-2xl block">📋</span>
                                <p className="font-bold text-slate-600">Chưa có đơn yêu cầu nào</p>
                                <p className="text-[11px] text-slate-400">
                                    Các đơn đổi ca hoặc xin nghỉ bạn đã gửi sẽ được lưu và hiển thị tại đây.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                                {requestHistory.map((item) => (
                                    <div key={item.id} className="p-3 bg-white space-y-1.5 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="font-extrabold text-[#003553]">
                                                {item.typeLabel}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                {item.statusLabel}
                                            </span>
                                        </div>
                                        <p className="text-slate-700 font-medium">{item.details}</p>
                                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                                            <span>Bàn giao: {item.substitute}</span>
                                            <span>Gửi lúc: {item.createdAt}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
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
