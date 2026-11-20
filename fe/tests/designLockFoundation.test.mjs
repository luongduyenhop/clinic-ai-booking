import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    CLINICAL_ANTD_THEME,
    PATIENT_ANTD_THEME,
    isClinicalWorkbenchPath,
} from '../src/theme/clinicTheme.js'
import {
    buildQuickBookingPath,
    formatConsultFee,
    formatDoctorHeading,
    formatPublicDoctorName,
    formatVietnameseDateLabel,
    getDefaultScheduleDate,
    getOffsetIsoDate,
    getSpecialtyClinicalMetadata,
    isAutomatedTestDoctorRecord,
    isValidFutureOrTodayIsoDate,
    resolveBookingPrefill,
} from '../src/utils/helpers/quickBookingHelpers.js'

const MODIFIED_FILES = [
    '../src/theme/clinicTheme.js',
    '../src/App.jsx',
    '../src/index.css',
    '../src/layouts/ReceptionLayout.jsx',
    '../src/layouts/DoctorTemplate.jsx',
    '../src/layouts/staff/StaffLayout.jsx',
    '../src/layouts/AdminTemplate.jsx',
    '../src/layouts/UserTemplate.jsx',
    '../src/components/user/UserHeader.jsx',
    '../src/layouts/PatientPortalLayout.jsx',
    '../src/pages/user/HomePage.jsx',
    '../src/components/user/home/HomeHero.jsx',
    '../src/components/user/home/DoctorSection.jsx',
    '../src/components/user/home/SpecialtySection.jsx',
    '../src/components/user/home/ClinicIntroSection.jsx',
    '../src/components/user/home/OutpatientCareGuideSection.jsx',
    '../src/services/user/MedicalCatalogService.js',
    '../src/pages/user/BookingPage.jsx',
    '../src/components/user/booking/BookingStepper.jsx',
    '../src/components/user/booking/SpecialtyDoctorStep.jsx',
    '../src/components/user/booking/DateSlotStep.jsx',
    '../src/components/user/booking/PatientInfoStep.jsx',
    '../src/components/user/booking/BookingSummary.jsx',
    '../src/components/user/booking/BookingSuccess.jsx',
    '../src/pages/user/SymptomSurveyPage.jsx',
    '../src/components/user/triage/SymptomToggle.jsx',
    '../src/components/user/triage/SpecialtyRecommendation.jsx',
    '../src/components/user/triage/EmergencyAlert.jsx',
    '../src/pages/user/LoginPage.jsx',
    '../src/pages/user/RegisterPage.jsx',
    '../src/utils/helpers/doctorNameHelper.js',
    '../src/utils/doctorHelper.js',
    '../src/utils/helpers/quickBookingHelpers.js',
    '../src/utils/helpers/patientMedicalMapping.js',
    '../src/components/common/ClinicIcon.jsx',
    '../src/pages/user/BookingWizardPage.jsx',
    '../src/components/user/triage/TriageStepper.jsx',
    '../src/components/user/triage/MainSymptomStep.jsx',
    '../src/components/user/triage/SymptomDetailsStep.jsx',
    '../src/components/user/triage/PatientContextStep.jsx',
    '../src/layouts/PatientPortalLayout.jsx',
    '../src/components/user/patient/PatientPageHeader.jsx',
    '../src/components/user/patient/PatientPageState.jsx',
    '../src/components/user/patient/AppointmentCard.jsx',
    '../src/components/user/patient/ResultAttachments.jsx',
    '../src/pages/user/patient/PatientDashboardPage.jsx',
    '../src/pages/user/patient/PatientAppointmentsPage.jsx',
    '../src/pages/user/patient/MedicalHistoryPage.jsx',
    '../src/pages/user/patient/PrescriptionsPage.jsx',
    '../src/pages/user/patient/LabResultsPage.jsx',
    '../src/pages/user/patient/DoctorSchedulesPage.jsx',
    '../src/pages/user/PatientProfilePage.jsx',
    '../src/pages/user/PatientMedicalRecordsPage.jsx',
    '../src/pages/user/PatientBillingPage.jsx',
    '../src/pages/staff/StaffLoginPage.jsx',
    '../src/layouts/staff/StaffSidebar.jsx',
    '../src/pages/doctor/DoctorDashboardPage.jsx',
    '../src/pages/doctor/ExamWorkstationPage.jsx',
    '../src/pages/doctor/ParaclinicalWorkPage.jsx',
    '../src/pages/admin/ParaclinicalPage.jsx',
    '../src/components/doctor/exam/WorkstationHeaderBar.jsx',
    '../src/components/doctor/exam/WorkstationEmptyState.jsx',
    '../src/components/doctor/exam/PatientBanner.jsx',
    '../src/components/doctor/exam/ExamStepTabs.jsx',
    '../src/components/doctor/exam/ExamActionBar.jsx',
    '../src/components/doctor/exam/ClsResultRail.jsx',
    '../src/components/doctor/exam/QueuePanel.jsx',
    '../src/components/doctor/exam/ClinicalRail.jsx',
    '../src/components/doctor/exam/StepClinical.jsx',
    '../src/components/doctor/exam/SpecialtyExamSection.jsx',
    '../src/components/doctor/exam/StepDiagnosis.jsx',
    '../src/components/doctor/exam/StepOrders.jsx',
    '../src/components/doctor/exam/StepPrescription.jsx',
    '../src/components/doctor/DoctorHeaderProfile.jsx',
    '../src/components/doctor/DoctorCertificateModal.jsx',
    '../src/components/doctor/DoctorEditProfileModal.jsx',
    '../src/components/doctor/DoctorScheduleTab.jsx',
    '../src/components/doctor/DoctorShiftRequestModal.jsx',
    '../src/components/doctor/ExaminedHistoryTab.jsx',
    '../src/components/doctor/PrescriptionPrintAndCopyModal.jsx',
    '../src/components/doctor/clinical/StateBlocks.jsx',
    '../src/components/doctor/cls/ClsApprovalBar.jsx',
    '../src/components/doctor/cls/IndicatorResultForm.jsx',
    '../src/components/doctor/cls/ImagingResultForm.jsx',
    '../src/components/doctor/cls/EndoscopyResultForm.jsx',
    '../src/components/doctor/cls/ResultFormParts.jsx',
    '../src/components/doctor/cls/ClsImageUploader.jsx',
    '../src/components/doctor/cls/ClsResultPrintModal.jsx',
    '../src/components/reception/ReceptionHeader.jsx',
    '../src/components/reception/ReceptionSidebar.jsx',
    '../src/components/reception/queue/QueueFilterToolbar.jsx',
    '../src/components/reception/queue/RoomDepartmentFilter.jsx',
    '../src/pages/reception/ReceptionDashboardPage.jsx',
    '../src/pages/reception/CheckInPage.jsx',
    '../src/pages/reception/ClinicSchedulePage.jsx',
    '../src/pages/reception/AppointmentsPage.jsx',
    '../src/pages/reception/PatientsPage.jsx',
    '../src/pages/reception/TasksPage.jsx',
    '../src/pages/reception/ReportsPage.jsx',
    '../src/pages/reception/AdministrationPage.jsx',
    '../src/components/reception/AppointmentDetailModal.jsx',
    '../src/components/reception/AppointmentFormModal.jsx',
    '../src/components/reception/IncidentDetailDrawer.jsx',
    '../src/components/reception/PatientDetailDrawer.jsx',
    '../src/components/reception/PatientFormModal.jsx',
    '../src/components/reception/PrintReceiptModal.jsx',
    '../src/components/reception/TvQueueDisplayModal.jsx',
    '../src/pages/admin/CashierManagementPage.jsx',
    '../src/pages/admin/CashierBillingAuditDashboard.jsx',
    '../src/pages/reception/QueueManagementPage.jsx',
    '../src/components/reception/queue/QueueHeaderBar.jsx',
    '../src/components/reception/queue/QueueRoomActiveBanner.jsx',
    '../src/components/reception/queue/QueueMainTable.jsx',
    '../src/components/reception/queue/QueueWaitlistTable.jsx',
    '../src/components/reception/queue/QueueAuditHistoryModal.jsx',
    '../src/components/reception/QueueActionModal.jsx',
    '../src/components/cashier/CashierStatsHeader.jsx',
    '../src/components/cashier/CashierClosingTab.jsx',
    '../src/components/cashier/VoucherEditorForm.jsx',
    '../src/components/cashier/UnbilledEncounterList.jsx',
    '../src/components/cashier/PatientVoucherGroups.jsx',
    '../src/components/cashier/AllVouchersTable.jsx',
    '../src/components/admin/AdminHeader.jsx',
    '../src/pages/admin/DashboardAdminPage.jsx',
    '../src/pages/admin/CatalogManagementPage.jsx',
    '../src/components/admin/catalog/CatalogNavigationTabs.jsx',
    '../src/components/admin/catalog/CatalogTableView.jsx',
    '../src/components/admin/catalog/CatalogFormDetail.jsx',
    '../src/components/admin/catalog/PriceHistoryModal.jsx',
    '../src/components/admin/catalog/ExportServiceModal.jsx',
    '../src/pages/admin/TemplateManagementPage.jsx',
    '../src/pages/admin/RolePermissionPage.jsx',
    '../src/components/admin/AdminStaffManagementTab.jsx',
    '../src/components/admin/DoctorScheduleManagementTab.jsx',
    '../src/components/admin/DoctorLeaveManagementTab.jsx',
    '../src/pages/admin/PatientManagementPage.jsx',
    '../src/pages/admin/ComplianceAndAuditPage.jsx',
    '../src/components/admin/AmendmentManagementTab.jsx',
    '../src/pages/admin/SettingClinicPage.jsx',
    '../src/utils/helpers/clinicConfigHelpers.js',
    '../src/pages/admin/NewsManagementPage.jsx',
    '../src/pages/admin/GuideAndQaManagementPage.jsx',
    '../src/pages/admin/ServicePackagesPage.jsx',
    '../src/pages/admin/TreatmentCoursePage.jsx',
    '../src/pages/admin/DownloadAppPage.jsx',
    '../src/pages/admin/CorporateHealthPage.jsx',
    '../src/pages/admin/AppointmentManagementPage.jsx',
    '../src/pages/admin/ReceptionRegistrationPage.jsx',
    '../src/pages/admin/SpecialtyExamPage.jsx',
    '../src/pages/error/NotFoundPage.jsx',
]

