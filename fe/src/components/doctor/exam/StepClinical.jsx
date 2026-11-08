import { useSelector } from 'react-redux'
import { VITAL_FIELDS, computeBmi, getBmiClassification } from './examHelpers'
import SpecialtyExamSection from './SpecialtyExamSection'

export default function StepClinical({ formik, encounter, locked }) {
    const currentUser = useSelector((state) => state.app?.auth?.user)
    const { values, errors, handleChange, handleBlur } = formik
    const bmi = computeBmi(values.can_nang_kg, values.chieu_cao_cm)
    const bmiInfo = getBmiClassification(bmi)
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
                                className={`flex cursor-text flex-col gap-1 rounded-xl px-3 py-2.5 transition-all ${
                                    err
                                        ? 'bg-rose-50 ring-2 ring-rose-300'
                                        : flag
                                        ? 'bg-amber-50/70 ring-2 ring-amber-400'
                                        : 'bg-[#E8F4FD]'
                                }`}
                            >
                                <span className="text-[12px] font-medium text-slate-600">{f.label}</span>
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
                                        className="w-full min-w-0 bg-transparent text-[20px] font-bold text-[#003553] outline-none disabled:text-slate-500 placeholder:text-slate-300"
                                        style={{ backgroundColor: 'transparent' }}
                                    />
                                    <span className="whitespace-nowrap text-[12px] text-slate-500">{f.unit}</span>
                                </span>
                                {err ? (
                                    <span className="text-[11px] font-semibold text-rose-700">{err}</span>
                                ) : (
                                    flag && (
                                        <span className="inline-flex w-fit items-center rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                                            {flag}
                                        </span>
                                    )
                                )}
                            </label>
                        )
                    })}
                    <div
                        className={`flex flex-col gap-1 rounded-xl px-3 py-2.5 transition-all ${
                            bmiInfo?.alert
                                ? 'bg-amber-50/70 ring-2 ring-amber-400'
                                : 'bg-white ring-1 ring-slate-200'
                        }`}
                    >
                        <span className="text-[12px] font-medium text-slate-600">BMI · tự tính</span>
                        <div className="flex flex-wrap items-baseline justify-between gap-1">
                            <span className="flex items-baseline gap-1.5">
                                <span className="text-[20px] font-bold text-[#003553]">{bmi || '—'}</span>
                                <span className="text-[12px] text-slate-500">kg/m²</span>
                            </span>
                            {bmiInfo && (
                                <span
                                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${bmiInfo.badgeClass}`}
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
