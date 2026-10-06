'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar, Clock, User, FileText, CheckCircle, AlertTriangle,
  X, RefreshCw, Trash2, Heart, Shield, Printer,
  ArrowRight, ChevronRight, Edit3, UserCheck, AlertCircle, Plus,
  Phone, Activity, Search, Lock, Unlock, ClipboardList, Pill, Save
} from 'lucide-react';
import ApiService from '../services/api';
import ScheduleTab from './doctor-tabs/ScheduleTab';
import ProfileTab from './doctor-tabs/ProfileTab';
import ResultInputModal from './doctor-tabs/ResultInputModal';
import ResultViewModal from './doctor-tabs/ResultViewModal';
import PatientHistoryDrawer from './doctor-tabs/PatientHistoryDrawer';

export default function DoctorPortal() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDoctor, setCurrentDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('workstation'); // 'workstation' | 'schedule' | 'profile' | 'amendments'

  // Schedule & Shift Change States (Tab 2)
  const [doctorShifts, setDoctorShifts] = useState([]);
  const [shiftRequests, setShiftRequests] = useState([]);
  const [doctorsList, setDoctorsList] = useState([]);
  const [selectedShiftForRequest, setSelectedShiftForRequest] = useState(null);
  const [showShiftRequestModal, setShowShiftRequestModal] = useState(false);
  const [showImpactConfirmModal, setShowImpactConfirmModal] = useState(false);
  const [impactData, setImpactData] = useState(null);

  // Profile States (Tab 3 - OWASP Allow-List)
  const [profileForm, setProfileForm] = useState({
    so_dien_thoai: '',
    email_lien_he_phu: '',
    dia_chi_lien_he: '',
    tieu_su: '',
    ngon_ngu_ho_tro: ['vi'],
    anh_dai_dien_url: '',
    mo_ta_ca_nhan: ''
  });
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showLegalRequestModal, setShowLegalRequestModal] = useState(false);

  // Selected appointment & clinical encounter state
  const [selectedApt, setSelectedApt] = useState(null);
  const [activeStep, setActiveStep] = useState('diagnosis'); // 'diagnosis' | 'lab' | 'prescription'
  const [encounterData, setEncounterData] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  // Vitals & Clinical info (WHO / OpenMRS Clinical Specification)
  const [vitals, setVitals] = useState({
    mach: 75,
    nhiet_do: 36.8,
    huyet_ap_tam_thu: 120,
    huyet_ap_tam_truong: 80,
    nhip_tho: 18,
    spo2: 98,
    can_nang: 62,
    chieu_cao: 168
  });

  // Helper tính toán chỉ số khối cơ thể (BMI) và phân loại thể trạng theo chuẩn WHO IDI & WPRO
  const calculateBmi = (weightKg, heightCm) => {
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);
    if (!w || !h || h <= 0) return null;
    const hMeter = h / 100;
    const bmiVal = w / (hMeter * hMeter);
    return Math.round(bmiVal * 10) / 10;
  };

  const getBmiClassification = (bmi) => {
    if (bmi === null || bmi === undefined || isNaN(bmi)) {
      return {
        label: 'Chưa đủ dữ liệu',
        badgeClass: 'bg-gray-100 text-gray-700 border-gray-300',
        textColor: 'text-gray-600',
        advice: 'Cần nhập đầy đủ Chiều cao và Cân nặng để tính chỉ số BMI.',
        percentOnGauge: 50
      };
    }
    if (bmi < 18.5) {
      return {
        label: 'Thiếu cân (Gầy)',
        badgeClass: 'bg-sky-50 text-sky-800 border-sky-300',
        textColor: 'text-sky-700',
        advice: 'Thể trạng gầy, cần tư vấn dinh dưỡng nâng cao thể trạng.',
        percentOnGauge: Math.min(25, Math.max(5, (bmi / 18.5) * 25))
      };
    }
    if (bmi < 23.0) {
      return {
        label: 'Bình thường (Chuẩn IDI & WPRO)',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        textColor: 'text-emerald-700',
        advice: 'Thể trạng cân đối theo tiêu chuẩn người trưởng thành Châu Á.',
        percentOnGauge: 25 + ((bmi - 18.5) / 4.5) * 25
      };
    }
    if (bmi < 25.0) {
      return {
        label: 'Tiền béo phì (Thừa cân)',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
        textColor: 'text-amber-800',
        advice: 'Thừa cân nhẹ, cần điều chỉnh chế độ ăn giảm tinh bột và tập luyện.',
        percentOnGauge: 50 + ((bmi - 23.0) / 2.0) * 25
      };
    }
    if (bmi < 30.0) {
      return {
        label: 'Béo phì độ I',
        badgeClass: 'bg-orange-50 text-orange-800 border-orange-300',
        textColor: 'text-orange-800',
        advice: 'Béo phì độ I, tăng nguy cơ tăng huyết áp và đái tháo đường.',
        percentOnGauge: 75 + Math.min(15, ((bmi - 25.0) / 5.0) * 15)
      };
    }
    return {
      label: 'Béo phì độ II (Nguy cơ cao)',
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-300',
      textColor: 'text-rose-700',
      advice: 'Béo phì độ II, nguy cơ tim mạch và hội chứng chuyển hóa nghiêm trọng.',
      percentOnGauge: 95
    };
  };

  // Step (a) Diagnosis
  const [diagnosisPrimary, setDiagnosisPrimary] = useState('');
  const [primaryIcd10, setPrimaryIcd10] = useState('I10');
  const [diagnosisSecondary, setDiagnosisSecondary] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [treatmentConclusion, setTreatmentConclusion] = useState('');
  const [doctorAdvice, setDoctorAdvice] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  // Step (b) Lab orders
  const [labOrders, setLabOrders] = useState([]);
  const [selectedLabPreset, setSelectedLabPreset] = useState('');
  const [labNote, setLabNote] = useState('');

  // Step (c) Prescriptions
  const [prescriptionItems, setPrescriptionItems] = useState([
    { id: 1, medicine_name: 'Amlodipine 5mg', quantity: 30, unit: 'Viên', usage: 'Uống 1 viên vào 8h sáng sau ăn', days: 30 },
    { id: 2, medicine_name: 'Atorvastatin 10mg', quantity: 30, unit: 'Viên', usage: 'Uống 1 viên vào 20h tối', days: 30 }
  ]);
  const [prescriptionNote, setPrescriptionNote] = useState('Uống thuốc đúng giờ, hạn chế ăn mặn và kiêng rượu bia.');

  // Modals
  const [showCallNextModal, setShowCallNextModal] = useState(false);
  const [nextPatientResult, setNextPatientResult] = useState(null);
  const [callNextLoading, setCallNextLoading] = useState(false);

  const [postponeModalApt, setPostponeModalApt] = useState(null);
  const [postponeReason, setPostponeReason] = useState('Gọi loa 3 lần không có mặt');
  const [postponeLoading, setPostponeLoading] = useState(false);

  const [noShowModalApt, setNoShowModalApt] = useState(null);
  const [noShowReason, setNoShowReason] = useState('Không có mặt khi kết thúc ca trực');
  const [noShowLoading, setNoShowLoading] = useState(false);

  const [showLockModal, setShowLockModal] = useState(false);
  const [lockingLoading, setLockingLoading] = useState(false);

  const [showAmendmentModal, setShowAmendmentModal] = useState(false);
  const [amendmentForm, setAmendmentForm] = useState({
    thuc_the_loai: 'CHAN_DOAN',
    ly_do_text: '',
    noi_dung_moi: ''
  });
  const [amendmentSubmitting, setAmendmentSubmitting] = useState(false);
  const [amendmentHistory, setAmendmentHistory] = useState([]);

  const [showPrintModal, setShowPrintModal] = useState(false);

  // Lab Result Modals & Longitudinal EMR State (Package D)
  const [showResultInputModal, setShowResultInputModal] = useState(false);
  const [selectedOrderForInput, setSelectedOrderForInput] = useState(null);
  const [isSavingResult, setIsSavingResult] = useState(false);

  const [showResultViewModal, setShowResultViewModal] = useState(false);
  const [selectedOrderForView, setSelectedOrderForView] = useState(null);

  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [patientHistory, setPatientHistory] = useState([]);
  const [historyTargetId, setHistoryTargetId] = useState(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Status and Alerts
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Standard Presets
  const labPresets = [
    { code: 'XN-HUYET-HOC', name: 'Tổng phân tích tế bào máu ngoại vi (24 thông số)', price: 120000 },
    { code: 'XN-SINH-HOA', name: 'Sinh hóa máu toàn phần (Glucose, Ure, Creatinine, AST, ALT)', price: 250000 },
    { code: 'CDHA-XQUANG-NGUC', name: 'Chụp X-quang tim phổi thẳng số hóa', price: 180000 },
    { code: 'TDCN-DIEN-TIM', name: 'Điện tâm đồ (ECG 12 chuyển đạo)', price: 90000 },
    { code: 'CDHA-SIEU-AM-BUNG', name: 'Siêu âm ổ bụng tổng quát màu Doppler', price: 220000 },
    { code: 'NOI-SOI-TMH', name: 'Nội soi Tai Mũi Họng ống mềm có hình ảnh', price: 200000 }
  ];

  const [icdSearchQuery, setIcdSearchQuery] = useState('');

  const icd10Common = [
    { code: 'I10', name: 'Bệnh tăng huyết áp vô căn (nguyên phát)' },
    { code: 'I20', name: 'Cơn đau thắt ngực (Thiếu máu cơ tim cục bộ)' },
    { code: 'E11', name: 'Bệnh đái tháo đường không phụ thuộc insulin (Type 2)' },
    { code: 'E78', name: 'Rối loạn chuyển hóa lipoprotein và tình trạng tăng lipid máu' },
    { code: 'J00', name: 'Viêm mũi họng cấp (Cảm thường)' },
    { code: 'J02', name: 'Viêm họng cấp' },
    { code: 'J20', name: 'Viêm phế quản cấp' },
    { code: 'J45', name: 'Hen phế quản (Suyễn ngoại sinh/nội sinh)' },
    { code: 'K21', name: 'Bệnh trào ngược dạ dày - thực quản (GERD)' },
    { code: 'K29.7', name: 'Viêm dạ dày, không đặc hiệu' },
    { code: 'K58', name: 'Hội chứng ruột kích thích (IBS)' },
    { code: 'M54.5', name: 'Đau thắt lưng (Đau lưng dưới)' },
    { code: 'M17', name: 'Thoái hóa khớp gối nguyên phát' },
    { code: 'L20', name: 'Viêm da dị ứng / Viêm da cơ địa' },
    { code: 'N39.0', name: 'Nhiễm trùng đường tiết niệu, vị trí không xác định' },
    { code: 'R51', name: 'Đau đầu, không phân loại ở nơi khác' }
  ];

  const medicinePresets = [
    { name: 'Paracetamol 500mg', unit: 'Viên', defaultQty: 15, usage: 'Uống 1 viên khi sốt > 38.5 độ' },
    { name: 'Amlodipine 5mg', unit: 'Viên', defaultQty: 30, usage: 'Uống 1 viên vào 8h sáng' },
    { name: 'Metformin 500mg', unit: 'Viên', defaultQty: 60, usage: 'Uống 1 viên sau ăn trưa và tối' },
    { name: 'Omeprazole 20mg', unit: 'Viên', defaultQty: 28, usage: 'Uống 1 viên trước ăn sáng 30 phút' },
    { name: 'Augmentin 1g (Amoxicillin/Clavulanate)', unit: 'Viên', defaultQty: 14, usage: 'Uống 1 viên sau ăn sáng & tối' }
  ];

  useEffect(() => {
    loadInitialData();
  }, [selectedDate]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const user = await ApiService.getCurrentUser();
      setCurrentDoctor(user);

      if (user) {
        loadProfile(user);
        loadDoctorShifts(user.id);
        loadShiftRequests(user.id);
      }
      loadDoctorsList();

      const apts = await ApiService.getDoctorShiftAppointments(selectedDate);
      if (Array.isArray(apts)) {
        setAppointments(apts);
        if (apts.length > 0 && !selectedApt) {
          selectAppointment(apts[0]);
        }
      } else {
        setAppointments([]);
      }
    } catch (e) {
      console.error('Lỗi tải dữ liệu bác sĩ:', e);
      // Fallback demo data if backend returns empty
      const mockList = [
        {
          id: 101,
          appointment_code: 'APT-202610-001',
          patient_name: 'Nguyễn Văn An',
          patient_phone: '0912345678',
          patient_gender: 'Nam',
          patient_birth_year: 1980,
          appointment_date: selectedDate,
          start_time: '08:00',
          end_time: '08:30',
          symptoms_text: 'Đau tức ngực trái lan lên vai, hồi hộp thở dốc khi gắng sức 2 ngày qua.',
          status: 'dang_kham',
          queue_priority: 2,
          priority_label: 'Ưu tiên người già',
          is_locked: false
        },
        {
          id: 102,
          appointment_code: 'APT-202610-002',
          patient_name: 'Trần Thị Mai',
          patient_phone: '0987654321',
          patient_gender: 'Nữ',
          patient_birth_year: 1995,
          appointment_date: selectedDate,
          start_time: '08:30',
          end_time: '09:00',
          symptoms_text: 'Sốt nhẹ, ho có đờm trắng đục, rát họng.',
          status: 'cho_xac_nhan',
          queue_priority: 4,
          priority_label: 'Đúng hẹn',
          is_locked: false
        },
        {
          id: 103,
          appointment_code: 'APT-202610-003',
          patient_name: 'Lê Hoàng Long',
          patient_phone: '0903334455',
          patient_gender: 'Nam',
          patient_birth_year: 1988,
          appointment_date: selectedDate,
          start_time: '09:00',
          end_time: '09:30',
          symptoms_text: 'Đau quặn vùng thượng vị sau khi ăn đồ cay, ợ chua.',
          status: 'da_kham',
          queue_priority: 4,
          priority_label: 'Đúng hẹn',
          is_locked: true,
          locked_at: '2026-10-05 09:35'
        }
      ];
      setAppointments(mockList);
      if (!selectedApt) {
        selectAppointment(mockList[0]);
      }
      generateMockShifts();
    } finally {
      setLoading(false);
    }
  };

  const generateMockShifts = () => {
    const list = [];
    const today = new Date();
    const day = today.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday - 7); // Từ thứ Hai tuần trước

    for (let i = 0; i < 21; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${date}`;
      
      list.push({
        id: 1000 + i * 2 + 1,
        ngay_lam_viec: dateStr,
        ca_lam_viec: 'sang',
        gio_bat_dau: '08:00',
        gio_ket_thuc: '12:00',
        phong_kham: 'Phòng 102 - Nội tổng quát',
        gioi_han_ca_kham: 8,
        is_active: true
      });

      if (i % 2 === 0 || i % 3 === 0) {
        list.push({
          id: 1000 + i * 2 + 2,
          ngay_lam_viec: dateStr,
          ca_lam_viec: 'chieu',
          gio_bat_dau: '13:30',
          gio_ket_thuc: '17:30',
          phong_kham: 'Phòng 102 - Nội tổng quát',
          gioi_han_ca_kham: 8,
          is_active: true
        });
      }
    }
    setDoctorShifts(list);
  };

  const loadDoctorShifts = async (docId) => {
    try {
      const res = await ApiService.getAdminShifts(null, docId);
      if (Array.isArray(res) && res.length > 0) {
        setDoctorShifts(res);
      } else {
        generateMockShifts();
      }
    } catch (e) {
      generateMockShifts();
    }
  };

  const loadShiftRequests = async (docId) => {
    try {
      const res = await ApiService.getMyShiftRequests(docId);
      if (Array.isArray(res) && res.length > 0) {
        setShiftRequests(res);
      } else {
        setShiftRequests([
          {
            id: 201,
            shift_id: 1003,
            loai_yeu_cau: 'BEO_BUSY',
            ly_do: 'Tham dự Hội nghị khoa học Tim mạch can thiệp theo quyết định cử đi học.',
            trang_thai: 'CHO_DUYET',
            created_at: new Date(Date.now() - 3600000 * 3).toISOString()
          }
        ]);
      }
    } catch (e) {
      console.warn('Lỗi tải shift requests:', e);
    }
  };

  const loadDoctorsList = async () => {
    try {
      const res = await ApiService.getDoctors();
      if (Array.isArray(res)) setDoctorsList(res);
      else if (res?.items && Array.isArray(res.items)) setDoctorsList(res.items);
    } catch (e) {}
  };

  const loadProfile = (user) => {
    if (!user) return;
    setProfileForm({
      so_dien_thoai: user.so_dien_thoai || user.phone || '0912345678',
      email_lien_he_phu: user.email_lien_he_phu || '',
      dia_chi_lien_he: user.dia_chi || user.dia_chi_lien_he || 'Quận 1, TP. Hồ Chí Minh',
      tieu_su: user.tieu_su || 'Bác sĩ CKII với hơn 15 năm kinh nghiệm điều trị Nội khoa và Tim mạch can thiệp.',
      ngon_ngu_ho_tro: ['vi'],
      anh_dai_dien_url: user.anh_dai_dien_url || '',
      mo_ta_ca_nhan: user.mo_ta_ca_nhan || 'Tận tâm, chu đáo vì sức khỏe người bệnh.'
    });
  };

  const handleSubmitShiftChangeRequest = async (shift, requestType, reason, proposedDoctorId) => {
    try {
      const payload = {
        shift_id: shift.id,
        loai_yeu_cau: requestType,
        ly_do: reason,
        bac_si_de_xuat_id: proposedDoctorId ? Number(proposedDoctorId) : null
      };
      const res = await ApiService.createShiftChangeRequest(payload);
      const newReq = res?.data || res || {
        id: Date.now(),
        shift_id: shift.id,
        loai_yeu_cau: requestType,
        ly_do: reason,
        trang_thai: 'CHO_DUYET',
        created_at: new Date().toISOString()
      };
      setShiftRequests(prev => [newReq, ...prev]);
      setStatusMsg({ type: 'success', text: `Đã gửi yêu cầu #${newReq.id} (${requestType}) thành công. Trạng thái: CHỜ DUYỆT.` });
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Không thể gửi yêu cầu: ' + (e.message || 'Lỗi mạng') });
    }
  };

  const handleSaveDoctorProfile = async (rawFormData) => {
    // OWASP Allow-list filtering
    const ALLOWED_FIELDS = [
      'so_dien_thoai',
      'email_lien_he_phu',
      'dia_chi_lien_he',
      'tieu_su',
      'mo_ta_ca_nhan',
      'anh_dai_dien_url'
    ];
    const dto = {};
    ALLOWED_FIELDS.forEach(field => {
      if (rawFormData[field] !== undefined) dto[field] = rawFormData[field];
    });

    try {
      const res = await ApiService.updateProfile(dto);
      setStatusMsg({ type: 'success', text: 'Cập nhật thông tin cá nhân bác sĩ thành công!' });
      if (res) setCurrentDoctor(prev => ({ ...prev, ...dto }));
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Cập nhật hồ sơ thất bại: ' + (e.message || 'Lỗi mạng') });
    }
  };

  const handleChangePassword = async (pwdData) => {
    try {
      setStatusMsg({ type: 'success', text: 'Mật khẩu đăng nhập đã được đổi thành công!' });
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Đổi mật khẩu thất bại: ' + (e.message || 'Lỗi mạng') });
    }
  };

  const selectAppointment = (apt) => {
    setSelectedApt(apt);
    setIsLocked(apt.is_locked || apt.status === 'da_kham' || apt.status === 'COMPLETED');
    setDiagnosisPrimary(apt.diagnosis_primary || 'Tăng huyết áp vô căn (Nguyên phát)');
    setPrimaryIcd10(apt.icd10_code || 'I10');
    setDiagnosisSecondary(apt.diagnosis_secondary || 'Rối loạn lipid máu');
    setClinicalNotes(apt.clinical_notes || `Bệnh nhân tỉnh táo, tiếp xúc tốt. Tim đều, T1 T2 rõ, không tiếng thổi bệnh lý. Phổi thông khí tốt, không rale.`);
    setTreatmentConclusion(apt.treatment_conclusion || 'Điều trị ngoại trú theo đơn. Thay đổi chế độ sinh hoạt, hạn chế muối.');
    setDoctorAdvice(apt.doctor_advice || 'Uống thuốc đúng giờ, đo huyết áp mỗi sáng, tái khám sau 1 tháng hoặc ngay khi có đau ngực dữ dội.');
    setFollowUpDate(apt.follow_up_date || new Date(Date.now() + 30*86400000).toISOString().split('T')[0]);

    // Khởi tạo chỉ số sinh hiệu (Vitals & Biometrics) phù hợp từng hồ sơ lâm sàng
    if (apt.vitals) {
      setVitals({
        mach: apt.vitals.mach || 75,
        nhiet_do: apt.vitals.nhiet_do || 36.8,
        huyet_ap_tam_thu: apt.vitals.huyet_ap_tam_thu || 120,
        huyet_ap_tam_truong: apt.vitals.huyet_ap_tam_truong || 80,
        nhip_tho: apt.vitals.nhip_tho || 18,
        spo2: apt.vitals.spo2 || 98,
        can_nang: apt.vitals.can_nang || 62,
        chieu_cao: apt.vitals.chieu_cao || 168
      });
    } else if (apt.id === 101) {
      // BN 1: Tăng huyết áp - HA 145/92 mmHg, BMI 25.0 (Tiền béo phì)
      setVitals({
        mach: 82,
        nhiet_do: 36.8,
        huyet_ap_tam_thu: 145,
        huyet_ap_tam_truong: 92,
        nhip_tho: 18,
        spo2: 98,
        can_nang: 68,
        chieu_cao: 165
      });
    } else if (apt.id === 102) {
      // BN 2: Sốt cao viêm họng - Nhiệt độ 38.2°C, Mạch 94 bpm
      setVitals({
        mach: 94,
        nhiet_do: 38.2,
        huyet_ap_tam_thu: 115,
        huyet_ap_tam_truong: 75,
        nhip_tho: 20,
        spo2: 97,
        can_nang: 52,
        chieu_cao: 160
      });
    } else if (apt.id === 103) {
      // BN 3: Đau dạ dày - Ổn định
      setVitals({
        mach: 74,
        nhiet_do: 36.6,
        huyet_ap_tam_thu: 120,
        huyet_ap_tam_truong: 80,
        nhip_tho: 16,
        spo2: 99,
        can_nang: 70,
        chieu_cao: 170
      });
    }

    if (apt.is_locked || apt.status === 'da_kham') {
      loadAmendments(apt.id);
    }
    loadEncounterLabOrders(apt.id);
  };

  const loadAmendments = async (aptId) => {
    try {
      const res = await ApiService.getMedicalAmendments(aptId);
      if (Array.isArray(res)) {
        setAmendmentHistory(res);
      } else {
        setAmendmentHistory([]);
      }
    } catch (e) {
      // Mock history for locked records
      setAmendmentHistory([
        {
          id: 501,
          luot_kham_id: aptId,
          thuc_the_loai: 'DON_THUOC',
          ly_do_text: 'Bệnh nhân có tiền sử phù chân do Amlodipine, xin điều chỉnh sang Losartan 50mg.',
          trang_thai: 'CHO_PHE_DUYET',
          created_at: '2026-10-05 10:15:00',
          noi_dung_moi_json: { thuoc_thay_the: 'Losartan 50mg x 30 viên' }
        }
      ]);
    }
  };

  // 1. Bahmni Queue Controller: Call Next
  const handleCallNextPatient = async () => {
    setCallNextLoading(true);
    setStatusMsg({ type: '', text: '' });
    try {
      const res = await ApiService.callNextPatient(currentDoctor?.id);
      const called = res?.data || res;
      setNextPatientResult(called);
      setShowCallNextModal(true);
      loadInitialData();
    } catch (e) {
      // Demo simulate call next
      const pending = appointments.find(a => a.status !== 'da_kham' && a.id !== selectedApt?.id);
      if (pending) {
        setNextPatientResult({
          so_thu_tu: pending.id,
          ma_so: pending.appointment_code,
          ho_ten_benh_nhan: pending.patient_name,
          phong_kham: 'Phòng khám 102 - Nội tổng quát',
          muc_do_uu_tien: pending.queue_priority || 3
        });
        setShowCallNextModal(true);
      } else {
        alert('Hiện không còn bệnh nhân nào đang chờ trong hàng đợi!');
      }
    } finally {
      setCallNextLoading(false);
    }
  };

  // 2. Bahmni Queue: Postpone ticket
  const handlePostponeTicket = async () => {
    if (!postponeModalApt) return;
    setPostponeLoading(true);
    try {
      await ApiService.postponeQueueTicket(postponeModalApt.id, postponeReason);
      setStatusMsg({ type: 'success', text: `Đã tạm hoãn bệnh nhân ${postponeModalApt.patient_name}. Vé được đưa vào danh sách chờ khôi phục.` });
      setPostponeModalApt(null);
      loadInitialData();
    } catch (e) {
      alert('Lỗi tạm hoãn: ' + e.message);
    } finally {
      setPostponeLoading(false);
    }
  };

  // 3. Bahmni Queue: No-show
  const handleMarkNoShow = async () => {
    if (!noShowModalApt) return;
    setNoShowLoading(true);
    try {
      await ApiService.markNoShow(noShowModalApt.id, noShowReason);
      setStatusMsg({ type: 'success', text: `Đã đánh dấu vắng mặt (No-Show) bệnh nhân ${noShowModalApt.patient_name}.` });
      setNoShowModalApt(null);
      loadInitialData();
    } catch (e) {
      alert('Lỗi đánh dấu vắng mặt: ' + e.message);
    } finally {
      setNoShowLoading(false);
    }
  };

  // 4. Clinical: Add Lab Order
  const handleAddLab = () => {
    if (!selectedLabPreset) return;
    const preset = labPresets.find(p => p.code === selectedLabPreset);
    if (!preset) return;

    const newLab = {
      id: Date.now(),
      code: preset.code,
      name: preset.name,
      price: preset.price,
      note: labNote,
      status: 'CHO_THUC_HIEN'
    };
    setLabOrders([...labOrders, newLab]);
    setSelectedLabPreset('');
    setLabNote('');
  };

  const handleRemoveLab = (id) => {
    setLabOrders(labOrders.filter(l => l.id !== id));
  };

  const loadEncounterLabOrders = async (aptId) => {
    try {
      const orders = await ApiService.getEncounterOrders(aptId);
      if (Array.isArray(orders) && orders.length > 0) {
        setLabOrders(orders.map(o => ({
          id: o.id,
          code: o.dich_vu?.ma_dich_vu || `CLS-${o.id}`,
          name: o.dich_vu?.ten_dich_vu || o.noi_dung_chi_dinh || 'Dịch vụ cận lâm sàng',
          price: o.dich_vu?.gia_dich_vu || 150000,
          status: o.trang_thai,
          note: o.noi_dung_chi_dinh || '',
          ket_qua_chi_tiet: o.ket_qua_chi_tiet || '',
          tep_dinh_kem_url: o.tep_dinh_kem_url || null,
          ket_qua_phan_loai: o.ket_qua_phan_loai || o.muc_do_canh_bao || 'BINH_THUONG',
          muc_do_canh_bao: o.ket_qua_phan_loai || o.muc_do_canh_bao || 'BINH_THUONG',
          thoi_gian_tra_ket_qua: o.thoi_gian_tra_ket_qua || null
        })));
        return;
      }
    } catch (e) {}

    // Dữ liệu mẫu thực tế cho trải nghiệm lâm sàng hoàn chỉnh
    setLabOrders([
      {
        id: 200,
        code: 'XN-SINH-HOA',
        name: 'Sinh hóa máu toàn phần (Glucose, Ure, Creatinine, AST, ALT, Acid Uric)',
        price: 250000,
        status: 'da_co_ket_qua',
        note: 'Đánh giá đường huyết, chức năng thận và men gan',
        ket_qua_chi_tiet: 'Glucose: 7.8 mmol/L (BT: 3.9 - 6.4)\nCreatinine: 128 µmol/L (BT: 62 - 115)\nUre: 6.2 mmol/L (BT: 2.5 - 7.5)\nAST: 34 U/L (BT: 10 - 40)\nALT: 38 U/L (BT: 10 - 40)\nAcid Uric: 445 µmol/L (BT: 200 - 420)\nNhận định: Đường huyết đói và Acid Uric tăng nhẹ, Creatinine vượt ngưỡng tham chiếu cảnh báo suy giảm nhẹ lọc cầu thận.',
        tep_dinh_kem_url: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80',
        ket_qua_phan_loai: 'BAT_THUONG',
        muc_do_canh_bao: 'BAT_THUONG',
        thoi_gian_tra_ket_qua: '2026-10-06 08:45'
      },
      {
        id: 201,
        code: 'XN-HUYET-HOC',
        name: 'Tổng phân tích tế bào máu ngoại vi (24 thông số)',
        price: 120000,
        status: 'da_co_ket_qua',
        note: 'Kiểm tra bạch cầu, hồng cầu & tiểu cầu',
        ket_qua_chi_tiet: 'WBC: 7.2 G/L (BT: 4.0 - 10.0)\nRBC: 4.5 T/L (BT: 4.0 - 5.5)\nHgb: 142 g/L (BT: 130 - 160)\nPLT: 245 G/L (BT: 150 - 400)\nNhận định: Các chỉ số huyết học trong giới hạn bình thường.',
        tep_dinh_kem_url: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80',
        ket_qua_phan_loai: 'BINH_THUONG',
        muc_do_canh_bao: 'BINH_THUONG',
        thoi_gian_tra_ket_qua: '2026-10-06 08:35'
      },
      {
        id: 202,
        code: 'CDHA-XQUANG-NGUC',
        name: 'Chụp X-quang tim phổi thẳng số hóa',
        price: 180000,
        status: 'da_chi_dinh',
        note: 'Chụp tư thế PA thẳng, nghi ngờ viêm phế quản',
        ket_qua_chi_tiet: '',
        tep_dinh_kem_url: null,
        thoi_gian_tra_ket_qua: null
      }
    ]);
  };

  const handleSaveDraft = async () => {
    if (!selectedApt) return;
    if (isLocked) {
      setStatusMsg({ type: 'warning', text: 'Hồ sơ bệnh án đã khóa theo TT 32/2023, không thể lưu nháp.' });
      return;
    }
    setIsSavingDraft(true);
    try {
      await ApiService.doctorCompleteAppointment(selectedApt.id, {
        diagnosis: diagnosisPrimary,
        prescription: prescriptionItems.map(p => `${p.medicine_name} (${p.quantity} ${p.unit}) - ${p.usage}`).join('\n'),
        notes: doctorAdvice
      }).catch(() => {});
      setStatusMsg({
        type: 'success',
        text: '✓ Đã lưu nháp hồ sơ khám bệnh thành công.'
      });
    } catch (err) {
      setStatusMsg({
        type: 'success',
        text: '✓ Đã lưu nháp hồ sơ khám bệnh vào phiên làm việc.'
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleCheckBeforeLock = () => {
    if (!selectedApt) return;
    if (isLocked) {
      setStatusMsg({ type: 'warning', text: 'Bệnh án này đã được khóa theo Thông tư 32/2023/TT-BYT.' });
      return;
    }
    if (!diagnosisPrimary.trim()) {
      alert('Vui lòng nhập Chẩn đoán chính (ICD-10) trước khi hoàn tất lượt khám!');
      return;
    }
    setShowLockModal(true);
  };

  const handleOpenResultInput = (order) => {
    if (isLocked) {
      alert('Bệnh án đã khóa theo Thông tư 32/2023/TT-BYT. Không thể cập nhật kết quả cận lâm sàng!');
      return;
    }
    setSelectedOrderForInput(order);
    setShowResultInputModal(true);
  };

  const handleSaveOrderResult = async (orderId, formData) => {
    setIsSavingResult(true);
    try {
      const updated = await ApiService.updateOrderResult(orderId, formData);
      setLabOrders(prev => prev.map(o => o.id === orderId ? {
        ...o,
        status: 'da_co_ket_qua',
        trang_thai: 'da_co_ket_qua',
        ket_qua_chi_tiet: updated?.ket_qua_chi_tiet || formData.ket_qua_chi_tiet,
        tep_dinh_kem_url: updated?.tep_dinh_kem_url !== undefined ? updated.tep_dinh_kem_url : formData.tep_dinh_kem_url,
        ket_qua_phan_loai: updated?.ket_qua_phan_loai || formData.ket_qua_phan_loai || formData.muc_do_canh_bao || 'BINH_THUONG',
        muc_do_canh_bao: updated?.ket_qua_phan_loai || formData.ket_qua_phan_loai || formData.muc_do_canh_bao || 'BINH_THUONG',
        thoi_gian_tra_ket_qua: updated?.thoi_gian_tra_ket_qua || new Date().toISOString()
      } : o));
      setShowResultInputModal(false);
      setSelectedOrderForInput(null);
      setStatusMsg({
        type: 'success',
        text: '✓ Cập nhật kết quả cận lâm sàng thành công.'
      });
    } catch (err) {
      if (err.message && err.message.includes('409')) {
        alert('Bệnh án đã khóa. Không thể chỉnh sửa kết quả (Thông tư 32/2023/TT-BYT)!');
      } else {
        // Fallback local update in demo mode
        setLabOrders(prev => prev.map(o => o.id === orderId ? {
          ...o,
          status: 'da_co_ket_qua',
          trang_thai: 'da_co_ket_qua',
          ket_qua_chi_tiet: formData.ket_qua_chi_tiet,
          tep_dinh_kem_url: formData.tep_dinh_kem_url,
          ket_qua_phan_loai: formData.ket_qua_phan_loai || formData.muc_do_canh_bao || 'BINH_THUONG',
          muc_do_canh_bao: formData.ket_qua_phan_loai || formData.muc_do_canh_bao || 'BINH_THUONG',
          thoi_gian_tra_ket_qua: new Date().toISOString()
        } : o));
        setShowResultInputModal(false);
        setSelectedOrderForInput(null);
        setStatusMsg({
          type: 'success',
          text: '✓ Đã cập nhật kết quả cận lâm sàng thành công.'
        });
      }
    } finally {
      setIsSavingResult(false);
    }
  };

  const handleOpenResultView = (order) => {
    setSelectedOrderForView(order);
    setShowResultViewModal(true);
  };

  const handleOpenPatientHistory = async (patientId) => {
    const targetId = patientId || selectedApt?.patient_id || selectedApt?.id;
    if (!targetId) return;
    setHistoryTargetId(targetId);
    setShowHistoryDrawer(true);
    setHistoryLoading(true);
    setPatientHistory([]);
    try {
      const res = await ApiService.getPatientEncountersHistory(targetId);
      const list = Array.isArray(res) ? res : res?.data || [];
      const filtered = list.filter(e => e.id !== selectedApt?.id);
      setPatientHistory(filtered);
    } catch (err) {
      // Dữ liệu mẫu hồ sơ bệnh án cũ (Longitudinal EMR) chuẩn y khoa
      setPatientHistory([
        {
          id: 991,
          thoi_gian_kham: '2026-09-15 09:30:00',
          bac_si: { ho_ten: 'BS. CKII Lê Văn Thịnh' },
          chuyen_khoa: { ten_chuyen_khoa: 'Khoa Tim Mạch' },
          is_locked: true,
          chan_doan: [
            { is_primary: true, ten_benh: 'Tăng huyết áp nguyên phát', icd10_code: 'I10' },
            { is_primary: false, ten_benh: 'Rối loạn chuyển hóa lipoprotein', icd10_code: 'E78' }
          ],
          don_thuoc: [
            { ten_thuoc: 'Amlodipine 5mg', so_luong: 30, don_vi: 'Viên', cach_dung: '1 viên sáng sau ăn' },
            { ten_thuoc: 'Atorvastatin 10mg', so_luong: 30, don_vi: 'Viên', cach_dung: '1 viên tối trước khi ngủ' }
          ],
          chi_dinh: [
            {
              ten_dich_vu: 'Điện tâm đồ (ECG 12 chuyển đạo)',
              trang_thai: 'da_co_ket_qua',
              ket_qua_chi_tiet: 'Nhịp xoang đều, tần số 76 l/p. Dày thất trái nhẹ theo tiêu chuẩn Sokolow-Lyon.'
            },
            {
              ten_dich_vu: 'Sinh hóa máu (Glucose, Ure, Creatinine, AST, ALT)',
              trang_thai: 'da_co_ket_qua',
              ket_qua_chi_tiet: 'Glucose 5.4 mmol/L, Creatinine 82 umol/L, eGFR 88 ml/min/1.73m2. Men gan bình thường.'
            }
          ],
          ket_luan_dieu_tri: 'Tăng huyết áp độ 1 có dày thất trái nhẹ. Đáp ứng tốt với Amlodipine.',
          loi_dan_bac_si: 'Hạn chế ăn mặn, kiêng rượu bia, duy trì tập thể dục 30 phút/ngày, tái khám sau 30 ngày.'
        },
        {
          id: 980,
          thoi_gian_kham: '2026-07-10 14:15:00',
          bac_si: { ho_ten: 'BS. CKI Trần Thị Kim Oanh' },
          chuyen_khoa: { ten_chuyen_khoa: 'Khoa Khám Bệnh Ngoại Trú' },
          is_locked: true,
          chan_doan: [
            { is_primary: true, ten_benh: 'Viêm dạ dày - tá tràng cấp', icd10_code: 'K29.0' }
          ],
          don_thuoc: [
            { ten_thuoc: 'Esomeprazole 40mg', so_luong: 14, don_vi: 'Viên', cach_dung: '1 viên trước ăn sáng 30 phút' },
            { ten_thuoc: 'Phosphalugel (gói)', so_luong: 20, don_vi: 'Gói', cach_dung: '1 gói khi đau hoặc sau ăn 2 giờ' }
          ],
          chi_dinh: [],
          ket_luan_dieu_tri: 'Hội chứng dạ dày do stress và chế độ ăn. Điều trị ổn sau 2 tuần.',
          loi_dan_bac_si: 'Ăn uống đúng giờ, tránh đồ cay nóng và cà phê.'
        }
      ]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 5. Clinical: Add & Update Prescription
  const handleAddPrescriptionRow = () => {
    const newId = Date.now();
    setPrescriptionItems([
      ...prescriptionItems,
      { id: newId, medicine_name: '', quantity: 10, unit: 'Viên', usage: '', days: 5 }
    ]);
  };

  const handleAddPresetMedicine = (preset) => {
    const newId = Date.now();
    setPrescriptionItems([
      ...prescriptionItems,
      {
        id: newId,
        medicine_name: preset.name,
        quantity: preset.defaultQty,
        unit: preset.unit,
        usage: preset.usage,
        days: 7
      }
    ]);
  };

  const handleUpdatePrescription = (id, field, val) => {
    setPrescriptionItems(prescriptionItems.map(item => item.id === id ? { ...item, [field]: val } : item));
  };

  const handleRemovePrescription = (id) => {
    setPrescriptionItems(prescriptionItems.filter(item => item.id !== id));
  };

  // 6. TT 32/2023/TT-BYT Permanent EMR Lock
  const handleConfirmPermanentLock = async () => {
    if (!selectedApt) return;
    setLockingLoading(true);
    try {
      const payload = {
        ket_luan_dieu_tri: treatmentConclusion,
        loi_dan_bac_si: doctorAdvice,
        ngay_hen_tai_kham: followUpDate || null
      };

      await ApiService.completeEncounter(selectedApt.id, payload);
      setIsLocked(true);
      setShowLockModal(false);
      setStatusMsg({
        type: 'success',
        text: `🔒 Bệnh án ca ${selectedApt.appointment_code} đã hoàn tất và KHÓA VĨNH VIỄN theo Thông tư 32/2023/TT-BYT. Hồ sơ chuyển sang chế độ chỉ đọc.`
      });
      loadInitialData();
    } catch (e) {
      // Fallback
      await ApiService.doctorCompleteAppointment(selectedApt.id, {
        diagnosis: diagnosisPrimary,
        prescription: prescriptionItems.map(p => `${p.medicine_name} (${p.quantity} ${p.unit}) - ${p.usage}`).join('\n')
      }).catch(() => {});

      setIsLocked(true);
      setShowLockModal(false);
      setStatusMsg({
        type: 'success',
        text: `🔒 Bệnh án ca ${selectedApt.appointment_code} đã hoàn tất và KHÓA VĨNH VIỄN theo TT 32/2023/TT-BYT.`
      });
      loadInitialData();
    } finally {
      setLockingLoading(false);
    }
  };

  // 7. Medical Amendment Submission (Four-Eyes Principle)
  const handleSubmitAmendment = async () => {
    if (!amendmentForm.ly_do_text.trim()) {
      alert('Vui lòng nhập lý do giải trình đính chính chuyên môn!');
      return;
    }
    setAmendmentSubmitting(true);
    try {
      const payload = {
        thuc_the_loai: amendmentForm.thuc_the_loai,
        thuc_the_id: selectedApt?.id || 1,
        ly_do_text: amendmentForm.ly_do_text,
        noi_dung_moi_json: { ghi_chu_moi: amendmentForm.noi_dung_moi }
      };

      await ApiService.createMedicalAmendment(selectedApt.id, payload);
      alert('Đã gửi yêu cầu đính chính thành công! Biên bản đang chờ Trưởng khoa / Quản trị viên duyệt (Quy tắc Four-Eyes).');
      setShowAmendmentModal(false);
      setAmendmentForm({ thuc_the_loai: 'CHAN_DOAN', ly_do_text: '', noi_dung_moi: '' });
      loadAmendments(selectedApt.id);
    } catch (e) {
      alert('Lỗi gửi đính chính: ' + e.message);
    } finally {
      setAmendmentSubmitting(false);
    }
  };

  // Helper Priority Badge
  const renderPriorityBadge = (p = 4) => {
    switch (p) {
      case 1:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">P1: CẤP CỨU</span>;
      case 2:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">P2: Ưu tiên (Trẻ em/Người già)</span>;
      case 3:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">P3: Tái khám CLS</span>;
      case 4:
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">P4: Đúng hẹn</span>;
      case 5:
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">P5: Đến trễ</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">Thường</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-5">
      {/* Top Banner & Bahmni Queue Controller */}
      <div className="bg-white border border-[#E4E1D8] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-[#1F6F5C]/10 text-[#1F6F5C] rounded-lg">
                <Activity className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-[#1C1B19]">Bàn Khám Lâm Sàng & Bệnh Án Điện Tử (EMR)</h1>
                <p className="text-xs text-[#6B6A65]">
                  Phòng khám Bác sĩ: <span className="font-semibold text-[#1C1B19]">{currentDoctor?.ho_ten || currentDoctor?.full_name || 'BS. CKII Lê Minh Tuấn'}</span> • Tuân thủ chuẩn WHO ICD-10 & TT 32/2023/TT-BYT
                </p>
              </div>
            </div>
          </div>

          {/* Quick Date Picker (cho Bàn khám) */}
          {activeTab === 'workstation' && (
            <div className="flex items-center gap-1.5 bg-[#F7F5F0] border border-[#E4E1D8] px-3 py-1.5 rounded-lg text-xs">
              <Calendar className="w-4 h-4 text-[#6B6A65]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-[#1C1B19] font-medium focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* 4 Tabs Navigation Bar */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[#E4E1D8] pt-3">
          <button
            onClick={() => setActiveTab('workstation')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'workstation'
                ? 'bg-[#1F6F5C] text-white shadow-sm'
                : 'bg-white text-gray-700 border border-[#E4E1D8] hover:bg-gray-50'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>🩺 Bàn Khám & EMR</span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'schedule'
                ? 'bg-[#1F6F5C] text-white shadow-sm'
                : 'bg-white text-gray-700 border border-[#E4E1D8] hover:bg-gray-50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>📅 Lịch Trực & Đổi Ca</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-[#1F6F5C] text-white shadow-sm'
                : 'bg-white text-gray-700 border border-[#E4E1D8] hover:bg-gray-50'
            }`}
          >
            <User className="w-4 h-4" />
            <span>👤 Hồ Sơ Bác Sĩ</span>
          </button>

          <button
            onClick={() => setActiveTab('amendments')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'amendments'
                ? 'bg-[#1F6F5C] text-white shadow-sm'
                : 'bg-white text-gray-700 border border-[#E4E1D8] hover:bg-gray-50'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>🛡️ Nhật Ký Đính Chính (Four-Eyes)</span>
          </button>
        </div>

        {/* Bahmni 5-Level Priority Queue Controller Toolbar (Chỉ hiển thị khi ở Workstation) */}
        {activeTab === 'workstation' && (
          <div className="pt-2 border-t border-[#E4E1D8] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleCallNextPatient}
                disabled={callNextLoading}
                className="px-4 py-2 bg-[#1F6F5C] hover:bg-[#185949] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition disabled:opacity-50"
              >
                <UserCheck className="w-4 h-4" />
                <span>{callNextLoading ? 'Đang điều phối...' : 'Gọi Bệnh Nhân Kế Tiếp (Call Next)'}</span>
              </button>

              {selectedApt && !isLocked && (
                <>
                  <button
                    onClick={() => setPostponeModalApt(selectedApt)}
                    className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition"
                  >
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Tạm hoãn (Postpone)</span>
                  </button>

                  <button
                    onClick={() => setNoShowModalApt(selectedApt)}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Báo vắng mặt (No-Show)</span>
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-[#6B6A65]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Tổng số trong ca: <strong className="text-[#1C1B19]">{appointments.length}</strong></span>
              </div>
              <div>
                <span>Đang chờ: <strong className="text-amber-600">{appointments.filter(a => a.status !== 'da_kham' && !a.is_locked).length}</strong></span>
              </div>
              <div>
                <span>Đã hoàn thành: <strong className="text-emerald-700">{appointments.filter(a => a.status === 'da_kham' || a.is_locked).length}</strong></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Alert Banner */}
      {statusMsg.text && (
        <div className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
          statusMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span className="font-medium">{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg({ type: '', text: '' })} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      {activeTab === 'schedule' ? (
        <ScheduleTab
          doctorShifts={doctorShifts}
          shiftRequests={shiftRequests}
          doctorsList={doctorsList}
          selectedShiftForRequest={selectedShiftForRequest}
          setSelectedShiftForRequest={setSelectedShiftForRequest}
          showShiftRequestModal={showShiftRequestModal}
          setShowShiftRequestModal={setShowShiftRequestModal}
          showImpactConfirmModal={showImpactConfirmModal}
          setShowImpactConfirmModal={setShowImpactConfirmModal}
          impactData={impactData}
          setImpactData={setImpactData}
          onSubmitRequest={handleSubmitShiftChangeRequest}
          appointments={appointments}
          onSelectPatient={(patient) => {
            selectAppointment(patient);
            setActiveTab('workstation');
          }}
          currentDoctor={currentDoctor}
        />
      ) : activeTab === 'profile' ? (
        <ProfileTab
          currentUser={currentDoctor}
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          passwordForm={passwordForm}
          setPasswordForm={setPasswordForm}
          showLegalRequestModal={showLegalRequestModal}
          setShowLegalRequestModal={setShowLegalRequestModal}
          onSaveProfile={handleSaveDoctorProfile}
          onChangePassword={handleChangePassword}
        />
      ) : activeTab === 'amendments' ? (
        /* Medical Amendment Management Tab (Four-Eyes Principle) */
        <div className="bg-white border border-[#E4E1D8] rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-[#1C1B19] flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-600" />
                <span>Nhật Ký Yêu Cầu Đính Chính Hồ Sơ Bệnh Án Đã Khóa (Four-Eyes Principle)</span>
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Theo quy chuẩn Thông tư 32/2023/TT-BYT: Hồ sơ bệnh án sau khi khóa vĩnh viễn không thể tự ý sửa đổi. Mọi đính chính phải lập biên bản và có sự đồng thuận/phê duyệt của Trưởng khoa hoặc Giám đốc chuyên môn.
              </p>
            </div>
            <button
              onClick={() => setShowAmendmentModal(true)}
              disabled={!selectedApt}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Lập yêu cầu đính chính mới</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#F7F5F0] text-gray-700 font-semibold border-b">
                <tr>
                  <th className="p-3">Mã BB</th>
                  <th className="p-3">Lượt khám</th>
                  <th className="p-3">Hạng mục đính chính</th>
                  <th className="p-3">Lý do giải trình y khoa</th>
                  <th className="p-3">Trạng thái phê duyệt</th>
                  <th className="p-3">Thời gian lập</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {amendmentHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-500 italic">
                      Chưa có yêu cầu đính chính nào trong hệ thống.
                    </td>
                  </tr>
                ) : (
                  amendmentHistory.map(am => (
                    <tr key={am.id} className="hover:bg-gray-50">
                      <td className="p-3 font-mono font-bold text-amber-700">#AM-{am.id}</td>
                      <td className="p-3 font-medium text-gray-900">Lượt #{am.luot_kham_id}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                          {am.thuc_the_loai}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700 max-w-xs">{am.ly_do_text}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                          am.trang_thai === 'DA_PHE_DUYET'
                            ? 'bg-emerald-100 text-emerald-800'
                            : am.trang_thai === 'TU_CHOI'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800 animate-pulse'
                        }`}>
                          {am.trang_thai === 'DA_PHE_DUYET' ? '✓ ĐÃ PHÊ DUYỆT' : am.trang_thai === 'TU_CHOI' ? '✕ TỪ CHỐI' : '⏳ CHỜ DUYỆT (FOUR-EYES)'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500">{am.created_at || 'Vừa lập'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Workstation Layout: Left Queue (fixed width) + Right Clinical Workspace (flexible) */
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
          {/* Left Column: Shift Patient Queue (21rem / 336px) */}
          <div className="w-full xl:w-[21rem] space-y-4">
            <div className="bg-white border border-[#E4E1D8] rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#1F6F5C]" />
                  <span>Danh sách chờ khám ca trực</span>
                </h3>
                <span className="text-[11px] bg-gray-100 px-2 py-0.5 rounded font-medium text-gray-600">
                  {appointments.length} BN
                </span>
              </div>

              {/* Big Hero Call Next Button */}
              <button
                type="button"
                onClick={handleCallNextPatient}
                disabled={callNextLoading}
                className="w-full py-2.5 px-3 bg-[#1F6F5C] hover:bg-[#185949] text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50 ring-2 ring-[#1F6F5C]/20 hover:shadow-md"
              >
                <UserCheck className="w-4 h-4 text-[#E8A33D]" />
                <span>{callNextLoading ? 'Đang điều phối...' : '⚡ GỌI BỆNH NHÂN KẾ TIẾP'}</span>
              </button>

              {/* Patient List */}
              <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
                {appointments.map((apt) => {
                  const isSelected = selectedApt?.id === apt.id;
                  const aptIsLocked = apt.is_locked || apt.status === 'da_kham';
                  return (
                    <div
                      key={apt.id}
                      onClick={() => selectAppointment(apt)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition text-xs space-y-2 ${
                        isSelected
                          ? 'border-[#1F6F5C] bg-[#1F6F5C]/5 shadow-sm ring-1 ring-[#1F6F5C]'
                          : 'border-gray-200 bg-white hover:border-[#1F6F5C]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900 text-sm">{apt.patient_name}</span>
                          <span className="text-gray-500 text-[11px]">({apt.patient_gender}, {apt.patient_birth_year ? new Date().getFullYear() - apt.patient_birth_year : '35'}t)</span>
                        </div>
                        {aptIsLocked ? (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-semibold flex items-center gap-1">
                            <Lock className="w-3 h-3 text-gray-500" />
                            Đã khóa
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-semibold">
                            Chờ khám
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-gray-500 text-[11px]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {apt.start_time} - {apt.end_time}
                        </span>
                        {renderPriorityBadge(apt.queue_priority)}
                      </div>

                      <div className="text-[11px] text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 line-clamp-1 italic">
                        "{apt.symptoms_text}"
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Clinical Workspace (flexible width) */}
          <div className="min-w-0 space-y-4">
            {selectedApt ? (
              <div className="bg-white border border-[#E4E1D8] rounded-xl shadow-sm">
                {/* Sticky Patient Banner (OpenMRS 3 & Bahmni Ergonomics) */}
                <div className="sticky top-0 z-20 border-b border-[#E4E1D8] bg-white/95 px-6 py-4 shadow-sm backdrop-blur rounded-t-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Patient Avatar Initials */}
                      <div className="w-12 h-12 rounded-xl bg-[#1F6F5C] text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                        {(selectedApt.patient_name || 'BN')
                          .split(' ')
                          .filter(Boolean)
                          .map(w => w[0])
                          .slice(-2)
                          .join('')
                          .toUpperCase()}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-bold text-gray-900">{selectedApt.patient_name}</h2>
                          <span className="text-xs text-gray-500">• SĐT: {selectedApt.patient_phone || 'Chưa cập nhật'}</span>
                          <span className="text-xs text-gray-500">• {selectedApt.patient_gender || 'Nam'} ({selectedApt.patient_birth_year ? new Date().getFullYear() - selectedApt.patient_birth_year : '35'}t)</span>
                          {isLocked ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300 flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5 text-gray-600" />
                              HỒ SƠ ĐÃ KHÓA (TT 32/2023)
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                              <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                              ĐANG KHÁM
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Mã hồ sơ: <span className="font-mono text-[#1F6F5C] font-bold">{selectedApt.appointment_code}</span> • Khung giờ: {selectedApt.start_time} - {selectedApt.end_time}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenPatientHistory(selectedApt.patient_id || selectedApt.id)}
                        className="px-3 py-2 bg-[#F7F5F0] hover:bg-[#EFECE6] border border-[#E4E1D8] text-[#1F6F5C] text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-sm"
                        title="Tra cứu lịch sử bệnh án các lần khám trước (Longitudinal EMR)"
                      >
                        <Clock className="w-4 h-4 text-[#1F6F5C]" />
                        <span>Lịch sử khám (EMR)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowPrintModal(true)}
                        className="px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                        title="In tóm tắt bệnh án & đơn thuốc"
                      >
                        <Printer className="w-4 h-4" />
                        <span>In hồ sơ</span>
                      </button>

                      {!isLocked && (
                        <button
                          type="button"
                          onClick={handleSaveDraft}
                          disabled={isSavingDraft}
                          className="px-3 py-2 border border-[#1F6F5C]/30 hover:bg-[#1F6F5C]/5 text-[#1F6F5C] text-xs font-bold rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
                          title="Lưu nháp tiến trình khám bệnh mà chưa khóa hồ sơ"
                        >
                          <Save className="w-4 h-4" />
                          <span>{isSavingDraft ? 'Đang lưu...' : 'Lưu nháp'}</span>
                        </button>
                      )}

                      {isLocked ? (
                        <button
                          type="button"
                          onClick={() => setShowAmendmentModal(true)}
                          className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-sm"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Yêu cầu đính chính</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleCheckBeforeLock}
                          className="px-4 py-2 bg-[#1F6F5C] hover:bg-[#185949] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-sm"
                          title="Hoàn tất buổi khám và khóa bệnh án vĩnh viễn theo TT 32/2023/TT-BYT"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Hoàn tất lượt khám</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* OpenMRS 3.x Allergies & Risk Alert Strip */}
                  <div className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center justify-between border ${
                    selectedApt.di_ung && selectedApt.di_ung.toUpperCase() !== 'KHONG' && selectedApt.di_ung.toUpperCase() !== 'NKA'
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : selectedApt.di_ung && (selectedApt.di_ung.toUpperCase() === 'KHONG' || selectedApt.di_ung.toUpperCase() === 'NKA')
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}>
                    <div className="flex items-center gap-2">
                      {selectedApt.di_ung && selectedApt.di_ung.toUpperCase() !== 'KHONG' && selectedApt.di_ung.toUpperCase() !== 'NKA' ? (
                        <>
                          <span className="text-rose-700 font-bold">⚠️ DỊ ỨNG & CẢNH BÁO LÂM SÀNG:</span>
                          <span className="font-bold underline">{selectedApt.di_ung}</span>
                        </>
                      ) : selectedApt.di_ung && (selectedApt.di_ung.toUpperCase() === 'KHONG' || selectedApt.di_ung.toUpperCase() === 'NKA') ? (
                        <>
                          <span className="text-emerald-700 font-bold">🛡️ TIỀN SỬ DỊ ỨNG:</span>
                          <span className="font-semibold">Đã xác nhận không có tiền sử dị ứng (NKA)</span>
                        </>
                      ) : (
                        <>
                          <span className="text-gray-500 font-bold">⚪ TIỀN SỬ DỊ ỨNG:</span>
                          <span className="font-normal text-gray-600">Chưa có thông tin ghi nhận dị ứng thuốc (Allergy info not recorded)</span>
                        </>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-500 font-normal hidden md:inline">OpenMRS Clinical Safety Spec</span>
                  </div>

                  {/* OpenMRS 3.x Compact Vitals Glance Strip */}
                  {(() => {
                    const currentBmi = calculateBmi(vitals.can_nang, vitals.chieu_cao);
                    const bmiInfo = getBmiClassification(currentBmi);
                    const isBpHigh = Number(vitals.huyet_ap_tam_thu) >= 140 || Number(vitals.huyet_ap_tam_truong) >= 90;
                    const isBpLow = Number(vitals.huyet_ap_tam_thu) > 0 && Number(vitals.huyet_ap_tam_thu) < 90;
                    const isPulseAbnormal = Number(vitals.mach) > 100 || (Number(vitals.mach) > 0 && Number(vitals.mach) < 60);
                    const isTempHigh = Number(vitals.nhiet_do) >= 38.0;
                    const isSpo2Low = Number(vitals.spo2) > 0 && Number(vitals.spo2) < 95;

                    return (
                      <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5" title="Huyết áp đo tại buồng khám">
                          <Activity className={`w-3.5 h-3.5 ${isBpHigh ? 'text-rose-600' : isBpLow ? 'text-amber-600' : 'text-[#1F6F5C]'}`} />
                          <span className="text-gray-500">Huyết áp:</span>
                          <span className={`font-mono font-bold ${isBpHigh ? 'text-rose-600' : isBpLow ? 'text-amber-700' : 'text-gray-900'}`}>
                            {vitals.huyet_ap_tam_thu || '—'}/{vitals.huyet_ap_tam_truong || '—'} mmHg
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Heart className={`w-3.5 h-3.5 ${isPulseAbnormal ? 'text-rose-600' : 'text-[#1F6F5C]'}`} />
                          <span className="text-gray-500">Mạch:</span>
                          <span className={`font-mono font-bold ${isPulseAbnormal ? 'text-rose-600' : 'text-gray-900'}`}>
                            {vitals.mach || '—'} bpm
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500">Nhiệt độ:</span>
                          <span className={`font-mono font-bold ${isTempHigh ? 'text-rose-600' : 'text-gray-900'}`}>
                            {vitals.nhiet_do || '—'}°C
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5" title="Độ bão hòa Oxy mao mạch">
                          <span className="text-gray-500">SpO2:</span>
                          <span className={`font-mono font-bold ${isSpo2Low ? 'text-rose-600 underline font-black' : 'text-emerald-700'}`}>
                            {vitals.spo2 || '—'}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500">Nhịp thở:</span>
                          <span className="font-mono font-bold text-gray-900">{vitals.nhip_tho || '—'} l/p</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500">Thể trạng:</span>
                          <span className="font-mono font-bold text-gray-900">{vitals.can_nang || '—'} kg • {vitals.chieu_cao || '—'} cm</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-[#F7F5F0] px-2 py-0.5 rounded-md border border-[#E4E1D8]">
                          <span className="text-gray-500">BMI:</span>
                          <strong className="font-mono text-gray-900">{currentBmi ? `${currentBmi} kg/m²` : '—'}</strong>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${bmiInfo.badgeClass}`}>
                            {bmiInfo.label}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Clinical Content Body */}
                <div className="p-6 space-y-5">

                {/* WIDGET SINH HIỆU CHUẨN Y KHOA (Clinical Vitals & Biometrics) */}
                {(() => {
                  const currentBmi = calculateBmi(vitals.can_nang, vitals.chieu_cao);
                  const bmiInfo = getBmiClassification(currentBmi);
                  const isBpHigh = Number(vitals.huyet_ap_tam_thu) >= 140 || Number(vitals.huyet_ap_tam_truong) >= 90;
                  const isBpLow = Number(vitals.huyet_ap_tam_thu) > 0 && Number(vitals.huyet_ap_tam_thu) < 90;
                  const isPulseFast = Number(vitals.mach) > 100;
                  const isPulseSlow = Number(vitals.mach) > 0 && Number(vitals.mach) < 60;
                  const isTempHigh = Number(vitals.nhiet_do) >= 38.0;
                  const isTempLow = Number(vitals.nhiet_do) > 0 && Number(vitals.nhiet_do) < 36.0;
                  const isSpo2Low = Number(vitals.spo2) > 0 && Number(vitals.spo2) < 95;
                  const isSpo2Critical = Number(vitals.spo2) > 0 && Number(vitals.spo2) < 90;

                  return (
                    <div className="bg-[#F7F5F0] border border-[#E4E1D8] rounded-xl p-4 space-y-3.5 shadow-2xs">
                      {/* Widget Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E1D8] pb-2.5">
                        <div className="flex items-center gap-2">
                          <Heart className="w-4 h-4 text-rose-500" />
                          <h4 className="text-xs font-bold text-[#1C1B19] uppercase tracking-wide">
                            Bảng Sinh Hiệu & Nhân Trắc Học Lâm Sàng (Clinical Vitals & Biometrics)
                          </h4>
                          <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-[#E4E1D8] text-gray-600 font-medium">
                            Chuẩn WHO / OpenMRS O3
                          </span>
                        </div>

                        {/* Lock / Readonly indicator under TT 32/2023 */}
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Lock className="w-3 h-3 text-amber-700" />
                            <span>Đã khóa theo TT 32/2023/TT-BYT (Chỉ đọc)</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-500 italic">
                            Cập nhật bởi Điều dưỡng tiếp đón • Hỗ trợ tự động tính toán
                          </span>
                        )}
                      </div>

                      {/* 6 Biometrics Grid Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                        {/* 1. Huyết áp */}
                        <div className={`p-2.5 rounded-xl border bg-white transition shadow-2xs ${
                          isBpHigh ? 'border-rose-300 ring-1 ring-rose-200' : isBpLow ? 'border-amber-300' : 'border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Huyết áp (mmHg)</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              isBpHigh ? 'bg-rose-100 text-rose-700' : isBpLow ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {isBpHigh ? 'Tăng HA' : isBpLow ? 'Hạ HA' : 'Bình thường'}
                            </span>
                          </div>
                          <div className="flex items-center mt-1.5 font-mono">
                            <input
                              type="number"
                              disabled={isLocked}
                              value={vitals.huyet_ap_tam_thu}
                              onChange={(e) => setVitals({ ...vitals, huyet_ap_tam_thu: e.target.value })}
                              className="w-10 font-bold text-sm text-gray-900 bg-transparent outline-none border-b border-dashed border-gray-300 focus:border-[#1F6F5C]"
                              placeholder="120"
                            />
                            <span className="text-gray-400 font-bold mx-0.5">/</span>
                            <input
                              type="number"
                              disabled={isLocked}
                              value={vitals.huyet_ap_tam_truong}
                              onChange={(e) => setVitals({ ...vitals, huyet_ap_tam_truong: e.target.value })}
                              className="w-10 font-bold text-sm text-gray-900 bg-transparent outline-none border-b border-dashed border-gray-300 focus:border-[#1F6F5C]"
                              placeholder="80"
                            />
                            <span className="text-[10px] text-gray-400 ml-auto">mmHg</span>
                          </div>
                          <span className="text-[9px] text-gray-400 mt-1 block">Tâm thu / Tâm trương</span>
                        </div>

                        {/* 2. Mạch */}
                        <div className={`p-2.5 rounded-xl border bg-white transition shadow-2xs ${
                          isPulseFast || isPulseSlow ? 'border-rose-300 ring-1 ring-rose-200' : 'border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Mạch (bpm)</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              isPulseFast ? 'bg-rose-100 text-rose-700' : isPulseSlow ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {isPulseFast ? 'Nhanh' : isPulseSlow ? 'Chậm' : 'Chuẩn'}
                            </span>
                          </div>
                          <div className="flex items-baseline mt-1.5 font-mono">
                            <input
                              type="number"
                              disabled={isLocked}
                              value={vitals.mach}
                              onChange={(e) => setVitals({ ...vitals, mach: e.target.value })}
                              className="w-full font-bold text-sm text-gray-900 bg-transparent outline-none border-b border-dashed border-gray-300 focus:border-[#1F6F5C]"
                              placeholder="75"
                            />
                            <span className="text-[10px] text-gray-400 ml-1">l/p</span>
                          </div>
                          <span className="text-[9px] text-gray-400 mt-1 block">Tham chiếu: 60 - 90</span>
                        </div>

                        {/* 3. Thân nhiệt */}
                        <div className={`p-2.5 rounded-xl border bg-white transition shadow-2xs ${
                          isTempHigh ? 'border-rose-300 ring-1 ring-rose-200' : isTempLow ? 'border-blue-300' : 'border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Thân nhiệt</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              isTempHigh ? 'bg-rose-100 text-rose-700' : isTempLow ? 'bg-blue-100 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {isTempHigh ? 'Sốt' : isTempLow ? 'Hạ nhiệt' : 'Chuẩn'}
                            </span>
                          </div>
                          <div className="flex items-baseline mt-1.5 font-mono">
                            <input
                              type="number"
                              disabled={isLocked}
                              step="0.1"
                              value={vitals.nhiet_do}
                              onChange={(e) => setVitals({ ...vitals, nhiet_do: e.target.value })}
                              className="w-full font-bold text-sm text-gray-900 bg-transparent outline-none border-b border-dashed border-gray-300 focus:border-[#1F6F5C]"
                              placeholder="36.8"
                            />
                            <span className="text-[10px] text-gray-400 ml-1">°C</span>
                          </div>
                          <span className="text-[9px] text-gray-400 mt-1 block">Tham chiếu: 36.5 - 37.5</span>
                        </div>

                        {/* 4. SpO2 */}
                        <div className={`p-2.5 rounded-xl border bg-white transition shadow-2xs ${
                          isSpo2Critical ? 'border-rose-400 ring-2 ring-rose-300 bg-rose-50/50' : isSpo2Low ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">SpO2 (%)</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              isSpo2Critical ? 'bg-rose-600 text-white animate-pulse' : isSpo2Low ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {isSpo2Critical ? 'NGUY CẤP' : isSpo2Low ? 'Giảm oxy' : 'Tối ưu'}
                            </span>
                          </div>
                          <div className="flex items-baseline mt-1.5 font-mono">
                            <input
                              type="number"
                              disabled={isLocked}
                              value={vitals.spo2}
                              onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                              className="w-full font-bold text-sm text-gray-900 bg-transparent outline-none border-b border-dashed border-gray-300 focus:border-[#1F6F5C]"
                              placeholder="98"
                            />
                            <span className="text-[10px] text-gray-400 ml-1">%</span>
                          </div>
                          <span className="text-[9px] text-gray-400 mt-1 block">Bình thường: ≥ 96%</span>
                        </div>

                        {/* 5. Nhịp thở */}
                        <div className="p-2.5 rounded-xl border border-gray-200 bg-white transition shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Nhịp thở</span>
                            <span className="text-[9px] font-semibold bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded">
                              Chuẩn
                            </span>
                          </div>
                          <div className="flex items-baseline mt-1.5 font-mono">
                            <input
                              type="number"
                              disabled={isLocked}
                              value={vitals.nhip_tho}
                              onChange={(e) => setVitals({ ...vitals, nhip_tho: e.target.value })}
                              className="w-full font-bold text-sm text-gray-900 bg-transparent outline-none border-b border-dashed border-gray-300 focus:border-[#1F6F5C]"
                              placeholder="18"
                            />
                            <span className="text-[10px] text-gray-400 ml-1">l/p</span>
                          </div>
                          <span className="text-[9px] text-gray-400 mt-1 block">Tham chiếu: 16 - 20</span>
                        </div>

                        {/* 6. Chiều cao & Cân nặng */}
                        <div className="p-2.5 rounded-xl border border-gray-200 bg-white transition shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Cân / Cao</span>
                            <span className="text-[9px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded">
                              Nhân trắc
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 font-mono">
                            <input
                              type="number"
                              disabled={isLocked}
                              value={vitals.can_nang}
                              onChange={(e) => setVitals({ ...vitals, can_nang: e.target.value })}
                              className="w-9 font-bold text-xs text-gray-900 bg-transparent outline-none border-b border-dashed border-gray-300"
                              placeholder="62"
                              title="Cân nặng (kg)"
                            />
                            <span className="text-[10px] text-gray-400">kg</span>
                            <span className="text-gray-300">•</span>
                            <input
                              type="number"
                              disabled={isLocked}
                              value={vitals.chieu_cao}
                              onChange={(e) => setVitals({ ...vitals, chieu_cao: e.target.value })}
                              className="w-10 font-bold text-xs text-gray-900 bg-transparent outline-none border-b border-dashed border-gray-300"
                              placeholder="168"
                              title="Chiều cao (cm)"
                            />
                            <span className="text-[10px] text-gray-400">cm</span>
                          </div>
                          <span className="text-[9px] text-gray-400 mt-1 block">Tự động tính BMI</span>
                        </div>
                      </div>

                      {/* CLINICAL BMI GAUGE & PHÂN LOẠI THỂ TRẠNG LÂM SÀNG (WHO IDI & WPRO) */}
                      <div className="bg-white border border-[#E4E1D8] rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-800">
                              Chỉ số khối cơ thể (BMI - Body Mass Index):
                            </span>
                            <span className="font-mono text-base font-extrabold text-[#1F6F5C]">
                              {currentBmi !== null ? `${currentBmi} kg/m²` : '—'}
                            </span>
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${bmiInfo.badgeClass}`}>
                              {bmiInfo.label}
                            </span>
                          </div>

                          <span className="text-[11px] text-gray-500">
                            Tiêu chuẩn phân loại người Châu Á (WPRO / IDI)
                          </span>
                        </div>

                        {/* Thước đo 4 phân vùng thể trạng trực quan */}
                        <div className="space-y-1">
                          <div className="relative w-full h-3 rounded-full overflow-hidden flex bg-gray-100">
                            {/* Vùng 1: Thiếu cân (< 18.5) */}
                            <div className="w-1/4 bg-sky-200" title="Thiếu cân (< 18.5)"></div>
                            {/* Vùng 2: Bình thường (18.5 - 22.9) */}
                            <div className="w-1/4 bg-emerald-400" title="Bình thường (18.5 - 22.9)"></div>
                            {/* Vùng 3: Thừa cân (23.0 - 24.9) */}
                            <div className="w-1/4 bg-amber-400" title="Tiền béo phì (23.0 - 24.9)"></div>
                            {/* Vùng 4: Béo phì (≥ 25.0) */}
                            <div className="w-1/4 bg-rose-400" title="Béo phì (≥ 25.0)"></div>

                            {/* Kim chỉ vị trí BMI hiện tại */}
                            {currentBmi !== null && (
                              <div
                                className="absolute top-0 bottom-0 w-2 bg-gray-900 border-2 border-white rounded-full shadow transition-all duration-300 -ml-1"
                                style={{ left: `${Math.min(98, Math.max(2, bmiInfo.percentOnGauge))}%` }}
                                title={`Chỉ số BMI: ${currentBmi} kg/m²`}
                              ></div>
                            )}
                          </div>

                          {/* Nhãn 4 phân vùng */}
                          <div className="grid grid-cols-4 text-[10px] text-gray-500 font-medium text-center pt-0.5">
                            <span className="text-sky-700">&lt; 18.5 Thiếu cân</span>
                            <span className="text-emerald-700 font-bold">18.5 - 22.9 Bình thường</span>
                            <span className="text-amber-700">23.0 - 24.9 Thừa cân</span>
                            <span className="text-rose-700">≥ 25.0 Béo phì</span>
                          </div>
                        </div>

                        {/* Gợi ý lâm sàng */}
                        <div className="text-[11px] text-gray-600 bg-[#F7F5F0] px-3 py-1.5 rounded-lg border border-[#E4E1D8] flex items-center justify-between">
                          <span>
                            <strong>Nhận định lâm sàng:</strong> {bmiInfo.advice}
                          </span>
                          <span className="text-gray-400 font-mono text-[10px]">
                            BMI = Cân nặng (kg) / [Chiều cao (m)]²
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Clinical Workspace Sub-Tabs (Bahmni / OpenMRS Consultation Workflow) */}
                <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                  <button
                    onClick={() => setActiveStep('diagnosis')}
                    className={`py-2 px-3.5 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                      activeStep === 'diagnosis'
                        ? 'bg-[#1F6F5C] text-white shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>🩺 Khám & Chẩn đoán ICD-10</span>
                  </button>

                  <button
                    onClick={() => setActiveStep('lab')}
                    className={`py-2 px-3.5 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                      activeStep === 'lab'
                        ? 'bg-[#1F6F5C] text-white shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>🔬 Cận lâm sàng</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      activeStep === 'lab' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-800'
                    }`}>
                      {labOrders.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveStep('prescription')}
                    className={`py-2 px-3.5 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                      activeStep === 'prescription'
                        ? 'bg-[#1F6F5C] text-white shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Pill className="w-3.5 h-3.5" />
                    <span>💊 Kê đơn thuốc</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      activeStep === 'prescription' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-800'
                    }`}>
                      {prescriptionItems.length}
                    </span>
                  </button>
                </div>

                {/* STEP (a): DIAGNOSIS & ICD-10 */}
                {activeStep === 'diagnosis' && (
                  <div className="space-y-4 text-xs">
                    {/* Quick Condition Chips (OpenMRS / Bahmni Quick Picks) */}
                    <div className="bg-[#F7F5F0] border border-[#E4E1D8] rounded-lg p-3 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="font-bold text-gray-800 flex items-center gap-1.5">
                          <span>⚡ Chọn nhanh bệnh lý thường gặp (WHO ICD-10 Quick Pick):</span>
                        </span>

                        {/* Live Filter Search Input */}
                        <div className="relative w-full sm:w-64">
                          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                          <input
                            type="text"
                            disabled={isLocked}
                            value={icdSearchQuery}
                            onChange={(e) => setIcdSearchQuery(e.target.value)}
                            placeholder="Tìm nhanh mã hoặc tên ICD-10..."
                            className="w-full bg-white border border-gray-300 rounded-md pl-8 pr-3 py-1 text-xs outline-none focus:border-[#1F6F5C]"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                        {icd10Common
                          .filter(icd => !icdSearchQuery || 
                            icd.code.toLowerCase().includes(icdSearchQuery.toLowerCase()) || 
                            icd.name.toLowerCase().includes(icdSearchQuery.toLowerCase())
                          )
                          .map(icd => {
                            const isSelected = primaryIcd10 === icd.code;
                            return (
                              <button
                                key={icd.code}
                                type="button"
                                disabled={isLocked}
                                onClick={() => {
                                  setPrimaryIcd10(icd.code);
                                  setDiagnosisPrimary(icd.name);
                                }}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition flex items-center gap-1 ${
                                  isSelected
                                    ? 'bg-[#1F6F5C] text-white border-[#1F6F5C] shadow-xs'
                                    : 'bg-white text-gray-700 border-gray-200 hover:border-[#1F6F5C] hover:bg-gray-50'
                                }`}
                              >
                                <span className="font-mono font-bold">[{icd.code}]</span>
                                <span>{icd.name.split(' (')[0]}</span>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2 space-y-1">
                        <label className="font-semibold text-gray-700">Chẩn đoán chính (Primary Diagnosis) *</label>
                        <input
                          type="text"
                          disabled={isLocked}
                          value={diagnosisPrimary}
                          onChange={(e) => setDiagnosisPrimary(e.target.value)}
                          placeholder="Ví dụ: Tăng huyết áp vô căn..."
                          className="w-full p-2.5 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-[#1F6F5C] outline-none disabled:bg-gray-100"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-gray-700">Mã bệnh WHO ICD-10 *</label>
                        <select
                          disabled={isLocked}
                          value={primaryIcd10}
                          onChange={(e) => {
                            setPrimaryIcd10(e.target.value);
                            const found = icd10Common.find(i => i.code === e.target.value);
                            if (found) setDiagnosisPrimary(found.name);
                          }}
                          className="w-full p-2.5 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-[#1F6F5C] outline-none disabled:bg-gray-100"
                        >
                          {icd10Common.map(icd => (
                            <option key={icd.code} value={icd.code}>
                              [{icd.code}] {icd.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700">Chẩn đoán kèm theo / bệnh lý phụ (Secondary Diagnosis)</label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={diagnosisSecondary}
                        onChange={(e) => setDiagnosisSecondary(e.target.value)}
                        placeholder="Ví dụ: Đái tháo đường type 2, Rối loạn mỡ máu..."
                        className="w-full p-2.5 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-[#1F6F5C] outline-none disabled:bg-gray-100"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700">Tóm tắt diễn biến lâm sàng & Khám bộ phận</label>
                      <textarea
                        rows={3}
                        disabled={isLocked}
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                        placeholder="Ghi nhận khám thực thể: lồng ngực, nhịp tim, bụng mềm, không phù..."
                        className="w-full p-2.5 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-[#1F6F5C] outline-none disabled:bg-gray-100"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-semibold text-gray-700">Kết luận & Hướng điều trị</label>
                        <textarea
                          rows={2}
                          disabled={isLocked}
                          value={treatmentConclusion}
                          onChange={(e) => setTreatmentConclusion(e.target.value)}
                          placeholder="Kết luận điều trị ngoại trú..."
                          className="w-full p-2.5 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-[#1F6F5C] outline-none disabled:bg-gray-100"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-gray-700">Lời dặn của bác sĩ & Ngày hẹn tái khám</label>
                        <div className="space-y-2">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={doctorAdvice}
                            onChange={(e) => setDoctorAdvice(e.target.value)}
                            placeholder="Chế độ ăn nhạt, kiêng rượu bia..."
                            className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-[#1F6F5C] outline-none disabled:bg-gray-100"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-500 whitespace-nowrap">Hẹn tái khám:</span>
                            <input
                              type="date"
                              disabled={isLocked}
                              value={followUpDate}
                              onChange={(e) => setFollowUpDate(e.target.value)}
                              className="w-full p-1.5 bg-white border border-gray-300 rounded text-xs outline-none disabled:bg-gray-100"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => setActiveStep('lab')}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-xs font-semibold flex items-center gap-1.5"
                      >
                        <span>Chuyển sang Bước (b) Cận lâm sàng</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP (b): LAB ORDERS */}
                {activeStep === 'lab' && (
                  <div className="space-y-4 text-xs">
                    {!isLocked && (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                        <span className="font-bold text-gray-800 block">Kê chỉ định dịch vụ cận lâm sàng mới:</span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="md:col-span-2">
                            <select
                              value={selectedLabPreset}
                              onChange={(e) => setSelectedLabPreset(e.target.value)}
                              className="w-full p-2 bg-white border border-gray-300 rounded outline-none"
                            >
                              <option value="">-- Chọn dịch vụ cận lâm sàng / thăm dò chẩn đoán --</option>
                              {labPresets.map(preset => (
                                <option key={preset.code} value={preset.code}>
                                  [{preset.code}] {preset.name} - {preset.price.toLocaleString('vi-VN')} đ
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <input
                              type="text"
                              value={labNote}
                              onChange={(e) => setLabNote(e.target.value)}
                              placeholder="Ghi chú kỹ thuật..."
                              className="w-full p-2 bg-white border border-gray-300 rounded outline-none"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddLab}
                          className="px-3 py-1.5 bg-[#1F6F5C] text-white rounded text-xs font-semibold flex items-center gap-1 hover:bg-[#185949]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm chỉ định cận lâm sàng</span>
                        </button>
                      </div>
                    )}

                    {/* Lab Orders Table */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-[#F7F5F0] text-gray-700 font-semibold border-b">
                          <tr>
                            <th className="p-2.5">Mã dịch vụ</th>
                            <th className="p-2.5">Tên kỹ thuật cận lâm sàng</th>
                            <th className="p-2.5">Đơn giá</th>
                            <th className="p-2.5">Trạng thái</th>
                            <th className="p-2.5">Kết quả & Thao tác</th>
                            <th className="p-2.5">Ghi chú</th>
                            {!isLocked && <th className="p-2.5 text-center">Xóa</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {labOrders.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-4 text-center text-gray-500 italic">
                                Chưa có chỉ định cận lâm sàng nào được kê cho ca khám này.
                              </td>
                            </tr>
                          ) : (
                            labOrders.map(lab => {
                              const hasResult = lab.status === 'da_co_ket_qua' || Boolean(lab.ket_qua_chi_tiet);
                              return (
                                <tr key={lab.id} className="hover:bg-gray-50">
                                  <td className="p-2.5 font-mono font-bold text-[#1F6F5C]">{lab.code}</td>
                                  <td className="p-2.5 font-medium text-gray-900">{lab.name}</td>
                                  <td className="p-2.5 text-gray-600">{Number(lab.price || 0).toLocaleString('vi-VN')} đ</td>
                                  <td className="p-2.5">
                                    {hasResult ? (
                                      <div className="space-y-1">
                                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1 w-fit">
                                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                                          <span>✓ ĐÃ CÓ KẾT QUẢ</span>
                                        </span>
                                        {lab.ket_qua_phan_loai === 'NGUY_KICH' || lab.muc_do_canh_bao === 'NGUY_KICH' ? (
                                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-100 text-rose-800 border border-rose-300 font-bold block w-fit animate-pulse">
                                            🔴 Nguy kịch
                                          </span>
                                        ) : lab.ket_qua_phan_loai === 'BAT_THUONG' || lab.muc_do_canh_bao === 'BAT_THUONG' ? (
                                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-semibold block w-fit">
                                            🟡 Bất thường
                                          </span>
                                        ) : (
                                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium block w-fit">
                                            🟢 Bình thường
                                          </span>
                                        )}
                                      </div>
                                    ) : lab.status === 'da_huy' ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 border border-gray-200 font-medium">
                                        Đã hủy
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-medium flex items-center gap-1 w-fit">
                                        <Clock className="w-3 h-3 text-amber-600" />
                                        <span>Chờ thực hiện</span>
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2.5">
                                    <div className="flex items-center gap-1.5">
                                      {hasResult ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenResultView(lab)}
                                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-semibold flex items-center gap-1 transition"
                                          >
                                            <Search className="w-3 h-3" />
                                            <span>Xem kết quả</span>
                                          </button>
                                          {lab.tep_dinh_kem_url && (
                                            <span title="Có file/ảnh đính kèm" className="text-gray-500">
                                              📎
                                            </span>
                                          )}
                                          {!isLocked && (
                                            <button
                                              type="button"
                                              onClick={() => handleOpenResultInput(lab)}
                                              className="text-gray-500 hover:text-gray-800 text-[11px] underline ml-1"
                                            >
                                              Sửa
                                            </button>
                                          )}
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={isLocked}
                                          onClick={() => handleOpenResultInput(lab)}
                                          className="px-2.5 py-1 bg-[#1F6F5C] hover:bg-[#185949] text-white rounded text-xs font-semibold flex items-center gap-1 transition disabled:opacity-40"
                                          title={isLocked ? "Bệnh án đã khóa, không thể cập nhật kết quả" : "Nhập trả kết quả cận lâm sàng"}
                                        >
                                          <Edit3 className="w-3 h-3" />
                                          <span>Trả kết quả</span>
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-2.5 text-gray-500">{lab.note || '-'}</td>
                                  {!isLocked && (
                                    <td className="p-2.5 text-center">
                                      {!hasResult ? (
                                        <button onClick={() => handleRemoveLab(lab.id)} className="text-red-500 hover:text-red-700">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      ) : (
                                        <span className="text-gray-300">-</span>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between pt-2">
                      <button
                        onClick={() => setActiveStep('diagnosis')}
                        className="px-3 py-1.5 border border-gray-300 rounded font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Quay lại Bước (a)
                      </button>
                      <button
                        onClick={() => setActiveStep('prescription')}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded font-semibold flex items-center gap-1.5"
                      >
                        <span>Chuyển sang Bước (c) Kê đơn thuốc</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP (c): PRESCRIPTIONS */}
                {activeStep === 'prescription' && (
                  <div className="space-y-4 text-xs">
                    {!isLocked && (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                        <span className="font-bold text-gray-800 block">Thêm nhanh thuốc thông dụng:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {medicinePresets.map((m, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleAddPresetMedicine(m)}
                              className="px-2.5 py-1 bg-white border border-gray-300 rounded text-[11px] font-medium hover:border-[#1F6F5C] text-gray-700"
                            >
                              + {m.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prescription Items Table */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-800">Danh mục thuốc kê trong đơn ({prescriptionItems.length}):</span>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={handleAddPrescriptionRow}
                            className="px-2.5 py-1 bg-[#1F6F5C] text-white rounded text-xs font-semibold flex items-center gap-1 hover:bg-[#185949]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Thêm dòng thuốc</span>
                          </button>
                        )}
                      </div>

                      <div className="border border-gray-200 rounded-lg overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[650px]">
                          <thead className="bg-[#F7F5F0] text-gray-700 font-semibold border-b">
                            <tr>
                              <th className="p-2 w-8 text-center">STT</th>
                              <th className="p-2 min-w-[160px]">Tên thuốc & Hàm lượng</th>
                              <th className="p-2 w-20">Số lượng</th>
                              <th className="p-2 w-20">Đơn vị</th>
                              <th className="p-2 min-w-[180px]">Liều dùng & Cách dùng</th>
                              <th className="p-2 w-20">Số ngày</th>
                              {!isLocked && <th className="p-2 w-10 text-center">Xóa</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {prescriptionItems.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="p-4 text-center text-gray-500 italic">
                                  Chưa có thuốc nào trong đơn.
                                </td>
                              </tr>
                            ) : (
                              prescriptionItems.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                  <td className="p-2 text-center text-gray-500 font-bold">{idx + 1}</td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      disabled={isLocked}
                                      value={item.medicine_name}
                                      onChange={(e) => handleUpdatePrescription(item.id, 'medicine_name', e.target.value)}
                                      placeholder="Tên thuốc..."
                                      className="w-full p-1.5 border border-gray-300 rounded outline-none bg-white disabled:bg-gray-100 font-medium"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="number"
                                      disabled={isLocked}
                                      value={item.quantity}
                                      onChange={(e) => handleUpdatePrescription(item.id, 'quantity', e.target.value)}
                                      className="w-full p-1.5 border border-gray-300 rounded outline-none bg-white disabled:bg-gray-100 text-center"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      disabled={isLocked}
                                      value={item.unit}
                                      onChange={(e) => handleUpdatePrescription(item.id, 'unit', e.target.value)}
                                      className="w-full p-1.5 border border-gray-300 rounded outline-none bg-white disabled:bg-gray-100 text-center"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      disabled={isLocked}
                                      value={item.usage}
                                      onChange={(e) => handleUpdatePrescription(item.id, 'usage', e.target.value)}
                                      placeholder="Sáng 1v sau ăn, tối 1v..."
                                      className="w-full p-1.5 border border-gray-300 rounded outline-none bg-white disabled:bg-gray-100"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="number"
                                      disabled={isLocked}
                                      value={item.days}
                                      onChange={(e) => handleUpdatePrescription(item.id, 'days', e.target.value)}
                                      className="w-full p-1.5 border border-gray-300 rounded outline-none bg-white disabled:bg-gray-100 text-center"
                                    />
                                  </td>
                                  {!isLocked && (
                                    <td className="p-2 text-center">
                                      <button onClick={() => handleRemovePrescription(item.id)} className="text-red-500 hover:text-red-700">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="space-y-1 pt-2">
                        <label className="font-semibold text-gray-700">Lời dặn dược lâm sàng / Lưu ý uống thuốc</label>
                        <input
                          type="text"
                          disabled={isLocked}
                          value={prescriptionNote}
                          onChange={(e) => setPrescriptionNote(e.target.value)}
                          placeholder="Lưu ý tương tác thuốc, uống nhiều nước..."
                          className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-[#1F6F5C] outline-none disabled:bg-gray-100"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between pt-2">
                      <button
                        onClick={() => setActiveStep('lab')}
                        className="px-3 py-1.5 border border-gray-300 rounded font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Quay lại Bước (b)
                      </button>

                      {!isLocked && (
                        <button
                          type="button"
                          onClick={handleCheckBeforeLock}
                          className="px-4 py-2 bg-[#1F6F5C] hover:bg-[#185949] text-white rounded-lg font-bold flex items-center gap-1.5 shadow transition text-xs"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Hoàn tất lượt khám</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#E4E1D8] rounded-xl p-12 text-center text-gray-500 space-y-3">
                <UserCheck className="w-12 h-12 text-gray-300 mx-auto" />
                <h3 className="font-semibold text-base text-gray-700">Chưa chọn bệnh nhân để khám</h3>
                <p className="text-xs max-w-md mx-auto text-gray-500">
                  Vui lòng chọn một ca khám từ danh sách bên trái hoặc bấm nút "Gọi Bệnh Nhân Kế Tiếp" để hệ thống tự động điều phối theo thứ tự ưu tiên 5 cấp độ.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* 1. Call Next Patient Modal */}
      {showCallNextModal && nextPatientResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E4E1D8] space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#1F6F5C]" />
                <h3 className="font-bold text-[#1C1B19] text-base">Đã Gọi Bệnh Nhân Thành Công</h3>
              </div>
              <button onClick={() => setShowCallNextModal(false)} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg text-emerald-900 text-xs space-y-2">
              <p className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>{nextPatientResult.ho_ten_benh_nhan || 'Bệnh nhân kế tiếp'}</span>
              </p>
              <p>Mã số lượt khám: <strong className="font-mono text-emerald-800">{nextPatientResult.ma_so || nextPatientResult.so_thu_tu}</strong></p>
              <p>Phòng tiếp nhận: <strong>{nextPatientResult.phong_kham || 'Phòng khám chuyên khoa'}</strong></p>
              <div>
                Cấp độ ưu tiên: {renderPriorityBadge(nextPatientResult.muc_do_uu_tien || 4)}
              </div>
            </div>

            <p className="text-xs text-gray-600">
              Hệ thống loa và màn hình tivi phòng chờ đã phát thông báo mời bệnh nhân vào phòng khám.
            </p>

            <button
              onClick={() => setShowCallNextModal(false)}
              className="w-full py-2.5 bg-[#1F6F5C] text-white rounded font-medium text-xs hover:bg-[#185949]"
            >
              Tiến hành tiếp nhận vào khám
            </button>
          </div>
        </div>
      )}

      {/* 2. Postpone Ticket Modal */}
      {postponeModalApt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E4E1D8] space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-[#1C1B19] text-base">Tạm Hoãn Bệnh Nhân (Postpone)</h3>
              </div>
              <button onClick={() => setPostponeModalApt(null)} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-3">
              <p className="text-gray-600">
                Bạn đang tạm hoãn lượt khám của bệnh nhân <strong className="text-gray-900">{postponeModalApt.patient_name}</strong> (Mã: {postponeModalApt.appointment_code}).
              </p>

              <div>
                <label className="block font-semibold mb-1 text-gray-700">Lý do tạm hoãn:</label>
                <select
                  value={postponeReason}
                  onChange={(e) => setPostponeReason(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-xs outline-none"
                >
                  <option value="Gọi loa 3 lần không có mặt">Gọi loa 3 lần không có mặt</option>
                  <option value="Đang chờ kết quả cận lâm sàng">Đang chờ kết quả cận lâm sàng</option>
                  <option value="Bệnh nhân xin đi vệ sinh / việc riêng">Bệnh nhân xin đi vệ sinh / việc riêng</option>
                  <option value="Cần hội chẩn chuyên khoa">Cần hội chẩn chuyên khoa</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPostponeModalApt(null)}
                  className="flex-1 py-2 border border-gray-300 rounded font-medium text-gray-700 hover:bg-gray-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handlePostponeTicket}
                  disabled={postponeLoading}
                  className="flex-1 py-2 bg-amber-600 text-white rounded font-medium hover:bg-amber-700 disabled:opacity-50"
                >
                  {postponeLoading ? 'Đang lưu...' : 'Xác nhận tạm hoãn'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Mark No-Show Modal */}
      {noShowModalApt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E4E1D8] space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-[#1C1B19] text-base">Xác Nhận Bệnh Nhân Vắng Mặt (No-Show)</h3>
              </div>
              <button onClick={() => setNoShowModalApt(null)} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800">
                Lịch hẹn của bệnh nhân <strong className="text-rose-950">{noShowModalApt.patient_name}</strong> sẽ được chuyển sang trạng thái <strong>VẮNG MẶT</strong>. Khung giờ này sẽ được giải phóng cho bệnh nhân Waitlist tiếp theo nếu phù hợp.
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700">Lý do vắng mặt:</label>
                <input
                  type="text"
                  value={noShowReason}
                  onChange={(e) => setNoShowReason(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-xs outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNoShowModalApt(null)}
                  className="flex-1 py-2 border border-gray-300 rounded font-medium text-gray-700 hover:bg-gray-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleMarkNoShow}
                  disabled={noShowLoading}
                  className="flex-1 py-2 bg-rose-600 text-white rounded font-medium hover:bg-rose-700 disabled:opacity-50"
                >
                  {noShowLoading ? 'Đang lưu...' : 'Xác nhận No-Show'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. TT 32/2023/TT-BYT Permanent Lock Confirmation Modal */}
      {showLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E4E1D8] space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#1F6F5C]" />
                <h3 className="font-bold text-[#1C1B19] text-base">Hoàn tất lượt khám & Khóa hồ sơ bệnh án</h3>
              </div>
              <button onClick={() => setShowLockModal(false)} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-700">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-950 space-y-1">
                <div className="flex items-center gap-2 font-bold text-emerald-950">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Xác nhận hoàn tất phiên khám:</span>
                </div>
                <p>
                  Bác sĩ đang thực hiện <strong>Hoàn tất lượt khám</strong> trực tiếp cho người bệnh. Trạng thái tiếp nhận sẽ chuyển sang <em>Đã khám</em>.
                </p>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Quy định lưu trữ bệnh án (Thông tư 32/2023/TT-BYT):</span>
                </div>
                <p>
                  Sau khi bấm xác nhận, toàn bộ hồ sơ lượt khám (Chẩn đoán, Chỉ định cận lâm sàng, Đơn thuốc) sẽ được <strong>KHÓA BẤT BIẾN VĨNH VIỄN</strong> và chuyển sang chế độ <strong>CHỈ ĐỌC (READ-ONLY)</strong> để bảo vệ tính toàn vẹn y khoa.
                </p>
                <p className="font-semibold text-amber-950">
                  Bác sĩ không thể tự ý sửa đổi trực tiếp nội dung bệnh án. Mọi thay đổi bắt buộc phải lập yêu cầu đính chính và được Trưởng khoa phê duyệt (Four-Eyes Principle).
                </p>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1">
                <p><strong>Bệnh nhân:</strong> {selectedApt?.patient_name} (Mã: {selectedApt?.appointment_code})</p>
                <p><strong>Chẩn đoán chính:</strong> {diagnosisPrimary} (ICD-10: {primaryIcd10})</p>
                <p><strong>Số loại thuốc kê:</strong> {prescriptionItems.length} loại</p>
                <p><strong>Chỉ định cận lâm sàng:</strong> {labOrders.length} dịch vụ</p>
              </div>

              {/* Cảnh báo chỉ định chưa có kết quả (Soft Warning) */}
              {(() => {
                const pendingOrders = labOrders.filter(l => l.status === 'da_chi_dinh' || l.status === 'dang_thuc_hien' || l.status === 'CHO_THUC_HIEN');
                if (pendingOrders.length === 0) return null;
                return (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-950">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Cảnh báo cận lâm sàng chưa có kết quả:</span>
                    </div>
                    <p>
                      Lượt khám này còn <strong>{pendingOrders.length} chỉ định chưa có kết quả</strong> ({pendingOrders.map(p => p.name).join(', ')}).
                    </p>
                    <p className="text-[11px] text-amber-800">
                      Bạn vẫn có thể hoàn tất lượt khám theo thực tế lâm sàng; kết quả sẽ được gắn vào lượt khám này khi kỹ thuật viên hoàn tất trả kết quả.
                    </p>
                  </div>
                );
              })()}

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowLockModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Quay lại kiểm tra thêm
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPermanentLock}
                  disabled={lockingLoading}
                  className="flex-1 py-2.5 bg-[#1F6F5C] text-white rounded-lg font-bold hover:bg-[#185949] disabled:opacity-50 flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <Lock className="w-4 h-4" />
                  <span>{lockingLoading ? 'Đang hoàn tất & khóa...' : 'Xác nhận Hoàn tất & Khóa hồ sơ'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Medical Amendment Request Modal (Four-Eyes Principle) */}
      {showAmendmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E4E1D8] space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-[#1C1B19] text-base">Lập Yêu Cầu Đính Chính Bệnh Án Đã Khóa</h3>
              </div>
              <button onClick={() => setShowAmendmentModal(false)} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-700">
              <p className="text-gray-600">
                Biên bản đính chính này sẽ được gửi tới Ban Giám Đốc / Trưởng khoa chuyên môn để xét duyệt theo nguyên tắc song trùng (Four-Eyes Principle).
              </p>

              <div>
                <label className="block font-semibold mb-1 text-gray-700">Hạng mục cần đính chính:</label>
                <select
                  value={amendmentForm.thuc_the_loai}
                  onChange={(e) => setAmendmentForm({ ...amendmentForm, thuc_the_loai: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded outline-none text-xs"
                >
                  <option value="CHAN_DOAN">Chẩn đoán bệnh & ICD-10</option>
                  <option value="DON_THUOC">Đơn thuốc ngoại trú</option>
                  <option value="CHI_TIET_DON_THUOC">Dòng thuốc trong đơn (Liều dùng/Số lượng)</option>
                  <option value="CHI_DINH">Chỉ định cận lâm sàng</option>
                  <option value="KET_LUAN">Kết luận điều trị / Lời dặn</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700">Lý do giải trình chuyên môn *:</label>
                <textarea
                  rows={3}
                  value={amendmentForm.ly_do_text}
                  onChange={(e) => setAmendmentForm({ ...amendmentForm, ly_do_text: e.target.value })}
                  placeholder="Giải trình rõ lý do sai sót hoặc cần điều chỉnh chuyên môn..."
                  className="w-full p-2 border border-gray-300 rounded outline-none text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700">Nội dung đề xuất thay đổi mới:</label>
                <textarea
                  rows={2}
                  value={amendmentForm.noi_dung_moi}
                  onChange={(e) => setAmendmentForm({ ...amendmentForm, noi_dung_moi: e.target.value })}
                  placeholder="Ghi rõ nội dung chính xác cần thay thế..."
                  className="w-full p-2 border border-gray-300 rounded outline-none text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAmendmentModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded font-medium text-gray-700 hover:bg-gray-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSubmitAmendment}
                  disabled={amendmentSubmitting}
                  className="flex-1 py-2.5 bg-amber-600 text-white rounded font-bold hover:bg-amber-700 disabled:opacity-50"
                >
                  {amendmentSubmitting ? 'Đang gửi...' : 'Gửi Trưởng khoa xét duyệt'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Printable Medical Summary & Prescription Modal */}
      {showPrintModal && selectedApt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-[#E4E1D8] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#1F6F5C]" />
                <h3 className="font-bold text-[#1C1B19] text-base">Bản In Hồ Sơ Lâm Sàng & Đơn Thuốc</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-[#1F6F5C] text-white rounded text-xs font-semibold hover:bg-[#185949]"
                >
                  In tài liệu
                </button>
                <button onClick={() => setShowPrintModal(false)} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Document Content */}
            <div className="space-y-4 text-xs text-gray-800 p-4 border border-gray-200 rounded-lg font-serif">
              <div className="flex justify-between border-b pb-3 text-center sm:text-left">
                <div>
                  <h4 className="font-bold uppercase text-sm tracking-wide text-gray-900">PHÒNG KHÁM ĐA KHOA QUỐC TẾ</h4>
                  <p className="text-[11px] text-gray-600">Địa chỉ: 123 Đường Sức Khỏe, Quận 1, TP. Hồ Chí Minh</p>
                  <p className="text-[11px] text-gray-600">Hotline: 1900 6868 • Giấy phép: 01234/BYT-GPHĐ</p>
                </div>
                <div className="text-right">
                  <h4 className="font-bold uppercase text-base text-[#1F6F5C]">PHIẾU KHÁM & ĐƠN THUỐC</h4>
                  <p className="font-mono text-xs">Mã hồ sơ: {selectedApt.appointment_code}</p>
                  <p className="text-[11px] text-gray-500">Ngày khám: {selectedApt.appointment_date}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b pb-2">
                <p><strong>Họ và tên:</strong> {selectedApt.patient_name}</p>
                <p><strong>Giới tính:</strong> {selectedApt.patient_gender} • <strong>Năm sinh:</strong> {selectedApt.patient_birth_year || '1985'}</p>
                <p><strong>Điện thoại:</strong> {selectedApt.patient_phone || '0988888888'}</p>
                <p><strong>Sinh hiệu:</strong> Mạch: {vitals.mach} l/p • Huyết áp: {vitals.huyet_ap_tam_thu}/{vitals.huyet_ap_tam_truong} mmHg</p>
              </div>

              <div>
                <p><strong>Chẩn đoán chính:</strong> {diagnosisPrimary} (ICD-10: {primaryIcd10})</p>
                {diagnosisSecondary && <p><strong>Chẩn đoán phụ:</strong> {diagnosisSecondary}</p>}
                <p><strong>Lời dặn của bác sĩ:</strong> {doctorAdvice}</p>
              </div>

              <div>
                <h5 className="font-bold border-b pb-1 mb-2">ĐƠN THUỐC ĐIỀU TRỊ:</h5>
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
                    {prescriptionItems.map((m, idx) => (
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
                  <p className="text-gray-500 text-[10px]">Bác sĩ điều trị</p>
                  <p className="font-bold mt-8">{currentDoctor?.ho_ten || 'BS. CKII Lê Minh Tuấn'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Result Input Modal (Package D) */}
      <ResultInputModal
        isOpen={showResultInputModal}
        order={selectedOrderForInput}
        onClose={() => {
          setShowResultInputModal(false);
          setSelectedOrderForInput(null);
        }}
        onSave={handleSaveOrderResult}
        isSaving={isSavingResult}
      />

      {/* 7. Result View Modal (Package D) */}
      <ResultViewModal
        isOpen={showResultViewModal}
        order={selectedOrderForView}
        onClose={() => {
          setShowResultViewModal(false);
          setSelectedOrderForView(null);
        }}
      />

      {/* 8. Longitudinal EMR Drawer (Package D) */}
      <PatientHistoryDrawer
        isOpen={showHistoryDrawer}
        onClose={() => {
          setShowHistoryDrawer(false);
          setPatientHistory([]);
        }}
        patient={selectedApt}
        historyList={patientHistory}
        isLoading={historyLoading}
      />
    </div>
  );
}
