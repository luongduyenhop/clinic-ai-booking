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
    const morning = available.filter((slot) => Number(slot.value.slice(0, 2)) < 12)
    const afternoon = available.filter((slot) => Number(slot.value.slice(0, 2)) >= 12)

    return (
        <div className="space-y-6">
            <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-clinic-navy flex items-center gap-2">
                            <CalendarCheck size={19} className="text-clinic-cta" />
                            <span>Chọn ngày khám</span>
                        </h2>
                        <p className="mt-1 text-xs sm:text-sm text-clinic-text-secondary">
                            Lịch khả dụng trong 7 ngày tới hoặc chọn ngày khác qua ô lịch.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <label htmlFor="booking-other-date" className="text-xs font-semibold text-clinic-text-secondary">
                            Ngày khác:
                        </label>
                        <input
                            id="booking-other-date"
                            type="date"
                            className="medpro-input !w-auto !px-2.5 !py-1.5 text-xs tabular-nums"
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
                                className={`relative rounded-[8px] border p-3 text-center transition-colors cursor-pointer ${
                                    isSelected
                                        ? 'border-clinic-navy bg-clinic-navy text-clinic-surface'
                                        : 'border-clinic-border bg-clinic-surface text-clinic-navy hover:border-clinic-cta hover:bg-clinic-surface-tint'
                                }`}
                            >
                                <span
                                    className={`block text-[11px] font-bold uppercase tracking-wider ${
                                        isSelected ? 'text-clinic-on-navy-muted' : 'text-clinic-text-muted'
                                    }`}
                                >
                                    {item.weekday}
                                </span>
                                <strong className="block text-xl font-extrabold my-0.5 tabular-nums">
                                    {item.day}
                                </strong>
                                <span
                                    className={`block text-[11px] font-medium tabular-nums ${
                                        isSelected ? 'text-clinic-on-navy-muted' : 'text-clinic-text-muted'
                                    }`}
                                >
                                    Tháng {item.month}
                                </span>
                                {isSelected && (
                                    <span className="absolute right-1.5 top-1.5 text-clinic-surface">
                                        <CheckCircle size={13} weight="fill" />
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {appointmentDate && (
                <div className="border-t border-clinic-border pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-border pb-4">
                        <div>
                            <h3 className="text-sm sm:text-base font-bold text-clinic-navy flex items-center gap-2">
                                <Clock size={18} className="text-clinic-cta" />
                                <span>Khung giờ khám khả dụng (30 phút/ca)</span>
                            </h3>
                            <p className="mt-0.5 text-xs text-clinic-text-secondary">
                                Vui lòng chọn khung giờ thích hợp để được tiếp nhận đúng giờ tại quầy.
                            </p>
                        </div>
                        {!loading && !error && available.length > 0 && (
                            <span className="medpro-badge-success tabular-nums">
                                Còn {available.length} khung giờ trống
                            </span>
                        )}
                    </div>

                    {slotConflict && conflictApplies && (
                        <p
                            role="alert"
                            className="mt-4 rounded-[8px] border border-clinic-warning-border bg-clinic-warning-bg p-3.5 text-xs text-clinic-warning font-medium leading-relaxed"
                        >
                            Bạn đã có lịch hẹn khác vào <strong className="tabular-nums">{slotConflict.timeSlot}</strong> trong ngày này. Khung giờ đó đã được loại trừ tự động để tránh trùng lịch.
                        </p>
                    )}

                    {error && (
                        <p
                            role="alert"
                            className="mt-4 rounded-[8px] bg-clinic-danger-bg border border-clinic-danger-border p-3.5 text-xs text-clinic-danger font-medium"
                        >
                            {error}
                        </p>
                    )}

                    {loading ? (
                        <div role="status" className="py-10 text-center">
                            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-clinic-cta border-r-transparent align-[-0.125em]" />
                            <p className="mt-2 text-xs font-semibold text-clinic-text-secondary">
                                Đang kiểm tra khung giờ trống từ phòng khám...
                            </p>
                        </div>
                    ) : (
                        <div className="mt-5 space-y-5">
                            {available.length === 0 && !error && (
                                <div role="status" className="rounded-[8px] border border-dashed border-clinic-border-strong bg-clinic-bg p-6 text-center">
                                    <Clock size={28} className="mx-auto text-clinic-text-muted" />
                                    <p className="mt-2 text-sm font-bold text-clinic-navy">
                                        Bác sĩ không còn khung giờ trống trong ngày này
                                    </p>
                                    <p className="text-xs text-clinic-text-secondary mt-1">
                                        Vui lòng chọn ngày khác ở hàng trên để đặt lịch.
                                    </p>
                                </div>
                            )}

                            {morning.length > 0 && (
                                <SlotGroupSection
                                    period="Buổi sáng"
                                    timeRange="07:30 – 11:30"
                                    items={morning}
                                    selected={timeSlot}
                                    onChange={onSlotChange}
                                />
                            )}

                            {afternoon.length > 0 && (
                                <SlotGroupSection
                                    period="Buổi chiều"
                                    timeRange="13:30 – 17:00"
                                    items={afternoon}
                                    selected={timeSlot}
                                    onChange={onSlotChange}
                                />
                            )}
                        </div>
                    )}

                    <div className="mt-5 flex flex-wrap items-center gap-5 border-t border-clinic-border pt-4 text-xs text-clinic-text-secondary">
                        <span className="flex items-center gap-2">
                            <span className="h-3.5 w-3.5 rounded-[4px] border border-clinic-border-strong bg-clinic-surface" />
                            <span>Còn trống</span>
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="h-3.5 w-3.5 rounded-[4px] bg-clinic-cta" />
                            <span>Đang chọn</span>
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="h-3.5 w-3.5 rounded-[4px] border border-clinic-border bg-clinic-bg-muted" />
                            <span>Đã kín / Quá giờ</span>
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}

function SlotGroupSection({ period, timeRange, items, selected, onChange }) {
    return (
        <div className="rounded-[8px] bg-clinic-surface p-4 border border-clinic-border">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-clinic-navy">
                    <span>{period}</span>
                    <span className="text-xs font-normal text-clinic-text-muted tabular-nums">({timeRange})</span>
                </div>
                <span className="text-[11px] font-semibold text-clinic-text-muted tabular-nums">
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
                            className={`flex items-center justify-center rounded-[6px] border py-2 px-3 text-xs font-bold tracking-wide tabular-nums transition-colors cursor-pointer ${
                                isSelected
                                    ? 'border-clinic-cta bg-clinic-cta text-clinic-surface'
                                    : slot.available
                                      ? 'border-clinic-border-strong bg-clinic-bg text-clinic-navy hover:border-clinic-cta hover:bg-clinic-surface-alt hover:text-clinic-cta'
                                      : 'border-clinic-border bg-clinic-bg-muted text-clinic-text-subtle cursor-not-allowed line-through'
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
