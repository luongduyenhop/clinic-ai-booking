'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { Stethoscope, Search, MapPin, Star, Filter, Calendar, ChevronRight } from 'lucide-react';
import ApiService from '../../services/api';

export default function DoctorsDirectoryPage() {
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const defaultDoctorsData = [
    {
      id: 1,
      full_name: 'PGS.TS.BS Phạm Hoàng Nam',
      title: 'PGS.TS.BS',
      department_name: 'Tim mạch',
      department_id: 2,
      years_experience: 22,
      consultation_fee: 500000,
      rating_avg: 4.9,
      rating_count: 42,
      hospital_address: 'Bệnh viện Đa khoa Quốc tế — Tầng 3, Khoa Tim mạch',
      bio: 'Trưởng khoa Tim mạch với 22 năm kinh nghiệm chẩn đoán và điều trị bệnh mạch vành, rối loạn nhịp tim và tăng huyết áp.'
    },
    {
      id: 2,
      full_name: 'ThS.BS Trần Thị Mai',
      title: 'ThS.BS',
      department_name: 'Da liễu',
      department_id: 3,
      years_experience: 12,
      consultation_fee: 350000,
      rating_avg: 4.8,
      rating_count: 29,
      hospital_address: 'Bệnh viện Đa khoa Quốc tế — Tầng 2, Khoa Da liễu',
      bio: 'Chuyên gia trị liệu da liễu thẩm mỹ, mề đay mãn tính, chàm và các biểu hiện viêm da dị ứng.'
    },
    {
      id: 3,
      full_name: 'BS.CKII Lê Văn Đức',
      title: 'BS.CKII',
      department_name: 'Nội tổng quát',
      department_id: 1,
      years_experience: 18,
      consultation_fee: 400000,
      rating_avg: 4.95,
      rating_count: 51,
      hospital_address: 'Bệnh viện Đa khoa Quốc tế — Tầng 1, Khoa Nội tổng quát',
      bio: 'Chuyên khoa Nội tổng hợp, quản lý bệnh mãn tính đường tiêu hóa, hô hấp và tuần hoàn.'
    },
    {
      id: 4,
      full_name: 'BS.CKI Đặng Thu Hà',
      title: 'BS.CKI',
      department_name: 'Tai Mũi Họng',
      department_id: 5,
      years_experience: 9,
      consultation_fee: 300000,
      rating_avg: 4.75,
      rating_count: 18,
      hospital_address: 'Bệnh viện Đa khoa Quốc tế — Tầng 4, Khoa Tai Mũi Họng',
      bio: 'Chuyên gia khám và điều trị nội soi Tai Mũi Họng, viêm xoang cấp, viêm amidan và tổn thương màng nhĩ.'
    }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const docs = await ApiService.getDoctors();
      const depts = await ApiService.getDepartments();
      if (docs && docs.length > 0) setDoctors(docs);
      else setDoctors(defaultDoctorsData);
      if (depts) setDepartments(depts);
    } catch (e) {
      setDoctors(defaultDoctorsData);
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = (doctors.length > 0 ? doctors : defaultDoctorsData).filter(doc => {
    const matchesSearch = doc.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.department_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDeptId === 'ALL' || String(doc.department_id) === String(selectedDeptId);
    return matchesSearch && matchesDept;
  });

  return (
    <div className="min-h-screen bg-[#F7F5F0]">
      <Navbar />

      <main className="max-w-[1080px] mx-auto px-4 lg:px-8 py-8 space-y-8 text-left">
        {/* Header Breadcrumb & Title */}
        <div className="space-y-2 border-b border-[#E4E1D8] pb-6">
          <div className="text-xs text-[#6B6A65] flex items-center space-x-1">
            <Link href="/" className="hover:text-[#1F6F5C]">Trang chủ</Link>
            <span>/</span>
            <span className="font-semibold text-[#1C1B19]">Bác sĩ</span>
          </div>
          <h1 className="text-3xl font-bold text-[#1C1B19]">Đội ngũ Bác sĩ Chuyên khoa</h1>
          <p className="text-base text-[#6B6A65]">
            Tìm kiếm thông tin bác sĩ, xem đánh giá thực tế từ bệnh nhân và chủ động chọn lịch khám 30 phút
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="medical-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 flex items-center space-x-2 bg-[#F7F5F0] border border-[#E4E1D8] rounded-sm px-3 py-2">
            <Search className="w-4 h-4 text-[#6B6A65]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên bác sĩ hoặc chuyên khoa (ví dụ: Phạm Hoàng Nam, Tim mạch...)"
              className="w-full bg-transparent border-none text-xs text-[#1C1B19] focus:outline-none placeholder-[#9CA3AF]"
            />
          </div>

          <div className="flex items-center space-x-2 bg-[#F7F5F0] border border-[#E4E1D8] rounded-sm px-3 py-2">
            <Filter className="w-4 h-4 text-[#6B6A65]" />
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full bg-transparent border-none text-xs text-[#1C1B19] focus:outline-none"
            >
              <option value="ALL">Tất cả Chuyên khoa</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Doctor List */}
        <div className="space-y-4">
          {filteredDoctors.map((doc) => (
            <div key={doc.id} className="medical-card p-6 space-y-4 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-[#1F6F5C]/60 transition">
              <div className="flex items-start space-x-4">
                <div className="w-14 h-14 rounded-full bg-[#DCEAE6] text-[#1F6F5C] font-semibold flex items-center justify-center text-base flex-shrink-0">
                  {doc.title.slice(0, 3)}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-semibold text-[#1C1B19]">{doc.full_name}</h2>
                    <span className="px-2.5 py-0.5 rounded-sm text-xs font-medium bg-[#DCEAE6] text-[#1F6F5C]">
                      Khoa {doc.department_name}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B6A65]">
                    {doc.years_experience} năm kinh nghiệm • ★ {doc.rating_avg} ({doc.rating_count} đánh giá từ bệnh nhân)
                  </p>
                  <p className="text-xs text-[#1C1B19] line-clamp-2">{doc.bio}</p>
                  <p className="text-xs text-[#6B6A65] flex items-center pt-1">
                    <MapPin className="w-3.5 h-3.5 mr-1 text-[#6B6A65]" />
                    {doc.hospital_address}
                  </p>
                </div>
              </div>

              <div className="md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-[#E4E1D8] flex md:flex-col items-center md:items-end justify-between gap-3">
                <div>
                  <span className="text-xs text-[#6B6A65] block">Phí khám tư vấn:</span>
                  <span className="text-base font-bold text-[#1F6F5C]">
                    {doc.consultation_fee ? doc.consultation_fee.toLocaleString('vi-VN') : '350.000'} đ
                  </span>
                </div>

                <Link
                  href={`/symptom-checker`}
                  className="btn-primary px-4 py-2 text-xs flex items-center space-x-1"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Đặt lịch khám ngay</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
