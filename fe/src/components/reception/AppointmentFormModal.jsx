import { useState } from 'react'
import { Modal, Select, DatePicker, Input, Button, message, Alert } from 'antd'
import { useSelector, useDispatch } from 'react-redux'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import dayjs from 'dayjs'
import { createAppointmentAsync } from '../../redux/actions/reception/receptionAction'
import { initialTimeSlots } from '../../utils/constants/receptionConstants'

export default function AppointmentFormModal({ open, onClose, defaultPatientId }) {
    const dispatch = useDispatch()
    const { patients, departments, doctors, rooms, services, appointments } = useSelector((state) => state.reception)
    const [conflictAlert, setConflictAlert] = useState(null)

    const formik = useFormik({
        initialValues: {
            patientId: defaultPatientId || '',
            departmentId: '',
            doctorId: '',
            roomId: '',
            serviceId: '',
            appointmentDate: dayjs().format('YYYY-MM-DD'),
            timeSlot: '',
            notes: '',
        },
        enableReinitialize: true,
        validationSchema: Yup.object({
            patientId: Yup.string().required('Vui lòng chọn người bệnh'),
            departmentId: Yup.string().required('Vui lòng chọn chuyên khoa'),
            doctorId: Yup.string().required('Vui lòng chọn bác sĩ'),
            roomId: Yup.string().required('Vui lòng chọn phòng khám'),
            serviceId: Yup.string().required('Vui lòng chọn dịch vụ'),
            appointmentDate: Yup.string().required('Vui lòng chọn ngày khám'),
            timeSlot: Yup.string().required('Vui lòng chọn khung giờ khám'),
        }),
        onSubmit: async (values, { resetForm }) => {
            try {
                await dispatch(createAppointmentAsync({ payload: values }))
                message.success('Tạo lịch hẹn khám mới thành công!')
                resetForm()
                setConflictAlert(null)
                onClose()
            } catch (err) {
                message.error(err.message || 'Lỗi khi tạo lịch hẹn')
            }
        },
    })

    const handleDepartmentChange = (depId) => {
        formik.setFieldValue('departmentId', depId)
        formik.setFieldValue('doctorId', '')
        formik.setFieldValue('roomId', '')
        formik.setFieldValue('serviceId', '')

        // Auto select first room of department
        const depRoom = rooms.find((r) => r.departmentId === depId)
        if (depRoom) formik.setFieldValue('roomId', depRoom.id)

        // Auto select first service of department
        const depService = services.find((s) => s.departmentId === depId)
        if (depService) formik.setFieldValue('serviceId', depService.id)
    }

    const checkDoctorConflict = (docId, date, slot) => {
        if (!docId || !date || !slot) return null
        const conflict = appointments.find(
            (a) => a.doctorId === docId &&
                   a.appointmentDate === date &&
                   a.timeSlot === slot &&
                   a.status !== 'CANCELLED'
        )
        return conflict ? `Bác sĩ đã có lịch hẹn (${conflict.appointmentCode}) trong khung giờ này.` : null
    }

    const handleSlotChange = (slot) => {
        formik.setFieldValue('timeSlot', slot)
        const warn = checkDoctorConflict(formik.values.doctorId, formik.values.appointmentDate, slot)
        setConflictAlert(warn)
    }

    const handleDoctorChange = (docId) => {
        formik.setFieldValue('doctorId', docId)
        const doc = doctors.find((d) => d.id === docId)
        if (doc && doc.roomDefault) {
            formik.setFieldValue('roomId', doc.roomDefault)
        }
        const warn = checkDoctorConflict(docId, formik.values.appointmentDate, formik.values.timeSlot)
        setConflictAlert(warn)
    }

    const filteredDoctors = doctors.filter((d) => !formik.values.departmentId || d.departmentId === formik.values.departmentId)
    const filteredRooms = rooms.filter((r) => !formik.values.departmentId || r.departmentId === formik.values.departmentId)
    const filteredServices = services.filter((s) => !formik.values.departmentId || s.departmentId === formik.values.departmentId)

    return (
        <Modal
            title={<span className="font-bold text-slate-800">Đặt lịch hẹn khám mới</span>}
            open={open}
            onCancel={() => {
                formik.resetForm()
                setConflictAlert(null)
                onClose()
            }}
            width={680}
            footer={
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>Hủy bỏ</Button>
                    <Button type="primary" onClick={formik.handleSubmit} className="bg-sky-600" loading={formik.isSubmitting}>
                        Xác nhận đặt lịch
                    </Button>
                </div>
            }
        >
            <form onSubmit={formik.handleSubmit} className="space-y-4 py-2">
                {conflictAlert && (
                    <Alert
                        message="Cảnh báo trùng lịch khám"
                        description={conflictAlert}
                        type="warning"
                        showIcon
                        className="mb-2"
                    />
                )}

                {/* Patient selection */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Bệnh nhân <span className="text-red-500">*</span>
                    </label>
                    <Select
                        showSearch
                        className="w-full"
                        placeholder="Tìm theo tên, SĐT hoặc mã bệnh nhân..."
                        value={formik.values.patientId || undefined}
                        onChange={(val) => formik.setFieldValue('patientId', val)}
                        filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        options={patients.map((p) => ({
                            value: p.id,
                            label: `${p.patientCode} - ${p.fullName} (${p.phone}) - ${p.identityCard || 'Chưa CCCD'}`,
                        }))}
                        status={formik.touched.patientId && formik.errors.patientId ? 'error' : ''}
                    />
                    {formik.touched.patientId && formik.errors.patientId && (
                        <span className="text-red-500 text-xs mt-0.5 block">{formik.errors.patientId}</span>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Department */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Chuyên khoa <span className="text-red-500">*</span>
                        </label>
                        <Select
                            className="w-full"
                            placeholder="Chọn chuyên khoa"
                            value={formik.values.departmentId || undefined}
                            onChange={handleDepartmentChange}
                            options={departments.map((d) => ({ value: d.id, label: d.name }))}
                            status={formik.touched.departmentId && formik.errors.departmentId ? 'error' : ''}
                        />
                        {formik.touched.departmentId && formik.errors.departmentId && (
                            <span className="text-red-500 text-xs mt-0.5 block">{formik.errors.departmentId}</span>
                        )}
                    </div>

                    {/* Doctor */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Bác sĩ khám <span className="text-red-500">*</span>
                        </label>
                        <Select
                            className="w-full"
                            placeholder="Chọn bác sĩ phụ trách"
                            value={formik.values.doctorId || undefined}
                            onChange={handleDoctorChange}
                            disabled={!formik.values.departmentId}
                            options={filteredDoctors.map((d) => ({
                                value: d.id,
                                label: `${d.name} ${d.status === 'ON_LEAVE' ? '⚠️ (Nghỉ phép)' : ''}`,
                            }))}
                            status={formik.touched.doctorId && formik.errors.doctorId ? 'error' : ''}
                        />
                        {formik.touched.doctorId && formik.errors.doctorId && (
                            <span className="text-red-500 text-xs mt-0.5 block">{formik.errors.doctorId}</span>
                        )}
                    </div>

                    {/* Room */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Phòng khám <span className="text-red-500">*</span>
                        </label>
                        <Select
                            className="w-full"
                            placeholder="Chọn phòng khám"
                            value={formik.values.roomId || undefined}
                            onChange={(val) => formik.setFieldValue('roomId', val)}
                            disabled={!formik.values.departmentId}
                            options={filteredRooms.map((r) => ({
                                value: r.id,
                                label: `${r.name} (${r.currentWaiting} người đang chờ)`,
                            }))}
                            status={formik.touched.roomId && formik.errors.roomId ? 'error' : ''}
                        />
                        {formik.touched.roomId && formik.errors.roomId && (
                            <span className="text-red-500 text-xs mt-0.5 block">{formik.errors.roomId}</span>
                        )}
                    </div>

                    {/* Service */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Dịch vụ khám <span className="text-red-500">*</span>
                        </label>
                        <Select
                            className="w-full"
                            placeholder="Chọn dịch vụ khám"
                            value={formik.values.serviceId || undefined}
                            onChange={(val) => formik.setFieldValue('serviceId', val)}
                            disabled={!formik.values.departmentId}
                            options={filteredServices.map((s) => ({
                                value: s.id,
                                label: `${s.name} (${s.price.toLocaleString('vi-VN')} đ)`,
                            }))}
                            status={formik.touched.serviceId && formik.errors.serviceId ? 'error' : ''}
                        />
                        {formik.touched.serviceId && formik.errors.serviceId && (
                            <span className="text-red-500 text-xs mt-0.5 block">{formik.errors.serviceId}</span>
                        )}
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Ngày khám <span className="text-red-500">*</span>
                        </label>
                        <DatePicker
                            className="w-full"
                            format="DD/MM/YYYY"
                            value={formik.values.appointmentDate ? dayjs(formik.values.appointmentDate) : null}
                            onChange={(date) => {
                                const dateStr = date ? date.format('YYYY-MM-DD') : ''
                                formik.setFieldValue('appointmentDate', dateStr)
                                const warn = checkDoctorConflict(formik.values.doctorId, dateStr, formik.values.timeSlot)
                                setConflictAlert(warn)
                            }}
                        />
                    </div>

                    {/* Time slot */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Khung giờ <span className="text-red-500">*</span>
                        </label>
                        <Select
                            className="w-full"
                            placeholder="Chọn slot giờ"
                            value={formik.values.timeSlot || undefined}
                            onChange={handleSlotChange}
                            options={initialTimeSlots.map((s) => ({ value: s, label: s }))}
                            status={formik.touched.timeSlot && formik.errors.timeSlot ? 'error' : ''}
                        />
                        {formik.touched.timeSlot && formik.errors.timeSlot && (
                            <span className="text-red-500 text-xs mt-0.5 block">{formik.errors.timeSlot}</span>
                        )}
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Ghi chú yêu cầu / triệu chứng ban đầu
                    </label>
                    <Input.TextArea
                        rows={2}
                        placeholder="Ví dụ: Đau đầu 3 ngày, muốn khám thêm nội soi..."
                        value={formik.values.notes}
                        onChange={(e) => formik.setFieldValue('notes', e.target.value)}
                    />
                </div>
            </form>
        </Modal>
    )
}
