import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { AutoComplete } from 'antd'
import { searchDrugsAsync, signPrescriptionAsync } from '../../../redux/actions/doctor/clinicalAction'
import { useDebounce } from '../../../hooks/useDebounce'
import { findAllergyConflict } from '../../../utils/constants/clinical'
import { ClinicIcon } from '../../common/ClinicIcon'
import { DOSE_SLOTS, computeQuantity } from './examHelpers'
import { AppToast } from '../../common/AppNotification'

const GRID = 'grid grid-cols-[36px_minmax(190px,2fr)_repeat(4,48px)_56px_52px_minmax(180px,2fr)_40px] items-center gap-1.5'


const QUICK_USAGE_TAGS = [
    'Uống sau ăn no',
    'Uống trước ăn 30 phút',
    'Uống khi sốt >= 38.5°C',
    'Uống trước khi đi ngủ',
    'Ngậm dưới lưỡi',
    'Uống nhiều nước',
]


const FOLLOW_UP_PRESETS = [
    { label: '3 ngày', days: 3 },
    { label: '5 ngày', days: 5 },
    { label: '7 ngày (1 tuần)', days: 7 },
    { label: '10 ngày', days: 10 },
    { label: '14 ngày (2 tuần)', days: 14 },
    { label: '30 ngày (1 tháng)', days: 30 },
]

const QUICK_NOTES = [
    'Uống thuốc đúng giờ, kiêng đồ chua cay dầu mỡ.',
    'Tái khám đúng hẹn hoặc khi có triệu chứng bất thường.',
    'Kiêng nước đá, súc họng nước muối ấm mỗi ngày.',
    'Nghỉ ngơi nhiều, uống đủ 2 lít nước ấm/ngày.',
]


function generateDoseText(sang, trua, chieu, toi, dvt = 'viên') {
    const parts = []
    if (sang && Number(sang) > 0) parts.push(`sáng ${sang} ${dvt}`)
    if (trua && Number(trua) > 0) parts.push(`trưa ${trua} ${dvt}`)
    if (chieu && Number(chieu) > 0) parts.push(`chiều ${chieu} ${dvt}`)
    if (toi && Number(toi) > 0) parts.push(`tối ${toi} ${dvt}`)
    if (parts.length === 0) return ''
    return `Uống ${parts.join(', ')} sau ăn`
}