test('isClinicalWorkbenchPath classifies clinical routes and handles null/lookalike routes', () => {
    assert.equal(isClinicalWorkbenchPath('/admin'), true)
    assert.equal(isClinicalWorkbenchPath('/admin/danh-muc/chuyen-khoa'), true)
    assert.equal(isClinicalWorkbenchPath('/doctor'), true)
    assert.equal(isClinicalWorkbenchPath('/doctor/can-lam-sang'), true)
    assert.equal(isClinicalWorkbenchPath('/reception/dashboard'), true)
    assert.equal(isClinicalWorkbenchPath('/staff/exam-workstation'), true)

    assert.equal(isClinicalWorkbenchPath('/'), false)
    assert.equal(isClinicalWorkbenchPath('/dat-lich'), false)
    assert.equal(isClinicalWorkbenchPath('/benh-nhan'), false)
    assert.equal(isClinicalWorkbenchPath('/benh-nhan/lich-hen'), false)
    assert.equal(isClinicalWorkbenchPath('/administrator'), false)
    assert.equal(isClinicalWorkbenchPath('/doctors'), false)
    assert.equal(isClinicalWorkbenchPath(''), false)
    assert.equal(isClinicalWorkbenchPath(undefined), false)
    assert.equal(isClinicalWorkbenchPath(null), false)
})

