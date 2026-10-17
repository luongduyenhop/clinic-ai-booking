import { ClinicIcon } from '../../common/ClinicIcon'
import { formatDateTime } from '../../../utils/helpers/formatDate'
import { findSpecialtyExam } from '../../../utils/constants/clinical'

const initials = (name = '') =>
    name
        .split(' ')
        .filter(Boolean)
        .slice(-2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()

export default function PatientBanner({ encounter, onShowHistory }) {
    const bn = encounter.benh_nhan
    const fever = Number(encounter.nhiet_do_c) >= 37.5

    return (
        <div className="medpro-card flex flex-wrap items-center gap-4 p-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F4FD] text-[16px] font-bold text-[#003553]">
                {initials(bn.ho_ten)}
            </span>
            <div className="flex min-w-[260px] flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-[20px] font-bold text-[#003553]">{bn.ho_ten}</h2>
                    <span className="text-[13px] text-slate-500">
                        {bn.gioi_tinh} · {bn.tuoi} tuổi · {bn.ma} · {encounter.ma_lich_kham} · Lần khám thứ {bn.so_lan_kham}
                    </span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {encounter.chuyen_khoa_kham && (
                        <span className="medpro-badge-info">Khoa {findSpecialtyExam(encounter.chuyen_khoa_kham).label}</span>
                    )}
                    {bn.di_ung_thuoc ? (
                        <span className="medpro-badge-danger">
                            <ClinicIcon name="Warning" size={13} weight="bold" />
                            {bn.di_ung_thuoc}
                        </span>
                    ) : (
                        <span className="medpro-badge">Chưa ghi nhận dị ứng thuốc</span>
                    )}
                    {fever && <span className="medpro-badge-warning">Sốt {encounter.nhiet_do_c} °C</span>}
                    {encounter.is_locked ? (
                        <span className="medpro-badge-success">
                            <ClinicIcon name="LockKey" size={13} /> Đã khóa {formatDateTime(encounter.thoi_gian_khoa)}
                        </span>
                    ) : (
                        encounter.thoi_gian_bat_dau && (
                            <span className="medpro-badge-info">Đang khám · bắt đầu {formatDateTime(encounter.thoi_gian_bat_dau)}</span>
                        )
                    )}
                </div>
            </div>
            <button type="button" className="medpro-btn-outline" onClick={onShowHistory}>
                <ClinicIcon name="Clock" size={16} />
                Lịch sử bệnh án
            </button>
        </div>
    )
}
