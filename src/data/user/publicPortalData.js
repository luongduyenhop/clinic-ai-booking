export const specialties = [
    { id: 'noi', name: 'Nội tổng quát', icon: 'Heartbeat', description: 'Thăm khám các bệnh lý nội khoa, tầm soát và tư vấn sức khỏe toàn diện.', doctorCount: 12 },
    { id: 'ngoai', name: 'Ngoại tổng quát', icon: 'FirstAidKit', description: 'Đánh giá, theo dõi và điều trị các bệnh lý cần can thiệp ngoại khoa.', doctorCount: 8 },
    { id: 'mat', name: 'Mắt', icon: 'Eye', description: 'Khám thị lực, tật khúc xạ và các bệnh lý chuyên sâu về mắt.', doctorCount: 6 },
    { id: 'tmh', name: 'Tai Mũi Họng', icon: 'Ear', description: 'Chăm sóc toàn diện các bệnh lý tai, mũi, họng ở mọi lứa tuổi.', doctorCount: 7 },
    { id: 'rhm', name: 'Răng Hàm Mặt', icon: 'Tooth', description: 'Khám, điều trị và dự phòng các vấn đề răng miệng, hàm mặt.', doctorCount: 9 },
]

export const doctors = [
    { id: 'bs-huy', name: 'BS. CKII Trần Quốc Huy', specialty: 'Răng Hàm Mặt', experience: '18 năm kinh nghiệm', initials: 'TH', nextSlot: '08:00 · Thứ Hai' },
    { id: 'bs-hoang', name: 'BS. CKII Nguyễn Minh Hoàng', specialty: 'Nội tổng quát', experience: '16 năm kinh nghiệm', initials: 'NH', nextSlot: '09:30 · Hôm nay' },
    { id: 'bs-lan', name: 'ThS.BS Lê Ngọc Lan', specialty: 'Mắt', experience: '12 năm kinh nghiệm', initials: 'NL', nextSlot: '13:30 · Hôm nay' },
    { id: 'bs-minh', name: 'BS. CKI Phạm Quang Minh', specialty: 'Tai Mũi Họng', experience: '11 năm kinh nghiệm', initials: 'PM', nextSlot: '15:00 · Ngày mai' },
]

export const quickActions = [
    { title: 'Đặt lịch khám', description: 'Chọn chuyên khoa, bác sĩ và giờ khám phù hợp', icon: 'CalendarPlus', href: '#chuyen-khoa' },
    { title: 'Tìm bác sĩ', description: 'Xem hồ sơ và lịch làm việc của đội ngũ bác sĩ', icon: 'Stethoscope', href: '#bac-si' },
    { title: 'Khảo sát triệu chứng AI', description: 'Nhận gợi ý chuyên khoa trước khi đặt lịch', icon: 'Robot', href: '#tro-ly-ai' },
    { title: 'Tra cứu lịch khám', description: 'Theo dõi lịch hẹn và trạng thái xác nhận', icon: 'ClipboardText', href: '/login' },
]
