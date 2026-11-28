import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import dayjs from 'dayjs'
import { message } from 'antd'
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
} from '../redux/actions/reception/receptionAction'
import { setQueueEntries } from '../redux/slices/reception/receptionSlice'
import { receptionService } from '../services/reception/receptionService'
import { audioAnnouncer } from '../utils/audioAnnouncer'

const isDemoQueueEntity = (value) => /\(demo\)|^demo_/i.test(String(value || '').trim())

const getDefaultShift = () => {
    const now = dayjs()
    const hour = now.hour()
    const minute = now.minute()
    if (hour < 12 || (hour === 12 && minute <= 30)) {
        return 'sang'
    }
    return 'chieu'
}

export function useQueuePageLogic() {
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

    const [activeTab, setActiveTab] = useState('WAITING')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedDepartmentTab, setSelectedDepartmentTab] = useState('')
    const [selectedRoomId, setSelectedRoomId] = useState(null)
    const [selectedDate, setSelectedDate] = useState(() => dayjs().format('YYYY-MM-DD'))
    const [selectedShift, setSelectedShift] = useState(() => getDefaultShift())

    const [actionModal, setActionModal] = useState({ open: false, entry: null, mode: 'DEFER' })
    const [historyModal, setHistoryModal] = useState({ open: false, entry: null })
    const [historyLogs, setHistoryLogs] = useState([])
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)
    const [patientDrawerId, setPatientDrawerId] = useState(null)
    const [receiptEntry, setReceiptEntry] = useState(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

    const displayRooms = useMemo(() => {
        const rawRooms = rooms && rooms.length > 0 ? rooms : []
        const nonDemoRooms = rawRooms.filter((room) => {
            const code = room.code || room.ma_phong
            const name = room.name || room.ten_phong
            const roomType = String(room.loai_phong || room.roomType || '').toLowerCase()
            const isClsRoom = (roomType && roomType !== 'kham_benh') || /^(cdha|lab|tdcn|xn)/i.test(String(code || ''))
            return !isDemoQueueEntity(code) && !isDemoQueueEntity(name) && !isClsRoom
        })
        const sourceRooms = nonDemoRooms.length > 0 ? nonDemoRooms : rawRooms

        return sourceRooms.map((room) => {
            const statusInfo = (roomStatus || []).find(
                (item) => item.phong_kham_id === room.id || item.ma_phong === room.code
            )
            let doctorId = statusInfo?.bac_si_id || room.doctorId
            let doctorName = statusInfo?.ten_bac_si || room.doctorName

            if (!doctorId && roster && roster.length > 0) {
                const rosterMatch = roster.find((item) => item.phong_kham_id === room.id || item.ma_phong_kham === room.code)
                if (rosterMatch) {
                    doctorId = rosterMatch.bac_si_id
                    doctorName = rosterMatch.ten_bac_si
                }
            }

            if (!doctorId && doctors && doctors.length > 0) {
                const doctorMatch = doctors.find(
                    (doc) =>
                        String(doc.roomId) === String(room.id) ||
                        String(doc.phong_kham_id) === String(room.id) ||
                        doc.room === room.name ||
                        doc.room === room.code
                )
                if (doctorMatch) {
                    doctorId = doctorMatch.id
                    doctorName = doctorMatch.name || doctorMatch.ho_ten
                }
            }

            return {
                id: room.id,
                code: room.code || room.ma_phong || `PK-${room.id}`,
                name: room.name || room.ten_phong || 'Buồng khám',
                departmentId: room.departmentId || room.chuyen_khoa_id || null,
                departmentName: room.departmentName || room.ten_chuyen_khoa || statusInfo?.chuyen_khoa || 'Phòng chung',
                doctorId: doctorId || null,
                doctorName: doctorName || 'Chưa phân công bác sĩ',
                currentPatient: statusInfo?.benh_nhan_dang_kham || null,
                isOverloaded: statusInfo?.canh_bao_qua_tai || false,
                backendWaiting: statusInfo?.so_benh_nhan_cho ?? null,
                floor: room.floor || room.tang || statusInfo?.tang || 'Tầng 1',
            }
        })
    }, [rooms, roomStatus, roster, doctors])

    const departmentTabs = useMemo(() => {
        const list = []
        const seen = new Set()
        const sourceDepartments = departments || []
        const nonDemoDepartments = sourceDepartments.filter(
            (department) =>
                !isDemoQueueEntity(department.name || department.ten_chuyen_khoa) &&
                !isDemoQueueEntity(department.code || department.prefix)
        )
        const effectiveDepartments = nonDemoDepartments.length > 0 ? nonDemoDepartments : sourceDepartments

        effectiveDepartments.forEach((department) => {
            const departmentId = String(department.id)
            if (!seen.has(departmentId)) {
                seen.add(departmentId)
                list.push({
                    id: departmentId,
                    name: department.name || department.ten_chuyen_khoa,
                    code: department.code || department.prefix,
                })
            }
        })
        return list
    }, [departments])

    const knownDepIds = useMemo(() => {
        return new Set(
            departmentTabs.filter((department) => department.id !== 'CHUNG').map((department) => String(department.id))
        )
    }, [departmentTabs])

    const getRoomsForTab = useCallback((tabId) => {
        if (tabId === 'CHUNG') {
            return displayRooms.filter((room) => !room.departmentId || !knownDepIds.has(String(room.departmentId)))
        }
        return displayRooms.filter(
            (room) => room.departmentId && String(room.departmentId) === String(tabId)
        )
    }, [knownDepIds, displayRooms])

    const displayRoomsRef = useRef(displayRooms)
    const selectedRoomIdRef = useRef(selectedRoomId)

    useEffect(() => {
        displayRoomsRef.current = displayRooms
        selectedRoomIdRef.current = selectedRoomId
    }, [displayRooms, selectedRoomId])

    const refreshQueueData = useCallback(async (roomIdToUse = selectedRoomIdRef.current, dateToUse = selectedDate, shiftToUse = selectedShift) => {
        const queryParameters = {
            queryDate: dateToUse || undefined,
            caKham: shiftToUse === 'all' ? undefined : shiftToUse,
        }
        const currentRoom = roomIdToUse ? displayRoomsRef.current.find((room) => String(room.id) === String(roomIdToUse)) : null
        if (currentRoom) {
            if (currentRoom.doctorId) {
                await dispatch(fetchDoctorQueueAsync({ doctorId: currentRoom.doctorId, ...queryParameters })).unwrap().catch(() => {})
            } else {
                dispatch(setQueueEntries([]))
            }
        } else {
            await dispatch(fetchFlowBoardAsync(queryParameters)).unwrap().catch(() => {})
        }
        dispatch(fetchShiftDashboardAsync(queryParameters))
        dispatch(fetchReceptionWaitlistAsync())
    }, [dispatch, selectedDate, selectedShift])

    useEffect(() => {
        const initialShift = getDefaultShift()
        const initialDate = dayjs().format('YYYY-MM-DD')
        const initialParameters = {
            queryDate: initialDate,
            caKham: initialShift,
        }
        dispatch(fetchFlowBoardAsync(initialParameters)).unwrap().catch(() => {})
        dispatch(fetchShiftDashboardAsync(initialParameters))
        dispatch(fetchReceptionWaitlistAsync({ query_date: initialDate, ca_kham: initialShift }))
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

    useEffect(() => {
        if (departmentTabs.length > 0 && selectedDepartmentTab) {
            const exists = departmentTabs.some((department) => department.id === selectedDepartmentTab)
            if (!exists) {
                setSelectedDepartmentTab('')
            }
        }
    }, [departmentTabs, selectedDepartmentTab])

    const isTicketInRoom = useCallback((ticket, room) => {
        if (!room) return true

        if (ticket.doctorId && room.doctorId) {
            return Number(ticket.doctorId) === Number(room.doctorId)
        }

        if (ticket.backendRoomId && room.id && Number(ticket.backendRoomId) === Number(room.id)) return true
        if (ticket.roomId && room.id && Number(ticket.roomId) === Number(room.id)) return true

        const roomCode = String(room.code || '').toUpperCase().trim()
        const ticketRoomString = String(ticket.roomName || ticket.phong_kham || '').toUpperCase().trim()
        if (roomCode && ticketRoomString && ticketRoomString.includes(roomCode)) return true

        if (!ticket.doctorId && !room.doctorId && ticket.departmentId && room.departmentId) {
            return Number(ticket.departmentId) === Number(room.departmentId)
        }

        return false
    }, [])

    const roomWaitingCounts = useMemo(() => {
        const counts = {}
        displayRooms.forEach((room) => {
            if (room.backendWaiting !== null && room.backendWaiting !== undefined) {
                counts[room.id] = room.backendWaiting
            } else if (room.doctorId) {
                counts[room.id] = (queueEntries || []).filter(
                    (entry) =>
                        Number(entry.doctorId) === Number(room.doctorId) &&
                        (entry.status === 'WAITING' || entry.status === 'CHO_KHAM' || entry.status === 'cho_kham' || entry.status === 'CALLED' || entry.status === 'da_goi')
                ).length
            } else {
                counts[room.id] = 0
            }
        })
        return counts
    }, [displayRooms, queueEntries])

    const totalWaitingCount = useMemo(() => {
        return queueEntries.filter((entry) => {
            return (
                entry.status === 'WAITING' ||
                entry.status === 'CHO_KHAM' ||
                entry.status === 'cho_kham' ||
                entry.status === 'CALLED' ||
                entry.status === 'da_goi'
            )
        }).length
    }, [queueEntries])

    const visibleRooms = useMemo(() => {
        if (!selectedDepartmentTab) return displayRooms
        return getRoomsForTab(selectedDepartmentTab)
    }, [selectedDepartmentTab, getRoomsForTab, displayRooms])

    const handleOpenHistoryModal = async (record) => {
        setHistoryModal({ open: true, entry: record })
        setHistoryLogs([])
        setIsLoadingHistory(true)
        try {
            const ticketNumber = record.ticketNumber || record.ma_so_thu_tu || ''
            const response = await receptionService.getAuditLogs({
                query_date: selectedDate,
                search: ticketNumber,
                page_size: 50,
            })
            const data = response?.data?.data || response?.data || {}
            const items = data.items || []
            const filtered = items.filter(
                (item) =>
                    item.ticket_number === ticketNumber ||
                    String(item.metadata?.ticket_id) === String(record.id)
            )
            setHistoryLogs(filtered)
        } catch {
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

    const filteredQueue = useMemo(() => {
        return queueEntries.filter((entry) => {
            const patient = patients.find((pat) => pat.id === entry.patientId)
            const ticketString = String(entry.ma_so_thu_tu || entry.ticketNumber || '')
            const patientName = String(entry.patientName || patient?.fullName || '')
            const patientPhone = String(entry.phone || patient?.phone || '')

            const matchesQuery =
                !searchQuery ||
                ticketString.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                patientName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                patientPhone.includes(searchQuery.trim())

            let matchesShift = true
            if (selectedShift !== 'all' && entry.ca_kham) {
                matchesShift = entry.ca_kham.toLowerCase() === selectedShift.toLowerCase()
            }

            let matchesDate = true
            if (selectedDate && entry.ngay_kham) {
                matchesDate = entry.ngay_kham === selectedDate
            }

            let matchesScope = true
            if (selectedRoomId !== null) {
                const currentRoom = displayRooms.find((room) => room.id === selectedRoomId)
                matchesScope = isTicketInRoom(entry, currentRoom)
            } else if (selectedDepartmentTab) {
                matchesScope = visibleRooms.some((room) => isTicketInRoom(entry, room))
            }

            let matchesTab = true
            if (activeTab === 'WAITING') {
                matchesTab =
                    entry.status === 'WAITING' ||
                    entry.status === 'CHO_KHAM' ||
                    entry.status === 'cho_kham' ||
                    entry.status === 'CALLED' ||
                    entry.status === 'da_goi'
            } else if (activeTab === 'IN_CONSULTATION') {
                matchesTab = entry.status === 'IN_CONSULTATION' || entry.status === 'DANG_KHAM' || entry.status === 'dang_kham'
            } else if (activeTab === 'DEFERRED') {
                matchesTab = entry.status === 'DEFERRED' || entry.status === 'TAM_HOAN' || entry.status === 'tam_hoan'
            } else if (activeTab === 'COMPLETED') {
                matchesTab =
                    entry.status === 'COMPLETED' ||
                    entry.status === 'DA_KHAM' ||
                    entry.status === 'da_kham' ||
                    entry.status === 'BO_KHAM' ||
                    entry.status === 'bo_kham' ||
                    entry.status === 'da_dong_ve' ||
                    entry.status === 'DA_DONG_VE'
            }

            return matchesQuery && matchesShift && matchesDate && matchesScope && matchesTab
        })
    }, [queueEntries, patients, searchQuery, selectedShift, selectedDate, selectedRoomId, selectedDepartmentTab, displayRooms, visibleRooms, activeTab, isTicketInRoom])

    const tabCounts = useMemo(() => {
        let baseList = queueEntries
        if (selectedShift !== 'all') {
            baseList = baseList.filter((entry) => !entry.ca_kham || entry.ca_kham.toLowerCase() === selectedShift.toLowerCase())
        }
        if (selectedDate) {
            baseList = baseList.filter((entry) => !entry.ngay_kham || entry.ngay_kham === selectedDate)
        }
        if (selectedRoomId !== null) {
            const currentRoom = displayRooms.find((room) => room.id === selectedRoomId)
            baseList = baseList.filter((entry) => isTicketInRoom(entry, currentRoom))
        } else if (selectedDepartmentTab) {
            baseList = baseList.filter((entry) => visibleRooms.some((room) => isTicketInRoom(entry, room)))
        }

        const waitlistInScope = waitlist.filter((waitItem) => {
            if (selectedRoomId !== null) {
                const currentRoom = displayRooms.find((room) => room.id === selectedRoomId)
                if (currentRoom) {
                    return (
                        (waitItem.phong_kham_id && Number(waitItem.phong_kham_id) === Number(currentRoom.id)) ||
                        (waitItem.bac_si_id && currentRoom.doctorId && Number(waitItem.bac_si_id) === Number(currentRoom.doctorId)) ||
                        (!waitItem.bac_si_id && currentRoom.departmentId && Number(waitItem.chuyen_khoa_id) === Number(currentRoom.departmentId))
                    )
                }
                return false
            }
            if (selectedDepartmentTab === 'CHUNG') {
                return !waitItem.chuyen_khoa_id
            }
            if (selectedDepartmentTab) {
                return String(waitItem.chuyen_khoa_id) === String(selectedDepartmentTab)
            }
            return true
        })

        return {
            ALL: baseList.length,
            WAITING: baseList.filter((entry) =>
                entry.status === 'WAITING' || entry.status === 'CHO_KHAM' || entry.status === 'cho_kham' || entry.status === 'CALLED' || entry.status === 'da_goi'
            ).length,
            IN_CONSULTATION: baseList.filter((entry) =>
                entry.status === 'IN_CONSULTATION' || entry.status === 'DANG_KHAM' || entry.status === 'dang_kham'
            ).length,
            DEFERRED: baseList.filter((entry) =>
                entry.status === 'DEFERRED' || entry.status === 'TAM_HOAN' || entry.status === 'tam_hoan'
            ).length,
            COMPLETED: baseList.filter((entry) =>
                entry.status === 'COMPLETED' || entry.status === 'DA_KHAM' || entry.status === 'da_kham' || entry.status === 'BO_KHAM' || entry.status === 'bo_kham' || entry.status === 'da_dong_ve' || entry.status === 'DA_DONG_VE'
            ).length,
            WAITLIST: waitlistInScope.length,
        }
    }, [queueEntries, selectedShift, selectedDate, selectedRoomId, displayRooms, selectedDepartmentTab, visibleRooms, waitlist, isTicketInRoom])

    useEffect(() => {
        if (activeTab === 'WAITLIST') {
            dispatch(fetchReceptionWaitlistAsync())
        }
    }, [activeTab, dispatch])

    const reloadQueueAfterAction = async () => {
        const currentRoom = selectedRoomId ? displayRooms.find((room) => String(room.id) === String(selectedRoomId)) : null
        const queryParameters = {
            queryDate: selectedDate,
            caKham: selectedShift === 'all' ? undefined : selectedShift,
        }
        if (selectedRoomId && currentRoom?.doctorId) {
            await dispatch(fetchDoctorQueueAsync({ doctorId: currentRoom.doctorId, ...queryParameters })).unwrap().catch(() => {})
        } else {
            await dispatch(fetchFlowBoardAsync(queryParameters)).unwrap().catch(() => {})
        }
        dispatch(fetchShiftDashboardAsync(queryParameters))
        dispatch(fetchReceptionWaitlistAsync())
    }

    const handleCallNumber = async (record) => {
        try {
            const targetId = record.backendId || record.id
            await dispatch(callQueueEntryAsync({ queueId: targetId })).unwrap()
            message.success(`Đã gọi số vé ${record.ticketNumber || record.ma_so_thu_tu}`)

            const patientName = record.patientName || record.ten_benh_nhan || 'Bệnh nhân'
            const ticketNumber = record.ticketNumber || record.ma_so_thu_tu || ''
            const roomName = record.phong_kham || displayRooms.find((room) => room.id === selectedRoomId)?.name || 'phòng khám'
            audioAnnouncer.announcePatient(patientName, ticketNumber, roomName)
            await reloadQueueAfterAction(record)
        } catch {
            message.info(`Đang gọi số vé ${record.ticketNumber || record.ma_so_thu_tu}`)
        }
    }

    const handleResume = async (record) => {
        try {
            const targetId = record.backendId || record.id
            const currentRoom = selectedRoomId ? displayRooms.find((room) => String(room.id) === String(selectedRoomId)) : null
            const doctorId = record?.doctorId || currentRoom?.doctorId || 1
            await dispatch(
                resumeQueueEntryAsync({
                    queueId: targetId,
                    doctorId,
                    queryDate: selectedDate,
                    caKham: selectedShift === 'all' ? undefined : selectedShift,
                })
            ).unwrap()
            message.success(`Đã khôi phục số vé ${record.ticketNumber || record.ma_so_thu_tu} vào hàng chờ`)
            await refreshQueueData(selectedRoomIdRef.current || currentRoom?.id, selectedDate, selectedShift)
        } catch {
            message.info('Đã tiếp nhận lại lượt khám')
        }
    }

    const handleMarkAbsent = async (record) => {
        try {
            const targetId = record.backendId || record.id
            const currentRoom = selectedRoomId ? displayRooms.find((room) => String(room.id) === String(selectedRoomId)) : null
            const doctorId = record?.doctorId || currentRoom?.doctorId || 1
            await dispatch(
                markAbsentAsync({
                    queueId: targetId,
                    doctorId,
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
        } catch (error) {
            message.error(error || 'Không thể tiếp nhận bệnh nhân từ danh sách chờ')
        }
    }

    const handleCancelWaitlist = async (waitlistId) => {
        try {
            await dispatch(cancelWaitlistAsync({ waitlistId })).unwrap()
            message.success('Đã hủy lượt trong danh sách chờ')
        } catch (error) {
            message.error(error || 'Không thể hủy lượt chờ')
        }
    }

    const filteredWaitlist = useMemo(() => {
        let list = [...waitlist]
        if (selectedRoomId !== null) {
            const currentRoom = displayRooms.find((room) => room.id === selectedRoomId)
            if (currentRoom) {
                list = list.filter((waitItem) =>
                    (waitItem.phong_kham_id && Number(waitItem.phong_kham_id) === Number(currentRoom.id)) ||
                    (waitItem.bac_si_id && currentRoom.doctorId && Number(waitItem.bac_si_id) === Number(currentRoom.doctorId)) ||
                    (!waitItem.bac_si_id && currentRoom.departmentId && Number(waitItem.chuyen_khoa_id) === Number(currentRoom.departmentId))
                )
            }
        } else if (selectedDepartmentTab === 'CHUNG') {
            list = list.filter((waitItem) => !waitItem.chuyen_khoa_id)
        } else if (selectedDepartmentTab) {
            list = list.filter((waitItem) => String(waitItem.chuyen_khoa_id) === String(selectedDepartmentTab))
        }
        if (searchQuery.trim()) {
            const keyword = searchQuery.trim().toLowerCase()
            list = list.filter(
                (waitItem) =>
                    (waitItem.ten_benh_nhan && waitItem.ten_benh_nhan.toLowerCase().includes(keyword)) ||
                    (waitItem.so_dien_thoai && waitItem.so_dien_thoai.includes(keyword)) ||
                    (waitItem.ten_chuyen_khoa && waitItem.ten_chuyen_khoa.toLowerCase().includes(keyword)) ||
                    (waitItem.ten_bac_si && waitItem.ten_bac_si.toLowerCase().includes(keyword)) ||
                    `wait-${waitItem.id}`.includes(keyword)
            )
        }
        return list
    }, [waitlist, selectedRoomId, displayRooms, selectedDepartmentTab, searchQuery])

    const handleResetAllFilters = () => {
        setSelectedRoomId(null)
        setSelectedDepartmentTab('')
        setActiveTab('WAITING')
        setSearchQuery('')
        setSelectedDate(dayjs().format('YYYY-MM-DD'))
        setSelectedShift(getDefaultShift())
        refreshQueueData(null, dayjs().format('YYYY-MM-DD'), getDefaultShift())
    }

    const selectedRoomObject = displayRooms.find((room) => room.id === selectedRoomId)

    return {
        activeTab,
        setActiveTab,
        searchQuery,
        setSearchQuery,
        selectedDepartmentTab,
        setSelectedDepartmentTab,
        selectedRoomId,
        selectedDate,
        setSelectedDate,
        selectedShift,
        setSelectedShift,
        actionModal,
        setActionModal,
        historyModal,
        setHistoryModal,
        historyLogs,
        setHistoryLogs,
        isLoadingHistory,
        patientDrawerId,
        setPatientDrawerId,
        receiptEntry,
        setReceiptEntry,
        isRefreshing,
        displayRooms,
        departmentTabs,
        knownDepIds,
        getRoomsForTab,
        roomWaitingCounts,
        totalWaitingCount,
        visibleRooms,
        filteredQueue,
        tabCounts,
        filteredWaitlist,
        patients,
        queueLoading,
        waitlistLoading,
        selectedRoomObject,
        handleRefreshQueue,
        handleOpenHistoryModal,
        handleSelectRoom,
        handleSelectAllRooms,
        handleCallNumber,
        handleResume,
        handleMarkAbsent,
        handleCheckInWaitlist,
        handleCancelWaitlist,
        handleResetAllFilters,
    }
}
