'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ApiService from '../services/api';

export default function ProtectedRoute({ allowedRoles = [], children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    checkAuthorization();
  }, [allowedRoles]);

  const checkAuthorization = async () => {
    const token = ApiService.getToken();
    if (!token) {
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        router.replace(`/?redirect=${encodeURIComponent(currentPath)}`);
      }
      return;
    }

    try {
      let role = localStorage.getItem('user_role');
      if (!role) {
        const user = await ApiService.getCurrentUser();
        role = user?.role ? ApiService.normalizeRole(user.role) : null;
      }

      if (!role || !allowedRoles.includes(role)) {
        router.replace('/forbidden');
        return;
      }

      setAuthorized(true);
    } catch (e) {
      router.replace('/forbidden');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F5F0]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-[#1F6F5C] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-[#6B6A65] font-medium">Đang kiểm tra phân quyền truy cập...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
}
