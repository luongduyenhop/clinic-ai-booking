import { printDocument, exportToCsv } from '../../utils/helpers/exportUtils'
import { useState, useMemo, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { loadClinicDataAsync, updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../../components/common/AppNotification'
import { getMasterOptions, getFormDefaults } from '../../utils/helpers/clinicConfigHelpers'
import VietQrModal from '../../components/common/VietQrModal'
import { QrCode } from '@phosphor-icons/react'
import {
    StatusBadge,
    EmptyState,
    Receipt,
    Plus,
    FloppyDisk,
    Printer,
    Trash,
    MagnifyingGlass,
    Funnel,
} from '../../components/common/ClinicIcon'

export default function CashierManagementPage() {
    const dispatch = useDispatch()
    const location = useLocation()
    const { clinicData } = useSelector((state) => state.app.admin)

    const [syncTick, setSyncTick] = useState(0)

    const vouchers = useMemo(() => {
        let list = [...(clinicData?.vouchers || [])]
        try {
            const raw = localStorage.getItem('CLINIC_AI_MANAGEMENT_DB_V2_PROMAX')
            if (raw) {
                const parsed = JSON.parse(raw)
                const storedVouchers = parsed?.vouchers || []
                storedVouchers.forEach((sv) => {
                    if (!list.some((v) => v.id === sv.id || v.maPhieu === sv.maPhieu)) {
                        list.unshift(sv)
                    }
                })
            }
        } catch {}
        return list
    }, [clinicData, syncTick])
    const patients = clinicData?.patients || []
    const registrations = clinicData?.registrations || []
    const khoanThuCatalog = clinicData?.catalogs?.khoanThu || []
    const khoanChiCatalog = clinicData?.catalogs?.khoanChi || []

    const masterOptions = getMasterOptions(clinicData)
    const defaults = getFormDefaults(clinicData)
    const paymentMethods = masterOptions.paymentMethods || [
        { value: 'Tiền mặt', label: 'Tiền mặt' },
        { value: 'Chuyển khoản', label: 'Chuyển khoản (VietQR)' },
        { value: 'Thẻ POS', label: 'Thẻ POS' },
    ]
    const voucherTypes = masterOptions.voucherTypes || ['Phiếu thu', 'Phiếu chi']

    const buildEmptyVoucher = (type = voucherTypes[0]) => ({
        id: '',
        maPhieu: `${type === 'Phiếu thu' ? 'PT' : 'PC'}26092200${vouchers.length + 1}`,
        loaiPhieu: type,
        tenPhieu: '',
        maBN: '',
        hoTenBN: '',
        ngayThu: new Date().toISOString().replace('T', ' ').slice(0, 16),
        nguoiThu: defaults.defaultCashier,
        hinhThuc: paymentMethods[0]?.value || 'Tiền mặt',
        daThu: true,
        ghiChu: '',
        items: [],
        tongTien: 0,
    })

    const queryTab = new URLSearchParams(location.search).get('tab')
    const queryType = new URLSearchParams(location.search).get('type')

    const initialTypeFilter = queryType === 'PT' ? 'Phiếu thu' : queryType === 'PC' ? 'Phiếu chi' : 'ALL'
    const [searchText, setSearchText] = useState('')
    const [typeFilter, setTypeFilter] = useState(initialTypeFilter)
    const [isQrModalOpen, setIsQrModalOpen] = useState(false)
    const [qrInvoice, setQrInvoice] = useState(null)

    const handleOpenQr = (voucher) => {
        setQrInvoice(voucher || form)
        setIsQrModalOpen(true)
    }
    const [activeCashierTab, setActiveCashierTab] = useState(
        queryTab && ['THU_CHI', 'KHOA_SO'].includes(queryTab) ? queryTab : 'THU_CHI'
    )

    useEffect(() => {
        if (queryTab && ['THU_CHI', 'KHOA_SO'].includes(queryTab)) {
            setActiveCashierTab(queryTab)
        }
        if (queryType === 'PT') {
            setTypeFilter('Phiếu thu')
        } else if (queryType === 'PC') {
            setTypeFilter('Phiếu chi')
        }
    }, [queryTab, queryType])

    const cashierClosings = clinicData?.cashierClosings || []

    const handleDailyClosing = async () => {
        const now = new Date()
        const totalThu = vouchers
            .filter((v) => v.loaiPhieu === 'Phiếu thu' && v.daThu)
            .reduce((s, v) => s + (Number(v.tongTien) || 0), 0)
        const totalChi = vouchers
            .filter((v) => v.loaiPhieu === 'Phiếu chi' && v.daThu)
            .reduce((s, v) => s + (Number(v.tongTien) || 0), 0)

        const newClosing = {
            id: 'KS-' + Date.now(),
            maKyKhoaSo: 'KS-' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + String(cashierClosings.length + 1).padStart(2, '0'),
            ngayKhoaSo: now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN'),
            nguoiKhoaSo: defaults.defaultCashier || 'Trần Thu Ngân',
            tongThuDichVu: totalThu,
            tongThuThuoc: 0,
            tongChi: totalChi,
            tonQuyCuoiNgay: totalThu - totalChi,
            cheDo: 'Chốt ca trực tiếp',
            trangThai: 'Đã khóa sổ (Hợp lệ)',
        }
        const updated = [newClosing, ...cashierClosings]
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'cashierClosings',
                items: updated,
                auditEntry: {
                    hanhDong: 'DAILY_CLOSING',
                    doiTuong: newClosing.maKyKhoaSo + ' - Số dư: ' + (totalThu - totalChi).toLocaleString('vi-VN') + ' đ',
                    mucDich: 'Khóa sổ ca thu ngân và cân đối quỹ',
                },
            })
        )
        AppToast.success('Đã khóa sổ ca thành công! Tồn quỹ ghi nhận: ' + (totalThu - totalChi).toLocaleString('vi-VN') + ' đ')
    }
    const [form, setForm] = useState(() =>
        queryType === 'PC' ? buildEmptyVoucher('Phiếu chi') : vouchers[0] || buildEmptyVoucher('Phiếu thu')
    )
    const [newItemName, setNewItemName] = useState(khoanThuCatalog[0]?.ten || 'Thu tiền công khám lâm sàng')
    const [newItemAmount, setNewItemAmount] = useState(khoanThuCatalog[0]?.donGiaMacDinh || 120000)
    const [newItemNote, setNewItemNote] = useState('')

    const filteredVouchers = useMemo(() => {
        return vouchers.filter((v) => {
            const matchText =
                !searchText ||
                v.maPhieu?.toLowerCase().includes(searchText.toLowerCase()) ||
                v.hoTenBN?.toLowerCase().includes(searchText.toLowerCase()) ||
                v.tenPhieu?.toLowerCase().includes(searchText.toLowerCase())
            const matchType = typeFilter === 'ALL' || v.loaiPhieu === typeFilter
            return matchText && matchType
        })
    }, [vouchers, searchText, typeFilter])

    const totalThu = vouchers
        .filter((v) => v.loaiPhieu === 'Phiếu thu' && v.daThu)
        .reduce((sum, v) => sum + (Number(v.tongTien) || 0), 0)

    const totalChi = vouchers
        .filter((v) => v.loaiPhieu === 'Phiếu chi' && v.daThu)
        .reduce((sum, v) => sum + (Number(v.tongTien) || 0), 0)

    const handleSelectPatientAutoFill = (maBN) => {
        const patient = patients.find((p) => p.maBN === maBN)
        const reg = registrations.find((r) => r.maBN === maBN)
        const autoItems =
            reg?.services?.map((s, i) => ({
                id: `VI-AUTO-${i + 1}`,
                tenKhoan: s.tenDV,
                soTien: Number(s.thanhTien) || Number(s.donGia) || 0,
                ghiChu: s.phongTH,
            })) || []
        const sum = autoItems.reduce((acc, it) => acc + it.soTien, 0)

        setForm({
            ...form,
            maBN,
            hoTenBN: patient?.hoTen || form.hoTenBN,
            tenPhieu: `Thu viện phí BN ${patient?.hoTen || ''} ${reg ? `(Mã KCB: ${reg.maKCB})` : ''}`,
            items: autoItems.length > 0 ? autoItems : form.items,
            tongTien: autoItems.length > 0 ? sum : form.tongTien,
        })
        if (autoItems.length > 0) {
            AppToast.info(`Đã tự động tổng hợp ${autoItems.length} dịch vụ chỉ định của BN ${patient?.hoTen}!`)
        }
    }

    const handleAddLineItem = () => {
        const amount = Number(newItemAmount) || 0
        if (!newItemName.trim() || amount <= 0) {
            AppToast.warning('Vui lòng nhập tên khoản thu/chi và số tiền hợp lệ!')
            return
        }
        const nextItems = [
            ...(form.items || []),
            {
                id: `VI-${Date.now().toString().slice(-4)}`,
                tenKhoan: newItemName,
                soTien: amount,
                ghiChu: newItemNote,
            },
        ]
        const nextTotal = nextItems.reduce((sum, i) => sum + (Number(i.soTien) || 0), 0)
        setForm({ ...form, items: nextItems, tongTien: nextTotal })
        setNewItemNote('')
    }

    const handleSaveVoucher = async () => {
        if (!form.tenPhieu?.trim()) {
            AppToast.error('Vui lòng nhập Tên phiếu thu / chi!')
            return
        }
        const calculatedTotal = (form.items || []).reduce((sum, i) => sum + (Number(i.soTien) || 0), 0)
        const payload = { ...form, tongTien: calculatedTotal }

        const exists = vouchers.some((v) => v.id === form.id && form.id)
        let updated
        if (exists) {
            updated = vouchers.map((v) => (v.id === form.id ? payload : v))
        } else {
            const newVoucher = { ...payload, id: payload.maPhieu || `PT-${Date.now().toString().slice(-5)}` }
            updated = [newVoucher, ...vouchers]
            setForm(newVoucher)
        }

        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'vouchers',
                items: updated,
                auditEntry: {
                    hanhDong: exists ? 'UPDATE_VOUCHER' : 'CREATE_VOUCHER',
                    doiTuong: `${payload.maPhieu} (${payload.loaiPhieu}) - ${payload.tongTien.toLocaleString('vi-VN')} đ`,
                    mucDich: 'Quản lý thu chi & thanh toán viện phí',
                },
            })
        )
        AppToast.success(exists ? 'Đã cập nhật phiếu thu/chi!' : 'Đã lập phiếu thu/chi mới thành công!')
    }

    const handleDeleteVoucher = async () => {
        if (!form.id) return
        const updated = vouchers.filter((v) => v.id !== form.id)
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'vouchers',
                items: updated,
                auditEntry: {
                    hanhDong: 'DELETE_VOUCHER',
                    doiTuong: `${form.maPhieu} - ${form.tenPhieu}`,
                    mucDich: 'Hủy phiếu thu/chi nháp',
                },
            })
        )
        setForm(updated[0] || buildEmptyVoucher('Phiếu thu'))
        AppToast.info('Đã xóa phiếu thu/chi!')
    }

    return (
        <div className="space-y-3.5">
            {/* Top Sub-tabs: Thu chi vs Khóa sổ */}
            <div className="medpro-card p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setActiveCashierTab('THU_CHI')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                            activeCashierTab === 'THU_CHI'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <Receipt size={15} weight="bold" />
                        <span>1. Quản lý Thu chi & Viện phí ({vouchers.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveCashierTab('KHOA_SO')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                            activeCashierTab === 'KHOA_SO'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <FloppyDisk size={15} weight="bold" />
                        <span>2. Quản lý Khóa sổ cuối ngày (/khoaso) ({cashierClosings.length})</span>
                    </button>
                </div>
                {activeCashierTab === 'KHOA_SO' && (
                    <button
                        type="button"
                        onClick={handleDailyClosing}
                        className="medpro-btn-primary text-xs"
                    >
                        <span>Khóa sổ ca hôm nay</span>
                    </button>
                )}
            </div>

            {activeCashierTab === 'KHOA_SO' ? (
                <div className="medpro-card p-4 space-y-4">
                    <div className="medpro-section-title">
                        <span>NHẬT KÝ KHÓA SỔ TỰ ĐỘNG & TỒN QUỸ PHÒNG KHÁM (/khoaso)</span>
                    </div>
                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table">
                            <thead>
                                <tr>
                                    <th>Mã kỳ khóa sổ</th>
                                    <th>Thời điểm khóa sổ</th>
                                    <th>Thu ngân phụ trách</th>
                                    <th>Thu dịch vụ kỹ thuật</th>
                                    <th>Thu tiền thuốc</th>
                                    <th>Tổng chi quỹ</th>
                                    <th>Tồn quỹ cuối ca</th>
                                    <th>Cơ chế</th>
                                    <th>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cashierClosings.map((ks) => (
                                    <tr key={ks.id}>
                                        <td className="font-mono font-bold text-[#00B5F1]">{ks.maKyKhoaSo}</td>
                                        <td className="tabular-nums text-xs font-semibold">{ks.ngayKhoaSo}</td>
                                        <td className="font-bold text-[#003553]">{ks.nguoiKhoaSo}</td>
                                        <td className="tabular-nums font-mono">{(ks.tongThuDichVu || 0).toLocaleString('vi-VN')} đ</td>
                                        <td className="tabular-nums font-mono">{(ks.tongThuThuoc || 0).toLocaleString('vi-VN')} đ</td>
                                        <td className="tabular-nums font-mono text-rose-600">-{(ks.tongChi || 0).toLocaleString('vi-VN')} đ</td>
                                        <td className="tabular-nums font-mono font-black text-[#003553]">
                                            {(ks.tonQuyCuoiNgay || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="text-xs text-slate-500">{ks.cheDo}</td>
                                        <td>
                                            <span className={ks.trangThai?.includes('Đã khóa') ? 'medpro-badge-success' : 'medpro-badge-warning'}>
                                                {ks.trangThai}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    {/* LEFT PANEL (4 cols): Danh sách phiếu thu / chi */}
                    <div className="lg:col-span-4 medpro-card p-3.5 flex flex-col h-[calc(100vh-140px)]">
                <div className="medpro-section-title">
                    <span className="inline-flex items-center gap-1.5">
                        <Receipt size={16} weight="duotone" className="text-[#00B5F1]" />
                        <span>DANH SÁCH PHIẾU THU - CHI ({filteredVouchers.length})</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => setForm(buildEmptyVoucher('Phiếu thu'))}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00B5F1] hover:underline cursor-pointer"
                    >
                        <Plus size={13} weight="bold" />
                        <span>Lập phiếu mới</span>
                    </button>
                </div>

                <div className="grid grid-cols-12 gap-2 mb-3">
                    <div className="col-span-7 relative">
                        <MagnifyingGlass
                            size={14}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Tìm Mã phiếu, Tên BN..."
                            className="medpro-input !pl-8"
                        />
                    </div>
                    <div className="col-span-5 relative">
                        <Funnel
                            size={13}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="medpro-input !pl-7"
                        >
                            <option value="ALL">Tất cả loại phiếu</option>
                            {voucherTypes.map((vt) => (
                                <option key={vt} value={vt}>
                                    {vt}
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
                                <th>Mã phiếu</th>
                                <th>Loại</th>
                                <th>Người nộp/nhận</th>
                                <th>Tổng tiền</th>
                                <th className="text-center">TT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredVouchers.map((v, idx) => (
                                <tr
                                    key={v.id}
                                    onClick={() => setForm({ ...v })}
                                    className={`cursor-pointer ${
                                        form.id === v.id ? '!bg-[#E8F4FD] font-semibold border-l-4 border-l-[#00B5F1]' : ''
                                    }`}
                                >
                                    <td className="tabular-nums text-center font-bold">{idx + 1}</td>
                                    <td className="font-mono text-[11px] font-bold text-[#00B5F1]">{v.maPhieu}</td>
                                    <td>
                                        <span
                                            className={
                                                v.loaiPhieu === 'Phiếu thu'
                                                    ? 'medpro-badge-success'
                                                    : 'medpro-badge-warning'
                                            }
                                        >
                                            {v.loaiPhieu}
                                        </span>
                                    </td>
                                    <td className="font-semibold text-[#12263F]">{v.hoTenBN}</td>
                                    <td className="tabular-nums font-bold text-[#003553]">
                                        {Number(v.tongTien).toLocaleString('vi-VN')} đ
                                    </td>
                                    <td className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <StatusBadge status={v.daThu ? 'Đã thu' : 'Chờ thu'} showText={false} />
                                            {v.loaiPhieu === 'Phiếu thu' && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleOpenQr(v)
                                                    }}
                                                    className="p-1 text-teal-600 hover:text-teal-900 transition cursor-pointer"
                                                    title="Mã VietQR"
                                                >
                                                    <QrCode size={13} weight="bold" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredVouchers.length === 0 && (
                                <tr>
                                    <td colSpan={6}>
                                        <EmptyState
                                            icon="Receipt"
                                            title="Không tìm thấy phiếu thu/chi"
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Summary Footer matching Video 05 */}
                <div className="pt-2.5 grid grid-cols-2 gap-2 text-xs font-bold border-t border-slate-100 mt-2">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 flex justify-between">
                        <span>Tổng thu:</span>
                        <span className="tabular-nums">{totalThu.toLocaleString('vi-VN')} đ</span>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-50 text-amber-700 flex justify-between">
                        <span>Tổng chi:</span>
                        <span className="tabular-nums">{totalChi.toLocaleString('vi-VN')} đ</span>
                    </div>
                </div>
            </div>

            {/* RIGHT PANEL (8 cols): Chi tiết Phiếu thu / Phiếu chi & Bảng khoản mục */}
            <div className="lg:col-span-8 medpro-card p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E8F4FD]">
                    <div>
                        <h2 className="font-display text-base font-extrabold text-[#003553] uppercase">
                            QUẢN LÝ THU CHI & VIỆN PHÍ PHÒNG KHÁM (VIDEO 05)
                        </h2>
                        <p className="text-xs text-slate-500">
                            Lập phiếu thu viện phí tự động từ chỉ định dịch vụ, phiếu chi vật tư & in biên lai thu tiền
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setForm(buildEmptyVoucher('Phiếu thu'))}
                            className="medpro-btn-outline text-xs"
                        >
                            <Plus size={14} weight="bold" className="text-[#00B5F1]" />
                            <span>Phiếu thu mới</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setForm(buildEmptyVoucher('Phiếu chi'))}
                            className="medpro-btn-outline text-xs"
                        >
                            <Plus size={14} weight="bold" className="text-amber-600" />
                            <span>Phiếu chi mới</span>
                        </button>
                        <button type="button" onClick={handleSaveVoucher} className="medpro-btn-primary text-xs">
                            <FloppyDisk size={15} weight="bold" />
                            <span>Lưu phiếu</span>
                        </button>
                        {form.loaiPhieu === 'Phiếu thu' && (
                            <button
                                type="button"
                                onClick={() => handleOpenQr(form)}
                                className="medpro-btn-outline text-xs font-bold border-teal-500 text-teal-700 hover:bg-teal-50 flex items-center gap-1.5 cursor-pointer"
                                title="Tạo mã QR thanh toán viện phí NAPAS 247"
                            >
                                <QrCode size={15} weight="bold" />
                                <span>Mã VietQR</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => { printDocument(); AppToast.success(`Đang mở lệnh in Biên lai ${form.maPhieu}...`); }}
                            className="medpro-btn-amber text-xs font-bold"
                        >
                            <Printer size={15} weight="bold" />
                            <span>In phiếu thu/chi</span>
                        </button>
                        {form.id && (
                            <button type="button" onClick={handleDeleteVoucher} className="medpro-btn-danger text-xs">
                                <Trash size={14} weight="bold" />
                                <span>Xóa</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Section 1: Thông tin chung phiếu thu/chi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                        <label className="medpro-label">Loại chứng từ</label>
                        <select
                            value={form.loaiPhieu || voucherTypes[0]}
                            onChange={(e) => setForm({ ...form, loaiPhieu: e.target.value })}
                            className="medpro-input font-bold text-[#003553]"
                        >
                            {voucherTypes.map((vt) => (
                                <option key={vt} value={vt}>
                                    {vt}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="medpro-label">Mã phiếu</label>
                        <input
                            type="text"
                            value={form.maPhieu || ''}
                            onChange={(e) => setForm({ ...form, maPhieu: e.target.value })}
                            className="medpro-input font-mono font-bold"
                        />
                    </div>
                    <div>
                        <label className="medpro-label">Chọn Bệnh nhân (Tự động lấy dịch vụ)</label>
                        <select
                            value={form.maBN || ''}
                            onChange={(e) => handleSelectPatientAutoFill(e.target.value)}
                            className="medpro-input font-semibold"
                        >
                            <option value="">-- Chọn BN hoặc nhập tay --</option>
                            {patients.map((p) => (
                                <option key={p.id} value={p.maBN}>
                                    {p.maBN} — {p.hoTen}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="medpro-label">Họ tên người nộp / Đơn vị nhận</label>
                        <input
                            type="text"
                            value={form.hoTenBN || ''}
                            onChange={(e) => setForm({ ...form, hoTenBN: e.target.value })}
                            className="medpro-input font-semibold"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="medpro-label">Tên phiếu / Nội dung chứng từ *</label>
                        <input
                            type="text"
                            value={form.tenPhieu || ''}
                            onChange={(e) => setForm({ ...form, tenPhieu: e.target.value })}
                            placeholder="VD: Thu viện phí BN Nguyễn Thị B..."
                            className="medpro-input font-semibold"
                        />
                    </div>
                    <div>
                        <label className="medpro-label">Hình thức thanh toán</label>
                        <select
                            value={form.hinhThuc || paymentMethods[0]?.value}
                            onChange={(e) => setForm({ ...form, hinhThuc: e.target.value })}
                            className="medpro-input"
                        >
                            {paymentMethods.map((pm) => (
                                <option key={pm.value} value={pm.value}>
                                    {pm.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="medpro-label">Trạng thái thu/chi</label>
                        <div className="h-[34px] flex items-center gap-2 px-3 rounded border border-[#CBD5E1] bg-[#F8FBFE]">
                            <input
                                id="chk-dathu"
                                type="checkbox"
                                checked={Boolean(form.daThu)}
                                onChange={(e) => setForm({ ...form, daThu: e.target.checked })}
                                className="w-4 h-4 accent-[#00B5F1]"
                            />
                            <label htmlFor="chk-dathu" className="text-xs font-bold text-[#003553] cursor-pointer">
                                {form.daThu ? 'Đã thu / Đã thanh toán' : 'Chưa thu (Đang chờ)'}
                            </label>
                        </div>
                    </div>
                </div>

                {/* Section 2: Chi tiết các khoản thu / chi */}
                <div>
                    <div className="medpro-section-title">
                        <span>CHI TIẾT CÁC KHOẢN MỤC TRONG PHIẾU ({form.items?.length || 0} KHOẢN)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end mb-3 p-3 rounded-xl bg-[#F8FBFE] border border-[#CBE9FA]">
                        <div className="sm:col-span-5">
                            <label className="medpro-label">Chọn hoặc nhập tên khoản mục</label>
                            <input
                                type="text"
                                list="khoan-muc-datalist"
                                value={newItemName}
                                onChange={(e) => {
                                    setNewItemName(e.target.value)
                                    const matched = khoanThuCatalog.find((k) => k.ten === e.target.value)
                                    if (matched) setNewItemAmount(matched.donGiaMacDinh)
                                }}
                                className="medpro-input"
                            />
                            <datalist id="khoan-muc-datalist">
                                {(form.loaiPhieu === 'Phiếu thu' ? khoanThuCatalog : khoanChiCatalog).map((k) => (
                                    <option key={k.id} value={k.ten} />
                                ))}
                            </datalist>
                        </div>
                        <div className="sm:col-span-3">
                            <label className="medpro-label">Số tiền (VNĐ)</label>
                            <input
                                type="number"
                                value={newItemAmount}
                                onChange={(e) => setNewItemAmount(e.target.value)}
                                className="medpro-input tabular-nums font-bold"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="medpro-label">Ghi chú</label>
                            <input
                                type="text"
                                value={newItemNote}
                                onChange={(e) => setNewItemNote(e.target.value)}
                                className="medpro-input"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <button type="button" onClick={handleAddLineItem} className="medpro-btn-primary w-full text-xs">
                                <Plus size={14} weight="bold" />
                                <span>Thêm khoản</span>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table">
                            <thead>
                                <tr>
                                    <th>STT</th>
                                    <th>Nội dung khoản thu / chi</th>
                                    <th>Số tiền (VNĐ)</th>
                                    <th>Ghi chú</th>
                                    <th>Xóa</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(form.items || []).map((it, idx) => (
                                    <tr key={it.id}>
                                        <td className="tabular-nums font-bold">{idx + 1}</td>
                                        <td className="font-semibold text-[#12263F]">{it.tenKhoan}</td>
                                        <td className="tabular-nums font-bold text-[#003553]">
                                            {Number(it.soTien).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td>{it.ghiChu}</td>
                                        <td>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const nextItems = form.items.filter((x) => x.id !== it.id)
                                                    const nextTotal = nextItems.reduce(
                                                        (sum, x) => sum + (Number(x.soTien) || 0),
                                                        0
                                                    )
                                                    setForm({ ...form, items: nextItems, tongTien: nextTotal })
                                                }}
                                                className="inline-flex items-center gap-1 text-rose-600 text-xs font-bold hover:underline cursor-pointer"
                                            >
                                                <Trash size={13} weight="bold" />
                                                <span>Xóa</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {(!form.items || form.items.length === 0) && (
                                    <tr>
                                        <td colSpan={5}>
                                            <EmptyState
                                                icon="Receipt"
                                                title="Chưa có khoản mục thu/chi"
                                                description="Chọn bệnh nhân để tự động lấy dịch vụ hoặc thêm khoản mục ở trên."
                                            />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-3 p-3.5 rounded-xl bg-[#003553] text-white flex items-center justify-between">
                        <span className="font-bold text-xs uppercase tracking-wider">
                            TỔNG CỘNG SỐ TIỀN TRÊN PHIẾU ({form.loaiPhieu?.toUpperCase()}):
                        </span>
                        <span className="font-display text-xl font-extrabold text-[#FFB54A] tabular-nums">
                            {Number(form.tongTien || 0).toLocaleString('vi-VN')} VNĐ
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )}

    {/* Modal VietQR thanh toán (Lát cắt D) */}
    <VietQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        invoice={qrInvoice || form}
    />
</div>

    )
}


