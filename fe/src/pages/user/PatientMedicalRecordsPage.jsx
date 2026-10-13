import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
    Heartbeat,
    Stethoscope,
    Pill,
    Clock,
    CheckCircle,
    CalendarCheck,
    Receipt,
    Printer,
    Sparkle,
    ArrowRight,
    CaretRight,
    WarningCircle,
    User,
    Users,
    Microscope,
    Eye,
    Scan
} from '../../components/common/ClinicIcon'

// Dữ liệu mẫu hồ sơ bệnh án theo chuẩn tClinic và Medpro
const MOCK_RECORDS = [
    {
        id: 'LK-2026-0042',
        maKcb: 'KCB-2026-0819-01',
        ngayKham: '2026-04-10',
        gioKham: '09:15',
        chuyenKhoa: 'Khoa Nội Tổng Quát',
        phongKham: 'Phòng 101',
        bacSi: 'BS.CKII Nguyễn Minh Hoàng',
        trangThai: 'da_hoan_thanh',
        lyDoKham: 'Đau đầu, hồi hộp, hoa mắt chóng mặt khi thay đổi tư thế',
        tienSu: 'Tăng huyết áp vô căn (đang điều trị ngoại trú)',
        sinhHieu: {
            huyetAp: '145/90 mmHg',
            mach: '82 bpm',
            nhietDo: '36.8 °C',
            spo2: '98%',
            canNang: '68 kg',
            chieuCao: '170 cm',
            bmi: '23.5 (Bình thường)'
        },
        chanDoan: {
            icd10Chinh: 'I10 - Bệnh tăng huyết áp nguyên phát (vô căn)',
            icd10Phu: 'E78.0 - Tăng cholesterol máu thuần túy',
            ketLuan: 'Tăng huyết áp độ 1 kèm rối loạn lipid máu nhẹ. Chưa có biến chứng tim mạch cấp.'
        },
        canLamSang: [
            {
                id: 'CLS-01',
                tenDichVu: 'Tổng phân tích tế bào máu ngoại vi (24 thông số)',
                loai: 'XetNghiem',
                ketLuan: 'Số lượng bạch cầu, hồng cầu và tiểu cầu trong giới hạn bình thường.',
                ngayCoKetQua: '2026-04-10 10:00',
                chiTiet: [
                    { chiSo: 'WBC (Bạch cầu)', ketQua: '6.8', donVi: 'G/L', thamChieu: '4.0 - 10.0', trangThai: 'normal' },
                    { chiSo: 'RBC (Hồng cầu)', ketQua: '4.7', donVi: 'T/L', thamChieu: '3.8 - 5.5', trangThai: 'normal' },
                    { chiSo: 'HGB (Huyết sắc tố)', ketQua: '142', donVi: 'g/L', thamChieu: '120 - 160', trangThai: 'normal' },
                    { chiSo: 'PLT (Tiểu cầu)', ketQua: '235', donVi: 'G/L', thamChieu: '150 - 450', trangThai: 'normal' }
                ]
            },
            {
                id: 'CLS-02',
                tenDichVu: 'Sinh hóa máu: Glucose, Cholesterol toàn phần, Triglyceride',
                loai: 'XetNghiem',
                ketLuan: 'Cholesterol toàn phần hơi cao (5.8 mmol/L), cần điều chỉnh chế độ ăn giảm mỡ động vật.',
                ngayCoKetQua: '2026-04-10 10:15',
                chiTiet: [
                    { chiSo: 'Glucose đói', ketQua: '5.2', donVi: 'mmol/L', thamChieu: '3.9 - 6.4', trangThai: 'normal' },
                    { chiSo: 'Cholesterol toàn phần', ketQua: '5.8', donVi: 'mmol/L', thamChieu: '< 5.2', trangThai: 'high' },
                    { chiSo: 'Triglyceride', ketQua: '1.9', donVi: 'mmol/L', thamChieu: '< 2.3', trangThai: 'normal' },
                    { chiSo: 'Creatinine huyết thanh', ketQua: '78', donVi: 'µmol/L', thamChieu: '53 - 106', trangThai: 'normal' }
                ]
            },
            {
                id: 'CLS-03',
                tenDichVu: 'Điện tâm đồ (ECG 12 chuyển đạo)',
                loai: 'ThamDoChucNang',
                ketLuan: 'Nhịp xoang đều, tần số 82 chu kỳ/phút. Trục trung gian. Chưa thấy dày thất trái.',
                ngayCoKetQua: '2026-04-10 09:45',
                hinhAnhUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80'
            }
        ],
        donThuoc: {
            maDon: 'DT-2026-0188',
            soNgayDung: 30,
            loiDanChung: 'Uống thuốc đúng giờ sau ăn sáng. Đo huyết áp mỗi sáng ghi vào sổ nhật ký.',
            danhSachThuoc: [
                [
                    'Amlodipine 5mg',
                    'Viên',
                    30,
                    '1',
                    '0',
                    '0',
                    '0',
                    'Uống 1 viên vào 08:00 sáng sau ăn no'
                ],
                [
                    'Atorvastatin 10mg',
                    'Viên',
                    30,
                    '0',
                    '0',
                    '0',
                    '1',
                    'Uống 1 viên vào buổi tối trước khi đi ngủ'
                ],
                [
                    'Ginkgo Biloba 80mg',
                    'Viên',
                    60,
                    '1',
                    '0',
                    '1',
                    '0',
                    'Uống 1 viên sáng, 1 viên chiều sau ăn'
                ]
            ]
        },
        taiKham: {
            ngayHen: '2026-05-10',
            loiDanTaiKham: 'Tái khám sau 30 ngày để đánh giá đáp ứng huyết áp và xét nghiệm lại lipid máu (nhịn ăn sáng trước khi đến).'
        },
        danhGia: null // Chưa đánh giá
    },
    {
        id: 'LK-2026-0018',
        maKcb: 'KCB-2026-0819-00',
        ngayKham: '2026-02-15',
        gioKham: '14:30',
        chuyenKhoa: 'Khoa Tai Mũi Họng',
        phongKham: 'Phòng 202',
        bacSi: 'BS.CKI Lê Hoàng Nam',
        trangThai: 'da_hoan_thanh',
        lyDoKham: 'Đau rát họng, ho húng hắng có đờm trắng đục, nghẹt mũi',
        tienSu: 'Không có tiền sử bệnh lý mạn tính',
        sinhHieu: {
            huyetAp: '120/75 mmHg',
            mach: '78 bpm',
            nhietDo: '37.3 °C',
            spo2: '99%',
            canNang: '68 kg',
            chieuCao: '170 cm',
            bmi: '23.5 (Bình thường)'
        },
        chanDoan: {
            icd10Chinh: 'J02.9 - Viêm họng cấp không đặc hiệu',
            icd10Phu: 'J00 - Viêm mũi họng cấp (cảm thông thường)',
            ketLuan: 'Viêm mũi họng cấp tính do thời tiết chuyển mùa. Không có dấu hiệu bội nhiễm phổi.'
        },
        canLamSang: [
            {
                id: 'CLS-10',
                tenDichVu: 'Nội soi Tai Mũi Họng ống mềm có ghi hình',
                loai: 'NoiSoi',
                ketLuan: 'Niêm mạc họng đỏ xung huyết, thành sau họng có vài nang lympho quá phát. Hai dây thanh khép kín tốt.',
                ngayCoKetQua: '2026-02-15 14:50',
                hinhAnhUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600&auto=format&fit=crop&q=80'
            }
        ],
        donThuoc: {
            maDon: 'DT-2026-0072',
            soNgayDung: 5,
            loiDanChung: 'Súc họng nước muối sinh lý ấm ngày 3-4 lần. Tránh nước đá lạnh.',
            danhSachThuoc: [
                [
                    'Cefuroxime 500mg',
                    'Viên',
                    10,
                    '1',
                    '0',
                    '0',
                    '1',
                    'Uống 1 viên sau ăn sáng, 1 viên sau ăn tối'
                ],
                [
                    'Paracetamol 500mg',
                    'Viên',
                    10,
                    '1',
                    '1',
                    '0',
                    '0',
                    'Uống khi đau họng hoặc sốt > 38.5°C cách nhau 4-6h'
                ],
                [
                    'Xịt mũi họng thảo dược',
                    'Lọ',
                    1,
                    '1',
                    '1',
                    '1',
                    '1',
                    'Xịt mỗi bên 1 nhát, ngày 3-4 lần'
                ]
            ]
        },
        taiKham: {
            ngayHen: '2026-02-22',
            loiDanTaiKham: 'Nếu còn ho đờm đục hoặc sốt cao sau 5 ngày vui lòng quay lại khám.'
        },
        danhGia: {
            diemSo: 5,
            nhanXet: 'Bác sĩ Nam khám rất nhẹ nhàng, nội soi không đau và giải thích đơn thuốc rất chi tiết.',
            ngayDanhGia: '2026-02-16'
        }
    }
]

