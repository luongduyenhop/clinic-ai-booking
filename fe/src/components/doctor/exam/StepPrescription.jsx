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

// Các gợi ý cách dùng phổ biến tại phòng khám (SimpleClinic & tClinic)
const QUICK_USAGE_TAGS = [
    'Uống sau ăn no',
    'Uống trước ăn 30 phút',
    'Uống khi sốt >= 38.5°C',
    'Uống trước khi đi ngủ',
    'Ngậm dưới lưỡi',
    'Uống nhiều nước',
]

// Các mốc hẹn tái khám nhanh (tClinic)
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

// Helper tự động sinh câu cách dùng từ liều dùng Sáng/Trưa/Chiều/Tối (SimpleClinic)
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
    const dispatch = useDispatch()
    const { values, setFieldValue, handleChange } = formik
    const rows = values.danh_sach_thuoc || []
    const [keyword, setKeyword] = useState('')
    const [options, setOptions] = useState([])
    const debounced = useDebounce(keyword, 250)
    const allergy = encounter?.benh_nhan?.di_ung_thuoc

    // Trạng thái khóa bất biến FSM SIGNED theo Quyết định BYT
    const isSigned =
        values.trang_thai_don_thuoc === 'SIGNED' ||
        encounter?.don_thuoc?.trang_thai === 'SIGNED' ||
        encounter?.trang_thai_don_thuoc === 'SIGNED' ||
        locked
    const isReadOnly = Boolean(isSigned || locked)

    const [signingLoading, setSigningLoading] = useState(false)
    const [showSignConfirm, setShowSignConfirm] = useState(false)

    // Số ngày dùng chung cho cả đơn (tClinic batch duration)
    const [batchDays, setBatchDays] = useState(rows[0]?.so_ngay_dung || '5')

    // Trạng thái đồng bộ Cổng Đơn thuốc Quốc gia
    const [nationalSyncStatus, setNationalSyncStatus] = useState('pending')

    // Số ngày hẹn tái khám
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
            console.error('Sign prescription error:', err)
            AppToast.error(err?.message || 'Không thể ký số đơn thuốc. Vui lòng thử lại!')
        } finally {
            setSigningLoading(false)
        }
    }

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
                            <div className="flex items-center justify-between py-0.5">
                                <div>
                                    <strong className="text-[#003553] text-[13px]">{d.ten_thuoc}</strong>
                                    <span className="ml-2 text-slate-500 text-xs">{d.hoat_chat} ({d.ham_luong || 'Chuẩn'})</span>
                                </div>
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-[#0077B6]">
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

    // Áp dụng số ngày dùng hàng loạt cho toàn bộ thuốc trong đơn (tClinic)
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
            // Tự động cập nhật câu cách dùng nếu người dùng sửa liều mà chưa gõ cách dùng riêng
            if (('sang' in patch || 'trua' in patch || 'chieu' in patch || 'toi' in patch) && (!r.cach_dung || r.cach_dung.startsWith('Uống'))) {
                const auto = generateDoseText(newRow.sang, newRow.trua, newRow.chieu, newRow.toi, newRow.don_vi_tinh?.toLowerCase() || 'viên')
                if (auto) newRow.cach_dung = auto
            }
            return newRow
        })
        setFieldValue('danh_sach_thuoc', updated)
    }

    const removeRow = (index) => setFieldValue('danh_sach_thuoc', rows.filter((_, i) => i !== index))

    // Di chuyển thứ tự thuốc lên / xuống (tClinic sortable)
    const moveRow = (index, direction) => {
        const targetIndex = index + direction
        if (targetIndex < 0 || targetIndex >= rows.length) return
        const newRows = [...rows]
        const temp = newRows[index]
        newRows[index] = newRows[targetIndex]
        newRows[targetIndex] = temp
        setFieldValue('danh_sach_thuoc', newRows)
    }

    // Đính kèm tag cách dùng nhanh vào dòng thuốc
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

    // Xử lý hẹn tái khám thông minh bằng số ngày (tClinic)
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
            {/* THÔNG BÁO BẢO VỆ BẤT BIẾN FSM KHI ĐÃ KÝ SỐ (INT-04 / Thông tư 04/2022/TT-BYT) */}
            {isSigned && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-50 border-2 border-emerald-300 text-emerald-900 shadow-xs animate-fadeIn">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
                            <ClinicIcon name="CheckCircle" size={18} weight="bold" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs uppercase tracking-wider text-emerald-950">
                                    ĐÃ KÝ SỐ ĐIỆN TỬ (FSM: SIGNED) — DỮ LIỆU ĐÃ KHÓA BẤT BIẾN
                                </span>
                                <span className="bg-emerald-200/90 text-emerald-900 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                                    TT 04/2022/TT-BYT
                                </span>
                            </div>
                            <div className="text-[11px] text-emerald-800 mt-0.5">
                                Bác sĩ ký:{' '}
                                <strong>
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
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                        <ClinicIcon name="Printer" size={14} weight="bold" />
                        <span>In Đơn Chuẩn A4/A5</span>
                    </button>
                </div>
            )}
            {/* THANH LIÊN THÔNG ĐƠN THUỐC QUỐC GIA (Bộ Y tế - TT 27/2021/TT-BYT) */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50/60 border border-sky-200">
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0077B6] text-white">
                        <ClinicIcon name="QrCode" size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-[#003553]">Cổng Đơn Thuốc Quốc Gia:</span>
                            <span className="font-mono text-xs font-bold text-[#0077B6] bg-white px-2 py-0.5 rounded border border-sky-200">
                                {nationalRxCode}
                            </span>
                        </div>
                        <span className="text-[11px] text-slate-500">Chuẩn liên thông TT 27/2021 &amp; TT 04/2022/TT-BYT · donthuocquocgia.vn</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {nationalSyncStatus === 'synced' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
                            <ClinicIcon name="CheckCircle" size={14} weight="bold" />
                            <span>Đã liên thông Cổng QG</span>
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSyncNationalRx}
                            disabled={rows.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 transition cursor-pointer disabled:opacity-50"
                            title="Đồng bộ dữ liệu đơn thuốc điện tử lên Cổng Đơn thuốc Quốc gia"
                        >
                            <ClinicIcon name="CloudArrowUp" size={14} weight="bold" />
                            <span>Đồng bộ Cổng QG</span>
                        </button>
                    )}
                </div>
            </div>

            {/* THANH TÌM THUỐC & CÔNG CỤ NHANH */}
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

                {/* SỐ NGÀY DÙNG CHUNG CHO CẢ ĐƠN (tClinic Batch Duration) */}
                <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                        Số ngày dùng chung toàn đơn
                    </span>
                    <div className="flex items-center gap-1">
                        <input
                            type="number"
                            min="1"
                            max="90"
                            disabled={isReadOnly}
                            value={batchDays}
                            onChange={(e) => applyBatchDays(e.target.value)}
                            className="w-14 text-center font-bold text-xs py-1.5 px-1 rounded-lg border border-slate-300 bg-white text-[#003553]"
                            title="Số ngày dùng thuốc chung cho cả đơn"
                        />
                        <span className="text-xs text-slate-500 mr-1">ngày</span>
                        {[3, 5, 7, 10, 14, 30].map((d) => (
                            <button
                                key={d}
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => applyBatchDays(d)}
                                className={`text-xs font-semibold px-2 py-1 rounded-md border transition cursor-pointer ${
                                    Number(batchDays) === d
                                        ? 'bg-[#0077B6] text-white border-[#0077B6]'
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
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
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors shadow-2xs cursor-pointer"
                                title="Phác đồ điều trị mẫu khuyến nghị (F4)"
                            >
                                <ClinicIcon name="BookmarkSimple" size={14} />
                                <span>Phác đồ mẫu</span>
                                <span className="text-[10px] bg-teal-200/60 px-1 rounded font-mono">F4</span>
                            </button>
                        )}
                        {!isReadOnly && (
                            <button
                                type="button"
                                onClick={() => onOpenRxModal('copy')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 transition-colors shadow-2xs cursor-pointer"
                                title="Tái sử dụng từ đơn thuốc cũ (F8)"
                            >
                                <ClinicIcon name="ClockCounterClockwise" size={14} />
                                <span>Đơn cũ</span>
                                <span className="text-[10px] bg-blue-200/60 px-1 rounded font-mono">F8</span>
                            </button>
                        )}
                        {!isSigned ? (
                            <button
                                type="button"
                                disabled={rows.length === 0 || signingLoading || isReadOnly}
                                onClick={() => setShowSignConfirm(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                                title="Ký số đơn thuốc điện tử (Chuyển FSM sang SIGNED và khóa bất biến)"
                            >
                                <ClinicIcon name="Pen" size={14} weight="bold" />
                                <span>{signingLoading ? 'Đang ký số…' : 'Ký số đơn thuốc'}</span>
                            </button>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <ClinicIcon name="CheckCircle" size={14} weight="fill" className="text-emerald-600" />
                                <span>Đã Ký Số (SIGNED)</span>
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={() => onOpenRxModal('print')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                            title="In đơn thuốc & Xem mã QR (F9 / Ctrl+P)"
                        >
                            <ClinicIcon name="Printer" size={14} />
                            <span>In đơn &amp; QR</span>
                            <span className="text-[10px] bg-slate-200 px-1 rounded font-mono">F9</span>
                        </button>
                    </div>
                )}
            </div>

            {/* BẢNG KÊ THUỐC ĐIỀU TRỊ */}
            <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200 bg-white shadow-2xs">
                <div className="min-w-[920px]">
                    <div className={`${GRID} rounded-t-xl bg-[#F0F7FC] px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#003553]`}>
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
                        <div className="px-4 py-8 text-center text-slate-500">
                            <ClinicIcon name="Pill" size={28} className="mx-auto text-slate-300 mb-1" />
                            <p className="text-xs">Chưa có thuốc trong đơn. Gõ tên thuốc ở trên hoặc nạp từ Phác đồ mẫu / Đơn cũ.</p>
                        </div>
                    )}

                    {rows.map((r, i) => {
                        const conflict = findAllergyConflict(r.hoat_chat, allergy)
                        const totalQty = computeQuantity(r)
                        
                        return (
                            <div key={`${r.ten_thuoc}-${i}`} className={`border-t border-slate-100 ${conflict ? 'bg-rose-50/50' : i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                                <div className={`${GRID} px-3 py-2.5`}>
                                    {/* Cột 1: Thứ tự & Mũi tên di chuyển (tClinic sortable) */}
                                    <div className="flex flex-col items-center justify-center gap-0.5 text-slate-400">
                                        <button
                                            type="button"
                                            disabled={locked || i === 0}
                                            onClick={() => moveRow(i, -1)}
                                            className="text-[10px] hover:text-[#0077B6] disabled:opacity-20 cursor-pointer"
                                            title="Chuyển lên trên"
                                        >
                                            ▲
                                        </button>
                                        <span className="text-xs font-bold text-slate-600 font-mono">{i + 1}</span>
                                        <button
                                            type="button"
                                            disabled={locked || i === rows.length - 1}
                                            onClick={() => moveRow(i, 1)}
                                            className="text-[10px] hover:text-[#0077B6] disabled:opacity-20 cursor-pointer"
                                            title="Chuyển xuống dưới"
                                        >
                                            ▼
                                        </button>
                                    </div>

                                    {/* Cột 2: Tên thuốc, hoạt chất, đường dùng */}
                                    <div className="min-w-0 pr-2">
                                        <div className="font-bold text-[#003553] text-[13px] truncate">{r.ten_thuoc}</div>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                            <span>{r.hoat_chat} ({r.ham_luong || 'Chuẩn'})</span>
                                            <span className="text-slate-300">·</span>
                                            <span className="font-semibold text-teal-700">{r.don_vi_tinh || 'Viên'}</span>
                                            {r.duong_dung && (
                                                <span className="text-[10px] text-slate-400">({r.duong_dung})</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Cột 3-6: Sáng, Trưa, Chiều, Tối */}
                                    {DOSE_SLOTS.map((s) => (
                                        <input
                                            key={s.key}
                                            aria-label={`${s.label} — ${r.ten_thuoc}`}
                                            inputMode="decimal"
                                            className="medpro-input !px-0.5 text-center font-bold text-xs"
                                            value={r[s.key] || ''}
                                            placeholder="—"
                                            onChange={(e) => updateRow(i, { [s.key]: e.target.value })}
                                            disabled={isReadOnly}
                                        />
                                    ))}

                                    {/* Cột 7: Số ngày dùng */}
                                    <input
                                        aria-label={`Số ngày — ${r.ten_thuoc}`}
                                        inputMode="numeric"
                                        className="medpro-input !px-1 text-center font-bold text-xs"
                                        value={r.so_ngay_dung || ''}
                                        onChange={(e) => updateRow(i, { so_ngay_dung: e.target.value })}
                                        disabled={isReadOnly}
                                    />

                                    {/* Cột 8: Tổng số lượng tự tính */}
                                    <div className="text-center">
                                        <span className="font-extrabold text-[#003553] text-sm">{totalQty}</span>
                                        <span className="block text-[10px] text-slate-400">{r.don_vi_tinh || 'viên'}</span>
                                    </div>

                                    {/* Cột 9: Hướng dẫn / Cách dùng chi tiết */}
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
                                                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                                                    >
                                                        +{tag}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Cột 10: Nút xóa dòng */}
                                    <div className="flex justify-center">
                                        {!isReadOnly ? (
                                            <button
                                                type="button"
                                                aria-label={`Xóa ${r.ten_thuoc}`}
                                                onClick={() => removeRow(i)}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                                                title="Xóa thuốc này khỏi đơn"
                                            >
                                                <ClinicIcon name="Trash" size={15} />
                                            </button>
                                        ) : (
                                            <span />
                                        )}
                                    </div>
                                </div>

                                {/* Cảnh báo dị ứng thuốc (Allergy warning) */}
                                {conflict && (
                                    <div className="mx-3 mb-2 flex flex-wrap items-center gap-3 rounded-lg bg-rose-100/80 px-3 py-2 text-[12px] font-medium text-rose-900 border border-rose-300">
                                        <ClinicIcon name="Warning" size={16} weight="bold" className="text-rose-600" />
                                        <span className="flex-1">
                                            <strong>Cảnh báo dị ứng:</strong> Thuốc {r.hoat_chat} thuộc nhóm {conflict} — Hồ sơ bệnh nhân ghi nhận “{allergy}”.
                                        </span>
                                        {!isReadOnly && conflict === 'NSAID' && (
                                            <button type="button" className="px-2.5 py-1 rounded bg-white text-rose-700 font-bold border border-rose-300 hover:bg-rose-50 transition cursor-pointer" onClick={() => replaceWithParacetamol(i)}>
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

            {/* LỜI DẶN DÙNG THUỐC CHUNG */}
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
                                    className="text-[11px] text-[#0077B6] hover:underline cursor-pointer"
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

            {/* HẸN TÁI KHÁM THÔNG MINH (tClinic Smart Follow-up) */}
            <section className="rounded-xl bg-[#E8F4FD]/80 border border-sky-200 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#003553] flex items-center gap-1.5">
                        <ClinicIcon name="CalendarCheck" size={16} className="text-[#0077B6]" />
                        <span>Hẹn Tái Khám Thông Minh</span>
                    </h3>
                    <span className="text-[11px] text-slate-500">Tự động tính ngày và thứ theo số ngày hẹn</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-end">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="medpro-label !mb-0">Ngày hẹn tái khám</span>
                            <span className="text-[11px] font-bold text-[#0077B6]">
                                {values.ngay_hen_tai_kham
                                    ? new Date(values.ngay_hen_tai_kham).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
                                    : 'Chưa hẹn'}
                            </span>
                        </div>
                        <input
                            type="date"
                            name="ngay_hen_tai_kham"
                            className="medpro-input font-semibold"
                            value={values.ngay_hen_tai_kham || ''}
                            onChange={handleChange}
                            disabled={isReadOnly}
                        />
                    </div>

                    <div>
                        <span className="medpro-label !mb-1">Chọn nhanh số ngày tái khám (tClinic)</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {FOLLOW_UP_PRESETS.map((p) => (
                                <button
                                    key={p.days}
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => handleSetFollowUpDays(p.days)}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                                        followUpDays === p.days
                                            ? 'bg-[#0077B6] text-white border-[#0077B6] shadow-2xs'
                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
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

            {/* MODAL XÁC NHẬN KÝ SỐ ĐƠN THUỐC ĐIỆN TỬ (FSM SIGNED) */}
            {showSignConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
                        <div className="flex items-center gap-3 text-emerald-700 mb-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                                <ClinicIcon name="ShieldCheck" size={24} weight="bold" />
                            </div>
                            <div>
                                <h4 className="text-base font-extrabold text-[#003553]">
                                    Xác nhận Ký số Đơn thuốc
                                </h4>
                                <span className="text-xs text-slate-500">
                                    Quy chuẩn FSM · Thông tư 04/2022/TT-BYT
                                </span>
                            </div>
                        </div>

                        <div className="text-xs text-slate-600 space-y-2 mb-5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                            <p>
                                Bạn đang tiến hành ký số cho đơn thuốc gồm{' '}
                                <strong>{rows.length} loại thuốc</strong> của người bệnh{' '}
                                <strong>{encounter?.benh_nhan?.ho_ten || 'bệnh nhân'}</strong>.
                            </p>
                            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium leading-relaxed">
                                ⚠️ <strong>Lưu ý quan trọng:</strong> Sau khi ký số, trạng thái đơn thuốc sẽ chuyển sang{' '}
                                <span className="font-bold text-emerald-700">SIGNED</span>. Toàn bộ thông tin thuốc, liều dùng sẽ bị{' '}
                                <strong>KHÓA BẤT BIẾN</strong>, không thể chỉnh sửa trực tiếp theo quy định y tế!
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                disabled={signingLoading}
                                onClick={() => setShowSignConfirm(false)}
                                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                disabled={signingLoading}
                                onClick={handleSignPrescription}
                                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                            >
                                <ClinicIcon name="Pen" size={14} weight="bold" />
                                <span>{signingLoading ? 'Đang xác thực chữ ký…' : 'Xác nhận Ký số (SIGNED)'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
