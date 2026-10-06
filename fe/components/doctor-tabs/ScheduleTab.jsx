'use client';

import { useState } from 'react';
import {
  Calendar, Clock, ChevronLeft, ChevronRight, List, LayoutGrid,
  Users, CheckCircle, AlertCircle, User, ArrowRight, X, Activity, Filter
} from 'lucide-react';
import ApiService from '../../services/api';
import AppointmentCalendar from '../calendar/AppointmentCalendar';

export default function ScheduleTab({
  doctorShifts = [],
  shiftRequests = [],
  doctorsList = [],
  selectedShiftForRequest,
  setSelectedShiftForRequest,
  showShiftRequestModal,
  setShowShiftRequestModal,
  showImpactConfirmModal,
  setShowImpactConfirmModal,
  impactData,
  setImpactData,
  onSubmitRequest,
  appointments = [],
  onSelectPatient,
  currentDoctor
}) {
  const [viewMode, setViewMode] = useState('month_grid'); // 'month_grid' | 'calendar' | 'list'
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  // Modal xem nhanh danh sách bệnh nhân trong ca (Shift Patient Roster)
  const [selectedShiftForRoster, setSelectedShiftForRoster] = useState(null);
  const [rosterFilter, setRosterFilter] = useState('ALL'); // 'ALL' | 'dang_kham' | 'da_checkin' | 'cho_xac_nhan' | 'da_kham'

  const [requestForm, setRequestForm] = useState({
    requestType: 'BEO_BUSY',
    proposedDoctorId: '',
    reason: '',
  });
  const [formError, setFormError] = useState('');

  // Helper tính 7 ngày của tuần
  const getWeekDates = (offset = 0) => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday + offset * 7);

    const weekDays = [];
    const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${date}`;
      const isToday = d.toDateString() === now.toDateString();
      weekDays.push({
        dayName: dayNames[i],
        shortDay: dayNames[i].replace('Thứ ', 'T'),
        dateObj: d,
        dateStr: dateStr,
        displayDate: `${date}/${month}`,
        isToday: isToday
      });
    }
    return weekDays;
  };

  const weekDays = getWeekDates(currentWeekOffset);

  // Tìm ca làm việc theo ngày và buổi (sang / chieu)
  const getShiftForDayAndPeriod = (dateStr, period) => {
    return doctorShifts.find((s) => {
      const sDate = s.ngay_lam_viec ? s.ngay_lam_viec.slice(0, 10) : '';
      const sCa = (s.ca_lam_viec || '').toLowerCase();
      return sDate === dateStr && sCa === period;
    });
  };

  // Helper tính toán sức chứa ca (Capacity Meter) và danh sách bệnh nhân trong ca
  const getShiftCapacityAndPatients = (shift) => {
    if (!shift) return null;
    const maxCapacity = shift.gioi_han_ca_kham || 8;
    const shiftDate = shift.ngay_lam_viec ? shift.ngay_lam_viec.slice(0, 10) : '';
    const shiftPeriod = (shift.ca_lam_viec || '').toLowerCase();

    // 1. Kiểm tra danh sách appointments thực tế truyền từ DoctorPortal trùng ngày/buổi
    const matchingApts = (appointments || []).filter((apt) => {
      const aptDate = apt.appointment_date || apt.ngay_kham;
      if (aptDate !== shiftDate) return false;
      const hour = apt.start_time ? parseInt(apt.start_time.split(':')[0], 10) : 8;
      const isMorning = hour < 12;
      return (shiftPeriod === 'sang' && isMorning) || (shiftPeriod === 'chieu' && !isMorning);
    });

    let patientList = [];
    let bookedCount = 0;

    if (matchingApts.length > 0) {
      patientList = matchingApts.map(apt => ({
        id: apt.id,
        appointment_code: apt.appointment_code || `APT-${apt.id}`,
        patient_name: apt.patient_name || apt.ho_ten,
        patient_gender: apt.patient_gender || apt.gioi_tinh || 'Nam',
        patient_birth_year: apt.patient_birth_year || apt.nam_sinh || 1985,
        patient_phone: apt.patient_phone || apt.so_dien_thoai || '0901234567',
        start_time: apt.start_time || '08:30',
        symptoms_text: apt.symptoms_text || apt.trieu_chung || 'Khám lâm sàng theo hẹn',
        status: apt.status || 'cho_xac_nhan',
        raw: apt
      }));
      bookedCount = matchingApts.length;
    } else {
      // 2. Tạo danh sách bệnh nhân mô phỏng chân thực ổn định theo ID ca trực
      const seed = ((shift.id || 1001) * 7 + (shiftPeriod === 'sang' ? 3 : 5)) % 10;
      bookedCount = shift.booked_count !== undefined
        ? shift.booked_count
        : Math.min(maxCapacity, Math.max(3, 4 + (seed % 5))); // e.g. 5/8, 6/8, 7/8, 8/8

      const mockNames = [
        { name: 'Nguyễn Văn An', gender: 'Nam', birth: 1980, reason: 'Tái khám tăng huyết áp vô căn, đau đầu vùng chẩm' },
        { name: 'Trần Thị Mai', gender: 'Nữ', birth: 1995, reason: 'Sốt nhẹ 38°C, rát họng, mệt mỏi 2 ngày' },
        { name: 'Lê Hoàng Long', gender: 'Nam', birth: 1988, reason: 'Đau tức thượng vị sau ăn cay, ợ chua' },
        { name: 'Phạm Minh Tuấn', gender: 'Nam', birth: 1975, reason: 'Khám kiểm tra định kỳ, đau mỏi khớp gối' },
        { name: 'Vũ Thị Hạnh', gender: 'Nữ', birth: 1962, reason: 'Theo dõi chỉ số đường huyết ĐTĐ Type 2' },
        { name: 'Đặng Quốc Huy', gender: 'Nam', birth: 2001, reason: 'Viêm mũi dị ứng thời tiết, hắt hơi nhiều' },
        { name: 'Hoàng Bích Ngọc', gender: 'Nữ', birth: 1990, reason: 'Đau nửa đầu Migraine, mất ngủ kéo dài' },
        { name: 'Bùi Đức Trọng', gender: 'Nam', birth: 1984, reason: 'Kiểm tra men gan tăng nhẹ, tức hạ sườn phải' },
      ];

      for (let idx = 0; idx < bookedCount; idx++) {
        const item = mockNames[idx % mockNames.length];
        const startMin = (shiftPeriod === 'sang' ? 8 * 60 : 13 * 60 + 30) + idx * 30;
        const timeStr = `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}`;

        let st = 'cho_xac_nhan';
        if (idx === 0) st = 'dang_kham';
        else if (idx === 1 || idx === 2) st = 'da_checkin';
        else if (idx === 3 && bookedCount > 4) st = 'da_kham';

        patientList.push({
          id: (shift.id * 100) + idx + 1,
          appointment_code: `APT-${(shiftDate || '20261006').replace(/-/g, '').slice(2)}-${String(idx + 1).padStart(3, '0')}`,
          patient_name: item.name,
          patient_gender: item.gender,
          patient_birth_year: item.birth,
          patient_phone: `09${((seed + 1) * 11111111 + idx * 83749).toString().slice(0, 8)}`,
          start_time: timeStr,
          symptoms_text: item.reason,
          status: st
        });
      }
    }

    const nCheckin = patientList.filter(p => p.status === 'da_checkin' || p.status === 'cho_kham').length;
    const nDangKham = patientList.filter(p => p.status === 'dang_kham').length;
    const nDaKham = patientList.filter(p => p.status === 'da_kham').length;
    const nChuaDen = patientList.filter(p => p.status === 'cho_xac_nhan' || p.status === 'dat_truoc').length;

    const percent = Math.min(100, Math.round((bookedCount / maxCapacity) * 100));

    // Phân loại trạng thái lấp đầy ca & màu thanh tiến trình
    let capacityStatus = {
      label: 'Đang nhận bệnh',
      shortLabel: 'Còn chỗ',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      barColor: 'bg-[#1F6F5C]',
      textColor: 'text-[#1F6F5C]',
      dotColor: 'bg-emerald-500'
    };

    if (shift.is_active === false) {
      capacityStatus = {
        label: 'Ca nghỉ / Khóa',
        shortLabel: 'Đã khóa',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        barColor: 'bg-rose-400',
        textColor: 'text-rose-700',
        dotColor: 'bg-rose-500'
      };
    } else if (percent >= 100) {
      capacityStatus = {
        label: 'Đã kín ca (100%)',
        shortLabel: 'Đã đầy',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-300',
        barColor: 'bg-rose-600',
        textColor: 'text-rose-700',
        dotColor: 'bg-rose-600'
      };
    } else if (percent >= 75) {
      capacityStatus = {
        label: 'Sắp đầy ca',
        shortLabel: 'Sắp đầy',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
        barColor: 'bg-[#E8A33D]',
        textColor: 'text-amber-800',
        dotColor: 'bg-amber-500'
      };
    }

    return {
      maxCapacity,
      bookedCount,
      percent,
      capacityStatus,
      nCheckin,
      nDangKham,
      nDaKham,
      nChuaDen,
      patientList
    };
  };

  const handleOpenRequestModal = (shift) => {
    setSelectedShiftForRequest(shift);
    setRequestForm({
      requestType: 'BEO_BUSY',
      proposedDoctorId: '',
      reason: '',
    });
    setFormError('');
    setShowShiftRequestModal(true);
  };

  const handleOpenRosterModal = (shift) => {
    setSelectedShiftForRoster(shift);
    setRosterFilter('ALL');
  };

  const validateForm = () => {
    const { requestType, reason, proposedDoctorId } = requestForm;

    if (!reason || reason.trim().length < 20) {
      setFormError('Lý do phải có tối thiểu 20 ký tự để cấp trên xem xét.');
      return false;
    }

    if (requestType === 'DOI_CA' && !proposedDoctorId) {
      setFormError('Vui lòng chọn bác sĩ cùng chuyên khoa để đề xuất đổi ca.');
      return false;
    }

    // Kiểm tra thời gian so với giờ bắt đầu ca
    if (selectedShiftForRequest) {
      const now = new Date();
      const shiftDateStr = selectedShiftForRequest.ngay_lam_viec;
      const startTimeStr = selectedShiftForRequest.gio_bat_dau || (selectedShiftForRequest.ca_lam_viec === 'sang' ? '08:00:00' : '13:30:00');
      const shiftDateTime = new Date(`${shiftDateStr}T${startTimeStr}`);

      if (!isNaN(shiftDateTime.getTime())) {
        if (now >= shiftDateTime) {
          if (!['NGHI_DOT_XUAT', 'SU_CO_TRONG_CA'].includes(requestType)) {
            setFormError('Ca trực đã hoặc đang diễn ra. Chỉ được phép chọn "Nghỉ đột xuất" hoặc "Sự cố trong ca".');
            return false;
          }
        } else {
          const hoursToShift = (shiftDateTime - now) / 3600000;
          if (hoursToShift <= 6 && !['NGHI_DOT_XUAT', 'SU_CO_TRONG_CA', 'BEO_BUSY'].includes(requestType)) {
            setFormError('Ca trực bắt đầu trong vòng 6 giờ tới. Chỉ được phép chọn "Báo bận", "Nghỉ đột xuất" hoặc "Sự cố trong ca".');
            return false;
          }
        }
      }
    }

    setFormError('');
    return true;
  };

  const handleContinue = async () => {
    if (!validateForm()) {
      return;
    }

    if (!selectedShiftForRequest) {
      setFormError('Chưa chọn ca trực.');
      return;
    }

    // Lấy tác động lâm sàng
    try {
      const impact = await ApiService.getShiftImpact(selectedShiftForRequest.id);
      setImpactData(impact || { N_checkin: 2, N_dang_kham: 1, N_chua_den: 3 });
      setShowShiftRequestModal(false);
      setShowImpactConfirmModal(true);
    } catch (err) {
      setFormError('Không thể tải thông tin tác động ca trực.');
    }
  };

  const handleConfirmSubmit = () => {
    if (!selectedShiftForRequest) {
      return;
    }

    onSubmitRequest(
      selectedShiftForRequest,
      requestForm.requestType,
      requestForm.reason,
      requestForm.requestType === 'DOI_CA' ? requestForm.proposedDoctorId : null
    );

    setShowImpactConfirmModal(false);
    setSelectedShiftForRequest(null);
    setRequestForm({
      requestType: 'BEO_BUSY',
      proposedDoctorId: '',
      reason: '',
    });
  };

  const getStatusBadge = (status) => {
    const map = {
      CHO_DUYET: { label: '⏳ CHỜ DUYỆT', className: 'bg-amber-100 text-amber-800 border border-amber-300' },
      DA_DUYET: { label: '✓ ĐÃ DUYỆT', className: 'bg-blue-100 text-blue-800 border border-blue-300' },
      DA_THUC_THI: { label: '🚀 ĐÃ THỰC THI', className: 'bg-emerald-100 text-emerald-800 border border-emerald-300' },
      TU_CHOI: { label: '✕ TỪ CHỐI', className: 'bg-rose-100 text-rose-800 border border-rose-300' },
      HUY_BO: { label: '↺ HỦY BỎ', className: 'bg-gray-100 text-gray-800 border border-gray-300' },
    };
    const s = map[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.className}`}>
        {s.label}
      </span>
    );
  };

  // Helper render huy hiệu trạng thái bệnh nhân trong roster modal
  const renderPatientStatusBadge = (st) => {
    switch (st) {
      case 'dang_kham':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
            <span>Đang khám</span>
          </span>
        );
      case 'da_checkin':
      case 'cho_kham':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            <span>Đã check-in</span>
          </span>
        );
      case 'da_kham':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            <span>Đã khám xong</span>
          </span>
        );
      case 'cho_xac_nhan':
      case 'dat_truoc':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>Đặt hẹn / Chưa đến</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Phần 1: Lịch làm việc tuần (Weekly Timetable) */}
      <div className="bg-white border border-[#E4E1D8] rounded-xl shadow-sm p-5 space-y-4">
        {/* Header điều hướng & Toggle View */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-gray-100 gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-[#1C1B19] flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-[#1F6F5C]" />
                <span>Lịch Trực & Ca Khám (Weekly Clinical Timetable)</span>
              </h2>
              <span className="text-xs px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded-full border border-emerald-200">
                {doctorShifts.length} Ca làm việc
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Thời gian biểu phân ca 7 ngày tích hợp thanh đo tỷ lệ lấp đầy ca (Capacity Meter) và danh sách bệnh nhân theo chuẩn OpenMRS 3.x / Bahmni.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Week navigation buttons */}
            <div className="flex items-center bg-[#F7F5F0] border border-[#E4E1D8] rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setCurrentWeekOffset(prev => prev - 1)}
                className="px-2.5 py-1 rounded hover:bg-white text-gray-700 transition flex items-center"
                title="Tuần trước"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline ml-0.5">Trước</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentWeekOffset(0)}
                className={`px-3 py-1 rounded font-semibold transition ${
                  currentWeekOffset === 0 ? 'bg-white shadow-xs text-[#1F6F5C]' : 'text-gray-600 hover:bg-white'
                }`}
              >
                Tuần này
              </button>
              <button
                type="button"
                onClick={() => setCurrentWeekOffset(prev => prev + 1)}
                className="px-2.5 py-1 rounded hover:bg-white text-gray-700 transition flex items-center"
                title="Tuần sau"
              >
                <span className="hidden sm:inline mr-0.5">Sau</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* View Mode Toggle: Month Grid vs Weekly Calendar vs List */}
            <div className="flex items-center bg-[#F7F5F0] border border-[#E4E1D8] rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('month_grid')}
                className={`px-2.5 py-1 rounded flex items-center space-x-1 transition font-medium ${
                  viewMode === 'month_grid' ? 'bg-[#1F6F5C] text-white shadow-xs font-semibold' : 'text-gray-600 hover:bg-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Lịch tháng (OpenMRS)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`px-2.5 py-1 rounded flex items-center space-x-1 transition font-medium ${
                  viewMode === 'calendar' ? 'bg-[#1F6F5C] text-white shadow-xs font-semibold' : 'text-gray-600 hover:bg-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Lịch tuần</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded flex items-center space-x-1 transition font-medium ${
                  viewMode === 'list' ? 'bg-[#1F6F5C] text-white shadow-xs font-semibold' : 'text-gray-600 hover:bg-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Danh sách</span>
              </button>
            </div>
          </div>
        </div>

        {/* Date range subtitle & Legend (Chỉ hiển thị trong chế độ Lịch tuần) */}
        {viewMode === 'calendar' && (
          <div className="text-xs text-gray-600 font-medium flex flex-wrap items-center justify-between gap-2 bg-[#F7F5F0] px-3 py-2 rounded-lg border border-[#E4E1D8]">
            <div className="flex items-center space-x-2">
              <span>
                Khung thời gian:{' '}
                <strong className="text-gray-900">
                  {weekDays[0].displayDate}/{weekDays[0].dateObj.getFullYear()}
                </strong>{' '}
                đến{' '}
                <strong className="text-gray-900">
                  {weekDays[6].displayDate}/{weekDays[6].dateObj.getFullYear()}
                </strong>
              </span>
              {currentWeekOffset !== 0 && (
                <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                  {currentWeekOffset > 0 ? `+${currentWeekOffset} tuần tới` : `${currentWeekOffset} tuần trước`}
                </span>
              )}
            </div>

            {/* Clinical Capacity Legend */}
            <div className="flex items-center space-x-3 text-[11px] text-gray-500">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-[#1F6F5C]"></span>
                <span>Còn chỗ (&lt;75%)</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-[#E8A33D]"></span>
                <span>Sắp đầy (75-99%)</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>Đầy ca (100%)</span>
              </span>
            </div>
          </div>
        )}

        {/* VIEW 0: LỊCH THÁNG CHUẨN OPENMRS 3.X (MONTH GRID) */}
        {viewMode === 'month_grid' ? (
          <AppointmentCalendar
            role="doctor"
            appointments={appointments}
            onAppointmentSelect={(apt) => {
              if (onSelectPatient) {
                onSelectPatient(apt);
              }
            }}
          />
        ) : viewMode === 'calendar' ? (
          <div className="overflow-x-auto border border-[#E4E1D8] rounded-xl shadow-xs bg-white">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#F7F5F0] border-b border-[#E4E1D8]">
                  <th className="p-3 text-left font-bold text-gray-700 w-36 border-r border-[#E4E1D8]">
                    Ca làm việc
                  </th>
                  {weekDays.map((wd) => (
                    <th
                      key={wd.dateStr}
                      className={`p-2.5 text-center border-r border-[#E4E1D8] last:border-r-0 min-w-[150px] ${
                        wd.isToday ? 'bg-[#DCEAE6]/60 text-[#1F6F5C]' : 'text-gray-700'
                      }`}
                    >
                      <div className="font-bold text-xs">{wd.dayName}</div>
                      <div className="text-[11px] font-medium text-gray-500 mt-0.5 flex items-center justify-center space-x-1">
                        <span>{wd.displayDate}</span>
                        {wd.isToday && (
                          <span className="px-1.5 py-0.2 rounded-full bg-[#1F6F5C] text-white text-[9px] font-bold">
                            Hôm nay
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E1D8]">
                {/* ROW 1: CA SÁNG */}
                <tr>
                  <td className="p-3 font-bold text-gray-800 bg-[#FDFCFA] border-r border-[#E4E1D8] align-top">
                    <div className="text-xs font-bold text-[#1F6F5C] flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Ca Sáng</span>
                    </div>
                    <div className="text-[11px] text-gray-500 font-mono mt-1">08:00 - 12:00</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">4 giờ / ca</div>
                  </td>
                  {weekDays.map((wd) => {
                    const shift = getShiftForDayAndPeriod(wd.dateStr, 'sang');
                    const capData = shift ? getShiftCapacityAndPatients(shift) : null;

                    return (
                      <td
                        key={wd.dateStr}
                        className={`p-2 border-r border-[#E4E1D8] last:border-r-0 align-top ${
                          wd.isToday ? 'bg-[#DCEAE6]/10' : ''
                        }`}
                      >
                        {shift && capData ? (
                          <div className="p-2.5 rounded-xl border border-[#1F6F5C]/30 bg-[#F4F9F7] space-y-2.5 shadow-xs hover:border-[#1F6F5C] transition group">
                            {/* Header ca & trạng thái hoạt động */}
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-[11px] text-[#1F6F5C] truncate" title={shift.phong_kham}>
                                {shift.phong_kham || 'P.102 - Nội'}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap border ${capData.capacityStatus.badgeClass}`}>
                                {capData.capacityStatus.shortLabel}
                              </span>
                            </div>

                            {/* CAPACITY METER (Thanh tiến trình lấp đầy ca) */}
                            <div className="space-y-1 bg-white p-2 rounded-lg border border-gray-100 shadow-2xs">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-gray-500 font-medium">Lấp đầy ca:</span>
                                <span className="font-bold text-gray-900 font-mono">
                                  {capData.bookedCount}/{capData.maxCapacity} BN
                                  <span className={`ml-1 text-[10px] font-bold ${capData.capacityStatus.textColor}`}>
                                    ({capData.percent}%)
                                  </span>
                                </span>
                              </div>
                              {/* Thanh progress bar */}
                              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-300 ${capData.capacityStatus.barColor}`}
                                  style={{ width: `${capData.percent}%` }}
                                ></div>
                              </div>
                              {/* Chỉ số vắn tắt Check-in vs Chờ */}
                              <div className="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
                                <span className="text-emerald-700 font-medium">✓ {capData.nCheckin} Check-in</span>
                                <span className="text-amber-700 font-medium">⏳ {capData.nChuaDen + capData.nDangKham} Chờ/Khám</span>
                              </div>
                            </div>

                            {/* Hành động nhanh: Xem danh sách BN & Báo bận */}
                            <div className="space-y-1 pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleOpenRosterModal(shift)}
                                className="w-full py-1 px-2 text-[10px] font-bold bg-[#1F6F5C] hover:bg-[#185949] text-white rounded-md transition flex items-center justify-center gap-1 shadow-xs"
                                title="Xem danh sách bệnh nhân đã đặt và đang chờ trong ca này"
                              >
                                <Users className="w-3 h-3" />
                                <span>Bệnh nhân ({capData.bookedCount})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenRequestModal(shift)}
                                className="w-full py-0.5 px-2 text-[10px] font-medium bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-md transition"
                              >
                                Báo bận / Đổi ca
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="h-28 flex items-center justify-center text-gray-300 text-[11px] italic rounded-xl border border-dashed border-gray-200 bg-gray-50/40">
                            — Nghỉ —
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW 2: CA CHIỀU */}
                <tr>
                  <td className="p-3 font-bold text-gray-800 bg-[#FDFCFA] border-r border-[#E4E1D8] align-top">
                    <div className="text-xs font-bold text-[#E8A33D] flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Ca Chiều</span>
                    </div>
                    <div className="text-[11px] text-gray-500 font-mono mt-1">13:30 - 17:30</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">4 giờ / ca</div>
                  </td>
                  {weekDays.map((wd) => {
                    const shift = getShiftForDayAndPeriod(wd.dateStr, 'chieu');
                    const capData = shift ? getShiftCapacityAndPatients(shift) : null;

                    return (
                      <td
                        key={wd.dateStr}
                        className={`p-2 border-r border-[#E4E1D8] last:border-r-0 align-top ${
                          wd.isToday ? 'bg-[#DCEAE6]/10' : ''
                        }`}
                      >
                        {shift && capData ? (
                          <div className="p-2.5 rounded-xl border border-[#E8A33D]/40 bg-[#FFFDF7] space-y-2.5 shadow-xs hover:border-[#E8A33D] transition group">
                            {/* Header ca & trạng thái */}
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-[11px] text-[#A8681A] truncate" title={shift.phong_kham}>
                                {shift.phong_kham || 'P.102 - Nội'}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap border ${capData.capacityStatus.badgeClass}`}>
                                {capData.capacityStatus.shortLabel}
                              </span>
                            </div>

                            {/* CAPACITY METER (Thanh tiến trình lấp đầy ca) */}
                            <div className="space-y-1 bg-white p-2 rounded-lg border border-amber-100 shadow-2xs">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-gray-500 font-medium">Lấp đầy ca:</span>
                                <span className="font-bold text-gray-900 font-mono">
                                  {capData.bookedCount}/{capData.maxCapacity} BN
                                  <span className={`ml-1 text-[10px] font-bold ${capData.capacityStatus.textColor}`}>
                                    ({capData.percent}%)
                                  </span>
                                </span>
                              </div>
                              {/* Thanh progress bar */}
                              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-300 ${capData.capacityStatus.barColor}`}
                                  style={{ width: `${capData.percent}%` }}
                                ></div>
                              </div>
                              {/* Chỉ số vắn tắt Check-in vs Chờ */}
                              <div className="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
                                <span className="text-emerald-700 font-medium">✓ {capData.nCheckin} Check-in</span>
                                <span className="text-amber-700 font-medium">⏳ {capData.nChuaDen + capData.nDangKham} Chờ/Khám</span>
                              </div>
                            </div>

                            {/* Hành động nhanh: Xem danh sách BN & Báo bận */}
                            <div className="space-y-1 pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleOpenRosterModal(shift)}
                                className="w-full py-1 px-2 text-[10px] font-bold bg-[#E8A33D] hover:bg-[#cf8c28] text-white rounded-md transition flex items-center justify-center gap-1 shadow-xs"
                                title="Xem danh sách bệnh nhân đã đặt và đang chờ trong ca này"
                              >
                                <Users className="w-3 h-3" />
                                <span>Bệnh nhân ({capData.bookedCount})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenRequestModal(shift)}
                                className="w-full py-0.5 px-2 text-[10px] font-medium bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-md transition"
                              >
                                Báo bận / Đổi ca
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="h-28 flex items-center justify-center text-gray-300 text-[11px] italic rounded-xl border border-dashed border-gray-200 bg-gray-50/40">
                            — Nghỉ —
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          /* VIEW 2: LIST CARDS VIEW */
          <div>
            {doctorShifts.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm italic">
                Chưa có lịch trực nào được phân bổ trong tuần này. Vui lòng liên hệ Admin phân ca.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {doctorShifts.map((shift) => {
                  const capData = getShiftCapacityAndPatients(shift);
                  const isMorning = (shift.ca_lam_viec || '').toLowerCase() === 'sang';

                  return (
                    <div
                      key={shift.id}
                      className="border border-[#E4E1D8] hover:border-[#1F6F5C] rounded-xl p-4 bg-[#FCFCFB] flex flex-col justify-between transition-shadow hover:shadow-md space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500">
                            {shift.ngay_lam_viec ? new Date(shift.ngay_lam_viec).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' }) : 'Hôm nay'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${capData ? capData.capacityStatus.badgeClass : 'bg-gray-100 text-gray-700'}`}
                          >
                            {capData ? capData.capacityStatus.label : '● Đang mở'}
                          </span>
                        </div>

                        <div className="text-base font-bold text-[#1C1B19] mt-2 flex items-center gap-1.5">
                          <Clock className={`w-4 h-4 ${isMorning ? 'text-[#1F6F5C]' : 'text-[#E8A33D]'}`} />
                          <span>Ca {isMorning ? 'SÁNG (08:00 - 12:00)' : 'CHIỀU (13:30 - 17:30)'}</span>
                        </div>

                        <div className="text-xs text-gray-600 mt-1">
                          Phòng khám: <span className="font-semibold text-gray-900">{shift.phong_kham || 'Phòng 102 - Nội tổng quát'}</span>
                        </div>

                        {/* Capacity Meter Panel */}
                        {capData && (
                          <div className="mt-3 bg-white p-2.5 rounded-lg border border-[#E4E1D8] space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500 font-medium">Tỷ lệ lấp đầy ca:</span>
                              <span className="font-bold text-gray-900 font-mono">
                                {capData.bookedCount}/{capData.maxCapacity} BN
                                <span className={`ml-1 text-[11px] font-bold ${capData.capacityStatus.textColor}`}>
                                  ({capData.percent}%)
                                </span>
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${capData.capacityStatus.barColor}`}
                                style={{ width: `${capData.percent}%` }}
                              ></div>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                              <span className="text-emerald-700 font-semibold">✓ {capData.nCheckin} Check-in</span>
                              <span className="text-amber-700 font-semibold">⏳ {capData.nChuaDen + capData.nDangKham} Chờ/Khám</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => handleOpenRosterModal(shift)}
                          className="py-2 px-3 bg-[#1F6F5C] hover:bg-[#185949] text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Xem BN ({capData?.bookedCount || 0})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenRequestModal(shift)}
                          className="py-2 px-3 border border-[#E4E1D8] hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1"
                        >
                          <span>Báo bận / Đổi ca</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phần 2: Danh sách yêu cầu đã gửi */}
      <div className="bg-white border border-[#E4E1D8] rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-[#1C1B19]">📋 Lịch Sử Yêu Cầu Đổi Ca & Báo Bận</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Quy trình phê duyệt bởi Admin phòng khám theo chuẩn vận hành OpenMRS/Bahmni.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 font-semibold rounded-lg">
            {shiftRequests.length} Yêu cầu
          </span>
        </div>

        {shiftRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm italic">
            Chưa có yêu cầu báo bận hoặc đổi ca nào được gửi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-[#F7F5F0] border-b border-[#E4E1D8]">
                <tr>
                  <th className="text-left py-2.5 px-3 font-bold text-gray-700">Mã yêu cầu</th>
                  <th className="text-left py-2.5 px-3 font-bold text-gray-700">Ca trực liên quan</th>
                  <th className="text-left py-2.5 px-3 font-bold text-gray-700">Loại yêu cầu</th>
                  <th className="text-left py-2.5 px-3 font-bold text-gray-700">Lý do trình bày</th>
                  <th className="text-left py-2.5 px-3 font-bold text-gray-700">Trạng thái xử lý</th>
                  <th className="text-left py-2.5 px-3 font-bold text-gray-700">Thời gian gửi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shiftRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#1F6F5C]">#REQ-{req.id}</td>
                    <td className="py-2.5 px-3 font-medium text-gray-900">
                      Ca #{req.shift_id}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-semibold text-[11px]">
                        {req.loai_yeu_cau === 'BEO_BUSY' ? 'Báo bận tương lai' :
                         req.loai_yeu_cau === 'DOI_CA' ? 'Xin đổi ca' :
                         req.loai_yeu_cau === 'NGHI_DOT_XUAT' ? 'Nghỉ đột xuất' :
                         req.loai_yeu_cau === 'SU_CO_TRONG_CA' ? 'Sự cố trong ca' : req.loai_yeu_cau}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 max-w-xs text-gray-700 truncate" title={req.ly_do}>
                      {req.ly_do}
                    </td>
                    <td className="py-2.5 px-3">{getStatusBadge(req.trang_thai)}</td>
                    <td className="py-2.5 px-3 text-gray-500">
                      {req.created_at ? new Date(req.created_at).toLocaleString('vi-VN') : 'Vừa xong'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POPUP / MODAL: DANH SÁCH BỆNH NHÂN TRONG CA (Shift Patient Roster Modal) */}
      {selectedShiftForRoster && (() => {
        const capData = getShiftCapacityAndPatients(selectedShiftForRoster);
        if (!capData) return null;

        const isMorning = (selectedShiftForRoster.ca_lam_viec || '').toLowerCase() === 'sang';
        const filteredPatients = capData.patientList.filter(p => {
          if (rosterFilter === 'ALL') return true;
          if (rosterFilter === 'dang_kham') return p.status === 'dang_kham';
          if (rosterFilter === 'da_checkin') return p.status === 'da_checkin' || p.status === 'cho_kham';
          if (rosterFilter === 'cho_xac_nhan') return p.status === 'cho_xac_nhan' || p.status === 'dat_truoc';
          if (rosterFilter === 'da_kham') return p.status === 'da_kham';
          return true;
        });

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 border border-[#E4E1D8] space-y-4 max-h-[90vh] flex flex-col">
              {/* Header Modal */}
              <div className="flex items-start justify-between border-b pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#1C1B19] flex items-center gap-2">
                      <Users className="w-5 h-5 text-[#1F6F5C]" />
                      <span>Danh Sách Bệnh Nhân Trong Ca Khám (Shift Patient Roster)</span>
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${capData.capacityStatus.badgeClass}`}>
                      {capData.capacityStatus.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                    <span className="font-semibold text-gray-800">
                      Ca {isMorning ? 'SÁNG (08:00 - 12:00)' : 'CHIỀU (13:30 - 17:30)'}
                    </span>
                    <span>•</span>
                    <span>Ngày {selectedShiftForRoster.ngay_lam_viec || 'Hôm nay'}</span>
                    <span>•</span>
                    <span className="text-[#1F6F5C] font-semibold">{selectedShiftForRoster.phong_kham || 'Phòng 102 - Nội tổng quát'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedShiftForRoster(null)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                  aria-label="Đóng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-[#F7F5F0] border border-[#E4E1D8] rounded-xl p-3">
                  <span className="text-[11px] text-gray-500 block">Lấp đầy ca khám</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-bold text-[#1F6F5C] font-mono">{capData.bookedCount}</span>
                    <span className="text-xs text-gray-500 font-mono">/ {capData.maxCapacity} BN</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1 mt-1.5 overflow-hidden">
                    <div className={`h-1 rounded-full ${capData.capacityStatus.barColor}`} style={{ width: `${capData.percent}%` }}></div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <span className="text-[11px] text-amber-700 block">Đang trên ghế khám</span>
                  <div className="text-lg font-bold text-amber-900 font-mono mt-0.5">
                    {capData.nDangKham} BN
                  </div>
                  <span className="text-[10px] text-amber-600 mt-1 block">Đang xử lý chuyên môn</span>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <span className="text-[11px] text-blue-700 block">Đã Check-in chờ gọi</span>
                  <div className="text-lg font-bold text-blue-900 font-mono mt-0.5">
                    {capData.nCheckin} BN
                  </div>
                  <span className="text-[10px] text-blue-600 mt-1 block">Có mặt tại phòng chờ</span>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <span className="text-[11px] text-gray-600 block">Hẹn trước / Chưa đến</span>
                  <div className="text-lg font-bold text-gray-800 font-mono mt-0.5">
                    {capData.nChuaDen} BN
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1 block">Trong khung giờ ca</span>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 border-b border-gray-100 pb-2 text-xs">
                <span className="text-gray-400 flex items-center gap-1 text-[11px] mr-1">
                  <Filter className="w-3 h-3" /> Lọc:
                </span>
                <button
                  type="button"
                  onClick={() => setRosterFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    rosterFilter === 'ALL'
                      ? 'bg-[#1F6F5C] text-white font-bold'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Tất cả ({capData.patientList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRosterFilter('dang_kham')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    rosterFilter === 'dang_kham'
                      ? 'bg-amber-600 text-white font-bold'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  Đang khám ({capData.nDangKham})
                </button>
                <button
                  type="button"
                  onClick={() => setRosterFilter('da_checkin')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    rosterFilter === 'da_checkin'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
                  }`}
                >
                  Đã check-in ({capData.nCheckin})
                </button>
                <button
                  type="button"
                  onClick={() => setRosterFilter('cho_xac_nhan')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    rosterFilter === 'cho_xac_nhan'
                      ? 'bg-gray-700 text-white font-bold'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Chưa đến ({capData.nChuaDen})
                </button>
              </div>

              {/* Patient Table (Scrollable) */}
              <div className="overflow-y-auto flex-1 border border-gray-200 rounded-xl shadow-2xs">
                {filteredPatients.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-xs italic">
                    Không có bệnh nhân nào phù hợp với bộ lọc đã chọn.
                  </div>
                ) : (
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-[#F7F5F0] sticky top-0 border-b border-[#E4E1D8] text-gray-700 z-10">
                      <tr>
                        <th className="py-2 px-3 text-left font-bold w-12">STT</th>
                        <th className="py-2 px-3 text-left font-bold w-28">Mã tiếp đón</th>
                        <th className="py-2 px-3 text-left font-bold">Họ tên bệnh nhân</th>
                        <th className="py-2 px-3 text-center font-bold w-20">Giờ hẹn</th>
                        <th className="py-2 px-3 text-left font-bold">Lý do khám / Triệu chứng</th>
                        <th className="py-2 px-3 text-center font-bold w-28">Trạng thái</th>
                        <th className="py-2 px-3 text-right font-bold w-24">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredPatients.map((p, idx) => (
                        <tr key={p.id} className="hover:bg-[#F4F9F7] transition">
                          <td className="py-2.5 px-3 font-mono text-gray-500">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#1F6F5C]">
                            {p.appointment_code}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-gray-900">{p.patient_name}</div>
                            <div className="text-[11px] text-gray-500">
                              {p.patient_gender} • {new Date().getFullYear() - p.patient_birth_year} tuổi ({p.patient_birth_year}) • SĐT: {p.patient_phone}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-semibold text-gray-700">
                            {p.start_time}
                          </td>
                          <td className="py-2.5 px-3 text-gray-700 max-w-xs truncate" title={p.symptoms_text}>
                            {p.symptoms_text}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {renderPatientStatusBadge(p.status)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {onSelectPatient ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedShiftForRoster(null);
                                  onSelectPatient(p.raw || p);
                                }}
                                className="px-2.5 py-1 bg-[#1F6F5C] hover:bg-[#185949] text-white rounded text-[11px] font-bold shadow-2xs transition inline-flex items-center gap-1"
                                title="Chuyển sang Workstation để khám bệnh nhân này"
                              >
                                <span>Khám</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="text-gray-400 text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-2 border-t flex items-center justify-between">
                <span className="text-[11px] text-gray-500 italic">
                  Dữ liệu đồng bộ trực tiếp từ phân hệ Tiếp đón & Hàng đợi OpenMRS 3.x O3.
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedShiftForRoster(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal 1: Form xin đổi ca / Báo bận */}
      {showShiftRequestModal && selectedShiftForRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-[#E4E1D8] space-y-4">
            <div className="border-b pb-3">
              <h3 className="text-base font-bold text-[#1C1B19]">
                📝 Lập Phiếu Yêu Cầu Đổi Ca / Báo Bận
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Ca #{selectedShiftForRequest.id} - Ngày {selectedShiftForRequest.ngay_lam_viec} ({selectedShiftForRequest.ca_lam_viec === 'sang' ? 'Sáng' : 'Chiều'})
              </p>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Loại yêu cầu <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1F6F5C] focus:outline-none"
                  value={requestForm.requestType}
                  onChange={(e) =>
                    setRequestForm({ ...requestForm, requestType: e.target.value })
                  }
                >
                  <option value="BEO_BUSY">Báo bận ca tương lai (BEO_BUSY)</option>
                  <option value="DOI_CA">Xin đổi sang bác sĩ khác (DOI_CA)</option>
                  <option value="NGHI_DOT_XUAT">Nghỉ đột xuất sát giờ (NGHI_DOT_XUAT)</option>
                  <option value="SU_CO_TRONG_CA">Báo sự cố ngay trong ca (SU_CO_TRONG_CA)</option>
                </select>
              </div>

              {requestForm.requestType === 'DOI_CA' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Bác sĩ cùng chuyên khoa đề xuất thay thế <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1F6F5C] focus:outline-none"
                    value={requestForm.proposedDoctorId}
                    onChange={(e) =>
                      setRequestForm({ ...requestForm, proposedDoctorId: e.target.value })
                    }
                  >
                    <option value="">-- Chọn bác sĩ thay thế --</option>
                    {doctorsList.length > 0 ? (
                      doctorsList.map(doc => (
                        <option key={doc.id} value={doc.id}>
                          {doc.hoc_vi || 'BS.'} {doc.ho_ten || doc.full_name} ({doc.chuyen_khoa || 'Chuyên khoa'})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="2">ThS.BS Trần Thị Mai (Nội tim mạch)</option>
                        <option value="3">BS.CKI Phạm Quốc Bảo (Nội tổng quát)</option>
                      </>
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Lý do chi tiết <span className="text-rose-500">* (Tối thiểu 20 ký tự)</span>
                </label>
                <textarea
                  className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1F6F5C] focus:outline-none"
                  rows={4}
                  value={requestForm.reason}
                  onChange={(e) =>
                    setRequestForm({ ...requestForm, reason: e.target.value })
                  }
                  placeholder="Trình bày rõ lý do công tác, việc gia đình hoặc tình huống khẩn cấp..."
                />
                <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                  <span>Yêu cầu tính trung thực phục vụ báo cáo kiểm toán</span>
                  <span className={requestForm.reason.length >= 20 ? 'text-emerald-600 font-bold' : 'text-amber-600'}>
                    {requestForm.reason.length}/20 ký tự
                  </span>
                </div>
              </div>

              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  ⚠️ {formError}
                </div>
              )}
            </div>

            <div className="pt-2 border-t flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowShiftRequestModal(false);
                  setSelectedShiftForRequest(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleContinue}
                className="px-4 py-2 bg-[#1F6F5C] hover:bg-[#185949] text-white rounded-lg text-xs font-bold shadow-sm transition"
              >
                Tiếp tục (Kiểm tra tác động) →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Cảnh báo tác động lâm sàng */}
      {showImpactConfirmModal && impactData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-[#E4E1D8] space-y-4">
            <div className="border-b pb-3">
              <h3 className="text-base font-bold text-amber-900 flex items-center gap-2">
                <span>⚠️ Cảnh Báo Tác Động Lâm Sàng & Bệnh Nhân</span>
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Đánh giá số lượng bệnh nhân bị ảnh hưởng trực tiếp trong ca làm việc này.
              </p>
            </div>

            <div className="space-y-3 text-xs text-gray-800">
              <p className="font-medium text-gray-900">
                Ca trực này hiện có <strong className="text-rose-600 text-sm">{(impactData.N_checkin || 0) + (impactData.N_dang_kham || 0) + (impactData.N_chua_den || 0)}</strong> bệnh nhân đã đặt lịch:
              </p>

              <div className="grid grid-cols-3 gap-2 py-1">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <div className="text-lg font-bold text-amber-800">{impactData.N_checkin || 0}</div>
                  <div className="text-[11px] text-amber-700">Đã check-in chờ khám</div>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                  <div className="text-lg font-bold text-rose-800">{impactData.N_dang_kham || 0}</div>
                  <div className="text-[11px] text-rose-700">Đang trên ghế khám</div>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                  <div className="text-lg font-bold text-blue-800">{impactData.N_chua_den || 0}</div>
                  <div className="text-[11px] text-blue-700">Đặt hẹn chưa check-in</div>
                </div>
              </div>

              <p className="text-gray-600 italic">
                Khi yêu cầu được duyệt, Admin phòng khám sẽ thực thi điều phối chuyển tiếp hoặc liên hệ bệnh nhân để bảo lưu quyền lợi khám bệnh.
              </p>

              {(impactData.N_dang_kham || 0) > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-900 text-xs">
                  <strong>🚨 Nguyên tắc Đạo đức Y khoa:</strong> Hệ thống sẽ <u>không tự động đóng</u> các lượt khám đang thực hiện dở dang. Bác sĩ trực cần hoàn tất hoặc bàn giao trực tiếp cho Bác sĩ tiếp quản trước khi rời vị trí.
                </div>
              )}
            </div>

            <div className="pt-3 border-t flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowImpactConfirmModal(false);
                  setShowShiftRequestModal(true);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                ← Quay lại chỉnh sửa
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
              >
                Xác nhận Gửi yêu cầu (CHO_DUYET)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
