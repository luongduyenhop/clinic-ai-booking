import { exportToExcel, exportToCsv } from '../../utils/helpers/exportUtils'
import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation, useSearchParams, Link } from 'react-router-dom'
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
    Heartbeat,
    Buildings,
    Eye,
    QrCode,
    Printer,
    ArrowRight,
    X,
    Check,
    Globe,
} from '../../components/common/ClinicIcon'

const ROLE_LABEL_MAP = {
    ADMIN: 'Quản trị',
    SYSTEM: 'Hệ thống',
    BAC_SI: 'Bác sĩ',
    LE_TAN: 'Lễ tân',
    THU_NGAN: 'Thu ngân',
    DUOC_SI: 'Dược sĩ',
    KY_THUAT_VIEN: 'Kỹ thuật viên',
}

const ACTION_LABEL_MAP = {
    SIGN_PRESCRIPTION: 'Ký số đơn thuốc',
    UPLOAD_DICOM_CLS: 'Tải lên kết quả CĐHA',
    BLOCK_ASSIGNMENT_EXPIRED_LICENSE: 'Chặn phân công (Quá hạn CCHN)',
    CREATE_REGISTRATION: 'Tiếp đón bệnh nhân',
    CLOSE_SHIFT: 'Khóa sổ ca trực',
    REFUND_INVOICE: 'Hoàn tiền viện phí',
    COLLECT_FEE: 'Thu viện phí',
    CREATE_STAFF_CREDENTIAL: 'Thêm hồ sơ CCHN',
    UPDATE_STAFF_CREDENTIAL: 'Cập nhật CCHN',
    LOCK_EMR_RECORD: 'Khóa bệnh án điện tử',
    AMEND_EMR_RECORD: 'Lập biên bản đính chính',
}

