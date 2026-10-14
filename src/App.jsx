import { Route, Routes, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Loading from './components/loading/Loading'
import ApiErrorModal from './components/error/ApiErrorModal'
import RealtimeNotificationHandler from './components/notification/RealtimeNotificationHandler'
import UserTemplate from './layouts/UserTemplate'
import AdminTemplate from './layouts/AdminTemplate'
import ReceptionLayout from './layouts/ReceptionLayout'
import DoctorTemplate from './layouts/DoctorTemplate'
import ProtectedRoute from './utils/route/ProtectedRoute'
import { ADMIN_ROLES, CUSTOMER_ROLES } from './utils/constants/System'

// Import User Pages
import HomePage from './pages/user/HomePage'
import LoginPage from './pages/user/LoginPage'
import RegisterPage from './pages/user/RegisterPage'
import BookingPage from './pages/user/BookingPage'
import NotFoundPage from './pages/error/NotFoundPage'

// Import 10 Clinic Management Modules (Admin / Staff HIS)
import DashboardAdminPage from './pages/admin/DashboardAdminPage'
import ReceptionRegistrationPage from './pages/admin/ReceptionRegistrationPage'
import PatientManagementPage from './pages/admin/PatientManagementPage'
import ClinicalExamPage from './pages/admin/ClinicalExamPage'
import ParaclinicalPage from './pages/admin/ParaclinicalPage'
import AppointmentManagementPage from './pages/admin/AppointmentManagementPage'
import CashierManagementPage from './pages/admin/CashierManagementPage'
import NewsManagementPage from './pages/admin/NewsManagementPage'
import CatalogManagementPage from './pages/admin/CatalogManagementPage'
import RolePermissionPage from './pages/admin/RolePermissionPage'
import TemplateManagementPage from './pages/admin/TemplateManagementPage'
import ComplianceAndAuditPage from './pages/admin/ComplianceAndAuditPage'
import ServicePackagesPage from './pages/admin/ServicePackagesPage'
import TreatmentCoursePage from './pages/admin/TreatmentCoursePage'
import SettingClinicPage from './pages/admin/SettingClinicPage'
import DownloadAppPage from './pages/admin/DownloadAppPage'
import SpecialtyExamPage from './pages/admin/SpecialtyExamPage'
import DoctorDashboardPage from './pages/doctor/DoctorDashboardPage'

// Import Reception Pages
import ReceptionDashboardPage from './pages/reception/ReceptionDashboardPage'
import AppointmentsPage from './pages/reception/AppointmentsPage'
import CheckInPage from './pages/reception/CheckInPage'
import QueueManagementPage from './pages/reception/QueueManagementPage'
import PatientsPage from './pages/reception/PatientsPage'
import ClinicSchedulePage from './pages/reception/ClinicSchedulePage'
import AdministrationPage from './pages/reception/AdministrationPage'
import TasksPage from './pages/reception/TasksPage'
import ReportsPage from './pages/reception/ReportsPage'

function App() {
    return (
        <>
            <ToastContainer position="top-right" autoClose={3500} />
            <RealtimeNotificationHandler />
            <Loading />
            <ApiErrorModal />
            <Routes>
                {/* Reception Portal Routes */}
                <Route path="/reception" element={<ReceptionLayout />}>
                    <Route index element={<Navigate to="/reception/dashboard" replace />} />
                    <Route path="dashboard" element={<ReceptionDashboardPage />} />
                    <Route path="appointments" element={<AppointmentsPage />} />
                    <Route path="check-in" element={<CheckInPage />} />
                    <Route path="queue" element={<QueueManagementPage />} />
                    <Route path="patients" element={<PatientsPage />} />
                    <Route path="schedule" element={<ClinicSchedulePage />} />
                    <Route path="administration" element={<AdministrationPage />} />
                    <Route path="tasks" element={<TasksPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                </Route>

                {/* Client / User Routes */}
                <Route element={<UserTemplate />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/dat-lich" element={<BookingPage />} />

                    {/* Protected User Routes */}
                    <Route element={<ProtectedRoute allowedRoles={CUSTOMER_ROLES} />}>
                        {/* User profile routes */}
                    </Route>
                    <Route path="*" element={<NotFoundPage />} />
                </Route>

                {/* Admin / Clinic Management HIS Routes (10 Video Modules) */}
                <Route element={<ProtectedRoute allowedRoles={ADMIN_ROLES} />}>
                    <Route path="/admin" element={<AdminTemplate />}>
                        <Route index element={<DashboardAdminPage />} />
                        <Route path="bao-cao" element={<DashboardAdminPage />} />

                        {/* Video 01: Đăng ký khám */}
                        <Route path="dang-ky-kham" element={<ReceptionRegistrationPage />} />

                        {/* Video 02: Quản lý bệnh nhân */}
                        <Route path="benh-nhan" element={<PatientManagementPage />} />
                        <Route path="benh-nhan/them-moi" element={<PatientManagementPage />} />

                        {/* Video 03A: Khám bệnh */}
                        <Route path="kham-benh" element={<ClinicalExamPage />} />
                        <Route path="khambenh" element={<ClinicalExamPage />} />
                        <Route path="kham-chuyen-khoa/:deptKey" element={<SpecialtyExamPage />} />
                        <Route path="khamlamsang/:deptKey" element={<SpecialtyExamPage />} />

                        {/* Video 03B: Cận lâm sàng & PT-TT */}
                        <Route path="can-lam-sang" element={<ParaclinicalPage />} />
                        <Route path="pt-tt" element={<ParaclinicalPage />} />

                        {/* Video 04: Lịch hẹn */}
                        <Route path="lich-hen" element={<AppointmentManagementPage />} />

                        {/* Video 05: Thu chi - Viện phí */}
                        <Route path="thu-chi" element={<CashierManagementPage />} />

                        {/* Video 06: Tin tức & Danh mục tin tức */}
                        <Route path="tin-tuc" element={<NewsManagementPage />} />
                        <Route path="danh-muc-tin-tuc" element={<NewsManagementPage />} />

                        {/* Video 07: Quản lý danh mục (Chung 5 tab, Địa chỉ, Khoa phòng, Bệnh ICD, Thuốc, Dịch vụ) */}
                        <Route path="danh-muc" element={<Navigate to="/admin/danh-muc/chung" replace />} />
                        <Route path="danh-muc/:loaiDanhMuc" element={<CatalogManagementPage />} />

                        {/* Phân quyền vai trò & Quản lý nhân viên + CCHN */}
                        <Route path="phan-quyen" element={<RolePermissionPage />} />
                        <Route path="nhan-vien" element={<RolePermissionPage />} />

                        {/* Quản lý mẫu (7 loại mẫu) */}
                        <Route path="quan-ly-mau" element={<Navigate to="/admin/quan-ly-mau/mau-in" replace />} />
                        <Route path="quan-ly-mau/:loaiMau" element={<TemplateManagementPage />} />

                        {/* Tuân thủ pháp lý & Nhật ký kiểm toán (INT-03, INT-04, INT-05) */}
                        <Route path="tuan-thu" element={<ComplianceAndAuditPage />} />
                        <Route path="lich-su-hoat-dong" element={<ComplianceAndAuditPage />} />

                        {/* Redirect các route cũ của Khám đoàn & Hỏi đáp về /admin */}
                        <Route path="huong-dan" element={<Navigate to="/admin" replace />} />
                        <Route path="danh-muc-huong-dan" element={<Navigate to="/admin" replace />} />
                        <Route path="hoi-dap" element={<Navigate to="/admin" replace />} />
                        <Route path="dang-ky-doan" element={<Navigate to="/admin" replace />} />
                        <Route path="dangkydoan" element={<Navigate to="/admin" replace />} />
                        <Route path="kham-doan" element={<Navigate to="/admin" replace />} />

                        {/* Gói dịch vụ */}
                        <Route path="goi-dich-vu" element={<ServicePackagesPage />} />
                        <Route path="goidichvu" element={<ServicePackagesPage />} />

                        {/* Liệu trình */}
                        <Route path="lieu-trinh" element={<TreatmentCoursePage />} />
                        <Route path="lieutrinh" element={<TreatmentCoursePage />} />

                        {/* Hồ sơ gia đình */}
                        <Route path="giadinh-benhnhan" element={<PatientManagementPage />} />

                        {/* Liên thông Cổng Quốc gia */}
                        <Route path="don-thuoc-quoc-gia" element={<ComplianceAndAuditPage />} />
                        <Route path="donthuocquocgia" element={<ComplianceAndAuditPage />} />

                        {/* Cài đặt phòng khám */}
                        <Route path="cai-dat" element={<SettingClinicPage />} />
                        <Route path="setting" element={<SettingClinicPage />} />

                        {/* Tải ứng dụng Mobile */}
                        <Route path="tai-ung-dung" element={<DownloadAppPage />} />
                    </Route>
                </Route>

                {/* Doctor Routes (Phân hệ Bác sĩ) */}
                <Route path="/doctor" element={<DoctorTemplate />}>
                    <Route index element={<DoctorDashboardPage />} />
                </Route>
            </Routes>
        </>
    )
}

export default App
