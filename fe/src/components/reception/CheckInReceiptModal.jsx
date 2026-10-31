import { Modal, Button, Tag } from 'antd'
import { PrinterOutlined, QrcodeOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useSelector } from 'react-redux'
import dayjs from 'dayjs'

export default function CheckInReceiptModal({ open, onClose, queueEntry }) {
    const { patients, departments, doctors, rooms, services } = useSelector((state) => state.reception)

    if (!queueEntry) return null

    const patient = patients.find((p) => p.id === queueEntry.patientId)
    const department = departments.find((d) => d.id === queueEntry.departmentId)
    const doctor = doctors.find((d) => d.id === queueEntry.doctorId)
    const room = rooms.find((r) => r.id === queueEntry.roomId)
    const service = services.find((s) => s.id === queueEntry.serviceId)

    const patientFullName = queueEntry.patientName || patient?.fullName || 'Bệnh nhân'
    const patientCodeStr = queueEntry.patientCode || patient?.patientCode || (queueEntry.patientId ? `BN-00${queueEntry.patientId}` : 'BN-2026')
    const patientPhoneStr = queueEntry.phone || patient?.phone || 'N/A'
    const doctorNameStr = queueEntry.doctorName || doctor?.name || 'Theo phân bổ ca'
    const roomNameStr = queueEntry.roomName || room?.name || 'Phòng khám đa khoa'

    const handlePrint = () => {
        window.print()
    }

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={480}
            footer={
                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Phiếu tiếp nhận hợp lệ trong ngày</span>
                    <div className="flex gap-2">
                        <Button onClick={onClose}>Đóng</Button>
                        <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint} className="bg-sky-600">
                            In phiếu khám
                        </Button>
                    </div>
                </div>
            }
        >
            <div id="print-area" className="py-2 px-1 text-slate-800 space-y-4">
                {/* Clinic Header */}
                <div className="text-center border-b border-dashed border-slate-300 pb-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-teal-700">Phòng Khám Đa Khoa Quốc Tế</div>
                    <div className="text-base font-extrabold text-slate-900 mt-0.5">PHIẾU TIẾP NHẬN KHÁM BỆNH</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                        Ngày {dayjs().format('DD/MM/YYYY')} - Giờ check-in: {queueEntry.checkInTime}
                    </div>
                </div>

                {/* Big Ticket Number */}
                <div className="text-center py-2 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="text-xs text-slate-500 uppercase font-semibold">Số thứ tự khám</div>
                    <div className="text-4xl font-black text-sky-600 tracking-tight my-1">
                        {queueEntry.ticketNumber}
                    </div>
                    <div className="flex items-center justify-center gap-2">
                        <Tag color={queueEntry.isWalkIn ? 'orange' : 'blue'}>
                            {queueEntry.isWalkIn ? 'Khám vãng lai (Walk-in)' : 'Có lịch hẹn trước'}
                        </Tag>
                        {queueEntry.priority === 'PRIORITY' && (
                            <Tag color="purple">Ưu tiên người cao tuổi/trẻ em</Tag>
                        )}
                    </div>
                </div>

                {/* Patient Information */}
                <div className="space-y-1.5 text-xs border-b border-slate-200 pb-3">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Người bệnh:</span>
                        <span className="font-bold text-slate-900">{patientFullName}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Mã hồ sơ:</span>
                        <span className="font-mono font-semibold">{patientCodeStr}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Số điện thoại:</span>
                        <span>{patientPhoneStr}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Đối tượng:</span>
                        <span className="font-medium text-slate-700">Khám dịch vụ tư nhân</span>
                    </div>
                </div>

                {/* Service and Room */}
                <div className="space-y-1.5 text-xs border-b border-slate-200 pb-3">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Chuyên khoa:</span>
                        <span className="font-semibold text-slate-800">{department?.name || 'Đa khoa'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Phòng khám:</span>
                        <span className="font-bold text-teal-700">{roomNameStr}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Bác sĩ khám:</span>
                        <span>{doctorNameStr}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Dịch vụ:</span>
                        <span className="font-medium">{service?.name || 'Khám bệnh'}</span>
                    </div>
                </div>

                {/* Instructions & Barcode Simulation */}
                <div className="text-center pt-1 space-y-2">
                    <div className="text-[11px] text-slate-500 italic">
                        Quý khách vui lòng ngồi chờ tại sảnh tầng phòng khám. Khi bảng điện tử hiển thị số vé {queueEntry.ticketNumber}, xin mời vào phòng.
                    </div>
                    <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
                        <QrcodeOutlined className="text-xl" />
                        <span className="font-mono text-[11px]">{queueEntry.id} - CLINIC-SYS</span>
                        <CheckCircleOutlined className="text-emerald-500 text-sm" />
                    </div>
                </div>
            </div>
        </Modal>
    )
}
