import { createAsyncThunk } from '@reduxjs/toolkit'
import dayjs from 'dayjs'
import { receptionService } from '../../../services/reception/receptionService'
import { unwrapApi, unwrapPagedApi, pickErrorMessage } from '../../../utils/helpers/apiHelper'
import { clinicalEventBridge, CLINICAL_EVENTS } from '../../../services/clinicalEventBridge'

export function formatCheckInTime(val) {
    if (!val) return getTimeString()
    if (typeof val === 'string' && /^\d{2}:\d{2}$/.test(val)) return val
    try {
        let parseTarget = val
        const hasTz = typeof val === 'string' && (val.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(val))
        if (typeof val === 'string' && !hasTz) {
            parseTarget = val + 'Z'
        }
        const d = dayjs(parseTarget)
        if (d.isValid()) {
            return d.format('HH:mm')
        }
    } catch {
    }
    return typeof val === 'string' ? val.slice(11, 16) : getTimeString()
}

function getTimeString() {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function normalizeTicket(ticket, defaultPatient = null) {
    if (!ticket) return null
    const rawId = ticket.ticket_id ?? ticket.id
    const ticketNum = ticket.ma_so_thu_tu || (ticket.so_thu_tu_kham ? String(ticket.so_thu_tu_kham).padStart(2, '0') : '01')
    return {
        id: rawId ? `QUE${String(rawId).padStart(3, '0')}` : `QUE${String(Date.now()).slice(-4)}`,
        backendId: rawId,
        ticketNumber: ticketNum,
        ma_so_thu_tu: ticketNum,
        so_thu_tu_kham: ticket.so_thu_tu_kham,
        patientId: ticket.benh_nhan_id,
        patientName: ticket.ten_benh_nhan || defaultPatient?.fullName || defaultPatient?.ho_ten || 'Bệnh nhân',
        phone: ticket.so_dien_thoai || defaultPatient?.phone || defaultPatient?.so_dien_thoai || '',
        appointmentId: ticket.lich_kham_id,
        doctorId: ticket.bac_si_id,
        doctorName: ticket.ten_bac_si || '',
        roomId: ticket.phong_kham_id || ticket.phong_kham || '',
        backendRoomId: ticket.phong_kham_id || null,
        roomName: ticket.phong_kham || '',
        departmentId: ticket.chuyen_khoa_id,
        departmentName: ticket.chuyen_khoa || ticket.ten_chuyen_khoa || '',
        ca_kham: ticket.ca_kham || '',
        ngay_kham: ticket.ngay_kham || '',
        loai_hang_doi: ticket.loai_hang_doi || (ticket.lich_kham_id ? 'dung_hen' : 'vang_lai'),
        checkInTime: formatCheckInTime(ticket.thoi_gian_check_in),
        waitTimeMinutes: ticket.thoi_gian_cho_phut || 0,
        status: ticket.trang_thai || 'CHO_KHAM',
        trang_thai: ticket.trang_thai || 'CHO_KHAM',
        callCount: ticket.so_lan_goi || 0,
        priority: (/cấp cứu|cap_cuu/i.test(ticket.ghi_chu_dieu_phoi || '') || ticket.loai_hang_doi === 'cap_cuu') ? 'EMERGENCY' : ((ticket.muc_do_uu_tien === 1 || /ưu tiên|nguoi_gia|thai_phu|tre_so_sinh/i.test(ticket.ghi_chu_dieu_phoi || '')) ? 'PRIORITY' : 'NORMAL'),
        isEmergency: (/cấp cứu|cap_cuu/i.test(ticket.ghi_chu_dieu_phoi || '') || ticket.loai_hang_doi === 'cap_cuu'),
        isSpecialPriority: !(/cấp cứu|cap_cuu/i.test(ticket.ghi_chu_dieu_phoi || '') || ticket.loai_hang_doi === 'cap_cuu') && (ticket.muc_do_uu_tien === 1 || /ưu tiên|nguoi_gia|thai_phu|tre_so_sinh/i.test(ticket.ghi_chu_dieu_phoi || '')),
        muc_do_uu_tien: ticket.muc_do_uu_tien || (ticket.loai_hang_doi === 'cap_cuu' ? 1 : 5),
        priorityReason: ticket.ghi_chu_dieu_phoi || '',
        notes: ticket.ghi_chu_dieu_phoi || '',
        isWalkIn: ticket.loai_hang_doi === 'vang_lai' || (!ticket.lich_kham_id && ticket.loai_hang_doi !== 'cap_cuu' && ticket.loai_hang_doi !== 'sau_cls' && ticket.loai_hang_doi !== 'co_ket_qua_cls' && ticket.loai_hang_doi !== 'dung_hen' && ticket.loai_hang_doi !== 'den_som' && ticket.loai_hang_doi !== 'den_muon'),
        thoi_gian_xep_hang_lai: ticket.thoi_gian_xep_hang_lai || null,
        thoi_gian_check_in: ticket.thoi_gian_check_in || null,
        thoi_gian_goi_kham: ticket.thoi_gian_goi_kham || null,
        thoi_gian_bat_dau: ticket.thoi_gian_bat_dau || null,
        thoi_gian_ket_thuc: ticket.thoi_gian_ket_thuc || null,
        stages: [],
        logs: [],
    }
}

export const fetchReceptionDataAsync = createAsyncThunk(
    'reception/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const [specsRes, roomsRes, docsRes, srvsRes] = await Promise.allSettled([
                receptionService.getSpecialties(),
                receptionService.getRooms(),
                receptionService.getDoctors(),
                receptionService.getServices(),
            ])

            const departments = specsRes.status === 'fulfilled'
                ? (unwrapApi(specsRes.value) || []).map((s) => ({
                    id: s.id,
                    name: s.ten_chuyen_khoa || s.name,
                    code: s.ma_chuyen_khoa || s.code,
                    room: s.vi_tri_phong || s.room,
                }))
                : []

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
                    roomId: d.phong_kham_id,
                    phong_kham_id: d.phong_kham_id,
                    room: d.phong_lam_viec,
                    isAvailable: d.is_active !== false,
                }))
                : []

            const services = srvsRes.status === 'fulfilled'
                ? (unwrapApi(srvsRes.value) || []).map((s) => ({
                    id: s.id,
                    code: s.ma_dich_vu,
                    name: s.ten_dich_vu,
                    price: s.don_gia,
                    unit: s.don_vi_tinh,
                    group: s.nhom_dich_vu,
                }))
                : []

            return {
                departments,
                rooms,
                doctors,
                services,
            }
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Lỗi tải dữ liệu quầy lễ tân'))
        }
    }
)

