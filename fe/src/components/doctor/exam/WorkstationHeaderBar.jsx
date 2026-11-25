import React from 'react'
import { formatDateTime } from '../../../utils/helpers/formatDate'

export default function WorkstationHeaderBar({
    resolvedSpecialty,
    currentUser,
    encounter,
    encounterId,
    locked,
    savedAt,
}) {
    if (!encounterId) {
        return null
    }

    return (
        <div className="medpro-card flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-clinic-surface rounded-[6px] text-xs">
            <div className="flex flex-wrap items-center gap-2 text-clinic-text-secondary tabular-nums">
                <span className="font-bold text-clinic-navy">
                    Phiên khám #{encounter?.ma_kcb || encounterId}
                </span>
                <span>·</span>
                <span>{resolvedSpecialty?.label || 'Khoa Nội tổng quát'}</span>
                <span>·</span>
                <span>{currentUser?.room || encounter?.ten_phong_kham || 'Buồng khám chuyên khoa'}</span>
            </div>

            <span className="text-xs text-clinic-text-secondary inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-clinic-bg border border-clinic-border tabular-nums">
                <span
                    className={`h-2 w-2 rounded-full ${
                        savedAt ? 'bg-clinic-success' : 'bg-clinic-border-strong'
                    }`}
                />
                <span>
                    {locked
                        ? 'Bệnh án đã khóa (Chỉ đọc)'
                        : savedAt
                          ? `Đã lưu nháp ${formatDateTime(savedAt).slice(-8)}`
                          : 'Tự động lưu nháp'}
                </span>
            </span>
        </div>
    )
}
