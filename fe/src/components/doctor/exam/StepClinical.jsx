import { useSelector } from 'react-redux'
import { VITAL_FIELDS, computeBmi, getBmiClassification } from './examHelpers'
import SpecialtyExamSection from './SpecialtyExamSection'

export default function StepClinical({ formik, encounter, locked }) {
    const currentUser = useSelector((state) => state.app?.auth?.user)
    const { values, errors, handleChange, handleBlur } = formik
    const bmi = computeBmi(values.can_nang_kg, values.chieu_cao_cm)
    const bmiInfo = getBmiClassification(bmi)
    const bmiHasWarning = Boolean(bmiInfo && (Number(bmi) >= 25 || bmiInfo.alert))
    const bmiBadgeStyle = bmiInfo
        ? Number(bmi) >= 25
            ? 'bg-clinic-danger-bg text-clinic-danger border-clinic-danger-border'
            : bmiInfo.alert
              ? 'bg-clinic-warning-bg text-clinic-warning border-clinic-warning-border'
              : 'bg-clinic-bg-muted text-clinic-text-secondary border-clinic-border'
        : ''
    const resolvedKhoa =
        currentUser?.chuyen_khoa_ma ||
        currentUser?.chuyen_khoa ||
        currentUser?.specialty ||
        currentUser?.department ||
        encounter?.chuyen_khoa_kham ||
        encounter?.ten_chuyen_khoa

    return (
        <div className="flex flex-col gap-5">
            <section className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <label className="md:col-span-2">
                    <span className="medpro-label">Lý do vào khám</span>
                    <textarea
                        name="ly_do_vao_kham"
                        rows={2}
                        placeholder="Triệu chứng chính khiến người bệnh đến khám hôm nay..."
                        className="medpro-input !py-2 text-[13.5px]"
                        value={values.ly_do_vao_kham}
                        onChange={handleChange}
                        disabled={locked}
                    />
                </label>
                <label>
                    <span className="medpro-label">Bệnh sử &amp; diễn tiến</span>
                    <textarea
                        name="benh_su"
                        rows={3}
                        placeholder="Khởi phát, thời gian, tính chất triệu chứng, thuốc đã dùng..."
                        className="medpro-input !py-2 text-[13.5px]"
                        value={values.benh_su}
                        onChange={handleChange}
                        disabled={locked}
                    />
                </label>
                <label>
                    <span className="medpro-label">Khám toàn thân &amp; ghi chú lâm sàng</span>
                    <textarea
                        name="kham_lam_sang_bo_phan"
                        rows={3}
                        placeholder="Tổng trạng, da niêm, hạch ngoại vi và nhận định tổng quát..."
                        className="medpro-input !py-2 text-[13.5px]"
                        value={values.kham_lam_sang_bo_phan}
                        onChange={handleChange}
                        disabled={locked}
                    />
                </label>
            </section>

            <section>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-clinic-navy">Chỉ số sinh hiệu</h3>
                    {bmiInfo && (
                        <span
                            className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium tabular-nums ${bmiBadgeStyle}`}
                        >
                            BMI {bmi} · {bmiInfo.label}
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 2xl:grid-cols-8 gap-2">
                    {VITAL_FIELDS.map((f) => {
                        const num = Number(values[f.name])
                        const flag = values[f.name] !== '' && !Number.isNaN(num) && f.alert ? f.alert(num) : null
                        const err = errors[f.name]
                        return (
                            <label
                                key={f.name}
                                className={`flex cursor-text flex-col justify-between gap-1 rounded-[6px] border px-2.5 py-1.5 transition-colors ${
                                    err
                                        ? 'bg-clinic-danger-bg border-clinic-danger-solid'
                                        : flag
                                          ? 'bg-clinic-warning-bg border-clinic-warning-border'
                                          : 'bg-clinic-bg border-clinic-border focus-within:border-clinic-cta focus-within:bg-clinic-surface'
                                }`}
                            >
                                <span className="flex items-baseline justify-between gap-1">
                                    <span className="text-[11px] font-medium text-clinic-text-secondary truncate">{f.label}</span>
                                    <span className="shrink-0 text-[10px] text-clinic-text-muted">{f.unit}</span>
                                </span>
                                <input
                                    name={f.name}
                                    autoComplete="off"
                                    inputMode="decimal"
                                    value={values[f.name]}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    disabled={locked}
                                    aria-invalid={Boolean(err)}
                                    placeholder="—"
                                    className="w-full min-w-0 bg-transparent text-[15px] font-semibold text-clinic-navy tabular-nums outline-none disabled:text-clinic-text-muted placeholder:text-clinic-text-subtle"
                                    style={{ backgroundColor: 'transparent' }}
                                />
                                {err ? (
                                    <span className="text-[10px] font-medium text-clinic-danger truncate">{err}</span>
                                ) : flag ? (
                                    <span className="text-[10px] font-semibold text-clinic-warning truncate">{flag}</span>
                                ) : null}
                            </label>
                        )
                    })}
                    <div
                        className={`flex flex-col justify-between gap-1 rounded-[6px] border px-2.5 py-1.5 ${
                            bmiHasWarning
                                ? 'bg-clinic-warning-bg border-clinic-warning-border'
                                : 'bg-clinic-bg-muted/70 border-clinic-border'
                        }`}
                    >
                        <span className="flex items-baseline justify-between gap-1">
                            <span className="text-[11px] font-medium text-clinic-text-secondary truncate">BMI tự tính</span>
                            <span className="shrink-0 text-[10px] text-clinic-text-muted">kg/m²</span>
                        </span>
                        <span className="text-[15px] font-semibold text-clinic-navy tabular-nums">{bmi || '—'}</span>
                    </div>
                </div>
            </section>

            <SpecialtyExamSection formik={formik} defaultKhoa={resolvedKhoa} locked={locked} />
        </div>
    )
}
