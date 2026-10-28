import { useFormik } from 'formik'
import * as Yup from 'yup'
import { IMAGING_PRESETS } from '../../../utils/constants/clinical'
import { FileAttachField, PresetChips, ResultFormFooter, PerformerFields } from './ResultFormParts'

const CLASS_OPTIONS = [
    { value: 'BINH_THUONG', label: 'Bình thường' },
    { value: 'BAT_THUONG', label: 'Bất thường' },
    { value: 'NGUY_KICH', label: 'Nguy kịch' },
]

// Form kết quả Chẩn đoán hình ảnh: Mô tả / Kết luận / Đề nghị + 1 ảnh hoặc PDF
export default function ImagingResultForm({ order, submitting, onSubmit }) {
    const presets = IMAGING_PRESETS[order.ma_dich_vu] || {}
    const detail = order.ket_qua_chi_tiet || {}

    const formik = useFormik({
        initialValues: {
            mo_ta: detail.mo_ta || '',
            ket_luan: detail.ket_luan || '',
            de_nghi: detail.de_nghi || '',
            phan_loai: order.ket_qua_phan_loai || 'BINH_THUONG',
            tep: order.tep_dinh_kem_url ? { url: order.tep_dinh_kem_url, ten_tep: 'Ảnh đã đính kèm', la_anh: true } : null,
        },
        validationSchema: Yup.object({
            mo_ta: Yup.string().trim().required('Nhập mô tả'),
            ket_luan: Yup.string().trim().required('Nhập kết luận'),
        }),
        onSubmit: () => {},
    })

    const { values, errors, touched, handleChange, setFieldValue, setValues } = formik

    const pickPreset = (name) => setValues({ ...values, mo_ta: presets[name].mo_ta, ket_luan: presets[name].ket_luan })

    const submit = async (final) => {
        if (final) {
            const errs = await formik.validateForm()
            formik.setTouched({ mo_ta: true, ket_luan: true })
            if (Object.keys(errs).length) return
        }
        onSubmit(
            {
                trang_thai: final ? 'da_co_ket_qua' : 'dang_thuc_hien',
                ket_qua_phan_loai: values.phan_loai,
                tep_dinh_kem_url: values.tep?.url || null,
                ket_qua_chi_tiet: { loai: 'CDHA', mo_ta: values.mo_ta, ket_luan: values.ket_luan, de_nghi: values.de_nghi },
            },
            final
        )
    }

    return (
        <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
            <PerformerFields serviceName={order.ten_dich_vu} />
            <PresetChips label="Chèn mẫu kết quả:" presets={presets} onPick={pickPreset} />

            <div className="flex flex-wrap gap-5">
                <div className="flex min-w-0 flex-[999_1_360px] flex-col gap-4">
                    <label>
                        <span className="medpro-label">Mô tả</span>
                        <textarea name="mo_ta" rows={7} className="medpro-input" value={values.mo_ta} onChange={handleChange} />
                        {touched.mo_ta && errors.mo_ta && <p className="mt-1 text-[12px] text-rose-600">{errors.mo_ta}</p>}
                    </label>
                    <label>
                        <span className="medpro-label">Kết luận</span>
                        <textarea name="ket_luan" rows={2} className="medpro-input" value={values.ket_luan} onChange={handleChange} />
                        {touched.ket_luan && errors.ket_luan && <p className="mt-1 text-[12px] text-rose-600">{errors.ket_luan}</p>}
                    </label>
                    <label>
                        <span className="medpro-label">Đề nghị</span>
                        <input name="de_nghi" className="medpro-input" placeholder="Ví dụ: đối chiếu lâm sàng" value={values.de_nghi} onChange={handleChange} />
                    </label>
                    <fieldset>
                        <legend className="medpro-label">Phân loại kết quả</legend>
                        <div className="flex flex-wrap gap-4">
                            {CLASS_OPTIONS.map((o) => (
                                <label key={o.value} className="flex items-center gap-2 text-[13px] cursor-pointer">
                                    <input type="radio" name="phan_loai" value={o.value} checked={values.phan_loai === o.value} onChange={handleChange} />
                                    {o.label}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                </div>
                <div className="flex-[1_1_240px]">
                    <FileAttachField label="Ảnh / phiếu kết quả (1 tệp)" value={values.tep} onChange={(v) => setFieldValue('tep', v)} />
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
