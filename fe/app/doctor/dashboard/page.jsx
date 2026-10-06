'use client';

import React from 'react';
import StaffHeader, { StaffFooter } from '../../../components/StaffHeader';
import DoctorPortal from '../../../components/DoctorPortal';
import ProtectedRoute from '../../../components/ProtectedRoute';

export default function DoctorDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['DOCTOR']}>
      <div className="min-h-screen bg-[#F7F5F0] flex flex-col justify-between">
        <div>
          <StaffHeader activeRole="DOCTOR" />
          <div className="py-4">
            <DoctorPortal />
          </div>
        </div>
        <StaffFooter />
      </div>
    </ProtectedRoute>
  );
}
