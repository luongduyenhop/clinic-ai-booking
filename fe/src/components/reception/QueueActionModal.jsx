import { useState, useMemo } from 'react'
import { Modal, Input, Select, Button, message, Alert } from 'antd'
import { useDispatch, useSelector } from 'react-redux'
import {
    deferQueueEntryAsync,
    transferRoomAsync,
    reorderQueueAsync,
    cancelQueueEntryAsync,
} from '../../redux/actions/reception/receptionAction'

export default function QueueActionModal({ open, onClose, onSuccess, queueEntry, mode }) {
    const dispatch = useDispatch()
    const { rooms = [], doctors = [], roomStatus = [], activeRole } = useSelector((state) => state.reception)

    const [reason, setReason] = useState('')
    const [selectedRoomId, setSelectedRoomId] = useState('')
    const [selectedPriority, setSelectedPriority] = useState('PRIORITY')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const targetRoomInfo = useMemo(() => {
        if (!selectedRoomId) return null
        const r = rooms.find((rm) => String(rm.id) === String(selectedRoomId) || rm.code === selectedRoomId)
        const s = roomStatus.find((st) => String(st.phong_kham_id) === String(selectedRoomId) || st.ma_phong === r?.code)
        const docName =
            s?.ten_bac_si ||
            (s?.bac_si_id ? doctors.find((d) => d.id === s.bac_si_id)?.name : null) ||
            (r?.doctorId ? doctors.find((d) => d.id === r.doctorId)?.name : 'Chưa phân công bác sĩ trực')
        const docId = s?.bac_si_id || r?.doctorId || null

        return {
            room: r,
            doctorName: docName,
            doctorId: docId,
            floor: r?.floor || s?.tang || 'Tầng 1',
            waiting: s?.so_benh_nhan_cho ?? r?.currentWaiting ?? 0,
        }
    }, [selectedRoomId, rooms, roomStatus, doctors])

    if (!queueEntry) return null

    const titles = {
        DEFER: `Tạm hoãn lượt khám: ${queueEntry.ticketNumber}`,
        TRANSFER: `Chuyển phòng khám: ${queueEntry.ticketNumber}`,
        REORDER: `Điều phối thứ tự & ưu tiên: ${queueEntry.ticketNumber}`,
        CANCEL: `Hủy lượt khám: ${queueEntry.ticketNumber}`,
    }

    const currentRoomId = queueEntry.backendRoomId || queueEntry.roomId
    const currentDocId = queueEntry.doctorId
    const currentRoomStr = String(queueEntry.roomName || queueEntry.phong_kham || '').toLowerCase()

    const availableRooms = rooms.filter((r) => {
        if (currentRoomId && (String(r.id) === String(currentRoomId) || r.code === currentRoomId)) {
            return false
        }
        if (currentRoomStr && r.name && currentRoomStr.includes(r.name.toLowerCase())) {
            return false
        }
        if (currentRoomStr && r.code && currentRoomStr.includes(String(r.code).toLowerCase())) {
            return false
        }
        if (currentDocId) {
            const st = roomStatus.find((s) => String(s.phong_kham_id) === String(r.id) || s.ma_phong === r.code)
            if (st?.bac_si_id && Number(st.bac_si_id) === Number(currentDocId)) return false
            if (r.doctorId && Number(r.doctorId) === Number(currentDocId)) return false
        }
        return true
    })
    const targetTicketId = queueEntry.backendId || queueEntry.id

    const handleSubmit = async () => {
        if (!reason.trim()) {
            message.error('Vui lòng nhập lý do thực hiện thao tác này')
            return
        }

        setIsSubmitting(true)
        try {
            const extraParams = {
                doctorId: queueEntry.doctorId,
                queryDate: queueEntry.ngay_kham,
                caKham: queueEntry.ca_kham,
            }
            if (mode === 'DEFER') {
                await dispatch(deferQueueEntryAsync({ queueId: targetTicketId, reason: reason.trim(), ...extraParams })).unwrap()
                message.success('Đã tạm hoãn lượt khám thành công')
            } else if (mode === 'TRANSFER') {
                if (!selectedRoomId) {
                    message.error('Vui lòng chọn phòng khám đích')
                    setIsSubmitting(false)
                    return
                }
                await dispatch(
                    transferRoomAsync({
                        queueId: targetTicketId,
                        updates: {
                            newRoomId: selectedRoomId,
                            newDoctorId: targetRoomInfo?.doctorId || undefined,
                            reason: reason.trim(),
                        },
                        ...extraParams,
                    })
                ).unwrap()
                message.success('Đã chuyển phòng khám thành công')
            } else if (mode === 'REORDER') {
                await dispatch(
                    reorderQueueAsync({
                        queueId: targetTicketId,
                        payload: { priority: selectedPriority, reason: reason.trim() },
                    })
                ).unwrap()
                message.success('Đã cập nhật mức ưu tiên thành công')
            } else if (mode === 'CANCEL') {
                await dispatch(cancelQueueEntryAsync({ queueId: targetTicketId, reason: reason.trim(), ...extraParams })).unwrap()
                message.success('Đã hủy lượt khám')
            }
            setReason('')
            setSelectedRoomId('')
            if (onSuccess) {
                await onSuccess()
            }
            onClose()
        } catch (err) {
            message.error(err || 'Lỗi khi xử lý thao tác hàng đợi')
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
                setSelectedRoomId('')
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
                {mode === 'DEFER' && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800">
                        Lượt khám sẽ được chuyển sang trạng thái <strong>TẠM HOÃN</strong> trong hệ thống. Khi bệnh nhân quay lại, lễ tân có thể bấm nút <strong>"Tiếp tục"</strong> để phục hồi lượt khám vào hàng đợi.
                    </div>
                )}

                {mode === 'TRANSFER' && (
                    <div className="space-y-3">
                        <div>
                            <label className="block font-bold text-slate-700 uppercase mb-1">
                                Chọn phòng khám chuyển đến <span className="text-red-500">*</span>
                            </label>
                            <Select
                                className="w-full"
                                placeholder="Chọn phòng khám chuyển đến..."
                                value={selectedRoomId || undefined}
                                onChange={(val) => setSelectedRoomId(val)}
                                listHeight={280}
                                optionLabelProp="label"
                            >
                                {availableRooms.map((r) => {
                                    const s = roomStatus.find(
                                        (st) => String(st.phong_kham_id) === String(r.id) || st.ma_phong === r.code
                                    )
                                    const docName = s?.ten_bac_si || (r.doctorId ? doctors.find((d) => d.id === r.doctorId)?.name : null)
                                    const wait = s?.so_benh_nhan_cho ?? r.currentWaiting ?? 0
                                    const floor = r.floor || s?.tang || 'Tầng 1'
                                    const shortLabel = `${r.code ? `[${r.code}] ` : ''}${r.name}${docName ? ` (${docName})` : ''}`

                                    return (
                                        <Select.Option key={r.id} value={r.id} label={shortLabel}>
                                            <div className="py-1 flex items-center justify-between gap-2 border-b border-slate-50 last:border-0">
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                                        {r.code && (
                                                            <span className="px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 font-mono text-[11px]">
                                                                {r.code}
                                                            </span>
                                                        )}
                                                        <span className="truncate">{r.name}</span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                                        <span>🩺 {docName || 'Chưa phân công BS'}</span>
                                                        <span>•</span>
                                                        <span>📍 {floor}</span>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        wait > 3 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        Chờ: {wait}
                                                    </span>
                                                </div>
                                            </div>
                                        </Select.Option>
                                    )
                                })}
                            </Select>
                        </div>

                        <div>
                            <label className="block font-bold text-slate-700 uppercase mb-1">
                                Bác sĩ tiếp nhận tại buồng khám
                            </label>
                            {targetRoomInfo ? (
                                <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-sky-900">
                                    <div className="font-bold flex items-center gap-1.5 text-xs">
                                        <span>🩺 Bác sĩ phụ trách:</span>
                                        <span className="text-sky-800 font-extrabold">{targetRoomInfo.doctorName}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-1">
                                        {targetRoomInfo.room?.name} • Vị trí: {targetRoomInfo.floor} • Số ca đang chờ: {targetRoomInfo.waiting} người
                                    </div>
                                </div>
                            ) : (
                                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs italic">
                                    Vui lòng chọn phòng khám đích ở trên để xem Bác sĩ phụ trách tiếp nhận
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {mode === 'REORDER' && (
                    <div className="space-y-3">
                        {activeRole !== 'RECEPTION_SUPERVISOR' && (
                            <Alert
                                message="Lưu ý quyền hạn điều phối"
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

                {mode === 'CANCEL' && (
                    <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-800">
                        Lượt khám này sẽ bị hủy khỏi hàng đợi của phòng khám. Số lượng người chờ tại phòng sẽ tự động giảm đi 1.
                    </div>
                )}

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
