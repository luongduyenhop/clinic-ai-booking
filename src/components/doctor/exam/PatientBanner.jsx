import { ClinicIcon } from '../../common/ClinicIcon'
import { formatDateTime } from '../../../utils/helpers/formatDate'
import { findSpecialtyExam } from '../../../utils/constants/clinical'
import { computeBmi } from './examHelpers'

const initials = (name = '') =>
    name
        .split(' ')
        .filter(Boolean)
        .slice(-2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()

export default function PatientBanner({ encounter, vitals, onShowHistory }) {
    const bn = encounter?.benh_nhan || {}
    const fever = Number(vitals?.nhiet_do_c || encounter?.nhiet_do_c) >= 37.5
    const bmi = computeBmi(vitals?.can_nang_kg || encounter?.can_nang_kg, vitals?.chieu_cao_cm || encounter?.chieu_cao_cm)

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3.5">
                {/* Avatar Initial */}
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#003553] text-[16px] font-extrabold text-white shadow-2xs">
                    {initials(bn.ho_ten || 'BN')}
                </span>

                {/* Identity & Demographics */}
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
                                Khoa {findSpecialtyExam(encounter.chuyen_khoa_kham).label}
                            </span>
                        )}

                        {/* Tiền sử dị ứng thuốc - CRITICAL SAFETY ALERT */}
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

                        {fever && (
                            <span className="text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
                                🔥 Sốt {vitals?.nhiet_do_c || encounter?.nhiet_do_c} °C
                            </span>
                        )}

                        {encounter?.is_locked ? (
                            <span className="text-[11px] font-bold bg-slate-800 text-white px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <ClinicIcon name="LockKey" size={12} /> Bệnh án đã khóa
                            </span>
                        ) : (
                            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                ● Đang khám trực tiếp
                            </span>
                        )}
                    </div>
                </div>

                {/* History Trigger Button */}
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

            {/* Quick Vitals Strip */}
            {vitals && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                    <span className="text-[11px] font-bold uppercase text-slate-400">Sinh hiệu:</span>
                    <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md font-semibold text-slate-700">
                        Mạch: <strong className="text-[#003553]">{vitals.mach_lan_phut || '—'}</strong> l/p
                    </span>
                    <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md font-semibold text-slate-700">
                        Huyết áp: <strong className="text-[#003553]">{vitals.huyet_ap_tam_thu || '—'}/{vitals.huyet_ap_tam_truong || '—'}</strong> mmHg
                    </span>
                    <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md font-semibold text-slate-700">
                        Nhiệt độ: <strong className="text-[#003553]">{vitals.nhiet_do_c || '—'}</strong> °C
                    </span>
                    <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md font-semibold text-slate-700">
                        SpO2: <strong className="text-[#003553]">{vitals.spo2_phan_tram || '—'}</strong>%
                    </span>
                    <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md font-semibold text-slate-700">
                        BMI: <strong className="text-[#003553]">{bmi || '—'}</strong> kg/m²
                    </span>
                </div>
            )}
        </div>
    )
}
