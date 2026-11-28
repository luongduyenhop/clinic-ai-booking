import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { printPrescriptionDocument, printMedicalRecordDocument } from '../../utils/helpers/printMedicalDocuments'
import { ClinicIcon } from '../common/ClinicIcon'
import ResultAttachments from '../user/patient/ResultAttachments'

const getTodayRaw = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

const normalizeDisplayDateToRaw = (dateStr) => {
    if (!dateStr) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
    const parts = String(dateStr).split('/')
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
    return ''
}

const formatLabOrderSummary = (order) => {
    if (!order) return ''
    if (order.summary) return String(order.summary)
    const detail = order.detail
    if (!detail) return ''
    if (typeof detail === 'string') return detail.trim()
    if (typeof detail === 'object') {
        if (detail.ket_luan) return String(detail.ket_luan)
        if (detail.mo_ta) return String(detail.mo_ta)
        if (detail.tom_tat) return String(detail.tom_tat)
        if (Array.isArray(detail.chi_tiet) && detail.chi_tiet.length > 0) {
            return detail.chi_tiet
                .map((ct) => `${ct.ten_chi_so || ct.ten || ct.ma}: ${ct.gia_tri} ${ct.don_vi || ''}`.trim())
                .join(', ')
        }
    }
    return ''
}

