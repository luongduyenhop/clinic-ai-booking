import { Modal, Button } from 'antd'
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
            width={480}
            footer={
                <div className="flex items-center justify-between no-print gap-3 w-full">
                    <div className="flex items-center gap-1.5 text-xs text-black whitespace-nowrap">
                        <span className="font-medium">Trạng thái:</span>
                        <span className="px-2 py-0.5 border border-black rounded text-xs font-bold text-black bg-white">
                            {statusLabel}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button onClick={onClose}>Đóng</Button>
                        <Button
                            type="primary"
                            icon={<PrinterOutlined />}
                            onClick={handlePrint}
                            className="bg-black hover:bg-neutral-800 text-white font-medium border-black"
                        >
                            In phiếu nhiệt (80mm)
                        </Button>
                    </div>
                </div>
            }
        >
            <style>{`
                @media print {
                    @page {
                        size: auto;
                        margin: 10mm;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #thermal-print-area, #thermal-print-area * {
                        visibility: visible !important;
                        color: #000 !important;
                        border-color: #000 !important;
                    }
                    #thermal-print-area {
                        position: absolute !important;
                        left: 50% !important;
                        top: 10mm !important;
                        transform: translateX(-50%) !important;
                        width: 80mm !important;
                        max-width: 80mm !important;
                        margin: 0 auto !important;
                        padding: 4mm !important;
                        background: #fff !important;
                        box-shadow: none !important;
                        border: 1px dashed #000 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            <div id="thermal-print-area" className="py-2 px-3 text-black space-y-3 font-sans max-w-[80mm] mx-auto bg-white border border-dashed border-black rounded-lg">
                {/* Clinic Header */}
                <div className="text-center border-b-2 border-dashed border-black pb-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-black">PHÒNG KHÁM ĐA KHOA QUỐC TẾ</div>
                    <div className="text-sm font-black text-black mt-0.5 uppercase tracking-wide">
                        {queueEntry.is_waitlist ? "PHIẾU GHI DANH DANH SÁCH CHỜ (WAITLIST)" : "PHIẾU TIẾP NHẬN & SỐ THỨ TỰ KHÁM"}
                    </div>
                    <div className="text-[11px] text-black mt-0.5 font-mono">
                        Ngày {dayjs().format('DD/MM/YYYY')} • {checkInTime}
                    </div>
                </div>

                {/* Big Thermal Ticket Number */}
                <div className="text-center py-2.5 bg-white rounded-xl border-2 border-dashed border-black">
                    <div className="text-[11px] text-black uppercase font-bold tracking-wider">
                        {queueEntry.is_waitlist ? "MÃ SỐ CHỜ (WAITLIST)" : "MÃ SỐ THỨ TỰ (STT BUỒNG KHÁM)"}
                    </div>
                    <div className="text-5xl font-black text-black tracking-tight my-1 font-mono">
                        {ticketNumber}
                    </div>
                    <div className="flex items-center justify-center gap-1.5 flex-wrap pt-0.5">
                        <span className="px-2 py-0.5 border border-black rounded text-[11px] font-bold text-black">
                            {statusLabel}
                        </span>
                        <span className="px-2 py-0.5 border border-black rounded text-[11px] font-medium text-black">
                            {queueEntry.is_waitlist ? "Danh sách chờ (Waitlist)" : (queueEntry.isWalkIn ? "Khám vãng lai" : "Có hẹn trước")}
                        </span>
                        {queueEntry.priority === 'EMERGENCY' && (
                            <span className="px-2 py-0.5 border-2 border-black rounded text-[11px] font-black text-black uppercase bg-black text-white">
                                Cấp cứu
                            </span>
                        )}
                        {queueEntry.priority === 'PRIORITY' && (
                            <span className="px-2 py-0.5 border border-black rounded text-[11px] font-bold text-black">
                                Ưu tiên
                            </span>
                        )}
                    </div>
                </div>

                {/* Patient Information */}
                <div className="space-y-1.5 text-xs border-b border-dashed border-black pb-2.5">
                    <div className="flex justify-between items-start gap-2">
                        <span className="text-black font-medium shrink-0">Họ và tên:</span>
                        <span className="font-black text-black text-sm uppercase text-right">{patientName}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                        <span className="text-black font-medium shrink-0">Số điện thoại:</span>
                        <span className="font-bold font-mono text-black text-right">{patientPhone}</span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                        <span className="text-black font-medium shrink-0">Chuyên khoa:</span>
                        <span className="font-bold text-black text-right">{departmentName}</span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                        <span className="text-black font-medium shrink-0">Buồng / Phòng khám:</span>
                        <span className="font-bold text-black text-right">{roomName}</span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                        <span className="text-black font-medium shrink-0">Bác sĩ tiếp nhận:</span>
                        <span className="font-bold text-black text-right">{doctorName}</span>
                    </div>
                </div>

                {/* Thermal Instructions & Barcode Simulation */}
                <div className="text-center pt-1 space-y-1.5">
                    <div className="text-[11px] text-black font-normal leading-relaxed">
                        Quý khách vui lòng chú ý lắng nghe loa gọi số hoặc theo dõi bảng điện tử hiển thị mã <strong className="font-black">{ticketNumber}</strong> để vào buồng khám.
                    </div>
                    <div className="flex items-center justify-center gap-2 text-black text-xs pt-1">
                        <QrcodeOutlined className="text-base" />
                        <span className="font-mono text-[11px] font-medium">{queueEntry.id || ticketNumber} • {departmentName}</span>
                        <CheckCircleOutlined className="text-sm" />
                    </div>
                </div>
            </div>
        </Modal>
    )
}
