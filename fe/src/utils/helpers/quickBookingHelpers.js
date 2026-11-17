export function getTodayIsoDate(now = new Date()) {
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function isValidFutureOrTodayIsoDate(value, todayIso = getTodayIsoDate()) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false
    }
    const [year, month, day] = value.split('-').map(Number)
    const parsed = new Date(year, month - 1, day)
    if (
        parsed.getFullYear() !== year ||
        parsed.getMonth() !== month - 1 ||
        parsed.getDate() !== day
    ) {
        return false
    }
    return value >= todayIso
}

export function buildQuickBookingPath({ specialtyId = '', doctorId = '', appointmentDate = '', doctors = [] } = {}) {
    const selectedDoctor = doctorId ? doctors.find((doc) => doc.id === doctorId) : null
    const resolvedSpecialtyId = specialtyId || selectedDoctor?.specialtyId || ''
    const params = new URLSearchParams()
    if (resolvedSpecialtyId) params.set('specialty', resolvedSpecialtyId)
    if (doctorId) params.set('doctor', doctorId)
    if (appointmentDate) params.set('date', appointmentDate)
    const query = params.toString()
    return query ? `/dat-lich?${query}` : '/dat-lich'
}

export function resolveBookingPrefill({
    specialties = [],
    doctors = [],
    requestedSpecialty = '',
    requestedDoctor = '',
    requestedDate = '',
    requestedSlot = '',
    todayIso = getTodayIsoDate(),
} = {}) {
    const specialty = specialties.find((item) => item.id === requestedSpecialty) || null
    const doctor =
        doctors.find(
            (item) =>
                item.id === requestedDoctor &&
                (!specialty || item.specialtyId === specialty.id)
        ) || null
    const resolvedSpecialtyId = specialty?.id || doctor?.specialtyId || ''
    const validDate = isValidFutureOrTodayIsoDate(requestedDate, todayIso) ? requestedDate : ''
    const hasDoctorAndDate = Boolean(doctor && validDate)
    const hasSuggestedSlot = Boolean(hasDoctorAndDate && requestedSlot)

    return {
        booking: {
            specialtyId: resolvedSpecialtyId,
            doctorId: doctor?.id || '',
            appointmentDate: validDate,
            timeSlot: hasSuggestedSlot ? requestedSlot : '',
        },
        initialStep: hasDoctorAndDate ? 2 : 1,
    }
}
