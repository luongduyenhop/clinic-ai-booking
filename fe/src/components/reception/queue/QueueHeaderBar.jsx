import React from 'react'
import { Button, Tooltip } from 'antd'
import { SyncOutlined } from '@ant-design/icons'

export default function QueueHeaderBar({ totalWaitingCount, isRefreshing, onRefresh }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-clinic-surface border border-clinic-border rounded-[6px] px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-sm font-extrabold text-clinic-navy">
                    Điều phối hàng đợi phòng khám
                </h2>
                <span className="medpro-badge-info text-[11px] font-bold tabular-nums">
                    {totalWaitingCount} đang chờ
                </span>
            </div>

            <div className="flex items-center gap-2">
                <Tooltip title="Đồng bộ hàng đợi">
                    <Button
                        size="small"
                        icon={<SyncOutlined spin={isRefreshing} />}
                        onClick={onRefresh}
                        className="medpro-btn-outline !h-8 !px-3 text-xs font-semibold flex items-center gap-1.5"
                        aria-label="Đồng bộ hàng đợi"
                    >
                        Đồng bộ
                    </Button>
                </Tooltip>
            </div>
        </div>
    )
}
