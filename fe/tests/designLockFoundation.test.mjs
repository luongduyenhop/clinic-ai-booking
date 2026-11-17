import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    CLINICAL_ANTD_THEME,
    PATIENT_ANTD_THEME,
    isClinicalWorkbenchPath,
} from '../src/theme/clinicTheme.js'

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
    '../src/components/user/home/HomeHero.jsx',
]

test('isClinicalWorkbenchPath classifies clinical routes and rejects lookalike public routes', () => {
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
    assert.equal(PATIENT_ANTD_THEME.components.Button.primaryShadow, 'none')
    assert.equal(CLINICAL_ANTD_THEME.components.Button.primaryShadow, 'none')
})

test('PR 1 files contain zero comments and zero banned Design Lock patterns', async () => {
    for (const relPath of MODIFIED_FILES) {
        const content = await readFile(new URL(relPath, import.meta.url), 'utf8')
        assert.ok(!content.includes('//'), `${relPath} must not contain // comments`)
        assert.ok(!content.includes('/*'), `${relPath} must not contain /* comments`)
        assert.ok(!content.includes('animate-pulse'), `${relPath} must not contain animate-pulse`)
        assert.ok(!content.includes('bg-gradient-'), `${relPath} must not contain gradient backgrounds`)
        assert.ok(!content.includes('✚') && !content.includes('🗓') && !content.includes('🔒'), `${relPath} must not contain emojis`)
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

test('index.css enforces Design Lock shadows, radii, tabular-nums and #0077AA CTA', async () => {
    const cssContent = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
    assert.ok(!cssContent.includes('rgba(0, 181, 241'), 'index.css must not have glowing cyan shadows')
    assert.ok(cssContent.includes('--color-clinic-cta: #0077AA'), 'index.css must define #0077AA CTA token')
    assert.ok(cssContent.includes('font-variant-numeric: tabular-nums'), 'index.css must support tabular-nums')
    assert.ok(cssContent.includes('[data-density="clinical"]'), 'index.css must define clinical density radius override')
})

test('HomeHero implements Option A quick booking with useMedicalCatalog and no decorative slop', async () => {
    const heroContent = await readFile(new URL('../src/components/user/home/HomeHero.jsx', import.meta.url), 'utf8')
    assert.ok(heroContent.includes('useMedicalCatalog'), 'HomeHero must load real catalog data via useMedicalCatalog')
    assert.ok(heroContent.includes('/dat-lich'), 'HomeHero must navigate to /dat-lich with selected query params')
    assert.ok(!heroContent.includes('Sparkle'), 'HomeHero must not render Sparkle pills')
    assert.ok(!heroContent.includes('rounded-[32px]'), 'HomeHero must not use rounded-[32px] decorative container')
    assert.ok(!heroContent.includes('Đặt lịch 24/7'), 'HomeHero must not render floating corner cards')
})
