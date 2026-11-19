import { useMemo, useState } from 'react'
import { SERVICE_GROUPS, SPECIALTY_PACKS, ORDER_STATUS } from '../../../utils/constants/clinical'
import { formatCurrency } from '../../../utils/helpers/formatCurrency'
import { ClinicIcon } from '../../common/ClinicIcon'
import { EmptyBlock } from '../clinical/StateBlocks'

export default function StepOrders({
    encounter,
    services,
    locked,
    submitting,
    onSubmit,
    picked: externalPicked,
    onPickedChange,
}) {
    const [keyword, setKeyword] = useState('')
    const [pack, setPack] = useState(null)
    const [localPicked, setLocalPicked] = useState([])

    const picked = externalPicked !== undefined ? externalPicked : localPicked
    const setPicked = (updater) => {
        if (onPickedChange) {
            const next = typeof updater === 'function' ? updater(picked) : updater
            onPickedChange(next)
        } else {
            setLocalPicked(updater)
        }
    }

    const orders = (encounter?.danh_sach_chi_dinh || []).filter((o) => o.trang_thai !== 'da_huy')
    const orderedIds = useMemo(() => new Set(orders.map((o) => String(o.dich_vu_id))), [orders])

    const q = keyword.trim().toLowerCase()
    const filtered = services.filter((s) => !q || s.ten_dich_vu.toLowerCase().includes(q) || s.ma_dich_vu.toLowerCase().includes(q))

    const toggle = (id) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

    const applyPack = (p) => {
        setPack(p.key)
        const ids = services.filter((s) => p.services.includes(s.ma_dich_vu) && !orderedIds.has(String(s.id))).map((s) => s.id)
        setPicked((prev) => Array.from(new Set([...prev, ...ids])))
    }

    const pickedServices = useMemo(() => {
        return (picked || []).map((id) => services.find((s) => String(s.id) === String(id))).filter(Boolean)
    }, [picked, services])

    const pickedTotal = pickedServices.reduce((sum, s) => sum + (s.don_gia || 0), 0)
    const ordersTotal = orders.reduce((sum, o) => sum + (services.find((s) => String(s.id) === String(o.dich_vu_id))?.don_gia || o.don_gia_tai_thoi_diem || o.don_gia || 0), 0)

    const handleSend = async () => {
        const ok = await onSubmit(picked)
        if (ok) {
            setPicked([])
            setPack(null)
        }
    }

    return (
        <div className="flex flex-wrap gap-5">
            <div className="flex min-w-0 flex-[999_1_380px] flex-col gap-4">
                <label>
                    <span className="medpro-label">Tìm dịch vụ cận lâm sàng</span>
                    <input
                        type="search"
                        className="medpro-input"
                        placeholder="Gõ tên hoặc mã: công thức máu, siêu âm…"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        disabled={locked}
                    />
                </label>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] text-clinic-text-secondary">Gói theo khoa:</span>
                    {SPECIALTY_PACKS.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            disabled={locked}
                            aria-pressed={pack === p.key}
                            onClick={() => applyPack(p)}
                            className={`rounded-[6px] px-3 py-1.5 text-[12px] font-semibold transition cursor-pointer disabled:cursor-not-allowed border ${
                                pack === p.key
                                    ? 'bg-clinic-navy text-clinic-surface border-clinic-navy'
                                    : 'bg-clinic-surface text-clinic-navy border-clinic-border hover:border-clinic-cta'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {SERVICE_GROUPS.map((g) => {
                    const items = filtered.filter((s) => s.nhom_dich_vu === g.key)
                    if (items.length === 0) return null
                    return (
                        <fieldset key={g.key} className="flex flex-col gap-2">
                            <legend className="mb-2 flex items-center gap-1.5 text-xs font-bold text-clinic-text-secondary">
                                <ClinicIcon name={g.icon} size={14} /> {g.label}
                            </legend>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
                                {items.map((s) => {
                                    const already = orderedIds.has(String(s.id))
                                    const checked = already || picked.some((pid) => String(pid) === String(s.id))
                                    return (
                                        <label
                                            key={s.id}
                                            className={`flex min-h-11 items-center gap-2.5 rounded-[6px] border px-3 text-[13px] transition ${
                                                already
                                                    ? 'cursor-not-allowed bg-clinic-bg-muted border-clinic-border text-clinic-text-muted'
                                                    : checked
                                                      ? 'cursor-pointer bg-clinic-surface-alt border-clinic-cta font-semibold text-clinic-navy'
                                                      : 'cursor-pointer bg-clinic-surface border-clinic-border hover:border-clinic-info-border hover:bg-clinic-surface-tint'
                                            }`}
                                        >
                                            <input type="checkbox" checked={checked} disabled={already || locked} onChange={() => toggle(s.id)} />
                                            <span className="flex-1">{s.ten_dich_vu}</span>
                                            {already && <span className="text-[11px]">Đã chỉ định</span>}
                                        </label>
                                    )
                                })}
                            </div>
                        </fieldset>
                    )
                })}
                {filtered.length === 0 && <EmptyBlock icon="MagnifyingGlass" title="Không tìm thấy dịch vụ phù hợp" />}
            </div>

            <div className="medpro-card flex flex-[1_1_280px] flex-col gap-3.5 self-start rounded-[6px] bg-clinic-surface-alt p-4 border-clinic-info-border">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[12px] font-extrabold text-clinic-navy tabular-nums">
                            Đang chọn ({pickedServices.length})
                        </span>
                        {pickedServices.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setPicked([])}
                                className="text-[11px] text-clinic-danger hover:underline font-bold cursor-pointer"
                            >
                                Bỏ chọn tất cả
                            </button>
                        )}
                    </div>

                    {pickedServices.length === 0 ? (
                        <p className="text-[11px] text-clinic-text-secondary py-1">
                            Chưa chọn dịch vụ nào. Tick chọn các dịch vụ bên trái để thêm vào phiếu chỉ định.
                        </p>
                    ) : (
                        <div className="flex flex-col divide-y divide-clinic-border border border-clinic-border rounded-[6px] bg-clinic-surface max-h-52 overflow-y-auto">
                            {pickedServices.map((s) => (
                                <div key={s.id} className="flex items-center justify-between gap-2 p-2.5 bg-clinic-surface">
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[12px] font-bold text-clinic-navy truncate">{s.ten_dich_vu}</span>
                                        <span className="text-[11px] font-semibold text-clinic-text-secondary tabular-nums">{formatCurrency(s.don_gia)}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggle(s.id)}
                                        aria-label={`Bỏ ${s.ten_dich_vu}`}
                                        className="shrink-0 p-1 text-clinic-text-muted hover:text-clinic-danger rounded-[6px] hover:bg-clinic-danger-bg transition cursor-pointer"
                                        title="Bỏ dịch vụ này"
                                    >
                                        <ClinicIcon name="X" size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {pickedServices.length > 0 && (
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-clinic-info-border tabular-nums">
                            <span className="font-medium text-clinic-text-secondary">Tạm tính ({pickedServices.length} DV):</span>
                            <span className="font-extrabold text-clinic-navy">{formatCurrency(pickedTotal)}</span>
                        </div>
                    )}

                    <button
                        type="button"
                        className={`w-full py-2.5 px-3 rounded-[6px] font-extrabold text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 tabular-nums ${
                            pickedServices.length > 0
                                ? 'bg-clinic-cta hover:bg-clinic-cta-hover text-clinic-surface'
                                : 'bg-clinic-bg-muted text-clinic-text-subtle border border-clinic-border'
                        }`}
                        disabled={locked || pickedServices.length === 0 || submitting}
                        onClick={handleSend}
                    >
                        <ClinicIcon name="PaperPlaneTilt" size={14} weight="bold" />
                        <span>{submitting ? 'Đang gửi sang KTV…' : pickedServices.length > 0 ? `Gửi ${pickedServices.length} chỉ định sang phòng KTV` : 'Gửi chỉ định sang phòng KTV'}</span>
                    </button>
                </div>

                <div className="flex flex-col gap-2 pt-3 border-t border-clinic-info-border">
                    <div className="flex items-center justify-between tabular-nums">
                        <span className="text-[12px] font-extrabold text-clinic-navy">
                            Đã gửi chỉ định ({orders.length})
                        </span>
                        {orders.length > 0 && (
                            <span className="text-[11px] text-clinic-text-secondary font-semibold">{formatCurrency(ordersTotal)}</span>
                        )}
                    </div>

                    {orders.length === 0 ? (
                        <p className="text-[11px] text-clinic-text-secondary py-1">
                            Chưa có chỉ định nào được gửi trong ca này.
                        </p>
                    ) : (
                        <div className="flex flex-col divide-y divide-clinic-border border border-clinic-border rounded-[6px] bg-clinic-surface max-h-60 overflow-y-auto">
                            {orders.map((o) => {
                                const st = ORDER_STATUS[o.trang_thai] || { label: 'Chờ thực hiện', badge: 'medpro-badge-neutral' }
                                const isDone = o.trang_thai === 'da_co_ket_qua' || o.trang_thai === 'da_duyet'
                                const isDoing = o.trang_thai === 'dang_thuc_hien'
                                return (
                                    <div key={o.id} className="flex items-center justify-between gap-2 p-2.5 bg-clinic-surface">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[12px] font-bold text-clinic-navy truncate">{o.ten_dich_vu || services.find((s) => String(s.id) === String(o.dich_vu_id))?.ten_dich_vu || 'Dịch vụ CLS'}</span>
                                            <span className="text-[10px] text-clinic-text-secondary tabular-nums">
                                                {o.don_gia_tai_thoi_diem ? formatCurrency(o.don_gia_tai_thoi_diem) : (services.find((s) => String(s.id) === String(o.dich_vu_id))?.don_gia ? formatCurrency(services.find((s) => String(s.id) === String(o.dich_vu_id))?.don_gia) : '')}
                                            </span>
                                        </div>
                                        <span className={`shrink-0 text-[10px] font-bold ${
                                            isDone ? 'medpro-badge-success' : isDoing ? 'medpro-badge-info' : 'medpro-badge-warning'
                                        }`}>
                                            {st.label}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
