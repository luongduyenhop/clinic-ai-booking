import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('StepDiagnosis preserves AI triage rating, ICD-10 presets and CLS summary', async () => {
    const content = await readFile(new URL('../src/components/doctor/exam/StepDiagnosis.jsx', import.meta.url), 'utf8')
    assert.ok(content.includes('onRateAi'), 'StepDiagnosis must accept onRateAi prop')
    assert.ok(content.includes('DEPARTMENT_ICD10_PRESETS'), 'StepDiagnosis must define DEPARTMENT_ICD10_PRESETS')
    assert.ok(content.includes('KHOA_NOI') && content.includes('KHOA_MAT'), 'StepDiagnosis must cover specialties')
    assert.ok(content.includes('onSendPickedOrders'), 'StepDiagnosis must handle onSendPickedOrders')
    assert.ok(content.includes('ResultAttachments'), 'StepDiagnosis must render ResultAttachments for completed orders')
    assert.ok(!content.includes('//') && !content.includes('/*'), 'StepDiagnosis must be clean without comments')
})

test('ExamWorkstationPage connects StepDiagnosis with onRateAi and doctorSpecialty', async () => {
    const content = await readFile(new URL('../src/pages/doctor/ExamWorkstationPage.jsx', import.meta.url), 'utf8')
    assert.ok(content.includes('onRateAi={handleRateAi}'), 'ExamWorkstationPage must pass onRateAi to StepDiagnosis')
    assert.ok(content.includes('doctorSpecialty='), 'ExamWorkstationPage must pass doctorSpecialty to StepDiagnosis')
})

test('ExamWorkstationPage wires ExamStepTabs, StepOrders, StepDiagnosis, StepPrescription and print modal cleanly', async () => {
    const content = await readFile(new URL('../src/pages/doctor/ExamWorkstationPage.jsx', import.meta.url), 'utf8')
    assert.ok(content.includes('counts={{'), 'ExamWorkstationPage must pass counts to ExamStepTabs')
    assert.ok(content.includes('onSubmit={handleCreateOrders}'), 'ExamWorkstationPage must pass onSubmit to StepOrders')
    assert.ok(content.includes('picked={pickedOrders}'), 'ExamWorkstationPage must pass picked to StepOrders')
    assert.ok(content.includes('onPickedChange={setPickedOrders}'), 'ExamWorkstationPage must pass onPickedChange to StepOrders')
    assert.ok(content.includes('encounter={encounter}'), 'ExamWorkstationPage must pass encounter to child steps')
    assert.ok(content.includes('doctorSpecialty={resolvedSpecialty?.key'), 'ExamWorkstationPage must pass resolvedSpecialty key to StepDiagnosis')
    assert.ok(content.includes('pickedOrders={pickedOrders}'), 'ExamWorkstationPage must pass pickedOrders to StepDiagnosis')
    assert.ok(content.includes('onSendPickedOrders='), 'ExamWorkstationPage must pass onSendPickedOrders to StepDiagnosis')
    assert.ok(content.includes('onGoToStepOrders='), 'ExamWorkstationPage must pass onGoToStepOrders to StepDiagnosis')
    assert.ok(content.includes('onOpenRxModal='), 'ExamWorkstationPage must pass onOpenRxModal to StepPrescription')
    assert.ok(content.includes('patient={encounter?.benh_nhan'), 'ExamWorkstationPage must pass patient to PrescriptionPrintAndCopyModal')
    assert.ok(content.includes('key={rxModalState.open ? rxModalState.tab :'), 'ExamWorkstationPage must key PrescriptionPrintAndCopyModal by tab state')
    assert.ok(!content.includes('//') && !content.includes('/*'), 'ExamWorkstationPage must be clean without comments')
})

