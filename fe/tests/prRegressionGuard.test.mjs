import { readFile } from 'node:fs/promises'
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

test('Admin routes connect guide and QA management pages without dead redirects', async () => {
    const appContent = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
    assert.ok(appContent.includes("import GuideAndQaManagementPage from './pages/admin/GuideAndQaManagementPage'"), 'App.jsx must import GuideAndQaManagementPage')
    assert.ok(appContent.includes('<Route path="huong-dan" element={<GuideAndQaManagementPage />} />'), 'huong-dan must route to GuideAndQaManagementPage')
    assert.ok(appContent.includes('<Route path="hoi-dap" element={<GuideAndQaManagementPage />} />'), 'hoi-dap must route to GuideAndQaManagementPage')
    assert.ok(!appContent.includes('//') && !appContent.includes('/*'), 'App.jsx must be clean without comments')
})
