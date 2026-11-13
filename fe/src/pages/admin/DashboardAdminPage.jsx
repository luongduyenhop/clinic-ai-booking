import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useLocation } from 'react-router-dom'
import { getDashboardStatsAsync } from '../../redux/actions/admin/adminAction'
import { clinicalEventBridge, CLINICAL_EVENTS } from '../../services/clinicalEventBridge'
import { getNavigationConfig } from '../../utils/helpers/clinicConfigHelpers'
import { mapDoctorPerformanceItems } from '../../utils/helpers/doctorPerformanceMapping'
import { adminService } from '../../services/admin/AdminService'
import {
    ClinicIcon,
    StatusBadge,
    Stethoscope,
    Scales,
    ShieldCheck,
    ArrowRight,
    Clock,
    Receipt,
    ChartBar,
    Sparkle,
} from '../../components/common/ClinicIcon'

const OPERATIONAL_PORTAL_LINKS = [
    {
        role: 'LỄ TÂN & TIẾP ĐÓN',
        title: 'Cổng Tiếp Đón & Điều Phối Hàng Chờ',
        desc: 'Tra cứu SĐT/CCCD, check-in lịch hẹn & quản lý hàng chờ realtime',
        path: '/reception/dashboard',
        icon: 'ClipboardText',
        accent: 'border-l-sky-500',
    },
    {
        role: 'BÁC SĨ KHÁM BỆNH',
        title: 'Cổng Khám Lâm Sàng & Kê Đơn Điện Tử',
        desc: 'Bàn khám chuyên khoa, sinh hiệu, chẩn đoán ICD-10 & chỉ định CLS',
        path: '/doctor',
        icon: 'Stethoscope',
        accent: 'border-l-emerald-500',
    },
    {
        role: 'KỸ THUẬT VIÊN CLS',
        title: 'Cổng Xét Nghiệm & Chẩn Đoán Hình Ảnh',
        desc: 'Tiếp nhận phiếu chỉ định, nhập kết quả xét nghiệm, siêu âm, X-quang',
        path: '/staff/paraclinical-work',
        icon: 'Microscope',
        accent: 'border-l-indigo-500',
    },
    {
        role: 'THU NGÂN VIỆN PHÍ',
        title: 'Cổng Thu Viện Phí & Đối Soát Ca',
        desc: 'Thanh toán khép kín VietQR/Tiền mặt, xuất biên lai & khóa sổ ca',
        path: '/staff/cashier',
        icon: 'Receipt',
        accent: 'border-l-amber-500',
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
    const location = useLocation()
    const isBaoCaoRoute = location.pathname.includes('/bao-cao')

    const [activeViewTab, setActiveViewTab] = useState(isBaoCaoRoute ? 'TAI_CHINH_DUOC' : 'DIEU_HANH')

    useEffect(() => {
        if (location.pathname.includes('/bao-cao')) {
            setActiveViewTab('TAI_CHINH_DUOC')
        }
    }, [location.pathname])
    const [timeFilter, setTimeFilter] = useState('week')
    const [customTuNgay, setCustomTuNgay] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        return d.toISOString().split('T')[0]
    })
    const [customDenNgay, setCustomDenNgay] = useState(() => new Date().toISOString().split('T')[0])

    const [topDiseases, setTopDiseases] = useState([])
    const [topServices, setTopServices] = useState([])
    const [topMedicines, setTopMedicines] = useState([])
    const [doctorPerformance, setDoctorPerformance] = useState(null)
    const [roomWorkload, setRoomWorkload] = useState([])
    const [analyticsLoading, setAnalyticsLoading] = useState(false)

    useEffect(() => {
        const refreshStats = () => {
            dispatch(getDashboardStatsAsync())
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
    }, [dispatch])

    useEffect(() => {
        const fetchAnalytics = async () => {
            setAnalyticsLoading(true)
            try {
                const now = new Date()
                let denNgay = now.toISOString().split('T')[0]
                let tuNgay = denNgay
                if (timeFilter === 'week') {
                    const d = new Date()
                    d.setDate(d.getDate() - 7)
                    tuNgay = d.toISOString().split('T')[0]
                } else if (timeFilter === 'month') {
                    const d = new Date()
                    d.setDate(d.getDate() - 30)
                    tuNgay = d.toISOString().split('T')[0]
                } else if (timeFilter === 'custom') {
                    tuNgay = customTuNgay || denNgay
                    denNgay = customDenNgay || denNgay
                }
                const query = { tuNgay, denNgay }

                const [diseasesRes, servicesRes, docPerfRes, roomRes, medRes] = await Promise.allSettled([
                    adminService.getTopIcd10Diseases(query),
                    adminService.getTopServicesAnalytics(query),
                    adminService.getDoctorPerformanceAnalytics(query),
                    adminService.getRoomWorkloadAnalytics(query),
                    adminService.getTopMedicinesAnalytics(query),
                ])
                if (diseasesRes.status === 'fulfilled') {
                    const dItems = diseasesRes.value?.items || diseasesRes.value?.danh_sach_benh || []
                    setTopDiseases(dItems)
                }
                if (servicesRes.status === 'fulfilled') {
                    const sItems = servicesRes.value?.items || servicesRes.value?.danh_sach_dich_vu || []
                    setTopServices(sItems)
                }
                if (medRes.status === 'fulfilled') {
                    const mItems = medRes.value?.items || medRes.value?.danh_sach_thuoc || []
                    setTopMedicines(mItems)
                }
                const doctorItems = docPerfRes.status === 'fulfilled'
                    ? mapDoctorPerformanceItems(docPerfRes.value)
                    : null
                setDoctorPerformance(doctorItems)
                if (roomRes.status === 'fulfilled') {
                    const rItems = roomRes.value?.items || roomRes.value?.danh_sach_tai_trong || []
                    setRoomWorkload(rItems)
                }
            } catch (err) {
                console.warn('Analytics loading error:', err)
            } finally {
                setAnalyticsLoading(false)
            }
        }
        fetchAnalytics()
    }, [timeFilter, customTuNgay, customDenNgay])

    const registrations = clinicData?.registrations || []
    const staffList = clinicData?.staffList || []
    const vouchers = clinicData?.vouchers || []

    const paidVouchers = vouchers.filter((v) => v.daThu && !String(v.loaiPhieu || '').toLowerCase().includes('chi'))
    const paidVouchersRevenue = paidVouchers.reduce((sum, v) => sum + (Number(v.tongTien) || 0), 0)
    const liveRevenue = Math.max(Number(stats?.tong_doanh_thu_trong_ngay || 0), paidVouchersRevenue)

    const totalPaidForMethods = liveRevenue > 0 ? liveRevenue : paidVouchersRevenue
    const qrSum = paidVouchers
        .filter((v) => {
            const h = String(v.hinhThuc || '').toLowerCase()
            return h.includes('vietqr') || h.includes('chuyển khoản') || h.includes('qr')
        })
        .reduce((sum, v) => sum + (Number(v.tongTien) || 0), 0)
    const cashSum = paidVouchers
        .filter((v) => {
            const h = String(v.hinhThuc || '').toLowerCase()
            return h.includes('tiền mặt')
        })
        .reduce((sum, v) => sum + (Number(v.tongTien) || 0), 0)
    const posSum = Math.max(0, totalPaidForMethods - qrSum - cashSum)

    const paymentMethodsBreakdown = totalPaidForMethods > 0 ? [
        { hinhThuc: 'Chuyển khoản VietQR', tyLe: Math.round((qrSum / totalPaidForMethods) * 100), soTien: qrSum },
        { hinhThuc: 'Tiền mặt tại quầy', tyLe: Math.round((cashSum / totalPaidForMethods) * 100), soTien: cashSum },
        { hinhThuc: 'Thẻ POS / Khác', tyLe: Math.round((posSum / totalPaidForMethods) * 100), soTien: posSum },
    ] : [
        { hinhThuc: 'Chuyển khoản VietQR', tyLe: 0, soTien: 0 },
        { hinhThuc: 'Tiền mặt tại quầy', tyLe: 0, soTien: 0 },
        { hinhThuc: 'Thẻ POS / Khác', tyLe: 0, soTien: 0 },
    ]

    const expiredOrSoonLicenses = staffList.filter(
        (s) => s.trangThaiCCHN === 'EXPIRED' || s.trangThaiCCHN === 'EXPIRING_SOON'
    ).length

    const executiveTabs = [
        {
            id: 'DIEU_HANH',
            label: '1. ĐIỀU HÀNH & CÔNG SUẤT KHOA PHÒNG',
            icon: ShieldCheck,
        },
        {
            id: 'TAI_CHINH_DUOC',
            label: '2. PHÂN TÍCH DOANH THU, DỊCH VỤ & DƯỢC',
            icon: Receipt,
        },
        {
            id: 'DICH_TE_TUAN_THU',
            label: '3. DỊCH TỄ ICD-10, AI TRIAGE & TUÂN THỦ',
            icon: ChartBar,
        },
    ]

    const timeFilters = [
        { id: 'today', label: 'Hôm nay' },
        { id: 'week', label: 'Tuần này' },
        { id: 'month', label: 'Tháng này' },
        { id: 'custom', label: 'Tùy chọn' },
    ]

    return (
        <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-r from-[#003553] via-[#004A73] to-[#00B5F1] p-5 text-white shadow-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-wider border border-white/20">
                        <ShieldCheck size={14} weight="fill" className="text-[#FFB54A]" />
                        <span>QUẢN TRỊ HỆ THỐNG, DANH MỤC Y TẾ &amp; PHÂN QUYỀN TRUNG TÂM</span>
                    </div>
                    <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
                        TRUNG TÂM ĐIỀU HÀNH &amp; THỐNG KÊ QUẢN TRỊ
                    </h1>
                    <p className="text-xs text-sky-100 max-w-3xl">
                        Tập trung quản trị 4 trụ cột nền tảng: Báo cáo Điều hành, Danh mục Y tế chuẩn hóa, Quản lý Nhân sự &amp; Phân quyền, và Tuân thủ Pháp lý Y tế. Các tác nghiệp hàng ngày được phân tách sang 4 cổng chuyên biệt.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    <Link
                        to="/admin/danh-muc/khoa-phong"
                        className="px-4 py-2 rounded-full bg-[#FFB54A] hover:bg-[#FBA342] text-[#003553] font-extrabold text-xs shadow-sm transition inline-flex items-center gap-1.5"
                    >
                        <ClinicIcon name="Folders" size={16} weight="bold" />
                        <span>Danh mục Y tế</span>
                    </Link>
                    <Link
                        to="/admin/phan-quyen"
                        className="px-4 py-2 rounded-full bg-white text-[#003553] hover:bg-[#E8F4FD] font-extrabold text-xs shadow-sm transition inline-flex items-center gap-1.5"
                    >
                        <ShieldCheck size={16} weight="duotone" className="text-[#00B5F1]" />
                        <span>Nhân sự &amp; Phân quyền</span>
                    </Link>
                </div>
            </div>

            <div className="medpro-card p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-xl">
                    {executiveTabs.map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeViewTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveViewTab(tab.id)}
                                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                                    isActive
                                        ? 'bg-[#00B5F1] text-white shadow-sm'
                                        : 'text-[#003553] hover:bg-white/80'
                                }`}
                            >
                                <Icon size={16} weight={isActive ? 'fill' : 'bold'} />
                                <span>{tab.label}</span>
                            </button>
                        )
                    })}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
                            <Clock size={13} />
                            <span>Kỳ thống kê:</span>
                        </span>
                        {timeFilters.map((tf) => (
                            <button
                                key={tf.id}
                                type="button"
                                onClick={() => setTimeFilter(tf.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    timeFilter === tf.id
                                        ? 'bg-[#003553] text-white shadow-xs'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:border-[#00B5F1]'
                                }`}
                            >
                                {tf.label}
                            </button>
                        ))}
                    </div>
                    {timeFilter === 'custom' && (
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                            <ClinicIcon name="Calendar" size={14} className="text-[#00B5F1]" />
                            <span className="text-[11px] text-slate-500 font-medium">Từ:</span>
                            <input
                                type="date"
                                value={customTuNgay}
                                onChange={(e) => setCustomTuNgay(e.target.value)}
                                className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 font-semibold focus:outline-none focus:border-[#00B5F1]"
                            />
                            <span className="text-[11px] text-slate-500 font-medium">Đến:</span>
                            <input
                                type="date"
                                value={customDenNgay}
                                onChange={(e) => setCustomDenNgay(e.target.value)}
                                className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 font-semibold focus:outline-none focus:border-[#00B5F1]"
                            />
                        </div>
                    )}
                </div>
            </div>

            {activeViewTab === 'DIEU_HANH' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="medpro-card p-4 flex items-center justify-between border-l-4 border-l-[#00B5F1]">
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tổng lượt tiếp nhận</div>
                                <div className="font-display text-2xl font-extrabold text-[#003553] mt-1">
                                    {stats?.so_ca_da_check_in != null ? (stats.so_ca_da_check_in + (stats.so_ca_cho_kham || 0) + (stats.so_ca_dang_kham || 0) + (stats.so_ca_hoan_tat_kham || 0)) : (registrations.length || 0)}
                                </div>
                                <Link to="/admin/bao-cao" className="text-[11px] font-bold text-[#00B5F1] hover:underline mt-1 inline-block">
                                    Báo cáo lưu lượng &rarr;
                                </Link>
                            </div>
                            <div className="w-11 h-11 rounded-xl bg-[#E8F4FD] text-[#00B5F1] font-extrabold flex items-center justify-center text-xs border border-[#CBE9FA]">
                                KCB
                            </div>
                        </div>

                        <div className="medpro-card p-4 flex items-center justify-between border-l-4 border-l-emerald-500">
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Hoàn tất khám &amp; Kê đơn</div>
                                <div className="font-display text-2xl font-extrabold text-emerald-600 mt-1">
                                    {stats?.so_ca_hoan_tat_kham != null ? stats.so_ca_hoan_tat_kham : registrations.filter((r) => r.trangThai === 'Đã khám').length}
                                </div>
                                <Link to="/admin/tuan-thu?tab=DON_THUOC" className="text-[11px] font-bold text-emerald-600 hover:underline mt-1 inline-block">
                                    Đồng bộ ĐTQG &rarr;
                                </Link>
                            </div>
                            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 font-extrabold flex items-center justify-center text-xs border border-emerald-200">
                                EMR
                            </div>
                        </div>

                        <div className="medpro-card p-4 flex items-center justify-between border-l-4 border-l-sky-500">
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nhân sự &amp; Bác sĩ Active</div>
                                <div className="font-display text-2xl font-extrabold text-sky-600 mt-1">
                                    {stats?.tong_bac_si_hoat_dong || staffList.length || 0}
                                </div>
                                <Link to="/admin/nhan-vien" className="text-[11px] font-bold text-sky-600 hover:underline mt-1 inline-block">
                                    Kiểm soát CCHN &rarr;
                                </Link>
                            </div>
                            <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 font-extrabold flex items-center justify-center text-xs border border-sky-200">
                                CCHN
                            </div>
                        </div>

                        <div className="medpro-card p-4 flex items-center justify-between border-l-4 border-l-amber-500">
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Doanh thu kỳ báo cáo</div>
                                <div className="font-display text-xl font-extrabold text-amber-600 mt-1">
                                    {Number(liveRevenue).toLocaleString('vi-VN')} đ
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActiveViewTab('TAI_CHINH_DUOC')}
                                    className="text-[11px] font-bold text-amber-600 hover:underline mt-1 inline-block cursor-pointer"
                                >
                                    Phân tích tài chính &rarr;
                                </button>
                            </div>
                            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 font-extrabold flex items-center justify-center text-xs border border-amber-200">
                                VNĐ
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="medpro-card p-4">
                            <div className="medpro-section-title">
                                <span>HIỆU SUẤT BÁC SĨ &amp; NĂNG SUẤT LÂM SÀNG</span>
                                <Link to="/admin/nhan-vien" className="text-xs font-bold text-[#00B5F1] hover:underline">
                                    Quản lý Bác sĩ
                                </Link>
                            </div>
                            <div className="space-y-2.5 mt-3">
                                {doctorPerformance === null ? (
                                    <div className="p-6 text-center text-sm text-slate-500">
                                        {analyticsLoading ? 'Đang tải dữ liệu hiệu suất bác sĩ...' : 'Chưa có dữ liệu hiệu suất bác sĩ từ API.'}
                                    </div>
                                ) : doctorPerformance.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-slate-500">
                                        Chưa có dữ liệu hiệu suất bác sĩ trong kỳ thống kê này.
                                    </div>
                                ) : (
                                    doctorPerformance.map((doc) => (
                                        <div key={doc.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                                            <div>
                                                <div className="text-xs font-bold text-[#003553]">
                                                    {doc.degree ? `${doc.degree} ` : ''}{doc.name || `Bác sĩ #${doc.id}`}
                                                </div>
                                                <div className="text-[11px] text-slate-500">{doc.specialty || 'Chuyên khoa khám bệnh'}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-extrabold text-[#00B5F1]">{doc.completedCases} ca hoàn tất</div>
                                                <div className="text-[10px] text-emerald-600 font-bold">
                                                    {doc.revenue.toLocaleString('vi-VN')} đ
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
                                <Link to="/admin/danh-muc/khoa-phong" className="text-xs font-bold text-[#00B5F1] hover:underline">
                                    Cấu hình Buồng khám
                                </Link>
                            </div>
                            <div className="space-y-3 mt-3">
                                {roomWorkload.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-slate-400">
                                        Chưa có dữ liệu phân bổ buồng khám trong kỳ
                                    </div>
                                ) : (
                                    roomWorkload.slice(0, 5).map((room, idx) => {
                                        const pct = room.cong_suat_su_dung_pct ?? room.ty_le_su_dung_phan_tram ?? 0
                                        const shifts = room.so_ca_truc_phan_cong ?? room.tong_ca_truc_phan_bo ?? 0
                                        return (
                                            <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                                                <div className="flex justify-between text-xs font-bold text-[#003553]">
                                                    <span>{room.ma_phong} - {room.ten_phong}</span>
                                                    <span className="text-[#00B5F1] font-mono">{pct}%</span>
                                                </div>
                                                <div className="flex justify-between text-[11px] text-slate-500">
                                                    <span>Chuyên khoa: {room.chuyen_khoa || room.loai_phong || 'Đa khoa'}</span>
                                                    <span>{shifts} ca trực/tuần</span>
                                                </div>
                                                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-1.5 rounded-full ${
                                                            pct >= 75
                                                                ? 'bg-emerald-500'
                                                                : pct >= 50
                                                                ? 'bg-[#00B5F1]'
                                                                : 'bg-amber-500'
                                                        }`}
                                                        style={{ width: `${Math.min(100, pct)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="medpro-card p-4">
                        <div className="medpro-section-title">
                            <span>CỔNG GIÁM SÁT NHANH 4 PHÂN HỆ NGHIỆP VỤ CHUYÊN BIỆT</span>
                            <span className="text-[11px] font-normal text-slate-500">
                                Đã phân tách tác nghiệp khỏi Admin — nhấn để chuyển sang giao diện chuẩn của từng bộ phận
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                            {OPERATIONAL_PORTAL_LINKS.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`p-3.5 rounded-xl bg-slate-50/80 hover:bg-[#F0F8FE] border border-slate-200/80 hover:border-[#00B5F1] border-l-4 ${item.accent} transition group flex flex-col justify-between`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00B5F1]">
                                                {item.role}
                                            </span>
                                            <ClinicIcon name={item.icon} size={16} weight="duotone" className="text-[#003553]" />
                                        </div>
                                        <div className="text-xs font-bold text-[#003553] group-hover:text-[#00B5F1] transition">
                                            {item.title}
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                                            {item.desc}
                                        </p>
                                    </div>
                                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-bold text-[#003553] group-hover:text-[#00B5F1]">
                                        <span>Mở cổng chuyên biệt</span>
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
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="medpro-card p-4 border-l-4 border-l-[#003553]">
                            <div className="text-[11px] font-bold uppercase text-slate-500">1. Doanh thu Khám Lâm Sàng</div>
                            <div className="font-display text-xl font-black text-[#003553] mt-1">
                                {Number(stats?.doanh_thu_kham_lam_sang || 0).toLocaleString('vi-VN')} đ
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">Công khám đa chuyên khoa</div>
                        </div>
                        <div className="medpro-card p-4 border-l-4 border-l-[#00B5F1]">
                            <div className="text-[11px] font-bold uppercase text-slate-500">2. Cận Lâm Sàng &amp; DVKT</div>
                            <div className="font-display text-xl font-black text-[#008EC2] mt-1">
                                {Number(stats?.doanh_thu_can_lam_sang || 0).toLocaleString('vi-VN')} đ
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">X-Quang, Siêu âm, Xét nghiệm</div>
                        </div>
                        <div className="medpro-card p-4 border-l-4 border-l-emerald-500">
                            <div className="text-[11px] font-bold uppercase text-slate-500">3. Dịch vụ Kỹ thuật Chuyên sâu</div>
                            <div className="font-display text-xl font-black text-emerald-600 mt-1">
                                {Number(stats?.doanh_thu_goi_dich_vu || 0).toLocaleString('vi-VN')} đ
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">Thủ thuật &amp; Tầm soát định kỳ</div>
                        </div>
                        <div className="medpro-card p-4 border-l-4 border-l-amber-500 bg-amber-50/30">
                            <div className="text-[11px] font-bold uppercase text-amber-800">Tổng Thực Thu Hệ Thống</div>
                            <div className="font-display text-xl font-black text-amber-700 mt-1">
                                {Number(liveRevenue).toLocaleString('vi-VN')} đ
                            </div>
                            <div className="text-[11px] text-amber-600 mt-0.5">Đã quyết toán qua Thu ngân</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="medpro-card p-4">
                            <div className="medpro-section-title">
                                <span>TỶ TRỌNG PHƯƠNG THỨC THANH TOÁN</span>
                                <Link to="/staff/cashier" className="text-xs font-bold text-[#00B5F1] hover:underline">
                                    Cổng Thu ngân
                                </Link>
                            </div>
                            <div className="space-y-3 mt-3">
                                {paymentMethodsBreakdown.map((ht, idx) => (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold text-[#003553]">
                                            <span>{ht.hinhThuc}</span>
                                            <span>{ht.tyLe}% &bull; {Number(ht.soTien || 0).toLocaleString('vi-VN')} đ</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                            <div
                                                className={`h-2 rounded-full ${
                                                    idx === 0 ? 'bg-[#00B5F1]' : idx === 1 ? 'bg-amber-500' : 'bg-emerald-500'
                                                }`}
                                                style={{ width: `${ht.tyLe}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-2 medpro-card p-4">
                            <div className="medpro-section-title">
                                <span>TOP THUỐC KÊ ĐƠN NGOẠI TRÚ PHỔ BIẾN</span>
                                <Link to="/admin/danh-muc/thuoc-vat-tu" className="text-xs font-bold text-[#00B5F1] hover:underline">
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
                                                <td colSpan={5} className="text-center py-4 text-slate-400">
                                                    Chưa có dữ liệu kê đơn thuốc trong kỳ báo cáo
                                                </td>
                                            </tr>
                                        ) : (
                                            topMedicines.slice(0, 5).map((med, idx) => (
                                                <tr key={idx}>
                                                    <td className="font-mono font-bold text-[#003553]">{med.ma_thuoc || `TH${String(idx + 1).padStart(3, '0')}`}</td>
                                                    <td className="font-bold text-[#12263F]">
                                                        {med.ten_thuoc} {med.hoat_chat ? <span className="text-slate-500 text-[11px] font-normal">({med.hoat_chat})</span> : null}
                                                    </td>
                                                    <td>{med.don_vi_tinh || 'Viên'}</td>
                                                    <td className="text-center font-bold text-[#00B5F1]">{med.so_luot_ke || med.so_don_ke || 0} đơn</td>
                                                    <td className="text-right font-mono font-extrabold text-emerald-600">
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
                            <Link to="/admin/danh-muc/dich-vu" className="text-xs font-bold text-[#00B5F1] hover:underline">
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
                                            <td colSpan={6} className="text-center py-4 text-slate-400">
                                                Chưa có dữ liệu chỉ định kỹ thuật trong kỳ báo cáo
                                            </td>
                                        </tr>
                                    ) : (
                                        topServices.slice(0, 5).map((srv, sIdx) => (
                                            <tr key={sIdx}>
                                                <td className="font-mono font-bold text-[#003553]">{srv.ma_dich_vu}</td>
                                                <td className="font-bold text-[#12263F]">{srv.ten_dich_vu}</td>
                                                <td>
                                                    <span className="px-2 py-0.5 rounded bg-sky-50 text-[#00B5F1] font-semibold border border-sky-100 text-[11px]">
                                                        {srv.nhom_dich_vu || srv.ma_nhom_byt || 'Dịch vụ'}
                                                    </span>
                                                </td>
                                                <td className="text-right font-mono font-bold text-slate-700">
                                                    {Number(srv.don_gia).toLocaleString('vi-VN')} đ
                                                </td>
                                                <td className="text-center font-bold text-[#003553]">
                                                    {srv.so_luong_chi_dinh} lượt
                                                </td>
                                                <td className="text-right font-mono font-extrabold text-emerald-600">
                                                    {Number(srv.tong_doanh_thu).toLocaleString('vi-VN')} đ
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
                    <div className="medpro-card p-4 bg-gradient-to-r from-sky-50 to-indigo-50/50 border-[#00B5F1]/30">
                        <div className="flex items-start gap-3">
                            <span className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#003553] to-[#00B5F1] text-white flex items-center justify-center shrink-0 shadow-sm">
                                <Sparkle size={22} weight="fill" className="text-[#FFB54A]" />
                            </span>
                            <div className="space-y-1">
                                <h3 className="font-display font-extrabold text-sm text-[#003553]">
                                    GIÁM SÁT PHÂN LUỒNG AI TRIAGE &amp; MÔ HÌNH BỆNH TẬT ICD-10
                                </h3>
                                <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
                                    Theo dõi tỷ lệ phân luồng chuyên khoa tự động từ cổng đặt lịch bệnh nhân và thống kê mặt bệnh ICD-10 phổ biến phục vụ báo cáo Sở Y tế.
                                    <span className="text-rose-600 font-bold ml-1">
                                        (AI Triage chỉ gợi ý chuyên khoa khám, tuyệt đối không chẩn đoán thay bác sĩ theo Luật KCB 15/2023/QH15).
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="medpro-card p-4 space-y-3">
                            <div className="medpro-section-title">
                                <span>TỶ LỆ PHÂN LUỒNG CHUYÊN KHOA (AI TRIAGE)</span>
                            </div>
                            <div className="space-y-2.5">
                                <div>
                                    <div className="flex justify-between text-xs font-bold text-[#003553] mb-1">
                                        <span>Nội tổng quát &amp; Tim mạch</span>
                                        <span>45% (38 ca)</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div className="h-2 rounded-full bg-[#00B5F1]" style={{ width: '45%' }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs font-bold text-[#003553] mb-1">
                                        <span>Tai Mũi Họng</span>
                                        <span>28% (24 ca)</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div className="h-2 rounded-full bg-amber-500" style={{ width: '28%' }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs font-bold text-[#003553] mb-1">
                                        <span>Cơ Xương Khớp</span>
                                        <span>18% (15 ca)</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: '18%' }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs font-bold text-[#003553] mb-1">
                                        <span>Chẩn đoán hình ảnh &amp; Xét nghiệm</span>
                                        <span>9% (8 ca)</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div className="h-2 rounded-full bg-indigo-500" style={{ width: '9%' }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-2 medpro-card p-4">
                            <div className="medpro-section-title">
                                <span>MÔ HÌNH BỆNH TẬT ICD-10 PHỔ BIẾN</span>
                                <Link to="/admin/danh-muc/benh" className="text-xs font-bold text-[#00B5F1] hover:underline">
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
                                                <td colSpan={6} className="text-center py-4 text-slate-400">
                                                    Chưa có dữ liệu chẩn đoán ICD-10 trong kỳ báo cáo
                                                </td>
                                            </tr>
                                        ) : (
                                            topDiseases.map((b, idx) => (
                                                <tr key={idx}>
                                                    <td className="font-mono font-bold text-[#003553]">{b.ma_icd10}</td>
                                                    <td className="font-bold text-[#12263F]">{b.ten_benh}</td>
                                                    <td className="text-xs text-slate-500">{b.chuong_benh || 'Ngoại trú'}</td>
                                                    <td className="font-mono font-extrabold text-[#00B5F1] text-center">
                                                        {b.so_ca_mac || b.so_ca || 0} ca
                                                    </td>
                                                    <td className="text-center font-bold text-slate-700">
                                                        {b.ty_le_pct || b.ty_le_phan_tram || 0}%
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

            <div className="medpro-card p-3.5 bg-[#E8F4FD]/65 border-[#00B5F1]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-[#003553] text-[#00B5F1] flex items-center justify-center shrink-0 shadow-2xs">
                        <Scales size={19} weight="duotone" />
                    </span>
                    <div>
                        <div className="text-xs font-bold text-[#003553]">
                            Giám sát Tuân thủ Pháp lý Y tế (Thông tư 26/2025/TT-BYT, Thông tư 13/2025/TT-BYT &amp; NĐ 96/2023/NĐ-CP)
                        </div>
                        <div className="text-[11px] text-slate-600">
                            Phát hiện <strong className="text-rose-600">{expiredOrSoonLicenses} nhân sự y tế</strong> có Chứng chỉ hành nghề hết hạn hoặc sắp hết hạn (&lt; 60 ngày) cần rà soát trước khi xếp lịch trực.
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
                    <span className="text-[11px] font-normal text-slate-500">
                        Truy cập nhanh các phân hệ quản trị danh mục, nhân sự, phân quyền và cấu hình phòng khám
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {dashboardQuickModules.map((mod, idx) => (
                        <Link
                            key={idx}
                            to={mod.path}
                            className="medpro-card p-4 hover:border-[#00B5F1] hover:shadow-lg transition group flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-center justify-between mb-2.5">
                                    <span className="w-10 h-10 rounded-xl bg-[#E8F4FD] text-[#00B5F1] border border-[#CBE9FA] flex items-center justify-center group-hover:bg-[#00B5F1] group-hover:text-white transition">
                                        <ClinicIcon name={mod.icon} size={20} weight="duotone" />
                                    </span>
                                    <span className="medpro-badge-info">{mod.step}</span>
                                </div>
                                <h3 className="font-display font-bold text-sm text-[#003553] group-hover:text-[#00B5F1] transition">
                                    {mod.title}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{mod.desc}</p>
                            </div>
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-[#00B5F1]">
                                <span>{mod.badge}</span>
                                <span className="inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
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
                    <Link to="/admin/lich-su-hoat-dong" className="text-xs font-bold text-[#00B5F1] hover:underline">
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
                                    <td className="font-mono font-bold text-[#003553]">{log.id}</td>
                                    <td className="tabular-nums text-slate-600">{log.thoiGian}</td>
                                    <td className="font-semibold text-[#12263F]">{String(log.nguoiDung || '').replace(/\s*\(INT-\d+\)/g, '')}</td>
                                    <td>
                                        <span className="medpro-badge-info">{ROLE_LABEL_MAP[log.vaiTro] || log.vaiTro}</span>
                                    </td>
                                    <td className="font-semibold text-xs text-[#003553]">{ACTION_LABEL_MAP[log.hanhDong] || log.hanhDong}</td>
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
