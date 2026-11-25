import React from 'react'
import { MedicineBoxOutlined, AppstoreOutlined } from '../../common/ClinicIcon'

export default function QueueRoomActiveBanner({
    selectedRoomObject,
    selectedDepartmentTab,
    departmentTabs,
    queueCount,
    onClearRoomFilter,
}) {
    if (selectedRoomObject) {
        return (
            <div className="bg-clinic-surface-alt border border-clinic-info-border px-4 py-2 rounded-[6px] flex items-center justify-between text-xs text-clinic-navy tabular-nums">
                <div className="flex items-center gap-2">
                    <MedicineBoxOutlined className="text-clinic-cta font-bold text-sm" />
                    <span>
                        Đang lọc theo buồng khám: <strong>{selectedRoomObject.name} ({selectedRoomObject.code})</strong> — Bác sĩ phụ trách: <strong>{selectedRoomObject.doctorName}</strong> — Có{' '}
                        <strong>{queueCount}</strong> lượt khám
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClearRoomFilter}
                    className="text-clinic-cta hover:text-clinic-navy font-semibold underline cursor-pointer shrink-0"
                >
                    Bỏ lọc buồng (Xem tất cả)
                </button>
            </div>
        )
    }

    if (selectedDepartmentTab) {
        const departmentName = departmentTabs.find((department) => department.id === selectedDepartmentTab)?.name
        return (
            <div className="bg-clinic-bg border border-clinic-border px-4 py-2 rounded-[6px] flex items-center justify-between text-xs text-clinic-text-secondary tabular-nums">
                <div className="flex items-center gap-2">
                    <AppstoreOutlined className="text-clinic-text-muted font-bold text-sm" />
                    <span>
                        Đang xem: <strong className="text-clinic-navy">{departmentName}</strong> — Có{' '}
                        <strong className="text-clinic-navy">{queueCount}</strong> lượt khám
                    </span>
                </div>
            </div>
        )
    }

    return null
}
