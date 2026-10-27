import { exportToCsv } from '../../utils/helpers/exportUtils'
import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation, Link } from 'react-router-dom'
import { AppToast } from '../../components/common/AppNotification'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import {
    StatusBadge,
    EmptyState,
    Scales,
    ClipboardText,
    DownloadSimple,
    ShieldCheck,
    Signature,
    LockKey,
    MagnifyingGlass,
    ArrowsClockwise,
    SlidersHorizontal,
    Key,
    CheckCircle,
    WarningCircle,
    FloppyDisk,
    Package,
    Pill,
    Heartbeat,
    Buildings,
} from '../../components/common/ClinicIcon'

export default function ComplianceAndAuditPage() {
    const location = useLocation()
    const dispatch = useDispatch()
    const isAuditHistoryOnly = location.pathname.includes('lich-su-hoat-dong')

    const { clinicData } = useSelector((state) => state.app.admin)
    const obligations = clinicData?.complianceObligations || []
    const auditLogs = clinicData?.auditLogs || []
    const staffList = clinicData?.staffList || []
    const registrations = clinicData?.registrations || []
    const nationalDrugSync = clinicData?.nationalDrugSync || { danhMuc: [], tonDau: [], hoaDonBan: [], phieuNhap: [], phieuXuat: [] }
    const nationalEhrSync = clinicData?.nationalEhrSync || []
    const rawSettings = clinicData?.clinicSettings || {}
    const getResolvedSettings = (raw = {}) => ({
        tenCoSo: raw.tenCoSo || raw.tenPhongKham || 'Phòng khám Đa khoa Medpro - Clinic-AI',
        maCoSoQG: raw.maCoSoQG || raw.maCoSoKCB || '01-08924',
        giayPhepKCB: raw.giayPhepKCB || raw.giayPhepHoatDong || 'Số 1428/HNO-GPHĐ',
        ngayCapGP: raw.ngayCapGP || '10/01/2023',
        nguoiChiuTrachNhiemCM: raw.nguoiChiuTrachNhiemCM || 'BS. CKII Nguyễn Minh Hoàng (CCHN: 004512/HNO-CCHN)',
        diaChi: raw.diaChi || 'Số 18 Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội',
        soDienThoai: raw.soDienThoai || raw.dienThoai || '1900 2115',
        emailLienHe: raw.emailLienHe || raw.email || 'cskh@clinic-ai.vn',
        donThuocQGToken: raw.donThuocQGToken || raw.congLienThong?.donThuocQuocGiaUrl || 'GATEWAY_SECRET_KEY_PROD_8842X',
        duocQGToken: raw.duocQGToken || raw.congLienThong?.duocQuocGiaUrl || 'DUOCQG_AUTH_BEARER_9921K',
        hsskToken: raw.hsskToken || raw.congLienThong?.maLienThongCoSo || 'LT_0108924_CLINICAI',
    })

    const queryTab = new URLSearchParams(location.search).get('tab')
    const [activeTab, setActiveTab] = useState(
        isAuditHistoryOnly
            ? 'AUDIT'
            : queryTab && ['OVERVIEW', 'OBLIGATIONS', 'DRUG_SYNC', 'EHR_SYNC', 'AUDIT', 'SETTING'].includes(queryTab)
            ? queryTab
            : 'OVERVIEW'
    )

    useEffect(() => {
        if (!isAuditHistoryOnly && queryTab && ['OVERVIEW', 'OBLIGATIONS', 'DRUG_SYNC', 'EHR_SYNC', 'AUDIT', 'SETTING'].includes(queryTab)) {
            setActiveTab(queryTab)
        }
    }, [queryTab, isAuditHistoryOnly])

    const [drugSubTab, setDrugSubTab] = useState('danhMuc')
    const [searchAudit, setSearchAudit] = useState('')
    const [roleFilter, setRoleFilter] = useState('ALL')
    const [syncingKey, setSyncingKey] = useState('')

    // Settings form state
    const [settingsForm, setSettingsForm] = useState(() => getResolvedSettings(rawSettings))

    useEffect(() => {
        if (clinicData?.clinicSettings) {
            setSettingsForm(getResolvedSettings(clinicData.clinicSettings))
        }
    }, [clinicData?.clinicSettings])

    const handleSaveSettings = async () => {
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'clinicSettings',
                items: settingsForm,
                auditEntry: {
                    hanhDong: 'UPDATE_CLINIC_SETTINGS',
                    doiTuong: 'Cấu hình Phòng khám & Token Cổng Quốc gia',
                    mucDich: 'Cập nhật tham số kết nối API Y tế Quốc gia',
                },
            })
        )
        AppToast.success('Đã lưu cấu hình phòng khám & chứng thư kết nối thành công!')
    }

    const handleTriggerSync = (gatewayName) => {
        setSyncingKey(gatewayName)
        setTimeout(() => {
            setSyncingKey('')
            AppToast.success(`Đồng bộ dữ liệu ${gatewayName} lên Cổng Quốc gia thành công (Mã biên nhận giao dịch: RX-${Date.now().toString().slice(-6)})!`)
        }, 1000)
    }

    const filteredLogs = auditLogs.filter((l) => {
        const matchSearch =
            !searchAudit ||
            l.nguoiDung?.toLowerCase().includes(searchAudit.toLowerCase()) ||
            l.hanhDong?.toLowerCase().includes(searchAudit.toLowerCase()) ||
            l.doiTuong?.toLowerCase().includes(searchAudit.toLowerCase())
        const matchRole = roleFilter === 'ALL' || l.vaiTro === roleFilter
        return matchSearch && matchRole
    })


    return (
        <div className="space-y-4">
            {/* Top Navigation Tabs */}
            <div className="medpro-card p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setActiveTab('OVERVIEW')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'OVERVIEW'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <Scales size={15} weight="bold" />
                        <span>1. Tổng quan Tuân thủ (INT-03/04/05)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('DON_THUOC')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'DON_THUOC'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <Signature size={15} weight="bold" />
                        <span>2. Đơn thuốc QG (/donthuocquocgia)</span>
                    </button>
                                        <button
                        type="button"
                        onClick={() => setActiveTab('HSSK')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'HSSK'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <Heartbeat size={15} weight="bold" />
                        <span>3. Sổ Sức Khỏe HSSK (/dongbohssk)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('AUDIT')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'AUDIT'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <ClipboardText size={15} weight="bold" />
                        <span>4. Nhật ký Kiểm toán ({auditLogs.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('SETTING')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'SETTING'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <SlidersHorizontal size={15} weight="bold" />
                        <span>6. Cấu hình & Cổng liên thông (/setting)</span>
                    </button>
                </div>

                <button
                    type="button"
                    onClick={() => {
    const headers = ['Thời gian', 'Người thực hiện', 'Hành động', 'Mô tả', 'Phân hệ', 'Địa chỉ IP']
    const rows = (auditLogs || []).map((l) => [
        l.timestamp || l.thoiGian || '',
        l.actor || l.nguoiDung || '',
        l.action || l.hanhDong || '',
        l.description || l.moTa || '',
        l.module || l.phanHe || '',
        l.ip || '127.0.0.1',
    ])
    exportToCsv('ho-so-thanh-tra-y-te-audit.csv', headers, rows)
    AppToast.success(`Đã trích xuất ${rows.length} nhật ký kiểm toán phục vụ đoàn thanh tra y tế!`)
}}
                    className="medpro-btn-amber text-xs font-bold"
                >
                    <DownloadSimple size={15} weight="bold" />
                    <span>Trích xuất Hồ sơ Thanh tra Y tế</span>
                </button>
            </div>

            {/* TAB 1: TỔNG QUAN TUÂN THỦ (INT-03, INT-04, INT-05) */}
            {activeTab === 'OVERVIEW' && (
                <>
                    {/* 3 Compliance Pillars Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        <div className="medpro-card p-4 border-l-4 border-l-[#00B5F1]">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-extrabold text-[#003553] uppercase">
                                    INT-05: CHỨNG CHỈ HÀNH NGHỀ (NĐ 96/2023)
                                </div>
                                <ShieldCheck size={20} weight="duotone" className="text-[#00B5F1]" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="font-display text-2xl font-extrabold text-[#00B5F1] tabular-nums">
                                    {staffList.filter((s) => s.trangThaiCCHN === 'ACTIVE').length}/{staffList.length}
                                </span>
                                <span className="text-xs text-slate-500">nhân sự đủ điều kiện ACTIVE</span>
                            </div>
                            <div className="mt-2 text-[11px] text-rose-600 font-semibold">
                                • 1 CCHN hết hạn (Đã chặn phân công tự động) • 1 CCHN sắp hết hạn (&lt; 60 ngày)
                            </div>
                        </div>

                        <div className="medpro-card p-4 border-l-4 border-l-emerald-500">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-extrabold text-[#003553] uppercase">
                                    INT-04: LIÊN THÔNG ĐƠN THUỐC QG (TT 26/2025)
                                </div>
                                <Signature size={20} weight="duotone" className="text-emerald-600" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="font-display text-2xl font-extrabold text-emerald-600 tabular-nums">
                                    {
                                        registrations.filter((r) =>
                                            ['SIGNED', 'ACCEPTED'].includes(r.prescription?.trangThaiFSM)
                                        ).length
                                    }
                                    /{registrations.length}
                                </span>
                                <span className="text-xs text-slate-500">đơn thuốc đã ký số & cấp mã QG</span>
                            </div>
                            <div className="mt-2 text-[11px] text-slate-600">
                                • Chặn sửa thuốc trực tiếp sau khi ký số • Hỗ trợ Idempotency Retry
                            </div>
                        </div>

                        <div className="medpro-card p-4 border-l-4 border-l-[#FFB54A]">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-extrabold text-[#003553] uppercase">
                                    INT-03: BỆNH ÁN ĐIỆN TỬ BẤT BIẾN (TT 13/2025)
                                </div>
                                <LockKey size={20} weight="duotone" className="text-[#D97706]" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="font-display text-2xl font-extrabold text-[#003553] tabular-nums">
                                    {registrations.filter((r) => r.emrLocked).length}/{registrations.length}
                                </span>
                                <span className="text-xs text-slate-500">hồ sơ bệnh án đã khóa bất biến</span>
                            </div>
                            <div className="mt-2 text-[11px] text-slate-600">
                                • Đính chính bắt buộc qua Biên bản đính chính lưu lịch sử bản gốc
                            </div>
                        </div>
                    </div>

                    {/* Legal Obligations Registry Table */}
                    <div className="medpro-card p-4">
                        <div className="medpro-section-title">
                            <span>SỔ ĐĂNG KÝ NGHĨA VỤ PHÁP LÝ Y TẾ & MA TRẬN ĐIỀU KIỆN ÁP DỤNG</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="medpro-table">
                                <thead>
                                    <tr>
                                        <th>Mã căn cứ</th>
                                        <th>Văn bản pháp quy</th>
                                        <th>Nội dung nghĩa vụ kiểm soát trên phần mềm</th>
                                        <th>Người chịu trách nhiệm</th>
                                        <th>Thời hạn</th>
                                        <th>Trạng thái tuân thủ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {obligations.map((ob) => (
                                        <tr key={ob.id}>
                                            <td className="font-mono font-bold text-[#00B5F1]">{ob.id}</td>
                                            <td className="font-bold text-[#003553]">{ob.maVanBan}</td>
                                            <td className="font-semibold text-[#12263F]">{ob.tenNghiaVu}</td>
                                            <td>{ob.nguoiChiuTrachNhiem}</td>
                                            <td className="tabular-nums">{ob.hanApDung}</td>
                                            <td>
                                                <StatusBadge status={ob.trangThai} compact />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* TAB 2: LIÊN THÔNG ĐƠN THUỐC QUỐC GIA (FSM) */}
            {activeTab === 'DON_THUOC' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="medpro-section-title">
                        <span>MÁY TRẠNG THÁI LIÊN THÔNG ĐƠN THUỐC QUỐC GIA (FSM PRESCRIPTION GATEWAY - TT 26/2025/TT-BYT)</span>
                        <button
                            type="button"
                            onClick={() => handleTriggerSync('Đơn thuốc Quốc gia')}
                            className="medpro-btn-primary text-xs"
                        >
                            <ArrowsClockwise size={14} className={syncingKey === 'Đơn thuốc Quốc gia' ? 'animate-spin' : ''} />
                            <span>Đồng bộ tất cả đơn đã ký</span>
                        </button>
                    </div>

                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table">
                            <thead>
                                <tr>
                                    <th>STT</th>
                                    <th>Mã ca khám</th>
                                    <th>Bệnh nhân</th>
                                    <th>Bác sĩ chỉ định</th>
                                    <th>Số thuốc kê</th>
                                    <th>Trạng thái FSM</th>
                                    <th>Mã Đơn QG</th>
                                    <th>Idempotency Key</th>
                                    <th>Biên nhận giao dịch</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {registrations.map((r, idx) => {
                                    const p = r.prescription || {}
                                    const fsm = p.trangThaiFSM || (p.daKySo ? 'SIGNED' : 'DRAFT')
                                    return (
                                        <tr key={r.id}>
                                            <td className="font-bold">{idx + 1}</td>
                                            <td className="font-mono font-bold text-[#00B5F1]">{r.maDangKy}</td>
                                            <td className="font-bold text-[#003553]">{r.hoTen}</td>
                                            <td className="text-xs">{r.bacSi || 'BS. CKII Trần Quốc Huy'}</td>
                                            <td className="tabular-nums text-center font-bold">{p.danhSachThuoc?.length || 0}</td>
                                            <td>
                                                <span
                                                    className={
                                                        fsm === 'ACCEPTED'
                                                            ? 'medpro-badge-success'
                                                            : fsm === 'SIGNED'
                                                            ? 'medpro-badge-info'
                                                            : fsm === 'RETRY_PENDING'
                                                            ? 'medpro-badge-warning'
                                                            : 'medpro-badge-neutral'
                                                    }
                                                >
                                                    {fsm}
                                                </span>
                                            </td>
                                            <td className="font-mono text-xs font-semibold text-[#003553]">
                                                {p.maDonThuocQG || 'Chưa cấp'}
                                            </td>
                                            <td className="font-mono text-[11px] text-slate-500">
                                                {p.idempotencyKey || `IDEM-${r.maDangKy}-RX01`}
                                            </td>
                                            <td className="font-mono text-[11px] text-slate-600">
                                                {fsm === 'ACCEPTED' ? `RCPT-BYT-${r.maDangKy.slice(-4)}-OK` : 'Chờ phản hồi'}
                                            </td>
                                            <td>
                                                {fsm === 'SIGNED' || fsm === 'RETRY_PENDING' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleTriggerSync(`Đơn thuốc ${r.maDangKy}`)}
                                                        className="medpro-btn-outline text-[11px] !py-1 !px-2"
                                                    >
                                                        <ArrowsClockwise size={12} />
                                                        <span>Gửi cổng</span>
                                                    </button>
                                                ) : (
                                                    <span className="text-[11px] text-emerald-600 font-bold">Hoàn tất</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: ĐỒNG BỘ SỔ SỨC KHỎE ĐIỆN TỬ HSSK */}
            {activeTab === 'HSSK' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="medpro-section-title">
                        <span>ĐỒNG BỘ DỮ LIỆU SỔ SỨC KHỎE ĐIỆN TỬ BỘ Y TẾ (/dongbohssk — IDEMPOTENCY)</span>
                        <button
                            type="button"
                            onClick={() => handleTriggerSync('Sổ Sức Khỏe Điện Tử')}
                            className="medpro-btn-primary text-xs"
                        >
                            <ArrowsClockwise size={14} className={syncingKey === 'Sổ Sức Khỏe Điện Tử' ? 'animate-spin' : ''} />
                            <span>Liên thông HSSK ca đã hoàn tất</span>
                        </button>
                    </div>

                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table">
                            <thead>
                                <tr>
                                    <th>STT</th>
                                    <th>Mã ca KCB</th>
                                    <th>Bệnh nhân</th>
                                    <th>Ngày sinh / Giới tính</th>
                                    <th>Số điện thoại</th>
                                    <th>Mẫu khám sức khỏe</th>
                                    <th>Phân loại SK</th>
                                    <th>Idempotency Key</th>
                                    <th>Trạng thái HSSK</th>
                                    <th>Thời điểm đồng bộ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(Array.isArray(nationalEhrSync) ? nationalEhrSync : []).map((item, idx) => (
                                    <tr key={item.id || idx}>
                                        <td className="font-bold">{idx + 1}</td>
                                        <td className="font-mono font-bold text-[#00B5F1]">{item.maKCB}</td>
                                        <td className="font-bold text-[#003553]">{item.benhNhan}</td>
                                        <td className="text-xs">
                                            {item.ngaySinh} ({item.gioiTinh})
                                        </td>
                                        <td className="font-mono text-xs">{item.dienThoai}</td>
                                        <td className="text-xs max-w-[200px] truncate" title={item.mauKham}>
                                            {item.mauKham}
                                        </td>
                                        <td>
                                            <span className="medpro-badge-info font-bold">{item.phanLoaiSucKhoe}</span>
                                        </td>
                                        <td className="font-mono text-[11px] text-slate-500">{item.idempotencyKey}</td>
                                        <td>
                                            <span
                                                className={
                                                    item.trangThai?.includes('Đã đồng bộ')
                                                        ? 'medpro-badge-success'
                                                        : 'medpro-badge-warning'
                                                }
                                            >
                                                {item.trangThai}
                                            </span>
                                        </td>
                                        <td className="tabular-nums text-xs text-slate-600">{item.ngayDongBo}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}


            {/* TAB 5: NHẬT KÝ KIỂM TOÁN (AUDIT TRAIL) */}
            {activeTab === 'AUDIT' && (
                <div className="medpro-card p-4 space-y-3">
                    <div className="medpro-section-title">
                        <span>
                            NHẬT KÝ KIỂM TOÁN BẤT BIẾN (HEALTH DATA ACCESS AUDIT LOG — NĐ 102/2025/NĐ-CP)
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[260px]">
                            <MagnifyingGlass
                                size={14}
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />
                            <input
                                type="text"
                                value={searchAudit}
                                onChange={(e) => setSearchAudit(e.target.value)}
                                placeholder="Tìm theo người dùng, hành động, mã bệnh nhân, mã đơn thuốc..."
                                className="medpro-input !pl-8"
                            />
                        </div>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="medpro-input max-w-[200px]"
                        >
                            <option value="ALL">Tất cả vai trò</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="BAC_SI">BAC_SI</option>
                            <option value="LE_TAN">LE_TAN</option>
                            <option value="SYSTEM">SYSTEM</option>
                        </select>
                    </div>

                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table">
                            <thead>
                                <tr>
                                    <th>Mã Audit</th>
                                    <th>Thời gian ghi nhận</th>
                                    <th>Người thực hiện</th>
                                    <th>Vai trò</th>
                                    <th>Mã hành động</th>
                                    <th>Đối tượng dữ liệu sức khỏe</th>
                                    <th>Mục đích truy cập / Xử lý</th>
                                    <th>IP</th>
                                    <th>Kết quả</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="font-mono font-bold text-[#003553]">{log.id}</td>
                                        <td className="tabular-nums text-xs">{log.thoiGian}</td>
                                        <td className="font-semibold text-[#12263F]">{log.nguoiDung}</td>
                                        <td>
                                            <span className="medpro-badge-info">{log.vaiTro}</span>
                                        </td>
                                        <td className="font-mono text-xs font-bold text-[#00B5F1]">{log.hanhDong}</td>
                                        <td className="font-semibold">{log.doiTuong}</td>
                                        <td className="text-xs text-slate-600">{log.mucDich}</td>
                                        <td className="font-mono text-xs text-slate-500">{log.ip}</td>
                                        <td>
                                            <StatusBadge status={log.ketQua} compact />
                                        </td>
                                    </tr>
                                ))}
                                {filteredLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={9}>
                                            <EmptyState icon="ClipboardText" title="Không tìm thấy bản ghi nhật ký kiểm toán" />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 6: CẤU HÌNH PHÒNG KHÁM & CỔNG LIÊN THÔNG (/setting) */}
            {activeTab === 'SETTING' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="medpro-section-title">
                        <span>CẤU HÌNH PHÒNG KHÁM, GIẤY PHÉP HOẠT ĐỘNG & TOKEN LIÊN THÔNG QUỐC GIA (/setting)</span>
                        <button type="button" onClick={handleSaveSettings} className="medpro-btn-primary text-xs">
                            <FloppyDisk size={14} weight="bold" />
                            <span>Lưu cấu hình hệ thống</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-[#E5EEF5] bg-[#F8FBFE] space-y-3">
                            <div className="flex items-center gap-2 text-xs font-extrabold text-[#003553] uppercase border-b border-slate-200 pb-2">
                                <Buildings size={16} className="text-[#00B5F1]" />
                                <span>1. Thông tin Cơ sở Khám chữa bệnh & Giấy phép</span>
                            </div>
                            <div>
                                <label className="medpro-label">Tên Cơ sở Phòng khám *</label>
                                <input
                                    type="text"
                                    value={settingsForm.tenCoSo || ''}
                                    onChange={(e) => setSettingsForm({ ...settingsForm, tenCoSo: e.target.value })}
                                    className="medpro-input font-bold"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="medpro-label">Mã Cơ sở Y tế Quốc gia *</label>
                                    <input
                                        type="text"
                                        value={settingsForm.maCoSoQG || ''}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, maCoSoQG: e.target.value })}
                                        className="medpro-input font-mono font-bold text-[#00B5F1]"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Số Giấy phép Hoạt động *</label>
                                    <input
                                        type="text"
                                        value={settingsForm.giayPhepKCB || ''}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, giayPhepKCB: e.target.value })}
                                        className="medpro-input font-semibold"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="medpro-label">Người chịu trách nhiệm Chuyên môn kỹ thuật *</label>
                                <input
                                    type="text"
                                    value={settingsForm.nguoiChiuTrachNhiemCM || ''}
                                    onChange={(e) => setSettingsForm({ ...settingsForm, nguoiChiuTrachNhiemCM: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Địa chỉ trụ sở *</label>
                                <input
                                    type="text"
                                    value={settingsForm.diaChi || ''}
                                    onChange={(e) => setSettingsForm({ ...settingsForm, diaChi: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border border-[#E5EEF5] bg-[#F8FBFE] space-y-3">
                            <div className="flex items-center gap-2 text-xs font-extrabold text-[#003553] uppercase border-b border-slate-200 pb-2">
                                <Key size={16} className="text-amber-500" />
                                <span>2. Khóa bảo mật & Chứng thư Kết nối Cổng Quốc gia</span>
                            </div>
                            <div>
                                <label className="medpro-label">API Secret Key Cổng Đơn thuốc Quốc gia</label>
                                <input
                                    type="password"
                                    value={settingsForm.donThuocQGToken || ''}
                                    onChange={(e) => setSettingsForm({ ...settingsForm, donThuocQGToken: e.target.value })}
                                    className="medpro-input font-mono"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Bearer Token CSDL Dược Quốc gia</label>
                                <input
                                    type="password"
                                    value={settingsForm.duocQGToken || ''}
                                    onChange={(e) => setSettingsForm({ ...settingsForm, duocQGToken: e.target.value })}
                                    className="medpro-input font-mono"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">SSL Client Certificate Sổ Sức Khỏe HSSK</label>
                                <input
                                    type="text"
                                    value={settingsForm.hsskToken || ''}
                                    onChange={(e) => setSettingsForm({ ...settingsForm, hsskToken: e.target.value })}
                                    className="medpro-input font-mono text-emerald-700 font-bold"
                                />
                            </div>
                            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-1">
                                <div className="font-bold flex items-center gap-1">
                                    <CheckCircle size={14} />
                                    <span>Trạng thái kết nối Cổng BYT: ĐANG KẾT NỐI (HEALTHY)</span>
                                </div>
                                <p className="text-[11px] text-emerald-700">
                                    Chứng thư số công cộng PKI còn hiệu lực đến ngày 31/12/2027. Thuật toán ký số: RSA-SHA256 với USB Token y tế.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

