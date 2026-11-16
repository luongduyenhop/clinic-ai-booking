import React from 'react'
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
    return (
        <div className="medpro-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#E2EDF5] pb-2.5">
                <div className="flex items-center gap-2">
                    <MedicineBoxOutlined className="text-[#00B5F1] text-sm" />
                    <h3 className="text-xs font-bold text-[#003553] uppercase tracking-wider">
                        Buồng khám theo chuyên khoa & Bác sĩ trực
                    </h3>
                </div>
                {selectedRoomId !== null && (
                    <button
                        type="button"
                        onClick={onSelectAllRooms}
                        className="text-xs text-[#00B5F1] hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                        <ClearOutlined /> Xem toàn bộ buồng khám
                    </button>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
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
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                isDepartmentActive
                                    ? 'bg-slate-800 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                            }`}
                        >
                            <span>{department.name}</span>
                            <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                    isDepartmentActive
                                        ? 'bg-sky-500 text-white'
                                        : departmentWaitingTotal > 0
                                            ? 'bg-sky-100 text-sky-700'
                                            : 'bg-slate-200 text-slate-500'
                                }`}
                            >
                                {departmentWaitingTotal}
                            </span>
                        </button>
                    )
                })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pt-1">
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
                            className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between relative group ${
                                isSelected
                                    ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-200 shadow-xs'
                                    : isOverload
                                        ? 'border-rose-300 bg-rose-50/60 hover:bg-rose-50'
                                        : 'border-slate-200 bg-white hover:border-sky-300 hover:shadow-2xs'
                            }`}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 group-hover:bg-sky-100 group-hover:text-sky-800">
                                        {room.code}
                                    </span>
                                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                        <EnvironmentOutlined className="text-[10px]" />
                                        {room.floor}
                                    </span>
                                </div>

                                <div className="text-xs font-bold text-slate-800 line-clamp-1 leading-snug">
                                    {room.name}
                                </div>

                                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 line-clamp-1">
                                    <UserOutlined className="text-[10px] text-sky-600 shrink-0" />
                                    <span className="font-medium text-slate-700">{room.doctorName}</span>
                                </div>

                                {room.currentPatient && (
                                    <div className="mt-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1 line-clamp-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                        <span>Đang khám: {room.currentPatient}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-slate-100">
                                <span className="text-[11px] text-slate-400 font-medium">Đang chờ:</span>
                                <div className="flex items-baseline gap-1">
                                    <span
                                        className={`text-lg font-black ${
                                            isOverload
                                                ? 'text-rose-600'
                                                : waitingCount > 0
                                                    ? 'text-sky-700'
                                                    : 'text-slate-400'
                                        }`}
                                    >
                                        {waitingCount}
                                    </span>
                                    <span className="text-[10px] text-slate-400">người</span>
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