test('useDoctorWorkstationLogic initializes formik before validateClinicalStep and avoids frozen encounter mutation', async () => {
    const content = await readFile(new URL('../src/hooks/useDoctorWorkstationLogic.jsx', import.meta.url), 'utf8')
    const formikIdx = content.indexOf('const formik = useFormik(')
    const validateIdx = content.indexOf('const validateClinicalStep = useCallback(')
    assert.ok(formikIdx !== -1 && validateIdx !== -1 && formikIdx < validateIdx, 'useFormik must be declared before validateClinicalStep')
    assert.ok(content.includes('formik.values.kham_chuyen_khoa]'), 'validateClinicalStep deps must include formik.values.kham_chuyen_khoa')
    assert.ok(content.includes("'danh_sach_chan_doan'") && content.includes("'danh_sach_thuoc'"), 'DRAFT_FIELDS must sync diagnoses and draft prescription items')
    assert.ok(content.includes("'loi_dan_bac_si'") && content.includes("'ngay_hen_tai_kham'"), 'DRAFT_FIELDS must sync advice and follow-up date')
    assert.ok(content.includes('skipPickedCheck'), 'handleStepChange must support skipPickedCheck')
    assert.ok(!content.includes('encounter.thoi_gian_bat_dau ='), 'useDoctorWorkstationLogic must not mutate Redux frozen encounter object')
    assert.ok(!content.includes('//') && !content.includes('/*'), 'useDoctorWorkstationLogic must be clean without comments')
})

test('printMedicalDocuments escapes dynamic HTML and StepPrescription retains print modal trigger', async () => {
    const printSrc = await readFile(new URL('../src/utils/helpers/printMedicalDocuments.js', import.meta.url), 'utf8')
    const stepRxSrc = await readFile(new URL('../src/components/doctor/exam/StepPrescription.jsx', import.meta.url), 'utf8')
    assert.ok(printSrc.includes('function escapeHtml('), 'printMedicalDocuments must define escapeHtml')
    assert.ok(printSrc.includes('escapeHtml(patientName)') && printSrc.includes('escapeHtml(dxMainText)'), 'printMedicalDocuments must escape interpolated values')
    assert.ok(!printSrc.includes('//') && !printSrc.includes('/*'), 'printMedicalDocuments must be clean without comments')
    assert.ok(stepRxSrc.includes("onOpenRxModal('print')"), 'StepPrescription must preserve A4/A5 print modal trigger')
    assert.ok(stepRxSrc.includes('danh_sach_chan_doan: values.danh_sach_chan_doan || []'), 'StepPrescription sign payload must forward danh_sach_chan_doan')
    assert.ok(!stepRxSrc.includes('//') && !stepRxSrc.includes('/*'), 'StepPrescription must be clean without comments')
})

test('BookingPage unifies MedPro card layout, AI recommendation and slot retry', async () => {
    const content = await readFile(new URL('../src/pages/user/BookingPage.jsx', import.meta.url), 'utf8')
    assert.ok(content.includes('aiRecommendation'), 'BookingPage must preserve aiRecommendation state and payload')
    assert.ok(content.includes('Tải lại khung giờ'), 'BookingPage must provide slot reload button on error')
    assert.ok(content.includes('ShieldCheck'), 'BookingPage must display ShieldCheck security notice')
    assert.ok(content.includes('public-container'), 'BookingPage must retain public-container layout')
    assert.ok(!content.includes('//') && !content.includes('/*'), 'BookingPage must be clean without comments')
})

test('AdminHeader and ReceptionHeader preserve expected controls', async () => {
    const adminContent = await readFile(new URL('../src/components/admin/AdminHeader.jsx', import.meta.url), 'utf8')
    const recContent = await readFile(new URL('../src/components/reception/ReceptionHeader.jsx', import.meta.url), 'utf8')
    assert.ok(adminContent.includes('toggleLanguage') && adminContent.includes('Globe'), 'AdminHeader must have language toggle')
    assert.ok(recContent.includes('isIncidentResolved') && recContent.includes('resolvedIncidentKeys'), 'ReceptionHeader must preserve resolved incident filtering from 569f412')
})

