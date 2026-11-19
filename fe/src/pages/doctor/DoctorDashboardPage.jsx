import { useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import ExamWorkstationPage from './ExamWorkstationPage'
import DoctorScheduleTab from '../../components/doctor/DoctorScheduleTab'
import ExaminedHistoryTab from '../../components/doctor/ExaminedHistoryTab'
import { fetchDoctorQueueAsync } from '../../redux/actions/doctor/clinicalAction'
import { clinicalService } from '../../services/doctor/ClinicalService'

export default function DoctorDashboardPage() {
    const dispatch = useDispatch()
    const [searchParams] = useSearchParams()
    const { user } = useSelector((state) => state.app.auth)
    const { queue = [] } = useSelector((state) => state.doctor?.clinical || {})

    const tabParam = (searchParams.get('tab') || '').toUpperCase()
    const activeTab = tabParam === 'SCHEDULE' ? 'SCHEDULE' : tabParam === 'HISTORY' ? 'HISTORY' : 'EXAM'

    useEffect(() => {
        dispatch(fetchDoctorQueueAsync())
    }, [dispatch, activeTab])

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

                const timeStr = enc?.thoi_gian_khoa
                    ? new Date(enc.thoi_gian_khoa).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                    : ''
                const dateStr = enc?.thoi_gian_khoa
                    ? new Date(enc.thoi_gian_khoa).toLocaleDateString('vi-VN')
                    : new Date().toLocaleDateString('vi-VN')

                const labTests = (enc?.danh_sach_chi_dinh || [])
                    .filter((o) => o.trang_thai !== 'da_huy')
                    .map((o) => o.ten_dich_vu)

                const rawRx = enc?.danh_sach_thuoc || enc?.don_thuoc?.danh_sach_thuoc || []
                const prescriptions = rawRx.map((m, mIdx) => ({
                    id: m.id || mIdx + 1,
                    name: m.ten_thuoc,
                    dosage: m.cach_dung_day_du || m.cach_dung || 'Theo chỉ định',
                    quantity: `${m.so_luong || 1} ${m.don_vi_tinh || 'Viên'}`,
                }))

                const bpSys = enc?.huyet_ap_tam_thu ?? enc?.sinh_hieu?.huyet_ap_tam_thu
                const bpDia = enc?.huyet_ap_tam_truong ?? enc?.sinh_hieu?.huyet_ap_tam_truong
                const heartRate = enc?.mach_lan_phut ?? enc?.sinh_hieu?.mach_lan_phut ?? enc?.mach ?? ''
                const bloodPressure = bpSys && bpDia ? `${bpSys}/${bpDia}` : enc?.huyet_ap || ''

                return {
                    id: t.ticket_id || t.encounter_id || idx + 1,
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
                    finalDiagnosis,
                    labTests,
                    prescriptions,
                    doctorName: t.ten_bac_si || enc?.ten_bac_si || user?.fullName || '',
                    vitals: { bloodPressure, heartRate },
                    doctorNotes: enc?.loi_dan_bac_si || enc?.ket_luan_dieu_tri || enc?.don_thuoc?.loi_dan_uong_thuoc || 'Đã hoàn tất phiên khám.',
                }
            })

        return completedFromQueue
    }, [queue, user?.fullName])

    return (
        <div className="space-y-4">
            {activeTab === 'EXAM' && <ExamWorkstationPage />}
            {activeTab === 'SCHEDULE' && <DoctorScheduleTab doctorInfo={user} />}
            {activeTab === 'HISTORY' && <ExaminedHistoryTab examinedList={examinedList} doctorInfo={user} />}
        </div>
    )
}
