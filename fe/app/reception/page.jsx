'use client';

import React from 'react';
import StaffHeader, { StaffFooter } from '../../components/StaffHeader';
import ReceptionDesk from '../../components/ReceptionDesk';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function ReceptionPage() {
  return (
    <ProtectedRoute allowedRoles={['RECEPTIONIST']}>
      <div className="min-h-screen bg-[#F7F5F0] flex flex-col justify-between">
        <div>
          <StaffHeader activeRole="RECEPTIONIST" />
          <main className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6">
            <ReceptionDesk />
          </main>
        </div>
        <StaffFooter />
      </div>
    </ProtectedRoute>
  );
}
