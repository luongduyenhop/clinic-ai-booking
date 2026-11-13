import { Clock, CalendarCheck, CheckCircle } from '../../common/ClinicIcon'

const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
const UPCOMING_DATES = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + index)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return {
        value,
        weekday: index === 0 ? 'Hôm nay' : index === 1 ? 'Ngày mai' : WEEKDAYS[date.getDay()],
        shortDay: WEEKDAYS[date.getDay()],
        day: date.getDate(),
        month: date.getMonth() + 1,
    }
})

export default function DateSlotStep({
    appointmentDate,
    timeSlot,
    slots = [],
    loading = false,
    error = '',
    slotConflict = null,
    onDateChange = () => {},
    onSlotChange = () => {},
}) {
    const conflictApplies = slotConflict?.date === appointmentDate
    const available = slots.filter((slot) => slot.available && !(conflictApplies && slot.value === slotConflict.timeSlot))
    const morning = available.filter((slot) => {
        const hour = Number(slot.value.slice(0, 2))
        return hour < 12
    })
    const afternoon = available.filter((slot) => {
        const hour = Number(slot.value.slice(0, 2))
        return hour >= 12
    })

    return (
        <div className="space-y-6">
            <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-[#003553] flex items-center gap-2">
                            <CalendarCheck size={20} className="text-[#00B5F1]" />
                            Chọn ngày khám
                        </h2>
                        <p className="mt-1 text-xs sm:text-sm text-slate-500">
                            Lịch khả dụng trong 7 ngày tới hoặc chọn ngày khác qua ô lịch.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-500">Ngày khác:</label>
                        <input
                            type="date"
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:border-[#00B5F1] focus:outline-none focus:ring-1 focus:ring-[#00B5F1]"
                            min={UPCOMING_DATES[0].value}
                            value={appointmentDate || ''}
                            onChange={(e) => onDateChange(e.target.value)}
                        />
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                    {UPCOMING_DATES.map((item) => {
                        const isSelected = appointmentDate === item.value
                        return (
                            <button
                                type="button"
                                key={item.value}
                                onClick={() => onDateChange(item.value)}
                                className={`group relative rounded-2xl border p-3 text-center transition-all duration-150 cursor-pointer ${
                                    isSelected
                                        ? 'border-[#00B5F1] bg-gradient-to-b from-[#00B5F1] to-[#0094C6] text-white shadow-md shadow-sky-500/20'
                                        : 'border-slate-200 bg-white text-[#003553] hover:border-[#00B5F1] hover:bg-sky-50/50 hover:shadow-xs'
                                }`}
                            >
                                <span
                                    className={`block text-[11px] font-bold uppercase tracking-wider ${
                                        isSelected ? 'text-sky-100' : 'text-slate-500 group-hover:text-[#008EC2]'
                                    }`}
                                >
                                    {item.weekday}
                                </span>
                                <strong className="block text-2xl font-black my-0.5 tracking-tight">
                                    {item.day}
                                </strong>
                                <span
                                    className={`block text-[11px] font-medium ${
                                        isSelected ? 'text-sky-100' : 'text-slate-400'
                                    }`}
                                >
                                    Tháng {item.month}
                                </span>
                                {isSelected && (
                                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#00B5F1] shadow-xs">
                                        <CheckCircle size={14} weight="fill" />
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {appointmentDate && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 sm:p-6 transition-all duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-4">
                        <div>
                            <h3 className="text-sm sm:text-base font-bold text-[#003553] flex items-center gap-2">
                                <Clock size={19} className="text-[#00B5F1]" />
                                Khung giờ khám khả dụng (30 phút/ca)
                            </h3>
                            <p className="mt-0.5 text-xs text-slate-500">
                                Vui lòng chọn khung giờ thích hợp để được tiếp đón đúng giờ.
                            </p>
                        </div>
                        {!loading && !error && available.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/60">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                Còn {available.length} khung giờ trống
                            </span>
                        )}
                    </div>

                    {slotConflict && conflictApplies && (
                        <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 font-medium leading-relaxed">
                            ⚠️ Bạn đã có lịch hẹn khác vào <strong>{slotConflict.timeSlot}</strong> trong ngày này. Khung giờ đó đã được loại trừ tự động để tránh trùng lịch.
                        </p>
                    )}

                    {error && (
                        <p role="alert" className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 font-medium">
                            {error}
                        </p>
                    )}

                    {loading ? (
                        <div role="status" className="py-10 text-center">
                            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-[#00B5F1] border-r-transparent align-[-0.125em]" />
                            <p className="mt-2 text-xs font-semibold text-slate-500">Đang kiểm tra khung giờ trống từ phòng khám...</p>
                        </div>
                    ) : (
                        <div className="mt-5 space-y-5">
                            {available.length === 0 && !error && (
                                <div role="status" className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
                                    <Clock size={32} className="mx-auto text-slate-300" />
                                    <p className="mt-2 text-sm font-bold text-slate-600">Bác sĩ không còn khung giờ trống trong ngày này</p>
                                    <p className="text-xs text-slate-400 mt-1">Vui lòng chọn ngày khác ở hàng trên để đặt lịch.</p>
                                </div>
                            )}

                            {morning.length > 0 && (
                                <SlotGroupSection
                                    period="Buổi sáng"
                                    timeRange="07:30 – 11:30"
                                    iconBadge="🌅"
                                    items={morning}
                                    selected={timeSlot}
                                    onChange={onSlotChange}
                                />
                            )}

                            {afternoon.length > 0 && (
                                <SlotGroupSection
                                    period="Buổi chiều"
                                    timeRange="13:30 – 17:00"
                                    iconBadge="🌇"
                                    items={afternoon}
                                    selected={timeSlot}
                                    onChange={onSlotChange}
                                />
                            )}
                        </div>
                    )}

                    <div className="mt-5 flex flex-wrap items-center gap-5 border-t border-slate-200/60 pt-4 text-xs text-slate-500">
                        <span className="flex items-center gap-2">
                            <span className="h-3.5 w-3.5 rounded-md border border-slate-300 bg-white shadow-2xs" />
                            Còn trống
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="h-3.5 w-3.5 rounded-md bg-[#00B5F1] shadow-2xs" />
                            Đang chọn
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="h-3.5 w-3.5 rounded-md border border-slate-200 bg-slate-100 text-[10px] text-slate-400 flex items-center justify-center font-bold">✕</span>
                            Đã kín / Quá giờ
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}

function SlotGroupSection({ period, timeRange, iconBadge, items, selected, onChange }) {
    return (
        <div className="rounded-xl bg-white p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#003553]">
                    <span className="text-base">{iconBadge}</span>
                    <span>{period}</span>
                    <span className="text-xs font-normal text-slate-400">({timeRange})</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-400">
                    {items.length} ca khả dụng
                </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {items.map((slot) => {
                    const isSelected = selected === slot.value
                    return (
                        <button
                            type="button"
                            key={slot.value}
                            disabled={!slot.available}
                            onClick={() => onChange(slot.value)}
                            className={`group relative flex items-center justify-center rounded-xl py-2.5 px-3 text-xs font-extrabold tracking-wide transition-all cursor-pointer ${
                                isSelected
                                    ? 'bg-[#00B5F1] text-white shadow-md shadow-sky-500/25 ring-2 ring-sky-300'
                                    : slot.available
                                      ? 'border border-slate-200 bg-white text-[#003553] hover:border-[#00B5F1] hover:bg-sky-50 hover:text-[#008EC2]'
                                      : 'border border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed line-through'
                            }`}
                        >
                            <span>{slot.value}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
