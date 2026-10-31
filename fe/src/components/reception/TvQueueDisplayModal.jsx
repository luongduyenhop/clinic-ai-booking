import { useState, useEffect } from 'react'
import {
    Television,
    SpeakerHigh,
    X,
    ArrowsOutSimple,
    ArrowsInSimple,
    UserFocus,
    Clock,
    Hospital,
    CheckCircle,
} from '@phosphor-icons/react'
import { AppToast } from '../common/AppNotification'

/**
 * Màn hình TV Gọi Số Phòng Chờ (Kế thừa và nâng cấp từ QueueNumberPage.jsx của TheDuckHospital)
 * Hỗ trợ:
 * - Hiển thị số thứ tự ĐANG KHÁM & TIẾP THEO khổ lớn cho bệnh nhân tại sảnh chờ
 * - Phát âm thanh đọc số tự động bằng giọng nói Tiếng Việt (Web Speech API)
 * - Gọi số tiếp theo 1-chạm theo từng phòng khám
 */
export default function TvQueueDisplayModal({ isOpen, onClose, queueList = [], rooms = [], onCallNextRoom }) {
    const [now, setNow] = useState(new Date())
    const [lastCalledTicket, setLastCalledTicket] = useState(null)
    const [isFullscreen, setIsFullscreen] = useState(false)

    useEffect(() => {
        if (!isOpen) return
        const timer = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(timer)
    }, [isOpen])

    if (!isOpen) return null

    const speakCallPatient = (ticketNumber, patientName, roomName) => {
        try {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel()
                const msg = new SpeechSynthesisUtterance(
                    `Xin mời bệnh nhân số ${ticketNumber}, ${patientName}, vào ${roomName}`
                )
                msg.lang = 'vi-VN'
                msg.rate = 0.95
                window.speechSynthesis.speak(msg)
            }
        } catch {
            // Bỏ qua nếu trình duyệt chặn Speech API
        }
        setLastCalledTicket({ ticketNumber, patientName, roomName, time: new Date().toLocaleTimeString('vi-VN') })
        AppToast.info(`🔊 Đang phát loa: Mời số ${ticketNumber} - ${patientName} vào ${roomName}`)
    }

    const toggleBrowserFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().catch(() => {})
            setIsFullscreen(true)
        } else {
            document.exitFullscreen?.().catch(() => {})
            setIsFullscreen(false)
        }
    }

    const activeRooms =
        rooms.length > 0
            ? rooms
            : [
                  { id: 'P101', name: 'Phòng 101 - Nội Tổng Quát', doctor: 'BS.CKI Nguyễn Văn Hùng' },
                  { id: 'P102', name: 'Phòng 102 - Ngoại Khoa', doctor: 'ThS.BS Trần Minh Tuấn' },
                  { id: 'P201', name: 'Phòng 201 - Mắt (Nhãn Khoa)', doctor: 'BS.CKII Lê Thu Hà' },
                  { id: 'P202', name: 'Phòng 202 - Tai Mũi Họng', doctor: 'BS.CKI Phạm Quốc Bảo' },
                  { id: 'P203', name: 'Phòng 203 - Răng Hàm Mặt', doctor: 'ThS.BS Hoàng Mai Anh' },
              ]

    // Phân loại Tier ưu tiên cho Màn hình TV Gọi Số (Lát cắt C - Tiered Priority)
    const getQueueTier = (entry) => {
        if (entry.priority === 'EMERGENCY' || entry.muc_do_uu_tien === 1 || entry.isEmergency) return 1
        if (entry.priority === 'URGENT' || entry.muc_do_uu_tien === 2) return 2
        if (entry.status === 'RETURN_AFTER_RESULT' || entry.trang_thai === 'co_ket_qua_cls' || entry.muc_do_uu_tien === 3) return 3
        if (entry.priority === 'PRIORITY' || entry.isSpecialPriority || entry.muc_do_uu_tien === 4) return 4
        return 5
    }

    const getRoomQueue = (room) => {
        const matched = queueList.filter(
            (q) =>
                (q.room && String(q.room).includes(room.id)) ||
                (q.roomName && q.roomName.includes(room.name)) ||
                (q.department && room.name.toLowerCase().includes(String(q.department).toLowerCase()))
        )
        return matched.sort((a, b) => {
            const tierA = getQueueTier(a)
            const tierB = getQueueTier(b)
            if (tierA !== tierB) return tierA - tierB
            const timeA = new Date(a.checkInTime || a.thoi_gian_check_in || 0).getTime()
            const timeB = new Date(b.checkInTime || b.thoi_gian_check_in || 0).getTime()
            return timeA - timeB
        })
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col overflow-hidden select-none">
            {/* Top TV Header */}
            <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 border-b border-teal-700/50 px-6 py-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
                        <Hospital size={28} weight="duotone" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-500 text-slate-950">
                                LIVE QUEUE TV
                            </span>
                            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-white">
                                HỆ THỐNG BẢNG ĐIỆN TỬ GỌI SỐ KHÁM BỆNH — CLINIC-AI HIS
                            </h2>
                        </div>
                        <p className="text-xs md:text-sm text-teal-200/80 mt-0.5">
                            Quý khách vui lòng theo dõi số thứ tự trên màn hình và lắng nghe loa thông báo trước cửa phòng khám
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right bg-slate-900/90 border border-slate-700 px-4 py-2 rounded-xl">
                        <div className="flex items-center gap-1.5 text-teal-400 text-xs font-semibold">
                            <Clock size={14} weight="bold" />
                            <span>{now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        </div>
                        <div className="text-2xl font-mono font-black text-white tracking-wider">
                            {now.toLocaleTimeString('vi-VN')}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={toggleBrowserFullscreen}
                        className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                        title="Toàn màn hình TV"
                    >
                        {isFullscreen ? <ArrowsInSimple size={22} /> : <ArrowsOutSimple size={22} />}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm flex items-center gap-1.5 transition cursor-pointer shadow-md"
                    >
                        <X size={18} weight="bold" />
                        Đóng TV
                    </button>
                </div>
            </div>

            {/* Banner thông báo ca vừa gọi loa */}
            {lastCalledTicket && (
                <div className="bg-amber-500 text-slate-950 px-6 py-3 flex items-center justify-between font-bold animate-pulse">
                    <div className="flex items-center gap-3 text-base md:text-lg">
                        <SpeakerHigh size={26} weight="fill" />
                        <span>
                            ĐANG GỌI LOA: Xin mời bệnh nhân số{' '}
                            <strong className="text-2xl font-black underline mx-1">{lastCalledTicket.ticketNumber}</strong> (
                            {lastCalledTicket.patientName}) vào <strong>{lastCalledTicket.roomName}</strong>!
                        </span>
                    </div>
                    <span className="text-xs font-mono bg-slate-950/20 px-2.5 py-1 rounded-lg">
                        Lúc {lastCalledTicket.time}
                    </span>
                </div>
            )}

            {/* Main Grid: Danh sách các Phòng Khám giống TheDuckHospital QueueNumberPage */}
            <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {activeRooms.map((room, idx) => {
                    const roomItems = getRoomQueue(room)
                    const fallbackSlice = queueList.slice(idx * 2, idx * 2 + 3)
                    const effectiveItems = roomItems.length > 0 ? roomItems : fallbackSlice

                    const currentExam =
                        effectiveItems.find(
                            (x) =>
                                x.status === 'IN_PROGRESS' ||
                                x.status === 'DANG_KHAM' ||
                                x.status === 'CALLED' ||
                                x.trang_thai === 'dang_kham'
                        ) || effectiveItems[0]

                    const waitingItems = effectiveItems.filter((x) => x !== currentExam).slice(0, 3)

                    const currentNumber =
                        currentExam?.queueNumber ||
                        currentExam?.so_thu_tu ||
                        currentExam?.stt ||
                        `A${101 + idx * 5}`
                    const currentName =
                        currentExam?.patientName ||
                        currentExam?.ho_ten ||
                        currentExam?.ten_benh_nhan ||
                        'Nguyễn Văn An'

                    return (
                        <div
                            key={room.id || idx}
                            className="bg-slate-900/90 border-2 border-slate-800 rounded-3xl flex flex-col justify-between overflow-hidden shadow-xl hover:border-teal-600/60 transition"
                        >
                            {/* Room Header */}
                            <div className="bg-slate-800/90 px-5 py-3.5 border-b border-slate-700 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-extrabold text-teal-300 tracking-wide">
                                        {room.name}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium">{room.doctor}</p>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                    <CheckCircle size={14} weight="fill" />
                                    Đang hoạt động
                                </span>
                            </div>

                            {/* Số thứ tự ĐANG KHÁM khổ lớn (36px+ chuẩn TheDuckHospital) */}
                            <div className="p-5 text-center bg-gradient-to-b from-teal-950/50 to-slate-900 border-b border-slate-800">
                                <div className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-1">
                                    SỐ THỨ TỰ ĐANG KHÁM
                                </div>
                                <div className="text-5xl md:text-6xl font-black font-mono text-amber-400 tracking-tight my-2 drop-shadow">
                                    {currentNumber}
                                </div>
                                <div className="text-lg font-bold text-white truncate px-2">
                                    {currentName}
                                </div>
                            </div>

                            {/* Danh sách chuẩn bị tiếp theo */}
                            <div className="p-4 flex-1 bg-slate-900/60">
                                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center justify-between">
                                    <span>BỆNH NHÂN CHUẨN BỊ TIẾP THEO</span>
                                    <span className="text-teal-400">{waitingItems.length} lượt chờ</span>
                                </div>

                                {waitingItems.length > 0 ? (
                                    <div className="space-y-2">
                                        {waitingItems.map((w, wIdx) => {
                                            const wNum = w.queueNumber || w.so_thu_tu || w.stt || `A${102 + idx * 5 + wIdx}`
                                            const wName = w.patientName || w.ho_ten || w.ten_benh_nhan || 'Bệnh nhân chờ'
                                            return (
                                                <div
                                                    key={w.id || wIdx}
                                                    className="flex items-center justify-between bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700/70"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <span className="px-2.5 py-0.5 rounded-lg bg-teal-500/20 text-teal-300 font-mono font-bold text-sm">
                                                            {wNum}
                                                        </span>
                                                        <span className="text-sm font-semibold text-slate-200 truncate">
                                                            {wName}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-slate-400 shrink-0">Chuẩn bị</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-500 italic py-4 text-center">
                                        Chưa có bệnh nhân tiếp theo trong hàng chờ phòng này
                                    </div>
                                )}
                            </div>

                            {/* Footer điều khiển gọi loa tại quầy */}
                            <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => speakCallPatient(currentNumber, currentName, room.name)}
                                    className="flex-1 py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                                >
                                    <SpeakerHigh size={16} weight="fill" />
                                    Gọi Loa Số {currentNumber}
                                </button>
                                {onCallNextRoom && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onCallNextRoom(room)
                                            speakCallPatient(currentNumber, currentName, room.name)
                                        }}
                                        className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                                    >
                                        <UserFocus size={16} weight="bold" />
                                        Số kế tiếp
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Bottom Running Marquee Footer */}
            <div className="bg-teal-950 border-t border-teal-800 px-6 py-2.5 flex items-center justify-between text-xs text-teal-200">
                <div className="flex items-center gap-2 font-semibold">
                    <Television size={16} className="text-teal-400" />
                    <span>
                        Bệnh nhân có dấu hiệu Cờ đỏ Cấp cứu (Khó thở, Đau ngực cấp, Sốt cao co giật) được ưu tiên khám ngay theo quy trình AI Triage 3 Cổng.
                    </span>
                </div>
                <span className="font-mono text-teal-400">Chuẩn Thông tư 32/2023/TT-BYT</span>
            </div>
        </div>
    )
}
