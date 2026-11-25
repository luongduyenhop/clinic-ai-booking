import React from 'react'
import { DatePicker, Segmented, Input } from 'antd'
import { SearchOutlined } from '../../common/ClinicIcon'
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
    const statusTabs = [
        { key: 'ALL', label: `Tất cả (${tabCounts.ALL})` },
        { key: 'WAITING', label: `Đang chờ (${tabCounts.WAITING})` },
        { key: 'IN_CONSULTATION', label: `Đang khám (${tabCounts.IN_CONSULTATION})` },
        { key: 'DEFERRED', label: `Tạm hoãn (${tabCounts.DEFERRED})` },
        { key: 'COMPLETED', label: `Hoàn tất (${tabCounts.COMPLETED})` },
        { key: 'WAITLIST', label: `Danh sách chờ (${tabCounts.WAITLIST})` },
    ]

    return (
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-clinic-border pb-2.5">
            <div className="flex flex-wrap items-center gap-1 tabular-nums">
                {statusTabs.map((tab) => {
                    const isActive = activeTab === tab.key
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => onTabChange(tab.key)}
                            className={`h-8 px-3 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer inline-flex items-center ${
                                isActive
                                    ? 'bg-clinic-navy text-clinic-surface'
                                    : 'text-clinic-text-secondary hover:bg-clinic-bg-muted hover:text-clinic-navy'
                            }`}
                        >
                            {tab.label}
                        </button>
                    )
                })}
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
                        { label: 'Mọi ca', value: 'all' },
                        { label: 'Ca sáng', value: 'sang' },
                        { label: 'Ca chiều', value: 'chieu' },
                    ]}
                    className="text-xs bg-clinic-bg-muted rounded-[6px] font-medium"
                />
                <Input
                    placeholder="Tìm số vé, tên BN, SĐT..."
                    prefix={<SearchOutlined className="text-clinic-text-muted" />}
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    allowClear
                    className="w-56 text-xs rounded-[6px]"
                />
            </div>
        </div>
    )
}