test('Reception pages preserve doctor absences rebalancing and emergency handover', async () => {
    const scheduleContent = await readFile(new URL('../src/pages/reception/ClinicSchedulePage.jsx', import.meta.url), 'utf8')
    const checkInContent = await readFile(new URL('../src/pages/reception/CheckInPage.jsx', import.meta.url), 'utf8')
    const queueContent = await readFile(new URL('../src/pages/reception/QueueManagementPage.jsx', import.meta.url), 'utf8')
    assert.ok(scheduleContent.includes('activeAbsences.map') && scheduleContent.includes('isIncidentResolved'), 'ClinicSchedulePage must filter activeAbsences with isIncidentResolved')
    assert.ok(scheduleContent.includes('/reception/tasks'), 'ClinicSchedulePage must link to reception tasks')
    assert.ok(checkInContent.includes('EmergencyHandoverModal'), 'CheckInPage must retain EmergencyHandoverModal')
    assert.ok(queueContent.includes('knownDepIds') && queueContent.includes('handleRefreshQueue'), 'QueueManagementPage must preserve department room mapping and sync control')
})

test('Admin layout and dashboard maintain core structure and zero comments', async () => {
    const templateContent = await readFile(new URL('../src/layouts/AdminTemplate.jsx', import.meta.url), 'utf8')
    const dashboardContent = await readFile(new URL('../src/pages/admin/DashboardAdminPage.jsx', import.meta.url), 'utf8')
    assert.ok(templateContent.includes('AdminHeader'), 'AdminTemplate must render AdminHeader')
    assert.ok(templateContent.includes('getNavigationConfig'), 'AdminTemplate must use getNavigationConfig')
    assert.ok(templateContent.includes('Trung tâm Điều hành & Thống kê BI'), 'AdminTemplate must retain BI breadcrumb')
    assert.ok(!templateContent.includes('//') && !templateContent.includes('/*'), 'AdminTemplate must be clean without comments')
    assert.ok(dashboardContent.includes('getDashboardStatsAsync'), 'DashboardAdminPage must fetch dashboard stats')
    assert.ok(dashboardContent.includes('OPERATIONAL_PORTAL_LINKS'), 'DashboardAdminPage must define operational portal links')
    assert.ok(!dashboardContent.includes('//') && !dashboardContent.includes('/*'), 'DashboardAdminPage must be clean without comments')
})

test('ClinicalService completes backend encounter outside demoMode and ExaminedHistoryTab uses real vitals and doctorName', async () => {
    const clinicalSrc = await readFile(new URL('../src/services/doctor/ClinicalService.js', import.meta.url), 'utf8')
    const deltaSyncSrc = await readFile(new URL('../src/utils/helpers/clinicalDeltaSync.js', import.meta.url), 'utf8')
    const historySrc = await readFile(new URL('../src/components/doctor/ExaminedHistoryTab.jsx', import.meta.url), 'utf8')
    const cashierHookSrc = await readFile(new URL('../src/hooks/useCashierPageLogic.js', import.meta.url), 'utf8')
    assert.ok(deltaSyncSrc.includes('if (!enc || enc.is_locked) return false'), 'filterSyncableEncounters must exclude locked encounters')
    assert.ok(clinicalSrc.includes('/api/v1/clinical/encounters/${enc.luot_kham_server_id}/complete'), 'completeEncounter must post to backend complete endpoint when luot_kham_server_id exists')
    assert.ok(!clinicalSrc.includes('CLINIC_AI_MANAGEMENT_DB_V2_PROMAX'), 'ClinicalService must not write fake vouchers to V2_PROMAX localStorage')
    assert.ok(!clinicalSrc.includes('clinic_patient_completed_encounters_v1'), 'ClinicalService must not write fake patient history to localStorage')
    assert.ok(!clinicalSrc.includes('8500'), 'ClinicalService must not invent 8500 drug prices')
    assert.ok(cashierHookSrc.includes('cashierService.getInvoices'), 'useCashierPageLogic must load real invoices from backend API')
    assert.ok(cashierHookSrc.includes('cashierService.closeShift'), 'useCashierPageLogic must close shift via backend API')
    assert.ok(!cashierHookSrc.includes('CLINIC_AI_MANAGEMENT_DB_V3_CLINICAL'), 'useCashierPageLogic must not mix localStorage vouchers')
    assert.ok(!cashierHookSrc.includes('//') && !cashierHookSrc.includes('/*'), 'useCashierPageLogic must be clean without comments')
    assert.ok(historySrc.includes('selectedRecord.doctorName'), 'ExaminedHistoryTab must render selectedRecord.doctorName')
    assert.ok(!historySrc.includes('BS. CKI Nguyễn Văn An'), 'ExaminedHistoryTab must not hardcode BS. CKI Nguyễn Văn An')
    assert.ok(!historySrc.includes('125/80'), 'ExaminedHistoryTab must not hardcode fallback 125/80 vitals')
})

