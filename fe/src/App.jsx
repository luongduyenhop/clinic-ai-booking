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
import StaffLayout from './layouts/staff/StaffLayout'
import ProtectedRoute from './utils/route/ProtectedRoute'
import {
    ADMIN_ROLES,
    CUSTOMER_ROLES,
    STAFF_ROLES,
    RECEPTIONIST_ROLES,
    DOCTOR_ROLES,
} from './utils/constants/System'

import HomePage from './pages/user/HomePage'
import DoctorSection from './components/user/home/DoctorSection'
import SpecialtySection from './components/user/home/SpecialtySection'
import LoginPage from './pages/user/LoginPage'
import StaffLoginPage from './pages/staff/StaffLoginPage'
import RegisterPage from './pages/user/RegisterPage'
import BookingPage from './pages/user/BookingPage'
import SymptomSurveyPage from './pages/user/SymptomSurveyPage'
import PatientPortalLayout from './layouts/PatientPortalLayout'
import PatientDashboardPage from './pages/user/patient/PatientDashboardPage'
import PatientAppointmentsPage from './pages/user/patient/PatientAppointmentsPage'
import MedicalHistoryPage from './pages/user/patient/MedicalHistoryPage'
import PrescriptionsPage from './pages/user/patient/PrescriptionsPage'
import LabResultsPage from './pages/user/patient/LabResultsPage'
import DoctorSchedulesPage from './pages/user/patient/DoctorSchedulesPage'
import NotFoundPage from './pages/error/NotFoundPage'
import BookingWizardPage from './pages/user/BookingWizardPage'
import PatientProfilePage from './pages/user/PatientProfilePage'
import PatientMedicalRecordsPage from './pages/user/PatientMedicalRecordsPage'
import PatientBillingPage from './pages/user/PatientBillingPage'

