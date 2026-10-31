import { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import { fetchClsWorklistAsync, startOrderAsync, submitOrderResultAsync, submitLabResultAsync } from '../../redux/actions/doctor/clinicalAction'
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
    { key: 'da_chi_dinh', label: 'Chờ làm' },
    { key: 'dang_thuc_hien', label: 'Đang làm' },
    { key: 'da_co_ket_qua', label: 'Có kết quả' },
]

const REFRESH_MS = 30000

const todayIso = () => new Date().toLocaleDateString('en-CA')

const waitLabel = (minutes) => {
    if (!minutes) return 'vừa chỉ định'
    if (minutes < 60) return `chờ ${minutes} phút`
    return `chờ ${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`
}

function ResultForm({ group, order, submitting, onSubmit, onSubmitLab }) {
    if (group === 'XET_NGHIEM') return <IndicatorResultForm order={order} loai="XET_NGHIEM" submitting={submitting} onSubmitLab={onSubmitLab} />
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
    const [tuKhoa, setTuKhoa] = useState('')
    const [ngay, setNgay] = useState(todayIso)
    const [selectedId, setSelectedId] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [starting, setStarting] = useState(false)

    // Gõ xong mới tìm trên server (tên, SĐT, mã bệnh nhân)
    useEffect(() => {
        const timer = setTimeout(() => setTuKhoa(keyword.trim()), 350)
        return () => clearTimeout(timer)
    }, [keyword])

    const load = useCallback(
        (silent = false) => dispatch(fetchClsWorklistAsync({ nhom: group, tuKhoa, ngay, silent })),
        [dispatch, group, tuKhoa, ngay]
    )

    useEffect(() => {
        load()
    }, [load])

    // Tự làm mới: định kỳ và ngay khi bác sĩ gửi chỉ định mới (cùng trình duyệt, khác tab)
    useEffect(() => {
        const timer = setInterval(() => load(true), REFRESH_MS)
        const off = clinicalEventBridge.on(CLINICAL_EVENTS.CLS_ORDERED, () => load(true))
        return () => {
            clearInterval(timer)
            off()
        }
    }, [load])

    const switchGroup = (key) => {
        setSelectedId(null)
        setStatusFilter('ALL')
        setSearchParams({ nhom: key })
    }

    const visible = worklist.filter((o) => statusFilter === 'ALL' || o.trang_thai === statusFilter)
    const selected = worklist.find((o) => o.id === selectedId) || visible.find((o) => o.trang_thai !== 'da_co_ket_qua') || visible[0]

    const handleStart = async () => {
        setStarting(true)
        try {
            await dispatch(startOrderAsync(selected.id)).unwrap()
            AppToast.info('Đã tiếp nhận, chuyển sang Đang làm')
        } catch (msg) {
            AppToast.error(msg)
        } finally {
            setStarting(false)
        }
    }

    const handleSubmit = async (payload, final) => {
        setSubmitting(true)
        try {
            await dispatch(submitOrderResultAsync({ orderId: selected.id, payload })).unwrap()
            setSelectedId(selected.id)
            await load(true)
            AppToast.success(final ? `Đã trả kết quả ${selected.ten_dich_vu}` : 'Đã lưu nháp kết quả')
        } catch (msg) {
            AppToast.error(msg)
        } finally {
            setSubmitting(false)
        }
    }

    // Xét nghiệm: backend tự đánh giá chỉ số và lưu vào ket_qua_cls
    const handleLabSubmit = async (body) => {
        setSubmitting(true)
        try {
            const res = await dispatch(submitLabResultAsync({ orderId: selected.id, body })).unwrap()
            setSelectedId(selected.id)
            await load(true)
            if (body.luu_nhap) AppToast.success('Đã lưu nháp kết quả xét nghiệm')
            else if (res.ket_qua_phan_loai === 'NGUY_KICH') AppToast.warning(`Đã trả kết quả ${selected.ten_dich_vu} — có chỉ số nguy hiểm`)
            else AppToast.success(`Đã trả kết quả ${selected.ten_dich_vu}`)
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
                        placeholder="Tên, SĐT hoặc mã bệnh nhân"
                        aria-label="Tìm chỉ định"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                    />
                    <label className="flex items-center gap-2 text-[12px] text-slate-500">
                        Ngày chỉ định
                        <input
                            type="date"
                            className="medpro-input flex-1"
                            aria-label="Ngày chỉ định"
                            value={ngay}
                            max={todayIso()}
                            onChange={(e) => setNgay(e.target.value || todayIso())}
                        />
                    </label>
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
                    {worklistError && <ErrorBlock message={worklistError} onRetry={() => load()} />}
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
                                    {o.chan_doan_so_bo && (
                                        <span className="text-[12px] text-slate-600">Chẩn đoán sơ bộ: {o.chan_doan_so_bo}</span>
                                    )}
                                    <span className="text-[12px] text-slate-500">
                                        {o.bac_si_chi_dinh} chỉ định {formatDateTime(o.thoi_gian_chi_dinh)}
                                        {o.trang_thai === 'da_chi_dinh' && ` · ${waitLabel(o.thoi_gian_cho_phut)}`}
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
                                    <span className="text-[13px]">
                                        Chẩn đoán sơ bộ: <strong className="font-medium">{selected.chan_doan_so_bo || '—'}</strong>
                                    </span>
                                </div>
                                {selected.benh_nhan?.di_ung_thuoc && (
                                    <span className="medpro-badge-danger">
                                        <ClinicIcon name="Warning" size={13} weight="bold" /> {selected.benh_nhan.di_ung_thuoc}
                                    </span>
                                )}
                                {selected.trang_thai === 'da_chi_dinh' && (
                                    <button type="button" className="medpro-btn-amber" onClick={handleStart} disabled={starting}>
                                        {starting ? 'Đang tiếp nhận…' : 'Tiếp nhận & bắt đầu'}
                                    </button>
                                )}
                            </div>
                            <div className="p-5">
                                <ResultForm
                                    key={selected.id}
                                    group={group}
                                    order={selected}
                                    submitting={submitting}
                                    onSubmit={handleSubmit}
                                    onSubmitLab={handleLabSubmit}
                                />
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    )
}
