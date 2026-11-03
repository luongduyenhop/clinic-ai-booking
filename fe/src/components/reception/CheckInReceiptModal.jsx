import { Modal, Button, Tag } from 'antd'
import { PrinterOutlined, QrcodeOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useSelector } from 'react-redux'
import dayjs from 'dayjs'

const STATUS_TEXT_MAP = {
    CHO_KHAM: 'Chờ khám',
    cho_kham: 'Chờ khám',
    WAITING: 'Chờ khám',
    DANG_KHAM: 'Đang khám',
    dang_kham: 'Đang khám',
    DANG_GOI: 'Đang gọi vào',
    dang_goi: 'Đang gọi vào',
    CHO_CLS: 'Chờ kết quả CLS',
    cho_cls: 'Chờ kết quả CLS',
    DA_KHAM: 'Đã hoàn tất',
    da_kham: 'Đã hoàn tất',
    HOAN_TAT: 'Đã hoàn tất',
    VANG_MAT: 'Vắng mặt',
    vang_mat: 'Vắng mặt',
}

export default function CheckInReceiptModal({ open, onClose, queueEntry }) {
    const { patients, departments, doctors, rooms } = useSelector((state) => state.reception)

    if (!queueEntry) return null

    const ticketNumber = queueEntry.ma_so_thu_tu || queueEntry.ticketNumber || `STT-${queueEntry.so_thu_tu_kham || '01'}`
    const patientName = queueEntry.patientName || queueEntry.ten_benh_nhan || patients.find((p) => p.id === queueEntry.patientId)?.fullName || 'Bệnh nhân'
    const patientPhone = queueEntry.phone || queueEntry.so_dien_thoai || patients.find((p) => p.id === queueEntry.patientId)?.phone || 'N/A'
    const departmentName = queueEntry.departmentName || departments.find((d) => d.id === queueEntry.departmentId)?.name || 'Khoa khám bệnh'
    const roomName = queueEntry.roomName || queueEntry.phong_kham || rooms.find((r) => r.id === queueEntry.roomId)?.name || 'Phòng khám đa khoa'
    const doctorName = queueEntry.doctorName || queueEntry.ten_bac_si || doctors.find((d) => d.id === queueEntry.doctorId)?.name || 'Bác sĩ trực ca'
    const checkInTime = queueEntry.checkInTime || dayjs().format('HH:mm')
    const rawStatus = queueEntry.status || queueEntry.trang_thai || 'CHO_KHAM'
    const statusLabel = STATUS_TEXT_MAP[rawStatus] || 'Chờ khám'

    const handlePrint = () => {
        window.print()
    }

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={520}
            footer={
                <div className="flex items-center justify-between no-print gap-3 w-full">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap">
                        <span>Trạng thái:</span>
                        <Tag color="cyan" className="m-0 font-medium text-xs">
                            {statusLabel}
                        </Tag>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button onClick={onClose}>Đóng</Button>
                        <Button
                            type="primary"
                            icon={<PrinterOutlined />}
                            onClick={handlePrint}
                            className="bg-sky-600 font-medium"
                        >
                            In phiếu nhiệt (80mm)
                        </Button>
                    </div>
                </div>
            }
        >
            <style>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #thermal-print-area, #thermal-print-area * {
                        visibility: visible !important;
                    }
                    #thermal-print-area {
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 76mm !important;
                        margin: 0 !important;
                        padding: 4mm !important;
                        background: #fff !important;
                        color: #000 !important;
                        font-family: monospace, sans-serif !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            <div id="thermal-print-area" className="py-2 px-1 text-slate-800 space-y-3 font-sans">
                {/* Clinic Header */}
                <div className="text-center border-b-2 border-dashed border-slate-300 pb-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-teal-700">PHÒNG KHÁM ĐA KHOA QUỐC TẾ</div>
                    <div className="text-sm font-extrabold text-slate-900 mt-0.5">{queueEntry.is_waitlist ? "PHIẾU GHI DANH DANH SÁCH CHỜ (WAITLIST)" : "PHIẾU TIẾP NHẬN & SỐ THỨ TỰ KHÁM"}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        Ngày {dayjs().format('DD/MM/YYYY')} • {checkInTime}
                    </div>
                </div>

                {/* Big Thermal Ticket Number */}
                <div className="text-center py-2.5 bg-slate-50 rounded-2xl border-2 border-dashed border-sky-300">
                    <div className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">{queueEntry.is_waitlist ? "MÃ SỐ CHỜ (WAITLIST)" : "MÃ SỐ THỨ TỰ (STT BUỒNG KHÁM)"}</div>
                    <div className="text-4xl md:text-5xl font-black text-sky-700 tracking-tight my-1 font-mono">
                        {ticketNumber}
                    </div>
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <Tag color="cyan" className="font-bold text-[11px]">
                            {statusLabel}
                        </Tag>
                        <Tag color={queueEntry.isWalkIn ? 'orange' : 'blue'} className="text-[11px]">
                        <Tag color={queueEntry.is_waitlist ? "gold" : (queueEntry.isWalkIn ? "orange" : "blue")} className="text-[11px]">{queueEntry.is_waitlist ? "Danh sách chờ (Waitlist)" : (queueEntry.isWalkIn ? "Khám vãng lai" : "Có hẹn trước")}</Tag>
                        </Tag>
                        {queueEntry.priority === 'EMERGENCY' && (
                            <Tag color="red" className="font-bold text-[11px]">Cấp cứu</Tag>
                        )}
                        {queueEntry.priority === 'PRIORITY' && (
                            <Tag color="purple" className="text-[11px]">Ưu tiên</Tag>
                        )}
                    </div>
                </div>

                {/* Patient Information */}
                <div className="space-y-1.5 text-xs border-b border-dashed border-slate-300 pb-2.5">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Họ và tên:</span>
                        <span className="font-extrabold text-slate-900 text-sm uppercase">{patientName}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Số điện thoại:</span>
                        <span className="font-semibold font-mono">{patientPhone}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Chuyên khoa:</span>
                        <span className="font-bold text-sky-800">{departmentName}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Buồng / Phòng khám:</span>
                        <span className="font-bold text-teal-700">{roomName}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Bác sĩ tiếp nhận:</span>
                        <span className="font-medium">{doctorName}</span>
                    </div>
                </div>

                {/* Thermal Instructions & Barcode Simulation */}
                <div className="text-center pt-1 space-y-1.5">
                    <div className="text-[11px] text-slate-600 font-medium leading-relaxed">
                        Quý khách vui lòng chú ý lắng nghe loa gọi số hoặc theo dõi bảng điện tử hiển thị mã <strong>{ticketNumber}</strong> để vào buồng khám.
                    </div>
                    <div className="flex items-center justify-center gap-2 text-slate-400 text-xs pt-1">
                        <QrcodeOutlined className="text-xl" />
                        <span className="font-mono text-[11px]">{queueEntry.id || ticketNumber} • {departmentName}</span>
                        <CheckCircleOutlined className="text-emerald-500 text-sm" />
                    </div>
                </div>
            </div>
        </Modal>
    )
}
