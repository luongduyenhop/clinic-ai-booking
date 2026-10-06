'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { Stethoscope, Sparkles, Calendar, CheckCircle, ShieldAlert, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

export default function HowItWorksPage() {
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  const faqs = [
    {
      question: 'AI Phân tích triệu chứng có độ chính xác như thế nào?',
      answer: 'Hệ thống AI dựa trên dữ liệu chuẩn y tế và bảng ánh xạ tri thức nội bộ được xây dựng cùng hội đồng y khoa. AI đạt tỷ lệ độ hài lòng trên 98% trong việc định hướng đúng chuyên khoa phòng khám. Tuy nhiên, kết quả AI chỉ mang tính chất tham khảo sơ bộ và hỗ trợ định hướng, không thay thế cho chẩn đoán y khoa chính thức từ bác sĩ.'
    },
    {
      question: 'Nếu AI phát hiện triệu chứng nguy hiểm/cấp cứu thì hệ thống xử lý ra sao?',
      answer: 'Nếu dữ liệu nhập vào chứa từ khóa nguy hiểm (đau ngực dữ dội, khó thở cấp, dấu hiệu đột quỵ...), hệ thống lập tức chuyển sang giao diện Cảnh báo Cấp cứu y tế màu đỏ gạch, ẩn nút đặt lịch thông thường và cung cấp hotline Cấp cứu 115 để người bệnh được hỗ trợ tức thì.'
    },
    {
      question: 'Khung giờ khám 30 phút hoạt động như thế nào?',
      answer: 'Mỗi ca khám của bác sĩ được chia thành các slot 30 phút cố định. Khi bạn chọn một khung giờ trống và đặt lịch thành công, khung giờ đó sẽ được giữ chỗ riêng cho bạn, giúp bạn chủ động thời gian mà không phải xếp hàng chờ đợi lâu.'
    },
    {
      question: 'Tôi có thể xem lại kết quả chẩn đoán và đơn thuốc ở đâu?',
      answer: 'Sau khi hoàn tất ca khám, bác sĩ sẽ ghi nhận chẩn đoán và đơn thuốc trực tiếp vào Hồ sơ bệnh án điện tử. Bạn chỉ cần đăng nhập tài khoản và vào mục "Lịch hẹn của tôi" để xem lại hoặc tải về bất cứ lúc nào.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F7F5F0]">
      <Navbar />

      <main className="max-w-[1080px] mx-auto px-4 lg:px-8 py-8 space-y-10 text-left">
        {/* Header */}
        <div className="space-y-2 border-b border-[#E4E1D8] pb-6">
          <div className="text-xs text-[#6B6A65] flex items-center space-x-1">
            <Link href="/" className="hover:text-[#1F6F5C]">Trang chủ</Link>
            <span>/</span>
            <span className="font-semibold text-[#1C1B19]">Hướng dẫn</span>
          </div>
          <h1 className="text-3xl font-bold text-[#1C1B19]">Hướng dẫn & Quy trình Đặt lịch Khám bệnh</h1>
          <p className="text-base text-[#6B6A65]">
            Tìm hiểu cách AI hỗ trợ phân tích triệu chứng và quy trình đặt lịch khám 30 phút nhanh chóng
          </p>
        </div>

        {/* 3 Steps Detailed Walkthrough */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-[#1C1B19]">Quy trình 3 bước khám bệnh thông minh</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="medical-card p-6 space-y-3">
              <div className="w-10 h-10 rounded-sm bg-[#1F6F5C] text-white font-bold flex items-center justify-center text-base">
                1
              </div>
              <h3 className="text-base font-semibold text-[#1C1B19]">1. Nhập mô tả triệu chứng</h3>
              <p className="text-sm text-[#6B6A65] leading-relaxed">
                Người bệnh nhập tự do bằng lời các biểu hiện khó chịu hoặc bấm chọn nhanh các tag triệu chứng có sẵn trên giao diện.
              </p>
            </div>

            <div className="medical-card p-6 space-y-3">
              <div className="w-10 h-10 rounded-sm bg-[#1F6F5C] text-white font-bold flex items-center justify-center text-base">
                2
              </div>
              <h3 className="text-base font-semibold text-[#1C1B19]">2. AI phân tích & đề xuất</h3>
              <p className="text-sm text-[#6B6A65] leading-relaxed">
                Công nghệ AI phân tích dữ liệu, chấm điểm tin cậy `confidence_score`, đưa ra lời giải thích y khoa tóm tắt và tự động lọc danh sách Bác sĩ chuyên khoa phù hợp.
              </p>
            </div>

            <div className="medical-card p-6 space-y-3">
              <div className="w-10 h-10 rounded-sm bg-[#1F6F5C] text-white font-bold flex items-center justify-center text-base">
                3
              </div>
              <h3 className="text-base font-semibold text-[#1C1B19]">3. Chọn bác sĩ & Đặt giờ khám</h3>
              <p className="text-sm text-[#6B6A65] leading-relaxed">
                Chọn bác sĩ tin tưởng, chọn slot 30 phút theo lịch rảnh và nhận ngay mã xác nhận đặt lịch khám.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Accordion Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[#1C1B19]">Câu hỏi thường gặp (FAQ)</h2>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="medical-card p-5 space-y-2">
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                    className="w-full flex items-center justify-between text-left font-semibold text-sm text-[#1C1B19] focus:outline-none"
                  >
                    <span>{faq.question}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-[#1F6F5C]" /> : <ChevronDown className="w-4 h-4 text-[#6B6A65]" />}
                  </button>
                  {isOpen && (
                    <p className="text-sm text-[#6B6A65] leading-relaxed pt-2 border-t border-[#E4E1D8]">
                      {faq.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA Banner */}
        <div className="bg-[#DCEAE6] border border-[#1F6F5C]/30 rounded-md p-8 text-center space-y-3">
          <h2 className="text-xl font-semibold text-[#1F6F5C]">Sẵn sàng trải nghiệm tư vấn và đặt lịch khám?</h2>
          <p className="text-sm text-[#1C1B19]">Bắt đầu phân tích triệu chứng cùng trí tuệ nhân tạo Y tế ngay hôm nay</p>
          <div className="pt-2">
            <Link href="/symptom-checker" className="btn-primary px-6 py-3 text-sm inline-block">
              Trải nghiệm AI Symptom Checker
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
