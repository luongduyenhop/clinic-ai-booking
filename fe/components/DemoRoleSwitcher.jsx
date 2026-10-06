'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Shield, ArrowRight, Minimize2, Maximize2, Sparkles, Check, RefreshCw } from 'lucide-react';
import ApiService from '../services/api';

const DEMO_ACCOUNTS = [
  {
    role: 'PATIENT',
    label: 'Bệnh nhân',
    email: 'patient@test.com',
    password: 'Patient@123456',
    path: '/patient/dashboard',
    badgeClass: 'bg-[#DCEAE6] text-[#1F6F5C] border-[#b8d9d0]',
    btnActive: 'bg-[#1F6F5C] text-white ring-2 ring-[#1F6F5C]',
    icon: '👤',
    desc: 'Đặt khám & xem lịch sử'
  },
  {
    role: 'RECEPTIONIST',
    label: 'Điều dưỡng',
    email: 'letan@clinic.com',
    password: 'LeTan@123456',
    path: '/reception',
    badgeClass: 'bg-[#E0E7FF] text-[#4338CA] border-[#c7d2fe]',
    btnActive: 'bg-[#4338CA] text-white ring-2 ring-[#4338CA]',
    icon: '👩‍⚕️',
    desc: 'Tiếp đón & check-in luồng'
  },
  {
    role: 'DOCTOR',
    label: 'Bác sĩ',
    email: 'an.doctor@clinic.com',
    password: 'Doctor@123456',
    path: '/doctor/dashboard',
    badgeClass: 'bg-[#FBEACB] text-[#B45309] border-[#ebd095]',
    btnActive: 'bg-[#B45309] text-white ring-2 ring-[#B45309]',
    icon: '👨‍⚕️',
    desc: 'Ca khám & kê đơn thuốc'
  },
  {
    role: 'ADMIN',
    label: 'Quản trị viên',
    email: 'admin@clinic.com',
    password: 'Admin@123456',
    path: '/admin/dashboard',
    badgeClass: 'bg-[#EFECE6] text-[#1C1B19] border-[#E4E1D8]',
    btnActive: 'bg-[#1C1B19] text-white ring-2 ring-[#1C1B19]',
    icon: '⚙️',
    desc: 'Quản lý bác sĩ & ca làm'
  }
];

export default function DemoRoleSwitcher() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [switchingRole, setSwitchingRole] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Check if feature flag is active
  const isEnabled = process.env.NEXT_PUBLIC_ENABLE_ROLE_SWITCHER !== 'false';

  useEffect(() => {
    checkActiveSession();
    const handleAuthChange = () => checkActiveSession();
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const checkActiveSession = async () => {
    try {
      if (ApiService.getToken()) {
        const user = await ApiService.getCurrentUser();
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      setCurrentUser(null);
    }
  };

  const handleSwitchRole = async (account) => {
    if (switchingRole) return;
    setSwitchingRole(account.role);

    try {
      const res = await ApiService.loginPassword(account.email, account.password);
      if (res?.access_token) {
        setToastMessage(`Đã chuyển sang vai trò: ${account.label}`);
        window.dispatchEvent(new Event('auth-change'));
        // Navigate directly to target dashboard
        window.location.href = account.path;
      }
    } catch (error) {
      console.error('Lỗi chuyển vai trò demo:', error);
      alert(`Không thể chuyển sang vai trò ${account.label}: ${error.message}`);
      setSwitchingRole(null);
    }
  };

  if (!isEnabled) return null;

  const currentRole = currentUser?.role ? ApiService.normalizeRole(currentUser.role) : null;
  const activeAccount = DEMO_ACCOUNTS.find(a => a.role === currentRole);

  return (
    <aside
      aria-label="Demo role switcher"
      className="fixed bottom-4 left-4 z-50 print:hidden font-sans select-none"
    >
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center space-x-2 px-3 py-2 rounded-full bg-[#1C1B19] text-white shadow-xl hover:bg-[#333] border border-gray-700 transition transform hover:scale-105 text-xs font-semibold"
          title="Mở thanh chuyển vai trò Demo"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>🛠️ Role Switcher</span>
          {activeAccount && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">
              {activeAccount.icon} {activeAccount.label}
            </span>
          )}
          <Maximize2 className="w-3.5 h-3.5 ml-1 text-gray-400" />
        </button>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-xl shadow-2xl p-3.5 max-w-sm sm:max-w-md w-full backdrop-blur-md bg-white/95 text-[#1C1B19] space-y-2.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E4E1D8]/70 pb-2">
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F6F5C]">
                Demo Role Switcher
              </span>
              <span className="text-[10px] text-[#6B6A65] bg-[#F7F5F0] px-1.5 py-0.5 rounded border border-[#E4E1D8]">
                1-Click Fast Login
              </span>
            </div>

            <button
              onClick={() => setIsMinimized(true)}
              className="text-[#6B6A65] hover:text-[#1C1B19] p-1 rounded hover:bg-[#F7F5F0] transition"
              title="Thu nhỏ thanh Demo"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Current Active Account Status */}
          <div className="flex items-center justify-between text-xs bg-[#F7F5F0] rounded-lg px-2.5 py-1.5 border border-[#E4E1D8]">
            <span className="text-[#6B6A65] text-[11px]">Đang đăng nhập:</span>
            {activeAccount ? (
              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${activeAccount.badgeClass}`}>
                <span>{activeAccount.icon}</span>
                <span>{currentUser.ho_ten || currentUser.full_name || activeAccount.label}</span>
                <span className="text-[10px] opacity-75">({activeAccount.label})</span>
              </span>
            ) : (
              <span className="text-[11px] text-[#6B6A65] italic">Khách (Chưa đăng nhập)</span>
            )}
          </div>

          {/* Role Switching Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {DEMO_ACCOUNTS.map((account) => {
              const isActive = currentRole === account.role;
              const isLoading = switchingRole === account.role;

              return (
                <button
                  key={account.role}
                  disabled={isLoading}
                  onClick={() => handleSwitchRole(account)}
                  className={`p-2 rounded-lg text-left transition relative flex flex-col justify-between border text-xs ${
                    isActive
                      ? account.btnActive
                      : 'bg-[#FAFAF8] hover:bg-[#F0EDE6] border-[#E4E1D8] text-[#1C1B19]'
                  } ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-sm">{account.icon}</span>
                    {isActive && (
                      <span className="text-[10px] bg-white/30 px-1 py-0.2 rounded font-bold">
                        Đang chọn
                      </span>
                    )}
                    {isLoading && (
                      <RefreshCw className="w-3 h-3 animate-spin text-current" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-[11px] leading-tight">
                      {account.label}
                    </div>
                    <div className={`text-[10px] line-clamp-1 ${isActive ? 'text-white/80' : 'text-[#6B6A65]'}`}>
                      {account.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Notice */}
          <div className="text-[10px] text-[#6B6A65] flex items-center justify-between pt-1">
            <span>💡 Bấm nút để chuyển phiên làm việc ngay lập tức</span>
            <span className="font-mono text-[9px] text-gray-400">DEV MODE</span>
          </div>
        </div>
      )}
    </aside>
  );
}
