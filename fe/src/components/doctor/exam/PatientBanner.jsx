import { ClinicIcon } from '../../common/ClinicIcon'
import { findSpecialtyExam } from '../../../utils/constants/clinical'
import { formatDateTime } from '../../../utils/helpers/formatDate'
import { getAvatarInitials, stripDemoTag } from '../../../utils/helpers/doctorNameHelper'

export default function PatientBanner({
    encounter,
    onShowHistory,
    onBack,
    savedAt,
    activeTicket,
    isWaitingCls: externalIsWaitingCls,
    hasClsReady: externalHasClsReady,
    onStartExam,
    calling,
}) {
    const bn = encounter?.benh_nhan || {}
    const cleanName = stripDemoTag(bn.ho_ten || 'Người bệnh')
    const allergyText = String(bn.di_ung_thuoc || '').trim()
    const hasRealAllergy = Boolean(
        allergyText && !['không', 'khong', 'không có', 'chưa ghi nhận'].includes(allergyText.toLowerCase())
    )

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
        <div className="medpro-card bg-clinic-surface px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Quay lại bàn khám"
                        title="Đóng ca khám và quay về bàn trống (Esc)"
                        className="w-8 h-8 rounded-[6px] border border-clinic-border bg-clinic-bg hover:border-clinic-cta hover:text-clinic-cta text-clinic-text-secondary flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                    >
                        <ClinicIcon name="ArrowLeft" size={15} weight="bold" />
                    </button>
                )}

                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-clinic-navy text-xs font-semibold text-clinic-surface">
                    {getAvatarInitials(cleanName, 'BN')}
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h1 className="text-[15px] font-bold text-clinic-navy tracking-tight truncate">
                            {cleanName}
                        </h1>
                        <span className="text-xs text-clinic-text-secondary tabular-nums">
                            {bn.gioi_tinh} · {bn.tuoi} tuổi · <span className="font-medium text-clinic-text">{bn.ma || 'BN-2026'}</span>
                            {encounter?.ma_lich_kham ? ` · ${encounter.ma_lich_kham}` : ''}
                        </span>
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                        {encounter?.chuyen_khoa_kham && (
                            <span className="text-clinic-text-secondary font-medium">
                                {findSpecialtyExam(encounter.chuyen_khoa_kham).label}
                            </span>
                        )}

                        {hasRealAllergy ? (
                            <span className="medpro-badge-danger inline-flex items-center gap-1">
                                <ClinicIcon name="Warning" size={12} weight="bold" />
                                <span>Dị ứng: {allergyText}</span>
                            </span>
                        ) : (
                            <span className="text-clinic-text-muted">Không ghi nhận dị ứng</span>
                        )}

                        {encounter?.is_locked ? (
                            <span className="medpro-badge-neutral inline-flex items-center gap-1">
                                <ClinicIcon name="LockKey" size={12} />
                                <span>Đã khóa bệnh án</span>
                            </span>
                        ) : isWaitingCls ? (
                            <span className="medpro-badge-warning inline-flex items-center gap-1">
                                <ClinicIcon name="Clock" size={12} />
                                <span>Chờ kết quả CLS</span>
                            </span>
                        ) : hasClsReady ? (
                            <span className="medpro-badge-success inline-flex items-center gap-1">
                                <ClinicIcon name="CheckCircle" size={12} weight="fill" />
                                <span>Đã có KQ CLS</span>
                            </span>
                        ) : isExamining ? (
                            <span className="medpro-badge-info">Đang khám</span>
                        ) : (
                            <span className="medpro-badge-warning inline-flex items-center gap-1">
                                <ClinicIcon name="Clock" size={11} />
                                <span>Chờ khám</span>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <span className="hidden xl:inline-flex items-center gap-1.5 text-[11px] text-clinic-text-muted tabular-nums mr-1">
                    <span
                        className={`h-1.5 w-1.5 rounded-full ${
                            savedAt ? 'bg-clinic-success' : 'bg-clinic-border-strong'
                        }`}
                    />
                    <span>
                        {encounter?.is_locked
                            ? 'Chỉ đọc'
                            : savedAt
                              ? `Đã lưu ${formatDateTime(savedAt).slice(-8)}`
                              : 'Tự động lưu'}
                    </span>
                </span>

                {!encounter?.is_locked &&
                    !isExamining &&
                    !isWaitingCls &&
                    !hasClsReady &&
                    onStartExam && (
                        <button
                            type="button"
                            onClick={onStartExam}
                            disabled={calling}
                            className="medpro-btn-primary h-8 px-3 text-xs"
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
                        className="medpro-btn-outline h-8 px-3 text-xs"
                    >
                        <ClinicIcon name="ClockCounterClockwise" size={14} />
                        <span>Hồ sơ cũ</span>
                    </button>
                )}
            </div>
        </div>
    )
}
