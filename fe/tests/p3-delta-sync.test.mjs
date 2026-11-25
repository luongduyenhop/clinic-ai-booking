import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterSyncableEncounters, sanitizeDeltaEncounterPatch } from '../src/utils/helpers/clinicalDeltaSync.js'

test('filterSyncableEncounters keeps only targeted active encounter delta and excludes other doctors or locked encounters', () => {
    const fullEncounters = {
        '101': {
            id: '101',
            luot_kham_server_id: 101,
            is_locked: false,
            benh_su: 'Bệnh sử cũ A',
            don_thuoc: { id: 11, trang_thai: 'DRAFT' },
        },
        '102': {
            id: '102',
            luot_kham_server_id: 102,
            is_locked: false,
            benh_su: 'Bệnh sử của bác sĩ B',
        },
        '103': {
            id: '103',
            luot_kham_server_id: 103,
            is_locked: true,
            benh_su: 'Hồ sơ đã khóa',
        },
        'ticket-77': {
            id: 'ticket-77',
            is_locked: false,
        },
    }
    const queue = [
        { encounter_id: '101', trang_thai: 'dang_kham' },
        { encounter_id: '102', trang_thai: 'dang_kham' },
        { encounter_id: '103', trang_thai: 'da_kham' },
        { encounter_id: 'ticket-77', trang_thai: 'cho_kham' },
    ]

    const deltaFor101 = filterSyncableEncounters(
        { '101': { benh_su: 'Đau đầu 2 ngày', mach_lan_phut: 80 } },
        queue,
        fullEncounters
    )
    assert.deepEqual(deltaFor101, {
        '101': { benh_su: 'Đau đầu 2 ngày', mach_lan_phut: 80 },
    })

    const lockedDelta = filterSyncableEncounters(
        { '103': { benh_su: 'Cố sửa ca đã khóa' } },
        queue,
        fullEncounters
    )
    assert.deepEqual(lockedDelta, {})

    const unstartedTicketDelta = filterSyncableEncounters(
        { 'ticket-77': { benh_su: 'Chưa gọi vào khám' } },
        queue,
        fullEncounters
    )
    assert.deepEqual(unstartedTicketDelta, {})
})

test('sanitizeDeltaEncounterPatch strips prescription fields when prescription is already SIGNED or ACCEPTED', () => {
    const signedEncounter = {
        id: '205',
        luot_kham_server_id: 205,
        is_locked: false,
        don_thuoc: { id: 88, trang_thai: 'SIGNED' },
    }

    const sanitized = sanitizeDeltaEncounterPatch(
        {
            loi_dan_bac_si: 'Uống đủ 2 lít nước mỗi ngày',
            danh_sach_thuoc: [{ ten_thuoc: 'Thuốc bị chặn ghi đè' }],
            don_thuoc: { trang_thai: 'DRAFT' },
        },
        signedEncounter
    )
    assert.deepEqual(sanitized, {
        loi_dan_bac_si: 'Uống đủ 2 lít nước mỗi ngày',
    })

    const emptyAfterStrip = sanitizeDeltaEncounterPatch(
        {
            danh_sach_thuoc: [{ ten_thuoc: 'Chỉ gửi thuốc khi đã ACCEPTED' }],
        },
        {
            id: '206',
            luot_kham_server_id: 206,
            is_locked: false,
            don_thuoc: { id: 89, trang_thai: 'ACCEPTED' },
        }
    )
    assert.equal(emptyAfterStrip, null)
})
