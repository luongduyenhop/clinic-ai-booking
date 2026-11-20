import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatUnifiedDoctorName, stripDoctorTitles } from '../src/utils/helpers/doctorNameHelper.js'
import { formatDoctorName } from '../src/utils/doctorHelper.js'
import { formatDoctorHeading, formatSpecialtyFeeRange } from '../src/utils/helpers/quickBookingHelpers.js'

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
