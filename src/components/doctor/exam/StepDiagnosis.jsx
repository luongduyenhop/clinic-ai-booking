import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { AutoComplete, Rate } from 'antd'
import { searchIcd10Async } from '../../../redux/actions/doctor/clinicalAction'
import { useDebounce } from '../../../hooks/useDebounce'
import { ClinicIcon } from '../../common/ClinicIcon'

function DiagnosisRow({ dx, primary, locked, onRemove, onMakePrimary }) {
    return (
        <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3 ${primary ? 'bg-[#E8F4FD] ring-2 ring-[#00B5F1]' : 'bg-[#F5F9FC]'}`}
        >
            <span className="min-w-14 font-bold text-[#003553]">{dx.ma_icd10}</span>
            <span className="flex-1 text-[13px]">{dx.ten_benh_chan_doan}</span>
            {!primary && !locked && (
                <button type="button" className="text-[12px] font-semibold text-[#0077B6] hover:underline cursor-pointer" onClick={onMakePrimary}>
                    Đặt làm chính
                </button>
            )}
            {!locked && (
                <button
                    type="button"
                    aria-label={`Bỏ chẩn đoán ${dx.ma_icd10}`}
                    onClick={onRemove}
                    className="rounded-full p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                >
                    <ClinicIcon name="X" size={14} />
                </button>
            )}
        </div>
    )
}

export default function StepDiagnosis({ formik, encounter, locked, onRateAi }) {
    const dispatch = useDispatch()
    const { values, setFieldValue, handleChange, errors } = formik
    const [keyword, setKeyword] = useState('')
    const [options, setOptions] = useState([])
    const [rating, setRating] = useState(encounter.danh_gia_ai?.so_sao || 0)
    const [ratingNote, setRatingNote] = useState(encounter.danh_gia_ai?.nhan_xet || '')
    const debounced = useDebounce(keyword, 250)

    const list = values.danh_sach_chan_doan
    const primary = list.find((d) => d.loai_chan_doan === 'chinh')
    const secondary = list.filter((d) => d.loai_chan_doan !== 'chinh')

    useEffect(() => {
        if (!debounced.trim()) return
        let cancelled = false
        dispatch(searchIcd10Async(debounced))
            .unwrap()
            .then((rows) => {
                if (cancelled) return
                setOptions(
                    rows.map((r) => ({
                        value: r.ma,
                        label: (
                            <span>
                                <strong className="mr-2 text-[#003553]">{r.ma}</strong>
                                {r.ten}
                            </span>
                        ),
                        item: r,
                    }))
                )
            })
            .catch(() => !cancelled && setOptions([]))
        return () => {
            cancelled = true
        }
    }, [debounced, dispatch])

    const addDiagnosis = (_, option) => {
        const r = option.item
        if (list.some((d) => d.ma_icd10 === r.ma)) return
        const loai = primary ? 'phu' : 'chinh'
        setFieldValue('danh_sach_chan_doan', [...list, { ma_icd10: r.ma, ten_benh_chan_doan: r.ten, loai_chan_doan: loai }])
        setKeyword('')
        setOptions([])
    }

    const remove = (ma) => setFieldValue('danh_sach_chan_doan', list.filter((d) => d.ma_icd10 !== ma))
    const makePrimary = (ma) =>
        setFieldValue(
            'danh_sach_chan_doan',
            list.map((d) => ({ ...d, loai_chan_doan: d.ma_icd10 === ma ? 'chinh' : 'phu' }))
        )

    const ai = encounter.ai_triage

    return (
        <div className="flex flex-wrap gap-5">
            <div className="flex min-w-0 flex-[999_1_380px] flex-col gap-4">
                <label>
                    <span className="medpro-label">Tìm mã bệnh WHO ICD-10</span>
                    <AutoComplete
                        className="w-full"
                        value={keyword}
                        options={options}
                        onSearch={setKeyword}
                        onChange={setKeyword}
                        onSelect={addDiagnosis}
                        disabled={locked}
                        placeholder="Gõ mã hoặc tên bệnh, ví dụ A09, tiêu chảy…"
                        notFoundContent={debounced ? 'Không tìm thấy mã phù hợp' : null}
                    />
                </label>

                <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Chẩn đoán chính</span>
                    {primary ? (
                        <DiagnosisRow dx={primary} primary locked={locked} onRemove={() => remove(primary.ma_icd10)} />
                    ) : (
                        <p className={`rounded-xl px-4 py-3 text-[13px] ${errors.danh_sach_chan_doan ? 'bg-rose-50 text-rose-700' : 'bg-[#F5F9FC] text-slate-500'}`}>
                            {errors.danh_sach_chan_doan || 'Chưa có chẩn đoán chính. Mã đầu tiên bạn chọn sẽ là chẩn đoán chính.'}
                        </p>
                    )}
                    <span className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Chẩn đoán phụ</span>
                    {secondary.length === 0 && <p className="text-[12px] text-slate-500">Không có.</p>}
                    {secondary.map((d) => (
                        <DiagnosisRow
                            key={d.ma_icd10}
                            dx={d}
                            locked={locked}
                            onRemove={() => remove(d.ma_icd10)}
                            onMakePrimary={() => makePrimary(d.ma_icd10)}
                        />
                    ))}
                </div>

                <label>
                    <span className="medpro-label">Kết luận điều trị</span>
                    <textarea name="ket_luan_dieu_tri" rows={3} className="medpro-input" value={values.ket_luan_dieu_tri} onChange={handleChange} disabled={locked} />
                </label>
            </div>

            {ai && (
                <div className="flex flex-[1_1_260px] flex-col gap-3 self-start rounded-2xl bg-[#E8F4FD] p-4">
                    <h3 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-[#003553]">
                        <ClinicIcon name="Robot" size={16} /> Đánh giá gợi ý AI
                    </h3>
                    <p className="text-[13px] leading-relaxed">
                        AI Triage đã gợi ý <strong>Khoa {ai.ten_chuyen_khoa}</strong> cho bệnh nhân này. Gợi ý có phù hợp với chẩn đoán của bác sĩ không?
                    </p>
                    <Rate value={rating} onChange={setRating} disabled={locked} />
                    <input
                        className="medpro-input"
                        placeholder="Nhận xét thêm (không bắt buộc)"
                        value={ratingNote}
                        onChange={(e) => setRatingNote(e.target.value)}
                        disabled={locked}
                    />
                    <button
                        type="button"
                        className="medpro-btn-outline self-start"
                        disabled={locked || rating === 0}
                        onClick={() => onRateAi({ so_sao: rating, nhan_xet: ratingNote })}
                    >
                        Gửi đánh giá
                    </button>
                    <span className="text-[11px] text-slate-500">Dùng để cải thiện mô hình AI, bệnh nhân không thấy.</span>
                </div>
            )}
        </div>
    )
}
