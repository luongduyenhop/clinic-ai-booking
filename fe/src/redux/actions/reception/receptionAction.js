import { createAsyncThunk } from '@reduxjs/toolkit'
import { receptionService, FIVE_SPECIALTIES } from '../../../services/reception/receptionService'
import { unwrapApi, unwrapPagedApi, pickErrorMessage } from '../../../utils/helpers/apiHelper'
import { clinicalEventBridge, CLINICAL_EVENTS } from '../../../services/clinicalEventBridge'

function getTimeString() {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function normalizeTicket(ticket, defaultPatient = null) {
    if (!ticket) return null
    const ticketNum = ticket.ma_so_thu_tu || (ticket.so_thu_tu_kham ? String(ticket.so_thu_tu_kham).padStart(2, '0') : '01')
    return {
        id: ticket.id ? `QUE${String(ticket.id).padStart(3, '0')}` : `QUE${String(Date.now()).slice(-4)}`,
        backendId: ticket.id,
        ticketNumber: ticketNum,
        ma_so_thu_tu: ticketNum,
        so_thu_tu_kham: ticket.so_thu_tu_kham,
        patientId: ticket.benh_nhan_id,
        patientName: ticket.ten_benh_nhan || defaultPatient?.fullName || defaultPatient?.ho_ten || 'Bệnh nhân',
        phone: ticket.so_dien_thoai || defaultPatient?.phone || defaultPatient?.so_dien_thoai || '',
        appointmentId: ticket.lich_kham_id,
        doctorId: ticket.bac_si_id,
        doctorName: ticket.ten_bac_si || '',
        roomId: ticket.phong_kham || ticket.phong_kham_id || '',
        roomName: ticket.phong_kham || '',
        departmentId: ticket.chuyen_khoa_id,
        checkInTime: ticket.thoi_gian_check_in
            ? (typeof ticket.thoi_gian_check_in === 'string' ? ticket.thoi_gian_check_in.slice(11, 16) : getTimeString())
            : getTimeString(),
        waitTimeMinutes: ticket.thoi_gian_cho_phut || 0,
        status: ticket.trang_thai || 'CHO_KHAM',
        callCount: ticket.so_lan_goi || 0,
        priority: ticket.muc_do_uu_tien === 1 ? 'EMERGENCY' : (ticket.muc_do_uu_tien <= 3 ? 'PRIORITY' : 'NORMAL'),
        muc_do_uu_tien: ticket.muc_do_uu_tien || 5,
        priorityReason: ticket.ghi_chu_dieu_phoi || '',
        notes: ticket.ghi_chu_dieu_phoi || '',
        isWalkIn: ticket.loai_hang_doi === 'vang_lai' || !ticket.lich_kham_id,
        stages: [{ stage: 'CHECK_IN', time: getTimeString(), room: ticket.phong_kham || 'Quầy tiếp tân' }],
        logs: [`${getTimeString()}: Tiếp nhận thành công, cấp số ${ticketNum}`],
    }
}

// ── 1. Tải toàn bộ danh mục & hàng đợi khởi tạo ─────────────────────────
export const fetchReceptionDataAsync = createAsyncThunk(
    'reception/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const [specsRes, roomsRes, flowRes, docsRes] = await Promise.allSettled([
                receptionService.getSpecialties(),
                receptionService.getRooms(),
                receptionService.getFlowBoard(),
                receptionService.getDoctors(),
            ])

            const departments = specsRes.status === 'fulfilled'
                ? (unwrapApi(specsRes.value) || []).map((s) => ({
                    id: s.id,
                    name: s.ten_chuyen_khoa || s.name,
                    code: s.ma_chuyen_khoa || s.code,
                    room: s.vi_tri_phong || s.room,
                }))
                : FIVE_SPECIALTIES

            const rooms = roomsRes.status === 'fulfilled'
                ? (unwrapApi(roomsRes.value) || []).map((r) => ({
                    id: r.id || r.ma_phong,
                    code: r.ma_phong,
                    name: r.ten_phong,
                    departmentId: r.chuyen_khoa_id,
                    currentWaiting: r.so_benh_nhan_cho || 0,
                    isOperational: r.dang_hoat_dong !== false,
                }))
                : []

            const doctors = docsRes.status === 'fulfilled'
                ? (unwrapApi(docsRes.value) || []).map((d) => ({
                    id: d.id,
                    name: d.ho_ten || d.name,
                    departmentId: d.chuyen_khoa_id,
                    room: d.phong_lam_viec,
                    isAvailable: d.is_active !== false,
                }))
                : []

            const flowData = flowRes.status === 'fulfilled' ? unwrapApi(flowRes.value) : null
            const rawQueue = flowData?.danh_sach || (Array.isArray(flowData) ? flowData : [])
            const queueEntries = rawQueue.map((t) => normalizeTicket(t))

            return {
                departments: departments.length > 0 ? departments : FIVE_SPECIALTIES,
                rooms,
                doctors,
                queueEntries,
            }
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Lỗi tải dữ liệu quầy lễ tân'))
        }
    }
)

