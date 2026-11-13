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

test('BookingPage unifies MedPro card layout, AI recommendation and slot retry', async () => {
    const content = await readFile(new URL('../src/pages/user/BookingPage.jsx', import.meta.url), 'utf8')
    assert.ok(content.includes('aiRecommendation'), 'BookingPage must preserve aiRecommendation state and payload')
    assert.ok(content.includes('Tải lại khung giờ'), 'BookingPage must provide slot reload button on error')
    assert.ok(content.includes('ShieldCheck'), 'BookingPage must display ShieldCheck security notice')
    assert.ok(content.includes('public-container'), 'BookingPage must retain public-container layout')
    assert.ok(!content.includes('//') && !content.includes('/*'), 'BookingPage must be clean without comments')
})

test('AdminHeader and ReceptionHeader preserve language toggle button', async () => {
    const adminContent = await readFile(new URL('../src/components/admin/AdminHeader.jsx', import.meta.url), 'utf8')
    const recContent = await readFile(new URL('../src/components/reception/ReceptionHeader.jsx', import.meta.url), 'utf8')
    assert.ok(adminContent.includes('toggleLanguage') && adminContent.includes('Globe'), 'AdminHeader must have language toggle')
    assert.ok(recContent.includes('toggleLanguage') && recContent.includes('Globe'), 'ReceptionHeader must have language toggle')
})

test('Reception pages preserve doctor absences rebalancing and emergency handover', async () => {
    const scheduleContent = await readFile(new URL('../src/pages/reception/ClinicSchedulePage.jsx', import.meta.url), 'utf8')
    const checkInContent = await readFile(new URL('../src/pages/reception/CheckInPage.jsx', import.meta.url), 'utf8')
    const queueContent = await readFile(new URL('../src/pages/reception/QueueManagementPage.jsx', import.meta.url), 'utf8')
    assert.ok(scheduleContent.includes('doctorAbsences.map'), 'ClinicSchedulePage must show doctorAbsences alert')
    assert.ok(scheduleContent.includes('/reception/tasks'), 'ClinicSchedulePage must link to reception tasks')
    assert.ok(checkInContent.includes('EmergencyHandoverModal'), 'CheckInPage must retain EmergencyHandoverModal')
    assert.ok(queueContent.includes('EmergencyHandoverModal'), 'QueueManagementPage must retain EmergencyHandoverModal')
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