test('PATIENT_ANTD_THEME and CLINICAL_ANTD_THEME share locked tokens with 8px vs 6px density', () => {
    assert.equal(PATIENT_ANTD_THEME.token.colorPrimary, '#0077AA')
    assert.equal(CLINICAL_ANTD_THEME.token.colorPrimary, '#0077AA')
    assert.equal(PATIENT_ANTD_THEME.token.colorTextHeading, '#003553')
    assert.equal(CLINICAL_ANTD_THEME.token.colorTextHeading, '#003553')
    assert.equal(PATIENT_ANTD_THEME.token.colorText, '#0F172A')
    assert.equal(CLINICAL_ANTD_THEME.token.colorText, '#0F172A')
    assert.equal(PATIENT_ANTD_THEME.token.borderRadius, 8)
    assert.equal(CLINICAL_ANTD_THEME.token.borderRadius, 6)
    assert.equal(PATIENT_ANTD_THEME.components.Button.borderRadius, 8)
    assert.equal(CLINICAL_ANTD_THEME.components.Button.borderRadius, 6)
    assert.equal(PATIENT_ANTD_THEME.components.Table.cellPaddingBlock, 12)
    assert.equal(CLINICAL_ANTD_THEME.components.Table.cellPaddingBlock, 8)
    assert.equal(PATIENT_ANTD_THEME.components.Button.primaryShadow, 'none')
    assert.equal(CLINICAL_ANTD_THEME.components.Button.primaryShadow, 'none')
})

