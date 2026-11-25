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
import { printMedicalRecordDocument } from '../../utils/helpers/printMedicalDocuments'

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
        handleStartCurrentPatient,
        handleCallNext,
        handleRecall,
        handleCreateOrders,
        handleCancelOrder,
        handleRateAi,
        handleAmendment,
        handleQuickCopyZaloText,
        handleComplete,
    } = useDoctorWorkstationLogic()

    const handlePrintMedicalRecordDirect = () => {
        printMedicalRecordDocument({
            encounter,
            diagnoses: formik?.values?.danh_sach_chan_doan || [],
            prescriptionItems: formik?.values?.danh_sach_thuoc || [],
        })
    }

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
                            onSelectEncounter={selectEncounter}
                            onCallNext={handleCallNext}
                            calling={calling}
                        />
                    )}

                    {encounterId && encounterLoading && !encounter && (
                        <div className="medpro-card p-8">
                            <LoadingBlock text="Đang tải hồ sơ bệnh án điện tử…" />
                        </div>
                    )}

                    {encounterId && encounterError && (
                        <div className="medpro-card p-8">
                            <ErrorBlock
                                message={encounterError}
                                onRetry={() => selectEncounter(encounterId)}
                            />
                        </div>
                    )}

                    {encounterId && encounter && !encounterError && (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-clinic-surface px-4 py-2.5 rounded-[6px] border border-clinic-border">
                                <button
                                    type="button"
                                    onClick={() => selectEncounter(null)}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] border border-clinic-border bg-clinic-bg text-clinic-navy hover:text-clinic-cta hover:border-clinic-cta font-bold text-xs transition-colors cursor-pointer"
                                    title="Đóng hồ sơ ca này và quay về Bàn khám trống (Phím tắt: Esc)"
                                >
                                    <ClinicIcon
                                        name="ArrowLeft"
                                        size={15}
                                        weight="bold"
                                        className="text-clinic-text-secondary"
                                    />
                                    <span>Quay lại Bàn khám</span>
                                </button>

                                <div className="flex items-center gap-2">
                                    {locked ? (
                                        <span className="medpro-badge-neutral inline-flex items-center gap-1.5">
                                            <ClinicIcon name="LockKey" size={13} />
                                            <span>Bệnh án đã hoàn tất &amp; khóa</span>
                                        </span>
                                    ) : isWaitingCls ? (
                                        <span className="medpro-badge-warning inline-flex items-center gap-1.5">
                                            <ClinicIcon name="Clock" size={13} />
                                            <span>Đang làm Cận lâm sàng (Chờ kết quả)</span>
                                        </span>
                                    ) : hasClsReady ? (
                                        <span className="medpro-badge-success inline-flex items-center gap-1.5">
                                            <ClinicIcon name="CheckCircle" size={13} weight="fill" />
                                            <span>Đã có kết quả CLS · Sẵn sàng chẩn đoán</span>
                                        </span>
                                    ) : (activeTicket?.trang_thai === 'dang_kham' || (encounter?.thoi_gian_bat_dau && !locked && !isWaitingCls && !hasClsReady)) ? (
                                        <span className="medpro-badge-success inline-flex items-center gap-1.5">
                                            <ClinicIcon name="Stethoscope" size={13} weight="bold" />
                                            <span>Đang trong phiên khám</span>
                                        </span>
                                    ) : (
                                        <span className="medpro-badge-warning inline-flex items-center gap-1.5">
                                            <ClinicIcon name="Clock" size={13} />
                                            <span>Chờ khám</span>
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
                                <div role="status" className="flex flex-wrap items-center gap-3 rounded-[6px] bg-clinic-navy px-5 py-3.5 text-clinic-surface">
                                    <ClinicIcon name="LockKey" size={20} className="text-clinic-surface" />
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
                                counts={{
                                    cls:
                                        (encounter.danh_sach_chi_dinh || []).filter((order) => order.trang_thai !== 'da_huy').length +
                                        (pickedOrders?.length || 0),
                                    diagnosis: (formik.values.danh_sach_chan_doan || []).length,
                                    rx: (formik.values.danh_sach_thuoc || []).length,
                                }}
                            />

                            <div className="medpro-card flex flex-col gap-5 p-5">
                                {step === 1 && (
                                    <StepClinical
                                        formik={formik}
                                        encounter={encounter}
                                        locked={isReadOnly}
                                    />
                                )}

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
                                        doctorSpecialty={resolvedSpecialty?.key || ''}
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
                                        onOpenRxModal={(tab) => setRxModalState({ open: true, tab: tab || 'print' })}
                                    />
                                )}
                            </div>

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
                                        handleStepChange(step + 1, { skipPickedCheck: true })
                                        return
                                    }
                                    handleStepChange(step + 1)
                                }}
                                onComplete={handleComplete}
                                onQuickCopyZaloText={handleQuickCopyZaloText}
                                onPrintMedicalRecord={handlePrintMedicalRecordDirect}
                                onPrintPrescription={() => setRxModalState({ open: true, tab: 'print' })}
                                onOpenPrintModal={() => setRxModalState({ open: true, tab: 'print' })}
                            />
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
                            <div key={historyItem.id} className="rounded-[6px] bg-clinic-bg p-3">
                                <div className="text-xs text-clinic-text-secondary tabular-nums">
                                    {formatDate(historyItem.ngay)} · {historyItem.bac_si}
                                </div>
                                <div className="font-bold text-clinic-navy mt-0.5">{historyItem.chan_doan}</div>
                                {historyItem.ghi_chu && <p className="text-xs text-clinic-text-secondary mt-1">{historyItem.ghi_chu}</p>}
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
                key={rxModalState.open ? rxModalState.tab : 'closed'}
                isOpen={rxModalState.open}
                initialTab={rxModalState.tab}
                onClose={() => setRxModalState((prev) => ({ ...prev, open: false }))}
                encounter={encounter || {}}
                patient={encounter?.benh_nhan || {}}
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
