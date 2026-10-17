import { useFormik } from 'formik'
import * as Yup from 'yup'
import {
    LAB_TEMPLATES,
    FUNCTIONAL_TEMPLATES,
    evaluateIndicator,
    formatReference,
    FLAG_LABEL,
} from '../../../utils/constants/clinical'
import { FileAttachField, PresetChips, ClassificationBar, ResultFormFooter, PerformerFields } from './ResultFormParts'

// Form nhập kết quả dạng bảng chỉ số — dùng cho Xét nghiệm (loai=XET_NGHIEM) và Thăm dò chức năng (loai=TDCN)
export default function IndicatorResultForm({ order, loai, submitting, onSubmit }) {
    const isLab = loai === 'XET_NGHIEM'
    const params = isLab ? LAB_TEMPLATES[order.ma_dich_vu] || [] : FUNCTIONAL_TEMPLATES[order.ma_dich_vu]?.params || []
    const presets = isLab ? null : FUNCTIONAL_TEMPLATES[order.ma_dich_vu]?.presets
    const detail = order.ket_qua_chi_tiet || {}
    const valuesKey = isLab ? 'chi_so' : 'thong_so'

    const formik = useFormik({
        initialValues: {
            values: Object.fromEntries(params.map((p) => [p.code, detail[valuesKey]?.[p.code] ?? ''])),
            ket_luan: detail.ket_luan || '',
            de_nghi: detail.de_nghi || '',
            ghi_chu: detail.ghi_chu || '',
            tep: order.tep_dinh_kem_url ? { url: order.tep_dinh_kem_url, ten_tep: 'Tệp đã đính kèm', la_anh: false } : null,
        },
        validationSchema: Yup.object({
            values: Yup.object().test('has-value', 'Nhập ít nhất một chỉ số', (obj) => Object.values(obj || {}).some((v) => String(v).trim())),
            ket_luan: isLab ? Yup.string() : Yup.string().trim().required('Nhập kết luận'),
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
            loai,
            [valuesKey]: values.values,
            ...(isLab ? {} : { ket_luan: values.ket_luan, de_nghi: values.de_nghi }),
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
            {!isLab && <PerformerFields serviceName={order.ten_dich_vu} />}

            <div className="overflow-x-auto">
                <table className="medpro-table min-w-[620px]">
                    <thead>
                        <tr>
                            <th>{isLab ? 'Chỉ số' : 'Thông số đo'}</th>
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
                    {!isLab && (
                        <>
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
                        </>
                    )}
                    <label>
                        <span className="medpro-label">Ghi chú</span>
                        <textarea name="ghi_chu" rows={2} className="medpro-input" placeholder="Ví dụ: mẫu hơi đục, đã ly tâm lại" value={values.ghi_chu} onChange={handleChange} />
                    </label>
                </div>
                <div className="flex-[1_1_240px]">
                    <FileAttachField
                        label={isLab ? 'Phiếu kết quả máy xét nghiệm (1 tệp)' : 'Bản ghi đo (1 tệp)'}
                        value={values.tep}
                        onChange={(v) => setFieldValue('tep', v)}
                    />
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
