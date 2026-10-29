import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Drawer, Modal } from 'antd'
import {
    fetchDoctorQueueAsync,
    callNextPatientAsync,
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
import { AppToast } from '../../components/common/AppNotification'
import { ClinicIcon } from '../../components/common/ClinicIcon'
import { useDebounce } from '../../hooks/useDebounce'
import { formatDate, formatDateTime } from '../../utils/helpers/formatDate'
import QueuePanel from '../../components/doctor/exam/QueuePanel'
import PatientBanner from '../../components/doctor/exam/PatientBanner'
import ClinicalRail from '../../components/doctor/exam/ClinicalRail'
import ExamStepTabs from '../../components/doctor/exam/ExamStepTabs'
import StepClinical from '../../components/doctor/exam/StepClinical'
import StepOrders from '../../components/doctor/exam/StepOrders'
import StepDiagnosis from '../../components/doctor/exam/StepDiagnosis'
import { clinicalEventBridge, CLINICAL_EVENTS } from '../../services/clinicalEventBridge'
import StepPrescription from '../../components/doctor/exam/StepPrescription'
import { useDoctorShortcuts } from '../../hooks/useDoctorShortcuts'
import { SAMPLE_PRESCRIPTION_TEMPLATES } from '../../utils/constants/clinicalTemplates'
import { EXAM_STEPS, VITAL_FIELDS, computeQuantity, doseText } from '../../components/doctor/exam/examHelpers'
import { composeSpecialtyText } from '../../utils/constants/clinical'
import AmendmentModal from '../../components/doctor/exam/AmendmentModal'
import PrescriptionPrintAndCopyModal from '../../components/doctor/PrescriptionPrintAndCopyModal'
import { clinicalService } from '../../services/doctor/ClinicalService'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../../components/doctor/clinical/StateBlocks'

const QUEUE_POLL_MS = 15000

// Các trường được tự lưu nháp (PATCH lượt khám)
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

const toFormValues = (enc) => ({
    ly_do_vao_kham: enc?.ly_do_vao_kham || '',
    benh_su: enc?.benh_su || '',
    kham_lam_sang_bo_phan: enc?.kham_lam_sang_bo_phan || '',
    kham_chuyen_khoa: enc?.kham_chuyen_khoa || { khoa: enc?.chuyen_khoa_kham || null, items: {}, extras: {} },
    ...Object.fromEntries(VITAL_FIELDS.map((f) => [f.name, enc?.[f.name] ?? ''])),
    danh_sach_chan_doan: enc?.danh_sach_chan_doan || [],
    ket_luan_dieu_tri: enc?.ket_luan_dieu_tri || '',
    danh_sach_thuoc: enc?.don_thuoc?.danh_sach_thuoc || [],
    loi_dan_uong_thuoc: enc?.don_thuoc?.loi_dan_uong_thuoc || '',
    ngay_hen_tai_kham: enc?.ngay_hen_tai_kham || '',
    loi_dan_bac_si: enc?.loi_dan_bac_si || '',
})

export default function ExamWorkstationPage() {
    const dispatch = useDispatch()
    const { queue, queueLoading, queueError, encounter, encounterLoading, encounterError, services } = useSelector(
        (state) => state.doctor.clinical
    )

    const [pickedEncounterId, setPickedEncounterId] = useState(null)
    const [viewMode, setViewMode] = useState('unified') // 'unified' (Khám tổng hợp 3 cột - SimpleClinic) | 'stepper' (Từng bước)
    const [step, setStep] = useState(1)
    const [savedAt, setSavedAt] = useState(null)
    const [orderSubmitting, setOrderSubmitting] = useState(false)
    const [calling, setCalling] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [amendmentOpen, setAmendmentOpen] = useState(false)
    const [rxModalState, setRxModalState] = useState({ open: false, tab: 'print' })

    const locked = Boolean(encounter?.is_locked)
    const currentTicket = queue.find((t) => t.trang_thai === 'dang_kham')
    const encounterId = pickedEncounterId ?? currentTicket?.encounter_id ?? null

    const loadQueue = useCallback(() => dispatch(fetchDoctorQueueAsync()), [dispatch])

    useEffect(() => {
        loadQueue()
        dispatch(fetchServicesAsync())
        const timer = setInterval(loadQueue, QUEUE_POLL_MS)
        return () => clearInterval(timer)
    }, [dispatch, loadQueue])

    useEffect(() => {
        if (encounterId) dispatch(fetchEncounterAsync(encounterId))
    }, [dispatch, encounterId])

    useEffect(() => {
        const unsubCheckIn = clinicalEventBridge.on(CLINICAL_EVENTS.PATIENT_CHECKED_IN, (data) => {
            loadQueue()
            AppToast.info(`Bệnh nhân ${data?.patient?.fullName || data?.queueEntry?.ticketNumber || ''} vừa check-in vào phòng khám`)
        })
        const unsubCls = clinicalEventBridge.on(CLINICAL_EVENTS.CLS_RESULT_RETURNED, (data) => {
            loadQueue()
            if (encounterId && data?.encounterId === encounterId) {
                dispatch(fetchEncounterAsync(encounterId))
            }
            AppToast.success(`Đã có kết quả CLS: ${data?.order?.ten_dich_vu || ''} cho bệnh nhân!`)
        })
        return () => {
            unsubCheckIn()
            unsubCls()
        }
    }, [dispatch, loadQueue, encounterId])

    const selectEncounter = (id) => {
        setPickedEncounterId(id)
        setStep(1)
        setSavedAt(null)
    }

    const initialValues = useMemo(() => toFormValues(encounter), [encounter])

    const formik = useFormik({
        initialValues,
        enableReinitialize: true,
        validationSchema: vitalsSchema,
        onSubmit: () => {},
    })

    // Tự lưu nháp các trường lâm sàng (Debounced 800ms)
    const draft = useMemo(
        () => ({ encounterId: encounter?.id, fields: Object.fromEntries(DRAFT_FIELDS.map((k) => [k, formik.values[k]])) }),
        [encounter?.id, formik.values]
    )
    const debouncedDraft = useDebounce(draft, 800)
    const lastSaved = useRef(null)
    const hasDraftErrors = Object.keys(formik.errors).some((k) => DRAFT_FIELDS.includes(k))

    useEffect(() => {
        if (!encounter || locked || hasDraftErrors || debouncedDraft.encounterId !== encounter.id) return
        const initialDraft = JSON.stringify(Object.fromEntries(DRAFT_FIELDS.map((k) => [k, initialValues[k]])))
        const serialized = JSON.stringify(debouncedDraft.fields)
        if (serialized === initialDraft || serialized === lastSaved.current) return
        lastSaved.current = serialized
        dispatch(saveEncounterDraftAsync({ encounterId: encounter.id, patch: debouncedDraft.fields }))
            .unwrap()
            .then((res) => setSavedAt(res.saved_at))
            .catch((msg) => AppToast.error(msg))
    }, [debouncedDraft, encounter, locked, hasDraftErrors, initialValues, dispatch])

    const handleCallNext = async () => {
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

    // Tạm hoãn ca khám để giải phóng buồng khám khi bệnh nhân đi làm Cận lâm sàng (revita-be)
    const handlePostponeForCls = async () => {
        if (!currentTicket) return
        Modal.confirm({
            title: 'Tạm hoãn lượt khám chờ kết quả CLS?',
            content: (
                <div className="text-xs text-slate-600 space-y-1.5">
                    <p>Bệnh nhân sẽ được chuyển sang danh sách <strong>"Chờ kết quả CLS"</strong> để giải phóng buồng khám.</p>
                    <p>Khi phòng CLS trả kết quả, hệ thống sẽ tự động cấp điểm ưu tiên (+10.000) để bác sĩ gọi lại ngay.</p>
                </div>
            ),
            okText: 'Xác nhận tạm hoãn',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    await dispatch(postponeTicketAsync(currentTicket.ticket_id)).unwrap()
                    AppToast.info(`Đã chuyển ca khám #${currentTicket.so_thu_tu_kham} sang trạng thái Chờ CLS.`)
                    setPickedEncounterId(null)
                    loadQueue()
                } catch (msg) {
                    AppToast.error(msg || 'Lỗi khi tạm hoãn')
                }
            },
        })
    }

    const handleCreateOrders = async (dichVuIds) => {
        setOrderSubmitting(true)
        try {
            await dispatch(createOrdersAsync({ encounterId: encounter.id, dichVuIds })).unwrap()
            AppToast.success(`Đã gửi ${dichVuIds.length} chỉ định Cận lâm sàng`)
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

    // Nạp đơn thuốc từ Cột 3 (Toa mẫu hoặc Đơn cũ)
    const handleApplyPrescription = (items, note) => {
        formik.setFieldValue('danh_sach_thuoc', items)
        if (note && !formik.values.loi_dan_uong_thuoc) {
            formik.setFieldValue('loi_dan_uong_thuoc', note)
        }
    }

    // 1-Click Copy Tóm tắt Bệnh án & Đơn thuốc dạng Text gửi Zalo/SMS (SimpleClinic)
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
                danh_sach_thuoc: v.danh_sach_thuoc.map((r) => ({
                    ...r,
                    so_luong: computeQuantity(r),
                    cach_dung_day_du: [doseText(r), r.cach_dung].filter(Boolean).join(' – '),
                })),
            },
        }
        try {
            await dispatch(completeEncounterAsync({ encounterId: encounter.id, payload })).unwrap()
            AppToast.success('Đã hoàn tất khám và khóa bệnh án thành công!')
            loadQueue()
        } catch (msg) {
            AppToast.error(msg)
        }
    }

    const handleComplete = async () => {
        const errors = await formik.validateForm()
        if (Object.keys(errors).length > 0) {
            AppToast.error('Sinh hiệu chưa hợp lệ, vui lòng kiểm tra lại.')
            return
        }
        const missingNotes = Object.entries(formik.values.kham_chuyen_khoa?.items || {}).filter(
            ([, it]) => it?.status === 'BAT' && !String(it.note || '').trim()
        )
        if (missingNotes.length > 0) {
            AppToast.error(`Cần mô tả mục bất thường: ${missingNotes.map(([label]) => label).join(', ')}`)
            return
        }
        const primary = formik.values.danh_sach_chan_doan.filter((d) => d.loai_chan_doan === 'chinh')
        if (primary.length !== 1) {
            formik.setFieldError('danh_sach_chan_doan', 'Bắt buộc chọn đúng 1 mã bệnh chính (ICD-10) trước khi hoàn tất khám.')
            AppToast.error('Bắt buộc chọn đúng 1 mã bệnh chính (ICD-10) trước khi khóa bệnh án!')
            return
        }
        const pending = (encounter.danh_sach_chi_dinh || []).filter((o) => ['CHO_THUC_HIEN', 'da_chi_dinh', 'dang_thuc_hien'].includes(o.trang_thai)).length

        Modal.confirm({
            title: 'Hoàn tất khám và khóa bệnh án?',
            content: (
                <div className="space-y-2 text-[13px]">
                    <p>Sau khi khóa, hồ sơ chuyển sang chỉ đọc theo Thông tư 32/2023/TT-BYT. Hệ thống sẽ tự động đồng bộ hóa đơn viện phí sang Quầy Thu ngân.</p>
                    {pending > 0 && <p className="font-semibold text-amber-700">⚠️ Lưu ý: Còn {pending} chỉ định Cận lâm sàng chưa có kết quả.</p>}
                </div>
            ),
            okText: 'Khóa bệnh án',
            cancelText: 'Xem lại',
            onOk: doComplete,
        })
    }

    const scrollToAnchor = (id) => {
        const el = document.getElementById(id)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    // Tự động phát hiện Toa thuốc mẫu phù hợp theo Chẩn đoán chính ICD-10 (SimpleClinic)
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

    // Phím tắt bác sĩ khám bệnh (tClinic & SimpleClinic)
    useDoctorShortcuts({
        onCallNext: handleCallNext,
        onOpenTemplates: () => setRxModalState({ open: true, tab: 'templates' }),
        onSave: () => {
            if (encounter?.id && !locked) {
                AppToast.success('Đã lưu nháp hồ sơ khám thành công! (F5 / Ctrl+S)')
            }
        },
        onJumpToOrders: () => scrollToAnchor('sec-orders'),
        onOpenHistory: () => setHistoryOpen(true),
        onPrint: () => setRxModalState({ open: true, tab: 'print' }),
        onEscape: () => {
            setRxModalState((prev) => ({ ...prev, open: false }))
            setHistoryOpen(false)
            setAmendmentOpen(false)
        },
    })

    return (
        <div className="flex flex-col gap-4 max-w-[1720px] mx-auto w-full">
            {/* Top Workspace Header */}
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
                            Khoa: <strong className="text-slate-700">{encounter?.chuyen_khoa_kham || 'Nội tổng quát'}</strong> · Buồng khám số 1 · Phòng khám Đa khoa Clinic-AI
                        </p>
                    </div>
                </div>

                {/* Controls & Mode Switch */}
                <div className="flex items-center gap-3">
                    <span className="text-[12px] text-slate-500 hidden sm:inline-flex items-center gap-1.5 mr-1">
                        <span className={`h-2 w-2 rounded-full ${savedAt ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        {locked
                            ? 'Bệnh án đã khóa (Chỉ đọc)'
                            : savedAt
                            ? `Đã lưu nháp ${formatDateTime(savedAt).slice(-8)}`
                            : 'Tự động lưu nháp'}
                    </span>

                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setViewMode('unified')}
                            className={`py-1 px-3 rounded-lg transition cursor-pointer ${
                                viewMode === 'unified' ? 'bg-white text-[#003553] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Khám tổng hợp 3 cột
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('stepper')}
                            className={`py-1 px-3 rounded-lg transition cursor-pointer ${
                                viewMode === 'stepper' ? 'bg-white text-[#003553] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Từng bước tuần tự
                        </button>
                    </div>
                </div>
            </div>

            {/* 3-Column Layout: Hàng đợi (Cột 1) | Khám chính (Cột 2) | Trợ lý lâm sàng & CLS (Cột 3) */}
            <div className="flex flex-col lg:flex-row items-start gap-4">
                {/* CỘT 1: HÀNG ĐỢI (280px) */}
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
                />

                {/* CỘT 2: KHU VỰC KHÁM & KÊ ĐƠN CHÍNH (Flex-1) */}
                <section aria-label="Hồ sơ lượt khám" className="flex min-w-0 flex-1 flex-col gap-4 w-full">
                    {!encounterId && (
                        <div className="medpro-card p-8">
                            <EmptyBlock
                                icon="Stethoscope"
                                title="Chưa có bệnh nhân đang khám"
                                hint="Bấm nút “Gọi số tiếp theo” ở Cột hàng đợi bên trái hoặc nhấp chọn một bệnh nhân trong danh sách."
                            />
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

                    {encounter && !encounterError && (
                        <>
                            {/* Sticky Patient Banner with quick vitals pill */}
                            <PatientBanner
                                encounter={encounter}
                                vitals={formik.values}
                                onShowHistory={() => setHistoryOpen(true)}
                            />

                            {/* Cảnh báo Bệnh án đã khóa (TT32) */}
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

                            {/* Anchor Navigation Bar (Trong chế độ Unified) hoặc Stepper Tabs (Trong chế độ Stepper) */}
                            {viewMode === 'unified' ? (
                                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-bold">
                                    <span className="text-slate-400 uppercase text-[10px] px-2 tracking-wider">Di chuyển nhanh:</span>
                                    <button
                                        type="button"
                                        onClick={() => scrollToAnchor('sec-clinical')}
                                        className="py-1.5 px-3 rounded-xl bg-white text-[#003553] shadow-2xs hover:bg-[#E8F4FD] transition cursor-pointer"
                                    >
                                        🩺 1. Khám &amp; Sinh hiệu
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => scrollToAnchor('sec-orders')}
                                        className="py-1.5 px-3 rounded-xl bg-white text-[#003553] shadow-2xs hover:bg-[#E8F4FD] transition cursor-pointer"
                                    >
                                        🧪 2. Chỉ định CLS ({(encounter.danh_sach_chi_dinh || []).length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => scrollToAnchor('sec-diagnosis')}
                                        className="py-1.5 px-3 rounded-xl bg-white text-[#003553] shadow-2xs hover:bg-[#E8F4FD] transition cursor-pointer"
                                    >
                                        📋 3. Chẩn đoán ICD-10 ({(formik.values.danh_sach_chan_doan || []).length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => scrollToAnchor('sec-prescription')}
                                        className="py-1.5 px-3 rounded-xl bg-white text-[#003553] shadow-2xs hover:bg-[#E8F4FD] transition cursor-pointer"
                                    >
                                        💊 4. Kê đơn thuốc ({(formik.values.danh_sach_thuoc || []).length})
                                    </button>
                                </div>
                            ) : (
                                <ExamStepTabs step={step} locked={locked} onChange={setStep} />
                            )}

                            {/* CHẾ ĐỘ 1: UNIFIED SINGLE-SCREEN (KHÁM TỔNG HỢP LIÊN TỤC - SIMPLECLINIC) */}
                            {viewMode === 'unified' ? (
                                <div className="flex flex-col gap-4">
                                    {/* MỤC 1: KHÁM LÂM SÀNG & SINH HIỆU */}
                                    <div id="sec-clinical" className="medpro-card p-5 flex flex-col gap-4">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                            <h2 className="text-sm font-extrabold text-[#003553] uppercase tracking-wide flex items-center gap-2">
                                                <span>🩺 1. Khám Lâm Sàng &amp; Sinh Hiệu</span>
                                            </h2>
                                            <span className="text-xs text-slate-400">Đầy đủ sinh hiệu &amp; chuyên khoa</span>
                                        </div>
                                        <StepClinical formik={formik} encounter={encounter} locked={locked} />
                                    </div>

                                    {/* MỤC 2: CHỈ ĐỊNH CẬN LÂM SÀNG */}
                                    <div id="sec-orders" className="medpro-card p-5 flex flex-col gap-4">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                            <h2 className="text-sm font-extrabold text-[#003553] uppercase tracking-wide flex items-center gap-2">
                                                <span>🧪 2. Chỉ Định Cận Lâm Sàng</span>
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                                    {(encounter.danh_sach_chi_dinh || []).length} dịch vụ
                                                </span>
                                            </h2>
                                            {!locked && (
                                                <span className="text-xs text-slate-500">
                                                    Chỉ định xét nghiệm, X-quang, Siêu âm, Nội soi
                                                </span>
                                            )}
                                        </div>
                                        <StepOrders
                                            encounter={encounter}
                                            services={services}
                                            locked={locked}
                                            submitting={orderSubmitting}
                                            onSubmit={handleCreateOrders}
                                            onCancelOrder={handleCancelOrder}
                                        />
                                    </div>

                                    {/* MỤC 3: CHẨN ĐOÁN WHO ICD-10 */}
                                    <div id="sec-diagnosis" className="medpro-card p-5 flex flex-col gap-4">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                            <h2 className="text-sm font-extrabold text-[#003553] uppercase tracking-wide flex items-center gap-2">
                                                <span>📋 3. Chẩn Đoán Xác Định (WHO ICD-10)</span>
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                                    {(formik.values.danh_sach_chan_doan || []).length} mã bệnh
                                                </span>
                                            </h2>
                                            <span className="text-xs text-rose-600 font-medium">Bắt buộc đúng 1 chẩn đoán chính</span>
                                        </div>
                                        <StepDiagnosis formik={formik} encounter={encounter} locked={locked} onRateAi={handleRateAi} />
                                    </div>


                                    {/* GỢI Ý TOA MẪU TỰ ĐỘNG THEO ICD-10 (SimpleClinic) */}
                                    {matchingTemplate && (formik.values.danh_sach_thuoc || []).length === 0 && !locked && (
                                        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-300 shadow-2xs">
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-xl">💡</span>
                                                <div>
                                                    <div className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                                                        <span>Gợi ý phác đồ chuẩn cho chẩn đoán:</span>
                                                        <span className="underline decoration-teal-500 font-extrabold">{matchingTemplate.name}</span>
                                                    </div>
                                                    <div className="text-[11px] text-teal-800">
                                                        Bao gồm {matchingTemplate.items.length} thuốc: {matchingTemplate.items.map((m) => m.ten_thuoc).join(', ')}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleApplyPrescription(matchingTemplate.items, matchingTemplate.note)}
                                                className="px-3.5 py-1.5 rounded-lg bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 transition cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95"
                                            >
                                                <ClinicIcon name="BookmarkSimple" size={14} />
                                                <span>Nạp phác đồ này (1-Click)</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* MỤC 4: KÊ ĐƠN THUỐC ĐIỀU TRỊ */}
                                    <div id="sec-prescription" className="medpro-card p-5 flex flex-col gap-4">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                            <h2 className="text-sm font-extrabold text-[#003553] uppercase tracking-wide flex items-center gap-2">
                                                <span>💊 4. Đơn Thuốc Điều Trị &amp; Hẹn Tái Khám</span>
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                                    {(formik.values.danh_sach_thuoc || []).length} khoản thuốc
                                                </span>
                                            </h2>
                                            <div className="flex items-center gap-2">
                                                {!locked && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setRxModalState({ open: true, tab: 'templates' })}
                                                        className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg hover:bg-teal-100 transition"
                                                    >
                                                        📑 Nạp phác đồ mẫu
                                                    </button>
                                                )}
                                                {!locked && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setRxModalState({ open: true, tab: 'copy' })}
                                                        className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-200 transition"
                                                    >
                                                        📋 Đơn thuốc cũ
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <StepPrescription
                                            formik={formik}
                                            encounter={encounter}
                                            locked={locked}
                                            onOpenRxModal={(tab) => setRxModalState({ open: true, tab })}
                                        />
                                    </div>
                                </div>
                            ) : (
                                /* CHẾ ĐỘ 2: STEPPER (TỪNG BƯỚC TUẦN TỰ) */
                                <div className="medpro-card flex flex-col gap-5 p-5">
                                    {step === 1 && <StepClinical formik={formik} encounter={encounter} locked={locked} />}
                                    {step === 2 && (
                                        <StepOrders
                                            encounter={encounter}
                                            services={services}
                                            locked={locked}
                                            submitting={orderSubmitting}
                                            onSubmit={handleCreateOrders}
                                            onCancelOrder={handleCancelOrder}
                                        />
                                    )}
                                    {step === 3 && <StepDiagnosis formik={formik} encounter={encounter} locked={locked} onRateAi={handleRateAi} />}
                                    {step === 4 && (
                                        <StepPrescription
                                            formik={formik}
                                            encounter={encounter}
                                            locked={locked}
                                            onOpenRxModal={(tab) => setRxModalState({ open: true, tab })}
                                        />
                                    )}

                                    {/* Nút lật bước */}
                                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                                        {step > 1 ? (
                                            <button type="button" className="medpro-btn-outline" onClick={() => setStep(step - 1)}>
                                                Quay lại
                                            </button>
                                        ) : <div />}
                                        {step < 4 && (
                                            <button type="button" className="medpro-btn-primary" onClick={() => setStep(step + 1)}>
                                                Tiếp: {EXAM_STEPS[step]}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* THANH ĐIỀU HÀNH ĐÁY CỐ ĐỊNH (STICKY ACTION BAR - CHUẨN HIS) */}
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
                                    {/* 1-Click Copy Zalo/SMS (SimpleClinic) */}
                                    <button
                                        type="button"
                                        onClick={handleQuickCopyZaloText}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 active:scale-95 transition cursor-pointer"
                                        title="Sao chép đơn thuốc dạng text để gửi Zalo hoặc SMS cho bệnh nhân"
                                    >
                                        <ClinicIcon name="Copy" size={15} />
                                        <span>Copy Zalo / SMS</span>
                                    </button>

                                    {/* In Đơn thuốc & VietQR */}
                                    <button
                                        type="button"
                                        onClick={() => setRxModalState({ open: true, tab: 'print' })}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-sky-300 bg-sky-50 text-[#0077B6] text-xs font-bold hover:bg-sky-100 transition cursor-pointer"
                                    >
                                        <ClinicIcon name="Printer" size={15} />
                                        <span>In Đơn &amp; Mã QR</span>
                                    </button>

                                    {/* Nút Tạm hoãn giải phóng buồng khám khi bệnh nhân đi làm CLS (revita-be) */}
                                    {!locked && (encounter.danh_sach_chi_dinh || []).length > 0 && (
                                        <button
                                            type="button"
                                            onClick={handlePostponeForCls}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold hover:bg-amber-100 transition cursor-pointer"
                                            title="Tạm hoãn lượt khám để gọi bệnh nhân tiếp theo trong khi chờ kết quả CLS"
                                        >
                                            <ClinicIcon name="Clock" size={15} />
                                            <span>Chờ CLS (Gọi ca tiếp)</span>
                                        </button>
                                    )}

                                    {/* Hoàn tất khám & Khóa bệnh án */}
                                    {!locked && (
                                        <button
                                            type="button"
                                            onClick={handleComplete}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00A9E3] text-white text-xs font-extrabold shadow-sm hover:bg-[#0092c4] active:scale-95 transition cursor-pointer"
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

                {/* CỘT 3: TRỢ LÝ LÂM SÀNG & KẾT QUẢ CLS (330px) */}
                {encounter && !encounterError && (
                    <ClinicalRail
                        encounter={encounter}
                        onApplyPrescription={handleApplyPrescription}
                        onOpenOrderSection={() => scrollToAnchor('sec-orders')}
                        locked={locked}
                    />
                )}
            </div>

            {/* Drawer Lịch sử bệnh án cũ */}
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

            {/* Modal Biên bản đính chính */}
            <AmendmentModal open={amendmentOpen} onClose={() => setAmendmentOpen(false)} onSubmit={handleAmendment} />

            {/* Modal In Đơn Thuốc, Toa Mẫu & Sao Chép Đơn Cũ */}
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
