import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import {
    CLINICAL_ANTD_THEME,
    PATIENT_ANTD_THEME,
    isClinicalWorkbenchPath,
} from './theme/clinicTheme'
import Loading from './components/loading/Loading'
import ApiErrorModal from './components/error/ApiErrorModal'
import UserTemplate from './layouts/UserTemplate'
import ProtectedRoute from './utils/route/ProtectedRoute'
import {
    ADMIN_ROLES,
    CUSTOMER_ROLES,
    STAFF_ROLES,
    RECEPTIONIST_ROLES,
    DOCTOR_ROLES,
} from './utils/constants/System'

const AdminTemplate = lazy(() => import('./layouts/AdminTemplate'))
const ReceptionLayout = lazy(() => import('./layouts/ReceptionLayout'))
const DoctorTemplate = lazy(() => import('./layouts/DoctorTemplate'))
const StaffLayout = lazy(() => import('./layouts/staff/StaffLayout'))
const PatientPortalLayout = lazy(() => import('./layouts/PatientPortalLayout'))

const HomePage = lazy(() => import('./pages/user/HomePage'))
const DoctorSection = lazy(() => import('./components/user/home/DoctorSection'))
const SpecialtySection = lazy(() => import('./components/user/home/SpecialtySection'))
const LoginPage = lazy(() => import('./pages/user/LoginPage'))
const StaffLoginPage = lazy(() => import('./pages/staff/StaffLoginPage'))
const RegisterPage = lazy(() => import('./pages/user/RegisterPage'))
const BookingPage = lazy(() => import('./pages/user/BookingPage'))
const SymptomSurveyPage = lazy(() => import('./pages/user/SymptomSurveyPage'))
const PatientDashboardPage = lazy(() => import('./pages/user/patient/PatientDashboardPage'))
const PatientAppointmentsPage = lazy(() => import('./pages/user/patient/PatientAppointmentsPage'))
const PrescriptionsPage = lazy(() => import('./pages/user/patient/PrescriptionsPage'))
const LabResultsPage = lazy(() => import('./pages/user/patient/LabResultsPage'))
const DoctorSchedulesPage = lazy(() => import('./pages/user/patient/DoctorSchedulesPage'))
const NotFoundPage = lazy(() => import('./pages/error/NotFoundPage'))
const BookingWizardPage = lazy(() => import('./pages/user/BookingWizardPage'))
const PatientProfilePage = lazy(() => import('./pages/user/PatientProfilePage'))
const PatientMedicalRecordsPage = lazy(() => import('./pages/user/PatientMedicalRecordsPage'))
const PatientBillingPage = lazy(() => import('./pages/user/PatientBillingPage'))

const DashboardAdminPage = lazy(() => import('./pages/admin/DashboardAdminPage'))
const PatientManagementPage = lazy(() => import('./pages/admin/PatientManagementPage'))
const ParaclinicalPage = lazy(() => import('./pages/admin/ParaclinicalPage'))
const CashierManagementPage = lazy(() => import('./pages/admin/CashierManagementPage'))
const NewsManagementPage = lazy(() => import('./pages/admin/NewsManagementPage'))
const CatalogManagementPage = lazy(() => import('./pages/admin/CatalogManagementPage'))
const RolePermissionPage = lazy(() => import('./pages/admin/RolePermissionPage'))
const TemplateManagementPage = lazy(() => import('./pages/admin/TemplateManagementPage'))
const ComplianceAndAuditPage = lazy(() => import('./pages/admin/ComplianceAndAuditPage'))
const CashierBillingAuditDashboard = lazy(() => import('./pages/admin/CashierBillingAuditDashboard'))
const ServicePackagesPage = lazy(() => import('./pages/admin/ServicePackagesPage'))
const TreatmentCoursePage = lazy(() => import('./pages/admin/TreatmentCoursePage'))
const SettingClinicPage = lazy(() => import('./pages/admin/SettingClinicPage'))
const DownloadAppPage = lazy(() => import('./pages/admin/DownloadAppPage'))
const GuideAndQaManagementPage = lazy(() => import('./pages/admin/GuideAndQaManagementPage'))
const CorporateHealthPage = lazy(() => import('./pages/admin/CorporateHealthPage'))
const DoctorDashboardPage = lazy(() => import('./pages/doctor/DoctorDashboardPage'))
const ExamWorkstationPage = lazy(() => import('./pages/doctor/ExamWorkstationPage'))
const ParaclinicalWorkPage = lazy(() => import('./pages/doctor/ParaclinicalWorkPage'))

const ReceptionDashboardPage = lazy(() => import('./pages/reception/ReceptionDashboardPage'))
const AppointmentsPage = lazy(() => import('./pages/reception/AppointmentsPage'))
const CheckInPage = lazy(() => import('./pages/reception/CheckInPage'))
const QueueManagementPage = lazy(() => import('./pages/reception/QueueManagementPage'))
const PatientsPage = lazy(() => import('./pages/reception/PatientsPage'))
const ClinicSchedulePage = lazy(() => import('./pages/reception/ClinicSchedulePage'))
const AdministrationPage = lazy(() => import('./pages/reception/AdministrationPage'))
const TasksPage = lazy(() => import('./pages/reception/TasksPage'))
const ReportsPage = lazy(() => import('./pages/reception/ReportsPage'))

