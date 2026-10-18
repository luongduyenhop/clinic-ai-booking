import { bookingSlots } from '../../data/user/publicPortalData.js'

const STORAGE_KEY = 'clinic_patient_appointments_v1'

function readBookings() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function writeBookings(bookings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings))
}

function delay(ms = 180) { return new Promise((resolve) => window.setTimeout(resolve, ms)) }

class BookingService {
    async getBookings() {
        await delay(60)
        return readBookings()
    }

    async getAvailableSlots({ doctorId, appointmentDate }) {
        await delay(80)
        const booked = readBookings().filter((item) => item.doctorId === doctorId && item.appointmentDate === appointmentDate && item.status !== 'CANCELLED')
        return bookingSlots.map((slot, index) => ({
            value: slot,
            available: !booked.some((item) => item.timeSlot === slot) && (index + doctorId.length + Number(appointmentDate.slice(-2))) % 6 !== 0,
        }))
    }

    async createBooking(payload) {
        await delay()
        const bookings = readBookings()
        const conflict = bookings.some((item) => item.doctorId === payload.doctorId && item.appointmentDate === payload.appointmentDate && item.timeSlot === payload.timeSlot && item.status !== 'CANCELLED')
        if (conflict) throw new Error('Khung giờ này vừa được đặt. Vui lòng chọn khung giờ khác.')
        const datePart = payload.appointmentDate.replaceAll('-', '')
        const sequence = String(bookings.length + 1).padStart(4, '0')
        const booking = { ...payload, id: `PB-${Date.now()}`, appointmentCode: `KCB-${datePart}-${sequence}`, status: 'PENDING', createdAt: new Date().toISOString() }
        bookings.unshift(booking)
        writeBookings(bookings)
        return booking
    }
}

export const bookingService = new BookingService()
