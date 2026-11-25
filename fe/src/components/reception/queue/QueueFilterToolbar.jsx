import React from 'react'
import { DatePicker, Segmented, Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

export default function QueueFilterToolbar({
    activeTab,
    onTabChange,
    tabCounts,
    selectedDate,
    onDateChange,
    selectedShift,
    onShiftChange,
    searchQuery,
    onSearchChange,
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-border pb-2.5">
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
                <button
                    type="button"
                    onClick={() => onTabChange('ALL')}
                    className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition cursor-pointer ${
                        activeTab === 'ALL'
                            ? 'bg-clinic-navy text-clinic-surface'
                            : 'text-clinic-text-secondary hover:bg-clinic-bg-muted'
                    }`}
                >
                    Tất cả ({tabCounts.ALL})
                </button>
                <button
                    type="button"
                    onClick={() => onTabChange('WAITING')}
                    className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition cursor-pointer ${
                        activeTab === 'WAITING'
                            ? 'bg-clinic-navy text-clinic-surface'
                            : 'text-clinic-text-secondary hover:bg-clinic-bg-muted'
                    }`}
                >
                    Đang chờ ({tabCounts.WAITING})
                </button>
                <button
                    type="button"
                    onClick={() => onTabChange('IN_CONSULTATION')}
                    className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition cursor-pointer ${
                        activeTab === 'IN_CONSULTATION'
                            ? 'bg-clinic-navy text-clinic-surface'
                            : 'text-clinic-text-secondary hover:bg-clinic-bg-muted'
                    }`}
                >
                    Đang khám ({tabCounts.IN_CONSULTATION})
                </button>
                <button
                    type="button"
                    onClick={() => onTabChange('DEFERRED')}
                    className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition cursor-pointer ${
                        activeTab === 'DEFERRED'
                            ? 'bg-clinic-navy text-clinic-surface'
                            : 'text-clinic-text-secondary hover:bg-clinic-bg-muted'
                    }`}
                >
                    Tạm hoãn ({tabCounts.DEFERRED})
                </button>
                <button
                    type="button"
                    onClick={() => onTabChange('COMPLETED')}
                    className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition cursor-pointer ${
                        activeTab === 'COMPLETED'
                            ? 'bg-clinic-navy text-clinic-surface'
                            : 'text-clinic-text-secondary hover:bg-clinic-bg-muted'
                    }`}
                >
                    Hoàn tất ({tabCounts.COMPLETED})
                </button>
                <button
                    type="button"
                    onClick={() => onTabChange('WAITLIST')}
                    className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        activeTab === 'WAITLIST'
                            ? 'bg-clinic-amber text-clinic-navy'
                            : 'text-clinic-warning hover:bg-clinic-warning-bg'
                    }`}
                >
                    <span>Danh sách chờ (Waitlist)</span>
                    <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-[4px] font-mono ${
                            activeTab === 'WAITLIST'
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'bg-clinic-warning-bg text-clinic-warning border border-clinic-warning-border'
                        }`}
                    >
                        {tabCounts.WAITLIST}
                    </span>
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <DatePicker
                    value={selectedDate ? dayjs(selectedDate) : null}
                    onChange={(date) => {
                        const formattedDate = date ? date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
                        onDateChange(formattedDate)
                    }}
                    format="DD/MM/YYYY"
                    allowClear={false}
                    className="w-32 text-xs rounded-[6px]"
                />
                <Segmented
                    value={selectedShift}
                    onChange={onShiftChange}
                    options={[
                        { label: 'Tất cả ca', value: 'all' },
                        { label: 'Ca sáng', value: 'sang' },
                        { label: 'Ca chiều', value: 'chieu' },
                    ]}
                    className="text-xs bg-clinic-bg-muted p-0.5 rounded-[6px] font-medium"
                />
                <Input
                    placeholder="Số vé (A101, TMH-01), tên BN, SĐT..."
                    prefix={<SearchOutlined className="text-clinic-text-muted" />}
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    allowClear
                    className="w-64 text-xs rounded-[6px]"
                />
            </div>
        </div>
    )
}
