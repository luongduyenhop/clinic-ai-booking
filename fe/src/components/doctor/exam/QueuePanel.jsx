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

    const handleToggleVoice = () => {
        const next = !voiceEnabled
        setVoiceEnabled(next)
        audioAnnouncer.setEnabled(next)
    }

    const handleCallNextWithVoice = async () => {
        if (!onCallNext) return
        const nextPatient = visible.find((t) => t.trang_thai === 'cho_kham' || t.trang_thai === 'co_ket_qua_cls')
        onCallNext()
        if (nextPatient && voiceEnabled) {
            audioAnnouncer.announcePatient(nextPatient.ten_benh_nhan, nextPatient.so_thu_tu_kham, 'buồng khám số 1')
        }
    }

    const handleRecallWithVoice = () => {
        if (!onRecall) return
        onRecall()
        if (currentTicket && voiceEnabled) {
            audioAnnouncer.announcePatient(currentTicket.ten_benh_nhan, currentTicket.so_thu_tu_kham, 'buồng khám số 1')
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
                    {currentTicket && (
                        <span className="text-[11px] font-bold bg-[#E8F4FD] text-[#0077B6] px-2 py-0.5 rounded-full">
                            #{currentTicket.so_thu_tu_kham}
                        </span>
                    )}
                </div>
            </div>

            {/* Calling Buttons directly integrated */}
            {(onCallNext || onRecall) && (
                <div className="flex flex-col gap-1.5">
                    <button
                        type="button"
                        onClick={handleCallNextWithVoice}
                        disabled={calling}
                        className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-[#00A9E3] text-white font-bold text-xs shadow-xs hover:bg-[#0092c4] active:scale-[0.99] transition cursor-pointer disabled:opacity-50"
                        title="Gọi bệnh nhân tiếp theo (Phím tắt: F2 hoặc Alt+N)"
                    >
                        <div className="flex items-center gap-2">
                            <ClinicIcon name="ArrowRight" size={15} weight="bold" />
                            <span>{calling ? 'Đang gọi số…' : 'Gọi số tiếp theo (Ưu tiên)'}</span>
                        </div>
                        <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-white font-mono">F2</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleRecallWithVoice}
                        disabled={!currentTicket}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-40"
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

                    return (
                        <button
                            key={t.ticket_id}
                            type="button"
                            disabled={!t.encounter_id}
                            onClick={() => onSelect(t.encounter_id)}
                            className={`flex w-full gap-2.5 rounded-xl p-2.5 text-left transition cursor-pointer border ${
                                selected
                                    ? 'bg-[#E8F4FD] border-[#00B5F1] ring-2 ring-[#00B5F1]/20'
                                    : hasClsReady
                                    ? 'bg-emerald-50/70 border-emerald-300 hover:bg-emerald-50'
                                    : isExamining
                                    ? 'bg-sky-50/80 border-sky-300 hover:bg-sky-50'
                                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                            }`}
                        >
                            {/* Số thứ tự vé */}
                            <span
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                                    selected
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
                                    {hasClsReady ? (
                                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-600 text-white animate-pulse">
                                            ⭐ CÓ KQ CLS
                                        </span>
                                    ) : (
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${tier.badge}`}>
                                            {tier.label}
                                        </span>
                                    )}

                                    {isExamining && (
                                        <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-1 rounded">
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
