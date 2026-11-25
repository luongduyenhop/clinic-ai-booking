import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
    CalendarCheck,
    Clock,
    Heartbeat,
    Microscope,
    Pill,
    Printer,
    Star,
    User,
    Users,
    WarningCircle,
} from '../../components/common/ClinicIcon'
import { useDispatch, useSelector } from 'react-redux'
import {
    fetchMedicalRecordsAsync,
    submitPatientFeedbackAsync,
} from '../../redux/actions/user/patientPortalAction'
import ResultAttachments from '../../components/user/patient/ResultAttachments'

export default function PatientMedicalRecordsPage() {
    const dispatch = useDispatch()
    const {
        items: records,
        loading: isLoading,
        error: loadError,
    } = useSelector((state) => state.user.user.medicalRecords)
    const feedback = useSelector((state) => state.user.user.feedbackMutation)
    const currentUser = useSelector((state) => state.app.auth.user)
    const familyList = useSelector((state) => state.user.user.portalData?.familyMembers || [])
    const [selectedRecordId, setSelectedRecordId] = useState(null)
    const [activeTab, setActiveTab] = useState('tong_quan')
    const [ratingModalOpen, setRatingModalOpen] = useState(false)
    const [ratingScore, setRatingScore] = useState(5)
    const [ratingComment, setRatingComment] = useState('')
    const [activeFamilyMember, setActiveFamilyMember] = useState('self')

    const currentRecord = records.find((r) => r.id === selectedRecordId) || records[0]

    useEffect(() => {
        dispatch(fetchMedicalRecordsAsync())
    }, [dispatch])

    const handleOpenRating = () => {
        if (currentRecord.danhGia) {
            toast.info('Bạn đã gửi đánh giá cho lượt khám này rồi.')
            return
        }
        setRatingScore(5)
        setRatingComment('')
        setRatingModalOpen(true)
    }

    const handleSubmitRating = async (e) => {
        e.preventDefault()
        if (feedback.loading) return
        const result = await dispatch(
            submitPatientFeedbackAsync({
                luot_kham_id: Number(currentRecord.id),
                so_sao_bac_si: ratingScore,
                so_sao_phong_kham: ratingScore,
                nhan_xet: ratingComment,
            })
        )
        if (submitPatientFeedbackAsync.fulfilled.match(result)) {
            setRatingModalOpen(false)
            toast.success('Cảm ơn bạn đã đánh giá dịch vụ khám chữa bệnh')
        } else {
            toast.error(result.payload || 'Không thể lưu đánh giá. Vui lòng thử lại.')
        }
    }

    const handlePrintRecord = () => {
        window.print()
    }

    if (isLoading) {
        return (
            <div className="medpro-card p-10 text-center text-sm font-semibold text-clinic-text-secondary">
                Đang tải hồ sơ bệnh án điện tử...
            </div>
        )
    }

    if (loadError) {
        return (
            <div className="medpro-card border-clinic-danger-border bg-clinic-danger-bg p-10 text-center text-sm font-semibold text-clinic-danger">
                {loadError}
            </div>
        )
    }

    if (!currentRecord) {
        return (
            <div className="medpro-card p-10 text-center text-sm font-semibold text-clinic-text-secondary">
                Bạn chưa có lượt khám nào trong hồ sơ sức khỏe.
            </div>
        )
    }

    const vitalCards = [
        { label: 'Huyết áp', value: currentRecord.sinhHieu.huyetAp },
        { label: 'Mạch', value: currentRecord.sinhHieu.mach },
        { label: 'Nhiệt độ', value: currentRecord.sinhHieu.nhietDo },
        { label: 'SpO2', value: currentRecord.sinhHieu.spo2 },
        { label: 'Cân nặng', value: currentRecord.sinhHieu.canNang },
        { label: 'BMI', value: currentRecord.sinhHieu.bmi },
    ]

    return (
        <div className="space-y-6 pb-8">
            <header className="medpro-card p-5 bg-clinic-surface">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="font-display text-[22px] sm:text-[26px] font-extrabold tracking-tight text-clinic-navy">
                            Sổ Bệnh Án &amp; Đơn Thuốc Điện Tử
                        </h1>
                        <p className="text-[13.5px] text-clinic-text-secondary mt-1">
                            Tra cứu chi tiết kết quả khám, đơn thuốc 4 cữ trong ngày, xét nghiệm cận lâm sàng và lịch tái khám.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <Link to="/dat-lich" className="medpro-btn-primary text-xs px-4 py-2.5">
                            <CalendarCheck size={17} weight="bold" />
                            <span>Đặt khám mới</span>
                        </Link>
                        <button
                            type="button"
                            onClick={handlePrintRecord}
                            className="medpro-btn-outline text-xs px-3.5 py-2.5 cursor-pointer"
                            title="In sổ khám bệnh"
                        >
                            <Printer size={17} />
                            <span className="hidden sm:inline">In hồ sơ</span>
                        </button>
                    </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-clinic-border flex items-center gap-2 overflow-x-auto">
                    <span className="text-xs font-semibold text-clinic-text-secondary shrink-0 flex items-center gap-1.5">
                        <Users size={15} />
                        <span>Người bệnh:</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => setActiveFamilyMember('self')}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
                            activeFamilyMember === 'self'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'bg-clinic-bg-muted text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <User size={13} />
                        <span>{currentUser?.fullName || currentUser?.ho_ten || 'Bản thân'} (Bản thân)</span>
                    </button>
                    {familyList.map((m) => (
                        <button
                            type="button"
                            key={m.id}
                            onClick={() => {
                                setActiveFamilyMember(String(m.id))
                                toast.info(
                                    `Hồ sơ thành viên ${m.ho_ten} đang hiển thị theo sổ sức khỏe gia đình.`
                                )
                            }}
                            className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                                activeFamilyMember === String(m.id)
                                    ? 'bg-clinic-navy text-clinic-surface'
                                    : 'bg-clinic-bg-muted text-clinic-text-secondary hover:text-clinic-navy'
                            }`}
                        >
                            {m.ho_ten} ({m.quan_he || m.moi_quan_he || 'Người thân'})
                        </button>
                    ))}
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-4">
                    <div className="medpro-card p-4 bg-clinic-surface">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-clinic-border">
                            <h2 className="font-bold text-clinic-navy text-sm flex items-center gap-2 tabular-nums">
                                <Clock size={16} className="text-clinic-cta" />
                                <span>Lịch sử Khám bệnh ({records.length})</span>
                            </h2>
                            <span className="text-[11px] font-semibold text-clinic-text-secondary">
                                Mới nhất trước
                            </span>
                        </div>

                        <div className="divide-y divide-clinic-border">
                            {records.map((rec) => {
                                const isSelected = rec.id === currentRecord.id
                                return (
                                    <button
                                        type="button"
                                        key={rec.id}
                                        onClick={() => setSelectedRecordId(rec.id)}
                                        className={`w-full p-3 text-left transition-colors cursor-pointer ${
                                            isSelected ? 'bg-clinic-surface-alt' : 'hover:bg-clinic-bg'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="font-extrabold text-clinic-navy tabular-nums">
                                                {rec.ngayKham}
                                            </span>
                                            <span className="medpro-badge-success">Đã hoàn thành</span>
                                        </div>
                                        <div className="font-bold text-sm text-clinic-navy truncate">
                                            {rec.chuyenKhoa}
                                        </div>
                                        <div className="text-xs text-clinic-text-secondary truncate mt-0.5">
                                            {rec.bacSi} • {rec.phongKham}
                                        </div>
                                        <div className="text-[11px] text-clinic-cta font-mono mt-1 tabular-nums">
                                            Mã KCB: {rec.maKcb}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="medpro-card p-4 bg-clinic-surface-tint text-xs space-y-1.5">
                        <div className="font-bold text-clinic-navy">
                            Liên thông Đơn thuốc Điện tử Quốc gia
                        </div>
                        <p className="text-clinic-text-secondary leading-5">
                            Đơn thuốc ký số tại Clinic-AI tuân thủ chuẩn dữ liệu Bộ Y tế. Người bệnh có thể xuất trình mã đơn khi nhận thuốc tại quầy dược nội viện hoặc nhà thuốc liên kết.
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-8">
                    <div className="medpro-card bg-clinic-surface overflow-hidden">
                        <div className="p-5 bg-clinic-surface-tint border-b border-clinic-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-block rounded-[6px] bg-clinic-surface-alt px-2.5 py-1 text-xs font-mono font-bold text-clinic-cta tabular-nums">
                                        {currentRecord.maKcb}
                                    </span>
                                    <span className="text-xs text-clinic-text-secondary font-medium tabular-nums">
                                        Khám ngày {currentRecord.ngayKham} lúc {currentRecord.gioKham}
                                    </span>
                                </div>
                                <h2 className="text-lg font-bold text-clinic-navy mt-1.5 flex flex-wrap items-center gap-2">
                                    <span>{currentRecord.chuyenKhoa}</span>
                                    <span className="text-xs font-normal text-clinic-text-secondary">
                                        ({currentRecord.phongKham})
                                    </span>
                                </h2>
                                <p className="text-xs text-clinic-text-secondary mt-0.5">
                                    Bác sĩ điều trị:{' '}
                                    <strong className="text-clinic-navy">{currentRecord.bacSi}</strong>
                                </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {currentRecord.danhGia ? (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-clinic-warning-bg text-clinic-warning text-xs font-bold tabular-nums">
                                        <Star size={14} weight="fill" className="text-clinic-amber" />
                                        <span>{currentRecord.danhGia.diemSo}/5 sao</span>
                                        <span className="text-[11px] font-normal">(Đã gửi)</span>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleOpenRating}
                                        className="medpro-btn-outline text-xs px-3.5 py-2 cursor-pointer"
                                    >
                                        <Star size={14} weight="fill" className="text-clinic-amber" />
                                        <span>Gửi đánh giá dịch vụ</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap bg-clinic-bg-muted px-3 gap-1 text-xs font-bold">
                            <button
                                type="button"
                                onClick={() => setActiveTab('tong_quan')}
                                className={`py-2.5 px-2.5 border-b-2 transition-colors shrink-0 cursor-pointer ${
                                    activeTab === 'tong_quan'
                                        ? 'border-clinic-cta text-clinic-cta'
                                        : 'border-transparent text-clinic-text-secondary hover:text-clinic-navy'
                                }`}
                            >
                                Chẩn đoán &amp; Sinh hiệu
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('don_thuoc')}
                                className={`py-2.5 px-2.5 border-b-2 transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 tabular-nums ${
                                    activeTab === 'don_thuoc'
                                        ? 'border-clinic-cta text-clinic-cta'
                                        : 'border-transparent text-clinic-text-secondary hover:text-clinic-navy'
                                }`}
                            >
                                <Pill size={15} />
                                <span>Đơn thuốc 4 cữ ({currentRecord.donThuoc.danhSachThuoc.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('can_lam_sang')}
                                className={`py-2.5 px-2.5 border-b-2 transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 tabular-nums ${
                                    activeTab === 'can_lam_sang'
                                        ? 'border-clinic-cta text-clinic-cta'
                                        : 'border-transparent text-clinic-text-secondary hover:text-clinic-navy'
                                }`}
                            >
                                <Microscope size={15} />
                                <span>Cận lâm sàng ({currentRecord.canLamSang.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('tai_kham')}
                                className={`py-2.5 px-2.5 border-b-2 transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 ${
                                    activeTab === 'tai_kham'
                                        ? 'border-clinic-cta text-clinic-cta'
                                        : 'border-transparent text-clinic-text-secondary hover:text-clinic-navy'
                                }`}
                            >
                                <CalendarCheck size={15} />
                                <span>Hẹn tái khám</span>
                            </button>
                        </div>

                        {activeTab === 'tong_quan' && (
                            <div className="p-5 space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-3.5 rounded-[6px] bg-clinic-bg">
                                        <span className="text-xs font-semibold text-clinic-text-secondary">
                                            Lý do vào viện
                                        </span>
                                        <p className="text-sm font-semibold text-clinic-navy mt-1">
                                            {currentRecord.lyDoKham}
                                        </p>
                                    </div>
                                    <div className="p-3.5 rounded-[6px] bg-clinic-bg">
                                        <span className="text-xs font-semibold text-clinic-text-secondary">
                                            Tiền sử bệnh
                                        </span>
                                        <p className="text-sm font-semibold text-clinic-navy mt-1">
                                            {currentRecord.tienSu}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold text-clinic-navy mb-2.5 flex items-center gap-1.5">
                                        <Heartbeat size={16} className="text-clinic-danger" />
                                        <span>Chỉ số Sinh hiệu lúc tiếp đón</span>
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-center">
                                        {vitalCards.map((vital) => (
                                            <div key={vital.label} className="p-2.5 rounded-[6px] bg-clinic-bg">
                                                <div className="text-[11px] font-semibold text-clinic-text-secondary">
                                                    {vital.label}
                                                </div>
                                                <div className="text-sm font-extrabold text-clinic-navy tabular-nums mt-0.5">
                                                    {vital.value}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-4 rounded-[6px] bg-clinic-surface-alt space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-[6px] bg-clinic-navy text-clinic-surface text-[11px] font-bold">
                                            ICD-10 Chính
                                        </span>
                                        <span className="font-bold text-sm text-clinic-navy">
                                            {currentRecord.chanDoan.icd10Chinh}
                                        </span>
                                    </div>
                                    {currentRecord.chanDoan.icd10Phu && (
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span className="px-2 py-0.5 rounded-[6px] bg-clinic-bg-muted text-clinic-text-secondary font-bold">
                                                Kèm theo
                                            </span>
                                            <span className="text-clinic-text">{currentRecord.chanDoan.icd10Phu}</span>
                                        </div>
                                    )}
                                    <div className="pt-2 text-xs text-clinic-text-secondary">
                                        <strong className="text-clinic-navy">Kết luận điều trị: </strong>
                                        {currentRecord.chanDoan.ketLuan}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'don_thuoc' && (
                            <div className="p-5 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                                    <div>
                                        <span className="text-xs font-mono font-bold text-clinic-cta tabular-nums">
                                            Mã đơn thuốc: {currentRecord.donThuoc.maDon}
                                        </span>
                                        <span className="ml-2 text-xs text-clinic-text-secondary tabular-nums">
                                            (Số ngày điều trị: <strong>{currentRecord.donThuoc.soNgayDung} ngày</strong>)
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handlePrintRecord}
                                            className="medpro-btn-outline text-xs px-3 py-1.5 cursor-pointer"
                                            title="In đơn thuốc điện tử"
                                        >
                                            <Printer size={15} />
                                            <span>In đơn thuốc</span>
                                        </button>
                                        <div className="text-xs text-clinic-warning bg-clinic-warning-bg px-3 py-2 rounded-[6px] flex items-center gap-1.5">
                                            <WarningCircle size={15} weight="fill" className="shrink-0" />
                                            <span>
                                                <strong>Lời dặn:</strong> {currentRecord.donThuoc.loiDanChung}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead>
                                            <tr className="bg-clinic-bg-muted text-clinic-navy">
                                                <th className="p-2.5 font-bold">Tên thuốc &amp; Hàm lượng</th>
                                                <th className="p-2.5 font-bold text-center">ĐVT</th>
                                                <th className="p-2.5 font-bold text-center">SL</th>
                                                <th className="p-2.5 font-bold text-center">Sáng</th>
                                                <th className="p-2.5 font-bold text-center">Trưa</th>
                                                <th className="p-2.5 font-bold text-center">Chiều</th>
                                                <th className="p-2.5 font-bold text-center">Tối</th>
                                                <th className="p-2.5 font-bold">Cách dùng chi tiết</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-clinic-border">
                                            {currentRecord.donThuoc.danhSachThuoc.map((med, idx) => (
                                                <tr key={idx} className="hover:bg-clinic-bg transition-colors">
                                                    <td className="p-2.5 font-bold text-clinic-navy">{med[0]}</td>
                                                    <td className="p-2.5 text-center text-clinic-text-secondary">{med[1]}</td>
                                                    <td className="p-2.5 text-center font-bold text-clinic-cta tabular-nums">
                                                        {med[2]}
                                                    </td>
                                                    <td className="p-2.5 text-center font-bold text-clinic-navy tabular-nums">
                                                        {med[3]}
                                                    </td>
                                                    <td className="p-2.5 text-center font-bold text-clinic-navy tabular-nums">
                                                        {med[4]}
                                                    </td>
                                                    <td className="p-2.5 text-center font-bold text-clinic-navy tabular-nums">
                                                        {med[5]}
                                                    </td>
                                                    <td className="p-2.5 text-center font-bold text-clinic-navy tabular-nums">
                                                        {med[6]}
                                                    </td>
                                                    <td className="p-2.5 text-clinic-text-secondary font-medium">{med[7]}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'can_lam_sang' && (
                            <div className="p-5 divide-y divide-clinic-border">
                                {currentRecord.canLamSang.map((cls) => (
                                    <div key={cls.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div>
                                                <div className="text-xs font-mono text-clinic-cta font-bold tabular-nums">
                                                    {cls.id}
                                                </div>
                                                <h4 className="text-sm font-bold text-clinic-navy">{cls.tenDichVu}</h4>
                                            </div>
                                            <span className="text-[11px] text-clinic-text-secondary font-medium tabular-nums">
                                                Kết quả lúc: {cls.ngayCoKetQua}
                                            </span>
                                        </div>

                                        {cls.chiTiet && (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-clinic-bg-muted text-clinic-navy">
                                                            <th className="p-2 font-bold">Chỉ số xét nghiệm</th>
                                                            <th className="p-2 font-bold text-center">Kết quả</th>
                                                            <th className="p-2 font-bold text-center">Đơn vị</th>
                                                            <th className="p-2 font-bold text-center">Khoảng tham chiếu</th>
                                                            <th className="p-2 font-bold text-center">Đánh giá</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-clinic-border">
                                                        {cls.chiTiet.map((item, idx) => (
                                                            <tr key={idx}>
                                                                <td className="p-2 font-semibold text-clinic-navy">
                                                                    {item.chiSo || (Array.isArray(item) ? item[0] : '')}
                                                                </td>
                                                                <td className="p-2 text-center font-bold text-clinic-navy tabular-nums">
                                                                    {item.ketQua || (Array.isArray(item) ? item[1] : '')}
                                                                </td>
                                                                <td className="p-2 text-center text-clinic-text-secondary">
                                                                    {item.donVi || ''}
                                                                </td>
                                                                <td className="p-2 text-center text-clinic-text-secondary tabular-nums">
                                                                    {item.thamChieu || (Array.isArray(item) ? item[2] : '')}
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    {item.trangThai === 'high' ? (
                                                                        <span className="medpro-badge-danger">Vượt ngưỡng</span>
                                                                    ) : (
                                                                        <span className="medpro-badge-success">Bình thường</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {cls.hinhAnhUrl && (
                                            <ResultAttachments
                                                files={cls.hinhAnhUrls?.length ? cls.hinhAnhUrls : [cls.hinhAnhUrl]}
                                                serviceName={cls.tenDichVu}
                                            />
                                        )}

                                        <div className="text-xs bg-clinic-bg p-3 rounded-[6px]">
                                            <strong className="text-clinic-navy">Kết luận chuyên môn: </strong>
                                            <span className="text-clinic-text">{cls.ketLuan}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'tai_kham' && (
                            <div className="p-5 space-y-4">
                                <div className="p-5 rounded-[8px] bg-clinic-surface-alt flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <span className="text-xs font-bold text-clinic-cta">
                                            Lịch hẹn tái khám theo chỉ định
                                        </span>
                                        <h4 className="font-display text-2xl font-extrabold text-clinic-navy flex items-center gap-2 tabular-nums">
                                            <CalendarCheck size={24} className="text-clinic-cta" />
                                            <span>{currentRecord.taiKham.ngayHen}</span>
                                        </h4>
                                        <p className="text-xs text-clinic-text-secondary">
                                            Khoa: <strong className="text-clinic-navy">{currentRecord.chuyenKhoa}</strong> •
                                            Bác sĩ: <strong className="text-clinic-navy">{currentRecord.bacSi}</strong>
                                        </p>
                                    </div>

                                    <Link to="/dat-lich" className="medpro-btn-primary text-xs px-4 py-2.5 shrink-0">
                                        Đặt lịch đúng ngày hẹn này
                                    </Link>
                                </div>

                                <div className="p-4 rounded-[6px] bg-clinic-warning-bg text-xs text-clinic-warning space-y-1">
                                    <strong className="font-bold flex items-center gap-1.5">
                                        <WarningCircle size={15} weight="fill" />
                                        <span>Lời dặn dò chuyên biệt từ Bác sĩ:</span>
                                    </strong>
                                    <p className="leading-5">{currentRecord.taiKham.loiDanTaiKham}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {ratingModalOpen && (
                <div className="fixed inset-0 z-50 bg-clinic-navy-dark/60 flex items-center justify-center p-4">
                    <div className="medpro-card bg-clinic-surface max-w-md w-full p-6">
                        <div className="text-center space-y-2 mb-5">
                            <div className="w-11 h-11 rounded-[8px] bg-clinic-warning-bg text-clinic-amber flex items-center justify-center mx-auto">
                                <Star size={24} weight="fill" />
                            </div>
                            <h3 className="text-lg font-bold text-clinic-navy">
                                Đánh giá chất lượng buổi khám
                            </h3>
                            <p className="text-xs text-clinic-text-secondary">
                                Bác sĩ {currentRecord.bacSi} • {currentRecord.chuyenKhoa}
                            </p>
                        </div>

                        <form onSubmit={handleSubmitRating} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-clinic-navy mb-2 text-center">
                                    Mức độ hài lòng của bạn
                                </label>
                                <div className="flex items-center justify-center gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            type="button"
                                            key={star}
                                            onClick={() => setRatingScore(star)}
                                            aria-label={`${star} sao`}
                                            className="p-1 cursor-pointer"
                                        >
                                            <Star
                                                size={28}
                                                weight="fill"
                                                className={
                                                    star <= ratingScore
                                                        ? 'text-clinic-amber'
                                                        : 'text-clinic-border-strong'
                                                }
                                            />
                                        </button>
                                    ))}
                                </div>
                                <div className="text-center text-xs font-bold text-clinic-warning mt-1">
                                    {ratingScore === 5 && 'Tuyệt vời, rất hài lòng'}
                                    {ratingScore === 4 && 'Hài lòng, dịch vụ tốt'}
                                    {ratingScore === 3 && 'Bình thường'}
                                    {ratingScore === 2 && 'Chưa hài lòng'}
                                    {ratingScore === 1 && 'Rất không hài lòng'}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-clinic-navy mb-1">
                                    Ý kiến đóng góp (tùy chọn)
                                </label>
                                <textarea
                                    value={ratingComment}
                                    onChange={(e) => setRatingComment(e.target.value)}
                                    rows={3}
                                    placeholder="Chia sẻ trải nghiệm về thái độ bác sĩ, thời gian chờ hoặc cơ sở phòng khám..."
                                    className="medpro-input text-xs resize-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setRatingModalOpen(false)}
                                    className="medpro-btn-outline text-xs px-4 py-2 cursor-pointer"
                                >
                                    Để sau
                                </button>
                                <button
                                    type="submit"
                                    disabled={feedback.loading}
                                    className="medpro-btn-primary text-xs px-5 py-2 cursor-pointer"
                                >
                                    Gửi đánh giá
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
