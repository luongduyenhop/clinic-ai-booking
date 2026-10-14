export const specialties = [
    { id: 'noi', name: 'Nội tổng quát', icon: 'Heartbeat', description: 'Thăm khám các bệnh lý nội khoa, tầm soát và tư vấn sức khỏe toàn diện.', doctorCount: 12, fee: 150000 },
    { id: 'ngoai', name: 'Ngoại tổng quát', icon: 'FirstAidKit', description: 'Đánh giá, theo dõi và điều trị các bệnh lý cần can thiệp ngoại khoa.', doctorCount: 8, fee: 200000 },
    { id: 'mat', name: 'Mắt', icon: 'Eye', description: 'Khám thị lực, tật khúc xạ và các bệnh lý chuyên sâu về mắt.', doctorCount: 6, fee: 160000 },
    { id: 'tmh', name: 'Tai Mũi Họng', icon: 'Ear', description: 'Chăm sóc toàn diện các bệnh lý tai, mũi, họng ở mọi lứa tuổi.', doctorCount: 7, fee: 220000 },
    { id: 'rhm', name: 'Răng Hàm Mặt', icon: 'Tooth', description: 'Khám, điều trị và dự phòng các vấn đề răng miệng, hàm mặt.', doctorCount: 9, fee: 180000 },
]

export const doctors = [
    { id: 'bs-huy', name: 'BS. CKII Trần Quốc Huy', specialtyId: 'rhm', specialty: 'Răng Hàm Mặt', experience: '18 năm kinh nghiệm', initials: 'TH', nextSlot: '08:00 · Thứ Hai', status: 'AVAILABLE' },
    { id: 'bs-hoang', name: 'BS. CKII Nguyễn Minh Hoàng', specialtyId: 'noi', specialty: 'Nội tổng quát', experience: '16 năm kinh nghiệm', initials: 'NH', nextSlot: '09:30 · Hôm nay', status: 'AVAILABLE' },
    { id: 'bs-lan', name: 'ThS.BS Lê Ngọc Lan', specialtyId: 'mat', specialty: 'Mắt', experience: '12 năm kinh nghiệm', initials: 'NL', nextSlot: '13:30 · Hôm nay', status: 'AVAILABLE' },
    { id: 'bs-minh', name: 'BS. CKI Phạm Quang Minh', specialtyId: 'tmh', specialty: 'Tai Mũi Họng', experience: '11 năm kinh nghiệm', initials: 'PM', nextSlot: '15:00 · Ngày mai', status: 'AVAILABLE' },
    { id: 'bs-phuong', name: 'ThS.BS Đặng Hải Phương', specialtyId: 'ngoai', specialty: 'Ngoại tổng quát', experience: '14 năm kinh nghiệm', initials: 'ĐP', nextSlot: '10:00 · Ngày mai', status: 'AVAILABLE' },
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
    { title: 'Tra cứu lịch khám', description: 'Theo dõi lịch hẹn và trạng thái xác nhận', icon: 'ClipboardText', href: '/login' },
]
