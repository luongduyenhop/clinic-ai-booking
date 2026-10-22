import { useState } from 'react'
import { PRIORITY_TIERS } from '../../../utils/constants/clinical'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../clinical/StateBlocks'

const FILTERS = [
    { key: 'cho_kham', label: 'Chờ khám' },
    { key: 'tam_hoan', label: 'Tạm hoãn' },
    { key: 'da_kham', label: 'Xong' },
]

export default function QueuePanel({ queue, loading, error, selectedEncounterId, onSelect, onRetry }) {
    const [filter, setFilter] = useState('cho_kham')

    const count = (key) =>
        queue.filter((t) => (key === 'cho_kham' ? ['cho_kham', 'dang_kham'].includes(t.trang_thai) : t.trang_thai === key)).length

    const visible = queue
        .filter((t) => (filter === 'cho_kham' ? ['cho_kham', 'dang_kham'].includes(t.trang_thai) : t.trang_thai === filter))
        .sort((a, b) => {
            if (a.trang_thai === 'dang_kham') return -1
            if (b.trang_thai === 'dang_kham') return 1
            if (a.muc_do_uu_tien !== b.muc_do_uu_tien) return a.muc_do_uu_tien - b.muc_do_uu_tien
            return String(a.so_thu_tu_kham).localeCompare(String(b.so_thu_tu_kham), undefined, { numeric: true })
        })

    return (
        <aside aria-label="Hàng đợi bệnh nhân" className="medpro-card p-4 flex flex-col gap-3 w-full lg:w-[290px] lg:shrink-0">
            <div className="medpro-section-title !mb-0">
                <span>Hàng đợi</span>
                <span className="text-[11px] font-medium text-slate-500">sắp theo 5 bậc ưu tiên</span>
            </div>

            <div role="group" aria-label="Lọc hàng đợi" className="grid grid-cols-3 gap-1 rounded-full bg-[#E8F4FD] p-1">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        aria-pressed={filter === f.key}
                        onClick={() => setFilter(f.key)}
                        className={`rounded-full py-1.5 text-[12px] font-semibold transition cursor-pointer ${
                            filter === f.key ? 'bg-white text-[#003553] shadow-xs' : 'text-slate-600 hover:text-[#003553]'
                        }`}
                    >
                        {f.label} {count(f.key)}
                    </button>
                ))}
            </div>

            {loading && queue.length === 0 && <LoadingBlock />}
            {error && <ErrorBlock message={error} onRetry={onRetry} />}
            {!loading && !error && visible.length === 0 && <EmptyBlock icon="UsersThree" title="Không có bệnh nhân" />}

            <div className="flex flex-col gap-2">
                {visible.map((t) => {
                    const selected = t.encounter_id && t.encounter_id === selectedEncounterId
                    const tier = PRIORITY_TIERS[t.muc_do_uu_tien] || PRIORITY_TIERS[5]
                    return (
                        <button
                            key={t.ticket_id}
                            type="button"
                            disabled={!t.encounter_id}
                            onClick={() => onSelect(t.encounter_id)}
                            className={`flex w-full gap-3 rounded-xl p-3 text-left transition cursor-pointer disabled:cursor-default ${
                                selected ? 'bg-[#E8F4FD] ring-2 ring-[#00B5F1]' : 'bg-[#F5F9FC] hover:bg-[#EEF6FC]'
                            }`}
                        >
                            <span
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${
                                    selected ? 'bg-[#00B5F1] text-[#003553]' : 'bg-white text-[#003553]'
                                }`}
                            >
                                {String(t.so_thu_tu_kham).padStart(2, '0')}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="flex justify-between gap-2">
                                    <span className="truncate font-semibold text-[#003553]">{t.ten_benh_nhan}</span>
                                    <span className="shrink-0 text-[12px] text-slate-500">
                                        {t.gioi_tinh} · {t.tuoi}t
                                    </span>
                                </span>
                                {t.ly_do && <span className="truncate text-[12px] text-slate-500">{t.ly_do}</span>}
                                <span className="flex flex-wrap items-center gap-1.5">
                                    <span className={tier.badge}>{tier.label}</span>
                                    <span className="text-[11px] text-slate-500">{t.ghi_chu}</span>
                                </span>
                                {t.trang_thai === 'tam_hoan' && (
                                    <span className="text-[11px] text-amber-800">
                                        Lễ tân phục hồi vé khi bệnh nhân quay lại (xếp bậc 4).
                                    </span>
                                )}
                            </span>
                        </button>
                    )
                })}
            </div>
        </aside>
    )
}
