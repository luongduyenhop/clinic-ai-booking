import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { getRoleDefaultPath } from '../constants/System'
import { normalizeStaffRole } from '../constants/staffRoles'
import { canAccessPortalPath } from './portalAccess'

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

    const normalizedRole = normalizeStaffRole(role)
    if (!normalizedRole) {
        return <Navigate to={isStaffPath ? '/staff/login' : '/login'} replace />
    }

    // Kiểm tra quyền hạn vai trò
    const allowedByGroup = allowedRoles.length === 0 || allowedRoles.some((allowed) => normalizeStaffRole(allowed) === normalizedRole)
    if (!allowedByGroup || !canAccessPortalPath(normalizedRole, location.pathname)) {
        // Đã đăng nhập nhưng không có quyền vào trang này -> chuyển về cổng mặc định của vai trò đó
        const fallbackPath = getRoleDefaultPath(normalizedRole)
        return <Navigate to={fallbackPath} replace />
    }

    return <Outlet />
}
