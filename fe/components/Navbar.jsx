'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Stethoscope, LogIn, LogOut, User, Menu, X, Phone, Mail, Search,
  Calendar, Sparkles, Globe, ChevronDown, ShieldAlert, MessageCircle
} from 'lucide-react';
import ApiService from '../services/api';
import AuthModal from './AuthModal';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [topSearchQuery, setTopSearchQuery] = useState('');
  const [lang, setLang] = useState('VN');
  const [isStaffMenuOpen, setIsStaffMenuOpen] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      if (ApiService.getToken()) {
        const user = await ApiService.getCurrentUser();
        setCurrentUser(user);
      }
    } catch (e) {
      console.log('No active session or backend offline');
    }
  };

  const handleLogout = () => {
    ApiService.logout();
    setCurrentUser(null);
    setIsStaffMenuOpen(false);
  };

  const handleTopSearch = (e) => {
    e.preventDefault();
    if (!topSearchQuery.trim()) return;
    router.push(`/doctors?search=${encodeURIComponent(topSearchQuery)}`);
  };

  const navLinks = [
    { href: '/', label: 'Trang chủ' },
    { href: '/symptom-checker', label: 'Phân tích AI & Đặt lịch' },
    { href: '/departments', label: 'Chuyên khoa' },
    { href: '/doctors', label: 'Chuyên gia - Bác sĩ' },
    { href: '/packages', label: 'Gói dịch vụ' },
    { href: '/about', label: 'Giới thiệu' },
    { href: '/news', label: 'Tin tức & Bài viết' },
    { href: '/contact', label: 'Liên hệ' },
  ];

  const getPortalLink = () => {
    if (!currentUser) return null;
    if (currentUser.role === 'DOCTOR') return { href: '/doctor/dashboard', label: 'Cổng Bác sĩ' };
    if (currentUser.role === 'RECEPTIONIST') return { href: '/reception', label: 'Bàn Tiếp đón' };
    if (currentUser.role === 'ADMIN') return { href: '/admin/dashboard', label: 'Cổng Quản trị' };
    return { href: '/patient/dashboard', label: 'Lịch hẹn của tôi' };
  };

  const portalLink = getPortalLink();
  const isStaff = currentUser && ['DOCTOR', 'RECEPTIONIST', 'ADMIN'].includes(currentUser.role);

  return (
    <>
      {/* 1. TOP CONTACT BAR (Enterprise Header Header Topbar) */}
      <div className="bg-[#1C1B19] text-[#F7F5F0] text-xs py-2 px-4 lg:px-8 border-b border-gray-800">
        <div className="max-w-[1080px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-6 text-[11px] sm:text-xs">
            <a href="tel:19001234" className="flex items-center space-x-1.5 hover:text-[#E8A33D] transition">
              <Phone className="w-3.5 h-3.5 text-[#1F6F5C]" />
              <span>Tổng đài CSKH: <strong>1900 1234</strong></span>
            </a>
            <span className="hidden sm:inline text-gray-600">|</span>
            <a href="tel:115" className="flex items-center space-x-1.5 text-[#C1443C] font-semibold hover:underline">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Cấp cứu 115</span>
            </a>
            <span className="hidden md:inline text-gray-600">|</span>
            <a href="mailto:contact@smartcare.vn" className="hidden md:flex items-center space-x-1.5 text-gray-400 hover:text-white">
              <Mail className="w-3.5 h-3.5" />
              <span>contact@smartcare.vn</span>
            </a>
          </div>

          <div className="flex items-center space-x-4 text-[11px] sm:text-xs">
            {/* Language Toggle */}
            <div className="flex items-center space-x-1 text-gray-400">
              <Globe className="w-3.5 h-3.5" />
              <button
                onClick={() => setLang(lang === 'VN' ? 'EN' : 'VN')}
                className="font-semibold text-white hover:text-[#E8A33D] uppercase"
              >
                {lang}
              </button>
            </div>

            {/* Portal / User Login Status */}
            {currentUser ? (
              <div className="flex items-center space-x-2">
                <span className="text-[#DCEAE6] font-semibold">{currentUser.full_name}</span>
                <button
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-white underline"
                >
                  (Thoát)
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="text-white hover:text-[#E8A33D] font-semibold flex items-center space-x-1"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập / Đăng ký</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. BRAND MAIN HEADER BAR WITH SEARCH & PRIMARY CTA */}
      <header className="bg-[#FFFFFF] border-b border-[#E4E1D8] px-4 lg:px-8 py-3.5 sticky top-0 z-40 shadow-subtle text-[#1C1B19]">
        <div className="max-w-[1080px] mx-auto flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center space-x-3 flex-shrink-0">
            <div className="w-10 h-10 rounded-sm bg-[#1F6F5C] text-white flex items-center justify-center font-bold">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <span className="text-lg font-bold text-[#1C1B19] block leading-none">Sức Khoẻ Thông Minh</span>
              <span className="text-[11px] text-[#6B6A65] hidden sm:block mt-1">SmartCare Hospital Group</span>
            </div>
          </Link>

          {/* Quick Search Bar in Header */}
          <form onSubmit={handleTopSearch} className="hidden lg:flex items-center flex-1 max-w-sm mx-6 relative">
            <input
              type="text"
              value={topSearchQuery}
              onChange={(e) => setTopSearchQuery(e.target.value)}
              placeholder="Tìm theo tên bác sĩ, chuyên khoa, dịch vụ..."
              className="w-full bg-[#F7F5F0] border border-[#E4E1D8] rounded-sm pl-3 pr-9 py-1.5 text-xs text-[#1C1B19] focus:outline-none focus:border-[#1F6F5C]"
            />
            <button type="submit" className="absolute right-2 text-[#6B6A65] hover:text-[#1F6F5C]">
              <Search className="w-4 h-4" />
            </button>
          </form>

          {/* Header Action Buttons */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            {/* Staff Dropdown Menu: Only visible when logged in with role DOCTOR, RECEPTIONIST, ADMIN */}
            {isStaff && (
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setIsStaffMenuOpen(!isStaffMenuOpen)}
                  className="px-3 py-1.5 rounded-sm bg-[#1F6F5C] text-white font-semibold text-xs hover:bg-[#185849] transition flex items-center space-x-1"
                >
                  <span>Cổng Cán Bộ Y Tế</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isStaffMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isStaffMenuOpen && (
                  <div
                    className="absolute right-0 mt-1.5 w-60 bg-[#FFFFFF] border border-[#E4E1D8] rounded-md shadow-lg py-1.5 z-50 text-xs text-left"
                    onMouseLeave={() => setIsStaffMenuOpen(false)}
                  >
                    <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-[#6B6A65] tracking-wider border-b border-[#E4E1D8]/60 mb-1">
                      Khu vực nội bộ phòng khám
                    </div>
                    <Link
                      href="/doctor/dashboard"
                      onClick={() => setIsStaffMenuOpen(false)}
                      className="flex items-center space-x-2.5 px-3 py-2 text-[#1C1B19] hover:bg-[#F7F5F0] hover:text-[#1F6F5C] transition font-medium"
                    >
                      <span className="text-sm">🩺</span>
                      <div>
                        <div className="font-semibold text-xs">Cổng Bác sĩ</div>
                        <div className="text-[10px] text-[#6B6A65]">Ca khám & Bệnh án điện tử</div>
                      </div>
                    </Link>
                    <Link
                      href="/reception"
                      onClick={() => setIsStaffMenuOpen(false)}
                      className="flex items-center space-x-2.5 px-3 py-2 text-[#1C1B19] hover:bg-[#F7F5F0] hover:text-[#1F6F5C] transition font-medium"
                    >
                      <span className="text-sm">📋</span>
                      <div>
                        <div className="font-semibold text-xs">Bàn Tiếp đón / Điều dưỡng</div>
                        <div className="text-[10px] text-[#6B6A65]">Check-in & Điều phối luồng khám</div>
                      </div>
                    </Link>
                    <Link
                      href="/admin/dashboard"
                      onClick={() => setIsStaffMenuOpen(false)}
                      className="flex items-center space-x-2.5 px-3 py-2 text-[#1C1B19] hover:bg-[#F7F5F0] hover:text-[#1F6F5C] transition font-medium"
                    >
                      <span className="text-sm">⚙️</span>
                      <div>
                        <div className="font-semibold text-xs">Quản trị phòng khám</div>
                        <div className="text-[10px] text-[#6B6A65]">Bác sĩ, ca làm & cấu hình AI</div>
                      </div>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {portalLink && (
              <Link
                href={portalLink.href}
                className="hidden sm:inline-flex px-3 py-1.5 rounded-sm bg-[#DCEAE6] text-[#1F6F5C] font-semibold text-xs hover:bg-[#c6dfd8] transition"
              >
                {portalLink.label}
              </Link>
            )}

            <Link
              href="/symptom-checker"
              className="btn-primary px-4 py-2 text-xs font-semibold flex items-center space-x-1.5"
            >
              <Calendar className="w-4 h-4" />
              <span>Đặt lịch khám</span>
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-sm text-[#1C1B19] hover:bg-[#F7F5F0] transition"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* 3. MAIN NAVIGATION LINK BAR */}
        <div className="hidden md:block max-w-[1080px] mx-auto pt-3 border-t border-[#E4E1D8]/60 mt-3">
          <nav className="flex items-center space-x-6 text-xs font-semibold text-[#6B6A65]">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition py-1 ${active ? 'text-[#1F6F5C] font-bold border-b-2 border-[#1F6F5C]' : 'hover:text-[#1C1B19]'}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-[#E4E1D8] mt-3 pt-3 pb-2 space-y-2 text-sm font-medium">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-sm ${pathname === link.href ? 'bg-[#DCEAE6] text-[#1F6F5C] font-semibold' : 'text-[#6B6A65] hover:bg-[#F7F5F0]'}`}
              >
                {link.label}
              </Link>
            ))}

            {isStaff && (
              <div className="pt-2 border-t border-[#E4E1D8] space-y-1">
                <div className="px-3 py-1 text-[11px] font-bold uppercase text-[#1F6F5C]">
                  Cổng Cán Bộ Y Tế
                </div>
                <Link
                  href="/doctor/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-sm text-sm text-[#1C1B19] hover:bg-[#F7F5F0]"
                >
                  <span>🩺</span>
                  <span>Cổng Bác sĩ</span>
                </Link>
                <Link
                  href="/reception"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-sm text-sm text-[#1C1B19] hover:bg-[#F7F5F0]"
                >
                  <span>📋</span>
                  <span>Bàn Tiếp đón / Điều dưỡng</span>
                </Link>
                <Link
                  href="/admin/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-sm text-sm text-[#1C1B19] hover:bg-[#F7F5F0]"
                >
                  <span>⚙️</span>
                  <span>Quản trị phòng khám</span>
                </Link>
              </div>
            )}

            {portalLink && (
              <Link
                href={portalLink.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-sm bg-[#1F6F5C] text-white font-semibold"
              >
                {portalLink.label}
              </Link>
            )}
          </div>
        )}
      </header>

      {/* 4. FLOATING QUICK CONTACT WIDGET (Like TNH Floating Action Buttons) */}
      <div className="fixed right-4 bottom-20 z-40 hidden sm:flex flex-col space-y-3">
        <a
          href="tel:19001234"
          className="w-11 h-11 rounded-full bg-[#1F6F5C] text-white flex items-center justify-center shadow-md hover:scale-105 transition"
          title="Gọi tổng đài 1900 1234"
        >
          <Phone className="w-5 h-5" />
        </a>
        <Link
          href="/symptom-checker"
          className="w-11 h-11 rounded-full bg-[#E8A33D] text-white flex items-center justify-center shadow-md hover:scale-105 transition"
          title="Tư vấn triệu chứng AI 24/7"
        >
          <Sparkles className="w-5 h-5" />
        </Link>
        <Link
          href="/symptom-checker"
          className="w-11 h-11 rounded-full bg-[#1C1B19] text-white flex items-center justify-center shadow-md hover:scale-105 transition"
          title="Đặt lịch khám nhanh"
        >
          <Calendar className="w-5 h-5" />
        </Link>
      </div>

      {/* 5. MOBILE BOTTOM STICKY BAR (Like TNH m-fixed-buttons) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF] border-t border-[#E4E1D8] py-2 px-4 flex items-center justify-around md:hidden shadow-lg text-xs">
        <a href="tel:19001234" className="flex flex-col items-center space-y-1 text-[#1C1B19]">
          <Phone className="w-5 h-5 text-[#1F6F5C]" />
          <span className="text-[10px]">Tổng đài</span>
        </a>
        <Link href="/symptom-checker" className="flex flex-col items-center space-y-1 text-[#1C1B19]">
          <Sparkles className="w-5 h-5 text-[#E8A33D]" />
          <span className="text-[10px]">Tư vấn AI</span>
        </Link>
        <Link href="/symptom-checker" className="flex flex-col items-center space-y-1 text-[#1F6F5C] font-semibold">
          <Calendar className="w-5 h-5 text-[#1F6F5C]" />
          <span className="text-[10px]">Đặt lịch</span>
        </Link>
      </div>

      {/* Shared Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
        }}
      />
    </>
  );
}
