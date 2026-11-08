import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Drawer, Modal } from 'antd'
import {
    fetchDoctorQueueAsync,
    callNextPatientAsync,
    startPatientAsync,
    recallPatientAsync,
    postponeTicketAsync,
    fetchEncounterAsync,
    saveEncounterDraftAsync,
    createOrdersAsync,
    cancelOrderAsync,
    completeEncounterAsync,
    createAmendmentAsync,
    rateAiSuggestionAsync,
    fetchServicesAsync,
} from '../../redux/actions/doctor/clinicalAction'
import { clearEncounter } from '../../redux/slices/doctor/clinicalSlice'
import { AppToast } from '../../components/common/AppNotification'
import { ClinicIcon } from '../../components/common/ClinicIcon'
import { useDebounce } from '../../hooks/useDebounce'
import { formatDate, formatDateTime } from '../../utils/helpers/formatDate'
import { audioAnnouncer } from '../../utils/audioAnnouncer'
import QueuePanel from '../../components/doctor/exam/QueuePanel'
import PatientBanner from '../../components/doctor/exam/PatientBanner'
import ExamStepTabs from '../../components/doctor/exam/ExamStepTabs'
import StepClinical from '../../components/doctor/exam/StepClinical'
import StepOrders from '../../components/doctor/exam/StepOrders'
import StepDiagnosis from '../../components/doctor/exam/StepDiagnosis'
import { clinicalEventBridge, CLINICAL_EVENTS } from '../../services/clinicalEventBridge'
import StepPrescription from '../../components/doctor/exam/StepPrescription'
import { useDoctorShortcuts } from '../../hooks/useDoctorShortcuts'
import { SAMPLE_PRESCRIPTION_TEMPLATES } from '../../utils/constants/clinicalTemplates'
import { EXAM_STEPS, VITAL_FIELDS, computeQuantity, doseText } from '../../components/doctor/exam/examHelpers'
import { composeSpecialtyText, findSpecialtyExam } from '../../utils/constants/clinical'
import AmendmentModal from '../../components/doctor/exam/AmendmentModal'
import PrescriptionPrintAndCopyModal from '../../components/doctor/PrescriptionPrintAndCopyModal'
import { clinicalService } from '../../services/doctor/ClinicalService'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../../components/doctor/clinical/StateBlocks'

const QUEUE_POLL_MS = 15000

const CLS_RESULT_POLL_MS = 5000


const DRAFT_FIELDS = [
    'ly_do_vao_kham',
    'benh_su',
    'kham_lam_sang_bo_phan',
    'ket_luan_dieu_tri',
    'kham_chuyen_khoa',
    ...VITAL_FIELDS.map((f) => f.name),
]

const vitalsSchema = Yup.object(
    Object.fromEntries(
        VITAL_FIELDS.map((f) => [
            f.name,
            Yup.number()
                .transform((v, orig) => (orig === '' || orig === null ? undefined : v))
                .typeError('Phải là số')
                .min(f.min, `Tối thiểu ${f.min}`)
                .max(f.max, `Tối đa ${f.max}`),
        ])
    )
)

const sanitizeReason = (reason) => {
    if (!reason) return ''
    const s = String(reason).trim().toLowerCase()
    if (s === 'chờ khám bệnh' || s === 'cho kham benh' || s === 'chờ khám' || s === 'cho kham' || s === 'đang khám' || s === 'dang kham' || s === 'khám theo chỉ định tiếp đón') {
        return ''
    }
    return reason
}

const toFormValues = (enc) => ({
    ly_do_vao_kham: sanitizeReason(enc?.ly_do_vao_kham),
    benh_su: enc?.benh_su || '',
    kham_lam_sang_bo_phan: enc?.kham_lam_sang_bo_phan || '',
    kham_chuyen_khoa: enc?.kham_chuyen_khoa || { khoa: enc?.chuyen_khoa_kham || null, items: {}, extras: {} },
    ...Object.fromEntries(VITAL_FIELDS.map((f) => [f.name, enc?.[f.name] ?? ''])),
    danh_sach_chan_doan: enc?.danh_sach_chan_doan || [],
    ket_luan_dieu_tri: enc?.ket_luan_dieu_tri || '',
    danh_sach_thuoc: enc?.danh_sach_thuoc || enc?.don_thuoc?.danh_sach_thuoc || [],
    loi_dan_uong_thuoc: enc?.loi_dan_uong_thuoc || enc?.don_thuoc?.loi_dan_uong_thuoc || '',
    trang_thai_don_thuoc: enc?.trang_thai_don_thuoc || enc?.don_thuoc?.trang_thai || 'DRAFT',
    ngay_ky: enc?.ngay_ky || enc?.don_thuoc?.ngay_ky || '',
    chu_ky_so: enc?.chu_ky_so || enc?.don_thuoc?.chu_ky_so || '',
    nguoi_ky: enc?.nguoi_ky || enc?.don_thuoc?.nguoi_ky || '',
    ngay_hen_tai_kham: enc?.ngay_hen_tai_kham || '',
    loi_dan_bac_si: enc?.loi_dan_bac_si || '',
})

