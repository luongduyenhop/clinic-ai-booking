import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import dayjs from 'dayjs'
import {
    Table,
    Input,
    Button,
    Tag,
    Modal,
    Timeline,
    message,
    Tooltip,
    Dropdown,
    Badge,
    Empty,
    Popconfirm,
    DatePicker,
    Segmented,
    Spin,
} from 'antd'
import {
    SearchOutlined,
    ClockCircleOutlined,
    SwapOutlined,
    PlayCircleOutlined,
    CloseCircleOutlined,
    AlertOutlined,
    HistoryOutlined,
    SoundOutlined,
    AudioMutedOutlined,
    PrinterOutlined,
    SyncOutlined,
    AppstoreOutlined,
    MedicineBoxOutlined,
    ClearOutlined,
    PhoneOutlined,
    MoreOutlined,
    UserOutlined,
    CheckCircleOutlined,
    EnvironmentOutlined,
} from '@ant-design/icons'

import {
    callQueueEntryAsync,
    markAbsentAsync,
    resumeQueueEntryAsync,
    fetchFlowBoardAsync,
    fetchDoctorQueueAsync,
    fetchReceptionDataAsync,
    fetchShiftDashboardAsync,
    fetchReceptionWaitlistAsync,
    checkInWaitlistAsync,
    cancelWaitlistAsync,
} from '../../redux/actions/reception/receptionAction'
import { setQueueEntries } from '../../redux/slices/reception/receptionSlice'
import { receptionService } from '../../services/reception/receptionService'
import QueueActionModal from '../../components/reception/QueueActionModal'
import PatientDetailDrawer from '../../components/reception/PatientDetailDrawer'
import EmergencyHandoverModal from '../../components/reception/EmergencyHandoverModal'
import CheckInReceiptModal from '../../components/reception/CheckInReceiptModal'
import { QUEUE_STATUS } from '../../utils/constants/receptionConstants'
import { formatDoctorName } from '../../utils/doctorHelper'
import { audioAnnouncer } from '../../utils/audioAnnouncer'

const getDefaultShift = () => {
    const now = dayjs()
    const hour = now.hour()
    const minute = now.minute()
    if (hour < 12 || (hour === 12 && minute <= 30)) {
        return 'sang'
    }
    return 'chieu'
}

const getQueueTypeTag = (record) => {
    const rawType = String(record.loai_hang_doi || '').toLowerCase().trim()
    if (rawType === 'cap_cuu' || record.isEmergency) {
        return { label: 'Cấp cứu', color: 'red', className: 'font-bold' }
    }
    if (rawType === 'dung_hen') {
        return { label: 'Đúng hẹn', color: 'blue', className: 'font-medium' }
    }
    if (rawType === 'den_som') {
        return { label: 'Đến sớm', color: 'cyan', className: 'font-medium' }
    }
    if (rawType === 'den_muon' || rawType === 'tre_hen') {
        return { label: 'Đến muộn', color: 'volcano', className: 'font-medium' }
    }
    if (rawType === 'co_ket_qua_cls' || rawType === 'sau_cls' || rawType === 'kham_lai' || rawType.includes('cls') || /sau_cls|co_ket_qua|tra_cls|lab return/i.test(record.notes || record.priorityReason || record.patientName || '')) {
        return { label: 'Sau CLS', color: 'geekblue', className: 'font-medium' }
    }
    if (rawType === 'tai_kham' || rawType === 'tai_kham_trong_ngay') {
        return { label: 'Tái khám', color: 'purple', className: 'font-medium' }
    }
    return { label: 'Vãng lai', color: 'orange', className: 'font-medium' }
}

