import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mapDoctorPerformanceItems } from '../src/utils/helpers/doctorPerformanceMapping.js'

test('maps backend doctor KPI fields and preserves zero values', () => {
    const mapped = mapDoctorPerformanceItems({
        items: [{
            bac_si_id: 12,
            ho_ten: 'Nguyễn Văn An',
            chuyen_khoa: 'Nội tổng quát',
            hoc_vi: 'BS.CKI',
            so_ca_tiep_nhan: 3,
            so_ca_kham_xong: 0,
            so_ca_no_show: 1,
            thoi_gian_kham_tb_phut: 15,
            doanh_thu_mang_lai: 0,
        }],
    })

    assert.deepEqual(mapped, [{
        id: 12,
        name: 'Nguyễn Văn An',
        specialty: 'Nội tổng quát',
        degree: 'BS.CKI',
        completedCases: 0,
        revenue: 0,
    }])
})

test('keeps a successful empty API list empty instead of signaling fallback', () => {
    assert.deepEqual(mapDoctorPerformanceItems({ items: [] }), [])
})

test('rejects an unexpected response shape instead of manufacturing dashboard values', () => {
    assert.equal(mapDoctorPerformanceItems({ danh_sach_hieu_suat: [{ ten_bac_si: 'Mock' }] }), null)
})
