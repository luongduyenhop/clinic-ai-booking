'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { Stethoscope, CheckCircle, ArrowRight, ShieldCheck, HeartPulse, Sparkles, Calendar, Search } from 'lucide-react';

export default function PackagesPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const medicalPackages = [
    {
      id: 1,
      name: 'Gói Khám Sức Khỏe Tổng Quát Cơ Bản',
      category: 'Tổng quát',
      price: 1800000,
      old_price: 2200000,
      description: 'Đánh giá chỉ số sinh hiệu, công thức máu, đường huyết, mỡ máu, chức năng gan thận, điện tâm đồ ECG và siêu âm ổ bụng.',
      features: ['Khám lâm sàng Nội tổng quát', 'Xét nghiệm công thức máu 24 chỉ số', 'Xét nghiệm đường huyết & Mỡ máu', 'Siêu âm ổ bụng tổng quát', 'Đo điện tâm đồ (ECG 12 chuyển đạo)']
    },
    {
      id: 2,
      name: 'Gói Tầm Soát Bệnh Lý Tim Mạch Chuyên Sâu',
      category: 'Tim mạch',
      price: 3500000,
      old_price: 4200000,
      description: 'Dành cho người có tiền sử tăng huyết áp, đau ngực, mỡ máu cao. Bao gồm Siêu âm tim Doppler màu 4D và Holter 24h.',
      features: ['Khám với PGS.TS/BS Chuyên khoa Tim mạch', 'Siêu âm tim Doppler màu 4D thế hệ mới', 'Đo Holter điện tâm đồ 24h', 'Xét nghiệm sinh hóa tim & Enzym cơ tim', 'Tư vấn chế độ ăn & Kế hoạch tập luyện']
    },
    {
      id: 3,
      name: 'Gói Tầm Soát Ung Thư Toàn Thân Nữ / Nam',
      category: 'Tầm soát ung thư',
      price: 5200000,
      old_price: 6500000,
      description: 'Tầm soát sớm các dấu ấn ung thư phổ biến (Phổi, Gan, Đại trực tràng, Vú/Tuyến tiền liệt) kết hợp chẩn đoán hình ảnh.',
      features: ['Khám tư vấn Ung bướu chuyên sâu', 'Xét nghiệm dấu ấn ung thư (CEA, AFP, CA 125, PSA)', 'Chụp X-quang ngực thẳng kỹ thuật số', 'Siêu âm vú/tuyến tiền liệt & tuyến giáp', 'Nội soi tiêu hóa ống mềm không đau']
    },
    {
      id: 4,
      name: 'Gói Chăm Sóc Sức Khỏe Thai Sản Trọn Gói',
      category: 'Sản phụ khoa',
      price: 8900000,
      old_price: 10500000,
      description: 'Theo dõi thai kỳ toàn diện từ tuần 12 đến khi sinh, bao gồm xét nghiệm NIPT, siêu âm hình thái 5D và tiêm vắc xin.',
      features: ['Khám thai định kỳ 10 lượt với Bác sĩ CKI/CKII', 'Siêu âm hình thái thai nhi 5D', 'Xét nghiệm sàng lọc trước sinh NIPT', 'Xét nghiệm tiểu đường thai kỳ', 'Hỗ trợ hotline tư vấn 24/7']
    },
    {
      id: 5,
      name: 'Gói Tiêm Chủng Trọn Gói Cho Trẻ Sơ Sinh',
      category: 'Nhi khoa',
      price: 6800000,
      old_price: 7800000,
      description: 'Đầy đủ các mũi tiêm phòng 6 trong 1, Phế cầu, Rota vi rút, Cúm, Sởi-Quai bị-Rubella theo chuẩn Bộ Y Tế.',
      features: ['Khám sàng lọc trước tiêm với Bác sĩ Nhi khoa', 'Vắc xin nhập khẩu chính hãng bảo quản chuẩn GSP', 'Nhắc lịch tiêm tự động qua SMS/App', 'Theo dõi sau tiêm tại phòng chăm sóc 5 sao']
    },
    {
      id: 6,
      name: 'Gói Khám & Nội Soi Tai Mũi Họng Ống Mềm',
      category: 'Tai Mũi Họng',
      price: 950000,
      old_price: 1200000,
      description: 'Nội soi tai mũi họng bằng thiết bị ống mềm độ phân giải cao, không đau, tầm soát viêm xoang, polyp và ung thư vòm họng.',
      features: ['Nội soi Tai Mũi Họng ống mềm độ nét cao', 'Khám lâm sàng với Bác sĩ chuyên khoa', 'Xem hình ảnh nội soi trực tiếp trên màn hình', 'Rửa xoang / làm sạch tai tại chỗ nếu có chỉ định']
    }
  ];

  const filteredPackages = medicalPackages.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F7F5F0]">
      <Navbar />

      <main className="max-w-[1080px] mx-auto px-4 lg:px-8 py-8 space-y-8 text-left">
        {/* Breadcrumb & Header */}
        <div className="space-y-2 border-b border-[#E4E1D8] pb-6">
          <div className="text-xs text-[#6B6A65] flex items-center space-x-1">
            <Link href="/" className="hover:text-[#1F6F5C]">Trang chủ</Link>
            <span>/</span>
            <span className="font-semibold text-[#1C1B19]">Gói dịch vụ y tế</span>
          </div>
          <h1 className="text-3xl font-bold text-[#1C1B19]">Gói Dịch Vụ Khám Sức Khỏe Trọn Gói</h1>
          <p className="text-base text-[#6B6A65]">
            Giải pháp tầm soát sức khỏe chủ động toàn diện với chi phí ưu đãi và quy trình khám ưu tiên không chờ đợi
          </p>
        </div>

        {/* Search Bar Input */}
        <div className="medical-card p-4 flex items-center space-x-3">
          <Search className="w-5 h-5 text-[#6B6A65]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên gói dịch vụ (ví dụ: Tổng quát, Tim mạch, Ung thư, Thai sản, Tiêm chủng...)"
            className="w-full bg-transparent border-none text-sm text-[#1C1B19] focus:outline-none placeholder-[#9CA3AF]"
          />
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPackages.map((pkg) => (
            <div key={pkg.id} className="medical-card p-6 space-y-4 flex flex-col justify-between hover:border-[#1F6F5C] transition">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-sm text-xs font-semibold bg-[#DCEAE6] text-[#1F6F5C]">
                    {pkg.category}
                  </span>
                  <div className="text-right">
                    <span className="text-xs text-[#6B6A65] line-through mr-2">{pkg.old_price.toLocaleString('vi-VN')} đ</span>
                    <span className="text-lg font-bold text-[#1F6F5C]">{pkg.price.toLocaleString('vi-VN')} đ</span>
                  </div>
                </div>

                <h2 className="text-lg font-bold text-[#1C1B19]">{pkg.name}</h2>
                <p className="text-xs text-[#6B6A65] leading-relaxed">{pkg.description}</p>

                <div className="space-y-1.5 pt-2 border-t border-[#E4E1D8]">
                  <span className="text-xs font-semibold text-[#1C1B19]">Danh mục dịch vụ bao gồm:</span>
                  <ul className="space-y-1 text-xs text-[#1C1B19]">
                    {pkg.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start space-x-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-[#1F6F5C] flex-shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E4E1D8] flex items-center justify-between">
                <span className="text-xs text-[#6B6A65] flex items-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#1F6F5C] mr-1" />
                  Ưu tiên không chờ đợi
                </span>

                <Link
                  href="/symptom-checker"
                  className="btn-primary px-4 py-2 text-xs font-semibold flex items-center space-x-1"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Đăng ký gói khám</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
