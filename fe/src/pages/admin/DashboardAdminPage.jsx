import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { getDashboardStatsAsync } from '../../redux/actions/admin/adminAction'
import { getNavigationConfig } from '../../services/admin/clinicSeedData'
import {
    ClinicIcon,
    StatusBadge,
    Users,
    CalendarCheck,
    Stethoscope,
    CurrencyCircleDollar,
    ClipboardText,
    Scales,
    ShieldCheck,
    ArrowRight,
    Clock,
    UserCheck,
    Receipt,
    ChartBar,
    Sparkle,
    CheckCircle,
    PhoneCall,
    Package,
    ChatTeardropDots,
    Flask,
} from '../../components/common/ClinicIcon'

export default function DashboardAdminPage() {
    const dispatch = useDispatch()
    const { clinicData, stats } = useSelector((state) => state.app.admin)
    const { dashboardQuickModules = [] } = getNavigationConfig(clinicData)

    const [activeRoleTab, setActiveRoleTab] = useState('QUAN_LY')
    const [timeFilter, setTimeFilter] = useState('week')

    useEffect(() => {
        dispatch(getDashboardStatsAsync())
    }, [dispatch])

    const patients = clinicData?.patients || []
    const appointments = clinicData?.appointments || []
    const registrations = clinicData?.registrations || []
    const vouchers = clinicData?.vouchers || []
    const staffList = clinicData?.staffList || []
    const roleWorkbenches = clinicData?.roleWorkbenches || {}
    const pendingTasks = roleWorkbenches.pendingReceptionTasks || []
    const doctorSchedules = roleWorkbenches.doctorSchedules || []
    const accountantSummary = roleWorkbenches.accountantSummary || {}

    // Multiplier based on time filter
    const multiplier = timeFilter === 'today' ? 0.35 : timeFilter === 'month' ? 4.2 : 1.0

    const totalRevenue = vouchers
        .filter((v) => v.loaiPhieu === 'Phiếu thu' && v.daThu)
        .reduce((sum, v) => sum + (Number(v.tongTien) || 0), 0)

    const expiredOrSoonLicenses = staffList.filter(
        (s) => s.trangThaiCCHN === 'EXPIRED' || s.trangThaiCCHN === 'EXPIRING_SOON'
    ).length

    // Role-based tabs like tClinic demo
    const roleTabs = [
        { id: 'QUAN_LY', label: 'QUẢN LÝ', icon: ShieldCheck, desc: 'Tổng quan điều hành' },
        { id: 'LE_TAN', label: 'LỄ TÂN', icon: UserCheck, desc: 'Tiếp đón & Đăng ký' },
        { id: 'BAC_SI', label: 'BÁC SĨ', icon: Stethoscope, desc: 'Bàn khám & Lịch trực' },
        { id: 'KE_TOAN', label: 'KẾ TOÁN', icon: Receipt, desc: 'Thu chi & Doanh thu' },
        { id: 'THONG_KE', label: 'THỐNG KÊ & AI PHÂN LUỒNG', icon: ChartBar, desc: 'Báo cáo y tế & AI Triage' },
    ]

    const timeFilters = [
        { id: 'today', label: 'Hôm nay' },
        { id: 'week', label: 'Tuần này' },
        { id: 'month', label: 'Tháng này' },
    ]

    return (
        <div className="space-y-4">
            {/* Top Welcome Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-[#003553] via-[#004A73] to-[#00B5F1] p-5 text-white shadow-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-wider border border-white/20">
                        <ShieldCheck size={14} weight="fill" className="text-[#FFB54A]" />
                        <span>Bàn làm việc Đa vai trò Chuẩn HIS (tClinic & Medpro.vn)</span>
                    </div>
                    <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
                        TRUNG TÂM ĐIỀU HÀNH & BÀN LÀM VIỆC ĐA VAI TRÒ CLINIC-AI
                    </h1>
                    <p className="text-xs text-sky-100 max-w-3xl">
                        Mô hình điều hành theo vai trò chuẩn nghiệp vụ phòng khám thực tế: Quản lý, Lễ tân tiếp đón, Bác sĩ lâm sàng, Kế toán viện phí và Phân luồng AI Chuyên khoa.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    <Link
                        to="/admin/dang-ky-kham"
                        className="px-4 py-2 rounded-full bg-[#FFB54A] hover:bg-[#FBA342] text-[#003553] font-extrabold text-xs shadow-sm transition inline-flex items-center gap-1.5"
                    >
                        <ClipboardText size={16} weight="bold" />
                        <span>Tiếp đón (F2)</span>
                    </Link>
                    <Link
                        to="/admin/kham-benh"
                        className="px-4 py-2 rounded-full bg-white text-[#003553] hover:bg-[#E8F4FD] font-extrabold text-xs shadow-sm transition inline-flex items-center gap-1.5"
                    >
                        <Stethoscope size={16} weight="duotone" className="text-[#00B5F1]" />
                        <span>Bàn khám (F7)</span>
                    </Link>
                </div>
            </div>

            {/* Time Filter & Role Switcher Bar (Tương đồng bàn làm việc tClinic) */}
            <div className="medpro-card p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                {/* 5 Role Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-xl">
                    {roleTabs.map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeRoleTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveRoleTab(tab.id)}
                                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
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

                {/* Date range filter buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
                        <Clock size={13} />
                        <span>Thời gian:</span>
                    </span>
                    {timeFilters.map((tf) => (
                        <button
                            key={tf.id}
                            onClick={() => setTimeFilter(tf.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                timeFilter === tf.id
                                    ? 'bg-[#003553] text-white shadow-xs'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:border-[#00B5F1]'
                            }`}
                        >
                            {tf.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* TAB CONTENT 1: QUẢN LÝ (Executive Management) */}
            {activeRoleTab === 'QUAN_LY' && (
                <div className="space-y-4">
                    {/* 4 tClinic Circular Stat Cards (TĐK, CK, ĐK, KTK) */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="medpro-card p-4 flex items-center justify-between border-l-4 border-l-[#00B5F1]">
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">TĐK — Tổng đăng ký</div>
                                <div className="font-display text-2xl font-extrabold text-[#003553] mt-1">
                                    {Math.round(registrations.length * multiplier)}
                                </div>
                                <Link to="/admin/dang-ky-kham" className="text-[11px] font-bold text-[#00B5F1] hover:underline mt-1 inline-block">
                                    Chi tiết &rarr;
                                </Link>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-[#E8F4FD] text-[#00B5F1] font-extrabold flex items-center justify-center text-sm border border-[#CBE9FA]">
                                TĐK
                            </div>
                        </div>

                        <div className="medpro-card p-4 flex items-center justify-between border-l-4 border-l-amber-500">
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">CK — Chờ khám</div>
                                <div className="font-display text-2xl font-extrabold text-amber-600 mt-1">
                                    {Math.max(1, Math.round(registrations.filter((r) => r.trangThai === 'Chờ khám').length * multiplier))}
                                </div>
                                <Link to="/admin/kham-benh" className="text-[11px] font-bold text-amber-600 hover:underline mt-1 inline-block">
                                    Chi tiết &rarr;
                                </Link>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 font-extrabold flex items-center justify-center text-sm border border-amber-200">
                                CK
                            </div>
                        </div>

                        <div className="medpro-card p-4 flex items-center justify-between border-l-4 border-l-sky-500">
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">ĐK — Đang khám</div>
                                <div className="font-display text-2xl font-extrabold text-sky-600 mt-1">
                                    {Math.round(registrations.filter((r) => r.trangThai === 'Đang khám').length * multiplier) || 1}
                                </div>
                                <Link to="/admin/kham-benh" className="text-[11px] font-bold text-sky-600 hover:underline mt-1 inline-block">
                                    Chi tiết &rarr;
                                </Link>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-sky-50 text-sky-600 font-extrabold flex items-center justify-center text-sm border border-sky-200">
                                ĐK
                            </div>
                        </div>

                        <div className="medpro-card p-4 flex items-center justify-between border-l-4 border-l-emerald-500">
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">KTK — Kết thúc khám</div>
                                <div className="font-display text-2xl font-extrabold text-emerald-600 mt-1">
                                    {Math.round(registrations.filter((r) => r.trangThai === 'Đã khám').length * multiplier) || 2}
                                </div>
                                <Link to="/admin/kham-benh" className="text-[11px] font-bold text-emerald-600 hover:underline mt-1 inline-block">
                                    Chi tiết &rarr;
                                </Link>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 font-extrabold flex items-center justify-center text-sm border border-emerald-200">
                                KTK
                            </div>
                        </div>
                    </div>

                    {/* Split view: Doctor workloads & Room allocation */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="medpro-card p-4">
                            <div className="medpro-section-title">
                                <span>ĐĂNG KÝ THEO BÁC SĨ (WORKLOAD BÁC SĨ)</span>
                                <span className="text-xs text-slate-400">Số ca khám phân bổ</span>
                            </div>
                            <div className="space-y-3 mt-3">
                                {doctorSchedules.map((doc, idx) => (
                                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-bold text-[#003553]">{doc.bacSi}</div>
                                            <div className="text-[11px] text-slate-500">{doc.phong} &bull; Ca trực: {doc.caTruc}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-extrabold text-[#00B5F1]">{doc.soCaDaKham + doc.soCaCho} ca</div>
                                            <div className="text-[10px] text-slate-400">({doc.soCaCho} ca chờ khám)</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="medpro-card p-4">
                            <div className="medpro-section-title">
                                <span>LỊCH HẸN THEO TRẠNG THÁI</span>
                                <Link to="/admin/lich-hen" className="text-xs font-bold text-[#00B5F1] hover:underline">
                                    Xem lịch hẹn
                                </Link>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5 mt-3">
                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                                    <div className="text-xl font-extrabold text-emerald-700">
                                        {appointments.filter((a) => a.trangThai === 'Xác nhận').length}
                                    </div>
                                    <div className="text-[11px] font-bold text-emerald-600 mt-0.5">Đã xác nhận</div>
                                </div>
                                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
                                    <div className="text-xl font-extrabold text-amber-700">
                                        {appointments.filter((a) => a.trangThai === 'Chờ xác nhận').length}
                                    </div>
                                    <div className="text-[11px] font-bold text-amber-600 mt-0.5">Chờ tiếp đón</div>
                                </div>
                                <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-center">
                                    <div className="text-xl font-extrabold text-sky-700">
                                        {appointments.filter((a) => a.khamTuXa).length || 2}
                                    </div>
                                    <div className="text-[11px] font-bold text-sky-600 mt-0.5">Khám từ xa</div>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                                    <div className="text-xl font-extrabold text-slate-700">
                                        {clinicData?.servicePackageRegistrations?.length || 3}
                                    </div>
                                    <div className="text-[11px] font-bold text-slate-600 mt-0.5">Gói dịch vụ</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT 2: LỄ TÂN (Receptionist Workbench) */}
            {activeRoleTab === 'LE_TAN' && (
                <div className="space-y-4">
                    {/* Pending Tasks Alert Grid from tClinic demo */}
                    <div className="medpro-card p-4 bg-gradient-to-br from-[#E8F4FD]/80 to-white border-[#B8E5FA]">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="w-8 h-8 rounded-lg bg-[#00B5F1] text-white flex items-center justify-center font-bold">
                                <ClipboardText size={18} weight="bold" />
                            </span>
                            <div>
                                <h3 className="font-display font-extrabold text-sm text-[#003553]">
                                    CÔNG VIỆC LỄ TÂN ĐANG XỬ LÝ (THEO THỜI GIAN THỰC)
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                    Các tác vụ tiếp đón và lịch hẹn từ Bệnh nhân Medpro & Khách lẻ vãng lai cần lễ tân giải quyết ngay
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {pendingTasks.map((task) => (
                                <Link
                                    key={task.id}
                                    to={task.route}
                                    className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:border-[#00B5F1] hover:shadow-md transition flex items-center justify-between"
                                >
                                    <div>
                                        <div className="text-2xl font-black text-[#003553] tabular-nums">
                                            {task.count}
                                        </div>
                                        <div className="text-xs font-semibold text-slate-600 mt-0.5 leading-snug">
                                            {task.label}
                                        </div>
                                    </div>
                                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                        task.badgeVariant === 'danger'
                                            ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                            : task.badgeVariant === 'warning'
                                            ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                            : 'bg-sky-50 text-sky-600 border border-sky-200'
                                    }`}>
                                        <ClinicIcon name={task.icon} size={18} weight="bold" />
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Quick Registration Table */}
                    <div className="medpro-card p-4">
                        <div className="medpro-section-title">
                            <span>DANH SÁCH BỆNH NHÂN TIẾP ĐÓN TRONG NGÀY</span>
                            <Link to="/admin/dang-ky-kham" className="medpro-btn-primary text-xs">
                                <span>Thêm tiếp đón mới (F2)</span>
                            </Link>
                        </div>
                        <div className="overflow-x-auto mt-3">
                            <table className="medpro-table">
                                <thead>
                                    <tr>
                                        <th>STT</th>
                                        <th>Mã KCB</th>
                                        <th>Mã BN</th>
                                        <th>Tên bệnh nhân</th>
                                        <th>Ngày đăng ký</th>
                                        <th>Ưu tiên</th>
                                        <th>Điện thoại</th>
                                        <th>Phòng khám</th>
                                        <th>Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {registrations.slice(0, 5).map((reg, idx) => (
                                        <tr key={reg.id || idx}>
                                            <td className="font-bold">{idx + 1}</td>
                                            <td className="font-mono font-bold text-[#003553]">{reg.maKCB}</td>
                                            <td className="font-mono text-slate-500">{reg.maBN}</td>
                                            <td className="font-bold text-[#12263F]">{reg.hoTen}</td>
                                            <td className="text-slate-600 tabular-nums">{reg.ngayDangKy}</td>
                                            <td>
                                                {reg.uuTien ? (
                                                    <span className="medpro-badge-danger">Ưu tiên (UT)</span>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">Thường</span>
                                                )}
                                            </td>
                                            <td className="tabular-nums font-mono">{reg.dienThoai}</td>
                                            <td>{reg.phongKham}</td>
                                            <td>
                                                <StatusBadge status={reg.trangThai} compact />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT 3: BÁC SĨ (Doctor Clinical Workbench) */}
            {activeRoleTab === 'BAC_SI' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 medpro-card p-4">
                            <div className="medpro-section-title">
                                <span>LỊCH TRỰC PHÒNG KHÁM & DANH SÁCH CHỜ KHÁM</span>
                                <Link to="/admin/kham-benh" className="medpro-btn-primary text-xs">
                                    <span>Vào phòng khám (F7)</span>
                                </Link>
                            </div>

                            <div className="overflow-x-auto mt-3">
                                <table className="medpro-table">
                                    <thead>
                                        <tr>
                                            <th>Bác sĩ phụ trách</th>
                                            <th>Phòng khám</th>
                                            <th>Ca trực</th>
                                            <th>Chờ khám</th>
                                            <th>Đã khám</th>
                                            <th>Khám từ xa</th>
                                            <th>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {doctorSchedules.map((doc, idx) => (
                                            <tr key={idx}>
                                                <td className="font-bold text-[#003553]">{doc.bacSi}</td>
                                                <td>{doc.phong}</td>
                                                <td className="tabular-nums text-xs">{doc.caTruc}</td>
                                                <td>
                                                    <span className="medpro-badge-warning">{doc.soCaCho} ca chờ</span>
                                                </td>
                                                <td>
                                                    <span className="medpro-badge-success">{doc.soCaDaKham} ca xong</span>
                                                </td>
                                                <td>
                                                    <span className="medpro-badge-info">{doc.khamTuXa} ca</span>
                                                </td>
                                                <td>
                                                    <Link
                                                        to="/admin/kham-benh"
                                                        className="px-2.5 py-1 rounded bg-[#E8F4FD] text-[#00B5F1] hover:bg-[#00B5F1] hover:text-white font-bold text-[11px] transition inline-block"
                                                    >
                                                        Mở ca
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="medpro-card p-4 space-y-3">
                            <div className="medpro-section-title">
                                <span>KẾT QUẢ CLS VỪA TRẢ</span>
                                <Link to="/admin/can-lam-sang" className="text-xs font-bold text-[#00B5F1] hover:underline">
                                    Chi tiết CLS
                                </Link>
                            </div>
                            {(clinicData?.paraclinicalTasks || []).map((cls) => (
                                <div key={cls.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                                    <div className="flex items-center justify-between font-bold">
                                        <span className="text-[#003553]">{cls.hoTen} ({cls.tuoi})</span>
                                        <StatusBadge status={cls.trangThai} compact />
                                    </div>
                                    <div className="text-slate-600">
                                        <strong>{cls.tenDV}</strong> ({cls.loaiCLS})
                                    </div>
                                    <div className="text-[11px] text-slate-500 italic">
                                        Kết luận: {cls.ketLuan}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT 4: KẾ TOÁN (Cashier & Financial Workbench) */}
            {activeRoleTab === 'KE_TOAN' && (
                <div className="space-y-4">
                    {/* Revenue summary tiles */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="medpro-card p-4 border-l-4 border-l-[#00B5F1]">
                            <div className="text-[11px] font-bold uppercase text-slate-500">Doanh thu Dịch vụ kỹ thuật</div>
                            <div className="font-display text-xl font-black text-[#003553] mt-1">
                                {(accountantSummary.doanhThuDichVu * multiplier).toLocaleString('vi-VN')} đ
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">Khám, X-Quang, Siêu âm, PT-TT</div>
                        </div>
                        <div className="medpro-card p-4 border-l-4 border-l-emerald-500">
                            <div className="text-[11px] font-bold uppercase text-slate-500">Doanh thu Nhà thuốc (GPP)</div>
                            <div className="font-display text-xl font-black text-emerald-600 mt-1">
                                {(accountantSummary.doanhThuNhaThuoc * multiplier).toLocaleString('vi-VN')} đ
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">Đơn thuốc ngoại trú đã liên thông</div>
                        </div>
                        <div className="medpro-card p-4 border-l-4 border-l-amber-500">
                            <div className="text-[11px] font-bold uppercase text-slate-500">Doanh thu Gói dịch vụ</div>
                            <div className="font-display text-xl font-black text-amber-600 mt-1">
                                {(accountantSummary.doanhThuGoiKham * multiplier).toLocaleString('vi-VN')} đ
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">Gói tầm soát sức khỏe tổng quát</div>
                        </div>
                        <div className="medpro-card p-4 border-l-4 border-l-purple-500">
                            <div className="text-[11px] font-bold uppercase text-slate-500">Khám đoàn Doanh nghiệp (B2B)</div>
                            <div className="font-display text-xl font-black text-purple-600 mt-1">
                                {(accountantSummary.doanhThuKhamDoan * multiplier).toLocaleString('vi-VN')} đ
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">Hợp đồng KSK định kỳ công ty</div>
                        </div>
                    </div>

                    {/* Payment methods breakdown & Cashier actions */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="medpro-card p-4">
                            <div className="medpro-section-title">
                                <span>HÌNH THỨC THU TIỀN THỰC TẾ</span>
                                <span className="text-xs text-slate-400">Tỷ lệ thanh toán</span>
                            </div>
                            <div className="space-y-3 mt-3">
                                {(accountantSummary.hinhThucThu || []).map((ht, idx) => (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold text-[#003553]">
                                            <span>{ht.hinhThuc}</span>
                                            <span>{ht.tyLe}% &bull; {Math.round(ht.soTien * multiplier).toLocaleString('vi-VN')} đ</span>
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
                                <span>DANH SÁCH BIÊN LAI VIỆN PHÍ & HÓA ĐƠN GẦN ĐÂY</span>
                                <Link to="/admin/thu-chi" className="medpro-btn-primary text-xs">
                                    <span>Quản lý Thu ngân & Khóa sổ</span>
                                </Link>
                            </div>
                            <div className="overflow-x-auto mt-3">
                                <table className="medpro-table">
                                    <thead>
                                        <tr>
                                            <th>Số phiếu</th>
                                            <th>Loại</th>
                                            <th>Bệnh nhân / Đơn vị</th>
                                            <th>Số tiền</th>
                                            <th>Hình thức</th>
                                            <th>Thu ngân</th>
                                            <th>Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {vouchers.slice(0, 4).map((v) => (
                                            <tr key={v.id}>
                                                <td className="font-mono font-bold text-[#003553]">{v.maPhieu}</td>
                                                <td>
                                                    <span className={v.loaiPhieu === 'Phiếu thu' ? 'medpro-badge-success' : 'medpro-badge-warning'}>
                                                        {v.loaiPhieu}
                                                    </span>
                                                </td>
                                                <td className="font-bold text-[#12263F]">{v.hoTenBN || 'Kho Dược / Nhà cung cấp'}</td>
                                                <td className="font-mono font-extrabold text-[#00B5F1]">
                                                    {Number(v.tongTien).toLocaleString('vi-VN')} đ
                                                </td>
                                                <td>{v.hinhThuc}</td>
                                                <td className="text-xs text-slate-500">{v.nguoiThu}</td>
                                                <td>
                                                    <StatusBadge status={v.daThu ? 'Đã thu tiền' : 'Chờ thu'} compact />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT 5: THỐNG KÊ & AI PHÂN LUỒNG (Medical Statistics & AI Triage) */}
            {activeRoleTab === 'THONG_KE' && (
                <div className="space-y-4">
                    <div className="medpro-card p-4 bg-gradient-to-r from-sky-50 to-indigo-50/50 border-[#00B5F1]/30">
                        <div className="flex items-start gap-3">
                            <span className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#003553] to-[#00B5F1] text-white flex items-center justify-center shrink-0 shadow-sm">
                                <Sparkle size={22} weight="fill" className="text-[#FFB54A]" />
                            </span>
                            <div className="space-y-1">
                                <h3 className="font-display font-extrabold text-sm text-[#003553]">
                                    TRỢ LÝ AI GỢI Ý CHUYÊN KHOA & PHÂN LUỒNG BỆNH NHÂN (AI TRIAGE)
                                </h3>
                                <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
                                    Hệ thống sử dụng mô hình AI phân tích triệu chứng tự nhiên của bệnh nhân (ngực, khó thở, ho, tai mũi họng, đau khớp, cột sống...) để <strong>gợi ý phân luồng vào Chuyên khoa phù hợp</strong> ngay từ bước đặt lịch trực tuyến. 
                                    <span className="text-rose-600 font-bold ml-1">
                                        (Cam kết: AI chỉ hỗ trợ phân luồng chuyên khoa, tuyệt đối không tự chẩn đoán bệnh thay bác sĩ theo Luật KCB 15/2023/QH15).
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="medpro-card p-4 space-y-3">
                            <div className="medpro-section-title">
                                <span>TỶ LỆ PHÂN LUỒNG CHUYÊN KHOA</span>
                            </div>
                            <div className="space-y-2.5">
                                <div>
                                    <div className="flex justify-between text-xs font-bold text-[#003553] mb-1">
                                        <span>Nội tổng quát & Tim mạch</span>
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
                                        <span>Cơ Xương Khớp & VLTL</span>
                                        <span>18% (15 ca)</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: '18%' }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs font-bold text-[#003553] mb-1">
                                        <span>Chẩn đoán hình ảnh & Xét nghiệm</span>
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
                                <span>MÔ HÌNH BỆNH TẬT ICD-10 PHỔ BIẾN TẠI PHÒNG KHÁM</span>
                                <Link to="/admin/danh-muc" className="text-xs font-bold text-[#00B5F1] hover:underline">
                                    Danh mục ICD-10
                                </Link>
                            </div>
                            <div className="overflow-x-auto mt-3">
                                <table className="medpro-table">
                                    <thead>
                                        <tr>
                                            <th>Mã ICD-10</th>
                                            <th>Tên bệnh tật</th>
                                            <th>Chương bệnh</th>
                                            <th>Số ca ghi nhận</th>
                                            <th>Báo cáo dịch bệnh</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(clinicData?.catalogs?.danhMucBenh || []).map((b) => (
                                            <tr key={b.id}>
                                                <td className="font-mono font-bold text-[#003553]">{b.maICD}</td>
                                                <td className="font-bold text-[#12263F]">{b.tenBenh}</td>
                                                <td className="text-xs text-slate-500">{b.chuongBenh}</td>
                                                <td className="font-mono font-extrabold text-[#00B5F1]">
                                                    {b.maICD === 'I10' ? 42 : b.maICD === 'J00' ? 29 : b.maICD === 'M54.5' ? 18 : 6} ca
                                                </td>
                                                <td>
                                                    {b.truyenNhiem ? (
                                                        <span className="medpro-badge-danger">Nhóm B (Báo cáo Sở)</span>
                                                    ) : (
                                                        <span className="medpro-badge-success">Ngoại trú thường</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Compliance Alert Bar */}
            <div className="medpro-card p-3.5 bg-[#E8F4FD]/65 border-[#00B5F1]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-[#003553] text-[#00B5F1] flex items-center justify-center shrink-0 shadow-2xs">
                        <Scales size={19} weight="duotone" />
                    </span>
                    <div>
                        <div className="text-xs font-bold text-[#003553]">
                            Giám sát Tuân thủ Pháp lý Y tế (Thông tư 26/2025/TT-BYT, Thông tư 13/2025/TT-BYT & NĐ 96/2023/NĐ-CP)
                        </div>
                        <div className="text-[11px] text-slate-600">
                            Phát hiện <strong className="text-rose-600">{expiredOrSoonLicenses} nhân sự y tế</strong> có Chứng chỉ hành nghề hết hạn hoặc sắp hết hạn (&lt; 60 ngày) cần rà soát trước khi xếp lịch trực.
                            {stats ? ' (Đã đồng bộ API Backend /api/v1/compliance/dashboard)' : ''}
                        </div>
                    </div>
                </div>
                <Link to="/admin/tuan-thu" className="medpro-btn-primary text-xs shrink-0">
                    <span>Xem Bảng điều khiển Pháp lý</span>
                    <ArrowRight size={14} weight="bold" />
                </Link>
            </div>

            {/* 12 Functional Modules Grid from Seed */}
            <div>
                <div className="medpro-section-title">
                    <span>DANH MỤC 10 PHÂN HỆ NGHIỆP VỤ QUẢN LÝ PHÒNG KHÁM</span>
                    <span className="text-[11px] font-normal text-slate-500">
                        Nhấn vào từng phân hệ để thao tác trực tiếp với dữ liệu từ Seed
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
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
                                    <span>Mở phân hệ</span>
                                    <ArrowRight size={13} weight="bold" />
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Recent Audit Logs Preview */}
            <div className="medpro-card p-4">
                <div className="medpro-section-title">
                    <span>NHẬT KÝ KIỂM TOÁN & HOẠT ĐỘNG GẦN ĐÂY (HEALTH DATA ACCESS AUDIT LOG)</span>
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
                                    <td className="font-semibold text-[#12263F]">{log.nguoiDung}</td>
                                    <td>
                                        <span className="medpro-badge-info">{log.vaiTro}</span>
                                    </td>
                                    <td className="font-mono text-[11px] font-bold text-[#00B5F1]">{log.hanhDong}</td>
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
