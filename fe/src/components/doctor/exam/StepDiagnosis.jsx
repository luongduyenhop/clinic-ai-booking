import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { AutoComplete, Rate } from 'antd'
import { searchIcd10Async } from '../../../redux/actions/doctor/clinicalAction'
import { useDebounce } from '../../../hooks/useDebounce'
import { ClinicIcon } from '../../common/ClinicIcon'

const DEPARTMENT_ICD10_PRESETS = {
    KHOA_NOI: [
        { ma: 'I10', ten: 'Tăng huyết áp vô căn (nguyên phát)' },
        { ma: 'E11', ten: 'Đái tháo đường típ 2' },
        { ma: 'K29.7', ten: 'Viêm dạ dày - tá tràng' },
        { ma: 'K21.0', ten: 'Trào ngược dạ dày thực quản (GERD)' },
        { ma: 'A09', ten: 'Tiêu chảy và viêm dạ dày ruột' },
    ],
    KHOA_NGOAI: [
        { ma: 'T14.1', ten: 'Vết thương hở vùng cơ thể' },
        { ma: 'L02.9', ten: 'Áp xe da, nhọt và cụm nhọt' },
        { ma: 'S93.4', ten: 'Bong gân và căng cơ khớp cổ chân' },
        { ma: 'K80.0', ten: 'Sỏi túi mật kèm viêm túi mật' },
    ],
    KHOA_TMH: [
        { ma: 'J02.9', ten: 'Viêm họng cấp' },
        { ma: 'J01.9', ten: 'Viêm xoang cấp' },
        { ma: 'J03.9', ten: 'Viêm amidan cấp' },
        { ma: 'H66.9', ten: 'Viêm tai giữa không đặc hiệu' },
        { ma: 'J30.4', ten: 'Viêm mũi dị ứng' },
    ],
    KHOA_RANG: [
        { ma: 'K02.9', ten: 'Sâu răng không đặc hiệu' },
        { ma: 'K04.0', ten: 'Viêm tủy răng' },
        { ma: 'K05.1', ten: 'Viêm lợi mạn tính' },
        { ma: 'K01.1', ten: 'Răng khôn mọc lệch / ngầm' },
    ],
    KHOA_MAT: [
        { ma: 'H10.9', ten: 'Viêm kết mạc không đặc hiệu (Đau mắt đỏ)' },
        { ma: 'H52.1', ten: 'Cận thị' },
        { ma: 'H52.2', ten: 'Loạn thị' },
        { ma: 'H25.9', ten: 'Đục thủy tinh thể người già' },
    ],
}

function DiagnosisRow({ dx, primary, locked, onRemove, onMakePrimary }) {
    return (
        <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3 ${primary ? 'bg-[#E8F4FD] ring-2 ring-[#00B5F1]' : 'bg-[#F5F9FC]'}`}
        >
            <span className="min-w-14 font-bold text-[#003553]">{dx.ma_icd10}</span>
            <span className="flex-1 text-[13px]">{dx.ten_benh_chan_doan}</span>
            {primary ? (
                <span className="rounded-md bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold text-[#0077B6] border border-sky-300">
                    Chẩn đoán chính
                </span>
            ) : (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    Chẩn đoán phụ
                </span>
            )}
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

    const remove = (ma) => {
        const nextList = list.filter((d) => d.ma_icd10 !== ma)
        if (primary?.ma_icd10 === ma && nextList.length > 0) {
            nextList[0] = { ...nextList[0], loai_chan_doan: 'chinh' }
        }
        setFieldValue('danh_sach_chan_doan', nextList)
    }
    const makePrimary = (ma) =>
        setFieldValue(
            'danh_sach_chan_doan',
            list.map((d) => ({ ...d, loai_chan_doan: d.ma_icd10 === ma ? 'chinh' : 'phu' }))
        )

    const ai = encounter.ai_triage
    const deptCode = encounter?.khoa_chuyen_mon || encounter?.ma_chuyen_khoa || 'KHOA_NOI'
    const presets = DEPARTMENT_ICD10_PRESETS[deptCode] || DEPARTMENT_ICD10_PRESETS.KHOA_NOI

    const handlePickPreset = (p) => {
        if (locked || list.some((d) => d.ma_icd10 === p.ma)) return
        const loai = primary ? 'phu' : 'chinh'
        setFieldValue('danh_sach_chan_doan', [...list, { ma_icd10: p.ma, ten_benh_chan_doan: p.ten, loai_chan_doan: loai }])
    }

    return (
        <div className="flex flex-wrap gap-5">
            <div className="flex min-w-0 flex-[999_1_380px] flex-col gap-4">
                <div>
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
                    {!locked && presets.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="text-[11px] font-semibold text-slate-500 mr-1">Gợi ý nhanh theo khoa:</span>
                            {presets.map((p) => {
                                const alreadySelected = list.some((d) => d.ma_icd10 === p.ma)
                                return (
                                    <button
                                        key={p.ma}
                                        type="button"
                                        onClick={() => handlePickPreset(p)}
                                        disabled={alreadySelected}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                            alreadySelected
                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                : 'bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100'
                                        }`}
                                    >
                                        <span className="font-bold text-[#0077B6]">{p.ma}</span>
                                        <span>{p.ten}</span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            Chẩn đoán chính <span className="text-rose-500">* (Bắt buộc 1 mã ICD-10)</span>
                        </span>
                        {primary && (
                            <span className="text-[11px] font-semibold text-emerald-600">✓ Đã chọn mã chính</span>
                        )}
                    </div>
                    {primary ? (
                        <DiagnosisRow dx={primary} primary locked={locked} onRemove={() => remove(primary.ma_icd10)} />
                    ) : (
                        <div className="flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50/80 px-4 py-3 text-rose-800">
                            <ClinicIcon name="WarningCircle" size={18} className="mt-0.5 shrink-0 text-rose-600" />
                            <div className="text-[13px] leading-relaxed">
                                <strong className="font-semibold">Bắt buộc chọn đúng 1 mã bệnh chính (ICD-10).</strong>
                                <p className="text-[12px] text-rose-700 mt-0.5">
                                    Vui lòng tìm kiếm mã ở ô bên trên hoặc nhấn chọn từ danh mục gợi ý nhanh theo chuyên khoa.
                                </p>
                            </div>
                        </div>
                    )}
                    <span className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Chẩn đoán phụ (không bắt buộc)</span>
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
