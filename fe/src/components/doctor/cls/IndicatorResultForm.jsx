import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Modal } from 'antd'
import { fetchLabTemplateAsync } from '../../../redux/actions/doctor/clinicalAction'
import {
    FUNCTIONAL_TEMPLATES,
    evaluateIndicator,
    formatReference,
    FLAG_LABEL,
    LAB_DANH_GIA,
    LAB_HUONG_ARROW,
    evaluateLabValue,
} from '../../../utils/constants/clinical'
import { ClinicIcon } from '../../common/ClinicIcon'
import { LoadingBlock, ErrorBlock } from '../clinical/StateBlocks'
import { FileAttachField, PresetChips, ClassificationBar, ResultFormFooter, PerformerFields } from './ResultFormParts'

const GIOI_TINH_LABEL = { NAM: 'nam', NU: 'nữ' }

// Phân loại tổng hợp như backend: có chỉ số nguy hiểm -> NGUY_KICH, có chỉ số thấp/cao -> BAT_THUONG
const classify = (evals) => {
    if (evals.some((e) => e?.danh_gia === 'NGUY_HIEM')) return 'NGUY_KICH'
    if (evals.some((e) => e && e.danh_gia && e.danh_gia !== 'BINH_THUONG')) return 'BAT_THUONG'
    return 'BINH_THUONG'
}

const criticalLimit = (c, huong) => (huong === 'THAP' ? `< ${c.nguy_kich_thap}` : `> ${c.nguy_kich_cao}`)

