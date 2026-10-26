import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { getRoleDefaultPath, isStaffRole } from '../constants/System'

export default function ProtectedRoute({ allowedRoles = [] }) {
    const location = useLocation()
    const { isAuthenticated, role } = useSelector((state) => state.app.auth)

    const isStaffPath =
        location.pathname.startsWith('/admin') ||
        location.pathname.startsWith('/staff') ||
        location.pathname.startsWith('/doctor') ||
        location.pathname.startsWith('/reception')

    if (!isAuthenticated) {
        // Chưa đăng nhập: phân luồng rõ ràng cổng đăng nhập
        const loginTarget = isStaffPath ? '/staff/login' : '/login'
        return <Navigate to={loginTarget} state={{ from: location }} replace />
    }

    const normalizedRole = String(role || '').toUpperCase()

    // Kiểm tra quyền hạn vai trò
    if (allowedRoles.length > 0 && (!normalizedRole || !allowedRoles.includes(normalizedRole))) {
        // Đã đăng nhập nhưng không có quyền vào trang này -> chuyển về cổng mặc định của vai trò đó
        const fallbackPath = getRoleDefaultPath(normalizedRole)
        return <Navigate to={fallbackPath} replace />
    }

    return <Outlet />
}
