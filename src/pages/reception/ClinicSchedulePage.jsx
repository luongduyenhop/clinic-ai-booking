import { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Card, Tag, Select, DatePicker, Button, Alert, Badge, Space } from 'antd'
import {
    ScheduleOutlined,
    UserOutlined,
    ClockCircleOutlined,
    WarningOutlined,
    AlertOutlined,
    CheckCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { initialTimeSlots } from '../../utils/constants/receptionConstants'

export default function ClinicSchedulePage() {
    const { doctors, departments, rooms, appointments } = useSelector((state) => state.reception)

    const [selectedDep, setSelectedDep] = useState('')
    const [selectedDate, setSelectedDate] = useState('2026-10-12')

    const filteredDoctors = doctors.filter((d) => !selectedDep || d.departmentId === selectedDep)

    return (
        <div className="space-y-6">
            {/* Header and Filter */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">Lịch làm việc & Nguồn lực phòng khám</h2>
                        <span className="text-xs text-slate-500">
                            Theo dõi ca trực của bác sĩ, trạng thái phòng khám và cảnh báo lịch khám bị ảnh hưởng
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
                    <DatePicker
                        format="DD/MM/YYYY"
                        value={dayjs(selectedDate)}
                        onChange={(d) => setSelectedDate(d ? d.format('YYYY-MM-DD') : '2026-10-12')}
                    />
                    <Select
                        className="w-56"
                        placeholder="Tất cả chuyên khoa"
                        value={selectedDep || undefined}
                        onChange={(val) => setSelectedDep(val || '')}
                        allowClear
                        options={departments.map((d) => ({ value: d.id, label: d.name }))}
                    />
                </div>
            </div>

            {/* Critical Resource Alerts (RC-08, RC-23, RC-24) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Alert
                    message="Bác sĩ Vũ Ngọc Bích nghỉ đột xuất (RC-08)"
                    description="Bác sĩ thuộc Khoa TMH xin nghỉ ốm hôm nay. Có 5 lịch hẹn đã đặt và 2 bệnh nhân tại phòng cần phương án đổi sang BS. Lê Hoàng Long."
                    type="error"
                    showIcon
                    action={
                        <Button size="small" danger>
                            Xem 5 lịch bị ảnh hưởng
                        </Button>
                    }
                />
                <Alert
                    message="Phòng 202 - Nội soi TMH đang bảo dưỡng máy (RC-24)"
                    description="Thiết bị nội soi ống mềm đang bảo trì định kỳ dự kiến hoàn tất lúc 14:00. Vui lòng không điều phối bệnh nhân nội soi vào phòng 202 sáng nay."
                    type="warning"
                    showIcon
                />
            </div>

            {/* Doctors Grid with status */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredDoctors.map((doc) => {
                    const dep = departments.find((d) => d.id === doc.departmentId)
                    const room = rooms.find((r) => r.id === doc.roomDefault)
                    const docAppointments = appointments.filter(
                        (a) => a.doctorId === doc.id && a.appointmentDate === selectedDate && a.status !== 'CANCELLED'
                    )

                    const isAvailable = doc.status === 'AVAILABLE'
                    const isOnLeave = doc.status === 'ON_LEAVE'
                    const isLate = doc.status === 'LATE'

                    return (
                        <div
                            key={doc.id}
                            className={`p-4 rounded-2xl border transition shadow-2xs space-y-3 ${
                                isOnLeave
                                    ? 'bg-red-50/40 border-red-200'
                                    : isLate
                                    ? 'bg-amber-50/40 border-amber-200'
                                    : 'bg-white border-slate-200/90'
                            }`}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h4 className="font-bold text-slate-900 text-sm">{doc.name}</h4>
                                    <span className="text-[11px] text-slate-500">{dep?.name}</span>
                                </div>
                                <Tag
                                    color={isOnLeave ? 'error' : isLate ? 'warning' : 'success'}
                                    className="mr-0 text-[10px] font-bold"
                                >
                                    {isOnLeave ? 'Nghỉ phép' : isLate ? 'Đến muộn 30p' : 'Đang trực'}
                                </Tag>
                            </div>

                            <div className="text-xs text-slate-600 space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Phòng trực:</span>
                                    <span className="font-semibold text-slate-800">{room?.name || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Ca trực:</span>
                                    <span>{doc.shift}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Số lịch đã nhận:</span>
                                    <span className="font-bold text-sky-700">{docAppointments.length} bệnh nhân</span>
                                </div>
                            </div>

                            {doc.note && (
                                <div className="p-2 rounded-lg bg-white/80 border border-slate-200/60 text-[11px] text-slate-600 italic">
                                    {doc.note}
                                </div>
                            )}

                            {/* Slot occupation preview */}
                            <div className="pt-2 border-t border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">
                                    Khung giờ bận ({docAppointments.length})
                                </span>
                                <div className="flex flex-wrap gap-1">
                                    {docAppointments.slice(0, 4).map((a) => (
                                        <span
                                            key={a.id}
                                            className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono"
                                        >
                                            {a.timeSlot.split(' - ')[0]}
                                        </span>
                                    ))}
                                    {docAppointments.length > 4 && (
                                        <span className="text-[10px] text-slate-400 font-semibold self-center">
                                            +{docAppointments.length - 4} nữa
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Room Availability Overview */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <h3 className="text-sm font-bold text-slate-800">Trạng thái hạ tầng các phòng khám (8 Phòng)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {rooms.map((room) => {
                        const dep = departments.find((d) => d.id === room.departmentId)
                        const isOverloaded = room.currentWaiting >= room.capacity
                        const isMaintenance = room.status === 'MAINTENANCE'

                        return (
                            <div
                                key={room.id}
                                className={`p-3.5 rounded-xl border space-y-2 ${
                                    isMaintenance
                                        ? 'bg-slate-50 border-slate-300 opacity-70'
                                        : isOverloaded
                                        ? 'bg-red-50/50 border-red-200'
                                        : 'bg-white border-slate-200'
                                }`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800">{room.name}</span>
                                    <Tag
                                        color={isMaintenance ? 'default' : isOverloaded ? 'error' : 'processing'}
                                        className="mr-0 text-[10px]"
                                    >
                                        {isMaintenance ? 'Bảo trì' : isOverloaded ? 'Quá tải' : 'Sẵn sàng'}
                                    </Tag>
                                </div>
                                <div className="text-slate-500 text-[11px]">{dep?.name} - {room.floor}</div>
                                <div className="flex justify-between text-[11px] text-slate-600">
                                    <span>Đang chờ: <strong>{room.currentWaiting}</strong></span>
                                    <span>Công suất tối ưu: <strong>{room.capacity}</strong></span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
