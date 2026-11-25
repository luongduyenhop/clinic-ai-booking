import { Receipt, FloppyDisk } from '../common/ClinicIcon'

export default function CashierStatsHeader({
    activeCashierTab,
    setActiveCashierTab,
    allVouchersCount,
    cashierClosingsCount,
    onDailyClosing,
}) {
    return (
        <div className="medpro-card p-2 flex flex-wrap items-center justify-between gap-2 bg-clinic-surface">
            <div className="flex flex-wrap items-center gap-1 bg-clinic-bg p-1 rounded-[6px] border border-clinic-border tabular-nums">
                <button
                    type="button"
                    onClick={() => setActiveCashierTab('THU_CHI')}
                    className={`px-3.5 py-1.5 rounded-[6px] text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                        activeCashierTab === 'THU_CHI'
                            ? 'bg-clinic-navy text-clinic-surface'
                            : 'text-clinic-navy hover:bg-clinic-surface'
                    }`}
                >
                    <Receipt size={15} weight="bold" />
                    <span>Thu viện phí và hóa đơn ({allVouchersCount})</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveCashierTab('KHOA_SO')}
                    className={`px-3.5 py-1.5 rounded-[6px] text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                        activeCashierTab === 'KHOA_SO'
                            ? 'bg-clinic-navy text-clinic-surface'
                            : 'text-clinic-navy hover:bg-clinic-surface'
                    }`}
                >
                    <FloppyDisk size={15} weight="bold" />
                    <span>Khóa sổ và đối soát cuối ngày ({cashierClosingsCount})</span>
                </button>
            </div>
            {activeCashierTab === 'KHOA_SO' && (
                <button
                    type="button"
                    onClick={onDailyClosing}
                    className="medpro-btn-primary text-xs rounded-[6px]"
                >
                    <span>Khóa sổ ca hôm nay</span>
                </button>
            )}
        </div>
    )
}
