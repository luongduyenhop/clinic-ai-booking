import { bookingService } from './BookingService.js'
import { doctors, specialties } from '../../data/user/publicPortalData.js'
import { demoAppointments, doctorShiftPatterns, labResults, medicalHistory, prescriptions } from '../../data/user/patientPortalData.js'

function delay(ms = 140) { return new Promise((resolve) => window.setTimeout(resolve, ms)) }
function toDateValue(date) { return date.toISOString().slice(0, 10) }

function decorateAppointment(item) {
    const doctor = doctors.find((entry) => entry.id === item.doctorId)
    const specialty = specialties.find((entry) => entry.id === item.specialtyId)
    return { ...item, doctorName: doctor?.name || 'Đang phân công', specialtyName: specialty?.name || 'Chưa xác định' }
}

function buildDoctorSchedules() {
    const dates = Array.from({ length: 7 }, (_, offset) => {
        const date = new Date()
        date.setHours(0, 0, 0, 0)
        date.setDate(date.getDate() + offset)
        return toDateValue(date)
    })
    return doctors.flatMap((doctor, doctorIndex) => dates
        .filter((_, dayIndex) => (dayIndex + doctorIndex) % 3 !== 2)
        .map((date) => ({ id: `${doctor.id}-${date}`, doctorId: doctor.id, doctorName: doctor.name, specialtyId: doctor.specialtyId, specialty: doctor.specialty, date, shifts: doctorShiftPatterns[doctor.id] || ['07:30 - 11:30'] })))
}

class PatientPortalService {
    async getPortalData() {
        const savedAppointments = await bookingService.getBookings()
        await delay()
        const appointmentMap = new Map([...savedAppointments, ...demoAppointments].map((item) => [item.id, decorateAppointment(item)]))
        return {
            appointments: [...appointmentMap.values()].sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate)),
            medicalHistory,
            prescriptions,
            labResults,
            doctorSchedules: buildDoctorSchedules(),
        }
    }
}

export const patientPortalService = new PatientPortalService()
