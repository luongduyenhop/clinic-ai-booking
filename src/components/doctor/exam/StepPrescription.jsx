import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { AutoComplete } from 'antd'
import { searchDrugsAsync } from '../../../redux/actions/doctor/clinicalAction'
import { useDebounce } from '../../../hooks/useDebounce'
import { findAllergyConflict } from '../../../utils/constants/clinical'
import { ClinicIcon } from '../../common/ClinicIcon'
import { DOSE_SLOTS, computeQuantity } from './examHelpers'

const GRID = 'grid grid-cols-[minmax(200px,2fr)_repeat(4,52px)_60px_56px_minmax(170px,2fr)_40px] items-center gap-2'

export default function StepPrescription({ formik, encounter, locked }) {
    const dispatch = useDispatch()
    const { values, setFieldValue, handleChange } = formik
    const rows = values.danh_sach_thuoc
    const [keyword, setKeyword] = useState('')
    const [options, setOptions] = useState([])
    const debounced = useDebounce(keyword, 250)
    const allergy = encounter.benh_nhan.di_ung_thuoc

    useEffect(() => {
        if (!debounced.trim()) return
        let cancelled = false
        dispatch(searchDrugsAsync(debounced))
            .unwrap()
            .then((list) => {
                if (cancelled) return
                setOptions(
                    list.map((d) => ({
                        value: d.ten_thuoc,
                        label: (
                            <span>
                                <strong className="text-[#003553]">{d.ten_thuoc}</strong>
                                <span className="ml-2 text-slate-500">{d.hoat_chat}</span>
                            </span>
                        ),
                        item: d,
                    }))
                )
            })
            .catch(() => !cancelled && setOptions([]))
        return () => {
            cancelled = true
        }
    }, [debounced, dispatch])

    const addDrug = (_, option) => {
        const d = option.item
        setFieldValue('danh_sach_thuoc', [
            ...rows,
            { ...d, sang: '1', trua: '', chieu: '1', toi: '', so_ngay_dung: '5' },
        ])
        setKeyword('')
        setOptions([])
    }

    const updateRow = (index, patch) => setFieldValue('danh_sach_thuoc', rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
    const removeRow = (index) => setFieldValue('danh_sach_thuoc', rows.filter((_, i) => i !== index))
    const replaceWithParacetamol = (index) =>
        updateRow(index, {
            ten_thuoc: 'Paracetamol 500mg',
            hoat_chat: 'Paracetamol',
            ham_luong: '500mg',
            don_vi_tinh: 'Viên',
            cach_dung: 'Uống khi sốt trên 38.5 °C, cách nhau ít nhất 4 giờ',
        })

    return (
        <div className="flex flex-col gap-5">
            <label>
                <span className="medpro-label">Thêm thuốc</span>
                <AutoComplete
                    className="w-full"
                    value={keyword}
                    options={options}
                    onSearch={setKeyword}
                    onChange={setKeyword}
                    onSelect={addDrug}
                    disabled={locked}
                    placeholder="Gõ tên thuốc hoặc hoạt chất…"
                    notFoundContent={debounced ? 'Không tìm thấy thuốc' : null}
                />
            </label>

            <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
                <div className="min-w-[880px]">
                    <div className={`${GRID} rounded-t-xl bg-[#F0F7FC] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#003553]`}>
                        <span>Thuốc · hoạt chất</span>
                        {DOSE_SLOTS.map((s) => (
                            <span key={s.key} className="text-center">
                                {s.label}
                            </span>
                        ))}
                        <span className="text-center">Ngày</span>
                        <span className="text-center">SL</span>
                        <span>Cách dùng</span>
                        <span />
                    </div>
                    {rows.length === 0 && <p className="px-4 py-6 text-center text-slate-500">Chưa có thuốc trong đơn.</p>}
                    {rows.map((r, i) => {
                        const conflict = findAllergyConflict(r.hoat_chat, allergy)
                        return (
                            <div key={`${r.ten_thuoc}-${i}`} className={`border-t border-slate-100 ${conflict ? 'bg-rose-50/50' : ''}`}>
                                <div className={`${GRID} px-4 py-2.5`}>
                                    <div className="min-w-0">
                                        <div className="font-semibold text-[#003553]">{r.ten_thuoc}</div>
                                        <div className="text-[12px] text-slate-500">
                                            {r.hoat_chat} · {r.don_vi_tinh}
                                        </div>
                                    </div>
                                    {DOSE_SLOTS.map((s) => (
                                        <input
                                            key={s.key}
                                            aria-label={`${s.label} — ${r.ten_thuoc}`}
                                            inputMode="decimal"
                                            className="medpro-input !px-1 text-center"
                                            value={r[s.key]}
                                            onChange={(e) => updateRow(i, { [s.key]: e.target.value })}
                                            disabled={locked}
                                        />
                                    ))}
                                    <input
                                        aria-label={`Số ngày — ${r.ten_thuoc}`}
                                        inputMode="numeric"
                                        className="medpro-input !px-1 text-center"
                                        value={r.so_ngay_dung}
                                        onChange={(e) => updateRow(i, { so_ngay_dung: e.target.value })}
                                        disabled={locked}
                                    />
                                    <span className="text-center font-bold text-[#003553]">{computeQuantity(r)}</span>
                                    <input
                                        aria-label={`Cách dùng — ${r.ten_thuoc}`}
                                        className="medpro-input"
                                        value={r.cach_dung}
                                        onChange={(e) => updateRow(i, { cach_dung: e.target.value })}
                                        disabled={locked}
                                    />
                                    {!locked ? (
                                        <button
                                            type="button"
                                            aria-label={`Xóa ${r.ten_thuoc}`}
                                            onClick={() => removeRow(i)}
                                            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                                        >
                                            <ClinicIcon name="Trash" size={16} />
                                        </button>
                                    ) : (
                                        <span />
                                    )}
                                </div>
                                {conflict && (
                                    <div className="mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-rose-100/70 px-4 py-2.5 text-[13px] font-medium text-rose-800">
                                        <ClinicIcon name="Warning" size={16} weight="bold" />
                                        <span className="flex-1">
                                            {r.hoat_chat} thuộc nhóm {conflict} — hồ sơ bệnh nhân ghi nhận “{allergy}”.
                                        </span>
                                        {!locked && conflict === 'NSAID' && (
                                            <button type="button" className="medpro-btn-outline !py-1" onClick={() => replaceWithParacetamol(i)}>
                                                Đổi sang Paracetamol 500mg
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            <label>
                <span className="medpro-label">Lời dặn uống thuốc</span>
                <input name="loi_dan_uong_thuoc" className="medpro-input" value={values.loi_dan_uong_thuoc} onChange={handleChange} disabled={locked} />
            </label>

            <section className="grid grid-cols-1 gap-4 rounded-xl bg-[#E8F4FD] p-4 md:grid-cols-[200px_1fr]">
                <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#003553] md:col-span-2">Hẹn tái khám</h3>
                <label>
                    <span className="medpro-label">Ngày hẹn</span>
                    <input type="date" name="ngay_hen_tai_kham" className="medpro-input" value={values.ngay_hen_tai_kham} onChange={handleChange} disabled={locked} />
                </label>
                <label>
                    <span className="medpro-label">Lời dặn bác sĩ</span>
                    <input name="loi_dan_bac_si" className="medpro-input" value={values.loi_dan_bac_si} onChange={handleChange} disabled={locked} />
                </label>
            </section>
        </div>
    )
}
