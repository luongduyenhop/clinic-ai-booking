import React from 'react'

export default function WorkstationEmptyState({
    queue = [],
    onSelectEncounter,
    onCallNext,
    calling = false,
}) {
    const activeExamTickets = queue.filter((ticket) => ticket.trang_thai === 'dang_kham')
    const waitingCount = queue.filter((ticket) =>
        ['cho_kham', 'dang_kham'].includes(ticket.trang_thai)
    ).length
    const pendingClsCount = queue.filter((ticket) => ticket.trang_thai === 'tam_hoan').length
    const clsReadyCount = queue.filter(
        (ticket) =>
            ticket.trang_thai === 'co_ket_qua_cls' ||
            (ticket.ghi_chu && ticket.ghi_chu.toLowerCase().includes('kết quả'))
    ).length

    const nextPatients = [
        ...queue.filter((ticket) => ticket.trang_thai === 'co_ket_qua_cls'),
        ...queue.filter((ticket) => ticket.trang_thai === 'cho_kham'),
    ].slice(0, 3)

    return (
        <div className="medpro-card p-6 bg-clinic-surface rounded-[6px] border border-clinic-border space-y-5">
            {activeExamTickets.length > 0 ? (
                <div className="border-b border-clinic-border pb-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-base font-extrabold text-clinic-navy">
                            Hồ sơ đang khám dở
                        </h2>
                        <span className="medpro-badge-info text-xs font-bold tabular-nums">
                            {activeExamTickets.length} ca đang khám
                        </span>
                    </div>
                    <div className="space-y-2">
                        {activeExamTickets.map((ticket) => {
                            const patientName = ticket.ten_benh_nhan || ticket.ho_ten || 'Bệnh nhân'
                            const ticketCode = ticket.ticket_code || (ticket.so_thu_tu_kham ? `STT ${ticket.so_thu_tu_kham}` : '')
                            const targetId = ticket.encounter_id || ticket.ticket_id
                            return (
                                <div
                                    key={ticket.ticket_id || ticket.encounter_id || patientName}
                                    className="rounded-[6px] border border-clinic-info-border bg-clinic-surface-tint px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-clinic-navy truncate">
                                            Đang khám dở: {patientName}
                                            {ticketCode ? ` (${ticketCode})` : ''}
                                        </p>
                                        {ticket.ly_do_kham && (
                                            <p className="text-xs text-clinic-text-secondary truncate mt-0.5">
                                                {ticket.ly_do_kham}
                                            </p>
                                        )}
                                    </div>
                                    {onSelectEncounter && targetId && (
                                        <button
                                            type="button"
                                            onClick={() => onSelectEncounter(targetId)}
                                            className="medpro-btn-primary text-xs shrink-0 cursor-pointer"
                                        >
                                            Mở hồ sơ
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <div className="border-b border-clinic-border pb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-extrabold text-clinic-navy">
                            Bàn khám sẵn sàng tiếp nhận
                        </h2>
                        <p className="text-xs text-clinic-text-secondary mt-1">
                            Chọn một bệnh nhân trong hàng đợi hoặc gọi ca tiếp theo bằng nút bên cạnh.
                        </p>
                    </div>
                    {nextPatients.length > 0 && onCallNext && (
                        <button
                            type="button"
                            onClick={onCallNext}
                            disabled={calling}
                            className="medpro-btn-primary text-xs shrink-0 cursor-pointer disabled:opacity-50"
                        >
                            {calling ? 'Đang gọi số...' : 'Gọi ca tiếp theo'}
                        </button>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-clinic-border border border-clinic-border rounded-[6px] tabular-nums">
                <div className="p-4">
                    <span className="text-xs font-semibold text-clinic-text-secondary">
                        Chờ khám lâm sàng
                    </span>
                    <p className="text-2xl font-display font-extrabold text-clinic-navy mt-1">
                        {waitingCount} lượt
                    </p>
                </div>
                <div className="p-4">
                    <span className="text-xs font-semibold text-clinic-text-secondary">
                        Đang chờ kết quả CLS
                    </span>
                    <p className={`text-2xl font-display font-extrabold mt-1 ${pendingClsCount > 0 ? 'text-clinic-warning' : 'text-clinic-navy'}`}>
                        {pendingClsCount} lượt
                    </p>
                </div>
                <div className="p-4">
                    <span className="text-xs font-semibold text-clinic-text-secondary">
                        Đã có kết quả CLS
                    </span>
                    <p className={`text-2xl font-display font-extrabold mt-1 ${clsReadyCount > 0 ? 'text-clinic-success' : 'text-clinic-navy'}`}>
                        {clsReadyCount} lượt
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1.5fr_0.9fr] gap-4 pt-1 text-xs items-start">
                <div className="rounded-[6px] bg-clinic-bg border border-clinic-border p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-clinic-navy">Bệnh nhân kế tiếp</h3>
                        <span className="text-[11px] text-clinic-text-muted tabular-nums">
                            Tối đa 3 lượt gần nhất
                        </span>
                    </div>

                    {nextPatients.length === 0 ? (
                        <p className="text-clinic-text-secondary py-2">
                            Hiện chưa có bệnh nhân mới trong hàng đợi.
                        </p>
                    ) : (
                        <div className="divide-y divide-clinic-border rounded-[6px] border border-clinic-border bg-clinic-surface overflow-hidden">
                            {nextPatients.map((ticket, idx) => {
                                const patientName = ticket.ten_benh_nhan || ticket.ho_ten || 'Bệnh nhân'
                                const sttLabel = ticket.ticket_code || (ticket.so_thu_tu_kham ? `#${ticket.so_thu_tu_kham}` : `#${idx + 1}`)
                                const isClsReady = ticket.trang_thai === 'co_ket_qua_cls'
                                const targetId = ticket.encounter_id || ticket.ticket_id
                                return (
                                    <div
                                        key={ticket.ticket_id || ticket.encounter_id || idx}
                                        className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono font-bold text-clinic-cta tabular-nums">
                                                    {sttLabel}
                                                </span>
                                                <span className="font-bold text-clinic-navy truncate">
                                                    {patientName}
                                                </span>
                                                <span className={isClsReady ? 'medpro-badge-success' : 'medpro-badge-info'}>
                                                    {isClsReady ? 'Đã có kết quả CLS' : 'Chờ khám'}
                                                </span>
                                            </div>
                                            {ticket.ly_do_kham && (
                                                <p className="text-[11px] text-clinic-text-secondary truncate mt-0.5">
                                                    {ticket.ly_do_kham}
                                                </p>
                                            )}
                                        </div>
                                        {ticket.encounter_id && onSelectEncounter ? (
                                            <button
                                                type="button"
                                                onClick={() => onSelectEncounter(targetId)}
                                                className="medpro-btn-outline text-[11px] !py-1 !px-2.5 shrink-0 cursor-pointer"
                                            >
                                                Mở hồ sơ
                                            </button>
                                        ) : onCallNext ? (
                                            <button
                                                type="button"
                                                onClick={onCallNext}
                                                disabled={calling}
                                                className="medpro-btn-primary text-[11px] !py-1 !px-2.5 shrink-0 cursor-pointer disabled:opacity-50"
                                            >
                                                Gọi vào khám
                                            </button>
                                        ) : null}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="rounded-[6px] bg-clinic-bg border border-clinic-border p-4 space-y-2">
                    <h3 className="font-bold text-clinic-navy">Phím tắt thao tác bàn khám</h3>
                    <dl className="space-y-1.5 text-clinic-text-secondary">
                        <div className="flex items-center justify-between gap-3">
                            <dt>Gọi bệnh nhân ưu tiên kế tiếp</dt>
                            <dd>
                                <kbd className="px-2 py-0.5 rounded-[4px] bg-clinic-surface border border-clinic-border-strong font-mono text-[11px] font-bold text-clinic-navy">
                                    F2
                                </kbd>
                            </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <dt>Đóng hồ sơ bệnh án đang mở</dt>
                            <dd>
                                <kbd className="px-2 py-0.5 rounded-[4px] bg-clinic-surface border border-clinic-border-strong font-mono text-[11px] font-bold text-clinic-navy">
                                    Esc
                                </kbd>
                            </dd>
                        </div>
                    </dl>
                </div>
            </div>
        </div>
    )
}