export default function ExamWorkstationPage() {
    const dispatch = useDispatch()
    const currentUser = useSelector((state) => state.app?.auth?.user)
    const { queue, queueLoading, queueError, encounter, encounterLoading, encounterError, services } = useSelector(
        (state) => state.doctor.clinical
    )
    const resolvedSpecialty = useMemo(
        () =>
            findSpecialtyExam(
                currentUser?.chuyen_khoa_ma ||
                    currentUser?.specialty ||
                    currentUser?.department ||
                    encounter?.ma_chuyen_khoa ||
                    encounter?.ten_chuyen_khoa ||
                    encounter?.chuyen_khoa_kham
            ),
        [currentUser, encounter]
    )

    const [pickedEncounterId, setPickedEncounterId] = useState(null)
    const [searchParams, setSearchParams] = useSearchParams()

    useEffect(() => {
        const raw = searchParams.get('encounterId') || searchParams.get('ticketId')
        const ticketParam = searchParams.get('ticket')
        if (raw) {
            const parsed = isNaN(Number(raw)) ? raw : Number(raw)
            setPickedEncounterId(parsed)
        } else if (ticketParam && queue.length > 0) {
            const num = ticketParam.replace(/\D/g, '')
            const matched = queue.find((t) =>
                String(t.so_thu_tu_kham) === String(num) ||
                String(t.ticket_code || '').toLowerCase() === String(ticketParam).toLowerCase()
            )
            if (matched && matched.encounter_id) {
                setPickedEncounterId(matched.encounter_id)
            }
        }
    }, [searchParams])
    const [queueFilter, setQueueFilter] = useState('cho_kham')
    const [step, setStep] = useState(1)

    const validateClinicalStep = () => {
        if (isReadOnly) return true
        const exam = formik.values.kham_chuyen_khoa || {}
        const rawKhoa = resolvedSpecialty?.key || exam.khoa || encounter?.chuyen_khoa_kham
        const spec = findSpecialtyExam(rawKhoa)
        const items = exam.items || {}
        const done = spec.items.filter((label) => items[label]?.status).length

        if (done === 0) {
            AppToast.warning('Bác sĩ chưa thực hiện khám chuyên khoa. Vui lòng chọn Bình thường hoặc Bất thường trước khi chuyển sang Cận lâm sàng!')
            return false
        }

        if (done < spec.items.length) {
            AppToast.warning(`Mục khám chuyên khoa chưa hoàn tất (đã khám ${done}/${spec.items.length} mục). Vui lòng đánh giá các mục còn lại trước khi chuyển sang Cận lâm sàng!`)
            return false
        }

        const missingNotes = Object.entries(items).filter(
            ([label, it]) => it?.status === 'BAT' && !String(it?.note || '').trim()
        )
        if (missingNotes.length > 0) {
            AppToast.warning(`Cần mô tả mục bất thường: ${missingNotes.map(([label]) => label).join(', ')}`)
            return false
        }

        return true
    }

    const handleStepChange = (targetStep) => {
        if (step === 1 && targetStep > 1) {
            if (!validateClinicalStep()) return
        }
        if (step === 2 && targetStep > 2 && pickedOrders.length > 0) {
            AppToast.warning('Bạn đang có chỉ định CLS chưa gửi ở Bước 2. Vui lòng bấm gửi chỉ định trước khi tiếp tục!')
            return
        }
        setStep(targetStep)
    }
    const [savedAt, setSavedAt] = useState(null)
    const [orderSubmitting, setOrderSubmitting] = useState(false)
    const [pickedOrders, setPickedOrders] = useState([])
    const [calling, setCalling] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [amendmentOpen, setAmendmentOpen] = useState(false)
    const [rxModalState, setRxModalState] = useState({ open: false, tab: 'print' })

    const locked = Boolean(encounter?.is_locked)
    const currentTicket = queue.find((t) => t.trang_thai === 'dang_kham')
    const encounterId = pickedEncounterId || null

    const activeTicket = useMemo(() => {
        if (!encounterId && !encounter?.ticket_id) return currentTicket || null
        return (
            queue.find(
                (t) =>
                    String(t.encounter_id) === String(encounterId) ||
                    (encounter?.ticket_id && String(t.ticket_id) === String(encounter.ticket_id))
            ) || (String(encounterId) === String(currentTicket?.encounter_id) ? currentTicket : null)
        )
    }, [queue, encounterId, encounter?.ticket_id, currentTicket])

    const isNotStarted = Boolean(
        !locked && activeTicket && String(activeTicket.trang_thai) === 'cho_kham'
    )
    const isReadOnly = locked

    const activeOrders = useMemo(
        () => (encounter?.danh_sach_chi_dinh || []).filter((o) => o.trang_thai !== 'da_huy'),
        [encounter?.danh_sach_chi_dinh]
    )

    const pendingClsOrders = useMemo(
        () => activeOrders.filter((o) => o.trang_thai !== 'da_co_ket_qua'),
        [activeOrders]
    )

    const hasPendingCls = pendingClsOrders.length > 0
    const isWaitingCls = Boolean(
        activeTicket?.trang_thai === 'tam_hoan' || encounter?.trang_thai === 'tam_hoan' || hasPendingCls
    )
    const hasClsReady = Boolean(
        activeTicket?.trang_thai === 'co_ket_qua_cls' ||
            (activeTicket?.ghi_chu && (
                activeTicket.ghi_chu.startsWith('⭐ CÓ KQ CLS') ||
                activeTicket.ghi_chu.startsWith('🚨 KQ CLS') ||
                activeTicket.ghi_chu.toLowerCase().includes('đã có kết quả')
            ))
    )

    const loadQueue = useCallback(() => dispatch(fetchDoctorQueueAsync()), [dispatch])

    useEffect(() => {
        loadQueue()
        dispatch(fetchServicesAsync())
        const timer = setInterval(loadQueue, QUEUE_POLL_MS)
        return () => clearInterval(timer)
    }, [dispatch, loadQueue])

    useEffect(() => {
        if (encounterId) {
            dispatch(fetchEncounterAsync(encounterId))
        } else {
            dispatch(clearEncounter())
        }
    }, [dispatch, encounterId])

    useEffect(() => {
        return () => {
            dispatch(clearEncounter())
        }
    }, [dispatch])

    useEffect(() => {
        const unsubCheckIn = clinicalEventBridge.on(CLINICAL_EVENTS.PATIENT_CHECKED_IN, (data) => {
            loadQueue()
            AppToast.info(`Bệnh nhân ${data?.patient?.fullName || data?.queueEntry?.ticketNumber || ''} vừa check-in vào phòng khám`)
        })
        return () => {
            unsubCheckIn()
        }
    }, [loadQueue])

    const checkReturnedResults = useCallback(async () => {
        const changed = await clinicalService.pollReturnedResults()
        if (changed.length === 0) return
        loadQueue()
        const shownId = encounter?.id ?? encounterId
        if (shownId && changed.some((c) => c.encounterId === shownId)) dispatch(fetchEncounterAsync(shownId))
        changed.forEach(({ order, patientName }) => {
            const text = `Đã có kết quả CLS: ${order.ten_dich_vu}${patientName ? ` — ${patientName}` : ''}`
            if (order.ket_qua_phan_loai === 'NGUY_KICH') AppToast.warning(`${text} (NGUY KỊCH)`)
            else AppToast.success(text)
        })
    }, [dispatch, loadQueue, encounterId, encounter?.id])

    useEffect(() => {
        checkReturnedResults()
        const timer = setInterval(checkReturnedResults, CLS_RESULT_POLL_MS)
        const off = clinicalEventBridge.on(CLINICAL_EVENTS.CLS_RESULT_RETURNED, checkReturnedResults)
        return () => {
            clearInterval(timer)
            off()
        }
    }, [checkReturnedResults])

    const selectEncounter = (id) => {
        setPickedEncounterId(id)
        setStep(1)
        setSavedAt(null)
        const nextParams = new URLSearchParams(searchParams)
        if (id) {
            nextParams.set('encounterId', id)
        } else {
            nextParams.delete('encounterId')
            nextParams.delete('ticket')
        }
        setSearchParams(nextParams, { replace: true })
    }

    const initialValues = useMemo(() => toFormValues(encounter), [encounter])

    const formik = useFormik({
        initialValues,
        enableReinitialize: true,
        validationSchema: vitalsSchema,
        onSubmit: () => {},
    })

    const draft = useMemo(
        () => ({ encounterId: encounter?.id, fields: Object.fromEntries(DRAFT_FIELDS.map((k) => [k, formik.values[k]])) }),
        [encounter?.id, formik.values]
    )
    const debouncedDraft = useDebounce(draft, 800)
    const lastSaved = useRef(null)
    const hasDraftErrors = Object.keys(formik.errors).some((k) => DRAFT_FIELDS.includes(k))

    useEffect(() => {
        if (!encounter || isReadOnly || hasDraftErrors || debouncedDraft.encounterId !== encounter.id) return
        const initialDraft = JSON.stringify(Object.fromEntries(DRAFT_FIELDS.map((k) => [k, initialValues[k]])))
        const serialized = JSON.stringify(debouncedDraft.fields)
        if (serialized === initialDraft || serialized === lastSaved.current) return
        lastSaved.current = serialized
        dispatch(saveEncounterDraftAsync({ encounterId: encounter.id, patch: debouncedDraft.fields }))
            .unwrap()
            .then((res) => setSavedAt(res.saved_at))
            .catch((msg) => AppToast.error(msg))
    }, [debouncedDraft, encounter, locked, hasDraftErrors, initialValues, dispatch, isReadOnly])

    const handleStartCurrentPatient = async () => {
        if (!encounterId) return
        setCalling(true)
        try {
            const ticket = await dispatch(startPatientAsync(encounterId)).unwrap()
            AppToast.success(`Đã bắt đầu phiên khám bệnh nhân #${ticket.so_thu_tu_kham} · ${ticket.ten_benh_nhan}!`)
            if (audioAnnouncer.isEnabled()) {
                audioAnnouncer.announcePatient(ticket.ten_benh_nhan, ticket.so_thu_tu_kham, 'buồng khám số 1')
            }
            loadQueue()
            dispatch(fetchEncounterAsync(encounterId))
        } catch (msg) {
            AppToast.error(msg)
        } finally {
            setCalling(false)
        }
    }

    const handleCallNext = async () => {
        setQueueFilter('cho_kham')
        setCalling(true)
        try {
            const ticket = await dispatch(callNextPatientAsync()).unwrap()
            AppToast.success(`Đã gọi số #${ticket.so_thu_tu_kham} · ${ticket.ten_benh_nhan}`)
            selectEncounter(ticket.encounter_id)
            loadQueue()
        } catch (msg) {
            AppToast.error(msg)
        } finally {
            setCalling(false)
        }
    }

    const handleRecall = async () => {
        if (!currentTicket) return
        try {
            const t = await dispatch(recallPatientAsync(currentTicket.ticket_id)).unwrap()
            AppToast.info(`Đã gọi lại số #${t.so_thu_tu_kham} (lần ${t.so_lan_goi})`)
        } catch (msg) {
            AppToast.error(msg)
        }
    }

    const handlePostponeForCls = async () => {
        const currentActiveOrdersCount = (encounter?.danh_sach_chi_dinh || []).filter((o) => o.trang_thai !== 'da_huy').length
        const currentActiveTicket = queue.find((t) => t.encounter_id === encounterId || t.ticket_id === encounter?.ticket_id) || currentTicket
        if (currentActiveOrdersCount === 0 && currentActiveTicket?.trang_thai !== 'tam_hoan' && encounter?.trang_thai !== 'tam_hoan') {
            AppToast.warning('Bệnh nhân chưa có chỉ định Cận lâm sàng nào để chuyển sang trạng thái Chờ CLS!')
            return
        }
        const activeTicket = currentActiveTicket
        const targetTicketId = activeTicket?.ticket_id || encounterId
        if (!targetTicketId) {
            AppToast.warning('Không tìm thấy thông tin lượt khám trong hàng đợi để tạm hoãn.')
            return
        }

        Modal.confirm({
            title: 'Tạm hoãn lượt khám chờ kết quả CLS?',
            content: (
                <div className="text-xs text-slate-600 space-y-1.5">
                    <p>Bệnh nhân sẽ được chuyển sang danh sách <strong>"Chờ kết quả CLS"</strong> để giải phóng buồng khám.</p>
                    <p>Khi phòng CLS trả kết quả, hệ thống sẽ tự động cấp điểm ưu tiên (+10.000) và xuất hiện ở mục <strong>Có KQ CLS ⭐</strong> để bác sĩ gọi lại ngay.</p>
                </div>
            ),
            okText: 'Xác nhận tạm hoãn',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    await dispatch(postponeTicketAsync(targetTicketId)).unwrap()
                    AppToast.info(`Đã chuyển ca khám sang trạng thái Chờ CLS thành công.`)
                    selectEncounter(null)
                    loadQueue()
                } catch (msg) {
                    AppToast.error(msg || 'Lỗi khi tạm hoãn')
                }
            },
        })
    }

    const handleCreateOrders = async (dichVuIds) => {
        if (!dichVuIds || dichVuIds.length === 0) return true
        setOrderSubmitting(true)
        try {
            await dispatch(createOrdersAsync({ encounterId: encounter.id, dichVuIds })).unwrap()
            AppToast.success(`Đã gửi ${dichVuIds.length} chỉ định Cận lâm sàng. Bệnh nhân đã chuyển sang danh sách "Chờ CLS"!`)
            loadQueue()
            setPickedOrders([])
            Modal.confirm({
                title: 'Đã gửi chỉ định CLS & Chuyển sang hàng đợi "Chờ CLS"!',
                content: (
                    <div className="space-y-2 text-xs text-slate-600">
                        <p>Bệnh nhân <strong>{encounter?.benh_nhan?.ho_ten || 'BN'}</strong> đã được chuyển sang danh sách <strong>"Chờ CLS"</strong> để đi làm xét nghiệm/CĐHA.</p>
                        <p>Bác sĩ có muốn giải phóng bàn khám để đón bệnh nhân tiếp theo (F2) trong lúc chờ kết quả không?</p>
                    </div>
                ),
                okText: 'Giải phóng & Gọi ca tiếp theo (F2)',
                cancelText: 'Ở lại ca này',
                onOk: () => {
                    selectEncounter(null)
                    handleCallNext()
                },
            })
            return true
        } catch (msg) {
            AppToast.error(msg)
            return false
        } finally {
            setOrderSubmitting(false)
        }
    }

    const handleCancelOrder = async (orderId) => {
        try {
            await dispatch(cancelOrderAsync({ encounterId: encounter.id, orderId })).unwrap()
            AppToast.info('Đã hủy chỉ định')
        } catch (msg) {
            AppToast.error(msg)
        }
    }

    const handleRateAi = async (payload) => {
        try {
            await dispatch(rateAiSuggestionAsync({ encounterId: encounter.id, payload })).unwrap()
            AppToast.success('Cảm ơn bác sĩ đã đánh giá gợi ý AI')
        } catch (msg) {
            AppToast.error(msg)
        }
    }

    const handleAmendment = async (payload) => {
        try {
            await dispatch(createAmendmentAsync({ encounterId: encounter.id, payload })).unwrap()
            AppToast.success('Đã gửi biên bản đính chính, chờ Trưởng khoa duyệt')
            return true
        } catch (msg) {
            AppToast.error(msg)
            return false
        }
    }

    const handleApplyPrescription = (items, note) => {
        formik.setFieldValue('danh_sach_thuoc', items)
        if (note && !formik.values.loi_dan_uong_thuoc) {
            formik.setFieldValue('loi_dan_uong_thuoc', note)
        }
    }

    const handleQuickCopyZaloText = async () => {
        const bn = encounter?.benh_nhan || {}
        const dxText = (formik.values.danh_sach_chan_doan || []).length > 0
            ? formik.values.danh_sach_chan_doan.map((d) => `${d.ma_icd10} - ${d.ten_benh_chan_doan}`).join('; ')
            : 'Chưa có chẩn đoán'

        const medLines = (formik.values.danh_sach_thuoc || []).length > 0
            ? formik.values.danh_sach_thuoc.map((m, idx) => {
                const dosage = m.lieu_dung || `Sáng: ${m.sang || 0}, Trưa: ${m.trua || 0}, Chiều: ${m.chieu || 0}, Tối: ${m.toi || 0}`
                return `${idx + 1}. ${m.ten_thuoc} (${m.ham_luong || 'Chuẩn'}) — SL: ${m.so_luong || computeQuantity(m)} ${m.don_vi_tinh || 'Viên'}\n   Cách dùng: ${dosage} ${m.cach_dung ? `(${m.cach_dung})` : ''}`
            }).join('\n')
            : '(Chưa kê đơn thuốc)'

        const summary = [
            `🏥 [CLINIC-AI] — TÓM TẮT ĐƠN THUỐC ĐIỀU TRỊ`,
            `Bệnh nhân: ${bn.ho_ten || 'Người bệnh'} (${bn.gioi_tinh || ''}, ${bn.tuoi || ''} tuổi) · Mã: ${bn.ma || ''}`,
            `Ngày khám: ${new Date().toLocaleDateString('vi-VN')} · Bác sĩ: ${encounter?.bac_si?.ho_ten || 'Bác sĩ điều trị'}`,
            `----------------------------------------`,
            `📋 CHẨN ĐOÁN: ${dxText}`,
            `----------------------------------------`,
            `💊 THUỐC ĐIỀU TRỊ:`,
            medLines,
            `----------------------------------------`,
            `📝 LỜI DẶN: ${formik.values.loi_dan_uong_thuoc || formik.values.loi_dan_bac_si || 'Uống thuốc đúng giờ theo đơn. Tái khám khi hết thuốc hoặc có dấu hiệu bất thường.'}`,
            formik.values.ngay_hen_tai_kham ? `📅 HẸN TÁI KHÁM: ${formik.values.ngay_hen_tai_kham}` : '',
            `Hotline tư vấn sức khỏe: 1900 6868`,
        ].filter(Boolean).join('\n')

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(summary)
            } else {
                const ta = document.createElement('textarea')
                ta.value = summary
                document.body.appendChild(ta)
                ta.select()
                document.execCommand('copy')
                document.body.removeChild(ta)
            }
            AppToast.success('Đã sao chép tóm tắt đơn thuốc vào bộ nhớ tạm! Bạn có thể dán (Ctrl+V) vào Zalo/SMS gửi bệnh nhân.')
        } catch {
            AppToast.error('Không thể truy cập Clipboard trình duyệt.')
        }
    }

    const doComplete = async () => {
        const v = formik.values
        const payload = {
            ...Object.fromEntries(DRAFT_FIELDS.map((k) => [k, v[k]])),
            kham_lam_sang_bo_phan_day_du: [composeSpecialtyText(v.kham_chuyen_khoa), v.kham_lam_sang_bo_phan].filter(Boolean).join('\n'),
            danh_sach_chan_doan: v.danh_sach_chan_doan,
            ket_luan_dieu_tri: v.ket_luan_dieu_tri,
            loi_dan_bac_si: v.loi_dan_bac_si,
            ngay_hen_tai_kham: v.ngay_hen_tai_kham || null,
            don_thuoc: {
                loi_dan_uong_thuoc: v.loi_dan_uong_thuoc,
                trang_thai: v.trang_thai_don_thuoc || 'DRAFT',
                ngay_ky: v.ngay_ky || null,
                chu_ky_so: v.chu_ky_so || null,
                nguoi_ky: v.nguoi_ky || null,
                danh_sach_thuoc: v.danh_sach_thuoc.map((r) => ({
                    ...r,
                    so_luong: computeQuantity(r),
                    cach_dung_day_du: [doseText(r), r.cach_dung].filter(Boolean).join(' – '),
                })),
            },
            trang_thai_don_thuoc: v.trang_thai_don_thuoc || 'DRAFT',
            ngay_ky: v.ngay_ky || null,
            chu_ky_so: v.chu_ky_so || null,
            nguoi_ky: v.nguoi_ky || null,
        }
        try {
            const completedEnc = await dispatch(completeEncounterAsync({ encounterId: encounter.id, payload })).unwrap()
            AppToast.success('Đã hoàn tất khám và khóa bệnh án! Chuyển sang danh sách Đã xong.')
            await loadQueue()
            setQueueFilter('da_kham')
            if (completedEnc?.id) {
                selectEncounter(completedEnc.id)
            }
        } catch (msg) {
            AppToast.error(msg)
        }
    }

    const handleComplete = async () => {
        if (encounter && !encounter.thoi_gian_bat_dau) {
            encounter.thoi_gian_bat_dau = new Date().toISOString()
        }

        if (step !== 4) {
            AppToast.warning('Bạn cần hoàn thành các bước tuần tự đến Bước 4 (Đơn thuốc & Dặn dò) trước khi hoàn tất ca khám!')
            setStep(4)
            return
        }

        if (pickedOrders.length > 0) {
            AppToast.warning(`Bạn đang chọn ${pickedOrders.length} dịch vụ CLS ở Bước 2 chưa gửi sang KTV. Vui lòng bấm gửi chỉ định trước khi hoàn tất!`)
            setStep(2)
            return
        }

        const pendingList = (encounter?.danh_sach_chi_dinh || []).filter(
            (o) => o.trang_thai !== 'da_huy' && o.trang_thai !== 'da_co_ket_qua'
        )

        if (isWaitingCls || pendingList.length > 0) {
            Modal.warning({
                title: 'Chưa thể kết thúc ca khám!',
                width: 520,
                content: (
                    <div className="space-y-3 text-xs text-slate-700 mt-2">
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed font-medium">
                            {activeTicket?.trang_thai === 'tam_hoan'
                                ? 'Bệnh nhân này hiện đang ở trạng thái "Chờ kết quả Cận lâm sàng". Bác sĩ chưa được phép kết thúc ca khám khi chưa có kết quả trả về từ phòng KTV.'
                                : `Ca khám này hiện có ${pendingList.length} chỉ định Cận lâm sàng đang thực hiện dở dang chưa có kết quả.`}
                        </div>

                        {pendingList.length > 0 && (
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-700 text-[11px] flex items-center justify-between">
                                    <span>Chỉ định CLS chưa có kết quả:</span>
                                    <span className="text-amber-800 font-bold">{pendingList.length} dịch vụ</span>
                                </div>
                                <ul className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
                                    {pendingList.map((o) => (
                                        <li key={o.id || o.dich_vu_id} className="px-3 py-2 flex items-center justify-between bg-white hover:bg-slate-50">
                                            <div>
                                                <span className="font-bold text-[#003553]">{o.ten_dich_vu || `Dịch vụ #${o.dich_vu_id}`}</span>
                                                <div className="text-[10px] text-slate-400">
                                                    {o.thoi_gian_chi_dinh ? `Chỉ định: ${formatDateTime(o.thoi_gian_chi_dinh)}` : 'Chỉ định trong ca'}
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                                {o.trang_thai === 'dang_thuc_hien' ? 'Đang làm' : 'Chờ thực hiện'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                    </div>
                ),
                okText: 'Chờ CLS (Giải phóng buồng khám)',
                cancelText: 'Đóng',
                okButtonProps: { className: '!bg-[#00A9E3] !font-bold' },
                onOk: () => handlePostponeForCls(),
            })
            return
        }

        const errors = await formik.validateForm()
        if (Object.keys(errors).length > 0) {
            AppToast.error('Sinh hiệu chưa hợp lệ, vui lòng kiểm tra lại.')
            return
        }
        if (!validateClinicalStep()) {
            setStep(1)
            return
        }
        const primary = (formik.values.danh_sach_chan_doan || []).filter((d) => d.loai_chan_doan === 'chinh')
        if (primary.length !== 1) {
            formik.setFieldError('danh_sach_chan_doan', 'Bắt buộc chọn đúng 1 mã bệnh chính (ICD-10) trước khi hoàn tất khám.')
            Modal.warning({
                title: 'Chưa thể kết thúc ca khám!',
                width: 480,
                content: (
                    <div className="space-y-3 text-xs text-slate-700 mt-2">
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 leading-relaxed font-medium">
                            {primary.length === 0
                                ? 'Bác sĩ chưa chọn Chẩn đoán chính (ICD-10). Theo quy định Thông tư 32/2023/TT-BYT, hồ sơ bệnh án bắt buộc phải có đúng 1 mã bệnh chính trước khi hoàn tất & khóa bệnh án.'
                                : 'Hồ sơ đang có nhiều hơn 1 chẩn đoán chính. Vui lòng chỉ chọn đúng 1 bệnh là chẩn đoán chính.'}
                        </div>
                    </div>
                ),
                okText: 'Đến Bước 3: Chẩn đoán',
                okButtonProps: { className: '!bg-[#00A9E3] !font-bold' },
                onOk: () => setStep(3),
            })
            return
        }

        Modal.confirm({
            title: 'Hoàn tất khám và khóa bệnh án?',
            content: (
                <div className="space-y-2 text-[13px]">
                    <p>Sau khi khóa, hồ sơ chuyển sang chỉ đọc theo Thông tư 32/2023/TT-BYT. Hệ thống sẽ tự động đồng bộ hóa đơn viện phí sang Quầy Thu ngân.</p>
                </div>
            ),
            okText: 'Khóa bệnh án',
            cancelText: 'Xem lại',
            onOk: doComplete,
        })
    }



    const primaryDiagnosis = (formik.values.danh_sach_chan_doan || []).find((d) => d.loai_chan_doan === 'chinh')
    const matchingTemplate = useMemo(() => {
        if (!primaryDiagnosis) return null
        const code = primaryDiagnosis.ma_icd10?.toUpperCase() || ''
        const name = (primaryDiagnosis.ten_benh_chan_doan || '').toLowerCase()
        return (
            SAMPLE_PRESCRIPTION_TEMPLATES.find((tpl) => {
                const tName = tpl.name.toLowerCase()
                if (code.startsWith('J02') && tName.includes('viêm họng')) return true
                if ((code.startsWith('K29') || code.startsWith('K21')) && (tName.includes('dạ dày') || tName.includes('gerd'))) return true
                if (code.startsWith('A09') && tName.includes('tiêu chảy')) return true
                if ((code.startsWith('A90') || code.startsWith('A97')) && tName.includes('sốt xuất huyết')) return true
                if (code.startsWith('I10') && (tName.includes('huyết áp') || tName.includes('tim mạch'))) return true
                if (name.includes('họng') && tName.includes('viêm họng')) return true
                if (name.includes('tiêu chảy') && tName.includes('tiêu chảy')) return true
                if (name.includes('dạ dày') && tName.includes('dạ dày')) return true
                return false
            }) || null
        )
    }, [primaryDiagnosis])

    useDoctorShortcuts({
        onCallNext: handleCallNext,
        onOpenTemplates: () => setRxModalState({ open: true, tab: 'templates' }),
        onSave: () => {
            if (encounter?.id && !locked) {
                AppToast.success('Đã lưu nháp hồ sơ khám thành công! (F5 / Ctrl+S)')
            }
        },
        onJumpToOrders: () => setStep(2),
        onOpenHistory: () => setHistoryOpen(true),
        onPrint: () => setRxModalState({ open: true, tab: 'print' }),
        onEscape: () => {
            if (rxModalState.open || historyOpen || amendmentOpen) {
                setRxModalState((prev) => ({ ...prev, open: false }))
                setHistoryOpen(false)
                setAmendmentOpen(false)
            } else if (encounterId) {
                selectEncounter(null)
            }
        },
    })

    return (
        <div className="flex flex-col gap-4 max-w-[1720px] mx-auto w-full">
            <div className="medpro-card flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-white border border-slate-200">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#003553] text-white font-extrabold text-sm shadow-xs">
                        HIS
                    </span>
                    <div>
                        <h1 className="text-[17px] font-extrabold text-[#003553] leading-tight">
                            Bàn Khám Lâm Sàng TT32
                        </h1>
                        <p className="text-[12px] text-slate-500">
                            Khoa: <strong className="text-slate-700">{resolvedSpecialty?.label || 'Khoa Nội tổng quát'}</strong> · {currentUser?.room || encounter?.ten_phong_kham || 'Buồng khám chuyên khoa'} · Phòng khám Đa khoa Clinic-AI
                        </p>
                    </div>
                </div>

                {encounterId && (
                    <div className="flex items-center gap-3">
                        <span className="text-[12px] text-slate-500 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                            <span className={`h-2 w-2 rounded-full ${savedAt ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                            {locked
                                ? 'Bệnh án đã khóa (Chỉ đọc)'
                                : savedAt
                                ? `Đã lưu nháp ${formatDateTime(savedAt).slice(-8)}`
                                : 'Tự động lưu nháp'}
                        </span>
                    </div>
                )}
            </div>

            <div className="flex flex-col lg:flex-row items-start gap-4">
                <QueuePanel
                    queue={queue}
                    loading={queueLoading}
                    error={queueError}
                    selectedEncounterId={encounterId}
                    onSelect={selectEncounter}
                    onRetry={loadQueue}
                    onCallNext={handleCallNext}
                    onRecall={handleRecall}
                    calling={calling}
                    currentTicket={currentTicket}
                    filter={queueFilter}
                    onFilterChange={setQueueFilter}
                />

                <section aria-label="Hồ sơ lượt khám" className="flex min-w-0 flex-1 flex-col gap-4 w-full">
                    {!encounterId && (
                        <div className="flex-1 min-h-[540px] flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200/90 bg-white p-8 text-center shadow-xs">
                            <div className="w-20 h-20 rounded-3xl bg-[#E8F4FD] flex items-center justify-center text-4xl text-[#00A9E3] mb-4 shadow-inner">
                                🩺
                            </div>
                            <h2 className="text-xl font-extrabold text-[#003553]">
                                Bàn Khám Đã Sẵn Sàng
                            </h2>
                            <p className="mt-2 text-xs text-slate-500 max-w-md leading-relaxed">
                                Chưa có ca khám nào đang mở. Bác sĩ vui lòng nhấn <strong>[Gọi số tiếp theo]</strong> hoặc chọn một bệnh nhân từ danh sách hàng đợi bên trái để bắt đầu phiên khám.
                            </p>

                            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleCallNext}
                                    disabled={calling}
                                    className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-[#00A9E3] hover:bg-[#0092c4] text-white font-extrabold text-sm shadow-md shadow-sky-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
                                >
                                    <ClinicIcon name="ArrowRight" size={17} weight="bold" />
                                    <span>{calling ? 'Đang gọi số…' : 'Gọi số tiếp theo (Ưu tiên)'}</span>
                                    <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded text-white font-mono">F2</span>
                                </button>
                            </div>

                            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
                                <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-3.5 text-left">
                                    <span className="text-[11px] font-medium text-slate-500">Bệnh nhân đang chờ</span>
                                    <p className="text-lg font-extrabold text-[#003553] mt-0.5">
                                        {queue.filter((t) => ['cho_kham', 'dang_kham'].includes(t.trang_thai)).length} lượt
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-amber-50/70 border border-amber-200/70 p-3.5 text-left">
                                    <span className="text-[11px] font-medium text-amber-800">Đang chờ KQ CLS</span>
                                    <p className="text-lg font-extrabold text-amber-900 mt-0.5">
                                        {queue.filter((t) => t.trang_thai === 'tam_hoan').length} lượt
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/70 p-3.5 text-left">
                                    <span className="text-[11px] font-medium text-emerald-800">Có kết quả CLS ⭐</span>
                                    <p className="text-lg font-extrabold text-emerald-900 mt-0.5">
                                        {queue.filter((t) => t.trang_thai === 'co_ket_qua_cls' || (t.ghi_chu && t.ghi_chu.toLowerCase().includes('kết quả'))).length} lượt
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {encounterId && encounterLoading && !encounter && (
                        <div className="medpro-card p-8">
                            <LoadingBlock text="Đang tải hồ sơ bệnh án điện tử…" />
                        </div>
                    )}

                    {encounterId && encounterError && (
                        <div className="medpro-card p-8">
                            <ErrorBlock message={encounterError} onRetry={() => dispatch(fetchEncounterAsync(encounterId))} />
                        </div>
                    )}

                    {encounterId && encounter && !encounterError && (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200/90 shadow-2xs">
                                <button
                                    type="button"
                                    onClick={() => selectEncounter(null)}
                                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:text-[#00A9E3] hover:border-[#00A9E3] hover:bg-sky-50 font-bold text-xs transition cursor-pointer group shadow-2xs"
                                    title="Đóng hồ sơ ca này và quay về Bàn khám trống (Phím tắt: Esc)"
                                >
                                    <ClinicIcon name="ArrowLeft" size={15} weight="bold" className="transition-transform group-hover:-translate-x-0.5 text-slate-500 group-hover:text-[#00A9E3]" />
                                    <span>Quay lại Bàn khám</span>
                                </button>

                                <div className="flex items-center gap-2">
                                    {locked ? (
                                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-800 text-white inline-flex items-center gap-1.5">
                                            <ClinicIcon name="LockKey" size={13} />
                                            Bệnh án đã hoàn tất &amp; khóa
                                        </span>
                                    ) : isWaitingCls ? (
                                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1.5">
                                            <ClinicIcon name="Clock" size={13} />
                                            Đang làm Cận lâm sàng (Chờ kết quả)
                                        </span>
                                    ) : hasClsReady ? (
                                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1.5 animate-pulse">
                                            ⭐ Đã có kết quả CLS · Sẵn sàng chẩn đoán
                                        </span>
                                    ) : (activeTicket?.trang_thai === 'dang_kham' || (encounter?.thoi_gian_bat_dau && !locked && !isWaitingCls && !hasClsReady)) ? (
                                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                            Đang trong phiên khám
                                        </span>
                                    ) : (
                                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 inline-flex items-center gap-1.5">
                                            <ClinicIcon name="Clock" size={13} />
                                            Chờ khám
                                        </span>
                                    )}
                                </div>
                            </div>

                            <PatientBanner
                                encounter={encounter}
                                vitals={formik.values}
                                onShowHistory={() => setHistoryOpen(true)}
                                activeTicket={activeTicket}
                                isWaitingCls={isWaitingCls}
                                hasClsReady={hasClsReady}
                                onStartExam={handleStartCurrentPatient}
                                calling={calling}
                            />



                            {locked && (
                                <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#003553] px-5 py-3.5 text-white">
                                    <ClinicIcon name="LockKey" size={22} className="text-[#00B5F1]" />
                                    <span className="min-w-[260px] flex-1 text-[13px] leading-relaxed">
                                        <strong>Bệnh án đã khóa lúc {formatDateTime(encounter.thoi_gian_khoa)}</strong> theo Thông tư 32/2023/TT-BYT. Hồ sơ chuyển sang chế độ chỉ đọc. Mọi thay đổi bắt buộc lập biên bản đính chính.
                                    </span>
                                    <button type="button" className="medpro-btn-amber text-xs !py-1.5" onClick={() => setAmendmentOpen(true)}>
                                        Biên bản đính chính
                                    </button>
                                </div>
                            )}

                            <ExamStepTabs
                                step={step}
                                locked={isReadOnly}
                                onChange={handleStepChange}
                                counts={{
                                    cls: (encounter.danh_sach_chi_dinh || []).length + (pickedOrders?.length || 0),
                                    diagnosis: (formik.values.danh_sach_chan_doan || []).length,
                                    rx: (formik.values.danh_sach_thuoc || []).length,
                                }}
                            />

                            <div className="medpro-card flex flex-col gap-5 p-5">
                                {step === 1 && <StepClinical formik={formik} encounter={encounter} locked={isReadOnly} />}
                                {step === 2 && (
                                    <StepOrders
                                        encounter={encounter}
                                        services={services}
                                        locked={isReadOnly}
                                        submitting={orderSubmitting}
                                        onSubmit={handleCreateOrders}
                                        onCancelOrder={handleCancelOrder}
                                        picked={pickedOrders}
                                        onPickedChange={setPickedOrders}
                                    />
                                )}
                                {step === 3 && (
                                    <StepDiagnosis
                                        formik={formik}
                                        encounter={encounter}
                                        locked={isReadOnly}
                                        onRateAi={handleRateAi}
                                        pickedOrders={pickedOrders}
                                        services={services}
                                        onSendPickedOrders={() => handleCreateOrders(pickedOrders)}
                                        onGoToStepOrders={() => setStep(2)}
                                    />
                                )}
                                {step === 4 && (
                                    <StepPrescription
                                        formik={formik}
                                        encounter={encounter}
                                        locked={isReadOnly}
                                        onOpenRxModal={(tab) => setRxModalState({ open: true, tab })}
                                    />
                                )}
                            </div>

                            <div className="sticky bottom-3 z-30 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-[#003553]">
                                        ICD-10: {(formik.values.danh_sach_chan_doan || []).length} · Thuốc: {(formik.values.danh_sach_thuoc || []).length} · CLS: {(encounter.danh_sach_chi_dinh || []).length}
                                    </span>
                                </div>


                                <div className="hidden xl:flex items-center gap-2 text-[11px] text-slate-500 mr-auto pl-1">
                                    <span className="font-semibold text-slate-400">Phím tắt:</span>
                                    <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-[#003553]">F2 Gọi số</span>
                                    <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-[#003553]">F4 Toa mẫu</span>
                                    <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-[#003553]">F5 Lưu</span>
                                    <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-[#003553]">F7 Cận lâm sàng</span>
                                    <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-[#003553]">F8 Đơn cũ</span>
                                    <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-[#003553]">F9 In đơn</span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2.5">
                                    <button
                                        type="button"
                                        onClick={handleQuickCopyZaloText}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 active:scale-95 transition cursor-pointer"
                                        title="Sao chép đơn thuốc dạng text để gửi Zalo hoặc SMS cho bệnh nhân"
                                    >
                                        <ClinicIcon name="Copy" size={15} />
                                        <span>Copy Zalo / SMS</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setRxModalState({ open: true, tab: 'print' })}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-sky-300 bg-sky-50 text-[#0077B6] text-xs font-bold hover:bg-sky-100 transition cursor-pointer"
                                    >
                                        <ClinicIcon name="Printer" size={15} />
                                        <span>In Đơn &amp; Mã QR</span>
                                    </button>

                                    {!locked && (activeOrders.length > 0 || isWaitingCls) && (
                                        <button
                                            type="button"
                                            onClick={handlePostponeForCls}
                                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                                                isWaitingCls
                                                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20'
                                                    : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                                            }`}
                                            title="Tạm hoãn lượt khám để gọi bệnh nhân tiếp theo trong khi chờ kết quả CLS"
                                        >
                                            <ClinicIcon name="Clock" size={15} />
                                            <span>Chờ CLS (Gọi ca tiếp)</span>
                                        </button>
                                    )}

                                    {step > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setStep(step - 1)}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 active:scale-95 transition cursor-pointer"
                                        >
                                            <ClinicIcon name="ArrowLeft" size={14} />
                                            <span>Quay lại</span>
                                        </button>
                                    )}

                                    {!locked && step < 4 && (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (step === 1) {
                                                    if (!validateClinicalStep()) return
                                                }
                                                if (step === 2 && pickedOrders.length > 0) {
                                                    const ok = await handleCreateOrders(pickedOrders)
                                                    if (!ok) return
                                                }
                                                setStep(step + 1)
                                            }}
                                            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#00A9E3] hover:bg-[#0092c4] text-white text-xs font-extrabold shadow-sm active:scale-95 transition cursor-pointer"
                                        >
                                            <span>Tiếp theo: {EXAM_STEPS[step]}</span>
                                            <ClinicIcon name="ArrowRight" size={15} />
                                        </button>
                                    )}

                                    {!locked && step === 4 && (
                                        <button
                                            type="button"
                                            onClick={handleComplete}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition cursor-pointer bg-[#00A9E3] text-white hover:bg-[#0092c4]"
                                            title="Hoàn tất khám & Khóa bệnh án"
                                        >
                                            <ClinicIcon name="LockKey" size={15} />
                                            <span>Hoàn tất khám &amp; Khóa bệnh án</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </section>
            </div>

            <Drawer title="Lịch sử bệnh án" open={historyOpen} onClose={() => setHistoryOpen(false)} width={420}>
                {(encounter?.lich_su || []).length === 0 ? (
                    <EmptyBlock icon="Clock" title="Chưa có lần khám trước" />
                ) : (
                    <div className="flex flex-col gap-3">
                        {encounter.lich_su.map((h) => (
                            <div key={h.id} className="rounded-xl bg-[#F5F9FC] p-3 border border-slate-100">
                                <div className="text-[12px] text-slate-500">
                                    {formatDate(h.ngay)} · {h.bac_si}
                                </div>
                                <div className="font-bold text-[#003553] mt-0.5">{h.chan_doan}</div>
                                {h.ghi_chu && <p className="text-xs text-slate-600 mt-1">{h.ghi_chu}</p>}
                            </div>
                        ))}
                    </div>
                )}
            </Drawer>

            <AmendmentModal open={amendmentOpen} onClose={() => setAmendmentOpen(false)} onSubmit={handleAmendment} />

            <PrescriptionPrintAndCopyModal
                isOpen={rxModalState.open}
                initialTab={rxModalState.tab}
                onClose={() => setRxModalState((prev) => ({ ...prev, open: false }))}
                encounter={encounter || {}}
                diagnoses={formik.values.danh_sach_chan_doan || []}
                prescriptionItems={formik.values.danh_sach_thuoc || []}
                prescriptionNote={formik.values.loi_dan_uong_thuoc || formik.values.loi_dan_bac_si || ''}
                onApplyOldPrescription={(items, note, srcId) => {
                    formik.setFieldValue('danh_sach_thuoc', items)
                    if (note && !formik.values.loi_dan_uong_thuoc) {
                        formik.setFieldValue('loi_dan_uong_thuoc', note)
                    }
                    if (encounter?.id && srcId) {
                        clinicalService.copyOldPrescription(encounter.id, srcId, items)
                    }
                }}
                onApplySampleTemplate={(items, note) => {
                    formik.setFieldValue('danh_sach_thuoc', items)
                    if (note && !formik.values.loi_dan_uong_thuoc) {
                        formik.setFieldValue('loi_dan_uong_thuoc', note)
                    }
                }}
            />
        </div>
    )
}
