import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AppToast } from '../common/AppNotification'
import { ClinicIcon } from '../common/ClinicIcon'

export default function ExaminedHistoryTab({ examinedList = [], doctorInfo = null }) {
    const [searchKeyword, setSearchKeyword] = useState('')
    const [timeFilter, setTimeFilter] = useState('ALL')
    const [selectedRecord, setSelectedRecord] = useState(null)

    const todayStr = useMemo(() => new Date().toLocaleDateString('vi-VN'), [])
    const filteredList = useMemo(() => examinedList.filter((item) => {
        const matchesSearch =
            (item?.fullName || '').toLowerCase().includes(searchKeyword.toLowerCase()) ||
            (item?.patientCode || '').toLowerCase().includes(searchKeyword.toLowerCase()) ||
            (item?.finalDiagnosis || '').toLowerCase().includes(searchKeyword.toLowerCase())

        if (!matchesSearch) return false

        if (timeFilter === 'TODAY') {
            return item.completedDate === todayStr
        }
        return true
    }), [examinedList, searchKeyword, timeFilter, todayStr])

    const handlePrintPrescription = (patient) => {
        const roomLabel = doctorInfo?.room || 'Buồng khám chuyên khoa'
        AppToast.success(`Đã gửi lệnh in đơn thuốc của bệnh nhân ${patient.fullName} tới máy in ${roomLabel}!`)
    }

    return (
        <div className="space-y-4">
            <div className="medpro-card bg-clinic-surface p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="font-extrabold text-clinic-navy text-sm lg:text-base font-display">
                            Lịch sử &amp; Hồ sơ bệnh nhân đã khám
                        </h3>
                        <p className="text-xs text-clinic-text-secondary">
                            Danh sách các lượt khám đã kết luận, khóa bệnh án TT 32/2023 và phát hành đơn thuốc
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="medpro-badge-success text-xs font-bold tabular-nums">
                            Tổng số: {filteredList.length} hồ sơ hoàn thành
                        </span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                    <div className="relative flex-1 w-full">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-clinic-text-muted">
                            <ClinicIcon name="MagnifyingGlass" size={14} />
                        </span>
                        <input
                            type="text"
                            aria-label="Tìm kiếm hồ sơ bệnh nhân đã khám"
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            placeholder="Tìm kiếm theo họ tên bệnh nhân, mã hồ sơ hoặc chẩn đoán..."
                            className="medpro-input !pl-9"
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setTimeFilter('ALL')}
                            className={`px-3.5 py-2 rounded-[6px] text-xs font-bold transition cursor-pointer whitespace-nowrap border ${
                                timeFilter === 'ALL'
                                    ? 'bg-clinic-navy text-clinic-surface border-clinic-navy'
                                    : 'bg-clinic-bg text-clinic-text-secondary border-clinic-border hover:bg-clinic-surface-tint'
                            }`}
                        >
                            Tất cả thời gian
                        </button>
                        <button
                            type="button"
                            onClick={() => setTimeFilter('TODAY')}
                            className={`px-3.5 py-2 rounded-[6px] text-xs font-bold transition cursor-pointer whitespace-nowrap border ${
                                timeFilter === 'TODAY'
                                    ? 'bg-clinic-navy text-clinic-surface border-clinic-navy'
                                    : 'bg-clinic-bg text-clinic-text-secondary border-clinic-border hover:bg-clinic-surface-tint'
                            }`}
                        >
                            Hôm nay
                        </button>
                    </div>
                </div>
            </div>

            <div className="medpro-card bg-clinic-surface overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-clinic-text-secondary">
                        <thead className="bg-clinic-bg border-b border-clinic-border text-xs font-bold text-clinic-navy">
                            <tr>
                                <th className="py-3 px-4">Mã HS / Giờ</th>
                                <th className="py-3 px-4">Bệnh nhân</th>
                                <th className="py-3 px-4">Chẩn đoán xác định</th>
                                <th className="py-3 px-4">Chỉ định CLS &amp; Thuốc</th>
                                <th className="py-3 px-4">Trạng thái</th>
                                <th className="py-3 px-4 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-clinic-border">
                            {filteredList.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-clinic-text-secondary text-xs">
                                        Chưa có bệnh nhân nào trong danh sách đã khám.
                                    </td>
                                </tr>
                            ) : (
                                filteredList.map((item) => (
                                    <tr key={item.id} className="hover:bg-clinic-surface-tint transition">
                                        <td className="py-3 px-4 font-semibold text-clinic-text whitespace-nowrap tabular-nums">
                                            <div className="font-bold text-clinic-navy">{item.patientCode}</div>
                                            <div className="text-[11px] text-clinic-text-secondary">
                                                {item.completedAt} · {item.completedDate}
                                            </div>
                                        </td>

                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <div className="font-bold text-clinic-navy">{item.fullName}</div>
                                            <div className="text-[11px] text-clinic-text-secondary flex items-center gap-1 tabular-nums">
                                                <span>{item.gender} · {item.age} tuổi ·</span>
                                                <ClinicIcon name="Phone" size={11} />
                                                <span>{item.phone}</span>
                                            </div>
                                        </td>

                                        <td className="py-3 px-4 max-w-xs">
                                            <div className="font-semibold text-clinic-navy line-clamp-2">
                                                {item.finalDiagnosis || 'Khám nội tim mạch định kỳ'}
                                            </div>
                                            <div className="text-[11px] text-clinic-text-secondary truncate mt-0.5">
                                                Ghi chú: {item.doctorNotes || 'Tái khám sau 2 tuần'}
                                            </div>
                                        </td>

                                        <td className="py-3 px-4">
                                            <div className="flex flex-wrap gap-1 tabular-nums">
                                                {item.labTests && item.labTests.length > 0 ? (
                                                    <span className="medpro-badge-info inline-flex items-center gap-1 text-[10px] font-semibold">
                                                        <ClinicIcon name="Microscope" size={11} />
                                                        <span>{item.labTests.length} xét nghiệm</span>
                                                    </span>
                                                ) : null}
                                                <span className="medpro-badge-success inline-flex items-center gap-1 text-[10px] font-semibold">
                                                    <ClinicIcon name="Pill" size={11} />
                                                    <span>{item.prescriptions?.length || 0} loại thuốc</span>
                                                </span>
                                            </div>
                                        </td>

                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <span className="medpro-badge-success inline-flex items-center gap-1 font-bold text-[11px]">
                                                <ClinicIcon name="Check" size={11} weight="bold" />
                                                <span>Đã hoàn thành</span>
                                            </span>
                                        </td>

                                        <td className="py-3 px-4 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedRecord(item)}
                                                    className="medpro-btn-outline px-2.5 py-1.5 rounded-[6px] font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                                                >
                                                    <ClinicIcon name="Eye" size={12} />
                                                    <span>Chi tiết</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePrintPrescription(item)}
                                                    className="medpro-btn-outline px-2.5 py-1.5 rounded-[6px] font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                                                    title="In đơn thuốc"
                                                >
                                                    <ClinicIcon name="Printer" size={12} />
                                                    <span>In đơn</span>
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

            {selectedRecord &&
                createPortal(
                    <div className="fixed inset-0 z-50 overflow-y-auto bg-clinic-navy/60 backdrop-blur-xs p-4 flex justify-center items-center py-6">
                        <div className="bg-clinic-surface rounded-[6px] max-w-2xl w-full flex flex-col max-h-[85vh] border border-clinic-border relative overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-clinic-border bg-clinic-bg shrink-0">
                                <div>
                                    <h3 className="text-base font-extrabold text-clinic-navy">
                                        Hồ Sơ Bệnh Án Điện Tử
                                    </h3>
                                    <p className="text-xs text-clinic-text-secondary tabular-nums">
                                        Mã bệnh án: <span className="font-bold text-clinic-navy">{selectedRecord.patientCode}</span> | Khám lúc: {selectedRecord.completedAt} ({selectedRecord.completedDate})
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    aria-label="Đóng hồ sơ bệnh án"
                                    onClick={() => setSelectedRecord(null)}
                                    className="w-8 h-8 rounded-[6px] bg-clinic-bg-muted hover:bg-clinic-border text-clinic-text-secondary flex items-center justify-center cursor-pointer transition"
                                >
                                    <ClinicIcon name="X" size={16} weight="bold" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                <div className="p-4 rounded-[6px] bg-clinic-bg border border-clinic-border grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                    <div>
                                        <span className="text-clinic-text-secondary block text-[11px]">Họ và tên:</span>
                                        <span className="font-bold text-clinic-navy">{selectedRecord.fullName}</span>
                                    </div>
                                    <div className="tabular-nums">
                                        <span className="text-clinic-text-secondary block text-[11px]">Giới tính / Tuổi:</span>
                                        <span className="font-semibold text-clinic-navy">{selectedRecord.gender} · {selectedRecord.age} tuổi</span>
                                    </div>
                                    <div className="tabular-nums">
                                        <span className="text-clinic-text-secondary block text-[11px]">Số điện thoại:</span>
                                        <span className="font-semibold text-clinic-navy">{selectedRecord.phone}</span>
                                    </div>
                                    <div className="tabular-nums">
                                        <span className="text-clinic-text-secondary block text-[11px]">Huyết áp:</span>
                                        <span className="font-bold text-clinic-navy">
                                            {selectedRecord.vitals?.bloodPressure ? `${selectedRecord.vitals.bloodPressure} mmHg` : 'Chưa đo'}
                                        </span>
                                    </div>
                                    <div className="tabular-nums">
                                        <span className="text-clinic-text-secondary block text-[11px]">Nhịp tim:</span>
                                        <span className="font-bold text-clinic-navy">
                                            {selectedRecord.vitals?.heartRate ? `${selectedRecord.vitals.heartRate} bpm` : 'Chưa đo'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-clinic-text-secondary block text-[11px]">Bác sĩ điều trị:</span>
                                        <span className="font-bold text-clinic-cta">
                                            {selectedRecord.doctorName || doctorInfo?.fullName || doctorInfo?.name || 'Bác sĩ điều trị'}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-1.5 text-xs">
                                    <h4 className="font-bold text-clinic-text-secondary text-xs">
                                        Chẩn đoán xác định:
                                    </h4>
                                    <p className="p-3 rounded-[6px] bg-clinic-surface-alt border border-clinic-info-border text-clinic-navy font-bold">
                                        {selectedRecord.finalDiagnosis}
                                    </p>
                                </div>

                                {selectedRecord.labTests && selectedRecord.labTests.length > 0 && (
                                    <div className="space-y-1.5 text-xs">
                                        <h4 className="font-bold text-clinic-text-secondary text-xs">
                                            Cận lâm sàng đã chỉ định:
                                        </h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {selectedRecord.labTests.map((t, i) => (
                                                <span
                                                    key={i}
                                                    className="medpro-badge-info inline-flex items-center gap-1 px-2.5 py-1 font-semibold"
                                                >
                                                    <ClinicIcon name="Microscope" size={12} />
                                                    <span>{t}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2 text-xs">
                                    <h4 className="font-bold text-clinic-text-secondary text-xs">
                                        Đơn thuốc chi tiết:
                                    </h4>
                                    <div className="divide-y divide-clinic-border border border-clinic-border rounded-[6px] overflow-hidden">
                                        {selectedRecord.prescriptions?.map((med, i) => (
                                            <div key={i} className="p-3 flex justify-between items-center bg-clinic-surface">
                                                <div>
                                                    <span className="font-bold text-clinic-navy tabular-nums">{i + 1}. {med.name}</span>
                                                    <p className="text-[11px] text-clinic-text-secondary">{med.dosage}</p>
                                                </div>
                                                <span className="medpro-badge-neutral text-xs font-semibold tabular-nums">
                                                    {med.quantity}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-3 rounded-[6px] bg-clinic-warning-bg border border-clinic-warning-border text-xs text-clinic-warning space-y-1">
                                    <span className="font-bold flex items-center gap-1.5">
                                        <ClinicIcon name="PushPin" size={13} weight="bold" />
                                        <span>Lời dặn của bác sĩ:</span>
                                    </span>
                                    <p>{selectedRecord.doctorNotes || 'Ăn uống hợp lý, hạn chế mỡ động vật. Tái khám sau 14 ngày.'}</p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 p-4 px-6 border-t border-clinic-border bg-clinic-bg shrink-0">
                                <button
                                    type="button"
                                    onClick={() => handlePrintPrescription(selectedRecord)}
                                    className="medpro-btn-primary px-4 py-2 rounded-[6px] font-bold text-xs cursor-pointer inline-flex items-center gap-1.5"
                                >
                                    <ClinicIcon name="Printer" size={14} weight="bold" />
                                    <span>In hồ sơ bệnh án</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedRecord(null)}
                                    className="medpro-btn-outline px-4 py-2 rounded-[6px] font-bold text-xs cursor-pointer"
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