// ── 2. Hàng đợi Flow Board ──────────────────────────────────────────────
export const fetchFlowBoardAsync = createAsyncThunk(
    'reception/fetchFlowBoard',
    async ({ queryDate, doctorId } = {}, { rejectWithValue }) => {
        try {
            const res = await receptionService.getFlowBoard({
                query_date: queryDate || undefined,
                doctor_id: doctorId || undefined,
            })
            const data = unwrapApi(res)
            const rawList = data?.danh_sach || (Array.isArray(data) ? data : [])
            return rawList.map((t) => normalizeTicket(t))
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Lỗi lấy bảng hàng đợi'))
        }
    }
)

// ── 3. Tiếp nhận nhanh 30s (Walk-in Quick) ──────────────────────────────
export const registerWalkInQuickAsync = createAsyncThunk(
    'reception/registerWalkInQuick',
    async ({ payload, actor: _actor }, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.walkInQuick({
                ho_ten: payload.fullName || payload.ho_ten,
                so_dien_thoai: payload.phone || payload.so_dien_thoai,
                gioi_tinh: payload.gender || payload.gioi_tinh || 'Khác',
                nam_sinh: payload.birthYear ? Number(payload.birthYear) : (payload.dob ? new Date(payload.dob).getFullYear() : null),
                chuyen_khoa_id: payload.departmentId && !isNaN(payload.departmentId) ? Number(payload.departmentId) : null,
                bac_si_id: payload.doctorId && !isNaN(payload.doctorId) ? Number(payload.doctorId) : null,
                ca_kham: payload.shift || 'sang',
                ly_do_kham: payload.notes || 'Khám bệnh vãng lai',
                ly_do_uu_tien: payload.priorityReason || null,
            })
            const data = unwrapApi(res)
            const ticket = normalizeTicket(data, {
                fullName: payload.fullName || payload.ho_ten,
                phone: payload.phone || payload.so_dien_thoai,
            })
            try {
                clinicalEventBridge.emit(CLINICAL_EVENTS.PATIENT_CHECKED_IN, { queueEntry: ticket })
            } catch {
                // Event bridge optional
            }
            dispatch(fetchFlowBoardAsync())
            return ticket
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Tiếp nhận nhanh thất bại'))
        }
    }
)

// ── 4. Tiếp nhận vãng lai chi tiết (Walk-in) ─────────────────────────────
export const registerWalkInAsync = createAsyncThunk(
    'reception/registerWalkIn',
    async ({ payload, actor: _actor }, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.walkIn({
                benh_nhan_id: Number(payload.patientId) || payload.patientId,
                bac_si_id: payload.doctorId && !isNaN(payload.doctorId) ? Number(payload.doctorId) : null,
                chuyen_khoa_id: payload.departmentId && !isNaN(payload.departmentId) ? Number(payload.departmentId) : null,
                ca_kham: payload.shift || 'sang',
                ly_do_kham: payload.notes || 'Khám bệnh vãng lai',
                ghi_chu: payload.notes,
                ly_do_uu_tien: payload.priorityReason || (payload.priority === 'EMERGENCY' ? 'cap_cuu_nhe' : (payload.priority === 'PRIORITY' ? 'nguoi_gia' : null)),
            })
            const data = unwrapApi(res)
            const ticket = normalizeTicket(data)
            try {
                clinicalEventBridge.emit(CLINICAL_EVENTS.PATIENT_CHECKED_IN, { queueEntry: ticket })
            } catch {
                // Event bridge optional
            }
            dispatch(fetchFlowBoardAsync())
            return ticket
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Tiếp nhận bệnh nhân vãng lai thất bại'))
        }
    }
)

