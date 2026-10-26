import fs from 'fs'
const p = 'd:/dowload/tailieu/clinic-ai/src/pages/admin/ClinicalExamPage.jsx'
let c = fs.readFileSync(p, 'utf8')

const oldDept = `const DEPARTMENTS = [
    { id: 'CHUNG', label: 'Khám chung & Sinh hiệu', icon: 'Stethoscope' },
    { id: 'NOI', label: 'Khoa Nội (Tim mạch/Hô hấp)', icon: 'Heartbeat' },
    { id: 'NGOAI', label: 'Khoa Ngoại & Tiểu phẫu', icon: 'FirstAidKit' },
    { id: 'MAT', label: 'Khoa Mắt (Nhãn khoa)', icon: 'Eye' },
    { id: 'TMH', label: 'Khoa Tai Mũi Họng', icon: 'Ear' },
    { id: 'RHM', label: 'Khoa Răng Hàm Mặt', icon: 'Tooth' },
]`

const newDept = `const DEPARTMENTS = [
    { id: 'CHUNG', label: 'Khám chung & Sinh hiệu', icon: 'Stethoscope' },
    { id: 'NOI', label: 'Khoa Nội tổng quát', icon: 'Heartbeat' },
    { id: 'NGOAI', label: 'Khoa Ngoại', icon: 'FirstAidKit' },
    { id: 'TMH', label: 'Khoa Tai Mũi Họng', icon: 'Ear' },
    { id: 'RHM', label: 'Khoa Răng', icon: 'Tooth' },
    { id: 'MAT', label: 'Khoa Mắt', icon: 'Eye' },
]`

const isCRLF = c.includes('\r\n')
let normalized = c.replace(/\r\n/g, '\n')
let normalizedOld = oldDept.replace(/\r\n/g, '\n')

if (normalized.includes(normalizedOld)) {
    normalized = normalized.replace(normalizedOld, newDept.replace(/\r\n/g, '\n'))
    if (isCRLF) normalized = normalized.replace(/\n/g, '\r\n')
    fs.writeFileSync(p, normalized, 'utf8')
    console.log('ClinicalExamPage.jsx departments updated!')
} else {
    console.log('ClinicalExamPage.jsx DEPARTMENTS pattern not found')
}
