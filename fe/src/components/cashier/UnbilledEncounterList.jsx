import { Receipt } from '../common/ClinicIcon'

export default function UnbilledEncounterList({
    liveUnbilled,
    pendingBillRegistrations,
    onSelectUnbilledEncounter,
    onSelectPatientAutoFill,
}) {
    if (liveUnbilled.length > 0) {
        return (
            <div className="mb-3 p-2.5 rounded-xl bg-sky-50/90 border border-sky-200">
                <div className="flex items-center justify-between text-xs font-bold text-sky-900 mb-1.5">
                    <span className="flex items-center gap-1.5">
                        <Receipt size={14} weight="bold" className="text-sky-600" />
                        <span>PHIẾU CHỈ ĐỊNH / DỊCH VỤ CHỜ THU ({liveUnbilled.length})</span>
                    </span>
                    <span className="text-[10px] text-sky-600 font-semibold">Tách riêng từng phiếu</span>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                    {liveUnbilled.map((item) => (
                        <div
                            key={item.luot_kham_id}
                            onClick={() => onSelectUnbilledEncounter(item)}
                            className="px-2 py-1.5 rounded-lg bg-white hover:bg-sky-100 text-xs flex items-center justify-between cursor-pointer transition border border-sky-100"
                        >
                            <div>
                                <span className="font-bold text-[#003553]">{item.benh_nhan?.ho_ten}</span>
                                <span className="ml-1.5 font-mono text-[10px] text-slate-500">({item.ma_kcb})</span>
                                <div className="text-[10px] text-slate-500">
                                    BS: {item.bac_si_kham || 'Phụ trách'} | {item.so_chi_dinh} CLS
                                </div>
                            </div>
                            <span className="font-bold text-emerald-700 font-mono text-[11px]">
                                {Number(item.tam_tinh || 0).toLocaleString('vi-VN')} đ
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (pendingBillRegistrations.length > 0) {
        return (
            <div className="mb-3 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200">
                <div className="flex items-center justify-between text-xs font-bold text-amber-900 mb-1.5">
                    <span className="flex items-center gap-1.5">
                        <Receipt size={14} weight="bold" className="text-amber-600" />
                        <span>CHỜ THU TIỀN VIỆN PHÍ ({pendingBillRegistrations.length})</span>
                    </span>
                    <span className="text-[10px] text-amber-600 font-semibold">Click nạp nhanh</span>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                    {pendingBillRegistrations.map((patientReg) => {
                        const total = (patientReg.services || []).reduce(
                            (acc, serv) => acc + (Number(serv.thanhTien) || 0),
                            0
                        )
                        return (
                            <div
                                key={patientReg.id}
                                onClick={() => onSelectPatientAutoFill(patientReg.maBN, patientReg.maKCB)}
                                className="px-2 py-1.5 rounded-lg bg-white hover:bg-amber-100/70 text-xs flex items-center justify-between cursor-pointer transition border border-amber-100"
                            >
                                <div>
                                    <span className="font-bold text-[#003553]">{patientReg.hoTen}</span>
                                    <span className="ml-1.5 font-mono text-[10px] text-slate-500">({patientReg.maKCB})</span>
                                </div>
                                <span className="font-bold text-emerald-700 font-mono text-[11px]">
                                    {total.toLocaleString('vi-VN')} đ
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return null
}