// ── 5. Check-in cho bệnh nhân đã có lịch hẹn ───────────────────────────
export const checkInAppointmentAsync = createAsyncThunk(
    'reception/checkInAppointment',
    async ({ payload, actor: _actor }, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.checkIn({
                lich_kham_id: Number(payload.appointmentId) || payload.appointmentId,
                ghi_chu: payload.notes || undefined,
                ly_do_uu_tien: payload.priorityReason || (payload.priority === 'EMERGENCY' ? 'cap_cuu_nhe' : (payload.priority === 'PRIORITY' ? 'nguoi_gia' : null)),
            })
            const data = unwrapApi(res)
            const ticket = normalizeTicket(data)
            try {
                clinicalEventBridge.emit(CLINICAL_EVENTS.PATIENT_CHECKED_IN, {
                    queueEntry: ticket,
                    appointment: { id: payload.appointmentId },
                })
            } catch {
                // Event bridge optional
            }
            dispatch(fetchFlowBoardAsync())
            return ticket
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Check-in lịch hẹn thất bại'))
        }
    }
)

// ── 6. Tìm kiếm bệnh nhân theo SĐT / từ khóa (có phân trang) ───────────
export const searchPatientsAsync = createAsyncThunk(
    'reception/searchPatients',
    async ({ search, page = 1, pageSize = 15 }, { rejectWithValue }) => {
        try {
            const res = await receptionService.searchPatients({
                search: search?.trim() || undefined,
                page,
                page_size: pageSize,
            })
            const paged = unwrapPagedApi(res, pageSize)
            const mappedItems = paged.items.map((p) => ({
                id: p.id,
                patientCode: p.ma_dinh_danh_y_te || `BN-${p.id}`,
                fullName: p.ho_ten,
                phone: p.so_dien_thoai,
                identityCard: p.cccd_so,
                dob: p.ngay_sinh,
                gender: p.gioi_tinh === 'Nam' ? 'MALE' : (p.gioi_tinh === 'Nữ' ? 'FEMALE' : 'OTHER'),
                bloodType: p.nhom_mau,
                address: p.dia_chi,
                allergies: p.di_ung_thuoc || '',
            }))
            return {
                ...paged,
                items: mappedItems,
            }
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Tìm kiếm bệnh nhân thất bại'))
        }
    }
)

// ── 7. Chi tiết bệnh nhân (tiền sử dị ứng, địa chỉ) ───────────────────
export const getPatientDetailAsync = createAsyncThunk(
    'reception/getPatientDetail',
    async (patientId, { rejectWithValue }) => {
        try {
            const res = await receptionService.getPatientDetail(patientId)
            const d = unwrapApi(res)
            if (!d) return null
            return {
                id: d.id,
                patientCode: d.ma_dinh_danh_y_te,
                fullName: d.ho_ten,
                phone: d.so_dien_thoai,
                identityCard: d.cccd_so,
                dob: d.ngay_sinh,
                gender: d.gioi_tinh === 'Nam' ? 'MALE' : 'FEMALE',
                address: d.dia_chi,
                allergies: d.di_ung_thuoc || '',
                medicalHistory: d.tien_su_benh || '',
            }
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Không thể tải chi tiết bệnh nhân'))
        }
    }
)

// ── 8. Tạo mới & Cập nhật bệnh nhân ────────────────────────────────────
export const createPatientAsync = createAsyncThunk(
    'reception/createPatient',
    async ({ payload, actor: _actor }, { rejectWithValue }) => {
        try {
            const res = await receptionService.createPatient(payload)
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Tạo hồ sơ bệnh nhân thất bại'))
        }
    }
)

