import { useEffect, useState, useMemo } from 'react'
import { useDispatch } from 'react-redux'
import { AutoComplete, Rate } from 'antd'
import { searchIcd10Async } from '../../../redux/actions/doctor/clinicalAction'
import { useDebounce } from '../../../hooks/useDebounce'
import { ClinicIcon } from '../../common/ClinicIcon'
import ResultAttachments from '../../user/patient/ResultAttachments'

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
            className={`flex items-center gap-3 rounded-[6px] border px-4 py-3 ${
                primary ? 'bg-clinic-surface-alt border-clinic-cta' : 'bg-clinic-surface-tint border-clinic-border'
            }`}
        >
            <span className="min-w-14 font-bold text-clinic-navy tabular-nums">{dx.ma_icd10}</span>
            <span className="flex-1 text-[13px] text-clinic-text">{dx.ten_benh_chan_doan}</span>
            <span
                className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-semibold ${
                    primary ? 'medpro-badge-info' : 'medpro-badge-neutral'
                }`}
            >
                {primary ? 'Chẩn đoán chính' : 'Chẩn đoán phụ'}
            </span>
            {!primary && !locked && (
                <button type="button" className="text-[12px] font-semibold text-clinic-cta hover:underline cursor-pointer" onClick={onMakePrimary}>
                    Đặt làm chính
                </button>
            )}
            {!locked && (
                <button
                    type="button"
                    aria-label={`Bỏ chẩn đoán ${dx.ma_icd10}`}
                    onClick={onRemove}
                    className="rounded-[6px] p-2 text-clinic-text-secondary hover:bg-clinic-danger-bg hover:text-clinic-danger cursor-pointer"
                >
                    <ClinicIcon name="X" size={14} />
                </button>
            )}
        </div>
    )
}

function formatResultSummary(detail) {
    if (!detail) return null
    if (typeof detail === 'string') return detail
    if (typeof detail === 'object') {
        if (detail.ket_luan) return String(detail.ket_luan)
        if (detail.mo_ta) return String(detail.mo_ta)
        if (detail.tom_tat) return String(detail.tom_tat)
        if (Array.isArray(detail.chi_tiet)) {
            return detail.chi_tiet
                .map((ct) => `${ct.ten_chi_so || ct.ten || ct.ma}: ${ct.gia_tri} ${ct.don_vi || ''}`.trim())
                .join(', ')
        }
        if (detail.chi_so && typeof detail.chi_so === 'object') {
            return Object.entries(detail.chi_so)
                .map(([k, v]) => {
                    if (v && typeof v === 'object') {
                        return `${v.ten_chi_so || v.ten || k}: ${v.gia_tri ?? ''} ${v.don_vi || ''}`.trim()
                    }
                    return `${k}: ${v}`
                })
                .join(', ')
        }
        try {
            return JSON.stringify(detail)
        } catch {
            return String(detail)
        }
    }
    return String(detail)
}

export default function StepDiagnosis({
    formik,
    encounter,
    locked,
    doctorSpecialty = '',
    onRateAi,
    pickedOrders = [],
    services = [],
    onSendPickedOrders,
    onGoToStepOrders,
}) {
    const dispatch = useDispatch()
    const { values, setFieldValue, handleChange, errors } = formik
    const [keyword, setKeyword] = useState('')
    const [options, setOptions] = useState([])
    const debounced = useDebounce(keyword, 200)

    const ai = encounter?.ket_qua_ai || encounter?.lich_kham?.ket_qua_ai || encounter?.benh_nhan?.ket_qua_ai
    const [rating, setRating] = useState(encounter?.danh_gia_ai?.so_sao || 0)
    const [ratingNote, setRatingNote] = useState(encounter?.danh_gia_ai?.nhan_xet || '')

    const list = values.danh_sach_chan_doan || []
    const primary = list.find((d) => d.loai_chan_doan === 'chinh')
    const secondary = list.filter((d) => d.loai_chan_doan !== 'chinh')
    const clsOrders = (encounter?.danh_sach_chi_dinh || []).filter((o) => o.trang_thai !== 'da_huy')

    const pickedServices = useMemo(() => {
        return (pickedOrders || []).map((id) => services.find((s) => String(s.id) === String(id))).filter(Boolean)
    }, [pickedOrders, services])

    const deptKey = useMemo(() => {
        const raw = String(doctorSpecialty || encounter?.chuyen_khoa_kham || encounter?.ma_chuyen_khoa || encounter?.ten_chuyen_khoa || '').toUpperCase()
        if (raw.includes('NOI')) return 'KHOA_NOI'
        if (raw.includes('NGOAI')) return 'KHOA_NGOAI'
        if (raw.includes('TMH') || raw.includes('TAI_MUI_HONG') || raw.includes('TAI MŨI HỌNG')) return 'KHOA_TMH'
        if (raw.includes('RANG') || raw.includes('HAM_MAT')) return 'KHOA_RANG'
        if (raw.includes('MAT')) return 'KHOA_MAT'
        return 'KHOA_NOI'
    }, [doctorSpecialty, encounter])

    const presets = DEPARTMENT_ICD10_PRESETS[deptKey] || DEPARTMENT_ICD10_PRESETS.KHOA_NOI

    useEffect(() => {
        if (!debounced.trim()) {
            setOptions([])
            return
        }
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
                                <strong className="mr-2 text-clinic-navy tabular-nums">{r.ma}</strong>
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

    const handlePickPreset = (preset) => {
        if (locked || list.some((d) => d.ma_icd10 === preset.ma)) return
        const loai = primary ? 'phu' : 'chinh'
        setFieldValue('danh_sach_chan_doan', [...list, { ma_icd10: preset.ma, ten_benh_chan_doan: preset.ten, loai_chan_doan: loai }])
    }

    const remove = (ma) => {
        const next = list.filter((d) => d.ma_icd10 !== ma)
        if (next.length > 0 && !next.some((d) => d.loai_chan_doan === 'chinh')) {
            next[0] = { ...next[0], loai_chan_doan: 'chinh' }
        }
        setFieldValue('danh_sach_chan_doan', next)
    }

    const makePrimary = (ma) =>
        setFieldValue(
            'danh_sach_chan_doan',
            list.map((d) => ({ ...d, loai_chan_doan: d.ma_icd10 === ma ? 'chinh' : 'phu' }))
        )

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

                    {presets.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-2">
                            <span className="text-[11px] font-bold text-clinic-text-secondary mr-1">Gợi ý nhanh theo khoa:</span>
                            {presets.map((p) => {
                                const alreadySelected = list.some((d) => d.ma_icd10 === p.ma)
                                return (
                                    <button
                                        key={p.ma}
                                        type="button"
                                        onClick={() => handlePickPreset(p)}
                                        disabled={alreadySelected || locked}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-xs font-semibold transition cursor-pointer ${
                                            alreadySelected
                                                ? 'bg-clinic-bg-muted text-clinic-text-subtle cursor-not-allowed border border-clinic-border'
                                                : 'bg-clinic-surface-tint text-clinic-navy border border-clinic-info-border hover:bg-clinic-surface-alt'
                                        }`}
                                    >
                                        <span className="font-bold text-clinic-cta tabular-nums">{p.ma}</span>
                                        <span>{p.ten}</span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-clinic-text-secondary">Chẩn đoán chính (bắt buộc chọn 1 mã)</span>
                    {primary ? (
                        <DiagnosisRow dx={primary} primary locked={locked} onRemove={() => remove(primary.ma_icd10)} />
                    ) : (
                        <div className="rounded-[6px] border border-clinic-danger-border bg-clinic-danger-bg px-4 py-3 text-[13px] text-clinic-danger">
                            <span className="font-semibold inline-flex items-center gap-1.5">
                                <ClinicIcon name="Warning" size={14} weight="bold" />
                                <span>Bắt buộc chọn đúng 1 mã bệnh chính (ICD-10) để hoàn tất hồ sơ khám.</span>
                            </span>
                            <p className="mt-0.5 text-xs text-clinic-danger">
                                {errors.danh_sach_chan_doan || 'Chọn từ ô tìm kiếm nhanh hoặc bấm vào gợi ý nhanh bên trên.'}
                            </p>
                        </div>
                    )}
                    <span className="mt-2 text-xs font-bold text-clinic-text-secondary">Chẩn đoán phụ (nếu có)</span>
                    {secondary.length === 0 && <p className="text-[12px] text-clinic-text-secondary">Không có.</p>}
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

            <div className="flex flex-[1_1_280px] flex-col gap-4 self-start">
                {ai && (
                    <div className="medpro-card flex flex-col gap-3 rounded-[6px] bg-clinic-surface-alt p-4 border-clinic-info-border">
                        <h3 className="flex items-center gap-2 text-[12px] font-bold text-clinic-navy">
                            <ClinicIcon name="Stethoscope" size={16} /> Đánh giá gợi ý phân khoa
                        </h3>
                        <p className="text-[13px] leading-relaxed text-clinic-text">
                            AI Triage đã gợi ý <strong>Khoa {ai.ten_chuyen_khoa || ai.chuyen_khoa}</strong> cho bệnh nhân này. Gợi ý có phù hợp với chẩn đoán của bác sĩ không?
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
                            disabled={locked || rating === 0 || !ai.phan_tich_ai_id || !onRateAi}
                            onClick={() => onRateAi && onRateAi({ so_sao: rating, nhan_xet: ratingNote })}
                        >
                            Gửi đánh giá
                        </button>
                        {!ai.phan_tich_ai_id && (
                            <span className="text-[11px] text-clinic-warning">
                                Lượt khám này chưa có kết quả AI gắn từ lịch hẹn nên chưa thể ghi đánh giá.
                            </span>
                        )}
                        <span className="text-[11px] text-clinic-text-secondary">Dùng để cải thiện mô hình phân luồng, bệnh nhân không thấy.</span>
                    </div>
                )}

                <div className="medpro-card flex flex-col gap-3 rounded-[6px] bg-clinic-surface-alt p-4 border-clinic-info-border">
                    <h3 className="flex items-center gap-2 text-[12px] font-extrabold text-clinic-navy tabular-nums">
                        <ClinicIcon name="Microscope" size={16} /> Chỉ định cận lâm sàng ({clsOrders.length + (pickedServices?.length || 0)})
                    </h3>

                    {pickedServices.length > 0 && (
                        <div className="rounded-[6px] border border-clinic-warning-border bg-clinic-warning-bg p-3 text-xs text-clinic-warning space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-bold flex items-center gap-1.5 text-clinic-warning tabular-nums">
                                    <ClinicIcon name="Warning" size={14} className="text-clinic-warning" />
                                    Đã chọn {pickedServices.length} chỉ định ở Bước 2 (Chưa gửi):
                                </span>
                            </div>
                            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-clinic-warning font-medium pl-1">
                                {pickedServices.map((s) => (
                                    <li key={s.id} className="truncate">{s.ten_dich_vu}</li>
                                ))}
                            </ul>
                            {!locked && onSendPickedOrders && (
                                <button
                                    type="button"
                                    onClick={onSendPickedOrders}
                                    className="medpro-btn-primary w-full mt-1.5 py-1.5 px-3 rounded-[6px] font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 tabular-nums"
                                >
                                    <ClinicIcon name="PaperPlaneTilt" size={13} weight="bold" />
                                    Gửi {pickedServices.length} chỉ định sang KTV ngay
                                </button>
                            )}
                        </div>
                    )}

                    {clsOrders.length === 0 && pickedServices.length === 0 ? (
                        <div className="text-center py-4 space-y-2">
                            <p className="text-[12px] text-clinic-text-secondary">
                                Ca khám này chưa có chỉ định cận lâm sàng nào.
                            </p>
                            {!locked && onGoToStepOrders && (
                                <button
                                    type="button"
                                    onClick={onGoToStepOrders}
                                    className="text-xs font-semibold text-clinic-cta hover:underline cursor-pointer"
                                >
                                    + Sang Bước 2 để chỉ định CLS
                                </button>
                            )}
                        </div>
                    ) : clsOrders.length > 0 && (
                        <div className="flex flex-col divide-y divide-clinic-border border border-clinic-border rounded-[6px] bg-clinic-surface max-h-80 overflow-y-auto">
                            {clsOrders.map((o) => {
                                const isDone = o.trang_thai === 'da_co_ket_qua' || o.trang_thai === 'da_duyet'
                                const isDoing = o.trang_thai === 'dang_thuc_hien'
                                const resultDetail = o.ket_qua_chi_tiet || o.tri_so_chi_tiet
                                const imageList = (o.tep_dinh_kem_urls && o.tep_dinh_kem_urls.length > 0)
                                    ? o.tep_dinh_kem_urls
                                    : (o.tep_dinh_kem_url ? [o.tep_dinh_kem_url] : [])

                                return (
                                    <div key={o.id} className="flex flex-col gap-1.5 p-2.5 bg-clinic-surface">
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="text-[12px] font-bold text-clinic-navy truncate">
                                                {o.ten_dich_vu || services.find((s) => String(s.id) === String(o.dich_vu_id))?.ten_dich_vu || 'Dịch vụ CLS'}
                                            </span>
                                            <span className={`text-[10px] font-bold shrink-0 ${
                                                isDone ? 'medpro-badge-success' : isDoing ? 'medpro-badge-info' : 'medpro-badge-warning'
                                            }`}>
                                                {isDone ? 'Đã có KQ' : isDoing ? 'Đang làm' : 'Chờ làm'}
                                            </span>
                                        </div>
                                        {isDone && resultDetail && (
                                            <div className="text-[11px] text-clinic-success bg-clinic-success-bg rounded-[6px] p-2 border border-clinic-success-border leading-relaxed font-medium">
                                                {formatResultSummary(resultDetail)}
                                            </div>
                                        )}
                                        {isDone && imageList.length > 0 && (
                                            <ResultAttachments files={imageList} serviceName={o.ten_dich_vu || 'Kết quả cận lâm sàng'} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
