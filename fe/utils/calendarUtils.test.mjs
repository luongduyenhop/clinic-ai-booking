import assert from 'node:assert';
import {
  buildMonthGrid,
  groupAppointmentsByDate,
  formatMonthHeader,
  toClinicDateKey
} from './calendarUtils.js';

console.log('--- TEST 1: Tháng 10/2026 (Đối chiếu trực tiếp với ảnh OpenMRS của user) ---');
{
  const grid = buildMonthGrid(2026, 9, { fixed42Cells: true }); // Month 9 = October
  assert.strictEqual(grid.length, 42, 'Lưới cố định phải có đúng 42 ô');

  // Ngày đầu tiên của lưới phải là 27/09/2026 (Chủ nhật của tuần chứa ngày 1/10)
  assert.strictEqual(grid[0].dayNumber, 27);
  assert.strictEqual(grid[0].isCurrentMonth, false, 'Ngày 27 phải là của tháng trước');
  assert.strictEqual(grid[0].dateKey, '2026-09-27');

  // Ô thứ 4 (index = 4) phải là 01/10/2026 (Thứ năm)
  assert.strictEqual(grid[4].dayNumber, 1);
  assert.strictEqual(grid[4].isCurrentMonth, true);
  assert.strictEqual(grid[4].dateKey, '2026-10-01');

  // Ô thứ 8 (index = 8) là 05/10/2026 (Thứ hai)
  assert.strictEqual(grid[8].dayNumber, 5);
  assert.strictEqual(grid[8].dateKey, '2026-10-05');

  // Ô thứ 9 (index = 9) là 06/10/2026 (Thứ ba) - trong ảnh là hôm nay
  assert.strictEqual(grid[9].dayNumber, 6);
  assert.strictEqual(grid[9].dateKey, '2026-10-06');

  // Ngày cuối cùng của tháng 10 là 31/10 (Thứ bảy, index = 34)
  assert.strictEqual(grid[34].dayNumber, 31);
  assert.strictEqual(grid[34].isCurrentMonth, true);
  assert.strictEqual(grid[34].dateKey, '2026-10-31');

  // Các ô bù phía sau (index 35 -> 41) là của tháng 11: 1, 2, 3, 4, 5, 6, 7
  assert.strictEqual(grid[35].dayNumber, 1);
  assert.strictEqual(grid[35].isCurrentMonth, false, 'Ngày 1 tiếp theo phải là tháng 11');
  assert.strictEqual(grid[35].dateKey, '2026-11-01');

  console.log('✓ TEST 1 PASSED: Khớp chính xác ảnh OpenMRS (bù 4 ngày 27,28,29,30 tháng 9; kết thúc ngày 31)');
}

console.log('--- TEST 2: Tháng bắt đầu vào Chủ nhật (Sunday = 0, leadingDays = 0) ---');
{
  // Tháng 3/2026 (bắt đầu vào Chủ nhật 01/03/2026)
  const grid = buildMonthGrid(2026, 2);
  assert.strictEqual(grid[0].dayNumber, 1);
  assert.strictEqual(grid[0].isCurrentMonth, true);
  assert.strictEqual(grid[0].dateKey, '2026-03-01');
  console.log('✓ TEST 2 PASSED: Tháng bắt đầu Chủ nhật có leadingDays = 0, ô đầu tiên chính là ngày 1');
}

console.log('--- TEST 3: Tháng 2 năm nhuận (2024: 29 ngày) và năm thường (2025: 28 ngày) ---');
{
  const leapFeb = buildMonthGrid(2024, 1);
  const currentDaysLeap = leapFeb.filter(c => c.isCurrentMonth);
  assert.strictEqual(currentDaysLeap.length, 29, 'Tháng 2 năm nhuận phải có đúng 29 ngày');

  const regularFeb = buildMonthGrid(2025, 1);
  const currentDaysReg = regularFeb.filter(c => c.isCurrentMonth);
  assert.strictEqual(currentDaysReg.length, 28, 'Tháng 2 năm thường phải có đúng 28 ngày');
  console.log('✓ TEST 3 PASSED: Xử lý chính xác năm nhuận 29 ngày và năm thường 28 ngày');
}

console.log('--- TEST 4: Gom nhóm Appointment O(1) theo múi giờ Asia/Ho_Chi_Minh ---');
{
  const mockAppointments = [
    { id: 'APT-1', start_at: '2026-10-06T08:00:00+07:00', title: 'Khám tim mạch' },
    { id: 'APT-2', start_at: '2026-10-06T14:00:00+07:00', title: 'Khám nội soi' },
    { id: 'APT-3', start_at: '2026-10-05T09:30:00+07:00', title: 'Khám mắt' },
    // UTC test: 2026-10-05 17:30 UTC = 2026-10-06 00:30 UTC+7
    { id: 'APT-4', start_at: '2026-10-05T17:30:00Z', title: 'Khám đêm theo UTC+7' }
  ];

  const grouped = groupAppointmentsByDate(mockAppointments, 'Asia/Ho_Chi_Minh');

  assert.strictEqual(grouped['2026-10-05'].length, 1);
  assert.strictEqual(grouped['2026-10-06'].length, 3, 'APT-4 phải rơi vào ngày 06/10 do UTC+7');
  console.log('✓ TEST 4 PASSED: Timezone conversion chính xác sang Asia/Ho_Chi_Minh và gom O(1)');
}

console.log('--- TEST 5: Tiêu đề tháng năm ---');
{
  assert.strictEqual(formatMonthHeader(2026, 9, 'en-US'), 'October 2026');
  assert.strictEqual(formatMonthHeader(2026, 9, 'vi-VN'), 'Tháng 10, 2026');
  console.log('✓ TEST 5 PASSED: Tiêu đề tháng năm format chuẩn OpenMRS');
}

console.log('\n🎉 TẤT CẢ 5/5 TEST SUITE ĐÃ VƯỢT QUA 100%!');
