import { http } from '../BaseService.js'
import { doctors } from '../../data/user/publicPortalData.js'

const STORAGE_KEY = 'clinic_patient_appointments_v2'

function readBookings() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function writeBookings(bookings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings))
}

function delay(ms = 180) { return new Promise((resolve) => window.setTimeout(resolve, ms)) }

class BookingService {
    async getBookings() {
        try {
            const res = await http.get('/api/v1/appointments/my-appointments')
            if (res?.data?.data && Array.isArray(res.data.data)) {
                const backendList = res.data.data.map((item) => ({
                    id: `BE-${item.id}`,
                    realId: item.id,
                    appointmentCode: item.ma_lich_kham || `APT-${item.id}`,
                    doctorId: `DOC${String(item.bac_si_id).padStart(2, '0')}`,
                    doctorName: item.bac_si?.ho_ten || 'Bác sĩ phụ trách',
                    appointmentDate: item.ngay_kham,
                    timeSlot: item.gio_kham?.slice(0, 5) || '08:00',
                    status: item.trang_thai,
                    reason: item.ly_do_kham,
                    createdAt: item.created_at,
                }))
                const localList = readBookings()
                return [...backendList, ...localList.filter((l) => !backendList.some((b) => b.realId === l.realId))]
            }
        } catch {
            // Khách chưa đăng nhập hoặc mạng ngoại tuyến, đọc từ storage cục bộ
        }
        await delay(60)
        return readBookings()
    }

    async getAvailableSlots({ doctorId, appointmentDate }) {
        const doc = doctors.find((d) => d.id === doctorId || String(d.realId) === String(doctorId))
        const realDoctorId = doc ? doc.realId : doctorId
        const res = await http.get(`/api/v1/appointments/doctors/${realDoctorId}/slots`, { params: { query_date: appointmentDate } })
        if (!Array.isArray(res?.data?.data?.slots)) throw new Error('Dữ liệu khung giờ không hợp lệ')
        return res.data.data.slots.filter((slot) => slot.status === 'available').map((slot) => ({
            value: slot.time_str,
            available: true,
        }))
    }

    async createBooking(payload) {
        await delay()
        const bookings = readBookings()
        const conflict = bookings.some((item) => item.doctorId === payload.doctorId && item.appointmentDate === payload.appointmentDate && item.timeSlot === payload.timeSlot && item.status !== 'CANCELLED')
        if (conflict) throw new Error('Khung giờ này vừa được đặt. Vui lòng chọn khung giờ khác.')

        let backendRecord = null
        try {
            const doc = doctors.find((d) => d.id === payload.doctorId || String(d.realId) === String(payload.doctorId))
            const realDoctorId = doc ? doc.realId : payload.doctorId
            const startTime = (payload.timeSlot || '').split(' - ')[0] || payload.timeSlot
            const apiPayload = {
                bac_si_id: Number(realDoctorId),
                ngay_kham: payload.appointmentDate,
                gio_kham: startTime.length === 5 ? `${startTime}:00` : startTime,
                ly_do_kham: payload.patient?.reason || 'Khám theo lịch hẹn',
                trieu_chung_ban_dau: payload.patient?.reason || ''
            }
            const res = await http.post('/api/v1/appointments', apiPayload)
            if (res?.data?.data) {
                backendRecord = res.data.data
            }
        } catch (apiErr) {
            throw new Error(apiErr.response?.data?.message || 'Không thể xác nhận lịch hẹn. Vui lòng tải lại khung giờ và thử lại.')
        }

        if (!backendRecord?.id || !backendRecord?.ma_lich_kham) throw new Error('Backend chưa xác nhận lịch hẹn. Vui lòng thử lại.')
        const datePart = payload.appointmentDate.replaceAll('-', '')
        const sequence = String(bookings.length + 1).padStart(4, '0')
        const booking = {
            ...payload,
            id: backendRecord?.id ? `BE-${backendRecord.id}` : `PB-${Date.now()}`,
            realId: backendRecord?.id || null,
            appointmentCode: backendRecord?.ma_lich_kham || `KCB-${datePart}-${sequence}`,
            status: backendRecord?.trang_thai || 'PENDING',
            createdAt: new Date().toISOString()
        }
        bookings.unshift(booking)
        writeBookings(bookings)
        return booking
    }
}

export const bookingService = new BookingService()
