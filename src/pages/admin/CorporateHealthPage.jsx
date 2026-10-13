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
} from '../../components/common/ClinicIcon'

export default function CorporateHealthPage() {
    const dispatch = useDispatch()
    const location = useLocation()
    const { clinicData } = useSelector((state) => state.app.admin)
    const corporateCheckups = clinicData?.corporateCheckups || []

    const queryTab = new URLSearchParams(location.search).get('tab')
    const [activeTab, setActiveTab] = useState(
        queryTab && ['DANG_KY_DOAN', 'THANH_TOAN', 'HOA_DON', 'DANH_MUC'].includes(queryTab)
            ? queryTab
            : 'DANG_KY_DOAN'
    )

    useEffect(() => {
        if (queryTab && ['DANG_KY_DOAN', 'THANH_TOAN', 'HOA_DON', 'DANH_MUC'].includes(queryTab)) {
            setActiveTab(queryTab)
        }
    }, [queryTab])

    const [searchText, setSearchText] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [selectedCorp, setSelectedCorp] = useState(corporateCheckups[0] || null)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)

    // Form thêm đoàn mới
    const [newCorpForm, setNewCorpForm] = useState({
        tenDoan: '',
        maSoThue: '',
        diaChi: '',
        nguoiLienHe: '',
        dienThoai: '',
        dotKham: 'Khám sức khỏe định kỳ Quý IV - 2026',
        soLuongNhanVien: 50,
        goiKham: 'Gói khám tiêu chuẩn TT 32/2023/TT-BYT',
        donGiaNguoi: 1200000,
        chietKhau: 10,
    })

    // Dữ liệu mẫu nhân viên cho đoàn được chọn
    const mockEmployees = useMemo(() => {
        if (!selectedCorp) return []
        const baseName = selectedCorp.tenDoan?.split(' ')[0] || 'NV'
        return [
            {
                id: 'NV01',
                maNV: 'TL-101',
                hoTen: 'Nguyễn Văn Thành',
                gioiTinh: 'Nam',
                namSinh: 1991,
                chucVu: 'Kỹ sư phần mềm',
                theLuc: 'Đạt',
                lamSang: 'Đạt',
                xetNghiem: 'Chờ kết quả',
                xQuang: 'Đạt (Tim phổi bt)',
                ketLuan: 'Chưa kết luận',
                phanLoai: '-',
            },
            {
                id: 'NV02',
                maNV: 'TL-102',
                hoTen: 'Trần Thị Mai Phương',
                gioiTinh: 'Nữ',
                namSinh: 1995,
                chucVu: 'Chuyên viên Nhân sự',
                theLuc: 'Đạt',
                lamSang: 'Đạt',
                xetNghiem: 'Đạt',
                xQuang: 'Đạt',
                ketLuan: 'Đã hoàn thành',
                phanLoai: 'Loại I (Tốt)',
            },
            {
                id: 'NV03',
                maNV: 'TL-103',
                hoTen: 'Lê Hoàng Nam',
                gioiTinh: 'Nam',
                namSinh: 1988,
                chucVu: 'Trưởng phòng Kỹ thuật',
                theLuc: 'Đạt',
                lamSang: 'Đạt (Tăng HA nhẹ)',
                xetNghiem: 'Đạt',
                xQuang: 'Đạt',
                ketLuan: 'Đã hoàn thành',
                phanLoai: 'Loại II (Khá)',
            },
            {
                id: 'NV04',
                maNV: 'TL-104',
                hoTen: 'Vũ Minh Anh',
                gioiTinh: 'Nữ',
                namSinh: 1998,
                chucVu: 'UI/UX Designer',
                theLuc: 'Đang khám',
                lamSang: 'Chưa khám',
                xetNghiem: 'Chưa lấy mẫu',
                xQuang: 'Chưa chụp',
                ketLuan: 'Chưa kết luận',
                phanLoai: '-',
            },
            {
                id: 'NV05',
                maNV: 'TL-105',
                hoTen: 'Phạm Đức Huy',
                gioiTinh: 'Nam',
                namSinh: 1993,
                chucVu: 'DevOps Engineer',
                theLuc: 'Đạt',
                lamSang: 'Đạt',
                xetNghiem: 'Đạt',
                xQuang: 'Đạt',
                ketLuan: 'Đã hoàn thành',
                phanLoai: 'Loại I (Tốt)',
            },
        ]
    }, [selectedCorp])

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

    // KPI thống kê
    const stats = useMemo(() => {
        const totalCorps = corporateCheckups.length
        const totalEmployees = corporateCheckups.reduce((acc, c) => acc + (Number(c.soLuongNhanVien) || 0), 0)
        const totalCompleted = corporateCheckups.reduce((acc, c) => acc + (Number(c.daKham) || 0), 0)
        const totalRevenue = corporateCheckups.reduce((acc, c) => acc + (Number(c.tongTien) || 0), 0)
        return { totalCorps, totalEmployees, totalCompleted, totalRevenue }
    }, [corporateCheckups])

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
                    mucDich: `Tạo hợp đồng khám đoàn (${newCorp.soLuongNhanVien} NV)`,
                },
            })
        )
        setSelectedCorp(newCorp)
        setIsAddModalOpen(false)
        AppToast.success(`Tạo hợp đồng khám đoàn ${newCorp.tenDoan} thành công!`)
    }

    return (
        <div className="space-y-4">
            {/* Top Navigation & Operational Summary */}
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
                            Quản lý hợp đồng khám đoàn, import danh sách nhân sự, theo dõi tiến độ trạm khám & xuất hóa đơn VAT
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
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

            {/* KPI Cards */}
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

            {/* Sub-Tabs bar (Chuẩn tClinic) */}
            <div className="flex border-b border-slate-200 gap-1 bg-white px-3 pt-2 rounded-t-xl">
                {[
                    { id: 'DANG_KY_DOAN', label: '1. Đăng ký đoàn & Tiến độ trạm' },
                    { id: 'THANH_TOAN', label: '2. Thanh toán & Công nợ B2B' },
                    { id: 'HOA_DON', label: '3. Hóa đơn điện tử VAT đoàn' },
                    { id: 'DANH_MUC', label: '4. Danh mục cơ quan đối tác' },
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

            {/* MAIN CONTENT AREA */}
            {activeTab === 'DANG_KY_DOAN' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Cột trái: Danh sách Hợp đồng đoàn */}
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

                    {/* Cột phải: Chi tiết tiến độ từng nhân viên trong đoàn */}
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
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => AppToast.success(`Đang tải phiếu kết luận đoàn ${selectedCorp.tenDoan}...`)}
                                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:text-[#00B5F1] hover:border-[#00B5F1] transition flex items-center gap-1"
                                        >
                                            <Printer size={14} />
                                            <span>In biên bản đoàn</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => AppToast.success('Đã xuất danh sách kết luận sức khỏe sang Excel!')}
                                            className="px-2.5 py-1.5 rounded-lg bg-[#00B5F1] text-white text-xs font-bold hover:bg-[#009bd1] transition flex items-center gap-1"
                                        >
                                            <DownloadSimple size={14} weight="bold" />
                                            <span>Xuất KQ TT 32</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="text-xs font-bold text-[#003553] uppercase tracking-wider flex items-center justify-between">
                                    <span>DANH SÁCH NHÂN SỰ & TIẾN ĐỘ TRẠM KHÁM</span>
                                    <span className="text-[11px] font-normal text-slate-400">Hiển thị mẫu 5 nhân viên</span>
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
                                            {mockEmployees.map((emp) => (
                                                <tr key={emp.id}>
                                                    <td className="font-mono font-bold text-[#00B5F1]">{emp.maNV}</td>
                                                    <td>
                                                        <div className="font-bold text-[#003553]">{emp.hoTen}</div>
                                                        <div className="text-[10.5px] text-slate-400">
                                                            {emp.gioiTinh} &bull; {emp.namSinh} &bull; {emp.chucVu}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                                            {emp.theLuc}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700">
                                                            {emp.lamSang}
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
                                                            {emp.xetNghiem}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700">
                                                            {emp.xQuang}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="font-bold text-xs text-[#003553]">{emp.phanLoai}</div>
                                                        <div className="text-[10px] text-slate-400">{emp.ketLuan}</div>
                                                    </td>
                                                </tr>
                                            ))}
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

            {/* TAB THANH TOAN */}
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
                                                    onClick={() => AppToast.success(`Gửi đề nghị thanh toán tới ${corp.tenDoan}!`)}
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

            {/* TAB HOA DON */}
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

            {/* TAB DANH MUC DOAN */}
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

            {/* MODAL THÊM HỢP ĐỒNG ĐOÀN */}
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

            {/* MODAL IMPORT EXCEL */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-scaleUp">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-sm font-black text-[#003553] uppercase">NHẬP DANH SÁCH NHÂN VIÊN TỪ EXCEL</h3>
                            <button
                                type="button"
                                onClick={() => setIsImportModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <p className="text-slate-500">
                                Tải lên tệp danh sách nhân viên (.xlsx, .csv) theo biểu mẫu chuẩn Thông tư 32 của phòng khám.
                            </p>
                            <div className="border-2 border-dashed border-[#00B5F1]/40 rounded-xl p-6 text-center bg-[#F8FCFF] space-y-2">
                                <UploadSimple size={32} className="mx-auto text-[#00B5F1]" />
                                <div className="font-bold text-[#003553]">Kéo thả file Excel vào đây</div>
                                <div className="text-[11px] text-slate-400">hoặc nhấn để chọn tệp từ máy tính</div>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-[#00B5F1]">
                                <a href="#template" onClick={(e) => { e.preventDefault(); AppToast.success('Đã tải mẫu Excel chuẩn TT 32!') }} className="hover:underline flex items-center gap-1 font-bold">
                                    <DownloadSimple size={13} />
                                    <span>Tải file Excel mẫu (.xlsx)</span>
                                </a>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsImportModalOpen(false)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsImportModalOpen(false)
                                    AppToast.success('Đã nạp thành công danh sách 48 nhân viên vào đoàn!')
                                }}
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
