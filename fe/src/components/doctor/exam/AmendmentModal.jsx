import { Modal } from 'antd'
import { useFormik } from 'formik'
import * as Yup from 'yup'

const TARGETS = [
    { value: 'CHAN_DOAN', label: 'Chẩn đoán' },
    { value: 'DON_THUOC', label: 'Đơn thuốc' },
    { value: 'CHI_DINH', label: 'Chỉ định cận lâm sàng' },
    { value: 'KET_LUAN', label: 'Kết luận điều trị' },
]

const schema = Yup.object({
    thuc_the_loai: Yup.string().required('Chọn phần cần đính chính'),
    ly_do_text: Yup.string().trim().min(5, 'Lý do tối thiểu 5 ký tự').required('Nhập lý do đính chính'),
    noi_dung_moi: Yup.string().trim().required('Nhập nội dung đề xuất sửa'),
})

export default function AmendmentModal({ open, onClose, onSubmit }) {
    const formik = useFormik({
        initialValues: { thuc_the_loai: 'CHAN_DOAN', ly_do_text: '', noi_dung_moi: '' },
        validationSchema: schema,
        onSubmit: async (values, { setSubmitting, resetForm }) => {
            const ok = await onSubmit({
                thuc_the_loai: values.thuc_the_loai,
                ly_do_text: values.ly_do_text.trim(),
                noi_dung_moi_json: { noi_dung: values.noi_dung_moi.trim() },
            })
            setSubmitting(false)
            if (ok) {
                resetForm()
                onClose()
            }
        },
    })

    const { values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting } = formik

    return (
        <Modal
            open={open}
            title="Tạo biên bản đính chính"
            onCancel={onClose}
            footer={[
                <button key="cancel" type="button" className="medpro-btn-outline mr-2" onClick={onClose}>
                    Hủy
                </button>,
                <button key="submit" type="button" className="medpro-btn-primary" disabled={isSubmitting} onClick={handleSubmit}>
                    {isSubmitting ? 'Đang gửi…' : 'Gửi Trưởng khoa duyệt'}
                </button>,
            ]}
        >
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
                <p className="text-[13px] text-slate-600">
                    Bệnh án đã khóa theo Thông tư 32/2023/TT-BYT. Biên bản cần một bác sĩ khác (Trưởng khoa) phê duyệt mới có hiệu lực.
                </p>
                <label>
                    <span className="medpro-label">Phần cần đính chính</span>
                    <select name="thuc_the_loai" className="medpro-input" value={values.thuc_the_loai} onChange={handleChange}>
                        {TARGETS.map((t) => (
                            <option key={t.value} value={t.value}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    <span className="medpro-label">Lý do</span>
                    <textarea name="ly_do_text" rows={2} className="medpro-input" value={values.ly_do_text} onChange={handleChange} onBlur={handleBlur} />
                    {touched.ly_do_text && errors.ly_do_text && <p className="mt-1 text-[12px] text-rose-600">{errors.ly_do_text}</p>}
                </label>
                <label>
                    <span className="medpro-label">Nội dung đề xuất sửa</span>
                    <textarea name="noi_dung_moi" rows={3} className="medpro-input" value={values.noi_dung_moi} onChange={handleChange} onBlur={handleBlur} />
                    {touched.noi_dung_moi && errors.noi_dung_moi && <p className="mt-1 text-[12px] text-rose-600">{errors.noi_dung_moi}</p>}
                </label>
            </form>
        </Modal>
    )
}
