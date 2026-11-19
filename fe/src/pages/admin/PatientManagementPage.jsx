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
    Heartbeat,
} from '../../components/common/ClinicIcon'

const getNextPatientCode = (list) => {
    let max = 0
    ;(list || []).forEach((p) => {
        const m = String(p.maBN || p.id || '').match(/(\d+)/)
        if (m) {
            const num = parseInt(m[1], 10)
            if (num > max) max = num
        }
    })
    return 'BN' + String(max + 1).padStart(7, '0')
}

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
        maBN: getNextPatientCode(patients),
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
        const nextMaBN = exists ? form.maBN : (form.maBN || getNextPatientCode(patients))
        const formWithCode = { ...form, maBN: nextMaBN }
        let updated
        if (exists) {
            updated = patients.map((p) => (p.id === form.id ? { ...p, ...formWithCode } : p))
        } else {
            const newPatient = {
                ...formWithCode,
                id: nextMaBN,
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
        <div className="space-y-3.5">
            <div className="medpro-card p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex flex-wrap items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border">
                    <button
                        type="button"
                        onClick={() => setActiveMainTab('HO_SO')}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors duration-75 cursor-pointer ${
                            activeMainTab === 'HO_SO'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        1. Hồ sơ bệnh nhân cá nhân ({patients.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveMainTab('GIA_DINH')}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors duration-75 cursor-pointer ${
                            activeMainTab === 'GIA_DINH'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        2. Hồ sơ sức khỏe hộ gia đình
                    </button>
                </div>
                <span className="text-xs text-clinic-text-secondary">
                    Quản trị thông tin hành chính, lịch sử khám chữa bệnh và hồ sơ hộ gia đình
                </span>
            </div>

            {activeMainTab === 'HO_SO' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    <div className="lg:col-span-4 medpro-card p-3.5 flex flex-col h-[calc(100vh-145px)]">
                        <div className="medpro-section-title">
                            <span className="inline-flex items-center gap-1.5">
                                <Users size={15} weight="duotone" className="text-clinic-cta" />
                                <span>DANH SÁCH BỆNH NHÂN ({filteredPatients.length})</span>
                            </span>
                            <button
                                type="button"
                                onClick={handleNew}
                                className="inline-flex items-center gap-1 text-xs font-bold text-clinic-cta hover:underline cursor-pointer shrink-0 whitespace-nowrap"
                            >
                                <UserPlus size={14} weight="bold" />
                                <span>Thêm mới</span>
                            </button>
                        </div>

                        <div className="mb-3 relative">
                            <MagnifyingGlass
                                size={14}
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none"
                            />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Tìm theo Mã BN, Họ tên, Số điện thoại..."
                                className="medpro-input !py-1.5 h-9 !pl-8 text-xs"
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto border border-clinic-border rounded-[6px]">
                            <table className="medpro-table w-full [&_th]:!px-1.5 [&_td]:!px-1.5 text-xs">
                                <thead>
                                    <tr>
                                        <th className="w-7 text-center">STT</th>
                                        <th className="whitespace-nowrap">Mã BN</th>
                                        <th>Họ tên</th>
                                        <th className="whitespace-nowrap">Ngày sinh</th>
                                        <th className="w-8 text-center">GT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPatients.map((p, idx) => (
                                        <tr
                                            key={p.id || idx}
                                            onClick={() => setForm({ ...p })}
                                            className={`cursor-pointer transition-colors ${
                                                form.id === p.id ? '!bg-clinic-surface-alt font-semibold' : ''
                                            }`}
                                        >
                                            <td className="tabular-nums text-center font-bold text-clinic-navy">{idx + 1}</td>
                                            <td className="font-mono text-[11px] font-bold text-clinic-cta whitespace-nowrap">{p.maBN}</td>
                                            <td className="font-semibold text-clinic-navy">{p.hoTen}</td>
                                            <td className="tabular-nums text-[11px] whitespace-nowrap">{p.ngaySinh}</td>
                                            <td className="text-center whitespace-nowrap">{p.gioiTinh}</td>
                                        </tr>
                                    ))}
                                    {filteredPatients.length === 0 && (
                                        <tr>
                                            <td colSpan={5}>
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

                    <div className="lg:col-span-8 medpro-card p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-clinic-border">
                            <div>
                                <h2 className="font-display text-sm font-extrabold text-clinic-navy uppercase">
                                    Quản lý hồ sơ bệnh nhân
                                </h2>
                                <p className="text-xs text-clinic-text-secondary">
                                    Cập nhật thông tin hành chính, tài khoản cổng bệnh nhân &amp; lịch sử khám
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={handleNew} className="medpro-btn-outline !py-1.5 !px-3 text-xs">
                                    <UserPlus size={14} weight="bold" className="text-clinic-cta" />
                                    <span>Thêm mới</span>
                                </button>
                                <button type="button" onClick={handleSave} className="medpro-btn-primary !py-1.5 !px-3 text-xs">
                                    <FloppyDisk size={14} weight="bold" />
                                    <span>Lưu hồ sơ</span>
                                </button>
                                {form.id && (
                                    <button type="button" onClick={handleDelete} className="medpro-btn-danger !py-1.5 !px-3 text-xs">
                                        <Trash size={14} weight="bold" />
                                        <span>Xóa</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => navigate('/admin/dang-ky-kham')}
                                    className="medpro-btn-amber !py-1.5 !px-3 text-xs font-bold"
                                >
                                    <ClipboardText size={14} weight="bold" />
                                    <span>Đăng ký khám</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-3 flex flex-col items-center justify-start p-3 rounded-[6px] bg-clinic-bg border border-clinic-border">
                                <div className="w-28 h-32 rounded-[6px] bg-clinic-surface-alt border border-dashed border-clinic-cta flex flex-col items-center justify-center text-clinic-navy mb-2.5 p-2 text-center">
                                    <Camera size={28} weight="duotone" className="text-clinic-cta" />
                                    <span className="text-[11px] font-bold mt-1.5 line-clamp-2">{form.hoTen || 'Ảnh bệnh nhân'}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => AppToast.info('Đã mở trình chọn ảnh chân dung bệnh nhân!')}
                                    className="medpro-btn-outline !py-1.5 !px-3 text-xs w-full"
                                >
                                    <UploadSimple size={14} weight="bold" className="text-clinic-cta" />
                                    <span>Chọn ảnh</span>
                                </button>
                                <div className="mt-3 w-full text-[11px] space-y-1 text-clinic-text-secondary border-t border-clinic-border pt-2">
                                    <div>
                                        Nhóm máu: <strong className="text-clinic-navy">{form.nhomMau || 'O+'}</strong>
                                    </div>
                                    <div>
                                        Dị ứng: <strong className="text-clinic-danger">{form.diUng || 'Không'}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-9 space-y-3">
                                <div className="medpro-section-title">
                                    <span>1. THÔNG TIN CÁ NHÂN &amp; ĐỊA CHỈ HÀNH CHÍNH</span>
                                    <StatusBadge status={form.trangThai || 'Đang hoạt động'} compact />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="medpro-label !mb-0">Mã bệnh nhân</label>
                                            <span className="text-[10px] font-bold text-clinic-cta">
                                                Tự sinh
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            value={form.maBN || ''}
                                            readOnly
                                            disabled
                                            className="medpro-input !py-1.5 h-9 text-xs font-mono font-bold bg-clinic-bg text-clinic-text-secondary cursor-not-allowed select-none tabular-nums"
                                            title="Mã bệnh nhân do hệ thống tự sinh"
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
                                            placeholder="Nguyễn Văn A..."
                                            className="medpro-input !py-1.5 h-9 text-xs font-semibold"
                                        />
                                    </div>

                                    <div>
                                        <label className="medpro-label">Ngày sinh</label>
                                        <input
                                            type="date"
                                            value={form.ngaySinh || ''}
                                            onChange={(e) => setForm({ ...form, ngaySinh: e.target.value })}
                                            className="medpro-input !py-1.5 h-9 text-xs"
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
                                        <label className="medpro-label">Tình trạng hôn nhân</label>
                                        <select
                                            value={form.tinhTrangHonNhan || maritalStatuses[1]}
                                            onChange={(e) => setForm({ ...form, tinhTrangHonNhan: e.target.value })}
                                            className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
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
                                            Số điện thoại <span className="text-clinic-danger">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={form.dienThoai || ''}
                                            onChange={(e) => setForm({ ...form, dienThoai: e.target.value, taiKhoan: e.target.value })}
                                            className="medpro-input !py-1.5 h-9 text-xs tabular-nums"
                                        />
                                    </div>
                                    <div>
                                        <label className="medpro-label">Số CCCD / Định danh</label>
                                        <input
                                            type="text"
                                            value={form.cccd || ''}
                                            onChange={(e) => setForm({ ...form, cccd: e.target.value })}
                                            className="medpro-input !py-1.5 h-9 text-xs tabular-nums"
                                        />
                                    </div>
                                    <div>
                                        <label className="medpro-label">Email nhận kết quả</label>
                                        <input
                                            type="email"
                                            value={form.email || ''}
                                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                                            className="medpro-input !py-1.5 h-9 text-xs"
                                        />
                                    </div>

                                    <div>
                                        <label className="medpro-label">Tỉnh / Thành phố</label>
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
                                            className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
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
                                            className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
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
                                            className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
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
                                            className="medpro-input !py-1.5 h-9 text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <div className="medpro-section-title">
                                        <span>2. TÀI KHOẢN CỔNG BỆNH NHÂN &amp; TIỀN SỬ DỊ ỨNG</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="medpro-label">Tên tài khoản (Số ĐT)</label>
                                            <input
                                                type="text"
                                                value={form.taiKhoan || form.dienThoai || ''}
                                                onChange={(e) => setForm({ ...form, taiKhoan: e.target.value })}
                                                className="medpro-input !py-1.5 h-9 text-xs font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="medpro-label">Mật khẩu mặc định</label>
                                            <input
                                                type="password"
                                                value={form.matKhau || '123456'}
                                                onChange={(e) => setForm({ ...form, matKhau: e.target.value })}
                                                className="medpro-input !py-1.5 h-9 text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="medpro-label">Tiền sử dị ứng thuốc</label>
                                            <input
                                                type="text"
                                                value={form.diUng || ''}
                                                onChange={(e) => setForm({ ...form, diUng: e.target.value })}
                                                className="medpro-input !py-1.5 h-9 text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="medpro-section-title">
                                <span>3. LỊCH SỬ KHÁM CHỮA BỆNH CỦA BỆNH NHÂN ({patientHistory.length} LƯỢT)</span>
                            </div>
                            <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                                <table className="medpro-table tabular-nums">
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
                                                <td className="font-mono font-bold text-clinic-cta">{h.maKCB}</td>
                                                <td className="tabular-nums">{h.ngayDangKy}</td>
                                                <td>{h.phongKham}</td>
                                                <td className="font-semibold text-clinic-navy">{h.bacSi}</td>
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
                                                        description="Nhấn Đăng ký khám để khởi tạo lượt khám mới."
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
                <div className="space-y-4">
                    <div className="medpro-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="font-display text-sm font-extrabold text-clinic-navy uppercase">
                                Quản lý hồ sơ sức khỏe hộ gia đình ({familyHouseholds.length} hộ)
                            </h2>
                            <p className="text-xs text-clinic-text-secondary mt-0.5">
                                Theo dõi tiền sử bệnh lý gia đình di truyền và chăm sóc sức khỏe định kỳ theo hộ
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => AppToast.info('Mở biểu mẫu thêm mới hộ gia đình!')}
                            className="medpro-btn-primary !py-1.5 !px-3.5 text-xs shrink-0"
                        >
                            <PlusCircle size={15} weight="bold" />
                            <span>Thêm hộ gia đình</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {familyHouseholds.map((ho) => (
                            <section
                                key={ho.id}
                                className="medpro-card p-4 space-y-3"
                            >
                                <div className="flex items-start justify-between pb-2.5 border-b border-clinic-border">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="medpro-badge-info font-mono">
                                                {ho.maHo}
                                            </span>
                                            <span className="font-bold text-sm text-clinic-navy">
                                                Hộ: {ho.chuHo}
                                            </span>
                                        </div>
                                        <div className="text-xs text-clinic-text-secondary mt-1 font-mono tabular-nums">
                                            ĐT: {ho.soDienThoai} &bull; {ho.diaChi}
                                        </div>
                                    </div>
                                    <span className="medpro-badge-success shrink-0">
                                        {ho.soThanhVien} thành viên
                                    </span>
                                </div>

                                <p role="note" className="p-2.5 rounded-[6px] bg-clinic-warning-bg border border-clinic-warning-border text-xs text-clinic-navy flex items-start gap-2">
                                    <Heartbeat size={15} weight="fill" className="text-clinic-warning shrink-0 mt-0.5" />
                                    <span>
                                        <strong>Tiền sử gia đình:</strong> {ho.tienSuGiaDinh}
                                    </span>
                                </p>

                                <div className="space-y-1.5">
                                    <div className="text-[11px] font-bold text-clinic-text-secondary uppercase tracking-wider">
                                        Thành viên trong hộ
                                    </div>
                                    <ul className="divide-y divide-clinic-border border border-clinic-border rounded-[6px] bg-clinic-bg">
                                        {ho.thanhVien.map((tv, idx) => (
                                            <li
                                                key={tv.cccd || idx}
                                                className="p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                            >
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-bold text-clinic-navy">{tv.hoTen}</span>
                                                        <span className="medpro-badge-info">
                                                            {tv.quanHe}
                                                        </span>
                                                        <span className="text-clinic-text-muted text-[11px] tabular-nums">
                                                            {tv.tuoi} tuổi ({tv.gioiTinh})
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-clinic-text-secondary mt-0.5">
                                                        CCCD: <span className="font-mono tabular-nums">{tv.cccd}</span>
                                                    </div>
                                                    <div className="text-[11px] text-clinic-text-secondary">
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
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