export const fetchShiftDashboardAsync = createAsyncThunk(
    'reception/fetchShiftDashboard',
    async ({ queryDate, caKham } = {}, { rejectWithValue }) => {
        try {
            const params = {
                query_date: queryDate || undefined,
                ca_kham: caKham || undefined,
            }
            const [shiftRes, roomStatusRes] = await Promise.allSettled([
                receptionService.getShiftDashboard(params),
                receptionService.getRoomStatusDashboard(params),
            ])

            const shiftSummary = shiftRes.status === 'fulfilled' ? unwrapApi(shiftRes.value) : null
            const roomStatus = roomStatusRes.status === 'fulfilled' ? unwrapApi(roomStatusRes.value) : null

            return {
                shiftSummary,
                roomStatus: roomStatus?.danh_sach || roomStatus?.buong_kham || (Array.isArray(roomStatus) ? roomStatus : []),
            }
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Không thể tải thống kê ca trực lễ tân'))
        }
    }
)

export const fetchDoctorQueueAsync = createAsyncThunk(
    'reception/fetchDoctorQueue',
    async ({ doctorId, queryDate, caKham } = {}, { rejectWithValue }) => {
        try {
            const res = await receptionService.getDoctorQueue(doctorId, {
                query_date: queryDate || undefined,
                ca_kham: caKham || undefined,
            })
            const data = unwrapApi(res)
            const rawList = data?.danh_sach_tat_ca || [
                ...(data?.benh_nhan_dang_kham ? [data.benh_nhan_dang_kham] : []),
                ...(data?.danh_sach_cho_kham || []),
                ...(data?.danh_sach_tam_hoan || []),
                ...(data?.danh_sach_da_kham || []),
            ]
            return rawList.map((t) => normalizeTicket(t))
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Lỗi lấy bảng hàng đợi buồng khám'))
        }
    }
)

