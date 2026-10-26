import { useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { ENDOSCOPY_TEMPLATES } from '../../../utils/constants/clinical'
import { uploadFileAsync } from '../../../redux/actions/doctor/clinicalAction'
import { mergeImagesToGrid } from '../../../utils/helpers/mergeImages'
import { AppToast } from '../../common/AppNotification'
import { ClinicIcon } from '../../common/ClinicIcon'
import { PresetChips, ResultFormFooter, PerformerFields } from './ResultFormParts'

const CLASS_OPTIONS = [
    { value: 'BINH_THUONG', label: 'Bình thường' },
    { value: 'BAT_THUONG', label: 'Bất thường' },
]

// Form kết quả Nội soi: mô tả theo vị trí giải phẫu + ghép tối đa 4 khung hình thành 1 ảnh
export default function EndoscopyResultForm({ order, submitting, onSubmit }) {
    const dispatch = useDispatch()
    const tpl = ENDOSCOPY_TEMPLATES[order.ma_dich_vu] || { sites: [], presets: {} }
    const detail = order.ket_qua_chi_tiet || {}
    const [frames, setFrames] = useState([])
    const [merging, setMerging] = useState(false)

    const previews = useMemo(() => frames.map((f) => URL.createObjectURL(f)), [frames])
    useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

    const formik = useFormik({
        initialValues: {
            vi_tri: Object.fromEntries(tpl.sites.map((s) => [s, detail.vi_tri?.[s] || ''])),
            ket_luan: detail.ket_luan || '',
            de_nghi: detail.de_nghi || '',
            phan_loai: order.ket_qua_phan_loai || 'BINH_THUONG',
        },
        validationSchema: Yup.object({ ket_luan: Yup.string().trim().required('Nhập kết luận') }),
        onSubmit: () => {},
    })

    const { values, errors, touched, handleChange, setFieldValue, setValues } = formik

    const pickPreset = (name) => {
        const p = tpl.presets[name]
        setValues({
            ...values,
            vi_tri: Object.fromEntries(tpl.sites.map((s) => [s, p[s] || ''])),
            ket_luan: p.ket_luan || '',
            phan_loai: name.toLowerCase().includes('bình thường') ? 'BINH_THUONG' : 'BAT_THUONG',
        })
    }

    const addFrames = (e) => {
        const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'))
        e.target.value = ''
        setFrames((prev) => [...prev, ...files].slice(0, 4))
    }

    const submit = async (final) => {
        if (final) {
            const errs = await formik.validateForm()
            formik.setTouched({ ket_luan: true })
            if (Object.keys(errs).length) return
        }
        let url = order.tep_dinh_kem_url || null
        if (frames.length > 0) {
            setMerging(true)
            try {
                const merged = await mergeImagesToGrid(frames, { labels: tpl.sites })
                const res = await dispatch(uploadFileAsync(merged)).unwrap()
                url = res.url
            } catch (err) {
                AppToast.error(typeof err === 'string' ? err : err?.message || 'Không ghép được ảnh nội soi')
                return
            } finally {
                setMerging(false)
            }
        }
        onSubmit(
            {
                trang_thai: final ? 'da_co_ket_qua' : 'dang_thuc_hien',
                ket_qua_phan_loai: values.phan_loai,
                tep_dinh_kem_url: url,
                ket_qua_chi_tiet: { loai: 'NOI_SOI', vi_tri: values.vi_tri, ket_luan: values.ket_luan, de_nghi: values.de_nghi },
            },
            final
        )
    }

    return (
        <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
            <PerformerFields serviceName={order.ten_dich_vu} />
            <PresetChips label="Chèn mẫu kết quả:" presets={tpl.presets} onPick={pickPreset} />

            <div className="flex flex-wrap gap-5">
                <div className="flex min-w-0 flex-[999_1_360px] flex-col gap-4">
                    <h3 className="medpro-section-title !mb-0">Mô tả theo vị trí</h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {tpl.sites.map((site) => (
                            <label key={site}>
                                <span className="medpro-label">{site}</span>
                                <textarea
                                    rows={3}
                                    className="medpro-input"
                                    value={values.vi_tri[site]}
                                    onChange={(e) => setFieldValue('vi_tri', { ...values.vi_tri, [site]: e.target.value })}
                                />
                            </label>
                        ))}
                    </div>
                    <label>
                        <span className="medpro-label">Kết luận</span>
                        <textarea name="ket_luan" rows={2} className="medpro-input" value={values.ket_luan} onChange={handleChange} />
                        {touched.ket_luan && errors.ket_luan && <p className="mt-1 text-[12px] text-rose-600">{errors.ket_luan}</p>}
                    </label>
                    <label>
                        <span className="medpro-label">Đề nghị</span>
                        <input name="de_nghi" className="medpro-input" value={values.de_nghi} onChange={handleChange} />
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

                <div className="flex flex-[1_1_240px] flex-col gap-2">
                    <span className="medpro-label !mb-0">Ảnh nội soi (ghép thành 1 tệp)</span>
                    <div className="grid aspect-square grid-cols-2 gap-2 rounded-xl bg-[#12263F] p-2">
                        {Array.from({ length: 4 }).map((_, i) =>
                            previews[i] ? (
                                <div key={i} className="relative overflow-hidden rounded-lg bg-black">
                                    <img src={previews[i]} alt={tpl.sites[i] || `Khung ${i + 1}`} className="h-full w-full object-cover" />
                                    <button
                                        type="button"
                                        aria-label={`Bỏ khung hình ${i + 1}`}
                                        onClick={() => setFrames((prev) => prev.filter((_, idx) => idx !== i))}
                                        className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-700 cursor-pointer"
                                    >
                                        <ClinicIcon name="X" size={12} />
                                    </button>
                                </div>
                            ) : (
                                <div key={i} className="flex items-center justify-center rounded-lg bg-white/5 text-[12px] text-slate-300">
                                    {tpl.sites[i] || `Khung ${i + 1}`}
                                </div>
                            )
                        )}
                    </div>
                    <label className={`medpro-btn-outline ${frames.length >= 4 ? 'pointer-events-none opacity-50' : ''}`}>
                        Chọn ảnh để ghép
                        <input type="file" accept="image/*" multiple className="sr-only" onChange={addFrames} />
                    </label>
                    <span className="text-[11px] text-slate-500">
                        Chọn tối đa 4 khung hình theo thứ tự vị trí. Hệ thống tự ghép thành 1 ảnh khi lưu.
                        {order.tep_dinh_kem_url && frames.length === 0 ? ' Đã có ảnh ghép từ lần lưu trước.' : ''}
                    </span>
                </div>
            </div>

            <ResultFormFooter
                submitting={submitting || merging}
                alreadyReturned={order.trang_thai === 'da_co_ket_qua'}
                onDraft={() => submit(false)}
                onSubmit={() => submit(true)}
            />
        </form>
    )
}
