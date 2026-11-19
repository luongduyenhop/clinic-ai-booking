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
            <div className="medpro-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-[6px] bg-clinic-surface-alt border border-clinic-info-border text-clinic-cta flex items-center justify-center shrink-0">
                        <UsersThree size={22} weight="duotone" />
                    </span>
                    <div>
                        <h1 className="font-display text-base font-extrabold text-clinic-navy tracking-tight flex flex-wrap items-center gap-2">
                            <span>Khám sức khỏe Đoàn Doanh nghiệp (B2B)</span>
                            <span className="medpro-badge-info">
                                Thông tư 32/2023/TT-BYT
                            </span>
                        </h1>
                        <p className="text-xs text-clinic-text-secondary mt-0.5">
                            Quản lý hợp đồng khám đoàn, cấu hình gói khám, nạp danh sách nhân sự &amp; tiến độ trạm khám
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setIsPackageModalOpen(true)}
                        className="medpro-btn-outline !py-2 !px-3.5 text-xs"
                    >
                        <Package size={15} weight="bold" className="text-clinic-cta" />
                        <span>Thêm gói khám</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsImportModalOpen(true)}
                        className="medpro-btn-outline !py-2 !px-3.5 text-xs"
                    >
                        <UploadSimple size={15} weight="bold" className="text-clinic-cta" />
                        <span>Nhập Excel nhân viên</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsAddModalOpen(true)}
                        className="medpro-btn-primary !py-2 !px-3.5 text-xs"
                    >
                        <PlusCircle size={15} weight="bold" />
                        <span>Hợp đồng đoàn mới</span>
                    </button>
                </div>
            </div>

            <div className="bg-clinic-surface rounded-[6px] border border-clinic-border grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-clinic-border tabular-nums">
                <div className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[6px] bg-clinic-surface-alt border border-clinic-info-border text-clinic-cta flex items-center justify-center shrink-0">
                        <Buildings size={20} weight="duotone" />
                    </div>
                    <div>
                        <div className="text-[11px] text-clinic-text-secondary font-semibold uppercase">Tổng hợp đồng B2B</div>
                        <div className="text-lg font-extrabold text-clinic-navy">{stats.totalCorps} đoàn</div>
                    </div>
                </div>

                <div className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[6px] bg-clinic-surface-tint border border-clinic-info-border text-clinic-navy flex items-center justify-center shrink-0">
                        <UsersThree size={20} weight="duotone" />
                    </div>
                    <div>
                        <div className="text-[11px] text-clinic-text-secondary font-semibold uppercase">Tổng nhân sự đoàn</div>
                        <div className="text-lg font-extrabold text-clinic-navy">{stats.totalEmployees} nhân viên</div>
                    </div>
                </div>

                <div className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[6px] bg-clinic-success-bg border border-clinic-success-border text-clinic-success flex items-center justify-center shrink-0">
                        <CheckCircle size={20} weight="duotone" />
                    </div>
                    <div>
                        <div className="text-[11px] text-clinic-text-secondary font-semibold uppercase">Đã hoàn thành khám</div>
                        <div className="text-lg font-extrabold text-clinic-success">
                            {stats.totalCompleted} ({Math.round((stats.totalCompleted / (stats.totalEmployees || 1)) * 100)}%)
                        </div>
                    </div>
                </div>

                <div className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[6px] bg-clinic-warning-bg border border-clinic-warning-border text-clinic-warning flex items-center justify-center shrink-0">
                        <Receipt size={20} weight="duotone" />
                    </div>
                    <div>
                        <div className="text-[11px] text-clinic-text-secondary font-semibold uppercase">Doanh thu dự kiến</div>
                        <div className="text-lg font-extrabold text-clinic-navy font-mono">
                            {(stats.totalRevenue || 0).toLocaleString('vi-VN')} đ
                        </div>
                    </div>
                </div>
            </div>

            <div className="medpro-card p-2.5 overflow-x-auto">
                <div className="inline-flex flex-wrap items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border">
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
                            className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors duration-75 cursor-pointer whitespace-nowrap ${
                                activeTab === t.id
                                    ? 'bg-clinic-navy text-clinic-surface'
                                    : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'DANG_KY_DOAN' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-5 medpro-card p-3.5 space-y-3">
                        <div className="flex items-center justify-between pb-2.5 border-b border-clinic-border gap-2">
                            <span className="text-xs font-extrabold text-clinic-navy uppercase tabular-nums">
                                HỢP ĐỒNG ĐOÀN ({filteredCheckups.length})
                            </span>
                            <div className="relative w-48">
                                <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder="Tìm tên, MST..."
                                    className="medpro-input !py-1 !pl-8 h-8 text-xs"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1 tabular-nums">
                            {filteredCheckups.map((corp) => {
                                const isSelected = selectedCorp?.id === corp.id
                                const percent = Math.round(((corp.daKham || 0) / (corp.soLuongNhanVien || 1)) * 100)
                                return (
                                    <div
                                        key={corp.id}
                                        onClick={() => setSelectedCorp(corp)}
                                        className={`p-3 rounded-[6px] border transition-colors cursor-pointer ${
                                            isSelected
                                                ? 'bg-clinic-surface-alt border-clinic-cta'
                                                : 'bg-clinic-surface border-clinic-border hover:border-clinic-border-strong'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="text-xs font-bold text-clinic-navy">{corp.tenDoan}</div>
                                                <div className="text-[11px] text-clinic-text-muted font-mono">
                                                    Mã: {corp.maDoan} &bull; MST: {corp.maSoThue}
                                                </div>
                                            </div>
                                            <StatusBadge status={corp.trangThai} compact />
                                        </div>

                                        <div className="mt-2 flex items-center gap-1.5">
                                            <span className="medpro-badge-info !text-[10px]">
                                                {corp.goiKham || 'Gói tiêu chuẩn TT 32'}
                                            </span>
                                        </div>

                                        <div className="mt-2 text-[11.5px] text-clinic-text-secondary flex items-center justify-between">
                                            <span>Tiến độ khám:</span>
                                            <span className="font-extrabold text-clinic-navy">
                                                {corp.daKham} / {corp.soLuongNhanVien} NV ({percent}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-clinic-bg-muted rounded-[4px] h-1.5 mt-1 overflow-hidden border border-clinic-border">
                                            <div
                                                className="h-1.5 bg-clinic-cta rounded-[4px] transition-all"
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>

                                        <div className="mt-2.5 pt-2 border-t border-clinic-border flex items-center justify-between text-[11px]">
                                            <span className="text-clinic-text-muted">Giá trị HĐ:</span>
                                            <span className="font-mono font-extrabold text-clinic-navy">
                                                {(corp.tongTien || 0).toLocaleString('vi-VN')} đ
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="lg:col-span-7 medpro-card p-4 space-y-4">
                        {selectedCorp ? (
                            <>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-clinic-border">
                                    <div>
                                        <div className="text-sm font-extrabold text-clinic-navy">{selectedCorp.tenDoan}</div>
                                        <div className="text-xs text-clinic-text-secondary">
                                            Đợt khám: <span className="font-semibold text-clinic-navy">{selectedCorp.dotKham}</span> &bull; HĐ:{' '}
                                            <span className="font-mono font-bold text-clinic-cta">{selectedCorp.soHopDong}</span>
                                        </div>
                                        <div className="text-xs text-clinic-text-secondary mt-0.5">
                                            Gói chỉ định: <span className="font-bold text-clinic-cta">{selectedCorp.goiKham || 'Gói tiêu chuẩn TT 32/2023/TT-BYT'}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => { printDocument(); AppToast.success(`Đang mở lệnh in biên bản khám đoàn ${selectedCorp?.tenDoan}...`) }}
                                            className="medpro-btn-outline !py-1.5 !px-3 text-xs"
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
                                            className="medpro-btn-primary !py-1.5 !px-3 text-xs"
                                        >
                                            <DownloadSimple size={14} weight="bold" />
                                            <span>Xuất KQ TT 32</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="text-xs font-bold text-clinic-navy uppercase tracking-wider flex items-center justify-between tabular-nums">
                                    <span>DANH SÁCH NHÂN SỰ &amp; TIẾN ĐỘ TRẠM KHÁM</span>
                                    <span className="text-[11px] font-medium text-clinic-text-muted">
                                        {employeesList.length > 0 ? `${employeesList.length} nhân viên` : 'Chưa có dữ liệu'}
                                    </span>
                                </div>

                                <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                                    <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
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
                                                    <td colSpan={7} className="text-center py-8 text-clinic-text-muted text-xs">
                                                        Chưa có danh sách nhân viên cho đoàn này. Vui lòng nạp danh sách từ file Excel.
                                                    </td>
                                                </tr>
                                            ) : (
                                                employeesList.map((emp) => (
                                                    <tr key={emp.id || emp.maNV}>
                                                        <td className="font-mono font-bold text-clinic-cta whitespace-nowrap">{emp.maNV}</td>
                                                        <td>
                                                            <div className="font-bold text-clinic-navy">{emp.hoTen}</div>
                                                            <div className="text-[11px] text-clinic-text-muted">
                                                                {emp.gioiTinh} &bull; {emp.namSinh} &bull; {emp.chucVu}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span className="medpro-badge-success !text-[10px]">
                                                                {emp.theLuc || 'Đạt'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="medpro-badge-info !text-[10px]">
                                                                {emp.lamSang || 'Đạt'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span
                                                                className={
                                                                    emp.xetNghiem === 'Đạt'
                                                                        ? 'medpro-badge-success !text-[10px]'
                                                                        : 'medpro-badge-warning !text-[10px]'
                                                                }
                                                            >
                                                                {emp.xetNghiem || 'Đạt'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="medpro-badge-info !text-[10px]">
                                                                {emp.xQuang || 'Đạt'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="font-bold text-xs text-clinic-navy">{emp.phanLoai || 'Loại I (Tốt)'}</div>
                                                            <div className="text-[11px] text-clinic-text-muted">{emp.ketLuan || 'Đủ sức khỏe làm việc'}</div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div className="py-12 text-center text-clinic-text-muted text-xs">
                                Chọn một hợp đồng khám đoàn ở cột bên trái để xem tiến độ chi tiết.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'GOI_KHAM' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-clinic-border">
                        <div>
                            <div className="text-sm font-extrabold text-clinic-navy uppercase tracking-wide tabular-nums">
                                DANH MỤC GÓI KHÁM SỨC KHỎE ĐOÀN DOANH NGHIỆP ({corporatePackages.length})
                            </div>
                            <div className="text-xs text-clinic-text-secondary">
                                Cấu hình tiêu chuẩn kỹ thuật các trạm khám và bảng giá dịch vụ trọn gói theo quy định Thông tư 32/2023/TT-BYT
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsPackageModalOpen(true)}
                            className="medpro-btn-primary !py-2 !px-3.5 text-xs self-start sm:self-auto"
                        >
                            <PlusCircle size={15} weight="bold" />
                            <span>Tạo gói khám mới</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {corporatePackages.map((pkg) => (
                            <div
                                key={pkg.id}
                                className="p-4 rounded-[6px] border border-clinic-border bg-clinic-bg space-y-3 flex flex-col justify-between"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <span className="medpro-badge-info font-mono !text-[10px]">
                                                {pkg.maGoi}
                                            </span>
                                            <h3 className="text-xs font-extrabold text-clinic-navy mt-1">{pkg.tenGoi}</h3>
                                        </div>
                                        <div className="text-right tabular-nums shrink-0">
                                            <div className="text-sm font-extrabold text-clinic-cta font-mono">
                                                {Number(pkg.donGia).toLocaleString('vi-VN')} đ
                                            </div>
                                            <div className="text-[10px] text-clinic-text-muted">/ nhân sự</div>
                                        </div>
                                    </div>

                                    <div className="text-[11px] text-clinic-text-secondary flex items-center gap-2">
                                        <span className="font-semibold">Tiêu chuẩn:</span>
                                        <span className="medpro-badge-success !text-[10px]">
                                            {pkg.tieuChuan}
                                        </span>
                                    </div>

                                    <div className="text-[11px] text-clinic-text-secondary">
                                        <span className="font-semibold">Đối tượng áp dụng:</span>{' '}
                                        <span>{pkg.doiTuong}</span>
                                    </div>

                                    <div className="pt-2 border-t border-clinic-border space-y-1">
                                        <div className="text-[11px] font-bold text-clinic-navy uppercase">Danh mục các trạm khám &amp; chỉ định:</div>
                                        <ul className="space-y-1 pl-4 list-disc text-[11px] text-clinic-text-secondary">
                                            {(pkg.danhMucTram || []).map((tram, i) => (
                                                <li key={i}>{tram}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-clinic-border flex items-center justify-between tabular-nums">
                                    <span className="text-[11px] text-clinic-text-muted">
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
                                        className="medpro-btn-outline !py-1 !px-2.5 text-[11px]"
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
                <div className="medpro-card p-4 space-y-4">
                    <div className="text-sm font-extrabold text-clinic-navy uppercase">QUẢN LÝ QUYẾT TOÁN CÔNG NỢ KHÁM ĐOÀN B2B</div>
                    <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                        <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
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
                                            <td className="font-mono font-bold text-clinic-cta whitespace-nowrap">{corp.maDoan}</td>
                                            <td className="font-bold text-clinic-navy">{corp.tenDoan}</td>
                                            <td className="font-mono text-xs whitespace-nowrap">{corp.soHopDong}</td>
                                            <td className="text-clinic-text-secondary font-semibold">{corp.goiKham || 'Gói tiêu chuẩn TT 32'}</td>
                                            <td className="font-mono font-extrabold text-clinic-navy whitespace-nowrap">
                                                {(corp.tongTien || 0).toLocaleString('vi-VN')} đ
                                            </td>
                                            <td className="font-mono text-clinic-success font-bold whitespace-nowrap">
                                                {(corp.tamUng || 0).toLocaleString('vi-VN')} đ
                                            </td>
                                            <td className="font-mono text-clinic-danger font-extrabold whitespace-nowrap">
                                                {conLai.toLocaleString('vi-VN')} đ
                                            </td>
                                            <td className="text-clinic-text-secondary whitespace-nowrap">15/11/2026</td>
                                            <td className="whitespace-nowrap">
                                                <span className="medpro-badge-warning">
                                                    Chờ đối soát đợt 2
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap">
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
                <div className="medpro-card p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-extrabold text-clinic-navy uppercase">HÓA ĐƠN ĐIỆN TỬ VAT PHÁT HÀNH CHO DOANH NGHIỆP</div>
                        <span className="medpro-badge-info">Kết nối MISA meInvoice</span>
                    </div>
                    <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                        <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
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
                                        <td className="font-mono font-bold text-clinic-cta whitespace-nowrap">0000{142 + idx}</td>
                                        <td className="font-mono text-xs whitespace-nowrap">1C26TAA</td>
                                        <td className="whitespace-nowrap">12/10/2026</td>
                                        <td className="font-bold text-clinic-navy">{corp.tenDoan}</td>
                                        <td className="font-mono whitespace-nowrap">{corp.maSoThue}</td>
                                        <td className="font-mono whitespace-nowrap">{(corp.tamUng || 0).toLocaleString('vi-VN')} đ</td>
                                        <td className="font-mono">0 đ (Miễn VAT y tế)</td>
                                        <td className="font-mono font-extrabold text-clinic-cta whitespace-nowrap">
                                            {(corp.tamUng || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="whitespace-nowrap">
                                            <span className="medpro-badge-success">
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
                <div className="medpro-card p-4 space-y-4">
                    <div className="text-sm font-extrabold text-clinic-navy uppercase">DANH MỤC CƠ QUAN / ĐỐI TÁC KHÁM SỨC KHỎE</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 tabular-nums">
                        {corporateCheckups.map((corp) => (
                            <div key={corp.id} className="p-3.5 rounded-[6px] border border-clinic-border bg-clinic-bg space-y-1.5">
                                <div className="font-extrabold text-clinic-navy text-sm">{corp.tenDoan}</div>
                                <div className="text-xs text-clinic-text-secondary">MST: <span className="font-mono font-bold text-clinic-navy">{corp.maSoThue}</span></div>
                                <div className="text-xs text-clinic-text-secondary">Địa chỉ: {corp.diaChi}</div>
                                <div className="text-xs text-clinic-text">
                                    Đầu mối liên hệ: <span className="font-bold">{corp.nguoiLienHe}</span> &bull; ĐT:{' '}
                                    <span className="font-mono font-bold text-clinic-cta">{corp.dienThoai}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-clinic-navy/45 p-4">
                    <div className="medpro-card w-full max-w-lg p-5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-clinic-border">
                            <h3 className="text-sm font-extrabold text-clinic-navy uppercase">TẠO HỢP ĐỒNG KHÁM ĐOÀN B2B MỚI</h3>
                            <button
                                type="button"
                                onClick={() => setIsAddModalOpen(false)}
                                className="w-7 h-7 rounded-[6px] bg-clinic-bg-muted text-clinic-text-secondary hover:text-clinic-navy flex items-center justify-center cursor-pointer"
                            >
                                <X size={16} weight="bold" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="medpro-label">Tên công ty / Cơ quan:</label>
                                <input
                                    type="text"
                                    value={newCorpForm.tenDoan}
                                    onChange={(e) => setNewCorpForm({ ...newCorpForm, tenDoan: e.target.value })}
                                    placeholder="Ví dụ: Công ty Cổ phần Công nghệ ABC..."
                                    className="medpro-input !py-1.5 h-9 text-xs"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <label className="medpro-label">Mã số thuế (MST):</label>
                                    <input
                                        type="text"
                                        value={newCorpForm.maSoThue}
                                        onChange={(e) => setNewCorpForm({ ...newCorpForm, maSoThue: e.target.value })}
                                        placeholder="0109988..."
                                        className="medpro-input !py-1.5 h-9 text-xs font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Số lượng nhân sự:</label>
                                    <input
                                        type="number"
                                        value={newCorpForm.soLuongNhanVien}
                                        onChange={(e) => setNewCorpForm({ ...newCorpForm, soLuongNhanVien: Number(e.target.value) })}
                                        className="medpro-input !py-1.5 h-9 text-xs tabular-nums"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="medpro-label">Chọn gói khám sức khỏe:</label>
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
                                    className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
                                >
                                    {corporatePackages.map((pkg) => (
                                        <option key={pkg.id} value={pkg.tenGoi}>
                                            {pkg.tenGoi} ({Number(pkg.donGia).toLocaleString('vi-VN')} đ/người)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <label className="medpro-label">Đơn giá/nhân sự (VNĐ):</label>
                                    <input
                                        type="number"
                                        value={newCorpForm.donGiaNguoi}
                                        onChange={(e) => setNewCorpForm({ ...newCorpForm, donGiaNguoi: Number(e.target.value) })}
                                        className="medpro-input !py-1.5 h-9 text-xs tabular-nums"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Chiết khấu (%):</label>
                                    <input
                                        type="number"
                                        value={newCorpForm.chietKhau}
                                        onChange={(e) => setNewCorpForm({ ...newCorpForm, chietKhau: Number(e.target.value) })}
                                        className="medpro-input !py-1.5 h-9 text-xs tabular-nums"
                                    />
                                </div>
                            </div>

                            <div className="p-2.5 rounded-[6px] bg-clinic-surface-tint border border-clinic-info-border flex items-center justify-between tabular-nums">
                                <span className="text-clinic-text-secondary font-semibold">Ước tính giá trị hợp đồng:</span>
                                <span className="font-mono font-extrabold text-clinic-navy">
                                    {Math.round((newCorpForm.soLuongNhanVien * newCorpForm.donGiaNguoi * (100 - newCorpForm.chietKhau)) / 100).toLocaleString('vi-VN')} đ
                                </span>
                            </div>

                            <div>
                                <label className="medpro-label">Đợt khám:</label>
                                <input
                                    type="text"
                                    value={newCorpForm.dotKham}
                                    onChange={(e) => setNewCorpForm({ ...newCorpForm, dotKham: e.target.value })}
                                    className="medpro-input !py-1.5 h-9 text-xs"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <label className="medpro-label">Người liên hệ:</label>
                                    <input
                                        type="text"
                                        value={newCorpForm.nguoiLienHe}
                                        onChange={(e) => setNewCorpForm({ ...newCorpForm, nguoiLienHe: e.target.value })}
                                        placeholder="Nguyễn Văn A (Trưởng phòng HCNS)"
                                        className="medpro-input !py-1.5 h-9 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Số điện thoại:</label>
                                    <input
                                        type="text"
                                        value={newCorpForm.dienThoai}
                                        onChange={(e) => setNewCorpForm({ ...newCorpForm, dienThoai: e.target.value })}
                                        placeholder="0912..."
                                        className="medpro-input !py-1.5 h-9 text-xs tabular-nums"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-clinic-border">
                            <button
                                type="button"
                                onClick={() => setIsAddModalOpen(false)}
                                className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateContract}
                                className="medpro-btn-primary !py-1.5 !px-4 text-xs"
                            >
                                Lưu hợp đồng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isPackageModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-clinic-navy/45 p-4">
                    <div className="medpro-card w-full max-w-lg p-5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-clinic-border">
                            <h3 className="text-sm font-extrabold text-clinic-navy uppercase">TẠO GÓI KHÁM SỨC KHỎE ĐOÀN MỚI</h3>
                            <button
                                type="button"
                                onClick={() => setIsPackageModalOpen(false)}
                                className="w-7 h-7 rounded-[6px] bg-clinic-bg-muted text-clinic-text-secondary hover:text-clinic-navy flex items-center justify-center cursor-pointer"
                            >
                                <X size={16} weight="bold" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <label className="medpro-label">Mã gói khám:</label>
                                    <input
                                        type="text"
                                        value={newPackageForm.maGoi}
                                        onChange={(e) => setNewPackageForm({ ...newPackageForm, maGoi: e.target.value })}
                                        placeholder="GK-TT32-05..."
                                        className="medpro-input !py-1.5 h-9 text-xs font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Đơn giá tiêu chuẩn (VNĐ):</label>
                                    <input
                                        type="number"
                                        value={newPackageForm.donGia}
                                        onChange={(e) => setNewPackageForm({ ...newPackageForm, donGia: Number(e.target.value) })}
                                        className="medpro-input !py-1.5 h-9 text-xs tabular-nums"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="medpro-label">Tên gói khám:</label>
                                <input
                                    type="text"
                                    value={newPackageForm.tenGoi}
                                    onChange={(e) => setNewPackageForm({ ...newPackageForm, tenGoi: e.target.value })}
                                    placeholder="Gói khám tầm soát chuyên đề..."
                                    className="medpro-input !py-1.5 h-9 text-xs"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <label className="medpro-label">Tiêu chuẩn pháp lý:</label>
                                    <input
                                        type="text"
                                        value={newPackageForm.tieuChuan}
                                        onChange={(e) => setNewPackageForm({ ...newPackageForm, tieuChuan: e.target.value })}
                                        placeholder="Thông tư 32/2023/TT-BYT..."
                                        className="medpro-input !py-1.5 h-9 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Đối tượng áp dụng:</label>
                                    <input
                                        type="text"
                                        value={newPackageForm.doiTuong}
                                        onChange={(e) => setNewPackageForm({ ...newPackageForm, doiTuong: e.target.value })}
                                        placeholder="Nhân sự định kỳ, sản xuất..."
                                        className="medpro-input !py-1.5 h-9 text-xs"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="medpro-label">Danh mục trạm khám &amp; chỉ định (mỗi dòng 1 mục):</label>
                                <textarea
                                    rows={4}
                                    value={newPackageForm.danhMucTramText}
                                    onChange={(e) => setNewPackageForm({ ...newPackageForm, danhMucTramText: e.target.value })}
                                    placeholder="Khám thể lực tổng quát&#10;Khám lâm sàng các chuyên khoa&#10;Xét nghiệm huyết học 18 chỉ số&#10;Chụp X-quang tim phổi..."
                                    className="medpro-input text-xs"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-clinic-border">
                            <button
                                type="button"
                                onClick={() => setIsPackageModalOpen(false)}
                                className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handleCreatePackage}
                                className="medpro-btn-primary !py-1.5 !px-4 text-xs"
                            >
                                Lưu gói khám
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-clinic-navy/45 p-4">
                    <div className="medpro-card w-full max-w-md p-5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-clinic-border">
                            <h3 className="text-sm font-extrabold text-clinic-navy uppercase">NHẬP DANH SÁCH NHÂN VIÊN TỪ EXCEL</h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsImportModalOpen(false)
                                    setImportedEmployees([])
                                    setImportFileName('')
                                }}
                                className="w-7 h-7 rounded-[6px] bg-clinic-bg-muted text-clinic-text-secondary hover:text-clinic-navy flex items-center justify-center cursor-pointer"
                            >
                                <X size={16} weight="bold" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <p className="text-clinic-text-secondary">
                                Tải lên tệp danh sách nhân viên (.xlsx, .csv, .json) theo biểu mẫu chuẩn Thông tư 32 của phòng khám.
                            </p>
                            <label htmlFor="employeeFileInput" className="block border-2 border-dashed border-clinic-cta rounded-[6px] p-6 text-center bg-clinic-surface-tint space-y-2 cursor-pointer hover:bg-clinic-surface-alt transition-colors">
                                <input
                                    id="employeeFileInput"
                                    type="file"
                                    accept=".csv,.json,.xlsx"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <UploadSimple size={28} className="mx-auto text-clinic-cta" />
                                <div className="font-bold text-clinic-navy">
                                    {importFileName ? importFileName : 'Nhấn để chọn tệp từ máy tính'}
                                </div>
                                <div className="text-[11px] text-clinic-text-muted tabular-nums">
                                    {importedEmployees.length > 0
                                        ? `Đã nhận diện ${importedEmployees.length} nhân viên sẵn sàng nạp`
                                        : 'Hỗ trợ tệp .csv, .json định dạng TT 32'}
                                </div>
                            </label>
                            <div className="flex items-center justify-between text-[11px] text-clinic-cta">
                                <a href="#template" onClick={handleDownloadTemplate} className="hover:underline inline-flex items-center gap-1 font-bold">
                                    <DownloadSimple size={13} />
                                    <span>Tải file Excel mẫu (.xlsx)</span>
                                </a>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-clinic-border">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsImportModalOpen(false)
                                    setImportedEmployees([])
                                    setImportFileName('')
                                }}
                                className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmImport}
                                className="medpro-btn-primary !py-1.5 !px-4 text-xs"
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