export default function ExaminedHistoryTab({ examinedList = [], doctorInfo = null }) {
    const [searchKeyword, setSearchKeyword] = useState('')
    const [selectedDate, setSelectedDate] = useState('')
    const [selectedRecord, setSelectedRecord] = useState(null)

    const [todayRaw] = useState(() => getTodayRaw())

    const filteredList = useMemo(
        () =>
            examinedList.filter((item) => {
                const matchesSearch =
                    (item?.fullName || '').toLowerCase().includes(searchKeyword.toLowerCase()) ||
                    (item?.patientCode || '').toLowerCase().includes(searchKeyword.toLowerCase()) ||
                    (item?.finalDiagnosis || '').toLowerCase().includes(searchKeyword.toLowerCase())

                if (!matchesSearch) return false

                if (selectedDate) {
                    const itemRaw = item.completedDateRaw || normalizeDisplayDateToRaw(item.completedDate)
                    return itemRaw === selectedDate
                }
                return true
            }),
        [examinedList, searchKeyword, selectedDate]
    )

    const preparePrintPayload = (item) => {
        if (!item) return { encounter: {}, diagnoses: [], prescriptionItems: [], prescriptionNote: '' }
        const enc = item.encounter || {}
        const bn = enc.benh_nhan || {}
        const mergedEncounter = {
            ...enc,
            id: enc.id || item.encounterId || item.id,
            ten_benh_nhan: enc.ten_benh_nhan || bn.ho_ten || item.fullName,
            tuoi: enc.tuoi || bn.tuoi || item.age,
            gioi_tinh: enc.gioi_tinh || bn.gioi_tinh || item.gender,
            so_dien_thoai: enc.so_dien_thoai || bn.so_dien_thoai || item.phone,
            dia_chi: enc.dia_chi || bn.dia_chi || item.address || 'Hà Nội',
            benh_nhan: {
                ...bn,
                ho_ten: bn.ho_ten || item.fullName,
                tuoi: bn.tuoi || item.age,
                gioi_tinh: bn.gioi_tinh || item.gender,
                so_dien_thoai: bn.so_dien_thoai || item.phone,
                ma: bn.ma || item.patientCode,
                di_ung_thuoc: bn.di_ung_thuoc || item.allergy || 'Không có',
            },
            ngay_kham: enc.ngay_kham || item.completedDate,
            thoi_gian_khoa: enc.thoi_gian_khoa || item.completedAt,
            bac_si: enc.bac_si || { ho_ten: item.doctorName || 'Bác sĩ điều trị' },
            ten_chuyen_khoa: enc.ten_chuyen_khoa || 'Khoa Nội tổng quát',
            loi_dan_bac_si: enc.loi_dan_bac_si || item.doctorNotes || '',
            loi_dan_uong_thuoc: enc.loi_dan_uong_thuoc || item.doctorNotes || '',
            ket_luan_dieu_tri: enc.ket_luan_dieu_tri || item.doctorNotes || '',
        }

        const diagnoses =
            item.diagnoses && item.diagnoses.length > 0
                ? item.diagnoses
                : item.finalDiagnosis
                ? [
                      {
                          ma_icd10: item.finalDiagnosis.split(' - ')[0]?.trim(),
                          ten_benh_chan_doan: item.finalDiagnosis.split(' - ')[1]?.trim() || item.finalDiagnosis,
                          loai_chan_doan: 'chinh',
                      },
                  ]
                : []

        const prescriptionItems =
            item.prescriptionItems && item.prescriptionItems.length > 0 ? item.prescriptionItems : item.prescriptions || []

        return {
            encounter: mergedEncounter,
            diagnoses,
            prescriptionItems,
            prescriptionNote: item.doctorNotes || mergedEncounter.loi_dan_uong_thuoc || '',
        }
    }

    const handlePrintPrescription = (item) => {
        const payload = preparePrintPayload(item)
        printPrescriptionDocument(payload)
    }

    const handlePrintMedicalRecord = (item) => {
        const payload = preparePrintPayload(item)
        printMedicalRecordDocument(payload)
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

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setSelectedDate('')}
                            className={`px-3.5 py-2 rounded-[6px] text-xs font-bold transition cursor-pointer whitespace-nowrap border ${
                                selectedDate === ''
                                    ? 'bg-clinic-navy text-clinic-surface border-clinic-navy'
                                    : 'bg-clinic-bg text-clinic-text-secondary border-clinic-border hover:bg-clinic-surface-tint'
                            }`}
                        >
                            Tất cả thời gian
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedDate(todayRaw)}
                            className={`px-3.5 py-2 rounded-[6px] text-xs font-bold transition cursor-pointer whitespace-nowrap border ${
                                selectedDate === todayRaw
                                    ? 'bg-clinic-navy text-clinic-surface border-clinic-navy'
                                    : 'bg-clinic-bg text-clinic-text-secondary border-clinic-border hover:bg-clinic-surface-tint'
                            }`}
                        >
                            Hôm nay
                        </button>
                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] border border-clinic-border bg-clinic-bg text-xs font-semibold text-clinic-navy">
                            <ClinicIcon name="Calendar" size={14} className="text-clinic-cta" />
                            <input
                                type="date"
                                aria-label="Lọc theo ngày khám"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-xs font-semibold text-clinic-navy outline-none tabular-nums cursor-pointer"
                            />
                        </label>
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
                                filteredList.map((item) => {
                                    const labCount = item.labOrders?.length || item.labTests?.length || 0
                                    return (
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
                                                    <span>
                                                        {item.gender} · {item.age} tuổi ·
                                                    </span>
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
                                                    {labCount > 0 ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedRecord(item)}
                                                            className="medpro-badge-info inline-flex items-center gap-1 text-[10px] font-semibold cursor-pointer hover:opacity-85 transition"
                                                            title="Xem chi tiết kết quả cận lâm sàng"
                                                        >
                                                            <ClinicIcon name="Microscope" size={11} />
                                                            <span>{labCount} KQ dịch vụ</span>
                                                        </button>
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
                                    )
                                })
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
                                        Mã bệnh án:{' '}
                                        <span className="font-bold text-clinic-navy">{selectedRecord.patientCode}</span> |
                                        Khám lúc: {selectedRecord.completedAt} ({selectedRecord.completedDate})
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
                                        <span className="text-clinic-text-secondary block text-[11px]">
                                            Giới tính / Tuổi:
                                        </span>
                                        <span className="font-semibold text-clinic-navy">
                                            {selectedRecord.gender} · {selectedRecord.age} tuổi
                                        </span>
                                    </div>
                                    <div className="tabular-nums">
                                        <span className="text-clinic-text-secondary block text-[11px]">
                                            Số điện thoại:
                                        </span>
                                        <span className="font-semibold text-clinic-navy">{selectedRecord.phone}</span>
                                    </div>
                                    <div className="tabular-nums">
                                        <span className="text-clinic-text-secondary block text-[11px]">Huyết áp:</span>
                                        <span className="font-bold text-clinic-navy">
                                            {selectedRecord.vitals?.bloodPressure
                                                ? `${selectedRecord.vitals.bloodPressure} mmHg`
                                                : 'Chưa đo'}
                                        </span>
                                    </div>
                                    <div className="tabular-nums">
                                        <span className="text-clinic-text-secondary block text-[11px]">Nhịp tim:</span>
                                        <span className="font-bold text-clinic-navy">
                                            {selectedRecord.vitals?.heartRate
                                                ? `${selectedRecord.vitals.heartRate} bpm`
                                                : 'Chưa đo'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-clinic-text-secondary block text-[11px]">
                                            Bác sĩ điều trị:
                                        </span>
                                        <span className="font-bold text-clinic-cta">
                                            {selectedRecord.doctorName ||
                                                doctorInfo?.fullName ||
                                                doctorInfo?.name ||
                                                'Bác sĩ điều trị'}
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

                                {selectedRecord.labOrders && selectedRecord.labOrders.length > 0 ? (
                                    <div className="space-y-2 text-xs">
                                        <h4 className="font-bold text-clinic-text-secondary text-xs">
                                            Kết quả Cận lâm sàng &amp; Dịch vụ đã thực hiện:
                                        </h4>
                                        <div className="space-y-2">
                                            {selectedRecord.labOrders.map((order, idx) => {
                                                const isDone =
                                                    order.status === 'da_co_ket_qua' || order.status === 'da_duyet'
                                                const summaryText = formatLabOrderSummary(order)
                                                return (
                                                    <div
                                                        key={order.id || idx}
                                                        className="p-3 rounded-[6px] border border-clinic-border bg-clinic-bg space-y-1.5"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="font-bold text-clinic-navy inline-flex items-center gap-1.5">
                                                                <ClinicIcon
                                                                    name="Microscope"
                                                                    size={13}
                                                                    className="text-clinic-cta"
                                                                />
                                                                <span>{order.name}</span>
                                                            </span>
                                                            <span
                                                                className={`text-[10px] font-bold ${
                                                                    isDone ? 'medpro-badge-success' : 'medpro-badge-info'
                                                                }`}
                                                            >
                                                                {isDone ? 'Đã có kết quả' : 'Đang xử lý'}
                                                            </span>
                                                        </div>
                                                        {summaryText && (
                                                            <div className="text-[11px] text-clinic-success bg-clinic-success-bg border border-clinic-success-border rounded-[6px] p-2 font-medium">
                                                                {summaryText}
                                                            </div>
                                                        )}
                                                        {order.attachments && order.attachments.length > 0 && (
                                                            <ResultAttachments
                                                                files={order.attachments}
                                                                serviceName={order.name}
                                                            />
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    selectedRecord.labTests &&
                                    selectedRecord.labTests.length > 0 && (
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
                                    )
                                )}

                                <div className="space-y-2 text-xs">
                                    <h4 className="font-bold text-clinic-text-secondary text-xs">
                                        Đơn thuốc chi tiết:
                                    </h4>
                                    <div className="divide-y divide-clinic-border border border-clinic-border rounded-[6px] overflow-hidden">
                                        {selectedRecord.prescriptions?.map((med, i) => (
                                            <div
                                                key={i}
                                                className="p-3 flex justify-between items-center bg-clinic-surface"
                                            >
                                                <div>
                                                    <span className="font-bold text-clinic-navy tabular-nums">
                                                        {i + 1}. {med.name}
                                                    </span>
                                                    <p className="text-[11px] text-clinic-text-secondary">
                                                        {med.dosage}
                                                    </p>
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
                                    <p>
                                        {selectedRecord.doctorNotes ||
                                            'Ăn uống hợp lý, hạn chế mỡ động vật. Tái khám sau 14 ngày.'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 p-4 px-6 border-t border-clinic-border bg-clinic-bg shrink-0">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handlePrintMedicalRecord(selectedRecord)}
                                        className="medpro-btn-outline px-3.5 py-2 rounded-[6px] font-bold text-xs cursor-pointer inline-flex items-center gap-1.5"
                                        title="In phiếu khám & tóm tắt bệnh án EMR"
                                    >
                                        <ClinicIcon name="FileText" size={14} />
                                        <span>In bệnh án</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handlePrintPrescription(selectedRecord)}
                                        className="medpro-btn-primary px-3.5 py-2 rounded-[6px] font-bold text-xs cursor-pointer inline-flex items-center gap-1.5"
                                        title="In đơn thuốc điện tử chuẩn Bộ Y Tế"
                                    >
                                        <ClinicIcon name="Printer" size={14} weight="bold" />
                                        <span>In đơn thuốc</span>
                                    </button>
                                </div>
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
