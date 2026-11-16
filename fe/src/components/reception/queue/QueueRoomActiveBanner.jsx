import React from 'react'
import { MedicineBoxOutlined, AppstoreOutlined } from '@ant-design/icons'

export default function QueueRoomActiveBanner({
    selectedRoomObject,
    selectedDepartmentTab,
    departmentTabs,
    queueCount,
    onClearRoomFilter,
}) {
    if (selectedRoomObject) {
        return (
            <div className="bg-sky-50/80 border border-sky-200 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs text-sky-900 shadow-2xs">
                <div className="flex items-center gap-2">
                    <MedicineBoxOutlined className="text-sky-600 font-bold text-sm" />
                    <span>
                        Đang lọc theo buồng khám: <strong>{selectedRoomObject.name} ({selectedRoomObject.code})</strong> — Bác sĩ phụ trách: <strong>{selectedRoomObject.doctorName}</strong> — Có{' '}
                        <strong>{queueCount}</strong> lượt khám
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClearRoomFilter}
                    className="text-sky-700 hover:text-sky-900 font-semibold underline cursor-pointer"
                >
                    Bỏ lọc buồng (Xem tất cả)
                </button>
            </div>
        )
    }

    if (selectedDepartmentTab) {
        const departmentName = departmentTabs.find((department) => department.id === selectedDepartmentTab)?.name
        return (
            <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl flex items-center justify-between text-xs text-slate-700 shadow-2xs">
                <div className="flex items-center gap-2">
                    <AppstoreOutlined className="text-slate-500 font-bold text-sm" />
                    <span>
                        Đang xem: <strong>{departmentName}</strong> — Có{' '}
                        <strong>{queueCount}</strong> lượt khám
                    </span>
                </div>
            </div>
        )
    }

    return null
}