test('Admin routes connect guide and QA management pages without dead redirects', async () => {
    const appContent = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
    assert.ok(appContent.includes("./pages/admin/GuideAndQaManagementPage") && appContent.includes('GuideAndQaManagementPage'), 'App.jsx must load GuideAndQaManagementPage')
    assert.ok(appContent.includes('<Route path="huong-dan" element={<GuideAndQaManagementPage />} />'), 'huong-dan must route to GuideAndQaManagementPage')
    assert.ok(appContent.includes('<Route path="hoi-dap" element={<GuideAndQaManagementPage />} />'), 'hoi-dap must route to GuideAndQaManagementPage')
    assert.ok(appContent.includes('<Route path="dang-ky-kham" element={<CheckInPage />} />'), 'dang-ky-kham must route to unified CheckInPage')
    assert.ok(appContent.includes('<Route path="kham-chuyen-khoa/:deptKey" element={<ExamWorkstationPage />} />'), 'kham-chuyen-khoa must route to unified ExamWorkstationPage')
    assert.ok(appContent.includes('<Route path="can-lam-sang" element={<ParaclinicalWorkPage />} />'), 'can-lam-sang must route to unified ParaclinicalWorkPage')
    assert.ok(appContent.includes('<Route path="specialty-exam" element={<Navigate to="/staff/exam-workstation" replace />} />'), 'staff specialty-exam must redirect to exam-workstation')
    assert.ok(appContent.includes('<Route path="reception" element={<Navigate to="/staff/check-in" replace />} />'), 'staff reception must redirect to check-in')
    assert.ok(!appContent.includes('//') && !appContent.includes('/*'), 'App.jsx must be clean without comments')
})

test('P1 guest booking, unified sidebar and 30-day doctor history stay wired and comment-free', async () => {
    const bookingSvcSrc = await readFile(new URL('../src/services/user/BookingService.js', import.meta.url), 'utf8')
    const patientStepSrc = await readFile(new URL('../src/components/user/booking/PatientInfoStep.jsx', import.meta.url), 'utf8')
    const sidebarSrc = await readFile(new URL('../src/layouts/staff/StaffSidebar.jsx', import.meta.url), 'utf8')
    const doctorDashSrc = await readFile(new URL('../src/pages/doctor/DoctorDashboardPage.jsx', import.meta.url), 'utf8')

    assert.ok(bookingSvcSrc.includes('/api/v1/appointments/guest'), 'BookingService must post guest bookings to /api/v1/appointments/guest')
    assert.ok(patientStepSrc.includes('name="guestFullName"') && patientStepSrc.includes('name="guestPhone"'), 'PatientInfoStep must render guest name and phone inputs')
    assert.ok(!sidebarSrc.includes('/staff/specialty-exam'), 'StaffSidebar must not show duplicate specialty-exam menu item')
    assert.ok(doctorDashSrc.includes('clinicalService.getCompletedEncounters'), 'DoctorDashboardPage must load multi-day completed encounters from backend')

    for (const [name, src] of [
        ['BookingService.js', bookingSvcSrc],
        ['PatientInfoStep.jsx', patientStepSrc],
        ['StaffSidebar.jsx', sidebarSrc],
        ['DoctorDashboardPage.jsx', doctorDashSrc],
    ]) {
        assert.ok(!src.includes('//') && !src.includes('/*'), `${name} must be clean without comments`)
    }
})

