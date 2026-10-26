import { useState, useMemo, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../../components/common/AppNotification'
import {
    getMasterOptions,
    getFormDefaults,
    getProvincesFromCatalog,
    getDistrictsByProvince,
    getWardsByDistrict,
} from '../../utils/helpers/clinicConfigHelpers'
import {
    StatusBadge,
    EmptyState,
    Users,
    UserPlus,
    FloppyDisk,
    Trash,
    ClipboardText,
    Camera,
    UploadSimple,
    MagnifyingGlass,
    PlusCircle,
    CheckCircle,
    IdentificationCard,
    Heartbeat,
} from '../../components/common/ClinicIcon'

export default function PatientManagementPage() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { clinicData } = useSelector((state) => state.app.admin)
    const location = useLocation()
    const queryTab = new URLSearchParams(location.search).get('tab')
    const [activeMainTab, setActiveMainTab] = useState(
        queryTab === 'GIA_DINH' ? 'GIA_DINH' : 'HO_SO'
    )

    useEffect(() => {
        if (queryTab === 'GIA_DINH') {
            setActiveMainTab('GIA_DINH')
        } else {
            setActiveMainTab('HO_SO')
        }
    }, [queryTab])

    const patients = clinicData?.patients || []
    const registrations = clinicData?.registrations || []

    const masterOptions = getMasterOptions(clinicData)
    const defaults = getFormDefaults(clinicData)
    const genders = masterOptions.genders || ['Nữ', 'Nam', 'Khác']
    const maritalStatuses = masterOptions.maritalStatuses || ['Độc thân', 'Đã kết hôn', 'Khác']
    const countries = masterOptions.countries || ['Việt Nam', 'Nước ngoài']

    const buildEmptyPatient = () => ({
        id: '',
        maBN: `BN0000${150 + patients.length + 1}`,
        hoTen: '',
        ngaySinh: '1992-06-15',
        tuoi: '34 tuổi',
        gioiTinh: genders[0],
        tinhTrangHonNhan: maritalStatuses[1],
        dienThoai: '',
        cccd: '',
        email: '',
        quocGia: countries[0],
        tinhThanh: defaults.defaultProvince,
        quanHuyen: defaults.defaultDistrict,
        phuongXa: defaults.defaultWard,
        diaChi: '',
        taiKhoan: '',
        matKhau: '123456',
        nhomMau: 'O+',
        diUng: 'Không ghi nhận dị ứng',
        ngayTao: new Date().toLocaleDateString('vi-VN'),
        trangThai: 'Đang hoạt động',
    })

    const [search, setSearch] = useState('')
    const [form, setForm] = useState(() => patients[0] || buildEmptyPatient())

    const provinces = useMemo(() => getProvincesFromCatalog(clinicData), [clinicData])
    const districts = useMemo(
        () => getDistrictsByProvince(clinicData, form.tinhThanh),
        [clinicData, form.tinhThanh]
    )
    const wards = useMemo(
        () => getWardsByDistrict(clinicData, form.quanHuyen),
        [clinicData, form.quanHuyen]
    )

    const filteredPatients = useMemo(() => {
        return patients.filter(
            (p) =>
                !search ||
                p.hoTen?.toLowerCase().includes(search.toLowerCase()) ||
                p.maBN?.toLowerCase().includes(search.toLowerCase()) ||
                p.dienThoai?.includes(search)
        )
    }, [patients, search])

    const patientHistory = useMemo(() => {
        if (!form.maBN) return []
        return registrations.filter((r) => r.maBN === form.maBN)
    }, [registrations, form.maBN])

    const handleNew = () => {
        setForm(buildEmptyPatient())
        AppToast.info('Đã mở biểu mẫu Thêm mới Bệnh nhân!')
    }

    const handleSave = async () => {
        if (!form.hoTen?.trim() || !form.dienThoai?.trim()) {
            AppToast.error('Vui lòng nhập Họ tên và Số điện thoại bệnh nhân!')
            return
        }

        const exists = patients.some((p) => p.id === form.id && form.id)
        let updated
        if (exists) {
            updated = patients.map((p) => (p.id === form.id ? { ...p, ...form } : p))
        } else {
            const newPatient = {
                ...form,
                id: form.maBN || `BN0000${150 + patients.length + 1}`,
                taiKhoan: form.taiKhoan || form.dienThoai,
            }
            updated = [newPatient, ...patients]
            setForm(newPatient)
        }

        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'patients',
                items: updated,
                auditEntry: {
                    hanhDong: exists ? 'UPDATE_PATIENT' : 'CREATE_PATIENT',
                    doiTuong: `${form.maBN} - ${form.hoTen}`,
                    mucDich: 'Quản lý hồ sơ hành chính bệnh nhân',
                },
            })
        )
        AppToast.success(exists ? 'Đã cập nhật hồ sơ bệnh nhân!' : 'Đã thêm mới bệnh nhân thành công!')
    }

    const handleDelete = async () => {
        if (!form.id) return
        const updated = patients.filter((p) => p.id !== form.id)
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'patients',
                items: updated,
                auditEntry: {
                    hanhDong: 'DELETE_PATIENT',
                    doiTuong: `${form.maBN} - ${form.hoTen}`,
                    mucDich: 'Xóa hồ sơ bệnh nhân mẫu',
                },
            })
        )
        setForm(updated[0] || buildEmptyPatient())
        AppToast.info('Đã xóa hồ sơ bệnh nhân!')
    }

    const familyHouseholds = useMemo(() => [
        {
            id: 'HO-01',
            maHo: 'HGD-01089-01',
            chuHo: 'Nguyễn Văn An',
            maChuHo: 'BN0000142',
            soDienThoai: '0912 345 678',
            diaChi: 'Số 18 Duy Tân, Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
            soThanhVien: 3,
            tienSuGiaDinh: 'Tăng huyết áp di truyền, Viêm dạ dày HP (+)',
            thanhVien: [
                {
                    hoTen: 'Nguyễn Văn An',
                    quanHe: 'Chủ hộ',
                    tuoi: 45,
                    gioiTinh: 'Nam',
                    cccd: '001081002345',
                    bhyt: 'GD4010123456789',
                    tienSuRieng: 'Tăng huyết áp độ 1 (Amlodipin 5mg)',
                },
                {
                    hoTen: 'Trần Thị Mai',
                    quanHe: 'Vợ',
                    tuoi: 42,
                    gioiTinh: 'Nữ',
                    cccd: '001183004567',
                    bhyt: 'GD4010123456790',
                    tienSuRieng: 'Viêm loét dạ dày HP (+), dị ứng Aspirin',
                },
                {
                    hoTen: 'Nguyễn Văn Bình',
                    quanHe: 'Con trai',
                    tuoi: 14,
                    gioiTinh: 'Nam',
                    cccd: '001210007890',
                    bhyt: 'TE4010123456791',
                    tienSuRieng: 'Hen phế quản dị ứng thời tiết',
                },
            ],
        },
        {
            id: 'HO-02',
            maHo: 'HGD-01089-02',
            chuHo: 'Lê Thị Bích',
            maChuHo: 'BN0000145',
            soDienThoai: '0988 765 432',
            diaChi: '45 Trần Thái Tông, Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
            soThanhVien: 3,
            tienSuGiaDinh: 'Đái tháo đường Type 2, Thoái hóa khớp gối',
            thanhVien: [
                {
                    hoTen: 'Lê Thị Bích',
                    quanHe: 'Chủ hộ',
                    tuoi: 62,
                    gioiTinh: 'Nữ',
                    cccd: '001162001122',
                    bhyt: 'HT3010123456788',
                    tienSuRieng: 'Đái tháo đường Type 2 (HbA1c: 7.2%), Thoái hóa 2 khớp gối',
                },
                {
                    hoTen: 'Đặng Quốc Cường',
                    quanHe: 'Con trai',
                    tuoi: 35,
                    gioiTinh: 'Nam',
                    cccd: '001091003344',
                    bhyt: 'DN4010123456799',
                    tienSuRieng: 'Tăng axit uric máu không triệu chứng',
                },
                {
                    hoTen: 'Đỗ Hoàng Yến',
                    quanHe: 'Con dâu',
                    tuoi: 32,
                    gioiTinh: 'Nữ',
                    cccd: '001194005566',
                    bhyt: 'DN4010123456800',
                    tienSuRieng: 'Đang mang thai tuần thứ 24 (Theo dõi thai kỳ)',
                },
            ],
        },
    ], [])

    return (
        <div className="space-y-3">
            {/* Sub-tabs header: Hồ sơ cá nhân vs Hồ sơ gia đình */}
            <div className="flex border-b border-slate-200 gap-1 bg-white px-3 pt-2 rounded-t-xl">
                <button
                    type="button"
                    onClick={() => setActiveMainTab('HO_SO')}
                    className={`px-3.5 py-2 text-xs font-bold transition border-b-2 cursor-pointer ${
                        activeMainTab === 'HO_SO'
                            ? 'border-[#00B5F1] text-[#00B5F1]'
                            : 'border-transparent text-slate-500 hover:text-[#003553]'
                    }`}
                >
                    1. Hồ sơ bệnh nhân cá nhân ({patients.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveMainTab('GIA_DINH')}
                    className={`px-3.5 py-2 text-xs font-bold transition border-b-2 cursor-pointer ${
                        activeMainTab === 'GIA_DINH'
                            ? 'border-[#00B5F1] text-[#00B5F1]'
                            : 'border-transparent text-slate-500 hover:text-[#003553]'
                    }`}
                >
                    2. Hồ sơ sức khỏe hộ gia đình (/giadinh-benhnhan)
                </button>
            </div>

            {activeMainTab === 'HO_SO' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    {/* LEFT PANEL (4 cols): Danh sách bệnh nhân */}
                    <div className="lg:col-span-4 medpro-card p-3.5 flex flex-col h-[calc(100vh-130px)]">
                <div className="medpro-section-title">
                    <span className="inline-flex items-center gap-1.5">
                        <Users size={16} weight="duotone" className="text-[#00B5F1]" />
                        <span>DANH SÁCH BỆNH NHÂN ({filteredPatients.length})</span>
                    </span>
                    <button
                        type="button"
                        onClick={handleNew}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00B5F1] hover:underline cursor-pointer"
                    >
                        <UserPlus size={14} weight="bold" />
                        <span>Thêm mới</span>
                    </button>
                </div>

                <div className="mb-3 relative">
                    <MagnifyingGlass
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Tìm theo Mã BN, Họ tên, Số điện thoại..."
                        className="medpro-input !pl-8"
                    />
                </div>

                <div className="flex-1 overflow-y-auto border border-[#E5EEF5] rounded-xl">
                    <table className="medpro-table">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Mã BN</th>
                                <th>Họ tên</th>
                                <th>Ngày sinh</th>
                                <th>GT</th>
                                <th>Điện thoại</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPatients.map((p, idx) => (
                                <tr
                                    key={p.id}
                                    onClick={() => setForm({ ...p })}
                                    className={`cursor-pointer ${
                                        form.id === p.id ? '!bg-[#E8F4FD] font-semibold border-l-4 border-l-[#00B5F1]' : ''
                                    }`}
                                >
                                    <td className="tabular-nums text-center font-bold text-[#003553]">{idx + 1}</td>
                                    <td className="font-mono text-[11px] font-bold text-[#00B5F1]">{p.maBN}</td>
                                    <td className="font-semibold text-[#12263F]">{p.hoTen}</td>
                                    <td className="tabular-nums">{p.ngaySinh}</td>
                                    <td>{p.gioiTinh}</td>
                                    <td className="tabular-nums">{p.dienThoai}</td>
                                </tr>
                            ))}
                            {filteredPatients.length === 0 && (
                                <tr>
                                    <td colSpan={6}>
                                        <EmptyState
                                            icon="Users"
                                            title="Không tìm thấy hồ sơ bệnh nhân"
                                            description="Thử tìm kiếm với từ khóa khác hoặc nhấn Thêm mới."
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* RIGHT PANEL (8 cols): Thông tin chi tiết bệnh nhân & Tài khoản */}
            <div className="lg:col-span-8 medpro-card p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E8F4FD]">
                    <div>
                        <h2 className="font-display text-base font-extrabold text-[#003553] uppercase">
                            QUẢN LÝ HỒ SƠ BỆNH NHÂN (VIDEO 02)
                        </h2>
                        <p className="text-xs text-slate-500">
                            Cập nhật thông tin hành chính, ảnh đại diện, tài khoản đăng nhập Cổng bệnh nhân & lịch sử khám
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={handleNew} className="medpro-btn-outline text-xs">
                            <UserPlus size={15} weight="bold" className="text-[#00B5F1]" />
                            <span>Thêm mới</span>
                        </button>
                        <button type="button" onClick={handleSave} className="medpro-btn-primary text-xs">
                            <FloppyDisk size={15} weight="bold" />
                            <span>Lưu hồ sơ</span>
                        </button>
                        {form.id && (
                            <button type="button" onClick={handleDelete} className="medpro-btn-danger text-xs">
                                <Trash size={14} weight="bold" />
                                <span>Xóa</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => navigate('/admin/dang-ky-kham')}
                            className="medpro-btn-amber text-xs font-bold"
                        >
                            <ClipboardText size={15} weight="bold" />
                            <span>Đăng ký khám cho BN này</span>
                        </button>
                    </div>
                </div>

                {/* Form Layout matching Video 02 (Avatar Left + Fields Right) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Avatar Upload Column */}
                    <div className="md:col-span-3 flex flex-col items-center justify-start p-3 rounded-xl bg-[#F8FBFE] border border-[#E5EEF5]">
                        <div className="w-28 h-32 rounded-xl bg-[#E8F4FD] border-2 border-dashed border-[#00B5F1]/60 flex flex-col items-center justify-center text-[#003553] mb-2.5">
                            <Camera size={30} weight="duotone" className="text-[#00B5F1]" />
                            <span className="text-[11px] font-bold mt-1.5">{form.hoTen || 'Ảnh bệnh nhân'}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => AppToast.info('Đã mở trình chọn ảnh chân dung bệnh nhân!')}
                            className="medpro-btn-outline !py-1 !px-3 text-xs w-full"
                        >
                            <UploadSimple size={14} weight="bold" className="text-[#00B5F1]" />
                            <span>Chọn ảnh</span>
                        </button>
                        <div className="mt-3 w-full text-[11px] space-y-1 text-slate-600 border-t border-slate-200 pt-2">
                            <div>
                                Nhóm máu: <strong className="text-[#003553]">{form.nhomMau || 'O+'}</strong>
                            </div>
                            <div>
                                Dị ứng: <strong className="text-rose-600">{form.diUng || 'Không'}</strong>
                            </div>
                        </div>
                    </div>

                    {/* Administrative Fields Column */}
                    <div className="md:col-span-9 space-y-3">
                        <div className="medpro-section-title">
                            <span>1. THÔNG TIN CÁ NHÂN & ĐỊA CHỈ HÀNH CHÍNH</span>
                            <StatusBadge status={form.trangThai || 'Đang hoạt động'} compact />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="medpro-label">Mã bệnh nhân</label>
                                <input
                                    type="text"
                                    value={form.maBN || ''}
                                    onChange={(e) => setForm({ ...form, maBN: e.target.value })}
                                    className="medpro-input font-mono font-bold"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">
                                    Họ và tên bệnh nhân <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.hoTen || ''}
                                    onChange={(e) => setForm({ ...form, hoTen: e.target.value })}
                                    placeholder="Nguyễn Văn A..."
                                    className="medpro-input font-semibold"
                                />
                            </div>

                            <div>
                                <label className="medpro-label">Ngày sinh</label>
                                <input
                                    type="date"
                                    value={form.ngaySinh || ''}
                                    onChange={(e) => setForm({ ...form, ngaySinh: e.target.value })}
                                    className="medpro-input"
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
                                <label className="medpro-label">Tình trạng hôn nhân</label>
                                <select
                                    value={form.tinhTrangHonNhan || maritalStatuses[1]}
                                    onChange={(e) => setForm({ ...form, tinhTrangHonNhan: e.target.value })}
                                    className="medpro-input"
                                >
                                    {maritalStatuses.map((ms) => (
                                        <option key={ms} value={ms}>
                                            {ms}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="medpro-label">
                                    Số điện thoại <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.dienThoai || ''}
                                    onChange={(e) => setForm({ ...form, dienThoai: e.target.value, taiKhoan: e.target.value })}
                                    className="medpro-input tabular-nums"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Số CCCD / Định danh</label>
                                <input
                                    type="text"
                                    value={form.cccd || ''}
                                    onChange={(e) => setForm({ ...form, cccd: e.target.value })}
                                    className="medpro-input tabular-nums"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Email nhận kết quả</label>
                                <input
                                    type="email"
                                    value={form.email || ''}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>

                            <div>
                                <label className="medpro-label">Tỉnh / Thành phố (Từ Seed)</label>
                                <select
                                    value={form.tinhThanh || defaults.defaultProvince}
                                    onChange={(e) => {
                                        const nextProvince = e.target.value
                                        const nextDistricts = getDistrictsByProvince(clinicData, nextProvince)
                                        const nextWards = getWardsByDistrict(clinicData, nextDistricts[0])
                                        setForm({
                                            ...form,
                                            tinhThanh: nextProvince,
                                            quanHuyen: nextDistricts[0] || '',
                                            phuongXa: nextWards[0] || '',
                                        })
                                    }}
                                    className="medpro-input"
                                >
                                    {provinces.map((prov) => (
                                        <option key={prov} value={prov}>
                                            {prov}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="medpro-label">Quận / Huyện</label>
                                <select
                                    value={form.quanHuyen || ''}
                                    onChange={(e) => {
                                        const nextDist = e.target.value
                                        const nextWards = getWardsByDistrict(clinicData, nextDist)
                                        setForm({
                                            ...form,
                                            quanHuyen: nextDist,
                                            phuongXa: nextWards[0] || form.phuongXa,
                                        })
                                    }}
                                    className="medpro-input"
                                >
                                    {districts.map((d) => (
                                        <option key={d} value={d}>
                                            {d}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="medpro-label">Phường / Xã</label>
                                <select
                                    value={form.phuongXa || ''}
                                    onChange={(e) => setForm({ ...form, phuongXa: e.target.value })}
                                    className="medpro-input"
                                >
                                    {wards.map((w) => (
                                        <option key={w} value={w}>
                                            {w}
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
                                    className="medpro-input"
                                />
                            </div>
                        </div>

                        {/* Section 2: Thông tin tài khoản */}
                        <div className="pt-2">
                            <div className="medpro-section-title">
                                <span>2. THÔNG TIN TÀI KHOẢN TRA CỨU BỆNH ÁN & ĐẶT LỊCH</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="medpro-label">Tên tài khoản (Số ĐT)</label>
                                    <input
                                        type="text"
                                        value={form.taiKhoan || form.dienThoai || ''}
                                        onChange={(e) => setForm({ ...form, taiKhoan: e.target.value })}
                                        className="medpro-input font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Mật khẩu mặc định</label>
                                    <input
                                        type="password"
                                        value={form.matKhau || '123456'}
                                        onChange={(e) => setForm({ ...form, matKhau: e.target.value })}
                                        className="medpro-input"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Tiền sử dị ứng thuốc</label>
                                    <input
                                        type="text"
                                        value={form.diUng || ''}
                                        onChange={(e) => setForm({ ...form, diUng: e.target.value })}
                                        className="medpro-input"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 3: Lịch sử khám chữa bệnh của Bệnh nhân */}
                <div>
                    <div className="medpro-section-title">
                        <span>3. LỊCH SỬ KHÁM CHỮA BỆNH CỦA BỆNH NHÂN ({patientHistory.length} LƯỢT)</span>
                    </div>
                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table">
                            <thead>
                                <tr>
                                    <th>Mã KCB</th>
                                    <th>Ngày khám</th>
                                    <th>Phòng khám</th>
                                    <th>Bác sĩ khám</th>
                                    <th>Chẩn đoán xác định (ICD-10)</th>
                                    <th>Đơn thuốc QG</th>
                                    <th>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {patientHistory.map((h) => (
                                    <tr key={h.id}>
                                        <td className="font-mono font-bold text-[#00B5F1]">{h.maKCB}</td>
                                        <td className="tabular-nums">{h.ngayDangKy}</td>
                                        <td>{h.phongKham}</td>
                                        <td className="font-semibold">{h.bacSi}</td>
                                        <td>{h.clinicalNotes?.chanDoanXacDinh || h.trieuChung}</td>
                                        <td className="font-mono text-xs">{h.prescription?.maDon || 'Chưa kê'}</td>
                                        <td>
                                            <StatusBadge status={h.trangThai} compact />
                                        </td>
                                    </tr>
                                ))}
                                {patientHistory.length === 0 && (
                                    <tr>
                                        <td colSpan={7}>
                                            <EmptyState
                                                icon="Stethoscope"
                                                title="Bệnh nhân chưa có lịch sử lượt khám"
                                                description="Nhấn 'Đăng ký khám cho BN này' để khởi tạo lượt khám mới."
                                            />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        ) : (
                /* VIEW HỒ SƠ SỨC KHỎE HỘ GIA ĐÌNH (/giadinh-benhnhan) */
                <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-[#E5EEF5] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <span className="w-9 h-9 rounded-xl bg-sky-100 text-[#00B5F1] flex items-center justify-center font-bold">
                                <IdentificationCard size={20} weight="fill" />
                            </span>
                            <div>
                                <h3 className="text-sm font-black text-[#003553]">
                                    QUẢN LÝ HỒ SƠ SỨC KHỎE HỘ GIA ĐÌNH ({familyHouseholds.length} HỘ)
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Theo dõi tiền sử bệnh lý gia đình di truyền, liên kết thẻ BHYT hộ gia đình và chăm sóc sức khỏe liên thế hệ
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => AppToast.info('Mở biểu mẫu thêm mới hộ gia đình!')}
                                className="medpro-btn-primary !py-1.5 !px-3.5 text-xs flex items-center gap-1 cursor-pointer"
                            >
                                <PlusCircle size={15} weight="bold" />
                                <span>Thêm hộ gia đình</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {familyHouseholds.map((ho) => (
                            <div
                                key={ho.id}
                                className="bg-white rounded-xl border border-[#E5EEF5] p-4 shadow-2xs space-y-3"
                            >
                                <div className="flex items-start justify-between pb-2 border-b border-slate-100">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-sky-100 text-[#00B5F1] font-mono font-bold text-xs">
                                                {ho.maHo}
                                            </span>
                                            <span className="font-black text-sm text-[#003553]">
                                                Hộ: {ho.chuHo}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5 font-mono">
                                            ĐT: {ho.soDienThoai} &bull; {ho.diaChi}
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                                        {ho.soThanhVien} thành viên
                                    </span>
                                </div>

                                <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
                                    <Heartbeat size={16} weight="fill" className="text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-bold">Tiền sử bệnh lý gia đình:</span> {ho.tienSuGiaDinh}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        DANH SÁCH THÀNH VIÊN TRONG HỘ:
                                    </div>
                                    <div className="space-y-1.5">
                                        {ho.thanhVien.map((tv, idx) => (
                                            <div
                                                key={idx}
                                                className="p-2.5 rounded-lg border border-slate-100 bg-[#F9FBFC] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-[#003553]">{tv.hoTen}</span>
                                                        <span className="px-1.5 py-0.2 rounded bg-sky-100 text-[#00B5F1] font-semibold text-[10px]">
                                                            {tv.quanHe}
                                                        </span>
                                                        <span className="text-slate-400 text-[11px]">
                                                            {tv.tuoi} tuổi ({tv.gioiTinh})
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                                        BHYT: <span className="font-mono font-bold text-slate-700">{tv.bhyt}</span> &bull; CCCD:{' '}
                                                        <span className="font-mono">{tv.cccd}</span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-600 italic">
                                                        Ghi chú: {tv.tienSuRieng}
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveMainTab('HO_SO')
                                                        setSearch(tv.hoTen)
                                                        AppToast.info(`Mở hồ sơ cá nhân của ${tv.hoTen}`)
                                                    }}
                                                    className="medpro-btn-outline !py-1 !px-2.5 text-[11px] shrink-0 self-start sm:self-center"
                                                >
                                                    Xem bệnh án
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
