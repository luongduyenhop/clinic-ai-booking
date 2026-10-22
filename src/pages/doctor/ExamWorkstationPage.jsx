import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Drawer, Modal } from 'antd'
import {
    fetchDoctorQueueAsync,
    callNextPatientAsync,
    recallPatientAsync,
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
import ExamStepTabs from '../../components/doctor/exam/ExamStepTabs'
import StepClinical from '../../components/doctor/exam/StepClinical'
import StepOrders from '../../components/doctor/exam/StepOrders'
import StepDiagnosis from '../../components/doctor/exam/StepDiagnosis'
import StepPrescription from '../../components/doctor/exam/StepPrescription'
import { EXAM_STEPS, VITAL_FIELDS, computeQuantity, doseText } from '../../components/doctor/exam/examHelpers'
import { composeSpecialtyText } from '../../utils/constants/clinical'
import ClsResultRail from '../../components/doctor/exam/ClsResultRail'
import AmendmentModal from '../../components/doctor/exam/AmendmentModal'
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
    const [step, setStep] = useState(1)
    const [savedAt, setSavedAt] = useState(null)
    const [orderSubmitting, setOrderSubmitting] = useState(false)
    const [calling, setCalling] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [amendmentOpen, setAmendmentOpen] = useState(false)

    const locked = Boolean(encounter?.is_locked)
    const currentTicket = queue.find((t) => t.trang_thai === 'dang_kham')
    // Mặc định mở bệnh nhân đang khám nếu bác sĩ chưa chọn ai
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

    // Tự lưu nháp các trường lâm sàng. Bản nháp mang theo id lượt khám để không ghi nhầm sang bệnh nhân khác khi chuyển hồ sơ.
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
            AppToast.success(`Đã gọi số ${ticket.so_thu_tu_kham} · ${ticket.ten_benh_nhan}`)
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
            AppToast.info(`Đã gọi lại số ${t.so_thu_tu_kham} (lần ${t.so_lan_goi})`)
        } catch (msg) {
            AppToast.error(msg)
        }
    }

    const handleCreateOrders = async (dichVuIds) => {
        setOrderSubmitting(true)
        try {
            await dispatch(createOrdersAsync({ encounterId: encounter.id, dichVuIds })).unwrap()
            AppToast.success(`Đã gửi ${dichVuIds.length} chỉ định cận lâm sàng`)
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

    const doComplete = async () => {
        const v = formik.values
        const payload = {
            ...Object.fromEntries(DRAFT_FIELDS.map((k) => [k, v[k]])),
            // Backend chỉ có 1 trường kham_lam_sang_bo_phan: ghép phần khám chuyên khoa + khám toàn thân khi nối API
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
            AppToast.success('Đã hoàn tất khám và khóa bệnh án')
        } catch (msg) {
            AppToast.error(msg)
        }
    }

    const handleComplete = async () => {
        const errors = await formik.validateForm()
        if (Object.keys(errors).length > 0) {
            setStep(1)
            AppToast.error('Sinh hiệu chưa hợp lệ, vui lòng kiểm tra lại.')
            return
        }
        const missingNotes = Object.entries(formik.values.kham_chuyen_khoa?.items || {}).filter(
            ([, it]) => it?.status === 'BAT' && !String(it.note || '').trim()
        )
        if (missingNotes.length > 0) {
            setStep(1)
            AppToast.error(`Cần mô tả mục bất thường: ${missingNotes.map(([label]) => label).join(', ')}`)
            return
        }
        const primary = formik.values.danh_sach_chan_doan.filter((d) => d.loai_chan_doan === 'chinh')
        if (primary.length !== 1) {
            formik.setFieldError('danh_sach_chan_doan', 'Cần đúng 1 chẩn đoán chính (ICD-10) trước khi hoàn tất khám.')
            setStep(3)
            return
        }
        const pending = encounter.danh_sach_chi_dinh.filter((o) => ['da_chi_dinh', 'dang_thuc_hien'].includes(o.trang_thai)).length
        Modal.confirm({
            title: 'Hoàn tất khám và khóa bệnh án?',
            content: (
                <div className="space-y-2 text-[13px]">
                    <p>Sau khi khóa, hồ sơ chuyển sang chỉ đọc theo Thông tư 32/2023/TT-BYT. Mọi sửa đổi phải qua biên bản đính chính.</p>
                    {pending > 0 && <p className="font-semibold text-amber-700">Còn {pending} chỉ định CLS chưa có kết quả.</p>}
                </div>
            ),
            okText: 'Khóa bệnh án',
            cancelText: 'Xem lại',
            onOk: doComplete,
        })
    }

    return (
        <div className="flex flex-col gap-5">
            <div className="medpro-card flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-[220px] flex-1">
                    <h1 className="text-[20px] font-bold text-[#003553]">Bàn khám</h1>
                    <p className="text-[12px] text-slate-500">Gọi bệnh nhân theo thứ tự ưu tiên, khám và kết luận trên cùng một màn hình.</p>
                </div>
                <button type="button" className="medpro-btn-outline" onClick={handleRecall} disabled={!currentTicket}>
                    <ClinicIcon name="Bell" size={16} />
                    Gọi lại số đang khám
                </button>
                <button type="button" className="medpro-btn-primary" onClick={handleCallNext} disabled={calling}>
                    {calling ? 'Đang gọi…' : 'Gọi bệnh nhân tiếp'}
                    <ClinicIcon name="ArrowRight" size={16} weight="bold" />
                </button>
            </div>

            <div className="flex flex-wrap items-start gap-5">
                <QueuePanel
                    queue={queue}
                    loading={queueLoading}
                    error={queueError}
                    selectedEncounterId={encounterId}
                    onSelect={selectEncounter}
                    onRetry={loadQueue}
                />

                <section aria-label="Hồ sơ lượt khám" className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
                    {!encounterId && (
                        <div className="medpro-card">
                            <EmptyBlock icon="Stethoscope" title="Chưa có bệnh nhân đang khám" hint="Bấm “Gọi bệnh nhân tiếp” hoặc chọn một bệnh nhân trong hàng đợi." />
                        </div>
                    )}
                    {encounterId && encounterLoading && !encounter && (
                        <div className="medpro-card">
                            <LoadingBlock text="Đang tải hồ sơ lượt khám…" />
                        </div>
                    )}
                    {encounterId && encounterError && (
                        <div className="medpro-card">
                            <ErrorBlock message={encounterError} onRetry={() => dispatch(fetchEncounterAsync(encounterId))} />
                        </div>
                    )}

                    {encounter && !encounterError && (
                        <>
                            <PatientBanner encounter={encounter} onShowHistory={() => setHistoryOpen(true)} />

                            {locked && (
                                <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#003553] px-5 py-4 text-white">
                                    <ClinicIcon name="LockKey" size={22} className="text-[#00B5F1]" />
                                    <span className="min-w-[260px] flex-1 text-[13px] leading-relaxed">
                                        <strong>Bệnh án đã khóa lúc {formatDateTime(encounter.thoi_gian_khoa)}</strong> theo Thông tư 32/2023/TT-BYT. Hồ sơ chỉ đọc; mọi sửa đổi phải qua biên bản đính chính và được Trưởng khoa duyệt.
                                    </span>
                                    <button type="button" className="medpro-btn-amber" onClick={() => setAmendmentOpen(true)}>
                                        Tạo biên bản đính chính
                                    </button>
                                </div>
                            )}

                            <ExamStepTabs step={step} locked={locked} onChange={setStep} />

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
                                {step === 4 && <StepPrescription formik={formik} encounter={encounter} locked={locked} />}

                                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                                    <span className="flex-1 text-[12px] text-slate-500">
                                        {locked
                                            ? 'Hồ sơ chỉ đọc.'
                                            : savedAt
                                              ? `Đã tự lưu nháp lúc ${formatDateTime(savedAt)}`
                                              : 'Thay đổi được tự lưu nháp.'}
                                    </span>
                                    {step > 1 && (
                                        <button type="button" className="medpro-btn-outline" onClick={() => setStep(step - 1)}>
                                            Quay lại
                                        </button>
                                    )}
                                    {step < 4 && (
                                        <button type="button" className="medpro-btn-primary" onClick={() => setStep(step + 1)}>
                                            Tiếp: {EXAM_STEPS[step]}
                                        </button>
                                    )}
                                    {step === 4 && !locked && (
                                        <button type="button" className="medpro-btn-primary" onClick={handleComplete}>
                                            <ClinicIcon name="LockKey" size={16} />
                                            Hoàn tất khám &amp; khóa bệnh án
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </section>

                {encounter && !encounterError && <ClsResultRail encounter={encounter} />}
            </div>

            <Drawer title="Lịch sử bệnh án" open={historyOpen} onClose={() => setHistoryOpen(false)} size={420}>
                {(encounter?.lich_su || []).length === 0 ? (
                    <EmptyBlock icon="Clock" title="Chưa có lần khám trước" />
                ) : (
                    <div className="flex flex-col gap-3">
                        {encounter.lich_su.map((h) => (
                            <div key={h.id} className="rounded-xl bg-[#F5F9FC] p-3">
                                <div className="text-[12px] text-slate-500">
                                    {formatDate(h.ngay)} · {h.bac_si}
                                </div>
                                <div className="font-semibold text-[#003553]">{h.chan_doan}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Drawer>

            <AmendmentModal open={amendmentOpen} onClose={() => setAmendmentOpen(false)} onSubmit={handleAmendment} />
        </div>
    )
}
