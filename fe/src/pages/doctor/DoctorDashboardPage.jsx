import { useState, useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import ExamWorkstationPage from './ExamWorkstationPage'
import DoctorScheduleTab from '../../components/doctor/DoctorScheduleTab'
import ExaminedHistoryTab from '../../components/doctor/ExaminedHistoryTab'
import { fetchDoctorQueueAsync } from '../../redux/actions/doctor/clinicalAction'
import { clinicalService } from '../../services/doctor/ClinicalService'

export default function DoctorDashboardPage() {
    const dispatch = useDispatch()
    const [searchParams, setSearchParams] = useSearchParams()
    const { user } = useSelector((state) => state.app.auth)
    const { queue = [] } = useSelector((state) => state.doctor.clinical)

    const tabParam = (searchParams.get('tab') || '').toUpperCase()
    const initialTab = tabParam === 'SCHEDULE' ? 'SCHEDULE' : tabParam === 'HISTORY' ? 'HISTORY' : 'EXAM'
    const [activeTab, setActiveTab] = useState(initialTab)

    useEffect(() => {
        dispatch(fetchDoctorQueueAsync())
    }, [dispatch])

    useEffect(() => {
        if (tabParam === 'SCHEDULE' || tabParam === 'HISTORY' || tabParam === 'EXAM') {
            setActiveTab(tabParam)
        }
    }, [tabParam])

    const handleTabChange = (newTab) => {
        setActiveTab(newTab)
        if (newTab === 'HISTORY' || newTab === 'EXAM') {
            dispatch(fetchDoctorQueueAsync())
        }
        const nextParams = new URLSearchParams(searchParams)
        if (newTab === 'EXAM') {
            nextParams.delete('tab')
        } else {
            nextParams.set('tab', newTab.toLowerCase())
        }
        setSearchParams(nextParams, { replace: true })
    }

    const activeQueueCount = useMemo(() => {
        const allEncounters = clinicalService.getAllEncountersSync()
        return queue.filter((t) => {
            if (t.trang_thai === 'da_kham') return false
            const enc = allEncounters[t.encounter_id] || allEncounters[String(t.encounter_id)]
            return !enc?.is_locked
        }).length
    }, [queue])

    const examinedList = useMemo(() => {
        const allEncounters = clinicalService.getAllEncountersSync()
        const completedFromQueue = queue
            .filter((t) => {
                if (t.trang_thai === 'da_kham') return true
                const enc = allEncounters[t.encounter_id] || allEncounters[String(t.encounter_id)]
                return Boolean(enc?.is_locked)
            })
            .map((t, idx) => {
                const enc = clinicalService.getEncounterSync(t.encounter_id)
                const bn = enc?.benh_nhan || t.benh_nhan || {}
                const dxList = enc?.danh_sach_chan_doan || []
                const primaryDx = dxList.find((d) => d.loai_chan_doan === 'chinh') || dxList[0]
                const finalDiagnosis = primaryDx
                    ? `${primaryDx.ma_icd10} - ${primaryDx.ten_benh_chan_doan}`
                    : 'Chưa có chẩn đoán'

                const completedTimestamp = enc?.thoi_gian_khoa || enc?.updated_at || t.updated_at || t.created_at
                const dateObj = completedTimestamp ? new Date(completedTimestamp) : new Date()
                const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                const dateStr = dateObj.toLocaleDateString('vi-VN')
                const year = dateObj.getFullYear()
                const month = String(dateObj.getMonth() + 1).padStart(2, '0')
                const day = String(dateObj.getDate()).padStart(2, '0')
                const rawDateStr = `${year}-${month}-${day}`

                const rawOrders = enc?.danh_sach_chi_dinh || []
                const labOrders = rawOrders
                    .filter((o) => o.trang_thai !== 'da_huy')
                    .map((o) => {
                        const resultDetail = o.ket_qua_chi_tiet || o.tri_so_chi_tiet
                        const imageList = (o.tep_dinh_kem_urls && o.tep_dinh_kem_urls.length > 0)
                            ? o.tep_dinh_kem_urls
                            : (o.tep_dinh_kem_url ? [o.tep_dinh_kem_url] : [])

                        let summary = o.ket_luan || o.ghi_chu || ''
                        if (typeof resultDetail === 'string' && resultDetail.trim()) {
                            summary = resultDetail.trim()
                        } else if (resultDetail && typeof resultDetail === 'object') {
                            summary = resultDetail.ket_luan || resultDetail.tom_tat || resultDetail.mo_ta || summary
                        }

                        return {
                            id: o.id || o.server_order_id,
                            name: o.ten_dich_vu || 'Dịch vụ CLS',
                            status: o.trang_thai,
                            summary: summary || (o.trang_thai === 'da_co_ket_qua' ? 'Đã có kết quả' : 'Chờ thực hiện'),
                            description: resultDetail?.mo_ta || '',
                            detail: resultDetail,
                            attachments: imageList,
                            performedAt: o.thoi_gian_tra_kq || o.thoi_gian_thuc_hien || '',
                        }
                    })

                const labTests = labOrders.map((o) => o.name)

                const rawRx = enc?.danh_sach_thuoc || enc?.don_thuoc?.danh_sach_thuoc || []
                const prescriptions = rawRx.map((m, mIdx) => ({
                    id: m.id || mIdx + 1,
                    name: m.ten_thuoc,
                    dosage: m.cach_dung_day_du || m.cach_dung || 'Theo chỉ định',
                    quantity: `${m.so_luong || 1} ${m.don_vi_tinh || 'Viên'}`,
                }))

                return {
                    id: t.ticket_id || t.encounter_id || idx + 1,
                    encounterId: t.encounter_id,
                    queueNumber: t.ticket_code || `#${String(t.so_thu_tu_kham).padStart(2, '0')}`,
                    patientId: t.patient_id,
                    patientCode: bn.ma || (t.so_thu_tu_kham ? `BN-2026-${String(t.so_thu_tu_kham).padStart(4, '0')}` : 'BN-2026'),
                    fullName: t.ten_benh_nhan || bn.ho_ten || 'Bệnh nhân',
                    gender: t.gioi_tinh || bn.gioi_tinh || 'Nam',
                    age: t.tuoi || bn.tuoi || 30,
                    phone: bn.so_dien_thoai || '',
                    healthInsurance: bn.so_bhyt || bn.healthInsurance || '',
                    status: 'COMPLETED',
                    completedAt: timeStr,
                    completedDate: dateStr,
                    completedDateRaw: rawDateStr,
                    finalDiagnosis,
                    labTests,
                    labOrders,
                    prescriptions,
                    doctorNotes: enc?.loi_dan_bac_si || enc?.ket_luan_dieu_tri || enc?.don_thuoc?.loi_dan_uong_thuoc || 'Đã hoàn tất phiên khám.',
                }
            })

        return completedFromQueue
    }, [queue])

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-1.5 w-fit">
                <nav className="flex items-center gap-1.5" aria-label="Doctor Workstation Tabs">
                    <button
                        type="button"
                        onClick={() => handleTabChange('EXAM')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                            activeTab === 'EXAM'
                                ? 'bg-gradient-to-r from-[#00A9E3] to-[#0077B6] text-white shadow-md shadow-sky-500/20'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <span>🩺</span>
                        <span>Khám Bệnh</span>
                        <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                                activeTab === 'EXAM'
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200 text-slate-700'
                            }`}
                        >
                            {activeQueueCount}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleTabChange('SCHEDULE')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                            activeTab === 'SCHEDULE'
                                ? 'bg-gradient-to-r from-[#00A9E3] to-[#0077B6] text-white shadow-md shadow-sky-500/20'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <span>📅</span>
                        <span>Lịch Làm Việc &amp; Ca Trực</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleTabChange('HISTORY')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                            activeTab === 'HISTORY'
                                ? 'bg-gradient-to-r from-[#00A9E3] to-[#0077B6] text-white shadow-md shadow-sky-500/20'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <span>📋</span>
                        <span>Bệnh Nhân Đã Khám</span>
                        <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                                activeTab === 'HISTORY'
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200 text-slate-700'
                            }`}
                        >
                            {examinedList.length}
                        </span>
                    </button>
                </nav>
            </div>

            <div>
                {activeTab === 'EXAM' && (
                    <ExamWorkstationPage />
                )}

                {activeTab === 'SCHEDULE' && (
                    <DoctorScheduleTab doctorInfo={user} />
                )}

                {activeTab === 'HISTORY' && (
                    <ExaminedHistoryTab examinedList={examinedList} />
                )}
            </div>
        </div>
    )
}
