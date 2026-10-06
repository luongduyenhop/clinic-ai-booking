'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { Stethoscope, Calendar, MapPin, CheckCircle, ArrowRight, ShieldCheck, UserCheck, Star, Sparkles } from 'lucide-react';
import ApiService from '../../../services/api';

export default function DepartmentDetailPage() {
  const params = useParams();
  const deptId = params?.id;

  const [department, setDepartment] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  const initialDepartments = {
    '1': {
      id: 1,
      code: 'INTERNAL_MEDICINE',
      name: 'Khoa Nội tổng quát',
      doctor_count: 5,
      description: 'Chẩn đoán, theo dõi và điều trị toàn diện các bệnh lý đường tiêu hóa, hô hấp, tuần hoàn, nội tiết và rối loạn chuyển hóa.',
      detailed_desc: 'Khoa Nội tổng quát đóng vai trò là cửa ngõ thăm khám y tế hàng đầu. Đội ngũ bác sĩ dày dặn kinh nghiệm thực hiện chẩn đoán chuyên sâu cho các triệu chứng sốt không rõ nguyên nhân, cảm cúm kéo dài, rối loạn tiêu hóa, cao huyết áp và tầm soát bệnh mãn tính.',
      conditions: ['Cảm cúm & sốt vi rút', 'Viêm phế quản & ho kéo dài', 'Rối loạn tiêu hóa & đau dạ dày', 'Tăng huyết áp & tầm soát tiểu đường', 'Rối loạn mỡ máu', 'Suy nhược cơ thể & mệt mỏi'],
      procedure: [
        'Đón tiếp & kiểm tra chỉ số sinh hiệu (huyết áp, nhịp tim, chiều cao, cân nặng)',
        'Bác sĩ thăm khám lâm sàng, nghe tim phổi & hỏi tiền sử bệnh',
        'Chỉ định xét nghiệm bổ sung nếu cần (xét nghiệm máu, siêu âm, X-quang)',
        'Đọc kết quả, tư vấn phác đồ điều trị & kê đơn thuốc điện tử'
      ]
    },
    '2': {
      id: 2,
      code: 'CARDIOLOGY',
      name: 'Khoa Tim mạch',
      doctor_count: 4,
      description: 'Tầm soát và điều trị chuyên sâu bệnh lý mạch vành, tăng huyết áp, suy tim, rối loạn nhịp tim và dự phòng đột quỵ.',
      detailed_desc: 'Khoa Tim mạch quy tụ các Chuyên gia, Phó Giáo sư, Tiến sĩ hàng đầu về sức khỏe tim mạch. Được trang bị hệ thống siêu âm tim Doppler màu 4D, điện tâm đồ Holter 24h và hệ thống thử nghiệm gắng sức nhằm phát hiện sớm nguy cơ nhồi máu cơ tim.',
      conditions: ['Tăng huyết áp động mạch', 'Thiếu máu cơ tim & Đau thắt ngực', 'Rối loạn nhịp tim', 'Suy tim các giai đoạn', 'Xơ vữa động mạch', 'Tầm soát nguy cơ đột quỵ'],
      procedure: [
        'Đo điện tâm đồ (ECG) tại chỗ',
        'Khám lâm sàng tim mạch chuyên sâu & đo huyết áp 2 tay',
        'Siêu âm tim Doppler màu chẩn đoán hình ảnh',
        'Tư vấn chế độ ăn uống, tập luyện & kê đơn điều trị'
      ]
    },
    '3': {
      id: 3,
      code: 'DERMATOLOGY',
      name: 'Khoa Da liễu',
      doctor_count: 3,
      description: 'Chẩn đoán và trị liệu các bệnh lý da nhiễm khuẩn, dị ứng, chàm, mề đay mãn tính và mụn trứng cá nặng.',
      detailed_desc: 'Khoa Da liễu áp dụng các kỹ thuật chẩn đoán bằng kính soi da Dermoscopy thế hệ mới, giúp phân tích tổn thương bề mặt da chính xác, phân biệt bệnh da lành tính và ác tính, điều trị tận gốc các dị ứng dai dẳng.',
      conditions: ['Viêm da dị ứng & Viêm da cơ địa', 'Mề đay mãn tính', 'Mụn trứng cá nhiễm khuẩn nặng', 'Bệnh vảy nến & Á sừng', 'Nấm da & Giời bò', 'Dị ứng mỹ phẩm & Hóa chất'],
      procedure: [
        'Soi da bằng thiết bị chẩn đoán Dermoscopy',
        'Đánh giá mức độ tổn thương & phản ứng dị ứng',
        'Châm xét nghiệm dị nguyên (nếu cần)',
        'Kê đơn điều trị nội khoa & hướng dẫn chăm sóc da tại nhà'
      ]
    },
    '4': {
      id: 4,
      code: 'PEDIATRICS',
      name: 'Khoa Nhi khoa',
      doctor_count: 4,
      description: 'Chăm sóc sức khỏe toàn diện, tiêm chủng phòng bệnh và theo dõi phát triển thể chất cho trẻ từ sơ sinh đến 15 tuổi.',
      detailed_desc: 'Khoa Nhi khoa thiết kế không gian khám thân thiện với trẻ em. Các bác sĩ giàu kinh nghiệm tư vấn tận tình, hạn chế tối đa việc sử dụng kháng sinh không cần thiết, tập trung nâng cao đề kháng tự nhiên cho trẻ.',
      conditions: ['Sốt vi rút & Sốt xuất huyết trẻ em', 'Viêm tai giữa & Viêm amidan', 'Rối loạn tiêu hóa & Biếng ăn ở trẻ', 'Hen phế quản trẻ em', 'Tư vấn dinh dưỡng & Tăng trưởng', 'Tiêm chủng & Tầm soát vi chất'],
      procedure: [
        'Đo chiều cao, cân nặng, vòng đầu & theo dõi biểu đồ phát triển',
        'Bác sĩ nhi khoa khám nhẹ nhàng, tạo cảm giác an tâm cho bé',
        'Xét nghiệm công thức máu & soi tai mũi họng nhi',
        'Hướng dẫn bố mẹ chăm sóc, theo dõi dấu hiệu chuyển nặng'
      ]
    },
    '5': {
      id: 5,
      code: 'ENT',
      name: 'Khoa Tai Mũi Họng',
      doctor_count: 3,
      description: 'Nội soi chẩn đoán viêm xoang, viêm họng cấp, viêm amidan, ù tai và các tổn thương vùng tai mũi họng.',
      detailed_desc: 'Khoa trang bị hệ thống nội soi tai mũi họng ống mềm hiện đại, không gây đau hay khó chịu cho người bệnh, giúp phát hiện sớm các ổ viêm nhiễm, polyp hoặc tổn thương dây thanh.',
      conditions: ['Viêm xoang cấp & Mãn tính', 'Viêm amidan & Viêm họng hạt', 'Ù tai & Giảm thính lực', 'Viêm tai giữa chảy mủ', 'Hạt dây thanh & Khàn tiếng', 'Polyp mũi'],
      procedure: [
        'Nội soi Tai Mũi Họng ống mềm độ phân giải cao',
        'Xem trực tiếp hình ảnh nội soi cùng bác sĩ trên màn hình',
        'Làm sạch tai mũi họng hoặc rửa xoang tại chỗ nếu có chỉ định',
        'Tư vấn đơn thuốc & hẹn lịch tái khám'
      ]
    },
    '6': {
      id: 6,
      code: 'NEUROLOGY',
      name: 'Khoa Thần kinh',
      doctor_count: 3,
      description: 'Tầm soát đau đầu mãn tính, rối loạn giấc ngủ, hội chứng tiền đình, đau thần kinh tọa và thiếu máu não.',
      detailed_desc: 'Chuyên khoa Thần kinh tiếp nhận và điều trị các triệu chứng đau đầu Migraine, chóng mặt tiền đình, mất ngủ kéo dài, tê bì chân tay. Đội ngũ bác sĩ ứng dụng phác đồ điều trị chuẩn quốc tế.',
      conditions: ['Đau đầu Migraine & Đau đầu căng thẳng', 'Rối loạn tiền đình & Chóng mặt', 'Mất ngủ mãn tính & Rối loạn giấc ngủ', 'Đau thần kinh tọa & Tê bì tay chân', 'Thiếu máu não cục bộ', 'Suy giảm nhớ tuổi già'],
      procedure: [
        'Khám phản xạ thần kinh & đo huyết áp tư thế',
        'Đánh giá thang điểm mất ngủ & lo âu',
        'Chỉ định đo điện não đồ (EEG) hoặc chụp MRI (nếu nghi ngờ tổn thương)',
        'Tư vấn phác đồ điều trị kết hợp liệu pháp điều hòa thần kinh'
      ]
    }
  };

  const defaultDoctorsList = [
    { id: 1, full_name: 'PGS.TS.BS Phạm Hoàng Nam', title: 'PGS.TS.BS', department_id: 2, years_experience: 22, consultation_fee: 500000, rating_avg: 4.9, rating_count: 42, hospital_address: 'Bệnh viện Đa khoa Quốc tế — Tầng 3', bio: 'Trưởng khoa Tim mạch với 22 năm kinh nghiệm chẩn đoán và điều trị bệnh mạch vành.' },
    { id: 2, full_name: 'ThS.BS Trần Thị Mai', title: 'ThS.BS', department_id: 3, years_experience: 12, consultation_fee: 350000, rating_avg: 4.8, rating_count: 29, hospital_address: 'Bệnh viện Đa khoa Quốc tế — Tầng 2', bio: 'Chuyên gia trị liệu da liễu thẩm mỹ, mề đay mãn tính, chàm và viêm da cơ địa.' },
    { id: 3, full_name: 'BS.CKII Lê Văn Đức', title: 'BS.CKII', department_id: 1, years_experience: 18, consultation_fee: 400000, rating_avg: 4.95, rating_count: 51, hospital_address: 'Bệnh viện Đa khoa Quốc tế — Tầng 1', bio: 'Chuyên khoa Nội tổng hợp, quản lý bệnh mãn tính đường tiêu hóa và tuần hoàn.' },
    { id: 4, full_name: 'BS.CKI Đặng Thu Hà', title: 'BS.CKI', department_id: 5, years_experience: 9, consultation_fee: 300000, rating_avg: 4.75, rating_count: 18, hospital_address: 'Bệnh viện Đa khoa Quốc tế — Tầng 4', bio: 'Chuyên gia khám và điều trị nội soi Tai Mũi Họng, viêm xoang cấp và amidan.' }
  ];

  useEffect(() => {
    fetchData();
  }, [deptId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const depts = await ApiService.getDepartments();
      const matched = depts?.find(d => String(d.id) === String(deptId));
      if (matched) {
        setDepartment({
          ...matched,
          detailed_desc: initialDepartments[String(matched.id)]?.detailed_desc || matched.description,
          conditions: initialDepartments[String(matched.id)]?.conditions || ['Sốt', 'Đau đầu', 'Mệt mỏi'],
          procedure: initialDepartments[String(matched.id)]?.procedure || ['Kiểm tra sinh hiệu', 'Khám lâm sàng', 'Kê đơn']
        });
      } else {
        setDepartment(initialDepartments[String(deptId)] || initialDepartments['1']);
      }

      const docs = await ApiService.getDoctors();
      if (docs && docs.length > 0) {
        const filteredDocs = docs.filter(doc => String(doc.department_id) === String(deptId));
        setDoctors(filteredDocs.length > 0 ? filteredDocs : defaultDoctorsDataForDept(deptId));
      } else {
        setDoctors(defaultDoctorsDataForDept(deptId));
      }
    } catch (e) {
      setDepartment(initialDepartments[String(deptId)] || initialDepartments['1']);
      setDoctors(defaultDoctorsDataForDept(deptId));
    } finally {
      setLoading(false);
    }
  };

  const defaultDoctorsDataForDept = (id) => {
    const matched = defaultDoctorsList.filter(d => String(d.department_id) === String(id));
    if (matched.length > 0) return matched;
    return [defaultDoctorsList[0]];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F5F0]">
        <Navbar />
        <div className="max-w-[1080px] mx-auto px-4 py-20 text-center text-[#6B6A65]">
          Đang tải thông tin chuyên khoa...
        </div>
        <Footer />
      </div>
    );
  }

  const deptData = department || initialDepartments['1'];

  return (
    <div className="min-h-screen bg-[#F7F5F0]">
      <Navbar />

      <main className="max-w-[1080px] mx-auto px-4 lg:px-8 py-8 space-y-8 text-left">
        {/* Breadcrumb Header */}
        <div className="space-y-2 border-b border-[#E4E1D8] pb-6">
          <div className="text-xs text-[#6B6A65] flex items-center space-x-1">
            <Link href="/" className="hover:text-[#1F6F5C]">Trang chủ</Link>
            <span>/</span>
            <Link href="/departments" className="hover:text-[#1F6F5C]">Chuyên khoa</Link>
            <span>/</span>
            <span className="font-semibold text-[#1C1B19]">{deptData.name}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-sm bg-[#DCEAE6] text-[#1F6F5C] flex items-center justify-center font-bold flex-shrink-0">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1B19]">{deptData.name}</h1>
                <p className="text-xs text-[#6B6A65]">
                  Quy tụ {doctors.length} bác sĩ chuyên khoa • Đạt chuẩn chẩn đoán y khoa Việt Nam
                </p>
              </div>
            </div>

            <Link
              href="/symptom-checker"
              className="btn-primary px-5 py-2.5 text-xs font-semibold flex items-center justify-center space-x-2 self-start sm:self-auto"
            >
              <Calendar className="w-4 h-4" />
              <span>Đặt lịch khám chuyên khoa</span>
            </Link>
          </div>
        </div>

        {/* Department Overview & Detailed Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overview Card */}
            <div className="medical-card p-6 space-y-4">
              <h2 className="text-lg font-semibold text-[#1C1B19]">Giới thiệu Chuyên khoa</h2>
              <p className="text-sm text-[#1C1B19] leading-relaxed">
                {deptData.detailed_desc || deptData.description}
              </p>
            </div>

            {/* Treated Conditions Grid */}
            <div className="medical-card p-6 space-y-4">
              <h2 className="text-lg font-semibold text-[#1C1B19]">Bệnh lý & Triệu chứng điều trị chính</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {deptData.conditions?.map((cond, idx) => (
                  <div key={idx} className="flex items-start space-x-2 bg-[#F7F5F0] p-3 rounded-sm border border-[#E4E1D8]">
                    <CheckCircle className="w-4 h-4 text-[#1F6F5C] flex-shrink-0 mt-0.5" />
                    <span className="text-xs font-medium text-[#1C1B19]">{cond}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Examination Steps */}
            <div className="medical-card p-6 space-y-4">
              <h2 className="text-lg font-semibold text-[#1C1B19]">Quy trình thăm khám tiêu chuẩn</h2>
              <div className="space-y-3">
                {deptData.procedure?.map((step, idx) => (
                  <div key={idx} className="flex items-start space-x-3">
                    <span className="w-6 h-6 rounded-full bg-[#DCEAE6] text-[#1F6F5C] font-semibold text-xs flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-xs text-[#1C1B19] pt-1">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Doctors operating in this department */}
            <div className="space-y-4 pt-4">
              <h2 className="text-xl font-bold text-[#1C1B19]">Đội ngũ Bác sĩ trực thuộc {deptData.name}</h2>
              <div className="space-y-4">
                {doctors.map((doc) => (
                  <div key={doc.id} className="medical-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-12 h-12 rounded-full bg-[#DCEAE6] text-[#1F6F5C] font-semibold flex items-center justify-center text-sm flex-shrink-0">
                        {doc.title ? doc.title.slice(0, 3) : 'BS'}
                      </div>
                      <div className="space-y-1">
                        <Link href={`/doctors/${doc.id}`} className="text-base font-semibold text-[#1C1B19] hover:text-[#1F6F5C]">
                          {doc.full_name}
                        </Link>
                        <p className="text-xs text-[#6B6A65]">
                          {doc.years_experience || 10} năm kinh nghiệm • ★ {doc.rating_avg || 4.9} ({doc.rating_count || 30} lượt đánh giá)
                        </p>
                        <p className="text-xs text-[#1C1B19] line-clamp-1">{doc.bio}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-[#E4E1D8]">
                      <div>
                        <span className="text-[11px] text-[#6B6A65] block">Giá khám:</span>
                        <span className="text-sm font-bold text-[#1F6F5C]">
                          {doc.consultation_fee ? doc.consultation_fee.toLocaleString('vi-VN') : '350.000'} đ
                        </span>
                      </div>
                      <Link
                        href={`/doctors/${doc.id}`}
                        className="btn-primary px-3 py-1.5 text-xs flex items-center space-x-1"
                      >
                        <span>Đặt lịch</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar: AI Symptom Checker & Clinic Contact */}
          <div className="space-y-6">
            {/* AI Assistant Banner */}
            <div className="medical-card p-5 bg-[#F7F5F0] border border-[#E4E1D8] space-y-4">
              <div className="flex items-center space-x-2 text-[#1F6F5C]">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-semibold text-sm text-[#1C1B19]">Chưa chắc chắn triệu chứng?</h3>
              </div>
              <p className="text-xs text-[#6B6A65] leading-relaxed">
                Sử dụng công cụ trí tuệ nhân tạo (AI) để phân tích triệu chứng ban đầu. AI sẽ tự động gợi ý đúng chuyên khoa và mức độ ưu tiên thăm khám.
              </p>
              <Link
                href="/symptom-checker"
                className="btn-primary w-full py-2 text-xs flex items-center justify-center space-x-1"
              >
                <span>Thử phân tích AI ngay</span>
              </Link>
            </div>

            {/* Quality Commitment Card */}
            <div className="medical-card p-5 space-y-3">
              <h3 className="font-semibold text-sm text-[#1C1B19]">Cam kết chất lượng</h3>
              <ul className="space-y-2 text-xs text-[#6B6A65]">
                <li className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-[#1F6F5C]" />
                  <span>100% Bác sĩ có chứng chỉ hành nghề</span>
                </li>
                <li className="flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-[#1F6F5C]" />
                  <span>Thời gian chờ khám tối đa 15 phút</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-[#1F6F5C]" />
                  <span>Bảo mật dữ liệu bệnh án 100%</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
