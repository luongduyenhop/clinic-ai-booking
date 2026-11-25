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
            setLastCalledTicket({ ticketNumber, patientName, roomName, time: new Date().toLocaleTimeString('vi-VN') })
        }
        setLastCalledTicket({ ticketNumber, patientName, roomName, time: new Date().toLocaleTimeString('vi-VN') })
        AppToast.info(`Đang phát loa: Mời số ${ticketNumber} - ${patientName} vào ${roomName}`)
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

    const activeRooms = rooms || []

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
        <div className="fixed inset-0 z-50 bg-clinic-navy-dark text-clinic-surface flex flex-col overflow-hidden select-none">
            <div className="bg-clinic-navy border-b border-clinic-cta/30 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-[6px] bg-clinic-cta/20 border border-clinic-cta/40 flex items-center justify-center text-clinic-cyan">
                        <Hospital size={26} weight="duotone" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <span className="px-2 py-0.5 rounded-[4px] text-xs font-bold bg-clinic-amber text-clinic-navy">
                                Trực tuyến
                            </span>
                            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-clinic-surface">
                                Bảng điện tử gọi số khám bệnh — Clinic-AI HIS
                            </h2>
                        </div>
                        <p className="text-xs md:text-sm text-clinic-on-navy-muted mt-0.5">
                            Quý khách vui lòng theo dõi số thứ tự trên màn hình và lắng nghe loa thông báo trước cửa phòng khám
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-right bg-clinic-navy-dark border border-clinic-on-navy-subtle/30 px-4 py-2 rounded-[6px] tabular-nums">
                        <div className="flex items-center justify-end gap-1.5 text-clinic-cyan text-xs font-semibold">
                            <Clock size={14} weight="bold" />
                            <span>{now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        </div>
                        <div className="text-2xl font-mono font-black text-clinic-surface tracking-wider">
                            {now.toLocaleTimeString('vi-VN')}
                        </div>
                    </div>

                    <button
                        type="button"
                        aria-label="Toàn màn hình"
                        onClick={toggleBrowserFullscreen}
                        className="p-3 rounded-[6px] bg-clinic-navy-dark hover:bg-clinic-cta text-clinic-on-navy-muted hover:text-clinic-surface border border-clinic-on-navy-subtle/30 transition cursor-pointer"
                        title="Toàn màn hình TV"
                    >
                        {isFullscreen ? <ArrowsInSimple size={20} /> : <ArrowsOutSimple size={20} />}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="medpro-btn-danger px-4 py-2.5 rounded-[6px] font-bold text-sm flex items-center gap-1.5 cursor-pointer"
                    >
                        <X size={17} weight="bold" />
                        <span>Đóng TV</span>
                    </button>
                </div>
            </div>

            {lastCalledTicket && (
                <div className="bg-clinic-amber text-clinic-navy px-6 py-3 flex items-center justify-between font-bold tabular-nums border-b border-clinic-navy/20">
                    <div className="flex items-center gap-3 text-base md:text-lg">
                        <SpeakerHigh size={24} weight="fill" />
                        <span>
                            ĐANG GỌI LOA: Xin mời bệnh nhân số{' '}
                            <strong className="text-2xl font-black underline mx-1">{lastCalledTicket.ticketNumber}</strong> (
                            {lastCalledTicket.patientName}) vào <strong>{lastCalledTicket.roomName}</strong>!
                        </span>
                    </div>
                    <span className="text-xs font-mono bg-clinic-navy text-clinic-surface px-2.5 py-1 rounded-[4px]">
                        Lúc {lastCalledTicket.time}
                    </span>
                </div>
            )}

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
                            className="bg-clinic-navy border border-clinic-on-navy-subtle/30 rounded-[6px] flex flex-col justify-between overflow-hidden"
                        >
                            <div className="bg-clinic-navy-dark px-5 py-3.5 border-b border-clinic-on-navy-subtle/30 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <h3 className="text-base font-extrabold text-clinic-surface truncate">
                                        {room.name}
                                    </h3>
                                    <p className="text-xs text-clinic-on-navy-muted font-medium truncate">{room.doctor}</p>
                                </div>
                                <span className="px-2.5 py-1 rounded-[4px] text-xs font-bold bg-clinic-success text-clinic-surface flex items-center gap-1 shrink-0">
                                    <CheckCircle size={13} weight="fill" />
                                    <span>Đang hoạt động</span>
                                </span>
                            </div>

                            <div className="p-5 text-center bg-clinic-navy border-b border-clinic-on-navy-subtle/30 tabular-nums">
                                <div className="text-xs font-bold text-clinic-cyan mb-1">
                                    Số thứ tự đang khám
                                </div>
                                <div className="text-5xl md:text-6xl font-black font-mono text-clinic-amber tracking-tight my-2">
                                    {currentNumber}
                                </div>
                                <div className="text-lg font-bold text-clinic-surface truncate px-2">
                                    {currentName}
                                </div>
                            </div>

                            <div className="p-4 flex-1 bg-clinic-navy-dark/50">
                                <div className="text-xs font-bold text-clinic-on-navy-muted mb-2.5 flex items-center justify-between tabular-nums">
                                    <span>Bệnh nhân chuẩn bị tiếp theo</span>
                                    <span className="text-clinic-cyan">{waitingItems.length} lượt chờ</span>
                                </div>

                                {waitingItems.length > 0 ? (
                                    <div className="space-y-2 tabular-nums">
                                        {waitingItems.map((w, wIdx) => {
                                            const wNum = w.queueNumber || w.so_thu_tu || w.stt || `A${102 + idx * 5 + wIdx}`
                                            const wName = w.patientName || w.ho_ten || w.ten_benh_nhan || 'Bệnh nhân chờ'
                                            return (
                                                <div
                                                    key={w.id || wIdx}
                                                    className="flex items-center justify-between bg-clinic-navy px-3.5 py-2 rounded-[6px] border border-clinic-on-navy-subtle/25"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <span className="px-2 py-0.5 rounded-[4px] bg-clinic-cta text-clinic-surface font-mono font-bold text-xs">
                                                            {wNum}
                                                        </span>
                                                        <span className="text-sm font-semibold text-clinic-surface truncate">
                                                            {wName}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-clinic-on-navy-muted shrink-0">Chuẩn bị</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-xs text-clinic-on-navy-subtle py-4 text-center">
                                        Chưa có bệnh nhân tiếp theo trong hàng chờ phòng này
                                    </div>
                                )}
                            </div>

                            <div className="px-4 py-3 bg-clinic-navy-dark border-t border-clinic-on-navy-subtle/30 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => speakCallPatient(currentNumber, currentName, room.name)}
                                    className="medpro-btn-primary flex-1 py-2.5 px-3 rounded-[6px] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer tabular-nums"
                                >
                                    <SpeakerHigh size={16} weight="fill" />
                                    <span>Gọi loa số {currentNumber}</span>
                                </button>
                                {onCallNextRoom && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onCallNextRoom(room)
                                            speakCallPatient(currentNumber, currentName, room.name)
                                        }}
                                        className="medpro-btn-amber py-2.5 px-3 rounded-[6px] font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                        <UserFocus size={16} weight="bold" />
                                        <span>Số kế tiếp</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="bg-clinic-navy border-t border-clinic-cta/30 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-clinic-on-navy-muted">
                <div className="flex items-center gap-2 font-semibold">
                    <Television size={16} className="text-clinic-cyan shrink-0" />
                    <span>
                        Bệnh nhân có dấu hiệu Cờ đỏ Cấp cứu (Khó thở, Đau ngực cấp, Sốt cao co giật) được ưu tiên khám ngay theo quy trình phân loại 3 cổng.
                    </span>
                </div>
                <span className="font-mono text-clinic-cyan">Phòng khám Đa khoa Clinic-AI</span>
            </div>
        </div>
    )
}
