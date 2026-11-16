import React from 'react'
import { ClinicIcon } from '../../common/ClinicIcon'

export default function WorkstationEmptyState({
    queue,
    calling,
    onCallNext,
}) {
    return (
        <div className="flex-1 min-h-[540px] flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200/90 bg-white p-8 text-center shadow-xs">
            <div className="w-20 h-20 rounded-3xl bg-[#E8F4FD] flex items-center justify-center text-4xl text-[#00A9E3] mb-4 shadow-inner">
                🩺
            </div>
            <h2 className="text-xl font-extrabold text-[#003553]">
                Bàn Khám Đã Sẵn Sàng
            </h2>
            <p className="mt-2 text-xs text-slate-500 max-w-md leading-relaxed">
                Chưa có ca khám nào đang mở. Bác sĩ vui lòng nhấn <strong>[Gọi số tiếp theo]</strong> hoặc chọn một bệnh nhân từ danh sách hàng đợi bên trái để bắt đầu phiên khám.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                    type="button"
                    onClick={onCallNext}
                    disabled={calling}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-[#00A9E3] hover:bg-[#0092c4] text-white font-extrabold text-sm shadow-md shadow-sky-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
                >
                    <ClinicIcon name="ArrowRight" size={17} weight="bold" />
                    <span>{calling ? 'Đang gọi số…' : 'Gọi số tiếp theo (Ưu tiên)'}</span>
                    <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded text-white font-mono">F2</span>
                </button>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
                <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-3.5 text-left">
                    <span className="text-[11px] font-medium text-slate-500">Bệnh nhân đang chờ</span>
                    <p className="text-lg font-extrabold text-[#003553] mt-0.5">
                        {queue.filter((ticket) => ['cho_kham', 'dang_kham'].includes(ticket.trang_thai)).length} lượt
                    </p>
                </div>
                <div className="rounded-2xl bg-amber-50/70 border border-amber-200/70 p-3.5 text-left">
                    <span className="text-[11px] font-medium text-amber-800">Đang chờ KQ CLS</span>
                    <p className="text-lg font-extrabold text-amber-900 mt-0.5">
                        {queue.filter((ticket) => ticket.trang_thai === 'tam_hoan').length} lượt
                    </p>
                </div>
                <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/70 p-3.5 text-left">
                    <span className="text-[11px] font-medium text-emerald-800">Có kết quả CLS ⭐</span>
                    <p className="text-lg font-extrabold text-emerald-900 mt-0.5">
                        {queue.filter((ticket) => ticket.trang_thai === 'co_ket_qua_cls' || (ticket.ghi_chu && ticket.ghi_chu.toLowerCase().includes('kết quả'))).length} lượt
                    </p>
                </div>
            </div>
        </div>
    )
}
