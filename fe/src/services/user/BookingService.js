import { http } from '../BaseService.js'
import { bookingSlots, doctors } from '../../data/user/publicPortalData.js'

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

        if (realDoctorId) {
            try {
                const res = await http.get(`/api/v1/appointments/doctors/${realDoctorId}/slots`, {
                    params: { query_date: appointmentDate }
                })
                if (res?.data?.data?.slots && Array.isArray(res.data.data.slots)) {
                    return res.data.data.slots.map((s) => {
                        const timeStr = s.time_str
                        const [h, m] = timeStr.split(':').map(Number)
                        let endM = m + 30
                        let endH = h
                        if (endM >= 60) {
                            endM -= 60
                            endH += 1
                        }
                        const rangeStr = `${timeStr} - ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
                        return {
                            value: rangeStr,
                            available: s.status === 'available'
                        }
                    })
                }
            } catch (err) {
                console.warn('API slots unavailable, using local slot rules:', err)
            }
        }

        await delay(80)
        const booked = readBookings().filter((item) => item.doctorId === doctorId && item.appointmentDate === appointmentDate && item.status !== 'CANCELLED')
        return bookingSlots.map((slot, index) => ({
            value: slot,
            available: !booked.some((item) => item.timeSlot === slot) && (index + String(doctorId).length + Number(appointmentDate.slice(-2))) % 6 !== 0,
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
            console.warn('Backend create appointment fallback to local cache:', apiErr)
        }

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
