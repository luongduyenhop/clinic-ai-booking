import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import {
    Eye,
    Ear,
    Tooth,
    FirstAidKit,
    Heartbeat,
    FloppyDisk,
    Signature,
    FileText,
    Pill,
    ArrowLeft,
    CaretLeft,
    CaretRight,
    MagnifyingGlass,
    Funnel,
} from '@phosphor-icons/react'
import { AppToast } from '../../components/common/AppNotification'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { clinicalService } from '../../services/doctor/ClinicalService'
import { findSpecialtyExam } from '../../utils/constants/clinical'

const SPECIALTY_META = {
    'noi-khoa': {
        title: 'KHÁM NỘI KHOA',
        deptCode: 'NOI',
        icon: Heartbeat,
        color: 'text-clinic-danger',
        bg: 'bg-clinic-danger-bg',
        borderColor: 'border-clinic-danger-border',
        desc: 'Khám tuần hoàn, hô hấp, tiêu hóa, thần kinh, cơ xương khớp theo chuẩn Bộ Y tế',
    },
    'ngoai-khoa': {
        title: 'KHÁM NGOẠI KHOA',
        deptCode: 'NGOAI',
        icon: FirstAidKit,
        color: 'text-clinic-success',
        bg: 'bg-clinic-success-bg',
        borderColor: 'border-clinic-success-border',
        desc: 'Khám ngoại tổng quát, vết mổ, khối u, thoát vị & chỉ định tiểu phẫu / thủ thuật',
    },
    mat: {
        title: 'KHÁM MẮT (NHÃN KHOA)',
        deptCode: 'MAT',
        icon: Eye,
        color: 'text-clinic-cta',
        bg: 'bg-clinic-surface-alt',
        borderColor: 'border-clinic-info-border',
        desc: 'Đo thị lực Snellen OD/OS, nhãn áp kế, khám bán phần trước và đáy mắt',
    },
    'tai-mui-hong': {
        title: 'KHÁM TAI MŨI HỌNG',
        deptCode: 'TMH',
        icon: Ear,
        color: 'text-clinic-warning',
        bg: 'bg-clinic-warning-bg',
        borderColor: 'border-clinic-warning-border',
        desc: 'Nội soi ống tai, màng nhĩ, hốc mũi, cuốn mũi, amidan phân độ & dây thanh âm',
    },
    'rang-ham-mat': {
        title: 'KHÁM RĂNG HÀM MẶT',
        deptCode: 'RHM',
        icon: Tooth,
        color: 'text-clinic-navy',
        bg: 'bg-clinic-bg-muted',
        borderColor: 'border-clinic-border-strong',
        desc: 'Sơ đồ 32 răng nha khoa Odontogram, nha chu, nướu lợi, vôi răng & khớp thái dương hàm',
    },
}

