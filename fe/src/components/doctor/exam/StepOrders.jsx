import { useMemo, useState } from 'react'
import { SERVICE_GROUPS, SPECIALTY_PACKS, ORDER_STATUS } from '../../../utils/constants/clinical'
import { formatCurrency } from '../../../utils/helpers/formatCurrency'
import { ClinicIcon } from '../../common/ClinicIcon'
import { EmptyBlock } from '../clinical/StateBlocks'
import { printHtmlDocument } from '../../../utils/helpers/printUtils'

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

    const handlePrintOrderSlip = () => {
        if (orders.length === 0) return
        const bn = encounter?.benh_nhan || {}
        const patientName = bn.ho_ten || encounter?.ten_benh_nhan || 'Bệnh nhân'
        const patientDob = bn.ngay_sinh || encounter?.ngay_sinh || (bn.tuoi ? `${bn.tuoi} tuổi` : '—')
        const patientGender = bn.gioi_tinh || encounter?.gioi_tinh || 'Nam'
        const patientCode = bn.ma || bn.ma_benh_nhan || encounter?.ma_benh_nhan || (encounter?.id ? `BN-2026-${String(encounter.id).padStart(4, '0')}` : 'BN-2026')
        const patientPhone = bn.so_dien_thoai || encounter?.so_dien_thoai || '—'
        const patientAddress = bn.dia_chi || encounter?.dia_chi || '—'
        const doctorName = encounter?.ten_bac_si || 'BS. Chuyên khoa'
        const reason = encounter?.ly_do_vao_kham || encounter?.chan_doan_so_bo || 'Khám kiểm tra sức khỏe'

        const orderRows = orders.map((o, idx) => {
            const svc = services.find((s) => String(s.id) === String(o.dich_vu_id))
            const price = o.don_gia_tai_thoi_diem || svc?.don_gia || 0
            const room = svc?.nhom_dich_vu === 'XET_NGHIEM' ? 'Phòng 102 (Xét nghiệm)'
                : svc?.nhom_dich_vu === 'CDHA' ? 'Phòng 105 (X-Quang / Siêu âm)'
                : svc?.nhom_dich_vu === 'NOI_SOI' ? 'Phòng 108 (Nội soi tiêu hóa)'
                : 'Phòng Thăm dò chức năng'
            return `
                <tr>
                    <td style="border: 1px solid #333; padding: 5px; text-align: center; font-weight: bold;">${idx + 1}</td>
                    <td style="border: 1px solid #333; padding: 5px;"><b>${o.ten_dich_vu || svc?.ten_dich_vu || 'Dịch vụ CLS'}</b></td>
                    <td style="border: 1px solid #333; padding: 5px; text-align: center;">${room}</td>
                    <td style="border: 1px solid #333; padding: 5px; text-align: right; font-weight: bold;">${price > 0 ? price.toLocaleString('vi-VN') + ' đ' : 'Theo BHYT'}</td>
                </tr>
            `
        }).join('')

        const slipHtml = `
            <div style="font-family: 'Times New Roman', serif; padding: 6px; color: #111;">
                <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px;">
                    <div>
                        <div style="font-size: 10px; font-weight: bold; text-transform: uppercase;">SỞ Y TẾ TP. HỒ CHÍ MINH</div>
                        <div style="font-size: 13px; font-weight: bold; text-transform: uppercase;">PHÒNG KHÁM ĐA KHOA THÔNG MINH CLINIC-AI</div>
                        <div style="font-size: 10px; color: #444;">Địa chỉ: Khu Công Nghệ Cao, TP. Thủ Đức · Hotline: 1900 6868</div>
                    </div>
                    <div style="text-align: right; font-size: 10px;">
                        <div>Mã hồ sơ: <b>#${encounter?.id || '—'}</b></div>
                        <div>Mã BN: <b>${patientCode}</b></div>
                        <div>Ngày chỉ định: <b>${new Date().toLocaleDateString('vi-VN')}</b></div>
                    </div>
                </div>

                <div style="text-align: center; margin-bottom: 10px;">
                    <h2 style="font-size: 16px; font-weight: bold; margin: 0; text-transform: uppercase;">PHIẾU CHỈ ĐỊNH CẬN LÂM SÀNG</h2>
                    <div style="font-size: 10px; font-style: italic;">(Bệnh nhân xuất trình phiếu này tại các phòng kỹ thuật để thực hiện)</div>
                </div>

                <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 11.5px; margin-bottom: 10px; line-height: 1.5;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                        <div>Họ và tên: <b style="text-transform: uppercase;">${patientName}</b></div>
                        <div>Giới tính / Năm sinh: <b>${patientGender} · ${patientDob}</b></div>
                        <div>Số điện thoại: <b>${patientPhone}</b></div>
                        <div>Địa chỉ: <b>${patientAddress}</b></div>
                        <div style="grid-column: 1 / -1;">Chẩn đoán sơ bộ / Lý do khám: <b>${reason}</b></div>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; margin-bottom: 10px;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="border: 1px solid #333; padding: 5px; width: 35px; text-align: center;">STT</th>
                            <th style="border: 1px solid #333; padding: 5px; text-align: left;">Tên dịch vụ kỹ thuật</th>
                            <th style="border: 1px solid #333; padding: 5px; text-align: center; width: 180px;">Nơi thực hiện</th>
                            <th style="border: 1px solid #333; padding: 5px; text-align: right; width: 95px;">Đơn giá</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orderRows}
                    </tbody>
                    <tfoot>
                        <tr style="font-weight: bold; background: #f8fafc;">
                            <td colspan="3" style="border: 1px solid #333; padding: 5px; text-align: right; text-transform: uppercase;">Tổng tiền dịch vụ ước tính:</td>
                            <td style="border: 1px solid #333; padding: 5px; text-align: right; color: #003553;">${ordersTotal.toLocaleString('vi-VN')} đ</td>
                        </tr>
                    </tfoot>
                </table>

                <div style="font-size: 10.5px; font-style: italic; color: #475569; margin-bottom: 8px;">
                    * Lưu ý: Đối với xét nghiệm máu, người bệnh cần nhịn ăn sáng theo chỉ dẫn. Đối với siêu âm bụng, vui lòng uống nước và nhịn tiểu trước khi siêu âm.
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; margin-top: 14px; text-align: center; font-size: 11.5px; page-break-inside: avoid;">
                    <div>
                        <div style="font-weight: bold; text-transform: uppercase;">Bệnh nhân / Người nhà</div>
                        <div style="font-size: 9.5px; font-style: italic;">(Ký và nhận phiếu)</div>
                    </div>
                    <div>
                        <div style="font-style: italic; font-size: 10.5px;">Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</div>
                        <div style="font-weight: bold; text-transform: uppercase; margin-top: 2px;">Bác sĩ chỉ định</div>
                        <div style="font-size: 9.5px; font-style: italic;">(Ký và ghi rõ họ tên)</div>
                        <div style="margin-top: 32px; font-weight: bold;">${doctorName}</div>
                    </div>
                </div>
            </div>
        `

        printHtmlDocument({
            title: `PhieuChiDinh_${patientCode}`,
            contentHtml: slipHtml,
            paperSize: 'A5',
        })
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

                    {orders.length > 0 && (
                        <button
                            type="button"
                            onClick={handlePrintOrderSlip}
                            className="w-full mt-2 py-2 px-3 rounded-xl font-bold text-xs bg-white hover:bg-sky-50 text-[#0077B6] border border-sky-300 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                            title="In phiếu chỉ định xét nghiệm/CĐHA cho người bệnh"
                        >
                            <ClinicIcon name="Printer" size={15} />
                            <span>In Phiếu Chỉ Định CLS ({orders.length} DV)</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
