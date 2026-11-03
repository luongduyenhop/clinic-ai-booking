import { Navigate } from 'react-router-dom'
// Gộp hai luồng đặt lịch: chỉ dùng API đặt lịch chuẩn và kiểm tra slot từ Backend.
export default function BookingWizardPage() { return <Navigate to="/dat-lich" replace /> }
