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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2EDF5] pb-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => onTabChange('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        activeTab === 'ALL'
                            ? 'bg-[#00B5F1] text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    Tất cả ({tabCounts.ALL})
                </button>
                <button
                    type="button"
                    onClick={() => onTabChange('WAITING')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        activeTab === 'WAITING'
                            ? 'bg-[#00B5F1] text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    Đang chờ ({tabCounts.WAITING})
                </button>
                <button
                    type="button"
                    onClick={() => onTabChange('IN_CONSULTATION')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        activeTab === 'IN_CONSULTATION'
                            ? 'bg-[#00B5F1] text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    Đang khám ({tabCounts.IN_CONSULTATION})
                </button>
                <button
                    type="button"
                    onClick={() => onTabChange('DEFERRED')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        activeTab === 'DEFERRED'
                            ? 'bg-[#00B5F1] text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    Tạm hoãn ({tabCounts.DEFERRED})
                </button>
                <button
                    type="button"
                    onClick={() => onTabChange('COMPLETED')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        activeTab === 'COMPLETED'
                            ? 'bg-[#00B5F1] text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    Hoàn tất ({tabCounts.COMPLETED})
                </button>
                <button
                    type="button"
                    onClick={() => onTabChange('WAITLIST')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        activeTab === 'WAITLIST'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-amber-700 hover:bg-amber-50'
                    }`}
                >
                    <span>Danh sách chờ (Waitlist)</span>
                    <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            activeTab === 'WAITLIST'
                                ? 'bg-amber-700 text-white'
                                : 'bg-amber-100 text-amber-800'
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
                    className="w-32 text-xs rounded-xl"
                />
                <Segmented
                    value={selectedShift}
                    onChange={onShiftChange}
                    options={[
                        { label: 'Tất cả ca', value: 'all' },
                        { label: 'Ca sáng', value: 'sang' },
                        { label: 'Ca chiều', value: 'chieu' },
                    ]}
                    className="text-xs bg-slate-100 p-0.5 rounded-xl font-medium"
                />
                <Input
                    placeholder="Số vé (A101, TMH-01), tên BN, SĐT..."
                    prefix={<SearchOutlined className="text-slate-400" />}
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    allowClear
                    className="w-64 text-xs rounded-xl"
                />
            </div>
        </div>
    )
}