// Form nhập chỉ số xét nghiệm máu: bộ chỉ số mẫu lấy từ backend, tô cam/đỏ ngay khi gõ, backend đánh giá lại khi nộp
function LabIndicatorForm({ order, submitting, onSubmitLab }) {
    const dispatch = useDispatch()
    const [template, setTemplate] = useState(null)
    const [loadError, setLoadError] = useState(null)
    const [reloadKey, setReloadKey] = useState(0)
    const [values, setValues] = useState({})
    const [ketLuan, setKetLuan] = useState('')
    const [ghiChu, setGhiChu] = useState('')
    const [formError, setFormError] = useState(null)

    useEffect(() => {
        let cancelled = false
        dispatch(fetchLabTemplateAsync(order.id))
            .unwrap()
            .then((tpl) => {
                if (cancelled) return
                const saved = tpl.ket_qua
                setTemplate(tpl)
                setValues(Object.fromEntries(tpl.chi_so.map((c) => [c.ma, saved?.chi_so?.[c.ma] ?? ''])))
                setKetLuan(saved?.ket_luan || '')
                setGhiChu(saved?.ghi_chu || '')
            })
            .catch((msg) => !cancelled && setLoadError(msg))
        return () => {
            cancelled = true
        }
    }, [dispatch, order.id, reloadKey])

    const retry = () => {
        setLoadError(null)
        setReloadKey((k) => k + 1)
    }

    if (loadError) return <ErrorBlock message={loadError} onRetry={retry} />
    if (!template) return <LoadingBlock />

    const notStarted = order.trang_thai === 'da_chi_dinh'
    const returned = order.trang_thai === 'da_co_ket_qua'
    const rows = template.chi_so.map((c) => ({ c, ev: evaluateLabValue(c, values[c.ma]) }))
    const evals = rows.map((r) => r.ev).filter((ev) => ev && !ev.invalid)
    const classification = classify(evals)
    const abnormalCount = evals.filter((ev) => ev.danh_gia !== 'BINH_THUONG').length
    const critical = rows.filter((r) => r.ev?.danh_gia === 'NGUY_HIEM')

    const setValue = (ma, v) => {
        setFormError(null)
        setValues((prev) => ({ ...prev, [ma]: v }))
    }

    const submit = (final) => {
        if (rows.some((r) => r.ev?.invalid)) {
            setFormError('Có chỉ số không phải số hợp lệ (dùng dấu chấm hoặc phẩy cho phần thập phân).')
            return
        }
        const chiSo = Object.fromEntries(
            rows.filter((r) => r.ev).map((r) => [r.c.ma, Number(String(values[r.c.ma]).trim().replace(',', '.'))])
        )
        if (Object.keys(chiSo).length === 0) {
            setFormError('Nhập ít nhất một chỉ số.')
            return
        }
        const body = { chi_so: chiSo, ket_luan: ketLuan.trim() || null, ghi_chu: ghiChu.trim() || null, luu_nhap: !final }
        if (final && critical.length > 0) {
            Modal.confirm({
                title: `Trả kết quả có ${critical.length} chỉ số ở ngưỡng nguy hiểm?`,
                content: (
                    <div className="space-y-1.5 text-[13px]">
                        <ul className="list-disc pl-5 text-rose-700">
                            {critical.map(({ c, ev }) => (
                                <li key={c.ma}>
                                    <strong>{c.ten}</strong>: {values[c.ma]} {c.don_vi} (ngưỡng nguy kịch {criticalLimit(c, ev.huong)})
                                </li>
                            ))}
                        </ul>
                        <p className="text-slate-600">Hãy kiểm tra lại mẫu/máy trước khi trả. Bác sĩ chỉ định sẽ thấy cờ cảnh báo Nguy kịch.</p>
                    </div>
                ),
                okText: 'Đã kiểm tra, trả kết quả',
                okButtonProps: { danger: true },
                cancelText: 'Xem lại',
                onOk: () => onSubmitLab(body),
            })
            return
        }
        onSubmitLab(body)
    }

    return (
        <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-600">
                <span>
                    Bộ chỉ số: <strong className="text-[#003553]">{template.ten_mau}</strong>
                </span>
                <span>
                    · Khoảng tham chiếu{' '}
                    {template.gioi_tinh_ap_dung ? `theo giới ${GIOI_TINH_LABEL[template.gioi_tinh_ap_dung]}` : 'chung (chưa rõ giới tính)'}
                </span>
            </div>

            {notStarted && (
                <div className="flex items-center gap-2 rounded-xl bg-[#E8F4FD] px-4 py-3 text-[13px] text-[#003553]">
                    <ClinicIcon name="WarningCircle" size={16} />
                    Bấm “Tiếp nhận &amp; bắt đầu” trước khi nhập kết quả.
                </div>
            )}

            {critical.length > 0 && (
                <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
                    <ClinicIcon name="WarningCircle" size={20} weight="fill" className="mt-0.5 shrink-0" />
                    <div>
                        <div className="font-bold">{critical.length} chỉ số vượt ngưỡng nguy hiểm</div>
                        <div>
                            {critical.map(({ c, ev }) => `${c.ten} ${values[c.ma]} ${c.don_vi} (${criticalLimit(c, ev.huong)})`).join(' · ')}
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="medpro-table min-w-[620px]">
                    <thead>
                        <tr>
                            <th>Chỉ số</th>
                            <th className="w-40">Kết quả</th>
                            <th>Đơn vị</th>
                            <th>Tham chiếu</th>
                            <th>Đánh giá</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ c, ev }) => {
                            const style = ev && !ev.invalid ? LAB_DANH_GIA[ev.danh_gia] : null
                            return (
                                <tr key={c.ma} className={style?.row || ''}>
                                    <td>
                                        <div className="font-semibold text-[#003553]">{c.ten}</div>
                                        <div className="text-[11px] text-slate-500">{c.ma}</div>
                                    </td>
                                    <td>
                                        <input
                                            aria-label={c.ten}
                                            inputMode="decimal"
                                            disabled={notStarted || submitting}
                                            className={`medpro-input font-bold ${style ? `${style.input} ${style.text}` : ''} ${
                                                ev?.invalid ? '!border-rose-500' : ''
                                            }`}
                                            value={values[c.ma] ?? ''}
                                            onChange={(e) => setValue(c.ma, e.target.value)}
                                        />
                                    </td>
                                    <td className="text-slate-500">{c.don_vi}</td>
                                    <td className="text-slate-600">{c.khoang_tham_chieu || '—'}</td>
                                    <td>
                                        {ev?.invalid && <span className="text-[12px] text-rose-600">Không hợp lệ</span>}
                                        {style && (
                                            <span className={style.badge}>
                                                <ClinicIcon name={style.icon} size={12} weight="bold" />
                                                {ev.danh_gia === 'NGUY_HIEM' ? `Nguy hiểm ${LAB_HUONG_ARROW[ev.huong]}` : style.label}
                                            </span>
                                        )}
                                        {ev?.danh_gia === 'BINH_THUONG' && <span className="text-slate-500">Bình thường</span>}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {formError && <p className="mt-2 text-[12px] text-rose-600">{formError}</p>}
            </div>

            <ClassificationBar value={classification} abnormalCount={abnormalCount} />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label>
                    <span className="medpro-label">Kết luận</span>
                    <textarea rows={2} className="medpro-input" value={ketLuan} disabled={notStarted} onChange={(e) => setKetLuan(e.target.value)} />
                </label>
                <label>
                    <span className="medpro-label">Ghi chú</span>
                    <textarea
                        rows={2}
                        className="medpro-input"
                        placeholder="Ví dụ: mẫu hơi đục, đã ly tâm lại"
                        value={ghiChu}
                        disabled={notStarted}
                        onChange={(e) => setGhiChu(e.target.value)}
                    />
                </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                <span className="min-w-[240px] flex-1 text-[12px] text-slate-500">
                    Đánh giá do hệ thống tính lại khi lưu. Khi trả, kết quả và cờ cảnh báo hiện ngay ở cột “Kết quả CLS” trên Bàn khám.
                </span>
                {!returned && (
                    <button type="button" className="medpro-btn-outline" disabled={submitting || notStarted} onClick={() => submit(false)}>
                        Lưu nháp
                    </button>
                )}
                <button type="button" className="medpro-btn-primary" disabled={submitting || notStarted} onClick={() => submit(true)}>
                    {submitting ? 'Đang gửi…' : returned ? 'Cập nhật kết quả' : 'Trả kết quả'}
                    <ClinicIcon name="ArrowRight" size={16} weight="bold" />
                </button>
            </div>
        </form>
    )
}

// Form nhập thông số thăm dò chức năng (TDCN) theo mẫu ở FE
function FunctionalIndicatorForm({ order, submitting, onSubmit }) {
    const params = FUNCTIONAL_TEMPLATES[order.ma_dich_vu]?.params || []
    const presets = FUNCTIONAL_TEMPLATES[order.ma_dich_vu]?.presets
    const detail = order.ket_qua_chi_tiet || {}

    const formik = useFormik({
        initialValues: {
            values: Object.fromEntries(params.map((p) => [p.code, detail.thong_so?.[p.code] ?? ''])),
            ket_luan: detail.ket_luan || '',
            de_nghi: detail.de_nghi || '',
            ghi_chu: detail.ghi_chu || '',
            tep: order.tep_dinh_kem_url ? { url: order.tep_dinh_kem_url, ten_tep: 'Tệp đã đính kèm', la_anh: false } : null,
        },
        validationSchema: Yup.object({
            values: Yup.object().test('has-value', 'Nhập ít nhất một chỉ số', (obj) => Object.values(obj || {}).some((v) => String(v).trim())),
            ket_luan: Yup.string().trim().required('Nhập kết luận'),
        }),
        onSubmit: () => {},
    })

    const { values, errors, setFieldValue, handleChange } = formik
    const flags = params.map((p) => evaluateIndicator(p, values.values[p.code]))
    const abnormalCount = flags.filter(Boolean).length
    const classification = abnormalCount > 0 ? 'BAT_THUONG' : 'BINH_THUONG'

    const buildPayload = (trang_thai) => ({
        trang_thai,
        ket_qua_phan_loai: classification,
        tep_dinh_kem_url: values.tep?.url || null,
        ket_qua_chi_tiet: {
            loai: 'TDCN',
            thong_so: values.values,
            ket_luan: values.ket_luan,
            de_nghi: values.de_nghi,
            ghi_chu: values.ghi_chu,
        },
    })

    const submit = async (final) => {
        if (final) {
            const errs = await formik.validateForm()
            formik.setTouched({ values: true, ket_luan: true })
            if (Object.keys(errs).length) return
        }
        onSubmit(buildPayload(final ? 'da_co_ket_qua' : 'dang_thuc_hien'), final)
    }

    return (
        <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
            <PerformerFields serviceName={order.ten_dich_vu} />

            <div className="overflow-x-auto">
                <table className="medpro-table min-w-[620px]">
                    <thead>
                        <tr>
                            <th>Thông số đo</th>
                            <th className="w-40">Kết quả</th>
                            <th>Đơn vị</th>
                            <th>Tham chiếu</th>
                            <th>Đánh giá</th>
                        </tr>
                    </thead>
                    <tbody>
                        {params.map((p, i) => (
                            <tr key={p.code} className={flags[i] ? 'bg-rose-50/60' : ''}>
                                <td>
                                    <div className="font-semibold text-[#003553]">{p.name}</div>
                                    <div className="text-[11px] text-slate-500">{p.code}</div>
                                </td>
                                <td>
                                    <input
                                        aria-label={p.name}
                                        className={`medpro-input font-bold ${flags[i] ? '!border-rose-500 text-rose-700' : ''}`}
                                        value={values.values[p.code]}
                                        onChange={(e) => setFieldValue(`values.${p.code}`, e.target.value)}
                                        placeholder={p.normal ?? ''}
                                    />
                                </td>
                                <td className="text-slate-500">{p.unit}</td>
                                <td className="text-slate-600">{formatReference(p)}</td>
                                <td>{flags[i] ? <span className="medpro-badge-danger">{FLAG_LABEL[flags[i]]}</span> : <span className="text-slate-500">Bình thường</span>}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {params.length === 0 && <p className="py-4 text-center text-slate-500">Chưa có mẫu chỉ số cho dịch vụ này.</p>}
                {errors.values && formik.touched.values && <p className="mt-2 text-[12px] text-rose-600">{errors.values}</p>}
            </div>

            <ClassificationBar value={classification} abnormalCount={abnormalCount} />

            <div className="flex flex-wrap gap-5">
                <div className="flex min-w-0 flex-[999_1_360px] flex-col gap-4">
                    <PresetChips label="Chèn mẫu kết luận:" presets={presets} onPick={(name) => setFieldValue('ket_luan', presets[name])} />
                    <label>
                        <span className="medpro-label">Kết luận</span>
                        <textarea name="ket_luan" rows={3} className="medpro-input" value={values.ket_luan} onChange={handleChange} />
                        {errors.ket_luan && formik.touched.ket_luan && <p className="mt-1 text-[12px] text-rose-600">{errors.ket_luan}</p>}
                    </label>
                    <label>
                        <span className="medpro-label">Đề nghị</span>
                        <input name="de_nghi" className="medpro-input" value={values.de_nghi} onChange={handleChange} />
                    </label>
                    <label>
                        <span className="medpro-label">Ghi chú</span>
                        <textarea name="ghi_chu" rows={2} className="medpro-input" placeholder="Ví dụ: mẫu hơi đục, đã ly tâm lại" value={values.ghi_chu} onChange={handleChange} />
                    </label>
                </div>
                <div className="flex-[1_1_240px]">
                    <FileAttachField label="Bản ghi đo (1 tệp)" value={values.tep} onChange={(v) => setFieldValue('tep', v)} />
                </div>
            </div>

            <ResultFormFooter
                submitting={submitting}
                alreadyReturned={order.trang_thai === 'da_co_ket_qua'}
                onDraft={() => submit(false)}
                onSubmit={() => submit(true)}
            />
        </form>
    )
}

// Form nhập kết quả dạng bảng chỉ số — Xét nghiệm (loai=XET_NGHIEM, API thật) và Thăm dò chức năng (loai=TDCN)
export default function IndicatorResultForm({ order, loai, submitting, onSubmit, onSubmitLab }) {
    if (loai === 'XET_NGHIEM') return <LabIndicatorForm order={order} submitting={submitting} onSubmitLab={onSubmitLab} />
    return <FunctionalIndicatorForm order={order} submitting={submitting} onSubmit={onSubmit} />
}
