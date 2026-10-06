'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { Stethoscope, ShieldCheck, Sparkles, AlertTriangle, Users, Award, CheckCircle, ArrowRight, HeartPulse, Cpu, FileText } from 'lucide-react';

export default function AboutPage() {
  const advisoryBoard = [
    {
      name: 'GS.TS.BS Nguyễn Văn An',
      role: 'Chủ tịch Hội đồng Cố vấn Y khoa',
      specialty: 'Chuyên gia Tim mạch & Y tế Công cộng',
      bio: 'Nguyên Phó Giám đốc Bệnh viện Đại học Y, trên 35 năm kinh nghiệm chỉ đạo chuyên môn y tế lâm sàng và chuyển đổi số y tế.'
    },
    {
      name: 'PGS.TS.BS Trần Thu Hương',
      role: 'Cố vấn Chẩn đoán Lâm sàng & AI',
      specialty: 'Chuyên gia Nội khoa & Tiêu hóa',
      bio: 'Chủ nhiệm bộ môn Nội tổng hợp, trực tiếp thẩm định bộ quy tắc phân loại triệu chứng ban đầu (rule engine mapping).'
    },
    {
      name: 'TS.BS Lê Hoàng Long',
      role: 'Cố vấn An toàn & Cấp cứu Y tế',
      specialty: 'Chuyên gia Cấp cứu & Hồi sức tích cực',
      bio: 'Trưởng khoa Hồi sức cấp cứu, xây dựng thuật toán phát hiện từ khóa nguy cơ đột quỵ và nhồi máu cơ tim khẩn cấp.'
    }
  ];

  const coreValues = [
    {
      title: 'Minh bạch & Trung thực',
      desc: 'Độ tin cậy AI được hiển thị trung thực bằng chỉ số %. AI không thay thế bác sĩ mà đóng vai trò hỗ trợ phân loại ban đầu.',
      icon: ShieldCheck
    },
    {
      title: 'Cảnh báo Nguy hiểm ưu tiên số 1',
      desc: 'Các triệu chứng có từ khóa đe dọa tính mạng (đau ngực, khó thở, hôn mê) được chuyển ngay sang trạng thái Cấp cứu 115.',
      icon: AlertTriangle
    },
    {
      title: 'Tôn trọng Thời gian Bệnh nhân',
      desc: 'Mô hình đặt lịch 30 phút phân bổ chính xác giúp bệnh nhân giảm tối đa thời gian chờ đợi tại phòng khám.',
      icon: HeartPulse
    }
  ];

  return (
    <div className="min-h-screen bg-[#F7F5F0]">
      <Navbar />

      <main className="max-w-[1080px] mx-auto px-4 lg:px-8 py-8 space-y-12 text-left">
        {/* Header Breadcrumb & Title */}
        <div className="space-y-2 border-b border-[#E4E1D8] pb-6">
          <div className="text-xs text-[#6B6A65] flex items-center space-x-1">
            <Link href="/" className="hover:text-[#1F6F5C]">Trang chủ</Link>
            <span>/</span>
            <span className="font-semibold text-[#1C1B19]">Về chúng tôi</span>
          </div>
          <h1 className="text-3xl font-bold text-[#1C1B19]">Giới thiệu Hệ thống Y tế Thông minh</h1>
          <p className="text-base text-[#6B6A65]">
            Nền tảng tiên phong kết nối phân tích triệu chứng AI chuẩn xác với đội ngũ bác sĩ chuyên khoa hàng đầu
          </p>
        </div>

        {/* Mission Hero Section */}
        <div className="medical-card p-8 bg-[#FFFFFF] border border-[#E4E1D8] space-y-6">
          <div className="flex items-center space-x-3 text-[#1F6F5C]">
            <div className="w-10 h-10 rounded-sm bg-[#DCEAE6] flex items-center justify-center font-bold">
              <Stethoscope className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#1C1B19]">Sứ mệnh & Tầm nhìn của SmartCare</h2>
          </div>
          <p className="text-sm text-[#1C1B19] leading-relaxed">
            Hệ thống <strong>"Sức Khoẻ Thông Minh"</strong> được ra đời với mục tiêu giải quyết bài toán quá tải tại các cơ sở y tế và hỗ trợ người dân Việt Nam tiếp cận với dịch vụ chăm sóc sức khỏe ban đầu một cách nhanh chóng, minh bạch và khoa học nhất. Chúng tôi kết hợp sức mạnh của <strong>Trí tuệ nhân tạo (AI)</strong> trong phân loại triệu chứng sơ bộ với trải nghiệm <strong>đặt lịch khám 30 phút</strong> không chờ đợi.
          </p>
        </div>

        {/* AI Dual Engine Architecture Overview */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-[#1C1B19]">Công nghệ AI & Cơ chế Phân loại Y tế</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Engine 1 */}
            <div className="medical-card p-6 space-y-3">
              <div className="flex items-center space-x-2 text-[#1F6F5C]">
                <Cpu className="w-5 h-5" />
                <h3 className="font-semibold text-base text-[#1C1B19]">1. OpenAI GPT-4o-mini & Gemini AI</h3>
              </div>
              <p className="text-xs text-[#6B6A65] leading-relaxed">
                Sử dụng mô hình ngôn ngữ lớn (LLM) với cấu hình <strong>Structured Output (JSON Schema)</strong> khắt khe. Mô hình phân tích ngôn ngữ tự nhiên tiếng Việt từ bệnh nhân, trích xuất triệu chứng cốt lõi, đánh giá mức độ khẩn cấp và đưa ra độ tin cậy %.
              </p>
            </div>

            {/* Engine 2 */}
            <div className="medical-card p-6 space-y-3">
              <div className="flex items-center space-x-2 text-[#1F6F5C]">
                <FileText className="w-5 h-5" />
                <h3 className="font-semibold text-base text-[#1C1B19]">2. Bộ Quy tắc Y khoa Dự phòng (Rule Engine)</h3>
              </div>
              <p className="text-xs text-[#6B6A65] leading-relaxed">
                Khi máy chủ AI không khả dụng hoặc phản hồi chậm, hệ thống tự động kích hoạt bộ quy tắc nội bộ (Internal Symptom Mapping) đã được Hội đồng Cố vấn Y khoa duyệt nhằm đảm bảo kết quả đề xuất không bao giờ bị gián đoạn.
              </p>
            </div>
          </div>
        </div>

        {/* Core Design Principles */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-[#1C1B19]">Nguyên tắc Hoạt động Cốt lõi</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {coreValues.map((val, idx) => {
              const Icon = val.icon;
              return (
                <div key={idx} className="medical-card p-6 space-y-3">
                  <div className="w-10 h-10 rounded-sm bg-[#DCEAE6] text-[#1F6F5C] flex items-center justify-center font-bold">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-semibold text-[#1C1B19]">{val.title}</h3>
                  <p className="text-xs text-[#6B6A65] leading-relaxed">{val.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Medical Advisory Board */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-[#1C1B19]">Hội đồng Cố vấn Y khoa</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {advisoryBoard.map((member, idx) => (
              <div key={idx} className="medical-card p-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#DCEAE6] text-[#1F6F5C] font-bold text-sm flex items-center justify-center">
                  {member.name.split(' ').pop().slice(0, 1)}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1C1B19]">{member.name}</h3>
                  <span className="text-xs font-semibold text-[#1F6F5C] block">{member.role}</span>
                  <span className="text-[11px] text-[#6B6A65] block">{member.specialty}</span>
                </div>
                <p className="text-xs text-[#1C1B19] leading-relaxed pt-2 border-t border-[#E4E1D8]">
                  {member.bio}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action Banner */}
        <div className="medical-card p-8 bg-[#DCEAE6] border border-[#1F6F5C]/40 text-center space-y-4">
          <h2 className="text-xl font-bold text-[#1C1B19]">Trải nghiệm Chăm sóc Sức khỏe Thông minh</h2>
          <p className="text-xs text-[#1C1B19] max-w-xl mx-auto">
            Bắt đầu phân tích triệu chứng ban đầu với AI hoặc lựa chọn bác sĩ chuyên khoa để chủ động bảo vệ sức khỏe cho bản thân và gia đình.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/symptom-checker"
              className="btn-primary px-6 py-2.5 text-xs font-semibold flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Phân tích triệu chứng AI</span>
            </Link>
            <Link
              href="/doctors"
              className="btn-secondary px-6 py-2.5 text-xs font-semibold flex items-center space-x-2 bg-white"
            >
              <span>Xem danh sách bác sĩ</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
