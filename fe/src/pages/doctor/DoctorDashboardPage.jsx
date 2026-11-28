import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import ExamWorkstationPage from './ExamWorkstationPage'
import DoctorScheduleTab from '../../components/doctor/DoctorScheduleTab'
import ExaminedHistoryTab from '../../components/doctor/ExaminedHistoryTab'
import { fetchDoctorQueueAsync } from '../../redux/actions/doctor/clinicalAction'
import { clinicalService } from '../../services/doctor/ClinicalService'
import { clinicalEventBridge, CLINICAL_EVENTS } from '../../services/clinicalEventBridge'

function mapEncounterRecord(enc, fallbackTicket, user, idx) {
    const bn = enc?.benh_nhan || fallbackTicket?.benh_nhan || {}
    const dxList = enc?.danh_sach_chan_doan || []
    const primaryDx = dxList.find((d) => String(d.loai_chan_doan || '').toLowerCase() === 'chinh') || dxList[0]
    const finalDiagnosis = primaryDx
        ? `${primaryDx.ma_icd10} - ${primaryDx.ten_benh_chan_doan}`
        : 'Chưa có chẩn đoán'

    const rawAnchorTime =
        enc?.thoi_gian_khoa ||
        enc?.thoi_gian_ket_thuc ||
        enc?.updated_at ||
        fallbackTicket?.updated_at ||
        enc?.thoi_gian_bat_dau ||
        fallbackTicket?.created_at ||
        null
    const parsedTime = rawAnchorTime ? new Date(rawAnchorTime) : null
    const validParsed = parsedTime && !Number.isNaN(parsedTime.getTime()) ? parsedTime : null
    const dateAnchor = validParsed || new Date()

    const timeStr = validParsed
        ? validParsed.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : ''
    const dateStr = dateAnchor.toLocaleDateString('vi-VN')
    const completedDateRaw = `${dateAnchor.getFullYear()}-${String(dateAnchor.getMonth() + 1).padStart(2, '0')}-${String(
        dateAnchor.getDate()
    ).padStart(2, '0')}`

    const labOrders = (enc?.danh_sach_chi_dinh || [])
        .filter((o) => o.trang_thai !== 'da_huy')
        .map((o) => {
            const resultDetail = o.ket_qua_chi_tiet || o.tri_so_chi_tiet
            const imageList =
                o.tep_dinh_kem_urls && o.tep_dinh_kem_urls.length > 0
                    ? o.tep_dinh_kem_urls
                    : o.tep_dinh_kem_url
                    ? [o.tep_dinh_kem_url]
                    : []

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
                summary:
                    summary ||
                    (o.trang_thai === 'da_co_ket_qua' || o.trang_thai === 'da_duyet'
                        ? 'Đã có kết quả'
                        : 'Chờ thực hiện'),
                description: resultDetail?.mo_ta || '',
                detail: resultDetail,
                attachments: imageList,
                performedAt: o.thoi_gian_tra_kq || o.thoi_gian_thuc_hien || o.updated_at || '',
            }
        })

    const labTests = labOrders.map((o) => o.name)

    const rawRx = (Array.isArray(enc?.danh_sach_thuoc) && enc.danh_sach_thuoc.length > 0)
        ? enc.danh_sach_thuoc
        : (Array.isArray(enc?.don_thuoc?.danh_sach_thuoc) && enc.don_thuoc.danh_sach_thuoc.length > 0)
        ? enc.don_thuoc.danh_sach_thuoc
        : (Array.isArray(enc?.don_thuoc?.danh_sach_chi_tiet) && enc.don_thuoc.danh_sach_chi_tiet.length > 0)
        ? enc.don_thuoc.danh_sach_chi_tiet
        : []

    const prescriptions = rawRx.map((m, mIdx) => ({
        id: m.id || mIdx + 1,
        name: m.ten_thuoc || m.ten || 'Thuốc',
        dosage: m.cach_dung_day_du || m.cach_dung || 'Theo chỉ định',
        quantity: `${m.so_luong || 1} ${m.don_vi_tinh || 'Viên'}`,
    }))

    const bloodPressure =
        enc?.huyet_ap_tam_thu && enc?.huyet_ap_tam_truong
            ? `${enc.huyet_ap_tam_thu}/${enc.huyet_ap_tam_truong}`
            : null
    const heartRate = enc?.mach_lan_phut ?? null
    const doctorName =
        enc?.bac_si?.ho_ten ||
        enc?.ten_bac_si ||
        user?.fullName ||
        user?.ho_ten ||
        user?.name ||
        'Bác sĩ điều trị'

    const seqNum = enc?.so_thu_tu_kham ?? fallbackTicket?.so_thu_tu_kham
    const queueNumber =
        fallbackTicket?.ticket_code ||
        (seqNum ? `#${String(seqNum).padStart(2, '0')}` : enc?.ma_kcb || `#${idx + 1}`)

    const serverEncounterId = Number(enc?.luot_kham_server_id || enc?.id || 0)

    return {
        id: serverEncounterId || fallbackTicket?.ticket_id || fallbackTicket?.encounter_id || idx + 1,
        serverEncounterId,
        encounterId: fallbackTicket?.encounter_id || enc?.id,
        encounter: enc || {},
        diagnoses: dxList,
        prescriptionItems: rawRx,
        queueNumber,
        patientId: bn.id || fallbackTicket?.patient_id,
        patientCode: bn.ma || (seqNum ? `BN-2026-${String(seqNum).padStart(4, '0')}` : 'BN-2026'),
        fullName: fallbackTicket?.ten_benh_nhan || bn.ho_ten || 'Bệnh nhân',
        gender: fallbackTicket?.gioi_tinh || bn.gioi_tinh || 'Nam',
        age: fallbackTicket?.tuoi || bn.tuoi || 30,
        phone: bn.so_dien_thoai || '',
        healthInsurance: bn.so_bhyt || bn.healthInsurance || '',
        status: 'COMPLETED',
        completedAt: timeStr,
        completedDate: dateStr,
        completedDateRaw,
        completedTimestamp: validParsed ? validParsed.getTime() : 0,
        finalDiagnosis,
        labTests,
        labOrders,
        prescriptions,
        vitals: {
            bloodPressure,
            heartRate,
        },
        doctorName,
        doctorNotes:
            enc?.loi_dan_bac_si ||
            enc?.ket_luan_dieu_tri ||
            enc?.don_thuoc?.loi_dan_uong_thuoc ||
            enc?.loi_dan_uong_thuoc ||
            'Đã hoàn tất phiên khám.',
    }
}

