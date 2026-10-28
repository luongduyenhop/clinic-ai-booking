import { Drawer, Tag, Tabs, Descriptions, Button, Alert } from 'antd'
import { useSelector } from 'react-redux'
import {
    UserOutlined,
    CalendarOutlined,
    HistoryOutlined,
    EditOutlined,
    PlusOutlined,
    WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { APPOINTMENT_STATUS_LABELS, QUEUE_STATUS_LABELS, MISSING_DOC_LABELS } from '../../utils/constants/receptionConstants'

export default function PatientDetailDrawer({ patientId, open, onClose, onEditClick, onNewAppointmentClick }) {
    const { patients, appointments, queueEntries, departments, doctors, services } = useSelector((state) => state.reception)

    if (!patientId) return null
    const patient = patients.find((p) => p.id === patientId)
    if (!patient) return null

    const patientAppointments = appointments.filter((a) => a.patientId === patientId)
    const patientQueue = queueEntries.filter((q) => q.patientId === patientId)

    return (
        <Drawer
            title={
                <div className="flex items-center justify-between pr-4">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">Hồ sơ bệnh nhân: {patient.patientCode}</span>
                        {patient.isDuplicateSuspect && (
                            <Tag color="red" icon={<WarningOutlined />}>
                                Nghi vấn trùng
                            </Tag>
                        )}
                    </div>
                </div>
            }
            open={open}
            onClose={onClose}
            size={640}
            extra={
                <div className="flex gap-2">
                    <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => {
                            if (onEditClick) onEditClick(patient)
                        }}
                    >
                        Sửa hồ sơ
                    </Button>
                    <Button
                        size="small"
                        type="primary"
                        className="bg-sky-600"
                        icon={<PlusOutlined />}
                        onClick={() => {
                            if (onNewAppointmentClick) onNewAppointmentClick(patient.id)
                        }}
                    >
                        Đặt lịch mới
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                {/* Duplicate Warning */}
                {patient.isDuplicateSuspect && (
                    <Alert
                        message="Cảnh báo nghi vấn trùng hồ sơ"
                        description="Hồ sơ này có thông tin trùng khớp (CCCD hoặc Họ tên + SĐT) với một hồ sơ khác trong hệ thống. Vui lòng đối chiếu giấy tờ gốc trước khi tiếp tục."
                        type="error"
                        showIcon
                    />
                )}

                {/* Missing documents alert */}
                {patient.missingDocs && patient.missingDocs.length > 0 && (
                    <Alert
                        message="Giấy tờ hành chính cần bổ sung"
                        description={
                            <div className="flex gap-1.5 flex-wrap mt-1">
                                {patient.missingDocs.map((doc, idx) => (
                                    <Tag key={idx} color="warning" className="font-medium text-xs py-0.5">
                                        ⚠️ {MISSING_DOC_LABELS[doc] || doc}
                                    </Tag>
                                ))}
                            </div>
                        }
                        type="warning"
                        showIcon
                    />
                )}

                {/* Overview Header Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 to-teal-50 border border-sky-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 leading-tight">{patient.fullName}</h3>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span>Giới tính: <strong>{patient.gender === 'MALE' ? 'Nam' : 'Nữ'}</strong></span>
                            <span>•</span>
                            <span>Ngày sinh: <strong>{dayjs(patient.dob).format('DD/MM/YYYY')}</strong></span>
                            <span>•</span>
                            <span>SĐT: <strong>{patient.phone}</strong></span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[11px] text-slate-400 block font-medium">Số lượt đã khám</span>
                        <span className="text-2xl font-black text-sky-700">{patientQueue.length}</span>
                    </div>
                </div>

                <Tabs
                    defaultActiveKey="info"
                    items={[
                        {
                            key: 'info',
                            label: (
                                <span>
                                    <UserOutlined /> Thông tin hành chính
                                </span>
                            ),
                            children: (
                                <div className="space-y-4">
                                    <Descriptions bordered size="small" column={1}>
                                        <Descriptions.Item label="Mã định danh CCCD">
                                            {patient.identityCard ? (
                                                <span className="font-mono font-semibold">{patient.identityCard}</span>
                                            ) : (
                                                <span className="text-slate-400">Chưa có thông tin</span>
                                            )}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="Hình thức khám">
                                            <span className="font-semibold text-slate-700">Khám dịch vụ tư nhân</span>
                                        </Descriptions.Item>
                                        <Descriptions.Item label="Địa chỉ thường trú">
                                            {patient.address || 'Chưa cập nhật'}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="Người giám hộ / Liên hệ khẩn">
                                            {patient.guardianName ? (
                                                <span>
                                                    {patient.guardianName} - SĐT: {patient.guardianPhone}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">Không có</span>
                                            )}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="Ghi chú hành chính">
                                            {patient.note || 'Không có ghi chú'}
                                        </Descriptions.Item>
                                    </Descriptions>
                                </div>
                            ),
                        },
                        {
                            key: 'appointments',
                            label: (
                                <span>
                                    <CalendarOutlined /> Lịch hẹn ({patientAppointments.length})
                                </span>
                            ),
                            children: (
                                <div className="space-y-2.5">
                                    {patientAppointments.length === 0 ? (
                                        <div className="text-center py-6 text-slate-400 text-xs">Chưa có lịch hẹn nào</div>
                                    ) : (
                                        patientAppointments.map((app) => {
                                            const dep = departments.find((d) => d.id === app.departmentId)
                                            const doc = doctors.find((d) => d.id === app.doctorId)
                                            const status = APPOINTMENT_STATUS_LABELS[app.status] || { label: app.status, color: 'default' }
                                            return (
                                                <div key={app.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-slate-800">{app.appointmentCode}</span>
                                                        <Tag color={status.color}>{status.label}</Tag>
                                                    </div>
                                                    <div className="text-slate-600">
                                                        {app.appointmentDate} ({app.timeSlot}) - {dep?.name}
                                                    </div>
                                                    <div className="text-slate-400 text-[11px]">Bác sĩ: {doc?.name}</div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            ),
                        },
                        {
                            key: 'encounters',
                            label: (
                                <span>
                                    <HistoryOutlined /> Lượt khám ({patientQueue.length})
                                </span>
                            ),
                            children: (
                                <div className="space-y-2.5">
                                    {patientQueue.length === 0 ? (
                                        <div className="text-center py-6 text-slate-400 text-xs">Chưa có lượt khám nào</div>
                                    ) : (
                                        patientQueue.map((q) => {
                                            const srv = services.find((s) => s.id === q.serviceId)
                                            const st = QUEUE_STATUS_LABELS[q.status] || { label: q.status, color: 'default' }
                                            return (
                                                <div key={q.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-extrabold text-sky-600">Số vé: {q.ticketNumber}</span>
                                                        <Tag color={st.color}>{st.label}</Tag>
                                                    </div>
                                                    <div className="text-slate-600">
                                                        Dịch vụ: {srv?.name} - Check-in: {q.checkInTime}
                                                    </div>
                                                    {q.logs && q.logs.length > 0 && (
                                                        <div className="text-slate-400 text-[11px] pt-1 border-t border-slate-200/60">
                                                            {q.logs[q.logs.length - 1]}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            ),
                        },
                    ]}
                />
            </div>
        </Drawer>
    )
}