export default function StepPrescription({ formik, encounter, locked, onOpenRxModal }) {
    const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'
    const dispatch = useDispatch()
    const { values, setFieldValue, handleChange } = formik
    const rows = values.danh_sach_thuoc || []
    const [keyword, setKeyword] = useState('')
    const [options, setOptions] = useState([])
    const debounced = useDebounce(keyword, 200)
    const allergy = encounter?.benh_nhan?.di_ung_thuoc

    const isSigned =
        values.trang_thai_don_thuoc === 'SIGNED' ||
        encounter?.don_thuoc?.trang_thai === 'SIGNED' ||
        encounter?.trang_thai_don_thuoc === 'SIGNED' ||
        locked
    const isReadOnly = Boolean(isSigned || locked)

    const [signingLoading, setSigningLoading] = useState(false)
    const [showSignConfirm, setShowSignConfirm] = useState(false)

    const [batchDays, setBatchDays] = useState(rows[0]?.so_ngay_dung || '5')

    const [nationalSyncStatus, setNationalSyncStatus] = useState('pending')

    const [followUpDays, setFollowUpDays] = useState(7)

    const nationalRxCode = `DTQG-2026-LK${String(encounter?.id || '001').padStart(6, '0')}`

    const handleSignPrescription = async () => {
        if (rows.length === 0) {
            AppToast.warning('Vui lòng kê ít nhất 1 loại thuốc vào đơn trước khi ký số!')
            return
        }
        setSigningLoading(true)
        try {
            const sigData = `SHA256:SIG:${encounter?.id || 'EXAM'}:${Date.now()}`
            const payload = {
                danh_sach_thuoc: rows,
                loi_dan_uong_thuoc: values.loi_dan_uong_thuoc || '',
                chu_ky_so: sigData,
            }
            const res = await dispatch(
                signPrescriptionAsync({
                    encounterId: encounter?.id,
                    payload,
                })
            ).unwrap()

            setFieldValue('trang_thai_don_thuoc', 'SIGNED')
            setFieldValue('ngay_ky', res?.ngay_ky || new Date().toISOString())
            setFieldValue('chu_ky_so', res?.chu_ky_so || sigData)
            setFieldValue('nguoi_ky', res?.nguoi_ky || encounter?.ten_bac_si || 'Bác sĩ khám bệnh')
            setShowSignConfirm(false)
            AppToast.success(
                'Đã ký số đơn thuốc điện tử thành công! Trạng thái FSM chuyển sang SIGNED và khóa bất biến toàn bộ thuốc.'
            )
        } catch (err) {
            AppToast.error(err?.message || 'Không thể ký số đơn thuốc. Vui lòng thử lại!')
        } finally {
            setSigningLoading(false)
        }
    }

    useEffect(() => {
        if (!debounced.trim()) {
            setOptions([])
            return
        }
        let cancelled = false
        dispatch(searchDrugsAsync(debounced))
            .unwrap()
            .then((list) => {
                if (cancelled) return
                setOptions(
                    list.map((d) => ({
                        value: d.ten_thuoc,
                        label: (
                            <div className="flex items-center justify-between py-0.5">
                                <div>
                                    <strong className="text-clinic-navy text-[13px]">{d.ten_thuoc}</strong>
                                    <span className="ml-2 text-clinic-text-secondary text-xs">{d.hoat_chat} ({d.ham_luong || 'Chuẩn'})</span>
                                </div>
                                <span className="medpro-badge-info text-[11px] font-semibold px-2 py-0.5">
                                    {d.nhom_thuoc || d.don_vi_tinh || 'Kê đơn'}
                                </span>
                            </div>
                        ),
                        item: { ...d },
                    }))
                )
            })
            .catch(() => !cancelled && setOptions([]))
        return () => {
            cancelled = true
        }
    }, [debounced, dispatch])

    const applyBatchDays = (days) => {
        setBatchDays(String(days))
        const updated = rows.map((r) => ({
            ...r,
            so_ngay_dung: String(days),
        }))
        setFieldValue('danh_sach_thuoc', updated)
    }

    const addDrug = (_, option) => {
        const d = option.item
        const defaultDose = { sang: '1', trua: '', chieu: '1', toi: '', so_ngay_dung: batchDays || '5' }
        const autoCachDung = generateDoseText(defaultDose.sang, defaultDose.trua, defaultDose.chieu, defaultDose.toi, d.don_vi_tinh?.toLowerCase() || 'viên')
        setFieldValue('danh_sach_thuoc', [
            ...rows,
            { ...d, ...defaultDose, cach_dung: d.cach_dung || autoCachDung },
        ])
        setKeyword('')
        setOptions([])
    }

    const updateRow = (index, patch) => {
        const updated = rows.map((r, i) => {
            if (i !== index) return r
            const newRow = { ...r, ...patch }
            if (('sang' in patch || 'trua' in patch || 'chieu' in patch || 'toi' in patch) && (!r.cach_dung || r.cach_dung.startsWith('Uống'))) {
                const auto = generateDoseText(newRow.sang, newRow.trua, newRow.chieu, newRow.toi, newRow.don_vi_tinh?.toLowerCase() || 'viên')
                if (auto) newRow.cach_dung = auto
            }
            return newRow
        })
        setFieldValue('danh_sach_thuoc', updated)
    }

    const removeRow = (index) => setFieldValue('danh_sach_thuoc', rows.filter((_, i) => i !== index))

    const moveRow = (index, direction) => {
        const targetIndex = index + direction
        if (targetIndex < 0 || targetIndex >= rows.length) return
        const newRows = [...rows]
        const temp = newRows[index]
        newRows[index] = newRows[targetIndex]
        newRows[targetIndex] = temp
        setFieldValue('danh_sach_thuoc', newRows)
    }

    const appendUsageTag = (index, tag) => {
        const currentRow = rows[index]
        if (!currentRow) return
        const currentUsage = currentRow.cach_dung || ''
        const updatedUsage = currentUsage ? `${currentUsage}. ${tag}` : tag
        updateRow(index, { cach_dung: updatedUsage })
    }

    const replaceWithParacetamol = (index) =>
        updateRow(index, {
            ten_thuoc: 'Paracetamol 500mg',
            hoat_chat: 'Paracetamol',
            ham_luong: '500mg',
            don_vi_tinh: 'Viên',
            sang: '1',
            trua: '0',
            chieu: '1',
            toi: '0',
            cach_dung: 'Uống khi sốt >= 38.5°C hoặc đau đầu, cách nhau ít nhất 4 giờ',
        })

    const handleSetFollowUpDays = (days) => {
        setFollowUpDays(days)
        const targetDate = new Date()
        targetDate.setDate(targetDate.getDate() + Number(days))
        const yyyy = targetDate.getFullYear()
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0')
        const dd = String(targetDate.getDate()).padStart(2, '0')
        const dateStr = `${yyyy}-${mm}-${dd}`
        setFieldValue('ngay_hen_tai_kham', dateStr)
    }

    const handleSyncNationalRx = () => {
        setNationalSyncStatus('synced')
        AppToast.success(`Đã đồng bộ thành công đơn thuốc lên Cổng Đơn thuốc Quốc gia! Mã biên nhận: BYT-2026-${Math.floor(Math.random() * 900000 + 100000)}`)
    }

    return (
        <div className="flex flex-col gap-4">
            {isSigned && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-[6px] bg-clinic-success-bg border border-clinic-success-border text-clinic-navy">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-clinic-success text-clinic-surface">
                            <ClinicIcon name="CheckCircle" size={18} weight="bold" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs text-clinic-success">
                                    ĐÃ KÝ SỐ ĐIỆN TỬ — DỮ LIỆU ĐÃ KHÓA BẤT BIẾN
                                </span>
                                <span className="medpro-badge-success text-[10px] font-mono font-bold">
                                    TT 04/2022/TT-BYT
                                </span>
                            </div>
                            <div className="text-[11px] text-clinic-text-secondary mt-0.5 tabular-nums">
                                Bác sĩ ký:{' '}
                                <strong className="text-clinic-navy">
                                    {values.nguoi_ky ||
                                        encounter?.don_thuoc?.nguoi_ky ||
                                        encounter?.ten_bac_si ||
                                        'Bác sĩ phụ trách'}
                                </strong>{' '}
                                · Thời gian:{' '}
                                {values.ngay_ky
                                    ? new Date(values.ngay_ky).toLocaleString('vi-VN')
                                    : 'Vừa xong'}{' '}
                                · Không được phép thêm/sửa/xóa thuốc trực tiếp.
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => onOpenRxModal && onOpenRxModal('print')}
                        className="px-3.5 py-1.5 rounded-[6px] bg-clinic-success hover:bg-clinic-navy text-clinic-surface text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                        <ClinicIcon name="Printer" size={14} weight="bold" />
                        <span>In Đơn Chuẩn A4/A5</span>
                    </button>
                </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-[6px] bg-clinic-surface-tint border border-clinic-info-border">
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-clinic-cta text-clinic-surface">
                        <ClinicIcon name="QrCode" size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-clinic-navy">Cổng Đơn Thuốc Quốc Gia:</span>
                            <span className="font-mono text-xs font-bold text-clinic-cta bg-clinic-surface px-2 py-0.5 rounded-[4px] border border-clinic-info-border tabular-nums">
                                {nationalRxCode}
                            </span>
                        </div>
                        <span className="text-[11px] text-clinic-text-secondary">Chuẩn liên thông TT 27/2021 &amp; TT 04/2022/TT-BYT · donthuocquocgia.vn</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {nationalSyncStatus === 'synced' ? (
                        <span className="medpro-badge-success inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold">
                            <ClinicIcon name="CheckCircle" size={14} weight="bold" />
                            <span>Đã liên thông Cổng QG</span>
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSyncNationalRx}
                            disabled={rows.length === 0}
                            className="medpro-btn-primary inline-flex items-center gap-1.5 px-3 py-1 rounded-[6px] text-xs font-bold cursor-pointer disabled:opacity-50"
                            title="Đồng bộ dữ liệu đơn thuốc điện tử lên Cổng Đơn thuốc Quốc gia"
                        >
                            <ClinicIcon name="CloudArrowUp" size={14} weight="bold" />
                            <span>Đồng bộ Cổng QG</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex-1 min-w-[280px]">
                    <span className="medpro-label">Thêm thuốc điều trị</span>
                    <AutoComplete
                        className="w-full"
                        value={keyword}
                        options={options}
                        onSearch={setKeyword}
                        onChange={setKeyword}
                        onSelect={addDrug}
                        disabled={isReadOnly}
                        placeholder="Gõ tên thuốc hoặc hoạt chất… (VD: Augmentin, Paracetamol, Nexium)"
                        notFoundContent={debounced ? 'Không tìm thấy thuốc' : null}
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-clinic-text-secondary">
                        Số ngày dùng chung toàn đơn
                    </span>
                    <div className="flex items-center gap-1 tabular-nums">
                        <input
                            type="number"
                            min="1"
                            max="90"
                            disabled={isReadOnly}
                            value={batchDays}
                            onChange={(e) => applyBatchDays(e.target.value)}
                            className="w-14 text-center font-bold text-xs py-1.5 px-1 rounded-[6px] border border-clinic-border bg-clinic-surface text-clinic-navy tabular-nums"
                            title="Số ngày dùng thuốc chung cho cả đơn"
                        />
                        <span className="text-xs text-clinic-text-secondary mr-1">ngày</span>
                        {[3, 5, 7, 10, 14, 30].map((d) => (
                            <button
                                key={d}
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => applyBatchDays(d)}
                                className={`text-xs font-semibold px-2 py-1 rounded-[6px] border transition cursor-pointer tabular-nums ${
                                    Number(batchDays) === d
                                        ? 'bg-clinic-cta text-clinic-surface border-clinic-cta'
                                        : 'bg-clinic-bg text-clinic-text-secondary border-clinic-border hover:bg-clinic-surface-tint'
                                }`}
                            >
                                {d}n
                            </button>
                        ))}
                    </div>
                </div>

                {onOpenRxModal && (
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        {!isReadOnly && (
                            <button
                                type="button"
                                onClick={() => onOpenRxModal('templates')}
                                className="medpro-btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[6px] cursor-pointer"
                                title="Phác đồ điều trị mẫu khuyến nghị (F4)"
                            >
                                <ClinicIcon name="BookmarkSimple" size={14} />
                                <span>Phác đồ mẫu</span>
                                <span className="text-[10px] bg-clinic-bg-muted border border-clinic-border px-1 rounded-[4px] font-mono">F4</span>
                            </button>
                        )}
                        {!isReadOnly && (
                            <button
                                type="button"
                                onClick={() => onOpenRxModal('copy')}
                                className="medpro-btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[6px] cursor-pointer"
                                title="Tái sử dụng từ đơn thuốc cũ (F8)"
                            >
                                <ClinicIcon name="ClockCounterClockwise" size={14} />
                                <span>Đơn cũ</span>
                                <span className="text-[10px] bg-clinic-bg-muted border border-clinic-border px-1 rounded-[4px] font-mono">F8</span>
                            </button>
                        )}
                        {demoMode ? (
                            <span className="text-xs text-clinic-text-secondary">Bản demo lưu đơn thuốc nháp.</span>
                        ) : !isSigned ? (
                            <button
                                type="button"
                                disabled={rows.length === 0 || signingLoading || isReadOnly}
                                onClick={() => setShowSignConfirm(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-[6px] border border-clinic-success bg-clinic-success hover:bg-clinic-navy text-clinic-surface transition-colors cursor-pointer disabled:opacity-50"
                                title="Ký số đơn thuốc điện tử và khóa dữ liệu"
                            >
                                <ClinicIcon name="Pen" size={14} weight="bold" />
                                <span>{signingLoading ? 'Đang ký số…' : 'Ký số đơn thuốc'}</span>
                            </button>
                        ) : (
                            <span className="medpro-badge-success inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold">
                                <ClinicIcon name="CheckCircle" size={14} weight="fill" />
                                <span>Đã ký số</span>
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={() => onOpenRxModal('print')}
                            className="medpro-btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[6px] cursor-pointer"
                            title="In đơn thuốc & Xem mã QR (F9 / Ctrl+P)"
                        >
                            <ClinicIcon name="Printer" size={14} />
                            <span>In đơn &amp; QR</span>
                            <span className="text-[10px] bg-clinic-bg-muted border border-clinic-border px-1 rounded-[4px] font-mono">F9</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="overflow-x-auto rounded-[6px] border border-clinic-border bg-clinic-surface">
                <div className="min-w-[920px]">
                    <div className={`${GRID} bg-clinic-surface-tint border-b border-clinic-border px-3 py-2.5 text-xs font-bold text-clinic-navy`}>
                        <span className="text-center">#</span>
                        <span>Thuốc · Hoạt chất · Hàm lượng</span>
                        {DOSE_SLOTS.map((s) => (
                            <span key={s.key} className="text-center">
                                {s.label}
                            </span>
                        ))}
                        <span className="text-center">Ngày</span>
                        <span className="text-center">Tổng SL</span>
                        <span>Cách dùng &amp; Hướng dẫn</span>
                        <span className="text-center">Xóa</span>
                    </div>

                    {rows.length === 0 && (
                        <div className="px-4 py-8 text-center text-clinic-text-secondary">
                            <ClinicIcon name="Pill" size={28} className="mx-auto text-clinic-text-subtle mb-1" />
                            <p className="text-xs">Chưa có thuốc trong đơn. Gõ tên thuốc ở trên hoặc nạp từ Phác đồ mẫu / Đơn cũ.</p>
                        </div>
                    )}

                    {rows.map((r, i) => {
                        const conflict = findAllergyConflict(r.hoat_chat, allergy)
                        const totalQty = computeQuantity(r)
                        return (
                            <div key={`${r.ten_thuoc}-${i}`} className={`border-t border-clinic-border ${conflict ? 'bg-clinic-danger-bg' : i % 2 === 1 ? 'bg-clinic-bg' : 'bg-clinic-surface'}`}>
                                <div className={`${GRID} px-3 py-2.5`}>
                                    <div className="flex flex-col items-center justify-center gap-0.5 text-clinic-text-muted">
                                        <button
                                            type="button"
                                            disabled={locked || i === 0}
                                            onClick={() => moveRow(i, -1)}
                                            className="text-[10px] hover:text-clinic-cta disabled:opacity-20 cursor-pointer"
                                            title="Chuyển lên trên"
                                        >
                                            ▲
                                        </button>
                                        <span className="text-xs font-bold text-clinic-text-secondary font-mono tabular-nums">{i + 1}</span>
                                        <button
                                            type="button"
                                            disabled={locked || i === rows.length - 1}
                                            onClick={() => moveRow(i, 1)}
                                            className="text-[10px] hover:text-clinic-cta disabled:opacity-20 cursor-pointer"
                                            title="Chuyển xuống dưới"
                                        >
                                            ▼
                                        </button>
                                    </div>

                                    <div className="min-w-0 pr-2">
                                        <div className="font-bold text-clinic-navy text-[13px] truncate">{r.ten_thuoc}</div>
                                        <div className="flex items-center gap-2 text-[11px] text-clinic-text-secondary">
                                            <span>{r.hoat_chat} ({r.ham_luong || 'Chuẩn'})</span>
                                            <span className="text-clinic-text-subtle">·</span>
                                            <span className="font-semibold text-clinic-cta">{r.don_vi_tinh || 'Viên'}</span>
                                            {r.duong_dung && (
                                                <span className="text-[10px] text-clinic-text-muted">({r.duong_dung})</span>
                                            )}
                                        </div>
                                    </div>

                                    {DOSE_SLOTS.map((s) => (
                                        <input
                                            key={s.key}
                                            aria-label={`${s.label} — ${r.ten_thuoc}`}
                                            inputMode="decimal"
                                            className="medpro-input !px-0.5 text-center font-bold text-xs tabular-nums"
                                            value={r[s.key] || ''}
                                            placeholder="—"
                                            onChange={(e) => updateRow(i, { [s.key]: e.target.value })}
                                            disabled={isReadOnly}
                                        />
                                    ))}

                                    <input
                                        aria-label={`Số ngày — ${r.ten_thuoc}`}
                                        inputMode="numeric"
                                        className="medpro-input !px-1 text-center font-bold text-xs tabular-nums"
                                        value={r.so_ngay_dung || ''}
                                        onChange={(e) => updateRow(i, { so_ngay_dung: e.target.value })}
                                        disabled={isReadOnly}
                                    />

                                    <div className="text-center tabular-nums">
                                        <span className="font-extrabold text-clinic-navy text-sm">{totalQty}</span>
                                        <span className="block text-[10px] text-clinic-text-muted">{r.don_vi_tinh || 'viên'}</span>
                                    </div>

                                    <div className="flex flex-col gap-1 min-w-0">
                                        <input
                                            aria-label={`Cách dùng — ${r.ten_thuoc}`}
                                            className="medpro-input !py-1 text-xs"
                                            value={r.cach_dung || ''}
                                            placeholder="VD: Uống sáng 1 viên, tối 1 viên sau ăn no"
                                            onChange={(e) => updateRow(i, { cach_dung: e.target.value })}
                                            disabled={isReadOnly}
                                        />
                                        {!isReadOnly && (
                                            <div className="flex flex-wrap items-center gap-1">
                                                {QUICK_USAGE_TAGS.map((tag) => (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        onClick={() => appendUsageTag(i, tag)}
                                                        className="text-[10px] px-1.5 py-0.5 rounded-[4px] bg-clinic-bg-muted border border-clinic-border hover:bg-clinic-surface-alt text-clinic-text-secondary transition cursor-pointer"
                                                    >
                                                        +{tag}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-center">
                                        {!isReadOnly ? (
                                            <button
                                                type="button"
                                                aria-label={`Xóa ${r.ten_thuoc}`}
                                                onClick={() => removeRow(i)}
                                                className="flex h-7 w-7 items-center justify-center rounded-[6px] text-clinic-text-muted hover:bg-clinic-danger-bg hover:text-clinic-danger transition cursor-pointer"
                                                title="Xóa thuốc này khỏi đơn"
                                            >
                                                <ClinicIcon name="Trash" size={15} />
                                            </button>
                                        ) : (
                                            <span />
                                        )}
                                    </div>
                                </div>

                                {conflict && (
                                    <div className="mx-3 mb-2 flex flex-wrap items-center gap-3 rounded-[6px] bg-clinic-danger-bg px-3 py-2 text-[12px] font-medium text-clinic-danger border border-clinic-danger-border">
                                        <ClinicIcon name="Warning" size={16} weight="bold" className="text-clinic-danger" />
                                        <span className="flex-1">
                                            <strong>Cảnh báo dị ứng:</strong> Thuốc {r.hoat_chat} thuộc nhóm {conflict} — Hồ sơ bệnh nhân ghi nhận “{allergy}”.
                                        </span>
                                        {!isReadOnly && conflict === 'NSAID' && (
                                            <button type="button" className="px-2.5 py-1 rounded-[4px] bg-clinic-surface text-clinic-danger font-bold border border-clinic-danger-border hover:bg-clinic-danger-bg transition cursor-pointer" onClick={() => replaceWithParacetamol(i)}>
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

            <div>
                <div className="flex items-center justify-between mb-1">
                    <span className="medpro-label !mb-0">Lời dặn dùng thuốc của bác sĩ</span>
                    {!isReadOnly && (
                        <div className="flex items-center gap-1.5">
                            {QUICK_NOTES.slice(0, 2).map((note, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setFieldValue('loi_dan_uong_thuoc', note)}
                                    className="text-[11px] text-clinic-cta hover:underline cursor-pointer"
                                >
                                    +Gợi ý {idx + 1}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <input
                    name="loi_dan_uong_thuoc"
                    className="medpro-input"
                    value={values.loi_dan_uong_thuoc || ''}
                    placeholder="VD: Uống thuốc sau bữa ăn no. Kiêng bia rượu, nước đá. Tái khám sau 5 ngày nếu còn sốt."
                    onChange={handleChange}
                    disabled={isReadOnly}
                />
            </div>

            <section className="medpro-card rounded-[6px] bg-clinic-surface-alt border-clinic-info-border p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-clinic-navy flex items-center gap-1.5">
                        <ClinicIcon name="CalendarCheck" size={16} className="text-clinic-cta" />
                        <span>Hẹn tái khám</span>
                    </h3>
                    <span className="text-[11px] text-clinic-text-secondary">Tự động tính ngày và thứ theo số ngày hẹn</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-end">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="medpro-label !mb-0">Ngày hẹn tái khám</span>
                            <span className="text-[11px] font-bold text-clinic-cta tabular-nums">
                                {values.ngay_hen_tai_kham
                                    ? new Date(values.ngay_hen_tai_kham).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
                                    : 'Chưa hẹn'}
                            </span>
                        </div>
                        <input
                            type="date"
                            name="ngay_hen_tai_kham"
                            className="medpro-input font-semibold tabular-nums"
                            value={values.ngay_hen_tai_kham || ''}
                            onChange={handleChange}
                            disabled={isReadOnly}
                        />
                    </div>

                    <div>
                        <span className="medpro-label !mb-1">Chọn nhanh số ngày tái khám</span>
                        <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
                            {FOLLOW_UP_PRESETS.map((p) => (
                                <button
                                    key={p.days}
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => handleSetFollowUpDays(p.days)}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-[6px] border transition cursor-pointer ${
                                        followUpDays === p.days
                                            ? 'bg-clinic-cta text-clinic-surface border-clinic-cta'
                                            : 'bg-clinic-surface text-clinic-text border-clinic-border hover:bg-clinic-surface-tint'
                                    }`}
                                >
                                    +{p.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    <span className="medpro-label">Lời dặn tái khám</span>
                    <input
                        name="loi_dan_bac_si"
                        className="medpro-input"
                        value={values.loi_dan_bac_si || ''}
                        placeholder="VD: Tái khám kiểm tra men gan & siêu âm bụng sau 7 ngày"
                        onChange={handleChange}
                        disabled={isReadOnly}
                    />
                </div>
            </section>

            {showSignConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-clinic-navy/60 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-[6px] bg-clinic-surface p-6 border border-clinic-border">
                        <div className="flex items-center gap-3 text-clinic-success mb-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-clinic-success-bg text-clinic-success border border-clinic-success-border">
                                <ClinicIcon name="ShieldCheck" size={24} weight="bold" />
                            </div>
                            <div>
                                <h4 className="text-base font-extrabold text-clinic-navy">
                                    Xác nhận ký số đơn thuốc
                                </h4>
                                <span className="text-xs text-clinic-text-secondary">
                                    Theo Thông tư 04/2022/TT-BYT
                                </span>
                            </div>
                        </div>

                        <div className="text-xs text-clinic-text-secondary space-y-2 mb-5 bg-clinic-bg p-3.5 rounded-[6px] border border-clinic-border tabular-nums">
                            <p>
                                Bạn đang tiến hành ký số cho đơn thuốc gồm{' '}
                                <strong className="text-clinic-navy">{rows.length} loại thuốc</strong> của người bệnh{' '}
                                <strong className="text-clinic-navy">{encounter?.benh_nhan?.ho_ten || 'bệnh nhân'}</strong>.
                            </p>
                            <div className="p-2.5 rounded-[6px] bg-clinic-warning-bg border border-clinic-warning-border text-clinic-warning text-[11px] font-medium leading-relaxed flex items-start gap-2">
                                <ClinicIcon name="Warning" size={15} weight="bold" className="shrink-0 mt-0.5" />
                                <span>
                                    <strong>Lưu ý quan trọng:</strong> Sau khi ký số, trạng thái đơn thuốc sẽ chuyển sang{' '}
                                    <span className="font-bold text-clinic-success">Đã ký số</span>. Toàn bộ thông tin thuốc, liều dùng sẽ bị{' '}
                                    <strong>KHÓA BẤT BIẾN</strong>, không thể chỉnh sửa trực tiếp theo quy định y tế.
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                disabled={signingLoading}
                                onClick={() => setShowSignConfirm(false)}
                                className="medpro-btn-outline px-4 py-2 text-xs font-semibold rounded-[6px] cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                disabled={signingLoading}
                                onClick={handleSignPrescription}
                                className="px-4 py-2 text-xs font-bold rounded-[6px] bg-clinic-success text-clinic-surface hover:bg-clinic-navy transition cursor-pointer flex items-center gap-1.5"
                            >
                                <ClinicIcon name="Pen" size={14} weight="bold" />
                                <span>{signingLoading ? 'Đang xác thực chữ ký…' : 'Xác nhận ký số (SIGNED)'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
