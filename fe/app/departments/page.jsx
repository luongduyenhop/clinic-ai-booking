'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { Stethoscope, Search, ArrowRight, ChevronRight, CheckCircle } from 'lucide-react';
import ApiService from '../../services/api';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // 14 Medical Specialties Catalog Data (Per Item 1 in Specification Table)
  const initialDepartmentsData = [
    { id: 1, code: 'INTERNAL_MEDICINE', name: 'Nội tổng quát', doctor_count: 5, description: 'Chẩn đoán và điều trị bệnh lý đường tiêu hóa, hô hấp, tuần hoàn tổng quát.', conditions: ['Cảm cúm', 'Viêm phế quản', 'Rối loạn tiêu hóa', 'Sốt xuất huyết'] },
    { id: 2, code: 'CARDIOLOGY', name: 'Tim mạch', doctor_count: 4, description: 'Tầm soát bệnh mạch vành, tăng huyết áp, suy tim và rối loạn nhịp tim.', conditions: ['Tăng huyết áp', 'Thiếu máu cơ tim', 'Rối loạn nhịp tim', 'Đau thắt ngực'] },
    { id: 3, code: 'DERMATOLOGY', name: 'Da liễu', doctor_count: 3, description: 'Trị liệu dị ứng da, mề đay mãn tính, chàm và viêm da cơ địa.', conditions: ['Viêm da dị ứng', 'Mề đay', 'Mụn trứng cá nhiễm khuẩn', 'Bệnh ngoài da'] },
    { id: 4, code: 'PEDIATRICS', name: 'Nhi khoa', doctor_count: 4, description: 'Chăm sóc sức khỏe toàn diện và tiêm chủng phòng bệnh cho trẻ sơ sinh và trẻ nhỏ.', conditions: ['Trẻ sốt vi rút', 'Viêm tai giữa trẻ em', 'Tư vấn dinh dưỡng', 'Ho hen ở trẻ'] },
    { id: 5, code: 'ENT', name: 'Tai Mũi Họng', doctor_count: 3, description: 'Nội soi chẩn đoán viêm xoang, viêm họng cấp, viêm amidan và tổn thương màng nhĩ.', conditions: ['Viêm xoang cấp', 'Viêm amidan', 'Ù tai', 'Hạt dây thanh'] },
    { id: 6, code: 'NEUROLOGY', name: 'Thần kinh', doctor_count: 3, description: 'Tầm soát đau đầu mãn tính, rối loạn giấc ngủ, tiền đình và thiếu máu não.', conditions: ['Migraine', 'Rối loạn tiền đình', 'Đau thần kinh tọa', 'Mất ngủ'] },
    { id: 7, code: 'OBGYN', name: 'Sản phụ khoa', doctor_count: 3, description: 'Khám thai định kỳ, chăm sóc sức khỏe phụ nữ và tư vấn sinh sản.', conditions: ['Khám thai định kỳ', 'Tư vấn sinh sản', 'Viêm nhiễm phụ khoa', 'Chăm sóc thai kỳ'] },
    { id: 8, code: 'OPHTHALMOLOGY', name: 'Mắt (Nhãn khoa)', doctor_count: 2, description: 'Đo tật khúc xạ, tầm soát đau mắt đỏ, đục thủy tinh thể và cận thị.', conditions: ['Đau mắt đỏ', 'Tật khúc xạ', 'Đục thủy tinh thể', 'Khô mắt'] },
    { id: 9, code: 'RHEUMATOLOGY', name: 'Cơ Xương Khớp', doctor_count: 3, description: 'Trị liệu thoái hóa khớp, thoái hóa cột sống, gút và viêm khớp dạng thấp.', conditions: ['Thoái hóa khớp gối', 'Thoái hóa đốt sống cổ', 'Bệnh Gút (Gout)', 'Viêm khớp dạng thấp'] },
    { id: 10, code: 'GASTROENTEROLOGY', name: 'Tiêu hóa & Gan mật', doctor_count: 4, description: 'Khám và nội soi dạ dày, đại tràng, vi trùng HP, viêm gan siêu vi B/C.', conditions: ['Viêm loét dạ dày HP', 'Trào ngược dạ dày thực quản', 'Viêm gan B/C', 'Hội chứng ruột kích thích'] },
    { id: 11, code: 'ODONTO_STOMATOLOGY', name: 'Răng Hàm Mặt', doctor_count: 3, description: 'Khám và điều trị nhổ răng khôn, sâu răng, nha chu và thẩm mỹ răng sứ.', conditions: ['Nhổ răng khôn mọc lệch', 'Chữa sâu răng & Viêm tủy', 'Viêm nha chu', 'Tẩy trắng răng'] },
    { id: 12, code: 'PULMONOLOGY', name: 'Hô hấp & Phổi', doctor_count: 3, description: 'Điều trị hen phế quản, Bệnh phổi tắc nghẽn mãn tính (COPD) và viêm phổi.', conditions: ['Hen phế quản', 'Bệnh COPD', 'Viêm phổi cấp', 'Ho lao & Tầm soát phổi'] },
    { id: 13, code: 'ENDOCRINOLOGY', name: 'Nội tiết & Tiểu đường', doctor_count: 3, description: 'Quản lý bệnh đái tháo đường, suy tuyến giáp, béo phì và rối loạn chuyển hóa.', conditions: ['Đái tháo đường tuýp 1 & 2', 'Bướu cổ & Viêm tuyến giáp', 'Rối loạn mỡ máu', 'Béo phì'] },
    { id: 14, code: 'NUTRITION_ANDROLOGY', name: 'Dinh dưỡng & Nam học', doctor_count: 2, description: 'Tư vấn chế độ ăn bệnh lý, tăng giảm cân và khám sức khỏe nam giới.', conditions: ['Tư vấn dinh dưỡng bệnh lý', 'Rối loạn cương dương', 'Tầm soát sức khỏe nam giới', 'Suy giảm Testosterone'] }
  ];

  useEffect(() => {
    fetchDepts();
  }, []);

  const fetchDepts = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getDepartments();
      if (data && data.length > 0) {
        setDepartments(data);
      } else {
        setDepartments(initialDepartmentsData);
      }
    } catch (e) {
      setDepartments(initialDepartmentsData);
    } finally {
      setLoading(false);
    }
  };

  const filteredDepts = (departments.length > 0 ? departments : initialDepartmentsData).filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F7F5F0]">
      <Navbar />

      <main className="max-w-[1080px] mx-auto px-4 lg:px-8 py-8 space-y-8 text-left">
        {/* Header Breadcrumb & Title */}
        <div className="space-y-2 border-b border-[#E4E1D8] pb-6">
          <div className="text-xs text-[#6B6A65] flex items-center space-x-1">
            <Link href="/" className="hover:text-[#1F6F5C]">Trang chủ</Link>
            <span>/</span>
            <span className="font-semibold text-[#1C1B19]">Chuyên khoa</span>
          </div>
          <h1 className="text-3xl font-bold text-[#1C1B19]">Danh mục 14 Chuyên khoa Y tế</h1>
          <p className="text-base text-[#6B6A65]">
            Tìm kiếm phòng khám và xem thông tin chi tiết các bệnh lý được điều trị theo từng chuyên khoa
          </p>
        </div>

        {/* Search Bar Input */}
        <div className="medical-card p-4 flex items-center space-x-3">
          <Search className="w-5 h-5 text-[#6B6A65]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên chuyên khoa hoặc bệnh lý (ví dụ: Tim mạch, Da liễu, Đau ngực...)"
            className="w-full bg-transparent border-none text-sm text-[#1C1B19] focus:outline-none placeholder-[#9CA3AF]"
          />
        </div>

        {/* Departments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredDepts.map((dept) => (
            <div key={dept.id} className="medical-card p-6 space-y-4 flex flex-col justify-between hover:border-[#1F6F5C]/60 transition">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-sm bg-[#DCEAE6] text-[#1F6F5C] flex items-center justify-center font-bold">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-sm text-xs font-medium bg-[#F7F5F0] text-[#6B6A65] border border-[#E4E1D8]">
                    {dept.doctor_count || 4} Bác sĩ
                  </span>
                </div>

                <h2 className="text-xl font-semibold text-[#1C1B19]">{dept.name}</h2>
                <p className="text-sm text-[#6B6A65] leading-relaxed">{dept.description}</p>

                {/* Treated Conditions Tags */}
                {dept.conditions && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-xs font-semibold text-[#1C1B19]">Các bệnh lý thường gặp:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {dept.conditions.map((cond, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-sm text-xs bg-[#F7F5F0] text-[#1C1B19] border border-[#E4E1D8]">
                          {cond}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#E4E1D8] flex items-center justify-between">
                <Link
                  href={`/departments/${dept.id}`}
                  className="btn-secondary px-4 py-2 text-xs flex items-center space-x-1"
                >
                  <span>Xem chi tiết chuyên khoa</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>

                <Link
                  href={`/symptom-checker`}
                  className="btn-primary px-4 py-2 text-xs flex items-center space-x-1"
                >
                  <span>Đặt khám</span>
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