export const fetchFlowBoardAsync = createAsyncThunk(
    'reception/fetchFlowBoard',
    async ({ queryDate, caKham, doctorId, roomId } = {}, { rejectWithValue }) => {
        try {
            const res = await receptionService.getFlowBoard({
                query_date: queryDate || undefined,
                ca_kham: caKham || undefined,
                doctor_id: doctorId || undefined,
                room_id: roomId || undefined,
            })
            const data = unwrapApi(res)
            const rawList = data?.danh_sach || (Array.isArray(data) ? data : [])
            const items = rawList.map((t) => normalizeTicket(t))
            return {
                summary: {
                    ngayTheoDoi: data?.ngay_theo_doi,
                    tongSoTiepNhan: data?.tong_so_tiep_nhan ?? items.length,
                    soDangCho: data?.so_dang_cho ?? items.filter((x) => x.status === 'cho_kham' || x.status === 'dang_cho').length,
                    soDangKham: data?.so_dang_kham ?? items.filter((x) => x.status === 'dang_kham').length,
                    soTamHoan: data?.so_tam_hoan ?? items.filter((x) => x.status === 'tam_hoan').length,
                    soHoanThanh: data?.so_hoan_thanh ?? items.filter((x) => x.status === 'hoan_thanh' || x.status === 'da_kham').length,
                },
                items,
            }
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Lỗi lấy bảng hàng đợi'))
        }
    }
)

export const searchAppointmentsAsync = createAsyncThunk(
    'reception/searchAppointments',
    async ({ q, queryDate } = {}, { rejectWithValue }) => {
        try {
            const res = await receptionService.searchAppointments({
                q: q?.trim(),
                query_date: queryDate || undefined,
            })
            const data = unwrapApi(res)
            return Array.isArray(data) ? data : []
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Tìm kiếm lịch hẹn thất bại'))
        }
    }
)

export const fetchAppointmentsAsync = createAsyncThunk(
    'reception/fetchAppointments',
    async ({ queryDate, caKham, doctorId, specialtyId, status, search, page = 1, pageSize = 20 } = {}, { rejectWithValue }) => {
        try {
            const res = await receptionService.getAppointments({
                query_date: queryDate || undefined,
                ca_kham: caKham || undefined,
                bac_si_id: doctorId || undefined,
                chuyen_khoa_id: specialtyId || undefined,
                trang_thai: status || undefined,
                search: search || undefined,
                page,
                page_size: pageSize,
            })
            const paged = unwrapPagedApi(res, pageSize)
            return paged
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Không thể tải danh sách lịch hẹn'))
        }
    }
)

export const checkInAppointmentAsync = createAsyncThunk(
    'reception/checkInAppointment',
    async ({ appointmentId, payload, actor: _actor } = {}, { dispatch, rejectWithValue }) => {
        try {
            const aptId = appointmentId || payload?.appointmentId || payload?.lich_kham_id
            const res = await receptionService.checkIn({
                lich_kham_id: Number(aptId) || aptId,
                ghi_chu: payload?.notes || undefined,
                ly_do_uu_tien: payload?.priorityReason || (payload?.priority === 'EMERGENCY' ? 'cap_cuu_nhe' : (payload?.priority === 'PRIORITY' ? 'nguoi_gia' : null)),
            })
            const data = unwrapApi(res)
            const ticket = normalizeTicket(data)
            try {
                clinicalEventBridge.emit(CLINICAL_EVENTS.PATIENT_CHECKED_IN, {
                    queueEntry: ticket,
                    appointment: { id: aptId },
                })
            } catch {
            }
            return {
                ...ticket,
                ticket,
                appointmentId: aptId,
            }
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Check-in lịch hẹn thất bại'))
        }
    }
)

export const registerWalkInAsync = createAsyncThunk(
    'reception/registerWalkIn',
    async ({ payload, actor: _actor }, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.walkIn({
                benh_nhan_id: payload.patientId ? (Number(payload.patientId) || payload.patientId) : undefined,
                ho_ten: payload.fullName || payload.ho_ten || undefined,
                so_dien_thoai: payload.phone || payload.so_dien_thoai || undefined,
                gioi_tinh: payload.gender || payload.gioi_tinh || undefined,
                nam_sinh: payload.birthYear ? Number(payload.birthYear) : (payload.dob ? new Date(payload.dob).getFullYear() : undefined),
                bac_si_id: payload.doctorId && !isNaN(payload.doctorId) ? Number(payload.doctorId) : null,
                chuyen_khoa_id: payload.departmentId && !isNaN(payload.departmentId) ? Number(payload.departmentId) : null,
                ca_kham: payload.shift || 'sang',
                ly_do_kham: payload.notes || payload.reason || 'Khám bệnh vãng lai',
                ghi_chu: payload.notes || payload.reason,
                ly_do_uu_tien: payload.priorityReason || (payload.priority === 'EMERGENCY' ? 'cap_cuu_nhe' : (payload.priority === 'PRIORITY' ? 'nguoi_gia' : null)),
                dang_ky_waitlist_neu_het_cho: Boolean(payload.dangKyWaitlistNeuHetCho || payload.dang_ky_waitlist_neu_het_cho),
            })
            const data = unwrapApi(res)
            const ticket = normalizeTicket(data, {
                fullName: payload.fullName || payload.ho_ten,
                phone: payload.phone || payload.so_dien_thoai,
            })
            if (ticket.is_waitlist) {
                dispatch(fetchReceptionWaitlistAsync())
            } else {
                try {
                    clinicalEventBridge.emit(CLINICAL_EVENTS.PATIENT_CHECKED_IN, { queueEntry: ticket })
                } catch {
                }
                }
            return ticket
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Tiếp nhận bệnh nhân vãng lai thất bại'))
        }
    }
)

