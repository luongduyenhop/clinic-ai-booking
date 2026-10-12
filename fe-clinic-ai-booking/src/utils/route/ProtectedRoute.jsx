import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'

export default function ProtectedRoute({ allowedRoles = [] }) {
    const location = useLocation()
    const { isAuthenticated, role } = useSelector((state) => state.app.auth)

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    if (allowedRoles.length > 0 && (!role || !allowedRoles.includes(role.toUpperCase()))) {
        return <Navigate to="/" replace />
    }

    return <Outlet />
}
