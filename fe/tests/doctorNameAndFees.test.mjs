import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatUnifiedDoctorName, stripDoctorTitles } from '../src/utils/helpers/doctorNameHelper.js'
import { formatDoctorName } from '../src/utils/doctorHelper.js'
import { formatDoctorHeading, formatSpecialtyFeeRange } from '../src/utils/helpers/quickBookingHelpers.js'
import { toFriendlyErrorMessage } from '../src/utils/helpers/clientErrorHelper.js'

test('formatUnifiedDoctorName prevents duplicate degree prefixes and [DEMO] noise', () => {
    assert.equal(formatUnifiedDoctorName('BS. Vũ Anh Dũng', 'BS.CKI'), 'BS.CKI Vũ Anh Dũng')
    assert.equal(formatUnifiedDoctorName('BS.CKI BS. Vũ Anh Dũng', 'BS.CKI'), 'BS.CKI Vũ Anh Dũng')
    assert.equal(formatUnifiedDoctorName('Bác sĩ Nội tổng quát [DEMO]', 'BS'), 'Bác sĩ Nội tổng quát')
    assert.equal(formatUnifiedDoctorName('BS.CKII Nguyễn Minh Hoàng', 'BS'), 'BS.CKII Nguyễn Minh Hoàng')
    assert.equal(formatUnifiedDoctorName('Đặng Hải Phương', 'ThS. BS'), 'ThS. BS Đặng Hải Phương')
    assert.equal(formatUnifiedDoctorName('BS. BS.CKII Trần Quốc Huy'), 'BS.CKII Trần Quốc Huy')
    assert.equal(formatUnifiedDoctorName('PGS.TS Phạm Đức Minh', 'PGS.TS'), 'PGS.TS Phạm Đức Minh')
    assert.equal(formatDoctorName('Vũ Anh Dũng'), 'BS. Vũ Anh Dũng')
    assert.equal(formatDoctorName('BS. Vũ Anh Dũng', 'BS.CKI'), 'BS.CKI Vũ Anh Dũng')
    assert.equal(formatDoctorHeading({ name: 'BS.CKI BS. Vũ Anh Dũng', degree: 'BS.CKI' }), 'BS.CKI Vũ Anh Dũng')

    const parsed = stripDoctorTitles('BS.CKI BS. Vũ Anh Dũng [DEMO]')
    assert.equal(parsed.bareName, 'Vũ Anh Dũng')
})

test('formatSpecialtyFeeRange derives fee display from specialty doctors or fallback', () => {
    assert.equal(
        formatSpecialtyFeeRange([{ fee: 150000 }, { fee: 150000 }], 180000).replace(/\u00a0/g, ' '),
        '150.000đ'
    )
    assert.equal(
        formatSpecialtyFeeRange([{ fee: 150000 }, { fee: 200000 }], 180000).replace(/\u00a0/g, ' '),
        '150.000đ – 200.000đ'
    )
    assert.equal(
        formatSpecialtyFeeRange([], 180000).replace(/\u00a0/g, ' '),
        '180.000đ'
    )
    assert.equal(formatSpecialtyFeeRange([{ fee: 0 }], 0), 'Theo niêm yết')
})

test('toFriendlyErrorMessage hides technical Axios/network strings and keeps Vietnamese backend messages', () => {
    const fallback = 'Chưa tải được lịch khám. Bạn thử lại sau ít phút hoặc gọi 1900 6868.'
    assert.equal(toFriendlyErrorMessage(new Error('Network Error'), fallback), fallback)
    assert.equal(toFriendlyErrorMessage(new Error('Request failed with status code 500'), fallback), fallback)
    assert.equal(toFriendlyErrorMessage({ isAxiosError: true, message: 'timeout of 10000ms exceeded' }, fallback), fallback)
    assert.equal(
        toFriendlyErrorMessage({ response: { data: { message: 'Khung giờ này đã được đặt trước.' } }, message: 'Request failed with status code 409' }, fallback),
        'Khung giờ này đã được đặt trước.'
    )
    assert.equal(toFriendlyErrorMessage(new Error('Danh sách chuyên khoa không hợp lệ'), fallback), 'Danh sách chuyên khoa không hợp lệ')
})
