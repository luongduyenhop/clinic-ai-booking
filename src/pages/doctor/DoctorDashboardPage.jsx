import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import WaitingQueueTab from '../../components/doctor/WaitingQueueTab'
import DoctorScheduleTab from '../../components/doctor/DoctorScheduleTab'
import ExaminedHistoryTab from '../../components/doctor/ExaminedHistoryTab'
import { fetchReceptionDataAsync } from '../../redux/slices/reception/receptionSlice'

export default function DoctorDashboardPage() {
    const dispatch = useDispatch()
    const { user } = useSelector((state) => state.app.auth)
    const { queueEntries = [], patients = [], isInitialized } = useSelector((state) => state.reception)

    // 3 Tab: 'QUEUE' (Chờ khám) | 'SCHEDULE' (Lịch làm việc) | 'HISTORY' (Bệnh nhân đã khám)
    const [activeTab, setActiveTab] = useState('QUEUE')

    // Danh sách bệnh nhân trong hàng đợi chờ khám
    const [queueList, setQueueList] = useState([])

    // Danh sách bệnh nhân đã được khám hoàn thành
    const [examinedList, setExaminedList] = useState([])

    useEffect(() => {
        if (!isInitialized) {
            dispatch(fetchReceptionDataAsync())
        }
    }, [dispatch, isInitialized])

    useEffect(() => {
        if (!queueEntries || queueEntries.length === 0) return

        // 1. Lấy danh sách bệnh nhân đang chờ khám hoặc đang trong phòng khám
        const activeQueue = queueEntries
            .filter((entry) => entry.status !== 'COMPLETED' && entry.status !== 'ABSENT')
            .map((entry, idx) => {
                const patient = patients.find((p) => p.id === entry.patientId) || {}
                const birthYear = patient.dob ? parseInt(patient.dob.slice(0, 4)) : 1990
                const age = 2026 - birthYear

                return {
                    id: entry.id,
                    queueNumber: entry.ticketNumber || `A${101 + idx}`,
                    patientId: entry.patientId,
                    patientCode: patient.patientCode || `BN-2026-00${idx + 1}`,
                    fullName: patient.fullName || `Bệnh nhân ${entry.ticketNumber || idx + 1}`,
                    gender: patient.gender === 'FEMALE' ? 'Nữ' : 'Nam',
                    age: age > 0 && age < 120 ? age : 35,
                    phone: patient.phone || '0912345678',
                    healthInsurance: patient.healthInsurance || 'DN4010112233445',
                    status: entry.status === 'IN_CONSULTATION' ? 'EXAMINING' : (entry.status || 'WAITING'),
                    isUrgent: entry.isUrgent || entry.status === 'PRIORITY' || idx === 1,
                    appointmentTime: entry.calledAt ? new Date(entry.calledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '08:30',
                    symptoms: entry.symptoms || patient.note || 'Đau đầu, tức ngực trái âm ỉ, hồi hộp khi leo cầu thang',
                    aiDiagnosisSummary: entry.aiDiagnosisSummary || 'Gợi ý kiểm tra tim mạch & chỉ số huyết áp (ICD-10: I10)',
                    allergies: patient.allergies && patient.allergies.length > 0 ? patient.allergies : ['Penicillin', 'Aspirin'],
                    vitals: {
                        bloodPressure: '135/85',
                        heartRate: '82',
                        temperature: '36.8',
                        spo2: '98',
                    },
                    roomId: entry.roomId,
                    departmentId: entry.departmentId,
                }
            })

        setQueueList(activeQueue)

        // 2. Lấy danh sách bệnh nhân đã hoàn thành khám để hiển thị ở tab Bệnh Nhân Đã Khám
        const completedEntries = queueEntries
            .filter((entry) => entry.status === 'COMPLETED')
            .map((entry, idx) => {
                const patient = patients.find((p) => p.id === entry.patientId) || {}
                const birthYear = patient.dob ? parseInt(patient.dob.slice(0, 4)) : 1985
                const age = 2026 - birthYear

                return {
                    id: entry.id,
                    queueNumber: entry.ticketNumber || `A09${idx + 1}`,
                    patientId: entry.patientId,
                    patientCode: patient.patientCode || `BN-2026-00${idx + 80}`,
                    fullName: patient.fullName || `Bệnh nhân A09${idx + 1}`,
                    gender: patient.gender === 'FEMALE' ? 'Nữ' : 'Nam',
                    age: age > 0 && age < 120 ? age : 40,
                    phone: patient.phone || '0987654321',
                    healthInsurance: patient.healthInsurance || 'GD4010889900112',
                    status: 'COMPLETED',
                    completedAt: '09:15',
                    completedDate: new Date().toLocaleDateString('vi-VN'),
                    finalDiagnosis: idx === 0 ? 'I10 - Tăng huyết áp vô căn (nguyên phát)' : 'K02.1 - Sâu ngà răng hàm trên',
                    labTests: idx === 0 
                        ? ['Điện tâm đồ (ECG 12 chuyển đạo)', 'Xét nghiệm công thức máu toàn phần (CBC)']
                        : ['Chụp X-quang quanh chóp răng hàm trên', 'Thử tủy định lượng nhiệt độ'],
                    prescriptions: idx === 0 ? [
                        { id: 1, name: 'Amlodipine 5mg', dosage: 'Uống 1 viên vào buổi sáng sau ăn', quantity: '30 Viên' },
                        { id: 2, name: 'Panadol Extra', dosage: 'Uống 1 viên khi đau đầu nhiều', quantity: '10 Viên' },
                    ] : [
                        { id: 1, name: 'Rodogyl (Spiramycin + Metronidazol)', dosage: 'Uống 2 viên/ngày chia 2 lần sau ăn', quantity: '20 Viên' },
                        { id: 2, name: 'Efferalgan 500mg', dosage: 'Uống 1 viên khi đau buốt nhiều', quantity: '10 Viên' },
                    ],
                    doctorNotes: idx === 0
                        ? 'Huyết áp kiểm soát tốt. Ăn nhạt, hạn chế mỡ động vật. Tái khám sau 30 ngày.'
                        : 'Đã trám xoang ngà sâu. Vệ sinh răng miệng sạch sẽ, tránh nhai đồ quá cứng trong 48h tới. Tái khám sau 6 tháng.',
                }
            })

        if (completedEntries.length > 0) {
            setExaminedList(completedEntries)
        }
    }, [queueEntries, patients])

    // Cập nhật trạng thái bệnh nhân trong hàng đợi (vd: từ WAITING sang EXAMINING)
    const handleUpdatePatientStatus = (patientId, newStatus) => {
        setQueueList((prev) =>
            prev.map((item) => (item.id === patientId ? { ...item, status: newStatus } : item))
        )
    }

    // Hoàn thành khám bệnh: chuyển bệnh nhân từ queueList sang examinedList
    const handleCompleteExamination = (completedPatientData) => {
        // Xóa khỏi hàng đợi
        setQueueList((prev) => prev.filter((item) => item.id !== completedPatientData.id))
        // Thêm vào danh sách đã khám
        setExaminedList((prev) => [completedPatientData, ...prev])
    }

    return (
        <div className="space-y-6">
            {/* ═══════════════════════════════════════════════════════════════════
                BỘ 3 TABS ĐIỀU HƯỚNG CHÍNH (MEDPRO PALETTE & STYLING)
            ═══════════════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-2">
                <nav className="flex flex-wrap items-center gap-2" aria-label="Doctor Portal Tabs">
                    {/* Tab 1: Hàng đợi khám bệnh */}
                    <button
                        type="button"
                        onClick={() => setActiveTab('QUEUE')}
                        className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-bold transition cursor-pointer select-none ${
                            activeTab === 'QUEUE'
                                ? 'bg-[#E8F4FD] text-[#003553] border border-[#00B5F1]/30 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                    >
                        <span className="text-sm">🩺</span>
                        <span>Khám Bệnh & Hàng Đợi</span>
                        <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                                activeTab === 'QUEUE'
                                    ? 'bg-[#00B5F1] text-white'
                                    : 'bg-slate-100 text-slate-500'
                            }`}
                        >
                            {queueList.length}
                        </span>
                    </button>

                    {/* Tab 2: Lịch làm việc của bác sĩ */}
                    <button
                        type="button"
                        onClick={() => setActiveTab('SCHEDULE')}
                        className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-bold transition cursor-pointer select-none ${
                            activeTab === 'SCHEDULE'
                                ? 'bg-[#E8F4FD] text-[#003553] border border-[#00B5F1]/30 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                    >
                        <span className="text-sm">📅</span>
                        <span>Lịch Làm Việc & Ca Trực</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-extrabold border border-emerald-200">
                            Hôm nay: Ca sáng
                        </span>
                    </button>

                    {/* Tab 3: Bệnh nhân đã được khám */}
                    <button
                        type="button"
                        onClick={() => setActiveTab('HISTORY')}
                        className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-bold transition cursor-pointer select-none ${
                            activeTab === 'HISTORY'
                                ? 'bg-[#E8F4FD] text-[#003553] border border-[#00B5F1]/30 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                    >
                        <span className="text-sm">📋</span>
                        <span>Bệnh Nhân Đã Khám</span>
                        <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                                activeTab === 'HISTORY'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 text-slate-500'
                            }`}
                        >
                            {examinedList.length}
                        </span>
                    </button>
                </nav>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                NỘI DUNG TỪNG TAB
            ═══════════════════════════════════════════════════════════════════ */}
            <div>
                {activeTab === 'QUEUE' && (
                    <WaitingQueueTab
                        queueList={queueList}
                        onUpdatePatientStatus={handleUpdatePatientStatus}
                        onCompleteExamination={handleCompleteExamination}
                    />
                )}

                {activeTab === 'SCHEDULE' && <DoctorScheduleTab />}

                {activeTab === 'HISTORY' && (
                    <ExaminedHistoryTab examinedList={examinedList} />
                )}
            </div>
        </div>
    )
}
