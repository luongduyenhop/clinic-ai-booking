import { useState } from 'react'
import { Drawer } from 'antd'
import { ORDER_STATUS, RESULT_CLASS } from '../../../utils/constants/clinical'
import { formatDate } from '../../../utils/helpers/formatDate'
import ResultView from '../clinical/ResultView'
import { ClinicIcon } from '../../common/ClinicIcon'

// Số chỉ số xét nghiệm bất thường do backend đánh giá (chỉ có ở kết quả nhập theo bộ chỉ số mẫu)
const abnormalCount = (o) => (o.ket_qua_chi_tiet?.chi_tiet || []).filter((r) => r.danh_gia !== 'BINH_THUONG').length

export default function ClsResultRail({ encounter }) {
    const [viewing, setViewing] = useState(null)
    const orders = encounter.danh_sach_chi_dinh.filter((o) => o.trang_thai !== 'da_huy')
    const done = orders.filter((o) => o.trang_thai === 'da_co_ket_qua').length

    return (
        <aside aria-label="Kết quả cận lâm sàng và lịch sử" className="flex w-full flex-col gap-4 lg:w-[290px] lg:shrink-0">
            <div className="medpro-card flex flex-col gap-2.5 p-4">
                <div className="medpro-section-title !mb-0">
                    <span>Kết quả CLS</span>
                    <span className="text-[11px] font-medium text-slate-500">
                        {done}/{orders.length} có kết quả
                    </span>
                </div>
                {orders.length === 0 && <p className="text-[12px] text-slate-500">Chưa có chỉ định cận lâm sàng.</p>}
                {orders.map((o) => {
                    const st = ORDER_STATUS[o.trang_thai]
                    const cls = RESULT_CLASS[o.ket_qua_phan_loai]
                    const hasResult = o.trang_thai === 'da_co_ket_qua'
                    return (
                        <button
                            key={o.id}
                            type="button"
                            disabled={!hasResult}
                            onClick={() => setViewing(o)}
                            className="flex flex-col gap-1 rounded-xl bg-[#F5F9FC] p-3 text-left transition hover:bg-[#EEF6FC] cursor-pointer disabled:cursor-default disabled:hover:bg-[#F5F9FC]"
                        >
                            <span className="flex items-center justify-between gap-2">
                                <span className="text-[13px] font-semibold text-[#003553]">{o.ten_dich_vu}</span>
                                <span className={st.badge}>{st.label}</span>
                            </span>
                            {hasResult && cls && (
                                <span
                                    className={`flex items-center gap-1 text-[12px] ${o.ket_qua_phan_loai === 'BINH_THUONG' ? 'text-emerald-700' : 'font-bold text-rose-700'}`}
                                >
                                    {o.ket_qua_phan_loai !== 'BINH_THUONG' && (
                                        <ClinicIcon name={o.ket_qua_phan_loai === 'NGUY_KICH' ? 'WarningCircle' : 'Warning'} size={14} weight="fill" />
                                    )}
                                    {cls.label}
                                    {abnormalCount(o) > 0 && ` · ${abnormalCount(o)} chỉ số`} · bấm để xem
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            <div className="medpro-card flex flex-col gap-3 p-4">
                <div className="medpro-section-title !mb-0">Lần khám trước</div>
                {(encounter.lich_su || []).length === 0 && <p className="text-[12px] text-slate-500">Đây là lần khám đầu tiên.</p>}
                {(encounter.lich_su || []).map((h) => (
                    <div key={h.id} className="flex gap-3">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#00B5F1]" />
                        <div>
                            <div className="text-[12px] text-slate-500">
                                {formatDate(h.ngay)} · {h.bac_si}
                            </div>
                            <div className="text-[13px] font-semibold text-[#003553]">{h.chan_doan}</div>
                        </div>
                    </div>
                ))}
            </div>

            <Drawer title={viewing?.ten_dich_vu} open={Boolean(viewing)} onClose={() => setViewing(null)} size={560}>
                <ResultView order={viewing} />
            </Drawer>
        </aside>
    )
}
