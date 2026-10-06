'use client';

import React from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import PatientPortal from '../../../components/PatientPortal';
import ProtectedRoute from '../../../components/ProtectedRoute';

export default function PatientDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR', 'RECEPTIONIST', 'ADMIN']}>
      <div className="min-h-screen bg-[#F7F5F0]">
        <Navbar />
        <div className="py-4">
          <PatientPortal />
        </div>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
