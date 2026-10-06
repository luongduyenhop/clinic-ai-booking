'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  User,
  Plus,
  AlertCircle,
  CheckCircle2,
  Stethoscope,
  MapPin,
  X
} from 'lucide-react';
import {
  buildMonthGrid,
  groupAppointmentsByDate,
  formatMonthHeader,
  getClinicTodayKey,
  toClinicDateKey
} from '../../utils/calendarUtils';

/**
 * AppointmentCalendar - Thành phần Lịch dùng chung chuẩn OpenMRS 3.x O3 & FHIR
 * 
 * @param {Object} props
 * @param {'doctor'|'patient'|'reception'|'admin'} props.role Vai trò người dùng
 * @param {'monthly'|'daily'} props.view Chế độ hiển thị ban đầu ('monthly' | 'daily')
 * @param {Date|string} props.currentDate Ngày hoặc tháng ban đầu
 * @param {Array<Object>} props.appointments Danh sách lịch hẹn đã đặt
 * @param {Array<Object>} props.availability Danh sách slot trống (dùng cho patient booking)
 * @param {boolean} props.loading Trạng thái tải dữ liệu
 * @param {string} props.timezone Múi giờ phòng khám (mặc định 'Asia/Ho_Chi_Minh')
 * @param {Function} props.onViewChange (newView) => void
 * @param {Function} props.onDateChange (newDate) => void
 * @param {Function} props.onDateSelect (dateKey, appointmentsOnDate) => void
 * @param {Function} props.onAppointmentSelect (appointment) => void
 * @param {Function} props.onSlotSelect (slot) => void
 * @param {Function} props.onCreateAppointment (dateKey) => void
 */
