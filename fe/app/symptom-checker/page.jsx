'use client';

import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import SymptomCheckerBooking from '../../components/SymptomCheckerBooking';

export default function SymptomCheckerPage() {
  return (
    <div className="min-h-screen bg-[#F7F5F0]">
      <Navbar />
      <div className="py-4">
        <SymptomCheckerBooking initialTab="checker" hideLandingSections={true} />
      </div>
      <Footer />
    </div>
  );
}
