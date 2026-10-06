'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { Newspaper, Calendar, User, ChevronRight, Search, Sparkles, HeartPulse, ShieldCheck } from 'lucide-react';

export default function NewsPage() {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const articles = [
    {
      id: 1,
      title: 'Nhận biết 5 dấu hiệu cảnh báo đau ngực cần khám tim mạch ngay lập tức',
      category: 'Tim mạch',
      date: '22/09/2026',
      author: 'PGS.TS.BS Phạm Hoàng Nam',
      excerpt: 'Cơn đau thắt ngực lan ra vai trái, kèm vã mồ hôi hột và khó thở là dấu hiệu cảnh báo thiếu máu cơ tim cấp. Đọc ngay hướng dẫn xử trí từ chuyên gia tim mạch.',
      image_alt: 'Bác sĩ kiểm tra điện tâm đồ tim mạch'
    },
    {
      id: 2,
      title: 'Ứng dụng Trí tuệ nhân tạo (AI) trong phân loại triệu chứng y tế ban đầu',
      category: 'Công nghệ Y tế',
      date: '18/09/2026',
      author: 'Hội đồng Cố vấn Y khoa SmartCare',
      excerpt: 'Tìm hiểu cơ chế kết hợp giữa mô hình ngôn ngữ lớn LLM và bộ quy tắc y khoa chuẩn hóa (Rule Engine) giúp phân loại triệu chứng chính xác 98%.',
      image_alt: 'Trí tuệ nhân tạo y tế AI'
    },
    {
      id: 3,
      title: 'Bệnh viêm xoang cấp mùa mưa: Nguyên nhân, triệu chứng và cách điều trị tận gốc',
      category: 'Tai Mũi Họng',
      date: '15/09/2026',
      author: 'BS.CKI Đặng Thu Hà',
      excerpt: 'Thời tiết giao mùa khiến tỷ lệ viêm xoang cấp tăng cao. Kỹ thuật nội soi ống mềm giúp chẩn đoán chính xác và làm sạch xoang nhẹ nhàng không đau.',
      image_alt: 'Nội soi tai mũi họng'
    },
    {
      id: 4,
      title: 'Bí quyết chăm sóc da mề đay mãn tính và dị ứng thời tiết cho người lớn',
      category: 'Da liễu',
      date: '10/09/2026',
      author: 'ThS.BS Trần Thị Mai',
      excerpt: 'Mề đay tái phát nhiều lần làm ảnh hưởng nghiêm trọng tới chất lượng cuộc sống. Tìm hiểu phương pháp xét nghiệm dị nguyên và phác đồ điều trị tận gốc.',
      image_alt: 'Chăm sóc da liễu'
    },
    {
      id: 5,
      title: 'Tầm quan trọng của khám sức khỏe tổng quát định kỳ 6 tháng/lần',
      category: 'Y học thường thức',
      date: '05/09/2026',
      author: 'BS.CKII Lê Văn Đức',
      excerpt: 'Nhiều bệnh lý mãn tính như đái tháo đường, mỡ máu cao, xơ vữa động mạch diễn tiến âm thầm. Khám định kỳ giúp phát hiện và điều trị kịp thời.',
      image_alt: 'Khám sức khỏe tổng quát'
    }
  ];

  const filteredArticles = articles.filter(art => {
    const matchesCategory = selectedCategory === 'ALL' || art.category === selectedCategory;
    const matchesSearch = art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          art.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#F7F5F0]">
      <Navbar />

      <main className="max-w-[1080px] mx-auto px-4 lg:px-8 py-8 space-y-8 text-left">
        {/* Breadcrumb & Title */}
        <div className="space-y-2 border-b border-[#E4E1D8] pb-6">
          <div className="text-xs text-[#6B6A65] flex items-center space-x-1">
            <Link href="/" className="hover:text-[#1F6F5C]">Trang chủ</Link>
            <span>/</span>
            <span className="font-semibold text-[#1C1B19]">Tin tức & Bài viết</span>
          </div>
          <h1 className="text-3xl font-bold text-[#1C1B19]">Tin Tức & Kiến Thức Sức Khỏe Y Khoa</h1>
          <p className="text-base text-[#6B6A65]">
            Cập nhật các bài viết chia sẻ kiến thức phòng bệnh, công nghệ y tế và thông tin từ Hội đồng Bác sĩ
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="medical-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 flex items-center space-x-2 bg-[#F7F5F0] border border-[#E4E1D8] rounded-sm px-3 py-2">
            <Search className="w-4 h-4 text-[#6B6A65]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tiêu đề bài viết hoặc từ khóa sức khỏe..."
              className="w-full bg-transparent border-none text-xs text-[#1C1B19] focus:outline-none placeholder-[#9CA3AF]"
            />
          </div>

          <div className="flex items-center space-x-2 bg-[#F7F5F0] border border-[#E4E1D8] rounded-sm px-3 py-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-transparent border-none text-xs text-[#1C1B19] focus:outline-none"
            >
              <option value="ALL">Tất cả chuyên mục</option>
              <option value="Tim mạch">Tim mạch</option>
              <option value="Da liễu">Da liễu</option>
              <option value="Tai Mũi Họng">Tai Mũi Họng</option>
              <option value="Công nghệ Y tế">Công nghệ Y tế</option>
              <option value="Y học thường thức">Y học thường thức</option>
            </select>
          </div>
        </div>

        {/* Articles List */}
        <div className="space-y-6">
          {filteredArticles.map((art) => (
            <article key={art.id} className="medical-card p-6 flex flex-col md:flex-row items-start justify-between gap-6 hover:border-[#1F6F5C]/60 transition">
              <div className="space-y-2.5 flex-1">
                <div className="flex items-center space-x-3 text-xs">
                  <span className="px-2.5 py-0.5 rounded-sm font-semibold bg-[#DCEAE6] text-[#1F6F5C]">
                    {art.category}
                  </span>
                  <span className="text-[#6B6A65] flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 mr-1" />
                    {art.date}
                  </span>
                  <span className="text-[#6B6A65] flex items-center space-x-1">
                    <User className="w-3.5 h-3.5 mr-1 text-[#1F6F5C]" />
                    {art.author}
                  </span>
                </div>

                <h2 className="text-xl font-bold text-[#1C1B19] hover:text-[#1F6F5C] transition">
                  {art.title}
                </h2>
                <p className="text-xs text-[#6B6A65] leading-relaxed">{art.excerpt}</p>

                <div className="pt-2">
                  <Link
                    href={`/news`}
                    className="text-xs font-semibold text-[#1F6F5C] flex items-center space-x-1 hover:underline"
                  >
                    <span>Đọc tiếp bài viết</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
