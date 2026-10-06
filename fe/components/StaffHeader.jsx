'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity, Stethoscope, LogOut, ExternalLink,
  ChevronDown, Monitor, ClipboardList, Settings, UserCheck
} from 'lucide-react';
import ApiService from '../services/api';

export default function StaffHeader({ activeRole = null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      if (ApiService.getToken()) {
        const u = await ApiService.getCurrentUser();
        setCurrentUser(u);
      }
    } catch (e) {
      console.log('StaffHeader: No active session');
    }
  };

  const handleLogout = () => {
    ApiService.logout();
    setCurrentUser(null);
    router.push('/');
  };

  const role = currentUser?.role || activeRole || 'DOCTOR';

  // Role metadata
  const roleConfig = {
    DOCTOR: {
      title: 'BÁC SĨ LÂM SÀNG',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      icon: Stethoscope,
      nav: [
        { href: '/doctor/dashboard', label: 'Bàn Khám Bác Sĩ', icon: Activity },
        { href: '/queue-tv', label: 'Màn Hình Hàng Đợi (Queue TV)', icon: Monitor, external: true },
      ]
    },
    RECEPTIONIST: {
      title: 'ĐIỀU DƯỠNG TIẾP ĐÓN',
      badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
      icon: UserCheck,
      nav: [
        { href: '/reception', label: 'Bàn Tiếp Đón & Check-in', icon: ClipboardList },
        { href: '/queue-tv', label: 'Màn Hình Hàng Đợi (Queue TV)', icon: Monitor, external: true },
      ]
    },
    ADMIN: {
      title: 'QUẢN TRỊ VIÊN HỆ THỐNG',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: Settings,
      nav: [
        { href: '/admin/dashboard', label: 'Bảng Điều Khiển Quản Trị', icon: Settings },
        { href: '/reception', label: 'Khu Vực Tiếp Đón', icon: ClipboardList },
        { href: '/doctor/dashboard', label: 'Khu Vực Lâm Sàng', icon: Stethoscope },
        { href: '/queue-tv', label: 'Màn Hình Queue TV', icon: Monitor, external: true },
      ]
    }
  };

  const currentConfig = roleConfig[role] || roleConfig.DOCTOR;
  const RoleIcon = currentConfig.icon;

  return (
    <header className="sticky top-0 z-40 bg-[#12372A] text-white border-b border-[#1F6F5C]/40 shadow-md">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        
        {/* LEFT: System Identity & Role Badge */}
        <div className="flex items-center space-x-3">
          <Link
            href={role === 'ADMIN' ? '/admin/dashboard' : role === 'RECEPTIONIST' ? '/reception' : '/doctor/dashboard'}
            className="flex items-center space-x-2.5 group"
          >
            <div className="w-8 h-8 rounded bg-[#1F6F5C] flex items-center justify-center text-white shadow-inner font-bold text-sm">
              HIS
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs tracking-wider text-white uppercase flex items-center gap-1.5">
                SMARTCARE CLINICAL
                <span className="bg-emerald-600/40 text-emerald-200 text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold">
                  O3 Shell
                </span>
              </span>
              <span className="text-[10px] text-emerald-300/80 tracking-tight">
                Hệ Thống Tác Nghiệp Bệnh Viện & Phòng Khám
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center">
            <span className="text-emerald-800 mx-2">|</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border flex items-center space-x-1.5 ${currentConfig.badgeColor}`}>
              <RoleIcon className="w-3 h-3" />
              <span>{currentConfig.title}</span>
            </span>
          </div>
        </div>

        {/* CENTER: Workspace Navigation */}
        <nav className="hidden lg:flex items-center space-x-1">
          {currentConfig.nav.map((item) => {
            const isActive = pathname === item.href;
            const ItemIcon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                className={`px-3 py-1.5 rounded text-xs font-medium flex items-center space-x-1.5 transition ${
                  isActive
                    ? 'bg-[#1F6F5C] text-white shadow-sm font-semibold'
                    : 'text-emerald-100/80 hover:text-white hover:bg-emerald-900/50'
                }`}
              >
                <ItemIcon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.external && <ExternalLink className="w-2.5 h-2.5 opacity-60 ml-0.5" />}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT: Status, Public Portal Link, User Menu */}
        <div className="flex items-center space-x-3">
          {/* Connection Status */}
          <div className="hidden sm:flex items-center space-x-1.5 bg-emerald-950/60 border border-emerald-800/60 px-2 py-1 rounded text-[10px] text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Trực tuyến</span>
          </div>

          {/* Quick link to Public Portal (Safe navigation, no token impersonation) */}
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title="Mở cổng bệnh nhân ngoài website (Tab mới)"
            className="hidden md:flex items-center space-x-1 text-xs text-emerald-200/70 hover:text-white hover:bg-emerald-900/40 px-2.5 py-1.5 rounded transition border border-transparent hover:border-emerald-700/50"
          >
            <span className="text-[11px]">Cổng Bệnh nhân</span>
            <ExternalLink className="w-3 h-3" />
          </Link>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 bg-emerald-900/40 hover:bg-emerald-900/80 border border-emerald-700/50 px-2.5 py-1.5 rounded transition text-left"
            >
              <div className="w-6 h-6 rounded-full bg-[#1F6F5C] text-white flex items-center justify-center font-bold text-xs">
                {currentUser?.ho_ten ? currentUser.ho_ten.charAt(0) : 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <span className="block text-xs font-semibold text-white leading-tight">
                  {currentUser?.ho_ten || (role === 'DOCTOR' ? 'BS. Lâm sàng' : role === 'ADMIN' ? 'Quản trị viên' : 'Điều dưỡng trực')}
                </span>
                <span className="block text-[9px] text-emerald-300 leading-none">
                  {role}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-300" />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div
                className="absolute right-0 mt-1.5 w-52 bg-white text-[#1C1B19] rounded-md shadow-xl border border-gray-200 py-1 text-xs z-50 animate-in fade-in"
                onMouseLeave={() => setIsUserMenuOpen(false)}
              >
                <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/70">
                  <p className="font-semibold text-gray-800">{currentUser?.ho_ten || 'Cán bộ Y tế'}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{currentUser?.email || 'staff@smartcare.vn'}</p>
                  <p className="text-[10px] text-[#1F6F5C] font-semibold mt-0.5">{currentConfig.title}</p>
                </div>

                <div className="py-1">
                  <Link
                    href="/"
                    className="flex items-center px-3 py-2 text-gray-700 hover:bg-gray-100 space-x-2"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                    <span>Xem Cổng Bệnh nhân</span>
                  </Link>
                </div>

                <div className="border-t border-gray-100 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-3 py-2 text-rose-600 hover:bg-rose-50 space-x-2 text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng xuất phiên làm việc</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
}

export function StaffFooter() {
  return (
    <footer className="border-t border-[#E4E1D8] bg-white py-3 px-4 text-center text-[11px] text-gray-500">
      <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 text-[#6B6A65]">
        <span>Hệ thống Quản lý Bệnh án Điện tử & Bàn khám Ngoại trú (SmartCare Clinical HIS)</span>
        <span className="font-mono text-[10px]">Kiến trúc tham chiếu: OpenMRS O3 Application Shell • HL7 FHIR</span>
      </div>
    </footer>
  );
}
