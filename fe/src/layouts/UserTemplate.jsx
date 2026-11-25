import { Link, Outlet } from 'react-router-dom'
import UserHeader from '../components/user/UserHeader'
import { LockKey } from '../components/common/ClinicIcon'

const CURRENT_YEAR = new Date().getFullYear()

export default function UserTemplate() {
    return (
        <div className="min-h-screen min-h-[100dvh] flex flex-col bg-clinic-surface text-clinic-text">
            <UserHeader />

            <main className="flex-1">
                <Outlet />
            </main>

            <footer className="bg-clinic-navy-dark text-clinic-on-navy-muted py-12 text-sm">
                <div className="public-container grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-2">
                        <div className="flex items-center gap-2 font-display text-xl font-extrabold text-clinic-surface">
                            <span>CLINIC-AI</span>
                        </div>
                        <p className="mt-3 max-w-md leading-6">
                            Phòng khám Đa khoa Ngoại trú tích hợp Bệnh án Điện tử EMR, hỗ trợ đặt lịch theo khung giờ định danh và phân luồng chuyên khoa chuẩn mực.
                        </p>
                        <div className="mt-4 grid gap-1 text-xs text-clinic-on-navy-subtle">
                            <span>Địa điểm: Khu Công Nghệ Cao, TP. Thủ Đức, TP. Hồ Chí Minh</span>
                            <span>Vận hành theo quy chuẩn Hồ sơ Bệnh án Ngoại trú TT32/2023/TT-BYT</span>
                        </div>
                    </div>

                    <div>
                        <h2 className="font-display font-bold text-clinic-surface">Lịch tiếp nhận và hỗ trợ</h2>
                        <div className="mt-4 grid gap-2">
                            <a href="tel:19006868" className="hover:text-clinic-surface transition-colors tabular-nums">
                                Hotline: 1900 6868
                            </a>
                            <a href="mailto:hotro@clinic-ai.vn" className="hover:text-clinic-surface transition-colors">
                                hotro@clinic-ai.vn
                            </a>
                            <span className="tabular-nums">Ca sáng: 07:30 – 11:30 (T2 – T7)</span>
                            <span className="tabular-nums">Ca chiều: 13:30 – 17:30 (T2 – T7)</span>
                        </div>
                    </div>

                    <div>
                        <h2 className="font-display font-bold text-clinic-surface">Cổng thông tin và nội bộ</h2>
                        <div className="mt-4 grid gap-2">
                            <Link to="/dat-lich" className="hover:text-clinic-surface transition-colors">Đặt lịch khám ngoại trú</Link>
                            <Link to="/khao-sat-trieu-chung" className="hover:text-clinic-surface transition-colors">Phân luồng triệu chứng</Link>
                            <a href="/#gioi-thieu" className="hover:text-clinic-surface transition-colors">Giới thiệu phòng khám</a>
                            <a href="/#huong-dan-kham" className="hover:text-clinic-surface transition-colors">Quy trình và hướng dẫn khám</a>
                            <Link to="/staff/login" className="text-clinic-surface hover:underline font-bold inline-flex items-center gap-1.5 pt-1">
                                <LockKey size={15} weight="bold" />
                                <span>Đăng nhập Cổng Nhân Viên</span>
                            </Link>
                            <Link to="/admin" className="hover:text-clinic-surface transition-colors">Cổng quản trị HIS</Link>
                            <Link to="/doctor" className="hover:text-clinic-surface transition-colors">Cổng bác sĩ</Link>
                            <Link to="/reception/dashboard" className="hover:text-clinic-surface transition-colors">Cổng lễ tân</Link>
                        </div>
                    </div>
                </div>
                <div className="public-container mt-10 pt-6 border-t border-[color:var(--clinic-nav-divider)] text-xs flex flex-col md:flex-row justify-between gap-2">
                    <p>© {CURRENT_YEAR} Clinic-AI Booking. Bảo lưu mọi quyền.</p>
                    <p>Phân luồng triệu chứng chỉ hỗ trợ định hướng chuyên khoa, không thay thế chẩn đoán lâm sàng của bác sĩ.</p>
                </div>
            </footer>
        </div>
    )
}
