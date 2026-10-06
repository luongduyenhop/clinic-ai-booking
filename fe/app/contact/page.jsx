'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { Phone, MapPin, Mail, Clock, ShieldAlert, AlertCircle, CheckCircle, Send, Stethoscope } from 'lucide-react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    subject: 'Hỗ trợ đặt lịch',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const clinicLocations = [
    {
      city: 'Hà Nội (Trụ sở chính)',
      address: 'Số 88 Phố Y Tế, Phường Đống Đa, Quận Đống Đa, Hà Nội',
      phone: '024 3988 1234',
      hours: '07:30 - 20:00 (Thứ 2 - Chủ Nhật)'
    },
    {
      city: 'TP. Hồ Chí Minh',
      address: 'Số 150 Đường Nguyễn Thị Minh Khai, Quận 3, TP. Hồ Chí Minh',
      phone: '028 3822 5678',
      hours: '07:30 - 20:00 (Thứ 2 - Chủ Nhật)'
    },
    {
      city: 'Đà Nẵng',
      address: 'Số 42 Đường Điện Biên Phủ, Quận Thanh Khê, Đà Nẵng',
      phone: '0236 3755 999',
      hours: '08:00 - 17:30 (Thứ 2 - Thứ 7)'
    }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.message) {
      setErrorMsg('Vui lòng nhập đầy đủ Họ tên, Số điện thoại và Nội dung thắc mắc.');
      return;
    }
    setErrorMsg('');
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0]">
      <Navbar />

      <main className="max-w-[1080px] mx-auto px-4 lg:px-8 py-8 space-y-8 text-left">
        {/* Breadcrumb Header */}
        <div className="space-y-2 border-b border-[#E4E1D8] pb-6">
          <div className="text-xs text-[#6B6A65] flex items-center space-x-1">
            <Link href="/" className="hover:text-[#1F6F5C]">Trang chủ</Link>
            <span>/</span>
            <span className="font-semibold text-[#1C1B19]">Liên hệ & Cấp cứu</span>
          </div>
          <h1 className="text-3xl font-bold text-[#1C1B19]">Liên hệ & Hỗ trợ Y tế</h1>
          <p className="text-base text-[#6B6A65]">
            Trung tâm chăm sóc khách hàng và tiếp nhận phản hồi thông tin y tế 24/7
          </p>
        </div>

        {/* 🚨 STRICT DESIGN.MD EMERGENCY 115 BANNER 🚨 */}
        <div className="p-6 bg-[#F6DEDC] border-2 border-[#C1443C] rounded-sm space-y-3">
          <div className="flex items-center space-x-3 text-[#C1443C]">
            <ShieldAlert className="w-7 h-7 flex-shrink-0" />
            <h2 className="text-xl font-bold">CẢNH BÁO Y TẾ KHẨN CẤP (115)</h2>
          </div>
          <p className="text-sm font-semibold text-[#1C1B19] leading-relaxed">
            Nếu bạn hoặc ai đó xung quanh có các triệu chứng nguy hiểm tính mạng như: <strong>Đau ngực dữ dội kéo dài, đột ngột khó thở, hôn mê, yếu liệt nửa người, hoặc co giật</strong> — KHÔNG ĐẶT LỊCH HẸN KHÁM THÔNG THƯỜNG.
          </p>
          <div className="pt-2 flex items-center space-x-4">
            <a
              href="tel:115"
              className="inline-flex items-center space-x-2 bg-[#C1443C] text-white px-5 py-2.5 rounded-sm font-bold text-sm hover:bg-[#a83831] transition"
            >
              <Phone className="w-4 h-4" />
              <span>GỌI CẤP CỨU 115 NGAY LẬP TỨC</span>
            </a>
          </div>
        </div>

        {/* Grid: Contact Form & Locations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Inquiry Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="medical-card p-6 space-y-5">
              <div className="border-b border-[#E4E1D8] pb-3">
                <h2 className="text-lg font-bold text-[#1C1B19] flex items-center space-x-2">
                  <Mail className="w-5 h-5 text-[#1F6F5C]" />
                  <span>Gửi thắc mắc hoặc Ý kiến phản hồi</span>
                </h2>
                <p className="text-xs text-[#6B6A65] mt-1">
                  Bộ phận CSKH sẽ liên hệ lại trong vòng 30 phút làm việc
                </p>
              </div>

              {submitted ? (
                <div className="bg-[#DCEAE6] border border-[#1F6F5C] p-6 rounded-sm text-center space-y-3">
                  <CheckCircle className="w-8 h-8 text-[#1F6F5C] mx-auto" />
                  <h3 className="text-base font-bold text-[#1C1B19]">Gửi thông tin thành công!</h3>
                  <p className="text-xs text-[#1C1B19]">
                    Cảm ơn bạn đã gửi ý kiến. Nhân viên tư vấn sẽ gọi cho bạn qua số điện thoại <strong>{formData.phone}</strong> sớm nhất.
                  </p>
                  <button
                    onClick={() => { setSubmitted(false); setFormData({ name: '', phone: '', email: '', subject: 'Hỗ trợ đặt lịch', message: '' }); }}
                    className="btn-secondary px-4 py-2 text-xs"
                  >
                    Gửi câu hỏi khác
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {errorMsg && (
                    <div className="bg-[#FBEACB] border border-[#B45309] text-[#B45309] p-3 rounded-sm text-xs flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1C1B19]">Họ và tên *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Nguyễn Văn A..."
                        className="w-full bg-[#F7F5F0] border border-[#E4E1D8] rounded-sm p-2 text-xs text-[#1C1B19] focus:outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1C1B19]">Số điện thoại *</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="0912..."
                        className="w-full bg-[#F7F5F0] border border-[#E4E1D8] rounded-sm p-2 text-xs text-[#1C1B19] focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1C1B19]">Địa chỉ Email (tùy chọn)</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="example@gmail.com"
                        className="w-full bg-[#F7F5F0] border border-[#E4E1D8] rounded-sm p-2 text-xs text-[#1C1B19] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1C1B19]">Chủ đề hỗ trợ</label>
                      <select
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="w-full bg-[#F7F5F0] border border-[#E4E1D8] rounded-sm p-2 text-xs text-[#1C1B19] focus:outline-none"
                      >
                        <option value="Hỗ trợ đặt lịch">Hỗ trợ đặt lịch khám</option>
                        <option value="Thắc mắc phân tích AI">Thắc mắc về kết quả AI</option>
                        <option value="Đóng góp ý kiến">Đóng góp ý kiến chất lượng</option>
                        <option value="Hợp tác chuyên môn">Hợp tác chuyên môn bác sĩ</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1C1B19]">Nội dung chi tiết *</label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Mô tả nội dung cần hỗ trợ..."
                      rows={4}
                      className="w-full bg-[#F7F5F0] border border-[#E4E1D8] rounded-sm p-2 text-xs text-[#1C1B19] focus:outline-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-primary px-6 py-2.5 text-xs font-semibold flex items-center space-x-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi tin nhắn hỗ trợ</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Clinic Addresses & Operating Hours */}
          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[#1C1B19]">Hệ thống Cơ sở Y tế</h2>
              {clinicLocations.map((loc, idx) => (
                <div key={idx} className="medical-card p-5 space-y-2">
                  <h3 className="font-semibold text-sm text-[#1F6F5C]">{loc.city}</h3>
                  <p className="text-xs text-[#1C1B19] flex items-start space-x-1.5">
                    <MapPin className="w-4 h-4 text-[#6B6A65] flex-shrink-0 mt-0.5" />
                    <span>{loc.address}</span>
                  </p>
                  <p className="text-xs text-[#6B6A65] flex items-center space-x-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#6B6A65]" />
                    <span>{loc.phone}</span>
                  </p>
                  <p className="text-xs text-[#6B6A65] flex items-center space-x-1.5 pt-1 border-t border-[#E4E1D8]">
                    <Clock className="w-3.5 h-3.5 text-[#1F6F5C]" />
                    <span>{loc.hours}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
