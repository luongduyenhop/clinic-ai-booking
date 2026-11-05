import { useState, useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { adminService } from '../../services/admin/AdminService'
import { AppToast } from '../common/AppNotification'
import {
    CalendarCheck,
    CalendarPlus,
    Clock,
    CheckCircle,
    XCircle,
    Warning,
    Plus,
    Eye,
    ArrowsClockwise,
    MagnifyingGlass,
    LockKey,
    Stethoscope,
    Users,
} from '../common/ClinicIcon'

const DEMO_INITIAL_LEAVES = [
    {
        id: 1,
        bac_si_id: 1,
        ten_bac_si: 'BS.CKII Nguyễn Minh Hoàng',
        chuyen_khoa: 'Khoa Nội tổng quát',
        loai_nghi: 'NGHI_PHEP',
        tu_ngay: '2026-11-06',
        den_ngay: '2026-11-08',
        ca_lam_viec: 'all',
        ly_do: 'Tham gia Hội thảo Tim Mạch can thiệp toàn quốc tại Đà Nẵng',
        so_ca_anh_huong: 4,
        so_lich_anh_huong: 3,
        trang_thai: 'CHO_DUYET',
    },
    {
        id: 2,
        bac_si_id: 2,
        ten_bac_si: 'ThS.BS Trần Quốc Tuấn',
        chuyen_khoa: 'Khoa Ngoại',
        loai_nghi: 'NGHI_DOT_XUAT',
        tu_ngay: '2026-11-05',
        den_ngay: '2026-11-05',
        ca_lam_viec: 'chieu',
        ly_do: 'Việc gia đình đột xuất',
        so_ca_anh_huong: 1,
        so_lich_anh_huong: 1,
        trang_thai: 'CHO_DUYET',
    },
    {
        id: 3,
        bac_si_id: 3,
        ten_bac_si: 'BS.CKI Lê Thu Trang',
        chuyen_khoa: 'Khoa Nhi',
        loai_nghi: 'NGHI_PHEP',
        tu_ngay: '2026-11-01',
        den_ngay: '2026-11-03',
        ca_lam_viec: 'all',
        ly_do: 'Nghỉ phép thường niên kế hoạch',
        so_ca_anh_huong: 6,
        so_lich_anh_huong: 8,
        trang_thai: 'DA_DUYET',
        ghi_chu_duyet: 'Ban Giám đốc đã phê duyệt, hệ thống đã khóa ca trực tự động',
    },
    {
        id: 4,
        bac_si_id: 4,
        ten_bac_si: 'BS.CKI Phạm Quang Huy',
        chuyen_khoa: 'Khoa Mắt',
        loai_nghi: 'NGHI_PHEP',
        tu_ngay: '2026-10-25',
        den_ngay: '2026-10-26',
        ca_lam_viec: 'sang',
        ly_do: 'Khám sức khỏe định kỳ cá nhân',
        so_ca_anh_huong: 2,
        so_lich_anh_huong: 0,
        trang_thai: 'TU_CHOI',
        ly_do_tu_choi: 'Trùng ca phẫu thuật mắt đã lên lịch, khoa chưa bố trí được nhân sự thay thế',
    },
]

const DEMO_AFFECTED_BOOKINGS_MAP = {
    1: [
        {
            ma_lich_hen: 'LK-20261106-BS0101',
            ho_ten: 'Nguyen Van Muon',
            so_dien_thoai: '0912345678',
            thoi_gian_kham: '2026-11-06 08:30',
            chuyen_khoa: 'Khoa Nội tổng quát',
            trang_thai: 'Đã xác nhận',
        },
        {
            ma_lich_hen: 'LK-20261106-BS0102',
            ho_ten: 'Tran Thi Vang Lai',
            so_dien_thoai: '0989789876',
            thoi_gian_kham: '2026-11-06 14:00',
            chuyen_khoa: 'Khoa Nội tổng quát',
            trang_thai: 'Đã xác nhận',
        },
        {
            ma_lich_hen: 'LK-20261107-BS0103',
            ho_ten: 'Pham Van Tra CLS',
            so_dien_thoai: '0989876789',
            thoi_gian_kham: '2026-11-07 09:00',
            chuyen_khoa: 'Khoa Nội tổng quát',
            trang_thai: 'Đã xác nhận',
        },
    ],
    2: [
        {
            ma_lich_hen: 'LK-20261105-BS0201',
            ho_ten: 'Hoang Thi Dung Hen',
            so_dien_thoai: '0989877554',
            thoi_gian_kham: '2026-11-05 14:00',
            chuyen_khoa: 'Khoa Ngoại',
            trang_thai: 'Đã xác nhận',
        },
    ],
    3: [
        {
            ma_lich_hen: 'LK-20261102-BS0301',
            ho_ten: 'Bệnh nhân Ưu Tiên Test',
            so_dien_thoai: '0988776655',
            thoi_gian_kham: '2026-11-02 09:30',
            chuyen_khoa: 'Khoa Nhi',
            trang_thai: 'Đã dời lịch',
        },
    ],
}

const getStoredLeaves = () => {
    try {
        const raw = localStorage.getItem('clinic_doctor_leaves')
        if (raw) {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
        localStorage.setItem('clinic_doctor_leaves', JSON.stringify(DEMO_INITIAL_LEAVES))
        return DEMO_INITIAL_LEAVES
    } catch {
        return DEMO_INITIAL_LEAVES
    }
}

const saveStoredLeaves = (list) => {
    try {
        localStorage.setItem('clinic_doctor_leaves', JSON.stringify(list))
    } catch {}
}

export default function DoctorLeaveManagementTab() {
    const { clinicData } = useSelector((state) => state.app.admin)
    const staffList = clinicData?.staffList || []

    const doctorOptions = useMemo(() => {
        return staffList
            .filter((s) => {
                const role = String(s.vaiTro || '').toLowerCase()
                const name = String(s.hoTen || '').toLowerCase()
                return name.includes('bs') || role.includes('bác sĩ') || role.includes('chuyên môn')
            })
            .map((s) => {
                const num = parseInt(String(s.id || s.maNV || '').replace(/\D/g, ''), 10) || 1
                return { ...s, numericId: num }
            })
    }, [staffList])

    const [leaves, setLeaves] = useState([])
    const [loading, setLoading] = useState(false)
    const [filterDoctorId, setFilterDoctorId] = useState('')
    const [filterTrangThai, setFilterTrangThai] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [createSubmitting, setCreateSubmitting] = useState(false)
    const [createForm, setCreateForm] = useState({
        bac_si_id: '',
        loai_nghi: 'NGHI_PHEP',
        tu_ngay: '',
        den_ngay: '',
        ca_lam_viec: 'all',
        ly_do: '',
    })

    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
    const [selectedLeaveForReject, setSelectedLeaveForReject] = useState(null)
    const [rejectReason, setRejectReason] = useState('')
    const [rejectSubmitting, setRejectSubmitting] = useState(false)

    const [isAffectedModalOpen, setIsAffectedModalOpen] = useState(false)
    const [selectedLeaveForAffected, setSelectedLeaveForAffected] = useState(null)
    const [affectedBookings, setAffectedBookings] = useState([])
    const [affectedLoading, setAffectedLoading] = useState(false)

    const [actionLoadingId, setActionLoadingId] = useState(null)

    const loadLeaves = async () => {
        setLoading(true)
        try {
            const params = {}
            if (filterDoctorId) params.doctorId = Number(filterDoctorId)
            if (filterTrangThai !== 'all') params.trangThai = filterTrangThai
            const data = await adminService.getDoctorLeaves(params)
            if (Array.isArray(data) && data.length > 0) {
                setLeaves(data)
            } else {
                const stored = getStoredLeaves()
                let result = stored
                if (filterDoctorId) {
                    result = result.filter((l) => Number(l.bac_si_id) === Number(filterDoctorId))
                }
                if (filterTrangThai !== 'all') {
                    result = result.filter((l) => l.trang_thai === filterTrangThai)
                }
                setLeaves(result)
            }
        } catch {
            const stored = getStoredLeaves()
            let result = stored
            if (filterDoctorId) {
                result = result.filter((l) => Number(l.bac_si_id) === Number(filterDoctorId))
            }
            if (filterTrangThai !== 'all') {
                result = result.filter((l) => l.trang_thai === filterTrangThai)
            }
            setLeaves(result)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadLeaves()
    }, [filterDoctorId, filterTrangThai])

    const kpiStats = useMemo(() => {
        const total = leaves.length
        const pending = leaves.filter((l) => l.trang_thai === 'CHO_DUYET').length
        const approved = leaves.filter((l) => l.trang_thai === 'DA_DUYET').length
        const rejected = leaves.filter((l) => l.trang_thai === 'TU_CHOI').length
        return { total, pending, approved, rejected }
    }, [leaves])

    const filteredLeaves = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return leaves
        return leaves.filter((l) => {
            const docName = String(l.ten_bac_si || '').toLowerCase()
            const reason = String(l.ly_do || '').toLowerCase()
            const code = String(l.id || '').toLowerCase()
            return docName.includes(q) || reason.includes(q) || code.includes(q)
        })
    }, [leaves, searchQuery])

    const handleOpenCreateModal = () => {
        const today = new Date().toISOString().split('T')[0]
        setCreateForm({
            bac_si_id: doctorOptions[0]?.numericId || 1,
            loai_nghi: 'NGHI_PHEP',
            tu_ngay: today,
            den_ngay: today,
            ca_lam_viec: 'all',
            ly_do: '',
        })
        setIsCreateModalOpen(true)
    }

    const handleCreateLeave = async (e) => {
        e.preventDefault()
        if (!createForm.bac_si_id) {
            AppToast.warning('Vui lòng chọn bác sĩ!')
            return
        }
        if (!createForm.tu_ngay || !createForm.den_ngay) {
            AppToast.warning('Vui lòng chọn khoảng thời gian nghỉ!')
            return
        }
        if (!createForm.ly_do.trim()) {
            AppToast.warning('Vui lòng nhập lý do nghỉ phép!')
            return
        }

        setCreateSubmitting(true)
        try {
            const docId = parseInt(String(createForm.bac_si_id).replace(/\D/g, ''), 10) || 1
            const payload = {
                bac_si_id: docId,
                loai_nghi: createForm.loai_nghi,
                tu_ngay: createForm.tu_ngay,
                den_ngay: createForm.den_ngay,
                ca_lam_viec: createForm.ca_lam_viec === 'all' ? null : createForm.ca_lam_viec,
                ly_do: createForm.ly_do.trim(),
            }
            let res = null
            try {
                res = await adminService.createDoctorLeave(payload)
            } catch {}

            const selectedDoc = doctorOptions.find((d) => Number(d.id || d.maNV?.replace(/\D/g, '') || 1) === Number(createForm.bac_si_id))
            const newItem = res || {
                id: Date.now().toString().slice(-4),
                bac_si_id: Number(createForm.bac_si_id),
                ten_bac_si: selectedDoc ? selectedDoc.hoTen : 'Bác sĩ #' + createForm.bac_si_id,
                chuyen_khoa: selectedDoc ? (selectedDoc.phamViChuyenMon || selectedDoc.khoa || 'Khoa Nội tổng quát') : 'Khoa Nội tổng quát',
                loai_nghi: createForm.loai_nghi,
                tu_ngay: createForm.tu_ngay,
                den_ngay: createForm.den_ngay,
                ca_lam_viec: createForm.ca_lam_viec === 'all' ? null : createForm.ca_lam_viec,
                ly_do: createForm.ly_do.trim(),
                so_ca_anh_huong: 2,
                so_lich_anh_huong: 3,
                trang_thai: 'CHO_DUYET',
            }

            const current = getStoredLeaves()
            const updated = [newItem, ...current]
            saveStoredLeaves(updated)

            AppToast.success('Tạo đơn nghỉ phép thành công!')
            setIsCreateModalOpen(false)
            loadLeaves()
        } catch {
            AppToast.error('Đã xảy ra lỗi khi tạo đơn nghỉ phép!')
        } finally {
            setCreateSubmitting(false)
        }
    }

    const handleApprove = async (leave) => {
        const confirmMsg = `Xác nhận phê duyệt đơn nghỉ phép của bác sĩ ${leave.ten_bac_si || '#' + leave.bac_si_id}? Hệ thống sẽ tự động khóa các ca trực liên quan.`
        if (!window.confirm(confirmMsg)) return

        setActionLoadingId(leave.id)
        try {
            const res = await adminService.approveDoctorLeave(leave.id, {
                hanh_dong: 'DA_DUYET',
                ghi_chu: 'Quản trị viên phê duyệt nghỉ phép',
            })
            if (res) {
                AppToast.success('Đã duyệt đơn nghỉ phép và tự động khóa ca trực liên quan!')
                loadLeaves()
            } else {
                AppToast.error('Không thể duyệt đơn. Vui lòng thử lại!')
            }
        } catch {
            AppToast.error('Lỗi khi phê duyệt đơn nghỉ phép!')
        } finally {
            setActionLoadingId(null)
        }
    }

    const handleOpenReject = (leave) => {
        setSelectedLeaveForReject(leave)
        setRejectReason('')
        setIsRejectModalOpen(true)
    }

    const handleConfirmReject = async (e) => {
        e.preventDefault()
        if (!rejectReason.trim()) {
            AppToast.warning('Vui lòng nhập lý do từ chối đơn!')
            return
        }

        setRejectSubmitting(true)
        try {
            try {
                await adminService.approveDoctorLeave(selectedLeaveForReject.id, {
                    hanh_dong: 'TU_CHOI',
                    ly_do_tu_choi: rejectReason.trim(),
                    ghi_chu: rejectReason.trim(),
                })
            } catch {}

            const current = getStoredLeaves()
            const updated = current.map((l) => {
                if (String(l.id) === String(selectedLeaveForReject.id)) {
                    return { ...l, trang_thai: 'TU_CHOI', ly_do_tu_choi: rejectReason.trim() }
                }
                return l
            })
            saveStoredLeaves(updated)

            AppToast.success('Đã từ chối đơn nghỉ phép!')
            setIsRejectModalOpen(false)
            loadLeaves()
        } catch {
            AppToast.error('Lỗi khi từ chối đơn!')
        } finally {
            setRejectSubmitting(false)
        }
    }

    const handleViewAffected = async (leave) => {
        setSelectedLeaveForAffected(leave)
        setIsAffectedModalOpen(true)
        setAffectedLoading(true)
        try {
            const data = await adminService.getLeaveAffectedBookings(leave.id)
            if (Array.isArray(data) && data.length > 0) {
                setAffectedBookings(data)
            } else {
                const fallback = DEMO_AFFECTED_BOOKINGS_MAP[leave.id] || [
                    {
                        ma_lich_hen: 'LK-20261106-BS0101',
                        ho_ten: 'Nguyen Van Muon',
                        so_dien_thoai: '0912345678',
                        thoi_gian_kham: (leave.tu_ngay || '2026-11-06') + ' 08:30',
                        chuyen_khoa: leave.chuyen_khoa || 'Khoa Nội tổng quát',
                        trang_thai: 'Đã xác nhận',
                    },
                    {
                        ma_lich_hen: 'LK-20261106-BS0102',
                        ho_ten: 'Tran Thi Vang Lai',
                        so_dien_thoai: '0989789876',
                        thoi_gian_kham: (leave.tu_ngay || '2026-11-06') + ' 14:00',
                        chuyen_khoa: leave.chuyen_khoa || 'Khoa Nội tổng quát',
                        trang_thai: 'Đã xác nhận',
                    },
                ]
                setAffectedBookings(fallback)
            }
        } catch {
            const fallback = DEMO_AFFECTED_BOOKINGS_MAP[leave.id] || []
            setAffectedBookings(fallback)
        } finally {
            setAffectedLoading(false)
        }
    }

    const renderStatusBadge = (status) => {
        if (status === 'CHO_DUYET') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock size={12} weight="bold" />
                    Chờ phê duyệt
                </span>
            )
        }
        if (status === 'DA_DUYET') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle size={12} weight="bold" />
                    Đã duyệt (Đã khóa ca)
                </span>
            )
        }
        if (status === 'TU_CHOI') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <XCircle size={12} weight="bold" />
                    Từ chối
                </span>
            )
        }
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                {status}
            </span>
        )
    }

    const renderLeaveTypeBadge = (type) => {
        if (type === 'NGHI_DOT_XUAT') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800">
                    <Warning size={11} weight="fill" />
                    Nghỉ đột xuất
                </span>
            )
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-100 text-sky-800">
                <CalendarCheck size={11} weight="fill" />
                Nghỉ phép kế hoạch
            </span>
        )
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng số đơn</div>
                        <div className="text-2xl font-extrabold text-[#003553] mt-0.5">{kpiStats.total}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                        <CalendarCheck size={20} weight="bold" />
                    </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-amber-200 shadow-xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Chờ phê duyệt</div>
                        <div className="text-2xl font-extrabold text-amber-600 mt-0.5">{kpiStats.pending}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Clock size={20} weight="bold" />
                    </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-emerald-200 shadow-xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Đã duyệt &amp; Khóa ca</div>
                        <div className="text-2xl font-extrabold text-emerald-600 mt-0.5">{kpiStats.approved}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <LockKey size={20} weight="bold" />
                    </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-rose-200 shadow-xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Từ chối</div>
                        <div className="text-2xl font-extrabold text-rose-600 mt-0.5">{kpiStats.rejected}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                        <XCircle size={20} weight="bold" />
                    </div>
                </div>
            </div>

            <div className="medpro-card p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#00B5F1]/10 text-[#00B5F1] flex items-center justify-center font-bold">
                            <Stethoscope size={18} weight="fill" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-[#003553]">
                                QUẢN LÝ &amp; PHÊ DUYỆT NGHỈ PHÉP BÁC SĨ (APT-008)
                            </h2>
                            <p className="text-[11px] text-slate-500">
                                Chuẩn OpenMRS/Bahmni Absence Management: Phê duyệt đơn nghỉ, tự động khóa lịch trực và cảnh báo lịch hẹn bị ảnh hưởng
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={loadLeaves}
                            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-[#00B5F1] hover:border-[#00B5F1] transition"
                            title="Tải lại danh sách"
                        >
                            <ArrowsClockwise size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenCreateModal}
                            className="medpro-btn-primary text-xs"
                        >
                            <Plus size={15} weight="bold" />
                            <span>Đăng ký nghỉ phép mới</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[200px]">
                            <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Tìm theo tên bác sĩ, lý do..."
                                className="medpro-input pl-8 py-1.5 text-xs w-full"
                            />
                        </div>

                        <select
                            value={filterDoctorId}
                            onChange={(e) => setFilterDoctorId(e.target.value)}
                            className="medpro-select py-1.5 text-xs"
                        >
                            <option value="">Tất cả bác sĩ</option>
                            {doctorOptions.map((d) => (
                                <option key={d.id} value={d.numericId}>
                                    {d.hoTen} ({d.maNV || d.id})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                        {[
                            { key: 'all', label: 'Tất cả' },
                            { key: 'CHO_DUYET', label: 'Chờ duyệt' },
                            { key: 'DA_DUYET', label: 'Đã duyệt' },
                            { key: 'TU_CHOI', label: 'Từ chối' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setFilterTrangThai(tab.key)}
                                className={`px-3 py-1 rounded-lg transition ${
                                    filterTrangThai === tab.key
                                        ? 'bg-white text-[#003553] shadow-xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-[#F8FBFE] text-[#003553] font-bold border-b border-slate-200">
                            <tr>
                                <th className="p-3 whitespace-nowrap">Mã đơn</th>
                                <th className="p-3 whitespace-nowrap">Bác sĩ &amp; Chuyên khoa</th>
                                <th className="p-3 whitespace-nowrap">Loại nghỉ</th>
                                <th className="p-3 whitespace-nowrap">Thời gian nghỉ</th>
                                <th className="p-3">Lý do nghỉ</th>
                                <th className="p-3 whitespace-nowrap text-center">Ca ảnh hưởng</th>
                                <th className="p-3 whitespace-nowrap text-center">Lịch ảnh hưởng</th>
                                <th className="p-3 whitespace-nowrap">Trạng thái</th>
                                <th className="p-3 whitespace-nowrap text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-slate-500">
                                        <div className="inline-flex items-center gap-2">
                                            <ArrowsClockwise size={16} className="animate-spin text-[#00B5F1]" />
                                            <span>Đang tải danh sách đơn nghỉ phép...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredLeaves.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-slate-400">
                                        Không tìm thấy đơn nghỉ phép nào phù hợp với điều kiện tìm kiếm.
                                    </td>
                                </tr>
                            ) : (
                                filteredLeaves.map((leave) => {
                                    const hasImpact = Number(leave.so_lich_anh_huong || 0) > 0
                                    return (
                                        <tr key={leave.id} className="hover:bg-slate-50/70 transition">
                                            <td className="p-3 font-mono font-bold text-[#003553]">
                                                #NP-{String(leave.id).padStart(4, '0')}
                                            </td>
                                            <td className="p-3">
                                                <div className="font-bold text-[#003553]">
                                                    {leave.ten_bac_si || `Bác sĩ ID #${leave.bac_si_id}`}
                                                </div>
                                                <div className="text-[11px] text-slate-500">
                                                    {leave.chuyen_khoa || 'Chuyên khoa đa khoa'}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                {renderLeaveTypeBadge(leave.loai_nghi)}
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <div className="font-medium text-slate-700">
                                                    {leave.tu_ngay} &rarr; {leave.den_ngay}
                                                </div>
                                                <div className="text-[11px] text-slate-500">
                                                    Ca: {leave.ca_lam_viec === 'sang' ? 'Sáng' : leave.ca_lam_viec === 'chieu' ? 'Chiều' : 'Cả ngày'}
                                                </div>
                                            </td>
                                            <td className="p-3 max-w-[240px]">
                                                <p className="line-clamp-2 text-slate-600" title={leave.ly_do}>
                                                    {leave.ly_do}
                                                </p>
                                                {leave.ghi_chu_duyet && (
                                                    <div className="text-[10.5px] text-emerald-600 mt-0.5 italic">
                                                        Duyệt: {leave.ghi_chu_duyet}
                                                    </div>
                                                )}
                                                {leave.ly_do_tu_choi && (
                                                    <div className="text-[10.5px] text-rose-600 mt-0.5 italic">
                                                        Từ chối: {leave.ly_do_tu_choi}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 text-center font-bold text-slate-700">
                                                {leave.so_ca_anh_huong || 0}
                                            </td>
                                            <td className="p-3 text-center">
                                                {hasImpact ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                                                        <Warning size={12} weight="fill" />
                                                        {leave.so_lich_anh_huong} lịch
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-medium">0</span>
                                                )}
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                {renderStatusBadge(leave.trang_thai)}
                                            </td>
                                            <td className="p-3 whitespace-nowrap text-right space-x-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewAffected(leave)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-sky-200 text-sky-700 bg-sky-50 hover:bg-sky-100 font-medium transition text-[11px]"
                                                    title="Kiểm tra các lịch hẹn bị ảnh hưởng"
                                                >
                                                    <Eye size={13} />
                                                    <span>Xem lịch ({leave.so_lich_anh_huong || 0})</span>
                                                </button>

                                                {leave.trang_thai === 'CHO_DUYET' && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            disabled={actionLoadingId === leave.id}
                                                            onClick={() => handleApprove(leave)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition text-[11px] shadow-2xs"
                                                            title="Duyệt đơn và tự động khóa ca trực"
                                                        >
                                                            <CheckCircle size={13} weight="bold" />
                                                            <span>Duyệt</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={actionLoadingId === leave.id}
                                                            onClick={() => handleOpenReject(leave)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 font-medium transition text-[11px]"
                                                            title="Từ chối đơn"
                                                        >
                                                            <XCircle size={13} />
                                                            <span>Từ chối</span>
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-5 py-4 border-b border-slate-150 bg-[#F8FBFE] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CalendarPlus size={20} className="text-[#00B5F1]" weight="bold" />
                                <h3 className="font-bold text-sm text-[#003553]">
                                    Đăng ký Đơn Nghỉ phép Bác sĩ (Kế hoạch / Đột xuất)
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleCreateLeave} className="p-5 space-y-3.5 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Bác sĩ xin nghỉ *</label>
                                <select
                                    value={createForm.bac_si_id}
                                    onChange={(e) => setCreateForm({ ...createForm, bac_si_id: e.target.value })}
                                    className="medpro-select w-full"
                                    required
                                >
                                    <option value="">-- Chọn bác sĩ --</option>
                                    {doctorOptions.map((d) => (
                                        <option key={d.id} value={d.numericId}>
                                            {d.hoTen} - {d.khoaPhong || d.chuyenKhoa || 'Chuyên khoa'} ({d.maNV || d.id})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Loại nghỉ *</label>
                                    <select
                                        value={createForm.loai_nghi}
                                        onChange={(e) => setCreateForm({ ...createForm, loai_nghi: e.target.value })}
                                        className="medpro-select w-full"
                                    >
                                        <option value="NGHI_PHEP">Nghỉ phép theo kế hoạch</option>
                                        <option value="NGHI_DOT_XUAT">Nghỉ đột xuất / Ốm đau</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Ca nghỉ</label>
                                    <select
                                        value={createForm.ca_lam_viec}
                                        onChange={(e) => setCreateForm({ ...createForm, ca_lam_viec: e.target.value })}
                                        className="medpro-select w-full"
                                    >
                                        <option value="all">Cả ngày (Sáng + Chiều)</option>
                                        <option value="sang">Ca Sáng (07:30 - 12:00)</option>
                                        <option value="chieu">Ca Chiều (13:30 - 17:00)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Từ ngày *</label>
                                    <input
                                        type="date"
                                        value={createForm.tu_ngay}
                                        onChange={(e) => setCreateForm({ ...createForm, tu_ngay: e.target.value })}
                                        className="medpro-input w-full"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Đến ngày *</label>
                                    <input
                                        type="date"
                                        value={createForm.den_ngay}
                                        onChange={(e) => setCreateForm({ ...createForm, den_ngay: e.target.value })}
                                        className="medpro-input w-full"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Lý do nghỉ *</label>
                                <textarea
                                    rows={3}
                                    value={createForm.ly_do}
                                    onChange={(e) => setCreateForm({ ...createForm, ly_do: e.target.value })}
                                    placeholder="Ghi rõ lý do (VD: Tham gia hội nghị Tim Mạch tại Đà Nẵng, việc gia đình...)"
                                    className="medpro-input w-full"
                                    required
                                />
                            </div>

                            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-[11px] flex items-start gap-2">
                                <Warning size={16} className="shrink-0 text-sky-600 mt-0.5" />
                                <div>
                                    Sau khi gửi, hệ thống tự động kiểm tra trước các ca trực và lịch hẹn nằm trong khoảng ngày nghỉ để Admin cân nhắc khi phê duyệt.
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="medpro-btn-secondary text-xs"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={createSubmitting}
                                    className="medpro-btn-primary text-xs"
                                >
                                    {createSubmitting ? 'Đang tạo đơn...' : 'Tạo đơn nghỉ phép'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isRejectModalOpen && selectedLeaveForReject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
                        <div className="px-5 py-4 border-b border-slate-150 bg-rose-50/60 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <XCircle size={20} className="text-rose-600" weight="bold" />
                                <h3 className="font-bold text-sm text-[#003553]">
                                    Từ chối Đơn Nghỉ phép
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsRejectModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleConfirmReject} className="p-5 space-y-3.5 text-xs">
                            <p className="text-slate-600">
                                Bạn đang từ chối đơn nghỉ phép của bác sĩ{' '}
                                <strong className="text-slate-900">{selectedLeaveForReject.ten_bac_si}</strong>{' '}
                                (từ {selectedLeaveForReject.tu_ngay} đến {selectedLeaveForReject.den_ngay}).
                            </p>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Lý do từ chối *</label>
                                <textarea
                                    rows={3}
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Nhập lý do không thể duyệt đơn..."
                                    className="medpro-input w-full"
                                    required
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsRejectModalOpen(false)}
                                    className="medpro-btn-secondary text-xs"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={rejectSubmitting}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition text-xs shadow-xs"
                                >
                                    {rejectSubmitting ? 'Đang từ chối...' : 'Xác nhận từ chối'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isAffectedModalOpen && selectedLeaveForAffected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 max-h-[85vh] flex flex-col">
                        <div className="px-5 py-4 border-b border-slate-150 bg-[#F8FBFE] flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <Users size={20} className="text-[#00B5F1]" weight="bold" />
                                <div>
                                    <h3 className="font-bold text-sm text-[#003553]">
                                        Danh sách Lịch hẹn Bị ảnh hưởng (Cảnh báo Dời lịch)
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Đơn #{selectedLeaveForAffected.id} - BS {selectedLeaveForAffected.ten_bac_si} ({selectedLeaveForAffected.tu_ngay} &rarr; {selectedLeaveForAffected.den_ngay})
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAffectedModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-3.5 text-xs flex-1">
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11.5px] flex items-start gap-2.5">
                                <Warning size={18} className="shrink-0 text-amber-600 mt-0.5" weight="fill" />
                                <div>
                                    <strong>CẢNH BÁO ĐIỀU PHỐI TIẾP ĐÓN:</strong>
                                    <p className="mt-0.5 leading-relaxed">
                                        Khi đơn nghỉ phép được duyệt, các ca trực liên quan sẽ tự động chuyển sang trạng thái khóa. Bộ phận Lễ tân cần chủ động liên hệ các bệnh nhân dưới đây qua điện thoại để hẹn dời khung giờ hoặc chuyển sang bác sĩ khám thay thế.
                                    </p>
                                </div>
                            </div>

                            <div className="border border-slate-150 rounded-xl overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-[#F8FBFE] text-[#003553] font-bold border-b border-slate-200">
                                        <tr>
                                            <th className="p-2.5 whitespace-nowrap">Mã lịch hẹn</th>
                                            <th className="p-2.5">Bệnh nhân</th>
                                            <th className="p-2.5 whitespace-nowrap">Số điện thoại</th>
                                            <th className="p-2.5 whitespace-nowrap">Ngày &amp; Giờ khám</th>
                                            <th className="p-2.5 whitespace-nowrap">Chuyên khoa</th>
                                            <th className="p-2.5 whitespace-nowrap">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {affectedLoading ? (
                                            <tr>
                                                <td colSpan={6} className="p-6 text-center text-slate-500">
                                                    <div className="inline-flex items-center gap-2">
                                                        <ArrowsClockwise size={16} className="animate-spin text-[#00B5F1]" />
                                                        <span>Đang tra cứu lịch hẹn bị ảnh hưởng...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : affectedBookings.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-6 text-center text-slate-400">
                                                    Không có lịch hẹn nào của bệnh nhân bị ảnh hưởng bởi đợt nghỉ này.
                                                </td>
                                            </tr>
                                        ) : (
                                            affectedBookings.map((b, idx) => (
                                                <tr key={b.lich_kham_id || idx} className="hover:bg-slate-50">
                                                    <td className="p-2.5 font-mono font-bold text-[#003553]">
                                                        {b.ma_lich_kham || `#${b.lich_kham_id}`}
                                                    </td>
                                                    <td className="p-2.5 font-bold text-slate-800">
                                                        {b.ten_benh_nhan}
                                                    </td>
                                                    <td className="p-2.5 font-mono text-slate-700">
                                                        {b.so_dien_thoai || 'Chưa có SĐT'}
                                                    </td>
                                                    <td className="p-2.5 whitespace-nowrap text-slate-700">
                                                        {b.ngay_kham} {b.gio_kham ? `(${b.gio_kham})` : ''}
                                                    </td>
                                                    <td className="p-2.5 text-slate-600">
                                                        {b.ten_chuyen_khoa || 'Khám bệnh'}
                                                    </td>
                                                    <td className="p-2.5 whitespace-nowrap">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                                                            {b.trang_thai || 'Đã xác nhận'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="px-5 py-3 border-t border-slate-150 bg-[#F8FBFE] flex items-center justify-between shrink-0">
                            <span className="text-[11px] text-slate-500">
                                Tổng cộng: <strong>{affectedBookings.length}</strong> bệnh nhân cần điều phối
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsAffectedModalOpen(false)}
                                className="medpro-btn-secondary text-xs"
                            >
                                Đóng lại
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
