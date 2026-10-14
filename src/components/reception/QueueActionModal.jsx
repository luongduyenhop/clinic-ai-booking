import { useState } from 'react'
import { Modal, Input, Select, Button, message, Alert } from 'antd'
import { useDispatch, useSelector } from 'react-redux'
import {
    deferQueueEntryAsync,
    transferRoomAsync,
    reorderQueueAsync,
    cancelQueueEntryAsync,
} from '../../redux/slices/reception/receptionSlice'

export default function QueueActionModal({ open, onClose, queueEntry, mode }) {
    const dispatch = useDispatch()
    const { rooms, doctors, activeRole } = useSelector((state) => state.reception)

    const [reason, setReason] = useState('')
    const [selectedRoomId, setSelectedRoomId] = useState('')
    const [selectedDoctorId, setSelectedDoctorId] = useState('')
    const [selectedPriority, setSelectedPriority] = useState('PRIORITY')
    const [isSubmitting, setIsSubmitting] = useState(false)

    if (!queueEntry) return null

    const titles = {
        DEFER: `Tạm hoãn lượt khám: ${queueEntry.ticketNumber}`,
        TRANSFER: `Chuyển phòng / dịch vụ: ${queueEntry.ticketNumber}`,
        REORDER: `Điều phối thứ tự & ưu tiên: ${queueEntry.ticketNumber}`,
        CANCEL: `Hủy lượt khám: ${queueEntry.ticketNumber}`,
    }

    const availableRooms = rooms.filter((r) => r.id !== queueEntry.roomId)

    const handleSubmit = async () => {
        if (!reason.trim()) {
            message.error('Vui lòng nhập lý do thực hiện thao tác này')
            return
        }

        setIsSubmitting(true)
        try {
            if (mode === 'DEFER') {
                await dispatch(deferQueueEntryAsync({ queueId: queueEntry.id, reason: reason.trim() }))
                message.success('Đã tạm hoãn lượt khám thành công')
            } else if (mode === 'TRANSFER') {
                if (!selectedRoomId) {
                    message.error('Vui lòng chọn phòng khám đích')
                    setIsSubmitting(false)
                    return
                }
                await dispatch(
                    transferRoomAsync({
                        queueId: queueEntry.id,
                        updates: {
                            newRoomId: selectedRoomId,
                            newDoctorId: selectedDoctorId || undefined,
                            reason: reason.trim(),
                        },
                    })
                )
                message.success('Đã chuyển phòng khám thành công')
            } else if (mode === 'REORDER') {
                await dispatch(
                    reorderQueueAsync({
                        queueId: queueEntry.id,
                        payload: { priority: selectedPriority, reason: reason.trim() },
                    })
                )
                message.success('Đã cập nhật mức ưu tiên thành công')
            } else if (mode === 'CANCEL') {
                await dispatch(cancelQueueEntryAsync({ queueId: queueEntry.id, reason: reason.trim() }))
                message.success('Đã hủy lượt khám')
            }
            setReason('')
            onClose()
        } catch (err) {
            message.error(err.message || 'Lỗi khi xử lý thao tác hàng đợi')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Modal
            title={<span className="font-bold text-slate-800">{titles[mode] || 'Thao tác hàng đợi'}</span>}
            open={open}
            onCancel={() => {
                setReason('')
                onClose()
            }}
            width={540}
            footer={
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>Hủy bỏ</Button>
                    <Button
                        type="primary"
                        onClick={handleSubmit}
                        loading={isSubmitting}
                        danger={mode === 'CANCEL'}
                        className={mode !== 'CANCEL' ? 'bg-sky-600' : ''}
                    >
                        Xác nhận thực hiện
                    </Button>
                </div>
            }
        >
            <div className="space-y-4 py-2 text-xs">
                {/* Mode DEFER */}
                {mode === 'DEFER' && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800">
                        Lượt khám sẽ được chuyển sang trạng thái <strong>TẠM HOÃN</strong>. Khi bệnh nhân quay lại, lễ tân có thể bấm <strong>"Tiếp tục"</strong> để đưa trở lại hàng đợi.
                    </div>
                )}

                {/* Mode TRANSFER */}
                {mode === 'TRANSFER' && (
                    <div className="space-y-3">
                        <div>
                            <label className="block font-bold text-slate-700 uppercase mb-1">
                                Chọn phòng khám chuyển đến <span className="text-red-500">*</span>
                            </label>
                            <Select
                                className="w-full"
                                placeholder="Chọn phòng khám đích"
                                value={selectedRoomId || undefined}
                                onChange={(val) => {
                                    setSelectedRoomId(val)
                                    const defaultDoc = doctors.find((d) => d.roomDefault === val)
                                    if (defaultDoc) setSelectedDoctorId(defaultDoc.id)
                                }}
                                options={availableRooms.map((r) => ({
                                    value: r.id,
                                    label: `${r.name} (${r.floor}) - Hiện có ${r.currentWaiting} người chờ`,
                                }))}
                            />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-700 uppercase mb-1">
                                Bác sĩ tiếp nhận (tùy chọn)
                            </label>
                            <Select
                                className="w-full"
                                placeholder="Chọn bác sĩ"
                                value={selectedDoctorId || undefined}
                                onChange={(val) => setSelectedDoctorId(val)}
                                options={doctors.map((d) => ({
                                    value: d.id,
                                    label: `${d.name} (${d.status === 'AVAILABLE' ? 'Sẵn sàng' : 'Nghỉ/Muộn'})`,
                                }))}
                            />
                        </div>
                    </div>
                )}

                {/* Mode REORDER */}
                {mode === 'REORDER' && (
                    <div className="space-y-3">
                        {activeRole !== 'RECEPTION_SUPERVISOR' && (
                            <Alert
                                message="Lưu ý quyền hạn điều phối (RC-22)"
                                description="Bạn đang thao tác với vai trò Lễ tân. Thao tác điều phối ưu tiên sẽ được gắn cờ và ghi vào nhật ký Audit Log để Giám sát ca trực hậu kiểm."
                                type="info"
                                showIcon
                            />
                        )}
                        <div>
                            <label className="block font-bold text-slate-700 uppercase mb-1">Mức ưu tiên mới:</label>
                            <Select
                                className="w-full"
                                value={selectedPriority}
                                onChange={(val) => setSelectedPriority(val)}
                                options={[
                                    { value: 'NORMAL', label: 'Bình thường (NORMAL)' },
                                    { value: 'PRIORITY', label: 'Ưu tiên đặc biệt (Người già, trẻ nhỏ, xe lăn)' },
                                ]}
                            />
                        </div>
                    </div>
                )}

                {/* Mode CANCEL */}
                {mode === 'CANCEL' && (
                    <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-800">
                        Lượt khám này sẽ bị hủy khỏi hàng đợi của phòng khám. Số lượng người chờ tại phòng sẽ tự động giảm đi 1.
                    </div>
                )}

                {/* Required Reason Input */}
                <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">
                        Lý do thực hiện <span className="text-red-500">*</span>
                    </label>
                    <Input.TextArea
                        rows={3}
                        placeholder="Vui lòng ghi rõ lý do để lưu vết vào Audit Log hệ thống..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    />
                </div>
            </div>
        </Modal>
    )
}
