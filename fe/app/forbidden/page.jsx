'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { ShieldAlert, ArrowLeft, Home, LogIn } from 'lucide-react';
import ApiService from '../../services/api';

export default function ForbiddenPage() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const storedRole = localStorage.getItem('user_role');
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      setRole(storedRole);
      setUser(storedUser);
    } catch (e) {}
  }, []);

  const getPortalLink = () => {
    switch (role) {
      case 'DOCTOR':
        return { path: '/doctor/dashboard', label: 'Cổng Bác sĩ (Doctor Portal)' };
      case 'RECEPTIONIST':
        return { path: '/reception', label: 'Bàn Tiếp đón (Reception Desk)' };
      case 'ADMIN':
        return { path: '/admin/dashboard', label: 'Cổng Quản trị (Admin Portal)' };
      case 'PATIENT':
        return { path: '/patient/dashboard', label: 'Cổng Bệnh nhân (Patient Portal)' };
      default:
        return { path: '/', label: 'Trang chủ' };
    }
  };

  const portal = getPortalLink();

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex flex-col justify-between text-[#1C1B19]">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#FFFFFF] border border-[#E4E1D8] shadow-subtle rounded-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#F6DEDC] text-[#C1443C] flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-mono font-bold text-[#C1443C] tracking-widest uppercase">
              Lỗi 403 • Truy Cập Bị Từ Chối
            </span>
            <h1 className="text-2xl font-bold text-[#1C1B19] mt-1">
              Bạn không có quyền truy cập khu vực này
            </h1>
            <p className="text-xs text-[#6B6A65] mt-2 leading-relaxed">
              Khu vực này yêu cầu quyền hạn chuyên biệt trong hệ thống phòng khám. 
              {user ? (
                <span> Vai trò hiện tại của bạn là <strong className="text-[#1F6F5C] font-semibold">{role || 'Người dùng'}</strong>.</span>
              ) : (
                <span> Vui lòng đăng nhập với tài khoản có thẩm quyền để tiếp tục.</span>
              )}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            {role && role !== 'GUEST' && (
              <button
                onClick={() => router.push(portal.path)}
                className="w-full py-2.5 px-4 bg-[#1F6F5C] hover:bg-[#185949] text-white rounded-md text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition"
              >
                <span>Về cổng làm việc của bạn: {portal.label}</span>
              </button>
            )}

            <button
              onClick={() => router.push('/')}
              className="w-full py-2.5 px-4 bg-[#FFFFFF] hover:bg-[#F7F5F0] border border-[#E4E1D8] text-[#1C1B19] rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <Home className="w-4 h-4 text-[#6B6A65]" />
              <span>Quay về trang chủ</span>
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
