import { useState, useMemo, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../../components/common/AppNotification'
import { getMasterOptions, getFormDefaults } from '../../utils/helpers/clinicConfigHelpers'
import { adminService } from '../../services/admin/AdminService'
import DoctorScheduleManagementTab from '../../components/admin/DoctorScheduleManagementTab'
import {
    StatusBadge,
    EmptyState,
    CalendarCheck,
    CalendarPlus,
    FloppyDisk,
    Trash,
    ClipboardText,
    MagnifyingGlass,
    Funnel,
    Package,
    CheckCircle,
    XCircle,
    Clock,
    PhoneCall,
    Receipt,
    ArrowsClockwise,
    DownloadSimple,
    Stethoscope,
    Users,
    Hospital,
} from '../../components/common/ClinicIcon'

export default function AppointmentManagementPage() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const location = useLocation()
    const { clinicData } = useSelector((state) => state.app.admin)

    const appointments = clinicData?.appointments || []
    const khoaPhongList = clinicData?.catalogs?.khoaPhong || []
    const staffList = clinicData?.staffList || []
    const servicePackages = clinicData?.servicePackageRegistrations || []
    const treatmentCourses = clinicData?.treatmentCourses || []

    const masterOptions = getMasterOptions(clinicData)
    const defaults = getFormDefaults(clinicData)
    const specialties = masterOptions.specialties || ['Nội tổng quát', 'Tai mũi họng', 'Cơ xương khớp']
    const appointmentStatuses = masterOptions.appointmentStatuses || ['Chờ xác nhận', 'Xác nhận', 'Đang khám', 'Kết thúc khám', 'Từ chối']
    const confirmationActions = masterOptions.appointmentConfirmationActions || ['Từ chối', 'Xác nhận', 'Đang khám', 'Kết thúc khám']
    const genders = masterOptions.genders || ['Nữ', 'Nam', 'Khác']

    const queryTab = new URLSearchParams(location.search).get('tab')
    const [activeServiceTab, setActiveServiceTab] = useState(
        queryTab && ['LICH_HEN', 'GOI_DICH_VU', 'LIEU_TRINH', 'MA_TRAN_LICH_TRUC'].includes(queryTab)
            ? queryTab
            : 'LICH_HEN'
    )

    useEffect(() => {
        if (queryTab && ['LICH_HEN', 'GOI_DICH_VU', 'LIEU_TRINH', 'MA_TRAN_LICH_TRUC'].includes(queryTab)) {
            setActiveServiceTab(queryTab)
        }
    }, [queryTab])

    const [matrixLoading, setMatrixLoading] = useState(false)
    const [scheduleMatrix, setScheduleMatrix] = useState(null)
    const [matrixTuNgay, setMatrixTuNgay] = useState('2026-10-12')
    const [matrixDenNgay, setMatrixDenNgay] = useState('2026-10-18')

    const fetchMatrixData = async () => {
        setMatrixLoading(true)
        try {
            const data = await adminService.getDoctorScheduleMatrix({
                tuNgay: matrixTuNgay,
                denNgay: matrixDenNgay,
            })
            if (data && data.ma_tran_bac_si) {
                setScheduleMatrix(data)
            } else {
                const rawDoctors = staffList.filter((s) => s.hoTen?.includes('BS') || s.vaiTro?.toLowerCase().includes('bác sĩ') || s.vaiTro?.toLowerCase().includes('chuyên môn'))
                const doctors = rawDoctors.length ? rawDoctors : staffList.slice(0, 4)
                const days = [
                    { thu: 'Thứ 2', ngay: '2026-10-12' },
                    { thu: 'Thứ 3', ngay: '2026-10-13' },
                    { thu: 'Thứ 4', ngay: '2026-10-14' },
                    { thu: 'Thứ 5', ngay: '2026-10-15' },
                    { thu: 'Thứ 6', ngay: '2026-10-16' },
                    { thu: 'Thứ 7', ngay: '2026-10-17' },
                    { thu: 'Chủ Nhật', ngay: '2026-10-18' },
                ]
                const shifts = ['SANG', 'CHIEU']
                const mockMatrix = doctors.map((doc, dIdx) => ({
                    bac_si_id: doc.id || dIdx + 1,
                    ten_bac_si: doc.hoTen || doc.ten || 'Bác sĩ',
                    chuyen_khoa: doc.chuyenKhoa || 'Đa khoa',
                    ca_truc: days.flatMap((d, dayIdx) =>
                        shifts.map((ca, sIdx) => {
                            const hasShift = (dIdx + dayIdx + sIdx) % 2 === 0
                            return {
                                shift_id: hasShift ? 100 + dIdx * 20 + dayIdx * 2 + sIdx : null,
                                ngay: d.ngay,
                                ca: ca,
                                ca_label: ca === 'SANG' ? 'Sáng (07:30 - 11:30)' : 'Chiều (13:30 - 17:30)',
                                phong_kham_id: hasShift ? (dIdx % 3) + 1 : null,
                                ten_phong_kham: hasShift ? `Phòng P10${(dIdx % 3) + 1} - Khám ${doc.chuyenKhoa || 'Tổng quát'}` : null,
                                so_cho_online: hasShift ? 5 : 0,
                                so_cho_quay: hasShift ? 3 : 0,
                                so_cho_tong: hasShift ? 8 : 0,
                                da_dat_online: hasShift ? (dIdx + dayIdx) % 4 : 0,
                                da_dat_quay: hasShift ? (sIdx + 1) : 0,
                                con_trong_online: hasShift ? Math.max(0, 5 - ((dIdx + dayIdx) % 4)) : 0,
                                con_trong_quay: hasShift ? Math.max(0, 3 - (sIdx + 1)) : 0,
                                is_active: hasShift,
                                ghi_chu_nghi: !hasShift && dayIdx === 6 ? 'Nghỉ theo kế hoạch' : null,
                            }
                        })
                    ),
                }))
                setScheduleMatrix({
                    tu_ngay: matrixTuNgay,
                    den_ngay: matrixDenNgay,
                    tong_bac_si: mockMatrix.length,
                    tong_ca_truc: mockMatrix.length * 7,
                    danh_sach_ngay: days.map((d) => d.ngay),
                    ma_tran_bac_si: mockMatrix,
                })
            }
        } catch {
            AppToast.error('Không thể tải ma trận lịch trực')
        } finally {
            setMatrixLoading(false)
        }
    }

    useEffect(() => {
        if (activeServiceTab === 'MA_TRAN_LICH_TRUC' && !scheduleMatrix) {
            fetchMatrixData()
        }
    }, [activeServiceTab])

    const buildEmptyAppointment = () => ({
        id: '',
        maLH: `LH26092200${appointments.length + 1}`,
        maBN: `BN0000${150 + appointments.length + 1}`,
        hoTen: '',
        ngaySinh: '1990-01-01',
        tuoi: '36 tuổi',
        gioiTinh: genders[0],
        dienThoai: '',
        taiKhoan: '',
        diaChi: '',
        ngayDatLich: '2026-10-12T10:30',
        bacSi: defaults.defaultDoctor,
        chuyenKhoa: defaults.defaultSpecialty,
        phongKham: defaults.defaultClinicRoom,
        trieuChung: '',
        ghiChu: '',
        trangThai: 'Chờ xác nhận',
        nhanVienXacNhan: defaults.defaultReceptionist,
        ngayXacNhan: new Date().toISOString().replace('T', ' ').slice(0, 16),
        noiDungXacNhan: '',
    })

    const [searchText, setSearchText] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [form, setForm] = useState(() => appointments[0] || buildEmptyAppointment())
    const hasInitializedRef = useRef(false)

    useEffect(() => {
        if (!hasInitializedRef.current && appointments.length > 0) {
            hasInitializedRef.current = true
            setForm((prev) => {
                const hasDraftInputs = prev.id || prev.hoTen || prev.dienThoai || prev.trieuChung || prev.ghiChu
                if (hasDraftInputs) {
                    return prev
                }
                return appointments[0]
            })
        }
    }, [appointments])

    const filteredAppointments = useMemo(() => {
        return appointments.filter((a) => {
            const matchText =
                !searchText ||
                a.hoTen?.toLowerCase().includes(searchText.toLowerCase()) ||
                a.maLH?.toLowerCase().includes(searchText.toLowerCase()) ||
                a.dienThoai?.includes(searchText)
            const matchStatus = statusFilter === 'ALL' || a.trangThai === statusFilter
            return matchText && matchStatus
        })
    }, [appointments, searchText, statusFilter])

    const handleNew = () => {
        setForm(buildEmptyAppointment())
        AppToast.info('Đã khởi tạo mẫu Lịch hẹn mới')
    }

    const handleSave = async () => {
        if (!form.hoTen?.trim() || !form.dienThoai?.trim()) {
            AppToast.error('Vui lòng nhập đầy đủ Họ tên và Số điện thoại đặt lịch')
            return
        }
        const exists = appointments.some((a) => a.id === form.id && form.id)
        let updated
        if (exists) {
            updated = appointments.map((a) => (a.id === form.id ? { ...a, ...form } : a))
        } else {
            const newRecord = {
                ...form,
                id: form.maLH || `LH-${Date.now().toString().slice(-5)}`,
                nhanVienXacNhan: form.nhanVienXacNhan || defaults.defaultReceptionist,
                ngayXacNhan: form.ngayXacNhan || new Date().toISOString().replace('T', ' ').slice(0, 16),
            }
            updated = [newRecord, ...appointments]
            setForm(newRecord)
        }

        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'appointments',
                items: updated,
                auditEntry: {
                    hanhDong: exists ? 'UPDATE_APPOINTMENT' : 'CREATE_APPOINTMENT',
                    doiTuong: `Lịch hẹn ${form.maLH} - BN ${form.hoTen}`,
                    mucDich: 'Cập nhật trạng thái lịch hẹn khám trực tuyến',
                },
            })
        )
        AppToast.success(exists ? 'Đã cập nhật thông tin lịch hẹn' : 'Đã tạo lịch hẹn khám mới thành công')
    }

    const handleDelete = async () => {
        if (!form.id) return
        const updated = appointments.filter((a) => a.id !== form.id)
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'appointments',
                items: updated,
                auditEntry: {
                    hanhDong: 'DELETE_APPOINTMENT',
                    doiTuong: `Lịch hẹn ${form.maLH} - BN ${form.hoTen}`,
                    mucDich: 'Hủy lịch hẹn khám',
                },
            })
        )
        setForm(updated[0] || buildEmptyAppointment())
        AppToast.info('Đã xóa lịch hẹn khám')
    }

    const handleConvertToRegistration = () => {
        navigate('/admin/dang-ky-kham')
        AppToast.info(`Mở Tiếp đón cho BN ${form.hoTen}. Nhấn 'Chọn từ Lịch hẹn' để nạp tự động`)
    }

    const handleSessionCheckIn = (course) => {
        if (course.soBuoiDaTap >= course.tongSoBuoi) {
            AppToast.warning('Liệu trình đã hoàn thành đủ số buổi')
            return
        }
        const updated = treatmentCourses.map((c) =>
            c.id === course.id ? { ...c, soBuoiDaTap: c.soBuoiDaTap + 1 } : c
        )
        dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'treatmentCourses',
                items: updated,
                auditEntry: {
                    hanhDong: 'CHECKIN_TREATMENT_SESSION',
                    doiTuong: `${course.maDangKy} - BN ${course.tenBN}`,
                    mucDich: `Điểm danh buổi điều trị thứ ${course.soBuoiDaTap + 1}/${course.tongSoBuoi}`,
                },
            })
        )
        AppToast.success(`Đã điểm danh buổi ${course.soBuoiDaTap + 1}/${course.tongSoBuoi} cho BN ${course.tenBN}`)
    }

    return (
        <div className="space-y-4">
            <div className="medpro-card p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex flex-wrap items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border">
                    <button
                        type="button"
                        onClick={() => setActiveServiceTab('LICH_HEN')}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors duration-75 flex items-center gap-1.5 cursor-pointer ${
                            activeServiceTab === 'LICH_HEN'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <CalendarCheck size={15} weight="bold" />
                        <span>1. Lịch hẹn khám &amp; Telemedicine ({appointments.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveServiceTab('GOI_DICH_VU')}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors duration-75 flex items-center gap-1.5 cursor-pointer ${
                            activeServiceTab === 'GOI_DICH_VU'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <Package size={15} weight="bold" />
                        <span>2. Gói dịch vụ ({servicePackages.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveServiceTab('LIEU_TRINH')}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors duration-75 flex items-center gap-1.5 cursor-pointer ${
                            activeServiceTab === 'LIEU_TRINH'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <ClipboardText size={15} weight="bold" />
                        <span>3. Liệu trình điều trị ({treatmentCourses.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveServiceTab('MA_TRAN_LICH_TRUC')}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors duration-75 flex items-center gap-1.5 cursor-pointer ${
                            activeServiceTab === 'MA_TRAN_LICH_TRUC'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <CalendarPlus size={15} weight="bold" />
                        <span>4. Ma trận Lịch trực &amp; Ca khám</span>
                    </button>
                </div>
            </div>

            {activeServiceTab === 'LICH_HEN' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    <div className="lg:col-span-4 medpro-card p-3.5 flex flex-col h-[calc(100vh-140px)]">
                        <div className="medpro-section-title">
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarCheck size={16} weight="duotone" className="text-clinic-cta" />
                                <span>DANH SÁCH LỊCH HẸN ({filteredAppointments.length})</span>
                            </span>
                            <span className="text-xs font-semibold text-clinic-text-muted">Đồng bộ trực tuyến</span>
                        </div>

                        <div className="grid grid-cols-12 gap-2 mb-3">
                            <div className="col-span-7 relative">
                                <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder="Tìm tên, Mã LH, SĐT..."
                                    className="medpro-input !py-1.5 h-9 !pl-8 text-xs"
                                />
                            </div>
                            <div className="col-span-5 relative">
                                <Funnel size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none" />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="medpro-input !py-1.5 h-9 !pl-7 text-xs font-semibold truncate"
                                >
                                    <option value="ALL">Tất cả</option>
                                    {appointmentStatuses.map((st) => (
                                        <option key={st} value={st}>
                                            {st}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden border border-clinic-border rounded-[6px]">
                            <table className="medpro-table w-full [&_th]:!px-1.5 [&_td]:!px-1.5 text-xs">
                                <thead>
                                    <tr>
                                        <th className="w-7 text-center">#</th>
                                        <th>Mã LH</th>
                                        <th>Họ tên BN</th>
                                        <th>Giờ hẹn</th>
                                        <th className="text-center">TT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAppointments.map((a, idx) => {
                                        const [apptDate, apptTime] = String(a.ngayDatLich || '').split('T')
                                        return (
                                            <tr
                                                key={a.id || idx}
                                                onClick={() => setForm({ ...buildEmptyAppointment(), ...a })}
                                                className={`cursor-pointer transition-colors ${
                                                    form.id === a.id ? '!bg-clinic-surface-alt font-semibold' : ''
                                                }`}
                                            >
                                                <td className="tabular-nums text-center font-bold text-clinic-text-secondary w-7">{idx + 1}</td>
                                                <td className="font-mono text-[10.5px] font-bold text-clinic-cta max-w-[78px] truncate" title={a.maLH}>
                                                    {a.maLH}
                                                </td>
                                                <td className="min-w-0">
                                                    <div className="font-semibold text-clinic-navy leading-tight">{a.hoTen}</div>
                                                    <div className="text-[10px] text-clinic-text-muted font-mono">{a.dienThoai}</div>
                                                </td>
                                                <td className="tabular-nums text-[10.5px] leading-tight text-clinic-text-secondary whitespace-nowrap">
                                                    <div>{apptDate}</div>
                                                    {apptTime && <div className="text-clinic-text-muted">{apptTime}</div>}
                                                </td>
                                                <td className="text-center">
                                                    <StatusBadge status={a.trangThai} compact />
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {filteredAppointments.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-8">
                                                <EmptyState icon="CalendarCheck" title="Không tìm thấy lịch hẹn" />
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="lg:col-span-8 medpro-card p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-clinic-border">
                            <div>
                                <h2 className="font-display text-sm font-extrabold text-clinic-navy uppercase">
                                    CHI TIẾT LỊCH HẸN &amp; XÁC NHẬN CỦA LỄ TÂN
                                </h2>
                                <p className="text-xs text-clinic-text-secondary">
                                    Xác nhận giờ hẹn với người bệnh và chuyển tiếp đón tại quầy
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={handleNew} className="medpro-btn-outline !py-1.5 !px-3 text-xs">
                                    <CalendarPlus size={15} weight="bold" className="text-clinic-cta" />
                                    <span>Tạo mới</span>
                                </button>
                                <button type="button" onClick={handleSave} className="medpro-btn-primary !py-1.5 !px-3 text-xs">
                                    <FloppyDisk size={15} weight="bold" />
                                    <span>Lưu lịch hẹn</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConvertToRegistration}
                                    className="medpro-btn-amber !py-1.5 !px-3 text-xs font-bold"
                                >
                                    <ClipboardText size={15} weight="bold" />
                                    <span>Chuyển sang Tiếp đón</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="medpro-label !mb-0">Mã lịch hẹn</label>
                                    <span className="medpro-badge-info !text-[10px]">
                                        Tự sinh
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    value={form.maLH || ''}
                                    readOnly
                                    disabled
                                    className="medpro-input font-mono font-bold bg-clinic-bg-muted text-clinic-text-muted cursor-not-allowed select-none"
                                    title="Mã lịch hẹn do hệ thống tự sinh, không thể chỉnh sửa"
                                />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="medpro-label !mb-0">Mã bệnh nhân</label>
                                    <span className="medpro-badge-info !text-[10px]">
                                        Tự sinh
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    value={form.maBN || ''}
                                    readOnly
                                    disabled
                                    className="medpro-input font-mono bg-clinic-bg-muted text-clinic-text-muted cursor-not-allowed select-none"
                                    title="Mã bệnh nhân liên kết từ hồ sơ bệnh nhân, không thể chỉnh sửa"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Họ tên người bệnh *</label>
                                <input
                                    type="text"
                                    value={form.hoTen || ''}
                                    onChange={(e) => setForm({ ...form, hoTen: e.target.value })}
                                    className="medpro-input font-semibold"
                                />
                            </div>

                            <div>
                                <label className="medpro-label">Số điện thoại *</label>
                                <input
                                    type="text"
                                    value={form.dienThoai || ''}
                                    onChange={(e) => setForm({ ...form, dienThoai: e.target.value })}
                                    className="medpro-input font-mono tabular-nums"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Giới tính</label>
                                <select
                                    value={form.gioiTinh || genders[0] || ''}
                                    onChange={(e) => setForm({ ...form, gioiTinh: e.target.value })}
                                    className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
                                >
                                    {genders.map((g) => (
                                        <option key={g} value={g}>
                                            {g}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="medpro-label">Tuổi</label>
                                <input
                                    type="text"
                                    value={form.tuoi || ''}
                                    onChange={(e) => setForm({ ...form, tuoi: e.target.value })}
                                    className="medpro-input tabular-nums"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Ngày hẹn khám</label>
                                <input
                                    type="datetime-local"
                                    value={form.ngayDatLich || ''}
                                    onChange={(e) => setForm({ ...form, ngayDatLich: e.target.value })}
                                    className="medpro-input tabular-nums"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="medpro-label">Chuyên khoa đăng ký</label>
                                <select
                                    value={form.chuyenKhoa || defaults.defaultSpecialty || ''}
                                    onChange={(e) => setForm({ ...form, chuyenKhoa: e.target.value })}
                                    className="medpro-input !py-1.5 h-9 text-xs font-bold text-clinic-navy truncate"
                                >
                                    {specialties.map((s) => (
                                        <option key={s} value={s}>
                                            {s}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Bác sĩ khám</label>
                                <select
                                    value={form.bacSi || defaults.defaultDoctor || ''}
                                    onChange={(e) => setForm({ ...form, bacSi: e.target.value })}
                                    className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
                                >
                                    {(form.bacSi || defaults.defaultDoctor) &&
                                        !staffList.some((s) => s.vaiTro?.includes('Bác sĩ') && s.hoTen === (form.bacSi || defaults.defaultDoctor)) && (
                                            <option value={form.bacSi || defaults.defaultDoctor}>
                                                {String(form.bacSi || defaults.defaultDoctor).replace(/\b(PGS\.TS|GS\.TS|TS\.BS|BS\.CKII|BS\.CKI|ThS\.BS|BS)\s+\1\b/gi, '$1')}
                                            </option>
                                        )}
                                    {staffList
                                        .filter((s) => {
                                            if (!s.vaiTro || !s.vaiTro.includes('Bác sĩ')) return false
                                            if (!form.chuyenKhoa) return true
                                            const normDoc = (s.chuyenKhoa || '').toLowerCase()
                                            const normDept = (form.chuyenKhoa || '').toLowerCase().replace(/khoa\s*/g, '')
                                            return normDoc.includes(normDept) || normDept.includes(normDoc)
                                        })
                                        .map((doc) => (
                                            <option key={doc.id} value={doc.hoTen}>
                                                {doc.hoTen}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className="sm:col-span-4">
                                <label className="medpro-label">Triệu chứng ban đầu</label>
                                <input
                                    type="text"
                                    value={form.trieuChung || ''}
                                    onChange={(e) => setForm({ ...form, trieuChung: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                        </div>

                        <div className="p-3.5 rounded-[6px] bg-clinic-bg border border-clinic-border space-y-3">
                            <div className="text-xs font-bold text-clinic-navy uppercase flex items-center gap-1.5">
                                <CheckCircle size={16} weight="fill" className="text-clinic-cta" />
                                <span>XÁC NHẬN CỦA NHÂN VIÊN LỄ TÂN</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="medpro-label">Trạng thái xác nhận</label>
                                    <select
                                        value={form.trangThai || 'Chờ xác nhận'}
                                        onChange={(e) => setForm({ ...form, trangThai: e.target.value })}
                                        className="medpro-input !py-1.5 h-9 text-xs font-bold text-clinic-cta truncate"
                                    >
                                        {confirmationActions.map((act) => (
                                            <option key={act} value={act}>
                                                {act}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="medpro-label">Nhân viên tiếp đón</label>
                                    <input type="text" value={form.nhanVienXacNhan || defaults.defaultReceptionist || ''} readOnly className="medpro-input" />
                                </div>
                                <div>
                                    <label className="medpro-label">Ngày xác nhận</label>
                                    <input type="text" value={form.ngayXacNhan || ''} readOnly className="medpro-input tabular-nums" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeServiceTab === 'GOI_DICH_VU' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="medpro-section-title">
                        <span>DANH SÁCH ĐĂNG KÝ GÓI KHÁM SỨC KHỎE TỔNG QUÁT</span>
                        <span className="medpro-badge-info tabular-nums">{servicePackages.length} gói đăng ký</span>
                    </div>

                    <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                        <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
                            <thead>
                                <tr>
                                    <th>Mã LH</th>
                                    <th>Mã BN</th>
                                    <th>Tên bệnh nhân</th>
                                    <th>Gói dịch vụ</th>
                                    <th>Ngày tạo</th>
                                    <th>Ngày khám</th>
                                    <th>Tổng tiền</th>
                                    <th>Giảm giá</th>
                                    <th>Thành tiền</th>
                                    <th>Trạng thái</th>
                                    <th>Thanh toán</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {servicePackages.map((pkg) => (
                                    <tr key={pkg.id}>
                                        <td className="font-mono font-bold text-clinic-cta whitespace-nowrap">{pkg.maLH}</td>
                                        <td className="font-mono text-xs whitespace-nowrap">{pkg.maBN}</td>
                                        <td className="font-bold text-clinic-navy">{pkg.tenBN}</td>
                                        <td className="font-semibold text-clinic-navy">{pkg.tenGoi}</td>
                                        <td className="text-xs text-clinic-text-secondary tabular-nums whitespace-nowrap">{pkg.ngayTao}</td>
                                        <td className="text-xs tabular-nums whitespace-nowrap">{pkg.ngayKham}</td>
                                        <td className="tabular-nums font-mono whitespace-nowrap">{(pkg.tongTien || 0).toLocaleString('vi-VN')} đ</td>
                                        <td className="tabular-nums text-clinic-success font-bold whitespace-nowrap">-{(pkg.giamGia || 0).toLocaleString('vi-VN')} đ</td>
                                        <td className="tabular-nums font-mono font-extrabold text-clinic-cta whitespace-nowrap">
                                            {(pkg.thanhTien || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td>
                                            <StatusBadge status={pkg.trangThai} compact />
                                        </td>
                                        <td className="whitespace-nowrap">
                                            <span className={pkg.thanhToan === 'Đã thu tiền' ? 'medpro-badge-success' : 'medpro-badge-warning'}>
                                                {pkg.thanhToan}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={() => AppToast.success(`Đã cập nhật trạng thái gói cho BN ${pkg.tenBN}`)}
                                                className="medpro-btn-outline !py-1 !px-2.5 text-[11px]"
                                            >
                                                Cập nhật
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeServiceTab === 'LIEU_TRINH' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="medpro-section-title">
                        <span>QUẢN LÝ LIỆU TRÌNH ĐIỀU TRỊ DÀI NGÀY</span>
                        <span className="medpro-badge-info tabular-nums">{treatmentCourses.length} liệu trình</span>
                    </div>

                    <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                        <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
                            <thead>
                                <tr>
                                    <th>Mã ĐK</th>
                                    <th>Tên bệnh nhân</th>
                                    <th>Liệu trình điều trị</th>
                                    <th>Bác sĩ chỉ định</th>
                                    <th>Tiến độ số buổi</th>
                                    <th>Lịch lặp lại</th>
                                    <th>Thành tiền</th>
                                    <th>Thanh toán</th>
                                    <th>Trạng thái</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {treatmentCourses.map((course) => (
                                    <tr key={course.id}>
                                        <td className="font-mono font-bold text-clinic-cta whitespace-nowrap">{course.maDangKy}</td>
                                        <td>
                                            <div className="font-bold text-clinic-navy">{course.tenBN}</div>
                                            <div className="text-[11px] text-clinic-text-muted font-mono">{course.dienThoai} &bull; {course.tuoi}</div>
                                        </td>
                                        <td className="font-semibold text-clinic-navy">
                                            <div>{course.tenLieuTrinh}</div>
                                            <div className="text-[11px] text-clinic-text-secondary font-normal mt-0.5">{course.baiTap}</div>
                                        </td>
                                        <td className="font-medium text-xs">{course.bacSi}</td>
                                        <td>
                                            <div className="font-extrabold text-xs text-clinic-navy tabular-nums">
                                                {course.soBuoiDaTap} / {course.tongSoBuoi} buổi
                                            </div>
                                            <div className="w-24 bg-clinic-bg-muted rounded-[4px] h-1.5 mt-1 overflow-hidden border border-clinic-border">
                                                <div
                                                    className="h-1.5 bg-clinic-cta rounded-[4px]"
                                                    style={{ width: `${(course.soBuoiDaTap / course.tongSoBuoi) * 100}%` }}
                                                />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex flex-wrap gap-1">
                                                {(course.lichLapLai || []).map((day) => (
                                                    <span key={day} className="medpro-badge-info !px-1.5 !py-0.5 !text-[10px]">
                                                        {day}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="font-mono font-bold text-clinic-navy whitespace-nowrap">
                                            {(course.thanhTien || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="whitespace-nowrap">
                                            <span className="medpro-badge-success">{course.thanhToan}</span>
                                        </td>
                                        <td>
                                            <StatusBadge status={course.trangThai} compact />
                                        </td>
                                        <td className="whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={() => handleSessionCheckIn(course)}
                                                className="medpro-btn-primary !py-1 !px-2.5 text-[11px]"
                                            >
                                                Điểm danh buổi
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeServiceTab === 'MA_TRAN_LICH_TRUC' && (
                <DoctorScheduleManagementTab />
            )}
        </div>
    )
}