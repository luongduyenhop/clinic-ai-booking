export default function UnbilledEncounterList({
    liveUnbilled,
    pendingBillRegistrations,
    onSelectUnbilledEncounter,
    onSelectPatientAutoFill,
}) {
    if (liveUnbilled.length > 0) {
        return (
            <div className="rounded-[6px] bg-clinic-surface-tint border border-clinic-info-border overflow-hidden">
                <div className="px-2.5 py-1.5 flex items-center justify-between text-[11px] font-semibold text-clinic-navy border-b border-clinic-info-border/70 tabular-nums">
                    <span>Ca khám chờ lập phiếu ({liveUnbilled.length})</span>
                    <span className="font-normal text-clinic-cta">Chọn để thu</span>
                </div>
                <div className="divide-y divide-clinic-border/70 max-h-32 overflow-y-auto bg-clinic-surface">
                    {liveUnbilled.map((item) => (
                        <button
                            type="button"
                            key={item.luot_kham_id}
                            onClick={() => onSelectUnbilledEncounter(item)}
                            className="w-full text-left px-2.5 py-2 hover:bg-clinic-surface-tint text-xs flex items-center justify-between gap-2 cursor-pointer transition tabular-nums"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-clinic-navy truncate">
                                    {item.benh_nhan?.ho_ten}
                                </div>
                                <div className="text-[11px] text-clinic-text-muted truncate">
                                    {item.ma_kcb} · {item.so_chi_dinh} dịch vụ
                                </div>
                            </div>
                            <span className="font-semibold text-clinic-navy text-xs shrink-0 whitespace-nowrap">
                                {Number(item.tam_tinh || 0).toLocaleString('vi-VN')} đ
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    if (pendingBillRegistrations.length > 0) {
        return (
            <div className="rounded-[6px] bg-clinic-warning-bg border border-clinic-warning-border overflow-hidden">
                <div className="px-2.5 py-1.5 flex items-center justify-between text-[11px] font-semibold text-clinic-warning border-b border-clinic-warning-border/70 tabular-nums">
                    <span>Chờ thu viện phí ({pendingBillRegistrations.length})</span>
                    <span className="font-normal">Chọn để nạp</span>
                </div>
                <div className="divide-y divide-clinic-border/70 max-h-32 overflow-y-auto bg-clinic-surface">
                    {pendingBillRegistrations.map((patientReg) => {
                        const total = (patientReg.services || []).reduce(
                            (acc, serv) => acc + (Number(serv.thanhTien) || 0),
                            0
                        )
                        return (
                            <button
                                type="button"
                                key={patientReg.id}
                                onClick={() => onSelectPatientAutoFill(patientReg.maBN, patientReg.maKCB)}
                                className="w-full text-left px-2.5 py-2 hover:bg-clinic-surface-tint text-xs flex items-center justify-between gap-2 cursor-pointer transition tabular-nums"
                            >
                                <div className="min-w-0 flex-1 truncate">
                                    <span className="font-semibold text-clinic-navy">{patientReg.hoTen}</span>
                                    <span className="ml-1.5 text-[11px] text-clinic-text-muted">{patientReg.maKCB}</span>
                                </div>
                                <span className="font-semibold text-clinic-navy text-xs shrink-0 whitespace-nowrap">
                                    {total.toLocaleString('vi-VN')} đ
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>
        )
    }

    return null
}
