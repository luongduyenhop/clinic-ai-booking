import React, { useState, useEffect } from 'react';
import {
  Users, Calendar, Clock, DollarSign, Plus, CheckCircle,
  AlertTriangle, Lock, Unlock, RefreshCw, Stethoscope, FileText,
  Activity, Shield, ChevronRight, X, AlertCircle, ArrowRight,
  UserCheck, Trash2, CheckSquare, Edit3
} from 'lucide-react';
import ApiService from '../services/api';

export default function AdminPortal() {
  const [adminSubTab, setAdminSubTab] = useState('dashboard'); // 'dashboard' | 'doctors' | 'shifts' | 'services' | 'amendments'

  // Live Stats State
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Medical Amendments State (Four-Eyes Approval)
  const [amendments, setAmendments] = useState([]);
  const [loadingAmendments, setLoadingAmendments] = useState(false);
  const [decisionNote, setDecisionNote] = useState('');
  const [processingAmendmentId, setProcessingAmendmentId] = useState(null);

  // Process Unconfirmed Appointments State
  const [cleaningWaitlist, setCleaningWaitlist] = useState(false);
  const [cleanResult, setCleanResult] = useState(null);

  // Doctors Management State
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [isAddDoctorModalOpen, setIsAddDoctorModalOpen] = useState(false);
  const [newDoctorForm, setNewDoctorForm] = useState({
    ho_ten: '',
    email: '',
    so_dien_thoai: '',
    mat_khau: 'Doctor@123456',
    chuyen_khoa_id: 1,
    hoc_vi: 'BS.CKI',
    chung_chi_hanh_nghe: '',
    nam_kinh_nghiem: 5,
    gia_kham_mac_dinh: 300000,
    mo_ta_chuyen_sau: '',
  });

  // Shifts Management State (OpenEMR 7 Calendar)
  const [shifts, setShifts] = useState([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [selectedShiftDate, setSelectedShiftDate] = useState(new Date().toISOString().split('T')[0]);
  const [newShiftForm, setNewShiftForm] = useState({
    bac_si_id: '',
    ngay_lam_viec: new Date().toISOString().split('T')[0],
    ca_lam_viec: 'sang',
    gioi_han_ca_kham: 8,
  });

  // Emergency Leave & Reassign State
  const [emergencyModalShift, setEmergencyModalShift] = useState(null);
  const [emergencyTab, setEmergencyTab] = useState('declare'); // 'declare' | 'reassign'
  const [emergencyReason, setEmergencyReason] = useState('Bác sĩ bận việc đột xuất');
  const [emergencyNote, setEmergencyNote] = useState('');
  const [emergencySummary, setEmergencySummary] = useState(null);
  const [selectedSubDoctorId, setSelectedSubDoctorId] = useState('');
  const [reassignNote, setReassignNote] = useState('Điều phối bác sĩ thay thế cùng ca');
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyFeedback, setEmergencyFeedback] = useState(null);

  // Services Management State
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [newServiceForm, setNewServiceForm] = useState({
    ma_dich_vu: '',
    ten_dich_vu: '',
    don_gia: 200000,
    don_vi_tinh: 'Lần',
  });

  // Specialties
  const [departments, setDepartments] = useState([]);

  // Current Authenticated User for RBAC
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadDashboardStats();
    loadDepartments();
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setCurrentUser(u);
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (adminSubTab === 'doctors' || adminSubTab === 'shifts') loadDoctors();
    if (adminSubTab === 'shifts') loadShifts();
    if (adminSubTab === 'services') loadServices();
    if (adminSubTab === 'amendments') loadAmendments();
  }, [adminSubTab, selectedShiftDate]);

  const loadDashboardStats = async () => {
    setLoadingStats(true);
    try {
      const data = await ApiService.getAdminDashboardStats();
      setStats(data);
    } catch (e) {
      console.warn('Lỗi lấy thống kê admin:', e.message);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const depts = await ApiService.getDepartments();
      if (Array.isArray(depts)) setDepartments(depts);
    } catch (e) {}
  };

  const loadDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const docs = await ApiService.getAdminDoctors();
      if (Array.isArray(docs)) setDoctors(docs);
    } catch (e) {
      console.warn('Lỗi tải danh sách bác sĩ:', e.message);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const loadShifts = async () => {
    setLoadingShifts(true);
    try {
      const shs = await ApiService.getAdminShifts(selectedShiftDate);
      if (Array.isArray(shs)) setShifts(shs);
    } catch (e) {
      console.warn('Lỗi tải ca trực:', e.message);
    } finally {
      setLoadingShifts(false);
    }
  };

  const loadServices = async () => {
    setLoadingServices(true);
    try {
      const svcs = await ApiService.getAdminServices();
      if (Array.isArray(svcs)) setServices(svcs);
    } catch (e) {
      console.warn('Lỗi tải dịch vụ:', e.message);
    } finally {
      setLoadingServices(false);
    }
  };

  const loadAmendments = async () => {
    setLoadingAmendments(true);
    try {
      let res = await ApiService.getMedicalAmendments(136);
      if (!Array.isArray(res) || res.length === 0) {
        res = await ApiService.getMedicalAmendments(1);
      }
      if (Array.isArray(res)) setAmendments(res);
    } catch (e) {
      setAmendments([
        {
          id: 701,
          luot_kham_id: 103,
          bac_si_name: 'BS. CKII Lê Minh Tuấn',
          thuc_the_loai: 'DON_THUOC',
          ly_do_text: 'Bệnh nhân có phản ứng phù mắt cá chân với Amlodipine 5mg, xin đổi sang Losartan 50mg.',
          noi_dung_moi_json: { thuoc_thay_the: 'Losartan 50mg x 30 viên', cach_dung: '1 viên sáng sau ăn' },
          trang_thai: 'CHO_PHE_DUYET',
          created_at: '2026-10-05 10:15'
        },
        {
          id: 702,
          luot_kham_id: 104,
          bac_si_name: 'BS. CKI Phạm Thu Hà',
          thuc_the_loai: 'CHAN_DOAN',
          ly_do_text: 'Bổ sung chẩn đoán xác định sau khi có kết quả xét nghiệm máu Glucose tăng cao.',
          noi_dung_moi_json: { chan_doan_moi: 'Đái tháo đường type 2 (Mã ICD: E11)', loai: 'Phụ' },
          trang_thai: 'CHO_PHE_DUYET',
          created_at: '2026-10-05 11:30'
        }
      ]);
    } finally {
      setLoadingAmendments(false);
    }
  };

  const handleApproveAmendment = async (amendmentId) => {
    setProcessingAmendmentId(amendmentId);
    try {
      await ApiService.approveMedicalAmendment(amendmentId, decisionNote || 'Đã kiểm tra hồ sơ lâm sàng và phê duyệt đính chính.');
      alert('Đã phê duyệt đính chính bệnh án thành công (Four-Eyes Principle)!');
      setAmendments(amendments.map(a => a.id === amendmentId ? { ...a, trang_thai: 'DA_PHE_DUYET' } : a));
      setDecisionNote('');
    } catch (e) {
      alert('Lỗi phê duyệt: ' + e.message);
    } finally {
      setProcessingAmendmentId(null);
    }
  };

  const handleRejectAmendment = async (amendmentId) => {
    const reason = decisionNote || prompt('Nhập lý do từ chối đính chính:');
    if (!reason) return;
    setProcessingAmendmentId(amendmentId);
    try {
      await ApiService.rejectMedicalAmendment(amendmentId, reason);
      alert('Đã từ chối yêu cầu đính chính.');
      setAmendments(amendments.map(a => a.id === amendmentId ? { ...a, trang_thai: 'TU_CHOI' } : a));
      setDecisionNote('');
    } catch (e) {
      alert('Lỗi từ chối: ' + e.message);
    } finally {
      setProcessingAmendmentId(null);
    }
  };

  const handleProcessUnconfirmedAppointments = async () => {
    setCleaningWaitlist(true);
    setCleanResult(null);
    try {
      const res = await ApiService.processUnconfirmedAppointments(2.0);
      const data = res?.data || res;
      setCleanResult({
        so_huy: data?.so_lich_tu_dong_huy || 0,
        so_don: data?.so_nguoi_don_waitlist || 0
      });
      alert(`Tiến trình tự động hoàn tất: Đã hủy ${data?.so_lich_tu_dong_huy || 0} lịch không xác nhận (quá hạn 2h), và tự động đôn ${data?.so_nguoi_don_waitlist || 0} người từ Waitlist vào nhận slot.`);
      loadDashboardStats();
    } catch (e) {
      alert('Lỗi xử lý tiến trình: ' + e.message);
    } finally {
      setCleaningWaitlist(false);
    }
  };

  const handleToggleDoctorActive = async (doctorId, currentActive) => {
    try {
      await ApiService.updateAdminDoctor(doctorId, { is_active: !currentActive });
      loadDoctors();
    } catch (e) {
      alert('Lỗi cập nhật trạng thái bác sĩ: ' + e.message);
    }
  };

  const handleCreateDoctorSubmit = async (e) => {
    e.preventDefault();
    try {
      await ApiService.createAdminDoctor({
        ...newDoctorForm,
        chuyen_khoa_id: parseInt(newDoctorForm.chuyen_khoa_id),
        nam_kinh_nghiem: parseInt(newDoctorForm.nam_kinh_nghiem),
        gia_kham_mac_dinh: parseFloat(newDoctorForm.gia_kham_mac_dinh),
      });
      alert('Tạo hồ sơ Bác sĩ thành công!');
      setIsAddDoctorModalOpen(false);
      loadDoctors();
    } catch (e) {
      alert('Lỗi tạo bác sĩ: ' + e.message);
    }
  };

  const handleCreateShiftSubmit = async (e) => {
    e.preventDefault();
    if (!newShiftForm.bac_si_id) {
      alert('Vui lòng chọn bác sĩ.');
      return;
    }
    try {
      await ApiService.createAdminShift({
        ...newShiftForm,
        bac_si_id: parseInt(newShiftForm.bac_si_id),
        gioi_han_ca_kham: parseInt(newShiftForm.gioi_han_ca_kham),
      });
      alert('Phân ca làm việc thành công!');
      loadShifts();
    } catch (e) {
      alert('Lỗi phân ca: ' + e.message);
    }
  };

  const handleToggleLockShift = async (shiftId, currentActive) => {
    const reason = !currentActive ? null : prompt('Nhập lý do khóa ca/báo nghỉ (OpenEMR Out of Office):', 'Bác sĩ bận lịch đột xuất');
    if (currentActive && reason === null) return;
    try {
      await ApiService.toggleLockShift(shiftId, !currentActive, reason);
      loadShifts();
    } catch (e) {
      alert('Lỗi khóa/mở ca: ' + e.message);
    }
  };

  const openEmergencyModal = (shift) => {
    setEmergencyModalShift(shift);
    setEmergencyTab(!shift.is_active ? 'reassign' : 'declare');
    setEmergencyReason('Bác sĩ bận việc đột xuất');
    setEmergencyNote('');
    setEmergencySummary(null);
    setSelectedSubDoctorId('');
    setReassignNote('Điều phối bác sĩ thay thế cùng ca');
    setEmergencyFeedback(null);
  };

  const closeEmergencyModal = () => {
    setEmergencyModalShift(null);
    setEmergencySummary(null);
    setEmergencyFeedback(null);
  };

  const handleDeclareEmergencyLeave = async (e) => {
    if (e) e.preventDefault();
    if (!emergencyModalShift) return;
    setEmergencyLoading(true);
    setEmergencyFeedback(null);
    try {
      const res = await ApiService.declareEmergencyLeave(
        emergencyModalShift.id,
        emergencyReason,
        emergencyNote || null
      );
      setEmergencySummary(res);
      setEmergencyFeedback({
        type: 'success',
        message: `Khai báo nghỉ thành công! Ảnh hưởng: ${res.so_ve_cho_kham} vé chờ, ${res.so_ve_dang_kham} ca dở, ${res.so_lich_chua_checkin} lịch hẹn.`
      });
      setEmergencyTab('reassign');
      loadShifts();
    } catch (err) {
      setEmergencyFeedback({
        type: 'error',
        message: 'Lỗi khai báo nghỉ: ' + err.message
      });
    } finally {
      setEmergencyLoading(false);
    }
  };

  const handleReassignQueue = async () => {
    if (!emergencyModalShift) return;
    if (!selectedSubDoctorId) {
      alert('Vui lòng chọn bác sĩ thay thế.');
      return;
    }
    setEmergencyLoading(true);
    setEmergencyFeedback(null);
    try {
      const res = await ApiService.reassignShiftQueue(
        emergencyModalShift.id,
        parseInt(selectedSubDoctorId),
        reassignNote
      );
      setEmergencyFeedback({
        type: 'success',
        message: `Điều phối thành công sang BS ${res.ten_bac_si_thay_the}! Chuyển ${res.so_ve_cho_kham_da_chuyen} vé chờ khám, bàn giao ${res.so_ve_dang_kham_ban_giao} ca dở, chuyển ${res.so_lich_chua_checkin_da_chuyen} lịch hẹn.`
      });
      loadShifts();
    } catch (err) {
      setEmergencyFeedback({
        type: 'error',
        message: 'Lỗi điều phối: ' + err.message
      });
    } finally {
      setEmergencyLoading(false);
    }
  };

  const handlePostponeAndCancel = async () => {
    if (!emergencyModalShift) return;
    if (!confirm('Bạn có chắc chắn muốn tạm hoãn toàn bộ hàng đợi và hủy lịch hẹn của ca này (Bảo lưu quyền lợi bệnh nhân, không phạt no-show)?')) {
      return;
    }
    setEmergencyLoading(true);
    setEmergencyFeedback(null);
    try {
      const res = await ApiService.postponeAndCancelShift(emergencyModalShift.id);
      setEmergencyFeedback({
        type: 'success',
        message: `Tạm hoãn và hủy lịch an toàn! Tạm hoãn ${res.so_ve_tam_hoan} vé, hủy ${res.so_lich_da_huy} lịch hẹn.`
      });
      loadShifts();
    } catch (err) {
      setEmergencyFeedback({
        type: 'error',
        message: 'Lỗi hoãn/hủy lịch: ' + err.message
      });
    } finally {
      setEmergencyLoading(false);
    }
  };

  const handleCreateServiceSubmit = async (e) => {
    e.preventDefault();
    try {
      await ApiService.createAdminService({
        ...newServiceForm,
        don_gia: parseFloat(newServiceForm.don_gia),
      });
      alert('Thêm dịch vụ niêm yết thành công!');
      setNewServiceForm({ ma_dich_vu: '', ten_dich_vu: '', don_gia: 200000, don_vi_tinh: 'Lần' });
      loadServices();
    } catch (e) {
      alert('Lỗi thêm dịch vụ: ' + e.message);
    }
  };

  if (currentUser && currentUser.vai_tro && currentUser.vai_tro !== 'admin' && currentUser.role !== 'ADMIN') {
    return (
      <div className="medical-card p-8 text-center max-w-lg mx-auto my-12 space-y-4 bg-white border border-[#E4E1D8] shadow-sm">
        <Shield className="w-12 h-12 text-[#C1443C] mx-auto" />
        <h3 className="text-xl font-bold text-[#1C1B19]">Từ Chối Truy Cập (403 Forbidden)</h3>
        <p className="text-sm text-[#6B6A65]">
          Khu vực Quản trị và Phân ca trực chỉ dành riêng cho tài khoản Quản trị viên (Admin). Bạn hiện đang đăng nhập với vai trò: <strong className="text-[#C1443C] uppercase">{currentUser.vai_tro || currentUser.role}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-left">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E1D8] pb-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1C1B19] flex items-center space-x-2">
            <Shield className="w-7 h-7 text-[#1F6F5C]" />
            <span>Khu Vực Quản Trị Phòng Khám (Admin Portal)</span>
          </h2>
          <p className="text-sm text-[#6B6A65] mt-1">
            Quản trị Bác sĩ (Bahmni Provider), Phân ca trực (OpenEMR 7 Calendar), Bảng giá dịch vụ & Live KPIs
          </p>
        </div>

        {/* Sub-tabs switcher */}
        <div className="flex bg-[#E4E1D8]/40 p-1 rounded-sm text-sm">
          <button
            onClick={() => { setAdminSubTab('dashboard'); loadDashboardStats(); }}
            className={`px-3 py-2 rounded-sm font-semibold transition ${
              adminSubTab === 'dashboard' ? 'bg-[#FFFFFF] text-[#1F6F5C] shadow-subtle' : 'text-[#6B6A65]'
            }`}
          >
            Live KPIs
          </button>
          <button
            onClick={() => setAdminSubTab('doctors')}
            className={`px-3 py-2 rounded-sm font-semibold transition ${
              adminSubTab === 'doctors' ? 'bg-[#FFFFFF] text-[#1F6F5C] shadow-subtle' : 'text-[#6B6A65]'
            }`}
          >
            Quản lý Bác sĩ
          </button>
          <button
            onClick={() => setAdminSubTab('shifts')}
            className={`px-3 py-2 rounded-sm font-semibold transition ${
              adminSubTab === 'shifts' ? 'bg-[#FFFFFF] text-[#1F6F5C] shadow-subtle' : 'text-[#6B6A65]'
            }`}
          >
            Phân Ca Trực
          </button>
          <button
            onClick={() => setAdminSubTab('services')}
            className={`px-3 py-2 rounded-sm font-semibold transition ${
              adminSubTab === 'services' ? 'bg-[#FFFFFF] text-[#1F6F5C] shadow-subtle' : 'text-[#6B6A65]'
            }`}
          >
            Bảng Giá Dịch Vụ
          </button>
          <button
            onClick={() => { setAdminSubTab('amendments'); loadAmendments(); }}
            className={`px-3 py-2 rounded-sm font-semibold transition flex items-center space-x-1.5 ${
              adminSubTab === 'amendments' ? 'bg-[#FFFFFF] text-[#1F6F5C] shadow-subtle' : 'text-[#6B6A65]'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-600" />
            <span>Duyệt Đính Chính (Four-Eyes)</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SUB-TAB 1: LIVE DASHBOARD STATS */}
      {/* ============================================================ */}
      {adminSubTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1F6F5C] flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2F8F5B] animate-pulse"></span>
              <span>Dữ liệu thực từ Cơ sở dữ liệu PostgreSQL</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={handleProcessUnconfirmedAppointments}
                disabled={cleaningWaitlist}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                title="Quét và hủy tự động các lịch hẹn quá hạn 2h chưa xác nhận, đồng thời tự động cấp slot cho bệnh nhân trong Waitlist"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>{cleaningWaitlist ? 'Đang quét tự động...' : 'Dọn dẹp lịch chưa xác nhận (2h) & Đôn Waitlist'}</span>
              </button>

              <button
                onClick={loadDashboardStats}
                disabled={loadingStats}
                className="text-xs text-[#1F6F5C] font-semibold flex items-center space-x-1 hover:underline"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
                <span>Làm mới số liệu</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="medical-card p-4">
              <span className="text-xs text-[#6B6A65]">Lịch hẹn hôm nay</span>
              <div className="text-3xl font-bold text-[#1C1B19] mt-1">{stats?.tong_lich_hen_hom_nay || 0}</div>
              <span className="text-[11px] text-[#6B6A65]">Đã đặt trước qua mạng</span>
            </div>

            <div className="medical-card p-4">
              <span className="text-xs text-[#6B6A65]">Đã Check-in tại quầy</span>
              <div className="text-3xl font-bold text-[#1F6F5C] mt-1">{stats?.so_ca_da_check_in || 0}</div>
              <span className="text-[11px] text-[#2F8F5B]">Đã có mặt tại sảnh</span>
            </div>

            <div className="medical-card p-4">
              <span className="text-xs text-[#6B6A65]">Lượt khám hoàn tất</span>
              <div className="text-3xl font-bold text-[#2F8F5B] mt-1">{stats?.so_ca_hoan_tat_kham || 0}</div>
              <span className="text-[11px] text-[#2F8F5B]">Đã khóa bệnh án EMR</span>
            </div>

            <div className="medical-card p-4">
              <span className="text-xs text-[#6B6A65]">Thời gian chờ trung bình</span>
              <div className="text-3xl font-bold text-[#B45309] mt-1">{stats?.thoi_gian_cho_trung_binh_phut || 0}p</div>
              <span className="text-[11px] text-[#6B6A65]">Chuẩn OpenEMR Flow Board</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="medical-card p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-[#6B6A65]">Bác sĩ đang hoạt động</span>
                <div className="text-xl font-bold text-[#1C1B19] mt-0.5">{stats?.tong_bac_si_hoat_dong || 0} Bác sĩ</div>
              </div>
              <Stethoscope className="w-8 h-8 text-[#1F6F5C]/40" />
            </div>

            <div className="medical-card p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-[#6B6A65]">Chuyên khoa phục vụ</span>
                <div className="text-xl font-bold text-[#1C1B19] mt-0.5">{stats?.tong_chuyen_khoa || 0} Chuyên khoa</div>
              </div>
              <Activity className="w-8 h-8 text-[#1F6F5C]/40" />
            </div>

            <div className="medical-card p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-[#6B6A65]">Doanh thu dự kiến hôm nay</span>
                <div className="text-xl font-bold text-[#1F6F5C] mt-0.5">
                  {(stats?.doanh_thu_du_kien_hom_nay || 0).toLocaleString('vi-VN')} đ
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-[#2F8F5B]/40" />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 2: DOCTORS MANAGEMENT (BAHMNI PROVIDER AVAILABILITY) */}
      {/* ============================================================ */}
      {adminSubTab === 'doctors' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-[#1C1B19]">
              Danh Sách Bác Sĩ & Trạng Thái Nhận Lịch (Bahmni Provider Availability)
            </span>
            <button
              onClick={() => setIsAddDoctorModalOpen(true)}
              className="btn-primary py-2 px-3 text-xs flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Bác Sĩ Mới</span>
            </button>
          </div>

          <div className="medical-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FFFFFF] text-[#6B6A65] border-b border-[#E4E1D8]">
                  <tr>
                    <th className="p-3">Bác sĩ</th>
                    <th className="p-3">Học vị</th>
                    <th className="p-3">Chuyên khoa & Phòng</th>
                    <th className="p-3">Kinh nghiệm</th>
                    <th className="p-3">Giá khám</th>
                    <th className="p-3">Nhận lịch hẹn</th>
                    <th className="p-3 text-right">Lịch hôm nay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E1D8]">
                  {doctors.map((doc) => (
                    <tr key={doc.id} className="hover:bg-[#F7F5F0]/50 transition">
                      <td className="p-3">
                        <div className="font-semibold text-[#1C1B19]">{doc.ho_ten}</div>
                        <div className="text-xs text-[#6B6A65]">{doc.email}</div>
                      </td>
                      <td className="p-3 font-medium text-[#1C1B19]">{doc.hoc_vi}</td>
                      <td className="p-3">
                        <div className="font-medium text-[#1C1B19]">{doc.ten_chuyen_khoa}</div>
                        <div className="text-xs text-[#6B6A65]">{doc.phong_kham || 'Chưa gán'}</div>
                      </td>
                      <td className="p-3">{doc.nam_kinh_nghiem} năm</td>
                      <td className="p-3 font-semibold text-[#1F6F5C]">{doc.gia_kham_mac_dinh.toLocaleString('vi-VN')} đ</td>
                      <td className="p-3">
                        <button
                          onClick={() => handleToggleDoctorActive(doc.id, doc.is_active)}
                          className={`px-2.5 py-1 rounded text-xs font-bold flex items-center space-x-1 ${
                            doc.is_active ? 'bg-[#E6F4EA] text-[#2F8F5B]' : 'bg-[#F6DEDC] text-[#C1443C]'
                          }`}
                        >
                          <span>{doc.is_active ? '✓ Đang nhận lịch' : '✕ Tạm ngưng'}</span>
                        </button>
                      </td>
                      <td className="p-3 text-right font-bold text-[#1C1B19]">
                        {doc.so_luong_lich_hom_nay} ca
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Doctor Modal */}
          {isAddDoctorModalOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-md max-w-lg w-full p-6 space-y-4 shadow-xl">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="text-lg font-bold text-[#1C1B19]">Thêm Hồ Sơ Bác Sĩ Mới</h3>
                  <button onClick={() => setIsAddDoctorModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
                </div>
                <form onSubmit={handleCreateDoctorSubmit} className="space-y-3 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-[#1C1B19] mb-1">Họ và tên bác sĩ *</label>
                    <input
                      type="text"
                      required
                      placeholder="PGS.TS.BS Nguyễn Văn An"
                      value={newDoctorForm.ho_ten}
                      onChange={(e) => setNewDoctorForm({ ...newDoctorForm, ho_ten: e.target.value })}
                      className="input-field w-full py-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#1C1B19] mb-1">Email đăng nhập *</label>
                      <input
                        type="email"
                        required
                        placeholder="doctor@clinic.com"
                        value={newDoctorForm.email}
                        onChange={(e) => setNewDoctorForm({ ...newDoctorForm, email: e.target.value })}
                        className="input-field w-full py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1C1B19] mb-1">Số điện thoại *</label>
                      <input
                        type="text"
                        required
                        placeholder="0987654321"
                        value={newDoctorForm.so_dien_thoai}
                        onChange={(e) => setNewDoctorForm({ ...newDoctorForm, so_dien_thoai: e.target.value })}
                        className="input-field w-full py-2"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#1C1B19] mb-1">Chuyên khoa *</label>
                      <select
                        value={newDoctorForm.chuyen_khoa_id}
                        onChange={(e) => setNewDoctorForm({ ...newDoctorForm, chuyen_khoa_id: e.target.value })}
                        className="input-field w-full py-2"
                      >
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1C1B19] mb-1">Học vị *</label>
                      <select
                        value={newDoctorForm.hoc_vi}
                        onChange={(e) => setNewDoctorForm({ ...newDoctorForm, hoc_vi: e.target.value })}
                        className="input-field w-full py-2"
                      >
                        <option value="BS">Bác sĩ (BS)</option>
                        <option value="BS.CKI">Bác sĩ CKI</option>
                        <option value="BS.CKII">Bác sĩ CKII</option>
                        <option value="ThS.BS">Thạc sĩ Bác sĩ</option>
                        <option value="TS.BS">Tiến sĩ Bác sĩ</option>
                        <option value="PGS.TS.BS">PGS.TS.BS</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#1C1B19] mb-1">Số CCHN Y khoa *</label>
                      <input
                        type="text"
                        required
                        placeholder="CCHN-987654"
                        value={newDoctorForm.chung_chi_hanh_nghe}
                        onChange={(e) => setNewDoctorForm({ ...newDoctorForm, chung_chi_hanh_nghe: e.target.value })}
                        className="input-field w-full py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1C1B19] mb-1">Giá khám mặc định (đ)</label>
                      <input
                        type="number"
                        step="50000"
                        value={newDoctorForm.gia_kham_mac_dinh}
                        onChange={(e) => setNewDoctorForm({ ...newDoctorForm, gia_kham_mac_dinh: e.target.value })}
                        className="input-field w-full py-2"
                      />
                    </div>
                  </div>
                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsAddDoctorModalOpen(false)}
                      className="btn-secondary py-2 px-4 text-xs"
                    >
                      Hủy
                    </button>
                    <button type="submit" className="btn-primary py-2 px-4 text-xs">
                      Lưu Bác Sĩ
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 3: SHIFT SCHEDULING (OPENEMR 7 CALENDAR) */}
      {/* ============================================================ */}
      {adminSubTab === 'shifts' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-sm font-bold text-[#1C1B19]">
                Phân Ca Làm Việc & Lịch Trực Tuần (OpenEMR 7 Calendar)
              </span>
              <p className="text-xs text-[#6B6A65]">
                Quản lý bác sĩ có mặt (In Office), khóa ca (Out of Office) và hạn mức slot 30 phút
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-[#1C1B19]">Chọn ngày:</span>
              <input
                type="date"
                value={selectedShiftDate}
                onChange={(e) => setSelectedShiftDate(e.target.value)}
                className="input-field py-1.5 px-3 text-xs"
              />
            </div>
          </div>

          {/* Quick Create Shift Form */}
          <div className="medical-card p-4 bg-[#F7F5F0]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1F6F5C] mb-3 block">
              + Phân ca trực mới cho ngày {selectedShiftDate}
            </span>
            <form onSubmit={handleCreateShiftSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Bác sĩ trực *</label>
                <select
                  required
                  value={newShiftForm.bac_si_id}
                  onChange={(e) => setNewShiftForm({ ...newShiftForm, bac_si_id: e.target.value })}
                  className="input-field w-full py-1.5"
                >
                  <option value="">-- Chọn bác sĩ --</option>
                  {doctors.filter(d => d.is_active).map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.ho_ten} ({doc.ten_chuyen_khoa})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Ca làm việc *</label>
                <select
                  value={newShiftForm.ca_lam_viec}
                  onChange={(e) => setNewShiftForm({ ...newShiftForm, ca_lam_viec: e.target.value })}
                  className="input-field w-full py-1.5"
                >
                  <option value="sang">Ca Sáng (07:30 - 11:30)</option>
                  <option value="chieu">Ca Chiều (13:30 - 17:00)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Hạn mức bệnh nhân/ca</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={newShiftForm.gioi_han_ca_kham}
                  onChange={(e) => setNewShiftForm({ ...newShiftForm, gioi_han_ca_kham: e.target.value })}
                  className="input-field w-full py-1.5"
                />
              </div>

              <div className="flex items-end">
                <button type="submit" className="btn-primary w-full py-2 text-xs flex items-center justify-center space-x-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Xác nhận phân ca</span>
                </button>
              </div>
            </form>
          </div>

          {/* Shifts Table */}
          <div className="medical-card overflow-hidden">
            <div className="p-3 border-b border-[#E4E1D8] bg-[#FFFFFF] flex justify-between items-center text-xs">
              <span className="font-bold text-[#1C1B19]">Danh sách ca trực ngày {selectedShiftDate} ({shifts.length} ca)</span>
              <span className="text-[#6B6A65]">Ca sáng: 8 slot (30p) • Ca chiều: 7 slot (30p)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FFFFFF] text-[#6B6A65] border-b border-[#E4E1D8]">
                  <tr>
                    <th className="p-3">Bác sĩ</th>
                    <th className="p-3">Chuyên khoa & Phòng</th>
                    <th className="p-3">Ca & Khung giờ</th>
                    <th className="p-3">Số lượng đặt</th>
                    <th className="p-3">Trạng thái ca</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E1D8]">
                  {shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-[#F7F5F0]/50 transition">
                      <td className="p-3 font-semibold text-[#1C1B19]">{shift.ten_bac_si}</td>
                      <td className="p-3">
                        <div className="font-medium text-[#1C1B19]">{shift.chuyen_khoa}</div>
                        <div className="text-xs text-[#6B6A65]">{shift.phong_kham || 'P.Khám'}</div>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-[#1F6F5C]">
                           {shift.ca_lam_viec === 'sang' ? 'Ca Sáng' : 'Ca Chiều'}
                        </span>
                        <div className="text-xs text-[#6B6A65]">
                          {shift.gio_bat_dau.slice(0, 5)} - {shift.gio_ket_thuc.slice(0, 5)}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-[#1C1B19]">{shift.so_luong_da_dat}</span> / {shift.gioi_han_ca_kham} slot
                      </td>
                      <td className="p-3">
                        {shift.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-[#E6F4EA] text-[#2F8F5B]">
                            ✓ Đang mở đặt lịch
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-[#F6DEDC] text-[#C1443C]">
                            ✕ Đã khóa ({shift.ghi_chu_nghi || 'Báo nghỉ'})
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openEmergencyModal(shift)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-[#FDF6B2] text-[#723B13] border border-[#FDE047] hover:bg-[#FEF08A] flex items-center space-x-1"
                            title="Khai báo nghỉ đột xuất & điều phối bệnh nhân"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-[#B45309]" />
                            <span>Báo nghỉ / Điều phối</span>
                          </button>
                          <button
                            onClick={() => handleToggleLockShift(shift.id, shift.is_active)}
                            className="btn-secondary py-1 px-2.5 text-xs flex items-center space-x-1"
                          >
                            {shift.is_active ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            <span>{shift.is_active ? 'Khóa ca' : 'Mở lại'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {shifts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-[#6B6A65] text-sm">
                        Chưa có ca trực nào được phân cho ngày này. Hãy sử dụng form phía trên để phân ca mới!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 4: SERVICES & PRICING CATALOG */}
      {/* ============================================================ */}
      {adminSubTab === 'services' && (
        <div className="space-y-6">
          <div className="border-b border-[#E4E1D8] pb-3">
            <h3 className="text-lg font-bold text-[#1C1B19]">Danh Mục Kỹ Thuật & Giá Niêm Yết (OpenMRS Services)</h3>
            <p className="text-xs text-[#6B6A65]">Bảng giá niêm yết công khai dịch vụ khám bệnh và cận lâm sàng</p>
          </div>

          <form onSubmit={handleCreateServiceSubmit} className="medical-card p-4 bg-[#F7F5F0] grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">Mã dịch vụ *</label>
              <input
                type="text"
                required
                placeholder="VD: CĐHA04"
                value={newServiceForm.ma_dich_vu}
                onChange={(e) => setNewServiceForm({ ...newServiceForm, ma_dich_vu: e.target.value })}
                className="input-field w-full py-1.5"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Tên kỹ thuật / Dịch vụ *</label>
              <input
                type="text"
                required
                placeholder="VD: Nội soi dạ dày gây mê"
                value={newServiceForm.ten_dich_vu}
                onChange={(e) => setNewServiceForm({ ...newServiceForm, ten_dich_vu: e.target.value })}
                className="input-field w-full py-1.5"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Đơn giá niêm yết (VNĐ) *</label>
              <input
                type="number"
                step="10000"
                required
                value={newServiceForm.don_gia}
                onChange={(e) => setNewServiceForm({ ...newServiceForm, don_gia: e.target.value })}
                className="input-field w-full py-1.5"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full py-2 text-xs flex items-center justify-center space-x-1">
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm dịch vụ</span>
              </button>
            </div>
          </form>

          <div className="medical-card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FFFFFF] text-[#6B6A65] border-b border-[#E4E1D8]">
                <tr>
                  <th className="p-3">Mã DV</th>
                  <th className="p-3">Tên dịch vụ cận lâm sàng</th>
                  <th className="p-3">Đơn vị tính</th>
                  <th className="p-3">Đơn giá niêm yết</th>
                  <th className="p-3 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E1D8]">
                {services.map((svc) => (
                  <tr key={svc.id} className="hover:bg-[#F7F5F0]/50 transition">
                    <td className="p-3 font-mono font-bold text-[#1F6F5C]">{svc.ma_dich_vu}</td>
                    <td className="p-3 font-semibold text-[#1C1B19]">{svc.ten_dich_vu}</td>
                    <td className="p-3 text-[#6B6A65]">{svc.don_vi_tinh}</td>
                    <td className="p-3 font-bold text-[#1F6F5C]">{svc.don_gia.toLocaleString('vi-VN')} đ</td>
                    <td className="p-3 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-[#E6F4EA] text-[#2F8F5B]">
                        ✓ Đang áp dụng
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 5: MEDICAL AMENDMENTS APPROVAL (FOUR-EYES PRINCIPLE) */}
      {/* ============================================================ */}
      {adminSubTab === 'amendments' && (
        <div className="space-y-6">
          <div className="border-b border-[#E4E1D8] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-[#1C1B19] flex items-center space-x-2">
                <Shield className="w-5 h-5 text-amber-600" />
                <span>Phê Duyệt Đính Chính Hồ Sơ Bệnh Án Đã Khóa (Four-Eyes Principle)</span>
              </h3>
              <p className="text-xs text-[#6B6A65] mt-0.5">
                Quy chuẩn Thông tư 32/2023/TT-BYT: Hồ sơ sau khi khóa chuyển sang chế độ Read-only. Mọi đính chính bắt buộc có sự xét duyệt song trùng của Ban Quản Trị / Giám Đốc Chuyên Môn.
              </p>
            </div>
            <button
              onClick={loadAmendments}
              disabled={loadingAmendments}
              className="text-xs text-[#1F6F5C] font-semibold flex items-center space-x-1 hover:underline"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAmendments ? 'animate-spin' : ''}`} />
              <span>Tải lại danh sách</span>
            </button>
          </div>

          <div className="medical-card overflow-hidden">
            <div className="p-3 border-b border-[#E4E1D8] bg-[#FFFFFF] flex justify-between items-center text-xs">
              <span className="font-bold text-[#1C1B19]">Danh sách yêu cầu đính chính ({amendments.length})</span>
              <span className="text-[#6B6A65]">Đang chờ duyệt: {amendments.filter(a => a.trang_thai === 'CHO_PHE_DUYET').length} biên bản</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFFFFF] text-[#6B6A65] border-b border-[#E4E1D8] font-semibold">
                  <tr>
                    <th className="p-3">Mã BB</th>
                    <th className="p-3">Bác sĩ đề xuất</th>
                    <th className="p-3">Lượt khám</th>
                    <th className="p-3">Hạng mục</th>
                    <th className="p-3">Lý do giải trình y khoa</th>
                    <th className="p-3">Nội dung đề xuất mới</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3 text-right">Thao tác duyệt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E1D8]">
                  {amendments.map((am) => (
                    <tr key={am.id} className="hover:bg-[#F7F5F0]/50 transition">
                      <td className="p-3 font-mono font-bold text-amber-700">#AM-{am.id}</td>
                      <td className="p-3 font-medium text-gray-900">{am.bac_si_name || 'BS. Điều trị'}</td>
                      <td className="p-3 font-mono text-gray-600">Lượt #{am.luot_kham_id}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-[10px]">
                          {am.thuc_the_loai}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700 max-w-xs">{am.ly_do_text}</td>
                      <td className="p-3 max-w-xs">
                        <pre className="bg-[#F7F5F0] p-1.5 rounded border border-[#E4E1D8] font-mono text-[10px] text-gray-800 whitespace-pre-wrap">
                          {JSON.stringify(am.noi_dung_moi_json, null, 1)}
                        </pre>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          am.trang_thai === 'DA_PHE_DUYET'
                            ? 'bg-[#E6F4EA] text-[#2F8F5B]'
                            : am.trang_thai === 'TU_CHOI'
                            ? 'bg-[#FDE8E8] text-[#9B1C1C]'
                            : 'bg-amber-100 text-amber-800 animate-pulse'
                        }`}>
                          {am.trang_thai === 'DA_PHE_DUYET' ? '✓ ĐÃ DUYỆT' : am.trang_thai === 'TU_CHOI' ? '✕ TỪ CHỐI' : '⏳ CHỜ DUYỆT'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {am.trang_thai === 'CHO_PHE_DUYET' ? (
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => handleApproveAmendment(am.id)}
                              disabled={processingAmendmentId === am.id}
                              className="px-2.5 py-1 bg-[#1F6F5C] hover:bg-[#185949] text-white rounded text-[11px] font-semibold flex items-center space-x-1 shadow-sm disabled:opacity-50"
                              title="Phê duyệt đính chính và mở khóa áp dụng nội dung mới"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Duyệt</span>
                            </button>
                            <button
                              onClick={() => handleRejectAmendment(am.id)}
                              disabled={processingAmendmentId === am.id}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded text-[11px] font-semibold flex items-center space-x-1 disabled:opacity-50"
                              title="Từ chối yêu cầu đính chính"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Từ chối</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">Đã xử lý</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {amendments.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500 italic">
                        Hiện không có yêu cầu đính chính bệnh án nào đang chờ xét duyệt.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* EMERGENCY LEAVE & QUEUE RE-ROUTING MODAL */}
      {/* ============================================================ */}
      {emergencyModalShift && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-md max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-[#E4E1D8] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#1C1B19] flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-[#B45309]" />
                  <span>Nghỉ Đột Xuất & Điều Phối Hàng Đợi</span>
                </h3>
                <p className="text-xs text-[#6B6A65] mt-1">
                  Bác sĩ: <strong className="text-[#1C1B19]">{emergencyModalShift.ten_bac_si}</strong> ({emergencyModalShift.chuyen_khoa}) •
                  Ca: <strong className="text-[#1C1B19]">{emergencyModalShift.ca_lam_viec === 'sang' ? 'Ca Sáng' : 'Ca Chiều'}</strong> ({emergencyModalShift.ngay_lam_viec})
                </p>
              </div>
              <button onClick={closeEmergencyModal} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
            </div>

            {/* Tab switchers */}
            <div className="flex border-b border-[#E4E1D8] text-xs">
              <button
                onClick={() => setEmergencyTab('declare')}
                className={`py-2 px-4 font-bold border-b-2 transition ${
                  emergencyTab === 'declare'
                    ? 'border-[#B45309] text-[#B45309]'
                    : 'border-transparent text-[#6B6A65] hover:text-[#1C1B19]'
                }`}
              >
                1. Khai Báo Nghỉ & Thống Kê
              </button>
              <button
                onClick={() => setEmergencyTab('reassign')}
                className={`py-2 px-4 font-bold border-b-2 transition ${
                  emergencyTab === 'reassign'
                    ? 'border-[#1F6F5C] text-[#1F6F5C]'
                    : 'border-transparent text-[#6B6A65] hover:text-[#1C1B19]'
                }`}
              >
                2. Phương Án Điều Phối / Hoãn Hủy
              </button>
            </div>

            {/* Feedback alert */}
            {emergencyFeedback && (
              <div
                className={`p-3 rounded-md text-xs font-medium flex items-center space-x-2 ${
                  emergencyFeedback.type === 'success'
                    ? 'bg-[#E6F4EA] text-[#2F8F5B] border border-[#A8DAB5]'
                    : 'bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4]'
                }`}
              >
                {emergencyFeedback.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{emergencyFeedback.message}</span>
              </div>
            )}

            {/* TAB 1: DECLARE EMERGENCY LEAVE */}
            {emergencyTab === 'declare' && (
              <form onSubmit={handleDeclareEmergencyLeave} className="space-y-4 text-xs">
                <div className="p-3 bg-amber-50 rounded border border-amber-200 text-[#723B13]">
                  <p className="font-semibold mb-1">Quy tắc an toàn vận hành:</p>
                  <p>Khi xác nhận bác sĩ nghỉ đột xuất, hệ thống sẽ tự động khóa ca trực (ngừng nhận lượt đặt mới) và kiểm kê toàn bộ bệnh nhân đang chịu ảnh hưởng.</p>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[#1C1B19]">Lý do nghỉ đột xuất *</label>
                  <select
                    value={emergencyReason}
                    onChange={(e) => setEmergencyReason(e.target.value)}
                    className="input-field w-full py-2"
                  >
                    <option value="Bác sĩ bận việc đột xuất">Bác sĩ bận việc đột xuất</option>
                    <option value="Bác sĩ bị ốm / cấp cứu">Bác sĩ bị ốm / cấp cứu</option>
                    <option value="Bác sĩ tham gia hội chẩn khẩn">Bác sĩ tham gia hội chẩn khẩn</option>
                    <option value="Sự cố kỹ thuật phòng khám">Sự cố kỹ thuật phòng khám</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[#1C1B19]">Ghi chú thêm (tùy chọn)</label>
                  <textarea
                    rows={2}
                    value={emergencyNote}
                    onChange={(e) => setEmergencyNote(e.target.value)}
                    placeholder="Ghi chú thêm về hoàn cảnh nghỉ..."
                    className="input-field w-full py-1.5"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-[#E4E1D8]">
                  <button
                    type="button"
                    onClick={closeEmergencyModal}
                    className="btn-secondary py-2 px-4"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={emergencyLoading}
                    className="btn-primary py-2 px-4 bg-[#B45309] hover:bg-[#92400E] border-[#B45309]"
                  >
                    {emergencyLoading ? 'Đang xử lý...' : 'Xác nhận Báo Nghỉ & Kiểm Kê'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: REASSIGN / POSTPONE */}
            {emergencyTab === 'reassign' && (
              <div className="space-y-4 text-xs">
                {/* Summary stats if available */}
                {emergencySummary && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-[#FEF3C7] rounded border border-[#FDE68A] text-center">
                      <div className="text-xl font-bold text-[#B45309]">{emergencySummary.so_ve_cho_kham}</div>
                      <div className="text-[11px] font-semibold text-[#78350F]">Bệnh nhân Chờ Khám (N1)</div>
                    </div>
                    <div className="p-3 bg-[#FFEDD5] rounded border border-[#FED7AA] text-center">
                      <div className="text-xl font-bold text-[#C2410C]">{emergencySummary.so_ve_dang_kham}</div>
                      <div className="text-[11px] font-semibold text-[#7C2D12]">Lượt Đang Khám Dở (N2)</div>
                    </div>
                    <div className="p-3 bg-[#E0E7FF] rounded border border-[#C7D2FE] text-center">
                      <div className="text-xl font-bold text-[#3730A3]">{emergencySummary.so_lich_chua_checkin}</div>
                      <div className="text-[11px] font-semibold text-[#312E81]">Lịch Chưa Check-in (N3)</div>
                    </div>
                  </div>
                )}

                {/* Option 1: Reassign to substitute doctor */}
                <div className="p-4 bg-[#F7F5F0] rounded border border-[#E4E1D8] space-y-3">
                  <div className="font-bold text-[#1F6F5C] flex items-center space-x-1.5 text-sm">
                    <RefreshCw className="w-4 h-4" />
                    <span>Phương án 1: Điều Phối Sang Bác Sĩ Thay Thế</span>
                  </div>
                  <p className="text-[#6B6A65]">
                    Hệ thống sẽ chuyển toàn bộ vé chờ sang hàng đợi BS mới (tự động cấp STT nối tiếp), bàn giao ca đang khám dở và cập nhật lịch hẹn. Yêu cầu cùng chuyên khoa.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1 text-[#1C1B19]">Chọn Bác sĩ thay thế *</label>
                      <select
                        value={selectedSubDoctorId}
                        onChange={(e) => setSelectedSubDoctorId(e.target.value)}
                        className="input-field w-full py-2"
                      >
                        <option value="">-- Chọn bác sĩ trực thay thế --</option>
                        {doctors
                          .filter((d) => d.id !== emergencyModalShift.bac_si_id && d.is_active)
                          .map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {doc.ho_ten} ({doc.ten_chuyen_khoa})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1 text-[#1C1B19]">Ghi chú điều phối</label>
                      <input
                        type="text"
                        value={reassignNote}
                        onChange={(e) => setReassignNote(e.target.value)}
                        className="input-field w-full py-2"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleReassignQueue}
                    disabled={emergencyLoading || !selectedSubDoctorId}
                    className="btn-primary py-2 px-4 w-full flex items-center justify-center space-x-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{emergencyLoading ? 'Đang điều phối...' : 'Xác Nhận Điều Phối Sang Bác Sĩ Mới'}</span>
                  </button>
                </div>

                {/* Option 2: Postpone and Cancel (Fallback when no replacement) */}
                <div className="p-4 bg-[#FDF2F2] rounded border border-[#F8B4B4] space-y-3">
                  <div className="font-bold text-[#9B1C1C] flex items-center space-x-1.5 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Phương án 2: Không Có Bác Sĩ Thay Thế (Hoãn Hàng Đợi & Hủy Lịch No-Fault)</span>
                  </div>
                  <p className="text-[#771D1D]">
                    Chuyển các vé chờ khám sang trạng thái <strong>TẠM HOÃN</strong>, tự động hủy các lịch hẹn chưa đến mà <strong>KHÔNG</strong> tính lỗi No-show cho bệnh nhân (bảo toàn điểm tín nhiệm).
                  </p>

                  <button
                    onClick={handlePostponeAndCancel}
                    disabled={emergencyLoading}
                    className="btn-secondary py-2 px-4 w-full border-[#F8B4B4] text-[#9B1C1C] hover:bg-[#FDE8E8] font-bold flex items-center justify-center space-x-2"
                  >
                    <span>{emergencyLoading ? 'Đang xử lý...' : 'Hoãn Hàng Đợi & Hủy Lịch An Toàn'}</span>
                  </button>
                </div>

                <div className="flex justify-end pt-2 border-t border-[#E4E1D8]">
                  <button onClick={closeEmergencyModal} className="btn-secondary py-2 px-4">
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
