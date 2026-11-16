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
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">
                    ICD-10: {diagnosesCount} · Thuốc: {medsCount} · CLS: {ordersCount}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={onQuickCopyZaloText}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-[#00A9E3] active:scale-95 transition cursor-pointer"
                    title="Sao chép nội dung tóm tắt đơn thuốc dạng văn bản đẹp để gửi qua Zalo / SMS cho bệnh nhân"
                >
                    <ClinicIcon name="Copy" size={14} />
                    <span>Copy Zalo / SMS</span>
                </button>

                <button
                    type="button"
                    onClick={onOpenPrintModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-sky-200 bg-sky-50 text-[#00A9E3] hover:bg-sky-100 active:scale-95 transition cursor-pointer"
                    title="Xem trước mẫu in đơn thuốc chuẩn Bộ Y Tế, đơn kính và mã QR chuyển khoản"
                >
                    <ClinicIcon name="Printer" size={14} />
                    <span>In Đơn &amp; Mã QR</span>
                </button>

                {step > 1 && (
                    <button
                        type="button"
                        onClick={onPrevStep}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                    >
                        <ClinicIcon name="ArrowLeft" size={14} />
                        <span>Quay lại</span>
                    </button>
                )}

                {step < 4 && (
                    <button
                        type="button"
                        onClick={onNextStep}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#00A9E3] hover:bg-[#0092c4] text-white text-xs font-extrabold shadow-sm active:scale-95 transition cursor-pointer"
                    >
                        <span>Tiếp theo: {EXAM_STEPS[step]}</span>
                        <ClinicIcon name="ArrowRight" size={15} />
                    </button>
                )}

                {!locked && step === 4 && (
                    <button
                        type="button"
                        onClick={onComplete}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition cursor-pointer bg-[#00A9E3] text-white hover:bg-[#0092c4]"
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