export default function AppointmentCalendar({
  role = 'doctor',
  view: controlledView,
  currentDate: controlledDate,
  appointments = [],
  availability = [],
  loading = false,
  timezone = 'Asia/Ho_Chi_Minh',
  onViewChange,
  onDateChange,
  onDateSelect,
  onAppointmentSelect,
  onSlotSelect,
  onCreateAppointment
}) {
  // Trạng thái view nội bộ nếu không controlled
  const [internalView, setInternalView] = useState('monthly');
  const activeView = controlledView || internalView;

  // Trạng thái ngày đang xem nội bộ
  const [internalDate, setInternalDate] = useState(() => new Date());
  const activeDate = controlledDate ? (typeof controlledDate === 'string' ? new Date(controlledDate) : controlledDate) : internalDate;

  // Ngày được chọn để xem chi tiết
  const todayKey = useMemo(() => getClinicTodayKey(timezone), [timezone]);
  const [selectedDateKey, setSelectedDateKey] = useState(() => todayKey);

  // Modal xem nhanh appointment khi nhấp vào chip
  const [quickViewApt, setQuickViewApt] = useState(null);

  // Năm và tháng đang duyệt
  const activeYear = activeDate.getFullYear();
  const activeMonthIndex = activeDate.getMonth();

  // Nhóm appointments theo dateKey O(1)
  const appointmentsByDate = useMemo(() => {
    return groupAppointmentsByDate(appointments, timezone);
  }, [appointments, timezone]);

  // Dựng lưới 42 ô chuẩn OpenMRS Sunday-first
  const monthGrid = useMemo(() => {
    return buildMonthGrid(activeYear, activeMonthIndex, {
      timezone,
      fixed42Cells: true
    });
  }, [activeYear, activeMonthIndex, timezone]);

  // Điều hướng tháng trước
  const handlePrev = () => {
    const prev = new Date(activeYear, activeMonthIndex - 1, 1);
    if (onDateChange) onDateChange(prev);
    else setInternalDate(prev);
  };

  // Điều hướng tháng sau
  const handleNext = () => {
    const next = new Date(activeYear, activeMonthIndex + 1, 1);
    if (onDateChange) onDateChange(next);
    else setInternalDate(next);
  };

  // Về hôm nay
  const handleToday = () => {
    const now = new Date();
    if (onDateChange) onDateChange(now);
    else setInternalDate(now);
    setSelectedDateKey(todayKey);
  };

  // Chuyển view Monthly / Daily
  const handleSwitchView = (newView) => {
    if (onViewChange) onViewChange(newView);
    else setInternalView(newView);
  };

  // Nhấp vào một ô ngày trên lưới tháng
  const handleCellClick = (cell) => {
    setSelectedDateKey(cell.dateKey);
    const apts = appointmentsByDate[cell.dateKey] || [];

    if (onDateSelect) {
      onDateSelect(cell.dateKey, apts);
    }

    // Hành vi tự nhiên: Với Bác sĩ hoặc Lễ tân, click ngày có thể chuyển sang Daily view để tác nghiệp
    if (role === 'doctor' || role === 'reception') {
      handleSwitchView('daily');
    }
  };

  // Nhấp vào một thẻ lịch hẹn
  const handleAptClick = (e, apt) => {
    e.stopPropagation();
    if (onAppointmentSelect) {
      onAppointmentSelect(apt);
    } else {
      setQuickViewApt(apt);
    }
  };

  // Lấy màu sắc huy hiệu theo trạng thái
  const getStatusColor = (status = '') => {
    const s = status.toLowerCase();
    if (s.includes('xac_nhan') || s.includes('confirmed')) return 'bg-emerald-500';
    if (s.includes('tiep_nhan') || s.includes('checked_in')) return 'bg-sky-500';
    if (s.includes('dang_kham') || s.includes('in_progress')) return 'bg-amber-500';
    if (s.includes('da_kham') || s.includes('completed')) return 'bg-slate-400';
    if (s.includes('huy') || s.includes('cancelled')) return 'bg-rose-500';
    return 'bg-[#1F6F5C]';
  };

  // Tiêu đề tháng
  const monthTitle = useMemo(() => {
    return formatMonthHeader(activeYear, activeMonthIndex, 'en-US');
  }, [activeYear, activeMonthIndex]);

  // Appointments của ngày đang chọn cho Daily View
  const selectedDayApts = useMemo(() => {
    return appointmentsByDate[selectedDateKey] || [];
  }, [appointmentsByDate, selectedDateKey]);

  return (
    <div className="bg-white border border-[#E4E1D8] rounded-xl shadow-sm overflow-hidden font-sans">
      {/* 1. CALENDAR TOOLBAR (Chuẩn OpenMRS 3.x) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 border-b border-[#E4E1D8] bg-[#FAFAF8] gap-3">
        {/* Điều hướng tháng & Tiêu đề */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center border border-[#D5D2C8] rounded-lg bg-white overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 hover:bg-slate-100 text-slate-700 transition"
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 hover:bg-slate-100 text-slate-700 transition border-l border-[#E4E1D8]"
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {monthTitle}
          </h2>

          <button
            type="button"
            onClick={handleToday}
            className="text-xs px-2.5 py-1 font-semibold text-[#1F6F5C] bg-[#E8F2EF] hover:bg-[#D5E8E2] rounded-md transition"
          >
            Hôm nay
          </button>
        </div>

        {/* View Switcher: Monthly / Daily & Create Action */}
        <div className="flex items-center space-x-2">
          {loading && (
            <span className="text-xs text-slate-500 animate-pulse flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-[#1F6F5C] animate-ping"></span>
              <span>Đang tải...</span>
            </span>
          )}

          <div className="inline-flex rounded-lg border border-[#D5D2C8] bg-white p-0.5 text-xs font-semibold shadow-xs">
            <button
              type="button"
              onClick={() => handleSwitchView('monthly')}
              className={`px-3 py-1.5 rounded-md transition ${
                activeView === 'monthly'
                  ? 'bg-[#1F6F5C] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => handleSwitchView('daily')}
              className={`px-3 py-1.5 rounded-md transition ${
                activeView === 'daily'
                  ? 'bg-[#1F6F5C] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Daily
            </button>
          </div>

          {onCreateAppointment && (
            <button
              type="button"
              onClick={() => onCreateAppointment(selectedDateKey)}
              className="px-3 py-1.5 text-xs font-semibold bg-[#1F6F5C] hover:bg-[#185949] text-white rounded-lg transition flex items-center space-x-1 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tạo lịch hẹn</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. CHẾ ĐỘ XEM THÁNG (MONTHLY GRID VIEW) */}
      {activeView === 'monthly' && (
        <div className="w-full">
          {/* Header 7 ngày trong tuần: Sunday-first */}
          <div className="grid grid-cols-7 border-b border-[#E4E1D8] bg-[#F7F5F0] text-center text-xs font-bold text-slate-700 py-2.5">
            <div>SUN</div>
            <div>MON</div>
            <div>TUE</div>
            <div>WED</div>
            <div>THU</div>
            <div>FRI</div>
            <div>SAT</div>
          </div>

          {/* Lưới 42 ô ngày (6 hàng x 7 cột) */}
          <div className="grid grid-cols-7 border-b border-[#E4E1D8] divide-y divide-[#E4E1D8]">
            {monthGrid.map((cell, index) => {
              const dayApts = appointmentsByDate[cell.dateKey] || [];
              const isSelected = cell.dateKey === selectedDateKey;

              return (
                <div
                  key={cell.dateKey + '-' + index}
                  onClick={() => handleCellClick(cell)}
                  className={`min-h-[105px] sm:min-h-[120px] p-1.5 sm:p-2 border-r border-[#E4E1D8] last:border-r-0 relative transition flex flex-col justify-between group cursor-pointer ${
                    cell.isCurrentMonth
                      ? 'bg-white hover:bg-slate-50/70'
                      : 'bg-[#FAF9F5] text-slate-400 hover:bg-[#F3F1EB]'
                  } ${
                    cell.isToday
                      ? 'ring-2 ring-inset ring-[#1F6F5C] bg-[#F4F9F7]/40'
                      : ''
                  } ${
                    isSelected && !cell.isToday
                      ? 'bg-amber-50/40 ring-1 ring-inset ring-amber-400'
                      : ''
                  }`}
                >
                  {/* Hàng trên: Số ngày & Huy hiệu số lượng lịch hẹn */}
                  <div className="flex items-center justify-between mb-1">
                    {/* Số ngày: Nếu là Hôm nay thì hiện vòng tròn Teal */}
                    {cell.isToday ? (
                      <span className="w-6 h-6 rounded-full bg-[#1F6F5C] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        {cell.dayNumber}
                      </span>
                    ) : (
                      <span
                        className={`text-xs font-semibold ${
                          cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-400'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                    )}

                    {/* Huy hiệu số lượng lịch (ví dụ: "1 appt" như ảnh OpenMRS) */}
                    {dayApts.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200">
                        {dayApts.length} {dayApts.length === 1 ? 'appt' : 'appts'}
                      </span>
                    )}
                  </div>

                  {/* Danh sách chip sự kiện lịch hẹn trong ngày */}
                  <div className="space-y-1 flex-1 overflow-hidden my-0.5">
                    {dayApts.slice(0, 2).map((apt, aptIdx) => {
                      const colorClass = getStatusColor(apt.status || apt.trang_thai);
                      const displayTitle =
                        apt.specialty_name ||
                        apt.dich_vu_ten ||
                        apt.patient_name ||
                        apt.ten_benh_nhan ||
                        apt.doctor_name ||
                        'Khám bệnh';

                      return (
                        <div
                          key={apt.id || aptIdx}
                          onClick={(e) => handleAptClick(e, apt)}
                          className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-[#F1F5F4] hover:bg-[#E2EBE8] text-slate-800 border border-[#D5E2DF] flex items-center space-x-1.5 truncate transition shadow-2xs"
                          title={`${displayTitle} (${apt.start_at ? apt.start_at.slice(11, 16) : '30p'})`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colorClass}`}></span>
                          <span className="truncate">{displayTitle}</span>
                        </div>
                      );
                    })}

                    {dayApts.length > 2 && (
                      <div className="text-[10px] font-bold text-slate-500 pl-1">
                        +{dayApts.length - 2} thêm...
                      </div>
                    )}
                  </div>

                  {/* Chân ô: Indicator cho booking/availability */}
                  {role === 'patient' && cell.isCurrentMonth && (
                    <div className="text-[9px] text-right font-medium text-emerald-700 opacity-0 group-hover:opacity-100 transition">
                      Đặt lịch →
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. CHẾ ĐỘ XEM NGÀY (DAILY VIEW) */}
      {activeView === 'daily' && (
        <div className="p-5 space-y-4">
          {/* Header chọn ngày trong Daily view */}
          <div className="flex items-center justify-between pb-3 border-b border-[#E4E1D8]">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="w-5 h-5 text-[#1F6F5C]" />
              <h3 className="text-base font-bold text-slate-900">
                Chi tiết Lịch hẹn ngày {selectedDateKey}
              </h3>
              {selectedDateKey === todayKey && (
                <span className="text-[10px] font-bold bg-[#1F6F5C] text-white px-2 py-0.5 rounded-full">
                  Hôm nay
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleSwitchView('monthly')}
              className="text-xs font-semibold text-[#1F6F5C] hover:underline"
            >
              ← Quay lại Lịch tháng
            </button>
          </div>

          {/* Danh sách lịch hẹn theo timeline trong ngày */}
          {selectedDayApts.length === 0 ? (
            <div className="text-center py-12 bg-[#FAF9F5] rounded-xl border border-dashed border-[#D5D2C8] space-y-2">
              <Clock className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                Không có lịch hẹn nào trong ngày {selectedDateKey}
              </p>
              <p className="text-xs text-slate-500">
                {role === 'patient'
                  ? 'Bạn có thể chọn một khung giờ khả dụng để đặt lịch khám mới.'
                  : 'Chưa có bệnh nhân nào đặt lịch khám hoặc đăng ký vào ngày này.'}
              </p>
              {onCreateAppointment && (
                <button
                  type="button"
                  onClick={() => onCreateAppointment(selectedDateKey)}
                  className="mt-2 px-3 py-1.5 text-xs font-semibold bg-[#1F6F5C] text-white rounded-lg shadow-xs hover:bg-[#185949] transition inline-flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tạo lịch khám mới</span>
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#E4E1D8] border border-[#E4E1D8] rounded-xl overflow-hidden bg-white">
              {selectedDayApts.map((apt, index) => {
                const startTime = apt.start_at ? apt.start_at.slice(11, 16) : '08:00';
                const endTime = apt.end_at ? apt.end_at.slice(11, 16) : '08:30';

                return (
                  <div
                    key={apt.id || index}
                    onClick={() => handleAptClick({ stopPropagation: () => {} }, apt)}
                    className="p-4 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-start space-x-3.5">
                      {/* Khung giờ */}
                      <div className="bg-[#E8F2EF] text-[#1F6F5C] px-3 py-2 rounded-lg font-mono text-xs font-bold text-center min-w-[90px]">
                        <div>{startTime}</div>
                        <div className="text-[10px] text-slate-500 font-normal">đến {endTime}</div>
                      </div>

                      {/* Thông tin bệnh nhân & bác sĩ */}
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900">
                            {apt.patient_name || apt.ten_benh_nhan || 'Bệnh nhân'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full text-white ${getStatusColor(apt.status || apt.trang_thai)}`}>
                            {apt.status || apt.trang_thai || 'Đã xác nhận'}
                          </span>
                          {apt.priority && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              {apt.priority}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="flex items-center space-x-1">
                            <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                            <span>{apt.doctor_name || apt.bac_si_ten || 'BS. Chuyên khoa'}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{apt.room_name || apt.phong_kham || 'Phòng khám tiêu chuẩn'}</span>
                          </span>
                        </div>

                        {apt.reason && (
                          <div className="text-xs text-slate-500 italic">
                            Lý do: &ldquo;{apt.reason}&rdquo;
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Nút hành động theo role */}
                    <div className="flex items-center space-x-2 self-end sm:self-center">
                      {role === 'doctor' && (
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs font-semibold bg-[#1F6F5C] hover:bg-[#185949] text-white rounded-lg transition shadow-xs"
                        >
                          Vào khám →
                        </button>
                      )}
                      {role === 'reception' && (
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition shadow-xs"
                        >
                          Check-in ngay
                        </button>
                      )}
                      {role === 'patient' && (
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs font-semibold border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg transition"
                        >
                          Hủy lịch hẹn
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. MODAL XEM CHI TIẾT LỊCH HẸN KHI CLICK TRỰC TIẾP */}
      {quickViewApt && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#E4E1D8] p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E1D8]">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="w-5 h-5 text-[#1F6F5C]" />
                <h4 className="font-bold text-slate-900 text-base">
                  Chi tiết Lịch hẹn {quickViewApt.id || ''}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setQuickViewApt(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Bệnh nhân:</span>
                <strong className="text-slate-900">{quickViewApt.patient_name || quickViewApt.ten_benh_nhan || 'N/A'}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Bác sĩ phụ trách:</span>
                <span className="font-semibold">{quickViewApt.doctor_name || quickViewApt.bac_si_ten || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Thời gian khám:</span>
                <span className="font-mono font-bold text-[#1F6F5C]">
                  {quickViewApt.start_at ? quickViewApt.start_at.slice(0, 16).replace('T', ' ') : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Trạng thái:</span>
                <span className={`px-2 py-0.5 rounded-full text-white text-[10px] font-bold ${getStatusColor(quickViewApt.status || quickViewApt.trang_thai)}`}>
                  {quickViewApt.status || quickViewApt.trang_thai || 'Đã xác nhận'}
                </span>
              </div>
              {quickViewApt.reason && (
                <div className="py-1">
                  <span className="text-slate-500 block mb-0.5">Lý do khám:</span>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 italic">
                    {quickViewApt.reason}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setQuickViewApt(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