export const registerWalkInQuickAsync = registerWalkInAsync

export const fetchReceptionWaitlistAsync = createAsyncThunk(
    'reception/fetchWaitlist',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await receptionService.getWaitlist(params)
            const data = unwrapApi(res)
            return data?.items || []
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Lỗi tải danh sách chờ'))
        }
    }
)

export const checkInWaitlistAsync = createAsyncThunk(
    'reception/checkInWaitlist',
    async ({ waitlistId }, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.checkInWaitlist(waitlistId)
            const data = unwrapApi(res)
            const ticket = normalizeTicket(data)
            try {
                clinicalEventBridge.emit(CLINICAL_EVENTS.PATIENT_CHECKED_IN, { queueEntry: ticket })
            } catch {
            }
            dispatch(fetchReceptionWaitlistAsync())
            return ticket
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Tiếp nhận bệnh nhân từ danh sách chờ thất bại'))
        }
    }
)

export const cancelWaitlistAsync = createAsyncThunk(
    'reception/cancelWaitlist',
    async ({ waitlistId, lyDoHuy = 'Lễ tân hủy' }, { dispatch, rejectWithValue }) => {
        try {
            await receptionService.cancelWaitlist(waitlistId, { params: { ly_do_huy: lyDoHuy } })
            dispatch(fetchReceptionWaitlistAsync())
            return waitlistId
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Hủy lượt chờ thất bại'))
        }
    }
)