test('P2 real prescription gateway, master patient/appointment unification and patient portal nav stay clean', async () => {
    const appContent = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
    const stepRxSrc = await readFile(new URL('../src/components/doctor/exam/StepPrescription.jsx', import.meta.url), 'utf8')
    const complianceSrc = await readFile(new URL('../src/pages/admin/ComplianceAndAuditPage.jsx', import.meta.url), 'utf8')
    const settingSrc = await readFile(new URL('../src/pages/admin/SettingClinicPage.jsx', import.meta.url), 'utf8')
    const patientsSrc = await readFile(new URL('../src/pages/reception/PatientsPage.jsx', import.meta.url), 'utf8')
    const patientLayoutSrc = await readFile(new URL('../src/layouts/PatientPortalLayout.jsx', import.meta.url), 'utf8')
    const adminSvcSrc = await readFile(new URL('../src/services/admin/AdminService.js', import.meta.url), 'utf8')

    assert.ok(appContent.includes('<Route path="benh-nhan" element={<PatientsPage />} />'), 'admin benh-nhan must route to unified PatientsPage')
    assert.ok(appContent.includes('<Route path="lich-hen" element={<AppointmentsPage />} />'), 'admin lich-hen must route to unified AppointmentsPage')
    assert.ok(appContent.includes('<Route path="patients" element={<PatientsPage />} />'), 'staff patients must route to unified PatientsPage')
    assert.ok(appContent.includes('<Route path="lich-su-kham" element={<Navigate to="/benh-nhan/benh-an" replace />} />'), 'lich-su-kham must redirect to unified benh-an')

    assert.ok(patientLayoutSrc.includes("to: '/benh-nhan/hoa-don'"), 'PatientPortalLayout must link to /benh-nhan/hoa-don')
    assert.ok(patientLayoutSrc.includes("to: '/benh-nhan/ho-so'"), 'PatientPortalLayout must link to /benh-nhan/ho-so')

    assert.ok(stepRxSrc.includes('clinicalService.syncPrescriptionGateway'), 'StepPrescription must sync via real backend gateway')
    assert.ok(!stepRxSrc.includes('Math.random'), 'StepPrescription must not use Math.random')

    assert.ok(complianceSrc.includes('adminService.getCompliancePrescriptions'), 'ComplianceAndAuditPage must load real prescriptions from backend')
    assert.ok(complianceSrc.includes('adminService.pingGatewayHealth'), 'ComplianceAndAuditPage must ping real gateway health')
    assert.ok(!complianceSrc.includes('Math.random') && !complianceSrc.includes('setTimeout'), 'ComplianceAndAuditPage must not use Math.random or fake setTimeout')

    assert.ok(settingSrc.includes('adminService.pingGatewayHealth') && !settingSrc.includes('setTimeout'), 'SettingClinicPage must ping real gateway without setTimeout')
    assert.ok(patientsSrc.includes('canMutatePatient'), 'PatientsPage must enforce role-based mutation controls')

    for (const [name, src] of [
        ['ComplianceAndAuditPage.jsx', complianceSrc],
        ['SettingClinicPage.jsx', settingSrc],
        ['PatientsPage.jsx', patientsSrc],
        ['PatientPortalLayout.jsx', patientLayoutSrc],
        ['AdminService.js', adminSvcSrc],
    ]) {
        assert.ok(!src.includes('//') && !src.includes('/*'), `${name} must be clean without comments`)
    }
})

