import fs from 'fs'
const p = 'd:/dowload/tailieu/clinic-ai/src/services/user/PatientPortalService.js'
let c = fs.readFileSync(p, 'utf8')

const oldDecorate = `function decorateAppointment(item) {
    const doctor = doctors.find((entry) => entry.id === item.doctorId)
    const specialty = specialties.find((entry) => entry.id === item.specialtyId)
    return {
        ...item,
        doctorName: doctor?.name || 'Đang phân công',
        specialtyName: specialty?.name || 'Chưa xác định',
    }
}`

const newDecorate = `function decorateAppointment(item) {
    const doctor = doctors.find((entry) => entry.id === item.doctorId || String(entry.realId) === String(item.doctorId) || (item.realId && entry.realId === item.realId))
    const specialty = specialties.find((entry) => entry.id === item.specialtyId || entry.code === item.specialtyId || String(entry.realId) === String(item.specialtyId))
    return {
        ...item,
        doctorName: item.doctorName || doctor?.name || 'Đang phân công',
        specialtyName: item.specialtyName || specialty?.name || 'Chưa xác định',
    }
}`

const isCRLF = c.includes('\r\n')
let normalized = c.replace(/\r\n/g, '\n')
let normalizedOld = oldDecorate.replace(/\r\n/g, '\n')

if (normalized.includes(normalizedOld)) {
    normalized = normalized.replace(normalizedOld, newDecorate.replace(/\r\n/g, '\n'))
    if (isCRLF) normalized = normalized.replace(/\n/g, '\r\n')
    fs.writeFileSync(p, normalized, 'utf8')
    console.log('decorateAppointment updated successfully!')
} else {
    console.log('Could not find old decorateAppointment block')
}
