import { useState, useEffect, useMemo, Fragment } from 'react'
import { useSelector } from 'react-redux'
import { adminService } from '../../services/admin/AdminService'
import { AppToast } from '../common/AppNotification'
import { exportToExcel } from '../../utils/helpers/exportUtils'
import {
    CalendarCheck,
    CalendarPlus,
    Clock,
    CheckCircle,
    XCircle,
    Warning,
    Plus,
    ArrowsClockwise,
    MagnifyingGlass,
    LockKey,
    Stethoscope,
    Users,
    Hospital,
    DownloadSimple,
    Funnel,
    CaretLeft,
    CaretRight,
    EmptyState,
    Buildings,
    ListChecks,
    Copy,
    ShieldCheck,
    SlidersHorizontal,
    Lightning,
    Trash,
    ClockCounterClockwise,
} from '../common/ClinicIcon'

function getStartOfWeek(date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff))
}

function formatDateToIso(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function addDays(date, days) {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
}

function getDoctorInitials(name) {
    if (!name) return 'BS'
    const clean = name.replace(/^(PGS\.|TS\.|ThS\.|BS\.CKII|BS\.CKI|BS\.)\s*/gi, '').trim()
    const parts = clean.split(' ').filter(Boolean)
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return clean.slice(0, 2).toUpperCase()
}

function extractDoctorTitle(name) {
    if (!name) return 'BS'
    if (name.includes('PGS')) return 'PGS'
    if (name.includes('TS.')) return 'TS'
    if (name.includes('ThS')) return 'ThS'
    if (name.includes('CKII')) return 'CKII'
    if (name.includes('CKI')) return 'CKI'
    return 'BS'
}

function resolvePhysicalRoomCode(roomOrCode, fullRoomName = '', defaultCode = 'PK') {
    if (roomOrCode && typeof roomOrCode === 'object') {
        if (roomOrCode.ma_phong) return String(roomOrCode.ma_phong).toUpperCase()
        if (roomOrCode.maPhong) return String(roomOrCode.maPhong).toUpperCase()
        if (roomOrCode.code) return String(roomOrCode.code).toUpperCase()
    }
    if (typeof roomOrCode === 'string' && roomOrCode.length <= 8 && !roomOrCode.includes(' ')) {
        return roomOrCode.toUpperCase()
    }
    const combined = String(fullRoomName || roomOrCode || '')
    const match = combined.match(/\b(P\s*\d+|K\s*\d+|CDHA\w*|CLS\w*|LAB\w*|XQ\w*|PK\w*|PTTT\w*)\b/i)
    if (match) return match[0].replace(/\s+/g, '').toUpperCase()
    const num = combined.match(/\d+/)
    if (num) return 'P' + num[0]
    return defaultCode
}

function canUserEditSchedule() {
    const role = localStorage.getItem('USER_ROLE')
    if (!role) return true
    const normalized = String(role).toUpperCase()
    return normalized === 'ADMIN' || normalized === 'CHUYEN_MON' || normalized.includes('ADMIN')
}

const VI_WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật']

const INITIAL_FALLBACK_LEAVES = [
    {
        id: 'DEMO-LEAVE-01',
        bac_si_id: 2,
        ten_bac_si: 'ThS. BS Trần Thị Bích',
        loai_nghi: 'NGHI_PHEP',
        tu_ngay: '2026-11-09',
        den_ngay: '2026-11-15',
        ca_lam_viec: 'all',
        ly_do: 'Tham gia Hội nghị Y khoa Quốc tế',
        trang_thai: 'DA_DUYET',
    },
]

export default function DoctorScheduleManagementTab() {
    const { clinicData } = useSelector((state) => state.app.admin)
    const clinicSettings = clinicData?.clinicSettings || {}
    const staffList = clinicData?.staffList || []
    const khoaPhongList = clinicData?.catalogs?.khoaPhong || []

    const userCanEdit = useMemo(() => canUserEditSchedule(), [])

    const [activeView, setActiveView] = useState('WEEK_MATRIX')
    const [selectedRoomDate, setSelectedRoomDate] = useState(() => formatDateToIso(new Date()))

    const [currentMonday, setCurrentMonday] = useState(() => getStartOfWeek(new Date()))
    const tuNgay = useMemo(() => formatDateToIso(currentMonday), [currentMonday])
    const denNgay = useMemo(() => formatDateToIso(addDays(currentMonday, 6)), [currentMonday])
    const todayIso = useMemo(() => formatDateToIso(new Date()), [])

    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const [matrixRawData, setMatrixRawData] = useState(null)
    const [doctors, setDoctors] = useState([])
    const [rooms, setRooms] = useState([])
    const [doctorLeaves, setDoctorLeaves] = useState(INITIAL_FALLBACK_LEAVES)

    const [searchDoctor, setSearchDoctor] = useState('')
    const [selectedDepartment, setSelectedDepartment] = useState('ALL')
    const [departments, setDepartments] = useState([])
    const [selectedRoomFilter, setSelectedRoomFilter] = useState('ALL')
    const [selectedTitleFilter, setSelectedTitleFilter] = useState('ALL')
    const [showConflictOnly, setShowConflictOnly] = useState(false)
    const [showSlotDetails, setShowSlotDetails] = useState(false)

    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [showCopyModal, setShowCopyModal] = useState(false)
    const [showInheritModal, setShowInheritModal] = useState(false)
    const [showQuickFillModal, setShowQuickFillModal] = useState(false)
    const [showLeaveInfoModal, setShowLeaveInfoModal] = useState(false)

    const [selectedShiftForDetail, setSelectedShiftForDetail] = useState(null)
    const [selectedLeaveForDetail, setSelectedLeaveForDetail] = useState(null)
    const [quickFillDoctor, setQuickFillDoctor] = useState(null)

    const [quickFillRoomId, setQuickFillRoomId] = useState('')
    const [quickFillShiftPattern, setQuickFillShiftPattern] = useState('both_weekdays')
    const [quickFillOnlineQuota, setQuickFillOnlineQuota] = useState(6)
    const [quickFillCounterQuota, setQuickFillCounterQuota] = useState(2)

    const [createShiftForm, setCreateShiftForm] = useState({
        bac_si_id: '',
        ngay: '',
        ca: 'sang',
        phong_kham_id: '',
        so_cho_online: 6,
        so_cho_quay: 2,
        is_active: true,
        ghi_chu_nghi: '',
    })

    const daysOfWeek = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const date = addDays(currentMonday, i)
            const iso = formatDateToIso(date)
            return {
                dayIndex: i,
                label: VI_WEEKDAYS[i],
                displayDate: `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`,
                isoDate: iso,
                isToday: iso === todayIso,
                isWeekend: i === 5 || i === 6,
            }
        })
    }, [currentMonday, todayIso])

    const fetchInitialResources = async () => {
        try {
            const [fetchedDocs, fetchedRooms, fetchedLeaves, fetchedDepts] = await Promise.all([
                adminService.getDoctorsAdmin(),
                adminService.getRoomsAdmin({ isActive: true }),
                adminService.getDoctorLeaves({ trangThai: 'DA_DUYET' }).catch(() => null),
                adminService.getDepartmentsAdmin().catch(() => []),
            ])

            if (Array.isArray(fetchedDepts) && fetchedDepts.length > 0) {
                setDepartments(fetchedDepts)
            }

            if (Array.isArray(fetchedDocs) && fetchedDocs.length > 0) {
                const mappedDocs = fetchedDocs.map((d) => ({
                    ...d,
                    chuyen_khoa: d.ten_chuyen_khoa || d.chuyen_khoa || 'Khoa Nội tổng quát',
                    chuyen_khoa_id: d.chuyen_khoa_id || d.chuyenKhoaId,
                    cchn_so: d.chung_chi_hanh_nghe || d.cchn_so || 'CCHN-BYT',
                    cchn_trang_thai: d.trang_thai_giay_phep || 'ACTIVE',
                }))
                setDoctors(mappedDocs)
            } else {
                const mappedDocs = staffList
                    .filter((s) => s.hoTen?.includes('BS') || s.vaiTro?.toLowerCase().includes('bác sĩ') || s.vaiTro?.toLowerCase().includes('chuyên môn'))
                    .map((s, idx) => ({
                        id: s.id || idx + 1,
                        ho_ten: s.hoTen || s.ten || 'Bác sĩ',
                        chuyen_khoa: s.chuyenKhoa || 'Khoa Nội tổng quát',
                        chuyen_khoa_id: s.chuyenKhoaId || (idx % 3) + 1,
                        cchn_so: s.cchn || s.cchnSo || 'CCHN-BYT',
                        cchn_trang_thai: s.trangThaiCCHN || 'ACTIVE',
                    }))
                setDoctors(mappedDocs)
            }

            if (Array.isArray(fetchedRooms) && fetchedRooms.length > 0) {
                setRooms(fetchedRooms)
            } else {
                const mappedRooms = khoaPhongList.map((kp, idx) => ({
                    id: kp.id || idx + 1,
                    ma_phong: kp.maPhong || kp.maKhoa || `P10${idx + 1}`,
                    ten_phong: kp.tenPhong || kp.tenKhoa || `Phòng khám ${idx + 1}`,
                    chuyen_khoa_id: kp.id || idx + 1,
                    tang: kp.tang || 'Tầng 1',
                    loai_phong: 'kham_benh',
                    is_active: true,
                }))
                setRooms(mappedRooms)
            }

            if (Array.isArray(fetchedLeaves)) {
                setDoctorLeaves(fetchedLeaves)
            } else if (fetchedLeaves?.data && Array.isArray(fetchedLeaves.data)) {
                setDoctorLeaves(fetchedLeaves.data)
            }
        } catch {
            AppToast.error('Không thể nạp danh mục bác sĩ và buồng khám')
        }
    }

    const [roomDateShiftsFromApi, setRoomDateShiftsFromApi] = useState([])

    const fetchMatrix = async () => {
        setLoading(true)
        try {
            const params = {
                tuNgay,
                denNgay,
            }
            if (selectedDepartment && selectedDepartment !== 'ALL') {
                const deptObj = departments.find(
                    (k) => (k.ten_chuyen_khoa || k.tenKhoa || k.name) === selectedDepartment
                ) || khoaPhongList.find(
                    (k) => (k.tenKhoa || k.tenPhong) === selectedDepartment
                )
                if (deptObj?.id) {
                    params.chuyenKhoaId = deptObj.id
                } else {
                    const docDept = doctors.find((d) => d.chuyen_khoa === selectedDepartment)
                    if (docDept?.chuyen_khoa_id) params.chuyenKhoaId = docDept.chuyen_khoa_id
                }
            }
            if (selectedRoomFilter && selectedRoomFilter !== 'ALL') {
                params.phongKhamId = selectedRoomFilter
            }
            if (searchDoctor.trim()) {
                const matchedDoc = doctors.find((d) =>
                    d.ho_ten?.toLowerCase().includes(searchDoctor.trim().toLowerCase())
                )
                if (matchedDoc) {
                    params.doctorId = matchedDoc.id
                }
            }
            const data = await adminService.getDoctorScheduleMatrix(params)
            setMatrixRawData(data)
        } catch {
            AppToast.error('Không thể tải ma trận phân ca trực!')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchInitialResources()
    }, [staffList, khoaPhongList])

    useEffect(() => {
        fetchMatrix()
    }, [tuNgay, denNgay, selectedDepartment, selectedRoomFilter])

    useEffect(() => {
        if (activeView === 'ROOM_VIEW' && selectedRoomDate) {
            adminService.getShiftsAdmin({ queryDate: selectedRoomDate })
                .then((res) => {
                    const list = res?.data || res
                    if (Array.isArray(list)) {
                        setRoomDateShiftsFromApi(list)
                    }
                })
                .catch(() => {})
        }
    }, [activeView, selectedRoomDate])

    const handlePreviousWeek = () => {
        setCurrentMonday(addDays(currentMonday, -7))
    }

    const handleNextWeek = () => {
        setCurrentMonday(addDays(currentMonday, 7))
    }

    const handleCurrentWeek = () => {
        setCurrentMonday(getStartOfWeek(new Date()))
    }

    const handlePreviousRoomDay = () => {
        const d = new Date(selectedRoomDate)
        d.setDate(d.getDate() - 1)
        setSelectedRoomDate(formatDateToIso(d))
    }

    const handleNextRoomDay = () => {
        const d = new Date(selectedRoomDate)
        d.setDate(d.getDate() + 1)
        setSelectedRoomDate(formatDateToIso(d))
    }

    const departmentsList = useMemo(() => {
        const set = new Set()
        departments.forEach((dept) => {
            const name = dept.ten_chuyen_khoa || dept.tenKhoa || dept.name
            if (name) set.add(name)
        })
        doctors.forEach((d) => {
            const name = d.chuyen_khoa || d.ten_chuyen_khoa
            if (name && name !== 'Đa khoa') set.add(name)
        })
        if (set.size === 0) {
            khoaPhongList.forEach((k) => {
                const name = k.tenKhoa || k.chuyenKhoa || k.tenPhong
                if (name) set.add(name)
            })
        }
        return Array.from(set)
    }, [departments, doctors, khoaPhongList])

    const titlesList = ['ALL', 'PGS', 'TS', 'ThS', 'CKII', 'CKI', 'BS']

    const roomLookupMap = useMemo(() => {
        const map = new Map()
        rooms.forEach((r) => {
            map.set(String(r.id), r)
            if (r.ma_phong) map.set(r.ma_phong.toUpperCase(), r)
            if (r.maPhong) map.set(r.maPhong.toUpperCase(), r)
        })
        return map
    }, [rooms])

    const doctorLeavesMap = useMemo(() => {
        const map = new Map()
        doctorLeaves.forEach((leave) => {
            if (leave.trang_thai && leave.trang_thai !== 'DA_DUYET' && leave.trang_thai !== 'APPROVED') return
            const start = new Date(leave.tu_ngay)
            const end = new Date(leave.den_ngay)
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = formatDateToIso(d)
                const ca = String(leave.ca_lam_viec || 'all').toLowerCase()
                if (ca === 'sang') {
                    map.set(`${leave.bac_si_id}_${dateStr}_sang`, leave)
                } else if (ca === 'chieu') {
                    map.set(`${leave.bac_si_id}_${dateStr}_chieu`, leave)
                } else {
                    map.set(`${leave.bac_si_id}_${dateStr}_all`, leave)
                    map.set(`${leave.bac_si_id}_${dateStr}_sang`, leave)
                    map.set(`${leave.bac_si_id}_${dateStr}_chieu`, leave)
                }
            }
        })
        return map
    }, [doctorLeaves])

    const shiftsByDoctorAndSlot = useMemo(() => {
        const map = new Map()

        if (matrixRawData?.matrix && Array.isArray(matrixRawData.matrix)) {
            matrixRawData.matrix.forEach((cell) => {
                const shiftDate = String(cell.ngay).slice(0, 10)
                const shiftCa = String(cell.ca_lam_viec || cell.ca || '').toLowerCase()
                const key = `${cell.bac_si_id}_${shiftDate}_${shiftCa}`
                const fullRoomName = cell.ten_phong_kham || 'Buồng khám'
                const matchedRoom = roomLookupMap.get(String(cell.phong_kham_id)) || roomLookupMap.get(fullRoomName)
                const cleanRoomCode = resolvePhysicalRoomCode(matchedRoom, fullRoomName, 'P' + (cell.phong_kham_id || '101'))

                map.set(key, {
                    id: cell.ca_id,
                    bac_si_id: cell.bac_si_id,
                    ten_bac_si: cell.ten_bac_si,
                    hoc_vi: cell.hoc_vi,
                    chuyen_khoa: cell.chuyen_khoa,
                    chuyen_khoa_id: cell.chuyen_khoa_id,
                    ngay: shiftDate,
                    ca: shiftCa,
                    phong_kham_id: cell.phong_kham_id,
                    ten_phong_kham: fullRoomName,
                    short_room_code: cleanRoomCode,
                    gio_bat_dau: cell.gio_bat_dau,
                    gio_ket_thuc: cell.gio_ket_thuc,
                    trang_thai_ca: cell.trang_thai_ca || (cell.is_active ? 'DANG_HOAT_DONG' : 'DA_KHOA'),
                    is_conflict: Boolean(cell.is_conflict),
                    is_full: Boolean(cell.is_full),
                    so_cho_online: cell.han_muc_dat_truoc || 0,
                    so_cho_quay: cell.han_muc_vang_lai || 0,
                    so_cho_tong: (cell.han_muc_dat_truoc || 0) + (cell.han_muc_vang_lai || 0),
                    da_dat_online: cell.so_luong_da_dat || 0,
                    da_dat_quay: cell.so_luong_vang_lai || 0,
                    con_trong_online: cell.slot_online_con_trong ?? Math.max(0, (cell.han_muc_dat_truoc || 0) - (cell.so_luong_da_dat || 0)),
                    con_trong_quay: cell.slot_vang_lai_con_trong ?? Math.max(0, (cell.han_muc_vang_lai || 0) - (cell.so_luong_vang_lai || 0)),
                    is_active: cell.trang_thai_ca === 'DANG_HOAT_DONG' || cell.is_active === true,
                    ghi_chu_nghi: cell.ly_do_nghi,
                    patients: cell.danh_sach_benh_nhan || [],
                })
            })
        } else if (matrixRawData?.ma_tran_bac_si && Array.isArray(matrixRawData.ma_tran_bac_si)) {
            matrixRawData.ma_tran_bac_si.forEach((row) => {
                (row.ca_truc || []).forEach((c) => {
                    const shiftDate = String(c.ngay).slice(0, 10)
                    const shiftCa = String(c.ca || '').toLowerCase()
                    const key = `${row.bac_si_id}_${shiftDate}_${shiftCa}`
                    const fullRoomName = c.ten_phong_kham || 'Buồng khám'
                    const matchedRoom = roomLookupMap.get(String(c.phong_kham_id)) || roomLookupMap.get(fullRoomName)
                    const cleanRoomCode = resolvePhysicalRoomCode(matchedRoom, fullRoomName, 'P' + (c.phong_kham_id || '101'))

                    map.set(key, {
                        id: c.shift_id,
                        bac_si_id: row.bac_si_id,
                        ten_bac_si: row.ten_bac_si,
                        chuyen_khoa: row.chuyen_khoa,
                        ngay: shiftDate,
                        ca: shiftCa,
                        phong_kham_id: c.phong_kham_id,
                        ten_phong_kham: fullRoomName,
                        short_room_code: cleanRoomCode,
                        so_cho_online: c.so_cho_online || 0,
                        so_cho_quay: c.so_cho_quay || 0,
                        so_cho_tong: c.so_cho_tong || 0,
                        da_dat_online: c.da_dat_online || 0,
                        da_dat_quay: c.da_dat_quay || 0,
                        con_trong_online: c.con_trong_online || 0,
                        con_trong_quay: c.con_trong_quay || 0,
                        is_active: c.is_active,
                        ghi_chu_nghi: c.ghi_chu_nghi,
                    })
                })
            })
        }

        return map
    }, [matrixRawData, roomLookupMap])

    const doctorWeeklyShiftCounts = useMemo(() => {
        const counts = new Map()
        doctors.forEach((doc) => counts.set(doc.id, 0))
        shiftsByDoctorAndSlot.forEach((shift) => {
            if (shift.is_active && counts.has(shift.bac_si_id)) {
                counts.set(shift.bac_si_id, counts.get(shift.bac_si_id) + 1)
            }
        })
        return counts
    }, [doctors, shiftsByDoctorAndSlot])

    const conflictsMap = useMemo(() => {
        const conflicts = new Map()
        const roomOccupancy = new Map()
        const doctorOccupancy = new Map()

        shiftsByDoctorAndSlot.forEach((shift) => {
            if (!shift.is_active) return

            const roomKey = `${shift.ngay}_${shift.ca}_${shift.phong_kham_id}`
            const currentRoomShifts = roomOccupancy.get(roomKey) || []
            currentRoomShifts.push(shift)
            roomOccupancy.set(roomKey, currentRoomShifts)

            const docKey = `${shift.ngay}_${shift.ca}_${shift.bac_si_id}`
            const currentDocShifts = doctorOccupancy.get(docKey) || []
            currentDocShifts.push(shift)
            doctorOccupancy.set(docKey, currentDocShifts)
        })

        roomOccupancy.forEach((list) => {
            if (list.length > 1) {
                list.forEach((s) => {
                    const key = `${s.bac_si_id}_${s.ngay}_${s.ca}`
                    conflicts.set(key, {
                        type: 'ROOM_CONFLICT',
                        message: `Buồng ${s.short_room_code} có ${list.length} bác sĩ cùng trực ca này!`,
                    })
                })
            }
        })

        doctorOccupancy.forEach((list) => {
            if (list.length > 1) {
                list.forEach((s) => {
                    const key = `${s.bac_si_id}_${s.ngay}_${s.ca}`
                    conflicts.set(key, {
                        type: 'DOCTOR_CONFLICT',
                        message: `Bác sĩ ${s.ten_bac_si} bị xếp trùng ${list.length} buồng cùng ca!`,
                    })
                })
            }
        })

        return conflicts
    }, [shiftsByDoctorAndSlot])

    const shiftsList = useMemo(() => {
        const list = []
        shiftsByDoctorAndSlot.forEach((shift) => {
            list.push(shift)
        })
        return list.sort((a, b) => a.ngay.localeCompare(b.ngay) || a.ca.localeCompare(b.ca))
    }, [shiftsByDoctorAndSlot])

    const filteredDoctors = useMemo(() => {
        return doctors.filter((doc) => {
            const matchSearch = !searchDoctor ||
                doc.ho_ten?.toLowerCase().includes(searchDoctor.toLowerCase()) ||
                doc.chuyen_khoa?.toLowerCase().includes(searchDoctor.toLowerCase())

            const matchDept = selectedDepartment === 'ALL' || doc.chuyen_khoa === selectedDepartment
            const matchTitle = selectedTitleFilter === 'ALL' || extractDoctorTitle(doc.ho_ten) === selectedTitleFilter

            const matchRoom = selectedRoomFilter === 'ALL' || shiftsList.some(
                (s) => s.bac_si_id === doc.id && String(s.phong_kham_id) === String(selectedRoomFilter)
            )

            const matchConflict = !showConflictOnly || daysOfWeek.some((day) => {
                const kSang = `${doc.id}_${day.isoDate}_sang`
                const kChieu = `${doc.id}_${day.isoDate}_chieu`
                return conflictsMap.has(kSang) || conflictsMap.has(kChieu)
            })

            return matchSearch && matchDept && matchTitle && matchRoom && matchConflict
        })
    }, [doctors, searchDoctor, selectedDepartment, selectedTitleFilter, selectedRoomFilter, showConflictOnly, daysOfWeek, conflictsMap, shiftsList])

    const columnShiftTotals = useMemo(() => {
        return daysOfWeek.map((day) => {
            const morningShifts = shiftsList.filter(
                (s) => s.ngay === day.isoDate && s.ca === 'sang' && s.is_active
            )
            const afternoonShifts = shiftsList.filter(
                (s) => s.ngay === day.isoDate && s.ca === 'chieu' && s.is_active
            )
            const morningTarget = day.isWeekend ? 3 : 6
            const afternoonTarget = day.isWeekend ? 3 : 6

            return {
                date: day.isoDate,
                isWeekend: day.isWeekend,
                morningCount: morningShifts.length,
                afternoonCount: afternoonShifts.length,
                morningTarget,
                afternoonTarget,
            }
        })
    }, [daysOfWeek, shiftsList])

    const selectedDeptId = useMemo(() => {
        if (!selectedDepartment || selectedDepartment === 'ALL') return null
        const d = departments.find(
            (dept) => (dept.ten_chuyen_khoa || dept.tenKhoa || dept.name) === selectedDepartment
        )
        if (d?.id) return d.id
        const docWithDept = doctors.find(
            (doc) => (doc.chuyen_khoa || doc.ten_chuyen_khoa) === selectedDepartment
        )
        return docWithDept?.chuyen_khoa_id || null
    }, [selectedDepartment, departments, doctors])

    const filteredRoomsForFilterBar = useMemo(() => {
        return rooms.filter((r) => {
            // Chỉ lấy các buồng khám bệnh lâm sàng
            if (r.loai_phong && r.loai_phong !== 'kham_benh') return false
            if (!selectedDepartment || selectedDepartment === 'ALL') return true
            // Nếu phòng không có chuyên khoa (phòng chung / dùng chung) -> hiện ở mọi khoa
            if (!r.chuyen_khoa_id) return true
            // Phòng thuộc chuyên khoa được chọn
            if (selectedDeptId && r.chuyen_khoa_id === selectedDeptId) return true
            if (r.ten_chuyen_khoa === selectedDepartment || r.chuyen_khoa === selectedDepartment) return true
            return false
        })
    }, [rooms, selectedDepartment, selectedDeptId])

    const roomOptions = useMemo(() => {
        if (filteredRoomsForFilterBar.length > 0) {
            return filteredRoomsForFilterBar.map((r) => ({
                id: r.id,
                label: `${resolvePhysicalRoomCode(r, r.ten_phong || r.tenPhong, 'PK')} - ${r.ten_phong || r.tenPhong}${!r.chuyen_khoa_id ? ' (Phòng chung)' : ''}`,
                chuyen_khoa_id: r.chuyen_khoa_id,
            }))
        }
        return []
    }, [filteredRoomsForFilterBar])

    const modalRoomOptions = useMemo(() => {
        const selectedDoc = doctors.find((d) => String(d.id) === String(createShiftForm.bac_si_id))
        const docDeptId = selectedDoc?.chuyen_khoa_id

        return rooms
            .filter((r) => {
                // CHỈ CHO PHÉP BUỒNG KHÁM BỆNH LÂM SÀNG
                if (r.loai_phong && r.loai_phong !== 'kham_benh') return false
                // Nếu chưa chọn bác sĩ, cho phép tất cả buồng khám bệnh lâm sàng
                if (!docDeptId) return true
                // Buồng chung (không gắn chuyên khoa) HOẶC buồng cùng chuyên khoa của bác sĩ
                return !r.chuyen_khoa_id || r.chuyen_khoa_id === docDeptId
            })
            .map((r) => ({
                id: r.id,
                label: `${resolvePhysicalRoomCode(r, r.ten_phong || r.tenPhong, 'PK')} - ${r.ten_phong || r.tenPhong}${!r.chuyen_khoa_id ? ' (Phòng chung)' : ''}`,
            }))
    }, [rooms, doctors, createShiftForm.bac_si_id])

    const shiftsForSelectedRoomDate = useMemo(() => {
        if (roomDateShiftsFromApi && roomDateShiftsFromApi.length > 0) {
            return roomDateShiftsFromApi.map((s) => ({
                id: s.id,
                bac_si_id: s.bac_si_id,
                ten_bac_si: s.ten_bac_si,
                chuyen_khoa: s.chuyen_khoa,
                ngay: s.ngay_lam_viec,
                ca: s.ca_lam_viec,
                phong_kham_id: s.phong_kham_id,
                ten_phong_kham: s.ten_phong || s.phong_kham || 'Buồng khám',
                short_room_code: s.ma_phong || resolvePhysicalRoomCode(null, s.ten_phong || s.phong_kham, 'PK'),
                so_cho_online: s.han_muc_dat_truoc || 0,
                so_cho_quay: s.han_muc_vang_lai || 0,
                so_cho_tong: s.gioi_han_ca_kham || ((s.han_muc_dat_truoc || 0) + (s.han_muc_vang_lai || 0)),
                da_dat_online: s.so_luong_da_dat || 0,
                da_dat_quay: 0,
                is_active: s.is_active,
                ghi_chu_nghi: s.ghi_chu_nghi,
            }))
        }
        return shiftsList.filter((s) => s.ngay === selectedRoomDate && s.is_active)
    }, [roomDateShiftsFromApi, shiftsList, selectedRoomDate])

    const roomMatrixForDate = useMemo(() => {
        return rooms.map((room) => {
            const sangShift = shiftsForSelectedRoomDate.find(
                (s) => String(s.phong_kham_id) === String(room.id) && s.ca === 'sang'
            )
            const chieuShift = shiftsForSelectedRoomDate.find(
                (s) => String(s.phong_kham_id) === String(room.id) && s.ca === 'chieu'
            )
            return {
                room,
                shortCode: resolvePhysicalRoomCode(room, room.ten_phong || room.tenPhong, 'PK'),
                sang: sangShift || null,
                chieu: chieuShift || null,
            }
        })
    }, [rooms, shiftsForSelectedRoomDate])

    const handleCellClick = (doctor, isoDate, ca) => {
        const leaveKey = `${doctor.id}_${isoDate}_${ca}`
        const leaveKeyAll = `${doctor.id}_${isoDate}_all`
        const activeLeave = doctorLeavesMap.get(leaveKey) || doctorLeavesMap.get(leaveKeyAll)

        const key = `${doctor.id}_${isoDate}_${ca}`
        const existingShift = shiftsByDoctorAndSlot.get(key)

        if (activeLeave || existingShift?.trang_thai_ca === 'NGHI_PHEP' || existingShift?.trang_thai_ca === 'NGHI_DOT_XUAT') {
            setSelectedLeaveForDetail({
                id: activeLeave?.id || existingShift?.id || 'LEAVE',
                bac_si_id: doctor.id,
                ten_bac_si: doctor.ho_ten,
                chuyen_khoa: doctor.chuyen_khoa,
                ngay: isoDate,
                ca,
                tu_ngay: activeLeave?.tu_ngay || isoDate,
                den_ngay: activeLeave?.den_ngay || isoDate,
                loai_nghi: activeLeave?.loai_nghi || existingShift?.trang_thai_ca || 'NGHI_PHEP',
                ly_do: activeLeave?.ly_do || existingShift?.ghi_chu_nghi || 'Nghỉ phép theo kế hoạch',
                trang_thai: activeLeave?.trang_thai || 'DA_DUYET',
            })
            setShowLeaveInfoModal(true)
            return
        }

        if (existingShift && existingShift.trang_thai_ca !== 'CHUA_PHAN_CA') {
            setSelectedShiftForDetail(existingShift)
            setShowDetailModal(true)
        } else {
            if (!userCanEdit) {
                AppToast.warning('Bạn không có quyền phân ca trực!')
                return
            }
            const defaultRoom = rooms.find((r) => r.chuyen_khoa_id === doctor.chuyen_khoa_id) || rooms[0]
            setCreateShiftForm({
                bac_si_id: doctor.id,
                ngay: isoDate,
                ca,
                phong_kham_id: defaultRoom ? defaultRoom.id : '',
                so_cho_online: 6,
                so_cho_quay: 2,
                is_active: true,
                ghi_chu_nghi: '',
            })
            setShowCreateModal(true)
        }
    }

    const handleCreateShiftSubmit = async (e) => {
        e.preventDefault()
        if (!createShiftForm.bac_si_id || !createShiftForm.ngay || !createShiftForm.phong_kham_id) {
            AppToast.error('Vui lòng chọn đầy đủ Bác sĩ, Ngày khám và Buồng khám!')
            return
        }

        setActionLoading(true)
        const onlineQ = Number(createShiftForm.so_cho_online) || 0
        const counterQ = Number(createShiftForm.so_cho_quay) || 0
        const isMorning = createShiftForm.ca === 'sang'

        const payload = {
            bac_si_id: Number(createShiftForm.bac_si_id),
            phong_kham_id: createShiftForm.phong_kham_id ? Number(createShiftForm.phong_kham_id) : null,
            ngay_lam_viec: createShiftForm.ngay,
            ca_lam_viec: createShiftForm.ca,
            gio_bat_dau: isMorning ? '07:30:00' : '13:30:00',
            gio_ket_thuc: isMorning ? '11:30:00' : '17:00:00',
            gioi_han_ca_kham: onlineQ + counterQ || 12,
            han_muc_dat_truoc: onlineQ,
            han_muc_vang_lai: counterQ,
            ghi_chu: createShiftForm.ghi_chu_nghi || 'Phân ca định kỳ',
        }

        try {
            await adminService.createShiftAdmin(payload)
            AppToast.success('Phân ca làm việc cho bác sĩ thành công!')
            setShowCreateModal(false)
            fetchMatrix()
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Lỗi khi phân ca trực khám!'
            AppToast.error(errorMsg)
        } finally {
            setActionLoading(false)
        }
    }

    const handleToggleLockShift = async () => {
        if (!selectedShiftForDetail?.id) return
        setActionLoading(true)
        try {
            await adminService.toggleLockShiftAdmin(selectedShiftForDetail.id, {
                is_active: !selectedShiftForDetail.is_active,
                ghi_chu_nghi: selectedShiftForDetail.is_active ? 'Khóa ca trực bởi Quản trị viên' : '',
            })
            AppToast.success(selectedShiftForDetail.is_active ? 'Đã tạm khóa ca trực!' : 'Đã mở lại ca trực!')
            setShowDetailModal(false)
            fetchMatrix()
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Không thể cập nhật trạng thái ca trực!'
            AppToast.error(errorMsg)
        } finally {
            setActionLoading(false)
        }
    }

    const handleCopyScheduleToNextWeek = async () => {
        setActionLoading(true)
        const nextMonday = addDays(currentMonday, 7)
        const nextSunday = addDays(nextMonday, 6)
        try {
            const res = await adminService.generateShiftsFromRosterAdmin({
                template_type: 'COPY_PREVIOUS_WEEK',
                nguon_tu_ngay: tuNgay,
                nguon_den_ngay: denNgay,
                tu_ngay: formatDateToIso(nextMonday),
                den_ngay: formatDateToIso(nextSunday),
                bac_si_ids: null,
            })
            const data = res?.data || res
            const soTao = data?.so_ca_tao_thanh_cong ?? 0
            AppToast.success(`Đã sao chép lịch sang tuần ${formatDateToIso(nextMonday)} thành công! Đã tạo ${soTao} ca.`)
            setShowCopyModal(false)
            setCurrentMonday(nextMonday)
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Không thể sao chép lịch sang tuần sau!'
            AppToast.error(errorMsg)
        } finally {
            setActionLoading(false)
        }
    }

    const handleInheritPreviousWeek = async () => {
        setActionLoading(true)
        const prevMonday = addDays(currentMonday, -7)
        const prevSunday = addDays(prevMonday, 6)
        try {
            const res = await adminService.generateShiftsFromRosterAdmin({
                template_type: 'COPY_PREVIOUS_WEEK',
                nguon_tu_ngay: formatDateToIso(prevMonday),
                nguon_den_ngay: formatDateToIso(prevSunday),
                tu_ngay: tuNgay,
                den_ngay: denNgay,
                bac_si_ids: null,
            })
            const data = res?.data || res
            const soTao = data?.so_ca_tao_thanh_cong ?? 0
            AppToast.success(`Kế thừa lịch thành công! Đã tạo ${soTao} ca trực cho tuần hiện tại.`)
            setShowInheritModal(false)
            fetchMatrix()
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Không thể kế thừa lịch từ tuần trước!'
            AppToast.error(errorMsg)
        } finally {
            setActionLoading(false)
        }
    }

    const handleOpenQuickFill = (doctor) => {
        const defaultRoom = rooms.find((r) => r.chuyen_khoa_id === doctor.chuyen_khoa_id) || rooms[0]
        setQuickFillDoctor(doctor)
        setQuickFillRoomId(defaultRoom ? String(defaultRoom.id) : '')
        setQuickFillShiftPattern('both_weekdays')
        setQuickFillOnlineQuota(6)
        setQuickFillCounterQuota(2)
        setShowQuickFillModal(true)
    }

    const handleQuickFillSubmit = async (e) => {
        e.preventDefault()
        if (!quickFillDoctor || !quickFillRoomId) {
            AppToast.error('Vui lòng chọn buồng khám!')
            return
        }

        setActionLoading(true)
        try {
            const targetDays = daysOfWeek.filter((day) => {
                if (quickFillShiftPattern === 'all_week') return true
                return !day.isWeekend
            })

            const caTypes = []
            if (quickFillShiftPattern === 'morning_weekdays') {
                caTypes.push('sang')
            } else if (quickFillShiftPattern === 'afternoon_weekdays') {
                caTypes.push('chieu')
            } else {
                caTypes.push('sang', 'chieu')
            }

            const promises = []
            targetDays.forEach((day) => {
                caTypes.forEach((ca) => {
                    const isMorning = ca === 'sang'
                    const onlineQ = Number(quickFillOnlineQuota) || 6
                    const counterQ = Number(quickFillCounterQuota) || 2
                    promises.push(
                        adminService.createShiftAdmin({
                            bac_si_id: Number(quickFillDoctor.id),
                            phong_kham_id: Number(quickFillRoomId),
                            ngay_lam_viec: day.isoDate,
                            ca_lam_viec: ca,
                            gio_bat_dau: isMorning ? '07:30:00' : '13:30:00',
                            gio_ket_thuc: isMorning ? '11:30:00' : '17:00:00',
                            gioi_han_ca_kham: onlineQ + counterQ,
                            han_muc_dat_truoc: onlineQ,
                            han_muc_vang_lai: counterQ,
                            ghi_chu: 'Phân ca tuần định kỳ',
                        })
                    )
                })
            })

            await Promise.all(promises)
            AppToast.success(`Đã điền nhanh lịch cả tuần cho ${quickFillDoctor.ho_ten}!`)
            setShowQuickFillModal(false)
            fetchMatrix()
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Lỗi khi điền nhanh lịch tuần!'
            AppToast.error(errorMsg)
        } finally {
            setActionLoading(false)
        }
    }

    const handleClearDoctorWeek = async (doctor) => {
        const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa toàn bộ ca trực trong tuần của ${doctor.ho_ten}?`)
        if (!confirmed) return

        setActionLoading(true)
        try {
            const doctorShifts = shiftsList.filter(
                (s) => s.bac_si_id === doctor.id && s.ngay >= tuNgay && s.ngay <= denNgay
            )
            const lockPromises = doctorShifts.map((s) =>
                adminService.toggleLockShiftAdmin(s.id, {
                    is_active: false,
                    ghi_chu_nghi: 'Quản trị viên xóa lịch tuần',
                })
            )
            await Promise.all(lockPromises)
            AppToast.success(`Đã làm sạch lịch tuần của ${doctor.ho_ten}!`)
            fetchMatrix()
        } catch {
            AppToast.error('Không thể xóa lịch tuần của bác sĩ!')
        } finally {
            setActionLoading(false)
        }
    }

    const handleExportExcel = async () => {
        if (shiftsList.length === 0) {
            AppToast.warning('Không có dữ liệu ca trực trong tuần để xuất báo cáo!')
            return
        }

        const headers = [
            'Mã Ca',
            'Ngày Khám',
            'Thứ',
            'Ca Trực',
            'Bác Sĩ',
            'Học Vị',
            'Chuyên Khoa',
            'Mã Buồng',
            'Tên Buồng Khám',
            'Slot Online',
            'Slot Quầy',
            'Tổng Slot',
            'Đã Đặt Online',
            'Đã Đặt Quầy',
            'Trạng Thái',
            'Xung Đột',
        ]

        const rows = shiftsList.map((s) => {
            const dayObj = daysOfWeek.find((d) => d.isoDate === s.ngay)
            const conflictKey = `${s.bac_si_id}_${s.ngay}_${s.ca}`
            const conflict = conflictsMap.get(conflictKey)
            return [
                s.id || '',
                s.ngay,
                dayObj ? dayObj.label : '',
                s.ca === 'sang' ? 'Sáng (07:30 - 11:30)' : 'Chiều (13:30 - 17:00)',
                s.ten_bac_si,
                extractDoctorTitle(s.ten_bac_si),
                s.chuyen_khoa || '',
                s.short_room_code,
                s.ten_phong_kham,
                s.so_cho_online,
                s.so_cho_quay,
                s.so_cho_tong,
                s.da_dat_online,
                s.da_dat_quay,
                s.is_active ? 'Đang hoạt động' : 'Tạm khóa',
                conflict ? conflict.message : 'Không',
            ]
        })

        await exportToExcel({
            filename: `Lich_Truc_Bac_Si_${tuNgay}_${denNgay}.xlsx`,
            sheetName: 'Phân Lịch Trực',
            title: `BẢNG PHÂN LỊCH TRỰC BÁC SĨ (TỪ ${tuNgay} ĐẾN ${denNgay})`,
            headers,
            rows,
        })
        AppToast.success('Đã xuất báo cáo lịch trực OpenXML (.xlsx) thành công!')
    }

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-[#00263C]">Phân Lịch Trực & Điều Phối Ca Khám</h2>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-[#009EDB]">
                                Ma trận HIS & Medpro
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Lập kế hoạch phân bổ bác sĩ tại buồng khám, kiểm soát slot trực tuyến / tại quầy và phát hiện xung đột lịch tự động
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {userCanEdit && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setShowInheritModal(true)}
                                    className="medpro-btn-secondary !py-2 !px-3 text-xs flex items-center gap-1.5"
                                    title="Kế thừa toàn bộ lịch từ tuần trước"
                                >
                                    <ClockCounterClockwise size={14} />
                                    <span>Kế thừa tuần trước</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCopyModal(true)}
                                    className="medpro-btn-secondary !py-2 !px-3 text-xs flex items-center gap-1.5"
                                    title="Sao chép toàn bộ lịch tuần này sang tuần sau"
                                >
                                    <Copy size={14} />
                                    <span>Sao chép tuần sau</span>
                                </button>
                            </>
                        )}

                        <button
                            type="button"
                            onClick={handleExportExcel}
                            className="medpro-btn-secondary !py-2 !px-3 text-xs flex items-center gap-1.5"
                        >
                            <DownloadSimple size={14} />
                            <span>Xuất Excel</span>
                        </button>

                        <button
                            type="button"
                            onClick={fetchMatrix}
                            className="medpro-btn-secondary !py-2 !px-2.5 text-xs"
                            title="Tải lại ma trận"
                        >
                            <ArrowsClockwise size={15} className={loading ? 'animate-spin' : ''} />
                        </button>

                        {userCanEdit && (
                            <button
                                type="button"
                                onClick={() => {
                                    const defaultDoc = doctors[0]
                                    const defaultRoom = rooms[0]
                                    setCreateShiftForm({
                                        bac_si_id: defaultDoc ? defaultDoc.id : '',
                                        ngay: todayIso,
                                        ca: 'sang',
                                        phong_kham_id: defaultRoom ? defaultRoom.id : '',
                                        so_cho_online: 6,
                                        so_cho_quay: 2,
                                        is_active: true,
                                        ghi_chu_nghi: '',
                                    })
                                    setShowCreateModal(true)
                                }}
                                className="medpro-btn-primary !py-2 !px-3 text-xs flex items-center gap-1.5 shadow-xs"
                            >
                                <Plus size={15} weight="bold" />
                                <span>Phân ca</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setActiveView('WEEK_MATRIX')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                activeView === 'WEEK_MATRIX'
                                    ? 'bg-[#00263C] text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-[#00263C]'
                            }`}
                        >
                            <CalendarCheck size={14} />
                            <span>Ma trận Tuần</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveView('ROOM_VIEW')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                activeView === 'ROOM_VIEW'
                                    ? 'bg-[#00263C] text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-[#00263C]'
                            }`}
                        >
                            <Buildings size={14} />
                            <span>Theo Buồng khám</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveView('LIST_VIEW')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                activeView === 'LIST_VIEW'
                                    ? 'bg-[#00263C] text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-[#00263C]'
                            }`}
                        >
                            <ListChecks size={14} />
                            <span>Danh sách ca</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {activeView === 'WEEK_MATRIX' ? (
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={handlePreviousWeek}
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
                                    title="Tuần trước"
                                >
                                    <CaretLeft size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCurrentWeek}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-[#003553] transition cursor-pointer"
                                >
                                    Tuần này
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNextWeek}
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
                                    title="Tuần sau"
                                >
                                    <CaretRight size={14} />
                                </button>
                                <div className="text-xs font-bold text-[#00263C] px-2 py-1 bg-slate-50 rounded-lg border border-slate-200">
                                    {tuNgay} → {denNgay}
                                </div>
                            </div>
                        ) : activeView === 'ROOM_VIEW' ? (
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={handlePreviousRoomDay}
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
                                    title="Hôm trước"
                                >
                                    <CaretLeft size={14} />
                                </button>
                                <input
                                    type="date"
                                    value={selectedRoomDate}
                                    onChange={(e) => setSelectedRoomDate(e.target.value)}
                                    className="medpro-input !py-1 !px-2 text-xs font-bold text-[#00263C]"
                                />
                                <button
                                    type="button"
                                    onClick={handleNextRoomDay}
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
                                    title="Hôm sau"
                                >
                                    <CaretRight size={14} />
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                            <Funnel size={13} className="text-[#009EDB]" /> Lọc nhanh:
                        </span>

                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Tìm tên bác sĩ..."
                                value={searchDoctor}
                                onChange={(e) => setSearchDoctor(e.target.value)}
                                className="medpro-input !py-1 !pl-7 !pr-2 text-xs w-44"
                            />
                            <MagnifyingGlass size={13} className="absolute left-2 top-2 text-slate-400" />
                        </div>

                        <select
                            value={selectedDepartment}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                            className="medpro-select !py-1 text-xs"
                        >
                            <option value="ALL">Tất cả chuyên khoa</option>
                            {departmentsList.map((dept) => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>

                        <select
                            value={selectedRoomFilter}
                            onChange={(e) => setSelectedRoomFilter(e.target.value)}
                            className="medpro-select !py-1 text-xs"
                        >
                            <option value="ALL">Tất cả buồng khám</option>
                            {roomOptions.map((r) => (
                                <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                        </select>

                        <select
                            value={selectedTitleFilter}
                            onChange={(e) => setSelectedTitleFilter(e.target.value)}
                            className="medpro-select !py-1 text-xs"
                        >
                            <option value="ALL">Tất cả học vị</option>
                            {titlesList.filter((t) => t !== 'ALL').map((title) => (
                                <option key={title} value={title}>{title}</option>
                            ))}
                        </select>

                        <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                            <input
                                type="checkbox"
                                checked={showConflictOnly}
                                onChange={(e) => setShowConflictOnly(e.target.checked)}
                                className="rounded text-rose-600 focus:ring-rose-500"
                            />
                            <span className="text-rose-700 font-bold">Chỉ ca có xung đột ⚠️</span>
                        </label>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowSlotDetails(!showSlotDetails)}
                            className={`h-8 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                showSlotDetails
                                    ? 'bg-[#00263C] text-[#00B5F1] border-[#00B5F1]'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                            title="Bật/Tắt hiển thị số slot Onl / Quầy trên từng ô lịch"
                        >
                            <SlidersHorizontal size={13} />
                            <span>{showSlotDetails ? 'Ẩn Slot Onl/Q' : 'Hiện Slot Onl/Q'}</span>
                        </button>
                    </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600 select-none">
                    <span className="font-bold text-[#00263C] text-xs">Chú giải:</span>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300 inline-block"></span>
                        <span>Ca Sáng (07:30 - 11:30)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded bg-sky-100 border border-sky-300 inline-block"></span>
                        <span>Ca Chiều (13:30 - 17:00)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded border border-dashed border-slate-300 bg-white inline-block"></span>
                        <span>Chưa xếp ca (+)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300 inline-block"></span>
                        <span>Nghỉ phép / Nghỉ ca</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded bg-rose-100 border border-rose-400 inline-block"></span>
                        <span className="text-rose-700 font-bold">Xung đột lịch ⚠️</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded bg-slate-300 border border-slate-400 inline-block"></span>
                        <span>Cuối tuần (T7, CN)</span>
                    </div>
                </div>
            </div>

            {activeView === 'WEEK_MATRIX' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="max-h-[640px] overflow-auto relative">
                        <table className="w-full text-left border-collapse min-w-[1050px]">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th
                                        rowSpan={2}
                                        className="sticky top-0 left-0 bg-slate-50 z-40 p-2.5 text-xs font-black text-[#00263C] border-r border-slate-200 w-[245px] min-w-[245px] max-w-[245px] shadow-2xs"
                                    >
                                        Bác sĩ & Chuyên khoa
                                    </th>
                                    {daysOfWeek.map((day) => (
                                        <th
                                            key={day.isoDate}
                                            colSpan={2}
                                            className={`sticky top-0 z-30 p-2 text-center text-xs font-bold border-l border-slate-200 ${
                                                day.isWeekend
                                                    ? 'bg-slate-200/90 text-slate-900 border-l-2 border-slate-300 font-extrabold'
                                                    : day.isToday
                                                    ? 'bg-sky-100/80 text-[#00263C] ring-2 ring-[#00B5F1] ring-inset'
                                                    : 'bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                <span>{day.label}</span>
                                                {day.isWeekend && (
                                                    <span className="px-1 py-0.2 rounded bg-slate-700 text-white text-[9px] font-black uppercase tracking-wider">
                                                        Cuối tuần
                                                    </span>
                                                )}
                                                {day.isToday && (
                                                    <span className="px-1 py-0.2 rounded bg-[#00B5F1] text-[#00263C] text-[9px] font-black uppercase tracking-wider">
                                                        Hôm nay
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] font-normal text-slate-500 mt-0.5">({day.displayDate})</div>
                                        </th>
                                    ))}
                                </tr>
                                <tr className="border-b border-slate-200">
                                    {daysOfWeek.map((day) => (
                                        <Fragment key={day.isoDate}>
                                            <th
                                                className={`sticky top-[35px] z-30 p-1 text-center text-[11px] font-bold border-l border-slate-200 ${
                                                    day.isWeekend ? 'bg-slate-200 text-slate-800' : 'bg-slate-100/90 text-slate-600'
                                                }`}
                                            >
                                                S
                                            </th>
                                            <th
                                                className={`sticky top-[35px] z-30 p-1 text-center text-[11px] font-bold border-l border-slate-200 ${
                                                    day.isWeekend ? 'bg-slate-200 text-slate-800' : 'bg-slate-100/90 text-slate-600'
                                                }`}
                                            >
                                                C
                                            </th>
                                        </Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredDoctors.length === 0 ? (
                                    <tr>
                                        <td colSpan={15} className="p-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <EmptyState size={36} className="text-slate-300" />
                                                <p className="text-xs">Không tìm thấy bác sĩ nào phù hợp điều kiện lọc</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDoctors.map((doc) => {
                                        const weeklyShiftCount = doctorWeeklyShiftCounts.get(doc.id) || 0
                                        const isDoctorEmptyWeek = weeklyShiftCount === 0

                                        return (
                                            <tr key={doc.id} className="hover:bg-slate-50/70 transition group/row">
                                                <td className="sticky left-0 bg-white z-20 shadow-2xs p-2 border-r border-slate-200 align-middle w-[245px] min-w-[245px] max-w-[245px]">
                                                    <div className="flex items-start gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#003553] to-[#00B5F1] text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                                                            {getDoctorInitials(doc.ho_ten)}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-extrabold text-[#003553] text-xs leading-snug break-words">
                                                                {doc.ho_ten}
                                                            </div>
                                                            <div className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                                                                {doc.chuyen_khoa || 'Đa khoa'} • {extractDoctorTitle(doc.ho_ten)}
                                                            </div>

                                                            {isDoctorEmptyWeek && (
                                                                <div className="mt-1">
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                        ⚠️ Chưa có lịch tuần
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {userCanEdit && (
                                                                <div className="flex items-center gap-1.5 mt-1 opacity-0 group-hover/row:opacity-100 transition">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenQuickFill(doc)}
                                                                        className="px-1.5 py-0.5 rounded bg-sky-50 text-[#009EDB] hover:bg-[#00B5F1] hover:text-[#00263C] text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                                                                        title="Điền nhanh lịch cả tuần cho bác sĩ này"
                                                                    >
                                                                        <Lightning size={10} weight="fill" />
                                                                        <span>Điền tuần</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleClearDoctorWeek(doc)}
                                                                        className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                                                                        title="Xóa toàn bộ lịch tuần của bác sĩ này"
                                                                    >
                                                                        <Trash size={10} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {daysOfWeek.map((day) => {
                                                    const keySang = `${doc.id}_${day.isoDate}_sang`
                                                    const keyChieu = `${doc.id}_${day.isoDate}_chieu`
                                                    const shiftSang = shiftsByDoctorAndSlot.get(keySang)
                                                    const shiftChieu = shiftsByDoctorAndSlot.get(keyChieu)

                                                    const leaveKeySang = `${doc.id}_${day.isoDate}_sang`
                                                    const leaveKeyChieu = `${doc.id}_${day.isoDate}_chieu`
                                                    const leaveKeyAll = `${doc.id}_${day.isoDate}_all`
                                                    const leaveSang = doctorLeavesMap.get(leaveKeySang) || doctorLeavesMap.get(leaveKeyAll)
                                                    const leaveChieu = doctorLeavesMap.get(leaveKeyChieu) || doctorLeavesMap.get(leaveKeyAll)

                                                    const conflictSang = conflictsMap.get(keySang)
                                                    const conflictChieu = conflictsMap.get(keyChieu)

                                                    const isSangLeave = Boolean(leaveSang) || shiftSang?.trang_thai_ca === 'NGHI_PHEP' || shiftSang?.trang_thai_ca === 'NGHI_DOT_XUAT'
                                                    const isSangEmergency = leaveSang?.loai_nghi === 'NGHI_DOT_XUAT' || shiftSang?.trang_thai_ca === 'NGHI_DOT_XUAT'
                                                    const sangReason = shiftSang?.ghi_chu_nghi || leaveSang?.ly_do || 'Nghỉ phép theo kế hoạch'
                                                    const hasSangShift = Boolean(shiftSang) && shiftSang.trang_thai_ca !== 'CHUA_PHAN_CA' && !isSangLeave
                                                    const isSangConflict = Boolean(conflictSang || shiftSang?.is_conflict)

                                                    const isChieuLeave = Boolean(leaveChieu) || shiftChieu?.trang_thai_ca === 'NGHI_PHEP' || shiftChieu?.trang_thai_ca === 'NGHI_DOT_XUAT'
                                                    const isChieuEmergency = leaveChieu?.loai_nghi === 'NGHI_DOT_XUAT' || shiftChieu?.trang_thai_ca === 'NGHI_DOT_XUAT'
                                                    const chieuReason = shiftChieu?.ghi_chu_nghi || leaveChieu?.ly_do || 'Nghỉ phép theo kế hoạch'
                                                    const hasChieuShift = Boolean(shiftChieu) && shiftChieu.trang_thai_ca !== 'CHUA_PHAN_CA' && !isChieuLeave
                                                    const isChieuConflict = Boolean(conflictChieu || shiftChieu?.is_conflict)

                                                    return (
                                                        <Fragment key={day.isoDate}>
                                                            <td
                                                                className={`p-1 border-l border-slate-100 align-middle text-center ${
                                                                    day.isWeekend ? 'bg-slate-100/60' : day.isToday ? 'bg-sky-50/20' : ''
                                                                }`}
                                                            >
                                                                {isSangLeave ? (
                                                                    <div
                                                                        onClick={() => handleCellClick(doc, day.isoDate, 'sang')}
                                                                        className={`h-[46px] rounded-lg border p-1 flex flex-col items-center justify-center cursor-pointer transition shadow-2xs ${
                                                                            isSangEmergency
                                                                                ? 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100'
                                                                                : 'border-slate-200 bg-slate-100/90 text-slate-500 hover:bg-slate-200/80'
                                                                        }`}
                                                                        title={`Bác sĩ ${isSangEmergency ? 'nghỉ đột xuất' : 'nghỉ phép'}: ${sangReason}`}
                                                                    >
                                                                        <span className="font-bold text-[11px]">{isSangEmergency ? 'Nghỉ đột xuất' : 'Nghỉ phép'}</span>
                                                                        <span className="text-[9px] opacity-80">{isSangEmergency ? 'Khẩn cấp ⚠️' : 'Đã duyệt'}</span>
                                                                    </div>
                                                                ) : hasSangShift ? (
                                                                    <div
                                                                        onClick={() => handleCellClick(doc, day.isoDate, 'sang')}
                                                                        className={`h-[46px] rounded-lg border p-1 flex flex-col items-center justify-center cursor-pointer transition shadow-2xs relative ${
                                                                            isSangConflict
                                                                                ? 'border-2 border-rose-500 bg-rose-50 hover:bg-rose-100 text-rose-900 ring-2 ring-rose-400/50'
                                                                                : shiftSang.is_active
                                                                                ? 'border-amber-300/80 bg-amber-50 hover:bg-amber-100/70 text-amber-900'
                                                                                : 'border-slate-200 bg-slate-100 hover:bg-slate-200/60 text-slate-500 opacity-60'
                                                                        }`}
                                                                        title={`${shiftSang.short_room_code} - ${shiftSang.ten_phong_kham} • Sáng (07:30 - 11:30) • Tổng: ${shiftSang.so_cho_tong} slot (Onl: ${shiftSang.so_cho_online} | Quầy: ${shiftSang.so_cho_quay}) • Click xem chi tiết`}
                                                                    >
                                                                        {isSangConflict && (
                                                                            <span className="absolute -top-1 -right-1 text-xs">⚠️</span>
                                                                        )}
                                                                        <span className="font-black text-xs tracking-tight">
                                                                            {shiftSang.short_room_code}
                                                                        </span>
                                                                        {showSlotDetails ? (
                                                                            <span className="text-[10px] font-semibold opacity-90 tracking-tighter mt-0.5">
                                                                                {shiftSang.so_cho_online} Onl · {shiftSang.so_cho_quay} Q
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                ) : (
                                                                    <div
                                                                        onClick={() => handleCellClick(doc, day.isoDate, 'sang')}
                                                                        className="group h-[46px] rounded-lg border border-dashed border-slate-200 bg-white hover:border-[#00B5F1] hover:bg-sky-50/50 flex items-center justify-center transition cursor-pointer"
                                                                        title={`Chưa xếp ca • Bấm để phân ca Sáng cho ${doc.ho_ten}`}
                                                                    >
                                                                        <span className="text-slate-300 group-hover:text-[#00B5F1] group-hover:scale-110 transition">
                                                                            <Plus size={14} weight="bold" />
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </td>

                                                            <td
                                                                className={`p-1 border-l border-slate-100 align-middle text-center ${
                                                                    day.isWeekend ? 'bg-slate-100/60' : day.isToday ? 'bg-sky-50/20' : ''
                                                                }`}
                                                            >
                                                                {isChieuLeave ? (
                                                                    <div
                                                                        onClick={() => handleCellClick(doc, day.isoDate, 'chieu')}
                                                                        className={`h-[46px] rounded-lg border p-1 flex flex-col items-center justify-center cursor-pointer transition shadow-2xs ${
                                                                            isChieuEmergency
                                                                                ? 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100'
                                                                                : 'border-slate-200 bg-slate-100/90 text-slate-500 hover:bg-slate-200/80'
                                                                        }`}
                                                                        title={`Bác sĩ ${isChieuEmergency ? 'nghỉ đột xuất' : 'nghỉ phép'}: ${chieuReason}`}
                                                                    >
                                                                        <span className="font-bold text-[11px]">{isChieuEmergency ? 'Nghỉ đột xuất' : 'Nghỉ phép'}</span>
                                                                        <span className="text-[9px] opacity-80">{isChieuEmergency ? 'Khẩn cấp ⚠️' : 'Đã duyệt'}</span>
                                                                    </div>
                                                                ) : hasChieuShift ? (
                                                                    <div
                                                                        onClick={() => handleCellClick(doc, day.isoDate, 'chieu')}
                                                                        className={`h-[46px] rounded-lg border p-1 flex flex-col items-center justify-center cursor-pointer transition shadow-2xs relative ${
                                                                            isChieuConflict
                                                                                ? 'border-2 border-rose-500 bg-rose-50 hover:bg-rose-100 text-rose-900 ring-2 ring-rose-400/50'
                                                                                : shiftChieu.is_active
                                                                                ? 'border-sky-300/80 bg-sky-50 hover:bg-sky-100/70 text-sky-900'
                                                                                : 'border-slate-200 bg-slate-100 hover:bg-slate-200/60 text-slate-500 opacity-60'
                                                                        }`}
                                                                        title={`${shiftChieu.short_room_code} - ${shiftChieu.ten_phong_kham} • Chiều (13:30 - 17:00) • Tổng: ${shiftChieu.so_cho_tong} slot (Onl: ${shiftChieu.so_cho_online} | Quầy: ${shiftChieu.so_cho_quay}) • Click xem chi tiết`}
                                                                    >
                                                                        {isChieuConflict && (
                                                                            <span className="absolute -top-1 -right-1 text-xs">⚠️</span>
                                                                        )}
                                                                        <span className="font-black text-xs tracking-tight">
                                                                            {shiftChieu.short_room_code}
                                                                        </span>
                                                                        {showSlotDetails ? (
                                                                            <span className="text-[10px] font-semibold opacity-90 tracking-tighter mt-0.5">
                                                                                {shiftChieu.so_cho_online} Onl · {shiftChieu.so_cho_quay} Q
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                ) : (
                                                                    <div
                                                                        onClick={() => handleCellClick(doc, day.isoDate, 'chieu')}
                                                                        className="group h-[46px] rounded-lg border border-dashed border-slate-200 bg-white hover:border-[#00B5F1] hover:bg-sky-50/50 flex items-center justify-center transition cursor-pointer"
                                                                        title={`Chưa xếp ca • Bấm để phân ca Chiều cho ${doc.ho_ten}`}
                                                                    >
                                                                        <span className="text-slate-300 group-hover:text-[#00B5F1] group-hover:scale-110 transition">
                                                                            <Plus size={14} weight="bold" />
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </Fragment>
                                                    )
                                                })}
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-slate-300">
                                    <td className="sticky left-0 bottom-0 bg-slate-50 z-40 p-2.5 border-r border-slate-300 font-extrabold text-xs text-[#003553] shadow-xs">
                                        <div>Tổng BS trực / ca</div>
                                        <div className="text-[10px] font-normal text-slate-500">(Thực tế / Chỉ tiêu an toàn)</div>
                                    </td>
                                    {columnShiftTotals.map((col) => {
                                        const isMorningShort = col.morningCount < col.morningTarget
                                        const isAfternoonShort = col.afternoonCount < col.afternoonTarget

                                        return (
                                            <Fragment key={col.date}>
                                                <td
                                                    className={`sticky bottom-0 z-30 p-1.5 border-l border-slate-200 text-center align-middle transition ${
                                                        isMorningShort
                                                            ? 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold'
                                                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
                                                    }`}
                                                    title={`Ca Sáng ${col.date}: ${col.morningCount}/${col.morningTarget} BS ${
                                                        isMorningShort ? '⚠️ Thiếu bác sĩ so với định mức an toàn!' : '✓ Đã đạt định mức'
                                                    }`}
                                                >
                                                    <div className="text-xs font-black tracking-tight">
                                                        {col.morningCount}/{col.morningTarget}
                                                    </div>
                                                    <div className="text-[9px] font-bold opacity-80 uppercase tracking-tighter">
                                                        {isMorningShort ? 'Thiếu' : '✓ Đủ'}
                                                    </div>
                                                </td>

                                                <td
                                                    className={`sticky bottom-0 z-30 p-1.5 border-l border-slate-200 text-center align-middle transition ${
                                                        isAfternoonShort
                                                            ? 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold'
                                                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
                                                    }`}
                                                    title={`Ca Chiều ${col.date}: ${col.afternoonCount}/${col.afternoonTarget} BS ${
                                                        isAfternoonShort ? '⚠️ Thiếu bác sĩ so với định mức an toàn!' : '✓ Đã đạt định mức'
                                                    }`}
                                                >
                                                    <div className="text-xs font-black tracking-tight">
                                                        {col.afternoonCount}/{col.afternoonTarget}
                                                    </div>
                                                    <div className="text-[9px] font-bold opacity-80 uppercase tracking-tighter">
                                                        {isAfternoonShort ? 'Thiếu' : '✓ Đủ'}
                                                    </div>
                                                </td>
                                            </Fragment>
                                        )
                                    })}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {activeView === 'ROOM_VIEW' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <h3 className="font-black text-[#00263C] text-sm">
                                Phân Bố Buồng Khám Ngày {selectedRoomDate}
                            </h3>
                            <span className="text-xs text-slate-500">
                                ({roomMatrixForDate.length} buồng khám vật lý)
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {roomMatrixForDate.map(({ room, shortCode, sang, chieu }) => (
                            <div
                                key={room.id}
                                className="border border-slate-200 rounded-xl p-3 hover:border-[#00B5F1] transition shadow-2xs space-y-2.5 bg-slate-50/30"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-lg bg-[#00263C] text-[#00B5F1] font-black text-xs">
                                            {shortCode}
                                        </span>
                                        <div className="font-extrabold text-[#003553] text-xs">
                                            {room.ten_phong || room.tenPhong}
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-semibold">{room.tang}</span>
                                </div>

                                <div className="space-y-1.5 text-xs">
                                    <div
                                        onClick={() => sang && handleCellClick({ id: sang.bac_si_id, ho_ten: sang.ten_bac_si }, selectedRoomDate, 'sang')}
                                        className={`p-2 rounded-lg border transition cursor-pointer ${
                                            sang
                                                ? 'bg-amber-50 border-amber-200 hover:bg-amber-100/70 text-amber-900'
                                                : 'bg-white border-dashed border-slate-200 text-slate-400'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold flex items-center gap-1">
                                                ☀️ Sáng (07:30 - 11:30)
                                            </span>
                                            {sang && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-200/60">
                                                    {sang.da_dat_online + sang.da_dat_quay}/{sang.so_cho_tong} slot
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 font-semibold truncate">
                                            {sang ? sang.ten_bac_si : 'Chưa xếp bác sĩ'}
                                        </div>
                                    </div>

                                    <div
                                        onClick={() => chieu && handleCellClick({ id: chieu.bac_si_id, ho_ten: chieu.ten_bac_si }, selectedRoomDate, 'chieu')}
                                        className={`p-2 rounded-lg border transition cursor-pointer ${
                                            chieu
                                                ? 'bg-sky-50 border-sky-200 hover:bg-sky-100/70 text-sky-900'
                                                : 'bg-white border-dashed border-slate-200 text-slate-400'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold flex items-center gap-1">
                                                ⛅ Chiều (13:30 - 17:00)
                                            </span>
                                            {chieu && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-200/60">
                                                    {chieu.da_dat_online + chieu.da_dat_quay}/{chieu.so_cho_tong} slot
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 font-semibold truncate">
                                            {chieu ? chieu.ten_bac_si : 'Chưa xếp bác sĩ'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeView === 'LIST_VIEW' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-black text-[#00263C] text-sm">
                            Danh Sách Chi Tiết Ca Trực ({shiftsList.length} ca trực trong tuần)
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                                    <th className="p-3">Mã Ca</th>
                                    <th className="p-3">Ngày & Ca</th>
                                    <th className="p-3">Bác Sĩ</th>
                                    <th className="p-3">Buồng Khám</th>
                                    <th className="p-3 text-center">Slot Onl / Quầy</th>
                                    <th className="p-3 text-center">Đã Đặt</th>
                                    <th className="p-3 text-center">Trạng Thái</th>
                                    <th className="p-3 text-right">Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {shiftsList.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-400">
                                            Không có ca trực nào trong tuần này
                                        </td>
                                    </tr>
                                ) : (
                                    shiftsList.map((shift) => (
                                        <tr key={shift.id} className="hover:bg-slate-50 transition">
                                            <td className="p-3 font-mono font-bold text-[#003553]">#{shift.id}</td>
                                            <td className="p-3">
                                                <div className="font-bold text-[#00263C]">{shift.ngay}</div>
                                                <div className="text-[11px] text-slate-500">
                                                    {shift.ca === 'sang' ? '☀️ Sáng (07:30 - 11:30)' : '⛅ Chiều (13:30 - 17:00)'}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-extrabold text-[#003553]">{shift.ten_bac_si}</div>
                                                <div className="text-[11px] text-slate-500">{shift.chuyen_khoa}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-bold text-slate-800">
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[11px] mr-1">
                                                        {shift.short_room_code}
                                                    </span>
                                                    {shift.ten_phong_kham}
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="font-semibold text-slate-700">
                                                    {shift.so_cho_online} Onl / {shift.so_cho_quay} Q
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="font-bold text-[#009EDB]">
                                                    {shift.da_dat_online + shift.da_dat_quay}
                                                </span>
                                                <span className="text-slate-400"> / {shift.so_cho_tong}</span>
                                            </td>
                                            <td className="p-3 text-center">
                                                {shift.is_active ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        Hoạt động
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                        Tạm khóa
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedShiftForDetail(shift)
                                                        setShowDetailModal(true)
                                                    }}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-[#009EDB] hover:bg-sky-50 transition cursor-pointer"
                                                >
                                                    Chi tiết
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#009EDB] flex items-center justify-center font-bold">
                                    <Plus size={16} weight="bold" />
                                </div>
                                <h3 className="font-black text-[#00263C] text-sm">Phân Ca Trực Khám Bệnh Mới</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateShiftSubmit} className="space-y-3.5 mt-4 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Bác sĩ phụ trách *</label>
                                <select
                                    value={createShiftForm.bac_si_id}
                                    onChange={(e) => setCreateShiftForm({ ...createShiftForm, bac_si_id: e.target.value })}
                                    className="medpro-select w-full"
                                    required
                                >
                                    <option value="">-- Chọn bác sĩ --</option>
                                    {doctors.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.ho_ten} ({d.chuyen_khoa || 'Đa khoa'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Ngày làm việc *</label>
                                    <input
                                        type="date"
                                        value={createShiftForm.ngay}
                                        onChange={(e) => setCreateShiftForm({ ...createShiftForm, ngay: e.target.value })}
                                        className="medpro-input w-full"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Ca trực *</label>
                                    <select
                                        value={createShiftForm.ca}
                                        onChange={(e) => setCreateShiftForm({ ...createShiftForm, ca: e.target.value })}
                                        className="medpro-select w-full"
                                        required
                                    >
                                        <option value="sang">☀️ Ca Sáng (07:30 - 11:30)</option>
                                        <option value="chieu">⛅ Ca Chiều (13:30 - 17:00)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Buồng khám vật lý *</label>
                                <select
                                    value={createShiftForm.phong_kham_id}
                                    onChange={(e) => setCreateShiftForm({ ...createShiftForm, phong_kham_id: e.target.value })}
                                    className="medpro-select w-full"
                                    required
                                >
                                    <option value="">-- Chọn buồng khám --</option>
                                    {modalRoomOptions.map((r) => (
                                        <option key={r.id} value={r.id}>{r.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Hạn mức trực tuyến (Online)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={50}
                                        value={createShiftForm.so_cho_online}
                                        onChange={(e) => setCreateShiftForm({ ...createShiftForm, so_cho_online: Number(e.target.value) })}
                                        className="medpro-input w-full font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Hạn mức tại quầy (Vãng lai)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={50}
                                        value={createShiftForm.so_cho_quay}
                                        onChange={(e) => setCreateShiftForm({ ...createShiftForm, so_cho_quay: Number(e.target.value) })}
                                        className="medpro-input w-full font-bold"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={createShiftForm.is_active}
                                        onChange={(e) => setCreateShiftForm({ ...createShiftForm, is_active: e.target.checked })}
                                        className="rounded text-[#009EDB]"
                                    />
                                    <span>Kích hoạt ngay</span>
                                </label>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer font-bold"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={actionLoading}
                                        className="medpro-btn-primary !py-2 !px-4 text-xs font-bold"
                                    >
                                        {actionLoading ? 'Đang lưu...' : 'Lưu ca trực'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDetailModal && selectedShiftForDetail && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div>
                                <span className="text-[11px] font-mono font-bold text-[#009EDB]">
                                    CHI TIẾT CA TRỰC KHÁM #{selectedShiftForDetail.id}
                                </span>
                                <h3 className="font-black text-[#00263C] text-sm">
                                    {selectedShiftForDetail.ngay} • {selectedShiftForDetail.ca === 'sang' ? '☀️ Ca Sáng' : '⛅ Ca Chiều'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDetailModal(false)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="space-y-3.5 mt-4 text-xs">
                            <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 border border-slate-100">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Bác sĩ phụ trách:</span>
                                    <span className="font-bold text-[#003553]">{selectedShiftForDetail.ten_bac_si}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Chuyên khoa:</span>
                                    <span className="font-semibold text-slate-700">{selectedShiftForDetail.chuyen_khoa}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Buồng khám:</span>
                                    <span className="font-bold text-slate-800">
                                        <span className="px-1.5 py-0.2 rounded bg-slate-200 font-mono text-[10px] mr-1">
                                            {selectedShiftForDetail.short_room_code}
                                        </span>
                                        {selectedShiftForDetail.ten_phong_kham}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Trạng thái:</span>
                                    {selectedShiftForDetail.is_active ? (
                                        <span className="font-bold text-emerald-700">Đang hoạt động</span>
                                    ) : (
                                        <span className="font-bold text-slate-500">Tạm khóa</span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                    <div className="text-[10px] text-slate-500 font-bold uppercase">Tổng Slot</div>
                                    <div className="text-base font-extrabold text-[#003553]">{selectedShiftForDetail.so_cho_tong}</div>
                                </div>
                                <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100">
                                    <div className="text-[10px] text-[#009EDB] font-bold uppercase">Khám Trực Tuyến</div>
                                    <div className="text-sm font-extrabold text-[#003553]">
                                        {selectedShiftForDetail.da_dat_online} / {selectedShiftForDetail.so_cho_online}
                                    </div>
                                </div>
                                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                                    <div className="text-[10px] text-amber-700 font-bold uppercase">Tại Quầy</div>
                                    <div className="text-sm font-extrabold text-[#003553]">
                                        {selectedShiftForDetail.da_dat_quay} / {selectedShiftForDetail.so_cho_quay}
                                    </div>
                                </div>
                            </div>

                            {selectedShiftForDetail.patients && selectedShiftForDetail.patients.length > 0 ? (
                                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                        <span>Bệnh nhân đã đặt ({selectedShiftForDetail.patients.length}):</span>
                                        <span className="text-[10px] text-[#009EDB] font-semibold">Theo thời gian thực</span>
                                    </div>
                                    <div className="max-h-36 overflow-y-auto space-y-1.5 divide-y divide-slate-100 pr-1">
                                        {selectedShiftForDetail.patients.map((p, idx) => (
                                            <div key={p.lich_kham_id || idx} className="pt-1.5 flex items-center justify-between text-xs">
                                                <div>
                                                    <span className="font-bold text-[#00263C]">{p.ten_benh_nhan}</span>
                                                    <span className="text-[11px] text-slate-500 ml-1.5">({p.so_dien_thoai})</span>
                                                    <div className="text-[10px] text-slate-400 font-mono">{p.ma_lich_kham} • Giờ khám: {p.gio_kham || '--:--'}</div>
                                                </div>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.loai_kham === 'dat_truoc' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>
                                                    {p.loai_kham === 'dat_truoc' ? 'Online' : 'Vãng lai'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {userCanEdit && (
                                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={handleToggleLockShift}
                                        disabled={actionLoading}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                            selectedShiftForDetail.is_active
                                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                        }`}
                                    >
                                        <LockKey size={14} />
                                        <span>{selectedShiftForDetail.is_active ? 'Tạm khóa ca trực' : 'Mở lại ca trực'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowDetailModal(false)}
                                        className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition cursor-pointer"
                                    >
                                        Đóng
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showLeaveInfoModal && selectedLeaveForDetail && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                                    <ShieldCheck size={16} />
                                </div>
                                <h3 className="font-black text-[#00263C] text-sm">Thông Tin Bác Sĩ Nghỉ Phép</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowLeaveInfoModal(false)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="space-y-3 mt-4 text-xs">
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Bác sĩ:</span>
                                    <span className="font-bold text-[#003553]">{selectedLeaveForDetail.ten_bac_si}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Chuyên khoa:</span>
                                    <span className="font-semibold text-slate-700">{selectedLeaveForDetail.chuyen_khoa}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Thời gian nghỉ:</span>
                                    <span className="font-bold text-slate-800">
                                        {selectedLeaveForDetail.tu_ngay} → {selectedLeaveForDetail.den_ngay}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Ca áp dụng:</span>
                                    <span className="font-semibold text-slate-700">
                                        {selectedLeaveForDetail.ca_lam_viec === 'all'
                                            ? 'Cả ngày (Sáng & Chiều)'
                                            : selectedLeaveForDetail.ca_lam_viec === 'sang'
                                            ? 'Ca Sáng'
                                            : 'Ca Chiều'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Trạng thái:</span>
                                    <span className="font-bold text-emerald-700">Đã phê duyệt</span>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                                <div className="font-bold text-amber-900 mb-1">Lý do nghỉ phép:</div>
                                <div className="text-slate-700 leading-relaxed">
                                    {selectedLeaveForDetail.ly_do || 'Nghỉ phép theo quy định phòng khám'}
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowLeaveInfoModal(false)}
                                    className="px-4 py-2 rounded-xl bg-[#00263C] text-white font-bold transition hover:bg-[#003553] cursor-pointer"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showQuickFillModal && quickFillDoctor && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#009EDB] flex items-center justify-center font-bold">
                                    <Lightning size={16} weight="fill" />
                                </div>
                                <div>
                                    <h3 className="font-black text-[#00263C] text-sm">Điền Nhanh Lịch Tuần</h3>
                                    <div className="text-[11px] text-slate-500 font-bold">{quickFillDoctor.ho_ten}</div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowQuickFillModal(false)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleQuickFillSubmit} className="space-y-3.5 mt-4 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Buồng khám cố định *</label>
                                <select
                                    value={quickFillRoomId}
                                    onChange={(e) => setQuickFillRoomId(e.target.value)}
                                    className="medpro-select w-full"
                                    required
                                >
                                    <option value="">-- Chọn buồng khám --</option>
                                    {rooms
                                        .filter((r) => (!r.loai_phong || r.loai_phong === 'kham_benh') && (!r.chuyen_khoa_id || !quickFillDoctor?.chuyen_khoa_id || r.chuyen_khoa_id === quickFillDoctor.chuyen_khoa_id))
                                        .map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {resolvePhysicalRoomCode(r, r.ten_phong || r.tenPhong, 'PK')} - {r.ten_phong || r.tenPhong}{!r.chuyen_khoa_id ? ' (Phòng chung)' : ''}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Quy luật trực *</label>
                                <select
                                    value={quickFillShiftPattern}
                                    onChange={(e) => setQuickFillShiftPattern(e.target.value)}
                                    className="medpro-select w-full"
                                >
                                    <option value="both_weekdays">Cả ngày (Sáng & Chiều, Thứ 2 - Thứ 6)</option>
                                    <option value="morning_weekdays">Chỉ ca Sáng (Thứ 2 - Thứ 6)</option>
                                    <option value="afternoon_weekdays">Chỉ ca Chiều (Thứ 2 - Thứ 6)</option>
                                    <option value="all_week">Trọn tuần (Sáng & Chiều, Thứ 2 - Chủ Nhật)</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Slot Online</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={30}
                                        value={quickFillOnlineQuota}
                                        onChange={(e) => setQuickFillOnlineQuota(Number(e.target.value))}
                                        className="medpro-input w-full font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Slot Quầy</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={30}
                                        value={quickFillCounterQuota}
                                        onChange={(e) => setQuickFillCounterQuota(Number(e.target.value))}
                                        className="medpro-input w-full font-bold"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowQuickFillModal(false)}
                                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="medpro-btn-primary !py-2 !px-4 text-xs font-bold"
                                >
                                    {actionLoading ? 'Đang áp dụng...' : 'Áp dụng cho cả tuần'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showInheritModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#009EDB] flex items-center justify-center font-bold">
                                    <ClockCounterClockwise size={16} />
                                </div>
                                <h3 className="font-black text-[#00263C] text-sm">Kế Thừa Lịch Từ Tuần Trước</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowInheritModal(false)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="space-y-3 mt-4 text-xs">
                            <p className="text-slate-600 leading-relaxed">
                                Toàn bộ cấu trúc phân ca từ tuần trước (từ {formatDateToIso(addDays(currentMonday, -7))} đến {formatDateToIso(addDays(currentMonday, -1))}) sẽ được sao chép và áp dụng vào tuần hiện tại ({tuNgay} → {denNgay}).
                            </p>
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
                                Lưu ý: Thao tác này sẽ ghi đè lên các ca trực đã có sẵn trong tuần hiện tại.
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowInheritModal(false)}
                                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="button"
                                    onClick={handleInheritPreviousWeek}
                                    disabled={actionLoading}
                                    className="medpro-btn-primary !py-2 !px-4 text-xs font-bold"
                                >
                                    {actionLoading ? 'Đang kế thừa...' : 'Xác nhận kế thừa'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showCopyModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#009EDB] flex items-center justify-center font-bold">
                                    <Copy size={16} />
                                </div>
                                <h3 className="font-black text-[#00263C] text-sm">Sao Chép Lịch Sang Tuần Sau</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCopyModal(false)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="space-y-3 mt-4 text-xs">
                            <p className="text-slate-600 leading-relaxed">
                                Bạn sắp sao chép toàn bộ ma trận phân ca của tuần hiện tại ({tuNgay} → {denNgay}) sang tuần kế tiếp ({formatDateToIso(addDays(currentMonday, 7))} → {formatDateToIso(addDays(currentMonday, 13))}).
                            </p>
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
                                Tất cả ca trực của tuần sau sẽ được thiết lập tự động theo đúng buồng khám và hạn mức slot hiện tại.
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowCopyModal(false)}
                                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCopyScheduleToNextWeek}
                                    disabled={actionLoading}
                                    className="medpro-btn-primary !py-2 !px-4 text-xs font-bold"
                                >
                                    {actionLoading ? 'Đang sao chép...' : 'Xác nhận sao chép'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