export default function PatientMedicalRecordsPage() {
    const [records, setRecords] = useState(MOCK_RECORDS)
    const [selectedRecordId, setSelectedRecordId] = useState(MOCK_RECORDS[0].id)
    const [activeTab, setActiveTab] = useState('tong_quan') // 'tong_quan' | 'don_thuoc' | 'can_lam_sang' | 'tai_kham'

    // Modal đánh giá 5 sao
    const [ratingModalOpen, setRatingModalOpen] = useState(false)
    const [ratingScore, setRatingScore] = useState(5)
    const [ratingComment, setRatingComment] = useState('')
    const [activeFamilyMember, setActiveFamilyMember] = useState('self')

    const currentRecord = records.find((r) => r.id === selectedRecordId) || records[0]

    const handleOpenRating = () => {
        if (currentRecord.danhGia) {
            toast.info('Bạn đã gửi đánh giá cho lượt khám này rồi.')
            return
        }
        setRatingScore(5)
        setRatingComment('')
        setRatingModalOpen(true)
    }

    const handleSubmitRating = (e) => {
        e.preventDefault()
        setRecords((prev) =>
            prev.map((rec) => {
                if (rec.id === currentRecord.id) {
                    return {
                        ...rec,
                        danhGia: {
                            diemSo: ratingScore,
                            nhanXet: ratingComment || 'Dịch vụ chu đáo, bác sĩ tư vấn tận tình.',
                            ngayDanhGia: new Date().toISOString().split('T')[0]
                        }
                    }
                }
                return rec
            })
        )
        setRatingModalOpen(false)
        toast.success('Cảm ơn bạn đã đánh giá dịch vụ khám chữa bệnh!')
    }

    const handlePrintRecord = () => {
        window.print()
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-16">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-[#003553] via-[#004B75] to-[#0088BA] text-white py-8 px-4 sm:px-6 lg:px-8 border-b border-[#002840]">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-xs font-semibold text-[#8FE2FF] mb-2 border border-white/15">
                            <Stethoscope size={15} weight="duotone" />
                            <span>Hồ Sơ Sức Khỏe Cá Nhân (PHR / EMR)</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight">
                            Sổ Bệnh Án & Đơn Thuốc Điện Tử
                        </h1>
                        <p className="text-sm text-cyan-100/90 mt-1">
                            Tra cứu chi tiết kết quả khám, đơn thuốc 4 cữ trong ngày, xét nghiệm cận lâm sàng và lịch tái khám.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            to="/dat-lich"
                            className="inline-flex items-center gap-2 bg-[#00B5F1] hover:bg-[#009fd4] text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-md transition"
                        >
                            <CalendarCheck size={18} weight="bold" />
                            <span>Đặt khám mới</span>
                        </Link>
                        <button
                            onClick={handlePrintRecord}
                            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-3.5 py-2.5 rounded-xl border border-white/20 transition cursor-pointer"
                            title="In sổ khám bệnh"
                        >
                            <Printer size={18} weight="duotone" />
                            <span className="hidden sm:inline">In hồ sơ</span>
                        </button>
                    </div>
                </div>

                {/* Switch Family Profile */}
                <div className="max-w-7xl mx-auto mt-6 pt-4 border-t border-white/15 flex items-center gap-3 overflow-x-auto pb-1">
                    <span className="text-xs text-cyan-200 font-semibold uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                        <Users size={15} /> Người bệnh:
                    </span>
                    <button
                        onClick={() => setActiveFamilyMember('self')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
                            activeFamilyMember === 'self'
                                ? 'bg-[#00B5F1] text-white shadow-sm'
                                : 'bg-white/10 text-white/90 hover:bg-white/20'
                        }`}
                    >
                        <User size={13} /> Nguyễn Văn An (Bản thân - 36 tuổi)
                    </button>
                    <button
                        onClick={() => {
                            setActiveFamilyMember('con')
                            toast.info('Hồ sơ bé Nguyễn Minh Khang chưa có ca khám mới trong tháng này.')
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
                            activeFamilyMember === 'con'
                                ? 'bg-[#00B5F1] text-white shadow-sm'
                                : 'bg-white/10 text-white/90 hover:bg-white/20'
                        }`}
                    >
                        Nguyễn Minh Khang (Con - 5 tuổi)
                    </button>
                    <button
                        onClick={() => {
                            setActiveFamilyMember('bo')
                            toast.info('Hồ sơ cụ Nguyễn Văn Hùng chưa có ca khám mới trong tháng này.')
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
                            activeFamilyMember === 'bo'
                                ? 'bg-[#00B5F1] text-white shadow-sm'
                                : 'bg-white/10 text-white/90 hover:bg-white/20'
                        }`}
                    >
                        Nguyễn Văn Hùng (Bố - 68 tuổi)
                    </button>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left: Timeline of Medical Encounters */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                                <h2 className="font-bold text-[#003553] text-sm flex items-center gap-2">
                                    <Clock size={16} className="text-[#00B5F1]" />
                                    <span>Lịch sử Khám bệnh ({records.length})</span>
                                </h2>
                                <span className="text-[11px] font-semibold text-slate-500">Mới nhất trước</span>
                            </div>

                            <div className="space-y-3">
                                {records.map((rec) => {
                                    const isSelected = rec.id === currentRecord.id
                                    return (
                                        <div
                                            key={rec.id}
                                            onClick={() => setSelectedRecordId(rec.id)}
                                            className={`p-3.5 rounded-xl border transition cursor-pointer text-left ${
                                                isSelected
                                                    ? 'border-[#00B5F1] bg-[#F0F9FF] shadow-xs'
                                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between text-xs mb-1.5">
                                                <span className="font-extrabold text-[#003553]">{rec.ngayKham}</span>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    Đã hoàn thành
                                                </span>
                                            </div>
                                            <div className="font-bold text-sm text-[#003553] truncate">
                                                {rec.chuyenKhoa}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate mt-0.5">
                                                {rec.bacSi} • {rec.phongKham}
                                            </div>
                                            <div className="text-[11px] text-[#007CA8] font-mono mt-1.5 flex items-center justify-between">
                                                <span>Mã KCB: {rec.maKcb}</span>
                                                <CaretRight size={13} className={isSelected ? 'text-[#00B5F1]' : 'text-slate-400'} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Quick Tips Box */}
                        <div className="bg-gradient-to-br from-[#E8F4FD] to-[#F0F9FF] border border-[#B8E5FA] rounded-2xl p-4 text-xs text-[#003553] space-y-2">
                            <div className="font-bold flex items-center gap-1.5 text-[#0088BA]">
                                <Sparkle size={15} weight="fill" />
                                <span>Lời khuyên Bác sĩ số hóa</span>
                            </div>
                            <p className="text-slate-600 leading-relaxed">
                                Đơn thuốc điện tử tại Clinic-AI đồng bộ trực tiếp với Cổng Đơn thuốc Quốc gia. Bạn có thể xuất trình mã đơn thuốc khi mua tại bất kỳ nhà thuốc nào trên toàn quốc.
                            </p>
                        </div>
                    </div>

                    {/* Right: Detailed Encounter Card */}
                    <div className="lg:col-span-8 space-y-5">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                            {/* Record Header Meta */}
                            <div className="p-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono font-bold bg-[#E8F4FD] text-[#007CA8] px-2.5 py-1 rounded-md border border-[#B8E5FA]">
                                            {currentRecord.maKcb}
                                        </span>
                                        <span className="text-xs text-slate-500 font-medium">
                                            Khám ngày {currentRecord.ngayKham} lúc {currentRecord.gioKham}
                                        </span>
                                    </div>
                                    <h2 className="text-lg font-bold text-[#003553] mt-1.5 flex items-center gap-2">
                                        <span>{currentRecord.chuyenKhoa}</span>
                                        <span className="text-xs font-normal text-slate-500">({currentRecord.phongKham})</span>
                                    </h2>
                                    <p className="text-xs text-slate-600 mt-0.5">
                                        Bác sĩ điều trị: <strong className="text-[#003553]">{currentRecord.bacSi}</strong>
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    {currentRecord.danhGia ? (
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                                            <span>⭐ {currentRecord.danhGia.diemSo}/5 sao</span>
                                            <span className="text-[10px] text-amber-600 font-normal">(Đã đánh giá)</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleOpenRating}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-amber-950 text-xs font-bold shadow-xs transition cursor-pointer"
                                        >
                                            <span>⭐ Đánh giá lượt khám</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Sub Tabs */}
                            <div className="flex border-b border-slate-200 bg-slate-50/50 px-4 gap-2 text-xs font-bold overflow-x-auto">
                                <button
                                    onClick={() => setActiveTab('tong_quan')}
                                    className={`py-3 px-3.5 border-b-2 transition shrink-0 cursor-pointer ${
                                        activeTab === 'tong_quan'
                                            ? 'border-[#00B5F1] text-[#0088BA]'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Chẩn đoán & Sinh hiệu
                                </button>
                                <button
                                    onClick={() => setActiveTab('don_thuoc')}
                                    className={`py-3 px-3.5 border-b-2 transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                                        activeTab === 'don_thuoc'
                                            ? 'border-[#00B5F1] text-[#0088BA]'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <Pill size={15} />
                                    <span>Đơn thuốc 4 cữ ({currentRecord.donThuoc.danhSachThuoc.length})</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('can_lam_sang')}
                                    className={`py-3 px-3.5 border-b-2 transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                                        activeTab === 'can_lam_sang'
                                            ? 'border-[#00B5F1] text-[#0088BA]'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <Microscope size={15} />
                                    <span>Cận lâm sàng & Xét nghiệm ({currentRecord.canLamSang.length})</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('tai_kham')}
                                    className={`py-3 px-3.5 border-b-2 transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                                        activeTab === 'tai_kham'
                                            ? 'border-[#00B5F1] text-[#0088BA]'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <CalendarCheck size={15} />
                                    <span>Hẹn tái khám</span>
                                </button>
                            </div>

                            {/* Tab 1: Tổng quan & Chẩn đoán */}
                            {activeTab === 'tong_quan' && (
                                <div className="p-5 space-y-6">
                                    {/* Lý do khám & Bệnh sử */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Lý do vào viện</span>
                                            <p className="text-sm font-semibold text-[#003553] mt-1">{currentRecord.lyDoKham}</p>
                                        </div>
                                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Tiền sử bệnh</span>
                                            <p className="text-sm font-semibold text-[#003553] mt-1">{currentRecord.tienSu}</p>
                                        </div>
                                    </div>

                                    {/* Sinh hiệu */}
                                    <div>
                                        <h3 className="text-xs font-bold text-[#003553] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                            <Heartbeat size={15} className="text-rose-500" />
                                            <span>Chỉ số Sinh hiệu lúc tiếp đón</span>
                                        </h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-center">
                                            <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
                                                <div className="text-[10px] text-rose-700 font-bold">Huyết áp</div>
                                                <div className="text-sm font-extrabold text-rose-900 mt-0.5">{currentRecord.sinhHieu.huyetAp}</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-sky-50/60 border border-sky-100">
                                                <div className="text-[10px] text-sky-700 font-bold">Mạch</div>
                                                <div className="text-sm font-extrabold text-sky-900 mt-0.5">{currentRecord.sinhHieu.mach}</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
                                                <div className="text-[10px] text-amber-700 font-bold">Nhiệt độ</div>
                                                <div className="text-sm font-extrabold text-amber-900 mt-0.5">{currentRecord.sinhHieu.nhietDo}</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-100">
                                                <div className="text-[10px] text-teal-700 font-bold">SpO2</div>
                                                <div className="text-sm font-extrabold text-teal-900 mt-0.5">{currentRecord.sinhHieu.spo2}</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100">
                                                <div className="text-[10px] text-indigo-700 font-bold">Cân nặng</div>
                                                <div className="text-sm font-extrabold text-indigo-900 mt-0.5">{currentRecord.sinhHieu.canNang}</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                                                <div className="text-[10px] text-emerald-700 font-bold">BMI</div>
                                                <div className="text-sm font-extrabold text-emerald-900 mt-0.5">{currentRecord.sinhHieu.bmi}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Chẩn đoán ICD-10 */}
                                    <div className="p-4 rounded-xl bg-[#E8F4FD]/50 border border-[#B8E5FA] space-y-2.5">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-md bg-[#00B5F1] text-white text-[11px] font-extrabold">
                                                ICD-10 Chính
                                            </span>
                                            <span className="font-bold text-sm text-[#003553]">{currentRecord.chanDoan.icd10Chinh}</span>
                                        </div>
                                        {currentRecord.chanDoan.icd10Phu && (
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-bold">
                                                    Kèm theo
                                                </span>
                                                <span className="text-slate-700">{currentRecord.chanDoan.icd10Phu}</span>
                                            </div>
                                        )}
                                        <div className="pt-2 border-t border-[#B8E5FA] text-xs text-slate-700">
                                            <strong className="text-[#003553]">Kết luận điều trị: </strong>
                                            {currentRecord.chanDoan.ketLuan}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tab 2: Đơn thuốc 4 Cữ Chuẩn tClinic */}
                            {activeTab === 'don_thuoc' && (
                                <div className="p-5 space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                                        <div>
                                            <span className="text-xs font-mono font-bold text-[#0088BA]">
                                                Mã đơn thuốc: {currentRecord.donThuoc.maDon}
                                            </span>
                                            <span className="ml-2 text-xs text-slate-500">
                                                (Số ngày điều trị: <strong>{currentRecord.donThuoc.soNgayDung} ngày</strong>)
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                                            ⚠️ <strong>Lời dặn:</strong> {currentRecord.donThuoc.loiDanChung}
                                        </div>
                                    </div>

                                    {/* 4-dosage table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100 text-[#003553] border-b border-slate-200">
                                                    <th className="p-2.5 font-bold">Tên thuốc & Hàm lượng</th>
                                                    <th className="p-2.5 font-bold text-center">ĐVT</th>
                                                    <th className="p-2.5 font-bold text-center">SL</th>
                                                    <th className="p-2.5 font-bold text-center bg-amber-50 text-amber-900">Sáng</th>
                                                    <th className="p-2.5 font-bold text-center bg-amber-50 text-amber-900">Trưa</th>
                                                    <th className="p-2.5 font-bold text-center bg-orange-50 text-orange-900">Chiều</th>
                                                    <th className="p-2.5 font-bold text-center bg-indigo-50 text-indigo-900">Tối</th>
                                                    <th className="p-2.5 font-bold">Cách dùng chi tiết</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {currentRecord.donThuoc.danhSachThuoc.map((med, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                                                        <td className="p-2.5 font-bold text-[#003553]">{med[0]}</td>
                                                        <td className="p-2.5 text-center text-slate-600">{med[1]}</td>
                                                        <td className="p-2.5 text-center font-bold text-[#0088BA]">{med[2]}</td>
                                                        <td className="p-2.5 text-center font-bold bg-amber-50/50">{med[3]}</td>
                                                        <td className="p-2.5 text-center font-bold bg-amber-50/50">{med[4]}</td>
                                                        <td className="p-2.5 text-center font-bold bg-orange-50/50">{med[5]}</td>
                                                        <td className="p-2.5 text-center font-bold bg-indigo-50/50">{med[6]}</td>
                                                        <td className="p-2.5 text-slate-600 font-medium">{med[7]}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Tab 3: Cận lâm sàng & Xét nghiệm */}
                            {activeTab === 'can_lam_sang' && (
                                <div className="p-5 space-y-4">
                                    {currentRecord.canLamSang.map((cls) => (
                                        <div key={cls.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                                <div>
                                                    <div className="text-xs font-mono text-[#0088BA] font-bold">{cls.id}</div>
                                                    <h4 className="text-sm font-bold text-[#003553]">{cls.tenDichVu}</h4>
                                                </div>
                                                <span className="text-[11px] text-slate-500 font-medium">
                                                    Kết quả lúc: {cls.ngayCoKetQua}
                                                </span>
                                            </div>

                                            {/* Table indicators if lab test */}
                                            {cls.chiTiet && (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-xs text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-slate-50 text-slate-600">
                                                                <th className="p-2 font-bold">Chỉ số xét nghiệm</th>
                                                                <th className="p-2 font-bold text-center">Kết quả</th>
                                                                <th className="p-2 font-bold text-center">Đơn vị</th>
                                                                <th className="p-2 font-bold text-center">Khoảng tham chiếu</th>
                                                                <th className="p-2 font-bold text-center">Đánh giá</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {cls.chiTiet.map((item, idx) => (
                                                                <tr key={idx}>
                                                                    <td className="p-2 font-semibold text-[#003553]">{item.chiSo}</td>
                                                                    <td className="p-2 text-center font-bold text-[#003553]">{item.ketQua}</td>
                                                                    <td className="p-2 text-center text-slate-500">{item.donVi}</td>
                                                                    <td className="p-2 text-center text-slate-500">{item.thamChieu}</td>
                                                                    <td className="p-2 text-center">
                                                                        {item.trangThai === 'high' ? (
                                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                                                                Cao ↑
                                                                            </span>
                                                                        ) : (
                                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                                                                Bình thường
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            {/* Imaging PACS preview */}
                                            {cls.hinhAnhUrl && (
                                                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                    <img
                                                        src={cls.hinhAnhUrl}
                                                        alt={cls.tenDichVu}
                                                        className="w-32 h-24 object-cover rounded-lg border border-slate-300"
                                                    />
                                                    <div className="text-xs space-y-1">
                                                        <span className="font-bold text-[#003553] flex items-center gap-1">
                                                            <Scan size={14} className="text-[#00B5F1]" />
                                                            <span>Hình ảnh Chẩn đoán số hóa</span>
                                                        </span>
                                                        <p className="text-slate-600">Đã lưu trữ trên hệ thống PACS nội bộ của Clinic-AI.</p>
                                                        <a
                                                            href={cls.hinhAnhUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-[#00B5F1] hover:underline font-bold"
                                                        >
                                                            <Eye size={13} />
                                                            <span>Xem ảnh độ phân giải cao</span>
                                                        </a>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                                <strong className="text-[#003553]">Kết luận chuyên môn: </strong>
                                                <span className="text-slate-700">{cls.ketLuan}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Tab 4: Tái khám & Dặn dò */}
                            {activeTab === 'tai_kham' && (
                                <div className="p-5 space-y-5">
                                    <div className="p-5 rounded-2xl bg-gradient-to-br from-[#E8F4FD] to-white border border-[#B8E5FA] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <span className="text-xs font-bold text-[#0088BA] uppercase tracking-wider">
                                                Lịch hẹn tái khám theo chỉ định
                                            </span>
                                            <h4 className="text-2xl font-extrabold text-[#003553] flex items-center gap-2">
                                                <CalendarCheck size={26} className="text-[#00B5F1]" />
                                                <span>{currentRecord.taiKham.ngayHen}</span>
                                            </h4>
                                            <p className="text-xs text-slate-600">
                                                Khoa: <strong>{currentRecord.chuyenKhoa}</strong> • Bác sĩ: <strong>{currentRecord.bacSi}</strong>
                                            </p>
                                        </div>

                                        <Link
                                            to="/dat-lich"
                                            className="inline-flex items-center gap-2 bg-[#00B5F1] hover:bg-[#009fd4] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition"
                                        >
                                            <span>Đặt lịch đúng ngày hẹn này</span>
                                            <ArrowRight size={14} weight="bold" />
                                        </Link>
                                    </div>

                                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                                        <strong className="font-bold flex items-center gap-1.5 text-amber-800">
                                            <WarningCircle size={15} weight="fill" />
                                            <span>Lời dặn dò chuyên biệt từ Bác sĩ:</span>
                                        </strong>
                                        <p className="leading-relaxed">{currentRecord.taiKham.loiDanTaiKham}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Đánh giá Dịch vụ 5 Sao */}
            {ratingModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                        <div className="text-center space-y-2 mb-5">
                            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-2xl">
                                ⭐
                            </div>
                            <h3 className="text-lg font-bold text-[#003553]">Đánh Giá Lượt Khám</h3>
                            <p className="text-xs text-slate-500">
                                Bác sĩ {currentRecord.bacSi} • {currentRecord.chuyenKhoa}
                            </p>
                        </div>

                        <form onSubmit={handleSubmitRating} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2 text-center">
                                    Mức độ hài lòng của bạn
                                </label>
                                <div className="flex items-center justify-center gap-2 text-3xl">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            type="button"
                                            key={star}
                                            onClick={() => setRatingScore(star)}
                                            className={`transition transform hover:scale-110 cursor-pointer ${
                                                star <= ratingScore ? 'opacity-100' : 'opacity-25 grayscale'
                                            }`}
                                        >
                                            ⭐
                                        </button>
                                    ))}
                                </div>
                                <div className="text-center text-xs font-bold text-amber-600 mt-1">
                                    {ratingScore === 5 && 'Tuyệt vời, rất hài lòng'}
                                    {ratingScore === 4 && 'Hài lòng, dịch vụ tốt'}
                                    {ratingScore === 3 && 'Bình thường'}
                                    {ratingScore === 2 && 'Chưa hài lòng'}
                                    {ratingScore === 1 && 'Rất không hài lòng'}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Ý kiến đóng góp (tùy chọn)
                                </label>
                                <textarea
                                    value={ratingComment}
                                    onChange={(e) => setRatingComment(e.target.value)}
                                    rows={3}
                                    placeholder="Chia sẻ trải nghiệm về thái độ bác sĩ, thời gian chờ hoặc cơ sở phòng khám..."
                                    className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setRatingModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                >
                                    Để sau
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl text-xs font-bold bg-[#00B5F1] hover:bg-[#009fd4] text-white shadow-sm transition cursor-pointer"
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
