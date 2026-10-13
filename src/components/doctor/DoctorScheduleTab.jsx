import { useState } from 'react'
import DoctorShiftRequestModal from './DoctorShiftRequestModal'

export default function DoctorScheduleTab() {
    const [selectedWeek, setSelectedWeek] = useState('CURRENT') // CURRENT | NEXT
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)

    // Danh sách ca trực của Bác sĩ (sẵn sàng nhận dữ liệu từ Backend)
    const [scheduleData, _setScheduleData] = useState([])

    const totalShifts = scheduleData.reduce((acc, d) => acc + (d.shifts?.length || 0), 0)
    const totalBooked = scheduleData.reduce(
        (acc, d) => acc + (d.shifts?.reduce((sAcc, s) => sAcc + (s.bookedPatients || 0), 0) || 0),
        0
    )

    return (
        <div className="space-y-6">
            {/* Header thống kê tổng quan ca trực */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng số ca trực tuần</span>
                    <p className="text-2xl font-extrabold text-[#003553] mt-2">{totalShifts} ca</p>
                    <span className="text-xs text-sky-600 font-semibold mt-1 inline-block">Theo lịch phân công</span>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bệnh nhân đã hẹn trước</span>
                    <p className="text-2xl font-extrabold text-[#00B5F1] mt-2">{totalBooked} BN</p>
                    <span className="text-xs text-emerald-600 font-semibold mt-1 inline-block">Đã đồng bộ từ hệ thống</span>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phòng trực</span>
                    <p className="text-2xl font-extrabold text-slate-800 mt-2">Bàn Khám</p>
                    <span className="text-xs text-slate-500 font-semibold mt-1 inline-block">Khoa Khám Bệnh</span>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quy chế đổi ca</span>
                        <p className="text-xs text-slate-600 mt-1">Báo trước ít nhất 24 giờ làm việc</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsRequestModalOpen(true)}
                        className="w-full mt-2 py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
                    >
                        🔄 Yêu cầu đổi ca trực
                    </button>
                </div>
            </div>

            {/* Bộ điều khiển tuần làm việc */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-2xl bg-[#E8F4FD] text-[#00B5F1] flex items-center justify-center text-xl font-bold">
                            📅
                        </span>
                        <div>
                            <h3 className="font-extrabold text-[#003553] text-base">
                                Lịch Phân Ca & Công Tác Bác Sĩ
                            </h3>
                            <p className="text-xs text-slate-500">
                                Tuần 42: Từ ngày 12/10/2026 đến ngày 18/10/2026
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedWeek('CURRENT')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                                selectedWeek === 'CURRENT'
                                    ? 'bg-[#003553] text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Tuần hiện tại
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedWeek('NEXT')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                                selectedWeek === 'NEXT'
                                    ? 'bg-[#003553] text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Tuần tiếp theo
                        </button>
                    </div>
                </div>

                {/* Danh sách các ngày trong tuần */}
                {scheduleData.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-3xl bg-slate-50/50 space-y-2">
                        <span className="text-3xl block">📅</span>
                        <p className="font-bold text-slate-700 text-sm">Chưa có lịch trực trong tuần</p>
                        <p className="text-slate-400 max-w-sm mx-auto">
                            Dữ liệu phân ca của bác sĩ sẽ được đồng bộ tự động từ hệ thống quản lý phòng khám khi có lịch mới.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {scheduleData.map((item, index) => (
                            <div
                                key={index}
                                className={`rounded-2xl border p-4.5 transition flex flex-col justify-between ${
                                    item.isToday
                                        ? 'border-[#00B5F1] bg-[#E8F4FD]/40 ring-2 ring-[#00B5F1]/20 shadow-sm'
                                        : 'border-slate-200/90 bg-white hover:border-slate-300'
                                }`}
                            >
                                {/* Tiêu đề ngày */}
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-sm text-[#003553]">
                                            {item.dayOfWeek}
                                        </span>
                                        <span className="text-xs text-slate-400">({item.date})</span>
                                    </div>
                                    {item.isToday && (
                                        <span className="px-2 py-0.5 rounded-full bg-[#00B5F1] text-white text-[10px] font-bold shadow-2xs">
                                            Hôm nay
                                        </span>
                                    )}
                                </div>

                                {/* Các ca trong ngày */}
                                <div className="space-y-3">
                                    {item.shifts.map((shift) => (
                                        <div
                                            key={shift.id}
                                            className={`p-3 rounded-xl border text-xs ${
                                                shift.status === 'IN_PROGRESS'
                                                    ? 'bg-sky-50/90 border-[#00B5F1]/60 text-slate-800'
                                                    : shift.status === 'OFF'
                                                    ? 'bg-slate-50 border-slate-200/70 text-slate-400'
                                                    : 'bg-slate-50/70 border-slate-200 text-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-[#003553] flex items-center gap-1.5">
                                                    <span>{shift.type === 'MORNING' ? '☀️' : '⛅'}</span>
                                                    <span>{shift.name} ({shift.time})</span>
                                                </span>
                                                {/* Status Badge */}
                                                {shift.status === 'IN_PROGRESS' && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-200 text-[#003553] font-bold">
                                                        Đang trực
                                                    </span>
                                                )}
                                                {shift.status === 'UPCOMING' && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold">
                                                        Sắp tới
                                                    </span>
                                                )}
                                                {shift.status === 'OFF' && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-400 font-semibold">
                                                        Nghỉ ca
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-[11px] font-semibold text-slate-600">
                                                📍 {shift.room}
                                            </p>

                                            {shift.maxCapacity > 0 && (
                                                <div className="flex items-center justify-between text-[11px] mt-1 pt-1 border-t border-slate-200/60">
                                                    <span className="text-slate-500">Bệnh nhân đặt trước:</span>
                                                    <span className="font-bold text-[#00B5F1]">
                                                        {shift.bookedPatients}/{shift.maxCapacity} BN
                                                    </span>
                                                </div>
                                            )}

                                            <p className="text-[10px] text-slate-400 mt-1 italic">
                                                {shift.note}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Yêu cầu đổi ca & Xin nghỉ */}
            <DoctorShiftRequestModal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
            />
        </div>
    )
}

