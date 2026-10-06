/**
 * calendarUtils.js - Thuật toán dựng lưới lịch chuẩn OpenMRS 3.x O3 & FHIR Appointment
 * Tuân thủ: Sunday-first, timezone-aware (Asia/Ho_Chi_Minh), O(1) appointment lookup
 */

/**
 * Lấy chuỗi YYYY-MM-DD cho ngày hiện tại theo múi giờ phòng khám
 * @param {string} timezone Múi giờ, mặc định 'Asia/Ho_Chi_Minh'
 * @returns {string} ví dụ '2026-10-06'
 */
export function getClinicTodayKey(timezone = 'Asia/Ho_Chi_Minh') {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch (e) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Chuyển đổi timestamp ISO / Date sang YYYY-MM-DD theo múi giờ phòng khám
 * @param {string|Date} dateVal 
 * @param {string} timezone 
 * @returns {string} 'YYYY-MM-DD'
 */
export function toClinicDateKey(dateVal, timezone = 'Asia/Ho_Chi_Minh') {
  if (!dateVal) return '';
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  if (isNaN(d.getTime())) return '';
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch (e) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

/**
 * Thuật toán dựng lưới lịch tháng (Month Grid)
 * @param {number} year Năm (ví dụ 2026)
 * @param {number} monthIndex Tháng trong JS: 0 = Tháng 1, ..., 9 = Tháng 10, 11 = Tháng 12
 * @param {Object} options Tùy chọn cấu hình
 * @param {string} options.timezone Múi giờ phòng khám (mặc định 'Asia/Ho_Chi_Minh')
 * @param {boolean} options.fixed42Cells Cố định 42 ô (6 hàng x 7 cột) để layout không bị giật chiều cao
 * @returns {Array<Object>} Mảng các ô ngày (cells)
 */
export function buildMonthGrid(year, monthIndex, options = {}) {
  const {
    timezone = 'Asia/Ho_Chi_Minh',
    fixed42Cells = true,
  } = options;

  // 1. Ngày đầu tiên của tháng
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  // Sunday-first: 0 = Sun, 1 = Mon, ..., 6 = Sat
  const leadingDays = firstDayOfMonth.getDay();

  // 2. Số ngày trong tháng (ngày 0 của tháng kế tiếp = ngày cuối tháng hiện tại)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  // 3. Tính tổng số ô cần dựng
  const cellsNeeded = leadingDays + daysInMonth;
  const totalCells = fixed42Cells ? 42 : Math.ceil(cellsNeeded / 7) * 7;

  // 4. Ngày của ô đầu tiên trên lưới (có thể thuộc tháng trước)
  const firstCellDate = new Date(year, monthIndex, 1 - leadingDays);

  const todayKey = getClinicTodayKey(timezone);
  const cells = [];

  for (let index = 0; index < totalCells; index++) {
    const cellDate = new Date(
      firstCellDate.getFullYear(),
      firstCellDate.getMonth(),
      firstCellDate.getDate() + index
    );

    const cellYear = cellDate.getFullYear();
    const cellMonth = cellDate.getMonth();
    const dayNumber = cellDate.getDate();

    const dateKey = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    const isCurrentMonth = cellYear === year && cellMonth === monthIndex;
    const isToday = dateKey === todayKey;

    cells.push({
      dateKey,
      dayNumber,
      cellDate,
      isCurrentMonth,
      isToday,
      dayOfWeek: cellDate.getDay(), // 0 = Chủ Nhật, ..., 6 = Thứ Bảy
    });
  }

  return cells;
}

/**
 * Gom nhóm danh sách Appointment theo dateKey để tra cứu O(1) trong CalendarCell
 * @param {Array<Object>} appointments Danh sách lịch hẹn
 * @param {string} timezone Múi giờ
 * @returns {Object<string, Array<Object>>} Map { '2026-10-06': [apt1, apt2] }
 */
export function groupAppointmentsByDate(appointments = [], timezone = 'Asia/Ho_Chi_Minh') {
  if (!Array.isArray(appointments)) return {};

  return appointments.reduce((map, apt) => {
    if (!apt) return map;
    const dateKey = toClinicDateKey(apt.start_at || apt.ngay_kham || apt.ngay_lam_viec, timezone);
    if (!dateKey) return map;

    if (!map[dateKey]) {
      map[dateKey] = [];
    }
    map[dateKey].push(apt);
    return map;
  }, {});
}

/**
 * Gom nhóm danh sách Availability Slots theo dateKey
 * @param {Array<Object>} availability Mảng slot trống hoặc ca làm
 * @param {string} timezone 
 * @returns {Object<string, Array<Object>>}
 */
export function groupAvailabilityByDate(availability = [], timezone = 'Asia/Ho_Chi_Minh') {
  if (!Array.isArray(availability)) return {};

  return availability.reduce((map, item) => {
    if (!item) return map;
    const dateKey = toClinicDateKey(item.date || item.start_at || item.ngay_lam_viec, timezone);
    if (!dateKey) return map;

    if (!map[dateKey]) {
      map[dateKey] = [];
    }
    map[dateKey].push(item);
    return map;
  }, {});
}

/**
 * Tiêu đề tháng năm hiển thị trên Calendar Toolbar
 * @param {number} year 
 * @param {number} monthIndex 
 * @param {string} locale 'en-US' | 'vi-VN'
 * @returns {string} 'October 2026' hoặc 'Tháng 10 năm 2026'
 */
export function formatMonthHeader(year, monthIndex, locale = 'en-US') {
  const d = new Date(year, monthIndex, 1);
  if (locale === 'vi-VN') {
    return `Tháng ${monthIndex + 1}, ${year}`;
  }
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