export default function QueueManagementPage() {
    const dispatch = useDispatch()
    const {
        queueEntries = [],
        patients = [],
        rooms = [],
        departments = [],
        doctors = [],
        roomStatus = [],
        roster = [],
        queueLoading = false,
        waitlist = [],
        waitlistLoading = false,
    } = useSelector((state) => state.reception)

    const [activeTab, setActiveTab] = useState('ALL')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedDepartmentTab, setSelectedDepartmentTab] = useState('')
    const [selectedRoomId, setSelectedRoomId] = useState(null)
    const [selectedDate, setSelectedDate] = useState(() => dayjs().format('YYYY-MM-DD'))
    const [selectedShift, setSelectedShift] = useState(() => getDefaultShift())

    const [actionModal, setActionModal] = useState({ open: false, entry: null, mode: 'DEFER' })
    const [historyModal, setHistoryModal] = useState({ open: false, entry: null })
    const [historyLogs, setHistoryLogs] = useState([])
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)
    const [isAudioEnabled, setIsAudioEnabled] = useState(() => audioAnnouncer.isEnabled())
    const [patientDrawerId, setPatientDrawerId] = useState(null)
    const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false)
    const [receiptEntry, setReceiptEntry] = useState(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

    const displayRooms = useMemo(() => {
        const rawRooms = rooms && rooms.length > 0 ? rooms : []

        return rawRooms.map((r) => {
            const statusInfo = (roomStatus || []).find(
                (bs) => bs.phong_kham_id === r.id || bs.ma_phong === r.code
            )
            let doctorId = statusInfo?.bac_si_id || r.doctorId
            let doctorName = statusInfo?.ten_bac_si || r.doctorName

            if (!doctorId && roster && roster.length > 0) {
                const ros = roster.find((x) => x.phong_kham_id === r.id || x.ma_phong_kham === r.code)
                if (ros) {
                    doctorId = ros.bac_si_id
                    doctorName = ros.ten_bac_si
                }
            }

            if (!doctorId && doctors && doctors.length > 0) {
                const doc = doctors.find(
                    (d) =>
                        String(d.roomId) === String(r.id) ||
                        String(d.phong_kham_id) === String(r.id) ||
                        d.room === r.name ||
                        d.room === r.code
                )
                if (doc) {
                    doctorId = doc.id
                    doctorName = doc.name || doc.ho_ten
                }
            }

            return {
                id: r.id,
                code: r.code || r.ma_phong || `PK-${r.id}`,
                name: r.name || r.ten_phong || 'Buồng khám',
                departmentId: r.departmentId || r.chuyen_khoa_id,
                departmentName: r.departmentName || r.ten_chuyen_khoa || statusInfo?.chuyen_khoa || 'Chuyên khoa',
                doctorId: doctorId || null,
                doctorName: doctorName || 'Chưa phân công bác sĩ',
                currentPatient: statusInfo?.benh_nhan_dang_kham || null,
                isOverloaded: statusInfo?.canh_bao_qua_tai || false,
                backendWaiting: statusInfo?.so_benh_nhan_cho ?? null,
                floor: r.floor || r.tang || statusInfo?.tang || 'Tầng 1',
            }
        })
    }, [rooms, roomStatus, roster, doctors])

    const departmentTabs = useMemo(() => {
        const list = []
        const seen = new Set()
        const sourceDepartments = departments || []
        sourceDepartments.forEach((d) => {
            const depId = String(d.id)
            if (!seen.has(depId)) {
                seen.add(depId)
                list.push({
                    id: depId,
                    name: d.name || d.ten_chuyen_khoa,
                    code: d.code || d.prefix,
                })
            }
        })
        list.push({
            id: 'CHUNG',
            name: 'Phòng chung',
            code: 'CHUNG',
        })
        return list
    }, [departments])

    const getRoomsForTab = useCallback((tabId) => {
        if (tabId === 'CHUNG') {
            const knownDepIds = new Set(
                departmentTabs.filter((d) => d.id !== 'CHUNG').map((d) => String(d.id))
            )
            return displayRooms.filter((r) => !r.departmentId || !knownDepIds.has(String(r.departmentId)))
        }
        const dep = departmentTabs.find((d) => d.id === tabId)
        return displayRooms.filter(
            (r) =>
                String(r.departmentId) === String(tabId) ||
                (r.departmentName && dep?.name && r.departmentName.toLowerCase().includes(dep.name.toLowerCase()))
        )
    }, [departmentTabs, displayRooms])


    const displayRoomsRef = useRef(displayRooms)
    const selectedRoomIdRef = useRef(selectedRoomId)

    useEffect(() => {
        displayRoomsRef.current = displayRooms
        selectedRoomIdRef.current = selectedRoomId
    }, [displayRooms, selectedRoomId])

    const refreshQueueData = useCallback(async (roomIdToUse = selectedRoomIdRef.current, dateToUse = selectedDate, shiftToUse = selectedShift) => {
        const params = {
            queryDate: dateToUse || undefined,
            caKham: shiftToUse === 'all' ? undefined : shiftToUse,
        }
        const currentRoom = roomIdToUse ? displayRoomsRef.current.find((r) => String(r.id) === String(roomIdToUse)) : null
        if (currentRoom) {
            if (currentRoom.doctorId) {
                await dispatch(fetchDoctorQueueAsync({ doctorId: currentRoom.doctorId, ...params })).unwrap().catch(() => { })
            } else {
                dispatch(setQueueEntries([]))
            }
        } else {
            await dispatch(fetchFlowBoardAsync(params)).unwrap().catch(() => { })
        }
        dispatch(fetchShiftDashboardAsync(params))
        dispatch(fetchReceptionWaitlistAsync())
    }, [dispatch, selectedDate, selectedShift])

    useEffect(() => {
        const initialShift = getDefaultShift()
        const initialDate = dayjs().format('YYYY-MM-DD')
        const initialParams = {
            queryDate: initialDate,
            caKham: initialShift,
        }
        dispatch(fetchShiftDashboardAsync(initialParams))
        if (!rooms || rooms.length === 0) {
            dispatch(fetchReceptionDataAsync())
        }
    }, [dispatch])

    const prevFilterRef = useRef({ date: selectedDate, shift: selectedShift })
    useEffect(() => {
        if (prevFilterRef.current.date === selectedDate && prevFilterRef.current.shift === selectedShift) {
            return
        }
        prevFilterRef.current = { date: selectedDate, shift: selectedShift }
        refreshQueueData(selectedRoomIdRef.current, selectedDate, selectedShift)
    }, [selectedDate, selectedShift, refreshQueueData])

    const handleRefreshQueue = async () => {
        setIsRefreshing(true)
        try {
            await refreshQueueData(selectedRoomId, selectedDate, selectedShift)
            message.success('Đã đồng bộ hàng đợi thời gian thực!')
        } catch {
            message.info('Đã nạp lại dữ liệu hàng đợi')
        } finally {
            setIsRefreshing(false)
        }
    }

    const hasInitialFocusedRef = useRef(false)

    useEffect(() => {
        if (hasInitialFocusedRef.current) return
        if (displayRooms.length === 0 || departmentTabs.length === 0) return

        const internalDep = departmentTabs.find((d) => /nội/i.test(d.name)) || departmentTabs[0]
        if (!internalDep) return

        const internalRooms = getRoomsForTab(internalDep.id)
        const targetRoom = internalRooms[0] || displayRooms[0]

        if (targetRoom) {
            if (!targetRoom.doctorId) {
                return
            }

            hasInitialFocusedRef.current = true
            setSelectedDepartmentTab(internalDep.id)
            setSelectedRoomId(targetRoom.id)

            const params = {
                queryDate: selectedDate,
                caKham: selectedShift === 'all' ? undefined : selectedShift,
            }
            dispatch(fetchDoctorQueueAsync({ doctorId: targetRoom.doctorId, ...params }))
            dispatch(fetchReceptionWaitlistAsync({
                query_date: selectedDate,
                ca_kham: selectedShift === 'all' ? undefined : selectedShift,
                bac_si_id: targetRoom.doctorId,
            }))
        }
    }, [displayRooms, departmentTabs, getRoomsForTab, dispatch, selectedDate, selectedShift])

    useEffect(() => {
        const timer = setTimeout(() => {
            if (!hasInitialFocusedRef.current && displayRooms.length > 0 && departmentTabs.length > 0) {
                const internalDep = departmentTabs.find((d) => /nội/i.test(d.name)) || departmentTabs[0]
                const internalRooms = internalDep ? getRoomsForTab(internalDep.id) : []
                const targetRoom = internalRooms[0] || displayRooms[0]
                if (targetRoom) {
                    hasInitialFocusedRef.current = true
                    setSelectedDepartmentTab(internalDep?.id || departmentTabs[0].id)
                    setSelectedRoomId(targetRoom.id)
                    const params = {
                        queryDate: selectedDate,
                        caKham: selectedShift === 'all' ? undefined : selectedShift,
                    }
                    if (targetRoom.doctorId) {
                        dispatch(fetchDoctorQueueAsync({ doctorId: targetRoom.doctorId, ...params }))
                    } else {
                        dispatch(setQueueEntries([]))
                    }
                }
            }
        }, 1500)
        return () => clearTimeout(timer)
    }, [displayRooms, departmentTabs, getRoomsForTab, dispatch, selectedDate, selectedShift])

    useEffect(() => {
        if (departmentTabs.length > 0 && selectedDepartmentTab) {
            const exists = departmentTabs.some((d) => d.id === selectedDepartmentTab)
            if (!exists) {
                setSelectedDepartmentTab(departmentTabs[0].id)
            }
        }
    }, [departmentTabs, selectedDepartmentTab])

    const getDepartmentIdFromTicket = (ticket) => {
        if (ticket.departmentId) return ticket.departmentId
        if (ticket.doctorId && doctors.length > 0) {
            const doc = doctors.find((d) => Number(d.id) === Number(ticket.doctorId))
            if (doc?.departmentId) return doc.departmentId
        }
        const code = String(ticket.ticketNumber || ticket.ma_so_thu_tu || '').toUpperCase()
        const prefix = code.split('-')[0]
        if (prefix) {
            const dep = departments.find((d) => d.code?.toUpperCase() === prefix || d.prefix?.toUpperCase() === prefix)
            if (dep?.id) return dep.id
            const depByName = departments.find((d) => {
                const name = (d.name || '').toLowerCase()
                if (prefix === 'TMH' && name.includes('tai mũi họng')) return true
                if (prefix === 'NOI' && name.includes('nội')) return true
                if (prefix === 'NGO' && name.includes('ngoại')) return true
                if (prefix === 'RHM' && name.includes('răng')) return true
                if (prefix === 'MAT' && name.includes('mắt')) return true
                if (prefix === 'CDHA' && (name.includes('chẩn đoán') || name.includes('hình ảnh'))) return true
                if (prefix === 'LAB' && name.includes('xét nghiệm')) return true
                return false
            })
            if (depByName?.id) return depByName.id
        }
        return null
    }

    const isTicketInRoom = (ticket, room) => {
        if (!room) return true

        if (ticket.doctorId && room.doctorId) {
            return Number(ticket.doctorId) === Number(room.doctorId)
        }

        if (ticket.backendRoomId && room.id && Number(ticket.backendRoomId) === Number(room.id)) return true
        if (ticket.roomId && room.id && Number(ticket.roomId) === Number(room.id)) return true

        const roomCode = String(room.code || '').toUpperCase().trim()
        const ticketRoomStr = String(ticket.roomName || ticket.phong_kham || '').toUpperCase().trim()
        if (roomCode && ticketRoomStr && ticketRoomStr.includes(roomCode)) return true

        if (!ticket.doctorId && !room.doctorId && ticket.departmentId && room.departmentId) {
            return Number(ticket.departmentId) === Number(room.departmentId)
        }

        return false
    }

    const roomWaitingCounts = useMemo(() => {
        const counts = {}
        displayRooms.forEach((rm) => {
            if (rm.backendWaiting !== null && rm.backendWaiting !== undefined) {
                counts[rm.id] = rm.backendWaiting
            } else if (rm.doctorId) {
                counts[rm.id] = (queueEntries || []).filter(
                    (q) =>
                        Number(q.doctorId) === Number(rm.doctorId) &&
                        (q.status === 'WAITING' || q.status === 'CHO_KHAM' || q.status === 'cho_kham' || q.status === 'CALLED' || q.status === 'da_goi')
                ).length
            } else {
                counts[rm.id] = 0
            }
        })
        return counts
    }, [displayRooms, queueEntries])

    const totalWaitingCount = useMemo(() => {
        return queueEntries.filter((q) => {
            return (
                q.status === 'WAITING' ||
                q.status === 'CHO_KHAM' ||
                q.status === 'cho_kham' ||
                q.status === 'CALLED' ||
                q.status === 'da_goi'
            )
        }).length
    }, [queueEntries])

    const visibleRooms = useMemo(() => {
        if (!selectedDepartmentTab) return displayRooms
        return getRoomsForTab(selectedDepartmentTab)
    }, [selectedDepartmentTab, getRoomsForTab, displayRooms])


    const getTicketStages = (entry) => {
        if (!entry) return []
        const stages = []
        const roomName = entry.phong_kham || 'Quầy tiếp tân'

        if (entry.thoi_gian_check_in || entry.created_at) {
            stages.push({
                stage: 'TIẾP NHẬN & CẤP SỐ',
                time: dayjs(entry.thoi_gian_check_in || entry.created_at).format('HH:mm (DD/MM)'),
                room: 'Quầy tiếp đón lễ tân',
                color: 'blue',
            })
        }

        if (entry.thoi_gian_xep_hang_lai || entry.rawStatus === 'tam_hoan') {
            stages.push({
                stage: 'TẠM HOÃN & XẾP HÀNG LẠI',
                time: entry.thoi_gian_xep_hang_lai
                    ? dayjs(entry.thoi_gian_xep_hang_lai).format('HH:mm (DD/MM)')
                    : 'Đang tạm hoãn',
                room: roomName,
                color: 'orange',
            })
        }

        if (entry.thoi_gian_goi_kham || (entry.so_lan_goi && entry.so_lan_goi > 0)) {
            stages.push({
                stage: `GỌI VÀO PHÒNG KHÁM (Lần ${entry.so_lan_goi || 1})`,
                time: entry.thoi_gian_goi_kham
                    ? dayjs(entry.thoi_gian_goi_kham).format('HH:mm (DD/MM)')
                    : 'Đã phát loa gọi',
                room: roomName,
                color: 'green',
            })
        }

        if (entry.thoi_gian_bat_dau || entry.rawStatus === 'dang_kham') {
            stages.push({
                stage: 'BÁC SĨ KHÁM LÂM SÀNG',
                time: entry.thoi_gian_bat_dau
                    ? dayjs(entry.thoi_gian_bat_dau).format('HH:mm (DD/MM)')
                    : 'Đang khám',
                room: roomName,
                color: 'cyan',
            })
        }

        if (entry.rawStatus === 'bo_kham') {
            stages.push({
                stage: 'BỆNH NHÂN BỎ KHÁM',
                time: entry.thoi_gian_ket_thuc
                    ? dayjs(entry.thoi_gian_ket_thuc).format('HH:mm (DD/MM)')
                    : 'Đã hủy lượt khám',
                room: roomName,
                color: 'red',
            })
        } else if (entry.thoi_gian_ket_thuc || entry.rawStatus === 'da_kham' || entry.rawStatus === 'da_dong_ve') {
            stages.push({
                stage: 'HOÀN TẤT KHÁM & ĐÓNG VÉ',
                time: entry.thoi_gian_ket_thuc
                    ? dayjs(entry.thoi_gian_ket_thuc).format('HH:mm (DD/MM)')
                    : 'Đã hoàn tất',
                room: roomName,
                color: 'purple',
            })
        }

        return stages
    }

    const handleOpenHistoryModal = async (record) => {
        setHistoryModal({ open: true, entry: record })
        setHistoryLogs([])
        setIsLoadingHistory(true)
        try {
            const ticketNum = record.ticketNumber || record.ma_so_thu_tu || ''
            const res = await receptionService.getAuditLogs({
                query_date: selectedDate,
                search: ticketNum,
                page_size: 50,
            })
            const data = res?.data?.data || res?.data || {}
            const items = data.items || []
            const filtered = items.filter(
                (item) =>
                    item.ticket_number === ticketNum ||
                    String(item.metadata?.ticket_id) === String(record.id)
            )
            setHistoryLogs(filtered)
        } catch (err) {
            console.error('Không thể nạp nhật ký kiểm toán:', err)
            setHistoryLogs([])
        } finally {
            setIsLoadingHistory(false)
        }
    }

    const handleSelectRoom = async (room) => {
        const nextRoomId = selectedRoomId === room?.id ? null : room.id
        setSelectedRoomId(nextRoomId)
        await refreshQueueData(nextRoomId, selectedDate, selectedShift)
    }

    const handleSelectAllRooms = async () => {
        setSelectedRoomId(null)
        await refreshQueueData(null, selectedDate, selectedShift)
    }

    const getQueueTier = (entry) => {
        const noteStr = String(entry.priorityReason || entry.notes || entry.ghi_chu_dieu_phoi || '')
        const isEmerg = entry.isEmergency || entry.priority === 'EMERGENCY' || /cấp cứu|cap_cuu/i.test(noteStr)
        if (isEmerg) return 1

        const isPrio = entry.priority === 'PRIORITY' || entry.isSpecialPriority || entry.muc_do_uu_tien === 1 || /ưu tiên|nguoi_gia|thai_phu|tre_so_sinh/i.test(noteStr)
        if (isPrio) return 2

        if (entry.status === 'RETURN_AFTER_RESULT' || entry.trang_thai === 'co_ket_qua_cls' || entry.muc_do_uu_tien === 3) return 3
        if (!entry.isWalkIn && entry.appointmentId) return 4
        return 5
    }

    const filteredQueue = useMemo(() => {
        return queueEntries.filter((q) => {
            const pat = patients.find((p) => p.id === q.patientId)
            const ticketStr = String(q.ma_so_thu_tu || q.ticketNumber || '')
            const patName = String(q.patientName || pat?.fullName || '')
            const patPhone = String(q.phone || pat?.phone || '')

            const matchesQuery =
                !searchQuery ||
                ticketStr.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                patName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                patPhone.includes(searchQuery.trim())

            let matchesShift = true
            if (selectedShift !== 'all' && q.ca_kham) {
                matchesShift = q.ca_kham.toLowerCase() === selectedShift.toLowerCase()
            }

            let matchesDate = true
            if (selectedDate && q.ngay_kham) {
                matchesDate = q.ngay_kham === selectedDate
            }

            let matchesScope = true
            if (selectedRoomId !== null) {
                const currentRoom = displayRooms.find((r) => r.id === selectedRoomId)
                matchesScope = isTicketInRoom(q, currentRoom)
            } else if (selectedDepartmentTab) {
                matchesScope = visibleRooms.some((rm) => isTicketInRoom(q, rm))
            }

            let matchesTab = true
            if (activeTab === 'WAITING') {
                matchesTab =
                    q.status === 'WAITING' ||
                    q.status === 'CHO_KHAM' ||
                    q.status === 'cho_kham' ||
                    q.status === 'CALLED' ||
                    q.status === 'da_goi'
            } else if (activeTab === 'IN_CONSULTATION') {
                matchesTab = q.status === 'IN_CONSULTATION' || q.status === 'DANG_KHAM' || q.status === 'dang_kham'
            } else if (activeTab === 'DEFERRED') {
                matchesTab = q.status === 'DEFERRED' || q.status === 'TAM_HOAN' || q.status === 'tam_hoan'
            } else if (activeTab === 'COMPLETED') {
                matchesTab =
                    q.status === 'COMPLETED' ||
                    q.status === 'DA_KHAM' ||
                    q.status === 'da_kham' ||
                    q.status === 'BO_KHAM' ||
                    q.status === 'bo_kham' ||
                    q.status === 'da_dong_ve' ||
                    q.status === 'DA_DONG_VE'
            }

            return matchesQuery && matchesShift && matchesDate && matchesScope && matchesTab
        })
    }, [queueEntries, patients, searchQuery, selectedShift, selectedDate, selectedRoomId, selectedDepartmentTab, displayRooms, visibleRooms, activeTab])

    const sortedQueue = filteredQueue

    const tabCounts = useMemo(() => {
        let baseList = queueEntries
        if (selectedShift !== 'all') {
            baseList = baseList.filter((q) => !q.ca_kham || q.ca_kham.toLowerCase() === selectedShift.toLowerCase())
        }
        if (selectedDate) {
            baseList = baseList.filter((q) => !q.ngay_kham || q.ngay_kham === selectedDate)
        }
        if (selectedRoomId !== null) {
            const currentRoom = displayRooms.find((r) => r.id === selectedRoomId)
            baseList = baseList.filter((q) => isTicketInRoom(q, currentRoom))
        } else if (selectedDepartmentTab) {
            baseList = baseList.filter((q) => visibleRooms.some((rm) => isTicketInRoom(q, rm)))
        }

        const waitlistInScope = waitlist.filter((w) => {
            if (selectedRoomId !== null) {
                const currentRoom = displayRooms.find((r) => r.id === selectedRoomId)
                if (currentRoom) {
                    return (
                        (w.phong_kham_id && Number(w.phong_kham_id) === Number(currentRoom.id)) ||
                        (w.bac_si_id && currentRoom.doctorId && Number(w.bac_si_id) === Number(currentRoom.doctorId)) ||
                        (!w.bac_si_id && currentRoom.departmentId && Number(w.chuyen_khoa_id) === Number(currentRoom.departmentId))
                    )
                }
                return false
            }
            if (selectedDepartmentTab === 'CHUNG') {
                return !w.chuyen_khoa_id
            }
            if (selectedDepartmentTab) {
                return String(w.chuyen_khoa_id) === String(selectedDepartmentTab)
            }
            return true
        })

        return {
            ALL: baseList.length,
            WAITING: baseList.filter((q) =>
                q.status === 'WAITING' || q.status === 'CHO_KHAM' || q.status === 'cho_kham' || q.status === 'CALLED' || q.status === 'da_goi'
            ).length,
            IN_CONSULTATION: baseList.filter((q) =>
                q.status === 'IN_CONSULTATION' || q.status === 'DANG_KHAM' || q.status === 'dang_kham'
            ).length,
            DEFERRED: baseList.filter((q) =>
                q.status === 'DEFERRED' || q.status === 'TAM_HOAN' || q.status === 'tam_hoan'
            ).length,
            COMPLETED: baseList.filter((q) =>
                q.status === 'COMPLETED' || q.status === 'DA_KHAM' || q.status === 'da_kham' || q.status === 'BO_KHAM' || q.status === 'bo_kham' || q.status === 'da_dong_ve' || q.status === 'DA_DONG_VE'
            ).length,
            WAITLIST: waitlistInScope.length,
        }
    }, [queueEntries, selectedShift, selectedDate, selectedRoomId, displayRooms, selectedDepartmentTab, visibleRooms, waitlist])

    useEffect(() => {
        if (activeTab === 'WAITLIST') {
            dispatch(fetchReceptionWaitlistAsync())
        }
    }, [activeTab, dispatch])

    const handleCallNumber = async (record) => {
        try {
            const targetId = record.backendId || record.id
            await dispatch(callQueueEntryAsync({ queueId: targetId })).unwrap()
            message.success(`Đã gọi số vé ${record.ticketNumber || record.ma_so_thu_tu}`)

            const pName = record.patientName || record.ten_benh_nhan || 'Bệnh nhân'
            const tNum = record.ticketNumber || record.ma_so_thu_tu || ''
            const rName = record.phong_kham || selectedRoomObj?.name || 'phòng khám'
            audioAnnouncer.announcePatient(pName, tNum, rName)
            await reloadQueueAfterAction(record)
        } catch (e) {
            message.info(`Đang gọi số vé ${record.ticketNumber || record.ma_so_thu_tu}`)
        }
    }

    const reloadQueueAfterAction = async (record) => {
        const currentRoom = selectedRoomId ? displayRooms.find((r) => String(r.id) === String(selectedRoomId)) : null
        const docId = record?.doctorId || currentRoom?.doctorId || 1
        const params = {
            queryDate: selectedDate,
            caKham: selectedShift === 'all' ? undefined : selectedShift,
        }
        if (docId) {
            await dispatch(fetchDoctorQueueAsync({ doctorId: docId, ...params })).unwrap().catch(() => {})
        } else {
            await dispatch(fetchFlowBoardAsync(params)).unwrap().catch(() => {})
        }
        dispatch(fetchShiftDashboardAsync(params))
        dispatch(fetchReceptionWaitlistAsync())
    }

    const handleResume = async (record) => {
        try {
            const targetId = record.backendId || record.id
            const currentRoom = selectedRoomId ? displayRooms.find((r) => String(r.id) === String(selectedRoomId)) : null
            const docId = record?.doctorId || currentRoom?.doctorId || 1
            await dispatch(
                resumeQueueEntryAsync({
                    queueId: targetId,
                    doctorId: docId,
                    queryDate: selectedDate,
                    caKham: selectedShift === 'all' ? undefined : selectedShift,
                })
            ).unwrap()
            message.success(`Đã khôi phục số vé ${record.ticketNumber || record.ma_so_thu_tu} vào hàng chờ`)
            await refreshQueueData(selectedRoomIdRef.current || currentRoom?.id, selectedDate, selectedShift)
        } catch {
            message.info(`Đã tiếp nhận lại lượt khám`)
        }
    }

    const handleMarkAbsent = async (record) => {
        try {
            const targetId = record.backendId || record.id
            const currentRoom = selectedRoomId ? displayRooms.find((r) => String(r.id) === String(selectedRoomId)) : null
            const docId = record?.doctorId || currentRoom?.doctorId || 1
            await dispatch(
                markAbsentAsync({
                    queueId: targetId,
                    doctorId: docId,
                    queryDate: selectedDate,
                    caKham: selectedShift === 'all' ? undefined : selectedShift,
                })
            ).unwrap()
            message.warning(`Đã đánh dấu vắng mặt cho số vé ${record.ticketNumber || record.ma_so_thu_tu}`)
            await refreshQueueData(selectedRoomIdRef.current || currentRoom?.id, selectedDate, selectedShift)
        } catch {
            message.info('Đã cập nhật trạng thái vắng mặt')
        }
    }

    const handleCheckInWaitlist = async (waitlistId) => {
        try {
            const ticket = await dispatch(checkInWaitlistAsync({ waitlistId })).unwrap()
            message.success(`Đã tiếp nhận bệnh nhân vào hàng đợi! Số thứ tự: ${ticket.ma_so_thu_tu || ticket.ticketNumber || '01'}`)
            setReceiptEntry(ticket)
        } catch (err) {
            message.error(err || 'Không thể tiếp nhận bệnh nhân từ danh sách chờ')
        }
    }

    const handleCancelWaitlist = async (waitlistId) => {
        try {
            await dispatch(cancelWaitlistAsync({ waitlistId })).unwrap()
            message.success('Đã hủy lượt trong danh sách chờ')
        } catch (err) {
            message.error(err || 'Không thể hủy lượt chờ')
        }
    }

    const filteredWaitlist = useMemo(() => {
        let list = [...waitlist]
        if (selectedRoomId !== null) {
            const currentRoom = displayRooms.find((r) => r.id === selectedRoomId)
            if (currentRoom) {
                list = list.filter((w) =>
                    (w.phong_kham_id && Number(w.phong_kham_id) === Number(currentRoom.id)) ||
                    (w.bac_si_id && currentRoom.doctorId && Number(w.bac_si_id) === Number(currentRoom.doctorId)) ||
                    (!w.bac_si_id && currentRoom.departmentId && Number(w.chuyen_khoa_id) === Number(currentRoom.departmentId))
                )
            }
        } else if (selectedDepartmentTab === 'CHUNG') {
            list = list.filter((w) => !w.chuyen_khoa_id)
        } else if (selectedDepartmentTab) {
            list = list.filter((w) => String(w.chuyen_khoa_id) === String(selectedDepartmentTab))
        }
        if (searchQuery.trim()) {
            const kw = searchQuery.trim().toLowerCase()
            list = list.filter(
                (w) =>
                    (w.ten_benh_nhan && w.ten_benh_nhan.toLowerCase().includes(kw)) ||
                    (w.so_dien_thoai && w.so_dien_thoai.includes(kw)) ||
                    (w.ten_chuyen_khoa && w.ten_chuyen_khoa.toLowerCase().includes(kw)) ||
                    (w.ten_bac_si && w.ten_bac_si.toLowerCase().includes(kw)) ||
                    `wait-${w.id}`.includes(kw)
            )
        }
        return list
    }, [waitlist, selectedRoomId, displayRooms, selectedDepartmentTab, searchQuery])

    const waitlistColumns = [
        {
            title: 'STT Chờ',
            key: 'stt',
            width: 130,
            render: (_, record, idx) => (
                <div className="flex items-center gap-1.5">
                    <Tag color="gold" className="font-mono font-bold text-xs m-0">
                        #{record.thu_tu_uu_tien || idx + 1}
                    </Tag>
                    <span className="font-mono font-bold text-sky-800 text-xs">WAIT-{String(record.id).padStart(2, '0')}</span>
                </div>
            ),
        },
        {
            title: 'Họ và tên người bệnh',
            key: 'patient',
            render: (_, record) => (
                <div>
                    <div className="font-bold text-slate-900 text-xs">{record.ten_benh_nhan}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span><PhoneOutlined /> {record.so_dien_thoai || 'N/A'}</span>
                        <span>•</span>
                        <span>{record.gioi_tinh || 'Khác'}</span>
                        {record.nam_sinh && <span>({record.nam_sinh})</span>}
                    </div>
                </div>
            ),
        },
        {
            title: 'Chuyên khoa & Bác sĩ chỉ định',
            key: 'doctor',
            render: (_, record) => (
                <div>
                    <div className="font-semibold text-slate-800 text-xs">{record.ten_chuyen_khoa || 'Chuyên khoa chung'}</div>
                    <div className="text-[11px] mt-0.5">
                        {record.co_bac_si_chi_dinh && record.ten_bac_si ? (
                            <span className="text-sky-700 font-medium">{formatDoctorName(record.ten_bac_si)}</span>
                        ) : (
                            <Tag color="cyan" className="text-[10px] m-0">
                                ⚡ Tự động phân bổ (ít chờ nhất)
                            </Tag>
                        )}
                    </div>
                </div>
            ),
        },
        {
            title: 'Buồng khám dự kiến',
            key: 'room',
            render: (_, record) => (
                <span className="text-xs text-slate-700 font-medium">
                    {record.ten_phong || 'Theo phân bổ tối ưu'}
                </span>
            ),
        },
        {
            title: 'Thời gian đăng ký',
            key: 'time',
            width: 140,
            render: (_, record) => (
                <div className="text-xs text-slate-600">
                    <div>{record.thoi_gian_dang_ky ? dayjs(record.thoi_gian_dang_ky).format('HH:mm') : 'N/A'}</div>
                    <div className="text-[10px] text-slate-400">{record.thoi_gian_dang_ky ? dayjs(record.thoi_gian_dang_ky).format('DD/MM/YYYY') : ''}</div>
                </div>
            ),
        },
        {
            title: 'Trạng thái',
            key: 'status',
            width: 170,
            render: (_, record) => {
                if (record.trang_thai === 'da_thong_bao') {
                    return (
                        <Tag color="green" className="font-bold text-[11px] m-0">
                            Đang giữ slot (còn {record.con_han_giu_slot ? '30p' : 'hết hạn'})
                        </Tag>
                    )
                }
                return (
                    <Tag color="orange" className="font-bold text-[11px] m-0">
                        Đang chờ slot trống
                    </Tag>
                )
            },
        },
        {
            title: 'Thao tác tiếp nhận',
            key: 'actions',
            width: 230,
            render: (_, record) => (
                <div className="flex items-center gap-2">
                    <Button
                        type="primary"
                        size="small"
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleCheckInWaitlist(record.id)}
                        className="medpro-btn-primary font-bold text-xs"
                    >
                        Tiếp nhận vào khám
                    </Button>
                    <Popconfirm
                        title="Hủy lượt chờ?"
                        description="Xác nhận hủy lượt của bệnh nhân khỏi danh sách chờ?"
                        onConfirm={() => handleCancelWaitlist(record.id)}
                        okText="Xác nhận"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Button size="small" danger className="text-xs font-semibold">
                            Hủy chờ
                        </Button>
                    </Popconfirm>
                </div>
            ),
        },
    ]

    const handleResetAllFilters = () => {
        setSelectedRoomId(null)
        setSelectedDepartmentTab(departmentTabs[0]?.id || '')
        setActiveTab('ALL')
        setSearchQuery('')
        setSelectedDate(dayjs().format('YYYY-MM-DD'))
        setSelectedShift(getDefaultShift())
        refreshQueueData(null, dayjs().format('YYYY-MM-DD'), getDefaultShift())
    }

    const columns = [
        {
            title: 'STT & Mã Buồng',
            dataIndex: 'ticketNumber',
            key: 'ticketNumber',
            width: 155,
            render: (ticket, record) => {
                const num = record.ticketNumber || record.ma_so_thu_tu || '01'
                const isLevel1 = record.muc_do_uu_tien === 1 || record.isEmergency || /cấp cứu|cap_cuu/i.test(record.priorityReason || record.notes || '')
                const queueTag = getQueueTypeTag(record)

                return (
                    <div className="flex flex-col gap-1 items-start">
                        <span className="text-base font-black text-sky-700 tracking-tight font-mono">
                            {num}
                        </span>
                        <div className="flex flex-wrap items-center gap-1">
                            {isLevel1 && (
                                <Tag color="purple" className="m-0 text-[10px] font-bold">
                                    Ưu tiên
                                </Tag>
                            )}

                            {queueTag && (
                                <Tag color={queueTag.color} className={`m-0 text-[10px] ${queueTag.className || ''}`}>
                                    {queueTag.label}
                                </Tag>
                            )}

                            {record.muc_do_uu_tien === 4 && Boolean(record.thoi_gian_xep_hang_lai) && (
                                <Tag color="warning" className="m-0 text-[10px] font-medium">
                                    Đã xếp hàng lại
                                </Tag>
                            )}
                        </div>
                    </div>
                )
            },
        },
        {
            title: 'Bệnh nhân',
            key: 'patient',
            width: 220,
            render: (_, record) => {
                const pat = patients.find((p) => p.id === record.patientId)
                const pName = record.patientName || pat?.fullName || 'Bệnh nhân'
                const pPhone = record.phone || pat?.phone || ''
                const pCode = pat?.patientCode || (record.patientId ? `BN-${record.patientId}` : '')
                return (
                    <div>
                        <button
                            type="button"
                            onClick={() => setPatientDrawerId(record.patientId)}
                            className="font-bold text-slate-900 hover:text-sky-600 hover:underline text-left cursor-pointer block"
                        >
                            {pName}
                        </button>
                        <div className="text-slate-400 text-xs flex items-center gap-1.5 mt-0.5">
                            {pPhone && (
                                <span className="inline-flex items-center gap-0.5">
                                    <PhoneOutlined className="text-[10px]" />
                                    {pPhone}
                                </span>
                            )}
                            {pPhone && pCode && <span>•</span>}
                            {pCode && <span className="font-mono text-slate-500">{pCode}</span>}
                        </div>
                    </div>
                )
            },
        },
        {
            title: 'Buồng khám & Bác sĩ',
            key: 'room_doctor',
            width: 240,
            render: (_, record) => {
                const roomName = record.roomName || record.phong_kham || 'Buồng khám chung'
                const doctorName = record.doctorName || 'Bác sĩ trực buồng'
                return (
                    <div>
                        <div className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                            <MedicineBoxOutlined className="text-sky-600 shrink-0" />
                            <span className="truncate">{roomName}</span>
                        </div>
                        <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                            <UserOutlined className="text-[11px] text-slate-400 shrink-0" />
                            <span className="truncate">{doctorName}</span>
                        </div>
                    </div>
                )
            },
        },
        {
            title: 'Thời gian & Chờ',
            key: 'time_wait',
            width: 170,
            render: (_, record) => {
                const statusStr = String(record.status || '').toLowerCase()
                const isWaiting = statusStr === 'waiting' || statusStr === 'dang_cho' || statusStr === 'cho_kham'
                const isOverdue = record.waitTimeMinutes > 60
                const isWarn = record.waitTimeMinutes > 30 && !isOverdue
                return (
                    <div>
                        <div className="text-slate-600 text-xs flex items-center gap-1">
                            <ClockCircleOutlined className="text-[11px] text-slate-400" />
                            <span>Check-in: <strong>{record.checkInTime || '--:--'}</strong></span>
                        </div>
                        {isWaiting && (
                            <div className="mt-1">
                                <span
                                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md inline-block ${isOverdue
                                            ? 'bg-rose-100 text-rose-700 font-bold'
                                            : isWarn
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-slate-100 text-slate-600'
                                        }`}
                                >
                                    Đã chờ {record.waitTimeMinutes || 0} phút
                                </span>
                            </div>
                        )}
                    </div>
                )
            },
        },
        {
            title: 'Trạng thái & Lần gọi',
            key: 'status',
            width: 170,
            render: (_, record) => {
                const statusStr = String(record.status || '').toLowerCase()
                const isDeferred = statusStr === 'deferred' || statusStr === 'tam_hoan'
                const isInConsult = statusStr === 'in_consultation' || statusStr === 'dang_kham'
                const isDone = statusStr === 'completed' || statusStr === 'da_kham'
                const isAbsent = statusStr === 'bo_kham'
                const isClosed = statusStr === 'da_dong_ve' || statusStr === 'cancelled'
                const isCalled = record.callCount > 0

                return (
                    <div>
                        <div>
                            {isInConsult ? (
                                <Tag color="processing" className="font-bold">Đang khám</Tag>
                            ) : isDeferred ? (
                                <Tag color="warning" className="font-bold">Tạm hoãn</Tag>
                            ) : isDone ? (
                                <Tag color="success">Đã khám</Tag>
                            ) : isAbsent ? (
                                <Tag color="default" className="text-slate-600 font-semibold bg-slate-100 border-slate-300">Vắng mặt</Tag>
                            ) : isClosed ? (
                                <Tag color="error" className="font-semibold">Đã đóng / Hủy</Tag>
                            ) : isCalled ? (
                                <Tag color="cyan">Đã gọi ({record.callCount})</Tag>
                            ) : (
                                <Tag color="blue">Đang chờ</Tag>
                            )}
                        </div>
                        {record.callCount > 0 && !isDone && !isAbsent && !isClosed && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                                Đã gọi {record.callCount} lần
                            </div>
                        )}
                    </div>
                )
            },
        },
        {
            title: 'Thao tác điều phối',
            key: 'actions',
            align: 'right',
            width: 210,
            render: (_, record) => {
                const statusStr = String(record.status || '').toLowerCase()
                const isInConsult = statusStr === 'in_consultation' || statusStr === 'dang_kham'
                const isDeferred = statusStr === 'deferred' || statusStr === 'tam_hoan'
                const isDone = statusStr === 'completed' || statusStr === 'da_kham'
                const isAbsent = statusStr === 'bo_kham'
                const isClosed = statusStr === 'da_dong_ve' || statusStr === 'cancelled'
                const isTerminal = isDone || isAbsent || isClosed

                const menuItems = [
                    {
                        key: 'history',
                        label: 'Lịch sử chặng & thao tác',
                        icon: <HistoryOutlined />,
                        onClick: () => handleOpenHistoryModal(record),
                    },
                    {
                        key: 'print',
                        label: 'Xem & In phiếu nhiệt mini (80mm)',
                        icon: <PrinterOutlined />,
                        onClick: () => setReceiptEntry(record),
                    },
                    {
                        type: 'divider',
                    },
                    {
                        key: 'defer',
                        label: 'Tạm hoãn lượt khám',
                        icon: <ClockCircleOutlined />,
                        disabled: isInConsult || isTerminal || isDeferred,
                        onClick: () => setActionModal({ open: true, entry: record, mode: 'DEFER' }),
                    },
                    {
                        key: 'absent',
                        label: 'Bệnh nhân vắng mặt',
                        icon: <CloseCircleOutlined />,
                        disabled: isInConsult || isTerminal,
                        onClick: () => handleMarkAbsent(record),
                    },
                    {
                        key: 'cancel',
                        label: 'Hủy lượt khám',
                        icon: <CloseCircleOutlined />,
                        danger: true,
                        disabled: isInConsult || isTerminal,
                        onClick: () => setActionModal({ open: true, entry: record, mode: 'CANCEL' }),
                    },
                ]

                return (
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {isDeferred ? (
                            <Button
                                size="small"
                                type="primary"
                                className="medpro-btn-primary text-xs font-bold"
                                icon={<PlayCircleOutlined />}
                                onClick={() => handleResume(record)}
                            >
                                Tiếp tục
                            </Button>
                        ) : !isTerminal ? (
                            <Button
                                size="small"
                                type="primary"
                                icon={<SoundOutlined />}
                                className="medpro-btn-primary text-xs font-bold"
                                onClick={() => handleCallNumber(record)}
                            >
                                {record.callCount > 0 ? `Gọi lại (${record.callCount})` : 'Gọi số'}
                            </Button>
                        ) : null}

                        <Tooltip title="Xem & In phiếu nhiệt STT (80mm)">
                            <Button
                                size="small"
                                icon={<PrinterOutlined />}
                                className="text-xs text-sky-700"
                                onClick={() => setReceiptEntry(record)}
                            />
                        </Tooltip>

                        {!isInConsult && !isTerminal && (
                            <Button
                                size="small"
                                icon={<SwapOutlined />}
                                className="text-xs"
                                onClick={() => setActionModal({ open: true, entry: record, mode: 'TRANSFER' })}
                                title="Chuyển buồng"
                            >
                                Chuyển
                            </Button>
                        )}

                        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                            <Button size="small" icon={<MoreOutlined />} className="text-xs text-slate-500" />
                        </Dropdown>
                    </div>
                )
            },
        },
    ]

    const selectedRoomObj = displayRooms.find((r) => r.id === selectedRoomId)

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 medpro-card p-4">
                <div>
                    <h2 className="text-sm font-extrabold text-[#003553] uppercase tracking-wide flex items-center gap-2">
                        <span>Điều phối hàng đợi phòng khám</span>
                        <Badge
                            count={totalWaitingCount}
                            overflowCount={99}
                            style={{ backgroundColor: '#00B5F1' }}
                        />
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Theo dõi luân chuyển người bệnh theo thời gian thực tại các buồng khám chuyên khoa
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="middle"
                        danger
                        icon={<AlertOutlined />}
                        onClick={() => setIsEmergencyModalOpen(true)}
                        className="font-bold text-xs rounded-full"
                    >
                        Bàn giao cấp cứu
                    </Button>
                    <Button
                        size="middle"
                        icon={<SyncOutlined spin={isRefreshing} />}
                        onClick={handleRefreshQueue}
                        className="medpro-btn-outline font-bold text-xs !h-8 !px-3"
                    >
                        Đồng bộ hàng đợi
                    </Button>
                </div>
            </div>

            <div className="medpro-card p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#E2EDF5] pb-2.5">
                    <div className="flex items-center gap-2">
                        <MedicineBoxOutlined className="text-[#00B5F1] text-sm" />
                        <h3 className="text-xs font-bold text-[#003553] uppercase tracking-wider">
                            Buồng khám theo chuyên khoa & Bác sĩ trực
                        </h3>
                    </div>
                    {selectedRoomId !== null && (
                        <button
                            type="button"
                            onClick={handleSelectAllRooms}
                            className="text-xs text-[#00B5F1] hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                            <ClearOutlined /> Xem toàn bộ buồng khám
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    {departmentTabs.map((dep) => {
                        const isDepActive = selectedDepartmentTab === dep.id
                        const depRooms = getRoomsForTab(dep.id)
                        const depWaitingTotal = depRooms.reduce((acc, rm) => acc + (roomWaitingCounts[rm.id] || 0), 0)

                        return (
                            <button
                                type="button"
                                key={dep.id}
                                onClick={() => {
                                    setSelectedDepartmentTab(dep.id)
                                    if (selectedRoomId) {
                                        const r = displayRooms.find((x) => x.id === selectedRoomId)
                                        if (r && !depRooms.some((rm) => rm.id === r.id)) {
                                            handleSelectAllRooms()
                                        }
                                    }
                                }}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${isDepActive
                                        ? 'bg-slate-800 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                                    }`}
                            >
                                <span>{dep.name}</span>
                                <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isDepActive
                                            ? 'bg-sky-500 text-white'
                                            : depWaitingTotal > 0
                                                ? 'bg-sky-100 text-sky-700'
                                                : 'bg-slate-200 text-slate-500'
                                        }`}
                                >
                                    {depWaitingTotal}
                                </span>
                            </button>
                        )
                    })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pt-1">
                    {visibleRooms.map((rm) => {
                        const isSelected = selectedRoomId === rm.id
                        const waitingCount = roomWaitingCounts[rm.id] || 0
                        const isOverload = waitingCount >= 10

                        return (
                            <button
                                type="button"
                                key={rm.id}
                                onClick={() => handleSelectRoom(rm)}
                                title={`${rm.name} - ${rm.doctorName}`}
                                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between relative group ${isSelected
                                        ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-200 shadow-xs'
                                        : isOverload
                                            ? 'border-rose-300 bg-rose-50/60 hover:bg-rose-50'
                                            : 'border-slate-200 bg-white hover:border-sky-300 hover:shadow-2xs'
                                    }`}
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 group-hover:bg-sky-100 group-hover:text-sky-800">
                                            {rm.code}
                                        </span>
                                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                            <EnvironmentOutlined className="text-[10px]" />
                                            {rm.floor}
                                        </span>
                                    </div>

                                    <div className="text-xs font-bold text-slate-800 line-clamp-1 leading-snug">
                                        {rm.name}
                                    </div>

                                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 line-clamp-1">
                                        <UserOutlined className="text-[10px] text-sky-600 shrink-0" />
                                        <span className="font-medium text-slate-700">{rm.doctorName}</span>
                                    </div>

                                    {rm.currentPatient && (
                                        <div className="mt-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1 line-clamp-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                            <span>Đang khám: {rm.currentPatient}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-slate-100">
                                    <span className="text-[11px] text-slate-400 font-medium">Đang chờ:</span>
                                    <div className="flex items-baseline gap-1">
                                        <span
                                            className={`text-lg font-black ${isOverload
                                                    ? 'text-rose-600'
                                                    : waitingCount > 0
                                                        ? 'text-sky-700'
                                                        : 'text-slate-400'
                                                }`}
                                        >
                                            {waitingCount}
                                        </span>
                                        <span className="text-[10px] text-slate-400">người</span>
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="medpro-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2EDF5] pb-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setActiveTab('ALL')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'ALL'
                                    ? 'bg-[#00B5F1] text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            Tất cả ({tabCounts.ALL})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('WAITING')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'WAITING'
                                    ? 'bg-[#00B5F1] text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            Đang chờ ({tabCounts.WAITING})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('IN_CONSULTATION')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'IN_CONSULTATION'
                                    ? 'bg-[#00B5F1] text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            Đang khám ({tabCounts.IN_CONSULTATION})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('DEFERRED')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'DEFERRED'
                                    ? 'bg-[#00B5F1] text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            Tạm hoãn ({tabCounts.DEFERRED})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('COMPLETED')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'COMPLETED'
                                    ? 'bg-[#00B5F1] text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            Hoàn tất ({tabCounts.COMPLETED})
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('WAITLIST')
                                dispatch(fetchReceptionWaitlistAsync())
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'WAITLIST'
                                    ? 'bg-[#FFB54A] text-[#003553] shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            Danh sách chờ (Waitlist) ({tabCounts.WAITLIST || 0})
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <DatePicker
                            value={selectedDate ? dayjs(selectedDate) : dayjs()}
                            onChange={(d) => {
                                const val = d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
                                setSelectedDate(val)
                            }}
                            format="DD/MM/YYYY"
                            allowClear={false}
                            className="w-32 text-xs rounded-xl"
                        />
                        <Segmented
                            value={selectedShift}
                            onChange={(val) => setSelectedShift(val)}
                            options={[
                                { label: 'Tất cả ca', value: 'all' },
                                { label: 'Ca sáng', value: 'sang' },
                                { label: 'Ca chiều', value: 'chieu' },
                            ]}
                            className="text-xs bg-slate-100 p-0.5 rounded-xl font-medium"
                        />
                        <Input
                            placeholder="Số vé (A101, TMH-01), tên BN, SĐT..."
                            prefix={<SearchOutlined className="text-slate-400" />}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            allowClear
                            className="w-64 text-xs rounded-xl"
                        />

                    </div>
                </div>

                {selectedRoomObj ? (
                    <div className="bg-sky-50/80 border border-sky-200 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs text-sky-900 shadow-2xs">
                        <div className="flex items-center gap-2">
                            <MedicineBoxOutlined className="text-sky-600 font-bold text-sm" />
                            <span>
                                Đang lọc theo buồng khám: <strong>{selectedRoomObj.name} ({selectedRoomObj.code})</strong> — Bác sĩ phụ trách: <strong>{selectedRoomObj.doctorName}</strong> — Có{' '}
                                <strong>{sortedQueue.length}</strong> lượt khám
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleSelectAllRooms}
                            className="text-sky-700 hover:text-sky-900 font-semibold underline cursor-pointer"
                        >
                            Bỏ lọc buồng (Xem tất cả)
                        </button>
                    </div>
                ) : selectedDepartmentTab ? (
                    <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl flex items-center justify-between text-xs text-slate-700 shadow-2xs">
                        <div className="flex items-center gap-2">
                            <AppstoreOutlined className="text-slate-500 font-bold text-sm" />
                            <span>
                                Đang xem: <strong>{departmentTabs.find((d) => d.id === selectedDepartmentTab)?.name}</strong> — Có{' '}
                                <strong>{sortedQueue.length}</strong> lượt khám
                            </span>
                        </div>
                    </div>
                ) : null}

                {activeTab === 'WAITLIST' ? (
                    <Table
                        columns={waitlistColumns}
                        dataSource={filteredWaitlist}
                        rowKey="id"
                        loading={waitlistLoading}
                        pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '20', '50'],
                            showTotal: (total) => `Tổng số: ${total} người đang chờ slot`,
                        }}
                        size="middle"
                        locale={{
                            emptyText: (
                                <div className="py-8 text-center">
                                    <Empty
                                        description={
                                            <div className="space-y-1">
                                                <p className="font-semibold text-slate-700 text-sm">
                                                    Không có bệnh nhân nào trong Danh sách chờ (Waitlist)
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {selectedRoomId !== null
                                                        ? `Buồng khám ${selectedRoomObj?.name} hiện chưa có ai trong danh sách chờ.`
                                                        : 'Tất cả ca khám và bác sĩ hiện tại đều đang tiếp nhận bình thường.'}
                                                </p>
                                            </div>
                                        }
                                    >
                                        {selectedRoomId !== null && (
                                            <Button
                                                type="primary"
                                                size="small"
                                                onClick={handleSelectAllRooms}
                                                className="bg-amber-600 text-xs font-semibold mt-2"
                                            >
                                                Xem Danh sách chờ tất cả các buồng
                                            </Button>
                                        )}
                                    </Empty>
                                </div>
                            ),
                        }}
                    />
                ) : (
                    <Table
                        columns={columns}
                        dataSource={sortedQueue}
                        rowKey="id"
                        loading={queueLoading}
                        pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '20', '50'],
                            showTotal: (total) => `Tổng số: ${total} lượt khám`,
                        }}
                        size="middle"
                        locale={{
                            emptyText: (
                                <div className="py-8 text-center">
                                    <Empty
                                        description={
                                            <div className="space-y-1">
                                                <p className="font-semibold text-slate-700 text-sm">
                                                    Không có bệnh nhân nào trong hàng đợi
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {selectedRoomId !== null
                                                        ? (selectedRoomObj?.doctorId
                                                            ? `Buồng khám ${selectedRoomObj?.name} (${selectedRoomObj?.doctorName}) hiện chưa có bệnh nhân nào trong hàng đợi.`
                                                            : `Buồng khám ${selectedRoomObj?.name} hôm nay chưa có Bác sĩ vào ca trực theo Lịch làm việc.`)
                                                        : 'Hiện tại chưa có người bệnh nào cần điều phối ở danh mục này.'}
                                                </p>
                                            </div>
                                        }
                                    >
                                        {(selectedRoomId !== null || searchQuery || activeTab !== 'ALL') && (
                                            <Button
                                                type="primary"
                                                size="small"
                                                onClick={handleResetAllFilters}
                                                className="medpro-btn-primary text-xs font-bold mt-2"
                                            >
                                                Đặt lại tất cả bộ lọc
                                            </Button>
                                        )}
                                    </Empty>
                                </div>
                            ),
                        }}
                        rowClassName={(record) =>
                            record.priority === 'EMERGENCY'
                                ? 'bg-rose-50/40'
                                : record.priority === 'PRIORITY'
                                    ? 'bg-purple-50/30'
                                    : record.status === 'DEFERRED' || record.status === 'tam_hoan'
                                        ? 'bg-amber-50/30'
                                        : ''
                        }
                    />
                )}
            </div>

            <QueueActionModal
                open={actionModal.open}
                onClose={() => setActionModal({ open: false, entry: null, mode: 'DEFER' })}
                onSuccess={() => refreshQueueData(selectedRoomIdRef.current, selectedDate, selectedShift)}
                queueEntry={actionModal.entry}
                mode={actionModal.mode}
            />

            <Modal
                title={
                    <span className="font-bold text-slate-800">
                        Lịch sử chặng & thao tác: Vé {historyModal.entry?.ticketNumber || historyModal.entry?.ma_so_thu_tu}
                    </span>
                }
                open={historyModal.open}
                onCancel={() => {
                    setHistoryModal({ open: false, entry: null })
                    setHistoryLogs([])
                }}
                footer={<Button onClick={() => {
                    setHistoryModal({ open: false, entry: null })
                    setHistoryLogs([])
                }}>Đóng</Button>}
                width={560}
            >
                <div className="py-3 text-xs space-y-4">
                    <h5 className="font-bold text-slate-700 uppercase">Hành trình khám thực tế</h5>
                    {(() => {
                        const stages = getTicketStages(historyModal.entry)
                        if (stages.length === 0) {
                            return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thông tin hành trình khám" />
                        }
                        return (
                            <Timeline
                                items={stages.map((st) => ({
                                    color: st.color,
                                    children: (
                                        <div>
                                            <span className="font-bold text-slate-800">{st.stage}</span> -{' '}
                                            <span className="text-slate-500">{st.time}</span>
                                            <div className="text-slate-400 text-[11px]">{st.room}</div>
                                        </div>
                                    ),
                                }))}
                            />
                        )
                    })()}

                    <h5 className="font-bold text-slate-700 uppercase pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span>Nhật ký thao tác chi tiết (Audit Trail)</span>
                        {isLoadingHistory && <Spin size="small" />}
                    </h5>
                    {isLoadingHistory ? (
                        <div className="py-6 flex justify-center items-center">
                            <Spin tip="Đang tải nhật ký thao tác..." />
                        </div>
                    ) : historyLogs.length === 0 ? (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center text-slate-400">
                            Chưa ghi nhận thao tác điều phối nào cho vé này trong ngày hôm nay.
                        </div>
                    ) : (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 max-h-60 overflow-y-auto text-[11px]">
                            {historyLogs.map((log, i) => (
                                <div key={log.id || i} className="pb-2 border-b border-slate-200/60 last:border-0 last:pb-0">
                                    <div className="flex items-center justify-between text-slate-500 font-mono text-[10px]">
                                        <span>{log.timestamp}</span>
                                        <Tag color="cyan" className="text-[10px] mr-0">{log.action_type}</Tag>
                                    </div>
                                    <div className="font-semibold text-slate-700 mt-0.5">
                                        {log.actor}: <span className="font-normal text-slate-600">{log.description}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            <PatientDetailDrawer
                patientId={patientDrawerId}
                open={Boolean(patientDrawerId)}
                onClose={() => setPatientDrawerId(null)}
            />

            <EmergencyHandoverModal
                open={isEmergencyModalOpen}
                onClose={() => setIsEmergencyModalOpen(false)}
            />

            <CheckInReceiptModal
                open={Boolean(receiptEntry)}
                onClose={() => setReceiptEntry(null)}
                queueEntry={receiptEntry}
            />
        </div>
    )
}
