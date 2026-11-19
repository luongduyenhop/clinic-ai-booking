import { useState, useMemo, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { updateClinicCollectionAsync, suggestSpecialtyByAIAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../../components/common/AppNotification'
import { getMasterOptions, getFormDefaults } from '../../utils/helpers/clinicConfigHelpers'
import {
    StatusBadge,
    EmptyState,
    ClipboardText,
    CalendarCheck,
    Plus,
    FloppyDisk,
    Trash,
    Stethoscope,
    Printer,
    Sparkle,
    MagnifyingGlass,
    Funnel,
    X,
    Package,
    ClockCounterClockwise,
    Heartbeat,
    MapPin,
    UserCheck,
    WarningCircle,
    CheckCircle,
} from '../../components/common/ClinicIcon'

export default function ReceptionRegistrationPage() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { clinicData } = useSelector((state) => state.app.admin)

    const registrations = clinicData?.registrations || []
    const appointments = clinicData?.appointments || []
    const patients = clinicData?.patients || []
    const khoaPhongList = clinicData?.catalogs?.khoaPhong || []
    const staffList = clinicData?.staffList || []
    const dichVuList = clinicData?.catalogs?.dichVu || []
    const addressShortcuts = clinicData?.addressShortcuts || []
    const referrers = clinicData?.referrers || []
    const templates = clinicData?.templates || []

    const masterOptions = getMasterOptions(clinicData)
    const defaults = getFormDefaults(clinicData)
    const registrationStatuses = masterOptions.registrationStatuses || ['Chờ khám', 'Đang khám', 'Đã khám']
    const genders = masterOptions.genders || ['Nữ', 'Nam', 'Khác']

    const buildEmptyRegistrationForm = () => ({
        id: '',
        stt: registrations.length + 1,
        maKCB: `${new Date().toISOString().slice(2, 10).replace(/-/g, '')}000${registrations.length + 1}`,
        maBN: '',
        hoTen: '',
        ngaySinh: '1990-01-01',
        tuoi: '36 tuổi',
        gioiTinh: genders[0],
        dienThoai: '',
        nguoiLienHe: '',
        nguoiGioiThieu: referrers[0] || 'Khách tự đến / Đặt qua Medpro-ClinicAI',
        tienSuDiUng: '',
        goTatDiaChi: '',
        maLichHen: '',
        taiKhoan: '',
        diaChi: '',
        phongKham: khoaPhongList[0]?.tenPhong || defaults.defaultClinicRoom,
        chuyenKhoa: khoaPhongList[0]?.chuyenKhoa || defaults.defaultSpecialty,
        bacSi: khoaPhongList[0]?.bacSiPhuTrach || defaults.defaultDoctor,
        ngayDangKy: new Date().toISOString().replace('T', ' ').slice(0, 16),
        uuTien: false,
        trieuChung: '',
        ghiChu: '',
        trangThai: registrationStatuses[0],
        vitals: {
            nhietDo: '36.8',
            nhipTho: '18',
            canNang: '60',
            chieuCao: '165',
            bmi: '22.0',
            spo2: '98',
            huyetAp: '120/80',
            mach: '76',
        },
        services: [
            {
                id: `SRV-${Date.now().toString().slice(-4)}`,
                maDV: dichVuList[0]?.maDV || 'DV001',
                tenDV: dichVuList[0]?.tenDV || 'Khám nội tổng quát',
                dvt: dichVuList[0]?.dvt || 'Lượt',
                soLuong: 1,
                donGia: dichVuList[0]?.donGia || 120000,
                giamGia: 0,
                thanhTien: dichVuList[0]?.donGia || 120000,
                phongTH: dichVuList[0]?.phongTH || khoaPhongList[0]?.tenPhong,
                trangThaiCLS: 'Chờ thực hiện',
            },
        ],
    })

    const [searchText, setSearchText] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [activeRightTab, setActiveRightTab] = useState('THONG_TIN')
    const [form, setForm] = useState(() => registrations[0] || buildEmptyRegistrationForm())
    const hasInitializedRef = useRef(false)

    useEffect(() => {
        if (!hasInitializedRef.current && registrations.length > 0) {
            hasInitializedRef.current = true
            setForm((prev) => {
                const hasDraftInputs =
                    prev.id ||
                    prev.hoTen ||
                    prev.dienThoai ||
                    prev.lyDoKham ||
                    prev.bhyt ||
                    (prev.vitals && (prev.vitals.mach || prev.vitals.huyetAp))
                if (hasDraftInputs) {
                    return prev
                }
                return registrations[0]
            })
        }
    }, [registrations])
    const [aiSuggestion, setAiSuggestion] = useState(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [showAppointmentModal, setShowAppointmentModal] = useState(false)
    const [showPackageModal, setShowPackageModal] = useState(false)

    const filteredRegistrations = useMemo(() => {
        return registrations.filter((r) => {
            const matchText =
                !searchText ||
                r.hoTen?.toLowerCase().includes(searchText.toLowerCase()) ||
                r.maKCB?.toLowerCase().includes(searchText.toLowerCase()) ||
                r.dienThoai?.includes(searchText)
            const matchStatus = statusFilter === 'ALL' || r.trangThai === statusFilter
            return matchText && matchStatus
        })
    }, [registrations, searchText, statusFilter])

    const handleSelectRegistration = (item) => {
        setForm({
            ...buildEmptyRegistrationForm(),
            ...item,
            vitals: item.vitals || buildEmptyRegistrationForm().vitals,
            services: item.services || buildEmptyRegistrationForm().services,
        })
        setAiSuggestion(null)
    }

    const handleNewRegistration = () => {
        setForm(buildEmptyRegistrationForm())
        setActiveRightTab('THONG_TIN')
        setAiSuggestion(null)
        AppToast.info('Đã khởi tạo mẫu phiếu Đăng ký khám mới (F2)!')
    }

    const handlePickAppointment = (appt) => {
        setForm({
            ...buildEmptyRegistrationForm(),
            maBN: appt.maBN,
            hoTen: appt.hoTen,
            ngaySinh: appt.ngaySinh,
            tuoi: appt.tuoi,
            gioiTinh: appt.gioiTinh,
            dienThoai: appt.dienThoai,
            maLichHen: appt.maLH,
            taiKhoan: appt.taiKhoan || appt.dienThoai,
            diaChi: appt.diaChi,
            phongKham: appt.phongKham || khoaPhongList[0]?.tenPhong || defaults.defaultClinicRoom,
            chuyenKhoa: appt.chuyenKhoa || defaults.defaultSpecialty,
            bacSi: appt.bacSi || defaults.defaultDoctor,
            trieuChung: appt.trieuChung,
            ghiChu: appt.ghiChu,
            trangThai: registrationStatuses[0],
        })
        setShowAppointmentModal(false)
        AppToast.success(`Đã nạp thông tin từ Lịch hẹn ${appt.maLH} của bệnh nhân ${appt.hoTen}`)
    }

    const handleAISuggestSpecialty = async () => {
        if (!form.trieuChung?.trim()) {
            AppToast.warning('Vui lòng nhập Triệu chứng ban đầu để Trợ lý AI gợi ý chuyên khoa!')
            return
        }
        setAiLoading(true)
        try {
            const res = await dispatch(suggestSpecialtyByAIAsync(form.trieuChung))
            if (res?.data) {
                setAiSuggestion(res.data)
                setForm((prev) => ({
                    ...prev,
                    chuyenKhoa: res.data.chuyenKhoa || prev.chuyenKhoa,
                    phongKham: res.data.phongKham || prev.phongKham,
                    bacSi: res.data.bacSi || prev.bacSi,
                }))
                AppToast.success('Trợ lý AI đã gợi ý chuyên khoa & phòng khám phù hợp!')
            }
        } catch {
            AppToast.error('Không thể kết nối dịch vụ AI gợi ý chuyên khoa.')
        } finally {
            setAiLoading(false)
        }
    }

    const handleSelectAddressShortcut = (shortcutCode) => {
        const found = addressShortcuts.find((s) => s.code === shortcutCode)
        if (found) {
            setForm((prev) => ({
                ...prev,
                goTatDiaChi: shortcutCode,
                diaChi: found.diaChiGoiY,
            }))
            AppToast.info(`Đã tự động điền địa chỉ: ${found.diaChiGoiY}`)
        }
    }

    const handleAddService = (serviceCode) => {
        const dv = dichVuList.find((d) => d.maDV === serviceCode)
        if (!dv) return
        const newSrv = {
            id: `SRV-${Date.now().toString().slice(-4)}`,
            maDV: dv.maDV,
            tenDV: dv.tenDV,
            dvt: dv.dvt,
            soLuong: 1,
            donGia: dv.donGia,
            giamGia: 0,
            thanhTien: dv.donGia,
            phongTH: dv.phongTH,
            trangThaiCLS: 'Chờ thực hiện',
        }
        setForm((prev) => ({
            ...prev,
            services: [...(prev.services || []), newSrv],
        }))
        AppToast.success(`Đã thêm chỉ định dịch vụ: ${dv.tenDV}`)
    }

    const handleApplyPackage = (pkg) => {
        const packageServices = (pkg.services || []).map((s, idx) => ({
            id: `PKG-SRV-${Date.now().toString().slice(-4)}-${idx}`,
            maDV: s.maDV,
            tenDV: s.tenDV,
            dvt: s.dvt,
            soLuong: s.soLuong || 1,
            donGia: s.donGia,
            giamGia: 0,
            thanhTien: (s.soLuong || 1) * s.donGia,
            phongTH: s.phongTH,
            trangThaiCLS: 'Chờ thực hiện',
        }))
        setForm((prev) => ({
            ...prev,
            services: [...(prev.services || []), ...packageServices],
        }))
        setShowPackageModal(false)
        AppToast.success(`Đã nạp toàn bộ danh mục từ: ${pkg.tenMau}`)
    }

    const handleRemoveService = (srvId) => {
        setForm((prev) => ({
            ...prev,
            services: (prev.services || []).filter((s) => s.id !== srvId),
        }))
    }

    const totalServiceCost = (form.services || []).reduce((sum, s) => sum + (Number(s.thanhTien) || 0), 0)

    const handleSaveRegistration = async () => {
        if (!form.hoTen?.trim()) {
            AppToast.warning('Vui lòng nhập Họ tên bệnh nhân!')
            return
        }
        if (!form.dienThoai?.trim()) {
            AppToast.warning('Vui lòng nhập Số điện thoại liên hệ!')
            return
        }

        const exists = Boolean(form.id)
        let updatedList
        if (exists) {
            updatedList = registrations.map((r) => (r.id === form.id ? { ...r, ...form } : r))
        } else {
            const newRecord = {
                ...form,
                id: `REG-${Date.now().toString().slice(-6)}`,
                stt: registrations.length + 1,
                maBN: form.maBN || `BN${String(patients.length + 1).padStart(7, '0')}`,
                ngayDangKy: form.ngayDangKy || new Date().toISOString().replace('T', ' ').slice(0, 16),
            }
            updatedList = [newRecord, ...registrations]
            setForm(newRecord)
        }

        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'registrations',
                items: updatedList,
                auditEntry: {
                    hanhDong: exists ? 'UPDATE_REGISTRATION' : 'CREATE_REGISTRATION',
                    doiTuong: `Mã KCB ${form.maKCB} - BN ${form.hoTen}`,
                    mucDich: 'Tiếp đón & Đăng ký khám bệnh tại quầy (chuẩn tClinic)',
                },
            })
        )
        AppToast.success(exists ? 'Đã cập nhật thông tin đăng ký khám (F5)!' : 'Đã tạo lượt đăng ký khám mới thành công!')
    }

    const handleDeleteRegistration = async () => {
        if (!form.id) return
        const updated = registrations.filter((r) => r.id !== form.id)
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'registrations',
                items: updated,
                auditEntry: {
                    hanhDong: 'DELETE_REGISTRATION',
                    doiTuong: `Mã KCB ${form.maKCB} - BN ${form.hoTen}`,
                    mucDich: 'Hủy lượt đăng ký khám chưa thực hiện',
                },
            })
        )
        setForm(updated[0] || buildEmptyRegistrationForm())
        AppToast.info('Đã xóa lượt đăng ký khám!')
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            <div className="lg:col-span-4 medpro-card p-3.5 flex flex-col h-[calc(100vh-88px)]">
                <div className="medpro-section-title">
                    <span className="inline-flex items-center gap-1.5">
                        <ClipboardText size={16} weight="duotone" className="text-clinic-cta" />
                        <span>DANH SÁCH ĐĂNG KÝ ({filteredRegistrations.length})</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowAppointmentModal(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-clinic-cta hover:underline cursor-pointer shrink-0 whitespace-nowrap"
                    >
                        <CalendarCheck size={14} weight="duotone" />
                        <span>Lịch hẹn ({appointments.length})</span>
                    </button>
                </div>

                <div className="grid grid-cols-12 gap-2 mb-3">
                    <div className="col-span-7 relative">
                        <MagnifyingGlass
                            size={14}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none"
                        />
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Tìm tên, Mã KCB, SĐT..."
                            className="medpro-input !py-1.5 h-9 !pl-8 text-xs"
                        />
                    </div>
                    <div className="col-span-5 relative">
                        <Funnel
                            size={13}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none"
                        />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="medpro-input !py-1.5 h-9 !pl-7 text-xs font-semibold truncate"
                        >
                            <option value="ALL">Tất cả trạng thái</option>
                            {registrationStatuses.map((st) => (
                                <option key={st} value={st}>
                                    {st}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden border border-clinic-border rounded-[6px]">
                    <table className="medpro-table w-full [&_th]:!px-1.5 [&_td]:!px-1.5 text-xs tabular-nums">
                        <thead>
                            <tr>
                                <th className="w-7 text-center">#</th>
                                <th>Mã KCB</th>
                                <th>Họ tên</th>
                                <th className="text-center">UT</th>
                                <th className="text-center">TT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRegistrations.map((r, index) => {
                                const isSelected = form.id === r.id
                                return (
                                    <tr
                                        key={r.id || index}
                                        onClick={() => handleSelectRegistration(r)}
                                        className={`cursor-pointer transition-colors ${
                                            isSelected ? '!bg-clinic-surface-alt font-semibold' : ''
                                        }`}
                                    >
                                        <td className="font-bold text-clinic-text-secondary tabular-nums text-center w-7">{r.stt || index + 1}</td>
                                        <td className="font-mono text-[10.5px] text-clinic-navy max-w-[78px] truncate" title={r.maKCB}>{r.maKCB}</td>
                                        <td className="min-w-0">
                                            <div className="font-bold text-clinic-navy leading-tight">{r.hoTen}</div>
                                            <div className="text-[10.5px] text-clinic-text-muted font-mono">{r.dienThoai}</div>
                                        </td>
                                        <td className="text-center">
                                            {r.uuTien ? (
                                                <span className="medpro-badge-danger !px-1.5 !py-0.5 !text-[10px]">UT</span>
                                            ) : (
                                                <span className="text-clinic-text-subtle text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="text-center">
                                            <StatusBadge status={r.trangThai} compact />
                                        </td>
                                    </tr>
                                )
                            })}
                            {filteredRegistrations.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8">
                                        <EmptyState
                                            icon="ClipboardText"
                                            title="Không tìm thấy lượt đăng ký"
                                            description="Thử thay đổi từ khóa tìm kiếm hoặc bấm Thêm mới (F2)."
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="pt-2.5 flex items-center justify-between text-[11px] text-clinic-text-secondary tabular-nums">
                    <span className="font-bold text-clinic-navy">Phím tắt: F2 Thêm | F5 Lưu | F7 Kê DV | F9 In</span>
                    <span>Tổng: {filteredRegistrations.length}</span>
                </div>
            </div>

            <div className="lg:col-span-8 medpro-card p-4 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-clinic-border">
                        <div className="inline-flex flex-wrap items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border">
                            <button
                                type="button"
                                onClick={() => setActiveRightTab('THONG_TIN')}
                                className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors duration-75 flex items-center gap-1.5 cursor-pointer ${
                                    activeRightTab === 'THONG_TIN'
                                        ? 'bg-clinic-navy text-clinic-surface'
                                        : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                                }`}
                            >
                                <ClipboardText size={15} weight="bold" />
                                <span>Thông tin đăng ký (F2)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveRightTab('KE_DICH_VU')}
                                className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors duration-75 flex items-center gap-1.5 cursor-pointer ${
                                    activeRightTab === 'KE_DICH_VU'
                                        ? 'bg-clinic-navy text-clinic-surface'
                                        : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                                }`}
                            >
                                <Package size={15} weight="bold" />
                                <span>Kê dịch vụ (F7) {form.services?.length ? `(${form.services.length})` : ''}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveRightTab('LICH_SU')}
                                className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors duration-75 flex items-center gap-1.5 cursor-pointer ${
                                    activeRightTab === 'LICH_SU'
                                        ? 'bg-clinic-navy text-clinic-surface'
                                        : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                                }`}
                            >
                                <ClockCounterClockwise size={15} weight="bold" />
                                <span>Lịch sử (F8)</span>
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={handleNewRegistration} className="medpro-btn-outline !py-1.5 !px-3 text-xs">
                                <Plus size={14} weight="bold" className="text-clinic-cta" />
                                <span>Thêm (F2)</span>
                            </button>
                            <button type="button" onClick={handleSaveRegistration} className="medpro-btn-primary !py-1.5 !px-3 text-xs">
                                <FloppyDisk size={14} weight="bold" />
                                <span>Lưu (F5)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/admin/kham-benh')}
                                className="medpro-btn-amber !py-1.5 !px-3 text-xs font-bold"
                            >
                                <Stethoscope size={14} weight="bold" />
                                <span>Khám bệnh</span>
                            </button>
                        </div>
                    </div>

                    {activeRightTab === 'THONG_TIN' && (
                        <div className="space-y-4">
                            <div>
                                <div className="medpro-section-title">
                                    <span>1. THÔNG TIN NGƯỜI ĐĂNG KÝ</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowAppointmentModal(true)}
                                            className="text-xs font-bold text-clinic-cta hover:underline cursor-pointer shrink-0 whitespace-nowrap"
                                        >
                                            Tìm theo Lịch hẹn
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                                            placeholder="Tự động sinh"
                                            className="medpro-input font-mono bg-clinic-bg-muted text-clinic-text-muted cursor-not-allowed select-none"
                                            title="Mã bệnh nhân do hệ thống tự sinh, không thể chỉnh sửa"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="medpro-label">
                                            Họ và tên bệnh nhân <span className="text-clinic-danger">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={form.hoTen || ''}
                                            onChange={(e) => setForm({ ...form, hoTen: e.target.value })}
                                            placeholder="Nhập họ và tên..."
                                            className="medpro-input font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <label className="medpro-label">Ngày sinh</label>
                                        <input
                                            type="date"
                                            value={form.ngaySinh || ''}
                                            onChange={(e) => setForm({ ...form, ngaySinh: e.target.value })}
                                            className="medpro-input tabular-nums"
                                        />
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
                                        <label className="medpro-label">Giới tính</label>
                                        <select
                                            value={form.gioiTinh || genders[0]}
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
                                        <label className="medpro-label">
                                            Số điện thoại <span className="text-clinic-danger">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={form.dienThoai || ''}
                                            onChange={(e) => setForm({ ...form, dienThoai: e.target.value })}
                                            placeholder="09xxxxxxxx"
                                            className="medpro-input tabular-nums font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="medpro-label">Người liên hệ / Người giám hộ</label>
                                        <input
                                            type="text"
                                            value={form.nguoiLienHe || ''}
                                            onChange={(e) => setForm({ ...form, nguoiLienHe: e.target.value })}
                                            placeholder="Bố mẹ, người nhà..."
                                            className="medpro-input"
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className="medpro-label">Người giới thiệu (Hoa hồng &amp; Nguồn BN)</label>
                                        <select
                                            value={form.nguoiGioiThieu || referrers[0]}
                                            onChange={(e) => setForm({ ...form, nguoiGioiThieu: e.target.value })}
                                            className="medpro-input !py-1.5 h-9 text-xs font-semibold text-clinic-navy truncate"
                                        >
                                            {referrers.map((ref, idx) => (
                                                <option key={idx} value={ref}>
                                                    {ref}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="medpro-label text-clinic-warning font-bold flex items-center gap-1">
                                            <WarningCircle size={14} weight="fill" className="text-clinic-warning" />
                                            <span>Tiền sử dị ứng (Thuốc, thức ăn...)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={form.tienSuDiUng || ''}
                                            onChange={(e) => setForm({ ...form, tienSuDiUng: e.target.value })}
                                            placeholder="Dị ứng Penicillin, Aspirin, hải sản... (Để trống nếu không)"
                                            className="medpro-input !bg-clinic-warning-bg !border-clinic-warning-border !text-clinic-warning font-semibold"
                                        />
                                    </div>

                                    <div>
                                        <label className="medpro-label text-clinic-cta font-bold flex items-center gap-1">
                                            <MapPin size={13} weight="fill" />
                                            <span>Gõ tắt địa chỉ</span>
                                        </label>
                                        <select
                                            value={form.goTatDiaChi || ''}
                                            onChange={(e) => handleSelectAddressShortcut(e.target.value)}
                                            className="medpro-input !py-1.5 h-9 text-xs !border-clinic-cta !bg-clinic-surface-tint font-bold text-clinic-navy truncate"
                                        >
                                            <option value="">-- Chọn viết tắt --</option>
                                            {addressShortcuts.map((sc) => (
                                                <option key={sc.code} value={sc.code}>
                                                    {sc.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="sm:col-span-3">
                                        <label className="medpro-label">Địa chỉ chi tiết</label>
                                        <input
                                            type="text"
                                            value={form.diaChi || ''}
                                            onChange={(e) => setForm({ ...form, diaChi: e.target.value })}
                                            placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành..."
                                            className="medpro-input"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="medpro-section-title">
                                    <span>2. THÔNG TIN TIẾP ĐÓN &amp; PHÒNG KHÁM</span>
                                    <button
                                        type="button"
                                        onClick={handleAISuggestSpecialty}
                                        disabled={aiLoading}
                                        className="medpro-btn-outline !py-1 !px-3 text-xs border-clinic-cta text-clinic-navy shrink-0 whitespace-nowrap"
                                    >
                                        <Sparkle size={14} weight="fill" className="text-clinic-cta" />
                                        <span>{aiLoading ? 'Đang phân tích triệu chứng...' : 'Gợi ý Chuyên khoa từ Triệu chứng'}</span>
                                    </button>
                                </div>

                                {aiSuggestion && (
                                    <div className="mb-3 p-3 rounded-[6px] bg-clinic-surface-alt border border-clinic-info-border text-xs space-y-1">
                                        <div className="flex items-center justify-between font-bold text-clinic-navy">
                                            <span className="inline-flex items-center gap-1.5">
                                                <Sparkle size={14} weight="fill" className="text-clinic-cta" />
                                                <span>GỢI Ý PHÂN LUỒNG CHUYÊN KHOA:</span>
                                            </span>
                                            <span className="medpro-badge-warning">{aiSuggestion.mucDoUuTien}</span>
                                        </div>
                                        <div className="text-clinic-text">
                                            • Chuyên khoa: <strong className="text-clinic-cta">{aiSuggestion.chuyenKhoa}</strong> &bull; Phòng đề xuất:{' '}
                                            <strong>{aiSuggestion.phongKham}</strong> &bull; Bác sĩ: <strong>{aiSuggestion.bacSi}</strong>
                                        </div>
                                        <div className="text-[11px] text-clinic-text-secondary">{aiSuggestion.lyDoGoiY}</div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="medpro-label !mb-0">Mã khám (Mã KCB)</label>
                                            <span className="medpro-badge-info !text-[10px]">
                                                Tự sinh
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            value={form.maKCB || ''}
                                            readOnly
                                            disabled
                                            className="medpro-input font-mono font-bold bg-clinic-bg-muted text-clinic-text-muted cursor-not-allowed select-none"
                                            title="Mã khám bệnh do hệ thống tự sinh theo ngày tiếp đón, không thể chỉnh sửa"
                                        />
                                    </div>
                                    <div>
                                        <label className="medpro-label">Số thứ tự (STT)</label>
                                        <input
                                            type="number"
                                            value={form.stt || 1}
                                            onChange={(e) => setForm({ ...form, stt: Number(e.target.value) })}
                                            className="medpro-input font-bold tabular-nums"
                                        />
                                    </div>
                                    <div>
                                        <label className="medpro-label">Phòng khám tiếp nhận</label>
                                        <select
                                            value={form.phongKham || ''}
                                            onChange={(e) => {
                                                const room = khoaPhongList.find((r) => r.tenPhong === e.target.value)
                                                setForm({
                                                    ...form,
                                                    phongKham: e.target.value,
                                                    chuyenKhoa: room?.chuyenKhoa || form.chuyenKhoa,
                                                    bacSi: room?.bacSiPhuTrach || form.bacSi,
                                                })
                                            }}
                                            className="medpro-input !py-1.5 h-9 text-xs font-semibold text-clinic-navy truncate"
                                        >
                                            {khoaPhongList.map((room) => (
                                                <option key={room.id} value={room.tenPhong}>
                                                    {room.tenPhong}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="medpro-label">Ngày đăng ký</label>
                                        <input
                                            type="text"
                                            value={form.ngayDangKy || ''}
                                            onChange={(e) => setForm({ ...form, ngayDangKy: e.target.value })}
                                            className="medpro-input tabular-nums"
                                        />
                                    </div>

                                    <div className="sm:col-span-3">
                                        <label className="medpro-label">Triệu chứng / Lý do đến khám</label>
                                        <input
                                            type="text"
                                            value={form.trieuChung || ''}
                                            onChange={(e) => setForm({ ...form, trieuChung: e.target.value })}
                                            placeholder="Đau ngực, ho, sốt, đau khớp gối..."
                                            className="medpro-input"
                                        />
                                    </div>
                                    <div className="flex items-center pt-5">
                                        <label className="inline-flex items-center gap-2 text-xs font-extrabold text-clinic-navy cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(form.uuTien)}
                                                onChange={(e) => setForm({ ...form, uuTien: e.target.checked })}
                                                className="w-4 h-4 accent-clinic-cta"
                                            />
                                            <span>Khám Ưu Tiên (UT)</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="medpro-section-title">
                                    <span className="flex items-center gap-1.5">
                                        <Heartbeat size={16} weight="duotone" className="text-clinic-danger" />
                                        <span>3. CHỈ SỐ CƠ THỂ &amp; SINH HIỆU (VITALS)</span>
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 tabular-nums">
                                    <div>
                                        <label className="medpro-label text-[11px]">Nhiệt độ (℃)</label>
                                        <input
                                            type="text"
                                            value={form.vitals?.nhietDo || ''}
                                            onChange={(e) => setForm({ ...form, vitals: { ...form.vitals, nhietDo: e.target.value } })}
                                            className="medpro-input text-center font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="medpro-label text-[11px]">Nhịp thở (L/P)</label>
                                        <input
                                            type="text"
                                            value={form.vitals?.nhipTho || ''}
                                            onChange={(e) => setForm({ ...form, vitals: { ...form.vitals, nhipTho: e.target.value } })}
                                            className="medpro-input text-center font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="medpro-label text-[11px]">Huyết áp (mmHg)</label>
                                        <input
                                            type="text"
                                            value={form.vitals?.huyetAp || ''}
                                            onChange={(e) => setForm({ ...form, vitals: { ...form.vitals, huyetAp: e.target.value } })}
                                            className="medpro-input text-center font-bold text-clinic-cta"
                                        />
                                    </div>
                                    <div>
                                        <label className="medpro-label text-[11px]">Mạch (L/P)</label>
                                        <input
                                            type="text"
                                            value={form.vitals?.mach || ''}
                                            onChange={(e) => setForm({ ...form, vitals: { ...form.vitals, mach: e.target.value } })}
                                            className="medpro-input text-center font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="medpro-label text-[11px]">Cân nặng (Kg)</label>
                                        <input
                                            type="text"
                                            value={form.vitals?.canNang || ''}
                                            onChange={(e) => setForm({ ...form, vitals: { ...form.vitals, canNang: e.target.value } })}
                                            className="medpro-input text-center font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="medpro-label text-[11px]">BMI (Kg/m²)</label>
                                        <input
                                            type="text"
                                            value={form.vitals?.bmi || ''}
                                            readOnly
                                            className="medpro-input text-center font-bold bg-clinic-bg-muted"
                                        />
                                    </div>
                                    <div>
                                        <label className="medpro-label text-[11px]">SpO2 (%)</label>
                                        <input
                                            type="text"
                                            value={form.vitals?.spo2 || ''}
                                            onChange={(e) => setForm({ ...form, vitals: { ...form.vitals, spo2: e.target.value } })}
                                            className="medpro-input text-center font-bold text-clinic-success"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeRightTab === 'KE_DICH_VU' && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="medpro-section-title !mb-0">
                                    <span>DANH SÁCH DỊCH VỤ CHỈ ĐỊNH CHO LƯỢT KHÁM</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleAddService(e.target.value)
                                                e.target.value = ''
                                            }
                                        }}
                                        className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
                                        defaultValue=""
                                    >
                                        <option value="" disabled>+ Kê thêm dịch vụ nhanh...</option>
                                        {dichVuList.map((dv) => (
                                            <option key={dv.id} value={dv.maDV}>
                                                {dv.tenDV} ({dv.donGia.toLocaleString('vi-VN')} đ)
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setShowPackageModal(true)}
                                        className="medpro-btn-outline !py-1.5 !px-3 text-xs shrink-0 whitespace-nowrap"
                                    >
                                        <Package size={14} weight="bold" className="text-clinic-cta" />
                                        <span>+ Kê gói dịch vụ</span>
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                                <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
                                    <thead>
                                        <tr>
                                            <th>STT</th>
                                            <th>Mã DV</th>
                                            <th>Tên dịch vụ</th>
                                            <th>ĐVT</th>
                                            <th>SL</th>
                                            <th>Đơn giá</th>
                                            <th>Thành tiền</th>
                                            <th>Phòng thực hiện</th>
                                            <th>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(form.services || []).map((srv, idx) => (
                                            <tr key={srv.id || idx}>
                                                <td className="font-bold">{idx + 1}</td>
                                                <td className="font-mono text-xs text-clinic-navy whitespace-nowrap">{srv.maDV}</td>
                                                <td className="font-bold text-clinic-navy">{srv.tenDV}</td>
                                                <td>{srv.dvt}</td>
                                                <td>{srv.soLuong || 1}</td>
                                                <td className="tabular-nums font-mono whitespace-nowrap">{(srv.donGia || 0).toLocaleString('vi-VN')} đ</td>
                                                <td className="tabular-nums font-mono font-extrabold text-clinic-cta whitespace-nowrap">
                                                    {(srv.thanhTien || 0).toLocaleString('vi-VN')} đ
                                                </td>
                                                <td>{srv.phongTH}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveService(srv.id)}
                                                        className="text-clinic-danger hover:underline p-1 cursor-pointer"
                                                    >
                                                        <Trash size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {(form.services || []).length === 0 && (
                                            <tr>
                                                <td colSpan={9} className="py-6">
                                                    <EmptyState
                                                        icon="Package"
                                                        title="Chưa kê dịch vụ nào"
                                                        description="Chọn dịch vụ từ danh sách hoặc bấm Kê gói dịch vụ."
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-3 rounded-[6px] bg-clinic-bg border border-clinic-border flex items-center justify-between tabular-nums">
                                <div className="text-xs text-clinic-text-secondary font-semibold">
                                    Tổng cộng: <strong className="text-clinic-navy">{form.services?.length || 0} dịch vụ kỹ thuật</strong>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs text-clinic-text-secondary mr-2">Tổng chi phí:</span>
                                    <span className="font-display text-lg font-extrabold text-clinic-cta">
                                        {totalServiceCost.toLocaleString('vi-VN')} đ
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeRightTab === 'LICH_SU' && (
                        <div className="space-y-4">
                            <div className="medpro-section-title">
                                <span>LỊCH SỬ KHÁM BỆNH CỦA BỆNH NHÂN: {form.hoTen || 'Chưa chọn BN'}</span>
                            </div>
                            <div className="space-y-2 tabular-nums">
                                <div className="p-3.5 rounded-[6px] bg-clinic-bg border border-clinic-border text-xs space-y-1">
                                    <div className="flex justify-between font-bold text-clinic-navy">
                                        <span>Lượt khám 06/10/2026 (Mã KCB: 2610060001)</span>
                                        <span className="medpro-badge-success">Đã hoàn thành</span>
                                    </div>
                                    <div className="text-clinic-text-secondary">
                                        Bác sĩ: <strong className="text-clinic-navy">BS.CKII Nguyễn Minh Hoàng</strong> &bull; Chẩn đoán: I10 - Tăng huyết áp vô căn
                                    </div>
                                    <div className="text-[11px] text-clinic-text-muted">
                                        Đơn thuốc: DTQG-2026-000150 (Đã ký số &amp; liên thông Cổng Quốc gia)
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-3 border-t border-clinic-border flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-clinic-text-secondary">
                        Chuyên khoa phân luồng: <strong className="text-clinic-navy">{form.chuyenKhoa || defaults.defaultSpecialty}</strong> &bull; Bác sĩ: <strong className="text-clinic-navy">{form.bacSi}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                        {form.id && (
                            <button type="button" onClick={handleDeleteRegistration} className="medpro-btn-danger !py-1.5 !px-3 text-xs">
                                <Trash size={14} weight="bold" />
                                <span>Xóa</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => AppToast.success(`Đang in Phiếu tiếp đón (F9) cho BN ${form.hoTen}...`)}
                            className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                        >
                            <Printer size={15} weight="duotone" className="text-clinic-cta" />
                            <span>In phiếu (F9)</span>
                        </button>
                        <button type="button" onClick={handleSaveRegistration} className="medpro-btn-primary !py-1.5 !px-3 text-xs">
                            <FloppyDisk size={15} weight="bold" />
                            <span>Lưu (F5)</span>
                        </button>
                    </div>
                </div>
            </div>

            {showAppointmentModal && (
                <div className="fixed inset-0 z-50 bg-clinic-navy/45 flex items-center justify-center p-4">
                    <div className="medpro-card max-w-4xl w-full p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-clinic-border pb-3">
                            <h3 className="font-display font-extrabold text-sm text-clinic-navy inline-flex items-center gap-2 uppercase">
                                <CalendarCheck size={18} weight="duotone" className="text-clinic-cta" />
                                <span>CHỌN BỆNH NHÂN TỪ DANH SÁCH LỊCH HẸN TRỰC TUYẾN</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowAppointmentModal(false)}
                                className="medpro-btn-outline !py-1 !px-2.5 text-xs"
                            >
                                <X size={13} weight="bold" />
                                <span>Đóng</span>
                            </button>
                        </div>

                        <div className="overflow-x-auto max-h-80 border border-clinic-border rounded-[6px]">
                            <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
                                <thead>
                                    <tr>
                                        <th>Mã LH</th>
                                        <th>Họ tên BN</th>
                                        <th>Điện thoại</th>
                                        <th>Giờ hẹn</th>
                                        <th>Chuyên khoa / Phòng</th>
                                        <th>Trạng thái</th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {appointments.map((appt) => (
                                        <tr key={appt.id}>
                                            <td className="font-mono font-bold text-clinic-cta whitespace-nowrap">{appt.maLH}</td>
                                            <td className="font-semibold text-clinic-navy">{appt.hoTen}</td>
                                            <td className="tabular-nums font-mono">{appt.dienThoai}</td>
                                            <td className="tabular-nums">{appt.ngayDatLich?.replace('T', ' ')}</td>
                                            <td>{appt.phongKham}</td>
                                            <td>
                                                <StatusBadge status={appt.trangThai} compact />
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePickAppointment(appt)}
                                                    className="medpro-btn-primary !py-1 !px-3 text-xs"
                                                >
                                                    Chọn tiếp đón
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {showPackageModal && (
                <div className="fixed inset-0 z-50 bg-clinic-navy/45 flex items-center justify-center p-4">
                    <div className="medpro-card max-w-3xl w-full p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-clinic-border pb-3">
                            <h3 className="font-display font-extrabold text-sm text-clinic-navy inline-flex items-center gap-2 uppercase">
                                <Package size={18} weight="duotone" className="text-clinic-cta" />
                                <span>CHỌN GÓI KHÁM SỨC KHỎE (TỪ DANH MỤC MẪU GÓI)</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowPackageModal(false)}
                                className="medpro-btn-outline !py-1 !px-2.5 text-xs"
                            >
                                <X size={13} weight="bold" />
                                <span>Đóng</span>
                            </button>
                        </div>

                        <div className="space-y-2.5 max-h-96 overflow-y-auto">
                            {templates
                                .filter((t) => t.loaiMau === 'ke-goi-dich-vu')
                                .map((pkg) => (
                                    <div
                                        key={pkg.id}
                                        className="p-4 rounded-[6px] border border-clinic-border hover:border-clinic-cta transition-colors flex items-center justify-between gap-3"
                                    >
                                        <div className="space-y-1">
                                            <div className="text-sm font-bold text-clinic-navy">{pkg.tenMau}</div>
                                            <div className="text-xs text-clinic-text-secondary">{pkg.noiDung}</div>
                                            <div className="text-xs font-bold text-clinic-cta tabular-nums">
                                                Bao gồm: {pkg.services?.length || 0} dịch vụ chỉ định
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleApplyPackage(pkg)}
                                            className="medpro-btn-primary !py-1.5 !px-3 text-xs shrink-0"
                                        >
                                            Kê gói này
                                        </button>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