export const updatePatientAsync = createAsyncThunk(
    'reception/updatePatient',
    async ({ id, updates, actor: _actor }, { rejectWithValue }) => {
        try {
            const res = await receptionService.updatePatient(id, updates)
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Cập nhật hồ sơ bệnh nhân thất bại'))
        }
    }
)

// ── 9. Thao tác vé hàng đợi (Restore, Close, Leave, Call) ─────────────
export const resumeQueueEntryAsync = createAsyncThunk(
    'reception/resumeQueue',
    async ({ queueId, actor: _actor }, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.restoreTicket(queueId)
            dispatch(fetchFlowBoardAsync())
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Phục hồi vé thất bại'))
        }
    }
)

export const cancelQueueEntryAsync = createAsyncThunk(
    'reception/cancelQueue',
    async ({ queueId, reason, actor: _actor }, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.closeTicket(queueId, { ly_do: reason })
            dispatch(fetchFlowBoardAsync())
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Hủy vé thất bại'))
        }
    }
)

export const markAbsentAsync = createAsyncThunk(
    'reception/markAbsent',
    async ({ queueId, actor: _actor }, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.leaveQueue(queueId, { ly_do: 'Bệnh nhân vắng mặt' })
            dispatch(fetchFlowBoardAsync())
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Ghi nhận vắng mặt thất bại'))
        }
    }
)

export const callQueueEntryAsync = createAsyncThunk(
    'reception/callQueue',
    async ({ queueId }) => {
        return { queueId, calledAt: getTimeString() }
    }
)

export const deferQueueEntryAsync = createAsyncThunk(
    'reception/deferQueue',
    async ({ queueId, reason }) => {
        return { queueId, reason, deferredAt: getTimeString() }
    }
)

export const transferRoomAsync = createAsyncThunk(
    'reception/transferRoom',
    async ({ queueId, updates }) => {
        return { queueId, ...updates }
    }
)

export const reorderQueueAsync = createAsyncThunk(
    'reception/reorderQueue',
    async ({ queueId, payload }) => {
        return { queueId, ...payload }
    }
)

export const emergencyHandoverAsync = createAsyncThunk(
    'reception/emergencyHandover',
    async ({ payload }) => {
        return payload
    }
)

// ── 10. Lịch hẹn & Viện phí ─────────────────────────────────────────────
export const createAppointmentAsync = createAsyncThunk(
    'reception/createAppointment',
    async ({ payload, actor: _actor }, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.createAppointment(payload)
            dispatch(fetchReceptionDataAsync())
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Tạo lịch hẹn thất bại'))
        }
    }
)

export const updateAppointmentAsync = createAsyncThunk(
    'reception/updateAppointment',
    async ({ id, updates, actor: _actor }, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.updateAppointment(id, updates)
            dispatch(fetchReceptionDataAsync())
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Cập nhật lịch hẹn thất bại'))
        }
    }
)

export const cancelAppointmentAsync = createAsyncThunk(
    'reception/cancelAppointment',
    async ({ id, reason, actor: _actor }, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.cancelAppointment(id, { ly_do_huy: reason })
            dispatch(fetchReceptionDataAsync())
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Hủy lịch hẹn thất bại'))
        }
    }
)

export const updateInvoiceStatusAsync = createAsyncThunk(
    'reception/updateInvoice',
    async ({ invoiceId, payload, actor: _actor }, { rejectWithValue }) => {
        try {
            const res = await receptionService.payInvoice(invoiceId, {
                phuong_thuc_thanh_toan: payload?.paymentMethod || 'TIEN_MAT',
                ma_giao_dich: payload?.transactionRef,
            })
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Thanh toán hóa đơn thất bại'))
        }
    }
)

export const resetReceptionDataAsync = createAsyncThunk(
    'reception/resetAll',
    async (_, { dispatch }) => {
        return await dispatch(fetchReceptionDataAsync()).unwrap()
    }
)

export const switchReceptionRoleAsync = createAsyncThunk(
    'reception/switchRole',
    async (role) => role
)

export const resolveTaskAsync = createAsyncThunk(
    'reception/resolveTask',
    async ({ taskId, resolutionNote }) => ({ taskId, resolutionNote })
)
