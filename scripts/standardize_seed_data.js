import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const seedFilePath = path.resolve(__dirname, '../src/mock/reception/seedData.js')
let content = fs.readFileSync(seedFilePath, 'utf-8')

const newHeaders = `// Mock Data khởi tạo ban đầu cho Cổng Lễ Tân Phòng Khám Đa Khoa (5 Chuyên Khoa Chuẩn)
import { APPOINTMENT_STATUS, QUEUE_STATUS, PAYMENT_STATUS, TASK_SEVERITY } from '../../utils/constants/receptionConstants'

export const initialDepartments = [
    { id: 'DEP01', realId: 1, name: 'Khoa Nội Tổng Quát', code: 'NOI', icon: 'HeartPulse', description: 'Khám và điều trị các bệnh lý nội khoa tổng hợp, tim mạch, tiêu hóa, hô hấp, đái tháo đường, tăng huyết áp' },
    { id: 'DEP824', realId: 824, name: 'Khoa Ngoại', code: 'NGOAI', icon: 'FirstAidKit', description: 'Khám ngoại khoa, tiểu phẫu, xử lý vết thương phần mềm, trích rạch áp xe, u bã đậu, cắt chỉ' },
    { id: 'DEP04', realId: 4, name: 'Khoa Tai Mũi Họng', code: 'TMH', icon: 'Ear', description: 'Khám và nội soi tai mũi họng, hút rửa xoang, điều trị viêm họng, viêm amidan, viêm tai giữa, tiền đình' },
    { id: 'DEP825', realId: 825, name: 'Khoa Răng', code: 'RANG', icon: 'Tooth', description: 'Nha khoa tổng quát, khám răng, lấy cao răng, hàn răng sâu, nhổ răng số 8, điều trị tủy, viêm nướu' },
    { id: 'DEP826', realId: 826, name: 'Khoa Mắt', code: 'MAT', icon: 'Eye', description: 'Khám thị lực, đo khúc xạ tự động, soi đáy mắt, điều trị đau mắt đỏ, dị vật mắt, tật khúc xạ' },
]

export const initialDoctors = [
    { id: 'DOC04', realId: 4, name: 'PGS.TS Phạm Đức Minh', departmentId: 'DEP01', roomDefault: 'ROOM101', status: 'AVAILABLE', shift: 'Sáng + Chiều', experience: '22 năm kinh nghiệm' },
    { id: 'DOC13832', realId: 13832, name: 'BS. CKII Nguyễn Minh Hoàng', departmentId: 'DEP01', roomDefault: 'ROOM102', status: 'AVAILABLE', shift: 'Sáng + Chiều', experience: '16 năm kinh nghiệm' },
    { id: 'DOC13833', realId: 13833, name: 'ThS. BS Đặng Hải Phương', departmentId: 'DEP824', roomDefault: 'ROOM201', status: 'AVAILABLE', shift: 'Sáng + Chiều', experience: '14 năm kinh nghiệm' },
    { id: 'DOC03', realId: 3, name: 'BS. Lê Hoàng Long', departmentId: 'DEP04', roomDefault: 'ROOM202', status: 'AVAILABLE', shift: 'Sáng + Chiều', experience: '10 năm kinh nghiệm' },
    { id: 'DOC13834', realId: 13834, name: 'BS. CKII Trần Quốc Huy', departmentId: 'DEP825', roomDefault: 'ROOM301', status: 'AVAILABLE', shift: 'Sáng + Chiều', experience: '18 năm kinh nghiệm' },
    { id: 'DOC13835', realId: 13835, name: 'ThS. BS Lê Ngọc Lan', departmentId: 'DEP826', roomDefault: 'ROOM302', status: 'AVAILABLE', shift: 'Sáng + Chiều', experience: '12 năm kinh nghiệm' },
]

export const initialRooms = [
    { id: 'ROOM101', realId: 1, name: 'Phòng 101 - Khám Nội 1', departmentId: 'DEP01', floor: 'Tầng 1', capacity: 25, currentWaiting: 2, status: 'NORMAL' },
    { id: 'ROOM102', realId: 2, name: 'Phòng 102 - Khám Nội 2', departmentId: 'DEP01', floor: 'Tầng 1', capacity: 25, currentWaiting: 1, status: 'NORMAL' },
    { id: 'ROOM201', realId: 824, name: 'Phòng 201 - Khám Ngoại & Tiểu phẫu', departmentId: 'DEP824', floor: 'Tầng 2', capacity: 20, currentWaiting: 2, status: 'NORMAL' },
    { id: 'ROOM202', realId: 3, name: 'Phòng 202 - Khám & Nội soi TMH', departmentId: 'DEP04', floor: 'Tầng 2', capacity: 20, currentWaiting: 1, status: 'NORMAL' },
    { id: 'ROOM301', realId: 825, name: 'Phòng 301 - Nha Khoa & Răng', departmentId: 'DEP825', floor: 'Tầng 3', capacity: 18, currentWaiting: 1, status: 'NORMAL' },
    { id: 'ROOM302', realId: 826, name: 'Phòng 302 - Khám Mắt & Khúc xạ', departmentId: 'DEP826', floor: 'Tầng 3', capacity: 20, currentWaiting: 1, status: 'NORMAL' },
]

export const initialServices = [
    { id: 'SRV01', code: 'KB-NOI-01', name: 'Khám Nội Tổng Quát', departmentId: 'DEP01', price: 150000, duration: 15 },
    { id: 'SRV02', code: 'KB-NOI-02', name: 'Khám Chuyên Sâu Tim Mạch & Huyết Áp', departmentId: 'DEP01', price: 250000, duration: 25 },
    { id: 'SRV03', code: 'KB-NGOAI-01', name: 'Khám Ngoại Khoa & Tiểu Phẫu', departmentId: 'DEP824', price: 200000, duration: 20 },
    { id: 'SRV04', code: 'KB-NGOAI-02', name: 'Tiểu Phẫu Vết Thương & Cắt Chỉ', departmentId: 'DEP824', price: 350000, duration: 30 },
    { id: 'SRV05', code: 'KB-TMH-01', name: 'Khám & Nội Soi Tai Mũi Họng', departmentId: 'DEP04', price: 220000, duration: 20 },
    { id: 'SRV06', code: 'KB-TMH-02', name: 'Hút Rửa Xoang & Làm Sạch Tai', departmentId: 'DEP04', price: 180000, duration: 20 },
    { id: 'SRV07', code: 'KB-RANG-01', name: 'Khám Răng & Lấy Cao Răng Sóng Siêu Âm', departmentId: 'DEP825', price: 180000, duration: 30 },
    { id: 'SRV08', code: 'KB-RANG-02', name: 'Nhổ Răng Khôn & Trám Răng Sâu', departmentId: 'DEP825', price: 500000, duration: 40 },
    { id: 'SRV09', code: 'KB-MAT-01', name: 'Khám Mắt & Đo Khúc Xạ Kính Tự Động', departmentId: 'DEP826', price: 160000, duration: 15 },
    { id: 'SRV10', code: 'KB-MAT-02', name: 'Soi Đáy Mắt & Tầm Soát Glaucoma', departmentId: 'DEP826', price: 300000, duration: 25 },
]

export const initialTimeSlots = [
    '07:30 - 08:00', '08:00 - 08:30', '08:30 - 09:00', '09:00 - 09:30',
    '09:30 - 10:00', '10:00 - 10:30', '10:30 - 11:00', '11:00 - 11:30',
    '13:30 - 14:00', '14:00 - 14:30', '14:30 - 15:00', '15:00 - 15:30',
    '15:30 - 16:00', '16:00 - 16:30'
]
`

