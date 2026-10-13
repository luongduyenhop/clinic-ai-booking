import { useState } from 'react'
import { AppToast } from '../common/AppNotification'

export default function WaitingQueueTab({
    queueList = [],
    onUpdatePatientStatus,
    onCompleteExamination,
}) {
    const [selectedPatientId, setSelectedPatientId] = useState(queueList[0]?.id || null)
    const [searchKeyword, setSearchKeyword] = useState('')
    const [filterUrgency, setFilterUrgency] = useState('ALL') // ALL | URGENT | EXAMINING | WAITING

    // State form chẩn đoán & đơn thuốc của bệnh nhân đang chọn
    const [diagnosis, setDiagnosis] = useState('')
    const [selectedLabTests, setSelectedLabTests] = useState([])
    const [doctorNotes, setDoctorNotes] = useState('')
    const [prescriptions, setPrescriptions] = useState([])
    const [newMedName, setNewMedName] = useState('')
    const [newMedDosage, setNewMedDosage] = useState('')

    // Danh sách cận lâm sàng phổ biến
    const AVAILABLE_LAB_TESTS = [
        'Điện tâm đồ (ECG 12 chuyển đạo)',
        'Siêu âm tim Doppler màu',
        'Chụp X-Quang ngực thẳng',
        'Xét nghiệm công thức máu toàn phần (CBC)',
        'Định lượng Troponin T & CK-MB',
        'Sinh hóa máu (Glucose, Men gan, Creatinine)',
    ]

    // Bệnh nhân đang được chọn
    const currentPatient = queueList.find((p) => p.id === selectedPatientId) || queueList[0]

    // Lọc danh sách bệnh nhân bên trái
    const filteredQueue = queueList.filter((p) => {
        const matchesSearch =
            (p?.fullName || '').toLowerCase().includes(searchKeyword.toLowerCase()) ||
            (p?.patientCode || '').toLowerCase().includes(searchKeyword.toLowerCase()) ||
            (p?.phone || '').includes(searchKeyword)

        if (!matchesSearch) return false

        if (filterUrgency === 'URGENT') return p.isUrgent
        if (filterUrgency === 'EXAMINING') return p.status === 'EXAMINING'
        if (filterUrgency === 'WAITING') return p.status === 'WAITING'
        return true
    })

    // Xử lý khi bác sĩ nhấn "Bắt đầu khám"
    const handleStartExam = () => {
        if (!currentPatient) return
        onUpdatePatientStatus(currentPatient.id, 'EXAMINING')
        AppToast.info(`Bắt đầu khám cho bệnh nhân ${currentPatient.fullName} (STT: ${currentPatient.queueNumber})`)
    }

    // Toggle xét nghiệm cận lâm sàng
    const toggleLabTest = (testName) => {
        if (selectedLabTests.includes(testName)) {
            setSelectedLabTests(selectedLabTests.filter((t) => t !== testName))
        } else {
            setSelectedLabTests([...selectedLabTests, testName])
        }
    }

    // Thêm thuốc vào đơn
    const handleAddMedication = (e) => {
        e.preventDefault()
        if (!newMedName.trim()) return
        const newMed = {
            id: Date.now(),
            name: newMedName.trim(),
            dosage: newMedDosage.trim() || 'Theo chỉ dẫn bác sĩ',
            quantity: '1 Hộp / Chai',
        }
        setPrescriptions([...prescriptions, newMed])
        setNewMedName('')
        setNewMedDosage('')
    }

    // Xóa thuốc
    const handleRemoveMedication = (medId) => {
        setPrescriptions(prescriptions.filter((m) => m.id !== medId))
    }

    // Xử lý khi hoàn thành khám bệnh
    const handleFinishExam = () => {
        if (!currentPatient) return

        if (!diagnosis.trim()) {
            AppToast.warning('Vui lòng nhập chẩn đoán lâm sàng trước khi hoàn thành!')
            return
        }

        const completedData = {
            ...currentPatient,
            completedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            completedDate: new Date().toLocaleDateString('vi-VN'),
            finalDiagnosis: diagnosis.trim(),
            labTests: [...selectedLabTests],
            prescriptions: [...prescriptions],
            doctorNotes: doctorNotes.trim() || 'Tái khám sau 14 ngày hoặc khi có dấu hiệu bất thường.',
            status: 'COMPLETED',
        }

        onCompleteExamination(completedData)
        AppToast.success(`Đã hoàn thành khám và xuất bệnh án cho bệnh nhân ${currentPatient.fullName}!`)

        // Reset form cho bệnh nhân kế tiếp
        setDiagnosis('')
        setSelectedLabTests([])
        setDoctorNotes('')

        // Tự động chuyển con trỏ sang bệnh nhân chờ kế tiếp
        const nextPatient = queueList.find((p) => p.id !== currentPatient.id)
        if (nextPatient) {
            setSelectedPatientId(nextPatient.id)
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ═══════════════════════════════════════════════════════════════════
                CỘT TRÁI (Master): DANH SÁCH BỆNH NHÂN CHỜ KHÁM
            ═══════════════════════════════════════════════════════════════════ */}
            <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-3xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden">
                {/* Header cột trái */}
                <div className="p-5 border-b border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-[#E8F4FD] text-[#00B5F1] flex items-center justify-center font-bold text-sm">
                                📋
                            </span>
                            <div>
                                <h3 className="font-extrabold text-[#003553] text-sm tracking-tight">
                                    Hàng Đợi Khám Bệnh
                                </h3>
                                <p className="text-[11px] text-slate-400">
                                    Hôm nay: {queueList.length} lượt hẹn
                                </p>
                            </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-[#E8F4FD] text-[#00B5F1] text-xs font-bold border border-sky-100">
                            {queueList.filter((p) => p.status === 'WAITING').length} đang chờ
                        </span>
                    </div>

                    {/* Ô tìm kiếm */}
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">
                            🔍
                        </span>
                        <input
                            type="text"
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            placeholder="Tìm tên, mã BN hoặc SĐT..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none focus:border-[#00B5F1] focus:bg-white focus:ring-2 focus:ring-[#00B5F1]/10 transition"
                        />
                    </div>

                    {/* Bộ lọc nhanh */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 text-[11px]">
                        <button
                            type="button"
                            onClick={() => setFilterUrgency('ALL')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                                filterUrgency === 'ALL'
                                    ? 'bg-[#003553] text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Tất cả ({queueList.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterUrgency('WAITING')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                                filterUrgency === 'WAITING'
                                    ? 'bg-amber-500 text-white shadow-2xs'
                                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                        >
                            Đang chờ ({queueList.filter((p) => p.status === 'WAITING').length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterUrgency('EXAMINING')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                                filterUrgency === 'EXAMINING'
                                    ? 'bg-[#00B5F1] text-white shadow-2xs'
                                    : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                            }`}
                        >
                            Đang khám ({queueList.filter((p) => p.status === 'EXAMINING').length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterUrgency('URGENT')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                                filterUrgency === 'URGENT'
                                    ? 'bg-red-500 text-white shadow-2xs'
                                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                            }`}
                        >
                            AI Ưu tiên ({queueList.filter((p) => p.isUrgent).length})
                        </button>
                    </div>
                </div>

                {/* Danh sách thẻ bệnh nhân */}
                <div className="divide-y divide-slate-100 max-h-[calc(100vh-280px)] overflow-y-auto">
                    {filteredQueue.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-xs px-4">
                            Không có bệnh nhân nào phù hợp với bộ lọc hiện tại.
                        </div>
                    ) : (
                        filteredQueue.map((patient) => {
                            const isSelected = currentPatient?.id === patient.id
                            return (
                                <div
                                    key={patient.id}
                                    onClick={() => setSelectedPatientId(patient.id)}
                                    className={`p-4 transition cursor-pointer text-left relative border-l-4 ${
                                        isSelected
                                            ? 'bg-[#E8F4FD]/60 border-l-[#00B5F1] shadow-inner'
                                            : 'border-l-transparent hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center">
                                                {patient.queueNumber}
                                            </span>
                                            <div>
                                                <h4 className="text-xs font-bold text-[#003553] tracking-tight">
                                                    {patient.fullName}
                                                </h4>
                                                <span className="text-[10px] text-slate-400">
                                                    {patient.gender} • {patient.age} tuổi • {patient.patientCode}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Status badge */}
                                        <span
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                                patient.status === 'EXAMINING'
                                                    ? 'bg-sky-100 text-[#00B5F1] border border-sky-200'
                                                    : 'bg-amber-100 text-amber-700 border border-amber-200'
                                            }`}
                                        >
                                            {patient.status === 'EXAMINING' ? 'Đang khám' : 'Chờ khám'}
                                        </span>
                                    </div>

                                    {/* Appointment time */}
                                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mb-2">
                                        <span>⏰ Hẹn: {patient.appointmentTime}</span>
                                        <span>•</span>
                                        <span>📞 {patient.phone}</span>
                                    </div>

                                    {/* AI Triaged Badge */}
                                    {patient.aiDiagnosisSummary && (
                                        <div
                                            className={`text-[11px] p-2 rounded-xl flex items-start gap-1.5 leading-snug ${
                                                patient.isUrgent
                                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                                    : 'bg-white text-slate-700 border border-slate-200/80 shadow-2xs'
                                            }`}
                                        >
                                            <span className="shrink-0 text-xs">🤖</span>
                                            <span className="line-clamp-2">
                                                <strong className="font-semibold text-[#003553]">AI:</strong>{' '}
                                                {patient.aiDiagnosisSummary}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                CỘT PHẢI (Detail): CHI TIẾT BỆNH NHÂN & BÀN KHÁM LÂM SÀNG
            ═══════════════════════════════════════════════════════════════════ */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                {currentPatient ? (
                    <>
                        {/* 1. Header chi tiết bệnh nhân & Sinh hiệu */}
                        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6">
                            <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00B5F1] to-[#003553] text-white flex items-center justify-center text-xl font-bold shadow-md">
                                        {currentPatient.gender === 'Nữ' ? '👩' : '👨'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-lg font-extrabold text-[#003553]">
                                                {currentPatient.fullName}
                                            </h2>
                                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#E8F4FD] text-[#00B5F1] font-bold border border-sky-100">
                                                STT: {currentPatient.queueNumber}
                                            </span>
                                            {currentPatient.isUrgent && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-bold border border-red-200 animate-pulse">
                                                    ⚠️ Cần ưu tiên
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Mã hồ sơ: <span className="font-semibold text-slate-700">{currentPatient.patientCode}</span> | Giới tính: {currentPatient.gender} | Tuổi: {currentPatient.age} | BHYT: {currentPatient.healthInsurance || 'Có (BH-87291)'}
                                        </p>
                                    </div>
                                </div>

                                {/* Nút trạng thái khám */}
                                <div className="flex items-center gap-2">
                                    {currentPatient.status !== 'EXAMINING' ? (
                                        <button
                                            type="button"
                                            onClick={handleStartExam}
                                            className="px-4 py-2.5 rounded-xl bg-[#00B5F1] hover:bg-sky-500 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                                        >
                                            <span>▶</span>
                                            <span>Bắt đầu khám</span>
                                        </button>
                                    ) : (
                                        <span className="px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                            Đang trong phiên khám
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Chỉ số sinh hiệu (Vitals) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
                                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <span className="text-[11px] text-slate-400 block font-medium">Huyết áp</span>
                                    <span className="text-sm font-extrabold text-slate-800">
                                        {currentPatient.vitals?.bloodPressure || '125/80'} <small className="text-[10px] text-slate-400 font-normal">mmHg</small>
                                    </span>
                                </div>
                                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <span className="text-[11px] text-slate-400 block font-medium">Nhịp tim</span>
                                    <span className="text-sm font-extrabold text-slate-800">
                                        {currentPatient.vitals?.heartRate || '76'} <small className="text-[10px] text-slate-400 font-normal">bpm</small>
                                    </span>
                                </div>
                                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <span className="text-[11px] text-slate-400 block font-medium">Nhiệt độ</span>
                                    <span className="text-sm font-extrabold text-slate-800">
                                        {currentPatient.vitals?.temperature || '36.7'} <small className="text-[10px] text-slate-400 font-normal">°C</small>
                                    </span>
                                </div>
                                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <span className="text-[11px] text-slate-400 block font-medium">SpO2</span>
                                    <span className="text-sm font-extrabold text-slate-800">
                                        {currentPatient.vitals?.spo2 || '99'} <small className="text-[10px] text-slate-400 font-normal">%</small>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Hộp phân tích chuyên sâu từ AI Assistant */}
                        <div className="bg-gradient-to-r from-[#E8F4FD] to-sky-50 rounded-3xl border border-sky-200/80 p-5 space-y-3 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">🤖</span>
                                    <h3 className="font-extrabold text-[#003553] text-sm">
                                        Trợ Lý AI Phân Tích & Dự Báo Triệu Chứng
                                    </h3>
                                </div>
                                <span className="text-[11px] font-bold text-[#00B5F1] bg-white px-2.5 py-1 rounded-full border border-sky-100 shadow-2xs">
                                    Độ tin cậy: {currentPatient.aiConfidence || '95%'}
                                </span>
                            </div>

                            <div className="text-xs space-y-2 text-slate-700">
                                <p>
                                    <strong className="text-slate-900">Triệu chứng bệnh nhân mô tả:</strong>{' '}
                                    <span className="italic">{currentPatient.symptomsDescription}</span>
                                </p>
                                <p>
                                    <strong className="text-slate-900">Gợi ý phân loại AI:</strong>{' '}
                                    {currentPatient.aiClinicalInsight ||
                                        'Khuyến nghị thực hiện điện tâm đồ ECG và xét nghiệm men tim để loại trừ cơn đau thắt ngực không ổn định.'}
                                </p>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    <span className="text-[11px] bg-white text-slate-600 px-2.5 py-1 rounded-lg border border-sky-100 font-semibold">
                                        Tiền sử: {currentPatient.medicalHistory || 'Tăng huyết áp 3 năm'}
                                    </span>
                                    <span className="text-[11px] bg-red-50 text-red-700 px-2.5 py-1 rounded-lg border border-red-200 font-semibold">
                                        Dị ứng: {currentPatient.allergies || 'Không ghi nhận'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 3. Form Nhập Chẩn Đoán & Khám Lâm Sàng */}
                        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-5">
                            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                                <span className="text-base">📝</span>
                                <h3 className="font-extrabold text-[#003553] text-sm">
                                    Kết Luận Lâm Sàng & Y Lệnh Của Bác Sĩ
                                </h3>
                            </div>

                            {/* Chẩn đoán */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Chẩn đoán xác định / Bệnh danh (ICD-10) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={diagnosis}
                                    onChange={(e) => setDiagnosis(e.target.value)}
                                    placeholder="Ví dụ: I20 - Cơn đau thắt ngực / Tăng huyết áp vô căn độ II"
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white focus:ring-2 focus:ring-[#00B5F1]/10 transition font-medium"
                                />
                            </div>

                            {/* Chỉ định Cận Lâm Sàng */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">
                                    Chỉ định cận lâm sàng (Tick chọn xét nghiệm cần thực hiện)
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {AVAILABLE_LAB_TESTS.map((testName) => {
                                        const isChecked = selectedLabTests.includes(testName)
                                        return (
                                            <div
                                                key={testName}
                                                onClick={() => toggleLabTest(testName)}
                                                className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition flex items-center justify-between ${
                                                    isChecked
                                                        ? 'bg-[#E8F4FD] border-[#00B5F1] text-[#003553]'
                                                        : 'bg-slate-50/80 border-slate-200 text-slate-600 hover:bg-slate-100'
                                                }`}
                                            >
                                                <span>{testName}</span>
                                                <span className={`text-xs ${isChecked ? 'text-[#00B5F1]' : 'text-slate-300'}`}>
                                                    {isChecked ? '✓' : '+'}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Đơn thuốc điều trị */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-700">
                                        Đơn thuốc điều trị ngoại trú ({prescriptions.length} loại)
                                    </label>
                                </div>

                                {/* Danh sách thuốc đã thêm */}
                                <div className="space-y-2">
                                    {prescriptions.map((med) => (
                                        <div
                                            key={med.id}
                                            className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                                        >
                                            <div className="flex-1">
                                                <span className="font-bold text-slate-800">{med.name}</span>
                                                <span className="text-slate-400 text-[11px] ml-2">({med.quantity})</span>
                                                <p className="text-[11px] text-slate-500 mt-0.5">{med.dosage}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveMedication(med.id)}
                                                className="text-red-400 hover:text-red-600 font-bold p-1 cursor-pointer transition"
                                                title="Xóa thuốc"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Form thêm thuốc nhanh */}
                                <form onSubmit={handleAddMedication} className="flex flex-col sm:flex-row gap-2 pt-1">
                                    <input
                                        type="text"
                                        value={newMedName}
                                        onChange={(e) => setNewMedName(e.target.value)}
                                        placeholder="Tên thuốc & hàm lượng..."
                                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#00B5F1]"
                                    />
                                    <input
                                        type="text"
                                        value={newMedDosage}
                                        onChange={(e) => setNewMedDosage(e.target.value)}
                                        placeholder="Liều dùng (vd: 1 viên/ngày)..."
                                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#00B5F1]"
                                    />
                                    <button
                                        type="submit"
                                        className="px-3.5 py-2 rounded-xl bg-[#003553] hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer shrink-0"
                                    >
                                        + Thêm thuốc
                                    </button>
                                </form>
                            </div>

                            {/* Lời dặn dò */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Lời dặn dò & Lịch hẹn tái khám
                                </label>
                                <textarea
                                    rows="2"
                                    value={doctorNotes}
                                    onChange={(e) => setDoctorNotes(e.target.value)}
                                    placeholder="Ví dụ: Ăn nhạt, hạn chế gắng sức nặng. Tái khám sau 14 ngày hoặc ngay khi đau ngực tăng..."
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-800 outline-none focus:border-[#00B5F1] focus:bg-white focus:ring-2 focus:ring-[#00B5F1]/10 transition font-medium"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => AppToast.info('Đã lưu bản nháp bệnh án!')}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs transition cursor-pointer"
                                >
                                    💾 Lưu bản nháp
                                </button>
                                <button
                                    type="button"
                                    onClick={handleFinishExam}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer active:scale-95 flex items-center gap-1.5"
                                >
                                    <span>✓</span>
                                    <span>Hoàn thành & Xuất bệnh án</span>
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center text-slate-400 space-y-3">
                        <div className="text-4xl">🩺</div>
                        <h4 className="font-bold text-slate-700 text-sm">Chưa chọn bệnh nhân</h4>
                        <p className="text-xs">Vui lòng chọn một bệnh nhân từ danh sách hàng đợi bên trái để bắt đầu phiên khám.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
