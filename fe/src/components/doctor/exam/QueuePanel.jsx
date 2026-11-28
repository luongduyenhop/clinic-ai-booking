import { useState } from 'react'
import { PRIORITY_TIERS } from '../../../utils/constants/clinical'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../clinical/StateBlocks'
import { ClinicIcon } from '../../common/ClinicIcon'
import { audioAnnouncer } from '../../../utils/audioAnnouncer'

const FILTERS = [
    { key: 'cho_kham', label: 'Chờ khám' },
    { key: 'co_ket_qua', label: 'Có KQ CLS' },
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
    filter: externalFilter,
    onFilterChange,
}) {
    const [internalFilter, setInternalFilter] = useState('cho_kham')
    const filter = externalFilter !== undefined ? externalFilter : internalFilter
    const setFilter = (next) => {
        setInternalFilter(next)
        onFilterChange?.(next)
    }
    const [voiceEnabled, setVoiceEnabled] = useState(audioAnnouncer.isEnabled())

    const handleToggleVoice = () => {
        const next = !voiceEnabled
        setVoiceEnabled(next)
        audioAnnouncer.setEnabled(next)
    }

    const handleCallNextWithVoice = async () => {
        if (!onCallNext) return
        setFilter('cho_kham')
        const nextPatient = queue.find((t) => t.trang_thai === 'cho_kham' || t.trang_thai === 'co_ket_qua_cls')
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

    const isReturnedAfterCls = (t) =>
        Boolean(
            t &&
            t.trang_thai !== 'tam_hoan' &&
            t.trang_thai !== 'da_kham' &&
            (t.trang_thai === 'co_ket_qua_cls' ||
                (t.ghi_chu && (
                    /có\s+kq\s+cls/i.test(t.ghi_chu) ||
                    /kq\s+cls/i.test(t.ghi_chu) ||
                    t.ghi_chu.toLowerCase().includes('đã có kết quả')
                )))
        )

    const isWaitingCls = (t) =>
        Boolean(
            t &&
            t.trang_thai !== 'da_kham' &&
            !isReturnedAfterCls(t) &&
            (t.trang_thai === 'tam_hoan' ||
                (t.ghi_chu && (
                    t.ghi_chu.toLowerCase().includes('chờ kết quả') ||
                    t.ghi_chu.toLowerCase().includes('chờ cls') ||
                    t.ghi_chu.toLowerCase().includes('cận lâm sàng')
                )))
        )

    const count = (key) => {
        if (key === 'cho_kham') return queue.filter((t) => ['cho_kham', 'dang_kham'].includes(t.trang_thai) && !isReturnedAfterCls(t) && !isWaitingCls(t)).length
        if (key === 'co_ket_qua') return queue.filter(isReturnedAfterCls).length
        if (key === 'tam_hoan') return queue.filter(isWaitingCls).length
        if (key === 'da_kham') return queue.filter((t) => t.trang_thai === 'da_kham').length
        return 0
    }

    const visible = queue
        .filter((t) => {
            if (filter === 'cho_kham') return ['cho_kham', 'dang_kham'].includes(t.trang_thai) && !isReturnedAfterCls(t) && !isWaitingCls(t)
            if (filter === 'co_ket_qua') return isReturnedAfterCls(t)
            if (filter === 'tam_hoan') return isWaitingCls(t)
            if (filter === 'da_kham') return t.trang_thai === 'da_kham'
            return true
        })
        .sort((a, b) => {
            if (a.trang_thai === 'dang_kham') return -1
            if (b.trang_thai === 'dang_kham') return 1
            if (isReturnedAfterCls(a) && !isReturnedAfterCls(b)) return -1
            if (!isReturnedAfterCls(a) && isReturnedAfterCls(b)) return 1
            if (a.muc_do_uu_tien !== b.muc_do_uu_tien) return a.muc_do_uu_tien - b.muc_do_uu_tien
            return String(a.so_thu_tu_kham).localeCompare(String(b.so_thu_tu_kham), undefined, { numeric: true })
        })

    return (
        <aside
            aria-label="Hàng đợi bệnh nhân"
            className="medpro-card flex flex-col gap-3 w-full lg:w-[280px] lg:shrink-0 bg-clinic-surface p-3.5 h-fit"
        >
            <div className="flex items-center justify-between border-b border-clinic-border pb-2.5">
                <div>
                    <h2 className="text-sm font-extrabold text-clinic-navy flex items-center gap-1.5">
                        <ClinicIcon name="UsersThree" size={17} className="text-clinic-cta" />
                        Hàng Đợi Khám
                    </h2>
                    <span className="text-[11px] text-clinic-text-secondary">Phân luồng 5 bậc ưu tiên</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={handleToggleVoice}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-[6px] border transition cursor-pointer flex items-center gap-1 ${
                            voiceEnabled ? 'bg-clinic-success-bg text-clinic-success border-clinic-success-border' : 'bg-clinic-bg text-clinic-text-secondary border-clinic-border'
                        }`}
                        title={voiceEnabled ? 'Đang bật loa đọc tên bệnh nhân (Click để tắt)' : 'Đang tắt loa đọc tên (Click để bật)'}
                    >
                        <ClinicIcon name={voiceEnabled ? 'SpeakerHigh' : 'SpeakerSimpleSlash'} size={13} />
                        <span>{voiceEnabled ? 'Loa' : 'Mute'}</span>
                    </button>
                    {currentTicket && (
                        <span className="medpro-badge-info text-[11px] font-bold px-2 py-0.5 tabular-nums">
                            {`#${currentTicket.so_thu_tu_kham}`}
                        </span>
                    )}
                </div>
            </div>

            {(onCallNext || onRecall) && (
                <div className="flex flex-col gap-1.5">
                    <button
                        type="button"
                        onClick={handleCallNextWithVoice}
                        disabled={calling}
                        className="medpro-btn-primary w-full flex items-center justify-between py-2 px-3 rounded-[6px] font-bold text-xs cursor-pointer disabled:opacity-50"
                        title="Gọi bệnh nhân tiếp theo"
                    >
                        <div className="flex items-center gap-2">
                            <ClinicIcon name="ArrowRight" size={15} weight="bold" />
                            <span>{calling ? 'Đang gọi số…' : 'Gọi số tiếp theo (Ưu tiên)'}</span>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={handleRecallWithVoice}
                        disabled={!currentTicket}
                        className="medpro-btn-outline w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-[6px] font-semibold text-xs cursor-pointer disabled:opacity-40"
                    >
                        <ClinicIcon name="Bell" size={14} />
                        <span className="tabular-nums">Gọi lại số #{currentTicket?.so_thu_tu_kham || '—'}</span>
                    </button>
                </div>
            )}

            <div role="group" aria-label="Lọc hàng đợi" className="grid grid-cols-2 gap-1 rounded-[6px] bg-clinic-bg border border-clinic-border p-1">
                {FILTERS.map((f) => {
                    const c = count(f.key)
                    const isActive = filter === f.key
                    return (
                        <button
                            key={f.key}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => setFilter(f.key)}
                            className={`rounded-[4px] py-1 px-1.5 text-[11px] font-bold transition text-center cursor-pointer tabular-nums ${
                                isActive ? 'bg-clinic-navy text-clinic-surface' : 'text-clinic-text-secondary hover:text-clinic-navy hover:bg-clinic-surface'
                            }`}
                        >
                            {f.label} ({c})
                        </button>
                    )
                })}
            </div>

            {loading && queue.length === 0 && <LoadingBlock text="Đang tải hàng đợi..." />}
            {error && <ErrorBlock message={error} onRetry={onRetry} />}
            {!loading && !error && visible.length === 0 && (
                <EmptyBlock icon="UsersThree" title="Không có bệnh nhân" hint="Hàng đợi danh mục này hiện đang trống." />
            )}

            <div className="flex flex-col gap-2 max-h-[62vh] overflow-y-auto pr-0.5">
                {visible.map((t) => {
                    const selected = t.encounter_id && String(t.encounter_id) === String(selectedEncounterId)
                    const tier = PRIORITY_TIERS[t.muc_do_uu_tien] || PRIORITY_TIERS[5]
                    const hasClsReady = isReturnedAfterCls(t)
                    const isExamining = t.trang_thai === 'dang_kham'

                    return (
                        <button
                            key={t.ticket_id}
                            type="button"
                            disabled={!t.encounter_id}
                            onClick={() => onSelect(t.encounter_id)}
                            className={`flex w-full gap-2.5 rounded-[6px] p-2.5 text-left transition cursor-pointer border ${
                                selected
                                    ? 'bg-clinic-surface-alt border-clinic-cta'
                                    : hasClsReady
                                    ? 'bg-clinic-success-bg border-clinic-success-border hover:border-clinic-success'
                                    : isExamining
                                    ? 'bg-clinic-surface-tint border-clinic-info-border hover:border-clinic-cta'
                                    : 'bg-clinic-surface border-clinic-border hover:border-clinic-border-strong hover:bg-clinic-bg'
                            }`}
                        >
                            <span
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] text-xs font-black tabular-nums ${
                                    selected
                                        ? 'bg-clinic-cta text-clinic-surface'
                                        : t.trang_thai === 'da_kham'
                                        ? 'bg-clinic-success-bg text-clinic-success border border-clinic-success-border'
                                        : hasClsReady
                                        ? 'bg-clinic-success text-clinic-surface'
                                        : isWaitingCls(t)
                                        ? 'bg-clinic-warning-bg text-clinic-warning border border-clinic-warning-border'
                                        : isExamining
                                        ? 'bg-clinic-navy text-clinic-surface'
                                        : 'bg-clinic-bg-muted text-clinic-navy border border-clinic-border'
                                }`}
                            >
                                {`#${String(t.so_thu_tu_kham).padStart(2, '0')}`}
                            </span>

                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <div className="flex items-center justify-between gap-1">
                                    <span className="truncate text-xs font-bold text-clinic-navy">{t.ten_benh_nhan}</span>
                                    <span className="shrink-0 text-[10px] text-clinic-text-secondary font-medium tabular-nums">
                                        {t.gioi_tinh} · {t.tuoi}t
                                    </span>
                                </div>

                                {t.ly_do && <span className="truncate text-[11px] text-clinic-text-secondary">{t.ly_do}</span>}

                                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                    {t.trang_thai === 'da_kham' ? (
                                        <span className="medpro-badge-success text-[10px] font-bold px-1.5 py-0.5 flex items-center gap-1">
                                            <ClinicIcon name="Check" size={11} weight="bold" /> Đã khám
                                        </span>
                                    ) : hasClsReady ? (
                                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-[4px] bg-clinic-success text-clinic-surface inline-flex items-center gap-1">
                                            <ClinicIcon name="CheckCircle" size={11} weight="bold" />
                                            <span>CÓ KQ CLS</span>
                                        </span>
                                    ) : isWaitingCls(t) ? (
                                        <span className="medpro-badge-warning text-[10px] font-bold px-1.5 py-0.5">
                                            Chờ CLS
                                        </span>
                                    ) : (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-[4px] font-semibold ${tier.badge}`}>
                                            {tier.label}
                                        </span>
                                    )}

                                    {isExamining && !isWaitingCls(t) && !hasClsReady && (
                                        <span className="medpro-badge-info text-[10px] font-bold px-1.5 py-0.5">
                                            Đang khám
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
