import { Spin } from 'antd'
import { ClinicIcon } from '../../common/ClinicIcon'

// Trạng thái đang tải / lỗi / trống dùng chung cho các khối dữ liệu
export function LoadingBlock({ text = 'Đang tải dữ liệu…' }) {
    return (
        <div className="flex items-center justify-center gap-3 py-10 text-slate-500">
            <Spin size="small" />
            <span>{text}</span>
        </div>
    )
}

export function ErrorBlock({ message, onRetry }) {
    return (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
            <ClinicIcon name="WarningCircle" size={28} className="text-rose-600" />
            <p className="text-rose-700 font-semibold">{message || 'Không tải được dữ liệu.'}</p>
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
        <div className="flex flex-col items-center gap-2 py-10 text-center text-slate-500">
            <ClinicIcon name={icon} size={28} className="text-slate-400" />
            <p className="font-semibold text-slate-600">{title}</p>
            {hint && <p className="text-[12px]">{hint}</p>}
        </div>
    )
}
