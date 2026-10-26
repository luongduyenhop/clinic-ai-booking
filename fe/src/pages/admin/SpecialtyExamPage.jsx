import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import {
    Stethoscope,
    Eye,
    Ear,
    Tooth,
    FirstAidKit,
    Heartbeat,
    FloppyDisk,
    Signature,
    FileText,
    Pill,
    CheckCircle,
    Warning,
    ArrowsClockwise,
    ArrowLeft,
    CaretLeft,
    CaretRight,
    MagnifyingGlass,
    Funnel,
    Check,
} from '@phosphor-icons/react'
import { AppToast } from '../../components/common/AppNotification'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { clinicalService } from '../../services/doctor/ClinicalService'

const SPECIALTY_META = {
    'noi-khoa': {
        title: 'KHÁM NỘI KHOA',
        deptCode: 'NOI',
        icon: Heartbeat,
        color: 'text-rose-600',
        bg: 'bg-rose-50',
        borderColor: 'border-rose-200',
        desc: 'Khám tuần hoàn, hô hấp, tiêu hóa, thần kinh, cơ xương khớp theo chuẩn Bộ Y tế',
    },
    'ngoai-khoa': {
        title: 'KHÁM NGOẠI KHOA',
        deptCode: 'NGOAI',
        icon: FirstAidKit,
        color: 'text-teal-600',
        bg: 'bg-teal-50',
        borderColor: 'border-teal-200',
        desc: 'Khám ngoại tổng quát, vết mổ, khối u, thoát vị & chỉ định tiểu phẫu / thủ thuật',
    },
    'mat': {
        title: 'KHÁM MẮT (NHÃN KHOA)',
        deptCode: 'MAT',
        icon: Eye,
        color: 'text-sky-600',
        bg: 'bg-sky-50',
        borderColor: 'border-sky-200',
        desc: 'Đo thị lực Snellen OD/OS, nhãn áp kế, khám bán phần trước và đáy mắt',
    },
    'tai-mui-hong': {
        title: 'KHÁM TAI MŨI HỌNG',
        deptCode: 'TMH',
        icon: Ear,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        borderColor: 'border-amber-200',
        desc: 'Nội soi ống tai, màng nhĩ, hốc mũi, cuốn mũi, amidan phân độ & dây thanh âm',
    },
    'rang-ham-mat': {
        title: 'KHÁM RĂNG HÀM MẶT',
        deptCode: 'RHM',
        icon: Tooth,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        desc: 'Sơ đồ 32 răng nha khoa Odontogram, nha chu, nướu lợi, vôi răng & khớp thái dương hàm',
    },
}

