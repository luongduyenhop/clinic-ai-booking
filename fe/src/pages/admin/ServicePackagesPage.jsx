import { useState, useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { AppToast } from '../../components/common/AppNotification'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import {
    StatusBadge,
    Storefront,
    PlusCircle,
    MagnifyingGlass,
    CheckCircle,
    X,
    Eye,
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

    const [regForm, setRegForm] = useState({
        tenBN: '',
        maBN: 'BN0000155',
        dienThoai: '',
        selectedGoiId: 'MAU-GDV-01',
    })

    const handleCreatePackageReg = () => {
        if (!regForm.tenBN.trim()) {
            AppToast.error('Vui lòng nhập tên bệnh nhân')
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
        dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'servicePackageRegistrations',
                items: updated,
                auditEntry: {
                    hanhDong: 'REGISTER_SERVICE_PACKAGE',
                    doiTuong: `${newReg.maLH} - ${newReg.tenBN}`,
                    mucDich: `Kích hoạt gói khám ${newReg.tenGoi}`,
                },
            })
        )
        setIsRegisterModalOpen(false)
        AppToast.success(`Kích hoạt thành công ${template.tenGoi} cho bệnh nhân ${newReg.tenBN}`)
    }

    return (
        <div className="space-y-4">
            <div className="medpro-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-[6px] bg-clinic-surface-alt border border-clinic-info-border text-clinic-cta flex items-center justify-center shrink-0">
                        <Storefront size={22} weight="duotone" />
                    </span>
                    <div>
                        <h1 className="font-display text-base font-extrabold text-clinic-navy tracking-tight flex flex-wrap items-center gap-2">
                            <span>Gói dịch vụ Khám sức khỏe</span>
                            <span className="medpro-badge-info">
                                Tiết kiệm &amp; Toàn diện
                            </span>
                        </h1>
                        <p className="text-xs text-clinic-text-secondary mt-0.5">
                            Quản lý các gói khám sức khỏe tổng quát, tầm soát bệnh lý, định mức xét nghiệm và kích hoạt gói cho người bệnh
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setIsRegisterModalOpen(true)}
                        className="medpro-btn-primary !py-2 !px-3.5 text-xs"
                    >
                        <PlusCircle size={15} weight="bold" />
                        <span>Kích hoạt gói mới cho BN</span>
                    </button>
                </div>
            </div>

            <div className="medpro-card p-2.5">
                <div className="inline-flex flex-wrap items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border">
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

            {activeTab === 'GOI_DICH_VU' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs font-extrabold text-clinic-navy uppercase tabular-nums">
                            DANH SÁCH BỆNH NHÂN SỬ DỤNG GÓI ({filteredPackages.length})
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="medpro-input !py-1.5 h-9 !w-44 text-xs font-semibold truncate"
                            >
                                <option value="ALL">Tất cả trạng thái</option>
                                <option value="Đã xác nhận">Đã xác nhận</option>
                                <option value="Đang thực hiện">Đang thực hiện</option>
                                <option value="Hoàn thành">Hoàn thành</option>
                            </select>
                            <div className="relative w-72">
                                <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder="Tìm theo tên BN, Mã BN, Mã LH..."
                                    className="medpro-input !py-1.5 h-9 !pl-8 text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                        <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
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
                                        <td className="font-mono font-bold text-clinic-cta whitespace-nowrap">{pkg.maLH}</td>
                                        <td className="font-mono text-xs whitespace-nowrap">{pkg.maBN}</td>
                                        <td className="font-bold text-clinic-navy">{pkg.tenBN}</td>
                                        <td className="font-semibold text-clinic-text">{pkg.tenGoi}</td>
                                        <td className="text-clinic-text-secondary font-mono whitespace-nowrap">{pkg.ngayKham}</td>
                                        <td className="font-mono line-through text-clinic-text-muted whitespace-nowrap">
                                            {(pkg.tongTien || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="font-mono text-clinic-success font-bold whitespace-nowrap">
                                            -{(pkg.giamGia || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="font-mono font-extrabold text-clinic-cta whitespace-nowrap">
                                            {(pkg.thanhTien || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td>
                                            <StatusBadge status={pkg.trangThai} compact />
                                        </td>
                                        <td className="whitespace-nowrap">
                                            <span
                                                className={
                                                    pkg.thanhToan === 'Đã thu tiền'
                                                        ? 'medpro-badge-success'
                                                        : 'medpro-badge-warning'
                                                }
                                            >
                                                {pkg.thanhToan}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap">
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

            {activeTab === 'MAU_GOI' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {packageTemplates.map((tpl) => (
                            <div
                                key={tpl.id}
                                className="medpro-card p-4 flex flex-col justify-between transition-colors hover:border-clinic-cta"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="medpro-badge-info font-mono">
                                            {tpl.maGoi}
                                        </span>
                                        <span className="medpro-badge-success tabular-nums">
                                            Tiết kiệm {tpl.tietKiem}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-sm text-clinic-navy">{tpl.tenGoi}</h3>
                                    <p className="text-xs text-clinic-text-secondary line-clamp-2">{tpl.moTa}</p>
                                    <div className="text-xs text-clinic-text flex items-center gap-1 font-semibold tabular-nums">
                                        <span>Gồm {tpl.soDichVu} dịch vụ kỹ thuật &amp; xét nghiệm</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-clinic-border space-y-3 tabular-nums">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-xs text-clinic-text-muted line-through font-mono">
                                            {tpl.giaGoc.toLocaleString('vi-VN')} đ
                                        </span>
                                        <span className="text-base font-extrabold text-clinic-cta font-mono">
                                            {tpl.giaGoi.toLocaleString('vi-VN')} đ
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPackageTemplate(tpl)}
                                        className="medpro-btn-outline !py-1.5 w-full text-xs"
                                    >
                                        <Eye size={14} />
                                        <span>Xem định mức {tpl.soDichVu} dịch vụ</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {selectedPackageTemplate && (
                        <div className="medpro-card border-clinic-cta p-4 space-y-3">
                            <div className="flex items-center justify-between pb-2.5 border-b border-clinic-border">
                                <div>
                                    <div className="text-sm font-extrabold text-clinic-navy">
                                        ĐỊNH MỨC DỊCH VỤ TRONG GÓI: {selectedPackageTemplate.tenGoi}
                                    </div>
                                    <div className="text-xs text-clinic-text-secondary font-mono mt-0.5">
                                        Mã gói: {selectedPackageTemplate.maGoi} &bull; Chuyên khoa: {selectedPackageTemplate.chuyenKhoa}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPackageTemplate(null)}
                                    className="w-7 h-7 rounded-[6px] bg-clinic-bg-muted text-clinic-text-secondary hover:text-clinic-navy flex items-center justify-center cursor-pointer"
                                >
                                    <X size={16} weight="bold" />
                                </button>
                            </div>

                            <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                                <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
                                    <thead>
                                        <tr>
                                            <th className="w-10 text-center">STT</th>
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
                                                <td className="font-bold text-clinic-navy">{dv.ten}</td>
                                                <td>
                                                    <span className="medpro-badge-info">
                                                        {dv.loai}
                                                    </span>
                                                </td>
                                                <td className="font-semibold text-clinic-text-secondary">{dv.phong}</td>
                                                <td>
                                                    <span className="text-clinic-success font-bold text-xs inline-flex items-center gap-1">
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

            {activeTab === 'THANH_TOAN' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="text-sm font-extrabold text-clinic-navy uppercase">
                        QUYẾT TOÁN THU VIỆN PHÍ GÓI DỊCH VỤ TRỌN GÓI
                    </div>
                    <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                        <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
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
                                        <td className="font-mono font-bold text-clinic-cta whitespace-nowrap">{pkg.maLH}</td>
                                        <td className="font-bold text-clinic-navy">{pkg.tenBN}</td>
                                        <td className="font-semibold text-clinic-text">{pkg.tenGoi}</td>
                                        <td className="font-mono font-extrabold text-clinic-success whitespace-nowrap">
                                            {(pkg.thanhTien || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td>Chuyển khoản VietQR</td>
                                        <td>Vũ Thu Hà (TN-01)</td>
                                        <td className="text-clinic-text-secondary font-mono whitespace-nowrap">12/10/2026 08:35</td>
                                        <td className="whitespace-nowrap">
                                            <span className="text-clinic-cta font-mono font-bold hover:underline cursor-pointer">
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

            {activeTab === 'HOA_DON' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="text-sm font-extrabold text-clinic-navy uppercase">
                        DANH SÁCH HÓA ĐƠN GÓI DỊCH VỤ ĐÃ PHÁT HÀNH
                    </div>
                    <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                        <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
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
                                        <td className="font-mono font-bold text-clinic-cta whitespace-nowrap">0000{310 + idx}</td>
                                        <td className="font-bold text-clinic-navy">{pkg.tenBN}</td>
                                        <td className="text-clinic-text">{pkg.tenGoi}</td>
                                        <td className="font-mono whitespace-nowrap">{(pkg.thanhTien || 0).toLocaleString('vi-VN')} đ</td>
                                        <td className="font-mono whitespace-nowrap">0 đ</td>
                                        <td className="font-mono font-extrabold text-clinic-cta whitespace-nowrap">
                                            {(pkg.thanhTien || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="whitespace-nowrap">
                                            <span className="medpro-badge-success">
                                                Đã xuất HĐĐT
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap">
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

            {isRegisterModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-clinic-navy/45 p-4">
                    <div className="medpro-card w-full max-w-md p-5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-clinic-border">
                            <h3 className="text-sm font-extrabold text-clinic-navy uppercase">KÍCH HOẠT GÓI KHÁM CHO BỆNH NHÂN</h3>
                            <button
                                type="button"
                                onClick={() => setIsRegisterModalOpen(false)}
                                className="w-7 h-7 rounded-[6px] bg-clinic-bg-muted text-clinic-text-secondary hover:text-clinic-navy flex items-center justify-center cursor-pointer"
                            >
                                <X size={16} weight="bold" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="medpro-label">Tên bệnh nhân:</label>
                                <input
                                    type="text"
                                    value={regForm.tenBN}
                                    onChange={(e) => setRegForm({ ...regForm, tenBN: e.target.value })}
                                    placeholder="Nhập tên bệnh nhân..."
                                    className="medpro-input !py-1.5 h-9 text-xs"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="medpro-label !mb-0">Mã bệnh nhân:</label>
                                        <span className="medpro-badge-info !text-[10px]">
                                            Tự sinh
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        value={regForm.maBN || ''}
                                        readOnly
                                        disabled
                                        className="medpro-input !py-1.5 h-9 text-xs font-mono font-bold bg-clinic-bg-muted text-clinic-text-muted cursor-not-allowed select-none"
                                        title="Mã bệnh nhân do hệ thống cấp phát, không được sửa"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Số điện thoại:</label>
                                    <input
                                        type="text"
                                        value={regForm.dienThoai}
                                        onChange={(e) => setRegForm({ ...regForm, dienThoai: e.target.value })}
                                        placeholder="09..."
                                        className="medpro-input !py-1.5 h-9 text-xs tabular-nums"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="medpro-label">Chọn gói dịch vụ:</label>
                                <select
                                    value={regForm.selectedGoiId}
                                    onChange={(e) => setRegForm({ ...regForm, selectedGoiId: e.target.value })}
                                    className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
                                >
                                    {packageTemplates.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.tenGoi} ({t.giaGoi.toLocaleString('vi-VN')} đ)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-clinic-border">
                            <button
                                type="button"
                                onClick={() => setIsRegisterModalOpen(false)}
                                className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleCreatePackageReg}
                                className="medpro-btn-primary !py-1.5 !px-4 text-xs"
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
