import { useState, useEffect, useCallback } from 'react'
import { Modal, Tag, Descriptions, Button, Input, DatePicker, Select, message, Alert, Spin } from 'antd'
import { CalendarOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import dayjs from 'dayjs'
import {
    updateAppointmentAsync,
    cancelAppointmentAsync,
    confirmAppointmentAsync,
    markAppointmentNoShowAsync,
    fetchAppointmentsAsync,
} from '../../redux/actions/reception/receptionAction'
import { receptionService } from '../../services/reception/receptionService'
import { unwrapApi } from '../../utils/helpers/apiHelper'
import { APPOINTMENT_STATUS_LABELS } from '../../utils/constants/receptionConstants'

export default function AppointmentDetailModal({ appointment, open, onClose, onCheckInClick }) {
    const dispatch = useDispatch()
    const { patients = [], departments = [], doctors = [] } = useSelector((state) => state.reception)

    const [isCancelling, setIsCancelling] = useState(false)
    const [cancelReason, setCancelReason] = useState('')
    const [isCancellingLoading, setIsCancellingLoading] = useState(false)

    const [isRescheduling, setIsRescheduling] = useState(false)
    const [newDate, setNewDate] = useState(null)
    const [newTimeSlot, setNewTimeSlot] = useState('')
    const [newDoctorId, setNewDoctorId] = useState('')
    const [rescheduleReason, setRescheduleReason] = useState('')
    const [doctorSlots, setDoctorSlots] = useState([])
    const [loadingSlots, setLoadingSlots] = useState(false)
    const [slotError, setSlotError] = useState(null)
    const [isRescheduleSubmitting, setIsRescheduleSubmitting] = useState(false)
    const [doctorsForReschedule, setDoctorsForReschedule] = useState([])
    const [loadingRescheduleDoctors, setLoadingRescheduleDoctors] = useState(false)

    const [isNoShowing, setIsNoShowing] = useState(false)
    const [noShowNote, setNoShowNote] = useState('')
    const [isNoShowLoading, setIsNoShowLoading] = useState(false)

    const [isConfirming, setIsConfirming] = useState(false)

    // Tải slot 30 phút theo ca của Bác sĩ khi đổi lịch
    const fetchSlotsForReschedule = useCallback(async (docId, dateStr) => {
        if (!docId || !dateStr) {
            setDoctorSlots([])
            setSlotError(null)
            return
        }
        setLoadingSlots(true)
        setSlotError(null)
        try {
            const res = await receptionService.getDoctorSlots(docId, dateStr)
            const data = unwrapApi(res)
            const slots = data?.slots || []
            setDoctorSlots(slots)
            if (slots.length === 0) {
                setSlotError('Bác sĩ không có ca trực hoặc không còn khung giờ khả dụng trong ngày này.')
            }
        } catch (err) {
            setDoctorSlots([])
            setSlotError(err?.message || 'Không thể lấy khung giờ của bác sĩ trong ngày đã chọn.')
        } finally {
            setLoadingSlots(false)
        }
    }, [])

    // Khởi tạo form khi mở modal
    useEffect(() => {
        if (open && appointment) {
            const rawDate = appointment.ngay_kham || appointment.appointmentDate
            const initDate = rawDate && dayjs(rawDate).isValid() && !dayjs(rawDate).isBefore(dayjs().startOf('day'))
                ? dayjs(rawDate)
                : dayjs()
            setNewDate(initDate)

            const initDocId = appointment.bac_si_id || appointment.bac_si?.id || appointment.doctorId || ''
            setNewDoctorId(initDocId)
            setNewTimeSlot('')
            setRescheduleReason('')
            setIsRescheduling(false)
            setIsCancelling(false)
            setIsNoShowing(false)
            setCancelReason('')
            setNoShowNote('')
            setDoctorSlots([])
            setSlotError(null)
        }
    }, [open, appointment])

    // Khi người dùng bấm Đổi lịch hoặc thay đổi Ngày / Bác sĩ mới
    useEffect(() => {
        if (isRescheduling) {
            const deptId = appointment?.chuyen_khoa_id || appointment?.chuyen_khoa?.id || appointment?.departmentId
            if (deptId) {
                setLoadingRescheduleDoctors(true)
                receptionService
                    .getDoctors({ specialty_id: Number(deptId), page: 1, page_size: 100 })
                    .then((res) => {
                        const data = unwrapApi(res)
                        const list = Array.isArray(data) ? data : data?.items || []
                        setDoctorsForReschedule(
                            list.map((d) => ({
                                id: d.id,
                                name: d.ho_ten || d.name,
                                title: d.hoc_vi || '',
                                status: d.is_active === false ? 'ON_LEAVE' : 'AVAILABLE',
                            }))
                        )
                    })
                    .catch(() => setDoctorsForReschedule([]))
                    .finally(() => setLoadingRescheduleDoctors(false))
            }

            if (newDate) {
                const docId = newDoctorId || appointment?.bac_si_id || appointment?.bac_si?.id || appointment?.doctorId
                if (docId) {
                    fetchSlotsForReschedule(docId, newDate.format('YYYY-MM-DD'))
                }
            }
        }
    }, [isRescheduling, newDoctorId, newDate, appointment, fetchSlotsForReschedule])

    if (!appointment) return null

    // ── Chuẩn hóa đọc dữ liệu Bệnh nhân ───────────────────────────────
    const patientObj = appointment.benh_nhan || patients.find((p) => p.id === (appointment.benh_nhan_id || appointment.patientId)) || null
    const patientId = appointment.benh_nhan_id || appointment.benh_nhan?.id || appointment.patientId || patientObj?.id
    const patientName = appointment.ten_benh_nhan || appointment.benh_nhan?.ho_ten || patientObj?.fullName || patientObj?.ho_ten || 'Chưa cập nhật'
    const patientPhone = appointment.so_dien_thoai || appointment.benh_nhan?.so_dien_thoai || appointment.benh_nhan?.phone || patientObj?.phone || 'Chưa cập nhật'
    const patientCode = appointment.ma_benh_nhan || patientObj?.patientCode || (patientId ? `BN-${patientId}` : 'N/A')
    const patientCccd = appointment.cccd_so || appointment.benh_nhan?.cccd_so || patientObj?.identityCard || 'Chưa có'
    const patientDob = appointment.ngay_sinh || appointment.benh_nhan?.ngay_sinh || patientObj?.dob

    // ── Chuẩn hóa đọc dữ liệu Bác sĩ & Chuyên khoa ───────────────────
    const doctorObj = appointment.bac_si || doctors.find((d) => d.id === (appointment.bac_si_id || appointment.doctorId)) || null
    const doctorId = appointment.bac_si_id || appointment.bac_si?.id || appointment.doctorId || doctorObj?.id
    const doctorName = appointment.ten_bac_si || appointment.bac_si?.ho_ten || doctorObj?.name || 'Theo phân bổ ca'

    const departmentObj = appointment.chuyen_khoa || departments.find((d) => d.id === (appointment.chuyen_khoa_id || appointment.departmentId)) || null
    const departmentId = appointment.chuyen_khoa_id || appointment.chuyen_khoa?.id || appointment.departmentId || departmentObj?.id
    const departmentName = appointment.ten_chuyen_khoa || appointment.chuyen_khoa?.ten_chuyen_khoa || departmentObj?.name || 'Theo phân bổ'

    const roomName = appointment.phong_kham || ''
    const appDate = appointment.ngay_kham || appointment.appointmentDate
    const appTime = appointment.gio_kham || appointment.timeSlot

    // ── Trạng thái lịch khám ──────────────────────────────────────────
    const rawSt = String(appointment.trang_thai_lich || appointment.trang_thai || appointment.status || '').toLowerCase()
    const statusConfig = APPOINTMENT_STATUS_LABELS[rawSt] || APPOINTMENT_STATUS_LABELS[rawSt.toUpperCase()] || { label: appointment.status || 'Chờ khám', color: 'default' }

    const isPendingConfirm = rawSt === 'cho_xac_nhan'
    const isConfirmed = rawSt === 'da_xac_nhan' || rawSt === 'da_dat' || rawSt === 'booked' || rawSt === 'confirmed'
    const isCheckedIn = rawSt === 'checked_in' || rawSt === 'da_den' || rawSt === 'da_tiep_nhan' || Boolean(appointment.ticket_id) || Boolean(appointment.so_thu_tu_kham) || Boolean(appointment.trang_thai_hang_doi)
    const canCheckIn = !isCheckedIn && (isPendingConfirm || isConfirmed)
    const canCancel = rawSt !== 'cancelled' && rawSt !== 'da_huy' && !isCheckedIn && rawSt !== 'da_kham'
    const canReschedule = canCancel
    const canNoShow = isConfirmed

    // ── Xử lý Xác nhận giữ chỗ ────────────────────────────────────────
    const handleConfirmAppointment = async () => {
        try {
            setIsConfirming(true)
            await dispatch(confirmAppointmentAsync({ appointmentId: appointment.id })).unwrap()
            message.success('Xác nhận giữ chỗ lịch khám thành công!')
            dispatch(fetchAppointmentsAsync())
            onClose()
        } catch (err) {
            message.error(typeof err === 'string' ? err : 'Không thể xác nhận lịch hẹn')
        } finally {
            setIsConfirming(false)
        }
    }

    // ── Xử lý Hủy lịch hẹn ────────────────────────────────────────────
    const handleConfirmCancel = async () => {
        if (!cancelReason.trim()) {
            message.error('Vui lòng nhập lý do hủy lịch hẹn')
            return
        }
        if (cancelReason.trim().length < 5) {
            message.error('Lý do hủy phải có tối thiểu 5 ký tự')
            return
        }
        try {
            setIsCancellingLoading(true)
            const result = await dispatch(
                cancelAppointmentAsync({ id: appointment.id, reason: cancelReason.trim() })
            ).unwrap()

            if (result?.thong_bao_waitlist) {
                message.info(result.thong_bao_waitlist, 5)
            }
            message.success('Đã hủy lịch hẹn khám thành công và giải phóng slot!')
            setIsCancelling(false)
            setCancelReason('')
            dispatch(fetchAppointmentsAsync())
            onClose()
        } catch (err) {
            message.error(typeof err === 'string' ? err : 'Hủy lịch hẹn thất bại')
        } finally {
            setIsCancellingLoading(false)
        }
    }

    // ── Xử lý Đổi lịch khám ──────────────────────────────────────────
    const handleConfirmReschedule = async () => {
        if (!newDate) {
            message.error('Vui lòng chọn ngày khám mới')
            return
        }
        if (newDate.isBefore(dayjs().startOf('day'))) {
            message.error('Không thể chọn ngày khám trong quá khứ')
            return
        }
        if (!newTimeSlot) {
            message.error('Vui lòng chọn khung giờ khám mới')
            return
        }
        if (!rescheduleReason.trim()) {
            message.error('Vui lòng nhập lý do đổi lịch (bắt buộc)')
            return
        }

        let timeStr = newTimeSlot
        if (timeStr.includes(' - ')) {
            timeStr = timeStr.split(' - ')[0]
        }
        if (timeStr.length === 5) {
            timeStr = `${timeStr}:00`
        }

        try {
            setIsRescheduleSubmitting(true)
            const updates = {
                ngay_kham_moi: newDate.format('YYYY-MM-DD'),
                gio_kham_moi: timeStr,
                bac_si_id_moi: newDoctorId ? Number(newDoctorId) : (doctorId ? Number(doctorId) : null),
                ly_do_doi: rescheduleReason.trim(),
            }
            await dispatch(updateAppointmentAsync({ id: appointment.id, updates })).unwrap()
            message.success('Đổi lịch hẹn khám thành công!')
            setIsRescheduling(false)
            dispatch(fetchAppointmentsAsync())
            onClose()
        } catch (err) {
            message.error(typeof err === 'string' ? err : 'Đổi lịch hẹn thất bại')
        } finally {
            setIsRescheduleSubmitting(false)
        }
    }

    // ── Xử lý Ghi nhận Vắng mặt (No-Show) ─────────────────────────────
    const handleConfirmNoShow = async () => {
        try {
            setIsNoShowLoading(true)
            const result = await dispatch(
                markAppointmentNoShowAsync({
                    appointmentId: appointment.id,
                    ghiChu: noShowNote.trim() || 'Người bệnh không đến khám hết ca trực',
                })
            ).unwrap()

            if (result?.da_khoa_tai_khoan) {
                Modal.warning({
                    title: 'Cảnh báo vi phạm No-show!',
                    content: result?.canh_bao || 'Người bệnh đã vi phạm No-show 3 lần. Hệ thống đã tự động khóa quyền tự đặt lịch trực tuyến!',
                })
            } else {
                message.warning('Đã ghi nhận người bệnh vắng mặt (No-show)')
            }

            setIsNoShowing(false)
            setNoShowNote('')
            dispatch(fetchAppointmentsAsync())
            onClose()
        } catch (err) {
            message.error(typeof err === 'string' ? err : 'Ghi nhận vắng mặt thất bại')
        } finally {
            setIsNoShowLoading(false)
        }
    }

    // Danh sách bác sĩ từ API cho chuyên khoa của lịch hẹn
    const availableDoctorsForReschedule = doctorsForReschedule.length > 0
        ? doctorsForReschedule
        : (doctorId ? [{ id: doctorId, name: doctorName, status: 'AVAILABLE' }] : [])

    // Render danh sách slot từ API getDoctorSlots theo đúng bảng đặc tả status: available, booked, past
    const slotOptions = doctorSlots.length > 0
        ? doctorSlots.map((slot) => {
            const isAvailable = slot.status === 'available' || slot.is_available === true
            const isBooked = slot.status === 'booked' || (slot.is_available === false && slot.status !== 'past')
            const isPast = slot.status === 'past'

            let labelSuffix = ''
            if (isAvailable) {
                labelSuffix = ''
            } else if (isBooked) {
                labelSuffix = ' (Đã kín)'
            } else if (isPast) {
                labelSuffix = ' (Đã qua)'
            } else {
                labelSuffix = ' (Hết chỗ)'
            }

            const slotVal = slot.time_val || (slot.time_str && slot.time_str.length === 5 ? `${slot.time_str}:00` : slot.time_str)

            return {
                value: slotVal,
                label: `${slot.time_str}${labelSuffix}`,
                disabled: !isAvailable,
            }
        })
        : []

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">
                        Chi tiết lịch hẹn: {appointment.ma_lich_kham || appointment.appointmentCode || `APT-${appointment.id}`}
                    </span>
                    <Tag color={statusConfig.color} className="font-semibold">
                        {statusConfig.label}
                    </Tag>
                </div>
            }
            open={open}
            onCancel={() => {
                setIsCancelling(false)
                setIsRescheduling(false)
                setIsNoShowing(false)
                onClose()
            }}
            width={740}
            footer={
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {canCancel && !isCancelling && !isRescheduling && !isNoShowing && (
                            <Button danger onClick={() => setIsCancelling(true)}>
                                Hủy lịch hẹn
                            </Button>
                        )}
                        {canNoShow && !isCancelling && !isRescheduling && !isNoShowing && (
                            <Button
                                className="border-amber-400 text-amber-700 hover:bg-amber-50"
                                onClick={() => setIsNoShowing(true)}
                            >
                                Báo vắng mặt (No-Show)
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isPendingConfirm && !isCancelling && !isRescheduling && !isNoShowing && (
                            <Button
                                type="primary"
                                className="bg-sky-600 font-semibold"
                                loading={isConfirming}
                                onClick={handleConfirmAppointment}
                            >
                                Xác nhận lịch hẹn (Confirm)
                            </Button>
                        )}
                        {canReschedule && !isCancelling && !isRescheduling && !isNoShowing && (
                            <Button
                                type="default"
                                icon={<CalendarOutlined />}
                                onClick={() => setIsRescheduling(true)}
                            >
                                Đổi lịch khám
                            </Button>
                        )}
                        {canCheckIn && !isCancelling && !isRescheduling && !isNoShowing && (
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                className="bg-emerald-600 font-semibold"
                                onClick={() => {
                                    onClose()
                                    if (onCheckInClick) onCheckInClick(appointment)
                                }}
                            >
                                Tiếp nhận ngay (Check-in)
                            </Button>
                        )}
                        <Button
                            onClick={() => {
                                setIsCancelling(false)
                                setIsRescheduling(false)
                                setIsNoShowing(false)
                                onClose()
                            }}
                        >
                            Đóng
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="space-y-4 py-2">
                {/* Panel Báo No-Show */}
                {isNoShowing && (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
                        <h4 className="font-bold text-amber-900 text-sm">Xác nhận ghi nhận Vắng mặt (No-Show)</h4>
                        <p className="text-xs text-amber-700">
                            Hệ thống sẽ chuyển trạng thái lịch sang <strong>Vắng mặt</strong> và tự động cộng 1 điểm vi phạm No-show cho hồ sơ người bệnh. Nếu vi phạm ≥ 3 lần, tài khoản sẽ bị tự động khóa quyền đặt trực tuyến.
                        </p>
                        <Input.TextArea
                            rows={2}
                            placeholder="Nhập ghi chú xác minh (VD: Lễ tân đã gọi điện 3 lần nhưng không liên lạc được)..."
                            value={noShowNote}
                            onChange={(e) => setNoShowNote(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <Button size="small" onClick={() => setIsNoShowing(false)}>
                                Quay lại
                            </Button>
                            <Button
                                size="small"
                                type="primary"
                                className="bg-amber-600 hover:bg-amber-700 font-semibold text-white"
                                loading={isNoShowLoading}
                                onClick={handleConfirmNoShow}
                            >
                                Xác nhận No-Show
                            </Button>
                        </div>
                    </div>
                )}

                {/* Panel Hủy lịch */}
                {isCancelling && (
                    <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-3">
                        <h4 className="font-bold text-red-800 text-sm">Xác nhận hủy lịch hẹn</h4>
                        <p className="text-xs text-red-600">
                            Lưu ý: Quy tắc an toàn y tế yêu cầu hủy trước tối thiểu 02 giờ. Sau khi hủy, slot sẽ tự động giải phóng và thông báo cho người đứng đầu Danh sách chờ (Waitlist).
                        </p>
                        <Input.TextArea
                            rows={3}
                            placeholder="Nhập lý do hủy lịch (bắt buộc, tối thiểu 5 ký tự)..."
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <Button size="small" onClick={() => setIsCancelling(false)}>
                                Quay lại
                            </Button>
                            <Button
                                size="small"
                                type="primary"
                                danger
                                loading={isCancellingLoading}
                                onClick={handleConfirmCancel}
                            >
                                Xác nhận hủy
                            </Button>
                        </div>
                    </div>
                )}

                {/* Panel Đổi lịch khám (Reschedule) */}
                {isRescheduling && (
                    <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sky-900 text-sm">Đổi ngày / giờ / bác sĩ khám</h4>
                            <span className="text-[11px] text-sky-600">Khoa: <strong>{departmentName}</strong></span>
                        </div>

                        {slotError && (
                            <Alert message={slotError} type="info" showIcon className="text-xs" />
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    Ngày khám mới <span className="text-red-500">*</span>:
                                </label>
                                <DatePicker
                                    className="w-full"
                                    format="DD/MM/YYYY"
                                    value={newDate}
                                    onChange={(date) => {
                                        setNewDate(date)
                                        setNewTimeSlot('')
                                    }}
                                    disabledDate={(current) => current && current < dayjs().startOf('day')}
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block font-medium text-slate-700">
                                        Khung giờ mới <span className="text-red-500">*</span>:
                                    </label>
                                    {loadingSlots && <Spin size="small" />}
                                </div>
                                <Select
                                    className="w-full"
                                    placeholder={
                                        loadingSlots
                                            ? 'Đang kiểm tra slot trống...'
                                            : !newDate
                                              ? 'Chọn ngày khám trước'
                                              : slotOptions.length === 0
                                                ? 'Không có khung giờ trống'
                                                : 'Chọn khung giờ khám'
                                    }
                                    value={newTimeSlot || undefined}
                                    onChange={(val) => setNewTimeSlot(val)}
                                    disabled={!newDate || loadingSlots || slotOptions.length === 0}
                                    options={slotOptions}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block font-medium text-slate-700">Bác sĩ phụ trách:</label>
                                    {loadingRescheduleDoctors && <Spin size="small" />}
                                </div>
                                <Select
                                    className="w-full"
                                    placeholder={loadingRescheduleDoctors ? "Đang tải danh sách bác sĩ..." : "Chọn bác sĩ phụ trách"}
                                    value={newDoctorId || doctorId || undefined}
                                    loading={loadingRescheduleDoctors}
                                    onChange={(val) => {
                                        setNewDoctorId(val)
                                        setNewTimeSlot('')
                                    }}
                                    options={
                                        availableDoctorsForReschedule.map((d) => ({
                                            value: d.id,
                                            label: `${d.title ? `${d.title} ` : ''}${d.name} ${d.status === 'AVAILABLE' || d.isAvailable ? '(Sẵn sàng)' : '(Nghỉ/Đi muộn)'}`,
                                        }))
                                    }
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block font-medium text-slate-700 mb-1">
                                    Lý do đổi lịch <span className="text-red-500">*</span>:
                                </label>
                                <Input
                                    placeholder="Ví dụ: Bệnh nhân bận công tác đột xuất, đổi ca khám..."
                                    value={rescheduleReason}
                                    onChange={(e) => setRescheduleReason(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                            <Button size="small" onClick={() => setIsRescheduling(false)}>
                                Hủy bỏ
                            </Button>
                            <Button
                                size="small"
                                type="primary"
                                loading={isRescheduleSubmitting}
                                onClick={handleConfirmReschedule}
                                className="bg-sky-600 font-semibold"
                            >
                                Lưu thay đổi
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── BẢNG THÔNG TIN NGƯỜI BỆNH ─────────────────────────────── */}
                <Descriptions title="Thông tin người bệnh" bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Mã bệnh nhân">
                        <span className="font-mono font-bold text-sky-800">{patientCode}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Họ và tên">
                        <span className="font-bold text-slate-900">{patientName}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Số điện thoại">
                        <span className="font-medium">{patientPhone}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="CCCD/Định danh">{patientCccd}</Descriptions.Item>
                    <Descriptions.Item label="Ngày sinh">
                        {patientDob ? dayjs(patientDob).format('DD/MM/YYYY') : 'Chưa cập nhật'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Đối tượng khám">
                        <span className="font-semibold text-slate-700">Khám theo lịch hẹn đặt trước</span>
                    </Descriptions.Item>
                </Descriptions>

                {/* ── BẢNG THÔNG TIN KHÁM BỆNH (KHÔNG CÓ GÓI KHÁM) ─────────── */}
                <Descriptions title="Thông tin lịch hẹn khám" bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Ngày khám">
                        <strong>{appDate}</strong>
                    </Descriptions.Item>
                    <Descriptions.Item label="Khung giờ khám">
                        <span className="font-bold text-sky-700 text-sm">{appTime}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Chuyên khoa">
                        <span className="font-semibold text-slate-800">{departmentName}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Bác sĩ phụ trách">
                        <span className="font-semibold text-slate-800">{doctorName}</span>
                    </Descriptions.Item>
                    {roomName && (
                        <Descriptions.Item label="Phòng khám">{roomName}</Descriptions.Item>
                    )}
                    {appointment.trang_thai_hang_doi && (
                        <Descriptions.Item label="Trạng thái hàng đợi">
                            <Tag color="purple">Hàng đợi: {appointment.trang_thai_hang_doi}</Tag>
                        </Descriptions.Item>
                    )}
                    <Descriptions.Item label="Lý do khám / Triệu chứng" span={2}>
                        {appointment.ly_do_kham || appointment.notes || 'Không có ghi chú'}
                    </Descriptions.Item>
                    {(appointment.cancelReason || appointment.ly_do_huy) && (
                        <Descriptions.Item label="Lý do hủy" span={2}>
                            <span className="text-red-600 font-semibold">
                                {appointment.cancelReason || appointment.ly_do_huy}
                            </span>
                        </Descriptions.Item>
                    )}
                </Descriptions>
            </div>
        </Modal>
    )
}