export default function SpecialtyExamPage() {
    const { deptKey: urlDeptKey } = useParams()
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { clinicData } = useSelector((state) => state.app.admin)
    const { currentUser, role: authRole } = useSelector((state) => state.app.auth || {})

    const isDoctor = ['BAC_SI', 'DOCTOR', 'ROLE_DOCTOR'].includes(String(authRole || currentUser?.role || '').toUpperCase())
    const doctorDeptKey = useMemo(() => {
        const matched = findSpecialtyExam(
            currentUser?.chuyen_khoa_ma ||
            currentUser?.chuyen_khoa ||
            currentUser?.specialty ||
            currentUser?.department ||
            'NOI'
        )
        return matched?.key || 'noi-khoa'
    }, [currentUser])

    const deptKey = isDoctor ? doctorDeptKey : (urlDeptKey || 'noi-khoa')

    const registrations = clinicData?.registrations || []
    const doctors = clinicData?.staffList?.filter((s) => s.vaiTro?.includes('Bác sĩ')) || []

    const currentMeta = SPECIALTY_META[deptKey] || SPECIALTY_META['noi-khoa']
    const DeptIcon = currentMeta.icon

    const [selectedRegId, setSelectedRegId] = useState(registrations[0]?.id || '')
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [examSheetType, setExamSheetType] = useState('Phiếu khám chuyên khoa tiêu chuẩn')
    const [selectedDoctor, setSelectedDoctor] = useState(currentUser?.hoTen || currentUser?.name || doctors[0]?.hoTen || 'PGS.TS Phạm Đức Minh')
    const [recorderName, setRecorderName] = useState('Điều dưỡng Vũ Thị Mỹ Dung')
    const [recordDate, setRecordDate] = useState('2026-10-12')

    const filteredRegistrations = useMemo(() => {
        return registrations.filter((r) => {
            const matchSearch =
                !searchQuery ||
                r.hoTen?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.maKCB?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.dienThoai?.includes(searchQuery)
            const matchStatus = statusFilter === 'ALL' || r.trangThai === statusFilter
            const regSpecialty = findSpecialtyExam(r.chuyenKhoa || r.khoa || r.phongKham || 'NOI')?.key || 'noi-khoa'
            const matchDept = !r.chuyenKhoa && !r.khoa ? true : regSpecialty === deptKey
            return matchSearch && matchStatus && matchDept
        })
    }, [registrations, searchQuery, statusFilter, deptKey])

    const currentExam = useMemo(() => {
        return filteredRegistrations.find((r) => r.id === selectedRegId) || filteredRegistrations[0] || registrations[0] || null
    }, [filteredRegistrations, registrations, selectedRegId])

    const currentIndex = useMemo(() => {
        return filteredRegistrations.findIndex((r) => r.id === currentExam?.id)
    }, [filteredRegistrations, currentExam?.id])
    const hasPrev = currentIndex > 0
    const hasNext = currentIndex >= 0 && currentIndex < filteredRegistrations.length - 1

    const [specialtyData, setSpecialtyData] = useState(() => currentExam?.specialtyExams || {})
    const [activeTooth, setActiveTooth] = useState('16')

    useEffect(() => {
        if (currentExam) {
            setSpecialtyData(currentExam.specialtyExams || {})
        }
    }, [currentExam?.id])

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
        AppToast.success(`Lưu dữ liệu ${currentMeta.title} (CSDL 2 tầng) thành công`)
    }

    return (
        <div className="space-y-4">
            <div className="medpro-card p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(isDoctor ? '/staff/exam-workstation' : '/admin/kham-benh')}
                        className="p-2 rounded-[6px] bg-clinic-bg-muted border border-clinic-border hover:border-clinic-cta text-clinic-navy transition-colors cursor-pointer"
                        title="Quay lại Bàn khám chung"
                    >
                        <ArrowLeft size={16} weight="bold" />
                    </button>
                    <div className={`w-10 h-10 rounded-[6px] border ${currentMeta.borderColor} ${currentMeta.bg} ${currentMeta.color} flex items-center justify-center shrink-0`}>
                        <DeptIcon size={22} weight="duotone" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="font-display text-base font-extrabold text-clinic-navy uppercase">{currentMeta.title}</h1>
                            <span className="medpro-badge-info text-[11px] font-bold">Chuẩn Bộ Y tế</span>
                        </div>
                        <p className="text-xs text-clinic-text-secondary">{currentMeta.desc}</p>
                    </div>
                </div>

                {isDoctor ? (
                    <div className="flex items-center gap-2 bg-clinic-surface-tint border border-clinic-info-border px-3.5 py-2 rounded-[6px] text-xs font-bold text-clinic-navy">
                        <DeptIcon size={16} weight="duotone" className="text-clinic-cta" />
                        <span>Chuyên khoa phụ trách: {currentMeta.title.replace('KHÁM ', 'KHOA ')}</span>
                    </div>
                ) : (
                    <div className="inline-flex flex-wrap items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border text-xs font-bold">
                        {Object.entries(SPECIALTY_META).map(([key, meta]) => {
                            const Icon = meta.icon
                            const isActive = key === deptKey
                            return (
                                <Link
                                    key={key}
                                    to={`/admin/kham-chuyen-khoa/${key}`}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] ${
                                        isActive
                                            ? 'bg-clinic-navy text-clinic-surface'
                                            : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                                    }`}
                                >
                                    <Icon size={14} weight={isActive ? 'fill' : 'regular'} />
                                    <span>{meta.title.replace('KHÁM ', '')}</span>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-4 xl:col-span-3 space-y-3">
                    <div className="medpro-card p-3.5 space-y-3">
                        <div className="flex items-center justify-between border-b border-clinic-border pb-2 tabular-nums">
                            <div className="flex items-center gap-2 font-extrabold text-xs text-clinic-navy">
                                <Funnel size={14} weight="bold" className="text-clinic-cta" />
                                <span>HÀNG ĐỢI KHÁM ({filteredRegistrations.length})</span>
                            </div>
                            <span className="medpro-badge-success !text-[10px]">
                                Phòng mở
                            </span>
                        </div>

                        <div className="relative">
                            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Mã KCB, Tên, SĐT..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="medpro-input !py-1.5 h-9 !pl-8 text-xs"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border text-[11px]">
                            {['ALL', 'Đang khám', 'Chờ khám'].map((st) => (
                                <button
                                    key={st}
                                    type="button"
                                    onClick={() => setStatusFilter(st)}
                                    className={`py-1 rounded-[6px] font-bold transition-colors duration-75 text-center cursor-pointer ${
                                        statusFilter === st
                                            ? 'bg-clinic-navy text-clinic-surface'
                                            : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                                    }`}
                                >
                                    {st === 'ALL' ? 'Tất cả' : st}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-0.5 tabular-nums">
                            {filteredRegistrations.map((item) => {
                                const isSelected = item.id === currentExam?.id
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedRegId(item.id)}
                                        className={`p-2.5 rounded-[6px] border text-xs transition-colors cursor-pointer ${
                                            isSelected
                                                ? 'bg-clinic-surface-alt border-clinic-cta'
                                                : 'bg-clinic-surface border-clinic-border hover:border-clinic-border-strong'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-mono font-bold text-clinic-cta">{item.maKCB}</span>
                                            <span
                                                className={
                                                    item.trangThai === 'Đang khám'
                                                        ? 'medpro-badge-warning !text-[10px]'
                                                        : 'medpro-badge-info !text-[10px]'
                                                }
                                            >
                                                {item.trangThai}
                                            </span>
                                        </div>
                                        <div className="font-bold text-clinic-navy">{item.hoTen}</div>
                                        <div className="text-[11px] text-clinic-text-secondary flex items-center justify-between mt-1">
                                            <span>{item.tuoi} • {item.gioiTinh}</span>
                                            <span className="font-mono">{item.dienThoai}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-8 xl:col-span-9 space-y-3.5">
                    <div className="medpro-card p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border tabular-nums">
                                <button
                                    type="button"
                                    disabled={!hasPrev}
                                    onClick={() => hasPrev && setSelectedRegId(filteredRegistrations[currentIndex - 1]?.id)}
                                    className="p-1 rounded-[4px] hover:bg-clinic-surface text-clinic-text-secondary disabled:opacity-30 cursor-pointer"
                                    title="Bệnh nhân trước"
                                >
                                    <CaretLeft size={14} weight="bold" />
                                </button>
                                <span className="px-2 font-mono font-bold text-clinic-navy">
                                    {filteredRegistrations.length > 0 ? currentIndex + 1 : 0} / {filteredRegistrations.length}
                                </span>
                                <button
                                    type="button"
                                    disabled={!hasNext}
                                    onClick={() => hasNext && setSelectedRegId(filteredRegistrations[currentIndex + 1]?.id)}
                                    className="p-1 rounded-[4px] hover:bg-clinic-surface text-clinic-text-secondary disabled:opacity-30 cursor-pointer"
                                    title="Bệnh nhân kế tiếp"
                                >
                                    <CaretRight size={14} weight="bold" />
                                </button>
                            </div>
                            <span className="font-extrabold text-clinic-navy text-sm uppercase">{currentMeta.title}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => AppToast.info('Ký số hồ sơ bệnh án chuyên khoa thành công')}
                                className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                            >
                                <Signature size={14} weight="bold" />
                                <span>Ký số</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate(isDoctor ? '/staff/exam-workstation' : '/admin/can-lam-sang')}
                                className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                            >
                                <FileText size={14} weight="duotone" className="text-clinic-cta" />
                                <span>Kết quả CLS</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate(isDoctor ? '/staff/exam-workstation' : '/admin/kham-benh')}
                                className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                            >
                                <Pill size={14} weight="duotone" className="text-clinic-cta" />
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

                    {currentExam && (
                        <div className="bg-clinic-surface-alt border border-clinic-info-border p-3 rounded-[6px] flex flex-wrap items-center justify-between gap-3 text-xs text-clinic-navy tabular-nums">
                            <div className="space-y-0.5">
                                <div className="font-extrabold text-sm text-clinic-navy">
                                    {currentExam.hoTen}
                                    <span className="font-mono text-xs ml-2 text-clinic-text-secondary font-semibold">
                                        Mã KCB: {currentExam.maKCB}
                                    </span>
                                </div>
                                <div className="text-[11px] text-clinic-text-secondary flex flex-wrap items-center gap-2">
                                    <span>{currentExam.gioiTinh}</span>
                                    <span>•</span>
                                    <span>{currentExam.ngaySinh} ({currentExam.tuoi})</span>
                                    <span>•</span>
                                    <span>ĐT: <strong className="font-mono text-clinic-navy">{currentExam.dienThoai}</strong></span>
                                    <span>•</span>
                                    <span>CCCD: <strong className="font-mono text-clinic-navy">{currentExam.cccd || '001188012345'}</strong></span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-[11px] font-bold text-clinic-text-secondary whitespace-nowrap">Loại phiếu khám:</label>
                                <select
                                    value={examSheetType}
                                    onChange={(e) => setExamSheetType(e.target.value)}
                                    className="medpro-input !py-1.5 h-9 text-xs bg-clinic-surface font-semibold truncate"
                                >
                                    <option value="Phiếu khám chuyên khoa tiêu chuẩn">Phiếu khám chuyên khoa tiêu chuẩn</option>
                                    <option value="Khám sức khỏe định kỳ (TT 32/2023)">Khám sức khỏe định kỳ (TT 32/2023)</option>
                                    <option value="Hồ sơ khám chữa bệnh dịch vụ theo yêu cầu">Hồ sơ khám chữa bệnh dịch vụ theo yêu cầu</option>
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="medpro-card p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                            <label className="medpro-label">Bác sĩ khám</label>
                            <select
                                value={selectedDoctor || ''}
                                onChange={(e) => setSelectedDoctor(e.target.value)}
                                className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
                            >
                                {!doctors.some((d) => d.hoTen === selectedDoctor) && selectedDoctor && (
                                    <option value={selectedDoctor}>{selectedDoctor}</option>
                                )}
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
                                className="medpro-input !py-1.5 h-9 text-xs"
                            />
                        </div>
                        <div>
                            <label className="medpro-label">Ngày nhập liệu</label>
                            <input
                                type="date"
                                value={recordDate}
                                onChange={(e) => setRecordDate(e.target.value)}
                                className="medpro-input !py-1.5 h-9 text-xs font-bold text-clinic-navy tabular-nums"
                            />
                        </div>
                    </div>

                    {deptKey === 'noi-khoa' && (
                        <div className="medpro-card p-4 space-y-4 text-xs">
                            <h2 className="font-extrabold text-sm text-clinic-navy uppercase border-b border-clinic-border pb-2">
                                NỘI DUNG KHÁM NỘI KHOA (TIM MẠCH - HÔ HẤP - TIÊU HÓA - THẦN KINH - CƠ XƯƠNG KHỚP)
                            </h2>

                            <div className="p-3.5 rounded-[6px] bg-clinic-bg border border-clinic-border space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <strong className="text-clinic-navy text-xs">a) Tuần hoàn</strong>
                                        <label className="inline-flex items-center gap-1.5 text-clinic-text cursor-pointer font-bold ml-3">
                                            <input type="checkbox" defaultChecked className="accent-clinic-cta rounded" />
                                            <span>Bình thường</span>
                                        </label>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[11px] text-clinic-text-secondary font-bold">Phân loại:</span>
                                        {['Loại I', 'Loại II', 'Loại III', 'Loại IV', 'Loại V'].map((p, idx) => (
                                            <label key={p} className="inline-flex items-center gap-1 cursor-pointer">
                                                <input type="radio" name="pl_tuanhoan" defaultChecked={idx === 0} className="accent-clinic-cta" />
                                                <span>{p}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                    <label className="inline-flex items-center gap-2 text-clinic-text-secondary">
                                        <input type="checkbox" className="accent-clinic-cta" />
                                        <span>I97.8 - Rối loạn hệ tuần hoàn khác sau phẫu thuật</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-clinic-text-secondary">
                                        <input type="checkbox" className="accent-clinic-cta" />
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

                            <div className="p-3.5 rounded-[6px] bg-clinic-bg border border-clinic-border space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <strong className="text-clinic-navy text-xs">b) Hô hấp</strong>
                                        <label className="inline-flex items-center gap-1.5 text-clinic-text cursor-pointer font-bold ml-3">
                                            <input type="checkbox" defaultChecked className="accent-clinic-cta rounded" />
                                            <span>Bình thường</span>
                                        </label>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[11px] text-clinic-text-secondary font-bold">Phân loại:</span>
                                        {['Loại I', 'Loại II', 'Loại III', 'Loại IV', 'Loại V'].map((p, idx) => (
                                            <label key={p} className="inline-flex items-center gap-1 cursor-pointer">
                                                <input type="radio" name="pl_hohap" defaultChecked={idx === 0} className="accent-clinic-cta" />
                                                <span>{p}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                    <label className="inline-flex items-center gap-2 text-clinic-text-secondary">
                                        <input type="checkbox" className="accent-clinic-cta" />
                                        <span>R07 - Đau họng và ngực</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-clinic-text-secondary">
                                        <input type="checkbox" className="accent-clinic-cta" />
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

                            <div className="p-3.5 rounded-[6px] bg-clinic-bg border border-clinic-border space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <strong className="text-clinic-navy text-xs">c) Tiêu hóa</strong>
                                        <label className="inline-flex items-center gap-1.5 text-clinic-text cursor-pointer font-bold ml-3">
                                            <input type="checkbox" defaultChecked className="accent-clinic-cta rounded" />
                                            <span>Bình thường</span>
                                        </label>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[11px] text-clinic-text-secondary font-bold">Phân loại:</span>
                                        {['Loại I', 'Loại II', 'Loại III', 'Loại IV', 'Loại V'].map((p, idx) => (
                                            <label key={p} className="inline-flex items-center gap-1 cursor-pointer">
                                                <input type="radio" name="pl_tieuhoa" defaultChecked={idx === 0} className="accent-clinic-cta" />
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

                    {deptKey === 'mat' && (
                        <div className="medpro-card p-4 space-y-4 text-xs">
                            <h2 className="font-extrabold text-sm text-clinic-navy uppercase border-b border-clinic-border pb-2">
                                BỆNH ÁN NHÃN KHOA (ĐO THỊ LỰC - NHÃN ÁP - BÁN PHẦN TRƯỚC - ĐÁY MẮT)
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 tabular-nums">
                                <div className="p-3.5 rounded-[6px] bg-clinic-surface-tint border border-clinic-info-border space-y-2.5">
                                    <div className="font-bold text-clinic-navy uppercase">Mắt Phải (OD)</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="medpro-label">Thị lực không kính:</label>
                                            <select
                                                value={specialtyData?.mat?.thiLucKhongKinhP || '10/10'}
                                                onChange={(e) => setSpecialtyData({ ...specialtyData, mat: { ...specialtyData.mat, thiLucKhongKinhP: e.target.value } })}
                                                className="medpro-input !py-1.5 h-9 text-xs font-mono font-bold truncate"
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
                                                className="medpro-input !py-1.5 h-9 text-xs font-mono font-bold truncate"
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

                                <div className="p-3.5 rounded-[6px] bg-clinic-surface-tint border border-clinic-info-border space-y-2.5">
                                    <div className="font-bold text-clinic-navy uppercase">Mắt Trái (OS)</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="medpro-label">Thị lực không kính:</label>
                                            <select
                                                value={specialtyData?.mat?.thiLucKhongKinhT || '10/10'}
                                                onChange={(e) => setSpecialtyData({ ...specialtyData, mat: { ...specialtyData.mat, thiLucKhongKinhT: e.target.value } })}
                                                className="medpro-input !py-1.5 h-9 text-xs font-mono font-bold truncate"
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
                                                className="medpro-input !py-1.5 h-9 text-xs font-mono font-bold truncate"
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

                            <div className="p-3 rounded-[6px] bg-clinic-bg border border-clinic-border space-y-2">
                                <div className="flex items-center gap-3">
                                    <strong className="text-clinic-navy">Các bệnh về mắt (nếu có):</strong>
                                    <label className="inline-flex items-center gap-1.5 font-bold text-clinic-text cursor-pointer">
                                        <input type="checkbox" defaultChecked className="accent-clinic-cta" />
                                        <span>Bình thường</span>
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                    <label className="inline-flex items-center gap-2 text-clinic-text-secondary">
                                        <input type="checkbox" className="accent-clinic-cta" />
                                        <span>H52.0 - Viễn thị</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-clinic-text-secondary">
                                        <input type="checkbox" className="accent-clinic-cta" />
                                        <span>H52.1 - Cận thị</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-clinic-text-secondary">
                                        <input type="checkbox" className="accent-clinic-cta" />
                                        <span>H52.2 - Loạn thị</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-clinic-text-secondary">
                                        <input type="checkbox" className="accent-clinic-cta" />
                                        <span>H44.2 - Cận thị thoái hóa</span>
                                    </label>
                                </div>
                            </div>

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
                                    <label className="medpro-label">Đáy mắt (Gai thị &amp; Võng mạc)</label>
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

                    {deptKey === 'tai-mui-hong' && (
                        <div className="medpro-card p-4 space-y-4 text-xs">
                            <h2 className="font-extrabold text-sm text-clinic-navy uppercase border-b border-clinic-border pb-2">
                                BỆNH ÁN TAI MŨI HỌNG (NỘI SOI MÀNG NHĨ - HỐC MŨI - AMIDAN - THANH QUẢN)
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="medpro-label">Tai Phải (Ống tai &amp; Màng nhĩ P)</label>
                                    <textarea
                                        rows={2}
                                        value={specialtyData?.tmh?.taiPhai || 'Màng nhĩ sáng bóng, nón sáng rõ'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, tmh: { ...specialtyData.tmh, taiPhai: e.target.value } })}
                                        className="medpro-input"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Tai Trái (Ống tai &amp; Màng nhĩ T)</label>
                                    <textarea
                                        rows={2}
                                        value={specialtyData?.tmh?.taiTrai || 'Màng nhĩ sáng bóng, nón sáng rõ, không thủng'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, tmh: { ...specialtyData.tmh, taiTrai: e.target.value } })}
                                        className="medpro-input"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Hốc Mũi &amp; Cuốn mũi, Vách ngăn</label>
                                    <textarea
                                        rows={2}
                                        value={specialtyData?.tmh?.mui || 'Hốc mũi thoáng, niêm mạc hồng, cuốn mũi dưới không phì đại'}
                                        onChange={(e) => setSpecialtyData({ ...specialtyData, tmh: { ...specialtyData.tmh, mui: e.target.value } })}
                                        className="medpro-input"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Họng, Amidan (Độ I - IV) &amp; Dây thanh âm</label>
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

                    {deptKey === 'rang-ham-mat' && (
                        <div className="medpro-card p-4 space-y-4 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clinic-border pb-2 tabular-nums">
                                <h2 className="font-extrabold text-sm text-clinic-navy uppercase">
                                    SƠ ĐỒ 32 RĂNG NHA KHOA TƯƠNG TÁC (ODONTOGRAM) &amp; BỆNH HỌC MIỆNG
                                </h2>
                                <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-bold">
                                    <span className="medpro-badge-success !text-[10px]">BT: {toothCounts.BT}</span>
                                    <span className="medpro-badge-danger !text-[10px]">Sâu: {toothCounts.S}</span>
                                    <span className="px-2 py-0.5 rounded bg-clinic-bg-muted text-clinic-text-secondary border border-clinic-border">Mất: {toothCounts.M}</span>
                                    <span className="medpro-badge-warning !text-[10px]">Trám: {toothCounts.T}</span>
                                    <span className="medpro-badge-info !text-[10px]">Sứ: {toothCounts.B}</span>
                                    <span className="px-2 py-0.5 rounded bg-clinic-surface-tint text-clinic-navy border border-clinic-border-strong">Khôn: {toothCounts.K}</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 bg-clinic-surface-tint p-3 rounded-[6px] border border-clinic-border tabular-nums">
                                <div className="flex items-center gap-2">
                                    <span className="text-clinic-text-secondary font-bold">Đang chọn:</span>
                                    <span className="px-2.5 py-1 rounded-[6px] bg-clinic-navy text-clinic-surface font-mono font-bold text-xs">
                                        Răng số: {activeTooth}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {[
                                        { code: 'BT', label: 'Bình thường', cls: 'bg-clinic-success-bg text-clinic-success border-clinic-success-border' },
                                        { code: 'S', label: 'Sâu răng [S]', cls: 'bg-clinic-danger-bg text-clinic-danger border-clinic-danger-border' },
                                        { code: 'M', label: 'Mất răng [M]', cls: 'bg-clinic-bg-muted text-clinic-text-secondary border-clinic-border-strong' },
                                        { code: 'T', label: 'Trám răng [T]', cls: 'bg-clinic-warning-bg text-clinic-warning border-clinic-warning-border' },
                                        { code: 'B', label: 'Bọc sứ [B]', cls: 'bg-clinic-surface-alt text-clinic-cta border-clinic-info-border' },
                                        { code: 'K', label: 'Khôn lệch [K]', cls: 'bg-clinic-surface text-clinic-navy border-clinic-border-strong' },
                                    ].map((btn) => (
                                        <button
                                            key={btn.code}
                                            type="button"
                                            onClick={() => handleUpdateToothStatus(btn.code)}
                                            className={`px-2.5 py-1 rounded-[6px] font-bold text-[11px] border transition-colors hover:opacity-85 cursor-pointer ${btn.cls}`}
                                        >
                                            {btn.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-3 bg-clinic-surface rounded-[6px] border border-clinic-border space-y-4 tabular-nums">
                                <div>
                                    <div className="text-[10px] font-extrabold uppercase text-clinic-text-muted tracking-wider mb-1 text-center">
                                        HÀM TRÊN (CUNG 1 &amp; CUNG 2)
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
                                                        className={`w-9 h-11 rounded-[6px] border flex flex-col items-center justify-between p-1 transition-colors cursor-pointer select-none ${
                                                            isSelected ? 'ring-2 ring-clinic-cta border-clinic-cta' : 'border-clinic-border hover:border-clinic-cta'
                                                        } ${
                                                            st === 'S' ? 'bg-clinic-danger-bg text-clinic-danger' :
                                                            st === 'M' ? 'bg-clinic-bg-muted text-clinic-text-muted opacity-60' :
                                                            st === 'T' ? 'bg-clinic-warning-bg text-clinic-warning' :
                                                            st === 'B' ? 'bg-clinic-surface-alt text-clinic-cta' :
                                                            st === 'K' ? 'bg-clinic-surface-tint text-clinic-navy' : 'bg-clinic-surface text-clinic-text'
                                                        }`}
                                                    >
                                                        <span className="font-mono font-bold text-[10px]">{tooth}</span>
                                                        <span className="font-extrabold text-[9.5px] uppercase font-mono">{st}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <div className="w-[1.5px] h-9 bg-clinic-border-strong mx-1 shrink-0" />
                                        <div className="flex items-center gap-1">
                                            {['21', '22', '23', '24', '25', '26', '27', '28'].map((tooth) => {
                                                const st = specialtyData?.rhm?.teethStatus?.[tooth] || 'BT'
                                                const isSelected = activeTooth === tooth
                                                return (
                                                    <div
                                                        key={tooth}
                                                        onClick={() => setActiveTooth(tooth)}
                                                        className={`w-9 h-11 rounded-[6px] border flex flex-col items-center justify-between p-1 transition-colors cursor-pointer select-none ${
                                                            isSelected ? 'ring-2 ring-clinic-cta border-clinic-cta' : 'border-clinic-border hover:border-clinic-cta'
                                                        } ${
                                                            st === 'S' ? 'bg-clinic-danger-bg text-clinic-danger' :
                                                            st === 'M' ? 'bg-clinic-bg-muted text-clinic-text-muted opacity-60' :
                                                            st === 'T' ? 'bg-clinic-warning-bg text-clinic-warning' :
                                                            st === 'B' ? 'bg-clinic-surface-alt text-clinic-cta' :
                                                            st === 'K' ? 'bg-clinic-surface-tint text-clinic-navy' : 'bg-clinic-surface text-clinic-text'
                                                        }`}
                                                    >
                                                        <span className="font-mono font-bold text-[10px]">{tooth}</span>
                                                        <span className="font-extrabold text-[9.5px] uppercase font-mono">{st}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="border-b border-dashed border-clinic-border" />

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
                                                        className={`w-9 h-11 rounded-[6px] border flex flex-col items-center justify-between p-1 transition-colors cursor-pointer select-none ${
                                                            isSelected ? 'ring-2 ring-clinic-cta border-clinic-cta' : 'border-clinic-border hover:border-clinic-cta'
                                                        } ${
                                                            st === 'S' ? 'bg-clinic-danger-bg text-clinic-danger' :
                                                            st === 'M' ? 'bg-clinic-bg-muted text-clinic-text-muted opacity-60' :
                                                            st === 'T' ? 'bg-clinic-warning-bg text-clinic-warning' :
                                                            st === 'B' ? 'bg-clinic-surface-alt text-clinic-cta' :
                                                            st === 'K' ? 'bg-clinic-surface-tint text-clinic-navy' : 'bg-clinic-surface text-clinic-text'
                                                        }`}
                                                    >
                                                        <span className="font-mono font-bold text-[10px]">{tooth}</span>
                                                        <span className="font-extrabold text-[9.5px] uppercase font-mono">{st}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <div className="w-[1.5px] h-9 bg-clinic-border-strong mx-1 shrink-0" />
                                        <div className="flex items-center gap-1">
                                            {['31', '32', '33', '34', '35', '36', '37', '38'].map((tooth) => {
                                                const st = specialtyData?.rhm?.teethStatus?.[tooth] || 'BT'
                                                const isSelected = activeTooth === tooth
                                                return (
                                                    <div
                                                        key={tooth}
                                                        onClick={() => setActiveTooth(tooth)}
                                                        className={`w-9 h-11 rounded-[6px] border flex flex-col items-center justify-between p-1 transition-colors cursor-pointer select-none ${
                                                            isSelected ? 'ring-2 ring-clinic-cta border-clinic-cta' : 'border-clinic-border hover:border-clinic-cta'
                                                        } ${
                                                            st === 'S' ? 'bg-clinic-danger-bg text-clinic-danger' :
                                                            st === 'M' ? 'bg-clinic-bg-muted text-clinic-text-muted opacity-60' :
                                                            st === 'T' ? 'bg-clinic-warning-bg text-clinic-warning' :
                                                            st === 'B' ? 'bg-clinic-surface-alt text-clinic-cta' :
                                                            st === 'K' ? 'bg-clinic-surface-tint text-clinic-navy' : 'bg-clinic-surface text-clinic-text'
                                                        }`}
                                                    >
                                                        <span className="font-mono font-bold text-[10px]">{tooth}</span>
                                                        <span className="font-extrabold text-[9.5px] uppercase font-mono">{st}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-extrabold uppercase text-clinic-text-muted tracking-wider mt-1 text-center">
                                        HÀM DƯỚI (CUNG 4 &amp; CUNG 3)
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="medpro-label">Tình trạng Nướu / Lợi &amp; BOP</label>
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
                                        className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
                                    >
                                        <option value="Độ 0 (Không có cao răng)">Độ 0 (Không có cao răng)</option>
                                        <option value="Độ 1 (Có ít mảng bám vôi răng mặt trong)">Độ 1 (Có ít mảng bám vôi răng mặt trong)</option>
                                        <option value="Độ 2 (Cao răng che phủ 1/3 - 2/3 thân răng)">Độ 2 (Cao răng che phủ 1/3 - 2/3 thân răng)</option>
                                        <option value="Độ 3 (Cao răng nặng bám sâu dưới nướu)">Độ 3 (Cao răng nặng bám sâu dưới nướu)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="medpro-label">Khớp cắn &amp; Khớp thái dương hàm</label>
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

                    {deptKey === 'ngoai-khoa' && (
                        <div className="medpro-card p-4 space-y-4 text-xs">
                            <h2 className="font-extrabold text-sm text-clinic-navy uppercase border-b border-clinic-border pb-2">
                                BỆNH ÁN NGOẠI KHOA (VẾT MỔ - KHỐI U - THOÁT VỊ - TIỂU PHẪU)
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="medpro-label">Khám ngoại tổng quát &amp; Tư thế</label>
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
                                    <label className="medpro-label">Thoát vị thành bụng &amp; Bẹn</label>
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
                                        className="medpro-input font-bold text-clinic-navy"
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