export const searchPatientsAsync = createAsyncThunk(
    'reception/searchPatients',
    async ({ search, page = 1, pageSize = 15 } = {}, { rejectWithValue }) => {
        try {
            const res = await receptionService.searchPatients({
                search: search?.trim() || undefined,
                page,
                page_size: pageSize,
            })
            const paged = unwrapPagedApi(res, pageSize)
            const mappedItems = (paged.items || []).map((p) => ({
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

export const getPatientDetailAsync = createAsyncThunk(
    'reception/getPatientDetail',
    async (patientId, { rejectWithValue }) => {
        try {
            const res = await receptionService.getPatientDetail(patientId)
            const d = unwrapApi(res)
            if (!d) return null
            return {
                id: d.id,
                nguoiDungId: d.nguoi_dung_id,
                patientCode: d.ma_dinh_danh_y_te || `BN-${d.id}`,
                fullName: d.ho_ten,
                phone: d.so_dien_thoai,
                email: d.email || '',
                identityCard: d.cccd_so || '',
                dob: d.ngay_sinh,
                gender: d.gioi_tinh === 'Nam' ? 'MALE' : (d.gioi_tinh === 'Nữ' ? 'FEMALE' : 'OTHER'),
                gioiTinh: d.gioi_tinh || 'Khác',
                address: d.dia_chi || '',
                bloodType: d.nhom_mau || 'O+',
                allergies: d.di_ung_thuoc || '',
                medicalHistory: d.tien_su_benh || '',
                creditScore: d.diem_tin_nhiem ?? 100,
                noShowCount: d.so_lan_no_show ?? 0,
                isBlockedBooking: Boolean(d.is_blocked_booking),
                raw: d,
            }
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Không thể tải chi tiết bệnh nhân'))
        }
    }
)

export const fetchPatientPackagesAsync = createAsyncThunk(
    'reception/fetchPatientPackages',
    async (patientId, { rejectWithValue }) => {
        try {
            const res = await receptionService.getPatientPackages(patientId)
            const data = unwrapApi(res)
            return Array.isArray(data) ? data : []
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Không thể tải danh sách gói khám của bệnh nhân'))
        }
    }
)

export const fetchPatientHistorySummaryAsync = createAsyncThunk(
    'reception/fetchPatientHistorySummary',
    async (patientId, { rejectWithValue }) => {
        try {
            const res = await receptionService.getPatientHistorySummary(patientId)
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Không thể tải tóm tắt lịch sử bệnh nhân'))
        }
    }
)

export const createPatientAsync = createAsyncThunk(
    'reception/createPatient',
    async ({ payload, actor: _actor }, { rejectWithValue }) => {
        try {
            const body = {
                ho_ten: payload.ho_ten || payload.fullName,
                so_dien_thoai: (payload.so_dien_thoai || payload.phone || '').trim(),
                ngay_sinh: payload.ngay_sinh || payload.dob || undefined,
                nam_sinh: payload.nam_sinh || (payload.dob ? Number(payload.dob.slice(0, 4)) : undefined),
                gioi_tinh: payload.gioi_tinh || (payload.gender === 'MALE' ? 'Nam' : (payload.gender === 'FEMALE' ? 'Nữ' : 'Khác')),
                dia_chi: payload.dia_chi || payload.address || undefined,
                cccd_so: payload.cccd_so || payload.identityCard || undefined,
                di_ung_thuoc: payload.di_ung_thuoc || payload.allergies || undefined,
                tien_su_benh: payload.tien_su_benh || payload.medicalHistory || payload.note || undefined,
                nhom_mau: payload.nhom_mau || payload.bloodType || 'O+',
            }
            const res = await receptionService.createPatient(body)
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
            const body = {
                ho_ten: updates.ho_ten || updates.fullName || undefined,
                so_dien_thoai: (updates.so_dien_thoai || updates.phone || '').trim() || undefined,
                ngay_sinh: updates.ngay_sinh || updates.dob || undefined,
                nam_sinh: updates.nam_sinh || (updates.dob ? Number(updates.dob.slice(0, 4)) : undefined),
                gioi_tinh: updates.gioi_tinh || (updates.gender === 'MALE' ? 'Nam' : (updates.gender === 'FEMALE' ? 'Nữ' : (updates.gender ? 'Khác' : undefined))),
                dia_chi: updates.dia_chi || updates.address || undefined,
                cccd_so: updates.cccd_so || updates.identityCard || undefined,
                di_ung_thuoc: updates.di_ung_thuoc || updates.allergies || undefined,
                tien_su_benh: updates.tien_su_benh || updates.medicalHistory || updates.note || undefined,
                nhom_mau: updates.nhom_mau || updates.bloodType || undefined,
            }
            const res = await receptionService.updatePatient(id, body)
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Cập nhật hồ sơ bệnh nhân thất bại'))
        }
    }
)

export const resumeQueueEntryAsync = createAsyncThunk(
    'reception/resumeQueue',
    async ({ queueId, doctorId, queryDate, caKham, actor: _actor } = {}, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.restoreTicket(queueId)
            const ticket = unwrapApi(res)
            const targetDocId = doctorId || ticket?.bac_si_id
            const targetDate = queryDate || ticket?.ngay_kham
            const targetShift = caKham || ticket?.ca_kham
            const params = {
                queryDate: targetDate || undefined,
                caKham: targetShift === 'all' ? undefined : targetShift,
            }

            if (targetDocId) {
                await dispatch(fetchDoctorQueueAsync({ doctorId: targetDocId, ...params })).unwrap().catch(() => {})
            } else {
                await dispatch(fetchFlowBoardAsync(params)).unwrap().catch(() => {})
            }
            dispatch(fetchShiftDashboardAsync(params))
            dispatch(fetchReceptionWaitlistAsync())
            return ticket
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Phục hồi vé thất bại'))
        }
    }
)

export const cancelQueueEntryAsync = createAsyncThunk(
    'reception/cancelQueue',
    async ({ queueId, reason, doctorId, queryDate, caKham, actor: _actor } = {}, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.closeTicket(queueId, { ly_do: reason })
            const ticket = unwrapApi(res)
            const targetDocId = doctorId || ticket?.bac_si_id
            const targetDate = queryDate || ticket?.ngay_kham
            const targetShift = caKham || ticket?.ca_kham
            const params = {
                queryDate: targetDate || undefined,
                caKham: targetShift === 'all' ? undefined : targetShift,
            }

            if (targetDocId) {
                await dispatch(fetchDoctorQueueAsync({ doctorId: targetDocId, ...params })).unwrap().catch(() => {})
            } else {
                await dispatch(fetchFlowBoardAsync(params)).unwrap().catch(() => {})
            }
            dispatch(fetchShiftDashboardAsync(params))
            dispatch(fetchReceptionWaitlistAsync())
            return ticket
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Hủy vé thất bại'))
        }
    }
)

export const markAbsentAsync = createAsyncThunk(
    'reception/markAbsent',
    async ({ queueId, doctorId, queryDate, caKham, actor: _actor } = {}, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.leaveQueue(queueId, { ly_do: 'Bệnh nhân vắng mặt' })
            const ticket = unwrapApi(res)
            const targetDocId = doctorId || ticket?.bac_si_id
            const targetDate = queryDate || ticket?.ngay_kham
            const targetShift = caKham || ticket?.ca_kham
            const params = {
                queryDate: targetDate || undefined,
                caKham: targetShift === 'all' ? undefined : targetShift,
            }

            if (targetDocId) {
                await dispatch(fetchDoctorQueueAsync({ doctorId: targetDocId, ...params })).unwrap().catch(() => {})
            } else {
                await dispatch(fetchFlowBoardAsync(params)).unwrap().catch(() => {})
            }
            dispatch(fetchShiftDashboardAsync(params))
            dispatch(fetchReceptionWaitlistAsync())
            return ticket
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
    async ({ queueId, reason, doctorId, queryDate, caKham } = {}, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.postponeTicket(queueId, { ly_do: reason })
            const ticket = unwrapApi(res)
            const targetDocId = doctorId || ticket?.bac_si_id
            const targetDate = queryDate || ticket?.ngay_kham
            const targetShift = caKham || ticket?.ca_kham
            const params = {
                queryDate: targetDate || undefined,
                caKham: targetShift === 'all' ? undefined : targetShift,
            }

            if (targetDocId) {
                await dispatch(fetchDoctorQueueAsync({ doctorId: targetDocId, ...params })).unwrap().catch(() => {})
            } else {
                await dispatch(fetchFlowBoardAsync(params)).unwrap().catch(() => {})
            }
            dispatch(fetchShiftDashboardAsync(params))
            dispatch(fetchReceptionWaitlistAsync())
            return ticket
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Tạm hoãn lượt khám thất bại'))
        }
    }
)

export const transferRoomAsync = createAsyncThunk(
    'reception/transferRoom',
    async ({ queueId, updates, doctorId, queryDate, caKham } = {}, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.transferRoom(queueId, {
                phong_kham_id: Number(updates.newRoomId),
                bac_si_id: updates.newDoctorId ? Number(updates.newDoctorId) : undefined,
                ly_do: updates.reason,
            })
            const ticket = unwrapApi(res)
            const targetDocId = doctorId || updates.newDoctorId || ticket?.bac_si_id
            const targetDate = queryDate || ticket?.ngay_kham
            const targetShift = caKham || ticket?.ca_kham
            const params = {
                queryDate: targetDate || undefined,
                caKham: targetShift === 'all' ? undefined : targetShift,
            }

            if (targetDocId) {
                await dispatch(fetchDoctorQueueAsync({ doctorId: targetDocId, ...params })).unwrap().catch(() => {})
            } else {
                await dispatch(fetchFlowBoardAsync(params)).unwrap().catch(() => {})
            }
            dispatch(fetchShiftDashboardAsync(params))
            dispatch(fetchReceptionWaitlistAsync())
            return ticket
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Điều chuyển buồng khám thất bại'))
        }
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

export const fetchRosterAsync = createAsyncThunk(
    'reception/fetchRoster',
    async ({ queryDate, caKham, chuyenKhoaId } = {}, { rejectWithValue }) => {
        try {
            const res = await receptionService.getRoster({
                query_date: queryDate || undefined,
                ca_kham: caKham || undefined,
                chuyen_khoa_id: chuyenKhoaId || undefined,
            })
            const data = unwrapApi(res)
            return Array.isArray(data) ? data : []
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Không thể tải lịch trực của bác sĩ'))
        }
    }
)

export const fetchRosterTemplateAsync = createAsyncThunk(
    'reception/fetchRosterTemplate',
    async ({ thuTrongTuan } = {}, { rejectWithValue }) => {
        try {
            const res = await receptionService.getRosterTemplate({
                thu_trong_tuan: thuTrongTuan || undefined,
            })
            const data = unwrapApi(res)
            return Array.isArray(data) ? data : []
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Không thể tải khuôn mẫu ca trực định kỳ'))
        }
    }
)

export const fetchRoomsAsync = createAsyncThunk(
    'reception/fetchRooms',
    async ({ chuyenKhoaId } = {}, { rejectWithValue }) => {
        try {
            const res = await receptionService.getRooms({
                chuyen_khoa_id: chuyenKhoaId || undefined,
            })
            const data = unwrapApi(res)
            return Array.isArray(data) ? data : []
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Không thể tải danh mục buồng khám vật lý'))
        }
    }
)

export const fetchDoctorAbsencesAsync = createAsyncThunk(
    'reception/fetchDoctorAbsences',
    async ({ queryDate, caKham } = {}, { rejectWithValue }) => {
        try {
            const res = await receptionService.getDoctorAbsences({
                query_date: queryDate || undefined,
                ca_kham: caKham || undefined,
            })
            const data = unwrapApi(res)
            return Array.isArray(data) ? data : []
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Không thể tải danh sách bác sĩ nghỉ đột xuất'))
        }
    }
)

export const rebalanceQueueAsync = createAsyncThunk(
    'reception/rebalanceQueue',
    async ({ payload }, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.rebalanceQueue(payload)
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Điều chuyển hàng đợi thất bại'))
        }
    }
)

export const fetchAffectedPatientsAsync = createAsyncThunk(
    'reception/fetchAffectedPatients',
    async (incidentId, { rejectWithValue }) => {
        try {
            const res = await receptionService.getIncidentAffectedPatients(incidentId)
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Không thể tải danh sách bệnh nhân bị ảnh hưởng'))
        }
    }
)

export const cancelIncidentTicketsAsync = createAsyncThunk(
    'reception/cancelIncidentTickets',
    async (payload, { rejectWithValue }) => {
        try {
            const res = await receptionService.cancelIncidentTickets(payload)
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Hủy vé sự cố thất bại'))
        }
    }
)

export const processNoShowsAsync = createAsyncThunk(
    'reception/processNoShows',
    async ({ queryDate, caKham } = {}, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.processNoShows({
                query_date: queryDate || undefined,
                ca_kham: caKham || undefined,
            })
            dispatch(fetchAppointmentsAsync({ queryDate, caKham }))
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Quét xử lý No-show thất bại'))
        }
    }
)

export const processUnconfirmedAppointmentsAsync = createAsyncThunk(
    'reception/processUnconfirmedAppointments',
    async ({ hoursThreshold = 2.0 } = {}, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.processUnconfirmedAppointments({ hours_threshold: hoursThreshold })
            const data = unwrapApi(res)
            dispatch(fetchAppointmentsAsync())
            dispatch(fetchReceptionWaitlistAsync())
            return data
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Xử lý tự động hủy ca chưa xác nhận thất bại'))
        }
    }
)

export const createAppointmentAsync = createAsyncThunk(
    'reception/createAppointment',
    async ({ payload, actor: _actor }, { dispatch, rejectWithValue }) => {
        try {
            const body = {
                benh_nhan_id: payload.benh_nhan_id ? Number(payload.benh_nhan_id) : (payload.patientId ? Number(payload.patientId) : undefined),
                bac_si_id: payload.bac_si_id ? Number(payload.bac_si_id) : (payload.doctorId ? Number(payload.doctorId) : undefined),
                ngay_kham: payload.ngay_kham || payload.appointmentDate,
                gio_kham: payload.gio_kham || (payload.timeSlot ? payload.timeSlot.split(' - ')[0] : '08:00:00'),
                ly_do_kham: payload.ly_do_kham || payload.notes || payload.reason || 'Đặt lịch khám tại quầy',
                trieu_chung_ban_dau: payload.trieu_chung_ban_dau || payload.notes || undefined,
            }
            if (body.gio_kham && body.gio_kham.length === 5) {
                body.gio_kham = `${body.gio_kham}:00`
            }
            const res = await receptionService.createAppointment(body)
            const data = unwrapApi(res)
            try {
                clinicalEventBridge.emit(CLINICAL_EVENTS.APPOINTMENT_CREATED, { appointment: data })
            } catch {
            }
            dispatch(fetchReceptionDataAsync())
            return data
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Tạo lịch hẹn thất bại'))
        }
    }
)

export const fetchDoctorSlotsAsync = createAsyncThunk(
    'reception/fetchDoctorSlots',
    async ({ doctorId, queryDate }, { rejectWithValue }) => {
        try {
            const res = await receptionService.getDoctorSlots(doctorId, queryDate)
            const data = unwrapApi(res)
            return data?.slots || []
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Không thể lấy danh sách khung giờ bác sĩ'))
        }
    }
)

export const confirmAppointmentAsync = createAsyncThunk(
    'reception/confirmAppointment',
    async ({ appointmentId, actor: _actor }, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.confirmAppointment(appointmentId)
            const data = unwrapApi(res)
            return {
                appointmentId,
                ...data,
            }
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Xác nhận lịch hẹn thất bại'))
        }
    }
)

export const markAppointmentNoShowAsync = createAsyncThunk(
    'reception/markAppointmentNoShow',
    async ({ appointmentId, ghiChu, actor: _actor }, { dispatch, rejectWithValue }) => {
        try {
            const res = await receptionService.markNoShow(appointmentId, {
                ghi_chu: ghiChu?.trim() || 'Người bệnh không đến khám đúng ca trực',
            })
            const data = unwrapApi(res)
            return {
                appointmentId,
                ...data,
            }
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Ghi nhận vắng mặt thất bại'))
        }
    }
)

export const updateAppointmentAsync = createAsyncThunk(
    'reception/updateAppointment',
    async ({ id, updates, actor: _actor }, { dispatch, rejectWithValue }) => {
        try {
            let gioMoi = updates.gio_kham_moi || (updates.timeSlot ? updates.timeSlot.split(' - ')[0] : '08:00')
            if (gioMoi && gioMoi.length === 5) {
                gioMoi = `${gioMoi}:00`
            }
            const body = {
                ngay_kham_moi: updates.ngay_kham_moi || updates.appointmentDate,
                gio_kham_moi: gioMoi,
                bac_si_id_moi: updates.bac_si_id_moi || (updates.doctorId ? Number(updates.doctorId) : null),
                ly_do_doi: updates.ly_do_doi || updates.rescheduleReason || 'Lễ tân đổi lịch tại quầy',
            }
            const res = await receptionService.rescheduleAppointment(id, body)
            const data = unwrapApi(res)
            return {
                id,
                ...data,
            }
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Cập nhật lịch hẹn thất bại'))
        }
    }
)

export const cancelAppointmentAsync = createAsyncThunk(
    'reception/cancelAppointment',
    async ({ id, reason, actor: _actor }, { dispatch, rejectWithValue }) => {
        try {
            const cleanReason = (reason && reason.trim().length >= 5) ? reason.trim() : 'Hủy lịch hẹn theo yêu cầu bệnh nhân'
            const res = await receptionService.cancelAppointment(id, { ly_do_huy: cleanReason })
            const data = unwrapApi(res)
            return {
                id,
                ...data,
            }
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

export const fetchReportSummaryAsync = createAsyncThunk(
    'reception/fetchReportSummary',
    async ({ queryDate, caKham } = {}, { rejectWithValue }) => {
        try {
            const res = await receptionService.getReportSummary({
                query_date: queryDate || undefined,
                ca_kham: caKham || undefined,
            })
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Lỗi tải báo cáo đối soát tiếp đón'))
        }
    }
)

export const fetchAuditLogsAsync = createAsyncThunk(
    'reception/fetchAuditLogs',
    async ({ queryDate, actionType, search, page = 1, pageSize = 10 } = {}, { rejectWithValue }) => {
        try {
            const res = await receptionService.getAuditLogs({
                query_date: queryDate || undefined,
                ca_kham: caKham || undefined,
                action_type: actionType || undefined,
                search: search || undefined,
                page,
                page_size: pageSize,
            })
            const data = unwrapApi(res)
            return {
                items: data?.items || [],
                pagination: data?.pagination || {
                    page,
                    page_size: pageSize,
                    total_items: (data?.items || []).length,
                    total_pages: 1,
                    has_next: false,
                    has_prev: false,
                },
            }
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Lỗi tải nhật ký kiểm toán'))
        }
    }
)

export const fetchShiftPreCloseAuditAsync = createAsyncThunk(
    'reception/fetchShiftPreCloseAudit',
    async ({ caKham, queryDate } = {}, { rejectWithValue }) => {
        try {
            const res = await receptionService.getShiftPreCloseAudit({
                ca_kham: caKham,
                query_date: queryDate || undefined,
            })
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Lỗi đối soát trước đóng ca trực'))
        }
    }
)

export const closeReceptionShiftAsync = createAsyncThunk(
    'reception/closeReceptionShift',
    async (payload, { rejectWithValue }) => {
        try {
            const res = await receptionService.closeShift(payload)
            return unwrapApi(res)
        } catch (e) {
            return rejectWithValue(pickErrorMessage(e, 'Lỗi thực hiện đóng ca trực'))
        }
    }
)
