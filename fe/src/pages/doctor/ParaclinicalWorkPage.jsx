import { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import { fetchClsWorklistAsync, startOrderAsync, submitOrderResultAsync } from '../../redux/actions/doctor/clinicalAction'
import { SERVICE_GROUPS, ORDER_STATUS } from '../../utils/constants/clinical'
import { formatDateTime } from '../../utils/helpers/formatDate'
import { AppToast } from '../../components/common/AppNotification'
import { ClinicIcon } from '../../components/common/ClinicIcon'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../../components/doctor/clinical/StateBlocks'
import IndicatorResultForm from '../../components/doctor/cls/IndicatorResultForm'
import ImagingResultForm from '../../components/doctor/cls/ImagingResultForm'
import EndoscopyResultForm from '../../components/doctor/cls/EndoscopyResultForm'
import { clinicalEventBridge, CLINICAL_EVENTS } from '../../services/clinicalEventBridge'

const STATUS_FILTERS = [
    { key: 'ALL', label: 'Tất cả' },
    { key: 'CHO_THUC_HIEN', label: 'Chờ thực hiện' },
    { key: 'dang_thuc_hien', label: 'Đang làm' },
    { key: 'da_co_ket_qua', label: 'Có kết quả' },
]

function ResultForm({ group, order, submitting, onSubmit }) {
    if (group === 'XET_NGHIEM') return <IndicatorResultForm order={order} loai="XET_NGHIEM" submitting={submitting} onSubmit={onSubmit} />
    if (group === 'TDCN') return <IndicatorResultForm order={order} loai="TDCN" submitting={submitting} onSubmit={onSubmit} />
    if (group === 'CDHA') return <ImagingResultForm order={order} submitting={submitting} onSubmit={onSubmit} />
    return <EndoscopyResultForm order={order} submitting={submitting} onSubmit={onSubmit} />
}

export default function ParaclinicalWorkPage() {
    const dispatch = useDispatch()
    const [searchParams, setSearchParams] = useSearchParams()
    const group = SERVICE_GROUPS.some((g) => g.key === searchParams.get('nhom')) ? searchParams.get('nhom') : 'XET_NGHIEM'
    const { worklist, worklistLoading, worklistError } = useSelector((state) => state.doctor.clinical)
    const authRole = useSelector((state) => state.app.auth.role)
    const effectiveRole = authRole || ''
    const isLabTech = effectiveRole === 'KTV_XET_NGHIEM' || effectiveRole === 'LAB_TECH' || effectiveRole === 'ROLE-LAB-TECH'

    const [statusFilter, setStatusFilter] = useState('ALL')
    const [keyword, setKeyword] = useState('')
    const [selectedId, setSelectedId] = useState(null)
    const [submitting, setSubmitting] = useState(false)

    const load = useCallback(() => dispatch(fetchClsWorklistAsync(group)), [dispatch, group])

    useEffect(() => {
        load()
    }, [load])

    const switchGroup = (key) => {
        setSelectedId(null)
        setStatusFilter('ALL')
        setSearchParams({ nhom: key })
    }

    const q = keyword.trim().toLowerCase()
    const visible = worklist.filter((o) => {
        const matchesStatus =
            statusFilter === 'ALL' ||
            o.trang_thai === statusFilter ||
            (statusFilter === 'CHO_THUC_HIEN' && o.trang_thai === 'da_chi_dinh') ||
            (statusFilter === 'da_chi_dinh' && o.trang_thai === 'CHO_THUC_HIEN')
        const matchesQuery =
            !q || o.benh_nhan?.ho_ten.toLowerCase().includes(q) || o.ten_dich_vu.toLowerCase().includes(q)
        return matchesStatus && matchesQuery
    })
    const selected = worklist.find((o) => o.id === selectedId) || visible.find((o) => o.trang_thai !== 'da_co_ket_qua') || visible[0]

    const handleStart = async () => {
        try {
            await dispatch(startOrderAsync(selected.id)).unwrap()
            AppToast.info('Đã chuyển sang Đang làm')
        } catch (msg) {
            AppToast.error(msg)
        }
    }

    const handleSubmit = async (payload, final) => {
        setSubmitting(true)
        try {
            await dispatch(submitOrderResultAsync({ orderId: selected.id, payload })).unwrap()
            AppToast.success(final ? `Đã trả kết quả ${selected.ten_dich_vu}` : 'Đã lưu nháp kết quả')
        } catch (msg) {
            AppToast.error(msg)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col gap-5">
            <div className="medpro-card flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-[220px] flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-[20px] font-bold text-[#003553]">
                            {isLabTech ? "🔬 Bàn Làm Việc Xét Nghiệm (LIS)" : "Cận lâm sàng"}
                        </h1>
                        {isLabTech && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                Vai trò: KTV Xét nghiệm
                            </span>
                        )}
                    </div>
                    <p className="text-[12px] text-slate-500">
                        {isLabTech
                            ? "Khoa Xét nghiệm (Huyết học, Sinh hóa, Nước tiểu, Miễn dịch) · Tiếp nhận mẫu & trả kết quả LIS."
                            : "Nhập và trả kết quả cho các chỉ định trong ngày."}
                    </p>
                </div>
                <div role="tablist" aria-label="Loại cận lâm sàng" className="flex flex-wrap gap-1 rounded-3xl bg-[#E8F4FD] p-1">
                    {SERVICE_GROUPS.map((g) => (
                        <button
                            key={g.key}
                            type="button"
                            role="tab"
                            aria-selected={g.key === group}
                            onClick={() => switchGroup(g.key)}
                            className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition cursor-pointer ${
                                g.key === group ? 'bg-[#003553] text-white' : 'text-[#003553] hover:bg-white'
                            }`}
                        >
                            <ClinicIcon name={g.icon} size={16} />
                            {g.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap items-start gap-5">
                <aside aria-label="Danh sách chỉ định" className="medpro-card flex w-full flex-col gap-3 p-4 lg:w-[340px] lg:shrink-0">
                    <input
                        type="search"
                        className="medpro-input"
                        placeholder="Tên bệnh nhân hoặc dịch vụ"
                        aria-label="Tìm chỉ định"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-1.5">
                        {STATUS_FILTERS.map((f) => {
                            const n = f.key === 'ALL' ? worklist.length : worklist.filter((o) => o.trang_thai === f.key).length
                            return (
                                <button
                                    key={f.key}
                                    type="button"
                                    aria-pressed={statusFilter === f.key}
                                    onClick={() => setStatusFilter(f.key)}
                                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition cursor-pointer ${
                                        statusFilter === f.key ? 'bg-[#003553] text-white' : 'bg-[#E8F4FD] text-[#003553]'
                                    }`}
                                >
                                    {f.label} {n}
                                </button>
                            )
                        })}
                    </div>

                    {worklistLoading && <LoadingBlock />}
                    {worklistError && <ErrorBlock message={worklistError} onRetry={load} />}
                    {!worklistLoading && !worklistError && visible.length === 0 && (
                        <EmptyBlock icon="ListChecks" title="Không có chỉ định" hint="Thử đổi bộ lọc trạng thái hoặc loại cận lâm sàng." />
                    )}

                    {!worklistLoading &&
                        visible.map((o) => {
                            const st = ORDER_STATUS[o.trang_thai]
                            const isSel = selected?.id === o.id
                            return (
                                <button
                                    key={o.id}
                                    type="button"
                                    onClick={() => setSelectedId(o.id)}
                                    className={`flex flex-col gap-1.5 rounded-xl p-3 text-left transition cursor-pointer ${
                                        isSel ? 'bg-[#E8F4FD] ring-2 ring-[#00B5F1]' : 'bg-[#F5F9FC] hover:bg-[#EEF6FC]'
                                    }`}
                                >
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="font-semibold text-[#003553]">
                                            {o.benh_nhan?.ho_ten}{' '}
                                            <span className="font-normal text-slate-500">
                                                · {o.benh_nhan?.gioi_tinh} {o.benh_nhan?.tuoi}t
                                            </span>
                                        </span>
                                        <span className={st.badge}>{st.label}</span>
                                    </span>
                                    <span className="text-[13px]">{o.ten_dich_vu}</span>
                                    <span className="text-[12px] text-slate-500">
                                        {o.bac_si_chi_dinh} chỉ định {formatDateTime(o.thoi_gian_chi_dinh)}
                                    </span>
                                </button>
                            )
                        })}
                </aside>

                <section aria-label="Nhập kết quả" className="medpro-card flex min-w-0 flex-[999_1_560px] flex-col overflow-hidden">
                    {!selected ? (
                        <EmptyBlock icon="Microscope" title="Chọn một chỉ định để nhập kết quả" />
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center gap-3 bg-[#F5F9FC] px-5 py-4">
                                <div className="flex min-w-[260px] flex-1 flex-col gap-1">
                                    <div className="flex flex-wrap items-baseline gap-x-3">
                                        <h2 className="text-[19px] font-bold text-[#003553]">{selected.benh_nhan?.ho_ten}</h2>
                                        <span className="text-[13px] text-slate-500">
                                            {selected.benh_nhan?.gioi_tinh} · {selected.benh_nhan?.tuoi} tuổi · {selected.benh_nhan?.ma}
                                        </span>
                                    </div>
                                    <span className="text-[13px]">
                                        Lý do khám: <strong className="font-medium">{selected.ly_do || '—'}</strong> · {selected.bac_si_chi_dinh} chỉ định
                                    </span>
                                </div>
                                {selected.benh_nhan?.di_ung_thuoc && (
                                    <span className="medpro-badge-danger">
                                        <ClinicIcon name="Warning" size={13} weight="bold" /> {selected.benh_nhan.di_ung_thuoc}
                                    </span>
                                )}
                                {(selected.trang_thai === 'CHO_THUC_HIEN' || selected.trang_thai === 'da_chi_dinh') && (
                                    <button type="button" className="medpro-btn-amber" onClick={handleStart}>
                                        Bắt đầu thực hiện
                                    </button>
                                )}
                            </div>
                            <div className="p-5">
                                <ResultForm key={selected.id} group={group} order={selected} submitting={submitting} onSubmit={handleSubmit} />
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    )
}