export default function SpecialtyExamPage() {
    const { deptKey = 'noi-khoa' } = useParams()
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { clinicData } = useSelector((state) => state.app.admin)

    const registrations = clinicData?.registrations || []
    const doctors = clinicData?.staffList?.filter((s) => s.vaiTro?.includes('Bác sĩ')) || []

    const currentMeta = SPECIALTY_META[deptKey] || SPECIALTY_META['noi-khoa']
    const DeptIcon = currentMeta.icon

    const [selectedRegId, setSelectedRegId] = useState(registrations[0]?.id || '')
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [examSheetType, setExamSheetType] = useState('Phiếu khám chuyên khoa tiêu chuẩn')
    const [selectedDoctor, setSelectedDoctor] = useState(doctors[0]?.hoTen || 'BS.CKII Nguyễn Minh Hoàng')
    const [recorderName, setRecorderName] = useState('Điều dưỡng Vũ Thị Mỹ Dung')
    const [recordDate, setRecordDate] = useState('2026-10-12')

    const currentExam = useMemo(() => {
        return registrations.find((r) => r.id === selectedRegId) || registrations[0] || null
    }, [registrations, selectedRegId])

    const currentIndex = useMemo(() => {
        return registrations.findIndex((r) => r.id === currentExam?.id)
    }, [registrations, currentExam?.id])
    const hasPrev = currentIndex > 0
    const hasNext = currentIndex >= 0 && currentIndex < registrations.length - 1

    // State khám chuyên khoa
    const [specialtyData, setSpecialtyData] = useState(() => currentExam?.specialtyExams || {})
    const [activeTooth, setActiveTooth] = useState('16')

    // Đồng bộ khi đổi bệnh nhân
    useEffect(() => {
        if (currentExam) {
            setSpecialtyData(currentExam.specialtyExams || {})
        }
    }, [currentExam?.id])

    // Lọc hàng đợi
    const filteredRegistrations = useMemo(() => {
        return registrations.filter((r) => {
            const matchSearch =
                !searchQuery ||
                r.hoTen?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.maKCB?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.dienThoai?.includes(searchQuery)
            const matchStatus = statusFilter === 'ALL' || r.trangThai === statusFilter
            return matchSearch && matchStatus
        })
    }, [registrations, searchQuery, statusFilter])

    // Bộ đếm răng RHM
    const toothCounts = useMemo(() => {
        const counts = { BT: 0, S: 0, M: 0, T: 0, B: 0, K: 0 }
        const teeth = specialtyData?.rhm?.teethStatus || {}
        Object.values(teeth).forEach((st) => {
            if (counts[st] !== undefined) counts[st]++
            else counts.BT++
        })
        return counts
    }, [specialtyData?.rhm?.teethStatus])

    const handleUpdateToothStatus = (status) => {
        if (!activeTooth) return
        setSpecialtyData((prev) => ({
            ...prev,
            rhm: {
                ...prev.rhm,
                teethStatus: {
                    ...(prev.rhm?.teethStatus || {}),
                    [activeTooth]: status,
                },
            },
        }))
        const names = {
            BT: 'Bình thường',
            S: 'Sâu răng [S]',
            M: 'Mất răng [M]',
            T: 'Trám răng [T]',
            B: 'Bọc sứ [B]',
            K: 'Khôn lệch [K]',
        }
        AppToast.info(`Đã cập nhật Răng ${activeTooth}: ${names[status] || status}`)
    }

    const handleSaveSpecialtyData = async () => {
        if (!currentExam) return
        const updatedExam = {
            ...currentExam,
            specialtyExams: specialtyData,
        }
        const updatedList = registrations.map((r) => (r.id === currentExam.id ? updatedExam : r))
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'registrations',
                items: updatedList,
                auditEntry: {
                    hanhDong: `UPDATE_SPECIALTY_${currentMeta.deptCode}`,
                    doiTuong: `HSBA ${currentExam.maKCB} - Khoa ${currentMeta.title}`,
                    mucDich: `Cập nhật hồ sơ bệnh án chuyên khoa ${currentMeta.title}`,
                },
            })
        )
        const encounterId = Number(String(currentExam.id).replace(/\D/g, '')) || 1
        const activeKey = deptKey || 'noi-khoa'
        await clinicalService.saveSpecialtyExam(encounterId, activeKey, specialtyData[activeKey.split('-')[0]] || specialtyData)
        AppToast.success(`Lưu dữ liệu ${currentMeta.title} (CSDL 2 tầng) thành công!`)
    }

    return (
        <div className="space-y-4">
            {/* Header Chuyên Khoa & Điều Hướng Nhanh */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/kham-benh')}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                        title="Quay lại Bàn khám chung"
                    >
                        <ArrowLeft size={16} weight="bold" />
                    </button>
                    <div className={`w-10 h-10 rounded-xl ${currentMeta.bg} ${currentMeta.color} flex items-center justify-center font-bold`}>
                        <DeptIcon size={22} weight="duotone" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-extrabold text-[#003553] uppercase">{currentMeta.title}</h1>
                            <span className="medpro-badge-cyan text-[11px] font-bold">Chuẩn tClinic</span>
                        </div>
                        <p className="text-xs text-slate-500">{currentMeta.desc}</p>
                    </div>
                </div>

                {/* 5 Tab chuyển đổi nhanh giữa các chuyên khoa */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                    {Object.entries(SPECIALTY_META).map(([key, meta]) => {
                        const Icon = meta.icon
                        const isActive = key === deptKey
                        return (
                            <Link
                                key={key}
                                to={`/admin/kham-chuyen-khoa/${key}`}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                                    isActive
                                        ? 'bg-white text-[#00B5F1] shadow-2xs'
                                        : 'text-slate-600 hover:text-[#00B5F1] hover:bg-white/60'
                                }`}
                            >
                                <Icon size={14} weight={isActive ? 'fill' : 'regular'} />
                                <span>{meta.title.replace('KHÁM ', '')}</span>
                            </Link>
                        )
                    })}
                </div>
            </div>

            {/* Bố cục 2 Cột Chuẩn tClinic */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* ======================================================== */}
                {/* CỘT TRÁI: BỘ LỌC & DANH SÁCH BỆNH NHÂN CHỜ KHÁM */}
                {/* ======================================================== */}
                <div className="lg:col-span-4 xl:col-span-3 space-y-3">
                    <div className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2 font-extrabold text-xs text-[#003553]">
                                <Funnel size={14} weight="bold" className="text-[#00B5F1]" />
                                <span>HÀNG ĐỢI KHÁM ({filteredRegistrations.length})</span>
                            </div>
                            <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                                Phòng mở
                            </span>
                        </div>

                        {/* Ô tìm kiếm */}
                        <div className="relative">
                            <MagnifyingGlass size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Mã KCB, Tên, SĐT..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="medpro-input pl-8 text-xs"
                            />
                        </div>

                        {/* Bộ lọc trạng thái */}
                        <div className="grid grid-cols-3 gap-1 text-[11px]">
                            {['ALL', 'Đang khám', 'Chờ khám'].map((st) => (
                                <button
                                    key={st}
                                    type="button"
                                    onClick={() => setStatusFilter(st)}
                                    className={`py-1 rounded-lg font-bold border transition text-center cursor-pointer ${
                                        statusFilter === st
                                            ? 'bg-[#00B5F1] text-white border-[#00B5F1]'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {st === 'ALL' ? 'Tất cả' : st}
                                </button>
                            ))}
                        </div>

                        {/* Danh sách bệnh nhân */}
                        <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-0.5">
                            {filteredRegistrations.map((item, idx) => {
                                const isSelected = item.id === currentExam?.id
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedRegId(item.id)}
                                        className={`p-2.5 rounded-xl border text-xs transition cursor-pointer ${
                                            isSelected
                                                ? 'bg-[#E8F4FD] border-[#00B5F1] shadow-2xs ring-1 ring-[#00B5F1]'
                                                : 'bg-white border-slate-200 hover:border-sky-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-mono font-bold text-[#00B5F1]">{item.maKCB}</span>
                                            <span
                                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                    item.trangThai === 'Đang khám'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {item.trangThai}
                                            </span>
                                        </div>
                                        <div className="font-bold text-[#12263F]">{item.hoTen}</div>
                                        <div className="text-[11px] text-slate-500 flex items-center justify-between mt-1">
                                            <span>{item.tuoi} • {item.gioiTinh}</span>
                                            <span className="font-mono">{item.dienThoai}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* ======================================================== */}
                {/* CỘT PHẢI: GIAO DIỆN KHÁM CHUYÊN KHOA CHI TIẾT */}
                {/* ======================================================== */}
                <div className="lg:col-span-8 xl:col-span-9 space-y-3.5">
                    {/* Thanh Tác Vụ Chuẩn tClinic: << >>, Ký số, Kết quả CLS, Đơn thuốc, Lưu */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs text-xs">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                                <button
                                    type="button"
                                    disabled={!hasPrev}
                                    onClick={() => hasPrev && setSelectedRegId(registrations[currentIndex - 1]?.id)}
                                    className="p-1 rounded hover:bg-white text-slate-600 disabled:opacity-30 cursor-pointer"
                                    title="Bệnh nhân trước"
                                >
                                    <CaretLeft size={14} weight="bold" />
                                </button>
                                <span className="px-2 font-mono font-bold text-[#003553]">
                                    {currentIndex + 1} / {registrations.length}
                                </span>
                                <button
                                    type="button"
                                    disabled={!hasNext}
                                    onClick={() => hasNext && setSelectedRegId(registrations[currentIndex + 1]?.id)}
                                    className="p-1 rounded hover:bg-white text-slate-600 disabled:opacity-30 cursor-pointer"
                                    title="Bệnh nhân kế tiếp"
                                >
                                    <CaretRight size={14} weight="bold" />
                                </button>
                            </div>
                            <span className="font-extrabold text-[#003553] text-sm uppercase">{currentMeta.title}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => AppToast.info('Ký số hồ sơ bệnh án chuyên khoa (INT-03 SmartCA)')}
                                className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                            >
                                <Signature size={14} weight="bold" />
                                <span>Ký số</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/admin/can-lam-sang')}
                                className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                            >
                                <FileText size={14} weight="duotone" className="text-[#00B5F1]" />
                                <span>Kết quả CLS</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/admin/kham-benh')}
                                className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                            >
                                <Pill size={14} weight="duotone" className="text-[#00B5F1]" />
                                <span>Đơn thuốc</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveSpecialtyData}
                                className="medpro-btn-primary !py-1.5 !px-4 text-xs font-bold"
                            >
                                <FloppyDisk size={14} weight="bold" />
                                <span>Lưu dữ liệu</span>
                            </button>
                        </div>
                    </div>

                    {/* Banner Thông Tin Bệnh Nhân Tóm Tắt Chuẩn tClinic */}
                    {currentExam && (
                        <div className="bg-[#E8F4FD] border border-[#BCE1F9] p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-[#003553]">
                            <div className="space-y-0.5">
                                <div className="font-extrabold text-sm text-[#003553]">
                                    {currentExam.hoTen}
                                    <span className="font-mono text-xs ml-2 text-slate-500 font-semibold">
                                        Mã KCB: {currentExam.maKCB}
                                    </span>
                                </div>
                                <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-2">
                                    <span>{currentExam.gioiTinh}</span>
                                    <span>•</span>
                                    <span>{currentExam.ngaySinh} ({currentExam.tuoi})</span>
                                    <span>•</span>
                                    <span>ĐT: <strong className="font-mono text-[#003553]">{currentExam.dienThoai}</strong></span>
                                    <span>•</span>
                                    <span>CCCD: <strong className="font-mono text-[#003553]">{currentExam.cccd || '001188012345'}</strong></span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-[11px] font-bold text-slate-500">Loại phiếu khám:</label>
                                <select
                                    value={examSheetType}
                                    onChange={(e) => setExamSheetType(e.target.value)}
                                    className="medpro-input !py-1 text-xs bg-white font-semibold"
                                >
                                    <option value="Phiếu khám chuyên khoa tiêu chuẩn">Phiếu khám chuyên khoa tiêu chuẩn</option>
                                    <option value="Khám sức khỏe định kỳ (TT 32/2023)">Khám sức khỏe định kỳ (TT 32/2023)</option>
                                    <option value="Hồ sơ khám chữa bệnh dịch vụ theo yêu cầu">Hồ sơ khám chữa bệnh dịch vụ theo yêu cầu</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Hàng Metadata Bác Sĩ & Ngày Nhập Liệu */}
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                            <label className="medpro-label">Bác sĩ khám</label>
                            <select
                                value={selectedDoctor}
                                onChange={(e) => setSelectedDoctor(e.target.value)}
                                className="medpro-input font-semibold"
                            >
                                {doctors.map((d) => (
                                    <option key={d.id} value={d.hoTen}>
                                        {d.hoTen} ({d.chucVu})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="medpro-label">Người nhập liệu</label>
                            <input
                                type="text"
                                value={recorderName}
                                onChange={(e) => setRecorderName(e.target.value)}
                                className="medpro-input"
                            />
                        </div>
                        <div>
                            <label className="medpro-label">Ngày nhập liệu</label>
                            <input
                                type="date"
                                value={recordDate}
                                onChange={(e) => setRecordDate(e.target.value)}
                                className="medpro-input font-bold text-[#003553]"
                            />
                        </div>
                    </div>

                    {/* ======================================================== */}
                    {/* NỘI DUNG FORM KHÁM ĐẶC THÙ CHO TỪNG CHUYÊN KHOA */}
                    {/* ======================================================== */}

                    {/* 1. KHOA NỘI */}
                    {deptKey === 'noi-khoa' && (
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-xs">
                            <h2 className="font-extrabold text-sm text-[#003553] uppercase border-b border-slate-100 pb-2">
                                NỘI DUNG KHÁM NỘI KHOA (TIM MẠCH - HÔ HẤP - TIÊU HÓA - THẦN KINH - CƠ XƯƠNG KHỚP)
                            </h2>

                            {/* a) Tuần hoàn */}
                            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <strong className="text-slate-800 text-xs">a) Tuần hoàn</strong>
                                        <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer font-bold ml-3">
                                            <input type="checkbox" defaultChecked className="accent-[#00B5F1] rounded" />
                                            <span>Bình thường</span>
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-slate-500 font-bold">Phân loại:</span>
                                        {['Loại I', 'Loại II', 'Loại III', 'Loại IV', 'Loại V'].map((p, idx) => (
                                            <label key={p} className="inline-flex items-center gap-1 cursor-pointer">
                                                <input type="radio" name="pl_tuanhoan" defaultChecked={idx === 0} className="accent-[#00B5F1]" />
                                                <span>{p}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                    <label className="inline-flex items-center gap-2 text-slate-600">
                                        <input type="checkbox" className="accent-[#00B5F1]" />
                                        <span>I97.8 - Rối loạn hệ tuần hoàn khác sau phẫu thuật</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-slate-600">
                                        <input type="checkbox" className="accent-[#00B5F1]" />
                                        <span>I97.9 - Rối loạn hệ tuần hoàn sau phẫu thuật không đặc hiệu</span>
                                    </label>
                                </div>
                                <textarea
                                    rows={2}
                                    value={specialtyData?.noiKhoa?.tuanHoan || ''}
                                    onChange={(e) => setSpecialtyData({ ...specialtyData, noiKhoa: { ...specialtyData.noiKhoa, tuanHoan: e.target.value } })}
                                    className="medpro-input"
                                    placeholder="Mô tả lâm sàng tuần hoàn: Tiếng T1, T2, âm thổi, mạch, huyết áp..."
                                />
                            </div>

                            {/* b) Hô hấp */}
                            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <strong className="text-slate-800 text-xs">b) Hô hấp</strong>
                                        <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer font-bold ml-3">
                                            <input type="checkbox" defaultChecked className="accent-[#00B5F1] rounded" />
                                            <span>Bình thường</span>
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-slate-500 font-bold">Phân loại:</span>
                                        {['Loại I', 'Loại II', 'Loại III', 'Loại IV', 'Loại V'].map((p, idx) => (
                                            <label key={p} className="inline-flex items-center gap-1 cursor-pointer">
                                                <input type="radio" name="pl_hohap" defaultChecked={idx === 0} className="accent-[#00B5F1]" />
                                                <span>{p}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                    <label className="inline-flex items-center gap-2 text-slate-600">
                                        <input type="checkbox" className="accent-[#00B5F1]" />
                                        <span>R07 - Đau họng và ngực</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-slate-600">
                                        <input type="checkbox" className="accent-[#00B5F1]" />
                                        <span>J06 - Nhiễm khuẩn hô hấp trên cấp</span>
                                    </label>
                                </div>
                                <textarea
                                    rows={2}
                                    value={specialtyData?.noiKhoa?.hoHap || ''}
                                    onChange={(e) => setSpecialtyData({ ...specialtyData, noiKhoa: { ...specialtyData.noiKhoa, hoHap: e.target.value } })}
                                    className="medpro-input"
                                    placeholder="Lồng ngực cân đối, rì rào phế nang 2 phế trường..."
                                />
                            </div>

                            {/* c) Tiêu hóa */}
                            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <strong className="text-slate-800 text-xs">c) Tiêu hóa</strong>
                                        <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer font-bold ml-3">
                                            <input type="checkbox" defaultChecked className="accent-[#00B5F1] rounded" />
                                            <span>Bình thường</span>
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-slate-500 font-bold">Phân loại:</span>
                                        {['Loại I', 'Loại II', 'Loại III', 'Loại IV', 'Loại V'].map((p, idx) => (
                                            <label key={p} className="inline-flex items-center gap-1 cursor-pointer">
                                                <input type="radio" name="pl_tieuhoa" defaultChecked={idx === 0} className="accent-[#00B5F1]" />
                                                <span>{p}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <textarea
                                    rows={2}
                                    value={specialtyData?.noiKhoa?.tieuHoa || ''}
                                    onChange={(e) => setSpecialtyData({ ...specialtyData, noiKhoa: { ...specialtyData.noiKhoa, tieuHoa: e.target.value } })}
                                    className="medpro-input"
                                    placeholder="Bụng mềm, gan lách không to, không sờ thấy u bướu..."
                                />
                            </div>
                        </div>
                    )}

                    {/* 2. KHOA MẮT (NHÃN KHOA) */}
                    {deptKey === 'mat' && (
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-xs">
                            <h2 className="font-extrabold text-sm text-[#003553] uppercase border-b border-slate-100 pb-2">
                                BỆNH ÁN NHÃN KHOA (ĐO THỊ LỰC - NHÃN ÁP - BÁN PHẦN TRƯỚC - ĐÁY MẮT)
                            </h2>

                            {/* Bảng thị lực & nhãn áp */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 space-y-2.5">
                                    <div className="font-bold text-sky-900 uppercase">Mắt Phải (OD)</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="medpro-label">Thị lực không kính:</label>
                                            <select
                                                value={specialtyData?.mat?.thiLucKhongKinhP || '10/10'}
                                                onChange={(e) => setSpecialtyData({ ...specialtyData, mat: { ...specialtyData.mat, thiLucKhongKinhP: e.target.value } })}
                                                className="medpro-input font-mono font-bold"
                                            >
                                                {['10/10', '9/10', '8/10', '7/10', '6/10', '5/10', '4/10', '3/10', '2/10', '1/10', 'ĐNT'].map((v) => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="medpro-label">Thị lực có kính:</label>
                                            <select
                                                value={specialtyData?.mat?.thiLucCoKinhP || '10/10'}
                                                onChange={(e) => setSpecialtyData({ ...specialtyData, mat: { ...specialtyData.mat, thiLucCoKinhP: e.target.value } })}
                                                className="medpro-input font-mono font-bold"
                                            >
                                                {['10/10', '9/10', '8/10', '7/10', '6/10', '5/10', '4/10', '3/10', '2/10', '1/10'].map((v) => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="medpro-label">Nhãn áp Mắt Phải (mmHg):</label>
                                        <input
                                            type="text"
                                            value={specialtyData?.mat?.nhanApP || '16'}
                                            onChange={(e) => setSpecialtyData({ ...specialtyData, mat: { ...specialtyData.mat, nhanApP: e.target.value } })}
                                            className="medpro-input font-mono font-bold w-28"
                                        />
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 space-y-2.5">
                                    <div className="font-bold text-sky-900 uppercase">Mắt Trái (OS)</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="medpro-label">Thị lực không kính:</label>
                                            <select
                                                value={specialtyData?.mat?.thiLucKhongKinhT || '10/10'}
                                                onChange={(e) => setSpecialtyData({ ...specialtyData, mat: { ...specialtyData.mat, thiLucKhongKinhT: e.target.value } })}
                                                className="medpro-input font-mono font-bold"
                                            >
                                                {['10/10', '9/10', '8/10', '7/10', '6/10', '5/10', '4/10', '3/10', '2/10', '1/10', 'ĐNT'].map((v) => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="medpro-label">Thị lực có kính:</label>
                                            <select
                                                value={specialtyData?.mat?.thiLucCoKinhT || '10/10'}
                                                onChange={(e) => setSpecialtyData({ ...specialtyData, mat: { ...specialtyData.mat, thiLucCoKinhT: e.target.value } })}
                                                className="medpro-input font-mono font-bold"
                                            >
                                                {['10/10', '9/10', '8/10', '7/10', '6/10', '5/10', '4/10', '3/10', '2/10', '1/10'].map((v) => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="medpro-label">Nhãn áp Mắt Trái (mmHg):</label>
                                        <input
                                            type="text"
                                            value={specialtyData?.mat?.nhanApT || '16'}
                                            onChange={(e) => setSpecialtyData({ ...specialtyData, mat: { ...specialtyData.mat, nhanApT: e.target.value } })}
                                            className="medpro-input font-mono font-bold w-28"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Checkbox bệnh lý */}
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                <div className="flex items-center gap-3">
                                    <strong className="text-slate-800">Các bệnh về mắt (nếu có):</strong>
                                    <label className="inline-flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                                        <input type="checkbox" defaultChecked className="accent-[#00B5F1]" />
                                        <span>Bình thường</span>
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                    <label className="inline-flex items-center gap-2 text-slate-600">
                                        <input type="checkbox" className="accent-[#00B5F1]" />
                                        <span>H52.0 - Viễn thị</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-slate-600">
                                        <input type="checkbox" className="accent-[#00B5F1]" />
                                        <span>H52.1 - Cận thị</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-slate-600">
                                        <input type="checkbox" className="accent-[#00B5F1]" />
                                        <span>H52.2 - Loạn thị</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-slate-600">
                                        <input type="checkbox" className="accent-[#00B5F1]" />
                                        <span>H44.2 - Cận thị thoái hóa</span>
                                    </label>
                                </div>
                            </div>

                            {/* Đáy mắt & Bán phần trước */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="medpro-label">Bán phần trước (Kết mạc, Giác mạc, Tiền phòng)</label>
                                    <input
                                        type="text"
                                        value={specialtyData?.mat?.giacMac || 'Trong suốt, biểu mô nguyên vẹn, tiền phòng sâu sạch'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, mat: { ...specialtyData.mat, giacMac: e.target.value } })}
                                        className="medpro-input"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Đáy mắt (Gai thị & Võng mạc)</label>
                                    <input
                                        type="text"
                                        value={specialtyData?.mat?.dayMat || 'Gai thị hồng, bờ rõ, tỷ lệ C/D 0.3'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, mat: { ...specialtyData.mat, dayMat: e.target.value } })}
                                        className="medpro-input"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. KHOA TAI MŨI HỌNG */}
                    {deptKey === 'tai-mui-hong' && (
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-xs">
                            <h2 className="font-extrabold text-sm text-[#003553] uppercase border-b border-slate-100 pb-2">
                                BỆNH ÁN TAI MŨI HỌNG (NỘI SOI MÀNG NHĨ - HỐC MŨI - AMIDAN - THANH QUẢN)
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="medpro-label">Tai Phải (Ống tai & Màng nhĩ P)</label>
                                    <textarea
                                        rows={2}
                                        value={specialtyData?.tmh?.taiPhai || 'Màng nhĩ sáng bóng, nón sáng rõ'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, tmh: { ...specialtyData.tmh, taiPhai: e.target.value } })}
                                        className="medpro-input"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Tai Trái (Ống tai & Màng nhĩ T)</label>
                                    <textarea
                                        rows={2}
                                        value={specialtyData?.tmh?.taiTrai || 'Màng nhĩ sáng bóng, nón sáng rõ, không thủng'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, tmh: { ...specialtyData.tmh, taiTrai: e.target.value } })}
                                        className="medpro-input"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Hốc Mũi & Cuốn mũi, Vách ngăn</label>
                                    <textarea
                                        rows={2}
                                        value={specialtyData?.tmh?.mui || 'Hốc mũi thoáng, niêm mạc hồng, cuốn mũi dưới không phì đại'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, tmh: { ...specialtyData.tmh, mui: e.target.value } })}
                                        className="medpro-input"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Họng, Amidan (Độ I - IV) & Dây thanh âm</label>
                                    <textarea
                                        rows={2}
                                        value={specialtyData?.tmh?.amidan || 'Amidan Độ 0, không hốc mủ, dây thanh âm di động tốt'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, tmh: { ...specialtyData.tmh, amidan: e.target.value } })}
                                        className="medpro-input"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. KHOA RĂNG HÀM MẶT & SƠ ĐỒ 32 RĂNG NHA KHOA */}
                    {deptKey === 'rang-ham-mat' && (
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                <h2 className="font-extrabold text-sm text-[#003553] uppercase">
                                    SƠ ĐỒ 32 RĂNG NHA KHOA TƯƠNG TÁC (ODONTOGRAM) & BỆNH HỌC MIỆNG
                                </h2>
                                <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-bold">
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">BT: {toothCounts.BT}</span>
                                    <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">Sâu: {toothCounts.S}</span>
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">Mất: {toothCounts.M}</span>
                                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">Trám: {toothCounts.T}</span>
                                    <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-900 border border-purple-200">Sứ: {toothCounts.B}</span>
                                    <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-900 border border-orange-200">Khôn: {toothCounts.K}</span>
                                </div>
                            </div>

                            {/* Bảng Nút Gán Trạng Thái Răng */}
                            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F8FBFE] p-3 rounded-xl border border-slate-200">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-600 font-bold">Đang chọn:</span>
                                    <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-mono font-bold text-xs">
                                        Răng số: {activeTooth}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {[
                                        { code: 'BT', label: 'Bình thường', cls: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-300' },
                                        { code: 'S', label: 'Sâu răng [S]', cls: 'bg-rose-50 text-rose-800 hover:bg-rose-100 border-rose-300' },
                                        { code: 'M', label: 'Mất răng [M]', cls: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-400' },
                                        { code: 'T', label: 'Trám răng [T]', cls: 'bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-300' },
                                        { code: 'B', label: 'Bọc sứ [B]', cls: 'bg-purple-50 text-purple-900 hover:bg-purple-100 border-purple-300' },
                                        { code: 'K', label: 'Khôn lệch [K]', cls: 'bg-orange-50 text-orange-900 hover:bg-orange-100 border-orange-300' },
                                    ].map((btn) => (
                                        <button
                                            key={btn.code}
                                            type="button"
                                            onClick={() => handleUpdateToothStatus(btn.code)}
                                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition cursor-pointer ${btn.cls}`}
                                        >
                                            {btn.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Bản Đồ 32 Răng */}
                            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-4">
                                <div>
                                    <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-1 text-center">
                                        &mdash; HÀM TRÊN (CUNG 1 & CUNG 2) &mdash;
                                    </div>
                                    <div className="flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto py-1">
                                        <div className="flex items-center gap-1">
                                            {['18', '17', '16', '15', '14', '13', '12', '11'].map((tooth) => {
                                                const st = specialtyData?.rhm?.teethStatus?.[tooth] || 'BT'
                                                const isSelected = activeTooth === tooth
                                                return (
                                                    <div
                                                        key={tooth}
                                                        onClick={() => setActiveTooth(tooth)}
                                                        className={`w-9 h-11 rounded-lg border flex flex-col items-center justify-between p-1 transition cursor-pointer select-none ${
                                                            isSelected ? 'ring-2 ring-[#00B5F1] border-[#00B5F1] shadow-md scale-105' : 'border-slate-200 hover:border-indigo-300'
                                                        } ${
                                                            st === 'S' ? 'bg-rose-50 text-rose-800' :
                                                            st === 'M' ? 'bg-slate-200 text-slate-500 opacity-60' :
                                                            st === 'T' ? 'bg-amber-50 text-amber-900' :
                                                            st === 'B' ? 'bg-purple-50 text-purple-900' :
                                                            st === 'K' ? 'bg-orange-50 text-orange-900' : 'bg-white text-slate-700'
                                                        }`}
                                                    >
                                                        <span className="font-mono font-bold text-[10px]">{tooth}</span>
                                                        <span className="font-black text-[9.5px] uppercase font-mono">{st}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <div className="w-[1.5px] h-9 bg-indigo-200 mx-1 shrink-0" />
                                        <div className="flex items-center gap-1">
                                            {['21', '22', '23', '24', '25', '26', '27', '28'].map((tooth) => {
                                                const st = specialtyData?.rhm?.teethStatus?.[tooth] || 'BT'
                                                const isSelected = activeTooth === tooth
                                                return (
                                                    <div
                                                        key={tooth}
                                                        onClick={() => setActiveTooth(tooth)}
                                                        className={`w-9 h-11 rounded-lg border flex flex-col items-center justify-between p-1 transition cursor-pointer select-none ${
                                                            isSelected ? 'ring-2 ring-[#00B5F1] border-[#00B5F1] shadow-md scale-105' : 'border-slate-200 hover:border-indigo-300'
                                                        } ${
                                                            st === 'S' ? 'bg-rose-50 text-rose-800' :
                                                            st === 'M' ? 'bg-slate-200 text-slate-500 opacity-60' :
                                                            st === 'T' ? 'bg-amber-50 text-amber-900' :
                                                            st === 'B' ? 'bg-purple-50 text-purple-900' :
                                                            st === 'K' ? 'bg-orange-50 text-orange-900' : 'bg-white text-slate-700'
                                                        }`}
                                                    >
                                                        <span className="font-mono font-bold text-[10px]">{tooth}</span>
                                                        <span className="font-black text-[9.5px] uppercase font-mono">{st}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="border-b border-dashed border-slate-200" />

                                <div>
                                    <div className="flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto py-1">
                                        <div className="flex items-center gap-1">
                                            {['48', '47', '46', '45', '44', '43', '42', '41'].map((tooth) => {
                                                const st = specialtyData?.rhm?.teethStatus?.[tooth] || 'BT'
                                                const isSelected = activeTooth === tooth
                                                return (
                                                    <div
                                                        key={tooth}
                                                        onClick={() => setActiveTooth(tooth)}
                                                        className={`w-9 h-11 rounded-lg border flex flex-col items-center justify-between p-1 transition cursor-pointer select-none ${
                                                            isSelected ? 'ring-2 ring-[#00B5F1] border-[#00B5F1] shadow-md scale-105' : 'border-slate-200 hover:border-indigo-300'
                                                        } ${
                                                            st === 'S' ? 'bg-rose-50 text-rose-800' :
                                                            st === 'M' ? 'bg-slate-200 text-slate-500 opacity-60' :
                                                            st === 'T' ? 'bg-amber-50 text-amber-900' :
                                                            st === 'B' ? 'bg-purple-50 text-purple-900' :
                                                            st === 'K' ? 'bg-orange-50 text-orange-900' : 'bg-white text-slate-700'
                                                        }`}
                                                    >
                                                        <span className="font-mono font-bold text-[10px]">{tooth}</span>
                                                        <span className="font-black text-[9.5px] uppercase font-mono">{st}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <div className="w-[1.5px] h-9 bg-indigo-200 mx-1 shrink-0" />
                                        <div className="flex items-center gap-1">
                                            {['31', '32', '33', '34', '35', '36', '37', '38'].map((tooth) => {
                                                const st = specialtyData?.rhm?.teethStatus?.[tooth] || 'BT'
                                                const isSelected = activeTooth === tooth
                                                return (
                                                    <div
                                                        key={tooth}
                                                        onClick={() => setActiveTooth(tooth)}
                                                        className={`w-9 h-11 rounded-lg border flex flex-col items-center justify-between p-1 transition cursor-pointer select-none ${
                                                            isSelected ? 'ring-2 ring-[#00B5F1] border-[#00B5F1] shadow-md scale-105' : 'border-slate-200 hover:border-indigo-300'
                                                        } ${
                                                            st === 'S' ? 'bg-rose-50 text-rose-800' :
                                                            st === 'M' ? 'bg-slate-200 text-slate-500 opacity-60' :
                                                            st === 'T' ? 'bg-amber-50 text-amber-900' :
                                                            st === 'B' ? 'bg-purple-50 text-purple-900' :
                                                            st === 'K' ? 'bg-orange-50 text-orange-900' : 'bg-white text-slate-700'
                                                        }`}
                                                    >
                                                        <span className="font-mono font-bold text-[10px]">{tooth}</span>
                                                        <span className="font-black text-[9.5px] uppercase font-mono">{st}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mt-1 text-center">
                                        &mdash; HÀM DƯỚI (CUNG 4 & CUNG 3) &mdash;
                                    </div>
                                </div>
                            </div>

                            {/* Khám nha chu & vôi răng */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="medpro-label">Tình trạng Nướu / Lợi & BOP</label>
                                    <input
                                        type="text"
                                        value={specialtyData?.rhm?.nuouLoi || 'Nướu hồng hào, săn chắc'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, rhm: { ...specialtyData.rhm, nuouLoi: e.target.value } })}
                                        className="medpro-input"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Mức độ Cao răng</label>
                                    <select
                                        value={specialtyData?.rhm?.caoRang || 'Độ 1 (Có ít mảng bám vôi răng mặt trong)'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, rhm: { ...specialtyData.rhm, caoRang: e.target.value } })}
                                        className="medpro-input"
                                    >
                                        <option value="Độ 0 (Không có cao răng)">Độ 0 (Không có cao răng)</option>
                                        <option value="Độ 1 (Có ít mảng bám vôi răng mặt trong)">Độ 1 (Có ít mảng bám vôi răng mặt trong)</option>
                                        <option value="Độ 2 (Cao răng che phủ 1/3 - 2/3 thân răng)">Độ 2 (Cao răng che phủ 1/3 - 2/3 thân răng)</option>
                                        <option value="Độ 3 (Cao răng nặng bám sâu dưới nướu)">Độ 3 (Cao răng nặng bám sâu dưới nướu)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="medpro-label">Khớp cắn & Khớp thái dương hàm</label>
                                    <input
                                        type="text"
                                        value={specialtyData?.rhm?.khopThaiDuongHam || 'Khớp cắn Loại I, há miệng 4cm, không lục cục'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, rhm: { ...specialtyData.rhm, khopThaiDuongHam: e.target.value } })}
                                        className="medpro-input"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 5. KHOA NGOẠI */}
                    {deptKey === 'ngoai-khoa' && (
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-xs">
                            <h2 className="font-extrabold text-sm text-[#003553] uppercase border-b border-slate-100 pb-2">
                                BỆNH ÁN NGOẠI KHOA (VẾT MỔ - KHỐI U - THOÁT VỊ - TIỂU PHẪU)
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="medpro-label">Khám ngoại tổng quát & Tư thế</label>
                                    <input
                                        type="text"
                                        value={specialtyData?.ngoaiKhoa?.khamNgoaiTongQuat || 'Thể trạng trung bình, niêm mạc hồng'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, ngoaiKhoa: { ...specialtyData.ngoaiKhoa, khamNgoaiTongQuat: e.target.value } })}
                                        className="medpro-input"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Vết mổ / Vết thương phần mềm</label>
                                    <input
                                        type="text"
                                        value={specialtyData?.ngoaiKhoa?.vetMoVetThuong || 'Không có vết thương hở, sẹo mổ cũ lành tốt'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, ngoaiKhoa: { ...specialtyData.ngoaiKhoa, vetMoVetThuong: e.target.value } })}
                                        className="medpro-input"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">U bướu / Hạch ngoại vi</label>
                                    <input
                                        type="text"
                                        value={specialtyData?.ngoaiKhoa?.uBuouHach || 'Không sờ thấy hạch ngoại vi vùng cổ, nách, bẹn'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, ngoaiKhoa: { ...specialtyData.ngoaiKhoa, uBuouHach: e.target.value } })}
                                        className="medpro-input"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Thoát vị thành bụng & Bẹn</label>
                                    <input
                                        type="text"
                                        value={specialtyData?.ngoaiKhoa?.thoatVi || 'Thành bụng chắc, lỗ bẹn nông 2 bên không phồng'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, ngoaiKhoa: { ...specialtyData.ngoaiKhoa, thoatVi: e.target.value } })}
                                        className="medpro-input"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="medpro-label">Đề nghị chỉ định Tiểu phẫu / Thủ thuật (PT-TT)</label>
                                    <input
                                        type="text"
                                        value={specialtyData?.ngoaiKhoa?.tieuPhauDeNghi || 'Chưa có chỉ định can thiệp ngoại khoa'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, ngoaiKhoa: { ...specialtyData.ngoaiKhoa, tieuPhauDeNghi: e.target.value } })}
                                        className="medpro-input font-bold text-[#003553]"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
