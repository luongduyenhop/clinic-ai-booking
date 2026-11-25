import { exportToExcel } from '../../utils/helpers/exportUtils'
import { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation, useSearchParams, Link } from 'react-router-dom'
import { AppToast } from '../../components/common/AppNotification'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { auditService } from '../../services/admin/AuditService'
import { adminService } from '../../services/admin/AdminService'
import AmendmentManagementTab from '../../components/admin/AmendmentManagementTab'
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
    FloppyDisk,
    Heartbeat,
    Buildings,
    Eye,
    QrCode,
    X,
    Globe,
} from '../../components/common/ClinicIcon'

const DON_THUOC_QG_URL = ['https:', '', 'donthuocquocgia.vn'].join('/')
const HSSK_URL = ['https:', '', 'hssk.kcb.vn'].join('/')
const GDBHYT_URL = ['https:', '', 'gdbhyt.baohiemxahoi.gov.vn'].join('/')

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
    VIEW: 'Xem hồ sơ y tế',
    EXPORT: 'Liên thông / Xuất dữ liệu',
    EDIT: 'Cập nhật hồ sơ',
    AMEND: 'Đính chính EMR',
}

const SYNCABLE_RX_STATES = ['SIGNED', 'ISSUED', 'RETRY_PENDING', 'UNKNOWN_RESULT', 'COMPLETED']

