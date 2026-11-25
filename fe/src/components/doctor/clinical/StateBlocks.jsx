import { Spin } from 'antd'
import { ClinicIcon } from '../../common/ClinicIcon'

export function LoadingBlock({ text = 'Đang tải dữ liệu…' }) {
    return (
        <div className="flex items-center justify-center gap-3 py-10 text-clinic-text-secondary">
            <Spin size="small" />
            <span>{text}</span>
        </div>
    )
}

export function ErrorBlock({ message, onRetry }) {
    return (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
            <ClinicIcon name="WarningCircle" size={28} className="text-clinic-danger" />
            <p className="text-clinic-danger font-semibold">{message || 'Không tải được dữ liệu.'}</p>
            {onRetry && (
                <button type="button" className="medpro-btn-outline" onClick={onRetry}>
                    Thử lại
                </button>
            )}
        </div>
    )
}

export function EmptyBlock({ icon = 'ClipboardText', title, hint }) {
    return (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-clinic-text-secondary">
            <ClinicIcon name={icon} size={28} className="text-clinic-text-muted" />
            <p className="font-semibold text-clinic-navy">{title}</p>
            {hint && <p className="text-[12px]">{hint}</p>}
        </div>
    )
}
