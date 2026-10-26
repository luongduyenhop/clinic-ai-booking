import { useState, useEffect } from 'react'
import { Modal, Input, Select, DatePicker, Checkbox, Button, message, Alert } from 'antd'
import { useDispatch, useSelector } from 'react-redux'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import dayjs from 'dayjs'
import { createPatientAsync, updatePatientAsync } from '../../redux/slices/reception/receptionSlice'

export default function PatientFormModal({ open, onClose, editPatient, onCreatedSuccess }) {
    const dispatch = useDispatch()
    const { patients } = useSelector((state) => state.reception)
    const [duplicateWarning, setDuplicateWarning] = useState(null)

    const isEdit = Boolean(editPatient)

    const formik = useFormik({
        initialValues: {
            fullName: editPatient?.fullName || '',
            dob: editPatient?.dob || '1995-01-01',
            gender: editPatient?.gender || 'MALE',
            phone: editPatient?.phone || '',
            identityCard: editPatient?.identityCard || '',
            healthInsurance: editPatient?.healthInsurance || '',
            address: editPatient?.address || '',
            guardianName: editPatient?.guardianName || '',
            guardianPhone: editPatient?.guardianPhone || '',
            missingDocs: editPatient?.missingDocs || [],
            note: editPatient?.note || '',
        },
        enableReinitialize: true,
        validationSchema: Yup.object({
            fullName: Yup.string().trim().required('Vui lòng nhập họ và tên'),
            dob: Yup.string().required('Vui lòng chọn ngày sinh'),
            gender: Yup.string().required('Vui lòng chọn giới tính'),
            phone: Yup.string().matches(/^[0-9]{9,11}$/, 'Số điện thoại không hợp lệ (9-11 số)').required('Vui lòng nhập số điện thoại'),
            identityCard: Yup.string().matches(/^([0-9]{9}|[0-9]{12})?$/, 'CCCD phải là 9 hoặc 12 số'),
        }),
        onSubmit: async (values, { resetForm }) => {
            try {
                if (isEdit) {
                    await dispatch(updatePatientAsync({ id: editPatient.id, updates: values }))
                    message.success('Cập nhật hồ sơ bệnh nhân thành công!')
                } else {
                    const result = await dispatch(createPatientAsync({ payload: values })).unwrap()
                    message.success('Tạo hồ sơ bệnh nhân mới thành công!')
                    if (onCreatedSuccess) onCreatedSuccess(result)
                }
                resetForm()
                setDuplicateWarning(null)
                onClose()
            } catch (err) {
                message.error(err.message || 'Lỗi khi lưu hồ sơ bệnh nhân')
            }
        },
    })

    // Check duplicate suspect in real-time when typing CCCD or Phone
    useEffect(() => {
        if (isEdit) return
        const { identityCard, phone, fullName } = formik.values
        if (!identityCard && !phone) {
            setDuplicateWarning(null)
            return
        }

        const suspect = patients.find(
            (p) => (identityCard && p.identityCard && p.identityCard === identityCard) ||
                   (phone && p.phone === phone && fullName && p.fullName.toLowerCase() === fullName.toLowerCase().trim())
        )

        if (suspect) {
            setDuplicateWarning(
                `Nghi vấn trùng hồ sơ: Tìm thấy bệnh nhân ${suspect.fullName} (${suspect.patientCode}) có cùng CCCD/SĐT.`
            )
        } else {
            setDuplicateWarning(null)
        }
    }, [formik.values.identityCard, formik.values.phone, formik.values.fullName, patients, isEdit])

    return (
        <Modal
            title={
                <span className="font-bold text-slate-800">
                    {isEdit ? `Chỉnh sửa hồ sơ: ${editPatient.patientCode}` : 'Tạo mới hồ sơ người bệnh'}
                </span>
            }
            open={open}
            onCancel={() => {
                formik.resetForm()
                setDuplicateWarning(null)
                onClose()
            }}
            width={720}
            footer={
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>Hủy bỏ</Button>
                    <Button type="primary" onClick={formik.handleSubmit} className="bg-sky-600" loading={formik.isSubmitting}>
                        {isEdit ? 'Lưu thay đổi' : 'Tạo hồ sơ'}
                    </Button>
                </div>
            }
        >
            <form onSubmit={formik.handleSubmit} className="space-y-4 py-2">
                {duplicateWarning && (
                    <Alert
                        message="Cảnh báo nghi vấn trùng hồ sơ (RC-10)"
                        description={duplicateWarning}
                        type="warning"
                        showIcon
                    />
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Full Name */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Họ và tên người bệnh <span className="text-red-500">*</span>
                        </label>
                        <Input
                            placeholder="Nhập đầy đủ họ và tên..."
                            value={formik.values.fullName}
                            onChange={(e) => formik.setFieldValue('fullName', e.target.value)}
                            status={formik.touched.fullName && formik.errors.fullName ? 'error' : ''}
                        />
                        {formik.touched.fullName && formik.errors.fullName && (
                            <span className="text-red-500 text-xs mt-0.5 block">{formik.errors.fullName}</span>
                        )}
                    </div>

                    {/* Gender */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Giới tính <span className="text-red-500">*</span>
                        </label>
                        <Select
                            className="w-full"
                            value={formik.values.gender}
                            onChange={(val) => formik.setFieldValue('gender', val)}
                            options={[
                                { value: 'MALE', label: 'Nam' },
                                { value: 'FEMALE', label: 'Nữ' },
                                { value: 'OTHER', label: 'Khác' },
                            ]}
                        />
                    </div>

                    {/* DOB */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Ngày sinh <span className="text-red-500">*</span>
                        </label>
                        <DatePicker
                            className="w-full"
                            format="DD/MM/YYYY"
                            value={formik.values.dob ? dayjs(formik.values.dob) : null}
                            onChange={(date) => formik.setFieldValue('dob', date ? date.format('YYYY-MM-DD') : '')}
                        />
                        {formik.touched.dob && formik.errors.dob && (
                            <span className="text-red-500 text-xs mt-0.5 block">{formik.errors.dob}</span>
                        )}
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Số điện thoại <span className="text-red-500">*</span>
                        </label>
                        <Input
                            placeholder="0912345678"
                            value={formik.values.phone}
                            onChange={(e) => formik.setFieldValue('phone', e.target.value)}
                            status={formik.touched.phone && formik.errors.phone ? 'error' : ''}
                        />
                        {formik.touched.phone && formik.errors.phone && (
                            <span className="text-red-500 text-xs mt-0.5 block">{formik.errors.phone}</span>
                        )}
                    </div>

                    {/* Identity Card */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Số CCCD / Định danh
                        </label>
                        <Input
                            placeholder="12 chữ số CCCD"
                            value={formik.values.identityCard}
                            onChange={(e) => formik.setFieldValue('identityCard', e.target.value)}
                            status={formik.touched.identityCard && formik.errors.identityCard ? 'error' : ''}
                        />
                        {formik.touched.identityCard && formik.errors.identityCard && (
                            <span className="text-red-500 text-xs mt-0.5 block">{formik.errors.identityCard}</span>
                        )}
                    </div>

                    {/* Occupation */}
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Nghề nghiệp
                        </label>
                        <Input
                            placeholder="Ví dụ: Kỹ sư, Giáo viên, Tự do..."
                            value={formik.values.occupation || ''}
                            onChange={(e) => formik.setFieldValue('occupation', e.target.value)}
                        />
                    </div>

                    {/* Address */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Địa chỉ thường trú
                        </label>
                        <Input
                            placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                            value={formik.values.address}
                            onChange={(e) => formik.setFieldValue('address', e.target.value)}
                        />
                    </div>

                    {/* Guardian Name */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Người đại diện / Người giám hộ (nếu là trẻ em hoặc người cao tuổi)
                        </label>
                        <Input
                            placeholder="Ví dụ: Nguyễn Văn B (Bố / Con)"
                            value={formik.values.guardianName}
                            onChange={(e) => formik.setFieldValue('guardianName', e.target.value)}
                        />
                    </div>

                    {/* Guardian Phone */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            SĐT người đại diện
                        </label>
                        <Input
                            placeholder="SĐT liên hệ khẩn cấp"
                            value={formik.values.guardianPhone}
                            onChange={(e) => formik.setFieldValue('guardianPhone', e.target.value)}
                        />
                    </div>
                </div>

                {/* Missing documents checkboxes */}
                <div className="pt-2 border-t border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Kiểm tra giấy tờ hành chính còn thiếu (RC-12)
                    </label>
                    <Checkbox.Group
                        value={formik.values.missingDocs}
                        onChange={(checkedValues) => formik.setFieldValue('missingDocs', checkedValues)}
                        className="flex flex-wrap gap-4 text-xs"
                    >

                        <Checkbox value="CCCD_CHUA_CONG_CHUNG">Chưa có CCCD gắn chip gốc</Checkbox>
                    </Checkbox.Group>
                </div>

                {/* Note */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Ghi chú hành chính
                    </label>
                    <Input.TextArea
                        rows={2}
                        placeholder="Tiền sử dị ứng thuốc, cần hỗ trợ xe lăn..."
                        value={formik.values.note}
                        onChange={(e) => formik.setFieldValue('note', e.target.value)}
                    />
                </div>
            </form>
        </Modal>
    )
}
