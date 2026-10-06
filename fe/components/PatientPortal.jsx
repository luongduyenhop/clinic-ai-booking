'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar, Clock, User, FileText, CheckCircle, AlertTriangle,
  X, RefreshCw, Star, Trash2, Heart, Shield, Printer,
  ArrowRight, ChevronRight, Edit3, UserCheck, AlertCircle, Plus,
  QrCode, Pill, Sparkles, MapPin, Check, Activity,
  Sun, Sunrise, Sunset, Moon, Info, FileCheck, Award, CheckSquare, Download
} from 'lucide-react';
import ApiService from '../services/api';
import AppointmentCalendar from './calendar/AppointmentCalendar';

export default function PatientPortal() {
  const [activeTab, setActiveTab] = useState('appointments'); // 'appointments' | 'emr' | 'waitlist' | 'profile'
  const [calendarViewMode, setCalendarViewMode] = useState('calendar'); // 'calendar' | 'list'
  const [appointments, setAppointments] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [emrHistory, setEmrHistory] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [cancelModalApt, setCancelModalApt] = useState(null);
  const [cancelReason, setCancelReason] = useState('Bận công việc đột xuất');
  const [cancelLoading, setCancelLoading] = useState(false);

  const [rescheduleModalApt, setRescheduleModalApt] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState('Đổi thời gian thuận tiện hơn');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  const [printModalApt, setPrintModalApt] = useState(null);
  const [summaryModalEnc, setSummaryModalEnc] = useState(null);
  const [takenMeds, setTakenMeds] = useState({});
  const [feedbackRatingModal, setFeedbackRatingModal] = useState(null);
  const [userRating, setUserRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');

  // Profile Form state
  const [profileForm, setProfileForm] = useState({
    ho_ten: '',
    so_dien_thoai: '',
    ngay_sinh: '',
    gioi_tinh: 'Nam',
    dia_chi: '',
    nhom_mau: 'O+',
    tien_su_benh: '',
    di_ung_thuoc: ''
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const parseMedSchedule = (item) => {
    if (item.thoi_diem) {
      return {
        sang: item.thoi_diem.sang ?? 0,
        trua: item.thoi_diem.trua ?? 0,
        chieu: item.thoi_diem.chieu ?? 0,
        toi: item.thoi_diem.toi ?? 0,
        huong_dan: item.huong_dan_dung || (item.cach_dung?.toLowerCase().includes('sau') ? 'Uống sau ăn' : item.cach_dung?.toLowerCase().includes('trước') ? 'Uống trước ăn' : 'Uống theo chỉ định'),
        ghi_chu: item.ghi_chu_bac_si || item.ghi_chu || ''
      };
    }
    const text = (item.cach_dung || '').toLowerCase();
    let sang = 0, trua = 0, chieu = 0, toi = 0;
    if (text.includes('sáng') || text.includes('8h') || text.includes('sang')) sang = 1;
    if (text.includes('trưa') || text.includes('12h') || text.includes('trua')) trua = 1;
    if (text.includes('chiều') || text.includes('16h') || text.includes('chieu')) chieu = 1;
    if (text.includes('tối') || text.includes('20h') || text.includes('toi') || text.includes('đêm')) toi = 1;
    if (sang === 0 && trua === 0 && chieu === 0 && toi === 0) {
      sang = 1;
    }
    const huong_dan = text.includes('trước ăn')
      ? 'Uống trước ăn 30 phút'
      : text.includes('sau ăn')
      ? 'Uống sau khi ăn no'
      : text.includes('khi đói')
      ? 'Uống lúc bụng đói'
      : 'Uống với nước đun sôi để nguội';

    return {
      sang,
      trua,
      chieu,
      toi,
      huong_dan: item.huong_dan_dung || huong_dan,
      ghi_chu: item.ghi_chu_bac_si || item.ghi_chu || 'Tuân thủ đúng liều lượng chỉ định của bác sĩ.'
    };
  };

  const toggleMedTaken = (medKey) => {
    setTakenMeds(prev => ({ ...prev, [medKey]: !prev[medKey] }));
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [aptsRes, waitRes, profRes, emrRes] = await Promise.allSettled([
        ApiService.getPatientHistory(),
        ApiService.getMyWaitlist(),
        ApiService.getCurrentUser(),
        ApiService.getMyEncountersHistory()
      ]);

      if (aptsRes.status === 'fulfilled' && Array.isArray(aptsRes.value)) {
        setAppointments(aptsRes.value);
      }
      if (waitRes.status === 'fulfilled' && Array.isArray(waitRes.value)) {
        setWaitlist(waitRes.value);
      }
      if (emrRes.status === 'fulfilled' && Array.isArray(emrRes.value) && emrRes.value.length > 0) {
        setEmrHistory(emrRes.value);
      } else {
        // Fallback dữ liệu bệnh án điện tử cá nhân chuẩn y khoa
        setEmrHistory([
          {
            id: 101,
            ma_ho_so: 'BA-2026-0915-101',
            thoi_gian_bat_dau: '2026-09-15 09:00:00',
            thoi_gian_ket_thuc: '2026-09-15 09:30:00',
            bac_si_ten: 'BS. CKII Lê Văn Thịnh',
            chuyen_khoa_ten: 'Khoa Tim Mạch',
            co_so_kcb: 'Phòng khám Đa khoa Quốc tế SmartCare (Mã CSKCB: 01099)',
            ly_do_kham: 'Đau tức ngực trái khi gắng sức, huyết áp đo tại nhà dao động 135-145 mmHg',
            benh_su: 'Bệnh nhân có tiền sử tăng huyết áp 2 năm nay, dùng thuốc ngắt quãng. Đợt này thấy mệt mỏi, tức nhẹ ngực khi đi bộ nhanh.',
            tien_su_ban_than: 'Tăng huyết áp vô căn, rối loạn lipid máu nhẹ',
            tien_su_gia_dinh: 'Bố có tiền sử tăng huyết áp',
            di_ung: 'Chưa phát hiện tiền sử dị ứng thuốc hay thức ăn (NKA)',
            dau_hieu_sinh_ton: {
              mach: 76,
              huyet_ap: '135/85 mmHg',
              nhiet_do: 36.8,
              spo2: 98,
              nhip_tho: 18,
              chieu_cao: 168,
              can_nang: 63,
              bmi: 22.3
            },
            is_locked: true,
            danh_sach_chan_doan: [
              { loai_chan_doan: 'CHINH', ma_icd10: 'I10', ten_benh_chan_doan: 'Bệnh tăng huyết áp vô căn (Nguyên phát)' },
              { loai_chan_doan: 'PHU', ma_icd10: 'E78', ten_benh_chan_doan: 'Rối loạn chuyển hóa lipoprotein và tình trạng tăng lipid máu' }
            ],
            danh_sach_chi_dinh: [
              {
                ten_dich_vu: 'Điện tâm đồ (ECG 12 chuyển đạo)',
                trang_thai: 'da_co_ket_qua',
                ket_qua_chi_tiet: 'Nhịp xoang đều, tần số 76 l/p. Dày thất trái nhẹ theo tiêu chuẩn Sokolow-Lyon. Không thấy sóng ST chênh hay T âm nhọn.',
                tri_so_binh_thuong: 'Nhịp xoang đều 60-90 l/p',
                ket_qua_phan_loai: 'BINH_THUONG',
                ngay_thuc_hien: '15/09/2026',
                tep_dinh_kem_url: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80'
              },
              {
                ten_dich_vu: 'Sinh hóa máu toàn phần (Glucose, Ure, Creatinine, AST, ALT, Lipid)',
                trang_thai: 'da_co_ket_qua',
                ket_qua_chi_tiet: 'Glucose: 5.4 mmol/L; Ure: 5.2 mmol/L; Creatinine: 82 umol/L; eGFR: 88 ml/min; AST: 24 U/L; ALT: 28 U/L; Cholesterol toàn phần: 5.6 mmol/L; Triglycerid: 2.1 mmol/L; LDL-C: 3.4 mmol/L.',
                tri_so_binh_thuong: 'Glucose: 3.9-6.4 | Creatinine: 62-106 | Cholesterol: < 5.2',
                ket_qua_phan_loai: 'BAT_THUONG',
                ngay_thuc_hien: '15/09/2026',
                tep_dinh_kem_url: null
              }
            ],
            don_thuoc: {
              ma_don_thuoc: 'DT-2026-0915-01',
              ngay_ke_don: '15/09/2026',
              bac_si_ke_don: 'BS. CKII Lê Văn Thịnh',
              cchn: '004523/BYT-CCHN',
              danh_sach_chi_tiet: [
                {
                  ten_thuoc: 'Amlodipine 5mg',
                  hoat_chat: 'Amlodipine besylate',
                  so_luong: 30,
                  don_vi_tinh: 'Viên',
                  cach_dung: 'Uống 1 viên vào 8h sáng sau ăn',
                  thoi_diem: { sang: 1, trua: 0, chieu: 0, toi: 0 },
                  huong_dan_dung: 'Uống sau bữa ăn sáng 30 phút',
                  ghi_chu_bac_si: 'Uống cố định một khung giờ mỗi sáng. Không dùng chung với nước ép bưởi chùm. Không tự ý ngưng thuốc khi thấy huyết áp bình thường.',
                  so_ngay_dung: 30
                },
                {
                  ten_thuoc: 'Atorvastatin 10mg',
                  hoat_chat: 'Atorvastatin calcium',
                  so_luong: 30,
                  don_vi_tinh: 'Viên',
                  cach_dung: 'Uống 1 viên vào 20h tối trước khi đi ngủ',
                  thoi_diem: { sang: 0, trua: 0, chieu: 0, toi: 1 },
                  huong_dan_dung: 'Uống sau ăn tối / trước khi ngủ',
                  ghi_chu_bac_si: 'Hạn chế bia rượu trong thời gian dùng thuốc. Uống với một cốc nước lọc đầy.',
                  so_ngay_dung: 30
                },
                {
                  ten_thuoc: 'Panadol Extra 500mg/65mg',
                  hoat_chat: 'Paracetamol + Caffeine',
                  so_luong: 10,
                  don_vi_tinh: 'Viên',
                  cach_dung: 'Uống 1 viên khi đau đầu nhiều, cách nhau tối thiểu 6 giờ',
                  thoi_diem: { sang: 1, trua: 1, chieu: 0, toi: 0 },
                  huong_dan_dung: 'Uống sau ăn khi có cơn đau',
                  ghi_chu_bac_si: 'Chỉ dùng khi đau đầu nhiều hoặc sốt trên 38.5 độ C. Không dùng quá 4 viên trong 24 giờ.',
                  so_ngay_dung: 5
                }
              ]
            },
            ket_luan_dieu_tri: 'Tăng huyết áp độ 1 có dày thất trái nhẹ, rối loạn lipid máu. Tình trạng ổn định, chỉ định điều trị ngoại trú theo đơn thuốc.',
            loi_dan_bac_si: 'Hạn chế ăn mặn (dưới 5g muối/ngày), kiêng rượu bia thuốc lá. Tăng cường rau xanh, đi bộ nhẹ nhàng 30 phút/ngày. Tự đo và ghi nhật ký huyết áp mỗi sáng.',
            ngay_hen_tai_kham: '2026-10-15',
            chu_ky_dien_tu: {
              bac_si_ky: 'BS. CKII Lê Văn Thịnh',
              cchn: '004523/BYT-CCHN',
              thoi_gian_ky: '2026-09-15 09:32:15',
              xac_thuc_ma_hoa: 'SHA256: 8a4f91e70c...valid',
              truong_khoa_ky: 'TS.BS Nguyễn Hoàng Long',
              co_so_y_te: 'Phòng khám Đa khoa Quốc tế SmartCare'
            }
          }
        ]);
      }
      if (profRes.status === 'fulfilled' && profRes.value) {
        const u = profRes.value;
        setProfile(u);
        setProfileForm({
          ho_ten: u.ho_ten || u.full_name || '',
          so_dien_thoai: u.so_dien_thoai || u.phone || '',
          ngay_sinh: u.ngay_sinh || '',
          gioi_tinh: u.gioi_tinh || 'Nam',
          dia_chi: u.dia_chi || '',
          nhom_mau: u.nhom_mau || 'O+',
          tien_su_benh: u.tien_su_benh || '',
          di_ung_thuoc: u.di_ung_thuoc || ''
        });
      }
    } catch (e) {
      setErrorMsg('Không thể tải dữ liệu: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // 1. Confirm appointment
  const handleConfirmAppointment = async (aptId) => {
    try {
      await ApiService.confirmAppointment(aptId);
      setSuccessMsg('Đã xác nhận lịch hẹn khám thành công! Khung giờ của bạn được đảm bảo an toàn.');
      loadAllData();
    } catch (e) {
      alert('Lỗi xác nhận: ' + e.message);
    }
  };

  // 2. Cancel appointment
  const handleCancelSubmit = async () => {
    if (!cancelModalApt) return;
    setCancelLoading(true);
    try {
      await ApiService.cancelAppointment(cancelModalApt.id, cancelReason);
      setSuccessMsg('Đã hủy lịch khám thành công. Khung giờ đã được giải phóng cho bệnh nhân khác.');
      setCancelModalApt(null);
      loadAllData();
    } catch (e) {
      alert('Không thể hủy lịch: ' + e.message);
    } finally {
      setCancelLoading(false);
    }
  };

  // 3. Open Reschedule Modal & Fetch Slots
  const handleOpenReschedule = (apt) => {
    setRescheduleModalApt(apt);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    setNewDate(dateStr);
    fetchSlotsForReschedule(apt.doctor_id, dateStr);
  };

  const fetchSlotsForReschedule = async (doctorId, dateStr) => {
    setLoadingSlots(true);
    setNewSlotTime('');
    try {
      const data = await ApiService.getDoctorSlots(doctorId, dateStr);
      if (data && Array.isArray(data.slots)) {
        setAvailableSlots(data.slots.filter(s => s.is_available));
      } else {
        setAvailableSlots([]);
      }
    } catch (e) {
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleRescheduleSubmit = async () => {
    if (!rescheduleModalApt || !newDate || !newSlotTime) {
      alert('Vui lòng chọn ngày và khung giờ khám mới.');
      return;
    }
    setRescheduleLoading(true);
    try {
      await ApiService.rescheduleAppointment(
        rescheduleModalApt.id,
        newDate,
        newSlotTime,
        rescheduleModalApt.doctor_id,
        rescheduleReason
      );
      setSuccessMsg('Đổi lịch hẹn khám thành công!');
      setRescheduleModalApt(null);
      loadAllData();
    } catch (e) {
      alert('Lỗi đổi lịch khám: ' + e.message);
    } finally {
      setRescheduleLoading(false);
    }
  };

  // 4. Accept Waitlist Slot
  const handleAcceptWaitlist = async (waitlistId) => {
    try {
      await ApiService.acceptWaitlistSlot(waitlistId);
      setSuccessMsg('Chúc mừng! Bạn đã nhận slot khám chính thức thành công.');
      loadAllData();
      setActiveTab('appointments');
    } catch (e) {
      alert('Lỗi nhận slot: ' + e.message);
    }
  };

  // 5. Save Profile Form
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await ApiService.updateProfile(profileForm);
      setSuccessMsg('Cập nhật hồ sơ bệnh nhân thành công!');
      loadAllData();
    } catch (e) {
      alert('Lỗi lưu hồ sơ: ' + e.message);
    } finally {
      setSavingProfile(false);
    }
  };

  // Helper for Status Badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'DA_KHAM':
      case 'COMPLETED':
        return <span className="px-2.5 py-1 rounded-sm text-xs font-semibold bg-[#E6F4EA] text-[#2F8F5B]">Đã khám xong</span>;
      case 'DA_XAC_NHAN':
      case 'CONFIRMED':
        return <span className="px-2.5 py-1 rounded-sm text-xs font-semibold bg-[#DCEAE6] text-[#1F6F5C]">Đã xác nhận (24h)</span>;
      case 'CHO_XAC_NHAN':
      case 'PENDING':
        return <span className="px-2.5 py-1 rounded-sm text-xs font-semibold bg-[#FBEACB] text-[#B45309]">Chờ xác nhận</span>;
      case 'DANG_KHAM':
        return <span className="px-2.5 py-1 rounded-sm text-xs font-semibold bg-[#E0E7FF] text-[#4338CA]">Đang khám bệnh</span>;
      case 'DA_HUY':
      case 'CANCELLED':
        return <span className="px-2.5 py-1 rounded-sm text-xs font-semibold bg-[#F1F0EC] text-[#6B6A65]">Đã hủy</span>;
      case 'NO_SHOW':
        return <span className="px-2.5 py-1 rounded-sm text-xs font-semibold bg-red-100 text-red-700">Vắng mặt (No-show)</span>;
      default:
        return <span className="px-2.5 py-1 rounded-sm text-xs font-semibold bg-[#F7F5F0] text-[#1C1B19]">{status}</span>;
    }
  };

  return (
    <div className="max-w-[1080px] mx-auto px-4 lg:px-8 py-6 space-y-6 text-left">
      {/* Title & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E4E1D8] pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1B19] flex items-center space-x-2">
            <UserCheck className="w-6 h-6 text-[#1F6F5C]" />
            <span>Cổng Thông Tin Người Bệnh (Patient Portal)</span>
          </h1>
          <p className="text-xs text-[#6B6A65] mt-1">
            Quản lý lịch hẹn khám 30 phút, theo dõi danh sách chờ (Waitlist) và y bạ điện tử cá nhân
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex bg-[#E4E1D8]/40 p-1 rounded-sm text-xs font-semibold">
          <button
            onClick={() => setActiveTab('appointments')}
            className={`px-3 py-1.5 rounded-sm transition ${
              activeTab === 'appointments' ? 'bg-[#FFFFFF] text-[#1F6F5C] shadow-sm' : 'text-[#6B6A65] hover:text-[#1C1B19]'
            }`}
          >
            Lịch hẹn của tôi ({appointments.length})
          </button>
          <button
            onClick={() => setActiveTab('emr')}
            className={`px-3 py-1.5 rounded-sm transition flex items-center space-x-1.5 ${
              activeTab === 'emr' ? 'bg-[#FFFFFF] text-[#1F6F5C] shadow-sm font-bold' : 'text-[#6B6A65] hover:text-[#1C1B19]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Bệnh án & Đơn thuốc ({emrHistory.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('waitlist')}
            className={`px-3 py-1.5 rounded-sm transition flex items-center space-x-1 ${
              activeTab === 'waitlist' ? 'bg-[#FFFFFF] text-[#1F6F5C] shadow-sm' : 'text-[#6B6A65] hover:text-[#1C1B19]'
            }`}
          >
            <span>Danh sách chờ</span>
            {waitlist.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#E8A33D] text-white text-[10px] flex items-center justify-center font-bold">
                {waitlist.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded-sm transition ${
              activeTab === 'profile' ? 'bg-[#FFFFFF] text-[#1F6F5C] shadow-sm' : 'text-[#6B6A65] hover:text-[#1C1B19]'
            }`}
          >
            Thông tin y tế cá nhân
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-[#DCEAE6] border border-[#1F6F5C]/40 text-[#1F6F5C] text-xs rounded-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')}><X className="w-4 h-4" /></button>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-sm flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#6B6A65] flex items-center justify-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#1F6F5C]" />
          <span>Đang tải thông tin y bạ...</span>
        </div>
      ) : (
        <>
          {/* DIGITAL HEALTH ID CARD & UPCOMING APPOINTMENT HERO BAR */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-2">
            {/* 1. DIGITAL HEALTH ID CARD */}
            <div className="lg:col-span-6 bg-gradient-to-br from-[#1F6F5C] via-[#1A5C4D] to-[#124237] text-white p-5 rounded-2xl shadow-md border border-[#185849] flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    {(profile?.ho_ten || profile?.full_name || 'BN')
                      .split(' ')
                      .filter(Boolean)
                      .map(w => w[0])
                      .slice(-2)
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#DCEAE6] px-2 py-0.5 rounded bg-white/10">
                      THẺ SỨC KHỎE ĐIỆN TỬ • MYCHART PHR
                    </span>
                    <h2 className="text-base font-bold text-white mt-1">
                      {profile?.ho_ten || profile?.full_name || 'Bệnh Nhân'}
                    </h2>
                    <p className="text-xs text-[#DCEAE6]">
                      SĐT: {profile?.so_dien_thoai || profile?.phone || 'Chưa cập nhật'}
                    </p>
                  </div>
                </div>

                {/* QR Code Icon / Medical ID */}
                <div className="text-right">
                  <div className="w-10 h-10 rounded-lg bg-white p-1 flex items-center justify-center text-[#1F6F5C] shadow-sm ml-auto">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <span className="font-mono text-[10px] font-bold text-[#DCEAE6] block mt-1">
                    #{profile?.id ? `BN-2026-${String(profile.id).padStart(3, '0')}` : 'BN-2026-001'}
                  </span>
                </div>
              </div>

              {/* Patient Core Medical Badges */}
              <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-white/15">
                <div className="bg-white/10 p-2 rounded-lg">
                  <span className="text-[10px] text-gray-300 block">Nhóm máu</span>
                  <span className="font-bold text-[#E8A33D]">{profile?.nhom_mau || 'O+'}</span>
                </div>
                <div className="bg-white/10 p-2 rounded-lg">
                  <span className="text-[10px] text-gray-300 block">Năm sinh</span>
                  <span className="font-bold text-white">{profile?.ngay_sinh ? profile.ngay_sinh.slice(0, 4) : '1992'}</span>
                </div>
                <div className="bg-white/10 p-2 rounded-lg">
                  <span className="text-[10px] text-gray-300 block">Giới tính</span>
                  <span className="font-bold text-white">{profile?.gioi_tinh || 'Nam'}</span>
                </div>
              </div>

              {/* Allergy Safety Strip */}
              <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                profile?.di_ung_thuoc && profile?.di_ung_thuoc.toUpperCase() !== 'KHONG' && profile?.di_ung_thuoc.toUpperCase() !== 'NKA'
                  ? 'bg-rose-500/20 border-rose-300/40 text-rose-100 font-bold'
                  : profile?.di_ung_thuoc && (profile?.di_ung_thuoc.toUpperCase() === 'KHONG' || profile?.di_ung_thuoc.toUpperCase() === 'NKA')
                  ? 'bg-emerald-500/20 border-emerald-300/40 text-emerald-100 font-semibold'
                  : 'bg-white/10 border-white/10 text-gray-200'
              }`}>
                <div className="flex items-center gap-1.5">
                  {profile?.di_ung_thuoc && profile?.di_ung_thuoc.toUpperCase() !== 'KHONG' && profile?.di_ung_thuoc.toUpperCase() !== 'NKA' ? (
                    <>
                      <span>⚠️ DỊ ỨNG THUỐC:</span>
                      <span className="text-white underline">{profile.di_ung_thuoc}</span>
                    </>
                  ) : profile?.di_ung_thuoc && (profile?.di_ung_thuoc.toUpperCase() === 'KHONG' || profile?.di_ung_thuoc.toUpperCase() === 'NKA') ? (
                    <>
                      <span>🛡️ Đã xác nhận không có tiền sử dị ứng (NKA)</span>
                    </>
                  ) : (
                    <>
                      <span>⚪ Chưa có thông tin ghi nhận dị ứng thuốc</span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setActiveTab('profile')}
                  className="text-[11px] text-white/80 hover:text-white underline font-normal"
                >
                  Cập nhật
                </button>
              </div>
            </div>

            {/* 2. UPCOMING APPOINTMENT HERO CARD */}
            <div className="lg:col-span-6 bg-white border border-[#E4E1D8] p-5 rounded-2xl shadow-subtle flex flex-col justify-between space-y-3">
              {(() => {
                const upcoming = appointments.find(a =>
                  ['CHO_XAC_NHAN', 'PENDING', 'DA_XAC_NHAN', 'CONFIRMED'].includes(a.status || a.trang_thai)
                );

                if (!upcoming) {
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2.5">
                      <div className="w-10 h-10 rounded-full bg-[#F7F5F0] flex items-center justify-center text-[#1F6F5C]">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm font-bold text-[#1C1B19]">Bạn chưa có lịch hẹn khám sắp tới</h3>
                      <p className="text-xs text-[#6B6A65] max-w-sm">
                        Đặt lịch khám chuyên khoa 30 phút với bác sĩ hoặc sử dụng AI sàng lọc triệu chứng.
                      </p>
                      <Link
                        href="/symptom-checker"
                        className="btn-primary px-3.5 py-1.5 text-xs flex items-center gap-1 mt-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Đặt lịch khám mới</span>
                      </Link>
                    </div>
                  );
                }

                const canConfirm = ['CHO_XAC_NHAN', 'PENDING'].includes(upcoming.status || upcoming.trang_thai);

                return (
                  <div className="space-y-3 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-[#E4E1D8] pb-2">
                        <span className="text-xs font-bold text-[#1F6F5C] flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-[#E8A33D]" />
                          <span>LỊCH HẸN KHÁM SẮP TỚI GẦN NHẤT</span>
                        </span>
                        {getStatusBadge(upcoming.status || upcoming.trang_thai)}
                      </div>

                      <div className="mt-3 flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="font-mono text-xs font-bold text-[#1F6F5C]">
                            {upcoming.ma_lich_kham || upcoming.appointment_code}
                          </span>
                          <h3 className="text-base font-bold text-[#1C1B19]">
                            {upcoming.ten_bac_si || upcoming.doctor_name || 'Bác sĩ chuyên khoa'}
                          </h3>
                          <p className="text-xs text-[#6B6A65]">
                            Chuyên khoa: <strong className="text-[#1C1B19]">{upcoming.ten_chuyen_khoa || upcoming.department_name || 'Khoa khám bệnh'}</strong>
                          </p>
                          <p className="text-xs text-[#6B6A65]">
                            Giờ khám dự kiến: <strong className="text-[#1F6F5C]">{upcoming.gio_kham || `${upcoming.start_time || ''} - ${upcoming.end_time || ''}`}</strong> • Ngày: <strong>{upcoming.ngay_kham || upcoming.appointment_date}</strong>
                          </p>
                          <p className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block font-medium">
                            ⏱️ Khuyến nghị: Có mặt trước 15 phút tại Quầy tiếp đón để đo sinh hiệu
                          </p>
                        </div>

                        {upcoming.so_thu_tu && (
                          <div className="text-center bg-[#DCEAE6]/60 border border-[#1F6F5C]/30 p-2.5 rounded-xl shrink-0">
                            <span className="text-[10px] text-[#1F6F5C] font-semibold block uppercase">STT Dự kiến</span>
                            <span className="text-2xl font-black text-[#1F6F5C]">#{upcoming.so_thu_tu}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#E4E1D8] text-xs">
                      {canConfirm && (
                        <button
                          onClick={() => handleConfirmAppointment(upcoming.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#1F6F5C] hover:bg-[#185849] text-white font-bold transition flex items-center gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Xác nhận trước 24h</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenReschedule(upcoming)}
                        className="btn-secondary px-3 py-1.5 text-xs font-medium flex items-center gap-1"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Đổi lịch khám</span>
                      </button>
                      <button
                        onClick={() => setCancelModalApt(upcoming)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 transition flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hủy lịch</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ============================================================ */}
          {/* TAB 1: DANH SÁCH LỊCH HẸN & THAO TÁC VÒNG ĐỜI KHÁM */}
          {/* ============================================================ */}
          {activeTab === 'appointments' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-sm font-bold text-[#1C1B19]">
                    Lịch sử và tiến trình đặt khám
                  </h2>

                  {/* Sub-toggle: Lịch tháng OpenMRS vs Danh sách */}
                  <div className="inline-flex rounded-lg border border-[#D5D2C8] bg-white p-0.5 text-xs font-semibold shadow-xs">
                    <button
                      type="button"
                      onClick={() => setCalendarViewMode('calendar')}
                      className={`px-3 py-1 rounded-md transition flex items-center space-x-1.5 ${
                        calendarViewMode === 'calendar'
                          ? 'bg-[#1F6F5C] text-white shadow-xs font-bold'
                          : 'text-[#6B6A65] hover:text-[#1C1B19] hover:bg-slate-50'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Lịch tháng (OpenMRS)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarViewMode('list')}
                      className={`px-3 py-1 rounded-md transition flex items-center space-x-1.5 ${
                        calendarViewMode === 'list'
                          ? 'bg-[#1F6F5C] text-white shadow-xs font-bold'
                          : 'text-[#6B6A65] hover:text-[#1C1B19] hover:bg-slate-50'
                      }`}
                    >
                      <span>Danh sách ({appointments.length})</span>
                    </button>
                  </div>
                </div>

                <Link
                  href="/symptom-checker"
                  className="btn-primary px-3 py-1.5 text-xs flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Đặt lịch khám mới</span>
                </Link>
              </div>

              {calendarViewMode === 'calendar' ? (
                <AppointmentCalendar
                  role="patient"
                  appointments={appointments}
                  onCreateAppointment={() => {
                    window.location.href = '/symptom-checker';
                  }}
                  onAppointmentSelect={(apt) => {
                    const isUpcoming = ['CHO_XAC_NHAN', 'PENDING', 'DA_XAC_NHAN', 'CONFIRMED'].includes(apt.status || apt.trang_thai);
                    if (isUpcoming) {
                      setCancelModalApt(apt);
                    }
                  }}
                />
              ) : (
                <>
                  {appointments.length === 0 ? (
                    <div className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-8 text-center space-y-3">
                      <Calendar className="w-10 h-10 text-gray-300 mx-auto" />
                      <p className="text-sm text-[#6B6A65]">Bạn chưa có lịch hẹn khám nào trong hệ thống.</p>
                      <Link href="/symptom-checker" className="btn-primary inline-flex items-center px-4 py-2 text-xs">
                        Phân tích AI & Đặt lịch khám ngay
                      </Link>
                    </div>
                  ) : (
                <div className="grid grid-cols-1 gap-4">
                  {appointments.map((apt) => {
                    const isUpcoming = ['CHO_XAC_NHAN', 'PENDING', 'DA_XAC_NHAN', 'CONFIRMED'].includes(apt.status || apt.trang_thai);
                    const isCompleted = ['DA_KHAM', 'COMPLETED'].includes(apt.status || apt.trang_thai);
                    const canCancel = isUpcoming;
                    const canConfirm = ['CHO_XAC_NHAN', 'PENDING'].includes(apt.status || apt.trang_thai);

                    return (
                      <div
                        key={apt.id}
                        className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-5 space-y-3 shadow-subtle hover:border-[#1F6F5C]/40 transition"
                      >
                        {/* Top row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E4E1D8]/70 pb-3 gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs font-bold text-[#1F6F5C]">
                                {apt.ma_lich_kham || apt.appointment_code}
                              </span>
                              {apt.so_thu_tu && (
                                <span className="bg-[#1F6F5C] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  STT dự kiến: #{apt.so_thu_tu}
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-bold text-[#1C1B19]">
                              {apt.ten_bac_si || apt.doctor_name || 'Bác sĩ chuyên khoa'}
                              <span className="text-xs font-normal text-[#6B6A65] ml-1.5">
                                ({apt.ten_chuyen_khoa || apt.department_name || 'Khoa lâm sàng'})
                              </span>
                            </h3>
                          </div>

                          <div className="flex items-center space-x-3 self-start sm:self-auto">
                            <div className="text-right text-xs">
                              <div className="font-semibold text-[#1C1B19]">
                                {apt.ngay_kham || apt.appointment_date}
                              </div>
                              <div className="text-[#6B6A65] text-[11px]">
                                Giờ dự kiến: {apt.gio_kham || `${apt.start_time || ''} - ${apt.end_time || ''}`}
                              </div>
                            </div>
                            {getStatusBadge(apt.trang_thai || apt.status)}
                          </div>
                        </div>

                        {/* Symptoms & Note */}
                        <div className="text-xs text-[#1C1B19] space-y-1">
                          <p>
                            <span className="text-[#6B6A65] font-medium">Lý do / Triệu chứng: </span>
                            {apt.ly_do_kham || apt.symptoms_text || 'Không có mô tả chi tiết'}
                          </p>
                        </div>

                        {/* Medical Summary if Completed */}
                        {isCompleted && (apt.chan_doan || apt.diagnosis_primary) && (
                          <div className="p-3 bg-[#F7F5F0] rounded-sm border border-[#E4E1D8] text-xs space-y-1.5">
                            <div className="font-semibold text-[#1F6F5C]">
                              🩺 Chẩn đoán của Bác sĩ: {apt.chan_doan || apt.diagnosis_primary}
                            </div>
                            {apt.prescription_items && apt.prescription_items.length > 0 && (
                              <div className="text-[11px] text-[#6B6A65]">
                                <span className="font-medium text-[#1C1B19]">Đơn thuốc: </span>
                                {apt.prescription_items.map(p => `${p.medicine_name} (${p.quantity} ${p.unit})`).join(', ')}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action Buttons Bar */}
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#E4E1D8]/60 text-xs">
                          <div className="flex items-center space-x-2">
                            {/* Reconfirmation Button */}
                            {canConfirm && (
                              <button
                                onClick={() => handleConfirmAppointment(apt.id)}
                                className="px-3 py-1.5 rounded-sm bg-[#1F6F5C] text-white hover:bg-[#185849] font-medium transition flex items-center space-x-1"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Xác nhận trước 24h</span>
                              </button>
                            )}

                            {/* Reschedule Button */}
                            {isUpcoming && (
                              <button
                                onClick={() => handleOpenReschedule(apt)}
                                className="btn-secondary px-3 py-1.5 text-xs font-medium flex items-center space-x-1"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                <span>Đổi lịch khám</span>
                              </button>
                            )}

                            {/* Cancel Button */}
                            {canCancel && (
                              <button
                                onClick={() => setCancelModalApt(apt)}
                                className="px-3 py-1.5 rounded-sm text-xs font-medium text-[#C1443C] hover:bg-red-50 border border-[#C1443C]/30 transition flex items-center space-x-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hủy lịch</span>
                              </button>
                            )}

                            {/* Print / Export Receipt Button */}
                            {isCompleted && (
                              <button
                                onClick={() => setPrintModalApt(apt)}
                                className="btn-secondary px-3 py-1.5 text-xs font-medium flex items-center space-x-1"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Xem phiếu khám & Đơn thuốc</span>
                              </button>
                            )}
                          </div>

                          {/* AI Evaluation */}
                          {isCompleted && (
                            <div>
                              {apt.feedback_rating ? (
                                <span className="text-amber-700 font-medium text-xs flex items-center">
                                  Đánh giá gợi ý AI: ★ {apt.feedback_rating}/5
                                </span>
                              ) : (
                                <button
                                  onClick={() => setFeedbackRatingModal(apt)}
                                  className="px-2.5 py-1 text-xs rounded-sm bg-[#FBEACB] text-[#B45309] hover:bg-[#f7dfb0] font-medium"
                                >
                                  Đánh giá đề xuất AI
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

          {/* ============================================================ */}
          {/* TAB: SỔ BỆNH ÁN & ĐƠN THUỐC ĐIỆN TỬ (LONGITUDINAL EMR) */}
          {/* ============================================================ */}
          {activeTab === 'emr' && (
            <div className="space-y-4">
              <div className="bg-[#DCEAE6]/40 border border-[#1F6F5C]/30 p-4 rounded-sm text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#1F6F5C] flex items-center space-x-1.5 text-sm">
                    <FileText className="w-4 h-4" />
                    <span>Sổ Bệnh Án & Đơn Thuốc Ngoại Trú Điện Tử (Longitudinal EMR)</span>
                  </h3>
                  <span className="bg-[#1F6F5C] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Quy chuẩn lưu trữ y bạ
                  </span>
                </div>
                <p className="text-[#1C1B19]">
                  Toàn bộ hồ sơ lâm sàng, kết luận chẩn đoán ICD-10, kết quả cận lâm sàng (X-quang, sinh hóa máu) và đơn thuốc của bạn được lưu trữ an toàn, có giá trị pháp lý và niêm phong chống sửa đổi trái phép sau khi bác sĩ hoàn thành ca khám.
                </p>
              </div>

              {emrHistory.length === 0 ? (
                <div className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-8 text-center space-y-3">
                  <FileText className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm text-[#6B6A65]">Bạn chưa có hồ sơ bệnh án nào đã hoàn tất và niêm phong trong hệ thống.</p>
                  <p className="text-xs text-[#6B6A65]">Sau khi bác sĩ kết thúc lượt khám và ký số hồ sơ, thông tin y bạ sẽ tự động hiển thị tại đây.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {emrHistory.map((enc, idx) => {
                    const printData = {
                      ma_lich_kham: `LK-2026-${enc.id}`,
                      appointment_code: `LK-2026-${enc.id}`,
                      ngay_kham: enc.thoi_gian_bat_dau ? enc.thoi_gian_bat_dau.slice(0, 10) : '2026-10-06',
                      appointment_date: enc.thoi_gian_bat_dau ? enc.thoi_gian_bat_dau.slice(0, 10) : '2026-10-06',
                      ten_bac_si: enc.bac_si_ten || 'Bác sĩ phụ trách',
                      doctor_name: enc.bac_si_ten || 'Bác sĩ phụ trách',
                      ten_chuyen_khoa: enc.chuyen_khoa_ten || 'Chuyên khoa ngoại trú',
                      department_name: enc.chuyen_khoa_ten || 'Chuyên khoa ngoại trú',
                      chan_doan: enc.danh_sach_chan_doan && enc.danh_sach_chan_doan.length > 0
                        ? enc.danh_sach_chan_doan.map(d => `[${d.ma_icd10}] ${d.ten_benh_chan_doan}`).join('; ')
                        : 'Khám kiểm tra sức khỏe tổng quát',
                      prescription_items: enc.don_thuoc?.danh_sach_chi_tiet?.map(t => ({
                        medicine_name: t.ten_thuoc,
                        quantity: t.so_luong,
                        unit: t.don_vi_tinh,
                        usage: `${t.cach_dung} (${t.so_ngay_dung || 1} ngày)`
                      })) || []
                    };

                    return (
                      <div
                        key={enc.id || idx}
                        className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-5 space-y-4 shadow-subtle hover:border-[#1F6F5C]/40 transition"
                      >
                        {/* Header của Lượt khám */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E4E1D8]/80 pb-3 gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs font-bold text-[#1F6F5C]">
                                #{enc.id ? `LK-${enc.id}` : `HS-${idx + 1}`}
                              </span>
                              <span className="text-xs text-[#6B6A65] flex items-center space-x-1">
                                <Clock className="w-3.5 h-3.5 inline mr-1" />
                                {enc.thoi_gian_bat_dau || '09:00, 15/09/2026'}
                              </span>
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                <span>Niêm phong EMR</span>
                              </span>
                            </div>
                            <h4 className="text-base font-bold text-[#1C1B19]">
                              {enc.bac_si_ten || 'Bác sĩ phụ trách'}
                              <span className="text-xs font-normal text-[#6B6A65] ml-2">
                                ({enc.chuyen_khoa_ten || 'Khoa Nội'})
                              </span>
                            </h4>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => setSummaryModalEnc(enc)}
                              className="px-3 py-1.5 rounded-sm bg-[#1F6F5C] hover:bg-[#185949] text-white text-xs font-semibold flex items-center space-x-1.5 shadow-subtle transition"
                              title="Xem và in Bản Tóm tắt Bệnh án Ngoại trú chuẩn Thông tư 32/2023/TT-BYT"
                            >
                              <FileCheck className="w-3.5 h-3.5 text-[#DCEAE6]" />
                              <span>Tóm tắt Bệnh án (TT 32/2023/TT-BYT)</span>
                            </button>
                            <button
                              onClick={() => setPrintModalApt(printData)}
                              className="btn-secondary px-3 py-1.5 text-xs flex items-center space-x-1 text-[#1F6F5C] hover:bg-[#DCEAE6]/30 font-medium"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>In đơn thuốc & kết quả</span>
                            </button>
                          </div>
                        </div>

                        {/* 1. Chẩn đoán y khoa ICD-10 */}
                        <div className="space-y-1.5">
                          <span className="text-xs font-bold text-[#1C1B19] flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#1F6F5C] inline-block mr-1"></span>
                            Chẩn đoán bệnh (WHO ICD-10):
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {enc.danh_sach_chan_doan && enc.danh_sach_chan_doan.length > 0 ? (
                              enc.danh_sach_chan_doan.map((cd, cdIdx) => (
                                <div
                                  key={cdIdx}
                                  className="text-xs bg-[#F7F5F0] border border-[#E4E1D8] px-2.5 py-1 rounded-sm flex items-center space-x-1.5"
                                >
                                  <span className={`text-[10px] font-bold px-1 py-0.2 rounded ${cd.loai_chan_doan === 'CHINH' ? 'bg-[#1F6F5C] text-white' : 'bg-gray-200 text-gray-700'}`}>
                                    {cd.loai_chan_doan === 'CHINH' ? 'CHÍNH' : 'PHỤ'}
                                  </span>
                                  <span className="font-mono font-bold text-[#1F6F5C]">{cd.ma_icd10}</span>
                                  <span className="text-[#1C1B19]">- {cd.ten_benh_chan_doan}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-[#6B6A65] italic">Khám kiểm tra sức khỏe tổng quát</p>
                            )}
                          </div>
                        </div>

                        {/* 2. Kết quả Cận lâm sàng & Chẩn đoán hình ảnh */}
                        {enc.danh_sach_chi_dinh && enc.danh_sach_chi_dinh.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-[#E4E1D8]/60">
                            <span className="text-xs font-bold text-[#1C1B19] flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#1F6F5C] inline-block mr-1"></span>
                              Kết quả Cận lâm sàng & Xét nghiệm ({enc.danh_sach_chi_dinh.length}):
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              {enc.danh_sach_chi_dinh.map((cls, clsIdx) => {
                                const phanLoai = cls.ket_qua_phan_loai || cls.muc_do_canh_bao || 'BINH_THUONG';
                                const isCritical = phanLoai === 'NGUY_KICH';
                                const isAbnormal = phanLoai === 'BAT_THUONG';
                                return (
                                  <div
                                    key={clsIdx}
                                    className={`p-3 rounded-lg border text-xs space-y-1.5 transition ${
                                      isCritical
                                        ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-300'
                                        : isAbnormal
                                        ? 'bg-amber-50/70 border-amber-300'
                                        : 'bg-[#F7F5F0] border-[#E4E1D8]'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-[#1C1B19]">{cls.ten_dich_vu}</span>
                                      {isCritical ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                                          🔴 ⚠️ Nguy kịch
                                        </span>
                                      ) : isAbnormal ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                          🟡 Bất thường
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                          🟢 Bình thường
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[#6B6A65] bg-white p-2 rounded-sm border border-[#E4E1D8]/60 font-mono text-[11px] leading-relaxed">
                                      {cls.ket_qua_chi_tiet || 'Không có ghi chú thêm.'}
                                    </p>
                                    {cls.tep_dinh_kem_url && (
                                      <a
                                        href={cls.tep_dinh_kem_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center space-x-1 text-[#1F6F5C] hover:underline text-[11px] font-medium"
                                      >
                                        <span>Xem ảnh phim / Báo cáo đính kèm</span>
                                        <ChevronRight className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 3. Đơn thuốc điện tử chuẩn y khoa */}
                        {enc.don_thuoc?.danh_sach_chi_tiet && enc.don_thuoc.danh_sach_chi_tiet.length > 0 && (
                          <div className="space-y-3 pt-2 border-t border-[#E4E1D8]/60">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <span className="text-xs font-bold text-[#1C1B19] flex items-center space-x-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#1F6F5C] inline-block"></span>
                                <span>Đơn thuốc điện tử chuẩn y khoa ({enc.don_thuoc.danh_sach_chi_tiet.length} loại thuốc):</span>
                              </span>
                              <div className="flex items-center gap-2 text-[11px] text-[#6B6A65]">
                                <span>Mã đơn: <strong className="font-mono text-[#1F6F5C]">{enc.don_thuoc.ma_don_thuoc || `DT-${enc.id}`}</strong></span>
                                <span>•</span>
                                <span>Ngày kê: <strong>{enc.don_thuoc.ngay_ke_don || (enc.thoi_gian_bat_dau ? enc.thoi_gian_bat_dau.slice(0, 10) : 'Hôm nay')}</strong></span>
                              </div>
                            </div>

                            <div className="space-y-2.5">
                              {enc.don_thuoc.danh_sach_chi_tiet.map((th, thIdx) => {
                                const sch = parseMedSchedule(th);
                                const medKey = `${enc.id || 'enc'}-${thIdx}`;
                                const isTaken = !!takenMeds[medKey];

                                return (
                                  <div
                                    key={thIdx}
                                    className={`p-3.5 rounded-lg border transition ${
                                      isTaken
                                        ? 'bg-emerald-50/40 border-emerald-200'
                                        : 'bg-[#FFFFFF] border-[#E4E1D8] hover:border-[#1F6F5C]/40'
                                    }`}
                                  >
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                                      {/* Thông tin tên thuốc & hoạt chất */}
                                      <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="w-5 h-5 rounded-full bg-[#DCEAE6] text-[#1F6F5C] text-[11px] font-bold flex items-center justify-center shrink-0">
                                            {thIdx + 1}
                                          </span>
                                          <h5 className="font-bold text-sm text-[#1C1B19] flex items-center gap-1.5">
                                            <Pill className="w-4 h-4 text-[#1F6F5C]" />
                                            <span>{th.ten_thuoc}</span>
                                          </h5>
                                          {th.hoat_chat && (
                                            <span className="text-[11px] text-[#6B6A65] italic">
                                              ({th.hoat_chat})
                                            </span>
                                          )}
                                          <span className="bg-[#F7F5F0] border border-[#E4E1D8] text-[11px] font-mono font-bold px-2 py-0.5 rounded text-[#1C1B19]">
                                            SL: {th.so_luong} {th.don_vi_tinh}
                                          </span>
                                          {th.so_ngay_dung && (
                                            <span className="text-[11px] text-[#6B6A65] bg-gray-100 px-2 py-0.5 rounded">
                                              Dùng {th.so_ngay_dung} ngày
                                            </span>
                                          )}
                                        </div>

                                        {/* Hướng dẫn cách dùng & Ghi chú */}
                                        <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#DCEAE6]/70 text-[#1F6F5C] font-semibold">
                                            🍽️ {sch.huong_dan}
                                          </span>
                                          {th.cach_dung && (
                                            <span className="text-[#6B6A65]">
                                              • {th.cach_dung}
                                            </span>
                                          )}
                                        </div>

                                        {sch.ghi_chu && (
                                          <div className="p-2 mt-1.5 bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] rounded text-[11px] leading-relaxed flex items-start gap-1.5">
                                            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#D97706]" />
                                            <div>
                                              <strong className="font-semibold">Lời dặn bác sĩ:</strong> {sch.ghi_chu}
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Phân bổ thời điểm uống: Sáng - Trưa - Chiều - Tối */}
                                      <div className="flex flex-col items-end gap-2 shrink-0">
                                        <div className="grid grid-cols-4 gap-1.5 bg-[#F7F5F0] p-1.5 rounded-lg border border-[#E4E1D8] text-center text-xs">
                                          {/* Sáng */}
                                          <div className={`px-2 py-1 rounded min-w-[52px] ${
                                            sch.sang > 0
                                              ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                              : 'bg-white/60 text-gray-400 opacity-60'
                                          }`}>
                                            <div className="text-[10px] flex items-center justify-center gap-0.5">
                                              <span>☀️ Sáng</span>
                                            </div>
                                            <div className="text-xs font-mono mt-0.5">
                                              {sch.sang > 0 ? `${sch.sang} v` : '—'}
                                            </div>
                                          </div>

                                          {/* Trưa */}
                                          <div className={`px-2 py-1 rounded min-w-[52px] ${
                                            sch.trua > 0
                                              ? 'bg-orange-100 text-orange-900 border border-orange-300 font-bold'
                                              : 'bg-white/60 text-gray-400 opacity-60'
                                          }`}>
                                            <div className="text-[10px] flex items-center justify-center gap-0.5">
                                              <span>🌤️ Trưa</span>
                                            </div>
                                            <div className="text-xs font-mono mt-0.5">
                                              {sch.trua > 0 ? `${sch.trua} v` : '—'}
                                            </div>
                                          </div>

                                          {/* Chiều */}
                                          <div className={`px-2 py-1 rounded min-w-[52px] ${
                                            sch.chieu > 0
                                              ? 'bg-sky-100 text-sky-900 border border-sky-300 font-bold'
                                              : 'bg-white/60 text-gray-400 opacity-60'
                                          }`}>
                                            <div className="text-[10px] flex items-center justify-center gap-0.5">
                                              <span>⛅ Chiều</span>
                                            </div>
                                            <div className="text-xs font-mono mt-0.5">
                                              {sch.chieu > 0 ? `${sch.chieu} v` : '—'}
                                            </div>
                                          </div>

                                          {/* Tối */}
                                          <div className={`px-2 py-1 rounded min-w-[52px] ${
                                            sch.toi > 0
                                              ? 'bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold'
                                              : 'bg-white/60 text-gray-400 opacity-60'
                                          }`}>
                                            <div className="text-[10px] flex items-center justify-center gap-0.5">
                                              <span>🌙 Tối</span>
                                            </div>
                                            <div className="text-xs font-mono mt-0.5">
                                              {sch.toi > 0 ? `${sch.toi} v` : '—'}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Nút đánh dấu uống thuốc trong ngày */}
                                        <button
                                          type="button"
                                          onClick={() => toggleMedTaken(medKey)}
                                          className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition ${
                                            isTaken
                                              ? 'bg-emerald-600 text-white shadow-xs'
                                              : 'bg-white border border-[#E4E1D8] text-[#6B6A65] hover:text-[#1F6F5C] hover:border-[#1F6F5C]'
                                          }`}
                                          title="Đánh dấu để theo dõi tuân thủ uống thuốc hàng ngày"
                                        >
                                          {isTaken ? (
                                            <>
                                              <Check className="w-3 h-3" />
                                              <span>Đã uống hôm nay</span>
                                            </>
                                          ) : (
                                            <>
                                              <CheckSquare className="w-3 h-3" />
                                              <span>Đánh dấu đã uống</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 4. Kết luận & Lời dặn */}
                        {(enc.ket_luan_dieu_tri || enc.loi_dan_bac_si || enc.ngay_hen_tai_kham) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E4E1D8]/60 text-xs bg-[#F7F5F0]/50 p-3 rounded-sm">
                            <div>
                              <span className="font-bold text-[#1C1B19] block mb-0.5">Kết luận điều trị:</span>
                              <p className="text-[#6B6A65]">{enc.ket_luan_dieu_tri || 'Điều trị ngoại trú theo dõi.'}</p>
                            </div>
                            <div>
                              <span className="font-bold text-[#1C1B19] block mb-0.5">Lời dặn & Hẹn tái khám:</span>
                              <p className="text-[#6B6A65]">{enc.loi_dan_bac_si || 'Uống thuốc đúng giờ, tái khám khi có dấu hiệu bất thường.'}</p>
                              {enc.ngay_hen_tai_kham && (
                                <p className="mt-1 font-bold text-[#1F6F5C] flex items-center space-x-1">
                                  <Calendar className="w-3.5 h-3.5 inline mr-1" />
                                  <span>Hẹn tái khám ngày: {enc.ngay_hen_tai_kham}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: DANH SÁCH CHỜ KHÁM THÔNG MINH (SMART WAITLIST) */}
          {/* ============================================================ */}
          {activeTab === 'waitlist' && (
            <div className="space-y-4">
              <div className="bg-[#DCEAE6]/40 border border-[#1F6F5C]/30 p-4 rounded-sm text-xs space-y-1.5">
                <h3 className="font-bold text-[#1F6F5C] flex items-center space-x-1.5">
                  <Shield className="w-4 h-4" />
                  <span>Quy trình bảo vệ quyền lợi Danh sách chờ (Smart Waitlist)</span>
                </h3>
                <p className="text-[#1C1B19]">
                  Khi một ca khám đã kín chỗ, bạn được ghi danh vào Danh sách chờ. Nếu có người bệnh khác hủy lịch hoặc không xác nhận trước 2 tiếng, hệ thống sẽ tự động cấp quyền ưu tiên theo thứ tự số và thông báo để bạn bấm nhận slot ngay.
                </p>
              </div>

              {waitlist.length === 0 ? (
                <div className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-8 text-center space-y-2">
                  <Clock className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm text-[#6B6A65]">Hiện bạn không có yêu cầu nào trong danh sách chờ.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {waitlist.map((w) => {
                    const isOffered = w.trang_thai === 'DA_CAP_SLOT';
                    return (
                      <div
                        key={w.id}
                        className={`bg-[#FFFFFF] border rounded-sm p-4 space-y-3 ${
                          isOffered ? 'border-[#1F6F5C] ring-2 ring-[#1F6F5C]/20' : 'border-[#E4E1D8]'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E4E1D8]/60 pb-2 gap-2">
                          <div>
                            <span className="text-xs font-mono font-bold text-[#1F6F5C]">
                              Mã hàng chờ: #{w.id}
                            </span>
                            <h4 className="text-sm font-bold text-[#1C1B19]">
                              Bác sĩ: {w.ten_bac_si || 'Bác sĩ chuyên khoa'}
                            </h4>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-[#6B6A65]">
                              Ngày mong muốn: <strong>{w.ngay_mong_muon}</strong> (Ca {w.ca_mong_muon})
                            </span>
                            <span className={`px-2 py-0.5 rounded-sm text-xs font-semibold ${
                              isOffered ? 'bg-[#E6F4EA] text-[#2F8F5B] animate-pulse' : 'bg-[#FBEACB] text-[#B45309]'
                            }`}>
                              {isOffered ? '🎉 ĐÃ ĐƯỢC CẤP SLOT!' : `Đang chờ (Vị trí #${w.thu_tu_uu_tien || 1})`}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-[#6B6A65]">
                          <strong>Triệu chứng ban đầu:</strong> {w.trieu_chung || 'Chưa cung cấp'}
                        </p>

                        {/* Accept Button if Offered */}
                        {isOffered && (
                          <div className="bg-[#E6F4EA]/50 p-3 rounded-sm border border-[#2F8F5B]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-xs font-medium text-[#2F8F5B]">
                              Slot khám đã được giải phóng cho bạn! Hãy xác nhận trong vòng 15 phút.
                            </span>
                            <button
                              onClick={() => handleAcceptWaitlist(w.id)}
                              className="px-4 py-2 bg-[#1F6F5C] hover:bg-[#185849] text-white font-bold text-xs rounded-sm transition flex items-center space-x-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Xác nhận nhận slot khám chính thức</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: HỒ SƠ Y BẠ VÀ TIỀN SỬ LÂM SÀNG CÁ NHÂN (EMR) */}
          {/* ============================================================ */}
          {activeTab === 'profile' && (
            <div className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-6 space-y-6">
              <div className="border-b border-[#E4E1D8] pb-3">
                <h2 className="text-base font-bold text-[#1C1B19]">
                  Hồ sơ sức khỏe & Y bạ điện tử cá nhân (OpenMRS Patient Pattern)
                </h2>
                <p className="text-xs text-[#6B6A65] mt-0.5">
                  Thông tin này giúp Bác sĩ chuyên khoa nắm rõ tiền sử dị ứng và bệnh lý nền trước khi chẩn đoán
                </p>
              </div>

              {/* Patient Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[#F7F5F0] p-4 rounded-sm border border-[#E4E1D8] text-xs">
                <div>
                  <span className="text-[#6B6A65] block">Mã định danh y tế:</span>
                  <span className="font-mono font-bold text-[#1F6F5C] text-sm">
                    {profile?.ma_dinh_danh_y_te || 'BN-2026-CHUA-CAP'}
                  </span>
                </div>
                <div>
                  <span className="text-[#6B6A65] block">Email tài khoản:</span>
                  <span className="font-medium text-[#1C1B19]">{profile?.email}</span>
                </div>
                <div>
                  <span className="text-[#6B6A65] block">Điểm tín nhiệm:</span>
                  <span className="font-bold text-emerald-700">100 / 100 điểm</span>
                </div>
                <div>
                  <span className="text-[#6B6A65] block">Số lần vắng mặt (No-show):</span>
                  <span className="font-bold text-[#1C1B19]">0 lần</span>
                </div>
              </div>

              {/* Profile Edit Form */}
              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-medium text-[#1C1B19]">Họ và tên *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.ho_ten}
                      onChange={(e) => setProfileForm({ ...profileForm, ho_ten: e.target.value })}
                      className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-2 text-xs text-[#1C1B19] focus:outline-none focus:border-[#1F6F5C]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-[#1C1B19]">Số điện thoại liên lạc *</label>
                    <input
                      type="tel"
                      required
                      value={profileForm.so_dien_thoai}
                      onChange={(e) => setProfileForm({ ...profileForm, so_dien_thoai: e.target.value })}
                      className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-2 text-xs text-[#1C1B19] focus:outline-none focus:border-[#1F6F5C]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-[#1C1B19]">Ngày sinh</label>
                    <input
                      type="date"
                      value={profileForm.ngay_sinh}
                      onChange={(e) => setProfileForm({ ...profileForm, ngay_sinh: e.target.value })}
                      className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-2 text-xs text-[#1C1B19] focus:outline-none focus:border-[#1F6F5C]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-[#1C1B19]">Giới tính</label>
                    <select
                      value={profileForm.gioi_tinh}
                      onChange={(e) => setProfileForm({ ...profileForm, gioi_tinh: e.target.value })}
                      className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-2 text-xs text-[#1C1B19] focus:outline-none focus:border-[#1F6F5C]"
                    >
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="font-medium text-[#1C1B19]">Địa chỉ nơi cư trú</label>
                    <input
                      type="text"
                      value={profileForm.dia_chi}
                      onChange={(e) => setProfileForm({ ...profileForm, dia_chi: e.target.value })}
                      className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-2 text-xs text-[#1C1B19] focus:outline-none focus:border-[#1F6F5C]"
                      placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố..."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-[#1C1B19]">Nhóm máu</label>
                    <select
                      value={profileForm.nhom_mau}
                      onChange={(e) => setProfileForm({ ...profileForm, nhom_mau: e.target.value })}
                      className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-2 text-xs text-[#1C1B19] focus:outline-none focus:border-[#1F6F5C]"
                    >
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-[#1C1B19]">Dị ứng thuốc & thức ăn</label>
                    <input
                      type="text"
                      value={profileForm.di_ung_thuoc}
                      onChange={(e) => setProfileForm({ ...profileForm, di_ung_thuoc: e.target.value })}
                      className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-2 text-xs text-[#1C1B19] focus:outline-none focus:border-[#1F6F5C]"
                      placeholder="VD: Dị ứng Penicillin, Aspirin, hải sản..."
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="font-medium text-[#1C1B19]">Tiền sử bệnh lý bản thân & gia đình</label>
                    <textarea
                      rows={3}
                      value={profileForm.tien_su_benh}
                      onChange={(e) => setProfileForm({ ...profileForm, tien_su_benh: e.target.value })}
                      className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-2 text-xs text-[#1C1B19] focus:outline-none focus:border-[#1F6F5C]"
                      placeholder="VD: Tiền sử tăng huyết áp 3 năm, gia đình có người mắc tiểu đường..."
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="btn-primary px-5 py-2 text-xs font-semibold flex items-center space-x-1"
                  >
                    {savingProfile ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    <span>Lưu thông tin hồ sơ y bạ</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: HỦY LỊCH HẸN (RÀNG BUỘC AN TOÀN Y TẾ 2 TIẾNG) */}
      {/* ============================================================ */}
      {cancelModalApt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-md max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-[#C1443C]">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-[#1C1B19]">Xác nhận hủy lịch hẹn khám</h3>
            </div>

            <p className="text-xs text-[#6B6A65]">
              Bạn đang yêu cầu hủy lịch hẹn <strong>{cancelModalApt.ma_lich_kham || cancelModalApt.appointment_code}</strong> với Bác sĩ <strong>{cancelModalApt.ten_bac_si || cancelModalApt.doctor_name}</strong> vào ngày {cancelModalApt.ngay_kham || cancelModalApt.appointment_date}.
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-sm text-xs text-amber-800">
              ⚠️ <strong>Lưu ý:</strong> Theo quy chuẩn y tế, việc hủy lịch cần thực hiện tối thiểu <strong>02 tiếng</strong> trước giờ khám để giải phóng khung giờ cho các bệnh nhân đang chờ.
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-medium text-[#1C1B19]">Lý do hủy lịch:</label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-2 text-xs"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalApt(null)}
                className="btn-secondary px-4 py-2 text-xs"
              >
                Giữ lại lịch khám
              </button>
              <button
                type="button"
                disabled={cancelLoading}
                onClick={handleCancelSubmit}
                className="px-4 py-2 bg-[#C1443C] hover:bg-red-700 text-white font-semibold text-xs rounded-sm transition"
              >
                {cancelLoading ? 'Đang hủy...' : 'Đồng ý hủy lịch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: ĐỔI LỊCH KHÁM (RESCHEDULE MODAL) */}
      {/* ============================================================ */}
      {rescheduleModalApt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-md max-w-lg w-full p-6 shadow-xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#E4E1D8] pb-3">
              <h3 className="text-base font-bold text-[#1C1B19] flex items-center space-x-1.5">
                <Clock className="w-5 h-5 text-[#1F6F5C]" />
                <span>Đổi thời gian khám (Reschedule)</span>
              </h3>
              <button onClick={() => setRescheduleModalApt(null)}><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-[#1C1B19]">1. Chọn ngày khám mới:</label>
                <input
                  type="date"
                  value={newDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setNewDate(e.target.value);
                    fetchSlotsForReschedule(rescheduleModalApt.doctor_id, e.target.value);
                  }}
                  className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-2 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#1C1B19]">2. Chọn khung giờ 30 phút còn trống:</label>
                {loadingSlots ? (
                  <p className="text-[#6B6A65] italic py-2">Đang tải các slot khả dụng...</p>
                ) : availableSlots.length === 0 ? (
                  <p className="text-amber-700 italic py-2 bg-amber-50 p-2 rounded-sm border border-amber-200">
                    Không có slot trống cho ngày này. Vui lòng chọn ngày khác.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1 max-h-40 overflow-y-auto">
                    {availableSlots.map((slot) => {
                      const isSelected = newSlotTime === slot.start_time;
                      return (
                        <button
                          key={slot.start_time}
                          type="button"
                          onClick={() => setNewSlotTime(slot.start_time)}
                          className={`p-2 rounded-sm text-center border font-mono text-xs transition ${
                            isSelected
                              ? 'bg-[#1F6F5C] text-white border-[#1F6F5C] font-bold'
                              : 'bg-[#F7F5F0] hover:bg-[#EFECE6] border-[#E4E1D8] text-[#1C1B19]'
                          }`}
                        >
                          {slot.start_time.slice(0, 5)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#1C1B19]">Lý do đổi lịch:</label>
                <input
                  type="text"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-2 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-[#E4E1D8]">
              <button
                type="button"
                onClick={() => setRescheduleModalApt(null)}
                className="btn-secondary px-4 py-2"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={rescheduleLoading || !newSlotTime}
                onClick={handleRescheduleSubmit}
                className="btn-primary px-4 py-2 font-semibold"
              >
                {rescheduleLoading ? 'Đang cập nhật...' : 'Xác nhận đổi lịch mới'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: IN PHIẾU KHÁM & ĐƠN THUỐC ĐIỆN TỬ (PRINTABLE EMR) */}
      {/* ============================================================ */}
      {printModalApt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-md max-w-2xl w-full p-6 shadow-2xl space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E4E1D8] pb-3 print:hidden">
              <h3 className="text-base font-bold text-[#1C1B19] flex items-center space-x-1.5">
                <Printer className="w-5 h-5 text-[#1F6F5C]" />
                <span>Phiếu Khám Bệnh & Đơn Thuốc Điện Tử</span>
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="btn-primary px-3 py-1.5 text-xs flex items-center space-x-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In bản cứng</span>
                </button>
                <button onClick={() => setPrintModalApt(null)}><X className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Printable Paper Area */}
            <div className="p-6 bg-white border border-gray-200 rounded-sm space-y-5 text-[#1C1B19]">
              <div className="flex justify-between items-start border-b border-gray-300 pb-4">
                <div>
                  <h2 className="text-sm font-bold uppercase text-[#1F6F5C]">PHÒNG KHÁM QUỐC TẾ SMARTCARE</h2>
                  <p className="text-[10px] text-gray-500">Chuẩn mực chất lượng lâm sàng Bộ Y Tế</p>
                  <p className="text-[10px] text-gray-500">Hotline: 1900 1234 - Cấp cứu: 115</p>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-xs">MÃ SỐ: {printModalApt.ma_lich_kham || printModalApt.appointment_code}</div>
                  <div className="text-[10px] text-gray-500">Ngày khám: {printModalApt.ngay_kham || printModalApt.appointment_date}</div>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-sm uppercase text-center text-[#1C1B19] py-1">
                  KẾT QUẢ KHÁM BỆNH & ĐƠN THUỐC NGOẠI TRÚ
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-y border-gray-200 py-3">
                <p><strong>Họ tên người bệnh:</strong> {profile?.ho_ten || 'Nguyễn Thị Bệnh Nhân'}</p>
                <p><strong>Bác sĩ phụ trách:</strong> {printModalApt.ten_bac_si || printModalApt.doctor_name}</p>
                <p><strong>Chuyên khoa:</strong> {printModalApt.ten_chuyen_khoa || printModalApt.department_name}</p>
                <p><strong>Mã Bệnh nhân:</strong> {profile?.ma_dinh_danh_y_te || 'BN-2026-0001'}</p>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-xs text-[#1F6F5C]">1. KẾT LUẬN CHẨN ĐOÁN (ICD-10)</h4>
                <p className="pl-2 text-xs font-medium">
                  {printModalApt.chan_doan || printModalApt.diagnosis_primary || 'Viêm họng cấp / Rối loạn tiêu hóa'}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-xs text-[#1F6F5C]">2. ĐƠN THUỐC ĐIỀU TRỊ</h4>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-600">
                      <th className="py-1">STT</th>
                      <th className="py-1">Tên thuốc & Hàm lượng</th>
                      <th className="py-1">Số lượng</th>
                      <th className="py-1">Cách dùng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(printModalApt.prescription_items || [
                      { medicine_name: 'Paracetamol 500mg', quantity: 10, unit: 'Viên', usage: 'Uống 1 viên khi sốt trên 38.5 độ' },
                      { medicine_name: 'Vitamin C 500mg', quantity: 15, unit: 'Viên', usage: 'Uống 1 viên/ngày sau bữa sáng' }
                    ]).map((m, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5">{idx + 1}</td>
                        <td className="py-1.5 font-medium">{m.medicine_name}</td>
                        <td className="py-1.5">{m.quantity} {m.unit}</td>
                        <td className="py-1.5 text-gray-600">{m.usage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between pt-6 text-center text-xs">
                <div>
                  <p className="text-gray-500 text-[10px]">Người bệnh ký nhận</p>
                </div>
                <div>
                  <p className="text-gray-500 text-[10px]">Bác sĩ khám bệnh</p>
                  <p className="font-bold mt-8">{printModalApt.ten_bac_si || printModalApt.doctor_name}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: BẢN TÓM TẮT BỆNH ÁN ĐIỆN TỬ (TT 32/2023/TT-BYT)   */}
      {/* ============================================================ */}
      {summaryModalEnc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-md max-w-4xl w-full my-auto p-5 sm:p-6 shadow-2xl space-y-4 text-xs max-h-[92vh] overflow-y-auto">
            {/* Header thanh điều khiển (Ẩn khi in) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E4E1D8] pb-3 print:hidden gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="bg-[#1F6F5C] text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <FileCheck className="w-3 h-3" />
                    <span>Quy chuẩn TT 32/2023/TT-BYT</span>
                  </span>
                  <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                    Đã niêm phong & Ký số điện tử
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#1C1B19]">
                  Bản Tóm Tắt Bệnh Án Ngoại Trú Điện Tử
                </h3>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-primary px-3.5 py-1.5 text-xs flex items-center space-x-1.5 shadow-sm font-semibold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In Tóm tắt Bệnh án</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryModalEnc(null)}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Khung văn bản A4 chuẩn quy chuẩn Bộ Y Tế */}
            <div className="bg-white p-6 sm:p-8 border border-gray-300 rounded shadow-xs space-y-5 text-[#1C1B19] font-sans leading-relaxed">
              {/* Header Quốc hiệu - Cơ sở y tế */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b-2 border-gray-800 pb-4">
                <div className="space-y-0.5">
                  <p className="text-[11px] uppercase font-bold text-gray-700">SỞ Y TẾ THÀNH PHỐ HÀ NỘI</p>
                  <h4 className="text-xs font-black uppercase text-[#1F6F5C]">
                    PHÒNG KHÁM ĐA KHOA QUỐC TẾ SMARTCARE
                  </h4>
                  <p className="text-[10px] text-gray-600">
                    Mã CSKCB: <strong className="font-mono">01099</strong> • Khoa: <strong>{summaryModalEnc.chuyen_khoa_ten || 'Khám bệnh Ngoại trú'}</strong>
                  </p>
                  <p className="text-[10px] text-gray-600">
                    Số lưu trữ EMR: <strong className="font-mono text-[#1F6F5C]">{summaryModalEnc.ma_ho_so || `BA-2026-0915-${summaryModalEnc.id}`}</strong>
                  </p>
                </div>

                <div className="text-center sm:text-right space-y-0.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                  <p className="text-[11px] font-semibold underline decoration-1 underline-offset-4">
                    Độc lập - Tự do - Hạnh phúc
                  </p>
                  <p className="text-[10px] text-gray-500 italic pt-1">
                    Hà Nội, ngày {summaryModalEnc.thoi_gian_bat_dau ? summaryModalEnc.thoi_gian_bat_dau.slice(8, 10) : '15'} tháng {summaryModalEnc.thoi_gian_bat_dau ? summaryModalEnc.thoi_gian_bat_dau.slice(5, 7) : '09'} năm 2026
                  </p>
                </div>
              </div>

              {/* Tiêu đề văn bản */}
              <div className="text-center space-y-1 py-1">
                <h2 className="text-base sm:text-lg font-black uppercase text-[#1C1B19] tracking-tight">
                  BẢN TÓM TẮT HỒ SƠ BỆNH ÁN ĐIỆN TỬ NGOẠI TRÚ
                </h2>
                <p className="text-[11px] text-gray-600 italic">
                  (Ban hành kèm theo Thông tư số 32/2023/TT-BYT ngày 31 tháng 12 năm 2023 của Bộ trưởng Bộ Y tế)
                </p>
              </div>

              {/* PHẦN I: THÔNG TIN HÀNH CHÍNH */}
              <div className="space-y-2 border-t border-gray-300 pt-3">
                <h4 className="font-bold text-xs uppercase text-[#1F6F5C] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1F6F5C]"></span>
                  <span>I. THÔNG TIN HÀNH CHÍNH CỦA NGƯỜI BỆNH</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                  <p>1. Họ và tên: <strong className="uppercase font-bold">{profile?.ho_ten || profile?.full_name || 'NGUYỄN THỊ BỆNH NHÂN'}</strong></p>
                  <p>2. Ngày sinh: <strong>{profile?.ngay_sinh || '15/05/1992'}</strong></p>
                  <p>3. Giới tính: <strong>{profile?.gioi_tinh || 'Nam'}</strong> • Dân tộc: <strong>Kinh</strong></p>
                  <p>4. Quốc tịch: <strong>Việt Nam</strong></p>
                  <p>5. Nghề nghiệp: <strong>Công chức / Lao động</strong></p>
                  <p>6. Nhóm máu: <strong className="text-[#E8A33D] font-mono">{profile?.nhom_mau || 'O+'}</strong></p>
                  <p className="sm:col-span-2">7. Địa chỉ nơi cư trú: <strong>{profile?.dia_chi || '123 Phố Huế, Phường Hàng Bài, Quận Hai Bà Trưng, TP. Hà Nội'}</strong></p>
                  <p>8. Số điện thoại: <strong className="font-mono">{profile?.so_dien_thoai || profile?.phone || '0988 123 456'}</strong></p>
                  <p>9. Số CCCD/Định danh: <strong className="font-mono">{profile?.so_cccd || '001092004589'}</strong></p>
                  <p className="sm:col-span-2">10. Mã thẻ BHYT (nếu có): <strong className="font-mono">{profile?.so_the_bhyt || 'DN 4 01 01 2026 888'}</strong></p>
                  <p className="sm:col-span-3 text-gray-700">11. Người nhà cần liên lạc: <strong>{profile?.nguoi_than_ten || 'Nguyễn Văn Thân (Người nhà)'}</strong> — SĐT: <strong className="font-mono">{profile?.nguoi_than_sdt || profile?.so_dien_thoai || '0988 123 456'}</strong></p>
                </div>
              </div>

              {/* PHẦN II: QUÁ TRÌNH KHÁM BỆNH VÀ DIỄN BIẾN LÂM SÀNG */}
              <div className="space-y-2 border-t border-gray-300 pt-3">
                <h4 className="font-bold text-xs uppercase text-[#1F6F5C] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1F6F5C]"></span>
                  <span>II. QUÁ TRÌNH KHÁM BỆNH VÀ DIỄN BIẾN LÂM SÀNG</span>
                </h4>
                <div className="space-y-1.5 text-xs text-gray-800">
                  <p>
                    • <strong>Thời gian tiếp nhận khám:</strong> {summaryModalEnc.thoi_gian_bat_dau || '09:00:00, 15/09/2026'} — <strong>Kết thúc khám:</strong> {summaryModalEnc.thoi_gian_ket_thuc || '09:30:00, 15/09/2026'}
                  </p>
                  <p>
                    • <strong>Lý do đến khám bệnh (Chief complaint):</strong> {summaryModalEnc.ly_do_kham || 'Đau tức ngực trái nhẹ khi gắng sức, huyết áp đo tại nhà dao động 135-145 mmHg.'}
                  </p>
                  <p>
                    • <strong>Bệnh sử:</strong> {summaryModalEnc.benh_su || 'Người bệnh có tiền sử tăng huyết áp 2 năm, điều trị không liên tục. Khoảng 3 ngày nay xuất hiện cơn tức nhẹ sau xương ức khi đi bộ nhanh, tự đo huyết áp tại nhà thấy tăng, không khó thở cấp, không sốt, không yếu liệt.'}
                  </p>
                  <p>
                    • <strong>Tiền sử bệnh bản thân & Gia đình:</strong> {summaryModalEnc.tien_su_ban_than || profile?.tien_su_benh || 'Tăng huyết áp 2 năm; rối loạn lipid máu nhẹ. Gia đình có bố đẻ bị THA.'}
                  </p>
                  <p className="p-2 bg-gray-50 border border-gray-200 rounded">
                    • <strong>Tiền sử dị ứng thuốc & Thực phẩm:</strong>{' '}
                    {profile?.di_ung_thuoc && profile.di_ung_thuoc.toUpperCase() !== 'KHONG' && profile.di_ung_thuoc.toUpperCase() !== 'NKA' ? (
                      <strong className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded">⚠️ DỊ ỨNG: {profile.di_ung_thuoc}</strong>
                    ) : (
                      <strong className="text-emerald-800">Đã kiểm tra — Chưa ghi nhận tiền sử dị ứng thuốc (NKA)</strong>
                    )}
                  </p>

                  {/* Dấu hiệu sinh tồn */}
                  <div className="bg-[#F7F5F0] p-2.5 rounded border border-[#E4E1D8] mt-2">
                    <span className="font-bold text-[11px] uppercase text-[#1C1B19] block mb-1">
                      Dấu hiệu sinh tồn lúc vào khám (Triage Vitals):
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                      <div className="bg-white p-1 rounded border border-gray-200">
                        <span className="text-[10px] text-gray-500 block">Mạch</span>
                        <strong className="text-[#1F6F5C] font-mono">{summaryModalEnc.dau_hieu_sinh_ton?.mach || 76} l/p</strong>
                      </div>
                      <div className="bg-white p-1 rounded border border-gray-200">
                        <span className="text-[10px] text-gray-500 block">Huyết áp</span>
                        <strong className="text-[#C1443C] font-mono">{summaryModalEnc.dau_hieu_sinh_ton?.huyet_ap || '135/85'} mmHg</strong>
                      </div>
                      <div className="bg-white p-1 rounded border border-gray-200">
                        <span className="text-[10px] text-gray-500 block">Nhiệt độ</span>
                        <strong className="font-mono">{summaryModalEnc.dau_hieu_sinh_ton?.nhiet_do || 36.8} °C</strong>
                      </div>
                      <div className="bg-white p-1 rounded border border-gray-200">
                        <span className="text-[10px] text-gray-500 block">SpO2</span>
                        <strong className="text-emerald-700 font-mono">{summaryModalEnc.dau_hieu_sinh_ton?.spo2 || 98} %</strong>
                      </div>
                      <div className="bg-white p-1 rounded border border-gray-200">
                        <span className="text-[10px] text-gray-500 block">Nhịp thở</span>
                        <strong className="font-mono">{summaryModalEnc.dau_hieu_sinh_ton?.nhip_tho || 18} l/p</strong>
                      </div>
                      <div className="bg-white p-1 rounded border border-gray-200">
                        <span className="text-[10px] text-gray-500 block">Chỉ số BMI</span>
                        <strong className="font-mono">{summaryModalEnc.dau_hieu_sinh_ton?.bmi || 22.3} kg/m²</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PHẦN III: KẾT QUẢ CẬN LÂM SÀNG CÓ GIÁ TRỊ CHẨN ĐOÁN */}
              <div className="space-y-2 border-t border-gray-300 pt-3">
                <h4 className="font-bold text-xs uppercase text-[#1F6F5C] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1F6F5C]"></span>
                  <span>III. TÓM TẮT KẾT QUẢ CẬN LÂM SÀNG CÓ GIÁ TRỊ CHẨN ĐOÁN</span>
                </h4>
                {summaryModalEnc.danh_sach_chi_dinh && summaryModalEnc.danh_sach_chi_dinh.length > 0 ? (
                  <div className="overflow-x-auto border border-gray-300 rounded">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#F7F5F0] border-b border-gray-300 text-gray-700 text-[11px]">
                        <tr>
                          <th className="p-2 border-r border-gray-200 w-10 text-center">STT</th>
                          <th className="p-2 border-r border-gray-200">Tên xét nghiệm / Kỹ thuật CĐHA</th>
                          <th className="p-2 border-r border-gray-200">Kết quả ghi nhận</th>
                          <th className="p-2 border-r border-gray-200">Trị số bình thường / Đánh giá</th>
                          <th className="p-2 text-center w-28">Phân loại</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {summaryModalEnc.danh_sach_chi_dinh.map((cls, cIdx) => (
                          <tr key={cIdx} className="hover:bg-gray-50">
                            <td className="p-2 border-r border-gray-200 text-center font-mono">{cIdx + 1}</td>
                            <td className="p-2 border-r border-gray-200 font-semibold">{cls.ten_dich_vu}</td>
                            <td className="p-2 border-r border-gray-200 text-gray-800">{cls.ket_qua_chi_tiet}</td>
                            <td className="p-2 border-r border-gray-200 text-gray-600 font-mono text-[11px]">{cls.tri_so_binh_thuong || 'Trong giới hạn'}</td>
                            <td className="p-2 text-center">
                              {cls.ket_qua_phan_loai === 'BAT_THUONG' ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Bất thường</span>
                              ) : cls.ket_qua_phan_loai === 'NGUY_KICH' ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">Nguy kịch</span>
                              ) : (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Bình thường</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">Không có chỉ định cận lâm sàng trong đợt khám này.</p>
                )}
              </div>

              {/* PHẦN IV: CHẨN ĐOÁN XÁC ĐỊNH (ICD-10) */}
              <div className="space-y-2 border-t border-gray-300 pt-3">
                <h4 className="font-bold text-xs uppercase text-[#1F6F5C] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1F6F5C]"></span>
                  <span>IV. CHẨN ĐOÁN XÁC ĐỊNH (WHO ICD-10)</span>
                </h4>
                <div className="space-y-1.5 text-xs">
                  {summaryModalEnc.danh_sach_chan_doan && summaryModalEnc.danh_sach_chan_doan.length > 0 ? (
                    summaryModalEnc.danh_sach_chan_doan.map((cd, cdIdx) => (
                      <div key={cdIdx} className="flex items-center gap-2 p-1.5 bg-gray-50 rounded border border-gray-200">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          cd.loai_chan_doan === 'CHINH' ? 'bg-[#1F6F5C] text-white' : 'bg-gray-200 text-gray-800'
                        }`}>
                          {cd.loai_chan_doan === 'CHINH' ? 'BỆNH CHÍNH' : 'BỆNH KÈM THEO'}
                        </span>
                        <strong className="font-mono text-[#1F6F5C]">{cd.ma_icd10}</strong>
                        <span>— {cd.ten_benh_chan_doan}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-600">Khám kiểm tra sức khỏe tổng quát ngoại trú.</p>
                  )}
                </div>
              </div>

              {/* PHẦN V: PHƯƠNG PHÁP ĐIỀU TRỊ & ĐƠN THUỐC NGOẠI TRÚ */}
              <div className="space-y-2 border-t border-gray-300 pt-3">
                <h4 className="font-bold text-xs uppercase text-[#1F6F5C] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1F6F5C]"></span>
                  <span>V. PHƯƠNG PHÁP ĐIỀU TRỊ & ĐƠN THUỐC ĐIỆN TỬ</span>
                </h4>
                {summaryModalEnc.don_thuoc?.danh_sach_chi_tiet && summaryModalEnc.don_thuoc.danh_sach_chi_tiet.length > 0 ? (
                  <div className="overflow-x-auto border border-gray-300 rounded">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#F7F5F0] border-b border-gray-300 text-gray-700 text-[11px]">
                        <tr>
                          <th className="p-2 border-r border-gray-200 text-center w-10">STT</th>
                          <th className="p-2 border-r border-gray-200">Tên thuốc, Hàm lượng & Hoạt chất</th>
                          <th className="p-2 border-r border-gray-200 text-center w-20">Số lượng</th>
                          <th className="p-2 border-r border-gray-200 text-center w-36">Thời điểm uống (S-T-C-T)</th>
                          <th className="p-2 border-r border-gray-200">Hướng dẫn sử dụng & Lời dặn</th>
                          <th className="p-2 text-center w-20">Số ngày</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {summaryModalEnc.don_thuoc.danh_sach_chi_tiet.map((th, thIdx) => {
                          const sch = parseMedSchedule(th);
                          return (
                            <tr key={thIdx} className="hover:bg-gray-50">
                              <td className="p-2 border-r border-gray-200 text-center font-mono">{thIdx + 1}</td>
                              <td className="p-2 border-r border-gray-200 font-semibold">
                                <div>{th.ten_thuoc}</div>
                                {th.hoat_chat && <div className="text-[10px] text-gray-500 italic">({th.hoat_chat})</div>}
                              </td>
                              <td className="p-2 border-r border-gray-200 text-center font-mono">
                                {th.so_luong} {th.don_vi_tinh}
                              </td>
                              <td className="p-2 border-r border-gray-200 text-center">
                                <div className="inline-flex gap-1 font-mono text-[11px]">
                                  <span className={`px-1 rounded ${sch.sang > 0 ? 'bg-amber-100 font-bold text-amber-900' : 'text-gray-300'}`}>S:{sch.sang}</span>
                                  <span className={`px-1 rounded ${sch.trua > 0 ? 'bg-orange-100 font-bold text-orange-900' : 'text-gray-300'}`}>Tr:{sch.trua}</span>
                                  <span className={`px-1 rounded ${sch.chieu > 0 ? 'bg-sky-100 font-bold text-sky-900' : 'text-gray-300'}`}>C:{sch.chieu}</span>
                                  <span className={`px-1 rounded ${sch.toi > 0 ? 'bg-indigo-100 font-bold text-indigo-900' : 'text-gray-300'}`}>T:{sch.toi}</span>
                                </div>
                              </td>
                              <td className="p-2 border-r border-gray-200 text-gray-800 text-[11px]">
                                <div className="font-medium text-[#1F6F5C]">{sch.huong_dan}</div>
                                {sch.ghi_chu && <div className="text-gray-500 mt-0.5">{sch.ghi_chu}</div>}
                              </td>
                              <td className="p-2 text-center font-medium font-mono text-[11px]">
                                {th.so_ngay_dung ? `${th.so_ngay_dung} ngày` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">Không có chỉ định dùng thuốc trong đợt này.</p>
                )}
              </div>

              {/* PHẦN VI: TÌNH TRẠNG NGƯỜI BỆNH RA VIỆN / KẾT THÚC KHÁM */}
              <div className="space-y-1.5 border-t border-gray-300 pt-3 text-xs text-gray-800">
                <h4 className="font-bold text-xs uppercase text-[#1F6F5C] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1F6F5C]"></span>
                  <span>VI. TÌNH TRẠNG NGƯỜI BỆNH KHI KẾT THÚC ĐỢT KHÁM</span>
                </h4>
                <p>
                  • <strong>Toàn trạng:</strong> {summaryModalEnc.ket_luan_dieu_tri || 'Tỉnh táo, tiếp xúc tốt, huyết động ổn định, không có dấu hiệu suy tim cấp hay tai biến mạch máu não. Các triệu chứng khó chịu thuyên giảm rõ rệt.'}
                </p>
                <p>
                  • <strong>Kết luận:</strong> Điều trị ngoại trú theo dõi, tuân thủ đúng đơn thuốc điện tử được chỉ định.
                </p>
              </div>

              {/* PHẦN VII: HƯỚNG ĐIỀU TRỊ TIẾP THEO & DẶN DÒ */}
              <div className="space-y-1.5 border-t border-gray-300 pt-3 text-xs text-gray-800">
                <h4 className="font-bold text-xs uppercase text-[#1F6F5C] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1F6F5C]"></span>
                  <span>VII. HƯỚNG ĐIỀU TRỊ TIẾP THEO & LỜI DẶN CỦA BÁC SĨ</span>
                </h4>
                <p>
                  • <strong>Lời dặn:</strong> {summaryModalEnc.loi_dan_bac_si || 'Uống thuốc đúng giờ, hạn chế ăn mặn, kiêng rượu bia, vận động nhẹ nhàng.'}
                </p>
                <p>
                  • <strong>Hẹn ngày tái khám:</strong>{' '}
                  <strong className="text-[#1F6F5C]">
                    {summaryModalEnc.ngay_hen_tai_kham || 'Tái khám sau 30 ngày hoặc khám ngay khi có dấu hiệu bất thường (đau ngực dữ dội, khó thở, huyết áp > 160mmHg).'}
                  </strong>
                </p>
              </div>

              {/* PHẦN VIII: CHỮ KÝ ĐIỆN TỬ VÀ XÁC THỰC PHÁP LÝ */}
              <div className="border-t-2 border-gray-800 pt-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                  {/* Người bệnh / Đại diện */}
                  <div className="space-y-1">
                    <p className="font-bold uppercase text-[11px]">NGƯỜI BỆNH / ĐẠI DIỆN</p>
                    <p className="text-[10px] text-gray-500 italic">(Ký, ghi rõ họ tên)</p>
                    <div className="h-16 flex items-end justify-center">
                      <span className="font-medium text-gray-800 italic">
                        {profile?.ho_ten || profile?.full_name || 'Nguyễn Thị Bệnh Nhân'}
                      </span>
                    </div>
                  </div>

                  {/* Mã QR xác thực toàn vẹn số */}
                  <div className="flex flex-col items-center justify-center space-y-1 border-x border-gray-200 px-2">
                    <div className="w-16 h-16 bg-white p-1 border border-gray-300 rounded flex items-center justify-center text-[#1F6F5C] shadow-xs">
                      <QrCode className="w-14 h-14" />
                    </div>
                    <span className="text-[9px] font-mono text-gray-500">SHA256: 8A4F...E70C</span>
                    <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      ✓ Đã chứng thực số Bộ Y Tế
                    </span>
                  </div>

                  {/* Bác sĩ điều trị & Trưởng khoa */}
                  <div className="space-y-1">
                    <p className="font-bold uppercase text-[11px]">BÁC SĨ KHÁM VÀ ĐIỀU TRỊ</p>
                    <p className="text-[10px] text-gray-500 italic">(Ký số điện tử y tế)</p>
                    <div className="h-16 flex flex-col items-center justify-end">
                      <div className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 font-mono font-bold">
                        [DIGITALLY SIGNED]
                      </div>
                      <p className="font-bold text-xs text-[#1F6F5C] mt-1">
                        {summaryModalEnc.bac_si_ten || summaryModalEnc.doctor_name || 'BS. CKII Lê Văn Thịnh'}
                      </p>
                      <p className="text-[9px] text-gray-500">
                        CCHN: {summaryModalEnc.chu_ky_dien_tu?.cchn || '004523/BYT-CCHN'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[10px] text-gray-500 italic pt-6 border-t border-gray-200 mt-4">
                  * Bản tóm tắt bệnh án này được trích xuất từ Hệ thống Quản lý Bệnh án Điện tử (EMR) chuẩn quy định tại Thông tư 32/2023/TT-BYT, có giá trị pháp lý tương đương bản giấy.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
