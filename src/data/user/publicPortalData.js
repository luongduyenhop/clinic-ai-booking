export const specialties = [
    { id: 'noi', name: 'Khoa Nội tổng quát', icon: 'Heartbeat', description: 'Khám và điều trị các bệnh lý nội khoa tổng hợp, tim mạch, tiêu hóa, hô hấp, đái tháo đường, tăng huyết áp.', doctorCount: 2, fee: 150000, code: 'KHOA_NOI', realId: 1 },
    { id: 'ngoai', name: 'Khoa Ngoại', icon: 'FirstAidKit', description: 'Khám ngoại khoa, tiểu phẫu, xử lý vết thương phần mềm, trích rạch áp xe, u bã đậu, cắt chỉ.', doctorCount: 1, fee: 200000, code: 'KHOA_NGOAI', realId: 824 },
    { id: 'tmh', name: 'Khoa Tai Mũi Họng', icon: 'Ear', description: 'Khám và nội soi tai mũi họng, hút rửa xoang, điều trị viêm họng, viêm amidan, viêm tai giữa, tiền đình.', doctorCount: 1, fee: 220000, code: 'KHOA_TMH', realId: 4 },
    { id: 'rhm', name: 'Khoa Răng', icon: 'Tooth', description: 'Nha khoa tổng quát, khám răng, lấy cao răng, hàn răng sâu, nhổ răng số 8, điều trị tủy, viêm nướu.', doctorCount: 1, fee: 180000, code: 'KHOA_RANG', realId: 825 },
    { id: 'mat', name: 'Khoa Mắt', icon: 'Eye', description: 'Khám thị lực, đo khúc xạ tự động, soi đáy mắt, điều trị đau mắt đỏ, dị vật mắt, tật khúc xạ.', doctorCount: 1, fee: 160000, code: 'KHOA_MAT', realId: 826 },
]

export const doctors = [
    { id: 'bs-minh', realId: 4, name: 'PGS.TS Phạm Đức Minh', specialtyId: 'noi', specialty: 'Khoa Nội tổng quát', experience: '22 năm kinh nghiệm', initials: 'PM', nextSlot: '08:00 · Hôm nay', status: 'AVAILABLE', room: 'P101 - Tầng 1' },
    { id: 'bs-hoang', realId: 13832, name: 'BS. CKII Nguyễn Minh Hoàng', specialtyId: 'noi', specialty: 'Khoa Nội tổng quát', experience: '16 năm kinh nghiệm', initials: 'NH', nextSlot: '09:00 · Hôm nay', status: 'AVAILABLE', room: 'P102 - Tầng 1' },
    { id: 'bs-phuong', realId: 13833, name: 'ThS. BS Đặng Hải Phương', specialtyId: 'ngoai', specialty: 'Khoa Ngoại', experience: '14 năm kinh nghiệm', initials: 'ĐP', nextSlot: '08:30 · Hôm nay', status: 'AVAILABLE', room: 'P201 - Tầng 2' },
    { id: 'bs-long', realId: 3, name: 'BS. Lê Hoàng Long', specialtyId: 'tmh', specialty: 'Khoa Tai Mũi Họng', experience: '10 năm kinh nghiệm', initials: 'HL', nextSlot: '08:00 · Hôm nay', status: 'AVAILABLE', room: 'P202 - Tầng 2' },
    { id: 'bs-huy', realId: 13834, name: 'BS. CKII Trần Quốc Huy', specialtyId: 'rhm', specialty: 'Khoa Răng', experience: '18 năm kinh nghiệm', initials: 'QH', nextSlot: '08:30 · Hôm nay', status: 'AVAILABLE', room: 'P301 - Tầng 3' },
    { id: 'bs-lan', realId: 13835, name: 'ThS. BS Lê Ngọc Lan', specialtyId: 'mat', specialty: 'Khoa Mắt', experience: '12 năm kinh nghiệm', initials: 'NL', nextSlot: '09:00 · Hôm nay', status: 'AVAILABLE', room: 'P302 - Tầng 3' },
]

export const bookingSlots = [
    '07:30 - 08:00', '08:00 - 08:30', '08:30 - 09:00', '09:00 - 09:30',
    '09:30 - 10:00', '10:00 - 10:30', '10:30 - 11:00', '11:00 - 11:30',
    '13:30 - 14:00', '14:00 - 14:30', '14:30 - 15:00', '15:00 - 15:30',
    '15:30 - 16:00', '16:00 - 16:30',
]

export const quickActions = [
    { title: 'Đặt lịch khám', description: 'Chọn chuyên khoa, bác sĩ và giờ khám phù hợp', icon: 'CalendarPlus', href: '/dat-lich' },
    { title: 'Tìm bác sĩ', description: 'Xem hồ sơ và lịch làm việc của đội ngũ bác sĩ', icon: 'Stethoscope', href: '#bac-si' },
    { title: 'Khảo sát triệu chứng AI', description: 'Nhận gợi ý chuyên khoa trước khi đặt lịch', icon: 'Robot', href: '/khao-sat-trieu-chung' },
    { title: 'Tra cứu lịch khám', description: 'Theo dõi lịch hẹn và trạng thái xác nhận', icon: 'ClipboardText', href: '/benh-nhan/lich-hen' },
]
