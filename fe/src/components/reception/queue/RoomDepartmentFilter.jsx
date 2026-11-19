import React, { useState } from 'react'
import {
    MedicineBoxOutlined,
    ClearOutlined,
    EnvironmentOutlined,
    UserOutlined,
} from '@ant-design/icons'

export default function RoomDepartmentFilter({
    departmentTabs,
    selectedDepartmentTab,
    onSelectDepartmentTab,
    selectedRoomId,
    onSelectAllRooms,
    displayRooms,
    visibleRooms,
    roomWaitingCounts,
    getRoomsForTab,
    onSelectRoom,
}) {
    const [showRoomGrid, setShowRoomGrid] = useState(false)
    const totalAllWaiting = displayRooms.reduce((sum, room) => sum + (roomWaitingCounts[room.id] || 0), 0)
    const shouldRenderRoomGrid = Boolean(selectedDepartmentTab) || selectedRoomId !== null || showRoomGrid

    return (
        <div className="medpro-card p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <MedicineBoxOutlined className="text-clinic-cta text-sm" />
                    <h3 className="text-xs font-bold text-clinic-navy">
                        Lọc theo chuyên khoa &amp; Buồng khám
                    </h3>
                </div>
                <div className="flex items-center gap-3">
                    {!selectedDepartmentTab && selectedRoomId === null && (
                        <button
                            type="button"
                            onClick={() => setShowRoomGrid((prev) => !prev)}
                            className="text-xs text-clinic-cta hover:underline font-semibold cursor-pointer tabular-nums"
                        >
                            {showRoomGrid ? 'Ẩn lưới buồng khám' : `Xem lưới buồng khám (${displayRooms.length})`}
                        </button>
                    )}
                    {(selectedRoomId !== null || Boolean(selectedDepartmentTab)) && (
                        <button
                            type="button"
                            onClick={() => {
                                onSelectDepartmentTab('')
                                onSelectAllRooms()
                            }}
                            className="text-xs text-clinic-cta hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                            <ClearOutlined /> Xem tất cả chuyên khoa
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
                <button
                    type="button"
                    onClick={() => {
                        onSelectDepartmentTab('')
                        if (selectedRoomId !== null) {
                            onSelectAllRooms()
                        }
                    }}
                    className={`px-3 py-1 rounded-[6px] text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
                        !selectedDepartmentTab
                            ? 'bg-clinic-navy text-clinic-surface border-clinic-navy'
                            : 'bg-clinic-bg text-clinic-text-secondary border-clinic-border hover:bg-clinic-bg-muted'
                    }`}
                >
                    <span>Tất cả chuyên khoa</span>
                    <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-[4px] font-mono ${
                            !selectedDepartmentTab
                                ? 'bg-clinic-cta text-clinic-surface'
                                : totalAllWaiting > 0
                                    ? 'bg-clinic-surface-alt text-clinic-cta'
                                    : 'bg-clinic-bg-muted text-clinic-text-secondary'
                        }`}
                    >
                        {totalAllWaiting}
                    </span>
                </button>

                {departmentTabs.map((department) => {
                    const isDepartmentActive = selectedDepartmentTab === department.id
                    const departmentRooms = getRoomsForTab(department.id)
                    const departmentWaitingTotal = departmentRooms.reduce(
                        (sum, room) => sum + (roomWaitingCounts[room.id] || 0),
                        0
                    )

                    return (
                        <button
                            type="button"
                            key={department.id}
                            onClick={() => {
                                onSelectDepartmentTab(department.id)
                                if (selectedRoomId) {
                                    const activeRoom = displayRooms.find((room) => room.id === selectedRoomId)
                                    if (activeRoom && !departmentRooms.some((room) => room.id === activeRoom.id)) {
                                        onSelectAllRooms()
                                    }
                                }
                            }}
                            className={`px-3 py-1 rounded-[6px] text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
                                isDepartmentActive
                                    ? 'bg-clinic-navy text-clinic-surface border-clinic-navy'
                                    : 'bg-clinic-bg text-clinic-text-secondary border-clinic-border hover:bg-clinic-bg-muted'
                            }`}
                        >
                            <span>{department.name}</span>
                            <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-[4px] font-mono ${
                                    isDepartmentActive
                                        ? 'bg-clinic-cta text-clinic-surface'
                                        : departmentWaitingTotal > 0
                                            ? 'bg-clinic-surface-alt text-clinic-cta'
                                            : 'bg-clinic-bg-muted text-clinic-text-secondary'
                                }`}
                            >
                                {departmentWaitingTotal}
                            </span>
                        </button>
                    )
                })}
            </div>

            {shouldRenderRoomGrid && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 pt-1 border-t border-clinic-border">
                {visibleRooms.map((room) => {
                    const isSelected = selectedRoomId === room.id
                    const waitingCount = roomWaitingCounts[room.id] || 0
                    const isOverload = waitingCount >= 10

                    return (
                        <button
                            type="button"
                            key={room.id}
                            onClick={() => onSelectRoom(room)}
                            title={`${room.name} - ${room.doctorName}`}
                            className={`p-3 rounded-[6px] border text-left transition cursor-pointer flex flex-col justify-between relative group ${
                                isSelected
                                    ? 'border-clinic-cta bg-clinic-surface-alt'
                                    : isOverload
                                        ? 'border-clinic-danger-border bg-clinic-danger-bg'
                                        : 'border-clinic-border bg-clinic-surface hover:border-clinic-cta'
                            }`}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-1.5 tabular-nums">
                                    <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded-[4px] bg-clinic-bg-muted text-clinic-navy group-hover:bg-clinic-surface-alt group-hover:text-clinic-cta">
                                        {room.code}
                                    </span>
                                    <span className="text-[10px] text-clinic-text-secondary flex items-center gap-0.5">
                                        <EnvironmentOutlined className="text-[10px]" />
                                        {room.floor}
                                    </span>
                                </div>

                                <div className="text-xs font-bold text-clinic-navy line-clamp-1 leading-snug">
                                    {room.name}
                                </div>

                                <div className="text-[11px] text-clinic-text-secondary mt-1 flex items-center gap-1 line-clamp-1">
                                    <UserOutlined className="text-[10px] text-clinic-cta shrink-0" />
                                    <span className="font-medium text-clinic-text">{room.doctorName}</span>
                                </div>

                                {room.currentPatient && (
                                    <div className="mt-1 text-[10px] text-clinic-success bg-clinic-success-bg border border-clinic-success-border px-1.5 py-0.5 rounded-[4px] flex items-center gap-1 line-clamp-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-clinic-success shrink-0" />
                                        <span>Đang khám: {room.currentPatient}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-clinic-border tabular-nums">
                                <span className="text-[11px] text-clinic-text-secondary font-medium">Đang chờ:</span>
                                <div className="flex items-baseline gap-1">
                                    <span
                                        className={`text-lg font-black ${
                                            isOverload
                                                ? 'text-clinic-danger'
                                                : waitingCount > 0
                                                    ? 'text-clinic-cta'
                                                    : 'text-clinic-text-muted'
                                        }`}
                                    >
                                        {waitingCount}
                                    </span>
                                    <span className="text-[10px] text-clinic-text-muted">người</span>
                                </div>
                            </div>
                        </button>
                    )
                })}
                </div>
            )}
        </div>
    )
}
