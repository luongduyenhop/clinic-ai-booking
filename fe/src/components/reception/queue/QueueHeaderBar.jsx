import React from 'react'
import { Button, Tooltip } from 'antd'
import { SyncOutlined } from '../../common/ClinicIcon'

export default function QueueHeaderBar({ isRefreshing, onRefresh }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-clinic-surface border border-clinic-border rounded-[6px] px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-sm font-extrabold text-clinic-navy">
                    Điều phối hàng đợi phòng khám
                </h2>
            </div>

            <div className="flex items-center gap-2">
                <Tooltip title="Đồng bộ hàng đợi">
                    <Button
                        size="small"
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