export default function DoctorDashboardPage() {
    const dispatch = useDispatch()
    const [searchParams] = useSearchParams()
    const { user } = useSelector((state) => state.app.auth)
    const { queue = [] } = useSelector((state) => state.doctor?.clinical || {})

    const tabParam = (searchParams.get('tab') || '').toUpperCase()
    const activeTab = tabParam === 'SCHEDULE' ? 'SCHEDULE' : tabParam === 'HISTORY' ? 'HISTORY' : 'EXAM'
    const [serverHistory, setServerHistory] = useState([])

    const loadCompletedHistory = useCallback(async () => {
        try {
            const rows = await clinicalService.getCompletedEncounters({ days: 30, limit: 100 })
            setServerHistory(rows)
        } catch {
            setServerHistory((prev) => prev)
        }
    }, [])

    useEffect(() => {
        dispatch(fetchDoctorQueueAsync())
        loadCompletedHistory()
        const unsubCompleted = clinicalEventBridge.on(CLINICAL_EVENTS.ENCOUNTER_COMPLETED, () => {
            dispatch(fetchDoctorQueueAsync())
            loadCompletedHistory()
        })
        return () => {
            unsubCompleted()
        }
    }, [dispatch, loadCompletedHistory])

    useEffect(() => {
        if (activeTab === 'HISTORY') {
            dispatch(fetchDoctorQueueAsync())
            loadCompletedHistory()
        } else if (activeTab === 'EXAM') {
            dispatch(fetchDoctorQueueAsync())
        }
    }, [activeTab, dispatch, loadCompletedHistory])

    const examinedList = useMemo(() => {
        const seenServerIds = new Set()
        const merged = []

        serverHistory.forEach((enc, idx) => {
            const item = mapEncounterRecord(enc, null, user, idx)
            if (item.serverEncounterId) {
                seenServerIds.add(item.serverEncounterId)
            }
            merged.push(item)
        })

        const allEncounters = clinicalService.getAllEncountersSync()
        queue
            .filter((t) => {
                if (t.trang_thai === 'da_kham') return true
                const enc = allEncounters[t.encounter_id] || allEncounters[String(t.encounter_id)]
                return Boolean(enc?.is_locked)
            })
            .forEach((t, idx) => {
                const enc = clinicalService.getEncounterSync(t.encounter_id) || {}
                const srvId = Number(enc?.luot_kham_server_id || 0)
                if (srvId && seenServerIds.has(srvId)) {
                    return
                }
                if (srvId) {
                    seenServerIds.add(srvId)
                }
                merged.push(mapEncounterRecord(enc, t, user, serverHistory.length + idx))
            })

        return merged.sort((a, b) => (b.completedTimestamp || 0) - (a.completedTimestamp || 0))
    }, [queue, serverHistory, user])

    return (
        <div className="space-y-4">
            {activeTab === 'EXAM' && <ExamWorkstationPage />}
            {activeTab === 'SCHEDULE' && <DoctorScheduleTab doctorInfo={user} />}
            {activeTab === 'HISTORY' && <ExaminedHistoryTab examinedList={examinedList} doctorInfo={user} />}
        </div>
    )
}
