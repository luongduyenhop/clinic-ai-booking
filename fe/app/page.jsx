'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SymptomCheckerBooking from '../components/SymptomCheckerBooking';
import {
  Stethoscope, Search, Calendar, Phone, CheckCircle, ShieldCheck,
  Star, ArrowRight, Award, Users, HeartPulse, Building2, Cpu,
  FileText, Activity, ChevronRight, Newspaper, MapPin, Check,
  Sparkles, Clock, Shield, UserCheck, Pill, ArrowUpRight
} from 'lucide-react';

export default function Home() {
  const [quickForm, setQuickForm] = useState({
    name: '',
    phone: '',
    branch: 'HN01',
    specialty: 'Tim mạch',
    symptoms: ''
  });
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleQuickFormSubmit = (e) => {
    e.preventDefault();
    if (!quickForm.name || !quickForm.phone) {
      alert('Vui lòng nhập đầy đủ Họ tên và Số điện thoại.');
      return;
    }
    setFormSubmitted(true);
  };

  const featuredDoctors = [
    {
      id: 1,
      name: 'PGS.TS.BS Phạm Hoàng Nam',
      title: 'Phó Giáo sư, Tiến sĩ, Bác sĩ',
      specialty: 'Tim mạch & Can thiệp mạch',
      exp: '22 năm kinh nghiệm',
      hospital: 'Bệnh viện Đa khoa Quốc tế SmartCare',
      rating: 4.9,
      reviews: 142,
      badge: 'Trưởng khoa Tim mạch'
    },
    {
      id: 2,
      name: 'ThS.BS Trần Thị Mai',
      title: 'Thạc sĩ, Bác sĩ',
      specialty: 'Da liễu & Thẩm mỹ lâm sàng',
      exp: '14 năm kinh nghiệm',
      hospital: 'SmartCare Cơ sở 2',
      rating: 4.85,
      reviews: 98,
      badge: 'Bác sĩ chuyên khoa'
    },
    {
      id: 3,
      name: 'BS.CKII Lê Văn Đức',
      title: 'Bác sĩ Chuyên khoa II',
      specialty: 'Nội tổng quát & Hô hấp',
      exp: '18 năm kinh nghiệm',
      hospital: 'Bệnh viện Đa khoa Quốc tế SmartCare',
      rating: 4.95,
      reviews: 215,
      badge: 'Phó Trưởng khoa Nội'
    },
    {
      id: 4,
      name: 'TS.BS Nguyễn Hải Yến',
      title: 'Tiến sĩ, Bác sĩ',
      specialty: 'Nhi khoa sơ sinh',
      exp: '16 năm kinh nghiệm',
      hospital: 'SmartCare Cơ sở 3',
      rating: 4.9,
      reviews: 164,
      badge: 'Chuyên gia Nhi khoa'
    }
  ];

  const patientJourneySteps = [
    {
      step: '01',
      title: 'Sàng lọc Triệu chứng & Đặt lịch',
      desc: 'Trí tuệ nhân tạo (AI Triage) đối soát triệu chứng y khoa, gợi ý chuyên khoa chính xác và cho phép chọn khung giờ 30 phút.',
      icon: Cpu,
      badge: 'AI + Web Booking'
    },
    {
      step: '02',
      title: 'Tiếp nhận Thông minh & Cấp STT',
      desc: 'Quầy lễ tân xác thực nhanh qua mã QR hoặc SĐT, tự động phân luồng theo 5 bậc ưu tiên Bahmni (P1 - P5), không chờ đợi.',
      icon: UserCheck,
      badge: 'Bahmni Triage Flow'
    },
    {
      step: '03',
      title: 'Thăm khám EMR & Cận lâm sàng',
      desc: 'Bác sĩ thao tác trên bàn khám OpenMRS O3, xem dải sinh hiệu tức thời, nhập ICD-10 và nhận kết quả cận lâm sàng số hóa.',
      icon: Stethoscope,
      badge: 'OpenMRS 3.x O3'
    },
    {
      step: '04',
      title: 'Đơn thuốc Số & Sổ Sức khỏe PHR',
      desc: 'Toàn bộ bệnh án được niêm phong chống sửa đổi (TT 32/2023). Bệnh nhân tra cứu đơn thuốc và kết quả xét nghiệm 24/7.',
      icon: FileText,
      badge: 'Personal Health Record'
    }
  ];

  const whyUsFeatures = [
    {
      title: 'Công nghệ AI Phân loại Y tế Kép',
      desc: 'Kết hợp mô hình LLM tiên tiến với bộ quy tắc y khoa chuẩn hóa (Rule Engine mapping) giúp gợi ý chuyên khoa chính xác cao.',
      icon: Cpu
    },
    {
      title: 'Đội ngũ Bác sĩ Trưởng khoa 15-25 Năm',
      desc: 'Quy tụ các Phó Giáo sư, Tiến sĩ, Bác sĩ Chuyên khoa II từ các bệnh viện tuyến trung ương hàng đầu.',
      icon: Users
    },
    {
      title: 'Cơ sở vật chất 5 Sao & Thiết bị 4.0',
      desc: 'Hệ thống chụp MRI 3.0 Tesla, CT 128 lát cắt, Siêu âm Doppler tim 4D và Hệ thống nội soi ống mềm chuẩn quốc tế.',
      icon: Building2
    },
    {
      title: 'Khám 30 Phút Đúng Giờ — Không Chờ Đợi',
      desc: 'Quy trình phân bổ khung giờ thông minh Model B ngăn ngừa trùng slot, tối ưu luồng bệnh nhân.',
      icon: CheckCircle
    }
  ];

  const equipmentGallery = [
    { name: 'Máy chụp cộng hưởng từ MRI 3.0 Tesla', desc: 'Chẩn đoán hình ảnh thần kinh, cột sống và tầm soát đột quỵ sớm.', icon: 'MRI' },
    { name: 'Máy chụp cắt lớp CT 128 lát cắt', desc: 'Dựng hình mạch máu tim và tổn thương phổi độ phân giải cao.', icon: 'CT' },
    { name: 'Hệ thống Siêu âm Tim Doppler màu 4D', desc: 'Đánh giá chức năng cơ tim, hở van tim và lưu lượng dòng máu.', icon: 'US' },
    { name: 'Hệ thống Nội soi Tai Mũi Họng ống mềm', desc: 'Chẩn đoán không đau, phát hiện sớm polyp và tổn thương vòm họng.', icon: 'ENT' }
  ];

  const pressPartners = [
    { name: 'Đài Truyền hình Việt Nam (VTV)', badge: 'VTV1 / VTV3' },
    { name: 'Báo Điện tử VNExpress', badge: 'VNExpress Health' },
    { name: 'Báo Tuổi Trẻ', badge: 'Tuổi Trẻ Y Tế' },
    { name: 'Báo Dân Trí', badge: 'Dân Trí Tiêu Điểm' }
  ];

  return (
    <div className="min-h-screen bg-[#F7F5F0]">
      <Navbar />

      {/* ============================================================ */}
      {/* 1. HERO SECTION: SMARTCARE HOSPITAL PLATFORM */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#1C1B19] via-[#1F2C27] to-[#1C1B19] text-[#F7F5F0] pt-12 pb-20 border-b border-gray-800">
        {/* Subtle background glow effect */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#1F6F5C_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        <div className="max-w-[1120px] mx-auto px-4 lg:px-8 relative z-10 space-y-8 text-center sm:text-left">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Hero Text */}
            <div className="lg:col-span-8 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1F6F5C]/20 border border-[#1F6F5C]/40 text-[#DCEAE6] text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-[#E8A33D] animate-spin" />
                <span>Nền Tảng Bệnh Viện Thông Minh & Bệnh Án Điện Tử Thế Hệ Mới</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#F7F5F0] leading-tight tracking-tight">
                Chăm Sóc Y Tế Chuẩn Mực <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5BB9A4] via-[#DCEAE6] to-[#E8A33D]">
                  Không Chờ Đợi • Chuẩn Xác • Minh Bạch
                </span>
              </h1>

              <p className="text-sm sm:text-base text-gray-300 max-w-2xl leading-relaxed">
                Ứng dụng mô hình lâm sàng đối soát <strong>OpenMRS 3.x O3</strong> và điều phối <strong>Bahmni</strong>. 
                Tư vấn triệu chứng AI 24/7, đặt khám chuyên khoa 30 phút, đồng bộ kết quả cận lâm sàng và bảo vệ dữ liệu y bạ cá nhân theo <strong>Thông tư 32/2023/TT-BYT</strong>.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2 justify-center sm:justify-start">
                <a
                  href="#symptom-booking-section"
                  className="px-6 py-3 rounded-lg bg-[#1F6F5C] hover:bg-[#185849] text-white font-bold text-sm shadow-lg flex items-center gap-2 transition"
                >
                  <Cpu className="w-4 h-4 text-[#E8A33D]" />
                  <span>Tư vấn AI & Đặt khám ngay</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <Link
                  href="/patient/dashboard"
                  className="px-5 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-[#F7F5F0] border border-white/20 font-semibold text-sm flex items-center gap-2 transition"
                >
                  <FileText className="w-4 h-4 text-[#5BB9A4]" />
                  <span>Sổ Sức Khỏe Điện Tử (PHR)</span>
                </Link>

                <a
                  href="tel:19001115"
                  className="px-4 py-3 rounded-lg text-rose-300 hover:text-white hover:bg-rose-900/30 text-sm font-semibold flex items-center gap-1.5 transition"
                >
                  <Phone className="w-4 h-4 text-rose-400" />
                  <span>Hotline: 1900 1115</span>
                </a>
              </div>
            </div>

            {/* Right Hero Badge / Mini Dashboard Highlight */}
            <div className="lg:col-span-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur space-y-4 text-left shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs font-bold text-[#E8A33D] flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-[#5BB9A4]" />
                  <span>TRUNG TÂM ĐIỀU PHỐI THỜI GIAN THỰC</span>
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center bg-white/5 p-2.5 rounded-lg border border-white/5">
                  <span className="text-gray-400">Thời gian khám trung bình:</span>
                  <span className="font-bold text-white font-mono">30 phút / slot</span>
                </div>
                <div className="flex justify-between items-center bg-white/5 p-2.5 rounded-lg border border-white/5">
                  <span className="text-gray-400">Tỷ lệ đúng hẹn:</span>
                  <span className="font-bold text-emerald-400 font-mono">98.6%</span>
                </div>
                <div className="flex justify-between items-center bg-white/5 p-2.5 rounded-lg border border-white/5">
                  <span className="text-gray-400">Khóa niêm phong bệnh án:</span>
                  <span className="font-bold text-[#E8A33D] font-mono">100% (TT 32 EMR)</span>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-gray-400 italic text-center">
                “Bệnh án số hóa vĩnh viễn, truy cập mọi lúc trên thiết bị cá nhân”
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 2. FLOATING QUICK ACTION CARDS (4 TRỤ CỘT DỊCH VỤ CỐT LÕI) */}
      {/* ============================================================ */}
      <section className="relative -mt-10 z-20 max-w-[1120px] mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: AI Symptom Checker */}
          <a
            href="#symptom-booking-section"
            className="group bg-white p-5 rounded-xl border border-[#E4E1D8] shadow-md hover:shadow-xl hover:border-[#1F6F5C] transition space-y-2 text-left block"
          >
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-lg bg-[#DCEAE6] text-[#1F6F5C] flex items-center justify-center font-bold group-hover:scale-105 transition">
                <Cpu className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                24/7 AI
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#1C1B19] group-hover:text-[#1F6F5C] transition flex items-center justify-between">
              <span>Sàng Lọc Triệu Chứng AI</span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-1 transition" />
            </h3>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Mô tả triệu chứng, AI gợi ý 1-2 chuyên khoa phù hợp với độ tin cậy và giải thích y khoa.
            </p>
          </a>

          {/* Card 2: Book Doctor Appointment */}
          <a
            href="#symptom-booking-section"
            className="group bg-white p-5 rounded-xl border border-[#E4E1D8] shadow-md hover:shadow-xl hover:border-[#1F6F5C] transition space-y-2 text-left block"
          >
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-lg bg-[#FBEACB] text-[#B45309] flex items-center justify-center font-bold group-hover:scale-105 transition">
                <Calendar className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Slot 30 Phút
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#1C1B19] group-hover:text-[#1F6F5C] transition flex items-center justify-between">
              <span>Đặt Khám Chuyên Khoa</span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-1 transition" />
            </h3>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Chọn bác sĩ, ngày và khung giờ khám chính xác. Khóa lịch tức thì bằng partial unique constraint.
            </p>
          </a>

          {/* Card 3: Patient Portal / MyChart */}
          <Link
            href="/patient/dashboard"
            className="group bg-white p-5 rounded-xl border border-[#E4E1D8] shadow-md hover:shadow-xl hover:border-[#1F6F5C] transition space-y-2 text-left block"
          >
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-lg bg-[#E0E7FF] text-[#4338CA] flex items-center justify-center font-bold group-hover:scale-105 transition">
                <FileText className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                MyChart PHR
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#1C1B19] group-hover:text-[#1F6F5C] transition flex items-center justify-between">
              <span>Sổ Sức Khỏe Điện Tử</span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-1 transition" />
            </h3>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Theo dõi thẻ y tế QR, lịch sử khám bệnh, phiếu kết quả cận lâm sàng và đơn thuốc dạng vỉ trực quan.
            </p>
          </Link>

          {/* Card 4: Emergency Hotline */}
          <a
            href="tel:19001115"
            className="group bg-white p-5 rounded-xl border border-[#E4E1D8] shadow-md hover:shadow-xl hover:border-rose-400 transition space-y-2 text-left block"
          >
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold group-hover:scale-105 transition">
                <Phone className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                Khẩn Cấp 115
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#1C1B19] group-hover:text-rose-600 transition flex items-center justify-between">
              <span>Cấp Cứu & Hỗ Trợ 24/7</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </h3>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Đường dây nóng cấp cứu y tế và đội xe chuyển viện SmartCare túc trực liên tục ngày đêm.
            </p>
          </a>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. LIVE CLINIC METRICS COUNTER BAR */}
      {/* ============================================================ */}
      <section className="mt-12 py-8 bg-[#FFFFFF] border-y border-[#E4E1D8]">
        <div className="max-w-[1120px] mx-auto px-4 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1 border-r border-[#E4E1D8] last:border-r-0">
            <span className="text-3xl font-extrabold text-[#1F6F5C] block">04</span>
            <span className="text-xs text-[#6B6A65] font-semibold">Cơ sở Bệnh viện & Phòng khám</span>
          </div>
          <div className="space-y-1 border-r border-[#E4E1D8] last:border-r-0">
            <span className="text-3xl font-extrabold text-[#E8A33D] block">1.000+</span>
            <span className="text-xs text-[#6B6A65] font-semibold">Giường bệnh tiêu chuẩn quốc tế</span>
          </div>
          <div className="space-y-1 border-r border-[#E4E1D8] last:border-r-0">
            <span className="text-3xl font-extrabold text-[#1F6F5C] block">200+</span>
            <span className="text-xs text-[#6B6A65] font-semibold">Phó Giáo sư, Bác sĩ Trưởng khoa</span>
          </div>
          <div className="space-y-1">
            <span className="text-3xl font-extrabold text-[#2F8F5B] block">99.4%</span>
            <span className="text-xs text-[#6B6A65] font-semibold">Chỉ số hài lòng của người bệnh</span>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 4. VISUAL PATIENT JOURNEY: QUY TRÌNH KHÁM BỆNH 4 BƯỚC */}
      {/* ============================================================ */}
      <section className="py-14 bg-[#F7F5F0]">
        <div className="max-w-[1120px] mx-auto px-4 lg:px-8 space-y-10 text-left">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="px-3 py-1 rounded-full bg-[#DCEAE6] text-[#1F6F5C] text-xs font-bold uppercase tracking-wider">
              TRẢI NGHIỆM LIỀN MẠCH
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1B19]">
              Hành Trình Khám Chữa Bệnh Thông Minh 4 Bước
            </h2>
            <p className="text-xs sm:text-sm text-[#6B6A65]">
              Tối ưu hóa toàn diện từ trước khi đến viện cho tới khi hoàn thành đợt điều trị ngoại trú
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {patientJourneySteps.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="bg-white border border-[#E4E1D8] rounded-xl p-6 space-y-4 hover:border-[#1F6F5C] hover:shadow-md transition relative text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black font-mono text-[#1F6F5C]/40">
                      {item.step}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F7F5F0] text-[#1F6F5C] border border-[#E4E1D8]">
                      {item.badge}
                    </span>
                  </div>

                  <div className="w-10 h-10 rounded-lg bg-[#DCEAE6] text-[#1F6F5C] flex items-center justify-center font-bold">
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-[#1C1B19] leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[#6B6A65] leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. CORE AI SYMPTOM CHECKER & BOOKING INTEGRATION */}
      {/* ============================================================ */}
      <section id="symptom-booking-section" className="py-10 bg-white border-y border-[#E4E1D8]">
        <div className="max-w-[1120px] mx-auto px-4 lg:px-8 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="px-3 py-1 rounded-full bg-[#FBEACB] text-[#B45309] text-xs font-bold uppercase tracking-wider">
              CÔNG NGHỆ LÂM SÀNG SỐ
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1B19]">
              Sàng Lọc Triệu Chứng AI & Đặt Lịch Khám Chuyên Khoa
            </h2>
            <p className="text-xs sm:text-sm text-[#6B6A65]">
              Chọn hình thức sàng lọc AI hoặc đặt hẹn trực tiếp với các Bác sĩ Trưởng khoa
            </p>
          </div>

          <SymptomCheckerBooking initialTab="checker" hideLandingSections={true} />
        </div>
      </section>

      {/* ============================================================ */}
      {/* 6. SPECIALIST DOCTORS SHOWCASE (CHUYÊN GIA BÁC SĨ TIÊU BIỂU) */}
      {/* ============================================================ */}
      <section className="py-14 bg-[#F7F5F0]">
        <div className="max-w-[1120px] mx-auto px-4 lg:px-8 space-y-8 text-left">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-[#E4E1D8] pb-4 gap-2">
            <div>
              <span className="text-xs font-bold text-[#1F6F5C] uppercase tracking-wider block mb-1">
                ĐỘI NGŨ CHUYÊN GIA
              </span>
              <h2 className="text-2xl font-bold text-[#1C1B19]">Bác Sĩ Chuyên Khoa Tiêu Biểu</h2>
              <p className="text-xs text-[#6B6A65]">Các chuyên gia giàu kinh nghiệm điều trị và tận tâm chăm sóc</p>
            </div>
            <Link href="/doctors" className="text-xs font-semibold text-[#1F6F5C] flex items-center space-x-1 hover:underline">
              <span>Xem toàn bộ 200+ bác sĩ</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredDoctors.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border border-[#E4E1D8] rounded-xl p-5 space-y-3.5 shadow-subtle hover:border-[#1F6F5C] hover:shadow-lg transition flex flex-col justify-between text-left"
              >
                <div className="space-y-3">
                  {/* Doctor Avatar Badge */}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#1F6F5C] to-[#2E8A73] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                      {doc.name.split(' ').slice(-2).map(w => w[0]).join('')}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 block w-fit mb-1">
                        {doc.badge}
                      </span>
                      <h3 className="text-sm font-bold text-[#1C1B19] truncate">{doc.name}</h3>
                      <p className="text-[11px] text-[#6B6A65] truncate">{doc.title}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-[#6B6A65] pt-1 border-t border-[#E4E1D8]/60">
                    <p className="font-semibold text-[#1F6F5C]">{doc.specialty}</p>
                    <p>{doc.exp}</p>
                    <div className="flex items-center gap-1.5 text-amber-600 font-semibold text-[11px]">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>{doc.rating} ({doc.reviews} lượt khám)</span>
                    </div>
                  </div>
                </div>

                <a
                  href="#symptom-booking-section"
                  className="w-full py-2 bg-[#F7F5F0] hover:bg-[#1F6F5C] text-[#1F6F5C] hover:text-white border border-[#E4E1D8] hover:border-[#1F6F5C] rounded-lg text-xs font-semibold text-center transition flex items-center justify-center gap-1"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Đặt khám 30 phút</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 7. MODERN FACILITIES & DIAGNOSTIC EQUIPMENT GALLERY */}
      {/* ============================================================ */}
      <section className="py-12 bg-[#FFFFFF] border-y border-[#E4E1D8]">
        <div className="max-w-[1120px] mx-auto px-4 lg:px-8 space-y-8 text-left">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-[#E4E1D8] pb-4 gap-2">
            <div>
              <h2 className="text-2xl font-bold text-[#1C1B19]">Cơ sở vật chất & Trang thiết bị hiện đại</h2>
              <p className="text-xs text-[#6B6A65]">Hệ thống máy móc chẩn đoán hình ảnh thế hệ mới chuẩn Châu Âu</p>
            </div>
            <Link href="/about" className="text-xs font-semibold text-[#1F6F5C] flex items-center space-x-1 hover:underline">
              <span>Khám phá cơ sở vật chất</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {equipmentGallery.map((item, idx) => (
              <div key={idx} className="bg-[#F7F5F0] border border-[#E4E1D8] rounded-xl p-5 space-y-3">
                <div className="w-12 h-12 rounded-lg bg-white border border-[#E4E1D8] text-[#1F6F5C] font-mono font-bold flex items-center justify-center text-sm shadow-xs">
                  {item.icon}
                </div>
                <h3 className="text-sm font-bold text-[#1C1B19]">{item.name}</h3>
                <p className="text-xs text-[#6B6A65] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 8. MEDIA & PRESS PARTNERS SECTION */}
      {/* ============================================================ */}
      <section className="py-8 bg-[#F7F5F0] text-left">
        <div className="max-w-[1120px] mx-auto px-4 lg:px-8 space-y-4">
          <h2 className="text-xs font-bold text-[#6B6A65] uppercase tracking-wider text-center">
            Báo chí & Truyền thông đưa tin về SmartCare Hospital Platform
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {pressPartners.map((p, idx) => (
              <div key={idx} className="bg-white p-3 rounded-lg border border-[#E4E1D8] text-xs font-semibold text-[#1C1B19] shadow-xs">
                {p.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
