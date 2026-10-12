import { Link } from 'react-router-dom'

export default function NotFoundPage() {
    return (
        <div className="min-h-[calc(100vh-160px)] flex flex-col items-center justify-center p-6 text-center">
            <span className="text-7xl font-extrabold text-sky-600 mb-2">404</span>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Trang không tồn tại</h2>
            <p className="text-sm text-slate-500 max-w-md mb-6">
                Đường dẫn bạn đang tìm kiếm không tồn tại hoặc đã được chuyển sang vị trí khác.
            </p>
            <Link
                to="/"
                className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm shadow-sm transition"
            >
                Quay về trang chủ
            </Link>
        </div>
    )
}