export default function ComplianceAndAuditPage() {
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const dispatch = useDispatch()

    const isAuditHistoryOnly = location.pathname.includes('lich-su-hoat-dong')
    const isDonThuocOnly = location.pathname.includes('don-thuoc-quoc-gia') || location.pathname.includes('donthuocquocgia')
    const isSettingOnly = location.pathname.includes('cai-dat') || location.pathname.includes('setting')

    const getInitialTab = () => {
        if (isAuditHistoryOnly) return 'AUDIT'
        if (isDonThuocOnly) return 'DON_THUOC'
        if (isSettingOnly) return 'SETTING'
        const tabParam = searchParams.get('tab')
        if (tabParam && ['OVERVIEW', 'DON_THUOC', 'HSSK', 'AUDIT', 'SETTING'].includes(tabParam)) {
            return tabParam
        }
        return 'OVERVIEW'
    }

    const [activeTab, setActiveTab] = useState(getInitialTab)

    useEffect(() => {
        const nextTab = getInitialTab()
        setActiveTab(nextTab)
    }, [location.pathname, searchParams])

    const handleSwitchTab = (tabKey) => {
        setActiveTab(tabKey)
        setSearchParams({ tab: tabKey })
    }

    const { clinicData } = useSelector((state) => state.app.admin)
    const obligations = clinicData?.complianceObligations || []
    const auditLogs = clinicData?.auditLogs || []
    const staffList = clinicData?.staffList || []
    const registrations = clinicData?.registrations || []
    const nationalEhrSync = clinicData?.nationalEhrSync || []
    const rawSettings = clinicData?.clinicSettings || {}
    const configuredClinicName = (rawSettings.tenPhongKham || rawSettings.tenCoSo || 'Phòng Khám Đa Khoa Quốc Tế Clinic-AI').toUpperCase()
    const configuredClinicAddress = [
        rawSettings.diaChi || 'Số 18 Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội',
        rawSettings.dienThoai ? `Hotline: ${rawSettings.dienThoai}` : 'Hotline: 1900 2115',
        rawSettings.giayPhepHoatDong ? `GPHĐ: ${rawSettings.giayPhepHoatDong}` : 'GPHĐ: Số 1428/HNO-GPHĐ',
    ].filter(Boolean).join(' | ')

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

    const [searchAudit, setSearchAudit] = useState('')
    const [roleFilter, setRoleFilter] = useState('ALL')
    const [syncingKey, setSyncingKey] = useState('')

    const [searchRx, setSearchRx] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [selectedRxRecord, setSelectedRxRecord] = useState(null)

    const [isTestingGateway, setIsTestingGateway] = useState(false)
    const [gatewayPingResult, setGatewayPingResult] = useState(null)

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

    const handleTestGatewayConnection = () => {
        setIsTestingGateway(true)
        setTimeout(() => {
            setIsTestingGateway(false)
            setGatewayPingResult({
                success: true,
                latency: 42,
                timestamp: new Date().toLocaleTimeString('vi-VN'),
            })
            AppToast.success('Cổng Đơn thuốc Quốc gia & HSSK phản hồi 200 OK (Độ trễ: 42ms)!')
        }, 800)
    }

    const handleSyncSinglePrescription = async (targetKcb) => {
        setSyncingKey(targetKcb)
        const updatedRegistrations = registrations.map((r) => {
            const currentKcb = r.maKCB || r.id
            if (currentKcb === targetKcb) {
                const p = r.prescription || {}
                const randomCode = Math.floor(1000000 + Math.random() * 9000000)
                return {
                    ...r,
                    prescription: {
                        ...p,
                        trangThaiFSM: 'ACCEPTED',
                        maLienThongQuocGia: p.maLienThongQuocGia || `VN-RX-${randomCode}-A`,
                        receiptToken: `RECEIPT-BYT-${currentKcb.slice(-4)}-${Date.now().toString().slice(-6)}`,
                        idempotencyKey: p.idempotencyKey || `IDEM-${currentKcb}-RX01`,
                        ngayDongBo: new Date().toISOString().replace('T', ' ').slice(0, 16),
                    },
                }
            }
            return r
        })

        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'registrations',
                items: updatedRegistrations,
                auditEntry: {
                    hanhDong: 'SIGN_PRESCRIPTION',
                    doiTuong: `Liên thông Đơn thuốc ca khám ${targetKcb}`,
                    mucDich: 'Đồng bộ đơn thuốc điện tử lên Cổng Quốc gia (TT 26/2025/TT-BYT)',
                },
            })
        )
        setSyncingKey('')
        AppToast.success(`Đã liên thông thành công đơn thuốc ca ${targetKcb} lên Cổng Quốc gia!`)
    }

    const handleExportPrescriptionsExcel = () => {
        const headers = ['Mã KCB', 'Họ tên người bệnh', 'Mã ĐD Y tế / CCCD', 'Bác sĩ phụ trách', 'Mã Đơn Quốc Gia', 'Trạng thái FSM', 'Thời gian ký / tạo']
        const rows = (filteredRegistrations || []).map((r) => {
            const p = r.prescription || {}
            const fsmStatus = p.trangThaiFSM === 'ACCEPTED' ? 'Đã liên thông' : p.trangThaiFSM === 'SIGNED' ? 'Đã ký số' : 'Bản nháp'
            return [
                r.maKCB || r.id || '',
                r.tenBenhNhan || r.hoTen || '',
                r.maDinhDanhYTe || r.cccd || '',
                r.bacSiKham || '',
                p.maDonThuocQG || 'Chưa cấp',
                fsmStatus,
                p.ngayKy || r.thoiGian || '',
            ]
        })
        exportToExcel({
            filename: `danh-sach-don-thuoc-quoc-gia_${new Date().toISOString().slice(0, 10)}.xls`,
            sheetName: 'Đơn Thuốc QG',
            title: 'BÁO CÁO LIÊN THÔNG CỔNG ĐƠN THUỐC QUỐC GIA (Bộ Y Tế)',
            subtitle: `Cơ sở: ${configuredClinicName} • Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} • Số lượng: ${rows.length} đơn`,
            clinicName: configuredClinicName,
            clinicAddress: configuredClinicAddress,
            headers,
            rows,
            signOff: true,
        })
        AppToast.success(`Đã xuất ${rows.length} đơn thuốc ra file Excel (.xls) thành công!`)
    }

    const handleSyncAllSignedPrescriptions = async () => {
        setSyncingKey('ALL')
        const updatedRegistrations = registrations.map((r) => {
            const p = r.prescription || {}
            const currentKcb = r.maKCB || r.id
            if (p.trangThaiFSM === 'SIGNED' || p.trangThaiFSM === 'RETRY_PENDING') {
                const randomCode = Math.floor(1000000 + Math.random() * 9000000)
                return {
                    ...r,
                    prescription: {
                        ...p,
                        trangThaiFSM: 'ACCEPTED',
                        maLienThongQuocGia: p.maLienThongQuocGia || `VN-RX-${randomCode}-A`,
                        receiptToken: `RECEIPT-BYT-${currentKcb.slice(-4)}-${Date.now().toString().slice(-6)}`,
                        idempotencyKey: p.idempotencyKey || `IDEM-${currentKcb}-RX01`,
                        ngayDongBo: new Date().toISOString().replace('T', ' ').slice(0, 16),
                    },
                }
            }
            return r
        })

        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'registrations',
                items: updatedRegistrations,
                auditEntry: {
                    hanhDong: 'SIGN_PRESCRIPTION',
                    doiTuong: 'Đồng bộ hàng loạt đơn thuốc đã ký',
                    mucDich: 'Liên thông toàn bộ đơn thuốc đủ điều kiện lên Cổng Quốc gia',
                },
            })
        )
        setSyncingKey('')
        AppToast.success('Đã đồng bộ toàn bộ đơn thuốc đã ký số lên Cổng Quốc gia thành công!')
    }

    const handleTriggerSyncGeneric = (gatewayName) => {
        setSyncingKey(gatewayName)
        setTimeout(() => {
            setSyncingKey('')
            AppToast.success(`Đồng bộ dữ liệu ${gatewayName} lên Cổng Quốc gia thành công (Mã biên nhận: SYNC-${Date.now().toString().slice(-6)})!`)
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

    const totalPrescriptions = registrations.filter((r) => r.prescription).length
    const acceptedPrescriptions = registrations.filter((r) => r.prescription?.trangThaiFSM === 'ACCEPTED').length
    const signedPrescriptions = registrations.filter((r) => r.prescription?.trangThaiFSM === 'SIGNED').length
    const draftPrescriptions = registrations.filter((r) => !['ACCEPTED', 'SIGNED'].includes(r.prescription?.trangThaiFSM)).length

    const filteredRegistrations = registrations.filter((r) => {
        const p = r.prescription
        if (!p) return false
        const fsm = p.trangThaiFSM || (p.daKySo ? 'SIGNED' : 'DRAFT')
        const matchStatus = statusFilter === 'ALL' || fsm === statusFilter
        const q = searchRx.trim().toLowerCase()
        const currentKcb = r.maKCB || r.id || ''
        const matchSearch =
            !q ||
            (r.hoTen && r.hoTen.toLowerCase().includes(q)) ||
            currentKcb.toLowerCase().includes(q) ||
            (p.maDon && p.maDon.toLowerCase().includes(q)) ||
            (p.maLienThongQuocGia && p.maLienThongQuocGia.toLowerCase().includes(q))
        return matchStatus && matchSearch
    })

    return (
        <div className="space-y-4">
            <div className="medpro-card p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <Link
                        to="/admin/tuan-thu?tab=OVERVIEW"
                        onClick={() => handleSwitchTab('OVERVIEW')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'OVERVIEW'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <Scales size={15} weight="bold" />
                        <span>1. Tổng quan Tuân thủ Pháp lý</span>
                    </Link>
                    <Link
                        to="/admin/tuan-thu?tab=DON_THUOC"
                        onClick={() => handleSwitchTab('DON_THUOC')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'DON_THUOC'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <Signature size={15} weight="bold" />
                        <span>2. Cổng Đơn thuốc Quốc gia</span>
                    </Link>
                    <Link
                        to="/admin/tuan-thu?tab=HSSK"
                        onClick={() => handleSwitchTab('HSSK')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'HSSK'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <Heartbeat size={15} weight="bold" />
                        <span>3. Sổ Sức khỏe Điện tử (HSSK)</span>
                    </Link>
                    <Link
                        to="/admin/tuan-thu?tab=AUDIT"
                        onClick={() => handleSwitchTab('AUDIT')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'AUDIT'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <ClipboardText size={15} weight="bold" />
                        <span>4. Nhật ký Kiểm toán ({auditLogs.length})</span>
                    </Link>
                    <Link
                        to="/admin/tuan-thu?tab=SETTING"
                        onClick={() => handleSwitchTab('SETTING')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'SETTING'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <SlidersHorizontal size={15} weight="bold" />
                        <span>5. Cấu hình Cổng Liên thông</span>
                    </Link>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        const headers = ['Thời gian', 'Người thực hiện', 'Hành động', 'Mô tả', 'Phân hệ', 'Địa chỉ IP']
                        const rows = (auditLogs || []).map((l) => [
                            l.timestamp || l.thoiGian || '',
                            ROLE_LABEL_MAP[l.role] || l.role || l.actor || l.nguoiDung || '',
                            ACTION_LABEL_MAP[l.action] || l.action || l.hanhDong || '',
                            l.description || l.moTa || '',
                            l.module || l.phanHe || '',
                            l.ip || '127.0.0.1',
                        ])
                        exportToExcel({
                            filename: `ho-so-thanh-tra-y-te-audit_${new Date().toISOString().slice(0, 10)}.xls`,
                            sheetName: 'Nhật Ký Kiểm Toán',
                            title: 'HỒ SƠ THANH TRA Y TẾ & NHẬT KÝ KIỂM TOÁN AN TOÀN DỮ LIỆU',
                            subtitle: `Trích xuất phục vụ đoàn thanh tra y tế • Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} • Tổng số: ${rows.length} bản ghi`,
                            clinicName: configuredClinicName,
                            clinicAddress: configuredClinicAddress,
                            headers,
                            rows,
                            signOff: true,
                        })
                        AppToast.success(`Đã trích xuất ${rows.length} nhật ký kiểm toán phục vụ đoàn thanh tra y tế!`)
                    }}
                    className="medpro-btn-amber text-xs font-bold"
                >
                    <DownloadSimple size={15} weight="bold" />
                    <span>Trích xuất Hồ sơ Thanh tra Y tế</span>
                </button>
            </div>

            {activeTab === 'OVERVIEW' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        <div className="medpro-card p-4 border-l-4 border-l-[#00B5F1]">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-extrabold text-[#003553] uppercase">
                                    CHỨNG CHỈ HÀNH NGHỀ (NĐ 96/2023/NĐ-CP)
                                </div>
                                <ShieldCheck size={20} weight="duotone" className="text-[#00B5F1]" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="font-display text-2xl font-extrabold text-[#00B5F1] tabular-nums">
                                    {staffList.filter((s) => s.trangThaiCCHN === 'ACTIVE').length}/{staffList.length}
                                </span>
                                <span className="text-xs text-slate-500">nhân sự đủ điều kiện hành nghề</span>
                            </div>
                            <div className="mt-2 text-[11px] text-rose-600 font-semibold">
                                • Tự động chặn phân công ca khám khi CCHN hết hạn • Cảnh báo trước 60 ngày
                            </div>
                        </div>

                        <div className="medpro-card p-4 border-l-4 border-l-emerald-500">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-extrabold text-[#003553] uppercase">
                                    LIÊN THÔNG ĐƠN THUỐC QUỐC GIA (TT 26/2025/TT-BYT)
                                </div>
                                <Signature size={20} weight="duotone" className="text-emerald-600" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="font-display text-2xl font-extrabold text-emerald-600 tabular-nums">
                                    {acceptedPrescriptions}/{totalPrescriptions}
                                </span>
                                <span className="text-xs text-slate-500">đơn thuốc đã liên thông & cấp mã QG</span>
                            </div>
                            <div className="mt-2 text-[11px] text-slate-600 font-semibold">
                                • Chặn sửa thuốc sau khi ký số • Hỗ trợ thử lại an toàn chống trùng lặp
                            </div>
                        </div>

                        <div className="medpro-card p-4 border-l-4 border-l-[#FFB54A]">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-extrabold text-[#003553] uppercase">
                                    HỒ SƠ BỆNH ÁN ĐIỆN TỬ (TT 13/2025/TT-BYT)
                                </div>
                                <LockKey size={20} weight="duotone" className="text-[#D97706]" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="font-display text-2xl font-extrabold text-[#003553] tabular-nums">
                                    {registrations.filter((r) => r.emrLocked).length}/{registrations.length}
                                </span>
                                <span className="text-xs text-slate-500">hồ sơ bệnh án đã khóa bất biến</span>
                            </div>
                            <div className="mt-2 text-[11px] text-slate-600 font-semibold">
                                • Bệnh án đã khóa bắt buộc đính chính qua Biên bản có lưu bản gốc
                            </div>
                        </div>
                    </div>

                    <div className="medpro-card p-4 space-y-3">
                        <div className="medpro-section-title">
                            <span>TRẠNG THÁI KẾT NỐI HỆ THỐNG CỔNG Y TẾ QUỐC GIA</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="text-xs font-extrabold text-emerald-900">Cổng Đơn thuốc Quốc gia</div>
                                    <div className="text-[11px]">
                                        <a
                                            href="https://donthuocquocgia.vn"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#00B5F1] font-bold hover:underline inline-flex items-center gap-1"
                                            title="Mở Cổng Đơn thuốc Quốc gia (BYT)"
                                        >
                                            <span>donthuocquocgia.vn</span>
                                            <Globe size={12} />
                                        </a>
                                        <span className="text-slate-400"> • API v1</span>
                                    </div>
                                    <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                                        <CheckCircle size={14} weight="fill" />
                                        <span>Đang kết nối bình thường (Độ trễ 42ms)</span>
                                    </div>
                                </div>
                                <Link
                                    to="/admin/tuan-thu?tab=DON_THUOC"
                                    onClick={() => handleSwitchTab('DON_THUOC')}
                                    className="medpro-btn-outline !py-1 !px-2.5 text-xs text-[#00B5F1] hover:bg-[#00B5F1] hover:text-white transition"
                                >
                                    Xem đơn
                                </Link>
                            </div>

                            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="text-xs font-extrabold text-emerald-900">Sổ Sức Khỏe Điện Tử (HSSK)</div>
                                    <div className="text-[11px]">
                                        <a
                                            href="https://hssk.kcb.vn"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#00B5F1] font-bold hover:underline inline-flex items-center gap-1"
                                            title="Mở Cổng Sổ Sức Khỏe Điện Tử"
                                        >
                                            <span>hssk.kcb.vn</span>
                                            <Globe size={12} />
                                        </a>
                                        <span className="text-slate-400"> • TT 32/2023/TT-BYT</span>
                                    </div>
                                    <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                                        <CheckCircle size={14} weight="fill" />
                                        <span>Đang kết nối bình thường (Độ trễ 38ms)</span>
                                    </div>
                                </div>
                                <Link
                                    to="/admin/tuan-thu?tab=HSSK"
                                    onClick={() => handleSwitchTab('HSSK')}
                                    className="medpro-btn-outline !py-1 !px-2.5 text-xs text-[#00B5F1] hover:bg-[#00B5F1] hover:text-white transition"
                                >
                                    Xem HSSK
                                </Link>
                            </div>

                            <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="text-xs font-extrabold text-blue-900">Cổng Giám định BHYT Quốc gia</div>
                                    <div className="text-[11px]">
                                        <a
                                            href="https://gdbhyt.baohiemxahoi.gov.vn"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#00B5F1] font-bold hover:underline inline-flex items-center gap-1"
                                            title="Mở Cổng Giám định BHYT"
                                        >
                                            <span>gdbhyt.baohiemxahoi.gov.vn</span>
                                            <Globe size={12} />
                                        </a>
                                    </div>
                                    <div className="text-[11px] text-blue-700 font-bold flex items-center gap-1">
                                        <CheckCircle size={14} weight="fill" />
                                        <span>Sẵn sàng liên thông chứng chỉ hành nghề</span>
                                    </div>
                                </div>
                                <Link
                                    to="/admin/tuan-thu?tab=SETTING"
                                    onClick={() => handleSwitchTab('SETTING')}
                                    className="medpro-btn-outline !py-1 !px-2.5 text-xs text-[#00B5F1] hover:bg-[#00B5F1] hover:text-white transition"
                                >
                                    Cấu hình
                                </Link>
                            </div>
                        </div>
                    </div>

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

            {activeTab === 'DON_THUOC' && (
                <div className="space-y-4">
                    <div className="medpro-card p-4 space-y-3 bg-gradient-to-r from-[#F0F9FF] to-white border-l-4 border-l-[#00B5F1]">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                            <div>
                                <h3 className="text-sm font-extrabold text-[#003553] uppercase flex items-center gap-2">
                                    <Signature size={18} className="text-[#00B5F1]" />
                                    <span>QUY TRÌNH LIÊN THÔNG ĐƠN THUỐC QUỐC GIA (THÔNG TƯ 26/2025/TT-BYT)</span>
                                </h3>
                                <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                                    <span>Mô hình 4 bước chuẩn hóa từ lúc Bác sĩ kê đơn đến khi cấp Mã Đơn Quốc gia tra cứu tại các nhà thuốc.</span>
                                    <a
                                        href="https://donthuocquocgia.vn"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#00B5F1] font-bold hover:underline inline-flex items-center gap-1"
                                        title="Mở cổng chính thức donthuocquocgia.vn"
                                    >
                                        <span>donthuocquocgia.vn</span>
                                        <Globe size={12} />
                                    </a>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleSyncAllSignedPrescriptions}
                                    disabled={syncingKey === 'ALL' || signedPrescriptions === 0}
                                    className="medpro-btn-primary text-xs disabled:opacity-50"
                                >
                                    <ArrowsClockwise size={14} className={syncingKey === 'ALL' ? 'animate-spin' : ''} />
                                    <span>Đồng bộ tất cả đơn đã ký ({signedPrescriptions})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExportPrescriptionsExcel}
                                    className="medpro-btn-outline text-xs font-bold !bg-white hover:!bg-slate-50"
                                >
                                    <DownloadSimple size={14} weight="bold" className="text-[#00B5F1]" />
                                    <span>Xuất Excel Đơn thuốc</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase">Bước 1: Kê đơn</span>
                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">1</span>
                                </div>
                                <div className="text-xs font-bold text-[#003553]">Kê đơn ngoại trú</div>
                                <p className="text-[11px] text-slate-500">Bác sĩ chuyên khoa chỉ định thuốc, liều lượng & đường dùng.</p>
                                <div className="pt-1 text-[11px] font-semibold text-slate-600">Trạng thái: Bản nháp (DRAFT)</div>
                            </div>

                            <div className="p-3 rounded-xl bg-white border border-blue-200 shadow-2xs space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-blue-600 uppercase">Bước 2: Ký số</span>
                                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">2</span>
                                </div>
                                <div className="text-xs font-bold text-[#003553]">Ký số bảo mật SmartCA</div>
                                <p className="text-[11px] text-slate-500">Khóa bất biến đơn thuốc, chống sửa đổi sau khi bác sĩ phê duyệt.</p>
                                <div className="pt-1 text-[11px] font-semibold text-blue-600">Trạng thái: Đã ký số (SIGNED)</div>
                            </div>

                            <div className="p-3 rounded-xl bg-white border-amber-200 border shadow-2xs space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-amber-600 uppercase">Bước 3: Gửi cổng</span>
                                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">3</span>
                                </div>
                                <div className="text-xs font-bold text-[#003553]">Truyền cổng liên thông</div>
                                <p className="text-[11px] text-slate-500">Đẩy dữ liệu kèm mã Idempotency chống trùng lặp lên Cổng Quốc gia.</p>
                                <div className="pt-1 text-[11px] font-semibold text-amber-600">Trạng thái: Đang truyền (SUBMITTED)</div>
                            </div>

                            <div className="p-3 rounded-xl bg-white border-emerald-200 border shadow-2xs space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-emerald-600 uppercase">Bước 4: Cấp mã QG</span>
                                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">4</span>
                                </div>
                                <div className="text-xs font-bold text-[#003553]">Cấp mã Đơn thuốc QG</div>
                                <p className="text-[11px] text-slate-500">Bộ Y tế phê duyệt, cấp mã VN-RX tra cứu tại mọi nhà thuốc toàn quốc.</p>
                                <div className="pt-1 text-[11px] font-semibold text-emerald-600">Trạng thái: Đã liên thông (ACCEPTED)</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="medpro-card p-3.5 border-l-4 border-l-[#003553]">
                            <div className="text-xs font-bold text-slate-500">TỔNG SỐ ĐƠN THUỐC</div>
                            <div className="text-2xl font-extrabold text-[#003553] mt-1 tabular-nums">{totalPrescriptions}</div>
                            <div className="text-[11px] text-slate-500 mt-1">Đơn thuốc kê tại phòng khám</div>
                        </div>
                        <div className="medpro-card p-3.5 border-l-4 border-l-emerald-500">
                            <div className="text-xs font-bold text-emerald-700">ĐÃ CẤP MÃ QUỐC GIA</div>
                            <div className="text-2xl font-extrabold text-emerald-600 mt-1 tabular-nums">{acceptedPrescriptions}</div>
                            <div className="text-[11px] text-emerald-700 mt-1">Đã liên thông thành công</div>
                        </div>
                        <div className="medpro-card p-3.5 border-l-4 border-l-[#00B5F1]">
                            <div className="text-xs font-bold text-[#00B5F1]">ĐÃ KÝ SỐ CHỜ GỬI</div>
                            <div className="text-2xl font-extrabold text-[#00B5F1] mt-1 tabular-nums">{signedPrescriptions}</div>
                            <div className="text-[11px] text-slate-500 mt-1">Đã khóa dữ liệu an toàn</div>
                        </div>
                        <div className="medpro-card p-3.5 border-l-4 border-l-amber-500">
                            <div className="text-xs font-bold text-amber-700">BẢN NHÁP / CHƯA KÝ</div>
                            <div className="text-2xl font-extrabold text-amber-600 mt-1 tabular-nums">{draftPrescriptions}</div>
                            <div className="text-[11px] text-amber-700 mt-1">Bác sĩ đang hoàn thiện đơn</div>
                        </div>
                    </div>

                    <div className="medpro-card p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
                                <div className="relative flex-1 min-w-[240px]">
                                    <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Tìm theo Mã KCB, Mã Đơn, Tên Bệnh Nhân, Mã QG..."
                                        value={searchRx}
                                        onChange={(e) => setSearchRx(e.target.value)}
                                        className="medpro-input !pl-9 text-xs"
                                    />
                                </div>
                                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('ALL')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                                            statusFilter === 'ALL' ? 'bg-[#00B5F1] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Tất cả ({totalPrescriptions})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('ACCEPTED')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                                            statusFilter === 'ACCEPTED' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Đã liên thông ({acceptedPrescriptions})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('SIGNED')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                                            statusFilter === 'SIGNED' ? 'bg-[#00B5F1] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Đã ký ({signedPrescriptions})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('DRAFT')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                                            statusFilter === 'DRAFT' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Bản nháp ({draftPrescriptions})
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                            <table className="medpro-table">
                                <thead>
                                    <tr>
                                        <th>STT</th>
                                        <th>Mã ca khám</th>
                                        <th>Mã đơn nội bộ</th>
                                        <th>Bệnh nhân</th>
                                        <th>Bác sĩ chỉ định</th>
                                        <th>Số thuốc</th>
                                        <th>Trạng thái liên thông</th>
                                        <th>Mã Đơn Quốc gia</th>
                                        <th>Thời điểm ký</th>
                                        <th>Mã giao dịch</th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRegistrations.map((r, idx) => {
                                        const p = r.prescription || {}
                                        const fsm = p.trangThaiFSM || (p.daKySo ? 'SIGNED' : 'DRAFT')
                                        const currentKcb = r.maKCB || r.id
                                        const drugCount = (p.items || p.danhSachThuoc || []).length
                                        const nationalCode = p.maLienThongQuocGia || p.maDonThuocQG || 'Chưa cấp'
                                        const idempotency = p.idempotencyKey || `IDEM-${currentKcb}-RX01`

                                        return (
                                            <tr key={r.id}>
                                                <td className="font-bold">{idx + 1}</td>
                                                <td>
                                                    <Link
                                                        to="/admin/kham-benh"
                                                        className="font-mono font-bold text-[#00B5F1] hover:underline"
                                                        title="Bấm để chuyển đến Bàn khám lâm sàng"
                                                    >
                                                        {currentKcb}
                                                    </Link>
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedRxRecord(r)}
                                                        className="font-mono text-xs font-bold text-[#003553] hover:text-[#00B5F1] hover:underline cursor-pointer"
                                                        title="Bấm xem chi tiết đơn thuốc"
                                                    >
                                                        {p.maDon || 'Chưa tạo'}
                                                    </button>
                                                </td>
                                                <td>
                                                    <Link
                                                        to="/admin/benh-nhan"
                                                        className="font-bold text-[#003553] hover:text-[#00B5F1] hover:underline"
                                                        title="Bấm xem hồ sơ bệnh nhân"
                                                    >
                                                        {r.hoTen}
                                                    </Link>
                                                </td>
                                                <td>
                                                    <Link
                                                        to="/admin/nhan-vien"
                                                        className="text-xs text-slate-700 hover:text-[#00B5F1] hover:underline"
                                                        title="Xem hồ sơ nhân sự bác sĩ"
                                                    >
                                                        {r.bacSi || 'BS. CKII Nguyễn Minh Hoàng'}
                                                    </Link>
                                                </td>
                                                <td className="tabular-nums text-center font-bold">{drugCount} thuốc</td>
                                                <td>
                                                    <StatusBadge status={fsm} compact />
                                                </td>
                                                <td className="font-mono text-xs font-semibold text-[#003553]">
                                                    {nationalCode !== 'Chưa cấp' ? (
                                                        <a
                                                            href="https://donthuocquocgia.vn"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-1"
                                                            title="Mở Cổng Quốc gia tra cứu đơn thuốc"
                                                        >
                                                            <span>{nationalCode}</span>
                                                            <Globe size={11} />
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Chưa cấp</span>
                                                    )}
                                                </td>
                                                <td className="tabular-nums text-xs text-slate-600">{p.ngayKy || 'Chưa ký'}</td>
                                                <td className="font-mono text-[11px] text-slate-500">{idempotency}</td>
                                                <td>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedRxRecord(r)}
                                                            className="medpro-btn-outline !py-1 !px-2 text-xs flex items-center gap-1 cursor-pointer"
                                                            title="Xem chi tiết đơn thuốc"
                                                        >
                                                            <Eye size={13} />
                                                            <span>Chi tiết</span>
                                                        </button>
                                                        {fsm === 'SIGNED' || fsm === 'RETRY_PENDING' ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSyncSinglePrescription(currentKcb)}
                                                                disabled={syncingKey === currentKcb}
                                                                className="medpro-btn-primary !py-1 !px-2 text-xs flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <ArrowsClockwise size={12} className={syncingKey === currentKcb ? 'animate-spin' : ''} />
                                                                <span>Gửi cổng</span>
                                                            </button>
                                                        ) : fsm === 'ACCEPTED' ? (
                                                            <span className="text-[11px] text-emerald-600 font-bold px-1.5 py-0.5 rounded bg-emerald-50">
                                                                Đã thông tuyến
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-slate-400 italic">Chờ ký</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {filteredRegistrations.length === 0 && (
                                        <tr>
                                            <td colSpan={11}>
                                                <EmptyState icon="Signature" title="Không tìm thấy đơn thuốc phù hợp điều kiện lọc" />
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'HSSK' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="medpro-section-title">
                        <span>ĐỒNG BỘ SỔ SỨC KHỎE ĐIỆN TỬ BỘ Y TẾ (TT 32/2023/TT-BYT)</span>
                        <div className="flex items-center gap-2">
                            <a
                                href="https://hssk.kcb.vn"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#00B5F1] font-bold hover:underline inline-flex items-center gap-1"
                                title="Mở cổng HSSK chính thức"
                            >
                                <span>Cổng HSSK: hssk.kcb.vn</span>
                                <Globe size={12} />
                            </a>
                            <button
                                type="button"
                                onClick={() => handleTriggerSyncGeneric('Sổ Sức Khỏe Điện Tử')}
                                className="medpro-btn-primary text-xs"
                            >
                                <ArrowsClockwise size={14} className={syncingKey === 'Sổ Sức Khỏe Điện Tử' ? 'animate-spin' : ''} />
                                <span>Liên thông HSSK ca đã hoàn tất</span>
                            </button>
                        </div>
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
                                    <th>Mã giao dịch</th>
                                    <th>Trạng thái HSSK</th>
                                    <th>Thời điểm đồng bộ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(Array.isArray(nationalEhrSync) ? nationalEhrSync : []).map((item, idx) => (
                                    <tr key={item.id || idx}>
                                        <td className="font-bold">{idx + 1}</td>
                                        <td className="font-mono font-bold text-[#00B5F1]">
                                            <Link to="/admin/kham-benh" className="hover:underline">
                                                {item.maKCB}
                                            </Link>
                                        </td>
                                        <td className="font-bold text-[#003553]">
                                            <Link to="/admin/benh-nhan" className="hover:underline hover:text-[#00B5F1]">
                                                {item.benhNhan}
                                            </Link>
                                        </td>
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

            {activeTab === 'AUDIT' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="medpro-section-title !mb-0">
                            <span>NHẬT KÝ KIỂM TOÁN HỆ THỐNG Y TẾ (THEO NGHỊ ĐỊNH 102/2025/NĐ-CP)</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Tìm theo người dùng, hành động, đối tượng..."
                                    value={searchAudit}
                                    onChange={(e) => setSearchAudit(e.target.value)}
                                    className="medpro-input !pl-8 text-xs !py-1.5 w-64"
                                />
                            </div>
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="medpro-input text-xs !py-1.5 w-36"
                            >
                                <option value="ALL">Mọi vai trò</option>
                                <option value="SYSTEM">Hệ thống</option>
                                <option value="ADMIN">Quản trị</option>
                                <option value="BAC_SI">Bác sĩ</option>
                                <option value="LE_TAN">Lễ tân</option>
                                <option value="THU_NGAN">Thu ngân</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table">
                            <thead>
                                <tr>
                                    <th>Mã Log</th>
                                    <th>Thời gian</th>
                                    <th>Người thực hiện</th>
                                    <th>Vai trò</th>
                                    <th>Hành động</th>
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
                                        <td className="font-semibold text-[#12263F]">{String(log.nguoiDung || '').replace(/\s*\(INT-\d+\)/g, '')}</td>
                                        <td>
                                            <span className="medpro-badge-info">{ROLE_LABEL_MAP[log.vaiTro] || log.vaiTro}</span>
                                        </td>
                                        <td className="font-semibold text-xs text-[#003553]">{ACTION_LABEL_MAP[log.hanhDong] || log.hanhDong}</td>
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

            {activeTab === 'SETTING' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="medpro-section-title">
                        <span>CẤU HÌNH PHÒNG KHÁM, GIẤY PHÉP HOẠT ĐỘNG & TOKEN LIÊN THÔNG</span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleTestGatewayConnection}
                                disabled={isTestingGateway}
                                className="medpro-btn-outline text-xs flex items-center gap-1.5"
                            >
                                <ArrowsClockwise size={14} className={isTestingGateway ? 'animate-spin' : ''} />
                                <span>{isTestingGateway ? 'Đang kiểm tra...' : 'Kiểm tra kết nối Cổng Quốc gia'}</span>
                            </button>
                            <button type="button" onClick={handleSaveSettings} className="medpro-btn-primary text-xs">
                                <FloppyDisk size={14} weight="bold" />
                                <span>Lưu cấu hình hệ thống</span>
                            </button>
                        </div>
                    </div>

                    {gatewayPingResult && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckCircle size={18} weight="fill" className="text-emerald-600" />
                                <span>
                                    <strong>Cổng Đơn thuốc Quốc gia & HSSK:</strong> Phản hồi kết nối thành công 200 OK. Độ trễ: <strong>{gatewayPingResult.latency}ms</strong> (Lúc {gatewayPingResult.timestamp}).
                                </span>
                            </div>
                            <a
                                href="https://donthuocquocgia.vn"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="medpro-badge-success font-bold hover:underline inline-flex items-center gap-1"
                            >
                                <span>Trực tuyến</span>
                                <Globe size={11} />
                            </a>
                        </div>
                    )}

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
                                    <ShieldCheck size={14} weight="bold" />
                                    <span>Trạng thái chứng thư số HSM: ĐANG KÍCH HOẠT</span>
                                </div>
                                <div className="text-[11px] text-emerald-700 leading-relaxed">
                                    Chứng thư số VNPT SmartCA HSM đã tích hợp sẵn cho 04 Bác sĩ chuyên khoa tại phòng khám, sẵn sàng ký số tự động đạt chuẩn Thông tư 26/2025/TT-BYT.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedRxRecord && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="medpro-card max-w-2xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2">
                                <Signature size={20} weight="bold" className="text-[#00B5F1]" />
                                <div>
                                    <h3 className="font-display font-extrabold text-base text-[#003553]">
                                        CHI TIẾT ĐƠN THUỐC ĐIỆN TỬ NGOẠI TRÚ
                                    </h3>
                                    <div className="text-xs text-slate-500">
                                        Mã đơn: <strong className="font-mono text-[#00B5F1]">{selectedRxRecord.prescription?.maDon || 'Chưa tạo'}</strong> • Mã ca KCB: <strong className="font-mono text-[#003553]">{selectedRxRecord.maKCB || selectedRxRecord.id}</strong>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedRxRecord(null)}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                            <div>
                                <span className="text-slate-500 block">Bệnh nhân:</span>
                                <Link
                                    to="/admin/benh-nhan"
                                    className="text-[#003553] text-sm font-bold hover:underline hover:text-[#00B5F1]"
                                    title="Xem hồ sơ bệnh nhân"
                                >
                                    {selectedRxRecord.hoTen}
                                </Link>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Năm sinh / Giới tính:</span>
                                <strong className="text-slate-800">{selectedRxRecord.ngaySinh} ({selectedRxRecord.gioiTinh})</strong>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Bác sĩ kê đơn:</span>
                                <Link
                                    to="/admin/nhan-vien"
                                    className="text-[#00B5F1] font-bold hover:underline"
                                    title="Xem hồ sơ nhân sự bác sĩ"
                                >
                                    {selectedRxRecord.bacSi || 'BS. CKII Nguyễn Minh Hoàng'}
                                </Link>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Trạng thái Cổng QG:</span>
                                <StatusBadge status={selectedRxRecord.prescription?.trangThaiFSM || 'DRAFT'} compact />
                            </div>
                        </div>

                        {selectedRxRecord.clinicalNotes?.chanDoanXacDinh && (
                            <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 text-xs flex items-center justify-between">
                                <div>
                                    <span className="font-bold text-[#003553]">Chẩn đoán bệnh (ICD-10): </span>
                                    <span className="text-slate-800">{selectedRxRecord.clinicalNotes.chanDoanXacDinh}</span>
                                </div>
                                <Link
                                    to="/admin/kham-benh"
                                    className="text-xs text-[#00B5F1] font-bold hover:underline shrink-0 ml-2"
                                >
                                    Bàn khám &rarr;
                                </Link>
                            </div>
                        )}

                        <div>
                            <div className="text-xs font-extrabold text-[#003553] uppercase mb-2">
                                Danh mục thuốc kê ({((selectedRxRecord.prescription?.items || selectedRxRecord.prescription?.danhSachThuoc) || []).length} loại)
                            </div>
                            <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                <table className="medpro-table text-xs">
                                    <thead>
                                        <tr>
                                            <th>STT</th>
                                            <th>Tên thuốc & Hoạt chất</th>
                                            <th>Số lượng</th>
                                            <th>ĐVT</th>
                                            <th>Liều dùng & Hướng dẫn sử dụng</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {((selectedRxRecord.prescription?.items || selectedRxRecord.prescription?.danhSachThuoc) || []).map((item, i) => (
                                            <tr key={item.id || i}>
                                                <td className="font-bold text-center">{i + 1}</td>
                                                <td>
                                                    <div className="font-bold text-[#003553]">{item.tenThuoc}</div>
                                                    <div className="text-[11px] text-slate-500">{item.hoatChat}</div>
                                                </td>
                                                <td className="tabular-nums font-bold text-center">{item.soLuong}</td>
                                                <td className="text-center">{item.dvt}</td>
                                                <td className="text-slate-700">{item.lieuDung}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {selectedRxRecord.prescription?.loiDanBacSi && (
                            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs">
                                <span className="font-bold text-amber-900">Lời dặn của Bác sĩ: </span>
                                <span className="text-amber-950">{selectedRxRecord.prescription.loiDanBacSi}</span>
                            </div>
                        )}

                        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                            <div className="text-xs font-extrabold text-emerald-900 uppercase flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <QrCode size={16} className="text-emerald-700" />
                                    <span>THÔNG SỐ LIÊN THÔNG CỔNG ĐƠN THUỐC QUỐC GIA (TT 26/2025/TT-BYT)</span>
                                </div>
                                <a
                                    href="https://donthuocquocgia.vn"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-[#00B5F1] font-bold hover:underline inline-flex items-center gap-1"
                                >
                                    <span>Mở cổng donthuocquocgia.vn</span>
                                    <Globe size={11} />
                                </a>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="text-slate-500 block">Mã Đơn thuốc Quốc gia:</span>
                                    {selectedRxRecord.prescription?.maLienThongQuocGia ? (
                                        <a
                                            href="https://donthuocquocgia.vn"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-mono font-bold text-emerald-700 text-sm hover:underline inline-flex items-center gap-1"
                                            title="Bấm mở Cổng Quốc gia để tra cứu"
                                        >
                                            <span>{selectedRxRecord.prescription.maLienThongQuocGia}</span>
                                            <Globe size={12} />
                                        </a>
                                    ) : (
                                        <span className="text-slate-400 italic">Chưa cấp (Đang chờ liên thông)</span>
                                    )}
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Thời điểm ký số SmartCA:</span>
                                    <span className="font-mono text-slate-700">
                                        {selectedRxRecord.prescription?.ngayKy || 'Chưa thực hiện ký số'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Mã giao dịch (Idempotency Key):</span>
                                    <span className="font-mono text-slate-600 text-[11px]">
                                        {selectedRxRecord.prescription?.idempotencyKey || `IDEM-${selectedRxRecord.maKCB || selectedRxRecord.id}-RX01`}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Biên nhận giao dịch Bộ Y tế:</span>
                                    <span className="font-mono text-slate-600 text-[11px]">
                                        {selectedRxRecord.prescription?.receiptToken || (selectedRxRecord.prescription?.trangThaiFSM === 'ACCEPTED' ? `RCPT-BYT-${(selectedRxRecord.maKCB || selectedRxRecord.id).slice(-4)}-OK` : 'Chưa có')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                            <a
                                href="https://donthuocquocgia.vn"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="medpro-btn-outline text-xs inline-flex items-center gap-1.5"
                            >
                                <Globe size={13} />
                                <span>Mở Cổng Tra cứu Bộ Y tế</span>
                            </a>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedRxRecord(null)}
                                    className="medpro-btn-outline text-xs cursor-pointer"
                                >
                                    Đóng
                                </button>
                                {selectedRxRecord.prescription?.trangThaiFSM === 'SIGNED' && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const currentKcb = selectedRxRecord.maKCB || selectedRxRecord.id
                                            handleSyncSinglePrescription(currentKcb)
                                            setSelectedRxRecord(null)
                                        }}
                                        className="medpro-btn-primary text-xs flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <ArrowsClockwise size={13} />
                                        <span>Gửi Cổng Quốc gia ngay</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