function App() {
    const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'
    const { pathname } = useLocation()
    const isClinicalWorkbench = isClinicalWorkbenchPath(pathname)

    useEffect(() => {
        document.documentElement.dataset.density = isClinicalWorkbench ? 'clinical' : 'patient'
    }, [isClinicalWorkbench])

    return (
        <ConfigProvider locale={viVN} theme={isClinicalWorkbench ? CLINICAL_ANTD_THEME : PATIENT_ANTD_THEME}>
            <ToastContainer position="top-right" autoClose={3500} />
            <Loading />
            <ApiErrorModal />
            <Suspense fallback={<Loading forceVisible />}>
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
                        <Route path="/register" element={demoMode ? <Navigate to="/login" replace /> : <RegisterPage />} />
                        <Route path="/dat-lich" element={<BookingPage />} />
                        <Route path="/dat-lich-kham" element={<BookingWizardPage />} />
                        <Route path="/khao-sat-trieu-chung" element={<SymptomSurveyPage />} />

                        <Route element={<ProtectedRoute allowedRoles={CUSTOMER_ROLES} />}>
                            <Route path="/benh-nhan" element={<PatientPortalLayout />}>
                                <Route index element={<PatientDashboardPage />} />
                                <Route path="lich-hen" element={<PatientAppointmentsPage />} />
                                <Route path="lich-su-kham" element={<Navigate to="/benh-nhan/benh-an" replace />} />
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

                            <Route path="dang-ky-kham" element={<CheckInPage />} />

                            <Route path="benh-nhan" element={<PatientsPage />} />
                            <Route path="benh-nhan/them-moi" element={<PatientsPage />} />

                            <Route path="kham-benh" element={<ExamWorkstationPage />} />
                            <Route path="khambenh" element={<ExamWorkstationPage />} />
                            <Route path="kham-chuyen-khoa/:deptKey" element={<ExamWorkstationPage />} />
                            <Route path="khamlamsang/:deptKey" element={<ExamWorkstationPage />} />

                            <Route path="can-lam-sang" element={<ParaclinicalWorkPage />} />
                            <Route path="pt-tt" element={<ParaclinicalWorkPage />} />

                            <Route path="lich-hen" element={<AppointmentsPage />} />

                            <Route path="thu-chi" element={<CashierManagementPage />} />
                            <Route path="thu-ngan-vietqr" element={<CashierBillingAuditDashboard />} />

                            <Route path="tin-tuc" element={<NewsManagementPage />} />
                            <Route path="danh-muc-tin-tuc" element={<NewsManagementPage />} />

                            <Route path="danh-muc" element={<Navigate to="/admin/danh-muc/chung" replace />} />
                            <Route path="danh-muc/:loaiDanhMuc" element={<CatalogManagementPage />} />

                            <Route path="phan-quyen" element={<RolePermissionPage />} />
                            <Route path="nhan-vien" element={<RolePermissionPage />} />
                            <Route path="nghi-phep" element={<RolePermissionPage />} />
                            <Route path="phan-lich" element={<RolePermissionPage />} />
                            <Route path="lich-lam-viec" element={<RolePermissionPage />} />

                            <Route path="quan-ly-mau" element={<Navigate to="/admin/quan-ly-mau/mau-in" replace />} />
                            <Route path="quan-ly-mau/:loaiMau" element={<TemplateManagementPage />} />
                            <Route path="bieu-mau" element={<Navigate to="/admin/quan-ly-mau/mau-in" replace />} />
                            <Route path="bieu-mau/:loaiMau" element={<TemplateManagementPage />} />

                            <Route path="tuan-thu" element={<ComplianceAndAuditPage />} />
                            <Route path="lich-su-hoat-dong" element={<ComplianceAndAuditPage />} />

                            <Route path="huong-dan" element={<GuideAndQaManagementPage />} />
                            <Route path="danh-muc-huong-dan" element={<GuideAndQaManagementPage />} />
                            <Route path="hoi-dap" element={<GuideAndQaManagementPage />} />
                            <Route path="dang-ky-doan" element={<CorporateHealthPage />} />
                            <Route path="dangkydoan" element={<CorporateHealthPage />} />
                            <Route path="kham-doan" element={<CorporateHealthPage />} />

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
                            <Route path="patients" element={<PatientsPage />} />
                            <Route path="exam-workstation" element={<ExamWorkstationPage />} />
                            <Route path="specialty-exam" element={<Navigate to="/staff/exam-workstation" replace />} />
                            <Route path="specialty-exam/:deptKey" element={<Navigate to="/staff/exam-workstation" replace />} />
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
                            <Route path="reception" element={<Navigate to="/staff/check-in" replace />} />
                        </Route>
                    </Route>
                </Routes>
            </Suspense>
        </ConfigProvider>
    )
}

export default App
