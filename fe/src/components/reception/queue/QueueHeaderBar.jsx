import React from 'react'
import { Badge, Tooltip, Button } from 'antd'
import { SyncOutlined } from '@ant-design/icons'

export default function QueueHeaderBar({ totalWaitingCount, isRefreshing, onRefresh }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 medpro-card p-4">
            <div>
                <h2 className="text-sm font-extrabold text-[#003553] uppercase tracking-wide flex items-center gap-2">
                    <span>Điều phối hàng đợi phòng khám</span>
                    <Badge
                        count={totalWaitingCount}
                        overflowCount={99}
                        style={{ backgroundColor: '#00B5F1' }}
                    />
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                    Theo dõi luân chuyển người bệnh theo thời gian thực tại các buồng khám chuyên khoa
                </p>
            </div>

            <div className="flex items-center gap-2">
                <Tooltip title="Đồng bộ hàng đợi">
                    <Button
                        size="middle"
                        shape="circle"
                        icon={<SyncOutlined spin={isRefreshing} />}
                        onClick={onRefresh}
                        className="medpro-btn-outline !w-8 !h-8 !p-0 flex items-center justify-center"
                        aria-label="Đồng bộ hàng đợi"
                    />
                </Tooltip>
            </div>
        </div>
    )
}
