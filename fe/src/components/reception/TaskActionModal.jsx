import { useState } from 'react'
import { Modal, Input, Button, message, Descriptions, Tag } from 'antd'
import { useDispatch } from 'react-redux'
import { resolveTaskAsync } from '../../redux/slices/reception/receptionSlice'
import { TASK_SEVERITY_LABELS } from '../../utils/constants/receptionConstants'

export default function TaskActionModal({ open, onClose, task }) {
    const dispatch = useDispatch()
    const [resolutionNote, setResolutionNote] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    if (!task) return null

    const severityConfig = TASK_SEVERITY_LABELS[task.severity] || { label: task.severity, color: 'default' }

    const handleResolve = async () => {
        if (!resolutionNote.trim()) {
            message.error('Vui lòng nhập phương án / kết quả xử lý')
            return
        }

        setIsSubmitting(true)
        try {
            await dispatch(
                resolveTaskAsync({
                    taskId: task.id,
                    resolutionNote: resolutionNote.trim(),
                })
            )
            message.success('Đã cập nhật sự cố sang trạng thái ĐÃ XỬ LÝ (RESOLVED)')
            setResolutionNote('')
            onClose()
        } catch (err) {
            message.error(err.message || 'Lỗi khi xử lý sự cố')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">Xử lý sự cố: {task.id}</span>
                    <Tag color={severityConfig.color}>{severityConfig.label}</Tag>
                </div>
            }
            open={open}
            onCancel={() => {
                setResolutionNote('')
                onClose()
            }}
            width={600}
            footer={
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>Đóng</Button>
                    <Button
                        type="primary"
                        onClick={handleResolve}
                        loading={isSubmitting}
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        Đánh dấu đã xử lý
                    </Button>
                </div>
            }
        >
            <div className="space-y-4 py-2 text-xs">
                <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="Tiêu đề">{task.title}</Descriptions.Item>
                    <Descriptions.Item label="Nội dung mô tả">{task.description}</Descriptions.Item>
                    <Descriptions.Item label="Khuyến nghị xử lý">
                        <span className="text-sky-700 font-semibold">{task.recommendedAction}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Thời điểm phát sinh">{task.createdAt}</Descriptions.Item>
                </Descriptions>

                <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">
                        Kết quả / Biện pháp đã thực hiện <span className="text-red-500">*</span>
                    </label>
                    <Input.TextArea
                        rows={3}
                        placeholder="Ví dụ: Đã liên hệ người bệnh chuyển sang phòng 101; Đã đối chiếu CCCD và gộp hồ sơ..."
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                    />
                </div>
            </div>
        </Modal>
    )
}
