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
                    <span className="text-[12px] text-slate-500">Gói theo khoa:</span>
                    {SPECIALTY_PACKS.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            disabled={locked}
                            aria-pressed={pack === p.key}
                            onClick={() => applyPack(p)}
                            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition cursor-pointer disabled:cursor-not-allowed ${
                                pack === p.key ? 'bg-[#E8F4FD] text-[#003553] ring-2 ring-[#00B5F1]' : 'bg-white text-[#003553] ring-1 ring-slate-300 hover:ring-[#00B5F1]'
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
                            <legend className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                <ClinicIcon name={g.icon} size={14} /> {g.label}
                            </legend>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
                                {items.map((s) => {
                                    const already = orderedIds.has(String(s.id))
                                    const checked = already || picked.some((pid) => String(pid) === String(s.id))
                                    return (
                                        <label
                                            key={s.id}
                                            className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-[13px] transition ${
                                                already
                                                    ? 'cursor-not-allowed bg-slate-100 text-slate-500'
                                                    : checked
                                                      ? 'cursor-pointer bg-[#E8F4FD] font-semibold text-[#003553] ring-2 ring-[#00B5F1]'
                                                      : 'cursor-pointer bg-[#F5F9FC] hover:bg-[#EEF6FC]'
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

            <div className="flex flex-[1_1_280px] flex-col gap-3.5 self-start rounded-2xl bg-[#E8F4FD] p-4 border border-sky-200 shadow-xs">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[12px] font-extrabold uppercase tracking-wide text-[#003553]">
                            Đang chọn ({pickedServices.length})
                        </span>
                        {pickedServices.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setPicked([])}
                                className="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
                            >
                                Bỏ chọn tất cả
                            </button>
                        )}
                    </div>

                    {pickedServices.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic py-1">
                            Chưa chọn dịch vụ nào. Tick chọn các dịch vụ bên trái để thêm vào phiếu chỉ định.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                            {pickedServices.map((s) => (
                                <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-2.5 shadow-2xs border border-sky-200">
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[12px] font-bold text-[#003553] truncate">{s.ten_dich_vu}</span>
                                        <span className="text-[11px] font-semibold text-slate-600">{formatCurrency(s.don_gia)}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggle(s.id)}
                                        className="shrink-0 p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                        title="Bỏ dịch vụ này"
                                    >
                                        <ClinicIcon name="X" size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {pickedServices.length > 0 && (
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-sky-200">
                            <span className="font-medium text-slate-600">Tạm tính ({pickedServices.length} DV):</span>
                            <span className="font-extrabold text-[#003553]">{formatCurrency(pickedTotal)}</span>
                        </div>
                    )}

                    <button
                        type="button"
                        className={`w-full py-2.5 px-3 rounded-xl font-extrabold text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            pickedServices.length > 0
                                ? 'bg-[#00A9E3] hover:bg-[#0092c4] text-white shadow-md shadow-sky-500/25 animate-pulse'
                                : 'bg-slate-200 text-slate-400'
                        }`}
                        disabled={locked || pickedServices.length === 0 || submitting}
                        onClick={handleSend}
                    >
                        {submitting ? 'Đang gửi sang KTV…' : pickedServices.length > 0 ? `🚀 Gửi ${pickedServices.length} chỉ định sang phòng KTV` : 'Gửi chỉ định sang phòng KTV'}
                    </button>
                </div>

                <div className="flex flex-col gap-2 pt-3 border-t border-sky-200">
                    <div className="flex items-center justify-between">
                        <span className="text-[12px] font-extrabold uppercase tracking-wide text-[#003553]">
                            Đã gửi chỉ định ({orders.length})
                        </span>
                        {orders.length > 0 && (
                            <span className="text-[11px] text-slate-600 font-semibold">{formatCurrency(ordersTotal)}</span>
                        )}
                    </div>

                    {orders.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic py-1">
                            Chưa có chỉ định nào được gửi trong ca này.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-0.5">
                            {orders.map((o) => {
                                const st = ORDER_STATUS[o.trang_thai] || { label: 'Chờ thực hiện', badge: 'medpro-badge' }
                                const isDone = o.trang_thai === 'da_co_ket_qua'
                                const isDoing = o.trang_thai === 'dang_thuc_hien'
                                return (
                                    <div key={o.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-2.5 shadow-2xs border border-slate-200">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[12px] font-bold text-[#003553] truncate">{o.ten_dich_vu || services.find((s) => String(s.id) === String(o.dich_vu_id))?.ten_dich_vu || "Dịch vụ CLS"}</span>
                                            <span className="text-[10px] text-slate-400">
                                                {o.don_gia_tai_thoi_diem ? formatCurrency(o.don_gia_tai_thoi_diem) : (services.find((s) => String(s.id) === String(o.dich_vu_id))?.don_gia ? formatCurrency(services.find((s) => String(s.id) === String(o.dich_vu_id))?.don_gia) : '')}
                                            </span>
                                        </div>
                                        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                            isDone ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : isDoing ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
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
