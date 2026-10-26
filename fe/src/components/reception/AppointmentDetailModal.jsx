import { useState } from 'react'
import { Modal, Tag, Descriptions, Button, Input, Select, DatePicker, message, Alert } from 'antd'
import { useSelector, useDispatch } from 'react-redux'
import dayjs from 'dayjs'
import { updateAppointmentAsync, cancelAppointmentAsync } from '../../redux/slices/reception/receptionSlice'
import { APPOINTMENT_STATUS, APPOINTMENT_STATUS_LABELS } from '../../utils/constants/receptionConstants'
import { formatCurrency } from '../../utils/helpers/formatCurrency'

export default function AppointmentDetailModal({ appointment, open, onClose, onCheckInClick }) {
    const dispatch = useDispatch()
    const { patients, departments, doctors, rooms, services, activeRole } = useSelector((state) => state.reception)

    const [isCancelling, setIsCancelling] = useState(false)
    const [cancelReason, setCancelReason] = useState('')
    const [isRescheduling, setIsRescheduling] = useState(false)
    const [newDate, setNewDate] = useState(null)
    const [newTimeSlot, setNewTimeSlot] = useState('')
    const [newDoctorId, setNewDoctorId] = useState('')
    const [rescheduleReason, setRescheduleReason] = useState('')

    if (!appointment) return null

    const patient = patients.find((p) => p.id === appointment.patientId)
    const department = departments.find((d) => d.id === appointment.departmentId)
    const doctor = doctors.find((d) => d.id === appointment.doctorId)
    const room = rooms.find((r) => r.id === appointment.roomId)
    const service = services.find((s) => s.id === appointment.serviceId)

    const statusConfig = APPOINTMENT_STATUS_LABELS[appointment.status] || { label: appointment.status, color: 'default' }
    const canCheckIn = appointment.status === APPOINTMENT_STATUS.BOOKED || appointment.status === APPOINTMENT_STATUS.CONFIRMED
    const canCancel = appointment.status !== APPOINTMENT_STATUS.CANCELLED && appointment.status !== APPOINTMENT_STATUS.CHECKED_IN

    const handleConfirmCancel = async () => {
        if (!cancelReason.trim()) {
            message.error('Vui lòng nhập lý do hủy lịch hẹn')
            return
        }
        await dispatch(cancelAppointmentAsync({ id: appointment.id, reason: cancelReason.trim() }))
        message.success('Đã hủy lịch hẹn thành công')
        setIsCancelling(false)
        setCancelReason('')
        onClose()
    }

    const handleConfirmReschedule = async () => {
        if (!newDate || !newTimeSlot) {
            message.error('Vui lòng chọn ngày và khung giờ mới')
            return
        }
        const updates = {
            appointmentDate: newDate.format('YYYY-MM-DD'),
            timeSlot: newTimeSlot,
            doctorId: newDoctorId || appointment.doctorId,
            rescheduleReason: rescheduleReason.trim() || 'Thay đổi thời gian khám',
        }
        await dispatch(updateAppointmentAsync({ id: appointment.id, updates }))
        message.success('Đã đổi lịch hẹn thành công')
        setIsRescheduling(false)
        onClose()
    }

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">Chi tiết lịch hẹn: {appointment.appointmentCode}</span>
                    <Tag color={statusConfig.color} className="font-semibold">
                        {statusConfig.label}
                    </Tag>
                </div>
            }
            open={open}
            onCancel={() => {
                setIsCancelling(false)
                setIsRescheduling(false)
                onClose()
            }}
            width={720}
            footer={
                <div className="flex items-center justify-between">
                    <div>
                        {canCancel && !isCancelling && !isRescheduling && (
                            <Button danger onClick={() => setIsCancelling(true)}>
                                Hủy lịch hẹn
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {canCheckIn && !isCancelling && !isRescheduling && (
                            <>
                                <Button onClick={() => setIsRescheduling(true)}>Đổi lịch khám</Button>
                                <Button
                                    type="primary"
                                    className="bg-sky-600"
                                    onClick={() => {
                                        onClose()
                                        if (onCheckInClick) onCheckInClick(appointment)
                                    }}
                                >
                                    Tiếp nhận ngay (Check-in)
                                </Button>
                            </>
                        )}
                        <Button
                            onClick={() => {
                                setIsCancelling(false)
                                setIsRescheduling(false)
                                onClose()
                            }}
                        >
                            Đóng
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="space-y-4 py-2">
                {appointment.conflictWarning && (
                    <Alert message="Cảnh báo điều phối" description={appointment.conflictWarning} type="warning" showIcon />
                )}

                {/* Cancel flow form */}
                {isCancelling && (
                    <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-3">
                        <h4 className="font-bold text-red-800 text-sm">Xác nhận hủy lịch hẹn</h4>
                        <p className="text-xs text-red-600">Vui lòng ghi rõ lý do người bệnh yêu cầu hủy lịch để lưu vết Audit Log.</p>
                        <Input.TextArea
                            rows={3}
                            placeholder="Nhập lý do hủy lịch (bắt buộc)..."
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <Button size="small" onClick={() => setIsCancelling(false)}>
                                Quay lại
                            </Button>
                            <Button size="small" type="primary" danger onClick={handleConfirmCancel}>
                                Xác nhận hủy
                            </Button>
                        </div>
                    </div>
                )}

                {/* Reschedule flow form */}
                {isRescheduling && (
                    <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 space-y-3">
                        <h4 className="font-bold text-sky-900 text-sm">Đổi ngày / giờ / bác sĩ khám</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">Ngày khám mới:</label>
                                <DatePicker
                                    className="w-full"
                                    format="DD/MM/YYYY"
                                    onChange={(date) => setNewDate(date)}
                                />
                            </div>
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">Khung giờ mới:</label>
                                <Select
                                    className="w-full"
                                    placeholder="Chọn slot"
                                    value={newTimeSlot || undefined}
                                    onChange={(val) => setNewTimeSlot(val)}
                                    options={[
                                        { value: '07:30 - 08:00', label: '07:30 - 08:00' },
                                        { value: '08:00 - 08:30', label: '08:00 - 08:30' },
                                        { value: '08:30 - 09:00', label: '08:30 - 09:00' },
                                        { value: '09:00 - 09:30', label: '09:00 - 09:30' },
                                        { value: '09:30 - 10:00', label: '09:30 - 10:00' },
                                        { value: '10:00 - 10:30', label: '10:00 - 10:30' },
                                        { value: '13:30 - 14:00', label: '13:30 - 14:00' },
                                        { value: '14:00 - 14:30', label: '14:00 - 14:30' },
                                        { value: '14:30 - 15:00', label: '14:30 - 15:00' },
                                    ]}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block font-medium text-slate-700 mb-1">Bác sĩ phụ trách:</label>
                                <Select
                                    className="w-full"
                                    value={newDoctorId || appointment.doctorId}
                                    onChange={(val) => setNewDoctorId(val)}
                                    options={doctors
                                        .filter((d) => d.departmentId === appointment.departmentId)
                                        .map((d) => ({
                                            value: d.id,
                                            label: `${d.name} (${d.status === 'AVAILABLE' ? 'Sẵn sàng' : 'Nghỉ/Đi muộn'})`,
                                        }))}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block font-medium text-slate-700 mb-1">Lý do đổi lịch:</label>
                                <Input
                                    placeholder="Ví dụ: Bệnh nhân đổi giờ bận việc, Bác sĩ nghỉ ca..."
                                    value={rescheduleReason}
                                    onChange={(e) => setRescheduleReason(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button size="small" onClick={() => setIsRescheduling(false)}>
                                Hủy bỏ
                            </Button>
                            <Button size="small" type="primary" onClick={handleConfirmReschedule} className="bg-sky-600">
                                Lưu thay đổi
                            </Button>
                        </div>
                    </div>
                )}

                {/* Patient Information */}
                <Descriptions title="Thông tin người bệnh" bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Mã bệnh nhân">{patient?.patientCode || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Họ và tên">
                        <span className="font-bold text-slate-900">{patient?.fullName || 'N/A'}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Số điện thoại">{patient?.phone || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="CCCD/Định danh">{patient?.identityCard || 'Chưa có'}</Descriptions.Item>
                    <Descriptions.Item label="Ngày sinh">
                        {patient?.dob ? dayjs(patient.dob).format('DD/MM/YYYY') : 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Mã thẻ BHYT">
                        {patient?.healthInsurance ? (
                            <span className="font-mono text-teal-700 font-semibold">{patient.healthInsurance}</span>
                        ) : (
                            <span className="text-slate-400">Không có</span>
                        )}
                    </Descriptions.Item>
                </Descriptions>

                {/* Appointment Information */}
                <Descriptions title="Thông tin khám & Dịch vụ" bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Ngày khám">{appointment.appointmentDate}</Descriptions.Item>
                    <Descriptions.Item label="Khung giờ khám">
                        <span className="font-bold text-sky-700">{appointment.timeSlot}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Chuyên khoa">{department?.name || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Bác sĩ phụ trách">
                        <span className="font-medium">{doctor?.name || 'N/A'}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Phòng khám dự kiến">{room?.name || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Dịch vụ yêu cầu">
                        {service?.name || 'Khám bệnh'} ({formatCurrency(service?.price || 0)})
                    </Descriptions.Item>
                    <Descriptions.Item label="Kênh đăng ký">
                        <Tag>{appointment.type || 'ONLINE'}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Ghi chú người bệnh">
                        {appointment.notes || 'Không có ghi chú'}
                    </Descriptions.Item>
                    {appointment.cancelReason && (
                        <Descriptions.Item label="Lý do hủy" span={2}>
                            <span className="text-red-600 font-semibold">{appointment.cancelReason}</span>
                        </Descriptions.Item>
                    )}
                </Descriptions>

                {/* History Timeline */}
                {appointment.history && appointment.history.length > 0 && (
                    <div className="mt-3">
                        <h5 className="font-bold text-xs text-slate-500 uppercase mb-2">Nhật ký lịch hẹn</h5>
                        <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                            {appointment.history.map((h, i) => (
                                <div key={i} className="flex items-center justify-between text-slate-600">
                                    <div className="flex items-center gap-2">
                                        <Tag color="blue">{h.action}</Tag>
                                        <span>{h.note || 'Thao tác hệ thống'}</span>
                                    </div>
                                    <span className="text-slate-400 text-[11px]">{h.time} - {h.actor}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    )
}