test('PR 1 files contain zero comments and zero banned Design Lock patterns', async () => {
    for (const relPath of MODIFIED_FILES) {
        const content = await readFile(new URL(relPath, import.meta.url), 'utf8')
        const contentWithoutUrls = content.replace(/https?:\/\/[^\s'"`]+/g, '')
        const contentWithoutAcceptMimeGlob = content.replace(/image\/\*/g, '')
        assert.ok(!contentWithoutUrls.includes('//'), `${relPath} must not contain // comments`)
        assert.ok(!contentWithoutAcceptMimeGlob.includes('/*'), `${relPath} must not contain /* comments`)
        assert.ok(!content.includes('animate-pulse'), `${relPath} must not contain animate-pulse`)
        assert.ok(!content.includes('bg-gradient-'), `${relPath} must not contain gradient backgrounds`)
        assert.ok(
            !content.includes('✚') &&
                !content.includes('🗓') &&
                !content.includes('🔒') &&
                !content.includes('🌅') &&
                !content.includes('🌇') &&
                !content.includes('⚠️') &&
                !content.includes('⭐') &&
                !content.includes('📋') &&
                !content.includes('⚡') &&
                !content.includes('💵') &&
                !content.includes('📱'),
            `${relPath} must not contain emojis`
        )
        assert.ok(!content.includes('text-[#00B5F1]') && !content.includes('bg-[#00B5F1]'), `${relPath} must not use #00B5F1 for text or buttons`)
    }
})

test('App centralizes ConfigProvider and ReceptionLayout removes duplicate ConfigProvider', async () => {
    const appContent = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
    const receptionContent = await readFile(new URL('../src/layouts/ReceptionLayout.jsx', import.meta.url), 'utf8')
    assert.ok(appContent.includes('<ConfigProvider'), 'App.jsx must wrap routes with ConfigProvider')
    assert.ok(appContent.includes('CLINICAL_ANTD_THEME') && appContent.includes('PATIENT_ANTD_THEME'), 'App.jsx must switch between clinical and patient themes')
    assert.ok(!receptionContent.includes('ConfigProvider'), 'ReceptionLayout.jsx must not duplicate ConfigProvider')
})

test('index.css enforces Design Lock shadows, radii, tabular-nums, #0077AA CTA and unblocked AntD table density', async () => {
    const cssContent = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
    assert.ok(!cssContent.includes('rgba(0, 181, 241'), 'index.css must not have glowing cyan shadows')
    assert.ok(cssContent.includes('--color-clinic-cta: #0077AA'), 'index.css must define #0077AA CTA token')
    assert.ok(cssContent.includes('font-variant-numeric: tabular-nums'), 'index.css must support tabular-nums')
    assert.ok(cssContent.includes('[data-density="clinical"]'), 'index.css must define clinical density radius override')
    assert.ok(!cssContent.includes('padding: 10px 12px !important'), 'index.css must not override AntD Table density padding with !important')
    assert.ok(cssContent.includes('.ant-input-affix-wrapper .ant-input:focus'), 'index.css must suppress inner affix input focus shadow')
})

test('HomeHero implements Hybrid 1+2 photo banner and docked quick booking with no decorative slop', async () => {
    const heroContent = await readFile(new URL('../src/components/user/home/HomeHero.jsx', import.meta.url), 'utf8')
    const homeContent = await readFile(new URL('../src/pages/user/HomePage.jsx', import.meta.url), 'utf8')
    const doctorContent = await readFile(new URL('../src/components/user/home/DoctorSection.jsx', import.meta.url), 'utf8')
    const specialtyContent = await readFile(new URL('../src/components/user/home/SpecialtySection.jsx', import.meta.url), 'utf8')

    assert.ok(heroContent.includes('useMedicalCatalog'), 'HomeHero must load real catalog data via useMedicalCatalog')
    assert.ok(heroContent.includes('buildQuickBookingPath'), 'HomeHero must build quick-booking query params')
    assert.ok(heroContent.includes('/images/hospital-corridor.jpg'), 'HomeHero must render local hospital photo')
    assert.ok(!heroContent.includes('Sparkle'), 'HomeHero must not render Sparkle pills')
    assert.ok(!heroContent.includes('rounded-[32px]'), 'HomeHero must not use rounded-[32px] decorative container')
    assert.ok(!heroContent.includes('Đặt lịch 24/7'), 'HomeHero must not render floating corner cards')

    assert.ok(!homeContent.includes('QuickActions'), 'HomePage must remove AI-slop QuickActions')
    assert.ok(!homeContent.includes('BookingSteps'), 'HomePage must remove AI-slop BookingSteps')
    assert.ok(!homeContent.includes('AiTriageSection'), 'HomePage must remove AI-slop AiTriageSection')
    assert.ok(homeContent.includes('ClinicIntroSection'), 'HomePage must render ClinicIntroSection')
    assert.ok(homeContent.includes('OutpatientCareGuideSection'), 'HomePage must render OutpatientCareGuideSection')

    const catalogContent = await readFile(new URL('../src/services/user/MedicalCatalogService.js', import.meta.url), 'utf8')
    assert.ok(catalogContent.includes('isAutomatedTestDoctorRecord'), 'MedicalCatalogService must filter automated test doctors')

    assert.ok(doctorContent.includes('getAvailableSlots'), 'DoctorSection must fetch real available slots per doctor')
    assert.ok(doctorContent.includes('doctor-portrait.webp'), 'DoctorSection must render physician portrait photography')
    assert.ok(!doctorContent.includes('rounded-t-[48px]'), 'DoctorSection must not render arched decorative avatars')
    assert.ok(!heroContent.includes('ArrowRight'), 'HomeHero must not spam arrow icons')
    assert.ok(!doctorContent.includes('ArrowRight'), 'DoctorSection must not spam arrow icons')
    assert.ok(!specialtyContent.includes('ArrowRight'), 'SpecialtySection must not spam arrow icons')
    assert.ok(specialtyContent.includes('<table'), 'SpecialtySection must render structured directory table')

    const introContent = await readFile(new URL('../src/components/user/home/ClinicIntroSection.jsx', import.meta.url), 'utf8')
    assert.ok(introContent.includes('clinic-consultation.webp'), 'ClinicIntroSection must render clinic consultation photography')

    const guideContent = await readFile(new URL('../src/components/user/home/OutpatientCareGuideSection.jsx', import.meta.url), 'utf8')
    assert.ok(!guideContent.includes('Bước 01'), 'OutpatientCareGuideSection must not use symmetric Bước 01-04 template grid')
})

test('formatPublicDoctorName and formatDoctorHeading normalize seeded placeholder names cleanly', () => {
    assert.equal(formatPublicDoctorName('Bác sĩ Nội tổng quát [DEMO]'), 'Bác sĩ Nội tổng quát')
    assert.equal(formatPublicDoctorName('BS. Trần Văn Bình [DEMO]'), 'BS. Trần Văn Bình')
    assert.equal(formatPublicDoctorName(''), 'Bác sĩ Chuyên khoa')
    assert.equal(formatDoctorHeading({ degree: 'BS', name: 'BS.CKI Nguyễn Minh Hoàng' }), 'BS.CKI Nguyễn Minh Hoàng')
    assert.equal(formatDoctorHeading({ degree: 'ThS. BS', name: 'Đặng Hải Phương' }), 'ThS. BS Đặng Hải Phương')
})

test('isAutomatedTestDoctorRecord excludes unlinked automated test records and keeps real doctors', () => {
    assert.equal(isAutomatedTestDoctorRecord({ ho_ten: 'Test bs_x 7fdd8905', chuyen_khoa_id: null }), true)
    assert.equal(isAutomatedTestDoctorRecord({ ho_ten: 'Test bs_y 7fdd8905', chuyen_khoa_id: '' }), true)
    assert.equal(isAutomatedTestDoctorRecord({ ho_ten: 'Test bs_x 7fdd8905', chuyen_khoa_id: 1 }), false)
    assert.equal(isAutomatedTestDoctorRecord({ ho_ten: 'Bác sĩ Nội tổng quát [DEMO]', chuyen_khoa_id: 1 }), false)
    assert.equal(isAutomatedTestDoctorRecord({ ho_ten: 'BS. Nguyễn Văn An', chuyen_khoa_id: null }), false)
})

test('quickBookingHelpers builds and resolves quick-booking URL params cleanly across edge cases', () => {
    const specialties = [{ id: '1', name: 'Nội Tổng Quát' }, { id: '2', name: 'Tim Mạch' }]
    const doctors = [
        { id: '10', name: 'BS A', specialtyId: '1' },
        { id: '20', name: 'BS B', specialtyId: '2' },
    ]

    assert.equal(buildQuickBookingPath({}), '/dat-lich')
    assert.equal(
        buildQuickBookingPath({ specialtyId: '', doctorId: '10', appointmentDate: '2026-11-25', doctors }),
        '/dat-lich?specialty=1&doctor=10&date=2026-11-25'
    )
    assert.equal(
        buildQuickBookingPath({ specialtyId: '1', doctorId: '10', appointmentDate: '2026-11-25', timeSlot: '08:00', doctors }),
        '/dat-lich?specialty=1&doctor=10&date=2026-11-25&slot=08%3A00'
    )
    assert.equal(formatConsultFee(150000).replace(/\u00a0/g, ' '), '150.000đ')
    assert.equal(formatConsultFee(0), 'Theo niêm yết')
    assert.equal(formatVietnameseDateLabel('2026-11-19'), 'Thứ Năm, 19/11/2026')
    assert.equal(formatVietnameseDateLabel('bad-date'), '')
    assert.equal(getOffsetIsoDate(1, new Date(2026, 10, 18, 10, 0)), '2026-11-19')
    assert.equal(getDefaultScheduleDate(new Date(2026, 10, 18, 9, 0)), '2026-11-18')
    assert.equal(getDefaultScheduleDate(new Date(2026, 10, 18, 17, 0)), '2026-11-19')

    assert.equal(isValidFutureOrTodayIsoDate('2026-11-25', '2026-11-18'), true)
    assert.equal(isValidFutureOrTodayIsoDate('2026-11-18', '2026-11-18'), true)
    assert.equal(isValidFutureOrTodayIsoDate('2026-11-17', '2026-11-18'), false)
    assert.equal(isValidFutureOrTodayIsoDate('2026-02-31', '2026-11-18'), false)
    assert.equal(isValidFutureOrTodayIsoDate('invalid', '2026-11-18'), false)

    assert.deepEqual(
        resolveBookingPrefill({
            specialties,
            doctors,
            requestedSpecialty: '1',
            requestedDoctor: '10',
            requestedDate: '2026-11-25',
            todayIso: '2026-11-18',
        }),
        {
            booking: {
                specialtyId: '1',
                doctorId: '10',
                appointmentDate: '2026-11-25',
                timeSlot: '',
            },
            initialStep: 2,
        }
    )

    assert.deepEqual(
        resolveBookingPrefill({
            specialties,
            doctors,
            requestedSpecialty: '1',
            requestedDoctor: '',
            requestedDate: '2026-11-25',
            todayIso: '2026-11-18',
        }),
        {
            booking: {
                specialtyId: '1',
                doctorId: '',
                appointmentDate: '2026-11-25',
                timeSlot: '',
            },
            initialStep: 1,
        }
    )

    assert.deepEqual(
        resolveBookingPrefill({
            specialties,
            doctors,
            requestedSpecialty: '',
            requestedDoctor: '20',
            requestedDate: '2026-11-10',
            requestedSlot: '08:30',
            todayIso: '2026-11-18',
        }),
        {
            booking: {
                specialtyId: '2',
                doctorId: '20',
                appointmentDate: '',
                timeSlot: '',
            },
            initialStep: 1,
        }
    )
})

test('getSpecialtyClinicalMetadata resolves fee, procedures and floor across codes, names and fallback', () => {
    const internalMed = getSpecialtyClinicalMetadata('KHOA_NOI')
    assert.equal(internalMed.fee, 150000)
    assert.ok(internalMed.services.includes('ECG'))
    assert.equal(internalMed.floor, 'Phòng 101 – Tầng 1')

    const entByCode = getSpecialtyClinicalMetadata('KHOA_TMH')
    const entByName = getSpecialtyClinicalMetadata('Tai Mũi Họng')
    assert.equal(entByCode.fee, 220000)
    assert.equal(entByName.fee, 220000)
    assert.ok(entByCode.services.includes('Nội soi Tai Mũi Họng'))

    assert.equal(getSpecialtyClinicalMetadata('KHOA_NGOAI').fee, 200000)
    assert.equal(getSpecialtyClinicalMetadata('KHOA_RANG').fee, 180000)
    assert.equal(getSpecialtyClinicalMetadata('KHOA_MAT').fee, 160000)

    const fallback = getSpecialtyClinicalMetadata('UNKNOWN')
    assert.equal(fallback.fee, 150000)
    assert.equal(fallback.floor, 'Khu Khám Ngoại Trú')
})

test('homepage content sections expose clinical fees, compliance standards and operational guidance', async () => {
    const introContent = await readFile(new URL('../src/components/user/home/ClinicIntroSection.jsx', import.meta.url), 'utf8')
    assert.ok(introContent.includes('32/2023/TT-BYT'))
    assert.ok(introContent.includes('115'))

    const specialtyContent = await readFile(new URL('../src/components/user/home/SpecialtySection.jsx', import.meta.url), 'utf8')
    assert.ok(specialtyContent.includes('formatSpecialtyFeeRange'))
    assert.ok(specialtyContent.includes('Giá khám niêm yết'))

    const guideContent = await readFile(new URL('../src/components/user/home/OutpatientCareGuideSection.jsx', import.meta.url), 'utf8')
    assert.ok(guideContent.includes('Quy trình 04 bước khám khép kín'))
    assert.ok(!guideContent.includes('Bước 01'))
})
