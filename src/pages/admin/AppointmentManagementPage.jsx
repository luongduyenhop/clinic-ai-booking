import { useState, useMemo, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../../components/common/AppNotification'
import { getMasterOptions, getFormDefaults } from '../../services/admin/clinicSeedData'
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
        queryTab && ['LICH_HEN', 'GOI_DICH_VU', 'LIEU_TRINH'].includes(queryTab)
            ? queryTab
            : 'LICH_HEN'
    )

    useEffect(() => {
        if (queryTab && ['LICH_HEN', 'GOI_DICH_VU', 'LIEU_TRINH'].includes(queryTab)) {
            setActiveServiceTab(queryTab)
        }
    }, [queryTab])

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
        </div>
    )
}
