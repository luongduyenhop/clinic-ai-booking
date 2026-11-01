import { useState } from 'react'
import { Modal, Input, Select, Button, message, Alert } from 'antd'
import { useDispatch, useSelector } from 'react-redux'
import { AlertOutlined } from '@ant-design/icons'
import { emergencyHandoverAsync } from '../../redux/actions/reception/receptionAction'

export default function EmergencyHandoverModal({ open, onClose, defaultPatientId }) {
    const dispatch = useDispatch()
    const { patients } = useSelector((state) => state.reception)

    const [patientId, setPatientId] = useState(defaultPatientId || '')
    const [transferTo, setTransferTo] = useState('Phòng Cấp Cứu 115 - Sảnh A')
    const [reason, setReason] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!patientId) {
            message.error('Vui lòng chọn bệnh nhân cần bàn giao')
            return
        }
        if (!reason.trim()) {
            message.error('Vui lòng mô tả triệu chứng hoặc lý do khẩn cấp')
            return
        }

        setIsSubmitting(true)
        try {
            await dispatch(
                emergencyHandoverAsync({
                    payload: { patientId, reason: reason.trim(), transferTo },
                })
            )
            message.success('Đã kích hoạt quy trình bàn giao y tế khẩn cấp thành công!')
            setReason('')
            onClose()
        } catch (err) {
            message.error(err.message || 'Lỗi khi kích hoạt bàn giao')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-red-600">
                    <AlertOutlined className="text-lg" />
                    <span className="font-bold">Bàn giao y tế khẩn cấp (RC-06 & RC-26)</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            width={560}
            footer={
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>Hủy bỏ</Button>
                    <Button type="primary" danger onClick={handleSubmit} loading={isSubmitting}>
                        Kích hoạt bàn giao khẩn
                    </Button>
                </div>
            }
        >
            <div className="space-y-4 py-2 text-xs">
                <Alert
                    message="Quy tắc nghiệp vụ an toàn y tế"
                    description="Thông tin lâm sàng và quyết định phân loại khẩn cấp không thuộc quyền tự quyết của Lễ tân. Thao tác này KHÔNG tự ý chen ngang thứ tự khám thường mà sẽ lập tức phát cảnh báo và kích hoạt tiếp nhận bởi Điều dưỡng/Bác sĩ cấp cứu."
                    type="error"
                    showIcon
                />

                <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">
                        Bệnh nhân <span className="text-red-500">*</span>
                    </label>
                    <Select
                        showSearch
                        className="w-full"
                        placeholder="Chọn hoặc tìm người bệnh..."
                        value={patientId || undefined}
                        onChange={(val) => setPatientId(val)}
                        filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        options={patients.map((p) => ({
                            value: p.id,
                            label: `${p.patientCode} - ${p.fullName} (${p.phone})`,
                        }))}
                    />
                </div>

                <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">
                        Đơn vị y tế tiếp nhận bàn giao <span className="text-red-500">*</span>
                    </label>
                    <Select
                        className="w-full"
                        value={transferTo}
                        onChange={(val) => setTransferTo(val)}
                        options={[
                            { value: 'Phòng Cấp Cứu 115 - Sảnh A', label: 'Phòng Cấp Cứu 115 - Sảnh A' },
                            { value: 'Đội cấp cứu phản ứng nhanh nội viện', label: 'Đội cấp cứu phản ứng nhanh nội viện' },
                            { value: 'Phòng thủ thuật hồi sức tầng 1', label: 'Phòng thủ thuật hồi sức tầng 1' },
                        ]}
                    />
                </div>

                <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">
                        Dấu hiệu bất thường quan sát được <span className="text-red-500">*</span>
                    </label>
                    <Input.TextArea
                        rows={3}
                        placeholder="Mô tả dấu hiệu: Khó thở tím tái, đau thắt ngực dữ dội, co giật, ngất xỉu..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    />
                </div>
            </div>
        </Modal>
    )
}
