import { ClinicIcon } from '../../common/ClinicIcon'
import { findSpecialtyExam } from '../../../utils/constants/clinical'

const initials = (name = '') =>
    name
        .split(' ')
        .filter(Boolean)
        .slice(-2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()

export default function PatientBanner({
    encounter,
    onShowHistory,
    activeTicket,
    isWaitingCls: externalIsWaitingCls,
    hasClsReady: externalHasClsReady,
    onStartExam,
    calling,
}) {
    const bn = encounter?.benh_nhan || {}

    const pendingOrders = (encounter?.danh_sach_chi_dinh || []).filter(
        (o) => o.trang_thai !== 'da_huy' && o.trang_thai !== 'da_co_ket_qua' && o.trang_thai !== 'da_duyet'
    )
    const isWaitingCls =
        externalIsWaitingCls !== undefined
            ? externalIsWaitingCls
            : Boolean(encounter?.trang_thai === 'tam_hoan' || activeTicket?.trang_thai === 'tam_hoan' || pendingOrders.length > 0)

    const hasClsReady =
        externalHasClsReady !== undefined
            ? externalHasClsReady
            : Boolean(
                  activeTicket?.trang_thai === 'co_ket_qua_cls' ||
                      (activeTicket?.ghi_chu && (
                          activeTicket.ghi_chu.startsWith('⭐ CÓ KQ CLS') ||
                          activeTicket.ghi_chu.startsWith('🚨 KQ CLS') ||
                          activeTicket.ghi_chu.toLowerCase().includes('đã có kết quả')
                      ))
              )

    const isExamining = Boolean(

        activeTicket?.trang_thai === 'dang_kham' ||

        (encounter?.thoi_gian_bat_dau && !encounter?.is_locked && !isWaitingCls && !hasClsReady)

    )

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#003553] text-[16px] font-extrabold text-white shadow-2xs">
                    {initials(bn.ho_ten || 'BN')}
                </span>

                <div className="flex min-w-[240px] flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <h1 className="text-[18px] font-extrabold text-[#003553] tracking-tight">{bn.ho_ten}</h1>
                        <span className="text-[12px] font-semibold text-slate-500">
                            {bn.gioi_tinh} · {bn.tuoi} tuổi · Mã: <strong className="text-slate-700">{bn.ma || 'BN-2026'}</strong> · Mã LK: <strong className="text-slate-700">{encounter?.ma_lich_kham}</strong>
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        {encounter?.chuyen_khoa_kham && (
                            <span className="text-[11px] font-bold bg-[#E8F4FD] text-[#0077B6] px-2 py-0.5 rounded-full border border-sky-200">
                                {findSpecialtyExam(encounter.chuyen_khoa_kham).label}
                            </span>
                        )}

                        {bn.di_ung_thuoc ? (
                            <span className="text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1 animate-pulse">
                                <ClinicIcon name="Warning" size={13} weight="bold" />
                                DỊ ỨNG: {bn.di_ung_thuoc}
                            </span>
                        ) : (
                            <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                Chưa ghi nhận dị ứng
                            </span>
                        )}

                        {encounter?.is_locked ? (
                            <span className="text-[11px] font-bold bg-slate-800 text-white px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <ClinicIcon name="LockKey" size={12} /> Bệnh án đã khóa
                            </span>
                        ) : isWaitingCls ? (
                            <span className="text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <ClinicIcon name="Clock" size={12} /> Đang làm Cận lâm sàng
                            </span>
                        ) : hasClsReady ? (
                            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1 animate-pulse">
                                ⭐ Đã có kết quả CLS
                            </span>
                        ) : isExamining ? (
                            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                ● Đang khám
                            </span>
                        ) : (
                            <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <ClinicIcon name="Clock" size={11} /> Chờ khám
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!encounter?.is_locked && !isExamining && !isWaitingCls && !hasClsReady && onStartExam && (
                        <button
                            type="button"
                            onClick={onStartExam}
                            disabled={calling}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-[#00A9E3] text-white hover:bg-[#0092c4] transition cursor-pointer shadow-xs disabled:opacity-50"
                            title="Gọi bệnh nhân này vào khám"
                        >
                            <ClinicIcon name="SpeakerHigh" size={14} />
                            <span>{calling ? 'Đang gọi…' : 'Gọi vào khám'}</span>
                        </button>
                    )}
                    {onShowHistory && (
                        <button
                            type="button"
                            onClick={onShowHistory}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                        >
                            <ClinicIcon name="Clock" size={14} />
                            <span>Hồ sơ cũ</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
