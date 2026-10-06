import React from 'react';
import Link from 'next/link';
import { Stethoscope, Phone, MapPin, Mail, ShieldAlert, ChevronRight, QrCode, ShieldCheck, Award } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-20 bg-[#FFFFFF] border-t border-[#E4E1D8] text-left text-xs text-[#6B6A65]">
      {/* Upper Main Footer Grid */}
      <div className="max-w-[1080px] mx-auto px-4 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand Info Column */}
        <div className="space-y-4 md:col-span-1">
          <div className="flex items-center space-x-2 text-[#1F6F5C] font-bold text-base">
            <Stethoscope className="w-6 h-6" />
            <span>Sức Khoẻ Thông Minh</span>
          </div>
          <span className="font-bold text-[#1C1B19] text-xs block">CTCP TẬP ĐOÀN BỆNH VIỆN SMARTCARE</span>
          <p className="text-xs text-[#6B6A65] leading-relaxed">
            Hệ thống y tế chất lượng cao, tích hợp AI phân tích triệu chứng ban đầu, kết nối đặt lịch khám 30 phút và quản lý bệnh án điện tử an toàn.
          </p>
          <div className="space-y-1.5 pt-1">
            <p className="flex items-center space-x-2 text-xs text-[#1C1B19]">
              <Phone className="w-3.5 h-3.5 text-[#1F6F5C]" />
              <span>Tổng đài CSKH: <strong>1900 1234</strong></span>
            </p>
            <p className="flex items-center space-x-2 text-xs text-[#C1443C] font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-[#C1443C]" />
              <span>Cấp cứu 24/7: Gọi ngay 115</span>
            </p>
            <p className="flex items-center space-x-2 text-xs text-[#6B6A65]">
              <Mail className="w-3.5 h-3.5" />
              <span>contact@smartcare.vn</span>
            </p>
          </div>
        </div>

        {/* Hospital Network Branches */}
        <div className="space-y-3">
          <h4 className="font-bold text-[#1C1B19] text-xs uppercase tracking-wider border-b border-[#E4E1D8] pb-2">
            Hệ thống Cơ sở Y tế
          </h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/contact" className="hover:text-[#1F6F5C] flex items-center space-x-1">
                <ChevronRight className="w-3 h-3 text-[#1F6F5C]" />
                <span>Bệnh viện Quốc tế Hà Nội (Trụ sở)</span>
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-[#1F6F5C] flex items-center space-x-1">
                <ChevronRight className="w-3 h-3 text-[#1F6F5C]" />
                <span>Bệnh viện Đa khoa TP. Hồ Chí Minh</span>
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-[#1F6F5C] flex items-center space-x-1">
                <ChevronRight className="w-3 h-3 text-[#1F6F5C]" />
                <span>Bệnh viện Đa khoa Đà Nẵng</span>
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-[#1F6F5C] flex items-center space-x-1">
                <ChevronRight className="w-3 h-3 text-[#1F6F5C]" />
                <span>Bệnh viện Quốc tế Thái Nguyên</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* Customer Support & Links */}
        <div className="space-y-3">
          <h4 className="font-bold text-[#1C1B19] text-xs uppercase tracking-wider border-b border-[#E4E1D8] pb-2">
            Hỗ trợ khách hàng
          </h4>
          <ul className="space-y-2 text-xs">
            <li><Link href="/symptom-checker" className="hover:text-[#1F6F5C]">Phân tích triệu chứng bằng AI</Link></li>
            <li><Link href="/departments" className="hover:text-[#1F6F5C]">Danh mục 14 Chuyên khoa</Link></li>
            <li><Link href="/doctors" className="hover:text-[#1F6F5C]">Đội ngũ Chuyên gia - Bác sĩ</Link></li>
            <li><Link href="/packages" className="hover:text-[#1F6F5C]">Gói dịch vụ y tế trọn gói</Link></li>
            <li><Link href="/how-it-works" className="hover:text-[#1F6F5C]">Hướng dẫn đặt lịch khám</Link></li>
            <li><Link href="/news" className="hover:text-[#1F6F5C]">Tin tức & Bài viết sức khỏe</Link></li>
          </ul>
        </div>

        {/* App Download & Certifications */}
        <div className="space-y-3 bg-[#F7F5F0] p-4 rounded-sm border border-[#E4E1D8]">
          <h4 className="font-bold text-[#1C1B19] text-xs uppercase tracking-wider">
            Tải App SmartCare
          </h4>
          <p className="text-[11px] text-[#6B6A65]">
            Quét mã QR để tải ứng dụng theo dõi hồ sơ sức khỏe cá nhân trên iOS & Android:
          </p>
          <div className="flex items-center space-x-3 bg-white p-2 rounded-sm border border-[#E4E1D8] max-w-[160px]">
            <QrCode className="w-10 h-10 text-[#1F6F5C]" />
            <div className="text-[10px] text-[#1C1B19] font-medium">
              <span>App Store</span>
              <br />
              <span>Google Play</span>
            </div>
          </div>
          <div className="pt-2 border-t border-[#E4E1D8] flex items-center space-x-3 text-[10px] text-[#6B6A65]">
            <span className="flex items-center space-x-1 text-[#2F8F5B] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Đạt chuẩn Bộ Y Tế</span>
            </span>
          </div>
        </div>
      </div>

      {/* Medical Disclaimer Banner per design.md */}
      <div className="bg-[#F7F5F0] border-y border-[#E4E1D8] py-3 px-4 text-center">
        <div className="max-w-[1080px] mx-auto text-[11px] text-[#6B6A65]">
          <strong>Khuyến cáo y tế:</strong> Thông tin gợi ý từ AI mang tính chất tham khảo phân loại ban đầu. Không thay thế cho kết luận chẩn đoán y khoa trực tiếp từ Bác sĩ chuyên khoa.
        </div>
      </div>

      {/* Bottom Copyright & Design Credits */}
      <div className="max-w-[1080px] mx-auto px-4 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#6B6A65] gap-2">
        <p>Copyright © 2026 SmartCare Hospital Group. Tất cả quyền được bảo lưu.</p>
        <p className="text-[10px] text-[#6B6A65]">Thiết kế theo chuẩn sản phẩm y tế doanh nghiệp Việt Nam</p>
      </div>
    </footer>
  );
}
