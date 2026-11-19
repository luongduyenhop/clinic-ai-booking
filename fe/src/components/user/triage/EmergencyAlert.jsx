import { PhoneCall, WarningCircle } from '../../common/ClinicIcon'
import { redFlagOptions } from '../../../data/user/triageQuestionData'

export default function EmergencyAlert({ reasons, onReview }) {
    const labels = reasons?.map((reason) => redFlagOptions.find((item) => item.id === reason)?.label || reason)

    return (
        <div className="max-w-2xl mx-auto medpro-card border-2 border-clinic-danger p-6 sm:p-9 text-center">
            <span className="mx-auto w-16 h-16 rounded-[8px] border border-clinic-danger-border bg-clinic-danger-bg text-clinic-danger flex items-center justify-center">
                <WarningCircle size={36} weight="fill" />
            </span>

            <div className="mt-4">
                <span className="medpro-badge-danger uppercase tracking-wider">Cảnh báo cấp cứu</span>
            </div>

            <h1 className="mt-3 font-display text-2xl sm:text-3xl font-extrabold text-clinic-danger">
                Dấu hiệu cần được xử trí y tế khẩn cấp
            </h1>
            <p className="mt-3 text-sm leading-6 text-clinic-text-secondary">
                Không tiếp tục đặt lịch khám thông thường. Vui lòng gọi cấp cứu hoặc đến cơ sở y tế gần nhất ngay lúc này.
            </p>

            {labels?.length > 0 && (
                <div className="mt-5 rounded-[8px] border border-clinic-danger-border bg-clinic-danger-bg p-4 text-left text-xs leading-5 text-clinic-danger">
                    <strong>Dấu hiệu được ghi nhận:</strong> {labels.join(', ')}
                </div>
            )}

            <a
                href="tel:115"
                className="mt-6 inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-[8px] bg-clinic-danger px-8 text-base font-extrabold text-clinic-surface hover:opacity-90 tabular-nums"
            >
                <PhoneCall size={20} weight="fill" />
                <span>Gọi 115 ngay</span>
            </a>

            <p className="mt-5 text-xs text-clinic-text-muted">
                Nếu thông tin vừa chọn có nhầm lẫn, bạn có thể quay lại kiểm tra biểu mẫu khai báo.
            </p>
            <button
                type="button"
                onClick={onReview}
                className="mt-2.5 text-sm font-bold text-clinic-cta hover:underline cursor-pointer"
            >
                Kiểm tra lại câu trả lời
            </button>
        </div>
    )
}
