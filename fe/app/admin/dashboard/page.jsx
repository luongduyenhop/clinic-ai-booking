'use client';

import React from 'react';
import StaffHeader, { StaffFooter } from '../../../components/StaffHeader';
import AdminPortal from '../../../components/AdminPortal';
import ProtectedRoute from '../../../components/ProtectedRoute';

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <div className="min-h-screen bg-[#F7F5F0] flex flex-col justify-between">
        <div>
          <StaffHeader activeRole="ADMIN" />
          <div className="py-4">
            <AdminPortal />
          </div>
        </div>
        <StaffFooter />
      </div>
    </ProtectedRoute>
  );
}
