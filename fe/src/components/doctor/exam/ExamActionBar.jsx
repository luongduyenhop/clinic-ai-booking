import React from 'react'
import { ClinicIcon } from '../../common/ClinicIcon'
import { EXAM_STEPS } from './examHelpers'

export default function ExamActionBar({
    step,
    locked,
    formikValues,
    encounter,
    onPrevStep,
    onNextStep,
    onComplete,
    onQuickCopyZaloText,
    onOpenPrintModal,
}) {
    const diagnosesCount = (formikValues.danh_sach_chan_doan || []).length
    const medsCount = (formikValues.danh_sach_thuoc || []).length
    const ordersCount = (encounter?.danh_sach_chi_dinh || []).filter(
        (order) => order.trang_thai !== 'da_huy'
    ).length

    return (
        <div className="medpro-card flex flex-wrap items-center justify-between gap-3 bg-clinic-surface p-4 rounded-[6px]">
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-clinic-navy tabular-nums">
                    ICD-10: {diagnosesCount} · Thuốc: {medsCount} · CLS: {ordersCount}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={onQuickCopyZaloText}
                    className="medpro-btn-outline rounded-[6px] px-3.5 py-2 text-xs font-bold cursor-pointer"
                    title="Sao chép nội dung tóm tắt đơn thuốc dạng văn bản để gửi qua Zalo / SMS cho bệnh nhân"
                >
                    <ClinicIcon name="Copy" size={14} />
                    <span>Copy Zalo / SMS</span>
                </button>

                <button
                    type="button"
                    onClick={onOpenPrintModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] text-xs font-bold border border-clinic-info-border bg-clinic-surface-alt text-clinic-cta hover:bg-clinic-surface-tint transition-colors cursor-pointer"
                    title="Xem trước mẫu in đơn thuốc chuẩn Bộ Y Tế, đơn kính và mã QR chuyển khoản"
                >
                    <ClinicIcon name="Printer" size={14} />
                    <span>In Đơn &amp; Mã QR</span>
                </button>

                {step > 1 && (
                    <button
                        type="button"
                        onClick={onPrevStep}
                        className="medpro-btn-outline rounded-[6px] px-4 py-2 text-xs font-bold cursor-pointer"
                    >
                        <ClinicIcon name="ArrowLeft" size={14} />
                        <span>Quay lại</span>
                    </button>
                )}

                {step < 4 && (
                    <button
                        type="button"
                        onClick={onNextStep}
                        className="medpro-btn-primary rounded-[6px] px-4 py-2 text-xs font-bold cursor-pointer"
                    >
                        <span>Tiếp theo: {EXAM_STEPS[step]}</span>
                        <ClinicIcon name="ArrowRight" size={15} />
                    </button>
                )}

                {!locked && step === 4 && (
                    <button
                        type="button"
                        onClick={onComplete}
                        className="medpro-btn-primary rounded-[6px] px-4 py-2 text-xs font-bold cursor-pointer"
                        title="Hoàn tất khám & Khóa bệnh án"
                    >
                        <ClinicIcon name="LockKey" size={15} />
                        <span>Hoàn tất khám &amp; Khóa bệnh án</span>
                    </button>
                )}
            </div>
        </div>
    )
}
