import { Receipt, FloppyDisk } from '../common/ClinicIcon'

export default function CashierStatsHeader({
    activeCashierTab,
    setActiveCashierTab,
    allVouchersCount,
    cashierClosingsCount,
    onDailyClosing,
}) {
    return (
        <div className="medpro-card p-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                    type="button"
                    onClick={() => setActiveCashierTab('THU_CHI')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        activeCashierTab === 'THU_CHI'
                            ? 'bg-[#00B5F1] text-white shadow-xs'
                            : 'text-[#003553] hover:bg-white/80'
                    }`}
                >
                    <Receipt size={15} weight="bold" />
                    <span>1. Quản lý Thu viện phí & Hóa đơn ({allVouchersCount})</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveCashierTab('KHOA_SO')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        activeCashierTab === 'KHOA_SO'
                            ? 'bg-[#00B5F1] text-white shadow-xs'
                            : 'text-[#003553] hover:bg-white/80'
                    }`}
                >
                    <FloppyDisk size={15} weight="bold" />
                    <span>2. Quản lý Khóa sổ cuối ngày (/khoaso) ({cashierClosingsCount})</span>
                </button>
            </div>
            {activeCashierTab === 'KHOA_SO' && (
                <button
                    type="button"
                    onClick={onDailyClosing}
                    className="medpro-btn-primary text-xs"
                >
                    <span>Khóa sổ ca hôm nay</span>
                </button>
            )}
        </div>
    )
}
