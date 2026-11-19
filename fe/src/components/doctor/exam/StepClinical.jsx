import { useSelector } from 'react-redux'
import { VITAL_FIELDS, computeBmi, getBmiClassification } from './examHelpers'
import SpecialtyExamSection from './SpecialtyExamSection'

export default function StepClinical({ formik, encounter, locked }) {
    const currentUser = useSelector((state) => state.app?.auth?.user)
    const { values, errors, handleChange, handleBlur } = formik
    const bmi = computeBmi(values.can_nang_kg, values.chieu_cao_cm)
    const bmiInfo = getBmiClassification(bmi)
    const bmiBadgeStyle = bmiInfo
        ? Number(bmi) >= 25
            ? 'bg-clinic-danger-bg text-clinic-danger border-clinic-danger-border'
            : bmiInfo.alert
              ? 'bg-clinic-warning-bg text-clinic-warning border-clinic-warning-border'
              : 'bg-clinic-success-bg text-clinic-success border-clinic-success-border'
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
            <section>
                <h3 className="medpro-section-title">Sinh hiệu</h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                    {VITAL_FIELDS.map((f) => {
                        const num = Number(values[f.name])
                        const flag = values[f.name] !== '' && !Number.isNaN(num) && f.alert ? f.alert(num) : null
                        const err = errors[f.name]
                        return (
                            <label
                                key={f.name}
                                className={`flex cursor-text flex-col gap-1 rounded-[6px] border px-3 py-2 transition-colors ${
                                    err
                                        ? 'bg-clinic-danger-bg border-clinic-danger-solid'
                                        : flag
                                          ? 'bg-clinic-warning-bg border-clinic-warning-border'
                                          : 'bg-clinic-bg border-clinic-border focus-within:border-clinic-cta focus-within:bg-clinic-surface'
                                }`}
                            >
                                <span className="text-[11.5px] font-semibold text-clinic-text-secondary">{f.label}</span>
                                <span className="flex items-baseline gap-1.5">
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
                                        className="w-full min-w-0 bg-transparent text-[20px] font-bold text-clinic-navy tabular-nums outline-none disabled:text-clinic-text-muted placeholder:text-clinic-text-subtle"
                                        style={{ backgroundColor: 'transparent' }}
                                    />
                                    <span className="whitespace-nowrap text-[11.5px] text-clinic-text-muted">{f.unit}</span>
                                </span>
                                {err ? (
                                    <span className="text-[11px] font-semibold text-clinic-danger">{err}</span>
                                ) : (
                                    flag && (
                                        <span className="inline-flex w-fit items-center rounded-[4px] border border-clinic-warning-border bg-clinic-surface px-1.5 py-0.5 text-[10.5px] font-bold text-clinic-warning">
                                            {flag}
                                        </span>
                                    )
                                )}
                            </label>
                        )
                    })}
                    <div
                        className={`flex flex-col gap-1 rounded-[6px] border px-3 py-2 transition-colors ${
                            bmiInfo?.alert
                                ? 'bg-clinic-warning-bg border-clinic-warning-border'
                                : 'bg-clinic-surface-alt border-clinic-info-border'
                        }`}
                    >
                        <span className="text-[11.5px] font-semibold text-clinic-text-secondary">BMI · tự tính</span>
                        <div className="flex flex-wrap items-baseline justify-between gap-1">
                            <span className="flex items-baseline gap-1.5">
                                <span className="text-[20px] font-bold text-clinic-navy tabular-nums">{bmi || '—'}</span>
                                <span className="text-[11.5px] text-clinic-text-muted">kg/m²</span>
                            </span>
                            {bmiInfo && (
                                <span
                                    className={`inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[10.5px] font-bold ${bmiBadgeStyle}`}
                                >
                                    {bmiInfo.label}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <SpecialtyExamSection formik={formik} defaultKhoa={resolvedKhoa} locked={locked} />

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                    <span className="medpro-label">Lý do vào khám</span>
                    <textarea name="ly_do_vao_kham" rows={2} className="medpro-input" value={values.ly_do_vao_kham} onChange={handleChange} disabled={locked} />
                </label>
                <label>
                    <span className="medpro-label">Bệnh sử</span>
                    <textarea name="benh_su" rows={3} className="medpro-input" value={values.benh_su} onChange={handleChange} disabled={locked} />
                </label>
                <label>
                    <span className="medpro-label">Khám toàn thân &amp; ghi chú khác</span>
                    <textarea
                        name="kham_lam_sang_bo_phan"
                        rows={3}
                        className="medpro-input"
                        value={values.kham_lam_sang_bo_phan}
                        onChange={handleChange}
                        disabled={locked}
                    />
                </label>
            </section>
        </div>
    )
}
