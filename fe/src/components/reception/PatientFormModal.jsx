import { useState, useEffect } from 'react'
import { Modal, Input, Select, DatePicker, Checkbox, Button, message, Alert } from 'antd'
import { useDispatch, useSelector } from 'react-redux'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import dayjs from 'dayjs'
import {
    createPatientAsync,
    updatePatientAsync,
    searchPatientsAsync,
} from '../../redux/actions/reception/receptionAction'
import { toFriendlyErrorMessage } from '../../utils/helpers/clientErrorHelper'

const BLOOD_TYPE_OPTIONS = [
    { value: 'O+', label: 'Nhóm máu O+' },
    { value: 'O-', label: 'Nhóm máu O-' },
    { value: 'A+', label: 'Nhóm máu A+' },
    { value: 'A-', label: 'Nhóm máu A-' },
    { value: 'B+', label: 'Nhóm máu B+' },
    { value: 'B-', label: 'Nhóm máu B-' },
    { value: 'AB+', label: 'Nhóm máu AB+' },
    { value: 'AB-', label: 'Nhóm máu AB-' },
]

export default function PatientFormModal({ open, onClose, editPatient, initialPhone = '', onCreatedSuccess }) {
    const dispatch = useDispatch()
    const { patients } = useSelector((state) => state.reception)
    const [duplicateWarning, setDuplicateWarning] = useState(null)

    const isEdit = Boolean(editPatient)

    const formik = useFormik({
        initialValues: {
            fullName: editPatient?.fullName || editPatient?.ho_ten || '',
            dob: editPatient?.dob || editPatient?.ngay_sinh || '1995-01-01',
            gender: editPatient?.gender || (editPatient?.gioi_tinh === 'Nữ' ? 'FEMALE' : (editPatient?.gioi_tinh === 'Khác' ? 'OTHER' : 'MALE')),
            phone: editPatient?.phone || editPatient?.so_dien_thoai || initialPhone || '',
            identityCard: editPatient?.identityCard || editPatient?.cccd_so || '',
            bloodType: editPatient?.bloodType || editPatient?.nhom_mau || 'O+',
            address: editPatient?.address || editPatient?.dia_chi || '',
            allergies: editPatient?.allergies || editPatient?.di_ung_thuoc || '',
            medicalHistory: editPatient?.medicalHistory || editPatient?.tien_su_benh || '',
            guardianName: editPatient?.guardianName || '',
            guardianPhone: editPatient?.guardianPhone || '',
            missingDocs: editPatient?.missingDocs || [],
            note: editPatient?.note || '',
        },
        enableReinitialize: true,
        validationSchema: Yup.object({
            fullName: Yup.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(150, 'Họ tên tối đa 150 ký tự').required('Vui lòng nhập họ và tên'),
            dob: Yup.string().required('Vui lòng chọn ngày sinh'),
            gender: Yup.string().required('Vui lòng chọn giới tính'),
            phone: Yup.string().matches(/^[0-9]{10}$/, 'Số điện thoại phải gồm đúng 10 chữ số').required('Vui lòng nhập số điện thoại'),
            identityCard: Yup.string().matches(/^([0-9]{9}|[0-9]{12})?$/, 'CCCD phải là 9 hoặc 12 số'),
            bloodType: Yup.string().required('Vui lòng chọn nhóm máu'),
        }),
        onSubmit: async (values, { resetForm }) => {
            try {
                if (isEdit) {
                    await dispatch(updatePatientAsync({ id: editPatient.id, updates: values })).unwrap()
                    message.success('Cập nhật hồ sơ bệnh nhân thành công!')
                } else {
                    const result = await dispatch(createPatientAsync({ payload: values })).unwrap()
                    message.success('Tạo hồ sơ bệnh nhân mới thành công!')
                    if (onCreatedSuccess) onCreatedSuccess(result)
                }
                dispatch(searchPatientsAsync({ search: '', page: 1, pageSize: 15 }))
                resetForm()
                setDuplicateWarning(null)
                onClose()
            } catch (err) {
                message.error(toFriendlyErrorMessage(err, 'Lỗi khi lưu hồ sơ bệnh nhân'))
            }
        },
    })

    useEffect(() => {
        if (isEdit) return
        const { identityCard, phone, fullName } = formik.values
        if (!identityCard && !phone) {
            setDuplicateWarning(null)
            return
        }

        const suspect = patients.find(
            (p) => (identityCard && p.identityCard && p.identityCard === identityCard) ||
                   (phone && p.phone === phone && fullName && p.fullName && p.fullName.toLowerCase() === fullName.toLowerCase().trim())
        )

        if (suspect) {
            setDuplicateWarning(
                `Nghi vấn trùng hồ sơ: Tìm thấy bệnh nhân ${suspect.fullName} (${suspect.patientCode || `BN-${suspect.id}`}) có cùng CCCD/SĐT.`
            )
        } else {
            setDuplicateWarning(null)
        }
    }, [formik.values.identityCard, formik.values.phone, formik.values.fullName, patients, isEdit])

    const patientCode = editPatient?.patientCode || editPatient?.ma_dinh_danh_y_te || `BN-${editPatient?.id}`

    return (
        <Modal
            title={
                <span className="font-bold text-clinic-navy">
                    {isEdit ? `Chỉnh sửa hồ sơ: ${patientCode}` : 'Tạo mới hồ sơ người bệnh tại quầy'}
                </span>
            }
            open={open}
            centered
            onCancel={() => {
                formik.resetForm()
                setDuplicateWarning(null)
                onClose()
            }}
            width={840}
            styles={{ body: { maxHeight: '72vh', overflowY: 'auto', paddingRight: 6 } }}
            footer={
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>Hủy bỏ</Button>
                    <Button type="primary" onClick={formik.handleSubmit} className="medpro-btn-primary" loading={formik.isSubmitting}>
                        {isEdit ? 'Lưu thay đổi' : 'Tạo hồ sơ'}
                    </Button>
                </div>
            }
        >
            <form onSubmit={formik.handleSubmit} className="space-y-3 py-1">
                {duplicateWarning && (
                    <Alert
                        message="Cảnh báo nghi vấn trùng hồ sơ"
                        description={duplicateWarning}
                        type="warning"
                        showIcon
                    />
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                        <label htmlFor="pf-full-name" className="medpro-label">
                            Họ và tên người bệnh <span className="text-clinic-danger">*</span>
                        </label>
                        <Input
                            id="pf-full-name"
                            placeholder="Nhập đầy đủ họ và tên..."
                            value={formik.values.fullName}
                            onChange={(e) => formik.setFieldValue('fullName', e.target.value)}
                            status={formik.touched.fullName && formik.errors.fullName ? 'error' : ''}
                        />
                        {formik.touched.fullName && formik.errors.fullName && (
                            <span className="text-clinic-danger text-xs mt-0.5 block">{formik.errors.fullName}</span>
                        )}
                    </div>

                    <div>
                        <label htmlFor="pf-gender" className="medpro-label">
                            Giới tính <span className="text-clinic-danger">*</span>
                        </label>
                        <Select
                            id="pf-gender"
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

                    <div>
                        <label htmlFor="pf-dob" className="medpro-label">
                            Ngày sinh <span className="text-clinic-danger">*</span>
                        </label>
                        <DatePicker
                            id="pf-dob"
                            className="w-full"
                            format="DD/MM/YYYY"
                            value={formik.values.dob ? dayjs(formik.values.dob) : null}
                            onChange={(date) => formik.setFieldValue('dob', date ? date.format('YYYY-MM-DD') : '')}
                        />
                        {formik.touched.dob && formik.errors.dob && (
                            <span className="text-clinic-danger text-xs mt-0.5 block">{formik.errors.dob}</span>
                        )}
                    </div>

                    <div>
                        <label htmlFor="pf-phone" className="medpro-label">
                            Số điện thoại <span className="text-clinic-danger">*</span>
                        </label>
                        <Input
                            id="pf-phone"
                            placeholder="0912345678 (10 số)"
                            value={formik.values.phone}
                            onChange={(e) => formik.setFieldValue('phone', e.target.value)}
                            status={formik.touched.phone && formik.errors.phone ? 'error' : ''}
                        />
                        {formik.touched.phone && formik.errors.phone && (
                            <span className="text-clinic-danger text-xs mt-0.5 block">{formik.errors.phone}</span>
                        )}
                    </div>

                    <div>
                        <label htmlFor="pf-blood-type" className="medpro-label">
                            Nhóm máu <span className="text-clinic-danger">*</span>
                        </label>
                        <Select
                            id="pf-blood-type"
                            className="w-full"
                            value={formik.values.bloodType}
                            onChange={(val) => formik.setFieldValue('bloodType', val)}
                            options={BLOOD_TYPE_OPTIONS}
                        />
                    </div>

                    <div>
                        <label htmlFor="pf-cccd" className="medpro-label">
                            Số CCCD / Định danh
                        </label>
                        <Input
                            id="pf-cccd"
                            placeholder="12 chữ số CCCD"
                            value={formik.values.identityCard}
                            onChange={(e) => formik.setFieldValue('identityCard', e.target.value)}
                            status={formik.touched.identityCard && formik.errors.identityCard ? 'error' : ''}
                        />
                        {formik.touched.identityCard && formik.errors.identityCard && (
                            <span className="text-clinic-danger text-xs mt-0.5 block">{formik.errors.identityCard}</span>
                        )}
                    </div>

                    <div className="md:col-span-2">
                        <label htmlFor="pf-address" className="medpro-label">
                            Địa chỉ thường trú
                        </label>
                        <Input
                            id="pf-address"
                            placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                            value={formik.values.address}
                            onChange={(e) => formik.setFieldValue('address', e.target.value)}
                        />
                    </div>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-clinic-border">
                    <div>
                        <label htmlFor="pf-allergies" className="medpro-label !text-clinic-danger">
                            Tiền sử dị ứng (Thuốc, thức ăn, hóa chất...)
                        </label>
                        <Input.TextArea
                            id="pf-allergies"
                            rows={2}
                            placeholder="VD: Dị ứng Penicillin, Aspirin, hải sản (hoặc ghi 'Không')..."
                            value={formik.values.allergies}
                            onChange={(e) => formik.setFieldValue('allergies', e.target.value)}
                            className="border-clinic-danger-border focus:border-clinic-danger-solid"
                        />
                    </div>

                    <div>
                        <label htmlFor="pf-history" className="medpro-label">
                            Tiền sử bệnh lý (Bệnh nền, phẫu thuật trước đây...)
                        </label>
                        <Input.TextArea
                            id="pf-history"
                            rows={2}
                            placeholder="VD: Viêm dạ dày Hp (+), Cao huyết áp, Đái tháo đường Type 2..."
                            value={formik.values.medicalHistory}
                            onChange={(e) => formik.setFieldValue('medicalHistory', e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-clinic-border items-start">
                    <div className="md:col-span-2">
                        <label htmlFor="pf-guardian-name" className="medpro-label">
                            Người đại diện / Người giám hộ (nếu là trẻ em hoặc người cao tuổi)
                        </label>
                        <Input
                            id="pf-guardian-name"
                            placeholder="Ví dụ: Nguyễn Văn B (Bố / Con)"
                            value={formik.values.guardianName}
                            onChange={(e) => formik.setFieldValue('guardianName', e.target.value)}
                        />
                    </div>

                    <div>
                        <label htmlFor="pf-guardian-phone" className="medpro-label">
                            SĐT người đại diện
                        </label>
                        <Input
                            id="pf-guardian-phone"
                            placeholder="SĐT liên hệ khẩn cấp"
                            value={formik.values.guardianPhone}
                            onChange={(e) => formik.setFieldValue('guardianPhone', e.target.value)}
                        />
                    </div>

                    <div>
                        <span className="medpro-label">
                            Giấy tờ hành chính còn thiếu
                        </span>
                        <div className="h-8 flex items-center">
                            <Checkbox.Group
                                value={formik.values.missingDocs}
                                onChange={(checkedValues) => formik.setFieldValue('missingDocs', checkedValues)}
                                className="flex flex-wrap gap-3 text-xs"
                            >
                                <Checkbox value="CCCD_CHUA_CONG_CHUNG">Chưa có CCCD gắn chip gốc</Checkbox>
                            </Checkbox.Group>
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label htmlFor="pf-note" className="medpro-label">
                            Ghi chú hành chính / Tiếp đón
                        </label>
                        <Input
                            id="pf-note"
                            placeholder="Cần hỗ trợ xe lăn, phiên dịch viên, ưu tiên người già..."
                            value={formik.values.note}
                            onChange={(e) => formik.setFieldValue('note', e.target.value)}
                        />
                    </div>
                </div>
            </form>
        </Modal>
    )
}
