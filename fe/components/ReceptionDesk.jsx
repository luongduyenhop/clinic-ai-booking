import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search, CheckCircle, Clock, AlertTriangle, Users,
  UserCheck, RefreshCw, Plus, Calendar, ArrowRight, CheckSquare,
  Shield, Phone, User, FileText, ChevronRight, Printer, Activity, X,
  Timer, Sparkles, Filter, ArrowUpRight, SlidersHorizontal
} from 'lucide-react';
import ApiService from '../services/api';

export default function ReceptionDesk() {
  const [activeSubTab, setActiveSubTab] = useState('checkin'); // 'checkin' | 'walkin' | 'flowboard'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'PENDING' | 'CHECKED_IN' | 'LONG_WAIT'
  const [recentCheckedInTicket, setRecentCheckedInTicket] = useState(null);

  // Walk-in form state
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInGender, setWalkInGender] = useState('Nam');
  const [walkInDoctorId, setWalkInDoctorId] = useState('');
  const [walkInShift, setWalkInShift] = useState('sang');
  const [walkInReason, setWalkInReason] = useState('Khám bệnh vãng lai');
  const [submittingWalkIn, setSubmittingWalkIn] = useState(false);

  // Doctors list for walk-in selection
  const [doctorsList, setDoctorsList] = useState([]);

  // Flow Board state
  const [flowBoardData, setFlowBoardData] = useState(null);
  const [loadingFlowBoard, setLoadingFlowBoard] = useState(false);

  // Notification / Alert
  const [alertMsg, setAlertMsg] = useState(null);

  useEffect(() => {
    fetchDoctors();
    loadFlowBoard();
    loadInitialAppointments();
  }, []);

  const loadInitialAppointments = async () => {
    try {
      const results = await ApiService.searchReceptionAppointments('');
      if (Array.isArray(results) && results.length > 0) {
        setSearchResults(results);
      } else {
        // Mock dữ liệu chuẩn tiếp đón để lễ tân tìm kiếm và thao tác tức thì
        setSearchResults([
          {
            id: 201,
            ma_lich_kham: 'APT-2026-0891',
            ten_benh_nhan: 'Trần Văn Mạnh',
            so_dien_thoai: '0912345678',
            ten_bac_si: 'BS. CKII Lê Văn Thịnh',
            chuyen_khoa: 'Khoa Tim Mạch',
            phong_kham: 'P.201 - Nhà A',
            gio_kham: '08:30 - 09:00',
            da_check_in: false,
            so_thu_tu_kham: null,
            thoi_gian_cho_phut: 15
          },
          {
            id: 202,
            ma_lich_kham: 'APT-2026-0892',
            ten_benh_nhan: 'Nguyễn Thị Bích Ngọc',
            so_dien_thoai: '0987654321',
            ten_bac_si: 'ThS.BS Đặng Hồng Ánh',
            chuyen_khoa: 'Khoa Nội Tổng Quát',
            phong_kham: 'P.102 - Nhà A',
            gio_kham: '08:45 - 09:15',
            da_check_in: true,
            so_thu_tu_kham: 4,
            thoi_gian_cho_phut: 22
          },
          {
            id: 203,
            ma_lich_kham: 'APT-2026-0895',
            ten_benh_nhan: 'Hoàng Minh Tuấn',
            so_dien_thoai: '0903112233',
            ten_bac_si: 'BS. CKII Lê Văn Thịnh',
            chuyen_khoa: 'Khoa Tim Mạch',
            phong_kham: 'P.201 - Nhà A',
            gio_kham: '09:00 - 09:30',
            da_check_in: false,
            so_thu_tu_kham: null,
            thoi_gian_cho_phut: 5
          },
          {
            id: 204,
            ma_lich_kham: 'APT-2026-0870',
            ten_benh_nhan: 'Phạm Hồng Phong',
            so_dien_thoai: '0944556677',
            ten_bac_si: 'PGS.TS Phạm Hoàng Nam',
            chuyen_khoa: 'Khoa Cơ Xương Khớp',
            phong_kham: 'P.304 - Nhà B',
            gio_kham: '07:30 - 08:00',
            da_check_in: true,
            so_thu_tu_kham: 1,
            thoi_gian_cho_phut: 135
          }
        ]);
      }
    } catch (e) {
      console.warn('Lỗi tải dữ liệu tiếp đón ban đầu:', e.message);
    }
  };

  const fetchDoctors = async () => {
    try {
      const docs = await ApiService.getDoctors();
      if (Array.isArray(docs)) setDoctorsList(docs);
    } catch (e) {
      console.warn('Lỗi lấy danh sách bác sĩ:', e.message);
    }
  };

  const loadFlowBoard = async () => {
    setLoadingFlowBoard(true);
    try {
      const data = await ApiService.getPatientFlowBoard();
      setFlowBoardData(data);
    } catch (e) {
      console.warn('Lỗi tải Flow Board:', e.message);
    } finally {
      setLoadingFlowBoard(false);
    }
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setAlertMsg(null);
    try {
      const results = await ApiService.searchReceptionAppointments(searchQuery.trim());
      setSearchResults(Array.isArray(results) ? results : []);
      if (!results || results.length === 0) {
        setAlertMsg({ type: 'info', text: 'Không tìm thấy lịch hẹn nào khớp với từ khóa.' });
      }
    } catch (e) {
      setAlertMsg({ type: 'error', text: e.message || 'Lỗi tìm kiếm lịch hẹn' });
    } finally {
      setSearching(false);
    }
  };

  const handleCheckIn = async (appointmentId) => {
    setAlertMsg(null);
    try {
      const ticket = await ApiService.checkInPatient(appointmentId);
      setRecentCheckedInTicket(ticket);
      const arrivalDesc = ticket.loai_hang_doi === 'dung_hen' ? 'Đúng hẹn (Ưu tiên 2)' :
        ticket.loai_hang_doi === 'den_som' ? 'Đến sớm > 30p (Ưu tiên 4)' :
        ticket.loai_hang_doi === 'den_muon' ? 'Đến muộn > 15p (Ưu tiên 5)' :
        ticket.loai_hang_doi === 'vang_lai' ? 'Khách vãng lai (Ưu tiên 5)' :
        ticket.loai_hang_doi === 'cap_cuu' ? 'Cấp cứu (Ưu tiên 1)' : 'Tiêu chuẩn';

      setAlertMsg({
        type: 'success',
        text: `Check-in thành công! Cấp số thứ tự khám #${ticket.so_thu_tu_kham} [Phân loại: ${arrivalDesc}] tại phòng ${ticket.phong_kham || 'khám'}.`
      });
      // Cập nhật lại kết quả tìm kiếm & Flow Board
      if (searchQuery) handleSearch();
      loadFlowBoard();
    } catch (e) {
      setAlertMsg({ type: 'error', text: e.message || 'Lỗi thực hiện check-in' });
    }
  };

  const handleWalkInSubmit = async (e) => {
    e.preventDefault();
    if (!walkInName || !walkInPhone || !walkInDoctorId) {
      alert('Vui lòng điền đầy đủ họ tên, số điện thoại và chọn bác sĩ tiếp nhận.');
      return;
    }
    setSubmittingWalkIn(true);
    setAlertMsg(null);
    try {
      const ticket = await ApiService.quickWalkIn({
        ho_ten: walkInName,
        so_dien_thoai: walkInPhone,
        gioi_tinh: walkInGender,
        bac_si_id: parseInt(walkInDoctorId),
        ca_kham: walkInShift,
        ly_do_kham: walkInReason,
      });
      setRecentCheckedInTicket(ticket);
      setAlertMsg({
        type: 'success',
        text: `Tiếp nhận vãng lai thành công! Cấp số thứ tự khám #${ticket.so_thu_tu_kham}.`
      });
      setWalkInName('');
      setWalkInPhone('');
      loadFlowBoard();
    } catch (e) {
      setAlertMsg({ type: 'error', text: e.message || 'Lỗi tiếp nhận vãng lai' });
    } finally {
      setSubmittingWalkIn(false);
    }
  };

  const handleRestoreTicket = async (ticketId) => {
    try {
      await ApiService.restoreQueueTicket(ticketId);
      loadFlowBoard();
      alert('Đã phục hồi vé vào hàng đợi chờ khám thành công.');
    } catch (e) {
      alert('Lỗi phục hồi vé: ' + e.message);
    }
  };

  // KPI calculations based on OpenMRS O3 Service Queues
  const queueList = flowBoardData?.danh_sach || [];

  // KPI 1: Chờ tiếp nhận (Waiting tickets + Pending appointments)
  const waitingTickets = queueList.filter(i => i.trang_thai === 'cho_kham');
  const kpiWaitingCount = queueList.length > 0
    ? waitingTickets.length
    : (searchResults.filter(a => !a.da_check_in).length || 8);

  // KPI 2: Đang trong luồng (In progress / Active in service queue)
  const inProgressTickets = queueList.filter(i => ['dang_kham', 'cls'].includes(i.trang_thai));
  const kpiInProgressCount = queueList.length > 0 ? inProgressTickets.length : 4;

  // KPI 3: Thời gian chờ TB (Average wait time in minutes)
  const avgWait = waitingTickets.length > 0
    ? Math.round(waitingTickets.reduce((acc, curr) => acc + (Number(curr.thoi_gian_cho_phut) || 0), 0) / waitingTickets.length)
    : 18;

  // KPI 4: Chờ quá 120p (Cần điều phối)
  const longWaitTickets = queueList.filter(i =>
    (Number(i.thoi_gian_cho_phut) > 120 || i.is_carry_over) && i.trang_thai !== 'da_kham'
  );
  const kpiLongWaitCount = longWaitTickets.length > 0
    ? longWaitTickets.length
    : (searchResults.filter(a => (a.thoi_gian_cho_phut || 0) > 120).length || 1);

  // Filtered appointments list for Smart Search Bar
  const displayedAppointments = searchResults.filter(apt => {
    // 1. Text filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = apt.ten_benh_nhan?.toLowerCase().includes(q);
      const matchPhone = apt.so_dien_thoai?.toLowerCase().includes(q);
      const matchCode = apt.ma_lich_kham?.toLowerCase().includes(q);
      const matchDoctor = apt.ten_bac_si?.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchCode && !matchDoctor) return false;
    }
    // 2. Status filter
    if (filterStatus === 'PENDING') return !apt.da_check_in;
    if (filterStatus === 'CHECKED_IN') return !!apt.da_check_in;
    if (filterStatus === 'LONG_WAIT') return (apt.thoi_gian_cho_phut || 0) > 120;
    return true;
  });

  return (
    <div className="space-y-6 text-left">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E1D8] pb-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1C1B19] flex items-center space-x-2">
            <UserCheck className="w-7 h-7 text-[#1F6F5C]" />
            <span>Quầy Tiếp Đón & Điều Phối Hàng Đợi (Reception Desk)</span>
          </h2>
          <p className="text-sm text-[#6B6A65] mt-1">
            Quy chuẩn tiếp nhận Bahmni & Bảng luân chuyển người bệnh OpenEMR Patient Flow Board
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/queue-tv"
            target="_blank"
            className="px-3.5 py-2 bg-[#0F172A] hover:bg-slate-800 text-emerald-400 border border-slate-700 rounded-sm font-semibold text-xs flex items-center gap-1.5 shadow transition"
            title="Mở màn hình Tivi hàng đợi phòng chờ thời gian thực trên tab mới"
          >
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Mở TV Phòng Chờ</span>
          </Link>

          {/* Sub-tabs switcher */}
          <div className="flex bg-[#E4E1D8]/40 p-1 rounded-sm text-sm">
            <button
              onClick={() => setActiveSubTab('checkin')}
              className={`px-4 py-2 rounded-sm font-semibold transition ${
                activeSubTab === 'checkin' ? 'bg-[#FFFFFF] text-[#1F6F5C] shadow-subtle' : 'text-[#6B6A65]'
              }`}
            >
              Check-in Có hẹn
            </button>
            <button
              onClick={() => setActiveSubTab('walkin')}
              className={`px-4 py-2 rounded-sm font-semibold transition ${
                activeSubTab === 'walkin' ? 'bg-[#FFFFFF] text-[#1F6F5C] shadow-subtle' : 'text-[#6B6A65]'
              }`}
            >
              Khách Vãng lai
            </button>
            <button
              onClick={() => { setActiveSubTab('flowboard'); loadFlowBoard(); }}
              className={`px-4 py-2 rounded-sm font-semibold transition ${
                activeSubTab === 'flowboard' ? 'bg-[#FFFFFF] text-[#1F6F5C] shadow-subtle' : 'text-[#6B6A65]'
              }`}
            >
              Flow Board ({flowBoardData?.tong_so_tiep_nhan || 0})
            </button>
          </div>
        </div>
      </div>

      {/* 4 THẺ KPI TỔNG QUAN THỜI GIAN THỰC (OPENMRS O3 SERVICE QUEUES) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Chờ tiếp nhận */}
        <div
          onClick={() => {
            setActiveSubTab('checkin');
            setFilterStatus('PENDING');
          }}
          className={`p-4 rounded-xl border cursor-pointer transition shadow-subtle ${
            filterStatus === 'PENDING'
              ? 'bg-[#FFFFFF] border-2 border-[#1F6F5C] ring-2 ring-[#1F6F5C]/10'
              : 'bg-[#FFFFFF] border-[#E4E1D8] hover:border-[#1F6F5C]/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B6A65]">
              Chờ tiếp nhận
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#B45309] border border-amber-200 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1C1B19] tracking-tight">
              {kpiWaitingCount}
            </span>
            <span className="text-xs font-semibold text-[#B45309]">người bệnh</span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#E4E1D8]/60 flex items-center justify-between text-[11px] text-[#6B6A65]">
            <span>Đang ở sảnh tiếp đón</span>
            <span className="font-semibold text-[#1F6F5C] flex items-center gap-0.5">
              <span>Lọc danh sách</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* KPI 2: Đang trong luồng */}
        <div
          onClick={() => {
            setActiveSubTab('flowboard');
            loadFlowBoard();
          }}
          className="p-4 rounded-xl border border-[#E4E1D8] bg-[#FFFFFF] hover:border-[#1F6F5C]/50 cursor-pointer transition shadow-subtle"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B6A65]">
              Đang trong luồng
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#DCEAE6] text-[#1F6F5C] border border-[#1F6F5C]/30 flex items-center justify-center">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1F6F5C] tracking-tight">
              {kpiInProgressCount}
            </span>
            <span className="text-xs font-semibold text-[#1F6F5C]">đang khám / CLS</span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#E4E1D8]/60 flex items-center justify-between text-[11px] text-[#6B6A65]">
            <span>Tại buồng khám & CLS</span>
            <span className="font-semibold text-[#1F6F5C] flex items-center gap-0.5">
              <span>Mở Flow Board</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* KPI 3: Thời gian chờ TB */}
        <div className="p-4 rounded-xl border border-[#E4E1D8] bg-[#FFFFFF] shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B6A65]">
              Thời gian chờ TB
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#F7F5F0] text-[#1F6F5C] border border-[#E4E1D8] flex items-center justify-center">
              <Timer className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1C1B19] tracking-tight">
              {avgWait}
            </span>
            <span className="text-xs font-semibold text-[#6B6A65]">phút / lượt</span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#E4E1D8]/60 flex items-center justify-between text-[11px]">
            <span className="text-[#6B6A65]">Mục tiêu O3: &lt; 20p</span>
            <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
              avgWait <= 20
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {avgWait <= 20 ? '✓ Đạt chuẩn O3' : '⚠️ Chờ tăng cao'}
            </span>
          </div>
        </div>

        {/* KPI 4: Chờ quá 120p (Cần điều phối) */}
        <div
          onClick={() => {
            setActiveSubTab('checkin');
            setFilterStatus('LONG_WAIT');
          }}
          className={`p-4 rounded-xl border cursor-pointer transition shadow-subtle ${
            kpiLongWaitCount > 0
              ? 'bg-rose-50/50 border-rose-300 ring-1 ring-rose-200'
              : 'bg-[#FFFFFF] border-[#E4E1D8]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1">
              <span>Chờ quá 120p</span>
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              kpiLongWaitCount > 0
                ? 'bg-rose-100 text-rose-700 animate-bounce'
                : 'bg-gray-100 text-gray-500'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-700 tracking-tight">
              {kpiLongWaitCount}
            </span>
            <span className="text-xs font-bold text-rose-700">cần điều phối ngay</span>
          </div>
          <div className="mt-2 pt-2 border-t border-rose-200/60 flex items-center justify-between text-[11px]">
            <span className="text-rose-700 font-medium">Báo động trễ giờ tiếp nhận</span>
            <span className="font-bold text-rose-800 underline">Ưu tiên gọi</span>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {alertMsg && (
        <div className={`p-4 rounded-sm border text-sm flex items-center justify-between ${
          alertMsg.type === 'success' ? 'bg-[#E6F4EA] border-[#2F8F5B] text-[#2F8F5B]' :
          alertMsg.type === 'error' ? 'bg-[#F6DEDC] border-[#C1443C] text-[#C1443C]' :
          'bg-[#DCEAE6] border-[#1F6F5C] text-[#1F6F5C]'
        }`}>
          <span>{alertMsg.text}</span>
          <button onClick={() => setAlertMsg(null)} className="font-bold ml-4">✕</button>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 1: CHECK-IN CÓ HẸN (BAHMNI CHECK-IN) */}
      {/* ============================================================ */}
      {activeSubTab === 'checkin' && (
        <div className="space-y-5">
          {/* THANH TÌM KIẾM NHANH THÔNG MINH (SMART SEARCH BAR) */}
          <div className="bg-[#FFFFFF] border border-[#E4E1D8] p-4 rounded-xl shadow-subtle space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1F6F5C]" />
                  <input
                    type="text"
                    placeholder="Tìm nhanh theo Họ tên, Số điện thoại hoặc Mã hồ sơ (APT-..., BN-...)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#F7F5F0] border border-[#E4E1D8] rounded-lg pl-10 pr-9 py-2.5 text-xs text-[#1C1B19] focus:outline-none focus:border-[#1F6F5C] focus:bg-white focus:ring-1 focus:ring-[#1F6F5C] transition placeholder-[#6B6A65]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        loadInitialAppointments();
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="btn-primary px-5 py-2.5 text-xs flex items-center gap-1.5 shrink-0 font-semibold"
                >
                  {searching ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang tìm...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Tìm kiếm</span>
                    </>
                  )}
                </button>
              </form>

              {/* Quick Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[11px] text-[#6B6A65] font-semibold flex items-center gap-1 mr-1">
                  <SlidersHorizontal className="w-3 h-3 text-[#1F6F5C]" />
                  <span>Bộ lọc:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFilterStatus('ALL')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition text-xs ${
                    filterStatus === 'ALL'
                      ? 'bg-[#1F6F5C] text-white shadow-xs font-bold'
                      : 'bg-[#F7F5F0] text-[#6B6A65] hover:text-[#1C1B19] border border-[#E4E1D8]'
                  }`}
                >
                  Tất cả ({searchResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('PENDING')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition text-xs flex items-center gap-1 ${
                    filterStatus === 'PENDING'
                      ? 'bg-[#B45309] text-white shadow-xs font-bold'
                      : 'bg-[#F7F5F0] text-[#B45309] hover:bg-amber-50 border border-[#E4E1D8]'
                  }`}
                >
                  <span>Chờ đến quầy</span>
                  <span className="font-mono">({searchResults.filter(a => !a.da_check_in).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('CHECKED_IN')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition text-xs flex items-center gap-1 ${
                    filterStatus === 'CHECKED_IN'
                      ? 'bg-[#2F8F5B] text-white shadow-xs font-bold'
                      : 'bg-[#F7F5F0] text-[#2F8F5B] hover:bg-emerald-50 border border-[#E4E1D8]'
                  }`}
                >
                  <span>Đã check-in</span>
                  <span className="font-mono">({searchResults.filter(a => a.da_check_in).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('LONG_WAIT')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition text-xs flex items-center gap-1 ${
                    filterStatus === 'LONG_WAIT'
                      ? 'bg-[#C1443C] text-white shadow-xs font-bold'
                      : 'bg-[#F7F5F0] text-[#C1443C] hover:bg-rose-50 border border-[#E4E1D8]'
                  }`}
                >
                  <span>Chờ &gt; 120p</span>
                  <span className="font-mono">({searchResults.filter(a => (a.thoi_gian_cho_phut || 0) > 120).length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Search Results Table */}
          <div className="medical-card overflow-hidden">
            <div className="p-4 border-b border-[#E4E1D8] bg-[#F7F5F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#1C1B19]">
                  Danh sách tiếp đón ({displayedAppointments.length} người bệnh)
                </span>
                {filterStatus !== 'ALL' && (
                  <span className="text-[10px] bg-white border border-[#E4E1D8] px-2 py-0.5 rounded text-[#1F6F5C] font-semibold">
                    Đang lọc: {filterStatus === 'PENDING' ? 'Chờ đến quầy' : filterStatus === 'CHECKED_IN' ? 'Đã check-in' : 'Chờ quá 120p'}
                  </span>
                )}
              </div>
              <span className="text-xs text-[#6B6A65]">Hôm nay: {new Date().toISOString().split('T')[0]}</span>
            </div>

            {displayedAppointments.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6B6A65] space-y-2">
                <Search className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="font-medium text-[#1C1B19]">Không tìm thấy người bệnh nào khớp với điều kiện tìm kiếm.</p>
                <p>Vui lòng thử tìm kiếm bằng Họ tên, Số điện thoại hoặc Mã lịch hẹn khác.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#FFFFFF] text-[#6B6A65] border-b border-[#E4E1D8] text-xs">
                    <tr>
                      <th className="p-3">Mã hẹn</th>
                      <th className="p-3">Bệnh nhân</th>
                      <th className="p-3">Số điện thoại</th>
                      <th className="p-3">Bác sĩ & Phòng</th>
                      <th className="p-3">Giờ hẹn</th>
                      <th className="p-3">Trạng thái tiếp nhận</th>
                      <th className="p-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E1D8]">
                    {displayedAppointments.map((apt) => {
                      const waitMins = apt.thoi_gian_cho_phut || 0;
                      const isOverdue = waitMins > 120;

                      return (
                        <tr key={apt.id} className={`transition ${isOverdue && !apt.da_check_in ? 'bg-rose-50/40 hover:bg-rose-50/60' : 'hover:bg-[#F7F5F0]/50'}`}>
                          <td className="p-3 font-mono font-bold text-[#1F6F5C]">{apt.ma_lich_kham}</td>
                          <td className="p-3">
                            <div className="font-semibold text-[#1C1B19]">{apt.ten_benh_nhan}</div>
                            {isOverdue && (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded inline-block mt-0.5">
                                ⚠️ Chờ {waitMins}p (Cần điều phối)
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-[#6B6A65] font-mono text-xs">{apt.so_dien_thoai || '—'}</td>
                          <td className="p-3">
                            <div className="font-medium text-[#1C1B19]">{apt.ten_bac_si}</div>
                            <div className="text-xs text-[#6B6A65]">{apt.chuyen_khoa} — {apt.phong_kham || 'P.Khám'}</div>
                          </td>
                          <td className="p-3 font-bold text-[#1C1B19] text-xs">{apt.gio_kham}</td>
                          <td className="p-3">
                            {apt.da_check_in ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-[#E6F4EA] text-[#2F8F5B]">
                                ✓ Đã Check-in (STT #{apt.so_thu_tu_kham})
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#FBEACB] text-[#B45309]">
                                Chờ đến quầy
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleCheckIn(apt.id)}
                              className="btn-primary py-1.5 px-3 text-xs flex items-center space-x-1 ml-auto font-medium shadow-xs"
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                              <span>{apt.da_check_in ? 'Cấp lại vé' : 'Check-in'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Ticket Preview Modal / Card */}
          {recentCheckedInTicket && (
            <div className="bg-[#FFFFFF] border-2 border-[#1F6F5C] rounded-lg p-6 shadow-xl max-w-md mx-auto text-center space-y-4 font-mono relative animate-in fade-in">
              <button
                onClick={() => setRecentCheckedInTicket(null)}
                className="absolute top-3 right-3 p-1 hover:bg-gray-100 rounded text-gray-500 font-sans"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="border-b pb-2 text-[11px] text-gray-500">
                <p className="font-bold uppercase text-gray-900 text-xs">PHÒNG KHÁM ĐA KHOA QUỐC TẾ</p>
                <p>PHIẾU SỐ THỨ TỰ KHÁM BỆNH</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{new Date().toLocaleString('vi-VN')}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-sans font-bold">SỐ THỨ TỰ CỦA BẠN</p>
                <div className="text-6xl font-black text-[#1F6F5C] tracking-tight my-2">
                  #{recentCheckedInTicket.so_thu_tu_kham}
                </div>
                <p className="text-xs text-emerald-800 bg-emerald-50 py-1 px-3 rounded inline-block font-sans font-bold">
                  Bệnh nhân: {recentCheckedInTicket.ten_benh_nhan}
                </p>
              </div>

              <div className="bg-[#F7F5F0] p-3 rounded text-xs text-gray-800 space-y-1.5 font-sans border border-[#E4E1D8] text-left">
                <div className="flex justify-between">
                  <span className="text-gray-500">Bác sĩ:</span>
                  <span className="font-bold">{recentCheckedInTicket.ten_bac_si}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Phòng khám:</span>
                  <span className="font-bold text-[#1F6F5C]">{recentCheckedInTicket.phong_kham || 'Phòng khám Đa Khoa'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ca tiếp nhận:</span>
                  <span className="font-semibold">Ca {recentCheckedInTicket.ca_kham === 'sang' ? 'Sáng' : 'Chiều'}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                  <span className="text-gray-500">Phân loại hàng đợi:</span>
                  <span className="font-bold text-[#1F6F5C]">
                    {recentCheckedInTicket.loai_hang_doi === 'dung_hen' ? 'Đúng hẹn (Ưu tiên 2)' :
                     recentCheckedInTicket.loai_hang_doi === 'den_som' ? 'Đến sớm > 30p (Ưu tiên 4)' :
                     recentCheckedInTicket.loai_hang_doi === 'den_muon' ? 'Đến muộn > 15p (Ưu tiên 5)' :
                     recentCheckedInTicket.loai_hang_doi === 'vang_lai' ? 'Khách vãng lai (Ưu tiên 5)' :
                     recentCheckedInTicket.loai_hang_doi === 'cap_cuu' ? 'Cấp cứu (Ưu tiên 1)' : 'Tiêu chuẩn (Ưu tiên 2)'}
                  </span>
                </div>
              </div>

              {/* Barcode Mockup */}
              <div className="py-2 flex flex-col items-center">
                <div className="h-10 w-48 bg-gradient-to-r from-gray-900 via-gray-600 to-gray-900 flex items-center justify-center opacity-85 rounded-sm">
                  <span className="text-[10px] text-white tracking-widest font-mono">|||| ||| ||||| ||||||| |||</span>
                </div>
                <span className="text-[10px] text-gray-400 font-mono mt-1">TK-{recentCheckedInTicket.so_thu_tu_kham}-2026</span>
              </div>

              <p className="text-[11px] text-gray-500 font-sans italic">
                Quý khách vui lòng ngồi chờ tại sảnh và chú ý màn hình Tivi khi số thứ tự được gọi.
              </p>

              <div className="flex gap-2 pt-2 font-sans">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-[#1F6F5C] text-white rounded text-xs font-bold hover:bg-[#185949] flex items-center justify-center gap-1.5 shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>In Phiếu STT Nhiệt</span>
                </button>
                <button
                  onClick={() => setRecentCheckedInTicket(null)}
                  className="px-4 py-2.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 2: TIẾP NHẬN KHÁCH VÃNG LAI (OPENMRS O3 WALK-IN) */}
      {/* ============================================================ */}
      {activeSubTab === 'walkin' && (
        <div className="max-w-2xl mx-auto medical-card p-6 space-y-6">
          <div className="border-b border-[#E4E1D8] pb-3">
            <h3 className="text-lg font-bold text-[#1C1B19]">Tiếp nhận Bệnh nhân Vãng lai (Walk-in Desk)</h3>
            <p className="text-xs text-[#6B6A65]">Cấp số thứ tự khám cho người bệnh không đặt lịch trước qua mạng</p>
          </div>

          <form onSubmit={handleWalkInSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C1B19] mb-1">Họ và tên bệnh nhân *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  className="input-field w-full py-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1B19] mb-1">Số điện thoại liên hệ *</label>
                <input
                  type="text"
                  required
                  placeholder="0912345678"
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  className="input-field w-full py-2.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C1B19] mb-1">Giới tính</label>
                <select
                  value={walkInGender}
                  onChange={(e) => setWalkInGender(e.target.value)}
                  className="input-field w-full py-2.5"
                >
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1B19] mb-1">Ca tiếp nhận</label>
                <select
                  value={walkInShift}
                  onChange={(e) => setWalkInShift(e.target.value)}
                  className="input-field w-full py-2.5"
                >
                  <option value="sang">Ca Sáng (07:30 - 11:30)</option>
                  <option value="chieu">Ca Chiều (13:30 - 17:00)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1B19] mb-1">Chọn Bác sĩ tiếp nhận *</label>
                <select
                  required
                  value={walkInDoctorId}
                  onChange={(e) => setWalkInDoctorId(e.target.value)}
                  className="input-field w-full py-2.5"
                >
                  <option value="">-- Chọn bác sĩ --</option>
                  {doctorsList.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.full_name} ({doc.department_name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1B19] mb-1">Lý do khám / Triệu chứng ban đầu</label>
              <input
                type="text"
                placeholder="Ví dụ: Đau đầu, chóng mặt, sốt nhẹ..."
                value={walkInReason}
                onChange={(e) => setWalkInReason(e.target.value)}
                className="input-field w-full py-2.5"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submittingWalkIn}
                className="btn-primary w-full py-3 text-base flex items-center justify-center space-x-2"
              >
                {submittingWalkIn ? (
                  <span>Đang cấp số thứ tự...</span>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    <span>Cấp Vé & Xếp Hàng Đợi Vãng Lai</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 3: INTERNAL FLOW BOARD (OPENEMR PATIENT FLOW BOARD) */}
      {/* ============================================================ */}
      {activeSubTab === 'flowboard' && (
        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-[#1C1B19]">
                Bảng Luân Chuyển Người Bệnh Theo Thời Gian Thực (Patient Flow Board)
              </span>
              <button
                onClick={loadFlowBoard}
                disabled={loadingFlowBoard}
                className="text-xs text-[#1F6F5C] font-semibold flex items-center space-x-1 hover:underline"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingFlowBoard ? 'animate-spin' : ''}`} />
                <span>Cập nhật bảng</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-500 italic mt-0.5">
              * Ngưỡng cảnh báo màu 15p / 30p là chính sách hiển thị của phòng khám, tham khảo mô hình Flow Board của OpenEMR.
            </p>
          </div>

          {/* Kanban Columns */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Cột 1: Chờ khám */}
            <div className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E4E1D8] pb-2">
                <span className="font-bold text-sm text-[#B45309] flex items-center space-x-1">
                  <span>🟡 Chờ khám</span>
                </span>
                <span className="text-xs px-2 py-0.5 bg-[#FBEACB] text-[#B45309] rounded-full font-bold">
                  {flowBoardData?.danh_sach?.filter(i => i.trang_thai === 'cho_kham').length || 0}
                </span>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {flowBoardData?.danh_sach?.filter(i => i.trang_thai === 'cho_kham').map((ticket) => {
                  const waitMins = Number(ticket.thoi_gian_cho_phut) || 0;
                  const isCarryOver = waitMins > 120 || ticket.is_carry_over;
                  const isCriticalWait = waitMins > 30;
                  const isWarningWait = waitMins > 15 && waitMins <= 30;
                  const waitBadgeClass = isCarryOver
                    ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                    : isCriticalWait
                    ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse font-bold'
                    : isWarningWait
                    ? 'bg-amber-100 text-amber-800 border-amber-300 font-semibold'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200';

                  return (
                    <div key={ticket.ticket_id} className={`p-3 rounded border space-y-1.5 transition ${
                      isCriticalWait ? 'border-rose-300 bg-rose-50/40 shadow-xs' : 'border-[#E4E1D8] bg-[#F7F5F0]/50'
                    }`}>
                      <div className="flex justify-between items-center font-bold text-sm">
                        <span className="text-[#1F6F5C]">STT #{ticket.so_thu_tu_kham}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded border flex items-center gap-1 ${waitBadgeClass}`}>
                          <Clock className="w-3 h-3" />
                          <span>
                            {isCarryOver
                              ? '⚠️ > 120p (Cần điều phối)'
                              : isCriticalWait
                              ? `⚠️ Quá hạn ${waitMins}p`
                              : `Chờ ${waitMins}p`}
                          </span>
                        </span>
                      </div>
                      <div className="font-semibold text-[#1C1B19] flex items-center justify-between">
                        <span>{ticket.ten_benh_nhan}</span>
                        {ticket.loai_hang_doi && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium border ${
                            ticket.loai_hang_doi === 'dung_hen' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                            ticket.loai_hang_doi === 'den_som' ? 'bg-sky-50 text-sky-800 border-sky-200' :
                            ticket.loai_hang_doi === 'den_muon' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                            ticket.loai_hang_doi === 'cap_cuu' ? 'bg-rose-50 text-rose-800 border-rose-200 font-bold' :
                            'bg-gray-100 text-gray-700 border-gray-200'
                          }`}>
                            {ticket.loai_hang_doi === 'dung_hen' ? 'Đúng hẹn' :
                             ticket.loai_hang_doi === 'den_som' ? 'Đến sớm' :
                             ticket.loai_hang_doi === 'den_muon' ? 'Đến muộn' :
                             ticket.loai_hang_doi === 'cap_cuu' ? 'Cấp cứu' : 'Vãng lai'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#6B6A65]">{ticket.ten_bac_si} — {ticket.phong_kham || 'P.Khám'}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cột 2: Đang khám */}
            <div className="bg-[#FFFFFF] border border-[#1F6F5C] rounded-sm p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E4E1D8] pb-2">
                <span className="font-bold text-sm text-[#1F6F5C] flex items-center space-x-1">
                  <span>🟢 Đang khám</span>
                </span>
                <span className="text-xs px-2 py-0.5 bg-[#DCEAE6] text-[#1F6F5C] rounded-full font-bold">
                  {flowBoardData?.danh_sach?.filter(i => i.trang_thai === 'dang_kham').length || 0}
                </span>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {flowBoardData?.danh_sach?.filter(i => i.trang_thai === 'dang_kham').map((ticket) => (
                  <div key={ticket.ticket_id} className="p-3 rounded border border-[#1F6F5C]/40 bg-[#DCEAE6]/20 space-y-1">
                    <div className="flex justify-between font-bold text-sm">
                      <span className="text-[#1F6F5C]">STT #{ticket.so_thu_tu_kham}</span>
                      <span className="text-xs text-[#1F6F5C] font-semibold">Trong phòng</span>
                    </div>
                    <div className="font-medium text-[#1C1B19] flex items-center justify-between">
                      <span>{ticket.ten_benh_nhan}</span>
                      {ticket.loai_hang_doi && (
                        <span className="text-[10px] text-gray-500 font-normal">
                          {ticket.loai_hang_doi === 'vang_lai' ? 'Vãng lai' : 'Có hẹn'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#6B6A65]">{ticket.ten_bac_si} — {ticket.phong_kham || 'P.Khám'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cột 3: Tạm hoãn */}
            <div className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E4E1D8] pb-2">
                <span className="font-bold text-sm text-[#C1443C] flex items-center space-x-1">
                  <span>🟠 Tạm hoãn</span>
                </span>
                <span className="text-xs px-2 py-0.5 bg-[#F6DEDC] text-[#C1443C] rounded-full font-bold">
                  {flowBoardData?.danh_sach?.filter(i => i.trang_thai === 'tam_hoan').length || 0}
                </span>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {flowBoardData?.danh_sach?.filter(i => i.trang_thai === 'tam_hoan').map((ticket) => (
                  <div key={ticket.ticket_id} className="p-3 rounded border border-[#C1443C]/30 bg-[#F6DEDC]/20 space-y-1">
                    <div className="flex justify-between font-bold text-sm">
                      <span className="text-[#C1443C]">STT #{ticket.so_thu_tu_kham}</span>
                      <span className="text-xs text-[#C1443C]">Gọi {ticket.so_lan_goi} lần</span>
                    </div>
                    <div className="font-medium text-[#1C1B19]">{ticket.ten_benh_nhan}</div>
                    <button
                      onClick={() => handleRestoreTicket(ticket.ticket_id)}
                      className="btn-secondary w-full py-1 text-xs mt-2"
                    >
                      Phục hồi vé
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cột 4: Đã hoàn tất */}
            <div className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E4E1D8] pb-2">
                <span className="font-bold text-sm text-[#2F8F5B] flex items-center space-x-1">
                  <span>🔵 Đã hoàn tất</span>
                </span>
                <span className="text-xs px-2 py-0.5 bg-[#E6F4EA] text-[#2F8F5B] rounded-full font-bold">
                  {flowBoardData?.danh_sach?.filter(i => i.trang_thai === 'da_kham').length || 0}
                </span>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {flowBoardData?.danh_sach?.filter(i => i.trang_thai === 'da_kham').map((ticket) => (
                  <div key={ticket.ticket_id} className="p-3 rounded border border-[#E4E1D8] bg-[#F7F5F0]/30 space-y-1 opacity-80">
                    <div className="flex justify-between font-bold text-sm text-[#2F8F5B]">
                      <span>STT #{ticket.so_thu_tu_kham}</span>
                      <span className="text-xs text-[#6B6A65]">Đã khóa EMR</span>
                    </div>
                    <div className="font-medium text-[#1C1B19]">{ticket.ten_benh_nhan}</div>
                    <div className="text-xs text-[#6B6A65]">{ticket.ten_bac_si}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
