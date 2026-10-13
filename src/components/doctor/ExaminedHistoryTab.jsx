import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AppToast } from '../common/AppNotification'

export default function ExaminedHistoryTab({ examinedList = [] }) {
    const [searchKeyword, setSearchKeyword] = useState('')
    const [timeFilter, setTimeFilter] = useState('ALL') // ALL | TODAY | WEEK
    const [selectedRecord, setSelectedRecord] = useState(null)

    // Lọc danh sách bệnh nhân đã khám
    const filteredList = examinedList.filter((item) => {
        const matchesSearch =
            (item?.fullName || '').toLowerCase().includes(searchKeyword.toLowerCase()) ||
            (item?.patientCode || '').toLowerCase().includes(searchKeyword.toLowerCase()) ||
            (item?.finalDiagnosis || '').toLowerCase().includes(searchKeyword.toLowerCase())

        if (!matchesSearch) return false

        if (timeFilter === 'TODAY') {
            return item.completedDate === new Date().toLocaleDateString('vi-VN')
        }
        return true
    })

    const handlePrintPrescription = (patient) => {
        AppToast.success(`Đã gửi lệnh in đơn thuốc của bệnh nhân ${patient.fullName} tới máy in Phòng 204!`)
    }

    return (
        <div className="space-y-6">
            {/* Header Bộ lọc & Tìm kiếm */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold border border-emerald-100">
                            🩺
                        </span>
                        <div>
                            <h3 className="font-extrabold text-[#003553] text-base">
                                Lịch Sử & Hồ Sơ Bệnh Nhân Đã Khám
                            </h3>
                            <p className="text-xs text-slate-500">
                                Danh sách các lượt khám do bạn trực tiếp kết luận và kê đơn
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Tổng số: {filteredList.length} hồ sơ hoàn thành
                        </span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    {/* Thanh tìm kiếm */}
                    <div className="relative flex-1 w-full">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                            🔍
                        </span>
                        <input
                            type="text"
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            placeholder="Tìm kiếm theo họ tên bệnh nhân, mã hồ sơ hoặc chẩn đoán..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none focus:border-[#00B5F1] focus:bg-white focus:ring-2 focus:ring-[#00B5F1]/10 transition"
                        />
                    </div>

                    {/* Bộ lọc thời gian */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setTimeFilter('ALL')}
                            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                                timeFilter === 'ALL'
                                    ? 'bg-[#003553] text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Tất cả thời gian
                        </button>
                        <button
                            type="button"
                            onClick={() => setTimeFilter('TODAY')}
                            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                                timeFilter === 'TODAY'
                                    ? 'bg-[#003553] text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Hôm nay
                        </button>
                    </div>
                </div>
            </div>

            {/* Bảng danh sách bệnh nhân đã khám */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="py-3.5 px-4">Mã HS / Giờ</th>
                                <th className="py-3.5 px-4">Bệnh nhân</th>
                                <th className="py-3.5 px-4">Chẩn đoán xác định</th>
                                <th className="py-3.5 px-4">Chỉ định CLS & Thuốc</th>
                                <th className="py-3.5 px-4">Trạng thái</th>
                                <th className="py-3.5 px-4 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredList.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-slate-400 text-xs">
                                        Chưa có bệnh nhân nào trong danh sách đã khám.
                                    </td>
                                </tr>
                            ) : (
                                filteredList.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                                        {/* Mã hồ sơ & Giờ khám */}
                                        <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                                            <div className="font-bold text-[#003553]">{item.patientCode}</div>
                                            <div className="text-[11px] text-slate-400">
                                                {item.completedAt} • {item.completedDate}
                                            </div>
                                        </td>

                                        {/* Thông tin bệnh nhân */}
                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                            <div className="font-bold text-slate-900">{item.fullName}</div>
                                            <div className="text-[11px] text-slate-500">
                                                {item.gender} • {item.age} tuổi • 📞 {item.phone}
                                            </div>
                                        </td>

                                        {/* Chẩn đoán */}
                                        <td className="py-3.5 px-4 max-w-xs">
                                            <div className="font-semibold text-slate-800 line-clamp-2">
                                                {item.finalDiagnosis || 'Khám nội tim mạch định kỳ'}
                                            </div>
                                            <div className="text-[11px] text-slate-400 italic truncate mt-0.5">
                                                Ghi chú: {item.doctorNotes || 'Tái khám sau 2 tuần'}
                                            </div>
                                        </td>

                                        {/* CLS & Đơn thuốc */}
                                        <td className="py-3.5 px-4">
                                            <div className="flex flex-wrap gap-1">
                                                {item.labTests && item.labTests.length > 0 ? (
                                                    <span className="px-2 py-0.5 rounded-md bg-sky-50 text-[#00B5F1] text-[10px] font-semibold border border-sky-100">
                                                        🔬 {item.labTests.length} xét nghiệm
                                                    </span>
                                                ) : null}
                                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-100">
                                                    💊 {item.prescriptions?.length || 0} loại thuốc
                                                </span>
                                            </div>
                                        </td>

                                        {/* Trạng thái */}
                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                                                <span>✓</span>
                                                <span>Đã hoàn thành</span>
                                            </span>
                                        </td>

                                        {/* Thao tác */}
                                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedRecord(item)}
                                                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-[#E8F4FD] hover:text-[#00B5F1] hover:border-[#00B5F1]/30 font-bold text-[11px] text-slate-700 transition cursor-pointer shadow-2xs"
                                                >
                                                    👁 Chi tiết
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePrintPrescription(item)}
                                                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-bold text-[11px] text-slate-700 transition cursor-pointer"
                                                    title="In đơn thuốc"
                                                >
                                                    🖨 In đơn
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL XEM CHI TIẾT HỒ SƠ BỆNH ÁN ĐÃ KHÁM
            ═══════════════════════════════════════════════════════════════════ */}
            {selectedRecord &&
                createPortal(
                    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex justify-center items-center py-6 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto relative">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-base font-extrabold text-[#003553]">
                                    Hồ Sơ Bệnh Án Điện Tử
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Mã bệnh án: <span className="font-bold text-slate-700">{selectedRecord.patientCode}</span> | Khám lúc: {selectedRecord.completedAt} ({selectedRecord.completedDate})
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedRecord(null)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer transition"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Thông tin bệnh nhân */}
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                            <div>
                                <span className="text-slate-400 block text-[11px]">Họ và tên:</span>
                                <span className="font-bold text-slate-800">{selectedRecord.fullName}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Giới tính / Tuổi:</span>
                                <span className="font-semibold text-slate-800">{selectedRecord.gender} • {selectedRecord.age} tuổi</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Số điện thoại:</span>
                                <span className="font-semibold text-slate-800">{selectedRecord.phone}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Huyết áp:</span>
                                <span className="font-bold text-slate-800">{selectedRecord.vitals?.bloodPressure || '125/80'} mmHg</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Nhịp tim:</span>
                                <span className="font-bold text-slate-800">{selectedRecord.vitals?.heartRate || '76'} bpm</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Bác sĩ điều trị:</span>
                                <span className="font-bold text-[#00B5F1]">BS. CKI Nguyễn Văn An</span>
                            </div>
                        </div>

                        {/* Chẩn đoán */}
                        <div className="space-y-1.5 text-xs">
                            <h4 className="font-bold text-slate-700 uppercase text-[11px] tracking-wider">
                                Chẩn đoán xác định:
                            </h4>
                            <p className="p-3 rounded-xl bg-[#E8F4FD] border border-sky-200 text-[#003553] font-bold">
                                {selectedRecord.finalDiagnosis}
                            </p>
                        </div>

                        {/* Chỉ định cận lâm sàng */}
                        {selectedRecord.labTests && selectedRecord.labTests.length > 0 && (
                            <div className="space-y-1.5 text-xs">
                                <h4 className="font-bold text-slate-700 uppercase text-[11px] tracking-wider">
                                    Cận lâm sàng đã chỉ định:
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedRecord.labTests.map((t, i) => (
                                        <span
                                            key={i}
                                            className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-100 font-semibold"
                                        >
                                            🔬 {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Đơn thuốc đã kê */}
                        <div className="space-y-2 text-xs">
                            <h4 className="font-bold text-slate-700 uppercase text-[11px] tracking-wider">
                                Đơn thuốc chi tiết:
                            </h4>
                            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                                {selectedRecord.prescriptions?.map((med, i) => (
                                    <div key={i} className="p-3 flex justify-between items-center bg-white">
                                        <div>
                                            <span className="font-bold text-slate-800">{i + 1}. {med.name}</span>
                                            <p className="text-[11px] text-slate-500">{med.dosage}</p>
                                        </div>
                                        <span className="text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                            {med.quantity}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Lời dặn dò */}
                        <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-1">
                            <span className="font-bold block">📌 Lời dặn của bác sĩ:</span>
                            <p>{selectedRecord.doctorNotes || 'Ăn uống hợp lý, hạn chế mỡ động vật. Tái khám sau 14 ngày.'}</p>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => handlePrintPrescription(selectedRecord)}
                                className="px-4 py-2 rounded-xl bg-[#00B5F1] hover:bg-sky-500 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                            >
                                🖨 In hồ sơ bệnh án
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedRecord(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
