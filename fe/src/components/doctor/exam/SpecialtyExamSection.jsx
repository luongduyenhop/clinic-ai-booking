import { SPECIALTY_EXAMS, findSpecialtyExam } from '../../../utils/constants/clinical'

const STATUS_OPTIONS = [
    { code: 'BT', label: 'Bình thường', on: 'bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500' },
    { code: 'BAT', label: 'Bất thường', on: 'bg-rose-50 text-rose-800 ring-2 ring-rose-500' },
]

// Khối khám lâm sàng theo chuyên khoa: mục khám đổi theo khoa của lượt khám
export default function SpecialtyExamSection({ formik, defaultKhoa, locked }) {
    const { values, setFieldValue } = formik
    const exam = values.kham_chuyen_khoa
    const khoa = exam.khoa || defaultKhoa
    const spec = findSpecialtyExam(khoa)

    const update = (patch) => setFieldValue('kham_chuyen_khoa', { ...exam, khoa, ...patch })
    const setItem = (label, patch) => update({ items: { ...exam.items, [label]: { ...exam.items?.[label], ...patch } } })
    const setExtra = (key, value) => update({ extras: { ...exam.extras, [key]: value } })

    const markAllNormal = () =>
        update({
            items: Object.fromEntries(spec.items.map((label) => [label, { status: 'BT', note: '' }])),
        })

    const switchKhoa = (key) => setFieldValue('kham_chuyen_khoa', { khoa: key, items: {}, extras: {} })

    const done = spec.items.filter((label) => exam.items?.[label]?.status).length

    return (
        <section className="flex flex-col gap-3">
            <div className="medpro-section-title !mb-0 flex-wrap">
                <span>Khám chuyên khoa</span>
                <span className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                        Khoa
                        <select
                            className="medpro-input !w-auto !py-1"
                            value={khoa}
                            onChange={(e) => switchKhoa(e.target.value)}
                            disabled={locked}
                            aria-label="Chọn chuyên khoa khám"
                        >
                            {SPECIALTY_EXAMS.map((s) => (
                                <option key={s.key} value={s.key}>
                                    {s.label}
                                    {s.key === defaultKhoa ? ' (khoa của lượt khám)' : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                    {!locked && (
                        <button type="button" className="medpro-btn-outline !py-1" onClick={markAllNormal}>
                            Tất cả bình thường
                        </button>
                    )}
                </span>
            </div>
            <p className="text-[12px] text-slate-500">
                Đã khám {done}/{spec.items.length} mục. Mục bất thường cần ghi mô tả.
            </p>

            <div className="flex flex-col divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                {spec.items.map((label) => {
                    const it = exam.items?.[label] || {}
                    const missingNote = it.status === 'BAT' && !String(it.note || '').trim()
                    return (
                        <div key={label} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                            <span className="min-w-[150px] flex-1 font-semibold text-[#003553]">{label}</span>
                            <div role="radiogroup" aria-label={label} className="flex gap-1.5">
                                {STATUS_OPTIONS.map((o) => (
                                    <button
                                        key={o.code}
                                        type="button"
                                        role="radio"
                                        aria-checked={it.status === o.code}
                                        disabled={locked}
                                        onClick={() => setItem(label, { status: it.status === o.code ? undefined : o.code })}
                                        className={`rounded-full px-3 py-1 text-[12px] font-semibold transition cursor-pointer disabled:cursor-not-allowed ${
                                            it.status === o.code ? o.on : 'bg-[#F5F9FC] text-slate-600 hover:bg-[#EEF6FC]'
                                        }`}
                                    >
                                        {o.label}
                                    </button>
                                ))}
                            </div>
                            {it.status === 'BAT' && (
                                <input
                                    aria-label={`Mô tả bất thường — ${label}`}
                                    className={`medpro-input basis-full ${missingNote ? '!border-rose-400' : ''}`}
                                    placeholder={`Mô tả bất thường ở mục ${label.toLowerCase()}…`}
                                    value={it.note || ''}
                                    onChange={(e) => setItem(label, { note: e.target.value })}
                                    disabled={locked}
                                />
                            )}
                        </div>
                    )
                })}
            </div>

            {spec.extras.length > 0 && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {spec.extras.map((x) => (
                        <label key={x.key}>
                            <span className="medpro-label">{x.label}</span>
                            {x.type === 'select' ? (
                                <select className="medpro-input" value={exam.extras?.[x.key] || ''} onChange={(e) => setExtra(x.key, e.target.value)} disabled={locked}>
                                    <option value="">— Chọn —</option>
                                    {x.options.map((op) => (
                                        <option key={op} value={op}>
                                            {op}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="number"
                                    min={x.min}
                                    max={x.max}
                                    className="medpro-input"
                                    value={exam.extras?.[x.key] ?? ''}
                                    onChange={(e) => setExtra(x.key, e.target.value)}
                                    disabled={locked}
                                />
                            )}
                        </label>
                    ))}
                </div>
            )}
        </section>
    )
}
