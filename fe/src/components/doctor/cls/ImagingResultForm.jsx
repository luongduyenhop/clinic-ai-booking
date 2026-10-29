import { useEffect, useRef, useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { IMAGING_PRESETS } from '../../../utils/constants/clinical'
import { clinicalService } from '../../../services/doctor/ClinicalService'
import { PresetChips, ResultFormFooter, PerformerFields } from './ResultFormParts'
import ClsImageUploader from './ClsImageUploader'

const CLASS_OPTIONS = [
    { value: 'BINH_THUONG', label: 'Bình thường' },
    { value: 'BAT_THUONG', label: 'Bất thường' },
    { value: 'NGUY_KICH', label: 'Nguy kịch' },
]

// Dịch vụ thêm sau seed (mã khác DV_SA_BUNG / DV_XQ_NGUC...) vẫn có mẫu mô tả theo tên dịch vụ
const presetsFor = (order) => {
    if (IMAGING_PRESETS[order.ma_dich_vu]) return IMAGING_PRESETS[order.ma_dich_vu]
    const name = (order.ten_dich_vu || '').toLowerCase()
    if (name.includes('siêu âm') && name.includes('bụng')) return IMAGING_PRESETS.DV_SA_BUNG
    if (name.includes('siêu âm') && name.includes('tim')) return IMAGING_PRESETS.DV_SA_TIM
    if (/x[\s-]?quang/.test(name) && /(ngực|phổi)/.test(name)) return IMAGING_PRESETS.DV_XQ_NGUC
    return {}
}

// Form kết quả Chẩn đoán hình ảnh: Mô tả / Kết luận / Đề nghị + nhiều ảnh JPG/PNG lưu trên máy chủ
export default function ImagingResultForm({ order, submitting, onSubmit }) {
    const presets = presetsFor(order)
    const detail = order.ket_qua_chi_tiet || {}
    const [images, setImages] = useState([])
    const [approved, setApproved] = useState(false)

    const formik = useFormik({
        initialValues: {
            mo_ta: detail.mo_ta || '',
            ket_luan: detail.ket_luan || '',
            de_nghi: detail.de_nghi || '',
            phan_loai: order.ket_qua_phan_loai || 'BINH_THUONG',
        },
        validationSchema: Yup.object({
            mo_ta: Yup.string().trim().required('Nhập mô tả'),
            ket_luan: Yup.string().trim().required('Nhập kết luận'),
        }),
        onSubmit: () => {},
    })

    const { values, errors, touched, handleChange, setValues } = formik
    const formikRef = useRef(formik)
    useEffect(() => {
        formikRef.current = formik
    })

    // Phiếu kết quả (kể cả bản nháp) và ảnh đã tải lên được đọc lại từ máy chủ, nên tải lại trang vẫn còn
    useEffect(() => {
        let cancelled = false
        clinicalService
            .getImagingResult(order.id)
            .then((res) => {
                const data = res?.data?.data
                if (cancelled || !data) return
                setImages(data.tep_dinh_kem_urls || [])
                setApproved(Boolean(data.da_duyet))
                const f = formikRef.current
                if (data.phieu_id && !f.dirty) {
                    f.setValues({
                        mo_ta: data.mo_ta_hinh_anh || '',
                        ket_luan: data.ket_luan || '',
                        de_nghi: data.de_nghi || '',
                        phan_loai: data.ket_qua_phan_loai || f.values.phan_loai,
                    })
                }
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [order.id])

    const pickPreset = (name) => setValues({ ...values, mo_ta: presets[name].mo_ta, ket_luan: presets[name].ket_luan })
    // Đã duyệt & trả (da_co_ket_qua) thì khóa toàn bộ form; đã hoàn tất (chờ duyệt) thì vẫn sửa được
    const locked = approved || order.trang_thai === 'da_co_ket_qua'
    const completed = order.trang_thai_ket_qua === 'DA_CO_KET_QUA'

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
                tep_dinh_kem_url: images[0] || null,
                tep_dinh_kem_urls: images,
                ket_qua_chi_tiet: { loai: 'CDHA', mo_ta: values.mo_ta, ket_luan: values.ket_luan, de_nghi: values.de_nghi },
            },
            final
        )
    }

    return (
        <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
            <PerformerFields serviceName={order.ten_dich_vu} />
            <PresetChips label="Chèn mẫu kết quả:" presets={presets} onPick={pickPreset} disabled={locked} />

            <div className="flex flex-wrap gap-5">
                <fieldset disabled={locked} className="flex min-w-0 flex-[999_1_360px] flex-col gap-4">
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
                </fieldset>
                <div className="flex-[1_1_280px]">
                    <ClsImageUploader
                        orderId={order.id}
                        urls={images}
                        onChange={setImages}
                        disabled={order.trang_thai === 'da_chi_dinh' || locked}
                        disabledHint={approved ? 'Kết quả đã duyệt, không thay đổi ảnh' : 'Bấm “Tiếp nhận & bắt đầu” để tải ảnh lên'}
                    />
                </div>
            </div>

            {!locked && (
                <ResultFormFooter
                    submitting={submitting}
                    needsApproval
                    alreadyReturned={completed}
                    onDraft={() => submit(false)}
                    onSubmit={() => submit(true)}
                />
            )}
        </form>
    )
}
