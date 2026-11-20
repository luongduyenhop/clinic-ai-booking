import { useState, useEffect, useMemo, Fragment } from 'react'
import { useSelector } from 'react-redux'
import { adminService } from '../../services/admin/AdminService'
import { toFriendlyErrorMessage } from '../../utils/helpers/clientErrorHelper'
import { AppToast } from '../common/AppNotification'
import { exportToExcel } from '../../utils/helpers/exportUtils'
import {
    XCircle,
    Plus,
    ArrowsClockwise,
    MagnifyingGlass,
    DownloadSimple,
    CaretLeft,
    CaretRight,
    EmptyState,
    Copy,
    LockKey,
    Warning,
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

const VI_WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật']

export default function DoctorScheduleManagementTab() {
    const { clinicData } = useSelector((state) => state.app.admin)
    const staffList = clinicData?.staffList || []
    const khoaPhongList = clinicData?.catalogs?.khoaPhong || []

    const [currentMonday, setCurrentMonday] = useState(() => getStartOfWeek(new Date()))
    const tuNgay = useMemo(() => formatDateToIso(currentMonday), [currentMonday])
    const denNgay = useMemo(() => formatDateToIso(addDays(currentMonday, 6)), [currentMonday])
    const todayIso = useMemo(() => formatDateToIso(new Date()), [])

    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const [matrixRawData, setMatrixRawData] = useState(null)
    const [doctors, setDoctors] = useState([])
    const [rooms, setRooms] = useState([])
    const [departments, setDepartments] = useState([])
    const [doctorLeaves, setDoctorLeaves] = useState([])

    const [searchDoctor, setSearchDoctor] = useState('')
    const [selectedDepartment, setSelectedDepartment] = useState('ALL')
    const [selectedRoomFilter, setSelectedRoomFilter] = useState('ALL')
    const [showConflictOnly, setShowConflictOnly] = useState(false)

    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [showCopyModal, setShowCopyModal] = useState(false)

    const [selectedShiftForDetail, setSelectedShiftForDetail] = useState(null)

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
            } else if (staffList.length > 0) {
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
            } else if (khoaPhongList.length > 0) {
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
                )
                if (deptObj?.id) {
                    params.chuyenKhoaId = deptObj.id
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
            AppToast.error('Không thể tải ma trận phân ca trực')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchInitialResources()
    }, [])

    useEffect(() => {
        fetchMatrix()
    }, [tuNgay, denNgay, selectedDepartment, selectedRoomFilter])

    const handlePreviousWeek = () => {
        setCurrentMonday(addDays(currentMonday, -7))
    }

    const handleNextWeek = () => {
        setCurrentMonday(addDays(currentMonday, 7))
    }

    const handleCurrentWeek = () => {
        setCurrentMonday(getStartOfWeek(new Date()))
    }

    const roomLookupMap = useMemo(() => {
        const map = new Map()
        rooms.forEach((r) => {
            if (r.id) map.set(String(r.id), r)
            if (r.ten_phong) map.set(r.ten_phong, r)
            if (r.ma_phong) map.set(r.ma_phong, r)
        })
        return map
    }, [rooms])

    const doctorLeavesMap = useMemo(() => {
        const map = new Map()
        doctorLeaves.forEach((leave) => {
            const docId = leave.bac_si_id
            const from = new Date(leave.tu_ngay)
            const to = new Date(leave.den_ngay)
            const caNghi = String(leave.ca_lam_viec || 'all').toLowerCase()
            let curr = new Date(from)
            while (curr <= to) {
                const iso = formatDateToIso(curr)
                if (caNghi === 'all' || caNghi === 'sang') {
                    map.set(`${docId}_${iso}_sang`, leave)
                }
                if (caNghi === 'all' || caNghi === 'chieu') {
                    map.set(`${docId}_${iso}_chieu`, leave)
                }
                curr = addDays(curr, 1)
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
                        is_active: c.is_active,
                        ghi_chu_nghi: c.ghi_chu_nghi,
                    })
                })
            })
        }

        return map
    }, [matrixRawData, roomLookupMap])

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
                        message: `Buồng ${s.short_room_code} bị xếp trùng ${list.length} bác sĩ cùng ca!`,
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
                        message: `Bác sĩ ${s.ten_bac_si} bị xếp trùng ${list.length} ca cùng buổi!`,
                    })
                })
            }
        })

        return conflicts
    }, [shiftsByDoctorAndSlot])

    const departmentsList = useMemo(() => {
        const fromDepts = departments.map((d) => d.ten_chuyen_khoa || d.tenKhoa || d.name).filter(Boolean)
        const fromDocs = doctors.map((d) => d.chuyen_khoa).filter(Boolean)
        return Array.from(new Set([...fromDepts, ...fromDocs]))
    }, [departments, doctors])

    const filteredDoctors = useMemo(() => {
        return doctors.filter((doc) => {
            if (searchDoctor.trim()) {
                const keyword = searchDoctor.trim().toLowerCase()
                const matchName = doc.ho_ten?.toLowerCase().includes(keyword)
                const matchDept = doc.chuyen_khoa?.toLowerCase().includes(keyword)
                if (!matchName && !matchDept) return false
            }
            if (selectedDepartment !== 'ALL') {
                if (doc.chuyen_khoa !== selectedDepartment) return false
            }
            if (selectedRoomFilter !== 'ALL') {
                const hasShiftInRoom = daysOfWeek.some((day) => {
                    const s1 = shiftsByDoctorAndSlot.get(`${doc.id}_${day.isoDate}_sang`)
                    const s2 = shiftsByDoctorAndSlot.get(`${doc.id}_${day.isoDate}_chieu`)
                    return (
                        (s1 && String(s1.phong_kham_id) === String(selectedRoomFilter)) ||
                        (s2 && String(s2.phong_kham_id) === String(selectedRoomFilter))
                    )
                })
                if (!hasShiftInRoom) return false
            }
            if (showConflictOnly) {
                const hasConflict = daysOfWeek.some((day) => {
                    const keySang = `${doc.id}_${day.isoDate}_sang`
                    const keyChieu = `${doc.id}_${day.isoDate}_chieu`
                    return conflictsMap.has(keySang) || conflictsMap.has(keyChieu)
                })
                if (!hasConflict) return false
            }
            return true
        })
    }, [doctors, searchDoctor, selectedDepartment, selectedRoomFilter, showConflictOnly, daysOfWeek, shiftsByDoctorAndSlot, conflictsMap])

    const selectedDocObj = useMemo(() => {
        return doctors.find((d) => String(d.id) === String(createShiftForm.bac_si_id))
    }, [doctors, createShiftForm.bac_si_id])

    const modalRoomOptions = useMemo(() => {
        if (!selectedDocObj) {
            return rooms.map((r) => ({
                id: r.id,
                label: `${r.ma_phong || r.code || 'PK'} - ${r.ten_phong || r.name}`,
            }))
        }
        const docDeptId = selectedDocObj.chuyen_khoa_id
        return rooms
            .filter((r) => !r.chuyen_khoa_id || String(r.chuyen_khoa_id) === String(docDeptId) || r.loai_phong === 'chung')
            .map((r) => ({
                id: r.id,
                label: `${r.ma_phong || r.code || 'PK'} - ${r.ten_phong || r.name}`,
            }))
    }, [rooms, selectedDocObj])

    const handleOpenQuickAssign = (doctor, isoDate, ca) => {
        const docDeptRooms = rooms.filter(
            (r) => !r.chuyen_khoa_id || String(r.chuyen_khoa_id) === String(doctor.chuyen_khoa_id)
        )
        const defaultRoom = docDeptRooms[0] || rooms[0]
        setCreateShiftForm({
            bac_si_id: doctor.id,
            ngay: isoDate,
            ca: ca,
            phong_kham_id: defaultRoom ? defaultRoom.id : '',
            so_cho_online: 6,
            so_cho_quay: 2,
            is_active: true,
            ghi_chu_nghi: '',
        })
        setShowCreateModal(true)
    }

    const handleCreateShiftSubmit = async (e) => {
        e.preventDefault()
        if (!createShiftForm.bac_si_id || !createShiftForm.ngay || !createShiftForm.phong_kham_id) {
            AppToast.error('Vui lòng chọn đầy đủ Bác sĩ, Ngày làm việc và Buồng khám')
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
            gioi_han_ca_kham: onlineQ + counterQ || 8,
            han_muc_dat_truoc: onlineQ,
            han_muc_vang_lai: counterQ,
            ghi_chu: createShiftForm.ghi_chu_nghi || 'Phân ca định kỳ',
        }

        try {
            await adminService.createShiftAdmin(payload)
            AppToast.success('Phân ca làm việc cho bác sĩ thành công')
            setShowCreateModal(false)
            fetchMatrix()
        } catch (error) {
            const errorMsg = toFriendlyErrorMessage(error, 'Lỗi khi phân ca trực khám')
            AppToast.error(errorMsg)
        } finally {
            setActionLoading(false)
        }
    }

    const handleToggleLockShift = async () => {
        if (!selectedShiftForDetail) return
        setActionLoading(true)
        const newStatus = !selectedShiftForDetail.is_active
        try {
            await adminService.lockDoctorShiftAdmin(selectedShiftForDetail.id, {
                is_active: newStatus,
                ghi_chu_nghi: newStatus ? '' : 'Tạm khóa ca trực',
            })
            AppToast.success(newStatus ? 'Đã kích hoạt lại ca trực' : 'Đã tạm khóa ca trực thành công')
            setShowDetailModal(false)
            fetchMatrix()
        } catch (error) {
            const errorMsg = toFriendlyErrorMessage(error, 'Không thể cập nhật trạng thái ca trực')
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
            AppToast.success(`Đã sao chép lịch sang tuần sau thành công. Đã tạo ${soTao} ca trực mới.`)
            setShowCopyModal(false)
            setCurrentMonday(nextMonday)
        } catch (error) {
            const errorMsg = toFriendlyErrorMessage(error, 'Không thể sao chép lịch sang tuần sau')
            AppToast.error(errorMsg)
        } finally {
            setActionLoading(false)
        }
    }

    const handleExportExcel = async () => {
        const headers = ['Mã Ca', 'Bác Sĩ', 'Chuyên Khoa', 'Ngày', 'Ca', 'Buồng Khám', 'Slot Online', 'Slot Quầy', 'Trạng Thái', 'Xung Đột']
        const rows = []
        shiftsByDoctorAndSlot.forEach((s) => {
            const conflict = conflictsMap.get(`${s.bac_si_id}_${s.ngay}_${s.ca}`)
            rows.push([
                s.id || '',
                s.ten_bac_si || '',
                s.chuyen_khoa || '',
                s.ngay || '',
                s.ca === 'sang' ? 'Sáng (07:30 - 11:30)' : 'Chiều (13:30 - 17:00)',
                s.short_room_code || '',
                s.so_cho_online || 0,
                s.so_cho_quay || 0,
                s.is_active ? 'Hoạt động' : 'Tạm khóa',
                conflict ? conflict.message : 'Không',
            ])
        })

        await exportToExcel({
            filename: `Lich_Truc_Bac_Si_${tuNgay}_${denNgay}.xlsx`,
            sheetName: 'Phân Lịch Trực',
            title: `BẢNG PHÂN LỊCH TRỰC BÁC SĨ (TỪ ${tuNgay} ĐẾN ${denNgay})`,
            headers,
            rows,
        })
        AppToast.success('Đã xuất báo cáo lịch trực (.xlsx) thành công')
    }

    return (
        <div className="space-y-3.5">
            <div className="medpro-card p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                        <h2 className="font-display text-sm lg:text-base font-extrabold text-clinic-navy uppercase">
                            Phân lịch trực &amp; Điều phối ca khám
                        </h2>
                        <p className="text-xs text-clinic-text-secondary mt-0.5">
                            Phân bổ bác sĩ theo buồng khám, kiểm soát slot đặt trước và tiếp nhận tại quầy theo thời gian thực.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowCopyModal(true)}
                            className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                        >
                            <Copy size={14} weight="bold" className="text-clinic-cta" />
                            <span>Sao chép sang tuần kế</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleExportExcel}
                            className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                        >
                            <DownloadSimple size={14} weight="bold" className="text-clinic-cta" />
                            <span>Xuất Excel</span>
                        </button>

                        <button
                            type="button"
                            onClick={fetchMatrix}
                            className="w-8 h-8 rounded-[6px] border border-clinic-border bg-clinic-surface hover:border-clinic-cta text-clinic-text-secondary hover:text-clinic-cta flex items-center justify-center transition-colors cursor-pointer"
                            title="Tải lại bảng lịch trực"
                        >
                            <ArrowsClockwise size={15} className={loading ? 'animate-spin' : ''} />
                        </button>

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
                            className="medpro-btn-primary !py-1.5 !px-3 text-xs"
                        >
                            <Plus size={14} weight="bold" />
                            <span>Phân ca mới</span>
                        </button>
                    </div>
                </div>

                <div className="mt-3 pt-3 border-t border-clinic-border flex flex-wrap items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-1.5 tabular-nums">
                        <button
                            type="button"
                            onClick={handlePreviousWeek}
                            className="w-8 h-8 rounded-[6px] border border-clinic-border bg-clinic-surface hover:border-clinic-cta text-clinic-navy flex items-center justify-center transition-colors cursor-pointer"
                            title="Tuần trước"
                        >
                            <CaretLeft size={14} weight="bold" />
                        </button>
                        <button
                            type="button"
                            onClick={handleCurrentWeek}
                            className="h-8 px-2.5 rounded-[6px] border border-clinic-border bg-clinic-surface hover:border-clinic-cta font-bold text-clinic-navy transition-colors cursor-pointer"
                        >
                            Tuần này
                        </button>
                        <button
                            type="button"
                            onClick={handleNextWeek}
                            className="w-8 h-8 rounded-[6px] border border-clinic-border bg-clinic-surface hover:border-clinic-cta text-clinic-navy flex items-center justify-center transition-colors cursor-pointer"
                            title="Tuần sau"
                        >
                            <CaretRight size={14} weight="bold" />
                        </button>
                        <div className="h-8 flex items-center font-mono font-bold text-clinic-navy px-2.5 bg-clinic-bg rounded-[6px] border border-clinic-border">
                            {tuNgay} - {denNgay}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Tìm bác sĩ..."
                                value={searchDoctor}
                                onChange={(e) => setSearchDoctor(e.target.value)}
                                className="medpro-input !py-1.5 h-9 !pl-7 !pr-2 text-xs w-44"
                            />
                            <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none" />
                        </div>

                        <select
                            value={selectedDepartment}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                            className="medpro-input !py-1.5 h-9 !px-2.5 text-xs font-semibold truncate w-44"
                        >
                            <option value="ALL">Tất cả chuyên khoa</option>
                            {departmentsList.map((dept) => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>

                        <select
                            value={selectedRoomFilter}
                            onChange={(e) => setSelectedRoomFilter(e.target.value)}
                            className="medpro-input !py-1.5 h-9 !px-2.5 text-xs font-semibold truncate w-44"
                        >
                            <option value="ALL">Tất cả buồng khám</option>
                            {rooms.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.ma_phong || r.code || 'PK'} - {r.ten_phong || r.name}
                                </option>
                            ))}
                        </select>

                        <label className="h-9 flex items-center gap-1.5 px-2.5 rounded-[6px] border border-clinic-border bg-clinic-surface hover:border-clinic-danger cursor-pointer font-bold text-clinic-danger select-none">
                            <input
                                type="checkbox"
                                checked={showConflictOnly}
                                onChange={(e) => setShowConflictOnly(e.target.checked)}
                                className="rounded-[4px]"
                            />
                            <Warning size={13} weight="bold" />
                            <span>Trùng lịch</span>
                        </label>
                    </div>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-clinic-border flex flex-wrap items-center gap-4 text-[11px] font-semibold text-clinic-text-secondary select-none">
                    <span className="font-bold text-clinic-navy">Chú giải:</span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-[4px] bg-clinic-surface-alt border border-clinic-info-border inline-block" />
                        <span>Ca sáng / Hoạt động</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-[4px] bg-clinic-warning-bg border border-clinic-warning-border inline-block" />
                        <span>Ca chiều / Nghỉ phép</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-clinic-danger font-bold">
                        <span className="w-2.5 h-2.5 rounded-[4px] bg-clinic-danger-bg border border-clinic-danger-border inline-block" />
                        <span>Xung đột lịch</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-[4px] border border-dashed border-clinic-border-strong bg-clinic-surface inline-block" />
                        <span>Chưa xếp ca</span>
                    </span>
                </div>
            </div>

            <div className="bg-clinic-surface rounded-[6px] border border-clinic-border shadow-xs overflow-hidden">
                <div className="max-h-[640px] overflow-auto relative">
                    <table className="w-full text-left border-collapse min-w-[1000px] tabular-nums">
                        <thead>
                            <tr className="border-b border-clinic-border">
                                <th
                                    rowSpan={2}
                                    className="sticky top-0 left-0 bg-clinic-bg-muted z-40 p-2.5 text-xs font-bold text-clinic-navy border-r border-clinic-border w-[220px] min-w-[220px] max-w-[220px]"
                                >
                                    Bác sĩ &amp; Chuyên khoa
                                </th>
                                {daysOfWeek.map((day) => (
                                    <th
                                        key={day.isoDate}
                                        colSpan={2}
                                        className={`sticky top-0 z-30 p-2 text-center text-xs font-bold border-l border-clinic-border ${
                                            day.isToday
                                                ? 'bg-clinic-surface-alt text-clinic-navy border-b-2 border-b-clinic-cta'
                                                : 'bg-clinic-bg-muted text-clinic-navy'
                                        }`}
                                    >
                                        <div className="flex items-center justify-center gap-1.5">
                                            <span>{day.label}</span>
                                            {day.isToday && (
                                                <span className="px-1.5 py-0.5 rounded-[4px] bg-clinic-cta text-clinic-surface text-[9.5px] font-bold uppercase">
                                                    Hôm nay
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11px] font-normal text-clinic-text-muted mt-0.5">({day.displayDate})</div>
                                    </th>
                                ))}
                            </tr>
                            <tr className="border-b border-clinic-border">
                                {daysOfWeek.map((day) => (
                                    <Fragment key={day.isoDate}>
                                        <th className="sticky top-[41px] z-30 p-1 text-center text-[11px] font-bold border-l border-clinic-border bg-clinic-bg-muted text-clinic-text-secondary">
                                            Sáng
                                        </th>
                                        <th className="sticky top-[41px] z-30 p-1 text-center text-[11px] font-bold border-l border-clinic-border bg-clinic-bg-muted text-clinic-text-secondary">
                                            Chiều
                                        </th>
                                    </Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-clinic-border">
                            {filteredDoctors.length === 0 ? (
                                <tr>
                                    <td colSpan={15} className="p-10 text-center text-clinic-text-muted">
                                        <div className="flex flex-col items-center justify-center gap-1.5">
                                            <EmptyState size={32} className="text-clinic-text-subtle" />
                                            <p className="text-xs">Không tìm thấy bác sĩ nào phù hợp điều kiện lọc</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredDoctors.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-clinic-bg transition-colors group/row">
                                        <td className="sticky left-0 bg-clinic-surface z-20 p-2 border-r border-clinic-border align-middle w-[220px] min-w-[220px] max-w-[220px]">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-[6px] bg-clinic-navy text-clinic-surface font-bold text-xs flex items-center justify-center shrink-0">
                                                    {getDoctorInitials(doc.ho_ten)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-bold text-clinic-navy text-xs truncate">
                                                        {doc.ho_ten}
                                                    </div>
                                                    <div className="text-[11px] text-clinic-text-secondary truncate">
                                                        {doc.chuyen_khoa || 'Đa khoa'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {daysOfWeek.map((day) => {
                                            const keySang = `${doc.id}_${day.isoDate}_sang`
                                            const keyChieu = `${doc.id}_${day.isoDate}_chieu`
                                            const shiftSang = shiftsByDoctorAndSlot.get(keySang)
                                            const shiftChieu = shiftsByDoctorAndSlot.get(keyChieu)

                                            const leaveSang = doctorLeavesMap.get(keySang)
                                            const leaveChieu = doctorLeavesMap.get(keyChieu)

                                            const conflictSang = conflictsMap.get(keySang)
                                            const conflictChieu = conflictsMap.get(keyChieu)

                                            return (
                                                <Fragment key={day.isoDate}>
                                                    <td
                                                        className={`p-1 border-l border-clinic-border align-top h-14 min-w-[55px] ${
                                                            day.isWeekend ? 'bg-clinic-bg' : ''
                                                        }`}
                                                    >
                                                        {shiftSang ? (
                                                            <div
                                                                onClick={() => {
                                                                    setSelectedShiftForDetail(shiftSang)
                                                                    setShowDetailModal(true)
                                                                }}
                                                                className={`h-full p-1 rounded-[6px] border text-left cursor-pointer transition-colors select-none flex flex-col justify-between ${
                                                                    conflictSang
                                                                        ? 'bg-clinic-danger-bg border-clinic-danger text-clinic-danger'
                                                                        : !shiftSang.is_active
                                                                        ? 'bg-clinic-bg-muted border-clinic-border text-clinic-text-muted'
                                                                        : 'bg-clinic-surface-alt border-clinic-info-border hover:border-clinic-cta text-clinic-navy'
                                                                }`}
                                                                title={conflictSang ? conflictSang.message : `${shiftSang.ten_phong_kham} (${shiftSang.so_cho_online} Onl / ${shiftSang.so_cho_quay} Quầy)`}
                                                            >
                                                                <div className="flex items-center justify-between gap-1">
                                                                    <span className="font-bold font-mono text-[10px]">
                                                                        {shiftSang.short_room_code}
                                                                    </span>
                                                                    {conflictSang && (
                                                                        <Warning size={11} weight="bold" className="text-clinic-danger shrink-0" />
                                                                    )}
                                                                </div>
                                                                <div className="text-[9.5px] text-clinic-text-secondary tabular-nums">
                                                                    {shiftSang.so_cho_tong} slot
                                                                </div>
                                                            </div>
                                                        ) : leaveSang ? (
                                                            <div
                                                                className="h-full p-1 rounded-[6px] bg-clinic-warning-bg border border-clinic-warning-border text-clinic-warning flex items-center justify-center text-[10px] font-bold"
                                                                title={leaveSang.ly_do || 'Bác sĩ nghỉ phép'}
                                                            >
                                                                Nghỉ
                                                            </div>
                                                        ) : (
                                                            <div
                                                                onClick={() => handleOpenQuickAssign(doc, day.isoDate, 'sang')}
                                                                className="h-full rounded-[6px] border border-dashed border-clinic-border hover:border-clinic-cta hover:bg-clinic-surface-tint flex items-center justify-center transition-colors cursor-pointer group/cell"
                                                                title={`Phân ca sáng cho ${doc.ho_ten}`}
                                                            >
                                                                <Plus size={12} className="text-clinic-text-subtle group-hover/cell:text-clinic-cta transition-colors" />
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td
                                                        className={`p-1 border-l border-clinic-border align-top h-14 min-w-[55px] ${
                                                            day.isWeekend ? 'bg-clinic-bg' : ''
                                                        }`}
                                                    >
                                                        {shiftChieu ? (
                                                            <div
                                                                onClick={() => {
                                                                    setSelectedShiftForDetail(shiftChieu)
                                                                    setShowDetailModal(true)
                                                                }}
                                                                className={`h-full p-1 rounded-[6px] border text-left cursor-pointer transition-colors select-none flex flex-col justify-between ${
                                                                    conflictChieu
                                                                        ? 'bg-clinic-danger-bg border-clinic-danger text-clinic-danger'
                                                                        : !shiftChieu.is_active
                                                                        ? 'bg-clinic-bg-muted border-clinic-border text-clinic-text-muted'
                                                                        : 'bg-clinic-warning-bg border-clinic-warning-border hover:border-clinic-amber text-clinic-navy'
                                                                }`}
                                                                title={conflictChieu ? conflictChieu.message : `${shiftChieu.ten_phong_kham} (${shiftChieu.so_cho_online} Onl / ${shiftChieu.so_cho_quay} Quầy)`}
                                                            >
                                                                <div className="flex items-center justify-between gap-1">
                                                                    <span className="font-bold font-mono text-[10px]">
                                                                        {shiftChieu.short_room_code}
                                                                    </span>
                                                                    {conflictChieu && (
                                                                        <Warning size={11} weight="bold" className="text-clinic-danger shrink-0" />
                                                                    )}
                                                                </div>
                                                                <div className="text-[9.5px] text-clinic-text-secondary tabular-nums">
                                                                    {shiftChieu.so_cho_tong} slot
                                                                </div>
                                                            </div>
                                                        ) : leaveChieu ? (
                                                            <div
                                                                className="h-full p-1 rounded-[6px] bg-clinic-warning-bg border border-clinic-warning-border text-clinic-warning flex items-center justify-center text-[10px] font-bold"
                                                                title={leaveChieu.ly_do || 'Bác sĩ nghỉ phép'}
                                                            >
                                                                Nghỉ
                                                            </div>
                                                        ) : (
                                                            <div
                                                                onClick={() => handleOpenQuickAssign(doc, day.isoDate, 'chieu')}
                                                                className="h-full rounded-[6px] border border-dashed border-clinic-border hover:border-clinic-cta hover:bg-clinic-surface-tint flex items-center justify-center transition-colors cursor-pointer group/cell"
                                                                title={`Phân ca chiều cho ${doc.ho_ten}`}
                                                            >
                                                                <Plus size={12} className="text-clinic-text-subtle group-hover/cell:text-clinic-cta transition-colors" />
                                                            </div>
                                                        )}
                                                    </td>
                                                </Fragment>
                                            )
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 bg-clinic-navy-dark/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-clinic-surface rounded-[6px] max-w-md w-full p-5 shadow-xs border border-clinic-border">
                        <div className="flex items-center justify-between pb-3 border-b border-clinic-border">
                            <h3 className="font-display font-bold text-clinic-navy text-sm">
                                Phân công ca trực bác sĩ
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="text-clinic-text-muted hover:text-clinic-navy cursor-pointer"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateShiftSubmit} className="space-y-3 mt-3.5 text-xs">
                            <div>
                                <label className="medpro-label">Bác sĩ phụ trách *</label>
                                <select
                                    value={createShiftForm.bac_si_id}
                                    onChange={(e) => setCreateShiftForm({ ...createShiftForm, bac_si_id: e.target.value })}
                                    className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
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
                                    <label className="medpro-label">Ngày làm việc *</label>
                                    <input
                                        type="date"
                                        value={createShiftForm.ngay}
                                        onChange={(e) => setCreateShiftForm({ ...createShiftForm, ngay: e.target.value })}
                                        className="medpro-input !py-1.5 h-9 text-xs"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Ca trực *</label>
                                    <select
                                        value={createShiftForm.ca}
                                        onChange={(e) => setCreateShiftForm({ ...createShiftForm, ca: e.target.value })}
                                        className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
                                        required
                                    >
                                        <option value="sang">Ca Sáng (07:30 - 11:30)</option>
                                        <option value="chieu">Ca Chiều (13:30 - 17:00)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="medpro-label">Buồng khám *</label>
                                <select
                                    value={createShiftForm.phong_kham_id}
                                    onChange={(e) => setCreateShiftForm({ ...createShiftForm, phong_kham_id: e.target.value })}
                                    className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
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
                                    <label className="medpro-label">Slot trực tuyến (Online)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={50}
                                        value={createShiftForm.so_cho_online}
                                        onChange={(e) => setCreateShiftForm({ ...createShiftForm, so_cho_online: Number(e.target.value) })}
                                        className="medpro-input !py-1.5 h-9 text-xs font-bold tabular-nums"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Slot tại quầy (Vãng lai)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={50}
                                        value={createShiftForm.so_cho_quay}
                                        onChange={(e) => setCreateShiftForm({ ...createShiftForm, so_cho_quay: Number(e.target.value) })}
                                        className="medpro-input !py-1.5 h-9 text-xs font-bold tabular-nums"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-clinic-border">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="medpro-btn-primary !py-1.5 !px-3.5 text-xs"
                                >
                                    {actionLoading ? 'Đang lưu...' : 'Lưu ca trực'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDetailModal && selectedShiftForDetail && (
                <div className="fixed inset-0 bg-clinic-navy-dark/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-clinic-surface rounded-[6px] max-w-sm w-full p-4 shadow-xs border border-clinic-border">
                        <div className="flex items-center justify-between pb-2.5 border-b border-clinic-border">
                            <div>
                                <h3 className="font-display font-bold text-clinic-navy text-sm">Chi tiết ca trực</h3>
                                <p className="text-[11px] text-clinic-text-muted font-mono">#{selectedShiftForDetail.id}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDetailModal(false)}
                                className="text-clinic-text-muted hover:text-clinic-navy cursor-pointer"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>

                        <dl className="divide-y divide-clinic-border mt-2 text-xs tabular-nums">
                            <div className="flex justify-between py-2">
                                <dt className="text-clinic-text-secondary">Bác sĩ:</dt>
                                <dd className="font-bold text-clinic-navy">{selectedShiftForDetail.ten_bac_si}</dd>
                            </div>
                            <div className="flex justify-between py-2">
                                <dt className="text-clinic-text-secondary">Chuyên khoa:</dt>
                                <dd className="font-semibold text-clinic-text">{selectedShiftForDetail.chuyen_khoa}</dd>
                            </div>
                            <div className="flex justify-between py-2">
                                <dt className="text-clinic-text-secondary">Thời gian:</dt>
                                <dd className="font-bold text-clinic-navy">
                                    {selectedShiftForDetail.ca === 'sang' ? 'Ca Sáng (07:30 - 11:30)' : 'Ca Chiều (13:30 - 17:00)'} &bull; {selectedShiftForDetail.ngay}
                                </dd>
                            </div>
                            <div className="flex justify-between py-2">
                                <dt className="text-clinic-text-secondary">Buồng khám:</dt>
                                <dd className="font-bold text-clinic-navy">
                                    {selectedShiftForDetail.short_room_code} - {selectedShiftForDetail.ten_phong_kham}
                                </dd>
                            </div>
                            <div className="flex justify-between py-2">
                                <dt className="text-clinic-text-secondary">Slot khám:</dt>
                                <dd className="font-bold text-clinic-cta">
                                    {selectedShiftForDetail.so_cho_online} Onl / {selectedShiftForDetail.so_cho_quay} Quầy (Tổng {selectedShiftForDetail.so_cho_tong})
                                </dd>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <dt className="text-clinic-text-secondary">Trạng thái:</dt>
                                <dd>
                                    <span className={selectedShiftForDetail.is_active ? 'medpro-badge-success' : 'medpro-badge-neutral'}>
                                        {selectedShiftForDetail.is_active ? 'Đang hoạt động' : 'Tạm khóa'}
                                    </span>
                                </dd>
                            </div>
                        </dl>

                        <div className="flex items-center justify-between gap-2 pt-3 mt-1 border-t border-clinic-border">
                            <button
                                type="button"
                                onClick={handleToggleLockShift}
                                disabled={actionLoading}
                                className={selectedShiftForDetail.is_active ? 'medpro-btn-danger !py-1.5 !px-3 text-xs' : 'medpro-btn-outline !py-1.5 !px-3 text-xs'}
                            >
                                <LockKey size={13} />
                                <span>{selectedShiftForDetail.is_active ? 'Tạm khóa ca' : 'Kích hoạt lại'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowDetailModal(false)}
                                className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCopyModal && (
                <div className="fixed inset-0 bg-clinic-navy-dark/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-clinic-surface rounded-[6px] max-w-md w-full p-5 shadow-xs border border-clinic-border">
                        <div className="flex items-center justify-between pb-3 border-b border-clinic-border">
                            <h3 className="font-display font-bold text-clinic-navy text-sm">
                                Xác nhận nhân bản ca trực tuần kế tiếp
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowCopyModal(false)}
                                className="text-clinic-text-muted hover:text-clinic-navy cursor-pointer"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>

                        <div className="py-3 text-xs text-clinic-text-secondary space-y-2.5 tabular-nums">
                            <p>
                                Tạo dữ liệu phân ca từ giai đoạn <strong className="text-clinic-navy">{tuNgay} - {denNgay}</strong> sang tuần tiếp theo?
                            </p>
                            <p role="note" className="p-2.5 rounded-[6px] bg-clinic-surface-alt text-clinic-navy border border-clinic-info-border text-[11px] leading-relaxed">
                                Hệ thống tự động nhân bản các ca hợp lệ và kiểm tra điều kiện chứng chỉ hành nghề (CCHN) của từng bác sĩ.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-clinic-border">
                            <button
                                type="button"
                                onClick={() => setShowCopyModal(false)}
                                className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleCopyScheduleToNextWeek}
                                disabled={actionLoading}
                                className="medpro-btn-primary !py-1.5 !px-3.5 text-xs"
                            >
                                {actionLoading ? 'Đang sao chép...' : 'Xác nhận sao chép'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
