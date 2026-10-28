export const demoAppointments = [
    { id: 'demo-appt-1', appointmentCode: 'KCB-20261022-0001', specialtyId: 'noi', doctorId: 'bs-hoang', appointmentDate: '2026-10-22', timeSlot: '09:30 - 10:00', status: 'CONFIRMED', reason: 'Tái khám huyết áp' },
    { id: 'demo-appt-2', appointmentCode: 'KCB-20260912-0018', specialtyId: 'tmh', doctorId: 'bs-long', appointmentDate: '2026-09-12', timeSlot: '14:00 - 14:30', status: 'COMPLETED', reason: 'Đau họng kéo dài' },
]

export const medicalHistory = [
    { id: 'visit-001', code: 'HSK-260912-018', date: '2026-09-12', doctor: 'BS. Lê Hoàng Long', specialty: 'Khoa Tai Mũi Họng', diagnosis: 'Viêm họng cấp', symptoms: 'Đau họng, ho khan, sốt nhẹ', advice: 'Uống đủ nước, giữ ấm và tái khám nếu sốt kéo dài.', status: 'Hoàn thành' },
    { id: 'visit-002', code: 'HSK-260605-011', date: '2026-06-05', doctor: 'BS. CKII Nguyễn Minh Hoàng', specialty: 'Khoa Nội tổng quát', diagnosis: 'Rối loạn tiêu hóa', symptoms: 'Đau bụng âm ỉ, đầy hơi', advice: 'Ăn mềm, chia nhỏ bữa và theo dõi triệu chứng.', status: 'Hoàn thành' },
]

export const prescriptions = [
    { id: 'rx-001', code: 'DT-260912-018', visitId: 'visit-001', date: '2026-09-12', doctor: 'BS. Lê Hoàng Long', diagnosis: 'Viêm họng cấp', status: 'Đã cấp', note: 'Dùng thuốc sau ăn. Ngưng thuốc và liên hệ cơ sở y tế nếu có dấu hiệu dị ứng.', medicines: [
        { name: 'Amoxicillin 500mg', dosage: '1 viên/lần', frequency: 'Ngày 2 lần', duration: '5 ngày' },
        { name: 'Paracetamol 500mg', dosage: '1 viên khi sốt', frequency: 'Cách ít nhất 6 giờ', duration: 'Tối đa 3 ngày' },
    ] },
    { id: 'rx-002', code: 'DT-260605-011', visitId: 'visit-002', date: '2026-06-05', doctor: 'BS. CKII Nguyễn Minh Hoàng', diagnosis: 'Rối loạn tiêu hóa', status: 'Đã hết liệu trình', note: 'Tái khám nếu đau bụng tăng.', medicines: [
        { name: 'Smecta 3g', dosage: '1 gói/lần', frequency: 'Ngày 2 lần', duration: '3 ngày' },
    ] },
]

export const labResults = [
    { id: 'lab-001', code: 'XN-260912-032', date: '2026-09-12', visitId: 'visit-001', type: 'Xét nghiệm', name: 'Công thức máu', department: 'Khoa Xét nghiệm', status: 'Đã có kết quả', summary: 'Các chỉ số trong giới hạn tham chiếu; bạch cầu tăng nhẹ.', details: [{ label: 'WBC', value: '10.8 G/L', reference: '4.0–10.0' }, { label: 'HGB', value: '142 g/L', reference: '130–170' }] },
    { id: 'lab-002', code: 'CĐHA-260605-014', date: '2026-06-05', visitId: 'visit-002', type: 'Chẩn đoán hình ảnh', name: 'Siêu âm ổ bụng tổng quát', department: 'Khoa Chẩn đoán hình ảnh', status: 'Đã có kết quả', summary: 'Chưa ghi nhận bất thường rõ trên siêu âm.', details: [] },
]

export const doctorShiftPatterns = {
    'bs-minh': ['07:30 - 11:30', '13:30 - 16:30'],
    'bs-hoang': ['07:30 - 11:30', '13:30 - 16:30'],
    'bs-phuong': ['07:30 - 11:30', '13:30 - 16:30'],
    'bs-long': ['07:30 - 11:30', '13:30 - 16:30'],
    'bs-huy': ['07:30 - 11:30', '13:30 - 16:30'],
    'bs-lan': ['07:30 - 11:30', '13:30 - 16:30'],
}
