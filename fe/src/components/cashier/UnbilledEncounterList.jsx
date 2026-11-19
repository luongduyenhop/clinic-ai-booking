import { Receipt } from '../common/ClinicIcon'

export default function UnbilledEncounterList({
    liveUnbilled,
    pendingBillRegistrations,
    onSelectUnbilledEncounter,
    onSelectPatientAutoFill,
}) {
    if (liveUnbilled.length > 0) {
        return (
            <div className="mb-3 p-2.5 rounded-[6px] bg-clinic-surface-alt border border-clinic-info-border">
                <div className="flex items-center justify-between text-xs font-bold text-clinic-navy mb-1.5">
                    <span className="flex items-center gap-1.5">
                        <Receipt size={14} weight="bold" className="text-clinic-cta" />
                        <span>PHIẾU CHỈ ĐỊNH / DỊCH VỤ CHỜ THU ({liveUnbilled.length})</span>
                    </span>
                    <span className="text-[10px] text-clinic-cta font-semibold">Tách riêng từng phiếu</span>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                    {liveUnbilled.map((item) => (
                        <button
                            type="button"
                            key={item.luot_kham_id}
                            onClick={() => onSelectUnbilledEncounter(item)}
                            className="w-full text-left px-2.5 py-1.5 rounded-[6px] bg-clinic-surface hover:bg-clinic-surface-tint text-xs flex items-center justify-between cursor-pointer transition border border-clinic-border tabular-nums"
                        >
                            <div>
                                <span className="font-bold text-clinic-navy">{item.benh_nhan?.ho_ten}</span>
                                <span className="ml-1.5 font-mono text-[10px] text-clinic-text-secondary">({item.ma_kcb})</span>
                                <div className="text-[10px] text-clinic-text-secondary">
                                    BS: {item.bac_si_kham || 'Phụ trách'} | {item.so_chi_dinh} CLS
                                </div>
                            </div>
                            <span className="font-bold text-clinic-success text-[11px] shrink-0">
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
            <div className="mb-3 p-2.5 rounded-[6px] bg-clinic-warning-bg border border-clinic-warning-border">
                <div className="flex items-center justify-between text-xs font-bold text-clinic-warning mb-1.5">
                    <span className="flex items-center gap-1.5">
                        <Receipt size={14} weight="bold" className="text-clinic-warning" />
                        <span>CHỜ THU TIỀN VIỆN PHÍ ({pendingBillRegistrations.length})</span>
                    </span>
                    <span className="text-[10px] text-clinic-warning font-semibold">Chọn để nạp</span>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
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
                                className="w-full text-left px-2.5 py-1.5 rounded-[6px] bg-clinic-surface hover:bg-clinic-surface-tint text-xs flex items-center justify-between cursor-pointer transition border border-clinic-border tabular-nums"
                            >
                                <div>
                                    <span className="font-bold text-clinic-navy">{patientReg.hoTen}</span>
                                    <span className="ml-1.5 font-mono text-[10px] text-clinic-text-secondary">({patientReg.maKCB})</span>
                                </div>
                                <span className="font-bold text-clinic-success text-[11px] shrink-0">
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
