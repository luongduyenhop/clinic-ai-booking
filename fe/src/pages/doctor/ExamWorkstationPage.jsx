import React from 'react'
import { Drawer } from 'antd'
import { useDoctorWorkstationLogic } from '../../hooks/useDoctorWorkstationLogic'
import { ClinicIcon } from '../../components/common/ClinicIcon'
import { formatDate, formatDateTime } from '../../utils/helpers/formatDate'
import QueuePanel from '../../components/doctor/exam/QueuePanel'
import PatientBanner from '../../components/doctor/exam/PatientBanner'
import ExamStepTabs from '../../components/doctor/exam/ExamStepTabs'
import StepClinical from '../../components/doctor/exam/StepClinical'
import StepOrders from '../../components/doctor/exam/StepOrders'
import StepDiagnosis from '../../components/doctor/exam/StepDiagnosis'
import StepPrescription from '../../components/doctor/exam/StepPrescription'
import AmendmentModal from '../../components/doctor/exam/AmendmentModal'
import PrescriptionPrintAndCopyModal from '../../components/doctor/PrescriptionPrintAndCopyModal'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../../components/doctor/clinical/StateBlocks'
import WorkstationHeaderBar from '../../components/doctor/exam/WorkstationHeaderBar'
import WorkstationEmptyState from '../../components/doctor/exam/WorkstationEmptyState'
import ExamActionBar from '../../components/doctor/exam/ExamActionBar'
import { clinicalService } from '../../services/doctor/ClinicalService'

