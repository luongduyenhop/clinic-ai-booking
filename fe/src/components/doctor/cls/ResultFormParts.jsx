import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { uploadFileAsync } from '../../../redux/actions/doctor/clinicalAction'
import { AppToast } from '../../common/AppNotification'
import { ClinicIcon } from '../../common/ClinicIcon'
import { RESULT_CLASS } from '../../../utils/constants/clinical'

const MAX_SIZE = 10 * 1024 * 1024

export function FileAttachField({ label, value, onChange, accept = 'image/*,application/pdf', disabled }) {
    const dispatch = useDispatch()
    const [uploading, setUploading] = useState(false)

    const handleFile = async (e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        if (file.size > MAX_SIZE) {
            AppToast.error('Tệp vượt quá 10MB')
            return
        }
        setUploading(true)
        try {
            const res = await dispatch(uploadFileAsync(file)).unwrap()
            onChange({ url: res.url, ten_tep: res.ten_tep, la_anh: file.type.startsWith('image/') })
        } catch (msg) {
            AppToast.error(msg)
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <span className="medpro-label !mb-0">{label}</span>
            {value?.url ? (
                value.la_anh ? (
                    <img src={value.url} alt={value.ten_tep} className="aspect-[4/3] w-full rounded-[6px] bg-clinic-navy-dark object-contain" />
                ) : (
                    <a href={value.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-[6px] bg-clinic-surface-tint border border-clinic-info-border p-3 text-[13px] font-semibold text-clinic-cta">
                        <ClinicIcon name="FileText" size={18} /> {value.ten_tep}
                    </a>
                )
            ) : (
                <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-[6px] border-2 border-dashed border-clinic-border-strong text-[12px] text-clinic-text-secondary">
                    <ClinicIcon name="UploadSimple" size={22} />
                    Chưa có tệp
                </div>
            )}
            <label className={`medpro-btn-outline ${disabled || uploading ? 'pointer-events-none opacity-50' : ''}`}>
                {uploading ? 'Đang tải lên…' : value?.url ? 'Thay tệp' : 'Chọn tệp'}
                <input type="file" accept={accept} className="sr-only" onChange={handleFile} disabled={disabled || uploading} />
            </label>
            <span className="text-[11px] text-clinic-text-secondary">JPG, PNG hoặc PDF · tối đa 10MB</span>
        </div>
    )
}

export function PresetChips({ label, presets, onPick, disabled }) {
    const names = Object.keys(presets || {})
    if (names.length === 0) return null
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-clinic-text-secondary">{label}</span>
            {names.map((name) => (
                <button
                    key={name}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPick(name)}
                    className="rounded-[6px] bg-clinic-surface px-3 py-1.5 text-[12px] font-semibold text-clinic-navy border border-clinic-border transition hover:border-clinic-cta cursor-pointer disabled:cursor-not-allowed"
                >
                    {name}
                </button>
            ))}
        </div>
    )
}

export function ClassificationBar({ value, abnormalCount }) {
    const cls = RESULT_CLASS[value]
    const abnormal = value !== 'BINH_THUONG'
    return (
        <div className={`flex flex-wrap items-center gap-2 rounded-[6px] border px-4 py-3 text-[13px] ${abnormal ? 'bg-clinic-danger-bg border-clinic-danger-border' : 'bg-clinic-success-bg border-clinic-success-border'}`}>
            <span>Phân loại kết quả (tự động):</span>
            <span className={cls.badge}>{cls.label}</span>
            {abnormal && <span className="text-clinic-text-secondary tabular-nums">· {abnormalCount} chỉ số ngoài khoảng tham chiếu, sẽ được đánh dấu trên Bàn khám.</span>}
        </div>
    )
}

export function ResultFormFooter({ submitting, onDraft, onSubmit, alreadyReturned, needsApproval = false, disabled = false }) {
    const submitLabel = needsApproval ? 'Hoàn tất kết quả' : 'Trả kết quả'
    return (
        <div className="flex flex-wrap items-center gap-3 border-t border-clinic-border pt-4">
            <span className="min-w-[240px] flex-1 text-[12px] text-clinic-text-secondary">
                {disabled
                    ? 'Vui lòng bấm “Tiếp nhận & bắt đầu” ở góc trên trước khi lưu hoặc hoàn tất kết quả.'
                    : needsApproval
                    ? 'Sau khi hoàn tất, bấm “Duyệt & Trả kết quả” để kết quả hiện trên Bàn khám của bác sĩ chỉ định.'
                    : 'Khi trả, kết quả hiện ngay ở cột “Kết quả CLS” trên Bàn khám và bệnh nhân được xếp bậc 3 để quay lại kết luận.'}
            </span>
            {!(needsApproval && alreadyReturned) && (
                <button type="button" className="medpro-btn-outline" disabled={disabled || submitting} onClick={onDraft}>
                    Lưu nháp
                </button>
            )}
            <button type="button" className="medpro-btn-primary" disabled={disabled || submitting} onClick={onSubmit}>
                {submitting ? 'Đang gửi…' : alreadyReturned ? 'Cập nhật kết quả' : submitLabel}
                <ClinicIcon name="ArrowRight" size={16} weight="bold" />
            </button>
        </div>
    )
}

export function PerformerFields({ serviceName }) {
    const currentUser = useSelector((state) => state.app.auth.user)
    const performerName = currentUser?.fullName || currentUser?.shortName || currentUser?.hoTen || currentUser?.name || 'Kỹ thuật viên phòng CLS'
    const [performedAt] = useState(() => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()))
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label>
                <span className="medpro-label">Dịch vụ</span>
                <input className="medpro-input" value={serviceName} readOnly />
            </label>
            <label>
                <span className="medpro-label">Người thực hiện</span>
                <input className="medpro-input" value={performerName} readOnly />
            </label>
            <label>
                <span className="medpro-label">Thời gian</span>
                <input className="medpro-input" value={performedAt} readOnly />
            </label>
        </div>
    )
}
