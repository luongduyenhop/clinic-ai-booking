import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AppToast } from '../common/AppNotification'
import { printHtmlDocument, printPrescriptionDocument } from '../../utils/helpers/printUtils'
import { clinicalService } from '../../services/doctor/ClinicalService'

export default function ExaminedHistoryTab({ examinedList = [] }) {
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

    const handlePrintPrescriptionDirect = (item) => {
        if (!item) return
        const encId = item.encounterId || item.id
        const enc = clinicalService.getEncounterSync(encId) || clinicalService.getEncounterSync(item.id) || {}

        // Chuẩn hóa danh sách thuốc
        let effectivePrescriptionItems = []
        if (enc.danh_sach_thuoc && enc.danh_sach_thuoc.length > 0) {
            effectivePrescriptionItems = enc.danh_sach_thuoc
        } else if (enc.don_thuoc?.danh_sach_thuoc && enc.don_thuoc.danh_sach_thuoc.length > 0) {
            effectivePrescriptionItems = enc.don_thuoc.danh_sach_thuoc
        } else if (item.prescriptions && item.prescriptions.length > 0) {
            effectivePrescriptionItems = item.prescriptions.map((p) => {
                let sl = 1
                let dv = 'Viên'
                if (typeof p.quantity === 'string') {
                    const matchNum = p.quantity.match(/\d+/)
                    sl = matchNum ? parseInt(matchNum[0], 10) : 1
                    const matchUnit = p.quantity.replace(/[\d\s]/g, '')
                    dv = matchUnit || 'Viên'
                } else if (typeof p.quantity === 'number') {
                    sl = p.quantity
                }
                return {
                    ten_thuoc: p.name || p.ten_thuoc,
                    ham_luong: p.ham_luong || 'Chuẩn',
                    so_luong: sl,
                    don_vi_tinh: dv,
                    cach_dung: p.dosage || p.cach_dung || 'Theo chỉ định của bác sĩ',
                }
            })
        }

        printPrescriptionDocument({
            encounter: enc.id ? enc : {
                id: encId,
                ten_benh_nhan: item.fullName,
                ngay_sinh: item.age ? `${2026 - item.age}` : '1990',
                gioi_tinh: item.gender,
                so_dien_thoai: item.phone,
                ma_benh_nhan: item.patientCode,
                loi_dan_bac_si: item.doctorNotes,
                ten_bac_si: 'BS. CKI Nguyễn Văn An',
                ngay_ky: item.completedDate,
                ngay_hen_tai_kham: item.ngay_hen_tai_kham || '',
            },
            patient: enc.benh_nhan || {
                ho_ten: item.fullName,
                gioi_tinh: item.gender,
                tuoi: item.age,
                so_dien_thoai: item.phone,
                ma: item.patientCode,
                so_bhyt: item.healthInsurance,
            },
            diagnoses: enc.danh_sach_chan_doan?.length > 0 ? enc.danh_sach_chan_doan : [
                {
                    ma_icd10: item.finalDiagnosis?.includes(' - ') ? item.finalDiagnosis.split(' - ')[0] : 'K29.7',
                    ten_benh_chan_doan: item.finalDiagnosis?.includes(' - ') ? item.finalDiagnosis.split(' - ').slice(1).join(' - ') : (item.finalDiagnosis || 'Viêm dạ dày - tá tràng')
                }
            ],
            prescriptionItems: effectivePrescriptionItems,
            prescriptionNote: item.doctorNotes || 'Uống thuốc đúng giờ theo chỉ dẫn của bác sĩ.',
            doctorName: 'BS. CKI Nguyễn Văn An',
        })
    }

    const handleDirectPrintPrescription = handlePrintPrescriptionDirect

    const handlePrintMedicalRecord = (record) => {
        if (!record) return
        const enc = clinicalService.getEncounterSync(record.encounterId || record.id) || clinicalService.getEncounterSync(record.id) || {}
        const vitals = {
            mach: enc.mach_lan_phut || enc.mach || record.vitals?.heartRate || '76',
            nhiet_do: enc.nhiet_do_c || enc.nhiet_do || record.vitals?.temperature || '36.8',
            huyet_ap: (enc.huyet_ap_tam_thu && enc.huyet_ap_tam_truong)
                ? `${enc.huyet_ap_tam_thu}/${enc.huyet_ap_tam_truong}`
                : (record.vitals?.bloodPressure || '120/80'),
            nhip_tho: enc.nhip_tho_lan_phut || enc.nhip_tho || record.vitals?.respiratoryRate || '18',
            can_nang: enc.can_nang_kg || enc.can_nang || record.vitals?.weight || '60',
            chieu_cao: enc.chieu_cao_cm || enc.chieu_cao || record.vitals?.height || '165',
        }

        const labList = record.labTests || []
        const rxList = (enc.danh_sach_thuoc && enc.danh_sach_thuoc.length > 0)
            ? enc.danh_sach_thuoc.map((m, i) => `${i + 1}. <b>${m.ten_thuoc}</b> (${m.ham_luong || 'Chuẩn'}) — SL: ${m.so_luong} ${m.don_vi_tinh || 'Viên'} | <i>${m.cach_dung || 'Theo chỉ định'}</i>`)
            : (record.prescriptions || []).map((m, i) => `${i + 1}. <b>${m.name}</b> — SL: ${m.quantity} | <i>${m.dosage}</i>`)

        const html = `
            <div style="font-family: 'Times New Roman', serif; padding: 10px; color: #111;">
                <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 12px;">
                    <div>
                        <div style="font-size: 11px; text-transform: uppercase; font-weight: bold;">SỞ Y TẾ TP. HỒ CHÍ MINH</div>
                        <div style="font-size: 13px; font-weight: bold; text-transform: uppercase;">PHÒNG KHÁM ĐA KHOA THÔNG MINH CLINIC-AI</div>
                        <div style="font-size: 10px; color: #444;">Địa chỉ: Khu Công Nghệ Cao, TP. Thủ Đức · Hotline: 1900 6868</div>
                    </div>
                    <div style="text-align: right; font-size: 11px;">
                        <div>Mã bệnh án: <b>${record.patientCode}</b></div>
                        <div>Ngày khám: <b>${record.completedDate}</b></div>
                    </div>
                </div>

                <div style="text-align: center; margin-bottom: 14px;">
                    <h2 style="font-size: 18px; font-weight: bold; margin: 0; text-transform: uppercase;">BẢN TÓM TẮT BỆNH ÁN NGOẠI TRÚ</h2>
                    <div style="font-size: 11px; font-style: italic;">(Lưu hồ sơ bệnh án & cấp cho người bệnh theo quy định)</div>
                </div>

                <div style="background: #f9f9f9; border: 1px solid #ddd; padding: 8px; font-size: 12px; margin-bottom: 12px; line-height: 1.6;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                        <div>Họ và tên: <b style="text-transform: uppercase;">${record.fullName}</b></div>
                        <div>Mã định danh y tế: <b>${record.patientCode}</b></div>
                        <div>Năm sinh / Tuổi: <b>${record.age} tuổi</b> · Giới tính: <b>${record.gender}</b></div>
                        <div>Số điện thoại: <b>${record.phone || '—'}</b></div>
                        <div style="grid-column: 1 / -1;">Số BHYT: <b>${record.healthInsurance || 'Không có'}</b></div>
                    </div>
                </div>

                <div style="margin-bottom: 12px; font-size: 12px;">
                    <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">1. Dấu hiệu sinh tồn & Thể trạng:</div>
                    <div style="display: grid; grid-template-columns: repeat(6, 1fr); border: 1px solid #333; padding: 4px 6px; text-align: center; font-size: 11px; background: #fff;">
                        <div>Mạch: <b>${vitals.mach}</b> ck/p</div>
                        <div>Nhiệt độ: <b>${vitals.nhiet_do}</b> °C</div>
                        <div>Huyết áp: <b>${vitals.huyet_ap}</b> mmHg</div>
                        <div>Nhịp thở: <b>${vitals.nhip_tho}</b> l/p</div>
                        <div>Cân nặng: <b>${vitals.can_nang}</b> kg</div>
                        <div>Chiều cao: <b>${vitals.chieu_cao}</b> cm</div>
                    </div>
                </div>

                <div style="margin-bottom: 12px; font-size: 12px;">
                    <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">2. Chẩn đoán y khoa xác định (ICD-10):</div>
                    <div style="border: 1px solid #333; padding: 6px 10px; background: #fafafa; font-weight: bold;">
                        ${record.finalDiagnosis || 'Khám nội tổng quát'}
                    </div>
                </div>

                ${labList.length > 0 ? `
                    <div style="margin-bottom: 12px; font-size: 12px;">
                        <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">3. Cận lâm sàng đã thực hiện:</div>
                        <ul style="margin: 0; padding-left: 20px;">
                            ${labList.map(t => `<li>${t} — Đã có kết luận đối chiếu lâm sàng</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <div style="margin-bottom: 12px; font-size: 12px;">
                    <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">4. Đơn thuốc & Hướng điều trị:</div>
                    ${rxList.length > 0 ? `
                        <div style="border: 1px solid #333; padding: 6px 10px;">
                            ${rxList.map(line => `<div style="margin-bottom: 4px;">${line}</div>`).join('')}
                        </div>
                    ` : '<div style="font-style: italic; color: #555;">(Không dùng thuốc)</div>'}
                </div>

                <div style="margin-bottom: 14px; font-size: 12px;">
                    <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">5. Lời dặn dò của bác sĩ:</div>
                    <div style="border: 1px dashed #444; padding: 6px 10px; font-style: italic; background: #fffbe8;">
                        ${record.doctorNotes || 'Ăn uống hợp lý, nghỉ ngơi, uống thuốc đúng giờ. Tái khám theo hẹn.'}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; margin-top: 20px; text-align: center; font-size: 12px; page-break-inside: avoid;">
                    <div>
                        <div style="font-weight: bold; text-transform: uppercase;">Người bệnh / Thân nhân</div>
                        <div style="font-size: 10px; font-style: italic;">(Ký và ghi rõ họ tên)</div>
                    </div>
                    <div>
                        <div style="font-style: italic;">Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</div>
                        <div style="font-weight: bold; text-transform: uppercase; margin-top: 2px;">Bác sĩ khám bệnh</div>
                        <div style="font-size: 10px; font-style: italic;">(Ký, ghi rõ họ tên & đóng dấu)</div>
                        <div style="margin-top: 36px; font-weight: bold;">BS. CKI Nguyễn Văn An</div>
                        <div style="font-size: 9px; color: #047857; font-weight: bold;">✓ CHỨNG TỪ Y TẾ ĐIỆN TỬ HỢP LỆ</div>
                    </div>
                </div>
            </div>
        `

        printHtmlDocument({
            title: `BenhAn_${record.patientCode}`,
            contentHtml: html,
            paperSize: 'A4',
        })
    }

    return (
        <div className="space-y-6">
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
                                        <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                                            <div className="font-bold text-[#003553]">{item.patientCode}</div>
                                            <div className="text-[11px] text-slate-400">
                                                {item.completedAt} • {item.completedDate}
                                            </div>
                                        </td>

                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                            <div className="font-bold text-slate-900">{item.fullName}</div>
                                            <div className="text-[11px] text-slate-500">
                                                {item.gender} • {item.age} tuổi • 📞 {item.phone}
                                            </div>
                                        </td>

                                        <td className="py-3.5 px-4 max-w-xs">
                                            <div className="font-semibold text-slate-800 line-clamp-2">
                                                {item.finalDiagnosis || 'Khám nội tim mạch định kỳ'}
                                            </div>
                                            <div className="text-[11px] text-slate-400 italic truncate mt-0.5">
                                                Ghi chú: {item.doctorNotes || 'Tái khám sau 2 tuần'}
                                            </div>
                                        </td>

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

                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                                                <span>✓</span>
                                                <span>Đã hoàn thành</span>
                                            </span>
                                        </td>

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
                                                    onClick={() => handlePrintMedicalRecord(item)}
                                                    className="px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 font-bold text-[11px] text-[#0077B6] transition cursor-pointer"
                                                    title="In tóm tắt bệnh án ngoại trú A4"
                                                >
                                                    🖨 In bệnh án
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePrintPrescriptionDirect(item)}
                                                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-bold text-[11px] text-slate-700 transition cursor-pointer"
                                                    title="In đơn thuốc của ca khám này"
                                                >
                                                    💊 In đơn
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
                    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex justify-center items-center py-6 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl max-w-2xl w-full flex flex-col max-h-[85vh] border border-slate-200 shadow-2xl relative overflow-hidden">
                            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 shrink-0">
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

                            <div className="flex-1 overflow-y-auto p-6 space-y-4">

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

                        <div className="space-y-1.5 text-xs">
                            <h4 className="font-bold text-slate-700 uppercase text-[11px] tracking-wider">
                                Chẩn đoán xác định:
                            </h4>
                            <p className="p-3 rounded-xl bg-[#E8F4FD] border border-sky-200 text-[#003553] font-bold">
                                {selectedRecord.finalDiagnosis}
                            </p>
                        </div>

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

                        <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-1">
                            <span className="font-bold block">📌 Lời dặn của bác sĩ:</span>
                            <p>{selectedRecord.doctorNotes || 'Ăn uống hợp lý, hạn chế mỡ động vật. Tái khám sau 14 ngày.'}</p>
                        </div>

                            </div>

                            <div className="flex justify-end gap-2 p-4 px-6 border-t border-slate-100 bg-slate-50/70 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => handlePrintMedicalRecord(selectedRecord)}
                                    className="px-4 py-2 rounded-xl bg-[#00B5F1] hover:bg-sky-500 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                                >
                                    🖨 In hồ sơ bệnh án
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePrintPrescriptionDirect(selectedRecord)}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                                >
                                    💊 In đơn thuốc
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
