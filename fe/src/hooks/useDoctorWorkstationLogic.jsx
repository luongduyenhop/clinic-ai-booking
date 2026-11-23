import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Modal } from 'antd'
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
} from '../redux/actions/doctor/clinicalAction'
import { clearEncounter } from '../redux/slices/doctor/clinicalSlice'
import { AppToast } from '../components/common/AppNotification'
import { useDebounce } from './useDebounce'
import { formatDateTime } from '../utils/helpers/formatDate'
import { audioAnnouncer } from '../utils/audioAnnouncer'
import { clinicalEventBridge, CLINICAL_EVENTS } from '../services/clinicalEventBridge'
import { useDoctorShortcuts } from './useDoctorShortcuts'
import { SAMPLE_PRESCRIPTION_TEMPLATES } from '../utils/constants/clinicalTemplates'
import { VITAL_FIELDS, computeQuantity, doseText } from '../components/doctor/exam/examHelpers'
import { composeSpecialtyText, findSpecialtyExam } from '../utils/constants/clinical'
import { clinicalService } from '../services/doctor/ClinicalService'

const QUEUE_POLL_MS = 15000
const CLS_RESULT_POLL_MS = 5000

const loadPersistedNotifiedKeys = () => {
    try {
        const raw = localStorage.getItem('cls_notified_result_keys') || sessionStorage.getItem('cls_notified_result_keys')
        return new Set(raw ? JSON.parse(raw) : [])
    } catch {
        return new Set()
    }
}

const savePersistedNotifiedKeys = (setObj) => {
    try {
        const data = JSON.stringify(Array.from(setObj).slice(-500))
        localStorage.setItem('cls_notified_result_keys', data)
        sessionStorage.setItem('cls_notified_result_keys', data)
    } catch {}
}

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
    const normalized = String(reason).trim().toLowerCase()
    const genericReasons = [
        'chờ khám bệnh',
        'cho kham benh',
        'chờ khám',
        'cho kham',
        'đang khám',
        'dang kham',
        'khám theo chỉ định tiếp đón',
    ]
    if (genericReasons.includes(normalized)) {
        return ''
    }
    return reason
}

const extractPrescriptionItems = (enc) => {
    const raw = (Array.isArray(enc?.danh_sach_thuoc) && enc.danh_sach_thuoc.length > 0)
        ? enc.danh_sach_thuoc
        : (Array.isArray(enc?.don_thuoc?.danh_sach_thuoc) && enc.don_thuoc.danh_sach_thuoc.length > 0)
        ? enc.don_thuoc.danh_sach_thuoc
        : (Array.isArray(enc?.don_thuoc?.danh_sach_chi_tiet) && enc.don_thuoc.danh_sach_chi_tiet.length > 0)
        ? enc.don_thuoc.danh_sach_chi_tiet
        : []

    return raw.map((m) => ({
        ...m,
        id: m.id || m.thuoc_id,
        ten_thuoc: m.ten_thuoc || m.ten || '',
        hoat_chat: m.hoat_chat || '',
        ham_luong: m.ham_luong || '',
        don_vi_tinh: m.don_vi_tinh || m.don_vi || 'Viên',
        so_luong: m.so_luong ?? 1,
        sang: m.sang ?? m.lieu_sang ?? '',
        trua: m.trua ?? m.lieu_trua ?? '',
        chieu: m.chieu ?? m.lieu_chieu ?? '',
        toi: m.toi ?? m.lieu_toi ?? '',
        so_ngay_dung: String(m.so_ngay_dung ?? m.so_ngay ?? '5'),
        cach_dung: m.cach_dung || m.cach_dung_day_du || '',
    }))
}

const toFormValues = (enc) => ({
    ly_do_vao_kham: sanitizeReason(enc?.ly_do_vao_kham),
    benh_su: enc?.benh_su || '',
    kham_lam_sang_bo_phan: enc?.kham_lam_sang_bo_phan || '',
    kham_chuyen_khoa: enc?.kham_chuyen_khoa || { khoa: enc?.chuyen_khoa_kham || null, items: {}, extras: {} },
    ...Object.fromEntries(VITAL_FIELDS.map((f) => [f.name, enc?.[f.name] ?? ''])),
    danh_sach_chan_doan: enc?.danh_sach_chan_doan || [],
    ket_luan_dieu_tri: enc?.ket_luan_dieu_tri || '',
    danh_sach_thuoc: extractPrescriptionItems(enc),
    loi_dan_uong_thuoc: enc?.loi_dan_uong_thuoc || enc?.don_thuoc?.loi_dan_uong_thuoc || '',
    trang_thai_don_thuoc: enc?.trang_thai_don_thuoc || enc?.don_thuoc?.trang_thai || 'DRAFT',
    ngay_ky: enc?.ngay_ky || enc?.don_thuoc?.ngay_ky || '',
    chu_ky_so: enc?.chu_ky_so || enc?.don_thuoc?.chu_ky_so || '',
    nguoi_ky: enc?.nguoi_ky || enc?.don_thuoc?.nguoi_ky || '',
    ngay_hen_tai_kham: enc?.ngay_hen_tai_kham || '',
    loi_dan_bac_si: enc?.loi_dan_bac_si || '',
})

