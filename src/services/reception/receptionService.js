import { loadAllReceptionData, saveReceptionData, resetReceptionData } from '../../mock/reception/receptionStorage'
import { APPOINTMENT_STATUS, QUEUE_STATUS, PAYMENT_STATUS } from '../../utils/constants/receptionConstants'

// Giả lập độ trễ mạng nhẹ (150ms)
const delay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms))

function getTimestamp() {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function getTimeString() {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`
}

class ReceptionService {
    constructor() {
        this.data = loadAllReceptionData()
    }

    _persist() {
        saveReceptionData(this.data)
    }

    _logAudit(actor, actionType, targetType, targetId, description, details = {}) {
        const newLog = {
            id: `LOG${String(Date.now()).slice(-6)}`,
            timestamp: getTimestamp(),
            actor: actor || (this.data.activeRole === 'RECEPTION_SUPERVISOR' ? 'Giám sát: Trần Đình Nam' : 'Lễ tân: Nguyễn Thị Hoa'),
            actionType,
            targetType,
            targetId,
            description,
            details,
        }
        this.data.auditLogs.unshift(newLog)
    }

    async fetchAllData() {
        await delay()
        this.data = loadAllReceptionData()
        return JSON.parse(JSON.stringify(this.data))
    }

    async resetAllData() {
        await delay()
        this.data = resetReceptionData()
        return JSON.parse(JSON.stringify(this.data))
    }

    async switchRole(newRole) {
        await delay(50)
        this.data.activeRole = newRole
        this._persist()
        return this.data.activeRole
    }

    // ==================== APPOINTMENTS ====================
    async createAppointment(appointmentPayload, actor) {
        await delay()
        const newId = `APP${String(this.data.appointments.length + 1).padStart(3, '0')}`
        const code = `APT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(this.data.appointments.length + 1).padStart(3, '0')}`

        // Cảnh báo trùng slot bác sĩ
        const conflict = this.data.appointments.find(
            (a) => a.doctorId === appointmentPayload.doctorId &&
                   a.appointmentDate === appointmentPayload.appointmentDate &&
                   a.timeSlot === appointmentPayload.timeSlot &&
                   a.status !== APPOINTMENT_STATUS.CANCELLED
        )

        const newAppointment = {
            id: newId,
            appointmentCode: code,
            status: APPOINTMENT_STATUS.BOOKED,
            history: [{ action: 'BOOKED', time: getTimestamp(), actor: actor || 'Lễ tân' }],
            conflictWarning: conflict ? `Cảnh báo: Bác sĩ đã có lịch hẹn ${conflict.appointmentCode} trong khung giờ này` : null,
            ...appointmentPayload,
        }

        this.data.appointments.unshift(newAppointment)
        this._logAudit(actor, 'APPOINTMENT_CREATE', 'APPOINTMENT', newId, `Tạo lịch hẹn mới ${code} cho bệnh nhân`, {
            appointmentCode: code,
            patientId: appointmentPayload.patientId,
            timeSlot: appointmentPayload.timeSlot,
        })
        this._persist()
        return newAppointment
    }

    async updateAppointment(id, updates, actor) {
        await delay()
        const index = this.data.appointments.findIndex((a) => a.id === id)
        if (index === -1) throw new Error('Không tìm thấy lịch hẹn')

        const old = this.data.appointments[index]
        const isReschedule = updates.appointmentDate && updates.appointmentDate !== old.appointmentDate ||
                             updates.timeSlot && updates.timeSlot !== old.timeSlot ||
                             updates.doctorId && updates.doctorId !== old.doctorId

        const updatedHistory = [...(old.history || [])]
        if (isReschedule) {
            updatedHistory.push({
                action: 'RESCHEDULED',
                time: getTimestamp(),
                actor: actor || 'Lễ tân',
                note: updates.rescheduleReason || 'Đổi thời gian / bác sĩ khám',
            })
        }

        this.data.appointments[index] = {
            ...old,
            ...updates,
            status: isReschedule ? APPOINTMENT_STATUS.RESCHEDULED : (updates.status || old.status),
            history: updatedHistory,
        }

        this._logAudit(actor, isReschedule ? 'APPOINTMENT_RESCHEDULE' : 'APPOINTMENT_UPDATE', 'APPOINTMENT', id, `Cập nhật lịch hẹn ${old.appointmentCode}`, updates)
        this._persist()
        return this.data.appointments[index]
    }

    async cancelAppointment(id, reason, actor) {
        await delay()
        const index = this.data.appointments.findIndex((a) => a.id === id)
        if (index === -1) throw new Error('Không tìm thấy lịch hẹn')

        const old = this.data.appointments[index]
        const history = [...(old.history || []), { action: 'CANCELLED', time: getTimestamp(), actor: actor || 'Lễ tân', note: reason }]

        this.data.appointments[index] = {
            ...old,
            status: APPOINTMENT_STATUS.CANCELLED,
            cancelReason: reason,
            history,
        }

        this._logAudit(actor, 'APPOINTMENT_CANCEL', 'APPOINTMENT', id, `Hủy lịch hẹn ${old.appointmentCode}: ${reason}`, { reason })
        this._persist()
        return this.data.appointments[index]
    }

    // ==================== CHECK-IN & QUEUE ====================
    async checkInAppointment({ appointmentId, priority = 'NORMAL', priorityReason = '', notes = '' }, actor) {
        await delay()
        const appIndex = this.data.appointments.findIndex((a) => a.id === appointmentId)
        if (appIndex === -1) throw new Error('Không tìm thấy lịch hẹn cần check-in')

        const appointment = this.data.appointments[appIndex]
        appointment.status = APPOINTMENT_STATUS.CHECKED_IN
        appointment.history = [...(appointment.history || []), { action: 'CHECKED_IN', time: getTimestamp(), actor: actor || 'Lễ tân' }]

        // Tạo Queue Entry
        const queueCount = this.data.queueEntries.length + 1
        const prefix = appointment.departmentId === 'DEP01' ? 'A' :
                       appointment.departmentId === 'DEP02' ? 'B' :
                       appointment.departmentId === 'DEP03' ? 'D' :
                       appointment.departmentId === 'DEP04' ? 'C' : 'E'
        const ticketNumber = `${prefix}${String(queueCount + 100)}`
        const newQueueId = `QUE${String(queueCount).padStart(3, '0')}`

        const newQueueEntry = {
            id: newQueueId,
            ticketNumber,
            patientId: appointment.patientId,
            appointmentId: appointment.id,
            isWalkIn: false,
            departmentId: appointment.departmentId,
            roomId: appointment.roomId,
            doctorId: appointment.doctorId,
            serviceId: appointment.serviceId,
            checkInTime: getTimeString(),
            waitTimeMinutes: 0,
            status: QUEUE_STATUS.WAITING,
            callCount: 0,
            priority,
            priorityReason,
            notes,
            stages: [{ stage: 'CHECK_IN', time: getTimeString(), room: 'Quầy tiếp tân' }],
            logs: [`${getTimeString()}: Tiếp nhận từ lịch hẹn ${appointment.appointmentCode}`],
        }

        this.data.queueEntries.unshift(newQueueEntry)

        // Tăng số người chờ của phòng
        const room = this.data.rooms.find((r) => r.id === appointment.roomId)
        if (room) room.currentWaiting += 1

        this._logAudit(actor, 'CHECK_IN', 'QUEUE_ENTRY', newQueueId, `Check-in thành công mã vé ${ticketNumber} cho lịch ${appointment.appointmentCode}`, {
            ticketNumber,
            patientId: appointment.patientId,
            roomId: appointment.roomId,
        })
        this._persist()
        return { queueEntry: newQueueEntry, appointment }
    }

    async registerWalkIn({ patientId, departmentId, doctorId, roomId, serviceId, priority = 'NORMAL', priorityReason = '', notes = '' }, actor) {
        await delay()
        const queueCount = this.data.queueEntries.length + 1
        const ticketNumber = `W${String(queueCount + 100)}`
        const newQueueId = `QUE${String(queueCount).padStart(3, '0')}`

        const newQueueEntry = {
            id: newQueueId,
            ticketNumber,
            patientId,
            appointmentId: null,
            isWalkIn: true,
            departmentId,
            roomId,
            doctorId,
            serviceId,
            checkInTime: getTimeString(),
            waitTimeMinutes: 0,
            status: QUEUE_STATUS.WAITING,
            callCount: 0,
            priority,
            priorityReason,
            notes,
            stages: [{ stage: 'CHECK_IN', time: getTimeString(), room: 'Bàn tiếp tân Walk-in' }],
            logs: [`${getTimeString()}: Đăng ký khám trực tiếp (Walk-in), cấp số ${ticketNumber}`],
        }

        this.data.queueEntries.unshift(newQueueEntry)

        const room = this.data.rooms.find((r) => r.id === roomId)
        if (room) room.currentWaiting += 1

        this._logAudit(actor, 'WALK_IN_CREATE', 'QUEUE_ENTRY', newQueueId, `Đăng ký khám Walk-in số vé ${ticketNumber}`, {
            ticketNumber,
            patientId,
            roomId,
            serviceId,
        })
        this._persist()
        return newQueueEntry
    }

    async callQueueEntry(queueId, actor) {
        await delay()
        const entry = this.data.queueEntries.find((q) => q.id === queueId)
        if (!entry) throw new Error('Không tìm thấy lượt khám')

        entry.callCount = (entry.callCount || 0) + 1
        entry.status = QUEUE_STATUS.CALLED
        entry.stages.push({ stage: 'CALLED', time: getTimeString(), room: `Phòng ${entry.roomId}` })
        entry.logs.push(`${getTimeString()}: Gọi số lần ${entry.callCount}`)

        this._logAudit(actor, 'QUEUE_CALL', 'QUEUE_ENTRY', queueId, `Gọi số ${entry.ticketNumber} (Lần ${entry.callCount})`, { ticketNumber: entry.ticketNumber })
        this._persist()
        return entry
    }

    async markAbsent(queueId, actor) {
        await delay()
        const entry = this.data.queueEntries.find((q) => q.id === queueId)
        if (!entry) throw new Error('Không tìm thấy lượt khám')

        entry.isAbsent = true
        entry.logs.push(`${getTimeString()}: Đã gọi nhưng bệnh nhân chưa có mặt`)

        this._logAudit(actor, 'QUEUE_ABSENT_MARK', 'QUEUE_ENTRY', queueId, `Ghi nhận bệnh nhân vắng mặt số ${entry.ticketNumber}`, { ticketNumber: entry.ticketNumber })
        this._persist()
        return entry
    }

    async deferQueueEntry(queueId, reason, actor) {
        await delay()
        const entry = this.data.queueEntries.find((q) => q.id === queueId)
        if (!entry) throw new Error('Không tìm thấy lượt khám')

        entry.status = QUEUE_STATUS.DEFERRED
        entry.deferredReason = reason
        entry.stages.push({ stage: 'DEFERRED', time: getTimeString(), room: 'Tạm hoãn' })
        entry.logs.push(`${getTimeString()}: Tạm hoãn lượt khám. Lý do: ${reason}`)

        this._logAudit(actor, 'QUEUE_DEFER', 'QUEUE_ENTRY', queueId, `Tạm hoãn lượt khám ${entry.ticketNumber}: ${reason}`, { reason })
        this._persist()
        return entry
    }

    async resumeQueueEntry(queueId, actor) {
        await delay()
        const entry = this.data.queueEntries.find((q) => q.id === queueId)
        if (!entry) throw new Error('Không tìm thấy lượt khám')

        entry.status = QUEUE_STATUS.WAITING
        entry.deferredReason = null
        entry.logs.push(`${getTimeString()}: Tiếp tục hàng đợi sau tạm hoãn`)

        this._logAudit(actor, 'QUEUE_RESUME', 'QUEUE_ENTRY', queueId, `Tiếp tục xử lý lượt khám ${entry.ticketNumber}`, {})
        this._persist()
        return entry
    }

    async transferRoom(queueId, { newRoomId, newDoctorId, reason }, actor) {
        await delay()
        const entry = this.data.queueEntries.find((q) => q.id === queueId)
        if (!entry) throw new Error('Không tìm thấy lượt khám')

        const oldRoomId = entry.roomId
        entry.roomId = newRoomId
        if (newDoctorId) entry.doctorId = newDoctorId
        entry.stages.push({ stage: 'TRANSFER', time: getTimeString(), room: `Chuyển từ ${oldRoomId} sang ${newRoomId}` })
        entry.logs.push(`${getTimeString()}: Chuyển phòng sang ${newRoomId}. Lý do: ${reason}`)

        // Điều chỉnh waiting count phòng
        const oldRoom = this.data.rooms.find((r) => r.id === oldRoomId)
        if (oldRoom && oldRoom.currentWaiting > 0) oldRoom.currentWaiting -= 1
        const newRoom = this.data.rooms.find((r) => r.id === newRoomId)
        if (newRoom) newRoom.currentWaiting += 1

        this._logAudit(actor, 'QUEUE_TRANSFER_ROOM', 'QUEUE_ENTRY', queueId, `Chuyển số ${entry.ticketNumber} từ phòng ${oldRoomId} sang ${newRoomId}: ${reason}`, {
            oldRoomId,
            newRoomId,
            reason,
        })
        this._persist()
        return entry
    }

    async reorderQueue(queueId, { priority, reason }, actor) {
        await delay()
        const entry = this.data.queueEntries.find((q) => q.id === queueId)
        if (!entry) throw new Error('Không tìm thấy lượt khám')

        const oldPriority = entry.priority
        entry.priority = priority
        entry.priorityReason = reason
        entry.logs.push(`${getTimeString()}: Điều phối mức ưu tiên thành ${priority}. Lý do: ${reason}`)

        this._logAudit(actor, 'QUEUE_REORDER_PRIORITY', 'QUEUE_ENTRY', queueId, `Điều phối số ${entry.ticketNumber}: ${oldPriority} -> ${priority}. Lý do: ${reason}`, {
            oldPriority,
            priority,
            reason,
        })
        this._persist()
        return entry
    }

    async cancelQueueEntry(queueId, reason, actor) {
        await delay()
        const entry = this.data.queueEntries.find((q) => q.id === queueId)
        if (!entry) throw new Error('Không tìm thấy lượt khám')

        entry.status = QUEUE_STATUS.CANCELLED
        entry.cancelReason = reason
        entry.stages.push({ stage: 'CANCELLED', time: getTimeString(), room: 'Hủy lượt' })
        entry.logs.push(`${getTimeString()}: Hủy lượt khám. Lý do: ${reason}`)

        const room = this.data.rooms.find((r) => r.id === entry.roomId)
        if (room && room.currentWaiting > 0) room.currentWaiting -= 1

        this._logAudit(actor, 'QUEUE_CANCEL', 'QUEUE_ENTRY', queueId, `Hủy lượt khám ${entry.ticketNumber}: ${reason}`, { reason })
        this._persist()
        return entry
    }

    async emergencyHandover({ patientId, reason, transferTo }, actor) {
        await delay()
        const patient = this.data.patients.find((p) => p.id === patientId)
        const patientName = patient ? patient.fullName : patientId

        const newTaskId = `TSK${String(Date.now()).slice(-4)}`
        const newTask = {
            id: newTaskId,
            type: 'EMERGENCY_HANDOVER',
            severity: 'CRITICAL',
            title: `Bàn giao y tế khẩn cấp: BN ${patientName}`,
            description: `Dấu hiệu lâm sàng khẩn cấp: ${reason}. Đã bàn giao cho ${transferTo}`,
            patientId,
            status: 'RESOLVED',
            createdAt: getTimestamp(),
            recommendedAction: `Theo dõi tại ${transferTo}`,
        }
        this.data.tasks.unshift(newTask)

        this._logAudit(actor, 'EMERGENCY_HANDOVER', 'PATIENT', patientId, `Bàn giao y tế khẩn cấp cho BN ${patientName}: ${reason}`, { transferTo, reason })
        this._persist()
        return newTask
    }

    // ==================== PATIENTS ====================
    async createPatient(payload, actor) {
        await delay()
        const count = this.data.patients.length + 1
        const newId = `PAT${String(count).padStart(3, '0')}`
        const patientCode = `BN-2026-${String(count).padStart(4, '0')}`

        // Kiểm tra nghi vấn trùng
        const suspect = this.data.patients.find(
            (p) => (payload.identityCard && p.identityCard === payload.identityCard) ||
                   (payload.phone && p.phone === payload.phone && p.fullName.toLowerCase() === payload.fullName.toLowerCase())
        )

        const newPatient = {
            id: newId,
            patientCode,
            isDuplicateSuspect: Boolean(suspect),
            duplicateWith: suspect ? suspect.id : null,
            missingDocs: payload.missingDocs || [],
            ...payload,
        }

        this.data.patients.unshift(newPatient)

        if (suspect) {
            // Tự động tạo Task nghi vấn trùng hồ sơ
            this.data.tasks.unshift({
                id: `TSK${String(Date.now()).slice(-4)}`,
                type: 'DUPLICATE_PROFILE',
                severity: 'HIGH',
                title: `Nghi vấn trùng hồ sơ bệnh nhân ${payload.fullName}`,
                description: `Tạo mới ${patientCode} có thông tin trùng với ${suspect.patientCode} (${suspect.fullName})`,
                patientId: newId,
                secondaryPatientId: suspect.id,
                status: 'PENDING',
                createdAt: getTimestamp(),
                recommendedAction: 'Đối chiếu CCCD/SĐT và xác minh hồ sơ',
            })
        }

        this._logAudit(actor, 'PATIENT_CREATE', 'PATIENT', newId, `Tạo hồ sơ bệnh nhân mới ${patientCode} (${payload.fullName})`, {
            patientCode,
            isDuplicateSuspect: Boolean(suspect),
        })
        this._persist()
        return newPatient
    }

    async updatePatient(id, updates, actor) {
        await delay()
        const index = this.data.patients.findIndex((p) => p.id === id)
        if (index === -1) throw new Error('Không tìm thấy bệnh nhân')

        this.data.patients[index] = {
            ...this.data.patients[index],
            ...updates,
        }

        this._logAudit(actor, 'PATIENT_UPDATE', 'PATIENT', id, `Cập nhật thông tin hành chính bệnh nhân ${this.data.patients[index].fullName}`, updates)
        this._persist()
        return this.data.patients[index]
    }

    // ==================== TASKS & ADMINISTRATION ====================
    async resolveTask(taskId, resolutionNote, actor) {
        await delay()
        const index = this.data.tasks.findIndex((t) => t.id === taskId)
        if (index === -1) throw new Error('Không tìm thấy sự cố')

        const current = this.data.tasks[index]
        const updatedTask = {
            ...current,
            status: 'RESOLVED',
            resolvedAt: getTimestamp(),
            resolutionNote,
        }

        this.data.tasks[index] = updatedTask
        this._logAudit(actor, 'TASK_RESOLVE', 'TASK', taskId, `Xử lý sự cố: ${updatedTask.title}. Ghi chú: ${resolutionNote}`, { resolutionNote })
        this._persist()
        return updatedTask
    }

    async updateInvoiceStatus(invoiceId, { status, paymentMethod, transactionRef }, actor) {
        await delay()
        const index = this.data.invoices.findIndex((i) => i.id === invoiceId)
        if (index === -1) throw new Error('Không tìm thấy hóa đơn')

        const current = this.data.invoices[index]
        const updatedInvoice = {
            ...current,
            status: status || current.status,
            paymentMethod: paymentMethod || current.paymentMethod,
            transactionRef: transactionRef || current.transactionRef || `REF-${Date.now().toString().slice(-6)}`,
        }

        this.data.invoices[index] = updatedInvoice
        this._logAudit(actor, 'INVOICE_UPDATE', 'INVOICE', invoiceId, `Cập nhật thanh toán hóa đơn ${updatedInvoice.invoiceCode} -> ${status}`, { status, paymentMethod })
        this._persist()
        return updatedInvoice
    }
}

export const receptionService = new ReceptionService()
