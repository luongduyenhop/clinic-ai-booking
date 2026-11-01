import { useState } from 'react'
import { PRIORITY_TIERS } from '../../../utils/constants/clinical'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../clinical/StateBlocks'
import { ClinicIcon } from '../../common/ClinicIcon'
import { audioAnnouncer } from '../../../utils/audioAnnouncer'

const FILTERS = [
    { key: 'cho_kham', label: 'Chờ khám' },
    { key: 'co_ket_qua', label: 'Có KQ CLS ⭐' },
    { key: 'tam_hoan', label: 'Chờ CLS' },
    { key: 'da_kham', label: 'Đã xong' },
]

export default function QueuePanel({
    queue = [],
    loading,
    error,
    selectedEncounterId,
    onSelect,
    onRetry,
    onCallNext,
    onRecall,
    calling,
    currentTicket,
}) {
    const [filter, setFilter] = useState('cho_kham')
    const [voiceEnabled, setVoiceEnabled] = useState(audioAnnouncer.isEnabled())

    // Kiểm tra xem phòng khám hiện tại có đang trong một ca khám hay không (Guard A4)
    const isExaminingAny = Boolean(currentTicket || queue.some((t) => t.trang_thai === 'dang_kham'))
    const activeExamTicket = currentTicket || queue.find((t) => t.trang_thai === 'dang_kham')

    const handleToggleVoice = () => {
        const next = !voiceEnabled
        setVoiceEnabled(next)
        audioAnnouncer.setEnabled(next)
    }

    // Mời khám bệnh nhân tiếp theo và kích hoạt chuông + loa sảnh chờ
    const handleCallNextWithVoice = async () => {
        if (!onCallNext || calling || isExaminingAny) return
        try {
            const ticket = await onCallNext()
            if (voiceEnabled) {
                const calledTicket =
                    ticket ||
                    activeExamTicket ||
                    visible.find((t) => t.trang_thai === 'cho_kham' || t.trang_thai === 'co_ket_qua_cls')
                if (calledTicket) {
                    audioAnnouncer.announcePatient(
                        calledTicket.ten_benh_nhan || 'Bệnh nhân',
                        calledTicket.so_thu_tu_kham,
                        calledTicket.phong_kham || 'buồng khám'
                    )
                }
            }
        } catch {
            // Lỗi hoặc 409 conflict đã được toast xử lý
        }
    }

    // Gọi lại loa sảnh chờ cho bệnh nhân đang trong phòng khám
    const handleRecallWithVoice = () => {
        if (!onRecall || !currentTicket) return
        onRecall()
        if (voiceEnabled) {
            audioAnnouncer.announcePatient(
                currentTicket.ten_benh_nhan || 'Bệnh nhân',
                currentTicket.so_thu_tu_kham,
                currentTicket.phong_kham || 'buồng khám'
            )
        }
    }

    // Helper kiểm tra có kết quả CLS quay lại (revita-be priority +10,000)
    const isReturnedAfterCls = (t) =>
        t.trang_thai === 'co_ket_qua_cls' ||
        (t.ghi_chu && t.ghi_chu.toLowerCase().includes('kết quả')) ||
        t.muc_do_uu_tien === 1

    const count = (key) => {
        if (key === 'cho_kham') return queue.filter((t) => ['cho_kham', 'dang_kham'].includes(t.trang_thai)).length
        if (key === 'co_ket_qua') return queue.filter(isReturnedAfterCls).length
        if (key === 'tam_hoan') return queue.filter((t) => t.trang_thai === 'tam_hoan').length
        if (key === 'da_kham') return queue.filter((t) => t.trang_thai === 'da_kham').length
        return 0
    }

    const visible = queue
        .filter((t) => {
            if (filter === 'cho_kham') return ['cho_kham', 'dang_kham'].includes(t.trang_thai)
            if (filter === 'co_ket_qua') return isReturnedAfterCls(t)
            if (filter === 'tam_hoan') return t.trang_thai === 'tam_hoan'
            if (filter === 'da_kham') return t.trang_thai === 'da_kham'
            return true
        })
        .sort((a, b) => {
            if (a.trang_thai === 'dang_kham') return -1
            if (b.trang_thai === 'dang_kham') return 1
            // Ưu tiên ca có kết quả CLS quay lại
            if (isReturnedAfterCls(a) && !isReturnedAfterCls(b)) return -1
            if (!isReturnedAfterCls(a) && isReturnedAfterCls(b)) return 1
            if (a.muc_do_uu_tien !== b.muc_do_uu_tien) return a.muc_do_uu_tien - b.muc_do_uu_tien
            return String(a.so_thu_tu_kham).localeCompare(String(b.so_thu_tu_kham), undefined, { numeric: true })
        })

    return (
        <aside
            aria-label="Hàng đợi bệnh nhân"
            className="flex flex-col gap-3 w-full lg:w-[280px] lg:shrink-0 bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 h-fit"
        >
            {/* Header: Title & Calling controls */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                    <h2 className="text-sm font-extrabold text-[#003553] flex items-center gap-1.5">
                        <ClinicIcon name="UsersThree" size={17} className="text-[#00A9E3]" />
                        Hàng Đợi Khám
                    </h2>
                    <span className="text-[11px] text-slate-500">Phân luồng 5 bậc ưu tiên</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={handleToggleVoice}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                            voiceEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}
                        title={voiceEnabled ? 'Đang bật loa đọc tên bệnh nhân (Click để tắt)' : 'Đang tắt loa đọc tên (Click để bật)'}
                    >
                        <ClinicIcon name={voiceEnabled ? 'SpeakerHigh' : 'SpeakerSimpleSlash'} size={13} />
                        <span>{voiceEnabled ? 'Loa' : 'Mute'}</span>
                    </button>
                    {activeExamTicket && (
                        <span className="text-[11px] font-bold bg-[#E8F4FD] text-[#0077B6] px-2 py-0.5 rounded-full">
                            #{activeExamTicket.so_thu_tu_kham}
                        </span>
                    )}
                </div>
            </div>

            {/* Calling Buttons directly integrated */}
            {(onCallNext || onRecall) && (
                <div className="flex flex-col gap-1.5">
                    {/* NÚT MỜI KHÁM: Đổi màu & Khóa khi đang có ca khám dở dang để chống gọi trùng */}
                    <button
                        type="button"
                        onClick={handleCallNextWithVoice}
                        disabled={calling || isExaminingAny}
                        className={`w-full flex items-center justify-between py-2 px-3 rounded-xl font-bold text-xs shadow-xs transition ${
                            isExaminingAny
                                ? 'bg-amber-500 hover:bg-amber-500 text-white cursor-not-allowed opacity-90 border border-amber-600/30'
                                : 'bg-[#00A9E3] text-white hover:bg-[#0092c4] active:scale-[0.99] cursor-pointer disabled:opacity-50'
                        }`}
                        title={
                            isExaminingAny
                                ? `Đang có ca khám STT #${activeExamTicket?.so_thu_tu_kham} (${activeExamTicket?.ten_benh_nhan || ''}). Vui lòng hoàn tất hoặc tạm hoãn ca hiện tại trước khi mời ca mới để tránh gọi trùng!`
                                : 'Gọi bệnh nhân tiếp theo (Phím tắt: F2 hoặc Alt+N)'
                        }
                    >
                        <div className="flex items-center gap-2">
                            <ClinicIcon name={isExaminingAny ? 'Lock' : 'ArrowRight'} size={15} weight="bold" />
                            <span>
                                {calling
                                    ? 'Đang gọi số…'
                                    : isExaminingAny
                                    ? `Đang khám BN #${activeExamTicket?.so_thu_tu_kham} (Khóa)`
                                    : 'Mời khám (Ưu tiên)'}
                            </span>
                        </div>
                        <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                isExaminingAny ? 'bg-black/20 text-white' : 'bg-white/20 text-white'
                            }`}
                        >
                            {isExaminingAny ? 'KHÓA' : 'F2'}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={handleRecallWithVoice}
                        disabled={!currentTicket}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-40"
                        title={currentTicket ? `Gọi loa nhắc lại cho BN #${currentTicket?.so_thu_tu_kham}` : 'Chưa có ca đang khám'}
                    >
                        <ClinicIcon name="Bell" size={14} />
                        <span>Gọi lại số #{currentTicket?.so_thu_tu_kham || '—'}</span>
                    </button>
                </div>
            )}

            {/* Filters Tabs */}
            <div role="group" aria-label="Lọc hàng đợi" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                {FILTERS.map((f) => {
                    const c = count(f.key)
                    const isActive = filter === f.key
                    return (
                        <button
                            key={f.key}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => setFilter(f.key)}
                            className={`rounded-lg py-1 px-1.5 text-[11px] font-bold transition text-center cursor-pointer ${
                                isActive ? 'bg-white text-[#003553] shadow-2xs' : 'text-slate-600 hover:text-[#003553]'
                            }`}
                        >
                            {f.label} ({c})
                        </button>
                    )
                })}
            </div>

            {/* Content List */}
            {loading && queue.length === 0 && <LoadingBlock text="Đang tải hàng đợi..." />}
            {error && <ErrorBlock message={error} onRetry={onRetry} />}
            {!loading && !error && visible.length === 0 && (
                <EmptyBlock icon="UsersThree" title="Không có bệnh nhân" hint="Hàng đợi danh mục này hiện đang trống." />
            )}

            <div className="flex flex-col gap-2 max-h-[62vh] overflow-y-auto pr-0.5">
                {visible.map((t) => {
                    const selected = t.encounter_id && t.encounter_id === selectedEncounterId
                    const tier = PRIORITY_TIERS[t.muc_do_uu_tien] || PRIORITY_TIERS[5]
                    const hasClsReady = isReturnedAfterCls(t)
                    const isExamining = t.trang_thai === 'dang_kham'
                    const isLockedByActiveExam = isExaminingAny && !isExamining

                    return (
                        <button
                            key={t.ticket_id}
                            type="button"
                            disabled={!t.encounter_id || isLockedByActiveExam}
                            onClick={() => {
                                if (isLockedByActiveExam) return
                                onSelect(t.encounter_id)
                            }}
                            title={
                                isLockedByActiveExam
                                    ? `Đang có ca khám #${activeExamTicket?.so_thu_tu_kham} (${activeExamTicket?.ten_benh_nhan || ''}). Vui lòng hoàn thành ca này trước khi chuyển ca khác.`
                                    : undefined
                            }
                            className={`flex w-full gap-2.5 rounded-xl p-2.5 text-left transition border ${
                                isLockedByActiveExam
                                    ? 'bg-slate-50/70 border-slate-200 opacity-60 cursor-not-allowed'
                                    : selected
                                    ? 'bg-[#E8F4FD] border-[#00B5F1] ring-2 ring-[#00B5F1]/20 cursor-pointer'
                                    : hasClsReady
                                    ? 'bg-emerald-50/70 border-emerald-300 hover:bg-emerald-50 cursor-pointer'
                                    : isExamining
                                    ? 'bg-sky-50/80 border-sky-300 hover:bg-sky-50 ring-2 ring-sky-300/40 cursor-pointer'
                                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 cursor-pointer'
                            }`}
                        >
                            {/* Số thứ tự vé */}
                            <span
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                                    isLockedByActiveExam
                                        ? 'bg-slate-200 text-slate-500'
                                        : selected
                                        ? 'bg-[#00A9E3] text-white shadow-xs'
                                        : hasClsReady
                                        ? 'bg-emerald-600 text-white'
                                        : isExamining
                                        ? 'bg-sky-600 text-white'
                                        : 'bg-slate-100 text-[#003553]'
                                }`}
                            >
                                #{String(t.so_thu_tu_kham).padStart(2, '0')}
                            </span>

                            {/* Thông tin bệnh nhân */}
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <div className="flex items-center justify-between gap-1">
                                    <span className="truncate text-xs font-bold text-[#003553]">{t.ten_benh_nhan}</span>
                                    <span className="shrink-0 text-[10px] text-slate-500 font-medium">
                                        {t.gioi_tinh} · {t.tuoi}t
                                    </span>
                                </div>

                                {t.ly_do && <span className="truncate text-[11px] text-slate-500">{t.ly_do}</span>}

                                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                    {isLockedByActiveExam ? (
                                        <span className="text-[10px] font-semibold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                                            <ClinicIcon name="Lock" size={11} /> Khóa gọi
                                        </span>
                                    ) : hasClsReady ? (
                                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-600 text-white animate-pulse">
                                            ⭐ CÓ KQ CLS
                                        </span>
                                    ) : (
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${tier.badge}`}>
                                            {tier.label}
                                        </span>
                                    )}

                                    {isExamining && (
                                        <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse border border-sky-300">
                                            <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
                                            Đang khám
                                        </span>
                                    )}
                                    {t.trang_thai === 'tam_hoan' && (
                                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1 rounded">
                                            Chờ CLS
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </aside>
    )
}
