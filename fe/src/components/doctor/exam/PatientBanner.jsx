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
        (o) =>
            o.trang_thai !== 'da_huy' &&
            o.trang_thai !== 'da_co_ket_qua' &&
            o.trang_thai !== 'da_duyet'
    )
    const isWaitingCls =
        externalIsWaitingCls !== undefined
            ? externalIsWaitingCls
            : Boolean(
                  encounter?.trang_thai === 'tam_hoan' ||
                      activeTicket?.trang_thai === 'tam_hoan' ||
                      pendingOrders.length > 0
              )

    const hasClsReady =
        externalHasClsReady !== undefined
            ? externalHasClsReady
            : Boolean(
                  activeTicket?.trang_thai === 'co_ket_qua_cls' ||
                      (activeTicket?.ghi_chu &&
                          (/có\s+kq\s+cls/i.test(activeTicket.ghi_chu) ||
                              /kq\s+cls/i.test(activeTicket.ghi_chu) ||
                              activeTicket.ghi_chu.toLowerCase().includes('đã có kết quả')))
              )

    const isExamining = Boolean(
        activeTicket?.trang_thai === 'dang_kham' ||
            (encounter?.thoi_gian_bat_dau && !encounter?.is_locked && !isWaitingCls && !hasClsReady)
    )

    return (
        <div className="medpro-card bg-clinic-surface p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] bg-clinic-navy text-[15px] font-extrabold text-clinic-surface">
                    {initials(bn.ho_ten || 'BN')}
                </span>

                <div className="flex min-w-[240px] flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <h1 className="text-[18px] font-extrabold text-clinic-navy tracking-tight">
                            {bn.ho_ten}
                        </h1>
                        <span className="text-xs font-semibold text-clinic-text-secondary tabular-nums">
                            {bn.gioi_tinh} · {bn.tuoi} tuổi · Mã:{' '}
                            <strong className="text-clinic-navy">{bn.ma || 'BN-2026'}</strong> · Mã LK:{' '}
                            <strong className="text-clinic-navy">{encounter?.ma_lich_kham}</strong>
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        {encounter?.chuyen_khoa_kham && (
                            <span className="medpro-badge-info">
                                {findSpecialtyExam(encounter.chuyen_khoa_kham).label}
                            </span>
                        )}

                        {bn.di_ung_thuoc ? (
                            <span className="medpro-badge-danger inline-flex items-center gap-1 font-extrabold">
                                <ClinicIcon name="Warning" size={13} weight="bold" />
                                <span>DỊ ỨNG: {bn.di_ung_thuoc}</span>
                            </span>
                        ) : (
                            <span className="medpro-badge-neutral">Chưa ghi nhận dị ứng</span>
                        )}

                        {encounter?.is_locked ? (
                            <span className="medpro-badge-neutral inline-flex items-center gap-1 font-bold">
                                <ClinicIcon name="LockKey" size={12} />
                                <span>Bệnh án đã khóa</span>
                            </span>
                        ) : isWaitingCls ? (
                            <span className="medpro-badge-warning inline-flex items-center gap-1">
                                <ClinicIcon name="Clock" size={12} />
                                <span>Đang làm Cận lâm sàng</span>
                            </span>
                        ) : hasClsReady ? (
                            <span className="medpro-badge-success inline-flex items-center gap-1">
                                <ClinicIcon name="CheckCircle" size={12} weight="fill" />
                                <span>Đã có kết quả CLS</span>
                            </span>
                        ) : isExamining ? (
                            <span className="medpro-badge-success">Đang khám</span>
                        ) : (
                            <span className="medpro-badge-warning inline-flex items-center gap-1">
                                <ClinicIcon name="Clock" size={11} />
                                <span>Chờ khám</span>
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!encounter?.is_locked &&
                        !isExamining &&
                        !isWaitingCls &&
                        !hasClsReady &&
                        onStartExam && (
                            <button
                                type="button"
                                onClick={onStartExam}
                                disabled={calling}
                                className="medpro-btn-primary rounded-[6px] px-3 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
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
                            className="medpro-btn-outline rounded-[6px] px-3 py-1.5 text-xs font-bold cursor-pointer"
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
