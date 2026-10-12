import { Outlet } from 'react-router-dom'
import UserHeader from '../components/user/UserHeader'

const CURRENT_YEAR = new Date().getFullYear()

export default function UserTemplate() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
            {/* Header */}
            <UserHeader />

            {/* Main Content */}
            <main className="flex-1">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-200 py-8 text-center text-xs text-slate-500">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <p className="font-semibold text-slate-700 mb-1">
                        Hệ Thống Đặt Lịch Khám Thông Minh ClinicAI Booking &copy; {CURRENT_YEAR}
                    </p>
                    <p>Giải pháp chuyển đổi số y tế & Đặt lịch khám thông minh hỗ trợ bởi AI</p>
                </div>
            </footer>
        </div>
    )
}
