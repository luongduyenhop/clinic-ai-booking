import { useState } from 'react'
import WaitingQueueTab from '../../components/doctor/WaitingQueueTab'
import DoctorScheduleTab from '../../components/doctor/DoctorScheduleTab'
import ExaminedHistoryTab from '../../components/doctor/ExaminedHistoryTab'

export default function DoctorDashboardPage() {
    // 3 Tab: 'QUEUE' (Chờ khám) | 'SCHEDULE' (Lịch làm việc) | 'HISTORY' (Bệnh nhân đã khám)
    const [activeTab, setActiveTab] = useState('QUEUE')

    // Danh sách bệnh nhân trong hàng đợi chờ khám (sẵn sàng nhận dữ liệu từ Backend)
    const [queueList, setQueueList] = useState([])

    // Danh sách bệnh nhân đã được khám hoàn thành (sẵn sàng nhận dữ liệu từ Backend)
    const [examinedList, setExaminedList] = useState([])

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
