import { printDocument, exportToExcel, exportToCsv } from '../../utils/helpers/exportUtils'
import { useState, useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { AppToast } from '../../components/common/AppNotification'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import {
    StatusBadge,
    UsersThree,
    PlusCircle,
    DownloadSimple,
    UploadSimple,
    MagnifyingGlass,
    Receipt,
    Buildings,
    CheckCircle,
    Clock,
    X,
    Printer,
    FileText,
    Scales,
    Package,
} from '../../components/common/ClinicIcon'

export default function CorporateHealthPage() {
    const dispatch = useDispatch()
    const location = useLocation()
    const { clinicData } = useSelector((state) => state.app.admin)
    const settings = clinicData?.clinicSettings || {}
    const configuredClinicName = (settings.tenPhongKham || settings.tenCoSo || 'Phòng Khám Đa Khoa Quốc Tế Clinic-AI').toUpperCase()
    const configuredClinicAddress = [
        settings.diaChi || 'Số 18 Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội',
        settings.dienThoai ? `Hotline: ${settings.dienThoai}` : 'Hotline: 1900 2115',
        settings.giayPhepHoatDong ? `GPHĐ: ${settings.giayPhepHoatDong}` : 'GPHĐ: Số 1428/HNO-GPHĐ',
    ].filter(Boolean).join(' | ')
    const corporateCheckups = clinicData?.corporateCheckups || []

    const defaultPackages = useMemo(() => [
        {
            id: 'GK-01',
            maGoi: 'GK-TT32-01',
            tenGoi: 'Gói khám tiêu chuẩn Thông tư 32/2023/TT-BYT',
            donGia: 1200000,
            tieuChuan: 'Thông tư 32/2023/TT-BYT',
            doiTuong: 'Cán bộ nhân viên văn phòng, người lao động định kỳ',
            danhMucTram: [
                'Khám thể lực: chiều cao, cân nặng, chỉ số BMI, huyết áp, mạch',
                'Khám lâm sàng toàn diện: Nội tổng quát, Ngoại, Da liễu, Mắt, Tai Mũi Họng, Răng Hàm Mặt',
                'Khám chuyên khoa Phụ sản & tầm soát tế bào cổ tử cung (lao động nữ)',
                'Xét nghiệm: Huyết học tổng phân tích 18 thông số, Đường huyết đói Glucose',
                'Xét nghiệm: Tổng phân tích nước tiểu 10 thông số tự động',
                'Chẩn đoán hình ảnh: Chụp X-quang tim phổi thẳng kỹ thuật số'
            ]
        },
        {
            id: 'GK-02',
            maGoi: 'GK-NC-02',
            tenGoi: 'Gói khám tổng quát nâng cao & tầm soát chuyển hóa',
            donGia: 2500000,
            tieuChuan: 'Bộ Y tế & Tiêu chuẩn Quốc tế JCI',
            doiTuong: 'Chuyên viên, quản lý cấp trung, nhân sự trên 35 tuổi',
            danhMucTram: [
                'Toàn bộ danh mục gói tiêu chuẩn Thông tư 32',
                'Siêu âm ổ bụng tổng quát màu Doppler (Gan, Mật, Tụy, Lách, Thận)',
                'Đo điện tim đồ 12 chuyển đạo ECG nghỉ',
                'Sinh hóa chức năng gan: AST (GOT), ALT (GPT), GGT',
                'Sinh hóa chức năng thận: Ure, Creatinine máu, Acid Uric',
                'Bộ mỡ máu: Cholesterol toàn phần, Triglyceride, HDL-C, LDL-C'
            ]
        },
        {
            id: 'GK-03',
            maGoi: 'GK-NN-03',
            tenGoi: 'Gói tầm soát bệnh nghề nghiệp & môi trường độc hại',
            donGia: 1800000,
            tieuChuan: 'Thông tư 28/2016/TT-BYT',
            doiTuong: 'Công nhân nhà máy, kỹ sư công trường, tiếp xúc hóa chất hoặc tiếng ồn',
            danhMucTram: [
                'Toàn bộ danh mục gói tiêu chuẩn Thông tư 32',
                'Đo chức năng thông khí phổi Spirometry (tầm soát sớm hen nghề nghiệp, COPD)',
                'Đo thính lực dải âm tần tự động trong buồng cách âm tiêu chuẩn',
                'Xét nghiệm định lượng chì máu hoặc kim loại nặng nghề nghiệp',
                'Chụp X-quang phổi chuẩn ILO phát hiện xơ hóa hoặc bụi phổi'
            ]
        },
        {
            id: 'GK-04',
            maGoi: 'GK-VIP-04',
            tenGoi: 'Gói khám sức khỏe VIP - Ban Giám đốc & Lãnh đạo',
            donGia: 4800000,
            tieuChuan: 'Tiêu chuẩn Cao cấp VIP Quốc tế',
            doiTuong: 'Hội đồng quản trị, Ban Tổng Giám đốc, Quản lý cấp cao',
            danhMucTram: [
                'Toàn bộ danh mục gói nâng cao chuyên sâu',
                'Siêu âm tim màu Doppler & Siêu âm Doppler màu tuyến giáp',
                'Chụp cắt lớp vi tính CT lồng ngực liều thấp tầm soát u sớm',
                'Bộ dấu ấn sinh học ung thư: CEA (tiêu hóa), AFP (gan), PSA (nam giới) / CA125 (nữ)',
                'Nội soi Tai Mũi Họng dải tần hẹp NBI tầm soát ung thư biểu mô',
                'Tư vấn kết quả và phác đồ theo dõi sức khỏe 1-1 cùng Bác sĩ Chuyên khoa II'
            ]
        }
    ], [])

    const corporatePackages = clinicData?.corporatePackages || defaultPackages

    const queryTab = new URLSearchParams(location.search).get('tab')
    const [activeTab, setActiveTab] = useState(
        queryTab && ['DANG_KY_DOAN', 'THANH_TOAN', 'HOA_DON', 'DANH_MUC', 'GOI_KHAM'].includes(queryTab)
            ? queryTab
            : 'DANG_KY_DOAN'
    )

    useEffect(() => {
        if (queryTab && ['DANG_KY_DOAN', 'THANH_TOAN', 'HOA_DON', 'DANH_MUC', 'GOI_KHAM'].includes(queryTab)) {
            setActiveTab(queryTab)
        }
    }, [queryTab])

    const [searchText, setSearchText] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [selectedCorp, setSelectedCorp] = useState(corporateCheckups[0] || null)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const [isPackageModalOpen, setIsPackageModalOpen] = useState(false)

    const [newCorpForm, setNewCorpForm] = useState({
        tenDoan: '',
        maSoThue: '',
        diaChi: '',
        nguoiLienHe: '',
        dienThoai: '',
        dotKham: 'Khám sức khỏe định kỳ Quý IV - 2026',
        soLuongNhanVien: 50,
        goiKham: 'Gói khám tiêu chuẩn Thông tư 32/2023/TT-BYT',
        donGiaNguoi: 1200000,
        chietKhau: 10,
    })

    const [newPackageForm, setNewPackageForm] = useState({
        maGoi: '',
        tenGoi: '',
        donGia: 1500000,
        tieuChuan: 'Thông tư 32/2023/TT-BYT',
        doiTuong: 'Cán bộ nhân viên doanh nghiệp',
        danhMucTramText: '',
    })

    const employeesList = useMemo(() => {
        return selectedCorp?.employees || []
    }, [selectedCorp])

    const [importFileName, setImportFileName] = useState('')
    const [importedEmployees, setImportedEmployees] = useState([])

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setImportFileName(file.name)
        const reader = new FileReader()
        reader.onload = (evt) => {
            try {
                const text = evt.target?.result
                if (typeof text !== 'string') return
                if (file.name.endsWith('.json')) {
                    const parsed = JSON.parse(text)
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setImportedEmployees(parsed)
                        AppToast.success(`Đã nhận diện ${parsed.length} nhân viên từ tệp JSON!`)
                        return
                    }
                }
                const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
                if (lines.length <= 1) {
                    AppToast.error('Tệp không chứa dữ liệu hoặc thiếu dòng tiêu đề!')
                    return
                }
                const rows = lines.slice(1)
                const parsed = rows.map((line, idx) => {
                    const parts = line.split(',').map((p) => p.trim())
                    return {
                        id: `NV${Date.now().toString().slice(-4)}${idx + 1}`,
                        maNV: parts[0] || `NV-${idx + 1}`,
                        hoTen: parts[1] || `Nhân viên ${idx + 1}`,
                        gioiTinh: parts[2] || 'Nam',
                        namSinh: Number(parts[3]) || 1990,
                        chucVu: parts[4] || 'Nhân viên',
                        theLuc: parts[5] || 'Đạt',
                        lamSang: parts[6] || 'Đạt',
                        xetNghiem: parts[7] || 'Đạt',
                        xQuang: parts[8] || 'Đạt',
                        phanLoai: parts[9] || 'Loại I (Tốt)',
                        ketLuan: parts[10] || 'Đủ sức khỏe làm việc',
                    }
                })
                setImportedEmployees(parsed)
                AppToast.success(`Đã nhận diện ${parsed.length} nhân viên từ tệp CSV!`)
            } catch {
                AppToast.error('Không thể đọc tệp danh sách nhân viên. Vui lòng kiểm tra định dạng!')
            }
        }
        reader.readAsText(file)
    }

    const handleConfirmImport = () => {
        if (!selectedCorp) {
            AppToast.error('Vui lòng chọn hợp đồng khám đoàn!')
            return
        }
        if (!importedEmployees || importedEmployees.length === 0) {
            AppToast.error('Vui lòng chọn tệp danh sách nhân viên (.csv hoặc .json) để nạp!')
            return
        }
        const currentList = selectedCorp.employees || []
        const updatedEmployees = [...currentList, ...importedEmployees]
        const updatedCorp = {
            ...selectedCorp,
            employees: updatedEmployees,
            soLuongNhanVien: Math.max(selectedCorp.soLuongNhanVien || 0, updatedEmployees.length),
        }
        const updatedCorps = corporateCheckups.map((c) => (c.id === selectedCorp.id ? updatedCorp : c))
        dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'corporateCheckups',
                items: updatedCorps,
                auditEntry: {
                    hanhDong: 'IMPORT_CORPORATE_EMPLOYEES',
                    doiTuong: `${selectedCorp.soHopDong} - ${selectedCorp.tenDoan}`,
                    mucDich: `Nạp danh sách ${importedEmployees.length} nhân viên vào hợp đồng đoàn`,
                },
            })
        )
        setSelectedCorp(updatedCorp)
        setIsImportModalOpen(false)
        const count = importedEmployees.length
        setImportedEmployees([])
        setImportFileName('')
        AppToast.success(`Đã nạp thành công ${count} nhân viên vào đoàn ${selectedCorp.tenDoan}!`)
    }

    const handleDownloadTemplate = (e) => {
        e.preventDefault()
        const headers = ['Mã NV', 'Họ và tên', 'Giới tính', 'Năm sinh', 'Chức vụ', 'Thể lực', 'Lâm sàng', 'Xét nghiệm', 'X-Quang', 'Phân loại', 'Kết luận']
        const rows = [
            ['TL-101', 'Nguyễn Văn Thành', 'Nam', 1991, 'Kỹ sư phần mềm', 'Đạt', 'Đạt', 'Đạt', 'Đạt (Tim phổi bt)', 'Loại I (Tốt)', 'Đủ sức khỏe làm việc'],
            ['TL-102', 'Trần Thị Mai Phương', 'Nữ', 1995, 'Chuyên viên Nhân sự', 'Đạt', 'Đạt', 'Đạt', 'Đạt', 'Loại I (Tốt)', 'Đủ sức khỏe làm việc'],
            ['TL-103', 'Lê Hoàng Nam', 'Nam', 1988, 'Trưởng phòng Kỹ thuật', 'Đạt', 'Đạt (Tăng HA nhẹ)', 'Đạt', 'Đạt', 'Loại II (Khá)', 'Đủ sức khỏe làm việc'],
        ]
        exportToExcel({
            filename: 'mau_danh_sach_nhan_vien_tt32.xlsx',
            sheetName: 'DanhSachNhanVien',
            title: 'DANH SÁCH NHÂN VIÊN KHÁM SỨC KHỎE (MẪU THÔNG TƯ 32/2023/TT-BYT)',
            clinicName: configuredClinicName,
            clinicAddress: configuredClinicAddress,
            headers,
            rows,
            signOff: true,
        })
        AppToast.success('Đã xuất file Excel mẫu chuẩn TT 32 thành công!')
    }

    const handleRequestPayment = (corp) => {
        const updatedCorps = corporateCheckups.map((c) => {
            if (c.id === corp.id) {
                return {
                    ...c,
                    trangThaiThanhToan: 'Đã gửi đề nghị thanh toán',
                    ngayDeNghiThanhToan: new Date().toISOString().slice(0, 10),
                }
            }
            return c
        })
        dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'corporateCheckups',
                items: updatedCorps,
                auditEntry: {
                    hanhDong: 'REQUEST_CORPORATE_PAYMENT',
                    doiTuong: `${corp.soHopDong} - ${corp.tenDoan}`,
                    mucDich: `Gửi đề nghị thanh toán và tạo phiếu thu B2B cho ${corp.tenDoan}`,
                },
            })
        )
        AppToast.success(`Đã cập nhật phiếu thu và gửi đề nghị thanh toán tới ${corp.tenDoan}!`)
    }

    const filteredCheckups = useMemo(() => {
        return corporateCheckups.filter((corp) => {
            const matchSearch =
                !searchText ||
                corp.tenDoan?.toLowerCase().includes(searchText.toLowerCase()) ||
                corp.maDoan?.toLowerCase().includes(searchText.toLowerCase()) ||
                corp.maSoThue?.includes(searchText)
            const matchStatus = statusFilter === 'ALL' || corp.trangThai === statusFilter
            return matchSearch && matchStatus
        })
    }, [corporateCheckups, searchText, statusFilter])

    const stats = useMemo(() => {
        const totalCorps = corporateCheckups.length
        const totalEmployees = corporateCheckups.reduce((acc, c) => acc + (Number(c.soLuongNhanVien) || 0), 0)
        const totalCompleted = corporateCheckups.reduce((acc, c) => acc + (Number(c.daKham) || 0), 0)
        const totalRevenue = corporateCheckups.reduce((acc, c) => acc + (Number(c.tongTien) || 0), 0)
        const totalPackages = corporatePackages.length
        return { totalCorps, totalEmployees, totalCompleted, totalRevenue, totalPackages }
    }, [corporateCheckups, corporatePackages])

    const handleCreateContract = () => {
        if (!newCorpForm.tenDoan.trim()) {
            AppToast.error('Vui lòng nhập tên công ty / doanh nghiệp!')
            return
        }
        const tongGia = (newCorpForm.soLuongNhanVien * newCorpForm.donGiaNguoi * (100 - newCorpForm.chietKhau)) / 100
        const newCorp = {
            id: `DOAN-${Date.now().toString().slice(-4)}`,
            maDoan: `000000${corporateCheckups.length + 25}`,
            tenDoan: newCorpForm.tenDoan,
            diaChi: newCorpForm.diaChi || 'Hà Nội',
            dotKham: newCorpForm.dotKham,
            nguoiLienHe: newCorpForm.nguoiLienHe || 'Bộ phận HCNS',
            dienThoai: newCorpForm.dienThoai || '0904000111',
            soHopDong: `HĐ-KĐ-2026/0${corporateCheckups.length + 1}`,
            maSoThue: newCorpForm.maSoThue || '0109988776',
            soLuongNhanVien: Number(newCorpForm.soLuongNhanVien),
            daKham: 0,
            tongTien: tongGia,
            tamUng: tongGia * 0.3,
            chietKhau: Number(newCorpForm.chietKhau),
            goiKham: newCorpForm.goiKham,
            donGiaNguoi: Number(newCorpForm.donGiaNguoi),
            trangThai: 'Đang thực hiện',
        }

        const updated = [newCorp, ...corporateCheckups]
        dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'corporateCheckups',
                items: updated,
                auditEntry: {
                    hanhDong: 'CREATE_CORPORATE_CONTRACT',
                    doiTuong: `${newCorp.soHopDong} - ${newCorp.tenDoan}`,
                    mucDich: `Tạo hợp đồng khám đoàn (${newCorp.soLuongNhanVien} NV - ${newCorp.goiKham})`,
                },
            })
        )
        setSelectedCorp(newCorp)
        setIsAddModalOpen(false)
        AppToast.success(`Tạo hợp đồng khám đoàn ${newCorp.tenDoan} thành công!`)
    }

    const handleCreatePackage = () => {
        if (!newPackageForm.tenGoi.trim()) {
            AppToast.error('Vui lòng nhập tên gói khám!')
            return
        }
        const rawLines = newPackageForm.danhMucTramText
            ? newPackageForm.danhMucTramText.split('\n').map((s) => s.trim()).filter(Boolean)
            : []
        const newPkg = {
            id: `GK-${Date.now().toString().slice(-4)}`,
            maGoi: newPackageForm.maGoi || `GK-CS-${Date.now().toString().slice(-4)}`,
            tenGoi: newPackageForm.tenGoi,
            donGia: Number(newPackageForm.donGia) || 1500000,
            tieuChuan: newPackageForm.tieuChuan || 'Thông tư 32/2023/TT-BYT',
            doiTuong: newPackageForm.doiTuong || 'Cán bộ nhân viên doanh nghiệp',
            danhMucTram: rawLines.length > 0 ? rawLines : [
                'Khám thể lực và lâm sàng tổng quát',
                'Xét nghiệm công thức máu & đường huyết',
                'Tổng phân tích nước tiểu 10 thông số',
                'Chụp X-quang tim phổi kỹ thuật số'
            ],
        }
        const updated = [newPkg, ...corporatePackages]
        dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'corporatePackages',
                items: updated,
                auditEntry: {
                    hanhDong: 'CREATE_CORPORATE_PACKAGE',
                    doiTuong: `${newPkg.maGoi} - ${newPkg.tenGoi}`,
                    mucDich: `Tạo gói khám sức khỏe đoàn (${newPkg.donGia.toLocaleString('vi-VN')} đ/người)`,
                },
            })
        )
        setIsPackageModalOpen(false)
        AppToast.success(`Tạo gói khám ${newPkg.tenGoi} thành công!`)
    }

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-xs border border-[#E5EEF5] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#00B5F1] to-[#0088BA] text-white flex items-center justify-center shadow-md">
                        <UsersThree size={24} weight="fill" />
                    </span>
                    <div>
                        <h1 className="text-lg font-black text-[#003553] tracking-wide flex items-center gap-2">
                            KHÁM SỨC KHỎE ĐOÀN DOANH NGHIỆP B2B
                            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-[#00B5F1] text-[11px] font-bold">
                                Thông tư 32/2023/TT-BYT
                            </span>
                        </h1>
                        <p className="text-xs text-slate-500">
                            Quản lý hợp đồng khám đoàn, cấu hình gói khám, import danh sách nhân sự & tiến độ trạm khám
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsPackageModalOpen(true)}
                        className="medpro-btn-outline !py-2 !px-3.5 text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                        <Package size={15} weight="bold" />
                        <span>Thêm gói khám</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsImportModalOpen(true)}
                        className="medpro-btn-outline !py-2 !px-3.5 text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                        <UploadSimple size={15} weight="bold" />
                        <span>Nhập Excel nhân viên</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsAddModalOpen(true)}
                        className="medpro-btn-primary !py-2 !px-4 text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                        <PlusCircle size={16} weight="bold" />
                        <span>Hợp đồng đoàn mới</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl p-3.5 border border-[#E5EEF5] shadow-2xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#00B5F1] flex items-center justify-center font-bold">
                        <Buildings size={22} weight="duotone" />
                    </div>
                    <div>
                        <div className="text-[11px] text-slate-400 font-semibold uppercase">Tổng hợp đồng B2B</div>
                        <div className="text-lg font-black text-[#003553]">{stats.totalCorps} đoàn</div>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-3.5 border border-[#E5EEF5] shadow-2xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <UsersThree size={22} weight="duotone" />
                    </div>
                    <div>
                        <div className="text-[11px] text-slate-400 font-semibold uppercase">Tổng nhân sự đoàn</div>
                        <div className="text-lg font-black text-[#003553]">{stats.totalEmployees} nhân viên</div>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-3.5 border border-[#E5EEF5] shadow-2xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        <CheckCircle size={22} weight="duotone" />
                    </div>
                    <div>
                        <div className="text-[11px] text-slate-400 font-semibold uppercase">Đã hoàn thành khám</div>
                        <div className="text-lg font-black text-emerald-600">
                            {stats.totalCompleted} ({Math.round((stats.totalCompleted / (stats.totalEmployees || 1)) * 100)}%)
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-3.5 border border-[#E5EEF5] shadow-2xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Receipt size={22} weight="duotone" />
                    </div>
                    <div>
                        <div className="text-[11px] text-slate-400 font-semibold uppercase">Doanh thu dự kiến</div>
                        <div className="text-lg font-black text-[#003553] font-mono">
                            {(stats.totalRevenue || 0).toLocaleString('vi-VN')} đ
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex border-b border-slate-200 gap-1 bg-white px-3 pt-2 rounded-t-xl overflow-x-auto">
                {[
                    { id: 'DANG_KY_DOAN', label: '1. Đăng ký đoàn & Tiến độ trạm' },
                    { id: 'GOI_KHAM', label: '2. Gói khám sức khỏe đoàn' },
                    { id: 'THANH_TOAN', label: '3. Thanh toán & Công nợ B2B' },
                    { id: 'HOA_DON', label: '4. Hóa đơn điện tử VAT đoàn' },
                    { id: 'DANH_MUC', label: '5. Danh mục cơ quan đối tác' },
                ].map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveTab(t.id)}
                        className={`px-3.5 py-2 text-xs font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${
                            activeTab === t.id
                                ? 'border-[#00B5F1] text-[#00B5F1]'
                                : 'border-transparent text-slate-500 hover:text-[#003553]'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'DANG_KY_DOAN' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-5 bg-white rounded-xl border border-[#E5EEF5] p-3.5 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <span className="text-xs font-black text-[#003553] uppercase">HỢP ĐỒNG ĐOÀN ({filteredCheckups.length})</span>
                            <div className="relative w-44">
                                <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder="Tìm tên, MST..."
                                    className="w-full text-xs pl-7 pr-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                            {filteredCheckups.map((corp) => {
                                const isSelected = selectedCorp?.id === corp.id
                                const percent = Math.round(((corp.daKham || 0) / (corp.soLuongNhanVien || 1)) * 100)
                                return (
                                    <div
                                        key={corp.id}
                                        onClick={() => setSelectedCorp(corp)}
                                        className={`p-3 rounded-xl border transition cursor-pointer ${
                                            isSelected
                                                ? 'bg-[#F0F8FE] border-[#00B5F1] ring-2 ring-[#00B5F1]/15 shadow-2xs'
                                                : 'bg-white border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="text-xs font-bold text-[#003553]">{corp.tenDoan}</div>
                                                <div className="text-[11px] text-slate-400 font-mono">
                                                    Mã: {corp.maDoan} &bull; MST: {corp.maSoThue}
                                                </div>
                                            </div>
                                            <StatusBadge status={corp.trangThai} compact />
                                        </div>

                                        <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-1.5">
                                            <span className="px-1.5 py-0.5 rounded bg-sky-50 text-[#00B5F1] font-bold text-[10px]">
                                                {corp.goiKham || 'Gói tiêu chuẩn TT 32'}
                                            </span>
                                        </div>

                                        <div className="mt-2 text-[11.5px] text-slate-600 flex items-center justify-between">
                                            <span>Tiến độ khám:</span>
                                            <span className="font-extrabold text-[#003553]">
                                                {corp.daKham} / {corp.soLuongNhanVien} NV ({percent}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                                            <div
                                                className="h-1.5 bg-[#00B5F1] rounded-full transition-all"
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>

                                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                            <span className="text-slate-400">Giá trị HĐ:</span>
                                            <span className="font-mono font-black text-[#003553]">
                                                {(corp.tongTien || 0).toLocaleString('vi-VN')} đ
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="lg:col-span-7 bg-white rounded-xl border border-[#E5EEF5] p-4 space-y-4">
                        {selectedCorp ? (
                            <>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                    <div>
                                        <div className="text-sm font-black text-[#003553]">{selectedCorp.tenDoan}</div>
                                        <div className="text-xs text-slate-500">
                                            Đợt khám: <span className="font-semibold text-slate-700">{selectedCorp.dotKham}</span> &bull; HĐ:{' '}
                                            <span className="font-mono font-bold text-sky-600">{selectedCorp.soHopDong}</span>
                                        </div>
                                        <div className="text-xs text-slate-600 mt-0.5">
                                            Gói chỉ định: <span className="font-bold text-[#00B5F1]">{selectedCorp.goiKham || 'Gói tiêu chuẩn TT 32/2023/TT-BYT'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => { printDocument(); AppToast.success(`Đang mở lệnh in biên bản khám đoàn ${selectedCorp?.tenDoan}...`); }}
                                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:text-[#00B5F1] hover:border-[#00B5F1] transition flex items-center gap-1"
                                        >
                                            <Printer size={14} />
                                            <span>In biên bản đoàn</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const headers = ['STT', 'Họ tên nhân viên', 'Mã NV', 'Năm sinh', 'Giới tính', 'Xếp loại sức khỏe', 'Kết luận chuyên môn']
                                                const rows = (selectedCorp?.employees || []).map((e, idx) => [
                                                    idx + 1,
                                                    e.hoTen || e.name || '',
                                                    e.maNV || '',
                                                    e.namSinh || '',
                                                    e.gioiTinh || '',
                                                    e.xepLoai || 'Loại I',
                                                    e.ketLuan || 'Đủ sức khỏe làm việc',
                                                ])
                                                exportToExcel({
                                                    filename: `ket-qua-kham-doan-${selectedCorp?.soHopDong || 'tt32'}_${new Date().toISOString().slice(0, 10)}.xlsx`,
                                                    sheetName: 'Kết Quả Khám Đoàn',
                                                    title: 'BÁO CÁO KẾT QUẢ KHÁM SỨC KHỎE ĐỊNH KỲ (THÔNG TƯ 32/2023/TT-BYT)',
                                                    subtitle: `Đơn vị: ${selectedCorp?.tenDoan || selectedCorp?.tenCongTy || 'Doanh nghiệp'} • Hợp đồng: ${selectedCorp?.soHopDong || 'Chưa có'} • Gói khám: ${selectedCorp?.goiKham || 'TT 32'} • Tổng số: ${rows.length} CBNV`,
                                                    clinicName: configuredClinicName,
                                                    clinicAddress: configuredClinicAddress,
                                                    headers,
                                                    rows,
                                                    signOff: true,
                                                })
                                                AppToast.success('Đã xuất danh sách kết luận sức khỏe đoàn ra file Excel (.xlsx) thành công!')
                                            }}
                                            className="px-2.5 py-1.5 rounded-lg bg-[#00B5F1] text-white text-xs font-bold hover:bg-[#009bd1] transition flex items-center gap-1"
                                        >
                                            <DownloadSimple size={14} weight="bold" />
                                            <span>Xuất KQ TT 32</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="text-xs font-bold text-[#003553] uppercase tracking-wider flex items-center justify-between">
                                    <span>DANH SÁCH NHÂN SỰ & TIẾN ĐỘ TRẠM KHÁM</span>
                                    <span className="text-[11px] font-normal text-slate-400">
                                        {employeesList.length > 0 ? `${employeesList.length} nhân viên` : 'Chưa có dữ liệu'}
                                    </span>
                                </div>

                                <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                                    <table className="medpro-table text-xs">
                                        <thead>
                                            <tr>
                                                <th>Mã NV</th>
                                                <th>Họ và tên</th>
                                                <th>Thể lực</th>
                                                <th>Lâm sàng</th>
                                                <th>Xét nghiệm</th>
                                                <th>X-Quang</th>
                                                <th>Kết luận TT 32</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {employeesList.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                                                        Chưa có danh sách nhân viên cho đoàn này. Vui lòng nạp danh sách từ file Excel.
                                                    </td>
                                                </tr>
                                            ) : (
                                                employeesList.map((emp) => (
                                                    <tr key={emp.id || emp.maNV}>
                                                        <td className="font-mono font-bold text-[#00B5F1]">{emp.maNV}</td>
                                                        <td>
                                                            <div className="font-bold text-[#003553]">{emp.hoTen}</div>
                                                            <div className="text-[10.5px] text-slate-400">
                                                                {emp.gioiTinh} &bull; {emp.namSinh} &bull; {emp.chucVu}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                                                {emp.theLuc || 'Đạt'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700">
                                                                {emp.lamSang || 'Đạt'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span
                                                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                                    emp.xetNghiem === 'Đạt'
                                                                        ? 'bg-emerald-50 text-emerald-700'
                                                                        : 'bg-amber-50 text-amber-700'
                                                                }`}
                                                            >
                                                                {emp.xetNghiem || 'Đạt'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700">
                                                                {emp.xQuang || 'Đạt'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="font-bold text-xs text-[#003553]">{emp.phanLoai || 'Loại I (Tốt)'}</div>
                                                            <div className="text-[10px] text-slate-400">{emp.ketLuan || 'Đủ sức khỏe làm việc'}</div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div className="py-12 text-center text-slate-400 text-xs">
                                Chọn một hợp đồng khám đoàn ở cột bên trái để xem tiến độ chi tiết.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'GOI_KHAM' && (
                <div className="bg-white rounded-xl border border-[#E5EEF5] p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                            <div className="text-sm font-black text-[#003553] uppercase tracking-wide">
                                DANH MỤC GÓI KHÁM SỨC KHỎE ĐOÀN DOANH NGHIỆP ({corporatePackages.length})
                            </div>
                            <div className="text-xs text-slate-500">
                                Cấu hình tiêu chuẩn kỹ thuật các trạm khám và bảng giá dịch vụ trọn gói theo quy định Thông tư 32/2023/TT-BYT
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsPackageModalOpen(true)}
                            className="medpro-btn-primary !py-2 !px-4 text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                        >
                            <PlusCircle size={16} weight="bold" />
                            <span>Tạo gói khám mới</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {corporatePackages.map((pkg) => (
                            <div
                                key={pkg.id}
                                className="p-4 rounded-xl border border-[#E5EEF5] bg-[#FDFEFE] hover:shadow-xs transition space-y-3 flex flex-col justify-between"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-50 text-[#00B5F1] border border-sky-100">
                                                {pkg.maGoi}
                                            </span>
                                            <h3 className="text-xs font-black text-[#003553] mt-1">{pkg.tenGoi}</h3>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-black text-[#00B5F1] font-mono">
                                                {Number(pkg.donGia).toLocaleString('vi-VN')} đ
                                            </div>
                                            <div className="text-[10px] text-slate-400">/ nhân sự</div>
                                        </div>
                                    </div>

                                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                        <span className="font-semibold text-slate-600">Tiêu chuẩn:</span>
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                                            {pkg.tieuChuan}
                                        </span>
                                    </div>

                                    <div className="text-[11px] text-slate-500">
                                        <span className="font-semibold text-slate-600">Đối tượng áp dụng:</span>{' '}
                                        <span>{pkg.doiTuong}</span>
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 space-y-1">
                                        <div className="text-[11px] font-bold text-[#003553] uppercase">Danh mục các trạm khám & chỉ định:</div>
                                        <ul className="space-y-1 pl-4 list-disc text-[11px] text-slate-600">
                                            {(pkg.danhMucTram || []).map((tram, i) => (
                                                <li key={i}>{tram}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-[10.5px] text-slate-400">
                                        {(pkg.danhMucTram || []).length} trạm khám chuyên khoa
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNewCorpForm({
                                                ...newCorpForm,
                                                goiKham: pkg.tenGoi,
                                                donGiaNguoi: pkg.donGia,
                                            })
                                            setIsAddModalOpen(true)
                                        }}
                                        className="medpro-btn-outline !py-1 !px-2.5 text-[11px] flex items-center gap-1"
                                    >
                                        <PlusCircle size={13} />
                                        <span>Áp dụng cho HĐ mới</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'THANH_TOAN' && (
                <div className="bg-white rounded-xl border border-[#E5EEF5] p-4 space-y-4">
                    <div className="text-sm font-bold text-[#003553]">QUẢN LÝ QUYẾT TOÁN CÔNG NỢ KHÁM ĐOÀN B2B</div>
                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table text-xs">
                            <thead>
                                <tr>
                                    <th>Mã đoàn</th>
                                    <th>Doanh nghiệp</th>
                                    <th>Số HĐ</th>
                                    <th>Gói khám áp dụng</th>
                                    <th>Tổng giá trị</th>
                                    <th>Đã tạm ứng</th>
                                    <th>Còn lại phải thu</th>
                                    <th>Hạn thanh toán</th>
                                    <th>Trạng thái công nợ</th>
                                    <th>Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {corporateCheckups.map((corp) => {
                                    const conLai = (corp.tongTien || 0) - (corp.tamUng || 0)
                                    return (
                                        <tr key={corp.id}>
                                            <td className="font-mono font-bold text-[#00B5F1]">{corp.maDoan}</td>
                                            <td className="font-bold text-[#003553]">{corp.tenDoan}</td>
                                            <td className="font-mono text-xs">{corp.soHopDong}</td>
                                            <td className="text-slate-600 font-semibold">{corp.goiKham || 'Gói tiêu chuẩn TT 32'}</td>
                                            <td className="font-mono font-black text-[#003553]">
                                                {(corp.tongTien || 0).toLocaleString('vi-VN')} đ
                                            </td>
                                            <td className="font-mono text-emerald-600 font-bold">
                                                {(corp.tamUng || 0).toLocaleString('vi-VN')} đ
                                            </td>
                                            <td className="font-mono text-rose-600 font-black">
                                                {conLai.toLocaleString('vi-VN')} đ
                                            </td>
                                            <td className="text-slate-500">15/11/2026</td>
                                            <td>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                    Chờ đối soát đợt 2
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRequestPayment(corp)}
                                                    className="medpro-btn-outline !py-1 !px-2.5 text-[11px]"
                                                >
                                                    Tạo phiếu thu B2B
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'HOA_DON' && (
                <div className="bg-white rounded-xl border border-[#E5EEF5] p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-[#003553]">HÓA ĐƠN ĐIỆN TỬ VAT PHÁT HÀNH CHO DOANH NGHIỆP</div>
                        <span className="text-xs text-slate-500">Kết nối MISA meInvoice</span>
                    </div>
                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table text-xs">
                            <thead>
                                <tr>
                                    <th>Số hóa đơn</th>
                                    <th>Ký hiệu</th>
                                    <th>Ngày lập</th>
                                    <th>Đơn vị mua hàng</th>
                                    <th>Mã số thuế</th>
                                    <th>Tổng tiền chưa thuế</th>
                                    <th>Thuế VAT</th>
                                    <th>Tổng thanh toán</th>
                                    <th>Trạng thái HĐĐT</th>
                                </tr>
                            </thead>
                            <tbody>
                                {corporateCheckups.map((corp, idx) => (
                                    <tr key={corp.id}>
                                        <td className="font-mono font-bold text-[#00B5F1]">0000{142 + idx}</td>
                                        <td className="font-mono text-xs">1C26TAA</td>
                                        <td>12/10/2026</td>
                                        <td className="font-bold text-[#003553]">{corp.tenDoan}</td>
                                        <td className="font-mono">{corp.maSoThue}</td>
                                        <td className="font-mono">{(corp.tamUng || 0).toLocaleString('vi-VN')} đ</td>
                                        <td className="font-mono">0 đ (Miễn VAT y tế)</td>
                                        <td className="font-mono font-black text-[#00B5F1]">
                                            {(corp.tamUng || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                Đã ký điện tử
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'DANH_MUC' && (
                <div className="bg-white rounded-xl border border-[#E5EEF5] p-4 space-y-4">
                    <div className="text-sm font-bold text-[#003553]">DANH MỤC CƠ QUAN / ĐỐI TÁC KHÁM SỨC KHỎE</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {corporateCheckups.map((corp) => (
                            <div key={corp.id} className="p-3.5 rounded-xl border border-slate-200 bg-[#FBFDFE] space-y-1.5">
                                <div className="font-black text-[#003553] text-sm">{corp.tenDoan}</div>
                                <div className="text-xs text-slate-500">MST: <span className="font-mono font-bold">{corp.maSoThue}</span></div>
                                <div className="text-xs text-slate-500">Địa chỉ: {corp.diaChi}</div>
                                <div className="text-xs text-slate-600">
                                    Đầu mối liên hệ: <span className="font-bold">{corp.nguoiLienHe}</span> &bull; ĐT:{' '}
                                    <span className="font-mono font-bold text-[#00B5F1]">{corp.dienThoai}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-4 animate-scaleUp">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-sm font-black text-[#003553] uppercase">TẠO HỢP ĐỒNG KHÁM ĐOÀN B2B MỚI</h3>
                            <button
                                type="button"
                                onClick={() => setIsAddModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="block text-slate-600 font-bold mb-1">Tên công ty / Cơ quan:</label>
                                <input
                                    type="text"
                                    value={newCorpForm.tenDoan}
                                    onChange={(e) => setNewCorpForm({ ...newCorpForm, tenDoan: e.target.value })}
                                    placeholder="Ví dụ: Công ty Cổ phần Công nghệ ABC..."
                                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-slate-600 font-bold mb-1">Mã số thuế (MST):</label>
                                    <input
                                        type="text"
                                        value={newCorpForm.maSoThue}
                                        onChange={(e) => setNewCorpForm({ ...newCorpForm, maSoThue: e.target.value })}
                                        placeholder="0109988..."
                                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-600 font-bold mb-1">Số lượng nhân sự:</label>
                                    <input
                                        type="number"
                                        value={newCorpForm.soLuongNhanVien}
                                        onChange={(e) => setNewCorpForm({ ...newCorpForm, soLuongNhanVien: Number(e.target.value) })}
                                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-600 font-bold mb-1">Chọn gói khám sức khỏe:</label>
                                <select
                                    value={newCorpForm.goiKham}
                                    onChange={(e) => {
                                        const found = corporatePackages.find((p) => p.tenGoi === e.target.value)
                                        setNewCorpForm({
                                            ...newCorpForm,
                                            goiKham: e.target.value,
                                            donGiaNguoi: found ? found.donGia : newCorpForm.donGiaNguoi,
                                        })
                                    }}
                                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1] bg-white"
                                >
                                    {corporatePackages.map((pkg) => (
                                        <option key={pkg.id} value={pkg.tenGoi}>
                                            {pkg.tenGoi} ({Number(pkg.donGia).toLocaleString('vi-VN')} đ/người)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-slate-600 font-bold mb-1">Đơn giá/nhân sự (VNĐ):</label>
                                    <input
                                        type="number"
                                        value={newCorpForm.donGiaNguoi}
                                        onChange={(e) => setNewCorpForm({ ...newCorpForm, donGiaNguoi: Number(e.target.value) })}
                                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-600 font-bold mb-1">Chiết khấu (%):</label>
                                    <input
                                        type="number"
                                        value={newCorpForm.chietKhau}
                                        onChange={(e) => setNewCorpForm({ ...newCorpForm, chietKhau: Number(e.target.value) })}
                                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                    />
                                </div>
                            </div>

                            <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-between">
                                <span className="text-slate-600 font-semibold">Ước tính giá trị hợp đồng:</span>
                                <span className="font-mono font-black text-[#003553]">
                                    {Math.round((newCorpForm.soLuongNhanVien * newCorpForm.donGiaNguoi * (100 - newCorpForm.chietKhau)) / 100).toLocaleString('vi-VN')} đ
                                </span>
                            </div>

                            <div>
                                <label className="block text-slate-600 font-bold mb-1">Đợt khám:</label>
                                <input
                                    type="text"
                                    value={newCorpForm.dotKham}
                                    onChange={(e) => setNewCorpForm({ ...newCorpForm, dotKham: e.target.value })}
                                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-slate-600 font-bold mb-1">Người liên hệ:</label>
                                    <input
                                        type="text"
                                        value={newCorpForm.nguoiLienHe}
                                        onChange={(e) => setNewCorpForm({ ...newCorpForm, nguoiLienHe: e.target.value })}
                                        placeholder="Nguyễn Văn A (Trưởng phòng HCNS)"
                                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-600 font-bold mb-1">Số điện thoại:</label>
                                    <input
                                        type="text"
                                        value={newCorpForm.dienThoai}
                                        onChange={(e) => setNewCorpForm({ ...newCorpForm, dienThoai: e.target.value })}
                                        placeholder="0912..."
                                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsAddModalOpen(false)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateContract}
                                className="medpro-btn-primary !py-1.5 !px-4 text-xs cursor-pointer"
                            >
                                Lưu hợp đồng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isPackageModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-4 animate-scaleUp">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-sm font-black text-[#003553] uppercase">TẠO GÓI KHÁM SỨC KHỎE ĐOÀN MỚI</h3>
                            <button
                                type="button"
                                onClick={() => setIsPackageModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-slate-600 font-bold mb-1">Mã gói khám:</label>
                                    <input
                                        type="text"
                                        value={newPackageForm.maGoi}
                                        onChange={(e) => setNewPackageForm({ ...newPackageForm, maGoi: e.target.value })}
                                        placeholder="GK-TT32-05..."
                                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-600 font-bold mb-1">Đơn giá tiêu chuẩn (VNĐ):</label>
                                    <input
                                        type="number"
                                        value={newPackageForm.donGia}
                                        onChange={(e) => setNewPackageForm({ ...newPackageForm, donGia: Number(e.target.value) })}
                                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-600 font-bold mb-1">Tên gói khám:</label>
                                <input
                                    type="text"
                                    value={newPackageForm.tenGoi}
                                    onChange={(e) => setNewPackageForm({ ...newPackageForm, tenGoi: e.target.value })}
                                    placeholder="Gói khám tầm soát chuyên đề..."
                                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-slate-600 font-bold mb-1">Tiêu chuẩn pháp lý:</label>
                                    <input
                                        type="text"
                                        value={newPackageForm.tieuChuan}
                                        onChange={(e) => setNewPackageForm({ ...newPackageForm, tieuChuan: e.target.value })}
                                        placeholder="Thông tư 32/2023/TT-BYT..."
                                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-600 font-bold mb-1">Đối tượng áp dụng:</label>
                                    <input
                                        type="text"
                                        value={newPackageForm.doiTuong}
                                        onChange={(e) => setNewPackageForm({ ...newPackageForm, doiTuong: e.target.value })}
                                        placeholder="Nhân sự định kỳ, sản xuất..."
                                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-600 font-bold mb-1">Danh mục trạm khám & chỉ định (mỗi dòng 1 mục):</label>
                                <textarea
                                    rows={4}
                                    value={newPackageForm.danhMucTramText}
                                    onChange={(e) => setNewPackageForm({ ...newPackageForm, danhMucTramText: e.target.value })}
                                    placeholder="Khám thể lực tổng quát&#10;Khám lâm sàng các chuyên khoa&#10;Xét nghiệm huyết học 18 chỉ số&#10;Chụp X-quang tim phổi..."
                                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsPackageModalOpen(false)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handleCreatePackage}
                                className="medpro-btn-primary !py-1.5 !px-4 text-xs cursor-pointer"
                            >
                                Lưu gói khám
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-scaleUp">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-sm font-black text-[#003553] uppercase">NHẬP DANH SÁCH NHÂN VIÊN TỪ EXCEL</h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsImportModalOpen(false)
                                    setImportedEmployees([])
                                    setImportFileName('')
                                }}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <p className="text-slate-500">
                                Tải lên tệp danh sách nhân viên (.xlsx, .csv, .json) theo biểu mẫu chuẩn Thông tư 32 của phòng khám.
                            </p>
                            <label htmlFor="employeeFileInput" className="block border-2 border-dashed border-[#00B5F1]/40 rounded-xl p-6 text-center bg-[#F8FCFF] space-y-2 cursor-pointer hover:bg-sky-50/50 transition">
                                <input
                                    id="employeeFileInput"
                                    type="file"
                                    accept=".csv,.json,.xlsx"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <UploadSimple size={32} className="mx-auto text-[#00B5F1]" />
                                <div className="font-bold text-[#003553]">
                                    {importFileName ? importFileName : 'Nhấn để chọn tệp từ máy tính'}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                    {importedEmployees.length > 0
                                        ? `Đã nhận diện ${importedEmployees.length} nhân viên sẵn sàng nạp`
                                        : 'Hỗ trợ tệp .csv, .json định dạng TT 32'}
                                </div>
                            </label>
                            <div className="flex items-center justify-between text-[11px] text-[#00B5F1]">
                                <a href="#template" onClick={handleDownloadTemplate} className="hover:underline flex items-center gap-1 font-bold">
                                    <DownloadSimple size={13} />
                                    <span>Tải file Excel mẫu (.xlsx)</span>
                                </a>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsImportModalOpen(false)
                                    setImportedEmployees([])
                                    setImportFileName('')
                                }}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmImport}
                                className="medpro-btn-primary !py-1.5 !px-4 text-xs cursor-pointer"
                            >
                                Xác nhận nạp dữ liệu
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
