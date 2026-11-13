import { useState, useMemo, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { loadClinicDataAsync, updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../../components/common/AppNotification'
import { getMasterOptions, getFormDefaults } from '../../utils/helpers/clinicConfigHelpers'
import { receptionService } from '../../services/reception/receptionService'
import { unwrapApi, unwrapPagedApi, pickErrorMessage } from '../../utils/helpers/apiHelper'
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
    const staffList = clinicData?.staffList || []
    const servicePackages = useMemo(
        () => (clinicData?.servicePackageRegistrations || []).filter(
            (pkg) => pkg.is_synthetic !== true && !String(pkg.data_classification || '').includes('SYNTHETIC_TEST_FIXTURE'),
        ),
        [clinicData?.servicePackageRegistrations],
    )
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

    const clinicToday = () => {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(new Date()).map(({ type, value }) => [type, value]))
        return `${parts.year}-${parts.month}-${parts.day}`
    }

    const buildEmptyAppointment = () => ({
        id: '',
        maLH: '',
        maBN: '',
        hoTen: '',
        ngaySinh: '',
        tuoi: '',
        gioiTinh: genders[0],
        dienThoai: '',
        taiKhoan: '',
        diaChi: '',
        ngayDatLich: '',
        bacSi: '',
        chuyenKhoa: defaults.defaultSpecialty,
        phongKham: defaults.defaultClinicRoom,
        trieuChung: '',
        ghiChu: '',
        trangThai: 'Chờ xác nhận',
        nhanVienXacNhan: '',
        ngayXacNhan: '',
        noiDungXacNhan: '',
    })

    const [searchText, setSearchText] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [createForm, setCreateForm] = useState(() => ({ patientId: '', specialtyId: '', doctorId: '', appointmentDate: clinicToday(), timeSlot: '', reason: '' }))
    const [createPatientSearch, setCreatePatientSearch] = useState('')
    const [createPatients, setCreatePatients] = useState([])
    const [createSpecialties, setCreateSpecialties] = useState([])
    const [createDoctors, setCreateDoctors] = useState([])
    const [createSlots, setCreateSlots] = useState([])
    const [createError, setCreateError] = useState('')
    const [createOptionsLoading, setCreateOptionsLoading] = useState(false)
    const [createPatientsLoading, setCreatePatientsLoading] = useState(false)
    const [createSlotsLoading, setCreateSlotsLoading] = useState(false)
    const [createSaving, setCreateSaving] = useState(false)
    const [form, setForm] = useState(() => appointments[0] || buildEmptyAppointment())
    const hasInitializedRef = useRef(false)

    const loadCreatePatients = async (query = createPatientSearch) => {
        setCreatePatientsLoading(true)
        setCreateError('')
        try {
            const result = unwrapPagedApi(await receptionService.searchPatients({ search: query.trim() || undefined, page: 1, page_size: 20 }))
            setCreatePatients(result.items)
        } catch (error) {
            setCreatePatients([])
            setCreateError(pickErrorMessage(error, 'Không thể tìm người bệnh từ hệ thống.'))
        } finally {
            setCreatePatientsLoading(false)
        }
    }

    const handleOpenCreate = async () => {
        setCreateForm({ patientId: '', specialtyId: '', doctorId: '', appointmentDate: clinicToday(), timeSlot: '', reason: '' })
        setCreatePatientSearch('')
        setCreatePatients([])
        setCreateDoctors([])
        setCreateSlots([])
        setCreateError('')
        setIsCreateModalOpen(true)
        setCreateOptionsLoading(true)
        try {
            const specialties = unwrapApi(await receptionService.getSpecialties())
            setCreateSpecialties(Array.isArray(specialties) ? specialties : [])
        } catch (error) {
            setCreateSpecialties([])
            setCreateError(pickErrorMessage(error, 'Không thể tải chuyên khoa từ hệ thống.'))
        } finally {
            setCreateOptionsLoading(false)
        }
        await loadCreatePatients('')
    }

    const handleCreateSpecialtyChange = async (specialtyId) => {
        setCreateForm((prev) => ({ ...prev, specialtyId, doctorId: '', timeSlot: '' }))
        setCreateDoctors([])
        setCreateSlots([])
        if (!specialtyId) return
        setCreateOptionsLoading(true)
        setCreateError('')
        try {
            const result = unwrapPagedApi(await receptionService.getDoctors({ specialty_id: Number(specialtyId), page: 1, page_size: 100 }), 100)
            setCreateDoctors(result.items)
        } catch (error) {
            setCreateError(pickErrorMessage(error, 'Không thể tải bác sĩ từ hệ thống.'))
        } finally {
            setCreateOptionsLoading(false)
        }
    }

    useEffect(() => {
        if (!isCreateModalOpen || !createForm.doctorId || !createForm.appointmentDate) {
            setCreateSlots([])
            setCreateSlotsLoading(false)
            return undefined
        }
        let active = true
        setCreateSlotsLoading(true)
        setCreateError('')
        receptionService.getDoctorSlots(createForm.doctorId, createForm.appointmentDate)
            .then((response) => {
                if (active) setCreateSlots((unwrapApi(response)?.slots || []).filter((slot) => slot.status === 'available'))
            })
            .catch((error) => {
                if (active) {
                    setCreateSlots([])
                    setCreateError(pickErrorMessage(error, 'Không thể tải khung giờ trống.'))
                }
            })
            .finally(() => { if (active) setCreateSlotsLoading(false) })
        return () => { active = false }
    }, [isCreateModalOpen, createForm.doctorId, createForm.appointmentDate])

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

    const handleNew = () => handleOpenCreate()

    const handleSave = async () => {
        if (!form.id) {
            AppToast.error('Lịch hẹn mới phải được tạo từ người bệnh, bác sĩ và khung giờ còn trống của hệ thống.')
            return
        }
        if (!form.hoTen?.trim() || !form.dienThoai?.trim()) {
            AppToast.error('Vui lòng nhập đầy đủ Họ tên và Số điện thoại đặt lịch!')
            return
        }
        const updated = appointments.map((a) => (a.id === form.id ? { ...a, ...form } : a))

        try {
            await dispatch(updateClinicCollectionAsync({
                collectionKey: 'appointments',
                items: updated,
                auditEntry: {
                    hanhDong: 'UPDATE_APPOINTMENT',
                    doiTuong: `Lịch hẹn ${form.maLH} - BN ${form.hoTen}`,
                    mucDich: 'Cập nhật trạng thái lịch hẹn khám trực tuyến',
                },
            })).unwrap()
            AppToast.success('Đã cập nhật thông tin lịch hẹn!')
        } catch (error) {
            AppToast.error(pickErrorMessage(error, 'Không thể cập nhật lịch hẹn.'))
        }
    }

    const handleCreateAppointment = async () => {
        if (!createForm.patientId || !createForm.doctorId || !createForm.appointmentDate || !createForm.timeSlot) {
            setCreateError('Vui lòng chọn người bệnh, bác sĩ, ngày khám và khung giờ còn trống.')
            return
        }
        setCreateSaving(true)
        setCreateError('')
        try {
            const response = await receptionService.createAppointment({
                benh_nhan_id: Number(createForm.patientId),
                bac_si_id: Number(createForm.doctorId),
                ngay_kham: createForm.appointmentDate,
                gio_kham: createForm.timeSlot.length === 5 ? `${createForm.timeSlot}:00` : createForm.timeSlot,
                ly_do_kham: createForm.reason.trim() || undefined,
            })
            const record = unwrapApi(response)
            if (!record?.id || !record?.ma_lich_kham) throw new Error('Hệ thống chưa xác nhận mã lịch hẹn. Vui lòng thử lại.')
            setIsCreateModalOpen(false)
            AppToast.success(`Đã tạo lịch hẹn ${record.ma_lich_kham} thành công.`)
            dispatch(loadClinicDataAsync()).unwrap().catch(() => AppToast.warning('Lịch hẹn đã được tạo, nhưng danh sách chưa thể làm mới.'))
        } catch (error) {
            setCreateError(pickErrorMessage(error, 'Không thể tạo lịch hẹn. Vui lòng thử lại.'))
        } finally {
            setCreateSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!form.id) return
        const updated = appointments.filter((a) => a.id !== form.id)
        try {
            await dispatch(updateClinicCollectionAsync({
                collectionKey: 'appointments',
                items: updated,
                auditEntry: {
                    hanhDong: 'DELETE_APPOINTMENT',
                    doiTuong: `Lịch hẹn ${form.maLH} - BN ${form.hoTen}`,
                    mucDich: 'Hủy lịch hẹn khám',
                },
            })).unwrap()
        } catch (error) {
            AppToast.error(pickErrorMessage(error, 'Không thể xóa lịch hẹn.'))
            return
        }
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
                </div>
            </div>

            {activeServiceTab === 'LICH_HEN' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    <div className="lg:col-span-4 medpro-card p-3.5 flex flex-col h-[calc(100vh-140px)]">
                        <div className="medpro-section-title">
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarCheck size={16} weight="duotone" className="text-[#00B5F1]" />
                                <span>DANH SÁCH LỊCH HẸN ({filteredAppointments.length})</span>
                            </span>
                            <span className="text-xs font-semibold text-slate-400">Medpro Sync</span>
                        </div>

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
                                <button type="button" onClick={handleSave} disabled={!form.id} className="medpro-btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-50">
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="medpro-label mb-0">Mã lịch hẹn</label>
                                    <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                        Hệ thống tự sinh
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    value={form.maLH || ''}
                                    readOnly
                                    disabled
                                    className="medpro-input font-mono font-bold bg-slate-100 text-slate-500 cursor-not-allowed select-none"
                                    title="Mã lịch hẹn do hệ thống tự sinh, không thể chỉnh sửa"
                                />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="medpro-label mb-0">Mã bệnh nhân</label>
                                    <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                        Hệ thống tự sinh
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    value={form.maBN || ''}
                                    readOnly
                                    disabled
                                    className="medpro-input font-mono bg-slate-100 text-slate-500 cursor-not-allowed select-none"
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
                                    <input type="text" value={form.nhanVienXacNhan || (form.id ? defaults.defaultReceptionist : '')} readOnly className="medpro-input" />
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

            {activeServiceTab === 'MA_TRAN_LICH_TRUC' && (
                <DoctorScheduleManagementTab />
            )}

            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="create-appointment-title">
                    <div className="w-full max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 id="create-appointment-title" className="text-sm font-black uppercase text-[#003553]">TẠO LỊCH HẸN TỪ DỮ LIỆU HỆ THỐNG</h3>
                            <button type="button" onClick={() => setIsCreateModalOpen(false)} aria-label="Đóng" className="text-slate-400 hover:text-slate-600">
                                <XCircle size={18} weight="bold" />
                            </button>
                        </div>

                        {createError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{createError}</p>}

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Tìm người bệnh</label>
                                <div className="flex gap-2">
                                    <input type="search" value={createPatientSearch} onChange={(e) => setCreatePatientSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); loadCreatePatients() } }} placeholder="Tên, số điện thoại hoặc mã hồ sơ" className="medpro-input" />
                                    <button type="button" onClick={() => loadCreatePatients()} disabled={createPatientsLoading} className="medpro-btn-outline shrink-0 text-xs disabled:opacity-50">Tìm</button>
                                </div>
                                <select value={createForm.patientId} onChange={(e) => setCreateForm((prev) => ({ ...prev, patientId: e.target.value }))} disabled={createPatientsLoading} className="medpro-input mt-2">
                                    <option value="">{createPatientsLoading ? 'Đang tải người bệnh...' : 'Chọn hồ sơ người bệnh'}</option>
                                    {createPatients.map((patient) => (
                                        <option key={patient.id} value={patient.id}>{patient.ho_ten || patient.fullName}{patient.so_dien_thoai || patient.phone ? ` · ${patient.so_dien_thoai || patient.phone}` : ''}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="medpro-label">Chuyên khoa</label>
                                <select value={createForm.specialtyId} onChange={(e) => handleCreateSpecialtyChange(e.target.value)} disabled={createOptionsLoading || !createSpecialties.length} className="medpro-input">
                                    <option value="">{createOptionsLoading ? 'Đang tải...' : 'Chọn chuyên khoa'}</option>
                                    {createSpecialties.map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.ten_chuyen_khoa}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="medpro-label">Bác sĩ</label>
                                <select value={createForm.doctorId} onChange={(e) => setCreateForm((prev) => ({ ...prev, doctorId: e.target.value, timeSlot: '' }))} disabled={!createDoctors.length || createOptionsLoading} className="medpro-input">
                                    <option value="">{createForm.specialtyId ? 'Chọn bác sĩ' : 'Chọn chuyên khoa trước'}</option>
                                    {createDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.hoc_vi ? `${doctor.hoc_vi} ` : ''}{doctor.ho_ten}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="medpro-label">Ngày khám</label>
                                <input type="date" min={clinicToday()} value={createForm.appointmentDate} onChange={(e) => setCreateForm((prev) => ({ ...prev, appointmentDate: e.target.value, timeSlot: '' }))} className="medpro-input" />
                            </div>
                            <div>
                                <label className="medpro-label">Khung giờ còn trống</label>
                                <select value={createForm.timeSlot} onChange={(e) => setCreateForm((prev) => ({ ...prev, timeSlot: e.target.value }))} disabled={!createForm.doctorId || createSlotsLoading || !createSlots.length} className="medpro-input">
                                    <option value="">{createSlotsLoading ? 'Đang tải khung giờ...' : createForm.doctorId ? 'Chọn giờ trống' : 'Chọn bác sĩ trước'}</option>
                                    {createSlots.map((slot) => <option key={slot.time_str} value={slot.time_str}>{slot.time_str}</option>)}
                                </select>
                                {createForm.doctorId && !createSlotsLoading && !createSlots.length && <p className="mt-1 text-[11px] text-slate-500">Không có khung giờ trống trong ngày này.</p>}
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Lý do khám</label>
                                <input type="text" maxLength={255} value={createForm.reason} onChange={(e) => setCreateForm((prev) => ({ ...prev, reason: e.target.value }))} className="medpro-input" />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="medpro-btn-outline text-xs">Hủy</button>
                            <button type="button" onClick={handleCreateAppointment} disabled={createSaving || createSlotsLoading} className="medpro-btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-50">
                                {createSaving ? 'Đang tạo...' : 'Tạo lịch hẹn'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>
    )
}
