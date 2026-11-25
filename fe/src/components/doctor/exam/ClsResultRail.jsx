import { useState } from 'react'
import { Drawer } from 'antd'
import { ORDER_STATUS, RESULT_CLASS } from '../../../utils/constants/clinical'
import { formatDate } from '../../../utils/helpers/formatDate'
import ResultView from '../clinical/ResultView'
import { ClinicIcon } from '../../common/ClinicIcon'

const abnormalCount = (o) =>
    (o.ket_qua_chi_tiet?.chi_tiet || []).filter((r) => r.danh_gia !== 'BINH_THUONG').length

export default function ClsResultRail({ encounter }) {
    const [viewing, setViewing] = useState(null)
    const orders = encounter.danh_sach_chi_dinh.filter((o) => o.trang_thai !== 'da_huy')
    const done = orders.filter((o) => o.trang_thai === 'da_co_ket_qua').length

    return (
        <aside
            aria-label="Kết quả cận lâm sàng và lịch sử"
            className="flex w-full flex-col gap-4 lg:w-[290px] lg:shrink-0"
        >
            <div className="medpro-card flex flex-col gap-2.5 p-4">
                <div className="medpro-section-title !mb-0">
                    <span>Kết quả CLS</span>
                    <span className="text-[11px] font-medium text-clinic-text-muted tabular-nums">
                        {done}/{orders.length} có kết quả
                    </span>
                </div>
                {orders.length === 0 && (
                    <p className="text-xs text-clinic-text-secondary">
                        Chưa có chỉ định cận lâm sàng.
                    </p>
                )}
                {orders.map((o) => {
                    const st = ORDER_STATUS[o.trang_thai] || {
                        label: o.trang_thai || 'Chờ làm',
                        badge: 'medpro-badge',
                    }
                    const cls = RESULT_CLASS[o.ket_qua_phan_loai]
                    const hasResult = o.trang_thai === 'da_co_ket_qua'
                    return (
                        <button
                            key={o.id}
                            type="button"
                            disabled={!hasResult}
                            onClick={() => setViewing(o)}
                            className="flex flex-col gap-1 rounded-[6px] bg-clinic-bg p-3 text-left transition-colors hover:bg-clinic-surface-alt cursor-pointer disabled:cursor-default disabled:hover:bg-clinic-bg"
                        >
                            <span className="flex items-center justify-between gap-2">
                                <span className="text-[13px] font-semibold text-clinic-navy">
                                    {o.ten_dich_vu}
                                </span>
                                <span className={st.badge}>{st.label}</span>
                            </span>
                            {hasResult && cls && (
                                <span
                                    className={`flex items-center gap-1 text-xs tabular-nums ${
                                        o.ket_qua_phan_loai === 'BINH_THUONG'
                                            ? 'text-clinic-success'
                                            : 'font-bold text-clinic-danger'
                                    }`}
                                >
                                    {o.ket_qua_phan_loai !== 'BINH_THUONG' && (
                                        <ClinicIcon
                                            name={
                                                o.ket_qua_phan_loai === 'NGUY_KICH'
                                                    ? 'WarningCircle'
                                                    : 'Warning'
                                            }
                                            size={14}
                                            weight="fill"
                                        />
                                    )}
                                    <span>
                                        {cls.label}
                                        {abnormalCount(o) > 0 && ` · ${abnormalCount(o)} chỉ số`} · bấm để xem
                                    </span>
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            <div className="medpro-card flex flex-col gap-3 p-4">
                <div className="medpro-section-title !mb-0">Lần khám trước</div>
                {(encounter.lich_su || []).length === 0 && (
                    <p className="text-xs text-clinic-text-secondary">
                        Đây là lần khám đầu tiên.
                    </p>
                )}
                {(encounter.lich_su || []).map((h) => (
                    <div key={h.id} className="flex gap-3">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-clinic-cta" />
                        <div>
                            <div className="text-xs text-clinic-text-muted tabular-nums">
                                {formatDate(h.ngay)} · {h.bac_si}
                            </div>
                            <div className="text-[13px] font-semibold text-clinic-navy">
                                {h.chan_doan}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Drawer
                title={viewing?.ten_dich_vu}
                open={Boolean(viewing)}
                onClose={() => setViewing(null)}
                size={560}
            >
                <ResultView order={viewing} />
            </Drawer>
        </aside>
    )
}
