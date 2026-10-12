import { useState, useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { AppToast } from '../../components/common/AppNotification'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import {
    StatusBadge,
    Package,
    Storefront,
    PlusCircle,
    MagnifyingGlass,
    Receipt,
    CheckCircle,
    X,
    Eye,
    Tag,
} from '../../components/common/ClinicIcon'

export default function ServicePackagesPage() {
    const dispatch = useDispatch()
    const location = useLocation()
    const { clinicData } = useSelector((state) => state.app.admin)
    const servicePackages = clinicData?.servicePackageRegistrations || []

    const queryTab = new URLSearchParams(location.search).get('tab')
    const [activeTab, setActiveTab] = useState(
        queryTab && ['GOI_DICH_VU', 'MAU_GOI', 'THANH_TOAN', 'HOA_DON'].includes(queryTab)
            ? queryTab
            : 'GOI_DICH_VU'
    )

    useEffect(() => {
        if (queryTab && ['GOI_DICH_VU', 'MAU_GOI', 'THANH_TOAN', 'HOA_DON'].includes(queryTab)) {
            setActiveTab(queryTab)
        }
    }, [queryTab])

    const [searchText, setSearchText] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [selectedPackageTemplate, setSelectedPackageTemplate] = useState(null)
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)

    // Danh mục mẫu gói khám lâm sàng & CLS
    const packageTemplates = useMemo(() => [
        {
            id: 'MAU-GDV-01',
            maGoi: 'GDV-TQ-01',
            tenGoi: 'Gói khám Sức khỏe Tổng quát Tiêu chuẩn Medpro',
            chuyenKhoa: 'Đa Khoa',
            soDichVu: 7,
            giaGoc: 2200000,
            giaGoi: 1750000,
            tietKiem: '20%',
            moTa: 'Phù hợp khám định kỳ hàng năm cho cá nhân và người lao động',
            danhMucDichVu: [
                { stt: 1, ten: 'Khám Nội tổng quát & Đánh giá thể lực', loai: 'Lâm sàng', phong: 'Phòng 101' },
                { stt: 2, ten: 'Tổng phân tích tế bào máu ngoại vi (18 chỉ số)', loai: 'Xét nghiệm', phong: 'Phòng Lab Máu' },
                { stt: 3, ten: 'Đường huyết đói (Glucose máu)', loai: 'Xét nghiệm', phong: 'Phòng Hóa sinh' },
                { stt: 4, ten: 'Chức năng gan & thận (AST, ALT, Ure, Creatinin)', loai: 'Xét nghiệm', phong: 'Phòng Hóa sinh' },
                { stt: 5, ten: 'Tổng phân tích nước tiểu 10 thông số', loai: 'Xét nghiệm', phong: 'Phòng Nước tiểu' },
                { stt: 6, ten: 'Chụp X-Quang ngực thẳng kỹ thuật số', loai: 'Chẩn đoán hình ảnh', phong: 'Phòng X-Quang' },
                { stt: 7, ten: 'Siêu âm màu ổ bụng tổng quát', loai: 'Chẩn đoán hình ảnh', phong: 'Phòng Siêu âm 01' },
            ],
        },
        {
            id: 'MAU-GDV-02',
            maGoi: 'GDV-TIM-02',
            tenGoi: 'Gói Tầm soát Sớm Bệnh lý Tim mạch & Huyết áp',
            chuyenKhoa: 'Tim mạch',
            soDichVu: 6,
            giaGoc: 3100000,
            giaGoi: 2450000,
            tietKiem: '21%',
            moTa: 'Tầm soát xơ vữa động mạch, rối loạn nhịp tim và nguy cơ đột quỵ',
            danhMucDichVu: [
                { stt: 1, ten: 'Khám chuyên khoa Tim mạch & Đo huyết áp 2 tay', loai: 'Lâm sàng', phong: 'Phòng 204' },
                { stt: 2, ten: 'Đo điện tim 12 chuyển đạo tiêu chuẩn (ECG)', loai: 'Thăm dò chức năng', phong: 'Phòng Điện tim' },
                { stt: 3, ten: 'Siêu âm tim Doppler màu qua thành ngực', loai: 'Chẩn đoán hình ảnh', phong: 'Phòng Siêu âm Tim' },
                { stt: 4, ten: 'Bộ mỡ máu Lipid toàn phần (Cholesterol, TG, HDL, LDL)', loai: 'Xét nghiệm', phong: 'Phòng Hóa sinh' },
                { stt: 5, ten: 'Định lượng Axit Uric máu', loai: 'Xét nghiệm', phong: 'Phòng Hóa sinh' },
                { stt: 6, ten: 'Chụp X-Quang tim phổi thẳng kỹ thuật số', loai: 'Chẩn đoán hình ảnh', phong: 'Phòng X-Quang' },
            ],
        },
        {
            id: 'MAU-GDV-03',
            maGoi: 'GDV-SAN-03',
            tenGoi: 'Gói Tầm soát Chuyên sâu Phụ khoa & Ung thư Cổ tử cung',
            chuyenKhoa: 'Phụ sản',
            soDichVu: 6,
            giaGoc: 2800000,
            giaGoi: 2150000,
            tietKiem: '23%',
            moTa: 'Phát hiện sớm viêm nhiễm, u xơ tử cung và tầm soát tế bào ác tính',
            danhMucDichVu: [
                { stt: 1, ten: 'Khám Phụ khoa tổng quát chuyên gia', loai: 'Lâm sàng', phong: 'Phòng 206' },
                { stt: 2, ten: 'Soi tươi dịch âm đạo tìm vi nấm, tạp khuẩn', loai: 'Xét nghiệm', phong: 'Phòng Vi sinh' },
                { stt: 3, ten: 'Xét nghiệm tầm soát ung thư cổ tử cung ThinPrep Pap test', loai: 'Giải phẫu bệnh', phong: 'Phòng TB học' },
                { stt: 4, ten: 'Định tuýp virus HPV nguy cơ cao (HPV Realtime PCR)', loai: 'Sinh học phân tử', phong: 'Phòng PCR' },
                { stt: 5, ten: 'Siêu âm đầu dò âm đạo kiểm tra tử cung phần phụ', loai: 'Chẩn đoán hình ảnh', phong: 'Phòng Siêu âm 02' },
                { stt: 6, ten: 'Siêu âm 2D tuyến vú hai bên tầm soát u nang', loai: 'Chẩn đoán hình ảnh', phong: 'Phòng Siêu âm 02' },
            ],
        },
    ], [])

    const filteredPackages = useMemo(() => {
        return servicePackages.filter((pkg) => {
            const matchSearch =
                !searchText ||
                pkg.tenBN?.toLowerCase().includes(searchText.toLowerCase()) ||
                pkg.maBN?.toLowerCase().includes(searchText.toLowerCase()) ||
                pkg.maLH?.toLowerCase().includes(searchText.toLowerCase()) ||
                pkg.tenGoi?.toLowerCase().includes(searchText.toLowerCase())
            const matchStatus = statusFilter === 'ALL' || pkg.trangThai === statusFilter
            return matchSearch && matchStatus
        })
    }, [servicePackages, searchText, statusFilter])

    // Form đăng ký gói mới
    const [regForm, setRegForm] = useState({
        tenBN: '',
        maBN: 'BN0000155',
        dienThoai: '',
        selectedGoiId: 'MAU-GDV-01',
    })

    const handleCreatePackageReg = () => {
        if (!regForm.tenBN.trim()) {
            AppToast.error('Vui lòng nhập tên bệnh nhân!')
            return
        }
        const template = packageTemplates.find((t) => t.id === regForm.selectedGoiId) || packageTemplates[0]
        const newReg = {
            id: `GDV-${Date.now().toString().slice(-4)}`,
            maLH: `GDV2610${servicePackages.length + 10}`,
            maBN: regForm.maBN,
            tenBN: regForm.tenBN,
            tenGoi: template.tenGoi,
            ngayTao: new Date().toISOString().slice(0, 10),
            ngayKham: new Date().toISOString().slice(0, 10),
            tongTien: template.giaGoc,
            giamGia: template.giaGoc - template.giaGoi,
            thanhTien: template.giaGoi,
            trangThai: 'Đã xác nhận',
            thanhToan: 'Đã thu tiền',
        }
        const updated = [newReg, ...servicePackages]
        dispatch(updateClinicCollectionAsync('servicePackageRegistrations', updated))
        setIsRegisterModalOpen(false)
        AppToast.success(`Kích hoạt thành công ${template.tenGoi} cho bệnh nhân ${newReg.tenBN}!`)
    }

    return (
        <div className="space-y-4">
            {/* Top Navigation & Operational Summary */}
            <div className="bg-white rounded-2xl shadow-xs border border-[#E5EEF5] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#00B5F1] to-[#0088BA] text-white flex items-center justify-center shadow-md">
                        <Storefront size={24} weight="fill" />
                    </span>
                    <div>
                        <h1 className="text-lg font-black text-[#003553] tracking-wide flex items-center gap-2">
                            GÓI DỊCH VỤ KHÁM SỨC KHỎE
                            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-[#00B5F1] text-[11px] font-bold">
                                Tiết kiệm & Toàn diện
                            </span>
                        </h1>
                        <p className="text-xs text-slate-500">
                            Quản lý các gói khám sức khỏe tổng quát, tầm soát ung thư, mẫu gói xét nghiệm và kích hoạt gói cho bệnh nhân
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsRegisterModalOpen(true)}
                        className="medpro-btn-primary !py-2 !px-4 text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                        <PlusCircle size={16} weight="bold" />
                        <span>Kích hoạt gói mới cho BN</span>
                    </button>
                </div>
            </div>

            {/* Sub-Tabs bar (Chuẩn tClinic) */}
            <div className="flex border-b border-slate-200 gap-1 bg-white px-3 pt-2 rounded-t-xl">
                {[
                    { id: 'GOI_DICH_VU', label: '1. Gói dịch vụ đã đăng ký' },
                    { id: 'MAU_GOI', label: '2. Mẫu gói dịch vụ & Định mức CLS' },
                    { id: 'THANH_TOAN', label: '3. Quyết toán thanh toán gói' },
                    { id: 'HOA_DON', label: '4. Hóa đơn gói dịch vụ' },
                ].map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveTab(t.id)}
                        className={`px-3.5 py-2 text-xs font-bold transition border-b-2 cursor-pointer ${
                            activeTab === t.id
                                ? 'border-[#00B5F1] text-[#00B5F1]'
                                : 'border-transparent text-slate-500 hover:text-[#003553]'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* TAB 1: DANH SÁCH BỆNH NHÂN ĐĂNG KÝ GÓI */}
            {activeTab === 'GOI_DICH_VU' && (
                <div className="bg-white rounded-xl border border-[#E5EEF5] p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs font-black text-[#003553] uppercase">
                            DANH SÁCH BỆNH NHÂN SỬ DỤNG GÓI ({filteredPackages.length})
                        </div>
                        <div className="relative w-72">
                            <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder="Tìm theo tên BN, Mã BN, Mã LH..."
                                className="w-full text-xs pl-8 pr-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table text-xs">
                            <thead>
                                <tr>
                                    <th>Mã LH</th>
                                    <th>Mã BN</th>
                                    <th>Họ và tên bệnh nhân</th>
                                    <th>Tên gói dịch vụ</th>
                                    <th>Ngày khám</th>
                                    <th>Giá gốc</th>
                                    <th>Ưu đãi</th>
                                    <th>Thành tiền</th>
                                    <th>Trạng thái khám</th>
                                    <th>Thanh toán</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPackages.map((pkg) => (
                                    <tr key={pkg.id}>
                                        <td className="font-mono font-bold text-[#00B5F1]">{pkg.maLH}</td>
                                        <td className="font-mono text-xs">{pkg.maBN}</td>
                                        <td className="font-bold text-[#003553]">{pkg.tenBN}</td>
                                        <td className="font-semibold text-slate-700">{pkg.tenGoi}</td>
                                        <td className="text-slate-500 font-mono">{pkg.ngayKham}</td>
                                        <td className="font-mono line-through text-slate-400">
                                            {(pkg.tongTien || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="font-mono text-emerald-600 font-bold">
                                            -{(pkg.giamGia || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="font-mono font-black text-[#00B5F1]">
                                            {(pkg.thanhTien || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td>
                                            <StatusBadge status={pkg.trangThai} compact />
                                        </td>
                                        <td>
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    pkg.thanhToan === 'Đã thu tiền'
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                }`}
                                            >
                                                {pkg.thanhToan}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                onClick={() => AppToast.success(`Mở hồ sơ thực hiện gói của BN ${pkg.tenBN}`)}
                                                className="medpro-btn-outline !py-1 !px-2.5 text-[11px]"
                                            >
                                                Xem tiến độ
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2: MẪU GÓI DỊCH VỤ (Định mức CLS) */}
            {activeTab === 'MAU_GOI' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {packageTemplates.map((tpl) => (
                            <div
                                key={tpl.id}
                                className="bg-white rounded-xl border border-[#E5EEF5] p-4 shadow-2xs hover:shadow-md transition flex flex-col justify-between"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="px-2 py-0.5 rounded bg-sky-100 text-[#00B5F1] font-mono text-[11px] font-bold">
                                            {tpl.maGoi}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                            Tiết kiệm {tpl.tietKiem}
                                        </span>
                                    </div>
                                    <h3 className="font-black text-sm text-[#003553]">{tpl.tenGoi}</h3>
                                    <p className="text-xs text-slate-500 line-clamp-2">{tpl.moTa}</p>
                                    <div className="text-xs text-slate-600 flex items-center gap-1 font-semibold">
                                        <span>Gồm {tpl.soDichVu} dịch vụ kỹ thuật & xét nghiệm</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-xs text-slate-400 line-through">
                                            {tpl.giaGoc.toLocaleString('vi-VN')} đ
                                        </span>
                                        <span className="text-base font-black text-[#00B5F1] font-mono">
                                            {tpl.giaGoi.toLocaleString('vi-VN')} đ
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPackageTemplate(tpl)}
                                        className="w-full py-1.5 rounded-lg border border-[#00B5F1] text-[#00B5F1] hover:bg-[#00B5F1] hover:text-white transition text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                        <Eye size={14} />
                                        <span>Xem định mức {tpl.soDichVu} dịch vụ</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Drawer/Modal chi tiết định mức dịch vụ trong gói */}
                    {selectedPackageTemplate && (
                        <div className="bg-white rounded-xl border border-[#00B5F1] p-4 space-y-3 animate-scaleUp">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <div>
                                    <div className="text-sm font-black text-[#003553]">
                                        ĐỊNH MỨC DỊCH VỤ TRONG GÓI: {selectedPackageTemplate.tenGoi}
                                    </div>
                                    <div className="text-xs text-slate-500 font-mono">
                                        Mã gói: {selectedPackageTemplate.maGoi} &bull; Chuyên khoa: {selectedPackageTemplate.chuyenKhoa}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPackageTemplate(null)}
                                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X size={18} weight="bold" />
                                </button>
                            </div>

                            <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                                <table className="medpro-table text-xs">
                                    <thead>
                                        <tr>
                                            <th>STT</th>
                                            <th>Tên dịch vụ kỹ thuật / Xét nghiệm</th>
                                            <th>Phân loại</th>
                                            <th>Phòng thực hiện chỉ định</th>
                                            <th>Trạng thái định mức</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedPackageTemplate.danhMucDichVu.map((dv) => (
                                            <tr key={dv.stt}>
                                                <td className="font-bold text-center">{dv.stt}</td>
                                                <td className="font-bold text-[#003553]">{dv.ten}</td>
                                                <td>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-[#00B5F1]">
                                                        {dv.loai}
                                                    </span>
                                                </td>
                                                <td className="font-semibold text-slate-600">{dv.phong}</td>
                                                <td>
                                                    <span className="text-emerald-600 font-bold text-[11px] flex items-center gap-1">
                                                        <CheckCircle size={13} weight="fill" />
                                                        Bắt buộc trong gói
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: THANH TOÁN */}
            {activeTab === 'THANH_TOAN' && (
                <div className="bg-white rounded-xl border border-[#E5EEF5] p-4 space-y-4">
                    <div className="text-sm font-bold text-[#003553]">QUYẾT TOÁN THU VIỆN PHÍ GÓI DỊCH VỤ TRỌN GÓI</div>
                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table text-xs">
                            <thead>
                                <tr>
                                    <th>Mã LH</th>
                                    <th>Họ tên BN</th>
                                    <th>Gói đăng ký</th>
                                    <th>Số tiền đã thu</th>
                                    <th>Hình thức thu</th>
                                    <th>Thu ngân</th>
                                    <th>Thời gian thu</th>
                                    <th>Hóa đơn</th>
                                </tr>
                            </thead>
                            <tbody>
                                {servicePackages.map((pkg) => (
                                    <tr key={pkg.id}>
                                        <td className="font-mono font-bold text-[#00B5F1]">{pkg.maLH}</td>
                                        <td className="font-bold text-[#003553]">{pkg.tenBN}</td>
                                        <td className="font-semibold text-slate-700">{pkg.tenGoi}</td>
                                        <td className="font-mono font-black text-emerald-600">
                                            {(pkg.thanhTien || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td>Chuyển khoản VietQR</td>
                                        <td>Vũ Thu Hà (TN-01)</td>
                                        <td className="text-slate-500 font-mono">12/10/2026 08:35</td>
                                        <td>
                                            <span className="text-[#00B5F1] font-mono font-bold hover:underline cursor-pointer">
                                                HD-GDV-00{pkg.id.slice(-2)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 4: HÓA ĐƠN */}
            {activeTab === 'HOA_DON' && (
                <div className="bg-white rounded-xl border border-[#E5EEF5] p-4 space-y-4">
                    <div className="text-sm font-bold text-[#003553]">DANH SÁCH HÓA ĐƠN GÓI DỊCH VỤ ĐÃ PHÁT HÀNH</div>
                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table text-xs">
                            <thead>
                                <tr>
                                    <th>Số hóa đơn</th>
                                    <th>Khách hàng / Bệnh nhân</th>
                                    <th>Gói dịch vụ</th>
                                    <th>Giá gói</th>
                                    <th>VAT</th>
                                    <th>Tổng tiền</th>
                                    <th>Trạng thái HĐ</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {servicePackages.map((pkg, idx) => (
                                    <tr key={pkg.id}>
                                        <td className="font-mono font-bold text-[#00B5F1]">0000{310 + idx}</td>
                                        <td className="font-bold text-[#003553]">{pkg.tenBN}</td>
                                        <td className="text-slate-700">{pkg.tenGoi}</td>
                                        <td className="font-mono">{(pkg.thanhTien || 0).toLocaleString('vi-VN')} đ</td>
                                        <td className="font-mono">0 đ</td>
                                        <td className="font-mono font-black text-[#00B5F1]">
                                            {(pkg.thanhTien || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                Đã xuất HĐĐT
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                onClick={() => AppToast.success(`Đang tải hóa đơn 0000${310 + idx}...`)}
                                                className="medpro-btn-outline !py-1 !px-2.5 text-[11px]"
                                            >
                                                In hóa đơn
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL KÍCH HOẠT GÓI MỚI CHO BỆNH NHÂN */}
            {isRegisterModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-scaleUp">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-sm font-black text-[#003553] uppercase">KÍCH HOẠT GÓI KHÁM CHO BỆNH NHÂN</h3>
                            <button
                                type="button"
                                onClick={() => setIsRegisterModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="block text-slate-600 font-bold mb-1">Tên bệnh nhân:</label>
                                <input
                                    type="text"
                                    value={regForm.tenBN}
                                    onChange={(e) => setRegForm({ ...regForm, tenBN: e.target.value })}
                                    placeholder="Nhập tên bệnh nhân..."
                                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-slate-600 font-bold mb-1">Mã bệnh nhân:</label>
                                    <input
                                        type="text"
                                        value={regForm.maBN}
                                        onChange={(e) => setRegForm({ ...regForm, maBN: e.target.value })}
                                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-600 font-bold mb-1">Số điện thoại:</label>
                                    <input
                                        type="text"
                                        value={regForm.dienThoai}
                                        onChange={(e) => setRegForm({ ...regForm, dienThoai: e.target.value })}
                                        placeholder="09..."
                                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-600 font-bold mb-1">Chọn gói dịch vụ:</label>
                                <select
                                    value={regForm.selectedGoiId}
                                    onChange={(e) => setRegForm({ ...regForm, selectedGoiId: e.target.value })}
                                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                                >
                                    {packageTemplates.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.tenGoi} ({t.giaGoi.toLocaleString('vi-VN')} đ)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsRegisterModalOpen(false)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleCreatePackageReg}
                                className="medpro-btn-primary !py-1.5 !px-4 text-xs cursor-pointer"
                            >
                                Xác nhận kích hoạt
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
