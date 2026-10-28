import {
    LAB_TEMPLATES,
    FUNCTIONAL_TEMPLATES,
    RESULT_CLASS,
    evaluateIndicator,
    formatReference,
    FLAG_LABEL,
    LAB_DANH_GIA,
    LAB_HUONG_ARROW,
} from '../../../utils/constants/clinical'
import { ClinicIcon } from '../../common/ClinicIcon'
import { ClsImageGallery } from '../cls/ClsImageUploader'

function IndicatorTable({ params, values }) {
    return (
        <table className="medpro-table">
            <thead>
                <tr>
                    <th>Chỉ số</th>
                    <th>Kết quả</th>
                    <th>Tham chiếu</th>
                    <th>Đánh giá</th>
                </tr>
            </thead>
            <tbody>
                {params.map((p) => {
                    const flag = evaluateIndicator(p, values?.[p.code])
                    return (
                        <tr key={p.code} className={flag ? 'bg-rose-50/60' : ''}>
                            <td>
                                <div className="font-semibold text-[#003553]">{p.name}</div>
                                <div className="text-[11px] text-slate-500">{p.code}</div>
                            </td>
                            <td className={`font-bold ${flag ? 'text-rose-700' : 'text-[#003553]'}`}>
                                {values?.[p.code] || '—'} {p.unit}
                            </td>
                            <td className="text-slate-600">{formatReference(p)}</td>
                            <td>{flag ? <span className="medpro-badge-danger">{FLAG_LABEL[flag]}</span> : <span className="text-slate-500">Bình thường</span>}</td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}

// Chỉ số xét nghiệm đã được backend đánh giá (ket_qua_cls): cam = ngoài tham chiếu, đỏ = vượt ngưỡng nguy kịch
function LabResultTable({ rows }) {
    const critical = rows.filter((r) => r.danh_gia === 'NGUY_HIEM')
    return (
        <>
            {critical.length > 0 && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-800">
                    <ClinicIcon name="WarningCircle" size={18} weight="fill" className="mt-0.5 shrink-0" />
                    {critical.length} chỉ số vượt ngưỡng nguy hiểm: {critical.map((r) => r.ten).join(', ')}
                </div>
            )}
            <table className="medpro-table">
                <thead>
                    <tr>
                        <th>Chỉ số</th>
                        <th>Kết quả</th>
                        <th>Tham chiếu</th>
                        <th>Đánh giá</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => {
                        const style = LAB_DANH_GIA[r.danh_gia]
                        return (
                            <tr key={r.ma} className={style?.row || ''}>
                                <td>
                                    <div className="font-semibold text-[#003553]">{r.ten}</div>
                                    <div className="text-[11px] text-slate-500">{r.ma}</div>
                                </td>
                                <td className={`font-bold ${style ? style.text : 'text-[#003553]'}`}>
                                    {r.gia_tri} {r.don_vi}
                                </td>
                                <td className="text-slate-600">{r.khoang_tham_chieu || '—'}</td>
                                <td>
                                    {style ? (
                                        <span className={style.badge}>
                                            <ClinicIcon name={style.icon} size={12} weight="bold" />
                                            {r.danh_gia === 'NGUY_HIEM' ? `Nguy hiểm ${LAB_HUONG_ARROW[r.huong] || ''}` : style.label}
                                        </span>
                                    ) : (
                                        <span className="text-slate-500">Bình thường</span>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </>
    )
}

function TextBlock({ label, text }) {
    if (!text) return null
    return (
        <div>
            <div className="medpro-label">{label}</div>
            <p className="whitespace-pre-line text-[13px] text-slate-700">{text}</p>
        </div>
    )
}

// Hiển thị kết quả CLS theo 4 loại (dùng chung cho Bàn khám và trang Cận lâm sàng)
export default function ResultView({ order }) {
    if (!order) return null
    const detail = order.ket_qua_chi_tiet
    const cls = RESULT_CLASS[order.ket_qua_phan_loai]

    if (!detail) {
        return <p className="text-sm text-slate-500">Chưa có kết quả cho chỉ định này.</p>
    }

    return (
        <div className="space-y-4">
            {cls && (
                <div className="flex items-center gap-2 text-[13px]">
                    <span className="text-slate-600">Phân loại:</span>
                    <span className={cls.badge}>{cls.label}</span>
                </div>
            )}

            {detail.loai === 'XET_NGHIEM' &&
                (detail.chi_tiet ? (
                    <LabResultTable rows={detail.chi_tiet} />
                ) : (
                    <IndicatorTable params={LAB_TEMPLATES[order.ma_dich_vu] || []} values={detail.chi_so} />
                ))}

            {detail.loai === 'TDCN' && (
                <IndicatorTable params={FUNCTIONAL_TEMPLATES[order.ma_dich_vu]?.params || []} values={detail.thong_so} />
            )}

            {detail.loai === 'NOI_SOI' &&
                Object.entries(detail.vi_tri || {}).map(([site, text]) => <TextBlock key={site} label={site} text={text} />)}

            <TextBlock label="Mô tả" text={detail.mo_ta} />
            <TextBlock label="Kết luận" text={detail.ket_luan} />
            <TextBlock label="Đề nghị" text={detail.de_nghi} />
            <TextBlock label="Ghi chú" text={detail.ghi_chu} />

            {/* Ảnh CĐHA lưu trên máy chủ cần token nên hiển thị qua gallery, không mở link trực tiếp */}
            {order.tep_dinh_kem_urls?.length > 0 && <ClsImageGallery urls={order.tep_dinh_kem_urls} />}

            {order.tep_dinh_kem_url && !order.tep_dinh_kem_urls?.length && (
                <a href={order.tep_dinh_kem_url} target="_blank" rel="noreferrer" className="medpro-btn-outline">
                    Xem tệp đính kèm
                </a>
            )}
        </div>
    )
}
