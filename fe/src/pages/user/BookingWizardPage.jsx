import { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
    CalendarPlus,
    User,
    Users,
    Clock,
    CheckCircle,
    ArrowRight,
    ArrowLeft,
    Sparkle,
    Hospital,
    QrCode,
    ShieldCheck,
    Stethoscope,
    PhoneCall,
    WarningCircle
} from '../../components/common/ClinicIcon'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'

const SPECIALTIES = [
    { id: 'noi', name: 'Khoa Nội Tổng Quát', room: 'Phòng 101', icon: '🩺', desc: 'Khám tim mạch, hô hấp, tiêu hóa, gan mật, đái tháo đường' },
    { id: 'ngoai', name: 'Khoa Ngoại', room: 'Phòng 102', icon: '🩹', desc: 'Tiểu phẫu, vết thương phần mềm, chấn thương chỉnh hình' },
    { id: 'nhi', name: 'Khoa Nhi', room: 'Phòng 201', icon: '👶', desc: 'Khám và tư vấn dinh dưỡng, bệnh lý hô hấp, tiêu hóa trẻ em' },
    { id: 'tmh', name: 'Khoa Tai Mũi Họng', room: 'Phòng 202', icon: '👂', desc: 'Nội soi tai mũi họng, viêm xoang, viêm họng, viêm amidan' },
    { id: 'rhm', name: 'Khoa Răng Hàm Mặt', room: 'Phòng 203', icon: '🦷', desc: 'Khám nha khoa, nhổ răng, lấy cao răng, điều trị tủy' },
    { id: 'dalieu', name: 'Khoa Da Liễu', room: 'Phòng 301', icon: '✨', desc: 'Dị ứng da, viêm da cơ địa, mụn trứng cá, nấm da' }
]

const DOCTORS = [
    { id: 1, name: 'BS.CKII Nguyễn Minh Hoàng', specialtyId: 'noi', title: 'Trưởng khoa Nội', exp: '15 năm', fee: 200000, room: 'Phòng 101' },
    { id: 2, name: 'ThS.BS Trần Mai Lan', specialtyId: 'noi', title: 'Bác sĩ Nội Tim Mạch', exp: '10 năm', fee: 200000, room: 'Phòng 101' },
    { id: 3, name: 'BS.CKI Lê Hoàng Nam', specialtyId: 'tmh', title: 'Bác sĩ Chuyên khoa TMH', exp: '12 năm', fee: 180000, room: 'Phòng 202' },
    { id: 4, name: 'ThS.BS Phạm Quỳnh Nga', specialtyId: 'nhi', title: 'Bác sĩ Nhi khoa', exp: '8 năm', fee: 180000, room: 'Phòng 201' },
    { id: 5, name: 'BS.CKI Vũ Quốc Đạt', specialtyId: 'ngoai', title: 'Bác sĩ Ngoại khoa', exp: '14 năm', fee: 200000, room: 'Phòng 102' },
    { id: 6, name: 'BS.CKI Đỗ Thanh Tùng', specialtyId: 'rhm', title: 'Nha sĩ Trưởng khoa', exp: '9 năm', fee: 150000, room: 'Phòng 203' },
    { id: 7, name: 'ThS.BS Hoàng Thị Bích', specialtyId: 'dalieu', title: 'Bác sĩ Da Liễu', exp: '11 năm', fee: 180000, room: 'Phòng 301' }
]

