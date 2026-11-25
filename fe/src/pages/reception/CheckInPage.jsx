import { useState, useEffect, useMemo, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { Input, Button, Tag, Select, Radio, Alert, message, Descriptions, Spin, Modal, Checkbox } from 'antd'
import {
    SearchOutlined,
    UserAddOutlined,
    CheckCircleOutlined,
    AlertOutlined,
    PhoneOutlined,
    ThunderboltOutlined,
    CalendarOutlined,
    MedicineBoxOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
    checkInAppointmentAsync,
    registerWalkInAsync,
    registerWalkInQuickAsync,
    searchPatientsAsync,
    getPatientDetailAsync,
    fetchReceptionDataAsync,
    fetchAppointmentsAsync,
    fetchShiftDashboardAsync,
    searchAppointmentsAsync,
} from '../../redux/actions/reception/receptionAction'
import PatientFormModal from '../../components/reception/PatientFormModal'
import CheckInReceiptModal from '../../components/reception/CheckInReceiptModal'
import EmergencyHandoverModal from '../../components/reception/EmergencyHandoverModal'
import { APPOINTMENT_STATUS } from '../../utils/constants/receptionConstants'
import { receptionService } from '../../services/reception/receptionService'
import { unwrapApi } from '../../utils/helpers/apiHelper'
import { formatDoctorName } from '../../utils/doctorHelper'
import { toFriendlyErrorMessage } from '../../utils/helpers/clientErrorHelper'

function normalizePatient(p) {
    if (!p) return null
    return {
        id: p.id,
        fullName: p.fullName || p.ho_ten || p.ten_benh_nhan || 'N/A',
        phone: p.phone || p.so_dien_thoai || '',
        patientCode: p.patientCode || p.ma_dinh_danh_y_te || p.ma_benh_nhan || (p.id ? `BN-${p.id}` : 'BN-MOI'),
        dob: p.dob || p.ngay_sinh || '',
        gender: p.gender === 'MALE' || p.gioi_tinh === 'Nam' ? 'Nam' : (p.gender === 'FEMALE' || p.gioi_tinh === 'Nữ' ? 'Nữ' : 'Khác'),
        address: p.address || p.dia_chi || '',
        identityCard: p.identityCard || p.cccd_so || '',
        allergies: p.allergies || p.di_ung_thuoc || '',
        bloodType: p.bloodType || p.nhom_mau || 'O+',
        medicalHistory: p.medicalHistory || p.tien_su_benh || '',
        creditScore: p.creditScore ?? p.diem_tin_nhiem ?? 100,
        noShowCount: p.noShowCount ?? p.so_lan_no_show ?? 0,
        isBlockedBooking: Boolean(p.isBlockedBooking ?? p.is_blocked_booking),
        isDuplicateSuspect: Boolean(p.isDuplicateSuspect),
    }
}

function getAppointmentStatusMeta(app) {
    const rawStatus = String(app.status || app.trang_thai_lich || app.trang_thai || '').toLowerCase()
    const isAlreadyCheckedIn = Boolean(
        app.da_check_in ||
        app.so_thu_tu_kham ||
        ['da_check_in', 'da_tiep_nhan', 'dang_kham', 'hoan_thanh', 'completed', 'in_progress', 'checked_in'].includes(rawStatus)
    )

    if (isAlreadyCheckedIn) {
        const sttText = app.so_thu_tu_kham ? `(#${String(app.so_thu_tu_kham).padStart(2, '0')})` : ''
        return {
            type: 'CHECKED_IN',
            label: `Đã check-in ${sttText}`.trim(),
            tagColor: 'green',
            btnText: 'Xem hồ sơ',
            btnType: 'default',
            btnClass: 'text-clinic-success bg-clinic-success-bg border-clinic-success-border font-semibold text-xs hover:bg-clinic-success-bg',
            canCheckIn: false,
        }
    }

    if (rawStatus === 'no_show') {
        return {
            type: 'NO_SHOW',
            label: 'Vắng mặt (No-show)',
            tagColor: 'volcano',
            btnText: 'Xem hồ sơ',
            btnType: 'default',
            btnClass: 'text-clinic-danger bg-clinic-danger-bg border-clinic-danger-border font-semibold text-xs hover:bg-clinic-danger-bg',
            canCheckIn: false,
        }
    }

    if (rawStatus === 'da_huy' || rawStatus === 'cancelled' || rawStatus === 'canceled' || rawStatus === 'tu_choi') {
        return {
            type: 'CANCELLED',
            label: 'Đã hủy',
            tagColor: 'default',
            btnText: 'Xem hồ sơ',
            btnType: 'default',
            btnClass: 'text-clinic-text-secondary bg-clinic-bg border-clinic-border font-semibold text-xs hover:bg-clinic-bg-muted',
            canCheckIn: false,
        }
    }

    return {
        type: 'WAITING_CHECK_IN',
        label: 'Chờ check-in',
        tagColor: 'blue',
        btnText: 'Check-in',
        btnType: 'primary',
        btnClass: 'bg-clinic-success hover:bg-clinic-navy font-semibold text-xs',
        canCheckIn: true,
    }
}

export default function CheckInPage() {
    const location = useLocation()
    const dispatch = useDispatch()
    const {
        patients,
        appointments,
        departments,
        doctors,
        rooms,
        services,
        roomStatus = [],
        queueEntries = [],
    } = useSelector((state) => state.reception)

    const [searchKeyword, setSearchKeyword] = useState('')
    const [searchPatientResults, setSearchPatientResults] = useState([])
    const [searchAppointmentResults, setSearchAppointmentResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const searchContainerRef = useRef(null)
    const initialDeptLoadedRef = useRef(false)
    const [selectedPatient, setSelectedPatient] = useState(null)
    const [selectedAppointment, setSelectedAppointment] = useState(null)
    const [checkInMode, setCheckInMode] = useState('WITH_APPOINTMENT')

    const PRIORITY_REASONS = [
        { value: 'cap_cuu_nhe', label: 'Cấp cứu nhẹ' },
        { value: 'nguoi_gia', label: 'Người cao tuổi (≥ 75 tuổi)' },
        { value: 'thai_phu', label: 'Phụ nữ mang thai' },
        { value: 'tre_so_sinh', label: 'Trẻ sơ sinh / Trẻ nhỏ' },
        { value: 'thuong_binh', label: 'Thương binh / Người có công' },
    ]

    const loadingSpecialties = !departments || departments.length === 0

    const [walkInDepartmentId, setWalkInDepartmentId] = useState(null)
    const [walkInDoctorId, setWalkInDoctorId] = useState(null)
    const [walkInDoctors, setWalkInDoctors] = useState([])
    const [loadingWalkInDocs, setLoadingWalkInDocs] = useState(false)
    const [walkInRoomId, setWalkInRoomId] = useState('')
    const [walkInServiceId, setWalkInServiceId] = useState('')
    const [priorityType, setPriorityType] = useState('NORMAL')
    const [priorityReason, setPriorityReason] = useState('nguoi_gia')
    const [checkInNotes, setCheckInNotes] = useState('')
    const [walkInAutoWaitlist, setWalkInAutoWaitlist] = useState(false)
    const [quickAutoWaitlist, setQuickAutoWaitlist] = useState(false)

    const [quickWalkInForm, setQuickWalkInForm] = useState({
        fullName: '',
        phone: '',
        gender: 'Nam',
        birthYear: '',
        departmentId: null,
        doctorId: null,
        priority: 'NORMAL',
        priorityReason: 'nguoi_gia',
        reason: 'Khám bệnh vãng lai',
    })
    const [quickWalkInDoctors, setQuickWalkInDoctors] = useState([])
    const [loadingQuickDocs, setLoadingQuickDocs] = useState(false)
    const [patientNotFoundForPhone, setPatientNotFoundForPhone] = useState(false)

    const [isCreatePatientOpen, setIsCreatePatientOpen] = useState(false)
    const [isReceiptOpen, setIsReceiptOpen] = useState(false)
    const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false)
    const [createdQueueEntry, setCreatedQueueEntry] = useState(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        const todayStr = dayjs().format('YYYY-MM-DD')
        dispatch(fetchReceptionDataAsync())
        dispatch(fetchAppointmentsAsync({ queryDate: todayStr, pageSize: 100 }))
        dispatch(fetchShiftDashboardAsync({ queryDate: todayStr }))
    }, [dispatch])

    const loadDoctorsForDepartment = async (depId) => {
        if (!depId) return []
        try {
            const res = await receptionService.getDoctors({
                specialty_id: Number(depId),
                page: 1,
                page_size: 100,
            })
            const data = unwrapApi(res)
            const list = Array.isArray(data) ? data : data?.items || []
            return list.map((d) => {
                const rs = (roomStatus || []).find((r) => r.bac_si_id === d.id)
                return {
                    id: d.id,
                    name: d.ho_ten || d.name,
                    title: d.hoc_vi || '',
                    roomId: d.phong_kham_id || rs?.phong_kham_id,
                    roomName: rs?.ten_phong || d.vi_tri_phong || 'Phòng khám',
                    waitingCount: rs?.so_benh_nhan_cho ?? rs?.so_nguoi_cho ?? 0,
                    status: d.is_active === false ? 'ON_LEAVE' : 'AVAILABLE',
                }
            })
        } catch {
            return []
        }
    }

    const fetchWalkInDoctors = async (depId) => {
        setLoadingWalkInDocs(true)
        const mapped = await loadDoctorsForDepartment(depId)
        setWalkInDoctors(mapped)
        setLoadingWalkInDocs(false)
    }

    const fetchQuickDoctors = async (depId) => {
        setLoadingQuickDocs(true)
        const mapped = await loadDoctorsForDepartment(depId)
        setQuickWalkInDoctors(mapped)
        setLoadingQuickDocs(false)
    }

    const fetchDoctorsForInitialDepartment = async (depId) => {
        setLoadingWalkInDocs(true)
        setLoadingQuickDocs(true)
        const mapped = await loadDoctorsForDepartment(depId)
        setWalkInDoctors(mapped)
        setQuickWalkInDoctors(mapped)
        setLoadingWalkInDocs(false)
        setLoadingQuickDocs(false)
    }

    useEffect(() => {
        const stateApp = location.state?.appointment
        const targetId = location.state?.preselectAppointmentId || stateApp?.id || stateApp?.ma_lich_kham
        const statePatient = location.state?.patient

        if (targetId || stateApp || statePatient) {
            const targetApp = stateApp || appointments.find((a) =>
                String(a.id) === String(targetId) ||
                a.ma_lich_kham === targetId ||
                a.appointmentCode === targetId
            )

            if (targetApp) {
                setSelectedAppointment(targetApp)
                setCheckInMode('WITH_APPOINTMENT')

                const patId = targetApp.benh_nhan_id || targetApp.patientId || targetApp.benh_nhan?.id
                let pat = statePatient || (patId ? patients.find((p) => String(p.id) === String(patId)) : null)
                if (!pat && targetApp.so_dien_thoai) {
                    pat = patients.find((p) => p.phone === targetApp.so_dien_thoai)
                }

                if (pat) {
                    setSelectedPatient(normalizePatient(pat))
                    if (pat.id) {
                        dispatch(getPatientDetailAsync(pat.id)).then((res) => {
                            if (res?.payload) setSelectedPatient((prev) => normalizePatient({ ...prev, ...res.payload }))
                        }).catch(() => {})
                    }
                } else {
                    const fallbackPat = normalizePatient({
                        id: patId || 1,
                        fullName: targetApp.ten_benh_nhan || targetApp.fullName || targetApp.benh_nhan?.ho_ten || 'Bệnh nhân',
                        phone: targetApp.so_dien_thoai || targetApp.phone || targetApp.benh_nhan?.so_dien_thoai || '',
                        patientCode: targetApp.ma_benh_nhan || (patId ? `BN-${patId}` : 'BN-1'),
                        dob: targetApp.ngay_sinh || targetApp.benh_nhan?.ngay_sinh || '',
                        gender: targetApp.gioi_tinh || targetApp.benh_nhan?.gioi_tinh || 'Nam',
                        address: targetApp.dia_chi || targetApp.benh_nhan?.dia_chi || '',
                        identityCard: targetApp.cccd_so || targetApp.benh_nhan?.cccd_so || '',
                        allergies: targetApp.di_ung_thuoc || targetApp.benh_nhan?.di_ung_thuoc || '',
                        bloodType: targetApp.nhom_mau || targetApp.benh_nhan?.nhom_mau || 'O+',
                        medicalHistory: targetApp.tien_su_benh || targetApp.benh_nhan?.tien_su_benh || '',
                    })
                    setSelectedPatient(fallbackPat)
                    if (patId) {
                        dispatch(getPatientDetailAsync(patId)).then((res) => {
                            if (res?.payload) setSelectedPatient((prev) => normalizePatient({ ...prev, ...res.payload }))
                        }).catch(() => {})
                    }
                }
            } else if (statePatient) {
                setSelectedPatient(normalizePatient(statePatient))
            }
        }
    }, [location.state, appointments, patients, dispatch])

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
                setIsSearchOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        const cleanKw = searchKeyword.trim()
        if (!cleanKw || cleanKw.length < 1) {
            setSearchPatientResults([])
            setSearchAppointmentResults([])
            setPatientNotFoundForPhone(false)
            setIsSearching(false)
            setIsSearchOpen(false)
            return
        }

        const timer = setTimeout(async () => {
            setIsSearching(true)
            try {
                const todayStr = dayjs().format('YYYY-MM-DD')
                const [pagedPatients, appts] = await Promise.allSettled([
                    dispatch(searchPatientsAsync({ search: cleanKw, page: 1, pageSize: 10 })).unwrap(),
                    dispatch(searchAppointmentsAsync({ q: cleanKw, queryDate: todayStr })).unwrap(),
                ])

                const patientItems = pagedPatients.status === 'fulfilled' ? (pagedPatients.value?.items || []) : []
                const apptItems = appts.status === 'fulfilled' ? (appts.value || []) : []

                setSearchPatientResults(patientItems)
                setSearchAppointmentResults(apptItems)
                setIsSearchOpen(true)

                const isPhone = /^(03|05|07|08|09)\d{8}$/.test(cleanKw)
                if (isPhone && patientItems.length === 0 && apptItems.length === 0) {
                    setPatientNotFoundForPhone(true)
                } else {
                    setPatientNotFoundForPhone(false)
                }
            } catch {
            } finally {
                setIsSearching(false)
            }
        }, 350)

        return () => clearTimeout(timer)
    }, [searchKeyword, dispatch])

    const hasSearchResults = searchAppointmentResults.length > 0 || searchPatientResults.length > 0

    const patientAppointments = useMemo(() => {
        if (!selectedPatient) return []
        const list = appointments.filter((a) => {
            const matchesPatient =
                (a.patientId && a.patientId === selectedPatient.id) ||
                (a.benh_nhan_id && a.benh_nhan_id === selectedPatient.id) ||
                (a.so_dien_thoai && selectedPatient.phone && a.so_dien_thoai === selectedPatient.phone) ||
                (a.patientCode && a.patientCode === selectedPatient.patientCode)

            const rawStatus = String(a.status || a.trang_thai_lich || a.trang_thai || '').toLowerCase()
            const isAlreadyCheckedIn = Boolean(
                a.da_check_in ||
                a.so_thu_tu_kham ||
                ['da_check_in', 'da_tiep_nhan', 'dang_kham', 'hoan_thanh', 'completed', 'in_progress', 'checked_in'].includes(rawStatus)
            )
            const isEligible = ['da_xac_nhan', 'cho_xac_nhan', 'da_dat', 'booked', 'confirmed'].includes(rawStatus) && !isAlreadyCheckedIn

            return matchesPatient && isEligible
        })

        if (selectedAppointment) {
            const alreadyInList = list.some(
                (a) => a.id === selectedAppointment.id || (a.ma_lich_kham && a.ma_lich_kham === selectedAppointment.ma_lich_kham)
            )
            if (!alreadyInList) {
                return [selectedAppointment, ...list]
            }
        }

        return list
    }, [selectedPatient, appointments, selectedAppointment])

    const waitingCheckInAppointments = useMemo(() => {
        return (appointments || [])
            .filter((app) => getAppointmentStatusMeta(app).canCheckIn)
            .slice(0, 12)
    }, [appointments])

    const handleSelectPatient = async (pat) => {
        const norm = normalizePatient(pat)
        setSelectedPatient(norm)
        setSearchKeyword('')
        setIsSearchOpen(false)
        setSearchPatientResults([])
        setSearchAppointmentResults([])
        setPatientNotFoundForPhone(false)

        try {
            const detail = await dispatch(getPatientDetailAsync(pat.id)).unwrap()
            if (detail) {
                setSelectedPatient((prev) => normalizePatient({ ...prev, ...(detail || {}) }))
            }
        } catch {
        }

        const matchedApp = appointments.find((a) => {
            const matchesPatient =
                (a.patientId && a.patientId === pat.id) ||
                (a.benh_nhan_id && a.benh_nhan_id === pat.id) ||
                (a.so_dien_thoai && pat.phone && a.so_dien_thoai === pat.phone) ||
                (a.patientCode && a.patientCode === pat.patientCode)

            const rawStatus = String(a.status || a.trang_thai_lich || a.trang_thai || '').toLowerCase()
            const isAlreadyCheckedIn = Boolean(
                a.da_check_in ||
                a.so_thu_tu_kham ||
                ['da_check_in', 'dang_kham', 'hoan_thanh', 'completed', 'in_progress', 'checked_in'].includes(rawStatus)
            )
            const isEligible = ['da_xac_nhan', 'cho_xac_nhan', 'da_dat', 'booked', 'confirmed'].includes(rawStatus) && !isAlreadyCheckedIn

            return matchesPatient && isEligible
        })

        if (matchedApp) {
            setSelectedAppointment(matchedApp)
            setCheckInMode('WITH_APPOINTMENT')
        } else {
            setSelectedAppointment(null)
            setCheckInMode('WALK_IN')
        }
    }

    const handleSelectAppointmentSearchResult = async (app, statusMeta = null) => {
        setIsSearchOpen(false)
        setSearchKeyword('')
        setSearchPatientResults([])
        setSearchAppointmentResults([])
        setPatientNotFoundForPhone(false)

        if (statusMeta?.type === 'CHECKED_IN') {
            setSelectedAppointment(null)
            setCheckInMode('WALK_IN')
            message.info(`Lịch hẹn ${app.ma_lich_kham || ''} đã được check-in trước đó (STT #${app.so_thu_tu_kham || '✓'}). Đã nạp hồ sơ bệnh nhân.`)
        } else if (statusMeta?.type === 'NO_SHOW') {
            setSelectedAppointment(null)
            setCheckInMode('WALK_IN')
            message.warning(`Lịch hẹn ${app.ma_lich_kham || ''} đã bị đánh dấu No-show. Đã nạp hồ sơ để tiếp nhận vãng lai nếu người bệnh đến trễ.`)
        } else if (statusMeta?.type === 'CANCELLED') {
            setSelectedAppointment(null)
            setCheckInMode('WALK_IN')
            message.warning(`Lịch hẹn ${app.ma_lich_kham || ''} đã bị hủy. Đã nạp hồ sơ bệnh nhân.`)
        } else {
            setSelectedAppointment(app)
            setCheckInMode('WITH_APPOINTMENT')
        }

        const patId = app.benh_nhan_id || app.patientId
        let pat = patId ? patients.find((p) => p.id === patId) : null
        if (!pat && app.so_dien_thoai) {
            pat = patients.find((p) => p.phone === app.so_dien_thoai)
        }

        if (pat) {
            try {
                const detail = await dispatch(getPatientDetailAsync(pat.id)).unwrap()
                setSelectedPatient(normalizePatient({ ...pat, ...(detail || {}) }))
            } catch {
                setSelectedPatient(normalizePatient(pat))
            }
        } else if (patId) {
            try {
                const detail = await dispatch(getPatientDetailAsync(patId)).unwrap()
                if (detail) {
                    setSelectedPatient(normalizePatient(detail))
                } else {
                    setSelectedPatient(normalizePatient({
                        id: patId,
                        fullName: app.ten_benh_nhan,
                        phone: app.so_dien_thoai,
                        patientCode: `BN-${patId}`,
                    }))
                }
            } catch {
                setSelectedPatient(normalizePatient({
                    id: patId,
                    fullName: app.ten_benh_nhan,
                    phone: app.so_dien_thoai,
                    patientCode: `BN-${patId}`,
                }))
            }
        } else {
            setSelectedPatient(normalizePatient({
                id: 0,
                fullName: app.ten_benh_nhan,
                phone: app.so_dien_thoai,
                patientCode: 'BN-MOI',
            }))
        }
    }

    const handleWalkInDepartmentChange = (depId) => {
        setWalkInDepartmentId(depId)
        setWalkInDoctorId(null)
        fetchWalkInDoctors(depId)

        const targetSpec = (departments || []).find((s) => s.id === depId || s.code === depId)
        const depRoom = (rooms || []).find((r) => r.departmentId === depId || (targetSpec && (r.departmentId === targetSpec.id || r.code === targetSpec.code))) || (rooms || [])[0]
        if (depRoom) setWalkInRoomId(depRoom.id || depRoom.code)

        const depService = (services || []).find((s) => s.departmentId === depId) || (services || [])[0] || { id: 1, name: 'Khám bệnh chuyên khoa', price: 150000 }
        if (depService) setWalkInServiceId(depService.id)
    }

    const handleQuickDepartmentChange = (depId) => {
        setQuickWalkInForm((prev) => ({ ...prev, departmentId: depId, doctorId: null }))
        fetchQuickDoctors(depId)
    }

    const handleWalkInDoctorChange = (docId) => {
        setWalkInDoctorId(docId)
        if (docId) {
            const chosen = walkInDoctors.find((d) => d.id === docId)
            if (chosen?.roomId) {
                setWalkInRoomId(chosen.roomId)
            }
        }
    }

    useEffect(() => {
        if (!initialDeptLoadedRef.current && departments && departments.length > 0) {
            initialDeptLoadedRef.current = true
            const firstId = departments[0].id
            setWalkInDepartmentId(firstId)
            setQuickWalkInForm((prev) => ({ ...prev, departmentId: firstId }))

            const targetSpec = departments[0]
            const depRoom = (rooms || []).find((r) => r.departmentId === firstId || (targetSpec && (r.departmentId === targetSpec.id || r.code === targetSpec.code))) || (rooms || [])[0]
            if (depRoom) setWalkInRoomId(depRoom.id || depRoom.code)

            const depService = (services || []).find((s) => s.departmentId === firstId) || (services || [])[0] || { id: 1, name: 'Khám bệnh chuyên khoa', price: 150000 }
            if (depService) setWalkInServiceId(depService.id)

            fetchDoctorsForInitialDepartment(firstId)
        }
    }, [departments, rooms, services])

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

                const ticketNum = result.queueEntry?.ma_so_thu_tu || result.queueEntry?.ticketNumber || result.ma_so_thu_tu || result.ticketNumber || '01'
                message.success(`Tiếp nhận thành công! Số thứ tự khám: ${ticketNum}`)
                setCreatedQueueEntry(result.queueEntry || result)
                setIsReceiptOpen(true)
                setSelectedPatient(null)
                setSelectedAppointment(null)
                setPriorityType('NORMAL')
                setPriorityReason('nguoi_gia')
                setCheckInNotes('')
            } else {
                if (!walkInDepartmentId && !walkInDoctorId) {
                    message.error('Vui lòng chọn chuyên khoa tiếp nhận hoặc bác sĩ tiếp nhận')
                    setIsSubmitting(false)
                    return
                }

                const currentShift = dayjs().hour() >= 12 ? 'chieu' : 'sang'
                try {
                    const result = await dispatch(
                        registerWalkInAsync({
                            payload: {
                                patientId: selectedPatient.id,
                                fullName: selectedPatient.fullName,
                                phone: selectedPatient.phone,
                                gender: selectedPatient.gender,
                                birthYear: selectedPatient.dob ? dayjs(selectedPatient.dob).year() : undefined,
                                departmentId: walkInDepartmentId ? Number(walkInDepartmentId) : null,
                                doctorId: walkInDoctorId ? Number(walkInDoctorId) : null,
                                shift: currentShift,
                                priority: priorityType,
                                priorityReason: priorityType === 'PRIORITY' ? priorityReason : null,
                                notes: (checkInNotes?.trim() || 'Khám bệnh vãng lai').slice(0, 255),
                                dangKyWaitlistNeuHetCho: walkInAutoWaitlist,
                            },
                        })
                    ).unwrap()

                    const ticketNum = result.ma_so_thu_tu || result.ticketNumber || '01'
                    if (result.is_waitlist) {
                        message.warning(`Ca khám đã hết lượt! Đã ghi danh vào Danh sách chờ (Waitlist): ${ticketNum}`)
                    } else {
                        message.success(`Đăng ký Walk-in thành công! Số thứ tự khám: ${ticketNum}`)
                    }
                    setCreatedQueueEntry(result)
                    setIsReceiptOpen(true)
                    setSelectedPatient(null)
                    setWalkInAutoWaitlist(false)
                } catch (walkInErr) {
                    const errMsg = typeof walkInErr === 'string' ? walkInErr : (walkInErr?.message || '')
                    const isFull = /chỉ tiêu|tiếp nhận thêm|danh sách chờ|hết lượt|kín chỗ|quá tải|đạt giới hạn|waitlist|409|conflict/i.test(errMsg)
                    if (isFull) {
                        Modal.confirm({
                            title: 'Ca khám / Bác sĩ đã hết lượt tiếp nhận!',
                            icon: <ExclamationCircleOutlined className="text-clinic-warning" />,
                            content: (
                                <div className="space-y-2 text-xs text-clinic-text-secondary">
                                    <p>{errMsg}</p>
                                    <p className="font-semibold text-clinic-navy">
                                        Bạn có muốn ghi danh người bệnh vào <strong>Danh sách chờ (Waitlist)</strong> không?
                                    </p>
                                    <p className="text-[11px] text-clinic-text-secondary">
                                        Hệ thống sẽ cấp mã số chờ (WAIT-xx). Khi có lịch hủy hoặc bác sĩ trống chỗ, người bệnh sẽ được ưu tiên giữ slot và tiếp nhận ngay.
                                    </p>
                                </div>
                            ),
                            okText: 'Ghi danh vào Danh sách chờ',
                            cancelText: 'Hủy bỏ',
                            okButtonProps: { className: 'medpro-btn-amber font-bold' },
                            onOk: async () => {
                                try {
                                    setIsSubmitting(true)
                                    const waitlistRes = await dispatch(
                                        registerWalkInAsync({
                                            payload: {
                                                patientId: selectedPatient.id,
                                                fullName: selectedPatient.fullName,
                                                phone: selectedPatient.phone,
                                                gender: selectedPatient.gender,
                                                birthYear: selectedPatient.dob ? dayjs(selectedPatient.dob).year() : undefined,
                                                departmentId: walkInDepartmentId ? Number(walkInDepartmentId) : null,
                                                doctorId: walkInDoctorId ? Number(walkInDoctorId) : null,
                                                shift: currentShift,
                                                priority: priorityType,
                                                priorityReason: priorityType === 'PRIORITY' ? priorityReason : null,
                                                notes: (checkInNotes?.trim() || 'Khám bệnh vãng lai').slice(0, 255),
                                                dangKyWaitlistNeuHetCho: true,
                                            },
                                        })
                                    ).unwrap()
                                    const ticketNum = waitlistRes.ma_so_thu_tu || waitlistRes.ticketNumber || 'WAIT-01'
                                    message.warning(`Đã ghi danh vào Danh sách chờ (Waitlist): ${ticketNum}`)
                                    setCreatedQueueEntry(waitlistRes)
                                    setIsReceiptOpen(true)
                                    setSelectedPatient(null)
                                    setWalkInAutoWaitlist(false)
                                } catch (wErr) {
                                    message.error(toFriendlyErrorMessage(wErr, 'Không thể ghi danh vào danh sách chờ'))
                                } finally {
                                    setIsSubmitting(false)
                                }
                            },
                        })
                    } else {
                        message.error(errMsg || 'Lỗi khi tiếp nhận bệnh nhân')
                    }
                }
            }
        } catch (err) {
            message.error(toFriendlyErrorMessage(err, 'Lỗi khi tiếp nhận bệnh nhân'))
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleQuickWalkInSubmit = async () => {
        const cleanName = quickWalkInForm.fullName?.trim() || ''
        const cleanPhone = quickWalkInForm.phone?.trim().replace(/\s+/g, '') || ''

        if (!cleanName || cleanName.length < 2 || cleanName.length > 150) {
            message.error('Họ và tên bệnh nhân phải từ 2 đến 150 ký tự')
            return
        }

        const phoneRegex = /^[0-9]{10,11}$/
        if (!phoneRegex.test(cleanPhone)) {
            message.error('Số điện thoại không hợp lệ! Vui lòng nhập từ 10 đến 11 chữ số (VD: 0912345678)')
            return
        }

        const currentYear = new Date().getFullYear()
        if (quickWalkInForm.birthYear) {
            const yr = Number(quickWalkInForm.birthYear)
            if (isNaN(yr) || yr < 1900 || yr > currentYear) {
                message.error(`Năm sinh không hợp lệ! Vui lòng nhập từ 1900 đến ${currentYear}`)
                return
            }
        }

        const depId = quickWalkInForm.departmentId && !isNaN(quickWalkInForm.departmentId) ? Number(quickWalkInForm.departmentId) : null
        const docId = quickWalkInForm.doctorId && !isNaN(quickWalkInForm.doctorId) ? Number(quickWalkInForm.doctorId) : null

        if (!depId && !docId) {
            message.error('Vui lòng chọn chuyên khoa khám hoặc bác sĩ tiếp nhận!')
            return
        }

        setIsSubmitting(true)
        try {
            const currentShift = dayjs().hour() >= 12 ? 'chieu' : 'sang'
            const specList = departments || []
            const targetSpec = specList.find((s) => Number(s.id) === depId)
            const cleanReason = (quickWalkInForm.reason?.trim() || `Tiếp nhận nhanh tại quầy - Chuyên khoa ${targetSpec?.name || 'Nội'}`).slice(0, 255)
            const cleanPriorityReason = quickWalkInForm.priority === 'PRIORITY' ? (quickWalkInForm.priorityReason || 'nguoi_gia') : null

            try {
                const result = await dispatch(
                    registerWalkInAsync({
                        payload: {
                            fullName: cleanName,
                            phone: cleanPhone,
                            gender: quickWalkInForm.gender || 'Nam',
                            birthYear: quickWalkInForm.birthYear ? Number(quickWalkInForm.birthYear) : null,
                            departmentId: depId,
                            doctorId: docId || undefined,
                            shift: currentShift,
                            priority: quickWalkInForm.priority,
                            priorityReason: cleanPriorityReason,
                            notes: cleanReason,
                            dangKyWaitlistNeuHetCho: quickAutoWaitlist,
                        },
                    })
                ).unwrap()

                const ticketNum = result.ma_so_thu_tu || result.ticketNumber || '01'
                if (result.is_waitlist) {
                    message.warning(`Ca khám đã hết lượt! Đã ghi danh vào Danh sách chờ (Waitlist): ${ticketNum}`)
                } else {
                    message.success(`Tiếp nhận nhanh bệnh nhân vãng lai thành công! Số thứ tự: ${ticketNum}`)
                }
                setCreatedQueueEntry(result)
                setIsReceiptOpen(true)
                setQuickWalkInForm({
                    fullName: '',
                    phone: '',
                    gender: 'Nam',
                    birthYear: '',
                    departmentId: depId || (departments[0]?.id ?? 1),
                    doctorId: null,
                    priority: 'NORMAL',
                    priorityReason: 'nguoi_gia',
                    reason: 'Khám bệnh vãng lai',
                })
                setQuickAutoWaitlist(false)
                setSearchKeyword('')
            } catch (quickErr) {
                const errMsg = typeof quickErr === 'string' ? quickErr : (quickErr?.message || '')
                const isFull = /chỉ tiêu|tiếp nhận thêm|danh sách chờ|hết lượt|kín chỗ|quá tải|đạt giới hạn|waitlist|409|conflict/i.test(errMsg)
                if (isFull) {
                    Modal.confirm({
                        title: 'Ca khám / Bác sĩ đã hết lượt tiếp nhận!',
                        icon: <ExclamationCircleOutlined className="text-clinic-warning" />,
                        content: (
                            <div className="space-y-2 text-xs text-clinic-text-secondary">
                                <p>{errMsg}</p>
                                <p className="font-semibold text-clinic-navy">
                                    Bạn có muốn ghi danh người bệnh vào <strong>Danh sách chờ (Waitlist)</strong> không?
                                </p>
                                <p className="text-[11px] text-clinic-text-secondary">
                                    Hệ thống sẽ cấp mã số chờ (WAIT-xx). Khi có lịch hủy hoặc bác sĩ trống chỗ, người bệnh sẽ được ưu tiên giữ slot và tiếp nhận ngay.
                                </p>
                            </div>
                        ),
                        okText: 'Ghi danh vào Danh sách chờ',
                        cancelText: 'Hủy bỏ',
                        okButtonProps: { className: 'medpro-btn-amber font-bold' },
                        onOk: async () => {
                            try {
                                setIsSubmitting(true)
                                const waitlistRes = await dispatch(
                                    registerWalkInAsync({
                                        payload: {
                                            fullName: cleanName,
                                            phone: cleanPhone,
                                            gender: quickWalkInForm.gender || 'Nam',
                                            birthYear: quickWalkInForm.birthYear ? Number(quickWalkInForm.birthYear) : null,
                                            departmentId: depId,
                                            doctorId: docId || undefined,
                                            shift: currentShift,
                                            priority: quickWalkInForm.priority,
                                            priorityReason: cleanPriorityReason,
                                            notes: cleanReason,
                                            dangKyWaitlistNeuHetCho: true,
                                        },
                                    })
                                ).unwrap()
                                const ticketNum = waitlistRes.ma_so_thu_tu || waitlistRes.ticketNumber || 'WAIT-01'
                                message.warning(`Đã ghi danh vào Danh sách chờ (Waitlist): ${ticketNum}`)
                                setCreatedQueueEntry(waitlistRes)
                                setIsReceiptOpen(true)
                                setQuickWalkInForm({
                                    fullName: '',
                                    phone: '',
                                    gender: 'Nam',
                                    birthYear: '',
                                    departmentId: depId || (departments[0]?.id ?? 1),
                                    doctorId: null,
                                    priority: 'NORMAL',
                                    priorityReason: 'nguoi_gia',
                                    reason: 'Khám bệnh vãng lai',
                                })
                                setQuickAutoWaitlist(false)
                                setSearchKeyword('')
                            } catch (wErr) {
                                message.error(typeof wErr === 'string' ? wErr : (wErr?.message || 'Không thể ghi danh vào danh sách chờ'))
                            } finally {
                                setIsSubmitting(false)
                            }
                        },
                    })
                } else {
                    message.error(errMsg || 'Lỗi khi tiếp nhận nhanh')
                }
            }
        } catch (err) {
            message.error(err || 'Lỗi khi tiếp nhận nhanh')
        } finally {
            setIsSubmitting(false)
        }
    }

    const maxDailyQuota = 50
    const todayCheckInCount = queueEntries.length
    const quotaPercent = Math.round((todayCheckInCount / maxDailyQuota) * 100)
    const isNearQuota = quotaPercent >= 80 && quotaPercent < 100
    const isOverQuota = quotaPercent >= 100

    return (
        <div className="space-y-4">
            {(isNearQuota || isOverQuota) && (
                <div className={`p-4 rounded-[6px] border flex items-start gap-3 text-xs leading-relaxed ${
                    isOverQuota ? 'bg-clinic-danger-bg border-clinic-danger-border text-clinic-danger' : 'bg-clinic-warning-bg border-clinic-warning-border text-clinic-warning'
                }`}>
                    <AlertOutlined className={`text-base shrink-0 mt-0.5 ${isOverQuota ? 'text-clinic-danger' : 'text-clinic-warning'}`} />
                    <div className="flex-1">
                        <div className="font-bold text-sm tabular-nums">
                            {isOverQuota
                                ? `HẠN NGẠCH TIẾP ĐÓN TRONG NGÀY ĐÃ ĐẠT NGƯỠNG (${todayCheckInCount}/${maxDailyQuota} lượt - ${quotaPercent}%)`
                                : `CẢNH BÁO CÔNG SUẤT TIẾP ĐÓN GẦN ĐẦY (${todayCheckInCount}/${maxDailyQuota} lượt - ${quotaPercent}%)`}
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
                    <div className="w-24 shrink-0 bg-clinic-surface p-2 rounded-[6px] border border-clinic-border text-center font-mono font-bold tabular-nums">
                        <div className="text-[10px] text-clinic-text-secondary">Tiếp nhận</div>
                        <div className={`text-base ${isOverQuota ? 'text-clinic-danger' : 'text-clinic-warning'}`}>{todayCheckInCount}/{maxDailyQuota}</div>
                    </div>
                </div>
            )}

            <div className="medpro-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-sm font-extrabold text-clinic-navy">Quầy tiếp nhận bệnh nhân (Check-in)</h2>
                        </div>
                        <span className="text-xs text-clinic-text-secondary">
                            Tra cứu SĐT, Họ tên, Mã lịch hẹn hoặc CCCD để tự động nạp hồ sơ và check-in ngay
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="primary"
                            icon={<UserAddOutlined />}
                            onClick={() => setIsCreatePatientOpen(true)}
                            className="medpro-btn-primary !h-8 !px-4"
                        >
                            Tạo hồ sơ mới (30s)
                        </Button>
                    </div>
                </div>

                <div className="relative" ref={searchContainerRef}>
                    <Input
                        size="large"
                        prefix={<SearchOutlined className="text-clinic-text-muted text-lg mr-1" />}
                        suffix={isSearching ? <Spin size="small" /> : null}
                        placeholder="Gõ SĐT, họ tên, mã lịch hẹn (APT-...), CCCD hoặc mã BN để tra cứu..."
                        value={searchKeyword}
                        onFocus={() => {
                            if (searchKeyword.trim().length > 0) {
                                setIsSearchOpen(true)
                            }
                        }}
                        onChange={(e) => {
                            setSearchKeyword(e.target.value)
                            if (e.target.value.trim().length > 0) {
                                setIsSearchOpen(true)
                            } else {
                                setIsSearchOpen(false)
                            }
                        }}
                        className="rounded-[6px]"
                        allowClear
                    />

                    {isSearchOpen && hasSearchResults && searchKeyword.trim().length > 0 && (
                        <div className="absolute top-12 left-0 right-0 bg-clinic-surface border border-clinic-border rounded-[6px] z-30 p-2 max-h-80 overflow-y-auto space-y-2">
                            {searchAppointmentResults.length > 0 && (
                                <div className="space-y-1">
                                    <div className="px-3 py-1 text-[11px] font-bold text-clinic-cta bg-clinic-surface-tint rounded-[6px] flex justify-between items-center tabular-nums">
                                        <span className="flex items-center gap-1.5"><CalendarOutlined /> Lịch hẹn hôm nay ({searchAppointmentResults.length}):</span>
                                        <span className="text-[10px] text-clinic-cta font-normal">Bấm để Check-in ngay</span>
                                    </div>
                                    {searchAppointmentResults.map((app) => {
                                        const statusMeta = getAppointmentStatusMeta(app)

                                        return (
                                            <div
                                                key={app.id}
                                                onClick={() => handleSelectAppointmentSearchResult(app, statusMeta)}
                                                className="p-3 rounded-[6px] hover:bg-clinic-surface-tint border border-clinic-border flex items-center justify-between cursor-pointer transition text-xs"
                                            >
                                                <div className="space-y-1">
                                                    <div className="font-bold text-clinic-navy flex items-center gap-2 flex-wrap">
                                                        <span className="font-mono text-clinic-cta tabular-nums">{app.ma_lich_kham || `APT-${app.id}`}</span>
                                                        <span>·</span>
                                                        <span>{app.ten_benh_nhan}</span>
                                                        <Tag color={statusMeta.tagColor} className="text-[10px] mr-0 font-medium">
                                                            {statusMeta.label}
                                                        </Tag>
                                                    </div>
                                                    <div className="text-clinic-text-secondary text-[11px] flex items-center gap-2 flex-wrap tabular-nums">
                                                        <span>SĐT: <strong className="text-clinic-navy">{app.so_dien_thoai || 'N/A'}</strong></span>
                                                        <span>·</span>
                                                        <span>Giờ khám: <strong className="text-clinic-navy">{app.gio_kham || 'Theo ca'}</strong></span>
                                                        <span>·</span>
                                                        <span>Khoa: <strong className="text-clinic-navy">{app.chuyen_khoa || 'Chưa gán khoa'}</strong> {app.ten_bac_si ? `(${formatDoctorName(app.ten_bac_si)})` : ''}</span>
                                                        {app.phong_kham && (
                                                            <>
                                                                <span>·</span>
                                                                <span>Phòng: <strong className="text-clinic-cta">{app.phong_kham}</strong></span>
                                                            </>
                                                        )}
                                                        {app.ticket_id && (
                                                            <>
                                                                <span>·</span>
                                                                <span className="text-clinic-success font-mono font-semibold">Vé #{app.ticket_id}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <Button
                                                    size="small"
                                                    type={statusMeta.btnType}
                                                    className={statusMeta.btnClass}
                                                >
                                                    {statusMeta.btnText}
                                                </Button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {searchPatientResults.length > 0 && (
                                <div className="space-y-1">
                                    <div className="px-3 py-1 text-[11px] font-bold text-clinic-text-secondary bg-clinic-bg rounded-[6px] tabular-nums">
                                        Hồ sơ bệnh nhân ({searchPatientResults.length}):
                                    </div>
                                    {searchPatientResults.map((p) => (
                                        <div
                                            key={p.id}
                                            onClick={() => handleSelectPatient(p)}
                                            className="p-3 rounded-[6px] hover:bg-clinic-surface-tint border border-clinic-border flex items-center justify-between cursor-pointer transition text-xs"
                                        >
                                            <div>
                                                <div className="font-bold text-clinic-navy flex items-center gap-2">
                                                    <span>{p.fullName || p.ho_ten}</span>
                                                    {p.isDuplicateSuspect && (
                                                        <Tag color="red" className="mr-0 text-[10px]">
                                                            Nghi vấn trùng
                                                        </Tag>
                                                    )}
                                                </div>
                                                <div className="text-clinic-text-secondary text-[11px] mt-0.5 tabular-nums">
                                                    Mã: <strong>{p.patientCode || p.ma_dinh_danh_y_te || `BN-${p.id}`}</strong> · SĐT: <strong>{p.phone || p.so_dien_thoai}</strong> · CCCD: {p.identityCard || p.cccd_so || 'Chưa có'}
                                                </div>
                                            </div>
                                            <Button size="small" type="primary" className="medpro-btn-primary !h-7 !px-3 text-xs font-bold">
                                                Chọn tiếp nhận
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {isSearchOpen && patientNotFoundForPhone && searchKeyword.trim().length > 0 && (
                    <div className="p-3.5 rounded-[6px] bg-clinic-warning-bg border border-clinic-warning-border text-clinic-warning flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                            <PhoneOutlined className="text-clinic-warning text-base" />
                            <div>
                                <span className="font-bold tabular-nums">Số điện thoại {searchKeyword} chưa có hồ sơ (Bệnh nhân mới)</span>
                                <div className="text-[11px] text-clinic-warning">Lễ tân có thể tạo hồ sơ nhanh trong 30 giây hoặc sử dụng form tiếp nhận nhanh bên dưới.</div>
                            </div>
                        </div>
                        <Button
                            type="primary"
                            icon={<UserAddOutlined />}
                            className="medpro-btn-amber font-bold text-xs"
                            onClick={() => setIsCreatePatientOpen(true)}
                        >
                            Tạo hồ sơ nhanh trong 30 giây
                        </Button>
                    </div>
                )}
            </div>

            {selectedPatient ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="medpro-card p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-clinic-border pb-2.5">
                            <span className="font-extrabold text-clinic-navy text-xs">Hồ sơ người bệnh (Bệnh nhân cũ)</span>
                            <Button size="small" onClick={() => setSelectedPatient(null)} className="rounded-[6px] text-xs font-semibold">
                                Đổi bệnh nhân
                            </Button>
                        </div>

                        {selectedPatient.isDuplicateSuspect && (
                            <Alert
                                message="Cảnh báo nghi vấn trùng hồ sơ"
                                description="Bệnh nhân này có thông tin trùng với mã hồ sơ khác trong hệ thống. Lễ tân cần đối chiếu CCCD bản cứng trước khi tiếp tục."
                                type="error"
                                showIcon
                            />
                        )}

                        {selectedPatient.isBlockedBooking && (
                            <Alert
                                message="Cảnh báo: Tài khoản bị khóa tự đặt hẹn"
                                description={`Bệnh nhân có ${selectedPatient.noShowCount} lần vắng mặt không lý do.`}
                                type="warning"
                                showIcon
                            />
                        )}

                        <Descriptions size="small" column={1} bordered className="bg-clinic-surface rounded-[6px] overflow-hidden">
                            <Descriptions.Item label="Họ và tên">
                                <span className="font-extrabold text-clinic-navy text-sm">{selectedPatient.fullName}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Giới tính">
                                <span className="font-semibold text-clinic-navy">{selectedPatient.gender}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Nhóm máu">
                                <Tag color="magenta" className="font-bold">{selectedPatient.bloodType}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Năm sinh">
                                <span className="font-bold text-clinic-navy tabular-nums">
                                    {selectedPatient.dob
                                        ? `${dayjs(selectedPatient.dob).format('YYYY')} (${dayjs().diff(dayjs(selectedPatient.dob), 'year')} tuổi) · ${dayjs(selectedPatient.dob).format('DD/MM/YYYY')}`
                                        : 'Chưa cập nhật'}
                                </span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Số điện thoại">
                                <span className="font-mono font-bold text-clinic-cta tabular-nums">{selectedPatient.phone || 'Chưa có'}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Địa chỉ">
                                <span>{selectedPatient.address || 'Chưa cập nhật'}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Tiền sử dị ứng">
                                {selectedPatient.allergies ? (
                                    <Tag color="red" className="font-bold">
                                        Dị ứng: {selectedPatient.allergies}
                                    </Tag>
                                ) : (
                                    <Tag color="green">Chưa ghi nhận dị ứng thuốc</Tag>
                                )}
                            </Descriptions.Item>
                            {selectedPatient.medicalHistory && (
                                <Descriptions.Item label="Tiền sử bệnh">
                                    <span className="text-clinic-text">{selectedPatient.medicalHistory}</span>
                                </Descriptions.Item>
                            )}
                            <Descriptions.Item label="Mã hồ sơ">
                                <span className="font-mono font-bold text-clinic-navy tabular-nums">{selectedPatient.patientCode}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="CCCD"><span className="tabular-nums">{selectedPatient.identityCard || 'Chưa cung cấp'}</span></Descriptions.Item>
                        </Descriptions>
                    </div>

                    <div className="lg:col-span-2 medpro-card p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-clinic-border pb-2.5">
                            <span className="font-extrabold text-clinic-navy text-xs">Phương thức tiếp nhận</span>
                            <Radio.Group
                                value={checkInMode}
                                onChange={(e) => setCheckInMode(e.target.value)}
                                buttonStyle="solid"
                            >
                                <Radio.Button value="WITH_APPOINTMENT">Check-in có lịch hẹn</Radio.Button>
                                <Radio.Button value="WALK_IN">Tiếp nhận khám trực tiếp (Walk-in)</Radio.Button>
                            </Radio.Group>
                        </div>

                        {checkInMode === 'WITH_APPOINTMENT' ? (
                            <div className="space-y-4">
                                {patientAppointments.length === 0 ? (
                                    <div className="p-6 text-center bg-clinic-bg rounded-[6px] border border-dashed border-clinic-border space-y-2">
                                        <p className="text-clinic-text-secondary text-xs">
                                            Không tìm thấy lịch hẹn hợp lệ nào hôm nay cho bệnh nhân này.
                                        </p>
                                        <Button
                                            type="primary"
                                            size="small"
                                            className="medpro-btn-primary !h-7 !px-3 text-xs font-bold" onClick={() => setCheckInMode('WALK_IN')}
                                        >
                                            Chuyển sang tiếp nhận khám trực tiếp (Walk-in)
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <span className="medpro-label">
                                            Chọn lịch hẹn cần check-in:
                                        </span>
                                        {patientAppointments.map((app) => {
                                            const dep = departments.find((d) => d.id === (app.departmentId || app.chuyen_khoa_id))
                                            const doc = doctors.find((d) => d.id === (app.doctorId || app.bac_si_id))
                                            const room = rooms.find((r) => r.id === (app.roomId || app.phong_kham_id))
                                            const srv = services.find((s) => s.id === (app.serviceId || app.dich_vu_id))
                                            const isSelected = selectedAppointment?.id === app.id || (selectedAppointment?.ma_lich_kham && selectedAppointment.ma_lich_kham === app.ma_lich_kham)
                                            const displayCode = app.appointmentCode || app.ma_lich_kham || `APT-${app.id}`
                                            const displayTime = app.timeSlot || app.gio_kham || 'Theo ca khám'
                                            const depName = app.ten_chuyen_khoa || dep?.name || 'Chuyên khoa'
                                            const docName = app.ten_bac_si ? formatDoctorName(app.ten_bac_si) : (doc?.name ? formatDoctorName(doc.name) : 'Theo phân bổ ca')
                                            const roomName = app.phong_kham || room?.name || 'Phòng khám'
                                            const srvName = app.ten_dich_vu || srv?.name || 'Khám bệnh chuyên khoa'

                                            return (
                                                <div
                                                    key={app.id}
                                                    onClick={() => setSelectedAppointment(app)}
                                                    className={`p-4 rounded-[6px] border transition cursor-pointer text-xs space-y-2 ${
                                                        isSelected
                                                            ? 'border-clinic-cta bg-clinic-surface-alt'
                                                            : 'border-clinic-border bg-clinic-bg hover:bg-clinic-surface-tint'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-center tabular-nums">
                                                        <span className="font-bold text-clinic-navy text-sm">
                                                            {displayCode}
                                                        </span>
                                                        <Tag color="blue">{displayTime}</Tag>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-clinic-text-secondary">
                                                        <div>Chuyên khoa: <strong className="text-clinic-navy">{depName}</strong></div>
                                                        <div>Bác sĩ: <strong className="text-clinic-navy">{docName}</strong></div>
                                                        <div>Phòng khám: <strong className="text-clinic-navy">{roomName}</strong></div>
                                                        <div>Dịch vụ: <strong className="text-clinic-navy">{srvName}</strong></div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3 text-xs">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="medpro-label !mb-0">
                                            Chuyên khoa khám <span className="text-clinic-danger">*</span>
                                        </span>
                                        {loadingSpecialties && <Spin size="small" />}
                                    </div>
                                    <Select
                                        className="w-full"
                                        placeholder={loadingSpecialties ? 'Đang tải chuyên khoa...' : 'Chọn chuyên khoa khám...'}
                                        value={walkInDepartmentId}
                                        onChange={handleWalkInDepartmentChange}
                                        options={(departments || []).map((s) => ({
                                            value: s.id,
                                            label: s.name || s.ten_chuyen_khoa || 'Chuyên khoa',
                                        }))}
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="medpro-label !mb-0">
                                            Bác sĩ tiếp nhận khám (kèm buồng khám theo ca trực):
                                        </span>
                                        {loadingWalkInDocs && <Spin size="small" />}
                                    </div>
                                    <Select
                                        className="w-full"
                                        placeholder={
                                            loadingWalkInDocs
                                                ? 'Đang tải danh sách bác sĩ...'
                                                : !walkInDepartmentId
                                                  ? 'Chọn chuyên khoa trước'
                                                  : walkInDoctors.length === 0
                                                    ? 'Khoa này chưa có bác sĩ'
                                                    : 'Chọn bác sĩ hoặc để tự động'
                                        }
                                        allowClear
                                        loading={loadingWalkInDocs}
                                        disabled={!walkInDepartmentId || loadingWalkInDocs}
                                        value={walkInDoctorId || undefined}
                                        onChange={handleWalkInDoctorChange}
                                        options={[
                                            { value: '', label: 'Tự động phân bổ bác sĩ' },
                                            ...walkInDoctors.map((d) => ({
                                                value: d.id,
                                                label: `${formatDoctorName(d.name, d.title)}${d.roomName ? ` — ${d.roomName}` : ''}${d.status === 'ON_LEAVE' ? ' (Nghỉ)' : ''}`,
                                                disabled: d.status === 'ON_LEAVE',
                                            })),
                                        ]}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-3 border-t border-clinic-border">
                            <div>
                                <span className="medpro-label">
                                    Mức độ ưu tiên <span className="text-clinic-danger">*</span>
                                </span>
                                <Select
                                    className="w-full"
                                    value={priorityType}
                                    onChange={(val) => setPriorityType(val)}
                                    options={[
                                        { value: 'NORMAL', label: 'Bình thường' },
                                        { value: 'PRIORITY', label: 'Ưu tiên đặc biệt' },
                                    ]}
                                />
                            </div>
                            {priorityType === 'PRIORITY' ? (
                                <div>
                                    <span className="medpro-label">
                                        Diện ưu tiên (Theo quy định) <span className="text-clinic-danger">*</span>
                                    </span>
                                    <Select
                                        className="w-full"
                                        value={priorityReason}
                                        onChange={(val) => setPriorityReason(val)}
                                        options={PRIORITY_REASONS}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label htmlFor="ci-notes-normal" className="medpro-label">
                                        {checkInMode === 'WITH_APPOINTMENT' ? 'Ghi chú điều phối' : 'Lý do khám / Triệu chứng'}
                                    </label>
                                    <Input
                                        id="ci-notes-normal"
                                        placeholder={checkInMode === 'WITH_APPOINTMENT' ? 'Lưu ý điều phối bổ sung...' : 'Ví dụ: Đau mắt đỏ, mờ mắt, tái khám...'}
                                        maxLength={255}
                                        value={checkInNotes}
                                        onChange={(e) => setCheckInNotes(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        {priorityType === 'PRIORITY' && (
                            <div className="text-xs pt-1">
                                <label htmlFor="ci-notes-priority" className="medpro-label">
                                    {checkInMode === 'WITH_APPOINTMENT' ? 'Ghi chú điều phối' : 'Lý do khám / Triệu chứng'}
                                </label>
                                <Input
                                    id="ci-notes-priority"
                                    placeholder={checkInMode === 'WITH_APPOINTMENT' ? 'Lưu ý điều phối bổ sung...' : 'Ví dụ: Đau mắt đỏ, mờ mắt, tái khám...'}
                                    maxLength={255}
                                    value={checkInNotes}
                                    onChange={(e) => setCheckInNotes(e.target.value)}
                                />
                            </div>
                        )}

                        {checkInMode === 'WALK_IN' && (
                            <div className="pt-2">
                                <Checkbox
                                    checked={walkInAutoWaitlist}
                                    onChange={(e) => setWalkInAutoWaitlist(e.target.checked)}
                                    className="text-xs text-clinic-warning font-medium"
                                >
                                    Đăng ký Danh sách chờ (Waitlist) nếu bác sĩ đã đủ chỉ tiêu tiếp nhận trong ca
                                </Checkbox>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-3 border-t border-clinic-border">
                            <Button className="medpro-btn-outline !h-10 !px-4 text-xs font-semibold" onClick={() => setSelectedPatient(null)}>Hủy bỏ</Button>
                            <Button
                                type="primary"
                                size="large"
                                icon={<CheckCircleOutlined />}
                                onClick={handleConfirmCheckIn}
                                loading={isSubmitting}
                                className="medpro-btn-primary !h-10 !px-6 text-sm font-bold">
                                Cấp STT Khám &amp; Xem phiếu in
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    <div className="lg:col-span-7 medpro-card p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-clinic-border pb-2.5">
                            <div className="flex items-center gap-2">
                                <CalendarOutlined className="text-clinic-cta text-sm" />
                                <h3 className="text-xs font-extrabold text-clinic-navy">
                                    Lịch hẹn chờ tiếp đón trong ngày ({waitingCheckInAppointments.length})
                                </h3>
                            </div>
                            <span className="text-[11px] text-clinic-text-secondary tabular-nums">
                                Chọn để nạp hồ sơ check-in ngay
                            </span>
                        </div>

                        {waitingCheckInAppointments.length === 0 ? (
                            <div className="py-10 px-4 text-center rounded-[6px] bg-clinic-bg border border-clinic-border space-y-1.5">
                                <p className="text-xs font-bold text-clinic-navy">
                                    Chưa có lịch hẹn đặt trước chờ tiếp đón trong ca
                                </p>
                                <p className="text-[11px] text-clinic-text-secondary max-w-md mx-auto">
                                    Gõ số điện thoại, CCCD hoặc họ tên vào thanh tìm kiếm phía trên để tra cứu hồ sơ cũ, hoặc cấp số khám vãng lai tại biểu mẫu bên cạnh.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-clinic-border border border-clinic-border rounded-[6px] bg-clinic-surface overflow-hidden">
                                {waitingCheckInAppointments.map((app) => {
                                    const statusMeta = getAppointmentStatusMeta(app)
                                    const appCode = app.ma_lich_kham || app.appointmentCode || `APT-${app.id}`
                                    const patientName = app.ten_benh_nhan || app.patientName || 'Bệnh nhân'
                                    const phone = app.so_dien_thoai || app.phone || 'Chưa có SĐT'
                                    const visitTime = app.gio_kham || app.timeSlot || 'Theo ca'
                                    const specialtyName = app.ten_chuyen_khoa || 'Chuyên khoa'
                                    const doctorName = app.ten_bac_si ? formatDoctorName(app.ten_bac_si) : ''

                                    return (
                                        <div
                                            key={app.id}
                                            className="p-3 flex flex-wrap items-center justify-between gap-3 hover:bg-clinic-surface-tint transition-colors text-xs"
                                        >
                                            <div className="min-w-0 space-y-0.5">
                                                <div className="flex items-center gap-2 flex-wrap tabular-nums">
                                                    <span className="font-mono font-bold text-clinic-cta">{appCode}</span>
                                                    <span className="font-bold text-clinic-navy">{patientName}</span>
                                                    <span className="medpro-badge-info text-[10px] font-bold">{visitTime}</span>
                                                </div>
                                                <div className="text-[11px] text-clinic-text-secondary flex items-center gap-2 flex-wrap tabular-nums">
                                                    <span>SĐT: <strong className="text-clinic-navy">{phone}</strong></span>
                                                    <span>·</span>
                                                    <span>{specialtyName}{doctorName ? ` (${doctorName})` : ''}</span>
                                                </div>
                                            </div>
                                            <Button
                                                size="small"
                                                type="primary"
                                                onClick={() => handleSelectAppointmentSearchResult(app, statusMeta)}
                                                className="medpro-btn-primary !h-7 !px-3 text-xs font-bold shrink-0"
                                            >
                                                Chọn tiếp nhận
                                            </Button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-5 medpro-card p-4 space-y-3 text-xs">
                        <div className="flex items-center gap-2 border-b border-clinic-border pb-2.5">
                            <ThunderboltOutlined className="text-clinic-warning text-base" />
                            <div>
                                <h3 className="font-extrabold text-clinic-navy text-xs">Tiếp nhận nhanh bệnh nhân vãng lai (Quick Walk-in)</h3>
                                <p className="text-[11px] text-clinic-text-secondary mt-0.5">Cấp số thứ tự khám ngay tại quầy — Chọn Bác sĩ trực &amp; Mức độ ưu tiên</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label htmlFor="qw-full-name" className="medpro-label">
                                    Họ và tên bệnh nhân <span className="text-clinic-danger">*</span>
                                </label>
                                <Input
                                    id="qw-full-name"
                                    placeholder="Nhập đầy đủ họ và tên bệnh nhân..."
                                    maxLength={150}
                                    value={quickWalkInForm.fullName}
                                    onChange={(e) => setQuickWalkInForm({ ...quickWalkInForm, fullName: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label htmlFor="qw-phone" className="medpro-label">
                                        Số điện thoại <span className="text-clinic-danger">*</span>
                                    </label>
                                    <Input
                                        id="qw-phone"
                                        placeholder="0912345678 (10-11 số)"
                                        maxLength={11}
                                        value={quickWalkInForm.phone}
                                        onChange={(e) => setQuickWalkInForm({ ...quickWalkInForm, phone: e.target.value.replace(/\D/g, '') })}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="qw-gender" className="medpro-label">Giới tính</label>
                                    <Select
                                        id="qw-gender"
                                        className="w-full"
                                        value={quickWalkInForm.gender}
                                        onChange={(val) => setQuickWalkInForm({ ...quickWalkInForm, gender: val })}
                                        options={[
                                            { value: 'Nam', label: 'Nam' },
                                            { value: 'Nữ', label: 'Nữ' },
                                            { value: 'Khác', label: 'Khác' },
                                        ]}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label htmlFor="qw-birth-year" className="medpro-label">Năm sinh</label>
                                    <Input
                                        id="qw-birth-year"
                                        placeholder="Ví dụ: 1990"
                                        maxLength={4}
                                        value={quickWalkInForm.birthYear}
                                        onChange={(e) => setQuickWalkInForm({ ...quickWalkInForm, birthYear: e.target.value.replace(/\D/g, '') })}
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="medpro-label !mb-0">
                                            Chuyên khoa khám <span className="text-clinic-danger">*</span>
                                        </span>
                                        {loadingSpecialties && <Spin size="small" />}
                                    </div>
                                    <Select
                                        className="w-full"
                                        placeholder={loadingSpecialties ? 'Đang tải chuyên khoa...' : 'Chọn chuyên khoa khám...'}
                                        value={quickWalkInForm.departmentId}
                                        onChange={handleQuickDepartmentChange}
                                        options={(departments || []).map((s) => ({
                                            value: s.id,
                                            label: s.name || s.ten_chuyen_khoa || 'Chuyên khoa',
                                        }))}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="medpro-label !mb-0">
                                        Bác sĩ tiếp nhận khám (kèm buồng khám theo ca trực):
                                    </span>
                                    {loadingQuickDocs && <Spin size="small" />}
                                </div>
                                <Select
                                    className="w-full"
                                    placeholder={
                                        loadingQuickDocs
                                            ? 'Đang tải danh sách bác sĩ...'
                                            : !quickWalkInForm.departmentId
                                              ? 'Chọn chuyên khoa trước'
                                              : quickWalkInDoctors.length === 0
                                                ? 'Khoa này chưa có bác sĩ'
                                                : 'Chọn bác sĩ hoặc để tự động'
                                    }
                                    allowClear
                                    loading={loadingQuickDocs}
                                    disabled={!quickWalkInForm.departmentId || loadingQuickDocs}
                                    value={quickWalkInForm.doctorId || undefined}
                                    onChange={(val) => setQuickWalkInForm({ ...quickWalkInForm, doctorId: val || null })}
                                    options={[
                                        { value: '', label: 'Tự động phân bổ bác sĩ' },
                                        ...quickWalkInDoctors.map((d) => ({
                                            value: d.id,
                                            label: `${formatDoctorName(d.name, d.title)}${d.roomName ? ` — ${d.roomName}` : ''}${d.status === 'ON_LEAVE' ? ' (Nghỉ)' : ''}`,
                                            disabled: d.status === 'ON_LEAVE',
                                        })),
                                    ]}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div>
                                    <span className="medpro-label">
                                        Mức độ ưu tiên <span className="text-clinic-danger">*</span>
                                    </span>
                                    <Select
                                        className="w-full"
                                        value={quickWalkInForm.priority}
                                        onChange={(val) => setQuickWalkInForm({ ...quickWalkInForm, priority: val })}
                                        options={[
                                            { value: 'NORMAL', label: 'Bình thường' },
                                            { value: 'PRIORITY', label: 'Ưu tiên đặc biệt' },
                                        ]}
                                    />
                                </div>
                                {quickWalkInForm.priority === 'PRIORITY' ? (
                                    <div>
                                        <span className="medpro-label">
                                            Diện ưu tiên (Theo quy định) <span className="text-clinic-danger">*</span>
                                        </span>
                                        <Select
                                            className="w-full"
                                            value={quickWalkInForm.priorityReason}
                                            onChange={(val) => setQuickWalkInForm({ ...quickWalkInForm, priorityReason: val })}
                                            options={PRIORITY_REASONS}
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label htmlFor="qw-reason-normal" className="medpro-label">
                                            Lý do khám / Triệu chứng
                                        </label>
                                        <Input
                                            id="qw-reason-normal"
                                            placeholder="Ví dụ: Ho khan, đau đầu, khám định kỳ..."
                                            maxLength={255}
                                            value={quickWalkInForm.reason}
                                            onChange={(e) => setQuickWalkInForm({ ...quickWalkInForm, reason: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>

                            {quickWalkInForm.priority === 'PRIORITY' && (
                                <div>
                                    <label htmlFor="qw-reason-priority" className="medpro-label">
                                        Lý do khám / Triệu chứng
                                    </label>
                                    <Input
                                        id="qw-reason-priority"
                                        placeholder="Ví dụ: Cấp cứu nhẹ, đau bụng dữ dội, người già đi một mình..."
                                        maxLength={255}
                                        value={quickWalkInForm.reason}
                                        onChange={(e) => setQuickWalkInForm({ ...quickWalkInForm, reason: e.target.value })}
                                    />
                                </div>
                            )}

                            <div className="py-1">
                                <Checkbox
                                    checked={quickAutoWaitlist}
                                    onChange={(e) => setQuickAutoWaitlist(e.target.checked)}
                                    className="text-xs text-clinic-warning font-medium"
                                >
                                    Đăng ký Danh sách chờ (Waitlist) nếu bác sĩ đã đủ chỉ tiêu tiếp nhận
                                </Checkbox>
                            </div>

                            <Button
                                type="primary"
                                block
                                icon={<CheckCircleOutlined />}
                                onClick={handleQuickWalkInSubmit}
                                loading={isSubmitting}
                                className="medpro-btn-primary w-full !h-10 text-sm font-bold mt-2"
                            >
                                Cấp STT Khám Nhanh &amp; In Phiếu
                            </Button>
                        </div>
                    </div>
                </div>
            )}

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