export function useDoctorWorkstationLogic() {
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
            const matched = queue.find(
                (t) =>
                    String(t.so_thu_tu_kham) === String(num) ||
                    String(t.ticket_code || '').toLowerCase() === String(ticketParam).toLowerCase()
            )
            if (matched && matched.encounter_id) {
                setPickedEncounterId(matched.encounter_id)
            }
        }
    }, [searchParams, queue])

    const [queueFilter, setQueueFilter] = useState('cho_kham')
    const [savedAt, setSavedAt] = useState(null)
    const [orderSubmitting, setOrderSubmitting] = useState(false)
    const [pickedOrders, setPickedOrders] = useState([])
    const [calling, setCalling] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [amendmentOpen, setAmendmentOpen] = useState(false)
    const [rxModalState, setRxModalState] = useState({ open: false, tab: 'print' })
    const notifiedResultsRef = useRef(loadPersistedNotifiedKeys())

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
        activeTicket?.trang_thai === 'cho_kham' ||
            (activeTicket && !encounter?.thoi_gian_bat_dau && activeTicket?.trang_thai !== 'dang_kham')
    )
    const isReadOnly = locked || isNotStarted

    const orderList = encounter?.danh_sach_chi_dinh || []
    const hasPendingCls = orderList.some((o) => o.trang_thai !== 'da_huy' && o.trang_thai !== 'da_co_ket_qua')
    const hasCompletedCls = orderList.some((o) => o.trang_thai === 'da_co_ket_qua')

    const isWaitingCls = Boolean(
        activeTicket?.trang_thai === 'tam_hoan' || encounter?.trang_thai === 'tam_hoan' || hasPendingCls
    )
    const hasClsReady = Boolean(
        activeTicket?.trang_thai === 'co_ket_qua_cls' ||
            (activeTicket?.ghi_chu &&
                (activeTicket.ghi_chu.startsWith('⭐ CÓ KQ CLS') ||
                    activeTicket.ghi_chu.startsWith('🚨 KQ CLS') ||
                    activeTicket.ghi_chu.toLowerCase().includes('đã có kết quả'))) ||
            hasCompletedCls
    )

    const [step, setStep] = useState(1)

    useEffect(() => {
        if (!encounter) return
        if (hasClsReady || hasCompletedCls) {
            setStep(3)
        } else {
            setStep(1)
        }
    }, [encounter?.id, hasClsReady, hasCompletedCls])

    const initialValues = useMemo(() => toFormValues(encounter), [encounter])

    const formik = useFormik({
        initialValues,
        enableReinitialize: true,
        validationSchema: vitalsSchema,
        onSubmit: () => {},
    })

    const formikRef = useRef(formik)
    formikRef.current = formik

    const validateClinicalStep = useCallback(() => {
        if (isReadOnly || hasClsReady || hasCompletedCls) return true
        const exam = formikRef.current?.values?.kham_chuyen_khoa || formik.values.kham_chuyen_khoa || {}
        const rawKhoa = resolvedSpecialty?.key || exam.khoa || encounter?.chuyen_khoa_kham
        const spec = findSpecialtyExam(rawKhoa)
        const items = exam.items || {}
        const done = spec.items.filter((label) => items[label]?.status).length

        if (done === 0) {
            AppToast.warning(
                'Bác sĩ chưa thực hiện khám chuyên khoa. Vui lòng chọn Bình thường hoặc Bất thường trước khi chuyển sang Cận lâm sàng!'
            )
            return false
        }

        if (done < spec.items.length) {
            AppToast.warning(
                `Mục khám chuyên khoa chưa hoàn tất (đã khám ${done}/${spec.items.length} mục). Vui lòng đánh giá các mục còn lại trước khi chuyển sang Cận lâm sàng!`
            )
            return false
        }

        const missingNotes = Object.entries(items).filter(
            ([, it]) => it?.status === 'BAT' && !String(it?.note || '').trim()
        )
        if (missingNotes.length > 0) {
            AppToast.warning(`Cần mô tả mục bất thường: ${missingNotes.map(([label]) => label).join(', ')}`)
            return false
        }

        return true
    }, [isReadOnly, hasClsReady, hasCompletedCls, resolvedSpecialty, encounter, formik.values.kham_chuyen_khoa])

    const handleStepChange = useCallback(
        (targetStep) => {
            if (step === 1 && targetStep > 1 && !hasClsReady && !hasCompletedCls) {
                if (!validateClinicalStep()) return
            }
            if (step === 2 && targetStep > 2 && pickedOrders.length > 0) {
                AppToast.warning(
                    'Bạn đang có chỉ định CLS chưa gửi ở Bước 2. Vui lòng bấm gửi chỉ định trước khi tiếp tục!'
                )
                return
            }
            setStep(targetStep)
        },
        [step, hasClsReady, hasCompletedCls, validateClinicalStep, pickedOrders]
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
            AppToast.info(
                `Bệnh nhân ${data?.patient?.fullName || data?.queueEntry?.ticketNumber || ''} vừa check-in vào phòng khám`
            )
        })
        return () => {
            unsubCheckIn()
        }
    }, [loadQueue])

    const activeEncounterIdRef = useRef(encounter?.id ?? encounterId)
    useEffect(() => {
        activeEncounterIdRef.current = encounter?.id ?? encounterId
    }, [encounter?.id, encounterId])

    useEffect(() => {
        if (!encounter?.danh_sach_chi_dinh) return
        let updated = false
        encounter.danh_sach_chi_dinh.forEach((o) => {
            if (o.trang_thai === 'da_co_ket_qua' || o.trang_thai === 'da_duyet') {
                const id = String(o.server_order_id || o.chi_dinh_id || o.id || '')
                if (id && !notifiedResultsRef.current.has(id)) {
                    notifiedResultsRef.current.add(id)
                    updated = true
                }
            }
        })
        if (updated) {
            savePersistedNotifiedKeys(notifiedResultsRef.current)
        }
    }, [encounter?.danh_sach_chi_dinh])

    const checkReturnedResults = useCallback(
        async (isInitial = false) => {
            const changed = await clinicalService.pollReturnedResults()
            if (changed.length === 0) return
            loadQueue()
            const shownId = activeEncounterIdRef.current
            if (shownId && changed.some((c) => c.encounterId === shownId)) dispatch(fetchEncounterAsync(shownId))
            let hasNew = false
            changed.forEach(({ order, patientName }) => {
                const orderId = String(order.server_order_id || order.chi_dinh_id || order.id || '')
                if (!orderId || notifiedResultsRef.current.has(orderId)) return
                notifiedResultsRef.current.add(orderId)
                hasNew = true
                if (!isInitial) {
                    const text = `Đã có kết quả CLS: ${order.ten_dich_vu}${patientName ? ` — ${patientName}` : ''}`
                    if (order.ket_qua_phan_loai === 'NGUY_KICH') AppToast.warning(`${text} (NGUY KỊCH)`)
                    else AppToast.success(text)
                }
            })
            if (hasNew) {
                savePersistedNotifiedKeys(notifiedResultsRef.current)
            }
        },
        [dispatch, loadQueue]
    )

    useEffect(() => {
        checkReturnedResults(true)
        const timer = setInterval(() => checkReturnedResults(false), CLS_RESULT_POLL_MS)
        const off = clinicalEventBridge.on(CLINICAL_EVENTS.CLS_RESULT_RETURNED, () => checkReturnedResults(false))
        return () => {
            clearInterval(timer)
            off()
        }
    }, [checkReturnedResults])

    const selectEncounter = useCallback(
        (id) => {
            setPickedEncounterId(id)
            setSavedAt(null)
            const nextParams = new URLSearchParams(searchParams)
            if (id) {
                nextParams.set('encounterId', id)
            } else {
                nextParams.delete('encounterId')
                nextParams.delete('ticket')
            }
            setSearchParams(nextParams, { replace: true })
        },
        [searchParams, setSearchParams]
    )

    const draft = useMemo(
        () => ({
            encounterId: encounter?.id,
            fields: Object.fromEntries(DRAFT_FIELDS.map((k) => [k, formik.values[k]])),
        }),
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
        const currentActiveOrdersCount = (encounter?.danh_sach_chi_dinh || []).filter(
            (o) => o.trang_thai !== 'da_huy'
        ).length
        const currentActiveTicket =
            queue.find((t) => t.encounter_id === encounterId || t.ticket_id === encounter?.ticket_id) || currentTicket
        if (
            currentActiveOrdersCount === 0 &&
            currentActiveTicket?.trang_thai !== 'tam_hoan' &&
            encounter?.trang_thai !== 'tam_hoan'
        ) {
            AppToast.warning('Bệnh nhân chưa có chỉ định Cận lâm sàng nào để chuyển sang trạng thái Chờ CLS!')
            return
        }
        const activeItem = currentActiveTicket
        const targetTicketId = activeItem?.ticket_id || encounterId
        if (!targetTicketId) {
            AppToast.warning('Không tìm thấy thông tin lượt khám trong hàng đợi để tạm hoãn.')
            return
        }

        Modal.confirm({
            title: 'Tạm hoãn lượt khám chờ kết quả CLS?',
            content: (
                <div className="text-xs text-slate-600 space-y-1.5">
                    <p>
                        Bệnh nhân sẽ được chuyển sang danh sách <strong>"Chờ kết quả CLS"</strong> để giải phóng buồng khám.
                    </p>
                    <p>
                        Khi phòng CLS trả kết quả, hệ thống sẽ tự động cấp điểm ưu tiên (+10.000) và xuất hiện ở mục{' '}
                        <strong>Có KQ CLS ⭐</strong> để bác sĩ gọi lại ngay.
                    </p>
                </div>
            ),
            okText: 'Xác nhận tạm hoãn',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    await dispatch(postponeTicketAsync(targetTicketId)).unwrap()
                    AppToast.info('Đã chuyển ca khám sang trạng thái Chờ CLS thành công.')
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
            AppToast.success(
                `Đã gửi ${dichVuIds.length} chỉ định Cận lâm sàng. Bệnh nhân đã chuyển sang danh sách "Chờ CLS"!`
            )
            loadQueue()
            setPickedOrders([])
            Modal.confirm({
                title: 'Đã gửi chỉ định CLS & Chuyển sang hàng đợi "Chờ CLS"!',
                content: (
                    <div className="space-y-2 text-xs text-slate-600">
                        <p>
                            Bệnh nhân <strong>{encounter?.benh_nhan?.ho_ten || 'BN'}</strong> đã được chuyển sang danh sách{' '}
                            <strong>"Chờ CLS"</strong> để đi làm xét nghiệm/CĐHA.
                        </p>
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
        const dxText =
            (formik.values.danh_sach_chan_doan || []).length > 0
                ? formik.values.danh_sach_chan_doan.map((d) => `${d.ma_icd10} - ${d.ten_benh_chan_doan}`).join('; ')
                : 'Chưa có chẩn đoán'

        const medLines =
            (formik.values.danh_sach_thuoc || []).length > 0
                ? formik.values.danh_sach_thuoc
                      .map((m, idx) => {
                          const dosage =
                              m.lieu_dung ||
                              `Sáng: ${m.sang || 0}, Trưa: ${m.trua || 0}, Chiều: ${m.chieu || 0}, Tối: ${m.toi || 0}`
                          return `${idx + 1}. ${m.ten_thuoc} (${m.ham_luong || 'Chuẩn'}) — SL: ${
                              m.so_luong || computeQuantity(m)
                          } ${m.don_vi_tinh || 'Viên'}\n   Cách dùng: ${dosage} ${m.cach_dung ? `(${m.cach_dung})` : ''}`
                      })
                      .join('\n')
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
            `📝 LỜI DẶN: ${
                formik.values.loi_dan_uong_thuoc ||
                formik.values.loi_dan_bac_si ||
                'Uống thuốc đúng giờ theo đơn. Tái khám khi hết thuốc hoặc có dấu hiệu bất thường.'
            }`,
            formik.values.ngay_hen_tai_kham ? `📅 HẸN TÁI KHÁM: ${formik.values.ngay_hen_tai_kham}` : '',
            `Hotline tư vấn sức khỏe: 1900 6868`,
        ]
            .filter(Boolean)
            .join('\n')

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
            AppToast.success(
                'Đã sao chép tóm tắt đơn thuốc vào bộ nhớ tạm! Bạn có thể dán (Ctrl+V) vào Zalo/SMS gửi bệnh nhân.'
            )
        } catch {
            AppToast.error('Không thể truy cập Clipboard trình duyệt.')
        }
    }

    const doComplete = async () => {
        const v = formik.values
        const normalizedMeds = (v.danh_sach_thuoc || []).map((r) => ({
            ...r,
            so_luong: computeQuantity(r) || r.so_luong || 1,
            sang: r.sang || '',
            trua: r.trua || '',
            chieu: r.chieu || '',
            toi: r.toi || '',
            lieu_sang: r.sang || r.lieu_sang || '',
            lieu_trua: r.trua || r.lieu_trua || '',
            lieu_chieu: r.chieu || r.lieu_chieu || '',
            lieu_toi: r.toi || r.lieu_toi || '',
            cach_dung_day_du: [doseText(r), r.cach_dung].filter(Boolean).join(' – '),
        }))
        const payload = {
            ...Object.fromEntries(DRAFT_FIELDS.map((k) => [k, v[k]])),
            kham_lam_sang_bo_phan_day_du: [composeSpecialtyText(v.kham_chuyen_khoa), v.kham_lam_sang_bo_phan]
                .filter(Boolean)
                .join('\n'),
            danh_sach_chan_doan: v.danh_sach_chan_doan,
            ket_luan_dieu_tri: v.ket_luan_dieu_tri,
            loi_dan_bac_si: v.loi_dan_bac_si,
            ngay_hen_tai_kham: v.ngay_hen_tai_kham || null,
            danh_sach_thuoc: normalizedMeds,
            don_thuoc: {
                loi_dan_uong_thuoc: v.loi_dan_uong_thuoc,
                trang_thai: v.trang_thai_don_thuoc || 'DRAFT',
                ngay_ky: v.ngay_ky || null,
                chu_ky_so: v.chu_ky_so || null,
                nguoi_ky: v.nguoi_ky || null,
                danh_sach_thuoc: normalizedMeds,
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
            AppToast.warning(
                'Bạn cần hoàn thành các bước tuần tự đến Bước 4 (Đơn thuốc & Dặn dò) trước khi hoàn tất ca khám!'
            )
            setStep(4)
            return
        }

        if (pickedOrders.length > 0) {
            AppToast.warning(
                `Bạn đang chọn ${pickedOrders.length} dịch vụ CLS ở Bước 2 chưa gửi sang KTV. Vui lòng bấm gửi chỉ định trước khi hoàn tất!`
            )
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
                                        <li
                                            key={o.id || o.dich_vu_id}
                                            className="px-3 py-2 flex items-center justify-between bg-white hover:bg-slate-50"
                                        >
                                            <div>
                                                <span className="font-bold text-[#003553]">
                                                    {o.ten_dich_vu || `Dịch vụ #${o.dich_vu_id}`}
                                                </span>
                                                <div className="text-[10px] text-slate-400">
                                                    {o.thoi_gian_chi_dinh
                                                        ? `Chỉ định: ${formatDateTime(o.thoi_gian_chi_dinh)}`
                                                        : 'Chỉ định trong ca'}
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
            formik.setFieldError(
                'danh_sach_chan_doan',
                'Bắt buộc chọn đúng 1 mã bệnh chính (ICD-10) trước khi hoàn tất khám.'
            )
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
                    <p>
                        Sau khi khóa, hồ sơ chuyển sang chỉ đọc theo Thông tư 32/2023/TT-BYT. Hệ thống sẽ tự động đồng bộ
                        hóa đơn viện phí sang Quầy Thu ngân.
                    </p>
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
                if ((code.startsWith('K29') || code.startsWith('K21')) && (tName.includes('dạ dày') || tName.includes('gerd')))
                    return true
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
        onOpenHistory: () => {
            if (step === 4) {
                setRxModalState({ open: true, tab: 'copy' })
            } else {
                setHistoryOpen(true)
            }
        },
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

    return {
        currentUser,
        queue,
        queueLoading,
        queueError,
        encounter,
        encounterLoading,
        encounterError,
        services,
        resolvedSpecialty,
        encounterId,
        selectEncounter,
        queueFilter,
        setQueueFilter,
        savedAt,
        orderSubmitting,
        pickedOrders,
        setPickedOrders,
        calling,
        historyOpen,
        setHistoryOpen,
        amendmentOpen,
        setAmendmentOpen,
        rxModalState,
        setRxModalState,
        locked,
        currentTicket,
        activeTicket,
        isNotStarted,
        isReadOnly,
        orderList,
        hasPendingCls,
        hasCompletedCls,
        isWaitingCls,
        hasClsReady,
        step,
        setStep,
        handleStepChange,
        loadQueue,
        formik,
        matchingTemplate,
        handleStartCurrentPatient,
        handleCallNext,
        handleRecall,
        handlePostponeForCls,
        handleCreateOrders,
        handleCancelOrder,
        handleRateAi,
        handleAmendment,
        handleApplyPrescription,
        handleQuickCopyZaloText,
        handleComplete,
    }
}