const TIME_SLOTS = [
    { session: 'Sáng', slots: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00'] },
    { session: 'Chiều', slots: ['13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'] }
]

export default function BookingWizardPage() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { clinicData } = useSelector((state) => state.app.admin)

    const [currentStep, setCurrentStep] = useState(1)

    // Form states
    const [selectedSpecialty, setSelectedSpecialty] = useState('')
    const [symptomInput, setSymptomInput] = useState('')
    const [aiTriageResult, setAiTriageResult] = useState(null)
    const [selectedDoctorId, setSelectedDoctorId] = useState(null)
    const [selectedDate, setSelectedDate] = useState(() => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        return tomorrow.toISOString().split('T')[0]
    })
    const [selectedTimeSlot, setSelectedTimeSlot] = useState('')

    // Patient info
    const [bookingFor, setBookingFor] = useState('self') // 'self' | 'relative'
    const [patientName, setPatientName] = useState('Nguyễn Văn An')
    const [patientPhone, setPatientPhone] = useState('0912345678')
    const [patientDob, setPatientDob] = useState('1990-05-15')
    const [patientGender, setPatientGender] = useState('Nam')
    const [relativeRelationship, setRelativeRelationship] = useState('Con')
    const [emergencyContact, setEmergencyContact] = useState('')
    const [emergencyPhone, setEmergencyPhone] = useState('')
    const [allergies, setAllergies] = useState('')
    const [reasonNote, setReasonNote] = useState('')

    // Result
    const [confirmedBooking, setConfirmedBooking] = useState(null)

    // AI Triage Simulation
    const handleRunAiTriage = () => {
        if (!symptomInput.trim()) {
            toast.warning('Vui lòng nhập triệu chứng ban đầu để AI phân luồng!')
            return
        }

        const sym = symptomInput.toLowerCase()
        let suggestedId = 'noi'
        let flag = 'Theo dõi thường quy'

        if (sym.includes('họng') || sym.includes('tai') || sym.includes('mũi') || sym.includes('xoang')) {
            suggestedId = 'tmh'
        } else if (sym.includes('bé') || sym.includes('trẻ') || sym.includes('sốt mọc răng')) {
            suggestedId = 'nhi'
        } else if (sym.includes('răng') || sym.includes('nướu') || sym.includes('tủy')) {
            suggestedId = 'rhm'
        } else if (sym.includes('da') || sym.includes('mẩn') || sym.includes('ngứa') || sym.includes('mụn')) {
            suggestedId = 'dalieu'
        } else if (sym.includes('ngực') || sym.includes('khó thở') || sym.includes('chóng mặt')) {
            suggestedId = 'noi'
            flag = '⚠️ Cảnh báo an toàn: Triệu chứng đau tức ngực cần ưu tiên thăm khám sớm'
        }

        setSelectedSpecialty(suggestedId)
        const specObj = SPECIALTIES.find(s => s.id === suggestedId)
        setAiTriageResult({
            suggestedName: specObj?.name,
            confidence: '94%',
            safetyFlag: flag
        })
        toast.success(`AI gợi ý: ${specObj?.name}!`)
    }

    // Step navigation
    const handleNextStep = () => {
        if (currentStep === 1) {
            if (!selectedSpecialty) {
                toast.warning('Vui lòng chọn Chuyên khoa khám bệnh!')
                return
            }
        }
        if (currentStep === 2) {
            if (!selectedDoctorId) {
                toast.warning('Vui lòng chọn Bác sĩ phụ trách!')
                return
            }
            if (!selectedTimeSlot) {
                toast.warning('Vui lòng chọn Khung giờ khám!')
                return
            }
        }
        if (currentStep === 3) {
            if (!patientName.trim() || !patientPhone.trim()) {
                toast.warning('Vui lòng điền đầy đủ Họ tên và Số điện thoại người khám!')
                return
            }
        }
        if (currentStep === 4) {
            // Confirm booking
            const randomCode = `LK-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`
            const doc = DOCTORS.find(d => d.id === selectedDoctorId)
            const spec = SPECIALTIES.find(s => s.id === selectedSpecialty)

            const newBooking = {
                id: Date.now(),
                code: randomCode,
                patientName: patientName.trim(),
                patientPhone: patientPhone.trim(),
                bookingFor,
                relationship: bookingFor === 'relative' ? relativeRelationship : 'Bản thân',
                doctorName: doc?.name,
                doctorFee: doc?.fee,
                specialtyName: spec?.name,
                room: doc?.room || spec?.room,
                date: selectedDate,
                timeSlot: selectedTimeSlot,
                reason: reasonNote || symptomInput || 'Khám tổng quát',
                allergies,
                emergencyContact: emergencyContact || (bookingFor === 'relative' ? patientName : 'Người nhà'),
                emergencyPhone: emergencyPhone || patientPhone,
                status: 'DA_XAC_NHAN'
            }

            // Save to Redux store
            const newAppointmentRecord = {
                id: String(newBooking.id),
                maLH: newBooking.code,
                maBN: `BN0000${150 + (clinicData?.appointments?.length || 0) + 1}`,
                hoTen: newBooking.patientName,
                soDienThoai: newBooking.patientPhone,
                bacSi: newBooking.doctorName,
                chuyenKhoa: newBooking.specialtyName,
                buongKham: newBooking.room,
                ngayKham: newBooking.date,
                gioKham: newBooking.timeSlot,
                lyDoKham: newBooking.reason,
                trangThai: 'Chờ xác nhận'
            }
            const updatedAppointments = [newAppointmentRecord, ...(clinicData?.appointments || [])]
            dispatch(updateClinicCollectionAsync({ collectionKey: 'appointments', data: updatedAppointments }))

            setConfirmedBooking(newBooking)
            toast.success('Đặt lịch khám thành công!')
        }

        setCurrentStep(prev => prev + 1)
    }

    const filteredDoctors = DOCTORS.filter(d => !selectedSpecialty || d.specialtyId === selectedSpecialty)
    const currentDoctor = DOCTORS.find(d => d.id === selectedDoctorId)
    const currentSpecialty = SPECIALTIES.find(s => s.id === selectedSpecialty)

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Breadcrumb & Header */}
            <div>
                <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                    <Link to="/" className="hover:text-[#00B5F1]">Trang chủ</Link>
                    <span>/</span>
                    <span className="text-[#003553]">Đặt lịch khám trực tuyến</span>
                </nav>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#003553] tracking-tight">
                            ĐẶT LỊCH KHÁM BỆNH TRỰC TUYẾN
                        </h1>
                        <p className="text-sm text-slate-600 mt-1">
                            Quy trình chuẩn Medpro.vn tích hợp AI Triage phân luồng chuyên khoa thông minh
                        </p>
                    </div>
                    <div className="inline-flex items-center gap-2 bg-[#E8F4FD] text-[#00B5F1] px-3.5 py-1.5 rounded-full border border-[#B8E5FA] text-xs font-bold">
                        <ShieldCheck size={16} weight="duotone" />
                        <span>Đặt khám an toàn & Bảo mật y tế</span>
                    </div>
                </div>
            </div>

            {/* Step Wizard Indicator */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#E2EDF5] shadow-xs">
                <div className="grid grid-cols-5 gap-2 text-center text-xs font-bold">
                    {[
                        { step: 1, title: 'Chuyên khoa & AI' },
                        { step: 2, title: 'Bác sĩ & Giờ khám' },
                        { step: 3, title: 'Hồ sơ người khám' },
                        { step: 4, title: 'Triệu chứng & Dị ứng' },
                        { step: 5, title: 'Phiếu đặt hẹn' }
                    ].map((s) => {
                        const isActive = currentStep === s.step
                        const isDone = currentStep > s.step
                        return (
                            <div key={s.step} className="flex flex-col items-center gap-2">
                                <div
                                    className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-sm transition ${
                                        isActive
                                            ? 'bg-[#00B5F1] text-white ring-4 ring-[#E8F4FD]'
                                            : isDone
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-slate-100 text-slate-400'
                                    }`}
                                >
                                    {isDone ? <CheckCircle size={18} weight="bold" /> : s.step}
                                </div>
                                <span className={`hidden sm:inline ${isActive ? 'text-[#003553]' : isDone ? 'text-emerald-700' : 'text-slate-400'}`}>
                                    {s.title}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Step 1: Chọn Chuyên khoa & AI Triage */}
            {currentStep === 1 && (
                <div className="space-y-6">
                    {/* AI Triage Card */}
                    <div className="bg-gradient-to-r from-[#003553] to-[#004E7A] text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
                        <div className="max-w-2xl space-y-3 relative z-10">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold uppercase tracking-wider text-[#FFB54A]">
                                <Sparkle size={15} weight="fill" />
                                <span>Trợ lý AI Specialty Triage (Tư vấn phân luồng)</span>
                            </span>
                            <h2 className="text-xl font-bold">Bạn chưa rõ nên khám chuyên khoa nào?</h2>
                            <p className="text-xs text-sky-100">
                                Hãy mô tả biểu hiện khó chịu ban đầu. Thuật toán AI y khoa sẽ đề xuất chuyên khoa phù hợp nhất.
                            </p>
                            <div className="flex gap-2 pt-1">
                                <input
                                    type="text"
                                    value={symptomInput}
                                    onChange={(e) => setSymptomInput(e.target.value)}
                                    placeholder="Ví dụ: Đau tức ngực trái từng cơn, ho rát họng 3 ngày nay..."
                                    className="flex-1 bg-white/10 text-white placeholder-sky-200/70 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                                    onKeyDown={(e) => e.key === 'Enter' && handleRunAiTriage()}
                                />
                                <button
                                    onClick={handleRunAiTriage}
                                    className="bg-[#FFB54A] hover:bg-[#FBA342] text-[#003553] font-extrabold px-5 py-2 rounded-xl text-sm transition shadow-sm cursor-pointer flex items-center gap-1.5"
                                >
                                    <Sparkle size={16} weight="bold" />
                                    <span>AI Gợi ý</span>
                                </button>
                            </div>

                            {aiTriageResult && (
                                <div className="mt-3 bg-white/15 border border-white/20 rounded-xl p-3 text-xs space-y-1">
                                    <p className="font-bold text-[#FFB54A]">
                                        ✨ Chuyên khoa đề xuất: <span className="underline">{aiTriageResult.suggestedName}</span> (Độ tin cậy: {aiTriageResult.confidence})
                                    </p>
                                    <p className="text-slate-100">{aiTriageResult.safetyFlag}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Danh sách Chuyên khoa */}
                    <div>
                        <h3 className="text-base font-extrabold text-[#003553] mb-4">
                            HOẶC CHỌN TRỰC TIẾP CHUYÊN KHOA DƯỚI ĐÂY:
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {SPECIALTIES.map((spec) => {
                                const isSelected = selectedSpecialty === spec.id
                                return (
                                    <button
                                        key={spec.id}
                                        type="button"
                                        onClick={() => setSelectedSpecialty(spec.id)}
                                        className={`text-left p-5 rounded-2xl border transition-all cursor-pointer ${
                                            isSelected
                                                ? 'bg-[#E8F4FD] border-[#00B5F1] ring-2 ring-[#00B5F1] shadow-md'
                                                : 'bg-white border-slate-200 hover:border-[#00B5F1] hover:shadow-sm'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="text-3xl">{spec.icon}</span>
                                            <div>
                                                <h4 className="font-extrabold text-[#003553] text-sm">{spec.name}</h4>
                                                <span className="text-[11px] font-semibold text-[#00B5F1] block mb-1">{spec.room}</span>
                                                <p className="text-xs text-slate-500 line-clamp-2">{spec.desc}</p>
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Chọn Bác sĩ & Giờ khám */}
            {currentStep === 2 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Danh sách Bác sĩ */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-extrabold text-[#003553]">
                                CHỌN BÁC SĨ PHỤ TRÁCH ({currentSpecialty?.name || 'Tất cả'})
                            </h3>
                            <button
                                onClick={() => setSelectedSpecialty('')}
                                className="text-xs text-[#00B5F1] font-semibold hover:underline"
                            >
                                Đổi chuyên khoa
                            </button>
                        </div>

                        <div className="space-y-3">
                            {filteredDoctors.map((doc) => {
                                const isSelected = selectedDoctorId === doc.id
                                return (
                                    <div
                                        key={doc.id}
                                        onClick={() => setSelectedDoctorId(doc.id)}
                                        className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition ${
                                            isSelected
                                                ? 'bg-[#E8F4FD] border-[#00B5F1] ring-2 ring-[#00B5F1]'
                                                : 'bg-white border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-[#00B5F1] font-extrabold text-lg">
                                                <Stethoscope size={24} weight="duotone" />
                                            </div>
                                            <div>
                                                <h4 className="font-extrabold text-[#003553] text-sm">{doc.name}</h4>
                                                <p className="text-xs text-slate-500">{doc.title} • Kinh nghiệm: {doc.exp}</p>
                                                <span className="text-[11px] font-semibold text-emerald-600">{doc.room}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-slate-400 block">Giá khám niêm yết:</span>
                                            <span className="font-extrabold text-base text-[#003553]">{doc.fee.toLocaleString('vi-VN')} đ</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Chọn Ngày & Slot Giờ */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-5">
                        <h3 className="text-sm font-extrabold text-[#003553] uppercase flex items-center gap-2">
                            <Clock size={18} weight="duotone" className="text-[#00B5F1]" />
                            <span>CHỌN THỜI GIAN KHÁM</span>
                        </h3>

                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">Ngày khám:</label>
                            <input
                                type="date"
                                value={selectedDate}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                            />
                        </div>

                        <div className="space-y-4">
                            {TIME_SLOTS.map((grp) => (
                                <div key={grp.session}>
                                    <span className="text-xs font-extrabold text-slate-500 block mb-2">Ca {grp.session}:</span>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {grp.slots.map((slot) => {
                                            const isSelected = selectedTimeSlot === slot
                                            return (
                                                <button
                                                    key={slot}
                                                    type="button"
                                                    onClick={() => setSelectedTimeSlot(slot)}
                                                    className={`py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-[#00B5F1] text-white border-[#00B5F1]'
                                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                                    }`}
                                                >
                                                    {slot}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Chọn Hồ sơ người khám */}
            {currentStep === 3 && (
                <div className="max-w-2xl mx-auto bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
                    <h3 className="text-lg font-extrabold text-[#003553] border-b border-slate-100 pb-3">
                        CHỌN HỒ SƠ NGƯỜI ĐI KHÁM
                    </h3>

                    {/* Radio: Self vs Relative */}
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => {
                                setBookingFor('self')
                                setPatientName('Nguyễn Văn An')
                                setPatientPhone('0912345678')
                            }}
                            className={`p-4 rounded-xl border text-center font-bold text-sm flex flex-col items-center gap-2 cursor-pointer transition ${
                                bookingFor === 'self'
                                    ? 'bg-[#E8F4FD] border-[#00B5F1] text-[#003553] ring-2 ring-[#00B5F1]'
                                    : 'bg-white border-slate-200 text-slate-600'
                            }`}
                        >
                            <User size={24} weight="duotone" className="text-[#00B5F1]" />
                            <span>Đặt cho Bản Thân</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setBookingFor('relative')
                                setPatientName('')
                                setPatientPhone('0912345678')
                            }}
                            className={`p-4 rounded-xl border text-center font-bold text-sm flex flex-col items-center gap-2 cursor-pointer transition ${
                                bookingFor === 'relative'
                                    ? 'bg-[#E8F4FD] border-[#00B5F1] text-[#003553] ring-2 ring-[#00B5F1]'
                                    : 'bg-white border-slate-200 text-slate-600'
                            }`}
                        >
                            <Users size={24} weight="duotone" className="text-[#00B5F1]" />
                            <span>Đặt cho Người Thân</span>
                        </button>
                    </div>

                    <div className="space-y-4 pt-2">
                        {bookingFor === 'relative' && (
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">Mối quan hệ với chủ tài khoản:</label>
                                <select
                                    value={relativeRelationship}
                                    onChange={(e) => setRelativeRelationship(e.target.value)}
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                                >
                                    <option value="Con">Con nhỏ / Con cái</option>
                                    <option value="Bố/Mẹ">Bố / Mẹ</option>
                                    <option value="Vợ/Chồng">Vợ / Chồng</option>
                                    <option value="Khác">Người thân khác</option>
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">Họ và tên người đi khám (*):</label>
                            <input
                                type="text"
                                value={patientName}
                                onChange={(e) => setPatientName(e.target.value)}
                                placeholder="Nhập đầy đủ họ tên có dấu"
                                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">Ngày sinh:</label>
                                <input
                                    type="date"
                                    value={patientDob}
                                    onChange={(e) => setPatientDob(e.target.value)}
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">Giới tính:</label>
                                <select
                                    value={patientGender}
                                    onChange={(e) => setPatientGender(e.target.value)}
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                                >
                                    <option value="Nam">Nam</option>
                                    <option value="Nữ">Nữ</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">Số điện thoại liên hệ (*):</label>
                            <input
                                type="tel"
                                value={patientPhone}
                                onChange={(e) => setPatientPhone(e.target.value)}
                                placeholder="09xxxxxxxx"
                                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Step 4: Triệu chứng & Thông tin lâm sàng bổ sung */}
            {currentStep === 4 && (
                <div className="max-w-2xl mx-auto bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
                    <h3 className="text-lg font-extrabold text-[#003553] border-b border-slate-100 pb-3">
                        THÔNG TIN LÂM SÀNG BỔ SUNG & KHẨN CẤP
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">Lý do vào khám / Triệu chứng chính:</label>
                            <textarea
                                rows={3}
                                value={reasonNote}
                                onChange={(e) => setReasonNote(e.target.value)}
                                placeholder="Mô tả cụ thể triệu chứng hiện tại để bác sĩ chuẩn bị trước..."
                                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-amber-700 flex items-center gap-1 mb-1">
                                <WarningCircle size={15} weight="bold" />
                                <span>Tiền sử dị ứng thuốc / thức ăn (nếu có):</span>
                            </label>
                            <input
                                type="text"
                                value={allergies}
                                onChange={(e) => setAllergies(e.target.value)}
                                placeholder="Ví dụ: Dị ứng Penicillin, Aspirin, hải sản..."
                                className="w-full border border-amber-200 bg-amber-50/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">Người liên hệ khẩn cấp:</label>
                                <input
                                    type="text"
                                    value={emergencyContact}
                                    onChange={(e) => setEmergencyContact(e.target.value)}
                                    placeholder="Họ tên thân nhân"
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">SĐT người liên hệ khẩn cấp:</label>
                                <input
                                    type="tel"
                                    value={emergencyPhone}
                                    onChange={(e) => setEmergencyPhone(e.target.value)}
                                    placeholder="09xxxxxxxx"
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 5: Phiếu đặt hẹn thành công */}
            {currentStep === 5 && confirmedBooking && (
                <div className="max-w-xl mx-auto space-y-6">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-emerald-500 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[11px] font-extrabold uppercase px-4 py-1 rounded-bl-xl">
                            Đã xác nhận
                        </div>

                        <div className="text-center space-y-2 mb-6">
                            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle size={32} weight="fill" />
                            </div>
                            <h2 className="text-xl font-extrabold text-[#003553]">ĐẶT LỊCH HẸN THÀNH CÔNG</h2>
                            <p className="text-xs text-slate-500">Mã phiếu hẹn khám điện tử tại phòng khám Clinic-AI</p>
                        </div>

                        <div className="bg-[#E8F4FD] rounded-2xl p-4 border border-[#B8E5FA] text-center mb-6">
                            <span className="text-xs text-slate-500 font-bold block">MÃ LỊCH HẸN</span>
                            <span className="text-2xl font-black text-[#00B5F1] tracking-wider">{confirmedBooking.code}</span>
                        </div>

                        <div className="space-y-3 text-xs divide-y divide-slate-100">
                            <div className="flex justify-between pt-2">
                                <span className="text-slate-500">Người khám:</span>
                                <span className="font-bold text-slate-800">{confirmedBooking.patientName} ({confirmedBooking.relationship})</span>
                            </div>
                            <div className="flex justify-between pt-2">
                                <span className="text-slate-500">Bác sĩ:</span>
                                <span className="font-bold text-slate-800">{confirmedBooking.doctorName}</span>
                            </div>
                            <div className="flex justify-between pt-2">
                                <span className="text-slate-500">Chuyên khoa & Buồng khám:</span>
                                <span className="font-bold text-[#00B5F1]">{confirmedBooking.specialtyName} • {confirmedBooking.room}</span>
                            </div>
                            <div className="flex justify-between pt-2">
                                <span className="text-slate-500">Thời gian khám:</span>
                                <span className="font-bold text-emerald-700">{confirmedBooking.timeSlot} — Ngày {confirmedBooking.date}</span>
                            </div>
                            <div className="flex justify-between pt-2">
                                <span className="text-slate-500">Tiền khám niêm yết:</span>
                                <span className="font-bold text-slate-800">{confirmedBooking.doctorFee.toLocaleString('vi-VN')} đ</span>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-dashed border-slate-200 text-center text-xs text-slate-500 space-y-1">
                            <p className="font-semibold text-slate-700">📌 Quý khách vui lòng đến trước giờ hẹn 15 phút tại Quầy Tiếp đón</p>
                            <p>Xuất trình mã lịch hẹn hoặc số điện thoại để lấy số thứ tự ưu tiên.</p>
                        </div>
                    </div>

                    <div className="flex justify-center gap-3">
                        <Link
                            to="/benh-nhan/benh-an"
                            className="medpro-btn-primary !py-2.5 !px-5 font-bold text-sm"
                        >
                            <span>Xem Sổ Bệnh Án & Lịch Khám</span>
                            <ArrowRight size={16} weight="bold" />
                        </Link>
                        <Link
                            to="/"
                            className="px-5 py-2.5 rounded-full border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100 transition"
                        >
                            Về Trang Chủ
                        </Link>
                    </div>
                </div>
            )}

            {/* Bottom Actions Bar (Steps 1 to 4) */}
            {currentStep < 5 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                        disabled={currentStep === 1}
                        className="px-5 py-2.5 rounded-full border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
                    >
                        <ArrowLeft size={16} weight="bold" />
                        <span>Quay lại</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleNextStep}
                        className="medpro-btn-primary !py-2.5 !px-6 font-bold text-sm flex items-center gap-2"
                    >
                        <span>{currentStep === 4 ? 'Xác nhận Đặt lịch' : 'Tiếp tục'}</span>
                        <ArrowRight size={16} weight="bold" />
                    </button>
                </div>
            )}
        </div>
    )
}