export default function ExamWorkstationPage() {
    const {
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
        isReadOnly,
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
    } = useDoctorWorkstationLogic()

    return (
        <div className="flex flex-col gap-4 max-w-[1720px] mx-auto w-full">
            <WorkstationHeaderBar
                resolvedSpecialty={resolvedSpecialty}
                currentUser={currentUser}
                encounter={encounter}
                encounterId={encounterId}
                locked={locked}
                savedAt={savedAt}
            />

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
                        <WorkstationEmptyState
                            queue={queue}
                            calling={calling}
                            onCallNext={handleCallNext}
                        />
                    )}

                    {encounterId && encounterLoading && !encounter && (
                        <div className="medpro-card p-8">
                            <LoadingBlock text="Đang tải hồ sơ bệnh án điện tử…" />
                        </div>
                    )}

                    {encounterId && encounterError && (
                        <div className="medpro-card p-8 border-rose-200 bg-rose-50/40">
                            {String(encounterError).toLowerCase().includes('hết hạn') ||
                            String(encounterError).toLowerCase().includes('giấy phép') ||
                            String(encounterError).toLowerCase().includes('expired') ||
                            String(encounterError).toLowerCase().includes('403') ||
                            String(encounterError).toLowerCase().includes('đình chỉ') ? (
                                <div className="flex flex-col items-center text-center max-w-xl mx-auto py-4">
                                    <div className="w-14 h-14 rounded-2xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-600 mb-4 shadow-xs">
                                        <ClinicIcon name="WarningCircle" size={32} weight="bold" />
                                    </div>
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 bg-rose-100 px-3 py-1 rounded-full border border-rose-200 mb-2">
                                        HTTP 403 · Forbidden · Vi phạm CCHN
                                    </span>
                                    <h3 className="text-base font-extrabold text-rose-900 mb-2">
                                        CHỨNG CHỈ HÀNH NGHỀ KHÔNG HỢP LỆ — TỪ CHỐI THỰC HIỆN CA KHÁM
                                    </h3>
                                    <div className="p-3.5 bg-white rounded-xl border border-rose-200 text-rose-800 text-sm font-semibold leading-relaxed mb-4 text-left w-full shadow-2xs">
                                        {encounterError}
                                    </div>
                                    <p className="text-xs text-rose-600 max-w-lg mb-4">
                                        Theo Luật Khám bệnh, chữa bệnh 2023 và quy chế kiểm soát tuân thủ lâm sàng, bác sĩ có chứng chỉ hành nghề hết hạn hoặc bị đình chỉ không được phép tiếp nhận ca khám, kê đơn hoặc ký số hồ sơ bệnh án.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => selectEncounter(null)}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-900 transition shadow-xs"
                                    >
                                        <ClinicIcon name="ArrowLeft" size={14} weight="bold" />
                                        <span>Đóng hồ sơ ca khám</span>
                                    </button>
                                </div>
                            ) : (
                                <ErrorBlock
                                    message={encounterError}
                                    onRetry={() => selectEncounter(encounterId)}
                                />
                            )}
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
                                    <ClinicIcon
                                        name="ArrowLeft"
                                        size={15}
                                        weight="bold"
                                        className="transition-transform group-hover:-translate-x-0.5 text-slate-500 group-hover:text-[#00A9E3]"
                                    />
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
                                    <button
                                        type="button"
                                        className="medpro-btn-amber text-xs !py-1.5"
                                        onClick={() => setAmendmentOpen(true)}
                                    >
                                        Biên bản đính chính
                                    </button>
                                </div>
                            )}

                            <ExamStepTabs
                                step={step}
                                locked={isReadOnly}
                                onChange={handleStepChange}
                                hasOrders={(encounter.danh_sach_chi_dinh || []).some((order) => order.trang_thai !== 'da_huy')}
                                hasDiagnosis={(formik.values.danh_sach_chan_doan || []).length > 0}
                                hasPrescription={(formik.values.danh_sach_thuoc || []).length > 0}
                                hasPendingCls={isWaitingCls}
                                hasClsReady={hasClsReady}
                            />

                            <div className="flex flex-col gap-4">
                                {step === 1 && (
                                    <StepClinical
                                        formik={formik}
                                        locked={isReadOnly}
                                        encounter={encounter}
                                        resolvedSpecialty={resolvedSpecialty}
                                    />
                                )}

                                {step === 2 && (
                                    <StepOrders
                                        encounter={encounter}
                                        orders={encounter.danh_sach_chi_dinh || []}
                                        services={services}
                                        locked={isReadOnly}
                                        onSubmit={handleCreateOrders}
                                        onSubmitOrders={handleCreateOrders}
                                        onCancelOrder={handleCancelOrder}
                                        onPostponeForCls={handlePostponeForCls}
                                        submitting={orderSubmitting}
                                        picked={pickedOrders}
                                        pickedOrders={pickedOrders}
                                        onPickedChange={setPickedOrders}
                                        onPickedOrdersChange={setPickedOrders}
                                    />
                                )}

                                {step === 3 && (
                                    <StepDiagnosis
                                        formik={formik}
                                        locked={isReadOnly}
                                        encounter={encounter}
                                        aiData={encounter.phan_tich_ai}
                                        encounterId={encounter.id}
                                        onRateAi={handleRateAi}
                                        doctorSpecialty={resolvedSpecialty?.label || currentUser?.specialty || ''}
                                        clsOrders={encounter.danh_sach_chi_dinh || []}
                                        pickedOrders={pickedOrders}
                                        services={services}
                                        onSendPickedOrders={handleCreateOrders}
                                        onGoToStepOrders={() => handleStepChange(2)}
                                    />
                                )}

                                {step === 4 && (
                                    <StepPrescription
                                        formik={formik}
                                        locked={isReadOnly}
                                        encounter={encounter}
                                        matchingTemplate={matchingTemplate}
                                        onApplySampleTemplate={(items, note) => handleApplyPrescription(items, note)}
                                        onOpenRxModal={(tab) => setRxModalState({ open: true, tab: tab || 'print' })}
                                        onOpenAdvancedModal={() => setRxModalState({ open: true, tab: 'templates' })}
                                        onPrint={() => setRxModalState({ open: true, tab: 'print' })}
                                    />
                                )}

                                <ExamActionBar
                                    step={step}
                                    locked={locked}
                                    formikValues={formik.values}
                                    encounter={encounter}
                                    onPrevStep={() => setStep(step - 1)}
                                    onNextStep={async () => {
                                        if (step === 2 && pickedOrders.length > 0) {
                                            const ok = await handleCreateOrders(pickedOrders)
                                            if (!ok) return
                                        }
                                        handleStepChange(step + 1)
                                    }}
                                    onComplete={handleComplete}
                                    onQuickCopyZaloText={handleQuickCopyZaloText}
                                    onOpenPrintModal={() => setRxModalState({ open: true, tab: 'print' })}
                                />
                            </div>
                        </>
                    )}
                </section>
            </div>

            <Drawer
                title="Lịch sử bệnh án"
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                width={420}
            >
                {(encounter?.lich_su || []).length === 0 ? (
                    <EmptyBlock icon="Clock" title="Chưa có lần khám trước" />
                ) : (
                    <div className="flex flex-col gap-3">
                        {encounter.lich_su.map((historyItem) => (
                            <div key={historyItem.id} className="rounded-xl bg-[#F5F9FC] p-3 border border-slate-100">
                                <div className="text-[12px] text-slate-500">
                                    {formatDate(historyItem.ngay)} · {historyItem.bac_si}
                                </div>
                                <div className="font-bold text-[#003553] mt-0.5">{historyItem.chan_doan}</div>
                                {historyItem.ghi_chu && <p className="text-xs text-slate-600 mt-1">{historyItem.ghi_chu}</p>}
                            </div>
                        ))}
                    </div>
                )}
            </Drawer>

            <AmendmentModal
                open={amendmentOpen}
                onClose={() => setAmendmentOpen(false)}
                onSubmit={handleAmendment}
            />

            <PrescriptionPrintAndCopyModal
                key={`rx-modal-${rxModalState.open ? 'open' : 'closed'}-${rxModalState.tab}`}
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