import DashboardAdminPage from './pages/admin/DashboardAdminPage'
import ReceptionRegistrationPage from './pages/admin/ReceptionRegistrationPage'
import PatientManagementPage from './pages/admin/PatientManagementPage'
import ParaclinicalPage from './pages/admin/ParaclinicalPage'
import AppointmentManagementPage from './pages/admin/AppointmentManagementPage'
import CashierManagementPage from './pages/admin/CashierManagementPage'
import NewsManagementPage from './pages/admin/NewsManagementPage'
import CatalogManagementPage from './pages/admin/CatalogManagementPage'
import RolePermissionPage from './pages/admin/RolePermissionPage'
import TemplateManagementPage from './pages/admin/TemplateManagementPage'
import ComplianceAndAuditPage from './pages/admin/ComplianceAndAuditPage'
import CashierBillingAuditDashboard from './pages/admin/CashierBillingAuditDashboard'
import ServicePackagesPage from './pages/admin/ServicePackagesPage'
import TreatmentCoursePage from './pages/admin/TreatmentCoursePage'
import SettingClinicPage from './pages/admin/SettingClinicPage'
import DownloadAppPage from './pages/admin/DownloadAppPage'
import SpecialtyExamPage from './pages/admin/SpecialtyExamPage'
import DoctorDashboardPage from './pages/doctor/DoctorDashboardPage'
import ExamWorkstationPage from './pages/doctor/ExamWorkstationPage'
import ParaclinicalWorkPage from './pages/doctor/ParaclinicalWorkPage'

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
                <Route path="/staff/login" element={<StaffLoginPage />} />
                <Route path="/admin/login" element={<Navigate to="/staff/login" replace />} />

                <Route element={<ProtectedRoute allowedRoles={RECEPTIONIST_ROLES} />}>
                    <Route path="/reception" element={<ReceptionLayout />}>
                        <Route index element={<Navigate to="/reception/dashboard" replace />} />
                        <Route path="dashboard" element={<ReceptionDashboardPage />} />
                        <Route path="appointments" element={<AppointmentsPage />} />
                        <Route path="check-in" element={<CheckInPage />} />
                        <Route path="queue" element={<QueueManagementPage />} />
                        <Route path="cashier" element={<CashierManagementPage />} />
                        <Route path="billing-audit" element={<CashierBillingAuditDashboard />} />
                        <Route path="patients" element={<PatientsPage />} />
                        <Route path="schedule" element={<ClinicSchedulePage />} />
                        <Route path="administration" element={<AdministrationPage />} />
                        <Route path="tasks" element={<TasksPage />} />
                        <Route path="reports" element={<ReportsPage />} />
                    </Route>
                </Route>

                <Route element={<UserTemplate />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/bac-si" element={<DoctorSection />} />
                    <Route path="/chuyen-khoa" element={<SpecialtySection />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/dat-lich" element={<BookingPage />} />
                    <Route path="/dat-lich-kham" element={<BookingWizardPage />} />
                    <Route path="/khao-sat-trieu-chung" element={<SymptomSurveyPage />} />

                    <Route element={<ProtectedRoute allowedRoles={CUSTOMER_ROLES} />}>
                        <Route path="/benh-nhan" element={<PatientPortalLayout />}>
                            <Route index element={<PatientDashboardPage />} />
                            <Route path="lich-hen" element={<PatientAppointmentsPage />} />
                            <Route path="lich-su-kham" element={<MedicalHistoryPage />} />
                            <Route path="don-thuoc" element={<PrescriptionsPage />} />
                            <Route path="ket-qua-can-lam-sang" element={<LabResultsPage />} />
                            <Route path="lich-bac-si" element={<DoctorSchedulesPage />} />
                            <Route path="ho-so" element={<PatientProfilePage />} />
                            <Route path="benh-an" element={<PatientMedicalRecordsPage />} />
                            <Route path="hoa-don" element={<PatientBillingPage />} />
                        </Route>
                    </Route>
                    <Route path="*" element={<NotFoundPage />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={ADMIN_ROLES} />}>
                    <Route path="/admin" element={<AdminTemplate />}>
                        <Route index element={<DashboardAdminPage />} />
                        <Route path="bao-cao" element={<DashboardAdminPage />} />

                        <Route path="dang-ky-kham" element={<ReceptionRegistrationPage />} />

                        <Route path="benh-nhan" element={<PatientManagementPage />} />
                        <Route path="benh-nhan/them-moi" element={<PatientManagementPage />} />

                        <Route path="kham-benh" element={<ExamWorkstationPage />} />
                        <Route path="khambenh" element={<ExamWorkstationPage />} />
                        <Route path="kham-chuyen-khoa/:deptKey" element={<SpecialtyExamPage />} />
                        <Route path="khamlamsang/:deptKey" element={<SpecialtyExamPage />} />

                        <Route path="can-lam-sang" element={<ParaclinicalPage />} />
                        <Route path="pt-tt" element={<ParaclinicalPage />} />

                        <Route path="lich-hen" element={<AppointmentManagementPage />} />

                        <Route path="thu-chi" element={<CashierManagementPage />} />
                        <Route path="thu-ngan-vietqr" element={<CashierBillingAuditDashboard />} />

                        <Route path="tin-tuc" element={<NewsManagementPage />} />
                        <Route path="danh-muc-tin-tuc" element={<NewsManagementPage />} />

                        <Route path="danh-muc" element={<Navigate to="/admin/danh-muc/chung" replace />} />
                        <Route path="danh-muc/:loaiDanhMuc" element={<CatalogManagementPage />} />

                        <Route path="phan-quyen" element={<RolePermissionPage />} />
                        <Route path="nhan-vien" element={<RolePermissionPage />} />
                        <Route path="nghi-phep" element={<RolePermissionPage />} />

                        <Route path="quan-ly-mau" element={<Navigate to="/admin/quan-ly-mau/mau-in" replace />} />
                        <Route path="quan-ly-mau/:loaiMau" element={<TemplateManagementPage />} />

                        <Route path="tuan-thu" element={<ComplianceAndAuditPage />} />
                        <Route path="lich-su-hoat-dong" element={<ComplianceAndAuditPage />} />

                        <Route path="huong-dan" element={<Navigate to="/admin" replace />} />
                        <Route path="danh-muc-huong-dan" element={<Navigate to="/admin" replace />} />
                        <Route path="hoi-dap" element={<Navigate to="/admin" replace />} />
                        <Route path="dang-ky-doan" element={<Navigate to="/admin" replace />} />
                        <Route path="dangkydoan" element={<Navigate to="/admin" replace />} />
                        <Route path="kham-doan" element={<Navigate to="/admin" replace />} />

                        <Route path="goi-dich-vu" element={<ServicePackagesPage />} />
                        <Route path="goidichvu" element={<ServicePackagesPage />} />

                        <Route path="lieu-trinh" element={<TreatmentCoursePage />} />
                        <Route path="lieutrinh" element={<TreatmentCoursePage />} />

                        <Route path="giadinh-benhnhan" element={<PatientManagementPage />} />

                        <Route path="don-thuoc-quoc-gia" element={<ComplianceAndAuditPage />} />
                        <Route path="donthuocquocgia" element={<ComplianceAndAuditPage />} />

                        <Route path="cai-dat" element={<SettingClinicPage />} />
                        <Route path="setting" element={<SettingClinicPage />} />

                        <Route path="tai-ung-dung" element={<DownloadAppPage />} />
                    </Route>
                </Route>

                <Route element={<ProtectedRoute allowedRoles={DOCTOR_ROLES} />}>
                    <Route path="/doctor" element={<DoctorTemplate />}>
                        <Route index element={<DoctorDashboardPage />} />
                        <Route path="kham-benh" element={<Navigate to="/doctor" replace />} />
                        <Route path="can-lam-sang" element={<ParaclinicalWorkPage />} />
                    </Route>
                </Route>

                <Route element={<ProtectedRoute allowedRoles={STAFF_ROLES} />}>
                    <Route path="/staff" element={<StaffLayout />}>
                        <Route index element={<Navigate to="/staff/dashboard" replace />} />
                        <Route path="dashboard" element={<DashboardAdminPage />} />
                        <Route path="reception-dashboard" element={<ReceptionDashboardPage />} />
                        <Route path="doctor-dashboard" element={<DoctorDashboardPage />} />
                        <Route path="check-in" element={<CheckInPage />} />
                        <Route path="queue" element={<QueueManagementPage />} />
                        <Route path="appointments" element={<AppointmentsPage />} />
                        <Route path="patients" element={<PatientManagementPage />} />
                        <Route path="exam-workstation" element={<ExamWorkstationPage />} />
                        <Route path="specialty-exam" element={<SpecialtyExamPage />} />
                        <Route path="specialty-exam/:deptKey" element={<SpecialtyExamPage />} />
                        <Route path="paraclinical-work" element={<ParaclinicalWorkPage />} />
                        <Route path="paraclinical" element={<ParaclinicalPage />} />
                        <Route path="cashier" element={<Navigate to="/reception/cashier" replace />} />
                        <Route path="schedule" element={<ClinicSchedulePage />} />
                        <Route path="catalogs" element={<Navigate to="/staff/catalogs/chung" replace />} />
                        <Route path="catalogs/:loaiDanhMuc" element={<CatalogManagementPage />} />
                        <Route path="permissions" element={<RolePermissionPage />} />
                        <Route path="templates" element={<Navigate to="/staff/templates/mau-in" replace />} />
                        <Route path="templates/:loaiMau" element={<TemplateManagementPage />} />
                        <Route path="compliance" element={<ComplianceAndAuditPage />} />
                        <Route path="service-packages" element={<ServicePackagesPage />} />
                        <Route path="treatment-courses" element={<TreatmentCoursePage />} />
                        <Route path="settings" element={<SettingClinicPage />} />
                        <Route path="reports" element={<ReportsPage />} />
                        <Route path="reception" element={<ReceptionRegistrationPage />} />
                    </Route>
                </Route>
            </Routes>
        </>
    )
}

export default App
