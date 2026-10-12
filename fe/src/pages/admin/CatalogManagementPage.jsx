import { useState, useEffect } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { updateCatalogSubCollectionAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../../components/common/AppNotification'
import { getMasterOptions } from '../../services/admin/clinicSeedData'
import {
    ClinicIcon,
    StatusBadge,
    EmptyState,
    Plus,
    FloppyDisk,
    Trash,
    DownloadSimple,
    UploadSimple,
    MagnifyingGlass,
} from '../../components/common/ClinicIcon'

export default function CatalogManagementPage() {
    const { loaiDanhMuc = 'chung' } = useParams()
    const dispatch = useDispatch()
    const location = useLocation()
    const { clinicData } = useSelector((state) => state.app.admin)
    const catalogs = clinicData?.catalogs || {}

    const masterOptions = getMasterOptions(clinicData)
    const generalSubTabs = masterOptions.generalCatalogSubTabs || []
    const catalogRouteMap = masterOptions.catalogRouteMap || {}

    const queryTab = new URLSearchParams(location.search).get('tab')
    const [activeGeneralSubTab, setActiveGeneralSubTab] = useState(generalSubTabs[0]?.key || 'goTat')
    const [searchText, setSearchText] = useState('')
    const [pharmacyTab, setPharmacyTab] = useState(
        queryTab && ['DANH_MUC', 'TON_KHO'].includes(queryTab) ? queryTab : 'DANH_MUC'
    )

    useEffect(() => {
        if (queryTab && ['DANH_MUC', 'TON_KHO'].includes(queryTab)) {
            setPharmacyTab(queryTab)
        }
    }, [queryTab])
    const [batchFilter, setBatchFilter] = useState('ALL')
    const inventoryBatches = clinicData?.inventoryBatches || []

    const activeCatalogKey =
        loaiDanhMuc === 'chung'
            ? activeGeneralSubTab
            : loaiDanhMuc === 'dia-chi'
            ? 'diaChi'
            : loaiDanhMuc === 'khoa-phong'
            ? 'khoaPhong'
            : loaiDanhMuc === 'benh'
            ? 'danhMucBenh'
            : loaiDanhMuc === 'thuoc-vat-tu'
            ? 'thuocVatTu'
            : 'dichVu'

    const listData = catalogs[activeCatalogKey] || []

    const [form, setForm] = useState(() => listData[0] || {})

    const handleSwitchCatalogView = (items) => {
        setForm(items?.[0] || {})
        setSearchText('')
    }

    const handleNewItem = () => {
        if (activeCatalogKey === 'diaChi') {
            setForm({ id: '', maTinh: '01', tenTinh: 'Thành phố Hà Nội', quanHuyen: '', phuongXa: '', trangThai: true })
        } else if (activeCatalogKey === 'khoaPhong') {
            setForm({
                id: '',
                maPhong: `PK0${listData.length + 1}`,
                tenPhong: '',
                chuyenKhoa: 'Nội tổng quát',
                tang: 'Tầng 1',
                bacSiPhuTrach: 'BS.CKII Nguyễn Minh Hoàng',
                trangThai: true,
            })
        } else if (activeCatalogKey === 'danhMucBenh') {
            setForm({
                id: '',
                maICD: '',
                tenBenh: '',
                chuongBenh: 'Chương X: Bệnh hệ hô hấp',
                truyenNhiem: false,
                trangThai: true,
            })
        } else if (activeCatalogKey === 'thuocVatTu') {
            setForm({
                id: '',
                maThuoc: `TH00${listData.length + 1}`,
                tenThuoc: '',
                hoatChat: '',
                dvt: 'Viên',
                donGia: 5000,
                tonKho: 500,
                nhomThuoc: 'Thuốc kê đơn',
                trangThai: true,
            })
        } else if (activeCatalogKey === 'dichVu') {
            setForm({
                id: '',
                maDV: `DV0${15 + listData.length}`,
                tenDV: '',
                nhomDV: 'Khám bệnh',
                dvt: 'Lần',
                donGia: 150000,
                phongTH: 'Phòng số 1 (Phòng khám Nội)',
                trangThai: true,
            })
        } else {
            setForm({ id: '', ma: '', ten: '', noiDung: '', moTa: '', donGiaMacDinh: 100000, thuTu: listData.length + 1, trangThai: true })
        }
        AppToast.info('Đã khởi tạo mẫu danh mục mới!')
    }

    const handleSaveItem = async () => {
        const exists = listData.some((item) => item.id === form.id && form.id)
        let updated
        if (exists) {
            updated = listData.map((item) => (item.id === form.id ? { ...item, ...form } : item))
        } else {
            const newItem = {
                ...form,
                id: `${activeCatalogKey.toUpperCase()}-${Date.now().toString().slice(-4)}`,
            }
            updated = [...listData, newItem]
            setForm(newItem)
        }

        await dispatch(
            updateCatalogSubCollectionAsync({
                subKey: activeCatalogKey,
                items: updated,
                auditEntry: {
                    hanhDong: exists ? 'UPDATE_CATALOG_ITEM' : 'CREATE_CATALOG_ITEM',
                    mucDich: `Cập nhật phân hệ Danh mục (${activeCatalogKey})`,
                },
            })
        )
        AppToast.success(exists ? 'Đã cập nhật mục danh mục!' : 'Đã thêm mới vào danh mục thành công!')
    }

    const handleDeleteItem = async () => {
        if (!form.id) return
        const updated = listData.filter((item) => item.id !== form.id)
        await dispatch(
            updateCatalogSubCollectionAsync({
                subKey: activeCatalogKey,
                items: updated,
            })
        )
        setForm(updated[0] || {})
        AppToast.info('Đã xóa mục khỏi danh mục!')
    }

    const filteredList = listData.filter((item) => {
        if (!searchText) return true
        const raw = JSON.stringify(item).toLowerCase()
        return raw.includes(searchText.toLowerCase())
    })

    return (
        <div className="space-y-3.5">
            {/* Top 6 Catalog Modules Navigation Bar */}
            <div className="medpro-card p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    {Object.entries(catalogRouteMap).map(([key, meta]) => {
                        const active = loaiDanhMuc === key
                        return (
                            <Link
                                key={key}
                                to={meta.path}
                                onClick={() =>
                                    handleSwitchCatalogView(
                                        catalogs[key === 'chung' ? activeGeneralSubTab : key] || []
                                    )
                                }
                                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                                    active
                                        ? 'bg-[#00B5F1] text-white shadow-xs'
                                        : 'bg-[#F0F7FC] text-[#003553] hover:bg-[#00B5F1]/15'
                                }`}
                            >
                                <ClinicIcon name={meta.icon || 'Folders'} size={14} weight={active ? 'fill' : 'duotone'} />
                                <span>{meta.title}</span>
                            </Link>
                        )
                    })}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => AppToast.info('Đã mở hộp thoại Import danh mục từ file Excel (.xlsx)!')}
                        className="medpro-btn-outline !py-1 !px-3 text-xs"
                    >
                        <DownloadSimple size={14} weight="bold" className="text-[#00B5F1]" />
                        <span>Import Excel</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => AppToast.success(`Đã xuất Excel danh mục (${filteredList.length} bản ghi)!`)}
                        className="medpro-btn-outline !py-1 !px-3 text-xs"
                    >
                        <UploadSimple size={14} weight="bold" className="text-[#00B5F1]" />
                        <span>Xuất Excel</span>
                    </button>
                </div>
            </div>

            {/* If loaiDanhMuc === 'chung', show the 5 Sub-Tabs matching Video 07 */}
            {loaiDanhMuc === 'chung' && (
                <div className="medpro-card p-2.5 flex flex-wrap items-center gap-1.5 bg-[#F8FBFE]">
                    {generalSubTabs.map((sub) => {
                        const active = activeGeneralSubTab === sub.key
                        return (
                            <button
                                key={sub.key}
                                type="button"
                                onClick={() => {
                                    setActiveGeneralSubTab(sub.key)
                                    setForm((catalogs[sub.key] || [])[0] || {})
                                }}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                                    active
                                        ? 'bg-[#003553] text-white shadow-xs'
                                        : 'bg-white text-[#003553] border border-[#CBE9FA] hover:border-[#00B5F1]'
                                }`}
                            >
                                <ClinicIcon
                                    name={sub.icon || 'SlidersHorizontal'}
                                    size={14}
                                    weight={active ? 'fill' : 'duotone'}
                                    className={active ? 'text-[#00B5F1]' : 'text-[#00B5F1]'}
                                />
                                <span>
                                    {sub.label} ({(catalogs[sub.key] || []).length})
                                </span>
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Warehouse sub-tab switcher for Thuốc & Vật tư y tế */}
            {loaiDanhMuc === 'thuoc-vat-tu' && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#E8F4FD]/60 p-2.5 rounded-xl border border-[#B8E5FA]">
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setPharmacyTab('DANH_MUC')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                pharmacyTab === 'DANH_MUC'
                                    ? 'bg-[#00B5F1] text-white shadow-xs'
                                    : 'bg-white text-[#003553] hover:bg-slate-100'
                            }`}
                        >
                            1. Danh mục Thuốc & Vật tư y tế ({listData.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setPharmacyTab('TON_KHO')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                pharmacyTab === 'TON_KHO'
                                    ? 'bg-[#00B5F1] text-white shadow-xs'
                                    : 'bg-white text-[#003553] hover:bg-slate-100'
                            }`}
                        >
                            2. Quản lý Kho, Số lô & Hạn dùng FEFO (/tonkho) ({inventoryBatches.length})
                        </button>
                    </div>
                    {pharmacyTab === 'TON_KHO' && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => AppToast.success('Đã tải Báo cáo Tồn kho & Hạn dùng Excel!')}
                                className="medpro-btn-outline text-xs !py-1"
                            >
                                <DownloadSimple size={13} weight="bold" className="text-[#00B5F1]" />
                                <span>Tải báo cáo kho</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => AppToast.success('Đã chốt tồn kho chu kỳ thành công (F5)!')}
                                className="medpro-btn-primary text-xs !py-1"
                            >
                                <FloppyDisk size={13} weight="bold" />
                                <span>Chốt tồn kho (F5)</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Warehouse Full Inventory View */}
            {loaiDanhMuc === 'thuoc-vat-tu' && pharmacyTab === 'TON_KHO' ? (
                <div className="medpro-card p-4 space-y-3">
                    <div className="medpro-section-title">
                        <span>DANH SÁCH TỒN KHO DƯỢC & VẬT TƯ Y TẾ (KIỂM SOÁT LÔ & HẠN SỬ DỤNG FEFO)</span>
                        <span className="text-xs font-semibold text-[#00B5F1]">{inventoryBatches.length} mặt hàng theo lô</span>
                    </div>

                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table">
                            <thead>
                                <tr>
                                    <th>STT</th>
                                    <th>Mã Dược QG</th>
                                    <th>Mã nội bộ</th>
                                    <th>Thuốc & Vật tư</th>
                                    <th>Số lô SX</th>
                                    <th>Hạn dùng (FEFO)</th>
                                    <th>ĐVT</th>
                                    <th>Hàm lượng</th>
                                    <th>Tồn đầu</th>
                                    <th>SL Nhập</th>
                                    <th>SL Xuất</th>
                                    <th>Tổng tồn</th>
                                    <th>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inventoryBatches.map((item, idx) => (
                                    <tr key={item.id || idx}>
                                        <td className="font-bold">{idx + 1}</td>
                                        <td className="font-mono font-bold text-[#00B5F1]">{item.maHangHoa}</td>
                                        <td className="font-mono text-xs">{item.maThuocNoiBo}</td>
                                        <td className="font-bold text-[#003553]">{item.tenThuoc}</td>
                                        <td className="font-mono text-xs font-semibold">{item.soLo}</td>
                                        <td className="font-mono text-xs tabular-nums text-slate-600">{item.hanSuDung}</td>
                                        <td>{item.dvt}</td>
                                        <td className="text-xs text-slate-500">{item.hamLuong}</td>
                                        <td className="tabular-nums text-center">{item.tonDau}</td>
                                        <td className="tabular-nums text-center text-emerald-600 font-bold">+{item.slNhap}</td>
                                        <td className="tabular-nums text-center text-rose-600 font-bold">-{item.slXuat}</td>
                                        <td className="tabular-nums text-center font-extrabold text-[#003553] text-sm">
                                            {item.tongTon}
                                        </td>
                                        <td>
                                            <span
                                                className={
                                                    item.trangThai === 'Bình thường'
                                                        ? 'medpro-badge-success'
                                                        : item.trangThai?.includes('Sắp hết hạn')
                                                        ? 'medpro-badge-danger'
                                                        : 'medpro-badge-warning'
                                                }
                                            >
                                                {item.trangThai}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Main 2-Column Workspace */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    {/* LEFT PANEL (6 cols): Bảng danh sách danh mục */}
                    <div className="lg:col-span-6 medpro-card p-3.5 flex flex-col h-[calc(100vh-195px)]">
                        <div className="medpro-section-title">
                            <span>
                                DANH SÁCH BẢN GHI ({filteredList.length}) — {catalogRouteMap[loaiDanhMuc]?.title?.toUpperCase()}
                            </span>
                        </div>

                    <div className="mb-3 relative">
                        <MagnifyingGlass
                            size={14}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Tìm kiếm nhanh theo mã, tên, hoạt chất, khoa phòng..."
                            className="medpro-input !pl-8"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table">
                            <thead>
                                <tr>
                                    <th>STT</th>
                                    <th>Mã / Ký hiệu</th>
                                    <th>Tên / Nội dung danh mục</th>
                                    <th>Thông tin phụ</th>
                                    <th>TT</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredList.map((item, idx) => {
                                    const code =
                                        item.ma || item.maTinh || item.maPhong || item.maICD || item.maThuoc || item.maDV
                                    const name =
                                        item.ten ||
                                        item.noiDung ||
                                        item.tenTinh ||
                                        item.tenPhong ||
                                        item.tenBenh ||
                                        item.tenThuoc ||
                                        item.tenDV
                                    const extra =
                                        item.donGiaMacDinh
                                            ? `${Number(item.donGiaMacDinh).toLocaleString('vi-VN')} đ`
                                            : item.donGia
                                            ? `${Number(item.donGia).toLocaleString('vi-VN')} đ`
                                            : item.quanHuyen
                                            ? `${item.quanHuyen} - ${item.phuongXa}`
                                            : item.chuyenKhoa || item.chuongBenh || item.moTa || ''

                                    return (
                                        <tr
                                            key={item.id}
                                            onClick={() => setForm({ ...item })}
                                            className={`cursor-pointer ${
                                                form.id === item.id ? '!bg-[#E8F4FD] font-semibold border-l-4 border-l-[#00B5F1]' : ''
                                            }`}
                                        >
                                            <td className="tabular-nums text-center font-bold">{idx + 1}</td>
                                            <td className="font-mono font-bold text-[#00B5F1]">{code}</td>
                                            <td className="font-semibold text-[#12263F]">{name}</td>
                                            <td className="text-xs text-slate-600">{extra}</td>
                                            <td>
                                                <StatusBadge status={item.trangThai !== false ? 'Hiển thị' : 'Ẩn'} compact />
                                            </td>
                                        </tr>
                                    )
                                })}
                                {filteredList.length === 0 && (
                                    <tr>
                                        <td colSpan={5}>
                                            <EmptyState icon="Folders" title="Không tìm thấy bản ghi danh mục" />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RIGHT PANEL (6 cols): Biểu mẫu Thêm / Sửa / Xóa chi tiết */}
                <div className="lg:col-span-6 medpro-card p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8F4FD] pb-3">
                        <div>
                            <h2 className="font-display font-extrabold text-base text-[#003553] uppercase">
                                CHI TIẾT BẢN GHI DANH MỤC (VIDEO 07)
                            </h2>
                            <p className="text-xs text-slate-500">
                                Chỉnh sửa hoặc thêm mới dữ liệu chuẩn hóa dùng chung toàn phòng khám
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={handleNewItem} className="medpro-btn-outline text-xs">
                                <Plus size={14} weight="bold" className="text-[#00B5F1]" />
                                <span>Làm mới / Tạo mới</span>
                            </button>
                            <button type="button" onClick={handleSaveItem} className="medpro-btn-primary text-xs">
                                <FloppyDisk size={15} weight="bold" />
                                <span>Lưu danh mục</span>
                            </button>
                            {form.id && (
                                <button type="button" onClick={handleDeleteItem} className="medpro-btn-danger text-xs">
                                    <Trash size={14} weight="bold" />
                                    <span>Xóa</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Dynamic Fields by Active Catalog Type */}
                    {activeCatalogKey === 'diaChi' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="medpro-label">Mã Tỉnh / Thành phố</label>
                                <input
                                    type="text"
                                    value={form.maTinh || ''}
                                    onChange={(e) => setForm({ ...form, maTinh: e.target.value })}
                                    className="medpro-input font-mono font-bold"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Tên Tỉnh / Thành phố *</label>
                                <input
                                    type="text"
                                    value={form.tenTinh || ''}
                                    onChange={(e) => setForm({ ...form, tenTinh: e.target.value })}
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Quận / Huyện *</label>
                                <input
                                    type="text"
                                    value={form.quanHuyen || ''}
                                    onChange={(e) => setForm({ ...form, quanHuyen: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Phường / Xã *</label>
                                <input
                                    type="text"
                                    value={form.phuongXa || ''}
                                    onChange={(e) => setForm({ ...form, phuongXa: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                        </div>
                    )}

                    {activeCatalogKey === 'khoaPhong' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="medpro-label">Mã phòng khám</label>
                                <input
                                    type="text"
                                    value={form.maPhong || ''}
                                    onChange={(e) => setForm({ ...form, maPhong: e.target.value })}
                                    className="medpro-input font-mono font-bold"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Tên Khoa / Phòng khám *</label>
                                <input
                                    type="text"
                                    value={form.tenPhong || ''}
                                    onChange={(e) => setForm({ ...form, tenPhong: e.target.value })}
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Chuyên khoa phụ trách</label>
                                <input
                                    type="text"
                                    value={form.chuyenKhoa || ''}
                                    onChange={(e) => setForm({ ...form, chuyenKhoa: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Vị trí tầng</label>
                                <input
                                    type="text"
                                    value={form.tang || ''}
                                    onChange={(e) => setForm({ ...form, tang: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Bác sĩ phụ trách chuyên môn phòng</label>
                                <input
                                    type="text"
                                    value={form.bacSiPhuTrach || ''}
                                    onChange={(e) => setForm({ ...form, bacSiPhuTrach: e.target.value })}
                                    className="medpro-input font-semibold text-[#003553]"
                                />
                            </div>
                        </div>
                    )}

                    {activeCatalogKey === 'danhMucBenh' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="medpro-label">Mã bệnh Quốc tế ICD-10 *</label>
                                <input
                                    type="text"
                                    value={form.maICD || ''}
                                    onChange={(e) => setForm({ ...form, maICD: e.target.value })}
                                    className="medpro-input font-mono font-bold text-[#00B5F1]"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Chương bệnh ICD-10</label>
                                <input
                                    type="text"
                                    value={form.chuongBenh || ''}
                                    onChange={(e) => setForm({ ...form, chuongBenh: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Tên bệnh lý chuẩn Bộ Y tế *</label>
                                <input
                                    type="text"
                                    value={form.tenBenh || ''}
                                    onChange={(e) => setForm({ ...form, tenBenh: e.target.value })}
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                                <input
                                    id="chk-truyennhiem"
                                    type="checkbox"
                                    checked={Boolean(form.truyenNhiem)}
                                    onChange={(e) => setForm({ ...form, truyenNhiem: e.target.checked })}
                                    className="w-4 h-4 accent-[#00B5F1]"
                                />
                                <label htmlFor="chk-truyennhiem" className="text-xs font-bold text-rose-600 cursor-pointer">
                                    Thuộc nhóm Bệnh truyền nhiễm bắt buộc cảnh báo dịch tễ (LAW-01)
                                </label>
                            </div>
                        </div>
                    )}

                    {activeCatalogKey === 'thuocVatTu' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="medpro-label">Mã thuốc / Vật tư *</label>
                                <input
                                    type="text"
                                    value={form.maThuoc || ''}
                                    onChange={(e) => setForm({ ...form, maThuoc: e.target.value })}
                                    className="medpro-input font-mono font-bold"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Nhóm dược lý / Vật tư</label>
                                <input
                                    type="text"
                                    value={form.nhomThuoc || ''}
                                    onChange={(e) => setForm({ ...form, nhomThuoc: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Tên thương mại thuốc / Vật tư *</label>
                                <input
                                    type="text"
                                    value={form.tenThuoc || ''}
                                    onChange={(e) => setForm({ ...form, tenThuoc: e.target.value })}
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Hoạt chất & Hàm lượng (Chuẩn Liên thông Đơn thuốc QG)</label>
                                <input
                                    type="text"
                                    value={form.hoatChat || ''}
                                    onChange={(e) => setForm({ ...form, hoatChat: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Đơn vị tính</label>
                                <input
                                    type="text"
                                    value={form.dvt || ''}
                                    onChange={(e) => setForm({ ...form, dvt: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Đơn giá (VNĐ)</label>
                                <input
                                    type="number"
                                    value={form.donGia || 0}
                                    onChange={(e) => setForm({ ...form, donGia: Number(e.target.value) })}
                                    className="medpro-input tabular-nums font-bold"
                                />
                            </div>
                        </div>
                    )}

                    {activeCatalogKey === 'dichVu' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="medpro-label">Mã dịch vụ kỹ thuật *</label>
                                <input
                                    type="text"
                                    value={form.maDV || ''}
                                    onChange={(e) => setForm({ ...form, maDV: e.target.value })}
                                    className="medpro-input font-mono font-bold"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Nhóm dịch vụ</label>
                                <input
                                    type="text"
                                    value={form.nhomDV || ''}
                                    onChange={(e) => setForm({ ...form, nhomDV: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Tên dịch vụ khám / Cận lâm sàng *</label>
                                <input
                                    type="text"
                                    value={form.tenDV || ''}
                                    onChange={(e) => setForm({ ...form, tenDV: e.target.value })}
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Đơn giá niêm yết (VNĐ)</label>
                                <input
                                    type="number"
                                    value={form.donGia || 0}
                                    onChange={(e) => setForm({ ...form, donGia: Number(e.target.value) })}
                                    className="medpro-input tabular-nums font-bold text-[#003553]"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Phòng thực hiện mặc định</label>
                                <input
                                    type="text"
                                    value={form.phongTH || ''}
                                    onChange={(e) => setForm({ ...form, phongTH: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                        </div>
                    )}

                    {loaiDanhMuc === 'chung' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="medpro-label">Mã ký hiệu / Mã gõ tắt *</label>
                                <input
                                    type="text"
                                    value={form.ma || ''}
                                    onChange={(e) => setForm({ ...form, ma: e.target.value })}
                                    className="medpro-input font-mono font-bold text-[#00B5F1]"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Thứ tự sắp xếp</label>
                                <input
                                    type="number"
                                    value={form.thuTu || 1}
                                    onChange={(e) => setForm({ ...form, thuTu: Number(e.target.value) })}
                                    className="medpro-input tabular-nums"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Tên / Nội dung diễn giải *</label>
                                <input
                                    type="text"
                                    value={form.ten || form.noiDung || ''}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            ten: e.target.value,
                                            noiDung: e.target.value,
                                        })
                                    }
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            {activeGeneralSubTab === 'khoanThu' && (
                                <div className="sm:col-span-2">
                                    <label className="medpro-label">Đơn giá mặc định (VNĐ)</label>
                                    <input
                                        type="number"
                                        value={form.donGiaMacDinh || 0}
                                        onChange={(e) => setForm({ ...form, donGiaMacDinh: Number(e.target.value) })}
                                        className="medpro-input tabular-nums font-bold"
                                    />
                                </div>
                            )}
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Mô tả / Ghi chú áp dụng</label>
                                <textarea
                                    rows={3}
                                    value={form.moTa || ''}
                                    onChange={(e) => setForm({ ...form, moTa: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
            )}
        </div>
    )
}

