import { useState, useMemo, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../../components/common/AppNotification'
import { getMasterOptions, getFormDefaults } from '../../utils/helpers/clinicConfigHelpers'
import { adminService } from '../../services/admin/AdminService'
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
        queryTab && ['LICH_HEN', 'GOI_DICH_VU', 'LIEU_TRINH', 'MA_TRAN_LICH_TRUC', 'CHAM_CONG'].includes(queryTab)
            ? queryTab
            : 'LICH_HEN'
    )

    useEffect(() => {
        if (queryTab && ['LICH_HEN', 'GOI_DICH_VU', 'LIEU_TRINH', 'MA_TRAN_LICH_TRUC', 'CHAM_CONG'].includes(queryTab)) {
            setActiveServiceTab(queryTab)
        }
    }, [queryTab])

    // ── Tab 4: Ma trận Lịch trực Bác sĩ & Slot (/shifts/schedule-matrix) ───
    const [matrixLoading, setMatrixLoading] = useState(false)
    const [scheduleMatrix, setScheduleMatrix] = useState(null)
    const [matrixTuNgay, setMatrixTuNgay] = useState('2026-10-12')
    const [matrixDenNgay, setMatrixDenNgay] = useState('2026-10-18')

    // ── Tab 5: Báo cáo Chấm công & Tỷ lệ lấp đầy (/shifts/export-report) ───
    const [timesheetLoading, setTimesheetLoading] = useState(false)
    const [timesheetReport, setTimesheetReport] = useState(null)
    const [timesheetTuNgay, setTimesheetTuNgay] = useState('2026-10-01')
    const [timesheetDenNgay, setTimesheetDenNgay] = useState('2026-10-31')

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
            AppToast.error('Không thể tải ma trận lịch trực!')
        } finally {
            setMatrixLoading(false)
        }
    }

    const fetchTimesheetData = async () => {
        setTimesheetLoading(true)
        try {
            const data = await adminService.exportDoctorTimesheetReport({
                tuNgay: timesheetTuNgay,
                denNgay: timesheetDenNgay,
            })
            if (data && data.danh_sach_cham_cong) {
                setTimesheetReport(data)
            } else {
                const rawDoctors = staffList.filter((s) => s.hoTen?.includes('BS') || s.vaiTro?.toLowerCase().includes('bác sĩ') || s.vaiTro?.toLowerCase().includes('chuyên môn'))
                const doctors = rawDoctors.length ? rawDoctors : staffList.slice(0, 4)
                const mockList = doctors.map((doc, idx) => {
                    const assigned = 24 + (idx * 2) % 6
                    const completed = assigned - (idx % 2 === 0 ? 1 : 0)
                    const phep = idx % 3 === 0 ? 1 : 0
                    const dotXuat = idx % 4 === 0 ? 1 : 0
                    const kham = completed * 6 + (idx * 3)
                    const maxCap = assigned * 8
                    const fillRate = Math.round((kham / maxCap) * 1000) / 10
                    return {
                        bac_si_id: doc.id || idx + 1,
                        ten_bac_si: doc.hoTen || doc.ten || 'Bác sĩ',
                        chuyen_khoa: doc.chuyenKhoa || 'Đa khoa',
                        tong_so_ca_phan_cong: assigned,
                        so_ca_hoan_thanh: completed,
                        so_ca_nghi_phep: phep,
                        so_ca_nghi_dot_xuat: dotXuat,
                        tong_luot_kham: kham,
                        ty_le_lap_day_phan_tram: fillRate,
                    }
                })
                setTimesheetReport({
                    tu_ngay: timesheetTuNgay,
                    den_ngay: timesheetDenNgay,
                    tong_bac_si: mockList.length,
                    tong_ca_toan_vien: mockList.reduce((acc, c) => acc + c.tong_so_ca_phan_cong, 0),
                    tong_luot_kham_toan_vien: mockList.reduce((acc, c) => acc + c.tong_luot_kham, 0),
                    danh_sach_cham_cong: mockList,
                })
            }
        } catch {
            AppToast.error('Không thể tải báo cáo chấm công!')
        } finally {
            setTimesheetLoading(false)
        }
    }

    const handleDownloadTimesheetCsv = () => {
        if (!timesheetReport?.danh_sach_cham_cong?.length) return
        const headers = ['Mã BS', 'Họ tên Bác sĩ', 'Chuyên khoa', 'Số ca phân công', 'Số ca hoàn thành', 'Số ca nghỉ phép', 'Số ca nghỉ đột xuất', 'Số lượt khám', 'Tỷ lệ lấp đầy (%)']
        const rows = timesheetReport.danh_sach_cham_cong.map((r) => [
            `"BS0${r.bac_si_id}"`,
            `"${r.ten_bac_si}"`,
            `"${r.chuyen_khoa}"`,
            r.tong_so_ca_phan_cong,
            r.so_ca_hoan_thanh,
            r.so_ca_nghi_phep,
            r.so_ca_nghi_dot_xuat,
            r.tong_luot_kham,
            r.ty_le_lap_day_phan_tram,
        ])
        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', `Bao_cao_cham_cong_bac_si_${timesheetTuNgay}_den_${timesheetDenNgay}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        AppToast.success('Đã tải xuống file Báo cáo Chấm công Bác sĩ (CSV)!')
    }

    useEffect(() => {
        if (activeServiceTab === 'MA_TRAN_LICH_TRUC' && !scheduleMatrix) {
            fetchMatrixData()
        } else if (activeServiceTab === 'CHAM_CONG' && !timesheetReport) {
            fetchTimesheetData()
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
        AppToast.info('Đã khởi tạo mẫu Lịch hẹn mới!')
    }

    const handleSave = async () => {
        if (!form.hoTen?.trim() || !form.dienThoai?.trim()) {
            AppToast.error('Vui lòng nhập đầy đủ Họ tên và Số điện thoại đặt lịch!')
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
        AppToast.success(exists ? 'Đã cập nhật thông tin lịch hẹn!' : 'Đã tạo lịch hẹn khám mới thành công!')
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
        AppToast.info('Đã xóa lịch hẹn khám!')
    }

    const handleConvertToRegistration = () => {
        navigate('/admin/dang-ky-kham')
        AppToast.info(`Mở Tiếp đón cho BN ${form.hoTen}. Nhấn 'Chọn từ Lịch hẹn' để nạp tự động!`)
    }

    const handleSessionCheckIn = (course) => {
        if (course.soBuoiDaTap >= course.tongSoBuoi) {
            AppToast.warning('Liệu trình đã hoàn thành đủ số buổi!')
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
        AppToast.success(`Đã điểm danh buổi ${course.soBuoiDaTap + 1}/${course.tongSoBuoi} cho BN ${course.tenBN}!`)
    }

    return (
        <div className="space-y-4">
            {/* Top Navigation Tabs across 4 tClinic Booking Modes */}
            <div className="medpro-card p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setActiveServiceTab('LICH_HEN')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                            activeServiceTab === 'LICH_HEN'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <CalendarCheck size={16} weight="bold" />
                        <span>1. Lịch hẹn khám & Telemedicine ({appointments.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveServiceTab('GOI_DICH_VU')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                            activeServiceTab === 'GOI_DICH_VU'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <Package size={16} weight="bold" />
                        <span>2. Gói dịch vụ (/goidichvu) ({servicePackages.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveServiceTab('LIEU_TRINH')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                            activeServiceTab === 'LIEU_TRINH'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <ClipboardText size={16} weight="bold" />
                        <span>3. Liệu trình điều trị (/lieutrinh) ({treatmentCourses.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveServiceTab('MA_TRAN_LICH_TRUC')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                            activeServiceTab === 'MA_TRAN_LICH_TRUC'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <CalendarPlus size={16} weight="bold" />
                        <span>4. Ma trận Lịch trực & Slot (/shifts/schedule-matrix)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveServiceTab('CHAM_CONG')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                            activeServiceTab === 'CHAM_CONG'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <Receipt size={16} weight="bold" />
                        <span>5. Báo cáo Chấm công & Tỷ lệ lấp đầy (/shifts/export-report)</span>
                    </button>
                </div>
            </div>

            {/* TAB 1: LỊCH HẸN KHÁM LẺ & TELEMEDICINE */}
            {activeServiceTab === 'LICH_HEN' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    {/* Left Column (4 cols): Queue Table */}
                    <div className="lg:col-span-4 medpro-card p-3.5 flex flex-col h-[calc(100vh-140px)]">
                        <div className="medpro-section-title">
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarCheck size={16} weight="duotone" className="text-[#00B5F1]" />
                                <span>DANH SÁCH LỊCH HẸN ({filteredAppointments.length})</span>
                            </span>
                            <span className="text-xs font-semibold text-slate-400">Medpro Sync</span>
                        </div>

                        {/* Search & Filter */}
                        <div className="grid grid-cols-12 gap-2 mb-3">
                            <div className="col-span-7 relative">
                                <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder="Tìm tên, Mã LH, SĐT..."
                                    className="medpro-input !pl-8 text-xs"
                                />
                            </div>
                            <div className="col-span-5 relative">
                                <Funnel size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="medpro-input !pl-7 text-xs"
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

                        {/* Appointments Queue Table */}
                        <div className="flex-1 overflow-y-auto border border-[#E5EEF5] rounded-xl">
                            <table className="medpro-table">
                                <thead>
                                    <tr>
                                        <th>STT</th>
                                        <th>Mã LH</th>
                                        <th>Họ tên BN</th>
                                        <th>Giờ hẹn</th>
                                        <th className="text-center">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAppointments.map((a, idx) => (
                                        <tr
                                            key={a.id || idx}
                                            onClick={() => setForm({ ...a })}
                                            className={`cursor-pointer transition ${
                                                form.id === a.id ? '!bg-[#E8F4FD] font-semibold border-l-4 border-l-[#00B5F1]' : 'hover:bg-slate-50'
                                            }`}
                                        >
                                            <td className="tabular-nums text-center font-bold text-slate-500">{idx + 1}</td>
                                            <td className="font-mono text-[11px] font-bold text-[#00B5F1]">{a.maLH}</td>
                                            <td>
                                                <div className="font-semibold text-[#12263F]">{a.hoTen}</div>
                                                <div className="text-[10px] text-slate-400 font-mono">{a.dienThoai}</div>
                                            </td>
                                            <td className="tabular-nums text-[11px] text-slate-600">{a.ngayDatLich?.replace('T', ' ')}</td>
                                            <td className="text-center">
                                                <StatusBadge status={a.trangThai} compact />
                                            </td>
                                        </tr>
                                    ))}
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

                    {/* Right Column (8 cols): Appointment Details & Reception Confirmation */}
                    <div className="lg:col-span-8 medpro-card p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E8F4FD]">
                            <div>
                                <h2 className="font-display text-base font-extrabold text-[#003553] uppercase">
                                    CHI TIẾT LỊCH HẸN & XÁC NHẬN CỦA LỄ TÂN
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Xác nhận giờ hẹn với người bệnh và chuyển tiếp đón tại quầy
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={handleNew} className="medpro-btn-outline text-xs">
                                    <CalendarPlus size={15} weight="bold" className="text-[#00B5F1]" />
                                    <span>Tạo mới</span>
                                </button>
                                <button type="button" onClick={handleSave} className="medpro-btn-primary text-xs">
                                    <FloppyDisk size={15} weight="bold" />
                                    <span>Lưu lịch hẹn</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConvertToRegistration}
                                    className="medpro-btn-amber text-xs font-bold"
                                >
                                    <ClipboardText size={15} weight="bold" />
                                    <span>Chuyển sang Tiếp đón</span>
                                </button>
                            </div>
                        </div>

                        {/* Patient info form */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className="medpro-label">Mã lịch hẹn</label>
                                <input type="text" value={form.maLH || ''} readOnly className="medpro-input font-mono font-bold" />
                            </div>
                            <div>
                                <label className="medpro-label">Mã bệnh nhân</label>
                                <input type="text" value={form.maBN || ''} readOnly className="medpro-input font-mono" />
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
                                    value={form.gioiTinh || genders[0]}
                                    onChange={(e) => setForm({ ...form, gioiTinh: e.target.value })}
                                    className="medpro-input"
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
                                    className="medpro-input"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Ngày hẹn khám</label>
                                <input
                                    type="datetime-local"
                                    value={form.ngayDatLich || ''}
                                    onChange={(e) => setForm({ ...form, ngayDatLich: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="medpro-label">Chuyên khoa đăng ký</label>
                                <select
                                    value={form.chuyenKhoa || defaults.defaultSpecialty}
                                    onChange={(e) => setForm({ ...form, chuyenKhoa: e.target.value })}
                                    className="medpro-input font-bold text-[#003553]"
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
                                    value={form.bacSi || defaults.defaultDoctor}
                                    onChange={(e) => setForm({ ...form, bacSi: e.target.value })}
                                    className="medpro-input"
                                >
                                    {staffList.filter((s) => s.vaiTro.includes('Bác sĩ')).map((doc) => (
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

                        {/* Confirmation Box */}
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3">
                            <div className="text-xs font-bold text-[#003553] uppercase flex items-center gap-1.5">
                                <CheckCircle size={16} weight="fill" className="text-[#00B5F1]" />
                                <span>XÁC NHẬN CỦA NHÂN VIÊN LỄ TÂN</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="medpro-label">Trạng thái xác nhận</label>
                                    <select
                                        value={form.trangThai || 'Chờ xác nhận'}
                                        onChange={(e) => setForm({ ...form, trangThai: e.target.value })}
                                        className="medpro-input font-bold text-[#00B5F1]"
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
                                    <input type="text" value={form.nhanVienXacNhan || defaults.defaultReceptionist} readOnly className="medpro-input" />
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

            {/* TAB 2: GÓI DỊCH VỤ (/goidichvu) */}
            {activeServiceTab === 'GOI_DICH_VU' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="medpro-section-title">
                        <span>DANH SÁCH ĐĂNG KÝ GÓI KHÁM SỨC KHỎE TỔNG QUÁT (/goidichvu)</span>
                        <span className="text-xs font-semibold text-[#00B5F1]">{servicePackages.length} gói đăng ký</span>
                    </div>

                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table">
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
                                        <td className="font-mono font-bold text-[#00B5F1]">{pkg.maLH}</td>
                                        <td className="font-mono text-xs">{pkg.maBN}</td>
                                        <td className="font-bold text-[#12263F]">{pkg.tenBN}</td>
                                        <td className="font-semibold text-[#003553]">{pkg.tenGoi}</td>
                                        <td className="text-xs text-slate-500 tabular-nums">{pkg.ngayTao}</td>
                                        <td className="text-xs tabular-nums">{pkg.ngayKham}</td>
                                        <td className="tabular-nums font-mono">{(pkg.tongTien || 0).toLocaleString('vi-VN')} đ</td>
                                        <td className="tabular-nums text-emerald-600 font-bold">-{(pkg.giamGia || 0).toLocaleString('vi-VN')} đ</td>
                                        <td className="tabular-nums font-mono font-extrabold text-[#00B5F1]">
                                            {(pkg.thanhTien || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td>
                                            <StatusBadge status={pkg.trangThai} compact />
                                        </td>
                                        <td>
                                            <span className={pkg.thanhToan === 'Đã thu tiền' ? 'medpro-badge-success' : 'medpro-badge-warning'}>
                                                {pkg.thanhToan}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                onClick={() => AppToast.success(`Đã cập nhật trạng thái gói cho BN ${pkg.tenBN}!`)}
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

            {/* TAB 3: LIỆU TRÌNH ĐIỀU TRỊ (/lieutrinh) */}
            {activeServiceTab === 'LIEU_TRINH' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="medpro-section-title">
                        <span>QUẢN LÝ LIỆU TRÌNH ĐIỀU TRỊ DÀI NGÀY (/lieutrinh & /danhmucbaitap)</span>
                        <span className="text-xs font-semibold text-[#00B5F1]">{treatmentCourses.length} liệu trình</span>
                    </div>

                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table">
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
                                        <td className="font-mono font-bold text-[#00B5F1]">{course.maDangKy}</td>
                                        <td>
                                            <div className="font-bold text-[#12263F]">{course.tenBN}</div>
                                            <div className="text-[11px] text-slate-400 font-mono">{course.dienThoai} &bull; {course.tuoi}</div>
                                        </td>
                                        <td className="font-semibold text-[#003553]">
                                            <div>{course.tenLieuTrinh}</div>
                                            <div className="text-[11px] text-slate-500 italic mt-0.5">{course.baiTap}</div>
                                        </td>
                                        <td className="font-medium text-xs">{course.bacSi}</td>
                                        <td>
                                            <div className="font-extrabold text-xs text-[#003553]">
                                                {course.soBuoiDaTap} / {course.tongSoBuoi} buổi
                                            </div>
                                            <div className="w-24 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                                                <div
                                                    className="h-1.5 bg-[#00B5F1] rounded-full"
                                                    style={{ width: `${(course.soBuoiDaTap / course.tongSoBuoi) * 100}%` }}
                                                />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex gap-1">
                                                {(course.lichLapLai || []).map((day) => (
                                                    <span key={day} className="px-1.5 py-0.5 rounded bg-sky-100 text-[#003553] text-[10px] font-bold">
                                                        {day}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="font-mono font-bold text-[#003553]">
                                            {(course.thanhTien || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td>
                                            <span className="medpro-badge-success text-[10px]">{course.thanhToan}</span>
                                        </td>
                                        <td>
                                            <StatusBadge status={course.trangThai} compact />
                                        </td>
                                        <td>
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

            {/* TAB 4: MA TRẬN LỊCH TRỰC BÁC SĨ & PHÂN BUỒNG (/shifts/schedule-matrix) */}
            {activeServiceTab === 'MA_TRAN_LICH_TRUC' && (
                <div className="space-y-4">
                    {/* Filter and Overview Banner */}
                    <div className="medpro-card p-4 bg-gradient-to-r from-sky-50 via-[#E8F4FD] to-indigo-50/60 border border-[#00B5F1]/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-[#003553] text-[#00B5F1] flex items-center justify-center shrink-0 shadow-xs">
                                <CalendarPlus size={22} weight="duotone" />
                            </span>
                            <div>
                                <h3 className="font-display font-extrabold text-sm text-[#003553]">
                                    MA TRẬN PHÂN CA TRỰC BÁC SĨ & QUẢN TRỊ BUỒNG KHÁM
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Quản lý lưới lịch trực tuần, tính toán thời gian thực slot trực tuyến & tại quầy theo chuẩn tClinic HIS
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
                                <Clock size={13} className="text-slate-400" />
                                <span className="font-semibold text-slate-500">Từ:</span>
                                <input
                                    type="date"
                                    value={matrixTuNgay}
                                    onChange={(e) => setMatrixTuNgay(e.target.value)}
                                    className="font-medium text-[#003553] outline-hidden cursor-pointer"
                                />
                            </div>
                            <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
                                <span className="font-semibold text-slate-500">Đến:</span>
                                <input
                                    type="date"
                                    value={matrixDenNgay}
                                    onChange={(e) => setMatrixDenNgay(e.target.value)}
                                    className="font-medium text-[#003553] outline-hidden cursor-pointer"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={fetchMatrixData}
                                className="px-3.5 py-1.5 rounded-lg bg-[#00B5F1] hover:bg-[#009cd1] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                                <ArrowsClockwise size={14} weight="bold" className={matrixLoading ? 'animate-spin' : ''} />
                                <span>Tải lại lưới</span>
                            </button>
                        </div>
                    </div>

                    {/* Summary KPI Badges */}
                    {scheduleMatrix && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="medpro-card p-3 flex items-center gap-3">
                                <span className="w-9 h-9 rounded-xl bg-sky-100 text-[#00B5F1] flex items-center justify-center font-bold">
                                    <Users size={18} weight="bold" />
                                </span>
                                <div>
                                    <div className="text-[11px] text-slate-500 font-semibold">Tổng Bác sĩ tham gia</div>
                                    <div className="text-lg font-extrabold text-[#003553]">{scheduleMatrix.tong_bac_si || 0}</div>
                                </div>
                            </div>
                            <div className="medpro-card p-3 flex items-center gap-3">
                                <span className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                                    <CalendarCheck size={18} weight="bold" />
                                </span>
                                <div>
                                    <div className="text-[11px] text-slate-500 font-semibold">Tổng ca trực phân bổ</div>
                                    <div className="text-lg font-extrabold text-[#003553]">{scheduleMatrix.tong_ca_truc || 0}</div>
                                </div>
                            </div>
                            <div className="medpro-card p-3 flex items-center gap-3">
                                <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                                    <Stethoscope size={18} weight="bold" />
                                </span>
                                <div>
                                    <div className="text-[11px] text-slate-500 font-semibold">Khung giờ sáng & chiều</div>
                                    <div className="text-sm font-extrabold text-emerald-600">07:30 - 17:30</div>
                                </div>
                            </div>
                            <div className="medpro-card p-3 flex items-center gap-3">
                                <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                                    <Hospital size={18} weight="bold" />
                                </span>
                                <div>
                                    <div className="text-[11px] text-slate-500 font-semibold">Quy chuẩn xếp buồng</div>
                                    <div className="text-sm font-extrabold text-amber-600">Đơn lập 1 BS/Buồng</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Schedule Matrix Grid */}
                    <div className="medpro-card p-4 overflow-x-auto">
                        {matrixLoading ? (
                            <div className="py-16 text-center text-slate-500 text-xs">
                                Đang tải ma trận phân ca và tính toán slot khả dụng...
                            </div>
                        ) : !scheduleMatrix || !scheduleMatrix.ma_tran_bac_si?.length ? (
                            <EmptyState icon="CalendarPlus" title="Không có dữ liệu ca trực trong khoảng ngày đã chọn" />
                        ) : (
                            <table className="medpro-table text-xs min-w-[900px]">
                                <thead>
                                    <tr>
                                        <th className="w-48 sticky left-0 bg-white z-10 shadow-xs">Bác sĩ & Chuyên khoa</th>
                                        {(scheduleMatrix.danh_sach_ngay || []).map((dayStr) => (
                                            <th key={dayStr} className="text-center font-bold">
                                                <div>{dayStr}</div>
                                                <div className="text-[10px] font-normal text-slate-400">
                                                    Sáng | Chiều
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {scheduleMatrix.ma_tran_bac_si.map((row) => (
                                        <tr key={row.bac_si_id} className="hover:bg-slate-50/80">
                                            <td className="sticky left-0 bg-white z-10 shadow-xs">
                                                <div className="font-extrabold text-[#003553]">{row.ten_bac_si}</div>
                                                <div className="text-[10px] text-slate-500 font-semibold">{row.chuyen_khoa}</div>
                                            </td>
                                            {(scheduleMatrix.danh_sach_ngay || []).map((dayStr) => {
                                                const shiftsForDay = (row.ca_truc || []).filter((s) => s.ngay === dayStr)
                                                return (
                                                    <td key={dayStr} className="p-1.5 align-top">
                                                        <div className="grid grid-cols-2 gap-1">
                                                            {['SANG', 'CHIEU'].map((ca) => {
                                                                const shiftItem = shiftsForDay.find((s) => s.ca === ca)
                                                                if (!shiftItem || !shiftItem.is_active) {
                                                                    return (
                                                                        <div
                                                                            key={ca}
                                                                            className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 p-1.5 text-center text-[10px] text-slate-400"
                                                                        >
                                                                            <span className="font-bold text-[9px] block text-slate-400">{ca === 'SANG' ? 'S' : 'C'}</span>
                                                                            {shiftItem?.ghi_chu_nghi ? (
                                                                                <span className="text-amber-600 font-bold text-[8px] block truncate">Nghỉ</span>
                                                                            ) : (
                                                                                <span>-</span>
                                                                            )}
                                                                        </div>
                                                                    )
                                                                }

                                                                return (
                                                                    <div
                                                                        key={ca}
                                                                        className="rounded-md border border-[#00B5F1]/30 bg-[#E8F4FD]/50 p-1.5 space-y-0.5 text-[10px] hover:border-[#00B5F1] transition shadow-2xs"
                                                                    >
                                                                        <div className="flex items-center justify-between font-bold text-[#003553]">
                                                                            <span>{ca === 'SANG' ? 'S' : 'C'}</span>
                                                                            <span className="text-[9px] px-1 py-0.2 rounded bg-[#00B5F1] text-white">
                                                                                {shiftItem.so_cho_tong} chỗ
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-[9px] text-slate-600 font-medium truncate" title={shiftItem.ten_phong_kham}>
                                                                            {shiftItem.ten_phong_kham ? shiftItem.ten_phong_kham.split('-')[0].trim() : 'P.Khám'}
                                                                        </div>
                                                                        <div className="flex justify-between text-[9px] font-semibold">
                                                                            <span className="text-sky-700">Online: {shiftItem.con_trong_online}</span>
                                                                            <span className="text-slate-600">Quầy: {shiftItem.con_trong_quay}</span>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 5: BÁO CÁO CHẤM CÔNG & TỶ LỆ LẤP ĐẦY (/shifts/export-report) */}
            {activeServiceTab === 'CHAM_CONG' && (
                <div className="space-y-4">
                    {/* Header and Filter */}
                    <div className="medpro-card p-4 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-sky-50 border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-emerald-700 text-emerald-100 flex items-center justify-center shrink-0 shadow-xs">
                                <Receipt size={22} weight="bold" />
                            </span>
                            <div>
                                <h3 className="font-display font-extrabold text-sm text-[#003553]">
                                    BÁO CÁO CHẤM CÔNG VÀ NĂNG SUẤT LÂM SÀNG BÁC SĨ (TIMESHEET)
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Thống kê số ca trực, số ca nghỉ phép/đột xuất, số lượt khám và tỷ lệ lấp đầy ca khám (Fill Rate %)
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
                                <span className="font-semibold text-slate-500">Từ:</span>
                                <input
                                    type="date"
                                    value={timesheetTuNgay}
                                    onChange={(e) => setTimesheetTuNgay(e.target.value)}
                                    className="font-medium text-[#003553] outline-hidden cursor-pointer"
                                />
                            </div>
                            <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
                                <span className="font-semibold text-slate-500">Đến:</span>
                                <input
                                    type="date"
                                    value={timesheetDenNgay}
                                    onChange={(e) => setTimesheetDenNgay(e.target.value)}
                                    className="font-medium text-[#003553] outline-hidden cursor-pointer"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={fetchTimesheetData}
                                className="px-3.5 py-1.5 rounded-lg bg-[#003553] hover:bg-[#002840] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                                <ArrowsClockwise size={14} weight="bold" className={timesheetLoading ? 'animate-spin' : ''} />
                                <span>Xem báo cáo</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadTimesheetCsv}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                                <DownloadSimple size={14} weight="bold" />
                                <span>Xuất CSV Chấm công</span>
                            </button>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    {timesheetReport && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="medpro-card p-3.5">
                                <div className="text-[11px] font-semibold text-slate-500">Tổng Bác sĩ trực</div>
                                <div className="text-xl font-extrabold text-[#003553] mt-1">{timesheetReport.tong_bac_si || 0} bác sĩ</div>
                            </div>
                            <div className="medpro-card p-3.5">
                                <div className="text-[11px] font-semibold text-slate-500">Tổng ca phân công toàn viện</div>
                                <div className="text-xl font-extrabold text-[#00B5F1] mt-1">{timesheetReport.tong_ca_toan_vien || 0} ca</div>
                            </div>
                            <div className="medpro-card p-3.5">
                                <div className="text-[11px] font-semibold text-slate-500">Tổng lượt bệnh nhân khám xong</div>
                                <div className="text-xl font-extrabold text-emerald-600 mt-1">{timesheetReport.tong_luot_kham_toan_vien || 0} lượt</div>
                            </div>
                            <div className="medpro-card p-3.5">
                                <div className="text-[11px] font-semibold text-slate-500">Tỷ lệ lấp đầy bình quân</div>
                                <div className="text-xl font-extrabold text-indigo-600 mt-1">
                                    {timesheetReport.danh_sach_cham_cong?.length
                                        ? Math.round((timesheetReport.danh_sach_cham_cong.reduce((acc, cur) => acc + (cur.ty_le_lap_day_phan_tram || 0), 0) / timesheetReport.danh_sach_cham_cong.length) * 10) / 10
                                        : 0}%
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Timesheet Table */}
                    <div className="medpro-card p-4">
                        <div className="overflow-x-auto">
                            {timesheetLoading ? (
                                <div className="py-16 text-center text-slate-500 text-xs">
                                    Đang tổng hợp dữ liệu chấm công và tính toán tỷ lệ lấp đầy...
                                </div>
                            ) : !timesheetReport || !timesheetReport.danh_sach_cham_cong?.length ? (
                                <EmptyState icon="Receipt" title="Không tìm thấy dữ liệu chấm công" />
                            ) : (
                                <table className="medpro-table text-xs">
                                    <thead>
                                        <tr>
                                            <th>Mã BS</th>
                                            <th>Họ tên Bác sĩ</th>
                                            <th>Chuyên khoa</th>
                                            <th className="text-center">Số ca phân công</th>
                                            <th className="text-center">Đã hoàn thành</th>
                                            <th className="text-center">Nghỉ phép</th>
                                            <th className="text-center">Nghỉ đột xuất</th>
                                            <th className="text-center">Lượt khám (BN)</th>
                                            <th className="w-48 text-center">Tỷ lệ lấp đầy (Fill Rate)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {timesheetReport.danh_sach_cham_cong.map((item) => (
                                            <tr key={item.bac_si_id}>
                                                <td className="font-mono font-bold text-[#003553]">BS0{item.bac_si_id}</td>
                                                <td className="font-bold text-[#12263F]">{item.ten_bac_si}</td>
                                                <td className="text-slate-500">{item.chuyen_khoa}</td>
                                                <td className="text-center font-bold text-slate-700">{item.tong_so_ca_phan_cong}</td>
                                                <td className="text-center font-bold text-emerald-600">{item.so_ca_hoan_thanh}</td>
                                                <td className="text-center text-amber-600 font-semibold">{item.so_ca_nghi_phep}</td>
                                                <td className="text-center text-rose-600 font-semibold">{item.so_ca_nghi_dot_xuat}</td>
                                                <td className="text-center font-extrabold text-[#003553]">{item.tong_luot_kham}</td>
                                                <td>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-[11px] font-bold">
                                                            <span
                                                                className={
                                                                    item.ty_le_lap_day_phan_tram >= 75
                                                                        ? 'text-emerald-600'
                                                                        : item.ty_le_lap_day_phan_tram >= 50
                                                                        ? 'text-amber-600'
                                                                        : 'text-rose-600'
                                                                }
                                                            >
                                                                {item.ty_le_lap_day_phan_tram}%
                                                            </span>
                                                            <span className="text-[10px] text-slate-400">
                                                                {item.ty_le_lap_day_phan_tram >= 75 ? 'Rất tốt' : item.ty_le_lap_day_phan_tram >= 50 ? 'Bình thường' : 'Thấp'}
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                            <div
                                                                className={`h-1.5 rounded-full ${
                                                                    item.ty_le_lap_day_phan_tram >= 75
                                                                        ? 'bg-emerald-500'
                                                                        : item.ty_le_lap_day_phan_tram >= 50
                                                                        ? 'bg-amber-500'
                                                                        : 'bg-rose-500'
                                                                }`}
                                                                style={{ width: `${Math.min(100, item.ty_le_lap_day_phan_tram)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
