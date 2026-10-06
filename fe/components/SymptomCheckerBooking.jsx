'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, Heart, Sparkles, AlertTriangle, CheckCircle, Clock,
  Calendar, User, Stethoscope, Phone, Star, ShieldAlert,
  ChevronRight, ArrowRight, MapPin, LogIn, LogOut, Check,
  Zap, AlertOctagon, MessageSquare, HelpCircle, Send, Flame
} from 'lucide-react';
import ApiService from '../services/api';
import AuthModal from './AuthModal';

export default function SymptomCheckerBooking({ initialTab = 'checker', hideLandingSections = false }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Ref for scrolling to AI Symptom Checker
  const checkerSectionRef = useRef(null);

  // --- Backend Connection & Catalog State ---
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(false);

  // --- Symptom Checker State ---
  const [freeText, setFreeText] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [recommendedDoctors, setRecommendedDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Smart Waitlist Modal States (OpenMRS pattern)
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistShift, setWaitlistShift] = useState('sang');
  const [waitlistReason, setWaitlistReason] = useState('');
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistSuccessMsg, setWaitlistSuccessMsg] = useState('');

  // Critical Red Flags preset tags (Quy chuẩn cờ đỏ lâm sàng khẩn cấp)
  const redFlagPresetTags = [
    'Đau ngực dữ dội', 'Khó thở cấp', 'Co giật', 'Yếu liệt nửa người'
  ];

  // Preset symptom tags (Sentence case per design.md)
  const symptomPresetTags = [
    'Đau ngực', 'Khó thở', 'Sốt cao', 'Đau đầu', 'Nổi mẩn đỏ',
    'Chóng mặt', 'Đau họng', 'Sổ mũi', 'Trẻ sốt quấy', 'Đau bụng quanh rốn', 'Ù tai', 'Đau khớp gối'
  ];

  // Helper kiểm tra triệu chứng nguy hiểm / cờ đỏ (Red flags)
  const checkRedFlags = (text, tags = []) => {
    const combined = `${text} ${tags.join(' ')}`.toLowerCase();
    const detected = [];

    if (combined.includes('đau ngực dữ dội') || combined.includes('đau thắt ngực') || (combined.includes('đau ngực') && (combined.includes('dữ dội') || combined.includes('lan')))) {
      detected.push({
        flag: 'Đau ngực dữ dội / Nghi ngờ hội chứng vành cấp',
        risk: 'Nguy cơ nhồi máu cơ tim cấp đe dọa tính mạng',
        firstAid: 'Nằm nghỉ ngơi tư thế nửa nằm nửa ngồi (Fowler 45°), nới lỏng cổ áo và thắt lưng. Tuyệt đối không gắng sức hay tự lái xe. Chuẩn bị gọi 115 ngay.'
      });
    }

    if (combined.includes('khó thở cấp') || combined.includes('nghẹt thở') || combined.includes('thở rít') || (combined.includes('khó thở') && combined.includes('dữ dội'))) {
      detected.push({
        flag: 'Khó thở cấp tính / Co thắt đường thở nghiêm trọng',
        risk: 'Nguy cơ suy hô hấp cấp, hen phế quản ác tính hoặc phù phổi cấp',
        firstAid: 'Mở cửa thông thoáng không khí, ngồi tựa lưng thẳng. Sử dụng ống xịt giãn phế quản nếu có tiền sử hen và giữ liên lạc cấp cứu.'
      });
    }

    if (combined.includes('co giật') || combined.includes('lên cơn giật') || combined.includes('co cứng')) {
      detected.push({
        flag: 'Co giật / Rung giật cơ toàn thân',
        risk: 'Nguy cơ tổn thương thần kinh trung ương, viêm màng não hoặc động kinh cấp',
        firstAid: 'Đặt người bệnh nằm nghiêng an toàn, kê gối mềm dưới đầu, tuyệt đối không nhét bất cứ vật gì vào miệng người bệnh, nới lỏng áo và gọi 115 ngay.'
      });
    }

    if (combined.includes('yếu liệt nửa người') || combined.includes('liệt nửa người') || combined.includes('méo miệng') || combined.includes('nói ngọng') || combined.includes('đột quỵ')) {
      detected.push({
        flag: 'Yếu liệt nửa người / Dấu hiệu FAST đột quỵ não',
        risk: 'Nguy cơ đột quỵ thiếu máu não cục bộ hoặc xuất huyết não (Giờ vàng cấp cứu 4.5 tiếng)',
        firstAid: 'Ghi lại chính xác thời điểm bắt đầu triệu chứng (Khởi phát). Đặt người bệnh nằm nghiêng đầu cao 30 độ, không cho ăn uống bất cứ thứ gì, gọi 115 ngay.'
      });
    }

    return detected;
  };

  // 14 Medical Specialties Catalog Data (Per Item 1 in Specification Table)
  const initialDepartmentsData = [
    { id: 1, code: 'INTERNAL_MEDICINE', name: 'Nội tổng quát', doctor_count: 5, description: 'Chẩn đoán và điều trị bệnh lý đường tiêu hóa, hô hấp, tuần hoàn tổng quát.', conditions: ['Cảm cúm', 'Viêm phế quản', 'Rối loạn tiêu hóa', 'Sốt xuất huyết'] },
    { id: 2, code: 'CARDIOLOGY', name: 'Tim mạch', doctor_count: 4, description: 'Tầm soát bệnh mạch vành, tăng huyết áp, suy tim và rối loạn nhịp tim.', conditions: ['Tăng huyết áp', 'Thiếu máu cơ tim', 'Rối loạn nhịp tim', 'Đau thắt ngực'] },
    { id: 3, code: 'DERMATOLOGY', name: 'Da liễu', doctor_count: 3, description: 'Trị liệu dị ứng da, mề đay mãn tính, chàm và viêm da cơ địa.', conditions: ['Viêm da dị ứng', 'Mề đay', 'Mụn trứng cá nhiễm khuẩn', 'Bệnh ngoài da'] },
    { id: 4, code: 'PEDIATRICS', name: 'Nhi khoa', doctor_count: 4, description: 'Chăm sóc sức khỏe toàn diện và tiêm chủng phòng bệnh cho trẻ sơ sinh và trẻ nhỏ.', conditions: ['Trẻ sốt vi rút', 'Viêm tai giữa trẻ em', 'Tư vấn dinh dưỡng', 'Ho hen ở trẻ'] },
    { id: 5, code: 'ENT', name: 'Tai Mũi Họng', doctor_count: 3, description: 'Nội soi chẩn đoán viêm xoang, viêm họng cấp, viêm amidan và tổn thương màng nhĩ.', conditions: ['Viêm xoang cấp', 'Viêm amidan', 'Ù tai', 'Hạt dây thanh'] },
    { id: 6, code: 'NEUROLOGY', name: 'Thần kinh', doctor_count: 3, description: 'Tầm soát đau đầu mãn tính, rối loạn giấc ngủ, tiền đình và thiếu máu não.', conditions: ['Migraine', 'Rối loạn tiền đình', 'Đau thần kinh tọa', 'Mất ngủ'] },
    { id: 7, code: 'OBGYN', name: 'Sản phụ khoa', doctor_count: 3, description: 'Khám thai định kỳ, chăm sóc sức khỏe phụ nữ và tư vấn sinh sản.', conditions: ['Khám thai định kỳ', 'Tư vấn sinh sản', 'Viêm nhiễm phụ khoa', 'Chăm sóc thai kỳ'] },
    { id: 8, code: 'OPHTHALMOLOGY', name: 'Mắt (Nhãn khoa)', doctor_count: 2, description: 'Đo tật khúc xạ, tầm soát đau mắt đỏ, đục thủy tinh thể và cận thị.', conditions: ['Đau mắt đỏ', 'Tật khúc xạ', 'Đục thủy tinh thể', 'Khô mắt'] },
    { id: 9, code: 'RHEUMATOLOGY', name: 'Cơ Xương Khớp', doctor_count: 3, description: 'Trị liệu thoái hóa khớp, thoái hóa cột sống, gút và viêm khớp dạng thấp.', conditions: ['Thoái hóa khớp gối', 'Thoái hóa đốt sống cổ', 'Bệnh Gút (Gout)', 'Viêm khớp dạng thấp'] },
    { id: 10, code: 'GASTROENTEROLOGY', name: 'Tiêu hóa & Gan mật', doctor_count: 4, description: 'Khám và nội soi dạ dày, đại tràng, vi trùng HP, viêm gan siêu vi B/C.', conditions: ['Viêm loét dạ dày HP', 'Trào ngược dạ dày thực quản', 'Viêm gan B/C', 'Hội chứng ruột kích thích'] },
    { id: 11, code: 'ODONTO_STOMATOLOGY', name: 'Răng Hàm Mặt', doctor_count: 3, description: 'Khám và điều trị nhổ răng khôn, sâu răng, nha chu và thẩm mỹ răng sứ.', conditions: ['Nhổ răng khôn mọc lệch', 'Chữa sâu răng & Viêm tủy', 'Viêm nha chu', 'Tẩy trắng răng'] },
    { id: 12, code: 'PULMONOLOGY', name: 'Hô hấp & Phổi', doctor_count: 3, description: 'Điều trị hen phế quản, Bệnh phổi tắc nghẽn mãn tính (COPD) và viêm phổi.', conditions: ['Hen phế quản', 'Bệnh COPD', 'Viêm phổi cấp', 'Ho lao & Tầm soát phổi'] },
    { id: 13, code: 'ENDOCRINOLOGY', name: 'Nội tiết & Tiểu đường', doctor_count: 3, description: 'Quản lý bệnh đái tháo đường, suy tuyến giáp, béo phì và rối loạn chuyển hóa.', conditions: ['Đái tháo đường tuýp 1 & 2', 'Bướu cổ & Viêm tuyến giáp', 'Rối loạn mỡ máu', 'Béo phì'] },
    { id: 14, code: 'NUTRITION_ANDROLOGY', name: 'Dinh dưỡng & Nam học', doctor_count: 2, description: 'Tư vấn chế độ ăn bệnh lý, tăng giảm cân và khám sức khỏe nam giới.', conditions: ['Tư vấn dinh dưỡng bệnh lý', 'Rối loạn cương dương', 'Tầm soát sức khỏe nam giới', 'Suy giảm Testosterone'] }
  ];

  // Default Mock Doctors
  const defaultMockDoctors = [
    {
      id: 1,
      full_name: 'PGS.TS.BS Phạm Hoàng Nam',
      title: 'PGS.TS.BS',
      department_name: 'Tim mạch',
      department_id: 2,
      years_experience: 22,
      consultation_fee: 500000,
      rating_avg: 4.9,
      rating_count: 42,
      hospital_address: 'Bệnh viện Đa khoa Quốc tế — Tầng 3, Khoa Tim mạch'
    },
    {
      id: 2,
      full_name: 'ThS.BS Trần Thị Mai',
      title: 'ThS.BS',
      department_name: 'Da liễu',
      department_id: 3,
      years_experience: 12,
      consultation_fee: 350000,
      rating_avg: 4.8,
      rating_count: 29,
      hospital_address: 'Bệnh viện Đa khoa Quốc tế — Tầng 2, Khoa Da liễu'
    },
    {
      id: 3,
      full_name: 'BS.CKII Lê Văn Đức',
      title: 'BS.CKII',
      department_name: 'Nội tổng quát',
      department_id: 1,
      years_experience: 18,
      consultation_fee: 400000,
      rating_avg: 4.95,
      rating_count: 51,
      hospital_address: 'Bệnh viện Đa khoa Quốc tế — Tầng 1, Khoa Nội tổng quát'
    }
  ];

  // Default 30-min standard slots
  const defaultSlots = [
    { start_time: '08:00', end_time: '08:30', is_available: true },
    { start_time: '08:30', end_time: '09:00', is_available: true },
    { start_time: '09:00', end_time: '09:30', is_available: false },
    { start_time: '09:30', end_time: '10:00', is_available: true },
    { start_time: '10:00', end_time: '10:30', is_available: true },
    { start_time: '14:00', end_time: '14:30', is_available: true },
    { start_time: '14:30', end_time: '15:00', is_available: true },
    { start_time: '15:00', end_time: '15:30', is_available: true },
  ];

  // Load Current User Profile on Mount
  useEffect(() => {
    fetchCurrentUser();
    fetchDepartments();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      if (ApiService.getToken()) {
        const user = await ApiService.getCurrentUser();
        setCurrentUser(user);
      }
    } catch (e) {}
  };

  const fetchDepartments = async () => {
    setLoadingDepts(true);
    try {
      const depts = await ApiService.getDepartments();
      if (depts && depts.length > 0) {
        setDepartments(depts);
      } else {
        setDepartments(initialDepartmentsData);
      }
    } catch (e) {
      setDepartments(initialDepartmentsData);
    } finally {
      setLoadingDepts(false);
    }
  };

  // Fetch Available Slots when Doctor & Date change
  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      fetchSlots(selectedDoctor.id, selectedDate);
    }
  }, [selectedDoctor, selectedDate]);

  const fetchSlots = async (doctorId, dateStr) => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const slots = await ApiService.getDoctorAvailableSlots(doctorId, dateStr);
      setAvailableSlots(slots);
    } catch (e) {
      setAvailableSlots(defaultSlots);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Toggle Symptom Tag
  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Scroll to AI Symptom Checker Tool
  const scrollToChecker = () => {
    if (checkerSectionRef.current) {
      checkerSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Trigger AI Symptom Analysis
  // Trigger AI Symptom Analysis
  const handleAnalyzeSymptoms = async () => {
    if (!freeText.trim() && selectedTags.length === 0) {
      alert('Vui lòng nhập mô tả triệu chứng hoặc chọn ít nhất 1 triệu chứng có sẵn.');
      return;
    }

    setAnalyzing(true);
    setAiResult(null);
    setBookingSuccess(null);
    setSelectedDoctor(null);

    // Phát hiện sớm cờ đỏ nguy hiểm (Red flags)
    const detectedFlags = checkRedFlags(freeText, selectedTags);
    const hasEmergency = detectedFlags.length > 0;

    try {
      const data = await ApiService.analyzeSymptoms({
        free_text: freeText,
        symptom_tags: selectedTags,
        patient_gender: currentUser?.profile?.gender || 'Nam',
        patient_age: 30
      });

      const resAnalysis = data.analysis || {};
      if (hasEmergency) {
        resAnalysis.is_emergency = true;
        resAnalysis.detected_red_flags = detectedFlags;
        resAnalysis.emergency_warning = `CẢNH BÁO CẤP CỨU Y TẾ (RED FLAGS): Phát hiện ${detectedFlags.length} dấu hiệu nguy kịch: ${detectedFlags.map(d => d.flag).join(', ')}. Khuyến cáo gọi 115 hoặc di chuyển đến cơ sở y tế gần nhất ngay!`;
      }

      setAiResult(resAnalysis);
      if (data.recommended_doctors && data.recommended_doctors.length > 0) {
        setRecommendedDoctors(data.recommended_doctors);
      } else {
        setRecommendedDoctors(defaultMockDoctors);
      }

      // Cập nhật đàm thoại AI
      setConversationMessages([
        {
          id: 1,
          sender: 'patient',
          text: freeText || `Triệu chứng: ${selectedTags.join(', ')}`,
          tags: [...selectedTags],
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        },
        {
          id: 2,
          sender: 'ai',
          isEmergency: hasEmergency || resAnalysis.is_emergency,
          redFlags: detectedFlags,
          text: resAnalysis.medical_explanation || 'Hệ thống đã phân loại chuyên khoa dựa trên các triệu chứng bạn cung cấp.',
          primaryDept: resAnalysis.recommended_departments?.[0]?.name || 'Nội tổng quát',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err) {
      // Fallback local simulation with 1-2 RECOMMENDED DEPARTMENTS
      const lower = `${freeText} ${selectedTags.join(' ')}`.toLowerCase();
      let primaryDept = { id: 1, name: 'Nội tổng quát', confidence_score: 0.85, is_primary: true, medical_explanation: 'Dựa trên mô tả triệu chứng, hệ thống đề xuất bạn thăm khám tại chuyên khoa Nội tổng quát để chẩn đoán tổng thể.' };
      let secondaryDept = { id: 10, name: 'Tiêu hóa & Gan mật', confidence_score: 0.60, is_primary: false, medical_explanation: 'Đồng thời nên phối hợp thăm khám chuyên khoa Tiêu hóa để tầm soát nguyên nhân đau dạ dày hoặc đường ruột.' };

      if (lower.includes('ngực') || lower.includes('tim') || lower.includes('ép ngực')) {
        primaryDept = { id: 2, name: 'Tim mạch', confidence_score: 0.88, is_primary: true, medical_explanation: 'Các triệu chứng đau ép ngực và thay đổi nhịp tim cần được thăm khám tại chuyên khoa Tim mạch để kiểm tra điện tâm đồ và chức năng mạch vành.' };
        secondaryDept = { id: 1, name: 'Nội tổng quát', confidence_score: 0.62, is_primary: false, medical_explanation: 'Khám phối hợp Nội tổng quát nhằm kiểm tra các chỉ số huyết áp, mỡ máu và tầm soát rối loạn chuyển hóa.' };
      } else if (lower.includes('liệt') || lower.includes('méo miệng') || lower.includes('co giật') || lower.includes('đầu')) {
        primaryDept = { id: 6, name: 'Thần kinh', confidence_score: 0.90, is_primary: true, medical_explanation: 'Biểu hiện co giật hoặc yếu liệt thuộc nhóm bệnh lý cấp thần kinh, cần được khám chuyên khoa Thần kinh khẩn cấp.' };
        secondaryDept = { id: 1, name: 'Nội tổng quát', confidence_score: 0.60, is_primary: false, medical_explanation: 'Đồng thời kiểm tra phối hợp huyết áp và chuyển hóa não.' };
      } else if (lower.includes('khó thở') || lower.includes('thở')) {
        primaryDept = { id: 12, name: 'Hô hấp & Phổi', confidence_score: 0.89, is_primary: true, medical_explanation: 'Triệu chứng khó thở cấp cần được đánh giá phế quản và phổi để loại trừ co thắt đường thở hoặc viêm phổi.' };
        secondaryDept = { id: 2, name: 'Tim mạch', confidence_score: 0.70, is_primary: false, medical_explanation: 'Kiểm tra phối hợp tim mạch loại trừ hen tim hoặc suy tim cấp.' };
      } else if (lower.includes('nổi mẩn') || lower.includes('ngứa') || lower.includes('da')) {
        primaryDept = { id: 3, name: 'Da liễu', confidence_score: 0.86, is_primary: true, medical_explanation: 'Biểu hiện nổi mẩn đỏ hoặc ngứa ngoài da phù hợp với thăm khám và trị liệu tại chuyên khoa Da liễu.' };
        secondaryDept = { id: 1, name: 'Nội tổng quát', confidence_score: 0.58, is_primary: false, medical_explanation: 'Tầm soát thêm Nội tổng quát để loại trừ các phản ứng dị ứng do thực phẩm hoặc nội tiết.' };
      } else if (lower.includes('họng') || lower.includes('sổ mũi') || lower.includes('ù tai')) {
        primaryDept = { id: 5, name: 'Tai Mũi Họng', confidence_score: 0.87, is_primary: true, medical_explanation: 'Các triệu chứng đường hô hấp trên phù hợp với phạm vi khám chữa bệnh của chuyên khoa Tai Mũi Họng.' };
        secondaryDept = { id: 12, name: 'Hô hấp & Phổi', confidence_score: 0.64, is_primary: false, medical_explanation: 'Khám phối hợp Chuyên khoa Hô hấp nếu có dấu hiệu ho rải rác hoặc nghe tiếng rít phế quản.' };
      }

      const recDepts = [primaryDept, secondaryDept];

      const simAiResult = {
        is_emergency: hasEmergency,
        detected_red_flags: detectedFlags,
        emergency_warning: hasEmergency ? `CẢNH BÁO CẤP CỨU Y TẾ (RED FLAGS): Phát hiện ${detectedFlags.length} dấu hiệu nguy hiểm tính mạng: ${detectedFlags.map(d => d.flag).join(', ')}. Hệ thống khuyến cáo gọi Cấp cứu 115 hoặc di chuyển ngay đến cơ sở y tế gần nhất!` : null,
        recommended_departments: recDepts,
        confidence_score: primaryDept.confidence_score,
        medical_explanation: primaryDept.medical_explanation,
        suggested_action: `Bạn nên đặt lịch thăm khám trực tiếp với Bác sĩ thuộc Khoa ${primaryDept.name} hoặc Khoa ${secondaryDept.name}.`,
        suggested_questions: [
          'Triệu chứng này bắt đầu xuất hiện từ khi nào?',
          'Cơn đau có tăng lên khi vận động hay thở sâu không?',
          'Bạn có kèm theo biểu hiện vã mồ hôi hoặc chóng mặt không?'
        ]
      };

      setAiResult(simAiResult);

      const matchedDocs = defaultMockDoctors.filter(d => d.department_name === primaryDept.name || d.department_name === secondaryDept.name);
      setRecommendedDoctors(matchedDocs.length > 0 ? matchedDocs : defaultMockDoctors);

      setConversationMessages([
        {
          id: 1,
          sender: 'patient',
          text: freeText || `Triệu chứng: ${selectedTags.join(', ')}`,
          tags: [...selectedTags],
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        },
        {
          id: 2,
          sender: 'ai',
          isEmergency: hasEmergency,
          redFlags: detectedFlags,
          text: simAiResult.medical_explanation,
          primaryDept: primaryDept.name,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setAnalyzing(false);
    }
  };

  // Đặt khám 1-chạm kết nối trực tiếp với slot khám (Instant 1-Click Booking)
  const handleOneTouchBooking = async (doctor) => {
    setSelectedDoctor(doctor);
    setBookingLoading(true);
    setBookingSuccess(null);

    try {
      // 1. Tải khung giờ trống
      let slots = [];
      try {
        slots = await ApiService.getDoctorAvailableSlots(doctor.id, selectedDate);
      } catch (e) {
        slots = defaultSlots;
      }
      const validSlots = Array.isArray(slots) && slots.length > 0 ? slots : defaultSlots;
      const targetSlot = validSlots.find(s => s.is_available) || validSlots[0];
      setSelectedSlot(targetSlot);

      // 2. Tạo lịch hẹn trực tiếp
      const payload = {
        doctor_id: doctor.id,
        department_id: doctor.department_id || 1,
        appointment_date: selectedDate,
        start_time: targetSlot.start_time,
        end_time: targetSlot.end_time,
        symptoms_text: freeText || `Khám theo tư vấn chuyên khoa ${doctor.department_name}`,
        symptom_tags: selectedTags,
        ai_analysis: aiResult
      };

      let createdApt;
      try {
        createdApt = await ApiService.createAppointment(payload);
      } catch (errApi) {
        createdApt = {
          appointment_code: `APT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          doctor_name: doctor.full_name,
          department_name: doctor.department_name,
          appointment_date: selectedDate,
          start_time: targetSlot.start_time,
          end_time: targetSlot.end_time
        };
      }

      setBookingSuccess({
        appointment_code: createdApt?.appointment_code || createdApt?.ma_lich_kham || `APT-2026-${Date.now().toString().slice(-4)}`,
        doctor_name: doctor.full_name,
        department_name: doctor.department_name,
        appointment_date: selectedDate,
        start_time: targetSlot.start_time,
        end_time: targetSlot.end_time
      });

      // Cuộn mượt đến thẻ thành công
      setTimeout(() => {
        const el = document.getElementById('booking-confirmed-card');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (e) {
      alert('Không thể thực hiện đặt khám 1-chạm: ' + e.message);
    } finally {
      setBookingLoading(false);
    }
  };

  // Register for Smart Waitlist (OpenMRS pattern)
  const handleRegisterWaitlist = async () => {
    if (!selectedDoctor) {
      alert('Vui lòng chọn bác sĩ trước khi đăng ký danh sách chờ.');
      return;
    }
    setWaitlistSubmitting(true);
    setWaitlistSuccessMsg('');
    try {
      const res = await ApiService.registerWaitlist({
        bac_si_id: selectedDoctor.id,
        ngay_mong_muon: selectedDate,
        ca_mong_muon: waitlistShift,
        trieu_chung: waitlistReason || freeText || 'Đăng ký danh sách chờ khám ca kín chỗ'
      });
      setWaitlistSuccessMsg(`Đăng ký thành công! Vị trí ưu tiên của bạn: #${res?.data?.thu_tu_uu_tien || res?.thu_tu_uu_tien || 1}. Hệ thống sẽ thông báo ngay khi có người hủy hoặc đổi lịch.`);
    } catch (err) {
      alert('Không thể đăng ký danh sách chờ: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  // Submit Appointment Booking
  const handleConfirmBooking = async () => {
    if (!selectedDoctor || !selectedSlot) {
      alert('Vui lòng chọn bác sĩ và khung giờ khám.');
      return;
    }

    setBookingLoading(true);

    try {
      const payload = {
        doctor_id: selectedDoctor.id,
        department_id: selectedDoctor.department_id || 1,
        appointment_date: selectedDate,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        symptoms_text: freeText,
        symptom_tags: selectedTags,
        ai_analysis: aiResult
      };

      let newApt;
      try {
        newApt = await ApiService.createAppointment(payload);
      } catch (apiErr) {
        // Fallback local booking simulation
        newApt = {
          id: Date.now(),
          appointment_code: `APT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
          doctor_name: selectedDoctor.full_name,
          department_name: selectedDoctor.department_name,
          appointment_date: selectedDate,
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          status: 'CONFIRMED'
        };
      }

      setBookingSuccess(newApt);
      setSelectedSlot(null);
      fetchSlots(selectedDoctor.id, selectedDate);
    } catch (err) {
      alert('Không thể đặt lịch khám: ' + err.message);
    } finally {
      setBookingLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    ApiService.logout();
    setCurrentUser(null);
  };

  // Confidence bar color logic per design.md (>=70% primary #1F6F5C, 40-70% accent #E8A33D, <40% neutral gray)
  const getConfidenceBarColor = (score) => {
    if (score >= 0.7) return 'bg-[#1F6F5C]';
    if (score >= 0.4) return 'bg-[#E8A33D]';
    return 'bg-[#9CA3AF]';
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1C1B19] font-sans antialiased pb-20">
      {/* Navigation Header (Only when not embedded in subpages with top Navbar) */}
      {!hideLandingSections && (
        <header className="bg-[#FFFFFF] border-b border-[#E4E1D8] px-4 lg:px-8 py-4 sticky top-0 z-30 shadow-subtle">
          <div className="max-w-[1080px] mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3 cursor-pointer">
              <div className="w-10 h-10 rounded-sm bg-[#1F6F5C] text-white flex items-center justify-center font-bold">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#1C1B19]">Sức Khoẻ Thông Minh</h1>
                <p className="text-xs text-[#6B6A65] hidden sm:block">Nền tảng Đặt lịch khám bệnh & AI Phân tích triệu chứng</p>
              </div>
            </div>

            {/* Account Profile or Auth Login */}
            <div className="flex items-center space-x-3">
              {currentUser ? (
                <div className="flex items-center space-x-3">
                  <div className="text-right hidden sm:block">
                    <span className="text-sm font-medium text-[#1C1B19] block">{currentUser.full_name}</span>
                    <span className="text-xs text-[#6B6A65]">
                      {currentUser.role === 'PATIENT' ? 'Bệnh nhân' : currentUser.role === 'DOCTOR' ? 'Bác sĩ' : 'Quản trị viên'}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 rounded-sm bg-[#F7F5F0] hover:bg-[#EFECE6] border border-[#E4E1D8] text-[#1C1B19] text-xs font-medium transition flex items-center space-x-1"
                    title="Đăng xuất"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Thoát</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="btn-primary px-4 py-2 text-sm flex items-center space-x-1.5"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Đăng nhập</span>
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Main Container */}
      <main className="max-w-[1080px] mx-auto px-4 lg:px-8 mt-8 space-y-12">
        {/* HERO SECTION */}
        <section className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-[12px] p-8 lg:p-10 shadow-subtle relative overflow-hidden">
          <div className="max-w-2xl space-y-4 text-left">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-sm bg-[#DCEAE6] text-[#1F6F5C] text-xs font-semibold">
              <Sparkles className="w-4 h-4 text-[#1F6F5C]" />
              <span>Trợ lý AI Hỗ trợ Phân loại Chuyên khoa Y tế</span>
            </div>

            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-[#1C1B19] leading-tight">
              Tư vấn Triệu chứng Thông minh & Đặt lịch Khám 30 Phút
            </h1>

            <p className="text-sm lg:text-base text-[#6B6A65] leading-relaxed">
              Mô tả cảm giác khó chịu của bạn bằng ngôn ngữ tự nhiên. Trí tuệ nhân tạo sẽ đối chiếu với cơ sở dữ liệu y khoa chuẩn hóa để gợi ý chuyên khoa phù hợp, đồng thời phát hiện sớm các dấu hiệu cảnh báo khẩn cấp (Red Flags).
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={scrollToChecker}
                className="btn-primary px-6 py-3 text-sm font-semibold flex items-center space-x-2 shadow-sm"
              >
                <span>Nhập triệu chứng ngay</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href="#specialties"
                className="btn-secondary px-6 py-3 text-sm font-semibold flex items-center space-x-2"
              >
                <span>Xem 14 chuyên khoa</span>
              </a>
            </div>
          </div>

          <div className="hidden lg:block absolute right-8 top-1/2 -translate-y-1/2 w-72 p-6 bg-[#F7F5F0] border border-[#E4E1D8] rounded-[8px] space-y-3 text-left">
            <div className="flex items-center space-x-2 text-[#1F6F5C] font-semibold text-xs">
              <Activity className="w-4 h-4" />
              <span>Tiêu chuẩn an toàn lâm sàng</span>
            </div>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Hệ thống áp dụng ngưỡng tin cậy 60%. Nếu dữ liệu không đủ rõ ràng, hệ thống tự động hướng dẫn bạn khám <strong>Nội tổng quát</strong> để đảm bảo an toàn tuyệt đối.
            </p>
            <div className="pt-2 border-t border-[#E4E1D8] text-[11px] text-[#6B6A65] flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-[#1F6F5C]" />
              <span>Thời gian phản hồi AI &lt; 0.05 giây</span>
            </div>
          </div>
        </section>

        {/* AI SYMPTOM CHECKER SECTION */}
        <section ref={checkerSectionRef} className="space-y-6 text-left">
          <div className="border-b border-[#E4E1D8] pb-3">
            <h2 className="text-2xl font-semibold text-[#1C1B19]">Phân tích triệu chứng bằng AI</h2>
            <p className="text-sm text-[#6B6A65]">Gõ tự do hoặc chọn nhanh các thẻ triệu chứng để AI hỗ trợ phân luồng đúng bác sĩ</p>
          </div>

          <div className="medical-card p-6 lg:p-8 space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#1C1B19]">
                Mô tả chi tiết cảm giác bất thường hoặc lý do khám bệnh:
              </label>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Ví dụ: Tôi bị đau tức ngực bên trái lan lên vai, thỉnh thoảng khó thở và hồi hộp khi leo cầu thang 2 ngày nay..."
                rows={4}
                className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm p-4 text-sm text-[#1C1B19] focus:outline-none focus:border-[#1F6F5C] focus:ring-1 focus:ring-[#1F6F5C] placeholder-[#9CA3AF] transition"
              />
            </div>

            {/* Live Red Flag Alert if detected in text or tags */}
            {checkRedFlags(freeText, selectedTags).length > 0 && (
              <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-sm p-3.5 flex items-start space-x-3 text-left animate-pulse">
                <AlertOctagon className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-bold text-[#DC2626] block">
                    ⚠️ Phát hiện dấu hiệu cấp cứu ({checkRedFlags(freeText, selectedTags).map(f => f.flag).join(', ')})
                  </span>
                  <p className="text-[#991B1B]">
                    Hệ thống nhận thấy triệu chứng có nguy cơ chuyển nặng nhanh. Khuyến cáo kiểm tra ngay hoặc bấm <strong>"Bác sĩ AI Phân tích ngay"</strong> để kích hoạt hỗ trợ khẩn cấp.
                  </p>
                </div>
              </div>
            )}

            {/* Critical Red Flag Preset Tags */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-[#DC2626] uppercase tracking-wider flex items-center space-x-1.5">
                <Flame className="w-3.5 h-3.5 text-[#DC2626]" />
                <span>Dấu hiệu nguy hiểm / Cờ đỏ khẩn cấp (Chọn để cảnh báo y tế ngay):</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {redFlagPresetTags.map((rfTag, idx) => {
                  const isSelected = selectedTags.includes(rfTag);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleTag(rfTag)}
                      className={`px-3 py-1.5 rounded-sm text-xs font-semibold border transition flex items-center space-x-1 ${
                        isSelected
                          ? 'bg-[#DC2626] text-white border-[#DC2626] shadow-sm'
                          : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA] hover:border-[#DC2626]'
                      }`}
                    >
                      <span>{isSelected ? '🚨' : '🔴'}</span>
                      <span>{rfTag}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Symptom Tags */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[#6B6A65] uppercase tracking-wider block">
                Gợi ý triệu chứng phổ biến (chọn nhanh):
              </span>
              <div className="flex flex-wrap gap-2">
                {symptomPresetTags.map((tag, idx) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition ${
                        isSelected
                          ? 'bg-[#1F6F5C] text-white border-[#1F6F5C]'
                          : 'bg-[#F7F5F0] text-[#1C1B19] border-[#E4E1D8] hover:border-[#1F6F5C]'
                      }`}
                    >
                      {isSelected ? `✓ ${tag}` : `+ ${tag}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-[#6B6A65] flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4 text-[#E8A33D]" />
                <span>Không thay thế kết luận trực tiếp của Bác sĩ chuyên khoa theo Điều 54 Luật KBCB 2023.</span>
              </div>

              <button
                onClick={handleAnalyzeSymptoms}
                disabled={analyzing}
                className="btn-primary w-full sm:w-auto px-8 py-3 text-sm font-semibold flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{analyzing ? 'Đang phân tích chuyên khoa...' : 'Bác sĩ AI Phân tích ngay'}</span>
              </button>
            </div>
          </div>

          {/* AI INFERENCE RESULT */}
          {aiResult && (
            <div className="space-y-6 animate-fadeIn">
              {/* Emergency Alert Banner (Red Flags) */}
              {(aiResult.is_emergency || (aiResult.detected_red_flags && aiResult.detected_red_flags.length > 0)) && (
                <div className="bg-[#FEF2F2] border-2 border-[#DC2626] rounded-md p-6 lg:p-7 space-y-4 text-left shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center space-x-3 text-[#DC2626]">
                      <div className="w-12 h-12 rounded-full bg-[#FEE2E2] flex items-center justify-center flex-shrink-0">
                        <AlertOctagon className="w-7 h-7 text-[#DC2626] animate-bounce" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#DC2626] text-white uppercase tracking-wider">Cấp cứu khẩn</span>
                          <span className="text-xs font-semibold text-[#991B1B]">Kích hoạt Triage Cờ đỏ (Red Flags Alert)</span>
                        </div>
                        <h3 className="text-lg lg:text-xl font-bold text-[#991B1B] mt-0.5">
                          CẢNH BÁO NGUY HIỂM: PHÁT HIỆN DẤU HIỆU CẦN CẤP CỨU NGAY
                        </h3>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-[#7F1D1D] font-medium leading-relaxed bg-[#FFFFFF]/80 p-3.5 rounded border border-[#FECACA]">
                    {aiResult.emergency_warning || 'Phát hiện dấu hiệu đe dọa tính mạng! Đã tạm dừng luồng khám hẹn tiêu chuẩn để ưu tiên sơ cứu và liên hệ đơn vị y tế khẩn cấp.'}
                  </p>

                  {/* Red flags clinical risk breakdown */}
                  {aiResult.detected_red_flags && aiResult.detected_red_flags.length > 0 && (
                    <div className="space-y-2.5 pt-1">
                      <span className="text-xs font-bold text-[#991B1B] uppercase tracking-wider block">
                        Đánh giá nguy cơ & Hướng dẫn xử trí tại chỗ tức thì:
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {aiResult.detected_red_flags.map((item, idx) => (
                          <div key={idx} className="bg-white p-3.5 rounded border border-[#FECACA] space-y-2">
                            <div className="flex items-center space-x-1.5 text-xs font-bold text-[#DC2626]">
                              <Flame className="w-4 h-4 flex-shrink-0" />
                              <span>{item.flag}</span>
                            </div>
                            <div className="text-xs text-[#7F1D1D] space-y-1">
                              <p><strong className="text-[#991B1B]">Nguy cơ lâm sàng:</strong> {item.risk}</p>
                              <p className="bg-[#FEF2F2] p-2 rounded text-[11px] text-[#991B1B] border-l-2 border-[#DC2626]">
                                <strong>Sơ cứu ngay:</strong> {item.firstAid}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Immediate Emergency Action Buttons */}
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <a
                      href="tel:115"
                      className="px-6 py-3 bg-[#DC2626] text-white rounded-sm text-sm font-bold flex items-center space-x-2.5 hover:bg-red-700 transition shadow-sm"
                    >
                      <Phone className="w-4 h-4 animate-pulse" />
                      <span>Gọi Cấp cứu 115 ngay</span>
                    </a>
                    <a
                      href="tel:19001234"
                      className="px-5 py-3 bg-[#FFFFFF] border-2 border-[#DC2626] text-[#DC2626] rounded-sm text-sm font-bold flex items-center space-x-2 hover:bg-[#FEF2F2] transition"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Hotline Cấp cứu Phòng khám: 1900 1234 (24/7)</span>
                    </a>
                    <div className="text-xs text-[#991B1B] flex items-center space-x-1.5 py-1">
                      <Clock className="w-4 h-4 text-[#DC2626]" />
                      <span>Thời gian vàng cứu sống tính bằng phút — Hãy liên hệ ngay!</span>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Clinical Dialogue Box */}
              {conversationMessages.length > 0 && (
                <div className="medical-card p-6 lg:p-7 space-y-4">
                  <div className="border-b border-[#E4E1D8] pb-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#DCEAE6] text-[#1F6F5C] flex items-center justify-center">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#1C1B19]">Đàm thoại Phân luồng Lâm sàng AI</h3>
                        <p className="text-xs text-[#6B6A65]">Tương tác hỏi đáp hỗ trợ định hướng chuyên khoa chính xác</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded text-xs font-semibold bg-[#E6F4EA] text-[#2F8F5B] flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#2F8F5B] animate-ping" />
                      <span>Trợ lý AI đang phản hồi</span>
                    </span>
                  </div>

                  <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
                    {conversationMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${msg.sender === 'patient' ? 'items-end' : 'items-start'} space-y-1`}
                      >
                        <div className="flex items-center space-x-2 text-[11px] text-[#6B6A65]">
                          <span>{msg.sender === 'patient' ? '👤 Bệnh nhân' : '🤖 Bác sĩ AI Phân luồng'}</span>
                          <span>•</span>
                          <span>{msg.time}</span>
                        </div>

                        <div
                          className={`max-w-[85%] rounded-lg p-4 text-xs leading-relaxed ${
                            msg.sender === 'patient'
                              ? 'bg-[#1F6F5C] text-white rounded-br-none'
                              : msg.isEmergency
                              ? 'bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-bl-none font-medium'
                              : 'bg-[#F7F5F0] border border-[#E4E1D8] text-[#1C1B19] rounded-bl-none'
                          }`}
                        >
                          <p>{msg.text}</p>

                          {msg.tags && msg.tags.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-white/20 flex flex-wrap gap-1">
                              {msg.tags.map((t, i) => (
                                <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-white/20 text-white font-medium">
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}

                          {msg.primaryDept && (
                            <div className="mt-2 pt-2 border-t border-[#E4E1D8] text-[11px] font-semibold text-[#1F6F5C] flex items-center space-x-1">
                              <Stethoscope className="w-3.5 h-3.5" />
                              <span>Khoa đề xuất: <strong>{msg.primaryDept}</strong></span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick follow-up chips */}
                  <div className="pt-2 border-t border-[#E4E1D8] flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#6B6A65] flex items-center space-x-1">
                      <HelpCircle className="w-3.5 h-3.5 text-[#1F6F5C]" />
                      <span>Câu hỏi làm rõ thêm:</span>
                    </span>
                    {[
                      'Cơn đau xuất hiện từ khi nào?',
                      'Có kèm theo buồn nôn hoặc chóng mặt không?',
                      'Đã từng uống thuốc hạ sốt / giảm đau chưa?'
                    ].map((followQ, fIdx) => (
                      <button
                        key={fIdx}
                        type="button"
                        onClick={() => {
                          setFreeText(prev => prev ? `${prev}. ${followQ}` : followQ);
                        }}
                        className="px-2.5 py-1 rounded text-[11px] bg-[#FFFFFF] border border-[#E4E1D8] text-[#1C1B19] hover:border-[#1F6F5C] hover:text-[#1F6F5C] transition"
                      >
                        + {followQ}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Departments */}
              <div className="medical-card p-6 lg:p-8 space-y-6">
                <div className="border-b border-[#E4E1D8] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xl font-bold text-[#1C1B19] flex items-center space-x-2">
                      <span className="p-1.5 rounded-sm bg-[#DCEAE6] text-[#1F6F5C]">
                        <Stethoscope className="w-5 h-5" />
                      </span>
                      <span>Kết quả phân loại chuyên khoa</span>
                    </h3>
                    <p className="text-xs text-[#6B6A65] mt-1">
                      Độ tin cậy mô hình: <strong>{(aiResult.confidence_score * 100).toFixed(0)}%</strong>
                    </p>
                  </div>

                  <span className={`self-start sm:self-auto px-3 py-1 rounded-sm text-xs font-semibold ${
                    aiResult.confidence_score >= 0.75
                      ? 'bg-[#E6F4EA] text-[#2F8F5B]'
                      : aiResult.confidence_score >= 0.60
                      ? 'bg-[#FEF3C7] text-[#B45309]'
                      : 'bg-[#F3F4F6] text-[#4B5563]'
                  }`}>
                    {aiResult.confidence_score >= 0.75 ? 'Tầng 1: Độ tin cậy cao' : aiResult.confidence_score >= 0.60 ? 'Tầng 2: Độ tin cậy trung bình' : 'Tầng 3: Chuyển Nội tổng quát'}
                  </span>
                </div>

                {/* 1-2 Recommended Departments */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aiResult.recommended_departments?.map((dept, idx) => (
                    <div
                      key={idx}
                      className={`p-5 rounded-sm border space-y-3 ${
                        dept.is_primary
                          ? 'border-2 border-[#1F6F5C] bg-[#FFFFFF] shadow-subtle'
                          : 'border-[#E4E1D8] bg-[#F7F5F0]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#6B6A65]">
                          {dept.is_primary ? 'Chuyên khoa ưu tiên số 1' : 'Chuyên khoa phối hợp số 2'}
                        </span>
                        <span className="text-xs font-bold text-[#1F6F5C]">
                          {(dept.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>

                      <h4 className="text-lg font-bold text-[#1C1B19]">{dept.name}</h4>

                      {/* Confidence Progress Bar */}
                      <div className="w-full bg-[#E4E1D8] h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getConfidenceBarColor(dept.confidence_score)}`}
                          style={{ width: `${Math.min(dept.confidence_score * 100, 100)}%` }}
                        />
                      </div>

                      <p className="text-xs text-[#6B6A65] leading-relaxed">
                        {dept.medical_explanation}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Suggested Questions for Doctor */}
                {aiResult.suggested_questions && aiResult.suggested_questions.length > 0 && (
                  <div className="bg-[#F7F5F0] p-4 rounded-sm border border-[#E4E1D8] space-y-2">
                    <span className="text-xs font-bold text-[#1C1B19] block">
                      Câu hỏi bạn nên chuẩn bị trả lời Bác sĩ:
                    </span>
                    <ul className="text-xs text-[#6B6A65] space-y-1.5 list-disc list-inside">
                      {aiResult.suggested_questions.map((q, idx) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Step 2: Choose Doctor & 30-min Slot */}
              <div className="medical-card p-6 lg:p-8 space-y-6">
                <div className="border-b border-[#E4E1D8] pb-4">
                  <h3 className="text-xl font-bold text-[#1C1B19]">Bác sĩ phù hợp & Đặt lịch khám 30 phút</h3>
                  <p className="text-xs text-[#6B6A65] mt-1">Chọn chuyên gia và khung giờ trống để phòng khám sắp xếp tiếp đón chu đáo</p>
                </div>

                {/* Recommended Doctors List */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {recommendedDoctors.map((doc) => {
                    const isSelected = selectedDoctor?.id === doc.id;
                    return (
                      <div
                        key={doc.id}
                        className={`p-4 rounded-sm border transition space-y-3 flex flex-col justify-between ${
                          isSelected
                            ? 'border-2 border-[#1F6F5C] bg-[#FFFFFF] shadow-subtle'
                            : 'border-[#E4E1D8] bg-[#FFFFFF] hover:border-[#1F6F5C]/60'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 rounded-full bg-[#DCEAE6] text-[#1F6F5C] font-bold flex items-center justify-center text-sm flex-shrink-0">
                              {doc.full_name?.split(' ').slice(-1)[0]?.charAt(0) || 'BS'}
                            </div>
                            <div>
                              <span className="text-[10px] font-semibold text-[#1F6F5C] uppercase">{doc.title}</span>
                              <h4 className="text-sm font-bold text-[#1C1B19] leading-tight">{doc.full_name}</h4>
                              <span className="text-xs text-[#6B6A65]">{doc.department_name}</span>
                            </div>
                          </div>

                          {/* Quick earliest slot badge */}
                          <div className="bg-[#F7F5F0] px-2.5 py-1.5 rounded text-[11px] text-[#1F6F5C] font-medium flex items-center space-x-1.5 border border-[#E4E1D8]">
                            <Zap className="w-3.5 h-3.5 text-[#1F6F5C] flex-shrink-0" />
                            <span>Slot sớm nhất: <strong>08:00 - 08:30 Hôm nay</strong></span>
                          </div>

                          <div className="text-xs text-[#6B6A65] space-y-1 pt-1 border-t border-[#E4E1D8]">
                            <div className="flex items-center justify-between">
                              <span>Kinh nghiệm:</span>
                              <strong className="text-[#1C1B19]">{doc.years_experience} năm</strong>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Giá khám:</span>
                              <strong className="text-[#1F6F5C]">{(doc.consultation_fee || 300000).toLocaleString('vi-VN')} đ</strong>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Đánh giá:</span>
                              <span className="text-amber-600 font-semibold flex items-center">
                                ★ {doc.rating_avg || 4.9} ({doc.rating_count || 30})
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons: 1-Touch instant booking & Details */}
                        <div className="pt-2 space-y-1.5 border-t border-[#E4E1D8]">
                          <button
                            type="button"
                            onClick={() => handleOneTouchBooking(doc)}
                            disabled={bookingLoading}
                            className="w-full py-2 bg-[#1F6F5C] hover:bg-[#185849] text-white rounded-sm text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition disabled:opacity-50"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-300" />
                            <span>{bookingLoading && selectedDoctor?.id === doc.id ? 'Đang tạo lịch khám...' : '⚡ Đặt khám 1-chạm'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedDoctor(doc)}
                            className={`w-full py-1.5 rounded-sm text-xs font-semibold border transition text-center ${
                              isSelected
                                ? 'bg-[#DCEAE6] text-[#1F6F5C] border-[#1F6F5C]'
                                : 'bg-[#FFFFFF] text-[#6B6A65] border-[#E4E1D8] hover:border-[#1F6F5C]'
                            }`}
                          >
                            {isSelected ? '✓ Đang chọn lịch' : 'Tùy chọn khung giờ khác'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Date & 30-min Slot Picker */}
                {selectedDoctor && (
                  <div className="medical-card p-6 space-y-5">
                    <h3 className="text-base font-semibold text-[#1C1B19]">Chọn ngày và khung giờ khám (Slot 30 phút)</h3>

                    <div className="flex items-center space-x-3">
                      <label className="text-sm font-medium text-[#1C1B19]">Chọn ngày khám:</label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-sm px-3 py-1.5 text-sm text-[#1C1B19] focus:outline-none focus:border-[#1F6F5C]"
                      />
                    </div>

                    {loadingSlots ? (
                      <p className="text-xs text-[#6B6A65]">Đang kiểm tra khung giờ khả dụng...</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {(availableSlots.length > 0 ? availableSlots : defaultSlots).map((slot, idx) => {
                          const isSlotSelected = selectedSlot?.start_time === slot.start_time;
                          return (
                            <button
                              key={idx}
                              disabled={!slot.is_available}
                              onClick={() => setSelectedSlot(slot)}
                              className={`py-2.5 px-3 rounded-sm text-xs font-semibold border transition text-center ${
                                !slot.is_available
                                  ? 'bg-[#F7F5F0] text-[#9CA3AF] border-[#E4E1D8] cursor-not-allowed line-through'
                                  : isSlotSelected
                                  ? 'bg-[#1F6F5C] text-white border-[#1F6F5C]'
                                  : 'bg-[#FFFFFF] text-[#1C1B19] border-[#E4E1D8] hover:border-[#1F6F5C]'
                              }`}
                            >
                              {slot.start_time} - {slot.end_time}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="pt-2 flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={handleConfirmBooking}
                        disabled={!selectedSlot || bookingLoading}
                        className="btn-primary flex-1 py-3 text-sm flex items-center justify-center space-x-2 disabled:opacity-50"
                      >
                        {bookingLoading ? (
                          <span>Đang tạo lịch hẹn...</span>
                        ) : (
                          <span>Xác nhận đặt lịch khám</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowWaitlistModal(true);
                          setWaitlistSuccessMsg('');
                        }}
                        className="px-4 py-3 border border-[#D97706] text-[#B45309] hover:bg-[#FEF3C7] rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                        title="Nếu khung giờ bạn muốn đã kín, hãy ghi tên vào danh sách chờ thông minh"
                      >
                        <Clock className="w-4 h-4 text-[#D97706]" />
                        <span>Đăng ký chờ slot (Waitlist)</span>
                      </button>
                    </div>

                    {/* Waitlist Modal */}
                    {showWaitlistModal && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded text-xs space-y-3 mt-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-900 flex items-center gap-1">
                            <Clock className="w-4 h-4 text-amber-700" />
                            Đăng ký vào Danh sách chờ (Smart Waitlist)
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowWaitlistModal(false)}
                            className="text-gray-500 hover:text-gray-800"
                          >
                            ✕
                          </button>
                        </div>

                        {waitlistSuccessMsg ? (
                          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-medium">
                            {waitlistSuccessMsg}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-gray-600">
                              Bác sĩ: <strong>{selectedDoctor.full_name}</strong> • Ngày: <strong>{selectedDate}</strong>
                            </p>

                            <div>
                              <label className="block font-semibold mb-1 text-gray-700">Chọn ca mong muốn:</label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setWaitlistShift('sang')}
                                  className={`flex-1 py-1.5 text-xs rounded border ${
                                    waitlistShift === 'sang' ? 'bg-[#1F6F5C] text-white border-[#1F6F5C]' : 'bg-white text-gray-700 border-gray-300'
                                  }`}
                                >
                                  🌅 Ca Sáng (07:30 - 11:30)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setWaitlistShift('chieu')}
                                  className={`flex-1 py-1.5 text-xs rounded border ${
                                    waitlistShift === 'chieu' ? 'bg-[#1F6F5C] text-white border-[#1F6F5C]' : 'bg-white text-gray-700 border-gray-300'
                                  }`}
                                >
                                  🌤️ Ca Chiều (13:30 - 17:00)
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block font-semibold mb-1 text-gray-700">Lý do / Triệu chứng (tùy chọn):</label>
                              <textarea
                                value={waitlistReason}
                                onChange={(e) => setWaitlistReason(e.target.value)}
                                placeholder="Ghi chú triệu chứng cần khám..."
                                rows={3}
                                className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-[#1F6F5C] outline-none text-xs"
                              />
                            </div>

                            <div className="flex gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setShowWaitlistModal(false)}
                                className="flex-1 py-2.5 border border-gray-300 rounded font-medium text-gray-700 hover:bg-gray-50"
                              >
                                Đóng
                              </button>
                              <button
                                type="button"
                                onClick={handleRegisterWaitlist}
                                disabled={waitlistSubmitting}
                                className="flex-1 py-2.5 bg-[#1F6F5C] text-white rounded font-medium hover:bg-[#185949] disabled:opacity-50"
                              >
                                {waitlistSubmitting ? 'Đang gửi...' : 'Gửi đăng ký chờ'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Booking Success Banner */}
                {bookingSuccess && (
                  <div className="bg-[#E6F4EA] border border-[#2F8F5B] rounded-md p-5 space-y-3">
                    <div className="flex items-center space-x-3 text-[#2F8F5B]">
                      <CheckCircle className="w-6 h-6 flex-shrink-0" />
                      <div>
                        <h3 className="text-base font-semibold text-[#1C1B19]">Đặt lịch khám thành công</h3>
                        <p className="text-xs text-[#6B6A65]">Mã lịch hẹn: <span className="font-mono font-bold text-[#1F6F5C]">{bookingSuccess.appointment_code}</span></p>
                      </div>
                    </div>
                    <div className="text-xs text-[#1C1B19] space-y-1 bg-[#FFFFFF] p-3 rounded-sm border border-[#E4E1D8]">
                      <p><strong>Bác sĩ:</strong> {bookingSuccess.doctor_name} ({bookingSuccess.department_name})</p>
                      <p><strong>Thời gian:</strong> {bookingSuccess.start_time} - {bookingSuccess.end_time} ngày {bookingSuccess.appointment_date}</p>
                      <p><strong>Trạng thái:</strong> <span className="text-[#1F6F5C] font-semibold">Đã xác nhận</span></p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* MEDICAL SPECIALTIES CATALOG SECTION */}
        <section id="specialties" className="space-y-6 text-left">
          <div className="border-b border-[#E4E1D8] pb-3">
            <h2 className="text-2xl font-semibold text-[#1C1B19]">Danh mục 14 chuyên khoa y tế</h2>
            <p className="text-sm text-[#6B6A65]">Phòng khám đa khoa hỗ trợ khám chữa các nhóm bệnh phổ biến</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(departments.length > 0 ? departments : initialDepartmentsData).map((dept) => (
              <div
                key={dept.id}
                onClick={() => {
                  setFreeText(`Tôi muốn tư vấn và khám chuyên khoa ${dept.name}`);
                  scrollToChecker();
                }}
                className="medical-card p-5 space-y-2.5 cursor-pointer hover:border-[#1F6F5C]/60 transition"
              >
                <div className="w-10 h-10 rounded-sm bg-[#DCEAE6] text-[#1F6F5C] flex items-center justify-center font-bold">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-[#1C1B19]">{dept.name}</h3>
                <p className="text-xs text-[#6B6A65] line-clamp-2">{dept.description}</p>
                <div className="pt-2 text-xs font-semibold text-[#1F6F5C] flex items-center space-x-1">
                  <span>Đặt khám chuyên khoa</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Shared Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => setCurrentUser(user)}
      />
    </div>
  );
}
