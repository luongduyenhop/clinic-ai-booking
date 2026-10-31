import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { Input, Button, Tag, Select, Radio, Alert, message, Descriptions, Spin } from 'antd'
import {
    SearchOutlined,
    UserAddOutlined,
    CheckCircleOutlined,
    AlertOutlined,
    PhoneOutlined,
    MedicineBoxOutlined,
    ClockCircleOutlined,
    UserOutlined,
    HomeOutlined,
    WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { checkInAppointmentAsync, registerWalkInAsync } from '../../redux/slices/reception/receptionSlice'
import { receptionService } from '../../services/reception/receptionService'
import PatientFormModal from '../../components/reception/PatientFormModal'
import CheckInReceiptModal from '../../components/reception/CheckInReceiptModal'
import EmergencyHandoverModal from '../../components/reception/EmergencyHandoverModal'

export default function CheckInPage() {
    const location = useLocation()
    const dispatch = useDispatch()
    const { activeRole } = useSelector((state) => state.reception)

    // State tìm kiếm theo SĐT realtime
    const [searchKeyword, setSearchKeyword] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [phoneValidationError, setPhoneValidationError] = useState('')

    // Kết quả tra cứu
    const [backendAppointments, setBackendAppointments] = useState([])
    const [selectedPatient, setSelectedPatient] = useState(null)
    const [selectedAppointment, setSelectedAppointment] = useState(null)
    const [isNewPatient, setIsNewPatient] = useState(false)
    const [checkInMode, setCheckInMode] = useState('WITH_APPOINTMENT') // 'WITH_APPOINTMENT' | 'WALK_IN'

    // Dữ liệu tài nguyên thực tế từ Backend
    const [rosterResources, setRosterResources] = useState([])
    const [roomResources, setRoomResources] = useState([])
    const [shiftMetrics, setShiftMetrics] = useState(null)

    // Walk-in form state
    const [walkInDepartmentId, setWalkInDepartmentId] = useState('')
    const [walkInDoctorId, setWalkInDoctorId] = useState('')
    const [walkInRoomId, setWalkInRoomId] = useState('')
    const [priorityType, setPriorityType] = useState('NORMAL')
    const [priorityReason, setPriorityReason] = useState('')
    const [checkInNotes, setCheckInNotes] = useState('')

    // Form tạo hồ sơ nhanh 30s cho bệnh nhân mới
    const [quickForm, setQuickForm] = useState({
        fullName: '',
        phone: '',
        gender: 'Nam',
        birthYear: 1995,
        address: '',
        allergies: '',
        reason: 'Khám bệnh vãng lai',
    })

    // Modals
    const [isCreatePatientOpen, setIsCreatePatientOpen] = useState(false)
    const [isReceiptOpen, setIsReceiptOpen] = useState(false)
    const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false)
    const [createdQueueEntry, setCreatedQueueEntry] = useState(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // ── Load tài nguyên thực tế từ Backend (Ca trực, Buồng khám, Chỉ số ca) ──
    const loadRealResources = useCallback(async () => {
        const today = dayjs().format('YYYY-MM-DD')
        const currentHour = new Date().getHours()
        const shift = currentHour < 12 ? 'sang' : 'chieu'

        try {
            const [rosters, rooms, metrics] = await Promise.all([
                receptionService.fetchRosterResources(today, shift),
                receptionService.fetchRoomResources(),
                receptionService.fetchShiftDashboard(today, shift),
            ])
            setRosterResources(rosters || [])
            setRoomResources(rooms || [])
            if (metrics) setShiftMetrics(metrics)
        } catch (err) {
            console.warn('Lỗi khi tải tài nguyên tiếp đón thực tế:', err)
        }
    }, [])

    useEffect(() => {
        loadRealResources()
    }, [loadRealResources])

    // Xử lý chuyển trang từ AppointmentsPage kèm preselectAppointmentId
    useEffect(() => {
        if (location.state?.preselectAppointmentId) {
            const aptId = location.state.preselectAppointmentId
            const today = dayjs().format('YYYY-MM-DD')
            receptionService.searchAppointments(String(aptId), today)
                .then((res) => {
                    if (res && res.length > 0) {
                        const targetApt = res.find((a) => a.id === aptId) || res[0]
                        setSelectedAppointment(targetApt)
                        const p = {
                            id: targetApt.id,
                            fullName: targetApt.ten_benh_nhan,
                            phone: targetApt.so_dien_thoai,
                            patientCode: targetApt.ma_lich_kham,
                            gender: 'OTHER',
                        }
                        setSelectedPatient(p)
                        setCheckInMode('WITH_APPOINTMENT')
                        setBackendAppointments(res)
                    }
                })
                .catch((err) => console.warn('Preselect appointment fetch error:', err))
        }
    }, [location.state])

    // Danh sách chuyên khoa từ ca trực thực tế
    const departmentOptions = useMemo(() => {
        const map = new Map()
        // Trích xuất chuyên khoa từ phòng khám thực tế
        roomResources.forEach((r) => {
            if (r.chuyen_khoa_id && r.ten_chuyen_khoa) {
                map.set(r.chuyen_khoa_id, r.ten_chuyen_khoa)
            }
        })
        // Bổ sung từ roster nếu có
        rosterResources.forEach((ros) => {
            if (ros.chuyen_khoa) {
                map.set(ros.chuyen_khoa, ros.chuyen_khoa)
            }
        })

        if (map.size === 0) {
            // Mặc định chuyên khoa phòng khám đa khoa
            return [
                { value: 1, label: 'Khoa Nội Tổng Quát' },
                { value: 2, label: 'Khoa Tai Mũi Họng' },
                { value: 3, label: 'Khoa Răng Hàm Mặt' },
                { value: 4, label: 'Khoa Mắt' },
                { value: 5, label: 'Khoa Ngoại Tổng Hợp' },
            ]
        }
        return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
    }, [roomResources, rosterResources])

    // Danh sách bác sĩ trực ca hiện tại
    const doctorOptions = useMemo(() => {
        return rosterResources.map((ros) => ({
            value: ros.bac_si_id,
            label: `${ros.ten_bac_si} (${ros.chuyen_khoa} · ${ros.ten_phong || 'Phòng khám'})`,
            departmentName: ros.chuyen_khoa,
            roomId: ros.phong_kham_id,
        }))
    }, [rosterResources])

    // Xử lý khi chọn chuyên khoa khám Walk-in
    const handleWalkInDepartmentChange = (depVal) => {
        setWalkInDepartmentId(depVal)
        // Tìm bác sĩ trực phù hợp chuyên khoa này
        const matchedDoc = doctorOptions.find(
            (d) => d.departmentName === depVal || d.value === depVal
        )
        if (matchedDoc) {
            setWalkInDoctorId(matchedDoc.value)
            if (matchedDoc.roomId) setWalkInRoomId(matchedDoc.roomId)
        } else {
            setWalkInDoctorId('')
        }
    }

    // ── Tìm kiếm realtime theo SĐT dưới 0.3s (Debounce 300ms) ───────────
    useEffect(() => {
        const trimmed = searchKeyword.trim()
        if (!trimmed) {
            setPhoneValidationError('')
            setBackendAppointments([])
            setSelectedPatient(null)
            setSelectedAppointment(null)
            setIsNewPatient(false)
            return
        }

        // Validate SĐT nếu là chuỗi số
        const isNumeric = /^[0-9]+$/.test(trimmed)
        if (isNumeric) {
            if (trimmed.length < 10) {
                setPhoneValidationError(`Đang nhập SĐT (${trimmed.length}/10 số)...`)
                return
            } else if (trimmed.length === 10) {
                // Kiểm tra đầu số VN: 03, 05, 07, 08, 09
                const vnPhoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/
                if (!vnPhoneRegex.test(trimmed)) {
                    setPhoneValidationError('Số điện thoại không đúng định dạng 10 số hợp lệ tại Việt Nam!')
                    return
                }
                setPhoneValidationError('')
            } else {
                setPhoneValidationError('Số điện thoại tối đa đúng 10 chữ số!')
                return
            }
        } else {
            setPhoneValidationError('')
        }

        // Thực hiện tìm kiếm Realtime dưới 0.3s qua Backend
        const timer = setTimeout(async () => {
            setIsSearching(true)
            const today = dayjs().format('YYYY-MM-DD')
            try {
                const [apts, patientInfo] = await Promise.all([
                    receptionService.searchAppointments(trimmed, today).catch(() => []),
                    isNumeric && trimmed.length === 10
                        ? receptionService.searchPatientByPhone(trimmed).catch(() => null)
                        : null,
                ])

                const foundAppointments = Array.isArray(apts) ? apts : []
                setBackendAppointments(foundAppointments)

                if (patientInfo) {
                    // ✅ BỆNH NHÂN CŨ: Tự động điền Họ tên, Năm sinh, Địa chỉ, Tiền sử dị ứng
                    setSelectedPatient(patientInfo)
                    setIsNewPatient(false)

                    // Nếu có lịch hẹn hôm nay
                    if (foundAppointments.length > 0) {
                        setSelectedAppointment(foundAppointments[0])
                        setCheckInMode('WITH_APPOINTMENT')
                    } else {
                        setSelectedAppointment(null)
                        setCheckInMode('WALK_IN')
                    }
                } else if (foundAppointments.length > 0) {
                    // Tìm thấy qua lịch hẹn
                    const firstApt = foundAppointments[0]
                    const patientFromApt = {
                        id: firstApt.id,
                        fullName: firstApt.ten_benh_nhan,
                        phone: firstApt.so_dien_thoai || trimmed,
                        patientCode: firstApt.ma_lich_kham,
                        gender: 'OTHER',
                        address: '',
                        allergies: '',
                    }
                    setSelectedPatient(patientFromApt)
                    setIsNewPatient(false)
                    setSelectedAppointment(firstApt)
                    setCheckInMode('WITH_APPOINTMENT')
                } else {
                    // ⚠️ BỆNH NHÂN MỚI: Không tìm thấy hồ sơ khi nhập SĐT 10 số
                    if (isNumeric && trimmed.length === 10) {
                        setSelectedPatient(null)
                        setSelectedAppointment(null)
                        setIsNewPatient(true)
                        setCheckInMode('WALK_IN')
                        setQuickForm((prev) => ({
                            ...prev,
                            phone: trimmed,
                            fullName: '',
                            birthYear: 1995,
                            gender: 'Nam',
                            address: '',
                            allergies: '',
                            reason: 'Khám bệnh vãng lai',
                        }))
                    } else {
                        setSelectedPatient(null)
                        setIsNewPatient(false)
                    }
                }
            } catch (err) {
                console.error('Lỗi tìm kiếm tiếp đón:', err)
            } finally {
                setIsSearching(false)
            }
        }, 300) // Debounce 300ms theo đúng tiêu chí nghiệm thu

        return () => clearTimeout(timer)
    }, [searchKeyword])

    // ── XỬ LÝ CHECK-IN LỊCH HẸN ĐÃ ĐẶT ─────────────────────────────────
    const handleCheckInExistingAppointment = async () => {
        if (!selectedAppointment) {
            message.error('Vui lòng chọn lịch hẹn cần tiếp nhận')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await dispatch(
                checkInAppointmentAsync({
                    payload: {
                        appointmentId: selectedAppointment.id,
                        priority: priorityType,
                        priorityReason,
                        notes: checkInNotes,
                    },
                    actor: activeRole === 'RECEPTION_SUPERVISOR' ? 'Giám sát: Trần Đình Nam' : 'Lễ tân tiếp đón',
                })
            ).unwrap()

            const ticketNumber = result.queueEntry?.ticketNumber || `#${result.ticket?.so_thu_tu_kham || ''}`
            message.success(`Check-in thành công! Cấp số thứ tự khám: ${ticketNumber}`)
            setCreatedQueueEntry(result.queueEntry)
            setIsReceiptOpen(true)

            // Reset tìm kiếm
            setSearchKeyword('')
            setSelectedPatient(null)
            setSelectedAppointment(null)
            setBackendAppointments([])
            loadRealResources()
        } catch (err) {
            message.error(err?.message || 'Lỗi khi thực hiện Check-in lịch hẹn')
        } finally {
            setIsSubmitting(false)
        }
    }

    // ── XỬ LÝ TIẾP NHẬN NHANH VÃNG LAI (WALK-IN) ──────────────────────
    const handleQuickWalkInSubmit = async () => {
        // Nếu là bệnh nhân mới, validate các trường trong quickForm
        if (isNewPatient) {
            if (!quickForm.fullName.trim()) {
                message.error('Vui lòng nhập họ và tên người bệnh mới!')
                return
            }
            if (!quickForm.phone || quickForm.phone.length !== 10) {
                message.error('Số điện thoại phải đúng 10 số hợp lệ!')
                return
            }
        }

        setIsSubmitting(true)
        try {
            const payload = isNewPatient
                ? {
                      fullName: quickForm.fullName.trim(),
                      phone: quickForm.phone.trim(),
                      gender: quickForm.gender === 'Nữ' ? 'FEMALE' : quickForm.gender === 'Nam' ? 'MALE' : 'OTHER',
                      birthYear: quickForm.birthYear ? Number(quickForm.birthYear) : 1995,
                      departmentId: walkInDepartmentId || undefined,
                      doctorId: walkInDoctorId || undefined,
                      priority: priorityType,
                      priorityReason,
                      notes: quickForm.reason || checkInNotes,
                  }
                : {
                      fullName: selectedPatient.fullName,
                      phone: selectedPatient.phone,
                      gender: selectedPatient.gender,
                      birthYear: selectedPatient.birthYear,
                      departmentId: walkInDepartmentId || undefined,
                      doctorId: walkInDoctorId || undefined,
                      priority: priorityType,
                      priorityReason,
                      notes: checkInNotes || 'Khám bệnh vãng lai',
                  }

            const result = await dispatch(
                registerWalkInAsync({
                    payload,
                    actor: activeRole === 'RECEPTION_SUPERVISOR' ? 'Giám sát: Trần Đình Nam' : 'Lễ tân tiếp đón',
                })
            ).unwrap()

            const ticketNumber = result.queueEntry?.ticketNumber || `W${result.ticket?.so_thu_tu_kham || ''}`
            message.success(`Tiếp nhận khám vãng lai thành công! Cấp số: ${ticketNumber}`)
            setCreatedQueueEntry(result.queueEntry)
            setIsReceiptOpen(true)

            // Reset tìm kiếm
            setSearchKeyword('')
            setSelectedPatient(null)
            setIsNewPatient(false)
            loadRealResources()
        } catch (err) {
            message.error(err?.message || 'Lỗi khi tiếp nhận bệnh nhân vãng lai')
        } finally {
            setIsSubmitting(false)
        }
    }

    // Metrics ca trực thực tế
    const todayCheckInCount = shiftMetrics?.so_da_check_in ?? 0
    const todayTotalAppointments = shiftMetrics?.tong_hen_truoc ?? 0
    const maxDailyQuota = 50
    const quotaPercent = Math.min(100, Math.round((todayCheckInCount / maxDailyQuota) * 100))

    return (
        <div className="space-y-6">
            {/* Header thông tin tiếp đón */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-base font-bold text-slate-800">Quầy tiếp đón & Quản lý thông tin hành chính</h2>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 font-mono">
                                Đã tiếp nhận: {todayCheckInCount} lượt · Tổng hẹn trước: {todayTotalAppointments}
                            </span>
                        </div>
                        <span className="text-xs text-slate-500">
                            Tra cứu SĐT thời gian thực dưới 0.3s · Kiểm tra lịch khám & Tạo hồ sơ tiếp nhận nhanh 30 giây
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
                            Tạo hồ sơ đầy đủ (RC-09)
                        </Button>
                    </div>
                </div>

                {/* Ô tìm kiếm SĐT Realtime */}
                <div className="space-y-1.5">
                    <div className="relative">
                        <Input
                            size="large"
                            prefix={<SearchOutlined className="text-slate-400 text-lg mr-1" />}
                            suffix={isSearching ? <Spin size="small" /> : null}
                            placeholder="Gõ số điện thoại bệnh nhân (10 số) để tra cứu tự động..."
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            className="rounded-xl font-mono text-sm"
                            allowClear
                        />
                    </div>

                    {/* Báo lỗi validate SĐT */}
                    {phoneValidationError && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 px-1 font-medium">
                            <WarningOutlined />
                            <span>{phoneValidationError}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* VÙNG LÀM VIỆC CHÍNH */}
            {selectedPatient ? (
                /* ── KỊCH BẢN 1: BỆNH NHÂN CŨ (AUTO-FILL THÔNG TIN) ── */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Cột trái: Tự động điền Họ tên, Năm sinh, Địa chỉ, Tiền sử dị ứng */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="font-bold text-slate-800 text-sm">Hồ sơ bệnh nhân cũ (Tự động điền)</span>
                            </div>
                            <Button size="small" onClick={() => { setSelectedPatient(null); setSearchKeyword(''); }}>
                                Đổi bệnh nhân
                            </Button>
                        </div>

                        {/* Tiền sử dị ứng cảnh báo nổi bật */}
                        {selectedPatient.allergies ? (
                            <Alert
                                message={<span className="font-bold text-rose-700">CẢNH BÁO TIỀN SỬ DỊ ỨNG</span>}
                                description={<span className="text-rose-900 font-semibold text-xs">{selectedPatient.allergies}</span>}
                                type="error"
                                showIcon
                                icon={<WarningOutlined className="text-rose-600 text-lg" />}
                                className="bg-rose-50 border-rose-300"
                            />
                        ) : (
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                                <span>Tiền sử dị ứng:</span>
                                <Tag color="green" className="mr-0">Không ghi nhận dị ứng</Tag>
                            </div>
                        )}

                        <Descriptions size="small" column={1} bordered>
                            <Descriptions.Item label="Họ và tên">
                                <span className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                                    <UserOutlined className="text-sky-600" />
                                    {selectedPatient.fullName}
                                </span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Số điện thoại">
                                <span className="font-mono font-bold text-sky-700 flex items-center gap-1.5">
                                    <PhoneOutlined />
                                    {selectedPatient.phone}
                                </span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Năm sinh">
                                <span className="font-semibold text-slate-800">
                                    {selectedPatient.birthYear || (selectedPatient.dob ? dayjs(selectedPatient.dob).format('YYYY') : 'Chưa rõ')}
                                    {selectedPatient.dob && ` (${dayjs(selectedPatient.dob).format('DD/MM/YYYY')})`}
                                </span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Giới tính">
                                <span className="font-medium">
                                    {selectedPatient.gender === 'FEMALE' ? 'Nữ' : selectedPatient.gender === 'MALE' ? 'Nam' : 'Khác'}
                                </span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Địa chỉ">
                                <span className="text-slate-700 flex items-center gap-1">
                                    <HomeOutlined className="text-slate-400" />
                                    {selectedPatient.address || 'Chưa cập nhật địa chỉ'}
                                </span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Mã hồ sơ">
                                <span className="font-mono text-xs text-slate-500">
                                    {selectedPatient.patientCode || (selectedPatient.id ? `BN-00${selectedPatient.id}` : 'BN-2026')}
                                </span>
                            </Descriptions.Item>
                        </Descriptions>
                    </div>

                    {/* Cột phải: Chọn Check-in Lịch hẹn hoặc Tạo khám Walk-in */}
                    <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <span className="font-bold text-slate-800 text-sm">Phương thức tiếp nhận</span>
                            <Radio.Group
                                value={checkInMode}
                                onChange={(e) => setCheckInMode(e.target.value)}
                                buttonStyle="solid"
                            >
                                <Radio.Button value="WITH_APPOINTMENT">
                                    Kiểm tra lịch khám ({backendAppointments.length})
                                </Radio.Button>
                                <Radio.Button value="WALK_IN">
                                    Tạo khám không đặt lịch (Walk-in)
                                </Radio.Button>
                            </Radio.Group>
                        </div>

                        {checkInMode === 'WITH_APPOINTMENT' ? (
                            /* Luồng 1: Có lịch khám đã đặt trước */
                            <div className="space-y-3">
                                {backendAppointments.length === 0 ? (
                                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                                        <p className="text-slate-500 text-xs">
                                            Bệnh nhân này không có lịch hẹn nào trong ngày hôm nay.
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
                                    <div className="space-y-3">
                                        <label className="block text-xs font-bold text-slate-700 uppercase">
                                            Chọn lịch hẹn hôm nay cần Check-in:
                                        </label>
                                        {backendAppointments.map((apt) => {
                                            const isSelected = selectedAppointment?.id === apt.id
                                            return (
                                                <div
                                                    key={apt.id}
                                                    onClick={() => setSelectedAppointment(apt)}
                                                    className={`p-4 rounded-xl border transition cursor-pointer text-xs space-y-2 ${
                                                        isSelected
                                                            ? 'border-sky-500 bg-sky-50/70 ring-2 ring-sky-200'
                                                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-sky-800 text-sm font-mono">
                                                            {apt.ma_lich_kham}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <Tag color="blue">{apt.gio_kham || 'Ca hôm nay'}</Tag>
                                                            {apt.da_check_in ? (
                                                                <Tag color="green">Đã Check-in (#{apt.so_thu_tu_kham})</Tag>
                                                            ) : (
                                                                <Tag color="orange">Chờ tiếp đón</Tag>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-slate-600">
                                                        <div>Chuyên khoa: <strong>{apt.chuyen_khoa || 'Đa khoa'}</strong></div>
                                                        <div>Bác sĩ: <strong>{apt.ten_bac_si || 'Theo ca trực'}</strong></div>
                                                        <div>Phòng khám: <strong>{apt.phong_kham || 'Phòng khám tiếp nhận'}</strong></div>
                                                        <div>Ngày khám: <strong>{dayjs(apt.ngay_kham).format('DD/MM/YYYY')}</strong></div>
                                                    </div>
                                                </div>
                                            )
                                        })}

                                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                            <Button
                                                type="primary"
                                                size="large"
                                                icon={<CheckCircleOutlined />}
                                                onClick={handleCheckInExistingAppointment}
                                                loading={isSubmitting}
                                                disabled={selectedAppointment?.da_check_in}
                                                className="bg-emerald-600 hover:bg-emerald-700 font-bold px-6"
                                            >
                                                {selectedAppointment?.da_check_in ? 'Lịch hẹn đã Check-in' : 'Xác nhận Check-in & Cấp số thứ tự'}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Luồng 2: Khám trực tiếp không đặt lịch (Walk-in) cho bệnh nhân cũ */
                            <div className="space-y-4">
                                <Alert
                                    message="Tiếp nhận khám vãng lai (Walk-in) cho bệnh nhân cũ"
                                    description="Thông tin hành chính đã được tự động điền. Lễ tân chỉ cần chọn chuyên khoa hoặc bác sĩ trực tiếp nhận ca."
                                    type="info"
                                    showIcon
                                />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <label className="block font-bold text-slate-700 uppercase mb-1">
                                            Chuyên khoa tiếp nhận <span className="text-red-500">*</span>
                                        </label>
                                        <Select
                                            className="w-full"
                                            placeholder="Chọn chuyên khoa"
                                            value={walkInDepartmentId || undefined}
                                            onChange={handleWalkInDepartmentChange}
                                            options={departmentOptions}
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold text-slate-700 uppercase mb-1">
                                            Bác sĩ trực ca hiện tại
                                        </label>
                                        <Select
                                            className="w-full"
                                            placeholder="Hệ thống tự phân bổ hoặc chọn bác sĩ"
                                            value={walkInDoctorId || undefined}
                                            onChange={(val) => setWalkInDoctorId(val)}
                                            options={doctorOptions}
                                            allowClear
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block font-bold text-slate-700 uppercase mb-1">
                                            Lý do khám / Ghi chú tiếp đón
                                        </label>
                                        <Input
                                            placeholder="Triệu chứng, lý do đến khám..."
                                            value={checkInNotes}
                                            onChange={(e) => setCheckInNotes(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                    <Button
                                        type="primary"
                                        size="large"
                                        icon={<MedicineBoxOutlined />}
                                        onClick={handleQuickWalkInSubmit}
                                        loading={isSubmitting}
                                        className="bg-emerald-600 hover:bg-emerald-700 font-bold px-6"
                                    >
                                        Tạo khám Walk-in & Cấp số thứ tự
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : isNewPatient ? (
                /* ── KỊCH BẢN 2: BỆNH NHÂN MỚI (TẠO HỒ SƠ NHANH TRONG 30 GIÂY) ── */
                <div className="bg-white p-6 rounded-2xl border-2 border-sky-400 shadow-md space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-sky-500 animate-pulse"></span>
                            <div>
                                <h3 className="font-extrabold text-slate-900 text-base">
                                    ⚡ Tạo hồ sơ nhanh trong 30 giây cho người bệnh mới
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Không tìm thấy hồ sơ với SĐT <strong>{searchKeyword}</strong>. Điền nhanh thông tin dưới đây để tạo hồ sơ và cấp số khám ngay lập tức.
                                </p>
                            </div>
                        </div>
                        <Tag color="cyan" className="font-mono px-3 py-1 text-xs">
                            Lưu tự động vào benh_nhan & nguoi_dung
                        </Tag>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        {/* Họ và tên */}
                        <div className="md:col-span-2">
                            <label className="block font-bold text-slate-700 uppercase mb-1">
                                Họ và tên người bệnh <span className="text-red-500">*</span>
                            </label>
                            <Input
                                size="large"
                                placeholder="Ví dụ: Nguyễn Văn An"
                                value={quickForm.fullName}
                                onChange={(e) => setQuickForm({ ...quickForm, fullName: e.target.value })}
                                autoFocus
                            />
                        </div>

                        {/* Số điện thoại */}
                        <div>
                            <label className="block font-bold text-slate-700 uppercase mb-1">
                                Số điện thoại <span className="text-red-500">*</span>
                            </label>
                            <Input
                                size="large"
                                value={quickForm.phone}
                                onChange={(e) => setQuickForm({ ...quickForm, phone: e.target.value })}
                                className="font-mono"
                            />
                        </div>

                        {/* Giới tính */}
                        <div>
                            <label className="block font-bold text-slate-700 uppercase mb-1">
                                Giới tính <span className="text-red-500">*</span>
                            </label>
                            <Select
                                size="large"
                                className="w-full"
                                value={quickForm.gender}
                                onChange={(val) => setQuickForm({ ...quickForm, gender: val })}
                                options={[
                                    { value: 'Nam', label: 'Nam' },
                                    { value: 'Nữ', label: 'Nữ' },
                                    { value: 'Khác', label: 'Khác' },
                                ]}
                            />
                        </div>

                        {/* Năm sinh */}
                        <div>
                            <label className="block font-bold text-slate-700 uppercase mb-1">
                                Năm sinh <span className="text-red-500">*</span>
                            </label>
                            <Input
                                size="large"
                                type="number"
                                placeholder="1990"
                                value={quickForm.birthYear}
                                onChange={(e) => setQuickForm({ ...quickForm, birthYear: e.target.value })}
                                className="font-mono"
                            />
                        </div>

                        {/* Tiền sử dị ứng */}
                        <div>
                            <label className="block font-bold text-rose-700 uppercase mb-1">
                                Tiền sử dị ứng (nếu có)
                            </label>
                            <Input
                                size="large"
                                placeholder="Dị ứng Penicillin, hải sản..."
                                value={quickForm.allergies}
                                onChange={(e) => setQuickForm({ ...quickForm, allergies: e.target.value })}
                                className="border-rose-200"
                            />
                        </div>

                        {/* Địa chỉ */}
                        <div className="md:col-span-3">
                            <label className="block font-bold text-slate-700 uppercase mb-1">
                                Địa chỉ cư trú
                            </label>
                            <Input
                                placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố..."
                                value={quickForm.address}
                                onChange={(e) => setQuickForm({ ...quickForm, address: e.target.value })}
                            />
                        </div>

                        {/* Chuyên khoa khám */}
                        <div>
                            <label className="block font-bold text-slate-700 uppercase mb-1">
                                Chuyên khoa khám <span className="text-red-500">*</span>
                            </label>
                            <Select
                                size="large"
                                className="w-full"
                                placeholder="Chọn chuyên khoa"
                                value={walkInDepartmentId || undefined}
                                onChange={handleWalkInDepartmentChange}
                                options={departmentOptions}
                            />
                        </div>

                        {/* Bác sĩ tiếp nhận */}
                        <div className="md:col-span-2">
                            <label className="block font-bold text-slate-700 uppercase mb-1">
                                Bác sĩ tiếp nhận (Tự động cân bằng tải hoặc chỉ định)
                            </label>
                            <Select
                                size="large"
                                className="w-full"
                                placeholder="Tự động phân bổ theo chuyên khoa hoặc chọn bác sĩ"
                                value={walkInDoctorId || undefined}
                                onChange={(val) => setWalkInDoctorId(val)}
                                options={doctorOptions}
                                allowClear
                            />
                        </div>

                        {/* Lý do khám */}
                        <div className="md:col-span-3">
                            <label className="block font-bold text-slate-700 uppercase mb-1">
                                Lý do đến khám
                            </label>
                            <Input
                                placeholder="Đau đầu, sốt nhẹ, khám tổng quát..."
                                value={quickForm.reason}
                                onChange={(e) => setQuickForm({ ...quickForm, reason: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                        <Button onClick={() => setIsNewPatient(false)}>Hủy bỏ</Button>
                        <Button
                            type="primary"
                            size="large"
                            icon={<CheckCircleOutlined />}
                            onClick={handleQuickWalkInSubmit}
                            loading={isSubmitting}
                            className="bg-sky-600 hover:bg-sky-700 font-bold px-8"
                        >
                            Tạo hồ sơ nhanh & Cấp số khám (Walk-in)
                        </Button>
                    </div>
                </div>
            ) : (
                /* ── TRẠNG THÁI CHỜ: HƯỚNG DẪN TIẾP ĐÓN ── */
                <div className="bg-white p-12 rounded-2xl border border-slate-200/90 shadow-2xs text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto text-2xl font-bold">
                        📞
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-800">Nhập số điện thoại để tiếp đón bệnh nhân</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                            Hệ thống tự động nhận diện: <strong>Bệnh nhân cũ</strong> sẽ tự động điền Họ tên, Năm sinh, Địa chỉ, Tiền sử dị ứng. <strong>Bệnh nhân mới</strong> sẽ mở form tạo hồ sơ nhanh trong 30 giây.
                        </p>
                    </div>
                    <div className="flex justify-center gap-3 pt-2">
                        <Button
                            type="primary"
                            icon={<UserAddOutlined />}
                            onClick={() => setIsCreatePatientOpen(true)}
                            className="bg-sky-600 font-semibold"
                        >
                            Tạo hồ sơ người bệnh mới (Thủ công)
                        </Button>
                    </div>
                </div>
            )}

            {/* Modals */}
            <PatientFormModal
                open={isCreatePatientOpen}
                onClose={() => setIsCreatePatientOpen(false)}
                onCreatedSuccess={(newPat) => {
                    setSelectedPatient(newPat)
                    setCheckInMode('WALK_IN')
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
