import { useState, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { getDashboardStatsAsync } from '../../redux/actions/admin/adminAction'
import { clinicalEventBridge, CLINICAL_EVENTS } from '../../services/clinicalEventBridge'
import { getNavigationConfig } from '../../utils/helpers/clinicConfigHelpers'
import { mapDoctorPerformanceItems } from '../../utils/helpers/doctorPerformanceMapping'
import { formatUnifiedDoctorName } from '../../utils/helpers/doctorNameHelper'
import { getOffsetIsoDate, getTodayIsoDate } from '../../utils/helpers/quickBookingHelpers'
import { adminService } from '../../services/admin/AdminService'
import { exportToExcel } from '../../utils/helpers/exportUtils'
import { AppToast } from '../../components/common/AppNotification'
import {
    ClinicIcon,
    StatusBadge,
    Scales,
    ShieldCheck,
    ArrowRight,
    Clock,
    Receipt,
    ChartBar,
    DownloadSimple,
} from '../../components/common/ClinicIcon'

const OPERATIONAL_PORTAL_LINKS = [
    {
        role: 'Lễ tân & Tiếp đón',
        title: 'Cổng Tiếp Đón & Điều Phối Hàng Chờ',
        desc: 'Tra cứu SĐT/CCCD, check-in lịch hẹn & quản lý hàng chờ realtime',
        path: '/reception/dashboard',
        icon: 'ClipboardText',
    },
    {
        role: 'Bác sĩ khám bệnh',
        title: 'Cổng Khám Lâm Sàng & Kê Đơn Điện Tử',
        desc: 'Bàn khám chuyên khoa, sinh hiệu, chẩn đoán ICD-10 & chỉ định CLS',
        path: '/doctor',
        icon: 'Stethoscope',
    },
    {
        role: 'Kỹ thuật viên CLS',
        title: 'Cổng Xét Nghiệm & Chẩn Đoán Hình Ảnh',
        desc: 'Tiếp nhận phiếu chỉ định, nhập kết quả xét nghiệm, siêu âm, X-quang',
        path: '/staff/paraclinical-work',
        icon: 'Microscope',
    },
    {
        role: 'Thu ngân viện phí',
        title: 'Cổng Thu Viện Phí và Đối Soát Ca',
        desc: 'Thanh toán VietQR hoặc tiền mặt, xuất biên lai và khóa sổ ca',
        path: '/staff/cashier',
        icon: 'Receipt',
    },
]

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

export default function DashboardAdminPage() {
    const dispatch = useDispatch()
    const { clinicData, stats } = useSelector((state) => state.app.admin)
    const { dashboardQuickModules = [] } = getNavigationConfig(clinicData)

    const [activeViewTab, setActiveViewTab] = useState('DIEU_HANH')
    const [timeFilter, setTimeFilter] = useState('week')

    const timeRange = useMemo(() => {
        const denNgay = getTodayIsoDate()
        if (timeFilter === 'today') {
            return { tuNgay: denNgay, denNgay, periodLabel: 'Hôm nay' }
        }
        if (timeFilter === 'month') {
            return { tuNgay: getOffsetIsoDate(-29), denNgay, periodLabel: '30 ngày gần nhất' }
        }
        return { tuNgay: getOffsetIsoDate(-6), denNgay, periodLabel: '7 ngày gần nhất' }
    }, [timeFilter])

    const [topDiseases, setTopDiseases] = useState([])
    const [topServices, setTopServices] = useState([])
    const [topMedicines, setTopMedicines] = useState([])
    const [doctorPerformance, setDoctorPerformance] = useState(null)
    const [roomWorkload, setRoomWorkload] = useState([])
    const [analyticsLoading, setAnalyticsLoading] = useState(false)
    const [exportingExcel, setExportingExcel] = useState(false)

    const handleExportBiExcel = async () => {
        setExportingExcel(true)
        try {
            const data = await adminService.exportBiExcel()
            const list = data?.danh_muc || data?.danh_sach_dich_vu || data?.items || []
            if (!list.length) {
                AppToast.info('Không có dữ liệu để xuất báo cáo')
                return
            }
            const headers = [
                'Mã dịch vụ',
                'Tên dịch vụ kỹ thuật',
                'Chuyên khoa',
                'Đơn giá',
                'Đơn vị tính',
                'Mã nhóm BYT',
                'Phòng thực hiện',
                'Thời gian trả KQ (phút)',
                'Trạng thái',
            ]
            const rows = list.map((item) => [
                item.ma_dich_vu || '',
                item.ten_dich_vu || '',
                item.chuyen_khoa || '',
                Number(item.don_gia) || 0,
                item.don_vi_tinh || 'Lần',
                item.ma_nhom_byt || '',
                item.phong_thuc_hien || '',
                Number(item.thoi_gian_tra_ket_qua_phut) || 0,
                item.is_active ? 'Đang hoạt động' : 'Tạm ngưng',
            ])
            await exportToExcel({
                filename: `bao-cao-tong-quan-danh-muc-dich-vu_${new Date().toISOString().slice(0, 10)}.xlsx`,
                sheetName: 'Báo cáo Tổng quan',
                title: 'BÁO CÁO THỐNG KÊ QUẢN TRỊ VÀ DANH MỤC DỊCH VỤ',
                subtitle: `Phân hệ Quản trị • Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} • Tổng số: ${rows.length} dịch vụ`,
                headers,
                rows,
                signOff: true,
            })
            AppToast.success(`Đã xuất báo cáo (${rows.length} dịch vụ)`)
        } catch {
            AppToast.error('Lỗi khi xuất báo cáo ra file Excel')
        } finally {
            setExportingExcel(false)
        }
    }

    useEffect(() => {
        const rangeParams = { tuNgay: timeRange.tuNgay, denNgay: timeRange.denNgay }
        const refreshStats = () => {
            dispatch(getDashboardStatsAsync(rangeParams))
        }

        refreshStats()
        const timer = setInterval(refreshStats, 5000)

        const unsubCheckIn = clinicalEventBridge.on(CLINICAL_EVENTS.PATIENT_CHECKED_IN, refreshStats)
        const unsubApptCreated = clinicalEventBridge.on(CLINICAL_EVENTS.APPOINTMENT_CREATED, refreshStats)
        const unsubApptUpdated = clinicalEventBridge.on(CLINICAL_EVENTS.APPOINTMENT_UPDATED, refreshStats)
        const unsubRegCreated = clinicalEventBridge.on(CLINICAL_EVENTS.REGISTRATION_CREATED, refreshStats)
        const unsubEncounter = clinicalEventBridge.on(CLINICAL_EVENTS.ENCOUNTER_COMPLETED, refreshStats)
        const unsubBill = clinicalEventBridge.on(CLINICAL_EVENTS.BILL_PAID, refreshStats)

        return () => {
            clearInterval(timer)
            unsubCheckIn()
            unsubApptCreated()
            unsubApptUpdated()
            unsubRegCreated()
            unsubEncounter()
            unsubBill()
        }
    }, [dispatch, timeRange.tuNgay, timeRange.denNgay])

    useEffect(() => {
        const rangeParams = { tuNgay: timeRange.tuNgay, denNgay: timeRange.denNgay }
        const fetchAnalytics = async () => {
            setAnalyticsLoading(true)
            try {
                const [diseasesRes, servicesRes, docPerfRes, roomRes, medRes] = await Promise.allSettled([
                    adminService.getTopIcd10Diseases(rangeParams),
                    adminService.getTopServicesAnalytics(rangeParams),
                    adminService.getDoctorPerformanceAnalytics(rangeParams),
                    adminService.getRoomWorkloadAnalytics(rangeParams),
                    adminService.getTopMedicinesAnalytics(rangeParams),
                ])
                if (diseasesRes.status === 'fulfilled' && diseasesRes.value?.danh_sach_benh) {
                    setTopDiseases(diseasesRes.value.danh_sach_benh)
                }
                if (servicesRes.status === 'fulfilled' && servicesRes.value?.danh_sach_dich_vu) {
                    setTopServices(servicesRes.value.danh_sach_dich_vu)
                }
                if (medRes.status === 'fulfilled' && medRes.value?.items) {
                    setTopMedicines(medRes.value.items)
                }
                const doctorItems = docPerfRes.status === 'fulfilled'
                    ? mapDoctorPerformanceItems(docPerfRes.value)
                    : null
                setDoctorPerformance(doctorItems)
                if (roomRes.status === 'fulfilled' && roomRes.value?.danh_sach_tai_trong) {
                    setRoomWorkload(roomRes.value.danh_sach_tai_trong)
                }
            } catch (err) {
                console.warn('Analytics loading error:', err)
            } finally {
                setAnalyticsLoading(false)
            }
        }
        fetchAnalytics()
    }, [timeRange.tuNgay, timeRange.denNgay])

    const registrations = clinicData?.registrations || []
    const staffList = clinicData?.staffList || []
    const vouchers = clinicData?.vouchers || []
    const roleWorkbenches = clinicData?.roleWorkbenches || {}
    const accountantSummary = roleWorkbenches.accountantSummary || {}

    const paidVouchers = useMemo(
        () => vouchers.filter((v) => v.daThu && !String(v.loaiPhieu || '').toLowerCase().includes('chi')),
        [vouchers]
    )

    const paidVouchersRevenue = useMemo(
        () => paidVouchers.reduce((sum, v) => sum + (Number(v.tongTien) || 0), 0),
        [paidVouchers]
    )

    const liveRevenue = Number(stats?.tong_doanh_thu_trong_ngay ?? paidVouchersRevenue)

    const paymentBreakdown = useMemo(() => {
        if (paidVouchers.length > 0) {
            const total = paidVouchers.reduce((sum, v) => sum + (Number(v.tongTien) || 0), 0)
            const grouped = new Map()
            paidVouchers.forEach((v) => {
                const method = v.hinhThuc || 'Tiền mặt tại quầy'
                grouped.set(method, (grouped.get(method) || 0) + (Number(v.tongTien) || 0))
            })
            return Array.from(grouped.entries()).map(([hinhThuc, soTien]) => ({
                hinhThuc,
                soTien,
                tyLe: total > 0 ? Math.round((soTien / total) * 100) : 0,
            }))
        }
        if (Array.isArray(accountantSummary.hinhThucThu) && accountantSummary.hinhThucThu.length > 0) {
            return accountantSummary.hinhThucThu
        }
        return []
    }, [paidVouchers, accountantSummary.hinhThucThu])

    const specialtyDistribution = useMemo(() => {
        if (registrations.length === 0) return []
        const counts = new Map()
        registrations.forEach((reg) => {
            const label = reg.chuyenKhoa || reg.tenChuyenKhoa || 'Khám đa khoa'
            counts.set(label, (counts.get(label) || 0) + 1)
        })
        const total = registrations.length
        return Array.from(counts.entries())
            .map(([name, count]) => ({
                name,
                count,
                percent: Math.round((count / total) * 100),
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
    }, [registrations])

    const expiredOrSoonLicenses = staffList.filter(
        (s) => s.trangThaiCCHN === 'EXPIRED' || s.trangThaiCCHN === 'EXPIRING_SOON'
    ).length

    const executiveTabs = [
        {
            id: 'DIEU_HANH',
            label: '1. Điều hành & Công suất',
            icon: ShieldCheck,
        },
        {
            id: 'TAI_CHINH_DUOC',
            label: '2. Doanh thu, Dịch vụ & Dược',
            icon: Receipt,
        },
        {
            id: 'DICH_TE_TUAN_THU',
            label: '3. Dịch tễ ICD-10 & Tuân thủ',
            icon: ChartBar,
        },
    ]

    const timeFilters = [
        { id: 'today', label: 'Hôm nay' },
        { id: 'week', label: 'Tuần này' },
        { id: 'month', label: 'Tháng này' },
    ]

    const getWorkloadBarClass = (percent) => {
        if (percent >= 75) return 'bg-clinic-success'
        if (percent >= 50) return 'bg-clinic-cta'
        return 'bg-clinic-amber'
    }

    return (
        <div className="space-y-4">
            <div className="medpro-card p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-clinic-cta">
                        Điều hành phòng khám và danh mục trung tâm
                    </div>
                    <h2 className="font-display text-base lg:text-lg font-extrabold text-clinic-navy">
                        Tổng quan phòng khám
                    </h2>
                    <p className="text-xs text-clinic-text-secondary max-w-3xl">
                        Tổng hợp công suất khám chữa bệnh, doanh thu viện phí, hiệu suất bác sĩ và giám sát tuân thủ pháp lý y tế.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    <Link
                        to="/admin/danh-muc/khoa-phong"
                        className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                    >
                        <ClinicIcon name="Folders" size={15} weight="bold" className="text-clinic-cta" />
                        <span>Danh mục Y tế</span>
                    </Link>
                    <Link
                        to="/admin/phan-quyen"
                        className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                    >
                        <ShieldCheck size={15} weight="duotone" className="text-clinic-cta" />
                        <span>Nhân sự và phân quyền</span>
                    </Link>
                </div>
            </div>

            <div className="medpro-card p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border">
                    {executiveTabs.map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeViewTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveViewTab(tab.id)}
                                className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors duration-75 flex items-center gap-1.5 cursor-pointer ${
                                    isActive
                                        ? 'bg-clinic-navy text-clinic-surface'
                                        : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                                }`}
                            >
                                <Icon size={15} weight={isActive ? 'fill' : 'bold'} />
                                <span>{tab.label}</span>
                            </button>
                        )
                    })}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <span className="text-xs font-semibold text-clinic-text-secondary mr-1 flex items-center gap-1">
                        <Clock size={13} />
                        <span>Kỳ thống kê:</span>
                    </span>
                    {timeFilters.map((tf) => (
                        <button
                            key={tf.id}
                            type="button"
                            onClick={() => setTimeFilter(tf.id)}
                            className={`px-2.5 py-1.5 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer ${
                                timeFilter === tf.id
                                    ? 'bg-clinic-navy text-clinic-surface'
                                    : 'bg-clinic-surface border border-clinic-border text-clinic-text-secondary hover:border-clinic-cta hover:text-clinic-navy'
                            }`}
                        >
                            {tf.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={handleExportBiExcel}
                        disabled={exportingExcel}
                        className="medpro-btn-primary !py-1.5 !px-3 text-xs ml-1"
                    >
                        <DownloadSimple size={14} weight="bold" />
                        <span>{exportingExcel ? 'Đang xuất...' : 'Xuất Excel'}</span>
                    </button>
                </div>
            </div>

            {activeViewTab === 'DIEU_HANH' && (
                <div className="space-y-4">
                    <div className="bg-clinic-surface rounded-[6px] border border-clinic-border grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-clinic-border tabular-nums">
                        <div className="p-4">
                            <span className="text-xs font-semibold text-clinic-text-secondary block">
                                Tổng lượt tiếp nhận
                            </span>
                            <div className="font-display text-2xl font-extrabold text-clinic-navy mt-1">
                                {stats?.so_ca_da_check_in ?? registrations.length}
                            </div>
                            <Link
                                to="/admin/bao-cao"
                                className="text-[11px] font-bold text-clinic-cta hover:underline mt-1 inline-flex items-center gap-1"
                            >
                                <span>Xem báo cáo lưu lượng</span>
                                <ArrowRight size={11} weight="bold" />
                            </Link>
                        </div>

                        <div className="p-4">
                            <span className="text-xs font-semibold text-clinic-text-secondary block">
                                Hoàn tất khám và kê đơn
                            </span>
                            <div className="font-display text-2xl font-extrabold text-clinic-success mt-1">
                                {stats?.so_ca_hoan_tat_kham ?? registrations.filter((r) => r.trangThai === 'Đã khám').length}
                            </div>
                            <Link
                                to="/admin/tuan-thu?tab=DON_THUOC"
                                className="text-[11px] font-bold text-clinic-success hover:underline mt-1 inline-flex items-center gap-1"
                            >
                                <span>Đồng bộ ĐTQG</span>
                                <ArrowRight size={11} weight="bold" />
                            </Link>
                        </div>

                        <div className="p-4">
                            <span className="text-xs font-semibold text-clinic-text-secondary block">
                                Bác sĩ đang làm việc
                            </span>
                            <div className="font-display text-2xl font-extrabold text-clinic-cta mt-1">
                                {stats?.tong_bac_si_hoat_dong ?? staffList.length}
                            </div>
                            <Link
                                to="/admin/nhan-vien"
                                className="text-[11px] font-bold text-clinic-cta hover:underline mt-1 inline-flex items-center gap-1"
                            >
                                <span>Kiểm soát CCHN</span>
                                <ArrowRight size={11} weight="bold" />
                            </Link>
                        </div>

                        <div className="p-4">
                            <span className="text-xs font-semibold text-clinic-text-secondary block">
                                Doanh thu toàn phòng khám ({timeRange.periodLabel})
                            </span>
                            <div className="font-display text-2xl font-extrabold text-clinic-warning mt-1">
                                {Number(stats?.tong_doanh_thu_trong_ngay ?? liveRevenue).toLocaleString('vi-VN')} đ
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveViewTab('TAI_CHINH_DUOC')}
                                className="text-[11px] font-bold text-clinic-warning hover:underline mt-1 inline-flex items-center gap-1 cursor-pointer"
                            >
                                <span>Phân tích tài chính</span>
                                <ArrowRight size={11} weight="bold" />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="medpro-card p-4">
                            <div className="medpro-section-title">
                                <span>HIỆU SUẤT BÁC SĨ ({timeRange.periodLabel})</span>
                                <Link to="/admin/nhan-vien" className="text-xs font-bold text-clinic-cta hover:underline">
                                    Quản lý Bác sĩ
                                </Link>
                            </div>
                            <p className="text-[11px] text-clinic-text-muted mt-1">
                                Doanh thu từng bác sĩ chỉ tính công khám ước tính theo ca hoàn tất (chưa gồm cận lâm sàng).
                            </p>
                            <div className="space-y-2 mt-3 tabular-nums">
                                {doctorPerformance === null ? (
                                    <div className="p-6 text-center text-xs text-clinic-text-muted">
                                        {analyticsLoading ? 'Đang tải dữ liệu hiệu suất bác sĩ...' : 'Chưa có dữ liệu hiệu suất bác sĩ từ API.'}
                                    </div>
                                ) : doctorPerformance.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-clinic-text-muted">
                                        Chưa có dữ liệu hiệu suất bác sĩ trong kỳ thống kê này.
                                    </div>
                                ) : (
                                    doctorPerformance.map((doc) => (
                                        <div
                                            key={doc.id}
                                            className="p-3 rounded-[6px] bg-clinic-bg border border-clinic-border flex items-center justify-between gap-2"
                                        >
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-clinic-navy truncate">
                                                    {formatUnifiedDoctorName(doc.name, doc.degree) || `Bác sĩ #${doc.id}`}
                                                </div>
                                                <div className="text-[11px] text-clinic-text-secondary truncate">
                                                    {doc.specialty || 'Chuyên khoa khám bệnh'}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-xs font-bold text-clinic-cta">{doc.completedCases} ca hoàn tất</div>
                                                <div className="text-[11px] text-clinic-success font-bold">
                                                    {doc.revenue.toLocaleString('vi-VN')} đ
                                                </div>
                                                <div className="text-[10px] text-clinic-text-muted">
                                                    Doanh thu khám (ước tính)
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="medpro-card p-4">
                            <div className="medpro-section-title">
                                <span>TẢI TRỌNG CÔNG SUẤT BUỒNG KHÁM</span>
                                <Link to="/admin/danh-muc/khoa-phong" className="text-xs font-bold text-clinic-cta hover:underline">
                                    Cấu hình Buồng khám
                                </Link>
                            </div>
                            <div className="space-y-2.5 mt-3 tabular-nums">
                                {roomWorkload.length === 0 ? (
                                    <div className="text-center py-8 text-clinic-text-muted text-xs">
                                        Chưa phát sinh dữ liệu phân bổ phòng
                                    </div>
                                ) : (
                                    roomWorkload.map((room, idx) => (
                                        <div
                                            key={room.ma_phong || idx}
                                            className="p-3 rounded-[6px] bg-clinic-bg border border-clinic-border space-y-1.5"
                                        >
                                            <div className="flex justify-between text-xs font-bold text-clinic-navy">
                                                <span>{room.ma_phong} - {room.ten_phong}</span>
                                                <span className="text-clinic-cta font-mono">{room.ty_le_su_dung_phan_tram}%</span>
                                            </div>
                                            <div className="flex justify-between text-[11px] text-clinic-text-secondary">
                                                <span>Chuyên khoa: {room.chuyen_khoa || 'Đa khoa'}</span>
                                                <span>{room.tong_ca_truc_phan_bo} ca trực/tuần</span>
                                            </div>
                                            <div className="w-full bg-clinic-bg-muted rounded-[4px] h-1.5 overflow-hidden">
                                                <div
                                                    className={`h-1.5 rounded-[4px] ${getWorkloadBarClass(room.ty_le_su_dung_phan_tram)}`}
                                                    style={{ width: `${Math.min(100, room.ty_le_su_dung_phan_tram)}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="medpro-card p-4">
                        <div className="medpro-section-title">
                            <span>CỔNG GIÁM SÁT NHANH 4 PHÂN HỆ NGHIỆP VỤ</span>
                            <span className="text-[11px] font-normal text-clinic-text-secondary">
                                Chuyển nhanh sang giao diện tác nghiệp chuẩn của từng bộ phận
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                            {OPERATIONAL_PORTAL_LINKS.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className="p-3.5 rounded-[6px] bg-clinic-bg hover:bg-clinic-surface-tint border border-clinic-border hover:border-clinic-cta transition-colors group flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[10.5px] font-bold uppercase tracking-wider text-clinic-cta">
                                                {item.role}
                                            </span>
                                            <ClinicIcon name={item.icon} size={16} weight="duotone" className="text-clinic-navy" />
                                        </div>
                                        <div className="text-xs font-bold text-clinic-navy group-hover:text-clinic-cta transition-colors">
                                            {item.title}
                                        </div>
                                        <p className="text-[11px] text-clinic-text-secondary mt-1 leading-snug">
                                            {item.desc}
                                        </p>
                                    </div>
                                    <div className="mt-2.5 pt-2 border-t border-clinic-border flex items-center justify-between text-[11px] font-bold text-clinic-navy group-hover:text-clinic-cta">
                                        <span>Mở phân hệ</span>
                                        <ArrowRight size={12} weight="bold" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeViewTab === 'TAI_CHINH_DUOC' && (
                <div className="space-y-4">
                    <div className="bg-clinic-surface rounded-[6px] border border-clinic-border grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-clinic-border tabular-nums">
                        <div className="p-4">
                            <span className="text-xs font-semibold text-clinic-text-secondary block">
                                1. Doanh thu Khám Lâm Sàng
                            </span>
                            <div className="font-display text-xl font-extrabold text-clinic-navy mt-1">
                                {Number(stats?.doanh_thu_kham_lam_sang ?? 0).toLocaleString('vi-VN')} đ
                            </div>
                            <div className="text-[11px] text-clinic-text-muted mt-0.5">Công khám đa chuyên khoa</div>
                        </div>
                        <div className="p-4">
                            <span className="text-xs font-semibold text-clinic-text-secondary block">
                                2. Cận Lâm Sàng &amp; DVKT
                            </span>
                            <div className="font-display text-xl font-extrabold text-clinic-cta mt-1">
                                {Number(stats?.doanh_thu_can_lam_sang ?? 0).toLocaleString('vi-VN')} đ
                            </div>
                            <div className="text-[11px] text-clinic-text-muted mt-0.5">X-Quang, Siêu âm, Xét nghiệm</div>
                        </div>
                        <div className="p-4">
                            <span className="text-xs font-semibold text-clinic-text-secondary block">
                                3. Dịch vụ Kỹ thuật Chuyên sâu
                            </span>
                            <div className="font-display text-xl font-extrabold text-clinic-success mt-1">
                                {Number(stats?.doanh_thu_goi_dich_vu ?? 0).toLocaleString('vi-VN')} đ
                            </div>
                            <div className="text-[11px] text-clinic-text-muted mt-0.5">Thủ thuật &amp; Tầm soát định kỳ</div>
                        </div>
                        <div className="p-4 bg-clinic-surface-tint">
                            <span className="text-xs font-bold text-clinic-navy block">
                                Tổng Thực Thu Hệ Thống
                            </span>
                            <div className="font-display text-xl font-extrabold text-clinic-warning mt-1">
                                {Number(stats?.tong_doanh_thu_trong_ngay ?? liveRevenue).toLocaleString('vi-VN')} đ
                            </div>
                            <div className="text-[11px] text-clinic-text-secondary mt-0.5">Đã quyết toán qua Thu ngân</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="medpro-card p-4">
                            <div className="medpro-section-title">
                                <span>TỶ TRỌNG PHƯƠNG THỨC THANH TOÁN</span>
                                <Link to="/staff/cashier" className="text-xs font-bold text-clinic-cta hover:underline shrink-0 whitespace-nowrap">
                                    Cổng Thu ngân
                                </Link>
                            </div>
                            <div className="space-y-3 mt-3 tabular-nums">
                                {paymentBreakdown.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-clinic-text-muted">
                                        Chưa có giao dịch thanh toán ghi nhận
                                    </div>
                                ) : (
                                    paymentBreakdown.map((ht, idx) => (
                                        <div key={ht.hinhThuc || idx} className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold text-clinic-navy">
                                                <span>{ht.hinhThuc}</span>
                                                <span>{ht.tyLe}% &bull; {Number(ht.soTien || 0).toLocaleString('vi-VN')} đ</span>
                                            </div>
                                            <div className="w-full bg-clinic-bg-muted rounded-[4px] h-2 overflow-hidden">
                                                <div
                                                    className={`h-2 rounded-[4px] ${
                                                        idx === 0 ? 'bg-clinic-cta' : idx === 1 ? 'bg-clinic-amber' : 'bg-clinic-success'
                                                    }`}
                                                    style={{ width: `${ht.tyLe}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="lg:col-span-2 medpro-card p-4">
                            <div className="medpro-section-title">
                                <span>TOP THUỐC KÊ ĐƠN NGOẠI TRÚ PHỔ BIẾN</span>
                                <Link to="/admin/danh-muc/thuoc-vat-tu" className="text-xs font-bold text-clinic-cta hover:underline">
                                    Danh mục Thuốc BYT
                                </Link>
                            </div>
                            <div className="overflow-x-auto mt-3">
                                <table className="medpro-table text-xs">
                                    <thead>
                                        <tr>
                                            <th>Mã Thuốc</th>
                                            <th>Tên thuốc &amp; Hoạt chất</th>
                                            <th>Đơn vị</th>
                                            <th className="text-center">Số đơn kê</th>
                                            <th className="text-right">Tổng số lượng kê</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topMedicines.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="text-center py-8 text-clinic-text-muted">
                                                    Chưa có dữ liệu thuốc được kê
                                                </td>
                                            </tr>
                                        ) : (
                                            topMedicines.slice(0, 5).map((med, idx) => (
                                                <tr key={med.ma_thuoc || idx}>
                                                    <td className="font-mono font-bold text-clinic-navy">{med.ma_thuoc || `TH00${idx + 1}`}</td>
                                                    <td className="font-bold text-clinic-text">{med.ten_thuoc}</td>
                                                    <td>{med.don_vi_tinh || 'Viên'}</td>
                                                    <td className="text-center font-bold text-clinic-cta">{med.so_don_ke || 0} đơn</td>
                                                    <td className="text-right font-mono font-bold text-clinic-success">
                                                        {Number(med.tong_so_luong || 0).toLocaleString('vi-VN')}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="medpro-card p-4">
                        <div className="medpro-section-title">
                            <span>TOP DỊCH VỤ KỸ THUẬT &amp; CẬN LÂM SÀNG DOANH THU CAO NHẤT</span>
                            <Link to="/admin/danh-muc/dich-vu" className="text-xs font-bold text-clinic-cta hover:underline">
                                Quản lý Bảng giá Dịch vụ
                            </Link>
                        </div>
                        <div className="overflow-x-auto mt-3">
                            <table className="medpro-table text-xs">
                                <thead>
                                    <tr>
                                        <th>Mã DV</th>
                                        <th>Tên dịch vụ kỹ thuật</th>
                                        <th>Nhóm dịch vụ</th>
                                        <th className="text-right">Đơn giá niêm yết</th>
                                        <th className="text-center">Số lượt chỉ định</th>
                                        <th className="text-right">Tổng doanh thu</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topServices.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-clinic-text-muted">
                                                Chưa có dữ liệu dịch vụ kỹ thuật
                                            </td>
                                        </tr>
                                    ) : (
                                        topServices.map((srv, sIdx) => (
                                            <tr key={srv.ma_dich_vu || sIdx}>
                                                <td className="font-mono font-bold text-clinic-navy">{srv.ma_dich_vu}</td>
                                                <td className="font-bold text-clinic-text">{srv.ten_dich_vu}</td>
                                                <td>
                                                    <span className="medpro-badge-info">
                                                        {srv.nhom_dich_vu || 'Dịch vụ'}
                                                    </span>
                                                </td>
                                                <td className="text-right font-mono font-bold text-clinic-text-secondary">
                                                    {Number(srv.don_gia || 0).toLocaleString('vi-VN')} đ
                                                </td>
                                                <td className="text-center font-bold text-clinic-navy">
                                                    {srv.so_luong_chi_dinh || 0} lượt
                                                </td>
                                                <td className="text-right font-mono font-bold text-clinic-success">
                                                    {Number(srv.tong_doanh_thu || 0).toLocaleString('vi-VN')} đ
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeViewTab === 'DICH_TE_TUAN_THU' && (
                <div className="space-y-4">
                    <div className="p-4 rounded-[6px] bg-clinic-surface-alt border border-clinic-info-border flex items-start gap-3">
                        <span className="w-9 h-9 rounded-[6px] bg-clinic-navy text-clinic-surface flex items-center justify-center shrink-0">
                            <ChartBar size={18} weight="bold" />
                        </span>
                        <div className="space-y-0.5">
                            <h3 className="font-display font-bold text-sm text-clinic-navy">
                                Giám sát Phân luồng Chuyên khoa &amp; Mô hình Bệnh tật ICD-10
                            </h3>
                            <p className="text-xs text-clinic-text-secondary leading-relaxed max-w-4xl">
                                Theo dõi tỷ lệ phân luồng chuyên khoa từ cổng đặt lịch và thống kê mặt bệnh ICD-10 phục vụ báo cáo Sở Y tế.
                                <span className="text-clinic-danger font-bold ml-1">
                                    (Hệ thống chỉ hỗ trợ gợi ý chuyên khoa, bác sĩ chịu trách nhiệm chẩn đoán chuyên môn theo Luật KCB).
                                </span>
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="medpro-card p-4 space-y-3">
                            <div className="medpro-section-title">
                                <span>PHÂN BỔ CHUYÊN KHOA TIẾP NHẬN</span>
                            </div>
                            <div className="space-y-2.5 tabular-nums">
                                {specialtyDistribution.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-clinic-text-muted">
                                        Chưa có dữ liệu phân luồng chuyên khoa trong kỳ
                                    </div>
                                ) : (
                                    specialtyDistribution.map((item, idx) => (
                                        <div key={item.name || idx}>
                                            <div className="flex justify-between text-xs font-bold text-clinic-navy mb-1">
                                                <span className="truncate">{item.name}</span>
                                                <span className="shrink-0 ml-2">{item.percent}% ({item.count} ca)</span>
                                            </div>
                                            <div className="w-full bg-clinic-bg-muted rounded-[4px] h-2 overflow-hidden">
                                                <div
                                                    className={`h-2 rounded-[4px] ${idx === 0 ? 'bg-clinic-cta' : idx === 1 ? 'bg-clinic-navy' : 'bg-clinic-success'}`}
                                                    style={{ width: `${item.percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="lg:col-span-2 medpro-card p-4">
                            <div className="medpro-section-title">
                                <span>MÔ HÌNH BỆNH TẬT ICD-10 PHỔ BIẾN</span>
                                <Link to="/admin/danh-muc/benh" className="text-xs font-bold text-clinic-cta hover:underline">
                                    Danh mục ICD-10
                                </Link>
                            </div>
                            <div className="overflow-x-auto mt-3">
                                <table className="medpro-table text-xs">
                                    <thead>
                                        <tr>
                                            <th>Mã ICD-10</th>
                                            <th>Tên bệnh lý</th>
                                            <th>Chương bệnh</th>
                                            <th className="text-center">Số ca ghi nhận</th>
                                            <th className="text-center">Tỷ lệ (%)</th>
                                            <th>Phân loại dịch tễ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topDiseases.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="text-center py-8 text-clinic-text-muted">
                                                    Chưa có dữ liệu mô hình bệnh tật
                                                </td>
                                            </tr>
                                        ) : (
                                            topDiseases.map((b, idx) => (
                                                <tr key={b.ma_icd10 || idx}>
                                                    <td className="font-mono font-bold text-clinic-navy">{b.ma_icd10}</td>
                                                    <td className="font-bold text-clinic-text">{b.ten_benh}</td>
                                                    <td className="text-xs text-clinic-text-secondary">{b.chuong_benh || 'Ngoại trú'}</td>
                                                    <td className="font-mono font-bold text-clinic-cta text-center">
                                                        {b.so_ca || 0} ca
                                                    </td>
                                                    <td className="text-center font-bold text-clinic-text-secondary">
                                                        {b.ty_le_phan_tram || 0}%
                                                    </td>
                                                    <td>
                                                        {b.truyen_nhiem ? (
                                                            <span className="medpro-badge-danger">Nhóm B (Báo cáo Sở)</span>
                                                        ) : (
                                                            <span className="medpro-badge-success">Ngoại trú thường</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-3.5 rounded-[6px] bg-clinic-surface-tint border border-clinic-info-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-[6px] bg-clinic-navy text-clinic-surface flex items-center justify-center shrink-0">
                        <Scales size={18} weight="duotone" />
                    </span>
                    <div>
                        <div className="text-xs font-bold text-clinic-navy">
                            Giám sát Tuân thủ Pháp lý Y tế (TT 26/2025/TT-BYT, TT 13/2025/TT-BYT &amp; NĐ 96/2023/NĐ-CP)
                        </div>
                        <div className="text-[11px] text-clinic-text-secondary tabular-nums">
                            Phát hiện <strong className="text-clinic-danger">{expiredOrSoonLicenses} nhân sự y tế</strong> có Chứng chỉ hành nghề hết hạn hoặc sắp hết hạn (&lt; 60 ngày) cần rà soát trước khi xếp lịch trực.
                        </div>
                    </div>
                </div>
                <Link to="/admin/tuan-thu" className="medpro-btn-primary text-xs shrink-0">
                    <span>Bảng điều khiển Pháp lý</span>
                    <ArrowRight size={14} weight="bold" />
                </Link>
            </div>

            <div>
                <div className="medpro-section-title">
                    <span>6 PHÂN HỆ QUẢN TRỊ HỆ THỐNG TRỌNG TÂM</span>
                    <span className="text-[11px] font-normal text-clinic-text-secondary">
                        Truy cập nhanh các phân hệ danh mục, nhân sự, phân quyền và cấu hình phòng khám
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {dashboardQuickModules.map((mod, idx) => (
                        <Link
                            key={mod.path || idx}
                            to={mod.path}
                            className="medpro-card p-4 hover:border-clinic-cta transition-colors group flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="w-8 h-8 rounded-[6px] bg-clinic-surface-alt text-clinic-cta border border-clinic-info-border flex items-center justify-center group-hover:bg-clinic-cta group-hover:text-clinic-surface transition-colors">
                                        <ClinicIcon name={mod.icon} size={18} weight="duotone" />
                                    </span>
                                    <span className="medpro-badge-info">{mod.step}</span>
                                </div>
                                <h3 className="font-display font-bold text-sm text-clinic-navy group-hover:text-clinic-cta transition-colors">
                                    {mod.title}
                                </h3>
                                <p className="text-xs text-clinic-text-secondary mt-1 leading-relaxed">{mod.desc}</p>
                            </div>
                            <div className="mt-3 pt-2 border-t border-clinic-border flex items-center justify-between text-[11px] font-bold text-clinic-cta">
                                <span>{mod.badge}</span>
                                <span className="inline-flex items-center gap-1">
                                    <span>Quản trị</span>
                                    <ArrowRight size={13} weight="bold" />
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            <div className="medpro-card p-4">
                <div className="medpro-section-title">
                    <span>NHẬT KÝ KIỂM TOÁN HOẠT ĐỘNG HỆ THỐNG</span>
                    <Link to="/admin/lich-su-hoat-dong" className="text-xs font-bold text-clinic-cta hover:underline">
                        Xem toàn bộ nhật ký
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="medpro-table">
                        <thead>
                            <tr>
                                <th>Mã Log</th>
                                <th>Thời gian</th>
                                <th>Người thực hiện</th>
                                <th>Vai trò</th>
                                <th>Hành động</th>
                                <th>Đối tượng tác động</th>
                                <th>Kết quả</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(clinicData?.auditLogs || []).slice(0, 5).map((log) => (
                                <tr key={log.id}>
                                    <td className="font-mono font-bold text-clinic-navy">{log.id}</td>
                                    <td className="tabular-nums text-clinic-text-secondary">{log.thoiGian}</td>
                                    <td className="font-semibold text-clinic-text">{String(log.nguoiDung || '').replace(/\s*\(INT-\d+\)/g, '')}</td>
                                    <td>
                                        <span className="medpro-badge-info">{ROLE_LABEL_MAP[log.vaiTro] || log.vaiTro}</span>
                                    </td>
                                    <td className="font-semibold text-xs text-clinic-navy">{ACTION_LABEL_MAP[log.hanhDong] || log.hanhDong}</td>
                                    <td>{log.doiTuong}</td>
                                    <td>
                                        <StatusBadge status={log.ketQua} compact />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
