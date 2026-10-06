import './globals.css';
import DemoRoleSwitcher from '../components/DemoRoleSwitcher';

export const metadata = {
  title: 'Hệ thống Đặt lịch khám bệnh & AI Phân tích triệu chứng',
  description: 'Nền tảng y tế thông minh dành cho người Việt — Phân tích triệu chứng bằng AI, đề xuất bác sĩ chuyên khoa và đặt lịch khám tiện lợi.',
  keywords: 'đặt lịch khám, phân tích triệu chứng ai, bác sĩ chuyên khoa, y tế việt nam',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#F7F5F0] text-[#1C1B19] font-sans antialiased selection:bg-[#DCEAE6] selection:text-[#1F6F5C]">
        {children}
        <DemoRoleSwitcher />
      </body>
    </html>
  );
}
