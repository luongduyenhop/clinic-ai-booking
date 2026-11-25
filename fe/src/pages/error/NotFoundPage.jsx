import { Link } from 'react-router-dom'

export default function NotFoundPage() {
    return (
        <div className="min-h-[calc(100vh-160px)] flex flex-col items-center justify-center p-6 text-center bg-clinic-bg">
            <span className="font-display text-7xl font-extrabold text-clinic-cta tabular-nums mb-2">404</span>
            <h2 className="font-display text-2xl font-bold text-clinic-navy mb-2">Trang không tồn tại</h2>
            <p className="text-sm text-clinic-text-secondary max-w-md mb-6">
                Đường dẫn bạn đang tìm kiếm không tồn tại hoặc đã được chuyển sang vị trí khác.
            </p>
            <Link
                to="/"
                className="medpro-btn-primary rounded-[8px] px-6 py-2.5 text-sm font-semibold"
            >
                Quay về trang chủ
            </Link>
        </div>
    )
}