// Cut off the old initialDepartments, initialDoctors, initialRooms, initialServices, initialTimeSlots
const patientIndex = content.indexOf('// 32 Bệnh nhân giả lập')
if (patientIndex === -1) {
    console.error('Could not find patientIndex')
    process.exit(1)
}

let restOfFile = content.slice(patientIndex)

// Replacement maps for appointments, queue, etc.
const replacements = [
    // Departments
    { from: /'DEP05'/g, to: "'DEP824'" },
    { from: /'DEP02'/g, to: "'DEP04'" },
    { from: /'DEP03'/g, to: "'DEP825'" },
    { from: /'DEP04'/g, to: "'DEP826'" },

    // Doctors
    { from: /'DOC08'/g, to: "'DOC13833'" },
    { from: /'DOC07'/g, to: "'DOC13835'" },
    { from: /'DOC05'/g, to: "'DOC13834'" },
    { from: /'DOC06'/g, to: "'DOC13834'" },
    { from: /'DOC03'/g, to: "'DOC03'" },
    { from: /'DOC04'/g, to: "'DOC03'" },
    { from: /'DOC02'/g, to: "'DOC13832'" },
    { from: /'DOC01'/g, to: "'DOC04'" },

    // Rooms
    { from: /'ROOM501'/g, to: "'ROOM201'" },
    { from: /'ROOM401'/g, to: "'ROOM302'" },
    { from: /'ROOM302'/g, to: "'ROOM302'" },
    { from: /'ROOM301'/g, to: "'ROOM301'" },
    { from: /'ROOM202'/g, to: "'ROOM202'" },
    { from: /'ROOM201'/g, to: "'ROOM201'" },

    // Services
    { from: /'SRV07'/g, to: "'SRV03'" },
    { from: /'SRV06'/g, to: "'SRV09'" },
    { from: /'SRV05'/g, to: "'SRV08'" },
    { from: /'SRV04'/g, to: "'SRV07'" },
    { from: /'SRV03'/g, to: "'SRV05'" },
]

for (const { from, to } of replacements) {
    restOfFile = restOfFile.replace(from, to)
}

const finalContent = newHeaders + '\n' + restOfFile
fs.writeFileSync(seedFilePath, finalContent, 'utf-8')
console.log('Successfully standardized seedData.js with 5 departments and 6 doctors.')
