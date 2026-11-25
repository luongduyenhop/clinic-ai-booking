import { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import { fetchClsWorklistAsync, startOrderAsync, submitOrderResultAsync, submitLabResultAsync, approveOrderAsync } from '../../redux/actions/doctor/clinicalAction'
import { SERVICE_GROUPS, ORDER_STATUS, clsDisplayStatus, isOrderNotStarted } from '../../utils/constants/clinical'
import { formatDateTime } from '../../utils/helpers/formatDate'
import { AppToast } from '../../components/common/AppNotification'
import { ClinicIcon } from '../../components/common/ClinicIcon'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../../components/doctor/clinical/StateBlocks'
import IndicatorResultForm from '../../components/doctor/cls/IndicatorResultForm'
import ImagingResultForm from '../../components/doctor/cls/ImagingResultForm'
import EndoscopyResultForm from '../../components/doctor/cls/EndoscopyResultForm'
import ClsApprovalBar from '../../components/doctor/cls/ClsApprovalBar'
import { clinicalEventBridge, CLINICAL_EVENTS } from '../../services/clinicalEventBridge'

const STATUS_FILTERS = [
    { key: 'ALL', label: 'Tất cả' },
    { key: 'da_chi_dinh', label: 'Chờ làm' },
    { key: 'dang_thuc_hien', label: 'Đang làm' },
    { key: 'cho_duyet', label: 'Chờ duyệt' },
    { key: 'da_co_ket_qua', label: 'Có kết quả' },
]

const APPROVAL_GROUPS = ['XET_NGHIEM', 'CDHA', 'TDCN', 'NOI_SOI']

const REFRESH_MS = 3000

const todayIso = () => new Date().toLocaleDateString('en-CA')

const displayStatus = (order) => (String(order?.trang_thai || '').toLowerCase() === 'hoan_thanh' ? 'da_co_ket_qua' : clsDisplayStatus(order))

const isPendingWork = (order) => ['da_chi_dinh', 'dang_thuc_hien'].includes(displayStatus(order))

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
    const [tatCaNgay, setTatCaNgay] = useState(true)
    const [ngay, setNgay] = useState(todayIso)
    const [selectedId, setSelectedId] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [starting, setStarting] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setTuKhoa(keyword.trim()), 350)
        return () => clearTimeout(timer)
    }, [keyword])

    const load = useCallback(
        (silent = false) => dispatch(fetchClsWorklistAsync({ tuKhoa, ngay: tatCaNgay ? null : ngay, tatCaNgay, silent })),
        [dispatch, tuKhoa, ngay, tatCaNgay]
    )

    useEffect(() => {
        load()
    }, [load])

    useEffect(() => {
        const timer = setInterval(() => load(true), REFRESH_MS)
        const offOrder = clinicalEventBridge.on(CLINICAL_EVENTS.CLS_ORDERED, () => load(true))
        const offResult = clinicalEventBridge.on(CLINICAL_EVENTS.CLS_RESULT_RETURNED, () => load(true))
        const handleFocus = () => load(true)
        window.addEventListener('focus', handleFocus)
        return () => {
            clearInterval(timer)
            offOrder()
            offResult()
            window.removeEventListener('focus', handleFocus)
        }
    }, [load])

    const switchGroup = (key) => {
        setSelectedId(null)
        setStatusFilter('ALL')
        setSearchParams({ nhom: key })
    }

    const groupOrders = worklist.filter(
        (o) => String(o.nhom_dich_vu || '').toUpperCase() === String(group || '').toUpperCase()
    )
    const visible = groupOrders.filter((o) => statusFilter === 'ALL' || displayStatus(o) === statusFilter)
    const selected = visible.find((o) => o.id === selectedId) || visible.find((o) => displayStatus(o) !== 'da_co_ket_qua') || visible[0]

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
            if (isOrderNotStarted(selected)) {
                await dispatch(startOrderAsync(selected.id)).unwrap()
            }
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

    const handleLabSubmit = async (body) => {
        setSubmitting(true)
        try {
            if (isOrderNotStarted(selected)) {
                await dispatch(startOrderAsync(selected.id)).unwrap()
            }
            const res = await dispatch(submitLabResultAsync({ orderId: selected.id, body })).unwrap()
            let autoApproved = false
            if (!body.luu_nhap) {
                try {
                    await dispatch(approveOrderAsync(selected.id)).unwrap()
                    autoApproved = true
                } catch {}
            }
            setSelectedId(selected.id)
            await load(true)
            if (body.luu_nhap) AppToast.success('Đã lưu nháp kết quả xét nghiệm')
            else if (res.ket_qua_phan_loai === 'NGUY_KICH') AppToast.warning(`Đã hoàn tất ${selected.ten_dich_vu} — có chỉ số nguy hiểm${autoApproved ? ', đã trả cho bác sĩ' : ', kiểm tra kỹ trước khi duyệt'}`)
            else if (autoApproved) AppToast.success(`Đã hoàn tất & trả kết quả ${selected.ten_dich_vu} cho bác sĩ`)
            else AppToast.success(`Đã hoàn tất kết quả ${selected.ten_dich_vu} — chờ duyệt & trả`)
        } catch (msg) {
            AppToast.error(msg)
        } finally {
            setSubmitting(false)
        }
    }

    const pendingTotalCount = worklist.filter(
        (o) =>
            o.trang_thai === 'da_chi_dinh' ||
            o.trang_thai === 'CHO_THUC_HIEN' ||
            o.trang_thai === 'dang_thuc_hien'
    ).length

    return (
        <div className="flex flex-col gap-4">
            <div className="medpro-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm lg:text-base font-extrabold text-clinic-navy font-display">
                            Điều phối &amp; Trả kết quả Cận lâm sàng (LIS / PACS)
                        </h2>
                        <span className="medpro-badge-info tabular-nums">
                            {pendingTotalCount} chờ thực hiện
                        </span>
                        {isLabTech && (
                            <span className="medpro-badge-neutral">
                                KTV Xét nghiệm
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-clinic-text-secondary mt-0.5">
                        {isLabTech
                            ? 'Khoa Xét nghiệm (Huyết học, Sinh hóa, Nước tiểu, Miễn dịch) · Tiếp nhận mẫu & trả kết quả LIS.'
                            : 'Tiếp nhận chỉ định trong ca trực, nhập chỉ số kết quả và ký duyệt trả về Bàn khám.'}
                    </p>
                </div>
                <div role="tablist" aria-label="Loại cận lâm sàng" className="flex flex-wrap gap-1 rounded-[6px] border border-clinic-border bg-clinic-bg-muted p-1">
                    {SERVICE_GROUPS.map((g) => {
                        const count = worklist.filter(
                            (o) => String(o.nhom_dich_vu || '').toUpperCase() === String(g.key || '').toUpperCase() && isPendingWork(o)
                        ).length
                        return (
                            <button
                                key={g.key}
                                type="button"
                                role="tab"
                                aria-selected={g.key === group}
                                onClick={() => switchGroup(g.key)}
                                className={`flex items-center gap-2 rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                                    g.key === group ? 'bg-clinic-navy text-clinic-surface' : 'text-clinic-text-secondary hover:text-clinic-navy'
                                }`}
                            >
                                <ClinicIcon name={g.icon} size={15} />
                                <span>{g.label}</span>
                                {count > 0 && (
                                    <span
                                        className={`inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 text-[11px] font-bold rounded-[4px] tabular-nums ${
                                            g.key === group
                                                ? 'bg-clinic-cta text-clinic-surface'
                                                : 'bg-clinic-danger-bg text-clinic-danger border border-clinic-danger-border'
                                        }`}
                                    >
                                        {count}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="flex flex-wrap items-start gap-4">
                <aside aria-label="Danh sách chỉ định" className="medpro-card flex w-full flex-col gap-3 p-4 lg:w-[340px] lg:shrink-0">
                    <input
                        type="search"
                        className="medpro-input"
                        placeholder="Tên, SĐT hoặc mã bệnh nhân"
                        aria-label="Tìm chỉ định"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                    />
                    <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-clinic-text-secondary">Phạm vi ngày</span>
                        <div className="flex rounded-[6px] bg-clinic-bg-muted border border-clinic-border p-0.5">
                            <button
                                type="button"
                                onClick={() => setTatCaNgay(true)}
                                className={`px-2.5 py-1 rounded-[4px] text-[11px] font-bold transition-colors cursor-pointer ${
                                    tatCaNgay ? 'bg-clinic-surface text-clinic-navy border border-clinic-border' : 'text-clinic-text-muted hover:text-clinic-navy'
                                }`}
                            >
                                Tất cả ngày
                            </button>
                            <button
                                type="button"
                                onClick={() => setTatCaNgay(false)}
                                className={`px-2.5 py-1 rounded-[4px] text-[11px] font-bold transition-colors cursor-pointer ${
                                    !tatCaNgay ? 'bg-clinic-surface text-clinic-navy border border-clinic-border' : 'text-clinic-text-muted hover:text-clinic-navy'
                                }`}
                            >
                                Theo ngày
                            </button>
                        </div>
                    </div>
                    {!tatCaNgay && (
                        <label htmlFor="cls-worklist-date" className="flex items-center gap-2 text-xs text-clinic-text-secondary">
                            Ngày chỉ định
                            <input
                                id="cls-worklist-date"
                                type="date"
                                className="medpro-input flex-1 tabular-nums"
                                aria-label="Ngày chỉ định"
                                value={ngay}
                                max={todayIso()}
                                onChange={(e) => setNgay(e.target.value || todayIso())}
                            />
                        </label>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                        {STATUS_FILTERS.map((f) => {
                            const n = f.key === 'ALL' ? groupOrders.length : groupOrders.filter((o) => displayStatus(o) === f.key).length
                            return (
                                <button
                                    key={f.key}
                                    type="button"
                                    aria-pressed={statusFilter === f.key}
                                    onClick={() => setStatusFilter(f.key)}
                                    className={`rounded-[6px] px-2.5 py-1.5 text-xs font-semibold tabular-nums transition-colors cursor-pointer border ${
                                        statusFilter === f.key
                                            ? 'bg-clinic-navy text-clinic-surface border-clinic-navy'
                                            : 'bg-clinic-bg text-clinic-navy border-clinic-border hover:bg-clinic-surface-alt'
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
                            const st = ORDER_STATUS[displayStatus(o)] || ORDER_STATUS[o.trang_thai] || { label: o.trang_thai || 'Chờ làm', badge: 'medpro-badge' }
                            const isSel = selected?.id === o.id
                            return (
                                <button
                                    key={o.id}
                                    type="button"
                                    onClick={() => setSelectedId(o.id)}
                                    className={`flex flex-col gap-1.5 rounded-[6px] border p-3 text-left transition-colors cursor-pointer ${
                                        isSel
                                            ? 'border-clinic-cta bg-clinic-surface-alt'
                                            : 'border-clinic-border bg-clinic-surface hover:bg-clinic-surface-tint hover:border-clinic-border-strong'
                                    }`}
                                >
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="font-semibold text-clinic-navy">
                                            {o.benh_nhan?.ho_ten}{' '}
                                            <span className="font-normal text-clinic-text-secondary tabular-nums">
                                                · {o.benh_nhan?.gioi_tinh} {o.benh_nhan?.tuoi}t
                                            </span>
                                        </span>
                                        <span className={st.badge}>{st.label}</span>
                                    </span>
                                    <span className="text-[13px] text-clinic-text">{o.ten_dich_vu}</span>
                                    {o.chan_doan_so_bo && (
                                        <span className="text-xs text-clinic-text-secondary">Chẩn đoán sơ bộ: {o.chan_doan_so_bo}</span>
                                    )}
                                    <span className="text-xs text-clinic-text-muted tabular-nums">
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
                            <div className="flex flex-wrap items-center gap-3 bg-clinic-surface-tint border-b border-clinic-border px-5 py-4">
                                <div className="flex min-w-[260px] flex-1 flex-col gap-1">
                                    <div className="flex flex-wrap items-baseline gap-x-3">
                                        <h2 className="text-[19px] font-bold text-clinic-navy">{selected.benh_nhan?.ho_ten}</h2>
                                        <span className="text-[13px] text-clinic-text-secondary tabular-nums">
                                            {selected.benh_nhan?.gioi_tinh} · {selected.benh_nhan?.tuoi} tuổi · {selected.benh_nhan?.ma}
                                        </span>
                                    </div>
                                    <span className="text-[13px] text-clinic-text">
                                        Lý do khám: <strong className="font-medium">{selected.ly_do || '—'}</strong> · {selected.bac_si_chi_dinh} chỉ định
                                    </span>
                                    <span className="text-[13px] text-clinic-text">
                                        Chẩn đoán sơ bộ: <strong className="font-medium">{selected.chan_doan_so_bo || '—'}</strong>
                                    </span>
                                </div>
                                {selected.benh_nhan?.di_ung_thuoc && (
                                    <span className="medpro-badge-danger">
                                        <ClinicIcon name="Warning" size={13} weight="bold" /> {selected.benh_nhan.di_ung_thuoc}
                                    </span>
                                )}
                                {isOrderNotStarted(selected) && (
                                    <button type="button" className="medpro-btn-amber" onClick={handleStart} disabled={starting}>
                                        {starting ? 'Đang tiếp nhận…' : 'Tiếp nhận & bắt đầu'}
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-col gap-4 p-5">
                                {APPROVAL_GROUPS.includes(group) && <ClsApprovalBar order={selected} />}
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
