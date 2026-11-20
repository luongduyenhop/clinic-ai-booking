import { useState, useEffect, useMemo } from 'react'
import { exportToExcel } from '../../utils/helpers/exportUtils'
import { useSelector } from 'react-redux'
import { adminService } from '../../services/admin/AdminService'
import { toFriendlyErrorMessage } from '../../utils/helpers/clientErrorHelper'
import { AppToast } from '../common/AppNotification'
import {
    CalendarCheck,
    Clock,
    CheckCircle,
    XCircle,
    Warning,
    Plus,
    Eye,
    ArrowsClockwise,
    MagnifyingGlass,
    DownloadSimple,
    Trash,
} from '../common/ClinicIcon'

export default function DoctorLeaveManagementTab() {
    const { clinicData } = useSelector((state) => state.app.admin)
    const settings = clinicData?.clinicSettings || {}
    const configuredClinicName = (settings.tenPhongKham || settings.tenCoSo || 'Phòng Khám Đa Khoa Quốc Tế Clinic-AI').toUpperCase()
    const configuredClinicAddress = [
        settings.diaChi || 'Số 18 Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội',
        settings.dienThoai ? `Hotline: ${settings.dienThoai}` : 'Hotline: 1900 2115',
        settings.giayPhepHoatDong ? `GPHĐ: ${settings.giayPhepHoatDong}` : 'GPHĐ: Số 1428/HNO-GPHĐ',
    ].filter(Boolean).join(' | ')
    const staffList = clinicData?.staffList || []
    const [apiDoctors, setApiDoctors] = useState([])

    useEffect(() => {
        adminService.getDoctorsAdmin().then((docs) => {
            if (Array.isArray(docs) && docs.length > 0) {
                setApiDoctors(docs)
            }
        }).catch(() => {})
    }, [])

    const doctorOptions = useMemo(() => {
        if (apiDoctors.length > 0) {
            return apiDoctors.map((d) => ({
                id: d.id,
                numericId: d.id,
                hoTen: d.ho_ten,
                chuyenKhoa: d.ten_chuyen_khoa || d.chuyen_khoa || 'Khoa Nội tổng quát',
                maNV: d.ma_phong_kham || `BS0${d.id}`,
            }))
        }
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
    }, [apiDoctors, staffList])

    const [leaves, setLeaves] = useState([])
    const [allLeaves, setAllLeaves] = useState([])
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

    useEffect(() => {
        try {
            localStorage.removeItem('clinic_doctor_leaves')
        } catch {}
    }, [])

    const loadLeaves = async () => {
        setLoading(true)
        try {
            const params = {}
            if (filterDoctorId) params.doctorId = Number(filterDoctorId)
            if (filterTrangThai !== 'all') params.trangThai = filterTrangThai
            const hasFilter = Boolean(filterDoctorId) || filterTrangThai !== 'all'
            const [filteredData, allData] = await Promise.all([
                adminService.getDoctorLeaves(params),
                hasFilter ? adminService.getDoctorLeaves({}) : Promise.resolve(null),
            ])
            const safeFiltered = Array.isArray(filteredData) ? filteredData : []
            setLeaves(safeFiltered)
            setAllLeaves(Array.isArray(allData) ? allData : safeFiltered)
        } catch (err) {
            AppToast.error(err.response?.data?.message || 'Không thể tải danh sách đơn nghỉ phép từ CSDL')
            setLeaves([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadLeaves()
    }, [filterDoctorId, filterTrangThai])

    const kpiStats = useMemo(() => {
        const source = allLeaves
        const total = source.length
        const pending = source.filter((l) => l.trang_thai === 'CHO_DUYET').length
        const approved = source.filter((l) => l.trang_thai === 'DA_DUYET').length
        const rejected = source.filter((l) => l.trang_thai === 'TU_CHOI').length
        return { total, pending, approved, rejected }
    }, [allLeaves])

    const filteredLeaves = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return leaves
        return leaves.filter((l) => {
            const docName = String(l.ten_bac_si || '').toLowerCase()
            const reason = String(l.ly_do || '').toLowerCase()
            const code = String(l.id || '').toLowerCase()
            const formattedCode = `#np-${String(l.id).padStart(4, '0')}`
            return docName.includes(q) || reason.includes(q) || code.includes(q) || formattedCode.includes(q)
        })
    }, [leaves, searchQuery])

    const handleExportLeavesExcel = () => {
        const headers = ['Mã đơn', 'Bác sĩ', 'Chuyên khoa', 'Loại nghỉ', 'Từ ngày', 'Đến ngày', 'Ca làm việc', 'Lý do', 'Số ca ảnh hưởng', 'Số lịch hẹn', 'Trạng thái']
        const rows = (filteredLeaves || []).map((l) => {
            const statusLabel = l.trang_thai === 'DA_DUYET'
                ? 'Đã duyệt'
                : l.trang_thai === 'TU_CHOI'
                ? 'Từ chối'
                : l.trang_thai === 'DA_HUY'
                ? 'Đã hủy'
                : 'Chờ duyệt'
            const shiftLabel = l.ca_lam_viec === 'sang' ? 'Sáng' : l.ca_lam_viec === 'chieu' ? 'Chiều' : 'Cả ngày'
            const typeLabel = l.loai_nghi === 'NGHI_PHEP' ? 'Nghỉ phép năm' : l.loai_nghi === 'NGHI_DOT_XUAT' ? 'Nghỉ đột xuất' : l.loai_nghi === 'NGHI_OM' ? 'Nghỉ ốm' : 'Công tác'
            return [
                `NP${String(l.id).padStart(4, '0')}`,
                l.ten_bac_si || '',
                l.chuyen_khoa || '',
                typeLabel,
                l.tu_ngay || '',
                l.den_ngay || '',
                shiftLabel,
                l.ly_do || '',
                Number(l.so_ca_anh_huong) || 0,
                Number(l.so_lich_anh_huong) || 0,
                statusLabel,
            ]
        })
        exportToExcel({
            filename: `danh-sach-nghi-phep-bac-si_${new Date().toISOString().slice(0, 10)}.xlsx`,
            sheetName: 'Nghỉ Phép Bác Sĩ',
            title: 'DANH SÁCH ĐĂNG KÝ NGHỈ PHÉP & ĐIỀU PHỐI LỊCH BÁC SĨ',
            subtitle: `Phân hệ Quản trị Nhân sự & Lịch khám • Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} • Tổng số: ${rows.length} đơn`,
            clinicName: configuredClinicName,
            clinicAddress: configuredClinicAddress,
            headers,
            rows,
            signOff: true,
        })
        AppToast.success(`Đã xuất ${rows.length} đơn nghỉ phép ra file Excel (.xlsx) thành công`)
    }

    const handleExportAffectedBookingsExcel = () => {
        if (!affectedBookings.length) return
        const headers = ['Mã lịch', 'Họ tên người bệnh', 'Số điện thoại', 'Thời gian hẹn', 'Chuyên khoa', 'Trạng thái hẹn', 'Lý do khám']
        const rows = affectedBookings.map((b) => [
            b.ma_lich_kham || b.ma_lich_hen || `LK${b.id || ''}`,
            b.ten_benh_nhan || b.ho_ten || 'Bệnh nhân',
            b.so_dien_thoai || b.sdt || '',
            `${b.ngay_kham || ''} ${b.khung_gio || b.gio_kham || ''}`.trim(),
            b.chuyen_khoa || selectedLeaveForAffected?.chuyen_khoa || '',
            b.trang_thai || 'Đã xác nhận',
            b.ly_do_kham || b.ly_do || 'Khám chuyên khoa',
        ])
        exportToExcel({
            filename: `danh-sach-benh-nhan-anh-huong-NP${selectedLeaveForAffected?.id || ''}_${new Date().toISOString().slice(0, 10)}.xlsx`,
            sheetName: 'DS Bệnh Nhân Ảnh Hưởng',
            title: 'DANH SÁCH BỆNH NHÂN BỊ ẢNH HƯỞNG BỞI LỊCH NGHỈ BÁC SĨ',
            subtitle: `Bác sĩ: ${selectedLeaveForAffected?.ten_bac_si || ''} • Thời gian nghỉ: ${selectedLeaveForAffected?.tu_ngay || ''} đến ${selectedLeaveForAffected?.den_ngay || ''} • Tổng số: ${rows.length} bệnh nhân`,
            clinicName: configuredClinicName,
            clinicAddress: configuredClinicAddress,
            headers,
            rows,
            signOff: true,
        })
        AppToast.success(`Đã xuất ${rows.length} bệnh nhân ảnh hưởng ra file Excel (.xlsx) thành công`)
    }

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
            AppToast.warning('Vui lòng chọn bác sĩ')
            return
        }
        if (!createForm.tu_ngay || !createForm.den_ngay) {
            AppToast.warning('Vui lòng chọn khoảng thời gian nghỉ')
            return
        }
        if (!createForm.ly_do.trim()) {
            AppToast.warning('Vui lòng nhập lý do nghỉ phép')
            return
        }

        setCreateSubmitting(true)
        try {
            const docId = parseInt(String(createForm.bac_si_id).replace(/\D/g, ''), 10)
            const payload = {
                bac_si_id: docId,
                loai_nghi: createForm.loai_nghi,
                tu_ngay: createForm.tu_ngay,
                den_ngay: createForm.den_ngay,
                ca_lam_viec: createForm.ca_lam_viec === 'all' ? null : createForm.ca_lam_viec,
                ly_do: createForm.ly_do.trim(),
            }
            await adminService.createDoctorLeave(payload)
            AppToast.success('Tạo đơn nghỉ phép thành công')
            setIsCreateModalOpen(false)
            loadLeaves()
        } catch (err) {
            const errorMsg = toFriendlyErrorMessage(err, 'Đã xảy ra lỗi khi tạo đơn nghỉ phép')
            AppToast.error(errorMsg)
        } finally {
            setCreateSubmitting(false)
        }
    }

    const handleApprove = async (leave) => {
        const confirmMsg = `Xác nhận phê duyệt đơn nghỉ phép của bác sĩ ${leave.ten_bac_si || '#' + leave.bac_si_id}? Hệ thống sẽ tự động khóa các ca trực liên quan.`
        if (!window.confirm(confirmMsg)) return

        setActionLoadingId(leave.id)
        try {
            await adminService.approveDoctorLeave(leave.id, {
                hanh_dong: 'DA_DUYET',
                ghi_chu: 'Quản trị viên phê duyệt nghỉ phép',
            })
            AppToast.success('Đã duyệt đơn nghỉ phép và tự động khóa ca trực liên quan')
            loadLeaves()
        } catch (err) {
            AppToast.error(err.response?.data?.message || err.response?.data?.detail || 'Lỗi khi phê duyệt đơn nghỉ phép')
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
            AppToast.warning('Vui lòng nhập lý do từ chối đơn')
            return
        }

        setRejectSubmitting(true)
        try {
            await adminService.approveDoctorLeave(selectedLeaveForReject.id, {
                hanh_dong: 'TU_CHOI',
                ghi_chu: rejectReason.trim(),
            })
            AppToast.success('Đã từ chối đơn nghỉ phép')
            setIsRejectModalOpen(false)
            loadLeaves()
        } catch (err) {
            AppToast.error(err.response?.data?.message || err.response?.data?.detail || 'Lỗi khi từ chối đơn')
        } finally {
            setRejectSubmitting(false)
        }
    }

    const handleCancelLeave = async (leave) => {
        if (!window.confirm(`Xác nhận hủy đơn nghỉ phép của Bác sĩ ${leave.ten_bac_si || '#' + leave.bac_si_id}? Hệ thống sẽ mở lại các ca trực đã khóa liên quan.`)) return
        setActionLoadingId(leave.id)
        try {
            await adminService.cancelDoctorLeave(leave.id)
            AppToast.success('Đã hủy đơn nghỉ phép và mở lại ca trực thành công')
            loadLeaves()
        } catch (err) {
            AppToast.error(err.response?.data?.message || 'Không thể hủy đơn nghỉ phép')
        } finally {
            setActionLoadingId(null)
        }
    }

    const handleDeleteLeave = async (leave) => {
        if (!window.confirm(`Xác nhận xóa hoàn toàn đơn nghỉ phép của Bác sĩ ${leave.ten_bac_si || '#' + leave.bac_si_id}?`)) return
        setActionLoadingId(leave.id)
        try {
            await adminService.deleteDoctorLeave(leave.id)
            AppToast.success('Đã xóa đơn nghỉ phép thành công')
            loadLeaves()
        } catch (err) {
            AppToast.error(err.response?.data?.message || 'Không thể xóa đơn nghỉ phép')
        } finally {
            setActionLoadingId(null)
        }
    }

    const handleViewAffected = async (leave) => {
        setSelectedLeaveForAffected(leave)
        setIsAffectedModalOpen(true)
        setAffectedLoading(true)
        try {
            const data = await adminService.getLeaveAffectedBookings(leave.id)
            setAffectedBookings(Array.isArray(data) ? data : [])
        } catch {
            setAffectedBookings([])
            AppToast.error('Không thể tải danh sách lịch khám bị ảnh hưởng')
        } finally {
            setAffectedLoading(false)
        }
    }

    const renderStatusBadge = (status) => {
        if (status === 'CHO_DUYET') {
            return (
                <span className="medpro-badge-warning">
                    <Clock size={12} weight="bold" />
                    Chờ phê duyệt
                </span>
            )
        }
        if (status === 'DA_DUYET') {
            return (
                <span className="medpro-badge-success">
                    <CheckCircle size={12} weight="bold" />
                    Đã duyệt (Khóa ca)
                </span>
            )
        }
        if (status === 'TU_CHOI') {
            return (
                <span className="medpro-badge-danger">
                    <XCircle size={12} weight="bold" />
                    Từ chối
                </span>
            )
        }
        if (status === 'DA_HUY') {
            return (
                <span className="medpro-badge-neutral">
                    <XCircle size={12} weight="bold" />
                    Đã hủy
                </span>
            )
        }
        return <span className="medpro-badge-neutral">{status}</span>
    }

    const renderLeaveTypeBadge = (type) => {
        if (type === 'NGHI_DOT_XUAT') {
            return (
                <span className="medpro-badge-danger">
                    <Warning size={11} weight="fill" />
                    Nghỉ đột xuất
                </span>
            )
        }
        return (
            <span className="medpro-badge-info">
                <CalendarCheck size={11} weight="fill" />
                Nghỉ phép kế hoạch
            </span>
        )
    }

    return (
        <div className="space-y-4">
            <div className="bg-clinic-surface rounded-[6px] border border-clinic-border grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-clinic-border tabular-nums">
                <div className="p-4">
                    <div className="text-xs font-semibold text-clinic-text-secondary">Tổng số đơn</div>
                    <div className="text-2xl font-extrabold text-clinic-navy mt-1">{kpiStats.total}</div>
                </div>
                <div className="p-4">
                    <div className="text-xs font-semibold text-clinic-warning">Chờ phê duyệt</div>
                    <div className="text-2xl font-extrabold text-clinic-warning mt-1">{kpiStats.pending}</div>
                </div>
                <div className="p-4">
                    <div className="text-xs font-semibold text-clinic-success">Đã duyệt &amp; Khóa ca</div>
                    <div className="text-2xl font-extrabold text-clinic-success mt-1">{kpiStats.approved}</div>
                </div>
                <div className="p-4">
                    <div className="text-xs font-semibold text-clinic-danger">Từ chối</div>
                    <div className="text-2xl font-extrabold text-clinic-danger mt-1">{kpiStats.rejected}</div>
                </div>
            </div>

            <div className="medpro-card p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-clinic-border">
                    <div>
                        <h2 className="font-display text-sm font-bold text-clinic-navy uppercase">
                            Quản lý &amp; Phê duyệt nghỉ phép bác sĩ
                        </h2>
                        <p className="text-xs text-clinic-text-secondary mt-0.5">
                            Phê duyệt đơn nghỉ phép, tự động khóa ca khám và cảnh báo lịch hẹn cần điều phối lại
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={loadLeaves}
                            className="w-8 h-8 rounded-[6px] border border-clinic-border bg-clinic-surface text-clinic-text-secondary hover:text-clinic-cta hover:border-clinic-cta flex items-center justify-center transition-colors cursor-pointer"
                            title="Tải lại danh sách"
                        >
                            <ArrowsClockwise size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            type="button"
                            onClick={handleExportLeavesExcel}
                            className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                        >
                            <DownloadSimple size={14} weight="bold" className="text-clinic-cta" />
                            <span>Xuất Excel</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenCreateModal}
                            className="medpro-btn-primary !py-1.5 !px-3 text-xs"
                        >
                            <Plus size={14} weight="bold" />
                            <span>Đăng ký nghỉ phép mới</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[210px]">
                            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Tìm theo tên bác sĩ, lý do..."
                                className="medpro-input !py-1.5 h-9 !pl-8 text-xs w-full"
                            />
                        </div>

                        <select
                            value={filterDoctorId}
                            onChange={(e) => setFilterDoctorId(e.target.value)}
                            className="medpro-input !py-1.5 h-9 !px-2.5 text-xs font-semibold truncate w-52"
                        >
                            <option value="">Tất cả bác sĩ</option>
                            {doctorOptions.map((d) => (
                                <option key={d.id} value={d.numericId}>
                                    {d.hoTen} ({d.maNV || d.id})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border text-xs font-semibold">
                        {[
                            { key: 'all', label: 'Tất cả' },
                            { key: 'CHO_DUYET', label: 'Chờ duyệt' },
                            { key: 'DA_DUYET', label: 'Đã duyệt' },
                            { key: 'TU_CHOI', label: 'Từ chối' },
                            { key: 'DA_HUY', label: 'Đã hủy' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setFilterTrangThai(tab.key)}
                                className={`px-3 py-1 rounded-[6px] transition-colors cursor-pointer ${
                                    filterTrangThai === tab.key
                                        ? 'bg-clinic-navy text-clinic-surface font-bold'
                                        : 'text-clinic-text-secondary hover:text-clinic-navy'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                    <table className="medpro-table text-xs tabular-nums">
                        <thead>
                            <tr>
                                <th>Mã đơn</th>
                                <th>Bác sĩ &amp; Chuyên khoa</th>
                                <th>Loại nghỉ</th>
                                <th>Thời gian nghỉ</th>
                                <th>Lý do nghỉ</th>
                                <th className="text-center">Ca ảnh hưởng</th>
                                <th className="text-center">Lịch ảnh hưởng</th>
                                <th>Trạng thái</th>
                                <th className="text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-clinic-text-muted">
                                        <div className="inline-flex items-center gap-2">
                                            <ArrowsClockwise size={16} className="animate-spin text-clinic-cta" />
                                            <span>Đang tải danh sách đơn nghỉ phép...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredLeaves.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-clinic-text-muted">
                                        Không tìm thấy đơn nghỉ phép nào phù hợp điều kiện lọc.
                                    </td>
                                </tr>
                            ) : (
                                filteredLeaves.map((leave) => {
                                    const hasImpact = Number(leave.so_lich_anh_huong || 0) > 0
                                    return (
                                        <tr key={leave.id}>
                                            <td className="font-mono font-bold text-clinic-navy">
                                                #NP-{String(leave.id).padStart(4, '0')}
                                            </td>
                                            <td>
                                                <div className="font-bold text-clinic-navy">
                                                    {leave.ten_bac_si || `Bác sĩ ID #${leave.bac_si_id}`}
                                                </div>
                                                <div className="text-[11px] text-clinic-text-secondary">
                                                    {leave.chuyen_khoa || 'Chuyên khoa đa khoa'}
                                                </div>
                                            </td>
                                            <td>
                                                {renderLeaveTypeBadge(leave.loai_nghi)}
                                            </td>
                                            <td className="whitespace-nowrap">
                                                <div className="font-medium text-clinic-navy">
                                                    {leave.tu_ngay} - {leave.den_ngay}
                                                </div>
                                                <div className="text-[11px] text-clinic-text-secondary">
                                                    Ca: {leave.ca_lam_viec === 'sang' ? 'Sáng' : leave.ca_lam_viec === 'chieu' ? 'Chiều' : 'Cả ngày'}
                                                </div>
                                            </td>
                                            <td className="max-w-[240px]">
                                                <p className="line-clamp-2 text-clinic-text-secondary" title={leave.ly_do}>
                                                    {leave.ly_do}
                                                </p>
                                                {leave.ghi_chu_duyet && leave.trang_thai === 'DA_DUYET' && (
                                                    <div className="text-[11px] text-clinic-success mt-0.5 font-medium">
                                                        Duyệt: {leave.ghi_chu_duyet}
                                                    </div>
                                                )}
                                                {(leave.ly_do_tu_choi || (leave.ghi_chu_duyet && leave.trang_thai === 'TU_CHOI')) && (
                                                    <div className="text-[11px] text-clinic-danger mt-0.5 font-medium">
                                                        Từ chối: {leave.ly_do_tu_choi || leave.ghi_chu_duyet}
                                                    </div>
                                                )}
                                                {leave.ghi_chu_duyet && leave.trang_thai === 'DA_HUY' && (
                                                    <div className="text-[11px] text-clinic-text-muted mt-0.5">
                                                        {leave.ghi_chu_duyet}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="text-center font-bold text-clinic-navy">
                                                {leave.so_ca_anh_huong || 0}
                                            </td>
                                            <td className="text-center">
                                                {hasImpact ? (
                                                    <span className="medpro-badge-warning">
                                                        <Warning size={12} weight="fill" />
                                                        {leave.so_lich_anh_huong} lịch
                                                    </span>
                                                ) : (
                                                    <span className="text-clinic-text-muted font-medium">0</span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap">
                                                {renderStatusBadge(leave.trang_thai)}
                                            </td>
                                            <td className="whitespace-nowrap text-right space-x-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewAffected(leave)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] border border-clinic-info-border text-clinic-cta bg-clinic-surface-alt hover:bg-clinic-surface font-semibold transition-colors text-[11px] cursor-pointer"
                                                    title="Kiểm tra các lịch hẹn bị ảnh hưởng"
                                                >
                                                    <Eye size={13} />
                                                    <span>Xem lịch</span>
                                                </button>

                                                {leave.trang_thai === 'CHO_DUYET' && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            disabled={actionLoadingId === leave.id}
                                                            onClick={() => handleApprove(leave)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-clinic-success text-clinic-surface font-bold transition-colors text-[11px] cursor-pointer"
                                                            title="Duyệt đơn và tự động khóa ca trực"
                                                        >
                                                            <CheckCircle size={13} weight="bold" />
                                                            <span>Duyệt</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={actionLoadingId === leave.id}
                                                            onClick={() => handleOpenReject(leave)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] border border-clinic-danger-border text-clinic-danger bg-clinic-danger-bg hover:bg-clinic-surface font-semibold transition-colors text-[11px] cursor-pointer"
                                                            title="Từ chối đơn"
                                                        >
                                                            <XCircle size={13} />
                                                            <span>Từ chối</span>
                                                        </button>
                                                    </>
                                                )}

                                                {leave.trang_thai === 'DA_DUYET' && (
                                                    <button
                                                        type="button"
                                                        disabled={actionLoadingId === leave.id}
                                                        onClick={() => handleCancelLeave(leave)}
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] border border-clinic-warning-border text-clinic-warning bg-clinic-warning-bg hover:bg-clinic-surface font-semibold transition-colors text-[11px] cursor-pointer"
                                                        title="Hủy đơn nghỉ phép và mở lại ca trực"
                                                    >
                                                        <XCircle size={13} />
                                                        <span>Hủy</span>
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    disabled={actionLoadingId === leave.id}
                                                    onClick={() => handleDeleteLeave(leave)}
                                                    className="inline-flex items-center gap-1 p-1 rounded-[6px] text-clinic-text-muted hover:text-clinic-danger hover:bg-clinic-danger-bg transition-colors cursor-pointer"
                                                    title="Xóa đơn nghỉ"
                                                >
                                                    <Trash size={14} />
                                                </button>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-clinic-navy-dark/50 p-4">
                    <div className="bg-clinic-surface rounded-[6px] shadow-xs max-w-lg w-full overflow-hidden border border-clinic-border">
                        <div className="px-4 py-3 border-b border-clinic-border bg-clinic-bg flex items-center justify-between">
                            <h3 className="font-display font-bold text-sm text-clinic-navy">
                                Đăng ký đơn nghỉ phép bác sĩ
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-clinic-text-muted hover:text-clinic-navy cursor-pointer"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateLeave} className="p-4 space-y-3 text-xs">
                            <div>
                                <label className="medpro-label">Bác sĩ xin nghỉ *</label>
                                <select
                                    value={createForm.bac_si_id}
                                    onChange={(e) => setCreateForm({ ...createForm, bac_si_id: e.target.value })}
                                    className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
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
                                    <label className="medpro-label">Loại nghỉ *</label>
                                    <select
                                        value={createForm.loai_nghi}
                                        onChange={(e) => setCreateForm({ ...createForm, loai_nghi: e.target.value })}
                                        className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
                                    >
                                        <option value="NGHI_PHEP">Nghỉ phép theo kế hoạch</option>
                                        <option value="NGHI_DOT_XUAT">Nghỉ đột xuất / Ốm đau</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="medpro-label">Ca nghỉ</label>
                                    <select
                                        value={createForm.ca_lam_viec}
                                        onChange={(e) => setCreateForm({ ...createForm, ca_lam_viec: e.target.value })}
                                        className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
                                    >
                                        <option value="all">Cả ngày (Sáng + Chiều)</option>
                                        <option value="sang">Ca Sáng (07:30 - 12:00)</option>
                                        <option value="chieu">Ca Chiều (13:30 - 17:00)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="medpro-label">Từ ngày *</label>
                                    <input
                                        type="date"
                                        value={createForm.tu_ngay}
                                        onChange={(e) => setCreateForm({ ...createForm, tu_ngay: e.target.value })}
                                        className="medpro-input !py-1.5 h-9 text-xs"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Đến ngày *</label>
                                    <input
                                        type="date"
                                        value={createForm.den_ngay}
                                        onChange={(e) => setCreateForm({ ...createForm, den_ngay: e.target.value })}
                                        className="medpro-input !py-1.5 h-9 text-xs"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="medpro-label">Lý do nghỉ *</label>
                                <textarea
                                    rows={3}
                                    value={createForm.ly_do}
                                    onChange={(e) => setCreateForm({ ...createForm, ly_do: e.target.value })}
                                    placeholder="Ghi rõ lý do..."
                                    className="medpro-input text-xs"
                                    required
                                />
                            </div>

                            <p role="note" className="p-3 rounded-[6px] bg-clinic-surface-alt border border-clinic-info-border text-clinic-navy text-[11px] leading-relaxed">
                                Hệ thống tự động kiểm tra các ca trực và lịch hẹn nằm trong khoảng ngày nghỉ để cân nhắc trước khi phê duyệt.
                            </p>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-clinic-border">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={createSubmitting}
                                    className="medpro-btn-primary !py-1.5 !px-3.5 text-xs"
                                >
                                    {createSubmitting ? 'Đang tạo đơn...' : 'Tạo đơn nghỉ phép'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isRejectModalOpen && selectedLeaveForReject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-clinic-navy-dark/50 p-4">
                    <div className="bg-clinic-surface rounded-[6px] shadow-xs max-w-md w-full overflow-hidden border border-clinic-border">
                        <div className="px-4 py-3 border-b border-clinic-danger-border bg-clinic-danger-bg flex items-center justify-between">
                            <h3 className="font-display font-bold text-sm text-clinic-danger">
                                Từ chối đơn nghỉ phép
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsRejectModalOpen(false)}
                                className="text-clinic-danger hover:opacity-75 cursor-pointer"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleConfirmReject} className="p-4 space-y-3 text-xs tabular-nums">
                            <p className="text-clinic-text-secondary">
                                Từ chối đơn nghỉ phép của bác sĩ{' '}
                                <strong className="text-clinic-navy">{selectedLeaveForReject.ten_bac_si}</strong>{' '}
                                ({selectedLeaveForReject.tu_ngay} - {selectedLeaveForReject.den_ngay}).
                            </p>

                            <div>
                                <label className="medpro-label">Lý do từ chối *</label>
                                <textarea
                                    rows={3}
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Nhập lý do không thể duyệt đơn..."
                                    className="medpro-input text-xs"
                                    required
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-clinic-border">
                                <button
                                    type="button"
                                    onClick={() => setIsRejectModalOpen(false)}
                                    className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={rejectSubmitting}
                                    className="medpro-btn-danger !py-1.5 !px-3.5 text-xs font-bold"
                                >
                                    {rejectSubmitting ? 'Đang từ chối...' : 'Xác nhận từ chối'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isAffectedModalOpen && selectedLeaveForAffected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-clinic-navy-dark/50 p-4">
                    <div className="bg-clinic-surface rounded-[6px] shadow-xs max-w-2xl w-full overflow-hidden border border-clinic-border max-h-[85vh] flex flex-col">
                        <div className="px-4 py-3 border-b border-clinic-border bg-clinic-bg flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="font-display font-bold text-sm text-clinic-navy">
                                    Danh sách lịch hẹn bị ảnh hưởng
                                </h3>
                                <p className="text-[11px] text-clinic-text-secondary tabular-nums">
                                    Đơn #{selectedLeaveForAffected.id} - BS {selectedLeaveForAffected.ten_bac_si} ({selectedLeaveForAffected.tu_ngay} - {selectedLeaveForAffected.den_ngay})
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAffectedModalOpen(false)}
                                className="text-clinic-text-muted hover:text-clinic-navy cursor-pointer"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto space-y-3 text-xs flex-1">
                            <p role="alert" className="p-3 rounded-[6px] bg-clinic-warning-bg border border-clinic-warning-border text-clinic-warning text-[11.5px] leading-relaxed">
                                <strong className="text-clinic-navy mr-1">Lưu ý điều phối:</strong>
                                Khi đơn nghỉ phép được duyệt, ca trực liên quan sẽ tự động khóa. Lễ tân cần liên hệ các bệnh nhân bên dưới để dời lịch hoặc chuyển bác sĩ thay thế.
                            </p>

                            <section className="border border-clinic-border rounded-[6px] overflow-hidden">
                                <table className="medpro-table text-xs tabular-nums">
                                    <thead>
                                        <tr>
                                            <th>Mã lịch hẹn</th>
                                            <th>Bệnh nhân</th>
                                            <th>Số điện thoại</th>
                                            <th>Ngày &amp; Giờ khám</th>
                                            <th>Chuyên khoa</th>
                                            <th>Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {affectedLoading ? (
                                            <tr>
                                                <td colSpan={6} className="p-6 text-center text-clinic-text-muted">
                                                    <div className="inline-flex items-center gap-2">
                                                        <ArrowsClockwise size={16} className="animate-spin text-clinic-cta" />
                                                        <span>Đang tra cứu lịch hẹn bị ảnh hưởng...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : affectedBookings.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-6 text-center text-clinic-text-muted">
                                                    Không có lịch hẹn nào bị ảnh hưởng bởi đợt nghỉ này.
                                                </td>
                                            </tr>
                                        ) : (
                                            affectedBookings.map((b, idx) => (
                                                <tr key={b.lich_kham_id || idx}>
                                                    <td className="font-mono font-bold text-clinic-navy">
                                                        {b.ma_lich_kham || b.ma_lich_hen || `#${b.lich_kham_id || b.id || idx + 1}`}
                                                    </td>
                                                    <td className="font-bold text-clinic-navy">
                                                        {b.ten_benh_nhan || b.ho_ten || 'Bệnh nhân'}
                                                    </td>
                                                    <td className="font-mono text-clinic-text-secondary">
                                                        {b.so_dien_thoai || 'Chưa có SĐT'}
                                                    </td>
                                                    <td className="whitespace-nowrap text-clinic-text-secondary">
                                                        {b.ngay_kham ? `${b.ngay_kham} ${b.gio_kham ? `(${b.gio_kham})` : ''}` : (b.thoi_gian_kham || 'Theo ca trực')}
                                                    </td>
                                                    <td className="text-clinic-text-secondary">
                                                        {b.ten_chuyen_khoa || b.chuyen_khoa || 'Khám bệnh'}
                                                    </td>
                                                    <td className="whitespace-nowrap">
                                                        <span className="medpro-badge-info">
                                                            {b.trang_thai || 'Đã xác nhận'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </section>
                        </div>

                        <div className="px-4 py-3 border-t border-clinic-border bg-clinic-bg flex items-center justify-between shrink-0 tabular-nums">
                            <span className="text-[11px] text-clinic-text-secondary">
                                Tổng cộng: <strong className="text-clinic-navy">{affectedBookings.length}</strong> bệnh nhân cần điều phối
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleExportAffectedBookingsExcel}
                                    disabled={!affectedBookings.length}
                                    className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                                >
                                    <DownloadSimple size={14} weight="bold" className="text-clinic-cta" />
                                    <span>Xuất Excel DS liên hệ</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsAffectedModalOpen(false)}
                                    className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                                >
                                    Đóng lại
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