test('P3 delta workspace sync, 30s polling, lazy route splitting and dead legacy page removal stay enforced', async () => {
    const clinicalSrc = await readFile(new URL('../src/services/doctor/ClinicalService.js', import.meta.url), 'utf8')
    const deltaSyncSrc = await readFile(new URL('../src/utils/helpers/clinicalDeltaSync.js', import.meta.url), 'utf8')
    const adminTemplateSrc = await readFile(new URL('../src/layouts/AdminTemplate.jsx', import.meta.url), 'utf8')
    const dashboardSrc = await readFile(new URL('../src/pages/admin/DashboardAdminPage.jsx', import.meta.url), 'utf8')
    const appSrc = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
    const loadingSrc = await readFile(new URL('../src/components/loading/Loading.jsx', import.meta.url), 'utf8')
    const exportSrc = await readFile(new URL('../src/utils/helpers/exportUtils.js', import.meta.url), 'utf8')
    const viteSrc = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8')

    assert.ok(!clinicalSrc.includes('this.persistToPostgres()'), 'ClinicalService must never call persistToPostgres() without explicit delta')
    assert.ok(clinicalSrc.includes('await this.persistToPostgres({ encounters: { [encounterId]: patch } })'), 'saveEncounterDraft must send single-encounter delta')
    assert.ok(clinicalSrc.includes('saveLocalWorkspaceCache'), 'ClinicalService must use saveLocalWorkspaceCache for dedicated REST mutations')
    assert.ok(adminTemplateSrc.includes('setInterval(syncClinicData, 30000)'), 'AdminTemplate fallback polling must be 30000ms')
    assert.ok(!adminTemplateSrc.includes('setInterval(syncClinicData, 3000)'), 'AdminTemplate must not poll every 3000ms')
    assert.ok(dashboardSrc.includes('setInterval(refreshStats, 30000)'), 'DashboardAdminPage fallback polling must be 30000ms')
    assert.ok(!dashboardSrc.includes('setInterval(refreshStats, 5000)'), 'DashboardAdminPage must not poll every 5000ms')

    assert.ok(appSrc.includes('<Suspense fallback={<Loading forceVisible />}>'), 'App.jsx must wrap Routes in Suspense with Loading forceVisible')
    assert.ok(appSrc.includes("lazy(() => import('./pages/doctor/ExamWorkstationPage'))"), 'App.jsx must lazy-load ExamWorkstationPage')
    assert.ok(loadingSrc.includes('forceVisible = false'), 'Loading.jsx must support forceVisible prop')
    assert.ok(exportSrc.includes("await import('exceljs')"), 'exportUtils.js must dynamically import exceljs')
    assert.ok(viteSrc.includes('codeSplitting'), 'vite.config.js must configure vendor codeSplitting')

    const removedLegacyPages = [
        '../src/pages/admin/ReceptionRegistrationPage.jsx',
        '../src/pages/admin/SpecialtyExamPage.jsx',
        '../src/pages/admin/ClinicalExamPage.jsx',
        '../src/pages/admin/AppointmentManagementPage.jsx',
        '../src/pages/user/patient/MedicalHistoryPage.jsx',
    ]
    for (const relPath of removedLegacyPages) {
        await assert.rejects(
            access(new URL(relPath, import.meta.url), constants.F_OK),
            `${relPath} must remain deleted`
        )
    }

    for (const [name, src] of [
        ['ClinicalService.js', clinicalSrc],
        ['clinicalDeltaSync.js', deltaSyncSrc],
        ['AdminTemplate.jsx', adminTemplateSrc],
        ['App.jsx', appSrc],
        ['Loading.jsx', loadingSrc],
        ['exportUtils.js', exportSrc],
        ['vite.config.js', viteSrc],
    ]) {
        assert.ok(!src.includes('//') && !src.includes('/*'), `${name} must be clean without comments`)
    }
})