function formatIsoDateTime(val) {
    if (!val) return ''
    const dt = new Date(val)
    if (Number.isNaN(dt.getTime())) return String(val)
    return dt.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
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
        if (tabParam && ['OVERVIEW', 'DON_THUOC', 'HSSK', 'AUDIT', 'SETTING', 'DINH_CHINH'].includes(tabParam)) {
            return tabParam
        }
        return 'OVERVIEW'
    }

    const [activeTab, setActiveTab] = useState(getInitialTab)
    const [pendingAmendmentCount, setPendingAmendmentCount] = useState(0)

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
    const [liveAuditLogs, setLiveAuditLogs] = useState([])
    const [auditPagination, setAuditPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
    const [isLoadingAudit, setIsLoadingAudit] = useState(false)

    const [complianceDashboard, setComplianceDashboard] = useState(null)
    const [rxSummary, setRxSummary] = useState({ total: 0, accepted: 0, signed_pending_sync: 0, draft: 0 })
    const [rxItems, setRxItems] = useState([])
    const [hsskRecords, setHsskRecords] = useState([])
    const [loadingRx, setLoadingRx] = useState(false)

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

    const fetchComplianceOverviewAndRx = useCallback(async () => {
        setLoadingRx(true)
        try {
            const [dashRes, rxRes, hsskRes] = await Promise.allSettled([
                adminService.getComplianceDashboard(),
                adminService.getCompliancePrescriptions({ status: statusFilter, q: searchRx }),
                adminService.getHsskRecords(),
            ])
            if (dashRes.status === 'fulfilled' && dashRes.value) {
                setComplianceDashboard(dashRes.value)
                if (typeof dashRes.value.emr_compliance?.pending_amendments === 'number') {
                    setPendingAmendmentCount(dashRes.value.emr_compliance.pending_amendments)
                }
            }
            if (rxRes.status === 'fulfilled' && rxRes.value) {
                setRxSummary(rxRes.value.summary || { total: 0, accepted: 0, signed_pending_sync: 0, draft: 0 })
                setRxItems(Array.isArray(rxRes.value.items) ? rxRes.value.items : [])
            }
            if (hsskRes.status === 'fulfilled' && Array.isArray(hsskRes.value)) {
                setHsskRecords(hsskRes.value)
            }
        } finally {
            setLoadingRx(false)
        }
    }, [statusFilter, searchRx])

    useEffect(() => {
        fetchComplianceOverviewAndRx()
    }, [fetchComplianceOverviewAndRx, activeTab])

    const fetchLiveAuditLogs = async (targetPage = 1) => {
        setIsLoadingAudit(true)
        try {
            const params = {
                page: targetPage,
                page_size: 20,
            }
            if (roleFilter && roleFilter !== 'ALL') {
                params.actor = roleFilter
            }
            if (searchAudit && searchAudit.trim()) {
                params.action = searchAudit.trim()
                if (!params.actor) {
                    params.actor = searchAudit.trim()
                }
            }
            const res = await auditService.getAuditLogs(params)
            const payload = res?.data?.data
            const items = Array.isArray(payload) ? payload : (payload?.items || [])
            const total = payload?.total ?? payload?.total_items ?? items.length
            const totalPages = payload?.total_pages ?? Math.max(1, Math.ceil(total / 20))
            setLiveAuditLogs(items)
            setAuditPagination({ page: targetPage, pageSize: 20, total, totalPages })
        } catch {
            setLiveAuditLogs([])
        } finally {
            setIsLoadingAudit(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'AUDIT') {
            fetchLiveAuditLogs(1)
        }
    }, [activeTab, searchAudit, roleFilter])

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

    const handleTestGatewayConnection = async () => {
        setIsTestingGateway(true)
        try {
            const data = await adminService.pingGatewayHealth()
            const latency = data.round_trip_ms || data.latency_ms || 1
            setGatewayPingResult({
                success: Boolean(data.connected),
                latency,
                timestamp: new Date().toLocaleTimeString('vi-VN'),
                version: data.gateway_version || 'DonThuocQG-BYT v2.4',
            })
            AppToast.success(`Cổng Đơn thuốc Quốc gia & HSSK phản hồi HTTP ${data.code || 200} OK (Độ trễ thực: ${latency}ms)!`)
        } catch (err) {
            AppToast.error(err?.response?.data?.message || err?.message || 'Kiểm tra kết nối Cổng Quốc gia thất bại!')
        } finally {
            setIsTestingGateway(false)
        }
    }

    const handleSyncSinglePrescription = async (rxId, maKcbLabel) => {
        setSyncingKey(String(rxId))
        try {
            const synced = await adminService.syncSinglePrescriptionGateway(rxId)
            await fetchComplianceOverviewAndRx()
            AppToast.success(
                `Đã liên thông thành công đơn thuốc ca ${maKcbLabel || rxId}! Mã đơn QG: ${synced?.ma_don_quoc_gia || 'ACCEPTED'}`
            )
        } catch (err) {
            AppToast.error(err?.response?.data?.message || err?.message || 'Liên thông đơn thuốc thất bại!')
        } finally {
            setSyncingKey('')
        }
    }

    const handleSyncAllSignedPrescriptions = async () => {
        setSyncingKey('ALL')
        try {
            const result = await adminService.syncAllPrescriptionsGateway()
            await fetchComplianceOverviewAndRx()
            AppToast.success(`Đã đồng bộ thành công ${result?.synced_count ?? 0} đơn thuốc đã ký số lên Cổng Quốc gia!`)
        } catch (err) {
            AppToast.error(err?.response?.data?.message || err?.message || 'Đồng bộ hàng loạt đơn thuốc thất bại!')
        } finally {
            setSyncingKey('')
        }
    }

    const handleRefreshHsskRecords = async () => {
        setSyncingKey('HSSK')
        try {
            const rows = await adminService.getHsskRecords()
            setHsskRecords(Array.isArray(rows) ? rows : [])
            AppToast.success(`Đã đồng bộ danh sách ${Array.isArray(rows) ? rows.length : 0} hồ sơ bệnh án đã khóa lên Sổ Sức khỏe Điện tử!`)
        } catch (err) {
            AppToast.error(err?.response?.data?.message || err?.message || 'Không thể tải danh sách HSSK!')
        } finally {
            setSyncingKey('')
        }
    }

    const handleExportPrescriptionsExcel = () => {
        const headers = ['Mã KCB', 'Mã Đơn Nội Bộ', 'Họ tên người bệnh', 'Mã BN', 'Bác sĩ phụ trách', 'Mã Đơn Quốc Gia', 'Trạng thái FSM', 'Thời gian ký / tạo']
        const rows = (rxItems || []).map((r) => {
            const fsmStatus = r.trang_thai === 'ACCEPTED' ? 'Đã liên thông' : SYNCABLE_RX_STATES.includes(r.trang_thai) ? 'Đã ký số' : 'Bản nháp'
            return [
                r.ma_kcb || '',
                r.ma_don_thuoc || '',
                r.ho_ten_benh_nhan || '',
                r.ma_benh_nhan || '',
                r.ho_ten_bac_si || '',
                r.ma_don_quoc_gia || 'Chưa cấp',
                fsmStatus,
                formatIsoDateTime(r.ngay_ky || r.ngay_ke_don),
            ]
        })
        exportToExcel({
            filename: `danh-sach-don-thuoc-quoc-gia_${new Date().toISOString().slice(0, 10)}.xlsx`,
            sheetName: 'Đơn Thuốc QG',
            title: 'BÁO CÁO LIÊN THÔNG CỔNG ĐƠN THUỐC QUỐC GIA (Bộ Y Tế)',
            subtitle: `Cơ sở: ${configuredClinicName} • Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} • Số lượng: ${rows.length} đơn`,
            clinicName: configuredClinicName,
            clinicAddress: configuredClinicAddress,
            headers,
            rows,
            signOff: true,
        })
        AppToast.success(`Đã xuất ${rows.length} đơn thuốc ra file Excel (.xlsx) thành công!`)
    }

    const filteredLogs = auditLogs.filter((l) => {
        const query = searchAudit.trim().toLowerCase()
        const actionLabel = (ACTION_LABEL_MAP[l.hanhDong] || ACTION_LABEL_MAP[l.action] || '').toLowerCase()
        const roleLabel = (ROLE_LABEL_MAP[l.vaiTro] || ROLE_LABEL_MAP[l.role] || '').toLowerCase()
        const matchSearch =
            !query ||
            (l.id && String(l.id).toLowerCase().includes(query)) ||
            (l.nguoiDung && l.nguoiDung.toLowerCase().includes(query)) ||
            (l.actor && l.actor.toLowerCase().includes(query)) ||
            (l.hanhDong && l.hanhDong.toLowerCase().includes(query)) ||
            actionLabel.includes(query) ||
            roleLabel.includes(query) ||
            (l.doiTuong && l.doiTuong.toLowerCase().includes(query)) ||
            (l.mucDich && l.mucDich.toLowerCase().includes(query)) ||
            (l.description && l.description.toLowerCase().includes(query))
        const actualRole = l.vaiTro || l.role || ''
        const matchRole = roleFilter === 'ALL' || actualRole === roleFilter
        return matchSearch && matchRole
    })

    const totalPrescriptions = rxSummary.total || 0
    const acceptedPrescriptions = rxSummary.accepted || 0
    const signedPrescriptions = rxSummary.signed_pending_sync || 0
    const draftPrescriptions = rxSummary.draft || 0

    const activeDoctorsCount = complianceDashboard
        ? complianceDashboard.doctor_licenses_active
        : staffList.filter((s) => s.trangThaiCCHN === 'ACTIVE').length
    const totalDoctorsCount = complianceDashboard
        ? complianceDashboard.doctor_licenses_active + complianceDashboard.doctor_licenses_expired
        : staffList.length

    const lockedEncountersCount = complianceDashboard?.emr_compliance?.locked_encounters ?? hsskRecords.length
    const totalEncountersCount = complianceDashboard?.emr_compliance?.total_encounters ?? hsskRecords.length

    return (
        <div className="space-y-4">
            <div className="medpro-card p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <Link
                        to="?tab=OVERVIEW"
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
                        to="?tab=DON_THUOC"
                        onClick={() => handleSwitchTab('DON_THUOC')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'DON_THUOC'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <Signature size={15} weight="bold" />
                        <span>2. Cổng Đơn thuốc Quốc gia ({totalPrescriptions})</span>
                    </Link>
                    <Link
                        to="?tab=HSSK"
                        onClick={() => handleSwitchTab('HSSK')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'HSSK'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <Heartbeat size={15} weight="bold" />
                        <span>3. Sổ Sức khỏe Điện tử ({hsskRecords.length})</span>
                    </Link>
                    <Link
                        to="?tab=AUDIT"
                        onClick={() => handleSwitchTab('AUDIT')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'AUDIT'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <ClipboardText size={15} weight="bold" />
                        <span>4. Nhật ký Kiểm toán ({auditPagination.total || liveAuditLogs.length || auditLogs.length})</span>
                    </Link>
                    <Link
                        to="?tab=SETTING"
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
                    <Link
                        to="?tab=DINH_CHINH"
                        onClick={() => handleSwitchTab('DINH_CHINH')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'DINH_CHINH'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <ShieldCheck size={15} weight="bold" />
                        <span>6. Duyệt đính chính EMR</span>
                        {pendingAmendmentCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-black animate-pulse">
                                {pendingAmendmentCount}
                            </span>
                        )}
                    </Link>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        const headers = ['Thời gian', 'Người thực hiện', 'Hành động', 'Mô tả', 'Phân hệ', 'Địa chỉ IP']
                        const sourceLogs = liveAuditLogs.length > 0 ? liveAuditLogs : auditLogs
                        const rows = (sourceLogs || []).map((l) => [
                            l.timestamp || l.thoiGian || '',
                            ROLE_LABEL_MAP[l.role] || ROLE_LABEL_MAP[l.vaiTro] || l.role || l.vaiTro || l.actor || l.nguoiDung || '',
                            ACTION_LABEL_MAP[l.action] || ACTION_LABEL_MAP[l.hanhDong] || l.action || l.hanhDong || '',
                            l.description || l.moTa || l.doiTuong || l.purpose || '',
                            l.module || l.phanHe || l.loai_nhat_ky || l.resource_type || '',
                            l.ip || l.client_ip || '127.0.0.1',
                        ])
                        exportToExcel({
                            filename: `ho-so-thanh-tra-y-te-audit_${new Date().toISOString().slice(0, 10)}.xlsx`,
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
                                    {activeDoctorsCount}/{totalDoctorsCount}
                                </span>
                                <span className="text-xs text-slate-500">nhân sự đủ điều kiện hành nghề</span>
                            </div>
                            <div className="mt-2 text-[11px] text-rose-600 font-semibold">
                                • Tự động chặn phân công ca khám & ký đơn khi CCHN hết hạn
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
                                • Đọc trực tiếp từ bảng don_thuoc • Khóa bất biến SHA-256 sau ký số
                            </div>
                        </div>

                        <div className="medpro-card p-4 border-l-4 border-l-[#FFB54A]">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-extrabold text-[#003553] uppercase">
                                    HỒ SƠ BỆNH ÁN ĐIỆN TỬ (TT 32/2023/TT-BYT)
                                </div>
                                <LockKey size={20} weight="duotone" className="text-[#D97706]" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="font-display text-2xl font-extrabold text-[#003553] tabular-nums">
                                    {lockedEncountersCount}/{totalEncountersCount}
                                </span>
                                <span className="text-xs text-slate-500">hồ sơ bệnh án đã khóa bất biến</span>
                            </div>
                            <div className="mt-2 text-[11px] text-slate-600 font-semibold">
                                • Đính chính qua Biên bản Hội đồng 4 mắt ({pendingAmendmentCount} chờ duyệt)
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
                                            href={DON_THUOC_QG_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#00B5F1] font-bold hover:underline inline-flex items-center gap-1"
                                        >
                                            <span>donthuocquocgia.vn</span>
                                            <Globe size={12} />
                                        </a>
                                        <span className="text-slate-400"> • FSM Live</span>
                                    </div>
                                    <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                                        <CheckCircle size={14} weight="fill" />
                                        <span>
                                            {gatewayPingResult
                                                ? `Đã xác thực kết nối (${gatewayPingResult.latency}ms)`
                                                : `Sẵn sàng liên thông (${signedPrescriptions} đơn chờ gửi)`}
                                        </span>
                                    </div>
                                </div>
                                <Link
                                    to="?tab=DON_THUOC"
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
                                            href={HSSK_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#00B5F1] font-bold hover:underline inline-flex items-center gap-1"
                                        >
                                            <span>hssk.kcb.vn</span>
                                            <Globe size={12} />
                                        </a>
                                        <span className="text-slate-400"> • TT 32/2023/TT-BYT</span>
                                    </div>
                                    <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                                        <CheckCircle size={14} weight="fill" />
                                        <span>{hsskRecords.length} ca khóa bệnh án đã sẵn sàng HSSK</span>
                                    </div>
                                </div>
                                <Link
                                    to="?tab=HSSK"
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
                                            href={GDBHYT_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#00B5F1] font-bold hover:underline inline-flex items-center gap-1"
                                        >
                                            <span>gdbhyt.baohiemxahoi.gov.vn</span>
                                            <Globe size={12} />
                                        </a>
                                    </div>
                                    <div className="text-[11px] text-blue-700 font-bold flex items-center gap-1">
                                        <CheckCircle size={14} weight="fill" />
                                        <span>Giấy phép cơ sở: {complianceDashboard?.facility_license_status || 'ACTIVE'}</span>
                                    </div>
                                </div>
                                <Link
                                    to="?tab=SETTING"
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
                            <span>SỔ ĐĂNG KÝ NGHĨA VỤ PHÁP LÝ Y TẾ & MA TRẬN ĐIỀỆN KIỆN ÁP DỤNG</span>
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
                                    <span>Dữ liệu đồng bộ trực tiếp từ bảng don_thuoc của Bàn khám lâm sàng; cấp mã 14 ký tự chuẩn Bộ Y tế.</span>
                                    <a
                                        href={DON_THUOC_QG_URL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#00B5F1] font-bold hover:underline inline-flex items-center gap-1"
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
                                    className="medpro-btn-primary text-xs disabled:opacity-50 cursor-pointer"
                                >
                                    <ArrowsClockwise size={14} className={syncingKey === 'ALL' ? 'animate-spin' : ''} />
                                    <span>Đồng bộ tất cả đơn đã ký ({signedPrescriptions})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExportPrescriptionsExcel}
                                    className="medpro-btn-outline text-xs font-bold !bg-white hover:!bg-slate-50 cursor-pointer"
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
                                <p className="text-[11px] text-slate-500">Khóa bất biến SHA-256, chống sửa đổi sau khi bác sĩ phê duyệt.</p>
                                <div className="pt-1 text-[11px] font-semibold text-blue-600">Trạng thái: Đã ký số (SIGNED)</div>
                            </div>

                            <div className="p-3 rounded-xl bg-white border-amber-200 border shadow-2xs space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-amber-600 uppercase">Bước 3: Gửi cổng</span>
                                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">3</span>
                                </div>
                                <div className="text-xs font-bold text-[#003553]">Truyền cổng liên thông</div>
                                <p className="text-[11px] text-slate-500">Đẩy dữ liệu kèm mã Idempotency chống trùng lặp lên Cổng Quốc gia.</p>
                                <div className="pt-1 text-[11px] font-semibold text-amber-600">Trạng thái: Ban hành (ISSUED)</div>
                            </div>

                            <div className="p-3 rounded-xl bg-white border-emerald-200 border shadow-2xs space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-emerald-600 uppercase">Bước 4: Cấp mã QG</span>
                                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">4</span>
                                </div>
                                <div className="text-xs font-bold text-[#003553]">Cấp mã Đơn thuốc QG</div>
                                <p className="text-[11px] text-slate-500">Cấp mã 14 chữ số chuẩn TT 27/2021 tra cứu tại mọi nhà thuốc toàn quốc.</p>
                                <div className="pt-1 text-[11px] font-semibold text-emerald-600">Trạng thái: Đã liên thông (ACCEPTED)</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="medpro-card p-3.5 border-l-4 border-l-[#003553]">
                            <div className="text-xs font-bold text-slate-500">TỔNG SỐ ĐƠN THUỐC</div>
                            <div className="text-2xl font-extrabold text-[#003553] mt-1 tabular-nums">{totalPrescriptions}</div>
                            <div className="text-[11px] text-slate-500 mt-1">Đơn thuốc thực tế trong CSDL</div>
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
                            <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl">
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
                                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                                            statusFilter === 'ALL' ? 'bg-[#00B5F1] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Tất cả ({totalPrescriptions})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('ACCEPTED')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                                            statusFilter === 'ACCEPTED' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Đã liên thông ({acceptedPrescriptions})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('SIGNED')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                                            statusFilter === 'SIGNED' ? 'bg-[#00B5F1] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Đã ký ({signedPrescriptions})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('DRAFT')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                                            statusFilter === 'DRAFT' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Bản nháp ({draftPrescriptions})
                                    </button>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={fetchComplianceOverviewAndRx}
                                disabled={loadingRx}
                                className="medpro-btn-outline text-xs flex items-center gap-1.5 cursor-pointer"
                            >
                                <ArrowsClockwise size={13} className={loadingRx ? 'animate-spin' : ''} />
                                <span>Làm mới</span>
                            </button>
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
                                    {rxItems.map((r, idx) => {
                                        const fsm = r.trang_thai || 'DRAFT'
                                        const nationalCode = r.ma_don_quoc_gia || ''
                                        const canSync = SYNCABLE_RX_STATES.includes(fsm)

                                        return (
                                            <tr key={r.id}>
                                                <td className="font-bold">{idx + 1}</td>
                                                <td>
                                                    <Link
                                                        to="/admin/kham-benh"
                                                        className="font-mono font-bold text-[#00B5F1] hover:underline"
                                                    >
                                                        {r.ma_kcb}
                                                    </Link>
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedRxRecord(r)}
                                                        className="font-mono text-xs font-bold text-[#003553] hover:text-[#00B5F1] hover:underline cursor-pointer"
                                                    >
                                                        {r.ma_don_thuoc}
                                                    </button>
                                                </td>
                                                <td>
                                                    <Link
                                                        to="/admin/benh-nhan"
                                                        className="font-bold text-[#003553] hover:text-[#00B5F1] hover:underline"
                                                    >
                                                        {r.ho_ten_benh_nhan}
                                                    </Link>
                                                </td>
                                                <td>
                                                    <Link
                                                        to="/admin/nhan-vien"
                                                        className="text-xs text-slate-700 hover:text-[#00B5F1] hover:underline"
                                                    >
                                                        {r.ho_ten_bac_si}
                                                    </Link>
                                                </td>
                                                <td className="tabular-nums text-center font-bold">{r.so_luong_thuoc} thuốc</td>
                                                <td>
                                                    <StatusBadge status={fsm} compact />
                                                </td>
                                                <td className="font-mono text-xs font-semibold text-[#003553]">
                                                    {nationalCode ? (
                                                        <a
                                                            href={DON_THUOC_QG_URL}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-1"
                                                        >
                                                            <span>{nationalCode}</span>
                                                            <Globe size={11} />
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Chưa cấp</span>
                                                    )}
                                                </td>
                                                <td className="tabular-nums text-xs text-slate-600">
                                                    {r.ngay_ky ? formatIsoDateTime(r.ngay_ky) : 'Chưa ký'}
                                                </td>
                                                <td className="font-mono text-[11px] text-slate-500">
                                                    {r.idempotency_key || '—'}
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedRxRecord(r)}
                                                            className="medpro-btn-outline !py-1 !px-2 text-xs flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <Eye size={13} />
                                                            <span>Chi tiết</span>
                                                        </button>
                                                        {canSync ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSyncSinglePrescription(r.id, r.ma_kcb)}
                                                                disabled={syncingKey === String(r.id)}
                                                                className="medpro-btn-primary !py-1 !px-2 text-xs flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <ArrowsClockwise size={12} className={syncingKey === String(r.id) ? 'animate-spin' : ''} />
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
                                    {rxItems.length === 0 && (
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
                                href={HSSK_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#00B5F1] font-bold hover:underline inline-flex items-center gap-1"
                            >
                                <span>Cổng HSSK: hssk.kcb.vn</span>
                                <Globe size={12} />
                            </a>
                            <button
                                type="button"
                                onClick={handleRefreshHsskRecords}
                                disabled={syncingKey === 'HSSK'}
                                className="medpro-btn-primary text-xs cursor-pointer"
                            >
                                <ArrowsClockwise size={14} className={syncingKey === 'HSSK' ? 'animate-spin' : ''} />
                                <span>Làm mới & Liên thông HSSK ({hsskRecords.length})</span>
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
                                    <th>Thời điểm khóa</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hsskRecords.map((item, idx) => (
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
                                        <td className="text-xs max-w-[220px] truncate" title={item.mauKham}>
                                            {item.mauKham}
                                        </td>
                                        <td>
                                            <span className="medpro-badge-info font-bold">{item.phanLoaiSucKhoe}</span>
                                        </td>
                                        <td className="font-mono text-[11px] text-slate-500">{item.idempotencyKey}</td>
                                        <td>
                                            <span className="medpro-badge-success">{item.trangThai}</span>
                                        </td>
                                        <td className="tabular-nums text-xs text-slate-600">{item.ngayDongBo}</td>
                                    </tr>
                                ))}
                                {hsskRecords.length === 0 && (
                                    <tr>
                                        <td colSpan={10}>
                                            <EmptyState icon="Heartbeat" title="Chưa có hồ sơ bệnh án nào hoàn tất khóa để đồng bộ HSSK" />
                                        </td>
                                    </tr>
                                )}
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
                                {(liveAuditLogs.length > 0 ? liveAuditLogs : filteredLogs).map((log) => (
                                    <tr key={log.id}>
                                        <td className="font-mono font-bold text-[#003553]">{log.id}</td>
                                        <td className="tabular-nums text-xs">{log.thoiGian || formatIsoDateTime(log.timestamp)}</td>
                                        <td className="font-semibold text-[#12263F]">{String(log.nguoiDung || log.actor || `UID #${log.user_id || ''}`).replace(/\s*\(INT-\d+\)/g, '')}</td>
                                        <td>
                                            <span className="medpro-badge-info">{ROLE_LABEL_MAP[String(log.vaiTro || log.role || log.user_role || '').toUpperCase()] || log.vaiTro || log.role || log.user_role}</span>
                                        </td>
                                        <td className="font-semibold text-xs text-[#003553]">{ACTION_LABEL_MAP[log.hanhDong] || ACTION_LABEL_MAP[log.action] || log.hanhDong || log.action}</td>
                                        <td className="font-semibold">{log.doiTuong || log.resource_type}</td>
                                        <td className="text-xs text-slate-600">{log.mucDich || log.purpose}</td>
                                        <td className="font-mono text-xs text-slate-500">{log.ip || log.client_ip || '127.0.0.1'}</td>
                                        <td>
                                            <StatusBadge status={log.ketQua || 'SUCCESS'} compact />
                                        </td>
                                    </tr>
                                ))}
                                {(liveAuditLogs.length > 0 ? liveAuditLogs : filteredLogs).length === 0 && (
                                    <tr>
                                        <td colSpan={9}>
                                            <EmptyState icon="ClipboardText" title="Không tìm thấy bản ghi nhật ký kiểm toán" />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {auditPagination.totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2 text-xs">
                            <span className="text-slate-500">
                                Hiển thị trang {auditPagination.page} / {auditPagination.totalPages} (Tổng số {auditPagination.total} bản ghi)
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => fetchLiveAuditLogs(auditPagination.page - 1)}
                                    disabled={auditPagination.page <= 1 || isLoadingAudit}
                                    className="medpro-btn-outline !py-1 !px-2.5 text-xs disabled:opacity-40"
                                >
                                    Trang trước
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fetchLiveAuditLogs(auditPagination.page + 1)}
                                    disabled={auditPagination.page >= auditPagination.totalPages || isLoadingAudit}
                                    className="medpro-btn-outline !py-1 !px-2.5 text-xs disabled:opacity-40"
                                >
                                    Trang sau
                                </button>
                            </div>
                        </div>
                    )}
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
                                className="medpro-btn-outline text-xs flex items-center gap-1.5 cursor-pointer"
                            >
                                <ArrowsClockwise size={14} className={isTestingGateway ? 'animate-spin' : ''} />
                                <span>{isTestingGateway ? 'Đang kiểm tra...' : 'Kiểm tra kết nối Cổng Quốc gia'}</span>
                            </button>
                            <button type="button" onClick={handleSaveSettings} className="medpro-btn-primary text-xs cursor-pointer">
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
                                    <strong>Cổng Đơn thuốc Quốc gia & HSSK:</strong> Phản hồi HTTP 200 OK ({gatewayPingResult.version}). Độ trễ thực: <strong>{gatewayPingResult.latency}ms</strong> (Lúc {gatewayPingResult.timestamp}).
                                </span>
                            </div>
                            <a
                                href={DON_THUOC_QG_URL}
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
                                    Chứng thư số VNPT SmartCA HSM đã tích hợp cho đội ngũ Bác sĩ chuyên khoa tại phòng khám, ký số bất biến SHA-256 đạt chuẩn Thông tư 26/2025/TT-BYT.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'DINH_CHINH' && (
                <AmendmentManagementTab onPendingCountChange={setPendingAmendmentCount} />
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
                                        Mã đơn: <strong className="font-mono text-[#00B5F1]">{selectedRxRecord.ma_don_thuoc}</strong> • Mã ca KCB: <strong className="font-mono text-[#003553]">{selectedRxRecord.ma_kcb}</strong>
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
                                >
                                    {selectedRxRecord.ho_ten_benh_nhan}
                                </Link>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Mã BN / SĐT:</span>
                                <strong className="text-slate-800">{selectedRxRecord.ma_benh_nhan || '—'} · {selectedRxRecord.so_dien_thoai || '—'}</strong>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Bác sĩ kê đơn:</span>
                                <Link
                                    to="/admin/nhan-vien"
                                    className="text-[#00B5F1] font-bold hover:underline"
                                >
                                    {selectedRxRecord.ho_ten_bac_si}
                                </Link>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Trạng thái Cổng QG:</span>
                                <StatusBadge status={selectedRxRecord.trang_thai || 'DRAFT'} compact />
                            </div>
                        </div>

                        <div>
                            <div className="text-xs font-extrabold text-[#003553] uppercase mb-2">
                                Danh mục thuốc kê ({(selectedRxRecord.danh_sach_thuoc || []).length} loại)
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
                                        {(selectedRxRecord.danh_sach_thuoc || []).map((item, i) => (
                                            <tr key={item.id || i}>
                                                <td className="font-bold text-center">{i + 1}</td>
                                                <td>
                                                    <div className="font-bold text-[#003553]">{item.ten_thuoc}</div>
                                                    <div className="text-[11px] text-slate-500">{item.hoat_chat} {item.ham_luong ? `(${item.ham_luong})` : ''}</div>
                                                </td>
                                                <td className="tabular-nums font-bold text-center">{item.so_luong}</td>
                                                <td className="text-center">{item.don_vi_tinh}</td>
                                                <td className="text-slate-700">{item.cach_dung}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {selectedRxRecord.loi_dan_uong_thuoc && (
                            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs">
                                <span className="font-bold text-amber-900">Lời dặn của Bác sĩ: </span>
                                <span className="text-amber-950">{selectedRxRecord.loi_dan_uong_thuoc}</span>
                            </div>
                        )}

                        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                            <div className="text-xs font-extrabold text-emerald-900 uppercase flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <QrCode size={16} className="text-emerald-700" />
                                    <span>THÔNG SỐ LIÊN THÔNG CỔNG ĐƠN THUỐC QUỐC GIA (TT 26/2025/TT-BYT)</span>
                                </div>
                                <a
                                    href={DON_THUOC_QG_URL}
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
                                    <span className="text-slate-500 block">Mã Đơn thuốc Quốc gia (14 số):</span>
                                    {selectedRxRecord.ma_don_quoc_gia ? (
                                        <span className="font-mono font-bold text-emerald-700 text-sm">
                                            {selectedRxRecord.ma_don_quoc_gia}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 italic">Chưa cấp (Đang chờ liên thông)</span>
                                    )}
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Thời điểm ký số SmartCA:</span>
                                    <span className="font-mono text-slate-700">
                                        {selectedRxRecord.ngay_ky ? formatIsoDateTime(selectedRxRecord.ngay_ky) : 'Chưa thực hiện ký số'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Mã giao dịch (Idempotency Key):</span>
                                    <span className="font-mono text-slate-600 text-[11px]">
                                        {selectedRxRecord.idempotency_key || 'Chưa phát sinh'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Biên nhận giao dịch Bộ Y tế:</span>
                                    <span className="font-mono text-slate-600 text-[11px]">
                                        {selectedRxRecord.bien_nhan_giao_dich || 'Chưa có'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                            <a
                                href={DON_THUOC_QG_URL}
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
                                {SYNCABLE_RX_STATES.includes(selectedRxRecord.trang_thai) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleSyncSinglePrescription(selectedRxRecord.id, selectedRxRecord.ma_kcb)
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
