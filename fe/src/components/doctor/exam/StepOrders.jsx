import { useMemo, useState } from 'react'
import { SERVICE_GROUPS, SPECIALTY_PACKS, ORDER_STATUS } from '../../../utils/constants/clinical'
import { formatCurrency } from '../../../utils/helpers/formatCurrency'
import { ClinicIcon } from '../../common/ClinicIcon'
import { EmptyBlock } from '../clinical/StateBlocks'

export default function StepOrders({ encounter, services, locked, submitting, onSubmit, onCancelOrder }) {
    const [keyword, setKeyword] = useState('')
    const [pack, setPack] = useState(null)
    const [picked, setPicked] = useState([])

    const orders = encounter.danh_sach_chi_dinh.filter((o) => o.trang_thai !== 'da_huy')
    const orderedIds = useMemo(() => new Set(orders.map((o) => o.dich_vu_id)), [orders])

    const q = keyword.trim().toLowerCase()
    const filtered = services.filter((s) => !q || s.ten_dich_vu.toLowerCase().includes(q) || s.ma_dich_vu.toLowerCase().includes(q))

    const toggle = (id) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

    const applyPack = (p) => {
        setPack(p.key)
        const ids = services.filter((s) => p.services.includes(s.ma_dich_vu) && !orderedIds.has(s.id)).map((s) => s.id)
        setPicked((prev) => Array.from(new Set([...prev, ...ids])))
    }

    const total = orders.reduce((sum, o) => sum + (services.find((s) => s.id === o.dich_vu_id)?.don_gia || 0), 0)

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
                                    const already = orderedIds.has(s.id)
                                    const checked = already || picked.includes(s.id)
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

            <div className="flex flex-[1_1_260px] flex-col gap-3 self-start rounded-2xl bg-[#E8F4FD] p-4">
                <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#003553]">Đã chỉ định ({orders.length})</h3>
                {orders.length === 0 && <p className="text-[12px] text-slate-600">Chưa có chỉ định nào.</p>}
                {orders.map((o) => {
                    const st = ORDER_STATUS[o.trang_thai]
                    return (
                        <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2.5">
                            <span className="text-[13px] font-medium text-[#003553]">{o.ten_dich_vu}</span>
                            <span className="flex items-center gap-1">
                                <span className={st.badge}>{st.label}</span>
                                {o.trang_thai === 'da_chi_dinh' && !locked && (
                                    <button
                                        type="button"
                                        aria-label={`Hủy chỉ định ${o.ten_dich_vu}`}
                                        onClick={() => onCancelOrder(o.id)}
                                        className="rounded-full p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                                    >
                                        <ClinicIcon name="X" size={14} />
                                    </button>
                                )}
                            </span>
                        </div>
                    )
                })}
                {picked.length > 0 && <p className="text-[12px] text-[#003553]">Đang chọn thêm {picked.length} dịch vụ.</p>}
                <p className="text-[12px] text-slate-600">Tạm tính {formatCurrency(total)} · thu tại quầy lễ tân</p>
                <button type="button" className="medpro-btn-primary w-full" disabled={locked || picked.length === 0 || submitting} onClick={handleSend}>
                    {submitting ? 'Đang gửi…' : 'Gửi chỉ định'}
                </button>
            </div>
        </div>
    )
}
