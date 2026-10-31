import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { Input, Button, Tag, Select, Radio, Alert, message, Descriptions, Card } from 'antd'
import {
    SearchOutlined,
    UserAddOutlined,
    CheckCircleOutlined,
    AlertOutlined,
    PhoneOutlined,
    ThunderboltOutlined,
    PrinterOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
    checkInAppointmentAsync,
    registerWalkInAsync,
    registerWalkInQuickAsync,
    searchPatientsAsync,
    getPatientDetailAsync,
} from '../../redux/actions/reception/receptionAction'
import { FIVE_SPECIALTIES } from '../../services/reception/receptionService'
import PatientFormModal from '../../components/reception/PatientFormModal'
import CheckInReceiptModal from '../../components/reception/CheckInReceiptModal'
import EmergencyHandoverModal from '../../components/reception/EmergencyHandoverModal'
import { APPOINTMENT_STATUS, MISSING_DOC_LABELS } from '../../utils/constants/receptionConstants'

export default function CheckInPage() {
    const location = useLocation()
    const dispatch = useDispatch()
    const { patients, appointments, departments, doctors, rooms, services, queueEntries = [] } = useSelector((state) => state.reception)

    const [searchKeyword, setSearchKeyword] = useState('')
    const [selectedPatient, setSelectedPatient] = useState(null)
    const [selectedAppointment, setSelectedAppointment] = useState(null)
    const [checkInMode, setCheckInMode] = useState('WITH_APPOINTMENT') // 'WITH_APPOINTMENT' | 'WALK_IN'

    // Walk-in form state
    const [walkInDepartmentId, setWalkInDepartmentId] = useState(1) // Mặc định Khoa Nội (ID=1, prefix=NOI)
    const [walkInDoctorId, setWalkInDoctorId] = useState('')
    const [walkInRoomId, setWalkInRoomId] = useState('')
    const [walkInServiceId, setWalkInServiceId] = useState('')
    const [priorityType, setPriorityType] = useState('NORMAL')
    const [priorityReason, setPriorityReason] = useState('')
    const [checkInNotes, setCheckInNotes] = useState('')

    // Quick Walk-in form (Tiếp nhận nhanh không cần hồ sơ trước)
    const [quickWalkInForm, setQuickWalkInForm] = useState({
        fullName: '',
        phone: '',
        birthYear: '',
        departmentId: 1,
    })
    const [patientNotFoundForPhone, setPatientNotFoundForPhone] = useState(false)
    const [isSearchingPhone, setIsSearchingPhone] = useState(false)

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

    // Auto-fill khi lễ tân gõ SĐT (Nếu là bệnh nhân cũ -> tự động điền Họ tên, Năm sinh, Địa chỉ, Tiền sử dị ứng)
    useEffect(() => {
        const cleanKw = searchKeyword.trim()
        if (/^[0-9]{9,11}$/.test(cleanKw)) {
            const matched = patients.find((p) => p.phone === cleanKw)
            if (matched) {
                dispatch(getPatientDetailAsync(matched.id))
                    .unwrap()
                    .then((detail) => {
                        handleSelectPatient({ ...matched, ...(detail || {}) })
                    })
                    .catch(() => handleSelectPatient(matched))
                setPatientNotFoundForPhone(false)
            } else {
                setIsSearchingPhone(true)
                dispatch(searchPatientsAsync({ search: cleanKw }))
                    .unwrap()
                    .then((paged) => {
                        setIsSearchingPhone(false)
                        const items = paged?.items || []
                        const found = items.find((p) => p.phone === cleanKw)
                        if (found) {
                            dispatch(getPatientDetailAsync(found.id))
                                .unwrap()
                                .then((detail) => {
                                    handleSelectPatient({ ...found, ...(detail || {}) })
                                })
                                .catch(() => handleSelectPatient(found))
                            setPatientNotFoundForPhone(false)
                        } else {
                            setPatientNotFoundForPhone(true)
                        }
                    })
                    .catch(() => {
                        setIsSearchingPhone(false)
                        setPatientNotFoundForPhone(true)
                    })
            }
        } else {
            setPatientNotFoundForPhone(false)
        }
    }, [searchKeyword, patients, dispatch])

    // Patient search results
    const searchResults = searchKeyword.trim()
        ? patients.filter(
              (p) =>
                  p.fullName?.toLowerCase().includes(searchKeyword.toLowerCase().trim()) ||
                  p.phone?.includes(searchKeyword.trim()) ||
                  p.patientCode?.toLowerCase().includes(searchKeyword.toLowerCase().trim()) ||
                  (p.identityCard && p.identityCard.includes(searchKeyword.trim()))
          )
        : []

    // Appointments for currently selected patient
    const patientAppointments = selectedPatient
        ? appointments.filter(
              (a) =>
                  (a.patientId === selectedPatient.id || a.patientCode === selectedPatient.patientCode) &&
                  (a.status === APPOINTMENT_STATUS.BOOKED || a.status === APPOINTMENT_STATUS.CONFIRMED)
          )
        : []

    const handleSelectPatient = (pat) => {
        setSelectedPatient(pat)
        setSearchKeyword('')
        setPatientNotFoundForPhone(false)
        // Auto select first booked appointment if available
        const app = appointments.find(
            (a) => (a.patientId === pat.id || a.patientCode === pat.patientCode) &&
                   (a.status === APPOINTMENT_STATUS.BOOKED || a.status === APPOINTMENT_STATUS.CONFIRMED)
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

        const targetSpec = FIVE_SPECIALTIES.find((s) => s.id === depId || s.code === depId)
        const depRoom = rooms.find((r) => r.departmentId === depId || (targetSpec && (r.departmentId === targetSpec.id || r.code === targetSpec.code))) || rooms[0]
        if (depRoom) setWalkInRoomId(depRoom.id || depRoom.code)

        const depService = services.find((s) => s.departmentId === depId) || services[0] || { id: 'SRV01', name: 'Khám bệnh chuyên khoa', price: 150000 }
        setWalkInServiceId(depService.id)

        const depDoc = doctors.find((d) => d.departmentId === depId && d.status === 'AVAILABLE') || doctors[0]
        if (depDoc) setWalkInDoctorId(depDoc.id)
    }

    // Khởi tạo phòng/bác sĩ mặc định khi chuyển sang Walk-in
    useEffect(() => {
        if (!walkInDepartmentId && FIVE_SPECIALTIES.length > 0) {
            handleWalkInDepartmentChange(FIVE_SPECIALTIES[0].id)
        }
    }, [walkInDepartmentId])

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

                const ticketNum = result.queueEntry?.ma_so_thu_tu || result.queueEntry?.ticketNumber || '01'
                message.success(`Tiếp nhận thành công! Số thứ tự khám: ${ticketNum}`)
                setCreatedQueueEntry(result.queueEntry)
                setIsReceiptOpen(true)
                setSelectedPatient(null)
                setSelectedAppointment(null)
            } else {
                // WALK_IN vào 1 trong 5 chuyên khoa
                if (!walkInDepartmentId) {
                    message.error('Vui lòng chọn 1 trong 5 chuyên khoa tiếp nhận')
                    setIsSubmitting(false)
                    return
                }

                const targetSpec = FIVE_SPECIALTIES.find((s) => s.id === walkInDepartmentId || s.code === walkInDepartmentId)
                const effectiveRoomId = walkInRoomId || targetSpec?.defaultRoom || 'Phòng 101 - Tầng 1'
                const effectiveServiceId = walkInServiceId || services[0]?.id || 'SRV01'

                const result = await dispatch(
                    registerWalkInAsync({
                        payload: {
                            patientId: selectedPatient.id,
                            departmentId: walkInDepartmentId,
                            doctorId: walkInDoctorId || undefined,
                            roomId: effectiveRoomId,
                            serviceId: effectiveServiceId,
                            priority: priorityType,
                            priorityReason,
                            notes: checkInNotes,
                        },
                    })
                ).unwrap()

                const ticketNum = result.ma_so_thu_tu || result.ticketNumber || '01'
                message.success(`Đăng ký Walk-in thành công! Số thứ tự khám: ${ticketNum}`)
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

    const handleQuickWalkInSubmit = async () => {
        if (!quickWalkInForm.fullName?.trim() || !quickWalkInForm.phone?.trim()) {
            message.error('Vui lòng nhập đầy đủ Họ tên và Số điện thoại')
            return
        }
        setIsSubmitting(true)
        try {
            const targetSpec = FIVE_SPECIALTIES.find((s) => s.id === quickWalkInForm.departmentId)
            const result = await dispatch(
                registerWalkInQuickAsync({
                    payload: {
                        fullName: quickWalkInForm.fullName.trim(),
                        phone: quickWalkInForm.phone.trim(),
                        birthYear: quickWalkInForm.birthYear ? Number(quickWalkInForm.birthYear) : null,
                        departmentId: quickWalkInForm.departmentId,
                        notes: `Tiếp nhận nhanh tại quầy - Chuyên khoa ${targetSpec?.name || 'Nội'}`,
                    },
                })
            ).unwrap()

            const ticketNum = result.ma_so_thu_tu || result.ticketNumber || '01'
            message.success(`Tiếp nhận nhanh bệnh nhân vãng lai thành công! Số thứ tự: ${ticketNum}`)
            setCreatedQueueEntry(result)
            setIsReceiptOpen(true)
            setQuickWalkInForm({ fullName: '', phone: '', birthYear: '', departmentId: 1 })
            setSearchKeyword('')
        } catch (err) {
            message.error(err.message || 'Lỗi khi tiếp nhận nhanh')
        } finally {
            setIsSubmitting(false)
        }
    }

    const targetRoom = rooms.find((r) => r.id === (checkInMode === 'WITH_APPOINTMENT' ? selectedAppointment?.roomId : walkInRoomId))
    const isRoomOverloaded = targetRoom && targetRoom.currentWaiting >= targetRoom.capacity

    // Hạn ngạch tiếp đón trong ngày (Tham khảo ý tưởng Clinic-Management MaxPatient, tuân thủ an toàn y tế)
    const maxDailyQuota = 50
    const todayCheckInCount = queueEntries.length
    const quotaPercent = Math.round((todayCheckInCount / maxDailyQuota) * 100)
    const isNearQuota = quotaPercent >= 80 && quotaPercent < 100
    const isOverQuota = quotaPercent >= 100

    return (
        <div className="space-y-6">
            {/* Daily Quota Warning Banner */}
            {(isNearQuota || isOverQuota) && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
                    isOverQuota ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                    <AlertOutlined className={`text-base shrink-0 mt-0.5 ${isOverQuota ? 'text-rose-600' : 'text-amber-600'}`} />
                    <div className="flex-1">
                        <div className="font-bold text-sm">
                            {isOverQuota
                                ? `🛑 HẠN NGẠCH TIẾP ĐÓN TRONG NGÀY ĐÃ ĐẠT NGƯỠNG (${todayCheckInCount}/${maxDailyQuota} lượt - ${quotaPercent}%)`
                                : `⚠️ CẢNH BÁO CÔNG SUẤT TIẾP ĐÓN GẦN ĐẦY (${todayCheckInCount}/${maxDailyQuota} lượt - ${quotaPercent}%)`}
                        </div>
                        <div className="mt-1">
                            {isOverQuota ? (
                                <span>
                                    Công suất tiếp đón hôm nay đã đạt ngưỡng quy định. Bệnh nhân cấp cứu, tái khám chỉ định vẫn được tiếp nhận bình thường.
                                </span>
                            ) : (
                                <span>
                                    Phòng khám đang tiến gần hạn ngạch tiếp nhận trong ngày ({quotaPercent}%). Lễ tân vui lòng chủ động thông báo cho người bệnh về thời gian chờ.
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="w-24 shrink-0 bg-white/80 p-2 rounded-lg border border-slate-200 text-center font-mono font-bold">
                        <div className="text-[10px] uppercase text-slate-500">Tiếp nhận</div>
                        <div className={`text-base ${isOverQuota ? 'text-rose-600' : 'text-amber-600'}`}>{todayCheckInCount}/{maxDailyQuota}</div>
                    </div>
                </div>
            )}

            {/* Search Header Bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-base font-bold text-slate-800">Quầy tiếp nhận bệnh nhân (Check-in)</h2>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 font-mono">
                                Đã tiếp nhận: {todayCheckInCount}/{maxDailyQuota} lượt
                            </span>
                        </div>
                        <span className="text-xs text-slate-500">
                            Gõ SĐT bệnh nhân: tự động điền hồ sơ cũ hoặc cho phép tạo hồ sơ nhanh trong 30 giây
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
                            Tạo hồ sơ mới (30s)
                        </Button>
                    </div>
                </div>

                {/* Patient Search Input */}
                <div className="relative">
                    <Input
                        size="large"
                        prefix={<SearchOutlined className="text-slate-400 text-lg mr-1" />}
                        placeholder="Gõ số điện thoại để tự động điền hoặc nhập họ tên, CCCD, mã BN..."
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        className="rounded-xl"
                        allowClear
                    />

                    {/* Quick Search Dropdown Results */}
                    {searchResults.length > 0 && !selectedPatient && (
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

                {/* Bệnh nhân mới: Alert thông báo khi gõ SĐT chưa có trong hệ thống */}
                {patientNotFoundForPhone && !selectedPatient && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                            <PhoneOutlined className="text-amber-600 text-base" />
                            <div>
                                <span className="font-bold">Số điện thoại {searchKeyword} chưa có hồ sơ (Bệnh nhân mới)</span>
                                <div className="text-[11px] text-amber-700">Lễ tân có thể tạo hồ sơ nhanh trong 30 giây hoặc sử dụng form tiếp nhận nhanh bên dưới.</div>
                            </div>
                        </div>
                        <Button
                            type="primary"
                            icon={<UserAddOutlined />}
                            className="bg-amber-600 hover:bg-amber-700 font-bold text-xs"
                            onClick={() => setIsCreatePatientOpen(true)}
                        >
                            ⚡ Tạo hồ sơ nhanh trong 30 giây
                        </Button>
                    </div>
                )}
            </div>

            {/* Check-In Workspace: 2 Columns */}
            {selectedPatient ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Patient Verification & Details */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <span className="font-bold text-slate-800 text-sm">Hồ sơ người bệnh (Bệnh nhân cũ)</span>
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

                        <Descriptions size="small" column={1} bordered>
                            <Descriptions.Item label="Họ và tên">
                                <span className="font-extrabold text-slate-900 text-sm">{selectedPatient.fullName}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Năm sinh">
                                <span className="font-bold text-slate-800">
                                    {selectedPatient.dob
                                        ? `${dayjs(selectedPatient.dob).format('YYYY')} (${dayjs().diff(dayjs(selectedPatient.dob), 'year')} tuổi) • ${dayjs(selectedPatient.dob).format('DD/MM/YYYY')}`
                                        : 'Chưa cập nhật'}
                                </span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Số điện thoại">
                                <span className="font-mono font-bold text-sky-700">{selectedPatient.phone}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Địa chỉ">
                                <span>{selectedPatient.address || 'Chưa cập nhật'}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Tiền sử dị ứng">
                                {selectedPatient.allergies || selectedPatient.di_ung_thuoc ? (
                                    <Tag color="red" className="font-bold">
                                        ⚠️ {selectedPatient.allergies || selectedPatient.di_ung_thuoc}
                                    </Tag>
                                ) : (
                                    <Tag color="green">Chưa ghi nhận dị ứng thuốc</Tag>
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Mã hồ sơ">
                                <span className="font-mono">{selectedPatient.patientCode}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="CCCD">{selectedPatient.identityCard || 'Chưa cung cấp'}</Descriptions.Item>
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
                                <Radio.Button value="WALK_IN">Tiếp nhận khám trực tiếp (Walk-in)</Radio.Button>
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
                                            Chuyển sang tiếp nhận khám trực tiếp (Walk-in)
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
                            /* MODE 2: Walk-In Registration vào 1 trong 5 chuyên khoa */
                            <div className="space-y-4">
                                <Alert
                                    message="Tiếp nhận bệnh nhân vào 1 trong 5 Chuyên khoa"
                                    description="Hệ thống tự động cấp mã số thứ tự (STT) theo tiền tố buồng khám: NOI-01, TMH-02, RHM-01, MAT-01, DL-01..."
                                    type="info"
                                    showIcon
                                />

                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-700 uppercase">
                                        Chọn Chuyên khoa khám bệnh <span className="text-red-500">*</span>:
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                        {FIVE_SPECIALTIES.map((spec) => {
                                            const isSelected = walkInDepartmentId === spec.id || walkInDepartmentId === spec.code
                                            return (
                                                <div
                                                    key={spec.id}
                                                    onClick={() => handleWalkInDepartmentChange(spec.id)}
                                                    className={`p-3 rounded-xl border-2 transition cursor-pointer text-left ${
                                                        isSelected
                                                            ? 'border-sky-500 bg-sky-50 shadow-xs ring-2 ring-sky-200'
                                                            : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-slate-900 text-xs">{spec.name}</span>
                                                        <Tag color={isSelected ? 'geekblue' : 'default'} className="font-mono font-bold text-[10px]">
                                                            {spec.prefix}-xx
                                                        </Tag>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-1">
                                                        Buồng: <strong>{spec.defaultRoom}</strong>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Room Capacity Alert */}
                        {isRoomOverloaded && (
                            <Alert
                                message="Cảnh báo: Buồng khám đang vượt tải tối ưu"
                                description="Số lượng bệnh nhân chờ tại buồng khám này hiện đang vượt ngưỡng công suất khuyến nghị."
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
                                        { value: 'PRIORITY', label: 'Ưu tiên (Người già >=80t, trẻ em, phụ nữ có thai)' },
                                        { value: 'EMERGENCY', label: 'Cấp cứu nhẹ' },
                                    ]}
                                />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-700 uppercase mb-1">Ghi chú tiếp nhận</label>
                                <Input
                                    placeholder="Lưu ý về triệu chứng ban đầu..."
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
                                Cấp STT Khám & Xem phiếu in
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                /* Empty State + Form Tiếp nhận nhanh Walk-in */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Cột 1: Hướng dẫn tìm kiếm */}
                    <div className="bg-white p-8 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4 text-center flex flex-col justify-center">
                        <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto text-2xl font-bold">
                            🔍
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Tra cứu hoặc Tạo mới người bệnh</h3>
                            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                                Nhập số điện thoại vào ô tìm kiếm để tự động nạp hồ sơ cũ (Họ tên, Năm sinh, Địa chỉ, Tiền sử dị ứng).
                            </p>
                        </div>
                        <div className="pt-2">
                            <Button
                                type="primary"
                                icon={<UserAddOutlined />}
                                onClick={() => setIsCreatePatientOpen(true)}
                                className="bg-sky-600 font-semibold"
                            >
                                Tạo hồ sơ người bệnh mới (30s)
                            </Button>
                        </div>
                    </div>

                    {/* Cột 2: Tiếp nhận nhanh trực tiếp tại quầy (Quick Walk-in) */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 text-xs">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                            <ThunderboltOutlined className="text-amber-500 text-base" />
                            <h3 className="font-bold text-slate-800 text-sm">Tiếp nhận nhanh bệnh nhân vãng lai (Quick Walk-in)</h3>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block font-bold text-slate-700 uppercase mb-1">
                                    Họ và tên bệnh nhân <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    placeholder="Nhập họ và tên..."
                                    value={quickWalkInForm.fullName}
                                    onChange={(e) => setQuickWalkInForm({ ...quickWalkInForm, fullName: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block font-bold text-slate-700 uppercase mb-1">
                                        Số điện thoại <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        placeholder="09..."
                                        value={quickWalkInForm.phone}
                                        onChange={(e) => setQuickWalkInForm({ ...quickWalkInForm, phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 uppercase mb-1">Năm sinh</label>
                                    <Input
                                        placeholder="Ví dụ: 1990"
                                        value={quickWalkInForm.birthYear}
                                        onChange={(e) => setQuickWalkInForm({ ...quickWalkInForm, birthYear: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block font-bold text-slate-700 uppercase mb-1">
                                    Chọn 1 trong 5 Chuyên khoa khám <span className="text-red-500">*</span>
                                </label>
                                <Select
                                    className="w-full"
                                    value={quickWalkInForm.departmentId}
                                    onChange={(val) => setQuickWalkInForm({ ...quickWalkInForm, departmentId: val })}
                                    options={FIVE_SPECIALTIES.map((s) => ({
                                        value: s.id,
                                        label: `${s.name} (${s.prefix}-xx) • ${s.defaultRoom}`,
                                    }))}
                                />
                            </div>
                            <Button
                                type="primary"
                                block
                                icon={<CheckCircleOutlined />}
                                onClick={handleQuickWalkInSubmit}
                                loading={isSubmitting}
                                className="bg-emerald-600 hover:bg-emerald-700 font-bold py-2 h-auto text-sm mt-2"
                            >
                                Cấp STT Khám Nhanh & In Phiếu
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            <PatientFormModal
                open={isCreatePatientOpen}
                initialPhone={searchKeyword}
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
