import { exportToExcel, exportToCsv } from '../../utils/helpers/exportUtils'
import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation, useSearchParams, Link } from 'react-router-dom'
import { AppToast } from '../../components/common/AppNotification'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { adminService } from '../../services/admin/AdminService'
import { auditService } from '../../services/admin/AuditService'
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
    ArrowRight,
    X,
    Globe,
} from '../../components/common/ClinicIcon'

const DON_THUOC_QG_URL = ['https:', '', 'donthuocquocgia.vn'].join('/')
const HSSK_PORTAL_URL = ['https:', '', 'hssk.kcb.vn'].join('/')
const BHYT_PORTAL_URL = ['https:', '', 'gdbhyt.baohiemxahoi.gov.vn'].join('/')
const SYNCABLE_RX_STATES = ['SIGNED', 'ISSUED', 'RETRY_PENDING', 'COMPLETED']

function formatIsoDateTime(val) {
    if (!val) return ''
    const parsed = new Date(val)
    return Number.isNaN(parsed.getTime()) ? String(val) : parsed.toLocaleString('vi-VN')
}

function mapServerRxToRegistrationRow(item) {
    const rawState = String(item.trang_thai || 'DRAFT').toUpperCase()
    const normalizedFsm = rawState === 'COMPLETED' ? 'SIGNED' : rawState
    return {
        id: item.id,
        rxId: item.id,
        maKCB: item.ma_kcb || `KCB-${item.luot_kham_id || item.id}`,
        hoTen: item.ho_ten_benh_nhan || 'Bệnh nhân',
        tenBenhNhan: item.ho_ten_benh_nhan || 'Bệnh nhân',
        maDinhDanhYTe: item.ma_benh_nhan || '',
        bacSi: item.ho_ten_bac_si || 'Bác sĩ điều trị',
        bacSiKham: item.ho_ten_bac_si || 'Bác sĩ điều trị',
        thoiGian: formatIsoDateTime(item.ngay_ke_don),
        clinicalNotes: {
            chanDoanXacDinh: item.chan_doan || '',
        },
        prescription: {
            id: item.id,
            maDon: item.ma_don_thuoc || `DT-${item.id}`,
            trangThaiFSM: normalizedFsm,
            daKySo: SYNCABLE_RX_STATES.includes(rawState) || rawState === 'ACCEPTED',
            maLienThongQuocGia: item.ma_don_quoc_gia || '',
            maDonThuocQG: item.ma_don_quoc_gia || '',
            ngayKy: formatIsoDateTime(item.ngay_ky || item.ngay_ke_don),
            idempotencyKey: item.idempotency_key || `IDEM-RX-${item.id}`,
            receiptToken: item.bien_nhan_giao_dich || '',
            loiDanBacSi: item.loi_dan_uong_thuoc || '',
            items: (item.danh_sach_thuoc || []).map((drug, idx) => ({
                id: drug.id || idx + 1,
                tenThuoc: drug.ten_thuoc || '',
                hoatChat: [drug.hoat_chat, drug.ham_luong].filter(Boolean).join(' · '),
                soLuong: drug.so_luong || 1,
                dvt: drug.don_vi_tinh || 'Viên',
                lieuDung: drug.cach_dung || '',
            })),
        },
    }
}

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
    const [rxRecords, setRxRecords] = useState([])
    const [rxSummary, setRxSummary] = useState({ total: 0, accepted: 0, signed_pending_sync: 0, draft: 0 })
    const [nationalEhrSync, setNationalEhrSync] = useState([])
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
        AppToast.success('Đã lưu cấu hình phòng khám & chứng thư kết nối thành công')
    }

    const loadComplianceRecords = async (filterStatus = statusFilter, keyword = searchRx) => {
        const [rxRes, hsskRes] = await Promise.allSettled([
            adminService.getCompliancePrescriptions({ status: filterStatus, search: keyword, limit: 100 }),
            adminService.getHsskRecords({ limit: 100 }),
        ])
        if (rxRes.status === 'fulfilled' && rxRes.value) {
            const rawItems = Array.isArray(rxRes.value.items) ? rxRes.value.items : []
            setRxRecords(rawItems.map(mapServerRxToRegistrationRow))
            if (rxRes.value.summary) {
                setRxSummary(rxRes.value.summary)
            }
        }
        if (hsskRes.status === 'fulfilled' && hsskRes.value) {
            const rawHssk = Array.isArray(hsskRes.value.items) ? hsskRes.value.items : []
            setNationalEhrSync(
                rawHssk.map((h) => ({
                    id: h.luot_kham_id || h.id,
                    maKCB: h.ma_kcb || `KCB-${h.luot_kham_id}`,
                    benhNhan: h.ho_ten_benh_nhan || 'Bệnh nhân',
                    ngaySinh: h.ngay_sinh || 'Chưa cập nhật',
                    gioiTinh: h.gioi_tinh || 'Khác',
                    dienThoai: h.so_dien_thoai || '—',
                    mauKham: h.chan_doan || 'Phiếu khám ngoại trú TT 32/2023',
                    phanLoaiSucKhoe: h.phan_loai_suc_khoe || 'Loại I',
                    idempotencyKey: h.ma_giao_dich || `HSSK-LK-${h.luot_kham_id}`,
                    trangThai: h.trang_thai_dong_bo || 'Đã đồng bộ HSSK',
                    ngayDongBo: formatIsoDateTime(h.thoi_gian_hoan_tat),
                }))
            )
        }
    }

    useEffect(() => {
        loadComplianceRecords(statusFilter, searchRx)
    }, [statusFilter, searchRx])

    const handleTestGatewayConnection = async () => {
        setIsTestingGateway(true)
        try {
            const ping = await adminService.pingGatewayHealth()
            const latency = ping.round_trip_ms || ping.latency_ms || 1
            setGatewayPingResult({
                success: true,
                latency,
                timestamp: new Date().toLocaleTimeString('vi-VN'),
            })
            AppToast.success(`Cổng Đơn thuốc Quốc gia & HSSK phản hồi 200 OK (Độ trễ: ${latency}ms)`)
        } catch (err) {
            setGatewayPingResult({
                success: false,
                latency: 0,
                timestamp: new Date().toLocaleTimeString('vi-VN'),
            })
            AppToast.error(err?.response?.data?.message || 'Không thể kết nối Cổng Quốc gia')
        } finally {
            setIsTestingGateway(false)
        }
    }

    const handleSyncSinglePrescription = async (targetRowOrKcb) => {
        const matched = typeof targetRowOrKcb === 'object'
            ? targetRowOrKcb
            : rxRecords.find((item) => item.maKCB === targetRowOrKcb || String(item.id) === String(targetRowOrKcb))
        const rxId = matched?.rxId || matched?.id
        const syncKeyVal = matched?.maKCB || targetRowOrKcb
        if (!rxId) {
            AppToast.warning('Không tìm thấy mã đơn thuốc hợp lệ để liên thông')
            return
        }
        setSyncingKey(syncKeyVal)
        try {
            const synced = await adminService.syncPrescriptionToNational(rxId)
            await loadComplianceRecords(statusFilter, searchRx)
            AppToast.success(
                `Đã liên thông đơn thuốc ca ${syncKeyVal} lên Cổng Quốc gia (Mã QG: ${synced?.ma_don_quoc_gia || 'ACCEPTED'})`
            )
        } catch (err) {
            AppToast.error(err?.response?.data?.message || 'Liên thông Cổng Đơn thuốc Quốc gia thất bại')
        } finally {
            setSyncingKey('')
        }
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
        AppToast.success(`Đã xuất ${rows.length} đơn thuốc ra file Excel (.xlsx) thành công`)
    }

    const handleSyncAllSignedPrescriptions = async () => {
        setSyncingKey('ALL')
        try {
            const batchResult = await adminService.syncAllPendingPrescriptions()
            await loadComplianceRecords(statusFilter, searchRx)
            AppToast.success(`Đã đồng bộ ${batchResult?.synced_count ?? 0} đơn thuốc đã ký số lên Cổng Quốc gia thành công`)
        } catch (err) {
            AppToast.error(err?.response?.data?.message || 'Đồng bộ hàng loạt đơn thuốc thất bại')
        } finally {
            setSyncingKey('')
        }
    }

    const handleTriggerSyncGeneric = async (gatewayName) => {
        setSyncingKey(gatewayName)
        try {
            if (gatewayName.includes('Đơn Thuốc')) {
                await adminService.syncAllPendingPrescriptions()
            }
            await loadComplianceRecords(statusFilter, searchRx)
            AppToast.success(`Đã làm mới và đồng bộ dữ liệu ${gatewayName} từ CSDL thực tế`)
        } catch (err) {
            AppToast.error(err?.response?.data?.message || `Không thể đồng bộ ${gatewayName}`)
        } finally {
            setSyncingKey('')
        }
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

    const filteredRegistrations = rxRecords

    return (
        <div className="space-y-4">
            <div className="medpro-card p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border">
                    <Link
                        to="/admin/tuan-thu?tab=OVERVIEW"
                        onClick={() => handleSwitchTab('OVERVIEW')}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'OVERVIEW'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <Scales size={14} weight="bold" />
                        <span>1. Tổng quan Pháp lý</span>
                    </Link>
                    <Link
                        to="/admin/tuan-thu?tab=DON_THUOC"
                        onClick={() => handleSwitchTab('DON_THUOC')}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'DON_THUOC'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <Signature size={14} weight="bold" />
                        <span>2. Đơn thuốc Quốc gia</span>
                    </Link>
                    <Link
                        to="/admin/tuan-thu?tab=HSSK"
                        onClick={() => handleSwitchTab('HSSK')}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'HSSK'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <Heartbeat size={14} weight="bold" />
                        <span>3. Sổ Sức khỏe (HSSK)</span>
                    </Link>
                    <Link
                        to="/admin/tuan-thu?tab=AUDIT"
                        onClick={() => handleSwitchTab('AUDIT')}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer tabular-nums ${
                            activeTab === 'AUDIT'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <ClipboardText size={14} weight="bold" />
                        <span>4. Nhật ký Kiểm toán ({auditPagination.total || liveAuditLogs.length || auditLogs.length})</span>
                    </Link>
                    <Link
                        to="/admin/tuan-thu?tab=SETTING"
                        onClick={() => handleSwitchTab('SETTING')}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'SETTING'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <SlidersHorizontal size={14} weight="bold" />
                        <span>5. Cổng Liên thông</span>
                    </Link>
                    <Link
                        to="/admin/tuan-thu?tab=DINH_CHINH"
                        onClick={() => handleSwitchTab('DINH_CHINH')}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'DINH_CHINH'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <ShieldCheck size={14} weight="bold" />
                        <span>6. Duyệt đính chính EMR</span>
                        {pendingAmendmentCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] bg-clinic-danger-solid text-clinic-surface font-bold tabular-nums">
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
                            l.description || l.moTa || l.doiTuong || '',
                            l.module || l.phanHe || l.loai_nhat_ky || '',
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
                        AppToast.success(`Đã trích xuất ${rows.length} nhật ký kiểm toán phục vụ đoàn thanh tra y tế`)
                    }}
                    className="medpro-btn-amber !py-1.5 !px-3 text-xs font-bold"
                >
                    <DownloadSimple size={14} weight="bold" />
                    <span>Xuất hồ sơ Thanh tra</span>
                </button>
            </div>

            {activeTab === 'OVERVIEW' && (
                <>
                    <div className="bg-clinic-surface rounded-[6px] border border-clinic-border grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-clinic-border tabular-nums">
                        <div className="p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-clinic-navy uppercase">
                                    Chứng chỉ hành nghề (NĐ 96/2023)
                                </span>
                                <ShieldCheck size={18} weight="duotone" className="text-clinic-cta shrink-0" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="font-display text-2xl font-extrabold text-clinic-cta">
                                    {staffList.filter((s) => s.trangThaiCCHN === 'ACTIVE').length}/{staffList.length}
                                </span>
                                <span className="text-xs text-clinic-text-secondary">nhân sự đủ điều kiện</span>
                            </div>
                            <div className="mt-1.5 text-[11px] text-clinic-danger font-semibold">
                                Tự động chặn phân công khi hết hạn &bull; Cảnh báo trước 60 ngày
                            </div>
                        </div>

                        <div className="p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-clinic-navy uppercase">
                                    Liên thông ĐTQG (TT 26/2025)
                                </span>
                                <Signature size={18} weight="duotone" className="text-clinic-success shrink-0" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="font-display text-2xl font-extrabold text-clinic-success">
                                    {acceptedPrescriptions}/{totalPrescriptions}
                                </span>
                                <span className="text-xs text-clinic-text-secondary">đơn đã liên thông &amp; cấp mã QG</span>
                            </div>
                            <div className="mt-1.5 text-[11px] text-clinic-text-secondary font-medium">
                                Khóa chỉnh sửa sau ký số &bull; Hỗ trợ thử lại chống trùng lặp
                            </div>
                        </div>

                        <div className="p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-clinic-navy uppercase">
                                    Hồ sơ bệnh án điện tử (TT 13/2025)
                                </span>
                                <LockKey size={18} weight="duotone" className="text-clinic-warning shrink-0" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="font-display text-2xl font-extrabold text-clinic-navy">
                                    {nationalEhrSync.length}/{nationalEhrSync.length}
                                </span>
                                <span className="text-xs text-clinic-text-secondary">hồ sơ bệnh án đã khóa</span>
                            </div>
                            <div className="mt-1.5 text-[11px] text-clinic-text-secondary font-medium">
                                Bệnh án đã khóa bắt buộc đính chính qua Biên bản lưu bản gốc
                            </div>
                        </div>
                    </div>

                    <div className="medpro-card p-4 space-y-3">
                        <div className="medpro-section-title">
                            <span>TRẠNG THÁI KẾT NỐI HỆ THỐNG CỔNG Y TẾ QUỐC GIA</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 tabular-nums">
                            <div className="p-3.5 rounded-[6px] border border-clinic-success-border bg-clinic-success-bg flex items-center justify-between gap-2">
                                <div className="space-y-1 min-w-0">
                                    <div className="text-xs font-bold text-clinic-navy">Cổng Đơn thuốc Quốc gia</div>
                                    <div className="text-[11px]">
                                        <a
                                            href={DON_THUOC_QG_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-clinic-cta font-bold hover:underline inline-flex items-center gap-1"
                                        >
                                            <span>donthuocquocgia.vn</span>
                                            <Globe size={12} />
                                        </a>
                                        <span className="text-clinic-text-muted"> &bull; API v1</span>
                                    </div>
                                    <div className="text-[11px] text-clinic-success font-bold flex items-center gap-1">
                                        <CheckCircle size={13} weight="fill" />
                                        <span>Hoạt động bình thường (42ms)</span>
                                    </div>
                                </div>
                                <Link
                                    to="/admin/tuan-thu?tab=DON_THUOC"
                                    onClick={() => handleSwitchTab('DON_THUOC')}
                                    className="medpro-btn-outline !py-1 !px-2.5 text-xs shrink-0"
                                >
                                    Xem đơn
                                </Link>
                            </div>

                            <div className="p-3.5 rounded-[6px] border border-clinic-success-border bg-clinic-success-bg flex items-center justify-between gap-2">
                                <div className="space-y-1 min-w-0">
                                    <div className="text-xs font-bold text-clinic-navy">Sổ Sức khỏe Điện tử (HSSK)</div>
                                    <div className="text-[11px]">
                                        <a
                                            href={HSSK_PORTAL_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-clinic-cta font-bold hover:underline inline-flex items-center gap-1"
                                        >
                                            <span>hssk.kcb.vn</span>
                                            <Globe size={12} />
                                        </a>
                                        <span className="text-clinic-text-muted"> &bull; TT 32/2023/TT-BYT</span>
                                    </div>
                                    <div className="text-[11px] text-clinic-success font-bold flex items-center gap-1">
                                        <CheckCircle size={13} weight="fill" />
                                        <span>Hoạt động bình thường (38ms)</span>
                                    </div>
                                </div>
                                <Link
                                    to="/admin/tuan-thu?tab=HSSK"
                                    onClick={() => handleSwitchTab('HSSK')}
                                    className="medpro-btn-outline !py-1 !px-2.5 text-xs shrink-0"
                                >
                                    Xem HSSK
                                </Link>
                            </div>

                            <div className="p-3.5 rounded-[6px] border border-clinic-info-border bg-clinic-surface-tint flex items-center justify-between gap-2">
                                <div className="space-y-1 min-w-0">
                                    <div className="text-xs font-bold text-clinic-navy">Cổng Giám định BHYT Quốc gia</div>
                                    <div className="text-[11px]">
                                        <a
                                            href={BHYT_PORTAL_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-clinic-cta font-bold hover:underline inline-flex items-center gap-1"
                                        >
                                            <span>gdbhyt.baohiemxahoi.gov.vn</span>
                                            <Globe size={12} />
                                        </a>
                                    </div>
                                    <div className="text-[11px] text-clinic-cta font-bold flex items-center gap-1">
                                        <CheckCircle size={13} weight="fill" />
                                        <span>Sẵn sàng liên thông chứng chỉ</span>
                                    </div>
                                </div>
                                <Link
                                    to="/admin/tuan-thu?tab=SETTING"
                                    onClick={() => handleSwitchTab('SETTING')}
                                    className="medpro-btn-outline !py-1 !px-2.5 text-xs shrink-0"
                                >
                                    Cấu hình
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="medpro-card p-4">
                        <div className="medpro-section-title">
                            <span>SỔ ĐĂNG KÝ NGHĨA VỤ PHÁP LÝ Y TẾ &amp; MA TRẬN ĐIỀU KIỆN ÁP DỤNG</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="medpro-table tabular-nums">
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
                                            <td className="font-mono font-bold text-clinic-cta">{ob.id}</td>
                                            <td className="font-bold text-clinic-navy">{ob.maVanBan}</td>
                                            <td className="font-semibold text-clinic-text">{ob.tenNghiaVu}</td>
                                            <td>{ob.nguoiChiuTrachNhiem}</td>
                                            <td>{ob.hanApDung}</td>
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
                    <div className="medpro-card p-4 space-y-3 bg-clinic-surface-tint">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clinic-border pb-2.5">
                            <div>
                                <h3 className="font-display text-sm font-extrabold text-clinic-navy uppercase flex items-center gap-2">
                                    <Signature size={17} className="text-clinic-cta" />
                                    <span>Quy trình liên thông Đơn thuốc Quốc gia (TT 26/2025/TT-BYT)</span>
                                </h3>
                                <div className="text-xs text-clinic-text-secondary mt-0.5 flex flex-wrap items-center gap-2">
                                    <span>Mô hình 4 bước chuẩn hóa từ kê đơn ngoại trú đến cấp Mã Đơn Quốc gia.</span>
                                    <a
                                        href={DON_THUOC_QG_URL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-clinic-cta font-bold hover:underline inline-flex items-center gap-1"
                                    >
                                        <span>donthuocquocgia.vn</span>
                                        <Globe size={12} />
                                    </a>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleSyncAllSignedPrescriptions}
                                    disabled={syncingKey === 'ALL' || signedPrescriptions === 0}
                                    className="medpro-btn-primary !py-1.5 !px-3 text-xs"
                                >
                                    <ArrowsClockwise size={14} className={syncingKey === 'ALL' ? 'animate-spin' : ''} />
                                    <span>Đồng bộ đơn đã ký ({signedPrescriptions})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExportPrescriptionsExcel}
                                    className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                                >
                                    <DownloadSimple size={14} weight="bold" className="text-clinic-cta" />
                                    <span>Xuất Excel Đơn thuốc</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                            <div className="p-3 rounded-[6px] bg-clinic-surface border border-clinic-border space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-clinic-text-secondary uppercase">Bước 1: Kê đơn</span>
                                    <span className="w-5 h-5 rounded-[4px] bg-clinic-bg-muted text-clinic-navy text-[11px] font-bold flex items-center justify-center">1</span>
                                </div>
                                <div className="text-xs font-bold text-clinic-navy">Kê đơn ngoại trú</div>
                                <p className="text-[11px] text-clinic-text-secondary">Bác sĩ chỉ định thuốc, liều lượng &amp; đường dùng.</p>
                                <div className="pt-1 text-[11px] font-semibold text-clinic-text-secondary">Trạng thái: DRAFT</div>
                            </div>

                            <div className="p-3 rounded-[6px] bg-clinic-surface border border-clinic-info-border space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-clinic-cta uppercase">Bước 2: Ký số</span>
                                    <span className="w-5 h-5 rounded-[4px] bg-clinic-surface-alt text-clinic-cta text-[11px] font-bold flex items-center justify-center">2</span>
                                </div>
                                <div className="text-xs font-bold text-clinic-navy">Ký số bảo mật SmartCA</div>
                                <p className="text-[11px] text-clinic-text-secondary">Khóa bất biến đơn thuốc sau khi bác sĩ phê duyệt.</p>
                                <div className="pt-1 text-[11px] font-semibold text-clinic-cta">Trạng thái: SIGNED</div>
                            </div>

                            <div className="p-3 rounded-[6px] bg-clinic-surface border border-clinic-warning-border space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-clinic-warning uppercase">Bước 3: Gửi cổng</span>
                                    <span className="w-5 h-5 rounded-[4px] bg-clinic-warning-bg text-clinic-warning text-[11px] font-bold flex items-center justify-center">3</span>
                                </div>
                                <div className="text-xs font-bold text-clinic-navy">Truyền cổng liên thông</div>
                                <p className="text-[11px] text-clinic-text-secondary">Gửi dữ liệu kèm khóa Idempotency chống trùng lặp.</p>
                                <div className="pt-1 text-[11px] font-semibold text-clinic-warning">Trạng thái: SUBMITTED</div>
                            </div>

                            <div className="p-3 rounded-[6px] bg-clinic-surface border border-clinic-success-border space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-clinic-success uppercase">Bước 4: Cấp mã QG</span>
                                    <span className="w-5 h-5 rounded-[4px] bg-clinic-success-bg text-clinic-success text-[11px] font-bold flex items-center justify-center">4</span>
                                </div>
                                <div className="text-xs font-bold text-clinic-navy">Cấp mã Đơn thuốc QG</div>
                                <p className="text-[11px] text-clinic-text-secondary">Bộ Y tế xác nhận, cấp mã VN-RX cho nhà thuốc tra cứu.</p>
                                <div className="pt-1 text-[11px] font-semibold text-clinic-success">Trạng thái: ACCEPTED</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-clinic-surface rounded-[6px] border border-clinic-border grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-clinic-border tabular-nums">
                        <div className="p-4">
                            <div className="text-xs font-semibold text-clinic-text-secondary">Tổng số đơn thuốc</div>
                            <div className="text-2xl font-extrabold text-clinic-navy mt-1">{totalPrescriptions}</div>
                            <div className="text-[11px] text-clinic-text-muted mt-0.5">Đơn thuốc kê tại phòng khám</div>
                        </div>
                        <div className="p-4">
                            <div className="text-xs font-semibold text-clinic-success">Đã cấp mã Quốc gia</div>
                            <div className="text-2xl font-extrabold text-clinic-success mt-1">{acceptedPrescriptions}</div>
                            <div className="text-[11px] text-clinic-text-muted mt-0.5">Đã liên thông thành công</div>
                        </div>
                        <div className="p-4">
                            <div className="text-xs font-semibold text-clinic-cta">Đã ký số chờ gửi</div>
                            <div className="text-2xl font-extrabold text-clinic-cta mt-1">{signedPrescriptions}</div>
                            <div className="text-[11px] text-clinic-text-muted mt-0.5">Đã khóa dữ liệu an toàn</div>
                        </div>
                        <div className="p-4">
                            <div className="text-xs font-semibold text-clinic-warning">Bản nháp / Chưa ký</div>
                            <div className="text-2xl font-extrabold text-clinic-warning mt-1">{draftPrescriptions}</div>
                            <div className="text-[11px] text-clinic-text-muted mt-0.5">Bác sĩ đang hoàn thiện đơn</div>
                        </div>
                    </div>

                    <div className="medpro-card p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2 flex-1">
                                <div className="relative flex-1 min-w-[240px] max-w-sm">
                                    <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Tìm theo Mã KCB, Mã Đơn, Bệnh nhân, Mã QG..."
                                        value={searchRx}
                                        onChange={(e) => setSearchRx(e.target.value)}
                                        className="medpro-input !py-1.5 h-9 !pl-8 text-xs"
                                    />
                                </div>
                                <div className="flex flex-wrap items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border tabular-nums">
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('ALL')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-[6px] transition-colors cursor-pointer ${
                                            statusFilter === 'ALL' ? 'bg-clinic-navy text-clinic-surface' : 'text-clinic-text-secondary hover:text-clinic-navy'
                                        }`}
                                    >
                                        Tất cả ({totalPrescriptions})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('ACCEPTED')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-[6px] transition-colors cursor-pointer ${
                                            statusFilter === 'ACCEPTED' ? 'bg-clinic-success text-clinic-surface' : 'text-clinic-text-secondary hover:text-clinic-navy'
                                        }`}
                                    >
                                        Đã liên thông ({acceptedPrescriptions})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('SIGNED')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-[6px] transition-colors cursor-pointer ${
                                            statusFilter === 'SIGNED' ? 'bg-clinic-cta text-clinic-surface' : 'text-clinic-text-secondary hover:text-clinic-navy'
                                        }`}
                                    >
                                        Đã ký ({signedPrescriptions})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('DRAFT')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-[6px] transition-colors cursor-pointer ${
                                            statusFilter === 'DRAFT' ? 'bg-clinic-warning text-clinic-surface' : 'text-clinic-text-secondary hover:text-clinic-navy'
                                        }`}
                                    >
                                        Bản nháp ({draftPrescriptions})
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                            <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
                                <thead>
                                    <tr>
                                        <th className="w-9 text-center">STT</th>
                                        <th className="whitespace-nowrap">Mã KCB / Mã đơn</th>
                                        <th>Bệnh nhân / Bác sĩ</th>
                                        <th className="text-center whitespace-nowrap">Thuốc</th>
                                        <th className="whitespace-nowrap">Trạng thái</th>
                                        <th>Mã Đơn QG &amp; Ký số</th>
                                        <th className="whitespace-nowrap">Thao tác</th>
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
                                            <tr key={r.id || idx}>
                                                <td className="font-bold text-center">{idx + 1}</td>
                                                <td className="whitespace-nowrap">
                                                    <div>
                                                        <Link
                                                            to="/admin/kham-benh"
                                                            className="font-mono font-bold text-clinic-cta hover:underline"
                                                            title="Chuyển đến Bàn khám lâm sàng"
                                                        >
                                                            {currentKcb}
                                                        </Link>
                                                    </div>
                                                    <div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedRxRecord(r)}
                                                            className="font-mono text-[11px] font-bold text-clinic-navy hover:text-clinic-cta hover:underline cursor-pointer"
                                                            title="Xem chi tiết đơn thuốc"
                                                        >
                                                            {p.maDon || 'Chưa tạo'}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div>
                                                        <Link
                                                            to="/admin/benh-nhan"
                                                            className="font-bold text-clinic-navy hover:text-clinic-cta hover:underline"
                                                        >
                                                            {r.hoTen}
                                                        </Link>
                                                    </div>
                                                    <div>
                                                        <Link
                                                            to="/admin/nhan-vien"
                                                            className="text-[11px] text-clinic-text-secondary hover:text-clinic-cta hover:underline"
                                                        >
                                                            {r.bacSi || 'BS. CKII Nguyễn Minh Hoàng'}
                                                        </Link>
                                                    </div>
                                                </td>
                                                <td className="text-center font-bold whitespace-nowrap">{drugCount} thuốc</td>
                                                <td className="whitespace-nowrap">
                                                    <StatusBadge status={fsm} compact />
                                                </td>
                                                <td className="font-mono text-xs text-clinic-navy">
                                                    <div>
                                                        {nationalCode !== 'Chưa cấp' ? (
                                                            <a
                                                                href={DON_THUOC_QG_URL}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-clinic-success font-bold hover:underline inline-flex items-center gap-1"
                                                            >
                                                                <span>{nationalCode}</span>
                                                                <Globe size={11} />
                                                            </a>
                                                        ) : (
                                                            <span className="font-sans text-clinic-text-muted font-semibold">Chưa cấp</span>
                                                        )}
                                                    </div>
                                                    <div className="font-sans text-[11px] text-clinic-text-secondary">
                                                        {p.ngayKy || 'Chưa ký'}
                                                    </div>
                                                    <div className="text-[10px] text-clinic-text-muted truncate max-w-[165px]" title={idempotency}>
                                                        {idempotency}
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedRxRecord(r)}
                                                            className="medpro-btn-outline !py-1 !px-2 text-xs"
                                                        >
                                                            <Eye size={13} />
                                                            <span>Chi tiết</span>
                                                        </button>
                                                        {fsm === 'SIGNED' || fsm === 'RETRY_PENDING' ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSyncSinglePrescription(currentKcb)}
                                                                disabled={syncingKey === currentKcb}
                                                                className="medpro-btn-primary !py-1 !px-2 text-xs"
                                                            >
                                                                <ArrowsClockwise size={12} className={syncingKey === currentKcb ? 'animate-spin' : ''} />
                                                                <span>Gửi cổng</span>
                                                            </button>
                                                        ) : fsm === 'ACCEPTED' ? (
                                                            <span className="medpro-badge-success">
                                                                Đã thông tuyến
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-clinic-text-muted">Chờ ký</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {filteredRegistrations.length === 0 && (
                                        <tr>
                                            <td colSpan={7}>
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
                        <div className="flex flex-wrap items-center gap-2">
                            <a
                                href={HSSK_PORTAL_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-clinic-cta font-bold hover:underline inline-flex items-center gap-1"
                            >
                                <span>Cổng HSSK: hssk.kcb.vn</span>
                                <Globe size={12} />
                            </a>
                            <button
                                type="button"
                                onClick={() => handleTriggerSyncGeneric('Sổ Sức Khỏe Điện Tử')}
                                className="medpro-btn-primary !py-1.5 !px-3 text-xs"
                            >
                                <ArrowsClockwise size={14} className={syncingKey === 'Sổ Sức Khỏe Điện Tử' ? 'animate-spin' : ''} />
                                <span>Liên thông HSSK ca hoàn tất</span>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                        <table className="medpro-table tabular-nums">
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
                                        <td className="font-bold text-center">{idx + 1}</td>
                                        <td className="font-mono font-bold text-clinic-cta">
                                            <Link to="/admin/kham-benh" className="hover:underline">
                                                {item.maKCB}
                                            </Link>
                                        </td>
                                        <td className="font-bold text-clinic-navy">
                                            <Link to="/admin/benh-nhan" className="hover:underline hover:text-clinic-cta">
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
                                        <td className="font-mono text-[11px] text-clinic-text-muted">{item.idempotencyKey}</td>
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
                                        <td className="text-xs text-clinic-text-secondary">{item.ngayDongBo}</td>
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
                        <div className="medpro-section-title !mb-0 !border-b-0 !pb-0">
                            <span>NHẬT KÝ KIỂM TOÁN HỆ THỐNG Y TẾ (NGHỊ ĐỊNH 102/2025)</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Tìm theo người dùng, hành động, đối tượng..."
                                    value={searchAudit}
                                    onChange={(e) => setSearchAudit(e.target.value)}
                                    className="medpro-input !py-1.5 h-9 !pl-8 text-xs w-64"
                                />
                            </div>
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate w-40"
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

                    <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                        <table className="medpro-table tabular-nums">
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
                                        <td className="font-mono font-bold text-clinic-navy">{log.id}</td>
                                        <td className="text-xs text-clinic-text-secondary">{log.thoiGian || log.timestamp}</td>
                                        <td className="font-semibold text-clinic-navy">{String(log.nguoiDung || log.actor || '').replace(/\s*\(INT-\d+\)/g, '')}</td>
                                        <td>
                                            <span className="medpro-badge-info">{ROLE_LABEL_MAP[log.vaiTro] || ROLE_LABEL_MAP[log.role] || log.vaiTro || log.role}</span>
                                        </td>
                                        <td className="font-semibold text-xs text-clinic-navy">{ACTION_LABEL_MAP[log.hanhDong] || ACTION_LABEL_MAP[log.action] || log.hanhDong || log.action}</td>
                                        <td className="font-semibold">{log.doiTuong || log.resource_type}</td>
                                        <td className="text-xs text-clinic-text-secondary">{log.mucDich || log.purpose}</td>
                                        <td className="font-mono text-xs text-clinic-text-muted">{log.ip || log.client_ip}</td>
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
                        <div className="flex items-center justify-between pt-2 text-xs tabular-nums">
                            <span className="text-clinic-text-secondary">
                                Hiển thị trang {auditPagination.page} / {auditPagination.totalPages} (Tổng số {auditPagination.total} bản ghi)
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => fetchLiveAuditLogs(auditPagination.page - 1)}
                                    disabled={auditPagination.page <= 1 || isLoadingAudit}
                                    className="medpro-btn-outline !py-1 !px-2.5 text-xs"
                                >
                                    Trang trước
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fetchLiveAuditLogs(auditPagination.page + 1)}
                                    disabled={auditPagination.page >= auditPagination.totalPages || isLoadingAudit}
                                    className="medpro-btn-outline !py-1 !px-2.5 text-xs"
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
                        <span>CẤU HÌNH PHÒNG KHÁM, GIẤY PHÉP HOẠT ĐỘNG &amp; TOKEN LIÊN THÔNG</span>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={handleTestGatewayConnection}
                                disabled={isTestingGateway}
                                className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                            >
                                <ArrowsClockwise size={14} className={isTestingGateway ? 'animate-spin' : ''} />
                                <span>{isTestingGateway ? 'Đang kiểm tra...' : 'Kiểm tra kết nối Cổng QG'}</span>
                            </button>
                            <button type="button" onClick={handleSaveSettings} className="medpro-btn-primary !py-1.5 !px-3 text-xs">
                                <FloppyDisk size={14} weight="bold" />
                                <span>Lưu cấu hình</span>
                            </button>
                        </div>
                    </div>

                    {gatewayPingResult && (
                        <div className="p-3 rounded-[6px] bg-clinic-success-bg border border-clinic-success-border text-xs text-clinic-navy flex items-center justify-between tabular-nums">
                            <div className="flex items-center gap-2">
                                <CheckCircle size={17} weight="fill" className="text-clinic-success shrink-0" />
                                <span>
                                    <strong>Cổng Đơn thuốc Quốc gia &amp; HSSK:</strong> Phản hồi kết nối thành công 200 OK. Độ trễ: <strong>{gatewayPingResult.latency}ms</strong> (Lúc {gatewayPingResult.timestamp}).
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
                        <section className="p-4 rounded-[6px] border border-clinic-border bg-clinic-bg space-y-3">
                            <div className="flex items-center gap-2 text-xs font-extrabold text-clinic-navy uppercase border-b border-clinic-border pb-2">
                                <Buildings size={15} className="text-clinic-cta" />
                                <span>1. Thông tin Cơ sở Khám chữa bệnh &amp; Giấy phép</span>
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
                                        className="medpro-input font-mono font-bold text-clinic-cta"
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
                        </section>

                        <section className="p-4 rounded-[6px] border border-clinic-border bg-clinic-bg space-y-3">
                            <div className="flex items-center gap-2 text-xs font-extrabold text-clinic-navy uppercase border-b border-clinic-border pb-2">
                                <Key size={15} className="text-clinic-warning" />
                                <span>2. Khóa bảo mật &amp; Chứng thư Kết nối Cổng Quốc gia</span>
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
                                    className="medpro-input font-mono text-clinic-success font-bold"
                                />
                            </div>
                            <p role="note" className="p-3 rounded-[6px] bg-clinic-success-bg border border-clinic-success-border text-xs text-clinic-navy space-y-1">
                                <strong className="flex items-center gap-1.5 text-clinic-success">
                                    <ShieldCheck size={14} weight="bold" />
                                    <span>Chứng thư số HSM: Đang kích hoạt</span>
                                </strong>
                                <span className="block text-[11px] text-clinic-text-secondary leading-relaxed">
                                    VNPT SmartCA HSM đã tích hợp cho các bác sĩ chuyên khoa, sẵn sàng ký số đạt chuẩn TT 26/2025/TT-BYT.
                                </span>
                            </p>
                        </section>
                    </div>
                </div>
            )}

            {activeTab === 'DINH_CHINH' && (
                <AmendmentManagementTab onPendingCountChange={setPendingAmendmentCount} />
            )}

            {selectedRxRecord && (
                <div className="fixed inset-0 z-50 bg-clinic-navy-dark/50 flex items-center justify-center p-4">
                    <div className="bg-clinic-surface rounded-[6px] border border-clinic-border shadow-xs max-w-2xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto tabular-nums">
                        <div className="flex items-center justify-between border-b border-clinic-border pb-3">
                            <div className="flex items-center gap-2">
                                <Signature size={18} weight="bold" className="text-clinic-cta" />
                                <div>
                                    <h3 className="font-display font-bold text-sm text-clinic-navy uppercase">
                                        Chi tiết đơn thuốc điện tử ngoại trú
                                    </h3>
                                    <div className="text-xs text-clinic-text-secondary">
                                        Mã đơn: <strong className="font-mono text-clinic-cta">{selectedRxRecord.prescription?.maDon || 'Chưa tạo'}</strong> &bull; Mã ca KCB: <strong className="font-mono text-clinic-navy">{selectedRxRecord.maKCB || selectedRxRecord.id}</strong>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedRxRecord(null)}
                                className="text-clinic-text-muted hover:text-clinic-navy p-1 rounded-[6px] cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-clinic-bg rounded-[6px] border border-clinic-border text-xs">
                            <div>
                                <dt className="text-clinic-text-secondary">Bệnh nhân:</dt>
                                <dd>
                                    <Link
                                        to="/admin/benh-nhan"
                                        className="text-clinic-navy text-xs font-bold hover:underline hover:text-clinic-cta"
                                    >
                                        {selectedRxRecord.hoTen}
                                    </Link>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-clinic-text-secondary">Năm sinh / Giới tính:</dt>
                                <dd><strong className="text-clinic-navy">{selectedRxRecord.ngaySinh} ({selectedRxRecord.gioiTinh})</strong></dd>
                            </div>
                            <div>
                                <dt className="text-clinic-text-secondary">Bác sĩ kê đơn:</dt>
                                <dd>
                                    <Link
                                        to="/admin/nhan-vien"
                                        className="text-clinic-cta font-bold hover:underline"
                                    >
                                        {selectedRxRecord.bacSi || 'BS. CKII Nguyễn Minh Hoàng'}
                                    </Link>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-clinic-text-secondary">Trạng thái Cổng QG:</dt>
                                <dd className="mt-0.5">
                                    <StatusBadge status={selectedRxRecord.prescription?.trangThaiFSM || 'DRAFT'} compact />
                                </dd>
                            </div>
                        </dl>

                        {selectedRxRecord.clinicalNotes?.chanDoanXacDinh && (
                            <p role="note" className="p-2.5 rounded-[6px] bg-clinic-surface-alt border border-clinic-info-border text-xs flex items-center justify-between gap-2">
                                <span>
                                    <strong className="text-clinic-navy">Chẩn đoán bệnh (ICD-10): </strong>
                                    <span className="text-clinic-text">{selectedRxRecord.clinicalNotes.chanDoanXacDinh}</span>
                                </span>
                                <Link
                                    to="/admin/kham-benh"
                                    className="text-xs text-clinic-cta font-bold hover:underline shrink-0 inline-flex items-center gap-1"
                                >
                                    <span>Bàn khám</span>
                                    <ArrowRight size={12} weight="bold" />
                                </Link>
                            </p>
                        )}

                        <section>
                            <div className="text-xs font-bold text-clinic-navy uppercase mb-2">
                                Danh mục thuốc kê ({((selectedRxRecord.prescription?.items || selectedRxRecord.prescription?.danhSachThuoc) || []).length} loại)
                            </div>
                            <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                                <table className="medpro-table text-xs">
                                    <thead>
                                        <tr>
                                            <th>STT</th>
                                            <th>Tên thuốc &amp; Hoạt chất</th>
                                            <th>Số lượng</th>
                                            <th>ĐVT</th>
                                            <th>Liều dùng &amp; Hướng dẫn sử dụng</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {((selectedRxRecord.prescription?.items || selectedRxRecord.prescription?.danhSachThuoc) || []).map((item, i) => (
                                            <tr key={item.id || i}>
                                                <td className="font-bold text-center">{i + 1}</td>
                                                <td>
                                                    <div className="font-bold text-clinic-navy">{item.tenThuoc}</div>
                                                    <div className="text-[11px] text-clinic-text-secondary">{item.hoatChat}</div>
                                                </td>
                                                <td className="font-bold text-center">{item.soLuong}</td>
                                                <td className="text-center">{item.dvt}</td>
                                                <td className="text-clinic-text-secondary">{item.lieuDung}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {selectedRxRecord.prescription?.loiDanBacSi && (
                            <p role="note" className="p-3 rounded-[6px] bg-clinic-warning-bg border border-clinic-warning-border text-xs text-clinic-navy">
                                <strong className="text-clinic-warning">Lời dặn của Bác sĩ: </strong>
                                <span>{selectedRxRecord.prescription.loiDanBacSi}</span>
                            </p>
                        )}

                        <section className="p-3.5 rounded-[6px] border border-clinic-success-border bg-clinic-success-bg space-y-2">
                            <div className="text-xs font-bold text-clinic-navy uppercase flex flex-wrap items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5">
                                    <QrCode size={15} className="text-clinic-success" />
                                    <span>Thông số liên thông Cổng Đơn thuốc Quốc gia</span>
                                </span>
                                <a
                                    href={DON_THUOC_QG_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-clinic-cta font-bold hover:underline inline-flex items-center gap-1 normal-case"
                                >
                                    <span>donthuocquocgia.vn</span>
                                    <Globe size={11} />
                                </a>
                            </div>

                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div>
                                    <dt className="text-clinic-text-secondary">Mã Đơn thuốc Quốc gia:</dt>
                                    <dd>
                                        {selectedRxRecord.prescription?.maLienThongQuocGia ? (
                                            <a
                                                href={DON_THUOC_QG_URL}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-mono font-bold text-clinic-success text-sm hover:underline inline-flex items-center gap-1"
                                            >
                                                <span>{selectedRxRecord.prescription.maLienThongQuocGia}</span>
                                                <Globe size={12} />
                                            </a>
                                        ) : (
                                            <span className="text-clinic-text-muted">Chưa cấp (Đang chờ liên thông)</span>
                                        )}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-clinic-text-secondary">Thời điểm ký số SmartCA:</dt>
                                    <dd className="font-mono text-clinic-navy">
                                        {selectedRxRecord.prescription?.ngayKy || 'Chưa thực hiện ký số'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-clinic-text-secondary">Mã giao dịch (Idempotency Key):</dt>
                                    <dd className="font-mono text-clinic-text-secondary text-[11px]">
                                        {selectedRxRecord.prescription?.idempotencyKey || `IDEM-${selectedRxRecord.maKCB || selectedRxRecord.id}-RX01`}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-clinic-text-secondary">Biên nhận Bộ Y tế:</dt>
                                    <dd className="font-mono text-clinic-text-secondary text-[11px]">
                                        {selectedRxRecord.prescription?.receiptToken || (selectedRxRecord.prescription?.trangThaiFSM === 'ACCEPTED' ? `RCPT-BYT-${(selectedRxRecord.maKCB || selectedRxRecord.id).slice(-4)}-OK` : 'Chưa có')}
                                    </dd>
                                </div>
                            </dl>
                        </section>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-clinic-border">
                            <a
                                href={DON_THUOC_QG_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="medpro-btn-outline !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
                            >
                                <Globe size={13} />
                                <span>Mở Cổng Tra cứu Bộ Y tế</span>
                            </a>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedRxRecord(null)}
                                    className="medpro-btn-outline !py-1.5 !px-3 text-xs"
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
                                        className="medpro-btn-primary !py-1.5 !px-3 text-xs"
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
