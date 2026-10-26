import { Link, Outlet } from 'react-router-dom'
import UserHeader from '../components/user/UserHeader'

const CURRENT_YEAR = new Date().getFullYear()

export default function UserTemplate() {
    return (
        <div className="min-h-screen flex flex-col bg-white text-slate-800">
            {/* Header */}
            <UserHeader />

            {/* Main Content */}
            <main className="flex-1">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="bg-[#002F49] text-sky-100/75 py-12 text-sm">
                <div className="public-container grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-2">
                        <div className="flex items-center gap-2 font-display text-xl font-extrabold text-white">
                            <span className="text-[#00B5F1]">CLINIC</span>-AI
                        </div>
                        <p className="mt-4 max-w-md leading-6">
                            Nền tảng đặt lịch khám trực tuyến và hỗ trợ phân luồng chuyên khoa, giúp bệnh nhân chủ động hơn trong hành trình chăm sóc sức khỏe.
                        </p>
                    </div>
                    <div>
                        <h2 className="font-display font-bold text-white">Hỗ trợ</h2>
                        <div className="mt-4 grid gap-2">
                            <a href="tel:19001234">Hotline: 1900 1234</a>
                            <a href="mailto:hotro@clinic-ai.vn">hotro@clinic-ai.vn</a>
                            <span>Phục vụ 07:00–21:00</span>
                        </div>
                    </div>
                    <div>
                        <h2 className="font-display font-bold text-white">Dành cho nhân viên</h2>
                        <div className="mt-4 grid gap-2">
                            <Link to="/staff/login" className="text-[#00B5F1] hover:underline font-bold flex items-center gap-1.5">
                                <span>🔒</span>
                                <span>Đăng nhập Cổng Nhân Viên</span>
                            </Link>
                            <Link to="/admin" className="hover:text-white">Cổng quản trị HIS</Link>
                            <Link to="/doctor" className="hover:text-white">Cổng bác sĩ</Link>
                            <Link to="/reception/dashboard" className="hover:text-white">Cổng lễ tân</Link>
                        </div>
                    </div>
                </div>
                <div className="public-container mt-10 pt-6 border-t border-white/10 text-xs flex flex-col md:flex-row justify-between gap-2">
                    <p>© {CURRENT_YEAR} Clinic-AI Booking. Bảo lưu mọi quyền.</p>
                    <p>AI chỉ hỗ trợ phân luồng, không thay thế chẩn đoán của bác sĩ.</p>
                </div>
            </footer>
        </div>
    )
}
