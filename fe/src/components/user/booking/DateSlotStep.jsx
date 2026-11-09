import { Clock } from '../../common/ClinicIcon'

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const UPCOMING_DATES = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + index)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return { value, weekday: index === 0 ? 'Hôm nay' : WEEKDAYS[date.getDay()], day: date.getDate(), month: date.getMonth() + 1 }
})

export default function DateSlotStep({ appointmentDate, timeSlot, slots = [], loading = false, error = '', slotConflict = null, onDateChange = () => {}, onSlotChange = () => {} }) {
    const conflictApplies = slotConflict?.date === appointmentDate
    const available = slots.filter((slot) => slot.available && !(conflictApplies && slot.value === slotConflict.timeSlot))
    const morning = available.filter((slot) => Number(slot.value.slice(0, 2)) < 12)
    const afternoon = available.filter((slot) => Number(slot.value.slice(0, 2)) >= 12)
    return <div><h2 className="booking-title">Chọn ngày khám</h2><p className="booking-description">Lịch khả dụng trong 7 ngày gần nhất.</p><div className="mt-5 grid grid-cols-4 sm:grid-cols-7 gap-2">{UPCOMING_DATES.map((date) => <button type="button" key={date.value} onClick={() => onDateChange(date.value)} className={`rounded-xl border p-2.5 text-center min-h-20 transition ${appointmentDate === date.value ? 'border-[#00B5F1] bg-[#00B5F1] text-white' : 'border-slate-200 bg-white text-[#003553] hover:border-[#8DDBF7]'}`}><span className="block text-[11px] font-semibold opacity-75">{date.weekday}</span><strong className="block text-xl mt-1">{date.day}</strong><span className="text-[10px] opacity-75">Tháng {date.month}</span></button>)}</div>{appointmentDate && <div className="mt-8"><h2 className="booking-title">Chọn khung giờ 30 phút</h2>{slotConflict && conflictApplies && <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Bạn đã có lịch hẹn khác vào {slotConflict.timeSlot} ngày này. Khung giờ đó đã được ẩn; vui lòng chọn giờ khác hoặc đổi ngày.</p>}{error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}{loading ? <div role="status" className="py-12 text-center text-sm text-slate-500">Đang tải khung giờ...</div> : <div className="mt-5 space-y-6">{available.length === 0 && !error && <p role="status" className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">Không còn khung giờ trống. Vui lòng chọn ngày khác.</p>}{morning.length > 0 && <SlotGroup title="Buổi sáng" items={morning} selected={timeSlot} onChange={onSlotChange} />}{afternoon.length > 0 && <SlotGroup title="Buổi chiều" items={afternoon} selected={timeSlot} onChange={onSlotChange} />}</div>}<div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded bg-white border border-slate-300"/>Còn trống</span><span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded bg-[#00B5F1]"/>Đang chọn</span></div></div>}</div>
}

function SlotGroup({ title, items, selected, onChange }) { return <div><h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#003553]"><Clock size={17} className="text-[#00B5F1]" />{title}</h3><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">{items.map((slot) => <button type="button" key={slot.value} disabled={!slot.available} onClick={() => onChange(slot.value)} className={`min-h-11 rounded-lg border text-xs font-bold transition ${selected === slot.value ? 'border-[#00B5F1] bg-[#00B5F1] text-white' : slot.available ? 'border-slate-200 bg-white text-[#003553] hover:border-[#00B5F1]' : 'border-slate-100 bg-slate-100 text-slate-300 cursor-not-allowed line-through'}`}>{slot.value}</button>)}</div></div> }
