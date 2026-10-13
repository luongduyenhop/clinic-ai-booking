import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { Input, Button, Tag, Select, Radio, Alert, message, Descriptions } from 'antd'
import {
    SearchOutlined,
    UserAddOutlined,
    CheckCircleOutlined,
    AlertOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { checkInAppointmentAsync, registerWalkInAsync } from '../../redux/slices/reception/receptionSlice'
import PatientFormModal from '../../components/reception/PatientFormModal'
import CheckInReceiptModal from '../../components/reception/CheckInReceiptModal'
import EmergencyHandoverModal from '../../components/reception/EmergencyHandoverModal'
import { APPOINTMENT_STATUS } from '../../utils/constants/receptionConstants'

export default function CheckInPage() {
    const location = useLocation()
    const dispatch = useDispatch()
    const { patients, appointments, departments, doctors, rooms, services } = useSelector((state) => state.reception)

    const [searchKeyword, setSearchKeyword] = useState('')
    const [selectedPatient, setSelectedPatient] = useState(null)
    const [selectedAppointment, setSelectedAppointment] = useState(null)
    const [checkInMode, setCheckInMode] = useState('WITH_APPOINTMENT') // 'WITH_APPOINTMENT' | 'WALK_IN'

    // Walk-in form state
    const [walkInDepartmentId, setWalkInDepartmentId] = useState('')
    const [walkInDoctorId, setWalkInDoctorId] = useState('')
    const [walkInRoomId, setWalkInRoomId] = useState('')
    const [walkInServiceId, setWalkInServiceId] = useState('')
    const [priorityType, setPriorityType] = useState('NORMAL')
    const [priorityReason, setPriorityReason] = useState('')
    const [checkInNotes, setCheckInNotes] = useState('')

    // Modals
    const [isCreatePatientOpen, setIsCreatePatientOpen] = useState(false)
    const [isReceiptOpen, setIsReceiptOpen] = useState(false)
    const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false)
    const [createdQueueEntry, setCreatedQueueEntry] = useState(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Handle preselect from navigation
    useEffect(() => {
        if (location.state?.preselectAppointmentId) {
            const app = appointments.find((a) => a.id === location.state.preselectAppointmentId)
            if (app) {
                setSelectedAppointment(app)
                const pat = patients.find((p) => p.id === app.patientId)
                if (pat) setSelectedPatient(pat)
                setCheckInMode('WITH_APPOINTMENT')
            }
        }
    }, [location.state, appointments, patients])

    // Patient search results
    const searchResults = searchKeyword.trim()
        ? patients.filter(
              (p) =>
                  p.fullName.toLowerCase().includes(searchKeyword.toLowerCase().trim()) ||
                  p.phone.includes(searchKeyword.trim()) ||
                  p.patientCode.toLowerCase().includes(searchKeyword.toLowerCase().trim()) ||
                  (p.identityCard && p.identityCard.includes(searchKeyword.trim()))
          )
        : []

    // Appointments for currently selected patient
    const patientAppointments = selectedPatient
        ? appointments.filter(
              (a) =>
                  a.patientId === selectedPatient.id &&
                  (a.status === APPOINTMENT_STATUS.BOOKED || a.status === APPOINTMENT_STATUS.CONFIRMED)
          )
        : []

    const handleSelectPatient = (pat) => {
        setSelectedPatient(pat)
        setSearchKeyword('')
        // Auto select first booked appointment if available
        const app = appointments.find(
            (a) => a.patientId === pat.id && (a.status === APPOINTMENT_STATUS.BOOKED || a.status === APPOINTMENT_STATUS.CONFIRMED)
        )
        if (app) {
            setSelectedAppointment(app)
            setCheckInMode('WITH_APPOINTMENT')
        } else {
            setSelectedAppointment(null)
            setCheckInMode('WALK_IN')
        }
    }

    const handleWalkInDepartmentChange = (depId) => {
        setWalkInDepartmentId(depId)
        setWalkInDoctorId('')
        setWalkInRoomId('')
        setWalkInServiceId('')

        const depRoom = rooms.find((r) => r.departmentId === depId)
        if (depRoom) setWalkInRoomId(depRoom.id)

        const depService = services.find((s) => s.departmentId === depId)
        if (depService) setWalkInServiceId(depService.id)

        const depDoc = doctors.find((d) => d.departmentId === depId && d.status === 'AVAILABLE')
        if (depDoc) setWalkInDoctorId(depDoc.id)
    }

    const handleConfirmCheckIn = async () => {
        if (!selectedPatient) {
            message.error('Vui lòng chọn hoặc tìm người bệnh')
            return
        }

        setIsSubmitting(true)
        try {
            if (checkInMode === 'WITH_APPOINTMENT') {
                if (!selectedAppointment) {
                    message.error('Vui lòng chọn lịch hẹn cần tiếp nhận')
                    setIsSubmitting(false)
                    return
                }
                const result = await dispatch(
                    checkInAppointmentAsync({
                        payload: {
                            appointmentId: selectedAppointment.id,
                            priority: priorityType,
                            priorityReason,
                            notes: checkInNotes,
                        },
                    })
                ).unwrap()

                message.success(`Tiếp nhận thành công! Số vé khám: ${result.queueEntry.ticketNumber}`)
                setCreatedQueueEntry(result.queueEntry)
                setIsReceiptOpen(true)
                // Clear selection
                setSelectedPatient(null)
                setSelectedAppointment(null)
            } else {
                // WALK_IN
                if (!walkInDepartmentId || !walkInRoomId || !walkInServiceId) {
                    message.error('Vui lòng chọn đầy đủ chuyên khoa, phòng khám và dịch vụ cho lượt khám Walk-in')
                    setIsSubmitting(false)
                    return
                }

                const result = await dispatch(
                    registerWalkInAsync({
                        payload: {
                            patientId: selectedPatient.id,
                            departmentId: walkInDepartmentId,
                            doctorId: walkInDoctorId || 'DOC01',
                            roomId: walkInRoomId,
                            serviceId: walkInServiceId,
                            priority: priorityType,
                            priorityReason,
                            notes: checkInNotes,
                        },
                    })
                ).unwrap()

                message.success(`Đăng ký Walk-in thành công! Số vé khám: ${result.ticketNumber}`)
                setCreatedQueueEntry(result)
                setIsReceiptOpen(true)
                setSelectedPatient(null)
            }
        } catch (err) {
            message.error(err.message || 'Lỗi khi tiếp nhận bệnh nhân')
        } finally {
            setIsSubmitting(false)
        }
    }

    const targetRoom = rooms.find((r) => r.id === (checkInMode === 'WITH_APPOINTMENT' ? selectedAppointment?.roomId : walkInRoomId))
    const isRoomOverloaded = targetRoom && targetRoom.currentWaiting >= targetRoom.capacity

    return (
        <div className="space-y-6">
            {/* Search Header Bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">Quầy tiếp nhận bệnh nhân (Check-in)</h2>
                        <span className="text-xs text-slate-500">
                            Tìm kiếm hồ sơ theo CCCD/SĐT, kiểm tra lịch hẹn trước hoặc đăng ký khám trực tiếp (Walk-in)
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            icon={<AlertOutlined />}
                            danger
                            onClick={() => setIsEmergencyModalOpen(true)}
                            className="font-semibold"
                        >
                            Bàn giao cấp cứu (RC-06)
                        </Button>
                        <Button
                            type="primary"
                            icon={<UserAddOutlined />}
                            onClick={() => setIsCreatePatientOpen(true)}
                            className="bg-sky-600 font-semibold"
                        >
                            Tạo hồ sơ mới (RC-09)
                        </Button>
                    </div>
                </div>

                {/* Patient Search Input */}
                <div className="relative">
                    <Input
                        size="large"
                        prefix={<SearchOutlined className="text-slate-400 text-lg mr-1" />}
                        placeholder="Nhập họ tên, số điện thoại, số CCCD hoặc mã BN để tra cứu..."
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        className="rounded-xl"
                        allowClear
                    />

                    {/* Quick Search Dropdown Results */}
                    {searchResults.length > 0 && (
                        <div className="absolute top-12 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-2 max-h-72 overflow-y-auto space-y-1">
                            <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase">
                                Tìm thấy {searchResults.length} bệnh nhân:
                            </div>
                            {searchResults.map((p) => (
                                <div
                                    key={p.id}
                                    onClick={() => handleSelectPatient(p)}
                                    className="p-3 rounded-xl hover:bg-sky-50 flex items-center justify-between cursor-pointer transition text-xs"
                                >
                                    <div>
                                        <div className="font-bold text-slate-900 flex items-center gap-2">
                                            <span>{p.fullName}</span>
                                            {p.isDuplicateSuspect && (
                                                <Tag color="red" className="mr-0 text-[10px]">
                                                    Nghi vấn trùng
                                                </Tag>
                                            )}
                                        </div>
                                        <div className="text-slate-500 text-[11px]">
                                            Mã: <strong>{p.patientCode}</strong> • SĐT: <strong>{p.phone}</strong> • CCCD: {p.identityCard || 'Chưa có'}
                                        </div>
                                    </div>
                                    <Button size="small" type="primary" className="bg-sky-600">
                                        Chọn tiếp nhận
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Check-In Workspace: 2 Columns */}
            {selectedPatient ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Patient Verification & Missing Docs */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <span className="font-bold text-slate-800 text-sm">Xác minh thông tin người bệnh</span>
                            <Button size="small" onClick={() => setSelectedPatient(null)}>
                                Đổi bệnh nhân
                            </Button>
                        </div>

                        {/* Duplicate Alert (RC-10) */}
                        {selectedPatient.isDuplicateSuspect && (
                            <Alert
                                message="Cảnh báo nghi vấn trùng hồ sơ (RC-10)"
                                description="Bệnh nhân này có thông tin trùng với mã hồ sơ khác trong hệ thống. Lễ tân cần đối chiếu CCCD bản cứng trước khi tiếp tục."
                                type="error"
                                showIcon
                            />
                        )}

                        {/* Missing documents (RC-12) */}
                        {selectedPatient.missingDocs && selectedPatient.missingDocs.length > 0 && (
                            <Alert
                                message="Giấy tờ hành chính còn thiếu (RC-12)"
                                description={
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {selectedPatient.missingDocs.map((doc, idx) => (
                                            <Tag key={idx} color="warning">
                                                {doc}
                                            </Tag>
                                        ))}
                                    </div>
                                }
                                type="warning"
                                showIcon
                            />
                        )}

                        <Descriptions size="small" column={1} bordered>
                            <Descriptions.Item label="Mã hồ sơ">
                                <span className="font-mono font-bold text-sky-700">{selectedPatient.patientCode}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Họ và tên">
                                <span className="font-extrabold text-slate-900">{selectedPatient.fullName}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày sinh">
                                {dayjs(selectedPatient.dob).format('DD/MM/YYYY')} ({selectedPatient.gender === 'MALE' ? 'Nam' : 'Nữ'})
                            </Descriptions.Item>
                            <Descriptions.Item label="Số điện thoại">{selectedPatient.phone}</Descriptions.Item>
                            <Descriptions.Item label="CCCD">{selectedPatient.identityCard || 'Chưa cung cấp'}</Descriptions.Item>
                            <Descriptions.Item label="Thẻ BHYT">
                                {selectedPatient.healthInsurance || 'Không có BHYT'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Địa chỉ">{selectedPatient.address || 'Chưa cập nhật'}</Descriptions.Item>
                            {selectedPatient.guardianName && (
                                <Descriptions.Item label="Người giám hộ">
                                    {selectedPatient.guardianName} ({selectedPatient.guardianPhone})
                                </Descriptions.Item>
                            )}
                        </Descriptions>
                    </div>

                    {/* Right: Check-In Decision & Form */}
                    <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <span className="font-bold text-slate-800 text-sm">Phương thức tiếp nhận</span>
                            <Radio.Group
                                value={checkInMode}
                                onChange={(e) => setCheckInMode(e.target.value)}
                                buttonStyle="solid"
                            >
                                <Radio.Button value="WITH_APPOINTMENT">Check-in có lịch hẹn</Radio.Button>
                                <Radio.Button value="WALK_IN">Đăng ký Walk-in (Không lịch)</Radio.Button>
                            </Radio.Group>
                        </div>

                        {/* MODE 1: Check-in With Appointment */}
                        {checkInMode === 'WITH_APPOINTMENT' ? (
                            <div className="space-y-4">
                                {patientAppointments.length === 0 ? (
                                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                                        <p className="text-slate-500 text-xs">
                                            Không tìm thấy lịch hẹn hợp lệ nào hôm nay cho bệnh nhân này.
                                        </p>
                                        <Button
                                            type="primary"
                                            size="small"
                                            className="bg-sky-600"
                                            onClick={() => setCheckInMode('WALK_IN')}
                                        >
                                            Chuyển sang đăng ký khám trực tiếp (Walk-in)
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-slate-700 uppercase">
                                            Chọn lịch hẹn cần check-in:
                                        </label>
                                        {patientAppointments.map((app) => {
                                            const dep = departments.find((d) => d.id === app.departmentId)
                                            const doc = doctors.find((d) => d.id === app.doctorId)
                                            const room = rooms.find((r) => r.id === app.roomId)
                                            const srv = services.find((s) => s.id === app.serviceId)
                                            const isSelected = selectedAppointment?.id === app.id

                                            return (
                                                <div
                                                    key={app.id}
                                                    onClick={() => setSelectedAppointment(app)}
                                                    className={`p-4 rounded-xl border transition cursor-pointer text-xs space-y-2 ${
                                                        isSelected
                                                            ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-200'
                                                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-sky-800 text-sm">
                                                            {app.appointmentCode}
                                                        </span>
                                                        <Tag color="blue">{app.timeSlot}</Tag>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-slate-600">
                                                        <div>Chuyên khoa: <strong>{dep?.name}</strong></div>
                                                        <div>Bác sĩ: <strong>{doc?.name}</strong></div>
                                                        <div>Phòng khám: <strong>{room?.name}</strong></div>
                                                        <div>Dịch vụ: <strong>{srv?.name}</strong></div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* MODE 2: Walk-In Registration */
                            <div className="space-y-4">
                                <Alert
                                    message="Đăng ký khám trực tiếp không lịch (RC-04)"
                                    description="Vui lòng lựa chọn chuyên khoa và phòng khám phù hợp dựa trên sức chứa và thời gian chờ hiện tại."
                                    type="info"
                                    showIcon
                                />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <label className="block font-bold text-slate-700 uppercase mb-1">
                                            Chuyên khoa <span className="text-red-500">*</span>
                                        </label>
                                        <Select
                                            className="w-full"
                                            placeholder="Chọn khoa khám"
                                            value={walkInDepartmentId || undefined}
                                            onChange={handleWalkInDepartmentChange}
                                            options={departments.map((d) => ({ value: d.id, label: d.name }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold text-slate-700 uppercase mb-1">
                                            Phòng khám & Sức chứa <span className="text-red-500">*</span>
                                        </label>
                                        <Select
                                            className="w-full"
                                            placeholder="Chọn phòng"
                                            value={walkInRoomId || undefined}
                                            onChange={(val) => setWalkInRoomId(val)}
                                            disabled={!walkInDepartmentId}
                                            options={rooms
                                                .filter((r) => r.departmentId === walkInDepartmentId)
                                                .map((r) => ({
                                                    value: r.id,
                                                    label: `${r.name} (${r.currentWaiting}/${r.capacity} chờ) ${
                                                        r.currentWaiting >= r.capacity ? '⚠️ Quá tải' : ''
                                                    }`,
                                                }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold text-slate-700 uppercase mb-1">
                                            Bác sĩ phụ trách
                                        </label>
                                        <Select
                                            className="w-full"
                                            placeholder="Chọn bác sĩ"
                                            value={walkInDoctorId || undefined}
                                            onChange={(val) => setWalkInDoctorId(val)}
                                            disabled={!walkInDepartmentId}
                                            options={doctors
                                                .filter((d) => d.departmentId === walkInDepartmentId)
                                                .map((d) => ({
                                                    value: d.id,
                                                    label: `${d.name} (${d.status === 'AVAILABLE' ? 'Sẵn sàng' : 'Nghỉ/Muộn'})`,
                                                }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold text-slate-700 uppercase mb-1">
                                            Dịch vụ chỉ định <span className="text-red-500">*</span>
                                        </label>
                                        <Select
                                            className="w-full"
                                            placeholder="Chọn dịch vụ"
                                            value={walkInServiceId || undefined}
                                            onChange={(val) => setWalkInServiceId(val)}
                                            disabled={!walkInDepartmentId}
                                            options={services
                                                .filter((s) => s.departmentId === walkInDepartmentId)
                                                .map((s) => ({
                                                    value: s.id,
                                                    label: `${s.name} (${s.price.toLocaleString()} đ)`,
                                                }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Room Capacity Alert */}
                        {isRoomOverloaded && (
                            <Alert
                                message="Cảnh báo: Phòng khám đang vượt tải tối ưu"
                                description="Số lượng bệnh nhân chờ tại phòng này hiện đang vượt ngưỡng công suất. Vui lòng cân nhắc điều phối sang phòng khác nếu có."
                                type="warning"
                                showIcon
                            />
                        )}

                        {/* Priority selection & Notes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
                            <div>
                                <label className="block font-bold text-slate-700 uppercase mb-1">Diện ưu tiên</label>
                                <Select
                                    className="w-full"
                                    value={priorityType}
                                    onChange={(val) => setPriorityType(val)}
                                    options={[
                                        { value: 'NORMAL', label: 'Bình thường (NORMAL)' },
                                        { value: 'PRIORITY', label: 'Ưu tiên (Người già >70t, trẻ em, xe lăn)' },
                                    ]}
                                />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-700 uppercase mb-1">Ghi chú tiếp nhận</label>
                                <Input
                                    placeholder="Lưu ý về triệu chứng, bảo lãnh..."
                                    value={checkInNotes}
                                    onChange={(e) => setCheckInNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Action Submit */}
                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                            <Button onClick={() => setSelectedPatient(null)}>Hủy bỏ</Button>
                            <Button
                                type="primary"
                                size="large"
                                icon={<CheckCircleOutlined />}
                                onClick={handleConfirmCheckIn}
                                loading={isSubmitting}
                                className="bg-emerald-600 hover:bg-emerald-700 font-bold px-6"
                            >
                                Xác nhận Check-in & In vé khám
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                /* Empty / Search Guide State */
                <div className="bg-white p-12 rounded-2xl border border-slate-200/90 shadow-2xs text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto text-2xl font-bold">
                        🔍
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-800">Chọn hoặc tìm kiếm bệnh nhân để bắt đầu</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                            Nhập tên, số điện thoại hoặc quét thẻ CCCD ở ô tìm kiếm phía trên để xác minh hồ sơ và phát số thứ tự khám.
                        </p>
                    </div>
                    <div className="flex justify-center gap-3 pt-2">
                        <Button
                            type="primary"
                            icon={<UserAddOutlined />}
                            onClick={() => setIsCreatePatientOpen(true)}
                            className="bg-sky-600 font-semibold"
                        >
                            Tạo hồ sơ bệnh nhân mới
                        </Button>
                    </div>
                </div>
            )}

            {/* Modals */}
            <PatientFormModal
                open={isCreatePatientOpen}
                onClose={() => setIsCreatePatientOpen(false)}
                onCreatedSuccess={(newPat) => {
                    handleSelectPatient(newPat)
                }}
            />

            <CheckInReceiptModal
                open={isReceiptOpen}
                onClose={() => setIsReceiptOpen(false)}
                queueEntry={createdQueueEntry}
            />

            <EmergencyHandoverModal
                open={isEmergencyModalOpen}
                onClose={() => setIsEmergencyModalOpen(false)}
                defaultPatientId={selectedPatient?.id}
            />
        </div>
    )
}
