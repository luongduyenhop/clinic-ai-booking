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
    return (
        <div className="medpro-card flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-white border border-slate-200">
            <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#003553] text-white font-extrabold text-sm shadow-xs">
                    HIS
                </span>
                <div>
                    <h1 className="text-[17px] font-extrabold text-[#003553] leading-tight">
                        Bàn Khám Lâm Sàng TT32
                    </h1>
                    <p className="text-[12px] text-slate-500">
                        Khoa: <strong className="text-slate-700">{resolvedSpecialty?.label || 'Khoa Nội tổng quát'}</strong> · {currentUser?.room || encounter?.ten_phong_kham || 'Buồng khám chuyên khoa'} · Phòng khám Đa khoa Clinic-AI
                    </p>
                </div>
            </div>

            {encounterId && (
                <div className="flex items-center gap-3">
                    <span className="text-[12px] text-slate-500 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className={`h-2 w-2 rounded-full ${savedAt ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        {locked
                            ? 'Bệnh án đã khóa (Chỉ đọc)'
                            : savedAt
                            ? `Đã lưu nháp ${formatDateTime(savedAt).slice(-8)}`
                            : 'Tự động lưu nháp'}
                    </span>
                </div>
            )}
        </div>
    )
}
